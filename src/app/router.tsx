import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
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

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'farmers', element: <FarmersPage /> },
      { path: 'farms/:id', element: <FarmPage /> },
      { path: 'livestock', element: <LivestockPage /> },
      { path: 'animals/:id', element: <AnimalPage /> },
      { path: 'reproduction', element: <ReproductionPage /> },
      { path: 'milk-feed', element: <MilkFeedPage /> },
      { path: 'health', element: <HealthPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'staff', element: <StaffPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
