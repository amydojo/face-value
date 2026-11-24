import { describe, expect, it } from 'vitest';
import { buildTrialDiagnostics, captureDiagnostics, opticalEligibility, readCaptureDiagnostics } from '../features/local-optics/trialDiagnostics';
import { BASELINE_TEMPLATE_VERSION } from '../features/local-optics/guidance';
import { baselineMeasurement, newTrial, withBaseline, withConsent, withCheckIn, parseTrial } from '../features/local-optics/trialStore';
import { compareCaptures } from '../features/local-optics/opticsMetrics';
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
