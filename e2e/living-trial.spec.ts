import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { faceVideo, VIDEO_DIR } from './local-optics-videos';
import { expect, liveTracks, requestsOf, setVisibility, skipUnlessRealModel, test } from './local-optics-harness';

// THE LIVING TRIAL, end to end, with the REAL MediaPipe model on a generated camera video of a
// licensed still (Chromium's file-backed camera). Covers registration, the automatic baseline,
// consent and verified saving, a full browser restart from the same on-disk profile, check-ins,
// review, recovery from bad or blocked storage, permission and interruption paths, deletion,
// and what is (not) stored or sent. Chromium is not iOS Safari: Safari's own storage eviction and
// camera behaviour need the physical-iPhone protocol in docs/experiments/living-trial.md.

skipUnlessRealModel();
test.setTimeout(360_000);

const KEY = 'fv.livingTrial.v1';
const STEADY = faceVideo('steady');
/** The same steady scene in dimmer light (a lamp instead of daylight). */
const DIM = (() => {
  const target = join(VIDEO_DIR, 'face-steady-dim.y4m');
  if (existsSync(STEADY) && !existsSync(target)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', STEADY, '-vf', 'eq=brightness=-0.12', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', target]);
  }
  return target;
})();
/** The phone held much farther away. */
const FAR = faceVideo('far');
const SHOTS = process.env.FV_TRIAL_SHOTS_DIR;

const trialRoot = (page: Page) => page.locator('[data-living-trial]');
const screenIs = (page: Page, kind: string, timeout = 90_000) => expect(trialRoot(page)).toHaveAttribute('data-screen', kind, { timeout });
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), KEY);
const trialKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fv.livingTrial')).sort());

/** What the phone shows: the viewport, after the screen's short entrance has settled. */
async function shot(page: Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) });
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

/** Nothing technical on the person-facing screens. */
async function expectPlainLanguage(page: Page) {
  await expect(trialRoot(page)).not.toContainText(/mediapipe|landmark|tolerance|interocular|yaw|pitch|sha-?256|not_comparable|within_experimental/i);
}

async function register(page: Page, name = 'Azelaic acid serum', outcome = 'Reduce visible redness') {
  await page.getByLabel('Product').fill(name);
  await page.getByRole('button', { name: outcome, exact: true }).click();
}

/** A valid saved trial, as the app writes it; `days` shifts every timestamp into the past. */
function record({ days = 0, checkIns = 0, centerX = 0.5 }: { days?: number; checkIns?: number; centerX?: number } = {}) {
  const t = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  return JSON.stringify({
    schema: 'fv-living-trial',
    version: 1,
    id: 'seeded-trial',
    createdAt: t(days),
    updatedAt: t(days),
    consent: { storage: 'device-local', grantedAt: t(days), version: 'fv-trial-storage-consent-1' },
    product: { name: 'Niacinamide 10%', outcome: 'More even tone' },
    plan: { days: 14 },
    baseline: {
      capturedAt: t(days),
      trigger: 'auto',
      quality: 'passed',
      frame: { width: 360, height: 640 },
      guide: { version: 'fv-guided-baseline-0.1', orientation: 'portrait', centerX, centerY: 0.47, interocular: 0.3, roll: 0, yaw: 0, pitch: 5, faceLuma: 120, shading: 0 },
    },
    checkIns: Array.from({ length: checkIns }, (_, i) => ({ at: t(days - i - 1), trigger: 'auto', quality: 'passed', conditions: i % 2 ? 'not_matched' : 'matched', reasons: i % 2 ? ['light'] : [] })),
  });
}

async function seed(page: Page, value: string) {
  await page.goto('/trial');
  await page.evaluate(([key, v]) => localStorage.setItem(key, v), [KEY, value]);
  await page.reload();
}

/** Camera tracking and an optional "deny" switch, before any page script runs. */
async function instrument(target: Page | BrowserContext) {
  await target.addInitScript(() => {
    const w = window as unknown as { __tracks: MediaStreamTrack[]; __deny: boolean };
    w.__tracks = [];
    w.__deny = false;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (w.__deny) throw new DOMException('Permission denied', 'NotAllowedError');
      const stream = await original(constraints);
      w.__tracks.push(...stream.getTracks());
      return stream;
    };
  });
}

async function captureBaseline(page: Page) {
  await page.getByRole('button', { name: 'Capture baseline' }).click();
  await screenIs(page, 'capture');
  await expect(page.locator('[data-local-optics]')).toBeVisible();
  await screenIs(page, 'baseline_done');
}

async function checkIn(page: Page, expected: RegExp = /Conditions matched/) {
  await page.getByRole('button', { name: 'Start check-in' }).click();
  await screenIs(page, 'capture');
  await expect(page.getByText('Check-in', { exact: true })).toBeVisible({ timeout: 60_000 });
  await screenIs(page, 'check_in_done');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected);
}

test.describe('first visit, browser restart, return', () => {
  test('register, automatic baseline, save, close the browser, come back and keep going', async ({ playwright, launchOptions, baseURL }) => {
    const profile = mkdtempSync(join(tmpdir(), 'fv-trial-profile-'));
    const requests: { url: string; method: string }[] = [];
    const launch = async (video = STEADY) => {
      const context = await playwright.chromium.launchPersistentContext(profile, {
        ...launchOptions,
        args: [
          ...(launchOptions.args ?? []),
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
          `--use-file-for-fake-video-capture=${video}`,
        ],
        baseURL,
        permissions: ['camera'],
        viewport: { width: 390, height: 844 },
      });
      await instrument(context);
      const page = context.pages()[0] ?? (await context.newPage());
      page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
      return { context, page };
    };

    try {
      let { context, page } = await launch();

      // 1. First visit: what the trial is, before any camera or model.
      await page.goto('/trial');
      await screenIs(page, 'start');
      await expect(page.getByRole('heading', { name: 'One product. One claim.' })).toBeVisible();
      await expect(page.getByText('14 days', { exact: true })).toBeVisible();
      await expect(page.getByText('This version doesn’t measure your skin or judge the product.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Capture baseline' })).toBeDisabled();
      await expectPlainLanguage(page);
      await shot(page, '01-start-empty');
      await register(page);
      await expect(page.getByRole('button', { name: 'Capture baseline' })).toBeEnabled();
      await shot(page, '02-start-registered');
      expect(await page.evaluate(() => (window as unknown as { __tracks: unknown[] }).__tracks.length)).toBe(0);
      expect(requests.some((r) => r.url.includes('face_landmarker'))).toBe(false);

      // 2. The existing guided capture starts by itself and captures automatically.
      await page.getByRole('button', { name: 'Capture baseline' }).click();
      await expect(page.getByText('Baseline', { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-camera="on"]')).toHaveAttribute('data-cue', /aligned|capturing/, { timeout: 90_000 });
      await shot(page, '03-baseline-capture');
      await screenIs(page, 'baseline_done');
      await expect(page.getByRole('heading', { name: 'Baseline captured' })).toBeVisible();
      await expect(page.getByText(/It isn’t a reading of your skin/)).toBeVisible();
      await expect(page.getByText(/Not backed up, synced or encrypted/)).toBeVisible();
      await expect.poll(() => liveTracks(page)).toBe(0);
      await expect(page.locator('[data-local-optics]')).toHaveCount(0); // the capture screen and its in-memory data are gone
      expect(await trialKeys(page)).toEqual([]); // nothing saved before the person chooses
      await expectPlainLanguage(page);
      await shot(page, '04-baseline-done');

      // 3. Explicit, verified save.
      await page.getByRole('button', { name: 'Save trial on this device' }).click();
      await screenIs(page, 'home');
      await expect(page.locator('[data-banner]')).toHaveText('Saved on this device.');
      await expect(page.locator('[data-saved]')).toHaveAttribute('data-saved', 'yes');
      await shot(page, '05-home-saved');
      const saved = JSON.parse((await stored(page))!);
      expect(saved).toMatchObject({
        schema: 'fv-living-trial',
        version: 1,
        product: { name: 'Azelaic acid serum', outcome: 'Reduce visible redness' },
        consent: { storage: 'device-local', version: 'fv-trial-storage-consent-1' },
        baseline: { trigger: 'auto', quality: 'passed' },
        checkIns: [],
      });
      const baselineBefore = saved.baseline;

      // 4. Reload: straight back to the trial.
      await page.reload();
      await screenIs(page, 'home');
      await expect(page.getByText('Welcome back')).toBeVisible();

      // 5. Close the whole browser, reopen from the same profile on disk.
      await context.close();
      ({ context, page } = await launch());
      await page.goto('/trial');
      await screenIs(page, 'home');
      await expect(page.getByText('Welcome back')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Azelaic acid serum' })).toBeVisible();
      await expect(page.getByText('Reduce visible redness')).toBeVisible();
      await expect(page.locator('[data-day]')).toHaveText('Day 1 of 14');
      await expect(page.getByLabel('Product')).toHaveCount(0); // no re-registration
      await expect(page.getByRole('button', { name: /Save trial/ })).toHaveCount(0); // no repeated consent
      await expectPlainLanguage(page);
      await shot(page, '06-welcome-back');

      // 6. Two check-ins against the restored baseline, each kept.
      await checkIn(page);
      await expect(page.getByText('Skin change isn’t measured in this version.')).toBeVisible();
      await expect(page.locator('[data-check-in-save]')).toHaveAttribute('data-check-in-save', 'saved');
      await expectPlainLanguage(page);
      await shot(page, '07-check-in-matched');
      await page.getByRole('button', { name: 'Done' }).click();
      await screenIs(page, 'home');
      await expect(page.locator('[data-check-in-count]')).toHaveText('1');

      await checkIn(page);
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.locator('[data-check-in-count]')).toHaveText('2');

      await page.getByRole('button', { name: 'Review evidence' }).click();
      await screenIs(page, 'review');
      await expect(page.locator('[data-entry]')).toHaveCount(3);
      await expect(page.getByText('2 of 2 check-ins taken in conditions that matched your baseline.')).toBeVisible();
      await expect(page.getByText(/no redness score, improvement percentage or verdict/)).toBeVisible();
      await expect(trialRoot(page)).not.toContainText(/%|score:|improved|worked\b|effective/i);
      await shot(page, '08-review');

      const after = JSON.parse((await stored(page))!);
      expect(after.id).toBe(saved.id);
      expect(after.baseline).toEqual(baselineBefore); // never overwritten by a check-in
      expect(after.checkIns.map((c: { conditions: string; quality: string }) => [c.quality, c.conditions])).toEqual([
        ['passed', 'matched'],
        ['passed', 'matched'],
      ]);
      expect(after.checkIns.map((c: { trigger: string }) => c.trigger)).toEqual(['auto', 'auto']); // follow-ups captured themselves

      // 7. Back later in dimmer light: the guide holds the automatic capture; a manual one is kept
      //    and marked as not matching. The tolerance is unchanged.
      await context.close();
      ({ context, page } = await launch(DIM));
      await page.goto('/trial');
      await screenIs(page, 'home');
      await page.getByRole('button', { name: 'Start check-in' }).click();
      await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
      await expect(page.locator('[data-instruction]')).toHaveAttribute('data-category', 'light', { timeout: 30_000 });
      await page.waitForTimeout(3000);
      await expect(trialRoot(page)).toHaveAttribute('data-screen', 'capture');
      await page.getByRole('button', { name: 'Capture now' }).click();
      await screenIs(page, 'check_in_done');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conditions didn’t match');
      await expect(page.locator('[data-reasons]')).toContainText('The light was different');
      await expect(page.locator('[data-check-in-save]')).toHaveAttribute('data-check-in-save', 'saved');
      await shot(page, '15-check-in-different-light');
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.locator('[data-check-in-count]')).toHaveText('3');

      // 8. Back later holding the phone much farther away: the guide asks to come closer, never
      //    captures by itself, and the unchanged quality gates refuse a manual capture, so nothing
      //    is recorded.
      await context.close();
      ({ context, page } = await launch(FAR));
      await page.goto('/trial');
      await screenIs(page, 'home');
      await page.getByRole('button', { name: 'Start check-in' }).click();
      await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
      await expect(page.locator('[data-instruction]')).toHaveAttribute('data-instruction', 'move_closer', { timeout: 30_000 });
      await page.waitForTimeout(3000);
      await expect(trialRoot(page)).toHaveAttribute('data-screen', 'capture');
      await page.getByRole('button', { name: 'Capture now' }).click();
      await expect(page.locator('[data-notice]')).toBeVisible({ timeout: 30_000 });
      await expect(trialRoot(page)).toHaveAttribute('data-screen', 'capture');
      await shot(page, '16-check-in-too-far');
      await page.getByRole('button', { name: 'Cancel scan' }).click();
      await screenIs(page, 'home');
      await expect.poll(() => liveTracks(page)).toBe(0);
      await expect(page.locator('[data-check-in-count]')).toHaveText('3');

      const history = JSON.parse((await stored(page))!);
      expect(history.baseline).toEqual(baselineBefore);
      expect(history.checkIns.map((c: { trigger: string; conditions: string; reasons: string[] }) => [c.trigger, c.conditions, c.reasons])).toEqual([
        ['auto', 'matched', []],
        ['auto', 'matched', []],
        ['manual', 'not_matched', ['light']],
      ]);

      // 10. Only the documented record; nothing else kept; nothing sent anywhere.
      expect(await trialKeys(page)).toEqual([KEY]);
      const raw = (await stored(page))!;
      expect(raw).not.toMatch(/data:|base64|landmark|points|settings|userAgent|deviceId|faceHeight|edgeMargin/i);
      expect(raw.length).toBeLessThan(1500);
      expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
      expect(await page.evaluate(async () => (await caches.keys()).length)).toBe(0);
      expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).toEqual([]);
      const origin = new URL(page.url()).origin;
      expect(requests.filter((r) => !r.url.startsWith(origin))).toEqual([]);
      expect(requests.filter((r) => r.method !== 'GET')).toEqual([]);
      await context.close();
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  });
});

test.describe('restored baseline drives the guide', () => {
  test.use({ cameraVideo: STEADY });

  test('a check-in is guided to, and compared with, the SAVED baseline', async ({ page }) => {
    await page.goto('/trial');
    await register(page);
    await captureBaseline(page);
    await page.getByRole('button', { name: 'Save trial on this device' }).click();
    await screenIs(page, 'home');

    // Move the saved baseline's face position, as if the baseline had been framed differently.
    const original = JSON.parse((await stored(page))!);
    const moved = { ...original, baseline: { ...original.baseline, guide: { ...original.baseline.guide, centerX: Math.round((original.baseline.guide.centerX + 0.16) * 1000) / 1000 } } };
    await page.evaluate(([key, v]) => localStorage.setItem(key, v), [KEY, JSON.stringify(moved)]);
    await page.reload();
    await screenIs(page, 'home');

    await page.getByRole('button', { name: 'Start check-in' }).click();
    await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
    // The guide asks for the saved position, so the same unmoving face is never "aligned".
    await expect(page.locator('[data-instruction]')).toHaveAttribute('data-category', 'alignment', { timeout: 30_000 });
    await page.waitForTimeout(4000);
    await expect(trialRoot(page)).toHaveAttribute('data-screen', 'capture');
    await page.getByRole('button', { name: 'Capture now' }).click();
    await screenIs(page, 'check_in_done');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conditions didn’t match');
    await expect(page.locator('[data-reasons]')).toContainText('Your face sat elsewhere in the frame');
    await expect(page.getByText('It’s kept in your history, but not as a matched check-in.')).toBeVisible();
    await shot(page, '09-check-in-mismatch');

    const after = JSON.parse((await stored(page))!);
    expect(after.checkIns).toEqual([expect.objectContaining({ trigger: 'manual', conditions: 'not_matched', reasons: ['position'] })]);
    expect(after.baseline).toEqual(moved.baseline);
  });
});

test.describe('saved data that is old, missing, damaged or from another version', () => {
  test('elapsed time is shown from the saved dates; past the plan it says so', async ({ page }) => {
    await seed(page, record({ days: 3, checkIns: 2 }));
    await screenIs(page, 'home', 10_000);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.locator('[data-day]')).toHaveText('Day 4 of 14');
    await expect(page.getByText('3 days ago')).toBeVisible();
    await expect(page.locator('[data-check-in-count]')).toHaveText('2');
    await shot(page, '10-welcome-back-day-4');

    // The smallest supported phone: nothing scrolls sideways, the one action stays in view.
    await page.setViewportSize({ width: 320, height: 568 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    await expect(page.getByRole('button', { name: 'Start check-in' })).toBeInViewport();
    await shot(page, '10b-welcome-back-320x568');
    await page.setViewportSize({ width: 390, height: 844 });

    await seed(page, record({ days: 20 }));
    await expect(page.locator('[data-day]')).toHaveText('Day 21 · 14-day plan complete');
  });

  test('after the retention window it asks before keeping or deleting', async ({ page }) => {
    await seed(page, record({ days: 61 }));
    await screenIs(page, 'expired', 10_000);
    await expect(page.getByRole('heading', { name: 'Keep the Niacinamide 10% trial?' })).toBeVisible();
    expect(await stored(page)).not.toBeNull(); // asking is not deleting
    await page.getByRole('button', { name: 'Keep it' }).click();
    await screenIs(page, 'home');
    await page.reload();
    await screenIs(page, 'home');

    await seed(page, record({ days: 61 }));
    await page.getByRole('button', { name: 'Delete it' }).click();
    await screenIs(page, 'start');
    expect(await trialKeys(page)).toEqual([]);
  });

  test('missing data starts fresh; damaged data is set aside, never silently deleted', async ({ page }) => {
    await page.goto('/trial');
    await screenIs(page, 'start', 10_000);

    await seed(page, '{"schema":"fv-living-trial","version":1,"product":');
    await screenIs(page, 'unreadable', 10_000);
    await expect(page.locator('[data-unreadable]')).toHaveAttribute('data-unreadable', 'corrupt');
    await expect(page.getByText(/Nothing has been deleted/)).toBeVisible();
    await shot(page, '11-unreadable');
    await page.reload();
    await screenIs(page, 'unreadable', 10_000); // still there after a reload
    await page.getByRole('button', { name: 'Start a new trial' }).click();
    await screenIs(page, 'start');
    const keys = await trialKeys(page);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^fv\.livingTrial\.unreadable\./);
    expect(await page.evaluate((k) => localStorage.getItem(k), keys[0])).toBe('{"schema":"fv-living-trial","version":1,"product":');
  });

  test('a record from another version is explained, and deleted only after confirmation', async ({ page }) => {
    await seed(page, JSON.stringify({ ...JSON.parse(record()), version: 2 }));
    await screenIs(page, 'unreadable', 10_000);
    await expect(page.locator('[data-unreadable]')).toHaveAttribute('data-unreadable', 'incompatible');
    await expect(page.getByText(/saved by a different version/)).toBeVisible();
    await page.getByRole('button', { name: 'Delete the saved data instead' }).click();
    expect(await stored(page)).not.toBeNull();
    await page.getByRole('button', { name: 'Keep it' }).click();
    await page.getByRole('button', { name: 'Delete the saved data instead' }).click();
    await page.getByRole('button', { name: 'Delete it' }).click();
    await screenIs(page, 'start');
    await expect(page.locator('[data-banner]')).toHaveText('Saved trial data deleted.');
    expect(await trialKeys(page)).toEqual([]);
  });

  test('when the browser refuses every write, the trial still runs in the tab and says so', async ({ page }) => {
    // Older Safari Private Browsing and some blocked-storage settings: every write throws.
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };
    });
    await page.goto('/trial');
    await screenIs(page, 'start', 10_000);
    await expect(page.getByText(/can’t save website data right now/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Capture baseline' })).toBeDisabled();
    await register(page);
    await expect(page.getByRole('button', { name: 'Capture baseline' })).toBeEnabled();
  });
});

test.describe('storage blocked before the app starts', () => {
  test.use({ cameraVideo: STEADY });

  test('the trial opens and runs in the tab, and never claims to be saved', async ({ page }) => {
    // As Safari does with website data blocked: touching either storage object throws, from the
    // first script on the page, before React initialises.
    await page.addInitScript(() => {
      for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, name, {
          configurable: true,
          get() {
            throw new DOMException('The operation is insecure.', 'SecurityError');
          },
        });
      }
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/trial');
    await screenIs(page, 'start', 15_000);
    await expect(page.getByText(/can’t save website data right now, so this trial will last only while this tab is open/)).toBeVisible();
    await shot(page, '17-blocked-storage-start');
    await register(page);
    await captureBaseline(page);
    await expect(page.locator('[data-save-error]')).toHaveAttribute('data-save-error', 'unavailable');
    await expect(page.getByRole('button', { name: /Save trial/ })).toHaveCount(0); // no save to promise
    await shot(page, '18-blocked-storage-baseline');
    await page.getByRole('button', { name: 'Continue without saving' }).click();
    await screenIs(page, 'home');
    await expect(page.locator('[data-saved]')).toHaveAttribute('data-saved', 'no');
    await expect(page.locator('[data-saved]')).toHaveText('Not saved · this trial ends when you close this tab');

    await checkIn(page);
    await expect(page.locator('[data-check-in-save]')).toHaveText('Not saved on this device');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('[data-check-in-count]')).toHaveText('1');
    await page.getByRole('button', { name: 'Manage trial' }).click();
    await expect(page.locator('[data-saved]')).toHaveText('Not saved on this device');
    await expect(page.getByRole('button', { name: /Save trial/ })).toHaveCount(0);
    await expect(page.getByText(/Saved on this device/)).toHaveCount(0);
    expect(errors).toEqual([]);

    // The tab really is all there is: a reload starts over (still without crashing).
    await page.reload();
    await screenIs(page, 'start', 15_000);
    expect(errors).toEqual([]);
  });

  test('read-only storage still restores a saved trial, and a check-in that can’t be written says so', async ({ page }) => {
    await seed(page, record({ days: 1, checkIns: 1 }));
    await screenIs(page, 'home', 10_000);
    const before = await stored(page);
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };
    });
    await page.reload();
    await screenIs(page, 'home', 10_000);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.locator('[data-saved]')).toHaveAttribute('data-saved', 'yes');
    await page.getByRole('button', { name: 'Start check-in' }).click();
    await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Capture now' }).click();
    await screenIs(page, 'check_in_done');
    await expect(page.locator('[data-check-in-save]')).toHaveAttribute('data-check-in-save', 'quota');
    await expect(page.locator('[data-check-in-save]')).toContainText('Not saved.');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('[data-saved]')).toHaveAttribute('data-saved', 'partly');
    await expect(page.locator('[data-check-in-count]')).toHaveText('2');
    expect(await stored(page)).toBe(before); // the saved trial is untouched
  });
});

test.describe('Safari-style interruptions mid check-in', () => {
  test.use({ cameraVideo: STEADY });

  test('backgrounded: the camera stops, resumes on return, and the check-in completes; leaving records nothing', async ({ page }) => {
    await instrument(page);
    await page.goto('/trial');
    await register(page);
    await captureBaseline(page);
    await page.getByRole('button', { name: 'Save trial on this device' }).click();
    await screenIs(page, 'home');

    // App switcher / lock screen: hidden, then visible again.
    await page.getByRole('button', { name: 'Start check-in' }).click();
    await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
    await setVisibility(page, 'hidden');
    await expect.poll(() => liveTracks(page)).toBe(0);
    await setVisibility(page, 'visible');
    await page.getByRole('button', { name: 'Resume scan' }).click();
    await screenIs(page, 'check_in_done');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conditions matched');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('[data-check-in-count]')).toHaveText('1');

    // Safari discards the page mid-scan (pagehide, then a fresh load): back to the trial, nothing half-recorded.
    await page.getByRole('button', { name: 'Start check-in' }).click();
    await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
    await page.reload();
    await screenIs(page, 'home', 15_000);
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.locator('[data-check-in-count]')).toHaveText('1');
    expect(JSON.parse((await stored(page))!).checkIns).toHaveLength(1);
  });

  test('a new browser profile with no saved trial starts fresh', async ({ page }) => {
    await seed(page, record({ checkIns: 2 }));
    await screenIs(page, 'home', 10_000);
    const fresh = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } });
    const other = await fresh.newPage();
    await other.goto('/trial');
    await expect(other.locator('[data-living-trial]')).toHaveAttribute('data-screen', 'start', { timeout: 10_000 });
    await expect(other.getByLabel('Product')).toHaveValue('');
    await fresh.close();
    await expect(page.locator('[data-check-in-count]')).toHaveText('2');
  });
});

test.describe('failed saves and recovery', () => {
  test.use({ cameraVideo: STEADY });

  test('a blocked save is reported, the trial continues unsaved, and saving later works', async ({ page }) => {
    await page.addInitScript((key) => {
      const w = window as unknown as { __blockSave: boolean };
      w.__blockSave = true;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === key && w.__blockSave) throw new DOMException('The operation is insecure.', 'SecurityError');
        return original.call(this, k, v);
      };
    }, KEY);
    await page.goto('/trial');
    await register(page, 'Barrier cream', 'Less dryness');
    await captureBaseline(page);

    await page.getByRole('button', { name: 'Save trial on this device' }).click();
    await expect(page.locator('[data-save-error]')).toHaveAttribute('data-save-error', 'blocked');
    await expect(page.getByText('Not saved.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try saving again' })).toBeVisible();
    await shot(page, '12-save-failed');
    await page.getByRole('button', { name: 'Continue without saving' }).click();
    await screenIs(page, 'home');
    await expect(page.locator('[data-saved]')).toHaveAttribute('data-saved', 'no');
    await expect(page.locator('[data-saved]')).toContainText('this trial ends when you close this tab');

    // An unsaved check-in still works in the tab.
    await checkIn(page);
    await expect(page.locator('[data-check-in-save]')).toHaveAttribute('data-check-in-save', 'unsaved');
    await page.getByRole('button', { name: 'Done' }).click();

    // Manage offers the save again; once storage works, it is saved and verified.
    await page.getByRole('button', { name: 'Manage trial' }).click();
    await page.getByRole('button', { name: 'Save trial on this device' }).click();
    await expect(page.getByRole('alert')).toContainText('Not saved.');
    expect(await stored(page)).toBeNull();
    await page.evaluate(() => {
      (window as unknown as { __blockSave: boolean }).__blockSave = false;
    });
    await page.getByRole('button', { name: 'Save trial on this device' }).click();
    await screenIs(page, 'home');
    await expect(page.locator('[data-saved]')).toHaveAttribute('data-saved', 'yes');
    expect(JSON.parse((await stored(page))!)).toMatchObject({ product: { name: 'Barrier cream' }, checkIns: [{ conditions: 'matched' }] });
  });
});

test.describe('camera permission and interruption', () => {
  test.use({ cameraVideo: STEADY });

  test('denied camera explains itself; going back keeps what was typed', async ({ page }) => {
    await instrument(page);
    await page.goto('/trial');
    await page.evaluate(() => {
      (window as unknown as { __deny: boolean }).__deny = true;
    });
    await register(page, 'Retinal 0.1%', 'Something else');
    await page.getByLabel('Intended outcome').fill('Smoother texture');
    await page.getByRole('button', { name: 'Capture baseline' }).click();
    await expect(page.getByRole('heading', { name: 'Camera access is off' })).toBeVisible({ timeout: 30_000 });
    await shot(page, '13-camera-denied');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await screenIs(page, 'start');
    await expect(page.getByLabel('Product')).toHaveValue('Retinal 0.1%');
    await expect(page.getByLabel('Intended outcome')).toHaveValue('Smoother texture');
    expect(await trialKeys(page)).toEqual([]);
  });

  test('an interrupted check-in pauses, resumes, and cancelling records nothing', async ({ page }) => {
    await instrument(page);
    await seed(page, record({ checkIns: 1 }));
    await screenIs(page, 'home', 10_000);
    const before = await stored(page);
    await page.getByRole('button', { name: 'Start check-in' }).click();
    await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
    await page.evaluate(() => {
      const tracks = (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks;
      tracks.filter((t) => t.readyState === 'live').forEach((t) => t.dispatchEvent(new Event('ended')));
    });
    await expect(page.getByRole('heading', { name: 'Camera interrupted' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume scan' }).click();
    await expect(page.getByRole('button', { name: 'Capture now' })).toBeEnabled({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Cancel scan' }).click();
    await screenIs(page, 'home');
    await expect.poll(() => liveTracks(page)).toBe(0);
    expect(await stored(page)).toBe(before);
    await expect(page.locator('[data-check-in-count]')).toHaveText('1');
  });
});

test.describe('deleting', () => {
  test('a saved trial is deleted only after confirmation and is gone after a reload', async ({ page }) => {
    await seed(page, record({ days: 2, checkIns: 3 }));
    await page.getByRole('button', { name: 'Manage trial' }).click();
    await screenIs(page, 'manage');
    await expect(page.getByText(/Derived from your face, so treat them as personal/)).toBeVisible();
    await expect(page.getByText(/Safari may clear website data on its own after 7 days/)).toBeVisible();
    await shot(page, '14-manage');
    await page.getByRole('button', { name: 'Delete this trial' }).click();
    await expect(page.getByText('Delete the Niacinamide 10% trial from this device? This can’t be undone.')).toBeVisible();
    await page.getByRole('button', { name: 'Keep it' }).click();
    expect(await stored(page)).not.toBeNull();
    await page.getByRole('button', { name: 'Delete this trial' }).click();
    await page.getByRole('button', { name: 'Delete trial' }).click();
    await screenIs(page, 'start');
    await expect(page.locator('[data-banner]')).toHaveText('Trial deleted from this device.');
    expect(await trialKeys(page)).toEqual([]);
    await page.reload();
    await screenIs(page, 'start', 10_000);
    expect(requestsOf(page).filter((r) => r.method !== 'GET')).toEqual([]);
  });
});
