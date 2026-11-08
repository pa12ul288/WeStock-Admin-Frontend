/**
 * Browsers only open a date field's calendar from its small icon; clicking the text just edits the
 * day, month or year. This opens the calendar on a click anywhere in the field instead.
 * `showPicker` is missing in older browsers and throws if the field is disabled or not visible, so
 * those cases are left to the browser's own behaviour.
 */
const PICKER_TYPES = new Set(['date', 'datetime-local', 'month', 'time']);

export function openPickerOnClick(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !PICKER_TYPES.has(target.type)) return;
  if (target.disabled || target.readOnly || typeof target.showPicker !== 'function') return;
  try {
    target.showPicker();
  } catch {
    /* not allowed right now: the browser's own icon still works */
  }
}

/** Starts listening for clicks on date fields; returns the function that stops it. */
export function installDatePicker(root: Document = document): () => void {
  root.addEventListener('click', openPickerOnClick);
  return () => root.removeEventListener('click', openPickerOnClick);
}
