import { AlertsBell } from './AlertsBell';
import { DateChip } from './DateChip';
import { GlobalSearch } from './GlobalSearch';
import styles from './TopBar.module.css';

const showRibbon = import.meta.env.VITE_APP_ENV === 'demo';

export function TopBar({ crumb, page }: { crumb: string; page: string }) {
  return (
    <header className={styles.bar} data-topbar>
      <nav className={styles.nav} aria-label="Breadcrumb">
        <span className={styles.crumb}>{crumb}</span>
        <svg
          className={styles.sep}
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className={styles.page} aria-current="page">
          {page}
        </span>
      </nav>
      {showRibbon && (
        <span className={styles.ribbon} title="Made-up data. Nothing here is real.">
          Demo
        </span>
      )}
      <div className={styles.right}>
        <GlobalSearch />
        <DateChip />
        <AlertsBell />
      </div>
    </header>
  );
}
