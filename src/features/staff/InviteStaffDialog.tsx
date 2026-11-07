import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/errors';
import { STAFF_ROLE_LABELS, STAFF_ROLES } from './audit';
import { useInviteStaff } from './queries';
import styles from './StaffPage.module.css';

const FORM_ERROR = 'Add a name and a valid work email.';

const schema = z.object({
  full_name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(['super_admin', 'support', 'viewer']),
});
type Values = z.infer<typeof schema>;

/** The invite form, here and on the Dashboard. Super admins only: the caller gates it. */
export function InviteStaffDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const invite = useInviteStaff();
  const [submitError, setSubmitError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', role: 'support' },
  });

  const submit = handleSubmit(
    async (values) => {
      setSubmitError('');
      try {
        const saved = await invite.mutateAsync(values);
        toast.show(`Invite sent to ${saved.email}`);
        onClose();
      } catch (error) {
        setSubmitError(errorMessage(error));
      }
    },
    () => setSubmitError(''),
  );

  const invalid = Boolean(errors.full_name || errors.email);
  const message = invalid ? FORM_ERROR : submitError;

  return (
    <Modal
      title="Invite staff"
      subtitle="They get an email to set a password. Only brainwired emails can be invited."
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            Send invite
          </Button>
        </>
      }
    >
      <div className={styles.dialogFields}>
        <Field label="Full name">
          <input
            className={inputClass}
            type="text"
            placeholder="e.g. Meera Iyer"
            autoComplete="off"
            aria-invalid={Boolean(errors.full_name)}
            {...register('full_name')}
          />
        </Field>
        <Field label="Work email">
          <input
            className={inputClass}
            type="email"
            placeholder="name@brainwired.demo"
            autoComplete="off"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
        <Field label="Role">
          <select className={inputClass} {...register('role')}>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
        {message && <FormError>{message}</FormError>}
      </div>
    </Modal>
  );
}
