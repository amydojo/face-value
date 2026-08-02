import { expect, test, type Page } from '@playwright/test';
import {
  DEMO_JOURNEY_STORAGE_KEY,
  saveDemoJourney,
} from '../src/adapters/persistence/demoJourneyStore';
import type { PersistedTrialTruthData } from '../src/adapters/persistence/trialTruthObservationStore';
import type { DemoResultFixtureId, DemoStartingPoint } from '../src/domain/demoLab';
import { buildDemoFixtureState } from '../src/features/demo-lab/demoFixtureState';

const FIXTURE_NOW = '2026-07-26T12:00:00.000Z';

type VisibleAnswer = 'Less' | 'Same' | 'More';
type ToleranceAnswer = 'None' | 'Mild' | 'Moderate' | 'Severe';
type CanonicalTolerance = 'none' | 'mild' | 'moderate' | 'severe';
type CanonicalEffect =
  | 'worsened'
  | 'no_detectable_change'
  | 'directional_improvement'
  | 'meaningful_candidate'
  | 'strong_improvement';
type CanonicalAction =
  'keep' | 'test_longer' | 'retry_alone' | 'not_proving_job' | 'safety_interruption';
type AnchorRelationship = 'agreed' | 'neutral' | 'contradicted';

interface TrialScenario {
  label: string;
  fixture: DemoResultFixtureId;
  tolerance: ToleranceAnswer;
  symptoms?: string[];
  visible: VisibleAnswer;
  expectedTolerance: CanonicalTolerance;
  expectedSymptoms: string[];
  expectedVisibleChange: -1 | 0 | 1;
  expectedEffect: CanonicalEffect;
  expectedAction: CanonicalAction;
  expectedAnchorRelationship: AnchorRelationship;
}

const scenarios: TrialScenario[] = [
  {
    label: 'favorable objective result with complete use, no irritation, and agreement',
    fixture: 'clear_favorable_change',
    tolerance: 'None',
    visible: 'Less',
    expectedTolerance: 'none',
    expectedSymptoms: [],
    expectedVisibleChange: 1,
    expectedEffect: 'strong_improvement',
    expectedAction: 'test_longer',
    expectedAnchorRelationship: 'agreed',
  },
  {
    label: 'favorable objective result with active overlap and retry-alone action',
    fixture: 'product_overlap',
    tolerance: 'None',
    visible: 'Less',
    expectedTolerance: 'none',
    expectedSymptoms: [],
    expectedVisibleChange: 1,
    expectedEffect: 'strong_improvement',
    expectedAction: 'retry_alone',
    expectedAnchorRelationship: 'agreed',
  },
  {
    label: 'favorable objective result with severe swelling and safety interruption',
    fixture: 'clear_favorable_change',
    tolerance: 'Severe',
    symptoms: ['Swelling'],
    visible: 'Less',
    expectedTolerance: 'severe',
    expectedSymptoms: ['swelling'],
    expectedVisibleChange: 1,
    expectedEffect: 'strong_improvement',
    expectedAction: 'safety_interruption',
    expectedAnchorRelationship: 'agreed',
  },
  {
    label: 'no detectable objective change with participant reporting same',
    fixture: 'no_clear_change',
    tolerance: 'None',
    visible: 'Same',
    expectedTolerance: 'none',
    expectedSymptoms: [],
    expectedVisibleChange: 0,
    expectedEffect: 'no_detectable_change',
    expectedAction: 'test_longer',
    expectedAnchorRelationship: 'neutral',
  },
  {
    label: 'objective worsening with participant reporting more and no severe symptom',
    fixture: 'worsening',
    tolerance: 'None',
    visible: 'More',
    expectedTolerance: 'none',
    expectedSymptoms: [],
    expectedVisibleChange: -1,
    expectedEffect: 'worsened',
    expectedAction: 'test_longer',
    expectedAnchorRelationship: 'agreed',
  },
  {
    label: 'contradictory participant anchor that cannot reverse objective effect',
    fixture: 'contradictory_anchor',
    tolerance: 'None',
    visible: 'More',
    expectedTolerance: 'none',
    expectedSymptoms: [],
    expectedVisibleChange: -1,
    expectedEffect: 'directional_improvement',
    expectedAction: 'test_longer',
    expectedAnchorRelationship: 'contradicted',
  },
];

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function journeyEnvelope(
  startingPoint: DemoStartingPoint,
  resultFixture: DemoResultFixtureId,
): string {
  const state = buildDemoFixtureState(startingPoint, resultFixture);
  const envelope = saveDemoJourney(
    {
      mode: 'journey',
      startingPoint,
      resultFixture,
      state,
    },
    new MemoryStorage(),
    FIXTURE_NOW,
  );
  return JSON.stringify(envelope);
}

async function launchFixture(
  page: Page,
  startingPoint: DemoStartingPoint,
  resultFixture: DemoResultFixtureId,
): Promise<void> {
  await page.goto('/demo');
  await page.evaluate(
    ({ key, value }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, value);
    },
    {
      key: DEMO_JOURNEY_STORAGE_KEY,
      value: journeyEnvelope(startingPoint, resultFixture),
    },
  );
  await page.goto('/?fv-demo-journey=1');
}

async function readPersistedState(page: Page): Promise<PersistedTrialTruthData> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Demo journey envelope was not persisted.');
    const envelope = JSON.parse(raw) as { state?: PersistedTrialTruthData };
    if (!envelope.state) throw new Error('Demo journey envelope has no state.');
    return envelope.state;
  }, DEMO_JOURNEY_STORAGE_KEY);
}

async function rawJourneyStorage(page: Page): Promise<string> {
  return page.evaluate((key) => localStorage.getItem(key) ?? '', DEMO_JOURNEY_STORAGE_KEY);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  expect(dimensions.documentScroll).toBeLessThanOrEqual(dimensions.documentClient + 1);
  expect(dimensions.bodyScroll).toBeLessThanOrEqual(dimensions.bodyClient + 1);
}

async function expectFirmwareFits(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
    };
    const panel = rect('[data-motion-direction]')!;
    const identity = rect('[data-trial-truth-product-identity]')!;
    const question = rect('[data-motion-direction] h1')!;
    const answer = rect(
      '[data-motion-direction] [data-segment-count], [data-motion-direction] [data-trial-truth-symptom-scroller]',
    );
    const footer = rect(
      '[data-motion-direction] [aria-label="Add reported symptoms"], [data-motion-direction] [aria-label="Edit reported symptoms"], [data-motion-direction] p[class*="helper"]',
    );
    return { panel, identity, question, answer, footer };
  });

  for (const box of [layout.identity, layout.question, layout.answer, layout.footer]) {
    if (!box) continue;
    expect(box.top).toBeGreaterThanOrEqual(layout.panel.top - 0.5);
    expect(box.left).toBeGreaterThanOrEqual(layout.panel.left - 0.5);
    expect(box.right).toBeLessThanOrEqual(layout.panel.right + 0.5);
    expect(box.bottom).toBeLessThanOrEqual(layout.panel.bottom + 0.5);
  }
  expect(layout.question.top).toBeGreaterThanOrEqual(layout.identity.bottom + 1);
  if (layout.answer) {
    expect(layout.answer.top).toBeGreaterThanOrEqual(layout.question.bottom + 1);
  }
  if (layout.answer && layout.footer) {
    expect(layout.footer.top).toBeGreaterThanOrEqual(layout.answer.bottom + 1);
  }
}

async function amberTreatment(page: Page) {
  return page.locator('[data-oracle-amber-control][data-amber-state="ready"]').evaluate((amber) => {
    const outer = getComputedStyle(amber);
    const light = amber.querySelector<HTMLElement>(':scope > span');
    if (!light) throw new Error('Amber control has no inner light.');
    const inner = getComputedStyle(light);
    return {
      outer: {
        backgroundImage: outer.backgroundImage,
        borderTopColor: outer.borderTopColor,
        borderRightColor: outer.borderRightColor,
        borderBottomColor: outer.borderBottomColor,
        borderLeftColor: outer.borderLeftColor,
        boxShadow: outer.boxShadow,
      },
      inner: {
        backgroundImage: inner.backgroundImage,
        borderTopColor: inner.borderTopColor,
        boxShadow: inner.boxShadow,
      },
    };
  });
}

async function installRuntimeGuards(page: Page): Promise<{
  consoleErrors: string[];
  pageErrors: string[];
}> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const host = window as unknown as { __fvUnhandledRejections?: string[] };
    host.__fvUnhandledRejections = [];
    window.addEventListener('unhandledrejection', (event) => {
      host.__fvUnhandledRejections?.push(String(event.reason));
    });
  });
  return { consoleErrors, pageErrors };
}

async function expectRuntimeClean(
  page: Page,
  guards: { consoleErrors: string[]; pageErrors: string[] },
): Promise<void> {
  const unhandledRejections = await page.evaluate(
    () =>
      (window as unknown as { __fvUnhandledRejections?: string[] }).__fvUnhandledRejections ?? [],
  );
  expect(guards.consoleErrors).toEqual([]);
  expect(guards.pageErrors).toEqual([]);
  expect(unhandledRejections).toEqual([]);
}

async function submitTrialTruth(page: Page, scenario: TrialScenario): Promise<void> {
  await expect(page.locator('[data-fv-screen="trial-truth"]')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'YES' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Continue to skin response' })).toBeDisabled();

  const staged = await readPersistedState(page);
  expect(staged.longitudinalEvidence.baseline).toBeNull();
  expect(staged.longitudinalEvidence.followUp).toBeNull();
  expect(staged.longitudinalEvidence.baselineBurst?.acceptedFrames).toHaveLength(3);
  expect(staged.longitudinalEvidence.followUpBurst?.acceptedFrames).toHaveLength(3);

  await page.getByRole('radio', { name: 'YES' }).click();
  await page.getByRole('button', { name: 'Continue to skin response' }).click();
  await page.getByRole('radio', { name: scenario.tolerance.toUpperCase() }).click();
  if ((scenario.symptoms ?? []).length > 0) {
    await page.getByRole('button', { name: 'Add reported symptoms' }).click();
  }
  for (const symptom of scenario.symptoms ?? []) {
    await page.getByRole('checkbox', { name: symptom }).click();
  }
  if ((scenario.symptoms ?? []).length > 0) {
    await page.getByRole('button', { name: 'Save signs' }).click();
  }
  await page.getByRole('button', { name: 'Continue to visible redness' }).click();
  await page.getByRole('radio', { name: scenario.visible.toUpperCase() }).click();

  const submit = page.getByRole('button', { name: 'See result' });
  await submit.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });

  await expect(page.locator('[data-fv-screen="followup-context"]')).toBeVisible();
  const committed = await readPersistedState(page);
  expect(committed.trialTruthEvidence).not.toBeNull();
  expect(committed.longitudinalEvidence.comparison).toBeNull();
  expect(committed.record).toBeNull();
  expect(committed.archive).toHaveLength(0);

  await page.getByRole('button', { name: 'NOTHING DIFFERENT' }).click();
  await expect(page.locator('[data-fv-screen="oracle-reveal"]')).toBeVisible();
  await expect(page.locator('[data-oracle-scene-state="sealed"]')).toBeVisible();
  await expect(page.locator('[data-oracle-specimen]')).toHaveCount(1);
}

async function expectSealedOraclePrivacy(page: Page): Promise<void> {
  const machine = page.locator('[data-oracle-machine]');
  await expect(machine).toHaveAttribute(
    'aria-label',
    /Result content is unavailable until reveal/i,
  );
  await expect(page.locator('[data-oracle-finding]')).toHaveCount(0);
  await expect(page.locator('[data-evidence-finding]')).toHaveCount(0);
  await expect(page.locator('[data-fv-screen="oracle-reveal"] img')).toHaveCount(0);
  await expect(page.locator('[data-fv-screen="oracle-reveal"] video')).toHaveCount(0);
  await expect(page.locator('[data-fv-screen="oracle-reveal"] canvas')).toHaveCount(0);

  const stored = (await rawJourneyStorage(page)).toLocaleLowerCase('en-US');
  for (const forbidden of [
    'data:image',
    'blob:',
    'base64,',
    'objecturl',
    'signedurl',
    'providertaskid',
    'camera stream',
  ]) {
    expect(stored).not.toContain(forbidden);
  }
}

async function advanceOracleToCollected(page: Page): Promise<void> {
  const scene = page.locator('[data-fv-screen="oracle-reveal"]');
  await page.getByRole('button', { name: /Reveal sealed result for/i }).click();
  await expect(scene).toHaveAttribute('data-oracle-scene-state', 'opening');
  await page.locator('[data-oracle-motion="opening"]').dispatchEvent('animationend');
  await expect(scene).toHaveAttribute('data-oracle-scene-state', 'transmitting');
  await page.locator('[data-oracle-motion="transmission"]').dispatchEvent('animationend');
  await expect(scene).toHaveAttribute('data-oracle-scene-state', 'verdict_revealed');

  const keep = page.locator('[data-oracle-keep-action="text"]');
  await keep.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(scene).toHaveAttribute('data-oracle-scene-state', 'committing');
  await page.locator('[data-oracle-motion="commit"]').dispatchEvent('animationend');
  await expect(scene).toHaveAttribute('data-oracle-scene-state', 'dispensing');

  const paper = page.locator('[data-oracle-paper]');
  await expect(paper).toHaveAttribute('data-paper-position', 'feeding');
  await paper.dispatchEvent('animationend');
  await expect(paper).toHaveAttribute('data-paper-position', 'final');
  await paper.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(paper).toHaveAttribute('data-paper-position', 'collecting');
  await paper.dispatchEvent('animationend');

  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORDED' })).toBeVisible();
  await expect(scene).toHaveAttribute('data-oracle-scene-state', 'collected');
}

function stableEvidenceSnapshot(state: PersistedTrialTruthData) {
  return {
    trialTruthEvidence: state.trialTruthEvidence,
    comparison: state.longitudinalEvidence.comparison,
    evaluation: state.longitudinalEvidence.evaluation,
    record: state.record,
    archive: state.archive,
  };
}

async function expectEvidenceRecordRows(
  page: Page,
  scenario: TrialScenario,
  recordedAt: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Full evidence record' }).click();
  const row = (id: string) => page.locator(`[data-evidence-row="${id}"]`);
  await expect(row('adherence')).toHaveAttribute('data-canonical-value', 'complete');
  await expect(row('tolerance-severity')).toHaveAttribute(
    'data-canonical-value',
    scenario.expectedTolerance,
  );
  await expect(row('reported-symptoms')).toContainText(
    scenario.expectedSymptoms.length === 0 ? 'None reported' : (scenario.symptoms?.[0] ?? ''),
  );
  await expect(row('participant-observation')).toContainText(scenario.visible);
  await expect(row('participant-report-timestamp')).toHaveAttribute(
    'data-canonical-value',
    recordedAt,
  );
  await expect(row('anchor-relationship')).toHaveAttribute(
    'data-canonical-value',
    scenario.expectedAnchorRelationship,
  );
}

async function expectImmutableSavedSurfaces(
  page: Page,
  scenario: TrialScenario,
  recordId: string,
  recordedAt: string,
): Promise<void> {
  await page.getByRole('button', { name: 'DONE' }).click();
  await expect(page.locator('[data-fv-screen="trials"]')).toBeVisible();
  await expect(page.locator('[data-latest-verdict-record]')).toHaveAttribute(
    'data-record-id',
    recordId,
  );

  await page.getByRole('button', { name: /Previous trials, 1 saved result/i }).click();
  await expect(page.locator('[data-fv-screen="previous-trials"]')).toBeVisible();
  const archived = page.locator('[data-archive-record]');
  await expect(archived).toHaveCount(1);
  await expect(archived).toHaveAttribute('data-record-id', recordId);
  await archived.click();

  const evidenceRecord = page.locator('[data-evidence-record]');
  await expect(evidenceRecord).toHaveAttribute('data-record-id', recordId);
  await expect(evidenceRecord).toHaveAttribute('data-snapshot-kind', 'canonical');
  await expectEvidenceRecordRows(page, scenario, recordedAt);
}

for (const scenario of scenarios) {
  test(`${scenario.label} preserves one immutable result`, async ({ page }) => {
    const guards = await installRuntimeGuards(page);
    await launchFixture(page, 'trial_truth', scenario.fixture);
    await submitTrialTruth(page, scenario);
    await expectNoHorizontalOverflow(page);
    await expectSealedOraclePrivacy(page);

    const compared = await readPersistedState(page);
    expect(compared.longitudinalEvidence.comparison).not.toBeNull();
    expect(compared.longitudinalEvidence.evaluation?.effectClassification).toBe(
      scenario.expectedEffect,
    );
    expect(compared.longitudinalEvidence.evaluation?.measurementQuality).toBe('limited');
    expect(compared.longitudinalEvidence.evaluation?.interpretation.recommendedAction).toBe(
      scenario.expectedAction,
    );
    expect(compared.trialTruthEvidence?.adherence.status).toBe('complete');
    expect(compared.trialTruthEvidence?.tolerance.severity).toBe(scenario.expectedTolerance);
    expect(compared.trialTruthEvidence?.tolerance.symptoms).toEqual(scenario.expectedSymptoms);
    expect(compared.trialTruthEvidence?.patientAnchor.visibleChange).toBe(
      scenario.expectedVisibleChange,
    );

    await advanceOracleToCollected(page);
    await expectNoHorizontalOverflow(page);

    const collected = await readPersistedState(page);
    expect(collected.archive).toHaveLength(1);
    expect(collected.record?.id).toBe(collected.archive[0]?.id);
    expect(collected.record?.includesFaceImage).toBe(false);
    expect(collected.record?.trialTruth).toEqual(collected.trialTruthEvidence);
    expect(collected.record?.anchorRelationship).toBe(scenario.expectedAnchorRelationship);
    expect(collected.record?.rednessEvaluation?.effectClassification).toBe(scenario.expectedEffect);
    expect(collected.record?.rednessEvaluation?.interpretation.recommendedAction).toBe(
      scenario.expectedAction,
    );
    expect(JSON.stringify(collected.analysis?.rednessEvaluation)).toBe(
      JSON.stringify(collected.longitudinalEvidence.evaluation),
    );
    expect(JSON.stringify(collected.record?.rednessEvaluation)).toBe(
      JSON.stringify(collected.longitudinalEvidence.evaluation),
    );
    expect(JSON.stringify(collected.archive[0]?.rednessEvaluation)).toBe(
      JSON.stringify(collected.longitudinalEvidence.evaluation),
    );

    const beforeReload = stableEvidenceSnapshot(collected);
    const recordId = collected.archive[0]?.id;
    const recordedAt = collected.trialTruthEvidence?.recordedAt;
    expect(recordId).toBeTruthy();
    expect(recordedAt).toBeTruthy();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'EVIDENCE RECORDED' })).toBeVisible();
    const afterReload = await readPersistedState(page);
    expect(stableEvidenceSnapshot(afterReload)).toEqual(beforeReload);

    await expectImmutableSavedSurfaces(page, scenario, recordId as string, recordedAt as string);
    await expectNoHorizontalOverflow(page);
    await expectRuntimeClean(page, guards);
  });
}

test('legacy saved result remains readable without fabricated trial truth', async ({ page }) => {
  const guards = await installRuntimeGuards(page);
  await launchFixture(page, 'saved_result', 'legacy_trial_truth_not_collected');

  const state = await readPersistedState(page);
  const record = state.record;
  expect(record).not.toBeNull();
  expect(state.trialTruthEvidence).toBeNull();
  expect(record?.trialTruth).toBeUndefined();
  expect(record?.anchorRelationship).toBeUndefined();

  const recordId = record?.id as string;
  await expect(page.locator('[data-evidence-record]')).toHaveAttribute('data-record-id', recordId);
  await page.getByRole('button', { name: 'Full evidence record' }).click();
  const row = (id: string) => page.locator(`[data-evidence-row="${id}"]`);
  await expect(row('adherence')).toHaveAttribute('data-canonical-value', 'not_collected');
  await expect(row('tolerance-severity')).toHaveAttribute('data-canonical-value', 'not_collected');
  await expect(row('reported-symptoms')).toContainText('Not collected');
  await expect(row('participant-observation')).toContainText('Not collected');
  await expect(row('participant-report-timestamp')).toHaveAttribute(
    'data-canonical-value',
    'not_collected',
  );
  await expect(row('anchor-relationship')).toHaveAttribute('data-canonical-value', 'not_collected');

  const beforeReload = stableEvidenceSnapshot(state);
  await page.reload();
  const afterReload = await readPersistedState(page);
  expect(stableEvidenceSnapshot(afterReload)).toEqual(beforeReload);
  await expect(page.locator('[data-evidence-record]')).toHaveAttribute('data-record-id', recordId);

  await page.getByRole('button', { name: 'Back to previous view' }).click();
  await expect(page.locator('[data-latest-verdict-record]')).toHaveAttribute(
    'data-record-id',
    recordId,
  );
  await page.getByRole('button', { name: /Previous trials, 1 saved result/i }).click();
  await expect(page.locator('[data-archive-record]')).toHaveAttribute('data-record-id', recordId);
  await expectNoHorizontalOverflow(page);
  await expectRuntimeClean(page, guards);
});

test('trial truth keeps one stationary machine across steps, symptoms, widths, and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [
    { width: 320, height: 520 },
    { width: 390, height: 664 },
    { width: 430, height: 760 },
  ]) {
    await page.setViewportSize(viewport);
    await launchFixture(page, 'trial_truth', 'clear_favorable_change');
    await expect(page.locator('[data-fv-screen="trial-truth"]')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const geometry = async () =>
      page.evaluate(() => {
        const box = (selector: string) => {
          const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
          return {
            x: Math.round(rect.x * 10) / 10,
            y: Math.round(rect.y * 10) / 10,
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
          };
        };
        return {
          machine: box('[data-oracle-machine]'),
          identity: box('[data-trial-truth-product-identity]'),
          actuator: box('[data-trial-truth-center-actuator]'),
          amber: box('[data-trial-truth-confirmation]'),
        };
      });
    const initialGeometry = await geometry();
    await expect(page.locator('[data-oracle-specimen]')).toHaveCount(0);
    await expect(
      page.getByLabel('Registered product: Face Value Lab, One Thing Redness Trial, 10%, 30 ml'),
    ).toContainText('DEMO 01 · One Thing Redness Trial 10%');

    const disabledAction = page.getByRole('button', { name: 'Continue to skin response' });
    await expect(disabledAction).toBeDisabled();
    await expect(page.locator('[data-trial-truth-visible-control-label]')).toHaveText('');
    await expect(page.locator('[data-trial-truth-confirmation]')).toHaveAttribute(
      'data-amber-state',
      'idle',
    );
    await page.locator('[data-trial-truth-center-actuator]').evaluate((actuator) => {
      (actuator as HTMLElement).click();
    });
    await page.locator('[data-trial-truth-confirmation]').evaluate((amber) => {
      (amber as HTMLElement).click();
    });
    await expect(page.getByRole('group', { name: 'Did you use it as planned?' })).toBeVisible();

    await page.getByRole('radio', { name: 'YES' }).click();
    await expect(page.locator('[data-trial-truth-visible-control-label]')).toHaveText('CONTINUE');
    await expect(page.locator('[data-trial-truth-confirmation]')).toHaveAttribute(
      'data-amber-state',
      'ready',
    );
    await page.locator('[data-trial-truth-visible-control-label]').evaluate((label) => {
      (label as HTMLElement).click();
      (label as HTMLElement).click();
    });
    await expect(page.getByRole('heading', { name: 'How did your skin respond?' })).toBeFocused();
    expect(await geometry()).toEqual(initialGeometry);

    await page.getByRole('radio', { name: 'MILD' }).click();
    await expectFirmwareFits(page);
    const summary = page.getByRole('button', { name: 'Add reported symptoms' });
    await expect(summary).toContainText('WHAT DID YOU NOTICE?');
    await expect(summary).toContainText('ADD');
    await summary.click();
    await expect(page.getByRole('heading', { name: 'What did you notice?' })).toBeFocused();
    expect(await geometry()).toEqual(initialGeometry);
    await page.getByRole('checkbox', { name: 'Itching' }).click();
    await page.getByRole('checkbox', { name: 'Unusual sensitivity' }).click();
    await expect(page.getByRole('button', { name: 'Save signs' })).toBeEnabled();
    await expect(page.locator('[data-trial-truth-visible-control-label]')).toHaveText('SAVE SIGNS');
    await expectFirmwareFits(page);
    await page.locator('[data-trial-truth-confirmation]').click();
    await expect(page.getByRole('button', { name: 'Edit reported symptoms' })).toContainText(
      'Itching · Unusual sensitivity',
    );
    await expect(page.locator('[data-trial-truth-visible-control-label]')).toHaveText('CONTINUE');
    expect(await geometry()).toEqual(initialGeometry);

    await page.locator('[data-trial-truth-center-actuator]').click();
    await expect(
      page.getByRole('heading', {
        name: /Compared with the start of this trial, your visible redness looks/i,
      }),
    ).toBeFocused();
    expect(await geometry()).toEqual(initialGeometry);
    await expect(page.getByRole('button', { name: 'See result' })).toBeDisabled();
    await expect(page.locator('[data-trial-truth-visible-control-label]')).toHaveText('');
    await page.getByRole('radio', { name: 'LESS' }).click();
    await expect(page.locator('[data-trial-truth-visible-control-label]')).toHaveText('SEE RESULT');
    await expect(page.locator('[data-trial-truth-confirmation]')).toHaveAttribute(
      'data-amber-state',
      'ready',
    );
    await expectFirmwareFits(page);
    await expectNoHorizontalOverflow(page);

    if (viewport.width === 390) {
      const shadowBleed = await page.evaluate(() => {
        const screen = document
          .querySelector<HTMLElement>('[data-fv-screen="trial-truth"]')!
          .getBoundingClientRect();
        const chassis = document
          .querySelector<HTMLElement>('[data-oracle-chassis]')!
          .getBoundingClientRect();
        return {
          screenLeft: screen.left,
          screenRight: screen.right,
          chassisLeft: chassis.left,
          chassisRight: chassis.right,
          viewportWidth: document.documentElement.clientWidth,
        };
      });
      expect(shadowBleed.screenLeft).toBeLessThanOrEqual(0.5);
      expect(shadowBleed.screenRight).toBeGreaterThanOrEqual(shadowBleed.viewportWidth - 0.5);
      expect(shadowBleed.chassisLeft).toBeGreaterThan(shadowBleed.screenLeft);
      expect(shadowBleed.chassisRight).toBeLessThan(shadowBleed.screenRight);
    }

    for (const control of await page
      .locator('[data-fv-screen="trial-truth"] input, [data-fv-screen="trial-truth"] button')
      .all()) {
      const box = await control.boundingBox();
      expect(box, 'every interactive trial-truth control has a box').not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const viewportState = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      scrollY,
      animationName: getComputedStyle(
        document.querySelector<HTMLElement>('[data-motion-direction]')!,
      ).animationName,
    }));
    expect(viewportState.documentHeight).toBeLessThanOrEqual(viewportState.viewportHeight);
    expect(viewportState.scrollY).toBe(0);
    expect(viewportState.animationName).toBe('none');
  }
});

test('Trial Truth enabled amber uses the verdict-ready control treatment', async ({ page }) => {
  await launchFixture(page, 'trial_truth', 'clear_favorable_change');
  await page.getByRole('radio', { name: 'YES' }).click();
  await expect(page.locator('[data-trial-truth-confirmation]')).toHaveAttribute(
    'data-amber-state',
    'ready',
  );
  const trialTruthTreatment = await amberTreatment(page);

  await launchFixture(page, 'cassette_revealed', 'clear_favorable_change');
  await expect(page.locator('[data-oracle-amber-control]')).toHaveAttribute(
    'data-amber-state',
    'ready',
  );
  expect(await amberTreatment(page)).toEqual(trialTruthTreatment);
});

test('Demo Lab pill stays clear of the machine in expanded and collapsed Safari viewports', async ({
  page,
}) => {
  for (const height of [844, 664]) {
    await page.setViewportSize({ width: 390, height });
    await launchFixture(page, 'trial_truth', 'clear_favorable_change');
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
        return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
      };
      return {
        pill: rect('[data-demo-runtime-pill]'),
        machine: rect('[data-oracle-machine]'),
        amber: rect('[data-trial-truth-confirmation]'),
      };
    });
    const overlaps = (
      left: { top: number; right: number; bottom: number; left: number },
      right: { top: number; right: number; bottom: number; left: number },
    ) =>
      left.left < right.right &&
      left.right > right.left &&
      left.top < right.bottom &&
      left.bottom > right.top;

    expect(boxes.pill.top).toBeGreaterThanOrEqual(0);
    expect(boxes.pill.bottom).toBeLessThanOrEqual(66);
    expect(overlaps(boxes.pill, boxes.machine)).toBe(false);
    expect(overlaps(boxes.pill, boxes.amber)).toBe(false);
    await expectNoHorizontalOverflow(page);
  }
});
