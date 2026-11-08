import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Providers } from './app/Providers';
import './styles/tokens.css';
import './styles/global.css';

// The e2e build lets specs read the data layer the page itself uses (the real build never does).
if (import.meta.env.MODE === 'e2e') {
  void import('./data').then(({ dataSource }) => {
    (window as unknown as { __westock: unknown }).__westock = { dataSource };
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
);
