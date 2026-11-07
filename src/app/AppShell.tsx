import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { takeResetNotice } from '../features/auth/queries';
import { BreadcrumbContext, useShellHandle } from './breadcrumb';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

export function AppShell() {
  const handle = useShellHandle();
  const [pageOverride, setPageOverride] = useState<string | null>(null);
  const page = pageOverride ?? handle?.page ?? '';
  const toast = useToast();

  useEffect(() => {
    document.title = page ? `${page} · WeSTOCK Admin` : 'WeSTOCK Admin';
  }, [page]);

  useEffect(() => {
    if (takeResetNotice()) toast.show('Demo data reset.');
  }, [toast]);

  return (
    <div className={styles.shell}>
      <Sidebar active={handle?.nav ?? null} />
      <div className={styles.main}>
        <TopBar crumb={handle?.crumb ?? ''} page={page} />
        <main className={styles.panel}>
          <BreadcrumbContext.Provider value={setPageOverride}>
            <Outlet />
          </BreadcrumbContext.Provider>
        </main>
      </div>
    </div>
  );
}
