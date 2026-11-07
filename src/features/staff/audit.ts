import type { PillTone } from '../../components/StatusPill';
import type {
  AdminStaff,
  Animal,
  AuditLogEntry,
  FeedEntry,
  HealthEvent,
  ISODate,
  MilkEntry,
  ReproductionCycle,
  Shed,
  StaffRole,
  UUID,
  Vaccination,
} from '../../data/types';
import { formatDate, formatDateTime, formatDayMonth, formatRupees } from '../../lib/format';
import { formatShed, HEALTH_LABELS } from '../../lib/labels';

/** What a log row did, in the words of the Action filter and pill. */
export type LogKind = 'edited' | 'added' | 'deleted' | 'done' | 'role' | 'invited' | 'removed';

/** The Action filter's order: the prototype's, then Added, which it has no row for. */
export const LOG_KINDS: readonly LogKind[] = [
  'edited',
  'deleted',
  'done',
  'role',
  'invited',
  'removed',
  'added',
];

export const LOG_KIND_LABELS: Record<LogKind, string> = {
  edited: 'Edited',
  added: 'Added',
  deleted: 'Deleted',
  done: 'Marked done',
  role: 'Role changed',
  invited: 'Invited',
  removed: 'Removed',
};

export const LOG_KIND_TONES: Record<LogKind, PillTone> = {
  edited: 'blue',
  added: 'grey',
  deleted: 'red',
  done: 'green',
  role: 'pink',
  invited: 'green',
  removed: 'red',
};

export function isLogKind(value: string): value is LogKind {
  return (LOG_KINDS as readonly string[]).includes(value);
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super admin',
  support: 'Support',
  viewer: 'Viewer',
};

/** The Role select's order, as in the prototype's invite dialog. */
export const STAFF_ROLES: readonly StaffRole[] = ['support', 'viewer', 'super_admin'];

interface Change {
  from: unknown;
  to: unknown;
}

function changeOf(entry: AuditLogEntry, field: string): Change | null {
  const value = entry.changes[field];
  return value && typeof value === 'object' && 'to' in value ? (value as Change) : null;
}

export function logKind(entry: AuditLogEntry): LogKind {
  if (entry.action === 'delete') return 'deleted';
  if (entry.table_name === 'admin_staff') {
    if (entry.action === 'insert') return 'invited';
    if (changeOf(entry, 'status')?.to === 'removed') return 'removed';
    return changeOf(entry, 'role') ? 'role' : 'edited';
  }
  if (entry.action === 'insert') return 'added';
  if (entry.table_name === 'farm_members' && changeOf(entry, 'role')) return 'role';
  if (entry.table_name === 'vaccinations' && changeOf(entry, 'done_date')?.to) return 'done';
  if (entry.table_name === 'health_events' && changeOf(entry, 'status')?.to === 'resolved')
    return 'done';
  if (
    entry.table_name === 'reproduction_cycles' &&
    changeOf(entry, 'insemination_verified')?.to === true
  )
    return 'done';
  return 'edited';
}

/**
 * The narrowest log query for an Action filter. The contract filters on insert, update or delete
 * and the table; the rest of each kind is told apart in the browser with `logKind`.
 */
export function serverFilter(kind: LogKind | undefined): {
  action?: AuditLogEntry['action'];
  table_name?: string;
} {
  switch (kind) {
    case 'deleted':
      return { action: 'delete' };
    case 'invited':
      return { action: 'insert', table_name: 'admin_staff' };
    case 'removed':
      return { action: 'update', table_name: 'admin_staff' };
    case 'added':
      return { action: 'insert' };
    case 'edited':
    case 'done':
    case 'role':
      return { action: 'update' };
    default:
      return {};
  }
}

// ---- describing a row ----

type AnimalName = Pick<Animal, 'tag_number' | 'name'>;

/** The records a log row points at, read from the lists the contract has. */
export interface AuditLookup {
  farms: Map<UUID, string>;
  animals: Map<UUID, AnimalName>;
  milk: Map<UUID, MilkEntry>;
  feed: Map<UUID, FeedEntry>;
  vaccinations: Map<UUID, Vaccination>;
  health: Map<UUID, HealthEvent>;
  cycles: Map<UUID, ReproductionCycle>;
  sheds: Map<UUID, Shed>;
  people: Map<UUID, string>;
  staff: Map<UUID, AdminStaff>;
}

export function emptyLookup(): AuditLookup {
  return {
    farms: new Map(),
    animals: new Map(),
    milk: new Map(),
    feed: new Map(),
    vaccinations: new Map(),
    health: new Map(),
    cycles: new Map(),
    sheds: new Map(),
    people: new Map(),
    staff: new Map(),
  };
}

export interface ChangeLine {
  field: string;
  from: string;
  to: string;
}

export interface DescribedEntry {
  entry: AuditLogEntry;
  kind: LogKind;
  record: string;
  farm: string;
  changes: ChangeLine[];
  note: string | null;
}

const NOTHING = '—';
const ADMIN_FARM = 'WeSTOCK admin';

const FIELD_LABELS: Record<string, string> = {
  litres: 'Litres',
  price_per_litre: 'Price per litre',
  session: 'Session',
  quantity_kg: 'Quantity',
  cost: 'Cost',
  feed_type: 'Feed',
  done_date: 'Done on',
  due_date: 'Due date',
  vaccine_name: 'Vaccine',
  description: 'Description',
  status: 'Status',
  breed: 'Breed',
  name: 'Name',
  tag_number: 'Tag',
  gender: 'Gender',
  dob: 'Date of birth',
  pashu_aadhaar: 'Pashu Aadhaar',
  shed_id: 'Shed',
  species_id: 'Species',
  district: 'District',
  state: 'State',
  lat: 'Latitude',
  lng: 'Longitude',
  poultry_count: 'Poultry',
  role: 'Role',
  insemination_verified: 'Slip',
  owner_id: 'Owner',
  code: 'Code',
  title: 'Issue',
  notes: 'Notes',
  tube_number: 'Tube number',
  full_name: 'Name',
  email: 'Email',
  high_temp_c: 'High temperature',
  offline_after_min: 'Offline after',
};

const STAFF_STATUS_LABELS: Record<string, string> = {
  invited: 'Invite sent',
  active: 'Active',
  removed: 'Removed',
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const humanise = (field: string) => capitalise(field.replace(/_/g, ' '));

export const animalText = (animal: AnimalName | undefined | null): string | null =>
  animal ? [animal.tag_number, animal.name].filter(Boolean).join(' ') : null;

/** `FMD (foot-and-mouth)` gives `FMD vaccine`, as the prototype writes it. */
export function vaccineText(name: string): string {
  const short = name.replace(/\s*\(.*\)\s*$/, '').trim() || name;
  return /vaccin/i.test(short) ? short : `${short} vaccine`;
}

const isIsoDate = (value: string): value is ISODate => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isIsoDateTime = (value: string) => /^\d{4}-\d{2}-\d{2}T/.test(value);

function formatValue(table: string, field: string, value: unknown, lookup: AuditLookup): string {
  if (value === null || value === undefined || value === '') return NOTHING;
  if (typeof value === 'boolean') {
    if (field === 'insemination_verified') return value ? 'Verified' : 'Not verified';
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'number') {
    if (field === 'litres') return value.toFixed(1);
    if (field === 'price_per_litre' || field === 'cost') return formatRupees(value);
    if (field === 'quantity_kg') return `${value} kg`;
    if (field === 'high_temp_c') return `${value} °C`;
    if (field === 'offline_after_min') return `${value} min`;
    return String(value);
  }
  if (typeof value !== 'string') return 'Changed';
  if (field === 'role')
    return table === 'admin_staff'
      ? (STAFF_ROLE_LABELS[value as StaffRole] ?? capitalise(value))
      : capitalise(value);
  if (field === 'status') {
    if (table === 'admin_staff') return STAFF_STATUS_LABELS[value] ?? capitalise(value);
    if (table === 'health_events')
      return HEALTH_LABELS[value as keyof typeof HEALTH_LABELS] ?? capitalise(value);
    return capitalise(value);
  }
  if (field === 'session' || field === 'gender' || field === 'species_id') return capitalise(value);
  if (field === 'shed_id') {
    const shed = lookup.sheds.get(value);
    return shed ? formatShed(shed) : 'Another shed';
  }
  if (field === 'owner_id' || field === 'user_id')
    return lookup.people.get(value) ?? 'Another person';
  if (isIsoDate(value)) return formatDate(value);
  if (isIsoDateTime(value)) return formatDateTime(value);
  return value;
}

function updateLines(entry: AuditLogEntry, lookup: AuditLookup): ChangeLine[] {
  const table = entry.table_name;
  const lines: ChangeLine[] = [];
  for (const [field, raw] of Object.entries(entry.changes)) {
    const change = raw as Change | null;
    if (!change || typeof change !== 'object' || !('to' in change)) continue;
    if (field === 'updated_at' || field === 'last_active_at') continue;
    if (field === 'resolved_at' && 'status' in entry.changes) continue;
    if (table === 'admin_staff' && field === 'status') {
      // "Access: Support → Removed", as the prototype puts a removal.
      const staff = lookup.staff.get(entry.record_id);
      const from =
        change.to === 'removed' && change.from === 'active' && staff
          ? STAFF_ROLE_LABELS[staff.role]
          : formatValue(table, field, change.from, lookup);
      lines.push({ field: 'Access', from, to: formatValue(table, field, change.to, lookup) });
      continue;
    }
    if (field === 'settings') {
      const from = (change.from ?? {}) as Record<string, unknown>;
      const to = (change.to ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(to)) {
        if (JSON.stringify(from[key]) === JSON.stringify(to[key])) continue;
        lines.push({
          field: FIELD_LABELS[key] ?? humanise(key),
          from: formatValue(table, key, from[key], lookup),
          to: formatValue(table, key, to[key], lookup),
        });
      }
      continue;
    }
    lines.push({
      field: FIELD_LABELS[field] ?? humanise(field),
      from: formatValue(table, field, change.from, lookup),
      to: formatValue(table, field, change.to, lookup),
    });
  }
  return lines;
}

function insertLine(entry: AuditLogEntry, row: Record<string, unknown>, lookup: AuditLookup) {
  const table = entry.table_name;
  const line = (field: string, value: unknown): ChangeLine => ({
    field: FIELD_LABELS[field] ?? humanise(field),
    from: NOTHING,
    to: formatValue(table, field, value, lookup),
  });
  switch (table) {
    case 'milk_entries':
      return line('litres', row.litres);
    case 'feed_entries':
      return line('quantity_kg', row.quantity_kg);
    case 'animals':
    case 'health_events':
    case 'reproduction_cycles':
      return line('status', row.status);
    case 'vaccinations':
      return line('due_date', row.due_date);
    case 'farm_members':
    case 'admin_staff':
      return line('role', row.role);
    case 'sheds':
      return { field: 'Shed', from: NOTHING, to: formatShed(row as Pick<Shed, 'code' | 'name'>) };
    default:
      return { field: 'Record', from: NOTHING, to: 'Added' };
  }
}

function deletedSummary(table: string, row: Record<string, unknown>): string {
  if (table === 'milk_entries' && typeof row.litres === 'number')
    return `${row.litres.toFixed(1)} L`;
  if (table === 'feed_entries' && typeof row.quantity_kg === 'number')
    return `${row.quantity_kg} kg`;
  if (typeof row.name === 'string' && row.name) return row.name;
  return 'Entry';
}

/** The row the entry is about: itself for an add or a delete, the current record for an edit. */
function recordRow(entry: AuditLogEntry, lookup: AuditLookup): Record<string, unknown> | null {
  if (entry.action !== 'update') return entry.changes;
  const id = entry.record_id;
  const maps: Partial<Record<string, Map<string, unknown>>> = {
    milk_entries: lookup.milk,
    feed_entries: lookup.feed,
    vaccinations: lookup.vaccinations,
    health_events: lookup.health,
    reproduction_cycles: lookup.cycles,
    sheds: lookup.sheds,
    admin_staff: lookup.staff,
  };
  const found = maps[entry.table_name]?.get(id);
  return (found as Record<string, unknown> | undefined) ?? null;
}

function recordText(entry: AuditLogEntry, lookup: AuditLookup): string {
  const row = recordRow(entry, lookup);
  const str = (value: unknown) => (typeof value === 'string' ? value : null);
  const animalOf = (value: unknown) => animalText(lookup.animals.get(str(value) ?? ''));
  const join = (head: string, tail: string | null | undefined) =>
    tail ? `${head} · ${tail}` : head;

  switch (entry.table_name) {
    case 'milk_entries': {
      if (!row) return 'Milk entry';
      const who = animalOf(row.animal_id) ?? formatDayMonth(str(row.entry_date));
      return join('Milk entry', `${who}, ${str(row.session) ?? ''}`.replace(/, $/, ''));
    }
    case 'feed_entries': {
      if (!row) return 'Feed entry';
      const kg = typeof row.quantity_kg === 'number' ? ` ${row.quantity_kg} kg` : '';
      return join('Feed entry', `${(str(row.feed_type) ?? 'feed').toLowerCase()}${kg}`);
    }
    case 'animals':
      return join('Animal', animalOf(entry.record_id) ?? animalText(row as AnimalName | null));
    case 'vaccinations':
      return row
        ? join(vaccineText(str(row.vaccine_name) ?? 'Vaccine'), animalOf(row.animal_id))
        : 'Vaccination';
    case 'health_events':
      return row ? join(str(row.title) ?? 'Health issue', animalOf(row.animal_id)) : 'Health issue';
    case 'reproduction_cycles': {
      if (!row) return 'Breeding record';
      const head =
        row.status === 'heat'
          ? 'Heat'
          : row.status === 'inseminated'
            ? 'Insemination'
            : 'Breeding record';
      return join(head, animalOf(row.animal_id));
    }
    case 'farms':
      return entry.action === 'update' ? 'Farm details' : join('Farm', str(entry.changes.name));
    case 'farm_members': {
      const userId = entry.record_id.split('/')[1] ?? '';
      return join('Farm member', lookup.people.get(userId));
    }
    case 'sheds':
      return join('Shed', row ? formatShed(row as Pick<Shed, 'code' | 'name'>) : null);
    case 'admin_staff':
      return join('Staff', str(row?.full_name) ?? lookup.staff.get(entry.record_id)?.full_name);
    default:
      return humanise(entry.table_name);
  }
}

function farmText(entry: AuditLogEntry, lookup: AuditLookup): string {
  if (entry.table_name === 'admin_staff') return ADMIN_FARM;
  if (!entry.farm_id) return NOTHING;
  const name = lookup.farms.get(entry.farm_id);
  if (name) return name;
  if (entry.table_name === 'farms' && typeof entry.changes.name === 'string')
    return entry.changes.name;
  return 'A deleted farm';
}

/** A note for staff rows, which the log writes without one. */
function staffNote(entry: AuditLogEntry): string | null {
  if (entry.table_name !== 'admin_staff') return null;
  if (entry.action === 'insert' && typeof entry.changes.email === 'string')
    return `Invite email sent to ${entry.changes.email}`;
  const status = changeOf(entry, 'status');
  if (status?.to === 'removed')
    return status.from === 'invited' ? 'Invite cancelled' : 'Signed out and removed';
  if (status?.from === 'invited' && status.to === 'active') return 'Signed in for the first time';
  return null;
}

/** A log row in plain words: "Litres: 6.0 → 5.5", never the raw JSON. */
export function describeEntry(entry: AuditLogEntry, lookup: AuditLookup): DescribedEntry {
  const row = entry.changes;
  let changes: ChangeLine[];
  if (entry.action === 'update') changes = updateLines(entry, lookup);
  else if (entry.action === 'insert') changes = [insertLine(entry, row, lookup)];
  else changes = [{ field: 'Entry', from: deletedSummary(entry.table_name, row), to: 'Removed' }];
  return {
    entry,
    kind: logKind(entry),
    record: recordText(entry, lookup),
    farm: farmText(entry, lookup),
    changes,
    note: entry.note ?? staffNote(entry),
  };
}

/** `Litres: 75.0 → 7.5`, every change on one line, for the CSV. */
export const changeText = (line: ChangeLine) => `${line.field}: ${line.from} → ${line.to}`;

// ---- what to read to describe a set of rows ----

export type NeedKind = 'animals' | 'milk' | 'feed' | 'vaccinations' | 'health' | 'cycles' | 'farm';
export interface LookupNeed {
  kind: NeedKind;
  farmId: UUID;
  /** Milk and feed are read from this day on. */
  from?: ISODate;
}

const ANIMAL_TABLES = new Set([
  'animals',
  'milk_entries',
  'feed_entries',
  'vaccinations',
  'health_events',
  'reproduction_cycles',
]);
const UPDATE_NEEDS: Partial<Record<string, NeedKind>> = {
  milk_entries: 'milk',
  feed_entries: 'feed',
  vaccinations: 'vaccinations',
  health_events: 'health',
  reproduction_cycles: 'cycles',
  sheds: 'farm',
  farm_members: 'farm',
};

/** Milk and feed are read back this far before the oldest edit, since the edit doesn't say. */
const ENTRY_WINDOW_DAYS = 45;

function dayBefore(at: string, days: number): ISODate {
  const ms = Date.parse(at) - days * 86_400_000;
  // Month starts keep the query key the same as more rows load.
  return new Date(ms).toISOString().slice(0, 7) + '-01';
}

export function lookupNeeds(entries: readonly AuditLogEntry[]): LookupNeed[] {
  const needs = new Map<string, LookupNeed>();
  const add = (need: LookupNeed) => {
    const key = `${need.kind}|${need.farmId}`;
    const known = needs.get(key);
    if (!known || (need.from && known.from && need.from < known.from))
      needs.set(key, known ? { ...known, from: need.from } : need);
  };
  for (const entry of entries) {
    const farmId = entry.farm_id;
    if (!farmId || entry.table_name === 'admin_staff') continue;
    if (ANIMAL_TABLES.has(entry.table_name)) add({ kind: 'animals', farmId });
    if (entry.table_name === 'farm_members') add({ kind: 'farm', farmId });
    if (entry.table_name === 'farms' && 'owner_id' in entry.changes) add({ kind: 'farm', farmId });
    if (entry.table_name === 'animals' && 'shed_id' in entry.changes) add({ kind: 'farm', farmId });
    if (entry.action !== 'update') continue;
    const kind = UPDATE_NEEDS[entry.table_name];
    if (!kind) continue;
    // Feed is a few rows a day per farm, so all of it is read; milk can be one row per cow.
    const from = kind === 'milk' ? dayBefore(entry.at, ENTRY_WINDOW_DAYS) : undefined;
    add({ kind, farmId, from });
  }
  return [...needs.values()];
}

/** How the period filter reads: '' is the last 7 days. */
export type Period = '' | '30' | 'all';

export function periodSince(period: Period, now = Date.now()): string | undefined {
  if (period === 'all') return undefined;
  const days = period === '30' ? 30 : 7;
  // To the minute, so the query key holds still while the page is open.
  const minute = Math.floor(now / 60_000) * 60_000;
  return new Date(minute - days * 86_400_000).toISOString();
}

/** `20 min ago`; the person reading is active "Now"; an invite that wasn't used, "Not signed in yet". */
export function lastActiveText(
  staff: Pick<AdminStaff, 'last_active_at' | 'user_id'>,
  meId: UUID | undefined,
  relative: (at: string) => string,
): string {
  if (staff.user_id === meId) return 'Now';
  if (!staff.last_active_at) return 'Not signed in yet';
  return relative(staff.last_active_at);
}
