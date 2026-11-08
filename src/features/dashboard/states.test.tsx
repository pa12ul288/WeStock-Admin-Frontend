import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import type { AdminStaff, Overview } from '../../data/types';
import { DataError } from '../../data/errors';
import { DashboardPage } from './DashboardPage';

const source = vi.hoisted(() => ({
  getOverview: vi.fn(),
  listStaff: vi.fn(),
  listAudit: vi.fn(),
  listFarms: vi.fn(),
  auth: { currentStaff: vi.fn() },
}));

vi.mock('../../data', () => ({ dataSource: source }));

function staff(role: AdminStaff['role']): AdminStaff {
  return {
    user_id: 's1',
    full_name: 'Anjali Menon',
    email: 'anjali@brainwired.demo',
    role,
    status: 'active',
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
    last_active_at: '2026-01-01T00:00:00Z',
  };
}

const OVERVIEW: Overview = {
  farmers: 60,
  farms: 66,
  farms_with_blackbox: 12,
  active_animals: 902,
  milk_yesterday: 4139,
  milk_yesterday_trend_pct: 1,
  period: {
    days: 30,
    milk_litres: 120000,
    milk_trend_pct: 6,
    feed_kg: 300000,
    feed_trend_pct: -2,
    vaccines_given: 40,
    vaccines_trend_pct: 0,
  },
  needs_attention: {
    golden_ending_6h: 3,
    vaccines_overdue: 20,
    animals_sick: 4,
    may_deliver_7d: 2,
    farms_quiet_3d: 1,
  },
  milk_per_day: [],
  farms_needing_attention: [],
  species_counts: [{ species_id: 'cattle', category: 'large_ruminant', animals: 902 }],
  farmers_by_language: [{ language: 'hi', farmers: 60 }],
  recent_changes: [],
};

function renderPage(role: AdminStaff['role'] = 'super_admin') {
  source.auth.currentStaff.mockResolvedValue(staff(role));
  source.listStaff.mockResolvedValue([]);
  source.listFarms.mockResolvedValue({ rows: [], total: 0 });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Dashboard states', () => {
  it('shows skeletons while loading', () => {
    source.getOverview.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('shows a message with Try again when the overview fails', async () => {
    source.getOverview.mockRejectedValue(new DataError('not_allowed'));
    renderPage();
    expect(await screen.findByText('The dashboard couldn’t load')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('says so when no farm needs attention and no staff changed anything', async () => {
    source.getOverview.mockResolvedValue(OVERVIEW);
    renderPage();
    expect(await screen.findByText('No farm needs attention today')).toBeTruthy();
    expect(await screen.findByText('No staff changes yet.')).toBeTruthy();
    expect(screen.getByText('20 still overdue across all farms')).toBeTruthy();
  });

  it.each([
    ['super_admin', 1],
    ['support', 0],
    ['viewer', 0],
  ] as const)('shows Invite staff to %s: %i', async (role, count) => {
    source.getOverview.mockResolvedValue(OVERVIEW);
    renderPage(role);
    await screen.findByText('Registered in the app');
    await screen.findByRole('heading', { level: 1, name: 'Anjali, here is every farm' });
    expect(screen.queryAllByRole('button', { name: 'Invite staff' })).toHaveLength(count);
    expect(screen.getByRole('link', { name: 'Analytics' })).toBeTruthy();
  });
});
