import { useMemo, useState } from 'react';
import { CAN_EDIT, RoleGate, useHasRole } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { Icon, ICONS } from '../../components/Icon';
import { PAGE_SIZE, Pagination } from '../../components/Pagination';
import { Segmented } from '../../components/Segmented';
import type { FeedRow, MilkRow, UUID } from '../../data/types';
import { indiaDay, shiftDay } from '../../lib/format';
import { useClearUrlParams, useLastPageGuard, useUrlPage, useUrlState } from '../../lib/url-state';
import { useAllFarms } from '../farmers/queries';
import { AddEntryDialog } from './AddEntryDialog';
import { feedColumns, milkColumns } from './EntryColumns';
import { DeleteEntryDialog, FixEntryDialog, type EntryTarget } from './FixEntryDialog';
import { feedTotals, lastSevenDays, milkDays, milkMonths, monthRange } from './helpers';
import { DailyCharts, MonthlyCharts, Totals } from './MilkFeedCards';
import {
  useFarmsLogged,
  useFeedDaily,
  useFeedList,
  useMilkDaily,
  useMilkList,
  useStaffAdded,
  type EntryKind,
} from './queries';
import styles from './MilkFeedPage.module.css';

const FILTER_KEYS = ['farm'] as const;

export function MilkFeedPage() {
  const [values, setValues] = useUrlState({ period: 'daily', tab: 'milk', farm: '' });
  const [page, setPage] = useUrlPage();
  const clearFarm = useClearUrlParams(FILTER_KEYS);
  const [adding, setAdding] = useState(false);
  const [fixing, setFixing] = useState<EntryTarget | null>(null);
  const [deleting, setDeleting] = useState<EntryTarget | null>(null);
  const canEdit = useHasRole(CAN_EDIT);

  const monthly = values.period === 'monthly';
  const tab: EntryKind = values.tab === 'feed' ? 'feed' : 'milk';
  const farmId: UUID | undefined = values.farm || undefined;

  const today = indiaDay();
  const days = useMemo(() => lastSevenDays(today), [today]);
  const range = useMemo(() => monthRange(today), [today]);
  const yesterday = shiftDay(today, -1);
  const dayBefore = shiftDay(today, -2);

  const farms = useAllFarms();
  const milkDaily = useMilkDaily(days[0] as string, yesterday, farmId);
  const feedDaily = useFeedDaily(dayBefore, yesterday, farmId);
  const milkByMonth = useMilkDaily(range.from, range.to, farmId, monthly);
  const feedOfMonth = useFeedDaily(range.last.from, range.last.to, farmId, monthly);
  const farmsLogged = useFarmsLogged(range.last.from, range.last.to, monthly && !farmId);

  const milkList = useMilkList(farmId, page, tab === 'milk');
  const feedList = useFeedList(farmId, page, tab === 'feed');
  const staffAdded = useStaffAdded(tab);

  const farmOptions = useMemo(
    () => [...(farms.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [farms.data],
  );
  const farmName = farmId
    ? (farmOptions.find((farm) => farm.id === farmId)?.name ?? 'This farm')
    : 'all farms';

  const milk = useMemo(
    () => (milkDaily.data ? milkDays(milkDaily.data, days) : undefined),
    [milkDaily.data, days],
  );
  const feedYesterday = useMemo(
    () => (feedDaily.data ? feedTotals(feedDaily.data, yesterday) : undefined),
    [feedDaily.data, yesterday],
  );
  const feedBefore = useMemo(
    () => (feedDaily.data ? feedTotals(feedDaily.data, dayBefore) : undefined),
    [feedDaily.data, dayBefore],
  );
  const months = useMemo(
    () => (milkByMonth.data ? milkMonths(milkByMonth.data, range.months) : undefined),
    [milkByMonth.data, range.months],
  );
  const feedCost = useMemo(
    () => feedOfMonth.data?.reduce((sum, row) => sum + row.cost, 0),
    [feedOfMonth.data],
  );

  const milkTable = useMemo(
    () =>
      milkColumns({
        canEdit,
        staffAdded: staffAdded.data,
        onFix: (row: MilkRow) => setFixing({ kind: 'milk', row }),
        onDelete: (row: MilkRow) => setDeleting({ kind: 'milk', row }),
      }),
    [canEdit, staffAdded.data],
  );
  const feedTable = useMemo(
    () =>
      feedColumns({
        canEdit,
        staffAdded: staffAdded.data,
        onFix: (row: FeedRow) => setFixing({ kind: 'feed', row }),
        onDelete: (row: FeedRow) => setDeleting({ kind: 'feed', row }),
      }),
    [canEdit, staffAdded.data],
  );

  const list = tab === 'milk' ? milkList : feedList;
  const total = list.data?.total ?? 0;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  useLastPageGuard(!list.isPlaceholderData && total > 0 && page > lastPage, lastPage);

  const tableState = {
    loading: list.isPending,
    skeletonRows: 8,
    error: list.isError ? "Couldn't load these entries." : undefined,
    onRetry: () => void list.refetch(),
    emptyTitle: farmId ? 'No entries for this farm' : 'No entries yet',
    emptyNote: farmId ? 'Pick another farm or add an entry.' : undefined,
    onClearFilters: farmId ? clearFarm : undefined,
  };

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Records</span>
          <h1 className={styles.title}>Milk &amp; feed</h1>
          <p className={styles.sub}>What farmers log in the app, every session, on every farm.</p>
        </div>
        <div className={styles.actions}>
          <Segmented
            label="View"
            value={monthly ? 'monthly' : 'daily'}
            onChange={(next) => setValues({ period: next })}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          <select
            className={styles.farmSelect}
            aria-label="Farm"
            value={values.farm}
            onChange={(event) => setValues({ farm: event.target.value })}
          >
            <option value="">All farms</option>
            {farmOptions.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
          <RoleGate allow={CAN_EDIT}>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Icon d={ICONS.plus} size={14} />
              Add entry
            </Button>
          </RoleGate>
        </div>
      </header>

      <Totals
        milk={milk}
        feedYesterday={feedYesterday}
        feedBefore={feedBefore}
        farmName={farmName}
        isError={milkDaily.isError || feedDaily.isError}
      />

      {monthly ? (
        <MonthlyCharts
          range={range}
          months={months}
          feedCost={feedCost}
          farmsLogged={farmId ? null : { logged: farmsLogged.data, total: farms.data?.length }}
          farmName={farmName}
          isError={milkByMonth.isError}
          onRetry={() => void milkByMonth.refetch()}
        />
      ) : (
        <DailyCharts
          days={milk}
          feed={feedYesterday}
          milkError={milkDaily.isError}
          feedError={feedDaily.isError}
          onRetryMilk={() => void milkDaily.refetch()}
          onRetryFeed={() => void feedDaily.refetch()}
        />
      )}

      <Card flush>
        <div className={styles.tabsRow}>
          <Segmented
            label="Entries"
            value={tab}
            onChange={(next) => setValues({ tab: next })}
            options={[
              { value: 'milk', label: 'Milk entries' },
              { value: 'feed', label: 'Feed entries' },
            ]}
          />
          <span className={styles.note}>Newest first · fixes by staff are marked and logged</span>
        </div>
        {tab === 'milk' ? (
          <DataTable
            label="Milk entries"
            columns={milkTable}
            rows={milkList.data?.rows ?? []}
            rowKey={(row) => row.id}
            {...tableState}
          />
        ) : (
          <DataTable
            label="Feed entries"
            columns={feedTable}
            rows={feedList.data?.rows ?? []}
            rowKey={(row) => row.id}
            {...tableState}
          />
        )}
        {!list.isError && !list.isPending && total > PAGE_SIZE && (
          <Pagination
            page={page}
            total={total}
            noun={tab === 'milk' ? 'milk entries' : 'feed entries'}
            onPageChange={setPage}
          />
        )}
      </Card>

      {adding && (
        <AddEntryDialog
          defaultFarmId={farmId}
          onAdded={(kind, farm) => setValues({ tab: kind, farm: farmId ? farm : '' })}
          onClose={() => setAdding(false)}
        />
      )}
      {fixing && (
        <FixEntryDialog key={fixing.row.id} target={fixing} onClose={() => setFixing(null)} />
      )}
      {deleting && <DeleteEntryDialog target={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
