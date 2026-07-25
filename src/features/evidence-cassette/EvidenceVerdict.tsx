import { useState } from 'react';
import type { AnalysisResult, EvidenceConfidence, ProductPlacement, Specimen } from '../../domain/model';
import { ScreenHeader } from '../../components/hardware';
import { EvidenceCassette } from './EvidenceCassette';
import styles from './EvidenceVerdict.module.css';

type VerdictPlacement = Extract<ProductPlacement, 'established' | 'paused' | 'retry_alone'>;

export interface EvidenceVerdictProps {
  specimen: Specimen;
  job: string | null;
  result: AnalysisResult;
  confidence: EvidenceConfidence;
  lowerConfidence: boolean;
  recommendedPlacement: VerdictPlacement;
  onContinue: (placement: VerdictPlacement) => void;
  onBack: () => void;
}

function getResultCopy(placement: VerdictPlacement) {
  if (placement === 'retry_alone') {
    return {
      title: 'Test it alone.',
      support: 'Your skin changed, but two products shared the trial. We cannot honestly credit this one yet.',
      action: 'RETRY IT ALONE',
    };
  }

  if (placement === 'established') {
    return {
      title: 'Earning its place.',
      support: 'The repeat scans show a useful change in the job you gave it. This product has earned a place for now.',
      action: 'KEEP IT',
    };
  }

  return {
    title: 'Keep watching.',
    support: 'The scans do not show a reliable enough change yet. Give this trial one cleaner comparison.',
    action: 'TEST LONGER',
  };
}

export function EvidenceVerdict({
  specimen,
  job,
  result,
  confidence,
  lowerConfidence,
  recommendedPlacement,
  onContinue,
  onBack,
}: EvidenceVerdictProps) {
  const [whyOpen, setWhyOpen] = useState(false);
  const copy = getResultCopy(recommendedPlacement);
  const resolvedJob = job ?? 'TRIAL IN PROGRESS';

  return (
    <>
      <ScreenHeader dark />
      <section
        className={styles.verdict}
        data-fv-screen="result"
        data-fv-recommended-placement={recommendedPlacement}
        aria-labelledby="result-heading"
      >
        <div className={styles.context}>
          <span>RESULT</span>
          <span>ONE PRODUCT · ONE JOB</span>
        </div>

        <div className={styles.copyBlock}>
          <p className={styles.kicker}>YOUR TRIAL HAS AN ANSWER.</p>
          <h1 id="result-heading" data-stage-focus tabIndex={-1}>{copy.title}</h1>
          <p className={styles.support}>{copy.support}</p>
          {lowerConfidence && <p className={styles.confidenceNotice} role="status">THE RESULT IS LESS CERTAIN</p>}
        </div>

        <div className={styles.hardwareComposition}>
          <EvidenceCassette
            accessionCode={specimen.accession}
            productName={specimen.product}
            volume={specimen.volume}
            job={resolvedJob}
            verdict={copy.title.toUpperCase()}
            onEdit={onBack}
          />
        </div>

        <button
          type="button"
          className={styles.whyButton}
          aria-expanded={whyOpen}
          aria-controls="why-this-result"
          onClick={() => setWhyOpen((open) => !open)}
        >
          <span>SEE WHY</span><span aria-hidden>{whyOpen ? '−' : '+'}</span>
        </button>

        <div id="why-this-result" className={styles.whyPanel} hidden={!whyOpen}>
          <div><span>CONFIDENCE</span><strong>{confidence.toUpperCase()}</strong></div>
          <p>{result.relevantContext}</p>
          <small>{result.claimBoundary}</small>
        </div>

        <button
          type="button"
          className={styles.primaryAction}
          aria-label={`Accept recommended next step — ${copy.action}`}
          onClick={() => onContinue(recommendedPlacement)}
        >
          <span>{copy.action}</span><span aria-hidden>→</span>
        </button>
      </section>
    </>
  );
}
