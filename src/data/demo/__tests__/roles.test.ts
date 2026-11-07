import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataError } from '../../errors';
import type { DataSource } from '../../source';
import { FEATURED } from '../featured';
import { NOW, signedIn, TODAY } from './helpers';

const farm = FEATURED.farms.yadav;
const animal = FEATURED.animals.shyama;

async function firstRow<T>(page: Promise<{ rows: T[] }>): Promise<T> {
  const { rows } = await page;
  const row = rows[0];
  if (!row) throw new Error('expected a row');
  return row;
}

/** Every write in the DataSource, with valid arguments. */
const EDITOR_WRITES: [string, (ds: DataSource) => Promise<unknown>][] = [
  ['updateFarm', (ds) => ds.updateFarm(farm, { description: 'Edited' })],
  ['createShed', (ds) => ds.createShed(farm, { code: 'S9', name: 'New shed' })],
  [
    'updateShed',
    async (ds) => {
      const detail = await ds.getFarm(farm);
      return ds.updateShed(detail.sheds[0]?.id ?? '', { name: 'Renamed' });
    },
  ],
  ['addMember', (ds) => ds.addMember(farm, FEATURED.owners.lakshmi, 'worker')],
  ['setMemberRole', (ds) => ds.setMemberRole(farm, FEATURED.owners.lakshmi, 'manager')],
  ['transferFarm', (ds) => ds.transferFarm(farm, FEATURED.owners.deepak, 'Sold the farm')],
  [
    'createAnimal',
    (ds) => ds.createAnimal({ farm_id: farm, tag_number: '901', species_id: 'goat' }),
  ],
  ['updateAnimal', (ds) => ds.updateAnimal(animal, { breed: 'Gir' })],
  [
    'createVaccination',
    (ds) =>
      ds.createVaccination({
        farm_id: farm,
        animal_id: animal,
        vaccine_name: 'BQ',
        due_date: TODAY,
      }),
  ],
  [
    'scheduleVaccination',
    (ds) =>
      ds.scheduleVaccination({
        farm_id: farm,
        species_id: 'goat',
        animal_id: null,
        vaccine_name: 'PPR',
        due_date: TODAY,
      }),
  ],
  [
    'setVaccinationDone',
    async (ds) => {
      const row = await firstRow(ds.listVaccinations({ open: true }));
      return ds.setVaccinationDone(row.id, TODAY);
    },
  ],
  [
    'createHealthEvent',
    (ds) =>
      ds.createHealthEvent({ farm_id: farm, animal_id: animal, title: 'Fever', status: 'sick' }),
  ],
  [
    'setHealthStatus',
    async (ds) => {
      const row = await firstRow(ds.listHealthEvents({ open: true }));
      return ds.setHealthStatus(row.id, 'resolved');
    },
  ],
  [
    'createCycle',
    (ds) =>
      ds.createCycle({
        farm_id: farm,
        animal_id: animal,
        status: 'inseminated',
        at: new Date(NOW).toISOString(),
        tube_number: 'GIR-22-0001',
      }),
  ],
  [
    'setInseminationVerified',
    async (ds) => {
      const row = await firstRow(ds.listCycles({ status: 'inseminated' }));
      return ds.setInseminationVerified(row.id, true);
    },
  ],
  [
    'createMilk',
    (ds) => ds.createMilk({ farm_id: farm, entry_date: TODAY, session: 'morning', litres: 4 }),
  ],
  [
    'fixMilk',
    (ds) =>
      ds.fixMilk(
        FEATURED.milk.yadavWrongEntry,
        { session: 'evening', litres: 7.5, price_per_litre: 40 },
        'Typo',
      ),
  ],
  [
    'createFeed',
    (ds) =>
      ds.createFeed({ farm_id: farm, entry_date: TODAY, feed_type: 'Silage', quantity_kg: 10 }),
  ],
  [
    'fixFeed',
    async (ds) => {
      const row = await firstRow(ds.listFeed({ farm_id: farm }));
      return ds.fixFeed(row.id, { feed_type: row.feed_type, quantity_kg: 1, cost: 3 }, 'Typo');
    },
  ],
  [
    'deleteEntry',
    async (ds) => {
      const row = await firstRow(ds.listFeed({ farm_id: farm }));
      return ds.deleteEntry('feed_entries', row.id, 'Duplicate');
    },
  ],
];

const SUPER_ONLY_WRITES: [string, (ds: DataSource) => Promise<unknown>][] = [
  [
    'inviteStaff',
    (ds) =>
      ds.inviteStaff({ full_name: 'New Person', email: 'new@brainwired.demo', role: 'viewer' }),
  ],
  ['updateStaff', (ds) => ds.updateStaff(FEATURED.staff.rahul, { role: 'viewer' })],
  ['deleteFarm', (ds) => ds.deleteFarm(FEATURED.farms.lakshmi)],
];

async function expectNotAllowed(run: () => Promise<unknown>) {
  await expect(run()).rejects.toMatchObject({ code: 'not_allowed' });
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  window.localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('role permissions, as in the CLAUDE.md table', () => {
  it('super admin can make every write', async () => {
    const ds = await signedIn('super_admin');
    for (const [name, write] of [...EDITOR_WRITES, ...SUPER_ONLY_WRITES]) {
      await expect(write(ds), name).resolves.not.toThrow();
    }
  });

  it('support can edit records, but not delete farms or manage staff', async () => {
    const ds = await signedIn('support');
    for (const [name, write] of EDITOR_WRITES) {
      await expect(write(ds), name).resolves.not.toThrow();
    }
    for (const [, write] of SUPER_ONLY_WRITES) {
      await expectNotAllowed(() => write(ds));
    }
  });

  it('viewer can make no write at all', async () => {
    const ds = await signedIn('viewer');
    for (const [, write] of [...EDITOR_WRITES, ...SUPER_ONLY_WRITES]) {
      await expectNotAllowed(() => write(ds));
    }
  });

  it('every role can read everything, including the log', async () => {
    for (const role of ['super_admin', 'support', 'viewer'] as const) {
      const ds = await signedIn(role);
      await expect(ds.listFarms({})).resolves.toMatchObject({ total: 66 });
      expect((await ds.listAudit({})).length).toBeGreaterThan(0);
      expect((await ds.listStaff()).length).toBe(5);
    }
  });

  it('a failed write changes nothing and logs nothing', async () => {
    const ds = await signedIn('viewer');
    const before = await ds.listAudit({});
    await expectNotAllowed(() => ds.updateFarm(farm, { description: 'Nope' }));
    expect((await ds.getFarm(farm)).farm.description).toBeNull();
    expect(await ds.listAudit({})).toEqual(before);
  });

  it('signed out, writes are refused', async () => {
    const ds = await signedIn('super_admin');
    await ds.auth.signOut();
    expect(await ds.auth.currentStaff()).toBeNull();
    await expectNotAllowed(() => ds.updateFarm(farm, { description: 'Nope' }));
  });

  it('the demo role switcher changes what the adapter allows', async () => {
    const ds = await signedIn('super_admin');
    await expect(ds.auth.setDemoRole?.('viewer')).resolves.toMatchObject({ role: 'viewer' });
    await expectNotAllowed(() => ds.updateFarm(farm, { description: 'Nope' }));
    // The switch is for this session: the staff list still shows the real role.
    const staff = await ds.listStaff();
    expect(staff.find((s) => s.user_id === FEATURED.staff.anjali)?.role).toBe('super_admin');
  });

  it('throws DataError, not a plain error', async () => {
    const ds = await signedIn('viewer');
    await expect(ds.deleteFarm(farm)).rejects.toBeInstanceOf(DataError);
  });
});

describe('sign-in', () => {
  it('accepts a demo account with any 6+ character password', async () => {
    const ds = await signedIn('support');
    await expect(ds.auth.currentStaff()).resolves.toMatchObject({
      full_name: 'Priya Sharma',
      role: 'support',
    });
  });

  it('gives one message for a wrong email or a short password', async () => {
    const ds = await signedIn('support');
    await expect(ds.auth.signIn('nobody@brainwired.demo', 'password')).rejects.toMatchObject({
      code: 'validation',
      message: 'Email or password is wrong',
    });
    await expect(ds.auth.signIn('priya@brainwired.demo', '12345')).rejects.toMatchObject({
      code: 'validation',
      message: 'Email or password is wrong',
    });
  });

  it('turns an invited account active on first sign-in', async () => {
    const ds = await signedIn('support');
    const vikram = await ds.auth.signIn('vikram@brainwired.demo', 'password');
    expect(vikram).toMatchObject({ status: 'active', role: 'support' });
    const [latest] = await ds.listAudit({ limit: 1 });
    expect(latest).toMatchObject({
      table_name: 'admin_staff',
      record_id: FEATURED.staff.vikram,
      changes: { status: { from: 'invited', to: 'active' } },
    });
  });

  it('refuses a removed account', async () => {
    const admin = await signedIn('super_admin');
    await admin.updateStaff(FEATURED.staff.priya, { status: 'removed' });
    await expect(admin.auth.signIn('priya@brainwired.demo', 'password')).rejects.toMatchObject({
      code: 'validation',
    });
  });

  it("won't let a super admin remove themselves", async () => {
    const ds = await signedIn('super_admin');
    await expect(
      ds.updateStaff(FEATURED.staff.anjali, { status: 'removed' }),
    ).rejects.toMatchObject({
      code: 'validation',
      message: 'You can’t remove yourself. Ask another super admin.',
    });
  });

  it("won't let a super admin demote themselves", async () => {
    const ds = await signedIn('super_admin');
    await expect(ds.updateStaff(FEATURED.staff.anjali, { role: 'support' })).rejects.toMatchObject({
      code: 'validation',
      field: 'role',
    });
    await expect(ds.updateStaff(FEATURED.staff.priya, { role: 'viewer' })).resolves.toMatchObject({
      role: 'viewer',
    });
  });
});
