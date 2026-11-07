import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows, toCsv } from './csv';

describe('toCsv', () => {
  it('starts with a BOM and ends lines the way Excel expects', () => {
    expect(toCsv(['Tag', 'Name'], [['01', 'Gauri']])).toBe('﻿Tag,Name\r\n01,Gauri\r\n');
  });

  it('quotes commas, quotes and line breaks', () => {
    const csv = toCsv(['Note'], [['a,b'], ['say "hi"'], ['two\nlines']]);
    expect(csv).toBe('﻿Note\r\n"a,b"\r\n"say ""hi"""\r\n"two\nlines"\r\n');
  });

  it('writes empty cells for missing values, and numbers and booleans as they are', () => {
    expect(toCsv(['a', 'b', 'c', 'd'], [[null, undefined, 14.5, true]])).toBe(
      '﻿a,b,c,d\r\n,,14.5,true\r\n',
    );
  });

  it('keeps Indian scripts intact', () => {
    expect(toCsv(['Name'], [['गौरी'], ['കാളി']])).toContain('गौरी\r\nകാളി');
  });

  it('stops a spreadsheet running farmer text as a formula', () => {
    const csv = toCsv(['Note'], [['=1+1'], ['@cmd'], ['+cmd'], ['-cmd'], ['=a,b']]);
    expect(csv.split('\r\n').slice(1, 6)).toEqual([`'=1+1`, `'@cmd`, `'+cmd`, `'-cmd`, `"'=a,b"`]);
  });

  it('leaves phone numbers and negative numbers alone', () => {
    const csv = toCsv(['Value'], [['+91 98220 •••41'], ['-12.5'], [-3]]);
    expect(csv.split('\r\n').slice(1, 4)).toEqual(['+91 98220 •••41', '-12.5', '-3']);
  });
});

describe('fetchAllRows', () => {
  const pager = (total: number) =>
    vi.fn(async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const start = (page - 1) * pageSize;
      const length = Math.max(0, Math.min(pageSize, total - start));
      return { rows: Array.from({ length }, (_, i) => start + i), total };
    });

  it('fetches every chunk in order and stops at the total', async () => {
    const fetchPage = pager(25);
    const result = await fetchAllRows(fetchPage, { chunkSize: 10 });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.rows).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(result).toMatchObject({ total: 25, truncated: false });
  });

  it('uses chunks of 1,000 by default', async () => {
    const fetchPage = pager(5);
    await fetchAllRows(fetchPage);
    expect(fetchPage).toHaveBeenCalledWith({ page: 1, pageSize: 1000 });
  });

  it('makes one call when there is nothing to fetch', async () => {
    const fetchPage = pager(0);
    const result = await fetchAllRows(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.rows).toEqual([]);
  });

  it('stops at the row cap and says so', async () => {
    const fetchPage = pager(100);
    const result = await fetchAllRows(fetchPage, { chunkSize: 10, maxRows: 25 });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.rows).toHaveLength(25);
    expect(result).toMatchObject({ total: 100, truncated: true });
  });

  it('does not loop forever if a page comes back empty', async () => {
    const fetchPage = vi.fn(async () => ({ rows: [], total: 50 }));
    await fetchAllRows(fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('reports progress', async () => {
    const onProgress = vi.fn();
    await fetchAllRows(pager(15), { chunkSize: 10, onProgress });
    expect(onProgress.mock.calls).toEqual([
      [10, 15],
      [15, 15],
    ]);
  });

  it('can be cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchAllRows(pager(5), { signal: controller.signal })).rejects.toThrow();
  });
});
