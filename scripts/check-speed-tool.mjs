/* The Page Speed Checker, end to end, against a stubbed network.
 *
 *   node scripts/check-speed-tool.mjs [path/to/index.html]
 *
 * Pass the exact file you are about to upload (dist/index.html by default, and
 * public_html/index.html is what gets deployed) and the header line prints its
 * sha256 prefix, so there is no arguing about which build was tested.
 *
 * Three scenarios run against the same bundle, because the tool has three ways
 * to answer and each one used to break on its own:
 *
 *   RELAYS OK     direct request -> CORS rejection, the allorigins relay ->
 *                 HTML after 260 ms, the markdown reader -> 4000 ms, every other
 *                 relay -> 9 s of nothing. The tool must answer as soon as the
 *                 relay lands (~0.3 s) instead of waiting for the slowest probe,
 *                 and it must render: the badge used to return <Src/> from
 *                 inside <Src/>, which killed the results panel on every
 *                 successful fetch.
 *
 *   RELAYS HANG   nothing refuses, everything goes quiet. The visitor's own
 *                 no-cors request still succeeds in 380 ms, so after 8 s of
 *                 relay silence the tool must show that measurement instead of
 *                 spinning until its 16 s budget, and it must keep a Stop.
 *
 *   RELAYS REFUSE every proxy and the reader error out at 900 ms. A site that
 *                 blocks fetchers is still a site you can time, so this must
 *                 produce a grade, not an error.
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
const BODY = {
  ok: `if (url.indexOf('https://example.com/') === 0) return Promise.reject(new TypeError('CORS blocked'));
    if (url.indexOf('r.jina.ai') > -1) return t(4000, () => ({ ok: true, text: () => Promise.resolve(MD) }));
    if (url.indexOf('allorigins') > -1) return t(260, () => ({ ok: true, text: () => Promise.resolve(HTML) }));
    return t(9000, () => ({ ok: false, text: () => Promise.resolve('') }));`,
  hang: `if (url.indexOf('https://example.com/') === 0) return Promise.reject(new TypeError('CORS blocked'));
    return NEVER;`,
  refuse: `return t(900, null);`,
};
const stubFor = scenario => `(() => {
  const t = (ms, make) => new Promise((res, rej) => setTimeout(() => (make ? res(make()) : rej(new TypeError('Failed to fetch'))), ms));
  const NEVER = new Promise(() => {});
  const HTML = ${esc(PAGE_HTML)};
  const MD = ${esc(READER_MD)};
  const OPAQUE = () => ({ ok: false, status: 0, type: 'opaque', text: () => Promise.resolve(''), json: () => Promise.reject(new TypeError('opaque')) });
  window.__fetches = [];
  window.__copied = null;
  try {
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied = t; return Promise.resolve(); } } });
  } catch (e) {}
  window.fetch = function (u, init) {
    const url = String(u);
    const mode = (init && init.mode) || 'cors';
    window.__fetches.push(mode + ' ' + url);
    // A visitor's own browser can always *reach* the document; it just cannot
    // read an opaque response. That is what the proxy-free fallback measures.
    if (mode === 'no-cors') return t(380, OPAQUE);
    ${BODY[scenario]}
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

/** Boots the app at the speed-checker route, runs one check, reports what showed. */
async function runCheck(scenario, ceilingMs = 12000, opts = {}) {
  let html = raw.replace(mod[0], '');
  const head = html.indexOf('<head>') + 6;
  html = html.slice(0, head) + `<script>${stubFor(scenario)}</script>` + html.slice(head);
  const bodyEnd = html.lastIndexOf('</body>');
  html = html.slice(0, bodyEnd) + `<script>${mod[1]}</script>` + html.slice(bodyEnd);

  const errors = [];
  const vc = new VirtualConsole();
  // scrollTo is a jsdom gap, not an app fault.
  vc.on('jsdomError', e => { const m = String(e && e.message || e); if (!/scrollTo|Not implemented/.test(m)) errors.push(m); });
  const dom = new JSDOM(html, { url: 'http://localhost/website-page-speed-checker', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  await wait(1600);                                    // the app hydrates, then mounts the tool

  const main = dom.window.document.getElementById('main-content') || dom.window.document.querySelector('main');
  const mounted = /Website Page Speed Checker/i.test(main.textContent || '');
  const input = [...main.querySelectorAll('input')][0];
  const button = [...main.querySelectorAll('button')].find(b => /Check Speed/.test(b.textContent || ''));
  if (!input || !button) {
    dom.window.close();
    return { mounted: false, text: '', ms: -1, busyText: '', stopAt: null, stopAfter: null, errors, fetches: [], controls: 0, copied: null, copyLabel: '' };
  }
  const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  setValue.call(input, 'https://example.com/');
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await wait(100);
  const read = () => (main.textContent || '').replace(/\s+/g, ' ');
  const has = re => [...main.querySelectorAll('button')].some(b => re.test(b.textContent || ''));
  const t0 = Date.now();
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(100);
  const busyText = read();                             // spinner state, before any answer
  const stopAt = has(/Stop/);
  let text = busyText, ms = -1;
  while (Date.now() - t0 < ceilingMs) {
    await wait(100);
    text = read();
    if (/Speed grade|Grade [A-E]|Neither the relays/.test(text)) { ms = Date.now() - t0; break; }
  }
  if (ms < 0) ms = Date.now() - t0;
  const stopAfter = has(/Stop/);
  const controls = main.querySelectorAll('button').length;
  await wait(700);                                     // let the second probe settle
  const settledText = read();
  const fetches = JSON.parse(dom.window.eval('JSON.stringify(window.__fetches)') || '[]');
  let copied = null, copyLabel = '';
  if (opts.copy) {
    const cb = [...main.querySelectorAll('button')].find(b => /Copy summary|Copied/.test(b.textContent || ''));
    if (cb) {
      cb.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await wait(400);
      copyLabel = (cb.textContent || '').trim();
      copied = dom.window.eval('window.__copied || null');
    }
  }
  dom.window.close();
  return { mounted, text: settledText, earlyText: text, ms, busyText, stopAt, stopAfter, errors, fetches, controls, copied, copyLabel };
}

// ---------- RELAYS OK: the first usable answer wins, and it renders ----------
{
  const r = await runCheck('ok', 12000, { copy: true });
  ok('the speed checker page mounted and the Check Speed control is present', r.mounted && r.controls > 0);
  ok(`results rendered in ${r.ms} ms — the relay answered at 260 ms and the reader at 4000 ms, so this must be well under 1000`, r.ms > 0 && r.ms < 1500);
  ok('while it waits it says what it is doing and can be stopped', /Contacting the page|\(\d s\)|\(\ds\)/.test(r.busyText) && r.stopAt === true, r.busyText.slice(0, 200));
  const win = (() => { const i = r.text.indexOf('Est. HTML on 4G'); return i < 0 ? r.text.slice(0, 220) : r.text.slice(i, i + 260); })();
  ok('the score card, latency, size and 3G figures are all computed from the fetched HTML',
    /Grade [A-E]/.test(r.text) && /100 of 100 points measurable/.test(r.text) && /Server response \(HTML\) ?\d+ ms/.test(r.text)
    && /HTML size ?[\d.]+ KB/.test(r.text) && /Est\. HTML on 3G ?[\d.]+s/.test(r.text), r.text.slice(0, 260));
  ok('every factor is itemised with what was measured, the target and the points',
    /Score breakdown/.test(r.text) && /Server response ?\d+ ms ?under 300 ms ?\d+\/\d+/.test(r.text)
    && /Render-blocking requests/.test(r.text) && /Third-party origins/.test(r.text), r.text.slice(0, 400));
  ok('the report says how much of the model the data source could actually judge',
    /100 of 100 points measurable from this source/.test(r.text), (r.text.match(/\d+ of \d+ points measurable[^·]{0,40}/) || [''])[0]);
  ok('the page weight, blocking and DOM figures are broken out as tiles',
    /Scripts \(ext \/ total\) ?\d+ \/ \d+/.test(r.text) && /Render-blocking ?\d+/.test(r.text)
    && /Stylesheets ?\d+/.test(r.text) && /Inline CSS ?[\d.]+ KB/.test(r.text), r.text.slice(0, 400));
  ok('every origin the page pulls from is listed with a role',
    /What the page asks for \(\d+ shown\)/.test(r.text) && /Requests ?Types ?What it is/.test(r.text)
    && /this site/.test(r.text), (r.text.match(/What the page asks for[^]{0,120}/) || [''])[0]);
  ok('each request is listed in order with its blocking and third-party flags',
    /Requests in order/.test(r.text) && /script/.test(r.text) && /blocking/.test(r.text)
    && /stylesheet/.test(r.text), (r.text.match(/Requests in order[^]{0,160}/) || [''])[0]);
  ok('the load sequence separates what was measured from what was modelled',
    /Modelled load sequence/.test(r.text) && /Waiting for the server [\d,]+ ms measured/.test(r.text)
    && /HTML download [\d,]+ ms modelled/.test(r.text), (r.text.match(/Modelled load sequence[^]{0,200}/) || [''])[0]);
  ok('page facts answer the questions a report should carry',
    /Page facts/.test(r.text) && /Words \/ headings ?[\d,]+ · \d+ H1/.test(r.text)
    && /Structured data ?(JSON-LD found|none found) ?/.test(r.text) && /Charset \/ lang/.test(r.text), (r.text.match(/Page facts[^]{0,220}/) || [''])[0]);
  ok('the fixes are ranked by how many points each one is worth',
    /Priority fixes \(\d+\)/.test(r.text) && /target [^—]+ — /.test(r.text), (r.text.match(/Priority fixes \(\d+\)[^]{0,200}/) || [''])[0]);
  ok('the summary copies out as markdown for a ticket or an email',
    r.copyLabel === 'Copied ✓' && /# Page speed report/.test(r.copied || '') && /\| Score breakdown|\| Factor \| Measured/.test(r.copied || '')
    && /Priority fixes/.test(r.copied || ''), `${r.copyLabel} | ${String(r.copied).slice(0, 120)}`);
  ok('the source badge renders the live pill instead of recursing', /Live page data · ?\d+ ms/.test(r.text));
  ok('the proxy-free browser timing is shown next to the relay figure', /Your browser \(direct\) ?\d+ ms/.test(r.text), win);
  ok('the page is still intact after the results (no render error)', r.errors.length === 0, r.errors[0]);
  ok(`the relays and the reader were probed together (${r.fetches.length} requests)`,
    r.fetches.some(u => u.includes('allorigins')) && r.fetches.some(u => u.includes('r.jina.ai')));
}

// ---------- RELAYS HANG: show the measured number, keep the controls, no error ----------
{
  const r = await runCheck('hang', 11000);
  ok(`relay silence is cut short at ${r.ms} ms with a result instead of the 16 s budget`, r.ms > 0 && r.ms < 10500 && /Speed grade ?[A-D]/.test(r.earlyText), r.earlyText.slice(0, 220));
  ok('the grade is the visitor’s own round trip, timed not capped', /\d+ ms round trip/.test(r.earlyText) && /Your browser → server ?\d+ ms/.test(r.earlyText), r.earlyText.slice(0, 300));
  ok('it says the relays are still being tried', /relays are still being tried/i.test(r.earlyText) && /Still listening for the relays… \(\d+s\)/.test(r.earlyText), r.earlyText.slice(0, 300));
  ok('Stop stays available while the relays are still running', r.stopAfter === true);
  ok('a hung relay field never turns into a failure box', !/Neither the relays|could not be fetched|No relay or text reader/.test(r.text), r.text.slice(0, 200));
  ok('the browser probe ran alongside the relays, not after them', r.fetches.some(u => u.startsWith('no-cors ')) && r.fetches.some(u => u.includes('r.jina.ai')) && r.fetches.some(u => u.includes('allorigins')));
}

// ---------- RELAYS REFUSE: grade anyway, and name what is missing ----------
{
  const r = await runCheck('refuse', 9000);
  ok(`every relay refusing the page still produces a result in ${r.ms} ms, not an error`, r.ms > 0 && r.ms < 4000 && /Speed grade ?[A-D]/.test(r.text), r.text.slice(0, 220));
  const trip = Number((r.text.match(/(\d+) ms round trip/) || [])[1] || -1);
  ok(`the grade is the visitor's own round trip (${trip} ms, timed, not capped)`,
    trip > 250 && trip < 1200 && new RegExp(`Your browser → server ?${trip} ms`).test(r.text), r.text.slice(0, 300));
  ok('it says which part is missing instead of inventing it', /Page source ?unreachable/.test(r.text) && !/Server response \(HTML\)/.test(r.text));
  ok('no failure box is shown when the page did answer', !/could not be fetched|No relay or text reader|Neither the relays|replied with nothing usable/.test(r.text), r.text.slice(0, 220));
  ok('the hung-relay note is gone once the relays have actually refused', !/relays are still being tried/i.test(r.text));
  ok('the refused-relay run leaves the page intact', r.errors.length === 0, r.errors[0]);
}

console.log(`\n=====  ${pass} passed, ${fail} failed  =====`);
process.exit(fail ? 1 : 0);
