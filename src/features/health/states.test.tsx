import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { HealthPage } from './HealthPage';

const source = vi.hoisted(() => ({
  listVaccinations: vi.fn(),
  listHealthEvents: vi.fn(),
  listFarms: vi.fn(),
  listAudit: vi.fn(),
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
          <HealthPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function othersAnswer() {
  source.listFarms.mockResolvedValue(NO_ROWS);
  source.listAudit.mockResolvedValue([]);
  source.species.mockResolvedValue([]);
  source.listVaccinations.mockResolvedValue(NO_ROWS);
  source.listHealthEvents.mockResolvedValue(NO_ROWS);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Health & vaccines states', () => {
  it('shows skeletons while loading', () => {
    othersAnswer();
    source.listVaccinations.mockReturnValue(new Promise(() => undefined));
    renderAt('/health');
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('shows the error with a retry when the list fails', async () => {
    othersAnswer();
    source.listVaccinations.mockRejectedValue(new Error('down'));
    renderAt('/health');
    expect(await screen.findByText("Couldn't load the vaccinations.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('says when nothing is waiting, and offers Clear filters only with a filter', async () => {
    othersAnswer();
    const { unmount } = renderAt('/health');
    expect(await screen.findByText('No vaccinations waiting')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    unmount();

    renderAt('/health?tab=issues&species=goat');
    expect(await screen.findByText('Nothing matches this farm and species')).toBeTruthy();
    expect(screen.getByText('Pick “All farms” or another species.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });

  it('opens on the tab in the URL, and passes the filters on', async () => {
    othersAnswer();
    renderAt('/health?tab=issues&farm=f1&species=buffalo');
    expect(await screen.findByRole('table', { name: 'Health issues' })).toBeTruthy();
    expect(source.listHealthEvents).toHaveBeenCalledWith(
      expect.objectContaining({ farm_id: 'f1', species_id: 'buffalo' }),
    );
    expect(source.listVaccinations).toHaveBeenCalledWith(
      expect.objectContaining({ farm_id: 'f1', species_id: 'buffalo' }),
    );
  });

  it('hides the schedule button from anyone who cannot edit', async () => {
    othersAnswer();
    renderAt('/health');
    await screen.findByText('No vaccinations waiting');
    expect(screen.queryByRole('button', { name: 'Vaccine schedule' })).toBeNull();
  });
});
