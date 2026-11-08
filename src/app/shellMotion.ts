import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { gsap as Gsap } from 'gsap';
import { getGsap, GSAP_EASE, reducedMotionNow } from '../lib/motion';

const PHONE = '(max-width: 900px)';
const isPhone = () => window.matchMedia?.(PHONE).matches ?? false;

function pixels(token: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The dashboard's load sequence: sidebar, then top bar, then the page. The KPI cards, charts and
 * table rows add their own steps a little later (see `entryDelay`). Runs once, when the shell
 * first appears; everything is cleaned up afterwards so nothing keeps an inline style.
 */
export function useLoadSequence(shell: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const root = shell.current;
    const gsap = getGsap();
    if (!root || !gsap || reducedMotionNow()) return;
    const side = root.querySelector('aside');
    const bar = root.querySelector('[data-topbar]');
    const page = root.querySelector('main');
    const phone = isPhone();
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: GSAP_EASE.out } });
      if (side) {
        timeline.from(
          side,
          { ...(phone ? { y: -12 } : { x: -22 }), opacity: 0, duration: 0.45, clearProps: 'all' },
          0,
        );
      }
      if (bar) timeline.from(bar, { y: -14, opacity: 0, duration: 0.4, clearProps: 'all' }, 0.1);
      if (page) timeline.from(page, { y: 12, opacity: 0, duration: 0.45, clearProps: 'all' }, 0.2);
    }, root);
    return () => context.revert();
  }, [shell]);
}

/**
 * A short fade-and-slide of the page when the route changes, and focus moved to the new page's
 * heading so keyboard and screen reader users start at the top of what they asked for.
 */
export function usePageTransition(page: RefObject<HTMLElement | null>, pathname: string): void {
  const previous = useRef(pathname);
  useLayoutEffect(() => {
    const element = page.current;
    if (!element || previous.current === pathname) return;
    previous.current = pathname;

    const target = element.querySelector<HTMLElement>('h1') ?? element;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });

    const gsap = getGsap();
    if (!gsap || reducedMotionNow()) return;
    const tween = gsap.fromTo(
      element,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.38, ease: GSAP_EASE.out, clearProps: 'opacity,transform' },
    );
    return () => {
      tween.revert();
    };
  }, [page, pathname]);
}

/**
 * Collapses the sidebar to an icon rail and back. One timeline moves the column width (the page
 * follows because it is the next grid column), fades the labels, turns the chevron and swaps the
 * layout at the right moment. `data-rail` on the shell holds the settled state for CSS.
 */
export function useSidebarMorph(shell: RefObject<HTMLElement | null>, collapsed: boolean): void {
  const timeline = useRef<ReturnType<typeof Gsap.timeline> | null>(null);

  useLayoutEffect(() => {
    const root = shell.current;
    if (!root) return;
    const settle = () => {
      root.dataset.rail = String(collapsed);
      root.style.removeProperty('--side-w');
    };
    const before = root.dataset.rail;
    if (before === String(collapsed)) return;

    const gsap = getGsap();
    if (before === undefined || !gsap || reducedMotionNow() || isPhone()) {
      timeline.current?.kill();
      settle();
      return;
    }

    const aside = root.querySelector('aside');
    const from = aside?.getBoundingClientRect().width ?? pixels('--side-w', 256);
    const to = collapsed ? pixels('--side-w-rail', 70) : pixels('--side-w', 256);
    timeline.current?.kill();

    const fades = root.querySelectorAll('[data-nav-fade]');
    const user = root.querySelector('[data-nav-user]');
    const chevron = root.querySelector('[data-nav-chevron]');
    const tl = gsap.timeline({
      defaults: { ease: GSAP_EASE.out },
      onComplete: () => {
        settle();
        gsap.set([fades, user, chevron], { clearProps: 'opacity,transform' });
      },
    });
    timeline.current = tl;

    tl.fromTo(
      root,
      { '--side-w': `${from}px` },
      { '--side-w': `${to}px`, duration: 0.42, ease: GSAP_EASE.inOut },
      0,
    );
    if (chevron) {
      tl.fromTo(
        chevron,
        { rotation: collapsed ? 0 : 180 },
        { rotation: collapsed ? 180 : 0, duration: 0.42, ease: GSAP_EASE.inOut },
        0,
      );
    }
    if (collapsed) {
      // Labels and the account block fade first; the rail layout takes over as the width lands.
      tl.to(fades, { opacity: 0, duration: 0.14, ease: 'power1.out' }, 0);
      if (user) tl.to(user, { opacity: 0, duration: 0.12, ease: 'power1.out' }, 0);
      tl.call(() => (root.dataset.rail = 'true'), [], 0.42);
      if (user) tl.fromTo(user, { opacity: 0 }, { opacity: 1, duration: 0.16 }, 0.42);
    } else {
      // Full layout straight away (still hidden), then the labels fade in as there is room.
      root.dataset.rail = 'false';
      gsap.set([fades, user], { opacity: 0 });
      tl.to(fades, { opacity: 1, duration: 0.22 }, 0.2);
      if (user) tl.to(user, { opacity: 1, duration: 0.2 }, 0.24);
    }
  }, [shell, collapsed]);

  useLayoutEffect(
    () => () => {
      timeline.current?.kill();
      timeline.current = null;
    },
    [],
  );
}
