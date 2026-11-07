import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { DataError } from '../../data/errors';
import { LivestockPage } from '../livestock/LivestockPage';
import { AnimalPage } from './AnimalPage';

const source = vi.hoisted(() => ({
  listAnimals: vi.fn(),
  listFarms: vi.fn(),
  listCycles: vi.fn(),
  listHealthEvents: vi.fn(),
  species: vi.fn(),
  getAnimal: vi.fn(),
  auth: { currentStaff: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('../../data', () => ({ dataSource: source }));

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/livestock" element={<LivestockPage />} />
            <Route path="/animals/:id" element={<AnimalPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const NO_ROWS = { rows: [], total: 0 };
const NO_ANIMALS = {
  ...NO_ROWS,
  totals: { active: 0, with_collar: 0, temperature_high: 0, cannot_connect: 0 },
};

function listsAnswer() {
  source.listFarms.mockResolvedValue(NO_ROWS);
  source.listCycles.mockResolvedValue(NO_ROWS);
  source.listHealthEvents.mockResolvedValue(NO_ROWS);
  source.species.mockResolvedValue([]);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Livestock states', () => {
  it('shows skeleton rows while loading', () => {
    listsAnswer();
    source.listAnimals.mockReturnValue(new Promise(() => undefined));
    renderAt('/livestock');
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('shows the error with a retry when the list fails, and keeps export', async () => {
    listsAnswer();
    source.listAnimals.mockRejectedValue(new Error('down'));
    renderAt('/livestock');
    expect(await screen.findByText("Couldn't load the animals.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeTruthy();
  });

  it('offers Clear filters only when something is filtered', async () => {
    listsAnswer();
    source.listAnimals.mockResolvedValue(NO_ANIMALS);
    const { unmount } = renderAt('/livestock');
    expect(await screen.findByText('No animals match these filters')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    unmount();

    renderAt('/livestock?q=zzz');
    expect(await screen.findByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });

  it('asks only for active animals unless told otherwise', async () => {
    listsAnswer();
    source.listAnimals.mockResolvedValue(NO_ANIMALS);
    renderAt('/livestock');
    await screen.findByText('No animals match these filters');
    expect(source.listAnimals).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', pageSize: 20 }),
    );
  });

  it('asks for every status with status=all', async () => {
    listsAnswer();
    source.listAnimals.mockResolvedValue(NO_ANIMALS);
    renderAt('/livestock?status=all');
    await screen.findByText('No animals match these filters');
    expect(source.listAnimals).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, pageSize: 20 }),
    );
  });
});

describe('Animal page states', () => {
  it('shows a skeleton while loading', () => {
    source.getAnimal.mockReturnValue(new Promise(() => undefined));
    renderAt('/animals/x');
    expect(screen.getByTestId('animal-skeleton')).toBeTruthy();
  });

  it('shows an error with a retry', async () => {
    source.getAnimal.mockRejectedValue(new Error('down'));
    renderAt('/animals/x');
    expect(
      await screen.findByRole('button', { name: 'Try again' }, { timeout: 8000 }),
    ).toBeTruthy();
    expect(screen.getByText("Couldn't load this animal.")).toBeTruthy();
  }, 15_000);

  it('says so when the animal is gone, without retrying', async () => {
    source.getAnimal.mockRejectedValue(new DataError('not_found'));
    renderAt('/animals/x');
    expect(
      await screen.findByRole('heading', { name: "This animal isn't in the app" }),
    ).toBeTruthy();
    expect(source.getAnimal).toHaveBeenCalledTimes(1);
  });
});
