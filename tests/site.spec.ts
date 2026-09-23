import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, readdirSync } from 'node:fs';

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

for (const [path, heading] of [
  ['/about', 'About SEO Audit Tools'],
  ['/tools?cat=calculator', /Free SEO Tools/],
  ['/tool/percentage-calculator', 'Percentage Calculator'],
  ['/blog', 'The SEO Audit Tool Blog'],
  ['/admin-login', 'Admin login'],
  ['/competitor-analysis', 'Website Competitor Analysis'],
  ['/tool/merge-pdf', 'Merge PDF'],
  ['/tool/text-to-pdf', 'Text To PDF'],
] as const) {
  test(`direct visit and reload: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page.locator('main')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('h1')).toHaveText(heading);
    // Canonicals are explicitly protected: preserve the existing hash values.
    if (!path.startsWith('/admin')) {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://seoaudittools.pk/#${path.split('?')[0]}`);
    }
  });
}

test('new-tab link, query filters and browser history', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Decline', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  const href = await page.locator('a[href="/tool/percentage-calculator"]').first().getAttribute('href');
  // Opening the literal href in a separate tab exercises native navigation,
  // not the click handler (the same request as the context-menu command).
  const tab = await context.newPage();
  await tab.goto(href!);
  await expect(tab.locator('h1')).toHaveText('Percentage Calculator');
  await tab.close();
  await page.locator('a[href="/tools?cat=calculator"]').click();
  await expect(page).toHaveURL(/\/tools\?cat=calculator$/);
  await expect(page.locator('h1')).toContainText('Tools');
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Free SEO Audit Tool');
  await page.goForward();
  await expect(page).toHaveURL(/\/tools\?cat=calculator$/);
});

for (const [path, destination, heading] of [
  ['/#/p/about?source=old#contact', '/about?source=old#contact', 'About SEO Audit Tools'],
  ['/p/about?source=old', '/about?source=old', 'About SEO Audit Tools'],
  ['/#/', '/', 'Free SEO Audit Tool'],
  ['/?source=new#features', '/?source=new#features', 'Free SEO Audit Tool'],
  ['/about#contact', '/about#contact', 'About SEO Audit Tools'],
  ['/index.html?source=old', '/?source=old', 'Free SEO Audit Tool'],
] as const) {
  test(`legacy URL / fragment: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash).toBe(destination);
  });
}

test('unknown routes keep the existing noindex 404', async ({ page }) => {
  await page.goto('/not/a/route');
  await expect(page.locator('h1')).toContainText(/not found/i);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('all 154 built-in tools render from their clean URLs', async ({ page }) => {
  test.setTimeout(180_000);
  const source = readFileSync('src/tools/data.tsx', 'utf8');
  const tools = [...source.matchAll(/\{ slug: '([^']+)', name: '([^']+)'/g)];
  expect(tools).toHaveLength(154);
  for (const [, slug, name] of tools) {
    await page.goto(`/tool/${slug}`);
    await expect(page.locator('h1')).toHaveText(name);
    await expect(page.locator('main')).not.toContainText('Loading page…');
  }
});

test('calculator results still update', async ({ page }) => {
  await page.goto('/tool/average-calculator');
  await page.locator('textarea').first().fill('10,20,60');
  await expect(page.locator('main')).toContainText('30.0000');
});

test('blog article loads from its literal href', async ({ page }) => {
  await page.goto('/blog');
  const link = page.locator('h3 a[href^="/blog/"]').first();
  const title = await link.innerText();
  const href = await link.getAttribute('href');
  await page.goto(href!);
  await expect(page.locator('h1')).toHaveText(title);
  await page.reload();
  await expect(page.locator('h1')).toHaveText(title);
});

test('CMS login, page and blog editor remain available', async ({ page }) => {
  await page.goto('/admin-login');
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('button', { name: 'Pages', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pages', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Page content', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Page content', exact: true }).fill('Page editor regression check');
  await page.getByRole('button', { name: 'Blog posts', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Blog post body', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Blog post body', exact: true }).fill('Blog editor regression check');
});

test('saved CMS settings bypass default prerender', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('seoaudittool:cms:v1'))).not.toBeNull();
  await page.evaluate(() => {
    const key = 'seoaudittool:cms:v1';
    const state = JSON.parse(localStorage.getItem(key)!);
    state.settings.name = 'Saved CMS Brand';
    state.sections.hero = false;
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator('nav').first()).toContainText('Saved CMS Brand');
  await expect(page.locator('h1')).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-prerender-home');
});

test('homepage accessibility, including below-fold sections', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  // content-visibility can prevent audits of off-screen text; audit it too.
  await page.addStyleTag({ content: '.cv-auto { content-visibility: visible !important; }' });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ html: n.html, summary: n.failureSummary })) }))).toEqual([]);
  await page.getByRole('button', { name: 'Cookie preferences', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close cookie preferences' })).toBeVisible();
});

test('code-split build: homepage first, the rest warms in the background', async ({ page }) => {
  const html = readFileSync('dist/index.html', 'utf8');
  // The document is prerendered homepage markup + a static header shell +
  // inline CSS; the application graph is external, content-hashed and loaded
  // without blocking the paint.
  expect(html).toMatch(/<script[^>]+src="\/assets\/index-[^"]+\.js"/);
  expect(html).not.toContain('__VITE_PRELOAD__');
  expect(html).not.toContain('id="app-modules"');
  expect(html.length).toBeLessThan(220 * 1024); // was a 1.3 MB single file

  // The shell that paints before any JavaScript must not add a second <main>,
  // a second <h1> or a second live region: strict-mode locators and the
  // accessibility audit both depend on the app owning those exactly once.
  const shell = html.slice(html.indexOf('id="boot-shell"'), html.indexOf('</body>'));
  expect(shell.length).toBeGreaterThan(0);
  expect(shell).not.toMatch(/<main|<h1|<h2|role="alert"/);

  // Every protected surface remains its own lazily-fetched chunk.
  const assets = readdirSync('dist/assets');
  for (const prefix of ['Tools-', 'Admin-', 'AdminLogin-', 'Blog-', 'CompetitorAnalysis-', 'PdfTools-']) {
    expect(assets.some(f => f.startsWith(prefix) && f.endsWith('.js'))).toBe(true);
  }
  // The homepage document must not reference or preload any route chunk.
  expect(html).not.toMatch(/assets\/(?:Tools|Admin|AdminLogin|Blog|CompetitorAnalysis|ConvertTools|PdfTools|Sidebar|ui)-[^"']+\.js/);

  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  const routeChunks = () => requests.filter(url => /\/assets\/(?!index-)[^/]+\.js/.test(url));

  await page.coverage.startJSCoverage();
  await page.goto('/');
  // Up to `load`, the homepage needed exactly one script — the entry chunk.
  // Background warming is deliberately scheduled after this point, so it can
  // never compete with the page being painted.
  expect(routeChunks()).toEqual([]);
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.map(entry => entry.url).filter(url => url.includes('/assets/')))
    .toEqual([expect.stringMatching(/\/assets\/index-[^/]+\.js$/)]);

  await expect.poll(() => page.evaluate(() => localStorage.getItem('seoaudittool:cms:v1'))).not.toBeNull();
  // Then the remaining public routes arrive on their own, while the visitor is
  // still reading the homepage: no click and no loading state required.
  await expect.poll(() => routeChunks().some(url => /\/assets\/Tools-[^/]+\.js/.test(url)), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => routeChunks().some(url => /\/assets\/Blog-[^/]+\.js/.test(url)), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => routeChunks().some(url => /\/assets\/CompetitorAnalysis-[^/]+\.js/.test(url)), { timeout: 30_000 }).toBe(true);
  // Admin code is not warmed for a signed-out visitor.
  expect(routeChunks().some(url => /\/assets\/Admin-[^/]+\.js/.test(url))).toBe(false);

  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.locator('a[href="/tool/percentage-calculator"]').first().click();
  await expect(page.locator('h1')).toHaveText('Percentage Calculator');
});
