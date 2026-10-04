import React, { useState } from 'react';
import { fetchPageData } from '../utils/pageFetch';
import { parseSerp, parseMdSerp } from './KeywordTools';

/* Live Backlink engines. Every number comes from a real, keyless, public
   source queried straight from the browser — nothing is simulated:
   • Google web search             — real external pages that mention the site
   • Common Crawl index (CDX)      — real crawled-page counts per crawl
   • Wayback Machine CDX           — real capture history
   • Tranco research list          — real popularity rank
   • AllOrigins relay              — real HTTP status/final URL of any link
   • fetchPageData                 — real on-page link extraction
   Full backlink indexes (Ahrefs/Moz/Majestic) are proprietary and have no
   keyless API — where that matters the tool says so instead of inventing
   totals. */

// ---------- shared helpers ----------
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const RAW_RELAYS: ((u: string) => string)[] = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  u => `https://cors.eu.org/${u}`,
];

/** First non-null result wins; null when every attempt fails or the cap
    expires. Racing the relays concurrently means a live relay answers in
    ~1–2s instead of stacking a timeout behind every dead one. */
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

const relayHtml = async (url: string, ms = 8000): Promise<string | null> =>
  raceFirst(RAW_RELAYS.map(rel => async () => {
    const r = await withTimeout(fetch(rel(url)), 7000);
    if (!r.ok) return null;
    const t = await r.text();
    return t || null;
  }), ms);

const fetchTextAny = async (url: string, ms = 8000): Promise<string | null> =>
  raceFirst<string>([
    async () => { const r = await withTimeout(fetch(url), 6000); return r.ok ? await r.text() : null; },
    ...RAW_RELAYS.map(rel => async () => {
      const r = await withTimeout(fetch(rel(url)), 7000);
      return r.ok ? (await r.text()) || null : null;
    }),
  ], ms);

const fetchJsonAny = async <T,>(url: string, ms = 8000): Promise<T | null> =>
  raceFirst<T>([
    async () => { const r = await withTimeout(fetch(url), 6000); return r.ok ? (await r.json()) as T : null; },
    async () => {
      const via = await withTimeout(fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`), 7000);
      if (!via.ok) return null;
      const j = (await via.json()) as { contents?: string };
      return j.contents ? (JSON.parse(j.contents) as T) : null;
    },
    ...RAW_RELAYS.slice(0, 3).map(rel => async () => {
      const r = await withTimeout(fetch(rel(url)), 7000);
      if (!r.ok) return null;
      return JSON.parse(await r.text()) as T;
    }),
  ], ms);

type AoResult = { finalUrl: string; code: number | null; ms: number | null; type: string; length: number | null };
/** One real HTTP probe, raced across three relays so no single relay outage
    can blank the result: AllOrigins gives status+timing+final URL, the other
    two pass the origin status code straight through. */
const aoProbe = async (url: string, ms = 9000): Promise<AoResult | null> =>
  raceFirst<AoResult>([
    async () => {
      const r = await withTimeout(fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`), 8000);
      if (!r.ok) return null;
      const j = (await r.json()) as { status?: { url?: string; http_code?: number; response_time?: number; content_type?: string; content_length?: number } };
      const st = j.status || {};
      if (typeof st.http_code !== 'number') return null;
      return {
        finalUrl: st.url || url,
        code: st.http_code,
        ms: typeof st.response_time === 'number' ? Math.round(st.response_time * 1000) : null,
        type: st.content_type || '',
        length: typeof st.content_length === 'number' ? st.content_length : null,
      };
    },
    async () => {
      const r = await withTimeout(fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`), 8000);
      return { finalUrl: url, code: r.status, ms: null, type: r.headers.get('content-type') || '', length: null };
    },
    async () => {
      const r = await withTimeout(fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`), 8000);
      return { finalUrl: url, code: r.status, ms: null, type: r.headers.get('content-type') || '', length: null };
    },
  ], ms);

/** 10-minute sessionStorage cache — repeat checks render instantly and the
    public sources stay unstrained. */
const sGet = (k: string): string | null => { try { return sessionStorage.getItem(`bltool:${k}`); } catch { return null; } };
const sSet = (k: string, v: string) => { try { sessionStorage.setItem(`bltool:${k}`, v); } catch { /* private mode */ } };
const cached = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
  const hit = sGet(key);
  if (hit) { try { return JSON.parse(hit) as T; } catch { /* refetch */ } }
  const v = await fn();
  sSet(key, JSON.stringify(v));
  return v;
};

const cleanDomain = (v: string) =>
  v.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/[^a-z0-9.-]+/g, '');
const normUrl = (v: string) => {
  const t = v.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};
const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const regDomain = (host: string) => {
  const p = host.split('.');
  if (p.length >= 3 && /^(co|com|org|net|ac|gov|edu)\.[a-z]{2}$/i.test(p.slice(-2).join('.'))) return p.slice(-3).join('.');
  return p.slice(-2).join('.');
};

// ---------- real open-data sources ----------
type TrancoRes = { ranks?: { date?: string; rank?: number }[] };
const tranco = (domain: string): Promise<{ rank: number; date: string } | null> =>
  cached(`tranco:${domain}`, async () => {
    const j = await fetchJsonAny<TrancoRes>(`https://tranco-list.eu/api/ranks/domain/${encodeURIComponent(domain)}`).catch(() => null);
    const first = j?.ranks?.[0];
    return first && typeof first.rank === 'number' ? { rank: first.rank, date: first.date || '' } : null;
  });

type Wayback = { first: string | null; monthly: number | null; latest: string | null; latestUrl: string | null };
const wayback = (target: string): Promise<Wayback> => cached(`wayback:${target}`, async () => {
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
});

/** Pages of the domain present in the newest Common Crawl index (real rows, capped). */
const commonCrawl = (domain: string): Promise<{ count: number | null; sample: string[] }> => cached(`cc:${domain}`, async () => {
  const info = await fetchJsonAny<{ id?: string }[] | null>('https://index.commoncrawl.org/collinfo.json').catch(() => null);
  const id = Array.isArray(info) && info[0]?.id ? String(info[0].id) : null;
  if (!id) return { count: null, sample: [] };
  const q = `url=${encodeURIComponent(`*.${domain}`)}&matchType=domain&output=json&limit=100&fl=urlkey`;
  const txt = await fetchTextAny(`https://index.commoncrawl.org/${id}-index?${q}`);
  if (txt == null) return { count: null, sample: [] };
  const rows = txt.split('\n').filter(l => l.trim().startsWith('{'));
  const sample = rows.slice(0, 8).map(l => { try { return String((JSON.parse(l) as { urlkey?: string }).urlkey || ''); } catch { return ''; } }).filter(Boolean);
  return { count: rows.length, sample };
});

/** Real Google web search — three independent paths raced at once (full HTML
    relays, the reader's rendered copy, basic-HTML relays). Used to find
    external pages that reference a domain. */
const googleSearch = (q: string): Promise<{ url: string; host: string; title: string }[]> =>
  cached(`gsearch:${q}`, async () => {
    const gUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=10&hl=en`;
    const items = await raceFirst<{ url: string; host: string; title: string }[]>([
      async () => {
        const g = await withTimeout(fetchPageData(gUrl), 9000);
        if (!g) return null;
        const parsed = parseSerp(g.html).items;
        return parsed.length ? parsed : null;
      },
      async () => {
        const r = await withTimeout(fetch(`https://r.jina.ai/${gUrl}`), 9000);
        if (!r.ok) return null;
        const parsed = parseMdSerp(await r.text(), /google\.[a-z]+\/|webcache\.|accounts\.google|\.google\.|consent\./i);
        return parsed.length ? parsed : null;
      },
      async () => {
        const h = await relayHtml(`${gUrl}&gbv=1`);
        if (!h) return null;
        const parsed = parseSerp(h).items;
        return parsed.length ? parsed : null;
      },
    ], 10000);
    return items || [];
  });

const tsDate = (ts: string) =>
  `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}${ts.length >= 12 ? ` ${ts.slice(8, 10)}:${ts.slice(10, 12)} UTC` : ''}`;

// ---------- UI kit (same family as the checker tools) ----------
const Icon: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);
const ic = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.8-1.7" /></>,
  chain: <><path d="M9 12h6" /><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
  gauge: <><path d="M4 14a8 8 0 0 1 16 0" /><path d="M12 14l4-4" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  external: <><path d="M14 4h6v6" /><path d="M20 4L10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  cross: <path d="M18 6L6 18M6 6l12 12" />,
  doc: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  coins: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  swap: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  bug: <><rect x="8" y="6" width="8" height="14" rx="4" /><path d="M12 6V3M8 10H4M20 10h-4M8 16H4M20 16h-4M9 20l-2 2M15 20l2 2" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  rocket: <><path d="M5 15c-1 2-1 4-1 4s2 0 4-1" /><path d="M14.5 4.5C17 2 21 3 21 3s1 4-1.5 6.5L13 16l-5-5z" /><path d="M9 11l-3.5 1L4 15.5 8.5 14" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />,
  plus: <path d="M12 5v14M5 12h14" />,
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

const SearchBar: React.FC<{ ph: string; cta: string; busy: boolean; onRun: (v: string) => void; samples?: string[]; icon?: React.ReactNode; second?: { ph: string; value: string; onChange: (v: string) => void } }> = ({ ph, cta, busy, onRun, samples, icon, second }) => {
  const [v, setV] = useState('');
  return (
    <div className="mb-6">
      <div className={`grid gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all ${second ? 'md:grid-cols-[1fr_1fr_auto]' : 'sm:grid-cols-[1fr_auto]'}`}>
        <div className="flex items-center gap-3 px-3 min-w-0">
          <span className="text-indigo-500 shrink-0">{icon ?? <Icon className="w-5 h-5">{ic.link}</Icon>}</span>
          <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !busy && v.trim()) onRun(v); }}
            placeholder={ph} aria-label={ph}
            className="w-full py-3 bg-transparent outline-none text-sm font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans" />
        </div>
        {second && (
          <div className="flex items-center gap-3 px-3 min-w-0 border-t md:border-t-0 md:border-l border-slate-100">
            <span className="text-purple-500 shrink-0"><Icon className="w-5 h-5">{ic.swap}</Icon></span>
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
  <div className="space-y-3 animate-pulse" aria-hidden="true">
    <div className="h-32 rounded-2xl bg-slate-100" />
    <div className="grid sm:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-100" />)}</div>
    <div className="h-48 rounded-2xl bg-slate-100" />
  </div>
);

const Hero: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white p-6 md:p-8 shadow-lg shadow-indigo-500/15">{children}</div>
);

const Tile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; copy?: string }> = ({ icon, label, value, sub, copy }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
    <div className="flex items-center gap-2 text-slate-400 mb-2"><Icon className="w-4 h-4">{icon}</Icon><span className="text-xs font-bold uppercase tracking-wider">{label}</span></div>
    <div className="flex items-center gap-2">
      <p className="text-2xl font-extrabold text-slate-800 truncate">{value}</p>
      {copy && <Copy text={copy} />}
    </div>
    {sub && <p className="text-xs text-slate-400 mt-1 truncate">{sub}</p>}
  </div>
);

const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="heading-card font-bold text-slate-900 flex items-center gap-2">
        {icon && <Icon className="w-4.5 h-4.5 text-indigo-500">{icon}</Icon>}{title}
      </h3>
      {right}
    </div>
    {children}
  </div>
);

const Pill: React.FC<{ tone: 'ok' | 'bad' | 'warn' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => {
  const tones = { ok: 'bg-emerald-50 text-emerald-700 border-emerald-100', bad: 'bg-red-50 text-red-700 border-red-100', warn: 'bg-amber-50 text-amber-700 border-amber-100', muted: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
};

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-xs text-slate-600 leading-relaxed">{children}</div>
);

const ErrBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
    <Icon className="w-4 h-4 mt-0.5 shrink-0">{ic.alert}</Icon><span>{msg}</span>
  </div>
);

const Row: React.FC<{ label: string; value: React.ReactNode; tone?: 'good' | 'warn' | 'bad' | 'muted' }> = ({ label, value, tone = 'muted' }) => {
  const tones = { good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', muted: 'text-slate-700' };
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-right break-all ${tones[tone]}`}>{value}</span>
    </div>
  );
};

const Gauge: React.FC<{ score: number; label?: string }> = ({ score, label = 'Score' }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color = clamped >= 70 ? '#059669' : clamped >= 40 ? '#d97706' : '#dc2626';
  const r = 42, c = Math.PI * r, off = c - (clamped / 100) * c * 0.75;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" strokeDasharray={`${c * 0.75} ${c}`} strokeLinecap="round" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${c * 0.75} ${c}`} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-slate-800">{clamped}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
    </div>
  );
};

const LiveBadge: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-1">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{children || 'Live data'}
  </span>
);

const SAMPLES = ['github.com', 'wikipedia.org', 'mozilla.org'];

// ---------- 1. Backlink Checker ----------
type Mention = { host: string; domain: string; url: string; title: string };
type BcRes = { domain: string; mentions: Mention[]; hosts: { host: string; count: number }[]; tranco: { rank: number; date: string } | null; cc: { count: number | null; sample: string[] }; wb: Wayback; searched: string[]; srcStatus: { google: string; tranco: string; cc: string; wb: string } };

export const BacklinkCheckerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<BcRes | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain || !domain.includes('.')) { setErr('Enter a domain like example.com.'); return; }
    setBusy(true); setErr('');
    // Progressive: the results shell renders immediately and each source
    // paints the moment it answers — no more waiting on the slowest one.
    const st: BcRes = {
      domain, mentions: [], hosts: [], tranco: null,
      cc: { count: null, sample: [] },
      wb: { first: null, monthly: null, latest: null, latestUrl: null },
      searched: [],
      srcStatus: { google: 'searching live Google…', tranco: 'checking…', cc: 'checking…', wb: 'checking…' },
    };
    setRes({ ...st });
    // Two real Google searches that exclude the site itself — every hit is an
    // external page referencing the domain, i.e. a verifiable backlink lead.
    const queries = [`"${domain}" -site:${domain}`, `${domain} -site:${domain}`];
    st.searched = queries;
    const seen = new Set<string>();
    const addMentions = (items: { url: string; host: string; title: string }[]) => {
      for (const it of items) {
        const host = hostOf(it.url);
        if (!host || host === domain || host.endsWith(`.${domain}`)) continue; // skip own site
        const key = it.url.split('#')[0];
        if (seen.has(key)) continue;
        seen.add(key);
        st.mentions.push({ host, domain: regDomain(host), url: key, title: it.title });
      }
      const hostMap = new Map<string, number>();
      st.mentions.forEach(m => hostMap.set(m.domain, (hostMap.get(m.domain) || 0) + 1));
      st.hosts = Array.from(hostMap.entries()).map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count);
      st.srcStatus = { ...st.srcStatus, google: `${st.mentions.length} backlink lead${st.mentions.length === 1 ? '' : 's'} so far` };
      setRes({ ...st, mentions: [...st.mentions], hosts: [...st.hosts] });
    };
    await Promise.allSettled([
      googleSearch(queries[0]).then(addMentions).catch(() => undefined),
      googleSearch(queries[1]).then(addMentions).catch(() => undefined),
      tranco(domain).then(t => { st.tranco = t; st.srcStatus = { ...st.srcStatus, tranco: t ? `rank #${t.rank.toLocaleString()}` : 'not in top 1M' }; setRes({ ...st }); }),
      commonCrawl(domain).then(c => { st.cc = c; st.srcStatus = { ...st.srcStatus, cc: c.count === null ? 'index unreachable' : `${c.count} crawled pages` }; setRes({ ...st }); }),
      wayback(domain).then(w => { st.wb = w; st.srcStatus = { ...st.srcStatus, wb: w.first ? `archived since ${w.first.slice(0, 4)}` : 'no archive record' }; setRes({ ...st }); }),
    ]);
    if (st.srcStatus.google.startsWith('searching')) st.srcStatus = { ...st.srcStatus, google: st.mentions.length ? st.srcStatus.google : 'no leads in the Google sample' };
    if (!st.mentions.length && !st.tranco && st.cc.count === null && st.wb.first === null) {
      setRes(null);
      setErr('No data could be retrieved for this domain. Google and the open-data services may be temporarily unreachable — try again.');
      setBusy(false); return;
    }
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Check Backlinks" busy={busy} onRun={v => void run(v)} samples={SAMPLES} icon={<Icon className="w-5 h-5">{ic.link}</Icon>} />
      {busy && !res && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const authority = res.tranco ? Math.max(5, Math.min(98, Math.round(100 - Math.log10(res.tranco.rank) * 14))) : null;
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-5">
                  {authority !== null && <div className="bg-white rounded-2xl p-2"><Gauge score={authority} label="Visibility" /></div>}
                  <div>
                    <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Backlink profile</p>
                    <p className="text-3xl font-extrabold font-mono break-all mt-1">{res.domain}</p>
                    <p className="text-white/80 text-sm mt-2 max-w-lg">
                      {res.mentions.length > 0
                        ? <>{res.mentions.length} real page{res.mentions.length === 1 ? '' : 's'} on {res.hosts.length} external site{res.hosts.length === 1 ? '' : 's'} found referencing this domain in live web search.</>
                        : busy ? 'Searching live Google results for pages that reference this domain…' : 'No external pages referencing this domain were found in live Google search yet.'}
                    </p>
                  </div>
                </div>
                <LiveBadge>Google · Common Crawl · Wayback · Tranco</LiveBadge>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile icon={ic.chart} label="Tranco rank" value={res.tranco ? `#${res.tranco.rank.toLocaleString()}` : '—'} sub={res.tranco ? `research list ${res.tranco.date}` : 'not in top 1M'} />
              <Tile icon={ic.server} label="Crawled pages" value={res.cc.count === null ? '—' : `${res.cc.count}${res.cc.count >= 100 ? '+' : ''}`} sub="newest Common Crawl index" />
              <Tile icon={ic.archive} label="Archived since" value={res.wb.first ? res.wb.first.slice(0, 4) : '—'} sub={res.wb.monthly !== null ? `${res.wb.monthly} months with captures` : undefined} />
              <Tile icon={ic.link} label="Referring sites" value={res.hosts.length} sub="from live search results" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="muted">Google: {res.srcStatus.google}</Pill>
              <Pill tone="muted">Tranco: {res.srcStatus.tranco}</Pill>
              <Pill tone="muted">Common Crawl: {res.srcStatus.cc}</Pill>
              <Pill tone="muted">Wayback: {res.srcStatus.wb}</Pill>
            </div>
            {busy && !res.mentions.length && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
                <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-sm text-slate-600">Fetching live Google results for backlink leads…</span>
              </div>
            )}
            {res.mentions.length > 0 && (
              <Card title={`Backlinks found in live Google search — ${res.domain}`} icon={ic.external} right={<Pill tone="ok">{res.mentions.length} page{res.mentions.length === 1 ? '' : 's'}</Pill>}>
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0"><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="text-left px-3 py-2.5">Referring site</th><th className="text-left px-3 py-2.5">Page</th>
                    </tr></thead>
                    <tbody>
                      {res.mentions.slice(0, 60).map(m => (
                        <tr key={m.url} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2 whitespace-nowrap"><span className="font-mono text-indigo-700">{m.domain}</span></td>
                          <td className="px-3 py-2 min-w-0">
                            <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 hover:text-indigo-600 break-all">{m.title || m.url}</a>
                            <p className="text-xs text-slate-400 font-mono break-all">{m.url}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {res.cc.sample.length > 0 && (
              <Card title="Sample of crawled URLs (Common Crawl)" icon={ic.server}>
                <div className="space-y-1">
                  {res.cc.sample.map(u => <p key={u} className="text-xs font-mono text-slate-600 break-all">{u}</p>)}
                </div>
              </Card>
            )}
            <Note>
              <strong>How this works — and its honest limits.</strong> Complete backlink indexes (Ahrefs, Moz, Majestic) are proprietary
              products with no free API, so any &ldquo;free&rdquo; tool claiming to show your full link list is either paying for data or making it up.
              This checker shows only what is genuinely verifiable for free: real external pages that mention or link to the domain in live
              Google results (queried with the domain excluded from its own results), real crawl presence in Common Crawl, real archive history, and the real Tranco popularity rank.
              Mentions found in search usually include actual links, but a search index is a sample — not every backlink appears in it.
            </Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- 2. Backlink Maker (honest submission kit) ----------
type Dir = { name: string; url: (u: string) => string; kind: string; why: string };
const DIRECTORIES: Dir[] = [
  { name: 'Google Business Profile', url: () => 'https://business.google.com/create', kind: 'Local / brand', why: 'Powers the Google Maps knowledge panel and local pack.' },
  { name: 'Bing Places', url: () => 'https://www.bingplaces.com/', kind: 'Local / brand', why: 'Bing\'s equivalent listing; feeds ChatGPT web results too.' },
  { name: 'Yelp for Business', url: () => 'https://biz.yelp.com/', kind: 'Review', why: 'High-authority review profile that ranks well for brand queries.' },
  { name: 'Trustpilot', url: () => 'https://business.trustpilot.com/', kind: 'Review', why: 'Review platform with strong domain authority and rich snippets.' },
  { name: 'LinkedIn Company Page', url: () => 'https://www.linkedin.com/company/setup/new/', kind: 'Social profile', why: 'Authoritative brand page; links are followed by most crawlers.' },
  { name: 'Crunchbase', url: () => 'https://www.crunchbase.com/add-new', kind: 'Business directory', why: 'Startup/company profile cited by journalists and investors.' },
  { name: 'Foursquare', url: () => 'https://business.foursquare.com/', kind: 'Local data', why: 'Syndicates your NAP data to hundreds of apps and directories.' },
  { name: 'Hotfrog', url: () => 'https://www.hotfrog.com/', kind: 'Business directory', why: 'Long-running business directory with category pages.' },
  { name: 'Brownbook', url: () => 'https://www.brownbook.net/', kind: 'Business directory', why: 'Free business listing with photos and description.' },
  { name: 'Cylex', url: () => 'https://www.cylex.com/', kind: 'Business directory', why: 'International business directory with country editions.' },
  { name: 'Product Hunt', url: () => 'https://www.producthunt.com/posts/new', kind: 'Launch platform', why: 'Launch page + profile backlink; strong referral traffic spikes.' },
  { name: 'AlternativeTo', url: () => 'https://alternativeto.net/add/', kind: 'Software directory', why: 'List your product against competitors; editorially curated.' },
  { name: 'G2', url: () => 'https://www.g2.com/products/new', kind: 'Software reviews', why: 'The standard B2B software review profile.' },
  { name: 'Capterra', url: () => 'https://www.capterra.com/vendors/sign_up', kind: 'Software reviews', why: 'Large software directory with review rich snippets.' },
  { name: 'About.me', url: () => 'https://about.me/', kind: 'Personal profile', why: 'Quick personal/founder card with a followed link.' },
  { name: 'Gravatar', url: () => 'https://gravatar.com/profiles/edit', kind: 'Personal profile', why: 'Profile link attached to every comment you post on WordPress sites.' },
  { name: 'Medium', url: () => 'https://medium.com/new-story', kind: 'Publishing', why: 'Publish an article linking home; profile link is followed.' },
  { name: 'Dev.to', url: () => 'https://dev.to/new', kind: 'Publishing', why: 'Technical articles for developer products; profile link included.' },
  { name: 'GitHub', url: () => 'https://github.com/new', kind: 'Code hosting', why: 'Repository README with homepage field = high-trust link.' },
  { name: 'Diigo', url: () => 'https://www.diigo.com/sign-up', kind: 'Bookmarking', why: 'Social bookmark with description; quick contextual link.' },
];

export const BacklinkMakerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [site, setSite] = useState<null | { url: string; title: string; description: string }>(null);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('bm-done') || '[]') as string[]; } catch { return []; }
  });
  const toggle = (name: string) => {
    setDone(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      try { localStorage.setItem('bm-done', JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  };

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setSite(null);
    const data = await fetchPageData(url).catch(() => null);
    if (!data) {
      setErr('Could not fetch your site to prefill the listing details. You can still use the kit — enter the title and description manually when each directory asks.');
    }
    setSite({ url: data?.finalUrl || url, title: data?.title || '', description: data?.description || '' });
    setBusy(false);
  };

  const listing = site ? {
    title: site.title || hostOf(site.url),
    short: (site.description || `${hostOf(site.url)} — official website`).slice(0, 160),
  } : null;

  return (
    <div>
      <SearchBar ph="https://example.com" cta="Build My Kit" busy={busy} onRun={v => void run(v)} samples={['https://github.com']} icon={<Icon className="w-5 h-5">{ic.rocket}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {site && listing && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Backlink submission kit</p>
                <p className="text-2xl font-extrabold font-mono break-all mt-1">{site.url}</p>
                <p className="text-white/80 text-sm mt-2 max-w-xl">{DIRECTORIES.length} real, high-value directories with direct submission pages, your real site details ready to paste, and a checklist that remembers your progress.</p>
              </div>
              <span className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 text-sm font-bold">
                <Icon className="w-4 h-4">{ic.check}</Icon> {done.length}/{DIRECTORIES.length} done
              </span>
            </div>
          </Hero>
          <Card title="Your listing details (from your live site)" icon={ic.doc} right={<LiveBadge>fetched now</LiveBadge>}>
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Site title</p>
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold text-slate-800 flex-1 break-all">{listing.title || 'Not found on your page — enter it manually'}</p>
                  {listing.title && <Copy text={listing.title} />}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Short description ({listing.short.length}/160)</p>
                <div className="flex items-start gap-2">
                  <p className="text-sm text-slate-700 flex-1 break-all">{listing.short}</p>
                  <Copy text={listing.short} />
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Website URL</p>
                <div className="flex items-start gap-2">
                  <p className="text-sm font-mono text-slate-800 flex-1 break-all">{site.url}</p>
                  <Copy text={site.url} />
                </div>
              </div>
            </div>
          </Card>
          <Card title="Where to submit" icon={ic.list} right={<Pill tone="muted">progress saved in this browser</Pill>}>
            <div className="grid md:grid-cols-2 gap-3">
              {DIRECTORIES.map(d => {
                const isDone = done.includes(d.name);
                return (
                  <div key={d.name} className={`rounded-xl border p-4 transition-colors ${isDone ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm">{d.name}</p>
                        <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wide">{d.kind}</p>
                      </div>
                      <button type="button" onClick={() => toggle(d.name)} aria-label={isDone ? 'Mark not done' : 'Mark done'}
                        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-emerald-400'}`}>
                        <Icon className="w-3.5 h-3.5">{ic.check}</Icon>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">{d.why}</p>
                    <a href={d.url(site.url)} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                      <Icon className="w-3.5 h-3.5">{ic.external}</Icon> Open submission page
                    </a>
                  </div>
                );
              })}
            </div>
          </Card>
          <Note>
            <strong>Why this doesn&rsquo;t &ldquo;auto-submit&rdquo;.</strong> No tool running in a browser can legitimately fill and post forms on
            third-party directories — they require accounts, human verification and their own consent. Any site claiming instant
            one-click submission to hundreds of directories is either spamming low-quality forms (which harms your SEO) or faking it.
            This kit does the honest version: real submission pages for directories that still matter, your real site details ready to
            paste, and a checklist so nothing is forgotten. Note: DMOZ and the Yahoo Directory shut down in 2017 — directories from
            that era no longer exist, which is why they are not on this list.
          </Note>
        </div>
      )}
    </div>
  );
};

// ---------- 3. Website Links Count Checker ----------
type LcRes = { url: string; internal: number; external: number; nofollow: number; intNofollow: number; extNofollow: number; hosts: { host: string; count: number }[]; total: number };

export const LinksCountTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<LcRes | null>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    const data = await fetchPageData(url).catch(() => null);
    if (!data) { setErr('The page could not be fetched — it may be down, block relays, or require JavaScript. Try the homepage URL or another page.'); setBusy(false); return; }
    const hostMap = new Map<string, number>();
    data.linksSample.filter(l => !l.internal).forEach(l => { const h = regDomain(hostOf(l.href)); if (h) hostMap.set(h, (hostMap.get(h) || 0) + 1); });
    setRes({
      url: data.finalUrl, internal: data.internalLinks, external: data.externalLinks, nofollow: data.nofollowLinks,
      intNofollow: data.internalNofollowLinks, extNofollow: data.externalNofollowLinks,
      hosts: Array.from(hostMap.entries()).map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count).slice(0, 15),
      total: data.internalLinks + data.externalLinks,
    });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://example.com/page" cta="Count Links" busy={busy} onRun={v => void run(v)} samples={['https://en.wikipedia.org/wiki/Search_engine_optimization']} icon={<Icon className="w-5 h-5">{ic.list}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Links found on page</p>
                <p className="text-4xl font-extrabold mt-1">{res.total}</p>
                <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.url}</p>
              </div>
              <LiveBadge>live page HTML</LiveBadge>
            </div>
          </Hero>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile icon={ic.link} label="Internal links" value={res.internal} sub="same domain" />
            <Tile icon={ic.external} label="External links" value={res.external} sub="other domains" />
            <Tile icon={ic.shield} label="Nofollow links" value={res.nofollow} sub={`${res.intNofollow} internal · ${res.extNofollow} external`} />
            <Tile icon={ic.chart} label="Dofollow ratio" value={`${res.total ? Math.round(((res.total - res.nofollow) / res.total) * 100) : 0}%`} sub="links passing equity signals" />
          </div>
          {res.hosts.length > 0 && (
            <Card title="Most-linked external sites" icon={ic.external}>
              <div className="space-y-2">
                {res.hosts.map(h => (
                  <div key={h.host} className="flex items-center gap-3">
                    <span className="font-mono text-sm text-slate-700 w-56 truncate">{h.host}</span>
                    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.max(4, (h.count / res.hosts[0].count) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-600 w-8 text-right">{h.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Note>Every number comes from the page&rsquo;s actual HTML fetched live: unique <code className="font-mono">a[href]</code> links, deduplicated, with rel=&ldquo;nofollow&rdquo; detected per link. Need the full link-by-link table? Use the Website Link Analyzer.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 4. Link Tracker ----------
type LtLink = { href: string; anchor: string; host: string; nofollow: boolean };
type LtRes = { url: string; code: number | null; finalUrl: string; ms: number | null; type: string; redirected: boolean; indexed: boolean; indexChecked: boolean; links: LtLink[]; target: string; targetLinks: LtLink[] };

export const LinkTrackerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<LtRes | null>(null);
  const [target, setTarget] = useState('');

  const run = async (v: string) => {
    const url = normUrl(v);
    const dom = cleanDomain(target);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null);
    const [probe, html, ddg] = await Promise.all([
      aoProbe(url),
      relayHtml(url),
      googleSearch(url).catch(() => []),
    ]);
    if (!probe && !html) { setErr('The page could not be reached at all — the URL may be wrong or the site is down.'); setBusy(false); return; }
    const finalUrl = probe?.finalUrl || url;
    const links: LtLink[] = [];
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (/^(javascript:|mailto:|tel:|#)/i.test(href)) return;
        try {
          const u = new URL(href, finalUrl);
          if (!/^https?:$/.test(u.protocol)) return;
          const nofollow = (a.getAttribute('rel') || '').toLowerCase().includes('nofollow');
          const anchor = (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) || u.hostname;
          links.push({ href: u.href, anchor, host: u.hostname.replace(/^www\./, ''), nofollow });
        } catch { /* skip malformed */ }
      });
    }
    const norm = (h: string) => h.replace(/^www\./, '');
    const targetLinks = dom ? links.filter(l => norm(l.host) === dom || l.host.endsWith(`.${dom}`)) : [];
    const indexed = ddg.some(it => { const h = norm(hostOf(it.url)); const fh = norm(hostOf(finalUrl)); return it.url.split('#')[0] === finalUrl.split('#')[0] || (h && fh && (h === fh || h.endsWith(`.${fh}`) || fh.endsWith(`.${h}`))); });
    setRes({ url, code: probe?.code ?? null, finalUrl, ms: probe?.ms ?? null, type: probe?.type || '', redirected: normUrl(finalUrl) !== normUrl(url), indexed, indexChecked: ddg.length > 0, links, target: dom, targetLinks });
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="https://partner-site.com/page-with-your-link" cta="Track Link" busy={busy} onRun={v => void run(v)}
        samples={['https://developer.mozilla.org/en-US/docs/Web/HTML']} icon={<Icon className="w-5 h-5">{ic.search}</Icon>}
        second={{ ph: 'yourdomain.com (optional — find links to it)', value: target, onChange: setTarget }} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Page status</p>
                <p className="text-3xl font-extrabold mt-1">{res.code !== null ? `${res.code} ${res.code === 200 ? 'OK' : res.code >= 400 ? 'Broken' : 'Redirected'}` : 'Status unknown'}</p>
                <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.url}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <LiveBadge>live probe</LiveBadge>
                {res.target && <Pill tone={res.targetLinks.length ? 'ok' : 'bad'}>{res.targetLinks.length ? `${res.targetLinks.length} link(s) to ${res.target} found` : `No link to ${res.target} found`}</Pill>}
              </div>
            </div>
          </Hero>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile icon={ic.server} label="HTTP status" value={res.code ?? '—'} sub={res.type || undefined} />
            <Tile icon={ic.arrow} label="Redirects" value={res.redirected ? 'Yes' : 'None'} sub={res.redirected ? res.finalUrl : 'serves directly'} />
            <Tile icon={ic.clock} label="Response time" value={res.ms !== null ? `${res.ms} ms` : '—'} sub="server-side measurement" />
            <Tile icon={ic.search} label="In search results" value={res.indexChecked ? (res.indexed ? 'Yes' : 'Not seen') : '—'} sub={res.indexChecked ? 'Google sample' : 'search unavailable'} />
          </div>
          {res.target && (
            <Card title={res.targetLinks.length ? `Links pointing to ${res.target}` : `No links to ${res.target} on this page`} icon={ic.link}
              right={<Pill tone={res.targetLinks.length ? 'ok' : 'bad'}>{res.targetLinks.length} found</Pill>}>
              {res.targetLinks.length ? (
                <div className="space-y-2">
                  {res.targetLinks.map((l, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">&ldquo;{l.anchor}&rdquo;</span>
                        <Pill tone={l.nofollow ? 'warn' : 'ok'}>{l.nofollow ? 'nofollow' : 'dofollow'}</Pill>
                      </div>
                      <p className="text-xs font-mono text-slate-500 break-all mt-1">{l.href}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">The page loaded fine but contains no hyperlink to your domain{res.links.length ? ` (${res.links.length} outbound links checked)` : ''}. If a link was promised here, it has been removed or never added — worth following up with the site owner.</p>
              )}
            </Card>
          )}
          {res.links.length > 0 && (
            <Card title={`All outbound links on the page (${res.links.length})`} icon={ic.list}>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0"><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="text-left px-3 py-2.5">Anchor</th><th className="text-left px-3 py-2.5">Destination</th><th className="text-left px-3 py-2.5">Rel</th>
                  </tr></thead>
                  <tbody>
                    {res.links.slice(0, 120).map((l, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700 max-w-[220px] truncate">{l.anchor}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500 break-all">{l.href}</td>
                        <td className="px-3 py-2"><Pill tone={l.nofollow ? 'warn' : 'ok'}>{l.nofollow ? 'nofollow' : 'dofollow'}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <Note>The HTTP probe reports the real status code, final URL after redirects and server-side response time. The link scan parses the page&rsquo;s actual HTML. The search check asks Google for this exact URL — a &ldquo;not seen&rdquo; result means it was not in that sample, not a guarantee of de-indexing.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 5. Link Price Calculator ----------
type LpRes = {
  domain: string; tranco: { rank: number; date: string } | null; cc: number | null; wbFirst: string | null; wbMonths: number | null;
  words: number | null; linksOut: number | null;
  visibility: number; freshness: number; maturity: number; content: number; total: number; low: number; high: number;
};

const visFromRank = (rank: number | null) => {
  if (rank === null) return 40;                       // unranked: below top-1M
  if (rank <= 1000) return 97;
  if (rank <= 10000) return 88;
  if (rank <= 100000) return 76;
  if (rank <= 500000) return 62;
  return 50;
};

export const LinkPriceTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<LpRes | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain || !domain.includes('.')) { setErr('Enter a domain like example.com.'); return; }
    setBusy(true); setErr(''); setRes(null);
    // Progressive: a neutral baseline renders on click and every live source
    // refines the score the moment it answers.
    const raw = { tk: null as { rank: number; date: string } | null, cc: null as number | null, wbFirst: null as string | null, wbMonths: null as number | null, words: null as number | null, linksOut: null as number | null };
    const compute = () => {
      const visibility = visFromRank(raw.tk?.rank ?? null);
      const freshness = raw.cc === null ? 45 : Math.max(25, Math.min(95, 45 + Math.round(Math.log10(raw.cc + 1) * 22)));
      let maturity = 40;
      if (raw.wbFirst) {
        const years = (Date.now() - new Date(`${raw.wbFirst.slice(0, 4)}-${raw.wbFirst.slice(4, 6)}-${raw.wbFirst.slice(6, 8)}`).getTime()) / (365.25 * 86400000);
        maturity = Math.max(25, Math.min(95, Math.round(30 + years * 6)));
      }
      const content = raw.words === null ? 45 : Math.max(20, Math.min(95, Math.round(30 + Math.log10(Math.max(10, raw.words)) * 25)));
      const total = Math.round(visibility * 0.4 + freshness * 0.2 + maturity * 0.2 + content * 0.2);
      // Disclosed price model: $4 base scaled by the weighted score, ±35% band.
      const base = Math.round(4 * Math.pow(total / 30, 2.6));
      setRes({
        domain, tranco: raw.tk, cc: raw.cc, wbFirst: raw.wbFirst, wbMonths: raw.wbMonths, words: raw.words, linksOut: raw.linksOut,
        visibility, freshness, maturity, content, total,
        low: Math.max(2, Math.round(base * 0.65)), high: Math.round(base * 1.35),
      });
    };
    compute();
    await Promise.allSettled([
      tranco(domain).then(t => { raw.tk = t; compute(); }),
      commonCrawl(domain).then(c => { raw.cc = c.count; compute(); }),
      wayback(domain).then(w => { raw.wbFirst = w.first; raw.wbMonths = w.monthly; compute(); }),
      fetchPageData(`https://${domain}`).then(pg => { raw.words = pg?.wordCount ?? null; raw.linksOut = pg ? pg.internalLinks + pg.externalLinks : null; compute(); }).catch(() => undefined),
    ]);
    setBusy(false);
  };

  const scoreRow = (label: string, val: number, weight: string, detail: string) => (
    <div key={label} className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-sm font-semibold text-slate-700">{label} <span className="text-xs font-normal text-slate-400">· {weight}</span></span>
        <span className="text-sm font-bold text-indigo-600">{val}/100</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${val}%` }} /></div>
      <p className="text-xs text-slate-400 mt-1">{detail}</p>
    </div>
  );

  return (
    <div>
      <SearchBar ph="publisher-domain.com" cta="Estimate Value" busy={busy} onRun={v => void run(v)} samples={['theguardian.com', 'medium.com', 'dev.to']} icon={<Icon className="w-5 h-5">{ic.coins}</Icon>} />
      {busy && !res && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-5">
                <div className="bg-white rounded-2xl p-2"><Gauge score={res.total} label="Value" /></div>
                <div>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Estimated sponsored-link value</p>
                  <p className="text-3xl font-extrabold mt-1">${res.low.toLocaleString()} – ${res.high.toLocaleString()}<span className="text-base font-semibold text-white/70"> / month</span></p>
                  <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.domain}</p>
                </div>
              </div>
              <LiveBadge>real signals · disclosed formula</LiveBadge>
            </div>
          </Hero>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile icon={ic.chart} label="Tranco rank" value={res.tranco ? `#${res.tranco.rank.toLocaleString()}` : 'Unranked'} sub="real popularity list" />
            <Tile icon={ic.server} label="Crawled pages" value={res.cc === null ? '—' : `${res.cc}${res.cc >= 100 ? '+' : ''}`} sub="newest Common Crawl" />
            <Tile icon={ic.archive} label="Archived since" value={res.wbFirst ? res.wbFirst.slice(0, 4) : '—'} sub={res.wbMonths !== null ? `${res.wbMonths} months with captures` : 'no Wayback history'} />
            <Tile icon={ic.doc} label="Homepage words" value={res.words === null ? '—' : res.words.toLocaleString()} sub={res.linksOut !== null ? `${res.linksOut} on-page links` : 'page not fetchable'} />
          </div>
          <Card title="How the estimate is built (every input is real)" icon={ic.gauge}>
            {scoreRow('Site visibility', res.visibility, '40% weight', res.tranco ? `Tranco rank #${res.tranco.rank.toLocaleString()} (${res.tranco.date})` : 'Domain not in the Tranco top-1M — scored as unranked')}
            {scoreRow('Crawl freshness', res.freshness, '20% weight', res.cc === null ? 'Common Crawl unavailable — neutral score' : `${res.cc}${res.cc >= 100 ? '+' : ''} pages in the newest Common Crawl index`)}
            {scoreRow('Domain maturity', res.maturity, '20% weight', res.wbFirst ? `First archived ${tsDate(res.wbFirst)}` : 'No archive history — neutral score')}
            {scoreRow('Content substance', res.content, '20% weight', res.words !== null ? `${res.words.toLocaleString()} words on the live homepage` : 'Homepage could not be fetched — neutral score')}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 font-mono leading-relaxed">
              monthly ≈ $4 × (score ÷ 30)^2.6, band ±35% &nbsp;→&nbsp; ${res.low.toLocaleString()}–${res.high.toLocaleString()}
            </div>
          </Card>
          <Note>
            <strong>Read this as a negotiating starting point, not a market price.</strong> Real sponsored-link prices are private and vary
            wildly with niche, traffic quality and seasonality — nobody can &ldquo;look up&rdquo; a true price for free. What this tool refuses to do
            is invent traffic or authority numbers: every input above is a real, current measurement (Tranco rank, Common Crawl presence,
            Wayback history, live homepage content), and the formula is printed in full. Use it to sanity-check offers, not to invoice.
          </Note>
        </div>
      )}
    </div>
  );
};

// ---------- 6. Reciprocal Link Checker ----------
type RecFound = { href: string; anchor: string; nofollow: boolean };
type RecRes = {
  yours: string; partner: string; partnerUrl: string; partnerCode: number | null;
  themToYou: RecFound[]; youToThem: RecFound[]; yourUrl: string; yourCode: number | null;
};

const scanLinks = (html: string, base: string, toDomain: string): RecFound[] => {
  const out: RecFound[] = [];
  const dom = toDomain.replace(/^www\./, '');
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/^(javascript:|mailto:|tel:|#)/i.test(href)) return;
      try {
        const u = new URL(href, base);
        if (!/^https?:$/.test(u.protocol)) return;
        const h = u.hostname.replace(/^www\./, '');
        if (h !== dom && !h.endsWith(`.${dom}`)) return;
        out.push({
          href: u.href,
          anchor: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) || u.hostname,
          nofollow: (a.getAttribute('rel') || '').toLowerCase().includes('nofollow'),
        });
      } catch { /* skip */ }
    });
  } catch { /* unparsable */ }
  return out;
};

export const ReciprocalLinkTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<RecRes | null>(null);
  const [partner, setPartner] = useState('');

  const run = async (v: string) => {
    const yours = cleanDomain(v);
    const partnerUrl = normUrl(partner);
    if (!yours || !yours.includes('.')) { setErr('Enter your domain in the first field.'); return; }
    if (!partnerUrl) { setErr('Enter the partner page (or site) in the second field.'); return; }
    const partnerDom = cleanDomain(partner);
    setBusy(true); setErr(''); setRes(null);
    const [pProbe, pHtml, yProbe, yHtml] = await Promise.all([
      aoProbe(partnerUrl),
      relayHtml(partnerUrl),
      aoProbe(`https://${yours}`),
      relayHtml(`https://${yours}`),
    ]);
    if (!pHtml && pProbe?.code === null) { setErr(`The partner page could not be fetched (${partnerUrl}). It may be down or block relays — nothing can be verified.`); setBusy(false); return; }
    const themToYou = pHtml ? scanLinks(pHtml, pProbe?.finalUrl || partnerUrl, yours) : [];
    const youToThem = yHtml && partnerDom ? scanLinks(yHtml, yProbe?.finalUrl || `https://${yours}`, partnerDom) : [];
    setRes({
      yours, partner: partnerDom || partnerUrl, partnerUrl: pProbe?.finalUrl || partnerUrl, partnerCode: pProbe?.code ?? null,
      themToYou, youToThem, yourUrl: yProbe?.finalUrl || `https://${yours}`, yourCode: yProbe?.code ?? null,
    });
    setBusy(false);
  };

  const verdict = res ? (res.themToYou.length && res.youToThem.length ? 'both' : res.themToYou.length ? 'theirs' : res.youToThem.length ? 'yours' : 'none') : null;
  const verdictMeta = {
    both: { tone: 'ok' as const, icon: ic.check, text: 'Fully reciprocal — both sites link to each other.' },
    theirs: { tone: 'ok' as const, icon: ic.check, text: 'They link to you, but you do not link back yet.' },
    yours: { tone: 'warn' as const, icon: ic.alert, text: 'You link to them, but they do not link back. The partnership link is missing.' },
    none: { tone: 'bad' as const, icon: ic.cross, text: 'No link found in either direction.' },
  };

  return (
    <div>
      <SearchBar ph="yoursite.com" cta="Check Reciprocity" busy={busy} onRun={v => void run(v)} icon={<Icon className="w-5 h-5">{ic.swap}</Icon>}
        second={{ ph: 'https://partnersite.com/page', value: partner, onChange: setPartner }} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && verdict && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Reciprocal link check</p>
                <p className="text-xl font-extrabold font-mono break-all mt-1">{res.yours} <span className="text-white/60 mx-2">⇄</span> {res.partner}</p>
                <p className="text-white/85 text-sm mt-2">{verdictMeta[verdict].text}</p>
              </div>
              <Pill tone={verdictMeta[verdict].tone}><Icon className="w-3.5 h-3.5">{verdictMeta[verdict].icon}</Icon>{res.themToYou.length} their(s) · {res.youToThem.length} your(s)</Pill>
            </div>
          </Hero>
          <div className="grid md:grid-cols-2 gap-4">
            <Card title={`Their page → ${res.yours}`} icon={ic.external} right={<Pill tone={res.themToYou.length ? 'ok' : 'bad'}>{res.themToYou.length ? 'linking' : 'not linking'}</Pill>}>
              <Row label="Page checked" value={<span className="font-mono text-xs">{res.partnerUrl}</span>} />
              <Row label="HTTP status" value={res.partnerCode ?? '—'} tone={res.partnerCode === 200 ? 'good' : res.partnerCode && res.partnerCode >= 400 ? 'bad' : 'muted'} />
              {res.themToYou.length ? res.themToYou.map((l, i) => (
                <Row key={i} label={`Link ${i + 1} · anchor “${l.anchor}”`} value={<Pill tone={l.nofollow ? 'warn' : 'ok'}>{l.nofollow ? 'nofollow' : 'dofollow'}</Pill>} />
              )) : <Row label="Result" value="No link to your domain found in their HTML" tone="bad" />}
            </Card>
            <Card title={`Your site → ${res.partner}`} icon={ic.link} right={<Pill tone={res.youToThem.length ? 'ok' : 'warn'}>{res.youToThem.length ? 'linking' : 'not linking'}</Pill>}>
              <Row label="Page checked" value={<span className="font-mono text-xs">{res.yourUrl}</span>} />
              <Row label="HTTP status" value={res.yourCode ?? '—'} tone={res.yourCode === 200 ? 'good' : res.yourCode && res.yourCode >= 400 ? 'bad' : 'muted'} />
              {res.youToThem.length ? res.youToThem.map((l, i) => (
                <Row key={i} label={`Link ${i + 1} · anchor “${l.anchor}”`} value={<Pill tone={l.nofollow ? 'warn' : 'ok'}>{l.nofollow ? 'nofollow' : 'dofollow'}</Pill>} />
              )) : <Row label="Result" value="No link to their domain found on your homepage" tone="warn" />}
            </Card>
          </div>
          <Note>Both pages are fetched live and their actual HTML is scanned for hyperlinks to the other domain — anchors and rel attributes shown are the real ones on the page. Your side is checked on your homepage; if your link sits on an inner page, check that exact URL in the partner field of the Link Tracker for a page-level scan.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 7. Website Link Analyzer ----------
type LaRes = {
  url: string; internal: number; external: number; nofollow: number;
  links: { href: string; anchor: string; internal: boolean; nofollow: boolean }[];
  extHosts: { host: string; count: number }[]; anchors: { anchor: string; count: number }[];
};

export const LinkAnalyzerTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<LaRes | null>(null);
  const [filter, setFilter] = useState<'all' | 'internal' | 'external' | 'nofollow'>('all');

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null); setFilter('all');
    const data = await fetchPageData(url).catch(() => null);
    if (!data) { setErr('The page could not be fetched — it may be down, block relays, or require JavaScript.'); setBusy(false); return; }
    const hostMap = new Map<string, number>();
    data.linksSample.filter(l => !l.internal).forEach(l => { const h = regDomain(hostOf(l.href)); if (h) hostMap.set(h, (hostMap.get(h) || 0) + 1); });
    const anchorMap = new Map<string, number>();
    data.linksSample.forEach(l => { const a = l.anchor.toLowerCase(); if (a) anchorMap.set(a, (anchorMap.get(a) || 0) + 1); });
    setRes({
      url: data.finalUrl, internal: data.internalLinks, external: data.externalLinks, nofollow: data.nofollowLinks,
      links: data.linksSample,
      extHosts: Array.from(hostMap.entries()).map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count).slice(0, 12),
      anchors: Array.from(anchorMap.entries()).map(([anchor, count]) => ({ anchor, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    });
    setBusy(false);
  };

  const filtered = res ? res.links.filter(l =>
    filter === 'internal' ? l.internal : filter === 'external' ? !l.internal : filter === 'nofollow' ? l.nofollow : true) : [];

  return (
    <div>
      <SearchBar ph="https://example.com" cta="Analyze Links" busy={busy} onRun={v => void run(v)} samples={['https://developer.mozilla.org/en-US/']} icon={<Icon className="w-5 h-5">{ic.list}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Link analysis</p>
                <p className="text-2xl font-extrabold font-mono break-all mt-1">{res.url}</p>
              </div>
              <LiveBadge>{res.links.length} unique links parsed</LiveBadge>
            </div>
          </Hero>
          <div className="grid sm:grid-cols-3 gap-3">
            <Tile icon={ic.link} label="Internal" value={res.internal} />
            <Tile icon={ic.external} label="External" value={res.external} />
            <Tile icon={ic.shield} label="Nofollow" value={res.nofollow} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card title="External destinations by domain" icon={ic.external}>
              {res.extHosts.length ? (
                <div className="space-y-2">
                  {res.extHosts.map(h => (
                    <div key={h.host} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-700 w-48 truncate">{h.host}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.max(5, (h.count / res.extHosts[0].count) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-6 text-right">{h.count}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">This page has no external links.</p>}
            </Card>
            <Card title="Most-used anchor texts" icon={ic.doc}>
              {res.anchors.length ? (
                <div className="space-y-2">
                  {res.anchors.map(a => (
                    <div key={a.anchor} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-700 truncate">&ldquo;{a.anchor}&rdquo;</span>
                      <Pill tone="muted">×{a.count}</Pill>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No anchor texts detected.</p>}
            </Card>
          </div>
          <Card title="Every link on the page" icon={ic.list}
            right={
              <div className="flex gap-1.5">
                {(['all', 'internal', 'external', 'nofollow'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {f}
                  </button>
                ))}
              </div>
            }>
            <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0"><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                  <th className="text-left px-3 py-2.5">#</th><th className="text-left px-3 py-2.5">Anchor text</th>
                  <th className="text-left px-3 py-2.5">Destination</th><th className="text-left px-3 py-2.5">Type</th><th className="text-left px-3 py-2.5">Rel</th>
                </tr></thead>
                <tbody>
                  {filtered.slice(0, 250).map((l, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-slate-700 max-w-[200px] truncate">{l.anchor}</td>
                      <td className="px-3 py-1.5 font-mono text-xs text-slate-500 break-all max-w-[300px]">{l.href}</td>
                      <td className="px-3 py-1.5"><Pill tone={l.internal ? 'muted' : 'ok'}>{l.internal ? 'internal' : 'external'}</Pill></td>
                      <td className="px-3 py-1.5"><Pill tone={l.nofollow ? 'warn' : 'muted'}>{l.nofollow ? 'nofollow' : 'follow'}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 250 && <p className="text-xs text-slate-400 px-3 py-2">Showing first 250 of {filtered.length} links matching this filter.</p>}
            </div>
          </Card>
          <Note>Parsed from the page&rsquo;s live HTML: unique <code className="font-mono">a[href]</code> links (script/mailto/tel/fragment-only links excluded), each classified internal/external by registrable domain, with its real rel attribute and visible anchor text.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- 8. Broken Link Checker ----------
type BlRow = { url: string; code: number | null; ms: number | null; state: 'ok' | 'redirect' | 'broken' | 'unreachable' };
type BlRes = { page: string; checked: number; rows: BlRow[]; truncated: boolean; totalFound: number };
const BL_LIMIT = 40;

export const BrokenLinkTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState('');
  const [res, setRes] = useState<BlRes | null>(null);

  const run = async (v: string) => {
    const url = normUrl(v);
    if (!url) return;
    setBusy(true); setErr(''); setRes(null); setProgress('Fetching the page…');
    const data = await fetchPageData(url).catch(() => null);
    if (!data) { setErr('The page could not be fetched, so its links cannot be checked. It may be down, block relays, or require JavaScript.'); setBusy(false); return; }
    const targets = Array.from(new Set(data.linksSample.map(l => l.href))).slice(0, BL_LIMIT);
    const truncated = data.linksSample.length > BL_LIMIT;
    const rows: BlRow[] = [];
    let done = 0;
    // Probe in small parallel batches — real HTTP codes from the relay.
    for (let i = 0; i < targets.length; i += 6) {
      const batch = targets.slice(i, i + 6);
      const results = await Promise.all(batch.map(async t => {
        const p = await aoProbe(t);
        done++;
        setProgress(`Checking links… ${done}/${targets.length}`);
        if (!p || p.code === null) return { url: t, code: null, ms: null, state: 'unreachable' as const };
        const state: BlRow['state'] = p.code >= 400 ? 'broken' : p.code >= 300 ? 'redirect' : 'ok';
        return { url: t, code: p.code, ms: p.ms, state };
      }));
      rows.push(...results);
    }
    rows.sort((a, b) => (a.state === 'broken' ? -1 : b.state === 'broken' ? 1 : a.state === 'unreachable' ? -1 : b.state === 'unreachable' ? 1 : 0));
    setRes({ page: data.finalUrl, checked: rows.length, rows, truncated, totalFound: data.linksSample.length });
    setBusy(false);
  };

  const statePill = (r: BlRow) =>
    r.state === 'ok' ? <Pill tone="ok">{r.code} OK</Pill>
    : r.state === 'redirect' ? <Pill tone="warn">{r.code} redirect</Pill>
    : r.state === 'broken' ? <Pill tone="bad">{r.code} broken</Pill>
    : <Pill tone="muted">unreachable</Pill>;

  return (
    <div>
      <SearchBar ph="https://example.com" cta="Scan for Broken Links" busy={busy} onRun={v => void run(v)} samples={['https://en.wikipedia.org/wiki/HTML']} icon={<Icon className="w-5 h-5">{ic.bug}</Icon>} />
      {busy && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-slate-600">{progress || 'Starting…'}</span>
          </div>
          <Skeleton />
        </div>
      )}
      {err && <ErrBox msg={err} />}
      {res && (() => {
        const broken = res.rows.filter(r => r.state === 'broken').length;
        const redirects = res.rows.filter(r => r.state === 'redirect').length;
        const unreachable = res.rows.filter(r => r.state === 'unreachable').length;
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Broken link scan</p>
                  <p className="text-3xl font-extrabold mt-1">{broken === 0 ? 'No broken links found' : `${broken} broken link${broken === 1 ? '' : 's'}`}</p>
                  <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.page}</p>
                </div>
                <LiveBadge>{res.checked} live probes</LiveBadge>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile icon={ic.list} label="Links checked" value={res.checked} sub={res.truncated ? `first ${BL_LIMIT} of ${res.totalFound} on page` : 'every link on the page'} />
              <Tile icon={ic.check} label="Healthy" value={res.rows.filter(r => r.state === 'ok').length} sub="HTTP 2xx" />
              <Tile icon={ic.alert} label="Broken" value={broken} sub="HTTP 4xx / 5xx" />
              <Tile icon={ic.arrow} label="Redirects / unreachable" value={`${redirects} / ${unreachable}`} sub="3xx and relay failures" />
            </div>
            <Card title="Probe results" icon={ic.bug} right={broken ? <Pill tone="bad">{broken} to fix</Pill> : <Pill tone="ok">all clear</Pill>}>
              <div className="overflow-x-auto max-h-[30rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0"><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="text-left px-3 py-2.5">Status</th><th className="text-left px-3 py-2.5">URL</th><th className="text-left px-3 py-2.5">Response</th>
                  </tr></thead>
                  <tbody>
                    {res.rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 whitespace-nowrap">{statePill(r)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600 break-all">{r.url}</td>
                        <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{r.ms !== null ? `${r.ms} ms` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Note>
              Every status is a real HTTP request made just now (through a relay, since browsers cannot probe arbitrary cross-origin URLs
              directly). &ldquo;Unreachable&rdquo; means the relay itself failed — often bot protection rather than a dead page, so re-check those
              manually. Scans cover the first {BL_LIMIT} unique links of the page you enter; check key inner pages individually for full coverage.
            </Note>
          </div>
        );
      })()}
    </div>
  );
};


