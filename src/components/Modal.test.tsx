import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

afterEach(cleanup);

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal
          title="Add entry"
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          footer={<button type="submit">Save</button>}
        >
          <input aria-label="Litres" />
        </Modal>
      )}
    </>
  );
}

const open = () => userEvent.click(screen.getByRole('button', { name: 'Open' }));

describe('Modal', () => {
  it('moves focus to the first field and names the dialog', async () => {
    render(<Harness />);
    await open();
    expect(screen.getByRole('dialog', { name: 'Add entry' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Litres'));
  });

  it('keeps Tab inside the dialog, both ways', async () => {
    render(<Harness />);
    await open();
    const close = screen.getByRole('button', { name: 'Close' });
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(save);
  });

  it('closes on Escape and hands focus back to the button', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await open();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }));
  });

  it('closes on a click outside but not inside', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await open();
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens beside the clicked button, staying on the screen', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Open' });
    const clickAt = (clientY: number) => {
      fireEvent.click(button, { clientY, detail: 1 });
      const dialog = screen.getByRole('dialog');
      const top = dialog.style.getPropertyValue('--modal-top');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      return top;
    };
    expect(clickAt(500)).toBe('330px');
    expect(clickAt(100)).toBe('16px');
  });
});
