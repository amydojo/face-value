import { describe, expect, it } from 'vitest';
import { buildTrialDiagnostics, captureDiagnostics, opticalEligibility, readCaptureDiagnostics } from '../features/local-optics/trialDiagnostics';
import { BASELINE_TEMPLATE_VERSION } from '../features/local-optics/guidance';
import { baselineMeasurement, newTrial, withBaseline, withConsent, withCheckIn, parseTrial } from '../features/local-optics/trialStore';
import { compareCaptures, type CaptureMeasurement } from '../features/local-optics/opticsMetrics';
const at = new Date('2026-11-23T12:00:00Z');
const trial = withConsent(withBaseline(newTrial({ name: 'PRIVATE PRODUCT', outcome: 'PRIVATE GOAL' }, at, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'), {
  version: BASELINE_TEMPLATE_VERSION, orientation: 'portrait', centerX: 0.5, centerY: 0.5, interocular: 0.3, roll: 0, yaw: 0, pitch: 0, faceLuma: 120, shading: 0.02,
}, { width: 360, height: 640 }, 'auto', at), at);
describe('FV06 diagnostic contract', () => {
  it('retains historical outcomes without fabricating details or leaking product text', () => {
    const historical = withCheckIn(trial, { at: at.toISOString(), trigger: 'manual', quality: 'passed', conditions: 'not_matched', reasons: ['distance'] }, at);
    const report = buildTrialDiagnostics(historical);
    expect(report.checkIns[0].diagnostics).toBeNull();
    expect(report.baseline?.diagnostics).toBeNull();
    expect(report.checkIns[0].comparisonEligibility).toBe('ineligible');
    expect(JSON.stringify(report)).not.toContain('PRIVATE');
    expect(report.skinMeasurementEligible).toBe(false);
  });
  it('round trips opted-in numeric data and strips unknown fields', () => {
    const base = baselineMeasurement(trial.baseline!);
    const other = { ...base, interocular: { value: 0.36, provenance: 'measured' as const } };
    const comparison = compareCaptures(base, other);
    const diagnostics = captureDiagnostics(other, comparison, null);
    if (!diagnostics) throw new Error('diagnostics unavailable');
    const next = withCheckIn(trial, { at: at.toISOString(), quality: 'passed', trigger: 'manual', conditions: 'not_matched', reasons: ['distance'], diagnostics }, at);
    const saved = parseTrial(JSON.stringify(next));
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('parse');
    expect(saved.trial.checkIns[0].diagnostics).toEqual(diagnostics);
    expect(diagnostics.rows.find(r => r.property === 'Apparent size')?.difference).toBeCloseTo(0.2);
    expect(JSON.stringify(readCaptureDiagnostics({ ...diagnostics, image: 'SECRET', userAgent: 'SECRET' }))).not.toContain('SECRET');
    expect(readCaptureDiagnostics({ version: 'unknown' })).toBeNull();
  });
  it('does not authorize skin measurement or treat missing comparison as matched', () => {
    expect(opticalEligibility('unconfirmed')).toBe('insufficient_evidence');
    expect(opticalEligibility('matched')).toBe('experimental_conditions_match');
  });
});

describe('FV06 deterministic comparison fixtures (not camera or device validation)', () => {
  const base = baselineMeasurement(trial.baseline!);
  const keys = ['interocular', 'centerX', 'centerY', 'roll', 'yaw', 'pitch', 'faceLuma', 'shadingAsymmetry'] as const;
  it('five repeat fixtures stay inside the predeclared tolerances and retain all checked rows', () => {
    const deltas = [-0.002, -0.001, 0, 0.001, 0.002];
    const pairs = deltas.map(delta => compareCaptures(base, { ...base, interocular: { ...base.interocular, value: 0.3 + delta } }));
    expect(pairs.map(pair => pair.overall)).toEqual(Array(5).fill('within_experimental_tolerances'));
    const scale = pairs.map(pair => pair.rows.find(r => r.property === 'Apparent size')?.difference);
    expect(scale).toEqual(deltas.map(delta => (0.3 + delta - 0.3) / 0.3));
    expect(pairs.every(pair => pair.rows.filter(r => r.status === 'within_experimental_tolerance').length === 8)).toBe(true);
  });
  it.each([
    ['interocular', 0.36, 'Apparent size'],
    ['centerX', 0.58, 'Horizontal position'],
    ['centerY', 0.58, 'Vertical position'],
    ['roll', 9, 'Roll'],
    ['yaw', 12, 'Yaw'],
    ['pitch', -12, 'Pitch'],
    ['faceLuma', 90, 'Face brightness'],
    ['shadingAsymmetry', 0.2, 'Side shading'],
  ] as const)('isolates %s in measurement space', (key, value, label) => {
    const other: CaptureMeasurement = { ...base, [key]: { ...base[key], value } };
    const result = compareCaptures(base, other);
    expect(result.overall).toBe('not_comparable');
    expect(result.rows.filter(r => r.status === 'outside_experimental_tolerance').map(r => r.property)).toEqual([label]);
    expect(keys.filter(k => base[k].value !== other[k].value)).toEqual([key]);
  });
  it('fails closed for nonfinite or unsupported required measurements without changing thresholds', () => {
    for (const yaw of [{ value: Number.NaN, provenance: 'model_estimate' as const }, { value: 0, provenance: 'estimate' as const }]) {
      expect(compareCaptures(base, { ...base, yaw }).overall).toBe('insufficient_evidence');
    }
  });
  it('keeps only explicit camera capability fields and removes identifiers', () => {
    const other = { ...base, camera: { settings: { width: 1080, height: 1920, frameRate: 30, deviceId: 'PRIVATE', groupId: 'PRIVATE', arbitrary: 'PRIVATE' } } };
    const d = captureDiagnostics(other, compareCaptures(base, other), null, { delegate: 'CPU', frameIntervalMs: 24 });
    expect(d?.camera).toEqual({ width: 1080, height: 1920, frameRate: 30 });
    expect(d?.delegate).toBe('CPU');
    expect(JSON.stringify(d)).not.toContain('PRIVATE');
  });
});
