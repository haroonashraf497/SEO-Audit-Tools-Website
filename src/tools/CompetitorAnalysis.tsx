import React, { useMemo, useState } from 'react';
import { fetchPageData, type LivePageData } from '../utils/pageFetch';
import { fetchDomainInfo, type DomainInfo } from '../utils/domainLookup';
import { SerpCompare } from '../components/SerpPreview';
import { useCms } from '../cms/store';
import { sanitizeRichHtml } from '../utils/sanitize';

type State = 'pass' | 'warning' | 'error';
type Check = { label: string; detail: string; fix: string; state: State };
type Category = { name: string; score: number; checks: Check[] };
type Audit = {
  input: string; url: string; host: string; live: boolean; score: number;
  title: string; description: string; h1s: string[];
  summary: { total: number; errors: number; warnings: number; passed: number };
  categories: Category[];
  metrics: Record<string, number | string>;
  keywords: { term: string; count: number; density: number }[];
  links: { href: string; anchor: string; nofollow: boolean; internal: boolean }[];
};
type CompareRow = { label: string; yours: string | number; theirs: string | number; winner: 'yours' | 'theirs' | 'tie'; result?: string };

const inputClass = 'w-full px-4 py-4 rounded-xl border border-slate-300 bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
const normalise = (url: string) => /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
const hostOf = (url: string) => { try { return new URL(normalise(url)).hostname.replace(/^www\./, ''); } catch { return url; } };
const hash = (value: string) => Array.from(value).reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const randomFor = (value: string) => { let x = hash(value) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967295; }; };
const makeCheck = (label: string, detail: string, fix: string, state: State): Check => ({ label, detail, fix, state });
const score = (checks: Check[]) => Math.round(checks.reduce((n, c) => n + (c.state === 'pass' ? 100 : c.state === 'warning' ? 52 : 12), 0) / checks.length);
const lengthState = (n: number, min: number, max: number): State => !n ? 'error' : n >= min && n <= max ? 'pass' : 'warning';
const STOP_WORDS = new Set('the and for that with this from your you are was were have has had not but all can our their they its into more will about than when what where which who how why a an of to in on at by is it as or be we he she them his her us if so'.split(' '));
const extractKeywords = (page: LivePageData) => {
  const source = [page.title, page.description, page.bodyText].join(' ').toLowerCase();
  const words = source.match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
  const counts = new Map<string, number>();
  words.forEach(word => { if (!STOP_WORDS.has(word) && !/^\d+$/.test(word)) counts.set(word, (counts.get(word) || 0) + 1); });
  const total = Math.max(1, words.length);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([term, count]) => ({ term, count, density: Math.round((count / total) * 1000) / 10 }));
};

const fallback = (url: string): LivePageData => {
  const rnd = randomFor(url);
  const host = hostOf(url);
  const brand = host.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const words = Math.round(400 + rnd() * 1500), images = Math.round(5 + rnd() * 20);
  return {
    ok: true, finalUrl: normalise(url), title: `${brand} | Professional Online Services`,
    description: `Explore ${brand} services, resources and practical online solutions. Compare options and find useful information for your needs.`,
    h1s: [`${brand} Services`], headingCounts: { H1: 1, H2: Math.round(3 + rnd() * 6), H3: Math.round(2 + rnd() * 7), H4: 0, H5: 0, H6: 0 },
    imageCount: images, imagesMissingAlt: Math.round(rnd() * Math.min(5, images)), imagesAltWithKeyword: 1,
    internalLinks: 25, externalLinks: 15, nofollowLinks: 5, internalNofollowLinks: 0, externalNofollowLinks: 5,
    wordCount: words, canonical: normalise(url), favicon: '', charset: true, viewport: rnd() > .12, lang: 'en', robots: 'index, follow',
    ogTitle: rnd() > .2, ogDescription: rnd() > .25, ogImage: rnd() > .35, ogUrl: rnd() > .2, twitterCard: rnd() > .35,
    codeSize: Math.round(55000 + rnd() * 160000), textSize: words * 6, textRatio: Math.round((5 + rnd() * 16) * 10) / 10,
    linksSample: (() => {
      const origin = normalise(url).replace(/\/$/, '');
      const internals = ['Home', 'About', 'Services', 'Contact', 'Blog', 'Pricing', 'FAQ', 'Careers', 'Privacy', 'Terms', 'Support', 'Login', 'Products', 'Case Studies', 'Resources', 'News', 'Team', 'Locations', 'Partners', 'Docs', 'Help', 'Features', 'Customers', 'Integrations', 'Sitemap'].map((anchor, i) => ({
        href: i === 0 ? `${origin}/` : `${origin}/${anchor.toLowerCase().replace(/\s+/g, '-')}/`,
        internal: true, nofollow: false, anchor,
      }));
      const externals = [
        ['Google', 'https://www.google.com/', false],
        ['LinkedIn', 'https://www.linkedin.com/', true],
        ['X', 'https://x.com/', true],
        ['YouTube', 'https://www.youtube.com/', false],
        ['Facebook', 'https://www.facebook.com/', true],
        ['Wikipedia', 'https://www.wikipedia.org/', false],
        ['GitHub', 'https://github.com/', false],
        ['Bing', 'https://www.bing.com/', false],
        ['Instagram', 'https://www.instagram.com/', true],
        ['Reddit', 'https://www.reddit.com/', true],
        ['Crunchbase', 'https://www.crunchbase.com/', false],
        ['Trustpilot', 'https://www.trustpilot.com/', false],
        ['Apple App Store', 'https://apps.apple.com/', false],
        ['Google Play', 'https://play.google.com/', false],
        ['Cloudflare', 'https://www.cloudflare.com/', false],
      ].map(([anchor, href, nofollow]) => ({ href: String(href), internal: false, nofollow: Boolean(nofollow), anchor: String(anchor) }));
      return [...internals, ...externals];
    })(), bodyText: `${brand} professional services online solutions resources information customers business guide support pricing results quality website digital`, html: '', fetchMs: Math.round(250 + rnd() * 1300), scripts: Math.round(5 + rnd() * 24), externalScripts: Math.round(3 + rnd() * 16), stylesheets: Math.round(2 + rnd() * 8), inlineStyles: 1,
    iframes: Math.round(rnd() * 3), forms: 1, emails: [], metaTags: [], linkTags: [], generator: '', hasJsonLd: rnd() > .4, imagesWithoutDimensions: Math.round(rnd() * Math.min(4, images)), smallFontRisk: rnd() > .84,
  };
};

const buildAudit = (input: string, page: LivePageData, live: boolean): Audit => {
  const https = page.finalUrl.startsWith('https://');
  const onPage = [
    makeCheck('Title tag', page.title ? `${page.title.length} characters: ${page.title}` : 'Missing.', 'Use a unique title between 30 and 60 characters.', lengthState(page.title.length, 30, 60)),
    makeCheck('Meta description', page.description ? `${page.description.length} characters.` : 'Missing.', 'Write a compelling description between 120 and 160 characters.', lengthState(page.description.length, 120, 160)),
    makeCheck('H1 heading', `${page.headingCounts.H1} H1 tag(s).`, 'Use exactly one descriptive H1.', page.headingCounts.H1 === 1 ? 'pass' : 'error'),
    makeCheck('Content depth', `${page.wordCount.toLocaleString()} readable words.`, 'Expand thin content with useful information.', page.wordCount >= 600 ? 'pass' : page.wordCount >= 300 ? 'warning' : 'error'),
    makeCheck('Image alt text', `${page.imagesMissingAlt} of ${page.imageCount} images missing alt text.`, 'Add descriptive alt text to meaningful images.', page.imagesMissingAlt === 0 ? 'pass' : page.imagesMissingAlt <= 3 ? 'warning' : 'error'),
    makeCheck('Canonical URL', page.canonical || 'Missing.', 'Add a self-referencing canonical URL.', page.canonical ? 'pass' : 'warning'),
  ];
  const technical = [
    makeCheck('Indexing', `robots: ${page.robots || 'not specified'}`, 'Remove accidental noindex directives.', /noindex/i.test(page.robots) ? 'error' : 'pass'),
    makeCheck('Character set', page.charset ? 'Declared.' : 'Missing.', 'Declare UTF-8 in the document head.', page.charset ? 'pass' : 'warning'),
    makeCheck('Language', page.lang ? `lang=${page.lang}` : 'Missing.', 'Add a valid HTML lang attribute.', page.lang ? 'pass' : 'warning'),
    makeCheck('Structured data', page.hasJsonLd ? 'JSON-LD detected.' : 'No JSON-LD detected.', 'Add relevant schema.org structured data.', page.hasJsonLd ? 'pass' : 'warning'),
    makeCheck('Internal links', `${page.internalLinks} unique internal links.`, 'Add contextual links to important pages.', page.internalLinks >= 5 ? 'pass' : 'warning'),
    makeCheck('Code-to-text ratio', `${page.textRatio}% visible text.`, 'Reduce template bloat and expose useful HTML content.', page.textRatio >= 10 ? 'pass' : page.textRatio >= 5 ? 'warning' : 'error'),
  ];
  const mobile = [
    makeCheck('Viewport', page.viewport ? 'Responsive viewport found.' : 'Missing.', 'Add width=device-width, initial-scale=1.', page.viewport ? 'pass' : 'error'),
    makeCheck('Responsive images', /srcset=/i.test(page.html) ? 'srcset detected.' : 'No srcset detected.', 'Use srcset and sizes for responsive images.', /srcset=/i.test(page.html) ? 'pass' : 'warning'),
    makeCheck('Image dimensions', `${page.imagesWithoutDimensions} images without width/height.`, 'Set dimensions to reduce layout shift.', page.imagesWithoutDimensions === 0 ? 'pass' : 'warning'),
    makeCheck('Font legibility', page.smallFontRisk ? 'Small inline fonts detected.' : 'No tiny inline fonts detected.', 'Keep mobile body text at 16px or above.', page.smallFontRisk ? 'warning' : 'pass'),
  ];
  const security = [
    makeCheck('HTTPS', https ? 'Secure HTTPS response.' : 'HTTP response.', 'Redirect every page to HTTPS.', https ? 'pass' : 'error'),
    makeCheck('Mixed content', https && !/(src|href)=["']http:\/\//i.test(page.html) ? 'No obvious mixed content.' : 'Insecure resources may exist.', 'Load every resource over HTTPS.', https && !/(src|href)=["']http:\/\//i.test(page.html) ? 'pass' : 'warning'),
    makeCheck('Hidden iframes', /<iframe[^>]+(display:\s*none|width=["']?0|height=["']?0)/i.test(page.html) ? 'Hidden iframe detected.' : 'No hidden iframe pattern.', 'Review suspicious embedded frames.', /<iframe[^>]+(display:\s*none|width=["']?0|height=["']?0)/i.test(page.html) ? 'error' : 'pass'),
    makeCheck('Script obfuscation', /eval\(|document\.write\(unescape|fromCharCode/i.test(page.html) ? 'Potentially obfuscated script.' : 'No common pattern found.', 'Remove or review untrusted obfuscated scripts.', /eval\(|document\.write\(unescape|fromCharCode/i.test(page.html) ? 'warning' : 'pass'),
  ];
  const performance = [
    makeCheck('Response time', `${page.fetchMs} ms to fetch HTML.`, 'Use caching, a CDN and faster hosting.', page.fetchMs <= 800 ? 'pass' : page.fetchMs <= 1800 ? 'warning' : 'error'),
    makeCheck('HTML size', `${Math.round(page.codeSize / 1024)} KB.`, 'Remove unused markup and inline code.', page.codeSize <= 100000 ? 'pass' : page.codeSize <= 200000 ? 'warning' : 'error'),
    makeCheck('External scripts', `${page.externalScripts} external scripts.`, 'Delay or remove non-critical third-party scripts.', page.externalScripts <= 8 ? 'pass' : page.externalScripts <= 15 ? 'warning' : 'error'),
    makeCheck('Stylesheets', `${page.stylesheets} stylesheets.`, 'Remove unused CSS and reduce blocking styles.', page.stylesheets <= 5 ? 'pass' : page.stylesheets <= 9 ? 'warning' : 'error'),
    makeCheck('Iframes', `${page.iframes} iframe(s).`, 'Lazy-load below-the-fold embeds.', page.iframes <= 2 ? 'pass' : 'warning'),
  ];
  const categories = [
    { name: 'On-Page SEO', checks: onPage }, { name: 'Technical SEO', checks: technical },
    { name: 'Mobile', checks: mobile }, { name: 'Security', checks: security }, { name: 'Performance', checks: performance },
  ].map(category => ({ ...category, score: score(category.checks) }));
  const all = categories.flatMap(category => category.checks);
  const summary = { total: all.length, errors: all.filter(c => c.state === 'error').length, warnings: all.filter(c => c.state === 'warning').length, passed: all.filter(c => c.state === 'pass').length };
  return {
    input, url: page.finalUrl, host: hostOf(page.finalUrl), live,
    title: page.title, description: page.description, h1s: page.h1s,
    score: Math.round(categories.reduce((n, c) => n + c.score, 0) / categories.length), summary, categories,
    metrics: {
      words: page.wordCount, internal: page.internalLinks, external: page.externalLinks, missingAlt: page.imagesMissingAlt,
      htmlKb: Math.round(page.codeSize / 1024), response: page.fetchMs, titleLen: page.title.length, metaLen: page.description.length,
      h1: page.headingCounts.H1, images: page.imageCount, nofollow: page.nofollowLinks, textRatio: page.textRatio, scripts: page.externalScripts,
    },
    keywords: extractKeywords(page),
    links: page.linksSample.map(link => ({ href: link.href, anchor: link.anchor, nofollow: link.nofollow, internal: link.internal })),
  };
};

const timeout = (ms: number) => new Promise<null>(resolve => window.setTimeout(() => resolve(null), ms));
const getAudit = async (url: string) => { const clean = normalise(url); const live = await Promise.race([fetchPageData(clean).catch(() => null), timeout(12000)]); return buildAudit(url, live || fallback(clean), Boolean(live)); };
const tone = (n: number) => n >= 80 ? 'text-emerald-600' : n >= 60 ? 'text-amber-600' : 'text-red-600';
const stroke = (n: number) => n >= 80 ? '#10b981' : n >= 60 ? '#f59e0b' : '#ef4444';
const scoreLabel = (n: number) => n >= 80 ? 'Strong' : n >= 60 ? 'Needs work' : 'Weak';
const sectionHeading = 'text-xl font-bold text-slate-900';
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = props => <input {...props} className={`${inputClass} ${props.className || ''}`} />;

const AuditOverview: React.FC<{ audit: Audit; label: string; accent: string }> = ({ audit, label, accent }) => (
  <article className="min-w-0">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${accent}`}>{label}</p>
        <h2 className="text-base font-bold text-slate-900 break-all mt-0.5">{audit.host}</h2>
        <p className="text-[11px] text-slate-500 break-all">{audit.url}</p>
      </div>
      <span className={`h-fit text-[10px] font-bold border rounded-full px-2 py-0.5 ${audit.live ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{audit.live ? 'Live HTML' : 'Estimated fallback'}</span>
    </div>
    <div className="flex items-end gap-3 mt-4">
      <p className={`text-5xl font-extrabold leading-none tracking-tight ${tone(audit.score)}`}>{audit.score}</p>
      <div className="pb-0.5">
        <p className="text-sm font-bold text-slate-900">Overall SEO score</p>
        <p className="text-xs text-slate-500">{scoreLabel(audit.score)}</p>
      </div>
    </div>
    <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${audit.score}%`, background: stroke(audit.score) }} />
    </div>
    <div className="grid grid-cols-4 gap-2 mt-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50 px-2 py-2.5 text-center min-w-0">
        <p className="text-lg font-extrabold leading-none text-sky-900">{audit.summary.total}</p>
        <p className="text-[10px] font-semibold text-sky-700 mt-1">Checks</p>
      </div>
      <div className="rounded-xl border border-rose-100 bg-rose-50 px-2 py-2.5 text-center min-w-0">
        <p className="text-lg font-extrabold leading-none text-rose-700">{audit.summary.errors}</p>
        <p className="text-[10px] font-semibold text-rose-700 mt-1">Errors</p>
      </div>
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-2 py-2.5 text-center min-w-0">
        <p className="text-lg font-extrabold leading-none text-amber-700">{audit.summary.warnings}</p>
        <p className="text-[10px] font-semibold text-amber-700 mt-1">Warnings</p>
      </div>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2.5 text-center min-w-0">
        <p className="text-lg font-extrabold leading-none text-emerald-700">{audit.summary.passed}</p>
        <p className="text-[10px] font-semibold text-emerald-700 mt-1">Passed</p>
      </div>
    </div>
    <div className="grid grid-cols-5 gap-2 mt-3">
      {audit.categories.map(c => (
        <div key={c.name} className="rounded-xl border border-slate-100 bg-slate-50 px-1.5 py-2.5 text-center min-w-0">
          <p className={`text-lg font-extrabold leading-none ${tone(c.score)}`}>{c.score}</p>
          <p className="text-[10px] text-slate-500 mt-1 leading-tight truncate">{c.name.replace(' SEO', '')}</p>
          <div className="h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${c.score}%`, background: stroke(c.score) }} />
          </div>
        </div>
      ))}
    </div>
  </article>
);

// Human-readable renewal status derived from the RDAP expiry date.
const expiryStatus = (days: number | null): { text: string; cls: string } => {
  if (days === null) return { text: 'Expiry date unavailable', cls: 'text-slate-400' };
  if (days < 0) return { text: `Expired ${Math.abs(days).toLocaleString()} day${Math.abs(days) === 1 ? '' : 's'} ago`, cls: 'text-red-600' };
  if (days < 30) return { text: `Only ${days.toLocaleString()} day${days === 1 ? '' : 's'} to renewal`, cls: 'text-red-600' };
  if (days < 90) return { text: `${days.toLocaleString()} days to renewal`, cls: 'text-amber-600' };
  return { text: `${days.toLocaleString()} days remaining`, cls: 'text-emerald-600' };
};

const DomainOverview: React.FC<{ info: DomainInfo | null; label: string; accent: string }> = ({ info, label, accent }) => {
  const expiry = expiryStatus(info?.daysToExpiry ?? null);
  const days = info?.daysToExpiry ?? null;
  return (
    <article className="min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${accent}`}>{label}</p>
          <p className="text-sm font-bold text-slate-900 font-mono break-all mt-0.5">{info?.domain || 'Unknown domain'}</p>
        </div>
        {info?.live
          ? <span className="h-fit text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">Registry data</span>
          : <span className="h-fit text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">Unavailable</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 min-w-0">
          <p className="text-[10px] font-semibold text-indigo-700">Registration age</p>
          <p className="text-sm font-extrabold text-slate-900 mt-1 break-words">{info?.ageLabel || 'Unavailable'}</p>
          <p className="text-[11px] text-indigo-700/70 mt-0.5">{info?.registered ? `Created ${info.registered}` : 'Date unavailable'}</p>
        </div>
        <div className={`rounded-xl border px-3 py-3 min-w-0 ${days !== null && days < 30 ? 'border-rose-100 bg-rose-50' : days !== null && days < 90 ? 'border-amber-100 bg-amber-50' : 'border-emerald-100 bg-emerald-50'}`}>
          <p className={`text-[10px] font-semibold ${days !== null && days < 30 ? 'text-rose-700' : days !== null && days < 90 ? 'text-amber-700' : 'text-emerald-700'}`}>Registry expiry</p>
          <p className="text-sm font-extrabold text-slate-900 mt-1 break-words">{info?.expiry || 'Unavailable'}</p>
          <p className={`text-[11px] mt-0.5 ${days !== null && days < 30 ? 'text-rose-700 font-semibold' : expiry.cls}`}>{expiry.text}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 min-w-0">
          <p className="text-[10px] font-semibold text-slate-500">Registrar</p>
          <p className="text-sm font-extrabold text-slate-900 mt-1 break-words">{info?.registrar || 'Unavailable'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{info?.dnssec == null ? 'DNSSEC unknown' : info.dnssec ? 'DNSSEC enabled' : 'DNSSEC not signed'}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 min-w-0">
          <p className="text-[10px] font-semibold text-slate-500">Registry ID</p>
          <p className="text-sm font-extrabold text-slate-900 mt-1 break-all">{info?.registryId || 'Unavailable'}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Updated {info?.updated || '—'}</p>
        </div>
      </div>
      {info?.live && <p className="text-[11px] text-slate-400 mt-3"><a href={`https://lookup.icann.org/en/lookup?name=${encodeURIComponent(info.domain)}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:underline">Verify at ICANN ↗</a></p>}
      {(info?.nameservers.length || info?.statuses.length || info?.error) ? (
        <div className="flex flex-wrap gap-1.5 mt-3 text-[11px]">
          {info?.nameservers.map(ns => <span key={ns} className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-600">{ns}</span>)}
          {info?.statuses.map(status => <span key={status} className="bg-slate-100 rounded px-1.5 py-0.5 text-slate-600">{status}</span>)}
          {info && !info.live && info.error && <span className="text-amber-700">{info.error}</span>}
        </div>
      ) : null}
    </article>
  );
};


const Pair: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid lg:grid-cols-2 gap-6 items-stretch [&>*]:min-w-0 [&>*]:h-full">{children}</div>
);

const StateIcon: React.FC<{ state: State }> = ({ state }) => {
  if (state === 'pass') return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-5" />
    </svg>
  );
  if (state === 'warning') return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 2 20h20L12 3z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
};

const checkTone: Record<State, { card: string; bar: string; icon: string; badge: string; label: string }> = {
  pass: { card: 'bg-emerald-50/70 border-emerald-100', bar: 'bg-emerald-500', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-800', label: 'Pass' },
  warning: { card: 'bg-amber-50/80 border-amber-100', bar: 'bg-amber-500', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-800', label: 'Warning' },
  error: { card: 'bg-rose-50/80 border-rose-100', bar: 'bg-rose-500', icon: 'text-rose-600', badge: 'bg-rose-100 text-rose-800', label: 'Error' },
};

const CheckCard: React.FC<{ item: Check }> = ({ item }) => {
  const t = checkTone[item.state];
  return (
    <article className={`relative rounded-xl border overflow-hidden ${t.card}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} aria-hidden="true" />
      <div className="pl-4 pr-4 py-3.5 flex items-start gap-3">
        <span className={`flex-shrink-0 mt-0.5 ${t.icon}`}><StateIcon state={item.state} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-bold text-slate-900">{item.label}</p>
            <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 flex-shrink-0 ${t.badge}`}>{t.label}</span>
          </div>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed break-words">{item.detail}</p>
          {item.state !== 'pass' && (
            <p className="text-sm text-slate-700 mt-2.5 rounded-lg bg-white/90 border border-white px-3 py-2 leading-relaxed">
              <span className="font-semibold">Fix:</span> {item.fix}
            </p>
          )}
        </div>
      </div>
    </article>
  );
};

const SiteCard: React.FC<{ audit: Audit; label: string }> = ({ audit, label }) => (
  <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4 h-full">
    <div className="flex items-start justify-between gap-3">
      <h3 className={sectionHeading}>{label}</h3>
      <span className={`h-fit text-[10px] font-bold border rounded-full px-2 py-0.5 ${audit.live ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{audit.live ? 'Live HTML' : 'Estimated fallback'}</span>
    </div>
    <p className="text-sm font-semibold text-slate-700 break-all mt-2">{audit.host}</p>
    <p className="text-sm text-slate-500 break-all mt-0.5">{audit.url}</p>
  </div>
);

const PageSnapshot: React.FC<{ audit: Audit }> = ({ audit }) => (
  <section className="bg-white rounded-2xl border border-slate-200 p-6 h-full flex flex-col">
    <h3 className={`${sectionHeading} mb-4`}>Page snapshot</h3>
    <dl className="space-y-4 flex-1">
      <div>
        <dt className="text-xs font-semibold text-slate-500 mb-1.5">Title · {audit.title.length} characters</dt>
        <dd className="text-sm text-slate-800 break-words leading-relaxed">{audit.title || 'No title tag found'}</dd>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <dt className="text-xs font-semibold text-slate-500 mb-1.5">Meta description · {audit.description.length} characters</dt>
        <dd className="text-sm text-slate-800 break-words leading-relaxed">{audit.description || 'No meta description found'}</dd>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <dt className="text-xs font-semibold text-slate-500 mb-1.5">H1 headings · {audit.h1s.length}</dt>
        <dd className="space-y-2">{audit.h1s.length ? audit.h1s.map((h1, i) => <p key={i} className="text-sm text-slate-800 break-words leading-relaxed">{h1}</p>) : <p className="text-sm text-slate-500">No H1 tag found</p>}</dd>
      </div>
    </dl>
  </section>
);

const CategoryPanel: React.FC<{ category: Category }> = ({ category }) => (
  <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col">
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
      <h3 className={sectionHeading}>{category.name}</h3>
      <span className={`text-sm font-bold tabular-nums ${tone(category.score)}`}>{category.score}/100</span>
    </div>
    <div className="p-4 space-y-3 flex-1">
      {category.checks.map(item => <CheckCard key={item.label} item={item} />)}
    </div>
  </section>
);

const KeywordsPanel: React.FC<{ audit: Audit }> = ({ audit }) => {
  const maxKw = Math.max(...audit.keywords.map(k => k.count), 1);
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 h-full flex flex-col">
      <div className="flex items-end justify-between gap-3 mb-5">
        <h3 className={sectionHeading}>Top keywords</h3>
        <span className="text-xs text-slate-500">{audit.keywords.length} terms · {Number(audit.metrics.words).toLocaleString()} words</span>
      </div>
      {audit.keywords.length ? (
        <div className="space-y-3 flex-1">
          {audit.keywords.map(keyword => (
            <div key={keyword.term} className="flex items-center gap-4">
              <span className="w-40 text-sm text-slate-700 truncate" title={keyword.term}>{keyword.term}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(keyword.count / maxKw) * 100}%` }} /></div>
              <span className="w-24 text-right text-xs text-slate-500 tabular-nums">{keyword.count}× · {keyword.density}%</span>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-slate-500">No keyword data available.</p>}
    </section>
  );
};

const LinkPanel: React.FC<{ title: string; links: Audit['links']; toneClass: string }> = ({ title, links, toneClass }) => (
  <div className="rounded-2xl border border-slate-200 overflow-hidden min-w-0 bg-white h-full flex flex-col">
    <div className={`px-5 py-3.5 border-b border-slate-200 ${toneClass}`}>
      <h3 className={sectionHeading}>{title}</h3>
      <p className="text-sm mt-1 opacity-80">{links.length} URL{links.length === 1 ? '' : 's'}</p>
    </div>
    <div className="divide-y divide-slate-100 h-80 overflow-y-auto overscroll-contain">
      {links.length ? links.map((link, index) => (
        <a key={`${link.href}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-800 break-words">{link.anchor || '(no anchor)'}</span>
            <span className="block text-xs font-mono text-slate-400 break-all mt-1">{link.href}</span>
          </span>
          {link.nofollow && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 flex-shrink-0">nofollow</span>}
        </a>
      )) : <p className="px-5 py-6 text-sm text-slate-500">No URLs available.</p>}
    </div>
  </div>
);

const comparison = (a: Audit, b: Audit, da: DomainInfo | null, db: DomainInfo | null): CompareRow[] => {
  const row = (label: string, av: number, bv: number, high = true, suffix = ''): CompareRow => ({ label, yours: `${av.toLocaleString()}${suffix}`, theirs: `${bv.toLocaleString()}${suffix}`, winner: av === bv ? 'tie' : high ? av > bv ? 'yours' : 'theirs' : av < bv ? 'yours' : 'theirs' });
  // Date rows compare registry timestamps from RDAP. `laterWins` picks whether
  // the later or earlier date is the stronger signal (older registration is a
  // mild trust signal; a later expiry means the domain is renewed further out).
  const domainRow = (label: string, av: string, bv: string, aIso: string, bIso: string, laterWins: boolean, winText: string): CompareRow => {
    const aT = aIso ? Date.parse(aIso) : NaN;
    const bT = bIso ? Date.parse(bIso) : NaN;
    const hasBoth = !Number.isNaN(aT) && !Number.isNaN(bT);
    const winner: CompareRow['winner'] = !hasBoth || aT === bT ? 'tie' : laterWins === (aT > bT) ? 'yours' : 'theirs';
    return { label, yours: av || '—', theirs: bv || '—', winner, result: !hasBoth ? 'No data' : winner === 'tie' ? 'Same date' : winText };
  };
  const opt = (label: string, av: number | null | undefined, bv: number | null | undefined, high = true, suffix = ''): CompareRow => {
    if (av == null || bv == null || Number.isNaN(av) || Number.isNaN(bv)) return { label, yours: av == null ? '—' : `${av.toLocaleString()}${suffix}`, theirs: bv == null ? '—' : `${bv.toLocaleString()}${suffix}`, winner: 'tie', result: 'No data' };
    return row(label, av, bv, high, suffix);
  };
  const textRow = (label: string, av: string, bv: string): CompareRow => ({ label, yours: av || '—', theirs: bv || '—', winner: 'tie', result: !av && !bv ? 'No data' : av === bv ? 'Same' : 'Different' });
  return [
    row('Overall score', a.score, b.score),
    ...a.categories.map((c, i) => row(`${c.name} score`, c.score, b.categories[i].score)),
    row('Word count', +a.metrics.words, +b.metrics.words),
    row('Title length', +a.metrics.titleLen, +b.metrics.titleLen),
    row('Meta description length', +a.metrics.metaLen, +b.metrics.metaLen),
    row('H1 count', +a.metrics.h1, +b.metrics.h1, false),
    row('Images', +a.metrics.images, +b.metrics.images),
    row('Internal links', +a.metrics.internal, +b.metrics.internal),
    row('External links', +a.metrics.external, +b.metrics.external),
    row('Nofollow links', +a.metrics.nofollow, +b.metrics.nofollow, false),
    row('Missing alt text', +a.metrics.missingAlt, +b.metrics.missingAlt, false),
    row('Text-to-HTML ratio', +a.metrics.textRatio, +b.metrics.textRatio, true, '%'),
    row('External scripts', +a.metrics.scripts, +b.metrics.scripts, false),
    row('HTML size', +a.metrics.htmlKb, +b.metrics.htmlKb, false, ' KB'),
    row('Response time', +a.metrics.response, +b.metrics.response, false, ' ms'),
    textRow('Current registration age', da?.ageLabel || '', db?.ageLabel || ''),
    opt('Days remaining until expiry', da?.daysToExpiry ?? null, db?.daysToExpiry ?? null, true, ' days'),
    domainRow('Domain registered', da?.registered || '—', db?.registered || '—', da?.registeredIso || '', db?.registeredIso || '', false, 'Older domain'),
    domainRow('Domain expires', da?.expiry || '—', db?.expiry || '—', da?.expiryIso || '', db?.expiryIso || '', true, 'Valid longer'),
    textRow('Registrar', da?.registrar || '', db?.registrar || ''),
    textRow('DNSSEC', da?.dnssec == null ? '' : da.dnssec ? 'Enabled' : 'Not signed', db?.dnssec == null ? '' : db.dnssec ? 'Enabled' : 'Not signed'),
    opt('Nameservers', da?.nameservers.length ?? null, db?.nameservers.length ?? null),
  ];
};

export const CompetitorToolContent: React.FC = () => {
  const { state } = useCms();
  const extraAbout = (() => {
    const html = state.tools.find(t => t.slug === 'competitor-analysis')?.about || '';
    return html.replace(/<[^>]*>/g, '').trim() ? sanitizeRichHtml(html) : '';
  })();
  const [open, setOpen] = useState(0);
  const faqs = [
    ['What does the competitor analysis compare?', 'It compares both pages across on-page SEO, technical signals, mobile readiness, security, performance, keywords, content depth and link structure. Domain registration and expiry dates for both sites come from public RDAP registry data.'],
    ['Does this tool check an entire website?', 'It compares the two exact URLs you enter. For a broader view, test matching templates such as both homepages, both service pages, or both product pages.'],
    ['Why does a report say Estimated fallback?', 'Some websites block browser or CORS access. In that case the tool completes with stable URL-based sample data so the workflow does not fail, and labels the result clearly.'],
    ['Does a higher SEO score guarantee better rankings?', 'No. The score measures important technical and on-page signals. Rankings also depend on relevance, backlinks, brand trust, user intent and competition.'],
    ['How should I use the keyword comparison?', 'Look for meaningful terms your competitor covers that your page misses. Add useful sections where needed, but avoid copying text or stuffing keywords.'],
    ['What should I fix first?', 'Start with red errors, especially missing titles, noindex directives, missing H1 tags, HTTP pages and mobile viewport problems. Then work through warnings.'],
    ['Is the analysis stored?', 'No. Both URLs are processed in the browser session. The tool does not create an account or store a comparison history.'],
  ];
  return <div className="space-y-8 mt-10"><section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">About the tool</p><h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">What is Website Competitor Analysis?</h2><div className="space-y-4 text-slate-600 leading-relaxed mt-4"><p>This tool audits two public web pages with the same checklist, then puts the results next to each other. That makes differences easier to spot than reading two separate reports.</p><p>Use it when a competitor outranks you, when you are planning a new landing page, or when you want a practical benchmark before rewriting content. The report does not copy a competitor’s strategy. It shows where their page is stronger, where yours already leads, and which gaps are worth investigating.</p><p>The comparison covers page titles, descriptions, headings, word count, images, internal and external links, nofollow attributes, responsive signals, security and HTML performance. Keyword frequency is extracted from the visible page copy so you can compare topic coverage without relying on guessed search-volume data.</p>{extraAbout && <div className="rich-text text-slate-600 leading-relaxed mt-4" dangerouslySetInnerHTML={{ __html: extraAbout }} />}</div></section><section className="grid md:grid-cols-2 gap-6"><div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900 mb-4">How to read the comparison report</h2><ol className="space-y-3">{['Compare matching page types. A homepage should be compared with a homepage, not a blog article.', 'Start with the overall and category scores to locate the largest gap.', 'Read the individual checks. Each one explains the finding and the recommended fix.', 'Review keywords for missing subtopics, not phrases to copy.', 'Inspect internal and external URL samples to understand how each page supports navigation and authority.', 'Turn the priority plan into a development or content checklist, then re-run the analysis.'].map((step, index) => <li key={step} className="flex gap-3 text-sm text-slate-600"><span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">{index + 1}</span>{step}</li>)}</ol></div><div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6"><h2 className="text-xl font-bold text-slate-900 mb-4">Benefits</h2><div className="grid gap-3">{[['A fair benchmark', 'Both pages are tested with identical rules, so score differences are easier to interpret.'], ['Clear priorities', 'Errors and warnings become a focused improvement plan instead of a long, unstructured audit.'], ['Better content briefs', 'Keyword and heading comparisons reveal topics and supporting sections that may be missing.'], ['Stronger internal linking', 'URL samples show how each page directs visitors and crawlers to related content.'], ['Faster reviews', 'Marketers, developers and clients can discuss one side-by-side report instead of switching between tools.']].map(([title, text]) => <div key={title} className="bg-white rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="text-xs text-slate-500 mt-1 leading-relaxed">{text}</p></div>)}</div></div></section><section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">Questions</p><h2 className="text-2xl font-extrabold text-slate-900 mb-5">Competitor Analysis FAQs</h2><div className="divide-y divide-slate-100 border-y border-slate-100">{faqs.map(([q, a], index) => <div key={q}><button type="button" onClick={() => setOpen(open === index ? -1 : index)} className="w-full flex items-center justify-between gap-4 text-left py-4"><h3 className="text-sm md:text-base font-bold text-slate-800">{q}</h3><span className={`text-indigo-600 transition-transform ${open === index ? 'rotate-45' : ''}`}>+</span></button>{open === index && <p className="pb-4 pr-8 text-sm text-slate-600 leading-relaxed">{a}</p>}</div>)}</div></section></div>;
};

const CompetitorAnalysis: React.FC = () => {
  const [yours, setYours] = useState(''), [theirs, setTheirs] = useState('');
  const [yourAudit, setYourAudit] = useState<Audit | null>(null), [theirAudit, setTheirAudit] = useState<Audit | null>(null);
  const [yourDomain, setYourDomain] = useState<DomainInfo | null>(null), [theirDomain, setTheirDomain] = useState<DomainInfo | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [status, setStatus] = useState(''), [error, setError] = useState('');
  const run = async () => {
    if (!yours.trim() || !theirs.trim()) { setError('Enter both website URLs.'); return; }
    setBusy(true); setError(''); setProgress(8); setStatus('Auditing both pages and querying domain registries…');
    setYourAudit(null); setTheirAudit(null); setYourDomain(null); setTheirDomain(null);
    const timer = window.setInterval(() => setProgress(v => Math.min(90, v + 4)), 250);
    const [a, b, da, db] = await Promise.all([
      getAudit(yours),
      getAudit(theirs),
      Promise.race([fetchDomainInfo(yours).catch(() => null), timeout(12000)]),
      Promise.race([fetchDomainInfo(theirs).catch(() => null), timeout(12000)]),
    ]);
    window.clearInterval(timer); setProgress(100); setStatus('Comparison report ready.');
    setYourAudit(a); setTheirAudit(b); setYourDomain(da); setTheirDomain(db); setBusy(false);
  };
  const rows = useMemo(() => yourAudit && theirAudit ? comparison(yourAudit, theirAudit, yourDomain, theirDomain) : [], [yourAudit, theirAudit, yourDomain, theirDomain]);
  const gaps = yourAudit?.categories.flatMap(c => c.checks.filter(x => x.state !== 'pass').map(x => ({ ...x, category: c.name }))).sort((a, b) => (a.state === 'error' ? 0 : 1) - (b.state === 'error' ? 0 : 1)) || [];

  if (!yourAudit || !theirAudit) return (
    <div className="space-y-6">
      <section className="text-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 md:p-10 text-white">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-200 mb-3">Side-by-side SEO audit</p>
        <h1 className="text-3xl md:text-4xl font-extrabold">Website Competitor Analysis</h1>
        <p className="max-w-2xl mx-auto text-indigo-100 mt-3">Run two complete audits with the same on-page, technical, mobile, security and performance checks used by the homepage audit.</p>
      </section>
      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Your website</label>
            <Input value={yours} onChange={e => setYours(e.target.value)} placeholder="https://yourwebsite.com/page" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Competitor website</label>
            <Input value={theirs} onChange={e => setTheirs(e.target.value)} placeholder="https://competitor.com/page" />
          </div>
        </div>
        {busy ? (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-slate-600 mb-2"><span>{status}</span><span>{progress}%</span></div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600" style={{ width: `${progress}%` }} /></div>
          </div>
        ) : (
          <button onClick={run} className="w-full mt-5 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold">Compare Both Websites →</button>
        )}
        {error && <p className="text-sm text-red-600 text-center mt-3">{error}</p>}
        <p className="text-xs text-slate-400 text-center mt-3">If a site blocks browser access, a clearly labelled URL-based fallback keeps the comparison working.</p>
      </section>
    </div>
  );

  const yourWins = rows.filter(r => r.winner === 'yours').length, theirWins = rows.filter(r => r.winner === 'theirs').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">SEO Competitor Comparison</h1>
          <p className="text-sm text-slate-500 mt-1">Two full audit reports, side by side.</p>
        </div>
        <button onClick={() => { setYourAudit(null); setTheirAudit(null); setYourDomain(null); setTheirDomain(null); setProgress(0); }} className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold">Compare different URLs</button>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
        <h2 className={`${sectionHeading} mb-5`}>Overall scores</h2>
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 md:divide-x md:divide-slate-100">
          <div className="md:pr-8"><AuditOverview audit={yourAudit} label="Your website" accent="text-indigo-600" /></div>
          <div className="md:pl-8"><AuditOverview audit={theirAudit} label="Competitor" accent="text-violet-600" /></div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h2 className={sectionHeading}>Domain Information</h2>
            <p className="text-xs text-slate-500 mt-0.5">Registration and expiry data from the public RDAP registry.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 md:divide-x md:divide-slate-100">
          <div className="md:pr-8"><DomainOverview info={yourDomain} label="Your website" accent="text-indigo-600" /></div>
          <div className="md:pl-8"><DomainOverview info={theirDomain} label="Competitor" accent="text-violet-600" /></div>
        </div>
      </section>

      <SerpCompare
        left={{ url: yourAudit.url, title: yourAudit.title, description: yourAudit.description, live: yourAudit.live, label: 'Your website' }}
        right={{ url: theirAudit.url, title: theirAudit.title, description: theirAudit.description, live: theirAudit.live, label: 'Competitor' }}
      />

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className={sectionHeading}>Head-to-head comparison</h2>
            <p className="text-xs text-slate-500 mt-0.5">Green values show the stronger result.</p>
          </div>
          <div className="flex gap-2 text-xs font-bold">
            <span className="bg-indigo-50 text-indigo-700 rounded-full px-3 py-1">You win {yourWins}</span>
            <span className="bg-violet-50 text-violet-700 rounded-full px-3 py-1">Competitor wins {theirWins}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[40rem]">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Metric</th>
                <th className="px-5 py-3 font-semibold">Your site</th>
                <th className="px-5 py-3 font-semibold">Competitor</th>
                <th className="px-5 py-3 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label} className={i % 2 ? 'bg-slate-50/50' : 'bg-white'}>
                  <td className="px-5 py-3 font-medium text-slate-700">{r.label}</td>
                  <td className={`px-5 py-3 font-mono break-words ${r.winner === 'yours' ? 'text-emerald-600 font-bold' : 'text-slate-800'}`}>{r.yours}</td>
                  <td className={`px-5 py-3 font-mono break-words ${r.winner === 'theirs' ? 'text-emerald-600 font-bold' : 'text-slate-800'}`}>{r.theirs}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-[11px] font-semibold rounded-full px-2.5 py-1 ${r.winner === 'yours' ? 'bg-indigo-50 text-indigo-700' : r.winner === 'theirs' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{r.result ?? (r.winner === 'yours' ? 'Your site leads' : r.winner === 'theirs' ? 'Competitor leads' : 'Tie')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className={sectionHeading}>Full audit</h2>
        <Pair>
          <SiteCard audit={yourAudit} label="Your website" />
          <SiteCard audit={theirAudit} label="Competitor" />
        </Pair>
        <Pair>
          <PageSnapshot audit={yourAudit} />
          <PageSnapshot audit={theirAudit} />
        </Pair>
        {yourAudit.categories.map((category, i) => (
          <Pair key={category.name}>
            <CategoryPanel category={category} />
            <CategoryPanel category={theirAudit.categories[i]} />
          </Pair>
        ))}
        <Pair>
          <KeywordsPanel audit={yourAudit} />
          <KeywordsPanel audit={theirAudit} />
        </Pair>
        <Pair>
          <LinkPanel title="Internal URLs" links={yourAudit.links.filter(link => link.internal)} toneClass="bg-indigo-50 text-indigo-700" />
          <LinkPanel title="Internal URLs" links={theirAudit.links.filter(link => link.internal)} toneClass="bg-indigo-50 text-indigo-700" />
        </Pair>
        <Pair>
          <LinkPanel title="External URLs" links={yourAudit.links.filter(link => !link.internal)} toneClass="bg-sky-50 text-sky-700" />
          <LinkPanel title="External URLs" links={theirAudit.links.filter(link => !link.internal)} toneClass="bg-sky-50 text-sky-700" />
        </Pair>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className={sectionHeading}>Your priority improvement plan</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">Every failed check, errors first, then warnings.</p>
        {gaps.length ? (
          <div className="space-y-3">
            {gaps.map((g, i) => (
              <article key={`${g.category}-${g.label}`} className={`relative rounded-xl border overflow-hidden pl-4 pr-5 py-4 ${g.state === 'error' ? 'border-rose-100 bg-rose-50/70' : 'border-amber-100 bg-amber-50/80'}`}>
                <span className={`absolute inset-y-0 left-0 w-1 ${g.state === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${g.state === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{i + 1}</span>
                  <span className={`flex-shrink-0 mt-1.5 ${g.state === 'error' ? 'text-rose-600' : 'text-amber-600'}`}><StateIcon state={g.state} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">{g.category}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${g.state === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{g.state === 'error' ? 'Error' : 'Warning'}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{g.label}</h3>
                    <p className="text-sm text-slate-700 mt-2 rounded-lg bg-white/90 px-3 py-2 leading-relaxed"><span className="font-semibold">Fix:</span> {g.fix}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="text-emerald-600 font-semibold">All audited checks passed.</p>}
      </section>
    </div>
  );
};

export default CompetitorAnalysis;
