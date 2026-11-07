import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatKg,
  formatLitres,
  formatPhone,
  formatRelative,
  formatRupees,
  formatTime,
  formatWeekdayDate,
} from './format';

describe('formatWeekdayDate', () => {
  it('writes the date like the prototype', () => {
    expect(formatWeekdayDate(Date.parse('2026-11-05T06:30:00Z'))).toBe('Thu, 05 Nov 2026');
  });

  it('uses India time, not the computer clock', () => {
    expect(formatWeekdayDate(Date.parse('2026-11-05T19:00:00Z'))).toBe('Fri, 06 Nov 2026');
  });
});

describe('dates and times', () => {
  it('rolls to the next India day at 18:30 UTC', () => {
    expect(formatDate('2026-11-05T18:29:00Z')).toBe('05 Nov 2026');
    expect(formatDate('2026-11-05T18:30:00Z')).toBe('06 Nov 2026');
  });

  it('keeps a date-only value on its own day', () => {
    expect(formatDate('2026-11-05')).toBe('05 Nov 2026');
    expect(formatDayMonth('2026-11-05')).toBe('05 Nov');
  });

  it('writes the time on the 24-hour clock', () => {
    expect(formatTime('2026-11-05T01:10:00Z')).toBe('06:40');
    expect(formatTime('2026-11-05T12:50:00Z')).toBe('18:20');
    expect(formatTime('2026-11-05T18:30:00Z')).toBe('00:00');
  });

  it('joins date and time like the milk table', () => {
    expect(formatDateTime('2026-11-05T01:10:00Z')).toBe('05 Nov · 06:40');
  });

  it('shows a dash for missing or broken dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatTime(undefined)).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
    expect(formatRelative(null)).toBe('—');
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-11-05T12:00:00Z'); // 17:30 in India
  const ago = (minutes: number) => now - minutes * 60_000;

  it.each([
    [0, 'Just now'],
    [0.5, 'Just now'],
    [1, '1 min ago'],
    [20, '20 min ago'],
    [59, '59 min ago'],
    [60, '1 h ago'],
    [125, '2 h ago'],
    [17 * 60, '17 h ago'],
  ])('%s minutes back is "%s"', (minutes, text) => {
    expect(formatRelative(ago(minutes), now)).toBe(text);
  });

  it('counts India calendar days, not 24-hour blocks', () => {
    expect(formatRelative('2026-11-04T18:29:00Z', now)).toBe('Yesterday'); // 23:59 on the 4th
    expect(formatRelative('2026-11-04T18:31:00Z', now)).toBe('17 h ago'); // 00:01 on the 5th
    expect(formatRelative('2026-11-01T06:00:00Z', now)).toBe('4 days ago');
  });

  it('gives the date once it is over a month old', () => {
    expect(formatRelative('2026-09-01T06:00:00Z', now)).toBe('01 Sep 2026');
  });

  it('treats a time ahead of the clock as just now', () => {
    expect(formatRelative(now + 60_000, now)).toBe('Just now');
  });
});

describe('numbers', () => {
  it('groups the Indian way', () => {
    expect(formatCount(123456)).toBe('1,23,456');
    expect(formatCount(1412)).toBe('1,412');
  });

  it('writes rupees', () => {
    expect(formatRupees(123456)).toBe('₹1,23,456');
    expect(formatRupees(9972720)).toBe('₹99,72,720');
    expect(formatRupees(42, { decimals: 2 })).toBe('₹42.00');
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(-1500)).toBe('-₹1,500');
  });

  it('writes litres to one decimal', () => {
    expect(formatLitres(14.5)).toBe('14.5 L');
    expect(formatLitres(9)).toBe('9.0 L');
    expect(formatLitres(123456.78)).toBe('1,23,456.8 L');
    expect(formatLitres(24318, { decimals: 0 })).toBe('24,318 L');
  });

  it('writes kilograms', () => {
    expect(formatKg(102300)).toBe('1,02,300 kg');
    expect(formatKg(12.5)).toBe('12.5 kg');
  });
});

describe('formatPhone', () => {
  it('masks like the prototype', () => {
    expect(formatPhone('+919822012341')).toBe('+91 98220 •••41');
    expect(formatPhone('9822012341')).toBe('+91 98220 •••41');
    expect(formatPhone('+91 98220 12341')).toBe('+91 98220 •••41');
  });

  it('leaves a masked number alone', () => {
    expect(formatPhone('+91 98220 •••41')).toBe('+91 98220 •••41');
  });

  it('never shows the whole of a short number', () => {
    expect(formatPhone('12345')).toBe('•••45');
  });

  it('shows a dash when there is no number', () => {
    expect(formatPhone(null)).toBe('—');
    expect(formatPhone('')).toBe('—');
  });
});
