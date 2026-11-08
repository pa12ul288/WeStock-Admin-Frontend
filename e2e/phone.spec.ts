import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

/** Phone checks at 390 px: every dialog fits, tables scroll inside their card, the page never does. */
const PHONE = { width: 390, height: 844 };
const FARM = `/farms/${FEATURED.farms.shreeGanesh}`;

async function ready(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
}

async function noSidewaysScroll(page: Page) {
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    view: document.documentElement.clientWidth,
  }));
  expect(widths.page).toBeLessThanOrEqual(widths.view);
}

const SCREENS = [
  '/',
  '/farmers',
  '/farmers?view=farms',
  FARM,
  `${FARM}?tab=sheds`,
  `${FARM}?tab=settings`,
  '/livestock',
  `/animals/${FEATURED.animals.gauri}`,
  '/reproduction',
  '/reproduction?stage=inseminated',
  '/reproduction?stage=pregnant',
  '/milk-feed',
  '/milk-feed?view=monthly',
  '/health',
  '/health?tab=issues',
  '/analytics',
  '/staff',
];

test.describe('phone, 390 px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page);
  });

  for (const path of SCREENS) {
    test(`${path} has no sideways page scroll, and tables scroll inside their card`, async ({
      page,
    }) => {
      await page.goto(path);
      await ready(page);
      await noSidewaysScroll(page);
      // Every table sits in a scroller that is no wider than the screen.
      const scrollers = await page.locator('table').evaluateAll((tables) =>
        tables.map((table) => {
          const box = table.parentElement as HTMLElement;
          const rect = box.getBoundingClientRect();
          return { right: rect.right, left: rect.left, overflow: getComputedStyle(box).overflowX };
        }),
      );
      for (const box of scrollers) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(PHONE.width);
        expect(['auto', 'scroll']).toContain(box.overflow);
      }
    });
  }

  const dialogs: { name: string; path: string; open: (page: Page) => Promise<void> }[] = [
    {
      name: 'add animal',
      path: '/livestock',
      open: (page) => page.getByRole('button', { name: 'Add animal' }).first().click(),
    },
    {
      name: 'add cycle',
      path: '/reproduction',
      open: (page) => page.getByRole('button', { name: 'Add cycle' }).first().click(),
    },
    {
      name: 'add entry',
      path: '/milk-feed',
      open: (page) => page.getByRole('button', { name: 'Add entry', exact: true }).click(),
    },
    {
      name: 'fix entry',
      path: '/milk-feed',
      open: (page) => page.getByRole('button', { name: 'Edit entry' }).first().click(),
    },
    {
      name: 'slip',
      path: '/reproduction?stage=inseminated',
      open: (page) =>
        page
          .getByRole('button', { name: /^View photo/ })
          .first()
          .click(),
    },
    {
      name: 'invite staff',
      path: '/staff',
      open: (page) =>
        page
          .getByRole('button', { name: /^Invite staff/ })
          .first()
          .click(),
    },
    {
      name: 'add shed',
      path: `${FARM}?tab=sheds`,
      open: (page) => page.getByRole('button', { name: 'Add shed' }).click(),
    },
    {
      name: 'add member',
      path: `${FARM}?tab=sheds`,
      open: (page) => page.getByRole('button', { name: 'Add member' }).click(),
    },
    {
      name: 'transfer ownership',
      path: `${FARM}?tab=settings`,
      open: (page) => page.getByRole('button', { name: 'Transfer ownership' }).click(),
    },
    {
      name: 'delete farm',
      path: `${FARM}?tab=settings`,
      open: (page) => page.getByRole('button', { name: /^Delete farm/ }).click(),
    },
    {
      name: 'add animal on a farm page',
      path: FARM,
      open: (page) =>
        page
          .getByRole('button', { name: /^Add animal/ })
          .first()
          .click(),
    },
  ];

  for (const dialog of dialogs) {
    test(`${dialog.name} dialog fits`, async ({ page }) => {
      await page.goto(dialog.path);
      await ready(page);
      await dialog.open(page);
      const box = page.getByRole('dialog');
      await expect(box).toBeVisible();
      await page.waitForTimeout(500);
      const fit = await box.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const body = element.querySelector('[data-modal-body]') as HTMLElement | null;
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          sideways: element.scrollWidth - element.clientWidth,
          bodySideways: body ? body.scrollWidth - body.clientWidth : 0,
        };
      });
      expect(fit.left).toBeGreaterThanOrEqual(0);
      expect(fit.right).toBeLessThanOrEqual(fit.innerWidth);
      expect(fit.top).toBeGreaterThanOrEqual(0);
      expect(fit.bottom).toBeLessThanOrEqual(fit.innerHeight + 1);
      expect(fit.sideways).toBeLessThanOrEqual(0);
      expect(fit.bodySideways).toBeLessThanOrEqual(0);
      // The buttons at the bottom can be reached without leaving the dialog.
      const last = box.getByRole('button').last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      await noSidewaysScroll(page);
    });
  }

  test('the vaccine schedule panel, alerts and account menu fit', async ({ page }) => {
    await page.goto('/health');
    await ready(page);
    await page.getByRole('button', { name: 'Vaccine schedule' }).click();
    await expect(page.getByText('Creates a reminder for each animal')).toBeVisible();
    await noSidewaysScroll(page);

    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: /^Alerts/ }).click();
    const alerts = page.getByRole('dialog', { name: 'Alerts' });
    await expect(alerts).toBeVisible();
    const rect = await alerts.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(PHONE.width);
    await page.keyboard.press('Escape');

    await page
      .getByRole('button', { name: /Account menu/ })
      .first()
      .click();
    const menu = page.getByRole('dialog', { name: 'Account menu' });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(PHONE.width);
    await noSidewaysScroll(page);
  });
});
