import { formatWeekdayDate } from '../lib/format';
import { AlertsBell } from './AlertsBell';
import { GlobalSearch } from './GlobalSearch';
import styles from './TopBar.module.css';

export function TopBar({ crumb, page }: { crumb: string; page: string }) {
  return (
    <header className={styles.bar}>
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
      <div className={styles.right}>
        <GlobalSearch />
        <span className={styles.date}>
          <svg
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" />
          </svg>
          {formatWeekdayDate(Date.now())}
        </span>
        <AlertsBell />
      </div>
    </header>
  );
}
