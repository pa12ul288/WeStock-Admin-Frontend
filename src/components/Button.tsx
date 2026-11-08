import type { ReactNode } from 'react';
import { m, type HTMLMotionProps } from 'framer-motion';
import { useReducedMotion } from '../lib/motion';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

/** The button look, for a `Link` that should look like a button. */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md'): string {
  return [styles.button, styles[variant], size === 'sm' ? styles.small : ''].join(' ');
}

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant;
  size?: Size;
}

/** A button that presses in a little (Framer Motion; plain when motion is reduced). */
export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const reduced = useReducedMotion();
  return (
    <m.button
      type={type}
      disabled={disabled}
      className={[buttonClass(variant, size), className].filter(Boolean).join(' ')}
      whileTap={reduced || disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      {...rest}
    />
  );
}

/** The square button look used for row actions, for a `Link` too. */
export const iconButtonClass = styles.icon;

interface IconButtonProps extends HTMLMotionProps<'button'> {
  'aria-label': string;
  children: ReactNode;
}

export function IconButton({ type = 'button', className, disabled, ...rest }: IconButtonProps) {
  const reduced = useReducedMotion();
  return (
    <m.button
      type={type}
      disabled={disabled}
      className={[styles.icon, className].filter(Boolean).join(' ')}
      whileTap={reduced || disabled ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.12 }}
      {...rest}
    />
  );
}
