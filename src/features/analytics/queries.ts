import { useQuery } from '@tanstack/react-query';
import { dataSource } from '../../data';
import type { EnvironmentReading, FeedDaily, ISODate, UUID } from '../../data/types';
import { fetchAllRows } from '../../lib/csv';
import { indiaDay, shiftDay } from '../../lib/format';
import { useFarm } from '../farm/queries';

export function useAnalyticsFarms() {
  return useQuery({
    queryKey: ['analytics-farms'],
    queryFn: async () => (await fetchAllRows((paging) => dataSource.listFarms(paging))).rows,
  });
}

/** The farm's own page data: its sheds, its fever line and whether it has a Blackbox. */
export function useAnalyticsFarm(farmId: UUID | undefined) {
  return useFarm(farmId ?? '', farmId !== undefined);
}

export function useAnalyticsAnimals(farmId: UUID | undefined) {
  return useQuery({
    queryKey: ['analytics-animals', farmId],
    enabled: farmId !== undefined,
    queryFn: async () =>
      (
        await fetchAllRows((paging) =>
          dataSource.listAnimals({ farm_id: farmId, status: 'active', ...paging }),
        )
      ).rows,
  });
}

/** 90 days, the most the contract goes back, so the 7 and 30 day views can compare with the period before. */
export function useAnalyticsSeries(farmId: UUID | undefined, animalId: UUID | null) {
  return useQuery({
    queryKey: ['analytics-series', farmId, animalId],
    enabled: farmId !== undefined,
    queryFn: () => dataSource.analyticsSeries(farmId as UUID, animalId, 90),
  });
}

/** Milking animals, from the farm's daily totals. Only for the whole farm. */
export function useAnalyticsMilkDaily(farmId: UUID | undefined, from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: ['analytics-milk-daily', farmId, from, to],
    enabled: farmId !== undefined,
    queryFn: () => dataSource.milkDaily({ farm_id: farmId, from, to }),
  });
}

/** Feed rows by type for the mix: the farm's daily totals, or one animal's entries. */
export function useAnalyticsFeedMix(
  farmId: UUID | undefined,
  animalId: UUID | null,
  from: ISODate,
  to: ISODate,
) {
  return useQuery({
    queryKey: ['analytics-feed-mix', farmId, animalId, from, to],
    enabled: farmId !== undefined,
    queryFn: async (): Promise<Pick<FeedDaily, 'feed_type' | 'kg'>[]> => {
      if (animalId === null) return dataSource.feedDaily({ farm_id: farmId, from, to });
      const { rows } = await fetchAllRows((paging) =>
        dataSource.listFeed({ farm_id: farmId, from, to, ...paging }),
      );
      return rows
        .filter((row) => row.animal_id === animalId)
        .map((row) => ({ feed_type: row.feed_type, kg: row.quantity_kg }));
    },
  });
}

export interface EnvironmentDays {
  /** Readings by India day: today and the 7 days before. */
  byDay: Map<ISODate, EnvironmentReading[]>;
  all: EnvironmentReading[];
}

/** Today and the 7 days before, for one shed (or the whole farm): the chosen day and the week's peaks. */
export function useEnvironmentDays(farmId: UUID | undefined, shedId: UUID | null, enabled = true) {
  const today = indiaDay();
  return useQuery({
    queryKey: ['analytics-environment', farmId, shedId, today],
    enabled: farmId !== undefined && enabled,
    queryFn: async (): Promise<EnvironmentDays> => {
      const days = Array.from({ length: 8 }, (_, index) => shiftDay(today, index - 7));
      const lists = await Promise.all(
        days.map((day) => dataSource.environmentDay(farmId as UUID, shedId, day)),
      );
      return {
        byDay: new Map(days.map((day, index) => [day, lists[index] ?? []])),
        all: lists.flat(),
      };
    },
  });
}
