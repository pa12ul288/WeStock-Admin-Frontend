import { NavLink, Outlet } from 'react-router-dom';
import styles from './AppShell.module.css';

/** Placeholder shell for M0: plain links so navigation works. The real Sidebar and TopBar come in M2. */
const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/farmers', label: 'Farmers & farms' },
  { to: '/livestock', label: 'Livestock' },
  { to: '/reproduction', label: 'Reproduction' },
  { to: '/milk-feed', label: 'Milk & feed' },
  { to: '/health', label: 'Health & vaccines' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/staff', label: 'Staff & activity log' },
];

export function AppShell() {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Admin navigation">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'} className={styles.link}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
