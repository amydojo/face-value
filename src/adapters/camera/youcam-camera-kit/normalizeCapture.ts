import {
  YOUCAM_MAX_FILE_BYTES,
  isSupportedImageType,
} from '../../analysis/youcam/contracts';
import type { CameraKitCapturePayload } from './types';

export const YOUCAM_HD_MINIMUM_SHORT_SIDE = 1080;

export class CameraKitCaptureError extends Error {
  readonly code = 'invalid_camera_kit_capture';

  constructor(message: string) {
    super(message);
    this.name = 'CameraKitCaptureError';
  }
}

export function normalizeCameraKitCapture(
  payload: CameraKitCapturePayload,
): Blob {
  const capture = payload.images?.[0];
  if (!capture || !(capture.image instanceof Blob)) {
    throw new CameraKitCaptureError('Camera Kit did not return a Blob image.');
  }

  const width = Number(capture.width);
  const height = Number(capture.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    Math.min(width, height) < YOUCAM_HD_MINIMUM_SHORT_SIDE
  ) {
    throw new CameraKitCaptureError(
      'Camera Kit did not return an HD analysis-compatible resolution.',
    );
  }

  if (
    !isSupportedImageType(capture.image.type) ||
    capture.image.size <= 0 ||
    capture.image.size > YOUCAM_MAX_FILE_BYTES
  ) {
    throw new CameraKitCaptureError(
      'Camera Kit returned an unsupported image payload.',
    );
  }

  return capture.image;
}
