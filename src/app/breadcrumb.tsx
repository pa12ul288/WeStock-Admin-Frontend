import { createContext, useContext, useEffect } from 'react';
import { useMatches } from 'react-router-dom';

export type NavKey =
  'overview' | 'farmers' | 'livestock' | 'reproduction' | 'milk' | 'health' | 'analytics' | 'staff';

/** Set on each route in router.tsx: what the top bar shows and which sidebar item is active. */
export interface ShellHandle {
  crumb: string;
  page: string;
  nav: NavKey | null;
}

function isShellHandle(handle: unknown): handle is ShellHandle {
  return typeof handle === 'object' && handle !== null && 'crumb' in handle;
}

export function useShellHandle(): ShellHandle | null {
  const handles = useMatches().map((match) => match.handle);
  return handles.filter(isShellHandle).at(-1) ?? null;
}

export const BreadcrumbContext = createContext<(page: string | null) => void>(() => undefined);

/** For record pages: replaces the route's page name, e.g. with the farm's name once it has loaded. */
export function useBreadcrumbPage(page: string | null | undefined): void {
  const setPage = useContext(BreadcrumbContext);
  useEffect(() => {
    setPage(page ?? null);
    return () => setPage(null);
  }, [page, setPage]);
}
