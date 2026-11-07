import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

describe('ConfirmDialog', () => {
  it('confirms straight away when no typing is asked for, with focus on Cancel', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="Remove Priya?"
        confirmLabel="Remove"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  describe('type to confirm', () => {
    const setup = () => {
      const onConfirm = vi.fn();
      render(
        <ConfirmDialog
          title="Delete Shree Ganesh Dairy?"
          confirmLabel="Delete farm"
          confirmText="Shree Ganesh Dairy"
          confirmTextLabel="Type the farm name to confirm"
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />,
      );
      return { onConfirm, input: screen.getByLabelText('Type the farm name to confirm') };
    };
    const submit = () => userEvent.click(screen.getByRole('button', { name: 'Delete farm' }));

    it('refuses the wrong text and says what to type', async () => {
      const { onConfirm, input } = setup();
      await userEvent.type(input, 'Shree');
      await submit();
      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toBe(
        'Type “Shree Ganesh Dairy” exactly to confirm.',
      );
    });

    it('refuses an empty box', async () => {
      const { onConfirm } = setup();
      await submit();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('takes the right text, ignoring case and outer spaces as the prototype does', async () => {
      const { onConfirm, input } = setup();
      await userEvent.type(input, '  shree ganesh dairy ');
      await submit();
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('takes Enter from the box', async () => {
      const { onConfirm, input } = setup();
      await userEvent.type(input, 'Shree Ganesh Dairy{Enter}');
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('clears the message once typing starts again', async () => {
      const { input } = setup();
      await submit();
      expect(screen.getByRole('alert')).toBeTruthy();
      await userEvent.type(input, 'S');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('shows a save failure and holds the action while saving', () => {
    render(
      <ConfirmDialog
        title="Delete?"
        confirmLabel="Delete"
        pending
        error="Your role can't make this change."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe("Your role can't make this change.");
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
