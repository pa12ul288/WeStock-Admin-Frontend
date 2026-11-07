import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { UUID } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { useAllFarms } from '../farmers/queries';
import { animalOption, findAnimal, whenNow, whenToIso, type Stage } from './helpers';
import { useCreateCycle, useFarmAnimals } from './queries';
import styles from './ReproductionPage.module.css';

const schema = z.object({
  farm: z.string().min(1, 'Pick a farm.'),
  animal: z.string().trim().min(1, 'Add the animal’s tag and name.'),
  stage: z.enum(['heat', 'inseminated']),
  when: z
    .string()
    .min(1, 'Pick the date and time.')
    .refine(
      (value) => Date.parse(`${value}:00+05:30`) <= Date.now(),
      'This can’t be in the future.',
    ),
  tube: z.string(),
});
type Values = z.infer<typeof schema>;

interface AddCycleDialogProps {
  defaultFarmId?: UUID;
  onAdded: (stage: Stage, farmId: UUID) => void;
  onClose: () => void;
}

export function AddCycleDialog({ defaultFarmId, onAdded, onClose }: AddCycleDialogProps) {
  const toast = useToast();
  const farms = useAllFarms();
  const create = useCreateCycle();
  const [formError, setFormError] = useState<string | null>(null);
  const [openedAt] = useState(() => whenNow());
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
    // The farms can arrive after the dialog opens; keepDirtyValues holds on to what was typed.
    values: {
      farm: defaultFarmId ?? farmRows[0]?.id ?? '',
      animal: '',
      stage: 'heat',
      when: openedAt,
      tube: '',
    },
    resetOptions: { keepDirtyValues: true },
  });
  const farmId = watch('farm');
  const stage = watch('stage');
  const animals = useFarmAnimals(farmId);
  const options = (animals.data ?? []).filter((animal) => animal.gender !== 'male');

  const submit = handleSubmit((values) => {
    setFormError(null);
    const animal = findAnimal(values.animal, animals.data ?? []);
    if (!animal) {
      setError(
        'animal',
        { message: 'No animal like that on this farm. Try its tag and name, e.g. 11 Shanti.' },
        { shouldFocus: true },
      );
      return;
    }
    const inseminated = values.stage === 'inseminated';
    create.mutate(
      {
        farm_id: values.farm,
        animal_id: animal.id,
        status: values.stage,
        at: whenToIso(values.when),
        tube_number: inseminated ? values.tube.trim() || undefined : undefined,
      },
      {
        onSuccess: () => {
          const name = animal.name ?? `Tag ${animal.tag_number}`;
          toast.show(
            inseminated
              ? `Insemination added for ${name} · waiting to be verified`
              : `Heat added for ${name} · the golden period reminder is on`,
          );
          onAdded(values.stage, values.farm);
          onClose();
        },
        onError: (error) => setFormError(errorMessage(error)),
      },
    );
  });

  return (
    <Modal
      title="Add a breeding record"
      subtitle="For when the farmer phones in a heat or an insemination."
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={create.isPending || !farms.data || !animals.data}
          >
            Add record
          </Button>
        </>
      }
    >
      <div className={styles.dialogGrid}>
        <Field label="Farm" error={errors.farm?.message}>
          <select className={inputClass} {...register('farm')}>
            {farmRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Animal" error={errors.animal?.message}>
          <input
            className={inputClass}
            type="text"
            list="cycle-animals"
            autoComplete="off"
            placeholder="Tag and name, e.g. 11 Shanti"
            aria-invalid={Boolean(errors.animal)}
            {...register('animal')}
          />
          <datalist id="cycle-animals">
            {options.map((animal) => (
              <option key={animal.id} value={animalOption(animal)} />
            ))}
          </datalist>
        </Field>
        <Field label="Stage">
          <select className={inputClass} {...register('stage')}>
            <option value="heat">Heat seen</option>
            <option value="inseminated">Inseminated</option>
          </select>
        </Field>
        <Field label="When" error={errors.when?.message}>
          <input
            className={inputClass}
            type="datetime-local"
            max={openedAt}
            aria-invalid={Boolean(errors.when)}
            {...register('when')}
          />
        </Field>
      </div>
      <Field
        label={
          <span>
            Tube number <span className={styles.fieldNote}>only if inseminated</span>
          </span>
        }
      >
        <input
          className={inputClass}
          type="text"
          placeholder="e.g. GIR-22-0611"
          disabled={stage !== 'inseminated'}
          {...register('tube')}
        />
      </Field>
      <p className={styles.note}>
        For heat, the golden period is worked out as 2 to 12 hours after it started.
      </p>
      {formError && <FormError>{formError}</FormError>}
    </Modal>
  );
}
