import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '../../data';
import { DataError } from '../../data/errors';
import type { Animal, MemberRole, Shed, UUID } from '../../data/types';
import type { DataSource } from '../../data/source';
import { fetchAllRows } from '../../lib/csv';
import { buildLatest, buildRecords } from './helpers';

const farmKey = (id: UUID) => ['farm', id] as const;

export function isNotFound(error: unknown): boolean {
  return error instanceof DataError && error.code === 'not_found';
}

export function useFarm(id: UUID, enabled = true) {
  return useQuery({
    queryKey: farmKey(id),
    queryFn: () => dataSource.getFarm(id),
    retry: (count, error) => !isNotFound(error) && count < 2,
    enabled,
  });
}

export function useSpecies() {
  return useQuery({
    queryKey: ['species'],
    queryFn: () => dataSource.species(),
    staleTime: Infinity,
  });
}

/** The counts and coming-up list that `getFarm` doesn't carry. */
export function useFarmRecords(id: UUID, enabled = true) {
  return useQuery({
    queryKey: [...farmKey(id), 'records'],
    enabled,
    queryFn: async () => {
      const [heat, pregnant, vaccinations, health] = await Promise.all([
        fetchAllRows((paging) => dataSource.listCycles({ status: 'heat', farm_id: id, ...paging })),
        fetchAllRows((paging) =>
          dataSource.listCycles({ status: 'pregnant', farm_id: id, ...paging }),
        ),
        fetchAllRows((paging) => dataSource.listVaccinations({ farm_id: id, ...paging })),
        fetchAllRows((paging) => dataSource.listHealthEvents({ farm_id: id, ...paging })),
      ]);
      return buildRecords(heat.rows, pregnant.rows, vaccinations.rows, health.rows);
    },
  });
}

/** Thirty days, so the week can be compared with the one before. */
export function useFarmMilk(id: UUID) {
  return useQuery({
    queryKey: [...farmKey(id), 'milk'],
    queryFn: async () => (await dataSource.analyticsSeries(id, null, 30)).milk,
  });
}

const LATEST_EACH = 6;

/** From the lists, not `FarmDetail.latest`: the table needs who entered each one. */
export function useFarmLatest(id: UUID, sheds: readonly Shed[]) {
  return useQuery({
    queryKey: [...farmKey(id), 'latest'],
    queryFn: async () => {
      const paging = { page: 1, pageSize: LATEST_EACH };
      const [milk, feed, health] = await Promise.all([
        dataSource.listMilk({ farm_id: id, ...paging }),
        dataSource.listFeed({ farm_id: id, ...paging }),
        dataSource.listHealthEvents({ farm_id: id, ...paging }),
      ]);
      return { milk: milk.rows, feed: feed.rows, health: health.rows };
    },
    select: (data) => buildLatest(data.milk, data.feed, data.health, sheds, LATEST_EACH),
  });
}

export function useFarmAnimals(id: UUID) {
  return useQuery({
    queryKey: [...farmKey(id), 'animals'],
    queryFn: async () =>
      (
        await fetchAllRows((paging) =>
          dataSource.listAnimals({ farm_id: id, status: 'active', ...paging }),
        )
      ).rows,
  });
}

/** Asks whether anyone has signed up with this number. Runs only on a whole number. */
export const profileQuery = (digits: string) => ({
  queryKey: ['profile-by-phone', digits],
  queryFn: () => dataSource.findProfileByPhone(`+91${digits}`),
});

export function useProfileByPhone(digits: string | null) {
  return useQuery({ ...profileQuery(digits ?? ''), enabled: digits !== null });
}

/** After a write everything may have moved (lists, totals, the shell's counts), but not who's in. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'staff' });
}

export function useUpdateFarm(id: UUID) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (patch: Parameters<DataSource['updateFarm']>[1]) =>
      dataSource.updateFarm(id, patch),
    onSuccess: refresh,
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

export function useSaveShed(farmId: UUID) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, code, name }: { id?: UUID; code: string; name: string }) =>
      id
        ? dataSource.updateShed(id, { code, name })
        : dataSource.createShed(farmId, { code, name }),
    onSuccess: refresh,
  });
}

export function useAddMember(farmId: UUID) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: UUID; role: MemberRole }) =>
      dataSource.addMember(farmId, userId, role),
    onSuccess: refresh,
  });
}

export function useSetMemberRole(farmId: UUID) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: UUID; role: MemberRole }) =>
      dataSource.setMemberRole(farmId, userId, role),
    onSuccess: refresh,
  });
}

export function useTransferFarm(farmId: UUID) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ userId, note }: { userId: UUID; note?: string }) =>
      dataSource.transferFarm(farmId, userId, note),
    onSuccess: refresh,
  });
}

export function useDeleteFarm(farmId: UUID) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: () => dataSource.deleteFarm(farmId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: farmKey(farmId) });
      void refresh();
    },
  });
}
