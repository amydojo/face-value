import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CassetteHandle } from '../features/evidence-cassette/CassetteHandle';

function pointerEvent(
  type: 'pointerDown' | 'pointerMove' | 'pointerCancel' | 'pointerUp',
  node: Element,
  coordinates: { pointerId: number; clientX: number; clientY: number },
) {
  fireEvent[type](node, { button: 0, ...coordinates });
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn(() => true),
  });
});

it('recovers from pointer cancellation and accepts the next deliberate tap', () => {
  const activate = vi.fn();
  render(
    <CassetteHandle mode="active" accession="A1–03" onActivate={activate}>
      HANDLE
    </CassetteHandle>,
  );

  const handle = screen.getByRole('button', { name: 'Open active observation for A1–03' });
  pointerEvent('pointerDown', handle, { pointerId: 1, clientX: 10, clientY: 10 });
  pointerEvent('pointerMove', handle, { pointerId: 1, clientX: 19, clientY: 18 });
  pointerEvent('pointerCancel', handle, { pointerId: 1, clientX: 19, clientY: 18 });
  fireEvent.click(handle);

  expect(activate).toHaveBeenCalledOnce();
});

it('suppresses the synthetic click after a completed drag activation', () => {
  const activate = vi.fn();
  render(
    <CassetteHandle mode="index" accession="A1–03" onActivate={activate}>
      HANDLE
    </CassetteHandle>,
  );

  const handle = screen.getByRole('button', { name: 'Open evidence cassette A1–03' });
  pointerEvent('pointerDown', handle, { pointerId: 2, clientX: 10, clientY: 10 });
  pointerEvent('pointerMove', handle, { pointerId: 2, clientX: 48, clientY: 11 });
  pointerEvent('pointerUp', handle, { pointerId: 2, clientX: 48, clientY: 11 });
  fireEvent.click(handle);

  expect(activate).toHaveBeenCalledOnce();
});
