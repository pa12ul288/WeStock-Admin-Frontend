import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { dataSource } from '../data';

/** After a write everything may have moved (lists, totals, the shell's counts), but not who's in. */
export function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'staff' });
}

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
