import { useMutation, useQuery } from '@tanstack/react-query';
import { useRefresh } from '../../app/queries';
import { dataSource } from '../../data';
import type { DataSource } from '../../data/source';
import type { AnimalListRow, HealthStatus, UUID } from '../../data/types';
import { fetchAllRows } from '../../lib/csv';
import { indiaDay } from '../../lib/format';
import { isNotFound } from '../farm/queries';

const animalKey = (id: UUID) => ['animal', id] as const;

export function useAnimal(id: UUID) {
  return useQuery({
    queryKey: animalKey(id),
    queryFn: () => dataSource.getAnimal(id),
    retry: (count, error) => !isNotFound(error) && count < 2,
  });
}

/**
 * Recent log rows for a table. The contract can't ask for one record's rows, so this reads the
 * newest and the page picks out its record: who changed the animal, and what an undo goes back to.
 */
export function useTableLog(table: 'animals' | 'vaccinations' | 'health_events') {
  return useQuery({
    queryKey: ['animal-log', table],
    queryFn: () => dataSource.listAudit({ table_name: table, limit: 500 }),
  });
}

/** 90 days: the most the contract's series goes back, for the lactation total. */
export function useLongMilk(animal: AnimalListRow, enabled: boolean) {
  return useQuery({
    queryKey: [...animalKey(animal.id), 'milk-90'],
    queryFn: async () => (await dataSource.analyticsSeries(animal.farm_id, animal.id, 90)).milk,
    enabled,
  });
}

/** Today's entries on the farm: the page takes this animal's, split by session. */
export function useFarmMilkToday(farmId: UUID) {
  const day = indiaDay();
  return useQuery({
    queryKey: ['animal-farm-milk', farmId, day],
    queryFn: async () =>
      (
        await fetchAllRows((paging) =>
          dataSource.listMilk({ farm_id: farmId, from: day, to: day, ...paging }),
        )
      ).rows,
  });
}

export function useShedToday(animal: AnimalListRow) {
  const day = indiaDay();
  return useQuery({
    queryKey: ['animal-shed', animal.farm_id, animal.shed_id, day],
    queryFn: () => dataSource.environmentDay(animal.farm_id, animal.shed_id, day),
    enabled: animal.hardware_tag_id !== null && animal.shed_id !== null,
  });
}

export function useUpdateAnimal(id: UUID) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      patch,
      note,
    }: {
      patch: Parameters<DataSource['updateAnimal']>[1];
      note?: string;
    }) => dataSource.updateAnimal(id, patch, note),
    onSuccess: refresh,
  });
}

export function useAddVaccination(animal: AnimalListRow) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({
      vaccine_name,
      due_date,
      given,
    }: {
      vaccine_name: string;
      due_date: string;
      given: boolean;
    }) => {
      const row = await dataSource.createVaccination({
        farm_id: animal.farm_id,
        animal_id: animal.id,
        vaccine_name,
        due_date,
      });
      return given ? dataSource.setVaccinationDone(row.id, indiaDay()) : row;
    },
    onSuccess: refresh,
  });
}

export function useSetVaccinationDone() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, done }: { id: UUID; done: boolean }) =>
      dataSource.setVaccinationDone(id, done ? indiaDay() : null),
    onSuccess: refresh,
  });
}

export function useAddHealthEvent(animal: AnimalListRow) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (values: { title: string; status: HealthStatus; notes?: string }) =>
      dataSource.createHealthEvent({
        farm_id: animal.farm_id,
        animal_id: animal.id,
        ...values,
      }),
    onSuccess: refresh,
  });
}

export function useSetHealthStatus() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, status }: { id: UUID; status: HealthStatus }) =>
      dataSource.setHealthStatus(id, status),
    onSuccess: refresh,
  });
}
