import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { dataSource } from '../data';

const searchOptions = (term: string) => ({
  queryKey: ['search', term],
  queryFn: () => dataSource.search(term),
  staleTime: 30_000,
});

export function useGlobalSearch(term: string) {
  return useQuery({
    ...searchOptions(term),
    enabled: term !== '',
    placeholderData: keepPreviousData,
  });
}

/** Fetches the hits for a term right now, for Enter pressed while typing. */
export function useSearchNow() {
  const queryClient = useQueryClient();
  return useCallback((term: string) => queryClient.fetchQuery(searchOptions(term)), [queryClient]);
}
