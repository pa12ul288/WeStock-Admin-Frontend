import { describe, expect, it } from 'vitest';
import {
  countdown,
  dueText,
  findAnimal,
  formatDuration,
  formatGoldenWindow,
  formatHeatStarted,
  goldenNow,
  heatAnswer,
  whenToIso,
} from './helpers';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-11-05T06:30:00Z'); // 12:00 in India

const golden = (hoursLeft: number) => ({
  golden_start: new Date(NOW + (hoursLeft - 10) * HOUR).toISOString(),
  golden_end: new Date(NOW + hoursLeft * HOUR).toISOString(),
});

describe('goldenNow', () => {
  it('keeps periods ending within 6 hours, closest first', () => {
    const rows = [golden(5), golden(0.5), golden(6.5), golden(-1), golden(6)];
    expect(goldenNow(rows, NOW)).toEqual([golden(0.5), golden(5), golden(6)]);
  });

  it('skips a cycle with no golden period', () => {
    expect(goldenNow([{ golden_start: null, golden_end: null }], NOW)).toEqual([]);
  });
});

describe('formatDuration', () => {
  it('writes minutes and hours as the design does', () => {
    expect(formatDuration(15 * 60_000)).toBe('15 min');
    expect(formatDuration(100 * 60_000)).toBe('1 h 40 min');
    expect(formatDuration(8 * HOUR)).toBe('8 h');
  });

  it('rounds up, so it never says 0 while time is left', () => {
    expect(formatDuration(1000)).toBe('1 min');
    expect(formatDuration(59.5 * 60_000)).toBe('1 h');
  });
});

describe('countdown', () => {
  it('turns urgent as the end nears', () => {
    expect(countdown(golden(0.25), NOW)).toMatchObject({
      left: '15 min',
      label: 'left · ends very soon',
      tone: 'urgent',
    });
    expect(countdown(golden(1.5), NOW)).toMatchObject({ label: 'left', tone: 'urgent' });
    expect(countdown(golden(5), NOW)).toMatchObject({ label: 'left · on track', tone: 'ok' });
  });

  it('shows how much has gone', () => {
    expect(countdown(golden(8), NOW).percent).toBeCloseTo(20);
  });

  it('counts to the start when it has not begun', () => {
    expect(countdown(golden(10.5), NOW)).toMatchObject({
      left: '30 min',
      label: 'until it starts',
      tone: 'wait',
      percent: 0,
    });
  });
});

describe('heatAnswer', () => {
  const answer = (source: 'sensor' | 'manual', heat_confirmed: boolean | null, who = 'Collar') =>
    heatAnswer({ source, heat_confirmed }, who);

  it('reads the farmer’s answer to a collar alert', () => {
    expect(answer('sensor', true)).toMatchObject({ answer: 'Yes', card: 'Farmer said yes' });
    expect(answer('sensor', null)).toMatchObject({ answer: 'Waiting', card: 'Waiting for farmer' });
    expect(answer('sensor', false)).toMatchObject({ answer: 'No, false alert', tone: 'red' });
  });

  it('needs no answer when somebody reported it', () => {
    expect(answer('manual', true, 'Farmer')).toMatchObject({
      answer: 'Not needed',
      card: 'Entered by farmer',
    });
    expect(answer('manual', null, 'Staff').card).toBe('Entered by staff');
  });
});

describe('dates', () => {
  it('says today and yesterday in India time', () => {
    expect(formatHeatStarted('2026-11-05T01:00:00Z', NOW)).toBe('Today 06:30');
    expect(formatHeatStarted('2026-11-04T13:35:00Z', NOW)).toBe('Yesterday 19:05');
    expect(formatHeatStarted('2026-11-02T13:35:00Z', NOW)).toBe('02 Nov · 19:05');
    expect(formatHeatStarted(null, NOW)).toBe('—');
  });

  it('closes a golden period that has passed', () => {
    expect(formatGoldenWindow(golden(-1), NOW)).toBe('Closed');
    expect(formatGoldenWindow(golden(2), NOW)).toBe('04:00 – 14:00');
    expect(formatGoldenWindow({ golden_start: null, golden_end: null }, NOW)).toBe('—');
  });

  it('reads the When box as India time', () => {
    expect(whenToIso('2026-11-05T12:00')).toBe('2026-11-05T06:30:00.000Z');
  });

  it('words the due date', () => {
    expect(dueText(6)).toBe('in 6 days');
    expect(dueText(1)).toBe('in 1 day');
    expect(dueText(0)).toBe('today');
    expect(dueText(-2)).toBe('2 days late');
  });
});

describe('findAnimal', () => {
  const animal = (
    id: string,
    tag_number: string,
    name: string | null,
    gender: 'female' | 'male',
  ) => ({ id, tag_number, name, gender });
  const herd = [
    animal('a', '11', 'Shanti', 'female'),
    animal('b', '12', null, 'female'),
    animal('c', '13', 'Nandi', 'male'),
    animal('d', '14', 'Rani', 'female'),
    animal('e', '15', 'Rani', 'female'),
  ];

  it('finds by tag and name, tag or name', () => {
    expect(findAnimal('11 Shanti', herd)?.id).toBe('a');
    expect(findAnimal(' 11  shanti ', herd)?.id).toBe('a');
    expect(findAnimal('12', herd)?.id).toBe('b');
    expect(findAnimal('Shanti', herd)?.id).toBe('a');
  });

  it('won’t guess, and leaves males out', () => {
    expect(findAnimal('Rani', herd)).toBeNull();
    expect(findAnimal('13', herd)).toBeNull();
    expect(findAnimal('99', herd)).toBeNull();
    expect(findAnimal('', herd)).toBeNull();
  });
});
