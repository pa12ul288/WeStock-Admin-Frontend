import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type { AdminStaff, AuditLogEntry } from '../../data/types';
import { downloadCsv, toCsv } from '../../lib/csv';
import { formatCount, formatDateTime } from '../../lib/format';
import {
  changeText,
  describeEntry,
  LOG_KIND_LABELS,
  LOG_KIND_TONES,
  LOG_KINDS,
  type DescribedEntry,
  type Period,
} from './audit';
import {
  fetchLookup,
  matchingLogOptions,
  useActivityLog,
  useAuditLookup,
  useMatchingLog,
  type LogFilters,
} from './queries';
import styles from './StaffPage.module.css';

const CSV_NAME = 'activity-log.csv';

const columns: Column<DescribedEntry>[] = [
  {
    key: 'when',
    header: 'When',
    cell: (row) => <span className={styles.when}>{formatDateTime(row.entry.at)}</span>,
  },
  {
    key: 'staff',
    header: 'Staff',
    cell: (row) => (
      <span className={styles.who}>
        <Avatar name={row.entry.staff_name} small />
        {row.entry.staff_name ?? 'Unknown'}
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    cell: (row) => (
      <StatusPill tone={LOG_KIND_TONES[row.kind]}>{LOG_KIND_LABELS[row.kind]}</StatusPill>
    ),
  },
  {
    key: 'record',
    header: 'Record',
    cell: (row) => (
      <span className={styles.stack}>
        <span>{row.record}</span>
        <span className={styles.note}>{row.farm}</span>
      </span>
    ),
  },
  {
    key: 'change',
    header: 'Change',
    cell: (row) => (
      <span className={styles.stack}>
        {row.changes.map((line, index) => (
          <span key={index}>
            <span className={styles.muted}>{line.field}:</span>{' '}
            <span className={styles.from}>{line.from}</span>{' '}
            <span className={styles.muted} aria-label="to">
              →
            </span>{' '}
            <span className={styles.to}>{line.to}</span>
          </span>
        ))}
        {row.note && <span className={styles.note}>{row.note}</span>}
      </span>
    ),
  },
];

interface ActivityLogProps {
  filters: LogFilters;
  values: { who: string; action: string; period: Period };
  onChange: (patch: Partial<{ who: string; action: string; period: string }>) => void;
  onClear: () => void;
  staff: readonly AdminStaff[] | undefined;
  /** "71 this week". */
  weekCount: number | undefined;
}

export function ActivityLog({
  filters,
  values,
  onChange,
  onClear,
  staff,
  weekCount,
}: ActivityLogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const log = useActivityLog(filters);
  const matching = useMatchingLog(filters);

  const entries = useMemo(() => log.data?.pages.flatMap((page) => page.entries), [log.data]);
  const { lookup, ready } = useAuditLookup(entries);

  // Rows wait for what they point at, so a page of new rows never flashes half-described; the
  // rows already shown stay up meanwhile. Another filter starts again from skeletons.
  const filterKey = JSON.stringify(filters);
  const held = useRef<{ key: string; rows: DescribedEntry[] } | null>(null);
  const described = useMemo(
    () => (entries && ready ? entries.map((entry) => describeEntry(entry, lookup)) : null),
    [entries, ready, lookup],
  );
  if (described) held.current = { key: filterKey, rows: described };
  const rows = held.current?.key === filterKey ? held.current.rows : undefined;

  const filtered = Boolean(values.who || values.action || values.period);
  const total = matching.data?.length;
  const failed = log.isError;

  async function exportLog() {
    if (exporting) return;
    setExporting(true);
    try {
      const all: AuditLogEntry[] = await queryClient.fetchQuery(matchingLogOptions(filters));
      const allLookup = await fetchLookup(queryClient, all);
      const lines = all.map((entry) => describeEntry(entry, allLookup));
      const csv = toCsv(
        ['When', 'Staff', 'Action', 'Record', 'Farm', 'Change', 'Note'],
        lines.map((line) => [
          formatDateTime(line.entry.at),
          line.entry.staff_name,
          LOG_KIND_LABELS[line.kind],
          line.record,
          line.farm,
          line.changes.map(changeText).join('; '),
          line.note,
        ]),
      );
      downloadCsv(CSV_NAME, csv);
      toast.show(`${CSV_NAME} downloaded · ${formatCount(lines.length)} rows`);
    } catch {
      toast.show("Couldn't export the log. Try again.", 'error');
    } finally {
      setExporting(false);
    }
  }

  const period = values.period === '' ? ' this week' : '';
  const countText =
    rows && total !== undefined
      ? `Showing ${formatCount(rows.length)} of ${formatCount(total)} changes${period}`
      : null;

  return (
    <Card flush>
      <div className={`${styles.cardHead} ${styles.logHead}`}>
        <div className={styles.cardTitle}>
          <span className={styles.cardLabel}>Activity log</span>
          {weekCount !== undefined && (
            <StatusPill tone="grey" numeric>
              {formatCount(weekCount)} this week
            </StatusPill>
          )}
        </div>
        <div className={styles.filters}>
          <select
            className={styles.filter}
            aria-label="Staff"
            value={values.who}
            onChange={(event) => onChange({ who: event.target.value })}
          >
            <option value="">All staff</option>
            {(staff ?? []).map((person) => (
              <option key={person.user_id} value={person.user_id}>
                {person.full_name}
                {person.status === 'removed' ? ' (removed)' : ''}
              </option>
            ))}
          </select>
          <select
            className={styles.filter}
            aria-label="Action"
            value={values.action}
            onChange={(event) => onChange({ action: event.target.value })}
          >
            <option value="">All actions</option>
            {LOG_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {LOG_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <select
            className={styles.filter}
            aria-label="Period"
            value={values.period}
            onChange={(event) => onChange({ period: event.target.value })}
          >
            <option value="">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <Button size="sm" onClick={() => void exportLog()} disabled={exporting}>
            Export CSV
          </Button>
        </div>
      </div>
      <DataTable
        label="Activity log"
        columns={columns}
        rows={rows ?? []}
        rowKey={(row) => String(row.entry.id)}
        loading={!rows && !failed}
        skeletonRows={8}
        error={failed ? "Couldn't load the activity log." : undefined}
        onRetry={() => void log.refetch()}
        emptyTitle={filtered ? 'No changes match these filters' : 'No changes yet'}
        emptyNote={filtered ? 'Try another staff member, action or period.' : undefined}
        onClearFilters={filtered ? onClear : undefined}
      />
      <div className={styles.logFoot}>
        <span className={styles.count}>
          {countText ? `${countText} · ` : ''}log entries can’t be edited or deleted
        </span>
        {rows && log.hasNextPage && (
          <Button
            size="sm"
            onClick={() => void log.fetchNextPage()}
            disabled={log.isFetchingNextPage}
          >
            Load more
          </Button>
        )}
      </div>
    </Card>
  );
}
