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
  ['/free-tools?cat=calculator', /Free SEO Tools/],
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
    // Clean-URL canonicals: the site uses History-API routes, so the canonical
    // must be the real path (a hash URL would canonicalise to a different page).
    if (!path.startsWith('/admin')) {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://seoaudittools.pk${path.split('?')[0]}`);
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
  await page.locator('a[href="/free-tools?cat=calculator"]').click();
  await expect(page).toHaveURL(/\/free-tools\?cat=calculator$/);
  await expect(page.locator('h1')).toContainText('Tools');
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Free SEO Audit Tool');
  await page.goForward();
  await expect(page).toHaveURL(/\/free-tools\?cat=calculator$/);
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

test('navigation is instant: content swaps within a single frame', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();

  // Sample the content area on every animation frame. A blank intermediate
  // state — the flash this test exists to prevent — would be recorded here.
  await page.evaluate(() => {
    const w = window as unknown as { __frames: { text: number; height: number }[]; __raf: number };
    w.__frames = [];
    const main = document.querySelector('main') as HTMLElement;
    const tick = () => {
      w.__frames.push({ text: (main.textContent || '').trim().length, height: main.getBoundingClientRect().height });
      w.__raf = requestAnimationFrame(tick);
    };
    tick();
  });

  await page.locator('a[href="/blog"]').first().click();
  await expect(page.locator('h1')).toContainText('Blog');
  await page.locator('a[href="/free-tools"]').first().click();
  await expect(page.locator('h1')).toContainText('Tools');
  await page.waitForTimeout(120);

  const frames = await page.evaluate(() => (window as unknown as { __frames: { text: number; height: number }[] }).__frames);
  expect(frames.length).toBeGreaterThan(2);
  expect(frames.filter(f => f.text === 0)).toEqual([]);
  // No frame where the content area collapsed to nothing.
  expect(frames.filter(f => f.height < 200)).toEqual([]);
  await expect(page.locator('main')).not.toContainText('Loading page');
});

test('the content area always fills the viewport, so the footer never touches the header', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ['/admin-login', '/free-tools', '/about']) {
    await page.goto(path);
    const { minHeight, height, footerTop } = await page.evaluate(() => {
      const main = document.querySelector('main') as HTMLElement;
      const footer = document.querySelector('footer') as HTMLElement;
      return {
        minHeight: getComputedStyle(main).minHeight,
        height: main.getBoundingClientRect().height,
        footerTop: footer.getBoundingClientRect().top + window.scrollY,
      };
    });
    // The 4rem header is excluded from the minimum, per the design rule.
    expect(minHeight).toMatch(/calc\(|7[0-9][0-9]px/);
    expect(height).toBeGreaterThanOrEqual(700); // 800px viewport - 64px header
    expect(footerTop).toBeGreaterThanOrEqual(700);
  }
});

test('a click opens the new page at the top; history keeps the reader in place', async ({ page }) => {
  await page.goto('/blog');
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 1200));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  // A link click is a new page: it starts at the top, immediately.
  await page.locator('a[href="/free-tools"]').first().click();
  await expect(page.locator('h1')).toContainText('Tools');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  // Back/forward is not a new page, so the browser's own restoration is left
  // alone instead of being overridden by a forced jump to the top.
  await page.goBack();
  await expect(page.locator('h1')).toContainText('Blog');
  expect(await page.evaluate(() => history.scrollRestoration)).toBe('auto');
});

test('single-file build: one document, no chunks to fetch', async ({ page }) => {
  const html = readFileSync('dist/index.html', 'utf8');
  // Every route — tools, blog, CMS, admin, editors — lives inside the one
  // document: no external application script, no preload markers, no chunked
  // module graph to fetch.
  expect(html).not.toMatch(/<script[^>]+src="\/assets\//);
  expect(html).not.toContain('__VITE_PRELOAD__');
  expect(html).not.toContain('id="app-modules"');
  expect(html).toMatch(/<script type="module"/);
  // Route code really is inside the document.
  expect(html).toContain('Percentage Calculator');
  expect(html).toContain('Admin login');
  // Nothing in the build can show a loading state.
  expect(html).not.toContain('Loading page');
  expect(html).not.toContain('Loading PDF engine');
  expect(html).toContain('content-shell');
  // Nothing is emitted next to index.html except the public hosting files.
  const entries = readdirSync('dist', { withFileTypes: true });
  expect(entries.filter(entry => entry.isDirectory()).map(entry => entry.name)).toEqual([]);

  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('seoaudittool:cms:v1'))).not.toBeNull();
  // Not a single JavaScript or stylesheet request: all of it was in the HTML.
  expect(requests.filter(url => /\.(?:js|css)(?:\?|$)/.test(url))).toEqual([]);
  await expect(page.locator('main')).not.toContainText('Loading page');

  // Opening a route is instant — nothing is fetched, so nothing can stall.
  await page.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.locator('a[href="/tool/percentage-calculator"]').first().click();
  await expect(page.locator('h1')).toHaveText('Percentage Calculator');
  expect(requests.filter(url => url.includes('/assets/'))).toEqual([]);
});
