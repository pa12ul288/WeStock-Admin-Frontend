import { afterEach, describe, expect, it, vi } from 'vitest';
import { installDatePicker } from './datePicker';

function field(type: string, props: Partial<HTMLInputElement> = {}) {
  const input = document.createElement('input');
  input.type = type;
  Object.assign(input, props);
  const showPicker = vi.fn();
  Object.defineProperty(input, 'showPicker', { value: showPicker, configurable: true });
  document.body.append(input);
  return { input, showPicker };
}

describe('installDatePicker', () => {
  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    document.body.innerHTML = '';
  });

  it('opens the calendar when a date or date-time field is clicked', () => {
    stop = installDatePicker();
    const date = field('date');
    const dateTime = field('datetime-local');
    date.input.click();
    dateTime.input.click();
    expect(date.showPicker).toHaveBeenCalledOnce();
    expect(dateTime.showPicker).toHaveBeenCalledOnce();
  });

  it('leaves other, disabled and read-only fields alone', () => {
    stop = installDatePicker();
    const text = field('text');
    const disabled = field('date', { disabled: true });
    const readOnly = field('date', { readOnly: true });
    text.input.click();
    disabled.input.click();
    readOnly.input.click();
    expect(text.showPicker).not.toHaveBeenCalled();
    expect(disabled.showPicker).not.toHaveBeenCalled();
    expect(readOnly.showPicker).not.toHaveBeenCalled();
  });

  it('does not throw when the browser refuses to show the picker', () => {
    stop = installDatePicker();
    const { input, showPicker } = field('date');
    showPicker.mockImplementation(() => {
      throw new DOMException('not allowed', 'NotAllowedError');
    });
    expect(() => input.click()).not.toThrow();
  });

  it('stops listening once removed', () => {
    const remove = installDatePicker();
    const { input, showPicker } = field('date');
    remove();
    input.click();
    expect(showPicker).not.toHaveBeenCalled();
  });
});
