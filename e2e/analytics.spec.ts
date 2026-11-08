import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

const farmGroup = (page: Page) => page.getByRole('group', { name: 'Farm', exact: true });
const periodGroup = (page: Page) => page.getByRole('group', { name: 'Period' });
const card = (page: Page, title: RegExp) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: title }) });

async function open(page: Page, email?: string, query = '') {
  await signIn(page, email);
  await page.goto(`/analytics${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Daily average')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Day' })).toBeVisible();
}

test.describe('analytics', () => {
  test('shows the five graphs for the first farm', async ({ page }) => {
    await open(page);
    await expect(page.getByText('Insights · optional')).toBeVisible();
    await expect(
      page.getByText(/^The same five graphs farmers see in the app, for any farm · /),
    ).toBeVisible();
    for (const title of [
      /^1 · Milk$/,
      /^2 · Feed$/,
      /^3 · Activity$/,
      /^4 · Cattle temperature$/,
      /^5 · Farm temperature$/,
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
    await expect(page.getByText('Blackbox + collars')).toBeVisible();
    await expect(page.getByText('litres per day')).toBeVisible();
    await expect(page.getByText('Average price')).toBeVisible();
    await expect(page.getByText('Milking animals')).toBeVisible();
    await expect(page.getByText(/per kg$/)).toBeVisible();
    await expect(page.getByText('Green fodder', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Ruminating · average')).toBeVisible();
    await expect(page.getByText('herd average now · hourly, last 7 days')).toBeVisible();
    await expect(page.getByText(/^\d+ cows? above 39\.5 °C$/)).toBeVisible();
    await expect(page.getByText('From the S1 shed sensor')).toBeVisible();
    await expect(page.getByText('Hottest this week')).toBeVisible();
    await expect(page.getByText('Highest THI this week')).toBeVisible();
    await expect(page.getByText('Higher THI (more heat stress)')).toBeVisible();
  });

  test('the period switch averages 5 and 10 days and lives in the URL', async ({ page }) => {
    await open(page);
    await periodGroup(page).getByRole('button', { name: '30 days' }).click();
    await expect(page).toHaveURL(/days=30/);
    await expect(page.getByText('litres a day · 5-day avg')).toBeVisible();
    await expect(page.getByText('kg a day · 5-day avg')).toBeVisible();
    await expect(page.getByText('hours per cow · last 30 days · 5-day avg')).toBeVisible();

    await periodGroup(page).getByRole('button', { name: '90 days' }).click();
    await expect(page).toHaveURL(/days=90/);
    await expect(page.getByText('litres a day · 10-day avg')).toBeVisible();

    await page.reload();
    await expect(page.getByText('litres a day · 10-day avg')).toBeVisible();
    await expect(periodGroup(page).getByRole('button', { name: '90 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await periodGroup(page).getByRole('button', { name: '7 days' }).click();
    await expect(page).not.toHaveURL(/days=/);
    await expect(page.getByText('litres per day')).toBeVisible();
  });

  test('a manual farm shows the collar graphs as no collar data', async ({ page }) => {
    await open(page);
    await farmGroup(page).getByRole('button', { name: 'Periyar Cattle Farm' }).click();
    await expect(page).toHaveURL(new RegExp(`farm=${FEATURED.farms.periyar}`));
    await expect(page.getByText('Manual entry · no collars')).toBeVisible();
    await expect(page.getByText('No collar data on this farm')).toHaveCount(2);
    await expect(
      card(page, /^3 · Activity$/).getByText('No collar data on this farm'),
    ).toBeVisible();
    await expect(
      card(page, /^4 · Cattle temperature$/).getByText('No collar data on this farm'),
    ).toBeVisible();
    await expect(page.getByText('Daily average')).toBeVisible();
    await expect(page.getByText('From the weather forecast')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Shed' })).toHaveCount(0);

    await farmGroup(page).getByRole('button', { name: 'Shree Ganesh Dairy' }).click();
    await expect(page.getByText('Blackbox + collars')).toBeVisible();
    await expect(page.getByText('No collar data on this farm')).toHaveCount(0);
  });

  test('another farm comes from the select', async ({ page }) => {
    await open(page);
    await page.getByRole('combobox', { name: 'Other farm' }).selectOption({ label: 'Yadav Dairy' });
    await expect(page).toHaveURL(new RegExp(`farm=${FEATURED.farms.yadav}`));
    await expect(page.getByRole('combobox', { name: 'Other farm' })).toHaveValue(
      FEATURED.farms.yadav,
    );
    await expect(page.getByText('Daily average')).toBeVisible();
    await expect(farmGroup(page).locator('button[aria-pressed="true"]')).toHaveCount(0);
  });

  test('one animal narrows the graphs and the picker goes back to the whole farm', async ({
    page,
  }) => {
    await open(page);
    const animal = page.getByRole('combobox', { name: 'Animal' });
    await animal.selectOption({ label: '02 · Lakshmi' });
    await expect(page).toHaveURL(/animal=/);
    await expect(page.getByText('litres per day · Lakshmi')).toBeVisible();
    await expect(page.getByText('Lakshmi now · hourly, last 7 days')).toBeVisible();

    await animal.selectOption('');
    await expect(page).not.toHaveURL(/animal=/);
    await expect(page.getByText('litres per day', { exact: true })).toBeVisible();
  });

  test('farm temperature follows the shed and the day', async ({ page }) => {
    await open(page);
    const sheds = page.getByRole('group', { name: 'Shed' });
    await sheds.getByRole('button', { name: 'S2' }).click();
    await expect(page).toHaveURL(/shed=/);
    await expect(page.getByText('From the S2 shed sensor')).toBeVisible();
    await expect(page.getByText(/^THI \d+ in S2$/)).toBeVisible();

    const day = page.getByRole('combobox', { name: 'Day' });
    await expect(day.locator('option')).toHaveCount(7);
    await expect(day.locator('option').first()).toContainText('yesterday');
    await day.selectOption({ index: 3 });
    await expect(page).toHaveURL(/day=/);

    await page.reload();
    await expect(page.getByText('From the S2 shed sensor')).toBeVisible();
    await expect(day).toHaveValue(/\d{4}-\d\d-\d\d/);
  });

  test('downloads the visible numbers as CSV', async ({ page }) => {
    await open(page, undefined, '?days=30');
    const download = page.getByRole('button', { name: 'Download', exact: true });
    await expect(download).toBeEnabled();
    const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
    expect(file.suggestedFilename()).toBe(
      'westock-analytics-shree-ganesh-dairy-whole-farm-30-days.csv',
    );
    await expect(
      page.getByRole('status').filter({ hasText: `${file.suggestedFilename()} downloaded` }),
    ).toBeVisible();
    const text = await readFile(await file.path(), 'utf8');
    expect(text).toContain('WeSTOCK analytics,Shree Ganesh Dairy,Whole farm,');
    expect(text).toContain('Milk and feed,Period from,Milk (L a day)');
    expect(text).toContain('Activity (hours per cow a day),Period from,Ruminating');
    expect(text).toContain('Cattle temperature (last 7 days)');
    expect(text).toContain('Farm temperature,');
    expect(text).toContain(',Hour,Temperature (°C),Humidity (%),THI');
    expect(text.split('\r\n').filter((line) => /^,\d{2}:00,/.test(line)).length).toBeGreaterThan(
      10,
    );
  });

  test('a manual farm download has no collar sections', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.periyar}`);
    const download = page.getByRole('button', { name: 'Download', exact: true });
    await expect(download).toBeEnabled();
    const [file] = await Promise.all([page.waitForEvent('download'), download.click()]);
    const text = await readFile(await file.path(), 'utf8');
    expect(text).toContain('Periyar Cattle Farm');
    expect(text).not.toContain('Activity (hours');
    expect(text).not.toContain('Cattle temperature');
  });

  test('an unknown farm says so and Clear filters goes back', async ({ page }) => {
    await signIn(page);
    await page.goto('/analytics?farm=no-such-farm');
    await expect(page.getByText('We couldn’t find that farm')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByText('Daily average')).toBeVisible();
    await expect(page).not.toHaveURL(/farm=/);
  });

  for (const [name, email] of [
    ['support', SUPPORT],
    ['viewer', VIEWER],
  ] as const) {
    test(`${name} sees every graph and can download`, async ({ page }) => {
      await open(page, email);
      await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
      await expect(page.getByText('Highest THI this week')).toBeVisible();
    });
  }
});
