import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// The suite runs with reduced motion (see playwright.config.ts). These specs check both modes.

test.describe('reduced motion', () => {
  test('counters show their final values at once and nothing is left hidden', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText('Anjali, here is every farm')).toBeVisible();
    const card = page.getByRole('link', { name: /Active animals/i });
    await expect(card).toBeVisible();
    // The exact formatted text is there straight away, and the card carries no leftover inline style.
    await expect(card.getByText(/^\d[\d,]*$/).first()).toBeVisible();
    const style = await card.evaluate((element) => element.getAttribute('style'));
    expect(style ?? '').not.toContain('opacity');
    expect(style ?? '').not.toContain('clip-path');
  });

  test('the sidebar toggle is a button with aria-expanded and remembers its state', async ({
    page,
  }) => {
    await signIn(page);
    const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await collapse.focus();
    await page.keyboard.press('Enter');

    const expand = page.getByRole('button', { name: 'Expand sidebar' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    // Icon-only items keep their names.
    await expect(
      page.getByRole('navigation', { name: 'Admin navigation' }).getByRole('link', {
        name: /Livestock/,
      }),
    ).toBeVisible();
    const width = await page
      .locator('aside')
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeLessThan(100);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const wide = await page
      .locator('aside')
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(wide).toBeGreaterThan(200);
  });

  test('a route change moves focus to the new page heading', async ({ page }) => {
    await signIn(page);
    await page
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name: /Livestock/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Livestock' })).toBeFocused();
  });
});

test.describe('with motion on', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('counters end on the exact value, the sidebar morphs and settles, dialogs still close', async ({
    page,
  }) => {
    await signIn(page);
    const card = page.getByRole('link', { name: /Active animals/i });
    // The real text is always in the page for assistive tech; wait for the count to finish.
    await expect(card.locator('[aria-hidden="true"]').filter({ hasText: /\d/ })).toHaveCount(0, {
      timeout: 6000,
    });
    await expect(card.getByText(/^\d[\d,]*$/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect
      .poll(() =>
        page.locator('aside').evaluate((element) => element.getBoundingClientRect().width),
      )
      .toBeLessThan(100);
    await expect(page.locator('aside')).not.toHaveAttribute('style', /opacity/);

    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect
      .poll(() =>
        page.locator('aside').evaluate((element) => element.getBoundingClientRect().width),
      )
      .toBeGreaterThan(200);

    // A dialog closes on Escape and leaves nothing behind that assistive tech can reach.
    await page.goto('/staff');
    await page
      .getByRole('button', { name: /Invite staff/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
