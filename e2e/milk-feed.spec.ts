import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

const dialog = (page: Page) => page.getByRole('dialog');
const rows = (page: Page) => page.getByRole('table').locator('tbody tr');
const toast = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });
const farmSelect = (page: Page) => page.getByRole('combobox', { name: 'Farm', exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

const BADGE = 'Fixed by staff';

async function open(page: Page, email?: string, query = '') {
  await signIn(page, email);
  await page.goto(`/milk-feed${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Milk & feed' })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
}

/** Yadav Dairy's wrong entry: 04 Shyama's 75.0 L from yesterday evening. */
const wrongEntry = (page: Page) => rows(page).filter({ hasText: '75.0' });

async function openYadav(page: Page, email?: string) {
  await open(page, email, `?farm=${FEATURED.farms.yadav}`);
  await expect(wrongEntry(page)).toBeVisible();
}

async function startAdd(page: Page) {
  await button(page, 'Add entry').click();
  await expect(dialog(page).getByRole('button', { name: 'Add entry' })).toBeEnabled();
}

test.describe('milk and feed', () => {
  test('shows the totals, both charts and the milk table', async ({ page }) => {
    await open(page);
    for (const label of [
      'Milk yesterday',
      'Milk value',
      'Milking animals',
      'Feed cost yesterday',
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/· all farms$/)).toBeVisible();
    await expect(page.getByText(/^Average ₹[\d.,]+ per litre$/)).toBeVisible();
    await expect(page.getByText('Had an entry yesterday')).toBeVisible();

    await expect(page.getByText('Milk by session · last 7 days')).toBeVisible();
    await expect(page.getByRole('figure', { name: /^Milk per day by session/ })).toBeVisible();
    await expect(page.getByText('Yesterday · morning')).toBeVisible();
    await expect(page.getByText('Feed by type · yesterday')).toBeVisible();
    await expect(page.getByText(/per kg on average · ₹[\d,]+ in total/)).toBeVisible();
    for (const type of ['Green fodder', 'Dry fodder', 'Concentrate', 'Silage', 'Other']) {
      await expect(page.getByText(type, { exact: true })).toBeVisible();
    }

    for (const name of [
      'Logged',
      'Farm · animal',
      'Session',
      'Litres',
      'Price / L',
      'Amount',
      'Entered by',
    ]) {
      await expect(page.getByRole('columnheader', { name, exact: true })).toBeVisible();
    }
    await expect(rows(page)).toHaveCount(20);
    await expect(
      page.getByText('Newest first · fixes by staff are marked and logged'),
    ).toBeVisible();
  });

  test('the tabs, the view and the farm stay in the URL', async ({ page }) => {
    await open(page);
    await button(page, 'Feed entries').click();
    await expect(page).toHaveURL(/tab=feed/);
    await expect(page.getByRole('columnheader', { name: 'Fed to' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Feed type' })).toBeVisible();
    await expect(rows(page).first()).toContainText(/ kg/);

    await button(page, 'Monthly').click();
    await expect(page).toHaveURL(/period=monthly/);
    await expect(button(page, 'Monthly')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Milk per month · all farms')).toBeVisible();
    await expect(page.getByRole('figure', { name: /^Milk per month/ })).toBeVisible();

    await farmSelect(page).selectOption(FEATURED.farms.yadav);
    await expect(page).toHaveURL(new RegExp(`farm=${FEATURED.farms.yadav}`));
    await expect(page.getByText('Milk per month · Yadav Dairy')).toBeVisible();

    await page.reload();
    await expect(button(page, 'Feed entries')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(page, 'Monthly')).toHaveAttribute('aria-pressed', 'true');
    await expect(farmSelect(page)).toHaveValue(FEATURED.farms.yadav);
    await expect(rows(page).first()).toContainText('Yadav Dairy');
  });

  test('the farm filter narrows the rows and totals', async ({ page }) => {
    await open(page);
    await farmSelect(page).selectOption(FEATURED.farms.shreeGanesh);
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(page.getByText(/· Shree Ganesh Dairy$/)).toBeVisible();
    for (const row of await rows(page).all()) await expect(row).toContainText('Shree Ganesh Dairy');
    await farmSelect(page).selectOption('');
    await expect(page).not.toHaveURL(/farm=/);
  });

  test('pages through the entries', async ({ page }) => {
    await open(page);
    const first = await rows(page).first().textContent();
    await page.getByRole('button', { name: /next/i }).first().click();
    await expect(page).toHaveURL(/page=2/);
    await expect(rows(page).first()).not.toHaveText(first ?? '');
    await button(page, 'Feed entries').click();
    await expect(page).not.toHaveURL(/page=/);
  });

  test('a fix needs a reason, then shows the badge, the toast and the new total', async ({
    page,
  }) => {
    await openYadav(page);
    const total = page.getByText(/^[\d,]+ L$/).first();
    const before = await total.textContent();
    await expect(wrongEntry(page)).toContainText('Shyama');
    await expect(wrongEntry(page)).not.toContainText(BADGE);
    await wrongEntry(page).getByRole('button', { name: 'Edit entry' }).click();

    await expect(dialog(page).getByRole('heading', { name: 'Fix a milk entry' })).toBeVisible();
    await expect(dialog(page).getByText('Yadav Dairy · 04 · Shyama · Evening')).toBeVisible();
    await expect(dialog(page).getByLabel('Litres')).toHaveValue('75.0');
    await expect(dialog(page).getByLabel('Price per litre (₹)')).toHaveValue('40.00');
    await dialog(page).getByLabel('Litres').fill('7.5');

    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(dialog(page).getByText('Add a reason for the fix.')).toBeVisible();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByLabel('Reason for the fix')).toBeFocused();
    await expect(dialog(page).getByLabel('Litres')).toHaveValue('7.5');

    await dialog(page).getByLabel('Reason for the fix').fill('   ');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(dialog(page).getByText('Add a reason for the fix.')).toBeVisible();

    await dialog(page)
      .getByLabel('Reason for the fix')
      .fill('Farmer called, typed 75 instead of 7.5');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(toast(page, 'Milk entry fixed: 75.0 → 7.5 L · logged')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);

    const fixed = rows(page).filter({ hasText: 'Shyama' }).filter({ hasText: BADGE });
    await expect(fixed).toContainText('7.5');
    await expect(fixed).toContainText('₹300');
    await expect(wrongEntry(page)).toHaveCount(0);
    await expect(total).not.toHaveText(before ?? '');

    await page.reload();
    await expect(fixed).toContainText('7.5');
  });

  test('fix checks its numbers and notices when nothing changed', async ({ page }) => {
    await openYadav(page);
    await wrongEntry(page).getByRole('button', { name: 'Edit entry' }).click();
    await dialog(page).getByLabel('Litres').fill('lots');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(dialog(page).getByText('Litres must be a number.')).toBeVisible();

    await dialog(page).getByLabel('Litres').fill('75');
    await dialog(page).getByLabel('Reason for the fix').fill('Checked');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(dialog(page).getByText(/^Nothing has changed/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(wrongEntry(page)).not.toContainText(BADGE);
  });

  test('fixes a feed entry, with its own badge', async ({ page }) => {
    await open(page, undefined, `?tab=feed&farm=${FEATURED.farms.yadav}`);
    const row = rows(page).first();
    await row.getByRole('button', { name: 'Edit entry' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Fix a feed entry' })).toBeVisible();
    await dialog(page).getByLabel('Quantity (kg)').fill('123');
    await dialog(page).getByLabel('Cost (₹)').fill('369');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(dialog(page).getByText('Add a reason for the fix.')).toBeVisible();
    await dialog(page).getByLabel('Reason for the fix').fill('Logged in grams by mistake');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(toast(page, 'Feed entry fixed · logged')).toBeVisible();
    await expect(rows(page).first()).toContainText('123 kg');
    await expect(rows(page).first()).toContainText('₹369');
    await expect(rows(page).first()).toContainText(BADGE);
  });

  test('adds a milk entry for an animal, marked as added by staff', async ({ page }) => {
    await open(page);
    await startAdd(page);
    await expect(dialog(page).getByRole('heading', { name: 'Add an entry' })).toBeVisible();
    await dialog(page).getByLabel('Farm').selectOption(FEATURED.farms.shreeGanesh);
    await expect(dialog(page).getByRole('button', { name: 'Add entry' })).toBeEnabled();

    await dialog(page).getByRole('button', { name: 'Add entry' }).click();
    await expect(dialog(page).getByText('Add the animal and the litres.')).toBeVisible();

    await dialog(page).getByLabel('Animal').fill('no such animal');
    await dialog(page).getByLabel('Litres').fill('12.5');
    await dialog(page).getByRole('button', { name: 'Add entry' }).click();
    await expect(dialog(page).getByText(/^No animal like that on this farm/)).toBeVisible();

    await dialog(page).getByLabel('Animal').fill('Gauri');
    await dialog(page).getByLabel('Session').selectOption('afternoon');
    await dialog(page).getByRole('button', { name: 'Add entry' }).click();
    await expect(toast(page, '12.5 L added for')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);

    const row = rows(page).first();
    await expect(row).toContainText('Shree Ganesh Dairy');
    await expect(row).toContainText('Gauri');
    await expect(row).toContainText('Afternoon');
    await expect(row).toContainText('₹40.00');
    await expect(row).toContainText('₹500');
    await expect(row).toContainText('Added by staff');

    await page.reload();
    await expect(rows(page).first()).toContainText('Added by staff');
  });

  test('adds a whole-herd milk entry and a feed entry', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.yadav}`);
    await startAdd(page);
    await expect(dialog(page).getByLabel('Farm')).toHaveValue(FEATURED.farms.yadav);
    await dialog(page).getByLabel('Animal').fill('whole herd');
    await dialog(page).getByLabel('Litres').fill('88');
    await dialog(page).getByRole('button', { name: 'Add entry' }).click();
    await expect(toast(page, '88.0 L added for Whole herd')).toBeVisible();
    await expect(rows(page).first()).toContainText('Whole herd');

    await startAdd(page);
    await dialog(page).getByRole('button', { name: 'Feed', exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: 'Feed', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await dialog(page).getByRole('button', { name: 'Add entry' }).click();
    await expect(dialog(page).getByText('Add what it was fed to and the quantity.')).toBeVisible();

    await dialog(page).getByLabel('Fed to').fill('Whole farm');
    await dialog(page).getByLabel('Feed type').selectOption('Silage');
    await dialog(page).getByLabel('Quantity (kg)').fill('120');
    await dialog(page).getByLabel('Cost (₹)').fill('360');
    await dialog(page).getByRole('button', { name: 'Add entry' }).click();
    await expect(toast(page, '120 kg of silage added')).toBeVisible();

    await expect(page).toHaveURL(/tab=feed/);
    const row = rows(page).first();
    await expect(row).toContainText('Whole farm');
    await expect(row).toContainText('Silage');
    await expect(row).toContainText('120 kg');
    await expect(row).toContainText('₹360');
    await expect(row).toContainText('Added by staff');
  });

  test('deletes an entry after asking, and it stays gone', async ({ page }) => {
    await openYadav(page);
    await wrongEntry(page).getByRole('button', { name: 'Delete entry' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Delete this entry?' })).toBeVisible();
    await expect(
      dialog(page).getByText(
        /^Delete the evening milk entry for 04 · Shyama at Yadav Dairy \(75\.0 L, /,
      ),
    ).toBeVisible();
    await expect(dialog(page).getByText(/A copy stays in the activity log/)).toBeVisible();

    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(wrongEntry(page)).toBeVisible();

    await wrongEntry(page).getByRole('button', { name: 'Delete entry' }).click();
    await dialog(page).getByRole('button', { name: 'Delete entry' }).click();
    await expect(toast(page, 'Entry deleted · a copy is kept in the activity log')).toBeVisible();
    await expect(wrongEntry(page)).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(rows(page).first()).toBeVisible();
    await expect(wrongEntry(page)).toHaveCount(0);
  });

  test('downloads the month’s report as CSV', async ({ page }) => {
    await open(page, undefined, '?period=monthly');
    const download = page.getByRole('button', { name: /^Download \w+ report$/ });
    await expect(download).toBeEnabled({ timeout: 20_000 });
    for (const label of [
      'Milk collected',
      'Value',
      'Average per day',
      'Feed cost',
      'Farms that logged milk',
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/^\d+ of \d+$/)).toBeVisible();

    const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
    expect(file.suggestedFilename()).toMatch(/^milk-feed-[a-z]+-\d{4}\.csv$/);
    await expect(toast(page, `${file.suggestedFilename()} downloaded`)).toBeVisible();
    const text = await readFile(await file.path(), 'utf8');
    expect(text).toContain('Item,Value');
    expect(text).toContain('Farm,all farms');
    expect(text).toMatch(/Milk collected,"[\d,]+ L"/);
    expect(text).toMatch(/Farms that logged milk,\d+ of \d+/);
  });

  test('one farm’s report names the farm and has no farm count', async ({ page }) => {
    await open(page, undefined, `?period=monthly&farm=${FEATURED.farms.yadav}`);
    await expect(page.getByText('Farms that logged milk', { exact: true })).toHaveCount(0);
    const download = page.getByRole('button', { name: /^Download \w+ report$/ });
    await expect(download).toBeEnabled();
    const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
    expect(await readFile(await file.path(), 'utf8')).toContain('Farm,Yadav Dairy');
  });

  test('a farm with nothing logged says so and can clear the filter', async ({ page }) => {
    await open(page, undefined, '?farm=no-such-farm');
    await expect(page.getByText('No entries for this farm')).toBeVisible();
    await expect(page.getByText('Pick another farm or add an entry.')).toBeVisible();
    await expect(page.getByText('No milk logged in these 7 days')).toBeVisible();
    await expect(page.getByText('No feed logged yesterday')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/farm=/);
    await expect(rows(page).first()).toBeVisible();
  });

  test('a support user can add, fix and delete', async ({ page }) => {
    await openYadav(page, SUPPORT);
    await expect(button(page, 'Add entry')).toBeVisible();
    await wrongEntry(page).getByRole('button', { name: 'Edit entry' }).click();
    await dialog(page).getByLabel('Litres').fill('7.5');
    await dialog(page).getByLabel('Reason for the fix').fill('Typed wrong');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(toast(page, 'Milk entry fixed')).toBeVisible();

    const row = rows(page).filter({ hasText: BADGE });
    await row.getByRole('button', { name: 'Delete entry' }).click();
    await dialog(page).getByRole('button', { name: 'Delete entry' }).click();
    await expect(toast(page, 'Entry deleted')).toBeVisible();
  });

  test('a viewer sees everything and can download, but changes nothing', async ({ page }) => {
    await openYadav(page, VIEWER);
    await expect(button(page, 'Add entry')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit entry' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete entry' })).toHaveCount(0);
    await expect(wrongEntry(page)).toContainText('Shyama');

    await button(page, 'Feed entries').click();
    await expect(rows(page).first()).toContainText('Yadav Dairy');
    await expect(page.getByRole('button', { name: 'Edit entry' })).toHaveCount(0);

    await button(page, 'Monthly').click();
    const download = page.getByRole('button', { name: /^Download \w+ report$/ });
    await expect(download).toBeEnabled();
    const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
    expect(file.suggestedFilename()).toMatch(/^milk-feed-/);
  });

  test('no sideways page scroll on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    for (const name of ['Feed entries', 'Monthly', 'Milk entries', 'Daily']) {
      await button(page, name).click();
      await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(390);
    }
  });
});
