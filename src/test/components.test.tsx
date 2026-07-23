import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { FaceValueProvider } from '../app/FaceValueProvider';
import { StageFocusManager } from '../app/StageFocusManager';
import { DrawerCarousel } from '../components/DrawerCarousel';
import { ObservationStatus } from '../components/hardware';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { CameraViewport } from '../features/capture-contract/CameraViewport';
import { PRODUCTS } from '../fixtures/products';

it('supports keyboard-accessible finite drawer controls with accessible names', async () => {
  const user = userEvent.setup();
  const next = vi.fn();
  render(
    <DrawerCarousel
      products={PRODUCTS}
      index={0}
      onPrevious={vi.fn()}
      onNext={next}
      onOpen={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Previous drawer' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next drawer' }));
  expect(next).toHaveBeenCalled();
  expect(screen.getByRole('region', { name: /Drawer 1 of 3/i })).toBeInTheDocument();
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

it('moves focus to the next valid action without scrolling the cabinet', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <FaceValueProvider>
        <StageFocusManager />
        <FaceValueApplication />
      </FaceValueProvider>
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: 'Open the Evidence Fridge' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Browse indexed drawers' })).toHaveFocus();
  });
});
