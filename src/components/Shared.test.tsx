import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';
import { KpiCard } from './KpiCard';
import { Segmented } from './Segmented';
import { StatusPill, type PillTone } from './StatusPill';

afterEach(cleanup);

describe('Segmented', () => {
  const options = [
    { value: 'daily', label: 'Daily' },
    { value: 'monthly', label: 'Monthly', count: 12 },
  ];

  it('marks the chosen option with aria-pressed', () => {
    render(<Segmented label="Period" options={options} value="daily" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Period' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Daily' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Monthly/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('reports a change', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Period" options={options} value="daily" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Monthly/ }));
    expect(onChange).toHaveBeenCalledWith('monthly');
  });
});

describe('StatusPill', () => {
  it.each<PillTone>(['green', 'amber', 'red', 'blue', 'pink', 'grey'])(
    'shows the %s tone with its words',
    (tone) => {
      render(<StatusPill tone={tone}>In heat</StatusPill>);
      expect(screen.getByText('In heat').getAttribute('data-tone')).toBe(tone);
    },
  );
});

describe('KpiCard', () => {
  it('shows label, value, note and trend', () => {
    render(
      <KpiCard
        label="Milk yesterday"
        value="24,318 L"
        note="04 Nov · all farms"
        trend={{ direction: 'down', text: '3.6%' }}
      />,
    );
    expect(screen.getByText('Milk yesterday')).toBeTruthy();
    expect(screen.getByText('24,318 L')).toBeTruthy();
    expect(screen.getByText('04 Nov · all farms')).toBeTruthy();
    expect(screen.getByText('3.6%', { exact: false })).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('becomes a link when given somewhere to go', () => {
    render(
      <MemoryRouter>
        <KpiCard label="Farms" value="66" to="/farmers?view=farms" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Farms/ }).getAttribute('href')).toBe(
      '/farmers?view=farms',
    );
  });
});

describe('EmptyState', () => {
  it('offers Clear filters by default', async () => {
    const onAction = vi.fn();
    render(<EmptyState onAction={onAction} />);
    expect(screen.getByText('Nothing matches these filters')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('has no button when there is nothing to do', () => {
    render(<EmptyState title="No milk logged yet" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
