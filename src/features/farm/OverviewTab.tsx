import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import type { PillTone } from '../../components/StatusPill';
import { StatusPill } from '../../components/StatusPill';
import { Skeleton } from '../../components/Skeleton';
import type { FarmDetail } from '../../data/types';
import { formatCount, formatDateTime, formatLitresTotal, formatRupees } from '../../lib/format';
import { buildMilkWeek, milkTicks, type LatestEntry } from './helpers';
import { Icon, ICONS } from './Icon';
import { useFarmLatest, useFarmMilk, useFarmRecords } from './queries';
import styles from './FarmPage.module.css';

interface RecordStat {
  value: number | undefined;
  label: string;
  dot: 'pink' | 'red' | 'amber' | 'green' | 'blue' | 'grey';
}

function RecordCard({
  to,
  label,
  icon,
  tone,
  stats,
}: {
  to: string;
  label: string;
  icon: string;
  tone: 'pink' | 'red' | 'blue';
  stats: readonly RecordStat[];
}) {
  return (
    <Link to={to} className={styles.recordCard}>
      <div className={styles.recordHead}>
        <span className={styles.recordIcon} data-tone={tone}>
          <Icon d={icon} />
        </span>
        <span className={styles.recordLabel}>{label}</span>
        <span className={styles.recordOpen}>
          <Icon d={ICONS.open} size={14} />
        </span>
      </div>
      <div className={styles.stats}>
        {stats.map((stat) => (
          <span key={stat.label} className={styles.stat}>
            <span className={styles.statValue}>
              {stat.value === undefined ? '—' : formatCount(stat.value)}
            </span>
            <span className={styles.statLabel}>
              <i data-tone={stat.dot} aria-hidden="true" />
              {stat.label}
            </span>
          </span>
        ))}
      </div>
    </Link>
  );
}

function Records({ detail }: { detail: FarmDetail }) {
  const id = detail.farm.id;
  const records = useFarmRecords(id);
  const { reproduction, health, vaccination } = detail.dashboard;
  return (
    <section className={styles.group} aria-label="Records">
      <span className={styles.sectionLabel}>Records on this farm</span>
      <div className={styles.recordGrid}>
        <RecordCard
          to={`/reproduction?farm=${id}`}
          label="Reproduction"
          icon={ICONS.heart}
          tone="pink"
          stats={[
            { value: reproduction.heat, label: 'In heat', dot: 'pink' },
            { value: reproduction.inseminated, label: 'Inseminated', dot: 'pink' },
            { value: reproduction.pregnant, label: 'Pregnant', dot: 'pink' },
            { value: reproduction.may_deliver, label: 'May deliver', dot: 'pink' },
          ]}
        />
        <RecordCard
          to={`/health?tab=issues&farm=${id}`}
          label="Health issues"
          icon={ICONS.health}
          tone="red"
          stats={[
            { value: health.detected, label: 'Detected', dot: 'amber' },
            { value: health.sick, label: 'Sick', dot: 'red' },
            { value: health.conditions, label: 'Long-term', dot: 'grey' },
            {
              value: records.data?.resolvedThisMonth,
              label: 'Resolved this month',
              dot: 'green',
            },
          ]}
        />
        <RecordCard
          to={`/health?tab=vax&farm=${id}`}
          label="Vaccination"
          icon={ICONS.vaccine}
          tone="blue"
          stats={[
            { value: vaccination.overdue, label: 'Overdue', dot: 'red' },
            { value: vaccination.due, label: 'Due in 7 days', dot: 'amber' },
            { value: vaccination.upcoming, label: 'Upcoming', dot: 'blue' },
            { value: records.data?.givenThisMonth, label: 'Given this month', dot: 'green' },
          ]}
        />
      </div>
    </section>
  );
}

function MilkCard({ detail }: { detail: FarmDetail }) {
  const id = detail.farm.id;
  const milk = useFarmMilk(id);
  const week = useMemo(() => (milk.data ? buildMilkWeek(milk.data) : null), [milk.data]);
  const ticks = milkTicks(Math.max(...(week?.bars.map((bar) => bar.litres) ?? [0])));
  const top = ticks.at(-1);
  const trend = week?.trendPct ?? null;
  return (
    <Card className={styles.milkCard}>
      <div className={styles.cardHead}>
        <span className={styles.sectionLabel}>Milk per day · last 7 days</span>
        <Link to={`/milk-feed?farm=${id}`} className={styles.link}>
          Entries <span aria-hidden="true">→</span>
        </Link>
      </div>
      {milk.isPending && <Skeleton height={250} radius={12} />}
      {milk.isError && (
        <div role="alert">
          <EmptyState
            title="Couldn't load the milk figures."
            actionLabel="Try again"
            onAction={() => void milk.refetch()}
          />
        </div>
      )}
      {week && (
        <>
          <div className={styles.milkTotals}>
            <span className={styles.bigNumber}>{formatLitresTotal(week.total)}</span>
            {trend !== null && (
              <span className={styles.chip} data-tone={trend < 0 ? 'down' : 'up'}>
                <span aria-hidden="true">{trend < 0 ? '↓' : '↑'}</span> {Math.abs(trend)}%
              </span>
            )}
            <span className={styles.note}>
              {formatRupees(week.revenue)} · {formatLitresTotal(detail.dashboard.milk_today.total)}{' '}
              so far today
            </span>
          </div>
          <BarChart
            label={`Milk per day, ${week.bars[0]?.label} to ${week.bars.at(-1)?.label}`}
            data={week.bars}
            xKey="label"
            series={[{ key: 'litres', label: 'Milk' }]}
            tooltip={(bar) => `${bar.label}: ${formatLitresTotal(bar.litres)}`}
            yTicks={ticks}
            formatY={(value) => (value === top ? `${formatCount(value)} L` : formatCount(value))}
            emphasisIndex={week.bestIndex}
            labelEveryOnPhone={2}
            phoneBarGap="12%"
            totalLabel={(bar) => formatCount(Math.round(bar.litres))}
            height={240}
          />
        </>
      )}
    </Card>
  );
}

function ComingUp({ farmId }: { farmId: string }) {
  const records = useFarmRecords(farmId);
  return (
    <Card className={styles.comingCard}>
      <div className={styles.cardHead}>
        <span className={styles.sectionLabel}>Coming up</span>
        <span className={styles.nextDays}>next 30 days</span>
      </div>
      {records.isPending &&
        Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={styles.comingRow}>
            <Skeleton height={44} />
          </div>
        ))}
      {records.isError && (
        <div role="alert">
          <EmptyState
            title="Couldn't load what's coming up."
            actionLabel="Try again"
            onAction={() => void records.refetch()}
          />
        </div>
      )}
      {records.data?.comingUp.length === 0 && (
        <EmptyState title="Nothing due" note="Nothing is due on this farm in the next 30 days." />
      )}
      {records.data?.comingUp.map((item) => (
        <div key={item.key} className={styles.comingRow}>
          <span className={styles.dateBox}>
            <span data-today={item.isToday || undefined}>
              {item.isToday ? 'TODAY' : item.month}
            </span>
            <b>{item.dayOfMonth}</b>
          </span>
          <span className={styles.comingText}>
            <b>{item.what}</b>
            <span>{item.detail}</span>
          </span>
          <StatusPill tone={item.kind === 'breeding' ? 'pink' : 'blue'}>
            {item.kind === 'breeding' ? 'Breeding' : 'Vaccine'}
          </StatusPill>
        </div>
      ))}
    </Card>
  );
}

const KIND_LABEL = { milk: 'Milk', feed: 'Feed', health: 'Health' } as const;
const KIND_TONE: Record<LatestEntry['kind'], PillTone> = {
  milk: 'blue',
  feed: 'green',
  health: 'red',
};

const LATEST_COLUMNS: readonly Column<LatestEntry>[] = [
  {
    key: 'time',
    header: 'Time',
    cell: (row) => <span className={styles.time}>{formatDateTime(row.at)}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    cell: (row) => <StatusPill tone={KIND_TONE[row.kind]}>{KIND_LABEL[row.kind]}</StatusPill>,
  },
  { key: 'record', header: 'Record', cell: (row) => row.text },
  {
    key: 'by',
    header: 'Entered by',
    cell: (row) => (
      <span className={styles.enteredBy}>
        {row.by}
        {row.staff && <StatusPill tone="grey">Staff</StatusPill>}
      </span>
    ),
  },
];

function LatestEntries({ detail }: { detail: FarmDetail }) {
  const latest = useFarmLatest(detail.farm.id, detail.sheds);
  return (
    <Card flush>
      <div className={`${styles.cardHead} ${styles.cardHeadPadded}`}>
        <span className={styles.sectionLabel}>Latest entries from the app</span>
        <Link to="/staff" className={styles.link}>
          Activity log <span aria-hidden="true">→</span>
        </Link>
      </div>
      <DataTable
        label="Latest entries from the app"
        columns={LATEST_COLUMNS}
        rows={latest.data ?? []}
        rowKey={(row) => row.key}
        loading={latest.isPending}
        skeletonRows={6}
        error={latest.isError ? "Couldn't load the latest entries." : undefined}
        onRetry={() => void latest.refetch()}
        emptyTitle="No entries yet"
        emptyNote="Milk, feed and health entries from the app show here."
      />
    </Card>
  );
}

export function OverviewTab({ detail }: { detail: FarmDetail }) {
  return (
    <div className={styles.overview}>
      <Records detail={detail} />
      <div className={styles.milkRow}>
        <MilkCard detail={detail} />
        <ComingUp farmId={detail.farm.id} />
      </div>
      <LatestEntries detail={detail} />
    </div>
  );
}
