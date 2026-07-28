import type { CameraCaptureProfileId } from '../../../domain/model';

export interface CameraKitCaptureProfile {
  id: CameraCaptureProfileId;
  faceDetectionMode: 'hdskincare';
  videoQuality: '1080p' | '1920p';
  imageFormat: 'blob';
  qualityLevel: 'moderate';
  countingDuration: 800;
  hideFlipCameraButton: true;
  disableCameraResolutionCheck: false;
}

export const CAMERA_KIT_HD_1080_PROFILE: CameraKitCaptureProfile = {
  id: 'youcam-camera-kit-hd-1080p',
  faceDetectionMode: 'hdskincare',
  videoQuality: '1080p',
  imageFormat: 'blob',
  qualityLevel: 'moderate',
  countingDuration: 800,
  hideFlipCameraButton: true,
  disableCameraResolutionCheck: false,
};

export const CAMERA_KIT_HD_1920_PROFILE: CameraKitCaptureProfile = {
  ...CAMERA_KIT_HD_1080_PROFILE,
  id: 'youcam-camera-kit-hd-1920p',
  videoQuality: '1920p',
};

export function isIPhoneSafari(
  navigatorObject: Pick<Navigator, 'userAgent' | 'vendor'>,
): boolean {
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
  navigatorObject =
    typeof navigator === 'undefined'
      ? { userAgent: '', vendor: '' }
      : navigator,
  highResolutionProven = false,
}: {
  frozenCaptureProfileId?: CameraCaptureProfileId | null;
  navigatorObject?: Pick<Navigator, 'userAgent' | 'vendor'>;
  highResolutionProven?: boolean;
} = {}): CameraKitCaptureProfile {
  if (frozenCaptureProfileId === CAMERA_KIT_HD_1920_PROFILE.id) {
    return CAMERA_KIT_HD_1920_PROFILE;
  }
  if (frozenCaptureProfileId === CAMERA_KIT_HD_1080_PROFILE.id) {
    return CAMERA_KIT_HD_1080_PROFILE;
  }
  if (!isIPhoneSafari(navigatorObject) && highResolutionProven) {
    return CAMERA_KIT_HD_1920_PROFILE;
  }
  return CAMERA_KIT_HD_1080_PROFILE;
}
