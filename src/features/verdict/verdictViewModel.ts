import type {
  AnalysisResult,
  EvidenceConfidence,
  EvidenceRecordData,
  ProductPlacement,
} from '../../domain/model';
import type { RednessAction, RednessEvaluationSnapshot } from '../../domain/evidence/redness';
import { oracleTrialIdentityForRecord } from '../../domain/oracleTrialIdentity';
import { formatRawScore } from '../../domain/youcamEvidence';
import { oracleNextStep } from '../oracle-reveal/oraclePresentation';

export interface VerdictViewModel {
  trialId: string;
  productName: string;
  productBrand?: string;
  verdictCode: string;
  headline: string;
  explanation: string;
  confidence: string;
  evidenceQuality: string;
  measurementQuality?: string;
  attributionQuality?: string;
  safetyStatus?: string;
  canonicalAction?: RednessAction;
  nextStepLabel: string;
  evaluatedAt?: string;
}

const presentationCode = (value: string) => value.replaceAll('_', ' ').toUpperCase();

export function canonicalActionLabel(action: RednessAction): string {
  switch (action) {
    case 'keep':
      return 'KEEP USING IT';
    case 'test_longer':
      return 'TEST LONGER';
    case 'retry_alone':
      return 'RETRY IT ALONE';
    case 'not_proving_job':
      return 'NOT PROVING ITS JOB';
    case 'safety_interruption':
      return 'SAFETY INTERRUPTION';
  }
}

function verdictViewModelFromEvaluation(input: {
  trialId: string;
  productName: string;
  productBrand?: string;
  evaluation: RednessEvaluationSnapshot;
}): VerdictViewModel {
  const evaluation = input.evaluation;
  const action = evaluation.interpretation.recommendedAction;
  return {
    trialId: input.trialId,
    productName: input.productName,
    productBrand: input.productBrand,
    verdictCode: presentationCode(evaluation.effectClassification ?? 'not_readable'),
    headline: evaluation.interpretation.finding,
    explanation: evaluation.interpretation.explanation,
    confidence: presentationCode(evaluation.evidenceQuality),
    evidenceQuality: presentationCode(evaluation.evidenceQuality),
    measurementQuality: presentationCode(evaluation.measurementQuality),
    attributionQuality: presentationCode(evaluation.attributionQuality),
    safetyStatus: presentationCode(evaluation.safetyStatus),
    canonicalAction: action,
    nextStepLabel: canonicalActionLabel(action),
    evaluatedAt: evaluation.evaluatedAt,
  };
}

export function verdictViewModelFromRecord(record: EvidenceRecordData): VerdictViewModel {
  if (record.rednessEvaluation) {
    return verdictViewModelFromEvaluation({
      trialId: oracleTrialIdentityForRecord(record).folio,
      productName: record.product,
      productBrand: record.productBrand,
      evaluation: record.rednessEvaluation,
    });
  }
  return {
    trialId: oracleTrialIdentityForRecord(record).folio,
    productName: record.product,
    productBrand: record.productBrand,
    verdictCode: presentationCode(record.comparison),
    headline: record.finding,
    explanation: record.nonFinding,
    confidence: presentationCode(record.confidence),
    evidenceQuality: presentationCode(record.confidence),
    nextStepLabel: oracleNextStep(record.finalPlacement),
    evaluatedAt: record.createdAt,
  };
}

export function verdictViewModelFromAnalysis(input: {
  trialId: string;
  productName: string;
  productBrand?: string;
  analysis: AnalysisResult;
  confidence: EvidenceConfidence;
  placement: ProductPlacement;
  evaluatedAt?: string | null;
}): VerdictViewModel {
  if (input.analysis.rednessEvaluation) {
    return verdictViewModelFromEvaluation({
      trialId: input.trialId,
      productName: input.productName,
      productBrand: input.productBrand,
      evaluation: input.analysis.rednessEvaluation,
    });
  }
  return {
    trialId: input.trialId,
    productName: input.productName,
    productBrand: input.productBrand,
    verdictCode: presentationCode(input.analysis.comparison),
    headline: input.analysis.finding,
    explanation: input.analysis.nonFinding,
    confidence: presentationCode(input.confidence),
    evidenceQuality: presentationCode(input.confidence),
    nextStepLabel: oracleNextStep(input.placement),
    evaluatedAt: input.evaluatedAt ?? undefined,
  };
}

export function verdictProduct(viewModel: VerdictViewModel): string {
  return viewModel.productBrand
    ? `${viewModel.productBrand} · ${viewModel.productName}`
    : viewModel.productName;
}

const score = (value: number | null): string =>
  value === null
    ? 'Not available'
    : new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: 'auto',
      }).format(value);

export interface EvidenceDetailViewModel {
  canonical: boolean;
  rows: Array<{ label: string; value: string }>;
  claimBoundary: string;
  technicalNote?: string;
}

export function evidenceDetailViewModelFromRecord(
  record: EvidenceRecordData,
): EvidenceDetailViewModel {
  const evaluation = record.rednessEvaluation;
  const verdict = verdictViewModelFromRecord(record);
  if (!evaluation) {
    const scoreSummary =
      typeof record.baselineRawScore === 'number' && typeof record.followUpRawScore === 'number'
        ? `${formatRawScore(record.baselineRawScore)} → ${formatRawScore(record.followUpRawScore)}`
        : 'Raw scores unavailable';
    const context = [
      record.baselineContext?.note,
      record.followUpContext?.note,
      ...(record.limitations ?? []),
      record.demoOriginated
        ? 'Demo timeline was advanced explicitly; the original baseline timestamp was not changed.'
        : null,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      canonical: false,
      rows: [
        { label: 'OBSERVED', value: record.finding },
        { label: 'NOT ESTABLISHED', value: record.nonFinding },
        {
          label: 'CONTEXT',
          value: context || 'No additional trial context changed the boundary.',
        },
        { label: 'CONFIDENCE', value: record.confidence.toUpperCase() },
        { label: 'NEXT STEP', value: verdict.nextStepLabel },
        {
          label: 'TECHNICAL METADATA',
          value: `${record.evidenceSource ?? 'Baseline and follow-up'} · ${record.comparison.replaceAll('_', ' ')} · ${scoreSummary}`,
        },
      ],
      claimBoundary: record.claimBoundary,
    };
  }

  const thresholdBoundary = [
    evaluation.threshold.provisionalDetectablePoints,
    evaluation.threshold.provisionalStrongPoints,
  ]
    .filter((value): value is number => typeof value === 'number')
    .map(String)
    .join(' / ');
  const expected = evaluation.expectedObservationWindowDays;
  const expectedWindow = `${expected.minimum}–${expected.target} days${
    expected.maximum === undefined ? '' : ` · max ${expected.maximum}`
  }`;
  const missing = evaluation.missingEvidence.length
    ? evaluation.missingEvidence.join(' ')
    : 'No required evidence was reported missing.';
  const limitations = evaluation.interpretation.limitations.length
    ? evaluation.interpretation.limitations.join(' ')
    : 'No additional limitations were recorded.';
  const recordedContext = [
    record.baselineContext?.note,
    record.followUpContext?.note,
    record.demoOriginated
      ? 'Demo timing was advanced explicitly; capture timestamps remain unchanged.'
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return {
    canonical: true,
    rows: [
      { label: 'OBSERVED', value: evaluation.interpretation.finding },
      {
        label: 'NOT ESTABLISHED',
        value: evaluation.interpretation.nonFinding,
      },
      {
        label: 'EFFECT',
        value: presentationCode(evaluation.effectClassification ?? 'not_readable'),
      },
      {
        label: 'MEASUREMENT QUALITY',
        value: presentationCode(evaluation.measurementQuality),
      },
      {
        label: 'ATTRIBUTION QUALITY',
        value: presentationCode(evaluation.attributionQuality),
      },
      {
        label: 'EVIDENCE QUALITY',
        value: presentationCode(evaluation.evidenceQuality),
      },
      {
        label: 'SAFETY STATUS',
        value: presentationCode(evaluation.safetyStatus),
      },
      { label: 'BASELINE MEDIAN', value: score(evaluation.baselineRawMedian) },
      { label: 'ENDPOINT MEDIAN', value: score(evaluation.endpointRawMedian) },
      { label: 'RAW DELTA', value: score(evaluation.rawScoreDelta) },
      {
        label: 'THRESHOLD',
        value: `${evaluation.threshold.source} · ${evaluation.threshold.version}${
          thresholdBoundary ? ` · ${thresholdBoundary} points` : ''
        }`,
      },
      {
        label: 'THRESHOLD CONFIG',
        value: evaluation.threshold.configHash,
      },
      {
        label: 'OBSERVATION INTERVAL',
        value: `${evaluation.actualObservationIntervalDays} days observed · expected ${expectedWindow}`,
      },
      {
        label: 'RECORDED CONTEXT',
        value: recordedContext || 'No additional user note was recorded.',
      },
      { label: 'LIMITATIONS', value: limitations },
      { label: 'MISSING EVIDENCE', value: missing },
      { label: 'NEXT STEP', value: verdict.nextStepLabel },
      {
        label: 'ENGINE / API',
        value: `${evaluation.engineVersion} · API ${evaluation.versions.apiVersion} · model ${evaluation.versions.analysisModelVersion}`,
      },
    ],
    claimBoundary: evaluation.interpretation.claimBoundary.join(' '),
    technicalNote: evaluation.threshold.provisional
      ? 'Production thresholds require repeat-scan calibration.'
      : undefined,
  };
}
