import type { FarmListRow, FarmerListRow, UUID } from '../../data/types';
import { daysSince, indiaDay } from '../../lib/format';

export interface FarmerTotals {
  farmers: number;
  joinedThisMonth: number;
  /** Growth from this month's sign-ups: joined this month against everyone before them. */
  growthPct: number;
  loggedThisWeek: number;
  quiet3to7: number;
  quiet7plus: number;
}

export type Quiet = 'fresh' | 'quiet' | 'silent';

/** How long since a farmer's last entry: nothing for 3 to 7 days is quiet, 7 or more is silent. */
export function quietLevel(lastEntryAt: string | null, now: number = Date.now()): Quiet {
  if (lastEntryAt === null) return 'silent';
  const days = daysSince(lastEntryAt, now);
  if (days >= 7) return 'silent';
  return days >= 3 ? 'quiet' : 'fresh';
}

export function farmerTotals(
  rows: readonly FarmerListRow[],
  now: number = Date.now(),
): FarmerTotals {
  const month = indiaDay(now).slice(0, 7);
  const totals: FarmerTotals = {
    farmers: rows.length,
    joinedThisMonth: 0,
    growthPct: 0,
    loggedThisWeek: 0,
    quiet3to7: 0,
    quiet7plus: 0,
  };
  for (const row of rows) {
    if (indiaDay(row.joined_at).slice(0, 7) === month) totals.joinedThisMonth++;
    const level = quietLevel(row.last_entry_at, now);
    if (level !== 'silent') totals.loggedThisWeek++;
    if (level === 'quiet') totals.quiet3to7++;
    if (level === 'silent') totals.quiet7plus++;
  }
  const before = totals.farmers - totals.joinedThisMonth;
  totals.growthPct = before > 0 ? Math.round((totals.joinedThisMonth / before) * 100) : 0;
  return totals;
}

/** Each owner's farms, oldest first: the first one is where a farmer's row opens. */
export function farmsByOwner(farms: readonly FarmListRow[]): Map<UUID, FarmListRow[]> {
  const owners = new Map<UUID, FarmListRow[]>();
  for (const farm of farms) {
    owners.set(farm.owner_id, [...(owners.get(farm.owner_id) ?? []), farm]);
  }
  for (const list of owners.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name));
  }
  return owners;
}

export function percentOf(part: number, whole: number): string {
  return `${whole > 0 ? Math.round((part / whole) * 100) : 0}%`;
}
