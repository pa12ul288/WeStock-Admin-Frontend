import { useMemo, useState } from 'react';
import { CAN_EDIT, RoleGate, useHasRole } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { Icon, ICONS } from '../../components/Icon';
import { PAGE_SIZE, Pagination } from '../../components/Pagination';
import { Segmented } from '../../components/Segmented';
import type { UUID } from '../../data/types';
import { formatCount, indiaDay } from '../../lib/format';
import { useClearUrlParams, useLastPageGuard, useUrlPage, useUrlState } from '../../lib/url-state';
import { useAllFarms } from '../farmers/queries';
import { useSpecies } from '../livestock/queries';
import { healthColumns, vaccineColumns } from './HealthColumns';
import { HealthTotals } from './HealthTotals';
import {
  healthChip,
  healthList,
  healthTotals,
  vaccineChip,
  vaccineList,
  vaccineTotals,
} from './helpers';
import { useHealthLists } from './queries';
import { SchedulePanel } from './SchedulePanel';
import styles from './HealthPage.module.css';

const FILTER_KEYS = ['farm', 'species'] as const;
/** The prototype's filter: the species that get vaccines. */
const SPECIES_SHOWN: readonly string[] = ['cattle', 'buffalo', 'goat', 'sheep'];

const TAB_NOTES = {
  vax: 'Overdue first · due = within 7 days · upcoming = 8 to 30 days',
  issues: 'Sick first · Gau only suggests; the farmer confirms',
};

export function HealthPage() {
  const [values, setValues] = useUrlState({ tab: 'vax', farm: '', species: '' });
  const [page, setPage] = useUrlPage();
  const clearFilters = useClearUrlParams(FILTER_KEYS);
  const [scheduling, setScheduling] = useState(false);
  const canEdit = useHasRole(CAN_EDIT);

  const tab = values.tab === 'issues' ? 'issues' : 'vax';
  const farmId: UUID | undefined = values.farm || undefined;
  const speciesId = values.species || undefined;
  const filtered = Boolean(farmId || speciesId);
  const today = indiaDay();

  const farms = useAllFarms();
  const species = useSpecies();
  const lists = useHealthLists(farmId, speciesId);
  const { vaccinations, health, vaccinationLog, healthLog } = lists;

  const farmOptions = useMemo(
    () => [...(farms.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [farms.data],
  );
  const speciesOptions = useMemo(
    () => (species.data ?? []).filter((row) => SPECIES_SHOWN.includes(row.id)),
    [species.data],
  );

  const vaccineCounts = useMemo(
    () => (vaccinations ? vaccineTotals(vaccinations, today) : undefined),
    [vaccinations, today],
  );
  const healthCounts = useMemo(() => (health ? healthTotals(health) : undefined), [health]);
  const vaccineTrend = useMemo(
    () => (vaccinations ? vaccineChip(vaccinations, today) : null),
    [vaccinations, today],
  );
  const healthTrend = useMemo(() => (health ? healthChip(health) : null), [health]);

  const vaccineRows = useMemo(
    () => vaccineList(vaccinations ?? [], vaccinationLog, today),
    [vaccinations, vaccinationLog, today],
  );
  const healthRows = useMemo(
    () => healthList(health ?? [], healthLog, today),
    [health, healthLog, today],
  );

  const speciesName = useMemo(() => {
    const names = new Map((species.data ?? []).map((row) => [row.id, row.labels.en]));
    return (id: string) => names.get(id) ?? id;
  }, [species.data]);

  const vaccineTable = useMemo(
    () => vaccineColumns({ canEdit, log: vaccinationLog, speciesName }),
    [canEdit, vaccinationLog, speciesName],
  );
  const healthTable = useMemo(
    () => healthColumns({ canEdit, log: healthLog, speciesName }),
    [canEdit, healthLog, speciesName],
  );

  const isVax = tab === 'vax';
  const total = isVax ? vaccineRows.length : healthRows.length;
  const loaded = isVax ? vaccinations !== undefined : health !== undefined;
  const failed = isVax ? lists.vaccinationsFailed : lists.healthFailed;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  useLastPageGuard(loaded && total > 0 && page > lastPage, lastPage);
  const from = (page - 1) * PAGE_SIZE;

  const tableState = {
    loading: !loaded && !failed,
    skeletonRows: 7,
    emptyTitle: filtered
      ? 'Nothing matches this farm and species'
      : isVax
        ? 'No vaccinations waiting'
        : 'No open health issues',
    emptyNote: filtered ? 'Pick “All farms” or another species.' : undefined,
    onClearFilters: filtered ? clearFilters : undefined,
  };

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Records</span>
          <h1 className={styles.title}>Health &amp; vaccines</h1>
          <p className={styles.sub}>
            Vaccination schedules and health issues reported on every farm.
          </p>
        </div>
        <div className={styles.actions}>
          <select
            className={`${styles.filter} ${styles.farmFilter}`}
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
          <select
            className={styles.filter}
            aria-label="Species"
            value={values.species}
            onChange={(event) => setValues({ species: event.target.value })}
          >
            <option value="">All species</option>
            {speciesOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.labels.en}
              </option>
            ))}
          </select>
          <RoleGate allow={CAN_EDIT}>
            <Button
              variant="primary"
              aria-expanded={scheduling}
              onClick={() => setScheduling((open) => !open)}
            >
              <Icon d={ICONS.plus} size={14} />
              Vaccine schedule
            </Button>
          </RoleGate>
        </div>
      </header>

      <HealthTotals
        vaccines={vaccineCounts}
        vaccineTrend={vaccineTrend}
        vaccinesFailed={lists.vaccinationsFailed}
        health={healthCounts}
        healthTrend={healthTrend}
        healthFailed={lists.healthFailed}
      />

      {scheduling && (
        <RoleGate allow={CAN_EDIT}>
          <SchedulePanel
            defaultFarmId={farmId}
            onCreated={() => {
              setScheduling(false);
              setValues({ tab: 'vax' });
            }}
            onClose={() => setScheduling(false)}
          />
        </RoleGate>
      )}

      <Card flush>
        <div className={styles.tabsRow}>
          <Segmented
            label="Lists"
            value={tab}
            onChange={(next) => setValues({ tab: next })}
            options={[
              {
                value: 'vax',
                label: 'Vaccinations',
                count: vaccineCounts ? formatCount(vaccineCounts.total) : undefined,
              },
              {
                value: 'issues',
                label: 'Health issues',
                count: healthCounts ? formatCount(healthCounts.total) : undefined,
              },
            ]}
          />
          <span className={styles.note}>{TAB_NOTES[tab]}</span>
        </div>
        {isVax ? (
          <DataTable
            label="Vaccinations"
            columns={vaccineTable}
            rows={vaccineRows.slice(from, from + PAGE_SIZE)}
            rowKey={(row) => row.id}
            error={failed ? "Couldn't load the vaccinations." : undefined}
            onRetry={lists.retryVaccinations}
            {...tableState}
          />
        ) : (
          <DataTable
            label="Health issues"
            columns={healthTable}
            rows={healthRows.slice(from, from + PAGE_SIZE)}
            rowKey={(row) => row.id}
            error={failed ? "Couldn't load the health issues." : undefined}
            onRetry={lists.retryHealth}
            {...tableState}
          />
        )}
        {!failed && loaded && total > PAGE_SIZE && (
          <Pagination
            page={page}
            total={total}
            noun={isVax ? 'vaccinations' : 'health issues'}
            onPageChange={setPage}
          />
        )}
      </Card>
    </>
  );
}
