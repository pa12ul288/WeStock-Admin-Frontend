import type { ReactNode } from 'react';
import styles from './StatusPill.module.css';

export type PillTone = 'green' | 'amber' | 'red' | 'blue' | 'pink' | 'grey';

interface StatusPillProps {
  tone: PillTone;
  /** A small dot before the text, as on collar and health pills. */
  dot?: boolean;
  /** Numbers in Poppins with tabular figures, as on collar temperatures. */
  numeric?: boolean;
  /** Always the state in words: colour is never the only signal. */
  children: ReactNode;
}

export function StatusPill({ tone, dot = false, numeric = false, children }: StatusPillProps) {
  return (
    <span className={styles.pill} data-tone={tone}>
      {dot && <i className={styles.dot} aria-hidden="true" />}
      {numeric ? <span className={styles.numeric}>{children}</span> : children}
    </span>
  );
}
