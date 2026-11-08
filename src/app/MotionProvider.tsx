import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { useReducedMotion } from '../lib/motion';

const loadFeatures = () => import('../lib/motionFeatures').then((module) => module.default);

/** Framer Motion's features load on demand; with reduced motion on, nothing travels. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={loadFeatures}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>
    </LazyMotion>
  );
}
