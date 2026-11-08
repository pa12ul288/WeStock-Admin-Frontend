import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const ROUTES = [
  { name: 'dashboard', path: '/' },
  { name: 'farmers', path: '/farmers' },
  { name: 'farms', path: '/farmers?view=farms' },
  { name: 'farm overview', path: `/farms/${FEATURED.farms.shreeGanesh}` },
  { name: 'farm sheds and members', path: `/farms/${FEATURED.farms.shreeGanesh}?tab=sheds` },
  { name: 'farm settings', path: `/farms/${FEATURED.farms.shreeGanesh}?tab=settings` },
  { name: 'livestock', path: '/livestock' },
  { name: 'animal', path: `/animals/${FEATURED.animals.gauri}` },
  { name: 'reproduction', path: '/reproduction' },
  { name: 'reproduction to verify', path: '/reproduction?stage=inseminated' },
  { name: 'reproduction pregnant', path: '/reproduction?stage=pregnant' },
  { name: 'milk and feed', path: '/milk-feed' },
  { name: 'health', path: '/health' },
  { name: 'health issues', path: '/health?tab=issues' },
  { name: 'analytics', path: '/analytics' },
  { name: 'staff', path: '/staff' },
];

async function serious(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return result.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes
        .slice(0, 4)
        .map((node) => node.target.join(' ') + ' :: ' + (node.failureSummary ?? '').split('\n')[1]),
      count: violation.nodes.length,
    }));
}

async function settled(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  // Charts and counts animate in; axe reads colours, so wait for them to stop.
  await page.waitForTimeout(1200);
}

test.describe('accessibility (axe, serious and critical)', () => {
  test('sign in and forgot password', async ({ page }) => {
    await page.goto('/login');
    await settled(page);
    expect(await serious(page)).toEqual([]);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await page.waitForTimeout(400);
    expect(await serious(page)).toEqual([]);
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const route of ROUTES) {
      test(`${route.name} at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await signIn(page);
        await page.goto(route.path);
        await settled(page);
        expect(await serious(page)).toEqual([]);
      });
    }
  }

  const dialogs = [
    { name: 'add animal', path: '/livestock', open: 'Add animal' },
    { name: 'add cycle', path: '/reproduction', open: 'Add cycle' },
    { name: 'add entry', path: '/milk-feed', open: 'Add entry' },
    { name: 'vaccine schedule', path: '/health', open: 'Vaccine schedule' },
    { name: 'invite staff', path: '/staff', open: /^Invite staff/ },
  ];
  for (const dialog of dialogs) {
    test(`${dialog.name} dialog`, async ({ page }) => {
      await signIn(page);
      await page.goto(dialog.path);
      await settled(page);
      await page.getByRole('button', { name: dialog.open }).first().click();
      // The vaccine schedule is a panel on the page, the others are dialogs.
      await expect(
        dialog.name === 'vaccine schedule'
          ? page.getByText('Creates a reminder for each animal')
          : page.getByRole('dialog'),
      ).toBeVisible();
      await page.waitForTimeout(600);
      expect(await serious(page)).toEqual([]);
    });
  }
});
