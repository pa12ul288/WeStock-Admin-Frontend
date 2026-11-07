import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

const rows = (page: Page) => page.getByRole('table', { name: 'Animals' }).locator('tbody tr');
const dialog = (page: Page) => page.getByRole('dialog');

async function open(page: Page, email?: string, query = '') {
  await signIn(page, email);
  await page.goto(`/livestock${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Livestock' })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
}

test.describe('livestock list', () => {
  test('shows the totals, tabs and collar, breeding and health pills', async ({ page }) => {
    await open(page);
    for (const label of ['Active animals', 'With collars', 'Temperature high', 'Cannot connect']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText('Sold and deceased are hidden')).toBeVisible();
    await expect(page.getByText(/Cattle on 9 farms with a Blackbox/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^All [\d,]+/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText(/^Showing 1–20 of [\d,]+ animals$/)).toBeVisible();

    await page.getByRole('searchbox').fill('Kamla');
    await expect(rows(page).first()).toContainText('May deliver');
    await page.getByRole('searchbox').fill('Neeli');
    await expect(rows(page).first()).toContainText('Sick');
    await expect(rows(page).first()).toContainText('No collar');
    await page.getByRole('searchbox').fill('Gauri');
    await expect(rows(page).first()).toContainText('°C');
  });

  test('tabs narrow the list and the totals follow them, not the other filters', async ({
    page,
  }) => {
    await open(page);
    const activeAll = await page
      .getByText(/^[\d,]+$/)
      .first()
      .textContent();
    const poultry = page.getByRole('button', { name: /^Poultry \d+/ });
    const count = (await poultry.textContent())?.replace(/\D/g, '');
    await poultry.click();
    await expect(page).toHaveURL(/cat=poultry/);
    await expect(poultry).toHaveAttribute('aria-pressed', 'true');
    await expect(rows(page).first()).toContainText('Poultry');
    await expect(page.getByText(`of ${count} animals`, { exact: false })).toBeVisible();
    await expect(page.getByText(count ?? '', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: /^All [\d,]+/ }).click();
    await expect(page).not.toHaveURL(/cat=/);

    await page.getByRole('combobox', { name: 'Status' }).selectOption('sold');
    await expect(page.getByText(activeAll ?? '', { exact: true }).first()).toBeVisible();
  });

  test('searches by tag, name and Pashu Aadhaar', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.shreeGanesh}`);
    const search = page.getByRole('searchbox', { name: 'Search tag, name or Pashu Aadhaar' });
    await search.fill('Gauri');
    await expect(page).toHaveURL(/q=Gauri/);
    await expect(rows(page)).toHaveCount(1);
    const aadhaar = (await rows(page).locator('small').textContent()) ?? '';
    expect(aadhaar).toMatch(/^PA \d{4} \d{4} \d{4}$/);

    await search.fill('23');
    await expect(rows(page).first()).toBeVisible();

    await search.fill(aadhaar);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).toContainText('Gauri');
    await search.fill(aadhaar.replace(/\D/g, '').slice(0, 8));
    await expect(rows(page).first()).toContainText('Gauri');
  });

  test('filters by farm, collar, breeding and status, and clears', async ({ page }) => {
    await open(page);
    await page.getByLabel('Farm', { exact: true }).selectOption({ label: 'Shree Ganesh Dairy' });
    await expect(page).toHaveURL(/farm=/);
    await expect(page.getByText(/matching animals/)).toBeVisible();
    await expect(rows(page).first()).toContainText('Shree Ganesh Dairy');
    await expect(page.getByText('Cattle on 1 farm with a Blackbox')).toBeVisible();

    const collar = page.getByRole('combobox', { name: 'Collar' });
    await collar.selectOption({ label: 'No collar' });
    await expect(rows(page).first()).toContainText('No collar');
    await collar.selectOption({ label: 'Normal' });
    await expect(rows(page).first()).toContainText('°C');
    await collar.selectOption('');

    const breeding = page.getByRole('combobox', { name: 'Breeding' });
    await breeding.selectOption({ label: 'In heat' });
    await expect(rows(page).first()).toContainText('In heat');
    await breeding.selectOption({ label: 'May deliver' });
    await expect(rows(page).first()).toContainText('May deliver');
    await expect(page).toHaveURL(/breeding=may_deliver/);
    await breeding.selectOption('');

    const status = page.getByRole('combobox', { name: 'Status' });
    await status.selectOption({ label: 'Sold' });
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).toContainText('Bhuri');
    await status.selectOption({ label: 'Deceased' });
    await expect(rows(page)).toContainText('Moti');
    await status.selectOption({ label: 'All statuses' });
    await expect(page).toHaveURL(/status=all/);
    await expect(page.getByText(/of 66 matching animals/)).toBeVisible();

    await page.getByRole('searchbox').fill('no animal has this name');
    await expect(page.getByText('No animals match these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/livestock$/);
    await expect(page.getByRole('searchbox')).toHaveValue('');
    await expect(rows(page).first()).toBeVisible();
  });

  test('pages through and survives a reload', async ({ page }) => {
    await open(page);
    const first = await rows(page).first().textContent();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/^Showing 21–40 of/)).toBeVisible();
    await expect(rows(page).first()).not.toHaveText(first ?? '');
    await page.reload();
    await expect(page.getByText(/^Showing 21–40 of/)).toBeVisible();
    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.getByText(/^Showing 1–20 of/)).toBeVisible();
  });

  test('exports what the filters show', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.periyar}`);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('livestock.csv');
    const lines = (await readFile(await file.path(), 'utf8')).slice(1).trim().split(/\r\n/);
    expect(lines[0]).toBe(
      'Tag,Name,Pashu Aadhaar,Species,Breed,Gender,Age,Farm,Shed,Collar,Breeding,Health,Status',
    );
    expect(lines.some((line) => line.includes('Neeli') && line.includes('Sick'))).toBe(true);
    expect(lines.slice(1).every((line) => line.includes('Periyar Cattle Farm'))).toBe(true);
    await expect(
      page.getByText(`livestock.csv downloaded · ${lines.length - 1} rows`),
    ).toBeVisible();
  });

  test('a row opens the animal', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.shreeGanesh}&q=Gauri`);
    await page.getByRole('link', { name: 'Open tag 01' }).click();
    await expect(page).toHaveURL(new RegExp(`/animals/${FEATURED.animals.gauri}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Gauri' })).toBeVisible();
  });
});

test.describe('add animal', () => {
  test('checks the tag and Pashu Aadhaar, adds, resets filters, survives a reload', async ({
    page,
  }) => {
    await open(page, undefined, '?collar=normal');
    await page.getByRole('button', { name: 'Add animal' }).click();
    const form = dialog(page);
    await expect(form.getByRole('heading', { name: 'Add an animal' })).toBeVisible();
    await form.getByLabel('Farm').selectOption({ label: 'Shree Ganesh Dairy' });

    await form.getByRole('button', { name: 'Add animal' }).click();
    await expect(form.getByText('Add a tag number.')).toBeVisible();

    await form.getByLabel('Tag number').fill('01');
    await form.getByLabel('Pashu Aadhaar').fill('12345');
    await form.getByRole('button', { name: 'Add animal' }).click();
    await expect(form.getByText('Pashu Aadhaar has 12 digits.', { exact: false })).toBeVisible();
    await form.getByLabel('Pashu Aadhaar').fill('1234567890123');
    await form.getByRole('button', { name: 'Add animal' }).click();
    await expect(form.getByText('Pashu Aadhaar has 12 digits.', { exact: false })).toBeVisible();

    await form.getByLabel('Pashu Aadhaar').fill('1234 5678 9012');
    await form.getByRole('button', { name: 'Add animal' }).click();
    // The duplicate shows on the tag field itself.
    const tagField = form.locator('label', { hasText: 'Tag number' });
    await expect(tagField.getByText('Tag 01 is already used on this farm.')).toBeVisible();

    await form.getByLabel('Tag number').fill('777');
    await form.getByLabel('Name', { exact: true }).fill('Chitra');
    await form.getByLabel('Species').selectOption({ label: 'Buffalo' });
    await form.getByLabel('Breed').fill('Murrah');
    await form.getByLabel('Gender').selectOption({ label: 'Female' });
    await form.getByRole('button', { name: 'Add animal' }).click();
    await expect(page.getByText('Tag 777 · Chitra added to Shree Ganesh Dairy')).toBeVisible();
    await expect(form).toBeHidden();
    await expect(page).toHaveURL(/\/livestock$/);

    await expect(rows(page).first()).toContainText('Chitra');
    await expect(rows(page).first()).toContainText('PA 1234 5678 9012');
    await expect(rows(page).first()).toContainText('Buffalo · Murrah');
    await expect(rows(page).first()).toContainText('Not in a shed');

    await page.reload();
    await expect(rows(page).first()).toContainText('Chitra');
    const log = await page.evaluate(async (path) => {
      const { dataSource } = await import(/* @vite-ignore */ path);
      return dataSource.listAudit({ table_name: 'animals', limit: 1 });
    }, '/src/data/index.ts');
    expect(log[0]).toMatchObject({ action: 'insert', table_name: 'animals' });
  });

  test('closes on Escape and Cancel without adding', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Add animal' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await page.getByRole('button', { name: 'Add animal' }).click();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toBeHidden();
  });

  test('the farm page shares the dialog, with the 12-digit rule too', async ({ page }) => {
    await signIn(page);
    await page.goto(`/farms/${FEATURED.farms.shreeGanesh}`);
    await page.getByRole('button', { name: 'Add animal' }).click();
    const form = dialog(page);
    await expect(form.getByLabel('Farm')).toHaveCount(0);
    await expect(form.getByLabel('Shed')).toBeVisible();
    await form.getByLabel('Tag number').fill('778');
    await form.getByLabel('Pashu Aadhaar').fill('12');
    await form.getByRole('button', { name: 'Add animal' }).click();
    await expect(form.getByText('Pashu Aadhaar has 12 digits.', { exact: false })).toBeVisible();
    await form.getByLabel('Pashu Aadhaar').fill('');
    await form.getByRole('button', { name: 'Add animal' }).click();
    await expect(page.getByText('Tag 778 added to Shree Ganesh Dairy')).toBeVisible();
  });
});

test.describe('livestock roles', () => {
  test('support can add and export', async ({ page }) => {
    await open(page, SUPPORT);
    await expect(page.getByRole('button', { name: 'Add animal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });

  test('viewer can filter and export but not add', async ({ page }) => {
    await open(page, VIEWER);
    await expect(page.getByRole('button', { name: 'Add animal' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
    await page.getByRole('combobox', { name: 'Status' }).selectOption('sold');
    await expect(page).toHaveURL(/status=sold/);
  });
});
