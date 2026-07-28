import { useMemo, useState, type FormEvent } from 'react';
import {
  clearDemoJourneyData,
  clearDemoPreview,
  demoJourneyUrl,
  loadDemoJourney,
  saveDemoJourney,
  saveDemoPreview,
  type DemoLaunch,
} from '../../adapters/persistence/demoJourneyStore';
import { buildDemoFixtureState } from './demoFixtureState';
import { DEFERRED_EVIDENCE_RECORD_INTEGRATIONS } from './evidenceRecordDemoAdapter';
import {
  DEMO_RESULT_FIXTURES,
  DEMO_STARTING_POINTS,
  isDemoResultFixtureId,
  isDemoStartingPoint,
  type DemoLaunchMode,
  type DemoResultFixtureId,
  type DemoStartingPoint,
} from '../../domain/demoLab';
import styles from './DemoLab.module.css';

const DEFAULT_STARTING_POINT: DemoStartingPoint = 'followup_ready';
const DEFAULT_RESULT_FIXTURE: DemoResultFixtureId = 'clear_favorable_change';

type Navigate = (url: string) => void;

const browserNavigate: Navigate = (url) => {
  window.location.assign(url);
};

function launchFor(
  mode: DemoLaunchMode,
  startingPoint: DemoStartingPoint,
  resultFixture: DemoResultFixtureId,
): DemoLaunch {
  return {
    mode,
    startingPoint,
    resultFixture,
    state: buildDemoFixtureState(startingPoint, resultFixture),
  };
}

export function DemoLab({ navigate = browserNavigate }: { navigate?: Navigate }) {
  const [mode, setMode] = useState<DemoLaunchMode>('preview');
  const [startingPoint, setStartingPoint] = useState<DemoStartingPoint>(DEFAULT_STARTING_POINT);
  const [resultFixture, setResultFixture] = useState<DemoResultFixtureId>(DEFAULT_RESULT_FIXTURE);
  const [pendingJourney, setPendingJourney] = useState<DemoLaunch | null>(null);
  const [hasDemoJourney, setHasDemoJourney] = useState(() => loadDemoJourney() !== null);
  const [status, setStatus] = useState(
    'Choose a canonical state. Ordinary saved trials will not be changed.',
  );
  const selectedStartingPoint = useMemo(
    () => DEMO_STARTING_POINTS.find(({ id }) => id === startingPoint) ?? DEMO_STARTING_POINTS[0],
    [startingPoint],
  );

  const openSelectedState = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const launch = launchFor(mode, startingPoint, resultFixture);

    if (mode === 'preview') {
      saveDemoPreview(launch);
      setStatus('Opening one-time synthetic preview.');
      navigate('/');
      return;
    }

    setPendingJourney(launch);
    setStatus(
      'Confirm before replacing the isolated Demo Lab journey. Ordinary saved trials remain untouched.',
    );
  };

  const confirmJourney = () => {
    if (!pendingJourney) return;
    saveDemoJourney(pendingJourney);
    setHasDemoJourney(true);
    setStatus('Synthetic demo journey loaded.');
    navigate(demoJourneyUrl());
  };

  const runRealCameraJourney = () => {
    clearDemoPreview();
    setStatus('Opening the ordinary journey without injected capture results.');
    navigate('/');
  };

  const clearDemoData = () => {
    clearDemoJourneyData();
    clearDemoPreview();
    setPendingJourney(null);
    setHasDemoJourney(false);
    setStatus('Demo Lab data cleared. Ordinary saved trials were not changed.');
  };

  return (
    <main className={styles.page} data-fv-screen="demo-lab">
      <header className={styles.brand}>
        <span>FACE VALUE</span>
        <span>INTERNAL · DEVELOPMENT</span>
      </header>

      <section className={styles.instrument} aria-labelledby="demo-lab-heading">
        <div className={styles.heading}>
          <p>CANONICAL INTERNAL INSTRUMENT</p>
          <h1 id="demo-lab-heading">Demo Lab</h1>
          <p>
            Open real Face Value routes from typed synthetic state. No physical capture is implied.
          </p>
        </div>

        <div className={styles.syntheticLabel}>SYNTHETIC DEMO DATA</div>

        <form onSubmit={openSelectedState}>
          <fieldset className={styles.modeGroup}>
            <legend>Mode</legend>
            <label>
              <input
                type="radio"
                name="demo-mode"
                value="preview"
                checked={mode === 'preview'}
                onChange={() => {
                  setMode('preview');
                  setPendingJourney(null);
                }}
              />
              <span>
                <strong>Preview state</strong>
                <small>One-time view. Ordinary persistence is not changed.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="demo-mode"
                value="journey"
                checked={mode === 'journey'}
                onChange={() => setMode('journey')}
              />
              <span>
                <strong>Load demo journey</strong>
                <small>Isolated demo data survives reload for continuity checks.</small>
              </span>
            </label>
          </fieldset>

          <div className={styles.selectField}>
            <label htmlFor="demo-starting-point">Starting point</label>
            <select
              id="demo-starting-point"
              aria-describedby="demo-starting-point-description"
              value={startingPoint}
              onChange={(event) => {
                if (isDemoStartingPoint(event.currentTarget.value)) {
                  setStartingPoint(event.currentTarget.value);
                  setPendingJourney(null);
                }
              }}
            >
              <optgroup label="Frequent">
                {DEMO_STARTING_POINTS.filter(({ frequent }) => frequent).map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="More states">
                {DEMO_STARTING_POINTS.filter(({ frequent }) => !frequent).map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <small id="demo-starting-point-description">{selectedStartingPoint.description}</small>
          </div>

          <div className={styles.selectField}>
            <label htmlFor="demo-result-fixture">Result fixture</label>
            <select
              id="demo-result-fixture"
              aria-describedby="demo-result-fixture-description"
              value={resultFixture}
              onChange={(event) => {
                if (isDemoResultFixtureId(event.currentTarget.value)) {
                  setResultFixture(event.currentTarget.value);
                  setPendingJourney(null);
                }
              }}
            >
              {DEMO_RESULT_FIXTURES.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>
                  {fixture.label}
                </option>
              ))}
            </select>
            <small id="demo-result-fixture-description">
              Canonical evaluator fixtures only. Verdicts cannot be authored here.
            </small>
          </div>

          <button className={styles.openAction} type="submit">
            <span>OPEN DEMO STATE</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        {pendingJourney && (
          <section className={styles.confirmation} aria-labelledby="replace-demo-heading">
            <p>CONFIRM DEMO REPLACEMENT</p>
            <h2 id="replace-demo-heading">Replace isolated demo journey data?</h2>
            <p>
              This replaces Demo Lab data only. It never merges with or deletes ordinary saved
              trials.
            </p>
            <div>
              <button type="button" onClick={confirmJourney}>
                CONFIRM AND LOAD
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingJourney(null);
                  setStatus('Demo journey load cancelled.');
                }}
              >
                CANCEL
              </button>
            </div>
          </section>
        )}

        <section className={styles.utilities} aria-labelledby="demo-utilities-heading">
          <h2 id="demo-utilities-heading">Utilities</h2>
          <button type="button" onClick={runRealCameraJourney}>
            <span>RUN REAL-CAMERA JOURNEY</span>
            <span aria-hidden="true">↗</span>
          </button>
          <button
            type="button"
            className={styles.clearAction}
            onClick={clearDemoData}
            disabled={!hasDemoJourney}
          >
            CLEAR DEMO DATA
          </button>
        </section>

        <section className={styles.pending} aria-labelledby="pending-integration-heading">
          <p>PENDING MAIN-BRANCH INTEGRATION</p>
          <h2 id="pending-integration-heading">Premium Evidence Record disclosures</h2>
          <ul>
            {DEFERRED_EVIDENCE_RECORD_INTEGRATIONS.map((target) => (
              <li key={target.id}>{target.label}</li>
            ))}
          </ul>
          <p>
            These targets remain disconnected until the progressive Evidence Record redesign is
            merged into main.
          </p>
        </section>

        <p className={styles.status} role="status" aria-live="polite">
          {status}
        </p>
      </section>

      <footer className={styles.footer}>
        <span>DEV + VITE_SHOW_DEMO_CONTROLS=true</span>
        <span>NOT CONSUMER NAVIGATION</span>
      </footer>
    </main>
  );
}
