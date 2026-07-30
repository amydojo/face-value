import type {
  CameraKitDiagnostic,
  CameraKitDiagnosticStage,
} from './types';
import type { CameraCaptureProfileId } from '../../../domain/model';

export type CameraKitDiagnosticSink = (
  diagnostic: CameraKitDiagnostic,
) => void;

export function logSafeCameraKitDiagnostic(
  stage: CameraKitDiagnosticStage,
  captureProfileId: CameraCaptureProfileId,
  surface?: {
    type: CameraKitDiagnostic['surfaceType'];
    width: number;
    height: number;
  },
): CameraKitDiagnostic {
  const diagnostic: CameraKitDiagnostic = {
    stage,
    captureProfileId,
    ...(surface
      ? {
          surfaceType: surface.type,
          surfaceWidth: Math.round(surface.width),
          surfaceHeight: Math.round(surface.height),
        }
      : {}),
  };
  if (typeof console !== 'undefined') {
    console.info('[face-value-camera-kit]', diagnostic);
  }
  return diagnostic;
}
