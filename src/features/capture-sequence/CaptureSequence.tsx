import type { CSSProperties, RefObject } from 'react';
import type { GuidedCaptureStatus } from '../../adapters/camera/youcam-camera-kit';
import { CaptureCameraFeed } from './CaptureCameraFeed';
import { CaptureInstruction } from './CaptureInstruction';
import { CaptureQualityRail } from './CaptureQualityRail';
import { CaptureScanBand } from './CaptureScanBand';
import { CaptureShutter } from './CaptureShutter';
import { CapturedSpecimenTransition } from './CapturedSpecimenTransition';
import { CAPTURE_TIMING } from './constants';
import { FaceAcquisitionGuide } from './FaceAcquisitionGuide';
import { getCaptureInstruction } from './guidance';
import { RegionRegistrationOverlay } from './RegionRegistrationOverlay';
import type { CaptureSequenceState } from './types';
import styles from './CaptureSequence.module.css';

export function CaptureSequence({
  state,
  accession,
  product,
  job,
  mountRef,
  videoRef,
  fixture,
  previewLive,
  previewStatus = 'preview-live',
  activeCapture = true,
  reducedMotion,
  captureKind = 'baseline',
  acceptedMeasurementCount = 0,
  analyzedMeasurementCount = 0,
  rejectedMeasurementCount = 0,
  providerProcessingStarted = false,
  burstStatus = 'idle',
}: {
  state: CaptureSequenceState;
  accession: string;
  product: string;
  job: string | null;
  mountRef: RefObject<HTMLDivElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
  fixture: boolean;
  previewLive: boolean;
  previewStatus?: GuidedCaptureStatus | 'idle';
  activeCapture?: boolean;
  reducedMotion: boolean;
  captureKind?: 'baseline' | 'followup';
  acceptedMeasurementCount?: number;
  analyzedMeasurementCount?: number;
  rejectedMeasurementCount?: number;
  providerProcessingStarted?: boolean;
  burstStatus?: 'idle' | 'capturing' | 'analyzing' | 'ready' | 'failed';
}) {
  const timingStyle = {
    '--fv-capture-breathing-duration': `${CAPTURE_TIMING.breathingMs}ms`,
    '--fv-capture-guide-connection-duration': `${CAPTURE_TIMING.guideConnectionMs}ms`,
    '--fv-capture-scan-duration': `${CAPTURE_TIMING.scanMs}ms`,
    '--fv-capture-reduced-scan-duration': `${CAPTURE_TIMING.reducedMotionScanMs}ms`,
    '--fv-capture-freeze-duration': `${CAPTURE_TIMING.captureFreezeMs}ms`,
    '--fv-capture-shutter-duration': `${CAPTURE_TIMING.shutterMs}ms`,
    '--fv-capture-guide-hold-duration': `${CAPTURE_TIMING.capturedGuideHoldMs}ms`,
    '--fv-capture-guide-resolve-duration': `${CAPTURE_TIMING.capturedGuideResolveMs}ms`,
  } as CSSProperties;
  const phaseInstruction = getCaptureInstruction(state);
  const defaultInstruction =
    previewStatus === 'loading' ||
    previewStatus === 'requesting-permission' ||
    previewStatus === 'camera-opening'
      ? { primary: 'Opening camera', secondary: 'Keep your phone steady' }
      : previewStatus === 'waiting-first-frame'
        ? { primary: 'Preparing preview', secondary: 'This may take a moment' }
        : state.phase === 'scanning' && captureKind === 'followup'
          ? { ...phaseInstruction, secondary: 'Securing follow-up' }
          : phaseInstruction;
  const instruction =
    burstStatus === 'failed' && state.phase === 'captured'
      ? {
          primary: 'Measurements not saved',
          secondary: 'Analysis stopped safely',
        }
      : burstStatus === 'capturing' && state.phase === 'scanning' && rejectedMeasurementCount > 0
        ? {
            primary: 'Reading capture conditions',
            secondary: 'Replacing one measurement automatically',
          }
        : burstStatus === 'analyzing' && state.phase === 'captured' && !providerProcessingStarted
          ? {
              primary: '3 measurements accepted',
              secondary: 'Preparing analysis',
            }
          : (burstStatus === 'analyzing' || burstStatus === 'ready') && state.phase === 'captured'
            ? {
                primary: 'Processing measurements',
                secondary: `${analyzedMeasurementCount} of 3 analyzed`,
              }
            : defaultInstruction;
  return (
    <div
      className={styles.chassis}
      data-capture-sequence
      data-capture-phase={state.phase}
      data-capture-layout={state.phase === 'error' ? 'error' : activeCapture ? 'active' : 'idle'}
      data-reduced-motion={reducedMotion}
      style={timingStyle}
      aria-labelledby="camera-heading"
    >
      <CaptureCameraFeed
        mountRef={mountRef}
        videoRef={videoRef}
        capturedImage={state.capturedImage}
        fixture={fixture}
        previewLive={previewLive}
      />
      <div
        className={styles.contextBar}
        data-capture-context-bar
        aria-label={`${accession}, ${product}, ${job ?? 'job unassigned'}`}
      >
        <span>{accession}</span>
        <span>{product}</span>
        <strong>{job ?? 'JOB UNASSIGNED'}</strong>
      </div>
      <CaptureInstruction copy={instruction} phase={state.phase} />
      {state.phase !== 'error' && (
        <FaceAcquisitionGuide phase={state.phase} activeIssue={state.activeIssue} />
      )}
      {state.phase === 'scanning' && <CaptureScanBand />}
      {state.phase === 'scanning' && (
        <RegionRegistrationOverlay regions={state.registeredRegions} />
      )}
      {state.phase === 'captured' && (
        <>
          <CaptureShutter />
          <CapturedSpecimenTransition />
        </>
      )}
      {activeCapture && state.phase !== 'error' && (
        <div
          className={styles.measurementIndicator}
          data-measurement-indicator
          data-measurements-accepted={acceptedMeasurementCount}
          role="status"
          aria-label={`${acceptedMeasurementCount} of 3 measurements accepted`}
        >
          {[0, 1, 2].map((position) => (
            <span
              key={position}
              data-measurement-position={position + 1}
              data-measurement-state={position < acceptedMeasurementCount ? 'accepted' : 'pending'}
              aria-hidden="true"
            />
          ))}
        </div>
      )}
      {state.phase !== 'error' && <CaptureQualityRail state={state} />}
    </div>
  );
}
