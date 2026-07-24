import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EvidenceCassette } from '../features/evidence-cassette/EvidenceCassette';
import {
  evidenceCassetteReducer,
  nextCassetteStep,
  type EvidenceCassetteState,
} from '../features/evidence-cassette/evidenceCassetteMachine';

function installMotionPreference(reduced = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderCassette() {
  return render(
    <EvidenceCassette
      accessionCode="A1–01"
      productName="BARRIER WATER SERUM"
      job="HYDRATION"
    />,
  );
}

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

describe('evidence cassette machine', () => {
  it('accepts only the causal opening order', () => {
    let state: EvidenceCassetteState = 'sealed';
    state = evidenceCassetteReducer(state, { type: 'ACTIVATE' });
    expect(state).toBe('pressing');
    expect(evidenceCassetteReducer(state, { type: 'GLASS_COMPLETE' })).toBe('pressing');
    state = evidenceCassetteReducer(state, { type: 'PRESS_COMPLETE' });
    expect(state).toBe('released');
    state = evidenceCassetteReducer(state, { type: 'RELEASE_COMPLETE' });
    expect(state).toBe('tilting');
    state = evidenceCassetteReducer(state, { type: 'TILT_COMPLETE' });
    expect(state).toBe('settled');
    state = evidenceCassetteReducer(state, { type: 'SETTLE_COMPLETE' });
    expect(state).toBe('clearing');
    state = evidenceCassetteReducer(state, { type: 'GLASS_COMPLETE' });
    expect(state).toBe('presented');
  });

  it('uses a distinct reduced-motion path without tilt', () => {
    expect(nextCassetteStep('released', true)?.event.type).toBe('REDUCED_RELEASE_COMPLETE');
    expect(nextCassetteStep('released', false)?.event.type).toBe('RELEASE_COMPLETE');
  });
});

describe('EvidenceCassette', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installMotionPreference(false);
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
      value: vi.fn(() => false),
    });
  });

  it('starts sealed with a semantic handle and stable description', () => {
    renderCassette();
    expect(screen.getByLabelText('Evidence cassette instrument')).toHaveAttribute(
      'data-cassette-state',
      'sealed',
    );
    expect(screen.getByRole('button', { name: 'Open evidence cassette' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Cassette sealed');
  });

  it('opens once, keeps glass frosted through mechanics, then presents identity', () => {
    renderCassette();
    const instrument = screen.getByLabelText('Evidence cassette instrument');
    const handle = screen.getByRole('button', { name: 'Open evidence cassette' });

    fireEvent.click(handle);
    fireEvent.click(handle);
    expect(instrument).toHaveAttribute('data-cassette-state', 'pressing');
    expect(instrument).toHaveAttribute('data-glass-cleared', 'false');

    advance(80);
    expect(instrument).toHaveAttribute('data-cassette-state', 'released');
    expect(screen.getByRole('status')).toHaveTextContent('Cassette released');
    advance(140);
    expect(instrument).toHaveAttribute('data-cassette-state', 'tilting');
    expect(instrument).toHaveAttribute('data-glass-cleared', 'false');
    advance(200);
    expect(instrument).toHaveAttribute('data-cassette-state', 'settled');
    expect(instrument).toHaveAttribute('data-mechanics-settled', 'true');
    advance(160);
    expect(instrument).toHaveAttribute('data-cassette-state', 'clearing');
    expect(instrument).toHaveAttribute('data-identity-visible', 'false');
    advance(320);
    expect(instrument).toHaveAttribute('data-cassette-state', 'presented');
    expect(instrument).toHaveAttribute('data-glass-cleared', 'true');
    expect(screen.getByRole('button', { name: 'Close evidence cassette' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Edit product trial details' })).toBeVisible();
  });

  it('uses the same transition for a deliberate handle drag and ignores a short drag', () => {
    renderCassette();
    const instrument = screen.getByLabelText('Evidence cassette instrument');
    const handle = screen.getByRole('button', { name: 'Open evidence cassette' });

    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 26, clientY: 12 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(instrument).toHaveAttribute('data-cassette-state', 'sealed');

    fireEvent.pointerDown(handle, { button: 0, pointerId: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 46, clientY: 12 });
    expect(instrument).toHaveAttribute('data-cassette-state', 'pressing');
  });

  it('reseals decisively from presented', () => {
    renderCassette();
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence cassette' }));
    advance(900);
    fireEvent.click(screen.getByRole('button', { name: 'Close evidence cassette' }));
    expect(screen.getByLabelText('Evidence cassette instrument')).toHaveAttribute(
      'data-cassette-state',
      'closing',
    );
    advance(460);
    expect(screen.getByLabelText('Evidence cassette instrument')).toHaveAttribute(
      'data-cassette-state',
      'sealed',
    );
  });

  it('preserves the semantic result in reduced motion', () => {
    installMotionPreference(true);
    renderCassette();
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence cassette' }));
    advance(400);
    expect(screen.getByLabelText('Evidence cassette instrument')).toHaveAttribute(
      'data-cassette-state',
      'presented',
    );
  });

  it('cleans scheduled transitions when unmounted', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = renderCassette();
    fireEvent.click(screen.getByRole('button', { name: 'Open evidence cassette' }));
    unmount();
    advance(2000);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
