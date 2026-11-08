import { animate } from 'framer-motion';
import { DURATION, EASE } from '../lib/motion';

/**
 * Dialogs are mounted and unmounted by their pages, so React removes them at once. To still give
 * them an exit, a dead copy of the overlay is left in the page for a moment and faded out. It is
 * hidden from assistive tech, can't be reached with the keyboard or mouse, and removes itself.
 */
export function exitGhost(overlay: HTMLElement): void {
  const ghost = overlay.cloneNode(true) as HTMLElement;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  ghost.style.pointerEvents = 'none';
  ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  document.body.append(ghost);
  const remove = () => ghost.remove();
  animate(ghost, { opacity: 0 }, { duration: DURATION.fast, ease: EASE.out }).then(remove, remove);
  const panel = ghost.firstElementChild;
  if (panel) animate(panel, { y: 10, scale: 0.985 }, { duration: DURATION.fast, ease: EASE.out });
}
