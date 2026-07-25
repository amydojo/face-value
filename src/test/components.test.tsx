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

it('reserves cassette activation for the explicit index handle', async () => {
  const user = userEvent.setup();
  const inspect = vi.fn();
  const { container } = render(
    <EvidenceCassetteSelector
      products={PRODUCTS}
      index={0}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onInspect={inspect}
    />,
  );

  const selectorSurface = container.querySelector('[data-cassette-selector] > div');
  expect(selectorSurface).not.toHaveAttribute('data-cassette-handle');
  const handle = screen.getByRole('button', { name: 'Open evidence cassette A1–03' });
  expect(handle).toHaveAttribute('data-cassette-handle');
  expect(container.querySelectorAll('[data-cassette-handle]')).toHaveLength(1);
  await user.click(handle);
  expect(inspect).toHaveBeenCalledOnce();
});

it('exposes index, active, review-due, and classified cassette semantics without relying on color', () => {
  const { rerender } = render(<EvidenceInstrument specimen={PRODUCTS[0]} mode="index" />);
  expect(screen.getByLabelText(/Evidence cassette A1–03.*INDEXED/i)).toBeVisible();
  rerender(<EvidenceInstrument specimen={PRODUCTS[0]} mode="active" />);
  expect(screen.getByLabelText(/ACTIVE OBSERVATION/i)).toBeVisible();
  rerender(<EvidenceInstrument specimen={PRODUCTS[0]} mode="review-due" />);
  expect(screen.getByLabelText(/REVIEW DUE/i)).toBeVisible();
  rerender(<EvidenceInstrument specimen={PRODUCTS[0]} mode="classified" outputReady />);
  expect(screen.getByLabelText(/CLASSIFIED/i)).toBeVisible();
  expect(screen.getByText('EVIDENCE RECORD READY')).toBeInTheDocument();
});

it('exposes disturbed cassette semantics without relying on color', () => {
  render(<EvidenceInstrument specimen={PRODUCTS[0]} secondarySpecimen={PRODUCTS[1]} state="disturbed" />);
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

it('moves focus to the semantic Evidence Index heading and removes fake system chrome', async () => {
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
  expect(screen.queryByText('9:41')).not.toBeInTheDocument();
  expect(document.querySelector('[data-fv-part="status-bar"]')).toBeNull();
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
