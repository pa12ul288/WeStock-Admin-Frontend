import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import { AnalyticsPage } from './AnalyticsPage';

const source = vi.hoisted(() => ({
  listFarms: vi.fn(),
  getFarm: vi.fn(),
  listAnimals: vi.fn(),
  analyticsSeries: vi.fn(),
  environmentDay: vi.fn(),
  milkDaily: vi.fn(),
  feedDaily: vi.fn(),
  listFeed: vi.fn(),
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
          <AnalyticsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Analytics states', () => {
  it('shows the card skeletons while the farms load', () => {
    source.listFarms.mockReturnValue(new Promise(() => undefined));
    renderAt('/analytics');
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeTruthy();
    expect(screen.getAllByText(/^\d · /).length).toBeGreaterThan(0);
  });

  it('says so, with Try again, when the farms fail', async () => {
    source.listFarms.mockRejectedValue(new Error('boom'));
    renderAt('/analytics');
    expect(await screen.findByText('The farms couldn’t load')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('says so when the farm in the link does not exist', async () => {
    source.listFarms.mockResolvedValue({ rows: [], total: 0 });
    renderAt('/analytics?farm=nope');
    expect(await screen.findByText('We couldn’t find that farm')).toBeTruthy();
  });
});
