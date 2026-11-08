import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { installDatePicker } from '../lib/datePicker';
import { MotionProvider } from './MotionProvider';
import { router } from './router';

/** Everything the screens need above them, without the router, so tests can bring their own. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => installDatePicker(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <ToastProvider>{children}</ToastProvider>
      </MotionProvider>
    </QueryClientProvider>
  );
}

export function Providers() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
