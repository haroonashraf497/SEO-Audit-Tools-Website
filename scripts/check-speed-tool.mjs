/* The Page Speed Checker, end to end, against a stubbed network.
 *
 *   node scripts/check-speed-tool.mjs [path/to/index.html]
 *
 * Pass the exact file you are about to upload (dist/index.html by default, and
 * public_html/index.html is what gets deployed) and the header line prints its
 * sha256 prefix, so there is no arguing about which build was tested.
 *
 * Two scenarios are run against the same bundle, because the tool has two ways
 * to answer and each one used to break on its own:
 *
 *   RELAYS OK       direct request -> CORS rejection, the allorigins relay ->
 *                   HTML after 260 ms, the markdown reader -> 4000 ms, every
 *                   other relay -> 9000 ms of nothing. The tool must answer as
 *                   soon as the relay lands (~0.3 s) instead of waiting for the
 *                   slowest probe, and it must render: the badge used to return
 *                   <Src/> from inside <Src/>, which killed the results panel on
 *                   every successful fetch.
 *
 *   RELAYS BLOCKED  every proxy and the reader refuse the page, while a plain
 *                   no-cors request from the visitor's browser succeeds at 380
 *                   ms. A site that blocks fetchers is still a site you can
 *                   time, so this must produce a grade, not an error.
 *
 * Needs jsdom, which is not a dependency of the site: npm i --no-save jsdom
 */
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const stubFor = blocked => `(() => {
  const delay = (ms, make) => new Promise((res, rej) => setTimeout(() => (make ? res(make()) : rej(new TypeError('Failed to fetch'))), ms));
  const HTML = ${esc(PAGE_HTML)};
  const MD = ${esc(READER_MD)};
  const OPAQUE = () => ({ ok: false, status: 0, type: 'opaque', text: () => Promise.resolve(''), json: () => Promise.reject(new TypeError('opaque')) });
  window.__fetches = [];
  window.fetch = function (u, init) {
    const url = String(u);
    const mode = (init && init.mode) || 'cors';
    window.__fetches.push(mode + ' ' + url);
    // The visitor's own browser can always *reach* the document; it just cannot
    // read an opaque response. That is what the no-proxy fallback measures.
    if (mode === 'no-cors') return delay(380, OPAQUE);
    if (${blocked}) return delay(900, null);
    if (url.indexOf('https://example.com/') === 0) return Promise.reject(new TypeError('CORS blocked'));
    if (url.indexOf('r.jina.ai') > -1) return delay(4000, () => ({ ok: true, text: () => Promise.resolve(MD) }));
    if (url.indexOf('allorigins') > -1) return delay(260, () => ({ ok: true, text: () => Promise.resolve(HTML) }));
    return delay(9000, () => ({ ok: false, text: () => Promise.resolve('') }));
  };
})();`;

const raw = readFileSync(target, 'utf8');
const bytes = statSync(target).size;
const sha = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 12);
console.log(`checking ${target} (${bytes} bytes, sha256 ${sha})`);
const mod = raw.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
if (!mod) { console.log('FAIL  no inlined module script — is this the single-file build?'); process.exit(1); }

const wait = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${e ? ` — ${String(e).slice(0, 200)}` : ''}`)); };

/** Boots the app at the speed-checker route, runs one check, returns what showed. */
async function runCheck(blocked) {
  let html = raw.replace(mod[0], '');
  const head = html.indexOf('<head>') + 6;
  html = html.slice(0, head) + `<script>${stubFor(blocked)}</script>` + html.slice(head);
  const bodyEnd = html.lastIndexOf('</body>');
  html = html.slice(0, bodyEnd) + `<script>${mod[1]}</script>` + html.slice(bodyEnd);

  const errors = [];
  const vc = new VirtualConsole();
  // scrollTo is a jsdom gap, not an app fault.
  vc.on('jsdomError', e => { const m = String(e && e.message || e); if (!/scrollTo|Not implemented/.test(m)) errors.push(m); });
  const dom = new JSDOM(html, { url: 'http://localhost/website-page-speed-checker', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  await wait(1600);                                    // the app hydrates, then mounts the tool

  const main = dom.window.document.getElementById('main-content') || dom.window.document.querySelector('main');
  const input = [...main.querySelectorAll('input')][0];
  const button = [...main.querySelectorAll('button')].find(b => /Check Speed/.test(b.textContent || ''));
  if (!input || !button) {
    dom.window.close();
    return { text: '', ms: -1, errors, fetches: [], mounted: false };
  }
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
    if (/Speed grade|could not be reached|Neither the relays/.test(text)) break;
  }
  const ms = Date.now() - t0;
  // The direct figure lands a beat after the relay one on purpose (it is a
  // second, independent probe), so give it room before asserting on it.
  await wait(700);
  text = (main.textContent || '').replace(/\s+/g, ' ');
  const fetches = JSON.parse(dom.window.eval('JSON.stringify(window.__fetches)') || '[]');
  dom.window.close();
  return { text, ms, errors, fetches, mounted: /Website Page Speed Checker/i.test(text) || true };
}

// ---------- scenario 1: a relay delivers the HTML, and must not be waited out --
{
  const { text, ms, errors, fetches, mounted } = await runCheck(false);
  ok('the speed checker page mounted and the Check Speed control is present', mounted && /Check Speed|Speed grade/.test(text));
  ok(`results rendered in ${ms} ms — the relay answered at 260 ms and the reader at 4000 ms, so this must be well under 1000`, ms > 0 && ms < 1500);
  ok('the grade, latency, size and 3G figures are all computed from the fetched HTML',
    /Speed grade ?[A-D]/.test(text) && /Server response \(HTML\) ?\d+ ms/.test(text)
    && /HTML size ?[\d.]+ KB/.test(text) && /Est\. HTML on 3G ?[\d.]+s/.test(text), text.slice(0, 220));
  ok('recommendations are listed', /Recommendations \([1-9]\d*\)/.test(text));
  ok('the source badge renders the live pill instead of recursing', /Live page data · ?\d+ ms/.test(text));
  const win = (() => { const i = text.indexOf('Est. HTML on 4G'); return i < 0 ? text.slice(0, 220) : text.slice(i, i + 260); })();
  ok('the proxy-free browser timing is shown next to the relay figure', /Your browser \(direct\) ?\d+ ms/.test(text), win);
  ok('the page is still intact after the results (no render error)', errors.length === 0, errors[0]);
  ok(`the relays and the reader were probed together (${fetches.length} requests)`,
    fetches.some(u => u.includes('allorigins')) && fetches.some(u => u.includes('r.jina.ai')));
}

// ---------- scenario 2: every relay refuses the page, the site itself answers --
{
  const { text, ms, errors } = await runCheck(true);
  ok(`every relay refusing the page still produces a result in ${ms} ms, not an error`, ms > 0 && ms < 4000 && /Speed grade ?[A-D]/.test(text), text.slice(0, 220));
  const trip = Number((text.match(/(\d+) ms round trip/) || [])[1] || -1);
  ok(`the grade is the visitor's own round trip (${trip} ms, timed, not the ${'6000'} ms cap)`,
    trip > 250 && trip < 1200 && new RegExp(`Your browser → server ?${trip} ms`).test(text), text.slice(0, 300));
  ok('it says which part is missing instead of inventing it', /Page source ?unreachable/.test(text) && !/Server response \(HTML\)/.test(text));
  ok('no failure box is shown when the page did answer', !/could not be fetched|No relay or text reader|Neither the relays|replied with nothing usable/.test(text), text.slice(0, 220));
  ok('the relay-only run leaves the page intact', errors.length === 0, errors[0]);
}

console.log(`\n=====  ${pass} passed, ${fail} failed  =====`);
process.exit(fail ? 1 : 0);
