import type { ReactNode } from 'react';
import styles from './charts.module.css';

export interface ChartLegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

/** Colour is never the only signal: every chart with two or more series names them. */
export function ChartLegend({ items }: { items: readonly ChartLegendItem[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <i
            aria-hidden="true"
            className={item.dashed ? styles.swatchDashed : styles.swatch}
            style={item.dashed ? { borderColor: item.color } : { background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
}

/** Builds the dark tooltip with the exact value for whichever row is under the pointer. */
export function chartTooltip<Row>(render: (row: Row) => ReactNode) {
  return function ChartTooltip({ active, payload }: TooltipProps) {
    const row = payload?.[0]?.payload as Row | undefined;
    if (!active || !row) return null;
    return <div className={styles.tooltip}>{render(row)}</div>;
  };
}

export const AXIS_TICK = { fontSize: 11.5, fill: 'var(--muted)' };
export const GRID_COLOUR = 'var(--line-control)';
export const AXIS_COLOUR = 'var(--line-strong)';
