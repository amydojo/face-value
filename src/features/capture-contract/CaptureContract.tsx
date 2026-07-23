import { useMemo, useState } from 'react';
import type { CaptureContractOutcome, CaptureKind } from '../../domain/model';
import styles from '../../styles/FaceValue.module.css';

const conditions = [
  'Lighting', 'Face position', 'Camera distance', 'Makeup', 'Recent exercise or heat',
  'Recent cleansing', 'Recent product application', 'Time of day', 'Routine changes',
  'Treatment or medication changes',
];

export function CaptureContract({ kind, onConfirm, onBack }: { kind: CaptureKind; onConfirm: (outcome: CaptureContractOutcome) => void; onBack: () => void }) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const complete = useMemo(() => conditions.every((condition) => confirmed[condition]), [confirmed]);
  const [outcome, setOutcome] = useState<CaptureContractOutcome>(kind === 'baseline' ? 'ready' : 'comparable');
  return (
    <section className={styles.contract} aria-labelledby="capture-contract-heading">
      <button type="button" className={styles.textButton} onClick={onBack}>← Back</button>
      <p className={styles.eyebrow}>{kind.toUpperCase()} CAPTURE CONTRACT</p>
      <h1 id="capture-contract-heading">Confirm what the camera cannot know.</h1>
      <p>Camera readiness may be detected. These contextual conditions remain user-confirmed in this MVP.</p>
      <div className={styles.contractList}>
        {conditions.map((condition) => (
          <label key={condition}>
            <input type="checkbox" checked={Boolean(confirmed[condition])} onChange={(e) => setConfirmed((current) => ({ ...current, [condition]: e.target.checked }))} />
            <span><strong>{condition}</strong><small>Manually confirmed</small></span>
          </label>
        ))}
      </div>
      {kind === 'followup' && (
        <fieldset className={styles.outcomeGroup}>
          <legend>Comparison suitability</legend>
          {(['comparable', 'partially_comparable', 'not_comparable'] as CaptureContractOutcome[]).map((value) => (
            <label key={value}><input type="radio" name="outcome" checked={outcome === value} onChange={() => setOutcome(value)} /><span>{value.replaceAll('_', ' ')}</span></label>
          ))}
        </fieldset>
      )}
      <button type="button" className={styles.primaryAction} disabled={!complete} onClick={() => onConfirm(outcome)}>
        {kind === 'baseline' ? 'Ready to capture' : outcome === 'not_comparable' ? 'Refuse progress comparison' : 'Continue to follow-up'}
      </button>
    </section>
  );
}
