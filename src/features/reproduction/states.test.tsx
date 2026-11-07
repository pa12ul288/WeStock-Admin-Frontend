import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { ReproductionPage } from './ReproductionPage';

const source = vi.hoisted(() => ({
  listCycles: vi.fn(),
  listFarms: vi.fn(),
  listAudit: vi.fn(),
  listAnimals: vi.fn(),
  species: vi.fn(),
  auth: { currentStaff: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('../../data', () => ({ dataSource: source }));

const NO_ROWS = { rows: [], total: 0 };

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <ReproductionPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function othersAnswer() {
  source.listFarms.mockResolvedValue(NO_ROWS);
  source.listAudit.mockResolvedValue([]);
  source.listAnimals.mockResolvedValue(NO_ROWS);
  source.species.mockResolvedValue([]);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Reproduction states', () => {
  it('shows skeletons while loading', () => {
    othersAnswer();
    source.listCycles.mockReturnValue(new Promise(() => undefined));
    renderAt('/reproduction');
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(screen.getByTestId('golden-skeleton')).toBeTruthy();
  });

  it('shows the errors with a retry when the lists fail', async () => {
    othersAnswer();
    source.listCycles.mockRejectedValue(new Error('down'));
    renderAt('/reproduction');
    expect(await screen.findByText("Couldn't load this list.")).toBeTruthy();
    expect(await screen.findByText("Couldn't load the golden periods.")).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBe(2);
  });

  it('offers Clear filters only when a farm is picked', async () => {
    othersAnswer();
    source.listCycles.mockResolvedValue(NO_ROWS);
    const { unmount } = renderAt('/reproduction');
    expect(await screen.findByText('Nothing here right now')).toBeTruthy();
    expect(await screen.findByText('No golden periods right now')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    unmount();

    renderAt('/reproduction?farm=x');
    expect(await screen.findByText('Nothing here for this farm')).toBeTruthy();
    expect(await screen.findByText('No golden periods on this farm right now')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });

  it('asks for the stage in the URL and falls back to heat', async () => {
    othersAnswer();
    source.listCycles.mockResolvedValue(NO_ROWS);
    renderAt('/reproduction?stage=nonsense');
    await screen.findByText('Nothing here right now');
    expect(source.listCycles).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'heat', pageSize: 20 }),
    );
  });
});
