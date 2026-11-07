import { useMemo, useState } from 'react';
import { AvatarName } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type Column } from '../../components/DataTable';
import { Icon, ICONS } from '../../components/Icon';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type { AdminStaff, StaffRole } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatRelative } from '../../lib/format';
import { lastActiveText, STAFF_ROLE_LABELS } from './audit';
import { useUpdateStaff } from './queries';
import styles from './StaffPage.module.css';

const ROLE_ORDER: readonly StaffRole[] = ['super_admin', 'support', 'viewer'];

const ROLE_CARDS = [
  {
    name: 'Super admin',
    text: 'Everything Support can do, plus inviting or removing staff and changing their roles.',
    icon: ICONS.shield,
  },
  {
    name: 'Support',
    text: 'Sees every farm and fixes records: farms, animals, milk, feed, health, vaccines and breeding.',
    icon: ICONS.pencil,
  },
  {
    name: 'Viewer',
    text: 'Sees every farm and downloads reports. Cannot change anything.',
    icon: ICONS.eye,
  },
];

interface StaffListProps {
  staff: readonly AdminStaff[] | undefined;
  failed: boolean;
  onRetry: () => void;
  meId: string | undefined;
  /** Super admin: the role selects and the Remove and Cancel invite buttons. */
  canManage: boolean;
}

export function StaffList({ staff, failed, onRetry, meId, canManage }: StaffListProps) {
  const toast = useToast();
  const update = useUpdateStaff();
  const [removing, setRemoving] = useState<AdminStaff | null>(null);
  const [removeError, setRemoveError] = useState('');
  /** The role just picked, shown until the list comes back with it. */
  const [picked, setPicked] = useState<Record<string, StaffRole>>({});

  const rows = useMemo(() => (staff ?? []).filter((row) => row.status !== 'removed'), [staff]);

  async function changeRole(person: AdminStaff, role: StaffRole) {
    if (role === person.role) return;
    if (person.user_id === meId && role !== 'super_admin') {
      toast.show('You can’t change your own role. Ask another super admin.', 'error');
      return;
    }
    setPicked((current) => ({ ...current, [person.user_id]: role }));
    try {
      await update.mutateAsync({ userId: person.user_id, patch: { role } });
      toast.show(`${person.full_name} is now ${STAFF_ROLE_LABELS[role]} · saved to the log`);
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    } finally {
      setPicked((current) => {
        const next = { ...current };
        delete next[person.user_id];
        return next;
      });
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveError('');
    try {
      await update.mutateAsync({ userId: removing.user_id, patch: { status: 'removed' } });
      toast.show(
        removing.status === 'invited'
          ? 'Invite cancelled'
          : `${removing.full_name} removed · saved to the log`,
      );
      setRemoving(null);
    } catch (error) {
      setRemoveError(errorMessage(error));
    }
  }

  const columns: Column<AdminStaff>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <AvatarName name={row.full_name} note={row.email} />,
    },
    {
      key: 'role',
      header: 'Role',
      cell: (row) =>
        canManage ? (
          <select
            className={styles.roleSelect}
            aria-label={`Role for ${row.full_name}`}
            value={picked[row.user_id] ?? row.role}
            onChange={(event) => void changeRole(row, event.target.value as StaffRole)}
          >
            {ROLE_ORDER.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        ) : (
          <span className={styles.roleText}>{STAFF_ROLE_LABELS[row.role]}</span>
        ),
    },
    {
      key: 'last',
      header: 'Last active',
      cell: (row) => (
        <span className={styles.muted}>
          {lastActiveText(row, meId, (at) => formatRelative(at))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) =>
        row.status === 'invited' ? (
          <StatusPill tone="amber" dot>
            Invite sent
          </StatusPill>
        ) : (
          <StatusPill tone="green" dot>
            Active
          </StatusPill>
        ),
    },
  ];
  if (canManage) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      hideHeader: true,
      shrink: true,
      align: 'right',
      cell: (row) =>
        row.user_id === meId ? (
          <Button
            size="sm"
            className={styles.youButton}
            onClick={() =>
              toast.show('You can’t remove yourself. Ask another super admin.', 'error')
            }
          >
            You
          </Button>
        ) : (
          <Button
            size="sm"
            className={styles.removeButton}
            onClick={() => {
              setRemoveError('');
              setRemoving(row);
            }}
          >
            {row.status === 'invited' ? 'Cancel invite' : 'Remove'}
          </Button>
        ),
    });
  }

  return (
    <Card flush>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={styles.cardLabel}>brainwired staff</span>
          {staff && (
            <StatusPill tone="grey" numeric>
              {rows.length}
            </StatusPill>
          )}
        </div>
        <span className={styles.note}>Only a super admin can invite, remove or change roles</span>
      </div>
      <DataTable
        label="brainwired staff"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.user_id}
        loading={!staff && !failed}
        skeletonRows={5}
        error={failed ? "Couldn't load the staff list." : undefined}
        onRetry={onRetry}
        emptyTitle="No staff yet"
        emptyNote="Invite someone to give them access."
      />
      <div className={styles.roles}>
        <span className={styles.cardLabel}>What each role can do</span>
        <div className={styles.roleGrid}>
          {ROLE_CARDS.map((role) => (
            <div key={role.name} className={styles.role}>
              <span className={styles.icon}>
                <Icon d={role.icon} />
              </span>
              <span className={styles.roleBody}>
                <span className={styles.roleName}>{role.name}</span>
                <span className={styles.note}>{role.text}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {removing && (
        <ConfirmDialog
          title={removing.status === 'invited' ? 'Cancel invite?' : `Remove ${removing.full_name}?`}
          confirmLabel={removing.status === 'invited' ? 'Cancel invite' : 'Remove'}
          cancelLabel="Keep"
          pending={update.isPending}
          error={removeError}
          onConfirm={() => void confirmRemove()}
          onClose={() => setRemoving(null)}
        >
          <p className={styles.paragraph}>
            {removing.status === 'invited'
              ? `The invite link sent to ${removing.email} will stop working. You can invite them again later.`
              : `${removing.full_name} will be signed out and can no longer open this dashboard. Their past changes stay in the activity log.`}
          </p>
        </ConfirmDialog>
      )}
    </Card>
  );
}
