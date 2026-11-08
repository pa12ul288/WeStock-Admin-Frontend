import { expect, test } from '@playwright/test';
import { FEATURED } from '../src/data/demo/featured';
import { signIn } from './helpers';

const accounts = [
  { email: 'anjali@brainwired.demo', name: 'Anjali Menon', role: 'Super admin' },
  { email: 'priya@brainwired.demo', name: 'Priya Sharma', role: 'Support' },
  { email: 'rahul@brainwired.demo', name: 'Rahul Deshmukh', role: 'Support' },
  { email: 'fatima@brainwired.demo', name: 'Fatima Shaikh', role: 'Viewer' },
  { email: 'vikram@brainwired.demo', name: 'Vikram Nair', role: 'Support' },
];

test.describe('sign in', () => {
  for (const account of accounts) {
    test(`works for ${account.email}`, async ({ page }) => {
      await signIn(page, account.email);
      await expect(page).toHaveURL('/');
      await expect(
        page.getByRole('heading', { level: 1, name: /, here is every farm$/ }),
      ).toBeVisible();
      const nav = page.getByRole('navigation', { name: 'Admin navigation' });
      await expect(
        nav.getByRole('button', { name: `${account.name}, ${account.role}. Account menu` }).first(),
      ).toBeAttached();
    });
  }

  test('a wrong password shows one message and stays on the page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('anjali@brainwired.demo');
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Email or password is wrong');
    await expect(page).toHaveURL('/login');

    await page.getByLabel('Password', { exact: true }).fill('longer-password');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('an unknown email gets the same message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('someone@brainwired.demo');
    await page.getByLabel('Password', { exact: true }).fill('longer-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Email or password is wrong');
  });

  test('explains empty and mistyped fields', async ({ page }) => {
    await page.goto('/login');
    const submit = page.getByRole('button', { name: 'Sign in' });
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('Enter your work email.');
    await page.getByLabel('Work email').fill('anjali');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText(
      'That email doesn’t look right. Check for a typo.',
    );
    await page.getByLabel('Work email').fill('anjali@brainwired.demo');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('Enter your password.');
  });

  test('shows and hides the password', async ({ page }) => {
    await page.goto('/login');
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('the demo accounts helper fills in the email', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Work email')).toHaveValue('');
    await page.getByText('Demo accounts').click();
    await page.getByRole('button', { name: 'priya@brainwired.demo' }).click();
    await expect(page.getByLabel('Work email')).toHaveValue('priya@brainwired.demo');
  });

  test('sends you back to the page you asked for', async ({ page }) => {
    await page.goto('/health');
    await expect(page).toHaveURL('/login');
    await page.getByLabel('Work email').fill('anjali@brainwired.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/health');
  });

  test('without the tick, signing in ends when the browser closes', async ({ page, context }) => {
    await signIn(page);
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: /, here is every farm$/ }),
    ).toBeVisible();
    await context.clearCookies(); // what closing the browser does to a session cookie
    await page.reload();
    await expect(page).toHaveURL('/login');
  });

  test('with the tick, signing in outlasts the browser', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('anjali@brainwired.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo-password');
    await page.getByLabel('Keep me signed in on this computer').check();
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: /, here is every farm$/ }),
    ).toBeVisible();
    await context.clearCookies();
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: /, here is every farm$/ }),
    ).toBeVisible();
  });
});

test.describe('forgot password', () => {
  test('goes from the form to "check your email"', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset your password' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Send reset link' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Enter the work email you sign in with.');

    await dialog.getByLabel('Work email').fill('anjali@brainwired.demo');
    await dialog.getByRole('button', { name: 'Send reset link' }).click();

    const sent = page.getByRole('dialog', { name: 'Check your email' });
    await expect(sent).toContainText('anjali@brainwired.demo');
    await expect(sent).toContainText('It works for 30 minutes.');
    await sent.getByRole('button', { name: 'Done' }).click();
    await expect(sent).toHaveCount(0);
  });

  test('carries over the email and closes on Escape', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('priya@brainwired.demo');
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset your password' });
    await expect(dialog.getByLabel('Work email')).toHaveValue('priya@brainwired.demo');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeFocused();
  });
});

test.describe('sign out and the gate', () => {
  test('signed-out visitors are sent to sign in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('sign out returns to sign in and locks the app', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
    await page.goto('/livestock');
    await expect(page).toHaveURL('/login');
  });

  test('signing in again after sign out starts at the dashboard', async ({ page }) => {
    await signIn(page);
    await page.goto('/health');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
    await page.getByLabel('Work email').fill('priya@brainwired.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('user menu', () => {
  test('shows the Demo badge, and switching role updates the UI straight away', async ({
    page,
  }) => {
    await signIn(page);
    const nav = page.getByRole('navigation', { name: 'Admin navigation' });
    await nav
      .getByRole('button', { name: /Account menu/ })
      .last()
      .click();

    const menu = page.getByRole('dialog', { name: 'Account menu' });
    await expect(menu).toContainText('Anjali Menon');
    await expect(menu.getByText('Demo', { exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Super admin' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await menu.getByRole('button', { name: 'Viewer' }).click();
    await expect(menu.getByRole('button', { name: 'Viewer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(nav.getByText('Viewer', { exact: true }).first()).toBeVisible();
    // The toast means the adapter has saved it, so it survives the reload.
    await expect(page.getByText('You are now using the Viewer role.')).toBeVisible();

    await page.reload();
    await expect(
      nav.getByRole('button', { name: 'Anjali Menon, Viewer. Account menu' }).first(),
    ).toBeAttached();
  });

  test('reset demo data keeps you signed in and goes back to your own role', async ({ page }) => {
    await signIn(page);
    const nav = page.getByRole('navigation', { name: 'Admin navigation' });
    const trigger = nav.getByRole('button', { name: /Account menu/ }).last();
    await trigger.click();
    await page.getByRole('button', { name: 'Support' }).click();
    await expect(
      nav.getByRole('button', { name: 'Anjali Menon, Support. Account menu' }).first(),
    ).toBeAttached();

    await page.getByRole('button', { name: 'Reset demo data' }).click();
    await expect(page.getByText('Demo data reset.')).toBeVisible();
    await expect(page).toHaveURL('/');
    await expect(
      nav.getByRole('button', { name: 'Anjali Menon, Super admin. Account menu' }).first(),
    ).toBeAttached();
  });

  test('closes on Escape', async ({ page }) => {
    await signIn(page);
    const nav = page.getByRole('navigation', { name: 'Admin navigation' });
    const trigger = nav.getByRole('button', { name: /Account menu/ }).last();
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Account menu' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test.describe('top bar', () => {
  test('shows breadcrumb and today in India', async ({ page }) => {
    await signIn(page);
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb).toContainText('Overview');
    await expect(breadcrumb).toContainText('Dashboard');
    await expect(
      page.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} \w{3} \d{4}$/),
    ).toBeVisible();
  });

  test('search: Enter opens the first hit, even while still typing', async ({ page }) => {
    await signIn(page);
    await page.getByRole('combobox').fill('Shree Ganesh');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`/farms/${FEATURED.farms.shreeGanesh}`);
    await expect(page.getByRole('link', { name: /^Farmers & farms/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('search: arrow keys choose a hit', async ({ page }) => {
    await signIn(page);
    const box = page.getByRole('combobox');
    await box.fill('Ramesh');
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    await box.press('ArrowDown');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await box.press('Escape');
    await expect(options).toHaveCount(0);
  });

  test('search: says when nothing matches', async ({ page }) => {
    await signIn(page);
    await page.getByRole('combobox').fill('zzzz');
    await expect(page.getByText('No farm, farmer or tag matches “zzzz”.')).toBeVisible();
  });

  test('alerts: counts link to their screens, and can be marked read', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /^Alerts, \d+ new$/ }).click();
    const alerts = page.getByRole('dialog', { name: 'Alerts' });
    for (const title of [
      'Golden periods ending soon',
      'Vaccines overdue',
      'Animals marked sick',
      'May deliver this week',
      'Farms not logging milk',
    ]) {
      await expect(alerts.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    }

    await alerts.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.getByRole('button', { name: 'Alerts', exact: true })).toBeVisible();

    await alerts.getByRole('link', { name: /Vaccines overdue/ }).click();
    await expect(page).toHaveURL('/health');
    await expect(alerts).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alerts', exact: true })).toBeVisible();
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('strip, no breadcrumb or date, and the account menu signs out', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText('Overview', { exact: true }).first()).toBeHidden();
    await expect(page.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2}/)).toBeHidden();
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    const nav = page.getByRole('navigation', { name: 'Admin navigation' });
    await nav
      .getByRole('button', { name: /Account menu/ })
      .first()
      .click();
    const menu = page.getByRole('dialog', { name: 'Account menu' });
    await menu.getByRole('button', { name: 'Support' }).click();
    await expect(menu.getByRole('button', { name: 'Support' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await menu.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('the strip scrolls to the current screen', async ({ page }) => {
    await signIn(page);
    await page.goto('/staff');
    await expect(page.getByRole('link', { name: 'Staff & activity log' })).toBeInViewport();
  });
});
