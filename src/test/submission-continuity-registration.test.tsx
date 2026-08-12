import { useCallback, useReducer } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FaceValueContext } from '../app/faceValueContext';
import {
  faceValueReducer,
  initialState,
  type FaceValueEvent,
  type PhaseBFaceValueState,
} from '../app/phaseBMachine';
import { ordinaryDemoRuntime } from '../domain/demoLab';
import {
  createRegisteredProduct,
  normalizeStrength,
  normalizeVolume,
} from '../domain/phaseB5';
import { FaceValueApplication } from '../features/FaceValueApplication';

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
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

function Harness({ events }: { events: FaceValueEvent[] }) {
  const [state, reducerDispatch] = useReducer(faceValueReducer, initialState);
  const dispatch = useCallback(
    (event: FaceValueEvent) => {
      events.push(event);
      reducerDispatch(event);
    },
    [events],
  );
  return (
    <FaceValueContext.Provider
      value={{ state: state as PhaseBFaceValueState, dispatch, demoRuntime: ordinaryDemoRuntime }}
    >
      <FaceValueApplication />
    </FaceValueContext.Provider>
  );
}

beforeEach(() => installMatchMedia());

describe('submission continuity registration', () => {
  it('normalizes numeric strength and volume without requiring punctuation', () => {
    expect(normalizeStrength('10')).toBe('10%');
    expect(normalizeStrength('10%')).toBe('10%');
    expect(normalizeStrength('0.5')).toBe('0.5%');
    expect(normalizeVolume('30')).toBe('30 ml');
    expect(normalizeVolume('30ML')).toBe('30 ml');

    const product = createRegisteredProduct(
      {
        brand: 'Naturium',
        productName: 'Azelaic Topical Acid',
        strength: '10',
        volume: '30',
      },
      '2026-08-11T20:00:00.000Z',
    );
    expect(product.strength).toBe('10%');
    expect(product.volume).toBe('30 ml');
  });

  it('shows canonical units on the live specimen preview before register', () => {
    const events: FaceValueEvent[] = [];
    render(<Harness events={events} />);

    fireEvent.click(screen.getByRole('button', { name: 'LOAD A PRODUCT' }));
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'Naturium' } });
    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Azelaic Topical Acid' },
    });
    fireEvent.change(screen.getByLabelText('Strength (%) · optional'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Volume (ml) · optional'), {
      target: { value: '30' },
    });

    const specimen = document.querySelector<HTMLElement>('[data-oracle-specimen]');
    expect(specimen).not.toBeNull();
    expect(specimen).toHaveAttribute('data-specimen-strength', '10%');
    expect(specimen).toHaveAttribute('data-specimen-volume', '30 ml');
    expect(screen.getByText('VISIBLE REDNESS')).toBeVisible();
    expect(screen.getByText('Baseline → follow-up comparison')).toBeVisible();
    expect(screen.queryByText('The one supported job in this protocol')).not.toBeInTheDocument();
  });
});
