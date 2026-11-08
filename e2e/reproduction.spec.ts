import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

const dialog = (page: Page) => page.getByRole('dialog');
const rows = (page: Page) => page.getByRole('table').locator('tbody tr');
const golden = (page: Page) => page.getByRole('region', { name: 'Golden period now' });
const tab = (page: Page, name: RegExp) => page.getByRole('button', { name });
const toast = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });

const HEAT = /^In heat ?[\d,]+/;
const VERIFY = /^To verify ?[\d,]+/;
const PREGNANT = /^Pregnant & due ?[\d,]+/;

async function open(page: Page, email?: string, query = '') {
  await signIn(page, email);
  await page.goto(`/reproduction${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Reproduction' })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
  await expect(tab(page, HEAT)).toBeVisible();
  await expect(tab(page, VERIFY)).toBeVisible();
}

const countOf = async (page: Page, name: RegExp) =>
  Number(((await tab(page, name).textContent()) ?? '').replace(/\D/g, ''));

async function addCycle(
  page: Page,
  values: { farm?: string; animal: string; stage: 'heat' | 'inseminated'; tube?: string },
) {
  await page.getByRole('button', { name: 'Add cycle' }).click();
  const add = dialog(page).getByRole('button', { name: 'Add record' });
  await expect(add).toBeEnabled();
  if (values.farm) {
    await dialog(page)
      .getByRole('combobox', { name: 'Farm', exact: true })
      .selectOption(values.farm);
    await expect(add).toBeEnabled();
  }
  await dialog(page).getByRole('combobox', { name: 'Stage' }).selectOption(values.stage);
  await dialog(page)
    .getByRole('combobox', { name: /^Animal/ })
    .fill(values.animal);
  if (values.tube)
    await dialog(page)
      .getByLabel(/^Tube number/)
      .fill(values.tube);
  await add.click();
}

test.describe('reproduction', () => {
  test('shows the totals and golden period cards with a countdown', async ({ page }) => {
    await open(page);
    for (const label of ['Inseminated', 'Pregnant', 'May deliver']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Waiting for insemination')).toBeVisible();
    await expect(page.getByText(/^\d+ tube numbers? still to verify$/)).toBeVisible();
    await expect(page.getByText(/^\d+ this week$/)).toBeVisible();

    const title = golden(page).getByText(/^Golden period now · \d+ animals?$/);
    await expect(title).toBeVisible();
    const cards = golden(page).getByRole('link');
    await expect(cards).toHaveCount(Number((await title.textContent())?.replace(/\D/g, '')));
    await expect(cards.first()).toContainText(/\d+ (min|h)/);
    await expect(cards.first()).toContainText(/left/);
    await expect(golden(page).getByRole('img').first()).toHaveAttribute(
      'aria-label',
      /^Golden period \d\d:\d\d to \d\d:\d\d, /,
    );
    await cards.first().click();
    await expect(page).toHaveURL(/\/animals\//);
  });

  test('tabs switch the table and stay in the URL', async ({ page }) => {
    await open(page);
    await expect(tab(page, HEAT)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('columnheader', { name: 'Golden period' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Reported by' })).toBeVisible();
    await expect(rows(page).first()).toContainText(/\d\d:\d\d – \d\d:\d\d/);

    await tab(page, VERIFY).click();
    await expect(page).toHaveURL(/stage=inseminated/);
    await expect(tab(page, VERIFY)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('columnheader', { name: 'Tube no.' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Slip photo' })).toBeVisible();
    await expect(
      page.getByText('Check the tube number against the farmer’s slip photo'),
    ).toBeVisible();

    await tab(page, PREGNANT).click();
    await expect(page).toHaveURL(/stage=pregnant/);
    await expect(page.getByRole('columnheader', { name: 'Expected delivery' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Gestation' })).toBeVisible();
    await expect(rows(page).first()).toContainText(/(Cattle|Buffalo) · day \d+ of \d+/);
    await expect(rows(page).first()).toContainText(/in \d+ days?/);

    await page.reload();
    await expect(tab(page, PREGNANT)).toHaveAttribute('aria-pressed', 'true');

    await tab(page, HEAT).click();
    await expect(page).not.toHaveURL(/stage=/);
  });

  test('the farm filter narrows the cards, tabs and table', async ({ page }) => {
    await open(page);
    const allHeat = await countOf(page, HEAT);
    await page
      .getByRole('combobox', { name: 'Farm', exact: true })
      .selectOption(FEATURED.farms.shreeGanesh);
    await expect(page).toHaveURL(new RegExp(`farm=${FEATURED.farms.shreeGanesh}`));
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(rows(page).first()).toContainText('Shree Ganesh Dairy');
    for (const row of await rows(page).all()) await expect(row).toContainText('Shree Ganesh Dairy');
    await expect.poll(() => countOf(page, HEAT)).toBeLessThan(allHeat);
    await expect.poll(() => countOf(page, HEAT)).toBe(await rows(page).count());
    for (const card of await golden(page).getByRole('link').all()) {
      await expect(card).toContainText('Shree Ganesh Dairy');
    }

    await page.getByRole('combobox', { name: 'Farm', exact: true }).selectOption('');
    await expect(page).not.toHaveURL(/farm=/);
    await expect.poll(() => countOf(page, HEAT)).toBe(allHeat);
  });

  test('a farm with nothing at a stage says so and can clear the filter', async ({ page }) => {
    await open(page);
    const select = page.getByRole('combobox', { name: 'Farm', exact: true });
    await expect(select.locator('option').nth(1)).toBeAttached();
    const farms = await select
      .locator('option')
      .evaluateAll((items) =>
        items.map((item) => (item as HTMLOptionElement).value).filter(Boolean),
      );
    const empty = page.getByText('Nothing here for this farm');
    for (const farm of farms) {
      await select.selectOption(farm);
      await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
      if (await empty.isVisible()) break;
    }
    await expect(empty).toBeVisible();
    await expect(page.getByText('Pick another farm or “All farms”.')).toBeVisible();
    await expect(page.getByText('No golden periods on this farm right now')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/farm=/);
    await expect(rows(page).first()).toBeVisible();
  });

  test('the switch verifies and unverifies, and survives a reload', async ({ page }) => {
    await open(page, undefined, '?stage=inseminated');
    const before = await countOf(page, VERIFY);
    const row = rows(page)
      .filter({ has: page.getByRole('switch', { checked: false }) })
      .first();
    const tube = (await row.locator('td').nth(3).textContent()) ?? '';
    const label = (await row.getByRole('switch').getAttribute('aria-label')) ?? '';
    const name = label.replace('Verified for ', '');
    const target = rows(page).filter({ hasText: tube }).getByRole('switch');

    await target.click();
    await expect(toast(page, `Tube number for ${name} verified`)).toBeVisible();
    await expect(target).toBeChecked();
    await expect.poll(() => countOf(page, VERIFY)).toBe(before - 1);

    await page.reload();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(target).toBeChecked();

    await target.click();
    await expect(toast(page, `Tube number for ${name} marked not verified`)).toBeVisible();
    await expect.poll(() => countOf(page, VERIFY)).toBe(before);
  });

  test('View photo opens the slip and Mark verified verifies it', async ({ page }) => {
    await open(page, undefined, '?stage=inseminated');
    const first = rows(page)
      .filter({ has: page.getByRole('switch', { checked: false }) })
      .filter({ has: page.getByRole('button', { name: /^View photo/ }) })
      .first();
    const tube = (await first.locator('td').nth(3).textContent()) ?? '';
    const row = rows(page).filter({ hasText: tube });
    const before = await countOf(page, VERIFY);
    await row.getByRole('button', { name: /^View photo/ }).click();

    await expect(dialog(page).getByRole('heading', { name: 'Insemination slip' })).toBeVisible();
    await expect(
      dialog(page).getByText('Check the tube number on the slip matches the one in the app.'),
    ).toBeVisible();
    const photo = dialog(page).getByRole('img', { name: 'Photo of the insemination slip' });
    await expect(photo).toBeVisible();
    expect(await photo.innerHTML()).toContain(tube);
    await expect(dialog(page).getByText('Tube number entered in the app')).toBeVisible();
    await expect(dialog(page).locator('b').filter({ hasText: tube })).toBeVisible();

    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => countOf(page, VERIFY)).toBe(before);

    await row.getByRole('button', { name: /^View photo/ }).click();
    await dialog(page).getByRole('button', { name: 'Mark verified' }).click();
    await expect(toast(page, 'Tube number verified')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => countOf(page, VERIFY)).toBe(before - 1);
    await expect(row.getByRole('switch')).toBeChecked();

    await row.getByRole('button', { name: /^View photo/ }).click();
    await expect(dialog(page).getByRole('button', { name: 'Mark verified' })).toHaveCount(0);
    await dialog(page)
      .locator('[data-modal-footer]')
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('adds a heat, which goes to the list and survives a reload', async ({ page }) => {
    await open(page, undefined, '?stage=pregnant');
    await addCycle(page, { farm: FEATURED.farms.shreeGanesh, animal: 'Gauri', stage: 'heat' });
    await expect(
      toast(page, 'Heat added for Gauri · the golden period reminder is on'),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/stage=/);
    await expect(page).toHaveURL(new RegExp(`farm=${FEATURED.farms.shreeGanesh}`));
    const row = rows(page).filter({ hasText: 'Gauri' });
    await expect(row).toContainText(/Today \d\d:\d\d|Yesterday/);
    await expect(row).toContainText('Staff');
    await expect(row).toContainText('Not needed');

    await page.reload();
    await expect(row).toContainText('Staff');
  });

  test('adds an insemination with a tube number, ready to verify', async ({ page }) => {
    await open(page);
    await page
      .getByRole('combobox', { name: 'Farm', exact: true })
      .selectOption(FEATURED.farms.shreeGanesh);
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await addCycle(page, { animal: 'Gauri', stage: 'inseminated', tube: 'GIR-22-0611' });
    await expect(
      toast(page, 'Insemination added for Gauri · waiting to be verified'),
    ).toBeVisible();
    await expect(page).toHaveURL(/stage=inseminated/);
    const row = rows(page).filter({ hasText: 'GIR-22-0611' });
    await expect(row).toContainText('Gauri');
    await expect(row).toContainText('No photo');
    await expect(row.getByRole('switch')).not.toBeChecked();

    await page.reload();
    await expect(row).toContainText('Gauri');
    await row.getByRole('switch').click();
    await expect(row.getByRole('switch')).toBeChecked();
  });

  test('the dialog checks its fields and only takes a tube when inseminated', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Add cycle' }).click();
    const add = dialog(page).getByRole('button', { name: 'Add record' });
    await expect(add).toBeEnabled();
    await expect(dialog(page).getByText('Add a breeding record')).toBeVisible();
    await expect(
      dialog(page).getByText('For heat, the golden period is worked out as 2 to 12 hours'),
    ).toBeVisible();

    const tube = dialog(page).getByLabel(/^Tube number/);
    await expect(tube).toBeDisabled();
    await dialog(page).getByRole('combobox', { name: 'Stage' }).selectOption('inseminated');
    await expect(tube).toBeEnabled();

    await add.click();
    await expect(dialog(page).getByText('Add the animal’s tag and name.')).toBeVisible();

    await dialog(page)
      .getByRole('combobox', { name: /^Animal/ })
      .fill('no such animal');
    await add.click();
    await expect(dialog(page).getByText(/No animal like that on this farm/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
  });

  test('a support user can add and verify', async ({ page }) => {
    await open(page, SUPPORT, '?stage=inseminated');
    await expect(page.getByRole('button', { name: 'Add cycle' })).toBeVisible();
    await expect(page.getByRole('switch').first()).toBeVisible();
    const row = rows(page)
      .filter({ has: page.getByRole('switch', { checked: false }) })
      .filter({ has: page.getByRole('button', { name: /^View photo/ }) })
      .first();
    await row.getByRole('button', { name: /^View photo/ }).click();
    await expect(dialog(page).getByRole('button', { name: 'Mark verified' })).toBeVisible();
  });

  test('a viewer sees everything but changes nothing', async ({ page }) => {
    await open(page, VIEWER, '?stage=inseminated');
    await expect(page.getByRole('button', { name: 'Add cycle' })).toHaveCount(0);
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(rows(page).first()).toContainText(/Verified|Not verified/);

    await page
      .getByRole('button', { name: /^View photo/ })
      .first()
      .click();
    await expect(dialog(page).getByRole('img')).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Mark verified' })).toHaveCount(0);
    await dialog(page)
      .locator('[data-modal-footer]')
      .getByRole('button', { name: 'Close' })
      .click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(golden(page)).toBeVisible();
  });

  test('no sideways page scroll on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    for (const name of [VERIFY, PREGNANT, HEAT]) {
      await tab(page, name).click();
      await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(390);
    }
  });
});
