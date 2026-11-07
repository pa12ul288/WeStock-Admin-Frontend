export type UUID = string;
export type ISODate = string; // 'YYYY-MM-DD' (a calendar date, no time zone)
export type ISODateTime = string; // UTC ISO 8601, e.g. '2026-11-05T06:30:00Z'

export type Lang = 'hi' | 'mr' | 'ml' | 'gu' | 'ta' | 'en';
export type MemberRole = 'owner' | 'manager' | 'worker';
export type AnimalGender = 'female' | 'male';
export type AnimalStatus = 'active' | 'sold' | 'deceased';
export type MilkSession = 'morning' | 'afternoon' | 'evening';
export type CycleStatus = 'heat' | 'inseminated' | 'pregnant' | 'delivered' | 'failed' | 'closed';
export type HealthStatus = 'detected' | 'sick' | 'condition' | 'resolved';
export type SpeciesCategory =
  'large_ruminant' | 'small_ruminant' | 'poultry' | 'swine' | 'equine' | 'other';
export type ConnectionState = 'no_hardware' | 'cannot_connect' | 'temperature_high' | 'normal';
export type StaffRole = 'super_admin' | 'support' | 'viewer';
export type StaffStatus = 'invited' | 'active' | 'removed';

// ---- app tables (0001_schema.sql) ----
export interface Profile {
  id: UUID;
  full_name: string | null;
  phone: string | null;
  language: Lang;
  avatar_url: string | null;
  created_at: ISODateTime;
}
export interface FarmSettings {
  high_temp_c: number;
  offline_after_min: number;
  [key: string]: unknown;
}
export interface Farm {
  id: UUID;
  owner_id: UUID;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  settings: FarmSettings;
  created_at: ISODateTime;
  district: string | null;
  state: string | null;
  poultry_count: number | null; // added by 0005
}
export interface FarmMember {
  farm_id: UUID;
  user_id: UUID;
  role: MemberRole;
}
export interface Shed {
  id: UUID;
  farm_id: UUID;
  name: string;
  code: string | null;
  created_at: ISODateTime;
}
export interface Species {
  id: string;
  category: SpeciesCategory;
  hardware_supported: boolean;
  labels: Record<Lang, string>;
}
export interface Animal {
  id: UUID;
  farm_id: UUID;
  shed_id: UUID | null;
  species_id: string;
  tag_number: string;
  name: string | null;
  breed: string | null;
  gender: AnimalGender | null;
  dob: ISODate | null;
  pashu_aadhaar: string | null;
  status: AnimalStatus;
  photo_urls: string[];
  hardware_tag_id: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}
export interface MilkEntry {
  id: UUID;
  farm_id: UUID;
  animal_id: UUID | null;
  entry_date: ISODate;
  session: MilkSession;
  litres: number;
  price_per_litre: number | null;
  created_by: UUID | null;
  created_at: ISODateTime;
}
export interface FeedEntry {
  id: UUID;
  farm_id: UUID;
  shed_id: UUID | null;
  animal_id: UUID | null;
  entry_date: ISODate;
  feed_type: string;
  quantity_kg: number;
  cost: number | null;
  created_by: UUID | null;
  created_at: ISODateTime;
}
export interface Vaccination {
  id: UUID;
  farm_id: UUID;
  animal_id: UUID;
  vaccine_name: string;
  description: string | null;
  due_date: ISODate;
  done_date: ISODate | null;
  created_at: ISODateTime;
}
export interface HealthEvent {
  id: UUID;
  farm_id: UUID;
  animal_id: UUID;
  status: HealthStatus;
  title: string;
  notes: string | null;
  detected_at: ISODateTime;
  resolved_at: ISODateTime | null;
  source: 'manual' | 'sensor' | 'gau';
}
export interface ReproductionCycle {
  id: UUID;
  farm_id: UUID;
  animal_id: UUID;
  cycle_no: number;
  status: CycleStatus;
  heat_started_at: ISODateTime | null;
  golden_start: ISODateTime | null;
  golden_end: ISODateTime | null;
  heat_confirmed: boolean | null;
  inseminated_at: ISODateTime | null;
  tube_number: string | null;
  insemination_verified: boolean;
  insemination_image_url: string | null;
  pregnancy_confirmed_at: ISODateTime | null;
  expected_delivery: ISODate | null;
  delivered_at: ISODateTime | null;
  source: 'manual' | 'sensor';
  created_at: ISODateTime;
}
export interface EnvironmentReading {
  id: number;
  farm_id: UUID;
  shed_id: UUID | null;
  ts: ISODateTime;
  temp_c: number;
  humidity: number | null;
  thi: number | null;
  source: 'sensor' | 'weather_api' | 'manual';
}

// ---- admin tables (0005_admin.sql) ----
export interface AdminStaff {
  user_id: UUID;
  full_name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  invited_by: UUID | null;
  created_at: ISODateTime;
  last_active_at: ISODateTime | null;
}
export interface AuditLogEntry {
  id: number;
  at: ISODateTime;
  staff_id: UUID | null;
  staff_name: string | null;
  action: 'insert' | 'update' | 'delete';
  table_name: string;
  record_id: string;
  farm_id: UUID | null;
  changes: Record<string, unknown>; // update: { litres: { from: 6, to: 5.5 } }; insert/delete: the row
  note: string | null;
}

// ---- admin views (0005_admin.sql) ----
export interface FarmListRow {
  id: UUID;
  name: string;
  district: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  poultry_count: number | null;
  created_at: ISODateTime;
  owner_id: UUID;
  owner_name: string | null;
  owner_phone: string | null;
  language: Lang | null;
  sheds: number;
  animals: number;
  members: number;
  has_blackbox: boolean;
  milk_7d: number;
  last_entry_at: ISODateTime | null;
}
export interface FarmerListRow {
  id: UUID;
  full_name: string | null;
  phone: string | null;
  language: Lang;
  joined_at: ISODateTime;
  farms: number;
  animals: number;
  district: string | null;
  state: string | null;
  last_entry_at: ISODateTime | null;
}
export interface AnimalListRow extends Animal {
  category: SpeciesCategory;
  last_seen_at: ISODateTime | null;
  last_reading_at: ISODateTime | null;
  last_temp_c: number | null;
  last_ambient_temp_c: number | null;
  last_battery_pct: number | null;
  connection_state: ConnectionState;
  farm_name: string;
  shed_code: string | null;
  shed_name: string | null;
  breeding_status: 'heat' | 'inseminated' | 'pregnant' | null;
  open_health: number;
}
export interface MilkDaily {
  day: ISODate;
  session: MilkSession;
  litres: number;
  value: number;
  milking_animals: number;
}
export interface FeedDaily {
  day: ISODate;
  feed_type: string;
  kg: number;
  cost: number;
}
export interface SpeciesCount {
  species_id: string;
  category: SpeciesCategory;
  animals: number;
}

// ---- app functions ----
export interface FarmDashboard {
  // rpc farm_dashboard(p_farm)
  reproduction: { heat: number; inseminated: number; pregnant: number; may_deliver: number };
  health: { detected: number; sick: number; conditions: number };
  vaccination: { overdue: number; due: number; upcoming: number };
  milk_today: { total: number; morning: number; afternoon: number; evening: number };
  animals_by_species: Record<string, number>;
}
export interface AnalyticsSeries {
  // rpc analytics_series(p_farm, p_animal, p_days)
  milk: { day: ISODate; litres: number; revenue: number }[];
  feed: { day: ISODate; kg: number; cost: number }[];
  activity: {
    day: ISODate;
    stand_min: number;
    sit_min: number;
    walk_min: number;
    eat_min: number;
    ruminate_min: number;
    drink_min: number;
  }[];
  cattle_temperature: { hour: ISODateTime; avg_c: number; max_c: number }[]; // last min(days, 7) days
  farm_temperature: { hour: ISODateTime; temp_c: number; humidity: number; thi: number }[];
}

// ---- screen-shaped results ----
export interface Page<T> {
  rows: T[];
  total: number;
}
export interface Paging {
  page?: number;
  pageSize?: number;
} // page is 1-based; default pageSize 20

export interface Overview {
  farmers: number;
  farms: number;
  farms_with_blackbox: number;
  active_animals: number;
  milk_yesterday: number;
  milk_yesterday_trend_pct: number;
  period: {
    days: 7 | 30 | 90;
    milk_litres: number;
    milk_trend_pct: number;
    feed_kg: number;
    feed_trend_pct: number;
    vaccines_given: number;
    vaccines_trend_pct: number;
  };
  needs_attention: {
    golden_ending_6h: number;
    vaccines_overdue: number;
    animals_sick: number;
    may_deliver_7d: number;
    farms_quiet_3d: number;
  };
  milk_per_day: { day: ISODate; litres: number }[];
  farms_needing_attention: {
    farm: FarmListRow;
    issue: 'vaccines_overdue' | 'sick' | 'quiet' | 'golden_ending';
  }[];
  species_counts: SpeciesCount[];
  farmers_by_language: { language: Lang; farmers: number }[];
  recent_changes: AuditLogEntry[]; // latest 5
}
export interface FarmDetail {
  farm: Farm;
  row: FarmListRow;
  dashboard: FarmDashboard;
  sheds: (Shed & { animals: number })[];
  members: (FarmMember & { profile: Profile })[];
  milk_7d: { day: ISODate; litres: number }[];
  latest: { kind: 'milk' | 'feed' | 'health'; at: ISODateTime; text: string }[]; // newest 5
}
export interface AnimalDetail {
  animal: AnimalListRow;
  vaccinations: Vaccination[];
  health: HealthEvent[];
  cycles: ReproductionCycle[];
  series: AnalyticsSeries;
  today: { body_temp_c: number | null; activity: AnalyticsSeries['activity'][number] | null };
}
export type VaccinationRow = Vaccination & {
  animal: Pick<Animal, 'id' | 'name' | 'tag_number' | 'species_id'>;
  farm_name: string;
};
export type HealthRow = HealthEvent & {
  animal: Pick<Animal, 'id' | 'name' | 'tag_number' | 'species_id'>;
  farm_name: string;
};
export type CycleRow = ReproductionCycle & {
  animal: Pick<Animal, 'id' | 'name' | 'tag_number'>;
  farm_name: string;
};
export type MilkRow = MilkEntry & {
  farm_name: string;
  animal: Pick<Animal, 'id' | 'name' | 'tag_number'> | null;
  entered_by: string | null;
  fixed_by_staff: boolean;
};
export type FeedRow = FeedEntry & {
  farm_name: string;
  fed_to: string;
  entered_by: string | null;
  fixed_by_staff: boolean;
};
export interface SearchHit {
  kind: 'farm' | 'farmer' | 'animal';
  id: UUID;
  title: string;
  subtitle: string;
  href: string;
}
