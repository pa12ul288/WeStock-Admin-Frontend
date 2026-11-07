import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CAN_ADMINISTER, CAN_EDIT, useHasRole } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, FormError, inputClass } from '../../components/Field';
import { useToast } from '../../components/Toast';
import type { FarmDetail } from '../../data/types';
import type { DataSource } from '../../data/source';
import { errorMessage } from '../../lib/errors';
import { formatCount } from '../../lib/format';
import { STATES } from '../../lib/labels';
import { formatMapPin, parseMapPin } from './helpers';
import { useDeleteFarm, useTransferFarm, useUpdateFarm } from './queries';
import styles from './FarmPage.module.css';

const positive = (message: string) =>
  z.string().refine((value) => Number(value) > 0 && value.trim() !== '', message);

const schema = z.object({
  name: z.string().trim().min(1, 'Add a farm name.'),
  district: z.string(),
  state: z.string(),
  pin: z
    .string()
    .refine(
      (value) => parseMapPin(value) !== undefined,
      'Enter latitude and longitude, like 16.7050, 74.2433.',
    ),
  description: z.string(),
  highTemp: positive('Enter a temperature above 0.'),
  offlineMin: positive('Enter a number of minutes above 0.'),
});
type Values = z.infer<typeof schema>;

const orNull = (text: string) => text.trim() || null;

function TransferDialog({ detail, onClose }: { detail: FarmDetail; onClose: () => void }) {
  const toast = useToast();
  const transfer = useTransferFarm(detail.farm.id);
  const candidates = detail.members.filter((member) => member.user_id !== detail.farm.owner_id);
  const [userId, setUserId] = useState(candidates[0]?.user_id ?? '');
  const [note, setNote] = useState('');

  function confirm() {
    if (!userId) {
      onClose();
      return;
    }
    const name = candidates.find((member) => member.user_id === userId)?.profile.full_name;
    transfer.mutate(
      { userId, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.show(`${name ?? 'The new owner'} now owns ${detail.farm.name}`);
          onClose();
        },
      },
    );
  }

  return (
    <ConfirmDialog
      title="Transfer ownership"
      subtitle={`Choose who owns ${detail.farm.name} from now on.`}
      confirmLabel="Transfer"
      destructive={false}
      pending={transfer.isPending}
      error={transfer.isError ? errorMessage(transfer.error) : undefined}
      onConfirm={confirm}
      onClose={onClose}
    >
      <Field label="New owner">
        <select
          className={inputClass}
          value={userId}
          disabled={candidates.length === 0}
          onChange={(event) => setUserId(event.target.value)}
        >
          {candidates.length === 0 && <option value="">No other members yet</option>}
          {candidates.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.profile.full_name ?? member.profile.phone}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note">
        <input
          className={inputClass}
          type="text"
          placeholder="Optional"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <p className={styles.note}>
        The current owner becomes a manager. The change is saved to the activity log.
      </p>
    </ConfirmDialog>
  );
}

function DeleteDialog({
  detail,
  onClose,
  onDeleted,
}: {
  detail: FarmDetail;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteFarm(detail.farm.id);
  const name = detail.farm.name;
  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      subtitle="Only do this if the farmer asked for it."
      warning={`This removes the farm, its ${formatCount(detail.row.animals)} animals and all their milk, feed, health and breeding records from the app.`}
      confirmLabel="Delete farm"
      confirmText={name}
      confirmTextLabel="Type the farm name to confirm"
      pending={remove.isPending}
      error={remove.isError ? errorMessage(remove.error) : undefined}
      onConfirm={() =>
        remove.mutate(undefined, {
          onSuccess: () => {
            toast.show(`${name} deleted · saved to the activity log`);
            onDeleted();
          },
        })
      }
      onClose={onClose}
    />
  );
}

export function SettingsTab({
  detail,
  onDone,
  onDeleted,
}: {
  detail: FarmDetail;
  /** Back to the overview, after a save or Cancel. */
  onDone: () => void;
  onDeleted: () => void;
}) {
  const { farm, row } = detail;
  const toast = useToast();
  const canEdit = useHasRole(CAN_EDIT);
  const canDelete = useHasRole(CAN_ADMINISTER);
  const update = useUpdateFarm(farm.id);
  const [dialog, setDialog] = useState<'transfer' | 'delete' | null>(null);
  const initialPin = formatMapPin(farm.lat, farm.lng);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: farm.name,
      district: farm.district ?? '',
      state: farm.state ?? '',
      pin: initialPin,
      description: farm.description ?? '',
      highTemp: String(farm.settings.high_temp_c),
      offlineMin: String(farm.settings.offline_after_min),
    },
  });

  const states = farm.state && !STATES.includes(farm.state) ? [...STATES, farm.state] : [...STATES];

  const submit = handleSubmit((values) => {
    const patch: Parameters<DataSource['updateFarm']>[1] = {
      name: values.name,
      district: orNull(values.district),
      state: orNull(values.state),
      description: orNull(values.description),
    };
    // The box rounds to 4 decimals: only a real edit may change the stored pin.
    if (values.pin.trim() !== initialPin) {
      const pin = parseMapPin(values.pin);
      patch.lat = pin?.lat ?? null;
      patch.lng = pin?.lng ?? null;
    }
    const highTemp = Number(values.highTemp);
    const offlineMin = Number(values.offlineMin);
    if (highTemp !== farm.settings.high_temp_c || offlineMin !== farm.settings.offline_after_min) {
      patch.settings = { high_temp_c: highTemp, offline_after_min: offlineMin };
    }
    update.mutate(patch, {
      onSuccess: () => {
        toast.show('Farm details saved · logged in the activity log');
        onDone();
      },
    });
  });

  return (
    <div className={styles.twoColumns}>
      <Card className={styles.wide}>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <fieldset className={styles.settingsForm} disabled={!canEdit}>
            <legend className={styles.sectionLabel}>Farm details</legend>
            <div className={styles.formGrid}>
              <Field label="Farm name" error={errors.name?.message}>
                <input
                  className={inputClass}
                  type="text"
                  aria-invalid={Boolean(errors.name)}
                  {...register('name')}
                />
              </Field>
              {/* Ownership changes through Transfer ownership, so this only shows who it is. */}
              <Field label="Owner">
                <select className={inputClass} disabled value="owner" onChange={() => undefined}>
                  <option value="owner">{row.owner_name ?? '—'}</option>
                </select>
              </Field>
              <Field label="District">
                <input className={inputClass} type="text" {...register('district')} />
              </Field>
              <Field label="State">
                <select className={inputClass} {...register('state')}>
                  {!farm.state && <option value="">Not set</option>}
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Map location" error={errors.pin?.message}>
                <input
                  className={`${inputClass} ${styles.numberInput}`}
                  type="text"
                  aria-invalid={Boolean(errors.pin)}
                  {...register('pin')}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea className={styles.textarea} rows={3} {...register('description')} />
            </Field>
            <span className={`${styles.sectionLabel} ${styles.alertsLabel}`}>Alerts</span>
            <div className={styles.formGrid}>
              <Field label="Fever alert at" error={errors.highTemp?.message}>
                <span className={styles.unitInput}>
                  <input
                    className={`${inputClass} ${styles.numberInput}`}
                    type="text"
                    inputMode="decimal"
                    aria-invalid={Boolean(errors.highTemp)}
                    {...register('highTemp')}
                  />
                  <span aria-hidden="true">°C</span>
                </span>
              </Field>
              <Field label="Collar offline after" error={errors.offlineMin?.message}>
                <span className={styles.unitInput}>
                  <input
                    className={`${inputClass} ${styles.numberInput}`}
                    type="text"
                    inputMode="numeric"
                    aria-invalid={Boolean(errors.offlineMin)}
                    {...register('offlineMin')}
                  />
                  <span aria-hidden="true">min</span>
                </span>
              </Field>
            </div>
            {update.isError && <FormError>{errorMessage(update.error)}</FormError>}
            {canEdit && (
              <div className={styles.formActions}>
                <Button onClick={onDone}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={update.isPending}>
                  Save changes
                </Button>
              </div>
            )}
          </fieldset>
        </form>
      </Card>
      {canEdit && (
        <Card className={styles.dangerCard}>
          <span className={styles.dangerLabel}>Danger zone</span>
          <p className={styles.dangerNote}>
            {canDelete
              ? 'These change who controls the farm or remove its data. Both are recorded in the activity log.'
              : 'This changes who controls the farm. It is recorded in the activity log.'}
          </p>
          <Button className={styles.dangerButton} onClick={() => setDialog('transfer')}>
            Transfer ownership
          </Button>
          {canDelete && (
            <Button
              className={`${styles.dangerButton} ${styles.deleteButton}`}
              onClick={() => setDialog('delete')}
            >
              Delete farm and its records
            </Button>
          )}
        </Card>
      )}
      {dialog === 'transfer' && <TransferDialog detail={detail} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <DeleteDialog detail={detail} onClose={() => setDialog(null)} onDeleted={onDeleted} />
      )}
    </div>
  );
}
