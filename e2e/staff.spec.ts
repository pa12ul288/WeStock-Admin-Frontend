import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

const dialog = (page: Page) => page.getByRole('dialog');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const toast = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });
const staffRows = (page: Page) =>
  page.getByRole('table', { name: 'brainwired staff' }).locator('tbody tr');
const logRows = (page: Page) =>
  page.getByRole('table', { name: 'Activity log' }).locator('tbody tr');
const staffRow = (page: Page, name: string) => staffRows(page).filter({ hasText: name });
const roleSelect = (page: Page, name: string) =>
  page.getByRole('combobox', { name: `Role for ${name}` });
const filter = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });
const countLine = (page: Page) => page.getByText(/^Showing [\d,]+ of [\d,]+ changes/);

async function open(page: Page, email?: string, query = '') {
  await signIn(page, email);
  await page.goto(`/staff${query}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Staff & activity log' })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
}

/** "Showing 8 of 11 …": the two numbers. */
async function counts(page: Page): Promise<[number, number]> {
  const text = (await countLine(page).textContent()) ?? '';
  const match = /Showing ([\d,]+) of ([\d,]+)/.exec(text);
  const number = (raw: string | undefined) => Number((raw ?? '').replace(/,/g, ''));
  return [number(match?.[1]), number(match?.[2])];
}

test.describe('staff and activity log', () => {
  test('shows the staff, the roles and the log in the prototype words', async ({ page }) => {
    await open(page);
    await expect(
      page.getByText(
        'Who can sign in to this dashboard, and a permanent record of every change staff make to farmer data.',
      ),
    ).toBeVisible();
    await expect(page.getByText('4 active · 1 invite waiting')).toBeVisible();
    await expect(page.getByText('Edits, deletions and role changes')).toBeVisible();
    await expect(
      page.getByText('Only a super admin can invite, remove or change roles'),
    ).toBeVisible();
    await expect(staffRows(page)).toHaveCount(5);
    await expect(staffRow(page, 'Anjali Menon')).toContainText('Now');
    await expect(staffRow(page, 'Anjali Menon').getByRole('button')).toHaveText('You');
    await expect(staffRow(page, 'Vikram Nair')).toContainText('Not signed in yet');
    await expect(staffRow(page, 'Vikram Nair')).toContainText('Invite sent');
    await expect(staffRow(page, 'Vikram Nair').getByRole('button')).toHaveText('Cancel invite');
    await expect(staffRow(page, 'Priya Sharma').getByRole('button')).toHaveText('Remove');
    await expect(page.getByText('What each role can do')).toBeVisible();
    await expect(
      page.getByText('Sees every farm and downloads reports. Cannot change anything.'),
    ).toBeVisible();

    await expect(logRows(page).first()).toBeVisible();
    await expect(countLine(page)).toContainText('changes this week');
    await expect(page.getByText(/log entries can’t be edited or deleted/)).toBeVisible();
    const bhuri = logRows(page).filter({ hasText: 'Animal · 23 Bhuri' });
    await expect(bhuri).toContainText('Shree Ganesh Dairy');
    await expect(bhuri).toContainText('Status: Active → Sold');
    await expect(bhuri).toContainText('Farmer sold her');
  });

  test('invites staff, checks the form, and the invite survives a reload', async ({ page }) => {
    await open(page);
    await button(page, 'Invite staff').click();
    await expect(dialog(page).getByRole('heading', { name: 'Invite staff' })).toBeVisible();
    await button(page, 'Send invite').click();
    await expect(dialog(page).getByText('Add a name and a valid work email.')).toBeVisible();

    await dialog(page).getByLabel('Full name').fill('Meera Iyer');
    await dialog(page).getByLabel('Work email').fill('meera@');
    await button(page, 'Send invite').click();
    await expect(dialog(page).getByText('Add a name and a valid work email.')).toBeVisible();

    await dialog(page).getByLabel('Work email').fill('priya@brainwired.demo');
    await button(page, 'Send invite').click();
    await expect(dialog(page).getByText('This email already has an account.')).toBeVisible();

    await dialog(page).getByLabel('Work email').fill('meera@brainwired.demo');
    await dialog(page).getByLabel('Role').selectOption('viewer');
    await button(page, 'Send invite').click();
    await expect(toast(page, 'Invite sent to meera@brainwired.demo')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);

    const meera = staffRow(page, 'Meera Iyer');
    await expect(meera).toContainText('Invite sent');
    await expect(roleSelect(page, 'Meera Iyer')).toHaveValue('viewer');
    await expect(page.getByText('4 active · 2 invites waiting')).toBeVisible();
    const logged = logRows(page).first();
    await expect(logged).toContainText('Invited');
    await expect(logged).toContainText('Staff · Meera Iyer');
    await expect(logged).toContainText('Role: — → Viewer');
    await expect(logged).toContainText('Invite email sent to meera@brainwired.demo');

    await page.reload();
    await expect(staffRow(page, 'Meera Iyer')).toContainText('Invite sent');
  });

  test('changes a role, and a super admin cannot demote themselves', async ({ page }) => {
    await open(page);
    await roleSelect(page, 'Priya Sharma').selectOption('viewer');
    await expect(toast(page, 'Priya Sharma is now Viewer · saved to the log')).toBeVisible();
    await expect(roleSelect(page, 'Priya Sharma')).toHaveValue('viewer');
    const logged = logRows(page).first();
    await expect(logged).toContainText('Role changed');
    await expect(logged).toContainText('Staff · Priya Sharma');
    await expect(logged).toContainText('Role: Support → Viewer');

    await roleSelect(page, 'Anjali Menon').selectOption('support');
    await expect(
      toast(page, 'You can’t change your own role. Ask another super admin.'),
    ).toBeVisible();
    await expect(roleSelect(page, 'Anjali Menon')).toHaveValue('super_admin');

    await page.reload();
    await expect(roleSelect(page, 'Priya Sharma')).toHaveValue('viewer');
  });

  test('removes staff and cancels an invite, but never yourself', async ({ page }) => {
    await open(page);
    await staffRow(page, 'Anjali Menon').getByRole('button', { name: 'You' }).click();
    await expect(toast(page, 'You can’t remove yourself. Ask another super admin.')).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);

    await staffRow(page, 'Rahul Deshmukh').getByRole('button', { name: 'Remove' }).click();
    await expect(
      dialog(page).getByRole('heading', { name: 'Remove Rahul Deshmukh?' }),
    ).toBeVisible();
    await expect(
      dialog(page).getByText('Their past changes stay in the activity log.', { exact: false }),
    ).toBeVisible();
    await button(page, 'Keep').click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(staffRows(page)).toHaveCount(5);

    await staffRow(page, 'Rahul Deshmukh').getByRole('button', { name: 'Remove' }).click();
    await dialog(page).getByRole('button', { name: 'Remove' }).click();
    await expect(toast(page, 'Rahul Deshmukh removed · saved to the log')).toBeVisible();
    await expect(staffRow(page, 'Rahul Deshmukh')).toHaveCount(0);
    const removed = logRows(page).first();
    await expect(removed).toContainText('Removed');
    await expect(removed).toContainText('Access: Support → Removed');
    await expect(removed).toContainText('Signed out and removed');
    // Their past changes stay, under their name.
    await expect(logRows(page).filter({ hasText: 'Rahul Deshmukh' }).nth(1)).toBeVisible();

    await staffRow(page, 'Vikram Nair').getByRole('button', { name: 'Cancel invite' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Cancel invite?' })).toBeVisible();
    await dialog(page).getByRole('button', { name: 'Cancel invite' }).click();
    await expect(toast(page, 'Invite cancelled')).toBeVisible();
    await expect(staffRow(page, 'Vikram Nair')).toHaveCount(0);
    await expect(logRows(page).first()).toContainText('Invite cancelled');
    await expect(page.getByText('3 active · 0 invites waiting')).toBeVisible();

    await page.reload();
    await expect(staffRows(page)).toHaveCount(3);
  });

  test('filters by staff, action and period, and clears them', async ({ page }) => {
    await open(page);
    const [, week] = await counts(page);

    await filter(page, 'Action').selectOption('deleted');
    await expect(page).toHaveURL(/action=deleted/);
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    const deleted = logRows(page);
    await expect(deleted.first()).toContainText('Deleted');
    for (const row of await deleted.all()) await expect(row).toContainText('Deleted');
    for (const row of await deleted.all()) await expect(row).toContainText('→ Removed');

    await filter(page, 'Action').selectOption('');
    await filter(page, 'Staff').selectOption({ label: 'Priya Sharma' });
    await expect(page).toHaveURL(new RegExp(`who=${FEATURED.staff.priya}`));
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    for (const row of await logRows(page).all()) await expect(row).toContainText('Priya Sharma');

    await filter(page, 'Staff').selectOption('');
    await filter(page, 'Period').selectOption('30');
    await expect(page).toHaveURL(/period=30/);
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(countLine(page)).not.toContainText('this week');
    const [, month] = await counts(page);
    expect(month).toBeGreaterThan(week);

    // Fatima is a viewer and has changed nothing.
    await filter(page, 'Staff').selectOption({ label: 'Fatima Shaikh' });
    await expect(page.getByText('No changes match these filters')).toBeVisible();
    await expect(page.getByText('Try another staff member, action or period.')).toBeVisible();
    await button(page, 'Clear filters').click();
    await expect(page).not.toHaveURL(/who=|period=|action=/);
    await expect(logRows(page).first()).toBeVisible();
    await expect(filter(page, 'Period')).toHaveValue('');
  });

  test('loads more 50 at a time', async ({ page }) => {
    // A herd schedule writes one log row per animal, so the log passes 50 rows.
    await signIn(page);
    await page.goto(`/health?farm=${FEATURED.farms.shreeGanesh}`);
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await button(page, 'Vaccine schedule').click();
    await page.getByLabel('Vaccine', { exact: true }).fill('Test booster');
    await button(page, 'Create 41 reminders').click();
    await expect(toast(page, '41 reminders created')).toBeVisible();

    await page.goto('/staff');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(logRows(page)).toHaveCount(50);
    const [shown, total] = await counts(page);
    expect(shown).toBe(50);
    expect(total).toBeGreaterThan(50);
    await expect(logRows(page).first()).toContainText('Added');
    await expect(logRows(page).first()).toContainText('Test booster vaccine');

    await button(page, 'Load more').click();
    await expect(logRows(page)).toHaveCount(total);
    await expect(countLine(page)).toContainText(`Showing ${total} of ${total}`);
    await expect(button(page, 'Load more')).toHaveCount(0);

    await filter(page, 'Action').selectOption('added');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(countLine(page)).toContainText('Showing 41 of 41');
  });

  test('shows a milk fix with its reason', async ({ page }) => {
    await signIn(page);
    await page.goto(`/milk-feed?farm=${FEATURED.farms.yadav}`);
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    const wrong = page.getByRole('table').locator('tbody tr').filter({ hasText: '75.0' });
    await wrong.getByRole('button', { name: 'Edit entry' }).click();
    await dialog(page).getByLabel('Litres').fill('7.5');
    await dialog(page).getByLabel('Reason for the fix').fill('Farmer confirmed on a call');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.goto('/staff');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    const fixed = logRows(page).first();
    await expect(fixed).toContainText('Edited');
    await expect(fixed).toContainText('Milk entry · 04 Shyama, evening');
    await expect(fixed).toContainText('Yadav Dairy');
    await expect(fixed).toContainText('Litres: 75.0 → 7.5');
    await expect(fixed).toContainText('Farmer confirmed on a call');
  });

  test('exports the filtered log as CSV', async ({ page }) => {
    await open(page, undefined, '?action=deleted&period=all');
    const [, total] = await counts(page);
    const download = page.waitForEvent('download');
    await button(page, 'Export CSV').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('activity-log.csv');
    const text = await readFile((await file.path()) as string, 'utf8');
    const lines = text.trim().split(/\r\n/);
    expect(lines[0]).toContain('When,Staff,Action,Record,Farm,Change,Note');
    expect(lines).toHaveLength(total + 1);
    expect(lines[1]).toContain('Deleted');
    await expect(toast(page, `activity-log.csv downloaded · ${total} rows`)).toBeVisible();
  });

  for (const [role, email] of [
    ['support', SUPPORT],
    ['viewer', VIEWER],
  ] as const) {
    test(`${role} sees the list and the log, without the controls`, async ({ page }) => {
      await open(page, email);
      await expect(staffRows(page)).toHaveCount(5);
      await expect(staffRow(page, 'Priya Sharma')).toContainText('Support');
      await expect(button(page, 'Invite staff')).toHaveCount(0);
      await expect(page.getByRole('combobox', { name: /^Role for/ })).toHaveCount(0);
      await expect(staffRows(page).getByRole('button')).toHaveCount(0);
      await expect(logRows(page).first()).toBeVisible();
      await expect(button(page, 'Export CSV')).toBeVisible();
      await expect(filter(page, 'Action')).toBeVisible();
    });
  }
});
