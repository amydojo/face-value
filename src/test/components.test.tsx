import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { FaceValueProvider } from '../app/FaceValueProvider';
import { StageFocusManager } from '../app/StageFocusManager';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { CameraViewport } from '../features/capture-contract/CameraViewport';

beforeEach(() => {
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
  expect(screen.getByLabelText('Choose a face photo')).toHaveAttribute('accept', 'image/jpeg,image/png,.jpg,.jpeg,.png');
  expect(screen.getByText(/Choose a photo instead/i)).toBeInTheDocument();
});

it('hands the file fallback off immediately without preview approval', async () => {
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
  await waitFor(() => expect(onAccepted).toHaveBeenCalledOnce());
  expect(
    screen.queryByRole('button', { name: /use this capture/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /delete current capture/i }),
  ).not.toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();
});

it('moves focus to Your trials and removes duplicate action jargon', async () => {
  const user = userEvent.setup();
  render(
    <FaceValueProvider>
      <StageFocusManager />
      <FaceValueApplication />
    </FaceValueProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Your trials' }));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Your trials' })).toHaveFocus();
  });
  expect(screen.queryByText('9:41')).not.toBeInTheDocument();
  expect(document.querySelector('[data-fv-part="status-bar"]')).toBeNull();
  expect(document.body).not.toHaveTextContent(/NEXT VALID ACTION|INSPECT CASSETTE|EVIDENCE INDEX/i);
});
