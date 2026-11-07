import { useMemo, useState, type ReactNode } from 'react';
import { Button, IconButton } from '../../components/Button';
import { Card } from '../../components/Card';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { Field, inputClass } from '../../components/Field';
import { FilterBar } from '../../components/FilterBar';
import { KpiCard, KpiGrid, type KpiTone } from '../../components/KpiCard';
import { Modal } from '../../components/Modal';
import { Pagination, PAGE_SIZE } from '../../components/Pagination';
import { Segmented } from '../../components/Segmented';
import { Skeleton } from '../../components/Skeleton';
import { StatusPill, type PillTone } from '../../components/StatusPill';
import { useToast } from '../../components/Toast';
import { downloadCsv, toCsv } from '../../lib/csv';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatKg,
  formatLitres,
  formatPhone,
  formatRelative,
  formatRupees,
  formatTime,
} from '../../lib/format';
import { useClearUrlParams, useUrlPage, useUrlSort, useUrlState } from '../../lib/url-state';
import styles from './ComponentsPage.module.css';

const NOW = Date.now();
const HOUR = 3_600_000;

function Icon({ d }: { d: string }) {
  return (
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
      <path d={d} />
    </svg>
  );
}

const DROP = 'M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

function KpiSection() {
  const tones: KpiTone[] = ['green', 'milk', 'blue', 'pink', 'amber', 'red', 'grey'];
  return (
    <Section title="KpiCard">
      <KpiGrid>
        <KpiCard
          label="Milk yesterday"
          value="24,318 L"
          note="04 Nov · all farms"
          tone="milk"
          icon={<Icon d={DROP} />}
          trend={{ direction: 'down', text: '3.6%' }}
        />
        <KpiCard
          label="Milking animals"
          value="6,912"
          note="Had an entry yesterday"
          icon={<Icon d={DROP} />}
          trend={{ direction: 'up', text: '0.8%' }}
        />
        <KpiCard
          label="Feed cost yesterday"
          value="₹3,18,450"
          note="1,02,300 kg logged"
          icon={<Icon d={DROP} />}
          trend={{ direction: 'same', text: 'same' }}
        />
        <KpiCard
          label="Farms (a link)"
          value="66"
          note="The whole card opens the list"
          tone="grey"
          icon={<Icon d={DROP} />}
          to="/farmers"
        />
      </KpiGrid>
      <KpiGrid>
        {tones.map((tone) => (
          <KpiCard key={tone} label={tone} value="18" icon={<Icon d={DROP} />} tone={tone} />
        ))}
        <KpiCard label="No icon or note" value="1,412" />
      </KpiGrid>
    </Section>
  );
}

function PillSection() {
  const tones: [PillTone, string][] = [
    ['green', 'Normal'],
    ['amber', 'Detected'],
    ['red', 'Sick'],
    ['blue', 'Fixed by staff'],
    ['pink', 'Pregnant'],
    ['grey', 'Sold'],
  ];
  return (
    <Section title="StatusPill: six tones">
      <Card>
        <div className={styles.stack}>
          <Row>
            {tones.map(([tone, text]) => (
              <StatusPill key={tone} tone={tone}>
                {text}
              </StatusPill>
            ))}
          </Row>
          <Row>
            {tones.map(([tone, text]) => (
              <StatusPill key={tone} tone={tone} dot>
                {text}
              </StatusPill>
            ))}
            <StatusPill tone="green" dot numeric>
              38.6 °C
            </StatusPill>
          </Row>
        </div>
      </Card>
    </Section>
  );
}

interface SampleRow {
  id: string;
  tag: string;
  name: string;
  farm: string;
  breed: string;
  species: 'cattle' | 'buffalo';
  phone: string;
  litres: number;
  last_entry: string | null;
  status: 'Healthy' | 'Sick';
}

const FARMS = ['Shree Ganesh Dairy', 'Gir Gau Shala', 'Periyar Cattle Farm', 'Kaveri Farms'];
const NAMES = ['Gauri', 'Lakshmi', 'Ganga', 'Kali', 'गौरी', 'കാളി', 'ગંગા', 'வள்ளி'];

const SAMPLE: SampleRow[] = Array.from({ length: 66 }, (_, i) => ({
  id: `row-${i + 1}`,
  tag: String(i + 1).padStart(2, '0'),
  name: NAMES[i % NAMES.length] as string,
  farm: FARMS[i % FARMS.length] as string,
  breed: i % 3 === 0 ? 'Buffalo · Murrah' : 'Cattle · Gir',
  species: i % 3 === 0 ? 'buffalo' : 'cattle',
  phone: `+9198220${String(10000 + i * 137).slice(0, 5)}`,
  litres: 3.5 + (i % 12) * 1.5,
  last_entry: i % 11 === 10 ? null : new Date(NOW - (i * 7 + 1) * HOUR).toISOString(),
  status: i % 9 === 4 ? 'Sick' : 'Healthy',
}));

const COLUMNS: Column<SampleRow>[] = [
  {
    key: 'animal',
    header: 'Animal',
    cell: (row) => (
      <div className={styles.who}>
        <span className={styles.tag}>{row.tag}</span>
        <span>
          <b>{row.name}</b>
          <small>{row.breed}</small>
        </span>
      </div>
    ),
  },
  {
    key: 'farm',
    header: 'Farm',
    cell: (row) => (
      <>
        {row.farm}
        <small className={styles.small}>{formatPhone(row.phone)}</small>
      </>
    ),
  },
  { key: 'litres', header: 'Litres', align: 'right', cell: (row) => formatLitres(row.litres) },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    hideOnPhone: true,
    cell: (row) => formatRupees(row.litres * 42),
  },
  {
    key: 'last_entry',
    header: 'Last entry',
    cell: (row) => (row.last_entry ? formatRelative(row.last_entry) : '—'),
    sortValue: (row) => row.last_entry,
  },
  {
    key: 'health',
    header: 'Health',
    cell: (row) =>
      row.status === 'Sick' ? (
        <StatusPill tone="red" dot>
          Sick
        </StatusPill>
      ) : (
        <span className={styles.muted}>No open issue</span>
      ),
  },
];

const ROW_LINK = {
  href: () => '/dev/components',
  label: (row: SampleRow) => `Open tag ${row.tag}`,
};
const FILTER_KEYS = ['q', 'farm', 'health', 'species'];

function LiveTableSection() {
  const [filters, setFilters] = useUrlState({ q: '', farm: '', health: '', species: 'all' });
  const [page, setPage] = useUrlPage();
  const [sort, setSort] = useUrlSort({ key: 'last_entry', dir: 'desc' });
  const clear = useClearUrlParams(FILTER_KEYS);

  const matching = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return SAMPLE.filter(
      (row) =>
        (!q || row.name.toLowerCase().includes(q) || row.tag.includes(q)) &&
        (!filters.farm || row.farm === filters.farm) &&
        (!filters.health || row.status === filters.health) &&
        (filters.species === 'all' || row.species === filters.species),
    );
  }, [filters]);
  const rows = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Section title="DataTable, FilterBar, Segmented, Pagination (live, in the URL)">
      <Card flush>
        <FilterBar
          searchLabel="Search tag or name"
          lead={
            <Segmented
              label="Species category"
              value={filters.species}
              onChange={(species) => setFilters({ species })}
              options={[
                { value: 'all', label: 'All', count: 66 },
                { value: 'cattle', label: 'Cattle', count: 44 },
                { value: 'buffalo', label: 'Buffalo', count: 22 },
              ]}
            />
          }
          selects={[
            {
              key: 'farm',
              label: 'Farm',
              options: [
                { value: '', label: 'All farms' },
                ...FARMS.map((farm) => ({ value: farm, label: farm })),
              ],
            },
            {
              key: 'health',
              label: 'Health',
              options: [
                { value: '', label: 'Any health' },
                { value: 'Sick', label: 'Sick' },
                { value: 'Healthy', label: 'Healthy' },
              ],
            },
          ]}
        />
        <DataTable
          label="Live sample"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.id}
          sort={sort}
          onSortChange={setSort}
          rowLink={ROW_LINK}
          emptyTitle="No animals match these filters"
          emptyNote="Try another farm, category or status."
          onClearFilters={clear}
        />
        <Pagination page={page} total={matching.length} onPageChange={setPage} />
      </Card>
    </Section>
  );
}

function TableStatesSection() {
  const toast = useToast();
  const rows = SAMPLE.slice(0, 3);
  return (
    <Section title="DataTable: other states">
      <Card flush>
        <p className={styles.caption}>Loading</p>
        <DataTable
          label="Loading sample"
          columns={COLUMNS}
          rows={[]}
          rowKey={(row) => row.id}
          loading
          skeletonRows={3}
          rowLink={ROW_LINK}
        />
      </Card>
      <Card flush>
        <p className={styles.caption}>Empty</p>
        <DataTable
          label="Empty sample"
          columns={COLUMNS}
          rows={[]}
          rowKey={(row) => row.id}
          emptyNote="Try another farm or status."
          onClearFilters={() => toast.show('Filters cleared')}
        />
      </Card>
      <Card flush>
        <p className={styles.caption}>Couldn’t load</p>
        <DataTable
          label="Error sample"
          columns={COLUMNS}
          rows={[]}
          rowKey={(row) => row.id}
          error="Couldn't load this list. Check your connection and try again."
          onRetry={() => toast.show('Trying again')}
        />
      </Card>
      <Card flush>
        <p className={styles.caption}>Row actions in place of a row link</p>
        <DataTable
          label="Row actions sample"
          columns={[
            ...COLUMNS.slice(0, 3),
            {
              key: 'actions',
              header: 'Actions',
              hideHeader: true,
              shrink: true,
              align: 'right',
              cell: (row) => (
                <IconButton
                  aria-label={`Fix tag ${row.tag}`}
                  onClick={() => toast.show(`Fix tag ${row.tag}`)}
                >
                  <Icon d="M4 20h4L19 9l-4-4L4 16z" />
                </IconButton>
              ),
            },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
        />
      </Card>
    </Section>
  );
}

function PaginationSection() {
  const [page, setPage] = useState(50);
  return (
    <Section title="Pagination">
      <Card flush>
        <Pagination page={1} total={66} onPageChange={() => undefined} />
        <Pagination page={2} total={66} noun="farms" onPageChange={() => undefined} />
        <Pagination page={4} total={66} noun="farms" onPageChange={() => undefined} />
        <Pagination page={page} total={18960} noun="animals" onPageChange={setPage} />
        <Pagination page={1} total={8} noun="sheds" onPageChange={() => undefined} />
        <Pagination page={1} total={0} onPageChange={() => undefined} />
      </Card>
    </Section>
  );
}

function SegmentedSection() {
  const [period, setPeriod] = useState('7');
  const [view, setView] = useState('all');
  return (
    <Section title="Segmented">
      <Card>
        <Row>
          <Segmented
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
          <Segmented
            label="Category"
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: 'All', count: '18,960' },
              { value: 'large', label: 'Large ruminants', count: '16,875' },
              { value: 'small', label: 'Small ruminants', count: '1,312' },
              { value: 'poultry', label: 'Poultry', count: '498' },
            ]}
          />
        </Row>
      </Card>
    </Section>
  );
}

type Dialog = 'form' | 'tall' | 'confirm' | 'plain' | 'green' | 'error' | null;

function DialogSection() {
  const [dialog, setDialog] = useState<Dialog>(null);
  const toast = useToast();
  const close = () => setDialog(null);
  const done = (text: string) => {
    close();
    toast.show(text);
  };
  return (
    <Section title="Modal, ConfirmDialog, Toast">
      <Card>
        <Row>
          <Button variant="primary" onClick={() => setDialog('form')}>
            Invite staff
          </Button>
          <Button onClick={() => setDialog('tall')}>Tall dialog</Button>
          <Button variant="danger" onClick={() => setDialog('confirm')}>
            Delete farm
          </Button>
          <Button onClick={() => setDialog('plain')}>Remove member</Button>
          <Button onClick={() => setDialog('green')}>Green confirm</Button>
          <Button onClick={() => setDialog('error')}>Failed save</Button>
          <Button onClick={() => toast.show('Invite sent to Meera Iyer')}>Toast</Button>
          <Button onClick={() => toast.show("Couldn't save. Try again.", 'error')}>
            Error toast
          </Button>
          <Button size="sm">Small</Button>
          <Button size="sm" disabled>
            Disabled
          </Button>
        </Row>
      </Card>
      {dialog === 'form' && (
        <Modal
          title="Invite staff"
          subtitle="They get an email to set a password. Only brainwired emails can be invited."
          onClose={close}
          onSubmit={() => done('Invite sent to Meera Iyer')}
          footer={
            <>
              <Button onClick={close}>Cancel</Button>
              <Button type="submit" variant="primary">
                Send invite
              </Button>
            </>
          }
        >
          <Field label="Full name">
            <input className={inputClass} placeholder="e.g. Meera Iyer" />
          </Field>
          <Field label="Work email" error="Enter a valid email.">
            <input className={inputClass} placeholder="name@[brainwired domain]" />
          </Field>
          <Field label="Role">
            <select className={inputClass}>
              <option>Support</option>
              <option>Viewer</option>
              <option>Super admin</option>
            </select>
          </Field>
        </Modal>
      )}
      {dialog === 'tall' && (
        <Modal
          title="A tall dialog"
          subtitle="It stays on the screen and scrolls inside."
          onClose={close}
          footer={<Button onClick={close}>Close</Button>}
        >
          {Array.from({ length: 14 }, (_, i) => (
            <Field key={i} label={`Field ${i + 1}`}>
              <input className={inputClass} />
            </Field>
          ))}
        </Modal>
      )}
      {dialog === 'confirm' && (
        <ConfirmDialog
          title="Delete Shree Ganesh Dairy?"
          subtitle="Only do this if the farmer asked for it."
          warning="This removes the farm, its 64 animals and all their milk, feed, health and breeding records from the app."
          confirmLabel="Delete farm"
          confirmText="Shree Ganesh Dairy"
          confirmTextLabel="Type the farm name to confirm"
          onConfirm={() => done('Shree Ganesh Dairy deleted · saved to the activity log')}
          onClose={close}
        />
      )}
      {dialog === 'plain' && (
        <ConfirmDialog
          title="Remove Ganpat Jadhav?"
          subtitle="They lose access to this farm."
          confirmLabel="Remove"
          onConfirm={() => done('Ganpat Jadhav removed')}
          onClose={close}
        />
      )}
      {dialog === 'green' && (
        <ConfirmDialog
          title="Mark this vaccine done?"
          confirmLabel="Mark done"
          destructive={false}
          onConfirm={() => done('Vaccine marked done')}
          onClose={close}
        />
      )}
      {dialog === 'error' && (
        <ConfirmDialog
          title="Delete this entry?"
          confirmLabel="Delete"
          error="Your role can't make this change."
          onConfirm={close}
          onClose={close}
        />
      )}
    </Section>
  );
}

function PlaceholderSection() {
  return (
    <Section title="EmptyState, Skeleton">
      <div className={styles.columns}>
        <EmptyState onAction={() => undefined} note="Try another farm, category or status." />
        <EmptyState title="No milk logged yet" />
        <Card>
          <div className={styles.stack}>
            <Skeleton width="40%" height={12} />
            <Skeleton width="60%" height={28} />
            <Skeleton />
            <Row>
              <Skeleton width={36} height={36} radius={11} />
              <Skeleton width={34} height={34} radius={10} />
              <Skeleton width={120} height={42} radius={12} />
            </Row>
          </div>
        </Card>
      </div>
    </Section>
  );
}

const DAYS_7 = ['29 Oct', '30 Oct', '31 Oct', '01 Nov', '02 Nov', '03 Nov', '04 Nov'];
const MILK_7 = [305, 312, 298, 318, 310, 340, 300].map((litres, i) => ({
  day: DAYS_7[i] as string,
  litres,
}));
const MILK_30 = Array.from({ length: 30 }, (_, i) => ({
  day: `${((i + 5) % 31) + 1}/${i < 26 ? 10 : 11}`,
  litres: 21000 + ((i * 7919) % 4300),
}));
const SESSIONS = DAYS_7.map((day, i) => {
  const morning = 11800 + i * 130;
  const afternoon = 1800 + (i % 3) * 60;
  const evening = 9600 + ((i * 370) % 800);
  return { day, morning, afternoon, evening, total: morning + afternoon + evening };
});
const FEED = [640, 655, 626, 660, 648, 672, 650].map((kg, i) => ({
  day: DAYS_7[i] as string,
  kg,
}));
const TEMPS = Array.from({ length: 28 }, (_, i) => ({
  hour: `${DAYS_7[Math.floor(i / 4)]}`,
  average: 38.3 + Math.sin(i / 1.6) * 0.15,
  highest: 38.9 + Math.cos(i / 1.3) * 0.15 + (i === 27 ? 1.1 : 0),
}));

const thousands = (value: number) => (value === 0 ? '0' : `${value / 1000}k`);

function ChartSection() {
  return (
    <Section title="BarChart, LineChart">
      <Card>
        <div className={styles.stack}>
          <p className={styles.chartTitle}>Milk collected per day · all farms</p>
          <BarChart
            label="Milk collected per day for 30 days"
            data={MILK_30}
            xKey="day"
            series={[{ key: 'litres', label: 'Milk' }]}
            tooltip={(row) => (
              <>
                {row.day} · <b>{formatLitres(row.litres, { decimals: 0 })}</b>
              </>
            )}
            yTicks={[0, 10000, 20000, 30000]}
            formatY={thousands}
            highlightIndex={28}
            rotateLabels
            labelEveryOnPhone={5}
          />
        </div>
      </Card>
      <div className={styles.columns2}>
        <Card>
          <div className={styles.stack}>
            <p className={styles.chartTitle}>1 · Milk</p>
            <BarChart
              label="Milk per day for 7 days"
              data={MILK_7}
              xKey="day"
              series={[{ key: 'litres', label: 'Milk' }]}
              tooltip={(row) => `${row.day} · ${formatLitres(row.litres, { decimals: 0 })}`}
              yTicks={[0, 150, 300, 450]}
              labelEveryOnPhone={2}
            />
          </div>
        </Card>
        <Card>
          <div className={styles.stack}>
            <p className={styles.chartTitle}>Milk by session · last 7 days</p>
            <BarChart
              label="Milk by session for 7 days"
              data={SESSIONS}
              xKey="day"
              series={[
                { key: 'morning', label: 'Morning', color: 'var(--navy)' },
                { key: 'afternoon', label: 'Afternoon', color: 'var(--chart-sky)' },
                { key: 'evening', label: 'Evening', color: 'var(--green)' },
              ]}
              tooltip={(row) => `${row.day} · ${formatLitres(row.total, { decimals: 0 })}`}
              yTicks={[0, 10000, 20000, 30000]}
              formatY={thousands}
              totalLabel={(row) => `${(row.total / 1000).toFixed(1)}k`}
              labelEveryOnPhone={2}
            />
          </div>
        </Card>
        <Card>
          <div className={styles.stack}>
            <p className={styles.chartTitle}>2 · Feed</p>
            <LineChart
              label="Feed per day for 7 days"
              data={FEED}
              xKey="day"
              series={[
                { key: 'kg', label: 'Feed', color: 'var(--green-ink)', area: true, dots: true },
              ]}
              tooltip={(row) => `${row.day} · ${formatKg(row.kg)}`}
              yTicks={[550, 625, 700]}
              labelEveryOnPhone={2}
            />
          </div>
        </Card>
        <Card>
          <div className={styles.stack}>
            <p className={styles.chartTitle}>4 · Cattle temperature</p>
            <LineChart
              label="Cattle temperature, hourly for 7 days"
              data={TEMPS}
              xKey="hour"
              series={[
                { key: 'average', label: 'Herd average', color: 'var(--chart-pink)' },
                { key: 'highest', label: 'Highest cow', color: 'var(--chart-pink-soft)' },
              ]}
              references={[{ y: 39.5, label: 'Fever alert 39.5 °C', color: 'var(--danger)' }]}
              tooltip={(row) => `${row.hour} · ${row.highest.toFixed(1)} °C highest`}
              yTicks={[37.5, 38.5, 39.5, 40.5]}
              labelEvery={4}
              labelEveryOnPhone={8}
            />
          </div>
        </Card>
      </div>
    </Section>
  );
}

function FormatSection() {
  const toast = useToast();
  const samples: [string, string][] = [
    ['formatRupees', `${formatRupees(123456)} · ${formatRupees(42, { decimals: 2 })}`],
    ['formatLitres', `${formatLitres(14.5)} · ${formatLitres(24318, { decimals: 0 })}`],
    ['formatKg', formatKg(102300)],
    ['formatCount', formatCount(18960)],
    ['formatDate', formatDate(NOW)],
    ['formatDateTime', formatDateTime(NOW)],
    ['formatTime', formatTime(NOW)],
    ['formatRelative', formatRelative(NOW - 20 * 60_000)],
    ['formatPhone', formatPhone('+919822012341')],
  ];
  return (
    <Section title="lib/format, lib/csv">
      <Card>
        <dl className={styles.formats}>
          {samples.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <Button
          size="sm"
          onClick={() => {
            downloadCsv(
              'sample.csv',
              toCsv(
                ['Tag', 'Name', 'Farm'],
                SAMPLE.map((row) => [row.tag, row.name, row.farm]),
              ),
            );
            toast.show(`sample.csv downloaded · ${SAMPLE.length} rows`);
          }}
        >
          Export CSV
        </Button>
      </Card>
    </Section>
  );
}

/** Every shared component in each state. Only exists on the dev server: see router.tsx. */
export function ComponentsPage() {
  return (
    <div className={styles.page}>
      <header>
        <span className={styles.eyebrow}>Dev only</span>
        <h1 className={styles.title}>Components</h1>
        <p className={styles.sub}>Every shared component in each state, with sample data.</p>
      </header>
      <KpiSection />
      <PillSection />
      <LiveTableSection />
      <TableStatesSection />
      <PaginationSection />
      <SegmentedSection />
      <DialogSection />
      <PlaceholderSection />
      <ChartSection />
      <FormatSection />
    </div>
  );
}
