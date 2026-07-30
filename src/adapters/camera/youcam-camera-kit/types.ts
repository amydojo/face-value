import type { CameraCaptureProfileId } from '../../../domain/model';
import type { CaptureSignalSample } from '../../../domain/captureAcquisition';

export type CameraKitEventName =
  | 'loaded'
  | 'cameraOpened'
  | 'cameraClosed'
  | 'cameraFailed'
  | 'unsupportedResolution'
  | 'faceQualityChanged'
  | 'faceDetectionCaptured';

export type CameraKitListenerIdentifier = unknown;

export interface CameraKitInitOptions {
  faceDetectionMode: 'skincare';
  imageFormat: 'blob';
  language: 'enu';
  qualityLevel: 'moderate';
  videoQuality: '720p';
  countingDuration: number;
  hideFlipCameraButton: true;
  disableCameraResolutionCheck: false;
  width: number;
  height: number;
}

export interface CameraKitQualityPayload {
  hasFace?: boolean;
  position?: string;
  frontal?: string;
  lighting?: string;
  pose?: string;
  size?: string | number;
}

export interface CameraKitCapturedImage {
  phase?: number;
  image?: unknown;
  width?: number;
  height?: number;
}

export interface CameraKitCapturePayload {
  mode?: string;
  images?: CameraKitCapturedImage[];
}

export interface YouCamCameraKitSdk {
  init(options: CameraKitInitOptions): void;
  openCameraKit(): void;
  close(): void;
  addEventListener(
    eventName: CameraKitEventName,
    listener: (payload: unknown) => void,
  ): CameraKitListenerIdentifier;
  removeEventListener(identifier: CameraKitListenerIdentifier): void;
  isLoaded(): boolean;
}

export interface CameraKitWindow extends Window {
  YMK?: YouCamCameraKitSdk;
  YMKAsyncInit?: () => void;
}

export interface GuidedCaptureQuality extends CaptureSignalSample {
  ready: boolean;
}

export type GuidedCaptureFailure =
  | 'sdk-unavailable'
  | 'unsupported-browser'
  | 'permission-denied'
  | 'camera-unavailable'
  | 'preview-stalled'
  | 'unsupported-resolution'
  | 'invalid-capture';

export interface GuidedCaptureSession {
  readonly captureProfileId: CameraCaptureProfileId;
  /**
   * Native camera sessions expose an explicit capture boundary so the Face
   * Value state machine owns lock/scan timing. Camera Kit sessions capture via
   * their documented event and leave this undefined.
   */
  capture?(): void;
  cancel(): void;
}

export type GuidedCaptureStatus =
  | 'loading'
  | 'requesting-permission'
  | 'camera-opening'
  | 'waiting-first-frame'
  | 'preview-live'
  | 'preview-stalled'
  | 'captured'
  | 'closed';

export type CameraKitDiagnosticStage =
  | 'sdk-loaded'
  | 'init-called'
  | 'camera-opened'
  | 'render-surface-observed'
  | 'preview-live'
  | 'first-quality-frame'
  | 'capture-event'
  | 'preview-stalled'
  | 'camera-closed';

export interface CameraKitDiagnostic {
  stage: CameraKitDiagnosticStage;
  captureProfileId: CameraCaptureProfileId;
  surfaceType?: 'video' | 'canvas' | 'iframe' | 'none';
  surfaceWidth?: number;
  surfaceHeight?: number;
}

export interface GuidedCaptureStartOptions {
  mountElement: HTMLElement;
  previewElement?: HTMLVideoElement | null;
  signal?: AbortSignal;
  stableForMs?: number;
  previewWatchdogMs?: number;
  frozenCaptureProfileId?: CameraCaptureProfileId | null;
  onQuality(quality: GuidedCaptureQuality): void;
  onCapture(image: Blob, captureProfileId: CameraCaptureProfileId): void;
  onFailure(failure: GuidedCaptureFailure): void;
  onStatus?(status: GuidedCaptureStatus): void;
  onDiagnostic?(diagnostic: CameraKitDiagnostic): void;
}

export interface CameraKitAdapter {
  start(options: GuidedCaptureStartOptions): Promise<GuidedCaptureSession>;
}
