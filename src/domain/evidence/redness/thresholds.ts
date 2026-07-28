import type {
  EffectClassification,
  ObservationWindowDays,
  RednessThresholdConfiguration,
} from './types';

export const REDNESS_MVP_OBSERVATION_WINDOW: Readonly<ObservationWindowDays> = Object.freeze({
  minimum: 14,
  target: 28,
  maximum: 56,
});

// SHA-256 input:
// source=provisional_fixture;version=redness-provisional-v1;detectable=5;strong=10;provisional=true
export const PROVISIONAL_REDNESS_THRESHOLDS: Readonly<RednessThresholdConfiguration> =
  Object.freeze({
    version: 'redness-provisional-v1',
    source: 'provisional_fixture',
    provisionalDetectablePoints: 5,
    provisionalStrongPoints: 10,
    configHash: 'sha256:66571af3c662f4da1de469d763b884ad46eb37ee77df0aa060e4b2db280feed5',
    provisional: true,
  });

export const PROVISIONAL_THRESHOLD_NOTE = 'Production thresholds require repeat-scan calibration.';

export function activeDetectableBoundary(threshold: RednessThresholdConfiguration): number | null {
  if (threshold.source === 'provisional_fixture') {
    return threshold.provisionalDetectablePoints ?? null;
  }
  return threshold.activeN95 ?? null;
}

export function classifyProvisionalEffect(
  delta: number,
  detectableBoundary = 5,
  strongBoundary = 10,
): EffectClassification {
  if (delta <= -detectableBoundary) return 'worsened';
  if (delta < detectableBoundary) return 'no_detectable_change';
  if (delta < strongBoundary) return 'directional_improvement';
  return 'strong_improvement';
}

export function classifyCalibratedEffect(delta: number, activeN95: number): EffectClassification {
  if (delta <= -1 * activeN95) return 'worsened';
  if (delta < activeN95) return 'no_detectable_change';
  if (delta < 1.5 * activeN95) return 'directional_improvement';
  if (delta < 2 * activeN95) return 'meaningful_candidate';
  return 'strong_improvement';
}

export function classifyEffect(
  delta: number,
  threshold: RednessThresholdConfiguration,
): EffectClassification | null {
  if (!Number.isFinite(delta)) return null;
  if (threshold.source === 'provisional_fixture') {
    const detectable = threshold.provisionalDetectablePoints;
    const strong = threshold.provisionalStrongPoints;
    if (
      !detectable ||
      !strong ||
      !Number.isFinite(detectable) ||
      !Number.isFinite(strong) ||
      detectable <= 0 ||
      strong <= detectable
    ) {
      return null;
    }
    return classifyProvisionalEffect(delta, detectable, strong);
  }
  const activeN95 = threshold.activeN95;
  if (!activeN95 || !Number.isFinite(activeN95) || activeN95 <= 0) return null;
  return classifyCalibratedEffect(delta, activeN95);
}

export function evidenceStrengthRatio(
  delta: number | null,
  threshold: RednessThresholdConfiguration,
): number | undefined {
  if (delta === null) return undefined;
  const boundary = activeDetectableBoundary(threshold);
  if (!boundary || !Number.isFinite(boundary) || boundary <= 0) return undefined;
  return delta / boundary;
}
