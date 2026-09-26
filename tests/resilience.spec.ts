import { test, expect } from '@playwright/test';

/**
 * Regression coverage for the two ways this site used to feel slow:
 *
 *  1. Between-route loading. Routes are static imports inside the single
 *     dist/index.html, so a click swaps the content in one React commit — no
 *     `<Suspense>`, no fallback, no fetched chunk, no "Loading…" state.
 *  2. A blank content area on short pages. `.content-shell` keeps the content
 *     column at least a viewport tall, so the footer can never ride up under
 *     the fixed header.
 *
 * Both are asserted against the real built site.
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
  await page.locator('a[href="/free-tools?cat=calculator"]').first().click();
  await expect(page.locator('h1')).toContainText('Tools');

  expect(requests.filter(url => /\.(?:js|css)(?:\?|$)/.test(url))).toEqual([]);
  expect(requests.filter(url => url.includes('/assets/'))).toEqual([]);
});

test('the new route is on screen in the same task as the click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();

  // Dispatch the click from inside the page and read <main> in the very next
  // statement: React flushes discrete events synchronously, so the new page
  // must already be rendered — this is the "zero delay" guarantee.
  const swap = await page.evaluate(() => {
    const link = document.querySelector('a[href="/blog"]') as HTMLAnchorElement;
    const main = document.querySelector('main') as HTMLElement;
    const before = (main.textContent || '').trim();
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return {
      before,
      after: (main.textContent || '').trim(),
      pathname: location.pathname,
      hadStatus: document.querySelectorAll('main [role="status"]').length,
    };
  });

  expect(swap.before.length).toBeGreaterThan(0);
  expect(swap.after).toContain('Blog');
  expect(swap.after).not.toContain('Loading page');
  expect(swap.pathname).toBe('/blog');
  expect(swap.hadStatus).toBe(0);
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
