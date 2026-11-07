import { z } from 'zod';
import { DataError } from '../../data/errors';
import { errorMessage } from '../../lib/errors';

/** Empty, or exactly 12 digits; spaces are fine because the page shows it grouped. */
export const aadhaarField = z
  .string()
  .refine(
    (value) => /^(\d{12})?$/.test(value.replace(/\s/g, '')),
    'Pashu Aadhaar has 12 digits. Leave it empty if the animal has none.',
  );

/** The field a failed save belongs to, so its message can go under that field. */
export function serverFieldError(error: unknown): { field: string; message: string } | null {
  if (!(error instanceof DataError) || !error.field) return null;
  return { field: error.field, message: errorMessage(error) };
}
