import type {
  AdminStaff,
  Animal,
  AuditLogEntry,
  EnvironmentReading,
  Farm,
  FarmMember,
  FeedEntry,
  HealthEvent,
  ISODateTime,
  MilkEntry,
  Profile,
  ReproductionCycle,
  Shed,
  Species,
  Vaccination,
} from '../types';
import {
  generateSeed,
  type ActivityDaily,
  type Device,
  type SeedData,
  type SensorReading,
} from './seed';

export const STORAGE_KEY = 'westock-admin-demo-v1';

export interface Rows {
  species: Species;
  profiles: Profile;
  farms: Farm;
  farm_members: FarmMember;
  sheds: Shed;
  animals: Animal;
  milk_entries: MilkEntry;
  feed_entries: FeedEntry;
  vaccinations: Vaccination;
  health_events: HealthEvent;
  reproduction_cycles: ReproductionCycle;
  environment_readings: EnvironmentReading;
  sensor_readings: SensorReading;
  activity_daily: ActivityDaily;
  devices: Device;
  admin_staff: AdminStaff;
  admin_audit_log: AuditLogEntry;
}
export type TableName = keyof Rows;
export type Tables = { [K in TableName]: Map<string, Rows[K]> };

/** One write, as stored in localStorage. The seed itself is never stored. */
export interface ChangeEntry {
  op: 'insert' | 'update' | 'delete';
  table: TableName;
  id: string;
  patch?: Record<string, unknown>;
  at: ISODateTime;
  staff_id: string | null;
}
export interface ChangeMeta {
  at: ISODateTime;
  staff_id: string | null;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type LooseRow = Record<string, unknown>;

const KEY_FIELDS: Record<TableName, (row: LooseRow) => string> = {
  species: (r) => String(r.id),
  profiles: (r) => String(r.id),
  farms: (r) => String(r.id),
  farm_members: (r) => `${String(r.farm_id)}/${String(r.user_id)}`,
  sheds: (r) => String(r.id),
  animals: (r) => String(r.id),
  milk_entries: (r) => String(r.id),
  feed_entries: (r) => String(r.id),
  vaccinations: (r) => String(r.id),
  health_events: (r) => String(r.id),
  reproduction_cycles: (r) => String(r.id),
  environment_readings: (r) => String(r.id),
  sensor_readings: (r) => String(r.id),
  activity_daily: (r) => String(r.id),
  devices: (r) => String(r.id),
  admin_staff: (r) => String(r.user_id),
  admin_audit_log: (r) => String(r.id),
};

/** Everything that belongs to a farm. The activity log stays: it's the record of what happened. */
const FARM_CHILD_TABLES: TableName[] = [
  'farm_members',
  'sheds',
  'animals',
  'milk_entries',
  'feed_entries',
  'vaccinations',
  'health_events',
  'reproduction_cycles',
  'environment_readings',
  'sensor_readings',
  'activity_daily',
  'devices',
];

function buildTables(seed: SeedData): Tables {
  const tables = {} as Record<TableName, Map<string, LooseRow>>;
  for (const name of Object.keys(KEY_FIELDS) as TableName[]) {
    const keyOf = KEY_FIELDS[name];
    const rows = seed[name] as unknown as LooseRow[];
    tables[name] = new Map(rows.map((row) => [keyOf(row), row]));
  }
  return tables as unknown as Tables;
}

function isChangeEntry(value: unknown): value is ChangeEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<ChangeEntry>;
  return (
    (entry.op === 'insert' || entry.op === 'update' || entry.op === 'delete') &&
    typeof entry.id === 'string' &&
    typeof entry.table === 'string' &&
    entry.table in KEY_FIELDS &&
    (entry.op === 'delete' || (typeof entry.patch === 'object' && entry.patch !== null))
  );
}

function memoryStorage(): StorageLike {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function defaultStorage(): StorageLike {
  try {
    return globalThis.localStorage ?? memoryStorage();
  } catch {
    return memoryStorage(); // blocked in a private window, for example
  }
}

export interface DemoStoreOptions {
  storage?: StorageLike;
  /** Makes the seed; called again on reset and when a stored log can't be replayed. */
  seed?: () => SeedData;
}

/**
 * In-memory tables built from the seed, plus the change log that makes writes survive a reload.
 * Rows are replaced on update, never changed in place, so a seed can safely be reused.
 */
export class DemoStore {
  readonly storage: StorageLike;
  tables: Tables;
  /** Goes up on every write, so computed views can be cached between writes. */
  version = 0;
  private readonly makeSeed: () => SeedData;
  private log: ChangeEntry[] = [];
  private batching = 0;

  constructor(options: DemoStoreOptions = {}) {
    this.storage = options.storage ?? defaultStorage();
    this.makeSeed = options.seed ?? (() => generateSeed());
    this.tables = buildTables(this.makeSeed());
    this.load();
  }

  get<K extends TableName>(table: K, id: string): Rows[K] | undefined {
    return this.tables[table].get(id);
  }

  rows<K extends TableName>(table: K): Rows[K][] {
    return [...this.tables[table].values()];
  }

  keyOf<K extends TableName>(table: K, row: Rows[K]): string {
    return KEY_FIELDS[table](row as unknown as LooseRow);
  }

  insert<K extends TableName>(table: K, row: Rows[K], meta: ChangeMeta): Rows[K] {
    const id = this.keyOf(table, row);
    this.commit({ op: 'insert', table, id, patch: { ...row }, ...meta });
    return this.tables[table].get(id) as Rows[K];
  }

  update<K extends TableName>(
    table: K,
    id: string,
    patch: Partial<Rows[K]>,
    meta: ChangeMeta,
  ): Rows[K] {
    this.commit({ op: 'update', table, id, patch: { ...patch }, ...meta });
    return this.tables[table].get(id) as Rows[K];
  }

  /** Deleting a farm also removes its sheds, members, animals and all their records. */
  remove(table: TableName, id: string, meta: ChangeMeta): void {
    this.commit({ op: 'delete', table, id, ...meta });
  }

  /** Runs several writes and saves the log once at the end. */
  batch<T>(work: () => T): T {
    this.batching++;
    try {
      return work();
    } finally {
      this.batching--;
      this.save();
    }
  }

  /** Clears the log and goes back to the untouched seed. */
  reset(): void {
    this.log = [];
    this.storage.removeItem(STORAGE_KEY);
    this.tables = buildTables(this.makeSeed());
    this.version++;
  }

  get changeLog(): readonly ChangeEntry[] {
    return this.log;
  }

  private commit(entry: ChangeEntry): void {
    this.apply(entry);
    this.log.push(entry);
    this.version++;
    this.save();
  }

  private apply(entry: ChangeEntry): void {
    const table = this.tables[entry.table] as unknown as Map<string, LooseRow>;
    const existing = table.get(entry.id);
    switch (entry.op) {
      case 'insert':
        if (existing || !entry.patch) throw new Error(`can't insert ${entry.table}/${entry.id}`);
        table.set(entry.id, entry.patch);
        break;
      case 'update':
        if (!existing || !entry.patch) throw new Error(`can't update ${entry.table}/${entry.id}`);
        table.set(entry.id, { ...existing, ...entry.patch });
        break;
      case 'delete':
        if (!existing) throw new Error(`can't delete ${entry.table}/${entry.id}`);
        table.delete(entry.id);
        if (entry.table === 'farms') this.removeFarmChildren(entry.id);
        break;
    }
  }

  private removeFarmChildren(farmId: string): void {
    for (const name of FARM_CHILD_TABLES) {
      const table = this.tables[name] as unknown as Map<string, LooseRow>;
      for (const [key, row] of table) {
        if (row.farm_id === farmId) table.delete(key);
      }
    }
  }

  private save(): void {
    if (this.batching > 0) return;
    try {
      if (this.log.length === 0) this.storage.removeItem(STORAGE_KEY);
      else this.storage.setItem(STORAGE_KEY, JSON.stringify(this.log));
    } catch {
      // Storage is full or blocked: keep working in memory for this visit.
    }
  }

  /** Replays the stored log. If it can't be read or replayed, discards it and starts fresh. */
  private load(): void {
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isChangeEntry)) throw new Error('bad change log');
      for (const entry of parsed) this.apply(entry);
      this.log = parsed;
    } catch {
      this.log = [];
      this.tables = buildTables(this.makeSeed());
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // nothing more to do
      }
    }
  }
}

export function createDemoStore(options?: DemoStoreOptions): DemoStore {
  return new DemoStore(options);
}
