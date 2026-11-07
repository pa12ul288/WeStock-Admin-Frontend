const TIME_ZONE = 'Asia/Kolkata';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** India is UTC+5:30 all year, so calendar days can be counted with plain arithmetic. */
const IST_OFFSET = 330 * MINUTE;
const NOTHING = '—';

export type DateInput = Date | number | string;

function toMs(at: DateInput | null | undefined): number | null {
  if (at === null || at === undefined) return null;
  const ms = at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at);
  return Number.isNaN(ms) ? null : ms;
}

const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partsOf(ms: number) {
  const parts = dateParts.formatToParts(ms);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    weekday: part('weekday'),
    day: part('day'),
    month: part('month'),
    year: part('year'),
    time: `${part('hour')}:${part('minute')}`,
  };
}

function inIndia(
  at: DateInput | null | undefined,
  write: (parts: ReturnType<typeof partsOf>) => string,
): string {
  const ms = toMs(at);
  return ms === null ? NOTHING : write(partsOf(ms));
}

/** `Thu, 05 Nov 2026` in India time. */
export function formatWeekdayDate(at: DateInput | null | undefined): string {
  return inIndia(at, (p) => `${p.weekday}, ${p.day} ${p.month} ${p.year}`);
}

/** `05 Nov 2026` in India time. */
export function formatDate(at: DateInput | null | undefined): string {
  return inIndia(at, (p) => `${p.day} ${p.month} ${p.year}`);
}

/** `05 Nov` in India time, for table rows and chart labels. */
export function formatDayMonth(at: DateInput | null | undefined): string {
  return inIndia(at, (p) => `${p.day} ${p.month}`);
}

/** `06:40` on the 24-hour clock in India time. */
export function formatTime(at: DateInput | null | undefined): string {
  return inIndia(at, (p) => p.time);
}

/** `05 Nov · 06:40` in India time. */
export function formatDateTime(at: DateInput | null | undefined): string {
  return inIndia(at, (p) => `${p.day} ${p.month} · ${p.time}`);
}

/** `20 min ago`, `2 h ago`, `Yesterday`, `4 days ago`; past a month, the date. Days are India days. */
export function formatRelative(
  at: DateInput | null | undefined,
  now: DateInput = Date.now(),
): string {
  const ms = toMs(at);
  const nowMs = toMs(now);
  if (ms === null || nowMs === null) return NOTHING;
  const ago = nowMs - ms;
  if (ago < MINUTE) return 'Just now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  const days = Math.floor((nowMs + IST_OFFSET) / DAY) - Math.floor((ms + IST_OFFSET) / DAY);
  if (days === 0) return `${Math.floor(ago / HOUR)} h ago`;
  if (days === 1) return 'Yesterday';
  if (days <= 30) return `${days} days ago`;
  return formatDate(ms);
}

function grouped(value: number, minDecimals: number, maxDecimals: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

/** A whole number with Indian grouping, like `1,23,456`. */
export function formatCount(value: number): string {
  return grouped(value, 0, 0);
}

/** `₹1,23,456`; pass `decimals: 2` for prices like `₹42.00`. */
export function formatRupees(value: number, { decimals = 0 } = {}): string {
  const text = `₹${grouped(Math.abs(value), decimals, decimals)}`;
  return value < 0 ? `-${text}` : text;
}

/** `14.5 L`; pass `decimals: 0` for large totals like `24,318 L`. */
export function formatLitres(value: number, { decimals = 1 } = {}): string {
  return `${grouped(value, decimals, decimals)} L`;
}

/** `1,02,300 kg`, keeping one decimal only when there is one: `12.5 kg`. */
export function formatKg(value: number): string {
  return `${grouped(value, 0, 1)} kg`;
}

/** `+91 98220 •••41`. A value that is already masked is returned as it is. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return NOTHING;
  if (phone.includes('•')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return `•••${digits.slice(-2)}`;
  const national = digits.slice(-10);
  return `+91 ${national.slice(0, 5)} •••${national.slice(-2)}`;
}
