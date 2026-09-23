import { test, expect } from '@playwright/test';

/**
 * Regression coverage for the loading states: the infinite spinner, and the
 * blank document that preceded it.
 *
 * Route chunks are separate network requests, so they can fail (a redeploy
 * replaced the hashed file, the connection dropped) or stall. Both used to leave
 * the visitor on "Loading page…" forever. These tests drive the real built
 * site with a real broken network, including the case where the application
 * bundle itself never arrives — the static header shell in index.html has to
 * carry that visit.
 *
 * Deliberately separate from site.spec.ts: that file fails the run on any
 * pageerror, and a chunk that fails to load legitimately reports one.
 */

test('a route chunk that cannot be fetched shows a recovery panel, and Try again recovers', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/assets/Tools-*.js', route => route.abort('failed'));

  await page.goto('/');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.locator('a[href="/tools?cat=calculator"]').first().click();

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

/**
 * The static boot shell in index.html: the header, brand and navigation are
 * painted by the browser before any JavaScript runs, so a deep link or a
 * repeat visit never starts as a blank document.
 */

test('header, brand and navigation paint before any JavaScript runs', async ({ page }) => {
  // Every script stalls: the only thing that can possibly render is the shell.
  await page.route('**/assets/*.js', () => new Promise(() => {}));
  await page.goto('/about', { waitUntil: 'commit' });

  const shell = page.locator('#boot-shell');
  await expect(shell).toBeVisible();
  await expect(shell.locator('nav')).toBeVisible();
  await expect(shell).toContainText('SEO Audit Tools');
  for (const label of ['Home', 'Free SEO Tools', 'Competitor Analysis']) {
    await expect(shell.locator('nav').getByRole('link', { name: label })).toBeVisible();
  }
  // A subtle spinner rather than a block of text; the wording survives for
  // screen readers only.
  await expect(shell.locator('.boot-spinner')).toBeVisible();
  await expect(shell.locator('.boot-sr')).toHaveText('Loading page…');
  await expect(shell.locator('.boot-stalled')).not.toBeVisible();
});

test('a bundle that never arrives offers a reload instead of an endless spinner', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route('**/assets/*.js', () => new Promise(() => {}));
  await page.goto('/tools', { waitUntil: 'commit' });
  // Same 12s deadline the app itself uses for a stalled route chunk.
  await expect(page.locator('#boot-shell')).toHaveAttribute('data-stalled', '', { timeout: 20_000 });
  await expect(page.locator('#boot-shell')).toContainText('This page is taking too long to load');
  await expect(page.locator('#boot-shell .boot-stalled')).toBeVisible();
  await expect(page.locator('#boot-shell .boot-spinner')).not.toBeVisible();
});

test('the static shell hands over to the real header and leaves the DOM', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.locator('h1')).toContainText('Tools');
  // Exactly one navigation is left, and it is the application's own.
  await expect(page.locator('#boot-shell')).toHaveCount(0);
  await expect(page.locator('nav').first()).toBeVisible();
  await expect(page.locator('nav').first()).toContainText('SEO Audit Tools');
  await expect(page.locator('main')).toHaveCount(1);
});

test('a fresh home visit paints the prerender, never the shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Free SEO Audit Tool');
  await expect(page.locator('html')).toHaveAttribute('data-prerender-home');
  await expect(page.locator('#boot-shell')).toHaveCount(0);
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
