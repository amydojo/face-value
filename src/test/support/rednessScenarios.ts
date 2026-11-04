// Test-only kit: drives the production redness bridge and the production result view models
// with live-shaped evidence. It never calls a provider and never touches the network.
import {
  analysisResultFromRednessEvaluation,
  placementForRednessAction,
} from '../../adapters/analysis/youcam/rednessEvidenceAdapter';
import type { RednessEvaluationSnapshot } from '../../domain/evidence/redness';
import { evidenceRecordViewModelFromRecord } from '../../features/evidence-record/evidenceRecordViewModel';
import { resultExperienceViewModelFromRecord } from '../../features/evidence-record/resultExperienceViewModel';
import { submissionContinuityEvidenceViewModel } from '../../features/submission-continuity/submissionContinuityViewModel';
import { safetyGuidanceFor, type SafetyGuidance } from '../../features/verdict/safetyGuidance';
import { verdictViewModelFromRecord } from '../../features/verdict/verdictViewModel';
import {
  allComparability,
  evaluateLiveScenario,
  recordForSnapshot,
  type ComparabilityProfile,
  type LiveScenario,
} from './liveScenarios';

export * from './liveScenarios';

function findRowValue(node: unknown, rowId: string): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRowValue(item, rowId);
      if (found !== null) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.id === rowId && typeof record.value === 'string') return record.value;
    for (const value of Object.values(record)) {
      const found = findRowValue(value, rowId);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Every string a person reads for this result, taken from the production view models. */
export interface ResultSurfaces {
  oracleHeadline: string;
  oracleExplanation: string;
  oracleNextStep: string;
  recordHeadline: string;
  recordInterpretation: string;
  recordNextTitle: string;
  recordNextBody: string;
  recordNextTone: string;
  recordSavedExplanation: string | null;
  previousTrialsVerdict: string;
  nonFinding: string;
  claimBoundary: string;
  /** Safety-priority guidance shown on the Oracle reveal and the Record result layer. */
  guidance: SafetyGuidance | null;
  /** Strings the current UI renders visibly (Chromium-verified): the Oracle finding projection
   * and NEXT label, the result guidance, the "Why this result" panel, the Record result layer,
   * Previous Trials. */
  visible: string[];
}

const guidanceStrings = (guidance: SafetyGuidance | null): string[] =>
  guidance
    ? [guidance.title, ...guidance.lines, ...(guidance.actionMeaning ? [guidance.actionMeaning] : [])]
    : [];

export function surfacesFor(snapshot: RednessEvaluationSnapshot): ResultSurfaces {
  const record = recordForSnapshot(snapshot);
  const oracle = verdictViewModelFromRecord(record);
  const evidenceRecord = evidenceRecordViewModelFromRecord(record);
  const previous = resultExperienceViewModelFromRecord(record);
  const analysis = analysisResultFromRednessEvaluation(snapshot);
  const why = submissionContinuityEvidenceViewModel(
    analysis,
    analysis.confidence,
    placementForRednessAction(snapshot.interpretation.recommendedAction),
  );
  return {
    oracleHeadline: oracle.headline,
    oracleExplanation: oracle.explanation,
    oracleNextStep: oracle.nextStepLabel,
    recordHeadline: evidenceRecord.headline,
    recordInterpretation: evidenceRecord.interpretation,
    recordNextTitle: evidenceRecord.nextStep.title,
    recordNextBody: evidenceRecord.nextStep.body,
    recordNextTone: evidenceRecord.nextStep.tone,
    recordSavedExplanation: findRowValue(evidenceRecord.full, 'deterministic-explanation'),
    previousTrialsVerdict: previous.verdict,
    nonFinding: snapshot.interpretation.nonFinding,
    claimBoundary: snapshot.interpretation.claimBoundary.join(' '),
    guidance: oracle.safetyGuidance ?? null,
    visible: [
      oracle.headline,
      oracle.nextStepLabel,
      ...guidanceStrings(oracle.safetyGuidance ?? null),
      why.change,
      why.comparison,
      why.evidence,
      why.recommendation,
      why.interpretation,
      why.claimBoundary,
      previous.verdict,
      previous.directionLabel,
      previous.evidenceLevel,
      ...guidanceStrings(safetyGuidanceFor(record.rednessEvaluation)),
      evidenceRecord.nextStep.statusLabel,
    ],
  };
}

/** Decision fields only: no copy. A copy-only change must leave these byte-identical. */
export function decisionKey(snapshot: RednessEvaluationSnapshot): string {
  return [
    snapshot.effectClassification,
    snapshot.measurementQuality,
    snapshot.attributionQuality,
    snapshot.evidenceQuality,
    snapshot.safetyStatus,
    snapshot.directionAgreement.status,
    snapshot.observationWindowStatus,
    snapshot.interpretation.recommendedAction,
    snapshot.corroboratingSignals.join('+') || 'none',
    snapshot.rawScoreDelta,
    snapshot.threshold.configHash,
    snapshot.triggeredRuleIds.join(' '),
  ].join('|');
}

/** cyrb53: small, dependency-free, deterministic 53-bit string hash (test fingerprinting only). */
export function fingerprint(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

export interface DecisionSummary {
  rowCount: number;
  fingerprint: string;
  outcomeCounts: Record<string, number>;
}

/** Fingerprint of every decision in the grid, plus grouped counts so a drift is diagnosable. */
export function summarizeDecisions(grid: LabeledScenario[]): DecisionSummary {
  const keys: string[] = [];
  const outcomeCounts: Record<string, number> = {};
  for (const { comparabilityClass, scenario } of grid) {
    const snapshot = evaluateLiveScenario(scenario);
    keys.push(decisionKey(snapshot));
    const group = [
      comparabilityClass,
      snapshot.effectClassification,
      snapshot.measurementQuality,
      snapshot.safetyStatus,
      snapshot.interpretation.recommendedAction,
    ].join('|');
    outcomeCounts[group] = (outcomeCounts[group] ?? 0) + 1;
  }
  const sorted = Object.fromEntries(Object.entries(outcomeCounts).sort(([a], [b]) => a.localeCompare(b)));
  return { rowCount: keys.length, fingerprint: fingerprint(keys.join('\n')), outcomeCounts: sorted };
}

export const COMPARABILITY_CLASSES: Record<string, ComparabilityProfile | null> = {
  live_adapter: null,
  all_pass: allComparability('pass'),
  one_limited: { ...allComparability('pass'), poseComparability: 'limited' },
  one_fail: { ...allComparability('pass'), poseComparability: 'fail' },
};

export const GRID_DELTAS = [-20, -10, -9, -5, -4, 0, 4, 5, 9, 10, 20] as const;
export const GRID_INTERVALS = [7, 29, 60] as const;

export interface LabeledScenario {
  comparabilityClass: string;
  scenario: LiveScenario;
}

/** Bounded grid (12,672 scenarios) covering every boundary that decides an action. */
export function decisionGrid(): LabeledScenario[] {
  const rows: LabeledScenario[] = [];
  for (const [comparabilityClass, comparability] of Object.entries(COMPARABILITY_CLASSES))
    for (const delta of GRID_DELTAS)
      for (const pattern of ['unanimous', 'one_contradicting'] as const)
        for (const intervalDays of GRID_INTERVALS)
          for (const adherence of ['complete', 'poor'] as const)
            for (const tolerance of ['none', 'moderate_burning', 'mild_swelling'] as const)
              for (const anchor of [-1, 1] as const)
                for (const context of ['none', 'second_product', 'two_downgrades', 'makeup'] as const)
                  rows.push({
                    comparabilityClass,
                    scenario: { comparability, delta, pattern, intervalDays, adherence, tolerance, anchor, context },
                  });
  return rows;
}
