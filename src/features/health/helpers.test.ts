import { describe, expect, it } from 'vitest';
import type { AuditLogEntry, HealthRow, VaccinationRow } from '../../data/types';
import { shiftDay } from '../../lib/format';
import {
  animalLabel,
  givenHere,
  healthChip,
  healthList,
  healthTotals,
  resolvedHere,
  scheduleToast,
  sinceText,
  vaccineChip,
  vaccineList,
  vaccineStatus,
  vaccineTotals,
} from './helpers';

const TODAY = '2026-11-05';
const on = (by: number) => shiftDay(TODAY, by);

function vaccine(id: string, due: number, done: number | null = null): VaccinationRow {
  return {
    id,
    farm_id: 'f',
    animal_id: 'a',
    vaccine_name: 'FMD',
    description: null,
    due_date: on(due),
    done_date: done === null ? null : on(done),
    created_at: `${on(-60)}T04:30:00.000Z`,
    animal: { id: 'a', name: 'Gauri', tag_number: '01', species_id: 'cattle' },
    farm_name: 'Shree Ganesh Dairy',
  };
}

function issue(
  id: string,
  status: HealthRow['status'],
  detected_at = `${TODAY}T01:00:00.000Z`,
  resolved_at: string | null = null,
): HealthRow {
  return {
    id,
    farm_id: 'f',
    animal_id: 'a',
    status,
    title: 'Fever',
    notes: null,
    detected_at,
    resolved_at,
    source: 'manual',
    animal: { id: 'a', name: 'Gauri', tag_number: '01', species_id: 'cattle' },
    farm_name: 'Shree Ganesh Dairy',
  };
}

function logged(record_id: string, field: string, from: unknown, to: unknown): AuditLogEntry {
  return {
    action: 'update',
    record_id,
    changes: { [field]: { from, to } },
  } as unknown as AuditLogEntry;
}

describe('vaccineStatus', () => {
  it('says how late, how soon or that it was given', () => {
    expect(vaccineStatus(vaccine('v', -8), TODAY)).toEqual({
      text: 'Overdue · 8 days',
      tone: 'red',
    });
    expect(vaccineStatus(vaccine('v', -1), TODAY).text).toBe('Overdue · 1 day');
    expect(vaccineStatus(vaccine('v', 0), TODAY).text).toBe('Due today');
    expect(vaccineStatus(vaccine('v', 7), TODAY).text).toBe('Due in 7 days');
    expect(vaccineStatus(vaccine('v', 8), TODAY)).toEqual({ text: 'Upcoming', tone: 'blue' });
    expect(vaccineStatus(vaccine('v', -2, 0), TODAY)).toEqual({
      text: 'Given today',
      tone: 'green',
    });
  });
});

describe('vaccineTotals', () => {
  it('groups what is not yet given, up to 30 days ahead', () => {
    const rows = [
      vaccine('a', -1),
      vaccine('b', 0),
      vaccine('c', 7),
      vaccine('d', 8),
      vaccine('e', 30),
      vaccine('later', 31),
      vaccine('given', -3, -3),
    ];
    expect(vaccineTotals(rows, TODAY)).toEqual({ overdue: 1, due: 2, upcoming: 2, total: 5 });
  });
});

describe('healthTotals', () => {
  it('counts open issues by status', () => {
    const rows = [
      issue('a', 'sick'),
      issue('b', 'detected'),
      issue('c', 'detected'),
      issue('d', 'condition'),
      issue('e', 'resolved'),
    ];
    expect(healthTotals(rows)).toEqual({ sick: 1, detected: 2, condition: 1, total: 4 });
  });
});

describe('the chips', () => {
  it('counts fewer to give as good and more as bad', () => {
    const old = [vaccine('a', -1), vaccine('b', -2), vaccine('c', -3), vaccine('d', -4, -1)];
    expect(vaccineChip(old, TODAY)?.tone).toBe('good');
    expect(vaccineChip(old, TODAY)?.text).toBe('↓ 25%');
    const added = { ...vaccine('e', 2), created_at: `${on(0)}T04:30:00.000Z` };
    expect(vaccineChip([vaccine('a', -1), added], TODAY)?.text).toBe('↑ 100%');
    expect(vaccineChip([vaccine('a', -1)], TODAY)?.text).toBe('same');
    expect(vaccineChip([], TODAY)).toBeNull();
  });

  it('counts open issues from the last 24 hours as new', () => {
    const now = Date.parse(`${TODAY}T06:00:00.000Z`);
    const rows = [
      issue('a', 'sick', `${TODAY}T01:00:00.000Z`),
      issue('b', 'resolved', `${TODAY}T01:00:00.000Z`),
      issue('c', 'detected', `${on(-3)}T01:00:00.000Z`),
    ];
    expect(healthChip(rows, now)?.text).toBe('↑ 1 new');
    expect(healthChip(rows.slice(1), now)).toBeNull();
  });
});

describe('vaccineList', () => {
  it('sorts by due date and leaves out what is later than 30 days', () => {
    const rows = [vaccine('b', 4), vaccine('a', -8), vaccine('later', 45)];
    expect(vaccineList(rows, [], TODAY).map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('keeps a row staff marked today in its place, and only that', () => {
    const rows = [
      vaccine('a', -8),
      vaccine('mine', -6, 0),
      vaccine('farmer', -5, 0),
      vaccine('old', -5, -2),
      vaccine('b', -4),
    ];
    const log = [
      logged('mine', 'done_date', null, on(0)),
      logged('old', 'done_date', null, on(-2)),
    ];
    expect(vaccineList(rows, log, TODAY).map((row) => row.id)).toEqual(['a', 'mine', 'b']);
    expect(givenHere(rows[1] as VaccinationRow, log, TODAY)).toBe(true);
    expect(givenHere(rows[2] as VaccinationRow, log, TODAY)).toBe(false);
  });
});

describe('healthList', () => {
  const resolvedAt = new Date().toISOString();

  it('puts sick first, then detected, then long-term, newest first in each', () => {
    const rows = [
      issue('long', 'condition'),
      issue('old', 'detected', `${on(-2)}T01:00:00.000Z`),
      issue('new', 'detected', `${on(0)}T01:00:00.000Z`),
      issue('sick', 'sick', `${on(-9)}T01:00:00.000Z`),
    ];
    expect(healthList(rows, []).map((row) => row.id)).toEqual(['sick', 'new', 'old', 'long']);
  });

  it('keeps an issue staff resolved today where its old status put it', () => {
    const mine = issue('mine', 'resolved', `${on(-9)}T01:00:00.000Z`, resolvedAt);
    const seeded = issue('seed', 'resolved', `${on(-9)}T01:00:00.000Z`, resolvedAt);
    const log = [logged('mine', 'status', 'sick', 'resolved')];
    const rows = [issue('detected', 'detected'), issue('sick', 'sick'), mine, seeded];
    expect(healthList(rows, log).map((row) => row.id)).toEqual(['sick', 'mine', 'detected']);
    expect(resolvedHere(mine, log)).toBe('sick');
    expect(resolvedHere(seeded, log)).toBeNull();
  });

  it('drops a resolve from an earlier day', () => {
    const old = issue('old', 'resolved', `${on(-9)}T01:00:00.000Z`, '2020-01-01T01:00:00.000Z');
    expect(healthList([old], [logged('old', 'status', 'sick', 'resolved')])).toEqual([]);
  });
});

describe('the words', () => {
  it('says when an issue began', () => {
    const now = Date.parse(`${TODAY}T06:00:00.000Z`);
    expect(sinceText(`${TODAY}T02:40:00.000Z`, now)).toBe('Today 08:10');
    expect(sinceText(`${on(-1)}T02:40:00.000Z`, now)).toBe('Yesterday');
    expect(sinceText(`${on(-2)}T02:40:00.000Z`, now)).toBe('03 Nov 2026');
  });

  it('names the species for anything but cattle', () => {
    const name = (id: string) => (id === 'buffalo' ? 'Buffalo' : 'Cattle');
    expect(animalLabel({ name: 'Gauri', tag_number: '01', species_id: 'cattle' }, name)).toBe(
      'Gauri',
    );
    expect(animalLabel({ name: 'Kali', tag_number: '07', species_id: 'buffalo' }, name)).toBe(
      'Kali (buffalo)',
    );
    expect(animalLabel({ name: null, tag_number: '09', species_id: 'cattle' }, name)).toBe(
      'Tag 09',
    );
  });

  it('counts reminders and says when far-off ones will be listed', () => {
    expect(scheduleToast(1, 'FMD', 'Yadav Dairy', on(15), TODAY)).toBe(
      '1 reminder created for FMD at Yadav Dairy',
    );
    expect(scheduleToast(41, 'FMD', 'Yadav Dairy', on(30), TODAY)).toBe(
      '41 reminders created for FMD at Yadav Dairy',
    );
    expect(scheduleToast(2, 'FMD', 'Yadav Dairy', on(40), TODAY)).toBe(
      `2 reminders created for FMD at Yadav Dairy · listed here from 15 Nov 2026`,
    );
  });
});
