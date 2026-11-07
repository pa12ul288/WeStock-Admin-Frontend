import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

/** The white rounded panel. `flush` drops the padding, for a card holding a table. */
export function Card({
  flush = false,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { flush?: boolean }) {
  return (
    <section
      className={[styles.card, flush ? styles.flush : styles.padded, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}
