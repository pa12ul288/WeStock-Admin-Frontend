# Data contract

The frontend talks to data only through the `DataSource` interface below. In this phase it is implemented
by the **demo adapter** (`src/data/demo/`). Later a **Supabase adapter** (`src/data/supabase/`) implements the
same interface, and nothing else in the app changes.

Field names are **snake_case on purpose**: they match the Supabase tables in
`docs/backend-later/app-schema/0001_schema.sql` and the admin views in `docs/backend-later/0005_admin.sql`.
Don't rename or camelCase them.

## 1. Types (`src/data/types.ts`)

```ts
export type UUID = string;
export type ISODate = string;      // 'YYYY-MM-DD' (a calendar date, no time zone)
export type ISODateTime = string;  // UTC ISO 8601, e.g. '2026-11-05T06:30:00Z'

export type Lang = 'hi' | 'mr' | 'ml' | 'gu' | 'ta' | 'en';
export type MemberRole = 'owner' | 'manager' | 'worker';
export type AnimalGender = 'female' | 'male';
export type AnimalStatus = 'active' | 'sold' | 'deceased';
export type MilkSession = 'morning' | 'afternoon' | 'evening';
export type CycleStatus = 'heat' | 'inseminated' | 'pregnant' | 'delivered' | 'failed' | 'closed';
export type HealthStatus = 'detected' | 'sick' | 'condition' | 'resolved';
export type SpeciesCategory = 'large_ruminant' | 'small_ruminant' | 'poultry' | 'swine' | 'equine' | 'other';
export type ConnectionState = 'no_hardware' | 'cannot_connect' | 'temperature_high' | 'normal';
export type StaffRole = 'super_admin' | 'support' | 'viewer';
export type StaffStatus = 'invited' | 'active' | 'removed';

// ---- app tables (0001_schema.sql) ----
export interface Profile {
  id: UUID; full_name: string | null; phone: string | null; language: Lang;
  avatar_url: string | null; created_at: ISODateTime;
}
export interface FarmSettings { high_temp_c: number; offline_after_min: number; [key: string]: unknown }
export interface Farm {
  id: UUID; owner_id: UUID; name: string; description: string | null;
  lat: number | null; lng: number | null; settings: FarmSettings; created_at: ISODateTime;
  district: string | null; state: string | null; poultry_count: number | null; // added by 0005
}
export interface FarmMember { farm_id: UUID; user_id: UUID; role: MemberRole }
export interface Shed { id: UUID; farm_id: UUID; name: string; code: string | null; created_at: ISODateTime }
export interface Species {
  id: string; category: SpeciesCategory; hardware_supported: boolean; labels: Record<Lang, string>;
}
export interface Animal {
  id: UUID; farm_id: UUID; shed_id: UUID | null; species_id: string; tag_number: string;
  name: string | null; breed: string | null; gender: AnimalGender | null; dob: ISODate | null;
  pashu_aadhaar: string | null; status: AnimalStatus; photo_urls: string[];
  hardware_tag_id: UUID | null; created_at: ISODateTime; updated_at: ISODateTime;
}
export interface MilkEntry {
  id: UUID; farm_id: UUID; animal_id: UUID | null; entry_date: ISODate; session: MilkSession;
  litres: number; price_per_litre: number | null; created_by: UUID | null; created_at: ISODateTime;
}
export interface FeedEntry {
  id: UUID; farm_id: UUID; shed_id: UUID | null; animal_id: UUID | null; entry_date: ISODate;
  feed_type: string; quantity_kg: number; cost: number | null; created_by: UUID | null; created_at: ISODateTime;
}
export interface Vaccination {
  id: UUID; farm_id: UUID; animal_id: UUID; vaccine_name: string; description: string | null;
  due_date: ISODate; done_date: ISODate | null; created_at: ISODateTime;
}
export interface HealthEvent {
  id: UUID; farm_id: UUID; animal_id: UUID; status: HealthStatus; title: string; notes: string | null;
  detected_at: ISODateTime; resolved_at: ISODateTime | null; source: 'manual' | 'sensor' | 'gau';
}
export interface ReproductionCycle {
  id: UUID; farm_id: UUID; animal_id: UUID; cycle_no: number; status: CycleStatus;
  heat_started_at: ISODateTime | null; golden_start: ISODateTime | null; golden_end: ISODateTime | null;
  heat_confirmed: boolean | null; inseminated_at: ISODateTime | null; tube_number: string | null;
  insemination_verified: boolean; insemination_image_url: string | null;
  pregnancy_confirmed_at: ISODateTime | null; expected_delivery: ISODate | null;
  delivered_at: ISODateTime | null; source: 'manual' | 'sensor'; created_at: ISODateTime;
}
export interface EnvironmentReading {
  id: number; farm_id: UUID; shed_id: UUID | null; ts: ISODateTime;
  temp_c: number; humidity: number | null; thi: number | null; source: 'sensor' | 'weather_api' | 'manual';
}

// ---- admin tables (0005_admin.sql) ----
export interface AdminStaff {
  user_id: UUID; full_name: string; email: string; role: StaffRole; status: StaffStatus;
  invited_by: UUID | null; created_at: ISODateTime; last_active_at: ISODateTime | null;
}
export interface AuditLogEntry {
  id: number; at: ISODateTime; staff_id: UUID | null; staff_name: string | null;
  action: 'insert' | 'update' | 'delete'; table_name: string; record_id: string; farm_id: UUID | null;
  changes: Record<string, unknown>;   // update: { litres: { from: 6, to: 5.5 } }; insert/delete: the row
  note: string | null;
}

// ---- admin views (0005_admin.sql) ----
export interface FarmListRow {
  id: UUID; name: string; district: string | null; state: string | null; lat: number | null; lng: number | null;
  poultry_count: number | null; created_at: ISODateTime; owner_id: UUID; owner_name: string | null;
  owner_phone: string | null; language: Lang | null; sheds: number; animals: number; members: number;
  has_blackbox: boolean; milk_7d: number; last_entry_at: ISODateTime | null;
}
export interface FarmerListRow {
  id: UUID; full_name: string | null; phone: string | null; language: Lang; joined_at: ISODateTime;
  farms: number; animals: number; district: string | null; state: string | null; last_entry_at: ISODateTime | null;
}
export interface AnimalListRow extends Animal {
  category: SpeciesCategory; last_seen_at: ISODateTime | null; last_reading_at: ISODateTime | null;
  last_temp_c: number | null; last_ambient_temp_c: number | null; last_battery_pct: number | null;
  connection_state: ConnectionState; farm_name: string; shed_code: string | null; shed_name: string | null;
  breeding_status: 'heat' | 'inseminated' | 'pregnant' | null; open_health: number;
}
export interface MilkDaily { day: ISODate; session: MilkSession; litres: number; value: number; milking_animals: number }
export interface FeedDaily { day: ISODate; feed_type: string; kg: number; cost: number }
export interface SpeciesCount { species_id: string; category: SpeciesCategory; animals: number }

// ---- app functions ----
export interface FarmDashboard {           // rpc farm_dashboard(p_farm)
  reproduction: { heat: number; inseminated: number; pregnant: number; may_deliver: number };
  health: { detected: number; sick: number; conditions: number };
  vaccination: { overdue: number; due: number; upcoming: number };
  milk_today: { total: number; morning: number; afternoon: number; evening: number };
  animals_by_species: Record<string, number>;
}
export interface AnalyticsSeries {        // rpc analytics_series(p_farm, p_animal, p_days)
  milk: { day: ISODate; litres: number; revenue: number }[];
  feed: { day: ISODate; kg: number; cost: number }[];
  activity: { day: ISODate; stand_min: number; sit_min: number; walk_min: number;
              eat_min: number; ruminate_min: number; drink_min: number }[];
  cattle_temperature: { hour: ISODateTime; avg_c: number; max_c: number }[];   // last min(days, 7) days
  farm_temperature: { hour: ISODateTime; temp_c: number; humidity: number; thi: number }[];
}
```

## 2. Screen-shaped results (`src/data/types.ts`, continued)

These are built by the adapter. The demo adapter builds them in memory; the Supabase adapter will build them
from the views and functions above.

```ts
export interface Page<T> { rows: T[]; total: number }
export interface Paging { page?: number; pageSize?: number }   // page is 1-based; default pageSize 20

export interface Overview {
  farmers: number; farms: number; farms_with_blackbox: number; active_animals: number;
  milk_yesterday: number; milk_yesterday_trend_pct: number;
  period: { days: 7 | 30 | 90; milk_litres: number; milk_trend_pct: number; feed_kg: number;
            feed_trend_pct: number; vaccines_given: number; vaccines_trend_pct: number };
  needs_attention: { golden_ending_6h: number; vaccines_overdue: number; animals_sick: number;
                     may_deliver_7d: number; farms_quiet_3d: number };
  milk_per_day: { day: ISODate; litres: number }[];
  farms_needing_attention: { farm: FarmListRow; issue: 'vaccines_overdue' | 'sick' | 'quiet' | 'golden_ending' }[];
  species_counts: SpeciesCount[];
  farmers_by_language: { language: Lang; farmers: number }[];
  recent_changes: AuditLogEntry[];          // latest 5
}
export interface FarmDetail {
  farm: Farm; row: FarmListRow; dashboard: FarmDashboard;
  sheds: (Shed & { animals: number })[];
  members: (FarmMember & { profile: Profile })[];
  milk_7d: { day: ISODate; litres: number }[];
  latest: { kind: 'milk' | 'feed' | 'health'; at: ISODateTime; text: string }[];   // newest 5
}
export interface AnimalDetail {
  animal: AnimalListRow; vaccinations: Vaccination[]; health: HealthEvent[]; cycles: ReproductionCycle[];
  series: AnalyticsSeries; today: { body_temp_c: number | null; activity: AnalyticsSeries['activity'][number] | null };
}
export type VaccinationRow = Vaccination & { animal: Pick<Animal, 'id' | 'name' | 'tag_number' | 'species_id'>; farm_name: string };
export type HealthRow = HealthEvent & { animal: Pick<Animal, 'id' | 'name' | 'tag_number' | 'species_id'>; farm_name: string };
export type CycleRow = ReproductionCycle & { animal: Pick<Animal, 'id' | 'name' | 'tag_number'>; farm_name: string };
export type MilkRow = MilkEntry & { farm_name: string; animal: Pick<Animal, 'id' | 'name' | 'tag_number'> | null;
                                    entered_by: string | null; fixed_by_staff: boolean };
export type FeedRow = FeedEntry & { farm_name: string; fed_to: string; entered_by: string | null; fixed_by_staff: boolean };
export interface SearchHit { kind: 'farm' | 'farmer' | 'animal'; id: UUID; title: string; subtitle: string; href: string }
```

## 3. The interface (`src/data/source.ts`)

```ts
export interface DataSource {
  auth: {
    signIn(email: string, password: string): Promise<AdminStaff>;   // demo: any 6+ char password
    signOut(): Promise<void>;
    currentStaff(): Promise<AdminStaff | null>;
    requestPasswordReset(email: string): Promise<void>;
    setDemoRole?(role: StaffRole): Promise<AdminStaff>;              // demo adapter only
    resetDemoData?(): Promise<void>;                                  // demo adapter only
  };

  species(): Promise<Species[]>;
  search(q: string): Promise<SearchHit[]>;                            // max 8 hits
  getOverview(args: { days: 7 | 30 | 90 }): Promise<Overview>;

  // Farmers & farms
  listFarmers(f: { q?: string; state?: string; language?: Lang } & Paging): Promise<Page<FarmerListRow>>;
  listFarms(f: { q?: string; state?: string } & Paging): Promise<Page<FarmListRow>>;
  getFarm(id: UUID): Promise<FarmDetail>;
  updateFarm(id: UUID, patch: Partial<Pick<Farm, 'name' | 'description' | 'district' | 'state' | 'lat' | 'lng' | 'poultry_count'>>
                              & { settings?: Partial<FarmSettings> }): Promise<Farm>;   // settings are MERGED
  deleteFarm(id: UUID): Promise<void>;                                // super_admin only
  transferFarm(id: UUID, newOwnerId: UUID, note?: string): Promise<void>;
  createShed(farmId: UUID, v: { code: string; name: string }): Promise<Shed>;
  updateShed(id: UUID, v: { code?: string; name?: string }): Promise<Shed>;
  findProfileByPhone(phone: string): Promise<Profile | null>;
  addMember(farmId: UUID, userId: UUID, role: MemberRole): Promise<FarmMember>;
  setMemberRole(farmId: UUID, userId: UUID, role: MemberRole): Promise<FarmMember>;

  // Livestock
  listAnimals(f: { q?: string; farm_id?: UUID; category?: SpeciesCategory; connection_state?: ConnectionState;
                   breeding_status?: 'heat' | 'inseminated' | 'pregnant'; status?: AnimalStatus } & Paging)
    : Promise<Page<AnimalListRow> & { totals: { active: number; with_collar: number; temperature_high: number; cannot_connect: number } }>;
  getAnimal(id: UUID): Promise<AnimalDetail>;
  createAnimal(v: Pick<Animal, 'farm_id' | 'tag_number' | 'species_id'> & Partial<Pick<Animal, 'name' | 'breed' | 'gender' | 'dob' | 'pashu_aadhaar' | 'shed_id'>>): Promise<Animal>;
  updateAnimal(id: UUID, patch: Partial<Pick<Animal, 'tag_number' | 'name' | 'species_id' | 'breed' | 'gender' | 'dob' | 'pashu_aadhaar' | 'shed_id' | 'status'>>, note?: string): Promise<Animal>;

  // Health & vaccines
  listVaccinations(f: { farm_id?: UUID; species_id?: string; animal_id?: UUID; open?: boolean } & Paging): Promise<Page<VaccinationRow>>;
  createVaccination(v: Pick<Vaccination, 'farm_id' | 'animal_id' | 'vaccine_name' | 'due_date'> & { description?: string }): Promise<Vaccination>;
  scheduleVaccination(v: { farm_id: UUID; species_id: string | null; animal_id: UUID | null; vaccine_name: string;
                           due_date: ISODate; description?: string }): Promise<{ created: number }>;
  setVaccinationDone(id: UUID, done_date: ISODate | null): Promise<Vaccination>;          // null = undo
  listHealthEvents(f: { farm_id?: UUID; species_id?: string; animal_id?: UUID; open?: boolean } & Paging): Promise<Page<HealthRow>>;
  createHealthEvent(v: Pick<HealthEvent, 'farm_id' | 'animal_id' | 'title' | 'status'> & { notes?: string }): Promise<HealthEvent>;
  setHealthStatus(id: UUID, status: HealthStatus): Promise<HealthEvent>;                  // 'resolved' sets resolved_at

  // Reproduction
  listCycles(f: { status: 'heat' | 'inseminated' | 'pregnant'; farm_id?: UUID } & Paging): Promise<Page<CycleRow>>;
  createCycle(v: { farm_id: UUID; animal_id: UUID; status: 'heat' | 'inseminated'; at: ISODateTime; tube_number?: string }): Promise<ReproductionCycle>;
  setInseminationVerified(id: UUID, verified: boolean): Promise<ReproductionCycle>;

  // Milk & feed
  listMilk(f: { farm_id?: UUID; from?: ISODate; to?: ISODate } & Paging): Promise<Page<MilkRow>>;
  listFeed(f: { farm_id?: UUID; from?: ISODate; to?: ISODate } & Paging): Promise<Page<FeedRow>>;
  milkDaily(f: { from: ISODate; to: ISODate; farm_id?: UUID }): Promise<MilkDaily[]>;
  feedDaily(f: { from: ISODate; to: ISODate; farm_id?: UUID }): Promise<FeedDaily[]>;
  createMilk(v: Pick<MilkEntry, 'farm_id' | 'entry_date' | 'session' | 'litres'> & Partial<Pick<MilkEntry, 'animal_id' | 'price_per_litre'>>): Promise<MilkEntry>;
  fixMilk(id: UUID, v: Pick<MilkEntry, 'session' | 'litres' | 'price_per_litre'>, reason: string): Promise<MilkEntry>;   // reason required
  createFeed(v: Pick<FeedEntry, 'farm_id' | 'entry_date' | 'feed_type' | 'quantity_kg'> & Partial<Pick<FeedEntry, 'shed_id' | 'animal_id' | 'cost'>>): Promise<FeedEntry>;
  fixFeed(id: UUID, v: Pick<FeedEntry, 'feed_type' | 'quantity_kg' | 'cost'>, reason: string): Promise<FeedEntry>;
  deleteEntry(table: 'milk_entries' | 'feed_entries', id: UUID, note?: string): Promise<void>;

  // Analytics
  analyticsSeries(farmId: UUID, animalId: UUID | null, days: 7 | 30 | 90): Promise<AnalyticsSeries>;
  environmentDay(farmId: UUID, shedId: UUID | null, day: ISODate): Promise<EnvironmentReading[]>;

  // Staff & activity log
  listStaff(): Promise<AdminStaff[]>;
  inviteStaff(v: { full_name: string; email: string; role: StaffRole }): Promise<AdminStaff>;   // super_admin only
  updateStaff(userId: UUID, patch: { role?: StaffRole; status?: StaffStatus }): Promise<AdminStaff>;
  listAudit(f: { staff_id?: UUID; action?: AuditLogEntry['action']; table_name?: string;
                 since?: ISODateTime; beforeId?: number; limit?: number }): Promise<AuditLogEntry[]>;    // newest first, default 50
}
```

## 4. Errors (`src/data/errors.ts`, `src/lib/errors.ts`)

```ts
export type DataErrorCode = 'not_allowed' | 'reason_required' | 'not_found' | 'duplicate_tag' | 'validation' | 'network';
export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly field: string | undefined;
  constructor(code: DataErrorCode, message?: string, field?: string) {
    super(message ?? code);
    this.name = 'DataError';
    this.code = code;
    this.field = field;
  }
}
```

| Code | Message shown to the user |
| --- | --- |
| `not_allowed` | Your role can't make this change. |
| `reason_required` | Add a reason for the fix. (keep the dialog open) |
| `not_found` | This record no longer exists. The list has been refreshed. |
| `duplicate_tag` | Tag {tag} is already used on this farm. |
| `validation` | The field's own message, shown under that field |
| `network` | Couldn't save. Check your connection and try again. (keep what they typed) |

## 5. Rules both adapters must follow

| Rule | Detail |
| --- | --- |
| Roles | `viewer`: every write throws `not_allowed`. `support`: `deleteFarm`, `inviteStaff`, `updateStaff` throw `not_allowed`. `super_admin`: everything |
| Activity log | Every successful write appends **one** `AuditLogEntry` per changed record: `update` holds only the changed fields as `{field: {from, to}}`; `insert`/`delete` hold the row. `fixMilk`, `fixFeed`, `deleteEntry`, `transferFarm` and `updateAnimal(…, note)` store their reason or note in `note`. A farm delete logs **one** row, not one per child record |
| Fixed by staff | `fixed_by_staff` is true when the log has an `update` for that milk or feed record |
| Validation | Pashu Aadhaar exactly 12 digits; phone 10 digits after `+91`; litres ≥ 0; quantity ≥ 0; tag unique per farm (`duplicate_tag`); fixes need a non-empty reason |
| Sorting | Lists newest first unless the screen says otherwise (heat by `golden_end`, pregnant by `expected_delivery`) |
| Dates | `ISODate` fields are calendar dates; "today" means today in Asia/Kolkata |
| Cascade | Deleting a farm removes its sheds, members, animals and all their records |

## 6. Later: how each method maps to Supabase

Kept here so the second adapter is a straight translation. Full SQL is in `docs/backend-later/0005_admin.sql`.

| Method | Supabase call |
| --- | --- |
| `listFarmers` / `listFarms` | `from('admin_farmer_list')` / `from('admin_farm_list')` with `ilike`, `eq`, `range`, `count: 'exact'` |
| `getFarm` | `farms`, `admin_farm_list`, `sheds`, `farm_members` + `profiles`, `rpc('farm_dashboard')`, `rpc('analytics_series', {p_days: 7})` |
| `listAnimals` / `getAnimal` | `from('admin_animal_list')`; animal records from `vaccinations`, `health_events`, `reproduction_cycles` |
| `milkDaily` / `feedDaily` | `from('admin_milk_daily')` / `from('admin_feed_daily')`, or `rpc('analytics_series')` for one farm |
| `fixMilk` / `fixFeed` / `deleteEntry` | `rpc('admin_fix_milk')` / `rpc('admin_fix_feed')` / `rpc('admin_delete_entry')` |
| `transferFarm` | `rpc('admin_transfer_farm')` |
| `listAudit` | `from('admin_audit_log')`, `lt('id', beforeId)`, `limit(50)` |
| `inviteStaff` | the `admin-invite` edge function |
| everything else | plain `select` / `insert` / `update` / `delete` on the table of the same name; the audit log is written by the database trigger, so the Supabase adapter never writes it itself |
