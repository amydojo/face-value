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
import type { EvidenceRecordData, ProductPlacement, RegisteredProduct } from '../../domain/model';
import { oracleMotionDuration, type OracleRevealState } from '../../domain/oracleRevealMachine';
import type {
  SpecimenRegistrationPhase,
  SpecimenRegistrationSnapshot,
} from '../../domain/specimenRegistration';
import {
  oracleTrialIdentity,
  oracleTrialIdentityForRecord,
  type OracleTrialIdentity,
} from '../../domain/oracleTrialIdentity';
import {
  evidenceDetailViewModelFromRecord,
  verdictProduct,
  verdictViewModelFromAnalysis,
  verdictViewModelFromRecord,
  type VerdictViewModel,
} from '../verdict/verdictViewModel';
import {
  IdentityLockSpecimen,
  type OracleSpecimenIdentity,
  type OracleTrialState,
} from './IdentityLockSpecimen';
import { oracleMachineControlLabel } from './oraclePresentation';
import styles from './OracleRevealScene.module.css';

export type { OracleSpecimenIdentity, OracleTrialState } from './IdentityLockSpecimen';
export type {
  SpecimenRegistrationPhase,
  SpecimenRegistrationSnapshot,
} from '../../domain/specimenRegistration';

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
  viewModel,
  onTransmissionComplete,
}: {
  phase: OracleRevealState;
  trialIdentity: OracleTrialIdentity;
  viewModel: VerdictViewModel;
  onTransmissionComplete: () => void;
}) {
  const resolved = ['verdict_revealed', 'committing', 'dispensing', 'collected'].includes(phase);
  const saving = ['committing', 'dispensing'].includes(phase);
  const recorded = phase === 'collected';

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
        <span>{recorded || saving ? 'RECORD STATUS' : 'OBSERVED'}</span>
        <strong data-oracle-finding={!saving && !recorded ? true : undefined}>
          {recorded ? 'SAVED' : saving ? 'SAVING' : viewModel.headline}
        </strong>
      </div>
      {resolved && !saving && !recorded && (
        <div className={styles.firmwareNext}>
          <span>NEXT</span>
          <strong>{viewModel.nextStepLabel}</strong>
        </div>
      )}
      <i className={styles.syncLine} aria-hidden="true" />
    </div>
  );
}

function LatestVerdictDisplay({ viewModel }: { viewModel: VerdictViewModel }) {
  return (
    <div
      className={styles.latestDisplay}
      data-verdict-code={viewModel.verdictCode}
      aria-label={`Latest verdict for ${verdictProduct(viewModel)}`}
    >
      <header>
        <span>LATEST VERDICT</span>
        <span>{viewModel.trialId}</span>
      </header>
      <div>
        <span>PRODUCT</span>
        <strong>{verdictProduct(viewModel)}</strong>
      </div>
      <footer>
        <span>CONFIDENCE</span>
        <strong>{viewModel.confidence}</strong>
      </footer>
    </div>
  );
}

function EvidencePaperContent({
  viewModel,
  latest = false,
}: {
  viewModel: VerdictViewModel;
  latest?: boolean;
}) {
  return (
    <article aria-label={`${viewModel.headline} Next: ${viewModel.nextStepLabel}.`}>
      <header>
        <span>{latest ? 'LATEST VERDICT' : 'FACE VALUE'}</span>
        <span data-oracle-trial-identity>{viewModel.trialId}</span>
      </header>
      <section>
        <small>{verdictProduct(viewModel)}</small>
        <span>{latest ? 'RESULT' : 'OBSERVED'}</span>
        <strong data-evidence-finding>{viewModel.headline}</strong>
      </section>
      <footer>
        <span>NEXT</span>
        <strong>{viewModel.nextStepLabel}</strong>
        <small data-latest-paper-action={latest ? '' : undefined}>
          {latest ? (
            <>
              VIEW TRIAL <i aria-hidden="true">→</i>
            </>
          ) : (
            <>
              <span data-oracle-trial-identity>{viewModel.trialId}</span> · FACE EXCLUDED · PRIVATE
              BY DEFAULT
            </>
          )}
        </small>
      </footer>
    </article>
  );
}

function OracleEvidencePaper({
  record,
  viewModel,
  dispensed,
  collecting,
  onDispensed,
  onCollect,
  onCollected,
}: {
  record: EvidenceRecordData;
  viewModel: VerdictViewModel;
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
      aria-label={`Evidence record for ${verdictProduct(viewModel)}. Activate to take it.`}
      onClick={onCollect}
      onAnimationEnd={(event: AnimationEvent<HTMLButtonElement>) => {
        if (event.target !== event.currentTarget) return;
        if (collecting) onCollected();
        else if (!dispensed) onDispensed();
      }}
    >
      <EvidencePaperContent viewModel={viewModel} />
    </button>
  );
}

function LatestVerdictPaper({
  record,
  viewModel,
  onViewTrial,
}: {
  record: EvidenceRecordData;
  viewModel: VerdictViewModel;
  onViewTrial: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.paper} ${styles.latestPaper}`}
      data-latest-verdict-record
      data-paper-position="partially-revealed"
      data-record-id={record.id}
      aria-label={`View trial ${viewModel.trialId} for ${verdictProduct(viewModel)}`}
      onClick={onViewTrial}
    >
      <EvidencePaperContent viewModel={viewModel} latest />
    </button>
  );
}

export type OracleTrialStateMachineProps =
  | {
      state: 'empty';
    }
  | {
      state: 'registration-preview';
      identity: OracleSpecimenIdentity;
    }
  | {
      state: 'baseline-ready';
      product: RegisteredProduct;
      registration: SpecimenRegistrationSnapshot;
    }
  | {
      state: 'pending' | 'followup-ready';
      product: RegisteredProduct;
      day: number;
      intervalDays: number;
    };

type OracleVerdictMachineProps = {
  variant?: 'reveal' | 'latest-verdict';
  phase: OracleRevealState;
  trialIdentity: OracleTrialIdentity;
  viewModel: VerdictViewModel;
  record: EvidenceRecordData | null;
  evidenceDispensed?: boolean;
  collectionStarted?: boolean;
  onReveal?: () => void;
  onOpeningComplete?: () => void;
  onTransmissionComplete?: () => void;
  onKeep?: () => void;
  onCommitComplete?: () => void;
  onDispensed?: () => void;
  onCollect?: () => void;
  onCollected?: () => void;
  onViewTrial?: () => void;
};

type OracleTrialMachineProps = {
  variant: 'trial-state';
  trialState: OracleTrialState;
  product: RegisteredProduct | null;
  identity: OracleSpecimenIdentity | null;
  registration: SpecimenRegistrationSnapshot;
  day: number | null;
  intervalDays: number | null;
};

type OracleMachineProps = OracleVerdictMachineProps | OracleTrialMachineProps;

const idleRegistrationSnapshot: SpecimenRegistrationSnapshot = {
  registrationId: null,
  phase: 'idle',
  scanProgress: 0,
  isRegistering: false,
  isVerified: false,
  isReady: false,
  reducedMotion: false,
};

const completedRegistrationSnapshot: SpecimenRegistrationSnapshot = {
  registrationId: null,
  phase: 'ready',
  scanProgress: 1,
  isRegistering: false,
  isVerified: true,
  isReady: true,
  reducedMotion: false,
};

function specimenIdentityFromRegisteredProduct(product: RegisteredProduct): OracleSpecimenIdentity {
  const specimen = specimenFromRegisteredProduct(product);
  return {
    brand: specimen.brand,
    productName: specimen.product,
    strength: product.strength,
    volume: product.volume,
    assignedJob: product.assignedJob,
  };
}

function TrialStateDisplay({
  state,
  phase,
  day,
  intervalDays,
}: {
  state: OracleTrialState;
  phase: SpecimenRegistrationPhase;
  day: number | null;
  intervalDays: number | null;
}) {
  const headerState =
    state === 'empty'
      ? 'STANDBY'
      : state === 'registration-preview'
        ? 'REGISTRATION'
        : state === 'baseline-ready'
          ? phase === 'ready'
            ? 'BASELINE'
            : 'REGISTRATION'
          : state === 'followup-ready'
            ? 'FOLLOW-UP'
            : 'ACTIVE TRIAL';
  const caseStatus =
    state === 'empty'
      ? 'NO SPECIMEN LOADED'
      : state === 'registration-preview'
        ? 'LABEL PREVIEW'
        : state === 'baseline-ready'
          ? phase === 'preparing'
            ? 'PREPARING'
            : phase === 'aligning'
              ? 'ALIGNING SPECIMEN'
              : phase === 'scanning'
                ? 'REGISTERING SPECIMEN'
                : phase === 'processing'
                  ? 'VERIFYING SPECIMEN'
                  : phase === 'verified'
                    ? 'SPECIMEN VERIFIED'
                    : 'SPECIMEN LOADED'
          : 'SPECIMEN LOADED';
  const footerLabel =
    state === 'empty' ? 'SYSTEM' : state === 'registration-preview' ? 'INPUT' : 'PROTOCOL';
  const footerValue =
    state === 'empty'
      ? 'READY'
      : state === 'registration-preview'
        ? 'NOT YET LOADED'
        : state === 'baseline-ready'
          ? phase === 'ready'
            ? 'READY TO SCAN'
            : phase === 'preparing'
              ? 'INITIALIZING'
              : phase === 'aligning'
                ? 'CALIBRATING'
                : phase === 'scanning'
                  ? 'SCANNING'
                  : phase === 'processing'
                    ? 'PROCESSING'
                    : phase === 'verified'
                      ? 'REGISTERED'
                      : 'INITIALIZING'
          : day !== null && intervalDays !== null
            ? `DAY ${String(day).padStart(2, '0')} OF ${String(intervalDays).padStart(2, '0')}`
            : 'READY';
  const showJob = state !== 'empty';

  return (
    <div className={styles.trialStateDisplay} data-oracle-trial-display data-trial-state={state}>
      <header>
        <span>FACE VALUE</span>
        <span>{headerState}</span>
      </header>
      <div className={styles.trialStateBody}>
        <span>CASE STATUS</span>
        <strong>{caseStatus}</strong>
        {showJob ? (
          <p className={styles.trialStateJob}>
            <span>JOB</span>
            <b>REDUCE VISIBLE REDNESS</b>
          </p>
        ) : (
          <p className={styles.trialStateInstruction}>Insert one product to begin.</p>
        )}
      </div>
      <footer>
        <span>{footerLabel}</span>
        <strong>{footerValue}</strong>
      </footer>
    </div>
  );
}

function OracleMachine(props: OracleMachineProps) {
  const trialMachine = props.variant === 'trial-state' ? props : null;
  const verdictMachine = props.variant === 'trial-state' ? null : props;
  const latestVerdict = verdictMachine?.variant === 'latest-verdict';
  const phase = trialMachine ? 'done' : (verdictMachine?.phase ?? 'sealed');
  const viewModel = verdictMachine?.viewModel ?? null;
  const trialIdentity = verdictMachine?.trialIdentity ?? null;
  const record = verdictMachine?.record ?? null;
  const displayOn =
    trialMachine !== null || latestVerdict || !['sealed', 'opening'].includes(phase);
  const registration = trialMachine?.registration ?? completedRegistrationSnapshot;
  const ingestionPhase = registration.phase;
  const specimenIdentity =
    trialMachine?.identity ??
    (viewModel
      ? {
          brand: viewModel.productBrand ?? 'FACE VALUE',
          productName: viewModel.productName,
          strength: null,
          volume: null,
          assignedJob: 'Reduce visible redness' as const,
        }
      : null);
  const amberState = trialMachine
    ? trialMachine.trialState === 'followup-ready'
      ? 'followup-ready'
      : trialMachine.trialState === 'pending'
        ? 'trial-pending'
        : trialMachine.trialState === 'baseline-ready'
          ? ingestionPhase === 'preparing'
            ? 'specimen-preparing'
            : ingestionPhase === 'aligning' || ingestionPhase === 'scanning'
              ? 'specimen-registering'
              : ingestionPhase === 'processing'
                ? 'specimen-processing'
                : ingestionPhase === 'verified'
                  ? 'specimen-verified'
                  : ingestionPhase === 'ready'
                    ? 'baseline-ready'
                    : 'idle'
          : 'idle'
    : latestVerdict
      ? 'latest'
      : phase === 'verdict_revealed'
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
  const cassetteVariant = trialMachine
    ? 'trial-state'
    : latestVerdict
      ? 'latest-verdict'
      : 'reveal';
  const cassetteState = trialMachine
    ? trialMachine.trialState
    : latestVerdict
      ? 'partially-revealed'
      : phase;
  const registrationDraftDetails =
    trialMachine?.trialState === 'registration-preview' && trialMachine.identity
      ? [
          trialMachine.identity.brand === 'UNNAMED BRAND' ? null : trialMachine.identity.brand,
          trialMachine.identity.productName === 'UNNAMED PRODUCT'
            ? null
            : trialMachine.identity.productName,
          trialMachine.identity.strength,
        ].filter((value): value is string => Boolean(value))
      : [];
  const machineLabel = trialMachine
    ? trialMachine.trialState === 'empty'
      ? 'Empty Face Value instrument. No specimen loaded.'
      : trialMachine.trialState === 'registration-preview'
        ? `Product identity preview. The specimen has not been loaded.${
            registrationDraftDetails.length > 0
              ? ` Draft specimen: ${registrationDraftDetails.join(', ')}.`
              : ''
          }`
        : trialMachine.trialState === 'baseline-ready'
          ? ingestionPhase === 'ready'
            ? `Baseline-ready Face Value instrument. Specimen loaded: ${trialMachine.product?.brand ?? ''}, ${trialMachine.product?.productName ?? ''}. Assigned job: Reduce visible redness. Ready to take the baseline scan.`
            : `Face Value instrument registering specimen: ${trialMachine.product?.brand ?? ''}, ${trialMachine.product?.productName ?? ''}. Assigned job: Reduce visible redness.`
          : `${trialMachine.trialState === 'followup-ready' ? 'Follow-up ready' : 'Trial pending'} for ${trialMachine.product?.brand ?? ''} ${trialMachine.product?.productName ?? ''}. Specimen loaded.`
    : latestVerdict && viewModel
      ? `Latest verdict cassette for ${verdictProduct(viewModel)}. ${viewModel.headline}`
      : viewModel && (phase === 'sealed' || phase === 'opening')
        ? 'Sealed Face Value result cassette. Result content is unavailable until reveal.'
        : viewModel
          ? `Face Value result cassette. ${viewModel.headline}`
          : 'Face Value result cassette.';
  const onReveal = verdictMachine?.onReveal ?? (() => undefined);
  const onOpeningComplete = verdictMachine?.onOpeningComplete ?? (() => undefined);
  const onTransmissionComplete = verdictMachine?.onTransmissionComplete ?? (() => undefined);
  const onKeep = verdictMachine?.onKeep ?? (() => undefined);
  const onCommitComplete = verdictMachine?.onCommitComplete ?? (() => undefined);
  const onDispensed = verdictMachine?.onDispensed ?? (() => undefined);
  const onCollect = verdictMachine?.onCollect ?? (() => undefined);
  const onCollected = verdictMachine?.onCollected ?? (() => undefined);
  const onViewTrial = verdictMachine?.onViewTrial ?? (() => undefined);
  const evidenceDispensed = verdictMachine?.evidenceDispensed ?? false;
  const collectionStarted = verdictMachine?.collectionStarted ?? false;

  return (
    <section
      className={`${styles.machine} ${latestVerdict ? styles.latestMachine : ''}`}
      style={oracleTimingProperties}
      data-oracle-machine
      data-oracle-state={phase}
      data-cassette-variant={cassetteVariant}
      data-cassette-state={cassetteState}
      data-machine-implementation="oracle"
      data-trial-machine-state={trialMachine?.trialState}
      data-ingestion-phase={trialMachine?.registration.phase}
      data-registration-phase={trialMachine?.registration.phase}
      data-registration-active={trialMachine?.registration.isRegistering}
      data-registration-complete={trialMachine?.registration.isReady}
      data-scan-state={
        trialMachine?.registration.phase === 'scanning'
          ? trialMachine.registration.reducedMotion
            ? 'wash'
            : 'active'
          : 'inactive'
      }
      data-scan-progress={trialMachine?.registration.scanProgress.toFixed(3)}
      data-machine-material="carbon"
      data-machine-finish="smoked-graphite"
      data-machine-instance="face-value-oracle"
      aria-label={machineLabel}
    >
      <div className={styles.chassis} data-oracle-chassis>
        <div className={styles.carbonTexture} data-oracle-carbon-texture aria-hidden="true" />
        <div className={styles.displayBezel} data-oracle-display-opening>
          <div className={styles.displayGlass} data-oracle-display-glass>
            <IdentityLockSpecimen
              identity={specimenIdentity}
              specimenState={trialMachine?.trialState ?? 'verdict'}
              registration={registration}
            />
            {trialMachine && (
              <TrialStateDisplay
                state={trialMachine.trialState}
                phase={trialMachine.registration.phase}
                day={trialMachine.day}
                intervalDays={trialMachine.intervalDays}
              />
            )}
            {!trialMachine && displayOn && !latestVerdict && viewModel && trialIdentity && (
              <FirmwareDisplay
                phase={phase}
                trialIdentity={trialIdentity}
                viewModel={viewModel}
                onTransmissionComplete={onTransmissionComplete}
              />
            )}
            {latestVerdict && viewModel && <LatestVerdictDisplay viewModel={viewModel} />}
            {!trialMachine && !displayOn && !latestVerdict && (
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

        <div className={styles.lowerDeck} data-oracle-lower-deck>
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
            data-oracle-amber-control
            data-oracle-keep-action={!trialMachine && !latestVerdict ? 'hardware' : undefined}
            aria-label={
              !trialMachine && !latestVerdict && phase === 'verdict_revealed'
                ? 'Keep this result'
                : undefined
            }
            aria-hidden={Boolean(trialMachine || latestVerdict || phase !== 'verdict_revealed')}
            tabIndex={!trialMachine && !latestVerdict && phase === 'verdict_revealed' ? 0 : -1}
            disabled={Boolean(trialMachine || latestVerdict || phase !== 'verdict_revealed')}
            onClick={onKeep}
          >
            <span aria-hidden="true" />
          </button>
          <OraclePullHandle
            active={!trialMachine && !latestVerdict && phase === 'sealed'}
            phase={phase}
            product={
              trialMachine?.product?.productName ?? viewModel?.productName ?? 'Face Value product'
            }
            onReveal={onReveal}
          />
          <div className={styles.bottomRail} data-oracle-bottom-rail aria-hidden="true" />
        </div>

        {!trialMachine && !latestVerdict && phase === 'opening' && (
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
        {!trialMachine && !latestVerdict && phase === 'committing' && (
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
        {!trialMachine && latestVerdict && record && viewModel && (
          <LatestVerdictPaper record={record} viewModel={viewModel} onViewTrial={onViewTrial} />
        )}
        {!trialMachine &&
          !latestVerdict &&
          record &&
          viewModel &&
          (phase === 'committing' || phase === 'dispensing') && (
            <OracleEvidencePaper
              record={record}
              viewModel={viewModel}
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

export function OracleTrialStateMachine(props: OracleTrialStateMachineProps) {
  const product =
    props.state === 'baseline-ready' ||
    props.state === 'pending' ||
    props.state === 'followup-ready'
      ? props.product
      : null;
  const identity =
    props.state === 'registration-preview'
      ? props.identity
      : product
        ? specimenIdentityFromRegisteredProduct(product)
        : null;
  const registration =
    props.state === 'baseline-ready'
      ? props.registration
      : props.state === 'empty' || props.state === 'registration-preview'
        ? idleRegistrationSnapshot
        : {
            ...completedRegistrationSnapshot,
            registrationId: product?.id ?? null,
          };

  return (
    <OracleMachine
      variant="trial-state"
      trialState={props.state}
      product={product}
      identity={identity}
      registration={registration}
      day={props.state === 'pending' || props.state === 'followup-ready' ? props.day : null}
      intervalDays={
        props.state === 'pending' || props.state === 'followup-ready' ? props.intervalDays : null
      }
    />
  );
}

export function LatestVerdictCassette({
  record,
  onViewTrial,
}: {
  record: EvidenceRecordData;
  onViewTrial: () => void;
}) {
  const viewModel = verdictViewModelFromRecord(record);
  const trialIdentity = oracleTrialIdentityForRecord(record);

  return (
    <div className={styles.latestCassetteFrame} data-latest-verdict-cassette>
      <p className={styles.cassetteSummary}>
        Latest verdict for {verdictProduct(viewModel)}. {viewModel.headline} Confidence:{' '}
        {viewModel.confidence}. Next: {viewModel.nextStepLabel}.
      </p>
      <OracleMachine
        variant="latest-verdict"
        phase="collected"
        trialIdentity={trialIdentity}
        viewModel={viewModel}
        record={record}
        onViewTrial={onViewTrial}
      />
    </div>
  );
}

function EvidenceDetail({
  record,
  trialIdentity,
}: {
  record: EvidenceRecordData;
  trialIdentity: OracleTrialIdentity;
}) {
  const detail = evidenceDetailViewModelFromRecord(record);

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
        {detail.rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {detail.technicalNote && <p>{detail.technicalNote}</p>}
      <p>{detail.claimBoundary}</p>
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
  const analysisViewModel = useMemo(
    () =>
      state.analysis && specimen
        ? verdictViewModelFromAnalysis({
            trialId: trialIdentity.folio,
            productName: specimen.product,
            productBrand: specimen.brand,
            analysis: state.analysis,
            confidence: state.confidence,
            placement: state.placement,
            evaluatedAt: state.followupCapture?.createdAt,
          })
        : null,
    [
      specimen,
      state.analysis,
      state.confidence,
      state.followupCapture?.createdAt,
      state.placement,
      trialIdentity.folio,
    ],
  );
  const viewModel = pendingRecord ? verdictViewModelFromRecord(pendingRecord) : analysisViewModel;
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
  const leadCopy =
    phase === 'sealed'
      ? { eyebrow: 'VERDICT READY', headline: 'The result is in.' }
      : phase === 'opening' || phase === 'transmitting'
        ? { eyebrow: 'REVEALING RESULT', headline: 'Preparing your evidence record.' }
        : phase === 'verdict_revealed'
          ? { eyebrow: 'VERDICT READY', headline: 'The result is in.' }
          : phase === 'committing' || phase === 'dispensing'
            ? { eyebrow: 'SAVING RESULT', headline: 'Saving your result.' }
            : null;

  if (!state.analysis || !specimen || !viewModel) return null;

  return (
    <>
      <ScreenHeader code={trialIdentity.folio} dark />
      <section
        className={styles.scene}
        data-fv-screen="oracle-reveal"
        data-oracle-scene-state={phase}
      >
        {leadCopy && (
          <div className={styles.lead}>
            <p>{leadCopy.eyebrow}</p>
            <h1 data-stage-focus tabIndex={-1}>
              {leadCopy.headline}
            </h1>
          </div>
        )}

        <OracleMachine
          phase={phase}
          trialIdentity={trialIdentity}
          viewModel={viewModel}
          record={pendingRecord}
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
          <section className={styles.verdictActions} aria-label="Result recommendation">
            <p>{viewModel.explanation}</p>
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
            <p>RESULT ACCEPTED</p>
            <strong>Preparing your evidence record.</strong>
          </section>
        )}

        {phase === 'dispensing' && (
          <section
            className={styles.operationStatus}
            data-oracle-operation-status
            data-collection-started={state.oracleCollectionStarted}
            role="status"
          >
            <p>{state.oracleEvidenceDispensed ? 'RESULT READY' : 'RESULT ACCEPTED'}</p>
            <strong>
              {state.oracleEvidenceDispensed
                ? 'Take your evidence record.'
                : 'Preparing your evidence record.'}
            </strong>
          </section>
        )}

        {phase === 'collected' && collectedRecord && (
          <section className={styles.completion} aria-labelledby="evidence-recorded-heading">
            <div className={styles.completionResult} data-result-summary>
              <h1 id="evidence-recorded-heading" data-stage-focus tabIndex={-1}>
                EVIDENCE RECORDED
              </h1>
              <small className={styles.savedSupport}>Your result is saved.</small>
              <small className={styles.completionIdentity} data-oracle-trial-identity>
                {viewModel.trialId}
              </small>
              <h2>{verdictProduct(viewModel)}</h2>
              <strong>{viewModel.headline}</strong>
              <span>{viewModel.nextStepLabel}</span>
            </div>
            <div className={styles.completionActions} data-result-actions>
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
                  <EvidenceDetail record={collectedRecord} trialIdentity={trialIdentity} />
                )}
              </div>
            </div>
          </section>
        )}
      </section>
    </>
  );
}
