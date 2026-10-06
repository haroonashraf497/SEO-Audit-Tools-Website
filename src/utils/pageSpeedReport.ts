/**
 * Page Speed Checker: turn one fetched document into an actual report.
 *
 * Everything here is derived from data the tool already has — the raw HTML, the
 * measured round trip and the counts `pageFetch` extracted — so adding detail
 * costs the visitor no extra requests and no extra waiting. Anything that would
 * need a second network call (asset byte sizes, compression headers, real
 * render timings) is reported as unknown instead of guessed, and the modelled
 * figures say so out loud.
 */
import type { LivePageData } from './pageFetch';

export type State = 'good' | 'warn' | 'bad' | 'unknown';
export type Factor = {
  key: string;
  label: string;
  value: string;
  target: string;
  weight: number;
  earned: number;
  state: State;
  fix: string;
};
export type AssetRow = { kind: string; host: string; src: string; blocking: boolean; thirdParty: boolean };
export type HostRow = { host: string; requests: number; kinds: string; role: string; thirdParty: boolean };
export type TimelineStep = { label: string; ms: number; modelled: boolean; note: string };
export type PageSpeedReport = {
  score: number;
  grade: string;
  factors: Factor[];
  assets: AssetRow[];
  hosts: HostRow[];
  timeline: TimelineStep[];
  facts: { label: string; value: string }[];
  counts: { label: string; value: string; state: State }[];
  fixes: string[];
  /** How much of the 100-point model this data source could actually score. */
  coverage: { points: number; of: number };
};

const ROLES: [RegExp, string][] = [
  [/google-analytics|googletagmanager|doubleclick|googleadservices|gstatic\.com\/analytics/i, 'Analytics / ads (Google)'],
  [/facebook\.net|connect\.facebook|fbcdn/i, 'Facebook pixel / social'],
  [/tiktok|snapchat|twitter\.com\/i\/|platform\.twitter/i, 'Other social / pixel'],
  [/hotjar|clarity\.ms|mouseflow|fullstory|logrocket|crazyegg/i, 'Session recording / heatmaps'],
  [/recaptcha|google\.com\/safebrowsing|hcaptcha|datadome|perimeterx|geo\.js/i, 'Bots & captcha'],
  [/fonts\.googleapis|fonts\.gstatic|typekit|use\.typekit|fontawesome|khansora|font\.com/i, 'Web fonts'],
  [/youtube|vimeo|wistia|dailymotion/i, 'Embedded video'],
  [/cdn-cgi|cloudfront|fastly|akamai|netdna|jsdelivr|unpkg|cdnjs|cdn77|bunnycdn|imperva|incapsula/i, 'CDN / shared libraries'],
  [/shopify|myspace|klaviyo|attentive|yotpo|judge\.me|loox|stamped/i, 'E-commerce apps'],
  [/stripe|paypal|braintree|checkout\.com/i, 'Payments'],
];
const roleFor = (host: string) => (ROLES.find(([re]) => re.test(host)) || [null, 'Other third party'])[1] as string;
const hostOf = (u: string) => { try { return new URL(u, 'http://x').host; } catch { return u.split('/')[0] || ''; } };
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const band = (ms: number, good: number, warn: number, worst: number) =>
  ms <= good ? 1 : ms <= warn ? 1 - 0.6 * clamp((ms - good) / (warn - good)) : 1 - 0.6 * 1 - 0.4 * clamp((ms - warn) / (worst - warn));
const kb = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`);
const stateOf = (ratio: number): State => (ratio >= 0.99 ? 'good' : ratio >= 0.6 ? 'warn' : 'bad');

/**
 * Parse the document once for the things `pageFetch` does not count: which
 * resources the page asks for, whether they block rendering, and how deep the
 * markup goes.
 */
function inspect(html: string, origin: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const assets: AssetRow[] = [];
  const push = (kind: string, el: Element, blocking: boolean, attrs: string) => {
    const src = el.getAttribute('src') || el.getAttribute('href') || '';
    if (!src || /^(data|blob|javascript):/i.test(src)) return;
    const host = hostOf(src);
    assets.push({ kind, host: host || origin, src: attrs ? `${src.slice(0, 78)} · ${attrs}` : src.slice(0, 78), blocking, thirdParty: !!host && host !== origin });
  };
  doc.querySelectorAll('script[src]').forEach(el => {
    const async = el.hasAttribute('async') || el.hasAttribute('type="module"') || /defer/.test(el.outerHTML);
    const defer = el.hasAttribute('defer') || el.getAttribute('type') === 'module';
    push('script', el, !async && !defer, async ? 'async' : defer ? 'defer' : 'blocking');
  });
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => push('stylesheet', el, true, ''));
  doc.querySelectorAll('link[rel="preload"],link[rel="preconnect"],link[rel="dns-prefetch"],link[rel="modulepreload"]').forEach(el =>
    push(el.getAttribute('rel') || 'preload', el, false, ''));
  doc.querySelectorAll('img').forEach(el => {
    const lazy = el.getAttribute('loading') === 'lazy';
    push('image', el, !lazy && el.closest('head') !== null,
      [!el.hasAttribute('width') && 'no dimensions', !el.hasAttribute('srcset') && 'no srcset', el.getAttribute('fetchpriority') === 'high' && 'fetchpriority=high', lazy && 'lazy'].filter(Boolean).join(', ') || 'ok');
  });
  doc.querySelectorAll('iframe').forEach(el => push('iframe', el, true, ''));
  doc.querySelectorAll('video,audio').forEach(el => push('media', el, true, ''));

  let nodes = 0, depth = 0;
  const walk = (n: Element, d: number) => {
    nodes += 1;
    if (d > depth) depth = d;
    for (const c of Array.from(n.children)) walk(c, d + 1);
  };
  if (doc.body) walk(doc.body, 1);

  const inlineScript = Array.from(doc.querySelectorAll('script:not([src])')).reduce((a, el) => a + (el.textContent || '').length, 0);
  const inlineStyle = Array.from(doc.querySelectorAll('style')).reduce((a, el) => a + (el.textContent || '').length, 0);
  const styleAttrs = doc.querySelectorAll('[style]').length;
  const fontFaces = Array.from(doc.querySelectorAll('style')).filter(el => /@font-face/i.test(el.textContent || '')).length;
  const sw = /serviceWorker\.register|navigator\.serviceWorker/.test(html);

  return { assets, nodes, depth, inlineScript, inlineStyle, styleAttrs, fontFaces, sw, doc };
}

export function buildReport(d: LivePageData, directMs: number | null = null): PageSpeedReport {
  const markup = !d.reader;                       // the text reader cannot see markup
  const origin = hostOf(d.finalUrl || '');
  const view = markup ? inspect(d.html, origin) : null;

  // The score: six things a host can actually change, weighted by how much they
  // usually move a real PageSpeed run.
  const ttfb = markup ? d.fetchMs : (directMs ?? d.fetchMs);
  const f: Record<string, Factor> = {};
  const add = (key: string, label: string, weight: number, ratio: number, value: string, target: string, fix: string, state?: State) => {
    const r = clamp(ratio);
    f[key] = { key, label, value, target, weight, earned: Math.round(weight * r), state: state ?? stateOf(r), fix };
  };

  add('ttfb', 'Server response', 25, band(ttfb, 300, 900, 3000), `${ttfb} ms`, 'under 300 ms',
    'Slow first byte is host or origin work: enable PHP/DB caching, keep the object cache warm, or move the origin closer to your audience.');
  add('html', 'HTML payload', 15, d.codeSize < 40000 ? 1 : 1 - clamp((d.codeSize - 40000) / 260000), kb(d.codeSize), 'under 40 KB',
    'Trim the markup that is not needed to paint: inline SVG sprites, page-builder wrappers and unused blocks.');
  const blocking = view ? view.assets.filter(a => a.blocking).length : 0;
  add('blocking', 'Render-blocking requests', 15, blocking === 0 ? 1 : 1 - clamp(blocking / 14), markup ? `${blocking}` : '—', '0 in <head>',
    'defer/async scripts and split critical CSS so the first paint does not wait on the whole head.');
  add('scripts', 'External scripts', 10, d.externalScripts <= 6 ? 1 : 1 - clamp((d.externalScripts - 6) / 24), `${d.externalScripts} external / ${d.scripts} total`, '6 or fewer',
    'Every tag manager, pixel and widget is a request plus parse time; keep only what earns it.');
  add('css', 'Stylesheet requests', 10, d.stylesheets <= 2 ? 1 : 1 - clamp((d.stylesheets - 2) / 8), `${d.stylesheets}`, '1-2',
    'Bundle CSS and inline the critical part; one file beats six for the same bytes.');
  const imgs = d.imageCount;
  const imgScore = imgs === 0 ? 1 : ((view ? view.assets.filter(a => a.kind === 'image' && !a.blocking).length : 0) / Math.max(1, imgs)) * 0.6 + (d.imagesWithoutDimensions === 0 ? 0.4 : clamp(0.4 - d.imagesWithoutDimensions / (imgs * 2.5)));
  add('images', 'Image handling', 10, imgScore, imgs ? `${imgs} images, ${d.imagesWithoutDimensions} without dimensions` : 'no images', 'sized, lazy, srcset',
    'Width/height prevents layout shift, loading="lazy" defers below-the-fold, srcset stops phones downloading desktop files.');
  add('dom', 'DOM size', 5, !view ? 1 : view.nodes < 900 ? 1 : 1 - clamp((view.nodes - 900) / 3600), view ? `${view.nodes.toLocaleString()} nodes · depth ${view.depth}` : '—', 'under 900 nodes',
    'A big tree costs style and layout on every frame, not just the first paint.');
  add('text', 'Code-to-text ratio', 5, clamp((d.textRatio - 5) / 20), `${d.textRatio}%`, 'over 25%',
    'Template bloat costs download and parse for content nobody sees.');
  const hosts = (() => {
    const m = new Map<string, { n: number; kinds: Set<string> }>();
    (view?.assets || []).forEach(a => {
      const k = m.get(a.host) || { n: 0, kinds: new Set<string>() };
      k.n += 1; k.kinds.add(a.kind); m.set(a.host, k);
    });
    const rows: HostRow[] = Array.from(m.entries()).map(([host, v]) => ({
      host, requests: v.n, kinds: Array.from(v.kinds).sort().join(', '), role: host === origin ? 'This site' : roleFor(host), thirdParty: host !== origin,
    }));
    return rows.sort((x, y) => y.requests - x.requests);
  })();
  const thirdPartyRequests = hosts.filter(h => h.thirdParty).reduce((a, h) => a + h.requests, 0);
  add('third', 'Third-party origins', 5, hosts.length <= 3 ? 1 : 1 - clamp((hosts.filter(h => h.thirdParty).length - 1) / 8),
    markup ? `${hosts.filter(h => h.thirdParty).length} origins · ${thirdPartyRequests} requests` : '—', 'a handful',
    'Third-party scripts are the least controllable part of a page: you cannot cache, compress or time them.');

  // A page that only came back through the text reader has no markup to count.
  // Those factors are dropped from the score instead of being awarded full
  // marks for zeros or blamed as failures: the panel says what was measurable.
  if (!markup) {
    (['blocking', 'scripts', 'css', 'images', 'dom', 'text', 'third', 'html'] as const).forEach(k => {
      if (f[k]) f[k] = { ...f[k], weight: 0, earned: 0, state: 'unknown', value: 'not visible to the reader' };
    });
  }

  const factors = Object.values(f);
  const scored = factors.filter(x => x.weight > 0);
  const score = Math.round(scored.reduce((a, x) => a + x.earned, 0) / Math.max(1, scored.reduce((a, x) => a + x.weight, 0)) * 100);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'E';

  // Modelled timeline: measured first, estimated after, and each bar says which.
  const bw = { fast: 50e6 / 8, four: 9e6 / 8, three: 1.6e6 / 8 };
  const transfer = (bytes: number, rate: number) => Math.round((bytes / rate) * 1000);
  const timeline: TimelineStep[] = [
    { label: 'Waiting for the server', ms: ttfb, modelled: false, note: 'measured from this browser through the fetch relay' },
    { label: 'HTML download', ms: transfer(d.codeSize, bw.four), modelled: true, note: `${kb(d.codeSize)} over 4G, uncompressed` },
    { label: 'Render-blocking requests', ms: blocking * 120, modelled: true, note: `${blocking} requests × ~120 ms each (network + parse heuristic)` },
    { label: 'Script evaluation', ms: d.externalScripts * 45 + Math.round((view?.inlineScript || 0) / 4096) * 30, modelled: true, note: 'heuristic on request count and inline bytes' },
  ];

  const counts: PageSpeedReport['counts'] = [
    { label: 'Scripts', value: `${d.scripts} (${d.externalScripts} external)`, state: d.externalScripts > 12 ? 'bad' : d.externalScripts > 6 ? 'warn' : 'good' },
    { label: 'Stylesheets', value: `${d.stylesheets}`, state: d.stylesheets > 4 ? 'warn' : 'good' },
    { label: 'Blocking', value: markup ? `${blocking}` : '—', state: markup ? (blocking ? 'bad' : 'good') : 'unknown' },
    { label: 'Images', value: `${imgs}${imgs ? ` · ${d.imagesWithoutDimensions} unsized` : ''}`, state: imgs === 0 ? 'good' : d.imagesWithoutDimensions ? 'warn' : 'good' },
    { label: 'Iframes / media', value: `${d.iframes}`, state: d.iframes > 2 ? 'warn' : 'good' },
    { label: 'Inline CSS', value: view ? kb(view.inlineStyle) : '—', state: view ? (view.inlineStyle > 30000 ? 'warn' : 'good') : 'unknown' },
    { label: 'Inline JS', value: view ? kb(view.inlineScript) : '—', state: view ? (view.inlineScript > 60000 ? 'warn' : 'good') : 'unknown' },
    { label: 'style="" attrs', value: view ? `${view.styleAttrs}` : '—', state: view ? (view.styleAttrs > 40 ? 'warn' : 'good') : 'unknown' },
  ];

  const facts: { label: string; value: string }[] = [
    { label: 'Document', value: `${kb(d.codeSize)} · ${d.textSize > 0 ? `${Math.round(d.textSize / 1024)} KB text` : 'text size n/a'}` },
    { label: 'Words / headings', value: `${d.wordCount.toLocaleString()} · ${(d.h1s || []).length} H1, ${Object.values(d.headingCounts || {}).reduce((a: number, n) => a + (n as number), 0)} headings total` },
    { label: 'Links', value: `${d.internalLinks} internal, ${d.externalLinks} external (${d.nofollowLinks} nofollow)` },
    { label: 'Forms', value: `${d.forms}` },
    { label: 'Charset / lang', value: `${d.charset ? 'declared' : 'missing'} / ${d.lang || 'missing'}` },
    { label: 'Viewport', value: d.viewport ? 'present' : 'missing' },
    { label: 'Canonical', value: d.canonical || (markup ? 'not declared' : 'unknown via reader') },
    { label: 'Structured data', value: d.hasJsonLd ? 'JSON-LD found' : 'none found' },
    { label: 'Social cards', value: [d.ogTitle && 'og:title', d.ogImage && 'og:image', d.twitterCard && 'twitter:card'].filter(Boolean).join(', ') || 'none' },
    { label: 'Fonts', value: view ? (view.fontFaces ? `${view.fontFaces} inline @font-face block(s)` : 'no inline @font-face (external CSS not readable here)') : '—' },
    { label: 'Service worker', value: view ? (view.sw ? 'registers one' : 'not found in the document') : '—' },
    { label: 'Generator', value: d.generator || 'none exposed' },
  ];

  const fixes = factors.filter(x => x.state === 'bad' || x.state === 'warn')
    .sort((a, b) => (b.weight - b.earned) - (a.weight - a.earned))
    .map(x => `${x.label}: ${x.value} (target ${x.target}) — ${x.fix}`);

  return { score, grade, factors, assets: (view?.assets || []).slice(0, 40), hosts, timeline, facts, counts, fixes,
    coverage: { points: scored.reduce((x, y) => x + y.weight, 0), of: factors.reduce((x, y) => x + y.weight, 0) } };
}

export function reportToMarkdown(r: PageSpeedReport, url: string, ttfbSource: string): string {
  const L: string[] = [];
  L.push(`# Page speed report — ${url}`, '');
  L.push(`**Score ${r.score}/100 · grade ${r.grade}** · server response ${ttfbSource}`, '');
  L.push('## Score breakdown', '', '| Factor | Measured | Target | Points |', '|---|---|---|---|');
  r.factors.forEach(x => L.push(`| ${x.label} | ${x.value} | ${x.target} | ${x.earned}/${x.weight} |`));
  L.push('', '## What the page asks for', '');
  r.hosts.slice(0, 12).forEach(h => L.push(`- **${h.host}** — ${h.requests} request${h.requests === 1 ? '' : 's'} (${h.kinds})${h.thirdParty ? ` · ${h.role}` : ''}`));
  L.push('', '## Modelled load sequence', '');
  r.timeline.forEach(t => L.push(`- ${t.label}: ${t.ms} ms${t.modelled ? ' (modelled)' : ' (measured)'} — ${t.note}`));
  L.push('', '## Priority fixes', '');
  r.fixes.slice(0, 8).forEach(x => L.push(`- ${x}`));
  L.push('', '_HTML-document analysis only: no browser was rendered, sub-resource bytes and compression headers were not fetched. Field Core Web Vitals (LCP/INP/CLS) come from real visitors, not from a document fetch._');
  return L.join('\n');
}
