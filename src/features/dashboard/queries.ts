import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dataSource } from '../../data';

export function useOverview(days: 7 | 30 | 90 = 30) {
  return useQuery({
    queryKey: ['overview', days],
    queryFn: () => dataSource.getOverview({ days }),
  });
}

/** The Dashboard's read: the bell's query, keeping the old period on screen while a new one loads. */
export function useDashboardOverview(days: 7 | 30 | 90) {
  return useQuery({
    queryKey: ['overview', days],
    queryFn: () => dataSource.getOverview({ days }),
    placeholderData: keepPreviousData,
  });
}
