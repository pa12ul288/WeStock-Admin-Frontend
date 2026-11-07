import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const PATH = '/dev/components';

async function open(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await signIn(page);
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1, name: 'Components' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const pageScrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

for (const [width, height] of [
  [1440, 900],
  [390, 844],
] as const) {
  test(`gallery has no sideways scroll at ${width}`, async ({ page }) => {
    await open(page, width, height);
    await expect(page.locator('.recharts-surface').first()).toBeVisible();
    await page.screenshot({ path: `.shots/gallery-${width}.png`, fullPage: true });
    expect(await pageScrollWidth(page)).toBeLessThanOrEqual(width);
  });

  test(`dialogs and toast look right at ${width}`, async ({ page }) => {
    await open(page, width, height);
    await page.getByRole('button', { name: 'Delete farm' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `.shots/gallery-confirm-${width}.png` });
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Invite staff' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `.shots/gallery-modal-${width}.png` });
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page.getByText('Invite sent to Meera Iyer')).toBeVisible();
    await page.screenshot({ path: `.shots/gallery-toast-${width}.png` });
  });
}

test('the table header stays in view as the page scrolls', async ({ page }) => {
  await open(page, 1440, 900);
  const table = page.getByRole('table', { name: 'Live sample' });
  const header = table.locator('thead');
  await table.locator('tbody tr').nth(12).scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    const box = document.querySelector('table[aria-label="Live sample"]')?.getBoundingClientRect();
    window.scrollBy(0, (box?.top ?? 0) + 300);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect.poll(async () => Math.round((await header.boundingBox())?.y ?? -1)).toBe(0);
  await page.screenshot({ path: '.shots/gallery-sticky-1440.png' });
});

test('on a phone the table scrolls inside its card and hides phone-hidden columns', async ({
  page,
}) => {
  await open(page, 390, 844);
  const table = page.getByRole('table', { name: 'Live sample' });
  await expect(table.getByRole('columnheader', { name: 'Amount' })).toBeHidden();
  const scroller = table.locator('xpath=..');
  const sizes = await scroller.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  await scroller.evaluate((element) => element.scrollBy(120, 0));
  expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await pageScrollWidth(page)).toBeLessThanOrEqual(390);
});

test('modal opens near the button on desktop and traps focus', async ({ page }) => {
  await open(page, 1440, 900);
  const button = page.getByRole('button', { name: 'Remove member' });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const buttonBox = await button.boundingBox();
  const dialog = page.getByRole('dialog');
  const box = await dialog.boundingBox();
  expect(box?.width).toBe(540);
  const wanted = Math.max(16, (buttonBox?.y ?? 0) + (buttonBox?.height ?? 0) / 2 - 170);
  expect(Math.abs((box?.y ?? 0) - wanted)).toBeLessThanOrEqual(2);

  // Cancel has focus because this one is destructive with nothing to type.
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]')),
    );
    expect(inside).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('a tall modal stays on the screen', async ({ page }) => {
  await open(page, 1440, 900);
  const button = page.getByRole('button', { name: 'Tall dialog' });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(16);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(900 - 16);
});

test('modal is full width with a 16 px margin on a phone', async ({ page }) => {
  await open(page, 390, 844);
  await page.getByRole('button', { name: 'Remove member' }).click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box).toMatchObject({ x: 16, y: 16, width: 358 });
});

test('type to confirm holds the delete back until the name is right', async ({ page }) => {
  await open(page, 1440, 900);
  await page.getByRole('button', { name: 'Delete farm' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete farm' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'Type “Shree Ganesh Dairy” exactly to confirm.',
  );
  await dialog.getByLabel('Type the farm name to confirm').fill('Shree Ganesh Dairy');
  await dialog.getByRole('button', { name: 'Delete farm' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Shree Ganesh Dairy deleted')).toBeVisible();
});

test('filters, sorting and pages live in the URL and survive a reload', async ({ page }) => {
  await open(page, 1440, 900);
  const table = page.getByRole('table', { name: 'Live sample' });
  await expect(page.getByText('Showing 1–20 of 66', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Page 2' }).first().click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText('Showing 21–40 of 66', { exact: true }).first()).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search tag or name' }).fill('Gauri');
  await expect(page).toHaveURL(/q=Gauri/);
  await expect(page).not.toHaveURL(/page=/);

  await page
    .getByRole('combobox', { name: 'Farm', exact: true })
    .selectOption('Shree Ganesh Dairy');
  await expect(page).toHaveURL(/farm=Shree/);

  await table.getByRole('button', { name: 'Last entry' }).click();
  await expect(page).toHaveURL(/sort=last_entry-asc/);
  await expect(table.getByRole('columnheader', { name: 'Last entry' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );

  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search tag or name' })).toHaveValue('Gauri');
  await expect(page.getByRole('combobox', { name: 'Farm', exact: true })).toHaveValue(
    'Shree Ganesh Dairy',
  );
});

test('the empty state clears the filters', async ({ page }) => {
  await open(page, 1440, 900);
  await page.getByRole('searchbox', { name: 'Search tag or name' }).fill('no such animal');
  const table = page.getByRole('table', { name: 'Live sample' });
  await expect(table.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByText('No animals match these filters')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page.getByRole('searchbox', { name: 'Search tag or name' })).toHaveValue('');
  await expect(table.locator('tbody tr')).toHaveCount(20);
});

test('a chart shows the exact value in its tooltip', async ({ page }) => {
  await open(page, 1440, 900);
  const chart = page.getByRole('figure', { name: 'Milk per day for 7 days' });
  await chart.scrollIntoViewIfNeeded();
  const bar = chart.locator('.recharts-bar-rectangle').nth(5);
  await bar.hover();
  await expect(
    chart.getByText('03 Nov · 340.0 L').or(chart.getByText('03 Nov · 340 L')),
  ).toBeVisible();
});

test('segmented options use aria-pressed', async ({ page }) => {
  await open(page, 1440, 900);
  const group = page.getByRole('group', { name: 'Period' });
  await group.getByRole('button', { name: '30 days' }).click();
  await expect(group.getByRole('button', { name: '30 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(group.getByRole('button', { name: '7 days' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
