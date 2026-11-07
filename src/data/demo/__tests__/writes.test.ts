import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorMessage } from '../../../lib/errors';
import { DataError } from '../../errors';
import { createDemoAdapter } from '../adapter';
import { FEATURED } from '../featured';
import { STORAGE_KEY } from '../store';
import { NOW, newStore, sharedSeed, signedIn, TODAY } from './helpers';

const wrongEntry = FEATURED.milk.yadavWrongEntry;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('fixMilk', () => {
  const fixed = { session: 'evening', litres: 7.5, price_per_litre: 40 } as const;

  it('throws reason_required without a reason', async () => {
    const ds = await signedIn('support');
    await expect(ds.fixMilk(wrongEntry, fixed, '')).rejects.toMatchObject({
      code: 'reason_required',
    });
    await expect(ds.fixMilk(wrongEntry, fixed, '   ')).rejects.toMatchObject({
      code: 'reason_required',
    });
  });

  it('logs only the changed field, with the note, and marks the row as fixed', async () => {
    const ds = await signedIn('support');
    const before = (await ds.listAudit({})).length;
    const row = await ds.fixMilk(wrongEntry, fixed, 'Farmer confirmed on a call');
    expect(row.litres).toBe(7.5);

    const log = await ds.listAudit({ limit: 100 });
    expect(log.length).toBe(Math.min(100, before + 1));
    expect(log[0]).toMatchObject({
      action: 'update',
      table_name: 'milk_entries',
      record_id: wrongEntry,
      farm_id: FEATURED.farms.yadav,
      staff_id: FEATURED.staff.priya,
      staff_name: 'Priya Sharma',
      note: 'Farmer confirmed on a call',
    });
    expect(log[0]?.changes).toEqual({ litres: { from: 75, to: 7.5 } });

    const { rows } = await ds.listMilk({
      farm_id: FEATURED.farms.yadav,
      from: '2026-11-04',
      to: '2026-11-04',
    });
    expect(rows.find((r) => r.id === wrongEntry)?.fixed_by_staff).toBe(true);
    expect(rows.filter((r) => r.id !== wrongEntry).every((r) => !r.fixed_by_staff)).toBe(true);
  });

  it('logs nothing when nothing changed', async () => {
    const ds = await signedIn('support');
    const before = await ds.listAudit({});
    await ds.fixMilk(wrongEntry, { ...fixed, litres: 75 }, 'No change');
    expect(await ds.listAudit({})).toEqual(before);
  });

  it('rejects negative litres and unknown records', async () => {
    const ds = await signedIn('support');
    await expect(ds.fixMilk(wrongEntry, { ...fixed, litres: -1 }, 'x')).rejects.toMatchObject({
      code: 'validation',
      field: 'litres',
    });
    await expect(ds.fixMilk('missing', fixed, 'x')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('animals', () => {
  it('a duplicate tag on the same farm throws duplicate_tag, with the tag in the message', async () => {
    const ds = await signedIn('support');
    const attempt = ds.createAnimal({
      farm_id: FEATURED.farms.shreeGanesh,
      tag_number: '01',
      species_id: 'cattle',
    });
    await expect(attempt).rejects.toMatchObject({ code: 'duplicate_tag', field: 'tag_number' });
    const error = await attempt.catch((e: unknown) => e);
    expect(errorMessage(error)).toBe('Tag 01 is already used on this farm.');
  });

  it('the same tag on another farm is fine, and so is keeping your own tag', async () => {
    const ds = await signedIn('support');
    await expect(
      ds.createAnimal({ farm_id: FEATURED.farms.lakshmi, tag_number: '01X', species_id: 'goat' }),
    ).resolves.toMatchObject({ tag_number: '01X' });
    await expect(
      ds.updateAnimal(FEATURED.animals.gauri, { tag_number: '01', name: 'Gauri' }),
    ).resolves.toMatchObject({ tag_number: '01' });
  });

  it('updating to a tag already in use throws duplicate_tag', async () => {
    const ds = await signedIn('support');
    await expect(
      ds.updateAnimal(FEATURED.animals.gauri, { tag_number: '02' }),
    ).rejects.toMatchObject({
      code: 'duplicate_tag',
    });
  });

  it('Pashu Aadhaar must be exactly 12 digits', async () => {
    const ds = await signedIn('support');
    await expect(
      ds.updateAnimal(FEATURED.animals.gauri, { pashu_aadhaar: '12345' }),
    ).rejects.toMatchObject({ code: 'validation', field: 'pashu_aadhaar' });
    await expect(
      ds.updateAnimal(FEATURED.animals.gauri, { pashu_aadhaar: '123456789012' }),
    ).resolves.toMatchObject({ pashu_aadhaar: '123456789012' });
  });

  it('updateAnimal logs its note and only the changed fields, never updated_at', async () => {
    const ds = await signedIn('support');
    await ds.updateAnimal(
      FEATURED.animals.gauri,
      { status: 'sold', name: 'Gauri' },
      'Sold at the fair',
    );
    const [latest] = await ds.listAudit({ limit: 1 });
    expect(latest?.changes).toEqual({ status: { from: 'active', to: 'sold' } });
    expect(latest?.note).toBe('Sold at the fair');
  });
});

describe('farms', () => {
  it('deleting a farm removes its children and logs exactly one row', async () => {
    const ds = await signedIn('super_admin');
    const id = FEATURED.farms.shreeGanesh;
    const before = (await ds.listAudit({ limit: 1000 })).length;
    await ds.deleteFarm(id);

    const log = await ds.listAudit({ limit: 1000 });
    expect(log.length).toBe(before + 1);
    expect(log[0]).toMatchObject({
      action: 'delete',
      table_name: 'farms',
      record_id: id,
      farm_id: id,
    });
    expect(log[0]?.changes).toMatchObject({ name: 'Shree Ganesh Dairy' });

    await expect(ds.getFarm(id)).rejects.toMatchObject({ code: 'not_found' });
    await expect(ds.getAnimal(FEATURED.animals.gauri)).rejects.toMatchObject({ code: 'not_found' });
    expect((await ds.listAnimals({ farm_id: id })).total).toBe(0);
    expect((await ds.listMilk({ farm_id: id })).total).toBe(0);
    expect((await ds.listFeed({ farm_id: id })).total).toBe(0);
    expect((await ds.listVaccinations({ farm_id: id })).total).toBe(0);
    expect((await ds.listHealthEvents({ farm_id: id })).total).toBe(0);
    for (const status of ['heat', 'inseminated', 'pregnant'] as const) {
      expect((await ds.listCycles({ status, farm_id: id })).total).toBe(0);
    }
    expect((await ds.listFarms({})).total).toBe(65);
  });

  it('settings are merged, not replaced, and the log holds the change', async () => {
    const ds = await signedIn('support');
    const farm = await ds.updateFarm(FEATURED.farms.yadav, { settings: { high_temp_c: 40 } });
    expect(farm.settings).toMatchObject({ high_temp_c: 40, offline_after_min: 15 });
    const [latest] = await ds.listAudit({ limit: 1 });
    expect(latest?.changes).toHaveProperty('settings');
  });

  it('transfer: the new owner owns it, the old owner becomes a manager, one log row per record', async () => {
    const ds = await signedIn('support');
    const id = FEATURED.farms.yadav;
    const before = (await ds.listAudit({ limit: 1000 })).length;
    await ds.transferFarm(id, FEATURED.owners.deepak, 'Family handover');
    const detail = await ds.getFarm(id);
    expect(detail.farm.owner_id).toBe(FEATURED.owners.deepak);
    const role = (userId: string) => detail.members.find((m) => m.user_id === userId)?.role;
    expect(role(FEATURED.owners.deepak)).toBe('owner');
    expect(role(FEATURED.owners.rajendra)).toBe('manager');

    const log = await ds.listAudit({ limit: 1000 });
    expect(log.length).toBe(before + 3);
    expect(log.slice(0, 3).every((e) => e.note === 'Family handover')).toBe(true);
  });

  it('the phone lookup checks the number and finds the profile', async () => {
    const ds = await signedIn('support');
    await expect(ds.findProfileByPhone('12345')).rejects.toMatchObject({ code: 'validation' });
    await expect(ds.findProfileByPhone('+91 98220 12341')).resolves.toMatchObject({
      full_name: 'Ramesh Patil',
    });
    await expect(ds.findProfileByPhone('9000000001')).resolves.toBeNull();
  });
});

describe('the other logged writes', () => {
  it('deleteEntry logs the row and the note', async () => {
    const ds = await signedIn('support');
    await ds.deleteEntry('milk_entries', wrongEntry, 'Logged twice');
    const [latest] = await ds.listAudit({ limit: 1 });
    expect(latest).toMatchObject({ action: 'delete', record_id: wrongEntry, note: 'Logged twice' });
    expect(latest?.changes).toMatchObject({ litres: 75 });
    await expect(ds.deleteEntry('milk_entries', wrongEntry)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('scheduling for a species logs one row per vaccination', async () => {
    const ds = await signedIn('support');
    const goats = (await ds.getFarm(FEATURED.farms.yadav)).dashboard.animals_by_species.goat;
    const before = (await ds.listAudit({ limit: 5000 })).length;
    const { created } = await ds.scheduleVaccination({
      farm_id: FEATURED.farms.yadav,
      species_id: 'goat',
      animal_id: null,
      vaccine_name: 'PPR',
      due_date: TODAY,
    });
    expect(created).toBe(goats);
    expect((await ds.listAudit({ limit: 5000 })).length).toBe(before + created);
  });

  it('marking a health issue resolved sets resolved_at, and undo clears it', async () => {
    const ds = await signedIn('support');
    const { rows } = await ds.listHealthEvents({ animal_id: FEATURED.animals.neeli, open: true });
    const id = rows[0]?.id ?? '';
    expect((await ds.setHealthStatus(id, 'resolved')).resolved_at).not.toBeNull();
    expect((await ds.setHealthStatus(id, 'sick')).resolved_at).toBeNull();
  });

  it('a new heat gets a golden period 2 to 12 hours after it started', async () => {
    const ds = await signedIn('support');
    const cycle = await ds.createCycle({
      farm_id: FEATURED.farms.periyar,
      animal_id: FEATURED.animals.ammini,
      status: 'heat',
      at: '2026-11-05T02:00:00Z',
    });
    expect(cycle.golden_start).toBe('2026-11-05T04:00:00Z');
    expect(cycle.golden_end).toBe('2026-11-05T14:00:00Z');
  });

  it('the log pages backwards with beforeId and filters by table', async () => {
    const ds = await signedIn('viewer');
    const first = await ds.listAudit({ limit: 5 });
    const next = await ds.listAudit({ limit: 5, beforeId: first[4]?.id });
    expect(next[0]?.id).toBeLessThan(first[4]?.id ?? 0);
    const milk = await ds.listAudit({ table_name: 'milk_entries' });
    expect(milk.every((e) => e.table_name === 'milk_entries')).toBe(true);
  });
});

describe('persistence', () => {
  it('writes survive a reload, and reset clears them', async () => {
    const store = newStore();
    const ds = await signedIn('support', store);
    await ds.fixMilk(wrongEntry, { session: 'evening', litres: 7.5, price_per_litre: 40 }, 'Typo');
    const added = await ds.createAnimal({
      farm_id: FEATURED.farms.yadav,
      tag_number: '777',
      species_id: 'goat',
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    // "Reload": a new store and adapter from the same localStorage.
    const reloaded = createDemoAdapter(newStore(), { latency: [0, 0] });
    await expect(reloaded.auth.currentStaff()).resolves.toMatchObject({
      full_name: 'Priya Sharma',
    });
    const milk = await reloaded.listMilk({
      farm_id: FEATURED.farms.yadav,
      from: '2026-11-04',
      to: '2026-11-04',
    });
    expect(milk.rows.find((r) => r.id === wrongEntry)).toMatchObject({
      litres: 7.5,
      fixed_by_staff: true,
    });
    await expect(reloaded.getAnimal(added.id)).resolves.toBeTruthy();
    const log = await reloaded.listAudit({ limit: 2 });
    expect(log.map((e) => e.table_name)).toEqual(['animals', 'milk_entries']);

    await reloaded.auth.resetDemoData?.();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    await expect(reloaded.getAnimal(added.id)).rejects.toMatchObject({ code: 'not_found' });
    const after = await reloaded.listMilk({
      farm_id: FEATURED.farms.yadav,
      from: '2026-11-04',
      to: '2026-11-04',
    });
    expect(after.rows.find((r) => r.id === wrongEntry)).toMatchObject({
      litres: 75,
      fixed_by_staff: false,
    });
    expect((await reloaded.listAudit({ limit: 1000 })).length).toBe(
      sharedSeed().admin_audit_log.length,
    );
    // Reset keeps the person signed in.
    await expect(reloaded.auth.currentStaff()).resolves.toMatchObject({
      full_name: 'Priya Sharma',
    });
  });

  it('a farm delete survives a reload, cascade included', async () => {
    const ds = await signedIn('super_admin');
    await ds.deleteFarm(FEATURED.farms.yadav);
    const reloaded = createDemoAdapter(newStore(), { latency: [0, 0] });
    expect((await reloaded.listFarms({})).total).toBe(65);
    expect((await reloaded.listMilk({ farm_id: FEATURED.farms.yadav })).total).toBe(0);
  });

  it.each([
    ['not JSON', '{not json'],
    ['not a list', '{"a":1}'],
    ['a bad entry', '[{"op":"explode"}]'],
    [
      'a change to a missing record',
      '[{"op":"update","table":"farms","id":"missing","patch":{"name":"x"},"at":"x","staff_id":null}]',
    ],
    [
      'a good entry then a bad one',
      `[{"op":"update","table":"farms","id":"${FEATURED.farms.yadav}","patch":{"name":"Half applied"},"at":"x","staff_id":null},{"op":"delete","table":"farms","id":"missing","at":"x","staff_id":null}]`,
    ],
  ])('a corrupt log (%s) is discarded and the seed still loads', async (_name, raw) => {
    window.localStorage.setItem(STORAGE_KEY, raw);
    const store = newStore();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    const ds = createDemoAdapter(store, { latency: [0, 0] });
    const farm = await ds.getFarm(FEATURED.farms.yadav);
    expect(farm.farm.name).toBe('Yadav Dairy');
  });
});

describe('errors and latency', () => {
  it('maps codes to the messages in the data contract', () => {
    expect(errorMessage(new DataError('not_allowed'))).toBe("Your role can't make this change.");
    expect(errorMessage(new DataError('reason_required'))).toBe('Add a reason for the fix.');
    expect(errorMessage(new DataError('not_found'))).toBe(
      'This record no longer exists. The list has been refreshed.',
    );
    expect(errorMessage(new DataError('network'))).toBe(
      "Couldn't save. Check your connection and try again.",
    );
    expect(errorMessage(new DataError('validation', 'Add a name.', 'name'))).toBe('Add a name.');
    expect(errorMessage(new Error('boom'))).toBe(
      "Couldn't save. Check your connection and try again.",
    );
  });

  it('every call waits 150 to 300 ms by default', async () => {
    vi.useRealTimers();
    const ds = createDemoAdapter(newStore());
    const started = performance.now();
    await ds.species();
    const took = performance.now() - started;
    expect(took).toBeGreaterThanOrEqual(145);
    expect(took).toBeLessThan(600);
  });
});
