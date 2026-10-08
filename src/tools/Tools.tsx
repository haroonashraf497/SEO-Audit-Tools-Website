import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  categoryDescriptions, categoryHref, categoryLabel, categoryLabels, categoryStyle, toolTagline, ToolIcon,
  type ToolDef, type ToolCategory,
} from './data';
import { resolveToolCategory, toolCategoriesOf, type CmsToolCategory, useCms } from '../cms/store';
import { hasVisibleRichContent, sanitizeRichHtml } from '../utils/sanitize';
import { TOOLS_PATH, navigate, subscribe, toolCategoryPath } from '../router';
import { buildReport, type SimReport, type RowStatus } from './simulator';
import { fetchPageData } from '../utils/pageFetch';
import { WhatIsMyIp, IpLocationTool, ReverseIpTool, ProxyListTool, ClassCTool } from './IpTools';
import { BacklinkCheckerTool, BacklinkMakerTool, LinksCountTool, LinkTrackerTool, LinkPriceTool, ReciprocalLinkTool, LinkAnalyzerTool, BrokenLinkTool } from './BacklinkTools';
import { PlagiarismChecker } from './PlagiarismChecker';
import { GrammarChecker } from './GrammarChecker';
import { ArticleRewriter } from './ArticleRewriter';
import { SeoScoreTool, MetaAnalyzerTool, OgCheckerTool, SnooperTool, HeadersTool, WpDetectorTool, MobileTestTool, PageSpeedTool, PageSizeTool, SafetyTool, EmailPrivacyTool, PageRankTool, PingTool } from './WebTools';
import { QrTool, HtaccessTool, OgGeneratorTool, TwitterCardTool, UrlCodecTool, AdsenseTool, UrlRewriteTool, HitCounterTool, ScreenSimTool, ScreenshotTool, SpeedTestTool, ShortenerTool, SuggestTool, VideoInfoTool } from './WebGenerators';
import { AgeCalc, AvgCalc, CICalc, GstCalc, MarginCalc, PctCalc, ProbCalc, TaxCalc, LtvCalc, DiscountCalc, CpmCalc, PaypalCalc, EpsCalc, BmiCalc } from './CalculatorTools';
import { UnitConverter, LengthConverter, TempConverter, TimezoneConverter, PressureConverter, VoltageConverter, PowerConverter, SpeedConverter, AreaConverter, WeightConverter } from './ConverterTools';
import { SitemapGeneratorTool } from './SitemapGenerator';
import { HtmlFormatterTool, XmlFormatterTool, PhpFormatterTool, HtmlEditorTool, HtmlViewerTool } from './CodeTools';
import { Sidebar } from './Sidebar';
import { PdfGuide } from './pdf/PdfGuide';
import { ToolRelatedContent } from './toolContent';
import { RouteBoundary } from '../components/ErrorBoundary';
import { MergePdf, SplitPdf, RotatePdf, LockPdf, UnlockPdf, CompressPdf } from './pdf/PdfTools';
import { TextToPdf, WordToPdf, PdfToWord, PdfToJpg, JpgToPdf, PptToPdf, ExcelToPdf } from './pdf/ConvertTools';

// PDF tool UIs are plain static imports too — they are part of the single-file
// build, so a PDF tool page renders in the same commit as any other route with
// no spinner in between. The PDF *libraries* (pdf-lib, pdf.js) still load from
// their CDN on demand inside the tool, which is what the in-tool progress bar
// reports; the page itself is never blank.
type AnyComp = React.ComponentType<Record<string, unknown>>;
const PDF_COMPONENTS: Record<string, AnyComp> = {
  MergePdf, SplitPdf, RotatePdf, LockPdf, UnlockPdf, CompressPdf,
  TextToPdf, WordToPdf, PdfToWord, PdfToJpg, JpgToPdf, PptToPdf, ExcelToPdf,
};
const pickEngine = (name: string): AnyComp | null => PDF_COMPONENTS[name] || null;
const PDF_ENGINES: Record<string, ['pdf' | 'convert', string]> = {
  'pdf-merge': ['pdf', 'MergePdf'], 'pdf-split': ['pdf', 'SplitPdf'], 'pdf-rotate': ['pdf', 'RotatePdf'], 'pdf-lock': ['pdf', 'LockPdf'], 'pdf-unlock': ['pdf', 'UnlockPdf'], 'pdf-compress': ['pdf', 'CompressPdf'],
  'text-to-pdf': ['convert', 'TextToPdf'], 'word-to-pdf': ['convert', 'WordToPdf'], 'pdf-to-word': ['convert', 'PdfToWord'], 'pdf-to-jpg': ['convert', 'PdfToJpg'], 'jpg-to-pdf': ['convert', 'JpgToPdf'], 'ppt-to-pdf': ['convert', 'PptToPdf'], 'excel-to-pdf': ['convert', 'ExcelToPdf'],
};
const PdfSwitch: React.FC<{ engine: string }> = ({ engine }) => {
  const isTarget = engine.startsWith('pdf-compress-');
  const entry = isTarget ? PDF_ENGINES['pdf-compress'] : PDF_ENGINES[engine];
  if (!entry) return null;
  const C = pickEngine(entry[1]);
  if (!C) return null;
  const props = isTarget ? { targetKb: Number(engine.split('-').pop()) } : {};
  return (
    <RouteBoundary key={engine} label={`PDF tool ${engine}`}>
      <C {...props} />
      <PdfGuide engine={engine} />
    </RouteBoundary>
  );
};
import { WorkingEngine, PrimaryBtn, MetaGen, RobotsGen, ImageTool, ImageToText } from './engines';
import { DomainAgeTool, DomainAuthorityTool, DomainIpTool, DomainHostingTool, DnsRecordsTool, DomainSearchTool, BlacklistTool, ExpiredDomainsTool } from './DomainTools';
import { KeywordRankTool, KeywordDensityTool, KeywordSuggestionsTool, WebsiteKeywordsTool, KeywordDomainsTool, RelatedKeywordsTool, LongTailTool, CompetitionTool } from './KeywordTools';
import {
  ArchiveCheckerTool, WhoisCheckerTool, MozRankTool, PageAuthorityTool, IndexCheckerTool,
  TrafficRankTool, RedirectCheckerTool, SimilarPageTool, CloakingCheckerTool, MalwareCheckerTool,
  GzipCheckerTool, SslCheckerTool, ServerStatusTool, RatioTool, RankCompareTool,
  PageCompareTool, SpiderSimTool, ComparisonSearchTool, PokemonProbeTool, BlogFinderTool,
  AppsRankTool, SocialStatsTool,
} from './CheckerTools';

// ---------- Status dot ----------
const statusStyle: Record<RowStatus, { dot: string; text: string; label: string }> = {
  good: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Passed' },
  warn: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Warning' },
  bad: { dot: 'bg-red-500', text: 'text-red-700', label: 'Problem' },
  info: { dot: 'bg-slate-400', text: 'text-slate-700', label: 'Info' },
};

const ReportView: React.FC<{ report: SimReport }> = ({ report }) => (
  <div className="animate-fade-in">
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
      <h3 className="heading-card text-lg font-bold text-slate-900 mb-1 break-all">{report.headline}</h3>
      <p className="text-sm text-slate-500 mb-5">{report.summary}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {report.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusStyle[row.status].dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">{row.label}</p>
              <p className={`text-sm font-bold truncate ${statusStyle[row.status].text}`}>{row.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
    {report.table && (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                {report.table.headers.map(h => <th key={h} className="text-left px-4 py-3 font-bold text-slate-500 text-xs uppercase whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {report.table.rows.map((cells, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {cells.map((c, j) => {
                    const isStatus = /Hard|Medium|Easy/.test(c);
                    return (
                      <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'text-slate-800 font-medium' : 'text-slate-600'} ${isStatus ? (c.startsWith('Hard') ? 'text-red-600 font-semibold' : c.startsWith('Medium') ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold') : ''} whitespace-nowrap`}>
                        {c}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);

// ---------- Simulated lookup with progress ----------
const LookupRunner: React.FC<{ tool: ToolDef; initial?: string }> = ({ tool, initial = '' }) => {
  const [value, setValue] = useState(initial);
  const [value2, setValue2] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<SimReport | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) cancelAnimationFrame(timer.current); }, []);

  const LIVE_SLUGS = ['spider-simulator', 'code-to-text-ratio-checker'];
  const run = async (override?: string) => {
    const v = (override ?? value).trim();
    if (!v) return;
    setRunning(true); setReport(null); setProgress(0);
    // Real page fetch (single request) for tools that can use live HTML
    const liveP = LIVE_SLUGS.includes(tool.slug)
      ? fetchPageData(/^https?:\/\//i.test(v) ? v : `https://${v}`).catch(() => null)
      : Promise.resolve(null);
    const start = performance.now();
    const animate = new Promise<void>(resolve => {
      const tick = (now: number) => {
        const p = Math.min(92, ((now - start) / 1500) * 92);
        setProgress(Math.floor(p));
        if (p < 92) timer.current = requestAnimationFrame(tick);
        else resolve();
      };
      timer.current = requestAnimationFrame(tick);
    });
    await animate;
    const live = await Promise.race([liveP, new Promise<null>(res => setTimeout(() => res(null), 8000))]);
    setProgress(100);
    setReport(buildReport(tool.slug, v, value2, live));
    setRunning(false);
  };

  const isUrlLike = tool.input === 'url' || tool.input === 'domain';

  if (tool.input === 'image') {
    return (
      <div>
        <label className="block border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors mb-4">
          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setValue(f.name); run(f.name); } }} />
          <p className="text-slate-600 font-medium">{value || 'Choose an image to extract text from'}</p>
          <p className="text-xs text-slate-400 mt-1">JPG, PNG or screenshot</p>
        </label>
        {running && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-600 mb-2"><span>Reading image…</span><span>{progress}%</span></div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600" style={{ width: `${progress}%` }} /></div>
          </div>
        )}
        {report && <ReportView report={report} />}
      </div>
    );
  }

  const inputEl = tool.input === 'text' ? (
    <textarea value={value} onChange={e => setValue(e.target.value)} placeholder={tool.placeholder} rows={8}
      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono" />
  ) : (
    <input
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && run()}
      placeholder={tool.placeholder || (isUrlLike ? 'example.com' : 'Enter a keyword...')}
      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
    />
  );

  return (
    <div>
      <div className={`grid ${tool.input === 'twotext' ? 'sm:grid-cols-2' : ''} gap-3 mb-4`}>
        {inputEl}
        {tool.input === 'twotext' && (
          <input
            value={value2}
            onChange={e => setValue2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder={tool.placeholder2 || 'Second value...'}
            className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
          />
        )}
      </div>
      <PrimaryBtn type="button" onClick={() => run()} disabled={running || !value.trim()} className="mb-5">
        {running ? 'Analyzing...' : `Check ${tool.name.replace(/ Checker?$/, '').replace(/ Tool$/, '')}`}
      </PrimaryBtn>

      {running && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>Running checks…</span><span>{progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {report && <ReportView report={report} />}
      {report && (
        <p className="text-xs text-slate-400 mt-4 text-center">
          Demo results for illustration. Connect live APIs (whois, DNS, index data) in production for real values.
        </p>
      )}
    </div>
  );
};

// ---------- Live text engine runner ----------
const TextRunner: React.FC<{ tool: ToolDef }> = ({ tool }) => {
  const [text, setText] = useState('');
  const [text2, setText2] = useState('');
  const textarea = tool.input === 'keyword' ? (
    <input
      value={text}
      onChange={e => setText(e.target.value)}
      placeholder={tool.placeholder}
      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm mb-4"
    />
  ) : (
    <textarea
      value={text}
      onChange={e => setText(e.target.value)}
      placeholder={tool.placeholder}
      rows={9}
      spellCheck={false}
      className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono mb-4"
    />
  );
  if (tool.input === 'twotext') {
    return (
      <div>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder={tool.placeholder} rows={8} className="w-full p-4 rounded-xl border border-slate-300 outline-none text-sm font-mono" />
          <textarea value={text2} onChange={e => setText2(e.target.value)} placeholder={tool.placeholder2} rows={8} className="w-full p-4 rounded-xl border border-slate-300 outline-none text-sm font-mono" />
        </div>
        <WorkingEngine slug={tool.slug} input={text} input2={text2} />
      </div>
    );
  }
  return (
    <div>
      {textarea}
      <WorkingEngine slug={tool.slug} input={text} input2="" />
    </div>
  );
};

// ---------- What is my Browser (instant, no request) ----------
const BrowserInfo: React.FC = () => {
  const info = useMemo(() => {
    if ( typeof navigator === 'undefined') return [];
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/opr\//i.test(ua)) browser = 'Opera';
    else if (/chrome|crios/i.test(ua) && !/edg|opr/i.test(ua)) browser = 'Google Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    const ver = ua.match(/(edg|opr|chrome|firefox|fxios|version)\/?\s*([\d.]+)/i);
    const os = /windows nt 10/i.test(ua) ? 'Windows 10/11'
      : /windows nt 6\.3/i.test(ua) ? 'Windows 8.1'
      : /mac os x/i.test(ua) ? 'macOS'
      : /android/i.test(ua) ? 'Android'
      : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : 'Unknown';
    return [
      ['Browser', browser],
      ['Version', ver ? ver[2] : 'Unknown'],
      ['Operating System', os],
      ['User Agent', ua],
      ['Screen Resolution', `${window.screen.width} × ${window.screen.height}`],
      ['Viewport', `${window.innerWidth} × ${window.innerHeight}`],
      ['Color Depth', `${window.screen.colorDepth}-bit`],
      ['Language', navigator.language],
      ['Languages', (navigator.languages || []).join(', ')],
      ['Cookies Enabled', navigator.cookieEnabled ? 'Yes' : 'No'],
      ['JavaScript Enabled', 'Yes'],
      ['Online', navigator.onLine ? 'Yes' : 'No'],
      ['Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'],
      ['Device Pixel Ratio', String(window.devicePixelRatio || 1)],
      ['Touch Support', 'ontouchstart' in window ? 'Yes' : 'No'],
      ['Platform', (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || 'Unknown'],
    ] as [string, string][];
  }, []);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {info.map(([label, val]) => (
        <div key={label} className="flex items-start gap-4 px-5 py-3">
          <span className="w-44 flex-shrink-0 text-sm font-semibold text-slate-500">{label}</span>
          <span className="text-sm text-slate-800 break-all font-mono">{val}</span>
        </div>
      ))}
      <div className="px-5 py-3 bg-emerald-50">
        <span className="text-sm font-semibold text-emerald-700">Detected instantly in your browser — nothing was sent to a server.</span>
      </div>
    </div>
  );
};

// ---------- Domain availability ----------
// ---------- Tools listing page ----------
/** Card and heading type scale, exactly as specified by the design:
 *  category heading 1.35rem, tool name 1rem. */
const CATEGORY_HEADING_SIZE = { fontSize: '1.35rem' } as const;
const TOOL_NAME_SIZE = { fontSize: '1rem' } as const;

/** The search term is the only filter that lives in the query string now:
 *  a category is a real page with its own URL (/ip-tools), so `?cat=` no longer
 *  exists — the router moves it onto the category page before the first paint. */
const readSearchParams = () => {
  const p = new URLSearchParams(window.location.search);
  return p.get('q') || '';
};

/**
 * Tool directory. Rendered twice:
 *  • `/free-seo-tools` — every category, grouped into sections (the index)
 *  • `/<category-slug>` (e.g. /ip-tools) — one category, via the `category`
 *    prop, with its own canonical URL, heading and description.
 * Search filters within whichever page is open and stays in ?q=.
 */
/**
 * Tool directory. Rendered three ways:
 *  • `/free-seo-tools` — every category, grouped into sections (the index)
 *  • `/<category-slug>` (e.g. /ip-tools) — one built-in category, via the
 *    `category` prop, with its own canonical URL, heading and description
 *  • `/tools/category/<slug>` — any category by slug, via `categorySlug`,
 *    including the ones added in Admin → Tool Categories (a built-in category
 *    answering there keeps its original page as the canonical URL)
 * Names, slugs, descriptions and the order of the sections all come from the
 * managed list, so an edit in the admin shows up here immediately.
 * Search filters within whichever page is open and stays in ?q=.
 */
export const ToolsList: React.FC<{ category?: ToolCategory; categorySlug?: string }> = ({ category, categorySlug }) => {
  const { state: cmsState } = useCms();
  const tools = useMemo<ToolDef[]>(() => cmsState.tools.filter(t => t.status === 'live') as unknown as ToolDef[], [cmsState.tools]);
  // The managed category this page is about — undefined on the index.
  const active = useMemo<CmsToolCategory | undefined>(
    () => (category || categorySlug ? resolveToolCategory(cmsState, categorySlug || category || '') : undefined),
    [cmsState, category, categorySlug],
  );
  const activeKey = active?.key || category || '';
  const activeName = active?.name || (category ? categoryLabels[category] : '');
  // While searching, stay on the URL the visitor arrived on.
  const basePath = categorySlug ? toolCategoryPath(categorySlug) : category ? categoryHref(category) : TOOLS_PATH;
  const [query, setQuery] = useState(readSearchParams);

  // React to sidebar searches / breadcrumb links while a tools page is open
  useEffect(() => {
    const onRoute = () => setQuery(readSearchParams());
    return subscribe(onRoute);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category, categorySlug]);

  const filtered = useMemo(() => tools.filter(t =>
    (!activeKey || t.category === activeKey) &&
    (t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase()))
  ), [query, activeKey, tools]);

  const grouped = useMemo(() => {
    const map = new Map<string, ToolDef[]>();
    filtered.forEach(t => {
      const arr = map.get(t.category) || [];
      arr.push(t); map.set(t.category, arr);
    });
    return map;
  }, [filtered]);

  /**
   * The sections this page shows: every managed category in admin order, plus
   * any category a tool still points at, so a tool can never fall off the site.
   */
  const sections = useMemo<CmsToolCategory[]>(() => {
    const managed = toolCategoriesOf(cmsState);
    const known = new Set(managed.map(c => c.key));
    const strays = [...new Set(filtered.map(t => t.category))]
      .filter(key => !known.has(key))
      .map(key => ({ id: `stray-${key}`, key, name: categoryLabel(key), slug: key, description: '', builtin: false }));
    return [...managed, ...strays];
  }, [cmsState, filtered]);

  // Keep the URL in step with the search term so a filtered view is shareable
  // and survives reload. replaceState: searching is not navigation.
  const syncUrl = useCallback((q: string) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    navigate(qs ? `${basePath}?${qs}` : basePath, { replace: true });
  }, [basePath]);

  const onQueryChange = useCallback((q: string) => { setQuery(q); syncUrl(q); }, [syncUrl]);
  // "Show all N tools" — leaves a category page for the index.
  const clearFilters = useCallback(() => { setQuery(''); navigate(TOOLS_PATH); }, []);

  // A category URL whose category no longer exists (removed in the admin).
  if ((category || categorySlug) && !active) {
    return (
      <div className="pt-16 pb-20 px-4 text-center min-h-screen">
        <div className="max-w-xl mx-auto">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-3">Tools</p>
          <h1 className="font-bold text-slate-900 mb-4">Category not found</h1>
          <p className="text-slate-600 mb-8">That tool category is not available. Browse the free SEO tools directory instead.</p>
          <a href={TOOLS_PATH} className="inline-block px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">Browse all free SEO tools</a>
        </div>
      </div>
    );
  }

  // A category can be published before it has any tools in it.
  const categoryIsEmpty = !!activeKey && tools.every(t => t.category !== activeKey);

  const activeSubtitle = active
    ? active.builtin
      ? `${categoryDescriptions[active.key as ToolCategory]} Every tool is free, needs no sign-up and most run instantly in your browser.`
      : 'Every tool is free, needs no sign-up and most run instantly in your browser.'
    : '';

  return (
    <div className="pb-20 min-h-screen">
      {/* Hero band — same background as the home page hero */}
      <section className="pt-16 pb-16 px-4 bg-gradient-to-br from-indigo-100 via-violet-50 to-purple-100">
        <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          {activeKey ? (
            <>
              <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-3">
                <a href="/free-seo-tools" className="text-indigo-600 hover:text-indigo-700">{tools.length} free SEO tools</a>
                <span className="mx-2 text-slate-400" aria-hidden="true">/</span>
                <span className="text-slate-600">{activeName}</span>
              </nav>
              <h1 className="capitalize font-bold text-slate-900 mb-4">
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{activeName}</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                {activeSubtitle}
              </p>
            </>
          ) : (
            <>
              <h1 className="capitalize font-bold text-slate-900 mb-4">
                Free{' '}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SEO Tools</span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                {tools.length}+ free tools for text analysis, keyword research, backlinks, website management,
                security checks and domains. No sign-up, most run instantly in your browser.
              </p>
            </>
          )}
        </header>

        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              type="search"
              aria-label="Search tools"
              placeholder={activeKey ? `Search ${activeName}…` : 'Search tools… e.g. plagiarism, sitemap, SSL'}
              className="w-full pl-12 pr-11 py-3.5 rounded-xl border border-slate-300 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
        </div>
      </section>

      <div className="px-4 pt-10">
        <div className="max-w-7xl mx-auto">
        <div className="min-h-[1.5rem] mb-6 text-center" aria-live="polite">
          {(query.trim() || activeKey) && (
            <p className="text-sm text-slate-500">
              Showing <strong className="text-slate-700">{filtered.length}</strong> of {tools.length} tools
              {activeKey && <> in {activeName}</>}

              {query.trim() && <> matching “{query.trim()}”</>}
              {' · '}
              <button
                type="button"
                onClick={clearFilters}
                className="text-indigo-600 hover:text-indigo-700 underline decoration-indigo-300 underline-offset-2 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Show all {tools.length} tools
              </button>
            </p>
          )}
        </div>

        {sections.map(cat => {
          const list = grouped.get(cat.key);
          if (!list?.length) return null;
          return (
            <section key={cat.key} className="mb-12">
              <div className="flex items-center gap-3 mb-3">
                {/* On the index the heading opens that category's own page; on a
                    category page it is the current page, so it stays plain text. */}
                {activeKey ? (
                  <>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center border ${categoryStyle(cat.key)}`}>
                      <ToolIcon category={cat.key} />
                    </span>
                    {/* The H1 above already names the category, so the section
                        heading labels the list instead of repeating it. */}
                    <h2 className="heading-card font-bold text-slate-900" style={CATEGORY_HEADING_SIZE}>All {cat.name}</h2>
                  </>
                ) : (
                  <a
                    href={cat.builtin ? `/${cat.slug}` : toolCategoryPath(cat.slug)}
                    className="group/heading flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center border ${categoryStyle(cat.key)}`}>
                      <ToolIcon category={cat.key} />
                    </span>
                    <h2 className="heading-card font-bold text-slate-900 group-hover/heading:text-indigo-600 transition-colors" style={CATEGORY_HEADING_SIZE}>{cat.name}</h2>
                  </a>
                )}
                <span className="text-sm text-slate-400">({list.length})</span>
              </div>
              {/* SEO introduction for this category — the copy search engines read
                  on the category URL, shown on the index and on its own page.
                  Managed in Admin → Tool Categories. */}
              {cat.description && <p className="text-[15px] sm:text-base text-slate-600 leading-relaxed mb-6">{cat.description}</p>}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {list.map(t => (
                  <a key={t.slug} href={`/${t.slug}`}
                    className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all flex flex-col">
                    <h3 className="heading-card font-bold text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors" style={TOOL_NAME_SIZE}>{t.name}</h3>
                    {/* line-clamp-2 + a reserved two-line height: every card shows the
                        same two-line description block, whatever the tagline length. */}
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 min-h-[2.5rem]">{toolTagline(t)}</p>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
        {/* Admin-managed rich content for this category page — the "Content
            Below Tools" editor in Admin → Tool Categories → Edit, which is its
            only editor. Rendered after the last tool grid and before
            the footer, on the page's own width, so it lines up with the cards
            above it. Sanitised like every other CMS string; an empty box renders
            nothing at all — no wrapper, no gap. */}
        {hasVisibleRichContent(active?.content) && (
          <section className="mb-12 w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <div className="rich-text" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(active?.content || '') }} />
          </section>
        )}
        {filtered.length === 0 && categoryIsEmpty && !query.trim() && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg font-semibold mb-1">No tools in this category yet</p>
            <p className="text-sm mb-5">Every other tool in the directory is still one click away.</p>
            <a href={TOOLS_PATH} className="inline-block px-5 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">Browse all {tools.length} free tools</a>
          </div>
        )}
        {filtered.length === 0 && !(categoryIsEmpty && !query.trim()) && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg font-semibold mb-1">No tools found</p>
            <p className="text-sm mb-5">Try a different search term or category.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-block px-5 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Clear search &amp; filters
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

// ---------- Single tool page ----------
export const ToolPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { state: cmsState } = useCms();
  const tool = useMemo(() => {
    const t = cmsState.tools.find(x => x.slug === slug && x.status === 'live');
    return (t || null) as unknown as ToolDef | null;
  }, [cmsState.tools, slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tool]);

  if (!tool) {
    return (
      <div className="pt-16 pb-20 px-4 text-center min-h-screen">
        <h1 className="font-bold text-slate-900 mb-4">Tool not found</h1>
        <a href="/free-seo-tools" className="text-indigo-600 font-semibold hover:underline">Browse all tools</a>
      </div>
    );
  }

  const related = useMemo(() => (cmsState.tools.filter(t => t.category === tool.category && t.slug !== tool.slug && t.status === 'live') as unknown as ToolDef[]).slice(0, 3), [cmsState.tools, tool]);

  const renderBody = () => {
    if (tool.slug === 'plagiarism-checker') return <PlagiarismChecker />;
    if (tool.slug === 'grammar-checker') return <GrammarChecker />;
    if (tool.slug === 'article-rewriter') return <ArticleRewriter />;
    if (tool.category === 'pdf' && tool.engine) return <PdfSwitch engine={tool.engine} />;
    // Website management: engine-keyed dispatch
    switch (tool.engine) {
      case 'wm-seoscore': return <SeoScoreTool />;
      case 'wm-metaanalyze': return <MetaAnalyzerTool />;
      case 'wm-ogcheck': return <OgCheckerTool />;
      case 'wm-snooper': return <SnooperTool />;
      case 'wm-headers': return <HeadersTool />;
      case 'wm-wpdetect': return <WpDetectorTool />;
      case 'wm-mobile': return <MobileTestTool />;
      case 'wm-speed': return <PageSpeedTool />;
      case 'wm-pagesize': return <PageSizeTool />;
      case 'wm-antivirus': return <SafetyTool />;
      case 'wm-emailprivacy': return <EmailPrivacyTool />;
      case 'wm-pagerank': return <PageRankTool />;
      case 'wm-ping': return <PingTool />;
      case 'wm-qr': return <QrTool />;
      case 'wm-htaccess': return <HtaccessTool />;
      case 'wm-oggen': return <OgGeneratorTool />;
      case 'wm-twittercard': return <TwitterCardTool />;
      case 'wm-urlencode': return <UrlCodecTool />;
      case 'wm-adsense': return <AdsenseTool />;
      case 'wm-urlrewrite': return <UrlRewriteTool />;
      case 'wm-hitcounter': return <HitCounterTool />;
      case 'wm-screensim': return <ScreenSimTool />;
      case 'wm-screenshot': return <ScreenshotTool />;
      case 'wm-speedtest': return <SpeedTestTool />;
      case 'wm-shortener': return <ShortenerTool />;
      case 'wm-suggest': return <SuggestTool />;
      case 'wm-video': return <VideoInfoTool slug={tool.slug} />;
      case 'wm-format-html': return <HtmlFormatterTool />;
      case 'wm-format-xml': return <XmlFormatterTool />;
      case 'wm-format-php': return <PhpFormatterTool />;
      case 'wm-htmleditor': return <HtmlEditorTool />;
      case 'wm-htmlviewer': return <HtmlViewerTool />;
    }
    if (tool.slug === 'meta-tag-generator') return <MetaGen />;
    if (tool.slug === 'robots-txt-generator') return <RobotsGen />;
    if (tool.slug === 'backlink-maker') return <BacklinkMakerTool />;
    if (tool.slug === 'backlink-checker') return <BacklinkCheckerTool />;
    if (tool.slug === 'website-links-count-checker') return <LinksCountTool />;
    if (tool.slug === 'link-tracker') return <LinkTrackerTool />;
    if (tool.slug === 'link-price-calculator') return <LinkPriceTool />;
    if (tool.slug === 'reciprocal-link-checker') return <ReciprocalLinkTool />;
    if (tool.slug === 'website-link-analyzer-tool') return <LinkAnalyzerTool />;
    if (tool.slug === 'websites-broken-link-checker') return <BrokenLinkTool />;
    if (tool.slug === 'domain-age-checker') return <DomainAgeTool />;
    if (tool.slug === 'domain-authority-checker') return <DomainAuthorityTool />;
    if (tool.slug === 'domain-ip-lookup') return <DomainIpTool />;
    if (tool.slug === 'domain-hosting-checker') return <DomainHostingTool />;
    if (tool.slug === 'find-dns-records') return <DnsRecordsTool />;
    if (tool.slug === 'domain-name-search') return <DomainSearchTool />;
    if (tool.slug === 'blacklist-lookup') return <BlacklistTool />;
    if (tool.slug === 'expired-domains-tool') return <ExpiredDomainsTool />;
    if (tool.slug === 'keyword-rank-checker') return <KeywordRankTool />;
    if (tool.slug === 'keyword-density-checker') return <KeywordDensityTool />;
    if (tool.slug === 'keywords-suggestions-tool') return <KeywordSuggestionsTool />;
    if (tool.slug === 'website-keywords-suggestions-tool') return <WebsiteKeywordsTool />;
    if (tool.slug === 'keyword-rich-domains-suggestions-tool') return <KeywordDomainsTool />;
    if (tool.slug === 'related-keywords-finder') return <RelatedKeywordsTool />;
    if (tool.slug === 'long-tail-keyword-generator') return <LongTailTool />;
    if (tool.slug === 'keyword-competition-checker') return <CompetitionTool />;
    if (tool.slug === 'what-is-my-browser') return <BrowserInfo />;
    if (tool.slug === 'pokemon-go-server-status') return <PokemonProbeTool />;
    // Website Checker Tools — real live-data engines (CheckerTools.tsx)
    if (tool.slug === 'google-cache-checker') return <ArchiveCheckerTool />;
    if (tool.slug === 'whois-checker') return <WhoisCheckerTool />;
    if (tool.slug === 'mozrank-checker') return <MozRankTool />;
    if (tool.slug === 'page-authority-checker') return <PageAuthorityTool />;
    if (tool.slug === 'google-index-checker') return <IndexCheckerTool />;
    if (tool.slug === 'alexa-rank-checker') return <TrafficRankTool />;
    if (tool.slug === 'redirect-checker') return <RedirectCheckerTool />;
    if (tool.slug === 'similar-page-checker') return <SimilarPageTool />;
    if (tool.slug === 'cloaking-checker') return <CloakingCheckerTool />;
    if (tool.slug === 'google-malware-checker') return <MalwareCheckerTool />;
    if (tool.slug === 'check-gzip-compression') return <GzipCheckerTool />;
    if (tool.slug === 'ssl-checker') return <SslCheckerTool />;
    if (tool.slug === 'server-status-checker') return <ServerStatusTool />;
    if (tool.slug === 'code-to-text-ratio-checker') return <RatioTool />;
    if (tool.slug === 'alexa-rank-comparison') return <RankCompareTool />;
    if (tool.slug === 'page-comparison') return <PageCompareTool />;
    if (tool.slug === 'spider-simulator') return <SpiderSimTool />;
    if (tool.slug === 'comparison-search') return <ComparisonSearchTool />;
    if (tool.slug === 'blog-finder-tool') return <BlogFinderTool />;
    if (tool.slug === 'apps-rank-tracking-tool') return <AppsRankTool />;
    if (tool.slug === 'social-stats-checker') return <SocialStatsTool />;
    // IP tools (live geolocation APIs, fired only on demand)
    if (tool.slug === 'what-is-my-ip') return <WhatIsMyIp />;
    if (tool.slug === 'ip-location') return <IpLocationTool placeholder={tool.placeholder} />;
    if (tool.slug === 'geo-ip-locator') return <IpLocationTool placeholder={tool.placeholder} withMap />;
    if (tool.slug === 'reverse-ip-domain-check') return <ReverseIpTool placeholder={tool.placeholder} />;
    if (tool.slug === 'free-daily-proxy-list') return <ProxyListTool />;
    if (tool.slug === 'class-c-ip-checker') return <ClassCTool placeholder={tool.placeholder} />;
    // Calculator tools
    if (tool.slug === 'age-calculator') return <AgeCalc />;
    if (tool.slug === 'average-calculator') return <AvgCalc />;
    if (tool.slug === 'confidence-interval-calculator') return <CICalc />;
    if (tool.slug === 'gst-calculator') return <GstCalc />;
    if (tool.slug === 'margin-calculator') return <MarginCalc />;
    if (tool.slug === 'percentage-calculator') return <PctCalc />;
    if (tool.slug === 'probability-calculator') return <ProbCalc />;
    if (tool.slug === 'sales-tax-calculator') return <TaxCalc />;
    if (tool.slug === 'ltv-calculator') return <LtvCalc />;
    if (tool.slug === 'discount-calculator') return <DiscountCalc />;
    if (tool.slug === 'cpm-calculator') return <CpmCalc />;
    if (tool.slug === 'paypal-fee-calculator') return <PaypalCalc />;
    if (tool.slug === 'earnings-per-share-calculator') return <EpsCalc />;
    if (tool.slug === 'bmi-calculator') return <BmiCalc />;
    // Unit converter tools
    if (tool.slug === 'xml-sitemap-generator') return <SitemapGeneratorTool />;
    if (tool.slug === 'unit-converter') return <UnitConverter />;
    if (tool.slug === 'length-converter') return <LengthConverter />;
    if (tool.slug === 'temperature-converter') return <TempConverter />;
    if (tool.slug === 'time-zone-converter') return <TimezoneConverter />;
    if (tool.slug === 'pressure-conversion') return <PressureConverter />;
    if (tool.slug === 'voltage-conversion') return <VoltageConverter />;
    if (tool.slug === 'power-conversion') return <PowerConverter />;
    if (tool.slug === 'speed-converter') return <SpeedConverter />;
    if (tool.slug === 'area-converter') return <AreaConverter />;
    if (tool.slug === 'weight-converter') return <WeightConverter />;
    if (tool.slug === 'image-to-text-converter') return <ImageToText />;
    if (tool.engine === 'image-compress') return <ImageTool mode="compress" />;
    if (tool.engine === 'image-resize') return <ImageTool mode="resize" />;
    if (tool.engine) return <TextRunner tool={tool} />;
    // Custom CMS tools without an engine render their own info page
    if (tool.input === 'none') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-slate-700 leading-relaxed">{tool.description}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900">This tool was added from the content manager. Edit its title, description, category and visibility at any time in <a href="/admin" className="underline font-semibold">the CMS</a>.</div>
        </div>
      );
    }
    // Everything without a live engine runs the simulated lookup (text areas, domains, URLs, images)
    return <LookupRunner tool={tool} />;
  };

  const wide = ['plagiarism-checker', 'grammar-checker', 'article-rewriter'].includes(tool.slug) || ['wm-htmleditor', 'wm-screensim', 'wm-snooper', 'wm-mobile', 'wm-htmlviewer'].includes(tool.engine || '') || tool.category === 'pdf';

  /* Text Analysis Tools get the wide layout: the tool panel spans the full
     content width and the sidebar (search, other relevant tools, popular
     tools, latest articles) starts level with the "About the …" section
     underneath it instead of sitting beside the panel. Everything is
     mobile-first: single column, full-width controls, no sideways scroll. */
  const stacked = tool.category === 'text';

  const header = (
    <header className={`text-center ${stacked ? 'mb-5 sm:mb-6' : 'mb-6'}`}>
      {/* the title is the first thing in the header: the category icon and the
          green "Instant · runs in your browser" pill that used to sit above it
          are both gone from every tool page */}
      <h1 className={`tool-page-title font-extrabold text-slate-900 mb-4${stacked ? ' leading-[1.15]' : ''}`}>{tool.name}</h1>
      <p className={`text-slate-600 max-w-3xl mx-auto leading-relaxed ${stacked ? 'text-[15px] sm:text-base md:text-lg' : 'text-base md:text-lg'}`}>{tool.description}</p>
    </header>
  );

  const featuredImage = tool.featuredImage ? (
    <figure className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-[1.91/1]">
      <img src={tool.featuredImage} alt={tool.featuredImageAlt || tool.name} width="1200" height="630" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={e => { e.currentTarget.parentElement?.classList.add('hidden'); }} />
    </figure>
  ) : null;

  const panel = (
    <div className={`${wide ? 'bg-white shadow-md' : 'bg-slate-50'} rounded-2xl border border-slate-200 ${stacked ? '' : 'mb-10'} ${wide
      ? (stacked ? 'p-3 sm:p-4 md:p-6' : 'p-4 md:p-6')
      : (stacked ? 'p-4 sm:p-5 md:p-7' : 'p-5 md:p-7')}`} key={tool.slug}>
      {renderBody()}
    </div>
  );

  if (stacked) {
    return (
      <div className="pt-8 sm:pt-10 pb-16 sm:pb-20 px-3 sm:px-4 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Full-width tool panel */}
          {header}
          {featuredImage}
          {panel}

          {/* Sidebar starts in front of the About / FAQ / Related-tools column */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-8 items-start">
            <div className="min-w-0">
              <ToolRelatedContent tool={tool} related={related} />
            </div>
            <div className="mt-10 min-w-0">
              <Sidebar category={tool.category} currentSlug={tool.slug} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-10 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-8 items-start">
        {/* ---------- Main column ---------- */}
        <div className="min-w-0">
          {header}

          {featuredImage}

          {panel}

          <ToolRelatedContent tool={tool} related={related} />
        </div>

        {/* ---------- Right sidebar ---------- */}
        <Sidebar category={tool.category} currentSlug={tool.slug} />
      </div>
    </div>
  );
};
