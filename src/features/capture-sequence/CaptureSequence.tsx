import type { CSSProperties, RefObject } from 'react';
import type { GuidedCaptureStatus } from '../../adapters/camera/youcam-camera-kit';
import { AnalysisActivityField } from './AnalysisActivityField';
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
import type { AnalysisWaitPresentationPhase } from './useAnalysisWaitPresentation';
import styles from './CaptureSequence.module.css';

type BurstStatus = 'idle' | 'capturing' | 'analyzing' | 'ready' | 'committed' | 'failed';
type MeasurementIndicatorState = 'completed' | 'active' | 'waiting';

function measurementStatusLabel({
  phase,
  completedCount,
  measurement,
}: {
  phase: AnalysisWaitPresentationPhase;
  completedCount: number;
  measurement: number | null;
}): string {
  if (phase === 'confirmed') return 'Three measurements confirmed';
  if (phase === 'analysis' && measurement !== null) {
    const confirmed =
      completedCount === 0
        ? ''
        : ` ${completedCount} ${completedCount === 1 ? 'measurement' : 'measurements'} confirmed.`;
    return `Measurement ${measurement} of 3 in progress.${confirmed}`;
  }
  return 'Three measurements captured.';
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
  analysisRetrying = false,
  analysisSlow = false,
  analysisPresentationPhase = null,
  presentedAnalysisMeasurement = null,
  presentedAnalysisCompletedCount = 0,
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
  analysisRetrying?: boolean;
  analysisSlow?: boolean;
  analysisPresentationPhase?: AnalysisWaitPresentationPhase;
  presentedAnalysisMeasurement?: number | null;
  presentedAnalysisCompletedCount?: number;
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
    '--fv-analysis-crossfade-duration': `${CAPTURE_TIMING.analysisCrossfadeMs}ms`,
    '--fv-analysis-indicator-cycle': `${CAPTURE_TIMING.analysisIndicatorCycleMs}ms`,
    '--fv-analysis-field-cycle': `${CAPTURE_TIMING.analysisFieldCycleMs}ms`,
  } as CSSProperties;
  const phaseInstruction = getCaptureInstruction(state);
  const readyInstruction = {
    primary: captureKind === 'baseline' ? 'Baseline scan' : 'Follow-up scan',
    secondary: 'Camera access comes next.',
  };
  const permissionInstruction = {
    primary: 'Allow camera access',
    secondary: 'Use the browser prompt to open the live preview.',
  };
  const defaultInstruction =
    state.phase === 'error'
      ? phaseInstruction
      : !activeCapture && !previewLive
        ? readyInstruction
        : !previewLive && previewStatus === 'requesting-permission'
          ? permissionInstruction
          : !previewLive && (previewStatus === 'loading' || previewStatus === 'camera-opening')
            ? { primary: 'Opening camera', secondary: 'Keep your phone steady' }
            : !previewLive && previewStatus === 'waiting-first-frame'
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
        : analysisPresentationPhase === 'confirmed' && state.phase === 'captured'
          ? {
              primary: 'Measurements confirmed',
              secondary: 'Preparing your comparison.',
            }
          : analysisPresentationPhase === 'scan-complete' && state.phase === 'captured'
            ? {
                primary: 'Scan complete',
                secondary: 'You can relax.',
              }
            : analysisPresentationPhase === 'analysis' && state.phase === 'captured'
              ? {
                  primary: 'Analyzing your scan',
                  secondary: 'Checking three measurements for consistency.',
                }
              : defaultInstruction;
  const analysisPresentation =
    state.phase === 'captured' &&
    (analysisPresentationPhase === 'analysis' || analysisPresentationPhase === 'confirmed');
  const confirmedMeasurementCount =
    analysisPresentationPhase === 'confirmed'
      ? 3
      : Math.min(2, Math.max(0, presentedAnalysisCompletedCount));
  const indicatorStateFor = (position: number): MeasurementIndicatorState => {
    if (position < confirmedMeasurementCount) return 'completed';
    if (analysisPresentationPhase === 'analysis' && presentedAnalysisMeasurement === position + 1) {
      return 'active';
    }
    return 'waiting';
  };
  const indicatorLabel = measurementStatusLabel({
    phase: analysisPresentationPhase,
    completedCount: confirmedMeasurementCount,
    measurement: presentedAnalysisMeasurement,
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
      {analysisPresentationPhase === 'analysis' && burstStatus === 'analyzing' && (
        <AnalysisActivityField />
      )}
      <div
        className={styles.contextBar}
        data-capture-context-bar
        aria-label={`${accession}, ${product}, ${job ?? 'job unassigned'}`}
      >
        <span>{accession}</span>
        <span>{product}</span>
        <strong>{job ?? 'JOB UNASSIGNED'}</strong>
      </div>
      <CaptureInstruction
        key={`capture-instruction-${analysisPresentationPhase ?? state.phase}-${activeCapture ? 'active' : 'ready'}-${previewLive ? 'live' : 'not-live'}-${previewStatus}`}
        copy={instruction}
        phase={state.phase}
      >
        {analysisPresentation && (
          <div
            className={styles.measurementIndicator}
            data-measurement-indicator
            data-progress-location="primary-status-stack"
            data-measurements-accepted={acceptedMeasurementCount}
            data-measurements-real-confirmed={Math.min(3, analyzedMeasurementCount)}
            data-measurements-confirmed={confirmedMeasurementCount}
            data-active-measurement={presentedAnalysisMeasurement ?? 'none'}
            data-progress-mode={analysisPresentationPhase}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={indicatorLabel}
          >
            <span className={styles.measurementDots} aria-hidden="true">
              {[0, 1, 2].map((position) => (
                <i
                  key={position}
                  data-measurement-position={position + 1}
                  data-measurement-state={indicatorStateFor(position)}
                />
              ))}
            </span>
            {analysisPresentationPhase === 'analysis' && presentedAnalysisMeasurement !== null && (
              <span className={styles.analysisMeasurementLabel} data-analysis-measurement-label>
                MEASUREMENT {presentedAnalysisMeasurement} OF 3
              </span>
            )}
            {analysisPresentationPhase === 'analysis' && (analysisRetrying || analysisSlow) && (
              <span className={styles.analysisTertiaryStatus} data-analysis-tertiary-status>
                {analysisRetrying ? 'Rechecking this measurement…' : 'Finishing this measurement…'}
              </span>
            )}
          </div>
        )}
      </CaptureInstruction>
      {!activeCapture && !previewLive && (
        <div data-camera-ready-compat>
          <h2>Position your face</h2>
          <p>Looking for a stable frame</p>
        </div>
      )}
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
      {state.phase !== 'error' && <CaptureQualityRail state={state} />}
    </div>
  );
}
