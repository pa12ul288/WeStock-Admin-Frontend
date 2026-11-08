import { describe, expect, it } from 'vitest';
import type { AuditLogEntry, FarmListRow } from '../../data/types';
import { LANGUAGE_LABELS } from '../../lib/labels';
import type { DescribedEntry } from '../staff/audit';
import {
  changeWhen,
  greeting,
  issueText,
  labelSpacing,
  languageShares,
  matchesIssue,
  milkBars,
  parseIssue,
  parsePeriod,
  peakIndex,
  speciesShares,
  staffChangeLine,
  trendChip,
} from './helpers';

const NOW = '2026-11-05T12:30:00+05:30';

function entry(patch: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: 1,
    at: '2026-11-05T12:16:00+05:30',
    staff_id: 's2',
    staff_name: 'Priya Sharma',
    action: 'update',
    table_name: 'milk_entries',
    record_id: 'm1',
    farm_id: 'f1',
    changes: {},
    note: null,
    ...patch,
  };
}

function described(patch: Partial<DescribedEntry>, entryPatch: Partial<AuditLogEntry> = {}) {
  return {
    entry: entry(entryPatch),
    kind: 'edited',
    record: 'Milk entry · 04 Shyama, evening',
    farm: 'Yadav Dairy',
    changes: [],
    note: null,
    ...patch,
  } as DescribedEntry;
}

describe('dashboard helpers', () => {
  it('reads the period and issue from the URL', () => {
    expect(parsePeriod('7')).toBe(7);
    expect(parsePeriod('90')).toBe(90);
    expect(parsePeriod('')).toBe(30);
    expect(parsePeriod('12')).toBe(30);
    expect(parseIssue('milk')).toBe('milk');
    expect(parseIssue('nope')).toBe('all');
  });

  it('greets by India time', () => {
    expect(greeting('2026-11-05T09:00:00+05:30')).toBe('Good morning');
    expect(greeting('2026-11-05T14:00:00+05:30')).toBe('Good afternoon');
    expect(greeting('2026-11-05T19:00:00+05:30')).toBe('Good evening');
  });

  it('turns a trend into a chip', () => {
    expect(trendChip(6.2)).toEqual({ direction: 'up', text: '6%' });
    expect(trendChip(-4)).toEqual({ direction: 'down', text: '4%' });
    expect(trendChip(0)).toEqual({ direction: 'same', text: 'same' });
  });

  it('labels milk bars like the design and finds the peak', () => {
    const bars = milkBars([
      { day: '2026-10-06', litres: 10 },
      { day: '2026-11-03', litres: 30 },
      { day: '2026-11-04', litres: 20 },
    ]);
    expect(bars.map((bar) => bar.label)).toEqual(['6/10', '3/11', '4/11']);
    expect(peakIndex(bars)).toBe(1);
    expect(peakIndex([])).toBe(-1);
    expect(labelSpacing(90).desktop).toBeGreaterThan(1);
  });

  it('words and filters the farm issues', () => {
    const farm = { last_entry_at: '2026-11-01T10:00:00+05:30' } as FarmListRow;
    expect(issueText({ farm, issue: 'quiet' }, NOW)).toBe('No milk for 4 days');
    expect(issueText({ farm, issue: 'vaccines_overdue' }, NOW)).toBe('Vaccines overdue');
    expect(matchesIssue({ farm, issue: 'sick' }, 'health')).toBe(true);
    expect(matchesIssue({ farm, issue: 'sick' }, 'milk')).toBe(false);
    expect(matchesIssue({ farm, issue: 'golden_ending' }, 'breeding')).toBe(true);
    expect(matchesIssue({ farm, issue: 'quiet' }, 'all')).toBe(true);
  });

  it('groups species into the five rows and shares languages', () => {
    const shares = speciesShares([
      { species_id: 'cattle', category: 'large_ruminant', animals: 70 },
      { species_id: 'buffalo', category: 'large_ruminant', animals: 20 },
      { species_id: 'sheep', category: 'small_ruminant', animals: 6 },
      { species_id: 'pig', category: 'swine', animals: 4 },
    ]);
    expect(shares.map((row) => [row.label, row.count, row.percent])).toEqual([
      ['Cattle', 70, 70],
      ['Buffalo', 20, 20],
      ['Goat', 0, 0],
      ['Poultry', 0, 0],
      ['Sheep, pig, horse & other', 10, 10],
    ]);
    const languages = languageShares(
      [
        { language: 'en', farmers: 1 },
        { language: 'hi', farmers: 3 },
      ],
      LANGUAGE_LABELS,
    );
    expect(languages[0]).toMatchObject({ label: 'Hindi', native: 'हिन्दी', percent: 75 });
    expect(languages[1]).toMatchObject({ label: 'English', native: undefined, percent: 25 });
  });

  it('writes log rows as sentences', () => {
    expect(
      staffChangeLine(described({ changes: [{ field: 'Litres', from: '75.0', to: '7.5' }] }), NOW),
    ).toEqual({
      who: 'Priya Sharma',
      what: 'corrected a milk entry, 75.0 → 7.5 L',
      where: 'Yadav Dairy · 04 Shyama, evening',
      when: '12:16',
    });
    expect(
      staffChangeLine(
        described(
          { kind: 'done', record: 'FMD vaccine · 07 Kali', farm: 'Shree Ganesh Dairy' },
          { table_name: 'vaccinations' },
        ),
        NOW,
      ).what,
    ).toBe('marked the FMD vaccine done');
    const role = staffChangeLine(
      described(
        {
          kind: 'role',
          record: 'Farm member · Ganpat Jadhav',
          farm: 'Shree Ganesh Dairy',
          changes: [{ field: 'Role', from: 'Member', to: 'Manager' }],
        },
        { table_name: 'farm_members' },
      ),
      NOW,
    );
    expect(role.what).toBe('made Ganpat Jadhav a manager');
    expect(role.where).toBe('Shree Ganesh Dairy');
  });

  it('says when, the way the design does', () => {
    expect(changeWhen('2026-11-05T09:58:00+05:30', NOW)).toBe('09:58');
    expect(changeWhen('2026-11-04T09:58:00+05:30', NOW)).toBe('Yesterday');
    expect(changeWhen('2026-11-01T09:58:00+05:30', NOW)).toBe('01 Nov');
  });
});
