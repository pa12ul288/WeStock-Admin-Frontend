import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from './router';

afterEach(cleanup);

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

describe('phase 1 routes', () => {
  it.each([
    ['/login', 'Sign in'],
    ['/', 'Dashboard'],
    ['/farmers', 'Farmers & farms'],
    ['/farms/demo', 'Farm page'],
    ['/livestock', 'Livestock'],
    ['/animals/demo', 'Animal page'],
    ['/reproduction', 'Reproduction'],
    ['/milk-feed', 'Milk & feed'],
    ['/health', 'Health & vaccines'],
    ['/analytics', 'Analytics'],
    ['/staff', 'Staff & activity log'],
  ])('%s shows its title', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
  });

  it('moves between screens from the navigation', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('link', { name: 'Livestock' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Livestock' })).toBeTruthy();
  });
});
