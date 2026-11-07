import { Link } from 'react-router-dom';
import { CAN_EDIT, RoleGate } from '../../app/RoleGate';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { ChartLegend } from '../../components/charts/ChartParts';
import { LineChart } from '../../components/charts/LineChart';
import { StatusPill } from '../../components/StatusPill';
import type { AnimalDetail, ReproductionCycle } from '../../data/types';
import {
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatLitres,
  formatLitresTotal,
  formatRelative,
  formatTime,
  indiaDay,
} from '../../lib/format';
import { BREEDING_LABELS } from '../livestock/helpers';
import { animalName } from './AnimalDialogs';
import {
  activityParts,
  goldenNote,
  gestation,
  milkBars,
  milkSummary,
  milkTicks,
  pregnancyTotals,
} from './helpers';
import { useLongMilk, useShedToday } from './queries';
import styles from './AnimalPage.module.css';

function CycleFacts({ cycle }: { cycle: ReproductionCycle }) {
  return (
    <div className={styles.kvList}>
      {cycle.heat_started_at && cycle.status === 'heat' && (
        <div className={styles.kv}>
          <span>Heat started</span>
          <b>{formatDateTime(cycle.heat_started_at)}</b>
        </div>
      )}
      {cycle.golden_end && cycle.status === 'heat' && (
        <div className={styles.kv}>
          <span>Golden period ends</span>
          <b>{formatDateTime(cycle.golden_end)}</b>
        </div>
      )}
      {cycle.inseminated_at && (
        <div className={styles.kv}>
          <span>Inseminated</span>
          <b>
            {formatDate(cycle.inseminated_at)}
            {goldenNote(cycle)}
          </b>
        </div>
      )}
      {cycle.tube_number && (
        <div className={styles.kv}>
          <span>Tube no.</span>
          <b className={styles.pillValue}>
            <span className={styles.mono}>{cycle.tube_number}</span>
            <StatusPill tone={cycle.insemination_verified ? 'green' : 'amber'}>
              {cycle.insemination_verified ? 'Verified' : 'Not verified'}
            </StatusPill>
          </b>
        </div>
      )}
      {cycle.pregnancy_confirmed_at && (
        <div className={styles.kv}>
          <span>Pregnancy confirmed</span>
          <b>{formatDate(cycle.pregnancy_confirmed_at)}</b>
        </div>
      )}
    </div>
  );
}

function GestationBar({ cycle }: { cycle: ReproductionCycle }) {
  const progress = gestation(cycle);
  if (!progress || !cycle.inseminated_at || !cycle.expected_delivery) return null;
  const { day, total, percent, confirmedPercent } = progress;
  const inseminated = formatDayMonth(cycle.inseminated_at);
  const due = formatDate(cycle.expected_delivery);
  const confirmed = cycle.pregnancy_confirmed_at
    ? formatDayMonth(cycle.pregnancy_confirmed_at)
    : null;
  return (
    <div className={styles.gestation}>
      <div className={styles.cardHead}>
        <span className={styles.label}>Gestation</span>
        <span className={styles.monoNote}>
          day {day} of {total} · {Math.round(percent)}%
        </span>
      </div>
      <div
        role="img"
        className={styles.track}
        aria-label={`Inseminated ${inseminated}, today is day ${day}, delivery expected ${due}`}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
        <span className={styles.point} style={{ left: 0 }} />
        {confirmedPercent !== null && (
          <span className={styles.point} style={{ left: `${confirmedPercent}%` }} />
        )}
        <span className={styles.today} style={{ left: `${percent}%` }} />
        <span className={styles.end} />
      </div>
      <div aria-hidden="true" className={styles.showOnPhone}>
        <span>
          <b>Inseminated</b> <span className={styles.muted}>{inseminated}</span>
        </span>
        <span>
          <b>Due</b> <span className={styles.muted}>{due}</span>
        </span>
      </div>
      <div aria-hidden="true" className={styles.marks}>
        <span className={styles.mark} style={{ left: 0 }}>
          <b>Inseminated</b>
          <small>{inseminated}</small>
        </span>
        {confirmedPercent !== null && percent - confirmedPercent > 14 && (
          <span
            className={styles.mark}
            // Early confirmations would sit on "Inseminated", so this label stays clear of it.
            style={{ left: `${Math.max(confirmedPercent, 18)}%`, transform: 'translateX(-35%)' }}
          >
            <b>Confirmed</b>
            <small>{confirmed}</small>
          </span>
        )}
        <span
          className={`${styles.mark} ${styles.markToday}`}
          style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}
        >
          <b>Today</b>
          <small>{formatDayMonth(Date.now())}</small>
        </span>
        <span className={`${styles.mark} ${styles.markEnd}`}>
          <b>Delivery</b>
          <small>{due}</small>
        </span>
      </div>
    </div>
  );
}

export function PregnancyCard({
  cycle,
  farmId,
}: {
  cycle: ReproductionCycle | undefined;
  farmId: string;
}) {
  if (!cycle) {
    return (
      <Card flush className={`${styles.card} ${styles.wide}`}>
        <span className={styles.label}>Current pregnancy</span>
        <p className={styles.note}>Not pregnant right now.</p>
      </Card>
    );
  }
  const progress = cycle.status === 'pregnant' ? gestation(cycle) : null;
  const pregnant = cycle.status === 'pregnant';
  let headline = BREEDING_LABELS[cycle.status as 'heat' | 'inseminated' | 'pregnant'];
  if (progress) {
    const left = Math.max(progress.daysLeft, 0);
    headline = `${left} ${left === 1 ? 'day' : 'days'}`;
  }
  return (
    <Card flush className={`${styles.card} ${styles.wide}`}>
      <div className={styles.cardHead}>
        <span className={styles.label}>
          {pregnant ? 'Current pregnancy' : 'Current cycle'} · cycle {cycle.cycle_no}
        </span>
        <RoleGate allow={CAN_EDIT}>
          <Link to={`/reproduction?stage=${cycle.status}&farm=${farmId}`} className={styles.link}>
            Edit cycle <span aria-hidden="true">→</span>
          </Link>
        </RoleGate>
      </div>
      <div className={styles.pregnancyTop}>
        <div className={styles.headline}>
          <span className={styles.big}>{headline}</span>
          {pregnant && cycle.expected_delivery && (
            <span className={styles.note}>
              {progress && progress.daysLeft < 0
                ? 'past the date · expected '
                : 'to delivery · expected '}
              {formatDate(cycle.expected_delivery)}
            </span>
          )}
        </div>
        <CycleFacts cycle={cycle} />
      </div>
      {pregnant && <GestationBar cycle={cycle} />}
    </Card>
  );
}

const COLLAR_LABELS = {
  normal: { tone: 'green', text: 'Normal' },
  temperature_high: { tone: 'amber', text: 'Temperature high' },
  cannot_connect: { tone: 'red', text: 'Cannot connect' },
  no_hardware: { tone: 'grey', text: 'No collar' },
} as const;

const collarId = (id: string) => `TG-${id.slice(-4).toUpperCase()}`;

export function CollarCard({
  detail,
  feverAt,
}: {
  detail: AnimalDetail;
  feverAt: number | undefined;
}) {
  const { animal, today } = detail;
  const pill = COLLAR_LABELS[animal.connection_state];
  const temperature = today.body_temp_c ?? animal.last_temp_c;
  const battery = animal.last_battery_pct;
  return (
    <Card flush className={`${styles.card} ${styles.narrow}`}>
      <div className={styles.cardHead}>
        <span className={styles.label}>Collar</span>
        <StatusPill tone={pill.tone} dot>
          {pill.text}
        </StatusPill>
      </div>
      <div className={styles.collarNow}>
        <span className={styles.big}>
          {temperature === null ? '—' : `${temperature.toFixed(1)} °C`}
        </span>
        <span className={styles.note}>
          {animal.connection_state === 'cannot_connect'
            ? 'last body temperature'
            : 'body temperature now'}
        </span>
      </div>
      <div className={styles.kvList}>
        <div className={styles.kv}>
          <span>Collar ID</span>
          <b className={styles.mono}>
            {animal.hardware_tag_id ? collarId(animal.hardware_tag_id) : '—'}
          </b>
        </div>
        <div className={styles.kv}>
          <span>Last reading</span>
          <b>{formatRelative(animal.last_reading_at)}</b>
        </div>
        <div className={styles.kv}>
          <span>Battery</span>
          <b className={styles.pillValue}>
            {battery !== null && (
              <span className={styles.battery} aria-hidden="true">
                <span style={{ width: `${battery}%` }} />
              </span>
            )}
            <span className={styles.mono}>{battery === null ? '—' : `${battery}%`}</span>
          </b>
        </div>
        <div className={styles.kv}>
          <span>Fever alert at</span>
          <b className={styles.mono}>{feverAt === undefined ? '—' : `${feverAt.toFixed(1)} °C`}</b>
        </div>
      </div>
    </Card>
  );
}

interface HourRow {
  hour: string;
  value: number | null;
}

/** All 25 marks of the day, the hours still to come left empty so the line stops at now. */
function hourRows(readings: readonly { at: string; value: number }[]): HourRow[] {
  const byHour = new Map(readings.map((row) => [formatTime(row.at).slice(0, 2), row.value]));
  return Array.from({ length: 25 }, (_, hour) => {
    const key = String(hour).padStart(2, '0');
    return { hour: `${key}:00`, value: hour === 24 ? null : (byHour.get(key) ?? null) };
  });
}

/** Wide enough for `40.5 °C` on one line. Also set as `.shedBox`'s left in the CSS. */
const TEMP_AXIS_WIDTH = 54;
const BODY_TICKS = [37.5, 38.5, 39.5, 40.5];

export function BodyTemperatureCard({
  detail,
  feverAt,
}: {
  detail: AnimalDetail;
  feverAt: number | undefined;
}) {
  const { animal, series } = detail;
  const shed = useShedToday(animal);
  const today = indiaDay();
  const body = hourRows(
    series.cattle_temperature
      .filter((row) => indiaDay(row.hour) === today)
      .map((row) => ({ at: row.hour, value: row.avg_c })),
  );
  const lastIndex = body.reduce((last, row, index) => (row.value === null ? last : index), -1);
  const shedReadings = (shed.data ?? []).map((row) => ({ at: row.ts, value: row.temp_c }));
  const shedTemps = shedReadings.map((row) => row.value);
  const shedLow = Math.floor(Math.min(...shedTemps));
  const shedHigh = Math.ceil(Math.max(...shedTemps));
  const hasShed = shedReadings.length > 0;
  const name = animalName(animal);
  const legend = [
    { label: name, color: 'var(--chart-pink)' },
    ...(feverAt === undefined
      ? []
      : [{ label: `Fever alert ${feverAt} °C`, color: 'var(--danger)', dashed: true }]),
  ];
  return (
    <Card flush className={`${styles.card} ${styles.wide}`}>
      <div className={styles.cardHead}>
        <span className={styles.label}>Body temperature · today</span>
        <ChartLegend items={legend} />
      </div>
      {lastIndex < 0 ? (
        <p className={styles.note}>No collar readings yet today.</p>
      ) : (
        <>
          <LineChart
            label={`${name}'s body temperature today`}
            data={body}
            xKey="hour"
            series={[{ key: 'value', label: name, color: 'var(--chart-pink)', area: true }]}
            references={
              feverAt === undefined
                ? []
                : [{ y: feverAt, label: `Fever alert ${feverAt} °C`, color: 'var(--danger)' }]
            }
            tooltip={(row: HourRow) =>
              row.value === null
                ? row.hour
                : row === body[lastIndex]
                  ? `${row.value.toFixed(1)} °C now`
                  : `${row.hour} · ${row.value.toFixed(1)} °C`
            }
            highlightIndex={lastIndex}
            hideCursor
            yAxisWidth={TEMP_AXIS_WIDTH}
            height={hasShed ? 160 : 190}
            yTicks={BODY_TICKS}
            formatY={(value) => (value === 40.5 ? '40.5 °C' : String(value))}
            labelEvery={4}
            labelEveryOnPhone={8}
            hideLegend
            hideXAxis={hasShed}
          />
          {hasShed && (
            <div className={styles.shedStrip}>
              <span className={styles.shedBox} aria-hidden="true" />
              <span className={styles.shedLabel}>
                Shed {animal.shed_code ?? animal.shed_name} · {shedLow}–{shedHigh} °C
              </span>
              <LineChart
                label={`Shed temperature today, ${shedLow} to ${shedHigh} °C`}
                data={hourRows(shedReadings)}
                xKey="hour"
                series={[{ key: 'value', label: 'Shed temperature', color: 'var(--muted)' }]}
                tooltip={(row: HourRow) =>
                  row.value === null ? row.hour : `${row.hour} · ${row.value.toFixed(1)} °C`
                }
                height={84}
                yAxisWidth={TEMP_AXIS_WIDTH}
                yTicks={[20, 40]}
                formatY={(value) => (value === 40 ? '40 °C' : String(value))}
                labelEvery={4}
                labelEveryOnPhone={8}
                hideLegend
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export function ActivityCard({ detail }: { detail: AnimalDetail }) {
  const { activity } = detail.today;
  const parts = activity ? activityParts(activity) : [];
  const words = parts.map((part) => `${part.name.toLowerCase()} ${part.hours.toFixed(1)} h`);
  return (
    <Card flush className={`${styles.card} ${styles.narrow}`}>
      <div className={styles.cardHead}>
        <span className={styles.label}>Activity · today</span>
        <span className={styles.monoNote}>00:00 – {formatTime(Date.now()).slice(0, 2)}:00</span>
      </div>
      {activity ? (
        <>
          <div
            role="img"
            aria-label={`Today so far: ${words.join(', ')}`}
            className={styles.activityBar}
          >
            {parts.map((part) => (
              <span key={part.name} style={{ width: `${part.percent}%`, background: part.color }} />
            ))}
          </div>
          <div className={styles.kvList}>
            {parts.map((part) => (
              <div key={part.name} className={styles.activityRow}>
                <i aria-hidden="true" style={{ background: part.color }} />
                <span>{part.name}</span>
                <b className={styles.mono}>{part.hours.toFixed(1)} h</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.note}>No activity from the collar yet today.</p>
      )}
    </Card>
  );
}

export function MilkCard({ detail }: { detail: AnimalDetail }) {
  const { animal, series, cycles } = detail;
  const today = indiaDay();
  const { lastCalved } = pregnancyTotals(cycles);
  const long = useLongMilk(animal, lastCalved !== null);
  const summary = milkSummary(series.milk, today);
  const bars = milkBars(series.milk, today, formatDayMonth);
  const calvedDay = lastCalved ? indiaDay(lastCalved) : null;
  const lactation =
    calvedDay && long.data
      ? long.data.filter((row) => row.day >= calvedDay).reduce((sum, row) => sum + row.litres, 0)
      : null;
  // The series goes back 90 days: an older calving's total would be cut short, so it says so.
  const fromCalving = calvedDay !== null && calvedDay >= (long.data?.[0]?.day ?? calvedDay);
  return (
    <Card flush className={`${styles.card} ${styles.wide}`}>
      <div className={styles.cardHead}>
        <span className={styles.label}>Milk · last 30 days</span>
        <Link to={`/milk-feed?farm=${animal.farm_id}`} className={styles.link}>
          Entries <span aria-hidden="true">→</span>
        </Link>
      </div>
      {summary.hasMilk ? (
        <>
          <div className={styles.milkFacts}>
            {lactation !== null && (
              <span>
                <span className={styles.note}>
                  {fromCalving ? 'This lactation' : 'Last 90 days'}
                </span>
                <b>{formatLitresTotal(Math.round(lactation))}</b>
              </span>
            )}
            <span>
              <span className={styles.note}>30-day average</span>
              <b>{formatLitres(summary.average)} / day</b>
            </span>
            <span>
              <span className={styles.note}>Best day</span>
              <b>{formatLitres(summary.best)}</b>
            </span>
            {lastCalved && (
              <span>
                <span className={styles.note}>Calved</span>
                <b>{formatDate(lastCalved)}</b>
              </span>
            )}
          </div>
          <BarChart
            label="Milk per day for the last 30 days"
            data={bars}
            xKey="label"
            series={[{ key: 'litres', label: 'Milk' }]}
            tooltip={(row) =>
              `${row.label === 'Today' ? 'Today' : formatDayMonth(row.day)}: ${formatLitres(row.litres)}`
            }
            height={170}
            yTicks={milkTicks(Math.max(...bars.map((bar) => bar.litres)))}
            formatY={(value) =>
              value === milkTicks(summary.best).at(-1) ? `${value} L` : String(value)
            }
            emphasisIndex={29}
            rightMargin={14}
            phoneBarGap="20%"
          />
        </>
      ) : (
        <p className={styles.note}>No milk logged for this animal in the last 30 days.</p>
      )}
    </Card>
  );
}
