import { describe, expect, it, vi } from 'vitest';
import {
  analyzeRednessBurstFrames,
  type EphemeralRednessFrame,
} from '../adapters/analysis/youcam/rednessBurstAnalysis';
import {
  HD_REDNESS_PROTOCOL,
  type AnalyzeCaptureInput,
  type SkinAnalysisProvider,
  type SkinAnalysisSignal,
} from '../adapters/analysis/youcam/contracts';
import { toPersistedDemoData } from '../adapters/persistence/localObservationStore';
import { faceValueReducer, initialState, type PhaseBFaceValueState } from '../app/phaseBMachine';
import type {
  CapturedRednessFrame,
  CaptureKind,
  CaptureMetadata,
  DurableSkinSignal,
} from '../domain/model';
import {
  REDNESS_BURST_MAX_CAPTURE_ATTEMPTS,
  REDNESS_BURST_PROVIDER_CONCURRENCY,
} from '../domain/rednessEvidenceBurst';

const timestampFor = (role: CaptureKind, index: number): string =>
  `2026-07-${role === 'baseline' ? '01' : '30'}T12:00:00.00${index}Z`;

const metadataFor = (role: CaptureKind, frameId: string, index: number): CaptureMetadata => ({
  id: frameId,
  kind: role,
  source: 'camera',
  mimeType: 'image/jpeg',
  createdAt: timestampFor(role, index),
  orientationRule: 'analysis-unmirrored',
  cameraProfileId: 'native-browser-camera-v1',
});

const capturedFrame = (
  role: CaptureKind,
  frameId: string,
  index: number,
): CapturedRednessFrame => ({
  frameId,
  capture: metadataFor(role, frameId, index),
  quality: {
    currentFrame: 'accepted',
    exposure: 'accepted',
    movement: 'accepted',
  },
});

const durableSignal = (score: number, capture: CaptureMetadata): DurableSkinSignal => ({
  provider: 'youcam',
  apiVersion: '2.1',
  mode: 'hd',
  concern: 'hd_redness',
  region: null,
  scoreType: 'raw_score',
  captureProtocolVersion: 'face-value-youcam-1',
  rawScore: score,
  capturedAt: capture.createdAt,
  captureQuality: 'accepted',
});

const cameraState = (
  role: CaptureKind,
  state: PhaseBFaceValueState = initialState,
): PhaseBFaceValueState => ({
  ...state,
  stage: 'camera',
  camera: 'ready',
  captureKind: role,
  assignedJob: 'Reduce visible redness',
  processing: 'idle',
  analysisError: null,
});

const startBurst = (
  state: PhaseBFaceValueState,
  role: CaptureKind,
  generationId: string,
): PhaseBFaceValueState =>
  faceValueReducer(cameraState(role, state), {
    type: 'REDNESS_BURST_STARTED',
    generationId,
    burstId: `${generationId}-burst`,
    sessionId: `${generationId}-session`,
    role,
    startedAt: timestampFor(role, 0),
  });

const captureFrames = (
  state: PhaseBFaceValueState,
  role: CaptureKind,
  generationId: string,
  frameIds: string[],
): PhaseBFaceValueState => {
  let next = state;
  frameIds.forEach((frameId, index) => {
    next = faceValueReducer(next, {
      type: 'REDNESS_BURST_FRAME_CAPTURED',
      generationId,
      frame: capturedFrame(role, frameId, index + 1),
    });
  });
  return next;
};

const acceptMeasurement = (
  state: PhaseBFaceValueState,
  generationId: string,
  frameId: string,
  score: number,
  attempt: 1 | 2 = 1,
): PhaseBFaceValueState => {
  const requestId = `${generationId}-${frameId}-request-${attempt}`;
  const started = faceValueReducer(state, {
    type: 'REDNESS_BURST_ANALYSIS_STARTED',
    generationId,
    frameId,
    requestId,
    attempt,
  });
  const capture = started.activeRednessBurst?.capturedFrames.find(
    (frame) => frame.frameId === frameId,
  )?.capture;
  if (!capture) throw new Error(`Expected captured frame ${frameId}.`);
  return faceValueReducer(started, {
    type: 'REDNESS_BURST_ANALYSIS_ACCEPTED',
    generationId,
    frameId,
    requestId,
    attempt,
    protocol: HD_REDNESS_PROTOCOL,
    signal: durableSignal(score, capture),
  });
};

const readyBurst = (
  state: PhaseBFaceValueState,
  role: CaptureKind,
  generationId: string,
  scores: number[],
  withRejectedAttempt = false,
): PhaseBFaceValueState => {
  let next = startBurst(state, role, generationId);
  if (withRejectedAttempt) {
    next = faceValueReducer(next, {
      type: 'REDNESS_BURST_CAPTURE_REJECTED',
      generationId,
      frame: {
        frameId: `${generationId}-rejected`,
        attemptedAt: timestampFor(role, 1),
        stage: 'capture',
        reasons: ['movement above accepted range'],
      },
    });
  }
  const frameIds = scores.map((_, index) => `${generationId}-frame-${index + 1}`);
  next = captureFrames(next, role, generationId, frameIds);
  next = faceValueReducer(next, {
    type: 'REDNESS_BURST_CAPTURE_COMPLETED',
    generationId,
  });
  scores.forEach((score, index) => {
    next = acceptMeasurement(next, generationId, frameIds[index], score);
  });
  return next;
};

const commitBurst = (
  state: PhaseBFaceValueState,
  generationId: string,
  role: CaptureKind,
): PhaseBFaceValueState =>
  faceValueReducer(state, {
    type: 'REDNESS_BURST_COMMIT_REQUESTED',
    generationId,
    completedAt: timestampFor(role, 9),
  });

describe('redness burst reducer authority', () => {
  it('starts one generation, rejects duplicate IDs, ignores stale completions, and stops at five attempts', () => {
    const started = startBurst(initialState, 'baseline', 'generation-1');
    const duplicateStart = startBurst(started, 'baseline', 'generation-2');
    expect(duplicateStart.activeRednessBurst?.generationId).toBe('generation-1');

    const stale = faceValueReducer(started, {
      type: 'REDNESS_BURST_FRAME_CAPTURED',
      generationId: 'obsolete-generation',
      frame: capturedFrame('baseline', 'stale-frame', 1),
    });
    expect(stale.activeRednessBurst?.attemptedFrameCount).toBe(0);

    let bounded = faceValueReducer(started, {
      type: 'REDNESS_BURST_FRAME_CAPTURED',
      generationId: 'generation-1',
      frame: capturedFrame('baseline', 'accepted-once', 1),
    });
    bounded = faceValueReducer(bounded, {
      type: 'REDNESS_BURST_FRAME_CAPTURED',
      generationId: 'generation-1',
      frame: capturedFrame('baseline', 'accepted-once', 2),
    });
    expect(bounded.activeRednessBurst?.attemptedFrameCount).toBe(1);

    for (let attempt = 2; attempt <= REDNESS_BURST_MAX_CAPTURE_ATTEMPTS; attempt += 1) {
      bounded = faceValueReducer(bounded, {
        type: 'REDNESS_BURST_CAPTURE_REJECTED',
        generationId: 'generation-1',
        frame: {
          frameId: `rejected-${attempt}`,
          attemptedAt: timestampFor('baseline', attempt),
          stage: 'capture',
          reasons: ['lighting outside accepted range'],
        },
      });
    }
    expect(bounded.activeRednessBurst).toMatchObject({
      attemptedFrameCount: 5,
      status: 'failed',
    });

    const sixthAttempt = faceValueReducer(bounded, {
      type: 'REDNESS_BURST_FRAME_CAPTURED',
      generationId: 'generation-1',
      frame: capturedFrame('baseline', 'too-late', 6),
    });
    const prematureCommit = commitBurst(sixthAttempt, 'generation-1', 'baseline');
    expect(prematureCommit.activeRednessBurst?.attemptedFrameCount).toBe(5);
    expect(prematureCommit.longitudinalEvidence.baselineBurst).toBeNull();
    expect(prematureCommit.longitudinalEvidence.baseline).toBeNull();
  });

  it('commits a baseline atomically only after three analyzed measurements exist', () => {
    const generationId = 'baseline-atomic';
    let analyzing = startBurst(initialState, 'baseline', generationId);
    const frameIds = ['baseline-frame-1', 'baseline-frame-2', 'baseline-frame-3'];
    analyzing = captureFrames(analyzing, 'baseline', generationId, frameIds);
    analyzing = faceValueReducer(analyzing, {
      type: 'REDNESS_BURST_CAPTURE_COMPLETED',
      generationId,
    });
    analyzing = acceptMeasurement(analyzing, generationId, frameIds[0], 90.25);
    analyzing = acceptMeasurement(analyzing, generationId, frameIds[1], 91.5);

    const incompleteCommit = commitBurst(analyzing, generationId, 'baseline');
    expect(incompleteCommit.longitudinalEvidence.baselineBurst).toBeNull();
    expect(incompleteCommit.activeRednessBurst?.acceptedFrames).toHaveLength(2);

    const ready = acceptMeasurement(incompleteCommit, generationId, frameIds[2], 92.75);
    expect(ready.activeRednessBurst?.status).toBe('ready');
    expect(ready.longitudinalEvidence.baselineBurst).toBeNull();

    const committed = commitBurst(ready, generationId, 'baseline');
    expect(committed.activeRednessBurst).toBeNull();
    expect(committed.longitudinalEvidence.baseline).toBeNull();
    expect(
      committed.longitudinalEvidence.baselineBurst?.acceptedFrames.map(
        (frame) => frame.signal.rawScore,
      ),
    ).toEqual([90.25, 91.5, 92.75]);
    expect(committed.longitudinalEvidence.baselineBurst?.attemptedFrameCount).toBe(3);
  });

  it('commits a follow-up atomically only after its third analyzed measurement', () => {
    const baseline = commitBurst(
      readyBurst(initialState, 'baseline', 'followup-atomic-baseline', [89, 90, 91]),
      'followup-atomic-baseline',
      'baseline',
    );
    const generationId = 'followup-atomic';
    const frameIds = [
      'followup-atomic-frame-1',
      'followup-atomic-frame-2',
      'followup-atomic-frame-3',
    ];
    let analyzing = startBurst(baseline, 'followup', generationId);
    analyzing = captureFrames(analyzing, 'followup', generationId, frameIds);
    analyzing = faceValueReducer(analyzing, {
      type: 'REDNESS_BURST_CAPTURE_COMPLETED',
      generationId,
    });
    analyzing = acceptMeasurement(analyzing, generationId, frameIds[0], 96);
    analyzing = acceptMeasurement(analyzing, generationId, frameIds[1], 97);

    const incompleteCommit = commitBurst(analyzing, generationId, 'followup');
    expect(incompleteCommit.longitudinalEvidence.followUpBurst).toBeNull();
    expect(incompleteCommit.stage).toBe('camera');

    const ready = acceptMeasurement(incompleteCommit, generationId, frameIds[2], 98);
    const committed = commitBurst(ready, generationId, 'followup');
    expect(committed.longitudinalEvidence.followUpBurst?.acceptedFrames).toHaveLength(3);
    expect(committed.longitudinalEvidence.followUp).toBeNull();
    expect(committed.activeRednessBurst).toBeNull();
  });

  it('settles each provider request once and permits only one sequential retry for a frame', () => {
    const generationId = 'provider-settlement';
    let state = startBurst(initialState, 'baseline', generationId);
    const frameIds = ['provider-frame-1', 'provider-frame-2', 'provider-frame-3'];
    state = captureFrames(state, 'baseline', generationId, frameIds);
    state = faceValueReducer(state, {
      type: 'REDNESS_BURST_CAPTURE_COMPLETED',
      generationId,
    });

    const firstRequestId = 'provider-frame-1-attempt-1';
    state = faceValueReducer(state, {
      type: 'REDNESS_BURST_ANALYSIS_STARTED',
      generationId,
      frameId: frameIds[0],
      requestId: firstRequestId,
      attempt: 1,
    });
    const overlappingRequest = faceValueReducer(state, {
      type: 'REDNESS_BURST_ANALYSIS_STARTED',
      generationId,
      frameId: frameIds[1],
      requestId: 'overlapping-request',
      attempt: 1,
    });
    expect(overlappingRequest.activeRednessBurst?.providerRequests).toHaveLength(1);

    state = faceValueReducer(overlappingRequest, {
      type: 'REDNESS_BURST_ANALYSIS_FAILED',
      generationId,
      frameId: frameIds[0],
      requestId: firstRequestId,
      attempt: 1,
      terminal: false,
      error: {
        role: 'baseline',
        code: 'analysis_request_failed',
        message: 'Provider request interrupted.',
        retryable: true,
      },
    });
    state = acceptMeasurement(state, generationId, frameIds[0], 90, 2);
    const acceptedOnce = state;
    const secondRequestId = `${generationId}-${frameIds[0]}-request-2`;
    const duplicateCompletion = faceValueReducer(state, {
      type: 'REDNESS_BURST_ANALYSIS_ACCEPTED',
      generationId,
      frameId: frameIds[0],
      requestId: secondRequestId,
      attempt: 2,
      protocol: HD_REDNESS_PROTOCOL,
      signal: durableSignal(999, state.activeRednessBurst!.capturedFrames[0].capture),
    });
    expect(duplicateCompletion.activeRednessBurst?.acceptedFrames).toEqual(
      acceptedOnce.activeRednessBurst?.acceptedFrames,
    );
    expect(
      duplicateCompletion.activeRednessBurst?.providerRequests.map((request) => request.requestId),
    ).toEqual([firstRequestId, secondRequestId]);

    const staleCompletion = faceValueReducer(duplicateCompletion, {
      type: 'REDNESS_BURST_ANALYSIS_ACCEPTED',
      generationId: 'obsolete-generation',
      frameId: frameIds[1],
      requestId: 'obsolete-request',
      attempt: 1,
      protocol: HD_REDNESS_PROTOCOL,
      signal: durableSignal(91, state.activeRednessBurst!.capturedFrames[1].capture),
    });
    expect(staleCompletion.activeRednessBurst?.acceptedFrames).toHaveLength(1);
  });

  it('passes actual accepted arrays and rejected attempts to the canonical evaluator once', () => {
    const baselineReady = readyBurst(
      initialState,
      'baseline',
      'baseline-evaluator',
      [90.5, 93.25, 96.75],
      true,
    );
    const baseline = commitBurst(baselineReady, 'baseline-evaluator', 'baseline');
    expect(baseline.longitudinalEvidence.baselineBurst?.rejectedFrames).toHaveLength(1);

    const followUpReady = readyBurst(
      baseline,
      'followup',
      'followup-evaluator',
      [97.125, 100, 99.5],
      true,
    );
    expect(followUpReady.longitudinalEvidence.followUpBurst).toBeNull();
    const followUp = commitBurst(followUpReady, 'followup-evaluator', 'followup');
    expect(followUp.longitudinalEvidence.followUpBurst?.acceptedFrames).toHaveLength(3);

    const compared = faceValueReducer(
      { ...followUp, stage: 'analysis' },
      { type: 'COMPARISON_CREATED' },
    );
    const evaluation = compared.longitudinalEvidence.evaluation;
    expect(evaluation?.baseline.acceptedRawScores).toEqual([90.5, 93.25, 96.75]);
    expect(evaluation?.endpoint.acceptedRawScores).toEqual([97.125, 100, 99.5]);
    expect(evaluation?.baseline.rawMedian).toBe(93.25);
    expect(evaluation?.endpoint.rawMedian).toBe(99.5);
    expect(evaluation?.baseline.rejectedFrameCount).toBe(1);
    expect(evaluation?.endpoint.rejectedFrameCount).toBe(1);
    expect(evaluation?.baseline.sessions[0].frameIds).toContain('baseline-evaluator-rejected');
    expect(evaluation?.endpoint.sessions[0].rejectedFrames[0].reasons).toEqual([
      'movement above accepted range',
    ]);
    expect(evaluation?.directionAgreement).toMatchObject({
      status: 'agreeing',
      assessedEndpointFrameCount: 3,
    });

    const duplicateComparison = faceValueReducer(compared, {
      type: 'COMPARISON_CREATED',
    });
    expect(duplicateComparison.longitudinalEvidence.evaluation).toEqual(evaluation);
    expect(duplicateComparison.analysis).toEqual(compared.analysis);

    const persisted = JSON.stringify(toPersistedDemoData(duplicateComparison));
    expect(persisted).not.toMatch(
      /activeRednessBurst|Blob|blob:|data:image|base64|providerTaskId|ephemeralTaskReference|ui_score|MediaStream/,
    );
  });
});

const providerSignalFor = (
  input: AnalyzeCaptureInput,
  score: number,
  identity: string,
): SkinAnalysisSignal => ({
  provider: 'youcam',
  apiVersion: input.protocol.apiVersion,
  mode: 'hd',
  concern: 'hd_redness',
  region: null,
  rawScore: score,
  capturedAt: input.capturedAt,
  captureQuality: 'accepted',
  ephemeralTaskReference: identity,
});

const ephemeralFrames = (): EphemeralRednessFrame[] =>
  [1, 2, 3].map((index) => {
    const frameId = `ephemeral-frame-${index}`;
    return {
      frameId,
      image: new Blob([`private-frame-${index}`], { type: 'image/jpeg' }),
      fileName: `baseline-measurement-${index}-${frameId}.jpg`,
      metadata: metadataFor('baseline', frameId, index),
    };
  });

describe('redness burst provider orchestration', () => {
  it('runs three independent requests sequentially and retries only the failed frame once', async () => {
    const calls: string[] = [];
    const attempts = new Map<string, number>();
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const provider: SkinAnalysisProvider = {
      async analyzeCapture(input) {
        const fileName = input.fileName ?? 'unknown';
        calls.push(fileName);
        const attempt = (attempts.get(fileName) ?? 0) + 1;
        attempts.set(fileName, attempt);
        activeRequests += 1;
        maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
        await Promise.resolve();
        activeRequests -= 1;
        if (fileName.includes('measurement-2') && attempt === 1) {
          throw new Error('Synthetic provider interruption.');
        }
        const measurement = Number(fileName.match(/measurement-(\d+)/)?.[1] ?? 0);
        return providerSignalFor(input, 90 + measurement, `${fileName}-${attempt}`);
      },
    };
    const started: string[] = [];
    const failed: Array<{ frameId: string; terminal: boolean }> = [];
    const accepted: string[] = [];
    const released: string[] = [];

    await analyzeRednessBurstFrames({
      provider,
      role: 'baseline',
      frames: ephemeralFrames(),
      frozenProtocol: null,
      generationId: 'orchestration-generation',
      signal: new AbortController().signal,
      requestIdFactory: (frameId, attempt) => `${frameId}-request-${attempt}`,
      releaseFrame: (frameId) => released.push(frameId),
      onRequestStarted: ({ requestId }) => started.push(requestId),
      onRequestFailed: ({ frameId, terminal }) => failed.push({ frameId, terminal }),
      onRequestAccepted: ({ frameId }) => accepted.push(frameId),
    });

    expect(REDNESS_BURST_PROVIDER_CONCURRENCY).toBe(1);
    expect(maximumActiveRequests).toBe(1);
    expect(calls.map((fileName) => fileName.match(/measurement-(\d+)/)?.[1])).toEqual([
      '1',
      '2',
      '2',
      '3',
    ]);
    expect(new Set(started).size).toBe(4);
    expect(failed).toEqual([{ frameId: 'ephemeral-frame-2', terminal: false }]);
    expect(accepted).toEqual(['ephemeral-frame-1', 'ephemeral-frame-2', 'ephemeral-frame-3']);
    expect(released).toEqual(['ephemeral-frame-1', 'ephemeral-frame-2', 'ephemeral-frame-3']);
  });

  it('aborts outstanding provider work and releases every image exactly once', async () => {
    const controller = new AbortController();
    const provider: SkinAnalysisProvider = {
      analyzeCapture(input) {
        return new Promise<SkinAnalysisSignal>((_resolve, reject) => {
          input.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Analysis cancelled', 'AbortError')),
            { once: true },
          );
        });
      },
    };
    const released: string[] = [];
    const started = vi.fn();
    const analysis = analyzeRednessBurstFrames({
      provider,
      role: 'baseline',
      frames: ephemeralFrames(),
      frozenProtocol: null,
      generationId: 'aborted-generation',
      signal: controller.signal,
      requestIdFactory: (frameId, attempt) => `${frameId}-request-${attempt}`,
      releaseFrame: (frameId) => released.push(frameId),
      onRequestStarted: started,
      onRequestFailed: vi.fn(),
      onRequestAccepted: vi.fn(),
    });
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());

    controller.abort();

    await expect(analysis).rejects.toMatchObject({ name: 'AbortError' });
    expect(released).toEqual(['ephemeral-frame-1', 'ephemeral-frame-2', 'ephemeral-frame-3']);
  });

  it('rejects duplicate frame identifiers before any provider request', async () => {
    const frames = ephemeralFrames();
    frames[2] = { ...frames[2], frameId: frames[1].frameId };
    const provider = {
      analyzeCapture: vi.fn(),
    } satisfies SkinAnalysisProvider;
    const released: string[] = [];

    await expect(
      analyzeRednessBurstFrames({
        provider,
        role: 'baseline',
        frames,
        frozenProtocol: null,
        generationId: 'duplicate-generation',
        signal: new AbortController().signal,
        requestIdFactory: (frameId, attempt) => `${frameId}-request-${attempt}`,
        releaseFrame: (frameId) => released.push(frameId),
        onRequestStarted: vi.fn(),
        onRequestFailed: vi.fn(),
        onRequestAccepted: vi.fn(),
      }),
    ).rejects.toThrow('requires three unique captured frames');
    expect(provider.analyzeCapture).not.toHaveBeenCalled();
    expect(released.sort()).toEqual(['ephemeral-frame-1', 'ephemeral-frame-2']);
  });
});
