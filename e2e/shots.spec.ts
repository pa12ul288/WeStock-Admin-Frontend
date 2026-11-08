import { expect, test } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

/** Every phase 1 route. `name` is the screenshot file name; ids are the featured demo records. */
const routes = [
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/' },
  { name: 'farmers', path: '/farmers' },
  { name: 'farm', path: `/farms/${FEATURED.farms.shreeGanesh}` },
  { name: 'livestock', path: '/livestock' },
  { name: 'animal', path: `/animals/${FEATURED.animals.gauri}` },
  { name: 'reproduction', path: '/reproduction' },
  { name: 'milk-feed', path: '/milk-feed' },
  { name: 'health', path: '/health' },
  { name: 'analytics', path: '/analytics' },
  { name: 'staff', path: '/staff' },
  { name: 'dev-components', path: '/dev/components' },
];

const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route.name} at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (route.name !== 'login') await signIn(page);
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // The bell's badge means the shell's counts have loaded, so they are in the picture.
      if (route.name !== 'login') {
        await expect(page.getByRole('button', { name: /^Alerts, \d+ new$/ })).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      // The screens with their data in place, not their loading skeletons.
      if (route.name !== 'dev-components') {
        await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
      }
      await page.waitForTimeout(800);

      await page.screenshot({
        path: `.shots/${route.name}-${viewport.width}.png`,
        fullPage: true,
      });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(viewport.width);
    });
  }
}

test('add animal dialog at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/livestock');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add animal' }).click();
  await expect(page.getByRole('button', { name: 'Add animal' }).last()).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/add-animal-1440.png' });
});

test('insemination slip dialog at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/reproduction?stage=inseminated');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page
    .locator('tbody tr')
    .filter({ has: page.getByRole('switch', { checked: false }) })
    .getByRole('button', { name: /^View photo/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Mark verified' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/insemination-slip-1440.png' });
});

for (const stage of ['inseminated', 'pregnant']) {
  test(`reproduction ${stage} tab at 1440`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto(`/reproduction?stage=${stage}`);
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `.shots/reproduction-${stage}-1440.png`, fullPage: true });
  });
}

test('fix milk entry dialog at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/milk-feed');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit entry' }).first().click();
  await expect(page.getByRole('button', { name: 'Save fix' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/fix-milk-entry-1440.png' });
});

test('add entry dialog at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/milk-feed');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add entry' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/add-entry-1440.png' });
});

for (const width of [1440, 390]) {
  test(`milk and feed monthly at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/milk-feed?period=monthly&tab=feed');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Download \w+ report$/ })).toBeEnabled({
      timeout: 20_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `.shots/milk-feed-monthly-${width}.png`, fullPage: true });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}

test('add cycle dialog at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/reproduction');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add cycle' }).click();
  await expect(page.getByRole('button', { name: 'Add record' })).toBeEnabled();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/add-cycle-1440.png' });
});

test('vaccine schedule panel at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto(`/health?farm=${FEATURED.farms.shreeGanesh}`);
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vaccine schedule' }).click();
  await expect(page.getByRole('button', { name: /^Create \d+ reminders$/ })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/vaccine-schedule-1440.png' });
});

for (const width of [1440, 390]) {
  test(`health issues tab at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/health?tab=issues');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `.shots/health-issues-${width}.png`, fullPage: true });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  });
}

test('vaccine schedule panel at 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/health');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vaccine schedule' }).click();
  await expect(page.getByRole('button', { name: /^Create \d+ reminders?$/ })).toBeEnabled();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '.shots/vaccine-schedule-390.png', fullPage: true });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test('invite staff dialog at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/staff');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Invite staff' }).click();
  await expect(page.getByRole('dialog', { name: 'Invite staff' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/invite-staff-1440.png' });
});

test('invite staff from dashboard at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/');
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Invite staff' }).click();
  await expect(page.getByRole('dialog', { name: 'Invite staff' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/invite-staff-from-dashboard-1440.png' });
});
