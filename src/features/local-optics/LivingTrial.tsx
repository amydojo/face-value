import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { FaceValueActuator } from '../../components/FaceValueActuator';
import { LocalOptics, type TrialCapture } from './LocalOptics';
import type { OpticsSessionDeps } from './opticsSession';
import {
  ARCHIVE_DAYS,
  archivedKeys,
  archiveUnreadable,
  baselineMeasurement,
  browserStorage,
  canWrite,
  checkInFromComparison,
  deleteTrialData,
  loadTrial,
  MAX_NAME,
  MAX_OUTCOME,
  newTrial,
  purgeExpiredArchives,
  recordCheckIn,
  saveTrial,
  touched,
  TRIAL_PLAN_DAYS,
  TRIAL_RETENTION_DAYS,
  trialDay,
  withBaseline,
  withConsent,
  type CheckIn,
  type ConditionReason,
  type SaveError,
  type TrialRecord,
  type TrialStorage,
} from './trialStore';
import styles from './LivingTrial.module.css';

// The Living Trial: one product, one intended outcome, a baseline and check-ins, kept on this
// device only if the person chooses to. It checks that each check-in was captured in conditions
// that match the baseline. It does not measure skin and never says whether the product worked.

type Screen =
  | { kind: 'loading' }
  | { kind: 'start' }
  | { kind: 'capture'; purpose: 'baseline' | 'check_in'; key: number }
  | { kind: 'baseline_done'; error: SaveError | null; saving: boolean }
  | { kind: 'home' }
  | { kind: 'check_in_done'; checkIn: CheckIn; number: number; save: 'saved' | 'unsaved' | SaveError }
  | { kind: 'review' }
  | { kind: 'manage'; confirm: boolean; error: string | null }
  | { kind: 'unreadable'; reason: 'corrupt' | 'incompatible'; raw: string; confirm: boolean; error: string | null }
  | { kind: 'expired'; inactiveDays: number; error: string | null };

const OUTCOMES = ['Reduce visible redness', 'More even tone', 'Less dryness', 'Fewer breakouts'];
const OTHER = 'Something else';

const REASON_COPY: Record<ConditionReason, string> = {
  light: 'The light was different',
  distance: 'The phone was nearer or farther',
  position: 'Your face sat elsewhere in the frame',
  angle: 'Your head was at a different angle',
  framing: 'The phone was held a different way',
};

const CONDITIONS_COPY: Record<CheckIn['conditions'], string> = {
  matched: 'Conditions matched',
  not_matched: 'Conditions didn’t match',
  unconfirmed: 'Conditions not confirmed',
};

const SHORT_CONDITIONS: Record<CheckIn['conditions'], string> = {
  matched: 'Matched',
  not_matched: 'Didn’t match',
  unconfirmed: 'Not confirmed',
};

const SAVE_ERROR_COPY: Record<SaveError, string> = {
  unavailable: 'This browser isn’t allowing Face Value to save (Private Browsing, or website data is blocked).',
  blocked: 'Safari blocked saving website data.',
  quota: 'This device’s website storage is full.',
  verify: 'The save couldn’t be confirmed, so it may not have been kept.',
  invalid: 'The trial data didn’t pass its own checks, so it wasn’t saved.',
  conflict: 'Another trial is already saved in this browser, perhaps from another tab. Nothing was overwritten.',
};

const newId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function elapsedLabel(iso: string, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, 'hour') + ' ago';
  return plural(Math.round(hours / 24), 'day') + ' ago';
}

export function LivingTrial({
  deps,
  storage: injected,
  clock = () => new Date(),
}: {
  deps?: OpticsSessionDeps;
  storage?: TrialStorage | null;
  clock?: () => Date;
} = {}) {
  const storage = useMemo(() => (injected === undefined ? browserStorage() : injected), [injected]);
  /** False where nothing can be saved: the trial then lasts only for this tab, and says so. */
  const writable = useMemo(() => canWrite(storage), [storage]);
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [trial, setTrial] = useState<TrialRecord | null>(null);
  const [returning, setReturning] = useState(false);
  /** A saved trial whose latest change could not be saved. */
  const [dirty, setDirty] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const captures = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const saved = Boolean(trial?.consent);

  useEffect(() => {
    if (writable) purgeExpiredArchives(storage, clock());
    const result = loadTrial(storage, clock());
    if (result.status === 'ok') {
      setTrial(result.trial);
      setReturning(true);
      setScreen({ kind: 'home' });
    } else if (result.status === 'expired') {
      setTrial(result.trial);
      setScreen({ kind: 'expired', inactiveDays: result.inactiveDays, error: null });
    } else if (result.status === 'unreadable') {
      setScreen({ kind: 'unreadable', reason: result.reason, raw: result.raw, confirm: false, error: null });
    } else {
      setScreen({ kind: 'start' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once when the page opens
  }, [storage]);

  // Each new screen moves focus to its heading, so screen readers announce where they are.
  useEffect(() => {
    if (screen.kind !== 'capture' && screen.kind !== 'loading') heading.current?.focus({ preventScroll: false });
    if (screen.kind !== 'capture') window.scrollTo?.(0, 0);
  }, [screen.kind]);

  const outcome = choice === OTHER ? other.trim() : (choice ?? '');
  const ready = name.trim().length > 0 && outcome.length > 0;

  const capture = (purpose: 'baseline' | 'check_in') => {
    captures.current += 1;
    setBanner(null);
    setScreen({ kind: 'capture', purpose, key: captures.current });
  };

  const startTrial = () => {
    if (!ready) return;
    setTrial(newTrial({ name, outcome }, clock(), newId()));
    setReturning(false);
    capture('baseline');
  };

  const goHome = (message: string | null = null) => {
    setReturning(false);
    setBanner(message);
    setScreen({ kind: 'home' });
  };

  /** Saves only after the person chose to; claims success only after the saved copy is read back. */
  const save = (onError: (error: SaveError) => void) => {
    if (!trial) return;
    const next = trial.consent ? touched(trial, clock()) : withConsent(trial, clock());
    const result = saveTrial(storage, next);
    if (result.ok) {
      setTrial(next);
      setDirty(false);
      goHome('Saved on this device.');
    } else {
      onError(result.error);
    }
  };

  const trialCapture: TrialCapture | null =
    trial && screen.kind === 'capture'
      ? {
          baseline: trial.baseline ? { template: trial.baseline.guide, measurement: baselineMeasurement(trial.baseline) } : null,
          onBaseline: ({ template, frame, trigger }) => {
            setTrial(withBaseline(trial, template, frame, trigger, clock()));
            setScreen({ kind: 'baseline_done', error: writable ? null : 'unavailable', saving: false });
          },
          onFollowUp: ({ comparison, trigger }) => {
            const now = clock();
            const checkIn = checkInFromComparison(comparison, trigger, now);
            const { trial: next, save: result } = recordCheckIn(storage, trial, checkIn, now);
            setTrial(next); // kept in this tab even if the save failed
            setDirty(Boolean(result && !result.ok));
            setScreen({
              kind: 'check_in_done',
              checkIn,
              number: next.checkIns.length,
              save: result === null ? 'unsaved' : result.ok ? 'saved' : result.error,
            });
          },
          onExit: () => (trial.baseline ? goHome() : setScreen({ kind: 'start' })),
        }
      : null;

  if (screen.kind === 'capture' && trialCapture) {
    return (
      <div data-living-trial data-screen="capture" data-purpose={screen.purpose}>
        <LocalOptics key={screen.key} deps={deps} trial={trialCapture} />
      </div>
    );
  }

  const day = trial ? trialDay(trial, clock()) : 1;
  const last = trial?.checkIns.at(-1) ?? null;
  const matched = trial?.checkIns.filter((c) => c.conditions === 'matched').length ?? 0;

  let body: ReactNode = null;
  switch (screen.kind) {
    case 'loading':
    case 'capture':
      body = null;
      break;

    case 'start':
      body = (
        <Frame
          eyebrow="Living trial"
          title="One product. One claim."
          heading={heading}
          primary={{ label: 'Capture baseline', action: startTrial, disabled: !ready, actuator: 'ready' }}
          note={writable ? null : 'This browser can’t save website data right now, so this trial will last only while this tab is open.'}
          banner={banner}
        >
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              startTrial();
            }}
          >
            <label className={styles.field}>
              <span className={styles.label}>Product</span>
              <input
                className={styles.input}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_NAME}
                placeholder="e.g. Azelaic acid serum"
                autoComplete="off"
                enterKeyHint="done"
              />
            </label>
            <fieldset className={styles.field}>
              <legend className={styles.label}>What should it do?</legend>
              <div className={styles.chips}>
                {[...OUTCOMES, OTHER].map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={choice === option}
                    className={styles.chip}
                    onClick={() => setChoice(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {choice === OTHER && (
                <input
                  className={styles.input}
                  value={other}
                  onChange={(event) => setOther(event.target.value)}
                  maxLength={MAX_OUTCOME}
                  placeholder="The one change you expect"
                  aria-label="Intended outcome"
                  autoFocus
                />
              )}
            </fieldset>
          </form>
          <dl className={styles.facts}>
            <div>
              <dt>{TRIAL_PLAN_DAYS} days</dt>
              <dd>A baseline today, then a check-in whenever you like. Once a week works well.</dd>
            </div>
            <div>
              <dt>Fair comparisons</dt>
              <dd>Each check-in confirms the distance, angle and light match your baseline.</dd>
            </div>
            <div>
              <dt>Not a skin test</dt>
              <dd>This version doesn’t measure your skin or judge the product.</dd>
            </div>
            <div>
              <dt>Camera next</dt>
              <dd>Frames stay in this tab’s memory and are never uploaded or saved.</dd>
            </div>
          </dl>
        </Frame>
      );
      break;

    case 'baseline_done':
      body = (
        <Frame
          eyebrow="Baseline"
          title="Baseline captured"
          heading={heading}
          mark="done"
          primary={
            screen.error === 'unavailable'
              ? { label: 'Continue without saving', action: () => goHome() }
              : {
                  label: screen.error ? 'Try saving again' : 'Save trial on this device',
                  action: () => save((error) => setScreen({ kind: 'baseline_done', error, saving: false })),
                  disabled: screen.saving,
                  actuator: 'captured',
                }
          }
          secondary={screen.error === 'unavailable' ? null : { label: screen.error ? 'Continue without saving' : 'Don’t save', action: () => goHome() }}
        >
          <p className={styles.text}>
            This is your optical reference: the distance, angle and light your check-ins will return to. It isn’t a reading of your skin.
          </p>
          {screen.error && (
            <p className={styles.error} role="alert" data-save-error={screen.error}>
              <strong>Not saved.</strong> {SAVE_ERROR_COPY[screen.error]}
            </p>
          )}
          {screen.error !== 'unavailable' && (
          <section className={styles.card} aria-label="About saving">
            <p className={styles.cardTitle}>Keep this trial on this phone?</p>
            <ul className={styles.list}>
              <li>Kept in this browser on this device only. Not backed up, synced or encrypted.</li>
              <li>Saved: the product, its claim, dates, and ten rounded numbers for framing, head angle and light. No photos or video.</li>
              <li>Safari may clear it if you don’t open Face Value for 7 days. Private Browsing doesn’t keep it.</li>
            </ul>
          </section>
          )}
        </Frame>
      );
      break;

    case 'home':
      body = trial && trial.baseline && (
        <Frame
          eyebrow={returning ? 'Welcome back' : 'Living trial'}
          title={trial.product.name}
          heading={heading}
          primary={{ label: 'Start check-in', action: () => capture('check_in'), actuator: 'ready' }}
          secondary={{ label: 'Review evidence', action: () => setScreen({ kind: 'review' }) }}
          tertiary={{ label: 'Manage trial', action: () => setScreen({ kind: 'manage', confirm: false, error: null }) }}
          banner={banner}
        >
          <section className={styles.specimen} data-specimen aria-label="Specimen">
            <p className={styles.claim}>{trial.product.outcome}</p>
            <p className={styles.day} data-day={day}>
              Day {day}
              <span> {day <= trial.plan.days ? `of ${trial.plan.days}` : `· ${trial.plan.days}-day plan complete`}</span>
            </p>
            <dl className={styles.meta}>
              <div>
                <dt>Baseline</dt>
                <dd>{elapsedLabel(trial.baseline.capturedAt, clock())}</dd>
              </div>
              <div>
                <dt>Check-ins</dt>
                <dd data-check-in-count={trial.checkIns.length}>{trial.checkIns.length}</dd>
              </div>
              <div>
                <dt>Last</dt>
                <dd>{last ? SHORT_CONDITIONS[last.conditions] : 'None yet'}</dd>
              </div>
            </dl>
          </section>
          <p className={styles.text}>Next: a check-in. Hold the phone as you did for the baseline; the outline guides you back.</p>
          <p className={styles.status} data-saved={saved ? (dirty ? 'partly' : 'yes') : 'no'}>
            {saved
              ? dirty
                ? 'Saved on this device · latest check-in not saved'
                : 'Saved on this device'
              : 'Not saved · this trial ends when you close this tab'}
          </p>
        </Frame>
      );
      break;

    case 'check_in_done': {
      const { checkIn } = screen;
      const ok = checkIn.conditions === 'matched';
      body = (
        <Frame
          eyebrow={`Check-in ${screen.number}`}
          title={CONDITIONS_COPY[checkIn.conditions]}
          heading={heading}
          mark={ok ? 'done' : 'warn'}
          primary={ok ? { label: 'Done', action: () => goHome(), actuator: 'captured' } : { label: 'Try again', action: () => capture('check_in') }}
          secondary={ok ? null : { label: 'Done', action: () => goHome() }}
        >
          <ul className={styles.checks} data-check-in={checkIn.conditions}>
            <li data-state="pass">
              <span>Capture quality</span>
              <strong>Passed</strong>
            </li>
            <li data-state={ok ? 'pass' : 'warn'}>
              <span>Same conditions as baseline</span>
              <strong>{ok ? 'Yes' : checkIn.conditions === 'not_matched' ? 'No' : 'Not confirmed'}</strong>
            </li>
          </ul>
          {ok ? (
            <p className={styles.text}>Distance, angle and light were close to your baseline, so this check-in is a fair comparison point.</p>
          ) : checkIn.reasons.length > 0 ? (
            <ul className={styles.list} data-reasons>
              {checkIn.reasons.map((r) => (
                <li key={r}>{REASON_COPY[r]}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.text}>Some conditions couldn’t be measured this time.</p>
          )}
          {!ok && <p className={styles.text}>It’s kept in your history, but not as a matched check-in.</p>}
          <p className={styles.boundary}>Skin change isn’t measured in this version.</p>
          <p className={screen.save === 'saved' || screen.save === 'unsaved' ? styles.status : styles.error} role={screen.save === 'saved' || screen.save === 'unsaved' ? undefined : 'alert'} data-check-in-save={screen.save}>
            {screen.save === 'saved'
              ? 'Saved on this device'
              : screen.save === 'unsaved'
                ? 'Not saved on this device'
                : `Not saved. ${SAVE_ERROR_COPY[screen.save]} It stays in this tab until you close it.`}
          </p>
        </Frame>
      );
      break;
    }

    case 'review':
      body = trial && trial.baseline && (
        <Frame eyebrow="Evidence" title="What’s been checked" heading={heading} back={() => goHome()} primary={{ label: 'Back', action: () => goHome() }}>
          <p className={styles.text}>
            {trial.checkIns.length === 0
              ? 'No check-ins yet.'
              : `${matched} of ${plural(trial.checkIns.length, 'check-in')} taken in conditions that matched your baseline.`}
          </p>
          <ol className={styles.timeline} data-timeline>
            <li data-entry="baseline">
              <span className={styles.when}>Day 1 · {shortDate(trial.baseline.capturedAt)}</span>
              <span>Baseline · capture passed</span>
            </li>
            {trial.checkIns.map((c, index) => (
              <li key={`${c.at}-${index}`} data-entry="check-in" data-conditions={c.conditions}>
                <span className={styles.when}>
                  Day {trialDay(trial, new Date(c.at))} · {shortDate(c.at)}
                </span>
                <span>
                  Check-in {index + 1} · capture passed · {CONDITIONS_COPY[c.conditions].toLowerCase()}
                  {c.reasons.length > 0 && ` (${c.reasons.join(', ')})`}
                </span>
              </li>
            ))}
          </ol>
          <section className={styles.card} aria-label="What this can’t tell you">
            <p className={styles.cardTitle}>What this can’t tell you</p>
            <p className={styles.cardText}>
              Whether {trial.product.name} is working. This version checks that photos were taken in comparable conditions; it has no
              validated skin measurement, so it gives no redness score, improvement percentage or verdict.
            </p>
          </section>
        </Frame>
      );
      break;

    case 'manage': {
      const archives = archivedKeys(storage).length;
      body = trial && (
        <Frame
          eyebrow="Manage"
          title="Your trial data"
          heading={heading}
          back={() => goHome()}
          primary={
            (saved && !dirty) || !writable
              ? { label: 'Back', action: () => goHome() }
              : {
                  label: saved ? 'Save latest changes' : 'Save trial on this device',
                  action: () => save((error) => setScreen({ kind: 'manage', confirm: false, error: `Not saved. ${SAVE_ERROR_COPY[error]}` })),
                }
          }
          secondary={(saved && !dirty) || !writable ? null : { label: 'Back', action: () => goHome() }}
        >
          <p className={styles.status} data-saved={saved ? 'yes' : 'no'}>
            {saved && trial.consent ? `Saved on this device since ${shortDate(trial.consent.grantedAt)}` : 'Not saved on this device'}
          </p>
          <section className={styles.card}>
            <p className={styles.cardTitle}>What’s kept</p>
            <ul className={styles.list}>
              <li>Product and claim: “{trial.product.name}”, “{trial.product.outcome}”.</li>
              <li>Dates of the baseline and {plural(trial.checkIns.length, 'check-in')}, and whether each matched.</li>
              <li>Ten rounded numbers from the baseline: framing, head angle and light. Derived from your face, so treat them as personal.</li>
              <li>No photos, video, face mesh or measurements of your skin.</li>
            </ul>
          </section>
          <section className={styles.card}>
            <p className={styles.cardTitle}>How long</p>
            <ul className={styles.list}>
              <li>Face Value never deletes it on its own. After {TRIAL_RETENTION_DAYS} days without a check-in, it asks whether to keep it.</li>
              <li>Safari may clear website data on its own after 7 days without a visit, and Private Browsing never keeps it.</li>
              <li>Never uploaded, backed up, synced or encrypted. Clearing Safari’s website data deletes it.</li>
            </ul>
          </section>
          {screen.error && (
            <p className={styles.error} role="alert">
              {screen.error}
            </p>
          )}
          {screen.confirm ? (
            <div className={styles.confirm} role="group" aria-label="Confirm delete">
              <p>Delete the {trial.product.name} trial from this device? This can’t be undone.</p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    if (saved && !deleteTrialData(storage, true)) {
                      setScreen({ kind: 'manage', confirm: false, error: 'Couldn’t delete the saved trial. Nothing was changed.' });
                      return;
                    }
                    setTrial(null);
                    setName('');
                    setChoice(null);
                    setOther('');
                    setBanner('Trial deleted from this device.');
                    setScreen({ kind: 'start' });
                  }}
                >
                  Delete trial
                </button>
                <button type="button" className={styles.link} onClick={() => setScreen({ kind: 'manage', confirm: false, error: null })}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.dangerLink} onClick={() => setScreen({ kind: 'manage', confirm: true, error: null })}>
              Delete this trial
            </button>
          )}
          {archives > 0 && (
            <button
              type="button"
              className={styles.dangerLink}
              onClick={() => {
                const removed = archivedKeys(storage);
                for (const key of removed) {
                  try {
                    storage?.removeItem(key);
                  } catch {
                    // reported below
                  }
                }
                setScreen({
                  kind: 'manage',
                  confirm: false,
                  error: archivedKeys(storage).length ? 'Couldn’t clear the older unreadable data.' : null,
                });
              }}
            >
              Clear older unreadable trial data ({archives})
            </button>
          )}
        </Frame>
      );
      break;
    }

    case 'unreadable':
      body = (
        <Frame
          eyebrow="Saved trial"
          title="This saved trial can’t be opened"
          heading={heading}
          mark="warn"
          primary={{
            label: writable ? 'Start a new trial' : 'Start a new trial in this tab',
            action: () => {
              if (!writable) {
                setScreen({ kind: 'start' }); // nothing can be written, so the old data stays exactly as it is
                return;
              }
              if (!archiveUnreadable(storage, screen.raw, clock())) {
                setScreen({ ...screen, error: 'Couldn’t set the old data aside, so nothing was changed.' });
                return;
              }
              setScreen({ kind: 'start' });
            },
          }}
        >
          <p className={styles.text} data-unreadable={screen.reason}>
            {screen.reason === 'incompatible'
              ? 'It was saved by a different version of Face Value.'
              : 'The saved data is damaged or incomplete.'}{' '}
            Nothing has been deleted.{' '}
            {writable
              ? `Starting a new trial sets the old data aside on this device for ${ARCHIVE_DAYS} days, then removes it.`
              : 'This browser can’t save right now, so a new trial would last only while this tab is open.'}
          </p>
          {screen.error && (
            <p className={styles.error} role="alert">
              {screen.error}
            </p>
          )}
          {screen.confirm ? (
            <div className={styles.confirm} role="group" aria-label="Confirm delete">
              <p>Delete the unreadable trial data from this device? This can’t be undone.</p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    if (!deleteTrialData(storage)) {
                      setScreen({ ...screen, confirm: false, error: 'Couldn’t delete it. Nothing was changed.' });
                      return;
                    }
                    setBanner('Saved trial data deleted.');
                    setScreen({ kind: 'start' });
                  }}
                >
                  Delete it
                </button>
                <button type="button" className={styles.link} onClick={() => setScreen({ ...screen, confirm: false })}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={styles.dangerLink} onClick={() => setScreen({ ...screen, confirm: true, error: null })}>
              Delete the saved data instead
            </button>
          )}
        </Frame>
      );
      break;

    case 'expired':
      body = trial && (
        <Frame
          eyebrow="Saved trial"
          title={`Keep the ${trial.product.name} trial?`}
          heading={heading}
          mark="warn"
          primary={{
            label: 'Keep it',
            action: () => {
              const next = touched(trial, clock());
              const result = saveTrial(storage, next);
              if (!result.ok) {
                setScreen({ ...screen, error: `Couldn’t keep it. ${SAVE_ERROR_COPY[result.error]}` });
                return;
              }
              setTrial(next);
              goHome();
            },
          }}
          secondary={{
            label: 'Delete it',
            action: () => {
              if (!deleteTrialData(storage)) {
                setScreen({ ...screen, error: 'Couldn’t delete it. Nothing was changed.' });
                return;
              }
              setTrial(null);
              setBanner('Trial deleted from this device.');
              setScreen({ kind: 'start' });
            },
          }}
        >
          <p className={styles.text}>
            It hasn’t been used for {screen.inactiveDays} days. Face Value asks after {TRIAL_RETENTION_DAYS} days rather than keeping face-derived
            numbers indefinitely.
          </p>
          {screen.error && (
            <p className={styles.error} role="alert">
              {screen.error}
            </p>
          )}
        </Frame>
      );
      break;
  }

  return (
    <main className={styles.page} data-living-trial data-screen={screen.kind}>
      {body}
    </main>
  );
}

interface Action {
  label: string;
  action: () => void;
  disabled?: boolean;
  actuator?: 'ready' | 'captured' | 'rest';
}

function Frame(props: {
  eyebrow: string;
  title: string;
  heading: RefObject<HTMLHeadingElement | null>;
  mark?: 'done' | 'warn';
  primary: Action;
  secondary?: Action | null;
  tertiary?: Action | null;
  back?: () => void;
  note?: string | null;
  banner?: string | null;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <header className={styles.topbar}>
        {props.back ? (
          <button type="button" className={styles.textButton} onClick={props.back}>
            <span aria-hidden="true">‹</span> Back
          </button>
        ) : (
          <span className={styles.brand}>Face Value</span>
        )}
        <span className={styles.tag}>Experimental</span>
      </header>
      {props.banner && (
        <p className={styles.banner} role="status" data-banner>
          {props.banner}
        </p>
      )}
      <div className={styles.body}>
        <p className={styles.eyebrow}>{props.eyebrow}</p>
        <h1 className={styles.title} ref={props.heading} tabIndex={-1} data-mark={props.mark}>
          {props.mark === 'done' && <span className={styles.markDone} aria-hidden="true" />}
          {props.title}
        </h1>
        {props.children}
      </div>
      <div className={styles.actions}>
        {props.note && <p className={styles.note}>{props.note}</p>}
        <button type="button" className={styles.primary} onClick={props.primary.action} disabled={props.primary.disabled}>
          <FaceValueActuator state={props.primary.disabled ? 'rest' : (props.primary.actuator ?? 'rest')} />
          <span>{props.primary.label}</span>
        </button>
        {(props.secondary || props.tertiary) && (
          <div className={styles.links}>
            {props.secondary && (
              <button type="button" className={styles.link} onClick={props.secondary.action}>
                {props.secondary.label}
              </button>
            )}
            {props.tertiary && (
              <button type="button" className={styles.link} onClick={props.tertiary.action}>
                {props.tertiary.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
