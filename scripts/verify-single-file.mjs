/**
 * Headless verification of the built single-file site.
 *
 *   npm run build
 *   npm i --no-save jsdom        # only needed for this script
 *   node scripts/verify-single-file.mjs
 *
 * Why this exists: the build is one self-contained dist/index.html, and the
 * Playwright suite needs a real browser. This script boots that same document
 * in jsdom and checks the behaviour that matters — the footer the CMS drives,
 * head-snippet injection, and the save buttons in the admin panels — so a
 * regression is caught even without Chromium installed.
 *
 * jsdom cannot execute ES modules, so the inlined module script is moved to
 * the end of <body> and run as a classic script (the bundle has no
 * import/export/import.meta, so this is equivalent for a smoke test).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distFile = path.join(root, 'dist/index.html');

let JSDOM;
let VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  console.error('This script needs jsdom: npm i --no-save jsdom');
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → ${detail}`}`);
};

const rawHtml = readFileSync(distFile, 'utf8');

const boot = async (preloadJs = '', route = '/') => {
  const module = rawHtml.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
  if (!module) throw new Error('inline module script not found in dist/index.html');
  let html = rawHtml.replace(module[0], '');
  if (preloadJs) {
    // Must run before the prerender gate — this is "the visitor already has
    // this content stored in the browser".
    const head = html.indexOf('<head>') + '<head>'.length;
    html = html.slice(0, head) + `<script>${preloadJs.replace(/</g, '\\u003c')}</script>` + html.slice(head);
  }
  // The app code contains the text "</body>" inside strings, so the real
  // landmark is the last occurrence.
  const at = html.lastIndexOf('</body>');
  html = html.slice(0, at) + `<script>${module[1]}</script>` + html.slice(at);

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => {
    const message = String((e && e.message) || e);
    if (/Not implemented/.test(message)) return; // jsdom has no layout engine
    errors.push(message);
  });
  const dom = new JSDOM(html, { url: `http://localhost${route}`, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole });
  await new Promise(resolve => setTimeout(resolve, 900));
  return { dom, errors };
};

const text = dom => dom.window.document.body.textContent || '';
const wait = () => new Promise(resolve => setTimeout(resolve, 250));

/* 1. the default document */
{
  const { dom, errors } = await boot();
  const doc = dom.window.document;
  check('single-file build boots with no script errors', errors.length === 0, errors.join(' | '));
  check('no loading placeholder anywhere', !text(dom).includes('Loading page'));
  check('header renders the brand', doc.querySelector('nav').textContent.includes('SEO Audit Tools'));
  check('footer renders the copyright line', text(dom).includes(`© ${new Date().getFullYear()} SEO Audit Tools · seoaudittools.pk`));
  check('footer renders the note and menu links', text(dom).includes('free online SEO') && text(dom).includes('Free SEO Audit'));
  check('footer renders the configured social icons', doc.querySelectorAll('footer a[aria-label="Facebook"], footer a[aria-label="X (Twitter)"]').length === 2);
  dom.window.close();
}

/* 2. saved CMS content drives the header, footer and <head> */
{
  const state = {
    version: 13,
    settings: {
      name: 'Arena Brand', domain: 'arena.example', tagline: 'Tagline',
      footerNote: 'Custom footer note from the CMS.',
      headerVerificationAds: '<meta name="arena-verify" content="yes"><script>window.__injectedRan = true;</script>',
      footerCopyright: '© {year} {name} · {domain} · All rights reserved.',
      footerLogoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      footerMenuTitle: 'Footer Menu',
      footerLinks: [
        { id: 'a', label: 'Privacy Policy', href: '/privacy', visible: true },
        { id: 'b', label: 'Hidden Link', href: '/hidden', visible: false },
      ],
      social: { facebook: '', x: '', linkedin: 'https://linkedin.com/company/arena', instagram: '', youtube: 'https://youtube.com/@arena' },
    },
    nav: [{ id: 'n1', label: 'My Custom Nav', href: '/blog', visible: true }],
    sections: {}, tools: [], posts: [], pages: [], seo: {},
  };
  const preload = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(state))});`;
  const { dom, errors } = await boot(preload);
  const doc = dom.window.document;
  check('saved settings load without errors', errors.length === 0, errors.join(' | '));
  check('saved brand + nav link render', doc.querySelector('nav').textContent.includes('Arena Brand') && doc.querySelector('nav').textContent.includes('My Custom Nav'));
  check('saved footer note renders', text(dom).includes('Custom footer note from the CMS.'));
  check('copyright placeholders expand', text(dom).includes('© ' + new Date().getFullYear() + ' Arena Brand · arena.example · All rights reserved.'));
  check('footer menu column renders, hidden rows do not', text(dom).includes('Footer Menu') && text(dom).includes('Privacy Policy') && !text(dom).includes('Hidden Link'));
  check('uploaded footer logo replaces the default mark', !!doc.querySelector('footer img[alt="Arena Brand logo"]'));
  check('only configured socials are linked', doc.querySelectorAll('footer a[aria-label="Facebook"]').length === 0
    && doc.querySelectorAll('footer a[aria-label="LinkedIn"], footer a[aria-label="YouTube"]').length === 2);
  check('head snippet injected on load', doc.head.querySelectorAll('[data-cms-header-code]').length === 2);
  check('injected script actually executed', dom.window.__injectedRan === true);
  dom.window.close();
}

/* 3. admin panels: purple save buttons, nav editor, head-ads save */
{
  const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
  const { dom, errors } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const doc = dom.window.document;
  const click = element => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  check('admin app boots without errors', errors.length === 0, errors.join(' | '));

  click([...doc.querySelectorAll('button')].find(button => /sections/i.test(button.textContent)));
  await wait();
  check('navigation menu editor renders', doc.body.textContent.includes('Navigation menu'));
  check('save buttons use the purple style', [...doc.querySelectorAll('button')].some(button => button.textContent.includes('Save Changes') && button.className.includes('bg-purple-600')));

  const copyright = [...doc.querySelectorAll('input')].find(input => (input.value || '').includes('{year}'));
  check('footer copyright field offers {year}/{name}/{domain}', !!copyright);
  const setValue = (element, value) => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  setValue(copyright, '© {year} {name} — {domain}');
  await wait();
  const saveButtons = [...doc.querySelectorAll('button')].filter(button => button.textContent.includes('Save Changes'));
  click(saveButtons[saveButtons.length - 1]);
  await wait();
  check('clicking save shows "Saved ✓"', [...doc.querySelectorAll('button')].some(button => button.textContent.includes('Saved ✓')));
  const stored = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('saved value persisted to localStorage', stored.settings?.footerCopyright === '© {year} {name} — {domain}');
  dom.window.close();
}

/* 5. instant navigation: no empty frame, no loading state, no blank swap */
{
  const { dom, errors } = await boot();
  const doc = dom.window.document;
  const main = doc.querySelector('main');
  const compact = rawHtml.replace(/\s+/g, ' ').replace(/\s*\{\s*/g, '{');
  check('content shell reserves the height between header and footer',
    /content-shell/.test(main.className) && compact.includes('.content-shell{min-height:calc(100vh - 4rem)}'),
    main.className);
  check('no status/spinner placeholder in the shell', doc.querySelectorAll('[role="status"]').length === 0);

  // Watch every DOM change inside <main>: an empty intermediate state — the
  // "blank between clicks" — would be recorded here.
  dom.window.eval(`
    window.__frameLog = [];
    window.__recordNow = () => window.__frameLog.push((document.querySelector('main').textContent || '').trim().length);
    window.__watch = new MutationObserver(() => window.__recordNow());
    window.__watch.observe(document.querySelector('main'), { childList: true, subtree: true, characterData: true });
    window.__recordNow();
  `);

  // Click the real header/footer links, then prove the content is swapped in
  // the next microtask — before the browser can paint, so there is no visible
  // gap — and that every rendered <main> state had content (no blank frame).
  const clickIn = (selector, href) => {
    const link = doc.querySelector(`${selector} a[href="${href}"]`) || doc.querySelector(`a[href="${href}"]`);
    if (!link) throw new Error(`no link to ${href}`);
    const before = dom.window.__frameLog.length;
    link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    return { urlNow: dom.window.location.pathname, framesAfterClick: dom.window.__frameLog.length, before };
  };
  const swapDelay = async marker => dom.window.eval(`(async () => {
    const heading = () => ((document.querySelector('main h1') || {}).textContent || '');
    for (let i = 0; i < 500; i++) {
      if (heading().includes(${JSON.stringify(marker)})) return i;
      await Promise.resolve();
    }
    return -1;
  })()`);

  const framesBefore = dom.window.__frameLog.length;
  const blog = clickIn('nav.fixed', '/blog');
  check('click on /blog updates the URL immediately', blog.urlNow === '/blog', blog.urlNow);
  check('click on /blog leaves the old page on screen in the same task', blog.framesAfterClick === blog.before, blog.framesAfterClick);
  const blogTicks = await swapDelay('Blog');
  check('click on /blog swaps the content within a microtask (no paint in between)',
    blogTicks >= 0 && blogTicks < 50, `microtasks: ${blogTicks}`);
  const blogNow = (main.textContent || '').trim();
  check('click on /blog renders the blog, never a loading placeholder',
    blogNow.includes('The SEO Audit Tool Blog') && !/Loading page|Loading PDF engine/i.test(blogNow), blogNow.slice(0, 60));

  const toolsSwap = clickIn('footer', '/free-tools');
  check('footer click on /free-tools updates the URL immediately', toolsSwap.urlNow === '/free-tools', toolsSwap.urlNow);
  const toolsTicks = await swapDelay('Free SEO Tools');
  check('footer click swaps the tools page within a microtask',
    toolsTicks >= 0 && toolsTicks < 50, `microtasks: ${toolsTicks}`);

  const frames = dom.window.__frameLog;
  check('exactly one new <main> render per navigation, never an empty frame',
    frames.length === framesBefore + 2 && frames.every(entry => entry > 0),
    JSON.stringify(frames.slice(0, 12)));

  dom.window.close();
}

/* 6. every heavy route renders straight away — the PDF pages used to show a
      "Loading PDF engine…" Suspense fallback */
for (const [path, expected] of [['/tool/merge-pdf', 'Merge PDF'], ['/admin-login', 'Admin login'], ['/competitor-analysis', 'Competitor Analysis']]) {
  const { dom, errors } = await boot('', path);
  const mainText = (dom.window.document.querySelector('main').textContent || '').trim();
  check(`${path} renders immediately with no loading state`,
    mainText.includes(expected) && !/Loading (page|PDF engine)/i.test(mainText) && errors.length === 0,
    errors.join(' | ') + ' ' + mainText.slice(0, 60));
  dom.window.close();
}

/* 4. legacy /tools URLs are normalised to /free-tools client-side */
{
  const { dom, errors } = await boot('', '/tools');
  check('legacy /tools boot has no script errors', errors.length === 0, errors.join(' | '));
  check('/tools normalises to /free-tools', dom.window.location.pathname === '/free-tools', dom.window.location.pathname);
  check('tools page renders its heading', /Tools/.test(dom.window.document.querySelector('h1')?.textContent || ''));
  dom.window.close();
}

/* 7. footer redesign — four equal columns + a separate Legal column, and a
      bottom bar with the editable copyright on the left and the legal links
      on the right; legal pages answer on the short canonical URLs */
{
  const { dom, errors } = await boot();
  const doc = dom.window.document;
  const footer = doc.querySelector('footer');
  const click = element => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('footer redesign boots with no script errors', errors.length === 0, errors.join(' | '));

  // The column headings' own CSS: 18px, capitalised, no letter-spacing.
  const compactCss = rawHtml.replace(/\s+/g, '');
  check('column headings carry the 18px / capitalize / 0 letter-spacing classes',
    /<h3class="text-\[18px\]font-boldcapitalizetracking-\[0px\]text-slate-400mb-4"/.test(compactCss),
    (rawHtml.match(/<h3 class="[^"]*">Quick links<\/h3>/) || ['not found'])[0]);
  check('the built stylesheet declares those three properties',
    compactCss.includes('.text-\\[18px\\]{font-size:18px}')
    && compactCss.includes('.capitalize{text-transform:capitalize}')
    && /\.tracking-\\\[0px\\\]\{--tw-tracking:0px;letter-spacing:0\}/.test(compactCss),
    compactCss.match(/\.text-\\\[18px\\\]\{[^}]*\}/)?.[0] || 'missing');

  const column = title => [...footer.querySelectorAll('nav')].find(nav => nav.getAttribute('aria-label') === title);
  const titles = ['Quick links', 'SEO Tools', 'Resources', 'Company'];
  const navs = [...footer.querySelectorAll('nav')];
  check('four footer columns render, plus the bottom bar only',
    navs.length === 5 && titles.every(column) && navs[4].getAttribute('aria-label') === 'Legal documents',
    navs.map(nav => nav.getAttribute('aria-label')).join(', '));
  check('no separate Legal column any more',
    !navs.some(nav => nav.getAttribute('aria-label') === 'Legal') && !footer.textContent.includes('Terms & Conditions'),
    navs.map(nav => nav.getAttribute('aria-label')).join(', '));
  check('legal links are only in the bottom bar',
    [...footer.querySelectorAll('a[href="/privacy"], a[href="/cookies"], a[href="/terms"]')]
      .every(a => a.closest('nav')?.getAttribute('aria-label') === 'Legal documents'));
  check('Quick Links column = audit, tools, blog, about, contact',
    ['Free SEO Audit', 'Free SEO Tools', 'Blog', 'About', 'Contact'].every(label => column('Quick links').textContent.includes(label)));
  check('SEO Tools column = audit, tools, competitor analysis',
    ['Free SEO Audit', 'Free SEO Tools', 'Competitor Analysis'].every(label => column('SEO Tools').textContent.includes(label)));
  check('Resources column = blog, FAQ, who it\'s for',
    ['Blog', 'FAQ', "Who It's For"].every(label => column('Resources').textContent.includes(label)));
  check('Company column = about, contact',
    ['About', 'Contact'].every(label => column('Company').textContent.includes(label)));

  const bottom = footer.querySelector('nav[aria-label="Legal documents"]');
  check('bottom bar pairs the copyright with the legal links',
    !!bottom && /sm:justify-between/.test(bottom.parentElement.className) && /sm:justify-end/.test(bottom.className),
    bottom ? bottom.className : 'no bottom nav');
  check('bottom-bar legal links use the short URLs',
    [...bottom.querySelectorAll('a')].map(a => a.getAttribute('href')).join(',') === '/privacy,/cookies,/terms');
  check('bottom bar shows the short labels',
    [...bottom.querySelectorAll('a')].map(a => a.textContent.trim()).join(' · ') === 'Privacy · Cookie · Terms',
    [...bottom.querySelectorAll('a')].map(a => a.textContent.trim()).join(' · '));
  check('short links keep Privacy Policy / Cookie Policy / Terms & Conditions as their accessible name',
    [...bottom.querySelectorAll('a')].map(a => a.getAttribute('aria-label')).join('|') === 'Privacy Policy|Cookie Policy|Terms & Conditions'
    && [...bottom.querySelectorAll('a')].map(a => a.getAttribute('title')).join('|') === 'Privacy Policy|Cookie Policy|Terms & Conditions');
  check('bottom bar ends with the Cookie preferences control',
    (() => {
      const items = [...bottom.children].filter(el => el.tagName !== 'SPAN' || el.textContent.trim() !== '·');
      const last = items[items.length - 1];
      return !!last && last.tagName === 'BUTTON' && last.textContent.trim() === 'Cookie preferences'
        && bottom.textContent.replace(/\s+/g, '').endsWith('·Cookiepreferences');
    })(), bottom.textContent.trim());
  check('bottom bar keeps the editable copyright on the left',
    footer.textContent.includes(`© ${new Date().getFullYear()} SEO Audit Tools · seoaudittools.pk`));

  // The bottom bar holds the only cookie-preferences control in the footer.
  check('the footer has exactly one Cookie preferences control',
    [...footer.querySelectorAll('button')].filter(button => button.textContent.trim() === 'Cookie preferences').length === 1);
  click([...bottom.querySelectorAll('button')].find(button => button.textContent.trim() === 'Cookie preferences'));
  await wait();
  check('bottom-bar Cookie preferences control opens the dialog',
    !!doc.querySelector('[role="dialog"][aria-label="Cookie preferences"]'));
  dom.window.close();
}

/* 8. the legal pages render on their short URLs, and the old long URLs are
      upgraded client-side (the .htaccess 301 covers real hosting) */
for (const [short, long, heading] of [['/privacy', '/privacy-policy', 'Privacy Policy'], ['/cookies', '/cookie-policy', 'Cookie Policy'], ['/terms', '/terms-of-service', 'Terms & Conditions']]) {
  const shortBoot = await boot('', short);
  const shortMain = (shortBoot.dom.window.document.querySelector('main').textContent || '');
  const canonical = shortBoot.dom.window.document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  check(`${short} renders ${heading}`, shortMain.includes(heading) && !/not found|not available/i.test(shortMain), shortMain.slice(0, 80));
  check(`${short} canonical points at the short URL`, canonical.endsWith(`${short}`), canonical);
  check(`${short} boots with no script errors`, shortBoot.errors.length === 0, shortBoot.errors.join(' | '));
  shortBoot.dom.window.close();

  const longBoot = await boot('', long);
  check(`${long} normalises to ${short}`, longBoot.dom.window.location.pathname === short, longBoot.dom.window.location.pathname);
  check(`${long} then renders ${heading}`,
    (longBoot.dom.window.document.querySelector('main').textContent || '').includes(heading),
    (longBoot.dom.window.document.querySelector('main').textContent || '').slice(0, 80));
  longBoot.dom.window.close();
}

/* 9. clicking a footer legal link navigates instantly on the short URL */
{
  const { dom, errors } = await boot();
  const doc = dom.window.document;
  const main = doc.querySelector('main');
  const link = doc.querySelector('footer a[href="/privacy"]');
  link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  check('footer legal click updates the URL to /privacy immediately', dom.window.location.pathname === '/privacy', dom.window.location.pathname);
  await wait();
  const now = (main.textContent || '').trim();
  check('footer legal click renders the policy right away', now.includes('Privacy Policy') && !/Loading page/i.test(now), now.slice(0, 80));
  check('footer legal click has no script errors', errors.length === 0, errors.join(' | '));
  dom.window.close();
}

/* 10. every footer column is editable from Admin → Sections & Nav → Brand &
       footer: own heading, own link rows, own + Add and own Save Changes */
{
  const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
  const { dom, errors } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const w = dom.window;
  const doc = w.document;
  const click = element => element.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const setValue = (element, value) => {
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new w.Event('input', { bubbles: true }));
  };
  click([...doc.querySelectorAll('button')].find(button => /sections/i.test(button.textContent)));
  await wait();
  check('admin boots the footer-column editors with no script errors', errors.length === 0, errors.join(' | '));

  const cards = [...doc.querySelectorAll('[role="group"][aria-label^="Footer column"]')];
  check('four separate footer-column editors render', cards.length === 4, String(cards.length));
  const headings = cards.map(card => card.querySelector('h4').textContent.trim());
  check('the editors are Column 1-4 with the live headings',
    headings[0].startsWith('Column 1 — Quick links') && headings[1].startsWith('Column 2 — SEO Tools')
    && headings[2].startsWith('Column 3 — Resources') && headings[3].startsWith('Column 4 — Company'),
    headings.join(' / '));
  check('each editor has its own Section title, + Add and Save Changes',
    cards.every(card => card.querySelector('input')
      && [...card.querySelectorAll('button')].some(button => button.textContent.trim() === '+ Add')
      && [...card.querySelectorAll('button')].filter(button => /Save Changes/.test(button.textContent)).length === 1));
  check('link rows expose label, URL, visible/hidden and remove',
    cards.every(card => card.querySelectorAll('[aria-label="Link label"]').length === card.querySelectorAll('[aria-label="Link URL"]').length)
    && [...doc.querySelectorAll('[role="group"][aria-label^="Footer column"] button')].some(button => button.textContent.trim() === 'Visible')
    && [...doc.querySelectorAll('[role="group"][aria-label^="Footer column"] button')].some(button => button.textContent.trim() === 'Remove'));

  /* column 3: rename the heading, add a link, hide an existing one, save */
  const card = cards[2];
  setValue(card.querySelector('input'), 'Guides');
  click([...card.querySelectorAll('button')].find(button => button.textContent.trim() === '+ Add'));
  await wait();
  const labels = [...card.querySelectorAll('[aria-label="Link label"]')];
  const urls = [...card.querySelectorAll('[aria-label="Link URL"]')];
  setValue(labels[labels.length - 1], 'Sitemap guide');
  setValue(urls[urls.length - 1], '/blog/xml-sitemap-guide');
  // hide the first link of this column
  click([...card.querySelectorAll('button')].find(button => button.textContent.trim() === 'Visible'));
  await wait();
  click([...card.querySelectorAll('button')].find(button => /Save Changes/.test(button.textContent)));
  await wait();
  check('saving a column flashes "Saved ✓"',
    [...card.querySelectorAll('button')].some(button => button.textContent.includes('Saved ✓')));

  const stored = JSON.parse(w.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  const column3 = stored.footerColumns?.[2];
  check('the edited column persists to localStorage',
    column3?.title === 'Guides'
    && column3.links.some(l => l.label === 'Sitemap guide' && l.href === '/blog/xml-sitemap-guide')
    && column3.links.filter(l => l.visible === false).length === 1,
    JSON.stringify(column3 || {}).slice(0, 200));
  check('the other three columns are untouched',
    stored.footerColumns?.[0]?.title === 'Quick links' && stored.footerColumns?.[1]?.title === 'SEO Tools'
    && stored.footerColumns?.[3]?.title === 'Company');

  const footer = doc.querySelector('footer');
  const navText = [...footer.querySelectorAll('nav')][2].textContent.replace(/\s+/g, ' ').trim();
  check('the live footer shows the new heading and link immediately',
    [...footer.querySelectorAll('nav h3')].map(h => h.textContent).join('|') === 'Quick links|SEO Tools|Guides|Company'
    && navText.includes('Sitemap guide') && !navText.includes('Blog'),
    navText);
  check('hidden links stay in the CMS but leave the footer',
    column3.links.some(l => l.label === 'Blog' && !l.visible) && !navText.includes('Blog'));

  /* column 4: remove a link, save, confirm it is gone */
  const card4 = cards[3];
  click([...card4.querySelectorAll('button')].find(button => button.textContent.trim() === 'Remove'));
  await wait();
  click([...card4.querySelectorAll('button')].find(button => /Save Changes/.test(button.textContent)));
  await wait();
  const stored2 = JSON.parse(w.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('removing a row deletes it from the saved column',
    (stored2.footerColumns?.[3]?.links || []).length === 1 && stored2.footerColumns[3].links[0].label === 'Contact',
    JSON.stringify(stored2.footerColumns?.[3]?.links || []).slice(0, 120));
  dom.window.close();
}

/* 11. a saved footerColumns array is used as-is (fresh state, no migration) */
{
  const state = {
    version: 13,
    settings: {},
    nav: [],
    sections: {},
    tools: [], posts: [], pages: [], seo: {},
    footerColumns: [
      { id: 'c1', title: 'Guides', links: [{ id: 'l1', label: 'How-to hub', href: '/blog', visible: true }, { id: 'l2', label: 'Draft row', href: '/x', visible: false }] },
      { id: 'c2', title: 'Tools', links: [{ id: 'l3', label: 'PDF tools', href: '/free-tools', visible: true }] },
      { id: 'c3', title: 'Company', links: [] },
      { id: 'c4', title: 'More', links: [{ id: 'l4', label: 'Contact us', href: '/contact', visible: true }] },
    ],
  };
  const preload = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(state))});`;
  const { dom, errors } = await boot(preload);
  const footer = dom.window.document.querySelector('footer');
  const navs = [...footer.querySelectorAll('nav')].slice(0, 4);
  check('stored footer columns render with their own headings',
    navs.map(nav => nav.querySelector('h3').textContent).join('|') === 'Guides|Tools|Company|More',
    navs.map(nav => nav.querySelector('h3').textContent).join('|'));
  check('stored columns honour per-link visibility',
    navs[0].textContent.includes('How-to hub') && !navs[0].textContent.includes('Draft row')
    && navs[1].textContent.includes('PDF tools') && navs[3].textContent.includes('Contact us'));
  check('an empty column keeps its heading, so the grid stays four-up', navs[2].querySelector('h3').textContent === 'Company' && navs[2].querySelectorAll('li').length === 0);
  check('custom columns boot with no script errors', errors.length === 0, errors.join(' | '));
  dom.window.close();
}

/* 12. Text Analysis Tools layout: the tool panel spans the full width and the
       sidebar starts level with the About column; other categories keep the
       classic sidebar-beside-panel layout */
{
  const GRID = 'lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]';
  const layout = dom => {
    const doc = dom.window.document;
    const h1 = doc.querySelector('main h1');
    if (!h1) return { kind: 'no-h1' };
    let el = h1.parentElement, h1Grid = null;
    while (el && el.tagName !== 'MAIN') { if (el.className.includes(GRID)) { h1Grid = el; break; } el = el.parentElement; }
    const aside = doc.querySelector('aside');
    let asideGrid = null, a = aside?.parentElement;
    while (a && a.tagName !== 'MAIN') { if (a.className.includes(GRID)) { asideGrid = a; break; } a = a.parentElement; }
    const about = [...doc.querySelectorAll('main h2')].find(h => /^About the /.test(h.textContent.trim()));
    const aboutCol = about ? about.closest('div.min-w-0') : null;
    return { kind: h1Grid ? 'classic' : 'stacked', sharesGrid: !!(asideGrid && aboutCol && asideGrid.contains(aboutCol)), about: !!about };
  };

  const textSlugs = ['grammar-checker', 'plagiarism-checker', 'article-rewriter', 'word-counter', 'spell-checker', 'online-md5-generator', 'case-converter', 'merge-words-online-tool', 'text-to-speech', 'small-text-generator', 'reverse-text-generator'];
  const results12 = [];
  for (const slug of textSlugs) {
    const boot12 = await boot('', `/tool/${slug}`);
    const info = layout(boot12.dom);
    const main = boot12.dom.window.document.querySelector('main');
    results12.push({ slug, ...info, err: boot12.errors.length, h1: main.querySelector('h1')?.textContent?.trim() || '' });
    boot12.dom.window.close();
  }
  check('every Text Analysis Tool is a single-column page with a full-width panel',
    results12.every(r => r.kind === 'stacked' && r.h1), JSON.stringify(results12.map(r => [r.slug, r.kind])).slice(0, 200));
  check('the sidebar starts level with the About column in all of them',
    results12.every(r => r.sharesGrid && r.about), JSON.stringify(results12.filter(r => !r.sharesGrid).map(r => r.slug)));
  check('every Text Analysis Tool page renders without script errors',
    results12.every(r => r.err === 0), JSON.stringify(results12.filter(r => r.err).map(r => r.slug)));

  const otherSlugs = ['merge-pdf', 'website-seo-score-checker', 'meta-tag-generator', 'bmi-calculator'];
  const others = [];
  for (const slug of otherSlugs) {
    const bootOther = await boot('', `/tool/${slug}`);
    others.push({ slug, ...layout(bootOther.dom) });
    bootOther.dom.window.close();
  }
  check('every other category keeps the classic layout',
    others.every(r => r.kind === 'classic'), JSON.stringify(others.map(r => [r.slug, r.kind])));

  // mobile hardening present in the built file
  const compactHtml = rawHtml.replace(/\s+/g, ' ');
  check('text-tool controls are mobile-first in the built file',
    compactHtml.includes('pt-8 sm:pt-10 pb-16 sm:pb-20 px-3 sm:px-4')
    && compactHtml.includes('min-h-[300px] sm:min-h-[420px]')
    && compactHtml.includes('min-h-[300px] sm:min-h-[440px]')
    && compactHtml.includes('w-11 h-11 sm:w-14 sm:h-14')
    && compactHtml.includes('overflow-x-auto border-t border-slate-200 px-3 sm:px-5'));
}

const failed = results.filter(result => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
