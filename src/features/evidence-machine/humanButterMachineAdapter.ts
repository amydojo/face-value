import type {
  EvidenceConfidence,
  EvidenceRecordData,
  FaceValueState,
  ProductPlacement,
  Specimen,
} from '../../domain/model';
import type { EvidenceRecord, EvidenceTrialState, TrialPhase } from './evidenceTrial';

export type NextStepPresentation = {
  code: string;
  label: string;
  guidance: string;
};

const NEXT_STEP_PRESENTATION: Record<ProductPlacement, NextStepPresentation> = {
  established: {
    code: 'S4',
    label: 'Established routine',
    guidance: 'Keep using it for the job you tested and continue watching for change.',
  },
  observation: {
    code: 'O1',
    label: 'Keep observing',
    guidance: 'Continue the trial until the evidence supports a clearer decision.',
  },
  cooling: {
    code: 'C2',
    label: 'Return to cooling',
    guidance: 'Remove the overlapping product and let this trial become easier to interpret.',
  },
  paused: {
    code: 'P1',
    label: 'Paused',
    guidance: 'Give the trial more time before you make a stronger call.',
  },
  useful_elsewhere: {
    code: 'U2',
    label: 'Useful elsewhere',
    guidance: 'Keep the product, but assign it a different job next time.',
  },
  unclear: {
    code: 'U0',
    label: 'Unclear',
    guidance: 'Do not force a conclusion from evidence that is not strong enough.',
  },
  retry_alone: {
    code: 'R3',
    label: 'Retry alone',
    guidance: 'Try it again without another active product in the same trial.',
  },
  released: {
    code: 'E7',
    label: 'Released',
    guidance: 'Close this trial and remove the product from the active routine.',
  },
};

export const getNextStepPresentation = (placement: ProductPlacement): NextStepPresentation =>
  NEXT_STEP_PRESENTATION[placement];

const artifactConfidence = (
  confidence: EvidenceConfidence,
): EvidenceRecord['confidence'] => {
  if (confidence === 'confirmed') return 'established';
  if (confidence === 'likely') return 'likely';
  return 'possible';
};

const formatScore = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const trialContext = (record: EvidenceRecordData): string => {
  const context: string[] = [];
  if (record.note) context.push(`Note: ${record.note}`);
  if (record.disturbance === 'overlap_retained') {
    context.push('A second active product overlapped the trial window, so attribution is less certain.');
  } else if (record.disturbance === 'returned_to_cooling') {
    context.push('The second product was removed before the final comparison.');
  }
  if (record.limitations?.length) context.push(...record.limitations);
  if (context.length === 0) context.push('No additional trial context changed the result boundary.');
  return context.join(' ');
};

const technicalComparison = (record: EvidenceRecordData): string => {
  const details = [record.comparison.replaceAll('_', ' ')];
  if (record.evidenceSource) details.push(record.evidenceSource);
  if (record.comparisonDirection) details.push(`${record.comparisonDirection} direction`);
  if (
    typeof record.baselineRawScore === 'number' &&
    typeof record.followUpRawScore === 'number'
  ) {
    details.push(
      `${formatScore(record.baselineRawScore)} → ${formatScore(record.followUpRawScore)}`,
    );
  }
  return details.join(' · ');
};

export function evidenceRecordFromHumanButter(record: EvidenceRecordData): EvidenceRecord {
  const nextStep = getNextStepPresentation(record.finalPlacement);
  return {
    id: record.id,
    trialId: `trial-${record.specimenId}`,
    specimenCode: record.accession,
    productName: record.product,
    trialWindow: {
      startedAt: record.baselineCapture?.createdAt ?? record.observationWindow,
      endedAt: record.followupCapture?.createdAt ?? record.createdAt,
    },
    finding: {
      metric: record.job,
      summary: record.finding,
    },
    confidence: artifactConfidence(record.confidence),
    nextStep: nextStep.label,
    nextStepCode: nextStep.code,
    generatedAt: record.createdAt,
    detail: {
      observed: record.finding,
      notEstablished: record.nonFinding,
      context: trialContext(record),
      confidence: record.claimBoundary,
      nextStep: nextStep.guidance,
      metadata: {
        comparison: technicalComparison(record),
        generatedFrom: 'baseline-and-follow-up',
        exactTimestamp: record.createdAt,
      },
    },
  };
}

const phaseForHumanButter = (state: FaceValueState): TrialPhase => {
  if (state.stage === 'record' && state.record) return 'record-collected';
  if (state.stage === 'placement' && state.placementSealed && state.record) return 'verdict-revealed';
  return 'verdict-ready';
};

export function deriveHumanButterMachineState(
  state: FaceValueState,
  specimen: Specimen,
): EvidenceTrialState {
  const evidenceRecord = state.record ? evidenceRecordFromHumanButter(state.record) : null;
  return {
    trialId: `trial-${state.selectedSpecimenId}`,
    phase: phaseForHumanButter(state),
    product: specimen,
    specimenCode: specimen.accession,
    assignedJob: state.assignedJob,
    baselineScan: state.baselineCapture,
    followUpScan: state.followupCapture,
    trialStartDate: state.baselineCapture?.createdAt ?? null,
    trialTargetDate: state.followupCapture?.createdAt ?? null,
    verdict: state.analysis,
    evidenceRecord,
    disposition: state.placement === 'observation' ? null : state.placement,
    lastSuccessfulEvent: state.placementSealed ? 'RECORD_GENERATED' : 'DISPOSITION_SELECTED',
    recoverableError: null,
  };
}
