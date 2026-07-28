import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CassetteHandle } from '../features/evidence-cassette/CassetteHandle';

function pointerEvent(
  type: 'pointerDown' | 'pointerMove' | 'pointerCancel' | 'pointerUp',
  node: Element,
  coordinates: { pointerId: number; clientX: number; clientY: number },
) {
  const eventType = {
    pointerDown: 'pointerdown',
    pointerMove: 'pointermove',
    pointerCancel: 'pointercancel',
    pointerUp: 'pointerup',
  }[type];
  const event = new MouseEvent(eventType, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: coordinates.clientX,
    clientY: coordinates.clientY,
  });
  Object.defineProperty(event, 'pointerId', {
    configurable: true,
    value: coordinates.pointerId,
  });
  fireEvent(node, event);
}

function renderHandle({ busy = false } = {}) {
  const activate = vi.fn();
  render(
    <CassetteHandle
      mode="index"
      accession="A1–03"
      product="Fermented Brightening Essence"
      busy={busy}
      onActivate={activate}
    >
      HANDLE
    </CassetteHandle>,
  );
  return {
    activate,
    handle: screen.getByRole('button', { name: 'View trial for Fermented Brightening Essence' }),
  };
}

describe('CassetteHandle browser pointer semantics', () => {
  it('captures a pointer on pointer down and releases only that pointer on pointer up', () => {
    const { handle } = renderHandle();

    pointerEvent('pointerDown', handle, { pointerId: 1, clientX: 10, clientY: 10 });
    pointerEvent('pointerDown', handle, { pointerId: 2, clientX: 10, clientY: 10 });
    expect(handle.hasPointerCapture(1)).toBe(true);
    expect(handle.hasPointerCapture(2)).toBe(true);

    pointerEvent('pointerUp', handle, { pointerId: 2, clientX: 10, clientY: 10 });
    expect(handle.hasPointerCapture(1)).toBe(true);
    expect(handle.hasPointerCapture(2)).toBe(false);

    handle.releasePointerCapture(1);
    expect(handle.hasPointerCapture(1)).toBe(false);
  });

  it('activates once for a horizontal drag, releases capture, and suppresses its synthetic click', () => {
    const { activate, handle } = renderHandle();

    pointerEvent('pointerDown', handle, { pointerId: 3, clientX: 10, clientY: 10 });
    pointerEvent('pointerMove', handle, { pointerId: 3, clientX: 48, clientY: 11 });
    pointerEvent('pointerMove', handle, { pointerId: 3, clientX: 56, clientY: 12 });
    pointerEvent('pointerUp', handle, { pointerId: 3, clientX: 56, clientY: 12 });
    fireEvent.click(handle);

    expect(activate).toHaveBeenCalledOnce();
    expect(handle.hasPointerCapture(3)).toBe(false);
  });

  it('releases capture on cancellation and accepts the next deliberate click', () => {
    const { activate, handle } = renderHandle();

    pointerEvent('pointerDown', handle, { pointerId: 4, clientX: 10, clientY: 10 });
    pointerEvent('pointerMove', handle, { pointerId: 4, clientX: 19, clientY: 18 });
    pointerEvent('pointerCancel', handle, { pointerId: 4, clientX: 19, clientY: 18 });
    expect(handle.hasPointerCapture(4)).toBe(false);
    fireEvent.click(handle);

    expect(activate).toHaveBeenCalledOnce();
  });

  it('resets drag state when capture is lost', () => {
    const { activate, handle } = renderHandle();

    pointerEvent('pointerDown', handle, { pointerId: 5, clientX: 10, clientY: 10 });
    handle.releasePointerCapture(5);
    fireEvent.lostPointerCapture(handle, { pointerId: 5 });
    pointerEvent('pointerMove', handle, { pointerId: 5, clientX: 50, clientY: 10 });
    fireEvent.click(handle);

    expect(handle.hasPointerCapture(5)).toBe(false);
    expect(activate).toHaveBeenCalledOnce();
  });

  it('preserves native click, Enter, and Space activation', async () => {
    const user = userEvent.setup();
    const { activate, handle } = renderHandle();

    await user.click(handle);
    handle.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(activate).toHaveBeenCalledTimes(3);
  });

  it('blocks pointer, click, and keyboard activation while busy', async () => {
    const user = userEvent.setup();
    const { activate, handle } = renderHandle({ busy: true });

    pointerEvent('pointerDown', handle, { pointerId: 6, clientX: 10, clientY: 10 });
    pointerEvent('pointerMove', handle, { pointerId: 6, clientX: 50, clientY: 10 });
    pointerEvent('pointerUp', handle, { pointerId: 6, clientX: 50, clientY: 10 });
    await user.click(handle);
    handle.focus();
    await user.keyboard('{Enter}');

    expect(handle.hasPointerCapture(6)).toBe(false);
    expect(activate).not.toHaveBeenCalled();
  });
});
