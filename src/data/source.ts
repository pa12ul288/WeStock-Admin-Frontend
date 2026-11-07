import type {
  AdminStaff,
  AnalyticsSeries,
  Animal,
  AnimalDetail,
  AnimalListRow,
  AnimalStatus,
  AuditLogEntry,
  ConnectionState,
  CycleRow,
  EnvironmentReading,
  Farm,
  FarmDetail,
  FarmListRow,
  FarmMember,
  FarmSettings,
  FarmerListRow,
  FeedDaily,
  FeedEntry,
  FeedRow,
  HealthEvent,
  HealthRow,
  HealthStatus,
  ISODate,
  ISODateTime,
  Lang,
  MemberRole,
  MilkDaily,
  MilkEntry,
  MilkRow,
  Overview,
  Page,
  Paging,
  Profile,
  ReproductionCycle,
  SearchHit,
  Shed,
  Species,
  SpeciesCategory,
  StaffRole,
  StaffStatus,
  UUID,
  Vaccination,
  VaccinationRow,
} from './types';

export interface DataSource {
  auth: {
    signIn(email: string, password: string): Promise<AdminStaff>; // demo: any 6+ char password
    signOut(): Promise<void>;
    currentStaff(): Promise<AdminStaff | null>;
    requestPasswordReset(email: string): Promise<void>;
    setDemoRole?(role: StaffRole): Promise<AdminStaff>; // demo adapter only
    resetDemoData?(): Promise<void>; // demo adapter only
  };

  species(): Promise<Species[]>;
  search(q: string): Promise<SearchHit[]>; // max 8 hits
  getOverview(args: { days: 7 | 30 | 90 }): Promise<Overview>;

  // Farmers & farms
  listFarmers(
    f: { q?: string; state?: string; language?: Lang } & Paging,
  ): Promise<Page<FarmerListRow>>;
  listFarms(f: { q?: string; state?: string } & Paging): Promise<Page<FarmListRow>>;
  getFarm(id: UUID): Promise<FarmDetail>;
  updateFarm(
    id: UUID,
    patch: Partial<
      Pick<Farm, 'name' | 'description' | 'district' | 'state' | 'lat' | 'lng' | 'poultry_count'>
    > & { settings?: Partial<FarmSettings> },
  ): Promise<Farm>; // settings are MERGED
  deleteFarm(id: UUID): Promise<void>; // super_admin only
  transferFarm(id: UUID, newOwnerId: UUID, note?: string): Promise<void>;
  createShed(farmId: UUID, v: { code: string; name: string }): Promise<Shed>;
  updateShed(id: UUID, v: { code?: string; name?: string }): Promise<Shed>;
  findProfileByPhone(phone: string): Promise<Profile | null>;
  addMember(farmId: UUID, userId: UUID, role: MemberRole): Promise<FarmMember>;
  setMemberRole(farmId: UUID, userId: UUID, role: MemberRole): Promise<FarmMember>;

  // Livestock
  listAnimals(
    f: {
      q?: string;
      farm_id?: UUID;
      category?: SpeciesCategory;
      connection_state?: ConnectionState;
      breeding_status?: 'heat' | 'inseminated' | 'pregnant';
      status?: AnimalStatus;
    } & Paging,
  ): Promise<
    Page<AnimalListRow> & {
      totals: {
        active: number;
        with_collar: number;
        temperature_high: number;
        cannot_connect: number;
      };
    }
  >;
  getAnimal(id: UUID): Promise<AnimalDetail>;
  createAnimal(
    v: Pick<Animal, 'farm_id' | 'tag_number' | 'species_id'> &
      Partial<Pick<Animal, 'name' | 'breed' | 'gender' | 'dob' | 'pashu_aadhaar' | 'shed_id'>>,
  ): Promise<Animal>;
  updateAnimal(
    id: UUID,
    patch: Partial<
      Pick<
        Animal,
        | 'tag_number'
        | 'name'
        | 'species_id'
        | 'breed'
        | 'gender'
        | 'dob'
        | 'pashu_aadhaar'
        | 'shed_id'
        | 'status'
      >
    >,
    note?: string,
  ): Promise<Animal>;

  // Health & vaccines
  listVaccinations(
    f: { farm_id?: UUID; species_id?: string; animal_id?: UUID; open?: boolean } & Paging,
  ): Promise<Page<VaccinationRow>>;
  createVaccination(
    v: Pick<Vaccination, 'farm_id' | 'animal_id' | 'vaccine_name' | 'due_date'> & {
      description?: string;
    },
  ): Promise<Vaccination>;
  scheduleVaccination(v: {
    farm_id: UUID;
    species_id: string | null;
    animal_id: UUID | null;
    vaccine_name: string;
    due_date: ISODate;
    description?: string;
  }): Promise<{ created: number }>;
  setVaccinationDone(id: UUID, done_date: ISODate | null): Promise<Vaccination>; // null = undo
  listHealthEvents(
    f: { farm_id?: UUID; species_id?: string; animal_id?: UUID; open?: boolean } & Paging,
  ): Promise<Page<HealthRow>>;
  createHealthEvent(
    v: Pick<HealthEvent, 'farm_id' | 'animal_id' | 'title' | 'status'> & { notes?: string },
  ): Promise<HealthEvent>;
  setHealthStatus(id: UUID, status: HealthStatus): Promise<HealthEvent>; // 'resolved' sets resolved_at

  // Reproduction
  listCycles(
    f: { status: 'heat' | 'inseminated' | 'pregnant'; farm_id?: UUID } & Paging,
  ): Promise<Page<CycleRow>>;
  createCycle(v: {
    farm_id: UUID;
    animal_id: UUID;
    status: 'heat' | 'inseminated';
    at: ISODateTime;
    tube_number?: string;
  }): Promise<ReproductionCycle>;
  setInseminationVerified(id: UUID, verified: boolean): Promise<ReproductionCycle>;

  // Milk & feed
  listMilk(f: { farm_id?: UUID; from?: ISODate; to?: ISODate } & Paging): Promise<Page<MilkRow>>;
  listFeed(f: { farm_id?: UUID; from?: ISODate; to?: ISODate } & Paging): Promise<Page<FeedRow>>;
  milkDaily(f: { from: ISODate; to: ISODate; farm_id?: UUID }): Promise<MilkDaily[]>;
  feedDaily(f: { from: ISODate; to: ISODate; farm_id?: UUID }): Promise<FeedDaily[]>;
  createMilk(
    v: Pick<MilkEntry, 'farm_id' | 'entry_date' | 'session' | 'litres'> &
      Partial<Pick<MilkEntry, 'animal_id' | 'price_per_litre'>>,
  ): Promise<MilkEntry>;
  fixMilk(
    id: UUID,
    v: Pick<MilkEntry, 'session' | 'litres' | 'price_per_litre'>,
    reason: string,
  ): Promise<MilkEntry>; // reason required
  createFeed(
    v: Pick<FeedEntry, 'farm_id' | 'entry_date' | 'feed_type' | 'quantity_kg'> &
      Partial<Pick<FeedEntry, 'shed_id' | 'animal_id' | 'cost'>>,
  ): Promise<FeedEntry>;
  fixFeed(
    id: UUID,
    v: Pick<FeedEntry, 'feed_type' | 'quantity_kg' | 'cost'>,
    reason: string,
  ): Promise<FeedEntry>;
  deleteEntry(table: 'milk_entries' | 'feed_entries', id: UUID, note?: string): Promise<void>;

  // Analytics
  analyticsSeries(farmId: UUID, animalId: UUID | null, days: 7 | 30 | 90): Promise<AnalyticsSeries>;
  environmentDay(farmId: UUID, shedId: UUID | null, day: ISODate): Promise<EnvironmentReading[]>;

  // Staff & activity log
  listStaff(): Promise<AdminStaff[]>;
  inviteStaff(v: { full_name: string; email: string; role: StaffRole }): Promise<AdminStaff>; // super_admin only
  updateStaff(userId: UUID, patch: { role?: StaffRole; status?: StaffStatus }): Promise<AdminStaff>;
  listAudit(f: {
    staff_id?: UUID;
    action?: AuditLogEntry['action'];
    table_name?: string;
    since?: ISODateTime;
    beforeId?: number;
    limit?: number;
  }): Promise<AuditLogEntry[]>; // newest first, default 50
}
