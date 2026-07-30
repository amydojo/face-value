import type { CameraKitQualityPayload, GuidedCaptureQuality } from './types';

const accepted = new Set(['good', 'ok', 'valid', 'still']);

const normalizedValue = (value: unknown): string =>
  typeof value === 'string' ? value.toLowerCase().replaceAll(/[\s_-]/g, '') : '';

const isAccepted = (value: unknown): boolean => accepted.has(normalizedValue(value));

const distanceIssueFor = (value: unknown): GuidedCaptureQuality['distanceIssue'] => {
  const normalized = normalizedValue(value);
  if (['toosmall', 'toofar', 'far'].includes(normalized)) return 'too-far';
  if (['toobig', 'toolarge', 'tooclose', 'close'].includes(normalized)) {
    return 'too-close';
  }
  return null;
};

const alignmentIssueFor = (value: unknown): GuidedCaptureQuality['alignmentIssue'] => {
  const normalized = normalizedValue(value);
  if (normalized === 'moveleft') return 'move-left';
  if (normalized === 'moveright') return 'move-right';
  if (['raise', 'moveup'].includes(normalized)) return 'raise-face';
  if (['lower', 'movedown'].includes(normalized)) return 'lower-face';
  return null;
};

const angleIssueFor = (frontal: unknown, pose: unknown): GuidedCaptureQuality['angleIssue'] => {
  if (!isAccepted(frontal)) return 'face-camera';
  const normalizedPose = normalizedValue(pose);
  if (normalizedPose && !isAccepted(pose)) return 'level-head';
  return null;
};

const lightingIssueFor = (value: unknown): GuidedCaptureQuality['lightingIssue'] => {
  const normalized = normalizedValue(value);
  if (['low', 'dark', 'underexposed', 'toolow'].includes(normalized)) {
    return 'low-light';
  }
  if (['backlight', 'backlit'].includes(normalized)) return 'backlight';
  return isAccepted(value) ? null : 'uneven-light';
};

/**
 * Vendor fields stop here. Face Value consumes only this normalized model, so
 * no presentation component depends on Camera Kit strings.
 *
 * Camera Kit 2.5 reports `size` separately in the installed runtime even
 * though older public payloads folded too-small into `position`; both shapes
 * are handled without guessing numeric SDK values. The SDK exposes neither
 * motion nor face bounds in this profile, so the acquisition machine proves
 * stillness over time and the generic bounds slot remains empty.
 */
export function normalizeSdkCaptureResult(
  payload: CameraKitQualityPayload,
  resolutionAccepted: boolean,
): GuidedCaptureQuality {
  const facePresent = payload.hasFace === true;
  const position = normalizedValue(payload.position);
  const explicitSize = normalizedValue(payload.size);
  const distanceSource = explicitSize || position;
  const distanceIssue = distanceIssueFor(distanceSource);
  const distanceValid =
    facePresent &&
    (explicitSize
      ? isAccepted(payload.size)
      : isAccepted(payload.position) || (position.length > 0 && distanceIssue === null));
  const alignmentValid =
    facePresent && (isAccepted(payload.position) || (!explicitSize && distanceIssue !== null));
  const angleIssue = angleIssueFor(payload.frontal, payload.pose);
  const angleValid = facePresent && angleIssue === null;
  const lightingIssue = lightingIssueFor(payload.lighting);
  const lightingValid = facePresent && lightingIssue === null;
  const requiredSignalsValid =
    facePresent &&
    distanceValid &&
    alignmentValid &&
    angleValid &&
    lightingValid &&
    resolutionAccepted;
  const stillnessValid = requiredSignalsValid;
  const ready = requiredSignalsValid && stillnessValid;

  return {
    quality: {
      facePresent,
      distanceValid,
      alignmentValid,
      angleValid,
      lightingValid,
      stillnessValid,
    },
    distanceIssue,
    alignmentIssue: alignmentIssueFor(payload.position),
    angleIssue,
    lightingIssue,
    faceBounds: null,
    registeredRegions: [],
    ready,
  };
}

export const normalizeCameraKitQuality = normalizeSdkCaptureResult;

export const emptyGuidedCaptureQuality = (): GuidedCaptureQuality => ({
  quality: {
    facePresent: false,
    distanceValid: false,
    alignmentValid: false,
    angleValid: false,
    lightingValid: false,
    stillnessValid: false,
  },
  distanceIssue: null,
  alignmentIssue: null,
  angleIssue: null,
  lightingIssue: null,
  faceBounds: null,
  registeredRegions: [],
  ready: false,
});
