import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const pointerCaptures = new WeakMap<HTMLElement, Set<number>>();
const pointerCaptureApiAvailable =
  typeof HTMLElement.prototype.setPointerCapture === 'function'
  && typeof HTMLElement.prototype.hasPointerCapture === 'function'
  && typeof HTMLElement.prototype.releasePointerCapture === 'function';

if (!pointerCaptureApiAvailable) {
  Object.defineProperties(HTMLElement.prototype, {
    setPointerCapture: {
      configurable: true,
      writable: true,
      value(this: HTMLElement, pointerId: number) {
        const capturedPointers = pointerCaptures.get(this) ?? new Set<number>();
        capturedPointers.add(pointerId);
        pointerCaptures.set(this, capturedPointers);
      },
    },
    hasPointerCapture: {
      configurable: true,
      writable: true,
      value(this: HTMLElement, pointerId: number) {
        return pointerCaptures.get(this)?.has(pointerId) ?? false;
      },
    },
    releasePointerCapture: {
      configurable: true,
      writable: true,
      value(this: HTMLElement, pointerId: number) {
        const capturedPointers = pointerCaptures.get(this);
        if (!capturedPointers) return;
        capturedPointers.delete(pointerId);
        if (capturedPointers.size === 0) pointerCaptures.delete(this);
      },
    },
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  writable: true,
  value: () => undefined,
});

if (!URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:test',
  });
}
if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}
