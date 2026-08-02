import { useMemo, useState } from 'react';
import {
  appendRednessCalibrationObservation,
  clearRednessCalibrationData,
  exportRednessCalibrationData,
  loadRednessCalibrationData,
  parseRednessCalibrationExport,
  saveRednessCalibrationData,
  type RednessCalibrationHydration,
} from '../../adapters/persistence/rednessCalibrationStore';
import {
  syntheticRednessCalibrationFixtures,
  type RednessCalibrationConditionType,
  type RednessCalibrationObservation,
} from '../../domain/calibration/redness';
import {
  buildRednessCalibrationInstrumentViewModel,
  buildRednessCalibrationRegistryExport,
} from './rednessCalibrationViewModel';
import { RednessCalibrationCollector } from './RednessCalibrationCollector';
import type { RednessCalibrationCollectionDependencies } from './rednessCalibrationCollection';
import styles from './RednessCalibration.module.css';

type PendingReplacement = 'clear' | 'synthetic' | 'import' | null;

const browserClock = (): string => new Date().toISOString();

function observationList(hydration: RednessCalibrationHydration): RednessCalibrationObservation[] {
  return hydration.status === 'ready' ? hydration.envelope.observations : [];
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof buildRednessCalibrationInstrumentViewModel>['breakdowns']['devices'];
}) {
  return (
    <section className={styles.breakdown}>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p>Not estimable.</p>
      ) : (
        <div className={styles.tableViewport}>
          <table>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Evidence</th>
                <th scope="col">Eligibility</th>
                <th scope="col">Rejection</th>
                <th scope="col">Repeated-capture range</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.key}</th>
                  <td>{row.observations}</td>
                  <td>{row.eligibility}</td>
                  <td>{row.rejectionRate}</td>
                  <td>{row.repeatedCaptureRange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RednessCalibration({
  storage = localStorage,
  now = browserClock,
  collectionDependencies,
}: {
  storage?: Storage;
  now?: () => string;
  collectionDependencies?: RednessCalibrationCollectionDependencies;
}) {
  const [hydration, setHydration] = useState(() => loadRednessCalibrationData(storage));
  const [status, setStatus] = useState(
    'No live provider request has been made. Synthetic face-free fixtures are available for verification.',
  );
  const [pendingReplacement, setPendingReplacement] = useState<PendingReplacement>(null);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const observations = observationList(hydration);
  const viewModel = useMemo(
    () => buildRednessCalibrationInstrumentViewModel(observations),
    [observations],
  );
  const selectedSession =
    viewModel.sessions.find(({ observationId }) => observationId === selectedObservationId) ??
    viewModel.sessions[0] ??
    null;

  const refresh = () => setHydration(loadRednessCalibrationData(storage));
  const persist = (next: RednessCalibrationObservation[], message: string) => {
    try {
      saveRednessCalibrationData(next, storage, now());
      refresh();
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Calibration storage failed closed.');
    }
  };
  const addSyntheticCondition = (conditionType: RednessCalibrationConditionType) => {
    const fixtureSet = syntheticRednessCalibrationFixtures();
    const selected = fixtureSet.filter(({ participantId, conditionType: fixtureCondition }) => {
      if (participantId !== 'P-001') return false;
      return fixtureCondition === conditionType;
    }).filter((observation) => (
      conditionType !== 'standard'
      || (
        observation.captureOutcome === 'accepted'
        && observation.preCaptureContext.productRoutineState === 'no_intervention'
        && observation.confounders.length === 0
      )
    ));
    const existingIds = new Set(observations.map(({ observationId }) => observationId));
    const additions = selected.filter(({ observationId }) => !existingIds.has(observationId));
    if (additions.length === 0) {
      setStatus(`The synthetic ${conditionType.replaceAll('_', ' ')} fixtures are already stored.`);
      return;
    }
    persist(
      [...observations, ...additions],
      `Added ${additions.length} explicitly synthetic, face-free ${conditionType.replaceAll('_', ' ')} observation${additions.length === 1 ? '' : 's'}.`,
    );
  };
  const requestSyntheticDataset = () => {
    if (observations.length > 0) {
      setPendingReplacement('synthetic');
      return;
    }
    persist(
      syntheticRednessCalibrationFixtures(),
      'Loaded the complete deterministic synthetic face-free calibration dataset.',
    );
  };
  const prepareObservationExport = () => {
    try {
      setExportText(exportRednessCalibrationData(observations, now()));
      setStatus('Prepared a canonical face-free observation export. No image or provider payload is included.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The observation export failed closed.');
    }
  };
  const persistCompletedLiveObservation = (observation: RednessCalibrationObservation) => {
    appendRednessCalibrationObservation(observation, storage, now());
    refresh();
    setSelectedObservationId(observation.observationId);
  };
  const prepareRegistryExport = async () => {
    try {
      setExportText(await buildRednessCalibrationRegistryExport(observations, now()));
      setStatus('Prepared an exploratory registry export. It is not approved or active in production.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The registry export could not be prepared.');
    }
  };
  const requestImport = () => {
    try {
      parseRednessCalibrationExport(importText);
      setPendingReplacement('import');
      setStatus('The face-free import validated. Confirm before replacing isolated calibration data.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The calibration import was rejected.');
    }
  };
  const confirmReplacement = () => {
    try {
      if (pendingReplacement === 'clear') {
        clearRednessCalibrationData(storage);
        setExportText('');
        setSelectedObservationId(null);
        setStatus('Calibration data cleared. Consumer and Demo Lab storage were not changed.');
      } else if (pendingReplacement === 'synthetic') {
        saveRednessCalibrationData(syntheticRednessCalibrationFixtures(), storage, now());
        setStatus('Replaced isolated calibration data with the complete synthetic face-free dataset.');
      } else if (pendingReplacement === 'import') {
        saveRednessCalibrationData(parseRednessCalibrationExport(importText), storage, now());
        setStatus('Imported validated face-free observations into isolated calibration storage.');
      }
      setPendingReplacement(null);
      refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The calibration operation failed closed.');
    }
  };

  return (
    <main className={styles.page} data-fv-screen="redness-calibration">
      <header className={styles.brand}>
        <span>FACE VALUE</span>
        <span>INTERNAL · ENGINEERING SESSION</span>
      </header>

      <section className={styles.hero} aria-labelledby="redness-calibration-heading">
        <a href="/demo">← Demo Lab</a>
        <p>TECHNICAL REPEATABILITY · NOT CLINICAL VALIDITY</p>
        <h1 id="redness-calibration-heading">Redness calibration</h1>
        <p>
          Preliminary internal estimates from isolated, face-free observations. This does not
          establish clinical efficacy or a clinically meaningful change.
        </p>
      </section>

      <RednessCalibrationCollector
        dependencies={collectionDependencies}
        disabled={hydration.status === 'corrupt'}
        onCompleted={persistCompletedLiveObservation}
        onStatus={setStatus}
      />

      {hydration.status === 'corrupt' && (
        <section className={styles.quarantine} role="alert" aria-labelledby="quarantine-heading">
          <p>FAIL-CLOSED STORAGE</p>
          <h2 id="quarantine-heading">Calibration data quarantined</h2>
          <p>No statistics or exports will use the incompatible data.</p>
          <ul>
            {hydration.quarantine.flatMap((entry, entryIndex) =>
              entry.issues.map((issue, issueIndex) => (
                <li key={`${entryIndex}-${issueIndex}`}>
                  {entry.observationId ?? 'Envelope'} · {issue.code} · {issue.detail}
                </li>
              )),
            )}
          </ul>
          <button
            type="button"
            className={styles.dangerAction}
            onClick={() => setPendingReplacement('clear')}
          >
            CLEAR QUARANTINED CALIBRATION DATA
          </button>
        </section>
      )}

      <section className={styles.syntheticControls} aria-labelledby="synthetic-controls-heading">
        <div>
          <p>SYNTHETIC FACE-FREE FIXTURES</p>
          <h2 id="synthetic-controls-heading">Deterministic verification data</h2>
          <p>
            These controls never call YouCam and never claim physical capture. Stored observations
            are explicitly labeled synthetic.
          </p>
        </div>
        <div className={styles.controlGrid}>
          <button
            type="button"
            disabled={hydration.status === 'corrupt'}
            onClick={() => addSyntheticCondition('standard')}
          >
            ADD SYNTHETIC STANDARD RECAPTURES
          </button>
          <button
            type="button"
            disabled={hydration.status === 'corrupt'}
            onClick={() => addSyntheticCondition('no_treatment_longitudinal')}
          >
            ADD SYNTHETIC NO-TREATMENT SESSIONS
          </button>
          <button
            type="button"
            disabled={hydration.status === 'corrupt'}
            onClick={() => addSyntheticCondition('degraded')}
          >
            ADD SYNTHETIC DEGRADED SESSION
          </button>
          <button
            type="button"
            className={styles.primaryAction}
            disabled={hydration.status === 'corrupt'}
            onClick={requestSyntheticDataset}
          >
            LOAD COMPLETE SYNTHETIC DATASET
          </button>
        </div>
      </section>

      {hydration.status !== 'corrupt' && (
        <>
          <section className={styles.dashboard} aria-labelledby="dashboard-heading">
            <div className={styles.sectionHeading}>
              <p>ANSWER-FIRST INTERNAL INSTRUMENT</p>
              <h2 id="dashboard-heading">Calibration dashboard</h2>
            </div>
            <div className={styles.metricGrid}>
              {viewModel.metrics.map((metric) => (
                <article key={metric.id} data-metric={metric.id} data-estimate-status={metric.status}>
                  <p>{metric.preliminaryLabel}</p>
                  <h3>{metric.title}</h3>
                  <strong>{metric.value}</strong>
                  <span>{metric.detail}</span>
                </article>
              ))}
            </div>
            <p className={styles.boundaryNote}>
              Production thresholds remain provisional: detectable boundary 5, strong boundary 10,
              source <code>provisional_fixture</code>. Technical repeatability does not establish
              clinical validity.
            </p>
          </section>

          <section className={styles.candidates} aria-labelledby="candidate-heading">
            <div className={styles.sectionHeading}>
              <p>DISPLAY ONLY · NEVER APPROVED HERE</p>
              <h2 id="candidate-heading">Threshold candidate comparison</h2>
            </div>
            <div className={styles.tableViewport}>
              <table>
                <caption>
                  Current provisional consumer boundaries compared with exploratory candidates
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Candidate</th>
                    <th scope="col">Authority</th>
                    <th scope="col">Status</th>
                    <th scope="col">Detectable</th>
                    <th scope="col">Strong</th>
                    <th scope="col">False change</th>
                    <th scope="col">Classifications</th>
                  </tr>
                </thead>
                <tbody>
                  {viewModel.candidates.map((candidate) => (
                    <tr key={candidate.id} data-candidate={candidate.id}>
                      <th scope="row">{candidate.label}</th>
                      <td>{candidate.authority}</td>
                      <td>{candidate.status}</td>
                      <td>{candidate.detectableBoundary}</td>
                      <td>{candidate.strongBoundary}</td>
                      <td>{candidate.falseChange}</td>
                      <td>{candidate.classifications}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.sessionInstrument} aria-labelledby="capture-session-heading">
            <div className={styles.sectionHeading}>
              <p>SAVED FACE-FREE OBSERVATIONS</p>
              <h2 id="capture-session-heading">Capture session view</h2>
            </div>
            {viewModel.sessions.length === 0 ? (
              <p>No calibration observations stored.</p>
            ) : (
              <>
                <label htmlFor="calibration-session">Inspect observation</label>
                <select
                  id="calibration-session"
                  value={selectedSession?.observationId ?? ''}
                  onChange={(event) => setSelectedObservationId(event.currentTarget.value)}
                >
                  {viewModel.sessions.map((session) => (
                    <option key={session.observationId} value={session.observationId}>
                      {session.participantId} · {session.conditionType} · {session.captureTimestamp}
                    </option>
                  ))}
                </select>
                {selectedSession && (
                  <article className={styles.sessionCard} data-observation={selectedSession.observationId}>
                    <header>
                      <div>
                        <p>{selectedSession.collectionSource}</p>
                        <h3>{selectedSession.participantId} · {selectedSession.sessionId}</h3>
                      </div>
                      <span>{selectedSession.captureQuality}</span>
                    </header>
                    <dl>
                      <div><dt>Condition</dt><dd>{selectedSession.conditionType} · {selectedSession.conditionId}</dd></div>
                      <div><dt>Captured</dt><dd>{selectedSession.captureTimestamp}</dd></div>
                      <div><dt>Device</dt><dd>{selectedSession.deviceClass}</dd></div>
                      <div><dt>Accepted frames</dt><dd>{selectedSession.acceptedFrameCount}</dd></div>
                      <div><dt>Rejected frames</dt><dd>{selectedSession.rejectedFrameCount}</dd></div>
                      <div><dt>Raw redness scores</dt><dd>{selectedSession.rawScores}</dd></div>
                      <div><dt>Saved median</dt><dd>{selectedSession.median}</dd></div>
                      <div><dt>Saved range</dt><dd>{selectedSession.range}</dd></div>
                      <div><dt>Direction agreement</dt><dd>{selectedSession.directionAgreement}</dd></div>
                      <div><dt>Rejection reasons</dt><dd>{selectedSession.rejectionReasons}</dd></div>
                      <div><dt>Confounders</dt><dd>{selectedSession.confounders}</dd></div>
                    </dl>
                    <details>
                      <summary>Version metadata and unavailable fields</summary>
                      <dl>
                        {selectedSession.versions.map((row) => (
                          <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                        ))}
                        {selectedSession.unavailableMetrics.map((row) => (
                          <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                        ))}
                        <div><dt>Measured skin-tone audit group</dt><dd>{selectedSession.measuredSkinToneAuditGroup}</dd></div>
                      </dl>
                    </details>
                  </article>
                )}
              </>
            )}
          </section>

          <section className={styles.timeline} aria-labelledby="timeline-heading">
            <div className={styles.sectionHeading}>
              <p>NO-TREATMENT SESSION REVIEW</p>
              <h2 id="timeline-heading">Participant timeline</h2>
            </div>
            {viewModel.timeline.length === 0 ? (
              <p>No participant sessions stored.</p>
            ) : (
              viewModel.timeline.map((participant) => (
                <article key={participant.participantId}>
                  <h3>{participant.participantId}</h3>
                  <ol>
                    {participant.sessions.map((session) => (
                      <li key={session.observationId}>
                        <strong>{session.timestamp} · {session.conditionType}</strong>
                        <span>Median {session.median} · range {session.range}</span>
                        <span>{session.confounders}</span>
                        <span>{session.deviceAndVersion}</span>
                      </li>
                    ))}
                  </ol>
                  <h4>No-treatment session-to-session differences</h4>
                  {participant.longitudinalDifferences.length > 0 ? (
                    <ul>
                      {participant.longitudinalDifferences.map((difference) => (
                        <li key={difference}>{difference}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>Not estimable · no matched no-treatment session pair.</p>
                  )}
                </article>
              ))
            )}
          </section>

          <section className={styles.exclusions} aria-labelledby="exclusion-heading">
            <div className={styles.sectionHeading}>
              <p>INVALID EVIDENCE REMAINS VISIBLE</p>
              <h2 id="exclusion-heading">Exclusion inspection</h2>
            </div>
            {viewModel.exclusions.length === 0 ? (
              <p>No excluded observations.</p>
            ) : (
              <ul>
                {viewModel.exclusions.map((exclusion) => (
                  <li key={exclusion.observationId}>
                    <strong>{exclusion.observationId}</strong>
                    <span>{exclusion.participantId} · {exclusion.sessionId}</span>
                    <span>{exclusion.reasons.join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.breakdowns} aria-labelledby="breakdowns-heading">
            <div className={styles.sectionHeading}>
              <p>REJECTION AND RANGE BREAKDOWNS</p>
              <h2 id="breakdowns-heading">Technical strata</h2>
            </div>
            <BreakdownTable title="Device class" rows={viewModel.breakdowns.devices} />
            <BreakdownTable title="API version" rows={viewModel.breakdowns.apiVersions} />
            <BreakdownTable title="Analysis model version" rows={viewModel.breakdowns.modelVersions} />
            <BreakdownTable title="Standard vs degraded condition" rows={viewModel.breakdowns.conditions} />
            {viewModel.breakdowns.measuredSkinTone.status === 'not_collected' ? (
              <p className={styles.skinToneStatus}>
                <strong>Measured skin-tone breakdown</strong>
                Not collected. No automated skin-tone inference is used.
              </p>
            ) : (
              <>
                <BreakdownTable
                  title="Validated measured skin-tone audit group"
                  rows={viewModel.breakdowns.measuredSkinTone.groups}
                />
                <p className={styles.skinToneStatus}>
                  Validated audit inputs only. No automated skin-tone inference is used.
                </p>
              </>
            )}
          </section>

          <section className={styles.dataControls} aria-labelledby="data-controls-heading">
            <div className={styles.sectionHeading}>
              <p>ISOLATED LOCAL DATA</p>
              <h2 id="data-controls-heading">Export, import, and clear</h2>
            </div>
            <p>
              Exports contain non-image observations or one exploratory registry entry only. They
              never contain URLs, blobs, provider task IDs, raw payloads, names, or emails.
            </p>
            <div className={styles.controlGrid}>
              <button type="button" onClick={prepareObservationExport}>
                PREPARE FACE-FREE OBSERVATION EXPORT
              </button>
              <button type="button" onClick={() => void prepareRegistryExport()}>
                PREPARE EXPLORATORY REGISTRY EXPORT
              </button>
              <button type="button" className={styles.dangerAction} onClick={() => setPendingReplacement('clear')}>
                CLEAR CALIBRATION DATA
              </button>
            </div>
            <label htmlFor="calibration-export">Canonical export</label>
            <textarea
              id="calibration-export"
              value={exportText}
              readOnly
              placeholder="Prepare an export to inspect canonical JSON here."
            />
            <label htmlFor="calibration-import">Face-free observation import</label>
            <textarea
              id="calibration-import"
              value={importText}
              onChange={(event) => setImportText(event.currentTarget.value)}
              placeholder="Paste a Face Value redness calibration observation export."
            />
            <button type="button" disabled={!importText.trim()} onClick={requestImport}>
              VALIDATE IMPORT FOR REPLACEMENT
            </button>
          </section>
        </>
      )}

      {pendingReplacement && (
        <section
          className={styles.confirmation}
          role="dialog"
          aria-modal="true"
          aria-labelledby="replacement-heading"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPendingReplacement(null);
          }}
        >
          <p>CONFIRM ISOLATED DATA CHANGE</p>
          <h2 id="replacement-heading">
            {pendingReplacement === 'clear'
              ? 'Clear all redness calibration data?'
              : 'Replace isolated redness calibration data?'}
          </h2>
          <p>Consumer trials, Previous Trials, and Demo Lab data will remain untouched.</p>
          <div>
            <button type="button" className={styles.dangerAction} onClick={confirmReplacement}>
              CONFIRM CALIBRATION DATA CHANGE
            </button>
            <button type="button" autoFocus onClick={() => setPendingReplacement(null)}>CANCEL</button>
          </div>
        </section>
      )}

      <p className={styles.status} role="status" aria-live="polite">{status}</p>
      <footer className={styles.footer}>
        <span>EXPLORATORY · APPROVED BY NONE</span>
        <span>FACE-FREE LOCAL STORAGE ONLY</span>
      </footer>
    </main>
  );
}
