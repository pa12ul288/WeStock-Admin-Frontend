import { useLayoutEffect, type RefObject } from 'react';
import { entryDelay, GSAP_EASE, runGsap } from '../../lib/motion';

/** A chart wipes in from the left once, when it first appears (GSAP, clip-path only). */
export function useChartReveal(figure: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = figure.current;
    return runGsap(element, (gsap) => {
      gsap.fromTo(
        element,
        { clipPath: 'inset(0% 100% 0% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.7,
          delay: entryDelay('chart'),
          ease: GSAP_EASE.out,
          clearProps: 'clipPath',
        },
      );
    });
  }, [figure]);
}
