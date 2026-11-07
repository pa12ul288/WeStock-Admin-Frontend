import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'md' | 'sm';

/** The button look, for a `Link` that should look like a button. */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md'): string {
  return [styles.button, styles[variant], size === 'sm' ? styles.small : ''].join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonClass(variant, size), className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}

/** The square button look used for row actions, for a `Link` too. */
export const iconButtonClass = styles.icon;

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  children: ReactNode;
}

export function IconButton({ type = 'button', className, ...rest }: IconButtonProps) {
  return (
    <button type={type} className={[styles.icon, className].filter(Boolean).join(' ')} {...rest} />
  );
}
