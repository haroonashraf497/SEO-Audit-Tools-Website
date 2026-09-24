/**
 * Tool component map — the code-split boundary for the 154 tools.
 *
 * Every tool UI used to be a static import inside the tool-page chunk, so
 * opening ONE tool (say a PDF merger) downloaded the code of every other tool:
 * WebGenerators (50 KiB), WebTools (42 KiB), IpTools (26 KiB), the calculators,
 * converters, code tools, plagiarism/grammar/article engines … roughly 250 KiB
 * of JavaScript that the visitor never runs. That is exactly the "unused
 * JavaScript" audit finding, and it also delayed the page's first paint because
 * the chunk had to download and parse before the tool could render.
 *
 * Here each tool UI becomes its own lazy module, loaded when — and only when —
 * that tool page opens:
 *
 *  • `toolComponentFor(slug, engine)` tells the tool page which component to
 *    render. Pure data: no component code, so this module is cheap to import.
 *  • `warmToolModule(slug, engine)` lets the router fetch the module while the
 *    navigation is still being prepared (and on link hover/focus), so the tool
 *    body is usually ready from cache and renders in the first commit.
 *
 * Nothing here changes a tool's behaviour: `props(tool)` reproduces exactly the
 * props the old dispatch passed (`tool`, `slug`, `placeholder`, `withMap`,
 * `mode`).
 */
import type { ToolDef } from './data';

type Module = Record<string, unknown>;
type Loader = () => Promise<Module>;

const mod = {
  ip: () => import('./IpTools'),
  plagiarism: () => import('./PlagiarismChecker'),
  grammar: () => import('./GrammarChecker'),
  articleRewriter: () => import('./ArticleRewriter'),
  webTools: () => import('./WebTools'),
  webGenerators: () => import('./WebGenerators'),
  calculators: () => import('./CalculatorTools'),
  converters: () => import('./ConverterTools'),
  codeTools: () => import('./CodeTools'),
  engines: () => import('./engines'),
} satisfies Record<string, Loader>;

export interface ToolComponentSpec {
  /** Chunk that holds the component. */
  load: Loader;
  /** Exported name inside that chunk. */
  name: string;
  /** Props to hand the component; mirrors the old inline dispatch. */
  props?: (tool: ToolDef) => Record<string, unknown>;
}

const spec = (load: Loader, name: string, props?: (tool: ToolDef) => Record<string, unknown>): ToolComponentSpec => ({ load, name, props });

/** Slug-keyed dispatch (identical conditions to the previous inline dispatch). */
const BY_SLUG: Record<string, ToolComponentSpec> = {
  'plagiarism-checker': spec(mod.plagiarism, 'PlagiarismChecker'),
  'grammar-checker': spec(mod.grammar, 'GrammarChecker'),
  'article-rewriter': spec(mod.articleRewriter, 'ArticleRewriter'),

  'meta-tag-generator': spec(mod.engines, 'MetaGen'),
  'robots-txt-generator': spec(mod.engines, 'RobotsGen'),

  // IP tools (live geolocation APIs, fired only on demand)
  'what-is-my-ip': spec(mod.ip, 'WhatIsMyIp'),
  'ip-location': spec(mod.ip, 'IpLocationTool', t => ({ placeholder: t.placeholder })),
  'geo-ip-locator': spec(mod.ip, 'IpLocationTool', t => ({ placeholder: t.placeholder, withMap: true })),
  'reverse-ip-domain-check': spec(mod.ip, 'ReverseIpTool', t => ({ placeholder: t.placeholder })),
  'free-daily-proxy-list': spec(mod.ip, 'ProxyListTool'),
  'class-c-ip-checker': spec(mod.ip, 'ClassCTool', t => ({ placeholder: t.placeholder })),

  // Calculators
  'age-calculator': spec(mod.calculators, 'AgeCalc'),
  'average-calculator': spec(mod.calculators, 'AvgCalc'),
  'confidence-interval-calculator': spec(mod.calculators, 'CICalc'),
  'gst-calculator': spec(mod.calculators, 'GstCalc'),
  'margin-calculator': spec(mod.calculators, 'MarginCalc'),
  'percentage-calculator': spec(mod.calculators, 'PctCalc'),
  'probability-calculator': spec(mod.calculators, 'ProbCalc'),
  'sales-tax-calculator': spec(mod.calculators, 'TaxCalc'),
  'ltv-calculator': spec(mod.calculators, 'LtvCalc'),
  'discount-calculator': spec(mod.calculators, 'DiscountCalc'),
  'cpm-calculator': spec(mod.calculators, 'CpmCalc'),
  'paypal-fee-calculator': spec(mod.calculators, 'PaypalCalc'),
  'earnings-per-share-calculator': spec(mod.calculators, 'EpsCalc'),
  'bmi-calculator': spec(mod.calculators, 'BmiCalc'),

  // Unit converters
  'unit-converter': spec(mod.converters, 'UnitConverter'),
  'length-converter': spec(mod.converters, 'LengthConverter'),
  'temperature-converter': spec(mod.converters, 'TempConverter'),
  'time-zone-converter': spec(mod.converters, 'TimezoneConverter'),
  'pressure-conversion': spec(mod.converters, 'PressureConverter'),
  'voltage-conversion': spec(mod.converters, 'VoltageConverter'),
  'power-conversion': spec(mod.converters, 'PowerConverter'),
  'speed-converter': spec(mod.converters, 'SpeedConverter'),
  'area-converter': spec(mod.converters, 'AreaConverter'),
  'weight-converter': spec(mod.converters, 'WeightConverter'),

  // Image engines share the engines chunk
  'image-compress': spec(mod.engines, 'ImageTool', () => ({ mode: 'compress' })),
  'image-resize': spec(mod.engines, 'ImageTool', () => ({ mode: 'resize' })),
};

/** Engine-keyed dispatch (website-management suite). */
const BY_ENGINE: Record<string, ToolComponentSpec> = {
  'wm-seoscore': spec(mod.webTools, 'SeoScoreTool'),
  'wm-metaanalyze': spec(mod.webTools, 'MetaAnalyzerTool'),
  'wm-ogcheck': spec(mod.webTools, 'OgCheckerTool'),
  'wm-snooper': spec(mod.webTools, 'SnooperTool'),
  'wm-headers': spec(mod.webTools, 'HeadersTool'),
  'wm-wpdetect': spec(mod.webTools, 'WpDetectorTool'),
  'wm-mobile': spec(mod.webTools, 'MobileTestTool'),
  'wm-speed': spec(mod.webTools, 'PageSpeedTool'),
  'wm-pagesize': spec(mod.webTools, 'PageSizeTool'),
  'wm-antivirus': spec(mod.webTools, 'SafetyTool'),
  'wm-emailprivacy': spec(mod.webTools, 'EmailPrivacyTool'),
  'wm-pagerank': spec(mod.webTools, 'PageRankTool'),
  'wm-ping': spec(mod.webTools, 'PingTool'),

  'wm-qr': spec(mod.webGenerators, 'QrTool'),
  'wm-htaccess': spec(mod.webGenerators, 'HtaccessTool'),
  'wm-oggen': spec(mod.webGenerators, 'OgGeneratorTool'),
  'wm-twittercard': spec(mod.webGenerators, 'TwitterCardTool'),
  'wm-urlencode': spec(mod.webGenerators, 'UrlCodecTool'),
  'wm-adsense': spec(mod.webGenerators, 'AdsenseTool'),
  'wm-urlrewrite': spec(mod.webGenerators, 'UrlRewriteTool'),
  'wm-hitcounter': spec(mod.webGenerators, 'HitCounterTool'),
  'wm-screensim': spec(mod.webGenerators, 'ScreenSimTool'),
  'wm-screenshot': spec(mod.webGenerators, 'ScreenshotTool'),
  'wm-speedtest': spec(mod.webGenerators, 'SpeedTestTool'),
  'wm-shortener': spec(mod.webGenerators, 'ShortenerTool'),
  'wm-suggest': spec(mod.webGenerators, 'SuggestTool'),
  'wm-video': spec(mod.webGenerators, 'VideoInfoTool', t => ({ slug: t.slug })),

  'wm-format-html': spec(mod.codeTools, 'HtmlFormatterTool'),
  'wm-format-xml': spec(mod.codeTools, 'XmlFormatterTool'),
  'wm-format-php': spec(mod.codeTools, 'PhpFormatterTool'),
  'wm-htmleditor': spec(mod.codeTools, 'HtmlEditorTool'),
  'wm-htmlviewer': spec(mod.codeTools, 'HtmlViewerTool'),
};

/**
 * The component that renders a tool's body, or null when the tool has no split
 * component (PDF/convert engines handle themselves; tools without an engine use
 * the in-chunk lookup runner or their CMS info page).
 */
export function toolComponentFor(slug: string, engine?: string): ToolComponentSpec | null {
  return BY_SLUG[slug] || (engine ? BY_ENGINE[engine] : null) || null;
}

/** Module-level promise cache: a second visit resolves from memory. */
const loaded = new Map<Loader, Promise<Module>>();

/** Settled modules, so a repeat render is synchronous (no reserve, no wait). */
const settled = new Map<Loader, Module>();

export function loadToolModule(load: Loader): Promise<Module> {
  const done = settled.get(load);
  if (done) return Promise.resolve(done);
  let pending = loaded.get(load);
  if (!pending) {
    pending = load()
      .then(module => { settled.set(load, module); loaded.delete(load); return module; })
      .catch(error => { loaded.delete(load); throw error; });
    loaded.set(load, pending);
  }
  return pending;
}

/** Synchronous lookup for the module cache. */
export function toolModuleSync(load: Loader): Module | null {
  return settled.get(load) || null;
}

/**
 * Warm the chunk a `/tool/<slug>` link will need. Never throws: a failed warm-up
 * is not a failure — the tool page reports real errors itself.
 */
export function warmToolModule(slug: string, engine?: string): Promise<void> {
  const found = toolComponentFor(slug, engine);
  if (!found) return Promise.resolve();
  return loadToolModule(found.load).then(() => undefined, () => undefined);
}
