/** A month as weeks (Sunday first). `null` pads the days that belong to the neighbouring months. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const lead = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from<null>({ length: lead }).fill(null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let at = 0; at < cells.length; at += 7) weeks.push(cells.slice(at, at + 7));
  return weeks;
}

/** The year and month (0 to 11) this many months after another, rolling over the year. */
export function shiftMonth(
  year: number,
  month: number,
  by: number,
): { year: number; month: number } {
  const total = year * 12 + month + by;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** `November 2026`. */
export function monthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(Date.UTC(year, month, 1));
}
