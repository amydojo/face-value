import { useFaceValue } from '../app/faceValueContext';
import styles from '../styles/FaceValue.module.css';
import { FaceValueApplication } from './FaceValueApplication';
import { HumanButterEvidenceMachineScreen } from './evidence-machine/HumanButterEvidenceMachineScreen';

export function HumanButterProductionJourney() {
  const { state, dispatch } = useFaceValue();

  if (state.stage === 'placement' || state.stage === 'record') {
    return <HumanButterEvidenceMachineScreen />;
  }

  if (state.stage === 'comparison_refused' && state.analysisError?.code === 'protocol_mismatch') {
    return (
      <main>
        <section className={styles.failureScreen} data-fv-screen="comparison-refused">
          <p className={styles.eyebrow}>COMPARISON UNAVAILABLE</p>
          <h1 data-stage-focus tabIndex={-1}>Comparison unavailable</h1>
          <p>These scans could not be compared under the same conditions.</p>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => dispatch({ type: 'RETAKE_FOLLOWUP' })}
          >
            RETRY UNDER MATCHED CONDITIONS
          </button>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => dispatch({ type: 'RETURN_TO_CABINET' })}
          >
            Your trials
          </button>
        </section>
      </main>
    );
  }

  return <FaceValueApplication />;
}
