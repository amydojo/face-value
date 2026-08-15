import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  DEMO_JOURNEY_STORAGE_KEY,
  DEMO_PREVIEW_SESSION_KEY,
} from '../src/adapters/persistence/demoJourneyStore';
import { STORAGE_KEY, persistedSealedTrial } from './phase-b5-fixtures';

const captureDemoLabEvidence = process.env.CAPTURE_DEMO_LAB_EVIDENCE === 'true';
const demoLabEvidenceDirectory = resolve('docs/verification/demo-lab-55');

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectCaptureReady(page: Page, kind: 'baseline' | 'follow-up'): Promise<void> {
  const heading = kind === 'baseline' ? 'Baseline scan' : 'Follow-up scan';
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByText('Camera access comes next.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Position your face' })).toHaveCount(0);
}

async function openPreview(
  page: Page,
  startingPoint: string,
  resultFixture = 'clear_favorable_change',
): Promise<void> {
  await page.goto('/demo');
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption(startingPoint);
  await page.getByRole('combobox', { name: /Result fixture/ }).selectOption(resultFixture);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Synthetic demo state')).toContainText('LAB · SYNTHETIC');
  await expect(page.getByLabel('Synthetic demo state')).toHaveAttribute(
    'data-demo-runtime-mode',
    'preview',
  );
}

async function openJourney(
  page: Page,
  startingPoint: string,
  resultFixture = 'clear_favorable_change',
): Promise<void> {
  await page.goto('/demo');
  await page.getByRole('radio', { name: /Load demo journey/ }).check();
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption(startingPoint);
  await page.getByRole('combobox', { name: /Result fixture/ }).selectOption(resultFixture);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Replace isolated demo journey data?',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'CONFIRM AND LOAD' }).click();
  await expect(page).toHaveURL(/\?fv-demo-journey=1$/);
  await expect(page.getByLabel('Synthetic demo state')).toHaveAttribute(
    'data-demo-runtime-mode',
    'journey',
  );
}

async function captureDemoLabState(page: Page, fileName: string): Promise<void> {
  if (!captureDemoLabEvidence) return;
  await page.screenshot({
    path: resolve(demoLabEvidenceDirectory, fileName),
    animations: 'disabled',
    fullPage: true,
  });
}

test.beforeAll(async () => {
  if (captureDemoLabEvidence) {
    await mkdir(demoLabEvidenceDirectory, { recursive: true });
  }
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
    {
      key: STORAGE_KEY,
      value: persistedSealedTrial,
    },
  );
});

test('flagged development exposes one accessible Demo Lab without mobile overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');

  await expect(page.getByRole('heading', { name: 'Demo Lab' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Preview state/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Load demo journey/ })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Starting point/ })).toHaveValue(
    'followup_ready',
  );
  await expect(page.getByRole('combobox', { name: /Result fixture/ })).toHaveValue(
    'clear_favorable_change',
  );
  await expect(page.getByRole('button', { name: 'RUN REAL-CAMERA JOURNEY' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CLEAR DEMO DATA' })).toBeDisabled();

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test('preview state is one-shot and leaves ordinary trial persistence unchanged', async ({
  page,
}) => {
  await page.goto('/demo');
  const ordinaryBefore = await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, STORAGE_KEY);

  await page.getByRole('combobox', { name: /Starting point/ }).selectOption('home_saved_result');
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();

  await expect(page.getByLabel('Synthetic demo state')).toHaveAttribute(
    'data-demo-runtime-mode',
    'preview',
  );
  await expect(page.locator('[data-latest-verdict-record]')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(ordinaryBefore);
  await expect
    .poll(() => page.evaluate((key) => sessionStorage.getItem(key), DEMO_PREVIEW_SESSION_KEY))
    .toBeNull();

  await page.reload();
  await expect(page.getByLabel('Synthetic demo state')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(ordinaryBefore);
});

test('persistent journey survives reload and keeps Home, Previous Trials, and saved result aligned', async ({
  page,
}) => {
  await page.goto('/demo');
  await page.getByRole('radio', { name: /Load demo journey/ }).check();
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption('home_saved_result');
  await page.getByRole('combobox', { name: /Result fixture/ }).selectOption('product_overlap');
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Replace isolated demo journey data?',
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/demo$/);
  await page.getByRole('button', { name: 'CONFIRM AND LOAD' }).click();

  await expect(page).toHaveURL(/\?fv-demo-journey=1$/);
  await expect(page.getByLabel('Synthetic demo state')).toHaveAttribute(
    'data-demo-runtime-mode',
    'journey',
  );
  const latestRecord = page.locator('[data-latest-verdict-record]');
  await expect(latestRecord).toBeVisible();
  const recordId = await latestRecord.getAttribute('data-record-id');
  const finding = await latestRecord.locator('[data-evidence-finding]').innerText();
  const identity = await latestRecord.locator('[data-oracle-trial-identity]').innerText();
  const product = 'Face Value Lab · One Thing Redness Trial';
  const snapshotBeforeNavigation = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Expected a persisted demo journey.');
    return JSON.parse(raw).state.record.rednessEvaluation;
  }, DEMO_JOURNEY_STORAGE_KEY);

  await expect(latestRecord).toContainText(product);
  await expect(latestRecord).toContainText(/retry(?: it)? alone/i);

  await page.reload();
  await expect(page.getByLabel('Synthetic demo state')).toHaveAttribute(
    'data-demo-runtime-mode',
    'journey',
  );
  await expect(page.locator(`[data-record-id="${recordId}"]`)).toBeVisible();

  await page
    .getByRole('button', {
      name: /Previous trials, 1 saved result/,
    })
    .click();
  const archivedRecord = page.locator(`[data-archive-record][data-record-id="${recordId}"]`);
  await expect(archivedRecord).toContainText(identity);
  await expect(archivedRecord).toContainText(product);
  await expect(archivedRecord).toContainText(/retry(?: it)? alone/i);
  expect((await archivedRecord.innerText()).toLowerCase()).toContain(finding.toLowerCase());
  await archivedRecord.click();

  await expect(page.getByRole('heading', { name: 'Visible redness', exact: true })).toBeVisible();
  await expect(page.locator('[data-fv-part="screen-header"]')).toContainText(identity);
  const evidenceRecord = page.locator(`[data-evidence-record][data-record-id="${recordId}"]`);
  await expect(evidenceRecord).toContainText(product);
  await expect(evidenceRecord).toContainText(/retry(?: it)? alone/i);
  expect((await evidenceRecord.innerText()).toLowerCase()).toContain(finding.toLowerCase());
  const comparison = evidenceRecord.locator('[data-evidence-comparison]');
  await expect(comparison).toContainText(String(snapshotBeforeNavigation.baselineRawMedian));
  await expect(comparison).toContainText(String(snapshotBeforeNavigation.endpointRawMedian));
  await expect(comparison).toContainText(
    `${snapshotBeforeNavigation.rawScoreDelta > 0 ? '+' : ''}${snapshotBeforeNavigation.rawScoreDelta} points`,
  );

  const serializedDemo = await page.evaluate(
    (key) => localStorage.getItem(key),
    DEMO_JOURNEY_STORAGE_KEY,
  );
  const snapshotAfterNavigation = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Expected a persisted demo journey.');
    return JSON.parse(raw).state.record.rednessEvaluation;
  }, DEMO_JOURNEY_STORAGE_KEY);
  expect(snapshotAfterNavigation).toEqual(snapshotBeforeNavigation);
  expect(serializedDemo).toContain('"origin":"face-value-demo-lab"');
  expect(serializedDemo).toContain('"demoOriginated":true');
  expect(serializedDemo).not.toMatch(/data:image|blob:|base64|imageBytes|objectURL|MediaStream/);
  await assertNoHorizontalOverflow(page);
});

test('pending and ready machine journeys preserve timing and chassis geometry across reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openJourney(page, 'trial_pending');

  const pendingMachine = page.locator('[data-trial-machine-state="pending"]');
  await expect(pendingMachine).toBeVisible();
  await expect(page.locator('[data-followup-action="pending"]')).toContainText('IN 14 DAYS');
  await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toHaveCount(0);
  const pendingBox = await pendingMachine.boundingBox();
  const pendingTiming = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Expected a persisted pending demo journey.');
    const state = JSON.parse(raw).state;
    return {
      baselineLockedAt: state.baselineLockedAt,
      followUpEligibleAt: state.followUpEligibleAt,
      demoTimelineAdvanced: state.demoTimelineAdvanced,
    };
  }, DEMO_JOURNEY_STORAGE_KEY);
  expect(pendingTiming.demoTimelineAdvanced).toBe(false);

  await page.reload();
  await expect(page.locator('[data-trial-machine-state="pending"]')).toBeVisible();
  await expect(page.locator('[data-followup-action="pending"]')).toContainText('IN 14 DAYS');
  expect(
    await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error('Expected a reloaded pending demo journey.');
      const state = JSON.parse(raw).state;
      return {
        baselineLockedAt: state.baselineLockedAt,
        followUpEligibleAt: state.followUpEligibleAt,
        demoTimelineAdvanced: state.demoTimelineAdvanced,
      };
    }, DEMO_JOURNEY_STORAGE_KEY),
  ).toEqual(pendingTiming);

  await openJourney(page, 'followup_ready');
  const readyMachine = page.locator('[data-trial-machine-state="followup-ready"]');
  await expect(readyMachine).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toBeVisible();
  expect(await readyMachine.boundingBox()).toEqual(pendingBox);

  await page.reload();
  await expect(page.locator('[data-trial-machine-state="followup-ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Take follow-up scan' }).click();
  await expectCaptureReady(page, 'follow-up');
});

test('Evidence Record starting points resolve to the approved production inspection layers', async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      runtimeErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });

  for (const state of [
    {
      id: 'saved_result',
      layer: 'result',
      screenshot: '01-evidence-record-summary.png',
    },
    {
      id: 'evidence_record_reasoning_expanded',
      layer: 'evidence',
      screenshot: '02-evidence-record-reasoning-expanded.png',
    },
    {
      id: 'evidence_record_full_technical_expanded',
      layer: 'provider',
      screenshot: '03-evidence-record-full-technical-expanded.png',
    },
  ] as const) {
    await openPreview(page, state.id);
    const record = page.locator('[data-evidence-record]');
    await expect(record).toHaveAttribute('data-snapshot-kind', 'canonical');
    await expect(record).toHaveAttribute('data-current-layer', state.layer);

    if (state.layer === 'result') {
      await expect(page.getByRole('heading', { name: 'Visible redness', exact: true })).toBeVisible();
      await expect(record.locator('[data-evidence-comparison]')).toContainText('+12 points');
      await expect(page.getByRole('button', { name: 'Open evidence record' })).toBeVisible();
    } else if (state.layer === 'evidence') {
      const dialog = page.getByRole('dialog', { name: 'Evidence record' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('+12 points', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Technical record' })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Provider details' })).toBeVisible();
      await expect(page.getByText('Baseline median', { exact: true })).toBeVisible();
      await expect(page.getByText('Accepted frames', { exact: true })).toBeVisible();
    }

    await assertNoHorizontalOverflow(page);
    await captureDemoLabState(page, state.screenshot);
  }

  expect(runtimeErrors).toEqual([]);
});

test('core synthetic starting points open real production screens', async ({ page }) => {
  await openPreview(page, 'new_trial');
  await expect(page.locator('[data-fv-screen="welcome"]')).toBeVisible();
  await expect(page.locator('[data-trial-machine-state="empty"]')).toHaveAttribute(
    'data-machine-implementation',
    'oracle',
  );

  await openPreview(page, 'product_registered');
  await expect(page.locator('[data-fv-screen="baseline-ready"]')).toHaveAttribute(
    'data-ingestion-phase',
    'ready',
  );
  await expect(page.locator('[data-registration-panel]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'TAKE GUIDED BASELINE' })).toBeEnabled();

  await openPreview(page, 'baseline_ready');
  await expectCaptureReady(page, 'baseline');
  await expect(page.locator('[data-oracle-machine]')).toHaveCount(0);

  await openPreview(page, 'baseline_locked');
  const baselineLocked = page.locator('[data-fv-screen="baseline-locked"]');
  await expect(baselineLocked.getByText('BASELINE LOCKED', { exact: true })).toBeVisible();
  await expect(
    baselineLocked.getByRole('heading', { name: 'That’s everything for today.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'DONE' })).toBeVisible();

  await openPreview(page, 'trial_pending');
  await expect(page.locator('[data-fv-screen="trial-pending"]')).toBeVisible();
  await expect(page.locator('[data-trial-machine-state="pending"]')).toHaveAttribute(
    'data-machine-implementation',
    'oracle',
  );
  await expect(page.locator('[data-followup-action="pending"]')).toContainText('IN 14 DAYS');
  await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toHaveCount(0);

  await openPreview(page, 'followup_ready');
  await expect(page.locator('[data-fv-screen="followup-ready"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take follow-up scan' })).toBeVisible();

  await openPreview(page, 'comparison_processing');
  await expect(page.getByText('COMPARING', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Baseline ↔ follow-up' })).toBeVisible();
  await page.waitForTimeout(750);
  await expect(page.getByText('COMPARING', { exact: true })).toBeVisible();

  await openPreview(page, 'verdict_ready');
  await expect(page.locator('[data-oracle-machine]')).toHaveAttribute(
    'data-oracle-state',
    'sealed',
  );

  await openPreview(page, 'evidence_recorded');
  await expect(page.getByRole('heading', { name: 'EVIDENCE RECORDED' })).toBeVisible();

  await openPreview(page, 'saved_result');
  await expect(page.locator('[data-fv-screen="saved-result"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open evidence record' })).toBeVisible();
});

test('real-camera utility opens the ordinary journey without synthetic state', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'RUN REAL-CAMERA JOURNEY' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('Synthetic demo state')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'The result is in.' })).toBeVisible();
});

test('clear demo data removes only the isolated demo envelope', async ({ page }) => {
  await page.goto('/demo');
  const ordinaryBefore = await page.evaluate((key) => {
    return localStorage.getItem(key);
  }, STORAGE_KEY);
  await page.getByRole('radio', { name: /Load demo journey/ }).check();
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption('previous_trials');
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await page.getByRole('button', { name: 'CONFIRM AND LOAD' }).click();
  await expect(page.getByLabel('Synthetic demo state')).toBeVisible();

  await page.getByRole('link', { name: /Synthetic demo state/i }).click();
  await expect(page.getByRole('heading', { name: 'Demo Lab' })).toBeVisible();
  const ordinaryBeforeClear = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.getByRole('button', { name: 'CLEAR DEMO DATA' }).click();

  expect(
    await page.evaluate((key) => localStorage.getItem(key), DEMO_JOURNEY_STORAGE_KEY),
  ).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
    ordinaryBeforeClear,
  );
  expect(ordinaryBeforeClear).toBe(ordinaryBefore);
  await expect(page.getByRole('status')).toContainText('Ordinary saved trials were not changed.');
});
