import { useMemo, useState } from 'react';
import { AvatarName } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterBar, type FilterSelect } from '../../components/FilterBar';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PAGE_SIZE, Pagination } from '../../components/Pagination';
import { Segmented } from '../../components/Segmented';
import { Skeleton } from '../../components/Skeleton';
import { Sparkline } from '../../components/Sparkline';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type { FarmListRow, FarmerListRow, UUID } from '../../data/types';
import { downloadCsv, toCsv, type CsvCell } from '../../lib/csv';
import { errorMessage } from '../../lib/errors';
import {
  formatCount,
  formatDate,
  formatLitresTotal,
  formatPhone,
  formatRelative,
} from '../../lib/format';
import { LANGUAGE_LABELS, LANGUAGES, STATES, formatPlace, isLang } from '../../lib/labels';
import { useClearUrlParams, useLastPageGuard, useUrlPage, useUrlState } from '../../lib/url-state';
import { farmerTotals, farmsByOwner, percentOf, quietLevel } from './helpers';
import {
  fetchAllFarmers,
  fetchAllFarms,
  useAllFarmers,
  useAllFarms,
  useFarmerList,
  useFarmList,
  useMilkSparks,
} from './queries';
import styles from './FarmersPage.module.css';

const FILTER_KEYS = ['q', 'state', 'lang'] as const;

const ICONS = {
  people:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  check: 'M5 12l5 5 9-10',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16h.01',
};

function Icon({ d }: { d: string }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const STATE_SELECT: FilterSelect = {
  key: 'state',
  label: 'State',
  options: [
    { value: '', label: 'All states' },
    ...STATES.map((state) => ({ value: state, label: state })),
  ],
};

const LANGUAGE_SELECT: FilterSelect = {
  key: 'lang',
  label: 'App language',
  options: [
    { value: '', label: 'All languages' },
    ...LANGUAGES.map((lang) => ({ value: lang, label: LANGUAGE_LABELS[lang] })),
  ],
};

function LastEntry({ at }: { at: string | null }) {
  const level = quietLevel(at);
  const text = at === null ? 'No entries yet' : formatRelative(at);
  if (level === 'fresh') return <span className={styles.muted}>{text}</span>;
  return (
    <StatusPill tone={level === 'silent' ? 'red' : 'amber'} dot>
      {text}
    </StatusPill>
  );
}

const modeLabel = (row: FarmListRow) => (row.has_blackbox ? 'Blackbox + collars' : 'Manual entry');

function farmerFarm(farms: readonly FarmListRow[] | undefined): { first: string; more: string } {
  const extra = (farms?.length ?? 1) - 1;
  return { first: farms?.[0]?.name ?? '—', more: extra > 0 ? ` +${extra}` : '' };
}

function farmerColumns(byOwner: Map<UUID, FarmListRow[]>): Column<FarmerListRow>[] {
  return [
    {
      key: 'farmer',
      header: 'Farmer',
      cell: (row) => <AvatarName name={row.full_name} note={formatPhone(row.phone)} numericNote />,
    },
    { key: 'language', header: 'App language', cell: (row) => LANGUAGE_LABELS[row.language] },
    {
      key: 'farms',
      header: 'Farms',
      cell: (row) => {
        const { first, more } = farmerFarm(byOwner.get(row.id));
        return (
          <>
            {first}
            <span className={styles.muted}>{more}</span>
          </>
        );
      },
    },
    {
      key: 'animals',
      header: 'Animals',
      align: 'right',
      cell: (row) => <span className={styles.number}>{formatCount(row.animals)}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      cell: (row) => <span className={styles.muted}>{formatPlace(row.district, row.state)}</span>,
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (row) => (
        <span className={`${styles.number} ${styles.muted}`}>{formatDate(row.joined_at)}</span>
      ),
    },
    { key: 'last', header: 'Last entry', cell: (row) => <LastEntry at={row.last_entry_at} /> },
  ];
}

function farmColumns(sparks: Map<UUID, number[]>): Column<FarmListRow>[] {
  return [
    {
      key: 'farm',
      header: 'Farm',
      cell: (row) => <AvatarName name={row.name} note={row.owner_name} />,
    },
    {
      key: 'location',
      header: 'Location',
      cell: (row) => <span className={styles.muted}>{formatPlace(row.district, row.state)}</span>,
    },
    {
      key: 'sheds',
      header: 'Sheds',
      align: 'right',
      cell: (row) => <span className={styles.number}>{formatCount(row.sheds)}</span>,
    },
    {
      key: 'animals',
      header: 'Animals',
      align: 'right',
      cell: (row) => <span className={styles.number}>{formatCount(row.animals)}</span>,
    },
    {
      key: 'members',
      header: 'Members',
      align: 'right',
      cell: (row) => <span className={styles.number}>{formatCount(row.members)}</span>,
    },
    {
      key: 'mode',
      header: 'Mode',
      cell: (row) => (
        <StatusPill tone={row.has_blackbox ? 'blue' : 'grey'}>{modeLabel(row)}</StatusPill>
      ),
    },
    {
      key: 'milk',
      header: 'Milk, last 7 days',
      cell: (row) => (
        <div className={styles.milk}>
          <Sparkline values={sparks.get(row.id)} />
          <span className={styles.number}>
            {row.milk_7d > 0 ? formatLitresTotal(row.milk_7d) : 'No milk logged'}
          </span>
        </div>
      ),
    },
  ];
}

function FarmerCards() {
  const { data, isPending, isError } = useAllFarmers();
  const totals = useMemo(() => (data ? farmerTotals(data) : null), [data]);
  const value = (n: number | undefined) =>
    n === undefined ? isError ? '—' : <Skeleton width={70} height={28} /> : formatCount(n);
  const share = (part: number, tone: 'same' | 'down') =>
    totals ? { direction: tone, text: percentOf(part, totals.farmers), plain: true } : undefined;
  const growth = totals?.growthPct ?? 0;
  return (
    <KpiGrid>
      <KpiCard
        label="Farmers"
        icon={<Icon d={ICONS.people} />}
        value={value(totals?.farmers)}
        trend={totals ? { direction: growth > 0 ? 'up' : 'same', text: `${growth}%` } : undefined}
        note={
          isPending ? undefined : `${formatCount(totals?.joinedThisMonth ?? 0)} joined this month`
        }
      />
      <KpiCard
        label="Logged this week"
        icon={<Icon d={ICONS.check} />}
        value={value(totals?.loggedThisWeek)}
        trend={share(totals?.loggedThisWeek ?? 0, 'same')}
        note="Made an entry in the last 7 days"
      />
      <KpiCard
        label="Quiet 3–7 days"
        icon={<Icon d={ICONS.clock} />}
        value={value(totals?.quiet3to7)}
        trend={share(totals?.quiet3to7 ?? 0, 'same')}
        note="No entry for 3 to 7 days"
      />
      <KpiCard
        label="Quiet 7+ days"
        icon={<Icon d={ICONS.alert} />}
        value={value(totals?.quiet7plus)}
        trend={share(totals?.quiet7plus ?? 0, 'down')}
        note="May need a call from support"
      />
    </KpiGrid>
  );
}

function useExport(isFarmers: boolean, filters: { q?: string; state?: string; lang?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      let name: string;
      let headers: string[];
      let body: CsvCell[][];
      if (isFarmers) {
        const [{ rows }, farms] = await Promise.all([
          fetchAllFarmers({
            q: filters.q,
            state: filters.state,
            language: filters.lang && isLang(filters.lang) ? filters.lang : undefined,
          }),
          fetchAllFarms(),
        ]);
        const owners = farmsByOwner(farms.rows);
        name = 'farmers.csv';
        headers = [
          'Farmer',
          'Phone',
          'App language',
          'Farm',
          'Animals',
          'Location',
          'Joined',
          'Last entry',
        ];
        body = rows.map((row) => {
          const { first, more } = farmerFarm(owners.get(row.id));
          return [
            row.full_name,
            formatPhone(row.phone),
            LANGUAGE_LABELS[row.language],
            first + more,
            row.animals,
            formatPlace(row.district, row.state),
            formatDate(row.joined_at),
            row.last_entry_at === null ? 'No entries yet' : formatRelative(row.last_entry_at),
          ];
        });
      } else {
        const { rows } = await fetchAllFarms({ q: filters.q, state: filters.state });
        name = 'farms.csv';
        headers = [
          'Farm',
          'Owner',
          'Location',
          'Sheds',
          'Animals',
          'Members',
          'Mode',
          'Milk, last 7 days',
        ];
        body = rows.map((row) => [
          row.name,
          row.owner_name,
          formatPlace(row.district, row.state),
          row.sheds,
          row.animals,
          row.members,
          modeLabel(row),
          row.milk_7d > 0 ? formatLitresTotal(row.milk_7d) : 'No milk logged',
        ]);
      }
      downloadCsv(name, toCsv(headers, body));
      toast.show(`${name} downloaded · ${formatCount(body.length)} rows`);
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}

export function FarmersPage() {
  const [values, setValues] = useUrlState({ view: 'farmers', q: '', state: '', lang: '' });
  const [page, setPage] = useUrlPage();
  const clearFilters = useClearUrlParams(FILTER_KEYS);
  const isFarmers = values.view !== 'farms';

  const q = values.q || undefined;
  const state = values.state || undefined;
  const language = isLang(values.lang) ? values.lang : undefined;

  const farmerList = useFarmerList({ q, state, language }, page, isFarmers);
  const farmList = useFarmList({ q, state }, page, !isFarmers);
  const allFarmers = useAllFarmers();
  const allFarms = useAllFarms();

  const visibleFarms = useMemo(
    () => (isFarmers ? [] : (farmList.data?.rows ?? []).map((row) => row.id)),
    [isFarmers, farmList.data],
  );
  const sparks = useMilkSparks(visibleFarms);

  const farmers = useMemo(() => farmerColumns(allFarms.byOwner), [allFarms.byOwner]);
  const farms = useMemo(() => farmColumns(sparks), [sparks]);

  const list = isFarmers ? farmerList : farmList;
  const total = list.data?.total ?? 0;
  const noun = isFarmers ? 'farmers' : 'farms';
  const filtered = Boolean(q || state || (isFarmers && language));
  const showEmptyNote = 'Try another name, state or language.';

  // A page past the end of a list that shrank: show the last real page instead of nothing.
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const pastTheEnd = !list.isPlaceholderData && total > 0 && page > lastPage;
  useLastPageGuard(pastTheEnd, lastPage);

  const { busy, run } = useExport(isFarmers, values);

  const tableError = list.isError ? `Couldn't load the ${noun}.` : undefined;
  // A farmer's row needs their farms to name and open the first one.
  const loading = list.isPending || (isFarmers && allFarms.isPending);

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Farms</span>
          <h1 className={styles.title}>Farmers &amp; farms</h1>
          <p className={styles.sub}>Everyone using the WeSTOCK app, and the farms they run.</p>
        </div>
        <Button onClick={() => void run()} disabled={busy}>
          <svg
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          Export CSV
        </Button>
      </header>

      <FarmerCards />

      <Card flush>
        <FilterBar
          inline
          searchLabel={isFarmers ? 'Search name, phone or farm' : 'Search farm or owner'}
          selects={isFarmers ? [STATE_SELECT, LANGUAGE_SELECT] : [STATE_SELECT]}
          lead={
            <Segmented
              label="Show"
              value={isFarmers ? 'farmers' : 'farms'}
              onChange={(view) => setValues({ view })}
              options={[
                {
                  value: 'farmers',
                  label: 'Farmers',
                  count: allFarmers.data ? formatCount(allFarmers.data.length) : undefined,
                },
                {
                  value: 'farms',
                  label: 'Farms',
                  count: allFarms.data ? formatCount(allFarms.data.length) : undefined,
                },
              ]}
            />
          }
        />
        {isFarmers ? (
          <DataTable
            label="Farmers"
            columns={farmers}
            rows={farmerList.data?.rows ?? []}
            rowKey={(row) => row.id}
            loading={loading}
            error={tableError}
            onRetry={() => void farmerList.refetch()}
            rowLink={{
              href: (row) => {
                const first = allFarms.byOwner.get(row.id)?.[0];
                return first ? `/farms/${first.id}` : '/farmers?view=farms';
              },
              label: (row) => `Open ${row.full_name ?? 'farmer'}`,
            }}
            emptyNote={showEmptyNote}
            onClearFilters={filtered ? clearFilters : undefined}
          />
        ) : (
          <DataTable
            label="Farms"
            columns={farms}
            rows={farmList.data?.rows ?? []}
            rowKey={(row) => row.id}
            loading={loading}
            error={tableError}
            onRetry={() => void farmList.refetch()}
            rowLink={{
              href: (row) => `/farms/${row.id}`,
              label: (row) => `Open ${row.name}`,
            }}
            emptyNote={showEmptyNote}
            onClearFilters={filtered ? clearFilters : undefined}
          />
        )}
        {!list.isError && !loading && (
          <Pagination
            page={page}
            total={total}
            noun={filtered ? `matching ${noun}` : noun}
            onPageChange={setPage}
          />
        )}
      </Card>
    </>
  );
}
