import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { ChartLegend } from '../../components/charts/ChartParts';
import { EmptyState } from '../../components/EmptyState';
import { Icon, ICONS } from '../../components/Icon';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { downloadCsv, toCsv } from '../../lib/csv';
import { formatCount, formatKg, formatLitres, formatRupees } from '../../lib/format';
import {
  daysInMonth,
  formatAxisLitres,
  formatBarLitres,
  monthScale,
  niceTicks,
  reportFileName,
  SESSION_COLOURS,
  SESSION_LABELS,
  SESSIONS,
  trendOf,
  type FeedDayTotals,
  type MilkDay,
  type MilkMonth,
  type MonthRange,
} from './helpers';
import styles from './MilkFeedPage.module.css';

const SERIES = SESSIONS.map((session) => ({
  key: session,
  label: SESSION_LABELS[session],
  color: SESSION_COLOURS[session],
}));

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState title={`Couldn't load ${what}.`} onAction={onRetry} actionLabel="Try again" />
    </div>
  );
}

interface TotalsProps {
  milk: MilkDay[] | undefined;
  feedYesterday: FeedDayTotals | undefined;
  feedBefore: FeedDayTotals | undefined;
  farmName: string;
  isError: boolean;
}

export function Totals({ milk, feedYesterday, feedBefore, farmName, isError }: TotalsProps) {
  const pending = (width = 90) => (isError ? '—' : <Skeleton width={width} height={28} />);
  const yesterday = milk?.at(-1);
  const before = milk?.at(-2);
  return (
    <KpiGrid>
      <KpiCard
        label="Milk yesterday"
        tone="milk"
        icon={<Icon d={ICONS.milk} />}
        value={yesterday ? formatLitres(yesterday.total, { decimals: 0 }) : pending()}
        trend={yesterday && before ? trendOf(yesterday.total, before.total) : undefined}
        note={yesterday ? `${yesterday.label} · ${farmName}` : ' '}
      />
      <KpiCard
        label="Milk value"
        tone="milk"
        icon={<Icon d={ICONS.rupee} />}
        value={yesterday ? formatRupees(yesterday.value) : pending()}
        trend={yesterday && before ? trendOf(yesterday.value, before.value) : undefined}
        note={
          yesterday && yesterday.total > 0
            ? `Average ${formatRupees(yesterday.value / yesterday.total, { decimals: 2 })} per litre`
            : ' '
        }
      />
      <KpiCard
        label="Milking animals"
        tone="milk"
        icon={<Icon d={ICONS.tag} />}
        value={yesterday ? formatCount(yesterday.animals) : pending(60)}
        trend={yesterday && before ? trendOf(yesterday.animals, before.animals) : undefined}
        note="Had an entry yesterday"
      />
      <KpiCard
        label="Feed cost yesterday"
        tone="milk"
        icon={<Icon d={ICONS.sprout} />}
        value={feedYesterday ? formatRupees(feedYesterday.cost) : pending()}
        trend={
          feedYesterday && feedBefore ? trendOf(feedYesterday.cost, feedBefore.cost) : undefined
        }
        note={feedYesterday ? `${formatKg(feedYesterday.kg)} logged` : ' '}
      />
    </KpiGrid>
  );
}

function ChartSkeleton() {
  return (
    <div data-testid="chart-skeleton">
      <Skeleton height={230} radius={12} />
    </div>
  );
}

interface MilkChartProps {
  days: MilkDay[] | undefined;
  isError: boolean;
  onRetry: () => void;
}

function MilkBySession({ days, isError, onRetry }: MilkChartProps) {
  const yesterday = days?.at(-1);
  const logged = days?.some((day) => day.total > 0);
  const totals = days?.filter((day) => day.total > 0).map((day) => day.total) ?? [];
  const highest = Math.max(0, ...totals);
  // A little headroom, so the text over the tallest bar stays under the top line.
  const ticks = niceTicks(highest * 1.08);
  const top = ticks.at(-1);
  let body: ReactNode = <ChartSkeleton />;
  if (isError) body = <LoadError what="the milk chart" onRetry={onRetry} />;
  else if (days && !logged) {
    body = <EmptyState title="No milk logged in these 7 days" note="Pick another farm." />;
  } else if (days && yesterday) {
    body = (
      <>
        <BarChart
          label={`Milk per day by session for the last 7 days, between ${formatCount(Math.min(...totals))} and ${formatCount(highest)} litres a day`}
          data={days}
          xKey="label"
          series={SERIES}
          height={232}
          topMargin={8}
          barGap="26%"
          phoneBarGap="18%"
          yTicks={ticks}
          formatY={(value) => `${formatAxisLitres(value)}${value === top ? ' L' : ''}`}
          totalLabel={(day) => formatBarLitres(day.total)}
          labelEmphasisIndex={days.length - 1}
          labelEveryOnPhone={2}
          hideLegend
          tooltip={(day) =>
            `${day.label}: ${formatLitres(day.total, { decimals: 0 })} (morning ${formatCount(day.morning)}, afternoon ${formatCount(day.afternoon)}, evening ${formatCount(day.evening)})`
          }
        />
        <div className={styles.sessions}>
          <span className={styles.sessionTotal}>
            <span className={styles.note}>Yesterday · morning</span>
            <span className={styles.sessionValue}>
              {formatLitres(yesterday.morning, { decimals: 0 })}
            </span>
          </span>
          <span className={styles.sessionTotal}>
            <span className={styles.note}>Afternoon</span>
            <span className={styles.sessionValue}>
              {formatLitres(yesterday.afternoon, { decimals: 0 })}
            </span>
          </span>
          <span className={styles.sessionTotal}>
            <span className={styles.note}>Evening</span>
            <span className={styles.sessionValue}>
              {formatLitres(yesterday.evening, { decimals: 0 })}
            </span>
          </span>
        </div>
      </>
    );
  }
  return (
    <Card flush className={styles.milkCard}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Milk by session · last 7 days</span>
        <ChartLegend items={SERIES.map(({ label, color }) => ({ label, color }))} />
      </div>
      {body}
    </Card>
  );
}

interface FeedCardProps {
  feed: FeedDayTotals | undefined;
  isError: boolean;
  onRetry: () => void;
}

function FeedByType({ feed, isError, onRetry }: FeedCardProps) {
  let body: ReactNode = <Skeleton height={220} radius={12} />;
  if (isError) body = <LoadError what="the feed totals" onRetry={onRetry} />;
  else if (feed && feed.kg === 0) {
    body = <EmptyState title="No feed logged yesterday" note="Pick another farm." />;
  } else if (feed) {
    const shares = feed.types.filter((type) => type.kg > 0);
    body = (
      <>
        <div className={styles.feedAverage}>
          <span className={styles.bigNumber}>
            {formatRupees(feed.cost / feed.kg, { decimals: 2 })}
          </span>
          <span className={styles.note}>
            per kg on average · {formatRupees(feed.cost)} in total
          </span>
        </div>
        <div
          className={styles.feedBar}
          role="img"
          aria-label={shares.map((type) => `${type.name} ${Math.round(type.percent)}%`).join(', ')}
        >
          {shares.map((type) => (
            <span key={type.name} style={{ width: `${type.percent}%`, background: type.color }} />
          ))}
        </div>
        <div className={styles.feedRows}>
          {feed.types.map((type) => (
            <div key={type.name} className={styles.feedRow}>
              <i aria-hidden="true" style={{ background: type.color }} />
              <span className={styles.feedName}>{type.name}</span>
              <span className={styles.numberMuted}>{formatKg(type.kg)}</span>
              <span className={styles.feedPercent}>{Math.round(type.percent)}%</span>
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <Card flush className={styles.feedCard}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Feed by type · yesterday</span>
        {feed && feed.kg > 0 && <span className={styles.cardUnit}>{formatKg(feed.kg)}</span>}
      </div>
      {body}
    </Card>
  );
}

export function DailyCharts({
  days,
  feed,
  milkError,
  feedError,
  onRetryMilk,
  onRetryFeed,
}: {
  days: MilkDay[] | undefined;
  feed: FeedDayTotals | undefined;
  milkError: boolean;
  feedError: boolean;
  onRetryMilk: () => void;
  onRetryFeed: () => void;
}) {
  return (
    <div className={styles.chartRow}>
      <MilkBySession days={days} isError={milkError} onRetry={onRetryMilk} />
      <FeedByType feed={feed} isError={feedError} onRetry={onRetryFeed} />
    </div>
  );
}

interface MonthlyProps {
  range: MonthRange;
  months: MilkMonth[] | undefined;
  /** Feed cost of the latest month. */
  feedCost: number | undefined;
  /** How many farms logged milk, left out when one farm is picked. */
  farmsLogged: { logged: number | undefined; total: number | undefined } | null;
  farmName: string;
  isError: boolean;
  onRetry: () => void;
}

function MilkPerMonth({
  months,
  farmName,
  isError,
  onRetry,
}: Pick<MonthlyProps, 'months' | 'farmName' | 'isError' | 'onRetry'>) {
  const highest = Math.max(0, ...(months ?? []).map((month) => month.litres));
  const scale = monthScale(highest);
  const ticks = niceTicks(highest, 4);
  const top = ticks.at(-1);
  let body: ReactNode = <ChartSkeleton />;
  if (isError) body = <LoadError what="the milk chart" onRetry={onRetry} />;
  else if (months?.length === 0) {
    body = <EmptyState title="No milk logged in these months" note="Pick another farm." />;
  } else if (months) {
    const first = months[0] as MilkMonth;
    const last = months.at(-1) as MilkMonth;
    body = (
      <BarChart
        label={`Milk per month, from ${formatCount(first.litres)} litres in ${first.label} to ${formatCount(last.litres)} litres in ${last.label}`}
        data={months}
        xKey="label"
        series={[{ key: 'litres', label: 'Milk' }]}
        height={252}
        yAxisWidth={54}
        yTicks={ticks}
        formatY={(value) => scale.axis(value, value === top)}
        totalLabel={(month) => scale.bar(month.litres)}
        emphasisIndex={months.length - 1}
        labelEmphasisIndex={months.length - 1}
        labelEmphasisColor="var(--milk-ink)"
        phoneBarGap="20%"
        tooltip={(month) =>
          `${month.label}: ${formatLitres(month.litres, { decimals: 0 })}, ${formatRupees(month.value)}`
        }
      />
    );
  }
  return (
    <Card flush className={styles.milkCard}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Milk per month · {farmName}</span>
        <span className={styles.cardUnit}>{scale.unit}</span>
      </div>
      {body}
    </Card>
  );
}

function MonthReport({ range, months, feedCost, farmsLogged, farmName }: MonthlyProps) {
  const toast = useToast();
  const { title, name, month } = range.last;
  const row = months?.find((item) => item.month === month);
  const litres = row?.litres ?? 0;
  const value = row?.value ?? 0;
  const loaded =
    months !== undefined &&
    feedCost !== undefined &&
    (farmsLogged === null || (farmsLogged.logged !== undefined && farmsLogged.total !== undefined));
  const lines: [string, string | undefined][] = [
    ['Milk collected', months && formatLitres(litres, { decimals: 0 })],
    ['Value', months && formatRupees(value)],
    ['Average per day', months && formatLitres(litres / daysInMonth(month), { decimals: 0 })],
    ['Feed cost', feedCost === undefined ? undefined : formatRupees(feedCost)],
  ];
  if (farmsLogged) {
    lines.push([
      'Farms that logged milk',
      farmsLogged.logged === undefined || farmsLogged.total === undefined
        ? undefined
        : `${formatCount(farmsLogged.logged)} of ${formatCount(farmsLogged.total)}`,
    ]);
  }

  function download() {
    const file = reportFileName(title);
    const rows = [['Farm', farmName], ['Month', title], ...lines.map(([k, v]) => [k, v ?? ''])];
    downloadCsv(file, toCsv(['Item', 'Value'], rows));
    toast.show(`${file} downloaded`);
  }

  return (
    <Card flush className={styles.feedCard}>
      <span className={styles.cardTitle}>{title}</span>
      <div className={styles.reportLines}>
        {lines.map(([label, text]) => (
          <div key={label} className={styles.keyValue}>
            <span>{label}</span>
            {text === undefined ? <Skeleton width={90} /> : <b>{text}</b>}
          </div>
        ))}
      </div>
      <Button size="sm" className={styles.reportButton} disabled={!loaded} onClick={download}>
        Download {name} report
      </Button>
    </Card>
  );
}

export function MonthlyCharts(props: MonthlyProps) {
  return (
    <div className={styles.chartRow}>
      <MilkPerMonth {...props} />
      <MonthReport {...props} />
    </div>
  );
}
