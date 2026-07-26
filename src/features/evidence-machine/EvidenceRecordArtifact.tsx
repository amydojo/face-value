import type { EvidenceRecordArtifactMode } from './evidenceMachineLogic';
import { confidenceSeal } from './evidenceMachineLogic';
import type { EvidenceRecord } from './evidenceTrial';
import styles from './EvidenceMachine.module.css';

const formatArtifactDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
  }).format(parsed).toUpperCase();
};

const recordIndex = (id: string): string => {
  const digits = id.replace(/\D/g, '');
  if (digits) return digits.slice(-3).padStart(3, '0');
  return id.replace(/^ER-/, '').slice(-3).toUpperCase();
};

export function EvidenceRecordArtifact({
  record,
  mode,
  actionable = false,
  onCollect,
}: {
  record: EvidenceRecord;
  mode: EvidenceRecordArtifactMode;
  actionable?: boolean;
  onCollect?: () => void;
}) {
  const summary = `${record.productName}. ${record.finding.metric}. ${record.finding.summary}. Confidence ${record.confidence}. Next step ${record.nextStep}.`;
  const content = (
    <article
      className={styles.artifact}
      data-evidence-record-artifact
      data-record-id={record.id}
      data-artifact-mode={mode}
      aria-label={summary}
    >
      <span className={styles.artifactNotch} aria-hidden="true" />
      <span className={styles.artifactIndex} aria-hidden="true" />
      <header>
        <span>FACE VALUE</span>
        <span>EVIDENCE RECORD {recordIndex(record.id)}</span>
      </header>
      <section>
        <h2>{record.productName}</h2>
        <p>{formatArtifactDate(record.trialWindow.startedAt)} — {formatArtifactDate(record.trialWindow.endedAt)}</p>
      </section>
      <section>
        <span>{record.finding.metric}</span>
        <strong>{record.finding.summary}</strong>
      </section>
      <footer>
        <div className={styles.confidenceSeal} data-confidence-seal={confidenceSeal(record.confidence)} aria-hidden="true" />
        <strong>{record.confidence.toUpperCase()}</strong>
        <span>{record.nextStepCode ?? '—'}</span>
        <b>{record.nextStep.toUpperCase()}</b>
      </footer>
    </article>
  );

  if (!actionable) return content;

  return (
    <button
      type="button"
      className={styles.artifactButton}
      aria-label={`Collect Evidence Record for ${record.productName}`}
      onClick={onCollect}
      data-artifact-primary
    >
      {content}
    </button>
  );
}

export function EvidenceRecordDetail({ record }: { record: EvidenceRecord }) {
  return (
    <section className={styles.recordDetail} aria-labelledby="evidence-detail-heading" data-evidence-detail>
      <h2 id="evidence-detail-heading">EVIDENCE DETAIL</h2>
      <dl>
        <div><dt>OBSERVED</dt><dd>{record.detail.observed}</dd></div>
        <div><dt>NOT ESTABLISHED</dt><dd>{record.detail.notEstablished}</dd></div>
        <div><dt>CONTEXT</dt><dd>{record.detail.context}</dd></div>
        <div><dt>CONFIDENCE</dt><dd>{record.detail.confidence}</dd></div>
        <div><dt>NEXT STEP</dt><dd>{record.detail.nextStep}</dd></div>
        <div><dt>TECHNICAL METADATA</dt><dd>{record.detail.metadata.comparison} · {record.detail.metadata.exactTimestamp}</dd></div>
      </dl>
    </section>
  );
}
