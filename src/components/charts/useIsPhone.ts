import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 900px)';

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function snapshot() {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/** True at the phone layout's width. For charts, which can't use a media query in CSS. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, snapshot);
}
