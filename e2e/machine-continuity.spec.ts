import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  STORAGE_KEY,
  toPersistedDemoData,
} from '../src/adapters/persistence/localObservationStore';
import type { DemoStartingPoint } from '../src/domain/demoLab';
import { addCalendarDays } from '../src/domain/phaseB5';
import { buildDemoFixtureState } from '../src/features/demo-lab/demoFixtureState';

const evidenceDirectory = resolve(
  'docs/verification/machine-continuity-2026-07-28',
);

type RuntimeIssue = {
  kind: 'console' | 'page' | 'response';
  detail: string;
};

type ViewportSelector = {
  name: string;
  selector: string;
};

type OrdinaryFixture =
  | 'trial_pending'
  | 'followup_ready'
  | 'verdict_ready'
  | 'cassette_revealed'
  | 'home_saved_result';

const machineParts = {
  chassis: '[data-oracle-chassis]',
  carbon: '[data-oracle-carbon-texture]',
  bezel: '[data-oracle-display-opening]',
  glass: '[data-oracle-display-glass]',
  silhouette: '[data-oracle-specimen-silhouette]',
  lowerDeck: '[data-oracle-lower-deck]',
  slot: '[data-oracle-slot]',
  amber: '[data-oracle-amber-control]',
  handle: '[data-oracle-handle]',
  bottomRail: '[data-oracle-bottom-rail]',
  evidencePath: '[data-oracle-evidence-path]',
  slotLip: '[data-oracle-slot-lip]',
} as const;

const coreMachineSelectors: ViewportSelector[] = [
  { name: 'Oracle machine', selector: '[data-oracle-machine]' },
];

function collectRuntimeIssues(page: Page): RuntimeIssue[] {
  const issues: RuntimeIssue[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push({ kind: 'console', detail: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    issues.push({ kind: 'page', detail: error.message });
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      issues.push({
        kind: 'response',
        detail: `${response.status()} ${response.url()}`,
      });
    }
  });
  return issues;
}

function ordinaryFixture(startingPoint: OrdinaryFixture) {
  const state = buildDemoFixtureState(
    startingPoint,
    'clear_favorable_change',
  );

  if (startingPoint === 'trial_pending') {
    const baselineLockedAt = new Date().toISOString();
    state.baselineLockedAt = baselineLockedAt;
    state.followUpEligibleAt = addCalendarDays(baselineLockedAt, 14);
    state.demoTimelineAdvanced = false;
    if (state.baselineCapture) {
      state.baselineCapture.createdAt = baselineLockedAt;
    }
    if (state.longitudinalEvidence.baseline) {
      state.longitudinalEvidence.baseline.capturedAt = baselineLockedAt;
    }
  }

  return toPersistedDemoData(state);
}

async function openOrdinaryFixture(
  page: Page,
  startingPoint: OrdinaryFixture,
): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: STORAGE_KEY,
      value: ordinaryFixture(startingPoint),
    },
  );
  await page.reload();
}

async function openOrdinaryFirstRun(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
}

async function openDemoPreview(
  page: Page,
  startingPoint: Extract<DemoStartingPoint, 'trial_pending' | 'followup_ready'>,
): Promise<void> {
  await page.goto('/demo');
  await page
    .getByRole('combobox', { name: /Starting point/ })
    .selectOption(startingPoint);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function assertViewportContract(
  page: Page,
  selectors: ViewportSelector[],
): Promise<void> {
  const measurements = await page.evaluate((requestedSelectors) => {
    const viewport = {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
    const boxes = requestedSelectors.map(({ name, selector }) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { name, selector, box: null };
      const rect = element.getBoundingClientRect();
      return {
        name,
        selector,
        box: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        },
      };
    });
    const textScope = document.querySelector<HTMLElement>('[data-fv-screen]');
    const clippedText = textScope
      ? Array.from(textScope.querySelectorAll<HTMLElement>('*'))
          .filter((element) => {
            if (!element.textContent?.trim()) return false;
            if (element.children.length > 0) return false;
            if (element.closest('[aria-hidden="true"]')) return false;
            const style = getComputedStyle(element);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              Number(style.opacity) === 0
            ) {
              return false;
            }
            const rect = element.getBoundingClientRect();
            if (rect.width <= 1 || rect.height <= 1) return false;
            const clipsX =
              style.overflowX === 'hidden' || style.overflowX === 'clip';
            const clipsY =
              style.overflowY === 'hidden' || style.overflowY === 'clip';
            return (
              (clipsX && element.scrollWidth > element.clientWidth + 1) ||
              (clipsY && element.scrollHeight > element.clientHeight + 1) ||
              rect.left < -0.5 ||
              rect.right > viewport.width + 0.5 ||
              rect.top < -0.5 ||
              rect.bottom > viewport.height + 0.5
            );
          })
          .map((element) => element.textContent?.trim() ?? '')
      : [];

    return {
      viewport,
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      body: {
        width: document.body.scrollWidth,
        height: document.body.scrollHeight,
      },
      boxes,
      clippedText,
    };
  }, selectors);

  expect(measurements.document.width).toBeLessThanOrEqual(
    measurements.viewport.width,
  );
  expect(measurements.body.width).toBeLessThanOrEqual(
    measurements.viewport.width,
  );
  expect(measurements.document.height).toBeLessThanOrEqual(
    measurements.viewport.height,
  );
  expect(measurements.body.height).toBeLessThanOrEqual(
    measurements.viewport.height,
  );
  expect(measurements.clippedText).toEqual([]);

  for (const measurement of measurements.boxes) {
    expect(measurement.box, `${measurement.name} should exist`).not.toBeNull();
    if (!measurement.box) continue;
    expect(
      measurement.box.x,
      `${measurement.name} left edge`,
    ).toBeGreaterThanOrEqual(-0.5);
    expect(
      measurement.box.y,
      `${measurement.name} top edge`,
    ).toBeGreaterThanOrEqual(-0.5);
    expect(
      measurement.box.right,
      `${measurement.name} right edge`,
    ).toBeLessThanOrEqual(measurements.viewport.width + 0.5);
    expect(
      measurement.box.bottom,
      `${measurement.name} bottom edge`,
    ).toBeLessThanOrEqual(measurements.viewport.height + 0.5);
  }
}

async function capture(page: Page, fileName: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('main[data-fv-tone]').screenshot({
    path: resolve(evidenceDirectory, fileName),
    animations: 'disabled',
    scale: 'css',
  });
}

async function captureContactSheet(page: Page): Promise<void> {
  const frames = [
    ['01-home-latest-verdict-before-correction.png', 'UNCHANGED HOME · LATEST VERDICT'],
    ['02-repaired-first-run.png', 'REPAIRED · FIRST RUN'],
    ['03-repaired-trial-pending.png', 'REPAIRED · TRIAL PENDING'],
    ['04-repaired-followup-ready.png', 'REPAIRED · FOLLOW-UP READY'],
    ['05-existing-verdict-ready.png', 'UNCHANGED · VERDICT READY'],
    ['06-existing-revealed-verdict.png', 'UNCHANGED · REVEALED VERDICT'],
  ] as const;
  const cards = await Promise.all(
    frames.map(async ([fileName, label]) => ({
      label,
      source: `data:image/png;base64,${(
        await readFile(resolve(evidenceDirectory, fileName))
      ).toString('base64')}`,
    })),
  );

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            color: #eee9df;
            background: #060606;
            font: 600 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
            letter-spacing: .08em;
          }
          h1 { margin: 0 0 20px; font-size: 18px; }
          main { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
          figure { min-width: 0; margin: 0; }
          figcaption { min-height: 32px; padding: 0 2px 8px; color: #aaa49a; }
          img { width: 100%; height: auto; display: block; border: 1px solid #302e2a; }
        </style>
      </head>
      <body>
        <h1>FACE VALUE · MACHINE CONTINUITY REVIEW</h1>
        <main>
          ${cards
            .map(
              ({ label, source }) =>
                `<figure><figcaption>${label}</figcaption><img src="${source}" alt="" /></figure>`,
            )
            .join('')}
        </main>
      </body>
    </html>
  `);
  await page.screenshot({
    path: resolve(evidenceDirectory, '07-machine-continuity-comparison.png'),
    fullPage: true,
    scale: 'css',
  });
}

async function hardwareMetrics(page: Page) {
  return page.locator('[data-oracle-machine]').evaluate((machine, selectors) => {
    const rounded = (value: number) => Math.round(value * 100) / 100;
    const requiredPart = (selector: string) => {
      const part = machine.querySelector<HTMLElement>(selector);
      if (!part) throw new Error(`Missing Oracle hardware part: ${selector}`);
      return part;
    };
    const chassis = requiredPart(selectors.chassis);
    const chassisBox = chassis.getBoundingClientRect();
    const relativeBounds = (selector: string) => {
      const box = requiredPart(selector).getBoundingClientRect();
      return {
        x: rounded(box.x - chassisBox.x),
        y: rounded(box.y - chassisBox.y),
        width: rounded(box.width),
        height: rounded(box.height),
        right: rounded(box.right - chassisBox.x),
        bottom: rounded(box.bottom - chassisBox.y),
      };
    };
    const machineBox = machine.getBoundingClientRect();
    const chassisStyle = getComputedStyle(chassis);

    return {
      implementation: machine.getAttribute('data-machine-implementation'),
      partCounts: Object.fromEntries(
        Object.entries(selectors).map(([name, selector]) => [
          name,
          machine.querySelectorAll(selector).length,
        ]),
      ),
      machine: {
        width: rounded(machineBox.width),
        height: rounded(machineBox.height),
        aspectRatio: rounded(machineBox.width / machineBox.height),
        computedAspectRatio: getComputedStyle(machine).aspectRatio,
      },
      chassis: {
        width: rounded(chassisBox.width),
        height: rounded(chassisBox.height),
        aspectRatio: rounded(chassisBox.width / chassisBox.height),
        borderRadius: chassisStyle.borderRadius,
      },
      displayBezel: relativeBounds(selectors.bezel),
      lowerDeck: relativeBounds(selectors.lowerDeck),
      amberControl: relativeBounds(selectors.amber),
      pullHandle: relativeBounds(selectors.handle),
      bottomRail: relativeBounds(selectors.bottomRail),
    };
  }, machineParts);
}

async function activeScreenGeometry(page: Page) {
  return page.evaluate(() => {
    const rounded = (value: number) => Math.round(value * 100) / 100;
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing active-screen element: ${selector}`);
      const box = element.getBoundingClientRect();
      return {
        x: rounded(box.x),
        y: rounded(box.y),
        width: rounded(box.width),
        height: rounded(box.height),
      };
    };
    return {
      machine: bounds('[data-oracle-machine]'),
      timeline: bounds('[data-trial-timeline]'),
      action: bounds('[data-followup-action]'),
      previousTrials: bounds('[data-continuity-previous-trials]'),
    };
  });
}

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('First Run uses the original Oracle machine and fits at 390 × 844', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openOrdinaryFirstRun(page);

  await expect(page.locator('[data-fv-screen="welcome"]')).toBeVisible();
  await expect(page.locator('[data-trial-machine-state="empty"]')).toHaveAttribute(
    'data-machine-implementation',
    'oracle',
  );
  await expect(
    page.getByRole('heading', {
      name: 'Is your skincare actually doing anything?',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'START A PRODUCT TRIAL' }),
  ).toBeVisible();
  await expect(page.getByText('NO TRIAL LOADED')).toBeVisible();
  await expect(page.getByText('Insert one product to begin.')).toBeVisible();

  await assertViewportContract(page, [
    ...coreMachineSelectors,
    { name: 'primary action', selector: '[data-welcome-action]' },
    { name: 'privacy line', selector: '[data-welcome-privacy]' },
  ]);
  expect(runtimeIssues).toEqual([]);
});

test('First Run remains complete across supported mobile viewports', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await openOrdinaryFirstRun(page);
    await assertViewportContract(page, [
      ...coreMachineSelectors,
      { name: 'primary action', selector: '[data-welcome-action]' },
      { name: 'privacy line', selector: '[data-welcome-privacy]' },
    ]);
  }
  expect(runtimeIssues).toEqual([]);
});

test('Trial Pending renders live data, remains inert, and survives reload', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openOrdinaryFixture(page, 'trial_pending');

  const pendingMachine = page.locator('[data-trial-machine-state="pending"]');
  await expect(page.locator('[data-fv-screen="trial-pending"]')).toBeVisible();
  await expect(pendingMachine).toHaveAttribute(
    'data-machine-implementation',
    'oracle',
  );
  await expect(pendingMachine).toContainText('Face Value Lab');
  await expect(pendingMachine).toContainText('One Thing Redness Trial');
  await expect(pendingMachine).toContainText('Reduce visible redness');
  await expect(pendingMachine).toContainText('DAY 01 OF 14');
  await expect(page.locator('[data-followup-action="pending"]')).toContainText(
    'IN 14 DAYS',
  );
  await expect(
    page.getByRole('button', { name: 'Take follow-up scan' }),
  ).toHaveCount(0);

  await assertViewportContract(page, [
    ...coreMachineSelectors,
    { name: 'timeline', selector: '[data-trial-timeline]' },
    { name: 'follow-up action rail', selector: '[data-followup-action]' },
    {
      name: 'Previous Trials',
      selector: '[data-continuity-previous-trials]',
    },
  ]);

  await page.reload();
  await expect(page.locator('[data-trial-machine-state="pending"]')).toBeVisible();
  await expect(page.locator('[data-followup-action="pending"]')).toContainText(
    'IN 14 DAYS',
  );
  expect(runtimeIssues).toEqual([]);
});

test('Empty, pending, ready, and sealed verdict share exact hardware geometry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const metrics: Record<string, Awaited<ReturnType<typeof hardwareMetrics>>> = {};

  await openOrdinaryFirstRun(page);
  metrics.empty = await hardwareMetrics(page);

  for (const startingPoint of [
    'trial_pending',
    'followup_ready',
    'verdict_ready',
  ] as const) {
    await openOrdinaryFixture(page, startingPoint);
    metrics[startingPoint] = await hardwareMetrics(page);
  }

  expect(metrics.verdict_ready.implementation).toBe('oracle');
  expect(Object.values(metrics.verdict_ready.partCounts)).toEqual(
    Object.values(machineParts).map(() => 1),
  );
  expect(metrics.empty).toEqual(metrics.verdict_ready);
  expect(metrics.trial_pending).toEqual(metrics.verdict_ready);
  expect(metrics.followup_ready).toEqual(metrics.verdict_ready);
});

test('Pending and ready keep identical screen geometry and differ only by approved state', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openOrdinaryFixture(page, 'trial_pending');

  const pendingHardware = await hardwareMetrics(page);
  const pendingScreen = await activeScreenGeometry(page);
  await expect(page.locator('[data-trial-timeline]')).toHaveAttribute(
    'data-followup-state',
    'pending',
  );
  await expect(page.locator('[data-oracle-amber-control]')).toHaveAttribute(
    'data-amber-state',
    'trial-pending',
  );
  await expect(page.locator('[data-followup-action="pending"]')).toHaveAttribute(
    'role',
    'status',
  );

  await openOrdinaryFixture(page, 'followup_ready');
  const readyHardware = await hardwareMetrics(page);
  const readyScreen = await activeScreenGeometry(page);
  await expect(page.locator('[data-trial-timeline]')).toHaveAttribute(
    'data-followup-state',
    'ready',
  );
  await expect(page.locator('[data-oracle-amber-control]')).toHaveAttribute(
    'data-amber-state',
    'followup-ready',
  );
  const action = page.getByRole('button', { name: 'Take follow-up scan' });
  await expect(action).toBeVisible();

  expect(readyHardware).toEqual(pendingHardware);
  expect(readyScreen).toEqual(pendingScreen);

  await page.reload();
  await expect(page.locator('[data-trial-machine-state="followup-ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Take follow-up scan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Center your face' }),
  ).toBeVisible();
  expect(runtimeIssues).toEqual([]);
});

test('Trial Pending remains graceful across supported viewports and reduced motion', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await openOrdinaryFixture(page, 'trial_pending');
    await assertViewportContract(page, [
      ...coreMachineSelectors,
      { name: 'timeline', selector: '[data-trial-timeline]' },
      { name: 'follow-up action rail', selector: '[data-followup-action]' },
      {
        name: 'Previous Trials',
        selector: '[data-continuity-previous-trials]',
      },
    ]);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openOrdinaryFixture(page, 'trial_pending');
  await expect(page.locator('[data-followup-action="pending"]')).toHaveAttribute(
    'role',
    'status',
  );
  await assertViewportContract(page, [
    ...coreMachineSelectors,
    { name: 'timeline', selector: '[data-trial-timeline]' },
    { name: 'follow-up action rail', selector: '[data-followup-action]' },
    {
      name: 'Previous Trials',
      selector: '[data-continuity-previous-trials]',
    },
  ]);
  expect(runtimeIssues).toEqual([]);
});

test('Demo Lab pending and ready reach the same production Oracle implementation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemoPreview(page, 'trial_pending');
  await expect(page.locator('[data-trial-machine-state="pending"]')).toHaveAttribute(
    'data-machine-implementation',
    'oracle',
  );
  const pendingMetrics = await hardwareMetrics(page);

  await openDemoPreview(page, 'followup_ready');
  await expect(
    page.locator('[data-trial-machine-state="followup-ready"]'),
  ).toHaveAttribute('data-machine-implementation', 'oracle');
  expect(await hardwareMetrics(page)).toEqual(pendingMetrics);
});

test('captures the repaired states beside unchanged verdict references', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await openOrdinaryFixture(page, 'home_saved_result');
  await expect(page.locator('[data-latest-verdict-cassette]')).toBeVisible();
  await capture(page, '01-home-latest-verdict-before-correction.png');

  await openOrdinaryFirstRun(page);
  await capture(page, '02-repaired-first-run.png');

  await openOrdinaryFixture(page, 'trial_pending');
  await capture(page, '03-repaired-trial-pending.png');

  await openOrdinaryFixture(page, 'followup_ready');
  await capture(page, '04-repaired-followup-ready.png');

  await openOrdinaryFixture(page, 'verdict_ready');
  await expect(page.locator('[data-oracle-state="sealed"]')).toBeVisible();
  await capture(page, '05-existing-verdict-ready.png');

  await openOrdinaryFixture(page, 'cassette_revealed');
  await expect(page.locator('[data-oracle-state="verdict_revealed"]')).toBeVisible();
  await capture(page, '06-existing-revealed-verdict.png');

  await captureContactSheet(page);
});
