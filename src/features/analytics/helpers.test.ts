import { describe, expect, it } from 'vitest';
import type { AnalyticsSeries } from '../../data/types';
import { analyticsCsv } from './export';
import {
  activityFigures,
  bucketSize,
  feedMix,
  feverCount,
  fileName,
  hourSlots,
  milkFigures,
  parseDay,
  parsePeriod,
  peakIndex,
  rangeTicks,
  thirdsTicks,
  thiColour,
  windowDays,
} from './helpers';

const TODAY = '2026-11-05';

describe('periods', () => {
  it('reads the period and falls back to 7', () => {
    expect(parsePeriod('30')).toBe(30);
    expect(parsePeriod('90')).toBe(90);
    expect(parsePeriod('x')).toBe(7);
    expect(parsePeriod(undefined)).toBe(7);
  });

  it('ends yesterday and averages 5 and 10 days', () => {
    expect(windowDays(7, TODAY)).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    expect([7, 30, 90].map((days) => bucketSize(days as 7 | 30 | 90))).toEqual([1, 5, 10]);
  });
});

describe('milkFigures', () => {
  const milk = windowDays(14, TODAY).map((day, index) => ({
    day,
    litres: index < 7 ? 100 : 110,
    revenue: index < 7 ? 4000 : 4400,
  }));

  it('totals the week and compares it with the one before', () => {
    const figures = milkFigures(milk, 7, TODAY);
    expect(figures.bars).toHaveLength(7);
    expect(figures.total).toBe(770);
    expect(figures.price).toBeCloseTo(40);
    expect(figures.trendPct).toBeCloseTo(10);
  });

  it('has no trend without an earlier period', () => {
    expect(milkFigures(milk.slice(7), 7, TODAY).trendPct).toBeNull();
  });

  it('averages 5 days a bar for 30 days', () => {
    const figures = milkFigures(milk, 30, TODAY);
    expect(figures.bars).toHaveLength(6);
    expect(figures.bars[5]?.litres).toBe(110);
  });
});

describe('chart helpers', () => {
  it('picks the latest highest bar, none when empty', () => {
    expect(peakIndex([1, 5, 5, 2])).toBe(2);
    expect(peakIndex([0, 0])).toBe(-1);
  });

  it('gives round thirds', () => {
    expect(thirdsTicks(340)).toEqual([0, 150, 300, 450]);
    expect(thirdsTicks(24.5)).toEqual([0, 10, 20, 30]);
    expect(rangeTicks([640, 660])).toHaveLength(3);
  });

  it('colours THI between the tokens', () => {
    expect(thiColour(60)).toContain('var(--thi-low)');
    expect(thiColour(90)).toContain('var(--thi-high)');
  });
});

describe('feedMix', () => {
  it('counts unknown types as Other', () => {
    const mix = feedMix([
      { feed_type: 'Green fodder', kg: 50 },
      { feed_type: 'Mineral mix', kg: 50 },
    ]);
    expect(mix.find((share) => share.name === 'Green fodder')?.percent).toBe(50);
    expect(mix.find((share) => share.name === 'Other')?.percent).toBe(50);
  });
});

describe('activityFigures', () => {
  it('divides a farm by its collared cows', () => {
    const day = windowDays(7, TODAY)[0] as string;
    const figures = activityFigures(
      [
        {
          day,
          stand_min: 600,
          sit_min: 600,
          walk_min: 120,
          eat_min: 480,
          ruminate_min: 720,
          drink_min: 60,
        },
      ],
      7,
      2,
      TODAY,
    );
    expect(figures.bars[0]?.Ruminating).toBe(6);
    expect(figures.hasData).toBe(true);
  });
});

describe('temperature', () => {
  it('counts cows above the fever line', () => {
    expect(
      feverCount(
        [
          { name: 'a', temp: 40.1 },
          { name: 'b', temp: 39.5 },
          { name: 'c', temp: null },
        ],
        39.5,
      ),
    ).toBe(1);
  });

  it('fills 24 hours', () => {
    expect(hourSlots([])).toHaveLength(24);
  });

  it('keeps the chosen day only when it is one of the seven', () => {
    expect(parseDay('2026-11-01', TODAY)).toBe('2026-11-01');
    expect(parseDay('2026-01-01', TODAY)).toBe('2026-11-04');
  });
});

describe('export', () => {
  const series: AnalyticsSeries = {
    milk: windowDays(7, TODAY).map((day) => ({ day, litres: 10, revenue: 400 })),
    feed: windowDays(7, TODAY).map((day) => ({ day, kg: 20, cost: 100 })),
    activity: [],
    cattle_temperature: [],
    farm_temperature: [],
  };

  it('names the file after the farm, scope and period', () => {
    expect(fileName('Shree Ganesh Dairy', 'Whole farm', 7)).toBe(
      'westock-analytics-shree-ganesh-dairy-whole-farm-7-days.csv',
    );
  });

  it('writes milk and feed numbers, and leaves out collar graphs without collars', () => {
    const csv = analyticsCsv({
      farmName: 'Periyar Cattle Farm',
      scopeName: 'Whole farm',
      range: 'x',
      days: 7,
      series,
      hasCollars: false,
      collarCows: 0,
      env: null,
    });
    expect(csv).toContain('WeSTOCK analytics,Periyar Cattle Farm,Whole farm,x');
    expect(csv).toContain('Milk and feed,Day,Milk (L a day)');
    expect(csv).not.toContain('Activity');
    expect(csv).not.toContain('Cattle temperature');
  });
});
