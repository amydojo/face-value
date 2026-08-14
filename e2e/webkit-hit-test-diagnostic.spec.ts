import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

async function openPreview(page: Page, startingPoint: string): Promise<void> {
  await page.goto('/demo');
  await page.getByRole('combobox', { name: /Starting point/ }).selectOption(startingPoint);
  await page.getByRole('button', { name: /OPEN DEMO STATE/ }).click();
  await expect(page).toHaveURL(/\/$/);
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
        role: html.getAttribute('role'),
        name: html.getAttribute('name'),
        type: html.getAttribute('type'),
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

test('WebKit hit-test evidence · Trial Truth radio', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, 'trial_truth');
  const control = page.getByRole('radio', { name: 'YES' });
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();

  const evidence = await hitEvidence(page, control);
  const pointerTarget = await physicalTapTarget(page, evidence.point);
  const pointerActivated = await control.isChecked();
  await attach(testInfo, 'trial-truth-hit-evidence', { ...evidence, pointerTarget, pointerActivated });

  await control.focus();
  await page.keyboard.press('Space');
  const keyboardActivated = await control.isChecked();
  await attach(testInfo, 'trial-truth-keyboard-evidence', { keyboardActivated });
  expect(keyboardActivated).toBe(true);

  await openPreview(page, 'trial_truth');
  const freshControl = page.getByRole('radio', { name: 'YES' });
  await freshControl.evaluate((element: HTMLInputElement) => element.click());
  const domClickActivated = await freshControl.isChecked();
  await attach(testInfo, 'trial-truth-dom-click-evidence', { domClickActivated });
  expect(domClickActivated).toBe(true);
});

test('WebKit hit-test evidence · follow-up Capture Context', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPreview(page, 'followup_context');
  const control = page.getByRole('button', { name: 'ADD CONTEXT' });
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();

  const evidence = await hitEvidence(page, control);
  const pointerTarget = await physicalTapTarget(page, evidence.point);
  const pointerActivated = await page.getByRole('heading', { name: 'What was different?' }).isVisible();
  await attach(testInfo, 'capture-context-hit-evidence', { ...evidence, pointerTarget, pointerActivated });

  await control.focus();
  await page.keyboard.press('Enter');
  const keyboardActivated = await page.getByRole('heading', { name: 'What was different?' }).isVisible();
  await attach(testInfo, 'capture-context-keyboard-evidence', { keyboardActivated });
  expect(keyboardActivated).toBe(true);

  await openPreview(page, 'followup_context');
  const freshControl = page.getByRole('button', { name: 'ADD CONTEXT' });
  await freshControl.evaluate((element: HTMLButtonElement) => element.click());
  const domClickActivated = await page.getByRole('heading', { name: 'What was different?' }).isVisible();
  await attach(testInfo, 'capture-context-dom-click-evidence', { domClickActivated });
  expect(domClickActivated).toBe(true);
});
