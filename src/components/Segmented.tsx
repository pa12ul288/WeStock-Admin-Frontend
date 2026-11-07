import type { ReactNode } from 'react';
import styles from './Segmented.module.css';

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  /** A number after the label, as on the species tabs. */
  count?: ReactNode;
}

interface SegmentedProps<V extends string> {
  /** What the switch chooses: read out by screen readers. */
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<V>) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className={styles.count}>{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
