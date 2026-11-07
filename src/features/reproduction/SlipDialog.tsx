import { CAN_EDIT, useHasRole } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { FormError } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { CycleRow } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { useSetVerified } from './queries';
import styles from './ReproductionPage.module.css';

/** The farmer's slip beside the number in the app. Only staff who can edit get "Mark verified". */
export function SlipDialog({ cycle, onClose }: { cycle: CycleRow; onClose: () => void }) {
  const toast = useToast();
  const verify = useSetVerified();
  const canVerify = useHasRole(CAN_EDIT) && !cycle.insemination_verified;

  function markVerified() {
    verify.mutate(
      { id: cycle.id, verified: true },
      {
        onSuccess: () => {
          toast.show('Tube number verified');
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      title="Insemination slip"
      subtitle="Check the tube number on the slip matches the one in the app."
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{canVerify ? 'Cancel' : 'Close'}</Button>
          {canVerify && (
            <Button variant="primary" disabled={verify.isPending} onClick={markVerified}>
              Mark verified
            </Button>
          )}
        </>
      }
    >
      <img
        className={styles.slip}
        src={cycle.insemination_image_url ?? undefined}
        alt="Photo of the insemination slip"
      />
      <div className={styles.keyValue}>
        <span>Tube number entered in the app</span>
        <b>{cycle.tube_number ?? 'Not given'}</b>
      </div>
      {verify.isError && <FormError>{errorMessage(verify.error)}</FormError>}
    </Modal>
  );
}
