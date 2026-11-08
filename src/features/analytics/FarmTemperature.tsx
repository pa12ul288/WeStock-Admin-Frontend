import { Card } from '../../components/Card';
import { LineChart } from '../../components/charts/LineChart';
import { Segmented } from '../../components/Segmented';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill } from '../../components/StatusPill';
import type { EnvironmentReading, Shed } from '../../data/types';
import { errorMessage } from '../../lib/errors';
import { indiaDay } from '../../lib/format';
import { NoData } from './AnalyticsCards';
import { dayChoices, hourSlots, thiColour, weekPeak, type HourReading } from './helpers';
import { useEnvironmentDays } from './queries';
import styles from './AnalyticsPage.module.css';

const TEMP_TICKS = [15, 20, 25, 30, 35];
const HOURS = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:00'];
/** Wide enough for `35 °C`; the humidity strip and the THI cells line up with it. */
const AXIS = 46;

export function shedLabel(shed: Pick<Shed, 'code' | 'name'>): string {
  return shed.code ?? shed.name;
}

interface FarmTemperatureProps {
  farmId: string;
  hasBlackbox: boolean;
  sheds: readonly Shed[];
  /** The chosen shed's id, or null for the whole farm. */
  shedId: string | null;
  onShed: (id: string) => void;
  day: string;
  onDay: (day: string) => void;
}

export function FarmTemperatureCard({
  farmId,
  hasBlackbox,
  sheds,
  shedId,
  onShed,
  day,
  onDay,
}: FarmTemperatureProps) {
  const env = useEnvironmentDays(farmId, shedId);
  const shed = sheds.find((item) => item.id === shedId);
  const where = shed ? shedLabel(shed) : null;
  const source = hasBlackbox
    ? where
      ? `From the ${where} shed sensor`
      : 'From the farm’s sensors'
    : 'From the weather forecast';
  const choices = dayChoices();
  const readings = env.data?.byDay.get(day) ?? [];
  const slots = hourSlots(readings);

  return (
    <Card className={styles.card}>
      <div className={styles.envHead}>
        <div className={styles.envTitle}>
          <h2 className={styles.label}>5 · Farm temperature</h2>
          <StatusPill tone="grey">{source}</StatusPill>
        </div>
        <div className={styles.actions}>
          {hasBlackbox && sheds.length > 0 && shedId && (
            <Segmented
              label="Shed"
              options={sheds.map((item) => ({ value: item.id, label: shedLabel(item) }))}
              value={shedId}
              onChange={onShed}
            />
          )}
          <select
            className={styles.select}
            aria-label="Day"
            value={day}
            onChange={(event) => onDay(event.target.value)}
          >
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {env.isPending ? (
        <Skeleton height={260} radius={12} />
      ) : env.isError ? (
        <NoData
          title="The temperature couldn’t load"
          note={errorMessage(env.error)}
          icon="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"
        />
      ) : readings.length === 0 ? (
        <NoData
          title="No temperature readings for this day"
          note={
            hasBlackbox
              ? 'The shed sensor sent nothing on this day.'
              : 'This farm has no Blackbox, so there is no shed sensor to read.'
          }
        />
      ) : (
        <FarmTemperatureBody slots={slots} all={env.data?.all ?? []} where={where} />
      )}
    </Card>
  );
}

function FarmTemperatureBody({
  slots,
  all,
  where,
}: {
  slots: readonly HourReading[];
  all: readonly EnvironmentReading[];
  where: string | null;
}) {
  const temps = slots.flatMap((slot) => (slot.temp === null ? [] : [slot.temp]));
  const peakTemp = Math.max(...temps);
  const peakIndex = slots.findIndex((slot) => slot.temp === peakTemp);
  const humidity = slots.flatMap((slot) => (slot.humidity === null ? [] : [slot.humidity]));
  const humRange = humidity.length
    ? `${Math.round(Math.min(...humidity))}–${Math.round(Math.max(...humidity))}%`
    : '';
  const today = indiaDay();
  const todays = all.filter((row) => indiaDay(row.ts) === today);
  const now = todays.at(-1);
  const hottest = weekPeak(all, (row) => row.temp_c);
  const highThi = weekPeak(all, (row) => row.thi);
  const place = where ?? 'the farm';

  return (
    <div className={styles.envBody}>
      <div className={styles.envCharts}>
        <LineChart
          label="Temperature by hour"
          data={slots}
          xKey="hour"
          series={[{ key: 'temp', label: 'Temperature', color: 'var(--chart-orange)', area: true }]}
          tooltip={(row: HourReading) =>
            row.temp === null ? row.hour : `${row.temp.toFixed(1)} °C at ${row.hour}`
          }
          highlightIndex={peakIndex}
          // 160 px of plot, 15 to 35 °C: the bubble sits above the peak's dot.
          tooltipY={Math.max(0, 10 + ((35 - peakTemp) / 20) * 160 - 38)}
          hideCursor
          hideXAxis
          hideLegend
          height={170}
          yTicks={TEMP_TICKS}
          formatY={(value) => (value === 35 ? '35 °C' : String(value))}
          yAxisWidth={AXIS}
        />
        <div className={styles.strip}>
          <span className={styles.stripLabel}>Hum.</span>
          <div className={styles.humBox}>
            <LineChart
              label={`Humidity by hour, ${humRange}`}
              data={slots}
              xKey="hour"
              series={[{ key: 'humidity', label: 'Humidity', color: 'var(--chart-blue)' }]}
              tooltip={(row: HourReading) =>
                row.humidity === null ? row.hour : `${Math.round(row.humidity)}% at ${row.hour}`
              }
              hideCursor
              hideXAxis
              hideLegend
              height={42}
              yTicks={[30, 90]}
              formatY={() => ''}
              yAxisWidth={0}
              rightMargin={0}
            />
            {humRange && <span className={styles.humRange}>{humRange}</span>}
          </div>
        </div>
        <div className={styles.strip}>
          <span className={styles.stripLabel}>THI</span>
          <div
            className={styles.thi}
            role="img"
            aria-label={
              highThi
                ? `Hourly THI, highest ${Math.round(Math.max(...slots.map((slot) => slot.thi ?? 0)))}`
                : 'Hourly THI'
            }
          >
            {slots.map((slot) => (
              <span
                key={slot.hour}
                title={
                  slot.temp === null || slot.thi === null
                    ? slot.hour
                    : `${slot.hour} · ${slot.temp.toFixed(1)} °C · ${Math.round(slot.humidity ?? 0)}% · THI ${Math.round(slot.thi)}`
                }
                style={slot.thi === null ? undefined : { background: thiColour(slot.thi) }}
              />
            ))}
          </div>
        </div>
        <div className={styles.hours} aria-hidden="true">
          {HOURS.map((hour) => (
            <span key={hour}>{hour}</span>
          ))}
        </div>
        <div className={styles.thiKey}>
          <span>Lower THI</span>
          <i aria-hidden="true" />
          <span>Higher THI (more heat stress)</span>
        </div>
      </div>
      <div className={styles.boxes}>
        <div className={styles.box}>
          <span className={styles.label}>Right now</span>
          <b>
            {now
              ? `${now.temp_c.toFixed(1)} °C${now.humidity === null ? '' : ` · ${Math.round(now.humidity)}%`}`
              : '—'}
          </b>
          <span className={styles.note}>
            {now && now.thi !== null
              ? `THI ${Math.round(now.thi)} in ${place}`
              : 'No reading yet today'}
          </span>
        </div>
        <div className={styles.box}>
          <span className={styles.label}>Hottest this week</span>
          <b>{hottest ? `${hottest.value.toFixed(1)} °C` : '—'}</b>
          <span className={styles.note}>{hottest ? `${hottest.day} · ${hottest.hour}` : ' '}</span>
        </div>
        <div className={styles.box}>
          <span className={styles.label}>Highest THI this week</span>
          <b>{highThi ? Math.round(highThi.value) : '—'}</b>
          <span className={styles.note}>{highThi ? `${highThi.day} · ${highThi.hour}` : ' '}</span>
        </div>
      </div>
    </div>
  );
}
