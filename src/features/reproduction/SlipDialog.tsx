import { CAN_EDIT, useHasRole } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { FormError } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import type { CycleRow } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { useSetVerified } from './queries';
import styles from './ReproductionPage.module.css';

const SVG_PREFIX = 'data:image/svg+xml,';

/**
 * The slip photo. The demo slips are SVG drawings: inside an img they can't load the page's fonts,
 * so they are drawn inline (the markup comes from our own seed). Real photos use a plain img.
 */
function SlipPhoto({ url }: { url: string | null }) {
  if (!url)
    return <p className={styles.slipMissing}>The farmer has not added a photo of the slip.</p>;
  if (url.startsWith(SVG_PREFIX)) {
    return (
      <div
        className={styles.slip}
        role="img"
        aria-label="Photo of the insemination slip"
        dangerouslySetInnerHTML={{
          __html: decodeURIComponent(url.slice(SVG_PREFIX.length)).replace(
            '<svg ',
            '<svg aria-hidden="true" ',
          ),
        }}
      />
    );
  }
  return <img className={styles.slip} src={url} alt="Photo of the insemination slip" />;
}

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
      <SlipPhoto url={cycle.insemination_image_url} />
      <div className={styles.keyValue}>
        <span>Tube number entered in the app</span>
        <b>{cycle.tube_number ?? 'Not given'}</b>
      </div>
      {verify.isError && <FormError>{errorMessage(verify.error)}</FormError>}
    </Modal>
  );
}
