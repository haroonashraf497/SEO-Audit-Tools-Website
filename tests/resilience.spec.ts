import { test, expect } from '@playwright/test';

/**
 * Regression coverage for the infinite loading spinner.
 *
 * Route chunks are separate network requests, so they can fail (a redeploy
 * replaced the hashed file, the connection dropped) or stall. Both used to leave
 * the visitor on "Loading page…" forever. These tests drive the real built
 * site with a real broken network.
 *
 * Deliberately separate from site.spec.ts: that file fails the run on any
 * pageerror, and a chunk that fails to load legitimately reports one.
 */

test('a route chunk that cannot be fetched shows a recovery panel, and Try again recovers', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/assets/Tools-*.js', route => route.abort('failed'));

  await page.goto('/');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.locator('a[href="/free-tools?cat=calculator"]').first().click();

  // Three import attempts happen first, so the panel is not instantaneous.
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('alert')).toContainText('Something went wrong on this page');
  await expect(page.locator('main')).not.toContainText('Loading page…');

  // Restore the network: the retry must re-issue the request and render the
  // route, proving React's cached rejection is not replayed.
  await page.unroute('**/assets/Tools-*.js');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('h1')).toContainText('Tools', { timeout: 30_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a route chunk that never arrives times out instead of spinning forever', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/assets/Blog-*.js', () => new Promise(() => {})); // never responds

  await page.goto('/');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.locator('a[href="/blog"]').first().click();

  await expect(page.locator('main')).toContainText('Loading page…');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('alert')).toContainText('This page is taking too long to load');
  await expect(page.getByRole('button', { name: 'Reload page', exact: true })).toBeVisible();
});

test('the audit button always comes back, even when every lookup stalls', async ({ page }) => {
  test.setTimeout(90_000);
  // No lookup can succeed, so the run must fall back to its own data and
  // release the button instead of leaving "Analyzing…" on screen.
  await page.route('**://*/*', route => (
    route.request().url().includes('/assets/') || new URL(route.request().url()).host === 'localhost'
      ? route.continue()
      : route.abort('failed')
  ));

  await page.goto('/');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.getByLabel('Website URL').fill('https://example.com');
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();

  const results = page.locator('#results');
  await expect(results).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Analyze', exact: true })).toBeEnabled();
  await expect(page.locator('main')).not.toContainText('Analyzing...');
});
