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
import { FaceValueProvider } from '../app/FaceValueProvider';
import { canonicalRednessFixtures, evaluateRedness } from '../domain/evidence/redness';
import { DemoLab } from '../features/demo-lab/DemoLab';
import { buildDemoFixtureState } from '../features/demo-lab/demoFixtureState';
import { demoLabAccessEnabled } from '../features/demo-lab/demoLabAccess';
import { DEFERRED_EVIDENCE_RECORD_INTEGRATIONS } from '../features/demo-lab/evidenceRecordDemoAdapter';
import { DEMO_RESULT_FIXTURES, DEMO_STARTING_POINTS } from '../domain/demoLab';
import { FaceValueApplication } from '../features/FaceValueApplication';
import { verdictViewModelFromRecord } from '../features/verdict/verdictViewModel';

describe('Demo Lab access boundary', () => {
  it('requires development mode and the explicit flag together', () => {
    expect(
      demoLabAccessEnabled({
        dev: true,
        showDemoControls: 'true',
      }),
    ).toBe(true);
    expect(
      demoLabAccessEnabled({
        dev: true,
        showDemoControls: undefined,
      }),
    ).toBe(false);
    expect(
      demoLabAccessEnabled({
        dev: false,
        showDemoControls: 'true',
      }),
    ).toBe(false);
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

    expect(restored).toMatchObject({
      schemaVersion: DEMO_ENVELOPE_SCHEMA,
      origin: DEMO_ORIGIN,
      mode: 'journey',
      resultFixture: fixture.id,
    });
    expect(restored?.state.record?.demoOriginated).toBe(true);
    expect(restored?.state.record?.rednessEvaluation?.interpretation.recommendedAction).toBe(
      evaluateRedness(canonicalRednessFixtures[fixture.canonicalKey]).interpretation
        .recommendedAction,
    );
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

  it('keeps current saved-result routing behind one typed adapter', () => {
    const state = buildDemoFixtureState('saved_result', 'clear_favorable_change');

    expect(state.stage).toBe('record');
    expect(state.record).toBe(state.archive[0]);
    expect(state.returnStage).toBe('archive');
    expect(DEFERRED_EVIDENCE_RECORD_INTEGRATIONS.map(({ id }) => id)).toEqual([
      'summary',
      'reasoning_expanded',
      'full_technical_record_expanded',
    ]);
  });
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

  it('opens the current saved result through the real production component', () => {
    const savedResult = buildDemoFixtureState('saved_result', 'clear_favorable_change');
    saveStructuredDemoData(savedResult);
    const record = savedResult.record;
    if (!record) throw new Error('Expected a saved demo record.');
    const verdict = verdictViewModelFromRecord(record);

    render(
      <FaceValueProvider>
        <FaceValueApplication />
      </FaceValueProvider>,
    );

    expect(screen.getByRole('heading', { name: 'SAVED RESULT' })).toBeVisible();
    expect(screen.getAllByText(verdict.headline).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'View previous trials' })).toBeVisible();
  });
});
