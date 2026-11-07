import { describe, expect, it } from 'vitest';
import type { CycleRow, MilkRow, Species, VaccinationRow } from '../../data/types';
import {
  buildComingUp,
  buildLatest,
  buildMilkWeek,
  buildRecords,
  memberNote,
  milkTicks,
  milkTodayNote,
  nationalDigits,
  parseMapPin,
  shedMixes,
  speciesMix,
} from './helpers';

const NOW = Date.parse('2026-11-05T12:00:00+05:30');
const animal = { id: 'a', name: 'Gauri', tag_number: '01', species_id: 'cattle' };

const species = [
  { id: 'cattle', labels: { en: 'Cattle' } },
  { id: 'goat', labels: { en: 'Goat' } },
] as Species[];

const vaccine = (over: Partial<VaccinationRow>) =>
  ({
    id: 'v',
    animal,
    vaccine_name: 'FMD (foot-and-mouth)',
    description: null,
    done_date: null,
    due_date: '2026-11-09',
    ...over,
  }) as VaccinationRow;

describe('notes', () => {
  it('writes the species mix, biggest first, with plurals', () => {
    expect(speciesMix({ goat: 6, cattle: 41 }, species)).toBe('41 cattle · 6 goats');
  });
  it('says which milk sessions have come in', () => {
    const today = { total: 1, morning: 1, afternoon: 1, evening: 0 };
    expect(milkTodayNote(today)).toBe('Morning and afternoon so far');
    expect(milkTodayNote({ ...today, afternoon: 0 })).toBe('Morning so far');
    expect(milkTodayNote({ total: 0, morning: 0, afternoon: 0, evening: 0 })).toBe(
      'No milk logged yet today',
    );
  });
  it('counts members by role', () => {
    expect(memberNote([{ role: 'owner' }, { role: 'manager' }, { role: 'manager' }])).toBe(
      '1 owner · 2 managers · 0 workers',
    );
  });
});

describe('buildComingUp', () => {
  it('merges breeding and vaccines by date and groups a vaccine day', () => {
    const heat = {
      id: 'h',
      animal,
      golden_end: '2026-11-05T15:00:00Z',
      heat_confirmed: true,
      source: 'manual',
    } as unknown as CycleRow;
    const pregnant = {
      id: 'p',
      animal: { ...animal, name: 'Sita' },
      expected_delivery: '2026-11-17',
      cycle_no: 2,
    } as unknown as CycleRow;
    const items = buildComingUp(
      [heat],
      [pregnant],
      [
        vaccine({ id: 'v1' }),
        vaccine({ id: 'v2' }),
        vaccine({ id: 'v3' }),
        vaccine({ id: 'v4', due_date: '2026-10-01' }),
        vaccine({ id: 'v5', due_date: '2027-03-01' }),
        vaccine({ id: 'v6', done_date: '2026-11-01' }),
      ],
      NOW,
    );
    expect(items.map((item) => item.what)).toEqual([
      'Gauri · golden period ends 20:30',
      'Gauri · FMD vaccine due',
      'Sita · may deliver',
    ]);
    expect(items[0]).toMatchObject({ isToday: true, dayOfMonth: '05', kind: 'breeding' });
    expect(items[1]).toMatchObject({
      month: 'NOV',
      dayOfMonth: '09',
      detail: 'Plus 2 other animals',
      kind: 'vaccine',
    });
  });

  it('skips a golden period that has ended, and keeps to four rows', () => {
    const ended = { id: 'h', animal, golden_end: '2026-11-05T01:00:00Z' } as unknown as CycleRow;
    const many = [10, 11, 12, 13, 14].map((day) =>
      vaccine({ id: `v${day}`, due_date: `2026-11-${day}` }),
    );
    const items = buildComingUp([ended], [], many, NOW);
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.kind === 'vaccine')).toBe(true);
  });
});

describe('buildRecords', () => {
  it('finds the oldest overdue vaccine and this month’s counts', () => {
    const records = buildRecords(
      [],
      [],
      [
        vaccine({ id: 'a', due_date: '2026-10-28' }),
        vaccine({ id: 'b', due_date: '2026-11-01' }),
        vaccine({ id: 'c', done_date: '2026-11-02' }),
        vaccine({ id: 'd', done_date: '2026-10-02' }),
      ],
      [{ resolved_at: '2026-11-01T00:00:00Z' }, { resolved_at: null }] as never,
      NOW,
    );
    expect(records.oldestOverdueDays).toBe(8);
    expect(records.givenThisMonth).toBe(1);
    expect(records.resolvedThisMonth).toBe(1);
  });
});

describe('buildMilkWeek', () => {
  it('covers the 7 finished days and compares them with the 7 before', () => {
    const milk = [
      { day: '2026-11-05', litres: 168, revenue: 1 },
      { day: '2026-11-04', litres: 200, revenue: 1000 },
      { day: '2026-11-03', litres: 300, revenue: 2000 },
      { day: '2026-10-25', litres: 400, revenue: 9 },
    ];
    const week = buildMilkWeek(milk, NOW);
    expect(week.bars.map((bar) => bar.day)).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    expect(week.total).toBe(500);
    expect(week.revenue).toBe(3000);
    expect(week.trendPct).toBe(25);
    expect(week.bestIndex).toBe(5);
  });
  it('has no trend or dark bar without milk', () => {
    const week = buildMilkWeek([], NOW);
    expect(week.trendPct).toBeNull();
    expect(week.bestIndex).toBeUndefined();
  });
});

describe('milkTicks', () => {
  it('picks round steps', () => {
    expect(milkTicks(340)).toEqual([0, 150, 300, 450]);
    expect(milkTicks(26)).toEqual([0, 10, 20, 30]);
    expect(milkTicks(0)).toEqual([0, 1, 2, 3]);
  });
});

describe('buildLatest', () => {
  it('merges by time, newest first, and flags staff fixes', () => {
    const row = (id: string, at: string, fixed = false) =>
      ({
        id,
        created_at: at,
        animal: null,
        litres: 144,
        session: 'evening',
        entered_by: 'Suresh Patil',
        fixed_by_staff: fixed,
      }) as MilkRow;
    const health = {
      id: 'h',
      detected_at: '2026-11-05T02:00:00Z',
      animal,
      title: 'Lameness',
      status: 'detected',
      source: 'sensor',
    };
    const latest = buildLatest(
      [row('old', '2026-11-04T02:00:00Z'), row('new', '2026-11-05T03:00:00Z', true)],
      [],
      [health] as never,
      [],
    );
    expect(latest.map((item) => item.text)).toEqual([
      'Whole herd · 144.0 L, evening',
      'Tag 01 Gauri · lameness, detected',
      'Whole herd · 144.0 L, evening',
    ]);
    expect(latest[0]?.staff).toBe(true);
    expect(latest[1]?.by).toBe('Collar');
  });
});

describe('shedMixes', () => {
  it('groups animals by shed, with null for not in a shed', () => {
    const mixes = shedMixes(
      [
        { shed_id: 's', species_id: 'cattle' },
        { shed_id: 's', species_id: 'goat' },
        { shed_id: null, species_id: 'cattle' },
      ],
      species,
    );
    expect(mixes.get('s')).toEqual({ count: 2, mix: '1 cattle · 1 goats' });
    expect(mixes.get(null)?.count).toBe(1);
  });
});

describe('parseMapPin', () => {
  it('reads a pin, clears on empty, refuses nonsense', () => {
    expect(parseMapPin('16.7050, 74.2433')).toEqual({ lat: 16.705, lng: 74.2433 });
    expect(parseMapPin('  ')).toBeNull();
    expect(parseMapPin('somewhere')).toBeUndefined();
    expect(parseMapPin('95, 10')).toBeUndefined();
    expect(parseMapPin('10, 200')).toBeUndefined();
  });
});

describe('nationalDigits', () => {
  it('accepts spaces and the country code, refuses the rest', () => {
    expect(nationalDigits('+91 98220 12341')).toBe('9822012341');
    expect(nationalDigits('9822012341')).toBe('9822012341');
    expect(nationalDigits('98220')).toBeNull();
  });
});
