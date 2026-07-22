import type { AnalysisResult, EvidenceConfidence, Specimen } from '../../domain/model';
import { DrawerLabelPlate, DrawerShell, ProductSpecimen, ScreenHeader } from '../../components/hardware';
import styles from '../../styles/FaceValue.module.css';

export function ProgressMode({ specimen, job, result, confidence, lowerConfidence, onContinue, onBack }: { specimen: Specimen; job: string | null; result: AnalysisResult; confidence: EvidenceConfidence; lowerConfidence: boolean; onContinue: () => void; onBack: () => void }) {
  return (
    <>
      <ScreenHeader dark />
      <section className={styles.progressMode} data-fv-screen="progress" aria-labelledby="progress-heading">
        <div className={styles.directory} data-fv-part="progress-context"><p>{job ?? 'ACTIVE OBSERVATION'}</p><p>PROGRESS</p></div>
        <h1 className={styles.srOnly} id="progress-heading">Progress Mode</h1>
        <DrawerShell state="focused"><ProductSpecimen specimen={specimen} compact /><DrawerLabelPlate specimen={specimen} job={job} state={lowerConfidence ? 'disturbed' : 'settling'} /></DrawerShell>
        <article className={styles.findingPanel} data-fv-part="finding-surface">
          {lowerConfidence && <div className={styles.lowerConfidence} data-fv-part="lower-confidence" role="status">LOWER CONFIDENCE RETAINED<br /><small>Two products remained active in the observation window.</small></div>}
          <span>CURRENT CHANGE</span><h2>{result.finding}</h2>
          <div data-fv-part="finding-meta"><span>CONFIDENCE</span><strong>{confidence.toUpperCase()}</strong></div>
          <span>RELEVANT CONTEXT</span><p>{result.relevantContext}</p>
          <hr />
          <button type="button" data-fv-action="proportionate" onClick={onContinue}><span>NEXT PROPORTIONATE ACTION</span><strong>{lowerConfidence ? 'Retry this product alone before changing placement.' : 'Record one follow-up in similar conditions.'}</strong><b aria-hidden>→</b></button>
          <span>WHAT CAN WAIT</span><p>{result.nonFinding || 'Texture and radiance do not need separate action yet.'}</p>
          <small data-fv-part="claim-boundary">{result.claimBoundary}</small>
        </article>
        <button className={styles.textButton} data-fv-action="progress-back" type="button" onClick={onBack}>← Comparison</button>
      </section>
    </>
  );
}
