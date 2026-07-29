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
import {
  specimenRegistrationMilestones,
  specimenRegistrationTiming,
} from '../domain/specimenRegistration';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';

const normalRegistrationMilestones = specimenRegistrationMilestones(
  specimenRegistrationTiming.normal,
);

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
    expect(specimen).toHaveAttribute('data-display-brand', 'NATURIUM');
    expect(within(specimen).queryByText('NATURIUM')).not.toBeInTheDocument();

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
    expect(machine).toHaveAttribute('data-registration-phase', 'preparing');
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
    expect(specimen).toHaveAttribute('data-display-strength', '5%');
    expect(specimen.querySelector('[data-label-product]')).toHaveTextContent('GLYCOLIC ACID');
    expect(within(specimen).getByText('5%')).toBeVisible();

    fillRequiredProduct(
      'Clinical Laboratory',
      'Clinical Laboratory Azelaic Topical Acid Barrier 10%',
    );
    expect(specimen).toHaveAttribute(
      'data-specimen-product',
      'Clinical Laboratory Azelaic Topical Acid Barrier 10%',
    );
    expect(specimen).toHaveAttribute('data-display-product', 'AZELAIC');
    expect(specimen).toHaveAttribute('data-display-strength', '10%');
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

  it('runs the exact 3.8-second registration ceremony and unlocks the CTA only at ready', () => {
    vi.useFakeTimers();
    const { events } = renderApplication();
    enterRegistration();
    fillRequiredProduct();
    registerProduct();
    const machine = currentMachine();
    const action = screen.getByRole('button', {
      name: 'TAKE GUIDED BASELINE',
    });

    const status = screen.getByRole('status');

    expect(machine).toHaveAttribute('data-registration-phase', 'preparing');
    expect(machine).toHaveAttribute('data-registration-active', 'true');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'loading');
    expect(currentSpecimen()).toHaveAttribute('data-scan-state', 'inactive');
    expect(within(machine).getByText('PREPARING')).toBeVisible();
    expect(within(machine).getByText('INITIALIZING')).toBeVisible();
    expect(status).toHaveTextContent('Preparing specimen registration.');
    expect(action).toBeDisabled();

    act(() => vi.advanceTimersByTime(normalRegistrationMilestones.aligning));
    expect(machine).toHaveAttribute('data-registration-phase', 'aligning');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'loading');
    expect(within(machine).getByText('ALIGNING SPECIMEN')).toBeVisible();
    expect(within(machine).getByText('CALIBRATING')).toBeVisible();
    expect(status).toHaveTextContent('Preparing specimen registration.');
    expect(action).toBeDisabled();

    act(() =>
      vi.advanceTimersByTime(
        normalRegistrationMilestones.scanning - normalRegistrationMilestones.aligning,
      ),
    );
    expect(machine).toHaveAttribute('data-registration-phase', 'scanning');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locking');
    expect(currentSpecimen()).toHaveAttribute('data-scan-state', 'active');
    expect(within(machine).getByText('REGISTERING SPECIMEN')).toBeVisible();
    expect(within(machine).getByText('SCANNING')).toBeVisible();
    expect(status).toHaveTextContent('Registering specimen.');
    expect(action).toBeDisabled();

    act(() =>
      vi.advanceTimersByTime(
        normalRegistrationMilestones.processing - normalRegistrationMilestones.scanning,
      ),
    );
    expect(machine).toHaveAttribute('data-registration-phase', 'processing');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locked');
    expect(currentSpecimen()).toHaveAttribute('data-scan-state', 'inactive');
    expect(currentSpecimen()).toHaveAttribute('data-scan-progress', '1.000');
    expect(within(machine).getByText('VERIFYING SPECIMEN')).toBeVisible();
    expect(within(machine).getByText('PROCESSING')).toBeVisible();
    expect(status).toHaveTextContent('Registering specimen.');
    expect(action).toBeDisabled();

    act(() =>
      vi.advanceTimersByTime(
        normalRegistrationMilestones.verified - normalRegistrationMilestones.processing,
      ),
    );
    expect(machine).toHaveAttribute('data-registration-phase', 'verified');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locked');
    expect(currentSpecimen()).toHaveAttribute('data-registration-complete', 'false');
    expect(within(machine).getByText('SPECIMEN VERIFIED')).toBeVisible();
    expect(within(machine).getByText('REGISTERED')).toBeVisible();
    expect(status).toHaveTextContent('Specimen verified.');
    expect(action).toBeDisabled();

    act(() =>
      vi.advanceTimersByTime(
        normalRegistrationMilestones.ready - normalRegistrationMilestones.verified,
      ),
    );
    expect(machine).toHaveAttribute('data-registration-phase', 'ready');
    expect(machine).toHaveAttribute('data-registration-complete', 'true');
    expect(currentSpecimen()).toHaveAttribute('data-scan-state', 'inactive');
    expect(within(machine).getByText('READY TO SCAN')).toBeVisible();
    expect(action).toBeEnabled();
    expect(status).toHaveTextContent('Ready to take guided baseline.');

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
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'ready');
    expect(currentSpecimen()).toHaveAttribute('data-identity-lock-state', 'locked');
    expect(within(currentMachine()).getByText('READY TO SCAN')).toBeVisible();
    expect(screen.queryByText('PREPARING')).not.toBeInTheDocument();
    ordinary.unmount();

    const demoState = buildDemoFixtureState('product_registered', 'clear_favorable_change');
    renderApplication(demoState, {
      mode: 'preview',
      startingPoint: 'product_registered',
      resultFixture: 'clear_favorable_change',
      fixtureNow: null,
    });
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'ready');
    expect(currentSpecimen()).toHaveAttribute(
      'data-specimen-brand',
      demoState.registeredProduct?.brand,
    );
  });

  it('uses the 1.35-second reduced-motion sequence with semantic phases and a soft wash', () => {
    vi.useFakeTimers();
    installMatchMedia(true);
    renderApplication();
    enterRegistration();
    fillRequiredProduct();
    registerProduct();

    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'preparing');
    act(() => vi.advanceTimersByTime(149));
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'preparing');
    act(() => vi.advanceTimersByTime(1));
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'aligning');
    act(() => vi.advanceTimersByTime(150));
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'scanning');
    expect(currentSpecimen()).toHaveAttribute('data-scan-state', 'wash');
    act(() => vi.advanceTimersByTime(450));
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'processing');
    act(() => vi.advanceTimersByTime(250));
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'verified');
    expect(screen.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeDisabled();
    act(() => vi.advanceTimersByTime(350));
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'ready');
    expect(currentSpecimen()).toHaveAttribute('data-scan-state', 'inactive');
    expect(screen.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeEnabled();
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
    act(() => vi.advanceTimersByTime(400));
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'aligning');

    fireEvent.click(screen.getByRole('button', { name: 'Edit product' }));
    expect(currentMachine()).toHaveAttribute('data-trial-machine-state', 'registration-preview');
    expect(currentMachine()).toHaveAttribute('data-registration-phase', 'idle');
    expect(screen.getByLabelText('Brand')).toHaveValue('Naturium');
    expect(screen.getByLabelText('Product name')).toHaveValue('Azelaic Topical Acid');
    expect(screen.getByLabelText('Strength or concentration')).toHaveValue('10%');

    act(() => vi.advanceTimersByTime(5_000));
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
