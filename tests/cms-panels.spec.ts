import { test, expect, type Page } from '@playwright/test';

/**
 * Coverage for the content-manager panels that drive the header and footer.
 *
 * Everything here is browser-local by design (no backend), so each test seeds
 * an admin session, edits a panel, saves, and then checks the public site —
 * including after a reload, which is what "survives refresh" means.
 */

const ADMIN_SESSION_KEY = 'ekstruh:admin-session:v1';
const CMS_KEY = 'seoaudittool:cms:v1';

const signInAsAdmin = async (page: Page) => {
  await page.addInitScript(([key]) => {
    localStorage.setItem(key, JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 }));
  }, [ADMIN_SESSION_KEY]);
};

const pane = (page: Page, heading: string) => page.locator('section', { hasText: heading }).first();

test('navigation menu: add, hide, save → header updates live and survives reload', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sections & Nav', exact: true }).click();

  const card = pane(page, 'Navigation menu');
  await card.getByRole('button', { name: '+ Add', exact: true }).click();
  await card.locator('input[aria-label="Link label"]').last().fill('Pricing');
  await card.locator('input[aria-label="Link URL"]').last().fill('/pricing');

  await card.getByRole('button', { name: 'Save Changes' }).click();
  await expect(card.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

  // Live on the public header, before any reload.
  await page.goto('/');
  await expect(page.locator('nav')).toContainText('Pricing');
  await page.reload();
  await expect(page.locator('nav')).toContainText('Pricing');

  // The visible/hidden toggle on the first row (the default "Free SEO Tools"
  // link) takes effect on the site too.
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sections & Nav', exact: true }).click();
  const again = pane(page, 'Navigation menu');
  await again.getByRole('button', { name: 'Visible', exact: true }).first().click();
  await again.getByRole('button', { name: 'Save Changes' }).click();
  await expect(again.getByRole('button', { name: 'Saved ✓' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('nav').first()).toContainText('Pricing');
  await expect(page.locator('nav').first()).not.toContainText('Free SEO Tools');

  // Removing a row takes effect as well.
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sections & Nav', exact: true }).click();
  const final = pane(page, 'Navigation menu');
  await final.getByRole('button', { name: 'Remove' }).last().click();
  await final.getByRole('button', { name: 'Save Changes' }).click();
  await expect(final.getByRole('button', { name: 'Saved ✓' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('nav').first()).not.toContainText('Pricing');
});

test('brand & footer: name, domain, footer note and copyright update and persist', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sections & Nav', exact: true }).click();

  const identity = pane(page, 'Site identity');
  await identity.getByLabel('Site name').fill('Arena Brand');
  await identity.getByLabel('Domain').fill('arena.example');
  await identity.getByLabel('Footer note').fill('Footer note written in the CMS.');
  await identity.getByRole('button', { name: 'Save Changes' }).click();
  await expect(identity.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

  const copyright = pane(page, 'Footer copyright text');
  await copyright.getByLabel('Copyright line').fill('© {year} {name} · {domain} · All rights reserved.');
  await copyright.getByRole('button', { name: 'Save Changes' }).click();
  await expect(copyright.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer).toContainText('Arena Brand');
  await expect(footer).toContainText('Footer note written in the CMS.');
  await expect(footer).toContainText(`© ${new Date().getFullYear()} Arena Brand · arena.example · All rights reserved.`);

  // Everything above is stored in the browser, so a reload keeps it.
  await page.reload();
  await expect(footer).toContainText('Arena Brand');
  await expect(footer).toContainText(`© ${new Date().getFullYear()} Arena Brand · arena.example · All rights reserved.`);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), CMS_KEY);
  expect(stored.settings.name).toBe('Arena Brand');
  expect(stored.settings.footerCopyright).toContain('{year}');
});

test('footer menu links and social profiles render as footer navigation', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sections & Nav', exact: true }).click();

  const menu = pane(page, 'Footer menu links');
  await menu.getByLabel('Section title').fill('Company');
  await menu.getByRole('button', { name: '+ Add', exact: true }).click();
  await menu.locator('input[aria-label="Link label"]').last().fill('Careers');
  await menu.locator('input[aria-label="Link URL"]').last().fill('/careers');
  await menu.getByRole('button', { name: 'Save Changes' }).click();
  await expect(menu.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

  const social = pane(page, 'Social profiles');
  await social.getByLabel('LinkedIn URL').fill('https://www.linkedin.com/company/arena');
  await social.getByLabel('YouTube URL').fill('https://www.youtube.com/@arena');
  await social.getByRole('button', { name: 'Save Changes' }).click();
  await expect(social.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: 'Careers' })).toHaveAttribute('href', '/careers');
  await expect(footer.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', 'https://www.linkedin.com/company/arena');
  await expect(footer.getByRole('link', { name: 'YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/@arena');
  // Blank fields stay hidden: no placeholder profiles are linked.
  await expect(footer.locator('a[aria-label="Facebook"]')).toHaveCount(0);
  await expect(footer.locator('a[aria-label="X (Twitter)"]')).toHaveCount(0);
});

test('footer logo can be uploaded and replaces the default mark', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sections & Nav', exact: true }).click();

  const logo = pane(page, 'Footer logo');
  // 1×1 transparent PNG.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await logo.locator('input[type="file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
  await expect(logo.locator('img[alt="Footer logo preview"]')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await logo.getByRole('button', { name: 'Save Changes' }).click();
  await expect(logo.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

  await page.goto('/');
  const mark = page.locator('footer img[alt$="logo"]');
  await expect(mark).toHaveAttribute('src', /^data:image\/png;base64,/);
  await page.reload();
  await expect(page.locator('footer img[alt$="logo"]')).toHaveAttribute('src', /^data:image\/png;base64,/);
});

test('header verification & ads: purple save injects the snippet into <head>', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const snippet = '<meta name="arena-verify" content="yes"><script>window.__arenaAdRan = true;</script>';
  await page.getByLabel('Header verification and ads code').fill(snippet);
  await page.getByRole('button', { name: 'Save Changes' }).first().click();
  await expect(page.getByRole('button', { name: 'Saved ✓' }).first()).toBeVisible();

  // Injected for this visit…
  await expect(page.locator('head meta[name="arena-verify"]')).toHaveAttribute('content', 'yes');
  expect(await page.evaluate(() => (window as unknown as { __arenaAdRan?: boolean }).__arenaAdRan)).toBe(true);
  // …and stored, so every later visit injects it again.
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), CMS_KEY);
  expect(stored.settings.headerVerificationAds).toContain('arena-verify');

  await page.goto('/');
  await page.reload();
  await expect(page.locator('head meta[name="arena-verify"]')).toHaveAttribute('content', 'yes');
  expect(await page.evaluate(() => (window as unknown as { __arenaAdRan?: boolean }).__arenaAdRan)).toBe(true);
  await expect(page.locator('main')).not.toContainText('Loading page');
});
