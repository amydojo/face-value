import { describe, expect, it } from 'vitest';
import { HD_REDNESS_PROTOCOL } from '../adapters/analysis/youcam/contracts';
import { specimenFromRegisteredProduct } from '../adapters/product/specimenFromRegisteredProduct';
import { toPersistedDemoData } from '../adapters/persistence/localObservationStore';
import {
  faceValueReducer,
  initialState,
  type PhaseBFaceValueState,
} from '../app/phaseBMachine';
import type {
  CameraCaptureProfileId,
  CaptureContext,
  CaptureMetadata,
  DurableSkinSignal,
  RegisteredProduct,
} from '../domain/model';
import {
  CAPTURE_CONTEXT_LIMITATION,
  FOLLOW_UP_INTERVAL_DAYS,
  createRegisteredProduct,
  isYouCamProtocolEligible,
  validateProductRegistration,
} from '../domain/phaseB5';

const BASELINE_AT = '2026-07-01T12:00:00.000Z';
const EARLY_FOLLOW_UP_AT = '2026-07-08T12:00:00.000Z';
const ELIGIBLE_AT = '2026-07-15T12:00:00.000Z';

const metadata = (
  kind: 'baseline' | 'followup',
  createdAt = kind === 'baseline' ? BASELINE_AT : ELIGIBLE_AT,
  cameraProfileId: CameraCaptureProfileId =
    'youcam-camera-kit-hd-1080p',
): CaptureMetadata => ({
  id: `${kind}-${createdAt}`,
  kind,
  source: 'camera',
  mimeType: 'image/jpeg',
  createdAt,
  orientationRule: 'analysis-unmirrored',
  cameraProfileId,
});

const signal = (
  kind: 'baseline' | 'followup',
  rawScore: number,
  capturedAt = kind === 'baseline' ? BASELINE_AT : ELIGIBLE_AT,
): DurableSkinSignal => ({
  provider: 'youcam',
  apiVersion: '2.1',
  mode: 'hd',
  concern: 'hd_redness',
  region: null,
  scoreType: 'raw_score',
  captureProtocolVersion: 'face-value-youcam-1',
  rawScore,
  capturedAt,
  captureQuality: 'accepted',
});

const product = (
  overrides: Partial<RegisteredProduct> = {},
): RegisteredProduct => ({
  ...createRegisteredProduct(
    {
      brand: '  Naturium  ',
      productName: ' Azelaic   Topical Acid ',
      strength: '10%',
      volume: '30 ml',
    },
    BASELINE_AT,
  ),
  ...overrides,
});

const registerProduct = (): PhaseBFaceValueState => {
  const registration = faceValueReducer(initialState, {
    type: 'START_PRODUCT_REGISTRATION',
  });
  return faceValueReducer(registration, {
    type: 'REGISTER_PRODUCT',
    product: product(),
  });
};

const acceptBaseline = (): PhaseBFaceValueState => {
  const camera = faceValueReducer(registerProduct(), {
    type: 'BEGIN_CAPTURE',
    kind: 'baseline',
    now: BASELINE_AT,
  });
  const started = faceValueReducer(camera, {
    type: 'BASELINE_ANALYSIS_STARTED',
    requestId: 'baseline-request',
    metadata: metadata('baseline'),
  });
  return faceValueReducer(started, {
    type: 'BASELINE_ANALYSIS_ACCEPTED',
    requestId: 'baseline-request',
    protocol: HD_REDNESS_PROTOCOL,
    signal: signal('baseline', 93.3356),
  });
};

const waitingTrial = (
  context: CaptureContext = {
    makeup: false,
    recentHeatOrExercise: false,
    recentCleansingOrSkincare: false,
    routineOrTreatmentChange: false,
    note: null,
  },
): PhaseBFaceValueState => {
  const locked = faceValueReducer(acceptBaseline(), {
    type: 'CAPTURE_CONTEXT_RECORDED',
    kind: 'baseline',
    context,
  });
  return faceValueReducer(locked, { type: 'FINISH_BASELINE_SESSION' });
};

const comparedTrial = (withContext = false): PhaseBFaceValueState => {
  const baseline = waitingTrial(
    withContext
      ? {
          makeup: false,
          recentHeatOrExercise: true,
          recentCleansingOrSkincare: false,
          routineOrTreatmentChange: false,
          note: 'Walked home in warm weather.',
        }
      : undefined,
  );
  const ready = faceValueReducer(baseline, {
    type: 'CHECK_FOLLOWUP_ELIGIBILITY',
    now: ELIGIBLE_AT,
  });
  const camera = faceValueReducer(ready, {
    type: 'BEGIN_CAPTURE',
    kind: 'followup',
    now: ELIGIBLE_AT,
  });
  const started = faceValueReducer(camera, {
    type: 'FOLLOWUP_ANALYSIS_STARTED',
    requestId: 'followup-request',
    metadata: metadata('followup'),
  });
  const accepted = faceValueReducer(started, {
    type: 'FOLLOWUP_ANALYSIS_ACCEPTED',
    requestId: 'followup-request',
    signal: signal('followup', 100),
  });
  const contextRecorded = faceValueReducer(accepted, {
    type: 'CAPTURE_CONTEXT_RECORDED',
    kind: 'followup',
    context: {
      makeup: false,
      recentHeatOrExercise: false,
      recentCleansingOrSkincare: false,
      routineOrTreatmentChange: false,
      note: null,
    },
  });
  return faceValueReducer(contextRecorded, { type: 'COMPARISON_CREATED' });
};

describe('Phase B.5 registered product identity', () => {
  it('validates required identity, normalizes fields, and adapts one specimen', () => {
    expect(
      validateProductRegistration({ brand: ' ', productName: '' }),
    ).toEqual({
      brand: 'Enter the product brand.',
      productName: 'Enter the product name.',
    });

    const registered = product();
    expect(registered).toMatchObject({
      id: 'registered-product-20260701120000000',
      accession: 'SPECIMEN 01',
      brand: 'Naturium',
      productName: 'Azelaic Topical Acid',
      strength: '10%',
      volume: '30 ml',
      assignedJob: 'Reduce visible redness',
      protocolId: 'youcam-redness-v1',
    });
    expect(specimenFromRegisteredProduct(registered)).toEqual({
      id: registered.id,
      accession: registered.accession,
      brand: registered.brand,
      product: registered.productName,
      volume: registered.volume,
      shelf: 'observation',
      jobOptions: ['Reduce visible redness'],
    });
  });

  it('selects the provider by protocol, never by fixture identity', () => {
    expect(
      isYouCamProtocolEligible(product({ id: 'not-one-thing' })),
    ).toBe(true);
    expect(
      isYouCamProtocolEligible({
        ...product({ id: 'one-thing' }),
        protocolId: 'different-protocol',
      } as unknown as RegisteredProduct),
    ).toBe(false);
    expect(isYouCamProtocolEligible(null)).toBe(false);
  });
});

describe('Phase B.5 timing and context laws', () => {
  it('locks the baseline, calculates fourteen days, and reducer-blocks early follow-up', () => {
    const accepted = acceptBaseline();
    expect(accepted.stage).toBe('baseline_context');
    expect(accepted.baselineLockedAt).toBe(BASELINE_AT);
    expect(accepted.followUpEligibleAt).toBe(ELIGIBLE_AT);
    expect(FOLLOW_UP_INTERVAL_DAYS).toBe(14);

    const waiting = faceValueReducer(
      faceValueReducer(accepted, {
        type: 'CAPTURE_CONTEXT_RECORDED',
        kind: 'baseline',
        context: {
          makeup: false,
          recentHeatOrExercise: false,
          recentCleansingOrSkincare: false,
          routineOrTreatmentChange: false,
          note: null,
        },
      }),
      { type: 'FINISH_BASELINE_SESSION' },
    );
    expect(waiting.stage).toBe('waiting_for_followup');

    const rejected = faceValueReducer(waiting, {
      type: 'BEGIN_CAPTURE',
      kind: 'followup',
      now: EARLY_FOLLOW_UP_AT,
    });
    expect(rejected.stage).toBe('waiting_for_followup');
    expect(rejected.longitudinalEvidence.followUp).toBeNull();

    const ready = faceValueReducer(waiting, {
      type: 'CHECK_FOLLOWUP_ELIGIBILITY',
      now: ELIGIBLE_AT,
    });
    const camera = faceValueReducer(ready, {
      type: 'BEGIN_CAPTURE',
      kind: 'followup',
      now: ELIGIBLE_AT,
    });
    expect(ready.stage).toBe('followup_ready');
    expect(camera.stage).toBe('camera');
  });

  it('advances only the explicit demo state without rewriting elapsed time', () => {
    const waiting = waitingTrial();
    const advanced = faceValueReducer(waiting, {
      type: 'ADVANCE_DEMO_TIMELINE',
      now: EARLY_FOLLOW_UP_AT,
    });
    expect(advanced.stage).toBe('followup_ready');
    expect(advanced.demoTimelineAdvanced).toBe(true);
    expect(advanced.baselineLockedAt).toBe(waiting.baselineLockedAt);
    expect(advanced.followUpEligibleAt).toBe(waiting.followUpEligibleAt);
    expect(toPersistedDemoData(advanced).demoTimelineAdvanced).toBe(true);
  });

  it('freezes the accepted baseline capture profile for follow-up', () => {
    const waiting = waitingTrial();
    expect(waiting.baselineCapture?.cameraProfileId).toBe(
      'youcam-camera-kit-hd-1080p',
    );
    const ready = faceValueReducer(waiting, {
      type: 'CHECK_FOLLOWUP_ELIGIBILITY',
      now: ELIGIBLE_AT,
    });
    const camera = faceValueReducer(ready, {
      type: 'BEGIN_CAPTURE',
      kind: 'followup',
      now: ELIGIBLE_AT,
    });
    const mismatched = faceValueReducer(camera, {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'mismatched-profile',
      metadata: metadata(
        'followup',
        ELIGIBLE_AT,
        'youcam-camera-kit-hd-1920p',
      ),
    });
    expect(mismatched).toEqual(camera);

    const matched = faceValueReducer(camera, {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'matched-profile',
      metadata: metadata('followup'),
    });
    expect(matched.processing).toBe('running');
    expect(matched.pendingAnalysisCapture?.cameraProfileId).toBe(
      waiting.baselineCapture?.cameraProfileId,
    );

    const fileFallback = faceValueReducer(camera, {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'file-fallback',
      metadata: {
        ...metadata('followup'),
        source: 'file',
        cameraProfileId: null,
      },
    });
    expect(fileFallback.processing).toBe('running');
  });

  it('persists optional context only as a limitation and never raises confidence', () => {
    const compared = comparedTrial(true);
    expect(compared.baselineContext?.recentHeatOrExercise).toBe(true);
    expect(compared.longitudinalEvidence.comparison?.limitations).toContain(
      CAPTURE_CONTEXT_LIMITATION,
    );
    expect(compared.confidence).toBe('possible');
  });
});

describe('Phase B.5 sealed result and atomic release', () => {
  it('keeps one route and accepts only the causal reveal order', () => {
    const sealed = comparedTrial();
    expect(sealed.stage).toBe('analysis');
    expect(sealed.resultRevealed).toBe(false);
    expect(sealed.oracleRevealState).toBe('sealed');
    expect(sealed.analysis?.finding).toBe(
      'A small favorable shift showed up.',
    );

    const opening = faceValueReducer(sealed, {
      type: 'REVEAL_STARTED',
    });
    const invalidTransmission = faceValueReducer(opening, {
      type: 'TRANSMISSION_COMPLETED',
    });
    const transmitting = faceValueReducer(opening, {
      type: 'REVEAL_PULL_COMPLETED',
    });
    const revealed = faceValueReducer(transmitting, {
      type: 'TRANSMISSION_COMPLETED',
    });
    const duplicateReveal = faceValueReducer(revealed, {
      type: 'TRANSMISSION_COMPLETED',
    });

    expect(opening.oracleRevealState).toBe('opening');
    expect(invalidTransmission).toEqual(opening);
    expect(transmitting.oracleRevealState).toBe('transmitting');
    expect(revealed.stage).toBe('analysis');
    expect(revealed.oracleRevealState).toBe('verdict_revealed');
    expect(revealed.resultRevealed).toBe(true);
    expect(revealed.placement).toBe('paused');
    expect(duplicateReveal).toEqual(revealed);
  });

  it('persists once at collection and returns home only after Done', () => {
    const opening = faceValueReducer(comparedTrial(true), {
      type: 'REVEAL_STARTED',
    });
    const transmitting = faceValueReducer(opening, {
      type: 'REVEAL_PULL_COMPLETED',
    });
    const revealed = faceValueReducer(transmitting, {
      type: 'TRANSMISSION_COMPLETED',
    });
    const committed = faceValueReducer(revealed, {
      type: 'RECOMMENDATION_ACCEPTED',
      placement: 'paused',
      now: '2026-07-15T12:30:00.000Z',
    });
    const duplicateCommit = faceValueReducer(committed, {
      type: 'RECOMMENDATION_ACCEPTED',
      placement: 'paused',
      now: '2026-07-15T12:31:00.000Z',
    });
    const invalidCollection = faceValueReducer(committed, {
      type: 'EVIDENCE_COLLECTED',
    });
    const dispensing = faceValueReducer(committed, {
      type: 'DISPENSE_STARTED',
    });
    const presented = faceValueReducer(dispensing, {
      type: 'EVIDENCE_DISPENSED',
    });
    const collectionStarted = faceValueReducer(presented, {
      type: 'EVIDENCE_COLLECTION_STARTED',
    });
    const collected = faceValueReducer(collectionStarted, {
      type: 'EVIDENCE_COLLECTED',
    });
    const duplicateCollection = faceValueReducer(collected, {
      type: 'EVIDENCE_COLLECTED',
    });

    expect(committed.oracleRevealState).toBe('committing');
    expect(committed.placementSealed).toBe(false);
    expect(committed.archive).toHaveLength(0);
    expect(committed.record).toBeNull();
    expect(duplicateCommit).toEqual(committed);
    expect(invalidCollection).toEqual(committed);
    expect(dispensing.oracleRevealState).toBe('dispensing');
    expect(presented.oracleEvidenceDispensed).toBe(true);
    expect(collected.oracleRevealState).toBe('collected');
    expect(collected.placementSealed).toBe(true);
    expect(collected.archive).toHaveLength(1);
    expect(collected.record).toMatchObject({
      id: 'ER-202607151230',
      specimenId: collected.registeredProduct?.id,
      product: 'Azelaic Topical Acid',
      productBrand: 'Naturium',
      finalPlacement: 'paused',
      includesFaceImage: false,
    });
    expect(duplicateCollection).toEqual(collected);

    const archive = faceValueReducer(collected, { type: 'VIEW_ARCHIVE' });
    const reopened = faceValueReducer(archive, {
      type: 'VIEW_RECORD',
      record: archive.archive[0],
    });
    expect(reopened.record?.id).toBe(collected.record?.id);

    const done = faceValueReducer(collected, { type: 'ORACLE_DONE' });
    expect(done.oracleRevealState).toBe('done');
    expect(done.stage).toBe('cabinet');
    expect(done.observation).toBe('none');
    expect(done.registeredProduct).toBeNull();
    expect(done.archive).toHaveLength(1);
  });

  it('preserves accepted baseline through failure, cancel, retry, and back', () => {
    const waiting = waitingTrial();
    const ready = faceValueReducer(waiting, {
      type: 'ADVANCE_DEMO_TIMELINE',
      now: EARLY_FOLLOW_UP_AT,
    });
    const camera = faceValueReducer(ready, {
      type: 'BEGIN_CAPTURE',
      kind: 'followup',
      now: EARLY_FOLLOW_UP_AT,
    });
    const started = faceValueReducer(camera, {
      type: 'FOLLOWUP_ANALYSIS_STARTED',
      requestId: 'failure-request',
      metadata: metadata('followup', EARLY_FOLLOW_UP_AT),
    });
    const failed = faceValueReducer(started, {
      type: 'FOLLOWUP_ANALYSIS_FAILED',
      requestId: 'failure-request',
      error: {
        role: 'followup',
        code: 'network',
        message: 'Connection interrupted.',
        retryable: true,
      },
    });
    const cancelled = faceValueReducer(started, {
      type: 'ANALYSIS_CANCELLED',
      requestId: 'failure-request',
    });
    const backedOut = faceValueReducer(cancelled, { type: 'BACK' });

    for (const state of [failed, cancelled, backedOut]) {
      expect(state.registeredProduct?.productName).toBe(
        'Azelaic Topical Acid',
      );
      expect(state.longitudinalEvidence.baseline?.rawScore).toBe(93.3356);
    }
    expect(backedOut.stage).toBe('followup_ready');
  });

  it('serializes durable truth without requests, blobs, or face images', () => {
    const persisted = JSON.stringify(
      toPersistedDemoData(
        faceValueReducer(
          faceValueReducer(comparedTrial(), { type: 'REVEAL_RESULT' }),
          {
            type: 'COMMIT_RESULT_AND_RELEASE',
            placement: 'paused',
            now: '2026-07-15T12:30:00.000Z',
          },
        ),
      ),
    );
    expect(persisted).toContain('Naturium');
    expect(persisted).toContain('youcam-redness-v1');
    expect(persisted).not.toMatch(
      /data:image|blob:|providerTaskId|signed upload|MediaStream|CameraKit|ephemeralTaskReference/,
    );
  });
});
