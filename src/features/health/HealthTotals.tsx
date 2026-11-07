import { Icon, ICONS } from '../../components/Icon';
import { Skeleton } from '../../components/Skeleton';
import { formatCount } from '../../lib/format';
import type { HealthTotals as HealthCounts, TotalChip, VaccineTotals } from './helpers';
import styles from './HealthPage.module.css';

interface Part {
  label: string;
  count: number | undefined;
  color: string;
  note: string;
}

function TotalCard({
  label,
  tone,
  icon,
  total,
  chip,
  parts,
  summary,
  failed,
}: {
  label: string;
  tone: 'blue' | 'red';
  icon: string;
  total: number | undefined;
  chip: TotalChip | null;
  parts: Part[];
  summary: string | undefined;
  failed: boolean;
}) {
  const pending = (width: number, height: number) =>
    failed ? '—' : <Skeleton width={width} height={height} />;
  return (
    <section className={styles.totalCard} aria-label={label}>
      <div className={styles.totalHead}>
        <span className={styles.totalIcon} data-tone={tone}>
          <Icon d={icon} />
        </span>
        <span className={styles.totalLabel}>{label}</span>
      </div>
      <div className={styles.totalValue}>
        <span className={styles.bigNumber} data-testid="total">
          {total === undefined ? pending(90, 28) : formatCount(total)}
        </span>
        {chip && (
          <span className={styles.chip} data-tone={chip.tone} title={chip.label}>
            <span aria-hidden="true">{chip.text}</span>
            <span className={styles.srOnly}>{chip.label}</span>
          </span>
        )}
      </div>
      <div className={styles.stack} role="img" aria-label={summary ?? `${label}: no figures`}>
        {total
          ? parts.map((part) => (
              <span
                key={part.label}
                style={{ width: `${((part.count ?? 0) / total) * 100}%`, background: part.color }}
              />
            ))
          : null}
      </div>
      <div className={styles.parts}>
        {parts.map((part) => (
          <div key={part.label} className={styles.part}>
            <span className={styles.partLabel}>
              <i style={{ background: part.color }} />
              {part.label}
            </span>
            <span className={styles.partValue}>
              {part.count === undefined ? pending(44, 20) : formatCount(part.count)}
            </span>
            <span className={styles.note}>{part.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HealthTotals({
  vaccines,
  vaccineTrend,
  vaccinesFailed,
  health,
  healthTrend,
  healthFailed,
}: {
  vaccines: VaccineTotals | undefined;
  vaccineTrend: TotalChip | null;
  vaccinesFailed: boolean;
  health: HealthCounts | undefined;
  healthTrend: TotalChip | null;
  healthFailed: boolean;
}) {
  return (
    <div className={styles.totals}>
      <TotalCard
        label="Vaccinations not yet given"
        tone="blue"
        icon={ICONS.vaccine}
        total={vaccines?.total}
        chip={vaccineTrend}
        failed={vaccinesFailed}
        summary={
          vaccines &&
          `${formatCount(vaccines.overdue)} overdue, ${formatCount(vaccines.due)} due in 7 days, ${formatCount(vaccines.upcoming)} upcoming`
        }
        parts={[
          {
            label: 'Overdue',
            count: vaccines?.overdue,
            color: 'var(--danger)',
            note: 'past the due date',
          },
          {
            label: 'Due',
            count: vaccines?.due,
            color: 'var(--stack-amber)',
            note: 'in the next 7 days',
          },
          {
            label: 'Upcoming',
            count: vaccines?.upcoming,
            color: 'var(--stack-blue)',
            note: 'in 8 to 30 days',
          },
        ]}
      />
      <TotalCard
        label="Open health issues"
        tone="red"
        icon={ICONS.health}
        total={health?.total}
        chip={healthTrend}
        failed={healthFailed}
        summary={
          health &&
          `${formatCount(health.sick)} sick, ${formatCount(health.detected)} detected, ${formatCount(health.condition)} long-term conditions`
        }
        parts={[
          { label: 'Sick', count: health?.sick, color: 'var(--danger)', note: 'needs care now' },
          {
            label: 'Detected',
            count: health?.detected,
            color: 'var(--stack-amber)',
            note: 'to be checked',
          },
          {
            label: 'Long-term',
            count: health?.condition,
            color: 'var(--stack-grey)',
            note: 'ongoing conditions',
          },
        ]}
      />
    </div>
  );
}
