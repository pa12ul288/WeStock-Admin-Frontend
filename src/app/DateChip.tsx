import { useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { monthGrid, monthTitle, shiftMonth } from '../lib/calendar';
import { formatWeekdayDate, indiaDay } from '../lib/format';
import { useReducedMotion } from '../lib/motion';
import { popProps } from '../lib/motionProps';
import { useDismiss } from './useDismiss';
import styles from './DateChip.module.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(day: string): { year: number; month: number; date: number } {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number);
  return { year, month: month - 1, date };
}

function Chevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** Today's date in the top bar. It opens a month calendar with today marked (India time). */
export function DateChip() {
  const today = parts(indiaDay());
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: today.year, month: today.month });
  const reduced = useReducedMotion();
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

  const title = monthTitle(view.year, view.month);
  const isThisMonth = view.year === today.year && view.month === today.month;

  function toggle() {
    // Always open on the current month.
    if (!open) setView({ year: today.year, month: today.month });
    setOpen((value) => !value);
  }

  return (
    <div ref={box} className={styles.wrap}>
      <button
        ref={button}
        type="button"
        className={styles.date}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Today is ${formatWeekdayDate(Date.now())}. Open calendar`}
        onClick={toggle}
      >
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" />
        </svg>
        {formatWeekdayDate(Date.now())}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            className={styles.pop}
            role="dialog"
            aria-label="Calendar"
            style={{ transformOrigin: '100% 0' }}
            {...popProps(reduced)}
          >
            <div className={styles.head}>
              <button
                type="button"
                className={styles.step}
                aria-label="Previous month"
                onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}
              >
                <Chevron flip />
              </button>
              <span className={styles.title} aria-live="polite">
                {title}
              </span>
              <button
                type="button"
                className={styles.step}
                aria-label="Next month"
                onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}
              >
                <Chevron />
              </button>
            </div>
            <table className={styles.grid} aria-label={title}>
              <thead>
                <tr>
                  {WEEKDAYS.map((name) => (
                    <th key={name} scope="col">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthGrid(view.year, view.month).map((week, row) => (
                  <tr key={row}>
                    {week.map((date, col) => {
                      const isToday = isThisMonth && date === today.date;
                      return (
                        <td key={col}>
                          {date !== null && (
                            <span
                              className={isToday ? styles.today : styles.day}
                              aria-current={isToday ? 'date' : undefined}
                            >
                              {date}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isThisMonth && (
              <button
                type="button"
                className={styles.back}
                onClick={() => setView({ year: today.year, month: today.month })}
              >
                Back to today
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
