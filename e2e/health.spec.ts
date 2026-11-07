import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

const rows = (page: Page) => page.getByRole('table').locator('tbody tr');
const toast = (page: Page, text: string | RegExp) =>
  page.getByRole('status').filter({ hasText: text });
const farmFilter = (page: Page) =>
  page.getByRole('combobox', { name: 'Farm', exact: true }).first();
const speciesFilter = (page: Page) => page.getByRole('combobox', { name: 'Species', exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const tab = (page: Page, name: RegExp) => page.getByRole('button', { name });
const createButton = (page: Page) => page.getByRole('button', { name: /^Create \d+ reminders?$/ });
const VAX_TAB = /^Vaccinations/;
const ISSUES_TAB = /^Health issues/;

const VACCINES = 'Vaccinations not yet given';
const ISSUES = 'Open health issues';

async function open(page: Page, email?: string, query = '') {
  await signIn(page, email);
  await page.goto(`/health${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Health & vaccines' })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
}

/** The big number on a totals card. */
async function total(page: Page, label: string): Promise<number> {
  const text = await page.getByRole('region', { name: label }).getByTestId('total').innerText();
  return Number(text.replace(/,/g, ''));
}

async function expectTotal(page: Page, label: string, value: number) {
  await expect.poll(() => total(page, label)).toBe(value);
}

test.describe('health and vaccines', () => {
  test('shows the totals and the design wording', async ({ page }) => {
    await open(page);
    await expect(
      page.getByText('Vaccination schedules and health issues reported on every farm.'),
    ).toBeVisible();

    const vaccines = page.getByRole('region', { name: VACCINES });
    for (const word of ['Overdue', 'past the due date', 'in the next 7 days', 'in 8 to 30 days']) {
      await expect(vaccines.getByText(word, { exact: true })).toBeVisible();
    }
    const issues = page.getByRole('region', { name: ISSUES });
    for (const word of ['Sick', 'needs care now', 'to be checked', 'ongoing conditions']) {
      await expect(issues.getByText(word, { exact: true })).toBeVisible();
    }
    // The bar reads its parts out in words, and they add up to the total.
    const summary = (await vaccines.getByRole('img').getAttribute('aria-label')) ?? '';
    const match = /^([\d,]+) overdue, ([\d,]+) due in 7 days, ([\d,]+) upcoming$/.exec(summary);
    const parts = (match ?? []).slice(1).map((n) => Number(n.replace(/,/g, '')));
    expect(parts.reduce((sum, n) => sum + n, 0)).toBe(await total(page, VACCINES));

    await expect(
      rows(page)
        .first()
        .getByText(/^Overdue · \d+ days?$/),
    ).toBeVisible();
    await expect(
      page.getByText('Overdue first · due = within 7 days · upcoming = 8 to 30 days'),
    ).toBeVisible();
    await expect(tab(page, VAX_TAB)).toHaveAttribute('aria-pressed', 'true');

    await tab(page, ISSUES_TAB).click();
    await expect(page).toHaveURL(/tab=issues/);
    await expect(page.getByRole('table', { name: 'Health issues' })).toBeVisible();
    await expect(rows(page).first().getByText('Sick', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Sick first · Gau only suggests; the farmer confirms'),
    ).toBeVisible();
  });

  test('filters by farm and species, in the URL, with an empty state', async ({ page }) => {
    await open(page);
    const everywhere = await total(page, VACCINES);

    await farmFilter(page).selectOption(FEATURED.farms.shreeGanesh);
    await expect(page).toHaveURL(new RegExp(`farm=${FEATURED.farms.shreeGanesh}`));
    await expect(rows(page).first()).toContainText('Shree Ganesh Dairy');
    await expect.poll(() => total(page, VACCINES)).toBeLessThan(everywhere);
    for (const name of await rows(page).locator('small').allInnerTexts()) {
      expect(name).toBe('Shree Ganesh Dairy');
    }

    await speciesFilter(page).selectOption('buffalo');
    await expect(page).toHaveURL(/species=buffalo/);
    await expect(
      rows(page)
        .first()
        .getByText(/\(buffalo\)/),
    ).toBeVisible();
    const shown = await rows(page).count();
    await expect(rows(page).getByText(/\(buffalo\)/)).toHaveCount(shown);

    await page.reload();
    await expect(farmFilter(page)).toHaveValue(FEATURED.farms.shreeGanesh);
    await expect(speciesFilter(page)).toHaveValue('buffalo');

    // Gir Gau Shala keeps only cattle.
    await farmFilter(page).selectOption(FEATURED.farms.girGauShala);
    await expect(page.getByText('Nothing matches this farm and species')).toBeVisible();
    await expect(page.getByText('Pick “All farms” or another species.')).toBeVisible();
    await expectTotal(page, VACCINES, 0);
    await button(page, 'Clear filters').click();
    await expect(farmFilter(page)).toHaveValue('');
    await expect(speciesFilter(page)).toHaveValue('');
    await expectTotal(page, VACCINES, everywhere);

    await tab(page, ISSUES_TAB).click();
    await farmFilter(page).selectOption(FEATURED.farms.periyar);
    await expect(rows(page).first()).toContainText('Periyar Cattle Farm');
  });

  test('marks a vaccine given and undoes it, and both survive a reload', async ({ page }) => {
    await open(page);
    const before = await total(page, VACCINES);
    const row = rows(page).first();
    const animal = await row.locator('b').innerText();
    const was = await row.getByText(/^Overdue · /).innerText();

    await row.getByRole('button', { name: 'Mark given' }).click();
    await expect(toast(page, /marked given for .* · the farmer sees it in the app/)).toBeVisible();
    // It stays where it was, ready for Undo.
    await expect(row.getByText('Given today')).toBeVisible();
    await expect(row.locator('b')).toHaveText(animal);
    await expect(row.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expectTotal(page, VACCINES, before - 1);

    await page.reload();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(row.getByText('Given today')).toBeVisible();
    await expectTotal(page, VACCINES, before - 1);

    await row.getByRole('button', { name: 'Undo' }).click();
    await expect(toast(page, `is back to ${was.toLowerCase()}`)).toBeVisible();
    await expect(row.getByText(was)).toBeVisible();
    await expect(row.getByRole('button', { name: 'Mark given' })).toBeVisible();
    await expectTotal(page, VACCINES, before);

    await page.reload();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(row.getByText(was)).toBeVisible();
    await expectTotal(page, VACCINES, before);
  });

  test('marks an issue resolved and undoes it, and both survive a reload', async ({ page }) => {
    await open(page, undefined, '?tab=issues');
    const before = await total(page, ISSUES);
    const row = rows(page).first();
    const issue = await row.locator('td').nth(1).locator('b').innerText();

    await row.getByRole('button', { name: 'Mark resolved' }).click();
    await expect(toast(page, `“${issue}” resolved for`)).toBeVisible();
    await expect(row.getByText('Resolved', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expectTotal(page, ISSUES, before - 1);

    await page.reload();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(row.getByText('Resolved', { exact: true })).toBeVisible();

    await row.getByRole('button', { name: 'Undo' }).click();
    await expect(toast(page, 'Undone · back to sick')).toBeVisible();
    await expect(row.getByText('Sick', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Mark resolved' })).toBeVisible();
    await expectTotal(page, ISSUES, before);
  });

  test('the schedule button counts the herd live', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.shreeGanesh}`);
    await button(page, 'Vaccine schedule').click();
    await expect(page.getByText('Add a vaccine schedule')).toBeVisible();
    await expect(
      page.getByText('Creates a reminder for each animal. The farmer sees it in the app.'),
    ).toBeVisible();
    await expect(page.getByLabel('Vaccine', { exact: true })).toHaveValue('FMD (foot-and-mouth)');
    await expect(page.getByLabel('Note for the farmer')).toHaveValue(
      'Ask your vet or the local veterinary dispensary for the booster dose.',
    );

    // The farm on screen is the one the count is for, even if the farms load after the panel opens.
    await expect(page.getByLabel('Farm', { exact: true }).last()).toHaveValue(
      FEATURED.farms.shreeGanesh,
    );
    await expect(button(page, 'Create 41 reminders')).toBeEnabled();
    await page.getByLabel('Give to').selectOption('buffalo');
    await expect(button(page, 'Create 17 reminders')).toBeEnabled();
    await page.getByLabel('Give to').selectOption('one');
    await expect(button(page, 'Create 1 reminder')).toBeEnabled();

    await page.getByLabel('Give to').selectOption('buffalo');
    await page.getByLabel('Farm', { exact: true }).last().selectOption(FEATURED.farms.girGauShala);
    await expect(button(page, 'Create 0 reminders')).toBeDisabled();
    await expect(page.getByText('No buffalo on this farm.')).toBeVisible();

    await button(page, 'Cancel').click();
    await expect(page.getByText('Add a vaccine schedule')).toHaveCount(0);
  });

  test('creates a schedule for a herd, and it survives a reload', async ({ page }) => {
    await open(page, undefined, `?tab=issues&farm=${FEATURED.farms.shreeGanesh}`);
    const before = await total(page, VACCINES);
    await button(page, 'Vaccine schedule').click();
    await page.getByLabel('Vaccine', { exact: true }).fill('Test booster');
    await button(page, 'Create 41 reminders').click();

    await expect(
      toast(page, '41 reminders created for Test booster at Shree Ganesh Dairy'),
    ).toBeVisible();
    await expect(page.getByText('Add a vaccine schedule')).toHaveCount(0);
    await expect(tab(page, VAX_TAB)).toHaveAttribute('aria-pressed', 'true');
    await expectTotal(page, VACCINES, before + 41);

    await page.reload();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expectTotal(page, VACCINES, before + 41);

    // 15 days ahead sorts after the overdue and due rows, so walk to the page that holds them.
    const reminder = rows(page).filter({ hasText: 'Test booster' }).first();
    for (let turn = 0; turn < 12 && !(await reminder.isVisible()); turn++) {
      await page.getByRole('button', { name: /next/i }).click();
      await page.waitForTimeout(100);
    }
    await expect(reminder.getByText('Upcoming')).toBeVisible();
  });

  test('creates a reminder for one animal', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.shreeGanesh}`);
    const before = await total(page, VACCINES);
    await button(page, 'Vaccine schedule').click();
    await page.getByLabel('Give to').selectOption('one');

    await button(page, 'Create 1 reminder').click();
    await expect(page.getByText('Add the animal’s tag and name.')).toBeVisible();
    await page.getByLabel(/^Animal/).fill('Nobody at all');
    await button(page, 'Create 1 reminder').click();
    await expect(
      page.getByText('No animal like that on this farm.', { exact: false }),
    ).toBeVisible();

    await page.getByLabel(/^Animal/).fill('Gauri');
    await button(page, 'Create 1 reminder').click();
    await expect(
      toast(page, '1 reminder created for FMD (foot-and-mouth) at Shree Ganesh Dairy'),
    ).toBeVisible();
    await expectTotal(page, VACCINES, before + 1);
  });

  test('checks the schedule form', async ({ page }) => {
    await open(page);
    await button(page, 'Vaccine schedule').click();
    await expect(createButton(page)).toBeEnabled();
    await page.getByLabel('Vaccine', { exact: true }).fill('   ');
    await createButton(page).click();
    await expect(page.getByText('Add the vaccine name first')).toBeVisible();
    await page.getByLabel(/^Vaccine/).fill('FMD');
    await page.getByLabel(/^Due date/).fill('2020-01-01');
    await createButton(page).click();
    await expect(page.getByText("The due date can't be in the past.")).toBeVisible();
  });

  test('a far-off reminder says when it will be listed', async ({ page }) => {
    await open(page, undefined, `?farm=${FEATURED.farms.shreeGanesh}`);
    const before = await total(page, VACCINES);
    await button(page, 'Vaccine schedule').click();
    const far = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel('Due date').fill(far);
    await button(page, 'Create 41 reminders').click();
    await expect(
      toast(page, /41 reminders created .* · listed here from \d\d \w{3} \d{4}/),
    ).toBeVisible();
    await expectTotal(page, VACCINES, before);
  });

  test('opens on the tab and farm in the URL, as the farm page links', async ({ page }) => {
    await open(page, undefined, `?tab=issues&farm=${FEATURED.farms.shreeGanesh}`);
    await expect(tab(page, ISSUES_TAB)).toHaveAttribute('aria-pressed', 'true');
    await expect(farmFilter(page)).toHaveValue(FEATURED.farms.shreeGanesh);
  });

  test('support can mark and schedule', async ({ page }) => {
    await open(page, SUPPORT);
    await expect(button(page, 'Vaccine schedule')).toBeVisible();
    await expect(rows(page).first().getByRole('button', { name: 'Mark given' })).toBeVisible();
    await tab(page, ISSUES_TAB).click();
    await expect(rows(page).first().getByRole('button', { name: 'Mark resolved' })).toBeVisible();
  });

  test('a viewer sees everything but no controls', async ({ page }) => {
    await open(page, VIEWER);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByRole('region', { name: VACCINES })).toBeVisible();
    await expect(button(page, 'Vaccine schedule')).toHaveCount(0);
    await expect(button(page, 'Mark given')).toHaveCount(0);
    await tab(page, ISSUES_TAB).click();
    await expect(rows(page).first()).toBeVisible();
    await expect(button(page, 'Mark resolved')).toHaveCount(0);
    await expect(button(page, 'Undo')).toHaveCount(0);
    await farmFilter(page).selectOption(FEATURED.farms.shreeGanesh);
    await expect(rows(page).first()).toContainText('Shree Ganesh Dairy');
  });
});
