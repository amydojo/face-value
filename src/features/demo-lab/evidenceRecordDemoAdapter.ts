import type { EvidenceRecordData } from '../../domain/model';
import type { PhaseBFaceValueState } from '../../app/phaseBMachine';

export const DEFERRED_EVIDENCE_RECORD_INTEGRATIONS = [
  {
    id: 'summary',
    label: 'Evidence Record summary',
  },
  {
    id: 'reasoning_expanded',
    label: 'Evidence Record reasoning expanded',
  },
  {
    id: 'full_technical_record_expanded',
    label: 'Evidence Record full technical record expanded',
  },
] as const;

export type DeferredEvidenceRecordIntegration =
  (typeof DEFERRED_EVIDENCE_RECORD_INTEGRATIONS)[number]['id'];

/**
 * This is the only Demo Lab boundary for the current saved-result route.
 * Disclosure state intentionally does not enter this adapter until the
 * progressive Evidence Record implementation lands on main.
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
