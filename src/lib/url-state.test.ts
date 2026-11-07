import { describe, expect, it } from 'vitest';
import { applyUrlPatch, parsePage, parseSort } from './url-state';

const params = (query: string) => new URLSearchParams(query);

describe('applyUrlPatch', () => {
  it('sets values and leaves the others', () => {
    expect(applyUrlPatch(params('farm=a'), { q: 'gauri' }).toString()).toBe('farm=a&q=gauri');
  });

  it('removes empty values', () => {
    expect(applyUrlPatch(params('q=x&farm=a'), { q: '' }).toString()).toBe('farm=a');
    expect(applyUrlPatch(params('q=x'), { q: null }).toString()).toBe('');
  });

  it('keeps default values out of the URL', () => {
    const next = applyUrlPatch(params('view=farms'), { view: 'farmers' }, { view: 'farmers' });
    expect(next.toString()).toBe('');
  });

  it('goes back to page 1 when a filter changes', () => {
    expect(applyUrlPatch(params('page=3&farm=a'), { farm: 'b' }).toString()).toBe('farm=b');
  });

  it('keeps the filters when the page changes', () => {
    expect(applyUrlPatch(params('farm=a'), { page: 2 }).toString()).toBe('farm=a&page=2');
  });

  it('can keep the page', () => {
    expect(applyUrlPatch(params('page=3'), { sort: 'date-asc' }, {}, true).toString()).toBe(
      'page=3&sort=date-asc',
    );
  });

  it('does not change what it was given', () => {
    const current = params('q=x');
    applyUrlPatch(current, { q: 'y' });
    expect(current.get('q')).toBe('x');
  });
});

describe('parsePage', () => {
  it('reads whole page numbers', () => {
    expect(parsePage('3')).toBe(3);
  });

  it.each([null, '', '0', '-2', '1.5', 'abc'])('turns %s into page 1', (raw) => {
    expect(parsePage(raw)).toBe(1);
  });
});

describe('parseSort', () => {
  const fallback = { key: 'date', dir: 'desc' } as const;

  it('reads key and direction', () => {
    expect(parseSort('last_entry-asc', fallback)).toEqual({ key: 'last_entry', dir: 'asc' });
  });

  it.each([null, '', 'date', 'date-sideways'])('falls back on %s', (raw) => {
    expect(parseSort(raw, fallback)).toEqual(fallback);
  });
});
