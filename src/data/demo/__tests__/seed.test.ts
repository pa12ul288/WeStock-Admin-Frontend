import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, DAY, HOUR, istDate } from '../time';
import { FEATURED } from '../featured';
import { generateSeed } from '../seed';
import { NOW, newAdapter, sharedSeed, TODAY } from './helpers';

const between = (value: number, min: number, max: number) => {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
};

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the seed is deterministic', () => {
  it('gives the same first farm, first animal and totals', () => {
    const a = generateSeed(NOW);
    const b = generateSeed(NOW);
    expect(b.farms[0]).toEqual(a.farms[0]);
    expect(b.animals[0]).toEqual(a.animals[0]);
    for (const table of Object.keys(a) as (keyof typeof a)[]) {
      expect(b[table].length, table).toBe(a[table].length);
    }
    const total = (seed: typeof a) => seed.milk_entries.reduce((sum, m) => sum + m.litres, 0);
    expect(total(b)).toBe(total(a));
    expect(b).toEqual(a);
  });

  it('a different seed gives different data', () => {
    expect(generateSeed(NOW, 1).animals[10]).not.toEqual(generateSeed(NOW).animals[10]);
  });

  it('keeps record ids from one day to the next, so a saved log still applies', () => {
    const ids = (seed: ReturnType<typeof generateSeed>) => ({
      farms: seed.farms.map((f) => f.id),
      animals: seed.animals.map((a) => a.id),
      milk: seed.milk_entries.filter((m) => m.entry_date < addDays(TODAY, -1)).length,
    });
    const day1 = generateSeed(NOW);
    const day2 = generateSeed(NOW + DAY + 3 * HOUR);
    expect(ids(day2).farms).toEqual(ids(day1).farms);
    expect(ids(day2).animals).toEqual(ids(day1).animals);
    const day1Milk = new Set(day1.milk_entries.map((m) => m.id));
    const shared = day2.milk_entries.filter((m) => day1Milk.has(m.id)).length;
    expect(shared).toBeGreaterThan(day2.milk_entries.length * 0.9);
  });
});

describe('the seed has what docs/demo-data.md asks for', () => {
  const seed = sharedSeed();

  it('has the right sizes', () => {
    expect(seed.farms.length).toBe(66);
    expect(new Set(seed.farms.map((f) => f.owner_id)).size).toBe(60);
    between(seed.animals.length, 850, 950);
    expect(seed.vaccinations.length).toBe(1500);
    expect(seed.health_events.filter((h) => h.status !== 'resolved').length).toBe(120);
    expect(seed.health_events.filter((h) => h.status === 'resolved').length).toBe(300);
    expect(seed.admin_audit_log.length).toBe(40);
    expect(seed.devices.filter((d) => d.kind === 'blackbox').length).toBe(9);
  });

  it('has sheds and members in range on every generated farm', () => {
    for (const farm of seed.farms) {
      between(seed.sheds.filter((s) => s.farm_id === farm.id).length, 1, 4);
      const members = seed.farm_members.filter((m) => m.farm_id === farm.id).length;
      between(members, 1, farm.id === FEATURED.farms.shreeGanesh ? 5 : 4);
    }
  });

  it('roughly matches the species and language mix', () => {
    const share = (species: string) =>
      seed.animals.filter((a) => a.species_id === species).length / seed.animals.length;
    between(share('cattle'), 0.45, 0.65);
    between(share('buffalo'), 0.13, 0.27);
    between(share('goat'), 0.08, 0.22);
    const owners = new Set(seed.farms.map((f) => f.owner_id));
    const hindi = seed.profiles.filter((p) => owners.has(p.id) && p.language === 'hi').length;
    expect(hindi).toBe(18);
  });

  it('has unique phones, and tags unique per farm', () => {
    const phones = seed.profiles.map((p) => p.phone);
    expect(new Set(phones).size).toBe(phones.length);
    const tags = seed.animals.map((a) => `${a.farm_id}/${a.tag_number}`);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('has the featured farms and animals with their exact names', () => {
    const farm = seed.farms.find((f) => f.id === FEATURED.farms.shreeGanesh);
    expect(farm).toMatchObject({
      name: 'Shree Ganesh Dairy',
      district: 'Kolhapur',
      state: 'Maharashtra',
    });
    const names = Object.values(FEATURED.farms).map(
      (id) => seed.farms.find((f) => f.id === id)?.name,
    );
    expect(names).toEqual([
      'Shree Ganesh Dairy',
      'Gir Gau Shala',
      'Periyar Cattle Farm',
      'Kaveri Farms',
      'Yadav Dairy',
      'Singh Dairy',
      'Lakshmi Farm',
    ]);
    const gauri = seed.animals.find((a) => a.id === FEATURED.animals.gauri);
    expect(gauri).toMatchObject({ tag_number: '01', name: 'Gauri', status: 'active' });
    expect(seed.animals.find((a) => a.id === FEATURED.animals.bhuri)?.status).toBe('sold');
    expect(seed.animals.find((a) => a.id === FEATURED.animals.moti)?.status).toBe('deceased');
    expect(seed.animals.find((a) => a.id === FEATURED.animals.neeli)?.tag_number).toBe('06');
  });

  it('gives the featured farms their stated herds', () => {
    const active = (farmId: string) =>
      seed.animals.filter((a) => a.farm_id === farmId && a.status === 'active');
    const shree = active(FEATURED.farms.shreeGanesh);
    expect(shree.length).toBe(64);
    expect(shree.filter((a) => a.species_id === 'cattle').length).toBe(41);
    expect(shree.filter((a) => a.species_id === 'buffalo').length).toBe(17);
    expect(shree.filter((a) => a.species_id === 'goat').length).toBe(6);
    expect(active(FEATURED.farms.girGauShala).length).toBe(29);
    expect(active(FEATURED.farms.periyar).length).toBe(6);
    expect(active(FEATURED.farms.kaveri).length).toBe(52);
    expect(active(FEATURED.farms.yadav).length).toBe(45);
    expect(active(FEATURED.farms.lakshmi).length).toBe(9);
  });

  it('has the five staff accounts', () => {
    expect(seed.admin_staff.map((s) => [s.email, s.role, s.status])).toEqual([
      ['anjali@brainwired.demo', 'super_admin', 'active'],
      ['priya@brainwired.demo', 'support', 'active'],
      ['rahul@brainwired.demo', 'support', 'active'],
      ['fatima@brainwired.demo', 'viewer', 'active'],
      ['vikram@brainwired.demo', 'support', 'invited'],
    ]);
  });

  it('puts collars only on cattle at Blackbox farms', () => {
    const blackbox = new Set(
      seed.devices.filter((d) => d.kind === 'blackbox').map((d) => d.farm_id),
    );
    const collared = seed.animals.filter((a) => a.hardware_tag_id !== null);
    expect(collared.length).toBeGreaterThan(50);
    expect(collared.every((a) => a.species_id === 'cattle' && blackbox.has(a.farm_id))).toBe(true);
  });

  it('keeps every date relative to today in India', () => {
    expect(istDate(NOW)).toBe(TODAY);
    const later = generateSeed(NOW + 40 * DAY);
    const laterToday = istDate(NOW + 40 * DAY);
    expect(later.milk_entries.some((m) => m.entry_date === laterToday)).toBe(true);
    expect(later.milk_entries.some((m) => m.entry_date === addDays(laterToday, -1))).toBe(true);
    expect(later.vaccinations.some((v) => !v.done_date && v.due_date < laterToday)).toBe(true);
  });

  it('never has a milk entry dated after today', () => {
    expect(seed.milk_entries.every((m) => m.entry_date <= TODAY)).toBe(true);
    expect(seed.milk_entries.every((m) => Date.parse(m.created_at) <= NOW)).toBe(true);
  });
});

describe('the computed views agree with the docs', () => {
  it('overview shows the needs-attention numbers the data calls for', async () => {
    const ds = newAdapter();
    const overview = await ds.getOverview({ days: 30 });
    expect(overview.farmers).toBe(60);
    expect(overview.farms).toBe(66);
    expect(overview.farms_with_blackbox).toBe(9);
    expect(overview.milk_yesterday).toBeGreaterThan(0);
    expect(overview.needs_attention.golden_ending_6h).toBe(5);
    expect(overview.needs_attention.may_deliver_7d).toBe(6);
    between(overview.needs_attention.vaccines_overdue, 100, 200);
    expect(overview.needs_attention.animals_sick).toBeGreaterThan(0);
    expect(overview.needs_attention.farms_quiet_3d).toBeGreaterThanOrEqual(1);
    expect(overview.milk_per_day.length).toBe(30);
    expect(overview.recent_changes.length).toBe(5);
    expect(overview.farms_needing_attention.length).toBeGreaterThan(0);
    expect(overview.period.vaccines_given).toBeGreaterThan(0);
    expect(overview.farmers_by_language.reduce((sum, row) => sum + row.farmers, 0)).toBe(60);
    expect(overview.species_counts.reduce((sum, row) => sum + row.animals, 0)).toBe(
      overview.active_animals,
    );
  });

  it('cycles match the stated stages and sort as the screens need', async () => {
    const ds = newAdapter();
    const heat = await ds.listCycles({ status: 'heat', pageSize: 100 });
    const inseminated = await ds.listCycles({ status: 'inseminated', pageSize: 100 });
    const pregnant = await ds.listCycles({ status: 'pregnant', pageSize: 200 });
    expect(heat.total).toBe(25);
    expect(inseminated.total).toBe(80);
    expect(inseminated.rows.filter((c) => !c.insemination_verified).length).toBe(30);
    expect(pregnant.total).toBe(140);
    const goldens = heat.rows.map((c) => c.golden_end ?? '');
    expect([...goldens].sort()).toEqual(goldens);
    const dues = pregnant.rows.map((c) => c.expected_delivery ?? '');
    expect([...dues].sort()).toEqual(dues);
  });

  it('featured animals are in the stated states', async () => {
    const ds = newAdapter();
    const kamla = await ds.getAnimal(FEATURED.animals.kamla);
    expect(kamla.animal.breeding_status).toBe('pregnant');
    expect(kamla.cycles[0]?.expected_delivery).toBe(addDays(TODAY, 6));
    expect((await ds.getAnimal(FEATURED.animals.shanti)).animal.breeding_status).toBe('heat');
    const neeli = await ds.getAnimal(FEATURED.animals.neeli);
    expect(neeli.animal.open_health).toBe(1);
    expect(neeli.health[0]?.status).toBe('sick');
    const lakshmi = await ds.getAnimal(FEATURED.animals.lakshmi);
    expect(lakshmi.animal.connection_state).toBe('temperature_high');
    expect(lakshmi.animal.last_temp_c).toBe(40.1);
    expect(lakshmi.series.cattle_temperature.length).toBeGreaterThan(100);
    expect(lakshmi.today.activity).not.toBeNull();
    const gauri = await ds.getAnimal(FEATURED.animals.gauri);
    expect(gauri.animal.connection_state).toBe('normal');
    expect(gauri.animal.open_health).toBe(0);
    expect(gauri.cycles.map((c) => c.status)).toEqual(['pregnant', 'delivered']);
  });

  it('Kaveri Farms is offline since this morning, and collars go stale by the farm setting', async () => {
    const ds = newAdapter();
    const kaveri = await ds.listAnimals({ farm_id: FEATURED.farms.kaveri, pageSize: 100 });
    const collared = kaveri.rows.filter((a) => a.hardware_tag_id !== null);
    expect(collared.length).toBe(35);
    expect(collared.every((a) => a.connection_state === 'cannot_connect')).toBe(true);
    expect(kaveri.totals.cannot_connect).toBe(35);
    expect(kaveri.totals.active).toBe(52);
    const all = await ds.listAnimals({ pageSize: 1 });
    expect(all.totals.temperature_high).toBe(3);
  });

  it('Singh Dairy is quiet, and farm rows count the right things', async () => {
    const ds = newAdapter();
    const singh = await ds.getFarm(FEATURED.farms.singh);
    expect(singh.row.last_entry_at).not.toBeNull();
    expect(Date.parse(singh.row.last_entry_at ?? '')).toBeLessThan(NOW - 3 * DAY);
    const shree = await ds.getFarm(FEATURED.farms.shreeGanesh);
    expect(shree.row).toMatchObject({ animals: 64, sheds: 3, members: 5, has_blackbox: true });
    expect(shree.latest.length).toBe(5);
    expect(shree.milk_7d.length).toBe(7);
    expect(shree.row.milk_7d).toBeGreaterThan(0);
    expect((await ds.getFarm(FEATURED.farms.periyar)).row.has_blackbox).toBe(false);
  });

  it('lists page, search caps at 8, and the Yadav entry is 75.0 L', async () => {
    const ds = newAdapter();
    const page1 = await ds.listAnimals({ pageSize: 20 });
    const page2 = await ds.listAnimals({ pageSize: 20, page: 2 });
    expect(page1.rows.length).toBe(20);
    expect(page1.rows[0]?.name).toBe('Gauri');
    expect(page2.rows[0]?.id).not.toBe(page1.rows[0]?.id);
    expect((await ds.search('a')).length).toBe(8);
    expect(await ds.search('  ')).toEqual([]);
    const hits = await ds.search('gauri');
    expect(hits[0]).toMatchObject({ kind: 'animal', href: `/animals/${FEATURED.animals.gauri}` });
    const milk = await ds.listMilk({
      farm_id: FEATURED.farms.yadav,
      from: addDays(TODAY, -1),
      to: addDays(TODAY, -1),
    });
    expect(milk.rows.find((m) => m.id === FEATURED.milk.yadavWrongEntry)).toMatchObject({
      litres: 75,
      entered_by: 'Rajendra Yadav',
      animal: { name: 'Shyama', tag_number: '04' },
    });
  });

  it('analytics and environment return data for a Blackbox farm', async () => {
    const ds = newAdapter();
    const id = FEATURED.farms.shreeGanesh;
    const series = await ds.analyticsSeries(id, null, 7);
    expect(series.milk.length).toBeGreaterThan(6);
    expect(series.feed.length).toBeGreaterThan(6);
    expect(series.activity.length).toBeGreaterThan(6);
    expect(series.cattle_temperature.length).toBeGreaterThan(100);
    expect(series.farm_temperature.length).toBeGreaterThan(100);
    const readings = await ds.environmentDay(id, null, addDays(TODAY, -1));
    expect(readings.length).toBe(24 * 3);
    for (const r of readings) {
      between(r.temp_c, 22, 34);
      between(r.humidity ?? 0, 40, 85);
    }
    const daily = await ds.milkDaily({ from: addDays(TODAY, -2), to: addDays(TODAY, -1) });
    expect(daily.every((d) => d.litres > 0)).toBe(true);
    const feed = await ds.feedDaily({ from: addDays(TODAY, -1), to: addDays(TODAY, -1) });
    expect(feed.map((f) => f.feed_type)).toContain('Green fodder');
  });
});

describe('data source selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to demo', async () => {
    vi.stubEnv('VITE_DATA_SOURCE', '');
    vi.resetModules();
    vi.useRealTimers();
    const { dataSource } = await import('../../index');
    expect(typeof dataSource.listFarms).toBe('function');
  });

  it("'supabase' throws not built yet", async () => {
    vi.stubEnv('VITE_DATA_SOURCE', 'supabase');
    vi.resetModules();
    await expect(import('../../index')).rejects.toThrow('not built yet');
  });
});
