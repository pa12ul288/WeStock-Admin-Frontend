/**
 * Stable ids of seed records. Every seed id is UUID-shaped: an 8-digit prefix for the table, then a
 * sequence number, so ids don't depend on the date or on how many rows the generator makes.
 * This file has no imports, so e2e specs can use it to link to featured records.
 */
export const ID_PREFIX = {
  profile: 'aa000000',
  farm: 'fa000000',
  shed: 'ab000000',
  animal: 'a0000000',
  milk: 'c0000000',
  feed: 'cf000000',
  vaccination: 'ac000000',
  health: 'ae000000',
  cycle: 'ad000000',
  device: 'de000000',
  staff: 'ba000000',
} as const;

export function seedId(kind: keyof typeof ID_PREFIX, n: number): string {
  return `${ID_PREFIX[kind]}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export const FEATURED = {
  farms: {
    shreeGanesh: seedId('farm', 1),
    girGauShala: seedId('farm', 2),
    periyar: seedId('farm', 3),
    kaveri: seedId('farm', 4),
    yadav: seedId('farm', 5),
    singh: seedId('farm', 6),
    lakshmi: seedId('farm', 7),
  },
  owners: {
    ramesh: seedId('profile', 1),
    sunita: seedId('profile', 2),
    joseph: seedId('profile', 3),
    murugan: seedId('profile', 4),
    rajendra: seedId('profile', 5),
    deepak: seedId('profile', 6),
    lakshmi: seedId('profile', 7),
  },
  animals: {
    gauri: seedId('animal', 1),
    lakshmi: seedId('animal', 2),
    ganga: seedId('animal', 3),
    kamla: seedId('animal', 4),
    shanti: seedId('animal', 5),
    bhuri: seedId('animal', 6),
    moti: seedId('animal', 7),
    ammini: seedId('animal', 8),
    neeli: seedId('animal', 9),
    kuttan: seedId('animal', 10),
    shyama: seedId('animal', 11),
  },
  staff: {
    anjali: seedId('staff', 1),
    priya: seedId('staff', 2),
    rahul: seedId('staff', 3),
    fatima: seedId('staff', 4),
    vikram: seedId('staff', 5),
  },
  /** Yadav Dairy, 04 Shyama, yesterday evening: 75.0 L that should be 7.5 L. */
  milk: { yadavWrongEntry: seedId('milk', 1) },
} as const;
