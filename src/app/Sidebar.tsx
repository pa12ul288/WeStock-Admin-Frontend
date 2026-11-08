import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useSignOut, useStaff } from '../features/auth/queries';
import { useOverview } from '../features/dashboard/queries';
import { errorMessage } from '../lib/errors';
import { formatCount } from '../lib/format';
import type { NavKey } from './breadcrumb';
import { ROLE_LABELS } from './RoleGate';
import { USER_MENU_TRIGGER, UserMenu } from './UserMenu';
import styles from './Sidebar.module.css';

const ICONS: Record<NavKey, string> = {
  overview: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  farmers:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  livestock: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
  reproduction: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z',
  milk: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  analytics: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  staff: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
};

interface NavItem {
  key: NavKey;
  label: string;
  to: string;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'Overview', items: [{ key: 'overview', label: 'Dashboard', to: '/' }] },
  {
    label: 'Farms',
    items: [
      { key: 'farmers', label: 'Farmers & farms', to: '/farmers' },
      { key: 'livestock', label: 'Livestock', to: '/livestock' },
    ],
  },
  {
    label: 'Records',
    items: [
      { key: 'reproduction', label: 'Reproduction', to: '/reproduction' },
      { key: 'milk', label: 'Milk & feed', to: '/milk-feed' },
      { key: 'health', label: 'Health & vaccines', to: '/health' },
    ],
  },
  { label: 'Insights', items: [{ key: 'analytics', label: 'Analytics', to: '/analytics' }] },
  { label: 'Admin', items: [{ key: 'staff', label: 'Staff & activity log', to: '/staff' }] },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function Sidebar({ active }: { active: NavKey | null }) {
  const staff = useStaff();
  const overview = useOverview().data;
  const counts: Partial<Record<NavKey, number>> = {
    farmers: overview?.farms,
    livestock: overview?.active_animals,
  };

  const toast = useToast();
  const signOut = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const footTrigger = useRef<HTMLButtonElement>(null);
  const phoneTrigger = useRef<HTMLButtonElement>(null);

  function doSignOut() {
    // AuthGate takes it from here once the staff member is gone.
    signOut.mutate(undefined, {
      onError: (error) => toast.show(errorMessage(error), 'error'),
    });
  }

  // On phones, keep the current screen in view within the strip.
  const strip = useRef<HTMLDivElement>(null);
  const activeLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const box = strip.current;
    const link = activeLink.current;
    if (!box || !link || box.scrollWidth <= box.clientWidth) return;
    const left = link.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + link.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollLeft = left - 16;
    }
  }, [active]);

  const name = staff?.full_name ?? '';
  const role = staff ? ROLE_LABELS[staff.role] : '';

  return (
    <aside className={styles.side}>
      <nav className={styles.inner} aria-label="Admin navigation">
        <div className={styles.top}>
          <Link
            to="/"
            className={styles.brand}
            aria-label="WeSTOCK Admin · brainwired, go to the dashboard"
          >
            <span className={styles.logo} aria-hidden="true">
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7l4 11 5-9 5 9 4-11" />
              </svg>
            </span>
            <span className={styles.brandText}>
              <span className={styles.wordmark}>WeSTOCK</span>{' '}
              <span className={styles.brandSub}>Admin · brainwired</span>
            </span>
          </Link>
          <button
            ref={phoneTrigger}
            type="button"
            className={styles.phoneUser}
            aria-label={`${name}, ${role}. Account menu`}
            aria-expanded={menuOpen}
            data-user-menu-trigger={USER_MENU_TRIGGER}
            onClick={() => setMenuOpen((open) => !open)}
            data-initials={initials(name)}
          />
        </div>

        <div ref={strip} className={styles.groups}>
          {GROUPS.map((group) => (
            <div key={group.label} className={styles.group}>
              <span className={styles.groupLabel}>{group.label}</span>
              {group.items.map((item) => {
                const count = counts[item.key];
                const current = item.key === active;
                return (
                  <Link
                    key={item.key}
                    ref={current ? activeLink : undefined}
                    to={item.to}
                    className={styles.item}
                    aria-current={current ? 'page' : undefined}
                  >
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={ICONS[item.key]} />
                    </svg>
                    <span className={styles.itemLabel}>{item.label}</span>
                    {count !== undefined && (
                      <span className={styles.count}>{formatCount(count)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className={styles.user}>
          <button
            ref={footTrigger}
            type="button"
            className={styles.userButton}
            aria-label={`${name}, ${role}. Account menu`}
            aria-expanded={menuOpen}
            data-user-menu-trigger={USER_MENU_TRIGGER}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={styles.avatar} aria-hidden="true" data-initials={initials(name)} />
            <span className={styles.userText}>
              <span className={styles.userName}>{name}</span>{' '}
              <span className={styles.userRole}>{role}</span>
            </span>
          </button>
          <button
            type="button"
            className={styles.signOut}
            aria-label="Sign out"
            title="Sign out"
            disabled={signOut.isPending}
            onClick={doSignOut}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <UserMenu
            onClose={(viaEscape) => {
              setMenuOpen(false);
              if (viaEscape) {
                footTrigger.current?.focus();
                phoneTrigger.current?.focus();
              }
            }}
            onSignOut={doSignOut}
          />
        )}
      </nav>
    </aside>
  );
}
