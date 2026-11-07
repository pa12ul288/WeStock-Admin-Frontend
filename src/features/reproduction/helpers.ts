import type { PillTone } from '../../components/StatusPill';
import type { AnimalListRow, CycleRow, ReproductionCycle } from '../../data/types';
import { daysSince, formatDateTime, formatTime, indiaDay, shiftDay } from '../../lib/format';

export type Stage = 'heat' | 'inseminated' | 'pregnant';

export const STAGES: readonly Stage[] = ['heat', 'inseminated', 'pregnant'];

/** The tabs read as in the design; the URL keeps the stage's own name. */
export const STAGE_TABS: Record<Stage, string> = {
  heat: 'In heat',
  inseminated: 'To verify',
  pregnant: 'Pregnant & due',
};

export const STAGE_NOTES: Record<Stage, string> = {
  heat: 'The app asks the farmer to confirm each collar heat alert',
  inseminated: 'Check the tube number against the farmer’s slip photo',
  pregnant: '“May deliver” means due within 30 days',
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** The cards show golden periods ending this soon. */
const GOLDEN_WINDOW = 6 * HOUR;
const VERY_SOON = 30 * MINUTE;
const SOON = 2 * HOUR;

type Golden = Pick<ReproductionCycle, 'golden_start' | 'golden_end'>;

/** Open golden periods that end within 6 hours, the closest first. */
export function goldenNow<C extends Golden>(cycles: readonly C[], now: number): C[] {
  return cycles
    .filter((cycle) => {
      if (!cycle.golden_end) return false;
      const end = Date.parse(cycle.golden_end);
      return end > now && end <= now + GOLDEN_WINDOW;
    })
    .sort((a, b) => Date.parse(a.golden_end as string) - Date.parse(b.golden_end as string));
}

/** `15 min`, `1 h 40 min`, `8 h`. Rounds up, so it never says 0 while time is left. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(Math.ceil(ms / MINUTE), 1);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export type GoldenTone = 'urgent' | 'ok' | 'wait';

export interface Countdown {
  left: string;
  label: string;
  tone: GoldenTone;
  /** How much of the golden period has gone. */
  percent: number;
}

export function countdown(cycle: Golden, now: number): Countdown {
  const end = Date.parse(cycle.golden_end ?? '');
  const start = cycle.golden_start ? Date.parse(cycle.golden_start) : end;
  if (now < start) {
    return {
      left: formatDuration(start - now),
      label: 'until it starts',
      tone: 'wait',
      percent: 0,
    };
  }
  const remaining = end - now;
  const span = Math.max(end - start, 1);
  const percent = Math.min(100, Math.max(0, (1 - remaining / span) * 100));
  const left = formatDuration(remaining);
  if (remaining <= VERY_SOON) {
    return { left, label: 'left · ends very soon', tone: 'urgent', percent };
  }
  if (remaining <= SOON) return { left, label: 'left', tone: 'urgent', percent };
  return { left, label: 'left · on track', tone: 'ok', percent };
}

export interface HeatAnswer {
  tone: PillTone;
  /** The table's "Heat alert correct?" pill. */
  answer: string;
  /** The golden period card's pill. */
  card: string;
}

/** The app asks the farmer about collar alerts only; a heat somebody reported needs no answer. */
export function heatAnswer(
  cycle: Pick<ReproductionCycle, 'source' | 'heat_confirmed'>,
  reporter: string,
): HeatAnswer {
  if (cycle.source !== 'sensor') {
    return { tone: 'grey', answer: 'Not needed', card: `Entered by ${reporter.toLowerCase()}` };
  }
  if (cycle.heat_confirmed === true) {
    return { tone: 'green', answer: 'Yes', card: 'Farmer said yes' };
  }
  if (cycle.heat_confirmed === false) {
    return { tone: 'red', answer: 'No, false alert', card: 'Farmer said no' };
  }
  return { tone: 'amber', answer: 'Waiting', card: 'Waiting for farmer' };
}

/** `Today 02:10`, `Yesterday 19:05`, then `02 Nov · 19:05`. */
export function formatHeatStarted(at: string | null, now: number): string {
  if (!at) return '—';
  const days = daysSince(at, now);
  if (days === 0) return `Today ${formatTime(at)}`;
  if (days === 1) return `Yesterday ${formatTime(at)}`;
  return formatDateTime(at);
}

/** `04:10 – 14:10`, or `Closed` once it has passed. */
export function formatGoldenWindow(cycle: Golden, now: number): string {
  if (!cycle.golden_start || !cycle.golden_end) return '—';
  if (Date.parse(cycle.golden_end) <= now) return 'Closed';
  return `${formatTime(cycle.golden_start)} – ${formatTime(cycle.golden_end)}`;
}

export function dueText(daysLeft: number): string {
  if (daysLeft === 0) return 'today';
  if (daysLeft < 0) return `${-daysLeft} ${daysLeft === -1 ? 'day' : 'days'} late`;
  return `in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
}

export function dueThisWeek(due: string | null, today = indiaDay()): boolean {
  return due !== null && due <= shiftDay(today, 7);
}

export const animalLabel = (animal: CycleRow['animal']) =>
  animal.name ?? `Tag ${animal.tag_number}`;

type Pickable = Pick<AnimalListRow, 'id' | 'tag_number' | 'name' | 'gender'>;

/** What the Animal box offers: `11 Shanti`. */
export const animalOption = (animal: Pick<Pickable, 'tag_number' | 'name'>) =>
  animal.name ? `${animal.tag_number} ${animal.name}` : animal.tag_number;

/** The animal meant by "11 Shanti", "11" or "Shanti", if exactly one fits. Males have no cycles. */
export function findAnimal<A extends Pickable>(text: string, animals: readonly A[]): A | null {
  const wanted = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!wanted) return null;
  const options = animals.filter((animal) => animal.gender !== 'male');
  const exact = options.find((animal) => animalOption(animal).toLowerCase() === wanted);
  if (exact) return exact;
  const tag = options.filter((animal) => animal.tag_number.toLowerCase() === wanted);
  if (tag.length === 1) return tag[0] as A;
  const named = options.filter((animal) => animal.name?.toLowerCase() === wanted);
  return named.length === 1 ? (named[0] as A) : null;
}

/** A `datetime-local` value, read as India time like everything else on screen. */
export const whenToIso = (value: string) => new Date(`${value}:00+05:30`).toISOString();

export const whenNow = (now = Date.now()) => `${indiaDay(now)}T${formatTime(now)}`;
