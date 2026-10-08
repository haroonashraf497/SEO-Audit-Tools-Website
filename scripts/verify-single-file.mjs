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

/* 3d. blog categories: the /blog/category/<slug> pages stay, the Blog
      Categories card section no longer appears on the blog index */
{
  const { dom, errors } = await boot('', '/blog');
  const doc = dom.window.document;
  const tabs = [...doc.querySelectorAll('main [role="tab"]')].map(t => t.textContent.trim());
  check('the blog index no longer shows the Blog Categories section',
    !doc.querySelector('section[aria-label="Blog Categories"]')
    && !/Blog Categories/.test(doc.querySelector('main')?.textContent || '')
    && errors.length === 0,
    (doc.querySelector('main')?.textContent || '').includes('Blog Categories') ? 'section still present' : 'removed');
  check('the blog index still filters by category, and every tab shows its article count',
    tabs.map(t => t.replace(/\s+\d+$/, '')).join(', ') === 'All, Core Web Vitals, PageSpeed, WordPress SEO, Google & Indexing, Website Health'
    && tabs.join(', ') === 'All 13, Core Web Vitals 3, PageSpeed 3, WordPress SEO 3, Google & Indexing 3, Website Health 1',
    tabs.join(', '));
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
/* The Website Health category is published on its own top-level URL, which is
   also its canonical; the /blog/category/<slug> spelling still renders it. */
for (const route of ['/website-health', '/blog/category/website-health']) {
  const { dom, errors } = await boot('', route);
  const doc = dom.window.document;
  const cards = [...doc.querySelectorAll('main article')];
  check(`${route} lists the Website Health article and keeps /website-health canonical`,
    errors.length === 0
    && (doc.querySelector('main h1')?.textContent || '').trim() === 'Website Health articles'
    && cards.length === 1
    && (doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '').endsWith('/website-health')
    && /Website Health/.test(doc.querySelector('main')?.textContent || ''),
    `h1=${(doc.querySelector('main h1')?.textContent || '').trim()} cards=${cards.length} canonical=${doc.querySelector('link[rel=canonical]')?.getAttribute('href')}`);
  dom.window.close();
}
{
  const { dom, errors } = await boot('', '/blog/website-health-guide');
  const doc = dom.window.document;
  const pill = [...doc.querySelectorAll('main article header a')].find(a => (a.textContent || '').trim() === 'Website Health');
  check('the article byline pill links to the top-level category URL',
    errors.length === 0
    && !!pill && pill.getAttribute('href') === '/website-health',
    pill ? pill.getAttribute('href') : 'no Website Health pill');
  dom.window.close();
}
{
  const { dom } = await boot('', '/blog/category/not-a-category');
  check('an unknown category URL shows a not-found page with noindex',
    /Category not found/.test(dom.window.document.querySelector('main h1')?.textContent || '')
    && /noindex/.test(dom.window.document.querySelector('meta[name=robots]')?.getAttribute('content') || ''));
  dom.window.close();
}

/* 3e. the single article byline: SAT Team with the date under it, the read
      time in front of it and the category pill at the right of the same row */
{
  const { dom, errors } = await boot('', '/blog/google-not-indexing-pages');
  const doc = dom.window.document;
  const header = doc.querySelector('main article header');
  const h1 = header?.querySelector('h1');
  const row = header?.querySelector('div.flex-wrap');
  const kids = row ? [...row.children] : [];
  const name = row?.querySelector('p.font-semibold');
  const time = row?.querySelector('time');
  const divider = kids.findIndex(k => k.tagName === 'SPAN' && /(^|\s)w-px(\s|$)/.test(k.className));
  const readIdx = kids.findIndex(k => /7 min read/.test(k.textContent));
  const last = kids[kids.length - 1];
  check('the article header starts with its title — no badge or date row above it',
    !!h1 && header.firstElementChild === h1 && !/^(Core Web Vitals|PageSpeed|WordPress SEO|Google & Indexing|Website Health)$/.test((header.firstElementChild?.textContent || '').trim()),
    `first=${header?.firstElementChild?.tagName} h1=${(h1?.textContent || '').slice(0, 40)}`);
  check('the byline names the SAT Team with the article date underneath',
    (name?.textContent || '').trim() === 'SAT Team' && !!time
    && time.getAttribute('datetime') === '2025-01-22' && /22 Jan 2025/.test(time.textContent)
    && !!name.parentElement && name.parentElement.contains(time)
    && row.contains(name) && name.compareDocumentPosition(time) === 4,
    `${(name?.textContent || '').trim()} | ${(time?.textContent || '').trim()}`);
  check('the read time sits in front of the byline, after a divider',
    divider > -1 && readIdx === divider + 1 && /7 min read/.test(kids[readIdx]?.textContent || ''),
    `divider=${divider} read=${readIdx}`);
  check('the category pill closes the byline row on the right and links to its category page',
    !!last && /(^|\s)ml-auto(\s|$)/.test(last.className)
    && !!last.querySelector('a[href="/blog/category/google-indexing"]')
    && last.textContent.trim() === 'Google & Indexing'
    && errors.length === 0,
    `${last?.className} | ${last?.textContent?.trim()} | ${errors.join(' | ')}`);
  dom.window.close();
}

/* 3g. the single article sidebar: search bar, Latest Articles, Other Relevant
      Tools — and every article title shown in full */
{
  const { dom, errors } = await boot('', '/blog/google-not-indexing-pages');
  const doc = dom.window.document;
  const aside = doc.querySelector('aside');
  const panelTitle = el => (el.querySelector('h3')?.textContent || '').trim();
  const panels = [...aside.children];
  check('the article sidebar starts with the search bar, then Latest Articles, then Other Relevant Tools',
    !!panels[0]?.querySelector('input[aria-label="Search tools"]')
    && panelTitle(panels[1]) === 'Latest Articles'
    && panelTitle(panels[2]) === 'Other Relevant Tools'
    && errors.length === 0,
    panels.map(el => panelTitle(el) || (el.querySelector('input') ? 'search' : '?')).join(' | '));
  check('Latest Articles is not the last panel and the CTA still closes the sidebar',
    panelTitle(panels[panels.length - 1]) === '' && !/Latest Articles/.test(panels[panels.length - 1].textContent)
    && panels.filter(el => panelTitle(el) === 'Latest Articles').length === 1);
  check('the latest-articles list shows every article with its full title',
    panels[1].querySelectorAll('li').length === 6
    && [...panels[1].querySelectorAll('li a span.flex-1')].every(span =>
      !/truncate|line-clamp/.test(span.className) && /break-words/.test(span.className))
    && [...panels[1].querySelectorAll('li a span.flex-1')].some(span => span.textContent.trim() === 'INP Is the Core Web Vital Nobody Prepared For (Here\u2019s How to Fix It)'),
    [...panels[1].querySelectorAll('li a span.flex-1')].map(span => span.textContent.trim()).join(' || ').slice(0, 120));
  check('article titles wrap onto a second line instead of being ellipsised',
    /\.break-words\{overflow-wrap:break-word\}/.test(rawHtml.replace(/\s+/g, ''))
    && [...panels[1].querySelectorAll('li a span')].every(span => !/truncate|line-clamp/.test(span.className))
    && [...panels[1].querySelectorAll('li a span.flex-1')].every(span => /break-words/.test(span.className)),
    [...panels[1].querySelectorAll('li a span.flex-1')].map(span => span.className).join(' | '));
  dom.window.close();
}
{
  const { dom } = await boot('', '/blog');
  const titles = [...dom.window.document.querySelectorAll('aside > div')].map(el => (el.querySelector('h3')?.textContent || '').trim() || (el.querySelector('input') ? 'search' : 'cta'));
  check('the blog listing sidebar keeps its original order',
    titles.join(' | ') === 'search | Other Relevant Tools | Popular SEO Tools | Latest Articles | cta',
    titles.join(' | '));
  dom.window.close();
}
{
  const { dom } = await boot('', '/plagiarism-checker');
  const titles = [...dom.window.document.querySelectorAll('aside > div')].map(el => (el.querySelector('h3')?.textContent || '').trim() || (el.querySelector('input') ? 'search' : 'cta'));
  check('tool pages keep their sidebar order too',
    titles.join(' | ') === 'search | Other Relevant Tools | Popular SEO Tools | Latest Articles | cta',
    titles.join(' | '));
  dom.window.close();
}

/* 3g. heading pattern: one h1 per page, no skipped levels, no h2 that just
      repeats the h1 — the structure search engines read */
{
  const routes = ['/', '/plagiarism-checker', '/merge-pdf', '/compress-pdf', '/free-seo-tools', '/ip-tools',
    '/website-management-tools', '/blog', '/blog/google-not-indexing-pages', '/blog/category/google-indexing',
    '/blog/website-health-guide', '/website-health',
    '/competitor-analysis', '/about', '/privacy-policy', '/terms-of-service', '/contact', '/faq', '/nope-404'];
  const bad = { h1: [], first: [], skip: [], dup: [] };
  for (const route of routes) {
    const { dom } = await boot('', route);
    const heads = [...dom.window.document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')];
    const h1s = heads.filter(h => h.tagName === 'H1');
    if (h1s.length !== 1) bad.h1.push(`${route}(${h1s.length})`);
    if (heads[0] && heads[0].tagName !== 'H1') bad.first.push(`${route}:${heads[0].tagName}`);
    let prev = 0;
    for (const h of heads) {
      const lvl = Number(h.tagName[1]);
      if (prev && lvl > prev + 1) bad.skip.push(`${route} ${prev}->${lvl} "${(h.textContent || '').trim().slice(0, 20)}"`);
      prev = lvl;
    }
    const h1Text = (h1s[0]?.textContent || '').trim().toLowerCase();
    if (heads.some(h => h.tagName === 'H2' && (h.textContent || '').trim().toLowerCase() === h1Text)) bad.dup.push(route);
    dom.window.close();
  }
  check('every page has exactly one h1', bad.h1.length === 0, bad.h1.join(' | '));
  check('the h1 is the first heading on every page', bad.first.length === 0, bad.first.join(' | '));
  check('no page skips a heading level (h1 → h2 → h3 …)', bad.skip.length === 0, bad.skip.join(' | '));
  check('no page repeats its h1 text as an h2', bad.dup.length === 0, bad.dup.join(' | '));
}
{
  const { dom } = await boot('', '/');
  const h1 = dom.window.document.querySelector('main h1');
  const flatCss = rawHtml.replace(/\s+/g, '');
  check('the home h1 takes the global h1 scale and the trusted-by line is gone',
    (h1?.textContent || '').replace(/\s+/g, ' ').trim() === 'Free SEO Audit Tool'
    && !/(^|\s)text-\[3rem\](\s|$)/.test(h1?.className || '')
    && !/(^|\s)(?:sm:|md:|lg:|xl:)?text-(?:xs|sm|base|lg|xl|[2-9]xl|\[)/.test(h1?.className || '')
    && /--heading-h1:2\.625rem/.test(flatCss)
    && /main:not\(\.admin-shell\)h1:not\(\.heading-card\)\{font-size:var\(--heading-h1\)\}/.test(flatCss)
    && !/Trusted by/.test(dom.window.document.querySelector('main')?.textContent || ''),
    `${h1?.className} | trusted-by=${/Trusted by/.test(dom.window.document.body.textContent || '')}`);
  const hero = dom.window.document.querySelector('main section');
  const heroClass = hero?.getAttribute('class') || '';
  const heroHeader = hero?.querySelector('header');
  check('the home hero band keeps equal space above and below its content',
    /(^|\s)py-16(\s|$)/.test(heroClass) && /(^|\s)md:py-20(\s|$)/.test(heroClass)
    && !/(^|\s)pt-16(\s|$)/.test(heroClass) && !/(^|\s)pb-20(\s|$)/.test(heroClass)
    && !/(^|\s)mb-/.test(heroHeader?.getAttribute('class') || '')
    && /\.py-16\{padding-block:calc\(var\(--spacing\)\*16\)\}/.test(flatCss)
    && /\.md\\:py-20\{padding-block:calc\(var\(--spacing\)\*20\)\}/.test(flatCss),
    `${heroClass} | header=${heroHeader?.getAttribute('class')}`);
  check('the built page ships the 42/34/28/24/20/18px desktop heading scale',
    ['h1:2.625rem', 'h2:2.125rem', 'h3:1.75rem', 'h4:1.5rem', 'h5:1.25rem', 'h6:1.125rem']
      .every(step => flatCss.includes(`--heading-${step}`)));
  check('tablet and mobile steps are shipped too',
    flatCss.includes('--heading-h1:2.25rem') && flatCss.includes('--heading-h1:1.875rem')
    && flatCss.includes('--heading-h2:1.875rem') && flatCss.includes('--heading-h2:1.625rem'));
  check('every heading level is wired to the scale (admin dashboard excluded)',
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].every(tag =>
      flatCss.includes(`main:not(.admin-shell)${tag}:not(.heading-card){font-size:var(--heading-${tag})}`)));
  check('h1-h6 letter-spacing is normal and no artificial tracking is shipped',
    /main:not\(\.admin-shell\)h1:not\(\.heading-card\),[\s\S]{0,400}\{letter-spacing:normal\}/.test(flatCss)
    && !/\.rich-text h[1-6]\{[^}]*04em/.test(flatCss));
  const headings = [...dom.window.document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')];
  const oversized = headings.filter(h => /(?:^|\s)(?:sm:|md:|lg:|xl:)?text-(?:xs|sm|base|lg|xl|[2-9]xl|\[)/
    .test(h.getAttribute('class') || '') && !/heading-card/.test(h.getAttribute('class') || ''));
  check('no rendered heading carries a page-specific size utility or inline font-size',
    headings.length > 0 && oversized.length === 0,
    oversized.map(h => `${h.tagName}:${h.getAttribute('class')}`).join(' | '));
  check('no rendered heading uses tracking utilities outside the component opt-out',
    headings.every(h => !/tracking-/.test(h.getAttribute('class') || '') || /heading-card/.test(h.getAttribute('class') || '')));
  const footerHeads = [...dom.window.document.querySelectorAll('footer h3')];
  check('the footer column headings keep their component spec (18px / capitalize / 0 letter-spacing)',
    footerHeads.length === 4 && footerHeads.every(h => /heading-card/.test(h.getAttribute('class') || '')
      && /text-\[18px\]/.test(h.getAttribute('class') || '') && /capitalize/.test(h.getAttribute('class') || '')
      && /tracking-\[0px\]/.test(h.getAttribute('class') || '')),
    footerHeads.map(h => h.getAttribute('class')).join(' | '));
  check('the rest of the hero still renders (subtitle, form, button)',
    /Analyze your website's SEO performance/.test(dom.window.document.querySelector('main')?.textContent || '')
    && !!dom.window.document.querySelector('main input[type="url"], main input[placeholder*="example"]'));
  dom.window.close();
}
{
  const blog = await boot('', '/blog');
  const cards = [...blog.dom.window.document.querySelectorAll('main article')];
  check('blog cards are h2 under the page h1, so the outline never jumps to h3',
    cards.length === 13 && cards.every(card => !!card.querySelector('h2') && !card.querySelector('h3')),
    cards.map(card => card.querySelector('h2,h3')?.tagName || 'none').join(' '));
  blog.dom.window.close();
  const cat = await boot('', '/blog/category/google-indexing');
  check('blog category pages use the same h2 cards',
    [...cat.dom.window.document.querySelectorAll('main article')].every(card => !!card.querySelector('h2') && !card.querySelector('h3')));
  cat.dom.window.close();
  const article = await boot('', '/blog/google-not-indexing-pages');
  const related = [...article.dom.window.document.querySelectorAll('main h2')].some(h => h.textContent.trim() === 'Keep reading');
  check('the related list on an article keeps h3 cards under its h2',
    related && [...article.dom.window.document.querySelectorAll('main article')].every(card => !!card.querySelector('h3')),
    [...article.dom.window.document.querySelectorAll('main article')].length + ' related cards');
  article.dom.window.close();
}
{
  const { dom } = await boot('', '/ip-tools');
  const doc = dom.window.document;
  check('a category page labels its list ("All IP Tools") instead of repeating the h1',
    (doc.querySelector('main h1')?.textContent || '').trim() === 'IP Tools'
    && [...doc.querySelectorAll('main h2')].some(h => h.textContent.trim() === 'All IP Tools')
    && [...doc.querySelectorAll('main h3')].length === 6,
    [...doc.querySelectorAll('main h1, main h2')].map(h => `${h.tagName}:${h.textContent.trim()}`).join(' | '));
  dom.window.close();
}
{
  const { dom } = await boot('', '/merge-pdf');
  const heads = [...dom.window.document.querySelectorAll('main h1, main h2')].map(h => `${h.tagName}:${h.textContent.trim().slice(0, 40)}`);
  check('the PDF guide sections are h2, so the tool pages keep a clean outline',
    heads[0] === 'H1:Merge PDF' && heads[1] === 'H2:How it works'
    && (heads[2] || '').startsWith('H2:Frequently asked questions'),
    heads.slice(0, 4).join(' | '));
  const h1Class = dom.window.document.querySelector('main h1')?.getAttribute('class') || '';
  check('the tool page h1 is capitalised, not uppercase',
    /(^|\s)tool-page-title(\s|$)/.test(h1Class) && !/(^|\s)uppercase(\s|$)/.test(h1Class)
    && /\.tool-page-title\{text-transform:capitalize\}/.test(rawHtml.replace(/\s+/g, '')),
    h1Class);
  const capitalised = [];
  for (const path of ['/merge-pdf', '/word-counter', '/plagiarism-checker', '/robots-txt-generator', '/compress-pdf']) {
    const routed = await boot('', path);
    const h = routed.dom.window.document.querySelector('main h1');
    const cls = h?.getAttribute('class') || '';
    capitalised.push(`${path}:${/(^|\s)tool-page-title(\s|$)/.test(cls) && !/(^|\s)uppercase(\s|$)/.test(cls)}`);
    routed.dom.window.close();
  }
  check('every ordinary tool route renders a capitalised title',
    capitalised.length === 5 && capitalised.every(entry => entry.endsWith(':true')),
    capitalised.join(' '));
  const indexH1 = [];
  for (const path of ['/free-seo-tools', '/ip-tools', '/pdf-tools']) {
    const routed = await boot('', path);
    indexH1.push(`${path}:${/(^|\s)capitalize(\s|$)/.test(routed.dom.window.document.querySelector('main h1')?.getAttribute('class') || '')}`);
    routed.dom.window.close();
  }
  check('the tools index and the category page h1s are capitalised too',
    indexH1.length === 3 && indexH1.every(entry => entry.endsWith(':true')),
    indexH1.join(' '));
  const pillTexts = [...dom.window.document.querySelectorAll('main span, main p, main div')]
    .map(el => (el.textContent || '').trim())
    .filter(text => /^Instant · runs in your browser$/.test(text) || /^Instant$/.test(text));
  check('no green "Instant · runs in your browser" pill sits above the tool page heading',
    pillTexts.length === 0 && !/border-emerald-100 px-2\.5 py-1 rounded-full/.test(rawHtml),
    pillTexts.join(' | '));
  const toolsIndex = await boot('', '/free-seo-tools');
  const indexBadges = [...toolsIndex.dom.window.document.querySelectorAll('main span')]
    .map(el => (el.textContent || '').trim())
    .filter(text => /^Instant$/.test(text));
  check('no green "Instant" badge sits above the card headings on /free-seo-tools',
    indexBadges.length === 0 && !/border-emerald-100 px-2 py-0\.5 rounded-full/.test(rawHtml),
    indexBadges.join(' | '));
  const indexCards = [...toolsIndex.dom.window.document.querySelectorAll('main a h3')];
  check('the tool cards start with the name (no icon above it)',
    indexCards.length > 0 && indexCards.every(h => {
      const card = h.closest('a');
      return /heading-card/.test(h.getAttribute('class') || '')
        && card?.firstElementChild === h
        && !card.querySelector('span.w-9, span.w-10');
    }),
    indexCards.filter(h => h.closest('a')?.firstElementChild !== h).length + ' cards not starting with the name');
  check('the /free-seo-tools category headings keep their category icon',
    [...toolsIndex.dom.window.document.querySelectorAll('main section h2')]
      .every(h => !!h.parentElement?.querySelector('span.w-9')));
  toolsIndex.dom.window.close();
  const toolHeader = dom.window.document.querySelector('main h1')?.closest('header');
  check('the tool page header starts with the title (no icon above it)',
    /tool-page-title/.test(toolHeader?.innerHTML || '')
    && !/w-10 h-10/.test(toolHeader?.innerHTML || '')
    && (toolHeader?.firstElementChild?.tagName || '') === 'H1');
  check('the built stylesheet ships both capitalisation rules',
    /\.capitalize\{text-transform:capitalize\}/.test(rawHtml.replace(/\s+/g, ''))
    && /\.tool-page-title\{text-transform:capitalize\}/.test(rawHtml.replace(/\s+/g, '')));
  dom.window.close();
}

/* 3f. the header navigation is the CMS menu: every live link is listed in
      Admin → Sections & Nav and an edit shows up in the header straight away */
{
  const { dom, errors } = await boot('', '/');
  const doc = dom.window.document;
  const desk = [...doc.querySelectorAll('div')].find(d => /hidden md:flex items-center gap-7/.test(d.className));
  const entries = [...(desk?.children || [])];
  const label = el => (el.textContent || '').trim();
  check('the header shows every navigation entry, mega menu included, in order',
    entries.length === 4
    && label(entries[0]) === 'Home' && entries[0].tagName === 'A'
    && label(entries[1]) === 'Free SEO Tools' && entries[1].tagName === 'A'
    && entries[2].tagName === 'DIV' && /^Tool Categories/.test(label(entries[2])) && !!entries[2].querySelector('button')
    && label(entries[3]) === 'Competitor Analysis' && entries[3].tagName === 'A'
    && errors.length === 0,
    entries.map(el => `${el.tagName}:${label(el).slice(0, 18)}`).join(' | '));
  check('the mega menu still opens with its eleven categories and counts',
    !!desk.querySelector('#tool-categories-menu a[href="/ip-tools"]')
    && [...desk.querySelectorAll('#tool-categories-menu a')]
      .filter(a => /^\/[a-z-]+-tools$/.test(a.getAttribute('href') || '') && a.getAttribute('href') !== '/free-seo-tools').length === 11
    && /Browse all 155 free tools/.test(desk.querySelector('#tool-categories-menu').textContent || ''),
    (desk.querySelector('#tool-categories-menu')?.textContent || '').slice(0, 90));
  check('the burger menu lists the same four entries',
    [...(doc.querySelector('#site-mobile-menu')?.children[0].children || [])].length === 4
    && !!doc.querySelector('#site-mobile-menu [aria-controls="tool-categories-mobile"]'));
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
  click([...doc.querySelectorAll('button')].find(b => /sections/i.test(b.textContent)));
  await new Promise(r => setTimeout(r, 400));
  const nav = [...doc.querySelectorAll('section')].find(s => /Navigation menu/.test(s.querySelector('h3')?.textContent || ''));
  const labels = () => [...nav.querySelectorAll('input[aria-label="Link label"]')].map(i => i.value);
  check('the admin navigation menu lists all four header links',
    labels().join(', ') === 'Home, Free SEO Tools, Tool Categories, Competitor Analysis'
    && nav.querySelectorAll('input[aria-label="Link URL"]').length === 3
    && ![...nav.querySelectorAll('input[aria-label="Link URL"]')].some(i => i.value === '')
    && /Mega menu → all category pages/.test(nav.textContent || '')
    && errors.length === 0,
    labels().join(', '));
  const rowOf = text => [...nav.querySelectorAll('input[aria-label="Link label"]')]
    .find(i => i.value === text)?.closest('div.flex.flex-wrap');
  check('every row carries its own label field, visibility and remove button',
    ['Home', 'Free SEO Tools', 'Tool Categories', 'Competitor Analysis'].every(text => {
      const row = rowOf(text);
      return !!row && !!row.querySelector('input[aria-label="Link label"]')
        && ['Visible', 'Remove'].every(btn => !!row.querySelector(`button`)) === true
        && [...row.querySelectorAll('button')].some(b => b.textContent.trim() === 'Remove');
    }));

  // Rename Home, hide Free SEO Tools, add a link, then save.
  setValue(rowOf('Home').querySelector('input[aria-label="Link label"]'), 'Start Here');
  await new Promise(r => setTimeout(r, 120));
  click([...rowOf('Free SEO Tools').querySelectorAll('button')].find(b => b.textContent.trim() === 'Visible'));
  await new Promise(r => setTimeout(r, 120));
  click([...nav.querySelectorAll('button')].find(b => b.textContent.trim() === '+ Add'));
  await new Promise(r => setTimeout(r, 200));
  setValue([...nav.querySelectorAll('input[aria-label="Link label"]')].pop(), 'Contact Us');
  await new Promise(r => setTimeout(r, 120));
  [...nav.querySelectorAll('input[aria-label="Link URL"]')].pop().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  setValue([...nav.querySelectorAll('input[aria-label="Link URL"]')].pop(), '/contact');
  await new Promise(r => setTimeout(r, 120));
  click([...nav.querySelectorAll('button')].find(b => b.textContent.includes('Save Changes')));
  await new Promise(r => setTimeout(r, 400));
  check('renaming, hiding and adding entries all save (Saved ✓)',
    [...nav.querySelectorAll('button')].some(b => b.textContent.includes('Saved ✓')), 
    [...nav.querySelectorAll('button')].map(b => b.textContent.trim()).slice(-3).join(' | '));
  const stored = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1'));
  const row = name => (stored.nav || []).find(n => n.label === name);
  check('the saved menu keeps every entry, in order, with the mega entry intact',
    (stored.nav || []).map(n => n.label).join(', ') === 'Start Here, Free SEO Tools, Tool Categories, Competitor Analysis, Contact Us'
    && row('Free SEO Tools')?.visible === false && row('Tool Categories')?.kind === 'tool-categories'
    && row('Contact Us')?.href === '/contact',
    JSON.stringify((stored.nav || []).map(n => [n.label, n.href, n.visible, n.kind])));

  const preload = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(stored))});`;
  const live = await boot(preload, '/');
  const liveDesk = [...live.dom.window.document.querySelectorAll('div')].find(d => /hidden md:flex items-center gap-7/.test(d.className));
  const liveLabels = [...(liveDesk?.children || [])].map(el => (el.textContent || '').trim());
  check('what was saved is what the header shows — rename, hide and new link, no reload',
    liveLabels.length === 4
    && liveLabels[0] === 'Start Here'
    && !liveLabels.includes('Free SEO Tools')
    && /^Tool Categories/.test(liveLabels[1]) && /^Competitor Analysis/.test(liveLabels[2]) && liveLabels[3] === 'Contact Us'
    && !!liveDesk.querySelector('a[href="/contact"]'),
    liveLabels.join(' | '));
  live.dom.window.close();
  dom.window.close();
}

/* 3f. the home page tool rows and the category rows keep one spacing rhythm */
{
  const { dom, errors } = await boot('', '/');
  const doc = dom.window.document;
  const section = [...doc.querySelectorAll('main section')].find(s => /Free SEO Tools/.test(s.querySelector('h2')?.textContent || ''));
  const wrap = section?.firstElementChild;
  const grids = [...(wrap?.children || [])].filter(el => /(^|\s)grid(\s|$)/.test(el.className));
  check('the home page tool grid and category grid have no extra gap between them',
    grids.length === 2
    && /\bgap-4\b/.test(grids[0].className) && /\bgap-4\b/.test(grids[1].className)
    && /\bmb-4\b/.test(grids[0].className) && !/(^|\s)mb-/.test(grids[1].className)
    && errors.length === 0,
    grids.map(g => g.className).join(' || ') || 'grids not found');
  check('the home page still lists eight tool cards then the category cards',
    grids.length === 2 && grids[0].children.length === 8 && grids[1].children.length === 11,
    grids.map(g => g.children.length).join(' | '));
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
  check('the Blog Categories section is next to the post list and lists the five categories',
    !!section && rows().join(', ') === 'Core Web Vitals, PageSpeed, WordPress SEO, Google & Indexing, Website Health'
    && (section.textContent || '').includes('5 categories'),
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
    && rows().join(', ') === 'Core Web Vitals, PageSpeed, WordPress SEO, Google & Indexing, Website Health, SEO Tips',
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
  const tabs = [...dom.window.document.querySelectorAll('main [role="tab"]')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
  check('a hidden category is left out of the blog filter tabs',
    tabs.map(t => t.replace(/\s+\d+$/, '')).join(', ') === 'All, Core Web Vitals'
    && tabs.every(t => /\s\d+$/.test(t)), tabs.join(', '));
  dom.window.close();
  const hidden = await boot(preload, '/blog/category/secret-category');
  check('a hidden category page is not available',
    /Category not found/.test(hidden.dom.window.document.querySelector('main h1')?.textContent || ''));
  hidden.dom.window.close();
}
{
  // The old category slug is gone for good: no redirect, no page — both the
  // top-level and the /blog/category spelling fall through to not-found.
  for (const route of ['/website-seo-audit', '/blog/category/website-seo-audit']) {
    const { dom } = await boot('', route);
    const doc = dom.window.document;
    const h1 = (doc.querySelector('main h1')?.textContent || '').trim();
    const robots = doc.querySelector('meta[name=robots]')?.getAttribute('content') || '';
    check(`${route} no longer exists — not found, never redirected`,
      /not found/i.test(h1) && /noindex/.test(robots) && !/Website Health/.test(h1),
      `h1=${h1} robots=${robots}`);
    dom.window.close();
  }
}

/* 3e. Tool Categories: the categories managed in Admin → Tool Categories drive
 * the directory, the mega menu, the category pages and the tool editor. */
{
  // A built-in category keeps its original top-level page and answers on the
  // /tools/category/<slug> URL with the same content and the same canonical.
  for (const [route, label] of [['/ip-tools', 'top-level'], ['/tools/category/ip-tools', 'tools/category']]) {
    const { dom, errors } = await boot('', route);
    const doc = dom.window.document;
    check(`${label} category URL renders the category page (H1, tools, intro)`,
      (doc.querySelector('main h1')?.textContent || '').trim() === 'IP Tools'
      && toolLinks(dom).length === 6
      && text(dom).includes('See what the internet sees'),
      `${doc.querySelector('main h1')?.textContent} · ${toolLinks(dom).length} cards · errors: ${errors.join(' | ')}`);
    check(`${label} category URL keeps /ip-tools as the canonical`,
      (doc.querySelector('link[rel=canonical]')?.getAttribute('href') || '') === 'https://seoaudittools.pk/ip-tools',
      doc.querySelector('link[rel=canonical]')?.getAttribute('href'));
    dom.window.close();
  }
  const { dom: missing } = await boot('', '/tools/category/not-a-category');
  check('a category URL that does not exist shows a not-found page with noindex',
    /Category not found/.test(missing.window.document.querySelector('main h1')?.textContent || '')
    && /noindex/.test(missing.window.document.querySelector('meta[name=robots]')?.getAttribute('content') || ''));
  missing.window.close();

  // Admin → Tool Categories: next to Tools, with name + auto slug + description.
  const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
  const { dom, errors } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const doc = dom.window.document;
  const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const setValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const setSelect = (el, value) => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };
  const adminButton = label => [...doc.querySelectorAll('button')].filter(b => b.textContent.trim() === label).pop();
  const tabBar = [...doc.querySelectorAll('nav')].find(n => [...n.querySelectorAll('button')].some(b => b.textContent.trim() === 'Dashboard'));
  const tabLabels = [...(tabBar?.querySelectorAll('button') || [])].map(b => b.textContent.trim());
  check('the admin tab bar carries Tool Categories directly after Tools',
    tabLabels.indexOf('Tool Categories') === tabLabels.indexOf('Tools') + 1, tabLabels.join(' | '));
  click(adminButton('Tool Categories'));
  await wait();
  let section = doc.querySelector('section[aria-label="Tool Categories"]');
  check('the pane lists the eleven built-in categories with their tool counts',
    !!section
    && [...section.querySelectorAll('p.font-semibold')].length === 11
    && (section.textContent || '').includes('/tools/category/text-analysis-tools')
    && [...section.querySelectorAll('strong')].some(el => el.textContent.trim() === '11')
    && [...section.querySelectorAll('strong')].some(el => el.textContent.trim() === '45'),
    section ? [...section.querySelectorAll('p.font-semibold')].map(p => p.textContent.trim()).join(', ') : 'no section');
  check('every row has its own Edit and Delete, and the built-ins are marked',
    ['Edit', 'Delete'].every(label => [...section.querySelectorAll('button')].some(b => b.textContent.trim() === label))
    && [...section.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Delete').length === 11
    && (section.textContent || '').includes('Built-in'));

  // There is no add-category form: this pane manages the categories the site
  // ships with, each one in place. Editing is the supported path.
  check('the pane offers no add-category form',
    !section.querySelector('input[aria-label="Category Name"]')
    && !section.querySelector('textarea[aria-label="Category Description"]')
    && ![...section.querySelectorAll('button')].some(b => /Add category/.test(b.textContent || '')));
  click([...section.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit')[0]);
  await wait();
  const editPanel = section.querySelector('div.bg-slate-50.border-b');
  check('every category still edits its name, slug, description and below-tools content',
    !!editPanel
    && ['input[aria-label="Edit category name"]', 'input[aria-label="Edit category slug"]', 'textarea[aria-label="Edit content above tools"]']
      .every(sel => !!editPanel.querySelector(sel))
    && (editPanel.textContent || '').includes('Content Below Tools — Before Footer')
    && (editPanel.textContent || '').includes('Content Above Tools — appears after the heading, before the tools grid')
    && !!editPanel.querySelector('[contenteditable="true"]')
    && !![...editPanel.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Changes'));
  // ---- SEO & Meta Information on a category row ----
  const seoBox = [...editPanel.querySelectorAll('section')].find(el => /SEO & Meta Information/.test(el.textContent || ''));
  // Opens one row and returns ITS edit panel — the panel is the row's next
  // sibling, so a row left open earlier (whose button may still read
  // "Saved ✓") cannot be mistaken for it.
  const panelOf = async name => {
    const label = [...section.querySelectorAll('p.font-semibold')].find(pp => (pp.textContent || '').trim() === name);
    const rowEl = label.closest('div.flex.flex-col');
    click([...rowEl.querySelectorAll('button')].find(b => b.textContent.trim() === 'Edit'));
    await wait();
    const panel = rowEl.nextElementSibling;
    if (!panel || !/bg-slate-50/.test(panel.className || '')) throw new Error(`no edit panel opened for ${name}`);
    return panel;
  };
  const savePanel = async panel => {
    click([...panel.querySelectorAll('button')].find(b => /^(Save Changes|Saved ✓)$/.test(b.textContent.trim())));
    await wait();
  };
  check('the edit row carries the SEO & Meta block with all four controls',
    !!seoBox
    && /Google preview/.test(seoBox.textContent || '')
    && !!seoBox.querySelector('textarea')
    && [...seoBox.querySelectorAll('input')].length === 3
    // no-index is a checkbox here (the category pages ask for one)
    && !!seoBox.querySelector('input[type="checkbox"]')
    && !/Make no-index/.test(seoBox.textContent || '')
    && /Noindex — exclude from search/.test(seoBox.textContent || '')
    && /Indexable/.test(seoBox.textContent || '')
    && seoBox.querySelector('input[type="checkbox"]').checked === false,
    seoBox ? [...seoBox.querySelectorAll('input')].map(i => i.type).join(',') : 'no seo section');
  check('the SEO fields show the automatic copy as their starting value',
    !!seoBox && seoBox.querySelector('input').value === 'Text Analysis Tools — 11 Free Online Tools | SEO Audit Tools'
    && seoBox.querySelector('textarea').value.includes('11 free text analysis tools'),
    seoBox ? seoBox.querySelector('input').value : '');
  setValue(seoBox.querySelector('input'), 'Text & Grammar Tools — 11 Free Checks | SEO Audit Tools');
  setValue(seoBox.querySelector('textarea'), 'Proofread, rewrite and count words in the browser: plagiarism, grammar, density and reading time, free and without a sign-up.');
  click([...editPanel.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Changes'));
  await wait();
  let st = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('saving the SEO fields stores them against the category',
    st.seo?.['cat:text']?.title === 'Text & Grammar Tools — 11 Free Checks | SEO Audit Tools'
    && (st.seo?.['cat:text']?.description || '').startsWith('Proofread, rewrite and count words')
    && !st.seo?.['cat:text']?.slug && st.seo?.['cat:text']?.noindex === false,
    JSON.stringify(st.seo?.['cat:text']));
  check('the category name, slug and description were saved alongside it',
    (st.toolCategories.find(c => c.key === 'text') || {}).name === 'Text Analysis Tools',
    JSON.stringify(st.toolCategories.find(c => c.key === 'text')?.name));

  // A value still equal to the automatic copy is not stored, so the live tool
  // count in it keeps tracking the published tools.
  const kwPanel = await panelOf('Keyword Tools');
  const kwSeo = kwPanel.querySelector('section');
  setValue(kwSeo.querySelector('input'), 'Keyword Tools — 8 Free Online Tools | SEO Audit Tools');
  await savePanel(kwPanel);
  st = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('leaving the automatic copy untouched stores no override', !st.seo?.['cat:keyword'], JSON.stringify(st.seo?.['cat:keyword']));

  // Canonical override + no-index on a category that no later check reads.
  const blPanel = await panelOf('Backlink Tools');
  const blSeo = blPanel.querySelector('section');
  setValue([...blSeo.querySelectorAll('input')][1], '/free-seo-tools');
  const blCheck = blSeo.querySelector('input[type="checkbox"]');
  click(blCheck);
  await wait();
  check('ticking the noindex checkbox flips it and the status pill',
    blSeo.querySelector('input[type="checkbox"]').checked === true
    && /No-indexed/.test(blSeo.textContent || ''),
    `${blSeo.querySelector('input[type="checkbox"]')?.checked} | ${(blSeo.textContent || '').match(/Indexable|No-indexed/)?.[0]}`);
  await savePanel(blPanel);
  st = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('canonical override and no-index persist',
    st.seo?.['cat:backlink']?.slug === '/free-seo-tools' && st.seo?.['cat:backlink']?.noindex === true
    && /No-index/.test(blSeo.textContent || ''),
    JSON.stringify(st.seo?.['cat:backlink']));

  const base = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  dom.window.close();

  // The stored overrides must reach the page head.
  const headSeed = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(base))});`;
  const { dom: headDom } = await boot(headSeed, '/text-analysis-tools');
  const headDoc = headDom.window.document;
  check('the category tab title and meta description use the saved SEO values',
    headDoc.title === 'Text & Grammar Tools — 11 Free Checks | SEO Audit Tools'
    && (headDoc.querySelector('meta[name="description"]')?.getAttribute('content') || '').startsWith('Proofread, rewrite and count words')
    && (headDoc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '') === 'Text & Grammar Tools — 11 Free Checks | SEO Audit Tools',
    `${headDoc.title} | ${headDoc.querySelector('meta[name="description"]')?.getAttribute('content')}`);
  headDom.window.close();
  const { dom: noIdxDom } = await boot(headSeed, '/backlink-tools');
  check('a canonical override and no-index apply to the category page',
    (noIdxDom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '') === 'https://seoaudittools.pk/free-seo-tools'
    && noIdxDom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content') === 'noindex, nofollow',
    `${noIdxDom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href')} | ${noIdxDom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content')}`);
  noIdxDom.window.close();
  const { dom: plainDom } = await boot(headSeed, '/keyword-tools');
  check('an untouched category keeps the generated title with its live count',
    plainDom.window.document.title === 'Keyword Tools — 8 Free Online Tools | SEO Audit Tools',
    plainDom.window.document.title);
  plainDom.window.close();

  // The shared editor must be untouched everywhere else: same button, no checkbox.
  const { dom: otherDom } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const otherDoc = otherDom.window.document;
  const click2other = el => el && el.dispatchEvent(new otherDom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const openSeoBox = async (tab, firstEdit) => {
    click2other([...otherDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === tab).pop());
    await wait();
    click2other([...otherDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit')[firstEdit]);
    await wait();
    const host = otherDoc.getElementById('main-content') || otherDoc;
    return [...host.querySelectorAll('section')].filter(el => /SEO & Meta Information/.test(el.textContent || '')).pop();
  };
  await wait(500);
  const pageSeo = await openSeoBox('Pages', 0);
  check('the Pages panel renders the SEO section with the tool editor controls',
    !!pageSeo
    && /SEO title/.test(pageSeo.textContent || '')
    && /target 50.60/.test(pageSeo.textContent || '')
    && /Meta description/.test(pageSeo.textContent || '')
    && /target 150.160/.test(pageSeo.textContent || '')
    && /Canonical URL override/.test(pageSeo.textContent || '')
    && pageSeo.querySelectorAll('input')[1]?.placeholder === 'Leave blank to use the page URL'
    && !pageSeo.querySelector('input[type="checkbox"]')
    && /Make no-index/.test(pageSeo.textContent || '')
    && /Indexable/.test(pageSeo.textContent || '')
    && /Google preview/.test(pageSeo.textContent || '')
    && /Saved automatically/.test(pageSeo.textContent || ''),
    pageSeo ? [...pageSeo.querySelectorAll('input')].map(i => `${i.type}:${i.placeholder}`).join(' | ') : 'no seo box on the page editor');
  // The same grouped layout the tool editor uses: titled sections in order,
  // with SEO & Meta Information last.
  const pageRoot = pageSeo && pageSeo.closest('.bg-slate-50');
  const pageText = pageRoot ? pageRoot.textContent || '' : '';
  check('the page editor groups its fields into the tool editor sections',
    !!pageRoot
    && /Page Details/.test(pageText) && /Page state/.test(pageText)
    && /Content/.test(pageText) && /Featured Image/.test(pageText)
    && pageText.indexOf('Page Details') < pageText.indexOf('Page state')
    && pageText.indexOf('Page state') < pageText.indexOf('Content')
    && pageText.indexOf('Content') < pageText.indexOf('Featured Image')
    && pageText.indexOf('Featured Image') < pageText.indexOf('SEO & Meta Information'),
    pageText.slice(0, 160));
  otherDom.window.close();
  // The shared editor keeps BOTH branches in the bundle: the button is the
  // default everywhere, and only the tool category rows opt into the checkbox.
  // Asserting on the built file avoids racing a tab render here.
  check('the Make no-index button branch still ships for the other panels',
    /Make no-index/.test(rawHtml) && /No-index enabled/.test(rawHtml)
    && /Noindex — exclude from search/.test(rawHtml)
    && (rawHtml.match(/noindexControl:"checkbox"/g) || []).length === 1,
    `${(rawHtml.match(/noindexControl:"checkbox"/g) || []).length} opt-ins in the bundle`);
  // ---- PART 4: the SEO section on the create views and on blog categories ----
  const { dom: crtDom } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const crtDoc = crtDom.window.document;
  const crtClick = el => el && el.dispatchEvent(new crtDom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const crtBtn = label => [...crtDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === label).pop();
  const crtSeoBox = () => [...(crtDoc.getElementById('main-content') || crtDoc).querySelectorAll('section')].filter(el => /SEO & Meta Information/.test(el.textContent || '')).pop();
  const crtText = box => (box ? box.textContent || '' : '');
  await wait();
  crtClick(crtBtn('Pages'));
  await wait();
  crtClick(crtBtn('+ Create page'));
  await wait();
  const pageCreateSeo = crtSeoBox();
  check('creating a page shows the SEO & Meta section with the tool editor controls',
    !!pageCreateSeo
    && /SEO title/.test(crtText(pageCreateSeo))
    && /Meta description/.test(crtText(pageCreateSeo))
    && /Canonical URL override/.test(crtText(pageCreateSeo))
    && pageCreateSeo.querySelectorAll('input')[1]?.placeholder === 'Leave blank to use the page URL'
    && !pageCreateSeo.querySelector('input[type="checkbox"]')
    && /Make no-index/.test(crtText(pageCreateSeo))
    && /Indexable/.test(crtText(pageCreateSeo)),
    pageCreateSeo ? 'section present' : 'no section in the page create form');
  const pageCreateRoot = pageCreateSeo && pageCreateSeo.closest('.space-y-4');
  const pageCreateText = pageCreateRoot ? pageCreateRoot.textContent || '' : '';
  check('the new page form groups its fields into the tool editor sections',
    !!pageCreateRoot
    && /Page Details/.test(pageCreateText) && /Page state/.test(pageCreateText)
    && /Content/.test(pageCreateText) && /Featured Image/.test(pageCreateText)
    && pageCreateText.indexOf('Page Details') < pageCreateText.indexOf('Content')
    && pageCreateText.indexOf('Content') < pageCreateText.indexOf('Featured Image')
    && pageCreateText.indexOf('Featured Image') < pageCreateText.indexOf('SEO & Meta Information'),
    pageCreateText.slice(0, 160));
  crtClick(crtBtn('Blog posts'));
  await wait();
  const catCreateSeo = crtSeoBox();
  check('the blog category create form carries the SEO section',
    !!catCreateSeo && /SEO title/.test(crtText(catCreateSeo))
    && /Make no-index/.test(crtText(catCreateSeo))
    && !catCreateSeo.querySelector('input[type="checkbox"]'),
    catCreateSeo ? 'section present' : 'no section in the category create form');
  const catCreateRoot = catCreateSeo && catCreateSeo.closest('.space-y-4');
  const catCreateText = catCreateRoot ? catCreateRoot.textContent || '' : '';
  check('the category create form splits details, intro and SEO into their own cards',
    !!catCreateRoot
    && catCreateRoot.querySelector('input[aria-label="Category Name"]') !== null
    && catCreateRoot.querySelector('input[aria-label="Category Slug"]') !== null
    && catCreateRoot.querySelector('textarea[aria-label="Category description"]') !== null
    && catCreateText.indexOf('Category Details') < catCreateText.indexOf('Description')
    && catCreateText.indexOf('Description') < catCreateText.indexOf('SEO & Meta Information'),
    catCreateText.slice(0, 200));
  crtClick(crtBtn('+ Write post'));
  await wait();
  const postCreateSeo = crtSeoBox();
  check('creating a blog post shows the same SEO & Meta section',
    !!postCreateSeo && /SEO title/.test(crtText(postCreateSeo))
    && /Make no-index/.test(crtText(postCreateSeo))
    && !postCreateSeo.querySelector('input[type="checkbox"]'),
    postCreateSeo ? 'section present' : 'no section in the post create form');
  const postCreateRoot = postCreateSeo && postCreateSeo.closest('.space-y-4');
  const postCreateText = postCreateRoot ? postCreateRoot.textContent || '' : '';
  check('the new post form groups title, slug, author and date under a heading',
    !!postCreateRoot
    && /Post Details/.test(postCreateText)
    && /Author/.test(postCreateText) && /Publish date/.test(postCreateText) && /Read time/.test(postCreateText)
    && /Content/.test(postCreateText) && /Category/.test(postCreateText) && /Featured Image/.test(postCreateText)
    && postCreateText.indexOf('Post Details') < postCreateText.indexOf('Content')
    && postCreateText.indexOf('Content') < postCreateText.indexOf('Featured Image')
    && postCreateText.indexOf('Featured Image') < postCreateText.indexOf('Category')
    && postCreateText.indexOf('Category') < postCreateText.indexOf('SEO & Meta Information'),
    postCreateText.slice(0, 200));
  crtClick(crtBtn('Cancel'));
  await wait();
  // The FIRST Edit button on the Blog posts tab belongs to the first Blog
  // Categories row, which sits above the post list — .pop() would open a post
  // editor instead and quietly satisfy the wording checks below.
  crtClick([...crtDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit')[0]);
  await wait();
  const catEditSeo = crtSeoBox();
  check('editing a blog category shows the SEO section and its autosave badge',
    !!catEditSeo && /Saved automatically/.test(crtText(catEditSeo))
    && /SEO title/.test(crtText(catEditSeo))
    && /Make no-index/.test(crtText(catEditSeo))
    && !catEditSeo.querySelector('input[type="checkbox"]'),
    catEditSeo ? 'section present' : 'no section in the category editor');
  const catEditRoot = catEditSeo && catEditSeo.closest('.space-y-4');
  check('the category editor carries the intro field inside its details section',
    !!catEditRoot
    && /Category Details/.test(catEditRoot.textContent || '')
    && catEditRoot.querySelector('textarea[aria-label="Edit category description"]') !== null
    && catEditRoot.querySelector('input[aria-label="Edit category name"]') !== null,
    catEditRoot ? 'intro field present' : 'no category editor open');
  crtDom.window.close();

  // ---- the category intro text is stored and reaches the public page ----
  const { dom: introDom } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const introDoc = introDom.window.document;
  const introClick = el => el && el.dispatchEvent(new introDom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const introSet = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? introDom.window.HTMLTextAreaElement.prototype : introDom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new introDom.window.Event('input', { bubbles: true }));
  };
  await wait();
  introClick([...introDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Blog posts').pop());
  await wait();
  introSet(introDoc.querySelector('input[aria-label="Category Name"]'), 'Technical SEO');
  introSet(introDoc.querySelector('textarea[aria-label="Category description"]'), 'Technical SEO intros: crawling, rendering, indexing and the server-side mistakes that quietly cost rankings.');
  introClick([...introDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Add category').pop());
  await wait();
  const introSt = JSON.parse(introDom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  const newCat = (introSt.blogCategories || []).find(c => c.name === 'Technical SEO');
  check('a new blog category stores its intro text and clean slug',
    !!newCat && newCat.slug === 'technical-seo'
    && newCat.description === 'Technical SEO intros: crawling, rendering, indexing and the server-side mistakes that quietly cost rankings.',
    JSON.stringify(newCat));
  introDom.window.close();
  const { dom: introPageDom } = await boot(`localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(introSt))});`, '/blog/category/technical-seo');
  const introBody = introPageDom.window.document.body.textContent || '';
  check('the category intro renders on the public category page',
    /Technical SEO intros: crawling, rendering, indexing/.test(introBody)
    && !/practical guides? filed under Technical SEO/.test(introBody),
    introBody.slice(0, 160));
  introPageDom.window.close();

  // A saved blog-category entry must reach the public page head.
  const catSeoSeed = { ...base, seo: { ...(base.seo || {}), 'blogcat:core-web-vitals': { title: 'Core Web Vitals: Fix INP, LCP and CLS', description: 'Practical fixes for the Core Web Vitals problems website owners actually hit.', slug: '', noindex: true } } };
  const { dom: bcDom } = await boot(`localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(catSeoSeed))});`, '/blog/category/core-web-vitals');
  check('a saved blog-category SEO entry reaches the page head',
    bcDom.window.document.title === 'Core Web Vitals: Fix INP, LCP and CLS'
    && (bcDom.window.document.querySelector('meta[name="description"]')?.getAttribute('content') || '') === 'Practical fixes for the Core Web Vitals problems website owners actually hit.'
    && bcDom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content') === 'noindex, nofollow',
    `${bcDom.window.document.title} | ${bcDom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content')}`);
  bcDom.window.close();

  // ---- an SEO edit survives a hard refresh ----
  const firstPage = (base.pages || [])[0];
  const { dom: survDom } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const survDoc = survDom.window.document;
  const survClick = el => el && el.dispatchEvent(new survDom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const survBtn = label => [...survDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === label).pop();
  await wait();
  survClick(survBtn('Pages'));
  await wait();
  survClick([...survDoc.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit')[0]);
  await wait();
  const survBox = [...(survDoc.getElementById('main-content') || survDoc).querySelectorAll('section')].filter(el => /SEO & Meta Information/.test(el.textContent || '')).pop();
  const survInput = survBox && survBox.querySelector('input');
  if (survInput) {
    Object.getOwnPropertyDescriptor(survDom.window.HTMLInputElement.prototype, 'value').set.call(survInput, 'Audited Page Title | SEO Audit Tools Pakistan');
    survInput.dispatchEvent(new survDom.window.Event('input', { bubbles: true }));
  }
  await wait();
  const storedAfter = JSON.parse(survDom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  survDom.window.close();
  const liveState = { ...storedAfter, pages: (storedAfter.pages || []).map(p => (p.slug === firstPage.slug ? { ...p, status: 'live' } : p)) };
  const { dom: afterDom } = await boot(`localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(liveState))});`, `/${firstPage.slug}`);
  check('an SEO edit survives a hard refresh (stored, then re-rendered)',
    (storedAfter.seo && storedAfter.seo[`page:${firstPage.slug}`] ? storedAfter.seo[`page:${firstPage.slug}`].title : '') === 'Audited Page Title | SEO Audit Tools Pakistan'
    && afterDom.window.document.title === 'Audited Page Title | SEO Audit Tools Pakistan',
    `${storedAfter.seo && storedAfter.seo[`page:${firstPage.slug}`] ? storedAfter.seo[`page:${firstPage.slug}`].title : ''} | ${afterDom.window.document.title}`);
  afterDom.window.close();


  // A category a previous build saved in the admin (the store still carries
  // them): seeded into localStorage, which is exactly what one looks like.
  const added = { id: 'audit-local', key: 'custom-local-seo', name: 'Local SEO Tools', slug: 'local-seo-tools', description: 'Rank in the map pack with local keyword, citation and review checks.', content: '', builtin: false };
  const seeded = { ...base, toolCategories: [...(base.toolCategories || []), added] };
  const seedJs = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(seeded))});`
    + `localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`;
  const { dom: domC } = await boot(seedJs, '/admin');
  const docC = domC.window.document;
  const clickC = el => el && el.dispatchEvent(new domC.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const setSelectC = (el, value) => {
    Object.getOwnPropertyDescriptor(domC.window.HTMLSelectElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new domC.window.Event('change', { bubbles: true }));
  };
  const adminButtonC = label => [...docC.querySelectorAll('button')].filter(b => b.textContent.trim() === label).pop();
  await wait();
  clickC(adminButtonC('Tool Categories'));
  await wait();
  const catSection = docC.querySelector('section[aria-label="Tool Categories"]');
  const catRows = [...(catSection?.querySelectorAll('p.font-semibold') || [])].map(p => p.textContent.trim());
  check('a category saved in the CMS is still listed and manageable',
    catRows.length === 12 && catRows.includes('Local SEO Tools'), catRows.join(', '));

  // The tool editor's Category dropdown is the managed list.
  clickC(adminButtonC('Tools'));
  await wait();
  const filterSelect = docC.querySelector('select[aria-label="Filter by category"]');
  check('the tools list filter offers every managed category',
    !!filterSelect && [...filterSelect.options].map(o => o.textContent).join(', ') === 'All categories, Text Analysis Tools, Keyword Tools, Backlink Tools, Website Management Tools, Website Checker Tools, Domain Tools, IP Tools, PDF Tools, Image Tools, Calculator Tools, Unit Converter Tools, Local SEO Tools',
    filterSelect ? [...filterSelect.options].map(o => o.textContent).join(', ') : 'no select');
  // The category copy editors must live only in Admin → Tool Categories → Edit.
  // The Tools tab used to render a second RichTextEditor for the category picked
  // in this very filter, so filter by a real category and prove nothing appears.
  const toolsMain = docC.getElementById('main-content') || docC.querySelector('main');
  const toolsPaneText = () => (toolsMain.textContent || '').replace(/\s+/g, ' ');
  setSelectC(filterSelect, 'ip');
  await wait();
  check('filtering the Tools tab by a category shows no category content editor',
    /IP Tools/.test(toolsPaneText())
    && !/Category page content|Pick a category in the filter above|Content Below Tools|Content Above Tools|SEO & Meta Information/.test(toolsPaneText())
    && !toolsMain.querySelector('[aria-label$="category page content"]')
    && !toolsMain.querySelector('textarea[aria-label="Edit content above tools"]'),
    toolsPaneText().slice(0, 160));
  setSelectC(filterSelect, 'all');
  await wait();
  clickC([...docC.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit')[0]);
  await wait();
  const catSelect = docC.querySelector('select[aria-label="Category"]');
  const options = catSelect ? [...catSelect.options].map(o => o.textContent) : [];
  check("the tool editor's Category dropdown uses the managed list",
    options.length === 12 && options.includes('IP Tools') && options.includes('Local SEO Tools'), options.join(' | '));
  setSelectC(catSelect, added.key);
  await wait();
  clickC([...docC.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save tool'));
  await wait();
  const stored2 = JSON.parse(domC.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  const moved = (stored2.tools || []).find(t => t.category === added.key);
  check('assigning a tool to a new category saves it', !!moved, JSON.stringify(moved && moved.name));
  domC.window.close();

  const preload = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(stored2))});`;
  const { dom: menuDom } = await boot(preload, '/');
  const menuLinks = [...menuDom.window.document.querySelectorAll('#tool-categories-menu a')]
    .map(a => `${a.textContent.replace(/\s+/g, ' ').trim()}|${a.getAttribute('href')}`);
  check('the mega menu lists the new category with its URL and live count',
    menuLinks.some(v => v.startsWith('Local SEO Tools (1)|/tools/category/local-seo-tools')), menuLinks.join(' ~ '));
  menuDom.window.close();
  const { dom: indexDom } = await boot(preload, '/free-seo-tools');
  const indexHeadings = [...indexDom.window.document.querySelectorAll('h2')].map(h => h.textContent.trim());
  check('the directory shows a section for the new category, with its description',
    indexHeadings.includes('Local SEO Tools')
    && text(indexDom).includes('Rank in the map pack')
    // 155 tool cards: the extra main-area link is the new category heading itself.
    && toolLinks(indexDom).filter(h => !h.startsWith('/tools/category/')).length === 155,
    `${indexHeadings.length} headings · ${toolLinks(indexDom).length} cards`);
  const categoryHrefs = [...indexDom.window.document.querySelectorAll('main a[href="/tools/category/local-seo-tools"]')];
  check('that section heading links to its /tools/category page', categoryHrefs.length === 1);
  check('the category heading link is not counted as a tool card',
    toolLinks(indexDom).includes('/tools/category/local-seo-tools'));
  indexDom.window.close();

  const { dom: catDom } = await boot(preload, '/tools/category/local-seo-tools');
  const catDoc = catDom.window.document;
  check('the new category has its own page with its name, description and tool',
    (catDoc.querySelector('main h1')?.textContent || '').trim() === 'Local SEO Tools'
    && text(catDom).includes('Rank in the map pack')
    && toolLinks(catDom).length === 1
    && (catDoc.querySelector('link[rel=canonical]')?.getAttribute('href') || '') === 'https://seoaudittools.pk/tools/category/local-seo-tools'
    && /Local SEO Tools/.test(catDoc.title),
    `${catDoc.querySelector('main h1')?.textContent} · ${toolLinks(catDom).length} cards · ${catDoc.title}`);
  catDom.window.close();

  // Renaming a category and rewriting its description shows through at once.
  const { dom: admin2 } = await boot(`localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(stored2))});${`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`}`, '/admin');
  const doc2 = admin2.window.document;
  const click2 = el => el.dispatchEvent(new admin2.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const set2 = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? admin2.window.HTMLTextAreaElement.prototype : admin2.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new admin2.window.Event('input', { bubbles: true }));
  };
  click2([...doc2.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Tool Categories').pop());
  await wait();
  section = doc2.querySelector('section[aria-label="Tool Categories"]');
  click2([...section.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Edit')[0]);
  await wait();
  set2(doc2.querySelector('input[aria-label="Edit category name"]'), 'Text Checking Tools');
  set2(doc2.querySelector('textarea[aria-label="Edit content above tools"]'), 'Proofread every page: plagiarism, grammar, rewriting and word counts.');
  await wait();
  click2([...section.querySelectorAll('button')].find(b => /Save Changes/.test(b.textContent)));
  await wait();
  check('renaming a category writes its name and description back',
    /Saved ✓/.test(section.textContent || '')
    && [...section.querySelectorAll('p.font-semibold')].some(p => p.textContent.trim() === 'Text Checking Tools'));
  const stored3 = JSON.parse(admin2.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  check('the edit is persisted in the CMS store',
    (stored3.toolCategories || [])[0]?.name === 'Text Checking Tools'
    && (stored3.toolCategories || [])[0]?.description.startsWith('Proofread every page'),
    JSON.stringify((stored3.toolCategories || [])[0]));
  admin2.window.close();

  const edited = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(stored3))});`;
  const { dom: renamedIndex } = await boot(edited, '/free-seo-tools');
  check('the directory picks the new name and description up immediately',
    [...renamedIndex.window.document.querySelectorAll('h2')].some(h => h.textContent.trim() === 'Text Checking Tools')
    && text(renamedIndex).includes('Proofread every page'));
  renamedIndex.window.close();
  for (const route of ['/text-analysis-tools', '/tools/category/text-analysis-tools']) {
    const { dom: builtin } = await boot(edited, route);
    check(`${route} still answers after the rename (built-in page kept)`,
      (builtin.window.document.querySelector('main h1')?.textContent || '').trim() === 'Text Checking Tools'
      && (builtin.window.document.querySelector('link[rel=canonical]')?.getAttribute('href') || '') === 'https://seoaudittools.pk/text-analysis-tools');
    builtin.window.close();
  }

  // Deleting a category keeps its tools: they move to the nearest remaining one.
  const { dom: admin3 } = await boot(`localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(stored2))});${`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`}`, '/admin');
  const doc3 = admin3.window.document;
  const click3 = el => el.dispatchEvent(new admin3.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  admin3.window.confirm = () => true;
  click3([...doc3.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Tool Categories').pop());
  await wait();
  const section3 = doc3.querySelector('section[aria-label="Tool Categories"]');
  const customRow = [...section3.querySelectorAll('div')].filter(d => d.textContent.trim().startsWith('Local SEO Tools'))[0];
  click3([...customRow.querySelectorAll('button')].find(b => b.textContent.trim() === 'Delete'));
  await wait();
  const stored4 = JSON.parse(admin3.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  const survivor = (stored4.tools || []).find(t => t.slug === moved.slug);
  check('deleting a category removes it but keeps its tools in the nearest one',
    !(stored4.toolCategories || []).some(c => c.slug === 'local-seo-tools')
    && !!survivor
    && (stored4.toolCategories || []).some(c => c.key === survivor.category)
    && ![...section3.querySelectorAll('p.font-semibold')].some(p => p.textContent.trim() === 'Local SEO Tools'),
    JSON.stringify({ cats: (stored4.toolCategories || []).length, survivor: survivor && survivor.category }));
  admin3.window.close();
}

/* 3f. Competitor Analysis: every word of /competitor-analysis is managed in
 * Admin → Competitor Analysis and the tool itself is untouched. */
{
  const { dom: page, errors } = await boot('', '/competitor-analysis');
  const pageDoc = page.window.document;
  const pageText = () => text(page).replace(/\s+/g, ' ');
  check('the competitor page renders its hero, inputs and sections',
    pageText().includes('Website Competitor Analysis')
    && pageText().includes('Side-by-side SEO audit')
    && pageText().includes('Your website') && pageText().includes('Competitor website')
    && pageText().includes('Compare Both Websites')
    && pageText().includes('What is Website Competitor Analysis?')
    && pageText().includes('How to read the comparison report')
    && pageText().includes('A fair benchmark')
    && pageText().includes('Competitor Analysis FAQs'),
    pageText().slice(0, 140));
  check('the competitor page keeps its clean URL, canonical and meta title',
    (pageDoc.querySelector('link[rel=canonical]')?.getAttribute('href') || '') === 'https://seoaudittools.pk/competitor-analysis'
    && /SEO Competitor Analysis/.test(pageDoc.title) && errors.length === 0,
    `${pageDoc.title} · ${errors.join(' | ')}`);
  const faqButton = [...pageDoc.querySelectorAll('button')].find(b => (b.textContent || '').trim().startsWith('Does this tool check an entire website?'));
  if (faqButton) {
    faqButton.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait();
  }
  check('a FAQ answer expands as rich text',
    pageText().includes('It compares the two exact URLs you enter'));
  page.window.close();

  // the admin tab: fields, WYSIWYG editors, repeatable lists, save confirmation
  const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
  const { dom, errors: adminErrors } = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
  const doc = dom.window.document;
  const click = el => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const setValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const tabBar = [...doc.querySelectorAll('nav, [role="tablist"]')].find(n => [...n.querySelectorAll('button')].some(b => b.textContent.trim() === 'Dashboard'));
  const tabLabels = [...(tabBar?.querySelectorAll('button') || [])].map(b => b.textContent.trim());
  check('the Competitor Analysis tab sits after Tool Categories and leads no other tab astray',
    tabLabels.indexOf('Competitor Analysis') === tabLabels.indexOf('Tool Categories') + 1
    && tabLabels.join(',') === 'Dashboard,Pages,Blog posts,Tools,Tool Categories,Competitor Analysis,Sidebar,Sections & Nav,Settings',
    tabLabels.join(','));
  /* ---- the admin shell: a full-width header over a fixed left sidebar ---- */
  const sideNav = tabBar;
  const sideAside = sideNav && sideNav.closest('aside');
  const sideRow = sideAside && sideAside.parentElement;
  const sideMain = sideAside && sideAside.nextElementSibling;
  const sideHeader = sideRow && sideRow.previousElementSibling;
  check('the nine areas are a vertical stack in a fixed-width left sidebar',
    !!sideNav && sideNav.tagName === 'NAV'
    && !!sideAside && /w-60/.test(sideAside.className) && /flex-shrink-0/.test(sideAside.className)
    && /border-r/.test(sideAside.className)
    && /sticky/.test(sideNav.className) && /space-y-1/.test(sideNav.className),
    sideAside ? sideAside.className : 'no sidebar');
  check('the sidebar sits beside a content area that fills the rest of the width',
    !!sideRow && /flex/.test(sideRow.className)
    && !!sideMain && /flex-1/.test(sideMain.className) && /min-w-0/.test(sideMain.className),
    sideMain ? sideMain.className : 'no content area');
  const headerText = sideHeader ? sideHeader.textContent || '' : '';
  const headerActions = [...(sideHeader?.querySelectorAll('a, button') || [])].map(el => el.textContent.trim()).filter(Boolean);
  check('the full-width header keeps the title, build stamp and only the Log Out action',
    !!sideHeader && sideHeader.tagName === 'HEADER'
    && /bg-white/.test(sideHeader.className) && /border-b/.test(sideHeader.className)
    && /Content manager/.test(headerText)
    && /build [0-9a-f]{7}/.test(headerText)
    && headerActions.join(',') === 'Log Out'
    && !/View live site/.test(headerText),
    headerActions.join(',') || headerText.slice(0, 120));
  const overviewCard = [...doc.querySelectorAll('section')].find(s => /CMS Overview/.test(s.textContent || ''));
  const overviewActions = [...(overviewCard?.querySelectorAll('a, button') || [])].filter(el => ['View live site ↗', 'Manage visibility', 'Log Out'].includes(el.textContent.trim()));
  const overviewActionLabels = overviewActions.map(el => el.textContent.trim());
  const overviewActionRow = overviewActions[0]?.parentElement;
  check('the CMS Overview card shows all three actions in the requested order on one row',
    overviewActionLabels.join(',') === 'View live site ↗,Manage visibility,Log Out'
    && !!overviewActionRow && /sm:flex-nowrap/.test(overviewActionRow.className) && /justify-end/.test(overviewActionRow.className),
    overviewActionLabels.join(','));
  check('the overview Log Out matches the white View live site button style',
    !!overviewActions[0] && !!overviewActions[2]
    && overviewActions[0].className === overviewActions[2].className
    && /bg-white/.test(overviewActions[2].className)
    && /text-slate-900/.test(overviewActions[2].className)
    && /rounded-xl/.test(overviewActions[2].className),
    overviewActions[2]?.className || 'missing Log Out action');
  check('the current area is highlighted and the others offer a hover state',
    [...sideNav.querySelectorAll('button')].some(b => /bg-indigo-600/.test(b.className))
    && [...sideNav.querySelectorAll('button')].every(b => /hover:bg-slate-100/.test(b.className) || /bg-indigo-600/.test(b.className)),
    'sidebar item styling');
  const burger = doc.querySelector('button[aria-label="Open navigation menu"]');
  check('the sidebar hides on mobile behind a hamburger button',
    !!burger && /md:hidden/.test(burger.className)
    && !!sideAside && /hidden md:block/.test(sideAside.className)
    && doc.querySelectorAll('[role="dialog"]').length === 0,
    burger ? burger.className : 'no hamburger');
  click(burger);
  await wait();
  const drawer = doc.querySelector('[role="dialog"]');
  const drawerLabels = [...(drawer?.querySelectorAll('nav button') || [])].map(b => b.textContent.trim());
  check('the mobile drawer lists the same nine areas in the same order',
    !!drawer && drawerLabels.join(',') === tabLabels.join(','),
    drawerLabels.join(','));
  click([...drawer.querySelectorAll('nav button')].find(b => b.textContent.trim() === 'Settings'));
  await wait();
  check('picking a drawer area closes it and loads that area',
    doc.querySelectorAll('[role="dialog"]').length === 0
    && /settings|storage/i.test((doc.getElementById('main-content') || doc).textContent || ''),
    'drawer after pick');
  click([...doc.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Competitor Analysis').pop());
  await wait();
  const section = doc.querySelector('section[aria-label="Competitor Analysis"]');
  const labels = ['Hero title', 'Hero subtitle', 'Intro paragraph', 'Your website label', 'Competitor website label', 'Button text', 'Fallback note', 'About heading', 'How to read heading', 'Benefits heading', 'FAQ heading'];
  check('the pane carries every header, input-area and section-heading field',
    !!section && labels.every(l => section.querySelector(`[aria-label="${l}"]`)) && adminErrors.length === 0,
    `${labels.filter(l => !section?.querySelector(`[aria-label="${l}"]`)).join(', ')} · ${adminErrors.join(' | ')}`);
  check('each section gets exactly one rich-text editor',
    [...section.querySelectorAll('[contenteditable="true"]')].length === 4,
    String([...section.querySelectorAll('[contenteditable="true"]')].length));
  check('Benefits and FAQs are one editor each — no per-item editors or row controls',
    !!section.querySelector('[aria-label="Benefits content"]')
    && !!section.querySelector('[aria-label="FAQs content"]')
    && !section.querySelector('[aria-label^="Benefit 1 title"]')
    && !section.querySelector('[aria-label^="FAQ 1 question"]')
    && !section.querySelector('[aria-label^="Move benefit"]')
    && !section.querySelector('[aria-label^="Move FAQ"]')
    && ![...section.querySelectorAll('button')].some(b => /\+ Add (benefit|FAQ)/.test(b.textContent)));

  setValue(section.querySelector('[aria-label="Benefits heading"]'), 'Why it helps');
  setValue(section.querySelector('[aria-label="Hero title"]'), 'Head-to-Head SEO Comparison');
  setValue(section.querySelector('[aria-label="Hero subtitle"]'), 'Compare two pages');
  setValue(section.querySelector('[aria-label="Your website label"]'), 'My site');
  setValue(section.querySelector('[aria-label="Competitor website label"]'), 'Rival site');
  setValue(section.querySelector('[aria-label="Button text"]'), 'Run the comparison');
  setValue(section.querySelector('[aria-label="Intro paragraph"]'), 'Paste two URLs and get one side-by-side report.');
  setValue(section.querySelector('[aria-label="Fallback note"]'), 'Blocked sites fall back to labelled sample data.');
  setValue(section.querySelector('[aria-label="About heading"]'), 'What this comparison does');
  setValue(section.querySelector('[aria-label="FAQ heading"]'), 'Competitor analysis questions');
  await wait();
  check('the edits live in the form before saving (no reload needed)',
    section.querySelector('[aria-label="Hero title"]').value === 'Head-to-Head SEO Comparison'
    && section.querySelector('[aria-label="Benefits heading"]').value === 'Why it helps');
  click([...section.querySelectorAll('button')].find(b => /Save Changes/.test(b.textContent)));
  await wait();
  check('saving the page shows "Saved ✓"', /Saved ✓/.test((section.textContent || '').replace(/\s+/g, ' ')));
  const stored = JSON.parse(dom.window.localStorage.getItem('seoaudittool:cms:v1') || '{}');
  const copy = stored.competitor || {};
  check('the whole page is persisted (header, labels, button, fallback note, sections)',
    copy.heroTitle === 'Head-to-Head SEO Comparison' && copy.heroSubtitle === 'Compare two pages'
    && copy.yourLabel === 'My site' && copy.theirLabel === 'Rival site' && copy.buttonText === 'Run the comparison'
    && copy.aboutHeading === 'What this comparison does' && copy.benefitsHeading === 'Why it helps'
    && copy.faqHeading === 'Competitor analysis questions',
    JSON.stringify(copy).slice(0, 200));
  check('benefits and FAQs are stored as one document each (no per-item arrays)',
    typeof copy.benefitsContent === 'string' && copy.benefitsContent.includes('<h3>A fair benchmark</h3>')
    && typeof copy.faqsContent === 'string' && copy.faqsContent.includes('<h3>What does the competitor analysis compare?</h3>')
    && copy.benefits === undefined && copy.faqs === undefined,
    `${(copy.benefitsContent || '').slice(0, 40)} | ${(copy.faqsContent || '').slice(0, 40)}`);
  click([...sideNav.querySelectorAll('button')].find(b => b.textContent.trim() === 'Dashboard'));
  await wait();
  const logoutOverview = [...doc.querySelectorAll('section')].find(s => /CMS Overview/.test(s.textContent || ''));
  const overviewLogoutButton = [...(logoutOverview?.querySelectorAll('button') || [])].find(b => b.textContent.trim() === 'Log Out');
  if (overviewLogoutButton) click(overviewLogoutButton);
  await wait();
  check('clicking overview Log Out clears the admin session and returns home',
    !!overviewLogoutButton
    && !dom.window.localStorage.getItem('ekstruh:admin-session:v1')
    && dom.window.location.pathname === '/',
    `${dom.window.location.pathname} · ${dom.window.localStorage.getItem('ekstruh:admin-session:v1') ? 'session remains' : 'session cleared'}`);
  dom.window.close();

  // the live page reflects the saved copy, and the tool itself still works
  const preload = `localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(JSON.stringify(stored))});`;
  const { dom: live, errors: liveErrors } = await boot(preload, '/competitor-analysis');
  const liveText = text(live).replace(/\s+/g, ' ');
  check('the saved copy is what visitors see on /competitor-analysis',
    liveText.includes('Head-to-Head SEO Comparison') && liveText.includes('Compare two pages')
    && liveText.includes('My site') && liveText.includes('Rival site')
    && liveText.includes('Run the comparison') && liveText.includes('Blocked sites fall back')
    && liveText.includes('What this comparison does') && liveText.includes('A fair benchmark')
    && liveText.includes('Competitor analysis questions'),
    liveText.slice(0, 140));
  check('the page layout survives the single-document sections',
    [...live.window.document.querySelectorAll('h3')].filter(h => ['A fair benchmark', 'Clear priorities', 'Better content briefs', 'Stronger internal linking', 'Faster reviews'].includes(h.textContent.trim())).length === 5
    && [...live.window.document.querySelectorAll('button')].filter(b => /^What does the competitor analysis compare\?/.test(b.textContent.trim())).length === 1,
    `${live.window.document.querySelectorAll('h3').length} h3s`);
  check('the comparison tool itself still renders its two inputs and button',
    !!live.window.document.querySelector('input[placeholder="https://yourwebsite.com/page"]')
    && !!live.window.document.querySelector('input[placeholder="https://competitor.com/page"]')
    && liveText.includes('Run the comparison')
    && liveErrors.length === 0,
    liveErrors.join(' | '));
  live.window.close();

  // A save made when every benefit / FAQ had its own editor still shows.
  const legacy = JSON.stringify({
    competitor: {
      heroTitle: 'Legacy title',
      benefits: [{ title: 'Legacy benefit', text: 'Legacy benefit text.' }],
      faqs: [{ question: 'Legacy question?', answer: '<p>Legacy answer.</p>' }],
    },
  });
  const { dom: legacyDom } = await boot(`localStorage.setItem('seoaudittool:cms:v1', ${JSON.stringify(legacy)});`, '/competitor-analysis');
  const legacyText = text(legacyDom).replace(/\s+/g, ' ');
  check('an older save (one editor per benefit / FAQ) folds into the single documents',
    legacyText.includes('Legacy title') && legacyText.includes('Legacy benefit')
    && legacyText.includes('Legacy benefit text.') && legacyText.includes('Legacy question?'),
    legacyText.slice(0, 140));
  legacyDom.window.close();
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
    /<h3class="heading-cardtext-\[18px\]font-boldcapitalizetracking-\[0px\]text-slate-400mb-4"/.test(compactCss),
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
