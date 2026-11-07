import { describe, expect, it } from 'vitest';
import type { FeedDaily, MilkDaily } from '../../data/types';
import {
  feedTotals,
  formatAxisLitres,
  formatBarLitres,
  isWholeHerd,
  lastSevenDays,
  matchAnimal,
  matchFedTo,
  milkDays,
  milkMonths,
  monthRange,
  monthScale,
  niceTicks,
  parseAmount,
  reportFileName,
  trendOf,
} from './helpers';

const milk = (day: string, session: MilkDaily['session'], litres: number, animals = 0) => ({
  day,
  session,
  litres,
  value: litres * 40,
  milking_animals: animals,
});

const feed = (day: string, feed_type: string, kg: number, cost: number): FeedDaily => ({
  day,
  feed_type,
  kg,
  cost,
});

describe('milk & feed helpers', () => {
  it('takes the seven finished days ending yesterday', () => {
    const days = lastSevenDays('2026-11-05');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-10-29');
    expect(days.at(-1)).toBe('2026-11-04');
  });

  it('adds up sessions per day and counts a cow milked twice once', () => {
    const [day] = milkDays(
      [milk('2026-11-04', 'morning', 10, 5), milk('2026-11-04', 'evening', 6, 4)],
      ['2026-11-04'],
    );
    expect(day).toMatchObject({
      label: '04 Nov',
      morning: 10,
      afternoon: 0,
      evening: 6,
      total: 16,
      value: 640,
      animals: 5,
    });
  });

  it('gives a day with nothing logged zeros', () => {
    expect(milkDays([], ['2026-11-04'])[0]?.total).toBe(0);
  });

  it('works out the trend, including same and nothing to compare', () => {
    expect(trendOf(96.4, 100)).toEqual({ direction: 'down', text: '3.6%' });
    expect(trendOf(100.8, 100)).toEqual({ direction: 'up', text: '0.8%' });
    expect(trendOf(100, 100)).toEqual({ direction: 'same', text: 'same' });
    expect(trendOf(100, 0)).toBeUndefined();
  });

  it('splits feed by type and counts unknown types as Other', () => {
    const totals = feedTotals(
      [
        feed('2026-11-04', 'Green fodder', 60, 180),
        feed('2026-11-04', 'Rice bran', 40, 120),
        feed('2026-11-03', 'Green fodder', 999, 999),
      ],
      '2026-11-04',
    );
    expect(totals.kg).toBe(100);
    expect(totals.cost).toBe(300);
    expect(totals.types.map((type) => type.name)).toEqual([
      'Green fodder',
      'Dry fodder',
      'Concentrate',
      'Silage',
      'Other',
    ]);
    expect(totals.types[0]?.percent).toBe(60);
    expect(totals.types[4]).toMatchObject({ kg: 40, percent: 40 });
  });

  it('picks even ticks like the design', () => {
    expect(niceTicks(25_200)).toEqual([0, 10_000, 20_000, 30_000]);
    expect(niceTicks(712_480, 4)).toEqual([0, 200_000, 400_000, 600_000, 800_000]);
    expect(niceTicks(0)).toEqual([0, 10]);
    expect(niceTicks(4)).toEqual([0, 2, 4]);
  });

  it('writes chart numbers short', () => {
    expect(formatAxisLitres(30_000)).toBe('30k');
    expect(formatAxisLitres(2500)).toBe('2.5k');
    expect(formatAxisLitres(0)).toBe('0');
    expect(formatBarLitres(24_318)).toBe('24.3k');
    expect(formatBarLitres(640.4)).toBe('640');
  });

  it('uses lakhs only for big months', () => {
    const big = monthScale(712_480);
    expect(big.unit).toBe('lakh litres');
    expect(big.bar(712_480)).toBe('7.12');
    expect(big.axis(800_000, true)).toBe('8 lakh');
    expect(big.axis(600_000, false)).toBe('6');
    const small = monthScale(3000);
    expect(small.unit).toBe('litres');
    expect(small.axis(4000, true)).toBe('4k L');
  });

  it('covers the six months before this one', () => {
    const range = monthRange('2026-11-05');
    expect(range.months).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(range.from).toBe('2026-05-01');
    expect(range.to).toBe('2026-10-31');
    expect(range.last).toMatchObject({ title: 'October 2026', name: 'October' });
    expect(reportFileName(range.last.title)).toBe('milk-feed-october-2026.csv');
    expect(monthRange('2026-01-01').last.title).toBe('December 2025');
  });

  it('adds up months and leaves out empty ones', () => {
    const months = milkMonths(
      [milk('2026-09-30', 'morning', 10), milk('2026-10-01', 'morning', 5)],
      ['2026-08', '2026-09', '2026-10'],
    );
    expect(months.map((month) => [month.label, month.litres])).toEqual([
      ['Sep', 10],
      ['Oct', 5],
    ]);
  });

  it('reads typed numbers', () => {
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount(' ₹1,200 ')).toBe(1200);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-4')).toBeNull();
  });

  const animals = [
    { id: 'a', tag_number: '02', name: 'Lakshmi' },
    { id: 'b', tag_number: '07', name: 'Kali' },
    { id: 'c', tag_number: '09', name: 'Kali' },
    { id: 'd', tag_number: '11', name: null },
  ];

  it('finds an animal by tag, name or both', () => {
    expect(matchAnimal('02 · Lakshmi', animals)?.id).toBe('a');
    expect(matchAnimal('02 lakshmi', animals)?.id).toBe('a');
    expect(matchAnimal('02', animals)?.id).toBe('a');
    expect(matchAnimal('Lakshmi', animals)?.id).toBe('a');
    expect(matchAnimal('11', animals)?.id).toBe('d');
    expect(matchAnimal('Kali', animals)).toBeNull();
    expect(matchAnimal('nobody', animals)).toBeNull();
    expect(isWholeHerd(' whole  herd ')).toBe(true);
  });

  it('works out what feed went to', () => {
    const sheds = [
      { id: 's1', code: 'S1', name: 'Main shed' },
      { id: 's2', code: null, name: 'Calf pen' },
    ];
    expect(matchFedTo('Whole farm', sheds, animals)).toEqual({});
    expect(matchFedTo('S1 · Main shed', sheds, animals)).toEqual({ shed_id: 's1' });
    expect(matchFedTo('s1', sheds, animals)).toEqual({ shed_id: 's1' });
    expect(matchFedTo('Calf pen', sheds, animals)).toEqual({ shed_id: 's2' });
    expect(matchFedTo('02 · Lakshmi', sheds, animals)).toEqual({ animal_id: 'a' });
    expect(matchFedTo('the moon', sheds, animals)).toBeNull();
  });
});
