import type {
  AnalyticsSeries,
  AnimalListRow,
  CycleRow,
  FarmDashboard,
  FarmMember,
  FeedRow,
  HealthRow,
  MilkRow,
  Shed,
  Species,
  VaccinationRow,
} from '../../data/types';
import {
  daysSince,
  formatDayMonth,
  formatRupees,
  formatTime,
  indiaDay,
  shiftDay,
} from '../../lib/format';

const PLURALS: Record<string, string> = { goat: 'goats', pig: 'pigs', horse: 'horses' };

const speciesWord = (species: Species | undefined, id: string) => {
  const word = (species?.labels.en ?? id).toLowerCase();
  return PLURALS[word] ?? word;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** `41 cattle · 17 buffalo · 6 goats`, biggest group first. */
export function speciesMix(counts: Record<string, number>, species: readonly Species[]): string {
  const parts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([id, count]) =>
        `${count} ${speciesWord(
          species.find((item) => item.id === id),
          id,
        )}`,
    );
  return parts.join(' · ');
}

export function milkTodayNote(today: FarmDashboard['milk_today']): string {
  const sessions = [
    today.morning > 0 && 'morning',
    today.afternoon > 0 && 'afternoon',
    today.evening > 0 && 'evening',
  ].filter((session): session is string => Boolean(session));
  if (sessions.length === 0) return 'No milk logged yet today';
  const joined =
    sessions.length === 1
      ? sessions[0]
      : `${sessions.slice(0, -1).join(', ')} and ${sessions.at(-1)}`;
  const text = joined ?? '';
  const capital = text.charAt(0).toUpperCase() + text.slice(1);
  return sessions.length === 3 ? capital : `${capital} so far`;
}

export function memberNote(members: readonly Pick<FarmMember, 'role'>[]): string {
  const count = (role: FarmMember['role']) => members.filter((m) => m.role === role).length;
  return [
    plural(count('owner'), 'owner', 'owners'),
    plural(count('manager'), 'manager', 'managers'),
    plural(count('worker'), 'worker', 'workers'),
  ].join(' · ');
}

export interface FarmRecords {
  oldestOverdueDays: number | null;
  givenThisMonth: number;
  resolvedThisMonth: number;
  comingUp: ComingUpItem[];
}

export interface ComingUpItem {
  key: string;
  day: string;
  isToday: boolean;
  month: string;
  dayOfMonth: string;
  what: string;
  detail: string;
  kind: 'breeding' | 'vaccine';
}

const animalName = (animal: { name: string | null; tag_number: string }) =>
  animal.name ?? `Tag ${animal.tag_number}`;

/** `FMD (foot-and-mouth)` reads `FMD` in a one-line title. */
const shortVaccine = (name: string) => name.replace(/\s*\(.*\)\s*$/, '');

const COMING_UP_DAYS = 30;
const COMING_UP_SHOWN = 4;

export function buildComingUp(
  heat: readonly CycleRow[],
  pregnant: readonly CycleRow[],
  vaccinations: readonly VaccinationRow[],
  now: number = Date.now(),
): ComingUpItem[] {
  const today = indiaDay(now);
  const end = shiftDay(today, COMING_UP_DAYS);
  const items: Omit<ComingUpItem, 'isToday' | 'month' | 'dayOfMonth'>[] = [];

  for (const cycle of heat) {
    if (!cycle.golden_end || Date.parse(cycle.golden_end) < now) continue;
    const day = indiaDay(cycle.golden_end);
    if (day > end) continue;
    items.push({
      key: cycle.id,
      day,
      what: `${animalName(cycle.animal)} · golden period ends ${formatTime(cycle.golden_end)}`,
      detail: cycle.heat_confirmed
        ? 'Heat confirmed by the farmer'
        : cycle.source === 'sensor'
          ? 'Heat picked up by the collar'
          : 'Heat logged in the app',
      kind: 'breeding',
    });
  }

  for (const cycle of pregnant) {
    const day = cycle.expected_delivery;
    if (!day || day < today || day > end) continue;
    items.push({
      key: cycle.id,
      day,
      what: `${animalName(cycle.animal)} · may deliver`,
      detail: `Pregnant, cycle ${cycle.cycle_no}`,
      kind: 'breeding',
    });
  }

  const groups = new Map<string, VaccinationRow[]>();
  for (const vaccine of vaccinations) {
    if (vaccine.done_date !== null || vaccine.due_date < today || vaccine.due_date > end) continue;
    const key = `${vaccine.due_date}|${vaccine.vaccine_name}`;
    groups.set(key, [...(groups.get(key) ?? []), vaccine]);
  }
  for (const [key, group] of groups) {
    const first = group[0];
    if (!first) continue;
    const others = group.length - 1;
    items.push({
      key,
      day: first.due_date,
      what: `${animalName(first.animal)} · ${shortVaccine(first.vaccine_name)} vaccine due`,
      detail:
        others > 0
          ? `Plus ${plural(others, 'other animal', 'other animals')}`
          : (first.description ?? 'Upcoming'),
      kind: 'vaccine',
    });
  }

  return items
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, COMING_UP_SHOWN)
    .map((item) => {
      const [dayOfMonth = '', month = ''] = formatDayMonth(`${item.day}T00:00:00Z`).split(' ');
      return { ...item, isToday: item.day === today, month: month.toUpperCase(), dayOfMonth };
    });
}

export function buildRecords(
  heat: readonly CycleRow[],
  pregnant: readonly CycleRow[],
  vaccinations: readonly VaccinationRow[],
  health: readonly HealthRow[],
  now: number = Date.now(),
): FarmRecords {
  const today = indiaDay(now);
  const month = today.slice(0, 7);
  const overdue = vaccinations
    .filter((v) => v.done_date === null && v.due_date < today)
    .map((v) => daysSince(`${v.due_date}T00:00:00+05:30`, now));
  return {
    oldestOverdueDays: overdue.length > 0 ? Math.max(...overdue) : null,
    givenThisMonth: vaccinations.filter((v) => v.done_date?.startsWith(month)).length,
    resolvedThisMonth: health.filter(
      (h) => h.resolved_at !== null && indiaDay(h.resolved_at).startsWith(month),
    ).length,
    comingUp: buildComingUp(heat, pregnant, vaccinations, now),
  };
}

export interface MilkWeek {
  bars: { day: string; label: string; litres: number }[];
  total: number;
  revenue: number;
  /** Against the 7 days before, or null when those had no milk. */
  trendPct: number | null;
  /** The bar shown dark: the week's best day, or none in a week without milk. */
  bestIndex: number | undefined;
}

/** The last 7 finished days, as on the design: today is still filling up, so it's named apart. */
export function buildMilkWeek(milk: AnalyticsSeries['milk'], now: number = Date.now()): MilkWeek {
  const today = indiaDay(now);
  const byDay = new Map(milk.map((row) => [row.day, row]));
  const litresOn = (day: string) => byDay.get(day)?.litres ?? 0;
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 7));
  const bars = days.map((day) => ({
    day,
    label: formatDayMonth(`${day}T00:00:00Z`),
    litres: Math.round(litresOn(day) * 10) / 10,
  }));
  const total = Math.round(bars.reduce((sum, bar) => sum + bar.litres, 0) * 10) / 10;
  const before = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 14)).reduce(
    (sum, day) => sum + litresOn(day),
    0,
  );
  const highest = Math.max(...bars.map((bar) => bar.litres));
  return {
    bars,
    total,
    revenue: days.reduce((sum, day) => sum + (byDay.get(day)?.revenue ?? 0), 0),
    trendPct: before > 0 ? Math.round(((total - before) / before) * 1000) / 10 : null,
    bestIndex: highest > 0 ? bars.findIndex((bar) => bar.litres === highest) : undefined,
  };
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 5, 10];

/** Four round axis ticks that fit the highest value: 340 gives 0, 150, 300, 450. */
export function milkTicks(highest: number): number[] {
  const wanted = Math.max(highest, 3) / 3;
  const scale = 10 ** Math.floor(Math.log10(wanted));
  const step = (NICE_STEPS.find((nice) => nice * scale >= wanted) ?? 10) * scale;
  return [0, step, step * 2, step * 3];
}

export interface LatestEntry {
  key: string;
  at: string;
  kind: 'milk' | 'feed' | 'health';
  text: string;
  by: string;
  staff: boolean;
}

const HEALTH_SOURCE = { manual: 'Farm member', sensor: 'Collar', gau: 'Gau' } as const;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const tagName = (animal: { name: string | null; tag_number: string }) =>
  animal.name ? `Tag ${animal.tag_number} ${animal.name}` : `Tag ${animal.tag_number}`;

/** The newest milk, feed and health entries, merged by time. */
export function buildLatest(
  milk: readonly MilkRow[],
  feed: readonly FeedRow[],
  health: readonly HealthRow[],
  sheds: readonly Shed[],
  limit = 6,
): LatestEntry[] {
  const entries: LatestEntry[] = [
    ...milk.map((row): LatestEntry => ({
      key: `milk-${row.id}`,
      at: row.created_at,
      kind: 'milk',
      text: `${row.animal ? tagName(row.animal) : 'Whole herd'} · ${row.litres.toFixed(1)} L, ${row.session}`,
      by: row.entered_by ?? '—',
      staff: row.fixed_by_staff,
    })),
    ...feed.map((row): LatestEntry => {
      const shed = sheds.find((item) => item.id === row.shed_id);
      const target = shed ? `${shed.code ?? ''} ${shed.name}`.trim() : row.fed_to;
      const cost = row.cost === null ? '' : ` · ${formatRupees(row.cost)}`;
      return {
        key: `feed-${row.id}`,
        at: row.created_at,
        kind: 'feed',
        text: `${target} · ${lowerFirst(row.feed_type)} ${row.quantity_kg} kg${cost}`,
        by: row.entered_by ?? '—',
        staff: row.fixed_by_staff,
      };
    }),
    ...health.map((row): LatestEntry => ({
      key: `health-${row.id}`,
      at: row.detected_at,
      kind: 'health',
      text: `${tagName(row.animal)} · ${lowerFirst(row.title)}, ${row.status}`,
      by: HEALTH_SOURCE[row.source],
      staff: false,
    })),
  ];
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Who lives in each shed: `28 cattle`, or `No animals yet`. The `null` key is "not in a shed". */
export function shedMixes(
  animals: readonly Pick<AnimalListRow, 'shed_id' | 'species_id'>[],
  species: readonly Species[],
): Map<string | null, { count: number; mix: string }> {
  const counts = new Map<string | null, Record<string, number>>();
  for (const animal of animals) {
    const shed = counts.get(animal.shed_id) ?? {};
    shed[animal.species_id] = (shed[animal.species_id] ?? 0) + 1;
    counts.set(animal.shed_id, shed);
  }
  const result = new Map<string | null, { count: number; mix: string }>();
  for (const [shed, bySpecies] of counts) {
    result.set(shed, {
      count: Object.values(bySpecies).reduce((sum, n) => sum + n, 0),
      mix: speciesMix(bySpecies, species),
    });
  }
  return result;
}

const PIN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/** `16.7050, 74.2433` to numbers. Empty clears the pin; `undefined` means it can't be read. */
export function parseMapPin(text: string): { lat: number; lng: number } | null | undefined {
  if (text.trim() === '') return null;
  const match = text.match(PIN);
  if (!match) return undefined;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

export function formatMapPin(lat: number | null, lng: number | null): string {
  return lat === null || lng === null ? '' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** A phone number as the 10 national digits, or null if it isn't one. */
export function nationalDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^\d{10}$/.test(national) ? national : null;
}
