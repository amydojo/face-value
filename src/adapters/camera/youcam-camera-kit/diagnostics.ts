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
): CameraKitDiagnostic {
  const diagnostic = { stage, captureProfileId };
  if (typeof console !== 'undefined') {
    console.info('[face-value-camera-kit]', diagnostic);
  }
  return diagnostic;
}
