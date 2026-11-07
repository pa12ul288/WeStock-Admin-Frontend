import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Field, inputClass } from './Field';
import { Modal } from './Modal';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  subtitle?: string;
  /** The consequence, in a red box. */
  warning?: ReactNode;
  /** Anything else the dialog needs, such as a reason field. */
  children?: ReactNode;
  confirmLabel: string;
  /** Red action by default; `false` for a green one. */
  destructive?: boolean;
  /** Asks the user to type this word or name before the action runs. */
  confirmText?: string;
  /** The label over the typing box. */
  confirmTextLabel?: string;
  pending?: boolean;
  /** A failure from the save, shown above the buttons. */
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}

const matches = (typed: string, wanted: string) =>
  typed.trim().toLowerCase() === wanted.trim().toLowerCase();

export function ConfirmDialog({
  title,
  subtitle,
  warning,
  children,
  confirmLabel,
  destructive = true,
  confirmText,
  confirmTextLabel = 'Type to confirm',
  pending = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [mismatch, setMismatch] = useState(false);

  function submit() {
    if (pending) return;
    if (confirmText !== undefined && !matches(typed, confirmText)) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    onConfirm();
  }

  const message = mismatch ? `Type “${confirmText}” exactly to confirm.` : error;

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose} data-autofocus={destructive && !confirmText ? true : undefined}>
            Cancel
          </Button>
          <Button type="submit" variant={destructive ? 'danger' : 'primary'} disabled={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {warning && <div className={styles.warning}>{warning}</div>}
      {children}
      {confirmText !== undefined && (
        <Field label={confirmTextLabel}>
          <input
            className={inputClass}
            type="text"
            autoComplete="off"
            placeholder={confirmText}
            value={typed}
            aria-invalid={mismatch}
            onChange={(event) => {
              setTyped(event.target.value);
              setMismatch(false);
            }}
          />
        </Field>
      )}
      {message && (
        <div className={styles.warning} role="alert">
          {message}
        </div>
      )}
    </Modal>
  );
}
