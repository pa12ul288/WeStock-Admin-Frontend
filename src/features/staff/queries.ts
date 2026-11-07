import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useRefresh } from '../../app/queries';
import { dataSource } from '../../data';
import type { DataSource } from '../../data/source';
import type {
  AdminStaff,
  Animal,
  AuditLogEntry,
  FeedEntry,
  HealthEvent,
  MilkEntry,
  ReproductionCycle,
  Shed,
  UUID,
  Vaccination,
} from '../../data/types';
import { fetchAllRows } from '../../lib/csv';
import { fetchAllFarms, useAllFarms } from '../farmers/queries';
import {
  emptyLookup,
  logKind,
  lookupNeeds,
  serverFilter,
  type AuditLookup,
  type LogKind,
  type LookupNeed,
} from './audit';

/** The log loads 50 rows at a time, with "Load more". */
export const LOG_PAGE = 50;
/** Reads every row that matches, for counts and the CSV: the contract has no count. */
const EVERYTHING = 1_000_000;

export interface LogFilters {
  staffId?: UUID;
  kind?: LogKind;
  since?: string;
}

const matches = (kind: LogKind | undefined) => (entry: AuditLogEntry) =>
  !kind || logKind(entry) === kind;

export function useStaffList() {
  return useQuery({
    queryKey: ['staff-list'],
    queryFn: () => dataSource.listStaff(),
  });
}

/**
 * One "page" of the log: the next 50 rows that match, read before `beforeId`. A kind the contract
 * can't filter on is narrowed here, reading on until 50 match or the log runs out.
 */
async function fetchLogPage(
  filters: LogFilters,
  beforeId: number | undefined,
): Promise<{ entries: AuditLogEntry[]; next: number | null }> {
  const keep = matches(filters.kind);
  const entries: AuditLogEntry[] = [];
  let cursor = beforeId;
  for (;;) {
    const batch = await dataSource.listAudit({
      ...serverFilter(filters.kind),
      staff_id: filters.staffId,
      since: filters.since,
      beforeId: cursor,
      limit: LOG_PAGE,
    });
    for (const [index, entry] of batch.entries()) {
      if (!keep(entry)) continue;
      entries.push(entry);
      if (entries.length === LOG_PAGE) {
        const more = index < batch.length - 1 || batch.length === LOG_PAGE;
        return { entries, next: more ? entry.id : null };
      }
    }
    const last = batch.at(-1);
    if (batch.length < LOG_PAGE || !last) return { entries, next: null };
    cursor = last.id;
  }
}

export function useActivityLog(filters: LogFilters) {
  return useInfiniteQuery({
    queryKey: ['audit', 'log', filters],
    queryFn: ({ pageParam }) => fetchLogPage(filters, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });
}

export const matchingLogOptions = (filters: LogFilters) => ({
  queryKey: ['audit', 'matching', filters],
  queryFn: async () =>
    (
      await dataSource.listAudit({
        ...serverFilter(filters.kind),
        staff_id: filters.staffId,
        since: filters.since,
        limit: EVERYTHING,
      })
    ).filter(matches(filters.kind)),
});

/** Every row the filters match: the "of N" count, and the CSV. */
export function useMatchingLog(filters: LogFilters) {
  return useQuery(matchingLogOptions(filters));
}

/** The week's rows, for the cards and the badge. */
export function useWeekLog(since: string | undefined) {
  return useQuery({
    queryKey: ['audit', 'week', since],
    queryFn: () => dataSource.listAudit({ since, limit: EVERYTHING }),
  });
}

// ---- reading what the rows point at ----

type NeedData =
  | { kind: 'animals'; rows: Pick<Animal, 'id' | 'tag_number' | 'name'>[] }
  | { kind: 'milk'; rows: MilkEntry[] }
  | { kind: 'feed'; rows: FeedEntry[] }
  | { kind: 'vaccinations'; rows: Vaccination[] }
  | { kind: 'health'; rows: HealthEvent[] }
  | { kind: 'cycles'; rows: ReproductionCycle[] }
  | { kind: 'farm'; sheds: Shed[]; people: [UUID, string][] };

async function fetchNeed(need: LookupNeed): Promise<NeedData> {
  const farm_id = need.farmId;
  switch (need.kind) {
    case 'animals':
      return {
        kind: 'animals',
        rows: (await fetchAllRows((paging) => dataSource.listAnimals({ farm_id, ...paging }))).rows,
      };
    case 'milk':
      return {
        kind: 'milk',
        rows: (
          await fetchAllRows((paging) =>
            dataSource.listMilk({ farm_id, from: need.from, ...paging }),
          )
        ).rows,
      };
    case 'feed':
      return {
        kind: 'feed',
        rows: (
          await fetchAllRows((paging) =>
            dataSource.listFeed({ farm_id, from: need.from, ...paging }),
          )
        ).rows,
      };
    case 'vaccinations':
      return {
        kind: 'vaccinations',
        rows: (await fetchAllRows((paging) => dataSource.listVaccinations({ farm_id, ...paging })))
          .rows,
      };
    case 'health':
      return {
        kind: 'health',
        rows: (await fetchAllRows((paging) => dataSource.listHealthEvents({ farm_id, ...paging })))
          .rows,
      };
    case 'cycles': {
      const stages = ['heat', 'inseminated', 'pregnant'] as const;
      const lists = await Promise.all(
        stages.map((status) =>
          fetchAllRows((paging) => dataSource.listCycles({ status, farm_id, ...paging })),
        ),
      );
      return { kind: 'cycles', rows: lists.flatMap((list) => list.rows) };
    }
    case 'farm': {
      try {
        const detail = await dataSource.getFarm(farm_id);
        return {
          kind: 'farm',
          sheds: detail.sheds,
          people: detail.members.map((m) => [m.user_id, m.profile.full_name ?? 'Member']),
        };
      } catch {
        // A deleted farm: its rows still read, with less detail.
        return { kind: 'farm', sheds: [], people: [] };
      }
    }
  }
}

const needOptions = (need: LookupNeed) => ({
  queryKey: ['audit', 'lookup', need.kind, need.farmId, need.from ?? null],
  queryFn: () => fetchNeed(need),
  staleTime: 60_000,
});

export function buildLookup(
  results: readonly (NeedData | undefined)[],
  farms: readonly { id: UUID; name: string }[],
  staff: readonly AdminStaff[],
): AuditLookup {
  const lookup = emptyLookup();
  for (const farm of farms) lookup.farms.set(farm.id, farm.name);
  for (const person of staff) lookup.staff.set(person.user_id, person);
  for (const data of results) {
    if (!data) continue;
    switch (data.kind) {
      case 'animals':
        for (const row of data.rows) lookup.animals.set(row.id, row);
        break;
      case 'milk':
        for (const row of data.rows) lookup.milk.set(row.id, row);
        break;
      case 'feed':
        for (const row of data.rows) lookup.feed.set(row.id, row);
        break;
      case 'vaccinations':
        for (const row of data.rows) lookup.vaccinations.set(row.id, row);
        break;
      case 'health':
        for (const row of data.rows) lookup.health.set(row.id, row);
        break;
      case 'cycles':
        for (const row of data.rows) lookup.cycles.set(row.id, row);
        break;
      case 'farm':
        for (const shed of data.sheds) lookup.sheds.set(shed.id, shed);
        for (const [id, name] of data.people) lookup.people.set(id, name);
        break;
    }
  }
  return lookup;
}

/**
 * What the given rows point at, so they read "Milk entry · 04 Shyama, evening" with the farm's
 * name. `ready` turns false while new records are still being read.
 */
export function useAuditLookup(entries: readonly AuditLogEntry[] | undefined) {
  const farms = useAllFarms();
  const staff = useStaffList();
  const needs = useMemo(() => lookupNeeds(entries ?? []), [entries]);
  const results = useQueries({ queries: needs.map(needOptions) });
  const pending = results.some((result) => result.isPending);
  const data = results.map((result) => result.data);
  const dataKey = results.map((result) => result.dataUpdatedAt).join('|');
  const lookup = useMemo(
    () => buildLookup(data, farms.data ?? [], staff.data ?? []),
    // `data` is a new array each render; its contents change only when a dataUpdatedAt does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataKey, farms.data, staff.data],
  );
  return {
    lookup,
    ready: !pending && farms.data !== undefined && staff.data !== undefined,
  };
}

/** The same lookup, read once, for the CSV of every matching row. */
export async function fetchLookup(
  queryClient: QueryClient,
  entries: readonly AuditLogEntry[],
): Promise<AuditLookup> {
  const [farms, staff, results] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: ['farms', 'all'],
      queryFn: async () => (await fetchAllFarms()).rows,
    }),
    queryClient.fetchQuery({ queryKey: ['staff-list'], queryFn: () => dataSource.listStaff() }),
    Promise.all(lookupNeeds(entries).map((need) => queryClient.fetchQuery(needOptions(need)))),
  ]);
  return buildLookup(results, farms, staff);
}

// ---- writes (super admin) ----

export function useInviteStaff() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (values: Parameters<DataSource['inviteStaff']>[0]) =>
      dataSource.inviteStaff(values),
    onSettled: refresh,
  });
}

export function useUpdateStaff() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      userId,
      patch,
    }: {
      userId: UUID;
      patch: Parameters<DataSource['updateStaff']>[1];
    }) => dataSource.updateStaff(userId, patch),
    onSettled: refresh,
  });
}
