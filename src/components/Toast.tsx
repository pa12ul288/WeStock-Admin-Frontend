import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useReducedMotion } from '../lib/motion';
import { popProps } from '../lib/motionProps';
import { lastClickY } from './clickPosition';
import styles from './Toast.module.css';

type Tone = 'success' | 'error';

interface ToastApi {
  show(text: string, tone?: Tone): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const SHOW_FOR_MS = 2800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<{
    id: number;
    text: string;
    tone: Tone;
  } | null>(null);
  // Kept after the toast goes, so the region doesn't jump while the toast fades out.
  const [top, setTop] = useState(16);

  const show = useCallback((text: string, tone: Tone = 'success') => {
    // Appears near the last click, so it's where the person is already looking.
    const y = Math.max(16, Math.min(lastClickY() - 76, window.innerHeight - 76));
    setTop(y);
    setToast((current) => ({ id: (current?.id ?? 0) + 1, text, tone }));
  }, []);

  const toastId = toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    const timer = setTimeout(() => setToast(null), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [toastId]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} style={{ top }} role="status" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <m.div
              key={toast.id}
              className={styles.toast}
              data-tone={toast.tone}
              {...popProps(reduced)}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={toast.tone === 'error' ? 'M12 7v6M12 17h.01' : 'M5 12l5 5 9-10'} />
              </svg>
              <span>{toast.text}</span>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}
