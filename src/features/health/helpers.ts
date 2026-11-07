import type { PillTone } from '../../components/StatusPill';
import type { AuditLogEntry, HealthRow, HealthStatus, VaccinationRow } from '../../data/types';
import { formatDate, formatTime, indiaDay, shiftDay } from '../../lib/format';
import { daysBetween, healthUndoTo, lastChange, vaccineState } from '../animal/helpers';

const DUE_DAYS = 7;
/** How far ahead the page looks, as the design's "upcoming = 8 to 30 days" says. */
const UPCOMING_DAYS = 30;
const DAY_MS = 86_400_000;
const WEEK = 7;

type Log = readonly AuditLogEntry[] | undefined;
type VaccineDates = Pick<VaccinationRow, 'due_date' | 'done_date'>;

/** The vaccine's pill in the table: how late it is, or that it was given today. */
export function vaccineStatus(
  v: VaccineDates,
  today = indiaDay(),
): { text: string; tone: PillTone } {
  if (v.done_date) {
    return {
      text: v.done_date === today ? 'Given today' : `Given ${formatDate(v.done_date)}`,
      tone: 'green',
    };
  }
  const late = daysBetween(v.due_date, today);
  if (late > 0) return { text: `Overdue · ${late} ${late === 1 ? 'day' : 'days'}`, tone: 'red' };
  return vaccineState(v, today);
}

export interface VaccineTotals {
  overdue: number;
  due: number;
  upcoming: number;
  total: number;
}

/** Not yet given, up to 30 days ahead. Later ones wait on the animal's own page. */
export function vaccineTotals(
  rows: readonly Pick<VaccinationRow, 'due_date' | 'done_date'>[],
  today = indiaDay(),
): VaccineTotals {
  const dueEnd = shiftDay(today, DUE_DAYS);
  const end = shiftDay(today, UPCOMING_DAYS);
  const totals = { overdue: 0, due: 0, upcoming: 0, total: 0 };
  for (const row of rows) {
    if (row.done_date || row.due_date > end) continue;
    if (row.due_date < today) totals.overdue++;
    else if (row.due_date <= dueEnd) totals.due++;
    else totals.upcoming++;
    totals.total++;
  }
  return totals;
}

export interface HealthTotals {
  sick: number;
  detected: number;
  condition: number;
  total: number;
}

export function healthTotals(rows: readonly Pick<HealthRow, 'status'>[]): HealthTotals {
  const totals = { sick: 0, detected: 0, condition: 0, total: 0 };
  for (const { status } of rows) {
    if (status === 'resolved') continue;
    totals[status]++;
    totals.total++;
  }
  return totals;
}

export interface TotalChip {
  text: string;
  tone: 'good' | 'bad' | 'plain';
  label: string;
}

/** How the count not yet given has moved in a week. Fewer is the good direction. */
export function vaccineChip(
  rows: readonly Pick<VaccinationRow, 'due_date' | 'done_date' | 'created_at'>[],
  today = indiaDay(),
): TotalChip | null {
  const weekAgo = shiftDay(today, -WEEK);
  const end = shiftDay(weekAgo, UPCOMING_DAYS);
  const before = rows.filter(
    (row) =>
      indiaDay(row.created_at) <= weekAgo &&
      row.due_date <= end &&
      (!row.done_date || row.done_date > weekAgo),
  ).length;
  if (before === 0) return null;
  const change = Math.round(((vaccineTotals(rows, today).total - before) / before) * 100);
  if (change === 0) return { text: 'same', tone: 'plain', label: 'The same as a week ago' };
  const size = Math.abs(change);
  return change < 0
    ? { text: `↓ ${size}%`, tone: 'good', label: `${size}% fewer than a week ago` }
    : { text: `↑ ${size}%`, tone: 'bad', label: `${size}% more than a week ago` };
}

/** Open issues that came in over the last 24 hours. */
export function healthChip(
  rows: readonly Pick<HealthRow, 'status' | 'detected_at'>[],
  now = Date.now(),
): TotalChip | null {
  const fresh = rows.filter(
    (row) => row.status !== 'resolved' && now - Date.parse(row.detected_at) < DAY_MS,
  ).length;
  return fresh
    ? { text: `↑ ${fresh} new`, tone: 'bad', label: `${fresh} new in the last 24 hours` }
    : null;
}

/** Staff marked it given today: the row stays in the list, ready for Undo, until the day ends. */
export function givenHere(
  row: Pick<VaccinationRow, 'id' | 'done_date'>,
  log: Log,
  today = indiaDay(),
): boolean {
  return row.done_date === today && Boolean(lastChange(log, row.id, 'done_date')?.to);
}

/** The Vaccinations tab: overdue first, and a row keeps its place when it's marked given. */
export function vaccineList(
  rows: readonly VaccinationRow[],
  log: Log,
  today = indiaDay(),
): VaccinationRow[] {
  const end = shiftDay(today, UPCOMING_DAYS);
  return rows
    .filter((row) => (row.done_date ? givenHere(row, log, today) : row.due_date <= end))
    .sort(
      (a, b) =>
        a.due_date.localeCompare(b.due_date) ||
        a.farm_name.localeCompare(b.farm_name) ||
        a.id.localeCompare(b.id),
    );
}

const STATUS_ORDER: Record<HealthStatus, number> = {
  sick: 0,
  detected: 1,
  condition: 2,
  resolved: 3,
};

/** The status Undo goes back to, for a resolve staff made today. */
export function resolvedHere(
  row: Pick<HealthRow, 'id' | 'status' | 'resolved_at'>,
  log: Log,
  today = indiaDay(),
): HealthStatus | null {
  if (!row.resolved_at || indiaDay(row.resolved_at) !== today) return null;
  return healthUndoTo(row, log);
}

/** The Health issues tab: sick first, newest first within each, and a resolved row keeps its place. */
export function healthList(rows: readonly HealthRow[], log: Log, today = indiaDay()): HealthRow[] {
  const placed = rows.flatMap((row) => {
    const place = row.status === 'resolved' ? resolvedHere(row, log, today) : row.status;
    return place ? [{ row, order: STATUS_ORDER[place] }] : [];
  });
  return placed
    .sort(
      (a, b) =>
        a.order - b.order ||
        b.row.detected_at.localeCompare(a.row.detected_at) ||
        a.row.id.localeCompare(b.row.id),
    )
    .map(({ row }) => row);
}

/** `Today 08:10`, `Yesterday` or the date. */
export function sinceText(at: string, now = Date.now()): string {
  const day = indiaDay(at);
  const today = indiaDay(now);
  if (day === today) return `Today ${formatTime(at)}`;
  if (day === shiftDay(today, -1)) return 'Yesterday';
  return formatDate(at);
}

/** `Kali (buffalo)`: the prototype names the species for anything other than cattle. */
export function animalLabel(
  animal: Pick<VaccinationRow['animal'], 'name' | 'tag_number' | 'species_id'>,
  speciesName: (id: string) => string,
): string {
  const name = animal.name ?? `Tag ${animal.tag_number}`;
  return animal.species_id === 'cattle'
    ? name
    : `${name} (${speciesName(animal.species_id).toLowerCase()})`;
}

export function reminderWord(count: number): string {
  return count === 1 ? 'reminder' : 'reminders';
}

/** A reminder further ahead than the page looks only shows here once it comes within 30 days. */
export function scheduleToast(
  created: number,
  vaccine: string,
  farmName: string,
  dueDate: string,
  today = indiaDay(),
): string {
  const text = `${created} ${reminderWord(created)} created for ${vaccine} at ${farmName}`;
  return dueDate > shiftDay(today, UPCOMING_DAYS)
    ? `${text} · listed here from ${formatDate(shiftDay(dueDate, -UPCOMING_DAYS))}`
    : text;
}
