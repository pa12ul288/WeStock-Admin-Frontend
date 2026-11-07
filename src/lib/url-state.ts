import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlPatch = Record<string, string | number | null | undefined>;

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDirection;
}

export const PAGE_PARAM = 'page';

/**
 * The query string after a change. Empty values and values equal to their default leave the URL.
 * Any change other than `page` goes back to the first page, because the list has changed.
 */
export function applyUrlPatch(
  current: URLSearchParams,
  patch: UrlPatch,
  defaults: Record<string, string> = {},
  keepPage = false,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (!keepPage && !(PAGE_PARAM in patch)) next.delete(PAGE_PARAM);
  for (const [key, raw] of Object.entries(patch)) {
    const value = raw === null || raw === undefined ? '' : String(raw);
    if (value === '' || value === defaults[key]) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

/** `1` for anything that isn't a whole page number. */
export function parsePage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** `date-desc`, or the fallback when the value is missing or broken. */
export function parseSort(raw: string | null, fallback: SortState): SortState {
  const match = raw?.match(/^(.+)-(asc|desc)$/);
  return match ? { key: match[1] as string, dir: match[2] as SortDirection } : fallback;
}

interface SetOptions {
  /** Replace the current history entry rather than adding one (for typing, say). */
  replace?: boolean;
}

type Setter<K extends string> = (
  patch: Partial<Record<K, string | number | null>>,
  options?: SetOptions,
) => void;

/**
 * Filters, tabs and views kept in the URL query. `defaults` names the keys this screen reads;
 * a value at its default stays out of the URL.
 */
export function useUrlState<K extends string>(
  defaults: Record<K, string>,
): [Record<K, string>, Setter<K>] {
  const [params, setParams] = useSearchParams();
  const keys = Object.keys(defaults) as K[];
  const defaultsKey = JSON.stringify(defaults);
  const valuesKey = JSON.stringify(keys.map((key) => params.get(key) ?? defaults[key]));

  const values = useMemo(() => {
    const read = {} as Record<K, string>;
    for (const key of keys) read[key] = params.get(key) ?? defaults[key];
    return read;
    // The two keys hold everything read here, so this only changes when a value does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsKey, valuesKey]);

  const set = useCallback<Setter<K>>(
    (patch, options = {}) => {
      const fallback = JSON.parse(defaultsKey) as Record<string, string>;
      setParams((current) => applyUrlPatch(current, patch, fallback), {
        replace: options.replace,
      });
    },
    [setParams, defaultsKey],
  );

  return [values, set];
}

/** The current list page (1-based) from `?page=`. */
export function useUrlPage(): [number, (page: number) => void] {
  const [params, setParams] = useSearchParams();
  const setPage = useCallback(
    (page: number) => {
      setParams((current) => applyUrlPatch(current, { [PAGE_PARAM]: page }, { [PAGE_PARAM]: '1' }));
    },
    [setParams],
  );
  return [parsePage(params.get(PAGE_PARAM)), setPage];
}

/** The sort for a table from `?sort=date-desc`. The list stays on the current page. */
export function useUrlSort(fallback: SortState): [SortState, (sort: SortState) => void] {
  const [params, setParams] = useSearchParams();
  const { key, dir } = parseSort(params.get('sort'), fallback);
  const sort = useMemo(() => ({ key, dir }), [key, dir]);
  const setSort = useCallback(
    (next: SortState) => {
      const defaults = { sort: `${fallback.key}-${fallback.dir}` };
      setParams((current) =>
        applyUrlPatch(current, { sort: `${next.key}-${next.dir}` }, defaults, true),
      );
    },
    [setParams, fallback.key, fallback.dir],
  );
  return [sort, setSort];
}

/** A page past the end of a list that shrank: moves to the last real page instead of showing nothing. */
export function useLastPageGuard(pastTheEnd: boolean, lastPage: number): void {
  const [, setParams] = useSearchParams();
  useEffect(() => {
    if (!pastTheEnd) return;
    setParams((current) => applyUrlPatch(current, { [PAGE_PARAM]: lastPage }), { replace: true });
  }, [pastTheEnd, lastPage, setParams]);
}

/** Clears these keys and goes back to the first page: the "Clear filters" action. */
export function useClearUrlParams(keys: readonly string[]): () => void {
  const [, setParams] = useSearchParams();
  const joined = keys.join('\0');
  return useCallback(() => {
    const patch = Object.fromEntries(joined.split('\0').map((key) => [key, null]));
    setParams((current) => applyUrlPatch(current, patch));
  }, [joined, setParams]);
}
