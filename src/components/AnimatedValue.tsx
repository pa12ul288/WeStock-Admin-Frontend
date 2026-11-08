import { useEffect, useState, type ReactNode } from 'react';
import { animate } from 'framer-motion';
import { DURATION, EASE, entryDelay, useReducedMotion } from '../lib/motion';
import styles from './AnimatedValue.module.css';

const NUMBER = /\d[\d,]*(?:\.\d+)?/;

interface Parts {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  locale: string | null;
}

/** Splits a formatted value such as `₹1,23,456` or `12.4 L` around its first number. */
function split(text: string): Parts | null {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const token = match[0];
  const target = Number(token.replace(/,/g, ''));
  if (!Number.isFinite(target)) return null;
  const groups = token.split('.')[0]?.split(',') ?? [];
  const indian = groups.slice(1, -1).some((group) => group.length === 2);
  return {
    prefix: text.slice(0, match.index),
    suffix: text.slice(match.index + token.length),
    target,
    decimals: token.includes('.') ? (token.split('.')[1]?.length ?? 0) : 0,
    locale: groups.length > 1 ? (indian ? 'en-IN' : 'en-US') : null,
  };
}

function render(parts: Parts, value: number): string {
  const digits = { minimumFractionDigits: parts.decimals, maximumFractionDigits: parts.decimals };
  const body = parts.locale
    ? new Intl.NumberFormat(parts.locale, digits).format(value)
    : value.toFixed(parts.decimals);
  return parts.prefix + body + parts.suffix;
}

/**
 * Shows a value from lib/format.ts. The first time a formatted number arrives it counts up to it,
 * and always ends on the exact original text. Anything else (loading bars, text) passes through.
 * Screen readers get the final text at once; the counting is hidden from them.
 */
export function AnimatedValue({ value }: { value: ReactNode }) {
  const reduced = useReducedMotion();
  const text = typeof value === 'string' ? value : null;
  const parts = text !== null ? split(text) : null;
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const target = parts?.target;

  useEffect(() => {
    if (reduced || done || target === undefined) return;
    const controls = animate(0, target, {
      duration: DURATION.slow * 2,
      delay: entryDelay('kpi') + 0.1,
      ease: EASE.out,
      onUpdate: setProgress,
      onComplete: () => setDone(true),
    });
    return () => controls.stop();
  }, [reduced, done, target]);

  if (!parts || reduced || done) return <>{value}</>;
  return (
    <span className={styles.stack}>
      <span className={styles.final}>{value}</span>
      <span className={styles.live} aria-hidden="true">
        {render(parts, progress)}
      </span>
    </span>
  );
}
