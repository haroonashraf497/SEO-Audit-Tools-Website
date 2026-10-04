import React, { useState } from 'react';
import { fetchPageData, type LivePageData } from '../utils/pageFetch';
import { rdapDomain, rdapEvent, ageText } from './DomainTools';

/* Keyword tools backed by live data — nothing is simulated:
   • Google SERP + page HTML through the repo's CORS relays (fetchPageData)
   • Google Autocomplete (via the CORS-open Jina reader) — real query suggestions
   • Wikipedia OpenSearch and Datamuse — real lexical suggestions
   • RDAP — real domain availability / competitor age
   Where a signal cannot be measured (e.g. search volume has no keyless API)
   the tool says so instead of inventing numbers. */

// ---------- shared helpers ----------
const STOP = new Set(('a an the and or but if then than else so of in on at to for from by with about as is are was were be been being it its this that these those i you he she we they not no nor do does did done have has had having will would can could shall should may might must into over under again more most less least very just also only own same s t d ll m o re don t now there here why how what which who whom when where').split(/\s+/));

const ngrams = (text: string, n: number): [string, number][] => {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];
  const map = new Map<string, number>();
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n);
    if (gram.some(w => STOP.has(w) || w.length <= 2)) continue;
    const k = gram.join(' ');
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

const withTimeout = <T,>(p: Promise<T>, ms = 9000): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const wikiSuggest = async (seed: string): Promise<string[]> => {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&limit=12&namespace=0&format=json&origin=*&search=${encodeURIComponent(seed)}`);
  if (!r.ok) throw new Error('wiki');
  const j = (await r.json()) as [string, string[]];
  return j[1] || [];
};

const datamuse = async (kind: 'ml' | 'rel_trg' | 'rel_syn', seed: string, max = 18): Promise<string[]> => {
  const r = await fetch(`https://api.datamuse.com/words?${kind}=${encodeURIComponent(seed)}&max=${max}`);
  if (!r.ok) throw new Error('datamuse');
  const j = (await r.json()) as { word: string }[];
  return j.map(x => x.word);
};

type SerpItem = { url: string; host: string; title: string };
const parseSerp = (html: string): { items: SerpItem[]; resultCount: number | null } => {
  const items: SerpItem[] = [];
  const re = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(?:[\s\S]{0,500}?)<h3[^>]*>([\s\S]{0,300}?)<\/h3>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && items.length < 12) {
    const url = m[1].replace(/&amp;/g, '&');
    if (/google\.[a-z]+\/|webcache\.|accounts\.google|\.google\.|\/search\?/i.test(url)) continue;
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (!host || items.some(o => o.url === url)) continue;
    items.push({ url, host, title });
  }
  const stats = /result-stats[^>]*>\s*(?:About\s*)?([\d,.]+)/i.exec(html);
  return { items, resultCount: stats ? Number(stats[1].replace(/,/g, '')) : null };
};

const hostMatch = (host: string, target: string) => host === target || host.endsWith(`.${target}`);

/** DuckDuckGo's lightweight HTML endpoint — far more tolerant of relay
    traffic than Google, so it acts as the reliable fallback engine. */
const parseDdg = (html: string): SerpItem[] => {
  const items: SerpItem[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && items.length < 12) {
    let url = m[1].replace(/&amp;/g, '&');
    const uddg = /[?&]uddg=([^&]+)/.exec(url);
    if (uddg) { try { url = decodeURIComponent(uddg[1]); } catch { /* keep original */ } }
    if (!/^https?:\/\//i.test(url)) continue;
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (!host || items.some(o => o.url === url)) continue;
    items.push({ url, host, title });
  }
  return items;
};

type SerpSource = { engine: 'Google' | 'DuckDuckGo' | 'Bing'; items: SerpItem[]; resultCount: number | null };

/** Extra raw relays tried by the keyword tools only (the shared pageFetch
    keeps its own list, so other tools are unaffected). */
const RAW_RELAYS: ((u: string) => string)[] = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
];
const relayHtml = async (url: string): Promise<string | null> => {
  for (const rel of RAW_RELAYS) {
    try {
      const r = await withTimeout(fetch(rel(url)), 9000);
      if (!r.ok) continue;
      const t = await r.text();
      if (t && t.length > 500) return t;
    } catch { /* try the next relay */ }
  }
  return null;
};

/** Bing results delivered as markdown by the CORS-open Jina reader. */
const parseBingMd = (md: string): SerpItem[] => {
  const items: SerpItem[] = [];
  const re = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) && items.length < 12) {
    const title = m[1].replace(/\*\*/g, '').trim();
    const url = m[2];
    if (/bing\.com|microsoft\.com/i.test(url)) continue;
    if (title.length < 12) continue; // skips nav chrome like "Images"/"Videos"
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (!host || items.some(o => o.url === url)) continue;
    items.push({ url, host, title });
  }
  return items;
};

/** Real Google Autocomplete suggestions, fetched through the Jina reader. */
const googleSuggest = async (seed: string): Promise<string[]> => {
  const r = await withTimeout(fetch(`https://r.jina.ai/https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}`), 10000);
  if (!r.ok) throw new Error('suggest unreachable');
  const text = await r.text();
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) throw new Error('suggest unparsable');
  const parsed = JSON.parse(text.slice(start, end + 1)) as [string, string[]];
  return (parsed[1] || []).slice(0, 12);
};

/** Real Google Autocomplete for several query variants, fetched in small
    batches so the reader endpoint is not hammered. Failures are dropped —
    whatever comes back is real. */
const suggestVariants = async (queries: string[]): Promise<{ q: string; terms: string[] }[]> => {
  const out: { q: string; terms: string[] }[] = [];
  for (let i = 0; i < queries.length; i += 3) {
    const batch = queries.slice(i, i + 3);
    const results = await Promise.all(batch.map(async q => {
      try { return { q, terms: await googleSuggest(q) }; } catch { return { q, terms: [] }; }
    }));
    out.push(...results.filter(r => r.terms.length > 0));
  }
  return out;
};

/** First non-null result wins; null when every job fails or the cap expires.
    Racing relays concurrently means one fast relay answers in ~1s instead of
    stacking 10s timeouts behind every dead one. */
const raceFirst = async <T,>(jobs: (() => Promise<T | null>)[], ms: number): Promise<T | null> =>
  await new Promise(res => {
    let pending = jobs.length; let settled = false;
    const cap = setTimeout(() => { if (!settled) { settled = true; res(null); } }, ms);
    jobs.forEach(async j => {
      try {
        const v = await j();
        if (v != null && !settled) { settled = true; clearTimeout(cap); res(v); return; }
      } catch { /* this attempt lost the race */ }
      pending -= 1;
      if (pending <= 0 && !settled) { settled = true; clearTimeout(cap); res(null); }
    });
  });

/** Markdown SERP link extractor (Jina reader output for Google/Bing). */
const parseMdSerp = (md: string, badRe: RegExp): SerpItem[] => {
  const items: SerpItem[] = [];
  const re = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) && items.length < 12) {
    const title = m[1].replace(/\*\*/g, '').trim();
    const url = m[2];
    if (badRe.test(url)) continue;
    if (title.length < 12) continue; // skips nav chrome like "Images"/"Videos"
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { continue; }
    if (!host || items.some(o => o.url === url)) continue;
    items.push({ url, host, title });
  }
  return items;
};

/** 10-minute sessionStorage cache so repeat checks are instant (and kinder
    to the public relays). */
const sGet = (k: string): string | null => { try { return sessionStorage.getItem(`kwtool:${k}`); } catch { return null; } };
const sSet = (k: string, v: string) => { try { sessionStorage.setItem(`kwtool:${k}`, v); } catch { /* private mode */ } };

/** Google first — tried twice in parallel (HTML relays + the reader’s rendered
    markdown) so one blocked path no longer drops us off Google; DuckDuckGo and
    Bing only as last resorts. */
const fetchSerp = async (kw: string): Promise<SerpSource> => {
  const key = `serp:${cleanKw(kw)}`;
  const hit = sGet(key);
  if (hit) {
    try {
      const c = JSON.parse(hit) as { t: number; src: SerpSource };
      if (Date.now() - c.t < 600_000 && c.src.items.length) return c.src;
    } catch { /* stale cache — refetch */ }
  }
  const gUrl = `https://www.google.com/search?q=${encodeURIComponent(kw)}&num=10&hl=en`;
  const google = await raceFirst<SerpSource>([
    async () => {
      const g = await withTimeout(fetchPageData(gUrl), 9000);
      if (!g) return null;
      const { items, resultCount } = parseSerp(g.html);
      return items.length >= 3 ? { engine: 'Google', items, resultCount } : null;
    },
    async () => {
      const r = await withTimeout(fetch(`https://r.jina.ai/${gUrl}`), 9000);
      if (!r.ok) return null;
      const items = parseMdSerp(await r.text(), /google\.[a-z]+\/|webcache\.|accounts\.google|\.google\.|youtube\.com\/\?|consent\./i);
      return items.length >= 3 ? { engine: 'Google', items, resultCount: null } : null;
    },
    async () => {
      const h = await relayHtml(`${gUrl}&gbv=1`);
      if (!h) return null;
      const { items } = parseSerp(h);
      return items.length >= 3 ? { engine: 'Google', items, resultCount: null } : null;
    },
  ], 10000);
  if (google) { sSet(key, JSON.stringify({ t: Date.now(), src: google })); return google; }
  try {
    const br = await withTimeout(fetch(`https://r.jina.ai/https://www.bing.com/search?q=${encodeURIComponent(kw)}`), 9000);
    if (br.ok) {
      const items = parseBingMd(await br.text());
      if (items.length >= 3) { const src = { engine: 'Bing' as const, items, resultCount: null }; sSet(key, JSON.stringify({ t: Date.now(), src })); return src; }
    }
  } catch { /* all engines failed */ }
  throw new Error('Google could not be reached through any relay or reader right now, and the labelled Bing fallback was blocked too. Try again in a minute.');
};

const cleanKw = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');

/** Client-side CSV/text download. */
const download = (name: string, text: string, mime = 'text/csv;charset=utf-8') => {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/** Fallback page reader (r.jina.ai returns CORS-open markdown) used when the
    HTML relays cannot reach a site. */
const jinaFallback = async (url: string): Promise<LivePageData | null> => {
  try {
    const r = await withTimeout(fetch(`https://r.jina.ai/${url}`), 15000);
    if (!r.ok) return null;
    const md = await r.text();
    if (md.length < 200) return null;
    const h1s = [...md.matchAll(/^#\s+(.+)$/gm)].map(m => m[1].trim()).slice(0, 5);
    const titleMatch = /^Title:\s*(.+)$/m.exec(md);
    const bodyText = md
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^(Title|URL Source|Markdown Content):/gm, '')
      .replace(/[#>*`_~-]+/g, ' ');
    const words = (bodyText.match(/[a-z0-9']+/gi) || []).length;
    // Markdown links are the page's real outgoing links — count them.
    let internalLinks = 0, externalLinks = 0;
    let host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep '' */ }
    for (const m of md.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)) {
      const u = m[1];
      if (u.startsWith('/') || (host && u.includes(host))) internalLinks++;
      else externalLinks++;
    }
    return {
      ok: true, reader: true, finalUrl: url, title: titleMatch?.[1]?.trim() || h1s[0] || '', description: '', h1s,
      headingCounts: { H1: h1s.length }, imageCount: 0, imagesMissingAlt: 0, imagesAltWithKeyword: 0,
      internalLinks, externalLinks, nofollowLinks: 0, internalNofollowLinks: 0, externalNofollowLinks: 0,
      wordCount: words, canonical: '', favicon: '', charset: false, viewport: false, lang: null, robots: '',
      ogTitle: false, ogDescription: false, ogImage: false, ogUrl: false, twitterCard: false,
      codeSize: 0, textSize: words * 6, textRatio: 1, linksSample: [], bodyText, html: md, fetchMs: 0,
      scripts: 0, externalScripts: 0, stylesheets: 0, inlineStyles: 0, iframes: 0, forms: 0, emails: [],
      metaTags: [], linkTags: [], generator: '', hasJsonLd: false, imagesWithoutDimensions: 0, smallFontRisk: false,
    };
  } catch { return null; }
};

// ---------- UI kit (same family as the other tool groups) ----------
const Icon: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);
const ic = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" /></>,
  doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><path d="M7.5 8.5h.01" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
  bulb: <><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z" /></>,
  trophy: <><path d="M8 21h8M12 17v4" /><path d="M7 4h10v6a5 5 0 0 1-10 0z" /><path d="M7 6H4a2 2 0 0 0 2 6h1M17 6h3a2 2 0 0 1-2 6h-1" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  percent: <><path d="M19 5L5 19" /><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></>,
};

const Spinner: React.FC = () => <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" aria-hidden="true" />;

const Copy: React.FC<{ text: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" aria-label="Copy" onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
      <Icon>{ok ? ic.check : ic.copy}</Icon>
    </button>
  );
};

const Btn: React.FC<{ busy: boolean; label: string; onClick: () => void; disabled?: boolean }> = ({ busy, label, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={busy || disabled}
    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
    {busy ? <><Spinner /> Working…</> : <>{label} <Icon>{ic.arrow}</Icon></>}
  </button>
);

const InputsCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-5">{children}</div>
);
const Label: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <span className="block mb-1.5"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block">{children}</span>{hint && <span className="text-xs text-slate-400">{hint}</span>}</span>
);
const TextInput: React.FC<{ value: string; onChange: (v: string) => void; ph: string; onEnter?: () => void; mono?: boolean }> = ({ value, onChange, ph, onEnter, mono }) => (
  <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }} placeholder={ph}
    className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 ${mono ? 'font-mono' : ''}`} />
);

const Stat: React.FC<{ label: string; value: string; sub?: string; accent?: boolean }> = ({ label, value, sub, accent }) => (
  <div className={`rounded-xl border p-4 ${accent ? 'bg-indigo-50/60 border-indigo-100' : 'bg-white border-slate-200'}`}>
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`text-lg font-extrabold mt-1 break-words ${accent ? 'text-indigo-600' : 'text-slate-800'}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5 break-words">{sub}</p>}
  </div>
);

const Pill: React.FC<{ tone: 'ok' | 'bad' | 'warn' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = tone === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : tone === 'bad' ? 'bg-red-50 text-red-600 border-red-200' : tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200';
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>{children}</span>;
};

const Chip: React.FC<{ children: React.ReactNode; count?: number }> = ({ children, count }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">{children}{count !== undefined && <span className="text-[10px] font-bold text-indigo-600 bg-white rounded px-1">{count}×</span>}</span>
);

const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/70">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">{icon && <span className="text-indigo-500"><Icon>{icon}</Icon></span>}{title}</h3>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-500 leading-relaxed">
    <span className="text-slate-400 shrink-0 mt-0.5"><Icon>{ic.shield}</Icon></span><p>{children}</p>
  </div>
);
const ErrBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700"><span className="shrink-0 mt-0.5"><Icon>{ic.alert}</Icon></span><p>{msg}</p></div>
);
const Skeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-hidden="true">
    <div className="h-28 rounded-2xl bg-slate-200/70" />
    <div className="grid sm:grid-cols-3 gap-3"><div className="h-20 rounded-xl bg-slate-200/60" /><div className="h-20 rounded-xl bg-slate-200/60" /><div className="h-20 rounded-xl bg-slate-200/60" /></div>
  </div>
);
const Status: React.FC<{ text: string }> = ({ text }) => <p className="text-sm text-slate-500 flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin inline-block" />{text}</p>;

const fail = (e: unknown) => (e instanceof Error ? e.message : 'The lookup failed — check the input and your connection.');

/** Small live-data badge (same family as the checker tools). */
const LiveBadge: React.FC<{ text: string }> = ({ text }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{text}
  </span>
);

/** Download-as-file button for result tables. */
const DownloadBtn: React.FC<{ name: string; build: () => string; label?: string }> = ({ name, build, label = 'CSV' }) => (
  <button type="button" onClick={() => download(name, build())}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
    <Icon className="w-3.5 h-3.5">{ic.download}</Icon>{label}
  </button>
);

/** Score gauge — same visual as the other tool groups. */
const Gauge: React.FC<{ score: number; size?: number }> = ({ score, size = 120 }) => {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={`Score ${Math.round(pct)} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800 font-extrabold" style={{ fontSize: size / 4.2 }}>{Math.round(pct)}</text>
    </svg>
  );
};

/** Filterable chip grid — suggestions get a search box + copy-all + CSV. */
const ChipGrid: React.FC<{ items: { text: string; count?: number; tone?: 'ok' | 'gen' }[]; emptyMsg?: string }> = ({ items, emptyMsg = 'Nothing matches the filter.' }) => {
  if (!items.length) return <p className="text-sm text-slate-400">{emptyMsg}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(it => (
        <span key={it.text} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${it.tone === 'gen' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700'}`}>
          {it.text}
          {it.count !== undefined && <span className="text-[10px] font-bold text-indigo-600 bg-white rounded px-1">{it.count}×</span>}
        </span>
      ))}
    </div>
  );
};

// ---------- 1. Keyword Rank Checker (live SERP) ----------
type RankRow = { kw: string; pos: number | null; items: SerpItem[]; engine?: string; resultCount?: number | null; yourUrl?: string; error?: string };

const KeywordRankTool: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [kws, setKws] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<RankRow[]>([]);

  const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');

  const run = async () => {
    const list = kws.split(/[,;\n]+/).map(cleanKw).filter(Boolean).slice(0, 10);
    if (!d || !list.length) { setErr('Enter a domain and at least one keyword.'); return; }
    setBusy(true); setErr(''); setRows([]);
    const out: RankRow[] = [];
    const flush = () => setRows([...out].sort((a, b) => list.indexOf(a.kw) - list.indexOf(b.kw)));
    const check = async (kw: string) => {
      try {
        const src = await fetchSerp(kw);
        const hit = src.items.findIndex(x => hostMatch(x.host, d));
        out.push({ kw, pos: hit >= 0 ? hit + 1 : null, items: src.items, engine: src.engine, resultCount: src.resultCount, yourUrl: hit >= 0 ? src.items[hit].url : undefined });
      } catch { out.push({ kw, pos: null, items: [], error: 'Could not fetch this SERP right now.' }); }
      flush();
    };
    // two concurrent workers — ~half the wait, still gentle on the relays
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        setStatus(`Checking live search results ${i + 1} of ${list.length} — “${list[i]}”…`);
        await check(list[i]);
      }
    };
    setStatus(`Checking ${list.length} keywords against live search results…`);
    await Promise.all([worker(), worker()]);
    setStatus(''); setBusy(false);
  };

  const done = rows.filter(r => !r.error);
  const ranked = done.filter(r => r.pos !== null);
  const best = ranked.length ? Math.min(...ranked.map(r => r.pos as number)) : null;
  const avg = ranked.length ? ranked.reduce((s, r) => s + (r.pos as number), 0) / ranked.length : null;

  return (
    <div>
      <InputsCard>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div><Label>Your website</Label><TextInput value={domain} onChange={setDomain} ph="example.com" mono /></div>
          <div><Label>Keywords (up to 10)</Label><TextInput value={kws} onChange={setKws} ph="seo audit, free seo tools, rank checker" onEnter={() => void run()} /></div>
        </div>
        <Btn busy={busy} label="Check Rankings" onClick={() => void run()} />
      </InputsCard>
      {busy && status && <Status text={status} />}
      {err && <ErrBox msg={err} />}
      {rows.length > 0 && (
        <div className="space-y-4">
          {done.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Ranking report — {d}</p>
                  <p className="text-2xl sm:text-3xl font-extrabold mt-1.5">{ranked.length}/{done.length} keywords ranking</p>
                  <p className="text-white/80 text-sm mt-1">{ranked.length ? `best position #${best} · average #${avg!.toFixed(1)}` : 'none of your pages appeared in the live top results'}</p>
                </div>
                <button type="button" onClick={() => download(`rankings-${d}.csv`, ['keyword,position,engine,indexed results,your url', ...rows.map(r => [r.kw, r.pos ?? 'not ranked', r.engine ?? '-', r.resultCount ?? '-', r.yourUrl ?? ''].map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n'))}
                  className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold border border-white/25 transition-colors">
                  <Icon className="w-4 h-4">{ic.download}</Icon>Export CSV
                </button>
              </div>
            </div>
          )}
          {rows.map(r => (
            <Card key={r.kw} title={r.kw} icon={ic.search}
              right={r.error ? <Pill tone="warn">unavailable</Pill> : (
                <span className="flex items-center gap-1.5">
                  {r.pos ? <Pill tone="ok">#{r.pos}</Pill> : <Pill tone="bad">not in top {r.items.length || 10}</Pill>}
                  <Pill tone="muted">via {r.engine}</Pill>
                </span>
              )}>
              {r.error ? <p className="text-sm text-slate-400">{r.error}</p> : (
                <div className="space-y-3">
                  {r.pos && r.yourUrl && (
                    <div className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-sm">
                      <span className="text-emerald-700 font-bold shrink-0"><Icon className="w-3.5 h-3.5 inline mr-1">{ic.trophy}</Icon>Your page at #{r.pos}:</span>
                      <a href={r.yourUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-emerald-700 underline break-all">{r.yourUrl}</a>
                    </div>
                  )}
                  <ol className="space-y-1.5">
                    {r.items.map((i, idx) => (
                      <li key={i.url} className={`flex items-center gap-3 text-sm rounded-lg px-2 py-1 ${hostMatch(i.host, d) ? 'bg-emerald-50 border border-emerald-200' : ''}`}>
                        <span className="w-6 text-right font-extrabold text-slate-400 shrink-0">{idx + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-slate-800 truncate">{i.title}</span>
                          <span className="block text-xs font-mono text-slate-400 truncate">{i.host}</span>
                        </span>
                        {hostMatch(i.host, d) && <Pill tone="ok">you</Pill>}
                      </li>
                    ))}
                  </ol>
                  {r.resultCount ? <p className="text-xs text-slate-400">Indexed results reported by {r.engine}: <span className="font-bold text-slate-500">{r.resultCount.toLocaleString()}</span></p> : null}
                </div>
              )}
            </Card>
          ))}
          <Note>Positions are observed live: Google is tried through three independent paths at once (full HTML relays, basic-HTML relays and a rendered reader copy of the results page), and only if every Google path is blocked does a clearly-labelled Bing fallback run — the engine used is shown on each card. If nothing is reachable the keyword shows as unavailable instead of a made-up number. Search engines personalise results, so treat positions as accurate to within a couple of slots.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 2. Keyword Density Checker (real text analysis) ----------
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const KeywordDensityTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [focusKw, setFocusKw] = useState('');
  const [filter, setFilter] = useState('');

  const data = React.useMemo(() => {
    const words = input.toLowerCase().match(/[a-z0-9']+/g) || [];
    if (!words.length) return null;
    const singles = ngrams(input, 1).filter(([, c]) => c > 1).slice(0, 15);
    const bis = ngrams(input, 2).filter(([, c]) => c > 1).slice(0, 12);
    const tris = ngrams(input, 3).filter(([, c]) => c > 1).slice(0, 10);
    const quad = ngrams(input, 4).filter(([, c]) => c > 1).slice(0, 8);
    const unique = new Set(words).size;
    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 2).length || 1;
    const stops = words.filter(w => STOP.has(w)).length;
    const focus = focusKw.trim().toLowerCase();
    let focusCount = 0, prominence: number | null = null;
    if (focus) {
      focusCount = (input.toLowerCase().match(new RegExp(escapeRe(focus), 'g')) || []).length;
      const at = input.toLowerCase().indexOf(focus);
      if (at >= 0) prominence = Math.max(0, Math.min(100, Math.round((at / input.length) * 100)));
    }
    return {
      total: words.length, unique, singles, bis, tris, quad, sentences,
      chars: input.length, avgSentence: Math.round(words.length / sentences),
      stopRatio: (stops / words.length) * 100, readMin: Math.max(1, Math.round(words.length / 220)),
      focus, focusCount, focusDensity: (focusCount / words.length) * 100, prominence,
    };
  }, [input, focusKw]);

  const inputCard = (rows: number) => (
    <InputsCard>
      <div className="grid sm:grid-cols-[1fr_240px] gap-3">
        <div>
          <Label>Your article or page text</Label>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={rows} spellCheck={false} placeholder="Paste your article to analyze keyword density…"
            className="w-full p-4 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15" />
        </div>
        <div>
          <Label hint="Optional — measured exactly as typed">Focus keyword</Label>
          <TextInput value={focusKw} onChange={setFocusKw} ph="e.g. seo audit" />
          <p className="text-xs text-slate-400 mt-2">Analysis updates live as you type — no button needed.</p>
        </div>
      </div>
    </InputsCard>
  );

  if (!input.trim() || !data) return inputCard(9);

  const focusVerdict = !data.focus ? null : data.focusCount === 0 ? { tone: 'bad' as const, text: 'not found in the text' }
    : data.focusDensity < 1 ? { tone: 'warn' as const, text: 'under-used (below 1%)' }
    : data.focusDensity <= 2.5 ? { tone: 'ok' as const, text: 'healthy (1–2.5%)' }
    : data.focusDensity <= 3 ? { tone: 'warn' as const, text: 'getting high (2.5–3%)' }
    : { tone: 'bad' as const, text: 'over-optimised (above 3%)' };

  const applyFilter = (rows: [string, number][]) => filter ? rows.filter(([t]) => t.includes(filter.trim().toLowerCase())) : rows;

  const table = (title: string, rows: [string, number][]) => {
    const shown = applyFilter(rows);
    return (
      <Card title={title} icon={ic.list}
        right={rows.length ? <DownloadBtn name={`density-${title.toLowerCase().replace(/\s+/g, '-')}.csv`} build={() => ['term,count,density %', ...rows.map(([t, c]) => `"${t}",${c},${((c / data.total) * 100).toFixed(2)}`)].join('\n')} /> : undefined}>
        {shown.length ? (
          <div className="space-y-2">
            {shown.map(([term, count]) => {
              const density = (count / data.total) * 100;
              return (
                <div key={term}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-800 truncate">{term}</span>
                    <span className="shrink-0 ml-3 text-xs font-bold text-slate-500">{count}× · <span className={density > 3 ? 'text-amber-600' : 'text-indigo-600'}>{density.toFixed(2)}%</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${density > 3 ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, density * 20)}%` }} /></div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-slate-400">{filter ? 'No terms match the filter.' : 'No repeated phrases found.'}</p>}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {inputCard(5)}
      {data.focus && focusVerdict && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Focus keyword — “{data.focus}”</p>
          <p className="text-2xl sm:text-3xl font-extrabold mt-1.5">{data.focusCount}× · {data.focusDensity.toFixed(2)}% density</p>
          <p className="text-white/80 text-sm mt-1">
            {focusVerdict.text}{data.prominence !== null && ` · first appears ${data.prominence === 0 ? 'at the very start' : `${data.prominence}% into the text`} of the content`}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Words" value={data.total.toLocaleString()} sub={`${data.chars.toLocaleString()} characters`} />
        <Stat label="Unique words" value={data.unique.toLocaleString()} sub={`vocabulary ratio ${(data.unique / data.total).toFixed(2)}`} />
        <Stat label="Sentences" value={data.sentences.toLocaleString()} sub={`avg ${data.avgSentence} words per sentence`} />
        <Stat label="Reading time" value={`${data.readMin} min`} sub={`at 220 wpm · ${data.stopRatio.toFixed(0)}% stopwords`} />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"><Icon>{ic.filter}</Icon></span>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter terms across all tables…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15" />
        </div>
        <DownloadBtn label="Export all CSV" name="keyword-density.csv"
          build={() => {
            const groups: [string, [string, number][]][] = [['single words', data.singles], ['2-word phrases', data.bis], ['3-word phrases', data.tris], ['4-word phrases', data.quad]];
            return ['type,term,count,density %', ...groups.flatMap(([type, rows]) => rows.map(([t, c]) => `${type},"${t}",${c},${((c / data.total) * 100).toFixed(2)}`))].join('\n');
          }} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {table('Top single words', data.singles)}
        {table('Top 2-word phrases', data.bis)}
        {table('Top 3-word phrases', data.tris)}
        {table('Top 4-word phrases', data.quad)}
      </div>
      <Note>Density = term count ÷ total words, counted on the exact text you pasted. Healthy primary-term density is usually 1–2.5%; amber bars flag anything above 3%, which reads as over-optimised. Prominence shows where your focus keyword first appears — earlier (lower %) is better, since search engines weight opening copy more heavily.</Note>
    </div>
  );
};

// ---------- 3. Keywords Suggestion Tool (live suggestion APIs) ----------
type Section = { title: string; note: string; terms: string[]; live: boolean };

const SuggestionSections: React.FC<{ seed: string; kinds: ('wiki' | 'ml' | 'rel_trg' | 'rel_syn' | 'gsuggest')[]; generated?: string[]; variants?: string[] }> = ({ seed, kinds, generated, variants }) => {
  const [busy, setBusy] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [warn, setWarn] = useState('');
  const [filter, setFilter] = useState('');

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      setBusy(true); setWarn(''); setFilter('');
      const out: Section[] = [];
      // Progressive: every source paints the instant it answers, and a cached
      // result from the last 10 minutes renders before any network call.
      const commit = () => { if (alive) setSections([...out]); };
      const key = `sugg:${seed}|${kinds.join(',')}|${(variants || []).join('|')}`;
      const hit = sGet(key);
      if (hit) { try { const c = JSON.parse(hit) as Section[]; if (Array.isArray(c) && c.length) { out.push(...c); commit(); } } catch { /* refetch */ } }
      if (generated?.length) { out.push({ title: 'Idea patterns (generated)', note: 'proven long-tail templates around your seed — patterns, not search data', terms: generated, live: false }); commit(); }
      const jobs: Promise<unknown>[] = [];
      const add = (sec: Section) => { const i = out.findIndex(o => o.title === sec.title); if (i >= 0) out[i] = sec; else out.push(sec); commit(); };
      if (kinds.includes('gsuggest')) jobs.push(googleSuggest(seed).then(t => add({ title: 'Google Autocomplete (live)', note: 'real queries Google suggests as people type this keyword', terms: t, live: true })).catch(() => undefined));
      if (kinds.includes('wiki')) jobs.push(wikiSuggest(seed).then(t => add({ title: 'Related topics (Wikipedia)', note: 'real search suggestions from Wikipedia’s live suggest API', terms: t, live: true })).catch(() => undefined));
      if (kinds.includes('ml')) jobs.push(datamuse('ml', seed).then(t => add({ title: 'Meaning-similar terms', note: 'semantically related words from the Datamuse lexicon', terms: t, live: true })).catch(() => undefined));
      if (kinds.includes('rel_trg')) jobs.push(datamuse('rel_trg', seed).then(t => add({ title: 'Associated searches', note: 'terms statistically triggered by this keyword', terms: t, live: true })).catch(() => undefined));
      if (kinds.includes('rel_syn')) jobs.push(datamuse('rel_syn', seed).then(t => add({ title: 'Synonyms & variants', note: 'alternative wordings worth targeting', terms: t, live: true })).catch(() => undefined));
      if (variants?.length) jobs.push(suggestVariants(variants).then(groups => {
        const terms: string[] = [];
        for (const g of groups) for (const t of g.terms) if (!terms.some(x => x.toLowerCase() === t.toLowerCase()) && t.toLowerCase() !== seed) terms.push(t);
        if (terms.length) add({ title: `Real autocomplete — ${groups.length} question & modifier searches`, note: `live Google Autocomplete results for queries like ${groups.slice(0, 3).map(g => `“${g.q}”`).join(', ')}${groups.length > 3 ? '…' : ''}`, terms, live: true });
      }).catch(() => undefined));
      await Promise.allSettled(jobs);
      if (!alive) return;
      const live = out.filter(x => x.live && x.terms.length);
      if (live.length) sSet(key, JSON.stringify(live));
      if (!out.length) setWarn('The suggestion services could not be reached right now. Try again in a moment.');
      setBusy(false);
    };
    void load();
    return () => { alive = false; };
  }, [seed, kinds.join(','), (variants || []).join('|')]);

  const f = filter.trim().toLowerCase();
  const totalLive = sections.filter(s => s.live).reduce((n, s) => n + s.terms.length, 0);

  if (busy && !sections.length) return <Skeleton />;
  return (
    <div className="space-y-4">
      {warn && <ErrBox msg={warn} />}
      {sections.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-5 shadow-lg shadow-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Suggestions for “{seed}”</p>
            <p className="text-2xl font-extrabold mt-1">{totalLive.toLocaleString()} live terms</p>
            <p className="text-white/80 text-xs mt-0.5">{sections.filter(s => s.live).length} live sources{sections.some(s => !s.live) ? ' + generated idea patterns' : ''}</p>
          </div>
          <span className="flex gap-2 self-start">
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(sections.flatMap(s => s.terms).join('\n')); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/25"><Icon className="w-3.5 h-3.5">{ic.copy}</Icon>Copy all</button>
            <button type="button" onClick={() => download(`suggestions-${seed.replace(/\s+/g, '-')}.csv`, ['source,suggestion', ...sections.flatMap(s => s.terms.map(t => `"${s.title}","${t.replace(/"/g, '""')}"`))].join('\n'))}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/25"><Icon className="w-3.5 h-3.5">{ic.download}</Icon>CSV</button>
          </span>
        </div>
      )}
      {sections.length > 0 && (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"><Icon>{ic.filter}</Icon></span>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter suggestions…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15" />
        </div>
      )}
      {sections.map(s => {
        const shown = f ? s.terms.filter(t => t.toLowerCase().includes(f)) : s.terms;
        if (!shown.length) return null;
        return (
          <Card key={s.title} title={`${s.title} (${shown.length})`} icon={s.live ? ic.search : ic.bulb}
            right={<span className="flex items-center gap-2">{s.live && <LiveBadge text="live" />}<Copy text={s.terms.join('\n')} /></span>}>
            <p className="text-xs text-slate-400 mb-3">{s.note}</p>
            <ChipGrid items={shown.map(t => ({ text: t, tone: s.live ? undefined : 'gen' as const }))} />
          </Card>
        );
      })}
      {sections.length > 0 && f && !sections.some(s => s.terms.some(t => t.toLowerCase().includes(f))) && (
        <p className="text-sm text-slate-400">No suggestions match “{filter}”.</p>
      )}
      {busy && sections.length > 0 && <p className="text-xs text-slate-400 flex items-center gap-2"><span className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin inline-block" />more live sources streaming in…</p>}
    </div>
  );
};

const MODIFIERS = (kw: string) => [`best ${kw}`, `${kw} for beginners`, `how to ${kw}`, `${kw} tips`, `free ${kw}`, `${kw} near me`, `${kw} pricing`, `${kw} alternatives`, `${kw} review`, `why ${kw} matters`, `${kw} checklist`, `${kw} examples`];
const QUESTION_VARIANTS = (kw: string) => [`how to ${kw}`, `what is ${kw}`, `why ${kw}`, `best ${kw}`, `${kw} for`, `${kw} vs`];

const KeywordSuggestionsTool: React.FC = () => {
  const [seed, setSeed] = useState('');
  const [active, setActive] = useState('');
  return (
    <div>
      <InputsCard>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1"><Label>Seed keyword</Label><TextInput value={seed} onChange={setSeed} ph="e.g. running shoes" onEnter={() => setActive(cleanKw(seed))} /></div>
          <div className="sm:pt-6"><Btn busy={false} label="Get Suggestions" onClick={() => setActive(cleanKw(seed))} disabled={!seed.trim()} /></div>
        </div>
      </InputsCard>
      {active && <SuggestionSections seed={active} kinds={['gsuggest', 'wiki', 'ml', 'rel_trg']} generated={MODIFIERS(active)} variants={QUESTION_VARIANTS(active)} />}
    </div>
  );
};

// ---------- 4. Website Keywords Suggestions (live page mining) ----------
const WebsiteKeywordsTool: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{
    domain: string; title: string; description: string; h1s: string[]; metaKw: string[]; reader: boolean;
    words: number; singles: [string, number][]; bis: [string, number][]; tris: [string, number][];
  } | null>(null);

  const run = async () => {
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
    if (!d) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      let live = await withTimeout(fetchPageData(`https://${d}/`), 15000);
      if (!live) live = await jinaFallback(`https://${d}/`);
      if (!live) throw new Error(`Could not fetch ${d} through any relay or reader — the site may block proxies.`);
      const metaKw = live.metaTags.find(m => m.name.toLowerCase() === 'keywords')?.content.split(',').map(s => s.trim()).filter(Boolean) || [];
      setRes({
        domain: d, title: live.title, description: live.description, h1s: live.h1s, metaKw, reader: !!live.reader,
        words: live.wordCount || (live.bodyText.match(/[a-z0-9']+/gi) || []).length,
        singles: ngrams(live.bodyText, 1).slice(0, 18), bis: ngrams(live.bodyText, 2).slice(0, 14), tris: ngrams(live.bodyText, 3).slice(0, 10),
      });
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  const inTitle = (t: string) => !!res && res.title.toLowerCase().includes(t);
  const inH1 = (t: string) => !!res && res.h1s.some(h => h.toLowerCase().includes(t));
  const inDesc = (t: string) => !!res && res.description.toLowerCase().includes(t);

  return (
    <div>
      <InputsCard>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1"><Label>Website</Label><TextInput value={domain} onChange={setDomain} ph="example.com" mono onEnter={() => void run()} /></div>
          <div className="sm:pt-6"><Btn busy={busy} label="Extract Keywords" onClick={() => void run()} /></div>
        </div>
      </InputsCard>
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Keyword profile — {res.domain}{res.reader ? ' (read via markdown fallback)' : ''}</p>
            <p className="text-2xl sm:text-3xl font-extrabold mt-1.5 break-all">{res.singles[0]?.[0] ?? '—'}</p>
            <p className="text-white/80 text-sm mt-1">{res.singles[0] ? `top term appears ${res.singles[0][1]}× (${((res.singles[0][1] / Math.max(1, res.words)) * 100).toFixed(2)}% of ${res.words.toLocaleString()} words)` : 'no repeated terms found'} · {res.title ? `title: “${res.title}”` : 'no title detected'}</p>
          </div>
          <Card title={`On-page signals — ${res.domain}`} icon={ic.globe}>
            <div className="space-y-3 text-sm">
              <p><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Title <span className="normal-case font-normal">({res.title.length} chars)</span></span><span className="text-slate-800">{res.title || '—'}</span></p>
              <p><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Meta description <span className="normal-case font-normal">({res.description.length} chars)</span></span><span className="text-slate-600">{res.description || '—'}</span></p>
              {res.metaKw.length > 0 && <div><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Meta keywords tag</span><div className="flex flex-wrap gap-1.5">{res.metaKw.map(k => <Chip key={k}>{k}</Chip>)}</div></div>}
              {res.h1s.length > 0 && <div><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1">H1 headings</span><div className="flex flex-wrap gap-1.5">{res.h1s.map((h, i) => <Chip key={i}>{h}</Chip>)}</div></div>}
            </div>
          </Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Body words" value={res.words.toLocaleString()} />
            <Stat label="Distinct terms" value={res.singles.length.toLocaleString()} sub="top mined words" />
            <Stat label="Terms in title" value={`${res.singles.filter(([t]) => inTitle(t)).length}/${res.singles.length}`} sub="of top body terms" accent={res.singles.some(([t]) => inTitle(t))} />
            <Stat label="Meta keywords" value={res.metaKw.length ? String(res.metaKw.length) : 'none'} sub={res.metaKw.length ? `${res.metaKw.filter(k => res.singles.some(([t]) => k.toLowerCase().includes(t))).length} also in body` : 'tag absent (fine — Google ignores it)'} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title={`Most frequent words (${res.singles.length})`} icon={ic.list}
              right={<DownloadBtn name={`keywords-${res.domain}.csv`} build={() => ['term,count,density %,in title,in h1,in description', ...res.singles.map(([t, c]) => `"${t}",${c},${((c / Math.max(1, res.words)) * 100).toFixed(2)},${inTitle(t)},${inH1(t)},${inDesc(t)}`)].join('\n')} />}>
              <div className="flex flex-wrap gap-1.5">
                {res.singles.map(([t, c]) => (
                  <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                    {t}<span className="text-[10px] font-bold text-indigo-600 bg-white rounded px-1">{c}×</span>
                    {inTitle(t) && <span className="text-[9px] font-black uppercase text-emerald-600" title="also in the page title">T</span>}
                    {inH1(t) && <span className="text-[9px] font-black uppercase text-indigo-600" title="also in an H1">H</span>}
                    {inDesc(t) && <span className="text-[9px] font-black uppercase text-purple-600" title="also in the meta description">D</span>}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">Badges: <span className="font-black text-emerald-600">T</span> in title · <span className="font-black text-indigo-600">H</span> in H1 · <span className="font-black text-purple-600">D</span> in meta description — prominence flags showing where each term is reinforced.</p>
            </Card>
            <Card title={`Most frequent phrases (${res.bis.length})`} icon={ic.list} right={<Copy text={res.bis.map(([t]) => t).join('\n')} />}>
              <div className="flex flex-wrap gap-1.5">{res.bis.map(([t, c]) => <Chip key={t} count={c}>{t}</Chip>)}</div>
            </Card>
          </div>
          {(() => {
            const gaps = res.singles.slice(0, 8).filter(([t]) => !inTitle(t));
            const titleOnly = (res.title.toLowerCase().match(/[a-z0-9']{4,}/g) || []).filter(w => !STOP.has(w) && !res.singles.some(([t]) => t === w)).slice(0, 8);
            if (!gaps.length && !titleOnly.length) return null;
            return (
              <Card title="Keyword gap analysis" icon={ic.bulb}>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Frequent in body, missing from title</p>
                    {gaps.length ? <ChipGrid items={gaps.map(([t, c]) => ({ text: t, count: c }))} /> : <p className="text-slate-400 text-xs">Your title already covers the main body terms — good alignment.</p>}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">In title, barely used in body</p>
                    {titleOnly.length ? <ChipGrid items={titleOnly.map(t => ({ text: t }))} /> : <p className="text-slate-400 text-xs">Every substantive title word appears in the body text.</p>}
                  </div>
                </div>
              </Card>
            );
          })()}
          <Note>The page is fetched live through CORS relays (with a markdown-reader fallback) and the visible text is mined for term and phrase frequency — these are the keywords the site actually talks about, not guesses. Density is count ÷ body words.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 5. Keyword Rich Domain Finder (real availability) ----------
const KeywordDomainsTool: React.FC = () => {
  const [seed, setSeed] = useState('');
  const [checked, setChecked] = useState<{ domain: string; state: 'available' | 'registered' | 'error' }[]>([]);
  const [busy, setBusy] = useState(false);
  const [availOnly, setAvailOnly] = useState(false);
  const seedKey = seed.trim().toLowerCase();

  React.useEffect(() => {
    const base = seedKey.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    if (!base.length) { setChecked([]); return; }
    let alive = true;
    setBusy(true);
    const tlds = ['.com', '.net', '.org', '.io', '.co', '.shop', '.ai', '.app'];
    const joined = base.join('');
    const hyphen = base.join('-');
    const ideas = new Set<string>();
    ['.com', '.net', '.io', '.co'].forEach(t => { ideas.add(joined + t); ideas.add(hyphen + t); });
    ['.org', '.shop', '.ai', '.app'].forEach(t => ideas.add(joined + t));
    ['get', 'try', 'use', 'my', 'the'].forEach(p => ideas.add(p + joined + '.com'));
    ['hub', 'lab', 'pro', 'ly', 'ify', 'zone'].forEach(s => ideas.add(base[0] + s + '.com'));
    tlds.slice(0, 2).forEach(() => { /* reserved for symmetry */ });
    const list = [...ideas].slice(0, 26);
    void Promise.all(list.map(async dm => {
      try { return { domain: dm, state: (await rdapDomain(dm)) ? 'registered' as const : 'available' as const }; }
      catch { return { domain: dm, state: 'error' as const }; }
    })).then(rows => {
      if (!alive) return;
      const order = { available: 0, registered: 1, error: 2 };
      setChecked(rows.sort((a, b) => order[a.state] - order[b.state] || a.domain.localeCompare(b.domain)));
      setBusy(false);
    });
    return () => { alive = false; };
  }, [seedKey]);

  const avail = checked.filter(c => c.state === 'available');
  const shown = availOnly ? avail : checked;
  if (!seedKey.replace(/[^a-z0-9]/g, '')) return (
    <InputsCard>
      <Label>Keyword for the domain ideas</Label>
      <TextInput value={seed} onChange={setSeed} ph="e.g. coffee shop" />
      <p className="text-xs text-slate-400 mt-2">Ideas are generated and their availability checked live as you type.</p>
    </InputsCard>
  );
  return (
    <div className="space-y-4">
      <InputsCard>
        <Label>Keyword for the domain ideas</Label>
        <TextInput value={seed} onChange={setSeed} ph="e.g. coffee shop" />
      </InputsCard>
      {busy && <Skeleton />}
      {!busy && checked.length > 0 && (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Availability check — “{seedKey}”</p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-1.5">{avail.length} of {checked.length} names available</p>
              <p className="text-white/80 text-sm mt-1">{checked.length - avail.length - checked.filter(c => c.state === 'error').length} already registered{checked.some(c => c.state === 'error') ? ` · ${checked.filter(c => c.state === 'error').length} could not be checked` : ''}</p>
            </div>
            {avail.length > 0 && (
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(avail.map(a => a.domain).join('\n')); }}
                className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold border border-white/25"><Icon className="w-4 h-4">{ic.copy}</Icon>Copy available list</button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer select-none w-fit">
            <input type="checkbox" checked={availOnly} onChange={e => setAvailOnly(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            Show available names only
          </label>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {shown.map(r => (
              <div key={r.domain} className={`flex items-center justify-between px-4 py-2.5 text-sm border-l-4 ${r.state === 'available' ? 'border-l-emerald-400 bg-emerald-50/40' : 'border-l-slate-200'}`}>
                <span className="font-mono text-slate-800">{r.domain}</span>
                {r.state === 'available' ? <Pill tone="ok"><Icon className="w-3 h-3">{ic.check}</Icon> available</Pill> : r.state === 'registered' ? <Pill tone="bad">registered</Pill> : <Pill tone="warn">check failed</Pill>}
              </div>
            ))}
            {availOnly && !avail.length && <p className="px-4 py-3 text-sm text-slate-400">No available names right now — every generated idea is registered.</p>}
          </div>
          <Note>Every suggestion is verified live against each registry’s RDAP service — no registration record means the name is genuinely unregistered right now. Register quickly if you like one: availability changes by the minute.</Note>
        </>
      )}
    </div>
  );
};

// ---------- 6. Related Keywords Finder ----------
const PREP_VARIANTS = (kw: string) => [`${kw} for`, `${kw} with`, `${kw} without`, `${kw} vs`, `${kw} near`, `${kw} like`];

const RelatedKeywordsTool: React.FC = () => {
  const [seed, setSeed] = useState('');
  const [active, setActive] = useState('');
  return (
    <div>
      <InputsCard>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1"><Label>Keyword</Label><TextInput value={seed} onChange={setSeed} ph="e.g. seo audit" onEnter={() => setActive(cleanKw(seed))} /></div>
          <div className="sm:pt-6"><Btn busy={false} label="Find Related Terms" onClick={() => setActive(cleanKw(seed))} disabled={!seed.trim()} /></div>
        </div>
      </InputsCard>
      {active && <SuggestionSections seed={active} kinds={['gsuggest', 'rel_trg', 'rel_syn', 'ml', 'wiki']} generated={MODIFIERS(active)} variants={PREP_VARIANTS(active)} />}
    </div>
  );
};

// ---------- 7. Long Tail Keyword Generator ----------
type TailRow = { text: string; source: 'live' | 'lexicon' | 'template'; words: number; chars: number };

const LongTailTool: React.FC = () => {
  const [seed, setSeed] = useState('');
  const kw = cleanKw(seed);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [longOnly, setLongOnly] = useState(true);

  React.useEffect(() => {
    let alive = true;
    if (!kw) { setExtra([]); setLive([]); return; }
    setBusy(true);
    void Promise.all([
      datamuse('ml', kw, 10).then(t => t.map(x => `${kw} ${x}`)).catch(() => [] as string[]),
      suggestVariants([`how to ${kw}`, `what is ${kw}`, `why ${kw}`, `best ${kw} for`, `${kw} vs`, `${kw} near me`])
        .then(groups => {
          const terms: string[] = [];
          for (const g of groups) for (const t of g.terms) if (t.toLowerCase() !== kw && !terms.some(x => x.toLowerCase() === t.toLowerCase())) terms.push(t);
          return terms;
        }).catch(() => [] as string[]),
    ]).then(([lex, liveTerms]) => {
      if (!alive) return;
      setExtra(lex); setLive(liveTerms); setBusy(false);
    });
    return () => { alive = false; };
  }, [kw]);

  if (!kw) return (
    <InputsCard>
      <Label>Seed keyword</Label>
      <TextInput value={seed} onChange={setSeed} ph="e.g. email marketing" />
      <p className="text-xs text-slate-400 mt-2">Variations generate live as you type — including real Google Autocomplete queries.</p>
    </InputsCard>
  );

  const templates = [
    `best ${kw}`, `top ${kw}`, `${kw} for beginners`, `how to choose ${kw}`, `what is ${kw}`,
    `${kw} guide`, `${kw} tips`, `${kw} checklist`, `${kw} pricing`, `affordable ${kw}`,
    `${kw} near me`, `${kw} online`, `professional ${kw}`, `${kw} for small business`,
    `${kw} review`, `${kw} vs alternatives`, `why ${kw} matters`, `how does ${kw} work`,
    `${kw} examples`, `benefits of ${kw}`, `${kw} mistakes to avoid`, `free ${kw} tools`,
    `step by step ${kw}`, `diy ${kw}`, `${kw} for bloggers`, `${kw} for ecommerce`,
    `ultimate guide to ${kw}`, `${kw} frequently asked questions`, `cheap ${kw} that work`, `${kw} comparison`,
  ];

  const mk = (text: string, source: TailRow['source']): TailRow => ({ text, source, words: text.split(/\s+/).length, chars: text.length });
  const all: TailRow[] = [];
  const push = (r: TailRow) => { if (!all.some(x => x.text.toLowerCase() === r.text.toLowerCase())) all.push(r); };
  live.forEach(t => push(mk(t, 'live')));
  extra.forEach(t => push(mk(t, 'lexicon')));
  templates.forEach(t => push(mk(t, 'template')));

  const f = filter.trim().toLowerCase();
  const rows = all.filter(r => (!f || r.text.includes(f)) && (!longOnly || r.words >= 3));
  const liveCount = all.filter(r => r.source === 'live').length;
  const avgWords = rows.length ? (rows.reduce((s, r) => s + r.words, 0) / rows.length).toFixed(1) : '0';

  const srcPill = (s: TailRow['source']) => s === 'live'
    ? <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[9px] font-black uppercase text-emerald-700" title="real Google Autocomplete result">live</span>
    : s === 'lexicon'
      ? <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[9px] font-black uppercase text-indigo-600" title="real term from the Datamuse lexicon">lexicon</span>
      : <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-black uppercase text-amber-700" title="proven template pattern">template</span>;

  return (
    <div className="space-y-4">
      <InputsCard>
        <Label>Seed keyword</Label>
        <TextInput value={seed} onChange={setSeed} ph="e.g. email marketing" />
      </InputsCard>
      {busy && <Status text={`Streaming live Google autocomplete rows for “${kw}” — templates below are instant…`} />}
      {(<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Variations" value={all.length.toLocaleString()} accent />
            <Stat label="Live autocomplete" value={String(liveCount)} sub="real Google suggestions" />
            <Stat label="Long-tail (3+ words)" value={String(all.filter(r => r.words >= 3).length)} />
            <Stat label="Avg length" value={`${avgWords} words`} sub="of the list below" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"><Icon>{ic.filter}</Icon></span>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter variations…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15" />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={longOnly} onChange={e => setLongOnly(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              Long-tail only (3+ words)
            </label>
            <DownloadBtn label="Export CSV" name={`long-tail-${kw.replace(/\s+/g, '-')}.csv`}
              build={() => ['keyword,source,words,characters', ...rows.map(r => `"${r.text}",${r.source},${r.words},${r.chars}`)].join('\n')} />
          </div>
          <Card title={`${rows.length} long-tail variations`} icon={ic.list} right={<Copy text={rows.map(r => r.text).join('\n')} />}>
            {rows.length ? (
              <div className="grid sm:grid-cols-2 gap-1.5">
                {rows.map(t => (
                  <div key={t.text} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5">
                    {srcPill(t.source)}
                    <span className="min-w-0 flex-1 truncate">{t.text}</span>
                    <span className="shrink-0 text-[10px] font-bold text-slate-400">{t.words}w · {t.chars}c</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No variations match the filter.</p>}
          </Card>
          <Note>Rows marked <span className="font-black uppercase text-emerald-700">live</span> are real Google Autocomplete results for question and comparison queries around your seed; <span className="font-black uppercase text-indigo-600">lexicon</span> rows are real meaning-similar terms from Datamuse; <span className="font-black uppercase text-amber-700">template</span> rows are proven low-competition patterns. Search volume is not shown because no free API publishes accurate volumes — guessing would be dishonest.</Note>
      </>)}
    </div>
  );
};

// ---------- 8. Keyword Competition Checker (live SERP analysis) ----------
const CompetitionTool: React.FC = () => {
  const [kw, setKw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{
    kw: string; resultCount: number | null; items: SerpItem[]; engine: string;
    competitors: { host: string; age: string | null; https: boolean; titleHasKw: boolean; tld: string }[];
    emd: boolean; emdHost?: string; titlesWithKw: number; score: number; agesPending: boolean;
    breakdown: { label: string; detail: string; points: number; max: number }[];
  } | null>(null);

  const run = async () => {
    const k = cleanKw(kw);
    if (!k) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const src = await fetchSerp(k);
      const { items, resultCount, engine } = src;
      const top = items.slice(0, 5);
      const kwSqueezed = k.replace(/[\s-]+/g, '');
      const emdItem = items.find(i => i.host.replace(/^www\./, '').replace(/\.[a-z.]+$/, '').replace(/[-.]/g, '').includes(kwSqueezed));
      const titlesWithKw = items.filter(i => i.title.toLowerCase().includes(k)).length;
      type Comp = { host: string; age: string | null; https: boolean; titleHasKw: boolean; tld: string };
      const build = (competitors: Comp[], agesPending: boolean) => {
        // Transparent scoring — each signal reports its own contribution.
        const pResults = resultCount ? (resultCount < 100_000 ? 15 : resultCount < 1_000_000 ? 30 : resultCount < 10_000_000 ? 45 : 60) : 35;
        const oldComps = competitors.filter(c => c.age && !c.age.startsWith('0 yr') && !c.age.startsWith('1 yr')).length;
        const pAge = oldComps * 5;
        const pEmd = emdItem ? 10 : 0;
        const pTitles = Math.min(15, titlesWithKw * 3);
        const score = Math.min(100, pResults + pAge + pEmd + pTitles);
        const breakdown = [
          { label: 'Indexed results', detail: resultCount ? `${resultCount.toLocaleString()} pages compete (per ${engine})` : `${engine} does not publish a result count — neutral 35 used`, points: pResults, max: 60 },
          { label: 'Aged competitors', detail: agesPending ? 'checking real RDAP registration dates of the top 5 domains…' : `${oldComps} of the top 5 domains registered 2+ years ago (RDAP)`, points: pAge, max: 25 },
          { label: 'Exact-match domain', detail: emdItem ? `${emdItem.host} ranks with the keyword in its domain` : 'no exact-match domain in the top results', points: pEmd, max: 10 },
          { label: 'Optimised titles', detail: `${titlesWithKw} of the top ${items.length} titles already target the keyword`, points: pTitles, max: 15 },
        ];
        return { score, breakdown };
      };
      const pending: Comp[] = top.map(i => ({ host: i.host, age: null, https: i.url.startsWith('https://'), titleHasKw: i.title.toLowerCase().includes(k), tld: (i.host.split('.').pop() || '').toLowerCase() }));
      // Paint instantly from the live SERP; the RDAP ages refine the score as they land.
      setRes({ kw: k, resultCount, items, engine, competitors: pending, emd: !!emdItem, emdHost: emdItem?.host, titlesWithKw, agesPending: true, ...build(pending, true) });
      const aged = await Promise.all(top.map(async i => {
        let age: string | null = null;
        try {
          const d = await rdapDomain(i.host.split('.').slice(-2).join('.'));
          const reg = d ? rdapEvent(d, 'registration') : undefined;
          age = reg ? ageText(reg) : null;
        } catch { /* age stays unknown */ }
        return age;
      }));
      const merged = pending.map((c, i2) => ({ ...c, age: aged[i2] }));
      setRes({ kw: k, resultCount, items, engine, competitors: merged, emd: !!emdItem, emdHost: emdItem?.host, titlesWithKw, agesPending: false, ...build(merged, false) });
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  const verdict = res ? (res.score < 35 ? 'Low competition' : res.score < 65 ? 'Moderate competition' : 'High competition') : '';

  return (
    <div>
      <InputsCard>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1"><Label>Keyword</Label><TextInput value={kw} onChange={setKw} ph="e.g. best web hosting" onEnter={() => void run()} /></div>
          <div className="sm:pt-6"><Btn busy={busy} label="Analyze Competition" onClick={() => void run()} /></div>
        </div>
      </InputsCard>
      {busy && !res && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20 flex flex-col sm:flex-row items-center gap-5">
            <div className="rounded-full bg-white/15 border-4 border-white/25 p-1"><Gauge score={res.score} /></div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Estimated difficulty — “{res.kw}”</p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-1">{verdict} · {res.score}/100</p>
              <p className="text-white/80 text-sm mt-1">computed from the live {res.engine} results page you can inspect below{res.agesPending ? ' — competitor ages still refining…' : ''}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Indexed results" value={res.resultCount ? res.resultCount.toLocaleString() : '—'} sub={`${res.engine} result count`} />
            <Stat label="Optimised titles" value={`${res.titlesWithKw}/${res.items.length}`} sub="top titles containing the keyword" />
            <Stat label="Exact-match domain" value={res.emd ? 'Yes' : 'None'} sub={res.emdHost ?? 'in top results'} accent={res.emd} />
            <Stat label="Aged competitors" value={`${res.competitors.filter(c => c.age && !c.age.startsWith('0 yr') && !c.age.startsWith('1 yr')).length}/5`} sub="top-5 domains registered 2+ yr (RDAP)" />
          </div>
          <Card title="How the score is built (fully transparent)" icon={ic.chart}>
            <div className="space-y-3">
              {res.breakdown.map(b => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-800 font-semibold">{b.label}</span>
                    <span className="text-xs font-bold text-slate-500 shrink-0">+{b.points} <span className="text-slate-400">/ {b.max}</span></span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{b.detail}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (b.points / b.max) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Who you would compete against (live top results)" icon={ic.trophy}
            right={res.agesPending ? <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin inline-block" />RDAP ages loading</span> : undefined}>
            <div className="divide-y divide-slate-100">
              {res.competitors.map((c, i) => (
                <div key={c.host} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-5 text-right font-extrabold text-slate-400">{i + 1}</span>
                    <span className="font-mono text-slate-800 truncate">{c.host}</span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500">.{c.tld}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {c.titleHasKw && <Pill tone="warn">targets keyword</Pill>}
                    <Pill tone={c.https ? 'ok' : 'muted'}>{c.https ? 'https' : 'http'}</Pill>
                    <span className="text-xs font-semibold text-slate-500">{c.age ? `registered ${c.age} ago` : res.agesPending ? 'checking…' : 'age unknown'}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card title={`Full live top results — ${res.engine} (${res.items.length})`} icon={ic.list}>
            <ol className="space-y-1.5">
              {res.items.map((i, idx) => (
                <li key={i.url} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-right font-extrabold text-slate-400 shrink-0">{idx + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-slate-800 truncate">{i.title}</span>
                    <span className="block text-xs font-mono text-slate-400 truncate">{i.host}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          <Note>The estimate combines four live signals — the engine’s indexed-result count (when published), how many top-10 titles already target the keyword, whether an exact-match domain ranks, and how old the competing domains are (real RDAP registration dates). Google is tried through three independent paths; a labelled Bing fallback runs only if every Google path is blocked. It is a transparency-first proxy, not a paid-tool score — every point is traceable to the rows above.</Note>
        </div>
      )}
    </div>
  );
};

export { KeywordRankTool, KeywordDensityTool, KeywordSuggestionsTool, WebsiteKeywordsTool, KeywordDomainsTool, RelatedKeywordsTool, LongTailTool, CompetitionTool, ngrams, parseSerp, parseDdg, parseBingMd, parseMdSerp, jinaFallback };
