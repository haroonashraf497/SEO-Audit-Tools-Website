import { test, expect } from '@playwright/test';

/**
 * Regression coverage for the loading spinner that used to appear between
 * routes.
 *
 * The build is a single document: every route module is inlined into
 * dist/index.html, so opening a route fetches nothing from the network and no
 * loading placeholder is ever rendered. These tests drive the real built site
 * and prove both halves of that contract.
 */

test('the built site boots with no code requests and no loading placeholder', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));

  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Free SEO Audit Tool');
  await expect(page.locator('main')).not.toContainText('Loading page');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('seoaudittool:cms:v1'))).not.toBeNull();

  // Routes are part of the document, so visiting them requests nothing.
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.locator('a[href="/blog"]').first().click();
  await expect(page.locator('h1')).toContainText('Blog');
  await expect(page.locator('main')).not.toContainText('Loading page');
  await page.locator('a[href="/free-tools?cat=calculator"]').first().click();
  await expect(page.locator('h1')).toContainText('Tools');

  expect(requests.filter(url => /\.(?:js|css)(?:\?|$)/.test(url))).toEqual([]);
  expect(requests.filter(url => url.includes('/assets/'))).toEqual([]);
});

test('the audit button always comes back, even when every lookup stalls', async ({ page }) => {
  test.setTimeout(90_000);
  // No lookup can succeed, so the run must fall back to its own data and
  // release the button instead of leaving "Analyzing…" on screen.
  await page.route('**://*/*', route => (
    new URL(route.request().url()).host === 'localhost'
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
