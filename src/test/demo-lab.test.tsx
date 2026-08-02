import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  clearDemoJourneyData,
  DEMO_ENVELOPE_SCHEMA,
  DEMO_JOURNEY_STORAGE_KEY,
  DEMO_ORIGIN,
  DEMO_PREVIEW_SESSION_KEY,
  loadDemoJourney,
  loadDemoPreview,
  saveDemoJourney,
  saveDemoPreview,
  type DemoLaunch,
} from '../adapters/persistence/demoJourneyStore';
import {
  saveStructuredDemoData,
  STORAGE_KEY,
  toPersistedDemoData,
} from '../adapters/persistence/localObservationStore';
import { FaceValueContext } from '../app/faceValueContext';
import { faceValueReducer } from '../app/phaseBMachine';
import { canonicalRednessFixtures, evaluateRedness } from '../domain/evidence/redness';
import { oracleTrialIdentity } from '../domain/oracleTrialIdentity';
import { followUpIsEligible } from '../domain/phaseB5';
import { DemoLab } from '../features/demo-lab/DemoLab';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';
import { demoLabAccessEnabled } from '../features/demo-lab/demoLabAccess';
import { evidenceRecordDisclosureStateForDemo } from '../features/demo-lab/evidenceRecordDemoAdapter';
import { DEMO_RESULT_FIXTURES, DEMO_STARTING_POINTS } from '../domain/demoLab';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { evidenceRecordViewModelFromRecord } from '../features/evidence-record/evidenceRecordViewModel';
import { verdictViewModelFromRecord } from '../features/verdict/verdictViewModel';

describe('Demo Lab access boundary', () => {
  it('requires development mode and the explicit flag together', () => {
    expect(
      demoLabAccessEnabled({
        dev: true,
        production: false,
        showDemoControls: 'true',
      }),
    ).toBe(true);
    expect(
      demoLabAccessEnabled({
        dev: true,
        production: false,
        showDemoControls: undefined,
      }),
    ).toBe(false);
    expect(
      demoLabAccessEnabled({
        dev: false,
        production: false,
        showDemoControls: 'true',
      }),
    ).toBe(false);
    expect(
      demoLabAccessEnabled({
        dev: false,
        production: true,
        showDemoControls: undefined,
      }),
    ).toBe(true);
  });
});

describe('canonical typed fixture states', () => {
  it.each([
    ['A', 'strong_improvement', 'keep'],
    ['B', 'no_detectable_change', 'not_proving_job'],
    ['C', 'directional_improvement', 'test_longer'],
    ['D', 'strong_improvement', 'retry_alone'],
    ['E', 'worsened', 'not_proving_job'],
    ['F', 'worsened', 'safety_interruption'],
    ['G', 'strong_improvement', 'test_longer'],
  ] as const)('keeps canonical fixture %s unchanged', (key, effect, action) => {
    const snapshot = evaluateRedness(canonicalRednessFixtures[key]);
    expect(snapshot.effectClassification).toBe(effect);
    expect(snapshot.interpretation.recommendedAction).toBe(action);
  });

  it.each(DEMO_RESULT_FIXTURES)('creates a schema-valid persisted state for $label', (fixture) => {
    const state = buildDemoFixtureState('evidence_recorded', fixture.id);
    const launch: DemoLaunch = {
      mode: 'journey',
      startingPoint: 'evidence_recorded',
      resultFixture: fixture.id,
      state,
    };

    saveDemoJourney(launch, localStorage, '2026-07-28T12:00:00.000Z');
    const restored = loadDemoJourney();
    const restoredEvaluation = restored?.state.record?.rednessEvaluation;
    const expectedAction =
      fixture.id === 'legacy_trial_truth_not_collected'
        ? 'test_longer'
        : evaluateRedness(canonicalRednessFixtures[fixture.canonicalKey]).interpretation
            .recommendedAction;

    expect(restored).toMatchObject({
      schemaVersion: DEMO_ENVELOPE_SCHEMA,
      origin: DEMO_ORIGIN,
      mode: 'journey',
      resultFixture: fixture.id,
    });
    expect(restored?.state.record?.demoOriginated).toBe(true);
    expect(restoredEvaluation?.interpretation.recommendedAction).toBe(expectedAction);
    if (fixture.id === 'legacy_trial_truth_not_collected') {
      expect(restoredEvaluation?.adherence.status).toBe('unknown');
      expect(restoredEvaluation?.tolerance).toBeNull();
      expect(restoredEvaluation?.patientAnchor).toBeNull();
      expect(restored?.state.record?.trialTruth).toBeUndefined();
    }
  });

  it.each(DEMO_STARTING_POINTS)('builds a valid $label application state', (startingPoint) => {
    const state = buildDemoFixtureState(startingPoint.id, 'clear_favorable_change');
    const persisted = toPersistedDemoData(state);

    expect(persisted.stage).toBe(state.stage);
    expect(JSON.stringify(persisted)).not.toMatch(/data:image|blob:|base64|imageBytes|objectURL/);
    expect(
      persisted.archive.every(
        (record) => record.demoOriginated === true && record.includesFaceImage === false,
      ),
    ).toBe(true);
  });

  it.each([
    ['saved_result', null, false],
    ['evidence_record_reasoning_expanded', 'why', false],
    ['evidence_record_full_technical_expanded', 'full', true],
  ] as const)(
    'keeps Evidence Record state %s behind the typed route and disclosure adapter',
    (startingPoint, openDisclosure, technicalMetadataOpen) => {
      const state = buildDemoFixtureState(startingPoint, 'clear_favorable_change');
      const record = state.record;
      if (!record?.rednessEvaluation) {
        throw new Error('Expected a canonical synthetic Evidence Record.');
      }
      const evidenceRecord = evidenceRecordViewModelFromRecord(record);
      const verdict = verdictViewModelFromRecord(record);

      expect(state.stage).toBe('record');
      expect(record).toBe(state.archive[0]);
      expect(state.returnStage).toBe('archive');
      expect(record.demoOriginated).toBe(true);
      expect(evidenceRecord.recordId).toBe(record.id);
      expect(evidenceRecord.headline).toBe(verdict.headline);
      expect(evidenceRecord.nextStep.canonicalAction).toBe(
        record.rednessEvaluation.interpretation.recommendedAction,
      );
      expect(evidenceRecord.comparison).toMatchObject({
        baseline: String(record.rednessEvaluation.baselineRawMedian),
        followUp: String(record.rednessEvaluation.endpointRawMedian),
      });
      expect(evidenceRecordDisclosureStateForDemo(startingPoint)).toEqual({
        openDisclosure,
        technicalMetadataOpen,
      });
    },
  );
});

describe('Demo Lab persistence modes', () => {
  it('keeps preview state one-shot and leaves ordinary persistence byte-stable', () => {
    const ordinaryState = buildDemoFixtureState('home_saved_result', 'no_clear_change');
    saveStructuredDemoData(ordinaryState);
    const ordinaryBefore = localStorage.getItem(STORAGE_KEY);
    const previewState = buildDemoFixtureState('verdict_ready', 'clear_favorable_change');

    saveDemoPreview({
      mode: 'preview',
      startingPoint: 'verdict_ready',
      resultFixture: 'clear_favorable_change',
      state: previewState,
    });

    expect(loadDemoPreview()?.state.stage).toBe('analysis');
    expect(sessionStorage.getItem(DEMO_PREVIEW_SESSION_KEY)).toContain(DEMO_ORIGIN);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinaryBefore);
    expect(localStorage.getItem(DEMO_JOURNEY_STORAGE_KEY)).toBeNull();
  });

  it('loads a reload-stable journey through the existing structured-state validator', () => {
    const state = buildDemoFixtureState('followup_ready', 'early_favorable_change');
    const launch: DemoLaunch = {
      mode: 'journey',
      startingPoint: 'followup_ready',
      resultFixture: 'early_favorable_change',
      state,
    };

    saveDemoJourney(launch);
    const firstLoad = loadDemoJourney();
    const secondLoad = loadDemoJourney();

    expect(firstLoad).toEqual(secondLoad);
    expect(secondLoad?.state.stage).toBe('followup_ready');
    expect(secondLoad?.state.registeredProduct?.productName).toBe('One Thing Redness Trial');
  });

  it('keeps the trial_pending fixture ineligible and timing-stable after reload', () => {
    const state = buildDemoFixtureState('trial_pending', 'early_favorable_change');
    if (!state.baselineLockedAt) throw new Error('Expected a deterministic fixture clock.');

    saveDemoJourney({
      mode: 'journey',
      startingPoint: 'trial_pending',
      resultFixture: 'early_favorable_change',
      state,
    });
    const firstLoad = loadDemoJourney();
    const secondLoad = loadDemoJourney();

    expect(firstLoad).toEqual(secondLoad);
    expect(secondLoad?.startingPoint).toBe('trial_pending');
    expect(secondLoad?.state.stage).toBe('waiting_for_followup');
    expect(secondLoad?.state.demoTimelineAdvanced).toBe(false);
    expect(
      followUpIsEligible({
        followUpEligibleAt: secondLoad?.state.followUpEligibleAt ?? null,
        demoTimelineAdvanced: secondLoad?.state.demoTimelineAdvanced ?? false,
        now: state.baselineLockedAt,
      }),
    ).toBe(false);
  });

  it('advances only isolated trial_pending state and preserves trial identity across reload', () => {
    const ordinaryState = buildDemoFixtureState('home_saved_result', 'no_clear_change');
    saveStructuredDemoData(ordinaryState);
    const ordinaryBefore = localStorage.getItem(STORAGE_KEY);
    const pending = buildDemoFixtureState('trial_pending', 'early_favorable_change');
    const productBefore = structuredClone(pending.registeredProduct);
    const identityBefore = oracleTrialIdentity({
      accession: pending.registeredProduct?.accession,
      baselineAt: pending.baselineLockedAt,
      followUpAt: pending.followUpEligibleAt,
    });
    const advanced = faceValueReducer(pending, {
      type: 'ADVANCE_DEMO_TIMELINE',
      now: pending.baselineLockedAt ?? '2026-07-28T12:00:00.000Z',
    });

    expect(advanced.stage).toBe('followup_ready');
    expect(advanced.demoTimelineAdvanced).toBe(true);
    expect(advanced.registeredProduct).toEqual(productBefore);
    expect(
      oracleTrialIdentity({
        accession: advanced.registeredProduct?.accession,
        baselineAt: advanced.baselineLockedAt,
        followUpAt: advanced.followUpEligibleAt,
      }),
    ).toEqual(identityBefore);

    saveDemoJourney({
      mode: 'journey',
      startingPoint: 'trial_pending',
      resultFixture: 'early_favorable_change',
      state: advanced,
    });
    const reloaded = loadDemoJourney();

    expect(reloaded?.state.stage).toBe('followup_ready');
    expect(reloaded?.state.demoTimelineAdvanced).toBe(true);
    expect(reloaded?.state.registeredProduct).toEqual(productBefore);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinaryBefore);
  });

  it('clears demo data without removing ordinary saved trials', () => {
    const ordinaryState = buildDemoFixtureState('home_saved_result', 'no_clear_change');
    saveStructuredDemoData(ordinaryState);
    const ordinaryBefore = localStorage.getItem(STORAGE_KEY);
    saveDemoJourney({
      mode: 'journey',
      startingPoint: 'home_saved_result',
      resultFixture: 'clear_favorable_change',
      state: buildDemoFixtureState('home_saved_result', 'clear_favorable_change'),
    });

    clearDemoJourneyData();

    expect(localStorage.getItem(DEMO_JOURNEY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinaryBefore);
  });

  it('rejects a synthetic envelope if a saved record lacks demo origin', () => {
    const state = buildDemoFixtureState('home_saved_result', 'clear_favorable_change');
    const record = state.record;
    if (!record) throw new Error('Expected a synthetic saved result.');
    const ordinaryRecord = {
      ...record,
      demoOriginated: false,
    };

    expect(() =>
      saveDemoJourney({
        mode: 'journey',
        startingPoint: 'home_saved_result',
        resultFixture: 'clear_favorable_change',
        state: {
          ...state,
          record: ordinaryRecord,
          archive: [ordinaryRecord],
        },
      }),
    ).toThrow(/explicit demo-origin metadata/);
  });
});

describe('Demo Lab controls and production-screen reuse', () => {
  it('shows the timeline control only inside an isolated demo runtime', async () => {
    const user = userEvent.setup();
    const state = buildDemoFixtureState('trial_pending', 'early_favorable_change');
    const dispatch = vi.fn();
    const { rerender } = render(
      <FaceValueContext.Provider
        value={{
          state,
          dispatch,
          demoRuntime: {
            mode: 'journey',
            startingPoint: 'trial_pending',
            resultFixture: 'early_favorable_change',
            fixtureNow: state.baselineLockedAt,
          },
        }}
      >
        <FaceValueApplication />
      </FaceValueContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'ADVANCE DEMO TIMELINE' }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ADVANCE_DEMO_TIMELINE',
      now: state.baselineLockedAt,
    });

    rerender(
      <FaceValueContext.Provider
        value={{
          state,
          dispatch,
          demoRuntime: {
            mode: 'ordinary',
            startingPoint: null,
            resultFixture: null,
            fixtureNow: null,
          },
        }}
      >
        <FaceValueApplication />
      </FaceValueContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: 'ADVANCE DEMO TIMELINE' })).not.toBeInTheDocument();
  });

  it('offers keyboard-accessible preview and confirmed journey controls', async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<DemoLab navigate={navigate} />);

    expect(screen.getByRole('heading', { name: 'Demo Lab' })).toBeVisible();
    expect(screen.getByRole('radio', { name: /Preview state/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /Starting point/ })).toHaveValue('followup_ready');
    expect(screen.getByRole('combobox', { name: /Result fixture/ })).toHaveAccessibleName(
      'Result fixture',
    );
    expect(screen.getByRole('button', { name: 'CLEAR DEMO DATA' })).toBeDisabled();
    expect(screen.getByRole('link', { name: /OPEN REDNESS CALIBRATION/ })).toHaveAttribute(
      'href',
      '/calibration/redness',
    );

    await user.click(screen.getByRole('button', { name: /OPEN DEMO STATE/ }));
    expect(navigate).toHaveBeenCalledWith('/');
    expect(loadDemoPreview()?.mode).toBe('preview');

    await user.click(screen.getByRole('radio', { name: /Load demo journey/ }));
    await user.click(screen.getByRole('button', { name: /OPEN DEMO STATE/ }));
    expect(
      screen.getByRole('heading', {
        name: 'Replace isolated demo journey data?',
      }),
    ).toBeVisible();
    expect(navigate).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'CONFIRM AND LOAD' }));
    expect(navigate).toHaveBeenLastCalledWith('/?fv-demo-journey=1');
    expect(loadDemoJourney()?.origin).toBe(DEMO_ORIGIN);
  });

  it.each([
    ['saved_result', 'false', 'false', false],
    ['evidence_record_reasoning_expanded', 'true', 'false', false],
    ['evidence_record_full_technical_expanded', 'false', 'true', true],
  ] as const)(
    'opens %s through the real production Evidence Record',
    (startingPoint, whyExpanded, fullExpanded, technicalExpanded) => {
      const state = buildDemoFixtureState(startingPoint, 'clear_favorable_change');
      const record = state.record;
      if (!record?.rednessEvaluation) {
        throw new Error('Expected a saved canonical demo record.');
      }
      const snapshotBeforeRender = structuredClone(record.rednessEvaluation);
      const verdict = verdictViewModelFromRecord(record);

      render(
        <FaceValueContext.Provider
          value={{
            state,
            dispatch: vi.fn(),
            demoRuntime: {
              mode: 'preview',
              startingPoint,
              resultFixture: 'clear_favorable_change',
              fixtureNow: null,
            },
          }}
        >
          <FaceValueApplication />
        </FaceValueContext.Provider>,
      );

      expect(screen.getByRole('heading', { name: 'Evidence record' })).toBeVisible();
      expect(screen.getAllByText(verdict.headline).length).toBeGreaterThan(0);
      expect(
        screen.getByRole('button', { name: /Why Face Value reached this result/i }),
      ).toHaveAttribute('aria-expanded', whyExpanded);
      expect(screen.getByRole('button', { name: /Full evidence record/i })).toHaveAttribute(
        'aria-expanded',
        fullExpanded,
      );
      if (technicalExpanded) {
        expect(screen.getByText('Technical metadata').closest('details')).toHaveAttribute(
          'open',
        );
        expect(screen.getByText('Configuration hash')).toBeVisible();
      }
      expect(screen.getByRole('button', { name: 'View previous trials' })).toBeVisible();
      expect(record.rednessEvaluation).toEqual(snapshotBeforeRender);
    },
  );
});
