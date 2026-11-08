import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

const dialog = (page: Page) => page.getByRole('dialog');

async function reset(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Admin navigation' });
  await nav
    .getByRole('button', { name: /Account menu/ })
    .last()
    .click();
  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await expect(page.getByText('Demo data reset.')).toBeVisible();
}

test.describe('an edit, a reload and a reset', () => {
  test('staff: an invite survives a reload and a reset removes it', async ({ page }) => {
    await signIn(page);
    await page.goto('/staff');
    await page.getByRole('button', { name: /^Invite staff/ }).click();
    await dialog(page).getByLabel('Full name').fill('Reset Check');
    await dialog(page).getByLabel('Work email').fill('reset.check@brainwired.demo');
    await dialog(page).getByRole('button', { name: 'Send invite' }).click();
    await expect(page.getByText('Reset Check').first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('Reset Check').first()).toBeVisible();
    await reset(page);
    await page.goto('/staff');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(page.getByText('Reset Check')).toHaveCount(0);
  });

  test('milk and feed: a fix survives a reload and a reset brings the old entry back', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto('/milk-feed');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    const first = page.getByRole('table').locator('tbody tr').first();
    await first.getByRole('button', { name: 'Edit entry' }).click();
    const litres = dialog(page).getByLabel('Litres');
    const old = Number(await litres.inputValue());
    await litres.fill(String(old + 1));
    await dialog(page).getByLabel('Reason for the fix').fill('Reset check');
    await dialog(page).getByRole('button', { name: 'Save fix' }).click();
    await expect(dialog(page)).toHaveCount(0);
    const edited = page
      .getByRole('table')
      .locator('tbody tr')
      .filter({ hasText: 'Fixed by staff' });
    await expect(edited.first()).toBeVisible();
    await page.reload();
    await expect(edited.first()).toBeVisible();
    await reset(page);
    await page.goto('/milk-feed');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(page.getByText('Fixed by staff')).toHaveCount(0);
  });

  test('health: marking a vaccine given survives a reload and a reset', async ({ page }) => {
    await signIn(page);
    await page.goto('/health');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    const given = () => page.getByText('Given today').count();
    expect(await given()).toBe(0);
    await page.getByRole('button', { name: 'Mark given' }).first().click();
    await expect.poll(given).toBe(1);
    await page.reload();
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect.poll(given).toBe(1);
    await reset(page);
    await page.goto('/health');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark given' }).first()).toBeVisible();
    expect(await given()).toBe(0);
  });
});
