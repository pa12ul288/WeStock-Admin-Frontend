import { afterEach, describe, expect, it, vi } from 'vitest';
import { entryDelay, markLoadSequence, reducedMotionNow, runGsap } from './motion';

afterEach(() => vi.unstubAllGlobals());

describe('reducedMotionNow', () => {
  it('is on where the environment cannot tell (no matchMedia)', () => {
    expect(reducedMotionNow()).toBe(true);
  });

  it('follows the media query', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(reducedMotionNow()).toBe(false);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(reducedMotionNow()).toBe(true);
  });
});

describe('runGsap', () => {
  it('does nothing, and returns a safe cleanup, when motion is off', () => {
    const setup = vi.fn();
    const cleanup = runGsap(document.body, setup);
    expect(setup).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });
});

describe('entryDelay', () => {
  it('waits longer during the first load than on a route change', () => {
    markLoadSequence();
    const first = entryDelay('chart');
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 5000);
    expect(entryDelay('chart')).toBeLessThan(first);
    vi.restoreAllMocks();
  });
});
