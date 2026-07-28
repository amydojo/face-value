import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { browserHaptics, type HapticsAdapter } from '../../adapters/haptics/haptics';
import { specimenFromRegisteredProduct } from '../../adapters/product/specimenFromRegisteredProduct';
import { systemClock } from '../../adapters/clock/clock';
import { useFaceValue } from '../../app/faceValueContext';
import { createOracleEvidenceRecord } from '../../app/phaseBMachine';
import { ScreenHeader } from '../../components/hardware';
import type {
  EvidenceRecordData,
  ProductPlacement,
  RegisteredProduct,
} from '../../domain/model';
import { oracleMotionDuration, type OracleRevealState } from '../../domain/oracleRevealMachine';
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
import { oracleMachineControlLabel } from './oraclePresentation';
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

type CanonicalMachineProjection =
  | 'empty'
  | 'trial-pending'
  | 'followup-ready'
  | 'verdict'
  | 'latest-verdict';

type CanonicalAmberState =
  | 'idle'
  | 'pending'
  | 'followup-ready'
  | 'transmitting'
  | 'ready'
  | 'committed'
  | 'dispensing'
  | 'complete'
  | 'latest';

function CanonicalMachineShell({
  className = '',
  phase,
  projection,
  variant,
  cassetteState,
  ariaLabel,
  displayContent,
  evidenceContent,
  showSpecimenSilhouette = true,
  showSealedOptics = false,
  amberState,
  amberAction,
  handleActive = false,
  handleProduct = 'Face Value product',
  motionEnabled = false,
  onReveal = () => undefined,
  onOpeningComplete = () => undefined,
  onCommitComplete = () => undefined,
}: {
  className?: string;
  phase: OracleRevealState;
  projection: CanonicalMachineProjection;
  variant: 'reveal' | 'latest-verdict' | 'continuity';
  cassetteState: string;
  ariaLabel: string;
  displayContent?: ReactNode;
  evidenceContent?: ReactNode;
  showSpecimenSilhouette?: boolean;
  showSealedOptics?: boolean;
  amberState: CanonicalAmberState;
  amberAction?: {
    label: string;
    onActivate: () => void;
  };
  handleActive?: boolean;
  handleProduct?: string;
  motionEnabled?: boolean;
  onReveal?: () => void;
  onOpeningComplete?: () => void;
  onCommitComplete?: () => void;
}) {
  return (
    <section
      className={`${styles.machine} ${className}`.trim()}
      style={oracleTimingProperties}
      data-oracle-machine
      data-oracle-state={phase}
      data-cassette-variant={variant}
      data-cassette-state={cassetteState}
      data-machine-projection={projection}
      data-machine-shell="canonical"
      data-machine-material="carbon"
      data-machine-instance="face-value-oracle"
      aria-label={ariaLabel}
    >
      <div className={styles.chassis} data-oracle-chassis data-machine-chassis="canonical">
        <div className={styles.carbonTexture} aria-hidden="true" />
        <div className={styles.displayBezel} data-oracle-display-opening>
          <div className={styles.displayGlass} data-machine-smart-glass>
            {showSpecimenSilhouette && (
              <div className={styles.specimenSilhouette} aria-hidden="true">
                <i />
                <span />
              </div>
            )}
            {displayContent}
            {showSealedOptics && (
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

        <div className={styles.lowerDeck} data-machine-lower-deck>
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
            data-machine-amber-control
            data-oracle-keep-action={amberAction ? 'hardware' : undefined}
            aria-label={amberAction?.label}
            aria-hidden={!amberAction}
            tabIndex={amberAction ? 0 : -1}
            disabled={!amberAction}
            onClick={amberAction?.onActivate}
          >
            <span aria-hidden="true" />
          </button>
          <OraclePullHandle
            active={handleActive}
            phase={phase}
            product={handleProduct}
            onReveal={onReveal}
          />
          <div className={styles.bottomRail} data-machine-bottom-rail aria-hidden="true" />
        </div>

        {motionEnabled && phase === 'opening' && (
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
        {motionEnabled && phase === 'committing' && (
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
        {evidenceContent}
      </div>
      <div className={styles.slotLip} data-oracle-slot-lip aria-hidden="true" />
    </section>
  );
}

const compactSpecimenLabel = (value: string, maximumLength: number): string => {
  const firstWord = value.trim().split(/\s+/)[0] ?? '';
  return firstWord.slice(0, maximumLength).toUpperCase();
};

export type ContinuityProjectionProps =
  | {
      projection: 'empty';
    }
  | {
      projection: 'trial-pending' | 'followup-ready';
      product: RegisteredProduct;
      day: number;
      intervalDays: number;
    };

export function ContinuityProjection(props: ContinuityProjectionProps) {
  const loaded = props.projection !== 'empty';
  const product = loaded ? props.product : null;
  const specimen = product ? specimenFromRegisteredProduct(product) : null;
  const displayContent =
    product && specimen && loaded ? (
      <div className={styles.loadedContinuityDisplay}>
        <p className={styles.continuityState}>SPECIMEN LOADED</p>
        <i className={styles.continuityDisplayRule} aria-hidden="true" />
        <div
          className={`${styles.loadedProduct} ${
            product.brand.length + product.productName.length > 34
              ? styles.loadedProductCompact
              : ''
          }`}
        >
          <span>PRODUCT</span>
          <strong>
            <b>{product.brand}</b>
            <b>{product.productName}</b>
          </strong>
        </div>
        <div className={styles.loadedJob}>
          <span>JOB</span>
          <strong>{product.assignedJob}</strong>
        </div>
        <p className={styles.loadedDay}>
          DAY {String(props.day).padStart(2, '0')} OF{' '}
          {String(props.intervalDays).padStart(2, '0')}
        </p>
        <div
          className={styles.loadedSpecimen}
          data-registered-specimen-projection={specimen.id}
          aria-hidden="true"
        >
          <i className={styles.loadedSpecimenCap} />
          <i className={styles.loadedSpecimenCollar} />
          <i className={styles.loadedSpecimenBody} />
          <span className={styles.loadedSpecimenLabel}>
            <small>{compactSpecimenLabel(specimen.brand, 8)}</small>
            <b>{compactSpecimenLabel(specimen.product, 8)}</b>
            {product.strength && <em>{product.strength.toUpperCase()}</em>}
          </span>
        </div>
        <i className={styles.loadedPedestal} aria-hidden="true" />
      </div>
    ) : (
      <div className={styles.emptyContinuityDisplay}>
        <p className={styles.continuityState}>NO TRIAL LOADED</p>
        <div className={styles.emptySpecimen} aria-hidden="true">
          <i />
          <span />
        </div>
        <i className={styles.emptyPedestal} aria-hidden="true" />
        <i className={styles.emptyDisplayRule} aria-hidden="true" />
        <p className={styles.emptyInstruction}>Insert one product to begin.</p>
      </div>
    );

  return (
    <CanonicalMachineShell
      className={styles.continuityMachine}
      phase="collected"
      projection={props.projection}
      variant="continuity"
      cassetteState={props.projection}
      ariaLabel={
        product
          ? `${props.projection === 'followup-ready' ? 'Follow-up ready' : 'Trial pending'} for ${product.brand} ${product.productName}. Specimen loaded.`
          : 'Dormant Face Value machine. No trial loaded. Insert one product to begin.'
      }
      displayContent={displayContent}
      showSpecimenSilhouette={false}
      amberState={
        props.projection === 'followup-ready'
          ? 'followup-ready'
          : props.projection === 'trial-pending'
            ? 'pending'
            : 'idle'
      }
    />
  );
}

function OracleMachine({
  variant = 'reveal',
  phase,
  trialIdentity,
  viewModel,
  record,
  evidenceDispensed = false,
  collectionStarted = false,
  onReveal = () => undefined,
  onOpeningComplete = () => undefined,
  onTransmissionComplete = () => undefined,
  onKeep = () => undefined,
  onCommitComplete = () => undefined,
  onDispensed = () => undefined,
  onCollect = () => undefined,
  onCollected = () => undefined,
  onViewTrial = () => undefined,
}: {
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
}) {
  const latestVerdict = variant === 'latest-verdict';
  const displayOn = latestVerdict || !['sealed', 'opening'].includes(phase);
  const amberState = latestVerdict
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

  const displayContent = (
    <>
      {displayOn && !latestVerdict && (
        <FirmwareDisplay
          phase={phase}
          trialIdentity={trialIdentity}
          viewModel={viewModel}
          onTransmissionComplete={onTransmissionComplete}
        />
      )}
      {latestVerdict && <LatestVerdictDisplay viewModel={viewModel} />}
    </>
  );
  const evidenceContent = (
    <>
      {latestVerdict && record && (
        <LatestVerdictPaper record={record} viewModel={viewModel} onViewTrial={onViewTrial} />
      )}
      {!latestVerdict && record && (phase === 'committing' || phase === 'dispensing') && (
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
    </>
  );

  return (
    <CanonicalMachineShell
      className={latestVerdict ? styles.latestMachine : ''}
      phase={phase}
      projection={latestVerdict ? 'latest-verdict' : 'verdict'}
      variant={variant}
      cassetteState={latestVerdict ? 'partially-revealed' : phase}
      ariaLabel={
        latestVerdict
          ? `Latest verdict cassette for ${verdictProduct(viewModel)}. ${viewModel.headline}`
          : phase === 'sealed' || phase === 'opening'
            ? 'Sealed Face Value result cassette. Result content is unavailable until reveal.'
            : `Face Value result cassette. ${viewModel.headline}`
      }
      displayContent={displayContent}
      evidenceContent={evidenceContent}
      showSealedOptics={!displayOn && !latestVerdict}
      amberState={amberState}
      amberAction={
        !latestVerdict && phase === 'verdict_revealed'
          ? {
              label: 'Keep this result',
              onActivate: onKeep,
            }
          : undefined
      }
      handleActive={!latestVerdict && phase === 'sealed'}
      handleProduct={viewModel.productName}
      motionEnabled={!latestVerdict}
      onReveal={onReveal}
      onOpeningComplete={onOpeningComplete}
      onCommitComplete={onCommitComplete}
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
