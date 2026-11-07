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
