import { useRef } from 'react';
import { useToast } from '../components/Toast';
import type { StaffRole } from '../data/types';
import { isDemoAuth, useResetDemoData, useSetDemoRole, useStaff } from '../features/auth/queries';
import { errorMessage } from '../lib/errors';
import { ROLE_LABELS } from './RoleGate';
import { useDismiss } from './useDismiss';
import styles from './UserMenu.module.css';

export const USER_MENU_TRIGGER = 'user-menu';
const ROLES: StaffRole[] = ['super_admin', 'support', 'viewer'];

export function UserMenu({
  onClose,
  onSignOut,
}: {
  onClose: (viaEscape: boolean) => void;
  onSignOut: () => void;
}) {
  const staff = useStaff();
  const setRole = useSetDemoRole();
  const reset = useResetDemoData();
  const toast = useToast();
  const box = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, box, `[data-user-menu-trigger="${USER_MENU_TRIGGER}"]`);

  if (!staff) return null;

  function chooseRole(role: StaffRole) {
    if (role === staff?.role) return;
    setRole.mutate(role, {
      onSuccess: () => toast.show(`You are now using the ${ROLE_LABELS[role]} role.`),
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  }

  return (
    <div ref={box} className={styles.menu} role="dialog" aria-label="Account menu">
      <div className={styles.who}>
        <div className={styles.whoText}>
          <span className={styles.name}>{staff.full_name}</span>
          <span className={styles.role}>{ROLE_LABELS[staff.role]}</span>
        </div>
        {isDemoAuth && <span className={styles.badge}>Demo</span>}
      </div>

      {isDemoAuth && (
        <>
          <div className={styles.section}>
            <span id="demo-role-label" className={styles.label}>
              Try another role
            </span>
            <div className={styles.segmented} role="group" aria-labelledby="demo-role-label">
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={staff.role === role}
                  onClick={() => chooseRole(role)}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.action}
            disabled={reset.isPending}
            onClick={() =>
              reset.mutate(undefined, {
                onError: (error) => toast.show(errorMessage(error), 'error'),
              })
            }
          >
            Reset demo data
          </button>
        </>
      )}

      <button type="button" className={styles.action} onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
