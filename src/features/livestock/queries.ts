import { keepPreviousData, useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useRefresh } from '../../app/queries';
import { PAGE_SIZE } from '../../components/Pagination';
import { dataSource } from '../../data';
import type { DataSource } from '../../data/source';
import type {
  Animal,
  AnimalStatus,
  ConnectionState,
  SpeciesCategory,
  UUID,
} from '../../data/types';
import { fetchAllRows } from '../../lib/csv';
import { CATEGORY_TABS, mayDeliver, worstOpenHealth, type BreedingFilter } from './helpers';

export interface AnimalFilters {
  q?: string;
  farm_id?: UUID;
  category?: SpeciesCategory;
  connection_state?: ConnectionState;
  breeding?: BreedingFilter;
  status?: AnimalStatus;
}

export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: () => dataSource.species(),
    staleTime: Infinity,
  });
}

export function useCreateAnimal() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (values: Parameters<DataSource['createAnimal']>[0]): Promise<Animal> =>
      dataSource.createAnimal(values),
    onSuccess: refresh,
  });
}

/** When each pregnant animal is due. The list row doesn't carry it, and "May deliver" needs it. */
async function fetchDueDates(): Promise<Map<UUID, string | null>> {
  const { rows } = await fetchAllRows((paging) =>
    dataSource.listCycles({ status: 'pregnant', ...paging }),
  );
  return new Map(rows.map((cycle) => [cycle.animal_id, cycle.expected_delivery]));
}

export function useDueDates() {
  return useQuery({ queryKey: ['animals', 'due'], queryFn: fetchDueDates });
}

/** The most serious open issue per animal: the list row carries only how many are open. */
export function useOpenHealth() {
  return useQuery({
    queryKey: ['animals', 'open-health'],
    queryFn: async () => {
      const { rows } = await fetchAllRows((paging) =>
        dataSource.listHealthEvents({ open: true, ...paging }),
      );
      return worstOpenHealth(rows);
    },
  });
}

/** "May deliver" isn't a contract filter: this reads every pregnant animal and narrows them here. */
async function fetchMayDeliver(filters: Omit<AnimalFilters, 'breeding'>) {
  const [{ rows }, due] = await Promise.all([
    fetchAllRows((paging) =>
      dataSource.listAnimals({ ...filters, breeding_status: 'pregnant', ...paging }),
    ),
    fetchDueDates(),
  ]);
  return rows.filter((row) => mayDeliver(due.get(row.id)));
}

export async function fetchAllAnimals({ breeding, ...filters }: AnimalFilters) {
  if (breeding === 'may_deliver') return fetchMayDeliver(filters);
  const { rows } = await fetchAllRows((paging) =>
    dataSource.listAnimals({ ...filters, breeding_status: breeding, ...paging }),
  );
  return rows;
}

export function useAnimalList({ breeding, ...filters }: AnimalFilters, page: number) {
  return useQuery({
    queryKey: ['animals', 'list', filters, breeding, page],
    queryFn: async () => {
      if (breeding === 'may_deliver') {
        const rows = await fetchMayDeliver(filters);
        return {
          rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
          total: rows.length,
        };
      }
      return dataSource.listAnimals({
        ...filters,
        breeding_status: breeding,
        page,
        pageSize: PAGE_SIZE,
      });
    },
    placeholderData: keepPreviousData,
  });
}

/** The cards' totals for the chosen farm and each species group. Only those two filters apply. */
export function useAnimalTotals(farmId: UUID | undefined) {
  return useQueries({
    queries: CATEGORY_TABS.map(({ value }) => ({
      queryKey: ['animals', 'totals', farmId ?? null, value],
      queryFn: async () =>
        (
          await dataSource.listAnimals({
            farm_id: farmId,
            category: value === 'all' ? undefined : value,
            status: 'active',
            page: 1,
            pageSize: 1,
          })
        ).totals,
    })),
    combine: (results) => ({
      byTab: new Map(CATEGORY_TABS.map(({ value }, index) => [value, results[index]?.data])),
      isError: results.some((result) => result.isError),
    }),
  });
}
