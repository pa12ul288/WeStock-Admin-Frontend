import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

/** The three demo roles: one account each (docs/demo-data.md). */
const ROLES = [
  { role: 'Super admin', email: 'anjali@brainwired.demo', canEdit: true, canAdminister: true },
  { role: 'Support', email: 'priya@brainwired.demo', canEdit: true, canAdminister: false },
  { role: 'Viewer', email: 'fatima@brainwired.demo', canEdit: false, canAdminister: false },
];

const ROUTES = [
  '/',
  '/farmers',
  '/farmers?view=farms',
  `/farms/${FEATURED.farms.shreeGanesh}`,
  `/farms/${FEATURED.farms.shreeGanesh}?tab=sheds`,
  `/farms/${FEATURED.farms.shreeGanesh}?tab=settings`,
  '/livestock',
  `/animals/${FEATURED.animals.gauri}`,
  '/reproduction',
  '/reproduction?stage=inseminated',
  '/milk-feed',
  '/health',
  '/health?tab=issues',
  '/analytics',
  '/staff',
];

/** Words that start the name of every control that changes data. */
const EDIT_CONTROL =
  /^(Add |Edit|Delete|Remove|Invite|Save|Mark |Undo|Vaccine schedule|Schedule|Transfer|Sold|Deceased|Active again|Create |Fix|Cancel invite|Change )/;

async function loaded(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Alerts, \d+ new$/ })).toBeVisible();
}

async function editControls(page: Page): Promise<string[]> {
  return page
    .locator('main')
    .getByRole('button')
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => !(button as HTMLButtonElement).closest('[role=dialog]'))
        .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''),
    )
    .then((names) => names.filter((name) => EDIT_CONTROL.test(name)));
}

for (const { role, email, canEdit, canAdminister } of ROLES) {
  test.describe(`as ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, email);
    });

    test('edit controls show only for roles that may edit', async ({ page }) => {
      test.setTimeout(120_000);
      let sawEditControl = false;
      for (const route of ROUTES) {
        await page.goto(route);
        await loaded(page);
        const names = await editControls(page);
        const switches = await page.getByRole('switch').count();
        if (canEdit) {
          if (names.length > 0 || switches > 0) sawEditControl = true;
        } else {
          expect(names, `edit controls on ${route}`).toEqual([]);
          expect(switches, `switches on ${route}`).toBe(0);
        }
      }
      expect(sawEditControl).toBe(canEdit);
    });

    test('invite staff and delete farm follow the role', async ({ page }) => {
      await page.goto('/staff');
      await loaded(page);
      await expect(page.getByRole('button', { name: /^Invite staff/ })).toHaveCount(
        canAdminister ? 1 : 0,
      );
      await page.goto(`/farms/${FEATURED.farms.shreeGanesh}?tab=settings`);
      await loaded(page);
      await expect(page.getByRole('button', { name: /^Delete farm/ })).toHaveCount(
        canAdminister ? 1 : 0,
      );
    });

    if (!canEdit) {
      test('settings fields are read only', async ({ page }) => {
        await page.goto(`/farms/${FEATURED.farms.shreeGanesh}?tab=settings`);
        await loaded(page);
        const enabled = await page
          .locator('main fieldset input:enabled, main fieldset select:enabled')
          .count();
        expect(enabled).toBe(0);
        await expect(page.getByRole('button', { name: /^Save/ })).toHaveCount(0);
      });
    }

    test('exports and the activity log work', async ({ page }) => {
      for (const route of ['/farmers', '/livestock']) {
        await page.goto(route);
        await loaded(page);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export CSV' }).click();
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/\.csv$/);
      }
      await page.goto('/milk-feed?period=monthly&tab=feed');
      await loaded(page);
      const report = page.waitForEvent('download');
      await page.getByRole('button', { name: /^Download \w+ report$/ }).click();
      expect((await report).suggestedFilename()).toMatch(/\.csv$/);

      await page.goto('/staff');
      await loaded(page);
      await expect(page.getByRole('table', { name: 'Activity log' })).toBeVisible();
      await expect(
        page.getByRole('table', { name: 'Activity log' }).locator('tbody tr').first(),
      ).toBeVisible();
      const log = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export CSV' }).click();
      expect((await log).suggestedFilename()).toMatch(/\.csv$/);
    });
  });
}
