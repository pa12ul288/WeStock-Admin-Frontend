import { formatCount } from '../lib/format';
import styles from './Pagination.module.css';

export const PAGE_SIZE = 20;

/** The page numbers to show, `null` being a gap: 1 2 3 … 1,580, plus the current page if between. */
export function pageItems(page: number, pageCount: number): (number | null)[] {
  const numbers =
    pageCount <= 4 ? Array.from({ length: pageCount }, (_, i) => i + 1) : [1, 2, 3, pageCount];
  if (pageCount > 4 && page > 3 && page < pageCount) numbers.splice(3, 0, page);
  return numbers.flatMap((n, i) => (i > 0 && n - (numbers[i - 1] as number) > 1 ? [null, n] : [n]));
}

interface PaginationProps {
  /** 1-based. */
  page: number;
  total: number;
  pageSize?: number;
  /** After the count: "Showing 1–20 of 66 farms". */
  noun?: string;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  noun,
  onPageChange,
}: PaginationProps) {
  const pageCount = Math.ceil(total / pageSize);
  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const first = (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, total);
  const range = `${formatCount(first)}–${formatCount(last)}`;
  const count =
    total === 0
      ? 'No matches'
      : `Showing ${range} of ${formatCount(total)}${noun ? ` ${noun}` : ''}`;

  return (
    <div className={styles.bar}>
      <span className={styles.count}>{count}</span>
      {pageCount > 1 && (
        <nav className={styles.pages} aria-label="Pages">
          <button
            type="button"
            className={styles.page}
            aria-label="Previous page"
            disabled={current === 1}
            onClick={() => onPageChange(current - 1)}
          >
            ‹
          </button>
          {pageItems(current, pageCount).map((item, index) =>
            item === null ? (
              <span key={`gap-${index}`} className={styles.gap} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={styles.page}
                aria-label={`Page ${formatCount(item)}`}
                aria-current={item === current ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {formatCount(item)}
              </button>
            ),
          )}
          <button
            type="button"
            className={styles.page}
            aria-label="Next page"
            disabled={current === pageCount}
            onClick={() => onPageChange(current + 1)}
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}
