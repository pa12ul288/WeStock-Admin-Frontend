import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { dataSource } from '../../data';
import type { FarmListRow, FarmerListRow, Lang, UUID } from '../../data/types';
import { fetchAllRows } from '../../lib/csv';
import { indiaDay, shiftDay } from '../../lib/format';
import { PAGE_SIZE } from '../../components/Pagination';
import { farmsByOwner } from './helpers';

export interface FarmerFilters {
  q?: string;
  state?: string;
  language?: Lang;
}
export interface FarmFilters {
  q?: string;
  state?: string;
}

export const fetchAllFarmers = (filters: FarmerFilters = {}) =>
  fetchAllRows<FarmerListRow>((paging) => dataSource.listFarmers({ ...filters, ...paging }));

export const fetchAllFarms = (filters: FarmFilters = {}) =>
  fetchAllRows<FarmListRow>((paging) => dataSource.listFarms({ ...filters, ...paging }));

export function useFarmerList(filters: FarmerFilters, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['farmers', 'list', filters, page],
    queryFn: () => dataSource.listFarmers({ ...filters, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useFarmList(filters: FarmFilters, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['farms', 'list', filters, page],
    queryFn: () => dataSource.listFarms({ ...filters, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Every farmer, for the totals cards: the contract has no totals call for this screen. */
export function useAllFarmers() {
  return useQuery({
    queryKey: ['farmers', 'all'],
    queryFn: async () => (await fetchAllFarmers()).rows,
  });
}

/** Every farm by owner: the farmer rows name the first farm, and open it. */
export function useAllFarms() {
  const query = useQuery({
    queryKey: ['farms', 'all'],
    queryFn: async () => (await fetchAllFarms()).rows,
  });
  const byOwner = useMemo(() => farmsByOwner(query.data ?? []), [query.data]);
  return { ...query, byOwner };
}

/** Litres per day over the 7 finished days the list's total covers, for the farms on this page. */
export function useMilkSparks(farmIds: readonly UUID[]): Map<UUID, number[]> {
  const to = shiftDay(indiaDay(), -1);
  const from = shiftDay(to, -6);
  return useQueries({
    queries: farmIds.map((farmId) => ({
      queryKey: ['farms', 'spark', farmId, to],
      queryFn: async () => {
        const rows = await dataSource.milkDaily({ from, to, farm_id: farmId });
        const days = Array.from({ length: 7 }, (_, i) => shiftDay(from, i));
        return days.map((day) =>
          rows.filter((row) => row.day === day).reduce((sum, row) => sum + row.litres, 0),
        );
      },
      staleTime: 60_000,
    })),
    combine: (results) => {
      const sparks = new Map<UUID, number[]>();
      results.forEach((result, index) => {
        const farmId = farmIds[index];
        if (farmId && result.data) sparks.set(farmId, result.data);
      });
      return sparks;
    },
  });
}
