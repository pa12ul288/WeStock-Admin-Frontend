import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { AnimalListRow, HealthStatus } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatDate, indiaDay, shiftDay } from '../../lib/format';
import { HEALTH_LABELS } from '../../lib/labels';
import { statusNote } from './helpers';
import { useAddHealthEvent, useAddVaccination, useUpdateAnimal } from './queries';
import styles from './AnimalPage.module.css';

interface DialogProps {
  animal: AnimalListRow;
  onClose: () => void;
}

const statusSchema = z.object({
  status: z.enum(['sold', 'deceased']),
  date: z
    .string()
    .min(1, 'Pick the date.')
    .refine((day) => day <= indiaDay(), "The date can't be in the future."),
  note: z.string(),
});
type StatusValues = z.infer<typeof statusSchema>;

export function animalName(animal: Pick<AnimalListRow, 'name' | 'tag_number'>): string {
  return animal.name ?? `Tag ${animal.tag_number}`;
}

export function StatusDialog({ animal, onClose }: DialogProps) {
  const toast = useToast();
  const update = useUpdateAnimal(animal.id);
  const name = animalName(animal);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StatusValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { status: 'sold', date: indiaDay(), note: '' },
  });

  const submit = handleSubmit(({ status, date, note }) => {
    update.mutate(
      { patch: { status }, note: statusNote(status, date, note) },
      {
        onSuccess: () => {
          toast.show(`${name} marked ${status} on ${formatDate(date)}`);
          onClose();
        },
      },
    );
  });

  return (
    <Modal
      title={`Mark ${name} as sold or deceased`}
      subtitle="Use this when the farmer has sold the animal or it has died."
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            Save status
          </Button>
        </>
      }
    >
      <div className={styles.dialogGrid}>
        <Field label="New status">
          <select className={inputClass} {...register('status')}>
            <option value="sold">Sold</option>
            <option value="deceased">Deceased</option>
          </select>
        </Field>
        <Field label="Date" error={errors.date?.message}>
          <input className={inputClass} type="date" max={indiaDay()} {...register('date')} />
        </Field>
      </div>
      <Field label="Note">
        <textarea
          className={styles.textarea}
          rows={2}
          placeholder="e.g. Sold to a farmer in Sangli"
          {...register('note')}
        />
      </Field>
      <p className={styles.dialogNote}>
        The animal leaves the active herd. Its records stay and the change is logged.
      </p>
      {update.isError && <FormError>{errorMessage(update.error)}</FormError>}
    </Modal>
  );
}

const vaccinationSchema = z.object({
  vaccine: z.string().trim().min(1, 'Add the vaccine name.'),
  due: z.string().min(1, 'Pick the due date.'),
  given: z.enum(['no', 'yes']),
});
type VaccinationValues = z.infer<typeof vaccinationSchema>;

export function VaccinationDialog({ animal, onClose }: DialogProps) {
  const toast = useToast();
  const add = useAddVaccination(animal);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VaccinationValues>({
    resolver: zodResolver(vaccinationSchema),
    defaultValues: { vaccine: '', due: shiftDay(indiaDay(), 15), given: 'no' },
  });

  const submit = handleSubmit(({ vaccine, due, given }) => {
    const isGiven = given === 'yes';
    add.mutate(
      { vaccine_name: vaccine, due_date: isGiven ? indiaDay() : due, given: isGiven },
      {
        onSuccess: () => {
          toast.show(`${vaccine} ${isGiven ? 'recorded as given' : 'reminder added'}`);
          onClose();
        },
      },
    );
  });

  return (
    <Modal
      title="Add a vaccination"
      subtitle={`For ${animalName(animal)} (tag ${animal.tag_number}). The farmer gets a reminder in the app.`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            Add vaccination
          </Button>
        </>
      }
    >
      <Field label="Vaccine" error={errors.vaccine?.message}>
        <input
          className={inputClass}
          type="text"
          placeholder="e.g. Theileriosis"
          aria-invalid={Boolean(errors.vaccine)}
          {...register('vaccine')}
        />
      </Field>
      <div className={styles.dialogGrid}>
        <Field label="Due date" error={errors.due?.message}>
          <input className={inputClass} type="date" {...register('due')} />
        </Field>
        <Field label="Already given?">
          <select className={inputClass} {...register('given')}>
            <option value="no">No, remind the farmer</option>
            <option value="yes">Yes, given today</option>
          </select>
        </Field>
      </div>
      {add.isError && <FormError>{errorMessage(add.error)}</FormError>}
    </Modal>
  );
}

const HEALTH_OPTIONS: readonly HealthStatus[] = ['detected', 'sick', 'condition', 'resolved'];

const eventSchema = z.object({
  title: z.string().trim().min(1, 'Say what happened.'),
  status: z.enum(['detected', 'sick', 'condition', 'resolved']),
  notes: z.string(),
});
type EventValues = z.infer<typeof eventSchema>;

export function HealthEventDialog({ animal, onClose }: DialogProps) {
  const toast = useToast();
  const add = useAddHealthEvent(animal);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: '', status: 'detected', notes: '' },
  });

  const submit = handleSubmit(({ title, status, notes }) => {
    add.mutate(
      { title, status, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.show('Health event added · the farmer sees it in the app');
          onClose();
        },
      },
    );
  });

  return (
    <Modal
      title="Add a health event"
      subtitle={`For ${animalName(animal)} (tag ${animal.tag_number}). Shows in the farmer’s health list.`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            Add event
          </Button>
        </>
      }
    >
      <Field label="What happened" error={errors.title?.message}>
        <input
          className={inputClass}
          type="text"
          placeholder="e.g. Not eating since morning"
          aria-invalid={Boolean(errors.title)}
          {...register('title')}
        />
      </Field>
      <Field label="Status">
        <select className={inputClass} {...register('status')}>
          {HEALTH_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {HEALTH_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder="What the farmer or vet said"
          {...register('notes')}
        />
      </Field>
      {add.isError && <FormError>{errorMessage(add.error)}</FormError>}
    </Modal>
  );
}
