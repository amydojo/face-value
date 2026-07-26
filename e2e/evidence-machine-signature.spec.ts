import { expect, test } from '@playwright/test';

const route = '/evidence-machine';

test.beforeEach(async ({ page }) => {
  await page.goto(route);
  await page.evaluate(() => localStorage.removeItem('face-value:evidence-machine-signature-demo:v1'));
  await page.reload();
});

test('releases, presents, collects, and opens detail without premature navigation', async ({ page }) => {
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-primary-action-owner', 'machine');
  const actuator = page.getByRole('button', { name: 'Release Evidence Record' });
  await expect(actuator).toBeVisible();
  await actuator.click();
  await expect(page).toHaveURL(new RegExp(`${route}$`));
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'actuator-pressed');
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented', { timeout: 3000 });
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-primary-action-owner', 'artifact');
  await page.getByRole('button', { name: /Collect Evidence Record/ }).click();
  await expect(page.getByText('YOUR EVIDENCE')).toBeVisible();
  await expect(page.locator('[data-artifact-mode="collected"]')).toBeVisible();
  await page.getByRole('button', { name: 'VIEW EVIDENCE DETAIL' }).click();
  await expect(page.getByRole('heading', { name: 'EVIDENCE DETAIL' })).toBeVisible();
});

test('double press creates one record and refresh restores presentation', async ({ page }) => {
  const actuator = page.getByRole('button', { name: 'Release Evidence Record' });
  await actuator.dblclick({ delay: 10 });
  await expect(page.locator('[data-evidence-record-artifact]')).toHaveCount(1, { timeout: 3000 });
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented');
  await page.reload();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented');
  await expect(page.getByRole('button', { name: /Collect Evidence Record/ })).toBeVisible();
});

test('works at mobile viewports without horizontal overflow', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Release Evidence Record' })).toBeVisible();
  }
});

test('reduced motion preserves production and collection meaning', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.getByRole('button', { name: 'Release Evidence Record' }).click();
  await expect(page.locator('[data-evidence-machine]')).toHaveAttribute('data-release-state', 'record-presented', { timeout: 1500 });
  await page.getByRole('button', { name: /Collect Evidence Record/ }).press('Enter');
  await expect(page.locator('[data-artifact-mode="collected"]')).toBeVisible();
});
