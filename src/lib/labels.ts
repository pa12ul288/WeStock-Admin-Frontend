import type { AnimalGender, HealthStatus, Lang, Shed } from '../data/types';

export const LANGUAGE_LABELS: Record<Lang, string> = {
  hi: 'Hindi',
  mr: 'Marathi',
  ml: 'Malayalam',
  gu: 'Gujarati',
  ta: 'Tamil',
  en: 'English',
};

/** The order the prototype's filters use. */
export const LANGUAGES: readonly Lang[] = ['hi', 'mr', 'ml', 'gu', 'ta', 'en'];

export const STATES: readonly string[] = [
  'Maharashtra',
  'Gujarat',
  'Kerala',
  'Tamil Nadu',
  'Uttar Pradesh',
  'Haryana',
];

export function isLang(value: string): value is Lang {
  return (LANGUAGES as readonly string[]).includes(value);
}

export const GENDER_LABELS: Record<AnimalGender, string> = { female: 'Female', male: 'Male' };

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  detected: 'Detected',
  sick: 'Sick',
  condition: 'Long-term',
  resolved: 'Resolved',
};

export const HEALTH_TONES = {
  detected: 'amber',
  sick: 'red',
  condition: 'grey',
  resolved: 'green',
} as const satisfies Record<HealthStatus, string>;

/** `S1 · Main shed`, or the code or name alone when the other is missing. */
export function formatShed(shed: Pick<Shed, 'code' | 'name'> | null | undefined): string {
  return [shed?.code, shed?.name].filter(Boolean).join(' · ');
}

/** `4821 7703 9125`, however it was typed. */
export function formatAadhaar(digits: string): string {
  return digits.replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** `Kolhapur, Maharashtra`, or a dash when neither is known. */
export function formatPlace(district: string | null, state: string | null): string {
  return [district, state].filter(Boolean).join(', ') || '—';
}
