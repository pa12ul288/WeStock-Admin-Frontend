import { render, screen, waitFor } from '@testing-library/react';
import { LazyMotion } from 'framer-motion';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedValue } from './AnimatedValue';

afterEach(() => vi.unstubAllGlobals());

describe('AnimatedValue', () => {
  it('shows the final value at once when motion is reduced', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    render(<AnimatedValue value="₹1,23,456" />);
    expect(screen.getByText('₹1,23,456')).toBeTruthy();
  });

  it('counts up and ends on the exact formatted text', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { container } = render(
      <LazyMotion features={() => import('../lib/motionFeatures').then((m) => m.default)}>
        <AnimatedValue value="₹1,23,456" />
      </LazyMotion>,
    );
    // While counting, the visible copy is hidden from screen readers and the real text is there.
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('[aria-hidden="true"]')).toBeNull(), {
      timeout: 4000,
    });
    expect(container.textContent).toBe('₹1,23,456');
  });

  it('leaves non-numeric values alone', () => {
    render(<AnimatedValue value="Healthy" />);
    expect(screen.getByText('Healthy')).toBeTruthy();
  });
});
