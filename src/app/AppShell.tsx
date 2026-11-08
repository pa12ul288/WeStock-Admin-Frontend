import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { takeResetNotice } from '../features/auth/queries';
import { markLoadSequence } from '../lib/motion';
import { BreadcrumbContext, useShellHandle } from './breadcrumb';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useLoadSequence, usePageTransition, useSidebarMorph } from './shellMotion';
import { useSidebarCollapsed } from './useSidebarCollapsed';
import styles from './AppShell.module.css';

export function AppShell() {
  const handle = useShellHandle();
  const [pageOverride, setPageOverride] = useState<string | null>(null);
  const page = pageOverride ?? handle?.page ?? '';
  const toast = useToast();
  const { pathname } = useLocation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const shell = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);

  // Pieces of the first page (KPI cards, charts, rows) read this to time themselves after the
  // sidebar and top bar. A one-off flag, set before the children mount.
  useState(markLoadSequence);

  useLoadSequence(shell);
  useSidebarMorph(shell, collapsed);
  usePageTransition(panel, pathname);

  useEffect(() => {
    document.title = page ? `${page} · WeSTOCK Admin` : 'WeSTOCK Admin';
  }, [page]);

  useEffect(() => {
    if (takeResetNotice()) toast.show('Demo data reset.');
  }, [toast]);

  return (
    <div ref={shell} className={styles.shell}>
      <Sidebar active={handle?.nav ?? null} collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className={styles.main}>
        <TopBar crumb={handle?.crumb ?? ''} page={page} />
        <main ref={panel} className={styles.panel}>
          <BreadcrumbContext.Provider value={setPageOverride}>
            <Outlet />
          </BreadcrumbContext.Provider>
        </main>
      </div>
    </div>
  );
}
