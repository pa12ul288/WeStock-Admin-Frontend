import { useEffect, useState, type ReactNode } from 'react';
import { useUrlState } from '../lib/url-state';
import styles from './FilterBar.module.css';

const DEBOUNCE_MS = 300;

export interface FilterSelect {
  /** The URL query key. */
  key: string;
  /** The select's accessible name. */
  label: string;
  /** The option with `value: ''` is the unfiltered one, and keeps the key out of the URL. */
  options: readonly { value: string; label: string }[];
}

interface FilterBarProps {
  /** The search box's placeholder and accessible name. Leave out for no search box. */
  searchLabel?: string;
  /** The URL query key for the search box. */
  searchKey?: string;
  selects?: readonly FilterSelect[];
  /** Goes above the filters: the Segmented tabs on Livestock, say. */
  lead?: ReactNode;
}

function SearchBox({ label, urlKey }: { label: string; urlKey: string }) {
  const [values, setValues] = useUrlState({ [urlKey]: '' });
  const urlValue = values[urlKey] ?? '';
  const [text, setText] = useState(urlValue);
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue);

  // Clear filters or the back button changed the URL: the box follows it.
  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue);
    setText(urlValue);
  }

  const wanted = text.trim() === '' ? '' : text;
  useEffect(() => {
    if (wanted === urlValue) return;
    const timer = setTimeout(() => {
      setValues({ [urlKey]: wanted }, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [wanted, urlValue, urlKey, setValues]);

  return (
    <label className={styles.search}>
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </label>
  );
}

function SelectFilter({ select }: { select: FilterSelect }) {
  const [values, setValues] = useUrlState({ [select.key]: '' });
  return (
    <select
      className={styles.select}
      aria-label={select.label}
      value={values[select.key] ?? ''}
      onChange={(event) => setValues({ [select.key]: event.target.value })}
    >
      {select.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** A debounced search box plus selects, all kept in the URL query. Any change returns to page 1. */
export function FilterBar({ searchLabel, searchKey = 'q', selects = [], lead }: FilterBarProps) {
  return (
    <div className={styles.bar}>
      {lead}
      <div className={styles.filters}>
        {searchLabel && <SearchBox label={searchLabel} urlKey={searchKey} />}
        {selects.map((select) => (
          <SelectFilter key={select.key} select={select} />
        ))}
      </div>
    </div>
  );
}
