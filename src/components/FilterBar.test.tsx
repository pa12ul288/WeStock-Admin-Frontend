import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClearUrlParams, useUrlPage } from '../lib/url-state';
import { FilterBar } from './FilterBar';

function Search() {
  return <span data-testid="search">{useLocation().search}</span>;
}

function Actions() {
  const clear = useClearUrlParams(['q', 'farm']);
  const [page, setPage] = useUrlPage();
  return (
    <>
      <button onClick={clear}>Clear</button>
      <button onClick={() => setPage(page + 1)}>Next</button>
    </>
  );
}

const setup = (query = '') =>
  render(
    <MemoryRouter initialEntries={[`/${query}`]}>
      <FilterBar
        searchLabel="Search tag"
        selects={[
          {
            key: 'farm',
            label: 'Farm',
            options: [
              { value: '', label: 'All farms' },
              { value: 'kaveri', label: 'Kaveri Farms' },
            ],
          },
        ]}
      />
      <Search />
      <Actions />
    </MemoryRouter>,
  );

const search = () => screen.getByTestId('search').textContent;
const box = () => screen.getByLabelText('Search tag') as HTMLInputElement;
const type = (value: string) => fireEvent.change(box(), { target: { value } });
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('FilterBar', () => {
  it('waits 300 ms after the last key before changing the URL', () => {
    setup();
    type('ga');
    wait(299);
    expect(search()).toBe('');
    type('gau');
    wait(299);
    expect(search()).toBe('');
    wait(1);
    expect(search()).toBe('?q=gau');
  });

  it('reads its starting values from the URL', () => {
    setup('?q=gauri&farm=kaveri');
    expect(box().value).toBe('gauri');
    expect((screen.getByLabelText('Farm') as HTMLSelectElement).value).toBe('kaveri');
  });

  it('changes the URL straight away for a select, and drops the unfiltered option', () => {
    setup();
    const select = screen.getByLabelText('Farm');
    fireEvent.change(select, { target: { value: 'kaveri' } });
    expect(search()).toBe('?farm=kaveri');
    fireEvent.change(select, { target: { value: '' } });
    expect(search()).toBe('');
  });

  it('goes back to page 1 on any filter change', () => {
    setup('?page=3');
    type('gau');
    wait(300);
    expect(search()).toBe('?q=gau');
  });

  it('keeps a pending search when a select changes before the wait is over', () => {
    setup();
    type('gau');
    wait(100);
    fireEvent.change(screen.getByLabelText('Farm'), { target: { value: 'kaveri' } });
    wait(300);
    expect(new URLSearchParams(search() ?? '').get('q')).toBe('gau');
    expect(new URLSearchParams(search() ?? '').get('farm')).toBe('kaveri');
  });

  it('keeps the space while someone is typing two words', () => {
    setup();
    type('shree ');
    wait(300);
    expect(box().value).toBe('shree ');
  });

  it('treats spaces alone as no search', () => {
    setup();
    type('   ');
    wait(300);
    expect(search()).toBe('');
  });

  it('empties the box when the filters are cleared', () => {
    setup('?q=gauri&farm=kaveri&page=2');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(search()).toBe('');
    expect(box().value).toBe('');
    wait(300);
    expect(search()).toBe('');
  });

  it('keeps the filters when the page changes', () => {
    setup('?q=gauri');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(search()).toBe('?q=gauri&page=2');
    expect(box().value).toBe('gauri');
  });
});
