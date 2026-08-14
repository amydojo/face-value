import type {
  AnalysisResult,
  EvidenceConfidence,
  ProductPlacement,
} from '../../domain/model';
import { oracleNextStep } from '../oracle-reveal/oraclePresentation';
import { canonicalActionLabel } from '../verdict/verdictViewModel';

export interface SubmissionContinuityEvidenceViewModel {
  change: string;
  comparison: string;
  evidence: string;
  recommendation: string;
  interpretation: string;
  claimBoundary: string;
}

const evidenceLabelFor = (value: string): string => {
  if (value === 'confirmed') return 'Established';
  if (value === 'likely') return 'Growing';
  if (value === 'possible') return 'Early';
  return 'Insufficient';
};

const signedPoints = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded} points`;
};

export function submissionContinuityEvidenceViewModel(
  analysis: AnalysisResult,
  confidence: EvidenceConfidence,
  placement: ProductPlacement,
): SubmissionContinuityEvidenceViewModel {
  const evaluation = analysis.rednessEvaluation;
  const accepted = evaluation
    ? evaluation.baseline.acceptedRawScores.length + evaluation.endpoint.acceptedRawScores.length
    : 0;
  const attempted = evaluation
    ? accepted + evaluation.baseline.rejectedFrameCount + evaluation.endpoint.rejectedFrameCount
    : 0;

  return {
    change: signedPoints(evaluation?.rawScoreDelta),
    comparison: attempted > 0 ? `${accepted}/${attempted} checks passed` : 'Not available',
    evidence: evidenceLabelFor(evaluation?.evidenceQuality ?? confidence),
    recommendation: evaluation
      ? canonicalActionLabel(evaluation.interpretation.recommendedAction)
      : oracleNextStep(placement),
    interpretation: analysis.finding,
    claimBoundary: analysis.claimBoundary,
  };
}
