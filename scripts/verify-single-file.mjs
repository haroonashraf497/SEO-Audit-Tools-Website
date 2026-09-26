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
        { id: 'a', label: 'Privacy Policy', href: '/privacy-policy', visible: true },
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

  const clickLink = href => {
    const link = doc.querySelector(`a[href="${href}"]`);
    if (!link) throw new Error(`no link to ${href}`);
    link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  clickLink('/blog');
  // Deliberately no await: a discrete click is flushed synchronously by React,
  // so the new route must already be on screen when the dispatch returns.
  const blogNow = (main.textContent || '').trim();
  check('click on /blog renders the blog in the same task (zero delay)',
    blogNow.includes('Blog') && !/Loading page|Loading PDF engine/i.test(blogNow), blogNow.slice(0, 60));
  check('the URL has already changed with the content', dom.window.location.pathname === '/blog', dom.window.location.pathname);

  clickLink('/free-tools');
  const toolsNow = (main.textContent || '').trim();
  check('click on /free-tools renders the tools list in the same task',
    toolsNow.includes('Tools') && !/Loading page|Loading PDF engine/i.test(toolsNow), toolsNow.slice(0, 60));

  const frames = dom.window.__frameLog;
  check('no empty frame between the two pages',
    frames.length > 0 && frames.every(len => len > 0), JSON.stringify(frames.slice(0, 12)));
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

const failed = results.filter(result => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
