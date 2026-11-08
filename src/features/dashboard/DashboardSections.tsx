import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarName } from '../../components/Avatar';
import { buttonClass } from '../../components/Button';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { DataTable, type Column } from '../../components/DataTable';
import { Icon, ICONS } from '../../components/Icon';
import { KpiCard, KpiGrid, useKpiReveal } from '../../components/KpiCard';
import { Segmented } from '../../components/Segmented';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import type { Overview } from '../../data/types';
import {
  formatCount,
  formatDayMonth,
  formatKg,
  formatLitres,
  formatRelative,
  indiaDay,
  shiftDay,
} from '../../lib/format';
import { formatPlace, LANGUAGE_LABELS } from '../../lib/labels';
import { formatAxisLitres, niceTicks } from '../milk-feed/helpers';
import { describeEntry } from '../staff/audit';
import { useAuditLookup } from '../staff/queries';
import { ATTENTION_GROUPS } from './attention';
import {
  ISSUE_FILTERS,
  ISSUE_TONES,
  issueGroup,
  issueText,
  labelSpacing,
  languageShares,
  matchesIssue,
  milkBars,
  peakIndex,
  PERIODS,
  speciesShares,
  staffChangeLine,
  trendChip,
  type IssueFilter,
  type PeriodDays,
} from './helpers';
import styles from './DashboardPage.module.css';

type FarmRow = Overview['farms_needing_attention'][number];

/** How many farms the table lists, as in the prototype. */
const FARM_ROWS = 5;

const loading = <Skeleton width={90} height={30} />;

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      className={styles.chevron}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function Totals({ data }: { data: Overview | undefined }) {
  const yesterday = shiftDay(indiaDay(), -1);
  return (
    <KpiGrid>
      <KpiCard
        to="/farmers"
        icon={<Icon d={ICONS.people} />}
        label="Farmers"
        value={data ? formatCount(data.farmers) : loading}
        note="Registered in the app"
      />
      <KpiCard
        to="/farmers?view=farms"
        tone="navy"
        icon={<Icon d={ICONS.farm} />}
        label="Farms"
        value={data ? formatCount(data.farms) : loading}
        note={data ? `${formatCount(data.farms_with_blackbox)} run a Blackbox and collars` : ' '}
      />
      <KpiCard
        to="/livestock"
        tone="blue"
        icon={<Icon d={ICONS.tag} />}
        label="Active animals"
        value={data ? formatCount(data.active_animals) : loading}
        note="Not sold or deceased"
      />
      <KpiCard
        to="/milk-feed"
        tone="milk"
        icon={<Icon d={ICONS.milk} />}
        label="Milk yesterday"
        value={data ? formatLitres(data.milk_yesterday, { decimals: 0 }) : loading}
        note={`${formatDayMonth(`${yesterday}T12:00:00+05:30`)} · all three sessions`}
      />
    </KpiGrid>
  );
}

export function PeriodTotals({
  days,
  onDaysChange,
  data,
}: {
  days: PeriodDays;
  onDaysChange: (days: PeriodDays) => void;
  data: Overview | undefined;
}) {
  // The figures stay on the period they were read for until the new one arrives.
  const period = data?.period;
  const perDay = (value: number) => value / (period?.days ?? days);
  const grid = useRef<HTMLDivElement>(null);
  useKpiReveal(grid);
  return (
    <section className={styles.group} aria-label={`Last ${days} days`}>
      <div className={styles.groupHead}>
        <span className={styles.cardTitle}>Last {days} days</span>
        <Segmented
          label="Period"
          options={PERIODS.map((value) => ({ value: String(value), label: `${value} days` }))}
          value={String(days)}
          onChange={(value) => onDaysChange(Number(value) as PeriodDays)}
        />
      </div>
      <div ref={grid} className={styles.periodGrid}>
        <KpiCard
          tone="milk"
          icon={<Icon d={ICONS.milk} />}
          label="Milk collected"
          value={period ? formatLitres(period.milk_litres, { decimals: 0 }) : loading}
          trend={period ? trendChip(period.milk_trend_pct) : undefined}
          note={
            period
              ? `About ${formatLitres(perDay(period.milk_litres), { decimals: 0 })} a day`
              : ' '
          }
        />
        <KpiCard
          icon={<Icon d={ICONS.sprout} />}
          label="Feed logged"
          value={period ? formatKg(period.feed_kg) : loading}
          trend={period ? trendChip(period.feed_trend_pct) : undefined}
          note={period ? `About ${formatKg(Math.round(perDay(period.feed_kg)))} a day` : ' '}
        />
        <KpiCard
          tone="blue"
          icon={<Icon d={ICONS.vaccine} />}
          label="Vaccines given"
          value={period ? formatCount(period.vaccines_given) : loading}
          trend={period ? trendChip(period.vaccines_trend_pct) : undefined}
          note={
            data
              ? `${formatCount(data.needs_attention.vaccines_overdue)} still overdue across all farms`
              : ' '
          }
        />
      </div>
    </section>
  );
}

export function MilkPerDay({ data }: { data: Overview | undefined }) {
  const bars = useMemo(() => milkBars(data?.milk_per_day ?? []), [data]);
  const total = data?.period.milk_litres ?? 0;
  const days = (data?.period.days ?? 30) as PeriodDays;
  const peak = peakIndex(bars);
  const highest = bars[peak]?.litres ?? 0;
  const ticks = niceTicks(highest * 1.08);
  const top = ticks.at(-1);
  const spacing = labelSpacing(days);
  return (
    <Card className={styles.chartCard}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Milk collected per day · all farms</span>
        {data && (
          <span className={styles.headNote}>
            <span className={styles.number}>{formatLitres(total, { decimals: 0 })}</span> in the
            period
          </span>
        )}
      </div>
      {!data ? (
        <Skeleton height={232} radius={12} />
      ) : bars.length === 0 ? (
        <p className={styles.note}>No milk logged in this period.</p>
      ) : (
        <BarChart
          key={days}
          label={`Milk collected per day across all farms, ${formatDayMonth(bars[0]?.day)} to ${formatDayMonth(bars.at(-1)?.day)}; highest ${formatLitres(highest, { decimals: 0 })} on ${formatDayMonth(bars[peak]?.day)}`}
          data={bars}
          xKey="label"
          series={[{ key: 'litres', label: 'Milk' }]}
          height={232}
          yTicks={ticks}
          formatY={(value) => `${formatAxisLitres(value)}${value === top ? ' L' : ''}`}
          highlightIndex={peak}
          emphasisIndex={peak}
          labelEmphasisIndex={peak}
          rotateLabels={days !== 7}
          labelEvery={spacing.desktop}
          labelEveryOnPhone={spacing.phone}
          barGap={days === 90 ? '12%' : '18%'}
          phoneBarGap={days === 7 ? '35%' : '20%'}
          tooltip={(bar) => (
            <>
              {formatDayMonth(bar.day)} ·{' '}
              <b className={styles.number}>{formatLitres(bar.litres, { decimals: 0 })}</b>
            </>
          )}
        />
      )}
    </Card>
  );
}

export function NeedsAttention({ data }: { data: Overview | undefined }) {
  const attention = data?.needs_attention;
  const open = attention ? ATTENTION_GROUPS.filter((group) => attention[group.key] > 0).length : 0;
  return (
    <Card>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Needs attention today</h2>
        {attention && (
          <span className={styles.headNote}>
            {open} {open === 1 ? 'group' : 'groups'}
          </span>
        )}
      </div>
      <div className={styles.rows}>
        {ATTENTION_GROUPS.map((group) => (
          <Link key={group.key} to={group.to} className={styles.attention}>
            <span className={styles.icon} data-tone={group.tone}>
              <Icon d={group.icon} />
            </span>
            <span className={styles.text}>
              <span className={styles.rowTitle}>{group.title}</span>
              <span className={styles.note}>{group.note}</span>
            </span>
            <span className={styles.count}>
              {attention ? formatCount(attention[group.key]) : <Skeleton width={28} height={18} />}
            </span>
            <Chevron />
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function HerdBySpecies({ data }: { data: Overview | undefined }) {
  const shares = useMemo(() => speciesShares(data?.species_counts ?? []), [data]);
  const total = data?.active_animals ?? 0;
  return (
    <Card>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Herd by species</h2>
        <Link to="/livestock" className={styles.link}>
          Livestock <span aria-hidden="true">→</span>
        </Link>
      </div>
      {!data ? (
        <div className={styles.loadingRows}>
          <Skeleton width={180} height={30} />
          <Skeleton height={8} />
          <Skeleton width="80%" />
          <Skeleton width="70%" />
        </div>
      ) : (
        <>
          <div className={styles.herdTotal}>
            <span className={styles.big}>{formatCount(total)}</span>
            <span className={styles.note}>
              active animals on {formatCount(data.farms)} {data.farms === 1 ? 'farm' : 'farms'}
            </span>
          </div>
          <div
            className={styles.stack}
            role="img"
            aria-label={shares
              .map((row) => `${row.percent}% ${row.label.toLowerCase()}`)
              .join(', ')}
          >
            {shares
              .filter((row) => row.count > 0)
              .map((row) => (
                <span key={row.key} style={{ flexGrow: row.count, background: row.color }} />
              ))}
          </div>
          <ul className={styles.shareList}>
            {shares.map((row) => (
              <li key={row.key} className={styles.shareRow}>
                <span
                  className={styles.swatch}
                  style={{ background: row.color }}
                  aria-hidden="true"
                />
                <span className={styles.shareName}>{row.label}</span>
                <span className={styles.shareCount}>{formatCount(row.count)}</span>
                <span className={styles.sharePct}>{row.percent}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

const farmColumns: Column<FarmRow>[] = [
  {
    key: 'farm',
    header: 'Farm',
    cell: (row) => <AvatarName name={row.farm.name} note={row.farm.owner_name ?? 'No owner'} />,
  },
  {
    key: 'place',
    header: 'Location',
    cell: (row) => (
      <span className={styles.muted}>{formatPlace(row.farm.district, row.farm.state)}</span>
    ),
  },
  {
    key: 'animals',
    header: 'Animals',
    align: 'right',
    cell: (row) => <span className={styles.number}>{formatCount(row.farm.animals)}</span>,
  },
  {
    key: 'last',
    header: 'Last entry',
    cell: (row) => <LastEntry at={row.farm.last_entry_at} />,
  },
  {
    key: 'issue',
    header: 'Issue',
    cell: (row) => (
      <StatusPill tone={ISSUE_TONES[issueGroup(row.issue)]} dot>
        {issueText(row)}
      </StatusPill>
    ),
  },
];

function LastEntry({ at }: { at: string | null }) {
  return <span className={styles.muted}>{at ? formatRelative(at) : 'No entries yet'}</span>;
}

export function FarmsNeedingAttention({
  data,
  failed,
  onRetry,
  issue,
  onIssueChange,
}: {
  data: Overview | undefined;
  failed: boolean;
  onRetry: () => void;
  issue: IssueFilter;
  onIssueChange: (issue: IssueFilter) => void;
}) {
  const matching = useMemo(
    () => (data?.farms_needing_attention ?? []).filter((row) => matchesIssue(row, issue)),
    [data, issue],
  );
  const shown = matching.slice(0, FARM_ROWS);
  return (
    <Card flush>
      <div className={styles.tableHead}>
        <div className={styles.tableTitle}>
          <h2 className={styles.cardTitle}>Farms needing attention</h2>
          {data && (
            <StatusPill tone="grey">
              <span className={styles.number}>
                {shown.length} of {formatCount(matching.length)}
              </span>
            </StatusPill>
          )}
        </div>
        <div className={styles.actions}>
          <Segmented label="Issue" options={ISSUE_FILTERS} value={issue} onChange={onIssueChange} />
          <Link to="/farmers?view=farms" className={buttonClass('secondary', 'sm')}>
            View all farms
          </Link>
        </div>
      </div>
      <DataTable
        label="Farms needing attention"
        columns={farmColumns}
        rows={shown}
        rowKey={(row) => row.farm.id}
        loading={!data && !failed}
        skeletonRows={FARM_ROWS}
        error={failed ? 'The farms couldn’t load.' : undefined}
        onRetry={onRetry}
        rowLink={{
          href: (row) => `/farms/${row.farm.id}`,
          label: (row) => `Open ${row.farm.name}`,
        }}
        emptyTitle={issue === 'all' ? 'No farm needs attention today' : undefined}
        onClearFilters={issue === 'all' ? undefined : () => onIssueChange('all')}
      />
    </Card>
  );
}

export function RecentStaffChanges({ data }: { data: Overview | undefined }) {
  const entries = data?.recent_changes;
  const { lookup, ready } = useAuditLookup(entries);
  const lines = useMemo(
    () =>
      entries && ready
        ? entries.map((entry) => staffChangeLine(describeEntry(entry, lookup)))
        : null,
    [entries, ready, lookup],
  );
  return (
    <Card>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Recent staff changes</h2>
        <Link to="/staff" className={styles.link}>
          Activity log <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className={styles.rows}>
        {!lines ? (
          [0, 1, 2, 3, 4].map((index) => (
            <div key={index} className={styles.change} data-testid="skeleton-row">
              <Skeleton width={36} height={36} radius={999} />
              <span className={styles.text}>
                <Skeleton width="75%" />
                <Skeleton width="45%" height={12} />
              </span>
            </div>
          ))
        ) : lines.length === 0 ? (
          <p className={styles.empty}>No staff changes yet.</p>
        ) : (
          lines.map((line, index) => (
            <div key={entries?.[index]?.id ?? index} className={styles.change}>
              <Avatar name={line.who} />
              <span className={styles.text}>
                <span>
                  <b className={styles.who}>{line.who}</b> {line.what}
                </span>
                <span className={styles.note}>{line.where}</span>
              </span>
              <span className={styles.when}>{line.when}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function FarmersByLanguage({ data }: { data: Overview | undefined }) {
  const shares = useMemo(
    () => languageShares(data?.farmers_by_language ?? [], LANGUAGE_LABELS),
    [data],
  );
  const most = Math.max(1, ...shares.map((row) => row.count));
  return (
    <Card>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Farmers by app language</h2>
        {data && <span className={styles.headNote}>{formatCount(data.farmers)} farmers</span>}
      </div>
      {!data ? (
        <div className={styles.loadingRows}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} height={22} />
          ))}
        </div>
      ) : (
        <ul className={styles.languages}>
          {shares.map((row) => (
            <li key={row.key} className={styles.language}>
              <div className={styles.languageHead}>
                <span>
                  {row.label}
                  {row.native && <span className={styles.native}> {row.native}</span>}
                </span>
                <span className={styles.languageCount}>
                  {formatCount(row.count)} · {row.percent}%
                </span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <span style={{ width: `${(row.count / most) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
