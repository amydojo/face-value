import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { browserHaptics, type HapticsAdapter } from '../../adapters/haptics/haptics';
import { specimenFromRegisteredProduct } from '../../adapters/product/specimenFromRegisteredProduct';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import { createOracleEvidenceRecord } from '../../app/phaseBMachine';
import { ScreenHeader } from '../../components/hardware';
import type {
  AnalysisResult,
  EvidenceRecordData,
  ProductPlacement,
  Specimen,
} from '../../domain/model';
import { oracleMotionDuration, type OracleRevealState } from '../../domain/oracleRevealMachine';
import { oracleTrialIdentity, type OracleTrialIdentity } from '../../domain/oracleTrialIdentity';
import { formatRawScore } from '../../domain/youcamEvidence';
import { oracleMachineControlLabel, oracleNextStep } from './oraclePresentation';
import styles from './OracleRevealScene.module.css';

const DRAG_INTENT_PX = 5;
const DRAG_ACTIVATION_PX = 28;

type OracleTimingProperties = CSSProperties & {
  '--oracle-opening-duration': string;
  '--oracle-transmission-duration': string;
  '--oracle-commit-duration': string;
  '--oracle-dispense-duration': string;
  '--oracle-collection-duration': string;
};

const oracleTimingProperties: OracleTimingProperties = {
  '--oracle-opening-duration': `${oracleMotionDuration.opening}ms`,
  '--oracle-transmission-duration': `${oracleMotionDuration.transmission}ms`,
  '--oracle-commit-duration': `${oracleMotionDuration.commit}ms`,
  '--oracle-dispense-duration': `${oracleMotionDuration.dispense}ms`,
  '--oracle-collection-duration': `${oracleMotionDuration.collection}ms`,
};

const selectableNextSteps: Array<{
  placement: ProductPlacement;
  code: string;
  label: string;
  guidance: string;
}> = [
  {
    placement: 'established',
    code: 'S4',
    label: 'Established routine',
    guidance: 'Keep using it for the tested job.',
  },
  {
    placement: 'useful_elsewhere',
    code: 'U2',
    label: 'Another job',
    guidance: 'Keep the product, but test it for a different job.',
  },
  {
    placement: 'paused',
    code: 'P1',
    label: 'Test longer',
    guidance: 'Give the same trial a longer observation window.',
  },
  {
    placement: 'retry_alone',
    code: 'R3',
    label: 'Test alone',
    guidance: 'Repeat the trial without an overlapping product.',
  },
  {
    placement: 'released',
    code: 'E7',
    label: 'Outside routine',
    guidance: 'Conclude this trial without keeping the product active.',
  },
];

function recordProduct(record: EvidenceRecordData): string {
  return record.productBrand ? `${record.productBrand} · ${record.product}` : record.product;
}

function OraclePullHandle({
  active,
  phase,
  product,
  onReveal,
}: {
  active: boolean;
  phase: OracleRevealState;
  product: string;
  onReveal: () => void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    activated: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const controlLabel = oracleMachineControlLabel(phase);

  const activate = () => {
    if (active) onReveal();
  };

  const releaseCapture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <button
      type="button"
      className={styles.pullHandle}
      data-oracle-handle
      data-oracle-control-label={controlLabel ?? 'none'}
      data-oracle-control-busy={['opening', 'committing', 'dispensing'].includes(phase)}
      disabled={!active}
      tabIndex={active ? 0 : -1}
      aria-hidden={!active}
      aria-label={
        controlLabel === 'KEEP'
          ? 'Keep this result'
          : controlLabel === 'REVEAL'
            ? `Reveal sealed result for ${product}`
            : undefined
      }
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        activate();
      }}
      onPointerDown={(event) => {
        if (!active || event.button !== 0) return;
        event.preventDefault();
        suppressClickRef.current = false;
        event.currentTarget.focus({ preventScroll: true });
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
          activated: false,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || drag.activated) {
          return;
        }
        event.preventDefault();
        const distanceX = Math.abs(event.clientX - drag.startX);
        const distanceY = Math.abs(event.clientY - drag.startY);
        if (distanceX >= DRAG_INTENT_PX || distanceY >= DRAG_INTENT_PX) {
          drag.moved = true;
          suppressClickRef.current = true;
        }
        if (distanceX >= DRAG_ACTIVATION_PX && distanceX > distanceY) {
          drag.activated = true;
          activate();
        }
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        dragRef.current = null;
        suppressClickRef.current = drag.moved;
        releaseCapture(event);
      }}
      onPointerCancel={(event) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        suppressClickRef.current = false;
        releaseCapture(event);
      }}
      onLostPointerCapture={() => {
        dragRef.current = null;
      }}
    >
      <span aria-hidden="true">
        <i />
        <b>{controlLabel}</b>
      </span>
    </button>
  );
}

function FirmwareDisplay({
  phase,
  trialIdentity,
  analysis,
  recommendation,
  onTransmissionComplete,
}: {
  phase: OracleRevealState;
  trialIdentity: OracleTrialIdentity;
  analysis: AnalysisResult;
  recommendation: string;
  onTransmissionComplete: () => void;
}) {
  const resolved = ['verdict_revealed', 'committing', 'dispensing', 'collected'].includes(phase);

  return (
    <div
      className={styles.firmware}
      data-firmware-state={
        phase === 'transmitting' ? 'transmitting' : resolved ? 'resolved' : 'off'
      }
      data-oracle-motion={phase === 'transmitting' ? 'transmission' : undefined}
      onAnimationEnd={(event) => {
        if (phase === 'transmitting' && event.target === event.currentTarget) {
          onTransmissionComplete();
        }
      }}
    >
      <header>
        <span>FACE VALUE</span>
        <span data-oracle-trial-identity>{trialIdentity.firmware}</span>
      </header>
      <div className={styles.firmwareFinding}>
        <span>OBSERVED</span>
        <strong data-oracle-finding>{analysis.finding}</strong>
      </div>
      {resolved && (
        <div className={styles.firmwareNext}>
          <span>NEXT</span>
          <strong>{recommendation}</strong>
        </div>
      )}
      <i className={styles.syncLine} aria-hidden="true" />
    </div>
  );
}

function OracleEvidencePaper({
  record,
  trialIdentity,
  recommendation,
  dispensed,
  collecting,
  onDispensed,
  onCollect,
  onCollected,
}: {
  record: EvidenceRecordData;
  trialIdentity: OracleTrialIdentity;
  recommendation: string;
  dispensed: boolean;
  collecting: boolean;
  onDispensed: () => void;
  onCollect: () => void;
  onCollected: () => void;
}) {
  const paperRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dispensed && !collecting) {
      paperRef.current?.focus({ preventScroll: true });
    }
  }, [collecting, dispensed]);

  return (
    <button
      ref={paperRef}
      type="button"
      className={styles.paper}
      data-oracle-paper
      data-paper-position={collecting ? 'collecting' : dispensed ? 'final' : 'feeding'}
      data-record-id={record.id}
      data-paper-coordinate-system="oracle-machine"
      data-paper-rotation="0"
      data-paper-scale="1"
      data-paper-horizontal-offset="0"
      disabled={!dispensed || collecting}
      tabIndex={dispensed && !collecting ? 0 : -1}
      aria-hidden={!dispensed}
      aria-label={`Evidence record for ${recordProduct(record)}. Activate to take it.`}
      onClick={onCollect}
      onAnimationEnd={(event: AnimationEvent<HTMLButtonElement>) => {
        if (event.target !== event.currentTarget) return;
        if (collecting) onCollected();
        else if (!dispensed) onDispensed();
      }}
    >
      <article aria-label={`${record.finding}. Next: ${recommendation}.`}>
        <header>
          <span>FACE VALUE</span>
          <span data-oracle-trial-identity>{trialIdentity.folio}</span>
        </header>
        <section>
          <small>{recordProduct(record)}</small>
          <span>OBSERVED</span>
          <strong data-evidence-finding>{record.finding}</strong>
        </section>
        <footer>
          <span>NEXT</span>
          <strong>{recommendation}</strong>
          <small>
            <span data-oracle-trial-identity>{trialIdentity.folio}</span> · FACE EXCLUDED · PRIVATE
            BY DEFAULT
          </small>
        </footer>
      </article>
    </button>
  );
}

function OracleMachine({
  phase,
  specimen,
  trialIdentity,
  analysis,
  record,
  recommendation,
  evidenceDispensed,
  collectionStarted,
  onReveal,
  onOpeningComplete,
  onTransmissionComplete,
  onKeep,
  onCommitComplete,
  onDispensed,
  onCollect,
  onCollected,
}: {
  phase: OracleRevealState;
  specimen: Specimen;
  trialIdentity: OracleTrialIdentity;
  analysis: AnalysisResult;
  record: EvidenceRecordData | null;
  recommendation: string;
  evidenceDispensed: boolean;
  collectionStarted: boolean;
  onReveal: () => void;
  onOpeningComplete: () => void;
  onTransmissionComplete: () => void;
  onKeep: () => void;
  onCommitComplete: () => void;
  onDispensed: () => void;
  onCollect: () => void;
  onCollected: () => void;
}) {
  const displayOn = !['sealed', 'opening'].includes(phase);
  const amberState =
    phase === 'verdict_revealed'
      ? 'ready'
      : phase === 'committing'
        ? 'committed'
        : phase === 'dispensing'
          ? 'dispensing'
          : phase === 'collected'
            ? 'complete'
            : phase === 'transmitting'
              ? 'transmitting'
              : 'idle';

  return (
    <section
      className={styles.machine}
      style={oracleTimingProperties}
      data-oracle-machine
      data-oracle-state={phase}
      data-machine-material="carbon"
      data-machine-instance="face-value-oracle"
      aria-label={
        phase === 'sealed' || phase === 'opening'
          ? 'Sealed Face Value oracle. Result content is unavailable until reveal.'
          : `Face Value oracle. ${analysis.finding}`
      }
    >
      <div className={styles.chassis} data-oracle-chassis>
        <div className={styles.carbonTexture} aria-hidden="true" />
        <div className={styles.displayBezel} data-oracle-display-opening>
          <div className={styles.displayGlass}>
            <div className={styles.specimenSilhouette} aria-hidden="true">
              <i />
              <span />
            </div>
            {displayOn && (
              <FirmwareDisplay
                phase={phase}
                trialIdentity={trialIdentity}
                analysis={analysis}
                recommendation={recommendation}
                onTransmissionComplete={onTransmissionComplete}
              />
            )}
            {!displayOn && (
              <div className={styles.sealedOptics} aria-hidden="true">
                <span />
              </div>
            )}
            <div
              className={styles.glassReflection}
              data-oracle-glass-reflection
              aria-hidden="true"
            />
          </div>
        </div>

        <div className={styles.lowerDeck}>
          <div className={styles.slotAssembly} data-oracle-slot aria-hidden="true">
            <i className={styles.slotSeam} />
            <span className={styles.rollerLeft} />
            <span className={styles.rollerRight} />
            <b className={styles.guideLeft} />
            <b className={styles.guideRight} />
          </div>
          <button
            type="button"
            className={styles.amberControl}
            data-amber-state={amberState}
            data-oracle-keep-action="hardware"
            aria-label="Keep this result"
            aria-hidden={phase !== 'verdict_revealed'}
            tabIndex={phase === 'verdict_revealed' ? 0 : -1}
            disabled={phase !== 'verdict_revealed'}
            onClick={onKeep}
          >
            <span aria-hidden="true" />
          </button>
          <OraclePullHandle
            active={phase === 'sealed'}
            phase={phase}
            product={specimen.product}
            onReveal={onReveal}
          />
          <div className={styles.bottomRail} aria-hidden="true" />
        </div>

        {phase === 'opening' && (
          <div
            className={styles.openingMechanism}
            data-oracle-motion="opening"
            aria-hidden="true"
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) {
                onOpeningComplete();
              }
            }}
          />
        )}
        {phase === 'committing' && (
          <div
            className={styles.commitMechanism}
            data-oracle-motion="commit"
            aria-hidden="true"
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) {
                onCommitComplete();
              }
            }}
          />
        )}
      </div>

      <div
        className={styles.evidencePath}
        data-oracle-evidence-path
        data-paper-axis="vertical"
        data-paper-coordinate-system="oracle-machine"
      >
        {record && (phase === 'committing' || phase === 'dispensing') && (
          <OracleEvidencePaper
            record={record}
            trialIdentity={trialIdentity}
            recommendation={recommendation}
            dispensed={evidenceDispensed}
            collecting={collectionStarted}
            onDispensed={onDispensed}
            onCollect={onCollect}
            onCollected={onCollected}
          />
        )}
      </div>
      <div className={styles.slotLip} data-oracle-slot-lip aria-hidden="true" />
    </section>
  );
}

function EvidenceDetail({
  record,
  trialIdentity,
  recommendation,
}: {
  record: EvidenceRecordData;
  trialIdentity: OracleTrialIdentity;
  recommendation: string;
}) {
  const scoreSummary =
    typeof record.baselineRawScore === 'number' && typeof record.followUpRawScore === 'number'
      ? `${formatRawScore(record.baselineRawScore)} → ${formatRawScore(record.followUpRawScore)}`
      : 'Raw scores unavailable';
  const context = [
    record.baselineContext?.note,
    record.followUpContext?.note,
    ...(record.limitations ?? []),
    record.demoOriginated
      ? 'Demo timeline was advanced explicitly; the original baseline timestamp was not changed.'
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={styles.evidenceDetail}
      aria-labelledby="oracle-evidence-detail-heading"
      data-evidence-detail
    >
      <h3 id="oracle-evidence-detail-heading">EVIDENCE DETAIL</h3>
      <dl>
        <div>
          <dt>TRIAL</dt>
          <dd data-oracle-trial-identity>{trialIdentity.folio}</dd>
        </div>
        <div>
          <dt>OBSERVED</dt>
          <dd>{record.finding}</dd>
        </div>
        <div>
          <dt>NOT ESTABLISHED</dt>
          <dd>{record.nonFinding}</dd>
        </div>
        <div>
          <dt>CONTEXT</dt>
          <dd>{context || 'No additional trial context changed the boundary.'}</dd>
        </div>
        <div>
          <dt>CONFIDENCE</dt>
          <dd>{record.confidence.toUpperCase()}</dd>
        </div>
        <div>
          <dt>NEXT STEP</dt>
          <dd>{recommendation}</dd>
        </div>
        <div>
          <dt>TECHNICAL METADATA</dt>
          <dd>
            {record.evidenceSource ?? 'Baseline and follow-up'} ·{' '}
            {record.comparison.replaceAll('_', ' ')} · {scoreSummary}
          </dd>
        </div>
      </dl>
      <p>{record.claimBoundary}</p>
    </section>
  );
}

function focusAfterClose(ref: RefObject<HTMLButtonElement | null>) {
  window.requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
}

export function OracleRevealScene({ haptics = browserHaptics }: { haptics?: HapticsAdapter }) {
  const { state, dispatch } = useFaceValue();
  const [whyOpen, setWhyOpen] = useState(false);
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);
  const whyRef = useRef<HTMLButtonElement>(null);
  const choicesRef = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLButtonElement>(null);

  const specimen = useMemo(
    () => (state.registeredProduct ? specimenFromRegisteredProduct(state.registeredProduct) : null),
    [state.registeredProduct],
  );
  const recommendation = oracleNextStep(state.placement);
  const trialIdentity = useMemo(
    () =>
      oracleTrialIdentity({
        baselineAt: state.baselineLockedAt ?? state.baselineCapture?.createdAt,
        followUpAt: state.followUpEligibleAt ?? state.followupCapture?.createdAt,
        accession: state.registeredProduct?.accession,
      }),
    [
      state.baselineCapture?.createdAt,
      state.baselineLockedAt,
      state.followUpEligibleAt,
      state.followupCapture?.createdAt,
      state.registeredProduct?.accession,
    ],
  );
  const pendingRecord = useMemo(() => state.record ?? createOracleEvidenceRecord(state), [state]);
  const phase = state.oracleRevealState;

  useEffect(() => {
    if (phase !== 'verdict_revealed') {
      setWhyOpen(false);
      setChoicesOpen(false);
    }
    if (phase !== 'collected') setDetailOpen(false);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'collected') return;
    const frame = window.requestAnimationFrame(() =>
      doneRef.current?.focus({ preventScroll: true }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (detailOpen) {
        event.preventDefault();
        setDetailOpen(false);
        focusAfterClose(detailRef);
        return;
      }
      if (choicesOpen) {
        event.preventDefault();
        setChoicesOpen(false);
        focusAfterClose(choicesRef);
        return;
      }
      if (whyOpen) {
        event.preventDefault();
        setWhyOpen(false);
        focusAfterClose(whyRef);
        return;
      }
      dispatch({ type: 'BACK' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choicesOpen, detailOpen, dispatch, whyOpen]);

  const reveal = () => {
    if (phase !== 'sealed') return;
    dispatch({ type: 'REVEAL_STARTED' });
    haptics.confirm();
  };

  const keep = () => {
    if (phase !== 'verdict_revealed') return;
    dispatch({
      type: 'RECOMMENDATION_ACCEPTED',
      placement: state.placement,
      now: systemClock.now(),
    });
    haptics.confirm();
  };

  const collectedRecord = phase === 'collected' ? state.record : null;
  const headline =
    phase === 'collected'
      ? 'Evidence recorded.'
      : phase === 'sealed' || phase === 'opening'
        ? 'Your result is ready.'
        : 'The oracle has answered.';

  if (!state.analysis || !specimen) return null;

  return (
    <>
      <ScreenHeader code={trialIdentity.folio} dark />
      <section
        className={styles.scene}
        data-fv-screen="oracle-reveal"
        data-oracle-scene-state={phase}
      >
        <div className={styles.lead}>
          <p>
            {phase === 'collected'
              ? 'EVIDENCE RECORDED'
              : phase === 'sealed' || phase === 'opening'
                ? 'ONE SEALED RESULT'
                : 'ONE ORACLE READING'}
          </p>
          <h1 data-stage-focus tabIndex={-1}>
            {headline}
          </h1>
          <span>
            {phase === 'sealed' || phase === 'opening'
              ? 'Pull to reveal.'
              : phase === 'transmitting'
                ? 'Calibrating the display.'
                : phase === 'collected'
                  ? 'The system remembered.'
                  : 'The verdict remains inside the glass.'}
          </span>
        </div>

        <OracleMachine
          phase={phase}
          specimen={specimen}
          trialIdentity={trialIdentity}
          analysis={state.analysis}
          record={pendingRecord}
          recommendation={recommendation}
          evidenceDispensed={state.oracleEvidenceDispensed}
          collectionStarted={state.oracleCollectionStarted}
          onReveal={reveal}
          onOpeningComplete={() => dispatch({ type: 'REVEAL_PULL_COMPLETED' })}
          onTransmissionComplete={() => dispatch({ type: 'TRANSMISSION_COMPLETED' })}
          onKeep={keep}
          onCommitComplete={() => dispatch({ type: 'DISPENSE_STARTED' })}
          onDispensed={() => dispatch({ type: 'EVIDENCE_DISPENSED' })}
          onCollect={() => dispatch({ type: 'EVIDENCE_COLLECTION_STARTED' })}
          onCollected={() => dispatch({ type: 'EVIDENCE_COLLECTED' })}
        />

        {phase === 'verdict_revealed' && (
          <section className={styles.verdictActions} aria-label="Oracle recommendation">
            <p>{state.analysis.nonFinding}</p>
            <button
              type="button"
              className={styles.keepAction}
              data-oracle-keep-action="text"
              onClick={keep}
            >
              <span>KEEP THIS RESULT</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              ref={whyRef}
              type="button"
              className={styles.secondaryAction}
              aria-expanded={whyOpen}
              aria-controls="oracle-why"
              onClick={() => setWhyOpen((open) => !open)}
            >
              <span>SEE WHY</span>
              <span aria-hidden="true">{whyOpen ? '−' : '+'}</span>
            </button>
            <div id="oracle-why" className={styles.whyPanel} hidden={!whyOpen}>
              <dl>
                <div>
                  <dt>CONFIDENCE</dt>
                  <dd>{state.confidence.toUpperCase()}</dd>
                </div>
                <div>
                  <dt>CONTEXT</dt>
                  <dd>{state.analysis.relevantContext}</dd>
                </div>
              </dl>
              <p>{state.analysis.claimBoundary}</p>
            </div>
            <button
              ref={choicesRef}
              type="button"
              className={styles.tertiaryAction}
              aria-expanded={choicesOpen}
              aria-controls="oracle-next-step-options"
              onClick={() => setChoicesOpen((open) => !open)}
            >
              CHOOSE ANOTHER NEXT STEP
            </button>
            <fieldset
              id="oracle-next-step-options"
              className={styles.nextStepOptions}
              hidden={!choicesOpen}
            >
              <legend>Choose another next step</legend>
              {selectableNextSteps.map((option) => (
                <label key={option.placement}>
                  <input
                    type="radio"
                    name="oracle-next-step"
                    value={option.placement}
                    checked={state.placement === option.placement}
                    onChange={() =>
                      dispatch({
                        type: 'SELECT_PLACEMENT',
                        placement: option.placement,
                      })
                    }
                  />
                  <span>
                    <strong>
                      {option.code} · {option.label}
                    </strong>
                    <small>{option.guidance}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>
        )}

        {phase === 'committing' && (
          <section className={styles.operationStatus} role="status">
            <p>ANSWER ACCEPTED</p>
            <strong>Preparing one evidence record.</strong>
          </section>
        )}

        {phase === 'dispensing' && (
          <section
            className={styles.operationStatus}
            data-oracle-operation-status
            data-collection-started={state.oracleCollectionStarted}
            role="status"
          >
            <p>{state.oracleEvidenceDispensed ? 'EVIDENCE PRODUCED' : 'PRODUCING EVIDENCE'}</p>
            <strong>
              {state.oracleEvidenceDispensed
                ? 'Take your record.'
                : 'The rollers are feeding the record.'}
            </strong>
          </section>
        )}

        {phase === 'collected' && collectedRecord && (
          <section className={styles.completion}>
            <p>EVIDENCE RECORDED</p>
            <small className={styles.completionIdentity} data-oracle-trial-identity>
              {trialIdentity.folio}
            </small>
            <h2>{recordProduct(collectedRecord)}</h2>
            <strong>{collectedRecord.finding}</strong>
            <span>{recommendation}</span>
            <button
              ref={doneRef}
              type="button"
              className={styles.doneAction}
              onClick={() => dispatch({ type: 'ORACLE_DONE' })}
            >
              <span>DONE</span>
              <span aria-hidden="true">→</span>
            </button>
            <button
              ref={detailRef}
              type="button"
              className={styles.viewAction}
              aria-expanded={detailOpen}
              aria-controls="oracle-evidence-detail"
              onClick={() => setDetailOpen((open) => !open)}
            >
              VIEW EVIDENCE
            </button>
            <div id="oracle-evidence-detail" hidden={!detailOpen}>
              {detailOpen && (
                <EvidenceDetail
                  record={collectedRecord}
                  trialIdentity={trialIdentity}
                  recommendation={recommendation}
                />
              )}
            </div>
          </section>
        )}
      </section>
    </>
  );
}
