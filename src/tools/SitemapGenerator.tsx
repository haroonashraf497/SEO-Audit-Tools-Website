import React, { useMemo, useRef, useState } from 'react';
import { fetchPageData } from '../utils/pageFetch';

/* Full XML Sitemap Generator: crawls a live site through the CORS relays
   (BFS, concurrency-limited, depth-capped), discovers internal URLs, reads
   each page's real modified date from its metadata, and emits a valid
   sitemap.org XML with per-depth priorities — or wraps a pasted URL list. */

interface Row { url: string; lastmod: string | null; depth: number }

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</span>
);
const inputCls = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
const Panel: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-lg overflow-hidden">
    <div className="bg-slate-50/80 px-5 py-3 flex items-center justify-between border-b border-slate-100">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</span>{right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

/** Real modified-date extraction from common CMS metadata. */
const extractLastmod = (html: string): string | null => {
  const pats = [
    /<meta[^>]+property=["'](article:modified_time|og:updated_time)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](article:modified_time|og:updated_time)["']/i,
    /<meta[^>]+itemprop=["']dateModified["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const re of pats) {
    const m = re.exec(html);
    const v = m ? (m[2] || m[1]) : null;
    if (v) { const d = new Date(v); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); }
  }
  return null;
};
const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const FREQS = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

export const SitemapGeneratorTool: React.FC = () => {
  const [mode, setMode] = useState<'crawl' | 'list'>('crawl');
  const [root, setRoot] = useState('');
  const [list, setList] = useState('');
  const [maxPages, setMaxPages] = useState('100');
  const [changefreq, setChangefreq] = useState('weekly');
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [sameHost, setSameHost] = useState(true);
  const [keepQuery, setKeepQuery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const runId = useRef(0);

  const keyOf = (u: URL) => u.origin + u.pathname.replace(/\/+$/, '/') + (keepQuery ? u.search : '');

  const crawl = async () => {
    const raw = root.trim();
    if (!raw) return;
    const start = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let base: URL;
    try { base = new URL(start); } catch { setErr('That does not look like a valid URL — try https://example.com'); return; }
    const id = ++runId.current;
    setBusy(true); setErr(''); setRows([]); setElapsed(0);
    const t0 = Date.now();
    const max = Number(maxPages) || 100;
    // `seen` dedupes the crawl queue; `added` dedupes the sitemap rows (a
    // redirected finalUrl may differ from the queued URL).
    const seen = new Set<string>([keyOf(base)]);
    const added = new Set<string>();
    const out: Row[] = [];
    let frontier: { url: string; depth: number }[] = [{ url: base.href, depth: 0 }];
    try {
      while (frontier.length && out.length < max && runId.current === id) {
        const batch = frontier.slice(0, 3);
        frontier = frontier.slice(3);
        setStatus(`Crawling… ${out.length} page${out.length === 1 ? '' : 's'} in the sitemap, fetching ${batch.length} more`);
        const results = await Promise.all(batch.map(async (item) => {
          const live = await fetchPageData(item.url).catch(() => null);
          if (!live || runId.current !== id) return null;
          const links: { url: string; depth: number }[] = [];
          if (item.depth < 6) {
            for (const m of live.html.matchAll(/<a[^>]+href=["']([^"'\s]+)["']/gi)) {
              try {
                const u = new URL(m[1], live.finalUrl);
                if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
                if (sameHost && u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue;
                if (/\.(png|jpe?g|gif|svg|webp|css|js|pdf|zip|mp4?|webm)$/i.test(u.pathname)) continue;
                const inc = include.trim(); const exc = exclude.trim();
                if (inc && !u.href.includes(inc)) continue;
                if (exc && u.href.includes(exc)) continue;
                const k = keyOf(u);
                if (!seen.has(k) && out.length + links.length < max) { seen.add(k); links.push({ url: u.href.split('#')[0], depth: item.depth + 1 }); }
              } catch { /* relative/odd href */ }
            }
          }
          return { finalUrl: live.finalUrl, lastmod: extractLastmod(live.html), depth: item.depth, links };
        }));
        const next: { url: string; depth: number }[] = [];
        for (const r of results) {
          if (!r) continue;
          let rk: string;
          try { rk = keyOf(new URL(r.finalUrl)); } catch { continue; }
          if (!seen.has(rk)) seen.add(rk);
          if (!added.has(rk)) { added.add(rk); out.push({ url: r.finalUrl.split('#')[0], lastmod: r.lastmod, depth: r.depth }); setRows([...out]); }
          next.push(...r.links);
        }
        frontier = frontier.concat(next);
      }
    } finally {
      if (runId.current === id) {
        setElapsed(Math.round((Date.now() - t0) / 1000));
        setBusy(false);
        setStatus(out.length ? `Done — ${out.length} page${out.length === 1 ? '' : 's'} discovered.` : '');
        if (!out.length) setErr('No pages could be fetched from that address. The site may block proxies — try the URL list mode instead.');
      }
    }
  };

  const buildList = () => {
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const line of list.split('\n')) {
      const u = line.trim();
      if (!u) continue;
      const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
      try {
        const k = keyOf(new URL(full));
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ url: full.split('#')[0], lastmod: null, depth: out.length === 0 ? 0 : 1 });
      } catch { /* skip invalid lines */ }
    }
    void today;
    setRows(out);
    setStatus(out.length ? `${out.length} URL${out.length === 1 ? '' : 's'} in the sitemap.` : '');
    setErr(out.length ? '' : 'Paste at least one URL, one per line.');
  };

  const run = () => { if (mode === 'crawl') void crawl(); else buildList(); };

  const today = new Date().toISOString().slice(0, 10);
  const xml = useMemo(() => {
    if (!rows.length) return '';
    const body = rows.map(r => {
      const prio = r.depth === 0 ? '1.0' : r.depth === 1 ? '0.8' : r.depth === 2 ? '0.6' : '0.5';
      return `  <url>\n    <loc>${escXml(r.url)}</loc>\n    <lastmod>${r.lastmod || today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
  }, [rows, changefreq, today]);

  const detected = rows.filter(r => r.lastmod).length;
  const download = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sitemap.xml';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {([['crawl', 'Crawl a website'], ['list', 'Paste URL list']] as ['crawl' | 'list', string][]).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${mode === m ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}>{label}</button>
        ))}
      </div>

      <Panel title={mode === 'crawl' ? 'Crawl a live site and build its sitemap' : 'Wrap a URL list into a sitemap'}>
        <div className="space-y-4">
          {mode === 'crawl' ? (
            <>
              <div><Label>Starting URL</Label>
                <input value={root} onChange={e => setRoot(e.target.value)} onKeyDown={e => e.key === 'Enter' && !busy && run()} placeholder="https://example.com" className={inputCls} /></div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div><Label>Max pages</Label>
                  <select value={maxPages} onChange={e => setMaxPages(e.target.value)} className={inputCls}>{['25', '50', '100', '250', '500'].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><Label>changefreq</Label>
                  <select value={changefreq} onChange={e => setChangefreq(e.target.value)} className={inputCls}>{FREQS.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                <div><Label>Only URLs containing</Label>
                  <input value={include} onChange={e => setInclude(e.target.value)} placeholder="e.g. /blog/" className={inputCls} /></div>
                <div><Label>Exclude URLs containing</Label>
                  <input value={exclude} onChange={e => setExclude(e.target.value)} placeholder="e.g. /tag/" className={inputCls} /></div>
              </div>
              <div className="flex flex-wrap gap-5 text-sm text-slate-600">
                <label className="flex items-center gap-2"><input type="checkbox" checked={sameHost} onChange={e => setSameHost(e.target.checked)} className="rounded border-slate-300" /> Stay on the same domain</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={keepQuery} onChange={e => setKeepQuery(e.target.checked)} className="rounded border-slate-300" /> Treat ?query strings as separate pages</label>
              </div>
            </>
          ) : (
            <div><Label>URLs, one per line</Label>
              <textarea value={list} onChange={e => setList(e.target.value)} rows={7} placeholder={'https://example.com/\nhttps://example.com/about\nhttps://example.com/blog/post-1'} className={inputCls + ' font-mono text-xs'} /></div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={run} disabled={busy}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:shadow-lg hover:shadow-indigo-200 transition disabled:opacity-50">
              {busy ? 'Crawling…' : mode === 'crawl' ? 'Crawl & Generate Sitemap' : 'Generate Sitemap'}
            </button>
            {busy && (
              <button type="button" onClick={() => { runId.current++; setBusy(false); }} className="px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-rose-200 hover:text-rose-600">Stop</button>
            )}
            {status && !busy && <span className="text-sm font-semibold text-emerald-600">{status}</span>}
            {busy && <span className="text-sm text-slate-500" aria-live="polite">{status}</span>}
          </div>
          {err && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{err}</div>}
        </div>
      </Panel>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Pages in sitemap</p><p className="text-2xl font-bold text-slate-800 tabular-nums">{rows.length}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Modified dates detected</p><p className="text-2xl font-bold text-emerald-600 tabular-nums">{detected}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Fallback lastmod</p><p className="text-2xl font-bold text-slate-800 tabular-nums">{rows.length - detected}</p></div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Crawl time</p><p className="text-2xl font-bold text-slate-800 tabular-nums">{elapsed ? `${elapsed}s` : '—'}</p></div>
          </div>

          <Panel title="sitemap.xml" right={
            <span className="flex gap-2">
              <button type="button" onClick={() => navigator.clipboard?.writeText(xml)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600">Copy</button>
              <button type="button" onClick={download} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">Download sitemap.xml</button>
            </span>
          }>
            <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-900 p-4 text-[11px] leading-4 text-emerald-200 font-mono whitespace-pre">{xml}</pre>
            <p className="text-xs text-slate-500 mt-3">
              <b>lastmod</b> uses the modified date detected in each page’s metadata (article:modified_time, og:updated_time, itemprop dateModified or &lt;time datetime&gt;); pages that expose none fall back to today ({today}). <b>priority</b> follows depth: 1.0 home, 0.8 second level, 0.6 third, 0.5 deeper. Upload the file to your site root and reference it in robots.txt, then submit it in Google Search Console / Bing Webmaster Tools.
            </p>
          </Panel>

          <Panel title={`Discovered URLs (${rows.length})`}>
            <div className="max-h-[360px] overflow-auto divide-y divide-slate-100">
              {rows.slice(0, 300).map(r => (
                <div key={r.url} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs text-slate-700 break-all">{r.url}</span>
                  <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2 py-0.5 ${r.lastmod ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.lastmod ? `modified ${r.lastmod}` : 'lastmod today'}</span>
                </div>
              ))}
              {rows.length > 300 && <p className="py-2 text-xs text-slate-400">Showing the first 300 URLs; the XML above contains all {rows.length}.</p>}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
};

export { extractLastmod as sitemapExtractLastmod };
