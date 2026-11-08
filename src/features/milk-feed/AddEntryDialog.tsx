import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { Segmented } from '../../components/Segmented';
import { useToast } from '../../components/Toast';
import type { MilkSession, UUID } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatKg, formatLitres, indiaDay } from '../../lib/format';
import { useFarm } from '../farm/queries';
import { useAllFarms } from '../farmers/queries';
import { useFarmAnimals } from '../reproduction/queries';
import {
  animalText,
  FEED_TYPES,
  isWholeHerd,
  matchAnimal,
  matchFedTo,
  parseAmount,
  SESSION_LABELS,
  SESSIONS,
  shedText,
  WHOLE_FARM,
  WHOLE_HERD,
} from './helpers';
import { useCreateFeed, useCreateMilk, type EntryKind } from './queries';
import styles from './MilkFeedPage.module.css';

const blank = (text: string) => text.trim() === '';

const schema = z
  .object({
    kind: z.enum(['milk', 'feed']),
    farm: z.string().min(1, 'Pick a farm.'),
    animal: z.string(),
    session: z.enum(['morning', 'afternoon', 'evening']),
    litres: z.string(),
    price: z.string(),
    to: z.string(),
    type: z.string(),
    kg: z.string(),
    cost: z.string(),
  })
  .superRefine((values, context) => {
    const problem = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (values.kind === 'milk') {
      if (blank(values.animal)) problem('animal', 'Add the animal and the litres.');
      else if (blank(values.litres)) problem('litres', 'Add the animal and the litres.');
      else if (!parseAmount(values.litres)) problem('litres', 'Litres must be a number.');
      else if (!blank(values.price) && parseAmount(values.price) === null) {
        problem('price', 'Price must be a number.');
      }
    } else {
      if (blank(values.to)) problem('to', 'Add what it was fed to and the quantity.');
      else if (blank(values.kg)) problem('kg', 'Add what it was fed to and the quantity.');
      else if (!parseAmount(values.kg)) problem('kg', 'Quantity must be a number.');
      else if (!blank(values.cost) && parseAmount(values.cost) === null) {
        problem('cost', 'Cost must be a number.');
      }
    }
  });
type Values = z.infer<typeof schema>;

interface AddEntryDialogProps {
  defaultFarmId?: UUID;
  onAdded: (kind: EntryKind, farmId: UUID) => void;
  onClose: () => void;
}

const FEED_NAMES = FEED_TYPES.map((type) => type.name);

export function AddEntryDialog({ defaultFarmId, onAdded, onClose }: AddEntryDialogProps) {
  const toast = useToast();
  const farms = useAllFarms();
  const createMilk = useCreateMilk();
  const createFeed = useCreateFeed();
  const [formError, setFormError] = useState<string | null>(null);
  const farmRows = useMemo(
    () => [...(farms.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [farms.data],
  );
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // The farms can arrive after the dialog opens; keepDirtyValues holds on to what was typed.
    values: {
      kind: 'milk',
      farm: defaultFarmId ?? farmRows[0]?.id ?? '',
      animal: '',
      session: 'morning',
      litres: '',
      price: '40',
      to: '',
      type: 'Green fodder',
      kg: '',
      cost: '',
    },
    resetOptions: { keepDirtyValues: true },
  });
  const kind = watch('kind');
  const farmId = watch('farm');
  const animals = useFarmAnimals(farmId);
  const farm = useFarm(farmId, farmId !== '');
  const sheds = farm.data?.sheds ?? [];
  const milkers = (animals.data ?? []).filter((animal) => animal.gender !== 'male');
  const pending = createMilk.isPending || createFeed.isPending;
  const ready = Boolean(farms.data && animals.data && farm.data);

  const shownError = Object.values(errors).find((error) => error?.message)?.message ?? formError;

  const onError = (error: unknown) => setFormError(errorMessage(error));

  const submit = handleSubmit((values) => {
    setFormError(null);
    const entry_date = indiaDay();
    if (values.kind === 'milk') {
      const wholeHerd = isWholeHerd(values.animal);
      const animal = wholeHerd ? null : matchAnimal(values.animal, milkers);
      if (!wholeHerd && !animal) {
        setError(
          'animal',
          { message: 'No animal like that on this farm. Try its tag and name, or Whole herd.' },
          { shouldFocus: true },
        );
        return;
      }
      const litres = parseAmount(values.litres) as number;
      createMilk.mutate(
        {
          farm_id: values.farm,
          animal_id: animal?.id ?? null,
          entry_date,
          session: values.session as MilkSession,
          litres,
          price_per_litre: parseAmount(values.price),
        },
        {
          onSuccess: () => {
            toast.show(
              `${formatLitres(litres)} added for ${animal ? animalText(animal) : WHOLE_HERD}`,
            );
            onAdded('milk', values.farm);
            onClose();
          },
          onError,
        },
      );
      return;
    }
    const fedTo = matchFedTo(values.to, sheds, animals.data ?? []);
    if (!fedTo) {
      setError(
        'to',
        { message: 'No shed or animal like that on this farm. Try S1, or Whole farm.' },
        { shouldFocus: true },
      );
      return;
    }
    const quantity = parseAmount(values.kg) as number;
    createFeed.mutate(
      {
        farm_id: values.farm,
        ...fedTo,
        entry_date,
        feed_type: values.type,
        quantity_kg: quantity,
        cost: parseAmount(values.cost),
      },
      {
        onSuccess: () => {
          toast.show(`${formatKg(quantity)} of ${values.type.toLowerCase()} added`);
          onAdded('feed', values.farm);
          onClose();
        },
        onError,
      },
    );
  });

  return (
    <Modal
      title="Add an entry"
      subtitle="For when a farmer phones in a reading they could not log."
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending || !ready}>
            Add entry
          </Button>
        </>
      }
    >
      <div className={styles.kindSwitch}>
        <Segmented
          label="Entry type"
          value={kind}
          onChange={(next) => {
            setValue('kind', next, { shouldDirty: true });
            clearErrors();
            setFormError(null);
          }}
          options={[
            { value: 'milk', label: 'Milk' },
            { value: 'feed', label: 'Feed' },
          ]}
        />
      </div>
      <Field label="Farm">
        <select className={inputClass} {...register('farm')} value={farmId}>
          {farmRows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </Field>
      {kind === 'milk' ? (
        <div className={styles.dialogGrid}>
          <Field label="Animal">
            <input
              className={inputClass}
              type="text"
              list="milk-animals"
              autoComplete="off"
              placeholder="e.g. 02 · Lakshmi, or Whole herd"
              aria-invalid={Boolean(errors.animal)}
              {...register('animal')}
            />
            <datalist id="milk-animals">
              <option value={WHOLE_HERD} />
              {milkers.map((animal) => (
                <option key={animal.id} value={animalText(animal)} />
              ))}
            </datalist>
          </Field>
          <Field label="Session">
            <select className={inputClass} {...register('session')}>
              {SESSIONS.map((session) => (
                <option key={session} value={session}>
                  {SESSION_LABELS[session]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Litres">
            <input
              className={inputClass}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 12.5"
              aria-invalid={Boolean(errors.litres)}
              {...register('litres')}
            />
          </Field>
          <Field label="Price per litre (₹)">
            <input
              className={inputClass}
              type="text"
              inputMode="decimal"
              aria-invalid={Boolean(errors.price)}
              {...register('price')}
            />
          </Field>
        </div>
      ) : (
        <div className={styles.dialogGrid}>
          <Field label="Fed to">
            <input
              className={inputClass}
              type="text"
              list="feed-targets"
              autoComplete="off"
              placeholder="e.g. S1 · Main shed"
              aria-invalid={Boolean(errors.to)}
              {...register('to')}
            />
            <datalist id="feed-targets">
              <option value={WHOLE_FARM} />
              {sheds.map((shed) => (
                <option key={shed.id} value={shedText(shed)} />
              ))}
              {(animals.data ?? []).map((animal) => (
                <option key={animal.id} value={animalText(animal)} />
              ))}
            </datalist>
          </Field>
          <Field label="Feed type">
            <select className={inputClass} {...register('type')}>
              {FEED_NAMES.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Quantity (kg)">
            <input
              className={inputClass}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 120"
              aria-invalid={Boolean(errors.kg)}
              {...register('kg')}
            />
          </Field>
          <Field label="Cost (₹)">
            <input
              className={inputClass}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 360"
              aria-invalid={Boolean(errors.cost)}
              {...register('cost')}
            />
          </Field>
        </div>
      )}
      <p className={styles.note}>Entries added here are marked “Added by staff” and logged.</p>
      {shownError && <FormError>{shownError}</FormError>}
    </Modal>
  );
}
