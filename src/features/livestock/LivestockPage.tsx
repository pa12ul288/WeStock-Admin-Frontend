import { useMemo, useState } from 'react';
import { CAN_EDIT, RoleGate } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { FilterBar, type FilterSelect } from '../../components/FilterBar';
import { Icon, ICONS } from '../../components/Icon';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { PAGE_SIZE, Pagination } from '../../components/Pagination';
import { Segmented } from '../../components/Segmented';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type {
  AnimalListRow,
  AnimalStatus,
  ConnectionState,
  HealthStatus,
  UUID,
} from '../../data/types';
import { downloadCsv, toCsv } from '../../lib/csv';
import { errorMessage } from '../../lib/errors';
import { formatAge, formatCount } from '../../lib/format';
import { GENDER_LABELS, HEALTH_LABELS, HEALTH_TONES } from '../../lib/labels';
import { useClearUrlParams, useLastPageGuard, useUrlPage, useUrlState } from '../../lib/url-state';
import { useAllFarms } from '../farmers/queries';
import { AddAnimalDialog } from './AddAnimalDialog';
import {
  aadhaarNote,
  BREEDING_LABELS,
  breedingStage,
  CATEGORY_TABS,
  collarPill,
  collarText,
  COLLAR_OPTIONS,
  shedNote,
  STATUS_LABELS,
  type BreedingFilter,
  type CategoryTab,
} from './helpers';
import {
  fetchAllAnimals,
  useAnimalList,
  useAnimalTotals,
  useDueDates,
  useOpenHealth,
  useSpecies,
  type AnimalFilters,
} from './queries';
import styles from './LivestockPage.module.css';

const FILTER_KEYS = ['q', 'farm', 'cat', 'collar', 'breeding', 'status'] as const;

const COLLAR_SELECT: FilterSelect = {
  key: 'collar',
  label: 'Collar',
  options: [{ value: '', label: 'Any collar status' }, ...COLLAR_OPTIONS],
};

const BREEDING_SELECT: FilterSelect = {
  key: 'breeding',
  label: 'Breeding',
  options: [
    { value: '', label: 'Any breeding stage' },
    ...(Object.keys(BREEDING_LABELS) as BreedingFilter[]).map((value) => ({
      value,
      label: BREEDING_LABELS[value],
    })),
  ],
};

/** The list opens on active animals, so "Active" is the option that leaves the URL clean. */
const STATUS_SELECT: FilterSelect = {
  key: 'status',
  label: 'Status',
  options: [
    { value: '', label: 'Active' },
    { value: 'sold', label: 'Sold' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'all', label: 'All statuses' },
  ],
};

function statusFilter(value: string): AnimalStatus | undefined {
  if (value === 'all') return undefined;
  return value === 'sold' || value === 'deceased' ? value : 'active';
}

const oneOf = <T extends string>(allowed: readonly T[], value: string): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;

interface RowLookups {
  speciesName: (id: string) => string;
  due: Map<UUID, string | null> | undefined;
  health: Map<string, HealthStatus> | undefined;
}

const genderText = (row: AnimalListRow) => (row.gender ? GENDER_LABELS[row.gender] : 'Mixed');
const ageText = (row: AnimalListRow) => (row.dob ? formatAge(row.dob) : 'Age not set');

function animalColumns({ speciesName, due, health }: RowLookups): Column<AnimalListRow>[] {
  return [
    {
      key: 'animal',
      header: 'Animal',
      cell: (row) => (
        <div className={styles.who}>
          <span className={styles.tag}>{row.tag_number}</span>
          <span>
            <b className={styles.name}>{row.name ?? '—'}</b>
            <small className={styles.aadhaar}>{aadhaarNote(row.pashu_aadhaar)}</small>
          </span>
        </div>
      ),
    },
    {
      key: 'species',
      header: 'Species',
      cell: (row) => (
        <div className={styles.stack}>
          <span>
            {speciesName(row.species_id)} · {row.breed ?? 'Not set'}
          </span>
          <span className={styles.note}>
            {genderText(row)} · {ageText(row)}
          </span>
        </div>
      ),
    },
    {
      key: 'farm',
      header: 'Farm · shed',
      cell: (row) => (
        <div className={styles.stack}>
          <span>{row.farm_name}</span>
          <span className={styles.note}>{shedNote(row)}</span>
        </div>
      ),
    },
    {
      key: 'collar',
      header: 'Collar temp',
      cell: (row) => {
        const pill = collarPill(row);
        return pill ? (
          <StatusPill tone={pill.tone} dot numeric>
            {pill.text}
          </StatusPill>
        ) : (
          <span className={styles.muted}>No collar</span>
        );
      },
    },
    {
      key: 'breeding',
      header: 'Breeding',
      cell: (row) => {
        const stage = breedingStage(row.breeding_status, due?.get(row.id));
        return stage ? (
          <StatusPill tone="pink">{BREEDING_LABELS[stage]}</StatusPill>
        ) : (
          <span className={styles.muted}>—</span>
        );
      },
    },
    {
      key: 'health',
      header: 'Health',
      cell: (row) => {
        if (row.open_health === 0) return <span className={styles.muted}>No open issue</span>;
        const status = health?.get(row.id) ?? 'detected';
        return (
          <StatusPill tone={HEALTH_TONES[status]} dot>
            {HEALTH_LABELS[status]}
          </StatusPill>
        );
      },
    },
  ];
}

function Totals({ farmId, tab }: { farmId: UUID | undefined; tab: CategoryTab }) {
  const totals = useAnimalTotals(farmId);
  const farms = useAllFarms();
  const current = totals.byTab.get(tab);
  const value = (n: number | undefined) => {
    if (n !== undefined) return formatCount(n);
    return totals.isError ? '—' : <Skeleton width={70} height={28} />;
  };
  const blackbox = farms.data?.filter(
    (farm) => farm.has_blackbox && (!farmId || farm.id === farmId),
  ).length;
  const collarsNote =
    blackbox === undefined
      ? ''
      : `Cattle on ${formatCount(blackbox)} ${blackbox === 1 ? 'farm' : 'farms'} with a Blackbox`;
  return (
    <KpiGrid>
      <KpiCard
        label="Active animals"
        icon={<Icon d={ICONS.tag} />}
        value={value(current?.active)}
        note="Sold and deceased are hidden"
      />
      <KpiCard
        label="With collars"
        tone="navy"
        icon={<Icon d={ICONS.collar} />}
        value={value(current?.with_collar)}
        note={collarsNote}
      />
      <KpiCard
        label="Temperature high"
        tone="amber"
        icon={<Icon d={ICONS.thermometer} />}
        value={value(current?.temperature_high)}
        note="Collar reading at or above the fever limit"
      />
      <KpiCard
        label="Cannot connect"
        tone="red"
        icon={<Icon d={ICONS.noSignal} />}
        value={value(current?.cannot_connect)}
        note="No collar reading for 15 minutes or more"
      />
    </KpiGrid>
  );
}

const CSV_HEADERS = [
  'Tag',
  'Name',
  'Pashu Aadhaar',
  'Species',
  'Breed',
  'Gender',
  'Age',
  'Farm',
  'Shed',
  'Collar',
  'Breeding',
  'Health',
  'Status',
];

function useExport(filters: AnimalFilters, lookups: RowLookups) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const rows = await fetchAllAnimals(filters);
      const body = rows.map((row) => {
        const stage = breedingStage(row.breeding_status, lookups.due?.get(row.id));
        const health = lookups.health?.get(row.id);
        return [
          row.tag_number,
          row.name,
          aadhaarNote(row.pashu_aadhaar),
          lookups.speciesName(row.species_id),
          row.breed,
          genderText(row),
          ageText(row),
          row.farm_name,
          shedNote(row),
          collarText(row),
          stage ? BREEDING_LABELS[stage] : '',
          health ? HEALTH_LABELS[health] : '',
          STATUS_LABELS[row.status],
        ];
      });
      downloadCsv('livestock.csv', toCsv(CSV_HEADERS, body));
      toast.show(`livestock.csv downloaded · ${formatCount(body.length)} rows`);
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}

const CATEGORY_VALUES = CATEGORY_TABS.map((item) => item.value);
const COLLAR_VALUES = COLLAR_OPTIONS.map((option) => option.value);
const BREEDING_VALUES = Object.keys(BREEDING_LABELS) as BreedingFilter[];

export function LivestockPage() {
  const [values, setValues] = useUrlState({
    cat: 'all',
    q: '',
    farm: '',
    collar: '',
    breeding: '',
    status: '',
  });
  const [page, setPage] = useUrlPage();
  const clearFilters = useClearUrlParams(FILTER_KEYS);
  const [adding, setAdding] = useState(false);

  const tab: CategoryTab = oneOf(CATEGORY_VALUES, values.cat) ?? 'all';
  const farmId = values.farm || undefined;
  const filters = useMemo<AnimalFilters>(
    () => ({
      q: values.q || undefined,
      farm_id: values.farm || undefined,
      category: tab === 'all' ? undefined : tab,
      connection_state: oneOf<ConnectionState>(COLLAR_VALUES, values.collar),
      breeding: oneOf(BREEDING_VALUES, values.breeding),
      status: statusFilter(values.status),
    }),
    [values, tab],
  );

  const list = useAnimalList(filters, page);
  const totals = useAnimalTotals(farmId);
  const farms = useAllFarms();
  const species = useSpecies();
  const due = useDueDates();
  const health = useOpenHealth();

  const lookups = useMemo<RowLookups>(
    () => ({
      speciesName: (id) => species.data?.find((item) => item.id === id)?.labels.en ?? id,
      due: due.data,
      health: health.data,
    }),
    [species.data, due.data, health.data],
  );
  const columns = useMemo(() => animalColumns(lookups), [lookups]);

  const farmSelect = useMemo<FilterSelect>(
    () => ({
      key: 'farm',
      label: 'Farm',
      options: [
        { value: '', label: 'All farms' },
        ...(farms.data ?? [])
          .map((farm) => ({ value: farm.id, label: farm.name }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    }),
    [farms.data],
  );

  const total = list.data?.total ?? 0;
  const filtered = Boolean(
    values.q || values.farm || values.collar || values.breeding || values.status,
  );
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  useLastPageGuard(!list.isPlaceholderData && total > 0 && page > lastPage, lastPage);

  const { busy, run } = useExport(filters, lookups);
  // The pills need these to say the right thing, so the rows wait for them.
  const loading = list.isPending || due.isPending || health.isPending;

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Farms</span>
          <h1 className={styles.title}>Livestock</h1>
          <p className={styles.sub}>
            Every animal on every farm, grouped by species category like the app.
          </p>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => void run()} disabled={busy}>
            <Icon d={ICONS.download} size={15} />
            Export CSV
          </Button>
          <RoleGate allow={CAN_EDIT}>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Icon d={ICONS.plus} size={14} />
              Add animal
            </Button>
          </RoleGate>
        </div>
      </header>

      <Totals farmId={farmId} tab={tab} />

      <Card flush>
        <FilterBar
          searchLabel="Search tag, name or Pashu Aadhaar"
          selects={[farmSelect, COLLAR_SELECT, BREEDING_SELECT, STATUS_SELECT]}
          lead={
            <div className={styles.tabs}>
              <Segmented
                label="Species category"
                value={tab}
                onChange={(cat) => setValues({ cat })}
                options={CATEGORY_TABS.map(({ value, label }) => {
                  const count = totals.byTab.get(value)?.active;
                  return {
                    value,
                    label,
                    count: count === undefined ? undefined : formatCount(count),
                  };
                })}
              />
            </div>
          }
        />
        <DataTable
          label="Animals"
          columns={columns}
          rows={list.data?.rows ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          error={list.isError ? "Couldn't load the animals." : undefined}
          onRetry={() => void list.refetch()}
          rowLink={{
            href: (row) => `/animals/${row.id}`,
            label: (row) => `Open tag ${row.tag_number}`,
          }}
          emptyTitle="No animals match these filters"
          emptyNote="Try another farm, category or status."
          onClearFilters={filtered || tab !== 'all' ? clearFilters : undefined}
        />
        {!list.isError && !loading && (
          <Pagination
            page={page}
            total={total}
            noun={filtered ? 'matching animals' : 'animals'}
            onPageChange={setPage}
          />
        )}
      </Card>

      {adding && (
        <AddAnimalDialog
          defaultFarmId={farmId}
          onAdded={clearFilters}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
