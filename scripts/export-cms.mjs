/**
 * Write the site's built-in CMS content to public/cms-content.json.
 *
 *   npm run build          # needs dist/index.html
 *   npm i --no-save jsdom  # only needed for this script
 *   node scripts/export-cms.mjs
 *
 * Why this exists: the CMS ships its content compiled into dist/index.html and
 * a visitor's edits live in their own localStorage, so the repository has no
 * JSON snapshot of what the site actually says. `public/cms-content.json` is
 * that snapshot. Because it sits in `public/`, Vite copies it into `dist/` on
 * every build, so the deployed `public_html` carries it too and an admin can
 * pull the exact shipped content back in with Admin → Export/Import JSON.
 *
 * The file is produced by running the real bundle in jsdom — never by
 * re-implementing the store — in three passes:
 *
 *   1. boot with an empty localStorage: the store writes its raw seeded state
 *      to `seoaudittool:cms:v1`;
 *   2. boot again with that snapshot preloaded: `load()` now runs the stored
 *      pages through `withPageContent()`, which turns the seeded `blocks` into
 *      real `content` HTML. Reading it back gives the resolved state, so the
 *      snapshot keeps its bodies even though `blocks` is dropped (this is what
 *      `exportJson()` does) — a snapshot taken straight from pass 1 would ship
 *      six pages with an empty `content` and import as blank;
 *   3. boot a third time with the finished file preloaded and load `/about`,
 *      proving the JSON we just wrote really imports and renders.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distFile = path.join(root, 'dist/index.html');
const outFile = path.join(root, 'public/cms-content.json');
const KEY = 'seoaudittool:cms:v1';

let JSDOM;
let VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  console.error('This script needs jsdom: npm i --no-save jsdom');
  process.exit(1);
}

const rawHtml = readFileSync(distFile, 'utf8');

// jsdom cannot execute ES modules, so the inlined module script is moved to the
// end of <body> and run as a classic script — the bundle has no
// import/export/import.meta, so this is equivalent (same trick as
// scripts/verify-single-file.mjs).
const inline = rawHtml.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
if (!inline) throw new Error('inline module script not found in dist/index.html — run npm run build first');

/** Boot the built document once; `preload` runs before the app does. */
const boot = async (preload = '', route = '/', waitMs = 900) => {
  let html = rawHtml.replace(inline[0], '');
  if (preload) {
    const head = html.indexOf('<head>') + '<head>'.length;
    html = html.slice(0, head) + `<script>${preload.replace(/</g, '\\u003c')}</script>` + html.slice(head);
  }
  // The app code contains the text "</body>" inside strings, so the real
  // landmark is the last occurrence.
  const at = html.lastIndexOf('</body>');
  html = html.slice(0, at) + `<script>${inline[1]}</script>` + html.slice(at);

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', e => {
    const message = String((e && e.message) || e);
    if (!/Not implemented/.test(message)) errors.push(message); // jsdom has no layout engine
  });
  const dom = new JSDOM(html, { url: `http://localhost${route}`, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole });
  await new Promise(resolve => setTimeout(resolve, waitMs));
  return { dom, errors };
};

const readState = dom => {
  const raw = dom.window.localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
};

/* pass 1 — the raw seeded state the store writes on a first visit */
const seeded = await boot().then(async ({ dom, errors }) => {
  const state = readState(dom);
  dom.window.close();
  if (!state) throw new Error(errors.length ? `jsdom errors:\n${errors.join('\n')}` : `the app never wrote ${KEY} to localStorage`);
  return state;
});

/* pass 2 — the same state after `load()` has resolved it: page `content` is
 * filled in from the seeded `blocks`, exactly as a visitor sees it. */
const resolved = await boot(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(seeded))});`)
  .then(async ({ dom, errors }) => {
    const state = readState(dom);
    dom.window.close();
    if (!state) throw new Error(`second pass produced no ${KEY}${errors.length ? `:\n${errors.join('\n')}` : ''}`);
    return state;
  });

// Mirror exportJson() in src/cms/Admin.tsx: page bodies ship as `content`, the
// legacy `blocks` array is dropped.
const snapshot = { ...resolved, pages: (resolved.pages || []).map(({ blocks: _blocks, ...rest }) => rest) };

const blank = snapshot.pages.filter(p => !(p.content || '').trim()).map(p => p.slug);
if (blank.length) throw new Error(`refusing to write blank page bodies: ${blank.join(', ')}`);

writeFileSync(outFile, JSON.stringify(snapshot, null, 2) + '\n');

/* pass 3 — import the file we just wrote and render a page from it */
// The built document ships with the home page prerendered, so this pass has to
// wait long enough for React to hydrate and route to /about before it asserts.
const roundTrip = await boot(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(readFileSync(outFile, 'utf8'))});`, '/about', 3000);
{
  // Assert on <main>, not <body>: the built document also carries the
  // prerendered home page in a hidden node, so <body> text is not the page.
  const doc = roundTrip.dom.window.document;
  const body = doc.querySelector('main')?.textContent || '';
  const errors = roundTrip.errors;
  roundTrip.dom.window.close();
  const ok = doc.querySelector('main h1')?.textContent === 'About SEO Audit Tools'
    && errors.length === 0 && body.includes('Who We Are') && !body.includes('Page not available');
  if (!ok) {
    throw new Error(`the written file does not import cleanly — errors: ${errors.join(' | ') || 'none'}; `
      + `/about body (${body.length} chars): ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
  }
}

const kb = (readFileSync(outFile).length / 1024).toFixed(1);
console.log(`wrote public/cms-content.json  ${kb} kB`);
console.log(`  version ${snapshot.version} · ${snapshot.pages.length} pages · ${snapshot.tools.length} tools · ${snapshot.posts.length} posts`);
console.log(`  pages: ${snapshot.pages.map(p => `${p.slug} (${(p.content.length / 1024).toFixed(1)} kB)`).join(', ')}`);
console.log(`  site: ${snapshot.settings.name} (${snapshot.settings.domain})`);
console.log('  round trip: imports and renders /about with no script errors');
