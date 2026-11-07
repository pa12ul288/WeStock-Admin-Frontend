import type { PillTone } from '../../components/StatusPill';
import type {
  AnimalListRow,
  ConnectionState,
  HealthEvent,
  HealthStatus,
  SpeciesCategory,
} from '../../data/types';
import { indiaDay, shiftDay } from '../../lib/format';
import { formatAadhaar, formatShed } from '../../lib/labels';

export type BreedingFilter = 'heat' | 'inseminated' | 'pregnant' | 'may_deliver';
export type CategoryTab = 'all' | SpeciesCategory;

export const CATEGORY_TABS: readonly { value: CategoryTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'large_ruminant', label: 'Large ruminants' },
  { value: 'small_ruminant', label: 'Small ruminants' },
  { value: 'poultry', label: 'Poultry' },
  { value: 'swine', label: 'Swine' },
  { value: 'equine', label: 'Equine' },
  { value: 'other', label: 'Other' },
];

export const COLLAR_OPTIONS: readonly { value: ConnectionState; label: string }[] = [
  { value: 'temperature_high', label: 'Temperature high' },
  { value: 'cannot_connect', label: 'Cannot connect' },
  { value: 'normal', label: 'Normal' },
  { value: 'no_hardware', label: 'No collar' },
];

export const BREEDING_LABELS: Record<BreedingFilter, string> = {
  heat: 'In heat',
  inseminated: 'Inseminated',
  pregnant: 'Pregnant',
  may_deliver: 'May deliver',
};

export const STATUS_LABELS = { active: 'Active', sold: 'Sold', deceased: 'Deceased' } as const;

/** The same window the farm page's "may deliver in 30 days" uses. */
const MAY_DELIVER_DAYS = 30;

export function mayDeliver(due: string | null | undefined, today = indiaDay()): boolean {
  return Boolean(due) && (due as string) <= shiftDay(today, MAY_DELIVER_DAYS);
}

/** The animal's stage for its pill. Late pregnancies say "May deliver", as in the design. */
export function breedingStage(
  status: AnimalListRow['breeding_status'],
  due: string | null | undefined,
  today = indiaDay(),
): BreedingFilter | null {
  if (status === 'pregnant' && mayDeliver(due, today)) return 'may_deliver';
  return status;
}

const SEVERITY: readonly HealthStatus[] = ['sick', 'detected', 'condition'];

/** The most serious open issue for each animal: the list row has only a count. */
export function worstOpenHealth(
  events: readonly Pick<HealthEvent, 'animal_id' | 'status'>[],
): Map<string, HealthStatus> {
  const worst = new Map<string, HealthStatus>();
  for (const { animal_id: animal, status } of events) {
    const known = worst.get(animal);
    if (!known || SEVERITY.indexOf(status) < SEVERITY.indexOf(known)) worst.set(animal, status);
  }
  return worst;
}

type CollarFields = Pick<AnimalListRow, 'connection_state' | 'last_temp_c'>;

export function collarPill(row: CollarFields): { tone: PillTone; text: string } | null {
  const temperature = row.last_temp_c === null ? '—' : `${row.last_temp_c.toFixed(1)} °C`;
  switch (row.connection_state) {
    case 'no_hardware':
      return null;
    case 'cannot_connect':
      return { tone: 'red', text: 'Offline' };
    case 'temperature_high':
      return { tone: 'amber', text: temperature };
    default:
      return { tone: 'green', text: temperature };
  }
}

/** The CSV's collar cell: state and reading, in words. */
export function collarText(row: CollarFields): string {
  const label = COLLAR_OPTIONS.find((option) => option.value === row.connection_state)?.label ?? '';
  const pill = collarPill(row);
  return pill && row.connection_state !== 'cannot_connect' ? `${label} · ${pill.text}` : label;
}

export const aadhaarNote = (digits: string | null) =>
  digits ? `PA ${formatAadhaar(digits)}` : 'No Pashu Aadhaar';

/** The line under the farm: the shed, or for an animal no longer here, what happened to it. */
export function shedNote(row: Pick<AnimalListRow, 'status' | 'shed_code' | 'shed_name'>): string {
  if (row.status !== 'active') return STATUS_LABELS[row.status];
  return formatShed({ code: row.shed_code, name: row.shed_name ?? '' }) || 'Not in a shed';
}
