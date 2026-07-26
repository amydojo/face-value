import { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceRecord, EvidenceTrialState, MachineActionId } from './evidenceTrial';
import { resolveMachineConfiguration } from './evidenceTrial';
import { EvidenceRecordArtifact } from './EvidenceRecordArtifact';
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

export type DispenseStep = 'idle' | 'edge' | 'feed-40' | 'alignment' | 'feed-70' | 'seated';

export interface EvidenceMachineProps {
  trial: EvidenceTrialState;
  onMachineAction?: (action: MachineActionId) => void;
  onRecordGenerated?: () => EvidenceRecord | null;
  onRecordPresented?: () => void;
  onRecordCollected?: () => void;
  onReleaseFailed?: () => void;
  simulateReleaseFailure?: boolean;
  compact?: boolean;
}

function stableReleaseState(trial: EvidenceTrialState): EvidenceRecordReleaseState {
  if (trial.phase === 'release-error') return 'release-error';
  if (['record-collected', 'disposition-required', 'complete', 'archived'].includes(trial.phase)) return 'record-collected';
  if (trial.phase === 'record-presented') return 'record-presented';
  return 'ready';
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function EvidenceMachine({
  trial,
  onMachineAction,
  onRecordGenerated,
  onRecordPresented,
  onRecordCollected,
  onReleaseFailed,
  simulateReleaseFailure = false,
  compact = false,
}: EvidenceMachineProps) {
  const config = resolveMachineConfiguration(trial);
  const [releaseState, setReleaseState] = useState<EvidenceRecordReleaseState>(() => stableReleaseState(trial));
  const [dispenseStep, setDispenseStep] = useState<DispenseStep>(() => trial.evidenceRecord ? 'seated' : 'idle');
  const [record, setRecord] = useState<EvidenceRecord | null>(trial.evidenceRecord);
  const [pressed, setPressed] = useState(false);
  const timers = useRef<number[]>([]);
  const releaseLocked = useRef(false);
  const failedOnce = useRef(false);
  const releaseSucceeded = useRef(false);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    if (releaseLocked.current) return;
    const stable = stableReleaseState(trial);
    setReleaseState(stable);
    setRecord(trial.evidenceRecord);
    setDispenseStep(trial.evidenceRecord ? 'seated' : 'idle');
  }, [trial.evidenceRecord, trial.phase]);

  const schedule = (callback: () => void, delay: number) => {
    const id = window.setTimeout(callback, delay);
    timers.current.push(id);
  };

  const runRelease = () => {
    if (releaseLocked.current) return;
    releaseLocked.current = true;
    releaseSucceeded.current = false;
    setPressed(true);
    setReleaseState('actuator-pressed');
    onMachineAction?.('release-record');

    const reduced = prefersReducedMotion();
    const timings = reduced
      ? { latch: 55, edge: 105, feed: 165, align: 165, final: 250, presented: 300 }
      : { latch: 90, edge: 210, feed: 300, align: 560, final: 640, presented: 900 };

    schedule(() => {
      setPressed(false);
      setReleaseState('latch-releasing');
    }, timings.latch);

    schedule(() => {
      if (simulateReleaseFailure && !failedOnce.current) {
        failedOnce.current = true;
        setReleaseState('release-error');
        releaseLocked.current = false;
        onReleaseFailed?.();
        return;
      }
      const generated = onRecordGenerated?.() ?? trial.evidenceRecord;
      if (!generated) {
        setReleaseState('release-error');
        releaseLocked.current = false;
        onReleaseFailed?.();
        return;
      }
      releaseSucceeded.current = true;
      setRecord(generated);
      setReleaseState('record-dispensing');
      setDispenseStep('edge');
    }, timings.edge);

    schedule(() => { if (releaseSucceeded.current) setDispenseStep('feed-40'); }, timings.feed);
    if (!reduced) schedule(() => { if (releaseSucceeded.current) setDispenseStep('alignment'); }, timings.align);
    schedule(() => { if (releaseSucceeded.current) setDispenseStep('feed-70'); }, timings.final);
    schedule(() => {
      if (!releaseSucceeded.current) return;
      setDispenseStep('seated');
      setReleaseState('record-presented');
      releaseLocked.current = false;
      onRecordPresented?.();
    }, timings.presented);
  };

  const activateMachine = () => {
    const action = config.actuator.actionId;
    if (!action || releaseLocked.current) return;
    if (action === 'release-record') {
      runRelease();
      return;
    }
    setPressed(true);
    window.requestAnimationFrame(() => {
      onMachineAction?.(action);
      setPressed(false);
    });
  };

  const collect = () => {
    if (releaseState !== 'record-presented' || !record || releaseLocked.current) return;
    releaseLocked.current = true;
    setReleaseState('record-collecting');
    const delay = prefersReducedMotion() ? 90 : 420;
    schedule(() => {
      setReleaseState('record-collected');
      releaseLocked.current = false;
      onRecordCollected?.();
    }, delay);
  };

  const doorState = useMemo(() => {
    if (releaseState === 'actuator-pressed') return config.doorState;
    if (releaseState === 'latch-releasing' || releaseState === 'release-error') return 'released';
    if (['record-dispensing', 'record-presented', 'record-collecting', 'record-collected', 'detail-open'].includes(releaseState)) return 'open';
    return config.doorState;
  }, [config.doorState, releaseState]);

  const actionable = config.primaryActionOwner === 'machine' && Boolean(config.actuator.actionId);
  const machineLabel = config.actuator.accessibleLabel ?? config.status.primary;
  const machineClass = `${styles.machine} ${compact ? styles.compact : ''}`;
  const statusSecondary = releaseState === 'release-error' ? 'PRESS TO RETRY' : config.status.secondary;

  const shell = (
    <>
      <div className={styles.housing} aria-hidden="true" />
      <div className={styles.bezel} aria-hidden="true" />
      <div className={styles.chamber} data-machine-part="chamber">
        <div className={styles.rearWall} aria-hidden="true" />
        <div className={styles.ceiling} aria-hidden="true" />
        <div className={styles.floor} aria-hidden="true" />
        <div className={styles.specimenDock} aria-hidden="true" />
        {trial.product ? (
          <div className={styles.specimen} aria-label={`${trial.product.name}, ${trial.product.volume}`}>
            <span className={styles.specimenCap} aria-hidden="true" />
            <span className={styles.specimenBody} aria-hidden="true">
              <b>FACE VALUE</b>
              <small>{trial.product.name}</small>
            </span>
          </div>
        ) : <div className={styles.emptySpecimen} aria-hidden="true">+</div>}
        <div className={styles.smartGlass} data-machine-part="smart-glass" aria-hidden="true" />
      </div>

      <div className={styles.hingeSeam} aria-hidden="true" />
      <div className={styles.dispensingChamber} data-machine-part="dispensing-chamber" aria-hidden="true">
        <div className={styles.slotLight} />
        <div className={styles.slotOcclusion} />
      </div>

      {record && ['record-dispensing', 'record-presented', 'record-collecting'].includes(releaseState) && (
        <div className={styles.dispensedRecordStage} data-dispense-step={dispenseStep}>
          <EvidenceRecordArtifact
            record={record}
            mode="dispensed"
            collectible={releaseState === 'record-presented'}
            onCollect={collect}
          />
        </div>
      )}

      <div className={styles.doorStage} data-machine-part="door-stage">
        <div className={styles.door} data-machine-part="cassette-door">
          <div className={styles.doorFront}>
            <div className={styles.identityPlate}>
              <span>{trial.specimenCode ?? 'FV–000'}</span>
              <strong>{config.status.primary}</strong>
              <small>{statusSecondary}</small>
            </div>
            <div className={styles.actuatorTrack} aria-hidden="true">
              <span className={styles.actuator} data-actuator-state={pressed ? 'pressed' : config.actuator.state}>
                <i /><i /><i />
              </span>
            </div>
          </div>
          <div className={styles.doorEdge} aria-hidden="true" />
          <div className={styles.doorUnderside} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.outputSlot} data-machine-part="record-slot" aria-hidden="true">
        <span>FACE VALUE · EVIDENCE OUTPUT</span>
      </div>

      {record && ['record-collected', 'detail-open'].includes(releaseState) && (
        <div className={styles.collectedRecordStage}>
          <EvidenceRecordArtifact record={record} mode="collected" />
        </div>
      )}
    </>
  );

  return (
    <section
      className={machineClass}
      data-evidence-machine
      data-trial-id={trial.trialId}
      data-trial-phase={trial.phase}
      data-primary-owner={config.primaryActionOwner}
      data-interaction-mode={config.interactionMode}
      data-actuator-state={pressed ? 'pressed' : config.actuator.state}
      data-door-state={doorState}
      data-glass-state={config.glassState}
      data-release-state={releaseState}
      data-dispense-step={dispenseStep}
      aria-label={`Evidence Machine. ${config.status.primary}. ${statusSecondary ?? ''}`}
    >
      {shell}
      {actionable && (
        <button
          type="button"
          className={styles.machineAction}
          aria-label={machineLabel}
          disabled={releaseLocked.current}
          onClick={activateMachine}
        />
      )}
      <div className={styles.machineAnnouncement} aria-live="polite" aria-atomic="true">
        {releaseState === 'record-presented' ? 'Record released. Take your evidence.' : ''}
        {releaseState === 'record-collected' ? 'Evidence collected.' : ''}
        {trial.phase === 'verdict-ready' ? 'Verdict ready.' : ''}
      </div>
    </section>
  );
}
