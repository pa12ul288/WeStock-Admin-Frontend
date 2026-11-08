import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ATTENTION_GROUPS as GROUPS } from '../features/dashboard/attention';
import { useOverview } from '../features/dashboard/queries';
import { errorMessage } from '../lib/errors';
import { formatCount } from '../lib/format';
import { useDismiss } from './useDismiss';
import styles from './AlertsBell.module.css';

const READ_KEY = 'westock-admin-alerts-read-v1';

function readSeen(): string | null {
  try {
    return localStorage.getItem(READ_KEY);
  } catch {
    return null;
  }
}

function writeSeen(value: string): void {
  try {
    localStorage.setItem(READ_KEY, value);
  } catch {
    // Read state is only a convenience.
  }
}

export function AlertsBell() {
  const { data, error, isPending } = useOverview();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useDismiss(
    open,
    (viaEscape) => {
      setOpen(false);
      if (viaEscape) button.current?.focus();
    },
    box,
  );

  const attention = data?.needs_attention;
  // "Read" holds for the counts it was marked at; new counts count as new again.
  const fingerprint = attention ? GROUPS.map((g) => attention[g.key]).join('|') : '';
  const unread =
    attention && fingerprint !== seen ? GROUPS.filter((g) => attention[g.key] > 0).length : 0;

  return (
    <div ref={box} className={styles.wrap}>
      <button
        ref={button}
        type="button"
        className={styles.bell}
        aria-label={unread > 0 ? `Alerts, ${unread} new` : 'Alerts'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className={styles.pop} role="dialog" aria-label="Alerts">
          <div className={styles.head}>
            <span className={styles.heading}>Alerts</span>
            {unread > 0 && (
              <button
                type="button"
                className={styles.markRead}
                onClick={() => {
                  setSeen(fingerprint);
                  writeSeen(fingerprint);
                }}
              >
                Mark all as read
              </button>
            )}
          </div>
          {isPending && <p className={styles.message}>Loading…</p>}
          {error && <p className={styles.message}>{errorMessage(error)}</p>}
          {attention &&
            GROUPS.map((group) => (
              <Link
                key={group.key}
                to={group.to}
                className={styles.row}
                onClick={() => setOpen(false)}
              >
                <span className={styles.icon} data-tone={group.tone}>
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={group.icon} />
                  </svg>
                </span>
                <span className={styles.text}>
                  <span className={styles.title}>{group.title}</span>
                  <span className={styles.note}>{group.note}</span>
                </span>
                <span className={styles.value}>{formatCount(attention[group.key])}</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
