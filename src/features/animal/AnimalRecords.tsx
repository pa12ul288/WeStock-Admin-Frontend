import { useState } from 'react';
import { CAN_EDIT, RoleGate } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type {
  AnimalDetail,
  AnimalListRow,
  HealthEvent,
  HealthStatus,
  Vaccination,
} from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatDayMonth, indiaDay } from '../../lib/format';
import { HEALTH_LABELS, HEALTH_TONES } from '../../lib/labels';
import { HealthEventDialog, VaccinationDialog } from './AnimalDialogs';
import {
  addedBy,
  cycleSteps,
  cycleTitle,
  healthSourceLabel,
  healthUndoTo,
  isOpenCycle,
  lastChange,
  sortVaccinations,
  vaccineState,
} from './helpers';
import { useSetHealthStatus, useSetVaccinationDone, useTableLog } from './queries';
import styles from './AnimalPage.module.css';

function VaccinationRow({ vaccination, canUndo }: { vaccination: Vaccination; canUndo: boolean }) {
  const toast = useToast();
  const setDone = useSetVaccinationDone();
  const state = vaccineState(vaccination);
  const name = vaccination.vaccine_name;

  function mark(done: boolean) {
    setDone.mutate(
      { id: vaccination.id, done },
      {
        onSuccess: () =>
          toast.show(
            done
              ? `${name} marked as given · the farmer sees it in the app`
              : `Undone · ${name} is back to ${vaccineState({ ...vaccination, done_date: null }).text.toLowerCase()}`,
          ),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  }

  return (
    <div className={styles.row}>
      <span className={styles.rowMain}>
        <b>{name}</b>
        <span className={styles.note}>
          {vaccination.done_date
            ? `Given ${formatDate(vaccination.done_date)}`
            : `Due ${formatDate(vaccination.due_date)}`}
        </span>
      </span>
      <StatusPill tone={state.tone}>{state.text}</StatusPill>
      <RoleGate allow={CAN_EDIT}>
        {!vaccination.done_date && (
          <Button size="sm" disabled={setDone.isPending} onClick={() => mark(true)}>
            Mark given
          </Button>
        )}
        {vaccination.done_date && canUndo && (
          <Button size="sm" disabled={setDone.isPending} onClick={() => mark(false)}>
            Undo
          </Button>
        )}
      </RoleGate>
    </div>
  );
}

export function VaccinationsCard({
  animal,
  vaccinations,
}: {
  animal: AnimalListRow;
  vaccinations: readonly Vaccination[];
}) {
  const [adding, setAdding] = useState(false);
  const log = useTableLog('vaccinations');
  return (
    <Card flush className={`${styles.listCard} ${styles.narrow}`}>
      <div className={styles.listHead}>
        <span className={styles.label}>Vaccinations</span>
        <RoleGate allow={CAN_EDIT}>
          <Button size="sm" onClick={() => setAdding(true)}>
            Add
          </Button>
        </RoleGate>
      </div>
      {vaccinations.length === 0 && <p className={styles.emptyRow}>No vaccinations yet.</p>}
      {sortVaccinations(vaccinations).map((vaccination) => (
        <VaccinationRow
          key={vaccination.id}
          vaccination={vaccination}
          // Only what staff marked here can be undone, as in the prototype: the log shows which.
          canUndo={Boolean(lastChange(log.data, vaccination.id, 'done_date')?.to)}
        />
      ))}
      {adding && <VaccinationDialog animal={animal} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function HealthRow({
  event,
  source,
  staffAdded,
  undoTo,
}: {
  event: HealthEvent;
  source: string;
  staffAdded: boolean;
  undoTo: HealthStatus | null;
}) {
  const toast = useToast();
  const setStatus = useSetHealthStatus();
  const [day = '', month = ''] = formatDayMonth(event.detected_at).split(' ');

  function change(status: HealthStatus, message: string) {
    setStatus.mutate(
      { id: event.id, status },
      {
        onSuccess: () => toast.show(message),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  }

  return (
    <div className={`${styles.row} ${styles.rowTop}`}>
      <span className={styles.dateBox} aria-hidden="true">
        <small>{month.toUpperCase()}</small>
        <b>{day}</b>
      </span>
      <span className={styles.healthMain}>
        <span className={styles.healthTitle}>
          <b>{event.title}</b>
          <StatusPill tone={HEALTH_TONES[event.status]}>{HEALTH_LABELS[event.status]}</StatusPill>
          <StatusPill tone="grey">{source}</StatusPill>
        </span>
        <span className={styles.srOnly}>Since {formatDate(event.detected_at)}</span>
        <span className={styles.healthNote}>
          {event.notes ?? (staffAdded ? 'Added by staff from the admin dashboard.' : '')}
        </span>
        <RoleGate allow={CAN_EDIT}>
          {event.status !== 'resolved' && (
            <Button
              size="sm"
              className={styles.rowButton}
              disabled={setStatus.isPending}
              onClick={() => change('resolved', `“${event.title}” marked resolved`)}
            >
              Mark resolved
            </Button>
          )}
          {undoTo && (
            <Button
              size="sm"
              className={styles.rowButton}
              disabled={setStatus.isPending}
              onClick={() =>
                change(undoTo, `Undone · back to ${HEALTH_LABELS[undoTo].toLowerCase()}`)
              }
            >
              Undo
            </Button>
          )}
        </RoleGate>
      </span>
    </div>
  );
}

export function HealthCard({
  animal,
  health,
}: {
  animal: AnimalListRow;
  health: readonly HealthEvent[];
}) {
  const [adding, setAdding] = useState(false);
  const log = useTableLog('health_events');
  const open = health.filter((event) => event.status !== 'resolved').length;
  return (
    <Card flush className={`${styles.listCard} ${styles.third}`}>
      <div className={styles.listHead}>
        <div className={styles.listTitle}>
          <span className={styles.label}>Health history</span>
          <StatusPill tone={open ? 'amber' : 'grey'}>
            {open ? `${open} open ${open === 1 ? 'issue' : 'issues'}` : 'No open issues'}
          </StatusPill>
        </div>
        <RoleGate allow={CAN_EDIT}>
          <Button size="sm" onClick={() => setAdding(true)}>
            Add event
          </Button>
        </RoleGate>
      </div>
      {health.length === 0 && <p className={styles.emptyRow}>No health events yet.</p>}
      {health.map((event) => (
        <HealthRow
          key={event.id}
          event={event}
          source={healthSourceLabel(event, log.data)}
          staffAdded={addedBy(log.data, event.id) !== null}
          undoTo={healthUndoTo(event, log.data)}
        />
      ))}
      {adding && <HealthEventDialog animal={animal} onClose={() => setAdding(false)} />}
    </Card>
  );
}

export function ReproductionCard({ cycles }: { cycles: AnimalDetail['cycles'] }) {
  return (
    <Card flush className={`${styles.card} ${styles.third}`}>
      <span className={styles.label}>Reproduction history</span>
      {cycles.length === 0 && <p className={styles.note}>No breeding records yet.</p>}
      {cycles.map((cycle) => (
        <div key={cycle.id} className={styles.cycle}>
          <StatusPill tone={isOpenCycle(cycle) ? 'pink' : 'grey'}>{cycleTitle(cycle)}</StatusPill>
          <div>
            {cycleSteps(cycle).map((step, index, steps) => (
              <div key={step.label} className={styles.step}>
                <div className={styles.rail}>
                  <span className={styles.dot} data-done={step.done} />
                  <span className={styles.line} data-last={index === steps.length - 1} />
                </div>
                <div className={styles.stepText}>
                  <b>{step.label}</b>
                  <span className={styles.muted}>{step.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

const MOST_PHOTOS = 10;

export function PhotosCard({ animal }: { animal: AnimalListRow }) {
  const photos = animal.photo_urls;
  return (
    <Card flush className={`${styles.card} ${styles.third}`}>
      <div className={styles.cardHead}>
        <span className={styles.label}>Photos</span>
        <span className={styles.monoNote}>
          {photos.length} of {MOST_PHOTOS}
        </span>
      </div>
      {photos.length === 0 ? (
        <p className={styles.note}>No photos yet.</p>
      ) : (
        <div className={styles.photos}>
          {photos.map((url, index) => (
            <img key={index} src={url} alt={`Photo ${index + 1} of tag ${animal.tag_number}`} />
          ))}
        </div>
      )}
      <p className={styles.noteLoose}>
        Added by the farmer from the app. Photos can only be viewed here.
      </p>
    </Card>
  );
}

/** The health card's note: what the open issue is, or when the last one ended. */
export function healthNote(health: readonly HealthEvent[]): string {
  const latestOpen = health.find((event) => event.status !== 'resolved');
  if (latestOpen) {
    return indiaDay(latestOpen.detected_at) === indiaDay()
      ? `${latestOpen.title}, since today`
      : `${latestOpen.title}, since ${formatDayMonth(latestOpen.detected_at)}`;
  }
  const resolved = health
    .map((event) => event.resolved_at)
    .filter((at): at is string => at !== null)
    .sort()
    .at(-1);
  return resolved ? `Last one resolved ${formatDayMonth(resolved)}` : 'No health events yet';
}
