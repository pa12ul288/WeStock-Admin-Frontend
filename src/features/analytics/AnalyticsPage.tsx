import { useMemo } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon, ICONS } from '../../components/Icon';
import { Segmented } from '../../components/Segmented';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type { AnimalListRow, FarmListRow } from '../../data/types';
import { downloadCsv } from '../../lib/csv';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatDayMonth, indiaDay, shiftDay } from '../../lib/format';
import { useClearUrlParams, useUrlState } from '../../lib/url-state';
import {
  ActivityCard,
  CardSkeleton,
  CattleTemperatureCard,
  FeedCard,
  MilkCard,
} from './AnalyticsCards';
import { analyticsCsv } from './export';
import { FarmTemperatureCard, shedLabel } from './FarmTemperature';
import {
  fileName,
  parseDay,
  parsePeriod,
  PERIODS,
  QUICK_FARMS,
  type Period,
  type TemperatureCow,
} from './helpers';
import {
  useAnalyticsAnimals,
  useAnalyticsFarm,
  useAnalyticsFarms,
  useAnalyticsSeries,
  useEnvironmentDays,
} from './queries';
import styles from './AnalyticsPage.module.css';

const DEFAULT_FEVER_C = 39.5;

const animalLabel = (animal: Pick<AnimalListRow, 'tag_number' | 'name'>) =>
  animal.name ? `${animal.tag_number} · ${animal.name}` : animal.tag_number;

/** The farm to open with: the prototype's first quick farm, or the first one listed. */
function defaultFarm(farms: readonly FarmListRow[]): FarmListRow | undefined {
  for (const name of QUICK_FARMS) {
    const found = farms.find((farm) => farm.name === name);
    if (found) return found;
  }
  return farms[0];
}

function rangeText(days: Period): string {
  const today = indiaDay();
  const from = shiftDay(today, -days);
  const to = shiftDay(today, -1);
  return `${formatDayMonth(from)} – ${formatDate(to)}`;
}

export function AnalyticsPage() {
  const [values, setValues] = useUrlState({ farm: '', animal: '', days: '7', shed: '', day: '' });
  const clear = useClearUrlParams(['animal', 'days']);
  const toast = useToast();
  const days = parsePeriod(values.days);
  const day = parseDay(values.day);

  const farms = useAnalyticsFarms();
  const farm = useMemo(() => {
    const list = farms.data;
    if (!list) return undefined;
    return values.farm ? list.find((row) => row.id === values.farm) : defaultFarm(list);
  }, [farms.data, values.farm]);
  const farmMissing = farms.isSuccess && !farm;
  const farmId = farm?.id;

  const detail = useAnalyticsFarm(farmId);
  const sheds = useMemo(() => detail.data?.sheds ?? [], [detail.data]);
  const animals = useAnalyticsAnimals(farmId);
  const animal = animals.data?.find((row) => row.id === values.animal) ?? null;
  const animalId = animal?.id ?? null;
  const series = useAnalyticsSeries(farmId, animalId);

  const hasBlackbox = farm?.has_blackbox ?? false;
  const shed = sheds.find((item) => item.id === values.shed) ?? sheds[0];
  const shedId = hasBlackbox ? (shed?.id ?? null) : null;
  const env = useEnvironmentDays(farmId, shedId, detail.isSuccess);

  const feverAt = detail.data?.farm.settings.high_temp_c ?? DEFAULT_FEVER_C;
  const collared = useMemo(
    () => (animals.data ?? []).filter((row) => row.connection_state !== 'no_hardware'),
    [animals.data],
  );
  const cows: TemperatureCow[] = (animal ? [animal] : collared).map((row) => ({
    name: row.name ?? row.tag_number,
    temp: row.last_temp_c,
  }));
  const hasCollars = animal ? animal.connection_state !== 'no_hardware' : hasBlackbox;

  const quick = QUICK_FARMS.flatMap((name) => {
    const found = farms.data?.find((row) => row.name === name);
    return found ? [found] : [];
  });
  const others = (farms.data ?? []).filter((row) => !quick.some((q) => q.id === row.id));
  const farmIsOther = farm !== undefined && !quick.some((q) => q.id === farm.id);

  const scopeName = animal ? animalLabel(animal) : 'Whole farm';
  const ready = series.isSuccess && farm !== undefined && detail.isSuccess && animals.isSuccess;

  function pickFarm(id: string) {
    setValues({ farm: id, animal: null, shed: null });
  }

  function download() {
    if (!series.data || !farm) return;
    const readings = env.data?.byDay.get(day) ?? [];
    const file = fileName(farm.name, scopeName, days);
    const csv = analyticsCsv({
      farmName: farm.name,
      scopeName,
      range: rangeText(days),
      days,
      series: series.data,
      hasCollars,
      collarCows: collared.length,
      env: env.data
        ? {
            day,
            source: hasBlackbox
              ? shed
                ? `${shedLabel(shed)} shed sensor`
                : 'Farm sensors'
              : 'Weather forecast',
            readings,
          }
        : null,
    });
    downloadCsv(file, csv);
    toast.show(`${file} downloaded`);
  }

  const scope = {
    farmId: farmId ?? '',
    animalId,
    animalName: animal ? (animal.name ?? animal.tag_number) : null,
    days,
    onClear: clear,
  };

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Insights · optional</span>
          <h1 className={styles.title}>Analytics</h1>
          <p className={styles.sub}>
            The same five graphs farmers see in the app, for any farm · {rangeText(days)}
          </p>
        </div>
        <div className={styles.actions}>
          <Segmented
            label="Period"
            options={PERIODS.map((value) => ({ value: String(value), label: `${value} days` }))}
            value={String(days)}
            onChange={(value) => setValues({ days: value })}
          />
          <Button onClick={download} disabled={!ready}>
            <Icon d={ICONS.download} size={15} />
            Download
          </Button>
        </div>
      </header>

      {farms.isError ? (
        <Card>
          <EmptyState
            title="The farms couldn’t load"
            note={errorMessage(farms.error)}
            actionLabel="Try again"
            onAction={() => void farms.refetch()}
          />
        </Card>
      ) : farmMissing ? (
        <Card>
          <EmptyState
            title="We couldn’t find that farm"
            note="It may have been removed."
            actionLabel="Clear filters"
            onAction={() => setValues({ farm: null, animal: null, shed: null })}
          />
        </Card>
      ) : (
        <>
          <div className={styles.filters}>
            {quick.length > 0 && (
              <Segmented
                label="Farm"
                options={quick.map((row) => ({ value: row.id, label: row.name }))}
                value={farmIsOther ? '' : (farmId ?? '')}
                onChange={pickFarm}
              />
            )}
            {farms.isPending ? (
              <Skeleton width={160} height={34} radius={11} />
            ) : (
              <select
                className={styles.select}
                aria-label="Other farm"
                value={farmIsOther ? farmId : ''}
                onChange={(event) => event.target.value && pickFarm(event.target.value)}
              >
                <option value="">{quick.length ? 'Other farms…' : 'Pick a farm…'}</option>
                {others.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            )}
            <select
              className={styles.select}
              aria-label="Animal"
              value={animalId ?? ''}
              onChange={(event) => setValues({ animal: event.target.value })}
            >
              <option value="">Whole farm</option>
              {(animals.data ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {animalLabel(row)}
                </option>
              ))}
            </select>
            {farm && (
              <StatusPill tone={hasBlackbox ? 'blue' : 'grey'}>
                {hasBlackbox ? 'Blackbox + collars' : 'Manual entry · no collars'}
              </StatusPill>
            )}
          </div>

          {series.isError && !series.data ? (
            <Card>
              <EmptyState
                title="The graphs couldn’t load"
                note={errorMessage(series.error)}
                actionLabel="Try again"
                onAction={() => void series.refetch()}
              />
            </Card>
          ) : series.data && farm && detail.isSuccess ? (
            <>
              <div className={styles.grid}>
                <MilkCard series={series.data} scope={scope} />
                <FeedCard series={series.data} scope={scope} />
              </div>
              <div className={styles.grid}>
                <ActivityCard
                  series={series.data}
                  scope={scope}
                  hasCollars={hasCollars}
                  collarCows={collared.length}
                />
                <CattleTemperatureCard
                  series={series.data}
                  scope={scope}
                  hasCollars={hasCollars}
                  cows={cows}
                  feverAt={feverAt}
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.grid} data-testid="analytics-loading">
                <CardSkeleton number={1} title="Milk" />
                <CardSkeleton number={2} title="Feed" />
              </div>
              <div className={styles.grid}>
                <CardSkeleton number={3} title="Activity" />
                <CardSkeleton number={4} title="Cattle temperature" />
              </div>
            </>
          )}

          {farm && detail.isSuccess ? (
            <FarmTemperatureCard
              farmId={farm.id}
              hasBlackbox={hasBlackbox}
              sheds={sheds}
              shedId={shedId}
              onShed={(id) => setValues({ shed: id })}
              day={day}
              onDay={(next) => setValues({ day: next })}
            />
          ) : (
            <CardSkeleton number={5} title="Farm temperature" />
          )}
        </>
      )}
    </>
  );
}
