import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/Button';
import { Field, FormError, inputClass } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/errors';
import { useSaveShed } from './queries';
import styles from './FarmPage.module.css';

export interface ShedToEdit {
  id: string;
  code: string;
  name: string;
}

const schema = z.object({
  code: z.string().trim().min(1, 'Add a shed code.'),
  name: z.string().trim().min(1, 'Add a shed name.'),
});
type Values = z.infer<typeof schema>;

export function ShedDialog({
  farmId,
  shed,
  onClose,
}: {
  farmId: string;
  shed: ShedToEdit | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const save = useSaveShed(farmId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: shed?.code === '—' ? '' : (shed?.code ?? ''), name: shed?.name ?? '' },
  });

  const submit = handleSubmit((values) =>
    save.mutate(
      { id: shed?.id, ...values },
      {
        onSuccess: () => {
          toast.show(shed ? 'Shed updated' : `Shed ${values.code} added`);
          onClose();
        },
      },
    ),
  );

  return (
    <Modal
      title={shed ? 'Edit shed' : 'Add a shed'}
      subtitle="Sheds group animals and tell the Blackbox where readings come from."
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {shed ? 'Save shed' : 'Add shed'}
          </Button>
        </>
      }
    >
      <div className={styles.dialogGrid}>
        <Field label="Shed code" error={errors.code?.message}>
          <input
            className={inputClass}
            type="text"
            placeholder="e.g. S4"
            aria-invalid={Boolean(errors.code)}
            {...register('code')}
          />
        </Field>
        <Field label="Shed name" error={errors.name?.message}>
          <input
            className={inputClass}
            type="text"
            placeholder="e.g. Heifer shed"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
      </div>
      {save.isError && <FormError>{errorMessage(save.error)}</FormError>}
    </Modal>
  );
}
