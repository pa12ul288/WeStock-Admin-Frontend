import { describe, expect, it } from 'vitest';
import type { FarmListRow, FarmerListRow } from '../../data/types';
import { farmerTotals, farmsByOwner, percentOf, quietLevel } from './helpers';

const NOW = Date.parse('2026-11-05T12:00:00+05:30');
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const farmer = (lastEntry: string | null, joined = '2026-01-10T00:00:00Z') =>
  ({ joined_at: joined, last_entry_at: lastEntry }) as FarmerListRow;

describe('quietLevel', () => {
  it('counts India calendar days, like the label beside it', () => {
    expect(quietLevel(daysAgo(0), NOW)).toBe('fresh');
    expect(quietLevel(daysAgo(2), NOW)).toBe('fresh');
    expect(quietLevel(daysAgo(3), NOW)).toBe('quiet');
    expect(quietLevel(daysAgo(6), NOW)).toBe('quiet');
    expect(quietLevel(daysAgo(7), NOW)).toBe('silent');
    expect(quietLevel(null, NOW)).toBe('silent');
  });
});

describe('farmerTotals', () => {
  it('fills the four cards', () => {
    const totals = farmerTotals(
      [
        farmer(daysAgo(1), '2026-11-02T00:00:00Z'),
        farmer(daysAgo(4)),
        farmer(daysAgo(9)),
        farmer(null),
      ],
      NOW,
    );
    expect(totals).toEqual({
      farmers: 4,
      joinedThisMonth: 1,
      growthPct: 33,
      loggedThisWeek: 2,
      quiet3to7: 1,
      quiet7plus: 2,
    });
  });

  it('handles no farmers', () => {
    expect(farmerTotals([], NOW).growthPct).toBe(0);
    expect(percentOf(0, 0)).toBe('0%');
  });
});

describe('farmsByOwner', () => {
  it('puts the oldest farm first', () => {
    const farm = (id: string, created_at: string) =>
      ({ id, owner_id: 'o', name: id, created_at }) as FarmListRow;
    const owners = farmsByOwner([
      farm('newer', '2026-05-01T00:00:00Z'),
      farm('older', '2026-01-01T00:00:00Z'),
    ]);
    expect(owners.get('o')?.map((row) => row.id)).toEqual(['older', 'newer']);
  });
});
