import type { AnalysisResult, EvidenceConfidence } from '../../domain/model';
import styles from '../../styles/FaceValue.module.css';

export function ProgressMode({ result, confidence, lowerConfidence, onContinue, onBack }: { result: AnalysisResult; confidence: EvidenceConfidence; lowerConfidence: boolean; onContinue: () => void; onBack: () => void }) {
  return (
    <section className={styles.progressMode} aria-labelledby="progress-heading">
      <button type="button" className={styles.textButton} onClick={onBack}>← Comparison</button>
      <p className={styles.eyebrow}>PROGRESS MODE · {result.comparison.replaceAll('_', ' ')}</p>
      <h1 id="progress-heading">One finding. One proportionate action.</h1>
      {lowerConfidence && <div className={styles.lowerConfidence} role="status">LOWER CONFIDENCE RETAINED<br /><small>Two products remained active in the observation window.</small></div>}
      <article className={styles.findingPanel}>
        <span>VISIBLE SIGNAL</span><p>{result.visibleSignal}</p>
        <span>FINDING</span><h2>{result.finding}</h2>
        <span>CONFIDENCE</span><p>{confidence}</p>
        <span>NON-FINDING</span><p>{result.nonFinding}</p>
        <span>RELEVANT CONTEXT</span><p>{result.relevantContext}</p>
        <span>WHAT CAN WAIT</span><p>No additional conclusion is needed today.</p>
        <span>CLAIM BOUNDARY</span><p>{result.claimBoundary}</p>
      </article>
      <button className={styles.primaryAction} type="button" onClick={onContinue}>Re-shelve the product <span aria-hidden>→</span></button>
    </section>
  );
}
