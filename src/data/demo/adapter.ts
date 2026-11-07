import { DataError } from '../errors';
import type { DataSource } from '../source';
import type {
  AdminStaff,
  AnalyticsSeries,
  Animal,
  AnimalListRow,
  AuditLogEntry,
  ConnectionState,
  CycleRow,
  Farm,
  FarmDashboard,
  FarmDetail,
  FarmListRow,
  FarmMember,
  FarmerListRow,
  FeedEntry,
  FeedRow,
  HealthEvent,
  HealthRow,
  HealthStatus,
  ISODate,
  Lang,
  MemberRole,
  MilkEntry,
  MilkRow,
  MilkSession,
  Overview,
  Page,
  Paging,
  Profile,
  ReproductionCycle,
  SearchHit,
  StaffRole,
  StaffStatus,
  UUID,
  Vaccination,
  VaccinationRow,
} from '../types';
import { animalPhoto, slipImage } from './seed';
import type { ChangeMeta, DemoStore, Rows, TableName } from './store';
import { addDays, DAY, HOUR, istDate, MINUTE, toIso } from './time';

export const SESSION_KEY = 'westock-admin-demo-session-v1';

export interface DemoAdapterOptions {
  /** Simulated latency in ms, [min, max]. Tests pass [0, 0]. */
  latency?: [number, number];
}

interface Session {
  staff_id: string;
  role: StaffRole | null; // set by the demo role switcher
}

const DEFAULT_PAGE_SIZE = 20;
const IGNORED_FIELDS = new Set(['updated_at', 'last_active_at']);
const LANGS: Lang[] = ['hi', 'mr', 'ml', 'gu', 'ta', 'en'];
const MILK_SESSIONS: MilkSession[] = ['morning', 'afternoon', 'evening'];
const MEMBER_ROLES: MemberRole[] = ['owner', 'manager', 'worker'];
const STAFF_ROLES: StaffRole[] = ['super_admin', 'support', 'viewer'];
const STAFF_STATUSES: StaffStatus[] = ['invited', 'active', 'removed'];
const HEALTH_STATUSES: HealthStatus[] = ['detected', 'sick', 'condition', 'resolved'];

// ---- small helpers ----

function invalid(message: string, field: string): DataError {
  return new DataError('validation', message, field);
}
function notFound(): DataError {
  return new DataError('not_found');
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function trendPct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return round1(((current - previous) / previous) * 100);
}
function paginate<T>(rows: T[], paging: Paging): Page<T> {
  const size = paging.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, paging.page ?? 1);
  return { rows: rows.slice((page - 1) * size, page * size), total: rows.length };
}
function contains(text: string | null | undefined, needle: string): boolean {
  return (text ?? '').toLowerCase().includes(needle);
}
function descending(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}
function ascending(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
function isIsoDate(value: unknown): value is ISODate {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}
function requireDate(value: unknown, field: string): void {
  if (!isIsoDate(value)) throw invalid('Enter a valid date.', field);
}
function requireText(value: string | null | undefined, field: string, message: string): string {
  const text = (value ?? '').trim();
  if (text === '') throw invalid(message, field);
  return text;
}
function requireAmount(value: unknown, field: string, message: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(message, field);
  }
}
function requireOptionalAmount(value: unknown, field: string, message: string): void {
  if (value !== null && value !== undefined) requireAmount(value, field, message);
}
function cleanNote(note: string | undefined | null): string | null {
  const text = (note ?? '').trim();
  return text === '' ? null : text;
}
function normalizeAadhaar(value: string | null | undefined): string | null {
  const text = (value ?? '').replace(/\s/g, '');
  if (text === '') return null;
  if (!/^\d{12}$/.test(text)) {
    throw invalid('Pashu Aadhaar must be exactly 12 digits.', 'pashu_aadhaar');
  }
  return text;
}
function maskPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/^\+91/, '');
  return `+91 ${digits.slice(0, 5)} •••${digits.slice(-2)}`;
}
function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function tagLabel(animal: Pick<Animal, 'tag_number' | 'name'>): string {
  return animal.name ? `Tag ${animal.tag_number} ${animal.name}` : `Tag ${animal.tag_number}`;
}
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function readSession(store: DemoStore): Session | null {
  try {
    const raw = store.storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.staff_id !== 'string') return null;
    const role = parsed.role && STAFF_ROLES.includes(parsed.role) ? parsed.role : null;
    return { staff_id: parsed.staff_id, role };
  } catch {
    return null;
  }
}
function writeSession(store: DemoStore, session: Session | null): void {
  try {
    if (session) store.storage.setItem(SESSION_KEY, JSON.stringify(session));
    else store.storage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked: sign-in lasts until the page reloads
  }
}

export function createDemoAdapter(store: DemoStore, options: DemoAdapterOptions = {}): DataSource {
  const [minLatency, maxLatency] = options.latency ?? [150, 300];
  const wait = () =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, minLatency + Math.random() * (maxLatency - minLatency));
    });

  let session = readSession(store);

  // ---- who is acting ----

  function currentStaff(): AdminStaff | null {
    if (!session) return null;
    const staff = store.get('admin_staff', session.staff_id);
    if (!staff || staff.status !== 'active') return null;
    return session.role ? { ...staff, role: session.role } : staff;
  }
  function requireEditor(): AdminStaff {
    const staff = currentStaff();
    if (!staff || staff.role === 'viewer') throw new DataError('not_allowed');
    return staff;
  }
  function requireSuperAdmin(): AdminStaff {
    const staff = currentStaff();
    if (!staff || staff.role !== 'super_admin') throw new DataError('not_allowed');
    return staff;
  }
  function metaFor(staff: AdminStaff): ChangeMeta {
    return { at: toIso(Date.now()), staff_id: staff.user_id };
  }

  // ---- the activity log, shaped like the admin_audit trigger ----

  function farmIdOf(table: TableName, row: unknown): UUID | null {
    if (table === 'farms') return (row as Farm).id;
    if (table === 'admin_staff') return null;
    return (row as { farm_id?: UUID }).farm_id ?? null;
  }
  function log(
    staff: AdminStaff,
    action: AuditLogEntry['action'],
    table: TableName,
    recordId: string,
    farmId: UUID | null,
    changes: Record<string, unknown>,
    note: string | null,
  ): void {
    let nextId = 1;
    for (const key of store.tables.admin_audit_log.keys())
      nextId = Math.max(nextId, Number(key) + 1);
    const entry: AuditLogEntry = {
      id: nextId,
      at: toIso(Date.now()),
      staff_id: staff.user_id,
      staff_name: staff.full_name,
      action,
      table_name: table,
      record_id: recordId,
      farm_id: farmId,
      changes,
      note,
    };
    store.insert('admin_audit_log', entry, metaFor(staff));
  }
  function insertRow<K extends TableName>(staff: AdminStaff, table: K, row: Rows[K]): Rows[K] {
    return store.batch(() => {
      const saved = store.insert(table, row, metaFor(staff));
      log(
        staff,
        'insert',
        table,
        store.keyOf(table, saved),
        farmIdOf(table, saved),
        { ...saved },
        null,
      );
      return saved;
    });
  }
  /** Saves only what changed and logs it; if nothing changed, writes nothing. */
  function updateRow<K extends TableName>(
    staff: AdminStaff,
    table: K,
    id: string,
    patch: Partial<Rows[K]>,
    note: string | null = null,
  ): Rows[K] {
    const before = store.get(table, id);
    if (!before) throw notFound();
    const previous = before as unknown as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined || sameValue(previous[field], value)) continue;
      changed[field] = value;
      if (!IGNORED_FIELDS.has(field)) changes[field] = { from: previous[field], to: value };
    }
    if (Object.keys(changes).length === 0) return before;
    return store.batch(() => {
      const saved = store.update(table, id, changed as Partial<Rows[K]>, metaFor(staff));
      log(staff, 'update', table, id, farmIdOf(table, saved), changes, note);
      return saved;
    });
  }

  // ---- lookups ----

  function requireFarm(id: UUID): Farm {
    const farm = store.get('farms', id);
    if (!farm) throw notFound();
    return farm;
  }
  function requireAnimalOnFarm(animalId: UUID, farmId: UUID, field = 'animal_id'): Animal {
    const animal = store.get('animals', animalId);
    if (!animal) throw notFound();
    if (animal.farm_id !== farmId) throw invalid('This animal is on another farm.', field);
    return animal;
  }
  function requireShedOnFarm(shedId: UUID, farmId: UUID): void {
    const shed = store.get('sheds', shedId);
    if (!shed || shed.farm_id !== farmId) throw invalid('Pick a shed on this farm.', 'shed_id');
  }
  function requireSpecies(id: string): void {
    if (!store.get('species', id)) throw invalid('Pick a species.', 'species_id');
  }
  function requireUniqueTag(farmId: UUID, tag: string, exceptId?: UUID): void {
    for (const animal of store.tables.animals.values()) {
      if (animal.farm_id === farmId && animal.tag_number === tag && animal.id !== exceptId) {
        throw new DataError(
          'duplicate_tag',
          `Tag ${tag} is already used on this farm.`,
          'tag_number',
        );
      }
    }
  }
  function personName(id: UUID | null): string | null {
    if (!id) return null;
    return store.get('profiles', id)?.full_name ?? store.get('admin_staff', id)?.full_name ?? null;
  }
  function today(): ISODate {
    return istDate(Date.now());
  }

  // ---- computed views, cached until the next write or the next day ----

  interface Views {
    version: number;
    day: ISODate;
    farmRows: Map<UUID, FarmListRow>;
    farmerRows: FarmerListRow[];
  }
  let views: Views | null = null;

  function computeViews(): Views {
    const day = today();
    if (views && views.version === store.version && views.day === day) return views;
    const sheds = new Map<UUID, number>();
    const animals = new Map<UUID, number>();
    const members = new Map<UUID, number>();
    const blackbox = new Set<UUID>();
    const milk7d = new Map<UUID, number>();
    const lastEntry = new Map<UUID, string>();
    const bump = (map: Map<UUID, number>, key: UUID, by = 1) =>
      map.set(key, (map.get(key) ?? 0) + by);
    const noteEntry = (farmId: UUID, at: string) => {
      const known = lastEntry.get(farmId);
      if (!known || at > known) lastEntry.set(farmId, at);
    };
    for (const shed of store.tables.sheds.values()) bump(sheds, shed.farm_id);
    for (const member of store.tables.farm_members.values()) bump(members, member.farm_id);
    for (const device of store.tables.devices.values()) {
      if (device.kind === 'blackbox') blackbox.add(device.farm_id);
    }
    for (const animal of store.tables.animals.values()) {
      if (animal.status === 'active') bump(animals, animal.farm_id);
    }
    // The last 7 finished days, as on the design: today is still filling up.
    const weekStart = addDays(day, -7);
    for (const entry of store.tables.milk_entries.values()) {
      if (entry.entry_date >= weekStart && entry.entry_date < day) {
        bump(milk7d, entry.farm_id, entry.litres);
      }
      noteEntry(entry.farm_id, entry.created_at);
    }
    for (const entry of store.tables.feed_entries.values())
      noteEntry(entry.farm_id, entry.created_at);

    const farmRows = new Map<UUID, FarmListRow>();
    for (const farm of store.tables.farms.values()) {
      const owner = store.get('profiles', farm.owner_id);
      farmRows.set(farm.id, {
        id: farm.id,
        name: farm.name,
        district: farm.district,
        state: farm.state,
        lat: farm.lat,
        lng: farm.lng,
        poultry_count: farm.poultry_count,
        created_at: farm.created_at,
        owner_id: farm.owner_id,
        owner_name: owner?.full_name ?? null,
        owner_phone: owner?.phone ?? null,
        language: owner?.language ?? null,
        sheds: sheds.get(farm.id) ?? 0,
        animals: animals.get(farm.id) ?? 0,
        members: members.get(farm.id) ?? 0,
        has_blackbox: blackbox.has(farm.id),
        milk_7d: round1(milk7d.get(farm.id) ?? 0),
        last_entry_at: lastEntry.get(farm.id) ?? null,
      });
    }

    const byOwner = new Map<UUID, FarmListRow[]>();
    for (const row of farmRows.values()) {
      byOwner.set(row.owner_id, [...(byOwner.get(row.owner_id) ?? []), row]);
    }
    const farmerRows: FarmerListRow[] = [];
    for (const [ownerId, rows] of byOwner) {
      const profile = store.get('profiles', ownerId);
      if (!profile) continue;
      const lastEntries = rows.map((r) => r.last_entry_at);
      // A farmer's place is their first farm's, the farm their row opens.
      const firstFarm = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      farmerRows.push({
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone,
        language: profile.language,
        joined_at: profile.created_at,
        farms: rows.length,
        animals: rows.reduce((sum, r) => sum + r.animals, 0),
        district: firstFarm?.district ?? null,
        state: firstFarm?.state ?? null,
        last_entry_at: lastEntries.reduce<string | null>(
          (max, v) => (v !== null && (max === null || v > max) ? v : max),
          null,
        ),
      });
    }
    views = { version: store.version, day, farmRows, farmerRows };
    return views;
  }

  function farmRow(id: UUID): FarmListRow {
    const row = computeViews().farmRows.get(id);
    if (!row) throw notFound();
    return row;
  }

  function animalRows(): AnimalListRow[] {
    const now = Date.now();
    const collars = new Map<UUID, Rows['devices']>();
    for (const device of store.tables.devices.values()) {
      if (device.animal_id) collars.set(device.animal_id, device);
    }
    const openHealth = new Map<UUID, number>();
    for (const event of store.tables.health_events.values()) {
      if (event.status !== 'resolved') {
        openHealth.set(event.animal_id, (openHealth.get(event.animal_id) ?? 0) + 1);
      }
    }
    const latestCycle = new Map<UUID, Rows['reproduction_cycles']>();
    for (const cycle of store.tables.reproduction_cycles.values()) {
      if (cycle.status !== 'heat' && cycle.status !== 'inseminated' && cycle.status !== 'pregnant')
        continue;
      const known = latestCycle.get(cycle.animal_id);
      if (!known || cycle.created_at > known.created_at) latestCycle.set(cycle.animal_id, cycle);
    }
    const rows: AnimalListRow[] = [];
    for (const animal of store.tables.animals.values()) {
      const farm = store.get('farms', animal.farm_id);
      if (!farm) continue;
      const shed = animal.shed_id ? store.get('sheds', animal.shed_id) : undefined;
      const species = store.get('species', animal.species_id);
      const collar = animal.hardware_tag_id ? collars.get(animal.id) : undefined;
      // An online collar keeps reporting while the app is open, so its last reading stays fresh.
      const lastReadingMs = collar
        ? collar.online
          ? now - collar.lag_min * MINUTE
          : Date.parse(collar.last_seen)
        : null;
      let connection: ConnectionState = 'no_hardware';
      if (animal.hardware_tag_id) {
        const staleAfter = farm.settings.offline_after_min * MINUTE;
        if (lastReadingMs === null || now - lastReadingMs >= staleAfter)
          connection = 'cannot_connect';
        else if ((collar?.last_temp_c ?? 0) >= farm.settings.high_temp_c)
          connection = 'temperature_high';
        else connection = 'normal';
      }
      const cycle = latestCycle.get(animal.id);
      const lastReadingAt = lastReadingMs === null ? null : toIso(lastReadingMs);
      rows.push({
        ...animal,
        category: species?.category ?? 'other',
        last_seen_at: lastReadingAt,
        last_reading_at: lastReadingAt,
        last_temp_c: collar?.last_temp_c ?? null,
        last_ambient_temp_c: collar?.last_ambient_temp_c ?? null,
        last_battery_pct: collar?.last_battery_pct ?? null,
        connection_state: connection,
        farm_name: farm.name,
        shed_code: shed?.code ?? null,
        shed_name: shed?.name ?? null,
        breeding_status:
          cycle?.status === 'heat' ||
          cycle?.status === 'inseminated' ||
          cycle?.status === 'pregnant'
            ? cycle.status
            : null,
        open_health: openHealth.get(animal.id) ?? 0,
      });
    }
    return rows;
  }

  function farmDashboard(farmId: UUID): FarmDashboard {
    const day = today();
    const dashboard: FarmDashboard = {
      reproduction: { heat: 0, inseminated: 0, pregnant: 0, may_deliver: 0 },
      health: { detected: 0, sick: 0, conditions: 0 },
      vaccination: { overdue: 0, due: 0, upcoming: 0 },
      milk_today: { total: 0, morning: 0, afternoon: 0, evening: 0 },
      animals_by_species: {},
    };
    const soon = addDays(day, 30);
    for (const cycle of store.tables.reproduction_cycles.values()) {
      if (cycle.farm_id !== farmId) continue;
      if (cycle.status === 'heat') dashboard.reproduction.heat++;
      if (cycle.status === 'inseminated') dashboard.reproduction.inseminated++;
      if (cycle.status === 'pregnant') {
        dashboard.reproduction.pregnant++;
        if (cycle.expected_delivery !== null && cycle.expected_delivery <= soon) {
          dashboard.reproduction.may_deliver++;
        }
      }
    }
    for (const event of store.tables.health_events.values()) {
      if (event.farm_id !== farmId) continue;
      if (event.status === 'detected') dashboard.health.detected++;
      if (event.status === 'sick') dashboard.health.sick++;
      if (event.status === 'condition') dashboard.health.conditions++;
    }
    const dueEnd = addDays(day, 7);
    for (const vaccine of store.tables.vaccinations.values()) {
      if (vaccine.farm_id !== farmId || vaccine.done_date !== null) continue;
      if (vaccine.due_date < day) dashboard.vaccination.overdue++;
      else if (vaccine.due_date <= dueEnd) dashboard.vaccination.due++;
      else if (vaccine.due_date <= soon) dashboard.vaccination.upcoming++;
    }
    for (const entry of store.tables.milk_entries.values()) {
      if (entry.farm_id !== farmId || entry.entry_date !== day) continue;
      dashboard.milk_today.total = round1(dashboard.milk_today.total + entry.litres);
      dashboard.milk_today[entry.session] = round1(
        dashboard.milk_today[entry.session] + entry.litres,
      );
    }
    for (const animal of store.tables.animals.values()) {
      if (animal.farm_id === farmId && animal.status === 'active') {
        dashboard.animals_by_species[animal.species_id] =
          (dashboard.animals_by_species[animal.species_id] ?? 0) + 1;
      }
    }
    return dashboard;
  }

  function dailyLitres(
    days: number,
    farmId: UUID | null,
    endingOn: ISODate = today(),
  ): { day: ISODate; litres: number }[] {
    const totals = new Map<ISODate, number>();
    for (let i = days - 1; i >= 0; i--) totals.set(addDays(endingOn, -i), 0);
    for (const entry of store.tables.milk_entries.values()) {
      if (farmId !== null && entry.farm_id !== farmId) continue;
      const known = totals.get(entry.entry_date);
      if (known !== undefined) totals.set(entry.entry_date, known + entry.litres);
    }
    return [...totals].map(([day, litres]) => ({ day, litres: round1(litres) }));
  }

  function analytics(farmId: UUID, animalId: UUID | null, days: 7 | 30 | 90): AnalyticsSeries {
    requireFarm(farmId);
    if (animalId !== null && !store.get('animals', animalId)) throw notFound();
    const since = addDays(today(), -days);
    const matches = (row: { farm_id: UUID; animal_id?: UUID | null }) =>
      row.farm_id === farmId && (animalId === null || row.animal_id === animalId);

    const milk = new Map<ISODate, { litres: number; revenue: number }>();
    for (const entry of store.tables.milk_entries.values()) {
      if (!matches(entry) || entry.entry_date < since) continue;
      const day = milk.get(entry.entry_date) ?? { litres: 0, revenue: 0 };
      day.litres += entry.litres;
      day.revenue += entry.litres * (entry.price_per_litre ?? 0);
      milk.set(entry.entry_date, day);
    }
    const feed = new Map<ISODate, { kg: number; cost: number }>();
    for (const entry of store.tables.feed_entries.values()) {
      if (!matches(entry) || entry.entry_date < since) continue;
      const day = feed.get(entry.entry_date) ?? { kg: 0, cost: 0 };
      day.kg += entry.quantity_kg;
      day.cost += entry.cost ?? 0;
      feed.set(entry.entry_date, day);
    }
    const activity = new Map<ISODate, AnalyticsSeries['activity'][number]>();
    for (const row of store.tables.activity_daily.values()) {
      if (!matches(row) || row.day < since) continue;
      const day = activity.get(row.day) ?? {
        day: row.day,
        stand_min: 0,
        sit_min: 0,
        walk_min: 0,
        eat_min: 0,
        ruminate_min: 0,
        drink_min: 0,
      };
      day.stand_min += row.stand_min;
      day.sit_min += row.sit_min;
      day.walk_min += row.walk_min;
      day.eat_min += row.eat_min;
      day.ruminate_min += row.ruminate_min;
      day.drink_min += row.drink_min;
      activity.set(row.day, day);
    }
    const hoursSince = toIso(Date.now() - Math.min(days, 7) * DAY);
    const cattle = new Map<string, { sum: number; n: number; max: number }>();
    for (const reading of store.tables.sensor_readings.values()) {
      if (!matches(reading) || reading.ts < hoursSince) continue;
      const hour = cattle.get(reading.ts) ?? { sum: 0, n: 0, max: 0 };
      hour.sum += reading.body_temp_c;
      hour.n++;
      hour.max = Math.max(hour.max, reading.body_temp_c);
      cattle.set(reading.ts, hour);
    }
    const environment = new Map<
      string,
      { temp: number; humidity: number; thi: number; n: number }
    >();
    for (const reading of store.tables.environment_readings.values()) {
      if (reading.farm_id !== farmId || reading.ts < hoursSince) continue;
      const hour = environment.get(reading.ts) ?? { temp: 0, humidity: 0, thi: 0, n: 0 };
      hour.temp += reading.temp_c;
      hour.humidity += reading.humidity ?? 0;
      hour.thi += reading.thi ?? 0;
      hour.n++;
      environment.set(reading.ts, hour);
    }
    const byKey = <T>(entries: [string, T][]) => entries.sort(([a], [b]) => (a < b ? -1 : 1));
    return {
      milk: byKey([...milk]).map(([day, v]) => ({
        day,
        litres: round1(v.litres),
        revenue: Math.round(v.revenue),
      })),
      feed: byKey([...feed]).map(([day, v]) => ({
        day,
        kg: Math.round(v.kg),
        cost: Math.round(v.cost),
      })),
      activity: byKey([...activity]).map(([, v]) => v),
      cattle_temperature: byKey([...cattle]).map(([hour, v]) => ({
        hour,
        avg_c: round1(v.sum / v.n),
        max_c: v.max,
      })),
      farm_temperature: byKey([...environment]).map(([hour, v]) => ({
        hour,
        temp_c: round1(v.temp / v.n),
        humidity: round1(v.humidity / v.n),
        thi: round1(v.thi / v.n),
      })),
    };
  }

  function latestEntries(farmId: UUID): FarmDetail['latest'] {
    const items: FarmDetail['latest'] = [];
    const describeAnimal = (id: UUID | null) => {
      const animal = id ? store.get('animals', id) : undefined;
      return animal ? tagLabel(animal) : 'Whole herd';
    };
    const newest = <T extends { at: string }>(rows: T[]) =>
      rows.sort((a, b) => descending(a.at, b.at)).slice(0, 5);
    const milk = newest(
      [...store.tables.milk_entries.values()]
        .filter((m) => m.farm_id === farmId)
        .map((m) => ({ at: m.created_at, row: m })),
    );
    for (const { at, row } of milk) {
      items.push({
        kind: 'milk',
        at,
        text: `${describeAnimal(row.animal_id)} · ${row.litres.toFixed(1)} L, ${row.session}`,
      });
    }
    const feed = newest(
      [...store.tables.feed_entries.values()]
        .filter((f) => f.farm_id === farmId)
        .map((f) => ({ at: f.created_at, row: f })),
    );
    for (const { at, row } of feed) {
      const shed = row.shed_id ? store.get('sheds', row.shed_id) : undefined;
      const target = shed ? `${shed.code ?? ''} ${shed.name}`.trim() : 'Whole farm';
      const cost = row.cost === null ? '' : ` · ${rupees(row.cost)}`;
      items.push({
        kind: 'feed',
        at,
        text: `${target} · ${lowerFirst(row.feed_type)} ${row.quantity_kg} kg${cost}`,
      });
    }
    const health = newest(
      [...store.tables.health_events.values()]
        .filter((h) => h.farm_id === farmId)
        .map((h) => ({ at: h.detected_at, row: h })),
    );
    for (const { at, row } of health) {
      items.push({
        kind: 'health',
        at,
        text: `${describeAnimal(row.animal_id)} · ${lowerFirst(row.title)}, ${row.status}`,
      });
    }
    return newest(items);
  }

  function fixedRecords(table: 'milk_entries' | 'feed_entries'): Set<string> {
    const ids = new Set<string>();
    for (const entry of store.tables.admin_audit_log.values()) {
      if (entry.action === 'update' && entry.table_name === table) ids.add(entry.record_id);
    }
    return ids;
  }

  function inRange(day: ISODate, from?: ISODate, to?: ISODate): boolean {
    return (from === undefined || day >= from) && (to === undefined || day <= to);
  }

  const farmNameOf = (id: UUID) => store.get('farms', id)?.name ?? '';

  // ---- writes that other writes share ----

  function checkPhone(phone: string): string {
    const compact = phone.replace(/[\s-]/g, '');
    const digits = compact.startsWith('+91') ? compact.slice(3) : compact;
    if (!/^\d{10}$/.test(digits)) throw invalid('Enter 10 digits after +91.', 'phone');
    return `+91${digits}`;
  }

  function checkFarmPatch(patch: Parameters<DataSource['updateFarm']>[1]): void {
    if (patch.name !== undefined) requireText(patch.name, 'name', 'Add a farm name.');
    if (patch.lat !== undefined && patch.lat !== null && (patch.lat < -90 || patch.lat > 90)) {
      throw invalid('Latitude must be between -90 and 90.', 'lat');
    }
    if (patch.lng !== undefined && patch.lng !== null && (patch.lng < -180 || patch.lng > 180)) {
      throw invalid('Longitude must be between -180 and 180.', 'lng');
    }
    const poultry = patch.poultry_count;
    if (poultry !== undefined && poultry !== null && (!Number.isInteger(poultry) || poultry < 0)) {
      throw invalid('Enter a whole number, 0 or more.', 'poultry_count');
    }
    const settings = patch.settings;
    if (settings?.high_temp_c !== undefined && !(settings.high_temp_c > 0)) {
      throw invalid('Enter a temperature above 0.', 'high_temp_c');
    }
    if (settings?.offline_after_min !== undefined && !(settings.offline_after_min > 0)) {
      throw invalid('Enter a number of minutes above 0.', 'offline_after_min');
    }
  }

  function checkAnimalFields(farmId: UUID, fields: Partial<Animal>): void {
    if (fields.species_id !== undefined) requireSpecies(fields.species_id);
    if (fields.shed_id) requireShedOnFarm(fields.shed_id, farmId);
    if (fields.dob) requireDate(fields.dob, 'dob');
    if (fields.gender && fields.gender !== 'female' && fields.gender !== 'male') {
      throw invalid('Pick a gender.', 'gender');
    }
    if (fields.status && !['active', 'sold', 'deceased'].includes(fields.status)) {
      throw invalid('Pick a status.', 'status');
    }
  }

  function checkMilk(v: Pick<MilkEntry, 'session' | 'litres' | 'price_per_litre'>): void {
    if (!MILK_SESSIONS.includes(v.session)) throw invalid('Pick a session.', 'session');
    requireAmount(v.litres, 'litres', 'Litres must be 0 or more.');
    requireOptionalAmount(v.price_per_litre, 'price_per_litre', 'Price must be 0 or more.');
  }

  function checkFeed(v: Pick<FeedEntry, 'feed_type' | 'quantity_kg' | 'cost'>): void {
    requireText(v.feed_type, 'feed_type', 'Add the feed type.');
    requireAmount(v.quantity_kg, 'quantity_kg', 'Quantity must be 0 or more.');
    requireOptionalAmount(v.cost, 'cost', 'Cost must be 0 or more.');
  }

  function checkReason(reason: string): string {
    const text = (reason ?? '').trim();
    if (text === '') throw new DataError('reason_required');
    return text;
  }

  function checkRole<T extends string>(value: T, allowed: T[], field: string): void {
    if (!allowed.includes(value)) throw invalid('Pick a role.', field);
  }

  // ---- the interface ----

  return {
    auth: {
      async signIn(email, password) {
        await wait();
        const address = (email ?? '').trim().toLowerCase();
        const wrong = () => invalid('Email or password is wrong', 'password');
        if ((password ?? '').length < 6) throw wrong();
        const staff = store.rows('admin_staff').find((s) => s.email === address);
        if (!staff || staff.status === 'removed') throw wrong();
        // First sign-in turns an invite into an active account, as admin_touch does.
        const at = toIso(Date.now());
        const meta = { at, staff_id: staff.user_id };
        const saved = store.batch(() => {
          const patch: Partial<AdminStaff> = { last_active_at: at };
          if (staff.status === 'invited') patch.status = 'active';
          const next = store.update('admin_staff', staff.user_id, patch, meta);
          if (staff.status === 'invited') {
            log(
              next,
              'update',
              'admin_staff',
              staff.user_id,
              null,
              {
                status: { from: 'invited', to: 'active' },
              },
              null,
            );
          }
          return next;
        });
        session = { staff_id: saved.user_id, role: null };
        writeSession(store, session);
        return saved;
      },
      async signOut() {
        await wait();
        session = null;
        writeSession(store, null);
      },
      async currentStaff() {
        await wait();
        return currentStaff();
      },
      async requestPasswordReset() {
        await wait();
        // Always succeeds, so the page doesn't reveal which emails exist.
      },
      async setDemoRole(role) {
        await wait();
        if (!STAFF_ROLES.includes(role)) throw invalid('Pick a role.', 'role');
        if (!session || !currentStaff()) throw new DataError('not_allowed');
        session = { ...session, role };
        writeSession(store, session);
        return currentStaff() as AdminStaff;
      },
      async resetDemoData() {
        await wait();
        store.reset();
        views = null;
        if (session) {
          // Stay signed in, with the account's own role, if the account still exists.
          session = store.get('admin_staff', session.staff_id)
            ? { staff_id: session.staff_id, role: null }
            : null;
          writeSession(store, session);
        }
      },
    },

    async species() {
      await wait();
      return store.rows('species');
    },

    async search(q) {
      await wait();
      const needle = (q ?? '').trim().toLowerCase();
      if (needle === '') return [];
      const farms: SearchHit[] = [];
      for (const row of computeViews().farmRows.values()) {
        if (contains(row.name, needle)) {
          const place = [row.district, row.state].filter(Boolean).join(', ');
          farms.push({
            kind: 'farm',
            id: row.id,
            title: row.name,
            subtitle: `Farm · ${place}`,
            href: `/farms/${row.id}`,
          });
        }
      }
      const farmers: SearchHit[] = [];
      for (const row of computeViews().farmerRows) {
        if (contains(row.full_name, needle) || contains(row.phone, needle)) {
          farmers.push({
            kind: 'farmer',
            id: row.id,
            title: row.full_name ?? '',
            subtitle: `Farmer · ${maskPhone(row.phone)}`,
            href: `/farmers?view=farmers&q=${encodeURIComponent(row.full_name ?? '')}`,
          });
        }
      }
      const animals: SearchHit[] = [];
      for (const animal of store.tables.animals.values()) {
        if (contains(animal.tag_number, needle) || contains(animal.name, needle)) {
          const species = store.get('species', animal.species_id)?.labels.en ?? '';
          animals.push({
            kind: 'animal',
            id: animal.id,
            title: animal.name
              ? `Tag ${animal.tag_number} · ${animal.name}`
              : `Tag ${animal.tag_number}`,
            subtitle: `${species} · ${farmNameOf(animal.farm_id)}`,
            href: `/animals/${animal.id}`,
          });
        }
      }
      // Up to 3 of each kind first, so one kind can't crowd out the others; then fill to 8.
      const firsts = [...farms.slice(0, 3), ...farmers.slice(0, 3), ...animals.slice(0, 3)];
      const rest = [...farms.slice(3), ...farmers.slice(3), ...animals.slice(3)];
      return [...firsts, ...rest].slice(0, 8);
    },

    async getOverview({ days }) {
      await wait();
      const day = today();
      const { farmRows, farmerRows } = computeViews();
      const yesterday = addDays(day, -1);
      const dayBefore = addDays(day, -2);
      const periodStart = addDays(day, -days); // exclusive
      const previousStart = addDays(day, -2 * days);
      let milkYesterday = 0;
      let milkDayBefore = 0;
      let milkNow = 0;
      let milkThen = 0;
      for (const entry of store.tables.milk_entries.values()) {
        if (entry.entry_date === yesterday) milkYesterday += entry.litres;
        if (entry.entry_date === dayBefore) milkDayBefore += entry.litres;
        if (entry.entry_date > periodStart) milkNow += entry.litres;
        else if (entry.entry_date > previousStart) milkThen += entry.litres;
      }
      let feedNow = 0;
      let feedThen = 0;
      for (const entry of store.tables.feed_entries.values()) {
        if (entry.entry_date > periodStart) feedNow += entry.quantity_kg;
        else if (entry.entry_date > previousStart) feedThen += entry.quantity_kg;
      }
      let vaccinesNow = 0;
      let vaccinesThen = 0;
      let overdue = 0;
      const overdueByFarm = new Map<UUID, number>();
      for (const vaccine of store.tables.vaccinations.values()) {
        if (vaccine.done_date === null) {
          if (vaccine.due_date < day) {
            overdue++;
            overdueByFarm.set(vaccine.farm_id, (overdueByFarm.get(vaccine.farm_id) ?? 0) + 1);
          }
        } else if (vaccine.done_date > periodStart) {
          vaccinesNow++;
        } else if (vaccine.done_date > previousStart) {
          vaccinesThen++;
        }
      }
      const now = Date.now();
      const goldenLimit = toIso(now + 6 * HOUR);
      const nowIso = toIso(now);
      const deliverLimit = addDays(day, 7);
      let goldenEnding = 0;
      let mayDeliver = 0;
      const goldenFarms = new Set<UUID>();
      for (const cycle of store.tables.reproduction_cycles.values()) {
        if (
          cycle.status === 'heat' &&
          cycle.golden_end &&
          cycle.golden_end > nowIso &&
          cycle.golden_end <= goldenLimit
        ) {
          goldenEnding++;
          goldenFarms.add(cycle.farm_id);
        }
        if (
          cycle.status === 'pregnant' &&
          cycle.expected_delivery &&
          cycle.expected_delivery <= deliverLimit
        ) {
          mayDeliver++;
        }
      }
      let sick = 0;
      const sickFarms = new Set<UUID>();
      for (const event of store.tables.health_events.values()) {
        if (event.status === 'sick') {
          sick++;
          sickFarms.add(event.farm_id);
        }
      }
      const quietLimit = toIso(now - 3 * DAY);
      const rows = [...farmRows.values()];
      const isQuiet = (row: FarmListRow) =>
        row.last_entry_at === null || row.last_entry_at < quietLimit;

      const speciesCounts = new Map<string, number>();
      for (const animal of store.tables.animals.values()) {
        if (animal.status === 'active') {
          speciesCounts.set(animal.species_id, (speciesCounts.get(animal.species_id) ?? 0) + 1);
        }
      }
      const languageCounts = new Map<Lang, number>();
      for (const row of farmerRows) {
        languageCounts.set(row.language, (languageCounts.get(row.language) ?? 0) + 1);
      }

      const OVERDUE_THRESHOLD = 3;
      const issueRank: Record<Overview['farms_needing_attention'][number]['issue'], number> = {
        vaccines_overdue: 0,
        sick: 1,
        quiet: 2,
        golden_ending: 3,
      };
      const attention: Overview['farms_needing_attention'] = [];
      for (const farm of rows) {
        const overdueHere = overdueByFarm.get(farm.id) ?? 0;
        if (overdueHere >= OVERDUE_THRESHOLD) attention.push({ farm, issue: 'vaccines_overdue' });
        else if (sickFarms.has(farm.id)) attention.push({ farm, issue: 'sick' });
        else if (isQuiet(farm)) attention.push({ farm, issue: 'quiet' });
        else if (goldenFarms.has(farm.id)) attention.push({ farm, issue: 'golden_ending' });
      }
      attention.sort(
        (a, b) =>
          issueRank[a.issue] - issueRank[b.issue] ||
          (overdueByFarm.get(b.farm.id) ?? 0) - (overdueByFarm.get(a.farm.id) ?? 0),
      );

      const overview: Overview = {
        farmers: farmerRows.length,
        farms: rows.length,
        farms_with_blackbox: rows.filter((r) => r.has_blackbox).length,
        active_animals: [...speciesCounts.values()].reduce((sum, n) => sum + n, 0),
        milk_yesterday: round1(milkYesterday),
        milk_yesterday_trend_pct: trendPct(milkYesterday, milkDayBefore),
        period: {
          days,
          milk_litres: round1(milkNow),
          milk_trend_pct: trendPct(milkNow, milkThen),
          feed_kg: Math.round(feedNow),
          feed_trend_pct: trendPct(feedNow, feedThen),
          vaccines_given: vaccinesNow,
          vaccines_trend_pct: trendPct(vaccinesNow, vaccinesThen),
        },
        needs_attention: {
          golden_ending_6h: goldenEnding,
          vaccines_overdue: overdue,
          animals_sick: sick,
          may_deliver_7d: mayDeliver,
          farms_quiet_3d: rows.filter(isQuiet).length,
        },
        milk_per_day: dailyLitres(days, null),
        farms_needing_attention: attention,
        species_counts: [...speciesCounts]
          .map(([species_id, animals]) => ({
            species_id,
            category: store.get('species', species_id)?.category ?? 'other',
            animals,
          }))
          .sort((a, b) => b.animals - a.animals),
        farmers_by_language: LANGS.map((language) => ({
          language,
          farmers: languageCounts.get(language) ?? 0,
        })).sort((a, b) => b.farmers - a.farmers),
        recent_changes: store
          .rows('admin_audit_log')
          .sort((a, b) => b.id - a.id)
          .slice(0, 5),
      };
      return overview;
    },

    // ---- Farmers & farms ----

    async listFarmers(f) {
      await wait();
      const needle = (f.q ?? '').trim().toLowerCase();
      const computed = computeViews();
      const phoneNeedle = needle.replace(/[\s-]/g, '');
      const farmNames = new Map<UUID, string[]>();
      for (const row of computed.farmRows.values()) {
        farmNames.set(row.owner_id, [...(farmNames.get(row.owner_id) ?? []), row.name]);
      }
      const rows = computed.farmerRows
        .filter(
          (r) =>
            (!needle ||
              contains(r.full_name, needle) ||
              (phoneNeedle !== '' && contains(r.phone, phoneNeedle)) ||
              (farmNames.get(r.id) ?? []).some((name) => contains(name, needle))) &&
            (!f.state || r.state === f.state) &&
            (!f.language || r.language === f.language),
        )
        .sort((a, b) => descending(a.last_entry_at, b.last_entry_at));
      return paginate(rows, f);
    },

    async listFarms(f) {
      await wait();
      const needle = (f.q ?? '').trim().toLowerCase();
      const rows = [...computeViews().farmRows.values()]
        .filter(
          (r) =>
            (!needle || contains(r.name, needle) || contains(r.owner_name, needle)) &&
            (!f.state || r.state === f.state),
        )
        .sort((a, b) => descending(a.last_entry_at, b.last_entry_at));
      return paginate(rows, f);
    },

    async getFarm(id) {
      await wait();
      const farm = requireFarm(id);
      const shedAnimals = new Map<UUID, number>();
      for (const animal of store.tables.animals.values()) {
        if (animal.farm_id === id && animal.status === 'active' && animal.shed_id) {
          shedAnimals.set(animal.shed_id, (shedAnimals.get(animal.shed_id) ?? 0) + 1);
        }
      }
      const detail: FarmDetail = {
        farm,
        row: farmRow(id),
        dashboard: farmDashboard(id),
        sheds: store
          .rows('sheds')
          .filter((s) => s.farm_id === id)
          .map((s) => ({ ...s, animals: shedAnimals.get(s.id) ?? 0 })),
        members: store
          .rows('farm_members')
          .filter((m) => m.farm_id === id)
          .flatMap((m) => {
            const profile = store.get('profiles', m.user_id);
            return profile ? [{ ...m, profile }] : [];
          }),
        milk_7d: dailyLitres(7, id),
        latest: latestEntries(id),
      };
      return detail;
    },

    async updateFarm(id, patch) {
      await wait();
      const staff = requireEditor();
      const farm = requireFarm(id);
      checkFarmPatch(patch);
      const { settings, ...fields } = patch;
      const next: Partial<Farm> = { ...fields };
      if (next.name !== undefined) next.name = next.name.trim();
      if (settings) next.settings = { ...farm.settings, ...settings };
      return updateRow(staff, 'farms', id, next);
    },

    async deleteFarm(id) {
      await wait();
      const staff = requireSuperAdmin();
      const farm = requireFarm(id);
      store.batch(() => {
        store.remove('farms', id, metaFor(staff));
        log(staff, 'delete', 'farms', id, id, { ...farm }, null);
      });
    },

    async transferFarm(id, newOwnerId, note) {
      await wait();
      const staff = requireEditor();
      const farm = requireFarm(id);
      if (!store.get('profiles', newOwnerId)) throw notFound();
      if (farm.owner_id === newOwnerId) return;
      const reason = cleanNote(note);
      store.batch(() => {
        const newKey = `${id}/${newOwnerId}`;
        if (store.get('farm_members', newKey)) {
          updateRow(staff, 'farm_members', newKey, { role: 'owner' }, reason);
        } else {
          const row: FarmMember = { farm_id: id, user_id: newOwnerId, role: 'owner' };
          store.insert('farm_members', row, metaFor(staff));
          log(staff, 'insert', 'farm_members', newKey, id, { ...row }, reason);
        }
        const oldKey = `${id}/${farm.owner_id}`;
        if (store.get('farm_members', oldKey)) {
          updateRow(staff, 'farm_members', oldKey, { role: 'manager' }, reason);
        }
        updateRow(staff, 'farms', id, { owner_id: newOwnerId }, reason);
      });
    },

    async createShed(farmId, v) {
      await wait();
      const staff = requireEditor();
      requireFarm(farmId);
      const code = requireText(v.code, 'code', 'Add a shed code.');
      const name = requireText(v.name, 'name', 'Add a shed name.');
      return insertRow(staff, 'sheds', {
        id: crypto.randomUUID(),
        farm_id: farmId,
        code,
        name,
        created_at: toIso(Date.now()),
      });
    },

    async updateShed(id, v) {
      await wait();
      const staff = requireEditor();
      if (!store.get('sheds', id)) throw notFound();
      const patch: Partial<Rows['sheds']> = {};
      if (v.code !== undefined) patch.code = requireText(v.code, 'code', 'Add a shed code.');
      if (v.name !== undefined) patch.name = requireText(v.name, 'name', 'Add a shed name.');
      return updateRow(staff, 'sheds', id, patch);
    },

    async findProfileByPhone(phone) {
      await wait();
      const normalized = checkPhone(phone ?? '');
      return store.rows('profiles').find((p: Profile) => p.phone === normalized) ?? null;
    },

    async addMember(farmId, userId, role) {
      await wait();
      const staff = requireEditor();
      requireFarm(farmId);
      if (!store.get('profiles', userId)) throw notFound();
      checkRole(role, MEMBER_ROLES, 'role');
      if (store.get('farm_members', `${farmId}/${userId}`)) {
        throw invalid('This person is already a member of this farm.', 'user_id');
      }
      return insertRow(staff, 'farm_members', { farm_id: farmId, user_id: userId, role });
    },

    async setMemberRole(farmId, userId, role) {
      await wait();
      const staff = requireEditor();
      checkRole(role, MEMBER_ROLES, 'role');
      const key = `${farmId}/${userId}`;
      if (!store.get('farm_members', key)) throw notFound();
      if (store.get('farms', farmId)?.owner_id === userId && role !== 'owner') {
        throw invalid('Transfer ownership to change the owner.', 'role');
      }
      return updateRow(staff, 'farm_members', key, { role });
    },

    // ---- Livestock ----

    async listAnimals(f) {
      await wait();
      const needle = (f.q ?? '').trim().toLowerCase();
      const all = animalRows();
      // The totals follow the farm and species group; the other filters only narrow the list.
      const scoped = all.filter(
        (a) =>
          a.status === 'active' &&
          (!f.farm_id || a.farm_id === f.farm_id) &&
          (!f.category || a.category === f.category),
      );
      const rows = all
        .filter(
          (a) =>
            (!needle || contains(a.tag_number, needle) || contains(a.name, needle)) &&
            (!f.farm_id || a.farm_id === f.farm_id) &&
            (!f.category || a.category === f.category) &&
            (!f.connection_state || a.connection_state === f.connection_state) &&
            (!f.breeding_status || a.breeding_status === f.breeding_status) &&
            (!f.status || a.status === f.status),
        )
        .sort((a, b) => descending(a.created_at, b.created_at) || descending(a.id, b.id));
      return {
        ...paginate(rows, f),
        totals: {
          active: scoped.length,
          with_collar: scoped.filter((a) => a.hardware_tag_id !== null).length,
          temperature_high: scoped.filter((a) => a.connection_state === 'temperature_high').length,
          cannot_connect: scoped.filter((a) => a.connection_state === 'cannot_connect').length,
        },
      };
    },

    async getAnimal(id) {
      await wait();
      const animal = animalRows().find((a) => a.id === id);
      if (!animal) throw notFound();
      const day = today();
      const series = analytics(animal.farm_id, id, 30);
      const activity = series.activity.find((row) => row.day === day) ?? null;
      const collarReadsToday =
        animal.last_reading_at !== null && istDate(Date.parse(animal.last_reading_at)) === day;
      return {
        animal,
        vaccinations: store
          .rows('vaccinations')
          .filter((v) => v.animal_id === id)
          .sort((a, b) => descending(a.due_date, b.due_date)),
        health: store
          .rows('health_events')
          .filter((h) => h.animal_id === id)
          .sort((a, b) => descending(a.detected_at, b.detected_at)),
        cycles: store
          .rows('reproduction_cycles')
          .filter((c) => c.animal_id === id)
          .sort((a, b) => b.cycle_no - a.cycle_no),
        series,
        today: { body_temp_c: collarReadsToday ? animal.last_temp_c : null, activity },
      };
    },

    async createAnimal(v) {
      await wait();
      const staff = requireEditor();
      requireFarm(v.farm_id);
      const tag = requireText(v.tag_number, 'tag_number', 'Add a tag number.');
      checkAnimalFields(v.farm_id, v);
      const aadhaar = normalizeAadhaar(v.pashu_aadhaar);
      requireUniqueTag(v.farm_id, tag);
      const at = toIso(Date.now());
      return insertRow(staff, 'animals', {
        id: crypto.randomUUID(),
        farm_id: v.farm_id,
        shed_id: v.shed_id ?? null,
        species_id: v.species_id,
        tag_number: tag,
        name: cleanNote(v.name),
        breed: cleanNote(v.breed),
        gender: v.gender ?? null,
        dob: v.dob ?? null,
        pashu_aadhaar: aadhaar,
        status: 'active',
        photo_urls: [animalPhoto(tag)],
        hardware_tag_id: null,
        created_at: at,
        updated_at: at,
      });
    },

    async updateAnimal(id, patch, note) {
      await wait();
      const staff = requireEditor();
      const animal = store.get('animals', id);
      if (!animal) throw notFound();
      checkAnimalFields(animal.farm_id, patch);
      const next: Partial<Animal> = { ...patch };
      if (patch.tag_number !== undefined) {
        const tag = requireText(patch.tag_number, 'tag_number', 'Add a tag number.');
        requireUniqueTag(animal.farm_id, tag, id);
        next.tag_number = tag;
      }
      if (patch.pashu_aadhaar !== undefined)
        next.pashu_aadhaar = normalizeAadhaar(patch.pashu_aadhaar);
      return updateRow(
        staff,
        'animals',
        id,
        { ...next, updated_at: toIso(Date.now()) },
        cleanNote(note),
      );
    },

    // ---- Health & vaccines ----

    async listVaccinations(f) {
      await wait();
      const rows: VaccinationRow[] = [];
      for (const v of store.tables.vaccinations.values()) {
        if (f.farm_id && v.farm_id !== f.farm_id) continue;
        if (f.animal_id && v.animal_id !== f.animal_id) continue;
        if (f.open === true && v.done_date !== null) continue;
        if (f.open === false && v.done_date === null) continue;
        const animal = store.get('animals', v.animal_id);
        if (!animal) continue;
        if (f.species_id && animal.species_id !== f.species_id) continue;
        rows.push({
          ...v,
          animal: {
            id: animal.id,
            name: animal.name,
            tag_number: animal.tag_number,
            species_id: animal.species_id,
          },
          farm_name: farmNameOf(v.farm_id),
        });
      }
      // Open vaccines lead with the most overdue, as in the prototype's table.
      rows.sort((a, b) =>
        f.open === true ? ascending(a.due_date, b.due_date) : descending(a.due_date, b.due_date),
      );
      return paginate(rows, f);
    },

    async createVaccination(v) {
      await wait();
      const staff = requireEditor();
      requireFarm(v.farm_id);
      requireAnimalOnFarm(v.animal_id, v.farm_id);
      const name = requireText(v.vaccine_name, 'vaccine_name', 'Add the vaccine name.');
      requireDate(v.due_date, 'due_date');
      return insertRow(staff, 'vaccinations', {
        id: crypto.randomUUID(),
        farm_id: v.farm_id,
        animal_id: v.animal_id,
        vaccine_name: name,
        description: cleanNote(v.description),
        due_date: v.due_date,
        done_date: null,
        created_at: toIso(Date.now()),
      });
    },

    async scheduleVaccination(v) {
      await wait();
      const staff = requireEditor();
      requireFarm(v.farm_id);
      const name = requireText(v.vaccine_name, 'vaccine_name', 'Add the vaccine name.');
      requireDate(v.due_date, 'due_date');
      let targets: Animal[];
      if (v.animal_id) {
        targets = [requireAnimalOnFarm(v.animal_id, v.farm_id)];
      } else {
        targets = store
          .rows('animals')
          .filter(
            (a) =>
              a.farm_id === v.farm_id &&
              a.status === 'active' &&
              (!v.species_id || a.species_id === v.species_id),
          );
      }
      store.batch(() => {
        for (const animal of targets) {
          insertRow(staff, 'vaccinations', {
            id: crypto.randomUUID(),
            farm_id: v.farm_id,
            animal_id: animal.id,
            vaccine_name: name,
            description: cleanNote(v.description),
            due_date: v.due_date,
            done_date: null,
            created_at: toIso(Date.now()),
          } satisfies Vaccination);
        }
      });
      return { created: targets.length };
    },

    async setVaccinationDone(id, done_date) {
      await wait();
      const staff = requireEditor();
      if (done_date !== null) requireDate(done_date, 'done_date');
      return updateRow(staff, 'vaccinations', id, { done_date });
    },

    async listHealthEvents(f) {
      await wait();
      const rows: HealthRow[] = [];
      for (const h of store.tables.health_events.values()) {
        if (f.farm_id && h.farm_id !== f.farm_id) continue;
        if (f.animal_id && h.animal_id !== f.animal_id) continue;
        if (f.open === true && h.status === 'resolved') continue;
        if (f.open === false && h.status !== 'resolved') continue;
        const animal = store.get('animals', h.animal_id);
        if (!animal) continue;
        if (f.species_id && animal.species_id !== f.species_id) continue;
        rows.push({
          ...h,
          animal: {
            id: animal.id,
            name: animal.name,
            tag_number: animal.tag_number,
            species_id: animal.species_id,
          },
          farm_name: farmNameOf(h.farm_id),
        });
      }
      rows.sort((a, b) => descending(a.detected_at, b.detected_at));
      return paginate(rows, f);
    },

    async createHealthEvent(v) {
      await wait();
      const staff = requireEditor();
      requireFarm(v.farm_id);
      requireAnimalOnFarm(v.animal_id, v.farm_id);
      const title = requireText(v.title, 'title', 'Add what the issue is.');
      if (!HEALTH_STATUSES.includes(v.status)) throw invalid('Pick a status.', 'status');
      const at = toIso(Date.now());
      const row: HealthEvent = {
        id: crypto.randomUUID(),
        farm_id: v.farm_id,
        animal_id: v.animal_id,
        status: v.status,
        title,
        notes: cleanNote(v.notes),
        detected_at: at,
        resolved_at: v.status === 'resolved' ? at : null,
        source: 'manual',
      };
      return insertRow(staff, 'health_events', row);
    },

    async setHealthStatus(id, status) {
      await wait();
      const staff = requireEditor();
      if (!HEALTH_STATUSES.includes(status)) throw invalid('Pick a status.', 'status');
      return updateRow(staff, 'health_events', id, {
        status,
        resolved_at: status === 'resolved' ? toIso(Date.now()) : null,
      });
    },

    // ---- Reproduction ----

    async listCycles(f) {
      await wait();
      const rows: CycleRow[] = [];
      for (const c of store.tables.reproduction_cycles.values()) {
        if (c.status !== f.status || (f.farm_id && c.farm_id !== f.farm_id)) continue;
        const animal = store.get('animals', c.animal_id);
        if (!animal) continue;
        rows.push({
          ...c,
          animal: { id: animal.id, name: animal.name, tag_number: animal.tag_number },
          farm_name: farmNameOf(c.farm_id),
        });
      }
      if (f.status === 'heat') rows.sort((a, b) => ascending(a.golden_end, b.golden_end));
      else if (f.status === 'pregnant') {
        rows.sort((a, b) => ascending(a.expected_delivery, b.expected_delivery));
      } else rows.sort((a, b) => descending(a.inseminated_at, b.inseminated_at));
      return paginate(rows, f);
    },

    async createCycle(v) {
      await wait();
      const staff = requireEditor();
      requireFarm(v.farm_id);
      requireAnimalOnFarm(v.animal_id, v.farm_id);
      if (v.status !== 'heat' && v.status !== 'inseminated')
        throw invalid('Pick a stage.', 'status');
      const at = Date.parse(v.at);
      if (Number.isNaN(at)) throw invalid('Enter a valid date and time.', 'at');
      let cycleNo = 1;
      for (const c of store.tables.reproduction_cycles.values()) {
        if (c.animal_id === v.animal_id) cycleNo = Math.max(cycleNo, c.cycle_no + 1);
      }
      const tube = cleanNote(v.tube_number);
      const isHeat = v.status === 'heat';
      const row: ReproductionCycle = {
        id: crypto.randomUUID(),
        farm_id: v.farm_id,
        animal_id: v.animal_id,
        cycle_no: cycleNo,
        status: v.status,
        heat_started_at: isHeat ? toIso(at) : null,
        // The golden period is worked out as 2 to 12 hours after the heat started.
        golden_start: isHeat ? toIso(at + 2 * HOUR) : null,
        golden_end: isHeat ? toIso(at + 12 * HOUR) : null,
        heat_confirmed: null,
        inseminated_at: isHeat ? null : toIso(at),
        tube_number: isHeat ? null : tube,
        insemination_verified: false,
        insemination_image_url: !isHeat && tube ? slipImage(tube) : null,
        pregnancy_confirmed_at: null,
        expected_delivery: null,
        delivered_at: null,
        source: 'manual',
        created_at: toIso(Date.now()),
      };
      return insertRow(staff, 'reproduction_cycles', row);
    },

    async setInseminationVerified(id, verified) {
      await wait();
      const staff = requireEditor();
      return updateRow(staff, 'reproduction_cycles', id, { insemination_verified: verified });
    },

    // ---- Milk & feed ----

    async listMilk(f) {
      await wait();
      const fixed = fixedRecords('milk_entries');
      const rows: MilkRow[] = [];
      for (const m of store.tables.milk_entries.values()) {
        if (f.farm_id && m.farm_id !== f.farm_id) continue;
        if (!inRange(m.entry_date, f.from, f.to)) continue;
        const animal = m.animal_id ? store.get('animals', m.animal_id) : undefined;
        rows.push({
          ...m,
          farm_name: farmNameOf(m.farm_id),
          animal: animal
            ? { id: animal.id, name: animal.name, tag_number: animal.tag_number }
            : null,
          entered_by: personName(m.created_by),
          fixed_by_staff: fixed.has(m.id),
        });
      }
      rows.sort((a, b) => descending(a.created_at, b.created_at) || descending(a.id, b.id));
      return paginate(rows, f);
    },

    async listFeed(f) {
      await wait();
      const fixed = fixedRecords('feed_entries');
      const rows: FeedRow[] = [];
      for (const e of store.tables.feed_entries.values()) {
        if (f.farm_id && e.farm_id !== f.farm_id) continue;
        if (!inRange(e.entry_date, f.from, f.to)) continue;
        const animal = e.animal_id ? store.get('animals', e.animal_id) : undefined;
        const shed = e.shed_id ? store.get('sheds', e.shed_id) : undefined;
        let fedTo = 'Whole farm';
        if (animal)
          fedTo = animal.name ? `${animal.tag_number} · ${animal.name}` : animal.tag_number;
        else if (shed) fedTo = shed.code ?? shed.name;
        rows.push({
          ...e,
          farm_name: farmNameOf(e.farm_id),
          fed_to: fedTo,
          entered_by: personName(e.created_by),
          fixed_by_staff: fixed.has(e.id),
        });
      }
      rows.sort((a, b) => descending(a.created_at, b.created_at) || descending(a.id, b.id));
      return paginate(rows, f);
    },

    async milkDaily(f) {
      await wait();
      const groups = new Map<
        string,
        { day: ISODate; session: MilkSession; litres: number; value: number; animals: Set<UUID> }
      >();
      for (const m of store.tables.milk_entries.values()) {
        if (f.farm_id && m.farm_id !== f.farm_id) continue;
        if (!inRange(m.entry_date, f.from, f.to)) continue;
        const key = `${m.entry_date}/${m.session}`;
        const group = groups.get(key) ?? {
          day: m.entry_date,
          session: m.session,
          litres: 0,
          value: 0,
          animals: new Set<UUID>(),
        };
        group.litres += m.litres;
        group.value += m.litres * (m.price_per_litre ?? 0);
        if (m.animal_id) group.animals.add(m.animal_id);
        groups.set(key, group);
      }
      return [...groups.values()]
        .map((g) => ({
          day: g.day,
          session: g.session,
          litres: round1(g.litres),
          value: Math.round(g.value),
          milking_animals: g.animals.size,
        }))
        .sort(
          (a, b) =>
            ascending(a.day, b.day) ||
            MILK_SESSIONS.indexOf(a.session) - MILK_SESSIONS.indexOf(b.session),
        );
    },

    async feedDaily(f) {
      await wait();
      const groups = new Map<
        string,
        { day: ISODate; feed_type: string; kg: number; cost: number }
      >();
      for (const e of store.tables.feed_entries.values()) {
        if (f.farm_id && e.farm_id !== f.farm_id) continue;
        if (!inRange(e.entry_date, f.from, f.to)) continue;
        const key = `${e.entry_date}/${e.feed_type}`;
        const group = groups.get(key) ?? {
          day: e.entry_date,
          feed_type: e.feed_type,
          kg: 0,
          cost: 0,
        };
        group.kg += e.quantity_kg;
        group.cost += e.cost ?? 0;
        groups.set(key, group);
      }
      return [...groups.values()].sort(
        (a, b) => ascending(a.day, b.day) || ascending(a.feed_type, b.feed_type),
      );
    },

    async createMilk(v) {
      await wait();
      const staff = requireEditor();
      requireFarm(v.farm_id);
      requireDate(v.entry_date, 'entry_date');
      checkMilk({
        session: v.session,
        litres: v.litres,
        price_per_litre: v.price_per_litre ?? null,
      });
      if (v.animal_id) requireAnimalOnFarm(v.animal_id, v.farm_id);
      return insertRow(staff, 'milk_entries', {
        id: crypto.randomUUID(),
        farm_id: v.farm_id,
        animal_id: v.animal_id ?? null,
        entry_date: v.entry_date,
        session: v.session,
        litres: v.litres,
        price_per_litre: v.price_per_litre ?? null,
        created_by: staff.user_id,
        created_at: toIso(Date.now()),
      });
    },

    async fixMilk(id, v, reason) {
      await wait();
      const staff = requireEditor();
      const note = checkReason(reason);
      if (!store.get('milk_entries', id)) throw notFound();
      checkMilk(v);
      return updateRow(
        staff,
        'milk_entries',
        id,
        { session: v.session, litres: v.litres, price_per_litre: v.price_per_litre },
        note,
      );
    },

    async createFeed(v) {
      await wait();
      const staff = requireEditor();
      requireFarm(v.farm_id);
      requireDate(v.entry_date, 'entry_date');
      checkFeed({ feed_type: v.feed_type, quantity_kg: v.quantity_kg, cost: v.cost ?? null });
      if (v.shed_id) requireShedOnFarm(v.shed_id, v.farm_id);
      if (v.animal_id) requireAnimalOnFarm(v.animal_id, v.farm_id);
      return insertRow(staff, 'feed_entries', {
        id: crypto.randomUUID(),
        farm_id: v.farm_id,
        shed_id: v.shed_id ?? null,
        animal_id: v.animal_id ?? null,
        entry_date: v.entry_date,
        feed_type: v.feed_type.trim(),
        quantity_kg: v.quantity_kg,
        cost: v.cost ?? null,
        created_by: staff.user_id,
        created_at: toIso(Date.now()),
      });
    },

    async fixFeed(id, v, reason) {
      await wait();
      const staff = requireEditor();
      const note = checkReason(reason);
      if (!store.get('feed_entries', id)) throw notFound();
      checkFeed(v);
      return updateRow(
        staff,
        'feed_entries',
        id,
        { feed_type: v.feed_type.trim(), quantity_kg: v.quantity_kg, cost: v.cost },
        note,
      );
    },

    async deleteEntry(table, id, note) {
      await wait();
      const staff = requireEditor();
      if (table !== 'milk_entries' && table !== 'feed_entries') throw new DataError('not_allowed');
      const row = store.get(table, id);
      if (!row) throw notFound();
      store.batch(() => {
        store.remove(table, id, metaFor(staff));
        log(staff, 'delete', table, id, row.farm_id, { ...row }, cleanNote(note));
      });
    },

    // ---- Analytics ----

    async analyticsSeries(farmId, animalId, days) {
      await wait();
      return analytics(farmId, animalId, days);
    },

    async environmentDay(farmId, shedId, day) {
      await wait();
      requireFarm(farmId);
      return store
        .rows('environment_readings')
        .filter(
          (r) =>
            r.farm_id === farmId &&
            (shedId === null || r.shed_id === shedId) &&
            istDate(Date.parse(r.ts)) === day,
        )
        .sort((a, b) => ascending(a.ts, b.ts) || a.id - b.id);
    },

    // ---- Staff & activity log ----

    async listStaff() {
      await wait();
      return store.rows('admin_staff');
    },

    async inviteStaff(v) {
      await wait();
      const staff = requireSuperAdmin();
      const fullName = requireText(v.full_name, 'full_name', 'Add their name.');
      const email = requireText(v.email, 'email', 'Add their email.').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('Enter a valid email.', 'email');
      checkRole(v.role, STAFF_ROLES, 'role');
      if (store.rows('admin_staff').some((s) => s.email === email)) {
        throw invalid('This email already has an account.', 'email');
      }
      return insertRow(staff, 'admin_staff', {
        user_id: crypto.randomUUID(),
        full_name: fullName,
        email,
        role: v.role,
        status: 'invited',
        invited_by: staff.user_id,
        created_at: toIso(Date.now()),
        last_active_at: null,
      });
    },

    async updateStaff(userId, patch) {
      await wait();
      const staff = requireSuperAdmin();
      if (!store.get('admin_staff', userId)) throw notFound();
      if (patch.role !== undefined) checkRole(patch.role, STAFF_ROLES, 'role');
      if (patch.status !== undefined && !STAFF_STATUSES.includes(patch.status)) {
        throw invalid('Pick a status.', 'status');
      }
      if (patch.status === 'removed' && userId === staff.user_id) {
        throw invalid('You can’t remove yourself. Ask another super admin.', 'status');
      }
      return updateRow(staff, 'admin_staff', userId, patch);
    },

    async listAudit(f) {
      await wait();
      const limit = f.limit ?? 50;
      return store
        .rows('admin_audit_log')
        .filter(
          (e) =>
            (!f.staff_id || e.staff_id === f.staff_id) &&
            (!f.action || e.action === f.action) &&
            (!f.table_name || e.table_name === f.table_name) &&
            (!f.since || e.at >= f.since) &&
            (f.beforeId === undefined || e.id < f.beforeId),
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
    },
  };
}
