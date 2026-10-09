import React, { useState } from 'react';
import { fetchPageData, type LivePageData } from '../utils/pageFetch';
import { parseDdg } from './KeywordTools';
import { rdapDomain, rdapEvent, ageText, fmtDate } from './DomainTools';

/* Live Website Checker engines. Everything on this page comes from real,
   keyless, public sources queried straight from the browser — no simulated
   numbers anywhere:
   • fetchPageData (CORS relays + Jina reader)  — the page's real HTML
   • api.allorigins.win/get                     — real HTTP status, final URL,
                                                  server-side response time and
                                                  on-the-wire content length
   • web.archive.org CDX + availability API     — real Wayback Machine history
   • index.commoncrawl.org                      — real Common Crawl captures
   • tranco-list.eu API                         — real top-1M traffic ranking
   • rdap.org + dns.google DoH                  — real registration + DNS data
   • crt.sh (Certificate Transparency)          — real TLS certificate data
   • html.duckduckgo.com (via relay)            — real search-index evidence
   • SURBL / Spamhaus DBL via DoH               — real DNS blocklists
   • iTunes Search API, HN Algolia, Reddit JSON — real app/social data        */

// ---------- shared helpers ----------
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const RAW_RELAYS: ((u: string) => string)[] = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
];

/** Text through the relay cascade (relays fetch server-side, so they also
    bypass CORS and follow redirects to the final URL). */
const relayHtml = async (url: string, ms = 12000): Promise<string | null> => {
  for (const rel of RAW_RELAYS) {
    try {
      const r = await withTimeout(fetch(rel(url)), ms);
      if (!r.ok) continue;
      const t = await r.text();
      if (t) return t;
    } catch { /* next relay */ }
  }
  return null;
};

/** Text fetched directly first (works for CORS-open APIs), relays as backup. */
const fetchTextAny = async (url: string, ms = 12000): Promise<string | null> => {
  try {
    const r = await withTimeout(fetch(url), ms);
    if (r.ok) return await r.text();
  } catch { /* relay fallback */ }
  return relayHtml(url, ms);
};

const fetchJsonAny = async <T,>(url: string, ms = 12000): Promise<T | null> => {
  try {
    const r = await withTimeout(fetch(url), ms);
    if (r.ok) return (await r.json()) as T;
  } catch { /* relay fallback */ }
  try {
    const via = await withTimeout(fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`), ms);
    if (via.ok) {
      const j = (await via.json()) as { contents?: string };
      if (j.contents) return JSON.parse(j.contents) as T;
    }
  } catch { /* fall through */ }
  return null;
};

type AoResult = { finalUrl: string; code: number | null; ms: number | null; type: string; length: number | null; body: string };
/** One real probe through the AllOrigins JSON endpoint: it reports the origin's
    HTTP code, its server-side response time, the transferred content length and
    the final URL after redirects. */
const aoGet = async (url: string, ms = 15000): Promise<AoResult | null> => {
  try {
    const r = await withTimeout(fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`), ms);
    if (!r.ok) return null;
    const j = (await r.json()) as { contents?: string; status?: { url?: string; http_code?: number; response_time?: number; content_type?: string; content_length?: number } };
    const s = j.status || {};
    return {
      finalUrl: s.url || url,
      code: typeof s.http_code === 'number' ? s.http_code : null,
      ms: typeof s.response_time === 'number' ? Math.round(s.response_time * 1000) : null,
      type: s.content_type || '',
      length: typeof s.content_length === 'number' ? s.content_length : null,
      body: typeof j.contents === 'string' ? j.contents : '',
    };
  } catch { return null; }
};

const cleanDomain = (v: string) =>
  v.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/[^a-z0-9.-]+/g, '');
const normUrl = (v: string) => {
  const t = v.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const looksUrl = (v: string) => !/\s/.test(v.trim()) && /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]\S*)?$/i.test(v.trim());
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
const tsDate = (ts: string) =>
  `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}${ts.length >= 12 ? ` ${ts.slice(8, 10)}:${ts.slice(10, 12)} UTC` : ''}`;
const agoText = (fromIso: string) => {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return '';
  const days = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (days < 1) return 'today';
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  if (days < 365) return `${Math.floor(days / 30.44)} month(s) ago`;
  return `${(days / 365.25).toFixed(1)} years ago`;
};

/** Word-shingle Jaccard similarity — the real overlap between two texts. */
const shingles = (text: string, k = 3): Set<string> => {
  const w = text.toLowerCase().match(/[a-z0-9']+/g) || [];
  const s = new Set<string>();
  for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(' '));
  return s;
};
const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach(x => { if (b.has(x)) inter++; });
  return inter / (a.size + b.size - inter);
};
// ---------- real open-data sources ----------
type Wayback = { first: string | null; monthly: number | null; latest: string | null; latestUrl: string | null };
const wayback = async (target: string): Promise<Wayback> => {
  const enc = encodeURIComponent(target);
  const [firstJ, countJ, avail] = await Promise.all([
    fetchJsonAny<[string, string][] | null>(`https://web.archive.org/cdx/search/cdx?url=${enc}&output=json&fl=timestamp&limit=1`, 12000).catch(() => null),
    fetchJsonAny<[string, string][] | null>(`https://web.archive.org/cdx/search/cdx?url=${enc}&output=json&fl=timestamp&collapse=timestamp:6&limit=1000`, 12000).catch(() => null),
    fetchJsonAny<{ archived_snapshots?: { closest?: { timestamp?: string; url?: string; available?: boolean } } } | null>(`https://archive.org/wayback/available?url=${enc}`, 12000).catch(() => null),
  ]);
  const closest = avail?.archived_snapshots?.closest;
  return {
    first: Array.isArray(firstJ) && firstJ[1] ? String(firstJ[1][0]) : null,
    monthly: Array.isArray(countJ) ? Math.max(0, countJ.length - 1) : null,
    latest: closest?.available && closest.timestamp ? closest.timestamp : null,
    latestUrl: closest?.available && closest.url ? closest.url : null,
  };
};

/** Captures of a domain/URL in the newest Common Crawl index (real NDJSON rows). */
const commonCrawl = async (target: string, matchDomain: boolean): Promise<number | null> => {
  const info = await fetchJsonAny<{ id?: string }[] | null>('https://index.commoncrawl.org/collinfo.json', 12000).catch(() => null);
  const id = Array.isArray(info) && info[0]?.id ? String(info[0].id) : null;
  if (!id) return null;
  const q = matchDomain ? `url=${encodeURIComponent(`*.${target}`)}&matchType=domain` : `url=${encodeURIComponent(target)}`;
  const txt = await fetchTextAny(`https://index.commoncrawl.org/${id}-index?${q}&output=json&limit=200&fl=urlkey`, 15000);
  if (txt == null) return null;
  return txt.split('\n').filter(l => l.trim().startsWith('{')).length;
};

type TrancoRes = { ranks?: { date?: string; rank?: number }[] };
const tranco = async (domain: string): Promise<{ rank: number; date: string } | null> => {
  const j = await fetchJsonAny<TrancoRes>(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`, 12000).catch(() => null);
  const first = j?.ranks?.[0];
  return first && typeof first.rank === 'number' ? { rank: first.rank, date: first.date || '' } : null;
};

const doh = async (name: string, type = 'A'): Promise<string[]> => {
  try {
    const r = await withTimeout(fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`), 8000);
    if (!r.ok) return [];
    const j = (await r.json()) as { Answer?: { data?: string }[] };
    return (j.Answer || []).map(a => String(a.data ?? ''));
  } catch { return []; }
};

const ddgSearch = async (q: string): Promise<{ url: string; host: string; title: string }[]> => {
  const html = await relayHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 12000);
  return html ? parseDdg(html) : [];
};

const stripTags = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const stripMd = (md: string) =>
  md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/^(Title|URL Source|Markdown Content):/gm, '').replace(/[#>*`_~|]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- UI kit (same family as the domain tools) ----------
const Icon: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);
const ic = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />,
  shieldCheck: <><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
  gauge: <><path d="M4 14a8 8 0 0 1 16 0" /><path d="M12 14l4-4" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  zap: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  bug: <><rect x="8" y="6" width="8" height="14" rx="4" /><path d="M12 6V3M8 10H4M20 10h-4M8 16H4M20 16h-4M9 20l-2 2M15 20l2 2" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  browser: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>,
};

const Spin: React.FC = () => <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" aria-hidden="true" />;

const Copy: React.FC<{ text: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" aria-label="Copy" onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
      <Icon className="w-4 h-4">{ok ? ic.check : ic.copy}</Icon>
    </button>
  );
};

const SearchBar: React.FC<{ ph: string; cta: string; busy: boolean; onRun: (v: string) => void; samples?: string[]; icon?: React.ReactNode; second?: { ph: string; value: string; onChange: (v: string) => void }; extra?: React.ReactNode }> = ({ ph, cta, busy, onRun, samples, icon, second, extra }) => {
  const [v, setV] = useState('');
  return (
    <div className="mb-6">
      <div className={`grid gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all ${second ? 'md:grid-cols-[1fr_1fr_auto]' : 'sm:grid-cols-[1fr_auto]'}`}>
        <div className="flex items-center gap-3 px-3 min-w-0">
          <span className="text-indigo-500 shrink-0">{icon ?? <Icon className="w-5 h-5">{ic.globe}</Icon>}</span>
          <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !busy && v.trim()) onRun(v); }}
            placeholder={ph} aria-label={ph}
            className="w-full py-3 bg-transparent outline-none text-sm font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans" />
        </div>
        {second && (
          <div className="flex items-center gap-3 px-3 min-w-0 border-t md:border-t-0 md:border-l border-slate-100">
            <span className="text-purple-500 shrink-0"><Icon className="w-5 h-5">{ic.doc}</Icon></span>
            <input value={second.value} onChange={e => second.onChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !busy && v.trim()) onRun(v); }}
              placeholder={second.ph} aria-label={second.ph}
              className="w-full py-3 bg-transparent outline-none text-sm font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans" />
          </div>
        )}
        <button type="button" onClick={() => v.trim() && onRun(v)} disabled={busy || !v.trim()}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? <><Spin /> Working…</> : <>{cta} <Icon>{ic.arrow}</Icon></>}
        </button>
      </div>
      {extra}
      {samples && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-slate-400 font-semibold">Try:</span>
          {samples.map(s => (
            <button key={s} type="button" disabled={busy} onClick={() => { setV(s); onRun(s); }}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Skeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-hidden="true">
    <div className="h-32 rounded-2xl bg-slate-200/70" />
    <div className="grid sm:grid-cols-3 gap-3">
      <div className="h-24 rounded-xl bg-slate-200/60" /><div className="h-24 rounded-xl bg-slate-200/60" /><div className="h-24 rounded-xl bg-slate-200/60" />
    </div>
  </div>
);

const Hero: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20 mb-4">{children}</div>
);

const Tile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; copy?: string }> = ({ icon, label, value, sub, copy }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2 min-w-0">
    <div className="flex items-center justify-between">
      <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center"><Icon className="w-4 h-4">{icon}</Icon></span>
      {copy && <Copy text={copy} />}
    </div>
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-sm font-semibold text-slate-800 leading-snug break-words">{value}</p>
    {sub && <p className="text-xs text-slate-400 -mt-1 break-words">{sub}</p>}
  </div>
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

const Pill: React.FC<{ tone: 'ok' | 'bad' | 'warn' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = tone === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tone === 'bad' ? 'bg-red-50 text-red-600 border-red-200'
    : tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-500 border-slate-200';
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>{children}</span>;
};

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-500 leading-relaxed">
    <span className="text-slate-400 shrink-0 mt-0.5"><Icon>{ic.shield}</Icon></span>
    <p>{children}</p>
  </div>
);

const ErrBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
    <span className="shrink-0 mt-0.5"><Icon>{ic.alert}</Icon></span>
    <p>{msg}</p>
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode; tone?: 'good' | 'warn' | 'bad' | 'muted' }> = ({ label, value, tone = 'muted' }) => {
  const cls = tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold text-right break-words min-w-0 ${cls}`}>{value}</span>
    </div>
  );
};

const Gauge: React.FC<{ score: number; label?: string }> = ({ score, label = 'Score' }) => {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  const circ = 2 * Math.PI * 42;
  return (
    <div className="relative w-28 h-28 shrink-0" role="img" aria-label={`${label}: ${Math.round(pct)} out of 100`}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="9" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(pct / 100) * circ} ${circ}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold leading-none">{Math.round(pct)}</span>
        <span className="text-[10px] uppercase tracking-wide text-white/70 mt-0.5">{label}</span>
      </div>
    </div>
  );
};

const LiveBadge: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-0.5">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{children ?? 'Live data'}
  </span>
);

const SAMPLES = ['google.com', 'wikipedia.org', 'github.com'];

// ---------- 1. Google Cache Checker (real Wayback Machine data) ----------
const ArchiveCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ domain: string; wb: Wayback } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    const wb = await wayback(domain);
    if (!wb.first && !wb.latest && wb.monthly === null) { setErr(`No archive records could be retrieved for ${domain}. The Wayback Machine may be unreachable right now — try again in a moment.`); setBusy(false); return; }
    setRes({ domain, wb });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Check Archive" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.archive}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center"><Icon className="w-6 h-6">{ic.archive}</Icon></span>
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Last archived snapshot</p>
                <p className="text-2xl font-extrabold break-all mt-0.5">{res.wb.latest ? tsDate(res.wb.latest) : 'Never archived'}</p>
                <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.domain}{res.wb.latest ? ` · ${agoText(tsDate(res.wb.latest))}` : ''}</p>
              </div>
            </div>
          </Hero>
          <div className="grid sm:grid-cols-3 gap-3">
            <Tile icon={ic.clock} label="Latest snapshot" value={res.wb.latest ? tsDate(res.wb.latest) : '—'} sub={res.wb.latest ? agoText(tsDate(res.wb.latest)) : 'no archived copy found'} />
            <Tile icon={ic.archive} label="First archived" value={res.wb.first ? tsDate(res.wb.first) : '—'} sub={res.wb.first ? agoText(tsDate(res.wb.first)) : undefined} />
            <Tile icon={ic.chart} label="Distinct months archived" value={res.wb.monthly ?? '—'} sub={res.wb.monthly !== null ? (res.wb.monthly >= 999 ? 'capped at 1,000 records' : 'months with at least one snapshot') : undefined} />
          </div>
          {res.wb.latestUrl && (
            <Card title="Open the archived copy" icon={ic.globe}>
              <a href={res.wb.latestUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                View snapshot on web.archive.org <Icon>{ic.arrow}</Icon>
              </a>
              <p className="text-xs text-slate-400 mt-3 break-all">{res.wb.latestUrl}</p>
            </Card>
          )}
          <Note>Google retired its public cache: viewer in 2024, so no tool can show a real Google cache date any more. This checker queries the Internet Archive's live CDX API instead — the timestamps above are real snapshot records from web.archive.org.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 2. Whois Checker (real RDAP registry data) ----------
const WhoisCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ domain: string; d: NonNullable<Awaited<ReturnType<typeof rdapDomain>>> } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const d = await rdapDomain(domain);
      if (!d) { setErr(`${domain} is not registered — no registry (RDAP) record exists for it.`); setBusy(false); return; }
      setRes({ domain, d });
    } catch (e) { setErr(e instanceof Error ? e.message : 'The registry lookup failed. Check the domain and try again.'); }
    setBusy(false);
  };

  const registrar = (d: NonNullable<Awaited<ReturnType<typeof rdapDomain>>>) => {
    const e = d.entities?.find(x => x.roles?.includes('registrar'));
    const fn = e?.vcardArray?.[1]?.find(c => c[0] === 'fn');
    return typeof fn?.[3] === 'string' ? fn[3] : '—';
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Look Up Whois" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.doc}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const { d, domain } = res;
        const created = rdapEvent(d, 'registration');
        const expires = rdapEvent(d, 'expiration');
        const changed = rdapEvent(d, 'last changed');
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Registry record (RDAP)</p>
                  <p className="text-2xl font-extrabold font-mono break-all mt-1">{domain}</p>
                  <p className="text-white/80 text-sm mt-2">Registrar: <span className="font-semibold">{registrar(d)}</span>{created ? ` · registered ${ageText(created)}` : ''}</p>
                </div>
                <LiveBadge>rdap.org live record</LiveBadge>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile icon={ic.clock} label="Registered" value={fmtDate(created)} sub={created ? ageText(created) : undefined} />
              <Tile icon={ic.alert} label="Expires" value={fmtDate(expires)} sub={expires ? agoText(expires).startsWith('-') ? undefined : undefined : undefined} />
              <Tile icon={ic.doc} label="Last changed" value={fmtDate(changed)} />
              <Tile icon={ic.shield} label="DNSSEC" value={d.secureDNS?.delegationSigned ? 'Signed' : 'Not signed'} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card title="Registration status" icon={ic.list}>
                <div className="flex flex-wrap gap-2">
                  {(d.status || []).map(s => <Pill key={s} tone={/ok|active/i.test(s) ? 'ok' : /hold|pending|redemption/i.test(s) ? 'warn' : 'muted'}>{s}</Pill>)}
                  {!(d.status || []).length && <span className="text-sm text-slate-400">The registry did not report status codes.</span>}
                </div>
              </Card>
              <Card title="Nameservers" icon={ic.server}>
                <div className="flex flex-wrap gap-2">
                  {(d.nameservers || []).map(n => n.ldhName).filter(Boolean).map(n => (
                    <span key={n} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-mono text-slate-700">{n}<Copy text={n as string} /></span>
                  ))}
                  {!(d.nameservers || []).length && <span className="text-sm text-slate-400">No nameservers in the registry record.</span>}
                </div>
              </Card>
            </div>
            <Note>Registration data comes live from the domain registry's RDAP record via rdap.org — the modern, privacy-safe replacement for the legacy WHOIS protocol. Personal registrant details are redacted by ICANN policy, so registrar, dates, status and nameservers are what every public lookup can show.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 3. MozRank-style link popularity (transparent, real signals) ----------
const usePopularity = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | {
    domain: string; rank: { rank: number; date: string } | null; cc: number | null; wb: Wayback; age: string | null;
  }>(null);
  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    const [rank, cc, wb, reg] = await Promise.all([
      tranco(domain),
      commonCrawl(domain, true),
      wayback(domain),
      rdapDomain(domain).catch(() => null),
    ]);
    const created = reg ? rdapEvent(reg, 'registration') : undefined;
    if (!rank && cc === null && !wb.first && wb.monthly === null) {
      setErr(`None of the open popularity sources (Tranco, Common Crawl, Wayback Machine) answered for ${domain}. They may be rate-limiting right now — try again shortly.`);
      setBusy(false); return;
    }
    setRes({ domain, rank, cc, wb, age: created || null });
    setBusy(false);
  };
  return { busy, err, res, run, setBusy };
};

const popularityScore = (rank: number | null, cc: number | null, monthly: number | null) => {
  // Transparent formula over real numbers — every input is shown next to it.
  let s = 0;
  if (rank !== null) s += rank <= 1000 ? 5 : rank <= 10000 ? 4 : rank <= 100000 ? 3 : rank <= 500000 ? 2 : 1;
  if (cc !== null) s += cc >= 100 ? 3 : cc >= 20 ? 2 : cc > 0 ? 1 : 0;
  if (monthly !== null) s += monthly >= 120 ? 2 : monthly >= 24 ? 1.5 : monthly > 0 ? 0.75 : 0;
  return Math.round(Math.min(10, s) * 10) / 10;
};

const PopularityReport: React.FC<{ domain: string; rank: { rank: number; date: string } | null; cc: number | null; wb: Wayback; age: string | null; metricName: string; blurb: string }> = ({ domain, rank, cc, wb, age, metricName, blurb }) => {
  const score = popularityScore(rank?.rank ?? null, cc, wb.monthly);
  return (
    <div className="space-y-4">
      <Hero>
        <div className="flex items-center gap-6 flex-wrap">
          <Gauge score={score * 10} label={`${metricName} /10`} />
          <div className="min-w-0">
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">{metricName} (open-data estimate)</p>
            <p className="text-2xl font-extrabold font-mono break-all mt-1">{domain}</p>
            <p className="text-white/80 text-sm mt-2 max-w-lg">{blurb}</p>
          </div>
        </div>
      </Hero>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={ic.chart} label="Tranco top-1M rank" value={rank ? `#${rank.rank.toLocaleString()}` : 'Not in top 1M'} sub={rank?.date ? `list dated ${rank.date}` : 'built from Chrome UX + Cloudflare traffic'} />
        <Tile icon={ic.server} label="Common Crawl captures" value={cc === null ? 'unreachable' : `${cc}${cc >= 200 ? '+' : ''}`} sub="pages of this domain in the newest crawl" />
        <Tile icon={ic.archive} label="Months archived" value={wb.monthly ?? '—'} sub={wb.first ? `since ${tsDate(wb.first)}` : 'no Wayback history'} />
        <Tile icon={ic.clock} label="Domain age" value={age ? ageText(age) : '—'} sub={age ? `registered ${fmtDate(age)}` : 'no RDAP record'} />
      </div>
      <Card title="How this score is computed" icon={ic.gauge}>
        <div>
          <Row label="Tranco rank (real top-1M list)" value={rank ? (rank.rank <= 1000 ? '+5.0 (top 1,000)' : rank.rank <= 10000 ? '+4.0 (top 10K)' : rank.rank <= 100000 ? '+3.0 (top 100K)' : rank.rank <= 500000 ? '+2.0 (top 500K)' : '+1.0 (top 1M)') : '+0 (unranked)'} tone={rank ? 'good' : 'muted'} />
          <Row label="Common Crawl captures (real crawl index)" value={cc === null ? 'source unreachable' : cc >= 100 ? '+3.0 (100+ pages)' : cc >= 20 ? '+2.0 (20+ pages)' : cc > 0 ? '+1.0 (some pages)' : '+0 (not crawled)'} tone={cc && cc > 0 ? 'good' : 'muted'} />
          <Row label="Wayback history (real snapshot count)" value={wb.monthly === null ? 'source unreachable' : wb.monthly >= 120 ? '+2.0 (10+ years)' : wb.monthly >= 24 ? '+1.5 (2+ years)' : wb.monthly > 0 ? '+0.75 (some history)' : '+0 (no history)'} tone={wb.monthly ? 'good' : 'muted'} />
          <Row label="Total" value={`${score} / 10`} tone="good" />
        </div>
      </Card>
      <Note>MozRank and Page Authority are proprietary Moz metrics that require a paid Moz API key — no free tool can show their real values, and any site claiming to is guessing. This checker instead scores {domain} with three verifiable public datasets (Tranco's traffic ranking, Common Crawl's index and the Wayback Machine), and every input is displayed so you can check the maths.</Note>
    </div>
  );
};

const MozRankTool: React.FC = () => {
  const { busy, err, res, run } = usePopularity();
  return (
    <div>
      <SearchBar ph="example.com" cta="Check Link Popularity" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.gauge}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && <PopularityReport {...res} metricName="Link popularity" blurb="A transparent 0–10 score built from real traffic-ranking, crawl-index and archive data — no proprietary black box, no invented numbers." />}
    </div>
  );
};

// ---------- 4. Page Authority Checker (real page + domain signals) ----------
const PageAuthorityTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { url: string; page: LivePageData | null; cc: number | null; rank: { rank: number; date: string } | null; age: string | null }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    const domain = hostOf(url);
    setBusy(true); setErr(''); setRes(null);
    const [page, cc, rank, reg] = await Promise.all([
      fetchPageData(url).catch(() => null),
      domain ? commonCrawl(url.replace(/^https?:\/\//, ''), false) : Promise.resolve(null),
      domain ? tranco(domain) : Promise.resolve(null),
      domain ? rdapDomain(domain).catch(() => null) : Promise.resolve(null),
    ]);
    if (!page && cc === null && !rank) { setErr(`No live source answered for ${url}. The page may block automated fetches — try another URL.`); setBusy(false); return; }
    const created = reg ? rdapEvent(reg, 'registration') : undefined;
    setRes({ url, page, cc, rank, age: created || null });
    setBusy(false);
  };

  const scoreOf = (r: NonNullable<typeof res>) => {
    let s = 0;
    if (r.rank) s += r.rank.rank <= 10000 ? 3 : r.rank.rank <= 100000 ? 2.25 : r.rank.rank <= 1000000 ? 1.5 : 0.75;
    if (r.cc !== null) s += r.cc > 0 ? 1.5 : 0;
    if (r.page) {
      s += Math.min(2, r.page.wordCount / 600);              // content depth, max 2
      s += r.page.internalLinks >= 10 ? 1 : r.page.internalLinks > 0 ? 0.5 : 0;
      s += (r.page.title ? 0.5 : 0) + (r.page.description ? 0.5 : 0) + (r.page.headingCounts.H1 === 1 ? 0.5 : 0);
      s += r.page.finalUrl.startsWith('https://') ? 0.5 : 0;
    }
    if (r.age) s += Math.min(1.5, (Date.now() - new Date(r.age).getTime()) / 31557600000 * 0.3);
    return Math.round(Math.min(100, s * 10));
  };

  return (
    <div>
      <SearchBar ph="https://example.com/page" cta="Check Page Authority" busy={busy} onRun={v => void run(v)} samples={['https://en.wikipedia.org/wiki/SEO', 'https://github.com/']} icon={<Icon className="w-5 h-5">{ic.gauge}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const score = scoreOf(res);
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center gap-6 flex-wrap">
                <Gauge score={score} label="PA /100" />
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Page authority (open-data estimate)</p>
                  <p className="text-lg font-extrabold font-mono break-all mt-1">{res.url}</p>
                  <p className="text-white/80 text-sm mt-2 max-w-lg">Scored from the live page itself plus real domain-level signals — content depth, internal linking, crawl index presence and traffic rank.</p>
                </div>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile icon={ic.chart} label="Site traffic rank" value={res.rank ? `#${res.rank.rank.toLocaleString()}` : 'Not in top 1M'} sub="Tranco (Chrome UX + Cloudflare)" />
              <Tile icon={ic.server} label="URL in Common Crawl" value={res.cc === null ? 'unreachable' : res.cc > 0 ? 'Yes — captured' : 'Not captured'} sub="newest Common Crawl index" />
              <Tile icon={ic.doc} label="Content depth" value={res.page ? `${res.page.wordCount.toLocaleString()} words` : 'page not fetched'} sub={res.page ? `${res.page.headingCounts.H1} H1 · ${res.page.internalLinks} internal links` : undefined} />
              <Tile icon={ic.clock} label="Domain age" value={res.age ? ageText(res.age) : '—'} sub={res.age ? `registered ${fmtDate(res.age)}` : undefined} />
            </div>
            {res.page && (
              <Card title="On-page signals found in the live HTML" icon={ic.list}>
                <div>
                  <Row label="Title tag" value={res.page.title ? `${res.page.title.length} chars` : 'missing'} tone={res.page.title ? 'good' : 'bad'} />
                  <Row label="Meta description" value={res.page.description ? `${res.page.description.length} chars` : 'missing'} tone={res.page.description ? 'good' : 'bad'} />
                  <Row label="Exactly one H1" value={res.page.headingCounts.H1 === 1 ? 'yes' : `${res.page.headingCounts.H1} found`} tone={res.page.headingCounts.H1 === 1 ? 'good' : 'warn'} />
                  <Row label="Internal links" value={String(res.page.internalLinks)} tone={res.page.internalLinks >= 10 ? 'good' : 'warn'} />
                  <Row label="HTTPS" value={res.page.finalUrl.startsWith('https://') ? 'yes' : 'no'} tone={res.page.finalUrl.startsWith('https://') ? 'good' : 'bad'} />
                </div>
              </Card>
            )}
            <Note>Moz's proprietary Page Authority needs a paid API key; any free “PA score” online is fabricated. This estimate uses only verifiable inputs — the live HTML, Common Crawl's index, Tranco's traffic list and the RDAP registration date — all listed above.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 5. Google Index Checker (real search-index evidence) ----------
const IndexCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { domain: string; items: { url: string; title: string }[]; robots: string | null; sitemapUrls: number | null; sitemapSrc: string | null }>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    const [items, robotsTxt] = await Promise.all([
      ddgSearch(`site:${domain}`),
      relayHtml(`https://${domain}/robots.txt`, 10000).then(t => (t && /user-agent|sitemap|disallow/i.test(t) && !/<html/i.test(t.slice(0, 300)) ? t : null)),
    ]);
    let sitemapUrls: number | null = null;
    let sitemapSrc: string | null = null;
    const smLine = robotsTxt ? /sitemap:\s*(\S+)/i.exec(robotsTxt) : null;
    const smUrl = smLine?.[1] || `https://${domain}/sitemap.xml`;
    const sm = await relayHtml(smUrl, 10000);
    if (sm && /<urlset|<sitemapindex/i.test(sm)) {
      sitemapUrls = (sm.match(/<loc>/gi) || []).length;
      sitemapSrc = smUrl;
    }
    if (!items.length && !robotsTxt && sitemapUrls === null) {
      setErr(`No search engine results, robots.txt or sitemap could be reached for ${domain}. DuckDuckGo may be rate-limiting the relay — try again shortly.`);
      setBusy(false); return;
    }
    setRes({ domain, items: items.slice(0, 10).map(i => ({ url: i.url, title: i.title })), robots: robotsTxt ? robotsTxt.slice(0, 2000) : null, sitemapUrls, sitemapSrc });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Check Indexing" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.search}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Pages found in the live search index</p>
                <p className="text-3xl font-extrabold mt-1">{res.items.length ? `${res.items.length}${res.items.length >= 10 ? '+' : ''} pages` : '0 pages'}</p>
                <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.domain} · via DuckDuckGo's index</p>
              </div>
              <Pill tone={res.items.length ? 'ok' : 'warn'}>{res.items.length ? 'Indexed pages found' : 'No pages surfaced'}</Pill>
            </div>
          </Hero>
          {res.items.length > 0 && (
            <Card title="Indexed pages (real results)" icon={ic.list}>
              <ul className="divide-y divide-slate-100">
                {res.items.map(i => (
                  <li key={i.url} className="py-2.5">
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-600 hover:underline break-all">{i.title || i.url}</a>
                    <p className="text-xs text-slate-400 font-mono break-all mt-0.5">{i.url}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <Tile icon={ic.doc} label="robots.txt" value={res.robots ? 'Published' : 'Not found'} sub={res.robots ? 'crawl rules detected' : `https://${res.domain}/robots.txt did not return a robots file`} />
            <Tile icon={ic.list} label="XML sitemap" value={res.sitemapUrls === null ? 'Not found' : `${res.sitemapUrls} URL(s)`} sub={res.sitemapSrc || 'no sitemap.xml or Sitemap: line in robots.txt'} />
          </div>
          {res.robots && (
            <Card title="robots.txt contents" icon={ic.doc}>
              <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-all max-h-60 overflow-auto">{res.robots}</pre>
            </Card>
          )}
          <Note>Google's own index status requires the Search Console API (site-owner authentication), so no public tool can query it directly. This checker shows real evidence instead: a live site: search through DuckDuckGo's index, plus your actual robots.txt and sitemap files.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 6. Website Authority / Traffic Rank (real Tranco data) ----------
const TrafficRankTool: React.FC = () => {
  const { busy, err, res, run } = usePopularity();
  return (
    <div>
      <SearchBar ph="example.com" cta="Check Traffic Rank" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.chart}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="w-28 h-28 shrink-0 rounded-2xl bg-white/15 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold leading-none">{res.rank ? `#${res.rank.rank.toLocaleString()}` : '—'}</span>
                <span className="text-[10px] uppercase tracking-wide text-white/70 mt-1">global rank</span>
              </div>
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Tranco top-1M traffic rank</p>
                <p className="text-2xl font-extrabold font-mono break-all mt-1">{res.domain}</p>
                <p className="text-white/80 text-sm mt-2 max-w-lg">
                  {res.rank ? `Ranked #${res.rank.rank.toLocaleString()} worldwide${res.rank.date ? ` in the ${res.rank.date} list` : ''} — built from real Chrome and Cloudflare traffic measurements.` : 'Not inside the top one million sites — either low traffic or too new to be measured.'}
                </p>
              </div>
            </div>
          </Hero>
          <div className="grid sm:grid-cols-3 gap-3">
            <Tile icon={ic.chart} label="Tranco rank" value={res.rank ? `#${res.rank.rank.toLocaleString()}` : 'Outside top 1M'} sub={res.rank?.date || undefined} />
            <Tile icon={ic.server} label="Common Crawl captures" value={res.cc === null ? 'unreachable' : `${res.cc}${res.cc >= 200 ? '+' : ''}`} sub="pages in newest crawl index" />
            <Tile icon={ic.archive} label="Wayback history" value={res.wb.monthly === null ? '—' : `${res.wb.monthly} months`} sub={res.wb.first ? `archived since ${tsDate(res.wb.first)}` : undefined} />
          </div>
          <Note>Alexa.com — the source of the famous “Alexa Rank” — was shut down by Amazon in May 2022, so every tool still showing an Alexa number is inventing it. This checker uses Tranco instead: the research-standard top-1M list averaged from real Chrome User Experience Report and Cloudflare DNS traffic, plus Common Crawl and Wayback Machine records.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 7. Redirect Checker (real final URLs + status codes) ----------
const RedirectCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { input: string; probes: { variant: string; url: string; finalUrl: string; code: number | null; ms: number | null; redirected: boolean }[] }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    let host = '';
    try { host = new URL(url).hostname; } catch { setErr('That does not look like a valid URL.'); setBusy(false); return; }
    const bare = host.replace(/^www\./, '');
    const variants: { variant: string; url: string }[] = [
      { variant: 'As entered', url },
      { variant: 'http:// (insecure)', url: `http://${host}/` },
      { variant: 'https://', url: `https://${host}/` },
      { variant: host.startsWith('www.') ? 'without www' : 'with www', url: host.startsWith('www.') ? `https://${bare}/` : `https://www.${bare}/` },
    ];
    const probes = await Promise.all(variants.map(async ({ variant, url: u }) => {
      const r = await aoGet(u);
      const finalUrl = r?.finalUrl || u;
      const norm = (x: string) => x.replace(/\/+$/, '').toLowerCase();
      return { variant, url: u, finalUrl, code: r?.code ?? null, ms: r?.ms ?? null, redirected: !!r && norm(finalUrl) !== norm(u) };
    }));
    if (probes.every(p => p.code === null)) { setErr('None of the probes could reach that address — the site may be down or blocking all relays.'); setBusy(false); return; }
    setRes({ input: url, probes });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com/old-page" cta="Trace Redirects" busy={busy} onRun={v => void run(v)} samples={['http://google.com', 'http://github.com']} icon={<Icon className="w-5 h-5">{ic.arrow}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Redirect trace (real HTTP responses)</p>
            <p className="text-xl font-extrabold font-mono break-all mt-1">{res.input}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {res.probes.filter(p => p.redirected).length > 0
                ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">{res.probes.filter(p => p.redirected).length} of {res.probes.length} probes redirected</span>
                : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold">No redirects detected</span>}
            </div>
          </Hero>
          <Card title="Every variant, followed to its real destination" icon={ic.list}>
            <div className="overflow-x-auto -m-5 px-5">
              <table className="w-full text-left text-sm min-w-[640px]">
                <thead><tr className="text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Probe</th><th className="py-2 pr-3">Requested</th><th className="py-2 pr-3">Landed on</th><th className="py-2 pr-3">Status</th><th className="py-2">Time</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {res.probes.map(p => (
                    <tr key={p.variant}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-700 whitespace-nowrap">{p.variant}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-500 break-all">{p.url}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs break-all">{p.code === null ? <span className="text-red-500">unreachable</span> : <span className={p.redirected ? 'text-indigo-600 font-semibold' : 'text-slate-700'}>{p.finalUrl}</span>}</td>
                      <td className="py-2.5 pr-3">{p.code === null ? <Pill tone="bad">fail</Pill> : <Pill tone={p.code < 400 ? 'ok' : 'bad'}>{p.code}</Pill>}</td>
                      <td className="py-2.5 text-slate-500 whitespace-nowrap">{p.ms !== null ? `${p.ms} ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Note>Each probe is a real HTTP request; “Landed on” is the actual final URL the server chain resolved to and the status code is the origin's own response. Response times are measured at the relay, so treat them as an upper bound for your connection.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 8. Similar Page Checker (real content similarity) ----------
const SimilarPageTool: React.FC = () => {
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { a: { url: string; page: LivePageData | null; text: string }; b: { url: string; page: LivePageData | null; text: string }; sim: number }>(null);

  const load = async (v: string) => {
    const t = v.trim();
    if (looksUrl(t)) {
      const page = await fetchPageData(normUrl(t)).catch(() => null);
      return { url: normUrl(t), page, text: page ? page.bodyText : '' };
    }
    return { url: '(pasted text)', page: null, text: t };
  };

  const run = async (v: string) => {
    if (!v.trim() || !b.trim()) { setErr('Provide both pages — URLs or pasted text.'); return; }
    setBusy(true); setErr(''); setRes(null);
    const [a, bb] = await Promise.all([load(v), load(b)]);
    if (!a.text && a.page === null && looksUrl(v)) { setErr(`Page A (${normUrl(v)}) could not be fetched — it may block automated access.`); setBusy(false); return; }
    if (!bb.text && bb.page === null && looksUrl(b)) { setErr(`Page B (${normUrl(b)}) could not be fetched — it may block automated access.`); setBusy(false); return; }
    const sim = Math.round(jaccard(shingles(a.text), shingles(bb.text)) * 1000) / 10;
    setRes({ a, b: bb, sim });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="Page A — URL or pasted text" cta="Compare Pages" busy={busy} onRun={v => void run(v)} icon={<Icon className="w-5 h-5">{ic.copy}</Icon>}
        second={{ ph: 'Page B — URL or pasted text', value: b, onChange: setB }} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-center gap-6 flex-wrap">
              <Gauge score={res.sim} label="Similar" />
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Content similarity (word-sequence shingles)</p>
                <p className="text-2xl font-extrabold mt-1">{res.sim}% overlap</p>
                <p className="text-white/80 text-sm mt-2 max-w-lg">
                  {res.sim >= 80 ? 'These pages are near-duplicates — search engines will likely treat one as a copy of the other.' :
                   res.sim >= 40 ? 'Substantial overlap. Shared boilerplate or heavily reused copy is likely.' :
                   res.sim >= 15 ? 'Some shared phrases, but the pages are largely distinct.' :
                   'These pages share almost no content sequences.'}
                </p>
              </div>
            </div>
          </Hero>
          <div className="grid md:grid-cols-2 gap-4">
            {([['Page A', res.a], ['Page B', res.b]] as const).map(([label, side]) => (
              <Card key={label} title={`${label} · ${side.page ? `${side.page.wordCount.toLocaleString()} words` : `${(side.text.match(/\S+/g) || []).length.toLocaleString()} words`}`} icon={ic.doc}>
                <p className="text-xs font-mono text-slate-400 break-all mb-3">{side.url}</p>
                {side.page && (
                  <div className="mb-3">
                    <Row label="Title" value={side.page.title || '—'} />
                    <Row label="H1 tags" value={String(side.page.headingCounts.H1)} />
                  </div>
                )}
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-6">{side.text.slice(0, 600)}{side.text.length > 600 ? '…' : ''}</p>
              </Card>
            ))}
          </div>
          <Note>Similarity is computed live in your browser from the pages' real text using 3-word shingle Jaccard overlap — the same family of measurement plagiarism tools use. Nothing is estimated or simulated.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 9. Cloaking Checker (two independent fetchers + pattern scan) ----------
const CloakingCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | {
    url: string; sim: number | null; channels: { name: string; words: number }[];
    patterns: { label: string; detail: string; risky: boolean }[];
  }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    // Two independent fetchers (different exit IPs and user agents) plus a
    // static scan of the raw HTML for cloaking techniques.
    const [raw, md] = await Promise.all([
      relayHtml(url, 15000),
      (async () => { try { const r = await withTimeout(fetch(`https://r.jina.ai/${url}`), 15000); return r.ok ? await r.text() : null; } catch { return null; } })(),
    ]);
    if (!raw && !md) { setErr(`${url} could not be fetched through any channel — the site may be down or blocking automated access.`); setBusy(false); return; }
    const textA = raw ? stripTags(raw) : '';
    const textB = md ? stripMd(md) : '';
    const sim = textA && textB ? Math.round(jaccard(shingles(textA), shingles(textB)) * 1000) / 10 : null;
    const patterns: { label: string; detail: string; risky: boolean }[] = [];
    if (raw) {
      if (/navigator\.userAgent[\s\S]{0,200}(document\.write|location\.(href|replace))/i.test(raw)) patterns.push({ label: 'User-agent conditional redirect', detail: 'Script reads navigator.userAgent and redirects or rewrites the page based on it — a classic cloaking technique.', risky: true });
      if (/googlebot|bingbot|slurp/i.test(raw) && /if\s*\(/i.test(raw)) patterns.push({ label: 'Bot names referenced in scripts', detail: 'The page source mentions crawler user agents inside conditional logic. Legitimate on some sites, worth reviewing.', risky: true });
      const hidden = (raw.match(/<(div|span|p)[^>]*(display:\s*none|visibility:\s*hidden|font-size:\s*0)[^>]*>/gi) || []).length;
      if (hidden > 0) patterns.push({ label: `${hidden} hidden text container(s)`, detail: 'Elements hidden with CSS can still be read by crawlers — keyword stuffing hides here.', risky: hidden >= 5 });
      if (/<meta[^>]+http-equiv=["']?refresh["']?[^>]+url=/i.test(raw)) patterns.push({ label: 'Meta refresh redirect', detail: 'The page redirects itself via a meta refresh tag.', risky: true });
      if (!patterns.length) patterns.push({ label: 'No cloaking patterns detected', detail: 'The served HTML contains no user-agent sniffing, hidden-text blocks or silent redirects.', risky: false });
    }
    setRes({ url, sim, channels: [{ name: 'CORS relay (browser-like)', words: (textA.match(/\S+/g) || []).length }, { name: 'Jina reader (bot-like)', words: (textB.match(/\S+/g) || []).length }], patterns });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com" cta="Check for Cloaking" busy={busy} onRun={v => void run(v)} samples={['https://example.com']} icon={<Icon className="w-5 h-5">{ic.shield}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Cloaking check · two independent fetchers</p>
                <p className="text-xl font-extrabold font-mono break-all mt-1">{res.url}</p>
              </div>
              {res.sim !== null
                ? <Pill tone={res.sim >= 60 ? 'ok' : res.sim >= 30 ? 'warn' : 'bad'}>{res.sim}% content match between fetchers</Pill>
                : <Pill tone="warn">only one channel answered</Pill>}
            </div>
          </Hero>
          <div className="grid sm:grid-cols-2 gap-3">
            {res.channels.map(c => <Tile key={c.name} icon={ic.globe} label={c.name} value={`${c.words.toLocaleString()} words received`} sub="independent fetch channel" />)}
          </div>
          {res.sim !== null && (
            <Card title="What the match means" icon={ic.gauge}>
              <p className="text-sm text-slate-600 leading-relaxed">
                {res.sim >= 60
                  ? 'Both fetchers received substantially the same content — no sign of visitor-dependent cloaking. (The two channels render differently, so 100% is not expected.)'
                  : res.sim >= 30
                  ? 'The two channels received noticeably different text. This can be legitimate (bot-blocking banners, JS-only rendering) but deserves a manual look.'
                  : 'The content served to the two fetchers differs dramatically — a strong cloaking signal. Review what each visitor type actually receives.'}
              </p>
            </Card>
          )}
          <Card title="Cloaking patterns in the served HTML" icon={ic.bug}>
            <div className="space-y-3">
              {res.patterns.map(p => (
                <div key={p.label} className="flex items-start gap-3">
                  <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${p.risky ? 'bg-amber-500' : 'bg-emerald-500'}`}>{p.risky ? '!' : '✓'}</span>
                  <div><p className="text-sm font-semibold text-slate-800">{p.label}</p><p className="text-xs text-slate-500">{p.detail}</p></div>
                </div>
              ))}
            </div>
          </Card>
          <Note>True cloaking detection needs Google's own crawler; no public tool has that. This checker does the next best real thing: it fetches your page through two independent services with different IPs and user agents, measures how much the content actually differs, and scans the real HTML for user-agent sniffing, hidden text and silent redirects.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 10. Google Malware Checker (real DNS blocklists + page scan) ----------
const MalwareCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | {
    domain: string;
    lists: { list: string; listed: boolean; code: string | null; failed?: boolean }[];
    page: { https: boolean; patterns: { label: string; detail: string }[] } | null;
  }>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    const LISTS = [
      { q: `${domain}.multi.surbl.org`, list: 'SURBL (spam/phishing/malware domains)' },
      { q: `${domain}.dbl.spamhaus.org`, list: 'Spamhaus DBL (domain reputation)' },
    ];
    const [listRows, page] = await Promise.all([
      Promise.all(LISTS.map(async ({ q, list }) => {
        try {
          const ans = await doh(q, 'A');
          return { list, listed: ans.length > 0, code: ans[0] ?? null };
        } catch { return { list, listed: false, code: null, failed: true }; }
      })),
      (async () => {
        const p = await fetchPageData(`https://${domain}`).catch(() => null);
        if (!p) return null;
        const patterns: { label: string; detail: string }[] = [];
        const html = p.html;
        const evals = (html.match(/eval\s*\(/gi) || []).length;
        if (evals > 3) patterns.push({ label: `${evals} eval() calls`, detail: 'Heavy eval() usage can hide obfuscated payloads — common in compromised sites.' });
        if (/coinhive|cryptoloot|coin-?imp|jsecoin/i.test(html)) patterns.push({ label: 'Known crypto-miner script', detail: 'The page references a recognised browser crypto-mining library.' });
        const zeroIframes = (html.match(/<iframe[^>]*(width=["']?0|height=["']?0|display:\s*none|visibility:\s*hidden)/gi) || []).length;
        if (zeroIframes > 0) patterns.push({ label: `${zeroIframes} hidden iframe(s)`, detail: 'Zero-size or invisible iframes are a classic malware/phishing injection vector.' });
        if (/document\.write\s*\(\s*unescape\s*\(/i.test(html)) patterns.push({ label: 'Unescape + document.write injection', detail: 'Obfuscated content written into the page at runtime — a frequent malware pattern.' });
        const susTld = (html.match(/https?:\/\/[^"'\s]+\.(tk|ml|ga|cf|gq|zip|mov)\b/gi) || []).length;
        if (susTld > 0) patterns.push({ label: `${susTld} link(s) to high-abuse TLDs`, detail: 'Links to domains on free/abuse-prone TLDs (.tk, .ml, .zip, …) are worth reviewing.' });
        return { https: p.finalUrl.startsWith('https://'), patterns };
      })(),
    ]);
    if (listRows.every(l => l.failed) && !page) { setErr(`Neither the DNS blocklists nor the page itself could be reached for ${domain}.`); setBusy(false); return; }
    setRes({ domain, lists: listRows, page });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Scan for Malware" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.shieldCheck}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const flagged = res.lists.filter(l => l.listed).length + (res.page ? res.page.patterns.length : 0);
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Security scan</p>
                  <p className="text-2xl font-extrabold font-mono break-all mt-1">{res.domain}</p>
                </div>
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${flagged ? 'bg-red-500/20 text-white' : 'bg-emerald-400/25 text-white'}`}>
                  <Icon className="w-4 h-4">{flagged ? ic.alert : ic.shieldCheck}</Icon>
                  {flagged ? `${flagged} finding(s)` : 'No threats found'}
                </span>
              </div>
            </Hero>
            <Card title="DNS blocklist lookups (live)" icon={ic.shield}>
              <div className="space-y-1">
                {res.lists.map(l => (
                  <Row key={l.list} label={l.list}
                    value={l.failed ? 'lookup failed' : l.listed ? `LISTED${l.code ? ` (${l.code})` : ''}` : 'clean'}
                    tone={l.failed ? 'muted' : l.listed ? 'bad' : 'good'} />
                ))}
              </div>
            </Card>
            {res.page && (
              <Card title="Live page scan" icon={ic.bug}>
                <div className="space-y-1">
                  <Row label="Served over HTTPS" value={res.page.https ? 'yes' : 'no'} tone={res.page.https ? 'good' : 'warn'} />
                  {res.page.patterns.length === 0 && <Row label="Suspicious code patterns" value="none found" tone="good" />}
                  {res.page.patterns.map(p => <Row key={p.label} label={p.label} value={p.detail} tone="warn" />)}
                </div>
              </Card>
            )}
            <Note>Google's Safe Browsing API requires a private API key, so no free tool shows Google's own verdict. This scan is real but different: live DNS blocklist lookups (SURBL, Spamhaus DBL) plus a pattern analysis of the page's actual HTML. A clean result here means no known blocklisting and no suspicious code — it is not a substitute for Google Search Console's Security Issues report.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 11. GZIP Compression Checker (real transfer sizes) ----------
const GzipCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { url: string; wire: number; decompressed: number; type: string; code: number | null; ms: number | null }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    const r = await aoGet(url, 18000);
    if (!r || r.code === null) { setErr(`${url} could not be fetched — the site may be down or blocking relays.`); setBusy(false); return; }
    const decompressed = r.body.length;
    const wire = r.length && r.length > 0 ? r.length : decompressed;
    setRes({ url, wire, decompressed, type: r.type, code: r.code, ms: r.ms });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com" cta="Check Compression" busy={busy} onRun={v => void run(v)} samples={['https://en.wikipedia.org', 'https://github.com']} icon={<Icon className="w-5 h-5">{ic.zap}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const saved = res.decompressed > 0 ? Math.max(0, Math.round((1 - res.wire / res.decompressed) * 1000) / 10) : 0;
        const compressed = saved >= 5;
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Compression {compressed ? 'detected' : 'not detected'}</p>
                  <p className="text-3xl font-extrabold mt-1">{compressed ? `${saved}% smaller on the wire` : 'No measurable savings'}</p>
                  <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.url}</p>
                </div>
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${compressed ? 'bg-emerald-400/25' : 'bg-amber-400/25'}`}>
                  <Icon className="w-4 h-4">{compressed ? ic.check : ic.alert}</Icon>{compressed ? 'GZIP / Brotli active' : 'Likely uncompressed'}
                </span>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-4 gap-3">
              <Tile icon={ic.server} label="HTTP status" value={res.code ?? '—'} />
              <Tile icon={ic.doc} label="Transfer size" value={kb(res.wire)} sub="bytes on the wire" />
              <Tile icon={ic.doc} label="Decompressed size" value={kb(res.decompressed)} sub="actual document size" />
              <Tile icon={ic.clock} label="Server response" value={res.ms !== null ? `${res.ms} ms` : '—'} sub={res.type || undefined} />
            </div>
            <Card title="What this means for speed" icon={ic.zap}>
              <p className="text-sm text-slate-600 leading-relaxed">
                {compressed
                  ? `Your server sent ${kb(res.wire)} instead of ${kb(res.decompressed)} — every visitor saves ${kb(Math.max(0, res.decompressed - res.wire))} per page view, and pages open measurably faster on mobile connections. Keep compression enabled for text, HTML, CSS, JS and SVG.`
                  : `The document arrived at full size (${kb(res.decompressed)}). Enabling GZIP or Brotli on your server typically shrinks HTML/CSS/JS by 60–80% with zero visual change — it is one of the fastest wins in web performance.`}
              </p>
            </Card>
            <Note>Method: the page is requested through a relay that reports the origin's own Content-Length (compressed transfer size) and returns the decompressed body. Comparing the two gives the real, current savings — nothing is simulated. Chunked responses without Content-Length cannot be measured this way and will show 0%.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 12. SSL Checker (real Certificate Transparency data) ----------
const SslCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | {
    domain: string;
    cert: { issuer: string; commonName: string; notBefore: string; notAfter: string; sans: number } | null;
    https: { ok: boolean; code: number | null; finalUrl: string };
  }>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    const [ct, probe] = await Promise.all([
      fetchJsonAny<{ issuer_name?: string; common_name?: string; not_before?: string; not_after?: string; name_value?: string }[]>(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`, 20000).catch(() => null),
      aoGet(`https://${domain}/`, 15000),
    ]);
    const certs = Array.isArray(ct) ? ct : [];
    // crt.sh returns newest first; pick the first cert that hasn't expired.
    const now = Date.now();
    const pick = certs.find(c => c.not_after && new Date(c.not_after).getTime() > now) || certs[0] || null;
    const cert = pick ? {
      issuer: pick.issuer_name || '—',
      commonName: pick.common_name || domain,
      notBefore: pick.not_before || '',
      notAfter: pick.not_after || '',
      sans: pick.name_value ? new Set(pick.name_value.split('\n').map(s => s.trim()).filter(Boolean)).size : 0,
    } : null;
    if (!cert && !probe) { setErr(`Neither the CT log search nor an HTTPS connection to ${domain} succeeded.`); setBusy(false); return; }
    setRes({ domain, cert, https: { ok: !!probe && probe.code !== null && probe.code < 400, code: probe?.code ?? null, finalUrl: probe?.finalUrl || '' } });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Check SSL" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.lock}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const daysLeft = res.cert?.notAfter ? Math.floor((new Date(res.cert.notAfter).getTime() - Date.now()) / 86400000) : null;
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">TLS certificate (Certificate Transparency)</p>
                  <p className="text-2xl font-extrabold font-mono break-all mt-1">{res.domain}</p>
                  <p className="text-white/80 text-sm mt-2">{res.cert ? `Issued by ${res.cert.issuer}` : 'No current certificate found in CT logs'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Pill tone={res.https.ok ? 'ok' : 'bad'}>{res.https.ok ? `HTTPS reachable${res.https.code ? ` · ${res.https.code}` : ''}` : 'HTTPS failed'}</Pill>
                  {daysLeft !== null && <Pill tone={daysLeft < 0 ? 'bad' : daysLeft < 21 ? 'warn' : 'ok'}>{daysLeft < 0 ? `Expired ${-daysLeft}d ago` : `${daysLeft} days left`}</Pill>}
                </div>
              </div>
            </Hero>
            {res.cert && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Tile icon={ic.shield} label="Common name" value={res.cert.commonName} />
                <Tile icon={ic.clock} label="Valid from" value={res.cert.notBefore ? new Date(res.cert.notBefore).toLocaleDateString('en-GB') : '—'} />
                <Tile icon={ic.alert} label="Valid until" value={res.cert.notAfter ? new Date(res.cert.notAfter).toLocaleDateString('en-GB') : '—'} sub={daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days remaining` : 'expired') : undefined} />
                <Tile icon={ic.list} label="Covered names (SANs)" value={res.cert.sans || '—'} sub="domains on this certificate" />
              </div>
            )}
            <Note>Certificate details come from crt.sh's live Certificate Transparency log search — the same public logs browsers use to validate certificates — and the HTTPS check is a real connection attempt. Browsers cannot read certificate fields from JavaScript directly, which is why every “SSL checker” you have used worked this way.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 13. Server Status Checker (real multi-probe) ----------
const ServerStatusTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { url: string; probes: { code: number | null; ms: number | null; type: string; length: number | null }[]; finalUrl: string }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    const probes: { code: number | null; ms: number | null; type: string; length: number | null }[] = [];
    let finalUrl = url;
    for (let i = 0; i < 3; i++) {
      const r = await aoGet(url, 15000);
      probes.push({ code: r?.code ?? null, ms: r?.ms ?? null, type: r?.type || '', length: r?.length ?? null });
      if (r?.finalUrl) finalUrl = r.finalUrl;
      if (i < 2) await new Promise(r2 => setTimeout(r2, 400));
    }
    if (probes.every(p => p.code === null)) { setErr(`${url} did not answer any of the three probes — the server appears to be down or blocking all relays.`); setBusy(false); return; }
    setRes({ url, probes, finalUrl });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com" cta="Check Server" busy={busy} onRun={v => void run(v)} samples={['https://example.com', 'https://wikipedia.org']} icon={<Icon className="w-5 h-5">{ic.server}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const okCount = res.probes.filter(p => p.code !== null && p.code < 400).length;
        const times = res.probes.map(p => p.ms).filter((m): m is number => m !== null);
        const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Server status · 3 live probes</p>
                  <p className="text-2xl font-extrabold font-mono break-all mt-1">{res.url}</p>
                  <p className="text-white/80 text-sm mt-1">Uptime in this test: {okCount}/3 probes succeeded{avg !== null ? ` · average response ${avg} ms` : ''}</p>
                </div>
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${okCount === 3 ? 'bg-emerald-400/25' : okCount ? 'bg-amber-400/25' : 'bg-red-500/25'}`}>
                  <span className={`w-2 h-2 rounded-full ${okCount === 3 ? 'bg-emerald-300' : okCount ? 'bg-amber-300' : 'bg-red-400'}`} />
                  {okCount === 3 ? 'Online' : okCount ? 'Unstable' : 'Down'}
                </span>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-3 gap-3">
              {res.probes.map((p, i) => (
                <Tile key={i} icon={ic.zap} label={`Probe ${i + 1}`}
                  value={p.code === null ? 'No response' : `HTTP ${p.code}`}
                  sub={p.ms !== null ? `${p.ms} ms${p.length ? ` · ${kb(p.length)}` : ''}` : 'request failed or timed out'} />
              ))}
            </div>
            <Card title="Response details" icon={ic.list}>
              <div>
                <Row label="Final URL" value={<span className="font-mono text-xs break-all">{res.finalUrl}</span>} />
                <Row label="Content type" value={res.probes.find(p => p.type)?.type || '—'} />
                <Row label="Average response time" value={avg !== null ? `${avg} ms` : '—'} tone={avg !== null && avg < 800 ? 'good' : avg !== null ? 'warn' : 'muted'} />
              </div>
            </Card>
            <Note>Each probe is a real HTTP request through an independent relay, spaced 400 ms apart; status codes and timings are the origin server's own. Three probes sample availability at one moment — for continuous monitoring use an uptime service.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 14. Code to Text Ratio Checker (real HTML numbers) ----------
const RatioTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { url: string; page: LivePageData }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    const page = await fetchPageData(url).catch(() => null);
    if (!page) { setErr(`${url} could not be fetched — the site may be down or block automated access.`); setBusy(false); return; }
    if (page.reader) { setErr(`${url} was only readable through the text reader, so its raw HTML (and therefore a code ratio) could not be measured. Try another URL.`); setBusy(false); return; }
    setRes({ url, page });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com/page" cta="Measure Ratio" busy={busy} onRun={v => void run(v)} samples={['https://en.wikipedia.org/wiki/Web_page']} icon={<Icon className="w-5 h-5">{ic.doc}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const p = res.page;
        const ratio = p.codeSize > 0 ? Math.round((p.textSize / p.codeSize) * 1000) / 10 : 0;
        const tone = ratio >= 25 ? 'good' : ratio >= 10 ? 'warn' : 'bad';
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center gap-6 flex-wrap">
                <Gauge score={Math.min(100, ratio * 2)} label={`${ratio}%`} />
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Code-to-text ratio</p>
                  <p className="text-2xl font-extrabold mt-1">{ratio}% visible text per byte of HTML</p>
                  <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.url}</p>
                  <p className="text-white/80 text-sm mt-2 max-w-lg">
                    {tone === 'good' ? 'A healthy ratio — this page is mostly content, not markup overhead.' : tone === 'warn' ? 'A workable ratio, but markup overhead is noticeable. Trim redundant wrappers and inline styles.' : 'Markup heavily outweighs content — search engines see mostly code. Remove template bloat or add substance.'}
                  </p>
                </div>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile icon={ic.doc} label="HTML code size" value={kb(p.codeSize)} sub="full document as served" />
              <Tile icon={ic.list} label="Visible text size" value={kb(p.textSize)} sub="rendered words only" />
              <Tile icon={ic.doc} label="Word count" value={p.wordCount.toLocaleString()} sub="readable words" />
              <Tile icon={ic.gauge} label="Ratio" value={`${ratio}%`} sub="text ÷ code" />
            </div>
            <Card title="What we measured" icon={ic.list}>
              <div>
                <Row label="Scripts on page" value={String(p.scripts)} />
                <Row label="Stylesheets" value={String(p.stylesheets)} />
                <Row label="Inline <style> blocks" value={String(p.inlineStyles)} />
                <Row label="Images" value={`${p.imageCount}${p.imagesMissingAlt ? ` (${p.imagesMissingAlt} missing alt)` : ''}`} />
                <Row label="Generated by" value={p.generator || 'not declared'} />
              </div>
            </Card>
            <Note>Both sizes come from the page's real, freshly fetched HTML: code size is the document as served; text size is the visible words after scripts, styles and tags are removed. There is no estimate involved.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 15. Alexa Rank Comparison (real Tranco + archives, two domains) ----------
const RankCompareTool: React.FC = () => {
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { rows: { label: string; a: string; b: string; better: 'a' | 'b' | 'tie' }[]; da: string; db: string }>(null);

  const gather = async (domain: string) => {
    const [rank, cc, wb] = await Promise.all([tranco(domain), commonCrawl(domain, true), wayback(domain)]);
    return { rank, cc, wb };
  };

  const runPair = async (va: string, vb: string) => {
    const da = cleanDomain(va), db = cleanDomain(vb);
    if (!da || !db) { setErr('Enter both domains to compare.'); return; }
    setBusy(true); setErr(''); setRes(null);
    const [a, bb] = await Promise.all([gather(da), gather(db)]);
    if (!a.rank && a.cc === null && !a.wb.first && !bb.rank && bb.cc === null && !bb.wb.first) {
      setErr('None of the open data sources answered for either domain — they may be rate-limiting. Try again shortly.');
      setBusy(false); return;
    }
    const cmp = (av: number | null, bv: number | null, lowerBetter: boolean): 'a' | 'b' | 'tie' =>
      av === null && bv === null ? 'tie' : av === null ? 'b' : bv === null ? 'a' : av === bv ? 'tie' : (lowerBetter ? av < bv : av > bv) ? 'a' : 'b';
    setRes({
      da, db,
      rows: [
        { label: 'Tranco top-1M rank', a: a.rank ? `#${a.rank.rank.toLocaleString()}` : 'outside top 1M', b: bb.rank ? `#${bb.rank.rank.toLocaleString()}` : 'outside top 1M', better: cmp(a.rank?.rank ?? null, bb.rank?.rank ?? null, true) },
        { label: 'Common Crawl captures', a: a.cc === null ? '—' : `${a.cc}${a.cc >= 200 ? '+' : ''}`, b: bb.cc === null ? '—' : `${bb.cc}${bb.cc >= 200 ? '+' : ''}`, better: cmp(a.cc, bb.cc, false) },
        { label: 'Months archived (Wayback)', a: a.wb.monthly === null ? '—' : String(a.wb.monthly), b: bb.wb.monthly === null ? '—' : String(bb.wb.monthly), better: cmp(a.wb.monthly, bb.wb.monthly, false) },
        { label: 'First archived', a: a.wb.first ? tsDate(a.wb.first).slice(0, 10) : 'never', b: bb.wb.first ? tsDate(bb.wb.first).slice(0, 10) : 'never', better: cmp(a.wb.first ? Number(a.wb.first.slice(0, 4)) : null, bb.wb.first ? Number(bb.wb.first.slice(0, 4)) : null, true) },
      ],
    });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="yoursite.com" cta="Compare Ranks" busy={busy} onRun={v => void runPair(v, b)} icon={<Icon className="w-5 h-5">{ic.chart}</Icon>}
        second={{ ph: 'competitor.com', value: b, onChange: setB }} />
      <div className="flex flex-wrap gap-2 -mt-3 mb-6">
        <span className="text-xs text-slate-400 font-semibold">Try:</span>
        <button type="button" disabled={busy} onClick={() => { setB('gitlab.com'); void runPair('github.com', 'gitlab.com'); }}
          className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-600 hover:border-indigo-300 disabled:opacity-50">github.com vs gitlab.com</button>
      </div>
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Head-to-head · real open data</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-2">
              <p className="text-xl font-extrabold font-mono break-all text-right">{res.da}</p>
              <span className="text-white/60 text-sm font-bold">vs</span>
              <p className="text-xl font-extrabold font-mono break-all">{res.db}</p>
            </div>
          </Hero>
          <Card title="Metric by metric" icon={ic.list}>
            <div className="overflow-x-auto -m-5 px-5">
              <table className="w-full text-left text-sm min-w-[560px]">
                <thead><tr className="text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Metric</th><th className="py-2 pr-3">{res.da}</th><th className="py-2 pr-3">{res.db}</th><th className="py-2">Ahead</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {res.rows.map(r => (
                    <tr key={r.label}>
                      <td className="py-2.5 pr-3 text-slate-500">{r.label}</td>
                      <td className={`py-2.5 pr-3 font-semibold ${r.better === 'a' ? 'text-emerald-600' : 'text-slate-700'}`}>{r.a}</td>
                      <td className={`py-2.5 pr-3 font-semibold ${r.better === 'b' ? 'text-emerald-600' : 'text-slate-700'}`}>{r.b}</td>
                      <td className="py-2.5">{r.better === 'tie' ? <Pill tone="muted">tie</Pill> : <Pill tone="ok">{r.better === 'a' ? res.da : res.db}</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Note>Alexa Rank died with Alexa.com in 2022 — sites still displaying it are making numbers up. This comparison uses Tranco's real traffic-based ranking plus Common Crawl and Wayback Machine records for both domains.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 16. Page Comparison (real side-by-side audit) ----------
const PageCompareTool: React.FC = () => {
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { a: LivePageData; b: LivePageData; ua: string; ub: string; sim: number }>(null);

  const run = async (v: string) => {
    if (!v.trim() || !b.trim()) { setErr('Enter both page URLs.'); return; }
    setBusy(true); setErr(''); setRes(null);
    const [pa, pb] = await Promise.all([fetchPageData(normUrl(v)).catch(() => null), fetchPageData(normUrl(b)).catch(() => null)]);
    if (!pa && !pb) { setErr('Neither page could be fetched — both may block automated access.'); setBusy(false); return; }
    if (!pa) { setErr(`Page A (${normUrl(v)}) could not be fetched.`); setBusy(false); return; }
    if (!pb) { setErr(`Page B (${normUrl(b)}) could not be fetched.`); setBusy(false); return; }
    setRes({ a: pa, b: pb, ua: normUrl(v), ub: normUrl(b), sim: Math.round(jaccard(shingles(pa.bodyText), shingles(pb.bodyText)) * 1000) / 10 });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://site.com/page-a" cta="Compare" busy={busy} onRun={v => void run(v)} icon={<Icon className="w-5 h-5">{ic.copy}</Icon>}
        second={{ ph: 'https://site.com/page-b', value: b, onChange: setB }} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const rows: { label: string; a: string | number | boolean; b: string | number | boolean; better?: 'high' | 'low' | 'none' }[] = [
          { label: 'Title length', a: res.a.title.length, b: res.b.title.length, better: 'none' },
          { label: 'Meta description length', a: res.a.description.length, b: res.b.description.length, better: 'none' },
          { label: 'H1 tags', a: res.a.headingCounts.H1, b: res.b.headingCounts.H1, better: 'none' },
          { label: 'Word count', a: res.a.wordCount, b: res.b.wordCount, better: 'high' },
          { label: 'Code size', a: kb(res.a.codeSize), b: kb(res.b.codeSize), better: 'low' },
          { label: 'Text ratio %', a: res.a.textRatio, b: res.b.textRatio, better: 'high' },
          { label: 'Internal links', a: res.a.internalLinks, b: res.b.internalLinks, better: 'high' },
          { label: 'External links', a: res.a.externalLinks, b: res.b.externalLinks, better: 'none' },
          { label: 'Scripts', a: res.a.scripts, b: res.b.scripts, better: 'low' },
          { label: 'Stylesheets', a: res.a.stylesheets, b: res.b.stylesheets, better: 'low' },
          { label: 'Images (missing alt)', a: `${res.a.imageCount} (${res.a.imagesMissingAlt})`, b: `${res.b.imageCount} (${res.b.imagesMissingAlt})`, better: 'none' },
          { label: 'Viewport meta', a: res.a.viewport ? 'yes' : 'no', b: res.b.viewport ? 'yes' : 'no', better: 'none' },
          { label: 'Canonical', a: res.a.canonical ? 'set' : 'missing', b: res.b.canonical ? 'set' : 'missing', better: 'none' },
          { label: 'Robots meta', a: res.a.robots || 'default', b: res.b.robots || 'default', better: 'none' },
          { label: 'Language', a: res.a.lang || '—', b: res.b.lang || '—', better: 'none' },
          { label: 'Fetch time', a: `${res.a.fetchMs} ms`, b: `${res.b.fetchMs} ms`, better: 'low' },
        ];
        const wins = (side: 'a' | 'b') => rows.filter(r => r.better !== 'none' && typeof r[side] === 'number' && typeof r[side === 'a' ? 'b' : 'a'] === 'number' &&
          (r.better === 'high' ? (r[side] as number) > (r[side === 'a' ? 'b' : 'a'] as number) : (r[side] as number) < (r[side === 'a' ? 'b' : 'a'] as number))).length;
        return (
          <div className="space-y-4">
            <Hero>
              <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Live page comparison</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-2">
                <p className="text-sm font-extrabold font-mono break-all text-right">{res.ua}</p>
                <span className="text-white/60 text-sm font-bold">vs</span>
                <p className="text-sm font-extrabold font-mono break-all">{res.ub}</p>
              </div>
              <p className="text-white/80 text-sm mt-3">Content similarity between the two pages: <span className="font-bold text-white">{res.sim}%</span> · numeric rows won: {wins('a')} vs {wins('b')}</p>
            </Hero>
            <Card title="Side by side (live HTML)" icon={ic.list}>
              <div className="overflow-x-auto -m-5 px-5">
                <table className="w-full text-left text-sm min-w-[620px]">
                  <thead><tr className="text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="py-2 pr-3">Metric</th><th className="py-2 pr-3">Page A</th><th className="py-2">Page B</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(r => {
                      const aWins = r.better !== 'none' && typeof r.a === 'number' && typeof r.b === 'number' && (r.better === 'high' ? r.a > r.b : r.a < r.b);
                      const bWins = r.better !== 'none' && typeof r.a === 'number' && typeof r.b === 'number' && (r.better === 'high' ? r.b > r.a : r.b < r.a);
                      return (
                        <tr key={r.label}>
                          <td className="py-2.5 pr-3 text-slate-500">{r.label}</td>
                          <td className={`py-2.5 pr-3 font-semibold ${aWins ? 'text-emerald-600' : 'text-slate-700'}`}>{String(r.a)}</td>
                          <td className={`py-2.5 font-semibold ${bWins ? 'text-emerald-600' : 'text-slate-700'}`}>{String(r.b)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            <Note>Both pages are fetched live and every figure is measured from their real HTML. Green marks the better value only where “better” is objective (more content, less code, fewer scripts, faster fetch).</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 17. Spider Simulator (real crawler-eye view) ----------
const SpiderSimTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { url: string; page: LivePageData }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    const page = await fetchPageData(url).catch(() => null);
    if (!page) { setErr(`${url} could not be fetched — the site may be down or block automated access.`); setBusy(false); return; }
    setRes({ url, page });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com" cta="Crawl Page" busy={busy} onRun={v => void run(v)} samples={['https://example.com']} icon={<Icon className="w-5 h-5">{ic.search}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const p = res.page;
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Crawler's view{p.reader ? ' (text reader — markup limited)' : ''}</p>
                  <p className="text-xl font-extrabold font-mono break-all mt-1">{p.finalUrl}</p>
                  <p className="text-white/80 text-sm mt-2">Fetched in {p.fetchMs} ms · {p.wordCount.toLocaleString()} words · {p.internalLinks + p.externalLinks} links discovered</p>
                </div>
                <LiveBadge>{p.reader ? 'Via text reader' : 'Live HTML'}</LiveBadge>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile icon={ic.doc} label="Title tag" value={p.title || '(none)'} sub={`${p.title.length} characters`} />
              <Tile icon={ic.list} label="Meta description" value={p.description ? `${p.description.length} chars` : '(none)'} sub={p.description ? p.description.slice(0, 80) + '…' : 'crawlers see no summary'} />
              <Tile icon={ic.shield} label="Robots meta" value={p.robots || 'index, follow (default)'} />
              <Tile icon={ic.globe} label="Canonical" value={p.canonical || '(none)'} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card title="Headings the crawler builds an outline from" icon={ic.list}>
                <div className="space-y-1">
                  {p.h1s.map((h, i) => <p key={i} className="text-sm font-bold text-slate-800">H1 · {h}</p>)}
                  {Object.entries(p.headingCounts).filter(([k, n]) => k !== 'H1' && n > 0).map(([k, n]) => (
                    <p key={k} className="text-xs text-slate-500">{k} × {n}</p>
                  ))}
                  {!p.h1s.length && !Object.keys(p.headingCounts).length && <p className="text-sm text-slate-400">No headings found — crawlers struggle to understand the page structure.</p>}
                </div>
              </Card>
              <Card title="Link graph" icon={ic.globe}>
                <div>
                  <Row label="Internal links" value={String(p.internalLinks)} tone="good" />
                  <Row label="External links" value={String(p.externalLinks)} />
                  <Row label="Nofollow links" value={String(p.nofollowLinks)} tone={p.nofollowLinks ? 'warn' : 'muted'} />
                  <Row label="Images / missing alt" value={`${p.imageCount} / ${p.imagesMissingAlt}`} tone={p.imagesMissingAlt ? 'warn' : 'good'} />
                  <Row label="Structured data (JSON-LD)" value={p.hasJsonLd ? 'present' : 'absent'} tone={p.hasJsonLd ? 'good' : 'muted'} />
                </div>
              </Card>
            </div>
            {p.linksSample.length > 0 && (
              <Card title="Discovered links (first crawl pass)" icon={ic.arrow}>
                <div className="max-h-72 overflow-auto divide-y divide-slate-100">
                  {p.linksSample.slice(0, 40).map((l, i) => (
                    <div key={i} className="py-2 flex items-start gap-3">
                      <Pill tone={l.internal ? 'ok' : 'muted'}>{l.internal ? 'internal' : 'external'}{l.nofollow ? ' · nofollow' : ''}</Pill>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{l.anchor || '(no anchor text)'}</p>
                        <p className="text-xs font-mono text-slate-400 break-all">{l.href}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <Card title="Visible text as the crawler reads it" icon={ic.doc}>
              <p className="text-xs text-slate-500 leading-relaxed max-h-52 overflow-auto">{p.bodyText.slice(0, 2000)}{p.bodyText.length > 2000 ? '…' : ''}</p>
            </Card>
            <Note>This is the page's real HTML, freshly fetched, rendered the way a search crawler parses it — tags, headings, links and visible text only. No rendering engine embellishment, no simulation.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 18. Comparison Search (real SERP positions for two domains) ----------
const ComparisonSearchTool: React.FC = () => {
  const [b, setB] = useState('');
  const [kw, setKw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { rows: { kw: string; a: number | null; b: number | null; engine: string }[]; da: string; db: string }>(null);

  const run = async (v: string) => {
    const da = cleanDomain(v), db = cleanDomain(b);
    const kws = kw.split(/[\n,]/).map(k => k.trim().toLowerCase()).filter(Boolean).slice(0, 5);
    if (!da || !db) { setErr('Enter both domains.'); return; }
    if (!kws.length) { setErr('Enter at least one target keyword (up to five, comma or newline separated).'); return; }
    setBusy(true); setErr(''); setRes(null);
    const rows: { kw: string; a: number | null; b: number | null; engine: string }[] = [];
    for (const k of kws) {
      const items = await ddgSearch(k);
      if (!items.length) { rows.push({ kw: k, a: null, b: null, engine: 'unreachable' }); continue; }
      const pos = (d: string) => { const i = items.findIndex(it => it.host === d || it.host.endsWith(`.${d}`)); return i === -1 ? null : i + 1; };
      rows.push({ kw: k, a: pos(da), b: pos(db), engine: 'DuckDuckGo' });
    }
    if (rows.every(r => r.engine === 'unreachable')) { setErr('The search engine could not be reached through any relay right now — try again in a minute.'); setBusy(false); return; }
    setRes({ rows, da, db });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="yoursite.com" cta="Compare Rankings" busy={busy} onRun={v => void run(v)} icon={<Icon className="w-5 h-5">{ic.search}</Icon>}
        second={{ ph: 'competitor.com', value: b, onChange: setB }}
        extra={
          <div className="mt-2 px-1">
            <input value={kw} onChange={e => setKw(e.target.value)} placeholder="Target keywords — e.g. seo audit, keyword research (up to 5)"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15" />
          </div>
        } />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Live SERP positions</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-2">
              <p className="text-lg font-extrabold font-mono break-all text-right">{res.da}</p>
              <span className="text-white/60 text-sm font-bold">vs</span>
              <p className="text-lg font-extrabold font-mono break-all">{res.db}</p>
            </div>
          </Hero>
          <Card title="Where each site actually appears" icon={ic.list}>
            <div className="overflow-x-auto -m-5 px-5">
              <table className="w-full text-left text-sm min-w-[560px]">
                <thead><tr className="text-xs uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Keyword</th><th className="py-2 pr-3">{res.da}</th><th className="py-2 pr-3">{res.db}</th><th className="py-2">Source</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {res.rows.map(r => (
                    <tr key={r.kw}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-700">{r.kw}</td>
                      <td className={`py-2.5 pr-3 font-bold ${r.a && (!r.b || r.a < r.b) ? 'text-emerald-600' : 'text-slate-600'}`}>{r.a ? `#${r.a}` : 'not in top results'}</td>
                      <td className={`py-2.5 pr-3 font-bold ${r.b && (!r.a || r.b < r.a) ? 'text-emerald-600' : 'text-slate-600'}`}>{r.b ? `#${r.b}` : 'not in top results'}</td>
                      <td className="py-2.5 text-slate-400 text-xs">{r.engine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Note>Positions come from a real live search through DuckDuckGo's top results at this moment — not a model or an estimate. Google blocks anonymous datacentre queries, so DuckDuckGo is the honest public proxy; positions can differ from your personalised Google results.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 19. Pokemon GO Server Status (real endpoint probes) ----------
const PokemonProbeTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<{ service: string; url: string; code: number | null; ms: number | null }[] | null>(null);

  const ENDPOINTS: { service: string; url: string }[] = [
    { service: 'Login / authentication', url: 'https://sso.pokemon.com/en/' },
    { service: 'Game version API', url: 'https://pgorelease.nianticlabs.com/plfe/version' },
    { service: 'Google sign-in', url: 'https://accounts.google.com/' },
    { service: 'Niantic account services', url: 'https://nianticlabs.com/' },
  ];

  const check = async () => {
    setBusy(true);
    const out = await Promise.all(ENDPOINTS.map(async e => {
      const r = await aoGet(e.url, 12000);
      return { ...e, code: r?.code ?? null, ms: r?.ms ?? null };
    }));
    setRows(out);
    setBusy(false);
  };

  const up = (code: number | null) => code !== null && code < 400;

  return (
    <div>
      <button type="button" onClick={() => void check()} disabled={busy}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 mb-5">
        {busy ? <><Spin /> Probing…</> : <>{rows ? 'Re-check Servers' : 'Check Server Status'} <Icon>{ic.arrow}</Icon></>}
      </button>
      {busy && <Skeleton />}
      {rows && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {rows.map(r => (
              <div key={r.service} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">{r.service}</p>
                  <p className="text-xs font-mono text-slate-400 break-all">{r.url}</p>
                  <p className="text-xs text-slate-500 mt-1">{r.code === null ? 'no response' : `HTTP ${r.code}${r.ms !== null ? ` · ${r.ms} ms` : ''}`}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${up(r.code) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : r.code === null ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                  <span className={`w-2 h-2 rounded-full ${up(r.code) ? 'bg-emerald-500' : r.code === null ? 'bg-amber-500' : 'bg-red-500'}`} />
                  {up(r.code) ? 'Reachable' : r.code === null ? 'No answer' : 'Error'}
                </span>
              </div>
            ))}
          </div>
          <Note>Niantic does not publish a machine-readable status API, so any tool showing “Raid Battles: Operational” is inventing it. This checker does something true instead: it fires real HTTP probes at the actual Pokémon GO / Niantic login and game endpoints and reports their live status codes and response times. “No answer” can also mean the relay was blocked, not that the service is down.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 20. Blog Finder (real DuckDuckGo results) ----------
const BlogFinderTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { kw: string; items: { url: string; host: string; title: string }[] }>(null);

  const run = async (v: string) => {
    const kw = v.trim().toLowerCase();
    if (!kw) return;
    setBusy(true); setErr(''); setRes(null);
    const [a, b] = await Promise.all([ddgSearch(`${kw} blog`), ddgSearch(`best ${kw} blogs`)]);
    const seen = new Set<string>();
    const items = [...a, ...b].filter(i => {
      const host = i.host.replace(/^www\./, '');
      if (seen.has(host)) return false;
      seen.add(host);
      return !/(duckduckgo|google|bing|facebook|youtube|reddit|wikipedia)\./.test(host);
    }).slice(0, 12);
    if (!items.length) { setErr(`No blog results could be retrieved for “${kw}” — DuckDuckGo may be rate-limiting the relays. Try again shortly.`); setBusy(false); return; }
    setRes({ kw, items });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="e.g. digital marketing" cta="Find Blogs" busy={busy} onRun={v => void run(v)} samples={['digital marketing', 'healthy recipes', 'personal finance']} icon={<Icon className="w-5 h-5">{ic.search}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Real blogs about “{res.kw}”</p>
            <p className="text-2xl font-extrabold mt-1">{res.items.length} sites found</p>
            <p className="text-white/80 text-sm mt-1">Live search results — visit each one to check guest-post guidelines before outreach.</p>
          </Hero>
          <Card title="Results (live search)" icon={ic.list}>
            <ul className="divide-y divide-slate-100">
              {res.items.map(i => (
                <li key={i.url} className="py-3 flex items-start gap-3">
                  <span className="mt-0.5 w-6 h-6 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0"><Icon className="w-3.5 h-3.5">{ic.globe}</Icon></span>
                  <div className="min-w-0">
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-indigo-600 hover:underline break-all">{i.title || i.host}</a>
                    <p className="text-xs text-slate-400 font-mono break-all mt-0.5">{i.host}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Note>These are real, current search results pulled live through DuckDuckGo — no directory database, no simulated list. Rankings shift constantly, so re-run the search when you start a new outreach round.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 21. Apps Rank Tracking (real iTunes Search API) ----------
type ItunesApp = { trackName?: string; artistName?: string; primaryGenreName?: string; averageUserRating?: number; userRatingCount?: number; trackViewUrl?: string; artworkUrl100?: string; bundleId?: string; formattedPrice?: string };
const AppsRankTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | { term: string; apps: ItunesApp[] }>(null);

  const run = async (v: string) => {
    const term = v.trim();
    if (!term) return;
    setBusy(true); setErr(''); setRes(null);
    const isBundle = /^[a-z0-9_.-]+\.[a-z0-9_.-]+$/i.test(term) && !/\s/.test(term) && term.split('.').length >= 2 && !term.endsWith('.com');
    const url = isBundle
      ? `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(term)}`
      : `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=15`;
    const j = await fetchJsonAny<{ resultCount?: number; results?: ItunesApp[] }>(url, 15000).catch(() => null);
    const apps = j?.results || [];
    if (!apps.length) { setErr(`The App Store returned no results for “${term}”. Check the name or bundle ID, or try a broader term.`); setBusy(false); return; }
    setRes({ term, apps });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="App name or bundle ID" cta="Track App" busy={busy} onRun={v => void run(v)} samples={['whatsapp', 'duolingo']} icon={<Icon className="w-5 h-5">{ic.phone}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Apple App Store · live search position</p>
            <p className="text-2xl font-extrabold mt-1">“{res.term}” → {res.apps.length} app(s)</p>
            <p className="text-white/80 text-sm mt-1">Position #1 is the top result the App Store itself returns for this term right now.</p>
          </Hero>
          <Card title="Live results" icon={ic.list}>
            <div className="divide-y divide-slate-100">
              {res.apps.map((a, i) => (
                <div key={`${a.bundleId || a.trackName}-${i}`} className="py-3 flex items-center gap-4">
                  <span className="w-8 text-center text-lg font-extrabold text-slate-300">#{i + 1}</span>
                  {a.artworkUrl100 && <img src={a.artworkUrl100} alt="" className="w-12 h-12 rounded-xl border border-slate-100" loading="lazy" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 break-words">{a.trackName}</p>
                    <p className="text-xs text-slate-500">{a.artistName}{a.primaryGenreName ? ` · ${a.primaryGenreName}` : ''}{a.formattedPrice ? ` · ${a.formattedPrice}` : ''}</p>
                    {a.bundleId && <p className="text-[11px] font-mono text-slate-400 break-all">{a.bundleId}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {typeof a.averageUserRating === 'number' && a.userRatingCount ? (
                      <>
                        <p className="text-sm font-bold text-amber-500">★ {a.averageUserRating.toFixed(2)}</p>
                        <p className="text-xs text-slate-400">{a.userRatingCount.toLocaleString()} ratings</p>
                      </>
                    ) : <p className="text-xs text-slate-400">no ratings yet</p>}
                    {a.trackViewUrl && <a href={a.trackViewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline font-semibold">View ↗</a>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Note>Data is live from Apple's public iTunes Search API at this moment: real positions, ratings and prices. Apple does not expose official category charts through a keyless API, so search position is the accurate public measure of visibility for a term.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 22. Social Stats Checker (real Reddit + HN counts) ----------
const SocialStatsTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<null | {
    url: string;
    reddit: { posts: number; upvotes: number; comments: number } | null;
    hn: { stories: number; points: number; comments: number } | null;
  }>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    const [reddit, hn] = await Promise.all([
      (async () => {
        const t = await relayHtml(`https://www.reddit.com/api/info.json?url=${encodeURIComponent(url)}&limit=100&raw_json=1`, 15000);
        if (!t) return null;
        try {
          const j = JSON.parse(t) as { data?: { children?: { data?: { score?: number; num_comments?: number } }[] } };
          const kids = j.data?.children || [];
          if (!kids.length) return { posts: 0, upvotes: 0, comments: 0 };
          return { posts: kids.length, upvotes: kids.reduce((s, k) => s + (k.data?.score || 0), 0), comments: kids.reduce((s, k) => s + (k.data?.num_comments || 0), 0) };
        } catch { return null; }
      })(),
      (async () => {
        const j = await fetchJsonAny<{ nbHits?: number; hits?: { points?: number; num_comments?: number }[] }>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(url)}&tags=story&hitsPerPage=50`, 15000).catch(() => null);
        const hits = (j?.hits || []).filter(h => (h.points ?? 0) > 0 || (h.num_comments ?? 0) > 0);
        if (!hits.length) return { stories: 0, points: 0, comments: 0 };
        return { stories: hits.length, points: hits.reduce((s, h) => s + (h.points || 0), 0), comments: hits.reduce((s, h) => s + (h.num_comments || 0), 0) };
      })(),
    ]);
    if (!reddit && !hn) { setErr('Neither Reddit nor Hacker News could be reached through the relays right now — try again shortly.'); setBusy(false); return; }
    setRes({ url, reddit, hn });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com/article" cta="Check Social Stats" busy={busy} onRun={v => void run(v)} samples={['https://openai.com/index/hello-gpt-4o/']} icon={<Icon className="w-5 h-5">{ic.chart}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Real public engagement</p>
            <p className="text-lg font-extrabold font-mono break-all mt-1">{res.url}</p>
          </Hero>
          <div className="grid sm:grid-cols-3 gap-3">
            <Tile icon={ic.chart} label="Reddit posts" value={res.reddit ? String(res.reddit.posts) : 'unreachable'} sub={res.reddit && res.reddit.posts ? `${res.reddit.upvotes.toLocaleString()} upvotes · ${res.reddit.comments.toLocaleString()} comments` : 'no public submissions found'} />
            <Tile icon={ic.chart} label="Hacker News stories" value={res.hn ? String(res.hn.stories) : 'unreachable'} sub={res.hn && res.hn.stories ? `${res.hn.points.toLocaleString()} points · ${res.hn.comments.toLocaleString()} comments` : 'never featured'} />
            <Tile icon={ic.zap} label="Total measured engagement" value={((res.reddit?.upvotes || 0) + (res.hn?.points || 0)).toLocaleString()} sub="upvotes + points across both networks" />
          </div>
          <Note>Reddit and Hacker News counts are real, fetched live from their public APIs. Facebook, LinkedIn and Pinterest shut down their public share-count endpoints years ago — any tool still showing those numbers is fabricating them, so this checker reports only what can actually be measured.</Note>
        </div>
      )}
    </div>
  );
};

export {
  ArchiveCheckerTool, WhoisCheckerTool, MozRankTool, PageAuthorityTool, IndexCheckerTool,
  TrafficRankTool, RedirectCheckerTool, SimilarPageTool, CloakingCheckerTool, MalwareCheckerTool,
  GzipCheckerTool, SslCheckerTool, ServerStatusTool, RatioTool, RankCompareTool,
  PageCompareTool, SpiderSimTool, ComparisonSearchTool, PokemonProbeTool, BlogFinderTool,
  AppsRankTool, SocialStatsTool,
};
