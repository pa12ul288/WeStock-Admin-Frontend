import { describe, expect, it } from 'vitest';
import type { AuditLogEntry, ReproductionCycle } from '../../data/types';
import { formatAge } from '../../lib/format';
import { formatAadhaar, formatShed } from '../../lib/labels';
import { breedingStage, collarText, shedNote, worstOpenHealth } from '../livestock/helpers';
import {
  activityParts,
  cycleSteps,
  cycleTitle,
  daysBetween,
  gestation,
  lastChange,
  milkBars,
  milkSummary,
  milkTicks,
  milkToday,
  sortVaccinations,
  statusChangeNote,
  statusNote,
  vaccineState,
} from './helpers';

const cycle = (patch: Partial<ReproductionCycle>): ReproductionCycle => ({
  id: 'c',
  farm_id: 'f',
  animal_id: 'a',
  cycle_no: 2,
  status: 'pregnant',
  heat_started_at: null,
  golden_start: null,
  golden_end: null,
  heat_confirmed: null,
  inseminated_at: null,
  tube_number: null,
  insemination_verified: false,
  insemination_image_url: null,
  pregnancy_confirmed_at: null,
  expected_delivery: null,
  delivered_at: null,
  source: 'manual',
  created_at: '2026-01-01T00:00:00Z',
  ...patch,
});

const entry = (patch: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 1,
  at: '2026-11-05T00:00:00Z',
  staff_id: 's',
  staff_name: 'Anjali',
  action: 'update',
  table_name: 'animals',
  record_id: 'a',
  farm_id: 'f',
  changes: {},
  note: null,
  ...patch,
});

describe('vaccineState', () => {
  const today = '2026-11-05';
  it('says each state in words', () => {
    const state = (due_date: string, done_date: string | null = null) =>
      vaccineState({ due_date, done_date }, today);
    expect(state('2026-11-01', '2026-11-01')).toEqual({ text: 'Done', tone: 'green' });
    expect(state('2026-11-01').text).toBe('Overdue');
    expect(state('2026-11-05').text).toBe('Due today');
    expect(state('2026-11-06').text).toBe('Due in 1 day');
    expect(state('2026-11-09').text).toBe('Due in 4 days');
    expect(state('2026-12-02')).toEqual({ text: 'Upcoming', tone: 'blue' });
  });

  it('sorts what is still to give first, soonest first, then latest given', () => {
    const rows = [
      { due_date: '2026-01-01', done_date: '2026-01-02' },
      { due_date: '2026-12-01', done_date: null },
      { due_date: '2026-11-01', done_date: null },
      { due_date: '2026-02-01', done_date: '2026-02-02' },
    ];
    expect(sortVaccinations(rows).map((row) => row.due_date)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2026-02-01',
      '2026-01-01',
    ]);
  });
});

describe('the status note', () => {
  it('holds the date and the note, which have no column of their own', () => {
    expect(statusNote('sold', '2026-11-05', ' Sold to a farmer ')).toBe(
      'Sold on 05 Nov 2026 · Sold to a farmer',
    );
    expect(statusNote('deceased', '2026-11-05', '')).toBe('Deceased on 05 Nov 2026');
  });

  it('is read back from the latest status change only', () => {
    const log = [
      entry({ changes: { name: { from: 'a', to: 'b' } }, note: 'not this' }),
      entry({ changes: { status: { from: 'active', to: 'sold' } }, note: 'this' }),
    ];
    expect(statusChangeNote(log, 'a')).toBe('this');
    expect(statusChangeNote(log, 'other')).toBeNull();
  });
});

describe('lastChange', () => {
  it('finds the newest change to a field, ignoring inserts and other records', () => {
    const log = [
      entry({ record_id: 'x', changes: { status: { from: 'sick', to: 'resolved' } } }),
      entry({ action: 'insert', changes: { status: 'sick' } }),
      entry({ changes: { status: { from: 'detected', to: 'resolved' } } }),
      entry({ changes: { status: { from: 'sick', to: 'detected' } } }),
    ];
    expect(lastChange(log, 'a', 'status')).toEqual({ from: 'detected', to: 'resolved' });
    expect(lastChange(log, 'a', 'title')).toBeNull();
    expect(lastChange(undefined, 'a', 'status')).toBeNull();
  });
});

describe('cycles', () => {
  it('builds the steps it has dates for', () => {
    const steps = cycleSteps(
      cycle({
        heat_started_at: '2026-04-09T06:00:00Z',
        heat_confirmed: true,
        golden_start: '2026-04-09T10:00:00Z',
        golden_end: '2026-04-10T10:00:00Z',
        inseminated_at: '2026-04-10T05:00:00Z',
        pregnancy_confirmed_at: '2026-06-18T05:00:00Z',
        expected_delivery: '2027-01-18',
      }),
    );
    expect(steps).toEqual([
      { label: 'Heat', detail: '09 Apr 2026 · farmer confirmed', done: true },
      { label: 'Inseminated', detail: '10 Apr 2026 · in golden period', done: true },
      { label: 'Pregnant', detail: 'Confirmed 18 Jun 2026', done: true },
      { label: 'Delivery', detail: 'Expected 18 Jan 2027', done: false },
    ]);
  });

  it('shows a delivered cycle as finished', () => {
    const steps = cycleSteps(cycle({ status: 'delivered', delivered_at: '2026-01-06T05:00:00Z' }));
    expect(steps).toEqual([{ label: 'Delivered', detail: '06 Jan 2026', done: true }]);
    expect(cycleTitle(cycle({ status: 'delivered' }))).toBe('Cycle 2');
    expect(cycleTitle(cycle({ status: 'pregnant' }))).toBe('Cycle 2 · now');
    expect(cycleTitle(cycle({ status: 'failed' }))).toBe('Cycle 2 · did not take');
  });

  it('works out how far along a pregnancy is', () => {
    const progress = gestation(
      cycle({
        inseminated_at: '2026-04-10T05:00:00Z',
        pregnancy_confirmed_at: '2026-06-18T05:00:00Z',
        expected_delivery: '2027-01-18',
      }),
      '2026-11-05',
    );
    expect(progress).toMatchObject({ day: 209, total: 283, daysLeft: 74 });
    expect(Math.round(progress?.percent ?? 0)).toBe(74);
    expect(Math.round(progress?.confirmedPercent ?? 0)).toBe(24);
    expect(gestation(cycle({}), '2026-11-05')).toBeNull();
  });

  it('never runs the bar past the end', () => {
    const late = gestation(
      cycle({ inseminated_at: '2026-01-01T05:00:00Z', expected_delivery: '2026-02-01' }),
      '2026-11-05',
    );
    expect(late?.percent).toBe(100);
    expect(late?.daysLeft).toBeLessThan(0);
  });
});

describe('milk', () => {
  const today = '2026-11-05';
  it('has a bar for each of the 30 days, labelled every 10 and today', () => {
    const bars = milkBars([{ day: today, litres: 9.5, revenue: 0 }], today, (day) => day);
    expect(bars).toHaveLength(30);
    expect(bars[29]).toEqual({ day: today, label: 'Today', litres: 9.5 });
    expect(bars[0]?.label).toBe('2026-10-07');
    expect(bars[10]?.label).toBe('2026-10-17');
    expect(bars[1]).toMatchObject({ label: '', litres: 0 });
  });

  it('averages the days with milk and ignores older ones', () => {
    const summary = milkSummary(
      [
        { day: '2026-01-01', litres: 99, revenue: 0 },
        { day: '2026-11-04', litres: 10, revenue: 0 },
        { day: today, litres: 12, revenue: 0 },
      ],
      today,
    );
    expect(summary).toEqual({ hasMilk: true, average: 11, best: 12 });
    expect(milkSummary([], today).hasMilk).toBe(false);
  });

  it("takes only this animal's entries for today", () => {
    expect(
      milkToday(
        [
          { animal_id: 'a', session: 'morning', litres: 5.5 },
          { animal_id: 'b', session: 'morning', litres: 9 },
          { animal_id: 'a', session: 'afternoon', litres: 4 },
        ],
        'a',
      ),
    ).toEqual({ total: 9.5, morning: 5.5, afternoon: 4, evening: 0 });
  });

  it('rounds the axis up in fives', () => {
    expect(milkTicks(12.3)).toEqual([0, 5, 10, 15]);
    expect(milkTicks(0)).toEqual([0, 5]);
  });
});

describe('activity', () => {
  it('gives hours and shares in the design order', () => {
    const parts = activityParts({
      day: '2026-11-05',
      stand_min: 60,
      sit_min: 60,
      walk_min: 0,
      eat_min: 0,
      ruminate_min: 120,
      drink_min: 0,
    });
    expect(parts[0]).toMatchObject({ name: 'Ruminating', hours: 2, percent: 50 });
    expect(parts.map((part) => part.name)).toEqual([
      'Ruminating',
      'Standing',
      'Sitting',
      'Eating',
      'Walking',
      'Drinking',
    ]);
  });
});

describe('livestock helpers', () => {
  it('says May deliver for a pregnancy due within 30 days', () => {
    const today = '2026-11-05';
    expect(breedingStage('pregnant', '2026-11-20', today)).toBe('may_deliver');
    expect(breedingStage('pregnant', '2027-01-18', today)).toBe('pregnant');
    expect(breedingStage('heat', null, today)).toBe('heat');
    expect(breedingStage(null, null, today)).toBeNull();
  });

  it('keeps the most serious open issue per animal', () => {
    const worst = worstOpenHealth([
      { animal_id: 'a', status: 'condition' },
      { animal_id: 'a', status: 'sick' },
      { animal_id: 'a', status: 'detected' },
      { animal_id: 'b', status: 'condition' },
    ]);
    expect(worst.get('a')).toBe('sick');
    expect(worst.get('b')).toBe('condition');
  });

  it('writes the collar cell for the CSV', () => {
    expect(collarText({ connection_state: 'normal', last_temp_c: 38.6 })).toBe('Normal · 38.6 °C');
    expect(collarText({ connection_state: 'cannot_connect', last_temp_c: 38 })).toBe(
      'Cannot connect',
    );
    expect(collarText({ connection_state: 'no_hardware', last_temp_c: null })).toBe('No collar');
  });

  it('shows what happened in place of the shed once an animal has left', () => {
    expect(shedNote({ status: 'sold', shed_code: 'S1', shed_name: 'Main' })).toBe('Sold');
    expect(shedNote({ status: 'active', shed_code: 'S1', shed_name: 'Main' })).toBe('S1 · Main');
    expect(shedNote({ status: 'active', shed_code: null, shed_name: null })).toBe('Not in a shed');
  });
});

describe('shared formats', () => {
  it('writes ages in years and months', () => {
    expect(formatAge('2022-09-03', '2026-11-05T06:00:00Z')).toBe('4 y 2 m');
    expect(formatAge('2026-06-10', '2026-11-05T06:00:00Z')).toBe('4 m');
    expect(formatAge('2026-11-01', '2026-11-05T06:00:00Z')).toBe('0 m');
    expect(formatAge(null)).toBe('—');
  });

  it('groups Pashu Aadhaar digits and names sheds', () => {
    expect(formatAadhaar('482177039125')).toBe('4821 7703 9125');
    expect(formatAadhaar('4821 77039125')).toBe('4821 7703 9125');
    expect(formatShed({ code: 'S1', name: 'Main shed' })).toBe('S1 · Main shed');
    expect(formatShed({ code: null, name: 'Stable' })).toBe('Stable');
    expect(formatShed(null)).toBe('');
  });

  it('counts whole days', () => {
    expect(daysBetween('2026-11-05', '2026-11-09')).toBe(4);
  });
});
