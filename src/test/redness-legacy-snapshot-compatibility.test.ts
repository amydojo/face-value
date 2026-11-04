import { describe, expect, it } from 'vitest';
import {
  REDNESS_ENGINE_VERSION,
  isRednessEvaluationSnapshot,
  type RednessEvaluationSnapshot,
} from '../domain/evidence/redness';
import savedV1 from './fixtures/redness-snapshot-engine-v1.0.0.json';
import { surfacesFor } from './support/rednessScenarios';

// A snapshot saved by V1 (engine v1.0.0): live measurement, objective worsening, no symptoms.
// Saved records are immutable evidence and are never re-evaluated or rewritten.
describe('V1 saved snapshot compatibility', () => {
  const snapshot = structuredClone(savedV1) as unknown as RednessEvaluationSnapshot;

  it('still validates as a canonical snapshot', () => {
    expect(snapshot.engineVersion).toBe('face-value-redness-engine-v1.0.0');
    // Copy-corrected evaluations carry a newer engine version, so the two are distinguishable.
    expect(REDNESS_ENGINE_VERSION).not.toBe(snapshot.engineVersion);
    expect(isRednessEvaluationSnapshot(snapshot)).toBe(true);
  });

  it('renders its saved engine-authored words verbatim and is not mutated by rendering', () => {
    const before = JSON.stringify(snapshot);
    const surfaces = surfacesFor(snapshot);
    expect(surfaces.oracleHeadline).toBe(snapshot.interpretation.finding);
    expect(surfaces.oracleExplanation).toBe(snapshot.interpretation.explanation);
    expect(surfaces.recordHeadline).toBe(snapshot.interpretation.finding);
    expect(surfaces.recordSavedExplanation).toBe(snapshot.interpretation.explanation);
    expect(surfaces.previousTrialsVerdict).toBe(snapshot.interpretation.finding);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(JSON.stringify(snapshot)).toBe(JSON.stringify(savedV1));
  });
});
