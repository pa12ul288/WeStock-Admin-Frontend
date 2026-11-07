import type { ReactNode } from 'react';
import type { StaffRole } from '../data/types';
import { useStaff } from '../features/auth/queries';

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super admin',
  support: 'Support',
  viewer: 'Viewer',
};

/** Who may do what, from the roles table in CLAUDE.md. */
export const CAN_EDIT: readonly StaffRole[] = ['super_admin', 'support'];
export const CAN_ADMINISTER: readonly StaffRole[] = ['super_admin'];

export function useHasRole(allow: readonly StaffRole[]): boolean {
  const staff = useStaff();
  return staff !== null && allow.includes(staff.role);
}

/** Shows its children only to the listed roles: controls a role can't use are hidden, not disabled. */
export function RoleGate({
  allow,
  children,
  fallback = null,
}: {
  allow: readonly StaffRole[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useHasRole(allow) ? children : fallback;
}
