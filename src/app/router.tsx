import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AuthGate } from './AuthGate';
import type { ShellHandle } from './breadcrumb';
import { AnalyticsPage } from '../features/analytics/AnalyticsPage';
import { AnimalPage } from '../features/animal/AnimalPage';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { FarmPage } from '../features/farm/FarmPage';
import { FarmersPage } from '../features/farmers/FarmersPage';
import { HealthPage } from '../features/health/HealthPage';
import { LivestockPage } from '../features/livestock/LivestockPage';
import { MilkFeedPage } from '../features/milk-feed/MilkFeedPage';
import { ReproductionPage } from '../features/reproduction/ReproductionPage';
import { StaffPage } from '../features/staff/StaffPage';

const shell = (crumb: string, page: string, nav: ShellHandle['nav']): ShellHandle => ({
  crumb,
  page,
  nav,
});

// import.meta.env.DEV is false in `vite build`, so the gallery and its import leave the bundle.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/components',
        lazy: async () => {
          const { ComponentsPage } = await import('../features/dev/ComponentsPage');
          return { Component: ComponentsPage };
        },
        handle: shell('Dev', 'Components', null),
      },
    ]
  : [];

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
        handle: shell('Overview', 'Dashboard', 'overview'),
      },
      {
        path: 'farmers',
        element: <FarmersPage />,
        handle: shell('Farms', 'Farmers & farms', 'farmers'),
      },
      {
        path: 'farms/:id',
        element: <FarmPage />,
        handle: shell('Farmers & farms', 'Farm page', 'farmers'),
      },
      {
        path: 'livestock',
        element: <LivestockPage />,
        handle: shell('Farms', 'Livestock', 'livestock'),
      },
      {
        path: 'animals/:id',
        element: <AnimalPage />,
        handle: shell('Livestock', 'Animal page', 'livestock'),
      },
      {
        path: 'reproduction',
        element: <ReproductionPage />,
        handle: shell('Records', 'Reproduction', 'reproduction'),
      },
      {
        path: 'milk-feed',
        element: <MilkFeedPage />,
        handle: shell('Records', 'Milk & feed', 'milk'),
      },
      {
        path: 'health',
        element: <HealthPage />,
        handle: shell('Records', 'Health & vaccines', 'health'),
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
        handle: shell('Insights', 'Analytics', 'analytics'),
      },
      {
        path: 'staff',
        element: <StaffPage />,
        handle: shell('Admin', 'Staff & activity log', 'staff'),
      },
      ...devRoutes,
    ],
  },
];

export const router = createBrowserRouter(routes);
