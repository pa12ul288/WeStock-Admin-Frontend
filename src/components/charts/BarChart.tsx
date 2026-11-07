import type { ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  LabelList,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_COLOUR, AXIS_TICK, ChartLegend, chartTooltip, GRID_COLOUR } from './ChartParts';
import { useIsPhone } from './useIsPhone';
import styles from './charts.module.css';

export interface BarSeries {
  key: string;
  label: string;
  color?: string;
}

interface BarChartProps<Row extends object> {
  /** What the chart shows, for screen readers. */
  label: string;
  data: readonly Row[];
  xKey: keyof Row & string;
  /** One series draws pill bars; more than one stacks them and adds a legend. */
  series: readonly BarSeries[];
  /** The exact value for a row. */
  tooltip: (row: Row) => ReactNode;
  height?: number;
  yTicks?: number[];
  formatY?: (value: number) => string;
  /** The bar shown dark with its tooltip open before anyone points at it. */
  highlightIndex?: number;
  /** The bar shown dark all the time, without opening its tooltip. */
  emphasisIndex?: number;
  /** The gap around each bar on a phone. Few bars look better with a smaller one. */
  phoneBarGap?: string;
  /** Room to the right of the last bar, for a last label wider than its bar. */
  rightMargin?: number;
  /** Slanted day labels, for 30 bars. */
  rotateLabels?: boolean;
  /** Shows every nth label on a phone. */
  labelEveryOnPhone?: number;
  /** Text above each stack, like `23.2k`. */
  totalLabel?: (row: Row) => string;
}

/** Daily totals. Bars use `--milk-bar` and turn `--milk-ink` under the pointer unless given a colour. */
export function BarChart<Row extends object>({
  label,
  data,
  xKey,
  series,
  tooltip,
  height = 230,
  yTicks,
  formatY,
  highlightIndex,
  emphasisIndex,
  phoneBarGap = '35%',
  rightMargin = 0,
  rotateLabels = false,
  labelEveryOnPhone = 1,
  totalLabel,
}: BarChartProps<Row>) {
  const isPhone = useIsPhone();
  const stacked = series.length > 1;
  return (
    <figure className={styles.chart} aria-label={label}>
      {stacked && (
        <ChartLegend
          items={series.map((item) => ({
            label: item.label,
            color: item.color ?? 'var(--milk-bar)',
          }))}
        />
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data as Row[]}
          margin={{ top: totalLabel ? 22 : 10, right: rightMargin, bottom: 0, left: 0 }}
          barCategoryGap={isPhone ? phoneBarGap : '30%'}
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke={GRID_COLOUR} strokeDasharray="4 4" />
          <XAxis
            dataKey={xKey as string}
            tick={AXIS_TICK}
            tickLine={false}
            stroke={AXIS_COLOUR}
            tickMargin={8}
            interval={isPhone ? labelEveryOnPhone - 1 : 0}
            angle={rotateLabels ? -45 : 0}
            textAnchor={rotateLabels ? 'end' : 'middle'}
            height={rotateLabels ? 44 : 30}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={44}
            ticks={yTicks}
            domain={yTicks ? [yTicks[0] ?? 0, yTicks.at(-1) ?? 'auto'] : undefined}
            tickFormatter={formatY}
          />
          <Tooltip
            content={chartTooltip(tooltip)}
            cursor={false}
            isAnimationActive={false}
            defaultIndex={highlightIndex}
            position={{ y: 0 }}
          />
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId={stacked ? 'stack' : undefined}
              fill={item.color ?? 'var(--milk-bar)'}
              radius={stacked ? 4 : 999}
              maxBarSize={stacked ? 46 : 30}
              stroke={stacked ? 'var(--card)' : undefined}
              strokeWidth={stacked ? 2 : undefined}
              activeBar={stacked ? false : { fill: 'var(--milk-ink)' }}
              isAnimationActive={false}
            >
              {emphasisIndex !== undefined &&
                data.map((_row, rowIndex) => (
                  <Cell
                    key={rowIndex}
                    fill={
                      rowIndex === emphasisIndex
                        ? 'var(--milk-ink)'
                        : (item.color ?? 'var(--milk-bar)')
                    }
                  />
                ))}
              {totalLabel && index === series.length - 1 && (
                <LabelList
                  position="top"
                  className={styles.totalLabel}
                  valueAccessor={(entry: { payload?: unknown }) => totalLabel(entry.payload as Row)}
                />
              )}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </figure>
  );
}
