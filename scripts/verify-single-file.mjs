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
/* Tool cards are main-area links to a top-level slug — everything the chrome
 * (breadcrumbs, nav, category pages, blog, legal pages) points at is excluded. */
const toolLinks = dom => [...dom.window.document.querySelectorAll('main a[href^="/"]')]
  .filter(a => {
    const h = a.getAttribute('href') || '';
    return h !== '/' && h !== '/free-seo-tools' && !/^\/[a-z-]+-tools$/.test(h)
      && !/^\/(blog|privacy|cookies|terms|about|contact|faq)(\/|$)/.test(h);
  }).map(a => a.getAttribute('href'));
/* Category links, without the "browse all tools" index link. */
const categoryLinks = scope => [...scope.querySelectorAll('a')]
  .map(a => a.getAttribute('href') || '')
  .filter(h => /-tools$/.test(h) && h !== '/free-seo-tools');
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

  const toolsSwap = clickIn('footer', '/free-seo-tools');
  check('footer click on /free-seo-tools updates the URL immediately', toolsSwap.urlNow === '/free-seo-tools', toolsSwap.urlNow);
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
for (const [path, expected] of [['/merge-pdf', 'Merge PDF'], ['/admin-login', 'Admin login'], ['/competitor-analysis', 'Competitor Analysis']]) {
  const { dom, errors } = await boot('', path);
  const mainText = (dom.window.document.querySelector('main').textContent || '').trim();
  check(`${path} renders immediately with no loading state`,
    mainText.includes(expected) && !/Loading (page|PDF engine)/i.test(mainText) && errors.length === 0,
    errors.join(' | ') + ' ' + mainText.slice(0, 60));
  dom.window.close();
}

/* 3b. tool pages answer on /<slug> at the top level (free-seo-tools is gone
      from tool URLs) and every older nesting is normalised to it (the server
      301s them as well) */
{
  const { dom, errors } = await boot('', '/plagiarism-checker');
  const doc = dom.window.document;
  check('a tool page renders on /<slug>',
    errors.length === 0 && /Plagiarism Checker/.test(doc.querySelector('main h1')?.textContent || ''),
    doc.querySelector('main h1')?.textContent || 'no h1');
  check('its canonical tag points at the top-level slug',
    (doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '').endsWith('/plagiarism-checker'),
    doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '');
  const cards = toolLinks(dom);
  check('its related-tool links use top-level slugs too', cards.length > 0, `${cards.length} links`);
  dom.window.close();
}
for (const legacy of ['/free-seo-tools/plagiarism-checker', '/tool/plagiarism-checker', '/free-seo-tool/plagiarism-checker', '/free-tools/grammar-checker']) {
  const { dom } = await boot('', legacy);
  const h1 = dom.window.document.querySelector('main h1')?.textContent?.trim();
  const expected = legacy.replace(/^\/(free-seo-tools|tool|free-tools|free-seo-tool)\//, '/');
  check(`${legacy} normalises to ${expected} and renders the tool`,
    dom.window.location.pathname === expected && !/not found/i.test(h1 || ''),
    `${dom.window.location.pathname} | ${h1}`);
  dom.window.close();
}
for (const bare of ['/free-seo-tool', '/free-seo-tools', '/tools', '/tool', '/free-tools']) {
  const { dom } = await boot('', bare);
  check(`the bare ${bare} path falls back to the tools index`,
    dom.window.location.pathname === '/free-seo-tools',
    dom.window.location.pathname);
  dom.window.close();
}

/* 3b-ii. category pages: ?cat=ip is a real URL /ip-tools */
for (const [slug, label, count] of [['/ip-tools', 'IP Tools', 6], ['/website-checker-tools', 'Website Checker Tools', 24], ['/text-analysis-tools', 'Text Analysis Tools', 11], ['/unit-converter-tools', 'Unit Converter Tools', 10]]) {
  const { dom, errors } = await boot('', slug);
  const doc = dom.window.document;
  const canonical = doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '';
  const cards = toolLinks(dom);
  check(`${slug} is a real page with its own H1 and canonical URL`,
    errors.length === 0
    && (doc.querySelector('main h1')?.textContent || '').trim() === label
    && canonical.endsWith(slug)
    && cards.length === count
    && /Showing \d+ of \d+ tools in /.test(doc.querySelector('main')?.textContent || ''),
    `h1=${(doc.querySelector('main h1')?.textContent || '').trim()} | canonical=${canonical} | cards=${cards.length}`);
  dom.window.close();
}
/* 3b-iii. the tool cards themselves: four columns, 1rem names, 1.35rem
      headings linked to their category page, and a two-line description */
{
  const { dom, errors } = await boot('', '/free-seo-tools');
  const doc = dom.window.document;
  const grids = [...doc.querySelectorAll('main section > div.grid')].map(g => g.className);
  check('the tool grid is four-up on desktop',
    grids.length > 0 && grids.every(c => c.includes('lg:grid-cols-4')), [...new Set(grids)].join(' | '));

  const names = [...doc.querySelectorAll('main section a h3')];
  const heads = [...doc.querySelectorAll('main section h2')];
  check('every tool name is 1rem',
    names.length > 0 && names.every(h => (h.getAttribute('style') || '').includes('font-size: 1rem')),
    [...new Set(names.map(h => h.getAttribute('style')))].join(' | '));
  check('every category heading is 1.35rem and links to its category page',
    heads.length === 11
    && heads.every(h => (h.getAttribute('style') || '').includes('font-size: 1.35rem'))
    && heads.every(h => (h.closest('a')?.getAttribute('href') || '').endsWith('-tools')),
    [...new Set(heads.map(h => h.closest('a')?.getAttribute('href') || 'unlinked'))].join(' '));

  const descriptions = [...doc.querySelectorAll('main section a p')];
  check('every card description is a two-line clamp with a reserved two-line height',
    descriptions.length === names.length
    && descriptions.every(p => /line-clamp-2/.test(p.className) && /min-h-\[2\.5rem\]/.test(p.className)),
    `${descriptions.length} descriptions, ${descriptions.filter(p => /line-clamp-2/.test(p.className)).length} clamped`);
  check('every description is a real, tool-specific, two-line-length sentence',
    descriptions.every(p => p.textContent.trim().length >= 60 && p.textContent.trim().length <= 108)
    && new Set(descriptions.map(p => p.textContent.trim())).size === descriptions.length
    && errors.length === 0,
    descriptions.filter(p => p.textContent.trim().length < 60 || p.textContent.trim().length > 108).map(p => p.textContent).join(' | '));
  dom.window.close();
}
{
  const introOf = doc => [...doc.querySelectorAll('main section > p')]
    .map(p => p.textContent.trim())
    .filter(t => t.length >= 200);
  const { dom, errors } = await boot('', '/free-seo-tools');
  const intros = introOf(dom.window.document);
  check('the index shows a category introduction under every one of the eleven headings',
    intros.length === 11 && new Set(intros).size === 11 && errors.length === 0,
    `${intros.length} intros (${new Set(intros).size} unique)`);
  const ipIntro = intros.find(t => /public IPv4 and IPv6/.test(t)) || '';
  check('the introductions name the tools in that category (not templated)',
    /IPv4 and IPv6/.test(ipIntro) && intros.some(t => /backlink profile/.test(t)) && intros.some(t => /plagiarism and grammar/.test(t)),
    ipIntro.slice(0, 60));
  const { dom: catDom } = await boot('', '/ip-tools');
  const catIntros = introOf(catDom.window.document);
  check('the category page shows its own introduction above the tool cards',
    catIntros.length === 1 && catIntros[0] === ipIntro,
    `${catIntros.length} intros`);
  dom.window.close();
  catDom.window.close();
}

{
  const { dom } = await boot('', '/ip-tools');
  const heads = [...dom.window.document.querySelectorAll('main section h2')];
  check('a category page keeps its own heading unlinked (no self-link)',
    heads.length === 1 && !heads[0].closest('a'),
    `${heads.length} headings, linked=${heads.filter(h => h.closest('a')).length}`);
  dom.window.close();
}

for (const [old, expected] of [['/free-seo-tools?cat=ip', '/ip-tools'], ['/free-tools?cat=checker', '/website-checker-tools'], ['/tools?cat=pdf', '/pdf-tools'], ['/free-seo-tools?cat=management', '/website-management-tools']]) {
  const { dom } = await boot('', old);
  check(`${old} lands on the ${expected} category page`,
    dom.window.location.pathname === expected && dom.window.location.search === '',
    `${dom.window.location.pathname}${dom.window.location.search}`);
  dom.window.close();
}
{
  const { dom } = await boot('', '/free-seo-tools?cat=checker&q=ssl');
  check('a legacy ?cat= filter keeps its search term',
    dom.window.location.pathname === '/website-checker-tools' && dom.window.location.search === '?q=ssl',
    `${dom.window.location.pathname}${dom.window.location.search}`);
  dom.window.close();
}
{
  const { dom } = await boot('', '/website-checker-tools?q=ssl');
  const doc = dom.window.document;
  const reset = [...doc.querySelectorAll('main button')].find(b => /^Show all \d+ tools$/.test(b.textContent.trim()));
  check('searching inside a category page filters that category only',
    /Showing \d+ of \d+ tools in Website Checker Tools/.test(doc.querySelector('main')?.textContent || '') && !!reset,
    (doc.querySelector('main p')?.textContent || '').slice(0, 80));
  reset?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 120));
  check('"Show all N tools" leaves the category page for the index',
    dom.window.location.pathname === '/free-seo-tools' && dom.window.location.search === '',
    `${dom.window.location.pathname}${dom.window.location.search}`);
  dom.window.close();
}

/* 3c. Merge PDF page loads with its drop zone, and the built file ships the
      optional "Compress more" step for the merge result */
{
  const { dom, errors } = await boot('', '/merge-pdf');
  const doc = dom.window.document;
  const text = doc.querySelector('main')?.textContent || '';
  check('Merge PDF renders its drop zone on the new URL',
    errors.length === 0 && /Select PDF files to merge/.test(text) && /100% private/.test(text));
  check('the merge page still renders its guide',
    /How it works/.test(text) && /Frequently asked questions/.test(text));
  const built = rawHtml;
  check('the built file ships the optional compressor for merge results',
    built.includes('Compress more')
    && built.includes('Use compressed file')
    && built.includes('Or target size')
    && ['Lossless', 'Balanced', 'Strong', 'Extreme'].every(l => built.includes(l))
    && built.includes('merged-compressed.pdf'));
  dom.window.close();
}

/* 3d. blog categories: a Blog Categories section on /blog that links to real
      /blog/category/<slug> pages, and the admin section that manages them */
{
  const { dom, errors } = await boot('', '/blog');
  const doc = dom.window.document;
  const section = doc.querySelector('section[aria-label="Blog Categories"]');
  const links = [...(section?.querySelectorAll('a') || [])];
  check('the blog page shows a Blog Categories section linking to category pages',
    !!section && links.length === 4
    && links.every(a => /^\/blog\/category\/[a-z-]+$/.test(a.getAttribute('href') || ''))
    && errors.length === 0,
    links.map(a => a.getAttribute('href')).join(' | '));
  check('each category link shows its live article count',
    links.every(a => /\d+ articles?/.test(a.textContent)), links.map(a => a.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
  dom.window.close();
}
for (const [slug, name, count] of [['core-web-vitals', 'Core Web Vitals', 3], ['pagespeed', 'PageSpeed', 3], ['wordpress-seo', 'WordPress SEO', 3], ['google-indexing', 'Google & Indexing', 3]]) {
  const { dom, errors } = await boot('', `/blog/category/${slug}`);
  const doc = dom.window.document;
  const cards = [...doc.querySelectorAll('main article')];
  check(`/blog/category/${slug} lists only its own ${count} articles`,
    errors.length === 0
    && (doc.querySelector('main h1')?.textContent || '').trim() === `${name} articles`
    && cards.length === count
    && (doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '').endsWith(`/blog/category/${slug}`),
    `h1=${(doc.querySelector('main h1')?.textContent || '').trim()} cards=${cards.length} canonical=${doc.querySelector('link[rel=canonical]')?.getAttribute('href')}`);
  dom.window.close();
}
{
  const { dom } = await boot('', '/blog/category/not-a-category');
  check('an unknown category URL shows a not-found page with noindex',
    /Category not found/.test(dom.window.document.querySelector('main h1')?.textContent || '')
    && /noindex/.test(dom.window.document.querySelector('meta[name=robots]')?.getAttribute('content') || ''));
  dom.window.close();
}
{
  const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
  const { dom, errors } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const doc = dom.window.document;
  const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const setValue = (el, value) => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  click([...doc.querySelectorAll('button')].find(b => b.textContent.trim() === 'Blog posts'));
  await wait();
  check('admin boots the Blog posts tab with no script errors', errors.length === 0, errors.join(' | '));

  const section = doc.querySelector('section[aria-label="Blog Categories"]');
  const rows = () => [...(section?.querySelectorAll('p.font-semibold') || [])].map(p => p.textContent.trim());
  check('the Blog Categories section is next to the post list and lists the four categories',
    !!section && rows().join(', ') === 'Core Web Vitals, PageSpeed, WordPress SEO, Google & Indexing'
    && (section.textContent || '').includes('4 categories'),
    rows().join(', '));
  check('each row carries the slug, the post count and its actions',
    !!(section.textContent || '').includes('/blog/category/core-web-vitals')
    && /3\s*posts?/.test((section.textContent || '').replace(/\s+/g, ' '))
    && [...section.querySelectorAll('strong')].filter(el => el.textContent.trim() === '3').length === 4
    && ['Hide', 'Edit', 'Remove'].every(label => [...section.querySelectorAll('button')].some(b => b.textContent.trim() === label)));

  const nameInput = section.querySelector('input[aria-label="Category Name"]');
  const slugInput = section.querySelector('input[aria-label="Category Slug"]');
  setValue(nameInput, 'SEO Tips');
  await wait();
  check('the slug auto-generates from the name and stays editable',
    slugInput.value === 'seo-tips' && !slugInput.readOnly && !slugInput.disabled, slugInput.value);
  setValue(slugInput, 'seo-tips');
  await wait();
  const addButton = [...section.querySelectorAll('button')].find(b => /Add category/.test(b.textContent));
  click(addButton);
  await wait();
  check('adding a category saves it and shows "Saved ✓"',
    addButton.textContent.includes('Saved ✓')
    && rows().join(', ') === 'Core Web Vitals, PageSpeed, WordPress SEO, Google & Indexing, SEO Tips',
    `${addButton.textContent} | ${rows().join(', ')}`);
  const stored = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('the new category is persisted in the CMS store',
    ((stored.blogCategories || []).find(c => c.slug === 'seo-tips') || {}).name === 'SEO Tips',
    JSON.stringify((stored.blogCategories || []).map(c => c.slug)));

  const seoTipsRow = [...section.querySelectorAll('div')].find(div => (div.textContent || '').trim().startsWith('SEO Tips'));
  click([...seoTipsRow.querySelectorAll('button')].find(b => b.textContent.trim() === 'Hide'));
  await wait();
  const stored2 = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('hiding a category persists its visible flag',
    ((stored2.blogCategories || []).find(c => c.slug === 'seo-tips') || {}).visible === false,
    JSON.stringify((stored2.blogCategories || []).find(c => c.slug === 'seo-tips')));
  dom.window.close();
}
{
  const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
  const { dom } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const doc = dom.window.document;
  const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  click([...doc.querySelectorAll('button')].find(b => b.textContent.trim() === 'Blog posts'));
  await wait();
  const editButtons = [...doc.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit');
  click(editButtons[editButtons.length - 1]);
  await wait();
  const select = doc.querySelector('select[aria-label="Assign Category"]');
  const options = [...(select?.options || [])].map(o => o.value);
  check('the post editor has an Assign Category dropdown with every category',
    !!select
    && ['Core Web Vitals', 'PageSpeed', 'WordPress SEO', 'Google & Indexing'].every(name => options.includes(name))
    && options.includes('Uncategorized')
    && options.includes('__new__'),
    options.join(', '));
  check('the dropdown shows the post\'s own category as selected',
    (select?.value || '').length > 0 && options.includes(select.value), select?.value);
  dom.window.close();
}
{
  // Removing a category keeps its posts: they move to Uncategorized.
  const state = {
    version: 13,
    blogCategories: [{ id: 'b1', name: 'Core Web Vitals', slug: 'core-web-vitals', visible: true }],
    posts: [{ slug: 'p1', title: 'Kept post', metaTitle: 'Kept post', metaDescription: '', excerpt: '', content: '<p>x</p>', category: 'Core Web Vitals', date: '2026-01-01', readTime: '5 min read', author: 'A', keywords: [], status: 'live', builtin: false }],
    pages: [], tools: [], seo: {}, footerColumns: [], nav: [], sections: {}, sidebar: {},
  };
  const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
  const preload = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(state))});`
    + `localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`;
  const { dom } = await boot(preload, '/admin');
  const doc = dom.window.document;
  const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const originalConfirm = dom.window.confirm;
  dom.window.confirm = () => true;
  click([...doc.querySelectorAll('button')].find(b => b.textContent.trim() === 'Blog posts'));
  await wait();
  const section = doc.querySelector('section[aria-label="Blog Categories"]');
  click([...section.querySelectorAll('button')].find(b => b.textContent.trim() === 'Remove'));
  await wait();
  const stored = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('removing a category keeps its posts and marks them Uncategorized',
    (stored.blogCategories || []).length === 0 && (stored.posts || [])[0]?.category === 'Uncategorized',
    JSON.stringify({ cats: (stored.blogCategories || []).length, category: (stored.posts || [])[0]?.category }));
  dom.window.confirm = originalConfirm;
  dom.window.close();
}
{
  // A hidden category disappears from /blog and its page is not available.
  const state = {
    version: 13,
    blogCategories: [
      { id: 'b1', name: 'Core Web Vitals', slug: 'core-web-vitals', visible: true },
      { id: 'b2', name: 'Secret Category', slug: 'secret-category', visible: false },
    ],
    posts: [], pages: [], tools: [], seo: {}, footerColumns: [], nav: [], sections: {}, sidebar: {},
  };
  const preload = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(state))});`;
  const { dom } = await boot(preload, '/blog');
  const links = [...dom.window.document.querySelectorAll('section[aria-label="Blog Categories"] a')].map(a => a.getAttribute('href'));
  check('a hidden category is left out of the public Blog Categories section',
    links.length === 1 && links[0] === '/blog/category/core-web-vitals', links.join(' | '));
  dom.window.close();
  const hidden = await boot(preload, '/blog/category/secret-category');
  check('a hidden category page is not available',
    /Category not found/.test(hidden.dom.window.document.querySelector('main h1')?.textContent || ''));
  hidden.dom.window.close();
}

/* 4. legacy tools URLs — /tools, /tool, /free-tools and /free-seo-tool — are all
      normalised to the canonical /free-seo-tools client-side */
for (const legacy of ['/tools', '/tool', '/free-tools', '/free-seo-tool']) {
  const { dom, errors } = await boot('', legacy);
  check(`legacy ${legacy} boot has no script errors`, errors.length === 0, errors.join(' | '));
  check(`${legacy} normalises to /free-seo-tools`, dom.window.location.pathname === '/free-seo-tools', dom.window.location.pathname);
  check('tools page renders its heading', /Tools/.test(dom.window.document.querySelector('h1')?.textContent || ''));
  dom.window.close();
}
{
  const { dom } = await boot('', '/free-tools?q=pdf');
  check('a search-only old URL keeps its query string on the index',
    dom.window.location.pathname === '/free-seo-tools' && dom.window.location.search === '?q=pdf',
    `${dom.window.location.pathname}${dom.window.location.search}`);
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
      { id: 'c2', title: 'Tools', links: [{ id: 'l3', label: 'PDF tools', href: '/free-seo-tools', visible: true }] },
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
    const boot12 = await boot('', `/${slug}`);
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
    const bootOther = await boot('', `/${slug}`);
    others.push({ slug, ...layout(bootOther.dom) });
    bootOther.dom.window.close();
  }
  check('every other category keeps the classic layout',
    others.every(r => r.kind === 'classic'), JSON.stringify(others.map(r => [r.slug, r.kind])));

  // "Tool Categories" mega menu in the top navigation
  {
    const bootNav = await boot('', '/');
    const doc = bootNav.dom.window.document;
    const nav = doc.querySelector('nav.fixed');
    const trigger = [...nav.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Tool Categories'));
    check('top nav shows the Tool Categories trigger', !!trigger && trigger.getAttribute('aria-expanded') === 'false',
      `trigger=${!!trigger}`);
    trigger?.dispatchEvent(new bootNav.dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const panel = doc.getElementById('tool-categories-menu');
    const links = [...(panel?.querySelectorAll('a') || [])];
    const categories = links.filter(a => categoryLinks({ querySelectorAll: () => [a] }).length === 1);
    const expected = [
      'Text Analysis Tools (11)', 'Keyword Tools (8)', 'Backlink Tools (8)', 'Calculator Tools (14)',
      'Website Management Tools (45)', 'Website Checker Tools (24)', 'Domain Tools (8)', 'Unit Converter Tools (10)',
      'IP Tools (6)', 'PDF Tools (18)', 'Image Tools (3)',
    ];
    check('menu opens and lists all eleven categories with live counts',
      trigger?.getAttribute('aria-expanded') === 'true' && !panel?.className.includes('hidden')
      && categories.length === 11
      && JSON.stringify(categories.map(a => a.textContent.replace(/\s+/g, ' ').trim())) === JSON.stringify(expected),
      `${categories.length} category links: ${categories.map(a => a.textContent.replace(/\s+/g, ' ').trim()).join(' | ')}`);
    check('each category links to its own page',
      JSON.stringify(categories.map(a => a.getAttribute('href'))) === JSON.stringify(['/text-analysis-tools', '/keyword-tools', '/backlink-tools', '/calculator-tools', '/website-management-tools', '/website-checker-tools', '/domain-tools', '/unit-converter-tools', '/ip-tools', '/pdf-tools', '/image-tools']),
      categories.map(a => a.getAttribute('href')).join(' | '));
    check('panel carries no heading of its own',
      (panel?.querySelectorAll('h1, h2, h3, h4, h5, h6').length || 0) === 0
      && !(panel?.textContent || '').includes('Tool Categories'),
      `headings=${panel?.querySelectorAll('h1, h2, h3, h4, h5, h6').length}`);
    check('panel is a fixed mega panel under the 4rem nav', /fixed left-0 right-0 top-16 z-50/.test(panel?.className || ''));

    // clicking a category opens its own page in the same task
    const checker = categories.find(a => a.getAttribute('href') === '/website-checker-tools');
    checker?.dispatchEvent(new bootNav.dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 120));
    const status = [...doc.querySelectorAll('main p')].find(p => /Showing/.test(p.textContent));
    const catCards = toolLinks(bootNav.dom);
    check('clicking a category opens the category page in the same task',
      bootNav.dom.window.location.pathname === '/website-checker-tools' && bootNav.dom.window.location.search === ''
      && catCards.length === 24
      && /Showing 24 of \d+ tools in Website Checker Tools/.test(status?.textContent || ''),
      `${bootNav.dom.window.location.pathname}${bootNav.dom.window.location.search}, tools=${catCards.length}, status=${status?.textContent.replace(/\s+/g, ' ').trim()}`);
    check('the menu closes once a category is chosen', doc.getElementById('tool-categories-menu')?.className.includes('hidden'));
    bootNav.dom.window.close();
  }

  // /free-seo-tools: no category filter chips, hero band like the home page
  {
    const bootTools = await boot('', '/free-seo-tools');
    const doc = bootTools.dom.window.document;
    const chips = [...doc.querySelectorAll('main button')].filter(b => /^(All Tools|Text Analysis|Keyword|Backlink|Website |Domain|Unit Converter|Calculator|PDF|Image|IP) \(\d+\)$/.test(b.textContent.trim()));
    const hero = [...doc.querySelectorAll('main section')].find(s => /from-indigo-100/.test(s.className));
    check('the tools page has no category filter chips',
      chips.length === 0 && doc.querySelectorAll('main button[aria-pressed]').length === 0,
      `${chips.length} chips: ${chips.map(b => b.textContent.trim()).join(', ')}`);
    check('the tools page hero uses the home-page gradient band',
      /bg-gradient-to-br from-indigo-100 via-violet-50 to-purple-100/.test(hero?.className || '')
      && !!hero?.querySelector('h1') && !!hero?.querySelector('input[type="search"]'),
      hero?.className || 'no hero band');
    check('every category section heading is still rendered',
      [...doc.querySelectorAll('main h2')].length === 11,
      `${doc.querySelectorAll('main h2').length} headings`);
    bootTools.dom.window.close();
  }

  // filtered arrival (e.g. from the nav mega menu) offers a way back to all tools
  {
    const bootFiltered = await boot('', '/free-seo-tools?cat=pdf');
    const doc = bootFiltered.dom.window.document;
    const reset = [...doc.querySelectorAll('main button')].find(b => /^Show all \d+ tools$/.test(b.textContent.trim()));
    const pdfCards = toolLinks(bootFiltered.dom);
    check('a legacy ?cat= URL opens the category page with "Show all" to clear it',
      bootFiltered.dom.window.location.pathname === '/pdf-tools' && !!reset && pdfCards.length === 18,
      `path=${bootFiltered.dom.window.location.pathname}, reset=${!!reset}, cards=${pdfCards.length}`);
    bootFiltered.dom.window.close();
  }

  // top-nav text weight: selected items are indigo but never bold
  {
    const bootNavWeight = await boot('', '/free-seo-tools');
    const doc = bootNavWeight.dom.window.document;
    const navLinks = [...doc.querySelectorAll('nav.fixed a, nav.fixed button')];
    const bold = navLinks.filter(el => /font-(semibold|bold|extrabold|black)/.test(el.className));
    const selected = navLinks.filter(el => /text-indigo-600/.test(el.className) && !/hover:text-indigo-600/.test(el.className.replace(/hover:text-indigo-600/g, 'HOVER')));
    check('no top-nav link turns bold, on hover or when selected',
      bold.length === 0,
      `bold nav items: ${bold.map(el => el.textContent.trim()).join(', ')}`);
    check('the selected nav item is still marked with indigo text',
      selected.length > 0,
      `selected: ${selected.map(el => el.textContent.trim()).join(', ')}`);
    bootNavWeight.dom.window.close();
  }

  // same categories inside the mobile burger menu
  {
    const bootMobile = await boot('', '/');
    const doc = bootMobile.dom.window.document;
    const burger = doc.querySelector('nav.fixed button[aria-controls="site-mobile-menu"]');
    burger?.dispatchEvent(new bootMobile.dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const trigger = [...doc.querySelectorAll('#site-mobile-menu button')].find(b => b.textContent.trim().startsWith('Tool Categories'));
    trigger?.dispatchEvent(new bootMobile.dom.window.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const links = categoryLinks(doc.getElementById('tool-categories-mobile') || doc);
    check('mobile burger menu lists the same eleven categories', !!trigger && links.length === 11,
      `${links.length} links`);
    bootMobile.dom.window.close();
  }

  // Case Converter: the eight dark result cards form a two-column grid
  {
    const bootCase = await boot('', '/case-converter');
    const doc = bootCase.dom.window.document;
    const darkCards = [...doc.querySelectorAll('main div.bg-slate-900')];
    const grid = darkCards[0]?.parentElement;
    check('case converter renders its results as a two-column grid',
      darkCards.length === 8 && /grid grid-cols-1 sm:grid-cols-2 gap-3/.test(grid?.className || ''),
      `${darkCards.length} cards, parent="${grid?.className}"`);
    bootCase.dom.window.close();
  }

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
