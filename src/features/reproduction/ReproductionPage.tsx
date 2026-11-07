import { useEffect, useMemo, useState } from 'react';
import { CAN_EDIT, RoleGate } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { Icon, ICONS } from '../../components/Icon';
import { PAGE_SIZE, Pagination } from '../../components/Pagination';
import { Segmented } from '../../components/Segmented';
import type { CycleRow, UUID } from '../../data/types';
import { formatCount } from '../../lib/format';
import { useClearUrlParams, useLastPageGuard, useUrlPage, useUrlState } from '../../lib/url-state';
import { healthSourceLabel } from '../animal/helpers';
import { useAllFarms } from '../farmers/queries';
import { useSpecies } from '../livestock/queries';
import { AddCycleDialog } from './AddCycleDialog';
import { stageColumns } from './CycleColumns';
import { STAGE_NOTES, STAGE_TABS, STAGES, type Stage } from './helpers';
import { useAllCycles, useAnimalSpecies, useCycleList, useCycleLog } from './queries';
import { GoldenPeriods, Totals } from './ReproductionCards';
import { SlipDialog } from './SlipDialog';
import styles from './ReproductionPage.module.css';

const FILTER_KEYS = ['farm'] as const;
const TICK_MS = 30_000;

/** The clock the countdowns run on. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const STAGE_NOUNS: Record<Stage, string> = {
  heat: 'animals in heat',
  inseminated: 'inseminated animals',
  pregnant: 'pregnant animals',
};

export function ReproductionPage() {
  const [values, setValues] = useUrlState({ stage: 'heat', farm: '' });
  const [page, setPage] = useUrlPage();
  const clearFarm = useClearUrlParams(FILTER_KEYS);
  const [adding, setAdding] = useState(false);
  const [slip, setSlip] = useState<CycleRow | null>(null);
  const now = useNow();

  const stage: Stage = STAGES.includes(values.stage as Stage) ? (values.stage as Stage) : 'heat';
  const farmId: UUID | undefined = values.farm || undefined;

  const list = useCycleList(stage, farmId, page);
  const heat = useAllCycles('heat', farmId);
  const inseminated = useAllCycles('inseminated', farmId);
  const pregnant = useAllCycles('pregnant', farmId);
  const log = useCycleLog();
  const farms = useAllFarms();
  const species = useSpecies();
  const animalSpecies = useAnimalSpecies(stage === 'pregnant');

  const farmOptions = useMemo(
    () => [...(farms.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [farms.data],
  );

  const reporter = useMemo(() => {
    const entries = log.data;
    return (row: CycleRow) => healthSourceLabel(row, entries);
  }, [log.data]);

  const columns = useMemo(
    () =>
      stageColumns(stage, {
        now,
        reporter,
        speciesName: (row) => {
          const id = animalSpecies.data?.get(row.animal_id);
          return species.data?.find((item) => item.id === id)?.labels.en ?? null;
        },
        onViewSlip: setSlip,
      }),
    [stage, now, reporter, animalSpecies.data, species.data],
  );

  const counts: Record<Stage, number | undefined> = {
    heat: heat.data?.length,
    inseminated: inseminated.data?.filter((row) => !row.insemination_verified).length,
    pregnant: pregnant.data?.length,
  };

  const total = list.data?.total ?? 0;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  useLastPageGuard(!list.isPlaceholderData && total > 0 && page > lastPage, lastPage);

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Records</span>
          <h1 className={styles.title}>Reproduction</h1>
          <p className={styles.sub}>
            Heat → golden period → insemination → pregnant → delivered, across all farms.
          </p>
        </div>
        <div className={styles.actions}>
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
              Add cycle
            </Button>
          </RoleGate>
        </div>
      </header>

      <Totals
        heat={heat.data}
        inseminated={inseminated.data}
        pregnant={pregnant.data}
        isError={heat.isError || inseminated.isError || pregnant.isError}
      />

      <GoldenPeriods
        heat={heat.data}
        farmId={farmId}
        now={now}
        reporter={reporter}
        isError={heat.isError}
        onRetry={() => void heat.refetch()}
      />

      <Card flush>
        <div className={styles.tabsRow}>
          <Segmented
            label="Lists"
            value={stage}
            onChange={(next) => setValues({ stage: next })}
            options={STAGES.map((value) => {
              const count = counts[value];
              return {
                value,
                label: STAGE_TABS[value],
                count: count === undefined ? undefined : formatCount(count),
              };
            })}
          />
          <span className={styles.note}>{STAGE_NOTES[stage]}</span>
        </div>
        <DataTable
          label={STAGE_TABS[stage]}
          columns={columns}
          rows={list.data?.rows ?? []}
          rowKey={(row) => row.id}
          loading={list.isPending}
          skeletonRows={5}
          error={list.isError ? "Couldn't load this list." : undefined}
          onRetry={() => void list.refetch()}
          emptyTitle={farmId ? 'Nothing here for this farm' : 'Nothing here right now'}
          emptyNote={farmId ? 'Pick another farm or “All farms”.' : undefined}
          onClearFilters={farmId ? clearFarm : undefined}
        />
        {!list.isError && !list.isPending && total > PAGE_SIZE && (
          <Pagination page={page} total={total} noun={STAGE_NOUNS[stage]} onPageChange={setPage} />
        )}
      </Card>

      {adding && (
        <AddCycleDialog
          defaultFarmId={farmId}
          onAdded={(next, farm) => setValues({ stage: next, farm })}
          onClose={() => setAdding(false)}
        />
      )}
      {slip && <SlipDialog cycle={slip} onClose={() => setSlip(null)} />}
    </>
  );
}
