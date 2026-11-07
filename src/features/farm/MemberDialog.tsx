import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { FarmDetail, Profile } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatPhone } from '../../lib/format';
import { nationalDigits } from './helpers';
import { profileQuery, useAddMember, useProfileByPhone } from './queries';
import styles from './FarmPage.module.css';

const NOT_FOUND =
  'No one has signed up with this number. Ask them to sign up in the WeSTOCK app first.';
const ALREADY_MEMBER = 'This person is already a member of this farm.';

const schema = z.object({
  phone: z.string().refine((value) => nationalDigits(value) !== null, 'Enter 10 digits after +91.'),
  role: z.enum(['worker', 'manager']),
});
type Values = z.infer<typeof schema>;

export function MemberDialog({ detail, onClose }: { detail: FarmDetail; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const addMember = useAddMember(detail.farm.id);
  const [submitError, setSubmitError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', role: 'worker' },
  });

  const digits = nationalDigits(watch('phone'));
  const lookup = useProfileByPhone(digits);
  const isMember = (profile: Profile) =>
    detail.members.some((member) => member.user_id === profile.id);

  let lookupMessage: string | null = null;
  if (digits && lookup.data === null) lookupMessage = NOT_FOUND;
  else if (digits && lookup.data && isMember(lookup.data)) lookupMessage = ALREADY_MEMBER;

  const submit = handleSubmit(async (values) => {
    setSubmitError('');
    try {
      const profile = await queryClient.fetchQuery(
        profileQuery(nationalDigits(values.phone) as string),
      );
      // The messages for these two already show under the phone number.
      if (!profile || isMember(profile)) return;
      await addMember.mutateAsync({ userId: profile.id, role: values.role });
      toast.show(`${profile.full_name ?? 'Member'} added as ${values.role}`);
      onClose();
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  return (
    <Modal
      title="Add a farm member"
      subtitle="Members can see this farm in the app. Workers can add entries; managers can also change records."
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            Add member
          </Button>
        </>
      }
    >
      <div className={styles.dialogGrid}>
        <Field label="Phone number" error={errors.phone?.message}>
          <input
            className={inputClass}
            type="tel"
            placeholder="+91 98xxx xxxxx"
            aria-invalid={Boolean(errors.phone)}
            {...register('phone')}
          />
        </Field>
        <Field label="Role">
          <select className={inputClass} {...register('role')}>
            <option value="worker">Worker</option>
            <option value="manager">Manager</option>
          </select>
        </Field>
      </div>
      {lookup.data && !isMember(lookup.data) && (
        <p className={styles.found}>
          <b>{lookup.data.full_name ?? 'No name set'}</b> {formatPhone(lookup.data.phone)}
        </p>
      )}
      {lookupMessage && <FormError>{lookupMessage}</FormError>}
      {submitError && <FormError>{submitError}</FormError>}
      <p className={styles.note}>They sign in to the WeSTOCK app with this phone number.</p>
    </Modal>
  );
}
