import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { FaceValueProvider } from '../app/FaceValueProvider';
import { StageFocusManager } from '../app/StageFocusManager';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { CameraViewport } from '../features/capture-contract/CameraViewport';
import { EvidenceCassetteSelector, EvidenceInstrument } from '../features/evidence-instrument/EvidenceInstrument';
import { PRODUCTS } from '../fixtures/products';

it('supports finite keyboard-accessible trial controls with human names', async () => {
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
  expect(screen.getByRole('button', { name: 'Previous trial' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next trial' }));
  expect(next).toHaveBeenCalledOnce();
  expect(screen.getByRole('region', { name: /Trial 1 of 3/i })).toBeInTheDocument();
  expect(screen.getByText('TRIAL 01 / 03')).toBeVisible();
  expect(screen.getByText('Pull to view trial')).toBeVisible();
  expect(screen.queryByText(/INSPECT CASSETTE/i)).not.toBeInTheDocument();
});

it('reserves activation for the explicit trial handle', async () => {
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

  const handle = screen.getByRole('button', { name: 'View trial for Fermented Brightening Essence' });
  expect(handle).toHaveAttribute('data-cassette-handle');
  expect(container.querySelectorAll('[data-cassette-handle]')).toHaveLength(1);
  await user.click(handle);
  expect(inspect).toHaveBeenCalledOnce();
});

it('exposes trial, ready, and saved-result states without relying on color', () => {
  const action = vi.fn();
  const { rerender } = render(<EvidenceInstrument specimen={PRODUCTS[0]} mode="index" onActivate={action} />);
  expect(screen.getByLabelText(/Product trial A1–03.*TRIAL SELECTED/i)).toBeVisible();
  rerender(<EvidenceInstrument specimen={PRODUCTS[0]} mode="active" onActivate={action} />);
  expect(screen.getByLabelText(/TRIAL IN PROGRESS/i)).toBeVisible();
  rerender(<EvidenceInstrument specimen={PRODUCTS[0]} mode="review-due" onActivate={action} />);
  expect(screen.getByLabelText(/READY TO COMPARE/i)).toBeVisible();
  rerender(<EvidenceInstrument specimen={PRODUCTS[0]} mode="classified" outputReady onActivate={action} />);
  expect(screen.getByLabelText(/SAVED RESULT/i)).toBeVisible();
  expect(screen.getByText('SAVED RESULT READY')).toBeInTheDocument();
});

it('does not render a semantic handle when an object has no meaningful action', () => {
  const { container } = render(<EvidenceInstrument specimen={PRODUCTS[0]} state="sealed" />);
  expect(container.querySelector('[data-cassette-handle]')).toBeNull();
});

it('explains two active products once in human language', () => {
  render(
    <EvidenceInstrument
      specimen={PRODUCTS[0]}
      secondarySpecimen={PRODUCTS[1]}
      state="disturbed"
      mode="active"
      onActivate={vi.fn()}
    />,
  );
  expect(screen.getByLabelText(/TWO PRODUCTS ACTIVE/i)).toBeVisible();
  expect(screen.getByText('TWO PRODUCTS ACTIVE')).toBeInTheDocument();
  expect(screen.queryByText(/INTERFERENCE REGISTERED/i)).not.toBeInTheDocument();
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

it('moves focus to Your trials and removes duplicate action jargon', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <FaceValueProvider>
        <StageFocusManager />
        <FaceValueApplication />
      </FaceValueProvider>
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: 'VIEW YOUR TRIALS' }));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Your trials' })).toHaveFocus();
  });
  expect(screen.queryByText('9:41')).not.toBeInTheDocument();
  expect(document.querySelector('[data-fv-part="status-bar"]')).toBeNull();
  expect(document.body).not.toHaveTextContent(/NEXT VALID ACTION|INSPECT CASSETTE|EVIDENCE INDEX/i);
});
