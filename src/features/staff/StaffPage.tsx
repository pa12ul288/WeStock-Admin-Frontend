import { useMemo, useState } from 'react';
import { CAN_ADMINISTER, RoleGate, useHasRole } from '../../app/RoleGate';
import { Button } from '../../components/Button';
import { Icon, ICONS } from '../../components/Icon';
import { Skeleton } from '../../components/Skeleton';
import { formatCount } from '../../lib/format';
import { useClearUrlParams, useUrlState } from '../../lib/url-state';
import { useStaff } from '../auth/queries';
import { ActivityLog } from './ActivityLog';
import { isLogKind, periodSince, type Period } from './audit';
import { InviteStaffDialog } from './InviteStaffDialog';
import { useStaffList, useWeekLog, type LogFilters } from './queries';
import { StaffList } from './StaffList';
import styles from './StaffPage.module.css';

const FILTER_KEYS = ['who', 'action', 'period'] as const;

function Total({
  icon,
  label,
  value,
  note,
}: {
  icon: string;
  label: string;
  value: number | undefined;
  note: string | undefined;
}) {
  return (
    <div className={styles.total}>
      <div className={styles.totalHead}>
        <span className={styles.icon}>
          <Icon d={icon} />
        </span>
        <span className={styles.label}>{label}</span>
      </div>
      {value === undefined ? (
        <Skeleton width={60} height={30} />
      ) : (
        <span className={styles.big}>{formatCount(value)}</span>
      )}
      {note === undefined ? (
        <Skeleton width="70%" height={13} />
      ) : (
        <span className={styles.note}>{note}</span>
      )}
    </div>
  );
}

export function StaffPage() {
  const [values, setValues] = useUrlState({ who: '', action: '', period: '' });
  const clearFilters = useClearUrlParams(FILTER_KEYS);
  const [inviting, setInviting] = useState(false);
  const me = useStaff();
  const canManage = useHasRole(CAN_ADMINISTER);

  const staff = useStaffList();
  const period: Period = values.period === '30' || values.period === 'all' ? values.period : '';
  const since = useMemo(() => periodSince(period), [period]);
  const weekSince = useMemo(() => periodSince(''), []);
  const week = useWeekLog(weekSince);

  const filters: LogFilters = useMemo(
    () => ({
      staffId: values.who || undefined,
      kind: isLogKind(values.action) ? values.action : undefined,
      since,
    }),
    [values.who, values.action, since],
  );

  const people = staff.data?.filter((row) => row.status !== 'removed');
  const active = people?.filter((row) => row.status === 'active').length ?? 0;
  const invited = people?.filter((row) => row.status === 'invited').length ?? 0;
  const deleted = week.data?.filter((entry) => entry.action === 'delete').length;

  return (
    <>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>Admin</span>
          <h1 className={styles.title}>Staff &amp; activity log</h1>
          <p className={styles.sub}>
            Who can sign in to this dashboard, and a permanent record of every change staff make to
            farmer data.
          </p>
        </div>
        <RoleGate allow={CAN_ADMINISTER}>
          <Button variant="primary" onClick={() => setInviting(true)}>
            <Icon d={ICONS.plus} size={14} />
            Invite staff
          </Button>
        </RoleGate>
      </header>

      <div className={styles.totals}>
        <Total
          icon={ICONS.people}
          label="Staff"
          value={people?.length}
          note={
            people
              ? `${active} active · ${invited} ${invited === 1 ? 'invite' : 'invites'} waiting`
              : undefined
          }
        />
        <Total
          icon={ICONS.pencil}
          label="Changes this week"
          value={week.data?.length}
          note="Edits, deletions and role changes"
        />
        <Total
          icon={ICONS.trash}
          label="Deleted this week"
          value={deleted}
          note="Duplicate entries · originals kept"
        />
      </div>

      <StaffList
        staff={staff.data}
        failed={staff.isError}
        onRetry={() => void staff.refetch()}
        meId={me?.user_id}
        canManage={canManage}
      />

      <ActivityLog
        filters={filters}
        values={{ who: values.who, action: values.action, period }}
        onChange={setValues}
        onClear={clearFilters}
        staff={staff.data}
        weekCount={week.data?.length}
      />

      {inviting && canManage && <InviteStaffDialog onClose={() => setInviting(false)} />}
    </>
  );
}
