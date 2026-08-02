import { useEffect, useRef, useState } from 'react';
import type {
  CalibrationReportedState,
  RednessCalibrationConditionType,
  RednessCalibrationObservation,
  RednessCalibrationPreCaptureContext,
} from '../../domain/calibration/redness';
import {
  beginRednessCalibrationCollection,
  createRednessCalibrationCollectionDependencies,
  describeRednessCalibrationCollectionError,
  type RednessCalibrationCollectionDependencies,
  type RednessCalibrationCollectionFields,
  type RednessCalibrationCollectionHandle,
  type RednessCalibrationCollectionProgress,
} from './rednessCalibrationCollection';
import styles from './RednessCalibration.module.css';

const contextFields: Array<{
  key: keyof Pick<
    RednessCalibrationPreCaptureContext,
    | 'makeup'
    | 'concealer'
    | 'tintedMoisturizer'
    | 'tintedSpf'
    | 'filter'
    | 'selfTanner'
    | 'otherEnhancement'
    | 'recentHeat'
    | 'recentExercise'
    | 'recentShower'
    | 'recentCleansing'
    | 'recentRubbing'
    | 'recentSunExposure'
    | 'recentProcedureOrIllness'
    | 'medicationOrRoutineChange'
    | 'emotionalFlushing'
  >;
  label: string;
}> = [
  { key: 'makeup', label: 'Makeup' },
  { key: 'concealer', label: 'Concealer' },
  { key: 'tintedMoisturizer', label: 'Tinted moisturizer' },
  { key: 'tintedSpf', label: 'Tinted SPF' },
  { key: 'filter', label: 'Camera filter' },
  { key: 'selfTanner', label: 'Self-tanner' },
  { key: 'otherEnhancement', label: 'Other enhancement' },
  { key: 'recentHeat', label: 'Recent heat' },
  { key: 'recentExercise', label: 'Recent exercise' },
  { key: 'recentShower', label: 'Recent shower' },
  { key: 'recentCleansing', label: 'Recent cleansing' },
  { key: 'recentRubbing', label: 'Recent rubbing' },
  { key: 'recentSunExposure', label: 'Recent sun exposure' },
  { key: 'recentProcedureOrIllness', label: 'Recent procedure or illness' },
  { key: 'medicationOrRoutineChange', label: 'Medication or routine change' },
  { key: 'emotionalFlushing', label: 'Emotional flushing' },
];

const emptyContext: RednessCalibrationPreCaptureContext = {
  makeup: 'not_reported',
  concealer: 'not_reported',
  tintedMoisturizer: 'not_reported',
  tintedSpf: 'not_reported',
  filter: 'not_reported',
  selfTanner: 'not_reported',
  otherEnhancement: 'not_reported',
  recentHeat: 'not_reported',
  recentExercise: 'not_reported',
  recentShower: 'not_reported',
  recentCleansing: 'not_reported',
  recentRubbing: 'not_reported',
  recentSunExposure: 'not_reported',
  recentProcedureOrIllness: 'not_reported',
  medicationOrRoutineChange: 'not_reported',
  emotionalFlushing: 'not_reported',
  timeOfDay: 'not_reported',
  productRoutineState: 'not_reported',
};

const initialProgress: RednessCalibrationCollectionProgress = {
  phase: 'idle',
  capturedFrameCount: 0,
  rejectedFrameCount: 0,
  analyzedFrameCount: 0,
  message: 'Ready to begin. No live provider request has been made.',
};

export function RednessCalibrationCollector({
  dependencies,
  onCompleted,
  onStatus,
  disabled = false,
}: {
  dependencies?: RednessCalibrationCollectionDependencies;
  onCompleted(observation: RednessCalibrationObservation): void;
  onStatus(message: string): void;
  disabled?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handleRef = useRef<RednessCalibrationCollectionHandle | null>(null);
  const attemptControllerRef = useRef<AbortController | null>(null);
  const pendingCaptureRef = useRef(false);
  const [participantId, setParticipantId] = useState('P-001');
  const [sessionId, setSessionId] = useState('P-001-technical-01');
  const [conditionId, setConditionId] = useState('P-001-standard-match');
  const [conditionType, setConditionType] = useState<RednessCalibrationConditionType>('standard');
  const [deviceClass, setDeviceClass] = useState('mobile-webkit');
  const [measuredSkinToneGroup, setMeasuredSkinToneGroup] = useState('');
  const [context, setContext] = useState<RednessCalibrationPreCaptureContext>(emptyContext);
  const [progress, setProgress] = useState(initialProgress);
  const [active, setActive] = useState(false);

  useEffect(
    () => () => {
      attemptControllerRef.current?.abort();
      handleRef.current?.cancel();
    },
    [],
  );

  const updateReportedState = (
    key: (typeof contextFields)[number]['key'],
    value: CalibrationReportedState,
  ) => setContext((current) => ({ ...current, [key]: value }));

  const begin = async () => {
    const mountElement = mountRef.current;
    if (!mountElement || active || disabled) return;
    const fields: RednessCalibrationCollectionFields = {
      participantId: participantId.trim(),
      sessionId: sessionId.trim(),
      conditionId: conditionId.trim(),
      conditionType,
      deviceClass: deviceClass.trim(),
      preCaptureContext: structuredClone(context),
      measuredSkinToneGroup: measuredSkinToneGroup.trim() || null,
    };
    const attemptController = new AbortController();
    attemptControllerRef.current = attemptController;
    pendingCaptureRef.current = false;
    setActive(true);
    try {
      const handle = await beginRednessCalibrationCollection({
        fields,
        dependencies: dependencies ?? createRednessCalibrationCollectionDependencies(),
        mountElement,
        previewElement: videoRef.current,
        onProgress: setProgress,
        signal: attemptController.signal,
      });
      handleRef.current = handle;
      if (pendingCaptureRef.current) {
        pendingCaptureRef.current = false;
        handle.capture();
      }
      const observation = await handle.completed;
      onCompleted(observation);
      onStatus('Saved one completed live-provider, face-free calibration observation.');
    } catch (error) {
      const message = describeRednessCalibrationCollectionError(error);
      onStatus(message);
      setProgress((current) => ({ ...current, phase: 'failed', message }));
    } finally {
      handleRef.current = null;
      attemptControllerRef.current = null;
      pendingCaptureRef.current = false;
      setActive(false);
    }
  };

  const cancel = () => {
    attemptControllerRef.current?.abort();
    handleRef.current?.cancel();
  };
  const capture = () => {
    if (handleRef.current) handleRef.current.capture();
    else pendingCaptureRef.current = true;
  };

  return (
    <section className={styles.liveCollector} aria-labelledby="live-collection-heading">
      <div className={styles.sectionHeading}>
        <p>LIVE PROVIDER PATH · COMPLETED BURSTS ONLY</p>
        <h2 id="live-collection-heading">Collect a calibration observation</h2>
      </div>
      <p className={styles.collectionBoundary}>
        This protected engineering session uses the canonical three-frame camera and provider path.
        Images remain ephemeral; only a completed face-free observation can be saved. For a standard
        formal recapture, reposition and reacquire before repeating with the same session and
        matched-condition IDs.
      </p>

      <fieldset disabled={active || disabled} className={styles.collectionFields}>
        <legend>Session and condition</legend>
        <div className={styles.formGrid}>
          <label>
            Pseudonymous participant ID
            <input
              value={participantId}
              maxLength={64}
              required
              onChange={(event) => setParticipantId(event.currentTarget.value)}
            />
          </label>
          <label>
            Calibration session ID
            <input
              value={sessionId}
              maxLength={64}
              required
              onChange={(event) => setSessionId(event.currentTarget.value)}
            />
          </label>
          <label>
            Matched condition ID
            <input
              value={conditionId}
              maxLength={64}
              required
              onChange={(event) => setConditionId(event.currentTarget.value)}
            />
          </label>
          <label>
            Condition type
            <select
              value={conditionType}
              onChange={(event) =>
                setConditionType(event.currentTarget.value as RednessCalibrationConditionType)
              }
            >
              <option value="standard">Standard formal recapture</option>
              <option value="no_treatment_longitudinal">No-treatment longitudinal</option>
              <option value="degraded">Degraded condition</option>
            </select>
          </label>
          <label>
            Device class
            <input
              value={deviceClass}
              maxLength={128}
              required
              onChange={(event) => setDeviceClass(event.currentTarget.value)}
            />
          </label>
          <label>
            Time of day
            <input
              value={context.timeOfDay}
              maxLength={128}
              required
              onChange={(event) =>
                setContext((current) => ({ ...current, timeOfDay: event.currentTarget.value }))
              }
            />
          </label>
          <label>
            Product or routine state
            <select
              value={context.productRoutineState}
              onChange={(event) =>
                setContext((current) => ({
                  ...current,
                  productRoutineState: event.currentTarget
                    .value as RednessCalibrationPreCaptureContext['productRoutineState'],
                }))
              }
            >
              <option value="not_reported">Not reported</option>
              <option value="no_intervention">No intervention</option>
              <option value="explicit_change">Explicit change</option>
            </select>
          </label>
          <label>
            Validated skin-tone audit group (optional)
            <input
              value={measuredSkinToneGroup}
              maxLength={128}
              onChange={(event) => setMeasuredSkinToneGroup(event.currentTarget.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset disabled={active || disabled} className={styles.collectionFields}>
        <legend>Pre-capture context</legend>
        <div className={styles.contextGrid}>
          {contextFields.map(({ key, label }) => (
            <label key={key}>
              {label}
              <select
                value={context[key]}
                onChange={(event) =>
                  updateReportedState(key, event.currentTarget.value as CalibrationReportedState)
                }
              >
                <option value="not_reported">Not reported</option>
                <option value="absent">Absent</option>
                <option value="present">Present</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.liveCamera} data-calibration-collection-phase={progress.phase}>
        <div ref={mountRef} className={styles.cameraMount}>
          <video
            ref={videoRef}
            data-native-camera-preview
            aria-label="Live calibration camera preview"
            muted
            playsInline
          />
        </div>
        <dl className={styles.liveCounts}>
          <div>
            <dt>Captured</dt>
            <dd>{progress.capturedFrameCount} / 3</dd>
          </div>
          <div>
            <dt>Rejected</dt>
            <dd>{progress.rejectedFrameCount}</dd>
          </div>
          <div>
            <dt>Analyzed</dt>
            <dd>{progress.analyzedFrameCount} / 3</dd>
          </div>
        </dl>
        <p aria-live="polite">{progress.message}</p>
        <div className={styles.collectionActions}>
          {!active && (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={disabled}
              onClick={() => void begin()}
            >
              START LIVE THREE-FRAME COLLECTION
            </button>
          )}
          {active && progress.phase === 'quality_ready' && (
            <button type="button" className={styles.primaryAction} onClick={capture}>
              CAPTURE THREE CURRENT FRAMES
            </button>
          )}
          {active && (
            <button type="button" onClick={cancel}>
              CANCEL LIVE COLLECTION
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
