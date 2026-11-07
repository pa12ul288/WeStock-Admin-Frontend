import { useEffect, type RefObject } from 'react';

/**
 * Closes a popover on Escape or on a press outside `container`. Presses on anything matching
 * `ignore` (the popover's own trigger, when it lives elsewhere) don't count as outside.
 */
export function useDismiss(
  open: boolean,
  onClose: (viaEscape: boolean) => void,
  container: RefObject<HTMLElement | null>,
  ignore?: string,
): void {
  useEffect(() => {
    if (!open) return;
    function onPress(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (container.current?.contains(target)) return;
      if (ignore && target.closest(ignore)) return;
      onClose(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose(true);
    }
    document.addEventListener('mousedown', onPress);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPress);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, container, ignore]);
}
