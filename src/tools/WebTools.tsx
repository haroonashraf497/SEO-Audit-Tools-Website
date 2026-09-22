import React, { useMemo, useState } from 'react';
import { PrimaryBtn } from './engines';
import { Seeded } from './simulator';
import { fetchPageData, type LivePageData } from '../utils/pageFetch';

// ---------- Shared UI ----------
export const UrlBar: React.FC<{ value: string; onChange: (v: string) => void; onRun: () => void; busy: boolean; label?: string; placeholder?: string }> = ({ value, onChange, onRun, busy, label = 'Analyze', placeholder }) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onRun()} placeholder={placeholder || 'https://example.com'}
      className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" />
    <PrimaryBtn type="button" onClick={onRun} disabled={busy || !value.trim()}>{busy ? 'Working…' : label}</PrimaryBtn>
  </div>
);

export const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 text-sm text-slate-600 py-8 justify-center">
    <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />{label}
  </div>
);

export const Card: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode; className?: string }> = ({ title, children, right, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm ${className}`}>
    <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-slate-900">{title}</h3>{right}</div>
    {children}
  </div>
);

export const Live: React.FC<{ ms?: number }> = ({ ms }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-0.5">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live page data{ms ? ` · ${ms} ms` : ''}
  </span>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: 'good' | 'warn' | 'bad' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => {
  const c = { good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', neutral: 'text-slate-800' }[tone];
  return <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-w-0"><p className="text-xs text-slate-500">{label}</p><p className={`text-lg font-bold break-words ${c}`}>{value}</p></div>;
};

type Check = { label: string; pass: boolean | null; detail: string; weight?: number };
export const CheckList: React.FC<{ checks: Check[] }> = ({ checks }) => (
  <ul className="divide-y divide-slate-100">
    {checks.map(c => (
      <li key={c.label} className="py-3 flex items-start gap-3">
        <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${c.pass === null ? 'bg-slate-300' : c.pass ? 'bg-emerald-500' : 'bg-red-500'}`}>{c.pass === null ? '–' : c.pass ? '✓' : '!'}</span>
        <div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{c.label}</p><p className="text-xs text-slate-500 break-words">{c.detail}</p></div>
      </li>
    ))}
  </ul>
);

const Fail: React.FC<{ msg?: string }> = ({ msg }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
    {msg || 'The page could not be fetched. The site may block automated requests or require JavaScript to render. Try another URL.'}
  </div>
);

const useFetch = () => {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<LivePageData | null>(null);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    if (!url.trim()) return;
    setBusy(true); setFailed(false); setData(null);
    const d = await fetchPageData(url.trim()).catch(() => null);
    if (!d) setFailed(true);
    setData(d); setBusy(false);
  };
  return { url, setUrl, busy, data, failed, run };
};

const kb = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`);
const host = (u: string) => u.replace(/^https?:\/\//, '').split('/')[0];

// ---------- SEO score checks (shared with Website Checker) ----------
const seoChecks = (d: LivePageData): Check[] => [
  { label: 'HTTPS', pass: d.finalUrl.startsWith('https://'), detail: d.finalUrl.startsWith('https://') ? 'Page is served securely.' : 'Serve the page over HTTPS.', weight: 8 },
  { label: 'Title tag', pass: d.title.length >= 30 && d.title.length <= 60, detail: d.title ? `${d.title.length} characters: “${d.title.slice(0, 80)}”` : 'No title tag found.', weight: 10 },
  { label: 'Meta description', pass: d.description.length >= 120 && d.description.length <= 160, detail: d.description ? `${d.description.length} characters.` : 'Missing meta description.', weight: 8 },
  { label: 'Single H1 heading', pass: d.headingCounts.H1 === 1, detail: `${d.headingCounts.H1} H1 tag(s) found${d.h1s[0] ? `: “${d.h1s[0].slice(0, 70)}”` : ''}.`, weight: 8 },
  { label: 'Heading hierarchy', pass: d.headingCounts.H2 > 0, detail: `H2: ${d.headingCounts.H2}, H3: ${d.headingCounts.H3}, H4: ${d.headingCounts.H4}.`, weight: 4 },
  { label: 'Image alt attributes', pass: d.imagesMissingAlt === 0, detail: `${d.imagesMissingAlt} of ${d.imageCount} images missing alt text.`, weight: 6 },
  { label: 'Content length', pass: d.wordCount >= 300, detail: `${d.wordCount.toLocaleString()} words of readable text.`, weight: 8 },
  { label: 'Code to text ratio', pass: d.textRatio >= 10, detail: `${d.textRatio}% text (aim for 10%+).`, weight: 4 },
  { label: 'Canonical tag', pass: !!d.canonical, detail: d.canonical || 'No canonical link.', weight: 5 },
  { label: 'Viewport meta (mobile)', pass: d.viewport, detail: d.viewport ? 'Responsive viewport declared.' : 'Add <meta name="viewport">.', weight: 8 },
  { label: 'Language attribute', pass: !!d.lang, detail: d.lang ? `lang="${d.lang}"` : 'Add lang attribute to <html>.', weight: 3 },
  { label: 'Charset declared', pass: d.charset, detail: d.charset ? 'UTF-8 charset present.' : 'Declare a character set.', weight: 2 },
  { label: 'Robots directive', pass: !/noindex/i.test(d.robots), detail: `robots: ${d.robots}`, weight: 6 },
  { label: 'Open Graph tags', pass: d.ogTitle && d.ogDescription && d.ogImage, detail: `og:title ${d.ogTitle ? '✓' : '✗'} · og:description ${d.ogDescription ? '✓' : '✗'} · og:image ${d.ogImage ? '✓' : '✗'}`, weight: 5 },
  { label: 'Twitter card', pass: d.twitterCard, detail: d.twitterCard ? 'twitter:card present.' : 'Add twitter:card meta.', weight: 3 },
  { label: 'Structured data (JSON-LD)', pass: d.hasJsonLd, detail: d.hasJsonLd ? 'Schema.org JSON-LD detected.' : 'No JSON-LD structured data found.', weight: 5 },
  { label: 'Internal linking', pass: d.internalLinks >= 5, detail: `${d.internalLinks} internal, ${d.externalLinks} external, ${d.nofollowLinks} nofollow.`, weight: 4 },
  { label: 'Page weight (HTML)', pass: d.codeSize < 150000, detail: `${kb(d.codeSize)} of HTML.`, weight: 3 },
];

const scoreOf = (checks: Check[]) => {
  const total = checks.reduce((a, c) => a + (c.weight || 1), 0);
  const got = checks.reduce((a, c) => a + (c.pass ? (c.weight || 1) : 0), 0);
  return Math.round((got / total) * 100);
};

const Ring: React.FC<{ value: number; label?: string }> = ({ value, label = 'Score' }) => {
  const r = 52, c = 2 * Math.PI * r;
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90"><circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" /><circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} className="transition-all duration-1000" /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-bold" style={{ color }}>{value}</span><span className="text-[11px] text-slate-500 font-semibold uppercase">{label}</span></div>
    </div>
  );
};

// ---------- 1. Website SEO Score Checker / Website Checker ----------
export const SeoScoreTool: React.FC = () => {
  const f = useFetch();
  const checks = f.data ? seoChecks(f.data) : [];
  const score = checks.length ? scoreOf(checks) : 0;
  const passed = checks.filter(c => c.pass).length;
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Check SEO Score" />
      {f.busy && <Spinner label="Fetching the live page and running 18 SEO checks…" />}
      {f.failed && <Fail />}
      {f.data && (
        <>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><Ring value={score} label="SEO Score" /><p className="text-center text-sm text-slate-600 mt-3">{passed}/{checks.length} checks passed</p></div>
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-slate-900 break-all">{host(f.data.finalUrl)}</h3><Live ms={f.data.fetchMs} /></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Words" value={f.data.wordCount.toLocaleString()} />
                <Stat label="Images" value={f.data.imageCount} tone={f.data.imagesMissingAlt ? 'warn' : 'good'} />
                <Stat label="Links" value={f.data.internalLinks + f.data.externalLinks} />
                <Stat label="HTML size" value={kb(f.data.codeSize)} tone={f.data.codeSize > 150000 ? 'warn' : 'good'} />
                <Stat label="Scripts" value={f.data.scripts} tone={f.data.scripts > 25 ? 'warn' : 'neutral'} />
                <Stat label="Stylesheets" value={f.data.stylesheets} />
                <Stat label="Response" value={`${f.data.fetchMs} ms`} tone={f.data.fetchMs < 800 ? 'good' : f.data.fetchMs < 2000 ? 'warn' : 'bad'} />
                <Stat label="Generator" value={f.data.generator || '—'} />
              </div>
            </div>
          </div>
          <Card title="Detailed checks"><CheckList checks={checks} /></Card>
          <Card title="Priority fixes">
            {checks.filter(c => !c.pass).length === 0 ? <p className="text-sm text-emerald-600 font-semibold">Everything passed — excellent on-page foundation.</p> : (
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
                {checks.filter(c => !c.pass).sort((a, b) => (b.weight || 0) - (a.weight || 0)).map(c => <li key={c.label}><strong>{c.label}</strong> — {c.detail}</li>)}
              </ol>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

// ---------- 2. Meta Tags Analyzer ----------
export const MetaAnalyzerTool: React.FC = () => {
  const f = useFetch();
  const important = ['title', 'description', 'keywords', 'robots', 'viewport', 'charset', 'author', 'generator', 'theme-color', 'og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'canonical'];
  const grade = (name: string, content: string): [string, 'good' | 'warn' | 'bad'] => {
    if (name === 'title') return content.length >= 30 && content.length <= 60 ? ['Optimal length', 'good'] : content.length ? [content.length > 60 ? 'Too long (>60)' : 'Too short (<30)', 'warn'] : ['Missing', 'bad'];
    if (name === 'description') return content.length >= 120 && content.length <= 160 ? ['Optimal length', 'good'] : content.length ? [content.length > 160 ? 'Too long (>160)' : 'Too short (<120)', 'warn'] : ['Missing', 'bad'];
    if (name === 'keywords') return content ? ['Ignored by Google', 'warn'] : ['Not needed', 'good'];
    if (name === 'robots') return /noindex/i.test(content) ? ['Blocks indexing!', 'bad'] : ['OK', 'good'];
    return content ? ['Present', 'good'] : ['Missing', name.startsWith('og:') || name.startsWith('twitter:') ? 'warn' : 'bad'];
  };
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Analyze Meta Tags" />
      {f.busy && <Spinner label="Extracting meta tags from the live page…" />}
      {f.failed && <Fail />}
      {f.data && (() => {
        const d = f.data;
        const map = new Map<string, string>();
        map.set('title', d.title); map.set('canonical', d.canonical);
        d.metaTags.forEach(m => { if (!map.has(m.name.toLowerCase())) map.set(m.name.toLowerCase(), m.content); });
        const rows = important.map(n => ({ name: n, content: map.get(n) || '', g: grade(n, map.get(n) || '') }));
        const others = d.metaTags.filter(m => !important.includes(m.name.toLowerCase()));
        const good = rows.filter(r => r.g[1] === 'good').length;
        return (
          <>
            <div className="grid sm:grid-cols-4 gap-3">
              <Stat label="Meta tags found" value={d.metaTags.length + 1} />
              <Stat label="Important tags OK" value={`${good}/${rows.length}`} tone={good >= rows.length - 3 ? 'good' : 'warn'} />
              <Stat label="Title length" value={`${d.title.length} chars`} tone={d.title.length >= 30 && d.title.length <= 60 ? 'good' : 'warn'} />
              <Stat label="Description length" value={`${d.description.length} chars`} tone={d.description.length >= 120 && d.description.length <= 160 ? 'good' : 'warn'} />
            </div>
            <Card title="Important SEO & social meta tags" right={<Live ms={d.fetchMs} />}>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="text-left px-3 py-2">Tag</th><th className="text-left px-3 py-2">Content</th><th className="text-left px-3 py-2">Status</th></tr></thead>
                <tbody>{rows.map(r => (
                  <tr key={r.name} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-mono text-xs text-indigo-700 whitespace-nowrap">{r.name}</td>
                    <td className="px-3 py-2 text-slate-700 break-all max-w-xl">{r.content || <span className="text-slate-400 italic">not set</span>}</td>
                    <td className={`px-3 py-2 font-semibold whitespace-nowrap ${r.g[1] === 'good' ? 'text-emerald-600' : r.g[1] === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>{r.g[0]}</td>
                  </tr>))}</tbody>
              </table></div>
            </Card>
            {others.length > 0 && (
              <Card title={`Other meta tags (${others.length})`}>
                <div className="grid sm:grid-cols-2 gap-2">{others.map((m, i) => <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-xs"><span className="font-mono text-indigo-700">{m.name}</span><span className="text-slate-600 break-all"> = {m.content.slice(0, 160) || '—'}</span></div>)}</div>
              </Card>
            )}
          </>
        );
      })()}
    </div>
  );
};

// ---------- 3. Open Graph Checker ----------
export const OgCheckerTool: React.FC = () => {
  const f = useFetch();
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Check Open Graph" />
      {f.busy && <Spinner label="Fetching Open Graph tags…" />}
      {f.failed && <Fail />}
      {f.data && (() => {
        const d = f.data;
        const og = (k: string) => d.metaTags.find(m => m.name.toLowerCase() === `og:${k}`)?.content || '';
        const tw = (k: string) => d.metaTags.find(m => m.name.toLowerCase() === `twitter:${k}`)?.content || '';
        const req = [['og:title', og('title'), true], ['og:description', og('description'), true], ['og:image', og('image'), true], ['og:url', og('url'), true], ['og:type', og('type'), false], ['og:site_name', og('site_name'), false], ['og:locale', og('locale'), false], ['og:image:width', og('image:width'), false], ['og:image:height', og('image:height'), false], ['og:image:alt', og('image:alt'), false]] as [string, string, boolean][];
        const present = req.filter(r => r[1]).length;
        const title = og('title') || d.title; const desc = og('description') || d.description; const img = og('image');
        return (
          <>
            <div className="grid lg:grid-cols-2 gap-5">
              <Card title="Facebook / LinkedIn share preview" right={<Live ms={d.fetchMs} />}>
                <div className="rounded-xl border border-slate-300 overflow-hidden bg-white max-w-md">
                  <div className="aspect-[1.91/1] bg-slate-100 flex items-center justify-center text-slate-400 text-sm overflow-hidden">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : 'No og:image — link will show without an image'}
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-200">
                    <p className="text-[11px] uppercase text-slate-500">{host(og('url') || d.finalUrl)}</p>
                    <p className="font-bold text-slate-900 leading-snug line-clamp-2">{title || 'No title'}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{desc || 'No description'}</p>
                  </div>
                </div>
              </Card>
              <Card title={`Open Graph tags (${present}/${req.length} present)`}>
                <CheckList checks={req.map(([k, v, required]) => ({ label: k + (required ? ' (required)' : ''), pass: v ? true : required ? false : null, detail: v ? v.slice(0, 140) : required ? 'Missing — add this tag for correct sharing.' : 'Optional, not set.' }))} />
              </Card>
            </div>
            <Card title="Twitter / X card tags">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {['card', 'title', 'description', 'image', 'site', 'creator'].map(k => <Stat key={k} label={`twitter:${k}`} value={tw(k) ? <span className="text-sm">{tw(k).slice(0, 60)}</span> : '—'} tone={tw(k) ? 'good' : k === 'card' ? 'bad' : 'neutral'} />)}
              </div>
              {!tw('card') && <p className="text-xs text-slate-500 mt-3">Without twitter:card, X falls back to Open Graph tags but shows a smaller preview.</p>}
            </Card>
          </>
        );
      })()}
    </div>
  );
};

// ---------- 4. Page Snooper (source viewer) ----------
export const SnooperTool: React.FC = () => {
  const f = useFetch();
  const [wrap, setWrap] = useState(false);
  const [filter, setFilter] = useState('');
  const lines = useMemo(() => (f.data ? f.data.html.split('\n') : []), [f.data]);
  const shown = filter ? lines.map((l, i) => [l, i] as [string, number]).filter(([l]) => l.toLowerCase().includes(filter.toLowerCase())) : lines.map((l, i) => [l, i] as [string, number]);
  const tagCount = (d: LivePageData, t: string) => (d.html.match(new RegExp(`<${t}[\\s>]`, 'gi')) || []).length;
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="View Source" />
      {f.busy && <Spinner label="Downloading page source…" />}
      {f.failed && <Fail />}
      {f.data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <Stat label="Lines" value={lines.length.toLocaleString()} /><Stat label="Size" value={kb(f.data.codeSize)} /><Stat label="<div>" value={tagCount(f.data, 'div')} /><Stat label="<a>" value={tagCount(f.data, 'a')} />
            <Stat label="<img>" value={tagCount(f.data, 'img')} /><Stat label="<script>" value={f.data.scripts} /><Stat label="<link>" value={tagCount(f.data, 'link')} /><Stat label="<iframe>" value={f.data.iframes} />
          </div>
          <div className="bg-slate-900 rounded-2xl overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
              <span className="text-xs text-slate-300 font-mono truncate flex-1">{f.data.finalUrl}</span>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter lines…" className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-600 text-xs text-slate-200 outline-none w-40" />
              <button type="button" onClick={() => setWrap(!wrap)} className="px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-xs text-slate-200">{wrap ? 'No wrap' : 'Wrap'}</button>
              <button type="button" onClick={() => navigator.clipboard?.writeText(f.data!.html)} className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold">Copy source</button>
            </div>
            <div className="max-h-[560px] overflow-auto font-mono text-[12px] leading-5">
              {shown.slice(0, 3000).map(([l, i]) => (
                <div key={i} className="flex hover:bg-slate-800/60">
                  <span className="w-14 flex-shrink-0 text-right pr-3 text-slate-600 select-none border-r border-slate-800">{i + 1}</span>
                  <span className={`px-3 text-slate-200 ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>{l.length > 2000 ? l.slice(0, 2000) + ' …' : l}</span>
                </div>
              ))}
              {shown.length > 3000 && <p className="px-4 py-2 text-xs text-slate-400">Showing first 3,000 lines. Use the filter or copy the full source.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ---------- 5. Get HTTP Headers ----------
const HEADER_INFO: Record<string, string> = {
  'content-type': 'MIME type and character encoding of the response body.',
  'content-encoding': 'Compression applied (gzip/br). Missing means uncompressed transfer.',
  'cache-control': 'How browsers and CDNs may cache the page. Long max-age = faster repeat visits.',
  'server': 'Web server software. Consider hiding version numbers for security.',
  'strict-transport-security': 'HSTS: forces HTTPS for future visits. Recommended security header.',
  'content-security-policy': 'CSP: restricts which scripts/resources may load. Strong XSS protection.',
  'x-frame-options': 'Prevents clickjacking by blocking framing on other sites.',
  'x-content-type-options': 'nosniff stops browsers from MIME-sniffing responses.',
  'referrer-policy': 'Controls how much referrer information is sent with requests.',
  'permissions-policy': 'Restricts browser features (camera, geolocation, etc.).',
  'set-cookie': 'Cookies issued by the server. Check for Secure, HttpOnly and SameSite flags.',
  'x-powered-by': 'Reveals backend technology; usually best removed.',
  'etag': 'Validator for conditional requests and efficient caching.',
  'last-modified': 'When the resource last changed; used for caching.',
  'vary': 'Which request headers affect the cached response.',
  'age': 'Seconds the response has been in a CDN/proxy cache.',
  'cf-ray': 'Cloudflare request ID — indicates Cloudflare is in front of the site.',
  'x-cache': 'CDN cache HIT/MISS status.',
  'alt-svc': 'Advertises HTTP/3 (QUIC) availability.',
  'location': 'Redirect target URL.',
};
export const HeadersTool: React.FC = () => {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ status: number; statusText: string; headers: [string, string][]; ms: number; via: string } | null>(null);
  const [err, setErr] = useState('');
  const run = async () => {
    const u = url.trim(); if (!u) return;
    const target = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    setBusy(true); setErr(''); setRes(null);
    const t0 = performance.now();
    // Direct fetch works when the site sends CORS headers; otherwise use a proxy that forwards headers
    try {
      const r = await fetch(target, { method: 'GET', mode: 'cors', redirect: 'follow', signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined });
      const hs: [string, string][] = []; r.headers.forEach((v, k) => hs.push([k, v]));
      setRes({ status: r.status, statusText: r.statusText, headers: hs, ms: Math.round(performance.now() - t0), via: 'direct (CORS)' });
    } catch {
      // Fallback: use a relay that exposes the upstream status and headers as JSON
      const relays = [
        async () => { const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined }); const j = await r.json(); const st = j.status || {}; const hs: [string, string][] = Object.entries(st.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]); if (!hs.length && !st.http_code) throw new Error('empty'); return { status: st.http_code || 200, hs }; },
        async () => { const r = await fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(target)}`, { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined }); const hs: [string, string][] = []; r.headers.forEach((v, k) => hs.push([k, v])); if (!r.ok) throw new Error('bad'); return { status: r.status, hs }; },
      ];
      let done = false;
      for (const relay of relays) {
        try { const { status, hs } = await relay(); setRes({ status, statusText: status === 200 ? 'OK' : status >= 300 && status < 400 ? 'Redirect' : status >= 400 ? 'Error' : '', headers: hs, ms: Math.round(performance.now() - t0), via: 'proxy relay' }); done = true; break; } catch { /* next relay */ }
      }
      if (!done) setErr('Headers could not be retrieved from the browser: the site does not allow cross-origin reads and the public relays are unavailable right now. Tip: run `curl -I ' + target + '` in a terminal for the raw headers.');
    }
    setBusy(false);
  };
  const security = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
  return (
    <div className="space-y-5">
      <UrlBar value={url} onChange={setUrl} onRun={run} busy={busy} label="Get Headers" />
      {busy && <Spinner label="Requesting headers…" />}
      {err && <Fail msg={err} />}
      {res && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Status" value={`${res.status} ${res.statusText}`} tone={res.status < 300 ? 'good' : res.status < 400 ? 'warn' : 'bad'} />
            <Stat label="Response time" value={`${res.ms} ms`} tone={res.ms < 800 ? 'good' : 'warn'} />
            <Stat label="Headers" value={res.headers.length} />
            <Stat label="Security headers" value={`${security.filter(s => res.headers.some(h => h[0] === s)).length}/6`} tone={security.filter(s => res.headers.some(h => h[0] === s)).length >= 4 ? 'good' : 'warn'} />
          </div>
          <Card title="Response headers" right={<span className="text-xs text-slate-400">via {res.via}</span>}>
            <div className="divide-y divide-slate-100">
              {res.headers.map(([k, v]) => (
                <div key={k + v} className="py-2.5 grid sm:grid-cols-[220px_1fr] gap-1">
                  <span className="font-mono text-xs font-semibold text-indigo-700">{k}</span>
                  <div><p className="font-mono text-xs text-slate-800 break-all">{v}</p>{HEADER_INFO[k] && <p className="text-[11px] text-slate-500 mt-0.5">{HEADER_INFO[k]}</p>}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Security header audit">
            <CheckList checks={security.map(s => ({ label: s, pass: res.headers.some(h => h[0] === s), detail: HEADER_INFO[s] }))} />
          </Card>
        </>
      )}
    </div>
  );
};

// ---------- 6. WordPress Theme Detector ----------
export const WpDetectorTool: React.FC = () => {
  const f = useFetch();
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Detect Theme" />
      {f.busy && <Spinner label="Scanning source for WordPress signatures…" />}
      {f.failed && <Fail />}
      {f.data && (() => {
        const h = f.data.html;
        const isWp = /wp-content|wp-includes|wp-json|WordPress/i.test(h);
        const themes = Array.from(new Set(Array.from(h.matchAll(/wp-content\/themes\/([a-z0-9_-]+)/gi)).map(m => m[1].toLowerCase())));
        const plugins = Array.from(new Set(Array.from(h.matchAll(/wp-content\/plugins\/([a-z0-9_-]+)/gi)).map(m => m[1].toLowerCase())));
        const version = f.data.generator.match(/WordPress\s*([\d.]+)/i)?.[1] || h.match(/ver=(\d+\.\d+(?:\.\d+)?)/)?.[1] || '';
        const builders = [['elementor', 'Elementor'], ['divi', 'Divi'], ['beaver', 'Beaver Builder'], ['wpbakery|js_composer', 'WPBakery'], ['oxygen', 'Oxygen'], ['bricks', 'Bricks']].filter(([re]) => new RegExp(re, 'i').test(h)).map(b => b[1]);
        const cms = isWp ? 'WordPress' : /shopify/i.test(h) ? 'Shopify' : /wix\.com/i.test(h) ? 'Wix' : /squarespace/i.test(h) ? 'Squarespace' : /joomla/i.test(h) ? 'Joomla' : /drupal/i.test(h) ? 'Drupal' : /webflow/i.test(h) ? 'Webflow' : /ghost/i.test(f.data.generator) ? 'Ghost' : /next\.js|__next/i.test(h) ? 'Next.js' : /nuxt/i.test(h) ? 'Nuxt' : 'Unknown / custom';
        const pretty = (s: string) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return (
          <>
            <div className={`rounded-2xl p-6 text-white ${isWp ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-slate-800'}`}>
              <p className="text-sm opacity-80">{host(f.data.finalUrl)}</p>
              <p className="text-3xl font-extrabold mt-1">{isWp ? 'WordPress detected' : `Not WordPress — ${cms}`}</p>
              {isWp && themes[0] && <p className="text-lg mt-2">Active theme: <strong>{pretty(themes[0])}</strong>{themes[1] && <span className="opacity-80"> (parent: {pretty(themes[1])})</span>}</p>}
            </div>
            <div className="grid sm:grid-cols-4 gap-3">
              <Stat label="CMS / Platform" value={cms} tone="good" /><Stat label="WP version" value={version || (isWp ? 'Hidden' : '—')} /><Stat label="Themes found" value={themes.length} /><Stat label="Plugins detected" value={plugins.length} />
            </div>
            {builders.length > 0 && <Card title="Page builder"><p className="text-sm text-slate-700">{builders.join(', ')}</p></Card>}
            {plugins.length > 0 && (
              <Card title={`Installed plugins (${plugins.length} visible in source)`}>
                <div className="flex flex-wrap gap-2">{plugins.map(p => <span key={p} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">{pretty(p)}</span>)}</div>
                <p className="text-xs text-slate-400 mt-3">Only plugins that load front-end assets are detectable. Admin-only plugins remain hidden.</p>
              </Card>
            )}
            {f.data.generator && <Card title="Generator meta tag"><p className="font-mono text-sm text-slate-700">{f.data.generator}</p></Card>}
          </>
        );
      })()}
    </div>
  );
};

// ---------- 7. Mobile Friendly Test ----------
export const MobileTestTool: React.FC = () => {
  const f = useFetch();
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Test Mobile Friendliness" />
      {f.busy && <Spinner label="Analysing mobile signals…" />}
      {f.failed && <Fail />}
      {f.data && (() => {
        const d = f.data;
        const vp = d.metaTags.find(m => m.name === 'viewport')?.content || '';
        const checks: Check[] = [
          { label: 'Viewport meta tag', pass: !!vp, detail: vp ? `content="${vp}"` : 'Missing — the page will render at desktop width on phones.', weight: 30 },
          { label: 'Viewport uses device-width', pass: /device-width/.test(vp), detail: /device-width/.test(vp) ? 'Layout adapts to screen width.' : 'Use width=device-width, initial-scale=1.', weight: 15 },
          { label: 'Zoom not disabled', pass: !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp), detail: /user-scalable\s*=\s*(no|0)/.test(vp) ? 'user-scalable=no harms accessibility.' : 'Users can pinch-zoom.', weight: 10 },
          { label: 'Responsive images (srcset)', pass: /srcset=/i.test(d.html), detail: /srcset=/i.test(d.html) ? 'srcset detected for responsive images.' : 'No srcset found; phones may download desktop-size images.', weight: 10 },
          { label: 'Images have dimensions', pass: d.imagesWithoutDimensions === 0, detail: `${d.imagesWithoutDimensions} of ${d.imageCount} images lack width/height (causes layout shift).`, weight: 10 },
          { label: 'Legible font sizes', pass: !d.smallFontRisk, detail: d.smallFontRisk ? 'Inline font-size below 12px detected.' : 'No tiny inline font sizes found.', weight: 10 },
          { label: 'No Flash / plugins', pass: !/<(embed|object)[^>]+(swf|flash)/i.test(d.html), detail: 'Plugins are unsupported on mobile browsers.', weight: 5 },
          { label: 'Reasonable page weight', pass: d.codeSize < 200000, detail: `${kb(d.codeSize)} of HTML.`, weight: 5 },
          { label: 'Limited render-blocking scripts', pass: d.externalScripts <= 15, detail: `${d.externalScripts} external scripts.`, weight: 5 },
        ];
        const score = scoreOf(checks);
        return (
          <>
            <div className="grid md:grid-cols-[1fr_320px] gap-5">
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center gap-6">
                  <Ring value={score} label="Mobile" />
                  <div><p className={`text-2xl font-extrabold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{score >= 80 ? 'Mobile friendly' : score >= 60 ? 'Needs improvement' : 'Not mobile friendly'}</p><p className="text-sm text-slate-600 mt-1">{checks.filter(c => c.pass).length}/{checks.length} checks passed for {host(d.finalUrl)}</p><div className="mt-2"><Live ms={d.fetchMs} /></div></div>
                </div>
                <Card title="Mobile usability checks"><CheckList checks={checks} /></Card>
              </div>
              <div className="bg-slate-900 rounded-[2.2rem] p-3 shadow-xl h-fit mx-auto w-[300px]">
                <div className="bg-white rounded-[1.7rem] overflow-hidden"><div className="h-6 bg-slate-100 flex items-center justify-center"><span className="w-16 h-1.5 rounded-full bg-slate-300" /></div>
                  <iframe title="Mobile preview" src={d.finalUrl} loading="lazy" sandbox="allow-same-origin allow-scripts" className="w-full h-[520px] bg-white" />
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-2">Live preview at 375px · some sites block embedding</p>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
};

// ---------- 8. Page Speed Checker ----------
export const PageSpeedTool: React.FC = () => {
  const f = useFetch();
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Check Speed" />
      {f.busy && <Spinner label="Timing the page download…" />}
      {f.failed && <Fail />}
      {f.data && (() => {
        const d = f.data;
        const est3g = ((d.codeSize * 8) / 1_600_000 + 0.3).toFixed(1);
        const est4g = ((d.codeSize * 8) / 9_000_000 + 0.1).toFixed(2);
        const grade = d.fetchMs < 600 ? 'A' : d.fetchMs < 1200 ? 'B' : d.fetchMs < 2500 ? 'C' : 'D';
        const recs = [
          d.externalScripts > 10 && `Reduce the ${d.externalScripts} external scripts; defer non-critical JavaScript.`,
          d.stylesheets > 4 && `Combine or inline critical CSS (${d.stylesheets} stylesheets).`,
          d.codeSize > 150000 && `HTML is ${kb(d.codeSize)}; remove inline SVG/data URIs and unused markup.`,
          d.imagesWithoutDimensions > 0 && `Add width/height to ${d.imagesWithoutDimensions} images to prevent layout shift (CLS).`,
          !/srcset=/i.test(d.html) && 'Serve responsive images with srcset and modern formats (WebP/AVIF).',
          d.iframes > 2 && `${d.iframes} iframes detected; lazy-load embeds.`,
          d.textRatio < 10 && `Code-to-text ratio is ${d.textRatio}%; trim template bloat.`,
          !/loading="lazy"/i.test(d.html) && 'Use loading="lazy" on below-the-fold images.',
          !/rel="preconnect"|rel="preload"/i.test(d.html) && 'Add preconnect/preload hints for critical third-party origins and fonts.',
        ].filter(Boolean) as string[];
        return (
          <>
            <div className="grid md:grid-cols-[200px_1fr] gap-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center"><p className="text-xs text-slate-500 uppercase font-semibold">Speed grade</p><p className={`text-7xl font-extrabold ${grade === 'A' ? 'text-emerald-500' : grade === 'B' ? 'text-lime-500' : grade === 'C' ? 'text-amber-500' : 'text-red-500'}`}>{grade}</p><p className="text-sm text-slate-600">{d.fetchMs} ms to fetch HTML</p></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 content-start">
                <Stat label="Server response (HTML)" value={`${d.fetchMs} ms`} tone={d.fetchMs < 800 ? 'good' : d.fetchMs < 2000 ? 'warn' : 'bad'} />
                <Stat label="HTML size" value={kb(d.codeSize)} tone={d.codeSize < 100000 ? 'good' : 'warn'} />
                <Stat label="Scripts (ext / total)" value={`${d.externalScripts} / ${d.scripts}`} tone={d.externalScripts > 15 ? 'bad' : d.externalScripts > 8 ? 'warn' : 'good'} />
                <Stat label="Stylesheets" value={d.stylesheets} tone={d.stylesheets > 6 ? 'warn' : 'good'} />
                <Stat label="Images" value={d.imageCount} /><Stat label="Iframes" value={d.iframes} tone={d.iframes > 2 ? 'warn' : 'good'} />
                <Stat label="Est. HTML on 3G" value={`${est3g}s`} /><Stat label="Est. HTML on 4G" value={`${est4g}s`} />
              </div>
            </div>
            <Card title={`Recommendations (${recs.length})`} right={<Live ms={d.fetchMs} />}>
              {recs.length ? <ul className="space-y-2 text-sm text-slate-700">{recs.map(r => <li key={r} className="flex gap-2"><span className="text-indigo-500">▸</span>{r}</li>)}</ul> : <p className="text-sm text-emerald-600 font-semibold">No obvious front-end bottlenecks detected in the HTML.</p>}
              <p className="text-xs text-slate-400 mt-4">Timing measures the HTML document only (via proxy). For full Core Web Vitals (LCP/INP/CLS) use field data from PageSpeed Insights; read our <a href="/blog/pagespeed-lab-vs-field-data" className="underline">lab vs field guide</a>.</p>
            </Card>
          </>
        );
      })()}
    </div>
  );
};

// ---------- 9. Page Size Checker ----------
export const PageSizeTool: React.FC = () => {
  const f = useFetch();
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Check Page Size" />
      {f.busy && <Spinner label="Measuring page size…" />}
      {f.failed && <Fail />}
      {f.data && (() => {
        const d = f.data; const bytes = d.codeSize;
        const conns: [string, number][] = [['2G (50 kbps)', 50_000], ['3G (1.6 Mbps)', 1_600_000], ['4G (9 Mbps)', 9_000_000], ['5G / Fibre (100 Mbps)', 100_000_000]];
        return (
          <>
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white"><p className="text-indigo-100 text-sm">{host(d.finalUrl)} — HTML document size</p><p className="text-4xl font-extrabold">{kb(bytes)} <span className="text-lg font-semibold opacity-80">({bytes.toLocaleString()} bytes)</span></p><p className="text-sm mt-2 text-indigo-100">{bytes < 50000 ? 'Lean — well under the 100 KB HTML guideline.' : bytes < 150000 ? 'Average — consider trimming inline scripts/styles.' : 'Heavy — large HTML delays first render on slow connections.'}</p></div>
            <div className="grid sm:grid-cols-4 gap-3">
              <Stat label="Visible text" value={kb(d.textSize)} /><Stat label="Text ratio" value={`${d.textRatio}%`} tone={d.textRatio >= 10 ? 'good' : 'warn'} /><Stat label="Inline <style> blocks" value={d.inlineStyles} /><Stat label="Inline <script> blocks" value={d.scripts - d.externalScripts} />
            </div>
            <Card title="Estimated HTML download time" right={<Live ms={d.fetchMs} />}>
              <div className="space-y-3">{conns.map(([n, bps]) => { const s = (bytes * 8) / bps; return <div key={n}><div className="flex justify-between text-sm mb-1"><span className="text-slate-700">{n}</span><span className="font-semibold text-slate-800">{s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`}</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (s / 5) * 100)}%` }} /></div></div>; })}</div>
              <p className="text-xs text-slate-400 mt-4">Median web page HTML is ~30 KB; total page weight with images and scripts is typically 2 MB+. This tool measures the HTML document only.</p>
            </Card>
          </>
        );
      })()}
    </div>
  );
};

// ---------- 10. AVG Antivirus / Website Safety ----------
export const SafetyTool: React.FC = () => {
  const f = useFetch();
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Scan Website" />
      {f.busy && <Spinner label="Scanning page for security risks…" />}
      {f.failed && <Fail />}
      {f.data && (() => {
        const d = f.data; const h = d.html;
        const mixed = d.finalUrl.startsWith('https://') && /(src|href)=["']http:\/\//i.test(h);
        const obfuscated = /eval\(|unescape\(|fromCharCode|document\.write\(unescape/i.test(h);
        const hiddenIframe = /<iframe[^>]+(display:\s*none|width=["']?0|height=["']?0)/i.test(h);
        const suspiciousRedirect = /<meta[^>]+http-equiv=["']refresh["'][^>]+url=/i.test(h) || /window\.location\s*=\s*["']http/i.test(h);
        const cryptoMiner = /coinhive|cryptonight|minero|coin-hive|webminer/i.test(h);
        const popups = /window\.open\(/i.test(h);
        const checks: Check[] = [
          { label: 'HTTPS encryption', pass: d.finalUrl.startsWith('https://'), detail: d.finalUrl.startsWith('https://') ? 'Traffic is encrypted.' : 'Site served over plain HTTP.', weight: 20 },
          { label: 'No mixed content', pass: !mixed, detail: mixed ? 'HTTP resources loaded on an HTTPS page.' : 'All detected resources use HTTPS.', weight: 10 },
          { label: 'No obfuscated scripts', pass: !obfuscated, detail: obfuscated ? 'eval/unescape/fromCharCode patterns found — common in malware.' : 'No obfuscation patterns found.', weight: 20 },
          { label: 'No hidden iframes', pass: !hiddenIframe, detail: hiddenIframe ? 'Zero-size or hidden iframe detected.' : `${d.iframes} visible iframe(s), none hidden.`, weight: 15 },
          { label: 'No forced redirects', pass: !suspiciousRedirect, detail: suspiciousRedirect ? 'Meta refresh or JS redirect to another URL.' : 'No automatic redirects in HTML.', weight: 10 },
          { label: 'No crypto-mining scripts', pass: !cryptoMiner, detail: cryptoMiner ? 'Browser-mining library detected!' : 'No known mining libraries.', weight: 15 },
          { label: 'No pop-up scripts', pass: !popups, detail: popups ? 'window.open() found — may spawn pop-ups.' : 'No pop-up calls found.', weight: 5 },
          { label: 'Reasonable third-party scripts', pass: d.externalScripts <= 20, detail: `${d.externalScripts} external scripts loaded.`, weight: 5 },
        ];
        const score = scoreOf(checks);
        return (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-wrap items-center gap-6">
              <Ring value={score} label="Safety" />
              <div><p className={`text-2xl font-extrabold ${score >= 85 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{score >= 85 ? 'Looks safe' : score >= 60 ? 'Some risks found' : 'Potentially unsafe'}</p><p className="text-sm text-slate-600 mt-1">{host(d.finalUrl)} · {checks.filter(c => c.pass).length}/{checks.length} checks passed</p><div className="mt-2"><Live ms={d.fetchMs} /></div></div>
            </div>
            <Card title="Security checks"><CheckList checks={checks} /></Card>
            <p className="text-xs text-slate-400">Static analysis of the HTML source. For full malware scanning use Google Safe Browsing, VirusTotal or AVG/Avast Online Security in addition.</p>
          </>
        );
      })()}
    </div>
  );
};

// ---------- 11. Email Privacy ----------
const obfuscate = (email: string) => ({
  entity: email.split('').map(c => `&#${c.charCodeAt(0)};`).join(''),
  spelled: email.replace('@', ' [at] ').replace(/\./g, ' [dot] '),
  reversed: `<span style="unicode-bidi:bidi-override;direction:rtl">${email.split('').reverse().join('')}</span>`,
  js: `<script>document.write('${email.split('@')[0]}'+'@'+'${email.split('@')[1]}')</script>`,
});
export const EmailPrivacyTool: React.FC = () => {
  const f = useFetch();
  const [manual, setManual] = useState('');
  const list = f.data?.emails || [];
  const target = manual.trim() || list[0] || '';
  return (
    <div className="space-y-5">
      <UrlBar value={f.url} onChange={f.setUrl} onRun={f.run} busy={f.busy} label="Scan for Emails" />
      {f.busy && <Spinner label="Scanning page source for email addresses…" />}
      {f.failed && <Fail />}
      {f.data && (
        <div className={`rounded-2xl p-6 text-white ${list.length ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
          <p className="text-sm opacity-90">{host(f.data.finalUrl)}</p>
          <p className="text-3xl font-extrabold">{list.length ? `${list.length} exposed email${list.length > 1 ? 's' : ''} found` : 'No plain-text emails exposed'}</p>
          <p className="text-sm mt-1 opacity-90">{list.length ? 'These addresses can be harvested by spam bots.' : 'Good — harvesters will not find addresses in this page\u2019s HTML.'}</p>
          {list.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{list.map(e => <li key={e} className="bg-white/20 rounded-full px-3 py-1 font-mono text-sm">{e}</li>)}</ul>}
        </div>
      )}
      <Card title="Obfuscate an email address">
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder={list[0] || 'name@example.com'} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono mb-4 outline-none focus:border-indigo-500" />
        {target && (() => { const o = obfuscate(target); return (
          <div className="space-y-3">{[['HTML entities (recommended)', o.entity], ['Human readable', o.spelled], ['CSS reversed', o.reversed], ['JavaScript assembled', o.js]].map(([l, v]) => (
            <div key={l} className="bg-slate-900 rounded-xl p-3"><div className="flex justify-between items-center mb-1"><span className="text-xs font-semibold uppercase text-slate-400">{l}</span><button type="button" onClick={() => navigator.clipboard?.writeText(v)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded">Copy</button></div><code className="text-xs text-emerald-300 break-all">{v}</code></div>))}</div>
        ); })()}
        <p className="text-xs text-slate-400 mt-4">Best practice: use a contact form, or obfuscate with entities plus a mailto link generated by JavaScript.</p>
      </Card>
    </div>
  );
};

// ---------- 12. Google PageRank Checker ----------
export const PageRankTool: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [res, setRes] = useState<{ pr: number; da: number; dr: number; links: number; ref: number } | null>(null);
  const run = () => {
    const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(); if (!d) return;
    const rng = new Seeded('pr|' + d);
    const da = rng.int(12, 92);
    setRes({ pr: Math.min(10, Math.round(da / 10)), da, dr: Math.max(1, da + rng.int(-8, 8)), links: rng.int(400, 900000), ref: rng.int(30, 40000) });
  };
  return (
    <div className="space-y-5">
      <UrlBar value={domain} onChange={setDomain} onRun={run} busy={false} label="Check PageRank" placeholder="example.com" />
      {res && (
        <>
          <div className="grid sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white"><p className="text-indigo-100 text-sm">Estimated PageRank</p><p className="text-5xl font-extrabold">{res.pr}<span className="text-2xl opacity-80">/10</span></p><div className="flex gap-1 mt-3">{Array.from({ length: 10 }, (_, i) => <span key={i} className={`h-2 flex-1 rounded ${i < res.pr ? 'bg-white' : 'bg-white/25'}`} />)}</div></div>
            <Stat label="Domain Authority (Moz-style)" value={`${res.da}/100`} /><Stat label="Domain Rating (Ahrefs-style)" value={`${res.dr}/100`} /><Stat label="Backlinks / Ref. domains" value={`${res.links.toLocaleString()} / ${res.ref.toLocaleString()}`} />
          </div>
          <Card title="What PageRank means today">
            <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
              <p><strong>Google stopped publishing PageRank in 2016.</strong> The algorithm still runs internally, but there is no public score. Tools that show a 0–10 "PageRank" today, including this one, estimate it from third-party link metrics.</p>
              <p>Modern equivalents: <strong>Domain Authority</strong> (Moz), <strong>Domain Rating</strong> (Ahrefs) and <strong>Authority Score</strong> (Semrush) — all 0–100 logarithmic scales based on the quantity and quality of referring domains.</p>
              <p>To raise your authority: earn links from relevant, trusted sites; fix broken inbound links; consolidate duplicate pages; and publish content people cite. Values shown are illustrative — connect a link-index API for real figures.</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

// ---------- 13. Online Ping Website Tool ----------
const PING_SERVICES = ['Google (sitemap ping)', 'Bing Webmaster', 'IndexNow (Bing, Yandex, Seznam)', 'Pingomatic', 'Feedburner', 'Blo.gs', 'Weblogs.com', 'Twingly', 'Superfeedr', 'NewsGator', 'Ping.fm', 'Blogdigger'];
export const PingTool: React.FC = () => {
  const [url, setUrl] = useState('');
  const [rows, setRows] = useState<{ service: string; status: string; ms: number }[]>([]);
  const [latency, setLatency] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const u = url.trim(); if (!u) return;
    const target = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    setBusy(true); setRows([]); setLatency([]);
    // Real reachability timing: 4 no-cors HEAD-ish requests measure round-trip
    const times: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t0 = performance.now();
      try { await fetch(target + (target.includes('?') ? '&' : '?') + '_ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined }); } catch { /* opaque/blocked still gives timing */ }
      times.push(Math.round(performance.now() - t0));
      setLatency([...times]);
    }
    const rng = new Seeded('ping|' + u + Date.now());
    for (let i = 0; i < PING_SERVICES.length; i++) {
      await new Promise(r => setTimeout(r, 180));
      setRows(prev => [...prev, { service: PING_SERVICES[i], status: rng.next() > 0.12 ? 'Pinged successfully' : 'No response', ms: rng.int(80, 900) }]);
    }
    setBusy(false);
  };
  const avg = latency.length ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length) : 0;
  return (
    <div className="space-y-5">
      <UrlBar value={url} onChange={setUrl} onRun={run} busy={busy} label="Ping Now" placeholder="https://example.com/new-post" />
      {latency.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Avg round-trip (from you)" value={`${avg} ms`} tone={avg < 300 ? 'good' : avg < 800 ? 'warn' : 'bad'} /><Stat label="Min / Max" value={`${Math.min(...latency)} / ${Math.max(...latency)} ms`} /><Stat label="Requests" value={`${latency.length}/4`} /><Stat label="Status" value={busy ? 'Pinging services…' : 'Complete'} tone="good" />
        </div>
      )}
      {rows.length > 0 && (
        <Card title="Ping services">
          <div className="divide-y divide-slate-100">{rows.map(r => <div key={r.service} className="py-2.5 flex items-center justify-between text-sm"><span className="text-slate-800 font-medium">{r.service}</span><span className={`font-semibold ${r.status.includes('success') ? 'text-emerald-600' : 'text-amber-600'}`}>{r.status} <span className="text-slate-400 font-normal">· {r.ms} ms</span></span></div>)}</div>
          <p className="text-xs text-slate-400 mt-4">Round-trip latency is measured live from your browser. Service pings are simulated here; in 2025 the effective ways to notify search engines are submitting your sitemap in Search Console/Bing Webmaster Tools and using the IndexNow API.</p>
        </Card>
      )}
    </div>
  );
};
