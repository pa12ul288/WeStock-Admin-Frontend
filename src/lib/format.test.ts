import { describe, expect, it } from 'vitest';
import { formatCount, formatWeekdayDate } from './format';

describe('formatWeekdayDate', () => {
  it('writes the date like the prototype', () => {
    expect(formatWeekdayDate(Date.parse('2026-11-05T06:30:00Z'))).toBe('Thu, 05 Nov 2026');
  });

  it('uses India time, not the computer clock', () => {
    expect(formatWeekdayDate(Date.parse('2026-11-05T19:00:00Z'))).toBe('Fri, 06 Nov 2026');
  });
});

describe('formatCount', () => {
  it('groups the Indian way', () => {
    expect(formatCount(123456)).toBe('1,23,456');
    expect(formatCount(1412)).toBe('1,412');
  });
});
