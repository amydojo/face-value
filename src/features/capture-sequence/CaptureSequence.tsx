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

type BurstStatus = 'idle' | 'capturing' | 'analyzing' | 'ready' | 'failed';
type MeasurementIndicatorState = 'completed' | 'active' | 'waiting';

function measurementStatusLabel({
  burstStatus,
  capturedCount,
  confirmedCount,
  activeMeasurement,
  analysisPresentation,
}: {
  burstStatus: BurstStatus;
  capturedCount: number;
  confirmedCount: number;
  activeMeasurement: number | null;
  analysisPresentation: boolean;
}): string {
  if (burstStatus === 'ready') return 'Three measurements confirmed';
  if (burstStatus === 'failed') {
    if (confirmedCount === 1) return 'One measurement confirmed. Analysis stopped.';
    if (confirmedCount > 1) return `${confirmedCount} measurements confirmed. Analysis stopped.`;
    return 'Analysis stopped before a measurement was confirmed.';
  }
  if (activeMeasurement !== null) {
    const confirmed =
      confirmedCount === 0
        ? ''
        : ` ${confirmedCount} ${confirmedCount === 1 ? 'measurement' : 'measurements'} confirmed.`;
    return `Measurement ${activeMeasurement} of 3 in progress.${confirmed}`;
  }
  if (analysisPresentation) return 'Three measurements captured. Analysis will begin shortly.';
  if (capturedCount === 0) return 'Waiting for the first measurement';
  if (capturedCount === 1) return 'One measurement captured';
  return `${capturedCount} measurements captured`;
}

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
  activeAnalysisMeasurement = null,
  analysisRetrying = false,
  analysisSlow = false,
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
  activeAnalysisMeasurement?: number | null;
  analysisRetrying?: boolean;
  analysisSlow?: boolean;
  burstStatus?: BurstStatus;
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
        : burstStatus === 'ready' && state.phase === 'captured'
          ? {
              primary: 'Measurements confirmed',
              secondary: 'Preparing your comparison.',
            }
          : burstStatus === 'analyzing' &&
              state.phase === 'captured' &&
              activeAnalysisMeasurement === null
            ? {
                primary: 'Scan complete',
                secondary: 'You can relax.',
              }
            : burstStatus === 'analyzing' && state.phase === 'captured'
              ? {
                  primary: 'Analyzing your scan',
                  secondary: analysisRetrying
                    ? 'Rechecking this measurement.'
                    : analysisSlow
                      ? 'This is taking a little longer than usual.'
                      : 'Checking three measurements for consistency.',
                }
              : defaultInstruction;
  const analysisPresentation =
    state.phase === 'captured' &&
    (burstStatus === 'analyzing' || burstStatus === 'ready' || burstStatus === 'failed');
  const confirmedMeasurementCount =
    burstStatus === 'ready' ? 3 : Math.min(3, analyzedMeasurementCount);
  const indicatorStateFor = (position: number): MeasurementIndicatorState => {
    if (!analysisPresentation) {
      return position < acceptedMeasurementCount ? 'completed' : 'waiting';
    }
    if (position < confirmedMeasurementCount) return 'completed';
    if (burstStatus === 'analyzing' && activeAnalysisMeasurement === position + 1) return 'active';
    return 'waiting';
  };
  const indicatorLabel = measurementStatusLabel({
    burstStatus,
    capturedCount: acceptedMeasurementCount,
    confirmedCount: confirmedMeasurementCount,
    activeMeasurement: activeAnalysisMeasurement,
    analysisPresentation,
  });
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
          data-measurements-confirmed={confirmedMeasurementCount}
          data-active-measurement={activeAnalysisMeasurement ?? 'none'}
          data-progress-mode={analysisPresentation ? 'analysis' : 'capture'}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={indicatorLabel}
        >
          {activeAnalysisMeasurement !== null && (
            <span className={styles.analysisMeasurementLabel} data-analysis-measurement-label>
              MEASUREMENT {activeAnalysisMeasurement} OF 3
            </span>
          )}
          <span className={styles.measurementDots} aria-hidden="true">
            {[0, 1, 2].map((position) => (
              <i
                key={position}
                data-measurement-position={position + 1}
                data-measurement-state={indicatorStateFor(position)}
              />
            ))}
          </span>
        </div>
      )}
      {state.phase !== 'error' && <CaptureQualityRail state={state} />}
    </div>
  );
}
