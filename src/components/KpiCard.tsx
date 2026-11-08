import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { m } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  entryDelay,
  GSAP_EASE,
  runGsap,
  STAGGER,
  STAGGER_MAX,
  useReducedMotion,
} from '../lib/motion';
import { AnimatedValue } from './AnimatedValue';
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

const MotionLink = m.create(Link);

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
  const reduced = useReducedMotion();
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
        <span className={styles.value}>
          <AnimatedValue value={value} />
        </span>
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
  // Framer Motion owns the card's transform (hover lift, press); GSAP's entrance on the grid only
  // touches opacity and clip-path, so the two never meet on one property.
  const lift = reduced ? undefined : { y: -3 };
  return to ? (
    <MotionLink
      to={to}
      className={`${styles.card} ${styles.link}`}
      data-kpi
      whileHover={lift}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.18 }}
    >
      {content}
    </MotionLink>
  ) : (
    <m.div
      className={styles.card}
      data-kpi
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ duration: 0.18 }}
    >
      {content}
    </m.div>
  );
}

/**
 * The cards of a grid reveal one after another the first time the grid appears (GSAP: opacity and
 * clip-path only, so it never touches the card's own hover transform). Only the first few stagger.
 */
export function useKpiReveal(grid: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = grid.current;
    return runGsap(element, (gsap) => {
      const cards = Array.from(element?.querySelectorAll('[data-kpi]') ?? []).slice(0, STAGGER_MAX);
      if (cards.length === 0) return;
      gsap.fromTo(
        cards,
        { opacity: 0, clipPath: 'inset(0% 0% 100% 0% round 16px)' },
        {
          opacity: 1,
          clipPath: 'inset(0% 0% 0% 0% round 16px)',
          duration: 0.45,
          delay: entryDelay('kpi'),
          stagger: STAGGER,
          ease: GSAP_EASE.out,
          clearProps: 'opacity,clipPath',
        },
      );
    });
  }, [grid]);
}

/** The row of KPI cards: as many as fit on desktop, two across on a phone. */
export function KpiGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLDivElement>(null);
  useKpiReveal(grid);
  return (
    <div ref={grid} className={styles.grid}>
      {children}
    </div>
  );
}
