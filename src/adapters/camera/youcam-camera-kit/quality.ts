import type {
  CameraKitQualityPayload,
  GuidedCaptureGuidance,
  GuidedCaptureQuality,
} from './types';

const acceptedLighting = new Set(['good', 'ok']);
const acceptedPosition = new Set(['good']);
const acceptedFrontal = new Set(['good']);

const normalizedValue = (value: unknown): string =>
  typeof value === 'string' ? value.toLowerCase().replaceAll('_', '') : '';

function guidanceFor(input: {
  payload: CameraKitQualityPayload;
  hasFace: boolean;
  positionAccepted: boolean;
  frontalAccepted: boolean;
  lightingAccepted: boolean;
  resolutionAccepted: boolean;
}): GuidedCaptureGuidance {
  const position = normalizedValue(input.payload.position);
  if (!input.hasFace || position === 'outofboundary') return 'center-face';
  if (position === 'toosmall') return 'move-closer';
  if (position === 'toobig' || position === 'toolarge') return 'move-back';
  if (!input.positionAccepted) return 'center-face';
  if (!input.frontalAccepted) return 'look-forward';
  if (!input.lightingAccepted) return 'more-light';
  if (!input.resolutionAccepted) return 'hold-still';
  return 'hold-still';
}

export function normalizeCameraKitQuality(
  payload: CameraKitQualityPayload,
  resolutionAccepted: boolean,
): GuidedCaptureQuality {
  const hasFace = payload.hasFace === true;
  const positionAccepted =
    hasFace && acceptedPosition.has(normalizedValue(payload.position));
  const frontalAccepted =
    hasFace && acceptedFrontal.has(normalizedValue(payload.frontal));
  const lightingAccepted =
    hasFace && acceptedLighting.has(normalizedValue(payload.lighting));
  const ready =
    hasFace &&
    positionAccepted &&
    frontalAccepted &&
    lightingAccepted &&
    resolutionAccepted;

  return {
    hasFace,
    positionAccepted,
    frontalAccepted,
    lightingAccepted,
    resolutionAccepted,
    ready,
    guidance: ready
      ? 'hold-still'
      : guidanceFor({
          payload,
          hasFace,
          positionAccepted,
          frontalAccepted,
          lightingAccepted,
          resolutionAccepted,
        }),
  };
}

export const emptyGuidedCaptureQuality = (): GuidedCaptureQuality => ({
  hasFace: false,
  positionAccepted: false,
  frontalAccepted: false,
  lightingAccepted: false,
  resolutionAccepted: false,
  ready: false,
  guidance: 'center-face',
});
