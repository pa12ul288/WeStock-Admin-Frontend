import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { FarmDetail } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { useCreateAnimal, useSpecies } from './queries';
import styles from './FarmPage.module.css';

const schema = z.object({
  tag: z.string().trim().min(1, 'Add a tag number.'),
  name: z.string(),
  species: z.string().min(1, 'Pick a species.'),
  breed: z.string(),
  gender: z.enum(['female', 'male']),
  shed: z.string(),
});
type Values = z.infer<typeof schema>;

export function AddAnimalDialog({ detail, onClose }: { detail: FarmDetail; onClose: () => void }) {
  const toast = useToast();
  const species = useSpecies();
  const create = useCreateAnimal();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { tag: '', name: '', species: 'cattle', breed: '', gender: 'female', shed: '' },
  });

  const submit = handleSubmit((values) => {
    const name = values.name.trim();
    create.mutate(
      {
        farm_id: detail.farm.id,
        tag_number: values.tag,
        species_id: values.species,
        name: name || undefined,
        breed: values.breed.trim() || undefined,
        gender: values.gender,
        shed_id: values.shed || null,
      },
      {
        onSuccess: () => {
          toast.show(`Tag ${values.tag}${name ? ` · ${name}` : ''} added to ${detail.farm.name}`);
          onClose();
        },
      },
    );
  });

  return (
    <Modal
      title="Add an animal"
      subtitle={`Adds it to ${detail.farm.name}. The farmer sees it in the app straight away.`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !species.data}>
            Add animal
          </Button>
        </>
      }
    >
      <div className={styles.dialogGrid}>
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
        <Field label="Shed">
          <select className={inputClass} {...register('shed')}>
            {detail.sheds.map((shed) => (
              <option key={shed.id} value={shed.id}>
                {shed.code ? `${shed.code} · ${shed.name}` : shed.name}
              </option>
            ))}
            <option value="">Not in a shed</option>
          </select>
        </Field>
      </div>
      {create.isError && <FormError>{errorMessage(create.error)}</FormError>}
    </Modal>
  );
}
