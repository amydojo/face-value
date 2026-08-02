import { expect, test, type Page } from '@playwright/test';
import { REDNESS_CALIBRATION_STORAGE_KEY } from '../src/adapters/persistence/rednessCalibrationStore';
import {
  DEMO_ENVELOPE_SCHEMA,
  DEMO_JOURNEY_STORAGE_KEY,
  DEMO_ORIGIN,
} from '../src/adapters/persistence/demoJourneyStore';
import { toPersistedTrialTruthData } from '../src/adapters/persistence/trialTruthObservationStore';
import { buildDemoFixtureState } from '../src/features/demo-lab/demoFixtureState';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';

const demoBytes = JSON.stringify({
  schemaVersion: DEMO_ENVELOPE_SCHEMA,
  origin: DEMO_ORIGIN,
  mode: 'journey',
  startingPoint: 'home_saved_result',
  resultFixture: 'clear_favorable_change',
  savedAt: '2026-08-01T12:00:00.000Z',
  state: toPersistedTrialTruthData(
    buildDemoFixtureState('home_saved_result', 'clear_favorable_change'),
  ),
});

function monitorRuntime(page: Page) {
  const errors: string[] = [];
  const serverErrors: string[] = [];
  const providerRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('request', (request) => {
    if (/\/api\/youcam\//.test(request.url())) providerRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  return { errors, serverErrors, providerRequests };
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ ordinaryKey, ordinaryValue, demoKey, savedDemo }) => {
      if (localStorage.getItem(ordinaryKey) === null) {
        localStorage.setItem(ordinaryKey, JSON.stringify(ordinaryValue));
      }
      if (localStorage.getItem(demoKey) === null) {
        localStorage.setItem(demoKey, savedDemo);
      }
    },
    {
      ordinaryKey: STORAGE_KEY,
      ordinaryValue: persistedSealedTrial,
      demoKey: DEMO_JOURNEY_STORAGE_KEY,
      savedDemo: demoBytes,
    },
  );
});

test('synthetic calibration workflow remains face-free, isolated, and reproducible', async ({
  page,
}) => {
  const runtime = monitorRuntime(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/calibration/redness');

  await expect(page.getByRole('heading', { name: 'Redness calibration' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Collect a calibration observation' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'START LIVE THREE-FRAME COLLECTION' }),
  ).toBeEnabled();
  await expect(page.getByText(/CreditInsufficiency/)).toHaveCount(0);
  await expect(page.getByText('SYNTHETIC FACE-FREE FIXTURES', { exact: true })).toBeVisible();

  const ordinaryBefore = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  const demoBefore = await page.evaluate(
    (key) => localStorage.getItem(key),
    DEMO_JOURNEY_STORAGE_KEY,
  );
  const standard = page.getByRole('button', { name: 'ADD SYNTHETIC STANDARD RECAPTURES' });
  await standard.focus();
  await expect(standard).toBeFocused();
  expect(await standard.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none',
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Added 2 explicitly synthetic');
  await page.getByRole('button', { name: 'ADD SYNTHETIC NO-TREATMENT SESSIONS' }).click();
  await expect(page.getByRole('status')).toContainText('no treatment longitudinal');
  await page.getByRole('button', { name: 'ADD SYNTHETIC DEGRADED SESSION' }).click();
  await expect(page.getByText('syn-p01-degraded')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Exclusion inspection' }).getByText(/Degraded condition/),
  ).toBeVisible();

  const incrementalObservationCount = await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}') as { observations?: unknown[] };
    return value.observations?.length ?? 0;
  }, REDNESS_CALIBRATION_STORAGE_KEY);
  expect(incrementalObservationCount).toBe(5);

  await page.getByRole('button', { name: 'LOAD COMPLETE SYNTHETIC DATASET' }).click();
  const replacement = page.getByRole('dialog', {
    name: 'Replace isolated redness calibration data?',
  });
  await expect(replacement).toBeVisible();
  await expect(replacement.getByRole('button', { name: 'CANCEL' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(replacement).toBeHidden();
  await page.getByRole('button', { name: 'LOAD COMPLETE SYNTHETIC DATASET' }).click();
  await expect(replacement).toBeVisible();
  await replacement.getByRole('button', { name: 'CONFIRM CALIBRATION DATA CHANGE' }).click();

  await expect(page.getByText('PRELIMINARY INTERNAL ESTIMATE', { exact: true })).toHaveCount(8);
  for (const heading of [
    'Technical N95',
    'Longitudinal N95',
    'Repeatability coefficient',
    'Within-person SD',
    'ICC(A,1)',
    'Capture rejection rate',
    'Eligible sample',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  const provisional = page.locator('[data-candidate="provisional_5_10"]');
  await expect(provisional).toContainText('Currently used by consumer trials');
  await expect(provisional).toContainText('5');
  await expect(provisional).toContainText('10');
  const exploratory = page.locator('[data-candidate="technical_n95"]');
  await expect(exploratory).toContainText('Exploratory threshold candidate');
  await expect(
    page.getByText(/Production thresholds remain provisional: detectable boundary 5/),
  ).toBeVisible();
  await expect(page.getByText(/No automated skin-tone inference is used/)).toBeVisible();

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 430, height: 932 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('heading', { name: 'Calibration dashboard' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }

  await page.getByRole('button', { name: 'PREPARE FACE-FREE OBSERVATION EXPORT' }).click();
  const exportField = page.getByLabel('Canonical export');
  const observationExport = await exportField.inputValue();
  const observationEnvelope = JSON.parse(observationExport) as {
    schemaVersion: string;
    observations: unknown[];
  };
  expect(observationEnvelope.schemaVersion).toBe('face-value-redness-calibration-export-v1');
  expect(observationEnvelope.observations).toHaveLength(16);
  expect(observationExport).toContain('synthetic_face_free_fixture');
  expect(observationExport).not.toMatch(
    /data:image|blob:|https?:\/\/|provider.?task|raw.?payload|base64|image.?bytes|object.?url|email/i,
  );

  await page.getByRole('button', { name: 'PREPARE EXPLORATORY REGISTRY EXPORT' }).click();
  await expect(exportField).toHaveValue(/"threshold_source":"technical_calibration"/);
  const registry = JSON.parse(await exportField.inputValue()) as Record<string, unknown>;
  expect(registry).toMatchObject({
    threshold_source: 'technical_calibration',
    status: 'exploratory',
    approved_by: null,
    provisional: true,
  });
  expect(registry.config_hash).toMatch(/^sha256:[a-f0-9]{64}$/);

  await page.getByRole('button', { name: 'CLEAR CALIBRATION DATA' }).click();
  const clearDialog = page.getByRole('dialog', { name: 'Clear all redness calibration data?' });
  await expect(clearDialog).toContainText('Consumer trials, Previous Trials, and Demo Lab');
  await expect(clearDialog.getByRole('button', { name: 'CANCEL' })).toBeFocused();
  await clearDialog.getByRole('button', { name: 'CONFIRM CALIBRATION DATA CHANGE' }).click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), REDNESS_CALIBRATION_STORAGE_KEY),
  ).toBeNull();

  await page.getByLabel('Face-free observation import').fill(observationExport);
  await page.getByRole('button', { name: 'VALIDATE IMPORT FOR REPLACEMENT' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Replace isolated redness calibration data?' }),
  ).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'CONFIRM CALIBRATION DATA CHANGE' })
    .click();
  const importedObservationCount = await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}') as { observations?: unknown[] };
    return value.observations?.length ?? 0;
  }, REDNESS_CALIBRATION_STORAGE_KEY);
  expect(importedObservationCount).toBe(16);
  const importedSources = await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      observations?: Array<{ collectionSource?: string }>;
    };
    return [...new Set(value.observations?.map(({ collectionSource }) => collectionSource) ?? [])];
  }, REDNESS_CALIBRATION_STORAGE_KEY);
  expect(importedSources).toEqual(['imported_unverified']);
  await expect(page.getByText('Imported observation · Unverified provenance')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(ordinaryBefore);
  expect(await page.evaluate((key) => localStorage.getItem(key), DEMO_JOURNEY_STORAGE_KEY)).toBe(
    demoBefore,
  );

  await page.getByRole('link', { name: 'Demo Lab' }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { name: 'Demo Lab' })).toBeVisible();
  await expect(page.getByRole('link', { name: /OPEN REDNESS CALIBRATION/ })).toHaveAttribute(
    'href',
    '/calibration/redness',
  );
  await assertNoHorizontalOverflow(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(ordinaryBefore);
  expect(await page.evaluate((key) => localStorage.getItem(key), DEMO_JOURNEY_STORAGE_KEY)).toBe(
    demoBefore,
  );
  expect(runtime.providerRequests).toEqual([]);
  expect(runtime.errors).toEqual([]);
  expect(runtime.serverErrors).toEqual([]);
});
