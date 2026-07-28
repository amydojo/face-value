import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  STORAGE_KEY,
  toPersistedDemoData,
} from '../src/adapters/persistence/localObservationStore';
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

const coreMachineSelectors: ViewportSelector[] = [
  { name: 'machine', selector: '[data-machine-shell="canonical"]' },
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

async function seedOrdinaryState(
  page: Page,
  startingPoint: 'trial_pending' | 'followup_ready',
): Promise<void> {
  const state = buildDemoFixtureState(startingPoint, 'clear_favorable_change');

  if (startingPoint === 'trial_pending') {
    const baselineLockedAt = new Date().toISOString();
    state.baselineLockedAt = baselineLockedAt;
    state.followUpEligibleAt = addCalendarDays(baselineLockedAt, 14);
    if (state.baselineCapture) {
      state.baselineCapture.createdAt = baselineLockedAt;
    }
    if (state.longitudinalEvidence.baseline) {
      state.longitudinalEvidence.baseline.capturedAt = baselineLockedAt;
    }
  }

  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: STORAGE_KEY,
      value: toPersistedDemoData(state),
    },
  );
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
            return (
              element.scrollWidth > element.clientWidth + 1 ||
              element.scrollHeight > element.clientHeight + 1 ||
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
  expect(measurements.body.width).toBeLessThanOrEqual(measurements.viewport.width);
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
    expect(measurement.box.x, `${measurement.name} left edge`).toBeGreaterThanOrEqual(
      -0.5,
    );
    expect(measurement.box.y, `${measurement.name} top edge`).toBeGreaterThanOrEqual(
      -0.5,
    );
    expect(measurement.box.right, `${measurement.name} right edge`).toBeLessThanOrEqual(
      measurements.viewport.width + 0.5,
    );
    expect(measurement.box.bottom, `${measurement.name} bottom edge`).toBeLessThanOrEqual(
      measurements.viewport.height + 0.5,
    );
  }
}

async function capture(page: Page, fileName: string): Promise<void> {
  await page.screenshot({
    path: resolve(evidenceDirectory, fileName),
    animations: 'disabled',
    fullPage: true,
  });
}

async function machineBox(page: Page) {
  return page.locator('[data-machine-shell="canonical"]').boundingBox();
}

test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
});

test('First Run · Empty Case matches the 390 × 844 production composition', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('[data-fv-screen="welcome"]')).toBeVisible();
  await expect(page.locator('[data-machine-projection="empty"]')).toBeVisible();
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

  const box = await machineBox(page);
  expect(box?.x).toBeCloseTo(30, 0);
  expect(box?.y).toBeCloseTo(364, 0);
  expect(box?.width).toBeCloseTo(330, 0);
  expect(box?.height).toBeCloseTo(405.43, 0);
  await capture(page, '01-first-run-empty-case-390x844.png');
  expect(runtimeIssues).toEqual([]);
});

test('First Run remains complete across the supported mobile viewports', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await assertViewportContract(page, [
      ...coreMachineSelectors,
      { name: 'primary action', selector: '[data-welcome-action]' },
      { name: 'privacy line', selector: '[data-welcome-privacy]' },
    ]);
    if (viewport.width === 375) {
      await capture(page, '04-first-run-empty-case-375x812.png');
    }
  }
  expect(runtimeIssues).toEqual([]);
});

test('Trial Pending · Specimen Loaded meets the 390 × 844 contract and survives reload', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOrdinaryState(page, 'trial_pending');
  await page.goto('/');

  await expect(page.locator('[data-fv-screen="trial-pending"]')).toBeVisible();
  await expect(
    page.locator('[data-machine-projection="trial-pending"]'),
  ).toContainText('Face Value Lab');
  await expect(
    page.locator('[data-machine-projection="trial-pending"]'),
  ).toContainText('One Thing Redness Trial');
  await expect(page.locator('[data-machine-projection="trial-pending"]')).toContainText(
    'Reduce visible redness',
  );
  await expect(page.getByText('DAY 01 OF 14')).toBeVisible();
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

  const box = await machineBox(page);
  expect(box?.x).toBeCloseTo(30, 0);
  expect(box?.y).toBeCloseTo(116, 0);
  expect(box?.width).toBeCloseTo(330, 0);
  expect(box?.height).toBeCloseTo(405.43, 0);
  await capture(page, '02-trial-pending-specimen-loaded-390x844.png');

  await page.reload();
  await expect(page.locator('[data-fv-screen="trial-pending"]')).toBeVisible();
  await expect(page.locator('[data-followup-action="pending"]')).toContainText(
    'IN 14 DAYS',
  );
  expect(runtimeIssues).toEqual([]);
});

test('Follow-up Ready keeps the pending chassis geometry and opens existing capture', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedOrdinaryState(page, 'followup_ready');
  await page.goto('/');

  await expect(page.locator('[data-fv-screen="followup-ready"]')).toBeVisible();
  await expect(
    page.locator('[data-machine-projection="followup-ready"]'),
  ).toBeVisible();
  await expect(page.locator('[data-trial-timeline]')).toHaveAttribute(
    'data-followup-state',
    'ready',
  );
  const action = page.getByRole('button', { name: 'Take follow-up scan' });
  await expect(action).toBeVisible();
  await assertViewportContract(page, [
    ...coreMachineSelectors,
    { name: 'timeline', selector: '[data-trial-timeline]' },
    { name: 'follow-up action rail', selector: '[data-followup-action]' },
    {
      name: 'Previous Trials',
      selector: '[data-continuity-previous-trials]',
    },
  ]);

  const box = await machineBox(page);
  expect(box?.x).toBeCloseTo(30, 0);
  expect(box?.y).toBeCloseTo(116, 0);
  expect(box?.width).toBeCloseTo(330, 0);
  expect(box?.height).toBeCloseTo(405.43, 0);
  await capture(page, '03-follow-up-ready-390x844.png');

  await page.reload();
  await expect(page.locator('[data-fv-screen="followup-ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Take follow-up scan' }).click();
  await expect(
    page.getByRole('heading', { name: 'Center your face' }),
  ).toBeVisible();
  expect(runtimeIssues).toEqual([]);
});

test('Trial Pending remains graceful across the supported mobile viewports', async ({
  page,
}) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await seedOrdinaryState(page, 'trial_pending');
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 402, height: 874 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');

    await assertViewportContract(page, [
      ...coreMachineSelectors,
      { name: 'timeline', selector: '[data-trial-timeline]' },
      { name: 'follow-up action rail', selector: '[data-followup-action]' },
      {
        name: 'Previous Trials',
        selector: '[data-continuity-previous-trials]',
      },
    ]);
    if (viewport.width === 430) {
      await capture(page, '05-trial-pending-specimen-loaded-430x932.png');
    }
  }
  expect(runtimeIssues).toEqual([]);
});

test('reduced motion preserves Trial Pending semantics and geometry', async ({ page }) => {
  const runtimeIssues = collectRuntimeIssues(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedOrdinaryState(page, 'trial_pending');
  await page.goto('/');

  await expect(page.locator('[data-fv-screen="trial-pending"]')).toBeVisible();
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
  await capture(page, '06-trial-pending-reduced-motion-390x844.png');
  expect(runtimeIssues).toEqual([]);
});
