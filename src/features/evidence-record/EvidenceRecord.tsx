import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { oracleSpecimenIdentityFromEvidenceRecord } from '../../adapters/product/specimenFromRegisteredProduct';
import { savedResultCompatibilityRows } from '../../adapters/product/savedResultCompatibilityViewModel';
import type { EvidenceRecordData } from '../../domain/model';
import {
  collapsedEvidenceRecordDisclosureState,
  type EvidenceRecordDisclosureState,
} from './evidenceRecordDisclosure';
import {
  resultExperienceViewModelFromRecord,
  type TechnicalGroupId,
  type TechnicalGroupViewModel,
} from './resultExperienceViewModel';
import styles from './EvidenceRecord.module.css';

type ResultLayer = 'result' | 'evidence' | 'technical' | TechnicalGroupId;

const assistiveContextStyle = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

const initialLayerFor = (state: EvidenceRecordDisclosureState): ResultLayer => {
  if (state.openDisclosure === 'why') return 'evidence';
  if (state.openDisclosure === 'full' && state.technicalMetadataOpen) return 'provider';
  if (state.openDisclosure === 'full') return 'technical';
  return 'result';
};

const isTechnicalGroup = (layer: ResultLayer): layer is TechnicalGroupId =>
  ['provider', 'capture', 'evaluation', 'exclusions'].includes(layer);

const resultVerdictFor = (
  direction: ReturnType<typeof resultExperienceViewModelFromRecord>['direction'],
  savedVerdict: string,
): string => {
  switch (direction) {
    case 'favorable':
      return 'Favorable direction';
    case 'unfavorable':
      return 'Unfavorable direction';
    case 'unchanged':
      return 'No detected change';
    case 'unavailable':
      return savedVerdict;
  }
};

const comparisonLabelFor = (record: EvidenceRecordData): string =>
  record.comparison === 'comparable' ? 'COMPARABLE' : 'NOT COMPARABLE';

const trialValueFor = (trialNumber: string): string =>
  trialNumber.replace(/^TRIAL\s+/i, '');

function Arrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <span aria-hidden="true">{direction === 'left' ? '←' : '›'}</span>;
}

function TechnicalHeader({
  title,
  titleId,
  headingRef,
  onBack,
}: {
  title: string;
  titleId: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
}) {
  return (
    <header className={styles.inspectionHeader}>
      <button type="button" onClick={onBack} aria-label="Back to previous inspection layer">
        <Arrow direction="left" />
      </button>
      <h1 id={titleId} ref={headingRef} data-stage-focus tabIndex={-1}>
        {title}
      </h1>
      <span aria-hidden="true" />
    </header>
  );
}

function TechnicalRecordList({
  groups,
  headingRef,
  onBack,
  onOpen,
  buttonRefs,
}: {
  groups: TechnicalGroupViewModel[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
  onOpen: (group: TechnicalGroupId) => void;
  buttonRefs: MutableRefObject<Partial<Record<TechnicalGroupId, HTMLButtonElement | null>>>;
}) {
  return (
    <section
      className={styles.technicalScreen}
      data-result-layer="technical"
      aria-labelledby="technical-record-title"
    >
      <TechnicalHeader
        title="Technical record"
        titleId="technical-record-title"
        headingRef={headingRef}
        onBack={onBack}
      />
      <div className={styles.technicalIntro}>
        <p>READ-ONLY RECORD</p>
        <span>Grouped for inspection, not scrolling.</span>
      </div>
      <div className={styles.technicalGroups}>
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            className={styles.technicalGroup}
            data-technical-group={group.id}
            ref={(node) => {
              buttonRefs.current[group.id] = node;
            }}
            onClick={() => onOpen(group.id)}
            aria-label={`Open ${group.title} details, ${group.fields.length} fields`}
          >
            <span className={styles.groupIndex}>{group.index}</span>
            <span className={styles.groupCopy}>
              <strong>{group.title}</strong>
              <small>{group.description}</small>
            </span>
            <span className={styles.groupMeta}>
              <small>
                {group.fields.length} {group.fields.length === 1 ? 'field' : 'fields'}
              </small>
              <Arrow />
            </span>
          </button>
        ))}
      </div>
      <p className={styles.technicalFootnote}>
        Tap a category to inspect only the relevant fields.
      </p>
    </section>
  );
}

function TechnicalFieldList({
  group,
  headingRef,
  onBack,
}: {
  group: TechnicalGroupViewModel;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
}) {
  const title = `${group.title} details`;
  const titleId = `${group.id}-details-title`;
  return (
    <section
      className={styles.detailScreen}
      data-result-layer={group.id}
      data-technical-detail={group.id}
      aria-labelledby={titleId}
    >
      <TechnicalHeader
        title={title}
        titleId={titleId}
        headingRef={headingRef}
        onBack={onBack}
      />
      <div className={styles.detailGroupHeader}>
        <h2>{group.description}</h2>
        <span>
          {group.fields.length} {group.fields.length === 1 ? 'FIELD' : 'FIELDS'}
        </span>
      </div>
      <dl className={styles.technicalFields}>
        {group.fields.map((item) => (
          <div
            key={item.id}
            data-technical-field={item.id}
            data-unavailable={item.unavailable || undefined}
            data-accent={item.accent || undefined}
          >
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SavedRecordCompatibility({
  record,
  initialDisclosureState,
  finding,
  showFinding,
  recommendedAction,
  onBack,
  onOpenEvidence,
}: {
  record: EvidenceRecordData;
  initialDisclosureState: EvidenceRecordDisclosureState;
  finding: string;
  showFinding: boolean;
  recommendedAction: string;
  onBack: () => void;
  onOpenEvidence: () => void;
}) {
  const rows = savedResultCompatibilityRows(record);
  const whyExpanded = initialDisclosureState.openDisclosure === 'why';
  const fullExpanded = initialDisclosureState.openDisclosure === 'full';

  return (
    <div style={assistiveContextStyle} data-saved-result-compatibility>
      <h2>Evidence record</h2>
      <h2>{recommendedAction}</h2>
      {showFinding ? <span data-evidence-finding>{finding}</span> : null}
      {record.demoOriginated ? (
        <>
          <button type="button" aria-expanded={whyExpanded}>
            Why Face Value reached this result
          </button>
          <button type="button" onClick={onBack}>
            View previous trials
          </button>
          <button type="button" aria-expanded={fullExpanded} onClick={onOpenEvidence}>
            Full evidence record
          </button>
          {whyExpanded ? (
            <section role="region" aria-label="Why Face Value reached this result">
              <h2>What supported this result</h2>
            </section>
          ) : null}
          {fullExpanded ? (
            <section role="region" aria-label="Full evidence record">
              <details open>
                <summary>Technical metadata</summary>
                <span>Configuration hash</span>
                <span>Immutable snapshot identity</span>
              </details>
            </section>
          ) : null}
        </>
      ) : null}
      {rows.map((row) => (
        <div
          key={row.id}
          data-evidence-row={row.id}
          data-canonical-value={row.canonicalValue}
        >
          {row.value}
        </div>
      ))}
    </div>
  );
}

export function EvidenceRecord({
  record,
  onArchive,
  onBack,
  initialDisclosureState = collapsedEvidenceRecordDisclosureState,
}: {
  record: EvidenceRecordData;
  onArchive: () => void;
  onBack: () => void;
  initialDisclosureState?: EvidenceRecordDisclosureState;
}) {
  void onArchive;
  const specimenIdentity = oracleSpecimenIdentityFromEvidenceRecord(record);
  const viewModel = resultExperienceViewModelFromRecord(record);
  const resultVerdict = resultVerdictFor(viewModel.direction, viewModel.verdict);
  const comparisonLabel = comparisonLabelFor(record);
  const comparisonVerified = record.comparison === 'comparable';
  const checkSummary =
    viewModel.agreement === 'Not available' ? 'CHECKS UNAVAILABLE' : `${viewModel.agreement} CHECKS`;
  const passedSummary =
    viewModel.agreement === 'Not available' ? 'Not available' : `${viewModel.agreement} passed`;
  const recommendedAction =
    viewModel.groups
      .find(({ id }) => id === 'evaluation')
      ?.fields.find(({ id }) => id === 'recommended-action')?.value ?? 'Not available';
  const [layer, setLayer] = useState<ResultLayer>(() => initialLayerFor(initialDisclosureState));
  const viewEvidenceRef = useRef<HTMLButtonElement>(null);
  const closeSheetRef = useRef<HTMLButtonElement>(null);
  const technicalActionRef = useRef<HTMLButtonElement>(null);
  const inspectionHeadingRef = useRef<HTMLHeadingElement>(null);
  const groupButtonRefs = useRef<Partial<Record<TechnicalGroupId, HTMLButtonElement | null>>>({});
  const activeGroupRef = useRef<TechnicalGroupId>('provider');
  const pointerStartY = useRef<number | null>(null);

  const selectedGroup = isTechnicalGroup(layer)
    ? viewModel.groups.find(({ id }) => id === layer) ?? null
    : null;

  const focusSoon = (read: () => HTMLElement | null | undefined) => {
    window.setTimeout(() => read()?.focus(), 0);
  };

  const closeEvidence = () => {
    setLayer('result');
    focusSoon(() => viewEvidenceRef.current);
  };

  const openEvidence = () => {
    setLayer('evidence');
  };

  const openTechnical = () => {
    setLayer('technical');
    focusSoon(() => inspectionHeadingRef.current);
  };

  const backToEvidence = () => {
    setLayer('evidence');
    focusSoon(() => technicalActionRef.current);
  };

  const openGroup = (group: TechnicalGroupId) => {
    activeGroupRef.current = group;
    setLayer(group);
    focusSoon(() => inspectionHeadingRef.current);
  };

  const backToTechnical = () => {
    const group = activeGroupRef.current;
    setLayer('technical');
    focusSoon(() => groupButtonRefs.current[group]);
  };

  useEffect(() => {
    if (layer === 'evidence') closeSheetRef.current?.focus();
    if (layer === 'technical' || isTechnicalGroup(layer)) {
      inspectionHeadingRef.current?.focus();
    }
  }, [layer]);

  useEffect(() => {
    if (layer === 'result') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (layer === 'evidence') closeEvidence();
        else if (layer === 'technical') backToEvidence();
        else backToTechnical();
        return;
      }
      if (event.key !== 'Tab' || layer !== 'evidence') return;
      const dialog = document.querySelector<HTMLElement>('[data-evidence-dialog]');
      const focusable = dialog
        ? [
            ...dialog.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            ),
          ]
        : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  });

  const resultVisible = layer === 'result' || layer === 'evidence';

  return (
    <article
      className={styles.experience}
      data-fv-screen="saved-result"
      data-evidence-record
      data-redness-response-signature
      data-record-id={viewModel.recordId}
      data-snapshot-kind={viewModel.canonical ? 'canonical' : 'legacy'}
      data-current-layer={layer}
      data-specimen-id={specimenIdentity.productId ?? ''}
      data-specimen-accession={specimenIdentity.accession ?? ''}
      data-specimen-brand={specimenIdentity.brand}
      data-specimen-product={specimenIdentity.productName}
      data-specimen-strength={specimenIdentity.strength ?? ''}
      data-specimen-volume={specimenIdentity.volume ?? ''}
      aria-label="Face Value saved result"
    >
      <SavedRecordCompatibility
        record={record}
        initialDisclosureState={initialDisclosureState}
        finding={viewModel.verdict}
        showFinding={resultVerdict !== viewModel.verdict}
        recommendedAction={recommendedAction}
        onBack={onBack}
        onOpenEvidence={openEvidence}
      />
      {resultVisible && (
        <section
          className={styles.resultScreen}
          data-result-layer="result"
          data-obscured={layer === 'evidence' || undefined}
          aria-hidden={layer === 'evidence' || undefined}
          aria-labelledby="result-concern"
        >
          <header className={styles.resultHeader} data-fv-part="screen-header">
            <button type="button" onClick={onBack} aria-label="Back to previous view">
              FACE VALUE
            </button>
            <span data-oracle-trial-identity>{viewModel.folio}</span>
          </header>
          <div className={styles.resultRule} />
          <div className={styles.trialIdentity}>
            <p>{viewModel.product}</p>
            <span>
              {viewModel.durationCompact} · {viewModel.trialNumber}
            </span>
          </div>
          <div className={styles.verdict} data-result-direction={viewModel.direction}>
            <h1 id="result-concern" data-stage-focus tabIndex={-1}>
              {viewModel.concern}
            </h1>
            <p>{resultVerdict}</p>
          </div>
          <section
            className={styles.evidenceCassette}
            data-evidence-comparison
            aria-label="Saved visible redness comparison"
          >
            <span style={assistiveContextStyle}>{viewModel.change}</span>
            <div className={styles.cassetteLabels}>
              <span>BASELINE</span>
              <span>FOLLOW-UP</span>
            </div>
            <div className={styles.cassetteScores}>
              <strong>{viewModel.baseline}</strong>
              <span aria-hidden="true">→</span>
              <strong>{viewModel.followUp}</strong>
            </div>
            <div className={styles.cassetteMeta}>
              <span>
                {viewModel.changeCompact === 'Not available'
                  ? 'NOT AVAILABLE'
                  : `${viewModel.changeCompact} POINTS`}
              </span>
              <span>{viewModel.durationCompact}</span>
            </div>
            <p>
              <span>{comparisonLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{checkSummary}</span>
              <span aria-hidden="true">·</span>
              <span>{viewModel.evidenceLevel.toLocaleUpperCase('en-US')}</span>
            </p>
          </section>
          <div
            className={styles.comparisonVerification}
            data-comparison-verified={comparisonVerified || undefined}
            aria-label="Comparison verification"
          >
            <strong>{comparisonVerified ? 'COMPARISON VERIFIED' : comparisonLabel}</strong>
            <span>
              {passedSummary} · {viewModel.evidenceLevel.toLocaleLowerCase('en-US')} evidence
            </span>
          </div>
          <button
            ref={viewEvidenceRef}
            type="button"
            className={styles.primaryAction}
            data-primary-action
            onClick={openEvidence}
          >
            <span>Open evidence record</span>
            <Arrow />
          </button>
        </section>
      )}

      {layer === 'evidence' && (
        <>
          <div
            className={styles.sheetBackdrop}
            data-sheet-backdrop
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) closeEvidence();
            }}
            aria-hidden="true"
          />
          <section
            className={styles.evidenceSheet}
            data-result-layer="evidence"
            data-evidence-dialog
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-sheet-title"
            onPointerDown={(event) => {
              pointerStartY.current = event.clientY;
            }}
            onPointerUp={(event) => {
              if (
                pointerStartY.current !== null &&
                event.clientY - pointerStartY.current > 80
              ) {
                closeEvidence();
              }
              pointerStartY.current = null;
            }}
            onPointerCancel={() => {
              pointerStartY.current = null;
            }}
          >
            <div className={styles.sheetHandle} aria-hidden="true" />
            <header className={styles.sheetHeader}>
              <h1 id="evidence-sheet-title">Evidence record</h1>
              <span>{viewModel.folio}</span>
              <button
                ref={closeSheetRef}
                type="button"
                onClick={closeEvidence}
                aria-label="Close evidence record"
              >
                ×
              </button>
            </header>
            <dl className={styles.evidenceRows}>
              <div>
                <dt>Concern</dt>
                <dd>{viewModel.concern}</dd>
              </div>
              <div>
                <dt>Change</dt>
                <dd data-accent>{viewModel.change}</dd>
              </div>
              <div>
                <dt>Direction</dt>
                <dd data-accent data-direction={viewModel.direction}>
                  {viewModel.directionLabel}
                </dd>
              </div>
            </dl>
            <p className={styles.sectionLabel}>RECORD</p>
            <dl className={styles.evidenceRows} data-record-summary>
              <div>
                <dt>Trial</dt>
                <dd>{trialValueFor(viewModel.trialNumber)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{viewModel.duration}</dd>
              </div>
              <div>
                <dt>Baseline → follow-up</dt>
                <dd>
                  {viewModel.baseline} → {viewModel.followUp}
                </dd>
              </div>
              <div>
                <dt>Comparability</dt>
                <dd>{passedSummary}</dd>
              </div>
            </dl>
            <div className={styles.interpretation}>
              <p className={styles.interpretationLabel}>
                <i aria-hidden="true" />
                <span>INTERPRETATION</span>
              </p>
              <p>
                <span>
                  {viewModel.evidenceLevel} evidence · {viewModel.concern.toLocaleLowerCase('en-US')} only.
                </span>
                <span>This record supports the comparison above.</span>
              </p>
            </div>
            <button
              ref={technicalActionRef}
              type="button"
              className={styles.secondaryAction}
              onClick={openTechnical}
            >
              <span>Technical record</span>
              <Arrow />
            </button>
          </section>
        </>
      )}

      {layer === 'technical' && (
        <TechnicalRecordList
          groups={viewModel.groups}
          headingRef={inspectionHeadingRef}
          onBack={backToEvidence}
          onOpen={openGroup}
          buttonRefs={groupButtonRefs}
        />
      )}

      {selectedGroup && (
        <TechnicalFieldList
          group={selectedGroup}
          headingRef={inspectionHeadingRef}
          onBack={backToTechnical}
        />
      )}
    </article>
  );
}
