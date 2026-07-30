import { CAPTURE_TIMING } from './constants';
import { getHighestPriorityCaptureIssue } from './guidance';
import type {
  CaptureQuality,
  CaptureQualityLatches,
  CaptureSequenceEvent,
  CaptureSequenceState,
  CaptureSignalSample,
  SignalLatch,
} from './types';

export const emptyCaptureQuality = (): CaptureQuality => ({
  facePresent: false,
  distanceValid: false,
  alignmentValid: false,
  angleValid: false,
  lightingValid: false,
  stillnessValid: false,
});

export const emptyCaptureSignalSample = (): CaptureSignalSample => ({
  quality: emptyCaptureQuality(),
  faceBounds: null,
  registeredRegions: [],
});

const createLatch = (): SignalLatch => ({
  value: false,
  candidate: null,
  candidateSince: null,
});

const createLatches = (): CaptureQualityLatches => ({
  facePresent: createLatch(),
  distanceValid: createLatch(),
  alignmentValid: createLatch(),
  angleValid: createLatch(),
  lightingValid: createLatch(),
  stillnessValid: createLatch(),
});

export function createCaptureSequenceState(at = 0): CaptureSequenceState {
  const latestSample = emptyCaptureSignalSample();
  return {
    phase: 'searching',
    quality: emptyCaptureQuality(),
    activeIssue: 'face-missing',
    issueCandidate: null,
    issueCandidateSince: null,
    validSince: null,
    faceBounds: null,
    capturedImage: null,
    registeredRegions: [],
    phaseEnteredAt: at,
    invalidSince: null,
    lowLightSince: null,
    persistentLowLight: false,
    frameLost: false,
    scanComplete: false,
    handoffReady: false,
    failure: null,
    latestSample,
    latches: createLatches(),
  };
}

const allValid = (quality: CaptureQuality): boolean => Object.values(quality).every(Boolean);

const usesFrameQuality = (sample: CaptureSignalSample): boolean =>
  sample.verificationMode === 'frame-quality';

const hasAcquisitionFrame = (
  quality: CaptureQuality,
  sample: CaptureSignalSample,
): boolean => (usesFrameQuality(sample) ? sample.frameReady === true : quality.facePresent);

const captureConditionsValid = (
  quality: CaptureQuality,
  sample: CaptureSignalSample,
): boolean =>
  usesFrameQuality(sample)
    ? sample.frameReady === true && quality.lightingValid && quality.stillnessValid
    : allValid(quality);

const stabilizeLatch = (latch: SignalLatch, nextValue: boolean, at: number): SignalLatch => {
  if (nextValue === latch.value) {
    return {
      value: latch.value,
      candidate: null,
      candidateSince: null,
    };
  }

  const candidateSince =
    latch.candidate === nextValue && latch.candidateSince !== null ? latch.candidateSince : at;
  const delay = nextValue ? CAPTURE_TIMING.returnValidMs : CAPTURE_TIMING.enterInvalidMs;

  if (at - candidateSince < delay) {
    return {
      value: latch.value,
      candidate: nextValue,
      candidateSince,
    };
  }

  return {
    value: nextValue,
    candidate: null,
    candidateSince: null,
  };
};

const stabilizeQuality = (
  latches: CaptureQualityLatches,
  sample: CaptureSignalSample,
  at: number,
): {
  latches: CaptureQualityLatches;
  quality: CaptureQuality;
} => {
  const nextLatches = Object.fromEntries(
    (Object.keys(latches) as (keyof CaptureQuality)[]).map((key) => [
      key,
      stabilizeLatch(latches[key], sample.quality[key], at),
    ]),
  ) as unknown as CaptureQualityLatches;

  return {
    latches: nextLatches,
    quality: Object.fromEntries(
      (Object.keys(nextLatches) as (keyof CaptureQuality)[]).map((key) => [
        key,
        nextLatches[key].value,
      ]),
    ) as unknown as CaptureQuality,
  };
};

const enterPhase = (
  state: CaptureSequenceState,
  phase: CaptureSequenceState['phase'],
  at: number,
): CaptureSequenceState => ({
  ...state,
  phase,
  phaseEnteredAt: at,
  invalidSince: null,
  validSince: phase === 'aligning' ? state.validSince : null,
  scanComplete: phase === 'scanning' ? false : state.scanComplete,
  handoffReady: false,
});

const updateLowLight = (state: CaptureSequenceState, at: number): CaptureSequenceState => {
  const isKnownLowLight =
    state.latestSample.lightingIssue === 'low-light' &&
    hasAcquisitionFrame(state.latestSample.quality, state.latestSample) &&
    !state.latestSample.quality.lightingValid;
  if (!isKnownLowLight) {
    return {
      ...state,
      lowLightSince: null,
      persistentLowLight: false,
    };
  }

  const lowLightSince = state.lowLightSince ?? at;
  return {
    ...state,
    lowLightSince,
    persistentLowLight: at - lowLightSince >= CAPTURE_TIMING.persistentLowLightMs,
  };
};

const updatePresentationSignals = (
  state: CaptureSequenceState,
  at: number,
): CaptureSequenceState => {
  const nextIssue = getHighestPriorityCaptureIssue(
    state.quality,
    state.latestSample,
  );
  if (nextIssue === state.activeIssue) {
    return {
      ...state,
      issueCandidate: null,
      issueCandidateSince: null,
      faceBounds: state.latestSample.faceBounds ?? null,
      registeredRegions: state.latestSample.registeredRegions ?? [],
    };
  }

  const issueCandidateSince =
    state.issueCandidateSince !== null && state.issueCandidate === nextIssue
      ? state.issueCandidateSince
      : at;
  const delay =
    nextIssue === null
      ? CAPTURE_TIMING.returnValidMs
      : CAPTURE_TIMING.enterInvalidMs;
  const issueStable = at - issueCandidateSince >= delay;

  return {
    ...state,
    activeIssue: issueStable ? nextIssue : state.activeIssue,
    issueCandidate: issueStable ? null : nextIssue,
    issueCandidateSince: issueStable ? null : issueCandidateSince,
    faceBounds: state.latestSample.faceBounds ?? null,
    registeredRegions: state.latestSample.registeredRegions ?? [],
  };
};

function advancePhase(
  input: CaptureSequenceState,
  at: number,
  reducedMotion: boolean,
): CaptureSequenceState {
  let state = input;

  if (state.phase === 'error') return state;

  if (state.phase === 'captured') {
    if (!state.handoffReady && at - state.phaseEnteredAt >= CAPTURE_TIMING.capturedHoldMs) {
      return { ...state, handoffReady: true };
    }
    return state;
  }

  if (state.phase === 'searching') {
    if (hasAcquisitionFrame(state.quality, state.latestSample)) {
      return enterPhase({ ...state, frameLost: false }, 'aligning', at);
    }
    return { ...state, validSince: null };
  }

  if (state.phase === 'aligning') {
    if (!hasAcquisitionFrame(state.quality, state.latestSample)) {
      if (state.frameLost) {
        return { ...state, validSince: null };
      }
      return enterPhase({ ...state, validSince: null }, 'searching', at);
    }

    if (state.frameLost) state = { ...state, frameLost: false };
    if (!captureConditionsValid(state.quality, state.latestSample)) {
      return { ...state, validSince: null };
    }

    const validSince = state.validSince ?? at;
    if (at - validSince >= CAPTURE_TIMING.validHoldMs) {
      return enterPhase(
        { ...state, validSince },
        'locking',
        validSince + CAPTURE_TIMING.validHoldMs,
      );
    }
    return { ...state, validSince };
  }

  const rawQualityValid = captureConditionsValid(
    state.latestSample.quality,
    state.latestSample,
  );
  if (!rawQualityValid) {
    const invalidSince = state.invalidSince ?? at;
    if (at - invalidSince >= CAPTURE_TIMING.loseLockMs) {
      const frameLost = !hasAcquisitionFrame(
        state.latestSample.quality,
        state.latestSample,
      );
      return enterPhase(
        {
          ...state,
          invalidSince: null,
          validSince: null,
          frameLost,
          capturedImage: null,
          scanComplete: false,
        },
        'aligning',
        at,
      );
    }
    state = { ...state, invalidSince };
  } else if (state.invalidSince !== null) {
    state = { ...state, invalidSince: null };
  }

  if (state.phase === 'locking') {
    const lockingDuration = CAPTURE_TIMING.guideConnectionMs + CAPTURE_TIMING.mechanicalPauseMs;
    if (at - state.phaseEnteredAt >= lockingDuration) {
      return enterPhase(state, 'scanning', state.phaseEnteredAt + lockingDuration);
    }
    return state;
  }

  const scanDuration = reducedMotion ? CAPTURE_TIMING.reducedMotionScanMs : CAPTURE_TIMING.scanMs;
  // Never cross the capture boundary while a lock-loss guard is pending.
  // A late bad frame must either recover or reach the 300 ms cancellation
  // threshold before the selected bitmap can be committed.
  if (state.phase === 'scanning' && state.invalidSince !== null) {
    return state;
  }
  if (
    state.phase === 'scanning' &&
    state.capturedImage &&
    at - state.phaseEnteredAt >= scanDuration
  ) {
    return enterPhase(state, 'captured', Math.max(at, state.phaseEnteredAt + scanDuration));
  }
  if (
    state.phase === 'scanning' &&
    !state.scanComplete &&
    at - state.phaseEnteredAt >= scanDuration
  ) {
    return { ...state, scanComplete: true };
  }
  return state;
}

const advanceUntilStable = (
  state: CaptureSequenceState,
  at: number,
  reducedMotion: boolean,
): CaptureSequenceState => {
  let current = state;
  for (let index = 0; index < 6; index += 1) {
    const next = advancePhase(current, at, reducedMotion);
    if (next === current || next.phase === current.phase) return next;
    current = next;
  }
  return current;
};

export function reduceCaptureSequence(
  state: CaptureSequenceState,
  event: CaptureSequenceEvent,
  { reducedMotion = false }: { reducedMotion?: boolean } = {},
): CaptureSequenceState {
  if (event.type === 'RESET') return createCaptureSequenceState(event.at);
  if (event.type === 'FAILED') {
    return {
      ...createCaptureSequenceState(event.at),
      phase: 'error',
      failure: event.failure,
    };
  }

  let next = event.type === 'SIGNALS_RECEIVED' ? { ...state, latestSample: event.sample } : state;
  if (event.type === 'CAPTURE_AVAILABLE') {
    next = { ...next, capturedImage: event.image };
  }

  const stabilized = stabilizeQuality(next.latches, next.latestSample, event.at);
  next = updatePresentationSignals(
    updateLowLight(
      {
        ...next,
        ...stabilized,
      },
      event.at,
    ),
    event.at,
  );

  return advanceUntilStable(next, event.at, reducedMotion);
}

export function getNextCaptureSequenceDeadline(
  state: CaptureSequenceState,
  { reducedMotion = false }: { reducedMotion?: boolean } = {},
): number | null {
  const deadlines: number[] = [];
  for (const latch of Object.values(state.latches)) {
    if (latch.candidate === null || latch.candidateSince === null) continue;
    deadlines.push(
      latch.candidateSince +
        (latch.candidate ? CAPTURE_TIMING.returnValidMs : CAPTURE_TIMING.enterInvalidMs),
    );
  }
  if (state.issueCandidateSince !== null) {
    deadlines.push(
      state.issueCandidateSince +
        (state.issueCandidate === null
          ? CAPTURE_TIMING.returnValidMs
          : CAPTURE_TIMING.enterInvalidMs),
    );
  }

  if (state.lowLightSince !== null && !state.persistentLowLight) {
    deadlines.push(state.lowLightSince + CAPTURE_TIMING.persistentLowLightMs);
  }
  if (state.phase === 'aligning' && state.validSince !== null) {
    deadlines.push(state.validSince + CAPTURE_TIMING.validHoldMs);
  }
  if ((state.phase === 'locking' || state.phase === 'scanning') && state.invalidSince !== null) {
    deadlines.push(state.invalidSince + CAPTURE_TIMING.loseLockMs);
  }
  if (state.phase === 'locking') {
    deadlines.push(
      state.phaseEnteredAt + CAPTURE_TIMING.guideConnectionMs + CAPTURE_TIMING.mechanicalPauseMs,
    );
  }
  if (state.phase === 'scanning' && !state.scanComplete) {
    deadlines.push(
      state.phaseEnteredAt +
        (reducedMotion ? CAPTURE_TIMING.reducedMotionScanMs : CAPTURE_TIMING.scanMs),
    );
  }
  if (state.phase === 'captured' && !state.handoffReady) {
    deadlines.push(state.phaseEnteredAt + CAPTURE_TIMING.capturedHoldMs);
  }

  return deadlines.length > 0 ? Math.min(...deadlines) : null;
}
