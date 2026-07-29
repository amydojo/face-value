import { expect, test } from '@playwright/test';
import { STORAGE_KEY } from '../src/adapters/persistence/localObservationStore';

test('new specimen registration progresses once and releases the guided baseline CTA at ready', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();

  await page.getByRole('button', { name: 'LOAD A PRODUCT' }).click();
  const brand = page.getByLabel('Brand', { exact: true });
  await expect(brand).toHaveCount(1);
  await expect(brand).toHaveAttribute('name', 'brand');
  await brand.fill('Face Value Lab');
  await page.getByLabel('Product name', { exact: true }).fill('Hyaluronic Acid 1% Serum');
  await page.getByLabel('Volume', { exact: true }).fill('30 ml');

  const specimen = page.locator('[data-oracle-specimen]');
  const label = page.locator('[data-label-content]');
  await expect(specimen).toHaveAttribute('aria-hidden', 'true');
  await expect(specimen).not.toHaveAttribute('aria-label', /.+/);
  await expect(specimen).toHaveAttribute('data-specimen-product', 'Hyaluronic Acid 1% Serum');
  await expect(specimen).toHaveAttribute('data-specimen-volume', '30 ml');
  await expect(specimen).toHaveAttribute('data-display-product', 'HYALURONIC ACID');
  await expect(specimen).toHaveAttribute('data-display-strength', '1%');
  await expect(page.locator('[data-label-name-line]')).toHaveCount(2);
  await expect(label).toContainText('1%');
  await expect(label).not.toContainText('TOPICAL');
  await expect(label).not.toContainText('BASE');
  await expect(label).not.toContainText('30 ML');

  await page.clock.install({ time: new Date('2026-07-29T18:00:00.000Z') });
  await page.clock.pauseAt(new Date('2026-07-29T18:00:00.000Z'));
  await page.getByRole('button', { name: 'REGISTER & LOAD' }).click();

  const machine = page.locator('[data-oracle-machine]');
  const action = page.getByRole('button', { name: 'TAKE GUIDED BASELINE' });
  const status = page.getByRole('status');
  await expect(machine).toHaveAttribute('data-registration-phase', 'preparing');
  await expect(machine).toContainText('PREPARING');
  await expect(machine).toContainText('INITIALIZING');
  await expect(status).toHaveText('Preparing specimen registration.');
  await expect(action).toBeDisabled();

  await page.clock.runFor(300);
  await expect(machine).toHaveAttribute('data-registration-phase', 'aligning');
  await expect(machine).toContainText('ALIGNING SPECIMEN');
  await expect(action).toBeDisabled();

  await page.clock.runFor(500);
  await expect(machine).toHaveAttribute('data-registration-phase', 'scanning');
  await expect(machine).toContainText('REGISTERING SPECIMEN');
  await expect(specimen).toHaveAttribute('data-scan-state', 'active');
  await expect(page.locator('[data-label-scan-beam]')).toHaveAttribute(
    'data-label-scan-state',
    'active',
  );
  await expect(status).toHaveText('Registering specimen.');
  await expect(action).toBeDisabled();

  await page.clock.runFor(1_800);
  await expect(machine).toHaveAttribute('data-registration-phase', 'processing');
  await expect(machine).toContainText('VERIFYING SPECIMEN');
  await expect(specimen).toHaveAttribute('data-scan-state', 'inactive');
  await expect(action).toBeDisabled();

  await page.clock.runFor(600);
  await expect(machine).toHaveAttribute('data-registration-phase', 'verified');
  await expect(machine).toContainText('SPECIMEN VERIFIED');
  await expect(status).toHaveText('Specimen verified.');
  await expect(action).toBeDisabled();

  await page.clock.runFor(599);
  await expect(machine).toHaveAttribute('data-registration-phase', 'verified');
  await expect(action).toBeDisabled();
  await page.clock.runFor(1);

  await expect(machine).toHaveAttribute('data-registration-phase', 'ready');
  await expect(machine).toHaveAttribute('data-registration-complete', 'true');
  await expect(machine).toContainText('SPECIMEN LOADED');
  await expect(machine).toContainText('READY TO SCAN');
  await expect(status).toHaveText('Ready to take guided baseline.');
  await expect(action).toBeEnabled();
});
