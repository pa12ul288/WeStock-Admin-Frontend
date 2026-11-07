import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { MilkFeedPage } from './MilkFeedPage';

const source = vi.hoisted(() => ({
  listMilk: vi.fn(),
  listFeed: vi.fn(),
  milkDaily: vi.fn(),
  feedDaily: vi.fn(),
  listFarms: vi.fn(),
  listAudit: vi.fn(),
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
          <MilkFeedPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function othersAnswer() {
  source.listFarms.mockResolvedValue(NO_ROWS);
  source.listAudit.mockResolvedValue([]);
  source.milkDaily.mockResolvedValue([]);
  source.feedDaily.mockResolvedValue([]);
  source.listFeed.mockResolvedValue(NO_ROWS);
  source.listMilk.mockResolvedValue(NO_ROWS);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Milk & feed states', () => {
  it('shows skeletons while loading', () => {
    othersAnswer();
    source.milkDaily.mockReturnValue(new Promise(() => undefined));
    source.listMilk.mockReturnValue(new Promise(() => undefined));
    renderAt('/milk-feed');
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
    expect(screen.getByTestId('chart-skeleton')).toBeTruthy();
  });

  it('shows the errors with a retry when things fail', async () => {
    othersAnswer();
    source.milkDaily.mockRejectedValue(new Error('down'));
    source.feedDaily.mockRejectedValue(new Error('down'));
    source.listMilk.mockRejectedValue(new Error('down'));
    renderAt('/milk-feed');
    expect(await screen.findByText("Couldn't load these entries.")).toBeTruthy();
    expect(await screen.findByText("Couldn't load the milk chart.")).toBeTruthy();
    expect(await screen.findByText("Couldn't load the feed totals.")).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBe(3);
  });

  it('says when nothing is logged, and offers Clear filters only with a farm', async () => {
    othersAnswer();
    const { unmount } = renderAt('/milk-feed');
    expect(await screen.findByText('No entries yet')).toBeTruthy();
    expect(await screen.findByText('No milk logged in these 7 days')).toBeTruthy();
    expect(await screen.findByText('No feed logged yesterday')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    unmount();

    renderAt('/milk-feed?farm=x');
    expect(await screen.findByText('No entries for this farm')).toBeTruthy();
    expect(screen.getByText('Pick another farm or add an entry.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });

  it('opens on the tab and view in the URL', async () => {
    othersAnswer();
    renderAt('/milk-feed?tab=feed&period=monthly');
    expect(await screen.findByRole('table', { name: 'Feed entries' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Monthly' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(await screen.findByText('No milk logged in these months')).toBeTruthy();
    expect(source.listMilk).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String) }),
    );
  });
});
