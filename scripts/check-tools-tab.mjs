/* Admin → Tools must never render a category content editor.
 *
 *   node scripts/check-tools-tab.mjs [path/to/index.html]
 *
 * Boots a built single-file copy of the site in jsdom, opens Admin → Tools,
 * filters the tool list by every category in turn and fails if the old
 * "Category page content" section (rich-text box, autosave note, empty-state
 * box or category field labels) appears for ANY of them — that block used to
 * live here and duplicate the editor in Admin → Tool Categories → Edit. The
 * second half asserts the opposite side: the Tool Categories row still carries
 * Content Above Tools, Content Below Tools — Before Footer, the SEO & Meta
 * Information panel with its noindex checkbox, and Save Changes.
 *
 * Needs jsdom, which is not a dependency of the site: npm i --no-save jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || path.join(here, '..', 'dist', 'index.html');
const { JSDOM, VirtualConsole } = await import('jsdom');

const raw = readFileSync(target, 'utf8');
console.log(`checking ${target} (${raw.length} bytes)`);

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${e ? ` — ${String(e).slice(0, 180)}` : ''}`)); };

// Cheapest possible signal, checked before the app is even booted: the removed
// copy should not exist anywhere in the bundle.
for (const gone of ['Category page content', 'Pick a category in the filter above']) {
  ok(`the built file contains no "${gone}" text`, !raw.includes(gone));
}

const mod = raw.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
if (!mod) { console.log('FAIL  no inlined module script found — is this the single-file build?'); process.exit(1); }
const session = JSON.stringify({ user: 'admin', remember: true, exp: Date.now() + 3_600_000 });
const boot = async (preload, route) => {
  let html = raw.replace(mod[0], '');
  const h = html.indexOf('<head>') + 6;
  html = html.slice(0, h) + `<script>${preload}</script>` + html.slice(h);
  const at = html.lastIndexOf('</body>');
  html = html.slice(0, at) + `<script>${mod[1]}</script>` + html.slice(at);
  const dom = new JSDOM(html, { url: `http://localhost${route}`, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  await new Promise(r => setTimeout(r, 900));
  return dom;
};

const dom = await boot(`localStorage.setItem('ekstruh:admin-session:v1', ${JSON.stringify(session)});`, '/admin');
const doc = dom.window.document;
const wait = (ms = 350) => new Promise(r => setTimeout(r, ms));
const click = el => el && el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const setValue = (el, v) => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
};
await wait(600);

const main = doc.getElementById('main-content') || doc.querySelector('main');
// The Dashboard has shortcut cards labelled exactly like the admin tabs, so the
// tab bar is found through the button that only it contains.
const tabBar = [...doc.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Dashboard')?.closest('div') || doc;
const clickTab = label => {
  const b = [...tabBar.querySelectorAll('button')].find(x => (x.textContent || '').trim() === label);
  if (!b) throw new Error(`tab button not found: ${label}`);
  click(b);
};

console.log('\n[A] Admin → Tools: no category editor for any category');
clickTab('Tools');
await wait();
const filter = main.querySelector('select[aria-label="Filter by category"]');
ok('the Tools tab rendered, with its search box and category filter',
  !!filter && !!main.querySelector('input[placeholder^="Search tools"]'));
let rows = 0;
for (const o of [...filter.options].filter(x => x.value !== 'all')) {
  setValue(filter, o.value);
  await wait();
  const t = (main.textContent || '').replace(/\s+/g, ' ');
  const seen = [...main.querySelectorAll('p.font-semibold')].filter(p => /\/[a-z0-9-]+/.test(p.parentElement?.textContent || ''));
  rows += seen.length;
  ok(`  ${o.textContent.trim().padEnd(26)} ${String(seen.length).padStart(2)} tool rows · no editor`,
    !/Category page content|Pick a category in the filter above|Content Above Tools|Content Below Tools|SEO & Meta Information/.test(t)
    && !main.querySelector('[aria-label$="category page content"]')
    && !main.querySelector('textarea[aria-label="Edit content above tools"]')
    && seen.length > 0, t.slice(0, 160));
}
console.log(`  (${rows} tool rows across all categories)`);
ok('every category still lists its tools', rows >= 150, `${rows}`);

setValue(filter, 'all');
await wait();
const buttons = [...main.querySelectorAll('button')].map(b => (b.textContent || '').trim());
ok('the Tools tab still has + Add tool and Edit/Hide/Delete per row',
  buttons.includes('+ Add tool') && buttons.filter(x => x === 'Edit').length > 100
  && buttons.includes('Hide') && buttons.includes('Delete'));
const paras = [...main.querySelectorAll('p')];
ok('the pane ends on the tool hint, not on an editor',
  /Built-in tools have live engines/.test(paras[paras.length - 1]?.textContent || ''),
  (paras[paras.length - 1]?.textContent || '').slice(0, 90));

console.log('\n[B] Admin → Tool Categories → Edit: all three editors intact');
clickTab('Tool Categories');
await wait();
const section = doc.querySelector('section[aria-label="Tool Categories"]');
ok('the Tool Categories pane lists all 11 categories',
  !!section && [...section.querySelectorAll('p.font-semibold')].length === 11,
  section ? `${section.querySelectorAll('p.font-semibold').length} rows` : 'no section');
for (const name of ['IP Tools', 'Keyword Tools', 'Calculator Tools']) {
  const label = [...section.querySelectorAll('p.font-semibold')].find(p => (p.textContent || '').trim() === name);
  const row = label.closest('div.flex.flex-col');
  click([...row.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Edit'));
  await wait();
  const panel = row.nextElementSibling;
  const txt = (panel?.textContent || '').replace(/\s+/g, ' ');
  ok(`  ${name}: Above + Below + SEO + noindex checkbox + Save Changes`,
    /Content Above Tools — appears after the heading/.test(txt) && /Content Below Tools — Before Footer/.test(txt)
    && /SEO & Meta Information/.test(txt) && !!panel.querySelector('input[type="checkbox"]') && /Save Changes/.test(txt),
    txt.slice(0, 160));
  click([...panel.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Close'));
  await wait(150);
}

console.log('\n[C] the admin header stamps the build');
clickTab('Dashboard');
await wait();
const header = [...doc.querySelectorAll('header')].map(h => (h.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ');
ok('a "build <sha> · <UTC>" line is rendered in the header',
  /build [0-9a-f]{7}\+? · \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/.test(header), header.slice(0, 200));
ok('the stamp names the Tools tab too, so any tab proves freshness',
  /Content manager/.test(header), header.slice(0, 80));

dom.window.close();
console.log(`\n=====  ${pass} passed, ${fail} failed  =====`);
process.exit(fail ? 1 : 0);
