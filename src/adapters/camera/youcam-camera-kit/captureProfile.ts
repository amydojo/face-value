import type { CameraCaptureProfileId } from '../../../domain/model';

export interface CameraKitCaptureProfile {
  id: CameraCaptureProfileId;
  faceDetectionMode: 'skincare';
  videoQuality: '720p';
  imageFormat: 'blob';
  qualityLevel: 'moderate';
  countingDuration: number;
  hideFlipCameraButton: true;
  disableCameraResolutionCheck: false;
}

export const CAMERA_KIT_STANDARD_720_PROFILE: CameraKitCaptureProfile = {
  id: 'youcam-camera-kit-standard-720p',
  faceDetectionMode: 'skincare',
  videoQuality: '720p',
  imageFormat: 'blob',
  qualityLevel: 'moderate',
  countingDuration: 2_400,
  hideFlipCameraButton: true,
  disableCameraResolutionCheck: false,
};

export function isIPhoneSafari(navigatorObject: Pick<Navigator, 'userAgent' | 'vendor'>): boolean {
  const userAgent = navigatorObject.userAgent;
  return (
    /iPhone|iPod/i.test(userAgent) &&
    /AppleWebKit/i.test(userAgent) &&
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent) &&
    /Apple/i.test(navigatorObject.vendor)
  );
}

export function selectCameraKitCaptureProfile({
  frozenCaptureProfileId,
  navigatorObject = typeof navigator === 'undefined' ? { userAgent: '', vendor: '' } : navigator,
  highResolutionProven = false,
}: {
  frozenCaptureProfileId?: CameraCaptureProfileId | null;
  navigatorObject?: Pick<Navigator, 'userAgent' | 'vendor'>;
  highResolutionProven?: boolean;
} = {}): CameraKitCaptureProfile {
  // Camera Kit's documented `hdskincare` contract requires a 2560px long
  // edge. Physical iPhones in this PR supplied 960–986 × 1920 and triggered
  // the vendor runtime's native resolution alert. The diagnostic harness uses
  // the documented standard skincare profile on every browser; production
  // capture is owned by NativeBrowserCameraAdapter.
  void frozenCaptureProfileId;
  void navigatorObject;
  void highResolutionProven;
  return CAMERA_KIT_STANDARD_720_PROFILE;
}
