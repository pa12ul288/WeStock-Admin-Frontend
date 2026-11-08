import type { ReactNode } from 'react';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { ChartLegend } from '../../components/charts/ChartParts';
import { LineChart } from '../../components/charts/LineChart';
import { EmptyState } from '../../components/EmptyState';
import { Icon, ICONS } from '../../components/Icon';
import { Skeleton } from '../../components/Skeleton';
import type { AnalyticsSeries } from '../../data/types';
import {
  formatCount,
  formatDayMonth,
  formatKg,
  formatLitresTotal,
  formatRupees,
  formatTime,
  indiaDay,
  shiftDay,
} from '../../lib/format';
import {
  ACTIVITY_KEYS,
  activityFigures,
  bucketSize,
  feedFigures,
  feedMix,
  feverCount,
  hottestCow,
  milkFigures,
  milkingNow,
  rangeTicks,
  temperaturePoints,
  thirdsTicks,
  type Period,
  type TemperatureCow,
  type TemperaturePoint,
} from './helpers';
import { useAnalyticsFeedMix, useAnalyticsMilkDaily } from './queries';
import styles from './AnalyticsPage.module.css';

interface Scope {
  farmId: string;
  /** The chosen animal, or null for the whole farm. */
  animalId: string | null;
  animalName: string | null;
  days: Period;
  onClear: () => void;
}

function CardHead({ number, title, unit }: { number: number; title: string; unit?: ReactNode }) {
  return (
    <div className={styles.cardHead}>
      <h2 className={styles.label}>
        {number} · {title}
      </h2>
      {unit && <span className={styles.unit}>{unit}</span>}
    </div>
  );
}

/** The grey box a graph shows when it has nothing to draw. */
export function NoData({
  title,
  note,
  icon = ICONS.thermometer,
}: {
  title: string;
  note: string;
  icon?: string;
}) {
  return (
    <div className={styles.noData}>
      <span className={styles.noDataIcon}>
        <Icon d={icon} />
      </span>
      <b>{title}</b>
      <span className={styles.note}>{note}</span>
    </div>
  );
}

export function CardSkeleton({ number, title }: { number: number; title: string }) {
  return (
    <Card className={styles.card} aria-busy="true">
      <CardHead number={number} title={title} />
      <Skeleton width={160} height={30} />
      <Skeleton height={170} radius={12} />
      <Skeleton height={36} />
    </Card>
  );
}

function unitLine(base: string, days: Period, animalName: string | null): string {
  const size = bucketSize(days);
  const text = size === 1 ? `${base} per day` : `${base} a day · ${size}-day avg`;
  return animalName ? `${text} · ${animalName}` : text;
}

function noneLogged(what: string, scope: Scope) {
  return (
    <EmptyState
      title={`No ${what} in this period`}
      note="Try a longer period, or the whole farm."
      onAction={scope.onClear}
    />
  );
}

export function MilkCard({ series, scope }: { series: AnalyticsSeries; scope: Scope }) {
  const { days, farmId, animalId, animalName } = scope;
  const today = indiaDay();
  const figures = milkFigures(series.milk, days, today);
  const from = shiftDay(today, -days);
  const daily = useAnalyticsMilkDaily(
    animalId === null ? farmId : undefined,
    from,
    shiftDay(today, -1),
  );
  const milkers =
    animalId === null ? daily.data && milkingNow(daily.data) : figures.total > 0 ? 1 : 0;
  const ticks = thirdsTicks(Math.max(0, ...figures.bars.map((bar) => bar.litres)));
  const top = ticks.at(-1);
  const trend = figures.trendPct;
  const single = bucketSize(days) === 1;
  return (
    <Card className={styles.card}>
      <CardHead number={1} title="Milk" unit={unitLine('litres', days, animalName)} />
      {figures.total <= 0 ? (
        noneLogged('milk logged', scope)
      ) : (
        <>
          <div className={styles.valueRow}>
            <span className={styles.big}>{formatLitresTotal(figures.total)}</span>
            {trend !== null && (
              <span
                className={styles.chip}
                data-tone={Math.round(trend * 10) === 0 ? 'same' : trend > 0 ? 'up' : 'down'}
              >
                {Math.round(trend * 10) === 0
                  ? 'same'
                  : `${trend > 0 ? '↑' : '↓'} ${Math.abs(trend).toFixed(1)}%`}
              </span>
            )}
            <span className={styles.note}>{formatRupees(figures.value)} value</span>
          </div>
          <BarChart
            label={`Milk for the last ${days} days`}
            data={figures.bars}
            xKey="label"
            series={[{ key: 'litres', label: 'Milk' }]}
            tooltip={(row) =>
              single
                ? `${formatDayMonth(row.start)} · ${row.litres} L · ${formatRupees(row.value)}`
                : `From ${row.label} · ${row.litres} L a day`
            }
            height={190}
            yTicks={ticks}
            formatY={(value) => (value === top ? `${value} L` : String(value))}
            highlightIndex={figures.peak >= 0 ? figures.peak : undefined}
            emphasisIndex={figures.peak >= 0 ? figures.peak : undefined}
            labelEmphasisIndex={figures.peak >= 0 ? figures.peak : undefined}
            labelEmphasisColor="var(--milk-ink)"
            labelEveryOnPhone={single ? 2 : 1}
            topMargin={30}
            yAxisWidth={46}
            rightMargin={8}
            phoneBarGap="25%"
            barGap="20%"
          />
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.note}>Daily average</span>
              <b>{formatLitresTotal(Math.round(figures.averagePerDay * 10) / 10)}</b>
            </span>
            <span className={styles.stat}>
              <span className={styles.note}>Average price</span>
              <b>{formatRupees(figures.price, { decimals: 2 })} / L</b>
            </span>
            <span className={styles.stat}>
              <span className={styles.note}>Milking animals</span>
              <b>{milkers === undefined ? '…' : formatCount(milkers)}</b>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

export function FeedCard({ series, scope }: { series: AnalyticsSeries; scope: Scope }) {
  const { days, farmId, animalId, animalName } = scope;
  const today = indiaDay();
  const figures = feedFigures(series.feed, days, today);
  const mix = useAnalyticsFeedMix(farmId, animalId, shiftDay(today, -days), shiftDay(today, -1));
  const shares = feedMix(mix.data ?? []);
  const ticks = rangeTicks(figures.bars.map((bar) => bar.kg));
  const single = bucketSize(days) === 1;
  return (
    <Card className={styles.card}>
      <CardHead number={2} title="Feed" unit={unitLine('kg', days, animalName)} />
      {figures.total <= 0 ? (
        noneLogged('feed logged', scope)
      ) : (
        <>
          <div className={styles.valueRow}>
            <span className={styles.big}>{formatKg(figures.total)}</span>
            <span className={styles.note}>
              {formatRupees(figures.cost)} spent · {formatRupees(figures.perKg, { decimals: 2 })}{' '}
              per kg
            </span>
          </div>
          <LineChart
            label={`Feed for the last ${days} days`}
            data={figures.bars}
            xKey="label"
            series={[
              { key: 'kg', label: 'Feed', color: 'var(--green-ink)', area: true, dots: true },
            ]}
            tooltip={(row) =>
              single
                ? `${formatDayMonth(row.start)} · ${row.kg} kg`
                : `From ${row.label} · ${row.kg} kg a day`
            }
            height={190}
            yTicks={ticks}
            yAxisWidth={46}
            labelEveryOnPhone={single ? 2 : 1}
            hideLegend
            hideCursor
          />
          <div className={styles.mix}>
            {mix.isPending ? (
              <Skeleton height={8} />
            ) : (
              <>
                <div
                  role="img"
                  className={styles.mixBar}
                  aria-label={`Feed mix: ${shares
                    .filter((share) => share.kg > 0)
                    .map((share) => `${share.name.toLowerCase()} ${Math.round(share.percent)}%`)
                    .join(', ')}`}
                >
                  {shares
                    .filter((share) => share.percent > 0)
                    .map((share) => (
                      <span
                        key={share.name}
                        style={{ width: `${share.percent}%`, background: share.color }}
                      />
                    ))}
                </div>
                <ul className={styles.mixLegend}>
                  {shares.map((share) => (
                    <li key={share.name}>
                      <i aria-hidden="true" style={{ background: share.color }} />
                      {share.name} <b>{Math.round(share.percent)}%</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

const NO_COLLAR_FARM = 'No collar data on this farm';

export function ActivityCard({
  series,
  scope,
  hasCollars,
  collarCows,
}: {
  series: AnalyticsSeries;
  scope: Scope;
  hasCollars: boolean;
  /** Animals wearing a collar in this view: the divisor for hours per cow. */
  collarCows: number;
}) {
  const { days, animalId, animalName } = scope;
  const figures = activityFigures(series.activity, days, animalId === null ? collarCows : 1);
  const size = bucketSize(days);
  const unit = `hours per cow · last ${days} days${size > 1 ? ` · ${size}-day avg` : ''}`;
  const stacked = [...ACTIVITY_KEYS].reverse();
  const average = (name: 'Ruminating' | 'Eating' | 'Walking') =>
    `${figures.averages[name].toFixed(1)} h`;
  return (
    <Card className={styles.card}>
      <CardHead number={3} title="Activity" unit={unit} />
      {!hasCollars ? (
        <NoData
          title={NO_COLLAR_FARM}
          note="Activity comes from cattle collars. This graph fills in once the farm has a Blackbox and collars."
          icon="M3 12h4l3-8 4 16 3-8h4"
        />
      ) : !figures.hasData ? (
        <NoData
          title={animalId ? 'No collar data for this animal' : 'No activity data'}
          note={
            animalId
              ? `${animalName ?? 'This animal'} has no collar readings in this period.`
              : 'No collar activity in this period.'
          }
          icon="M3 12h4l3-8 4 16 3-8h4"
        />
      ) : (
        <>
          <ChartLegend items={ACTIVITY_KEYS.map(([name, , color]) => ({ label: name, color }))} />
          <BarChart
            label={`Hours per cow per day for the last ${days} days`}
            data={figures.bars}
            xKey="label"
            series={stacked.map(([name, , color]) => ({ key: name, label: name, color }))}
            tooltip={(row) =>
              `${size === 1 ? formatDayMonth(row.start) : `From ${row.label}`}: ${ACTIVITY_KEYS.map(
                ([name]) => `${name.toLowerCase()} ${Number(row[name]).toFixed(1)} h`,
              ).join(', ')}`
            }
            height={190}
            yTicks={[0, 6, 12, 18, 24]}
            formatY={(value) => (value === 24 ? '24 h' : String(value))}
            yAxisWidth={46}
            rightMargin={8}
            topMargin={6}
            labelEveryOnPhone={size === 1 ? 2 : 1}
            hideLegend
            maxBarSize={30}
            phoneBarGap="25%"
            barGap="20%"
          />
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.note}>Ruminating · average</span>
              <b>{average('Ruminating')}</b>
            </span>
            <span className={styles.stat}>
              <span className={styles.note}>Eating · average</span>
              <b>{average('Eating')}</b>
            </span>
            <span className={styles.stat}>
              <span className={styles.note}>Walking · average</span>
              <b>{average('Walking')}</b>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

const BODY_TICKS = [37.5, 38.5, 39.5, 40.5];

export function CattleTemperatureCard({
  series,
  scope,
  hasCollars,
  cows,
  feverAt,
}: {
  series: AnalyticsSeries;
  scope: Scope;
  hasCollars: boolean;
  /** The collared animals in this view with their last reading. */
  cows: readonly TemperatureCow[];
  feverAt: number;
}) {
  const { animalId, animalName } = scope;
  const points = temperaturePoints(series.cattle_temperature);
  const last = points.length - 1;
  const lastPoint = points[last];
  const above = feverCount(cows, feverAt);
  const hottest = hottestCow(cows);
  const today = indiaDay();
  // The plot is 150 px tall (190 less the margin and the axis) and runs 37.5 to 40.5 °C.
  const tooltipY = lastPoint
    ? Math.max(0, 10 + ((40.5 - lastPoint.max) / 3) * 150 - 16)
    : undefined;

  function tip(row: TemperaturePoint): string {
    const when = `${indiaDay(row.at) === today ? 'today' : formatDayMonth(row.at)} ${formatTime(row.at)}`;
    if (row.at !== lastPoint?.at) {
      return animalId
        ? `${when} · ${row.avg.toFixed(1)} °C`
        : `${when} · average ${row.avg.toFixed(1)} °C · highest ${row.max.toFixed(1)} °C`;
    }
    if (animalId) return `${animalName ?? 'Reading'} · ${row.avg.toFixed(1)} °C · ${when}`;
    const name =
      hottest && Math.abs(hottest.temp - row.max) < 0.06 ? `${hottest.name} · ` : 'Highest cow · ';
    return `${name}${row.max.toFixed(1)} °C · ${when}`;
  }

  const legend = [
    { label: animalId ? (animalName ?? 'Reading') : 'Herd average', color: 'var(--chart-pink)' },
    ...(animalId ? [] : [{ label: 'Highest cow', color: 'var(--chart-pink-soft)' }]),
    { label: `Fever alert ${feverAt} °C`, color: 'var(--danger)', dashed: true },
  ];

  return (
    <Card className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.label}>4 · Cattle temperature</h2>
        {hasCollars && points.length > 0 && (
          <span
            className={styles.chip}
            data-tone={above > 0 ? 'down' : 'up'}
            style={{ height: 24, padding: '0 10px' }}
          >
            {above > 0
              ? `${above} ${above === 1 ? 'cow' : 'cows'} above ${feverAt} °C`
              : `No cow above ${feverAt} °C`}
          </span>
        )}
      </div>
      {!hasCollars ? (
        <NoData
          title={NO_COLLAR_FARM}
          note="Body temperature comes from cattle collars. This graph fills in once the farm has a Blackbox and collars."
        />
      ) : points.length === 0 || !lastPoint ? (
        <NoData
          title={animalId ? 'No collar data for this animal' : 'No body temperature data'}
          note="There are no collar readings in the last 7 days."
        />
      ) : (
        <>
          <div className={styles.valueRow}>
            <span className={styles.big}>{lastPoint.avg.toFixed(1)} °C</span>
            <span className={styles.note}>
              {animalId ? `${animalName ?? 'reading'} now` : 'herd average now'} · hourly, last 7
              days
            </span>
          </div>
          <ChartLegend items={legend} />
          <LineChart
            label="Cattle temperature, hourly for the last 7 days"
            data={points}
            xKey="at"
            formatX={(value) => formatDayMonth(value)}
            series={[
              ...(animalId
                ? []
                : [{ key: 'max', label: 'Highest cow', color: 'var(--chart-pink-soft)' }]),
              {
                key: 'avg',
                label: animalId ? 'Reading' : 'Herd average',
                color: 'var(--chart-pink)',
              },
            ]}
            references={[
              { y: feverAt, label: `Fever alert ${feverAt} °C`, color: 'var(--danger)' },
            ]}
            tooltip={tip}
            highlightIndex={last}
            hideCursor
            hideLegend
            height={190}
            yTicks={BODY_TICKS}
            formatY={(value) => (value === 40.5 ? '40.5 °C' : String(value))}
            yAxisWidth={54}
            labelEvery={24}
            tooltipY={tooltipY}
            labelEveryOnPhone={48}
          />
        </>
      )}
    </Card>
  );
}
