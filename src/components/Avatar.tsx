import type { ReactNode } from 'react';
import styles from './Avatar.module.css';

/** The first letters of the first two words: `Shree Ganesh Dairy` gives `SG`. */
export function initials(name: string | null | undefined): string {
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0]);
  return letters.join('').toUpperCase() || '?';
}

/** The round green initials; `small` is the 28 px one in log rows. */
export function Avatar({
  name,
  small = false,
}: {
  name: string | null | undefined;
  small?: boolean;
}) {
  return (
    <span className={styles.avatar} data-small={small || undefined} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Avatar, bold name and a small line under it: a person or farm in a list. */
export function AvatarName({
  name,
  note,
  numericNote = false,
}: {
  name: string | null | undefined;
  note?: ReactNode;
  /** Sets the note in Poppins, for a phone number. */
  numericNote?: boolean;
}) {
  return (
    <div className={styles.who}>
      <Avatar name={name} />
      <span className={styles.text}>
        <b>{name || '—'}</b>
        {note && <small data-numeric={numericNote || undefined}>{note}</small>}
      </span>
    </div>
  );
}
