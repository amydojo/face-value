export type TerminalStage =
  | 'standby'
  | 'specimen'
  | 'active'
  | 'verdict'
  | 'printing'
  | 'sealed';

export type TerminalLightState = 'standby' | 'active' | 'ready' | 'printing' | 'error';

export type EvidenceRecord = {
  id: string;
  dateLabel: string;
  product: string;
  productDetail: string;
  job: string;
  observation: string;
  baseline: number;
  followup: number;
  change: number;
  comparability: 'PASS' | 'RETRY';
  checks: string;
  durationDays: number;
  verdict: 'FAVORABLE' | 'UNRESOLVED' | 'UNFAVORABLE';
  next: string;
};

export const SYNTHETIC_EVIDENCE_RECORD: EvidenceRecord = {
  id: 'FV-035',
  dateLabel: '13 SEP 26',
  product: 'ONE THING',
  productDetail: '10%',
  job: 'VISIBLE REDNESS',
  observation: 'VISIBLE REDNESS IMPROVED ACROSS COMPARABLE SCANS.',
  baseline: 60,
  followup: 72,
  change: 12,
  comparability: 'PASS',
  checks: '6/6',
  durationDays: 35,
  verdict: 'FAVORABLE',
  next: 'KEEP USING IT',
};

export const terminalStageLabel: Record<TerminalStage, string> = {
  standby: 'STANDBY',
  specimen: 'SPECIMEN LOADED',
  active: 'TRIAL IN PROGRESS',
  verdict: 'VERDICT READY',
  printing: 'SEALING EVIDENCE RECORD',
  sealed: 'EVIDENCE SEALED',
};
