import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBreadcrumbPage } from '../../app/breadcrumb';
import { CAN_EDIT, RoleGate } from '../../app/RoleGate';
import { initials } from '../../components/Avatar';
import { Button, buttonClass } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon, ICONS } from '../../components/Icon';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Segmented } from '../../components/Segmented';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import type { FarmDetail } from '../../data/types';
import { formatCount, formatDate, formatLitresTotal, formatPhone } from '../../lib/format';
import { LANGUAGE_LABELS, formatPlace } from '../../lib/labels';
import { useUrlState } from '../../lib/url-state';
import { AddAnimalDialog } from '../livestock/AddAnimalDialog';
import { useSpecies } from '../livestock/queries';
import { memberNote, milkTodayNote, speciesMix } from './helpers';
import { OverviewTab } from './OverviewTab';
import { isNotFound, useFarm, useFarmRecords } from './queries';
import { SettingsTab } from './SettingsTab';
import { ShedsMembersTab } from './ShedsMembersTab';
import styles from './FarmPage.module.css';

type Tab = 'overview' | 'sheds' | 'settings';

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'sheds', label: 'Sheds & members' },
  { value: 'settings', label: 'Farm settings' },
];

function Header({
  detail,
  onEdit,
  onAddAnimal,
}: {
  detail: FarmDetail;
  onEdit: () => void;
  onAddAnimal: () => void;
}) {
  const { farm, row } = detail;
  return (
    <header className={styles.head}>
      <div className={styles.identity}>
        <span className={styles.badge} aria-hidden="true">
          {initials(farm.name)}
        </span>
        <div className={styles.names}>
          <span className={styles.eyebrow}>Farm · since {formatDate(farm.created_at)}</span>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{farm.name}</h1>
            <StatusPill tone={row.has_blackbox ? 'blue' : 'grey'}>
              {row.has_blackbox ? 'Blackbox + collars' : 'Manual entry'}
            </StatusPill>
          </div>
          <div className={styles.meta}>
            <span>
              <Icon d={ICONS.person} size={14} />
              {row.owner_name ?? '—'}{' '}
              <span className={styles.phone}>{formatPhone(row.owner_phone)}</span>
            </span>
            <span>
              <Icon d={ICONS.pin} size={14} />
              {formatPlace(farm.district, farm.state)}
            </span>
            {row.language && (
              <span>
                <Icon d={ICONS.language} size={14} />
                App in {LANGUAGE_LABELS[row.language]}
              </span>
            )}
          </div>
        </div>
      </div>
      <RoleGate allow={CAN_EDIT}>
        <div className={styles.actions}>
          <Button onClick={onEdit}>Edit farm</Button>
          <Button variant="primary" onClick={onAddAnimal}>
            <Icon d={ICONS.plus} size={14} />
            Add animal
          </Button>
        </div>
      </RoleGate>
    </header>
  );
}

function HeroCards({ detail }: { detail: FarmDetail }) {
  const species = useSpecies();
  const records = useFarmRecords(detail.farm.id);
  const { dashboard, row, members } = detail;
  const oldest = records.data?.oldestOverdueDays;
  let overdueNote = '';
  if (dashboard.vaccination.overdue === 0) overdueNote = 'None overdue';
  else if (oldest !== undefined && oldest !== null) {
    overdueNote = `Oldest is ${oldest} ${oldest === 1 ? 'day' : 'days'} late`;
  }
  return (
    <KpiGrid>
      <KpiCard
        label="Animals"
        icon={<Icon d={ICONS.tag} />}
        value={formatCount(row.animals)}
        note={
          row.animals === 0
            ? 'No animals yet'
            : speciesMix(dashboard.animals_by_species, species.data ?? [])
        }
      />
      <KpiCard
        label="Milk today"
        icon={<Icon d={ICONS.milk} />}
        value={formatLitresTotal(dashboard.milk_today.total)}
        note={milkTodayNote(dashboard.milk_today)}
      />
      <KpiCard
        label="Pregnant"
        icon={<Icon d={ICONS.heart} />}
        value={formatCount(dashboard.reproduction.pregnant)}
        note={`${dashboard.reproduction.may_deliver} may deliver in 30 days`}
      />
      <KpiCard
        label="Vaccines overdue"
        icon={<Icon d={ICONS.vaccine} />}
        value={formatCount(dashboard.vaccination.overdue)}
        note={overdueNote}
      />
      <KpiCard
        label="Members"
        icon={<Icon d={ICONS.people} />}
        value={formatCount(members.length)}
        note={memberNote(members)}
      />
    </KpiGrid>
  );
}

function FarmSkeleton() {
  return (
    <div className={styles.loading} data-testid="farm-skeleton">
      <Skeleton width="45%" height={34} />
      <Skeleton width="60%" />
      <KpiGrid>
        {Array.from({ length: 5 }, (_, index) => (
          <Card key={index}>
            <Skeleton width="60%" />
            <div className={styles.skeletonGap} />
            <Skeleton width="40%" height={28} />
          </Card>
        ))}
      </KpiGrid>
      <Card>
        <Skeleton height={220} radius={12} />
      </Card>
    </div>
  );
}

function GoneCard({ title, note }: { title: string; note: string }) {
  return (
    <Card className={styles.gone}>
      <h1 className={styles.goneTitle}>{title}</h1>
      <p className={styles.goneNote}>{note}</p>
      <Link to="/farmers?view=farms" className={buttonClass('primary', 'sm')}>
        Back to farmers &amp; farms
      </Link>
    </Card>
  );
}

export function FarmPage() {
  const { id = '' } = useParams();
  const [deleted, setDeleted] = useState(false);
  const [addingAnimal, setAddingAnimal] = useState(false);
  const [values, setValues] = useUrlState({ tab: 'overview' });
  const farm = useFarm(id, !deleted);
  useBreadcrumbPage(farm.data?.farm.name);

  if (deleted) {
    return (
      <GoneCard
        title="This farm was deleted"
        note="Its animals and records are no longer in the app. The deletion is in the activity log."
      />
    );
  }
  if (farm.isPending) return <FarmSkeleton />;
  if (farm.isError) {
    if (isNotFound(farm.error)) {
      return (
        <GoneCard
          title="This farm isn't in the app"
          note="It may have been deleted, or the link may be wrong."
        />
      );
    }
    return (
      <Card role="alert">
        <h1 className={styles.goneTitle}>Farm page</h1>
        <EmptyState
          title="Couldn't load this farm."
          actionLabel="Try again"
          onAction={() => void farm.refetch()}
        />
      </Card>
    );
  }

  const detail = farm.data;
  const tab: Tab = TABS.some((item) => item.value === values.tab)
    ? (values.tab as Tab)
    : 'overview';

  return (
    <>
      <Header
        detail={detail}
        onEdit={() => setValues({ tab: 'settings' })}
        onAddAnimal={() => setAddingAnimal(true)}
      />
      <HeroCards detail={detail} />
      <div className={styles.tabs}>
        <Segmented
          label="Farm sections"
          options={TABS}
          value={tab}
          onChange={(next) => setValues({ tab: next })}
        />
      </div>
      {tab === 'overview' && <OverviewTab detail={detail} />}
      {tab === 'sheds' && <ShedsMembersTab detail={detail} />}
      {tab === 'settings' && (
        <SettingsTab
          key={detail.farm.id}
          detail={detail}
          onDone={() => setValues({ tab: 'overview' })}
          onDeleted={() => setDeleted(true)}
        />
      )}
      {addingAnimal && (
        <AddAnimalDialog
          farm={detail.farm}
          sheds={detail.sheds}
          onClose={() => setAddingAnimal(false)}
        />
      )}
    </>
  );
}
