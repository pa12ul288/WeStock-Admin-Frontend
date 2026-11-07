import { useMutation, useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useRefresh } from '../../app/queries';
import { dataSource } from '../../data';
import type { DataSource } from '../../data/source';
import type { UUID } from '../../data/types';
import { fetchAllRows } from '../../lib/csv';
import { useTableLog } from '../animal/queries';

/**
 * Everything on the page comes from these: the contract has no totals call, and a row marked today
 * stays in the list for its Undo, so given and resolved rows are read too.
 */
function useAllVaccinations(farmId: UUID | undefined, speciesId: string | undefined) {
  return useQuery({
    queryKey: ['vaccinations', 'all', farmId ?? null, speciesId ?? null],
    queryFn: async () =>
      (
        await fetchAllRows((paging) =>
          dataSource.listVaccinations({ farm_id: farmId, species_id: speciesId, ...paging }),
        )
      ).rows,
  });
}

function useAllHealth(farmId: UUID | undefined, speciesId: string | undefined) {
  return useQuery({
    queryKey: ['health', 'all', farmId ?? null, speciesId ?? null],
    queryFn: async () =>
      (
        await fetchAllRows((paging) =>
          dataSource.listHealthEvents({ farm_id: farmId, species_id: speciesId, ...paging }),
        )
      ).rows,
  });
}

/**
 * The lists and their logs, changing together. Whether a marked row is listed comes from the log, so
 * showing one before the other arrives would make the row vanish and come back. A change of filter
 * doesn't wait: its rows are new, and the page shows skeletons until they're in.
 */
export function useHealthLists(farmId: UUID | undefined, speciesId: string | undefined) {
  const vaccinations = useAllVaccinations(farmId, speciesId);
  const health = useAllHealth(farmId, speciesId);
  const vaccinationLog = useTableLog('vaccinations');
  const healthLog = useTableLog('health_events');

  const filters = `${farmId ?? ''}|${speciesId ?? ''}`;
  const latest = {
    filters,
    vaccinations: vaccinations.data,
    health: health.data,
    vaccinationLog: vaccinationLog.data,
    healthLog: healthLog.data,
  };
  const settled = ![vaccinations, health, vaccinationLog, healthLog].some((q) => q.isFetching);
  const held = useRef(latest);
  if (settled) held.current = latest;
  const shown = held.current.filters === filters ? held.current : null;

  return {
    vaccinations: shown?.vaccinations,
    health: shown?.health,
    vaccinationLog: shown?.vaccinationLog,
    healthLog: shown?.healthLog,
    vaccinationsFailed: vaccinations.isError,
    healthFailed: health.isError,
    retryVaccinations: () => void vaccinations.refetch(),
    retryHealth: () => void health.refetch(),
  };
}

export function useScheduleVaccination() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (values: Parameters<DataSource['scheduleVaccination']>[0]) =>
      dataSource.scheduleVaccination(values),
    onSuccess: refresh,
  });
}
