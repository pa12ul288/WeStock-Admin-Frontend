import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import type { AdminStaff, AuditLogEntry } from '../../data/types';
import { StaffPage } from './StaffPage';

const source = vi.hoisted(() => ({
  listStaff: vi.fn(),
  listAudit: vi.fn(),
  listFarms: vi.fn(),
  listAnimals: vi.fn(),
  auth: { currentStaff: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('../../data', () => ({ dataSource: source }));

const NO_ROWS = { rows: [], total: 0 };
const PRIYA: AdminStaff = {
  user_id: 's2',
  full_name: 'Priya Sharma',
  email: 'priya@brainwired.demo',
  role: 'support',
  status: 'active',
  invited_by: null,
  created_at: '2026-01-01T00:00:00Z',
  last_active_at: '2026-01-01T00:00:00Z',
};

function entry(id: number): AuditLogEntry {
  return {
    id,
    at: new Date().toISOString(),
    staff_id: 's2',
    staff_name: 'Priya Sharma',
    action: 'update',
    table_name: 'farms',
    record_id: 'f1',
    farm_id: 'f1',
    changes: { district: { from: null, to: 'Anand' } },
    note: 'Filled in from the farmer’s address',
  };
}

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <StaffPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function othersAnswer() {
  source.listStaff.mockResolvedValue([PRIYA]);
  source.listAudit.mockResolvedValue([]);
  source.listFarms.mockResolvedValue({ rows: [{ id: 'f1', name: 'Gir Gau Shala' }], total: 1 });
  source.listAnimals.mockResolvedValue(NO_ROWS);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Staff & activity log states', () => {
  it('shows skeletons while loading', () => {
    othersAnswer();
    source.listStaff.mockReturnValue(new Promise(() => undefined));
    source.listAudit.mockReturnValue(new Promise(() => undefined));
    renderAt('/staff');
    expect(screen.getAllByTestId('skeleton-row').length).toBeGreaterThan(0);
  });

  it('shows the errors with a retry', async () => {
    othersAnswer();
    source.listStaff.mockRejectedValue(new Error('down'));
    source.listAudit.mockRejectedValue(new Error('down'));
    renderAt('/staff');
    expect(await screen.findByText("Couldn't load the staff list.")).toBeTruthy();
    expect(await screen.findByText("Couldn't load the activity log.")).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Try again' }).length).toBe(2);
  });

  it('says when nothing matches, and offers Clear filters only with a filter', async () => {
    othersAnswer();
    const { unmount } = renderAt('/staff');
    expect(await screen.findByText('No changes yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    unmount();

    renderAt('/staff?action=deleted&period=30');
    expect(await screen.findByText('No changes match these filters')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
    expect(source.listAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete' }));
  });

  it('shows a change in plain words, and no management controls without the role', async () => {
    othersAnswer();
    source.listAudit.mockResolvedValue([entry(2), entry(1)]);
    renderAt('/staff');
    expect(
      (await screen.findAllByText('Filled in from the farmer’s address', {}, { timeout: 3000 }))
        .length,
    ).toBe(2);
    expect(screen.getAllByText('Gir Gau Shala').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Anand').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Invite staff' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /Role for/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
  });
});
