import { expect, test } from '@playwright/test';

test('returns an authenticated engineering gate session to Demo Lab in Mobile WebKit', async ({
  page,
}) => {
  const token = 'mobile-webkit-demo-return-token';
  const consoleMessages: string[] = [];
  let submittedToken: string | undefined;

  page.on('console', (message) => consoleMessages.push(message.text()));
  await page.route('**/api/youcam/session', async (route) => {
    expect(route.request().method()).toBe('POST');
    submittedToken = (route.request().postDataJSON() as { token?: string }).token;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        expiresAt: '2026-07-30T23:00:00.000Z',
      }),
    });
  });

  await page.goto('/youcam-spike?next=demo');
  await expect(
    page.getByText('Open the protected session to continue to Demo Lab.'),
  ).toBeVisible();
  await page.getByLabel('Protected demo token').fill(token);
  await page.getByRole('button', { name: 'OPEN PROTECTED SESSION' }).click();

  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { name: 'Demo Lab' })).toBeVisible();
  await expect(page.getByText('Load demo journey', { exact: true })).toBeVisible();
  expect(submittedToken).toBe(token);
  expect(page.url()).not.toContain(token);
  expect(await page.locator('html').textContent()).not.toContain(token);
  expect(await page.evaluate(() => {
    const values = (storage: Storage) => Array.from(
      { length: storage.length },
      (_, index) => {
        const key = storage.key(index);
        return key ? storage.getItem(key) ?? '' : '';
      },
    ).join('\n');
    return `${values(localStorage)}\n${values(sessionStorage)}`;
  })).not.toContain(token);
  expect(consoleMessages.join('\n')).not.toContain(token);
});
