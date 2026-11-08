import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import type { SearchHit } from '../data/types';
import { errorMessage } from '../lib/errors';
import { useReducedMotion } from '../lib/motion';
import { popProps } from '../lib/motionProps';
import { useGlobalSearch, useSearchNow } from './queries';
import { useDismiss } from './useDismiss';
import styles from './GlobalSearch.module.css';

const RECENT_KEY = 'westock-admin-recent-search-v1';
const MAX_RECENT = 4;
const TYPING_PAUSE_MS = 200;

const KIND_ICON: Record<SearchHit['kind'], string> = {
  farm: 'M3 21V10l9-6 9 6v11M9 21v-6h6v6M3 21h18',
  farmer: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  animal: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
};

function readRecent(): SearchHit[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as SearchHit[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(hits: SearchHit[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(hits));
  } catch {
    // Recent searches are only a convenience.
  }
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const toast = useToast();
  const listId = useId();
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const term = q.trim();

  const [paused, setPaused] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setPaused(term), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const search = useGlobalSearch(paused);
  const searchNow = useSearchNow();
  const settled = paused === term && !search.isPlaceholderData && !search.isFetching;
  const hits = term === '' ? recent : (search.data ?? []);
  const showList = open && (term !== '' || recent.length > 0);

  useDismiss(showList, () => setOpen(false), box);

  function go(hit: SearchHit) {
    const next = [hit, ...recent.filter((r) => r.id !== hit.id)].slice(0, MAX_RECENT);
    setRecent(next);
    writeRecent(next);
    setQ('');
    setOpen(false);
    setActive(-1);
    input.current?.blur();
    navigate(hit.href);
  }

  async function openFirstHit() {
    try {
      const fresh = await searchNow(term);
      const first = fresh[0];
      // Ignore the answer if the search box has moved on while it was coming.
      if (input.current?.value.trim() !== term) return;
      if (first) go(first);
      else setOpen(true);
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (hits.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => {
        if (index < 0) return step === 1 ? 0 : hits.length - 1;
        return (index + step + hits.length) % hits.length;
      });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = showList ? hits[active] : undefined;
      if (chosen) go(chosen);
      else if (term !== '') void openFirstHit();
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <div
      ref={box}
      className={styles.search}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
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
        ref={input}
        type="search"
        role="combobox"
        aria-label="Go to a farmer, farm or tag number"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[active] ? optionId(active) : undefined}
        placeholder="Go to farm, farmer or tag…"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <AnimatePresence>
        {showList && (
          <m.div
            className={styles.pop}
            id={listId}
            role="listbox"
            aria-label="Search results"
            style={{ transformOrigin: '0 0' }}
            {...popProps(reduced)}
          >
            <span className={styles.heading}>{term === '' ? 'Recent' : 'Results'}</span>
            {hits.map((hit, index) => (
              <Link
                key={`${hit.kind}-${hit.id}`}
                id={optionId(index)}
                to={hit.href}
                role="option"
                aria-selected={index === active}
                className={styles.hit}
                tabIndex={-1}
                onMouseEnter={() => setActive(index)}
                onClick={(event) => {
                  event.preventDefault();
                  go(hit);
                }}
              >
                <span className={styles.icon} data-kind={hit.kind}>
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={KIND_ICON[hit.kind]} />
                  </svg>
                </span>
                <span className={styles.hitText}>
                  <span className={styles.title}>{hit.title}</span>
                  <span className={styles.sub}>{hit.subtitle}</span>
                </span>
              </Link>
            ))}
            {search.isError && term !== '' && (
              <span className={styles.message}>{errorMessage(search.error)}</span>
            )}
            {!search.isError && term !== '' && hits.length === 0 && settled && (
              <span className={styles.message}>No farm, farmer or tag matches “{term}”.</span>
            )}
            {!search.isError && term !== '' && hits.length === 0 && !settled && (
              <span className={styles.message}>Searching…</span>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
