import { IconButton } from '../../components/Button';
import type { Column } from '../../components/DataTable';
import { Icon, ICONS } from '../../components/Icon';
import { StatusPill } from '../../components/StatusPill';
import type { FeedRow, MilkRow } from '../../data/types';
import { formatDateTime, formatKg, formatRupees } from '../../lib/format';
import { milkAnimalText, SESSION_LABELS } from './helpers';
import styles from './MilkFeedPage.module.css';

interface ColumnOptions<Row> {
  canEdit: boolean;
  staffAdded: ReadonlySet<string> | undefined;
  onFix: (row: Row) => void;
  onDelete: (row: Row) => void;
}

function EnteredBy({
  row,
  staffAdded,
}: {
  row: { id: string; entered_by: string | null; fixed_by_staff: boolean };
  staffAdded: ReadonlySet<string> | undefined;
}) {
  const name = staffAdded?.has(row.id) ? 'Added by staff' : (row.entered_by ?? 'Farm member');
  return (
    <div className={styles.enteredBy}>
      <span>{name}</span>
      {row.fixed_by_staff && <StatusPill tone="blue">Fixed by staff</StatusPill>}
    </div>
  );
}

function actionsColumn<Row>({
  onFix,
  onDelete,
}: Pick<ColumnOptions<Row>, 'onFix' | 'onDelete'>): Column<Row> {
  return {
    key: 'actions',
    header: 'Actions',
    hideHeader: true,
    shrink: true,
    align: 'right',
    cell: (row) => (
      <div className={styles.rowActions}>
        <IconButton aria-label="Edit entry" onClick={() => onFix(row)}>
          <Icon d={ICONS.pencil} size={14} />
        </IconButton>
        <IconButton
          aria-label="Delete entry"
          className={styles.danger}
          onClick={() => onDelete(row)}
        >
          <Icon d={ICONS.trash} size={14} />
        </IconButton>
      </div>
    ),
  };
}

export function milkColumns(options: ColumnOptions<MilkRow>): Column<MilkRow>[] {
  const columns: Column<MilkRow>[] = [
    {
      key: 'logged',
      header: 'Logged',
      cell: (row) => <span className={styles.numberMuted}>{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'farm',
      header: 'Farm · animal',
      cell: (row) => (
        <div className={styles.farmCell}>
          <span className={styles.name}>{row.farm_name}</span>
          <span className={styles.note}>{milkAnimalText(row)}</span>
        </div>
      ),
    },
    {
      key: 'session',
      header: 'Session',
      cell: (row) => <StatusPill tone="grey">{SESSION_LABELS[row.session]}</StatusPill>,
    },
    {
      key: 'litres',
      header: 'Litres',
      align: 'right',
      cell: (row) => <span className={styles.numberStrong}>{row.litres.toFixed(1)}</span>,
    },
    {
      key: 'price',
      header: 'Price / L',
      align: 'right',
      cell: (row) => (
        <span className={styles.numberMuted}>
          {row.price_per_litre === null ? '—' : formatRupees(row.price_per_litre, { decimals: 2 })}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => (
        <span className={styles.number}>
          {row.price_per_litre === null ? '—' : formatRupees(row.litres * row.price_per_litre)}
        </span>
      ),
    },
    {
      key: 'by',
      header: 'Entered by',
      cell: (row) => <EnteredBy row={row} staffAdded={options.staffAdded} />,
    },
  ];
  return options.canEdit ? [...columns, actionsColumn(options)] : columns;
}

export function feedColumns(options: ColumnOptions<FeedRow>): Column<FeedRow>[] {
  const columns: Column<FeedRow>[] = [
    {
      key: 'logged',
      header: 'Logged',
      cell: (row) => <span className={styles.numberMuted}>{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'farm',
      header: 'Farm',
      cell: (row) => <span className={styles.name}>{row.farm_name}</span>,
    },
    {
      key: 'to',
      header: 'Fed to',
      cell: (row) => <span className={styles.muted}>{row.fed_to}</span>,
    },
    {
      key: 'type',
      header: 'Feed type',
      cell: (row) => <StatusPill tone="grey">{row.feed_type}</StatusPill>,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      cell: (row) => <span className={styles.number}>{formatKg(row.quantity_kg)}</span>,
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      cell: (row) => (
        <span className={styles.number}>{row.cost === null ? '—' : formatRupees(row.cost)}</span>
      ),
    },
    {
      key: 'by',
      header: 'Entered by',
      cell: (row) => <EnteredBy row={row} staffAdded={options.staffAdded} />,
    },
  ];
  return options.canEdit ? [...columns, actionsColumn(options)] : columns;
}
