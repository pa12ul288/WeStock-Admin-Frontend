import { createDemoAdapter } from './demo/adapter';
import { createDemoStore } from './demo/store';
import type { DataSource } from './source';

function pickDataSource(kind: string): DataSource {
  switch (kind) {
    case 'demo':
      return createDemoAdapter(createDemoStore());
    case 'supabase':
      throw new Error('The supabase data source is not built yet');
    default:
      throw new Error(`Unknown VITE_DATA_SOURCE: ${kind}`);
  }
}

const configured: string | undefined = import.meta.env.VITE_DATA_SOURCE;

export const dataSource: DataSource = pickDataSource(configured || 'demo');
