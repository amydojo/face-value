import type { CameraCaptureProfileId } from '../../../domain/model';
import {
  REDNESS_BURST_MAX_CAPTURE_ATTEMPTS,
  REDNESS_BURST_REQUIRED_MEASUREMENTS,
} from '../../../domain/rednessEvidenceBurst';
import { emptyGuidedCaptureQuality, normalizeCameraKitQuality } from './quality';
import { selectCameraKitCaptureProfile } from './captureProfile';
import { logSafeCameraKitDiagnostic } from './diagnostics';
import type {
  CameraKitAdapter,
  CameraKitDiagnosticStage,
  CameraKitQualityPayload,
  GuidedCaptureFailure,
  GuidedCaptureQuality,
  GuidedCaptureSession,
  GuidedCaptureStartOptions,
} from './types';

export type FixtureCaptureScenario =
  | 'success'
  | 'signal-flicker'
  | 'lose-lock'
  | 'lose-scan'
  | 'burst-rejection'
  | 'permission-denied'
  | 'camera-unavailable';

const abstractFixtureFrame = (): Blob => {
  const binary = atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  );
  return new Blob([Uint8Array.from(binary, (character) => character.charCodeAt(0))], {
    type: 'image/png',
  });
};

export class FixtureCameraKitAdapter implements CameraKitAdapter {
  readonly autoAdvance: boolean;
  readonly stallFirstSession: boolean;
  readonly qualityStepMs: number;
  readonly scenario: FixtureCaptureScenario;
  sessionStartCount = 0;
  cancelCount = 0;
  captureCount = 0;

  private generation = 0;
  private activeOptions: GuidedCaptureStartOptions | null = null;
  private activeQuality: GuidedCaptureQuality = emptyGuidedCaptureQuality();
  private timers: number[] = [];
  private readySince: number | null = null;
  private stableForMs = 2_400;
  private activeCaptured = false;
  private attemptedFrameCount = 0;
  private acceptedFrameCount = 0;
  private previewLive = false;
  private firstQualityFrameSeen = false;
  private cameraClosedDiagnosticSent = false;
  private activeProfileId: CameraCaptureProfileId = 'youcam-camera-kit-standard-720p';
  private activeMountElement: HTMLElement | null = null;
  private activeAbortSignal: AbortSignal | null = null;
  private activeAbortListener: (() => void) | null = null;

  constructor({
    autoAdvance = true,
    stallFirstSession = false,
    qualityStepMs = 60,
    scenario = 'success',
  }: {
    autoAdvance?: boolean;
    stallFirstSession?: boolean;
    qualityStepMs?: number;
    scenario?: FixtureCaptureScenario;
  } = {}) {
    this.autoAdvance = autoAdvance;
    this.stallFirstSession = stallFirstSession;
    this.qualityStepMs = qualityStepMs;
    this.scenario = scenario;
  }

  async start(options: GuidedCaptureStartOptions): Promise<GuidedCaptureSession> {
    this.cancelActive(false);
    const generation = ++this.generation;
    this.sessionStartCount += 1;
    this.activeOptions = options;
    this.activeMountElement = options.mountElement;
    this.activeQuality = emptyGuidedCaptureQuality();
    this.readySince = null;
    this.activeCaptured = false;
    this.attemptedFrameCount = 0;
    this.acceptedFrameCount = 0;
    this.previewLive = false;
    this.firstQualityFrameSeen = false;
    this.cameraClosedDiagnosticSent = false;
    this.stableForMs = Math.max(20, options.stableForMs ?? 2_400);
    this.activeProfileId = selectCameraKitCaptureProfile({
      frozenCaptureProfileId: options.frozenCaptureProfileId,
    }).id;
    options.mountElement.dataset.cameraKitFixture = 'active';
    options.onStatus?.('loading');
    this.emitDiagnostic('sdk-loaded');

    const cancel = () => {
      if (generation !== this.generation) return;
      this.cancelActive(true);
    };
    this.activeAbortSignal = options.signal ?? null;
    this.activeAbortListener = cancel;
    options.signal?.addEventListener('abort', cancel, { once: true });

    if (this.autoAdvance) {
      this.schedule(() => {
        this.emitDiagnostic('camera-opened');
        options.onStatus?.('camera-opening');
      }, 20);
      if (this.stallFirstSession && this.sessionStartCount === 1) {
        this.schedule(() => this.emitPreviewStalled(), 80);
      } else if (this.scenario === 'permission-denied' || this.scenario === 'camera-unavailable') {
        this.schedule(
          () =>
            this.emitFailure(
              this.scenario === 'permission-denied' ? 'permission-denied' : 'camera-unavailable',
            ),
          40,
        );
      } else {
        this.schedule(() => this.emitPreviewLive(), 40);
        this.schedule(
          () =>
            this.emitQuality({
              hasFace: true,
              position: 'toosmall',
              frontal: 'good',
              lighting: 'notgood',
            }),
          100,
        );
        this.schedule(
          () =>
            this.emitQuality({
              hasFace: true,
              position: 'good',
              frontal: 'good',
              lighting: 'notgood',
            }),
          100 + this.qualityStepMs,
        );
        this.schedule(
          () =>
            this.emitQuality({
              hasFace: true,
              position: 'good',
              frontal: 'good',
              lighting: 'good',
            }),
          100 + this.qualityStepMs * 2,
        );
        this.scheduleScenarioSignals(100 + this.qualityStepMs * 2);
        this.schedule(() => this.emitCapture(), 100 + this.qualityStepMs * 2 + this.stableForMs);
      }
    }

    return {
      captureProfileId: this.activeProfileId,
      cancel,
    };
  }

  emitFailure(failure: GuidedCaptureFailure): void {
    const options = this.activeOptions;
    if (!options) return;
    this.cancelActive(false);
    options.onFailure(failure);
  }

  emitPreviewLive(): void {
    const options = this.activeOptions;
    if (!options || this.previewLive) return;
    this.previewLive = true;
    this.emitDiagnostic('preview-live');
    options.onStatus?.('preview-live');
  }

  emitPreviewStalled(): void {
    const options = this.activeOptions;
    if (!options || this.previewLive) return;
    this.emitDiagnostic('preview-stalled');
    this.cancelActive(false);
    options.onStatus?.('preview-stalled');
    options.onFailure('preview-stalled');
  }

  emitQuality(payload: CameraKitQualityPayload): void {
    const options = this.activeOptions;
    if (!options || !this.previewLive) return;
    if (!this.firstQualityFrameSeen) {
      this.firstQualityFrameSeen = true;
      this.emitDiagnostic('first-quality-frame');
    }
    this.activeQuality = normalizeCameraKitQuality(payload, true);
    if (this.activeQuality.ready) {
      this.readySince ??= performance.now();
    } else {
      this.readySince = null;
    }
    options.onQuality(this.activeQuality);
  }

  emitCapture(): void {
    const options = this.activeOptions;
    if (!options) return;
    this.emitDiagnostic('capture-event');
    if (!this.previewLive || !this.activeQuality.ready || this.activeCaptured) {
      return;
    }
    const elapsed = this.readySince === null ? 0 : performance.now() - this.readySince;
    if (elapsed < this.stableForMs) {
      this.schedule(this.emitCapture.bind(this), Math.ceil(this.stableForMs - elapsed));
      return;
    }

    this.activeCaptured = true;
    const profileId = this.activeProfileId;
    const capturedAt = new Date().toISOString();

    if (options.burstGenerationId) {
      if (this.scenario === 'burst-rejection') {
        this.attemptedFrameCount += 1;
        options.onRejectedAttempt?.({
          frameId: `fixture-${options.burstGenerationId}-${this.attemptedFrameCount}`,
          attemptedAt: capturedAt,
          reasons: ['movement above accepted range'],
        });
      }
      while (
        this.acceptedFrameCount < REDNESS_BURST_REQUIRED_MEASUREMENTS &&
        this.attemptedFrameCount < REDNESS_BURST_MAX_CAPTURE_ATTEMPTS
      ) {
        this.attemptedFrameCount += 1;
        this.acceptedFrameCount += 1;
        this.captureCount += 1;
        options.onCapture(abstractFixtureFrame(), profileId, {
          frameId: `fixture-${options.burstGenerationId}-${this.attemptedFrameCount}`,
          capturedAt: new Date(Date.now() + this.attemptedFrameCount).toISOString(),
        });
      }
      if (this.acceptedFrameCount < REDNESS_BURST_REQUIRED_MEASUREMENTS) {
        this.cancelActive(false);
        options.onFailure('burst-exhausted');
        return;
      }
      options.onStatus?.('captured');
      options.onBurstComplete?.({
        attemptedFrameCount: this.attemptedFrameCount,
        acceptedFrameCount: this.acceptedFrameCount,
      });
      this.cancelActive(false);
      return;
    }

    this.captureCount += 1;
    options.onStatus?.('captured');
    options.onCapture(abstractFixtureFrame(), profileId);
    this.cancelActive(false);
  }

  private emitDiagnostic(stage: CameraKitDiagnosticStage): void {
    const options = this.activeOptions;
    if (!options) return;
    const diagnostic = logSafeCameraKitDiagnostic(stage, this.activeProfileId);
    options.onDiagnostic?.(diagnostic);
  }

  private scheduleScenarioSignals(validAt: number): void {
    const validPayload: CameraKitQualityPayload = {
      hasFace: true,
      position: 'good',
      frontal: 'good',
      lighting: 'good',
    };
    const missingPayload: CameraKitQualityPayload = {
      hasFace: false,
      position: 'notgood',
      frontal: 'notgood',
      lighting: 'notgood',
    };

    if (this.scenario === 'signal-flicker') {
      this.schedule(() => this.emitQuality(missingPayload), validAt + 400);
      this.schedule(() => this.emitQuality(validPayload), validAt + 500);
    }
    if (this.scenario === 'lose-lock') {
      this.schedule(() => this.emitQuality(missingPayload), validAt + 900);
      this.schedule(() => this.emitQuality(validPayload), validAt + 1_300);
    }
    if (this.scenario === 'lose-scan') {
      this.schedule(() => this.emitQuality(missingPayload), validAt + 1_600);
      this.schedule(() => this.emitQuality(validPayload), validAt + 2_100);
    }
  }

  private schedule(callback: () => void, delay: number): void {
    this.timers.push(window.setTimeout(callback, delay));
  }

  private cancelActive(countCancellation: boolean): void {
    if (!this.activeOptions && this.timers.length === 0) return;
    this.timers.splice(0).forEach(window.clearTimeout);
    if (this.activeAbortSignal && this.activeAbortListener) {
      this.activeAbortSignal.removeEventListener('abort', this.activeAbortListener);
    }
    if (this.activeMountElement) {
      delete this.activeMountElement.dataset.cameraKitFixture;
    }
    if (countCancellation) this.cancelCount += 1;
    if (!this.cameraClosedDiagnosticSent && this.activeOptions) {
      this.cameraClosedDiagnosticSent = true;
      this.emitDiagnostic('camera-closed');
    }
    this.activeOptions?.onStatus?.('closed');
    this.activeOptions = null;
    this.activeMountElement = null;
    this.activeAbortSignal = null;
    this.activeAbortListener = null;
    this.readySince = null;
    this.previewLive = false;
    this.generation += 1;
  }
}
