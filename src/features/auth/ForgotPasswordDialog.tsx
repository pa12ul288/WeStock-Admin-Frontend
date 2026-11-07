import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { errorMessage } from '../../lib/errors';
import { useRequestPasswordReset } from './queries';
import styles from './LoginPage.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordDialog({
  initialEmail,
  onClose,
}: {
  initialEmail: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const request = useRequestPasswordReset();

  if (sentTo !== null) {
    return (
      <Modal
        title="Check your email"
        onClose={onClose}
        onSubmit={onClose}
        footer={
          <button type="submit" className={styles.dialogPrimary}>
            Done
          </button>
        }
      >
        <p className={styles.sentText}>
          If <b>{sentTo}</b> belongs to a staff account, a reset link is on its way. It works for 30
          minutes.
        </p>
      </Modal>
    );
  }

  function send(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter the work email you sign in with.');
      return;
    }
    setError('');
    request.mutate(address, {
      onSuccess: () => setSentTo(address),
      onError: (requestError) => setError(errorMessage(requestError)),
    });
  }

  return (
    <Modal
      title="Reset your password"
      subtitle="We’ll email you a link to set a new one."
      onClose={onClose}
      onSubmit={send}
      footer={
        <>
          <button type="button" className={styles.dialogSecondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.dialogPrimary} disabled={request.isPending}>
            Send reset link
          </button>
        </>
      }
    >
      <label className={styles.label}>
        Work email
        <input
          className={styles.input}
          type="email"
          autoComplete="email"
          placeholder="name@[brainwired domain]"
          aria-invalid={error !== ''}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }}
        />
      </label>
      {error && (
        <div className={styles.warn} role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}
