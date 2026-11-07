import type { Page } from '../data/types';

export type CsvCell = string | number | boolean | null | undefined;

const BOM = '﻿';
const CHUNK_SIZE = 1000;
const MAX_ROWS = 50_000;

/**
 * Farmers type these values, and a spreadsheet would run one starting with `=` as a formula, so
 * such text gets a leading apostrophe. Plain numbers and phone numbers (`+91 98220 •••41`) stay.
 */
function neutralise(text: string): string {
  if (/^[=@\t\r]/.test(text)) return `'${text}`;
  if (/^[+-]/.test(text) && !/^[+-][\d\s.,•]*$/.test(text)) return `'${text}`;
  return text;
}

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? neutralise(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** UTF-8 CSV text with a BOM, so Excel shows Hindi and other scripts correctly. */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  return BOM + [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export interface FetchAllOptions {
  chunkSize?: number;
  maxRows?: number;
  signal?: AbortSignal;
  onProgress?: (fetched: number, total: number) => void;
}

/** Runs a screen's list query page by page for an export: chunks of 1,000, capped at 50,000 rows. */
export async function fetchAllRows<T>(
  fetchPage: (paging: { page: number; pageSize: number }) => Promise<Page<T>>,
  { chunkSize = CHUNK_SIZE, maxRows = MAX_ROWS, signal, onProgress }: FetchAllOptions = {},
): Promise<{ rows: T[]; total: number; truncated: boolean }> {
  const rows: T[] = [];
  let total = 0;
  for (let page = 1; rows.length < maxRows; page += 1) {
    signal?.throwIfAborted();
    const result = await fetchPage({ page, pageSize: chunkSize });
    total = result.total;
    rows.push(...result.rows);
    onProgress?.(Math.min(rows.length, maxRows), total);
    if (result.rows.length === 0 || rows.length >= total) break;
  }
  return { rows: rows.slice(0, maxRows), total, truncated: total > maxRows };
}

/** Hands the text to the browser as a file download. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
