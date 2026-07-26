import type { EvidenceRecord } from './evidenceTrial';

export type EvidenceRecordReleaseState =
  | 'ready'
  | 'actuator-pressed'
  | 'latch-releasing'
  | 'record-dispensing'
  | 'record-presented'
  | 'record-collecting'
  | 'record-collected'
  | 'detail-open'
  | 'release-error';

export type EvidenceRecordArtifactMode = 'dispensed' | 'collected';

type ReleaseEvent = 'PRESS' | 'LATCH' | 'DISPENSE' | 'PRESENT' | 'COLLECT' | 'COLLECTED' | 'DETAIL' | 'FAIL' | 'RETRY';

export const nextReleaseState = (
  state: EvidenceRecordReleaseState,
  event: ReleaseEvent,
): EvidenceRecordReleaseState => {
  const transitions: Record<EvidenceRecordReleaseState, Partial<Record<ReleaseEvent, EvidenceRecordReleaseState>>> = {
    ready: { PRESS: 'actuator-pressed', FAIL: 'release-error' },
    'actuator-pressed': { LATCH: 'latch-releasing', FAIL: 'release-error' },
    'latch-releasing': { DISPENSE: 'record-dispensing', FAIL: 'release-error' },
    'record-dispensing': { PRESENT: 'record-presented', FAIL: 'release-error' },
    'record-presented': { COLLECT: 'record-collecting', FAIL: 'release-error' },
    'record-collecting': { COLLECTED: 'record-collected', FAIL: 'release-error' },
    'record-collected': { DETAIL: 'detail-open' },
    'detail-open': {},
    'release-error': { RETRY: 'ready' },
  };
  const next = transitions[state][event];
  if (!next) throw new Error(`Invalid release transition: ${state} -> ${event}`);
  return next;
};

export const confidenceSeal = (confidence: EvidenceRecord['confidence']) => {
  if (confidence === 'established') return 'solid';
  if (confidence === 'likely') return 'partial';
  return 'open';
};
