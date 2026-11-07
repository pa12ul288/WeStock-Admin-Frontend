import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageItems, Pagination } from './Pagination';

afterEach(cleanup);

describe('pageItems', () => {
  it('lists every page up to four', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('shows 1 2 3 … last like the prototype', () => {
    expect(pageItems(1, 1580)).toEqual([1, 2, 3, null, 1580]);
  });

  it('adds the current page when it is further along', () => {
    expect(pageItems(50, 1580)).toEqual([1, 2, 3, null, 50, null, 1580]);
    expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageItems(9, 10)).toEqual([1, 2, 3, null, 9, 10]);
  });
});

describe('Pagination', () => {
  it('counts 20 to a page', () => {
    render(<Pagination page={1} total={66} onPageChange={vi.fn()} />);
    expect(screen.getByText('Showing 1–20 of 66')).toBeTruthy();
  });

  it('counts the last page to the total, with the noun and Indian grouping', () => {
    render(<Pagination page={4} total={66} noun="farms" onPageChange={vi.fn()} />);
    expect(screen.getByText('Showing 61–66 of 66 farms')).toBeTruthy();
    cleanup();
    render(<Pagination page={1} total={18960} noun="animals" onPageChange={vi.fn()} />);
    expect(screen.getByText('Showing 1–20 of 18,960 animals')).toBeTruthy();
  });

  it('says so when there is nothing, and hides the pages', () => {
    render(<Pagination page={1} total={0} onPageChange={vi.fn()} />);
    expect(screen.getByText('No matches')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('hides the pages when one is enough', () => {
    render(<Pagination page={1} total={20} onPageChange={vi.fn()} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('marks the current page and moves between pages', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} total={66} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: 'Page 4' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it('stops at both ends', () => {
    render(<Pagination page={1} total={66} onPageChange={vi.fn()} />);
    const previous = screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    cleanup();
    render(<Pagination page={4} total={66} onPageChange={vi.fn()} />);
    const next = screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('treats a page past the end as the last page', () => {
    render(<Pagination page={99} total={66} onPageChange={vi.fn()} />);
    expect(screen.getByText('Showing 61–66 of 66')).toBeTruthy();
  });
});
