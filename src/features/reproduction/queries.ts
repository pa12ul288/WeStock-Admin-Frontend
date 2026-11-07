import { useMutation, useQuery } from '@tanstack/react-query';
import { useRefresh } from '../../app/queries';
import { PAGE_SIZE } from '../../components/Pagination';
import { dataSource } from '../../data';
import type { DataSource } from '../../data/source';
import type { UUID } from '../../data/types';
import { fetchAllRows } from '../../lib/csv';
import type { Stage } from './helpers';

/** One page of a stage's table. Paging keeps the old rows up; another stage or farm doesn't. */
export function useCycleList(status: Stage, farmId: UUID | undefined, page: number) {
  return useQuery({
    queryKey: ['cycles', 'list', status, farmId ?? null, page],
    queryFn: () => dataSource.listCycles({ status, farm_id: farmId, page, pageSize: PAGE_SIZE }),
    placeholderData: (previous, query) =>
      query?.queryKey[2] === status && query.queryKey[3] === (farmId ?? null)
        ? previous
        : undefined,
  });
}

/** Every cycle at a stage: the contract has no totals call, and the cards count these. */
export function useAllCycles(status: Stage, farmId: UUID | undefined) {
  return useQuery({
    queryKey: ['cycles', 'all', status, farmId ?? null],
    queryFn: async () =>
      (
        await fetchAllRows((paging) =>
          dataSource.listCycles({ status, farm_id: farmId, ...paging }),
        )
      ).rows,
  });
}

/** Who added which record: a manual cycle in the log came from staff, otherwise from the farmer. */
export function useCycleLog() {
  return useQuery({
    queryKey: ['cycles', 'log'],
    queryFn: () => dataSource.listAudit({ table_name: 'reproduction_cycles', limit: 500 }),
  });
}

/** Each animal's species: a cycle row doesn't carry it, and the gestation line names it. */
export function useAnimalSpecies(enabled: boolean) {
  return useQuery({
    queryKey: ['animals', 'species-by-animal'],
    queryFn: async () => {
      const { rows } = await fetchAllRows((paging) => dataSource.listAnimals(paging));
      return new Map(rows.map((row) => [row.id, row.species_id]));
    },
    enabled,
  });
}

/** The active animals on a farm, for the Add cycle dialog. */
export function useFarmAnimals(farmId: UUID) {
  return useQuery({
    queryKey: ['animals', 'on-farm', farmId],
    queryFn: async () =>
      (
        await fetchAllRows((paging) =>
          dataSource.listAnimals({ farm_id: farmId, status: 'active', ...paging }),
        )
      ).rows,
    enabled: farmId !== '',
  });
}

export function useCreateCycle() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (values: Parameters<DataSource['createCycle']>[0]) =>
      dataSource.createCycle(values),
    onSuccess: refresh,
  });
}

export function useSetVerified() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, verified }: { id: UUID; verified: boolean }) =>
      dataSource.setInseminationVerified(id, verified),
    onSuccess: refresh,
  });
}
