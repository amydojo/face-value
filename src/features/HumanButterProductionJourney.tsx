import { useState } from 'react';
import { useFaceValue } from '../app/faceValueContext';
import styles from '../styles/FaceValue.module.css';
import { FaceValueApplication } from './FaceValueApplication';
import { DemoRuntimeBanner } from './demo-lab/DemoRuntimeBanner';
import { DEMO_LAB_ENABLED } from './demo-lab/demoLabAccess';

function DemoSessionRecovery() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside
      role="alert"
      aria-label="Analysis access required"
      style={{
        position: 'fixed',
        zIndex: 1000,
        left: 16,
        right: 16,
        bottom: 16,
        width: 'calc(100% - 32px)',
        maxWidth: 520,
        margin: '0 auto',
        padding: 18,
        border: '1px solid rgba(20, 18, 15, 0.24)',
        background: '#f4f1ea',
        boxShadow: '0 18px 48px rgba(20, 18, 15, 0.24)',
      }}
    >
      <p className={styles.eyebrow}>ANALYSIS ACCESS REQUIRED</p>
      <strong>Open the protected session in a new tab.</strong>
      <p>Your capture stays safely staged here. Open access, return to this tab, then tap Retry analysis.</p>
      <a
        className={styles.primaryAction}
        href="/youcam-spike?return=trial"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        OPEN ANALYSIS ACCESS
      </a>
      <button
        type="button"
        className={styles.secondaryAction}
        onClick={() => setDismissed(true)}
      >
        I OPENED ACCESS
      </button>
    </aside>
  );
}

export function HumanButterProductionJourney() {
  const { state, dispatch, demoRuntime } = useFaceValue();

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

  const needsDemoSession =
    state.stage === 'camera' &&
    state.analysisError?.code === 'unauthorized_demo_session';

  return (
    <>
      <FaceValueApplication />
      {DEMO_LAB_ENABLED && demoRuntime.mode !== 'ordinary' && (
        <DemoRuntimeBanner runtime={demoRuntime} />
      )}
      {needsDemoSession && <DemoSessionRecovery />}
    </>
  );
}
