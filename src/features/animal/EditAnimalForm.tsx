import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { useToast } from '../../components/Toast';
import type { AnimalGender, AnimalListRow, Shed } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { indiaDay } from '../../lib/format';
import { formatAadhaar, formatShed } from '../../lib/labels';
import { aadhaarField, serverFieldError } from '../livestock/animalForm';
import { useSpecies } from '../livestock/queries';
import { useUpdateAnimal } from './queries';
import styles from './AnimalPage.module.css';

const schema = z.object({
  tag: z.string().trim().min(1, 'Add a tag number.'),
  name: z.string(),
  species: z.string().min(1, 'Pick a species.'),
  breed: z.string(),
  gender: z.enum(['', 'female', 'male']),
  dob: z.string().refine((day) => day <= indiaDay(), "The date can't be in the future."),
  aadhaar: aadhaarField,
  shed: z.string(),
});
type Values = z.infer<typeof schema>;

const FIELD_NAMES: Record<string, keyof Values> = {
  tag_number: 'tag',
  pashu_aadhaar: 'aadhaar',
  dob: 'dob',
};

/** The fields that actually changed: the form sends nothing else. */
export function changedFields(animal: AnimalListRow, values: Values) {
  const next = {
    tag_number: values.tag,
    name: values.name.trim() || null,
    species_id: values.species,
    breed: values.breed.trim() || null,
    gender: (values.gender || null) as AnimalGender | null,
    dob: values.dob || null,
    pashu_aadhaar: values.aadhaar.replace(/\s/g, '') || null,
    shed_id: values.shed || null,
  };
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => animal[key as keyof typeof next] !== value),
  ) as Partial<typeof next>;
}

export function EditAnimalForm({
  animal,
  sheds,
  onClose,
}: {
  animal: AnimalListRow;
  sheds: readonly Shed[];
  onClose: () => void;
}) {
  const toast = useToast();
  const species = useSpecies();
  const update = useUpdateAnimal(animal.id);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      tag: animal.tag_number,
      name: animal.name ?? '',
      species: animal.species_id,
      breed: animal.breed ?? '',
      gender: animal.gender ?? '',
      dob: animal.dob ?? '',
      aadhaar: animal.pashu_aadhaar ? formatAadhaar(animal.pashu_aadhaar) : '',
      shed: animal.shed_id ?? '',
    },
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    const patch = changedFields(animal, values);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { patch },
      {
        onSuccess: () => {
          toast.show('Changes saved · logged in the activity log');
          onClose();
        },
        onError: (error) => {
          const field = serverFieldError(error);
          const name = field && FIELD_NAMES[field.field];
          if (field && name) setError(name, { message: field.message }, { shouldFocus: true });
          else setFormError(errorMessage(error));
        },
      },
    );
  });

  return (
    <form className={styles.editCard} noValidate onSubmit={(event) => void submit(event)}>
      <div className={styles.cardHead}>
        <span className={styles.label}>Edit animal</span>
        <span className={styles.note}>Every change is saved to the activity log</span>
      </div>
      <div className={styles.editGrid}>
        <Field label="Tag number" error={errors.tag?.message}>
          <input
            className={`${inputClass} ${styles.numeric}`}
            type="text"
            aria-invalid={Boolean(errors.tag)}
            {...register('tag')}
          />
        </Field>
        <Field label="Name">
          <input className={inputClass} type="text" {...register('name')} />
        </Field>
        <Field label="Species" error={errors.species?.message}>
          <select className={inputClass} {...register('species')}>
            {(species.data ?? [{ id: animal.species_id, labels: { en: animal.species_id } }]).map(
              (item) => (
                <option key={item.id} value={item.id}>
                  {item.labels.en}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label="Breed">
          <input className={inputClass} type="text" {...register('breed')} />
        </Field>
        <Field label="Gender">
          <select className={inputClass} {...register('gender')}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            {animal.gender === null && <option value="">Not set</option>}
          </select>
        </Field>
        <Field label="Date of birth" error={errors.dob?.message}>
          <input className={inputClass} type="date" max={indiaDay()} {...register('dob')} />
        </Field>
        <Field label="Pashu Aadhaar" error={errors.aadhaar?.message}>
          <input
            className={`${inputClass} ${styles.numeric}`}
            type="text"
            inputMode="numeric"
            aria-invalid={Boolean(errors.aadhaar)}
            {...register('aadhaar')}
          />
        </Field>
        <Field label="Shed">
          <select className={inputClass} {...register('shed')}>
            {sheds.map((shed) => (
              <option key={shed.id} value={shed.id}>
                {formatShed(shed)}
              </option>
            ))}
            <option value="">Not in a shed</option>
          </select>
        </Field>
      </div>
      {formError && <FormError>{formError}</FormError>}
      <div className={styles.editActions}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={update.isPending || !species.data}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
