import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SHREE = `/farms/${FEATURED.farms.shreeGanesh}`;
const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

/** Reads the data layer the running app is using: same module instance on the dev server. */
const DATA_MODULE = '/src/data/index.ts';

interface AuditRow {
  action: string;
  table_name: string;
  note: string | null;
  changes: Record<string, unknown>;
}

async function latestAudit(page: Page, limit = 5): Promise<AuditRow[]> {
  return page.evaluate(
    async ({ path, limit }) => {
      const { dataSource } = await import(/* @vite-ignore */ path);
      return dataSource.listAudit({ limit });
    },
    { path: DATA_MODULE, limit },
  );
}

async function csvLines(download: Download): Promise<string[]> {
  const text = await readFile(await download.path(), 'utf8');
  // slice: the file starts with a BOM.
  return text.slice(1).trim().split(/\r\n/);
}

const table = (page: Page, name: string) => page.getByRole('table', { name });
const rows = (page: Page, name: string) => table(page, name).locator('tbody tr');
const dialog = (page: Page) => page.getByRole('dialog');

async function openFarm(page: Page, email?: string, tab?: string) {
  await signIn(page, email);
  await page.goto(tab ? `${SHREE}?tab=${tab}` : SHREE);
  await expect(page.getByRole('heading', { level: 1, name: 'Shree Ganesh Dairy' })).toBeVisible();
}

test.describe('farmers and farms list', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto('/farmers');
    await expect(rows(page, 'Farmers').first()).toContainText(/\S/);
  });

  test('shows the four totals and the two views', async ({ page }) => {
    for (const label of ['Farmers', 'Logged this week', 'Quiet 3–7 days', 'Quiet 7+ days']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /^Farmers \d+/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: /^Farms \d+/ }).click();
    await expect(page).toHaveURL(/view=farms/);
    await expect(page.getByRole('searchbox', { name: 'Search farm or owner' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'App language' })).toBeHidden();
    await expect(rows(page, 'Farms').first()).toContainText(/Blackbox \+ collars|Manual entry/);
  });

  test('searches by name, phone and farm', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: 'Search name, phone or farm' });
    await search.fill('Ramesh Patil');
    await expect(page).toHaveURL(/q=Ramesh/);
    await expect(rows(page, 'Farmers')).toHaveCount(1);
    await expect(rows(page, 'Farmers')).toContainText('Shree Ganesh Dairy');

    await search.fill('97250 12308');
    await expect(rows(page, 'Farmers')).toHaveCount(1);
    await expect(rows(page, 'Farmers')).toContainText('Sunita Desai');

    await search.fill('Periyar Cattle');
    await expect(rows(page, 'Farmers')).toHaveCount(1);
    await expect(rows(page, 'Farmers')).toContainText('Joseph Varghese');
    await expect(page.getByText('Showing 1–1 of 1 matching farmers')).toBeVisible();
  });

  test('filters by state and language, and clears', async ({ page }) => {
    await page.getByRole('combobox', { name: 'State' }).selectOption('Kerala');
    await expect(page).toHaveURL(/state=Kerala/);
    await expect(rows(page, 'Farmers').first()).toContainText('Kerala');
    for (const row of await rows(page, 'Farmers').all()) await expect(row).toContainText('Kerala');

    await page.getByRole('combobox', { name: 'App language' }).selectOption('gu');
    await expect(page.getByText('Nothing matches these filters')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/state=/);
    await expect(rows(page, 'Farmers').first()).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'State' })).toHaveValue('');
  });

  test('pages through the list and keeps the page in the URL', async ({ page }) => {
    await expect(rows(page, 'Farmers')).toHaveCount(20);
    await expect(page.getByText(/^Showing 1–20 of \d+ farmers$/)).toBeVisible();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/^Showing 21–40 of \d+ farmers$/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/^Showing 21–40 of \d+ farmers$/)).toBeVisible();
  });

  test('a page past the end shows the last real page', async ({ page }) => {
    await page.goto('/farmers?page=999');
    await expect(page).toHaveURL(/page=\d$/);
    await expect(rows(page, 'Farmers').first()).toContainText(/\S/);
    await expect(page.getByText(/^Showing \d+–\d+ of \d+ farmers$/)).toBeVisible();
  });

  test('exports every matching row, not just the page', async ({ page }) => {
    const total = Number(
      (await page.getByText(/^Showing 1–20 of \d+ farmers$/).textContent())?.match(/of (\d+)/)?.[1],
    );
    expect(total).toBeGreaterThan(20);
    let downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    let download = await downloading;
    expect(download.suggestedFilename()).toBe('farmers.csv');
    let lines = await csvLines(download);
    expect(lines[0]).toBe('Farmer,Phone,App language,Farm,Animals,Location,Joined,Last entry');
    expect(lines).toHaveLength(total + 1);
    await expect(page.getByText(`farmers.csv downloaded · ${total} rows`)).toBeVisible();

    await page.getByRole('combobox', { name: 'State' }).selectOption('Kerala');
    await expect(page.getByText(/matching farmers$/)).toBeVisible();
    await expect(page.getByText(`of ${total} matching farmers`)).toBeHidden();
    const matching = Number(
      (await page.getByText(/matching farmers$/).textContent())?.match(/of (\d+)/)?.[1],
    );
    downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    lines = await csvLines(await downloading);
    expect(lines).toHaveLength(matching + 1);
    expect(lines.slice(1).every((line) => line.includes('Kerala'))).toBe(true);

    await page.getByRole('button', { name: /^Farms \d+/ }).click();
    await expect(rows(page, 'Farms').first()).toContainText('Kerala');
    downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    download = await downloading;
    expect(download.suggestedFilename()).toBe('farms.csv');
    lines = await csvLines(download);
    expect(lines[0]).toBe('Farm,Owner,Location,Sheds,Animals,Members,Mode,"Milk, last 7 days"');
  });

  test('a farmer row opens their first farm, a farm row opens that farm', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search name, phone or farm' }).fill('Ramesh Patil');
    await expect(rows(page, 'Farmers')).toHaveCount(1);
    await rows(page, 'Farmers').getByText('Marathi').click();
    await expect(page).toHaveURL(new RegExp(`${SHREE}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Shree Ganesh Dairy' })).toBeVisible();

    await page.goto('/farmers?view=farms&q=Gir%20Gau');
    await expect(rows(page, 'Farms')).toHaveCount(1);
    await page.getByRole('link', { name: 'Open Gir Gau Shala' }).click();
    await expect(page).toHaveURL(new RegExp(`/farms/${FEATURED.farms.girGauShala}$`));
  });
});

test.describe('farm page', () => {
  test('shows the header, record cards, chart, coming up and latest entries', async ({ page }) => {
    await openFarm(page);
    await expect(page.getByText('Ramesh Patil').first()).toBeVisible();
    await expect(page.getByText('Kolhapur, Maharashtra')).toBeVisible();
    await expect(page.getByText('App in Marathi')).toBeVisible();
    await expect(page.getByText('Blackbox + collars')).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: /Reproduction/ }),
    ).toHaveAttribute('href', `/reproduction?farm=${FEATURED.farms.shreeGanesh}`);
    await expect(page.getByRole('figure', { name: /Milk per day/ })).toBeVisible();
    await expect(page.getByText('Coming up')).toBeVisible();
    await expect(rows(page, 'Latest entries from the app')).toHaveCount(6);
    await expect(page.getByRole('link', { name: 'Activity log', exact: true })).toHaveAttribute(
      'href',
      '/staff',
    );
  });

  test('tabs live in the URL', async ({ page }) => {
    await openFarm(page);
    await page.getByRole('button', { name: 'Sheds & members' }).click();
    await expect(page).toHaveURL(/tab=sheds/);
    await expect(table(page, 'Sheds')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sheds & members' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Edit farm' }).click();
    await expect(page).toHaveURL(/tab=settings/);
    await expect(page.getByLabel('Farm name')).toHaveValue('Shree Ganesh Dairy');
  });

  test('add animal: checks the tag, adds, and survives a reload', async ({ page }) => {
    await openFarm(page);
    const animalsCard = page.locator('div', { hasText: /^Animals\d+/ }).last();
    await expect(animalsCard).toContainText('64');
    await page.getByRole('button', { name: 'Add animal' }).click();
    await dialog(page).getByRole('button', { name: 'Add animal' }).click();
    await expect(dialog(page).getByText('Add a tag number.')).toBeVisible();

    await dialog(page).getByLabel('Tag number').fill('01');
    await dialog(page).getByRole('button', { name: 'Add animal' }).click();
    await expect(dialog(page).getByText('Tag 01 is already used on this farm.')).toBeVisible();

    await dialog(page).getByLabel('Tag number').fill('655');
    await dialog(page).getByLabel('Name', { exact: true }).fill('Chitra');
    await dialog(page).getByLabel('Breed').fill('Gir');
    await dialog(page).getByRole('button', { name: 'Add animal' }).click();
    await expect(page.getByText('Tag 655 · Chitra added to Shree Ganesh Dairy')).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(animalsCard).toContainText('65');

    const audit = await latestAudit(page);
    expect(audit[0]).toMatchObject({ action: 'insert', table_name: 'animals' });
    await page.reload();
    await expect(animalsCard).toContainText('65');
  });

  test('add and edit a shed', async ({ page }) => {
    await openFarm(page, undefined, 'sheds');
    await page.getByRole('button', { name: 'Add shed' }).click();
    await dialog(page).getByRole('button', { name: 'Add shed' }).click();
    await expect(dialog(page).getByText('Add a shed code.')).toBeVisible();
    await dialog(page).getByLabel('Shed code').fill('S9');
    await dialog(page).getByLabel('Shed name').fill('Heifer shed');
    await dialog(page).getByRole('button', { name: 'Add shed' }).click();
    await expect(page.getByText('Shed S9 added')).toBeVisible();
    await expect(table(page, 'Sheds')).toContainText('Heifer shed');
    await expect(table(page, 'Sheds')).toContainText('No animals yet');

    await page.getByRole('button', { name: 'Edit Heifer shed' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Edit shed' })).toBeVisible();
    await expect(dialog(page).getByLabel('Shed code')).toHaveValue('S9');
    await dialog(page).getByLabel('Shed name').fill('Calving shed');
    await dialog(page).getByRole('button', { name: 'Save shed' }).click();
    await expect(page.getByText('Shed updated')).toBeVisible();
    await expect(table(page, 'Sheds')).toContainText('Calving shed');

    const audit = await latestAudit(page);
    expect(audit[0]).toMatchObject({ action: 'update', table_name: 'sheds' });
    expect(audit[1]).toMatchObject({ action: 'insert', table_name: 'sheds' });
    await page.reload();
    await expect(table(page, 'Sheds')).toContainText('Calving shed');
  });

  test('add a member: not found, already a member, then found', async ({ page }) => {
    await openFarm(page, undefined, 'sheds');
    await page.getByRole('button', { name: 'Add member' }).click();
    await dialog(page).getByRole('button', { name: 'Add member' }).click();
    await expect(dialog(page).getByText('Enter 10 digits after +91.')).toBeVisible();

    const phone = dialog(page).getByLabel('Phone number');
    await phone.fill('6000000000');
    await expect(
      dialog(page).getByText('Ask them to sign up in the WeSTOCK app first', { exact: false }),
    ).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Add member' }).click();
    await expect(dialog(page)).toBeVisible();

    await phone.fill('98220 12341');
    await expect(
      dialog(page).getByText('This person is already a member of this farm.'),
    ).toBeVisible();

    await phone.fill('+91 97250 12308');
    await expect(dialog(page).getByText('Sunita Desai')).toBeVisible();
    await dialog(page).getByLabel('Role').selectOption('manager');
    await dialog(page).getByRole('button', { name: 'Add member' }).click();
    await expect(page.getByText('Sunita Desai added as manager')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Role for Sunita Desai' })).toHaveValue(
      'manager',
    );

    const audit = await latestAudit(page);
    expect(audit[0]).toMatchObject({ action: 'insert', table_name: 'farm_members' });
  });

  test("change a member's role; the owner's role can't be changed here", async ({ page }) => {
    await openFarm(page, undefined, 'sheds');
    const owner = page.getByRole('combobox', { name: 'Role for Ramesh Patil' });
    await expect(owner).toHaveValue('owner');
    await expect(owner.locator('option')).toHaveCount(1);

    const select = page.getByRole('combobox', { name: /^Role for / }).nth(1);
    const label = await select.getAttribute('aria-label');
    const name = label?.replace('Role for ', '') ?? '';
    const next = (await select.inputValue()) === 'worker' ? 'manager' : 'worker';
    await select.selectOption(next);
    await expect(
      page.getByText(`${name} is now ${next} · saved to the activity log`),
    ).toBeVisible();
    const audit = await latestAudit(page);
    expect(audit[0]).toMatchObject({ action: 'update', table_name: 'farm_members' });
    await page.reload();
    await expect(page.getByRole('combobox', { name: `Role for ${name}` })).toHaveValue(next);
  });

  test('farm settings: validate, save and merge alerts', async ({ page }) => {
    await openFarm(page, undefined, 'settings');
    await page.getByLabel('Farm name').fill('');
    await page.getByLabel('Map location').fill('somewhere');
    await page.getByLabel('Fever alert at').fill('0');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Add a farm name.')).toBeVisible();
    await expect(page.getByText(/^Enter latitude and longitude/)).toBeVisible();
    await expect(page.getByText('Enter a temperature above 0.')).toBeVisible();

    const settingsBefore = await page.evaluate(
      async ({ path, id }) => {
        const { dataSource } = await import(/* @vite-ignore */ path);
        return (await dataSource.getFarm(id)).farm.settings;
      },
      { path: DATA_MODULE, id: FEATURED.farms.shreeGanesh },
    );

    await page.getByLabel('Farm name').fill('Shree Ganesh Gotha');
    await page.getByLabel('District').fill('Sangli');
    await page.getByLabel('Map location').fill('16.8, 74.5');
    await page.getByLabel('Description').fill('Moved to the new shed.');
    await page.getByLabel('Fever alert at').fill('40.5');
    await page.getByLabel('Collar offline after').fill('30');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Farm details saved · logged in the activity log')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Shree Ganesh Gotha' })).toBeVisible();
    await expect(page.getByText('Sangli, Maharashtra')).toBeVisible();
    await expect(page).not.toHaveURL(/tab=/);

    const saved = await page.evaluate(
      async ({ path, id }) => {
        const { dataSource } = await import(/* @vite-ignore */ path);
        return (await dataSource.getFarm(id)).farm;
      },
      { path: DATA_MODULE, id: FEATURED.farms.shreeGanesh },
    );
    expect(saved).toMatchObject({ lat: 16.8, lng: 74.5, description: 'Moved to the new shed.' });
    expect(saved.settings).toEqual({
      ...settingsBefore,
      high_temp_c: 40.5,
      offline_after_min: 30,
    });

    const audit = await latestAudit(page);
    expect(audit[0]).toMatchObject({ action: 'update', table_name: 'farms' });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Shree Ganesh Gotha' })).toBeVisible();
  });

  test('saving without touching the map pin leaves it exactly as stored', async ({ page }) => {
    await openFarm(page, undefined, 'settings');
    await page.getByLabel('District').fill('Satara');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Satara, Maharashtra')).toBeVisible();
    const audit = await latestAudit(page);
    expect(Object.keys(audit[0]?.changes ?? {})).toEqual(['district']);
  });

  test('transfer ownership with a note', async ({ page }) => {
    await openFarm(page, undefined, 'settings');
    await page.getByRole('button', { name: 'Transfer ownership' }).click();
    const newOwner = dialog(page).getByLabel('New owner');
    await expect(newOwner.locator('option', { hasText: 'Ramesh Patil' })).toHaveCount(0);
    const name = (await newOwner.locator('option').first().textContent()) ?? '';
    await dialog(page).getByLabel('Note').fill('Farmer called in');
    await dialog(page).getByRole('button', { name: 'Transfer' }).click();
    await expect(page.getByText(`${name} now owns Shree Ganesh Dairy`)).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole('main').getByText(name).first()).toBeVisible();

    const audit = await latestAudit(page, 3);
    expect(audit.every((row) => row.note === 'Farmer called in')).toBe(true);
    expect(audit.map((row) => row.table_name)).toContain('farms');

    await page.goto(`${SHREE}?tab=sheds`);
    await expect(page.getByRole('combobox', { name: 'Role for Ramesh Patil' })).toHaveValue(
      'manager',
    );
    await expect(page.getByRole('combobox', { name: `Role for ${name}` })).toHaveValue('owner');
  });

  test('delete asks for the name, then removes the farm for good', async ({ page }) => {
    await openFarm(page, undefined, 'settings');
    await page.getByRole('button', { name: 'Delete farm and its records' }).click();
    await expect(
      dialog(page).getByRole('heading', { name: 'Delete Shree Ganesh Dairy?' }),
    ).toBeVisible();
    await expect(dialog(page).getByText(/its 64 animals and all their milk/)).toBeVisible();

    await dialog(page).getByRole('button', { name: 'Delete farm' }).click();
    await expect(
      dialog(page).getByText('Type “Shree Ganesh Dairy” exactly to confirm.'),
    ).toBeVisible();
    await dialog(page).getByLabel('Type the farm name to confirm').fill('Shree Ganesh');
    await dialog(page).getByRole('button', { name: 'Delete farm' }).click();
    await expect(dialog(page).getByRole('alert')).toBeVisible();

    await dialog(page).getByLabel('Type the farm name to confirm').fill('Shree Ganesh Dairy');
    await dialog(page).getByRole('button', { name: 'Delete farm' }).click();
    await expect(
      page.getByText('Shree Ganesh Dairy deleted · saved to the activity log'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This farm was deleted' })).toBeVisible();

    const audit = await latestAudit(page);
    expect(audit[0]).toMatchObject({ action: 'delete', table_name: 'farms' });

    await page.getByRole('link', { name: 'Back to farmers & farms' }).click();
    await page.getByRole('searchbox', { name: 'Search farm or owner' }).fill('Shree Ganesh');
    await expect(page.getByText('Nothing matches these filters')).toBeVisible();

    await page.goto(SHREE);
    await expect(page.getByRole('heading', { name: "This farm isn't in the app" })).toBeVisible();
  });

  test('a link to a farm that does not exist says so', async ({ page }) => {
    await signIn(page);
    await page.goto('/farms/not-a-farm');
    await expect(page.getByRole('heading', { name: "This farm isn't in the app" })).toBeVisible();
  });

  test('dialogs close on Escape and Cancel without saving', async ({ page }) => {
    await openFarm(page, undefined, 'sheds');
    await page.getByRole('button', { name: 'Add shed' }).click();
    await dialog(page).getByLabel('Shed code').fill('S7');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await page.getByRole('button', { name: 'Add member' }).click();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(table(page, 'Sheds')).not.toContainText('S7');
  });
});

test.describe('role gating', () => {
  test('support can edit and transfer but not delete', async ({ page }) => {
    await openFarm(page, SUPPORT, 'settings');
    await expect(page.getByRole('button', { name: 'Edit farm' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add animal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transfer ownership' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete farm and its records' })).toHaveCount(0);

    await page.getByLabel('District').fill('Pune');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Pune, Maharashtra')).toBeVisible();

    await page.goto(`${SHREE}?tab=sheds`);
    await expect(page.getByRole('button', { name: 'Add shed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add member' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^Role for / }).first()).toBeVisible();
  });

  test('the adapter refuses a support delete too', async ({ page }) => {
    await openFarm(page, SUPPORT);
    const code = await page.evaluate(
      async ({ path, id }) => {
        const { dataSource } = await import(/* @vite-ignore */ path);
        return dataSource.deleteFarm(id).then(
          () => 'deleted',
          (error: { code: string }) => error.code,
        );
      },
      { path: DATA_MODULE, id: FEATURED.farms.shreeGanesh },
    );
    expect(code).toBe('not_allowed');
  });

  test('viewer sees everything but can change nothing', async ({ page }) => {
    await openFarm(page, VIEWER);
    await expect(page.getByRole('button', { name: 'Edit farm' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add animal' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Sheds & members' }).click();
    await expect(table(page, 'Sheds')).toContainText('Main shed');
    await expect(page.getByText('Farm members')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add shed' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add member' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /^Role for / })).toHaveCount(0);
    await expect(page.getByText('Owner', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Farm settings' }).click();
    await expect(page.getByLabel('Farm name')).toBeDisabled();
    await expect(page.getByLabel('Farm name')).toHaveValue('Shree Ganesh Dairy');
    await expect(page.getByLabel('Fever alert at')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
    await expect(page.getByText('Danger zone')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Transfer ownership' })).toHaveCount(0);
  });

  test('viewer can still search and export', async ({ page }) => {
    await signIn(page, VIEWER);
    await page.goto('/farmers');
    await expect(rows(page, 'Farmers').first()).toContainText(/\S/);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect((await downloading).suggestedFilename()).toBe('farmers.csv');
  });

  test('switching role in the user menu hides the controls straight away', async ({ page }) => {
    await openFarm(page, undefined, 'settings');
    await expect(page.getByRole('button', { name: 'Delete farm and its records' })).toBeVisible();
    await page
      .getByRole('button', { name: /Anjali Menon|account|user menu/i })
      .first()
      .click();
    await page.getByRole('button', { name: 'Viewer' }).click();
    await expect(page.getByRole('button', { name: 'Delete farm and its records' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit farm' })).toHaveCount(0);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const noSideScroll = async (page: Page) => {
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  };

  test('no sideways scroll on any tab, view or dialog', async ({ page }) => {
    await signIn(page);
    await page.goto('/farmers');
    await expect(rows(page, 'Farmers').first()).toContainText(/\S/);
    await noSideScroll(page);
    await page.screenshot({ path: '.shots/farmers-view-390.png', fullPage: true });
    await page.getByRole('button', { name: /^Farms \d+/ }).click();
    await expect(rows(page, 'Farms').first()).toContainText(/\S/);
    await noSideScroll(page);
    await page.screenshot({ path: '.shots/farms-view-390.png', fullPage: true });

    await page.goto(SHREE);
    await expect(rows(page, 'Latest entries from the app')).toHaveCount(6);
    await noSideScroll(page);
    await page.screenshot({ path: '.shots/farm-overview-390.png', fullPage: true });

    await page.getByRole('button', { name: 'Sheds & members' }).click();
    await expect(table(page, 'Sheds')).toContainText('cattle');
    await noSideScroll(page);
    await page.screenshot({ path: '.shots/farm-sheds-390.png', fullPage: true });
    await page.getByRole('button', { name: 'Add member' }).click();
    await noSideScroll(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Farm settings' }).click();
    await expect(page.getByLabel('Farm name')).toBeVisible();
    await noSideScroll(page);
    await page.screenshot({ path: '.shots/farm-settings-390.png', fullPage: true });
  });
});

test('desktop screens for comparison', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto('/farmers?view=farms');
  await expect(rows(page, 'Farms').first()).toContainText(/\S/);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.shots/farms-view-1440.png', fullPage: true });

  await page.goto(`${SHREE}?tab=sheds`);
  await expect(table(page, 'Sheds')).toContainText('cattle');
  await page.screenshot({ path: '.shots/farm-sheds-1440.png', fullPage: true });

  await page.goto(`${SHREE}?tab=settings`);
  await expect(page.getByLabel('Farm name')).toBeVisible();
  await page.screenshot({ path: '.shots/farm-settings-1440.png', fullPage: true });
  await page.getByRole('button', { name: 'Delete farm and its records' }).click();
  await expect(dialog(page)).toBeVisible();
  await page.screenshot({ path: '.shots/farm-delete-1440.png' });
});
