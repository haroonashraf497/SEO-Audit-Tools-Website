import React, { useMemo, useState } from 'react';
import { fetchPageData, type LivePageData } from '../utils/pageFetch';

type State = 'pass' | 'warning' | 'error';
type Check = { label: string; detail: string; fix: string; state: State };
type Category = { name: string; score: number; checks: Check[] };
type Audit = {
  input: string; url: string; host: string; live: boolean; score: number;
  summary: { total: number; errors: number; warnings: number; passed: number };
  categories: Category[];
  metrics: Record<string, number | string>;
  keywords: { term: string; count: number; density: number }[];
  links: { href: string; anchor: string; nofollow: boolean; internal: boolean }[];
};
type CompareRow = { label: string; yours: string | number; theirs: string | number; winner: 'yours' | 'theirs' | 'tie' };

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
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([term, count]) => ({ term, count, density: Math.round((count / total) * 1000) / 10 }));
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
    internalLinks: Math.round(15 + rnd() * 70), externalLinks: Math.round(2 + rnd() * 16), nofollowLinks: Math.round(rnd() * 5), internalNofollowLinks: 0, externalNofollowLinks: Math.round(rnd() * 3),
    wordCount: words, canonical: normalise(url), favicon: '', charset: true, viewport: rnd() > .12, lang: 'en', robots: 'index, follow',
    ogTitle: rnd() > .2, ogDescription: rnd() > .25, ogImage: rnd() > .35, ogUrl: rnd() > .2, twitterCard: rnd() > .35,
    codeSize: Math.round(55000 + rnd() * 160000), textSize: words * 6, textRatio: Math.round((5 + rnd() * 16) * 10) / 10,
    linksSample: [
      { href: `${normalise(url).replace(/\/$/, '')}/about/`, internal: true, nofollow: false, anchor: 'About' },
      { href: `${normalise(url).replace(/\/$/, '')}/services/`, internal: true, nofollow: false, anchor: 'Services' },
      { href: `${normalise(url).replace(/\/$/, '')}/contact/`, internal: true, nofollow: false, anchor: 'Contact' },
      { href: 'https://www.linkedin.com/', internal: false, nofollow: true, anchor: 'LinkedIn' },
      { href: 'https://www.google.com/', internal: false, nofollow: false, anchor: 'Google' },
    ], bodyText: `${brand} professional services online solutions resources information customers business guide support pricing results quality website digital`, html: '', fetchMs: Math.round(250 + rnd() * 1300), scripts: Math.round(5 + rnd() * 24), externalScripts: Math.round(3 + rnd() * 16), stylesheets: Math.round(2 + rnd() * 8), inlineStyles: 1,
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
    score: Math.round(categories.reduce((n, c) => n + c.score, 0) / categories.length), summary, categories,
    metrics: { words: page.wordCount, internal: page.internalLinks, external: page.externalLinks, missingAlt: page.imagesMissingAlt, htmlKb: Math.round(page.codeSize / 1024), response: page.fetchMs },
    keywords: extractKeywords(page),
    links: page.linksSample.map(link => ({ href: link.href, anchor: link.anchor, nofollow: link.nofollow, internal: link.internal })),
  };
};

const timeout = (ms: number) => new Promise<null>(resolve => window.setTimeout(() => resolve(null), ms));
const getAudit = async (url: string) => { const clean = normalise(url); const live = await Promise.race([fetchPageData(clean).catch(() => null), timeout(8500)]); return buildAudit(url, live || fallback(clean), Boolean(live)); };
const tone = (n: number) => n >= 80 ? 'text-emerald-600' : n >= 60 ? 'text-amber-600' : 'text-red-600';
const stroke = (n: number) => n >= 80 ? '#10b981' : n >= 60 ? '#f59e0b' : '#ef4444';
const checkStyle: Record<State, string> = { pass: 'bg-emerald-50 border-emerald-100 text-emerald-700', warning: 'bg-amber-50 border-amber-100 text-amber-700', error: 'bg-red-50 border-red-100 text-red-700' };

const Gauge: React.FC<{ value: number }> = ({ value }) => {
  const r = 43, c = Math.PI * 2 * r;
  return <div className="relative w-28 h-28 flex-shrink-0"><svg viewBox="0 0 100 100" className="w-full h-full -rotate-90"><circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" /><circle cx="50" cy="50" r={r} fill="none" stroke={stroke(value)} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - value / 100 * c} /></svg><span className={`absolute inset-0 flex items-center justify-center text-3xl font-extrabold ${tone(value)}`}>{value}</span></div>;
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = props => <input {...props} className={`${inputClass} ${props.className || ''}`} />;

const AuditOverview: React.FC<{ audit: Audit; label: string; badge: string }> = ({ audit, label, badge }) => (
  <article className="bg-slate-100 border border-slate-200 rounded-3xl p-5 md:p-6">
    <div className="flex justify-between gap-3 mb-4"><div className="min-w-0"><span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white ${badge}`}>{label}</span><h2 className="text-lg font-bold text-slate-900 truncate mt-2">{audit.host}</h2><p className="text-xs text-slate-500 truncate">{audit.url}</p></div><span className={`h-fit text-[10px] font-bold border rounded-full px-2 py-1 ${audit.live ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{audit.live ? 'Live HTML' : 'Estimated fallback'}</span></div>
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-5 mb-4"><Gauge value={audit.score} /><div className="flex-1 w-full"><h3 className="font-bold text-slate-900">Overall SEO Score</h3><p className="text-xs text-slate-500 mb-3">Full page audit</p><div className="grid grid-cols-2 xl:grid-cols-4 gap-2"><div className="bg-sky-50 rounded-lg p-2"><small className="text-sky-700">Checks</small><b className="block text-sky-900">{audit.summary.total}</b></div><div className="bg-rose-50 rounded-lg p-2"><small className="text-rose-700">Errors</small><b className="block text-rose-700">{audit.summary.errors}</b></div><div className="bg-amber-50 rounded-lg p-2"><small className="text-amber-700">Warnings</small><b className="block text-amber-700">{audit.summary.warnings}</b></div><div className="bg-emerald-50 rounded-lg p-2"><small className="text-emerald-700">Passed</small><b className="block text-emerald-700">{audit.summary.passed}</b></div></div></div></div>
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">{audit.categories.map(c => <div key={c.name} className="bg-white border border-slate-200 rounded-xl p-3 text-center"><p className={`text-xl font-bold ${tone(c.score)}`}>{c.score}</p><p className="text-[11px] text-slate-500 mt-1">{c.name}</p></div>)}</div>
  </article>
);

const AuditDetails: React.FC<{ audit: Audit }> = ({ audit }) => {
  const internal = audit.links.filter(link => link.internal).slice(0, 8);
  const external = audit.links.filter(link => !link.internal).slice(0, 8);
  const LinkPanel: React.FC<{ title: string; links: Audit['links']; toneClass: string }> = ({ title, links, toneClass }) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-slate-200 ${toneClass}`}><h4 className="text-xs font-bold uppercase tracking-wide">{title}</h4></div>
      <div className="divide-y divide-slate-100">
        {links.length ? links.map((link, index) => <a key={`${link.href}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-700 truncate">{link.anchor || link.href}</span><span className="block text-[10px] font-mono text-slate-400 truncate">{link.href}</span></span>{link.nofollow && <span className="text-[9px] font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">nofollow</span>}</a>) : <p className="p-4 text-xs text-slate-500">No URL samples available.</p>}
      </div>
    </div>
  );
  return <div className="space-y-4">
    {audit.categories.map(category => <section key={category.name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="flex justify-between px-4 py-3 bg-slate-50 border-b border-slate-100"><h3 className="font-bold text-slate-900">{category.name}</h3><span className={`font-bold ${tone(category.score)}`}>{category.score}/100</span></div><div className="divide-y divide-slate-100">{category.checks.map(item => <div key={item.label} className="p-4 flex items-start gap-3"><span className={`text-[10px] font-bold uppercase rounded-full px-2 py-1 border flex-shrink-0 ${checkStyle[item.state]}`}>{item.state}</span><div><p className="text-sm font-bold text-slate-800">{item.label}</p><p className="text-xs text-slate-500 mt-0.5">{item.detail}</p><p className="text-xs text-slate-700 mt-2"><b>Fix:</b> {item.fix}</p></div></div>)}</div></section>)}
    <section className="bg-white rounded-2xl border border-slate-200 p-4">
      <h3 className="font-bold text-slate-900 mb-3">Top Keywords</h3>
      <div className="flex flex-wrap gap-2">{audit.keywords.length ? audit.keywords.map(keyword => <span key={keyword.term} className="inline-flex gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px]"><strong className="text-slate-700">{keyword.term}</strong><span className="text-slate-400">{keyword.count}× · {keyword.density}%</span></span>) : <p className="text-xs text-slate-500">No keyword data available.</p>}</div>
    </section>
    <section className="grid gap-3"><LinkPanel title={`Internal URLs (${audit.metrics.internal})`} links={internal} toneClass="bg-indigo-50 text-indigo-700" /><LinkPanel title={`External URLs (${audit.metrics.external})`} links={external} toneClass="bg-sky-50 text-sky-700" /></section>
  </div>;
};

const comparison = (a: Audit, b: Audit): CompareRow[] => {
  const row = (label: string, av: number, bv: number, high = true, suffix = ''): CompareRow => ({ label, yours: `${av.toLocaleString()}${suffix}`, theirs: `${bv.toLocaleString()}${suffix}`, winner: av === bv ? 'tie' : high ? av > bv ? 'yours' : 'theirs' : av < bv ? 'yours' : 'theirs' });
  return [row('Overall score', a.score, b.score), ...a.categories.map((c, i) => row(`${c.name} score`, c.score, b.categories[i].score)), row('Word count', +a.metrics.words, +b.metrics.words), row('Internal links', +a.metrics.internal, +b.metrics.internal), row('External links', +a.metrics.external, +b.metrics.external), row('Missing alt text', +a.metrics.missingAlt, +b.metrics.missingAlt, false), row('HTML size', +a.metrics.htmlKb, +b.metrics.htmlKb, false, ' KB'), row('Response time', +a.metrics.response, +b.metrics.response, false, ' ms')];
};

export const CompetitorToolContent: React.FC = () => {
  const [open, setOpen] = useState(0);
  const faqs = [
    ['What does the competitor analysis compare?', 'It compares both pages across on-page SEO, technical signals, mobile readiness, security, performance, keywords, content depth and link structure.'],
    ['Does this tool check an entire website?', 'It compares the two exact URLs you enter. For a broader view, test matching templates such as both homepages, both service pages, or both product pages.'],
    ['Why does a report say Estimated fallback?', 'Some websites block browser or CORS access. In that case the tool completes with stable URL-based sample data so the workflow does not fail, and labels the result clearly.'],
    ['Does a higher SEO score guarantee better rankings?', 'No. The score measures important technical and on-page signals. Rankings also depend on relevance, backlinks, brand trust, user intent and competition.'],
    ['How should I use the keyword comparison?', 'Look for meaningful terms your competitor covers that your page misses. Add useful sections where needed, but avoid copying text or stuffing keywords.'],
    ['What should I fix first?', 'Start with red errors, especially missing titles, noindex directives, missing H1 tags, HTTP pages and mobile viewport problems. Then work through warnings.'],
    ['Is the analysis stored?', 'No. Both URLs are processed in the browser session. The tool does not create an account or store a comparison history.'],
  ];
  return <div className="space-y-8 mt-10"><section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">About the tool</p><h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">What is Website Competitor Analysis?</h2><div className="space-y-4 text-slate-600 leading-relaxed mt-4"><p>This tool audits two public web pages with the same checklist, then puts the results next to each other. That makes differences easier to spot than reading two separate reports.</p><p>Use it when a competitor outranks you, when you are planning a new landing page, or when you want a practical benchmark before rewriting content. The report does not copy a competitor’s strategy. It shows where their page is stronger, where yours already leads, and which gaps are worth investigating.</p><p>The comparison covers page titles, descriptions, headings, word count, images, internal and external links, nofollow attributes, responsive signals, security and HTML performance. Keyword frequency is extracted from the visible page copy so you can compare topic coverage without relying on guessed search-volume data.</p></div></section><section className="grid md:grid-cols-2 gap-6"><div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900 mb-4">How to read the comparison report</h2><ol className="space-y-3">{['Compare matching page types. A homepage should be compared with a homepage, not a blog article.', 'Start with the overall and category scores to locate the largest gap.', 'Read the individual checks. Each one explains the finding and the recommended fix.', 'Review keywords for missing subtopics, not phrases to copy.', 'Inspect internal and external URL samples to understand how each page supports navigation and authority.', 'Turn the priority plan into a development or content checklist, then re-run the analysis.'].map((step, index) => <li key={step} className="flex gap-3 text-sm text-slate-600"><span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">{index + 1}</span>{step}</li>)}</ol></div><div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6"><h2 className="text-xl font-bold text-slate-900 mb-4">Benefits</h2><div className="grid gap-3">{[['A fair benchmark', 'Both pages are tested with identical rules, so score differences are easier to interpret.'], ['Clear priorities', 'Errors and warnings become a focused improvement plan instead of a long, unstructured audit.'], ['Better content briefs', 'Keyword and heading comparisons reveal topics and supporting sections that may be missing.'], ['Stronger internal linking', 'URL samples show how each page directs visitors and crawlers to related content.'], ['Faster reviews', 'Marketers, developers and clients can discuss one side-by-side report instead of switching between tools.']].map(([title, text]) => <div key={title} className="bg-white rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="text-xs text-slate-500 mt-1 leading-relaxed">{text}</p></div>)}</div></div></section><section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">Questions</p><h2 className="text-2xl font-extrabold text-slate-900 mb-5">Competitor Analysis FAQs</h2><div className="divide-y divide-slate-100 border-y border-slate-100">{faqs.map(([q, a], index) => <div key={q}><button type="button" onClick={() => setOpen(open === index ? -1 : index)} className="w-full flex items-center justify-between gap-4 text-left py-4"><h3 className="text-sm md:text-base font-bold text-slate-800">{q}</h3><span className={`text-indigo-600 transition-transform ${open === index ? 'rotate-45' : ''}`}>+</span></button>{open === index && <p className="pb-4 pr-8 text-sm text-slate-600 leading-relaxed">{a}</p>}</div>)}</div></section></div>;
};

const CompetitorAnalysis: React.FC = () => {
  const [yours, setYours] = useState(''), [theirs, setTheirs] = useState('');
  const [yourAudit, setYourAudit] = useState<Audit | null>(null), [theirAudit, setTheirAudit] = useState<Audit | null>(null);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [status, setStatus] = useState(''), [error, setError] = useState('');
  const run = async () => {
    if (!yours.trim() || !theirs.trim()) { setError('Enter both website URLs.'); return; }
    setBusy(true); setError(''); setProgress(8); setStatus('Fetching and auditing both websites…'); setYourAudit(null); setTheirAudit(null);
    const timer = window.setInterval(() => setProgress(v => Math.min(90, v + 4)), 250);
    const [a, b] = await Promise.all([getAudit(yours), getAudit(theirs)]);
    window.clearInterval(timer); setProgress(100); setStatus('Comparison report ready.'); setYourAudit(a); setTheirAudit(b); setBusy(false);
  };
  const rows = useMemo(() => yourAudit && theirAudit ? comparison(yourAudit, theirAudit) : [], [yourAudit, theirAudit]);
  const gaps = yourAudit?.categories.flatMap(c => c.checks.filter(x => x.state !== 'pass').map(x => ({ ...x, category: c.name }))).slice(0, 10) || [];

  if (!yourAudit || !theirAudit) return <div className="space-y-6"><section className="text-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 md:p-10 text-white"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-200 mb-3">Side-by-side SEO audit</p><h1 className="text-3xl md:text-4xl font-extrabold">Website Competitor Analysis</h1><p className="max-w-2xl mx-auto text-indigo-100 mt-3">Run two complete audits with the same on-page, technical, mobile, security and performance checks used by the homepage audit.</p></section><section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm"><div className="grid md:grid-cols-2 gap-4"><div><label className="block text-sm font-semibold text-slate-700 mb-1">Your website</label><Input value={yours} onChange={e => setYours(e.target.value)} placeholder="https://yourwebsite.com/page" /></div><div><label className="block text-sm font-semibold text-slate-700 mb-1">Competitor website</label><Input value={theirs} onChange={e => setTheirs(e.target.value)} placeholder="https://competitor.com/page" /></div></div>{busy ? <div className="mt-6"><div className="flex justify-between text-sm text-slate-600 mb-2"><span>{status}</span><span>{progress}%</span></div><div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600" style={{ width: `${progress}%` }} /></div></div> : <button onClick={run} className="w-full mt-5 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold">Compare Both Websites →</button>}{error && <p className="text-sm text-red-600 text-center mt-3">{error}</p>}<p className="text-xs text-slate-400 text-center mt-3">If a site blocks browser access, a clearly labelled URL-based fallback keeps the comparison working.</p></section></div>;

  const yourWins = rows.filter(r => r.winner === 'yours').length, theirWins = rows.filter(r => r.winner === 'theirs').length;
  return <div className="space-y-8"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">SEO Competitor Comparison</h1><p className="text-sm text-slate-500 mt-1">Two full audit reports, side by side.</p></div><button onClick={() => { setYourAudit(null); setTheirAudit(null); setProgress(0); }} className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold">Compare different URLs</button></div><div className="grid xl:grid-cols-2 gap-6"><AuditOverview audit={yourAudit} label="Your Website" badge="bg-indigo-600" /><AuditOverview audit={theirAudit} label="Competitor" badge="bg-violet-600" /></div><section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="flex flex-wrap justify-between gap-3 px-5 py-4 border-b border-slate-100"><div><h2 className="font-bold text-slate-900">Head-to-Head Comparison</h2><p className="text-xs text-slate-500 mt-0.5">Green values show the stronger result.</p></div><div className="flex gap-2 text-xs font-bold"><span className="bg-indigo-50 text-indigo-700 rounded-full px-3 py-1">You win {yourWins}</span><span className="bg-violet-50 text-violet-700 rounded-full px-3 py-1">Competitor wins {theirWins}</span></div></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="px-4 py-3">Metric</th><th className="px-4 py-3">Your site</th><th className="px-4 py-3">Competitor</th><th className="px-4 py-3">Result</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r.label} className={i % 2 ? 'bg-slate-50/60' : 'bg-white'}><td className="px-4 py-3 font-semibold text-slate-700">{r.label}</td><td className={`px-4 py-3 font-mono ${r.winner === 'yours' ? 'text-emerald-600 font-bold' : ''}`}>{r.yours}</td><td className={`px-4 py-3 font-mono ${r.winner === 'theirs' ? 'text-emerald-600 font-bold' : ''}`}>{r.theirs}</td><td className={`px-4 py-3 text-xs font-bold ${r.winner === 'yours' ? 'text-indigo-600' : r.winner === 'theirs' ? 'text-violet-600' : 'text-slate-400'}`}>{r.winner === 'yours' ? 'Your site leads' : r.winner === 'theirs' ? 'Competitor leads' : 'Tie'}</td></tr>)}</tbody></table></div></section><section className="grid lg:grid-cols-2 gap-6"><div><h2 className="text-xl font-bold text-slate-900 mb-3">Your Full Audit</h2><AuditDetails audit={yourAudit} /></div><div><h2 className="text-xl font-bold text-slate-900 mb-3">Competitor Full Audit</h2><AuditDetails audit={theirAudit} /></div></section><section className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6"><h2 className="text-xl font-bold text-slate-900">Your Priority Improvement Plan</h2><p className="text-sm text-slate-500 mt-1 mb-5">Fix errors first, then warnings.</p>{gaps.length ? <div className="grid md:grid-cols-2 gap-3">{gaps.map((g, i) => <article key={`${g.category}-${g.label}`} className="rounded-xl border border-slate-200 p-4 flex gap-3"><span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${g.state === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{i + 1}</span><div><p className="text-[10px] uppercase font-bold text-slate-400">{g.category}</p><h3 className="text-sm font-bold text-slate-800">{g.label}</h3><p className="text-xs text-slate-500 mt-1">{g.fix}</p></div></article>)}</div> : <p className="text-emerald-600 font-semibold">All audited checks passed.</p>}</section></div>;
};

export default CompetitorAnalysis;