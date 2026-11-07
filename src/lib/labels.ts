import type { Lang } from '../data/types';

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

/** `Kolhapur, Maharashtra`, or a dash when neither is known. */
export function formatPlace(district: string | null, state: string | null): string {
  return [district, state].filter(Boolean).join(', ') || '—';
}
