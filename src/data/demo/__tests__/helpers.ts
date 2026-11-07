import type { DataSource } from '../../source';
import { createDemoAdapter } from '../adapter';
import { generateSeed, type SeedData } from '../seed';
import { createDemoStore, type DemoStore } from '../store';

/** A fixed moment, so tests don't depend on the clock: 05 Nov 2026, 15:30 in India. */
export const NOW = Date.parse('2026-11-05T10:00:00Z');
export const TODAY = '2026-11-05';

// Generating the seed takes a moment and rows are never changed in place, so tests share one.
let shared: SeedData | null = null;
export function sharedSeed(): SeedData {
  shared ??= generateSeed(NOW);
  return shared;
}

export function newStore(): DemoStore {
  return createDemoStore({ storage: window.localStorage, seed: sharedSeed });
}

export function newAdapter(store: DemoStore = newStore()): DataSource {
  return createDemoAdapter(store, { latency: [0, 0] });
}

export const EMAILS = {
  super_admin: 'anjali@brainwired.demo',
  support: 'priya@brainwired.demo',
  viewer: 'fatima@brainwired.demo',
} as const;

export async function signedIn(role: keyof typeof EMAILS, store?: DemoStore): Promise<DataSource> {
  const adapter = newAdapter(store);
  await adapter.auth.signIn(EMAILS[role], 'password');
  return adapter;
}
