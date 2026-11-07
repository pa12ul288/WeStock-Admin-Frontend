import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { DataError } from '../../data/errors';
import type { FeedRow, MilkRow } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatDateTime, formatKg, formatLitres } from '../../lib/format';
import { milkAnimalText, parseAmount, SESSION_LABELS } from './helpers';
import { useDeleteEntry, useFixFeed, useFixMilk } from './queries';
import styles from './MilkFeedPage.module.css';

export type EntryTarget = { kind: 'milk'; row: MilkRow } | { kind: 'feed'; row: FeedRow };

const asText = (value: number | null, decimals?: number) => {
  if (value === null) return '';
  return decimals === undefined ? String(value) : value.toFixed(decimals);
};

/** Fixing keeps the dialog open if the save says no, above all when the reason is missing. */
export function FixEntryDialog({ target, onClose }: { target: EntryTarget; onClose: () => void }) {
  const toast = useToast();
  const fixMilk = useFixMilk();
  const fixFeed = useFixFeed();
  const isMilk = target.kind === 'milk';
  const [first, setFirst] = useState(() =>
    target.kind === 'milk' ? asText(target.row.litres, 1) : asText(target.row.quantity_kg),
  );
  const [second, setSecond] = useState(() =>
    target.kind === 'milk' ? asText(target.row.price_per_litre, 2) : asText(target.row.cost),
  );
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [badField, setBadField] = useState<'first' | 'second' | 'reason' | null>(null);
  const reasonInput = useRef<HTMLInputElement>(null);
  const pending = fixMilk.isPending || fixFeed.isPending;

  const fail = (text: string, field: typeof badField) => {
    setMessage(text);
    setBadField(field);
  };

  const onError = (error: unknown) => {
    if (error instanceof DataError && error.code === 'reason_required') {
      fail(errorMessage(error), 'reason');
      reasonInput.current?.focus();
      return;
    }
    fail(errorMessage(error), null);
  };

  function submit() {
    if (pending) return;
    const amount = parseAmount(first);
    if (!amount) {
      fail(isMilk ? 'Litres must be a number.' : 'Quantity must be a number.', 'first');
      return;
    }
    const other = second.trim() === '' ? undefined : parseAmount(second);
    if (other === null) {
      fail(isMilk ? 'Price must be a number.' : 'Cost must be a number.', 'second');
      return;
    }
    setMessage(null);
    setBadField(null);
    if (target.kind === 'milk') {
      const { row } = target;
      const price = other ?? row.price_per_litre;
      if (reason.trim() && amount === row.litres && price === row.price_per_litre) {
        fail('Nothing has changed. Change a number, or press Cancel.', 'first');
        return;
      }
      fixMilk.mutate(
        {
          id: row.id,
          values: { session: row.session, litres: amount, price_per_litre: price },
          reason,
        },
        {
          onSuccess: () => {
            toast.show(
              `Milk entry fixed: ${row.litres.toFixed(1)} → ${formatLitres(amount)} · logged`,
            );
            onClose();
          },
          onError,
        },
      );
      return;
    }
    const { row } = target;
    const cost = other ?? row.cost;
    if (reason.trim() && amount === row.quantity_kg && cost === row.cost) {
      fail('Nothing has changed. Change a number, or press Cancel.', 'first');
      return;
    }
    fixFeed.mutate(
      {
        id: row.id,
        values: { feed_type: row.feed_type, quantity_kg: amount, cost },
        reason,
      },
      {
        onSuccess: () => {
          toast.show('Feed entry fixed · logged');
          onClose();
        },
        onError,
      },
    );
  }

  const entry =
    target.kind === 'milk'
      ? `${target.row.farm_name} · ${milkAnimalText(target.row)} · ${SESSION_LABELS[target.row.session]}`
      : `${target.row.farm_name} · ${target.row.feed_type}`;

  return (
    <Modal
      title={isMilk ? 'Fix a milk entry' : 'Fix a feed entry'}
      subtitle="The farmer sees the corrected number. Your fix is logged."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={pending}>
            Save fix
          </Button>
        </>
      }
    >
      <div className={styles.entryLine}>
        <span>Entry</span>
        <b>{entry}</b>
      </div>
      <div className={styles.dialogGrid}>
        <Field label={isMilk ? 'Litres' : 'Quantity (kg)'}>
          <input
            className={inputClass}
            type="text"
            inputMode="decimal"
            value={first}
            aria-invalid={badField === 'first'}
            onChange={(event) => setFirst(event.target.value)}
          />
        </Field>
        <Field label={isMilk ? 'Price per litre (₹)' : 'Cost (₹)'}>
          <input
            className={inputClass}
            type="text"
            inputMode="decimal"
            value={second}
            aria-invalid={badField === 'second'}
            onChange={(event) => setSecond(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Reason for the fix">
        <input
          ref={reasonInput}
          className={inputClass}
          type="text"
          placeholder={
            isMilk
              ? 'e.g. Farmer called, typed 21 instead of 12'
              : 'e.g. Logged in grams by mistake'
          }
          value={reason}
          aria-invalid={badField === 'reason'}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      {message && <FormError>{message}</FormError>}
    </Modal>
  );
}

export function DeleteEntryDialog({
  target,
  onClose,
}: {
  target: EntryTarget;
  onClose: () => void;
}) {
  const toast = useToast();
  const remove = useDeleteEntry();
  const when = formatDateTime(target.row.created_at);
  const summary =
    target.kind === 'milk'
      ? `Delete the ${SESSION_LABELS[target.row.session].toLowerCase()} milk entry for ${milkAnimalText(target.row)} at ${target.row.farm_name} (${formatLitres(target.row.litres)}, ${when})?`
      : `Delete the ${target.row.feed_type.toLowerCase()} entry for ${target.row.farm_name} (${formatKg(target.row.quantity_kg)}, ${when})?`;
  return (
    <ConfirmDialog
      title="Delete this entry?"
      confirmLabel="Delete entry"
      pending={remove.isPending}
      error={remove.error ? errorMessage(remove.error) : undefined}
      onClose={onClose}
      onConfirm={() =>
        remove.mutate(
          { kind: target.kind, id: target.row.id },
          {
            onSuccess: () => {
              toast.show('Entry deleted · a copy is kept in the activity log');
              onClose();
            },
          },
        )
      }
    >
      <p className={styles.deleteSummary}>{summary}</p>
      <p className={styles.note}>
        The entry is removed from the farmer’s records. A copy stays in the activity log.
      </p>
    </ConfirmDialog>
  );
}
