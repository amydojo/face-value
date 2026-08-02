import { YouCamProviderError } from '../../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import { createSkinAnalysisProvider } from '../../adapters/analysis/youcam/providerFactory';
import {
  analyzeRednessBurstFrames,
  RednessBurstProviderFailure,
  type EphemeralRednessFrame,
} from '../../adapters/analysis/youcam/rednessBurstAnalysis';
import type { SkinAnalysisProvider } from '../../adapters/analysis/youcam/contracts';
import { metadataForCapture } from '../../adapters/camera/browserCamera';
import {
  createCameraKitAdapter,
  type CameraKitAdapter,
  type GuidedCaptureFailure,
  type GuidedCaptureSession,
} from '../../adapters/camera/youcam-camera-kit';
import {
  REDNESS_CALIBRATION_ANALYSIS_VERSION,
  REDNESS_CALIBRATION_MAX_FIELD_BYTES,
  REDNESS_CALIBRATION_OBSERVATION_SCHEMA,
  REDNESS_CALIBRATION_UNAVAILABLE_METRICS,
  rednessCalibrationUtf8Bytes,
  validateRednessCalibrationObservation,
  type RednessCalibrationConditionType,
  type RednessCalibrationConfounder,
  type RednessCalibrationObservation,
  type RednessCalibrationPreCaptureContext,
} from '../../domain/calibration/redness';
import type {
  AcceptedRednessFrame,
  CameraCaptureProfileId,
  RednessEvidenceBurst,
  RejectedRednessFrame,
} from '../../domain/model';
import {
  isCompleteRednessEvidenceBurst,
  REDNESS_BURST_REQUIRED_MEASUREMENTS,
} from '../../domain/rednessEvidenceBurst';

export interface RednessCalibrationCollectionFields {
  participantId: string;
  sessionId: string;
  conditionId: string;
  conditionType: RednessCalibrationConditionType;
  deviceClass: string;
  preCaptureContext: RednessCalibrationPreCaptureContext;
  measuredSkinToneGroup: string | null;
}

export interface RednessCalibrationCollectionDependencies {
  cameraAdapter: CameraKitAdapter;
  provider: SkinAnalysisProvider;
  now(): string;
  createId(prefix: string): string;
}

export type RednessCalibrationCollectionPhase =
  | 'idle'
  | 'opening_camera'
  | 'preview_live'
  | 'quality_ready'
  | 'capturing'
  | 'analyzing'
  | 'completed'
  | 'failed';

export interface RednessCalibrationCollectionProgress {
  phase: RednessCalibrationCollectionPhase;
  capturedFrameCount: number;
  rejectedFrameCount: number;
  analyzedFrameCount: number;
  message: string;
}

export interface RednessCalibrationCollectionHandle {
  capture(): void;
  cancel(): void;
  completed: Promise<RednessCalibrationObservation>;
}

const defaultId = (prefix: string): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const createRednessCalibrationCollectionDependencies =
  (): RednessCalibrationCollectionDependencies => ({
    cameraAdapter: createCameraKitAdapter(),
    provider: createSkinAnalysisProvider(),
    now: () => new Date().toISOString(),
    createId: defaultId,
  });

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const boundedIdentifier = (value: string): boolean =>
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);

function assertCollectionFields(fields: RednessCalibrationCollectionFields): void {
  for (const [label, value] of [
    ['Participant ID', fields.participantId],
    ['Session ID', fields.sessionId],
    ['Condition ID', fields.conditionId],
  ] as const) {
    if (!boundedIdentifier(value)) {
      throw new Error(`${label} must be a bounded pseudonymous identifier.`);
    }
  }
  for (const [label, value] of [
    ['Device class', fields.deviceClass],
    ['Time of day', fields.preCaptureContext.timeOfDay],
    ['Measured skin-tone audit group', fields.measuredSkinToneGroup],
  ] as const) {
    if (
      value !== null &&
      (value.trim().length === 0 ||
        rednessCalibrationUtf8Bytes(value) > REDNESS_CALIBRATION_MAX_FIELD_BYTES)
    ) {
      throw new Error(`${label} must be present and within the calibration field bound.`);
    }
  }
}

function confoundersFor(
  fields: RednessCalibrationCollectionFields,
): RednessCalibrationConfounder[] {
  const context = fields.preCaptureContext;
  const confounders: RednessCalibrationConfounder[] = [];
  const add = (confounder: RednessCalibrationConfounder) => {
    if (!confounders.some(({ code }) => code === confounder.code)) confounders.push(confounder);
  };
  if (
    [
      context.makeup,
      context.concealer,
      context.tintedMoisturizer,
      context.tintedSpf,
      context.selfTanner,
    ].includes('present')
  ) {
    add({ code: 'makeup_or_tint', severity: 'hard_failure', source: 'participant_report' });
  }
  if ([context.filter, context.otherEnhancement].includes('present')) {
    add({
      code: 'filter_or_enhancement',
      severity: 'hard_failure',
      source: 'participant_report',
    });
  }
  const reportedConfounders: Array<
    [keyof RednessCalibrationPreCaptureContext, RednessCalibrationConfounder['code']]
  > = [
    ['recentHeat', 'recent_heat'],
    ['recentExercise', 'recent_exercise'],
    ['recentShower', 'recent_shower'],
    ['recentCleansing', 'recent_cleansing'],
    ['recentRubbing', 'recent_rubbing'],
    ['recentSunExposure', 'recent_sun_exposure'],
    ['recentProcedureOrIllness', 'recent_procedure_or_illness'],
    ['medicationOrRoutineChange', 'medication_or_routine_change'],
    ['emotionalFlushing', 'emotional_flushing'],
  ];
  for (const [key, code] of reportedConfounders) {
    if (context[key] === 'present') {
      add({ code, severity: 'downgrade', source: 'participant_report' });
    }
  }
  if (context.productRoutineState === 'explicit_change') {
    add({ code: 'explicit_intervention', severity: 'exclusion', source: 'participant_report' });
  }
  if (fields.conditionType === 'degraded') {
    add({ code: 'degraded_capture_condition', severity: 'exclusion', source: 'protocol' });
  }
  return confounders;
}

function completedLiveObservation(input: {
  fields: RednessCalibrationCollectionFields;
  burst: RednessEvidenceBurst;
  observationId: string;
}): RednessCalibrationObservation {
  if (!isCompleteRednessEvidenceBurst(input.burst)) {
    throw new Error(
      'Only a completed canonical three-frame burst can become live calibration evidence.',
    );
  }
  const confounders = confoundersFor(input.fields);
  const hardFailure = confounders.some(({ severity }) => severity === 'hard_failure');
  const scores = input.burst.acceptedFrames.map(({ signal }) => signal.rawScore);
  const observation: RednessCalibrationObservation = {
    schemaVersion: REDNESS_CALIBRATION_OBSERVATION_SCHEMA,
    observationId: input.observationId,
    participantId: input.fields.participantId,
    sessionId: input.fields.sessionId,
    conditionId: input.fields.conditionId,
    conditionType: input.fields.conditionType,
    collectionSource: 'live_provider',
    captureTimestamp: input.burst.completedAt,
    deviceClass: input.fields.deviceClass,
    cameraFacing: 'front',
    appBuildVersion: 'face-value-web-0.1.0',
    apiVersion: input.burst.acceptedFrames[0].signal.apiVersion,
    analysisModelVersion: 'not_reported',
    analysisMode: 'hd',
    preprocessingVersion: 'face-value-unmodified-upload-v1',
    captureProtocolVersion: input.burst.acceptedFrames[0].signal.captureProtocolVersion,
    thresholdCandidateVersion: REDNESS_CALIBRATION_ANALYSIS_VERSION,
    burst: structuredClone(input.burst),
    sessionRawMedian: median(scores),
    captureQuality: {
      accepted: !hardFailure,
      lightingComparability: 'limited',
      poseComparability: 'limited',
      cropComparability: 'limited',
      faceSizeComparability: 'limited',
      colorCastComparability: 'limited',
      obstructionPresent: false,
      enhancementDetected: confounders.some(({ code }) => code === 'filter_or_enhancement'),
      reasons: [
        hardFailure
          ? 'The canonical burst completed, but reported hard-failure context excludes it.'
          : 'The canonical burst completed; unavailable comparability metrics remain limited.',
      ],
    },
    captureOutcome: hardFailure ? 'hard_failure' : 'accepted',
    preCaptureContext: structuredClone(input.fields.preCaptureContext),
    confounders,
    comparisonAnchor: 'not_available',
    measuredSkinToneGroup: input.fields.measuredSkinToneGroup,
    measuredSkinToneSource:
      input.fields.measuredSkinToneGroup === null ? 'not_collected' : 'validated_audit_input',
    unavailableMetrics: { ...REDNESS_CALIBRATION_UNAVAILABLE_METRICS },
    includesFaceImage: false,
  };
  const validated = validateRednessCalibrationObservation(observation);
  if (!validated.valid) {
    throw new Error('Completed calibration evidence failed the face-free observation contract.');
  }
  return validated.observation;
}

function cameraFailureMessage(failure: GuidedCaptureFailure): string {
  if (failure === 'permission-denied')
    return 'Camera permission was denied. No observation was saved.';
  if (failure === 'burst-exhausted') {
    return 'Three accepted current frames were not secured within five attempts. No observation was saved.';
  }
  if (failure === 'preview-stalled')
    return 'The live camera preview stalled. No observation was saved.';
  return 'The camera could not complete the canonical burst. No observation was saved.';
}

export function describeRednessCalibrationCollectionError(error: unknown): string {
  const providerCause = error instanceof RednessBurstProviderFailure ? error.cause : error;
  if (providerCause instanceof YouCamProviderError) {
    const fingerprint = `${providerCause.code} ${providerCause.message}`.toLocaleLowerCase('en-US');
    if (fingerprint.includes('credit') && fingerprint.includes('insuff')) {
      return `Live provider task creation is blocked (HTTP ${providerCause.status} CreditInsufficiency). No observation was saved.`;
    }
    return `Live provider analysis failed (${providerCause.code}). No observation was saved.`;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Live calibration collection was cancelled. No observation was saved.';
  }
  return error instanceof Error
    ? error.message.includes('No observation was saved')
      ? error.message
      : `${error.message} No observation was saved.`
    : 'Live calibration collection failed closed. No observation was saved.';
}

export async function beginRednessCalibrationCollection(input: {
  fields: RednessCalibrationCollectionFields;
  dependencies: RednessCalibrationCollectionDependencies;
  mountElement: HTMLElement;
  previewElement: HTMLVideoElement | null;
  onProgress(progress: RednessCalibrationCollectionProgress): void;
  signal?: AbortSignal;
}): Promise<RednessCalibrationCollectionHandle> {
  assertCollectionFields(input.fields);
  const controller = new AbortController();
  const generationId = input.dependencies.createId('calibration-generation');
  const burstId = input.dependencies.createId('calibration-burst');
  const observationId = input.dependencies.createId('calibration-observation');
  const startedAt = input.dependencies.now();
  const frames = new Map<string, EphemeralRednessFrame>();
  const rejectedFrames: RejectedRednessFrame[] = [];
  const acceptedFrames: AcceptedRednessFrame[] = [];
  let capturedFrameCount = 0;
  let session: GuidedCaptureSession | null = null;
  let captureProfileId: CameraCaptureProfileId | null = null;
  let settled = false;
  let resolveCompleted!: (observation: RednessCalibrationObservation) => void;
  let rejectCompleted!: (error: unknown) => void;
  const completed = new Promise<RednessCalibrationObservation>((resolve, reject) => {
    resolveCompleted = resolve;
    rejectCompleted = reject;
  });

  const counts = (phase: RednessCalibrationCollectionPhase, message: string) => {
    input.onProgress({
      phase,
      capturedFrameCount,
      rejectedFrameCount: rejectedFrames.length,
      analyzedFrameCount: acceptedFrames.length,
      message,
    });
  };
  const release = () => frames.clear();
  const removeExternalAbort = () => input.signal?.removeEventListener('abort', externalAbort);
  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    session?.cancel();
    release();
    removeExternalAbort();
    counts('failed', describeRednessCalibrationCollectionError(error));
    rejectCompleted(error);
  };
  const cancel = () => {
    if (settled) return;
    controller.abort();
    fail(new DOMException('Calibration collection cancelled', 'AbortError'));
  };
  const externalAbort = () => cancel();
  input.signal?.addEventListener('abort', externalAbort, { once: true });
  if (input.signal?.aborted) cancel();

  const analyzeCapturedBurst = async () => {
    if (
      settled ||
      frames.size !== REDNESS_BURST_REQUIRED_MEASUREMENTS ||
      captureProfileId === null
    ) {
      if (!settled) fail(new Error('The camera returned an incomplete three-frame burst.'));
      return;
    }
    counts('analyzing', 'Analyzing measurement 1 of 3 through the canonical provider path.');
    try {
      await analyzeRednessBurstFrames({
        provider: input.dependencies.provider,
        role: 'baseline',
        frames: [...frames.values()],
        frozenProtocol: null,
        generationId,
        signal: controller.signal,
        requestIdFactory: (frameId, attempt) =>
          `${input.dependencies.createId('calibration-analysis')}-${frameId}-${attempt}`,
        releaseFrame: (frameId) => frames.delete(frameId),
        onRequestStarted: () => {
          counts(
            'analyzing',
            `Analyzing measurement ${Math.min(acceptedFrames.length + 1, REDNESS_BURST_REQUIRED_MEASUREMENTS)} of 3 through the canonical provider path.`,
          );
        },
        onRequestFailed: () => undefined,
        onRequestAccepted: ({ frameId, attempt, signal }) => {
          const frame = frames.get(frameId);
          if (!frame)
            throw new Error('Accepted provider evidence no longer matches a captured frame.');
          acceptedFrames.push({
            frameId,
            capture: structuredClone(frame.metadata),
            quality: {
              currentFrame: 'accepted',
              exposure: 'accepted',
              movement: 'accepted',
            },
            signal: structuredClone(signal),
            providerAttemptCount: attempt,
          });
          counts(
            'analyzing',
            `${acceptedFrames.length} of 3 measurements analyzed. Images are released immediately.`,
          );
        },
      });
      const completedAt = input.dependencies.now();
      const burst: RednessEvidenceBurst = {
        burstId,
        role: 'baseline',
        sessionId: input.fields.sessionId,
        captureProfileId,
        startedAt,
        completedAt,
        attemptedFrameCount: acceptedFrames.length + rejectedFrames.length,
        acceptedFrames,
        rejectedFrames,
      };
      const observation = completedLiveObservation({
        fields: input.fields,
        burst,
        observationId,
      });
      settled = true;
      session?.cancel();
      release();
      removeExternalAbort();
      counts('completed', 'Completed face-free observation is ready for isolated persistence.');
      resolveCompleted(observation);
    } catch (error) {
      fail(error);
    }
  };

  counts('opening_camera', 'Opening the live front camera. No observation exists yet.');
  try {
    session = await input.dependencies.cameraAdapter.start({
      mountElement: input.mountElement,
      previewElement: input.previewElement,
      signal: controller.signal,
      burstGenerationId: generationId,
      onQuality: ({ ready }) => {
        counts(
          ready ? 'quality_ready' : 'preview_live',
          ready
            ? 'Live capture quality is ready for the canonical three-frame burst.'
            : 'Live preview is active; align until capture quality is ready.',
        );
      },
      onCapture: (image, profileId, frame) => {
        if (settled) return;
        if (!frame) {
          fail(new Error('The camera did not prove a distinct current frame.'));
          return;
        }
        if (frames.has(frame.frameId)) {
          fail(new Error('The camera repeated a frame identifier during the burst.'));
          return;
        }
        if (capturedFrameCount >= REDNESS_BURST_REQUIRED_MEASUREMENTS) {
          fail(new Error('The camera exceeded the canonical three-frame burst.'));
          return;
        }
        captureProfileId ??= profileId;
        if (captureProfileId !== profileId) {
          fail(new Error('The capture profile changed during the burst.'));
          return;
        }
        const metadata = metadataForCapture(
          'baseline',
          'camera',
          image.type,
          frame.capturedAt,
          profileId,
          frame.frameId,
        );
        frames.set(frame.frameId, {
          frameId: frame.frameId,
          image,
          fileName: `calibration-measurement-${capturedFrameCount + 1}.jpg`,
          metadata,
        });
        capturedFrameCount += 1;
        counts('capturing', `${capturedFrameCount} of 3 distinct current frames captured.`);
      },
      onRejectedAttempt: (attempt) => {
        if (settled) return;
        rejectedFrames.push({ ...attempt, stage: 'capture' });
        counts('capturing', 'A frame was rejected; the bounded burst is continuing.');
      },
      onBurstComplete: ({ acceptedFrameCount }) => {
        if (acceptedFrameCount === REDNESS_BURST_REQUIRED_MEASUREMENTS) {
          void analyzeCapturedBurst();
        } else {
          fail(new Error('The camera returned an incomplete three-frame burst.'));
        }
      },
      onFailure: (failure) => fail(new Error(cameraFailureMessage(failure))),
      onStatus: (status) => {
        if (status === 'preview-live') {
          counts('preview_live', 'Live preview is active; align until capture quality is ready.');
        }
      },
    });
  } catch (error) {
    fail(error);
  }

  return {
    capture: () => {
      counts('capturing', 'Capturing the canonical three-frame burst.');
      session?.capture?.();
    },
    cancel,
    completed,
  };
}
