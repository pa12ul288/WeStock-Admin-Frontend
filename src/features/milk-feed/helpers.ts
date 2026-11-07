import type { KpiTrend } from '../../components/KpiCard';
import type {
  AnimalListRow,
  FeedDaily,
  MilkDaily,
  MilkRow,
  MilkSession,
  Shed,
  UUID,
} from '../../data/types';
import { formatDayMonth, indiaDay, shiftDay } from '../../lib/format';

export const SESSIONS: readonly MilkSession[] = ['morning', 'afternoon', 'evening'];

export const SESSION_LABELS: Record<MilkSession, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export const SESSION_COLOURS: Record<MilkSession, string> = {
  morning: 'var(--navy)',
  afternoon: 'var(--chart-sky)',
  evening: 'var(--green)',
};

export const FEED_TYPES = [
  { name: 'Green fodder', color: 'var(--green)' },
  { name: 'Dry fodder', color: 'var(--chart-gold)' },
  { name: 'Concentrate', color: 'var(--navy)' },
  { name: 'Silage', color: 'var(--chart-sky)' },
  { name: 'Other', color: 'var(--chart-grey)' },
] as const;

export const WHOLE_HERD = 'Whole herd';
export const WHOLE_FARM = 'Whole farm';
const OTHER_FEED = 'Other';
const WEEK = 7;
const MONTHS_SHOWN = 6;

/** The 7 finished days ending yesterday, the screen's daily range. */
export function lastSevenDays(today = indiaDay()): string[] {
  return Array.from({ length: WEEK }, (_, index) => shiftDay(today, index - WEEK));
}

const dayAt = (day: string) => `${day}T00:00:00+05:30`;

export interface MilkDay extends Record<MilkSession, number> {
  day: string;
  label: string;
  total: number;
  value: number;
  /** Most animals with an entry in one session: the same cow milked twice counts once. */
  animals: number;
}

export function milkDays(rows: readonly MilkDaily[], days: readonly string[]): MilkDay[] {
  return days.map((day) => {
    const result: MilkDay = {
      day,
      label: formatDayMonth(dayAt(day)),
      morning: 0,
      afternoon: 0,
      evening: 0,
      total: 0,
      value: 0,
      animals: 0,
    };
    for (const row of rows) {
      if (row.day !== day) continue;
      result[row.session] += row.litres;
      result.total += row.litres;
      result.value += row.value;
      result.animals = Math.max(result.animals, row.milking_animals);
    }
    return result;
  });
}

/** This number against the one before; none when there's nothing to compare with. */
export function trendOf(current: number, previous: number): KpiTrend | undefined {
  if (previous <= 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  const text = Math.abs(change).toFixed(1);
  if (Number(text) === 0) return { direction: 'same', text: 'same' };
  return { direction: change > 0 ? 'up' : 'down', text: `${text}%` };
}

export interface FeedShare {
  name: string;
  color: string;
  kg: number;
  /** Share of the day's kilograms. */
  percent: number;
}

export interface FeedDayTotals {
  kg: number;
  cost: number;
  types: FeedShare[];
}

/** One day's feed by type. A type outside the design's list counts as Other. */
export function feedTotals(rows: readonly FeedDaily[], day: string): FeedDayTotals {
  const today = rows.filter((row) => row.day === day);
  const kg = today.reduce((sum, row) => sum + row.kg, 0);
  const cost = today.reduce((sum, row) => sum + row.cost, 0);
  const known = new Set<string>(FEED_TYPES.map((type) => type.name));
  const types = FEED_TYPES.map((type) => {
    const typeKg = today
      .filter((row) =>
        known.has(row.feed_type) ? row.feed_type === type.name : type.name === OTHER_FEED,
      )
      .reduce((sum, row) => sum + row.kg, 0);
    return {
      name: type.name,
      color: type.color,
      kg: typeKg,
      percent: kg > 0 ? (typeKg / kg) * 100 : 0,
    };
  });
  return { kg, cost, types };
}

/** Even chart ticks from 0 past the highest value, in about this many steps. */
export function niceTicks(max: number, steps = 3): number[] {
  if (max <= 0) return [0, 10];
  const rough = max / steps;
  const scale = 10 ** Math.floor(Math.log10(rough));
  const unit = [1, 2, 5, 10].find((candidate) => candidate * scale >= rough) ?? 10;
  const step = Math.max(unit * scale, 1);
  const count = Math.ceil(max / step);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

/** `30k`, `2.5k`, `640`: a chart's axis. */
export function formatAxisLitres(value: number): string {
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(Math.round(value));
}

/** `23.2k`, `640`: the total above a day's bar. */
export function formatBarLitres(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value));
}

const LAKH = 100_000;
/** Below this, lakhs would be all zeros, so a small farm's chart counts plain litres. */
const LAKH_SCALE_FROM = 50_000;

export interface MonthScale {
  unit: string;
  bar: (litres: number) => string;
  axis: (litres: number, isTop: boolean) => string;
}

export function monthScale(max: number): MonthScale {
  if (max >= LAKH_SCALE_FROM) {
    return {
      unit: 'lakh litres',
      bar: (litres) => (litres / LAKH).toFixed(2),
      axis: (litres, isTop) => `${Number((litres / LAKH).toFixed(2))}${isTop ? ' lakh' : ''}`,
    };
  }
  return {
    unit: 'litres',
    bar: formatBarLitres,
    axis: (litres, isTop) => `${formatAxisLitres(litres)}${isTop ? ' L' : ''}`,
  };
}

const monthName = (month: string, form: 'long' | 'short') =>
  new Intl.DateTimeFormat('en-US', { month: form, timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );

const lastDayOf = (month: string) => {
  const [year = 0, number = 1] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
};

export const daysInMonth = (month: string) => Number(lastDayOf(month).slice(8));

export interface MonthRange {
  /** `YYYY-MM`, oldest first. */
  months: string[];
  from: string;
  to: string;
  /** The latest finished month and its days. */
  last: { month: string; from: string; to: string; title: string; name: string };
}

/** The 6 months before this one. The current month is left out because it hasn't finished. */
export function monthRange(today = indiaDay()): MonthRange {
  const months: string[] = [];
  let lastDay = shiftDay(`${today.slice(0, 7)}-01`, -1);
  for (let index = 0; index < MONTHS_SHOWN; index += 1) {
    months.unshift(lastDay.slice(0, 7));
    lastDay = shiftDay(`${lastDay.slice(0, 7)}-01`, -1);
  }
  const month = months.at(-1) as string;
  const name = monthName(month, 'long');
  return {
    months,
    from: `${months[0] as string}-01`,
    to: lastDayOf(month),
    last: {
      month,
      from: `${month}-01`,
      to: lastDayOf(month),
      title: `${name} ${month.slice(0, 4)}`,
      name,
    },
  };
}

export interface MilkMonth {
  month: string;
  label: string;
  litres: number;
  value: number;
}

/** Litres and value per month, leaving out months with nothing logged. */
export function milkMonths(rows: readonly MilkDaily[], months: readonly string[]): MilkMonth[] {
  return months
    .map((month) => {
      const inMonth = rows.filter((row) => row.day.startsWith(month));
      return {
        month,
        label: monthName(month, 'short'),
        litres: inMonth.reduce((sum, row) => sum + row.litres, 0),
        value: inMonth.reduce((sum, row) => sum + row.value, 0),
      };
    })
    .filter((row) => row.litres > 0);
}

/** The file name of a month's report: `milk-feed-october-2026.csv`. */
export const reportFileName = (title: string) =>
  `milk-feed-${title.toLowerCase().replace(/\s+/g, '-')}.csv`;

/** `02 · Lakshmi`, or the tag alone when it has no name. */
export function animalText(animal: { tag_number: string; name: string | null }): string {
  return animal.name ? `${animal.tag_number} · ${animal.name}` : animal.tag_number;
}

export const milkAnimalText = (row: Pick<MilkRow, 'animal'>) =>
  row.animal ? animalText(row.animal) : WHOLE_HERD;

/** A number typed in a form: commas, spaces and ₹ are fine. Null when it isn't one. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const normalise = (text: string) =>
  text.replace(/[·:-]/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');

type Pickable = Pick<AnimalListRow, 'id' | 'tag_number' | 'name'>;

/** The animal meant by "02 · Lakshmi", "02" or "Lakshmi", if exactly one fits. */
export function matchAnimal<A extends Pickable>(text: string, animals: readonly A[]): A | null {
  const wanted = normalise(text);
  if (!wanted) return null;
  const exact = animals.find((animal) => normalise(animalText(animal)) === wanted);
  if (exact) return exact;
  const tags = animals.filter((animal) => animal.tag_number.toLowerCase() === wanted);
  if (tags.length === 1) return tags[0] as A;
  const names = animals.filter((animal) => animal.name?.toLowerCase() === wanted);
  return names.length === 1 ? (names[0] as A) : null;
}

export const isWholeHerd = (text: string) => normalise(text) === normalise(WHOLE_HERD);

/** `S1 · Main shed`, or the code alone. */
export function shedText(shed: Pick<Shed, 'code' | 'name'>): string {
  return shed.code ? `${shed.code} · ${shed.name}` : shed.name;
}

export type FedTo = { shed_id?: UUID; animal_id?: UUID };

/** What "Fed to" points at: the whole farm, a shed by code or name, or one animal. */
export function matchFedTo(
  text: string,
  sheds: readonly Pick<Shed, 'id' | 'code' | 'name'>[],
  animals: readonly Pickable[],
): FedTo | null {
  const wanted = normalise(text);
  if (!wanted) return null;
  if (wanted === normalise(WHOLE_FARM)) return {};
  const shed = sheds.filter((item) =>
    [shedText(item), item.code ?? '', item.name].some((name) => normalise(name) === wanted),
  );
  if (shed.length === 1) return { shed_id: (shed[0] as (typeof sheds)[number]).id };
  const animal = matchAnimal(text, animals);
  return animal ? { animal_id: animal.id } : null;
}
