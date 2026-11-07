import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field, FormError, inputClass } from '../../components/Field';
import { useToast } from '../../components/Toast';
import type { UUID } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { indiaDay, shiftDay } from '../../lib/format';
import { useAllFarms } from '../farmers/queries';
import { animalText, matchAnimal } from '../milk-feed/helpers';
import { useFarmAnimals } from '../reproduction/queries';
import { reminderWord, scheduleToast } from './helpers';
import { useScheduleVaccination } from './queries';
import styles from './HealthPage.module.css';

const DEFAULT_VACCINE = 'FMD (foot-and-mouth)';
const DEFAULT_NOTE = 'Ask your vet or the local veterinary dispensary for the booster dose.';
const DEFAULT_DUE_IN_DAYS = 15;

const schema = z
  .object({
    vaccine: z.string().trim().min(1, 'Add the vaccine name first'),
    who: z.enum(['cattle', 'buffalo', 'one']),
    farm: z.string().min(1, 'Pick a farm.'),
    animal: z.string(),
    due: z
      .string()
      .min(1, 'Pick the due date.')
      .refine((day) => day >= indiaDay(), "The due date can't be in the past."),
    note: z.string(),
  })
  .superRefine((values, context) => {
    if (values.who === 'one' && !values.animal.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['animal'],
        message: 'Add the animal’s tag and name.',
      });
    }
  });
type Values = z.infer<typeof schema>;

const HERD_WORDS = { cattle: 'cattle', buffalo: 'buffalo' };

export function SchedulePanel({
  defaultFarmId,
  onCreated,
  onClose,
}: {
  defaultFarmId?: UUID;
  onCreated: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const farms = useAllFarms();
  const schedule = useScheduleVaccination();
  const [formError, setFormError] = useState<string | null>(null);
  const [openedOn] = useState(() => indiaDay());
  const farmRows = useMemo(
    () => [...(farms.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [farms.data],
  );
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // The farms can arrive after the panel opens; keepDirtyValues holds on to what was typed.
    values: {
      vaccine: DEFAULT_VACCINE,
      who: 'cattle',
      farm: defaultFarmId ?? farmRows[0]?.id ?? '',
      animal: '',
      due: shiftDay(openedOn, DEFAULT_DUE_IN_DAYS),
      note: DEFAULT_NOTE,
    },
    resetOptions: { keepDirtyValues: true },
  });
  const who = watch('who');
  const farmId = watch('farm');
  const animals = useFarmAnimals(farmId);

  // The live count: every active animal of that species on the farm, as the schedule will write.
  const count =
    who === 'one' ? 1 : animals.data?.filter((animal) => animal.species_id === who).length;
  const noHerd = who !== 'one' && count === 0;

  const submit = handleSubmit((values) => {
    setFormError(null);
    const animal = values.who === 'one' ? matchAnimal(values.animal, animals.data ?? []) : null;
    if (values.who === 'one' && !animal) {
      setError(
        'animal',
        { message: 'No animal like that on this farm. Try its tag and name.' },
        { shouldFocus: true },
      );
      return;
    }
    schedule.mutate(
      {
        farm_id: values.farm,
        species_id: values.who === 'one' ? null : values.who,
        animal_id: animal?.id ?? null,
        vaccine_name: values.vaccine,
        due_date: values.due,
        description: values.note.trim() || undefined,
      },
      {
        onSuccess: ({ created }) => {
          const farmName = farmRows.find((farm) => farm.id === values.farm)?.name ?? 'this farm';
          toast.show(scheduleToast(created, values.vaccine, farmName, values.due));
          onCreated();
        },
        onError: (error) => setFormError(errorMessage(error)),
      },
    );
  });

  return (
    <Card flush className={styles.panel}>
      <form className={styles.panelForm} noValidate onSubmit={(event) => void submit(event)}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>Add a vaccine schedule</h2>
          <span className={styles.note}>
            Creates a reminder for each animal. The farmer sees it in the app.
          </span>
        </div>
        <div className={styles.panelGrid}>
          <Field label="Vaccine" error={errors.vaccine?.message}>
            <input
              className={inputClass}
              type="text"
              aria-invalid={Boolean(errors.vaccine)}
              {...register('vaccine')}
            />
          </Field>
          <Field label="Give to">
            <select className={inputClass} {...register('who')}>
              <option value="cattle">All cattle on a farm</option>
              <option value="buffalo">All buffalo on a farm</option>
              <option value="one">One animal</option>
            </select>
          </Field>
          <Field label="Farm" error={errors.farm?.message}>
            {/* Held to the form's value: the options can arrive after it, and would otherwise show the first. */}
            <select className={inputClass} {...register('farm')} value={farmId}>
              {farmRows.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" error={errors.due?.message}>
            <input
              className={`${inputClass} ${styles.dateInput}`}
              type="date"
              min={openedOn}
              aria-invalid={Boolean(errors.due)}
              {...register('due')}
            />
          </Field>
        </div>
        {who === 'one' && (
          <Field label="Animal" error={errors.animal?.message}>
            <input
              className={inputClass}
              type="text"
              list="schedule-animals"
              autoComplete="off"
              placeholder="Tag and name, e.g. 01 · Gauri"
              aria-invalid={Boolean(errors.animal)}
              {...register('animal')}
            />
            <datalist id="schedule-animals">
              {(animals.data ?? []).map((animal) => (
                <option key={animal.id} value={animalText(animal)} />
              ))}
            </datalist>
          </Field>
        )}
        <Field label="Note for the farmer">
          <input className={inputClass} type="text" {...register('note')} />
        </Field>
        {formError && <FormError>{formError}</FormError>}
        {animals.isError && <FormError>Couldn’t load this farm’s animals.</FormError>}
        <div className={styles.panelFoot}>
          {noHerd && (
            <span className={styles.panelNote}>
              No {HERD_WORDS[who as keyof typeof HERD_WORDS]} on this farm.
            </span>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={schedule.isPending || !animals.data || noHerd}
          >
            {count === undefined ? 'Create reminders' : `Create ${count} ${reminderWord(count)}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}
