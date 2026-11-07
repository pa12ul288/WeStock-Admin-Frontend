import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { Icon, ICONS } from '../../components/Icon';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import type { CycleRow, UUID } from '../../data/types';
import { formatCount, formatTime } from '../../lib/format';
import { mayDeliver } from '../livestock/helpers';
import { countdown, dueThisWeek, goldenNow, heatAnswer } from './helpers';
import styles from './ReproductionPage.module.css';

interface StageRows {
  heat: readonly CycleRow[] | undefined;
  inseminated: readonly CycleRow[] | undefined;
  pregnant: readonly CycleRow[] | undefined;
  isError: boolean;
}

export function Totals({ heat, inseminated, pregnant, isError }: StageRows) {
  const value = (n: number | undefined) => {
    if (n !== undefined) return formatCount(n);
    return isError ? '—' : <Skeleton width={70} height={28} />;
  };
  const toVerify = inseminated?.filter((row) => !row.insemination_verified).length;
  const due = pregnant?.filter((row) => mayDeliver(row.expected_delivery));
  const thisWeek = due?.filter((row) => dueThisWeek(row.expected_delivery)).length;
  return (
    <KpiGrid>
      <KpiCard
        label="In heat"
        step="STEP 1"
        tone="pink"
        icon={<Icon d={ICONS.flame} />}
        value={value(heat?.length)}
        note="Waiting for insemination"
      />
      <KpiCard
        label="Inseminated"
        step="STEP 2"
        tone="pink"
        icon={<Icon d={ICONS.vaccine} />}
        value={value(inseminated?.length)}
        note={
          toVerify === undefined
            ? ' '
            : `${formatCount(toVerify)} ${toVerify === 1 ? 'tube number' : 'tube numbers'} still to verify`
        }
      />
      <KpiCard
        label="Pregnant"
        step="STEP 3"
        tone="pink"
        icon={<Icon d={ICONS.heart} />}
        value={value(pregnant?.length)}
        note="Cattle 283 days · buffalo 310 days"
      />
      <KpiCard
        label="May deliver"
        step="STEP 4"
        tone="pink"
        icon={<Icon d={ICONS.calendarCheck} />}
        value={value(due?.length)}
        chip={
          thisWeek ? (
            <StatusPill tone="pink">{`${formatCount(thisWeek)} this week`}</StatusPill>
          ) : undefined
        }
        note="Pregnant and due within 30 days"
      />
    </KpiGrid>
  );
}

function GoldenCard({ cycle, now, reporter }: { cycle: CycleRow; now: number; reporter: string }) {
  const clock = countdown(cycle, now);
  const start = formatTime(cycle.golden_start);
  const end = formatTime(cycle.golden_end);
  const answer = heatAnswer(cycle, reporter);
  return (
    <Link to={`/animals/${cycle.animal.id}`} className={styles.goldenCard}>
      <div className={styles.goldenWho}>
        <span className={styles.tag}>{cycle.animal.tag_number}</span>
        <span className={styles.goldenName}>
          <b className={styles.name}>{cycle.animal.name ?? '—'}</b>
          <span className={styles.goldenFarm}>{cycle.farm_name}</span>
        </span>
      </div>
      <div className={styles.goldenLeft}>
        <span className={styles.goldenTime} data-tone={clock.tone}>
          {clock.left}
        </span>
        <span className={styles.note}>{clock.label}</span>
      </div>
      <div
        className={styles.track}
        role="img"
        aria-label={`Golden period ${start} to ${end}, ${clock.left} ${clock.label}`}
      >
        <div
          className={styles.fill}
          data-tone={clock.tone}
          style={{ width: `${clock.percent}%` }}
        />
      </div>
      <div className={styles.barEnds}>
        <span>{start}</span>
        <span>{end}</span>
      </div>
      <span className={styles.goldenPill}>
        <StatusPill tone={answer.tone}>{answer.card}</StatusPill>
      </span>
    </Link>
  );
}

interface GoldenPeriodsProps {
  heat: readonly CycleRow[] | undefined;
  farmId: UUID | undefined;
  now: number;
  reporter: (row: CycleRow) => string;
  isError: boolean;
  onRetry: () => void;
}

export function GoldenPeriods({
  heat,
  farmId,
  now,
  reporter,
  isError,
  onRetry,
}: GoldenPeriodsProps) {
  const cycles = goldenNow(heat ?? [], now);
  const count = heat
    ? ` · ${formatCount(cycles.length)} ${cycles.length === 1 ? 'animal' : 'animals'}`
    : '';
  let content;
  if (isError && !heat) {
    content = (
      <EmptyState
        title="Couldn't load the golden periods."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  } else if (!heat) {
    content = (
      <div className={styles.goldenGrid} data-testid="golden-skeleton">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className={styles.goldenCard}>
            <Skeleton width="60%" height={34} radius={10} />
            <Skeleton width="45%" height={26} />
            <Skeleton height={6} />
            <Skeleton width={120} height={24} radius={999} />
          </div>
        ))}
      </div>
    );
  } else if (cycles.length === 0) {
    content = (
      <EmptyState
        title={farmId ? 'No golden periods on this farm right now' : 'No golden periods right now'}
      />
    );
  } else {
    content = (
      <div className={styles.goldenGrid}>
        {cycles.map((cycle) => (
          <GoldenCard key={cycle.id} cycle={cycle} now={now} reporter={reporter(cycle)} />
        ))}
      </div>
    );
  }
  return (
    <section className={styles.golden} aria-label="Golden period now">
      <div className={styles.goldenHead}>
        <span className={styles.goldenTitle}>Golden period now{count}</span>
        <span className={styles.note}>
          Best time to inseminate is 2 to 12 hours after heat starts
        </span>
      </div>
      {content}
    </section>
  );
}
