import { useState } from 'react';
import type { AnalysisResult, EvidenceConfidence, Specimen } from '../../domain/model';
import { ScreenHeader } from '../../components/hardware';
import { EvidenceCassette } from './EvidenceCassette';
import styles from './EvidenceVerdict.module.css';

export interface EvidenceVerdictProps {
  specimen: Specimen;
  job: string | null;
  result: AnalysisResult;
  confidence: EvidenceConfidence;
  lowerConfidence: boolean;
  onContinue: () => void;
  onBack: () => void;
}

function getVerdictCopy(result: AnalysisResult, lowerConfidence: boolean) {
  if (lowerConfidence) {
    return {
      title: 'Test it alone.',
      support: 'The signal may be real, but the overlap means this product has not earned a clean verdict yet.',
      action: 'RETRY IT ALONE',
    };
  }

  if (result.recommendedAction === 'keep') {
    return {
      title: 'Earning its place.',
      support: 'The repeated scans show a useful change in the job you gave it. Keep the product and keep the evidence honest.',
      action: 'KEEP IT',
    };
  }

  return {
    title: 'Keep watching.',
    support: 'The evidence is not strong enough to promote or remove this product yet. Give the trial one cleaner comparison.',
    action: 'TEST LONGER',
  };
}

export function EvidenceVerdict({
  specimen,
  job,
  result,
  confidence,
  lowerConfidence,
  onContinue,
  onBack,
}: EvidenceVerdictProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const copy = getVerdictCopy(result, lowerConfidence);
  const resolvedJob = job ?? 'ACTIVE OBSERVATION';

  return (
    <>
      <ScreenHeader dark />
      <section className={styles.verdict} data-fv-screen="progress" aria-labelledby="verdict-heading">
        <div className={styles.context}>
          <span>HONEST VERDICT</span>
          <span>ONE PRODUCT · ONE JOB</span>
        </div>

        <div className={styles.copyBlock}>
          <p className={styles.kicker}>THE PRODUCT HAS AN ANSWER.</p>
          <h1 id="verdict-heading">{copy.title}</h1>
          <p className={styles.support}>{copy.support}</p>

          {lowerConfidence && (
            <p className={styles.confidenceNotice} role="status">
              LOWER CONFIDENCE RETAINED
            </p>
          )}
        </div>

        <div className={styles.hardwareComposition}>
          <EvidenceCassette
            accessionCode={specimen.accession}
            productName={specimen.product}
            job={resolvedJob}
            verdict={copy.title.toUpperCase()}
            onEdit={onBack}
          />
        </div>

        <button
          type="button"
          className={styles.whyButton}
          aria-expanded={whyOpen}
          aria-controls="why-this-verdict"
          onClick={() => setWhyOpen((open) => !open)}
        >
          <span>WHY THIS VERDICT</span>
          <span aria-hidden>{whyOpen ? '−' : '+'}</span>
        </button>

        <div id="why-this-verdict" className={styles.whyPanel} hidden={!whyOpen}>
          <div><span>CONFIDENCE</span><strong>{confidence.toUpperCase()}</strong></div>
          <p>{result.relevantContext}</p>
          <small>{result.claimBoundary}</small>
        </div>

        <button
          type="button"
          className={styles.primaryAction}
          aria-label={`Re-shelve the product — ${copy.action}`}
          onClick={onContinue}
        >
          <span>{copy.action}</span>
          <span aria-hidden>→</span>
        </button>
      </section>
    </>
  );
}
