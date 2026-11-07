import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTable, sortRows, type Column } from './DataTable';

afterEach(cleanup);

interface Row {
  id: string;
  name: string;
  date: string | null;
}

const rows: Row[] = [
  { id: 'a', name: 'Gauri', date: '2026-11-03' },
  { id: 'b', name: 'Kali', date: null },
  { id: 'c', name: 'Valli', date: '2026-11-05' },
];

const columns: Column<Row>[] = [
  { key: 'name', header: 'Animal', cell: (row) => row.name },
  { key: 'date', header: 'Last entry', cell: (row) => row.date, sortValue: (row) => row.date },
];

const table = (props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) => (
  <MemoryRouter>
    <DataTable label="Animals" columns={columns} rows={rows} rowKey={(row) => row.id} {...props} />
  </MemoryRouter>
);

const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('td')?.textContent);

describe('sortRows', () => {
  it('leaves the order alone with no sort', () => {
    expect(sortRows(rows, columns, undefined)).toBe(rows);
  });

  it('sorts both ways and keeps missing dates last', () => {
    const ids = (dir: 'asc' | 'desc') =>
      sortRows(rows, columns, { key: 'date', dir }).map((row) => row.id);
    expect(ids('desc')).toEqual(['c', 'a', 'b']);
    expect(ids('asc')).toEqual(['a', 'c', 'b']);
  });

  it('does not change the rows it was given', () => {
    sortRows(rows, columns, { key: 'date', dir: 'desc' });
    expect(rows[0]?.id).toBe('a');
  });
});

describe('DataTable', () => {
  it('shows rows in the given sort and marks the header', () => {
    render(table({ sort: { key: 'date', dir: 'desc' }, onSortChange: vi.fn() }));
    expect(names()).toEqual(['Valli', 'Gauri', 'Kali']);
    expect(screen.getByRole('columnheader', { name: 'Last entry' }).getAttribute('aria-sort')).toBe(
      'descending',
    );
  });

  it('only dated columns get a sort button', () => {
    render(table({ sort: { key: 'date', dir: 'desc' }, onSortChange: vi.fn() }));
    expect(screen.queryByRole('button', { name: 'Animal' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Last entry' })).toBeTruthy();
  });

  it('flips the direction on a click, starting from newest', async () => {
    const onSortChange = vi.fn();
    const { unmount } = render(table({ sort: { key: 'date', dir: 'desc' }, onSortChange }));
    await userEvent.click(screen.getByRole('button', { name: 'Last entry' }));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'date', dir: 'asc' });
    unmount();
    render(table({ sort: { key: 'name', dir: 'asc' }, onSortChange }));
    await userEvent.click(screen.getByRole('button', { name: 'Last entry' }));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'date', dir: 'desc' });
  });

  it('shows skeleton rows and no data while loading', () => {
    render(table({ loading: true, skeletonRows: 4 }));
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(4);
    expect(screen.queryByText('Gauri')).toBeNull();
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
  });

  it('shows the empty state, and Clear filters calls back', async () => {
    const onClearFilters = vi.fn();
    render(table({ rows: [], emptyTitle: 'No animals match these filters', onClearFilters }));
    expect(screen.getByText('No animals match these filters')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('does not show the empty state while loading', () => {
    render(table({ rows: [], loading: true }));
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('shows an error with a retry in place of the rows', async () => {
    const onRetry = vi.fn();
    render(table({ error: "Couldn't load.", onRetry }));
    expect(within(screen.getByRole('alert')).getByText("Couldn't load.")).toBeTruthy();
    expect(screen.queryByText('Gauri')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  describe('row links', () => {
    const inRouter = () => {
      const router = createMemoryRouter([
        {
          path: '/',
          element: (
            <DataTable
              label="Animals"
              columns={[
                ...columns,
                {
                  key: 'act',
                  header: 'Actions',
                  cell: () => <button type="button">Fix</button>,
                },
              ]}
              rows={rows}
              rowKey={(row) => row.id}
              rowLink={{
                href: (row) => `/animals/${row.id}`,
                label: (row) => `Open ${row.name}`,
              }}
            />
          ),
        },
        { path: '/animals/:id', element: <h1>Animal page</h1> },
      ]);
      render(<RouterProvider router={router} />);
    };

    it('gives each row a named link', () => {
      inRouter();
      expect(screen.getByRole('link', { name: 'Open Gauri' }).getAttribute('href')).toBe(
        '/animals/a',
      );
    });

    it('opens from a click on the row', async () => {
      inRouter();
      await userEvent.click(screen.getByText('Valli'));
      expect(await screen.findByRole('heading', { name: 'Animal page' })).toBeTruthy();
    });

    it('leaves buttons in the row alone', async () => {
      inRouter();
      await userEvent.click(screen.getAllByRole('button', { name: 'Fix' })[0] as HTMLElement);
      expect(screen.queryByRole('heading', { name: 'Animal page' })).toBeNull();
    });
  });
});
