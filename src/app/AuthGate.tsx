import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStaffQuery } from '../features/auth/queries';
import styles from './AuthGate.module.css';

/**
 * Keeps signed-out visitors on /login, and sends them back where they were going afterwards.
 * Signing out also lands here, but then the next person starts at the dashboard.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: staff, isPending } = useStaffQuery();
  const [wasSignedIn, setWasSignedIn] = useState(false);
  if (staff && !wasSignedIn) setWasSignedIn(true);

  if (isPending) {
    return (
      <div className={styles.loading} role="status" aria-label="Loading">
        <div className={styles.side} />
      </div>
    );
  }
  if (!staff) {
    return <Navigate to="/login" replace state={wasSignedIn ? null : { from: location }} />;
  }
  return children;
}
