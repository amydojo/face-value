import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type { EvidenceRecordData } from '../../domain/model';
import {
  collapsedEvidenceRecordDisclosureState,
  type EvidenceRecordDisclosureState,
} from './evidenceRecordDisclosure';
import {
  resultExperienceViewModelFromRecord,
  type EvidenceCheckViewModel,
  type TechnicalGroupId,
  type TechnicalGroupViewModel,
} from './resultExperienceViewModel';
import styles from './EvidenceRecord.module.css';

type ResultLayer = 'result' | 'evidence' | 'technical' | TechnicalGroupId;

const initialLayerFor = (state: EvidenceRecordDisclosureState): ResultLayer => {
  if (state.openDisclosure === 'why') return 'evidence';
  if (state.openDisclosure === 'full' && state.technicalMetadataOpen) return 'provider';
  if (state.openDisclosure === 'full') return 'technical';
  return 'result';
};

const isTechnicalGroup = (layer: ResultLayer): layer is TechnicalGroupId =>
  ['provider', 'capture', 'evaluation', 'exclusions'].includes(layer);

function Arrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <span aria-hidden="true">{direction === 'left' ? '←' : '›'}</span>;
}

function ResultMetric({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className={styles.resultMetric} data-accent={accent || undefined}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EvidenceCheck({ check }: { check: EvidenceCheckViewModel }) {
  const symbol =
    check.tone === 'pass'
      ? '✓'
      : check.tone === 'limited'
        ? '!'
        : check.tone === 'fail'
          ? '×'
          : '—';
  return (
    <div className={styles.checkRow} data-check={check.id} data-check-tone={check.tone}>
      <span>{check.label}</span>
      <strong aria-label={`${check.label} ${check.value}`}>
        <i aria-hidden="true">{symbol}</i>
        <span>{check.value}</span>
      </strong>
    </div>
  );
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
  buttonRefs: MutableRefObject<
    Partial<Record<TechnicalGroupId, HTMLButtonElement | null>>
  >;
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
  const viewModel = resultExperienceViewModelFromRecord(record);
  const [layer, setLayer] = useState<ResultLayer>(() =>
    initialLayerFor(initialDisclosureState),
  );
  const viewEvidenceRef = useRef<HTMLButtonElement>(null);
  const closeSheetRef = useRef<HTMLButtonElement>(null);
  const technicalActionRef = useRef<HTMLButtonElement>(null);
  const inspectionHeadingRef = useRef<HTMLHeadingElement>(null);
  const groupButtonRefs = useRef<
    Partial<Record<TechnicalGroupId, HTMLButtonElement | null>>
  >({});
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
      data-evidence-record
      data-record-id={viewModel.recordId}
      data-snapshot-kind={viewModel.canonical ? 'canonical' : 'legacy'}
      data-current-layer={layer}
      aria-label="Face Value saved result"
    >
      {resultVisible && (
        <section
          className={styles.resultScreen}
          data-result-layer="result"
          data-obscured={layer === 'evidence' || undefined}
          aria-hidden={layer === 'evidence' || undefined}
          aria-labelledby="result-concern"
        >
          <header className={styles.resultHeader}>
            <button type="button" onClick={onBack} aria-label="Back to previous view">
              FACE VALUE
            </button>
            <span>{viewModel.folio}</span>
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
            <p>{viewModel.verdict}</p>
          </div>
          <section
            className={styles.evidenceCassette}
            aria-label="Saved visible redness comparison"
          >
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
              {viewModel.comparison === 'Not available'
                ? 'NOT AVAILABLE'
                : `COMPARABLE · ${viewModel.evidenceLevel.toLocaleUpperCase('en-US')}`}
            </p>
          </section>
          <div className={styles.summaryMetrics} aria-label="Result summary">
            <ResultMetric value={viewModel.changeCompact} label="Change" accent />
            <ResultMetric value={viewModel.comparison} label="Comparable" />
            <ResultMetric value={viewModel.evidenceLevel} label="Evidence" />
          </div>
          <button
            ref={viewEvidenceRef}
            type="button"
            className={styles.primaryAction}
            data-primary-action
            onClick={() => setLayer('evidence')}
          >
            <span>View evidence</span>
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
              <h1 id="evidence-sheet-title">Evidence</h1>
              <button
                ref={closeSheetRef}
                type="button"
                onClick={closeEvidence}
                aria-label="Close evidence"
              >
                ×
              </button>
            </header>
            <dl className={styles.evidenceRows}>
              <div>
                <dt>Change</dt>
                <dd data-accent>{viewModel.changeCompact}</dd>
              </div>
              <div>
                <dt>Direction</dt>
                <dd data-accent data-direction={viewModel.direction}>
                  {viewModel.directionLabel}
                </dd>
              </div>
              <div>
                <dt>Agreement</dt>
                <dd>{viewModel.agreement}</dd>
              </div>
            </dl>
            <p className={styles.sectionLabel}>CAPTURE</p>
            <div className={styles.checks}>
              {viewModel.checks.map((check) => (
                <EvidenceCheck key={check.id} check={check} />
              ))}
            </div>
            <div className={styles.evidenceBoundary}>
              <i aria-hidden="true" />
              <p>
                {viewModel.evidenceBoundary.map((line) => (
                  <span key={line}>{line}</span>
                ))}
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
