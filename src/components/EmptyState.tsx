import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title?: string;
  note?: ReactNode;
  /** Shows the button. */
  onAction?: () => void;
  actionLabel?: string;
}

export function EmptyState({
  title = 'Nothing matches these filters',
  note,
  onAction,
  actionLabel = 'Clear filters',
}: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.title}>{title}</span>
      {note && <span className={styles.note}>{note}</span>}
      {onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
