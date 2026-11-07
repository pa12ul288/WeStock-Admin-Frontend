import type { ISODate, ISODateTime } from '../types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** India is UTC+5:30 all year, so plain arithmetic is exact. */
const IST_OFFSET = 330 * MINUTE;

/** The calendar date in Asia/Kolkata at this instant. */
export function istDate(ms: number): ISODate {
  return new Date(ms + IST_OFFSET).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** The instant of a wall-clock time in Asia/Kolkata on a date. */
export function istInstant(date: ISODate, hour: number, minute = 0): number {
  return Date.parse(`${date}T00:00:00Z`) + hour * HOUR + minute * MINUTE - IST_OFFSET;
}

/** UTC ISO 8601 without milliseconds, e.g. '2026-11-05T06:30:00Z'. */
export function toIso(ms: number): ISODateTime {
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

/** Whole days from one calendar date to another. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}
