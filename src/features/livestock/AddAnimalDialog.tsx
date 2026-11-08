import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { Shed, UUID } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatShed } from '../../lib/labels';
import { useAllFarms } from '../farmers/queries';
import { aadhaarField, serverFieldError } from './animalForm';
import { useCreateAnimal, useSpecies } from './queries';
import styles from './AddAnimalDialog.module.css';

const schema = z.object({
  farm: z.string().min(1, 'Pick a farm.'),
  tag: z.string().trim().min(1, 'Add a tag number.'),
  name: z.string(),
  species: z.string().min(1, 'Pick a species.'),
  breed: z.string(),
  gender: z.enum(['female', 'male']),
  shed: z.string(),
  aadhaar: aadhaarField,
});
type Values = z.infer<typeof schema>;

interface AddAnimalDialogProps {
  /** The farm page's own farm. Leave out to ask which farm, as on Livestock. */
  farm?: { id: UUID; name: string };
  /** With `farm`: the sheds it can go in. */
  sheds?: readonly Shed[];
  /** The farm picked first when asking. */
  defaultFarmId?: UUID;
  onAdded?: () => void;
  onClose: () => void;
}

/** Adding an animal, from Livestock (any farm) or a farm page (that farm, and which shed). */
export function AddAnimalDialog({
  farm,
  sheds,
  defaultFarmId,
  onAdded,
  onClose,
}: AddAnimalDialogProps) {
  const toast = useToast();
  const species = useSpecies();
  const farms = useAllFarms();
  const create = useCreateAnimal();
  const [formError, setFormError] = useState<string | null>(null);
  const farmRows = farms.data ?? [];
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
      farm: farm?.id ?? defaultFarmId ?? farmRows[0]?.id ?? '',
      tag: '',
      name: '',
      species: 'cattle',
      breed: '',
      gender: 'female',
      shed: sheds?.[0]?.id ?? '',
      aadhaar: '',
    },
    resetOptions: { keepDirtyValues: true },
  });

  const farmId = watch('farm');

  const submit = handleSubmit((values) => {
    setFormError(null);
    const name = values.name.trim();
    const farmName = farm?.name ?? farmRows.find((row) => row.id === values.farm)?.name ?? '';
    create.mutate(
      {
        farm_id: values.farm,
        tag_number: values.tag,
        species_id: values.species,
        name: name || undefined,
        breed: values.breed.trim() || undefined,
        gender: values.gender,
        shed_id: values.shed || null,
        pashu_aadhaar: values.aadhaar.trim() || null,
      },
      {
        onSuccess: () => {
          toast.show(`Tag ${values.tag}${name ? ` · ${name}` : ''} added to ${farmName}`);
          onAdded?.();
          onClose();
        },
        onError: (error) => {
          const field = serverFieldError(error);
          if (field?.field === 'tag_number') {
            setError('tag', { message: field.message }, { shouldFocus: true });
          } else if (field?.field === 'pashu_aadhaar') {
            setError('aadhaar', { message: field.message }, { shouldFocus: true });
          } else setFormError(errorMessage(error));
        },
      },
    );
  });

  return (
    <Modal
      title="Add an animal"
      subtitle={
        farm
          ? `Adds it to ${farm.name}. The farmer sees it in the app straight away.`
          : 'Adds it to the farm you pick. The farmer sees it in the app straight away.'
      }
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={create.isPending || !species.data || (!farm && !farms.data)}
          >
            Add animal
          </Button>
        </>
      }
    >
      {!farm && (
        <Field label="Farm" error={errors.farm?.message}>
          <select className={inputClass} {...register('farm')} value={farmId}>
            {farmRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className={styles.grid}>
        <Field label="Tag number" error={errors.tag?.message}>
          <input
            className={inputClass}
            type="text"
            placeholder="e.g. 65"
            aria-invalid={Boolean(errors.tag)}
            {...register('tag')}
          />
        </Field>
        <Field label="Name">
          <input className={inputClass} type="text" placeholder="Optional" {...register('name')} />
        </Field>
        <Field label="Species" error={errors.species?.message}>
          <select className={inputClass} {...register('species')}>
            {(species.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.labels.en}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Breed">
          <input className={inputClass} type="text" placeholder="e.g. Gir" {...register('breed')} />
        </Field>
        <Field label="Gender">
          <select className={inputClass} {...register('gender')}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </Field>
        {farm && (
          <Field label="Shed">
            <select className={inputClass} {...register('shed')}>
              {sheds?.map((shed) => (
                <option key={shed.id} value={shed.id}>
                  {formatShed(shed)}
                </option>
              ))}
              <option value="">Not in a shed</option>
            </select>
          </Field>
        )}
        <div className={farm ? styles.wide : undefined}>
          <Field label="Pashu Aadhaar" error={errors.aadhaar?.message}>
            <input
              className={inputClass}
              type="text"
              inputMode="numeric"
              placeholder="12 digits, optional"
              aria-invalid={Boolean(errors.aadhaar)}
              {...register('aadhaar')}
            />
          </Field>
        </div>
      </div>
      {formError && <FormError>{formError}</FormError>}
    </Modal>
  );
}
