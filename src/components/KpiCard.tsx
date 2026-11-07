import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './KpiCard.module.css';

export type KpiTone = 'green' | 'amber' | 'red' | 'blue' | 'pink' | 'grey' | 'milk' | 'navy';

export interface KpiTrend {
  direction: 'up' | 'down' | 'same';
  /** `3.6%`, or `same`. */
  text: string;
  /** A plain share such as `83%`: keeps the chip's colour but drops the arrow. */
  plain?: boolean;
}

interface KpiCardProps {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: KpiTone;
  trend?: KpiTrend;
  /** A small marker at the end of the head, such as `STEP 1`. Hidden on a phone. */
  step?: string;
  /** A pill beside the value. */
  chip?: ReactNode;
  /** Makes the whole card a link. */
  to?: string;
}

const TREND_PREFIX = { up: '↑', down: '↓', same: '=' };

export function KpiCard({
  label,
  value,
  note,
  icon,
  tone = 'green',
  trend,
  step,
  chip,
  to,
}: KpiCardProps) {
  const content = (
    <>
      <div className={styles.head}>
        {icon && (
          <span className={styles.icon} data-tone={tone}>
            {icon}
          </span>
        )}
        <span className={styles.label}>{label}</span>
        {step && <span className={styles.step}>{step}</span>}
      </div>
      <div className={styles.values}>
        <span className={styles.value}>{value}</span>
        {trend && (
          <span className={styles.trend} data-direction={trend.direction}>
            {!trend.plain && <span aria-hidden="true">{TREND_PREFIX[trend.direction]}</span>}{' '}
            {trend.text}
          </span>
        )}
        {chip}
      </div>
      {note && <span className={styles.note}>{note}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={`${styles.card} ${styles.link}`}>
      {content}
    </Link>
  ) : (
    <div className={styles.card}>{content}</div>
  );
}

/** The row of KPI cards: as many as fit on desktop, two across on a phone. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}
