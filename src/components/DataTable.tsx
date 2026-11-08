import { useEffect, useMemo, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { SortState } from '../lib/url-state';
import { iconButtonClass } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import styles from './DataTable.module.css';

type SortValue = string | number | null | undefined;

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: 'left' | 'right';
  hideOnPhone?: boolean;
  /** Makes the column sortable (dated columns): the value to compare. Missing values go last. */
  sortValue?: (row: Row) => SortValue;
  /** Keeps the header for screen readers only. */
  hideHeader?: boolean;
  /** Shrinks the column to its content. */
  shrink?: boolean;
}

interface DataTableProps<Row> {
  /** The table's accessible name. */
  label: string;
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  skeletonRows?: number;
  /** A message in place of the rows when the list couldn't load. */
  error?: string;
  onRetry?: () => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Adds the chevron link at the end of each row; a click anywhere else in the row opens it too. */
  rowLink?: { href: (row: Row) => string; label: (row: Row) => string };
  emptyTitle?: string;
  emptyNote?: ReactNode;
  /** The "Clear filters" action in the empty state. */
  onClearFilters?: () => void;
}

/**
 * Keeps the header in view as the page scrolls. CSS sticky can't do this here: the wrapper that
 * scrolls the table sideways would become what the header sticks to, instead of the page.
 */
function useStickyHead() {
  const scroller = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!scroller.current || !head.current) return;
      const box = scroller.current.getBoundingClientRect();
      const offset = Math.max(0, Math.min(-box.top, box.height - head.current.offsetHeight));
      head.current.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return { scroller, head };
}

const isMissing = (value: SortValue) => value === null || value === undefined || value === '';

/** The rows in the chosen order. Rows with no value stay at the end in both directions. */
export function sortRows<Row>(
  rows: readonly Row[],
  columns: readonly Column<Row>[],
  sort: SortState | undefined,
): readonly Row[] {
  const value = columns.find((column) => column.key === sort?.key)?.sortValue;
  if (!value || !sort) return rows;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((rowA, rowB) => {
    const a = value(rowA) as string | number;
    const b = value(rowB) as string | number;
    if (isMissing(a) || isMissing(b)) return Number(isMissing(a)) - Number(isMissing(b));
    if (a === b) return 0;
    return a < b ? -sign : sign;
  });
}

function SortIcon({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <svg
      aria-hidden="true"
      className={styles.sortIcon}
      data-active={dir !== null}
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={dir === 'asc' ? 'M12 20V5M5 12l7-7 7 7' : 'M12 4v15M5 12l7 7 7-7'} />
    </svg>
  );
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const SKELETON_WIDTHS = ['70%', '85%', '60%', '75%', '55%'];

export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 8,
  error,
  onRetry,
  sort,
  onSortChange,
  rowLink,
  emptyTitle,
  emptyNote,
  onClearFilters,
}: DataTableProps<Row>) {
  const { scroller, head } = useStickyHead();
  const navigate = useNavigate();
  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const showRows = !loading && !error;

  const cellClass = (column: Column<Row>) =>
    [
      column.align === 'right' ? styles.right : '',
      column.hideOnPhone ? styles.hideOnPhone : '',
      column.shrink ? styles.shrink : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  function openRow(event: MouseEvent, row: Row) {
    if (!rowLink) return;
    const target = event.target;
    if (target instanceof Element && target.closest('a, button, input, select, label')) return;
    if (window.getSelection()?.toString()) return;
    navigate(rowLink.href(row));
  }

  return (
    <div
      ref={scroller}
      className={styles.scroller}
      tabIndex={0}
      role="region"
      aria-label={`${label}, scrolls sideways`}
    >
      <table className={styles.table} aria-label={label} aria-busy={loading}>
        <thead ref={head} className={styles.head}>
          <tr>
            {columns.map((column) => {
              const current = sort?.key === column.key ? sort.dir : null;
              const sortable = Boolean(column.sortValue && onSortChange);
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cellClass(column)}
                  aria-sort={sortable ? (current ? ARIA_SORT[current] : 'none') : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={styles.sortButton}
                      onClick={() =>
                        onSortChange?.({
                          key: column.key,
                          dir: current === 'desc' ? 'asc' : 'desc',
                        })
                      }
                    >
                      {column.header}
                      <SortIcon dir={current} />
                    </button>
                  ) : column.hideHeader ? (
                    <span className={styles.srOnly}>{column.header}</span>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
            {rowLink && (
              <th scope="col" className={styles.shrink}>
                <span className={styles.srOnly}>Open</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <tr key={rowIndex} data-testid="skeleton-row">
                {columns.map((column, columnIndex) => (
                  <td key={column.key} className={cellClass(column)}>
                    <Skeleton
                      width={SKELETON_WIDTHS[(rowIndex + columnIndex) % SKELETON_WIDTHS.length]}
                    />
                  </td>
                ))}
                {rowLink && (
                  <td className={styles.shrink}>
                    <Skeleton width={34} height={34} radius={10} />
                  </td>
                )}
              </tr>
            ))}
          {showRows &&
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className={rowLink ? styles.linked : undefined}
                onClick={rowLink ? (event) => openRow(event, row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    {column.cell(row)}
                  </td>
                ))}
                {rowLink && (
                  <td className={`${styles.right} ${styles.shrink}`}>
                    <Link
                      to={rowLink.href(row)}
                      className={iconButtonClass}
                      aria-label={rowLink.label(row)}
                    >
                      <svg
                        aria-hidden="true"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>
      {error && (
        <div className={styles.message} role="alert">
          <EmptyState title={error} onAction={onRetry} actionLabel="Try again" />
        </div>
      )}
      {showRows && rows.length === 0 && (
        <div className={styles.message}>
          <EmptyState title={emptyTitle} note={emptyNote} onAction={onClearFilters} />
        </div>
      )}
    </div>
  );
}
