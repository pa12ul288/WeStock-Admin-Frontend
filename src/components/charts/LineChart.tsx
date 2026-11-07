import { useId, type ReactNode } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_COLOUR, AXIS_TICK, ChartLegend, chartTooltip, GRID_COLOUR } from './ChartParts';
import { useIsPhone } from './useIsPhone';
import styles from './charts.module.css';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  /** Fills under the line, fading downwards. */
  area?: boolean;
  /** Draws a ring on each point. */
  dots?: boolean;
}

export interface ChartReference {
  y: number;
  label: string;
  color: string;
}

interface LineChartProps<Row extends object> {
  /** What the chart shows, for screen readers. */
  label: string;
  data: readonly Row[];
  xKey: keyof Row & string;
  series: readonly LineSeries[];
  /** The exact value for a row. */
  tooltip: (row: Row) => ReactNode;
  height?: number;
  yTicks?: number[];
  formatY?: (value: number) => string;
  /** The point with its tooltip open before anyone points at it. */
  highlightIndex?: number;
  /** Dashed limits, like the fever alert. */
  references?: readonly ChartReference[];
  /** Shows every nth label on a phone. */
  labelEveryOnPhone?: number;
  /** Shows every nth label on desktop. */
  labelEvery?: number;
}

/** Trends such as temperature and THI. */
export function LineChart<Row extends object>({
  label,
  data,
  xKey,
  series,
  tooltip,
  height = 200,
  yTicks,
  formatY,
  highlightIndex,
  references = [],
  labelEveryOnPhone = 1,
  labelEvery = 1,
}: LineChartProps<Row>) {
  const isPhone = useIsPhone();
  const idBase = useId().replace(/:/g, '');
  const legend = [
    ...series.map(({ label: name, color }) => ({ label: name, color })),
    ...references.map(({ label: name, color }) => ({ label: name, color, dashed: true })),
  ];

  return (
    <figure className={styles.chart} aria-label={label}>
      {legend.length > 1 && <ChartLegend items={legend} />}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data as Row[]}
          margin={{ top: 10, right: 24, bottom: 0, left: 0 }}
          accessibilityLayer={false}
        >
          <defs>
            {series
              .filter((item) => item.area)
              .map((item) => (
                <linearGradient
                  key={item.key}
                  id={`${idBase}-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={item.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={item.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_COLOUR} strokeDasharray="4 4" />
          <XAxis
            dataKey={xKey as string}
            tick={AXIS_TICK}
            tickLine={false}
            stroke={AXIS_COLOUR}
            tickMargin={8}
            interval={(isPhone ? labelEveryOnPhone : labelEvery) - 1}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={44}
            ticks={yTicks}
            domain={yTicks ? [yTicks[0] ?? 0, yTicks.at(-1) ?? 'auto'] : ['auto', 'auto']}
            tickFormatter={formatY}
          />
          <Tooltip
            content={chartTooltip(tooltip)}
            cursor={{ stroke: AXIS_COLOUR }}
            isAnimationActive={false}
            defaultIndex={highlightIndex}
          />
          {references.map((reference) => (
            <ReferenceLine
              key={reference.label}
              y={reference.y}
              stroke={reference.color}
              strokeDasharray="6 4"
            />
          ))}
          {series.map((item) => {
            const dot = item.dots
              ? { r: 3.5, fill: 'var(--card)', stroke: item.color, strokeWidth: 2 }
              : false;
            const activeDot = { r: 5, fill: 'var(--card)', stroke: item.color, strokeWidth: 2 };
            return item.area ? (
              <Area
                key={item.key}
                dataKey={item.key}
                name={item.label}
                type="monotone"
                stroke={item.color}
                strokeWidth={2}
                fill={`url(#${idBase}-${item.key})`}
                dot={dot}
                activeDot={activeDot}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={item.key}
                dataKey={item.key}
                name={item.label}
                type="monotone"
                stroke={item.color}
                strokeWidth={2}
                dot={dot}
                activeDot={activeDot}
                isAnimationActive={false}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
