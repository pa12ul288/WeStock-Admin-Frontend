import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '../../data';
import type { AdminStaff, StaffRole } from '../../data/types';
import { browserSessionEnded, forgetSignIn, rememberSignIn } from './keepSignedIn';

const STAFF_KEY = ['staff', 'current'] as const;
const RESET_NOTICE_KEY = 'westock-admin-reset-notice';

async function fetchCurrentStaff(): Promise<AdminStaff | null> {
  if (browserSessionEnded()) {
    await dataSource.auth.signOut();
    forgetSignIn();
    return null;
  }
  return dataSource.auth.currentStaff();
}

/** The full query, for screens that must wait for the answer (AuthGate). */
export function useStaffQuery() {
  return useQuery({
    queryKey: STAFF_KEY,
    queryFn: fetchCurrentStaff,
    staleTime: Infinity,
    retry: false,
  });
}

/** The signed-in staff member, with the role currently in force. Null until it is known. */
export function useStaff(): AdminStaff | null {
  return useStaffQuery().data ?? null;
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string; keep: boolean }) =>
      dataSource.auth.signIn(v.email, v.password),
    onSuccess: (staff, v) => {
      rememberSignIn(v.keep);
      queryClient.setQueryData(STAFF_KEY, staff);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataSource.auth.signOut(),
    onSuccess: () => {
      forgetSignIn();
      queryClient.setQueryData(STAFF_KEY, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== STAFF_KEY[0] });
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => dataSource.auth.requestPasswordReset(email),
  });
}

/** True on the demo adapter, which offers the Demo badge, role switcher and reset. */
export const isDemoAuth = Boolean(dataSource.auth.setDemoRole);

/** Changes the role straight away; goes back if the adapter refuses. */
export function useSetDemoRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (role: StaffRole) => {
      if (!dataSource.auth.setDemoRole) throw new Error('Role switching is demo only');
      return dataSource.auth.setDemoRole(role);
    },
    onMutate: async (role) => {
      await queryClient.cancelQueries({ queryKey: STAFF_KEY });
      const previous = queryClient.getQueryData<AdminStaff | null>(STAFF_KEY);
      if (previous) queryClient.setQueryData(STAFF_KEY, { ...previous, role });
      return { previous };
    },
    // If they signed out while this was on its way, they stay signed out.
    onError: (_error, _role, context) => {
      queryClient.setQueryData<AdminStaff | null>(STAFF_KEY, (current) =>
        current ? (context?.previous ?? current) : current,
      );
    },
    onSuccess: (staff) => {
      queryClient.setQueryData<AdminStaff | null>(STAFF_KEY, (current) =>
        current ? staff : current,
      );
    },
  });
}

export function useResetDemoData() {
  return useMutation({
    mutationFn: async () => {
      await dataSource.auth.resetDemoData?.();
    },
    onSuccess: () => {
      try {
        sessionStorage.setItem(RESET_NOTICE_KEY, '1');
      } catch {
        // The notice is optional.
      }
      window.location.reload();
    },
  });
}

/** True once, on the first load after "Reset demo data". */
export function takeResetNotice(): boolean {
  try {
    const shown = sessionStorage.getItem(RESET_NOTICE_KEY) !== null;
    sessionStorage.removeItem(RESET_NOTICE_KEY);
    return shown;
  } catch {
    return false;
  }
}
