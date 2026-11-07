import { useMemo, useState } from 'react';
import { CAN_EDIT, useHasRole } from '../../app/RoleGate';
import { AvatarName } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataTable, type Column } from '../../components/DataTable';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type { FarmDetail, MemberRole } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatCount, formatPhone } from '../../lib/format';
import { shedMixes } from './helpers';
import { MemberDialog } from './MemberDialog';
import { useFarmAnimals, useSetMemberRole, useSpecies } from './queries';
import { ShedDialog, type ShedToEdit } from './ShedDialog';
import styles from './FarmPage.module.css';

interface ShedRow {
  id: string | null;
  code: string;
  name: string;
  animals: number;
  mix: string | undefined;
}

export const ROLE_NAMES: Record<MemberRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  worker: 'Worker',
};

function RoleControl({
  farmId,
  member,
}: {
  farmId: string;
  member: FarmDetail['members'][number];
}) {
  const toast = useToast();
  const setRole = useSetMemberRole(farmId);
  const canEdit = useHasRole(CAN_EDIT);
  const name = member.profile.full_name ?? 'This member';
  if (!canEdit) return <StatusPill tone="grey">{ROLE_NAMES[member.role]}</StatusPill>;

  // Ownership only moves through Transfer ownership, so a farm can't end up with two owners.
  const options: MemberRole[] = member.role === 'owner' ? ['owner'] : ['manager', 'worker'];
  return (
    <select
      className={styles.roleSelect}
      aria-label={`Role for ${name}`}
      value={member.role}
      disabled={setRole.isPending}
      onChange={(event) => {
        const role = event.target.value as MemberRole;
        setRole.mutate(
          { userId: member.user_id, role },
          {
            onSuccess: () => toast.show(`${name} is now ${role} · saved to the activity log`),
            onError: (error) => toast.show(errorMessage(error), 'error'),
          },
        );
      }}
    >
      {options.map((role) => (
        <option key={role} value={role}>
          {ROLE_NAMES[role]}
        </option>
      ))}
    </select>
  );
}

export function ShedsMembersTab({ detail }: { detail: FarmDetail }) {
  const canEdit = useHasRole(CAN_EDIT);
  const farmId = detail.farm.id;
  const animals = useFarmAnimals(farmId);
  const species = useSpecies();
  const [shedDialog, setShedDialog] = useState<ShedToEdit | 'new' | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  const rows = useMemo<ShedRow[]>(() => {
    const mixes = animals.data ? shedMixes(animals.data, species.data ?? []) : null;
    const sheds: ShedRow[] = detail.sheds.map((shed) => ({
      id: shed.id,
      code: shed.code ?? '—',
      name: shed.name,
      animals: shed.animals,
      mix: mixes ? (mixes.get(shed.id)?.mix ?? 'No animals yet') : undefined,
    }));
    const loose = mixes?.get(null);
    if (loose) {
      sheds.push({
        id: null,
        code: '—',
        name: 'Not in a shed',
        animals: loose.count,
        mix: loose.mix,
      });
    }
    return sheds;
  }, [animals.data, species.data, detail.sheds]);

  const columns = useMemo<Column<ShedRow>[]>(() => {
    const list: Column<ShedRow>[] = [
      {
        key: 'code',
        header: 'Code',
        cell: (row) => (
          <StatusPill tone="grey" numeric>
            {row.code}
          </StatusPill>
        ),
      },
      {
        key: 'name',
        header: 'Name',
        cell: (row) => <span className={styles.shedName}>{row.name}</span>,
      },
      {
        key: 'animals',
        header: 'Animals',
        align: 'right',
        cell: (row) => <span className={styles.number}>{formatCount(row.animals)}</span>,
      },
      {
        key: 'mix',
        header: 'Who lives here',
        cell: (row) => <span className={styles.note}>{row.mix ?? <Skeleton width={80} />}</span>,
      },
    ];
    if (canEdit) {
      list.push({
        key: 'edit',
        header: 'Edit',
        hideHeader: true,
        shrink: true,
        align: 'right',
        cell: (row) =>
          row.id && (
            <Button
              size="sm"
              aria-label={`Edit ${row.name}`}
              onClick={() =>
                setShedDialog({ id: row.id as string, code: row.code, name: row.name })
              }
            >
              Edit
            </Button>
          ),
      });
    }
    return list;
  }, [canEdit]);

  return (
    <div className={styles.twoColumns}>
      <Card flush className={styles.wide}>
        <div className={`${styles.cardHead} ${styles.cardHeadPadded}`}>
          <div className={styles.countTitle}>
            <span className={styles.sectionLabel}>Sheds</span>
            <StatusPill tone="grey">{detail.sheds.length}</StatusPill>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setShedDialog('new')}>
              Add shed
            </Button>
          )}
        </div>
        <DataTable
          label="Sheds"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id ?? 'none'}
          error={animals.isError ? "Couldn't load the sheds." : undefined}
          onRetry={() => void animals.refetch()}
          emptyTitle="No sheds yet"
          emptyNote="Sheds group animals and tell the Blackbox where readings come from."
        />
      </Card>
      <Card className={styles.membersCard}>
        <div className={styles.cardHead}>
          <div className={styles.countTitle}>
            <span className={styles.sectionLabel}>Farm members</span>
            <StatusPill tone="grey">{detail.members.length}</StatusPill>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setAddingMember(true)}>
              Add member
            </Button>
          )}
        </div>
        {detail.members.map((member) => (
          <div key={member.user_id} className={styles.memberRow}>
            <AvatarName
              name={member.profile.full_name}
              note={formatPhone(member.profile.phone)}
              numericNote
            />
            <RoleControl farmId={farmId} member={member} />
          </div>
        ))}
        <p className={`${styles.note} ${styles.memberHelp}`}>
          Owners and managers can change farm records. Workers can add entries.
        </p>
      </Card>
      {shedDialog && (
        <ShedDialog
          farmId={farmId}
          shed={shedDialog === 'new' ? null : shedDialog}
          onClose={() => setShedDialog(null)}
        />
      )}
      {addingMember && <MemberDialog detail={detail} onClose={() => setAddingMember(false)} />}
    </div>
  );
}
