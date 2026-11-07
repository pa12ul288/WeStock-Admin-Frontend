import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { dataSource } from '../data';
import { FEATURED } from '../data/demo/featured';
import { AppProviders } from './Providers';
import { routes } from './router';

afterEach(cleanup);

function renderAt(path: string) {
  render(
    <AppProviders>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </AppProviders>,
  );
}

const h1 = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('signed out', () => {
  it('shows the sign-in page', async () => {
    renderAt('/login');
    expect(await h1('Sign in')).toBeTruthy();
  });

  it('sends protected screens to sign-in', async () => {
    renderAt('/livestock');
    expect(await h1('Sign in')).toBeTruthy();
  });
});

describe('phase 1 routes, signed in', () => {
  beforeAll(async () => {
    await dataSource.auth.signIn('anjali@brainwired.demo', 'password');
  });
  afterAll(async () => {
    await dataSource.auth.signOut();
  });

  it.each([
    ['/', 'Dashboard', 'Overview'],
    ['/farmers', 'Farmers & farms', 'Farms'],
    [`/farms/${FEATURED.farms.shreeGanesh}`, 'Shree Ganesh Dairy', 'Farmers & farms'],
    ['/livestock', 'Livestock', 'Farms'],
    ['/animals/demo', 'Animal page', 'Livestock'],
    ['/reproduction', 'Reproduction', 'Records'],
    ['/milk-feed', 'Milk & feed', 'Records'],
    ['/health', 'Health & vaccines', 'Records'],
    ['/analytics', 'Analytics', 'Insights'],
    ['/staff', 'Staff & activity log', 'Admin'],
  ])('%s shows its title and breadcrumb', async (path, title, crumb) => {
    renderAt(path);
    expect(await h1(title)).toBeTruthy();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb.textContent).toBe(`${crumb}${title}`);
  });

  it('moves between screens from the navigation', async () => {
    renderAt('/');
    await h1('Dashboard');
    await userEvent.click(screen.getByRole('link', { name: /^Livestock/ }));
    expect(await h1('Livestock')).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Livestock/ }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('marks the parent item active on a record page', async () => {
    renderAt('/animals/demo');
    await h1('Animal page');
    expect(screen.getByRole('link', { name: /^Livestock/ }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('leaves /login for the dashboard', async () => {
    renderAt('/login');
    expect(await h1('Dashboard')).toBeTruthy();
  });
});
