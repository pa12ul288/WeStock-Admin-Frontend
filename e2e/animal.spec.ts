import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';
const GAURI = `/animals/${FEATURED.animals.gauri}`;

const dialog = (page: Page) => page.getByRole('dialog');

interface AuditRow {
  action: string;
  table_name: string;
  note: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
}

async function latestAudit(page: Page, table: string): Promise<AuditRow> {
  const rows = await page.evaluate(
    async ({ path, table: name }) => {
      const { dataSource } = await import(/* @vite-ignore */ path);
      return dataSource.listAudit({ table_name: name, limit: 1 });
    },
    { path: '/src/data/index.ts', table },
  );
  return rows[0] as AuditRow;
}

async function openAnimal(page: Page, email?: string, path = GAURI, name = 'Gauri') {
  await signIn(page, email);
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** The pills beside the name. "Pregnant" also appears in the reproduction history. */
const titleRow = (page: Page) => page.getByRole('heading', { level: 1 }).locator('..');

const card = (page: Page, label: string) =>
  page.locator('section', { has: page.getByText(label, { exact: true }) });

test.describe('animal page', () => {
  test('shows the header, cards and every section', async ({ page }) => {
    await openAnimal(page);
    await expect(page.getByText('Gauri · tag 01').first()).toBeVisible();
    await expect(titleRow(page).getByText('Active', { exact: true })).toBeVisible();
    await expect(titleRow(page).getByText('Pregnant', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Shree Ganesh Dairy' })).toBeVisible();
    for (const label of [
      'Total pregnancies',
      'Days in milk',
      'Milk today',
      'Open health issues',
      'Collar',
      'Body temperature · today',
      'Activity · today',
      'Milk · last 30 days',
      'Vaccinations',
      'Reproduction history',
      'Health history',
      'Photos',
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/Current pregnancy · cycle \d/)).toBeVisible();
    await expect(page.getByText(/day \d+ of \d+ · \d+%/)).toBeVisible();
    await expect(card(page, 'Photos').getByRole('img')).toHaveCount(3);
    await expect(page.getByText('3 of 10')).toBeVisible();
    await expect(card(page, 'Reproduction history').getByText(/· now/)).toBeVisible();
  });

  test('hides the collar sections when the animal has no collar', async ({ page }) => {
    await openAnimal(page, undefined, `/animals/${FEATURED.animals.neeli}`, 'Neeli');
    await expect(page.getByText('Collar', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Body temperature · today')).toHaveCount(0);
    await expect(page.getByText('Activity · today')).toHaveCount(0);
    await expect(page.getByText(/open issue/).first()).toBeVisible();
  });

  test('an unknown animal gets its own message', async ({ page }) => {
    await signIn(page);
    await page.goto('/animals/nothing-here');
    await expect(page.getByRole('heading', { name: "This animal isn't in the app" })).toBeVisible();
    await page.getByRole('link', { name: 'Back to livestock' }).click();
    await expect(page).toHaveURL(/\/livestock$/);
  });

  test('marks sold with a date and note, then active again', async ({ page }) => {
    await openAnimal(page);
    await page.getByRole('button', { name: 'Mark sold or deceased' }).click();
    const form = dialog(page);
    await expect(
      form.getByRole('heading', { name: 'Mark Gauri as sold or deceased' }),
    ).toBeVisible();
    await form.getByLabel('New status').selectOption('sold');
    await form.getByLabel('Date').fill('2026-01-15');
    await form.getByLabel('Note').fill('Sold to a farmer in Sangli');
    await form.getByRole('button', { name: 'Save status' }).click();
    await expect(page.getByText('Gauri marked sold on 15 Jan 2026')).toBeVisible();

    await expect(titleRow(page).getByText('Sold', { exact: true })).toBeVisible();
    await expect(titleRow(page).getByText('Pregnant', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Sold on 15 Jan 2026 · Sold to a farmer in Sangli')).toBeVisible();
    const logged = await latestAudit(page, 'animals');
    expect(logged.note).toBe('Sold on 15 Jan 2026 · Sold to a farmer in Sangli');
    expect(logged.changes.status).toEqual({ from: 'active', to: 'sold' });

    await page.reload();
    await expect(titleRow(page).getByText('Sold', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Mark active again' }).click();
    await expect(page.getByText('Gauri is active again')).toBeVisible();
    await expect(titleRow(page).getByText('Active', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark sold or deceased' })).toBeVisible();
  });

  test('marks deceased; the date cannot be in the future', async ({ page }) => {
    await openAnimal(page);
    await page.getByRole('button', { name: 'Mark sold or deceased' }).click();
    const form = dialog(page);
    await form.getByLabel('New status').selectOption('deceased');
    await form.getByLabel('Date').fill('2099-01-01');
    await form.getByRole('button', { name: 'Save status' }).click();
    await expect(form.getByText("The date can't be in the future.")).toBeVisible();
    await form.getByLabel('Date').fill('2026-02-01');
    await form.getByRole('button', { name: 'Save status' }).click();
    await expect(page.getByText('Gauri marked deceased on 01 Feb 2026')).toBeVisible();
    await expect(titleRow(page).getByText('Deceased', { exact: true })).toBeVisible();
  });

  test('edits the animal, with the checks on the fields', async ({ page }) => {
    await openAnimal(page);
    await page.getByRole('button', { name: 'Edit animal' }).click();
    await expect(page.getByText('Every change is saved to the activity log')).toBeVisible();
    const tag = page.getByLabel(/^Tag number/);
    await expect(tag).toHaveValue('01');

    await tag.fill('02');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Tag 02 is already used on this farm.')).toBeVisible();

    await tag.fill('101');
    await page.getByLabel('Pashu Aadhaar').fill('123');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Pashu Aadhaar has 12 digits.', { exact: false })).toBeVisible();

    await page.getByLabel('Pashu Aadhaar').fill('1111 2222 3333');
    await page.getByLabel('Name', { exact: true }).fill('Gauri Devi');
    await page.getByLabel('Breed').fill('Sahiwal');
    await page.getByLabel('Date of birth').fill('2022-09-03');
    await page.locator('select[name=shed]').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Changes saved · logged in the activity log')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Gauri Devi' })).toBeVisible();
    await expect(page.getByText('1111 2222 3333')).toBeVisible();
    await expect(page.getByText('03 Sep 2022')).toBeVisible();
    await expect(page.getByText(/Sahiwal/).first()).toBeVisible();
    await expect(page.getByText(/last changed .* by Anjali Menon/)).toBeVisible();
    const logged = await latestAudit(page, 'animals');
    expect(logged.changes.tag_number).toEqual({ from: '01', to: '101' });
    expect(logged.changes.species_id).toBeUndefined();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Gauri Devi' })).toBeVisible();
  });

  test('cancel leaves the animal alone', async ({ page }) => {
    await openAnimal(page);
    await page.getByRole('button', { name: 'Edit animal' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Other');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Gauri' })).toBeVisible();
    await expect(page.getByLabel('Tag number', { exact: true })).toHaveCount(0);
  });

  test('adds a vaccination, marks it given, undoes it', async ({ page }) => {
    await openAnimal(page);
    const section = card(page, 'Vaccinations');
    await section.getByRole('button', { name: 'Add', exact: true }).click();
    const form = dialog(page);
    await form.getByRole('button', { name: 'Add vaccination' }).click();
    await expect(form.getByText('Add the vaccine name.')).toBeVisible();
    await form.getByLabel('Vaccine').fill('Theileriosis');
    await form.getByLabel('Due date').fill('2099-03-01');
    await form.getByRole('button', { name: 'Add vaccination' }).click();
    await expect(page.getByText('Theileriosis reminder added')).toBeVisible();

    const row = section.locator('div', { hasText: 'Theileriosis' }).last();
    await expect(row).toContainText('Due 01 Mar 2099');
    await expect(row).toContainText('Upcoming');

    await row.getByRole('button', { name: 'Mark given' }).click();
    await expect(
      page.getByText('Theileriosis marked as given · the farmer sees it in the app'),
    ).toBeVisible();
    await expect(row).toContainText('Done');
    await expect(row).toContainText('Given');
    expect((await latestAudit(page, 'vaccinations')).changes.done_date?.from).toBeNull();

    await page.reload();
    const again = card(page, 'Vaccinations').locator('div', { hasText: 'Theileriosis' }).last();
    await again.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone · Theileriosis is back to upcoming')).toBeVisible();
    await expect(again).toContainText('Due 01 Mar 2099');
    await expect(again.getByRole('button', { name: 'Mark given' })).toBeVisible();
  });

  test('records a vaccination as already given', async ({ page }) => {
    await openAnimal(page);
    await card(page, 'Vaccinations').getByRole('button', { name: 'Add', exact: true }).click();
    const form = dialog(page);
    await form.getByLabel('Vaccine').fill('Rabies');
    await form.getByLabel('Already given?').selectOption('yes');
    await form.getByRole('button', { name: 'Add vaccination' }).click();
    await expect(page.getByText('Rabies recorded as given')).toBeVisible();
    const row = card(page, 'Vaccinations').locator('div', { hasText: 'Rabies' }).last();
    await expect(row).toContainText('Done');
    await expect(row.getByRole('button', { name: 'Undo' })).toBeVisible();
  });

  test('adds a health event, resolves it, undoes that', async ({ page }) => {
    await openAnimal(page);
    const section = card(page, 'Health history');
    await section.getByRole('button', { name: 'Add event' }).click();
    const form = dialog(page);
    await form.getByRole('button', { name: 'Add event' }).click();
    await expect(form.getByText('Say what happened.')).toBeVisible();
    await form.getByLabel('What happened').fill('Not eating since morning');
    await form.getByLabel('Status').selectOption({ label: 'Sick' });
    await form.getByLabel('Notes').fill('Vet is coming');
    await form.getByRole('button', { name: 'Add event' }).click();
    await expect(
      page.getByText('Health event added · the farmer sees it in the app'),
    ).toBeVisible();

    await expect(section.getByText('1 open issue')).toBeVisible();
    const row = section.locator('div', { hasText: 'Not eating since morning' }).last();
    await expect(row).toContainText('Sick');
    await expect(row).toContainText('Staff');
    await expect(row).toContainText('Vet is coming');

    await row.getByRole('button', { name: 'Mark resolved' }).click();
    await expect(page.getByText('“Not eating since morning” marked resolved')).toBeVisible();
    await expect(row).toContainText('Resolved');
    await expect(section.getByText('No open issues')).toBeVisible();

    await page.reload();
    const again = card(page, 'Health history')
      .locator('div', { hasText: 'Not eating since morning' })
      .last();
    await again.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone · back to sick')).toBeVisible();
    await expect(again).toContainText('Sick');
    await expect(again.getByRole('button', { name: 'Mark resolved' })).toBeVisible();
  });

  test('links to the farm, milk entries and the cycle', async ({ page }) => {
    await openAnimal(page);
    await expect(page.getByRole('link', { name: /Edit cycle/ })).toHaveAttribute(
      'href',
      /\/reproduction\?stage=pregnant&farm=/,
    );
    await page.getByRole('link', { name: /Entries/ }).click();
    await expect(page).toHaveURL(/\/milk-feed\?farm=/);
  });
});

test.describe('animal page roles', () => {
  test('support can use every control', async ({ page }) => {
    await openAnimal(page, SUPPORT);
    for (const name of ['Mark sold or deceased', 'Edit animal', 'Add event']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    await expect(
      card(page, 'Vaccinations').getByRole('button', { name: 'Mark given' }).first(),
    ).toBeVisible();
  });

  test('viewer sees everything but no controls', async ({ page }) => {
    await openAnimal(page, VIEWER);
    await expect(page.getByText('Vaccinations', { exact: true })).toBeVisible();
    await expect(page.getByText('Health history', { exact: true })).toBeVisible();
    for (const name of [
      'Mark sold or deceased',
      'Mark active again',
      'Edit animal',
      'Add',
      'Add event',
      'Mark given',
      'Mark resolved',
      'Undo',
    ]) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('link', { name: /Edit cycle/ })).toHaveCount(0);
    // The milk link only reads, so it stays.
    await expect(page.getByRole('link', { name: /Entries/ })).toBeVisible();
  });

  test('viewer on a sold animal has no way to reactivate it', async ({ page }) => {
    await openAnimal(page, VIEWER, `/animals/${FEATURED.animals.bhuri}`, 'Bhuri');
    await expect(titleRow(page).getByText('Sold', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark active again' })).toHaveCount(0);
  });

  test('super admin sees Mark active again on a sold animal', async ({ page }) => {
    await openAnimal(page, undefined, `/animals/${FEATURED.animals.bhuri}`, 'Bhuri');
    await expect(page.getByRole('button', { name: 'Mark active again' })).toBeVisible();
  });
});
