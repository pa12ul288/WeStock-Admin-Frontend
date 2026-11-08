import type { AnalyticsSeries, EnvironmentReading } from '../../data/types';
import { toCsv, type CsvCell } from '../../lib/csv';
import { formatDayMonth, formatTime, indiaDay } from '../../lib/format';
import {
  ACTIVITY_KEYS,
  activityFigures,
  bucketSize,
  feedFigures,
  hourSlots,
  milkFigures,
  type Period,
} from './helpers';

interface ExportInput {
  farmName: string;
  scopeName: string;
  range: string;
  days: Period;
  series: AnalyticsSeries;
  hasCollars: boolean;
  collarCows: number;
  /** The day shown in the farm temperature graph, its source and readings. */
  env: { day: string; source: string; readings: readonly EnvironmentReading[] } | null;
}

/** The numbers behind the five graphs, as the screen shows them. */
export function analyticsCsv(input: ExportInput): string {
  const { series, days } = input;
  const size = bucketSize(days);
  const rows: CsvCell[][] = [];

  const milk = milkFigures(series.milk, days);
  const feed = feedFigures(series.feed, days);
  rows.push([
    'Milk and feed',
    size === 1 ? 'Day' : 'Period from',
    'Milk (L a day)',
    'Milk value (₹ a day)',
    'Feed (kg a day)',
  ]);
  milk.bars.forEach((bar, index) => {
    rows.push(['', bar.start, bar.litres, bar.value, feed.bars[index]?.kg ?? 0]);
  });

  if (input.hasCollars) {
    const activity = activityFigures(series.activity, days, input.collarCows);
    rows.push(
      [],
      [
        'Activity (hours per cow a day)',
        size === 1 ? 'Day' : 'Period from',
        ...ACTIVITY_KEYS.map(([name]) => name),
      ],
    );
    for (const bar of activity.bars) {
      rows.push(['', bar.start, ...ACTIVITY_KEYS.map(([name]) => bar[name] ?? 0)]);
    }

    rows.push(
      [],
      ['Cattle temperature (last 7 days)', 'Day', 'Time', 'Average (°C)', 'Highest (°C)'],
    );
    for (const point of series.cattle_temperature) {
      rows.push(['', indiaDay(point.hour), formatTime(point.hour), point.avg_c, point.max_c]);
    }
  }

  if (input.env) {
    rows.push(
      [],
      [
        'Farm temperature',
        `${formatDayMonth(input.env.day)} ${input.env.day.slice(0, 4)}`,
        input.env.source,
      ],
      ['', 'Hour', 'Temperature (°C)', 'Humidity (%)', 'THI'],
    );
    for (const slot of hourSlots(input.env.readings)) {
      if (slot.temp === null) continue;
      rows.push(['', slot.hour, slot.temp, slot.humidity, slot.thi]);
    }
  }

  return toCsv(['WeSTOCK analytics', input.farmName, input.scopeName, input.range], rows);
}
