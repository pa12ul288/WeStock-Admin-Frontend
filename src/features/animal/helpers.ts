import type { PillTone } from '../../components/StatusPill';
import type {
  AnalyticsSeries,
  AuditLogEntry,
  HealthEvent,
  MilkEntry,
  ReproductionCycle,
  Vaccination,
} from '../../data/types';
import { daysSince, formatDate, indiaDay, shiftDay } from '../../lib/format';

const DAY_MS = 86_400_000;

/** Whole days from one `YYYY-MM-DD` to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The vaccine's pill: said in words, soonest news first. */
export function vaccineState(
  v: Pick<Vaccination, 'due_date' | 'done_date'>,
  today = indiaDay(),
): { text: string; tone: PillTone } {
  if (v.done_date) return { text: 'Done', tone: 'green' };
  const days = daysBetween(today, v.due_date);
  if (days < 0) return { text: 'Overdue', tone: 'red' };
  if (days === 0) return { text: 'Due today', tone: 'amber' };
  if (days <= 7) return { text: `Due in ${days} ${days === 1 ? 'day' : 'days'}`, tone: 'amber' };
  return { text: 'Upcoming', tone: 'blue' };
}

/** Still to give, soonest first, then what's been given, latest first. */
export function sortVaccinations<V extends Pick<Vaccination, 'due_date' | 'done_date'>>(
  rows: readonly V[],
): V[] {
  return [...rows].sort((a, b) => {
    if (!a.done_date && !b.done_date) return a.due_date < b.due_date ? -1 : 1;
    if (!a.done_date || !b.done_date) return a.done_date ? 1 : -1;
    return a.done_date < b.done_date ? 1 : -1;
  });
}

interface Change {
  from: unknown;
  to: unknown;
}

function isChange(value: unknown): value is Change {
  return typeof value === 'object' && value !== null && 'from' in value && 'to' in value;
}

/** The latest logged change to one field of a record. `log` is newest first. */
export function lastChange(
  log: readonly AuditLogEntry[] | undefined,
  recordId: string,
  field: string,
): Change | null {
  for (const entry of log ?? []) {
    if (entry.action !== 'update' || entry.record_id !== recordId) continue;
    const change = entry.changes[field];
    if (isChange(change)) return change;
  }
  return null;
}

/** Who the log says added a record, if staff did. */
export function addedBy(
  log: readonly AuditLogEntry[] | undefined,
  recordId: string,
): string | null {
  const entry = log?.find((row) => row.action === 'insert' && row.record_id === recordId);
  return entry?.staff_name ?? null;
}

/** The newest update to a record. `log` is newest first. */
export function lastUpdate(
  log: readonly AuditLogEntry[] | undefined,
  recordId: string,
): AuditLogEntry | null {
  return log?.find((row) => row.action === 'update' && row.record_id === recordId) ?? null;
}

/** The date and note from the status dialog: there is no column for them, so the log's note has them. */
export function statusNote(
  status: 'sold' | 'deceased',
  date: string,
  note: string | undefined,
): string {
  const word = status === 'sold' ? 'Sold' : 'Deceased';
  const text = note?.trim();
  return `${word} on ${formatDate(date)}${text ? ` · ${text}` : ''}`;
}

/** What the log says about the animal's latest move to sold or deceased. */
export function statusChangeNote(
  log: readonly AuditLogEntry[] | undefined,
  recordId: string,
): string | null {
  const entry = log?.find(
    (row) => row.action === 'update' && row.record_id === recordId && isChange(row.changes.status),
  );
  return entry?.note ?? null;
}

export function healthSourceLabel(
  event: Pick<HealthEvent, 'id' | 'source'>,
  log: readonly AuditLogEntry[] | undefined,
): string {
  if (event.source === 'sensor') return 'Collar';
  if (event.source === 'gau') return 'Gau';
  return addedBy(log, event.id) ? 'Staff' : 'Farmer';
}

export interface CycleStep {
  label: string;
  detail: string;
  done: boolean;
}

function inGolden(cycle: ReproductionCycle): boolean {
  const { inseminated_at: at, golden_start: start, golden_end: end } = cycle;
  if (!at || !start || !end) return false;
  const ms = Date.parse(at);
  return ms >= Date.parse(start) && ms <= Date.parse(end);
}

export function goldenNote(cycle: ReproductionCycle): string {
  return inGolden(cycle) ? ' · in golden period' : '';
}

/** One cycle's timeline, from what it has on record. */
export function cycleSteps(cycle: ReproductionCycle): CycleStep[] {
  const steps: CycleStep[] = [];
  if (cycle.heat_started_at) {
    steps.push({
      label: 'Heat',
      detail: `${formatDate(cycle.heat_started_at)}${cycle.heat_confirmed ? ' · farmer confirmed' : ''}`,
      done: true,
    });
  }
  if (cycle.inseminated_at) {
    steps.push({
      label: 'Inseminated',
      detail: `${formatDate(cycle.inseminated_at)}${goldenNote(cycle)}`,
      done: true,
    });
  }
  if (cycle.pregnancy_confirmed_at) {
    steps.push({
      label: 'Pregnant',
      detail: `Confirmed ${formatDate(cycle.pregnancy_confirmed_at)}`,
      done: true,
    });
  }
  if (cycle.delivered_at) {
    steps.push({ label: 'Delivered', detail: formatDate(cycle.delivered_at), done: true });
  } else if (cycle.expected_delivery && cycle.status === 'pregnant') {
    steps.push({
      label: 'Delivery',
      detail: `Expected ${formatDate(cycle.expected_delivery)}`,
      done: false,
    });
  }
  return steps;
}

const CYCLE_ENDINGS: Partial<Record<ReproductionCycle['status'], string>> = {
  failed: ' · did not take',
  closed: ' · closed',
};

export function isOpenCycle(cycle: Pick<ReproductionCycle, 'status'>): boolean {
  return ['heat', 'inseminated', 'pregnant'].includes(cycle.status);
}

export function cycleTitle(cycle: ReproductionCycle): string {
  const ending = isOpenCycle(cycle) ? ' · now' : (CYCLE_ENDINGS[cycle.status] ?? '');
  return `Cycle ${cycle.cycle_no}${ending}`;
}

export interface Gestation {
  day: number;
  total: number;
  percent: number;
  confirmedPercent: number | null;
  daysLeft: number;
}

/** How far along a pregnancy is. Needs its insemination and due dates. */
export function gestation(cycle: ReproductionCycle, today = indiaDay()): Gestation | null {
  if (!cycle.inseminated_at || !cycle.expected_delivery) return null;
  const start = indiaDay(cycle.inseminated_at);
  const total = Math.max(daysBetween(start, cycle.expected_delivery), 1);
  const day = daysBetween(start, today);
  const toPercent = (value: number) => Math.min(100, Math.max(0, (value / total) * 100));
  return {
    day,
    total,
    percent: toPercent(day),
    confirmedPercent: cycle.pregnancy_confirmed_at
      ? toPercent(daysBetween(start, indiaDay(cycle.pregnancy_confirmed_at)))
      : null,
    daysLeft: daysBetween(today, cycle.expected_delivery),
  };
}

export function pregnancyTotals(cycles: readonly ReproductionCycle[]) {
  const delivered = cycles.filter((cycle) => cycle.delivered_at !== null);
  const lastCalved = delivered
    .map((cycle) => cycle.delivered_at as string)
    .sort()
    .at(-1);
  return {
    pregnancies: cycles.filter(
      (cycle) =>
        cycle.pregnancy_confirmed_at !== null ||
        cycle.status === 'pregnant' ||
        cycle.status === 'delivered',
    ).length,
    delivered: delivered.length,
    lastCalved: lastCalved ?? null,
    daysInMilk: lastCalved ? daysSince(lastCalved) : null,
  };
}

export interface MilkBar {
  day: string;
  label: string;
  litres: number;
}

const LABEL_EVERY = 10;

/** The last 30 days, with a bar (even an empty one) for each. Labels every 10 days, then "Today". */
export function milkBars(
  milk: AnalyticsSeries['milk'],
  today: string,
  dayLabel: (day: string) => string,
): MilkBar[] {
  const litres = new Map(milk.map((row) => [row.day, row.litres]));
  return Array.from({ length: 30 }, (_, index) => {
    const day = shiftDay(today, index - 29);
    let label = '';
    if (index === 29) label = 'Today';
    else if (index % LABEL_EVERY === 0) label = dayLabel(day);
    return { day, label, litres: litres.get(day) ?? 0 };
  });
}

export function milkSummary(milk: AnalyticsSeries['milk'], today: string) {
  const since = shiftDay(today, -29);
  const recent = milk.filter((row) => row.day >= since && row.litres > 0);
  const total = recent.reduce((sum, row) => sum + row.litres, 0);
  return {
    hasMilk: recent.length > 0,
    average: recent.length ? total / recent.length : 0,
    best: Math.max(0, ...recent.map((row) => row.litres)),
  };
}

/** Today's litres for one animal by session, from the farm's entries. */
export function milkToday(
  entries: readonly Pick<MilkEntry, 'animal_id' | 'session' | 'litres'>[],
  animalId: string,
) {
  const today = { total: 0, morning: 0, afternoon: 0, evening: 0 };
  for (const entry of entries) {
    if (entry.animal_id !== animalId) continue;
    today[entry.session] += entry.litres;
    today.total += entry.litres;
  }
  return today;
}

/** A round top for the milk chart's axis, in fives: `[0, 5, 10, 15]`. */
export function milkTicks(highest: number): number[] {
  const steps = Math.max(Math.ceil(highest / 5), 1);
  return Array.from({ length: steps + 1 }, (_, index) => index * 5);
}

const ACTIVITY_PARTS = [
  ['Ruminating', 'ruminate_min', 'var(--green-ink)'],
  ['Standing', 'stand_min', 'var(--navy)'],
  ['Sitting', 'sit_min', 'var(--chart-steel)'],
  ['Eating', 'eat_min', 'var(--chart-amber)'],
  ['Walking', 'walk_min', 'var(--green)'],
  ['Drinking', 'drink_min', 'var(--chart-blue)'],
] as const;

/** Today's activity in the design's order, each with its hours and share of the bar. */
export function activityParts(activity: AnalyticsSeries['activity'][number]) {
  const total = ACTIVITY_PARTS.reduce((sum, [, key]) => sum + activity[key], 0);
  return ACTIVITY_PARTS.map(([name, key, color]) => ({
    name,
    color,
    hours: activity[key] / 60,
    percent: total ? (activity[key] / total) * 100 : 0,
  }));
}
