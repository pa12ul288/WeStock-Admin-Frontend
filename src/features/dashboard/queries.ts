import { useQuery } from '@tanstack/react-query';
import { dataSource } from '../../data';

export function useOverview(days: 7 | 30 | 90 = 30) {
  return useQuery({
    queryKey: ['overview', days],
    queryFn: () => dataSource.getOverview({ days }),
  });
}
