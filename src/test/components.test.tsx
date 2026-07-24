import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { FaceValueProvider } from '../app/FaceValueProvider';
import { StageFocusManager } from '../app/StageFocusManager';
import { EvidenceDisposition, ObservationStatus } from '../components/hardware';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { CameraViewport } from '../features/capture-contract/CameraViewport';
import { EvidenceCassetteSelector, EvidenceInstrument } from '../features/evidence-instrument/EvidenceInstrument';
import { PRODUCTS } from '../fixtures/products';

it('supports finite keyboard-accessible cassette controls with clear names', async () => {
  const user = userEvent.setup();
  const next = vi.fn();
  render(
    <EvidenceCassetteSelector
      products={PRODUCTS}
      index={0}
      onPrevious={vi.fn()}
      onNext={next}
      onInspect={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Previous cassette' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next cassette' }));
  expect(next).toHaveBeenCalledOnce();
  expect(screen.getByRole('region', { name: /Cassette 1 of 3/i })).toBeInTheDocument();
  expect(screen.getByText('CASSETTE 01 / 03')).toBeVisible();
});

it('keeps below-threshold selector drag deterministic and activates past threshold', () => {
  const previous = vi.fn();
  const next = vi.fn();
  const { container } = render(
    <EvidenceCassetteSelector
      products={PRODUCTS}
      index={1}
      onPrevious={previous}
      onNext={next}
      onInspect={vi.fn()}
    />,
  );
  const target = container.querySelector('[data-cassette-selector] > div');
  if (!(target instanceof HTMLElement)) throw new Error('Selector target missing');

  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(target, { pointerId: 1, clientX: 120, clientY: 101 });
  expect(previous).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();

  fireEvent.pointerDown(target, { pointerId: 2, button: 0, clientX: 150, clientY: 100 });
  fireEvent.pointerUp(target, { pointerId: 2, clientX: 94, clientY: 101 });
  expect(next).toHaveBeenCalledOnce();
});

it('exposes active and disturbed cassette semantics without relying on color', () => {
  const { rerender } = render(<EvidenceInstrument specimen={PRODUCTS[0]} state="active" />);
  expect(screen.getByLabelText(/Evidence cassette A1–03.*ACTIVE OBSERVATION/i)).toBeVisible();
  rerender(<EvidenceInstrument specimen={PRODUCTS[0]} secondarySpecimen={PRODUCTS[1]} state="disturbed" />);
  expect(screen.getByLabelText(/OBSERVATION DISTURBED/i)).toBeVisible();
  expect(screen.getByText('INTERFERENCE REGISTERED')).toBeInTheDocument();
});

it('keeps file fallback available when camera is denied', () => {
  render(
    <CameraViewport
      kind="baseline"
      cameraState="denied"
      onRequesting={vi.fn()}
      onReady={vi.fn()}
      onCapturing={vi.fn()}
      onFailure={vi.fn()}
      onAccepted={vi.fn()}
      onDelete={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('Choose a face photo')).toHaveAttribute('accept', 'image/*');
  expect(screen.getByText(/Choose a photo instead/i)).toBeInTheDocument();
  expect(screen.getByText(/BASELINE OBSERVATION CAPTURE/i)).toBeInTheDocument();
});

it('allows a pending private capture to be deleted before acceptance', async () => {
  const user = userEvent.setup();
  const onAccepted = vi.fn();
  const onDelete = vi.fn();
  render(
    <CameraViewport
      kind="baseline"
      cameraState="idle"
      onRequesting={vi.fn()}
      onReady={vi.fn()}
      onCapturing={vi.fn()}
      onFailure={vi.fn()}
      onAccepted={onAccepted}
      onDelete={onDelete}
      onBack={vi.fn()}
    />,
  );

  await user.upload(
    screen.getByLabelText('Choose a face photo'),
    new File(['fixture'], 'capture.jpg', { type: 'image/jpeg' }),
  );
  expect(screen.getByRole('button', { name: 'Use this capture' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Delete current capture' }));
  expect(onDelete).toHaveBeenCalledOnce();
  expect(onAccepted).not.toHaveBeenCalled();
});

it('provides visible text equivalents for comparison and confidence states', () => {
  render(
    <ObservationStatus
      observation="active_disturbed"
      comparison="partially_comparable"
      confidence="possible"
    />,
  );
  expect(screen.getByText('active disturbed')).toBeVisible();
  expect(screen.getByText('partially comparable')).toBeVisible();
  expect(screen.getByText('possible')).toBeVisible();
});

it('keeps disposition in an explicit committing phase until classification completes', () => {
  vi.useFakeTimers();
  const onClassify = vi.fn();
  const props = {
    placement: 'established' as const,
    classified: false,
    onSelect: vi.fn(),
    onClassify,
    onGenerate: vi.fn(),
  };
  const { rerender } = render(<EvidenceDisposition {...props} />);

  fireEvent.click(screen.getByRole('button', { name: 'Commit evidence disposition' }));
  expect(screen.getByRole('region', { name: /CLASSIFY THE CASSETTE/i })).toHaveAttribute(
    'data-fv-disposition-state',
    'committing',
  );
  expect(screen.getByRole('button', { name: 'Evidence classification in progress' })).toBeDisabled();

  act(() => vi.advanceTimersByTime(519));
  expect(onClassify).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onClassify).toHaveBeenCalledOnce();

  rerender(<EvidenceDisposition {...props} classified />);
  expect(screen.getByRole('region', { name: /EVIDENCE DISPOSITION COMMITTED/i })).toHaveAttribute(
    'data-fv-disposition-state',
    'classified',
  );
  vi.useRealTimers();
});

it('moves focus to the semantic Evidence Index heading', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <FaceValueProvider>
        <StageFocusManager />
        <FaceValueApplication />
      </FaceValueProvider>
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'EVIDENCE INDEX' })).toHaveFocus();
  });
});

it('removes obsolete appliance and furniture language from the rendered journey', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <FaceValueProvider>
        <FaceValueApplication />
      </FaceValueProvider>
    </MemoryRouter>,
  );
  expect(document.body).not.toHaveTextContent(/fridge|drawer|cabinet/i);
  await user.click(screen.getByRole('button', { name: /OPEN EVIDENCE INDEX/i }));
  expect(document.body).not.toHaveTextContent(/fridge|drawer|cabinet/i);
  expect(screen.getAllByText(/cassette/i).length).toBeGreaterThan(0);
});
