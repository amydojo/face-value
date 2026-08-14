import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

async function openPreview(page: Page, startingPoint: string): Promise<void> {
  await page.goto('/demo');
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption(startingPoint);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function installCandidatePointerBoundary(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      [data-oracle-machine][data-cassette-variant='trial-truth'] {
        pointer-events: none !important;
      }

      [data-oracle-machine][data-cassette-variant='trial-truth'] [data-oracle-trial-truth-firmware],
      [data-oracle-machine][data-cassette-variant='trial-truth']
        [data-oracle-trial-truth-firmware]
        [data-trial-truth-firmware-view] {
        pointer-events: auto !important;
      }
    `,
  });
}

async function hitEvidence(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  if (!box) throw new Error('Control has no bounding box.');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return control.evaluate((element, tapPoint) => {
    const describe = (node: Element | null) => {
      if (!node) return null;
      const html = node as HTMLElement;
      const style = getComputedStyle(html);
      const before = getComputedStyle(html, '::before');
      const after = getComputedStyle(html, '::after');
      const rect = html.getBoundingClientRect();
      return {
        tag: html.tagName,
        id: html.id,
        className: html.className,
        data: Object.fromEntries(
          [...html.attributes]
            .filter((attribute) => attribute.name.startsWith('data-'))
            .map((attribute) => [attribute.name, attribute.value]),
        ),
        box: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        },
        style: {
          pointerEvents: style.pointerEvents,
          zIndex: style.zIndex,
          position: style.position,
          transform: style.transform,
          isolation: style.isolation,
          opacity: style.opacity,
          visibility: style.visibility,
          display: style.display,
        },
        before: {
          content: before.content,
          pointerEvents: before.pointerEvents,
          zIndex: before.zIndex,
          position: before.position,
          display: before.display,
        },
        after: {
          content: after.content,
          pointerEvents: after.pointerEvents,
          zIndex: after.zIndex,
          position: after.position,
          display: after.display,
        },
      };
    };

    const ancestors: Array<ReturnType<typeof describe>> = [];
    let ancestor: Element | null = element;
    while (ancestor && ancestor !== document.documentElement) {
      ancestors.push(describe(ancestor));
      ancestor = ancestor.parentElement;
    }

    return {
      point: tapPoint,
      target: describe(element),
      elementFromPoint: describe(document.elementFromPoint(tapPoint.x, tapPoint.y)),
      elementsFromPoint: document.elementsFromPoint(tapPoint.x, tapPoint.y).map(describe),
      ancestors,
    };
  }, point);
}

async function attach(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: 'application/json',
  });
}

async function physicalTapTarget(page: Page, point: { x: number; y: number }) {
  await page.evaluate(() => {
    (window as Window & { __fvLastPointerTarget?: string }).__fvLastPointerTarget = '';
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement | null;
        (window as Window & { __fvLastPointerTarget?: string }).__fvLastPointerTarget = target
          ? `${target.tagName}${target.id ? `#${target.id}` : ''}.${String(target.className)}`
          : 'null';
      },
      { capture: true, once: true },
    );
  });
  await page.touchscreen.tap(point.x, point.y);
  return page.evaluate(
    () => (window as Window & { __fvLastPointerTarget?: string }).__fvLastPointerTarget ?? '',
  );
}

test('candidate pointer boundary · Trial Truth physical radio tap', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, 'trial_truth');
  await installCandidatePointerBoundary(page);
  const control = page.getByRole('radio', { name: 'YES' });
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();

  const evidence = await hitEvidence(page, control);
  const pointerTarget = await physicalTapTarget(page, evidence.point);
  const pointerActivated = await control.isChecked();
  await attach(testInfo, 'candidate-trial-truth-hit-evidence', {
    ...evidence,
    pointerTarget,
    pointerActivated,
  });
  expect(pointerActivated).toBe(true);
});

test('candidate pointer boundary · Capture Context physical button tap', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, 'followup_context');
  await installCandidatePointerBoundary(page);
  const control = page.getByRole('button', { name: 'ADD CONTEXT' });
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();

  const evidence = await hitEvidence(page, control);
  const pointerTarget = await physicalTapTarget(page, evidence.point);
  const pointerActivated = await page.getByRole('heading', { name: 'What was different?' }).isVisible();
  await attach(testInfo, 'candidate-capture-context-hit-evidence', {
    ...evidence,
    pointerTarget,
    pointerActivated,
  });
  expect(pointerActivated).toBe(true);
});
