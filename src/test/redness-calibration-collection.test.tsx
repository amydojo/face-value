import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { YouCamProviderError } from '../adapters/analysis/youcam/YouCamSkinAnalysisProvider';
import type {
  AnalyzeCaptureInput,
  SkinAnalysisProvider,
} from '../adapters/analysis/youcam/contracts';
import type {
  CameraKitAdapter,
  GuidedCaptureSession,
  GuidedCaptureStartOptions,
} from '../adapters/camera/youcam-camera-kit';
import {
  REDNESS_CALIBRATION_STORAGE_KEY,
  loadRednessCalibrationData,
} from '../adapters/persistence/rednessCalibrationStore';
import type { RednessCalibrationPreCaptureContext } from '../domain/calibration/redness';
import { RednessCalibration } from '../features/calibration-redness/RednessCalibration';
import {
  beginRednessCalibrationCollection,
  describeRednessCalibrationCollectionError,
  type RednessCalibrationCollectionDependencies,
} from '../features/calibration-redness/rednessCalibrationCollection';

const context: RednessCalibrationPreCaptureContext = {
  makeup: 'absent',
  concealer: 'absent',
  tintedMoisturizer: 'absent',
  tintedSpf: 'absent',
  filter: 'absent',
  selfTanner: 'absent',
  otherEnhancement: 'absent',
  recentHeat: 'absent',
  recentExercise: 'absent',
  recentShower: 'absent',
  recentCleansing: 'absent',
  recentRubbing: 'absent',
  recentSunExposure: 'absent',
  recentProcedureOrIllness: 'absent',
  medicationOrRoutineChange: 'absent',
  emotionalFlushing: 'absent',
  timeOfDay: 'morning',
  productRoutineState: 'no_intervention',
};

function cameraDouble(rejectFirst = false): CameraKitAdapter {
  return {
    start: vi.fn(async (options: GuidedCaptureStartOptions): Promise<GuidedCaptureSession> => {
      options.onStatus?.('preview-live');
      options.onQuality({
        quality: {
          facePresent: true,
          distanceValid: true,
          alignmentValid: true,
          angleValid: true,
          lightingValid: true,
          stillnessValid: true,
        },
        ready: true,
      });
      return {
        captureProfileId: 'native-browser-camera-v1',
        capture: () => {
          if (rejectFirst) {
            options.onRejectedAttempt?.({
              frameId: 'live-rejected-1',
              attemptedAt: '2026-08-02T12:00:00.000Z',
              reasons: ['movement above accepted range'],
            });
          }
          for (let index = 0; index < 3; index += 1) {
            options.onCapture(
              new Blob([`ephemeral-${index}`], { type: 'image/png' }),
              'native-browser-camera-v1',
              {
                frameId: `live-frame-${index + 1}`,
                capturedAt: `2026-08-02T12:00:0${index + 1}.000Z`,
              },
            );
          }
          options.onBurstComplete?.({
            attemptedFrameCount: rejectFirst ? 4 : 3,
            acceptedFrameCount: 3,
          });
        },
        cancel: vi.fn(),
      };
    }),
  };
}

function providerDouble(scores = [60, 61, 62]): SkinAnalysisProvider {
  let index = 0;
  return {
    analyzeCapture: vi.fn(
      async (input: AnalyzeCaptureInput) =>
        ({
          provider: 'youcam',
          apiVersion: '2.1',
          mode: 'hd',
          concern: 'hd_redness',
          region: null,
          rawScore: scores[index++ % scores.length],
          capturedAt: input.capturedAt,
          captureQuality: 'accepted',
          ephemeralTaskReference: `provider-task-${index}`,
        }) as const,
    ),
  };
}

function dependencies(
  provider: SkinAnalysisProvider = providerDouble(),
  cameraAdapter: CameraKitAdapter = cameraDouble(),
): RednessCalibrationCollectionDependencies {
  let id = 0;
  let time = 0;
  return {
    cameraAdapter,
    provider,
    createId: (prefix) => `${prefix}-${++id}`,
    now: () => `2026-08-02T12:01:0${time++}.000Z`,
  };
}

describe('completed live redness calibration collection', () => {
  it('uses injected camera/provider boundaries and returns only a completed face-free burst', async () => {
    const injected = dependencies(providerDouble(), cameraDouble(true));
    const progress: string[] = [];
    const handle = await beginRednessCalibrationCollection({
      fields: {
        participantId: 'P-100',
        sessionId: 'P-100-technical-01',
        conditionId: 'P-100-standard-match',
        conditionType: 'standard',
        deviceClass: 'test-mobile-webkit',
        preCaptureContext: context,
        measuredSkinToneGroup: 'validated-audit-a',
      },
      dependencies: injected,
      mountElement: document.createElement('div'),
      previewElement: document.createElement('video'),
      onProgress: ({ phase }) => progress.push(phase),
    });

    handle.capture();
    const observation = await handle.completed;

    expect(injected.provider.analyzeCapture).toHaveBeenCalledTimes(3);
    expect(observation).toMatchObject({
      collectionSource: 'live_provider',
      participantId: 'P-100',
      sessionId: 'P-100-technical-01',
      sessionRawMedian: 61,
      measuredSkinToneGroup: 'validated-audit-a',
      measuredSkinToneSource: 'validated_audit_input',
      includesFaceImage: false,
      burst: {
        attemptedFrameCount: 4,
        acceptedFrames: [
          { providerAttemptCount: 1 },
          { providerAttemptCount: 1 },
          { providerAttemptCount: 1 },
        ],
        rejectedFrames: [
          expect.objectContaining({
            stage: 'capture',
            reasons: ['movement above accepted range'],
          }),
        ],
      },
    });
    expect(progress).toEqual(
      expect.arrayContaining(['quality_ready', 'capturing', 'analyzing', 'completed']),
    );
    expect(JSON.stringify(observation)).not.toMatch(
      /provider-task|ephemeral-|data:image|blob:|https?:\/\/|rawProviderPayload/i,
    );
    expect(JSON.stringify(observation)).not.toContain('ephemeralTaskReference');
  });

  it('renders and persists the completed internal live path without using synthetic fixtures', async () => {
    const user = userEvent.setup();
    const injected = dependencies();
    render(
      <RednessCalibration
        collectionDependencies={injected}
        now={() => '2026-08-02T12:02:00.000Z'}
      />,
    );

    await user.clear(screen.getByLabelText('Validated skin-tone audit group (optional)'));
    await user.type(
      screen.getByLabelText('Validated skin-tone audit group (optional)'),
      'validated-audit-a',
    );
    await user.click(screen.getByRole('button', { name: 'START LIVE THREE-FRAME COLLECTION' }));
    await user.click(await screen.findByRole('button', { name: 'CAPTURE THREE CURRENT FRAMES' }));

    await screen.findByText('Completed internal live provider capture');
    expect(screen.getByRole('status')).toHaveTextContent('Saved one completed live-provider');
    expect(loadRednessCalibrationData()).toMatchObject({
      status: 'ready',
      envelope: {
        observations: [
          expect.objectContaining({
            collectionSource: 'live_provider',
            measuredSkinToneGroup: 'validated-audit-a',
          }),
        ],
      },
    });
    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).not.toMatch(
      /provider-task|ephemeral-|data:image|blob:/i,
    );
    expect(
      screen.getByRole('heading', { name: 'Validated measured skin-tone audit group' }),
    ).toBeVisible();
    expect(screen.getAllByText('validated-audit-a').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'START LIVE THREE-FRAME COLLECTION' }));
    await user.click(await screen.findByRole('button', { name: 'CAPTURE THREE CURRENT FRAMES' }));
    await vi.waitFor(() => expect(injected.provider.analyzeCapture).toHaveBeenCalledTimes(6));
    expect(loadRednessCalibrationData()).toMatchObject({
      status: 'ready',
      envelope: {
        observations: [{ sessionId: 'P-001-technical-01' }, { sessionId: 'P-001-technical-01' }],
      },
    });
  });

  it('shows the real CreditInsufficiency result and writes no partial observation', async () => {
    const user = userEvent.setup();
    const provider: SkinAnalysisProvider = {
      analyzeCapture: vi.fn(async () => {
        throw new YouCamProviderError({
          message: 'CreditInsufficiency',
          code: 'youcam_request_failed',
          retryable: false,
          status: 400,
        });
      }),
    };
    render(<RednessCalibration collectionDependencies={dependencies(provider)} />);

    await user.click(screen.getByRole('button', { name: 'START LIVE THREE-FRAME COLLECTION' }));
    await user.click(await screen.findByRole('button', { name: 'CAPTURE THREE CURRENT FRAMES' }));

    expect(await screen.findByRole('status')).toHaveTextContent('HTTP 400 CreditInsufficiency');
    expect(provider.analyzeCapture).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(REDNESS_CALIBRATION_STORAGE_KEY)).toBeNull();
    expect(
      describeRednessCalibrationCollectionError(
        new YouCamProviderError({
          message: 'CreditInsufficiency',
          code: 'youcam_request_failed',
          retryable: false,
          status: 400,
        }),
      ),
    ).toContain('No observation was saved');
  });
});
