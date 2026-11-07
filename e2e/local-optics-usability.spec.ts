import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { faceVideo, type MotionName } from './local-optics-videos';
import {
  expect,
  open,
  root,
  scans,
  setVisibility,
  skipUnlessRealModel,
  startNext,
  test,
  waitForGuide,
  type Scan,
} from './local-optics-harness';

// EXPLORATORY USABILITY MEASURES for the guided capture, with the real model on simulated
// hand-held videos. Two regimes:
//   realtime  - the clip plays at normal speed: flow timing, corrections, recovery.
//   dilated   - the clip is slowed 8x so that, on a machine analysing a frame every ~260 ms, the
//               motion between analysed frames matches a phone analysing every ~32 ms. Burst
//               outcomes (motion gate pass/fail) are representative; durations are not.
// The numbers are written to a JSON report. Assertions cover invariants only; nothing here is a
// validated quality threshold, and the gates are not tuned to these results.

skipUnlessRealModel();
test.setTimeout(480_000);

const REPORT_DIR = process.env.FV_USABILITY_REPORT_DIR;

interface Trial {
  strategy: 'auto' | 'manual-immediate';
  wallMs: number;
  scan: Scan | null;
  note?: string;
}

function report(name: string, payload: Record<string, unknown>) {
  const body = JSON.stringify({ scenario: name, measuredAt: new Date().toISOString(), ...payload }, null, 2);
  writeFileSync(test.info().outputPath(`${name}.json`), body);
  if (REPORT_DIR) {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(join(REPORT_DIR, `${name}.json`), body);
  }
}

const last = async (page: Page) => (await scans(page)).at(-1) ?? null;

/** Starts a scan and lets the guide capture on its own, up to `budget` ms. */
async function auto(page: Page, budget: number): Promise<Trial> {
  const before = (await scans(page)).length;
  const started = Date.now();
  await startNext(page);
  await waitForGuide(page);
  const done = await expect(root(page))
    .toHaveAttribute('data-phase', 'result', { timeout: budget })
    .then(() => true)
    .catch(() => false);
  if (!done) await page.getByRole('button', { name: 'Cancel scan' }).click();
  const log = await scans(page);
  return { strategy: 'auto', wallMs: Date.now() - started, scan: log.length > before ? log.at(-1)! : null, note: done ? undefined : 'cancelled at budget' };
}

/** An impatient person: taps the shutter as soon as the guide runs, and again after a refusal. */
async function manual(page: Page, taps = 3): Promise<Trial> {
  const started = Date.now();
  await startNext(page);
  await waitForGuide(page);
  await page.waitForTimeout(300);
  for (let i = 0; i < taps; i += 1) {
    await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Capture now' }).click();
    await expect(root(page)).not.toHaveAttribute('data-phase', 'capturing', { timeout: 60_000 });
    if ((await root(page).getAttribute('data-phase')) === 'result') break;
    // An automatic burst may have started meanwhile; let it settle before tapping again.
    await expect(root(page)).not.toHaveAttribute('data-phase', 'capturing', { timeout: 60_000 });
    if ((await root(page).getAttribute('data-phase')) === 'result') break;
  }
  if ((await root(page).getAttribute('data-phase')) !== 'result') await page.getByRole('button', { name: 'Cancel scan' }).click();
  return { strategy: 'manual-immediate', wallMs: Date.now() - started, scan: await last(page) };
}

function invariants(trials: Trial[]) {
  for (const { scan } of trials) {
    if (!scan) continue;
    for (const burst of scan.bursts) {
      if (burst.accepted) expect(burst.rejections).toEqual([]); // nothing accepted past a gate
      if (burst.trigger === 'auto') expect(burst.aligned).toBe(true); // auto only after the window
    }
    if (scan.outcome === 'accepted') expect(scan.bursts.at(-1)!.accepted).toBe(true);
  }
}

function summary(trials: Trial[]) {
  const all = trials.flatMap((t) => t.scan?.bursts.map((b) => ({ ...b, strategy: t.strategy })) ?? []);
  const of = (strategy: Trial['strategy']) => {
    const ts = trials.filter((t) => t.strategy === strategy);
    const bursts = all.filter((b) => b.strategy === strategy);
    const accepted = ts.filter((t) => t.scan?.outcome === 'accepted');
    return {
      trials: ts.length,
      accepted: accepted.length,
      bursts: bursts.length,
      rejectedBursts: bursts.filter((b) => !b.accepted).length,
      rejectionReasons: bursts.flatMap((b) => b.rejections),
      landmarkMotion: bursts.map((b) => b.landmarkMotion),
      frameIntervalMs: bursts.map((b) => b.frameIntervalMs),
      timeToAcceptMs: accepted.map((t) => t.scan!.acceptedMs),
      guideToAcceptMs: accepted.map((t) => (t.scan!.acceptedMs ?? 0) - (t.scan!.guideReadyMs ?? 0)),
      corrections: ts.map((t) => t.scan?.corrections ?? null),
      comparisons: ts.map((t) => t.scan?.comparison ?? null),
      helpShown: ts.map((t) => t.scan?.helpShown ?? null),
    };
  };
  return { auto: of('auto'), manual: of('manual-immediate') };
}

function scenario(name: string, video: MotionName, dilate: number, run: (page: Page, trials: Trial[]) => Promise<Record<string, unknown> | void>) {
  test.describe(name, () => {
    test.use({ cameraVideo: faceVideo(video, dilate) });
    test(`usability: ${name}`, async ({ page }) => {
      const trials: Trial[] = [];
      const extra = (await run(page, trials)) ?? {};
      invariants(trials);
      const result = { regime: dilate === 1 ? 'realtime' : `dilated x${dilate}`, video, summary: summary(trials), trials, ...extra };
      report(name, result);
      test.info().annotations.push({ type: 'usability', description: JSON.stringify(result.summary) });
    });
  });
}

scenario('steady-realtime', 'steady', 1, async (page, trials) => {
  await open(page);
  for (let i = 0; i < 3; i += 1) trials.push(await auto(page, 60_000));
  expect(trials.every((t) => t.scan?.outcome === 'accepted')).toBe(true);

  // Recovery: the app goes to the background mid-scan, then the person comes back.
  await startNext(page);
  await waitForGuide(page);
  await setVisibility(page, 'hidden');
  await expect(page.locator('[data-panel="paused"]')).toBeVisible();
  await setVisibility(page, 'visible');
  const resumed = Date.now();
  await page.getByRole('button', { name: 'Resume scan' }).click();
  await expect(root(page)).toHaveAttribute('data-phase', 'result', { timeout: 60_000 });
  const recovered = await last(page);
  expect(recovered).toMatchObject({ outcome: 'accepted', interruptions: 1 });
  return { recovery: { resumeToResultMs: Date.now() - resumed, scan: recovered } };
});

scenario('drift-in-realtime', 'driftIn', 1, async (page, trials) => {
  await open(page);
  for (let i = 0; i < 3; i += 1) trials.push(await auto(page, 60_000));
  expect(trials.filter((t) => t.scan?.outcome === 'accepted').length).toBeGreaterThanOrEqual(2);
});

scenario('handheld-calm-dilated', 'handheld', 8, async (page, trials) => {
  await open(page);
  for (let i = 0; i < 3; i += 1) trials.push(await auto(page, 60_000));
  for (let i = 0; i < 3; i += 1) trials.push(await manual(page));
  // Success criterion for natural, calm hand-holding: automatic capture completes.
  expect(trials.filter((t) => t.strategy === 'auto' && t.scan?.outcome === 'accepted').length).toBeGreaterThanOrEqual(2);
});

scenario('handheld-active-dilated', 'handheldActive', 8, async (page, trials) => {
  await open(page);
  for (let i = 0; i < 3; i += 1) trials.push(await auto(page, 60_000));
  for (let i = 0; i < 3; i += 1) trials.push(await manual(page));
});

scenario('shaky-dilated', 'shaky', 8, async (page, trials) => {
  await open(page, '?helpAfter=10');
  trials.push(await auto(page, 25_000));
  // The guide never fires on a shaking phone, and the escape route appears.
  expect(trials[0].scan?.bursts.filter((b) => b.trigger === 'auto') ?? []).toEqual([]);
  expect(trials[0].scan?.helpShown).toBe(true);
  // Forcing it manually is refused by the motion gate; nothing is silently accepted.
  trials.push(await manual(page, 2));
  const manualBursts = trials[1].scan?.bursts ?? [];
  expect(manualBursts.length).toBeGreaterThan(0);
  for (const burst of manualBursts) {
    if (!burst.accepted) expect(burst.rejections).toContain('motion');
  }
});

scenario('too-far-realtime', 'far', 1, async (page, trials) => {
  await open(page, '?helpAfter=10');
  trials.push(await auto(page, 20_000));
  expect(trials[0].scan?.outcome).toBe('cancelled');
  expect(trials[0].scan?.instructions).toContain('move_closer');
  expect(trials[0].scan?.bursts).toEqual([]);
  expect(trials[0].scan?.helpShown).toBe(true);
});
