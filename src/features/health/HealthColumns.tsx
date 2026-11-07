import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import type { Column } from '../../components/DataTable';
import { Icon, ICONS } from '../../components/Icon';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type { AuditLogEntry, HealthRow, HealthStatus, VaccinationRow } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { HEALTH_LABELS, HEALTH_TONES } from '../../lib/labels';
import { addedBy, healthSourceLabel } from '../animal/helpers';
import { useSetHealthStatus, useSetVaccinationDone } from '../animal/queries';
import { animalLabel, givenHere, resolvedHere, sinceText, vaccineStatus } from './helpers';
import styles from './HealthPage.module.css';

type SpeciesName = (id: string) => string;

/** The name in a toast, without the table's species note. */
const plainName = (animal: VaccinationRow['animal']) => animal.name ?? `Tag ${animal.tag_number}`;

function AnimalCell({
  animal,
  farmName,
  speciesName,
}: {
  animal: VaccinationRow['animal'];
  farmName: string;
  speciesName: SpeciesName;
}) {
  return (
    <Link to={`/animals/${animal.id}`} className={styles.who}>
      <span className={styles.tag}>{animal.tag_number}</span>
      <span>
        <b className={styles.name}>{animalLabel(animal, speciesName)}</b>
        <small className={styles.farm}>{farmName}</small>
      </span>
    </Link>
  );
}

function VaccineAction({ row, canUndo }: { row: VaccinationRow; canUndo: boolean }) {
  const toast = useToast();
  const setDone = useSetVaccinationDone();
  const name = plainName(row.animal);

  function mark(done: boolean) {
    setDone.mutate(
      { id: row.id, done },
      {
        onSuccess: () =>
          toast.show(
            done
              ? `${row.vaccine_name} marked given for ${name} · the farmer sees it in the app`
              : `Undone · ${name} is back to ${vaccineStatus({ ...row, done_date: null }).text.toLowerCase()}`,
          ),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  }

  if (!row.done_date) {
    return (
      <Button size="sm" disabled={setDone.isPending} onClick={() => mark(true)}>
        <Icon d={ICONS.check} size={13} />
        Mark given
      </Button>
    );
  }
  return canUndo ? (
    <Button size="sm" disabled={setDone.isPending} onClick={() => mark(false)}>
      Undo
    </Button>
  ) : null;
}

export function vaccineColumns({
  canEdit,
  log,
  speciesName,
}: {
  canEdit: boolean;
  log: readonly AuditLogEntry[] | undefined;
  speciesName: SpeciesName;
}): Column<VaccinationRow>[] {
  const columns: Column<VaccinationRow>[] = [
    {
      key: 'animal',
      header: 'Animal',
      cell: (row) => (
        <AnimalCell animal={row.animal} farmName={row.farm_name} speciesName={speciesName} />
      ),
    },
    { key: 'vaccine', header: 'Vaccine', cell: (row) => row.vaccine_name },
    {
      key: 'due',
      header: 'Due',
      cell: (row) => <span className={styles.date}>{formatDate(row.due_date)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const status = vaccineStatus(row);
        return (
          <StatusPill tone={status.tone} dot>
            {status.text}
          </StatusPill>
        );
      },
    },
  ];
  if (!canEdit) return columns;
  return [
    ...columns,
    {
      key: 'action',
      header: 'Action',
      hideHeader: true,
      shrink: true,
      align: 'right',
      cell: (row) => <VaccineAction row={row} canUndo={givenHere(row, log)} />,
    },
  ];
}

function HealthAction({ row, undoTo }: { row: HealthRow; undoTo: HealthStatus | null }) {
  const toast = useToast();
  const setStatus = useSetHealthStatus();

  function change(status: HealthStatus, message: string) {
    setStatus.mutate(
      { id: row.id, status },
      {
        onSuccess: () => toast.show(message),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  }

  if (row.status !== 'resolved') {
    return (
      <Button
        size="sm"
        disabled={setStatus.isPending}
        onClick={() => change('resolved', `“${row.title}” resolved for ${plainName(row.animal)}`)}
      >
        Mark resolved
      </Button>
    );
  }
  return undoTo ? (
    <Button
      size="sm"
      disabled={setStatus.isPending}
      onClick={() => change(undoTo, `Undone · back to ${HEALTH_LABELS[undoTo].toLowerCase()}`)}
    >
      Undo
    </Button>
  ) : null;
}

export function healthColumns({
  canEdit,
  log,
  speciesName,
}: {
  canEdit: boolean;
  log: readonly AuditLogEntry[] | undefined;
  speciesName: SpeciesName;
}): Column<HealthRow>[] {
  const columns: Column<HealthRow>[] = [
    {
      key: 'animal',
      header: 'Animal',
      cell: (row) => (
        <AnimalCell animal={row.animal} farmName={row.farm_name} speciesName={speciesName} />
      ),
    },
    {
      key: 'issue',
      header: 'Issue',
      cell: (row) => {
        const note =
          row.notes ?? (addedBy(log, row.id) ? 'Added by staff from the admin dashboard.' : null);
        return (
          <span className={styles.issue}>
            <b className={styles.name}>{row.title}</b>
            {note && <span className={styles.note}>{note}</span>}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill tone={HEALTH_TONES[row.status]} dot>
          {HEALTH_LABELS[row.status]}
        </StatusPill>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      cell: (row) => <StatusPill tone="grey">{healthSourceLabel(row, log)}</StatusPill>,
    },
    {
      key: 'since',
      header: 'Since',
      cell: (row) => <span className={styles.date}>{sinceText(row.detected_at)}</span>,
    },
  ];
  if (!canEdit) return columns;
  return [
    ...columns,
    {
      key: 'action',
      header: 'Action',
      hideHeader: true,
      shrink: true,
      align: 'right',
      cell: (row) => <HealthAction row={row} undoTo={resolvedHere(row, log)} />,
    },
  ];
}
