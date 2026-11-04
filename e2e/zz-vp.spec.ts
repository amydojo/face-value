import { test, type Page } from '@playwright/test';
import { analysisResultFromRednessEvaluation } from '../src/adapters/analysis/youcam/rednessEvidenceAdapter';
import { evaluateLiveScenario, type LiveScenario } from '../src/test/support/rednessScenarios';
import { persistedSealedTrial, STORAGE_KEY } from './phase-b5-fixtures';
const OUT = process.env.SHOTS_OUT!;
const snap = (o: Partial<LiveScenario>) => evaluateLiveScenario({ comparability: null, delta: 0, pattern: 'unanimous', intervalDays: 29, adherence: 'complete', tolerance: 'none', anchor: 0, context: 'none', ...o });
async function seed(page: Page, state: unknown) {
  await page.goto('/');
  await page.evaluate(({ key, value }) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(value)); }, { key: STORAGE_KEY, value: state });
  await page.reload();
}
const cases: Array<[string, Partial<LiveScenario>]> = [
  ['unfavorable', { delta: -20, anchor: -1 }], ['symptoms', { delta: -20, anchor: -1, tolerance: 'severe' }],
  ['unchanged', { delta: 0 }], ['favorable', { delta: 20, anchor: 1 }], ['unreadable', { delta: -20, context: 'makeup' }],
];
for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) for (const [name, o] of cases) {
  test(`${vp.width}x${vp.height} ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    const s = snap(o);
    await seed(page, { ...persistedSealedTrial, confidence: s.evidenceQuality, analysis: analysisResultFromRednessEvaluation(s), longitudinalEvidence: { ...persistedSealedTrial.longitudinalEvidence, evaluation: s } });
    await page.getByRole('button', { name: /Reveal sealed result for/i }).press('Enter');
    await page.locator('[data-oracle-machine][data-oracle-state="verdict_revealed"]').waitFor({ timeout: 8000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${vp.width}x${vp.height}-${name}.png` });
    const m = await page.evaluate(() => {
      const box = (sel: string) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
      return { vh: innerHeight, scrollY, guidance: box('[data-safety-guidance]'), guidanceTitle: box('[data-safety-guidance] strong'), firmware: box('[data-firmware-state="resolved"]'), save: box('button[aria-label="Save result"]') };
    });
    console.log('MEASURE', vp.width, vp.height, name, JSON.stringify(m));
  });
}
