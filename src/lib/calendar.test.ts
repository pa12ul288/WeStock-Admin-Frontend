import { describe, expect, it } from 'vitest';
import { monthGrid, monthTitle, shiftMonth } from './calendar';

describe('monthGrid', () => {
  it('lays November 2026 out Sunday first (it starts on a Sunday)', () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weeks.at(-1)).toEqual([29, 30, null, null, null, null, null]);
    expect(weeks).toHaveLength(5);
  });

  it('pads the first week when the month starts mid-week', () => {
    // 1 Oct 2026 is a Thursday
    expect(monthGrid(2026, 9)[0]).toEqual([null, null, null, null, 1, 2, 3]);
  });

  it('knows leap years', () => {
    expect(monthGrid(2028, 1).flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid(2026, 1).flat().filter(Boolean)).toHaveLength(28);
  });

  it('always returns full weeks', () => {
    for (let month = 0; month < 12; month++) {
      for (const week of monthGrid(2026, month)) expect(week).toHaveLength(7);
    }
  });
});

describe('shiftMonth', () => {
  it('rolls over the year both ways', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 10, 14)).toEqual({ year: 2028, month: 0 });
  });
});

describe('monthTitle', () => {
  it('names the month and year', () => {
    expect(monthTitle(2026, 10)).toBe('November 2026');
  });
});
