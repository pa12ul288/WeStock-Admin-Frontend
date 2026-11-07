import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { DataError } from '../../data/errors';
import { FarmersPage } from '../farmers/FarmersPage';
import { FarmPage } from './FarmPage';

const failing = vi.hoisted(() => ({
  listFarmers: vi.fn(),
  listFarms: vi.fn(),
  getFarm: vi.fn(),
  auth: { currentStaff: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('../../data', () => ({ dataSource: failing }));

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/farmers" element={<FarmersPage />} />
            <Route path="/farms/:id" element={<FarmPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Farmers & farms states', () => {
  it('shows skeleton rows while loading', () => {
    failing.listFarmers.mockReturnValue(new Promise(() => undefined));
    failing.listFarms.mockReturnValue(new Promise(() => undefined));
    renderAt('/farmers');
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('shows the error with a retry when the list fails', async () => {
    failing.listFarmers.mockRejectedValue(new Error('down'));
    failing.listFarms.mockResolvedValue({ rows: [], total: 0 });
    renderAt('/farmers');
    expect(await screen.findByText("Couldn't load the farmers.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeTruthy();
  });

  it('shows an empty list with no clear button when nothing is filtered', async () => {
    failing.listFarmers.mockResolvedValue({ rows: [], total: 0 });
    failing.listFarms.mockResolvedValue({ rows: [], total: 0 });
    renderAt('/farmers');
    expect(await screen.findByText('Nothing matches these filters')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });
});

describe('Farm page states', () => {
  it('shows a skeleton while loading', () => {
    failing.getFarm.mockReturnValue(new Promise(() => undefined));
    renderAt('/farms/x');
    expect(screen.getByTestId('farm-skeleton')).toBeTruthy();
  });

  it('shows an error with a retry, and retries', async () => {
    failing.getFarm.mockRejectedValue(new Error('down'));
    renderAt('/farms/x');
    const retry = await screen.findByRole('button', { name: 'Try again' }, { timeout: 8000 });
    expect(screen.getByText("Couldn't load this farm.")).toBeTruthy();
    const calls = failing.getFarm.mock.calls.length;
    retry.click();
    await waitFor(() => expect(failing.getFarm.mock.calls.length).toBeGreaterThan(calls));
  }, 15_000);

  it('says so when the farm is gone, without retrying', async () => {
    failing.getFarm.mockRejectedValue(new DataError('not_found'));
    renderAt('/farms/x');
    expect(await screen.findByRole('heading', { name: "This farm isn't in the app" })).toBeTruthy();
    expect(failing.getFarm).toHaveBeenCalledTimes(1);
  });
});
