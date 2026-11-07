import type { ReactNode } from 'react';
import styles from './Field.module.css';

/** The look of a text input or select inside a dialog or form. */
export const inputClass = styles.input;

/** A label above its input, with the field's error under it. */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      {label}
      {children}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
