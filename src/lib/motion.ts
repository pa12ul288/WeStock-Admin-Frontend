import { useSyncExternalStore } from 'react';
import type { gsap as Gsap } from 'gsap';

/**
 * Shared motion rules for both animation libraries.
 *
 * - Framer Motion animates inner elements (hover, press, counters, dialogs, popovers, toasts).
 * - GSAP animates wrappers and layout containers (load sequence, sidebar, page transitions,
 *   chart reveals). The two never drive the same CSS property on the same element.
 * - With `prefers-reduced-motion`, nothing moves: states switch at once and counters show their
 *   final value immediately. Where there is no `matchMedia` (unit tests), motion is off too.
 *
 * The numbers below mirror the motion tokens in `src/styles/tokens.css`.
 */

export const DURATION = { fast: 0.15, base: 0.24, slow: 0.4 } as const;
/** The same curves as `--ease-out` and `--ease-in-out`. */
type Bezier = [number, number, number, number];
export const EASE: { out: Bezier; inOut: Bezier } = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
};
export const GSAP_EASE = { out: 'power3.out', inOut: 'power2.inOut' } as const;
/** Gap between staggered items, and the most items that stagger (the rest appear with the last). */
export const STAGGER = 0.06;
export const STAGGER_MAX = 8;

const QUERY = '(prefers-reduced-motion: reduce)';

function mediaQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : null;
}

/** True when motion should be skipped. Safe to call outside React. */
export function reducedMotionNow(): boolean {
  return mediaQuery()?.matches ?? true;
}

function subscribe(onChange: () => void): () => void {
  const query = mediaQuery();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/** True when the person asked for less motion (or the environment can't tell). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reducedMotionNow, () => true);
}

// ---- GSAP, loaded on demand ---------------------------------------------------------------

let gsapInstance: typeof Gsap | null = null;
let gsapLoading: Promise<typeof Gsap> | null = null;

/** Starts loading GSAP (its own chunk). Safe to call many times. */
export function loadGsap(): Promise<typeof Gsap> {
  gsapLoading ??= import('gsap').then((module) => {
    gsapInstance = module.gsap;
    return module.gsap;
  });
  return gsapLoading;
}

/** GSAP if it has loaded, otherwise null: callers then show the final state and skip motion. */
export function getGsap(): typeof Gsap | null {
  return gsapInstance;
}

/**
 * Runs `setup` inside a `gsap.context` scoped to `scope` and returns the cleanup that reverts
 * every tween and inline style it made. Returns a no-op when motion is off or GSAP isn't loaded.
 */
export function runGsap(scope: Element | null, setup: (gsap: typeof Gsap) => void): () => void {
  const gsap = getGsap();
  if (!gsap || !scope || reducedMotionNow()) return () => undefined;
  const context = gsap.context(() => setup(gsap), scope);
  return () => context.revert();
}

// ---- Entry sequence timing ----------------------------------------------------------------

let loadSequenceUntil = 0;
const LOAD_WINDOW_MS = 1600;

/** Called once when the app shell first appears: pieces that mount now follow the load sequence. */
export function markLoadSequence(): void {
  loadSequenceUntil = performance.now() + LOAD_WINDOW_MS;
}

/** When a piece of a page should start, in seconds: later during the first load, sooner on a route change. */
export function entryDelay(slot: 'kpi' | 'chart' | 'rows'): number {
  const loading = performance.now() < loadSequenceUntil;
  const delays = loading
    ? { kpi: 0.38, chart: 0.62, rows: 0.8 }
    : { kpi: 0.05, chart: 0.12, rows: 0.18 };
  return delays[slot];
}
