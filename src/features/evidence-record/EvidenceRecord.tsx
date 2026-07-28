import { useState } from 'react';
import type { EvidenceRecordData } from '../../domain/model';
import { ScreenHeader } from '../../components/hardware';
import {
  evidenceRecordViewModelFromRecord,
  type EvidenceRecordRow,
  type EvidenceRecordViewModel,
} from './evidenceRecordViewModel';
import {
  collapsedEvidenceRecordDisclosureState,
  type EvidenceRecordDisclosure,
  type EvidenceRecordDisclosureState,
} from './evidenceRecordDisclosure';
import styles from './EvidenceRecord.module.css';

function EvidenceRows({
  rows,
  showCanonical = false,
}: {
  rows: EvidenceRecordRow[];
  showCanonical?: boolean;
}) {
  return (
    <dl className={styles.evidenceRows}>
      {rows.map((row) => (
        <div key={row.id} data-evidence-row={row.id} data-canonical-value={row.canonicalValue}>
          <dt>{row.label}</dt>
          <dd>
            <span>{row.value}</span>
            {showCanonical && row.canonicalValue && row.canonicalValue !== row.value && (
              <code>{row.canonicalValue}</code>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ComparisonCard({
  comparison,
}: {
  comparison: NonNullable<EvidenceRecordViewModel['comparison']>;
}) {
  return (
    <section
      className={styles.comparisonCard}
      data-evidence-comparison
      data-comparison-tone={comparison.tone}
      aria-labelledby="visible-redness-title"
    >
      <h3 id="visible-redness-title">Visible redness</h3>
      <p className={styles.srOnly}>{comparison.accessibleSummary}</p>
      <div className={styles.scoreRow} aria-hidden="true">
        <div>
          <span>Baseline</span>
          <strong>{comparison.baseline}</strong>
        </div>
        <b>→</b>
        <div>
          <span>Follow-up</span>
          <strong>{comparison.followUp}</strong>
        </div>
      </div>
      <div className={styles.changeRail} aria-hidden="true">
        <i />
        <span />
        <b />
      </div>
      <div className={styles.comparisonMetrics} aria-hidden="true">
        <div>
          <span>Change</span>
          <strong>{comparison.change}</strong>
        </div>
        <div>
          <span>Time between scans</span>
          <strong>{comparison.interval}</strong>
        </div>
      </div>
      <p className={styles.directionNote}>Higher scores mean less visible redness.</p>
      {comparison.interpretationNote && (
        <p className={styles.comparisonCaution}>{comparison.interpretationNote}</p>
      )}
    </section>
  );
}

function NextStepCard({ nextStep }: { nextStep: EvidenceRecordViewModel['nextStep'] }) {
  return (
    <section
      className={styles.nextStepCard}
      data-next-step
      data-next-step-action={nextStep.canonicalAction}
      data-tone={nextStep.tone}
      aria-labelledby="next-step-title"
    >
      <div>
        <p>Next step</p>
        <h3 id="next-step-title">{nextStep.title}</h3>
        <span>{nextStep.body}</span>
      </div>
      <b aria-hidden="true">→</b>
    </section>
  );
}

function DisclosureButton({
  disclosure,
  title,
  summary,
  expanded,
  onToggle,
}: {
  disclosure: EvidenceRecordDisclosure;
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: (disclosure: EvidenceRecordDisclosure) => void;
}) {
  const controlId = `${disclosure}-disclosure-control`;
  const panelId = `${disclosure}-disclosure-panel`;
  return (
    <button
      type="button"
      id={controlId}
      className={styles.disclosureButton}
      data-disclosure={disclosure}
      data-expanded={expanded}
      aria-expanded={expanded}
      aria-controls={panelId}
      onClick={() => onToggle(disclosure)}
    >
      <span>
        <strong>{title}</strong>
        <small>{expanded ? `Hide ${summary.toLocaleLowerCase('en-US')}` : summary}</small>
      </span>
      <b aria-hidden="true">{expanded ? '⌃' : '›'}</b>
    </button>
  );
}

function WhyPanel({ viewModel }: { viewModel: EvidenceRecordViewModel }) {
  const why = viewModel.why;
  if (!why) return null;
  return (
    <section
      id="why-disclosure-panel"
      className={styles.whyPanel}
      data-disclosure-panel="why"
      role="region"
      aria-labelledby="why-disclosure-control"
    >
      <div>
        <h3>What supported this result</h3>
        <ul>
          {why.supportingPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <div className={styles.keepInMind}>
        <h3>What to keep in mind</h3>
        <p>{why.limitation}</p>
        <p>{why.claimBoundary}</p>
      </div>
    </section>
  );
}

function FullRecordPanel({
  viewModel,
  technicalMetadataOpen,
  onTechnicalMetadataToggle,
}: {
  viewModel: EvidenceRecordViewModel;
  technicalMetadataOpen: boolean;
  onTechnicalMetadataToggle: (open: boolean) => void;
}) {
  const full = viewModel.full;
  if (!full) return null;
  return (
    <section
      id="full-disclosure-panel"
      className={styles.fullRecordSheet}
      data-disclosure-panel="full"
      role="region"
      aria-labelledby="full-disclosure-control"
    >
      <header>
        <h3>Full evidence record</h3>
        <p>
          The result is shown first. These saved details explain what supported it, what was
          missing, and how the comparison was made.
        </p>
      </header>
      {full.sections.map((section) => (
        <section key={section.id} className={styles.fullRecordSection}>
          <h4>{section.title}</h4>
          <EvidenceRows rows={section.rows} showCanonical />
          {section.id === 'comparison-settings' && full.technicalNote && (
            <p className={styles.technicalNote}>{full.technicalNote}</p>
          )}
        </section>
      ))}
      <details
        className={styles.technicalDisclosure}
        open={technicalMetadataOpen}
        onToggle={(event) => onTechnicalMetadataToggle(event.currentTarget.open)}
      >
        <summary>
          <span>
            <strong>Technical metadata</strong>
            <small>Configuration, rule identifiers, and audit trace</small>
          </span>
          <b aria-hidden="true">⌄</b>
        </summary>
        <EvidenceRows rows={full.technicalMetadata} showCanonical />
        <div className={styles.auditTrace}>
          <h4>Audit trace</h4>
          {full.auditTrace.length > 0 ? (
            <ol>
              {full.auditTrace.map((entry, index) => (
                <li key={`${entry.ruleId}-${index}`}>
                  <strong>{entry.ruleId}</strong>
                  <span>{entry.outcome}</span>
                  <p>{entry.detail}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>Audit trace not available.</p>
          )}
        </div>
      </details>
    </section>
  );
}

function LegacyNotice({ viewModel }: { viewModel: EvidenceRecordViewModel }) {
  return (
    <section
      className={styles.legacyNotice}
      data-legacy-evidence-record
      aria-labelledby="earlier-result-details"
    >
      <h3 id="earlier-result-details">Earlier result</h3>
      <p>{viewModel.legacyMessage}</p>
      {viewModel.legacyNote && (
        <p>
          <strong>Saved note</strong>
          {viewModel.legacyNote}
        </p>
      )}
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
  const [openDisclosure, setOpenDisclosure] = useState<EvidenceRecordDisclosure | null>(
    initialDisclosureState.openDisclosure,
  );
  const [technicalMetadataOpen, setTechnicalMetadataOpen] = useState(
    initialDisclosureState.openDisclosure === 'full' &&
      initialDisclosureState.technicalMetadataOpen,
  );
  const viewModel = evidenceRecordViewModelFromRecord(record);
  const toggleDisclosure = (disclosure: EvidenceRecordDisclosure) => {
    setOpenDisclosure((current) => (current === disclosure ? null : disclosure));
  };

  return (
    <>
      <ScreenHeader code={viewModel.folio} dark />
      <article
        className={styles.recordScreen}
        data-fv-screen="saved-result"
        data-evidence-record
        data-record-id={viewModel.recordId}
        data-snapshot-kind={viewModel.canonical ? 'canonical' : 'legacy'}
        aria-labelledby="evidence-record-heading"
      >
        <div className={styles.recordNavigation}>
          <button type="button" onClick={onBack} aria-label="Back to previous view">
            <span aria-hidden="true">←</span> Back
          </button>
          <h1 id="evidence-record-heading" data-stage-focus tabIndex={-1}>
            Evidence record
          </h1>
        </div>

        <section className={styles.resultHero} aria-labelledby="evidence-result-heading">
          <p className={styles.productIdentity}>{viewModel.product}</p>
          <p className={styles.trialMetadata}>{viewModel.trialMetadata}</p>
          <p className={styles.resultLabel}>Result</p>
          <h2 id="evidence-result-heading">{viewModel.headline}</h2>
          <p className={styles.resultInterpretation}>{viewModel.interpretation}</p>
          <div className={styles.statusStrip}>
            <span>Next · {viewModel.nextStep.statusLabel}</span>
            {viewModel.evidenceStatus && <span>{viewModel.evidenceStatus}</span>}
          </div>
        </section>

        {viewModel.comparison ? (
          <ComparisonCard comparison={viewModel.comparison} />
        ) : viewModel.canonical ? (
          <section className={styles.comparisonUnavailable} aria-labelledby="comparison-unavailable">
            <h3 id="comparison-unavailable">Visible redness</h3>
            <p>{viewModel.comparisonUnavailableMessage}</p>
          </section>
        ) : null}

        {viewModel.canonical && viewModel.atAGlance.length > 0 && (
          <section className={styles.atAGlance} aria-labelledby="at-a-glance-heading">
            <h3 id="at-a-glance-heading">At a glance</h3>
            <EvidenceRows rows={viewModel.atAGlance} />
          </section>
        )}

        {!viewModel.canonical && <LegacyNotice viewModel={viewModel} />}

        <NextStepCard nextStep={viewModel.nextStep} />

        {viewModel.canonical && (
          <div className={styles.disclosures}>
            <DisclosureButton
              disclosure="why"
              title="Why Face Value reached this result"
              summary="See the useful evidence"
              expanded={openDisclosure === 'why'}
              onToggle={toggleDisclosure}
            />
            {openDisclosure === 'why' && <WhyPanel viewModel={viewModel} />}
            <DisclosureButton
              disclosure="full"
              title="Full evidence record"
              summary="Scores, limits, and system details"
              expanded={openDisclosure === 'full'}
              onToggle={toggleDisclosure}
            />
            {openDisclosure === 'full' && (
              <FullRecordPanel
                viewModel={viewModel}
                technicalMetadataOpen={technicalMetadataOpen}
                onTechnicalMetadataToggle={setTechnicalMetadataOpen}
              />
            )}
          </div>
        )}

        <button
          type="button"
          className={styles.previousTrials}
          aria-label="View previous trials"
          onClick={onArchive}
        >
          <span>
            <strong>Previous trials</strong>
            <small>View your saved evidence</small>
          </span>
          <b aria-hidden="true">›</b>
        </button>

        <p className={styles.privacyLabel}>{viewModel.privacyLabel}</p>
      </article>
    </>
  );
}
