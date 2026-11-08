import { useEffect, useId, useLayoutEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { m } from 'framer-motion';
import { DURATION, EASE, reducedMotionNow, useReducedMotion } from '../lib/motion';
import { exitGhost } from './exitGhost';
import { lastClickY } from './clickPosition';
import styles from './Modal.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELDS = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  footer?: ReactNode;
  /** `narrow` is 460 px wide, for short confirmations. */
  size?: 'default' | 'narrow';
  children: ReactNode;
}

/**
 * A dialog that holds focus, closes on Escape or a click outside, and hands focus back when it
 * goes. On desktop it opens beside the button that was clicked, on a phone at the top of the screen.
 * Focus starts on `[data-autofocus]` if there is one, then the first field, then the first control.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  onSubmit,
  footer,
  size = 'default',
  children,
}: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLFormElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // The page removes the dialog at once; leave a fading copy behind for the exit.
  useLayoutEffect(() => {
    const element = overlay.current;
    return () => {
      if (element && !reducedMotionNow()) exitGhost(element);
    };
  }, []);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const lowest = window.innerHeight - element.offsetHeight - 16;
    const top = Math.max(16, Math.min(lastClickY() - 170, lowest));
    element.style.setProperty('--modal-top', `${top}px`);
  }, []);

  useEffect(() => {
    const opener = document.activeElement;
    const first =
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>(FIELDS) ??
      panel.current?.querySelector<HTMLElement>(`[data-modal-body] ${FOCUSABLE}`) ??
      panel.current?.querySelector<HTMLElement>(`[data-modal-footer] button:last-child`) ??
      panel.current;
    first?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return createPortal(
    <m.div
      ref={overlay}
      className={styles.overlay}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE.out }}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <m.form
        ref={panel}
        className={styles.modal}
        initial={reduced ? false : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: DURATION.base, ease: EASE.out }}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
      >
        <div className={styles.head}>
          <div>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.body} data-modal-body>
          {children}
        </div>
        {footer && (
          <div className={styles.footer} data-modal-footer>
            {footer}
          </div>
        )}
      </m.form>
    </m.div>,
    document.body,
  );
}
