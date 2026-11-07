import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dataSource } from '../data';
import { useStaff } from '../features/auth/queries';
import { CAN_ADMINISTER, CAN_EDIT, RoleGate } from './RoleGate';

afterEach(cleanup);

function Probe() {
  const staff = useStaff();
  return (
    <>
      <span>{staff ? `role:${staff.role}` : 'waiting'}</span>
      <RoleGate allow={CAN_EDIT}>can edit</RoleGate>
      <RoleGate allow={CAN_ADMINISTER} fallback="not admin">
        can administer
      </RoleGate>
    </>
  );
}

function renderProbe() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Probe />
    </QueryClientProvider>,
  );
}

describe('RoleGate', () => {
  beforeAll(async () => {
    await dataSource.auth.signIn('anjali@brainwired.demo', 'password');
  });
  afterAll(async () => {
    await dataSource.auth.signOut();
  });

  it('shows everything to a super admin', async () => {
    await dataSource.auth.setDemoRole?.('super_admin');
    renderProbe();
    await screen.findByText(/role:super_admin/);
    expect(document.body.textContent).toContain('can edit');
    expect(document.body.textContent).toContain('can administer');
  });

  it('hides admin controls from support', async () => {
    await dataSource.auth.setDemoRole?.('support');
    renderProbe();
    await screen.findByText(/role:support/);
    expect(document.body.textContent).toContain('can edit');
    expect(document.body.textContent).toContain('not admin');
    expect(document.body.textContent).not.toContain('can administer');
  });

  it('hides editing from a viewer', async () => {
    await dataSource.auth.setDemoRole?.('viewer');
    renderProbe();
    await screen.findByText(/role:viewer/);
    expect(document.body.textContent).not.toContain('can edit');
  });
});
