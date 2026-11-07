import { expect, test } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';

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
];

const viewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route.name} at ${viewport.width}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      await page.screenshot({
        path: `.shots/${route.name}-${viewport.width}.png`,
        fullPage: true,
      });

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(viewport.width);
    });
  }
}
