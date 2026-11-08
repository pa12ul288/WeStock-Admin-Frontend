import type { AnalyticsSeries, EnvironmentReading, FeedDaily, MilkDaily } from '../../data/types';
import { formatDayMonth, formatTime, indiaDay, shiftDay } from '../../lib/format';
import { FEED_TYPES } from '../milk-feed/helpers';

export type Period = 7 | 30 | 90;

export const PERIODS: readonly Period[] = [7, 30, 90];

/** The farms the prototype puts one tap away. Every other farm is in the select beside them. */
export const QUICK_FARMS = ['Shree Ganesh Dairy', 'Periyar Cattle Farm'] as const;

export function parsePeriod(raw: string | null | undefined): Period {
  const days = Number(raw);
  return days === 30 || days === 90 ? days : 7;
}

/** The finished days of a period, oldest first: it ends yesterday, as the prototype's does. */
export function windowDays(days: number, today = indiaDay()): string[] {
  return Array.from({ length: days }, (_, index) => shiftDay(today, index - days));
}

/** Days averaged into one bar: none for a week, 5 for a month, 10 for 90 days. */
export function bucketSize(days: Period): number {
  return days === 7 ? 1 : days === 30 ? 5 : 10;
}

export interface Bucket {
  /** The first day of the stretch. */
  start: string;
  days: string[];
  label: string;
}

export function buckets(days: readonly string[], size: number): Bucket[] {
  const result: Bucket[] = [];
  for (let at = 0; at < days.length; at += size) {
    const slice = days.slice(at, at + size);
    result.push({ start: slice[0] ?? '', days: slice, label: formatDayMonth(slice[0]) });
  }
  return result;
}

/** The mean per day of a stretch; a day with nothing logged counts as 0. */
export function averageOf(bucket: Bucket, values: ReadonlyMap<string, number>): number {
  const total = bucket.days.reduce((sum, day) => sum + (values.get(day) ?? 0), 0);
  return bucket.days.length ? total / bucket.days.length : 0;
}

const sumOver = (days: readonly string[], values: ReadonlyMap<string, number>) =>
  days.reduce((sum, day) => sum + (values.get(day) ?? 0), 0);

/** A tidy number for a chart: whole above 100, one decimal below. */
export function tidy(value: number): number {
  return value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
}

// ---- milk ----

export interface MilkBar {
  label: string;
  start: string;
  litres: number;
  value: number;
}

export interface MilkFigures {
  bars: MilkBar[];
  total: number;
  value: number;
  averagePerDay: number;
  /** Rupees per litre. */
  price: number;
  /** Against the period before, or null when there is no such period or nothing to compare with. */
  trendPct: number | null;
  peak: number;
}

export function milkFigures(
  milk: AnalyticsSeries['milk'],
  days: Period,
  today = indiaDay(),
): MilkFigures {
  const litres = new Map(milk.map((row) => [row.day, row.litres]));
  const revenue = new Map(milk.map((row) => [row.day, row.revenue]));
  const window = windowDays(days, today);
  const parts = buckets(window, bucketSize(days));
  const bars = parts.map((part) => ({
    label: part.label,
    start: part.start,
    litres: tidy(averageOf(part, litres)),
    value: Math.round(averageOf(part, revenue)),
  }));
  const total = sumOver(window, litres);
  const value = sumOver(window, revenue);
  const before = windowDays(days, shiftDay(today, -days));
  const priorTotal = sumOver(before, litres);
  const hasPrior = milk.some((row) => row.day < (window[0] ?? ''));
  return {
    bars,
    total,
    value,
    averagePerDay: total / days,
    price: total > 0 ? value / total : 0,
    trendPct: hasPrior && priorTotal > 0 ? ((total - priorTotal) / priorTotal) * 100 : null,
    peak: peakIndex(bars.map((bar) => bar.litres)),
  };
}

/** The highest bar. The latest wins a tie; -1 when every bar is empty. */
export function peakIndex(values: readonly number[]): number {
  let best = -1;
  let top = 0;
  values.forEach((value, index) => {
    if (value > 0 && value >= top) {
      top = value;
      best = index;
    }
  });
  return best;
}

const TOPS = [
  0.3, 0.45, 0.6, 0.9, 1.2, 1.5, 3, 4.5, 6, 9, 12, 15, 30, 45, 60, 90, 120, 150, 300, 450, 600, 900,
  1200, 1500, 3000, 4500, 6000, 9000, 12000,
];

/** Four ticks, `0` and thirds up to a round top at least 15% above the highest bar. */
export function thirdsTicks(highest: number): number[] {
  const top = TOPS.find((candidate) => candidate >= highest * 1.15) ?? Math.ceil(highest * 1.2);
  return [0, top / 3, (top * 2) / 3, top].map((tick) => Math.round(tick * 10) / 10);
}

/** Three ticks around the data, with padding so a flat line sits mid-chart. */
export function rangeTicks(values: readonly number[]): number[] {
  const real = values.filter((value) => value > 0);
  if (!real.length) return [0, 5, 10];
  const low = Math.min(...real);
  const high = Math.max(...real);
  const pad = Math.max((high - low) * 0.8, high * 0.04);
  const unit = high >= 100 ? 10 : 1;
  const bottom = Math.max(0, Math.floor((low - pad) / unit) * unit);
  let top = Math.ceil((high + pad) / unit) * unit;
  if (((top - bottom) / unit) % 2) top += unit;
  return [bottom, (top + bottom) / 2, top];
}

// ---- feed ----

export interface FeedBar {
  label: string;
  start: string;
  kg: number;
}

export interface FeedFigures {
  bars: FeedBar[];
  total: number;
  cost: number;
  perKg: number;
}

export function feedFigures(
  feed: AnalyticsSeries['feed'],
  days: Period,
  today = indiaDay(),
): FeedFigures {
  const kg = new Map(feed.map((row) => [row.day, row.kg]));
  const cost = new Map(feed.map((row) => [row.day, row.cost]));
  const window = windowDays(days, today);
  const bars = buckets(window, bucketSize(days)).map((part) => ({
    label: part.label,
    start: part.start,
    kg: tidy(averageOf(part, kg)),
  }));
  const total = sumOver(window, kg);
  const spent = sumOver(window, cost);
  return { bars, total, cost: spent, perKg: total > 0 ? spent / total : 0 };
}

export interface MixShare {
  name: string;
  color: string;
  kg: number;
  percent: number;
}

/** The feed mix by type. A type outside the design's list counts as Other. */
export function feedMix(rows: readonly Pick<FeedDaily, 'feed_type' | 'kg'>[]): MixShare[] {
  const known = new Set<string>(FEED_TYPES.map((type) => type.name));
  const total = rows.reduce((sum, row) => sum + row.kg, 0);
  return FEED_TYPES.map((type) => {
    const kg = rows
      .filter((row) =>
        known.has(row.feed_type) ? row.feed_type === type.name : type.name === 'Other',
      )
      .reduce((sum, row) => sum + row.kg, 0);
    return { name: type.name, color: type.color, kg, percent: total > 0 ? (kg / total) * 100 : 0 };
  });
}

// ---- activity ----

export const ACTIVITY_KEYS = [
  ['Ruminating', 'ruminate_min', 'var(--green-ink)'],
  ['Standing', 'stand_min', 'var(--navy)'],
  ['Sitting', 'sit_min', 'var(--chart-steel)'],
  ['Eating', 'eat_min', 'var(--chart-amber)'],
  ['Walking', 'walk_min', 'var(--green)'],
  ['Drinking', 'drink_min', 'var(--chart-blue)'],
] as const;

export type ActivityName = (typeof ACTIVITY_KEYS)[number][0];

export interface ActivityBar extends Record<string, number | string> {
  label: string;
  start: string;
}

export interface ActivityFigures {
  bars: ActivityBar[];
  /** Hours per cow per day over the whole period. */
  averages: Record<ActivityName, number>;
  hasData: boolean;
}

/**
 * Hours per cow per day. The series adds up every collared cow, so a farm's days are divided by
 * how many wear one.
 */
export function activityFigures(
  activity: AnalyticsSeries['activity'],
  days: Period,
  cows: number,
  today = indiaDay(),
): ActivityFigures {
  const divisor = Math.max(cows, 1) * 60;
  const window = windowDays(days, today);
  const byKey = ACTIVITY_KEYS.map(
    ([name, key]) => [name, new Map(activity.map((row) => [row.day, row[key] / divisor]))] as const,
  );
  const bars = buckets(window, bucketSize(days)).map((part) => {
    const bar: ActivityBar = { label: part.label, start: part.start };
    for (const [name, values] of byKey) bar[name] = Math.round(averageOf(part, values) * 10) / 10;
    return bar;
  });
  const averages = {} as Record<ActivityName, number>;
  for (const [name, values] of byKey) averages[name] = sumOver(window, values) / days;
  return { bars, averages, hasData: activity.some((row) => window.includes(row.day)) };
}

// ---- cattle temperature ----

export interface TemperaturePoint {
  at: string;
  label: string;
  avg: number;
  max: number;
}

/** Hourly points of the last 7 days. The label is the day, shown on every 24th. */
export function temperaturePoints(rows: AnalyticsSeries['cattle_temperature']): TemperaturePoint[] {
  return rows.map((row) => ({
    at: row.hour,
    label: formatDayMonth(row.hour),
    avg: row.avg_c,
    max: row.max_c,
  }));
}

export interface TemperatureCow {
  name: string;
  temp: number | null;
}

/** Collared animals above the farm's fever line right now. */
export function feverCount(cows: readonly TemperatureCow[], limit: number): number {
  return cows.filter((cow) => cow.temp !== null && cow.temp > limit).length;
}

/** The cow with the highest reading now, or null with no readings. */
export function hottestCow(cows: readonly TemperatureCow[]): { name: string; temp: number } | null {
  let best: { name: string; temp: number } | null = null;
  for (const cow of cows) {
    if (cow.temp !== null && (!best || cow.temp > best.temp)) {
      best = { name: cow.name, temp: cow.temp };
    }
  }
  return best;
}

// ---- farm temperature ----

export interface HourReading {
  hour: string;
  temp: number | null;
  humidity: number | null;
  thi: number | null;
}

/** All 24 hours of a day, an hour with no reading left empty. */
export function hourSlots(readings: readonly EnvironmentReading[]): HourReading[] {
  const byHour = new Map(readings.map((row) => [formatTime(row.ts).slice(0, 2), row]));
  return Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, '0');
    const row = byHour.get(key);
    return {
      hour: `${key}:00`,
      temp: row ? row.temp_c : null,
      humidity: row?.humidity ?? null,
      thi: row?.thi ?? null,
    };
  });
}

export interface WeekPeak {
  value: number;
  day: string;
  hour: string;
}

/** The highest value across several days' readings, with when it happened. */
export function weekPeak(
  readings: readonly EnvironmentReading[],
  pick: (row: EnvironmentReading) => number | null,
): WeekPeak | null {
  let best: WeekPeak | null = null;
  for (const row of readings) {
    const value = pick(row);
    if (value !== null && (!best || value > best.value)) {
      best = { value, day: formatDayMonth(row.ts), hour: formatTime(row.ts) };
    }
  }
  return best;
}

/** A THI colour from light green through yellow to red, mixed in CSS from the tokens. */
export function thiColour(thi: number): string {
  const k = Math.max(0, Math.min(1, (thi - 64) / 20));
  return k < 0.5
    ? `color-mix(in srgb, var(--thi-mid) ${Math.round(k * 200)}%, var(--thi-low))`
    : `color-mix(in srgb, var(--thi-high) ${Math.round((k - 0.5) * 200)}%, var(--thi-mid))`;
}

/** The pick-a-day choices: yesterday and the 6 days before it, as the prototype lists. */
export function dayChoices(today = indiaDay()): { value: string; label: string }[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(today, -(index + 1));
    const label = formatDayMonth(day);
    return { value: day, label: index === 0 ? `${label} · yesterday` : label };
  });
}

/** The chosen day, or yesterday when the value is missing or isn't one of the choices. */
export function parseDay(raw: string | null | undefined, today = indiaDay()): string {
  const choices = dayChoices(today);
  return choices.find((choice) => choice.value === raw)?.value ?? choices[0]?.value ?? today;
}

/** The most animals milked in one session on the latest day that has any. */
export function milkingNow(rows: readonly MilkDaily[]): number {
  const latest = rows
    .filter((row) => row.litres > 0)
    .map((row) => row.day)
    .sort()
    .at(-1);
  return Math.max(0, ...rows.filter((row) => row.day === latest).map((row) => row.milking_animals));
}

/** `westock-analytics-shree-ganesh-dairy-whole-farm-7-days.csv` */
export function fileName(farm: string, scope: string, days: Period): string {
  const slug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `westock-analytics-${slug(farm)}-${slug(scope)}-${days}-days.csv`;
}
