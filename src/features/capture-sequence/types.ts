import type { GuidedCaptureFailure } from '../../adapters/camera/youcam-camera-kit';
import type {
  CaptureIssue,
  CapturePhase,
  CaptureQuality,
  CaptureRegion,
  CaptureSignalSample,
  FaceBounds,
} from '../../domain/captureAcquisition';

export type {
  CaptureIssue,
  CapturePhase,
  CaptureQuality,
  CaptureRegion,
  CaptureSignalSample,
  FaceBounds,
} from '../../domain/captureAcquisition';

export interface SignalLatch {
  value: boolean;
  candidate: boolean | null;
  candidateSince: number | null;
}

export type CaptureQualityLatches = {
  [Key in keyof CaptureQuality]: SignalLatch;
};

export interface CaptureSequenceState {
  phase: CapturePhase;
  quality: CaptureQuality;
  activeIssue: CaptureIssue | null;
  issueCandidate: CaptureIssue | null;
  issueCandidateSince: number | null;
  validSince: number | null;
  faceBounds: FaceBounds | null;
  capturedImage: string | null;
  registeredRegions: readonly CaptureRegion[];
  phaseEnteredAt: number;
  invalidSince: number | null;
  lowLightSince: number | null;
  persistentLowLight: boolean;
  frameLost: boolean;
  scanComplete: boolean;
  handoffReady: boolean;
  failure: GuidedCaptureFailure | null;
  latestSample: CaptureSignalSample;
  latches: CaptureQualityLatches;
}

export type CaptureSequenceEvent =
  | { type: 'SIGNALS_RECEIVED'; sample: CaptureSignalSample; at: number }
  | { type: 'CAPTURE_AVAILABLE'; image: string; at: number }
  | { type: 'TICK'; at: number }
  | { type: 'FAILED'; failure: GuidedCaptureFailure; at: number }
  | { type: 'RESET'; at: number };

export type CaptureRailState = 'pending' | 'current' | 'passed';

export interface CaptureInstructionCopy {
  primary: string;
  secondary: string;
}
