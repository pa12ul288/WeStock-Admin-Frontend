import { useMutation, useQuery } from '@tanstack/react-query';
import { useRefresh } from '../../app/queries';
import { PAGE_SIZE } from '../../components/Pagination';
import { dataSource } from '../../data';
import { DataError } from '../../data/errors';
import type { DataSource } from '../../data/source';
import type { UUID } from '../../data/types';
import { fetchAllRows } from '../../lib/csv';

export type EntryKind = 'milk' | 'feed';

const TABLES = { milk: 'milk_entries', feed: 'feed_entries' } as const;

/** One page of milk. Paging keeps the old rows up; another farm doesn't. */
export function useMilkList(farmId: UUID | undefined, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['milk-feed', 'milk', farmId ?? null, page],
    queryFn: () => dataSource.listMilk({ farm_id: farmId, page, pageSize: PAGE_SIZE }),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === (farmId ?? null) ? previous : undefined,
    enabled,
  });
}

/** One page of feed. */
export function useFeedList(farmId: UUID | undefined, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['milk-feed', 'feed', farmId ?? null, page],
    queryFn: () => dataSource.listFeed({ farm_id: farmId, page, pageSize: PAGE_SIZE }),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === (farmId ?? null) ? previous : undefined,
    enabled,
  });
}

export function useMilkDaily(from: string, to: string, farmId: UUID | undefined, enabled = true) {
  return useQuery({
    queryKey: ['milk-feed', 'milk-daily', from, to, farmId ?? null],
    queryFn: () => dataSource.milkDaily({ from, to, farm_id: farmId }),
    enabled,
  });
}

export function useFeedDaily(from: string, to: string, farmId: UUID | undefined, enabled = true) {
  return useQuery({
    queryKey: ['milk-feed', 'feed-daily', from, to, farmId ?? null],
    queryFn: () => dataSource.feedDaily({ from, to, farm_id: farmId }),
    enabled,
  });
}

/** How many farms logged milk in these days: the daily view has no farm column to count. */
export function useFarmsLogged(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['milk-feed', 'farms-logged', from, to],
    queryFn: async () => {
      const { rows } = await fetchAllRows((paging) => dataSource.listMilk({ from, to, ...paging }));
      return new Set(rows.map((row) => row.farm_id)).size;
    },
    enabled,
  });
}

/** Which entries staff added: a row in the log, as "Fixed by staff" is, because rows don't say. */
export function useStaffAdded(kind: EntryKind) {
  return useQuery({
    queryKey: ['milk-feed', 'staff-added', kind],
    queryFn: async () => {
      const entries = await dataSource.listAudit({
        table_name: TABLES[kind],
        action: 'insert',
        limit: 500,
      });
      return new Set(entries.map((entry) => entry.record_id));
    },
  });
}

/** Refreshes after a save, and after a record turns out to be gone so the list stops showing it. */
function useRefreshAfter() {
  const refresh = useRefresh();
  return (_data: unknown, error: unknown) => {
    if (error instanceof DataError && error.code !== 'not_found') return undefined;
    return refresh();
  };
}

export function useCreateMilk() {
  const onSettled = useRefreshAfter();
  return useMutation({
    mutationFn: (values: Parameters<DataSource['createMilk']>[0]) => dataSource.createMilk(values),
    onSettled,
  });
}

export function useCreateFeed() {
  const onSettled = useRefreshAfter();
  return useMutation({
    mutationFn: (values: Parameters<DataSource['createFeed']>[0]) => dataSource.createFeed(values),
    onSettled,
  });
}

export function useFixMilk() {
  const onSettled = useRefreshAfter();
  return useMutation({
    mutationFn: ({
      id,
      values,
      reason,
    }: {
      id: UUID;
      values: Parameters<DataSource['fixMilk']>[1];
      reason: string;
    }) => dataSource.fixMilk(id, values, reason),
    onSettled,
  });
}

export function useFixFeed() {
  const onSettled = useRefreshAfter();
  return useMutation({
    mutationFn: ({
      id,
      values,
      reason,
    }: {
      id: UUID;
      values: Parameters<DataSource['fixFeed']>[1];
      reason: string;
    }) => dataSource.fixFeed(id, values, reason),
    onSettled,
  });
}

export function useDeleteEntry() {
  const onSettled = useRefreshAfter();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: EntryKind; id: UUID }) =>
      dataSource.deleteEntry(TABLES[kind], id),
    onSettled,
  });
}
