import { expect, type Page } from '@playwright/test';

/** Signs in through the real form and waits for the shell. Any password of 6+ characters works. */
export async function signIn(page: Page, email = 'anjali@brainwired.demo'): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('demo-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
}
