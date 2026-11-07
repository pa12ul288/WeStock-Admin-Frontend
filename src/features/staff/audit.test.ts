import { describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '../../data/types';
import {
  describeEntry,
  emptyLookup,
  logKind,
  lookupNeeds,
  periodSince,
  serverFilter,
  vaccineText,
} from './audit';

function entry(patch: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: 1,
    at: '2026-11-05T06:46:00Z',
    staff_id: 's2',
    staff_name: 'Priya Sharma',
    action: 'update',
    table_name: 'milk_entries',
    record_id: 'm1',
    farm_id: 'f1',
    changes: {},
    note: null,
    ...patch,
  };
}

const change = (table: string, field: string, from: unknown, to: unknown) =>
  entry({ table_name: table, changes: { [field]: { from, to } } });

describe('logKind', () => {
  it('names each kind of change', () => {
    expect(logKind(change('milk_entries', 'litres', 75, 7.5))).toBe('edited');
    expect(logKind(entry({ action: 'delete' }))).toBe('deleted');
    expect(logKind(entry({ action: 'insert' }))).toBe('added');
    expect(logKind(change('vaccinations', 'done_date', null, '2026-11-05'))).toBe('done');
    expect(logKind(change('vaccinations', 'done_date', '2026-11-05', null))).toBe('edited');
    expect(logKind(change('health_events', 'status', 'sick', 'resolved'))).toBe('done');
    expect(logKind(change('farm_members', 'role', 'worker', 'manager'))).toBe('role');
    expect(logKind(entry({ table_name: 'admin_staff', action: 'insert' }))).toBe('invited');
    expect(logKind(change('admin_staff', 'role', 'support', 'viewer'))).toBe('role');
    expect(logKind(change('admin_staff', 'status', 'active', 'removed'))).toBe('removed');
  });

  it('asks the log for the narrowest rows', () => {
    expect(serverFilter('invited')).toEqual({ action: 'insert', table_name: 'admin_staff' });
    expect(serverFilter('done')).toEqual({ action: 'update' });
    expect(serverFilter(undefined)).toEqual({});
  });
});

describe('describeEntry', () => {
  it('reads "Litres: 75.0 → 7.5" with the reason as the note', () => {
    const lookup = emptyLookup();
    lookup.farms.set('f1', 'Yadav Dairy');
    lookup.animals.set('a4', { tag_number: '04', name: 'Shyama' });
    lookup.milk.set('m1', {
      id: 'm1',
      farm_id: 'f1',
      animal_id: 'a4',
      entry_date: '2026-11-04',
      session: 'evening',
      litres: 7.5,
      price_per_litre: 40,
      created_by: null,
      created_at: '2026-11-04T13:00:00Z',
    });
    const row = describeEntry(
      entry({ changes: { litres: { from: 75, to: 7.5 } }, note: 'Farmer confirmed on a call' }),
      lookup,
    );
    expect(row.record).toBe('Milk entry · 04 Shyama, evening');
    expect(row.farm).toBe('Yadav Dairy');
    expect(row.changes).toEqual([{ field: 'Litres', from: '75.0', to: '7.5' }]);
    expect(row.note).toBe('Farmer confirmed on a call');
  });

  it('puts a staff removal and an invite as the prototype does', () => {
    const lookup = emptyLookup();
    lookup.staff.set('s3', {
      user_id: 's3',
      full_name: 'Rahul Deshmukh',
      email: 'rahul@brainwired.demo',
      role: 'support',
      status: 'removed',
      invited_by: null,
      created_at: '',
      last_active_at: null,
    });
    const removed = describeEntry(
      entry({
        table_name: 'admin_staff',
        record_id: 's3',
        farm_id: null,
        changes: { status: { from: 'active', to: 'removed' } },
      }),
      lookup,
    );
    expect(removed.record).toBe('Staff · Rahul Deshmukh');
    expect(removed.farm).toBe('WeSTOCK admin');
    expect(removed.changes).toEqual([{ field: 'Access', from: 'Support', to: 'Removed' }]);
    expect(removed.note).toBe('Signed out and removed');

    const invited = describeEntry(
      entry({
        table_name: 'admin_staff',
        action: 'insert',
        farm_id: null,
        changes: { full_name: 'Meera Iyer', email: 'meera@brainwired.demo', role: 'viewer' },
      }),
      lookup,
    );
    expect(invited.record).toBe('Staff · Meera Iyer');
    expect(invited.changes).toEqual([{ field: 'Role', from: '—', to: 'Viewer' }]);
    expect(invited.note).toBe('Invite email sent to meera@brainwired.demo');
  });

  it('names vaccines the prototype way', () => {
    expect(vaccineText('FMD (foot-and-mouth)')).toBe('FMD vaccine');
    expect(vaccineText('Brucellosis')).toBe('Brucellosis vaccine');
  });
});

describe('lookupNeeds', () => {
  it('reads each farm once per kind of record, from the oldest edit', () => {
    const needs = lookupNeeds([
      entry({ id: 1 }),
      entry({ id: 2, at: '2026-09-20T00:00:00Z' }),
      entry({ id: 3, table_name: 'admin_staff', farm_id: null }),
    ]);
    expect(needs).toEqual([
      { kind: 'animals', farmId: 'f1' },
      { kind: 'milk', farmId: 'f1', from: '2026-08-01' },
    ]);
  });
});

describe('periodSince', () => {
  it('is 7 days by default, 30 on request, nothing for all time', () => {
    const now = Date.parse('2026-11-08T00:00:00Z');
    expect(periodSince('', now)).toBe('2026-11-01T00:00:00.000Z');
    expect(periodSince('30', now)).toBe('2026-10-09T00:00:00.000Z');
    expect(periodSince('all', now)).toBeUndefined();
  });
});
