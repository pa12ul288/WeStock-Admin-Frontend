import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const SUPPORT = 'priya@brainwired.demo';
const VIEWER = 'fatima@brainwired.demo';

const period = (page: Page) => page.getByRole('region', { name: /^Last \d+ days$/ });
const attention = (page: Page) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Needs attention today' }) });
const farmsTable = (page: Page) => page.getByRole('table', { name: 'Farms needing attention' });

async function open(page: Page, email?: string, query = '') {
  await signIn(page, email);
  await page.goto(`/${query}`);
  await expect(page.getByRole('heading', { level: 1, name: /here is every farm$/ })).toBeVisible();
  await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
}

const number = (text: string | null) => Number((text ?? '').replace(/[^\d.]/g, ''));

test.describe('dashboard', () => {
  test('shows the totals, sections and prototype wording', async ({ page }) => {
    await open(page);
    await expect(page.getByText(/^Good (morning|afternoon|evening)$/)).toBeVisible();
    await expect(
      page.getByText('Today at a glance, and how the last 30 days have gone across WeSTOCK.'),
    ).toBeVisible();
    for (const label of ['Farmers', 'Farms', 'Active animals', 'Milk yesterday']) {
      await expect(
        page
          .getByRole('main')
          .getByRole('link', { name: new RegExp(`^${label}`) })
          .first(),
      ).toBeVisible();
    }
    await expect(page.getByText('Registered in the app')).toBeVisible();
    await expect(page.getByText(/run a Blackbox and collars$/)).toBeVisible();
    await expect(page.getByText('Milk collected per day · all farms')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Herd by species' })).toBeVisible();
    await expect(page.getByText('Sheep, pig, horse & other')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Farmers by app language' })).toBeVisible();
    await expect(page.getByText('हिन्दी')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent staff changes' })).toBeVisible();

    // The totals open their lists.
    await page
      .getByRole('main')
      .getByRole('link', { name: /^Active animals/ })
      .click();
    await expect(page).toHaveURL('/livestock');
    await page.goBack();
    await page
      .getByRole('main')
      .getByRole('link', { name: /^Farms\s*[\d,]/ })
      .click();
    await expect(page).toHaveURL('/farmers?view=farms');
  });

  test('switches the period for milk, feed and vaccines', async ({ page }) => {
    await open(page);
    await expect(period(page).getByText('Last 30 days')).toBeVisible();
    const milkValue = () =>
      period(page)
        .getByText(/^[\d,]+ L$/)
        .first();
    const milk30 = number(await milkValue().textContent());
    await period(page).getByRole('button', { name: '7 days' }).click();
    await expect(page).toHaveURL('/?days=7');
    await expect(period(page).getByText('Last 7 days')).toBeVisible();
    await expect(period(page).getByRole('button', { name: '7 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByText('Today at a glance, and how the last 7 days have gone across WeSTOCK.'),
    ).toBeVisible();
    await expect.poll(async () => number(await milkValue().textContent())).toBeLessThan(milk30);
    for (const label of ['Milk collected', 'Feed logged', 'Vaccines given']) {
      await expect(period(page).getByText(label)).toBeVisible();
    }
    await expect(period(page).getByText(/still overdue across all farms$/)).toBeVisible();

    await period(page).getByRole('button', { name: '90 days' }).click();
    await expect(page).toHaveURL('/?days=90');
    await expect(period(page).getByText('Last 90 days')).toBeVisible();
    await page.reload();
    await expect(period(page).getByRole('button', { name: '90 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  const links = [
    { title: 'Golden periods ending soon', url: '/reproduction', heading: 'Reproduction' },
    { title: 'Vaccines overdue', url: '/health', heading: 'Health & vaccines' },
    { title: 'Animals marked sick', url: '/health?tab=issues', heading: 'Health & vaccines' },
    {
      title: 'May deliver this week',
      url: '/reproduction?stage=pregnant',
      heading: 'Reproduction',
    },
    { title: 'Farms not logging milk', url: '/farmers?view=farms', heading: 'Farmers & farms' },
  ];
  for (const link of links) {
    test(`"${link.title}" opens the filtered screen`, async ({ page }) => {
      await open(page);
      const row = attention(page).getByRole('link', { name: new RegExp(`^${link.title}`) });
      await expect(row).toContainText(/\d/);
      await row.click();
      await expect(page).toHaveURL(link.url);
      await expect(page.getByRole('heading', { level: 1, name: link.heading })).toBeVisible();
      if (link.url.endsWith('stage=pregnant')) {
        await expect(page.getByRole('button', { name: /^Pregnant & due/ })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }
      if (link.url.endsWith('tab=issues')) {
        await expect(page.getByRole('button', { name: /^Health issues/ })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }
    });
  }

  test('filters the farms needing attention and opens a farm', async ({ page }) => {
    await open(page);
    const rows = farmsTable(page).locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThanOrEqual(5);

    for (const [name, pill] of [
      ['Health', /Vaccines overdue|Animals sick/],
      ['Milk', /No milk/],
    ] as const) {
      await page.getByRole('group', { name: 'Issue' }).getByRole('button', { name }).click();
      await expect(page).toHaveURL(`/?issue=${name.toLowerCase()}`);
      const count = await rows.count();
      for (let index = 0; index < count; index++) {
        await expect(rows.nth(index)).toContainText(pill);
      }
    }

    await page
      .getByRole('group', { name: 'Issue' })
      .getByRole('button', { name: 'Breeding' })
      .click();
    await expect(rows.first().or(page.getByText('Nothing matches these filters'))).toBeVisible();
    await page
      .getByRole('group', { name: 'Issue' })
      .getByRole('button', { name: 'All issues' })
      .click();
    await expect(page).toHaveURL('/');

    const name = (await rows.first().locator('b').first().textContent()) ?? '';
    await farmsTable(page)
      .getByRole('link', { name: `Open ${name}` })
      .first()
      .click();
    await expect(page).toHaveURL(/\/farms\//);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });

  test('a super admin invites staff from the dashboard', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Invite staff', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Invite staff' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        'They get an email to set a password. Only brainwired emails can be invited.',
      ),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Send invite' }).click();
    await expect(dialog.getByText('Add a name and a valid work email.')).toBeVisible();
    await dialog.getByLabel('Full name').fill('Meera Iyer');
    await dialog.getByLabel('Work email').fill('meera@brainwired.demo');
    await dialog.getByLabel('Role').selectOption({ label: 'Viewer' });
    await dialog.getByRole('button', { name: 'Send invite' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('status').filter({ hasText: 'Invite sent to meera@brainwired.demo' }),
    ).toBeVisible();

    // The invite shows in recent changes and on the staff screen, and survives a reload.
    await page.reload();
    await expect(page.getByText(/invited Meera Iyer/)).toBeVisible();
    await page.getByRole('link', { name: /^Activity log/ }).click();
    await expect(page).toHaveURL('/staff');
    await expect(
      page
        .getByRole('table', { name: 'brainwired staff' })
        .locator('tbody tr')
        .filter({ hasText: 'Meera Iyer' }),
    ).toContainText('Invite sent');
  });

  for (const email of [SUPPORT, VIEWER]) {
    test(`${email} sees everything but Invite staff`, async ({ page }) => {
      await open(page, email);
      await expect(page.getByRole('button', { name: 'Invite staff' })).toHaveCount(0);
      await expect(
        page.getByRole('link', { name: 'Analytics', exact: true }).first(),
      ).toBeVisible();
      await expect(attention(page).getByRole('link')).toHaveCount(5);
      await expect(farmsTable(page)).toBeVisible();
    });
  }
});
