import type { EvidenceRecordData } from '../../domain/model';
import type { PhaseBFaceValueState } from '../../app/phaseBMachine';
import type { DemoStartingPoint } from '../../domain/demoLab';
import type { EvidenceRecordDisclosureState } from '../evidence-record/evidenceRecordDisclosure';

export type EvidenceRecordDemoStartingPoint =
  | 'saved_result'
  | 'evidence_record_reasoning_expanded'
  | 'evidence_record_full_technical_expanded';

const summaryDisclosure: EvidenceRecordDisclosureState = {
  openDisclosure: null,
  technicalMetadataOpen: false,
};

const reasoningDisclosure: EvidenceRecordDisclosureState = {
  openDisclosure: 'why',
  technicalMetadataOpen: false,
};

const fullTechnicalDisclosure: EvidenceRecordDisclosureState = {
  openDisclosure: 'full',
  technicalMetadataOpen: true,
};

export function evidenceRecordDisclosureStateForDemo(
  startingPoint: DemoStartingPoint | null,
): EvidenceRecordDisclosureState {
  switch (startingPoint) {
    case 'evidence_record_reasoning_expanded':
      return reasoningDisclosure;
    case 'evidence_record_full_technical_expanded':
      return fullTechnicalDisclosure;
    default:
      return summaryDisclosure;
  }
}

/**
 * This is the only Demo Lab boundary for the production Evidence Record route.
 * It opens the immutable saved record without evaluating or translating it.
 * Disclosure state is mapped separately by evidenceRecordDisclosureStateForDemo.
 */
export function openCurrentSavedResultRoute(
  state: PhaseBFaceValueState,
  record: EvidenceRecordData,
): PhaseBFaceValueState {
  const archive = state.archive.some(({ id }) => id === record.id)
    ? state.archive
    : [record, ...state.archive];

  return {
    ...state,
    stage: 'record',
    cabinet: 'open',
    record,
    archive,
    returnStage: 'archive',
    announcement: `Saved result ${record.id} opened.`,
  };
}
