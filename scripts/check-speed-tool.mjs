/* The Page Speed Checker, end to end, against a stubbed network.
 *
 *   node scripts/check-speed-tool.mjs [path/to/index.html]
 *
 * jsdom boots the built single-file app at /website-page-speed-checker and every
 * fetch is faked with a fixed delay: direct request -> CORS rejection, the
 * allorigins relay -> HTML after 260 ms, the markdown text reader -> 4000 ms,
 * every other relay -> 9000 ms of nothing. That mix is the point: the tool must
 * answer as soon as the relay lands (~0.3 s) rather than waiting for the slowest
 * probe, and it must actually render — the badge used to return <Src/> from
 * inside <Src/>, which killed the results panel on every successful fetch.
 *
 * Needs jsdom, which is not a dependency of the site: npm i --no-save jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || path.join(here, '..', 'dist', 'index.html');
const { JSDOM, VirtualConsole } = await import('jsdom');

const PAGE_HTML = `<!doctype html><html lang="en"><head><title>Test page about page speed</title>`
  + `<meta name="description" content="A test page with a sufficiently long description so the checker has something real to report on here.">`
  + `<meta name="viewport" content="width=device-width, initial-scale=1">`
  + `<link rel="canonical" href="https://example.com/"><link rel="stylesheet" href="/a.css">`
  + `<script src="/a.js"></script><script src="/b.js"></script></head><body>`
  + `<h1>Test page heading</h1><p>${'word '.repeat(400)}</p>`
  + `<img src="/i.png"><img src="/j.png" width="10" height="10">`
  + `<a href="/x">internal</a><a href="https://other.example/y">external</a></body></html>`;
const READER_MD = 'Title: Test page about page speed\nURL Source: https://example.com/\nMarkdown Content:\n# Test page heading\n\n' + 'word '.repeat(400);

/**
 * The bundle is inlined as a classic script, so its minified top-level names
 * share the global scope — a stub declaring `const M` at top level can collide
 * with one of them and take the whole page down. Keep the stub inside an IIFE.
 * `</script>` inside a string also closes the injected element, hence esc().
 */
const esc = v => JSON.stringify(v).replace(/<\//g, '<\\/');
const STUB = `(() => {
  const delay = (ms, make) => new Promise(res => setTimeout(() => res(make()), ms));
  const HTML = ${esc(PAGE_HTML)};
  const MD = ${esc(READER_MD)};
  window.__fetches = [];
  window.fetch = function (u) {
    const url = String(u);
    window.__fetches.push(url);
    if (url.indexOf('https://example.com/') === 0) return Promise.reject(new TypeError('CORS blocked'));
    if (url.indexOf('r.jina.ai') > -1) return delay(4000, () => ({ ok: true, text: () => Promise.resolve(MD) }));
    if (url.indexOf('allorigins') > -1) return delay(260, () => ({ ok: true, text: () => Promise.resolve(HTML) }));
    return delay(9000, () => ({ ok: false, text: () => Promise.resolve('') }));
  };
})();`;

const raw = readFileSync(target, 'utf8');
console.log(`checking ${target} (${raw.length} bytes)`);
const mod = raw.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
if (!mod) { console.log('FAIL  no inlined module script — is this the single-file build?'); process.exit(1); }
let html = raw.replace(mod[0], '');
const head = html.indexOf('<head>') + 6;
html = html.slice(0, head) + `<script>${STUB}</script>` + html.slice(head);
const bodyEnd = html.lastIndexOf('</body>');
html = html.slice(0, bodyEnd) + `<script>${mod[1]}</script>` + html.slice(bodyEnd);

const errors = [];
const vc = new VirtualConsole();
// scrollTo is a jsdom gap, not an app fault.
vc.on('jsdomError', e => { const m = String(e && e.message || e); if (!/scrollTo|Not implemented/.test(m)) errors.push(m); });
const dom = new JSDOM(html, { url: 'http://localhost/website-page-speed-checker', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1600);

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${e ? ` — ${String(e).slice(0, 160)}` : ''}`)); };

const main = dom.window.document.getElementById('main-content') || dom.window.document.querySelector('main');
ok('the speed checker page mounted', /Website Page Speed Checker/i.test(main.textContent || ''));
const input = [...main.querySelectorAll('input')][0];
const button = [...main.querySelectorAll('button')].find(b => /Check Speed/.test(b.textContent || ''));
ok('the URL field and the Check Speed button are present', !!input && !!button);
if (!input || !button) { console.log('\n=====  aborted  ====='); process.exit(1); }

const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
setValue.call(input, 'https://example.com/');
input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
await wait(100);
const t0 = Date.now();
button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
let text = '';
while (Date.now() - t0 < 12000) {
  await wait(100);
  text = (main.textContent || '').replace(/\s+/g, ' ');
  if (/Speed grade/.test(text)) break;
}
const ms = Date.now() - t0;

ok(`results rendered in ${ms} ms — the relay answered at 260 ms and the reader at 4000 ms, so this must be well under 1000`, ms < 1500);
ok('the grade, latency, size and 3G figures are all computed from the fetched HTML',
  /Speed grade ?[A-D]/.test(text) && /Server response \(HTML\) ?\d+ ms/.test(text)
  && /HTML size ?[\d.]+ KB/.test(text) && /Est\. HTML on 3G ?[\d.]+s/.test(text), text.slice(0, 200));
ok('recommendations are listed', /Recommendations \([1-9]\d*\)/.test(text));
ok('the source badge renders the live pill instead of recursing', /Live page data · ?\d+ ms/.test(text));
ok('the page is still intact after the results (no render error)', errors.length === 0, errors[0]);
const fetches = dom.window.eval('JSON.stringify(window.__fetches)') || '[]';
ok(`the relays and the reader were probed together (${JSON.parse(fetches).length} requests)`,
  JSON.parse(fetches).some(u => u.includes('allorigins')) && JSON.parse(fetches).some(u => u.includes('r.jina.ai')));

dom.window.close();
console.log(`\n=====  ${pass} passed, ${fail} failed  =====`);
process.exit(fail ? 1 : 0);
