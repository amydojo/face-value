import { expect, test } from '@playwright/test';
import { buildDemoFixtureState } from '../src/features/demo-lab/demoFixtureState';
import { STORAGE_KEY } from '../src/adapters/persistence/localObservationStore';
import { toPersistedTrialTruthData } from '../src/adapters/persistence/trialTruthObservationStore';

const scenarios = [
  ['clear_favorable_change', 'Less', 'None'],
  ['product_overlap', 'Less', 'None'],
  ['safety_interruption', 'More', 'Severe'],
  ['no_clear_change', 'Same', 'None'],
  ['worsening', 'More', 'None'],
  ['contradictory_anchor', 'More', 'None'],
  ['legacy_trial_truth_not_collected', 'Less', 'None'],
] as const;

for (const [fixture, visibleChange, tolerance] of scenarios) {
  test(`trial truth checkpoint: ${fixture}`, async ({ page }) => {
    const state = buildDemoFixtureState('trial_truth', fixture);
    const persisted = toPersistedTrialTruthData(state);
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: STORAGE_KEY,
      value: persisted,
    });
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.locator('[data-fv-screen="trial-truth"]')).toBeVisible();
    await expect(page.locator('body')).toHaveJSProperty(
      'scrollWidth',
      await page.locator('body').evaluate((body) => body.clientWidth),
    );

    await page.getByRole('radio', { name: 'Yes' }).check();
    await page.getByRole('radio', { name: tolerance }).check();
    if (tolerance === 'Severe') await page.getByRole('checkbox', { name: 'Swelling' }).check();
    await page.getByRole('radio', { name: visibleChange }).check();
    await page.getByRole('button', { name: /CONTINUE TO RESULT/i }).click();
    await expect(page.locator('[data-fv-screen="followup-context"]')).toBeVisible();
    await page.getByRole('button', { name: /NOTHING DIFFERENT/i }).click();
    await expect(page.locator('[data-fv-screen="oracle-reveal"]')).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
