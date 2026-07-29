import { useCallback, useReducer } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FaceValueContext } from '../app/faceValueContext';
import {
  faceValueReducer,
  initialState,
  type FaceValueEvent,
  type PhaseBFaceValueState,
} from '../app/phaseBMachine';
import { ordinaryDemoRuntime, type DemoRuntime } from '../domain/demoLab';
import { createRegisteredProduct } from '../domain/phaseB5';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';
import { specimenIngestionTiming } from '../features/first-trial/FirstTrialScene';

function installMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
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

function Harness({
  initial,
  events,
  demoRuntime,
}: {
  initial: PhaseBFaceValueState;
  events: FaceValueEvent[];
  demoRuntime: DemoRuntime;
}) {
  const [state, reducerDispatch] = useReducer(faceValueReducer, initial);
  const dispatch = useCallback(
    (event: FaceValueEvent) => {
      events.push(event);
      reducerDispatch(event);
    },
    [events],
  );

  return (
    <FaceValueContext.Provider value={{ state, dispatch, demoRuntime }}>
      <FaceValueApplication />
    </FaceValueContext.Provider>
  );
}

function renderApplication(
  initial: PhaseBFaceValueState = initialState,
  demoRuntime: DemoRuntime = ordinaryDemoRuntime,
) {
  const events: FaceValueEvent[] = [];
  return {
    events,
    ...render(<Harness initial={initial} events={events} demoRuntime={demoRuntime} />),
  };
}

function enterRegistration() {
  fireEvent.click(screen.getByRole('button', { name: 'LOAD A PRODUCT' }));
}

function fillRequiredProduct(brand = 'Naturium', productName = 'Azelaic Topical Acid') {
  fireEvent.change(screen.getByLabelText('Brand'), {
    target: { value: brand },
  });
  fireEvent.change(screen.getByLabelText('Product name'), {
    target: { value: productName },
  });
}

function registerProduct() {
  fireEvent.click(screen.getByRole('button', { name: 'REGISTER & LOAD' }));
}

function currentMachine(): HTMLElement {
  const machine = document.querySelector<HTMLElement>('[data-oracle-machine]');
  if (!machine) throw new Error('Expected one Oracle machine.');
  return machine;
}

function currentSpecimen(): HTMLElement {
  const specimen = document.querySelector<HTMLElement>('[data-oracle-specimen]');
  if (!specimen) throw new Error('Expected one Oracle specimen.');
  return specimen;
}

function registeredJobState(): PhaseBFaceValueState {
  const registration = faceValueReducer(initialState, {
    type: 'START_PRODUCT_REGISTRATION',
  });
  return faceValueReducer(registration, {
    type: 'REGISTER_PRODUCT',
    product: createRegisteredProduct(
      {
        brand: 'Naturium',
        productName: 'Azelaic Topical Acid',
        strength: '10%',
        volume: '30 ml',
      },
      '2026-07-28T18:00:00.000Z',
    ),
  });
}

beforeEach(() => {
  installMatchMedia(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('First Trial specimen ingestion', () => {
  it('keeps one header, machine node, and specimen node across welcome, preview, and commit', () => {
    vi.useFakeTimers();
    const { events } = renderApplication();
    const machine = currentMachine();
    const specimen = currentSpecimen();

    expect(document.querySelectorAll('[data-fv-part="screen-header"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-oracle-machine]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-oracle-specimen]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-label-scan-beam]')).toHaveLength(1);
    expect(specimen).toHaveAttribute('data-specimen-aspect-ratio', '104/136');
    for (const layer of [
      'cap',
      'collar',
      'shoulder-form',
      'bottle-body',
      'evidence-lock-strip',
      'thermal-evidence-label',
    ]) {
      expect(specimen.querySelectorAll(`[data-specimen-layer="${layer}"]`)).toHaveLength(1);
    }
    expect(machine).toHaveAttribute('data-trial-machine-state', 'empty');
    expect(within(machine).getByText('NO SPECIMEN LOADED')).toBeVisible();

    enterRegistration();
    expect(currentMachine()).toBe(machine);
    expect(currentSpecimen()).toBe(specimen);
    expect(machine).toHaveAttribute('data-trial-machine-state', 'registration-preview');
    expect(within(machine).getByText('LABEL PREVIEW')).toBeVisible();
    expect(within(machine).getByText('NOT YET LOADED')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Brand'), {
      target: { value: 'Naturium' },
    });
    expect(specimen).toHaveAttribute('data-specimen-brand', 'Naturium');
    expect(within(specimen).getByText('NATURIUM')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Azelaic Topical Acid' },
    });
    expect(specimen).toHaveAttribute('data-specimen-product', 'Azelaic Topical Acid');
    expect(within(specimen).getByText('AZELAIC')).toBeVisible();

    registerProduct();
    expect(events.filter((event) => event.type === 'REGISTER_PRODUCT')).toHaveLength(1);
    expect(currentMachine()).toBe(machine);
    expect(currentSpecimen()).toBe(specimen);
    expect(machine).toHaveAttribute('data-trial-machine-state', 'baseline-ready');
    expect(machine).toHaveAttribute('data-ingestion-phase', 'materializing');
    expect(specimen).toHaveAttribute('data-identity-lock-state', 'loading');
    expect(specimen).toHaveAttribute('data-specimen-brand', 'Naturium');
    expect(specimen).toHaveAttribute('data-specimen-product', 'Azelaic Topical Acid');
    expect(document.querySelectorAll('[data-oracle-machine]')).toHaveLength(1);
  });

  it('formats long commercial identities as compact evidence labels without changing source data', () => {
    renderApplication();
    enterRegistration();
    fillRequiredProduct('The Ordinary', 'The Ordinary Glycolic Acid 5%');

    const specimen = currentSpecimen();
    expect(specimen).toHaveAttribute('data-specimen-product', 'The Ordinary Glycolic Acid 5%');
    expect(specimen).toHaveAttribute('data-display-product', 'GLYCOLIC ACID');
    expect(specimen).toHaveAttribute('data-display-strength', '5');
    expect(within(specimen).getByText('GLYCOLIC ACID')).toBeVisible();
    expect(within(specimen).getByText('5')).toBeVisible();

    fillRequiredProduct(
      'Clinical Laboratory',
      'Clinical Laboratory Azelaic Topical Acid Barrier 10%',
    );
    expect(specimen).toHaveAttribute(
      'data-specimen-product',
      'Clinical Laboratory Azelaic Topical Acid Barrier 10%',
    );
    expect(specimen).toHaveAttribute('data-display-product', 'AZELAIC');
    expect(specimen).toHaveAttribute('data-display-strength', '10');
  });

  it('preserves existing validation messages and invalid-field focus order', () => {
    renderApplication();
    enterRegistration();

    registerProduct();
    const brand = screen.getByRole('textbox', { name: /^Brand/ });
    expect(brand).toHaveFocus();
    expect(screen.getByText('Enter the product brand.')).toBeVisible();

    fireEvent.change(brand, { target: { value: 'Naturium' } });
    registerProduct();
    const productName = screen.getByRole('textbox', {
      name: /^Product name/,
    });
    expect(productName).toHaveFocus();
    expect(screen.getByText('Enter the product name.')).toBeVisible();
  });

  it('runs materializing, loading, locking, confirming, and ready in order', () => {
    vi.useFakeTimers();
    const { events } = renderApplication();
    enterRegistration();
    fillRequiredProduct();
    registerProduct();
    const machine = currentMachine();
    const action = screen.getByRole('button', {
      name: 'TAKE GUIDED BASELINE',
    });

    expect(machine).toHaveAttribute('data-ingestion-phase', 'materializing');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'loading');
    expect(currentSpecimen()).toHaveAttribute('data-label-scan-active', 'false');
    expect(action).toBeDisabled();

    act(() => vi.advanceTimersByTime(specimenIngestionTiming.loadingStart));
    expect(machine).toHaveAttribute('data-ingestion-phase', 'loading');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'loading');
    expect(within(machine).getByText('LOADING SPECIMEN')).toBeVisible();
    expect(action).toBeDisabled();

    act(() =>
      vi.advanceTimersByTime(
        specimenIngestionTiming.lockingStart - specimenIngestionTiming.loadingStart,
      ),
    );
    expect(machine).toHaveAttribute('data-ingestion-phase', 'locking');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locking');
    expect(currentSpecimen()).toHaveAttribute('data-label-scan-active', 'true');
    expect(within(machine).getByText('IDENTITY LOCKING')).toBeVisible();
    expect(action).toBeDisabled();

    act(() =>
      vi.advanceTimersByTime(
        specimenIngestionTiming.confirmingStart - specimenIngestionTiming.lockingStart,
      ),
    );
    expect(machine).toHaveAttribute('data-ingestion-phase', 'confirming');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locked');
    expect(currentSpecimen()).toHaveAttribute('data-label-scan-active', 'false');
    expect(within(machine).getByText('CONFIRMING')).toBeVisible();
    expect(action).toBeDisabled();

    act(() =>
      vi.advanceTimersByTime(
        specimenIngestionTiming.readyStart - specimenIngestionTiming.confirmingStart,
      ),
    );
    expect(machine).toHaveAttribute('data-ingestion-phase', 'ready');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locked');
    expect(currentSpecimen()).toHaveAttribute('data-label-scan-active', 'false');
    expect(within(machine).getByText('READY TO SCAN')).toBeVisible();
    expect(action).toBeEnabled();
    expect(
      screen.getByText('Specimen loaded. Ready to take the baseline scan.'),
    ).toBeInTheDocument();

    act(() => {
      action.click();
      action.click();
    });
    expect(
      events.filter((event) => event.type === 'BEGIN_CAPTURE' && event.kind === 'baseline'),
    ).toHaveLength(1);
  });

  it('renders direct job and Demo Lab product_registered entry ready without replay', () => {
    const ordinary = renderApplication(registeredJobState());
    expect(currentMachine()).toHaveAttribute('data-ingestion-phase', 'ready');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locked');
    expect(within(currentMachine()).getByText('READY TO SCAN')).toBeVisible();
    expect(screen.queryByText('PREPARING SPECIMEN')).not.toBeInTheDocument();
    ordinary.unmount();

    const demoState = buildDemoFixtureState('product_registered', 'clear_favorable_change');
    renderApplication(demoState, {
      mode: 'preview',
      startingPoint: 'product_registered',
      resultFixture: 'clear_favorable_change',
      fixtureNow: null,
    });
    expect(currentMachine()).toHaveAttribute('data-ingestion-phase', 'ready');
    expect(currentSpecimen()).toHaveAttribute(
      'data-specimen-brand',
      demoState.registeredProduct?.brand,
    );
  });

  it('uses the reduced-motion resolution without travel phases', () => {
    vi.useFakeTimers();
    installMatchMedia(true);
    renderApplication();
    enterRegistration();
    fillRequiredProduct();
    registerProduct();

    expect(currentMachine()).toHaveAttribute('data-ingestion-phase', 'materializing');
    act(() => vi.advanceTimersByTime(79));
    expect(currentMachine()).toHaveAttribute('data-ingestion-phase', 'materializing');
    act(() => vi.advanceTimersByTime(1));
    expect(currentMachine()).toHaveAttribute('data-ingestion-phase', 'ready');
    expect(currentSpecimen()).toHaveAttribute('data-label-scan-active', 'false');
    expect(screen.queryByText('LOADING SPECIMEN')).not.toBeInTheDocument();
    expect(screen.queryByText('IDENTITY LOCKING')).not.toBeInTheDocument();
  });

  it('cancels ingestion on Edit product and restores committed form values', () => {
    vi.useFakeTimers();
    renderApplication();
    enterRegistration();
    fillRequiredProduct();
    fireEvent.change(screen.getByLabelText('Strength or concentration'), {
      target: { value: '10%' },
    });
    registerProduct();
    act(() => vi.advanceTimersByTime(200));
    expect(currentMachine()).toHaveAttribute('data-ingestion-phase', 'loading');

    fireEvent.click(screen.getByRole('button', { name: 'Edit product' }));
    expect(currentMachine()).toHaveAttribute('data-trial-machine-state', 'registration-preview');
    expect(currentMachine()).toHaveAttribute('data-ingestion-phase', 'idle');
    expect(screen.getByLabelText('Brand')).toHaveValue('Naturium');
    expect(screen.getByLabelText('Product name')).toHaveValue('Azelaic Topical Acid');
    expect(screen.getByLabelText('Strength or concentration')).toHaveValue('10%');

    act(() => vi.advanceTimersByTime(2_000));
    expect(currentMachine()).toHaveAttribute('data-trial-machine-state', 'registration-preview');
    expect(screen.queryByText('READY TO SCAN')).not.toBeInTheDocument();
  });

  it('preserves the memory-only draft across Back while the scene stays mounted', () => {
    const machine = (() => {
      renderApplication();
      return currentMachine();
    })();
    enterRegistration();
    fireEvent.change(screen.getByLabelText('Brand'), {
      target: { value: 'Draft Laboratory' },
    });
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(currentMachine()).toBe(machine);
    expect(currentMachine()).toHaveAttribute('data-trial-machine-state', 'empty');

    enterRegistration();
    expect(currentMachine()).toBe(machine);
    expect(screen.getByLabelText('Brand')).toHaveValue('Draft Laboratory');
    expect(currentSpecimen()).toHaveAttribute('data-specimen-brand', 'Draft Laboratory');
    expect(localStorage.getItem('face-value:structured-demo:v1')).toBeNull();
  });

  it('contains one product-ready implementation and no legacy success screen', () => {
    renderApplication(registeredJobState());
    expect(document.querySelectorAll('[data-oracle-machine]')).toHaveLength(1);
    expect(screen.queryByText('PRODUCT REGISTERED')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Your product is ready.' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/technical work automatically/i)).not.toBeInTheDocument();
  });
});
