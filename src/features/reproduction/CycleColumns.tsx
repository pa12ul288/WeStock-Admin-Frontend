import { Link } from 'react-router-dom';
import { CAN_EDIT, useHasRole } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import type { Column } from '../../components/DataTable';
import { StatusPill } from '../../components/StatusPill';
import { Switch } from '../../components/Switch';
import { useToast } from '../../components/Toast';
import type { CycleRow } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { gestation } from '../animal/helpers';
import {
  animalLabel,
  dueText,
  formatGoldenWindow,
  formatHeatStarted,
  heatAnswer,
  type Stage,
} from './helpers';
import { useSetVerified } from './queries';
import styles from './ReproductionPage.module.css';

const MAY_DELIVER_DAYS = 30;

function VerifySwitch({ cycle }: { cycle: CycleRow }) {
  const toast = useToast();
  const verify = useSetVerified();
  const canEdit = useHasRole(CAN_EDIT);
  const name = animalLabel(cycle.animal);
  if (!canEdit) {
    return cycle.insemination_verified ? (
      <StatusPill tone="green">Verified</StatusPill>
    ) : (
      <StatusPill tone="grey">Not verified</StatusPill>
    );
  }
  // The switch moves at once and holds until the list has caught up.
  const checked = verify.isPending ? verify.variables.verified : cycle.insemination_verified;
  return (
    <Switch
      checked={checked}
      label={`Verified for ${name}`}
      disabled={verify.isPending}
      onChange={(verified) =>
        verify.mutate(
          { id: cycle.id, verified },
          {
            onSuccess: () =>
              toast.show(
                verified
                  ? `Tube number for ${name} verified`
                  : `Tube number for ${name} marked not verified`,
              ),
            onError: (error) => toast.show(errorMessage(error), 'error'),
          },
        )
      }
    />
  );
}

const animalColumn: Column<CycleRow> = {
  key: 'animal',
  header: 'Animal',
  cell: ({ animal }) => (
    <Link to={`/animals/${animal.id}`} className={styles.who}>
      <span className={styles.tag}>{animal.tag_number}</span>
      <b className={styles.name}>{animal.name ?? '—'}</b>
    </Link>
  ),
};

const farmColumn: Column<CycleRow> = {
  key: 'farm',
  header: 'Farm',
  cell: (row) => row.farm_name,
};

export interface ColumnLookups {
  now: number;
  reporter: (row: CycleRow) => string;
  speciesName: (row: CycleRow) => string | null;
  onViewSlip: (row: CycleRow) => void;
}

function heatColumns({ now, reporter }: ColumnLookups): Column<CycleRow>[] {
  return [
    animalColumn,
    farmColumn,
    {
      key: 'started',
      header: 'Heat started',
      cell: (row) => (
        <span className={styles.numberMuted}>{formatHeatStarted(row.heat_started_at, now)}</span>
      ),
    },
    {
      key: 'golden',
      header: 'Golden period',
      cell: (row) => <span className={styles.number}>{formatGoldenWindow(row, now)}</span>,
    },
    {
      key: 'reported',
      header: 'Reported by',
      cell: (row) => <StatusPill tone="grey">{reporter(row)}</StatusPill>,
    },
    {
      key: 'answer',
      header: '"Heat alert correct?"',
      cell: (row) => {
        const { tone, answer } = heatAnswer(row, reporter(row));
        return (
          <StatusPill tone={tone} dot>
            {answer}
          </StatusPill>
        );
      },
    },
  ];
}

function inseminatedColumns({ onViewSlip }: ColumnLookups): Column<CycleRow>[] {
  return [
    animalColumn,
    farmColumn,
    {
      key: 'inseminated',
      header: 'Inseminated',
      cell: (row) => <span className={styles.numberMuted}>{formatDate(row.inseminated_at)}</span>,
    },
    {
      key: 'tube',
      header: 'Tube no.',
      cell: (row) => <span className={styles.number}>{row.tube_number ?? 'Not given'}</span>,
    },
    {
      key: 'slip',
      header: 'Slip photo',
      cell: (row) =>
        row.insemination_image_url ? (
          <Button
            size="sm"
            aria-label={`View photo for ${animalLabel(row.animal)}`}
            onClick={() => onViewSlip(row)}
          >
            View photo
          </Button>
        ) : (
          <span className={styles.muted}>No photo</span>
        ),
    },
    {
      key: 'verified',
      header: 'Verified',
      cell: (row) => <VerifySwitch cycle={row} />,
    },
  ];
}

function pregnantColumns({ speciesName }: ColumnLookups): Column<CycleRow>[] {
  return [
    animalColumn,
    farmColumn,
    {
      key: 'due',
      header: 'Expected delivery',
      cell: (row) => {
        const daysLeft = gestation(row)?.daysLeft;
        return (
          <div className={styles.due}>
            <span className={styles.number}>{formatDate(row.expected_delivery)}</span>
            {daysLeft !== undefined &&
              (daysLeft <= MAY_DELIVER_DAYS ? (
                <StatusPill tone="pink">{dueText(daysLeft)}</StatusPill>
              ) : (
                <span className={styles.note}>{dueText(daysLeft)}</span>
              ))}
          </div>
        );
      },
    },
    {
      key: 'gestation',
      header: 'Gestation',
      cell: (row) => {
        const progress = gestation(row);
        if (!progress) return <span className={styles.muted}>—</span>;
        const species = speciesName(row);
        return (
          <div className={styles.gestation}>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${progress.percent}%` }} />
            </div>
            <span className={styles.barText}>
              {species ? `${species} · ` : ''}day {progress.day} of {progress.total}
            </span>
          </div>
        );
      },
    },
    {
      key: 'cycle',
      header: 'Cycle',
      align: 'right',
      cell: (row) => <span className={styles.number}>{row.cycle_no}</span>,
    },
  ];
}

export function stageColumns(stage: Stage, lookups: ColumnLookups): Column<CycleRow>[] {
  if (stage === 'inseminated') return inseminatedColumns(lookups);
  return stage === 'pregnant' ? pregnantColumns(lookups) : heatColumns(lookups);
}
