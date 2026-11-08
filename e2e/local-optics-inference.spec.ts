import { faceVideo, noFaceVideo, twoFacesVideo } from './local-optics-videos';
import {
  expect,
  expectSameOriginGets,
  instruction,
  liveTracks,
  open,
  requestsOf,
  root,
  scans,
  setVisibility,
  skipUnlessRealModel,
  startNext,
  test,
  waitForGuide,
  waitForPhase,
} from './local-optics-harness';

// Guided capture with the REAL MediaPipe model on generated camera videos of a licensed still
// (Chromium's file-backed camera). Real inference, pixels, gates and lifecycle; the "person" is a
// moving photograph and Chromium is not iOS Safari.

skipUnlessRealModel();
test.setTimeout(180_000);

test.describe('steady phone', () => {
  test.use({ cameraVideo: faceVideo('steady') });

  test('baseline then follow-up, captured automatically, matched, with nothing kept but numbers', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForGuide(page);
    await expect(page.getByText('Baseline', { exact: true })).toBeVisible();
    // StrictMode mounted, unmounted and remounted the route: exactly one live camera track.
    expect(await liveTracks(page)).toBe(1);

    // Aligned -> automatic capture is visible: the frame cue, the instruction, then the burst.
    const chamber = page.locator('[data-camera="on"]');
    await expect(chamber).toHaveAttribute('data-cue', 'aligned', { timeout: 60_000 });
    // The burst may already have begun by the time this is read; both are the handoff.
    await expect(instruction(page)).toContainText(/Hold it there|Capturing/);
    await expect(chamber).toHaveAttribute('data-cue', 'capturing', { timeout: 30_000 });
    await expect(page.locator('[data-shutter] + p')).toContainText(/Capturing · \d+ of 12/);
    await expect(page.locator('[data-panel="baseline"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Baseline captured' })).toBeVisible();
    // The camera stops as soon as the capture is accepted.
    await expect.poll(() => liveTracks(page)).toBe(0);

    await page.getByRole('button', { name: 'Scan follow-up' }).click();
    await waitForGuide(page);
    await expect(page.getByText('Follow-up', { exact: true })).toBeVisible();
    await expect(page.locator('[data-panel="match"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Experimental check. Not a validated comparison.')).toBeVisible();

    const log = await scans(page);
    expect(log.map((s) => [s.mode, s.outcome, s.trigger])).toEqual([
      ['baseline', 'accepted', 'auto'],
      ['follow_up', 'accepted', 'auto'],
    ]);
    expect(log[1].comparison).toBe('within_experimental_tolerances');
    for (const scan of log) {
      expect(scan.bursts.at(-1)).toMatchObject({ accepted: true, rejections: [], aligned: true });
      expect(scan.acceptedMs).toBeGreaterThan(scan.firstAlignedMs!);
    }

    // One-tap report, straight from the result screen: Lab, then Copy test report. Two taps, no
    // scrolling, labels or "Add pair".
    await page.getByRole('button', { name: 'Lab' }).click();
    const lab = page.locator('[data-local-optics-lab]');
    const copyReport = lab.getByRole('button', { name: 'Copy test report' });
    await expect(copyReport).toBeInViewport();
    await expect(lab.locator('[data-test-report-summary]')).toContainText('2 scans · 2 accepted · 0 refused bursts');
    await expect(lab.locator('[data-test-report-summary]')).toContainText('latest follow-up matched');
    await copyReport.click();
    await expect(lab.getByRole('status').filter({ hasText: 'Copied' })).toBeVisible();
    const reportText = await page.evaluate(() => navigator.clipboard.readText());
    const report = JSON.parse(reportText);
    expect(report).toMatchObject({
      reportVersion: 'fv-guided-test-report-0.1',
      device: { delegate: 'GPU', frame: { width: 360, height: 480, orientation: 'portrait' } },
      usability: { summary: { scans: 2, accepted: 2, rejectedBursts: 0 } },
      latestComparison: { label: 'follow-up 1', overall: 'within_experimental_tolerances' },
    });
    expect(report.usability.scans).toEqual(log);
    expect(report.comparisons).toHaveLength(1);
    expect(report.latestComparison.rows.length).toBeGreaterThan(8);
    // The detailed diagnostics are still there, collapsed.
    await expect(lab.locator('[data-local-optics-diagnostics]')).toBeHidden();
    await lab.getByText('Diagnostics and details').click();

    // Lab details: the comparison is there in numbers; the analysed frame is released once done.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(lab.locator('[data-local-optics-comparison]')).toHaveAttribute('data-local-optics-comparison', 'within_experimental_tolerances');
    await expect(lab.locator('[data-snapshot-released]')).toBeVisible();
    await lab.getByRole('textbox', { name: 'Pair label' }).fill('A01 repeat');
    await lab.getByRole('button', { name: 'Add pair to log' }).click();
    const exported = await lab.getByRole('textbox', { name: 'Numeric log JSON' }).inputValue();
    const usability = await lab.getByRole('textbox', { name: 'Usability log JSON' }).inputValue();
    for (const json of [exported, usability, JSON.stringify(log), reportText]) {
      expect(json).not.toMatch(/data:|blob:|deviceId|groupId|"points"|"x":|"faceHeight"/);
    }
    expect(reportText).not.toMatch(/userAgent|Mozilla|fv-guided-baseline/);
    expect(JSON.parse(exported).pairs[0]).toMatchObject({ label: 'A01 repeat', overall: 'within_experimental_tolerances' });

    expectSameOriginGets(page);
    expect(requestsOf(page).some((r) => r.url.endsWith('/face_landmarker.task'))).toBe(true);
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  });

  test('interruptions: backgrounding while aligning or capturing, and the OS ending the camera', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForGuide(page);

    // App switch while the guide runs: camera off, a clear way back.
    await setVisibility(page, 'hidden');
    await expect(page.locator('[data-panel="paused"]')).toBeVisible();
    await expect.poll(() => liveTracks(page)).toBe(0);
    await setVisibility(page, 'visible');
    await page.getByRole('button', { name: 'Resume scan' }).click();
    await waitForGuide(page);

    // App switch in the middle of a burst: the burst is abandoned, never half-accepted.
    await waitForPhase(page, 'capturing');
    await setVisibility(page, 'hidden');
    await expect(page.locator('[data-panel="paused"]')).toBeVisible();
    await setVisibility(page, 'visible');
    await page.getByRole('button', { name: 'Resume scan' }).click();
    await waitForGuide(page);

    // iOS ends the track itself (call, Control Centre camera, another app).
    await page.evaluate(() => {
      const tracks = (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks;
      tracks.filter((t) => t.readyState === 'live').forEach((t) => t.dispatchEvent(new Event('ended')));
    });
    await expect(page.getByRole('heading', { name: 'Camera interrupted' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume scan' }).click();
    await expect(page.locator('[data-panel="baseline"]')).toBeVisible({ timeout: 60_000 });

    const [scan] = await scans(page);
    expect(scan).toMatchObject({ outcome: 'accepted', interruptions: 3 });
    // The abandoned burst left no record of acceptance.
    expect(scan.bursts.filter((b) => b.accepted)).toHaveLength(1);
    await expect.poll(() => liveTracks(page)).toBe(0);
  });

  test('cancel at any point returns to the start with the camera released; leaving the page cleans up', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForGuide(page);
    await page.getByRole('button', { name: 'Cancel scan' }).click();
    await expect(page.getByRole('button', { name: 'Start scan' })).toBeVisible();
    await expect.poll(() => liveTracks(page)).toBe(0);

    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForPhase(page, 'capturing');
    await page.getByRole('button', { name: 'Cancel scan' }).click();
    await expect(page.getByRole('button', { name: 'Start scan' })).toBeEnabled();
    await expect.poll(() => liveTracks(page)).toBe(0);

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await page.getByRole('button', { name: 'Start scan' }).click();
    await expect(page.locator('[data-panel="baseline"]')).toBeVisible({ timeout: 60_000 });
    const log = await scans(page);
    expect(log.map((s) => s.outcome)).toEqual(['cancelled', 'cancelled', 'accepted']);
    expect(log[1].bursts).toEqual([]); // the cancelled burst was not evaluated
  });

  test('CPU delegate and Lab diagnostics on request', async ({ page }) => {
    await open(page, '?delegate=cpu');
    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForGuide(page);
    await page.getByRole('button', { name: 'Lab' }).click();
    await page.getByText('Diagnostics and details').click();
    const diagnostics = page.locator('[data-local-optics-diagnostics]');
    await expect(diagnostics.locator('[data-diagnostic="Delegate in use"] dd')).toHaveText('CPU');
    await expect(diagnostics.locator('[data-diagnostic="Secure context (HTTPS)"] dd')).toHaveText('yes');
    await expect(diagnostics.locator('[data-diagnostic="Frame"] dd')).toContainText('360×480 portrait');
    await expect(diagnostics.locator('[data-diagnostic="Model initialisation"] dd')).toHaveText(/^\d+ ms$/);
    await expect(page.locator('[data-local-optics-live]')).toContainText(/faces 1 · roll -?\d+\.\d°/);
    await expect(page.locator('[data-local-optics-model]')).toContainText('tasks-vision 0.10.35, CPU, same-origin');
  });
});

test.describe('drifting into place', () => {
  test.use({ cameraVideo: faceVideo('driftIn') });

  test('the guide corrects position, then captures; instructions never flicker', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForGuide(page);
    // Sample the visible instruction every 100 ms until the capture is accepted.
    const seen: { id: string; t: number }[] = [];
    const started = Date.now();
    while ((await root(page).getAttribute('data-phase')) !== 'result' && Date.now() - started < 90_000) {
      const id = (await instruction(page).getAttribute('data-instruction').catch(() => null)) ?? 'none';
      if (seen.at(-1)?.id !== id) seen.push({ id, t: Date.now() - started });
      await page.waitForTimeout(100);
    }
    await expect(page.locator('[data-panel="baseline"]')).toBeVisible();
    const [scan] = await scans(page);
    test.info().annotations.push({ type: 'instructions', description: JSON.stringify(seen) });
    // The loop restarts off-centre every 12 s; at least one centring correction is requested.
    expect(scan.instructions).toContain('center');
    // No corrective instruction stayed on screen for less than the dwell time (sampled every 100 ms).
    const visible = seen.filter((s) => !['aligned', 'none'].includes(s.id));
    for (let i = 0; i < visible.length - 1; i += 1) {
      const next = seen[seen.indexOf(visible[i]) + 1];
      expect(next.t - visible[i].t).toBeGreaterThanOrEqual(350); // 100 ms sampling
    }
  });
});

test.describe('no face', () => {
  test.use({ cameraVideo: noFaceVideo() });

  test('asks for a face, never auto-captures, and a manual capture is refused by the gates', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForGuide(page);
    await expect(instruction(page)).toHaveAttribute('data-instruction', 'no_face', { timeout: 15_000 });
    await expect(page.getByRole('status').filter({ hasText: 'Bring your face into view' })).toBeVisible();
    await page.waitForTimeout(3000);
    expect((await root(page).getAttribute('data-phase'))).toBe('live');
    await page.getByRole('button', { name: 'Capture now' }).click();
    await expect(page.locator('[data-notice]')).toContainText('Your face left the view', { timeout: 30_000 });
    await waitForPhase(page, 'live');
    await page.getByRole('button', { name: 'Cancel scan' }).click();
    const [scan] = await scans(page);
    expect(scan.outcome).toBe('cancelled');
    expect(scan.bursts).toEqual([expect.objectContaining({ trigger: 'manual', accepted: false, rejections: expect.arrayContaining(['no_face']) })]);
    // The report carries the refusal; no comparison exists without a follow-up.
    await page.getByRole('button', { name: 'Lab' }).click();
    await page.getByRole('button', { name: 'Copy test report' }).click();
    const report = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
    expect(report.usability.summary).toMatchObject({ scans: 1, accepted: 0, cancelled: 1, rejectedBursts: 1, manualRejectionRate: 1 });
    expect(report).toMatchObject({ comparisons: [], latestComparison: null });
  });
});

test.describe('two faces', () => {
  test.use({ cameraVideo: twoFacesVideo() });

  test('asks for one face and refuses a manual capture', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await waitForGuide(page);
    await expect(instruction(page)).toHaveAttribute('data-instruction', 'multiple_faces', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Capture now' }).click();
    await expect(page.locator('[data-notice]')).toContainText('Another face was in view', { timeout: 30_000 });
    expect(await scans(page)).toEqual([]); // still in progress: a refused burst is not an outcome
  });
});

test.describe('model integrity', () => {
  test.use({ cameraVideo: faceVideo('steady') });

  test('a model that fails its SHA-256 check never reaches the runtime, and the failure is clear', async ({ page }) => {
    await page.route('**/face_landmarker.task', (route) =>
      route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(1024, 7) }),
    );
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await expect(page.locator('[data-failure="model"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'The face guide couldn’t load' })).toBeVisible();
    await expect.poll(() => liveTracks(page)).toBe(0);
    expect(requestsOf(page).some((r) => r.url.endsWith('.wasm'))).toBe(false);
    await page.getByRole('button', { name: 'Lab' }).click();
    await page.getByText('Diagnostics and details').click();
    await expect(page.locator('[data-local-optics-model]')).toContainText('Model integrity check failed');

    // The real model comes back: "Try again" recovers without reloading.
    await page.unroute('**/face_landmarker.task');
    await page.getByRole('button', { name: 'Try again' }).click();
    await waitForGuide(page);
    await expect(root(page)).toHaveAttribute('data-phase', /live|capturing|result/);
    const log = await scans(page);
    expect(log[0].outcome).toBe('failed');
  });
});

test.describe('restart after a result', () => {
  test.use({ cameraVideo: faceVideo('steady') });

  test('“Start over with a new baseline” returns to a first scan', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Start scan' }).click();
    await expect(page.locator('[data-panel="baseline"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Match your baseline' })).toBeVisible();
    await page.getByRole('button', { name: 'Start over with a new baseline' }).click();
    await expect(page.getByRole('heading', { name: 'Face scan' })).toBeVisible();
    await startNext(page);
    await expect(page.getByText('Baseline', { exact: true })).toBeVisible();
  });
});
