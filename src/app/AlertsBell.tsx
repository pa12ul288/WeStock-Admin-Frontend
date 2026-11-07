import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Overview } from '../data/types';
import { useOverview } from '../features/dashboard/queries';
import { errorMessage } from '../lib/errors';
import { formatCount } from '../lib/format';
import { useDismiss } from './useDismiss';
import styles from './AlertsBell.module.css';

const READ_KEY = 'westock-admin-alerts-read-v1';

type Tone = 'pink' | 'blue' | 'red' | 'amber';

const GROUPS: {
  key: keyof Overview['needs_attention'];
  title: string;
  note: string;
  to: string;
  icon: string;
  tone: Tone;
}[] = [
  {
    key: 'golden_ending_6h',
    title: 'Golden periods ending soon',
    note: 'Best time to inseminate ends within 6 hours',
    to: '/reproduction',
    icon: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    tone: 'pink',
  },
  {
    key: 'vaccines_overdue',
    title: 'Vaccines overdue',
    note: 'Across all farms',
    to: '/health',
    icon: 'M18 2l4 4M15 5l4 4M7 13l4 4M4 20l3-3M8 10l6 6 5-5-6-6z',
    tone: 'blue',
  },
  {
    key: 'animals_sick',
    title: 'Animals marked sick',
    note: 'Across all farms',
    to: '/health?tab=issues',
    icon: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    tone: 'red',
  },
  {
    key: 'may_deliver_7d',
    title: 'May deliver this week',
    note: 'Pregnant, due in 7 days or less',
    to: '/reproduction',
    icon: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z',
    tone: 'pink',
  },
  {
    key: 'farms_quiet_3d',
    title: 'Farms not logging milk',
    note: 'No milk entry for 3 or more days',
    to: '/farmers',
    icon: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM4 4l16 16',
    tone: 'amber',
  },
];

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
