import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useBreadcrumbPage } from '../../app/breadcrumb';
import { CAN_EDIT, RoleGate } from '../../app/RoleGate';
import { Button, buttonClass } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Icon, ICONS } from '../../components/Icon';
import { KpiCard, KpiGrid } from '../../components/KpiCard';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import type { AnimalDetail, AnimalListRow } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { formatAge, formatCount, formatDate, formatLitres, formatRelative } from '../../lib/format';
import { formatAadhaar, formatShed, GENDER_LABELS } from '../../lib/labels';
import { useFarm, isNotFound } from '../farm/queries';
import { BREEDING_LABELS, breedingStage, STATUS_LABELS } from '../livestock/helpers';
import { useSpecies } from '../livestock/queries';
import {
  ActivityCard,
  BodyTemperatureCard,
  CollarCard,
  MilkCard,
  PregnancyCard,
} from './AnimalCards';
import { animalName, StatusDialog } from './AnimalDialogs';
import {
  HealthCard,
  healthNote,
  PhotosCard,
  ReproductionCard,
  VaccinationsCard,
} from './AnimalRecords';
import { EditAnimalForm } from './EditAnimalForm';
import {
  addedBy,
  isOpenCycle,
  lastUpdate,
  milkToday,
  pregnancyTotals,
  statusChangeNote,
} from './helpers';
import { useFarmMilkToday, useAnimal, useTableLog, useUpdateAnimal } from './queries';
import styles from './AnimalPage.module.css';

function HistoryNote({ animal }: { animal: AnimalListRow }) {
  const log = useTableLog('animals');
  const by = addedBy(log.data, animal.id);
  const update = lastUpdate(log.data, animal.id);
  const added = `Added ${formatDate(animal.created_at)}${by ? ` by ${by}` : ''}`;
  const changed =
    animal.updated_at !== animal.created_at
      ? `last changed ${formatRelative(animal.updated_at).toLowerCase()}${update?.staff_name ? ` by ${update.staff_name}` : ''}`
      : null;
  const statusNote = animal.status === 'active' ? null : statusChangeNote(log.data, animal.id);
  return (
    <>
      <span className={styles.history}>{[added, changed].filter(Boolean).join(' · ')}</span>
      {statusNote && <span className={styles.history}>{statusNote}</span>}
    </>
  );
}

function Header({
  detail,
  onEdit,
  onMarkStatus,
}: {
  detail: AnimalDetail;
  onEdit: () => void;
  onMarkStatus: () => void;
}) {
  const { animal, cycles } = detail;
  const toast = useToast();
  const species = useSpecies();
  const update = useUpdateAnimal(animal.id);
  const name = animalName(animal);
  const speciesLabel =
    species.data?.find((item) => item.id === animal.species_id)?.labels.en ?? animal.species_id;
  const eyebrow = [
    speciesLabel,
    animal.breed,
    animal.gender && GENDER_LABELS[animal.gender],
    animal.dob && formatAge(animal.dob),
  ]
    .filter(Boolean)
    .join(' · ');
  const isActive = animal.status === 'active';
  const pregnancyDue = cycles.find((cycle) => cycle.status === 'pregnant')?.expected_delivery;
  const stage = breedingStage(animal.breeding_status, pregnancyDue);
  const shed = formatShed({ code: animal.shed_code, name: animal.shed_name ?? '' });

  function markActive() {
    update.mutate(
      { patch: { status: 'active' } },
      {
        onSuccess: () => toast.show(`${name} is active again`),
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  }

  return (
    <header className={styles.head}>
      <div className={styles.identity}>
        <span className={styles.tagBadge} aria-hidden="true">
          <small>TAG</small>
          <b>{animal.tag_number}</b>
        </span>
        <div className={styles.names}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{name}</h1>
            <StatusPill tone={isActive ? 'green' : 'grey'} dot>
              {STATUS_LABELS[animal.status]}
            </StatusPill>
            {isActive && stage && <StatusPill tone="pink">{BREEDING_LABELS[stage]}</StatusPill>}
          </div>
          <div className={styles.meta}>
            <span>
              Pashu Aadhaar{' '}
              <b className={styles.mono}>
                {animal.pashu_aadhaar ? formatAadhaar(animal.pashu_aadhaar) : 'Not added'}
              </b>
            </span>
            <span>
              Born <b>{animal.dob ? formatDate(animal.dob) : 'Not set'}</b>
            </span>
            <span>
              Shed <b>{shed || 'Not in a shed'}</b>
            </span>
            <span>
              Farm{' '}
              <Link to={`/farms/${animal.farm_id}`} className={styles.farmLink}>
                {animal.farm_name}
              </Link>
            </span>
          </div>
          <HistoryNote animal={animal} />
        </div>
      </div>
      <RoleGate allow={CAN_EDIT}>
        <div className={styles.actions}>
          {isActive ? (
            <Button onClick={onMarkStatus}>Mark sold or deceased</Button>
          ) : (
            <Button onClick={markActive} disabled={update.isPending}>
              Mark active again
            </Button>
          )}
          <Button variant="primary" onClick={onEdit}>
            <Icon d={ICONS.pencil} size={14} />
            Edit animal
          </Button>
        </div>
      </RoleGate>
    </header>
  );
}

function HeroCards({ detail }: { detail: AnimalDetail }) {
  const { animal, cycles, health } = detail;
  const totals = pregnancyTotals(cycles);
  const entries = useFarmMilkToday(animal.farm_id);
  const today = entries.data ? milkToday(entries.data, animal.id) : null;
  const sessions = today
    ? (
        [
          ['Morning', today.morning],
          ['afternoon', today.afternoon],
          ['evening', today.evening],
        ] as const
      )
        .filter(([, litres]) => litres > 0)
        .map(([word, litres], index) => {
          const label = index === 0 ? word[0]?.toUpperCase() + word.slice(1) : word.toLowerCase();
          return `${label} ${formatLitres(litres)}`;
        })
        .join(' · ')
    : '';
  const open = health.filter((event) => event.status !== 'resolved').length;
  let calves = 'No calves delivered yet';
  if (totals.delivered > 0) {
    calves = `${totals.delivered} ${totals.delivered === 1 ? 'calf' : 'calves'} delivered so far`;
  }
  return (
    <KpiGrid>
      <KpiCard
        label="Total pregnancies"
        icon={<Icon d={ICONS.heart} />}
        value={formatCount(totals.pregnancies)}
        note={calves}
      />
      <KpiCard
        label="Days in milk"
        icon={<Icon d={ICONS.calendar} />}
        value={totals.daysInMilk === null ? '—' : formatCount(totals.daysInMilk)}
        note={
          totals.lastCalved ? `Calved ${formatDate(totals.lastCalved)}` : 'No calving on record'
        }
      />
      <KpiCard
        label="Milk today"
        icon={<Icon d={ICONS.milk} />}
        value={today ? formatLitres(today.total) : <Skeleton width={70} height={28} />}
        note={today ? sessions || 'No milk logged yet today' : undefined}
      />
      <KpiCard
        label="Open health issues"
        icon={<Icon d={ICONS.health} />}
        value={formatCount(open)}
        note={healthNote(health)}
      />
    </KpiGrid>
  );
}

function AnimalSkeleton() {
  return (
    <div className={styles.loading} data-testid="animal-skeleton">
      <Skeleton width="45%" height={34} />
      <Skeleton width="60%" />
      <KpiGrid>
        {Array.from({ length: 4 }, (_, index) => (
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

export function AnimalPage() {
  const { id = '' } = useParams();
  const animal = useAnimal(id);
  const farm = useFarm(animal.data?.animal.farm_id ?? '', Boolean(animal.data));
  const [editing, setEditing] = useState(false);
  const [markingStatus, setMarkingStatus] = useState(false);
  const row = animal.data?.animal;
  useBreadcrumbPage(row ? `${row.name ? `${row.name} · ` : ''}tag ${row.tag_number}` : undefined);

  if (animal.isPending) return <AnimalSkeleton />;
  if (animal.isError) {
    if (isNotFound(animal.error)) {
      return (
        <Card className={styles.gone}>
          <h1 className={styles.goneTitle}>This animal isn&apos;t in the app</h1>
          <p className={styles.goneNote}>It may have been deleted, or the link may be wrong.</p>
          <Link to="/livestock" className={buttonClass('primary', 'sm')}>
            Back to livestock
          </Link>
        </Card>
      );
    }
    return (
      <Card role="alert">
        <h1 className={styles.goneTitle}>Animal page</h1>
        <EmptyState
          title="Couldn't load this animal."
          actionLabel="Try again"
          onAction={() => void animal.refetch()}
        />
      </Card>
    );
  }

  const detail = animal.data;
  const current = detail.animal;
  const hasCollar = current.hardware_tag_id !== null;
  const openCycle = detail.cycles.find(isOpenCycle);
  const showPregnancy = current.gender !== 'male' || openCycle !== undefined;
  const feverAt = farm.data?.farm.settings.high_temp_c;

  return (
    <>
      <Header
        detail={detail}
        onEdit={() => setEditing((now) => !now)}
        onMarkStatus={() => setMarkingStatus(true)}
      />
      {/* The shed select needs the farm's sheds, or saving would quietly clear the animal's shed. */}
      {editing && farm.data && (
        <EditAnimalForm
          animal={current}
          sheds={farm.data.sheds}
          onClose={() => setEditing(false)}
        />
      )}
      {editing && farm.isError && (
        <Card role="alert">
          <EmptyState
            title="Couldn't load this animal's farm."
            actionLabel="Try again"
            onAction={() => void farm.refetch()}
          />
        </Card>
      )}
      <HeroCards detail={detail} />
      {(showPregnancy || hasCollar) && (
        <div className={styles.cards}>
          {showPregnancy && <PregnancyCard cycle={openCycle} farmId={current.farm_id} />}
          {hasCollar && <CollarCard detail={detail} feverAt={feverAt} />}
        </div>
      )}
      {hasCollar && (
        <div className={styles.cards}>
          <BodyTemperatureCard detail={detail} feverAt={feverAt} />
          <ActivityCard detail={detail} />
        </div>
      )}
      <div className={styles.cards}>
        <MilkCard detail={detail} />
        <VaccinationsCard animal={current} vaccinations={detail.vaccinations} />
      </div>
      <div className={styles.cards}>
        <ReproductionCard cycles={detail.cycles} />
        <HealthCard animal={current} health={detail.health} />
        <PhotosCard animal={current} />
      </div>
      {markingStatus && <StatusDialog animal={current} onClose={() => setMarkingStatus(false)} />}
    </>
  );
}
