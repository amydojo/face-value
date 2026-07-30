export type CapturePhase = 'searching' | 'aligning' | 'locking' | 'scanning' | 'captured' | 'error';

export type CaptureIssue =
  | 'face-missing'
  | 'position-face'
  | 'too-close'
  | 'too-far'
  | 'move-left'
  | 'move-right'
  | 'raise-face'
  | 'lower-face'
  | 'face-camera'
  | 'level-head'
  | 'low-light'
  | 'backlight'
  | 'uneven-light'
  | 'movement';

export interface CaptureQuality {
  facePresent: boolean;
  distanceValid: boolean;
  alignmentValid: boolean;
  angleValid: boolean;
  lightingValid: boolean;
  stillnessValid: boolean;
}

export interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CaptureRegion = 'forehead' | 'left-cheek' | 'right-cheek' | 'center' | 'chin';

export interface CaptureSignalSample {
  quality: CaptureQuality;
  /**
   * Camera Kit can verify face geometry. The native Safari fallback deliberately
   * verifies only the visible frame, lighting, and motion; it never represents
   * an operator-positioned face as vendor-verified geometry.
   */
  verificationMode?: 'face-quality' | 'frame-quality';
  frameReady?: boolean;
  distanceIssue?: Extract<CaptureIssue, 'too-close' | 'too-far'> | null;
  alignmentIssue?: Extract<
    CaptureIssue,
    'move-left' | 'move-right' | 'raise-face' | 'lower-face'
  > | null;
  angleIssue?: Extract<CaptureIssue, 'face-camera' | 'level-head'> | null;
  lightingIssue?: Extract<CaptureIssue, 'low-light' | 'backlight' | 'uneven-light'> | null;
  faceBounds?: FaceBounds | null;
  registeredRegions?: readonly CaptureRegion[];
}
