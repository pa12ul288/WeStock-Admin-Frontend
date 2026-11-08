import type { KpiTrend } from '../../components/KpiCard';
import type { PillTone } from '../../components/StatusPill';
import type { Lang, Overview, SpeciesCount } from '../../data/types';
import { daysSince, formatDayMonth, formatTime, type DateInput } from '../../lib/format';
import type { DescribedEntry } from '../staff/audit';

export type PeriodDays = 7 | 30 | 90;
export const PERIODS: readonly PeriodDays[] = [7, 30, 90];

/** `?days=` in the URL; anything else is the default 30. */
export function parsePeriod(raw: string): PeriodDays {
  const days = Number(raw);
  return days === 7 || days === 90 ? days : 30;
}

/** "Good morning" before noon, "Good afternoon" before 5 pm, then "Good evening", in India time. */
export function greeting(now: DateInput = Date.now()): string {
  const hour = Number(formatTime(now).slice(0, 2));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string | null | undefined): string | null {
  return fullName?.trim().split(/\s+/)[0] || null;
}

/** A period's trend chip: `↑ 6%`, `↓ 4%`, or `= same` when nothing changed. */
export function trendChip(pct: number): KpiTrend {
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return { direction: 'same', text: 'same' };
  return { direction: pct > 0 ? 'up' : 'down', text: `${rounded}%` };
}

// ---- milk per day ----

export interface MilkBar {
  day: string;
  /** `6/10`, as the chart's axis writes it. */
  label: string;
  litres: number;
}

export function milkBars(rows: Overview['milk_per_day']): MilkBar[] {
  return rows.map((row) => {
    const [, month = '0', day = '0'] = row.day.split('-');
    return { day: row.day, label: `${Number(day)}/${Number(month)}`, litres: row.litres };
  });
}

/** The highest day, the bar shown dark with its tooltip open. The latest wins a tie. */
export function peakIndex(bars: readonly MilkBar[]): number {
  let best = -1;
  bars.forEach((bar, index) => {
    if (best < 0 || bar.litres >= (bars[best]?.litres ?? 0)) best = index;
  });
  return best;
}

/** Which day labels show: every one for a week, then fewer as the bars thin out. */
export function labelSpacing(days: PeriodDays): { desktop: number; phone: number } {
  if (days === 7) return { desktop: 1, phone: 1 };
  if (days === 30) return { desktop: 1, phone: 5 };
  return { desktop: 3, phone: 15 };
}

// ---- farms needing attention ----

export type IssueFilter = 'all' | 'health' | 'breeding' | 'milk';
export const ISSUE_FILTERS: readonly { value: IssueFilter; label: string }[] = [
  { value: 'all', label: 'All issues' },
  { value: 'health', label: 'Health' },
  { value: 'breeding', label: 'Breeding' },
  { value: 'milk', label: 'Milk' },
];

export function parseIssue(raw: string): IssueFilter {
  return ISSUE_FILTERS.some((item) => item.value === raw) ? (raw as IssueFilter) : 'all';
}

type FarmIssue = Overview['farms_needing_attention'][number];

const ISSUE_GROUP: Record<FarmIssue['issue'], Exclude<IssueFilter, 'all'>> = {
  vaccines_overdue: 'health',
  sick: 'health',
  golden_ending: 'breeding',
  quiet: 'milk',
};

export const ISSUE_TONES: Record<Exclude<IssueFilter, 'all'>, PillTone> = {
  health: 'red',
  breeding: 'pink',
  milk: 'amber',
};

export function issueGroup(issue: FarmIssue['issue']): Exclude<IssueFilter, 'all'> {
  return ISSUE_GROUP[issue];
}

export function matchesIssue(row: FarmIssue, filter: IssueFilter): boolean {
  return filter === 'all' || ISSUE_GROUP[row.issue] === filter;
}

/** The pill's words. The Overview has no per-farm counts, so only "quiet" carries a number. */
export function issueText(row: FarmIssue, now: DateInput = Date.now()): string {
  switch (row.issue) {
    case 'vaccines_overdue':
      return 'Vaccines overdue';
    case 'sick':
      return 'Animals sick';
    case 'golden_ending':
      return 'Golden period ending';
    case 'quiet': {
      if (!row.farm.last_entry_at) return 'No milk logged yet';
      const days = daysSince(row.farm.last_entry_at, now);
      return `No milk for ${days} ${days === 1 ? 'day' : 'days'}`;
    }
  }
}

// ---- herd and languages ----

export interface Share {
  key: string;
  label: string;
  /** In the language's own script, after the name. */
  native?: string;
  count: number;
  /** Whole percent of the total. */
  percent: number;
  color?: string;
}

const NAMED_SPECIES: readonly { id: string; label: string; color: string }[] = [
  { id: 'cattle', label: 'Cattle', color: 'var(--green)' },
  { id: 'buffalo', label: 'Buffalo', color: 'var(--navy)' },
  { id: 'goat', label: 'Goat', color: 'var(--stack-amber)' },
  { id: 'poultry', label: 'Poultry', color: 'var(--chart-pink)' },
];
const OTHER_SPECIES = { label: 'Sheep, pig, horse & other', color: 'var(--chart-grey)' };

const percentOf = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;

/** The prototype's five rows: four species by name, then everything else together. */
export function speciesShares(counts: readonly SpeciesCount[]): Share[] {
  const total = counts.reduce((sum, row) => sum + row.animals, 0);
  const named = new Set(NAMED_SPECIES.map((item) => item.id));
  const countOf = (id: string) =>
    counts.filter((row) => row.species_id === id).reduce((sum, row) => sum + row.animals, 0);
  const other = counts
    .filter((row) => !named.has(row.species_id))
    .reduce((sum, row) => sum + row.animals, 0);
  return [
    ...NAMED_SPECIES.map((item) => ({ key: item.id, ...item, count: countOf(item.id) })),
    { key: 'other', ...OTHER_SPECIES, count: other },
  ].map((row) => ({ ...row, percent: percentOf(row.count, total) }));
}

const NATIVE_NAMES: Record<Lang, string> = {
  hi: 'हिन्दी',
  mr: 'मराठी',
  gu: 'ગુજરાતી',
  ta: 'தமிழ்',
  ml: 'മലയാളം',
  en: '',
};

export function languageShares(
  rows: Overview['farmers_by_language'],
  labels: Record<Lang, string>,
): Share[] {
  const total = rows.reduce((sum, row) => sum + row.farmers, 0);
  return [...rows]
    .sort((a, b) => b.farmers - a.farmers)
    .map((row) => ({
      key: row.language,
      label: labels[row.language],
      native: NATIVE_NAMES[row.language] || undefined,
      count: row.farmers,
      percent: percentOf(row.farmers, total),
    }));
}

// ---- recent staff changes ----

export interface StaffChangeLine {
  who: string;
  what: string;
  where: string;
  when: string;
}

const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
/** `Milk entry` gives `milk entry`; `FMD vaccine` keeps its capitals. */
const lowerFirst = (text: string) =>
  /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;

function splitRecord(record: string): { head: string; tail: string | null } {
  const at = record.indexOf(' · ');
  return at < 0
    ? { head: record, tail: null }
    : { head: record.slice(0, at), tail: record.slice(at + 3) };
}

/** `12:16` today, `Yesterday`, then `03 Nov`, in India time. */
export function changeWhen(at: DateInput, now: DateInput = Date.now()): string {
  const days = daysSince(at, now);
  if (days <= 0) return formatTime(at);
  if (days === 1) return 'Yesterday';
  return formatDayMonth(at);
}

/** A log row as a sentence: "Priya Sharma corrected a milk entry, 75.0 → 7.5 L". */
export function staffChangeLine(row: DescribedEntry, now: DateInput = Date.now()): StaffChangeLine {
  const { head, tail } = splitRecord(row.record);
  const noun = lowerFirst(head);
  const first = row.changes[0];
  const table = row.entry.table_name;
  let what: string;
  let place = tail;

  switch (row.kind) {
    case 'edited':
      if (first && first.field === 'Litres') {
        what = `corrected ${withArticle(noun)}, ${first.from} → ${first.to} L`;
      } else if (first) {
        what = `changed ${withArticle(noun)}, ${lowerFirst(first.field)} ${first.from} → ${first.to}`;
      } else {
        what = `edited ${withArticle(noun)}`;
      }
      break;
    case 'added':
      what = `added ${withArticle(noun)}`;
      break;
    case 'deleted':
      what = `deleted ${withArticle(noun)}`;
      break;
    case 'done':
      if (table === 'vaccinations') what = `marked the ${head} done`;
      else if (table === 'health_events') what = `marked ${lowerFirst(head)} resolved`;
      else what = 'verified an insemination slip';
      break;
    case 'role': {
      const person = tail ?? 'someone';
      const role = first ? first.to : 'another role';
      what =
        table === 'admin_staff'
          ? `changed ${person}’s role to ${role}`
          : `made ${person} ${withArticle(role.toLowerCase())}`;
      place = null;
      break;
    }
    case 'invited':
      what = `invited ${tail ?? 'a new staff member'}`;
      place = null;
      break;
    case 'removed':
      what =
        row.note === 'Invite cancelled'
          ? `cancelled ${tail ? `${tail}’s` : 'an'} invite`
          : `removed ${tail ?? 'a staff member'}`;
      place = null;
      break;
  }

  return {
    who: row.entry.staff_name ?? 'Unknown',
    what,
    where: [row.farm, place].filter(Boolean).join(' · '),
    when: changeWhen(row.entry.at, now),
  };
}
