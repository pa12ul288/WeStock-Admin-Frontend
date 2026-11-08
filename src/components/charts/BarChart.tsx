import { useRef, type ReactNode } from 'react';
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
import { useChartReveal } from './useChartReveal';
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
  /** The gap around each bar on a wider screen. */
  barGap?: string;
  /** Room above the bars. Text above them needs 22 px unless the top tick leaves headroom. */
  topMargin?: number;
  yAxisWidth?: number;
  /** Room to the right of the last bar, for a last label wider than its bar. */
  rightMargin?: number;
  /** Slanted day labels, for 30 bars. */
  rotateLabels?: boolean;
  /** Shows every nth label on a phone. */
  labelEveryOnPhone?: number;
  /** Shows every nth label on a wider screen, for 90 bars. */
  labelEvery?: number;
  /** Text above each stack, like `23.2k`. */
  totalLabel?: (row: Row) => string;
  /** The row whose text above the bar and label below it stand out, as the latest day does. */
  labelEmphasisIndex?: number;
  /** Their colour. */
  labelEmphasisColor?: string;
  /** Leaves out a stacked chart's legend, for one placed in the card's header instead. */
  hideLegend?: boolean;
  /** The widest a bar gets, in px. Stacks default to 46 and single bars to 30. */
  maxBarSize?: number;
}

interface EmphasisTickProps {
  x?: number | string;
  y?: number | string;
  index?: number;
  payload?: { value?: unknown };
}

interface EmphasisLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
  value?: unknown;
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
  barGap = '30%',
  topMargin,
  yAxisWidth = 44,
  rightMargin = 0,
  rotateLabels = false,
  labelEveryOnPhone = 1,
  labelEvery = 1,
  totalLabel,
  labelEmphasisIndex,
  labelEmphasisColor = 'var(--navy)',
  hideLegend = false,
  maxBarSize,
}: BarChartProps<Row>) {
  const isPhone = useIsPhone();
  const figure = useRef<HTMLElement>(null);
  useChartReveal(figure);
  const stacked = series.length > 1;
  const emphasisFill = (index?: number) =>
    index === labelEmphasisIndex ? labelEmphasisColor : undefined;
  return (
    <figure ref={figure} className={styles.chart} aria-label={label}>
      {stacked && !hideLegend && (
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
          margin={{
            top: topMargin ?? (totalLabel ? 22 : 10),
            right: rightMargin,
            bottom: 0,
            left: 0,
          }}
          barCategoryGap={isPhone ? phoneBarGap : barGap}
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke={GRID_COLOUR} strokeDasharray="4 4" />
          <XAxis
            dataKey={xKey as string}
            tick={
              labelEmphasisIndex === undefined
                ? AXIS_TICK
                : ({ x, y, index, payload }: EmphasisTickProps) => (
                    <text
                      x={Number(x)}
                      y={Number(y)}
                      dy="0.71em"
                      textAnchor={rotateLabels ? 'end' : 'middle'}
                      transform={
                        rotateLabels ? `rotate(-45, ${Number(x)}, ${Number(y)})` : undefined
                      }
                      fontSize={AXIS_TICK.fontSize}
                      fill={emphasisFill(index) ?? AXIS_TICK.fill}
                    >
                      {String(payload?.value ?? '')}
                    </text>
                  )
            }
            tickLine={false}
            stroke={AXIS_COLOUR}
            tickMargin={8}
            interval={(isPhone ? labelEveryOnPhone : labelEvery) - 1}
            angle={rotateLabels ? -45 : 0}
            textAnchor={rotateLabels ? 'end' : 'middle'}
            height={rotateLabels ? 44 : 30}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={yAxisWidth}
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
              radius={stacked ? (index === series.length - 1 ? [7, 7, 2, 2] : 2) : 999}
              maxBarSize={maxBarSize ?? (stacked ? 46 : 30)}
              stroke={stacked ? 'var(--card)' : undefined}
              strokeWidth={stacked ? 1 : undefined}
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
                  content={
                    labelEmphasisIndex === undefined
                      ? undefined
                      : ({ x, y, width, index, value }: EmphasisLabelProps) => (
                          <text
                            x={Number(x) + Number(width) / 2}
                            y={Number(y)}
                            dy={-6}
                            textAnchor="middle"
                            className={styles.totalLabel}
                            style={{ fill: emphasisFill(index) }}
                          >
                            {String(value ?? '')}
                          </text>
                        )
                  }
                />
              )}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </figure>
  );
}
