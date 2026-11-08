import { DURATION, EASE } from './motion';

/**
 * Framer Motion props for something that pops in beside its trigger (menus, results, toasts):
 * a short fade and slide. With reduced motion it simply appears and disappears.
 */
export function popProps(reduced: boolean, from: 'top' | 'bottom' = 'top') {
  if (reduced) return { initial: false as const };
  const y = from === 'top' ? -8 : 8;
  return {
    initial: { opacity: 0, y, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y, scale: 0.97, transition: { duration: DURATION.fast } },
    transition: { duration: DURATION.base, ease: EASE.out },
  };
}

/** For a panel that opens inside the page, such as the vaccine schedule form. */
export function panelProps(reduced: boolean) {
  if (reduced) return { initial: false as const };
  return {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6, transition: { duration: DURATION.fast } },
    transition: { duration: DURATION.base, ease: EASE.out },
  };
}
