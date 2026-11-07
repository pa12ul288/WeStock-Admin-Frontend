const NO_CLICK_YET = 140; // the prototype's starting point

let lastY: number | null = null;

function record(event: MouseEvent) {
  if (event.detail > 0) {
    lastY = event.clientY;
  } else if (event.target instanceof Element) {
    // Enter or Space on a button: a click with no pointer, so use the button's own position.
    const box = event.target.getBoundingClientRect();
    lastY = box.top + box.height / 2;
  }
}

if (typeof document !== 'undefined') document.addEventListener('click', record, true);

/** How far down the window the last click landed: dialogs and toasts appear near it. */
export function lastClickY(): number {
  return lastY ?? NO_CLICK_YET;
}
