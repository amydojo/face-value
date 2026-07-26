import { useEffect, useMemo, useRef, useState } from 'react';
import type { Specimen } from '../../domain/model';
import { EvidenceRecordArtifact } from './EvidenceRecordArtifact';
import type { EvidenceRecord, EvidenceTrialState } from './evidenceTrial';
import { resolveMachineConfiguration } from './machineConfiguration';
import styles from './EvidenceMachine.module.css';

export type EvidenceRecordReleaseState =
  | 'ready'
  | 'actuator-pressed'
  | 'latch-releasing'
  | 'record-dispensing'
  | 'record-presented'
  | 'record-collecting'
  | 'record-collected'
  | 'detail-open'
  | 'release-error';

export const nextReleaseState = (
  state: EvidenceRecordReleaseState,
  event: 'PRESS' | 'LATCH' | 'DISPENSE' | 'PRESENT' | 'COLLECT' | 'COLLECTED' | 'DETAIL' | 'FAIL' | 'RETRY',
): EvidenceRecordReleaseState => {
  const transitions: Record<EvidenceRecordReleaseState, Partial<Record<typeof event, EvidenceRecordReleaseState>>> = {
    ready: { PRESS: 'actuator-pressed', FAIL: 'release-error' },
    'actuator-pressed': { LATCH: 'latch-releasing', FAIL: 'release-error' },
    'latch-releasing': { DISPENSE: 'record-dispensing', FAIL: 'release-error' },
    'record-dispensing': { PRESENT: 'record-presented', FAIL: 'release-error' },
    'record-presented': { COLLECT: 'record-collecting', FAIL: 'release-error' },
    'record-collecting': { COLLECTED: 'record-collected', FAIL: 'release-error' },
    'record-collected': { DETAIL: 'detail-open' },
    'detail-open': {},
    'release-error': { RETRY: 'ready' },
  };
  const next = transitions[state][event];
  if (!next) throw new Error(`Invalid release transition: ${state} -> ${event}`);
  return next;
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
};

export function EvidenceMachine({
  state,
  specimen,
  record,
  onMachineAction,
  onRecordPresented,
  onCollect,
}: {
  state: EvidenceTrialState;
  specimen?: Specimen | null;
  record?: EvidenceRecord | null;
  onMachineAction?: () => void;
  onRecordPresented?: () => void;
  onCollect?: () => void;
}) {
  const config = resolveMachineConfiguration(state);
  const reducedMotion = useReducedMotion();
  const [releaseState, setReleaseState] = useState<EvidenceRecordReleaseState>(
    state.phase === 'record-presented' ? 'record-presented' : state.phase === 'record-collected' ? 'record-collected' : 'ready',
  );
  const busyRef = useRef(false);
  const timers = useRef<number[]>([]);
  const activeRecord = record ?? state.evidenceRecord;
  const productName = specimen?.product ?? state.product?.product ?? 'AWAITING PRODUCT';
  const accession = specimen?.accession ?? state.specimenCode ?? 'A1–00';
  const actionIsRelease = config.actuator.actionId === 'reveal-verdict' || config.actuator.actionId === 'retry-release';
  const actionable = config.primaryActionOwner === 'machine' && Boolean(config.actuator.actionId);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  useEffect(() => {
    if (state.phase === 'record-presented') setReleaseState('record-presented');
    if (state.phase === 'record-collected') setReleaseState('record-collected');
  }, [state.phase]);

  const schedule = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timers.current.push(id);
  };

  const runRelease = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setReleaseState('actuator-pressed');
    onMachineAction?.();
    const scale = reducedMotion ? 0.18 : 1;
    schedule(() => setReleaseState('latch-releasing'), 90 * scale);
    schedule(() => setReleaseState('record-dispensing'), 210 * scale);
    schedule(() => {
      setReleaseState('record-presented');
      busyRef.current = false;
      onRecordPresented?.();
    }, 980 * scale);
  };

  const activateMachine = () => {
    if (!actionable || busyRef.current) return;
    if (actionIsRelease) runRelease();
    else onMachineAction?.();
  };

  const collect = () => {
    if (releaseState !== 'record-presented' || busyRef.current) return;
    busyRef.current = true;
    setReleaseState('record-collecting');
    schedule(() => {
      setReleaseState('record-collected');
      busyRef.current = false;
      onCollect?.();
    }, reducedMotion ? 80 : 360);
  };

  const doorState = useMemo(() => {
    if (releaseState === 'actuator-pressed') return 'releasing';
    if (releaseState === 'latch-releasing') return 'released';
    if (['record-dispensing', 'record-presented', 'record-collecting', 'record-collected', 'detail-open'].includes(releaseState)) return 'open';
    return config.doorState;
  }, [config.doorState, releaseState]);

  const machineContent = (
    <>
      <div className={styles.housing} aria-hidden="true" />
      <div className={styles.bezel} aria-hidden="true" />
      <div className={styles.bay} aria-hidden="true">
        <div className={styles.specimen} data-specimen-visible={config.specimenVisibility !== 'absent'}>
          <span />
          <strong>FACE VALUE</strong>
          <small>{productName}</small>
        </div>
        <div className={styles.glass} data-glass-state={config.glassState} />
      </div>
      <div className={styles.slot} data-slot-active={releaseState !== 'ready'} aria-hidden="true">
        <span />
      </div>
      {activeRecord && ['record-dispensing', 'record-presented', 'record-collecting'].includes(releaseState) && (
        <div className={styles.dispensingStage} data-release-state={releaseState}>
          <EvidenceRecordArtifact
            record={activeRecord}
            mode="dispensed"
            actionable={releaseState === 'record-presented'}
            onCollect={collect}
          />
        </div>
      )}
      <div className={styles.doorPerspective}>
        <div className={styles.door} data-door-state={doorState}>
          <div className={styles.doorFront}>
            <div className={styles.identity}>
              <span>{accession}</span>
              <strong>{config.status.primary}</strong>
              <small>{config.status.secondary}</small>
            </div>
            <div className={styles.actuatorTrack} aria-hidden="true">
              <i data-actuator-state={releaseState === 'actuator-pressed' ? 'pressed' : config.actuator.state}>
                <b /><b /><b />
              </i>
            </div>
          </div>
          <div className={styles.doorThickness} aria-hidden="true" />
          <div className={styles.doorRear} aria-hidden="true" />
        </div>
      </div>
    </>
  );

  return (
    <section
      className={styles.machine}
      data-evidence-machine
      data-primary-action-owner={config.primaryActionOwner}
      data-release-state={releaseState}
      aria-label={`Evidence Machine. ${productName}. ${config.status.primary}. ${config.status.secondary ?? ''}`}
    >
      {actionable ? (
        <button
          type="button"
          className={styles.machineButton}
          aria-label={config.actuator.accessibleLabel}
          disabled={busyRef.current || releaseState !== 'ready'}
          onClick={activateMachine}
          data-machine-primary
        >
          {machineContent}
        </button>
      ) : machineContent}
      <div className={styles.machineStatus} aria-live="polite">
        <strong>{releaseState === 'record-presented' ? 'RECORD RELEASED' : config.status.primary}</strong>
        <span>{releaseState === 'record-presented' ? 'TAKE YOUR EVIDENCE' : config.status.secondary}</span>
      </div>
    </section>
  );
}
