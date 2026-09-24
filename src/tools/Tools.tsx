import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  categoryLabels, categoryOrder, categoryStyles, ToolIcon,
  type ToolDef, type ToolCategory,
} from './data';
import { useCms } from '../cms/store';
import { navigate, subscribe } from '../router';
import { buildReport, type SimReport, type RowStatus, Seeded } from './simulator';
import { fetchPageData } from '../utils/pageFetch';
import { Sidebar } from './Sidebar';
import { PdfGuide } from './pdf/PdfGuide';
import { ToolRelatedContent } from './toolContent';
import { RouteBoundary } from '../components/ErrorBoundary';
import { loadPdfEngineModule, pdfEngineComponent, pdfEngineSpec, type PdfEngineSpec } from './pdf/engineRegistry';

import { loadToolModule, toolComponentFor, toolModuleSync, type ToolComponentSpec } from './toolModules';

// Same markup/classes as the shared primitive in engines.tsx, defined locally so
// the in-chunk components below do not drag the engines chunk into this chunk.
const PrimaryBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }> = ({ children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

type AnyComp = React.ComponentType<Record<string, unknown>>;

/**
 * Renders a split tool component. Until its chunk is in memory it shows an
 * INVISIBLE, height-reserving box (never a spinner or any loading text) and the
 * tool page keeps its below-body content unmounted, so the component mounting
 * later cannot push anything that is already on screen — no layout shift.
 */
const ToolBody: React.FC<{ spec: ToolComponentSpec; tool: ToolDef; onSettled?: () => void }> = ({ spec, tool, onSettled }) => {
  const [Comp, setComp] = useState<AnyComp | null>(() => (toolModuleSync(spec.load)?.[spec.name] as AnyComp) || null);
  const [failed, setFailed] = useState(false);
  const settledOnce = useRef(false);
  const markSettled = useCallback(() => {
    if (settledOnce.current) return;
    settledOnce.current = true;
    onSettled?.();
  }, [onSettled]);

  useEffect(() => {
    if (Comp) { markSettled(); return; }
    let alive = true;
    loadToolModule(spec.load)
      .then(module => {
        if (!alive) return;
        const found = module[spec.name] as AnyComp | undefined;
        if (found) setComp(() => found); else setFailed(true);
        markSettled();
      })
      .catch(() => { if (alive) { setFailed(true); markSettled(); } });
    return () => { alive = false; };
  }, [Comp, spec.load, spec.name, markSettled]);

  if (failed) throw new Error(`Tool module failed to load: ${spec.name}`);
  if (!Comp) return <div className="min-h-[calc(100vh-4rem)]" aria-hidden="true" />;
  return <Comp {...(spec.props ? spec.props(tool) : {})} />;
};

// PDF tools are code-split so the PDF libraries load only when a PDF tool page
// opens (see src/tools/pdf/engineRegistry.ts). The engine resolves either from
// the prefetched module cache — the router warms it together with the route
// chunk, so this is the normal case — or from a fresh import. While it settles,
// the body renders an INVISIBLE height-reserving box: no spinner, no loading
// copy of any kind, and no post-paint growth, because the tool page only mounts
// its below-the-body content once the engine has settled.
const PdfSwitch: React.FC<{ spec: PdfEngineSpec; onSettled?: () => void }> = ({ spec, onSettled }) => {
  const [Engine, setEngine] = useState<AnyComp | null>(() => pdfEngineComponent(spec));
  const [failure, setFailure] = useState<unknown>(null);
  const settled = useRef(false);

  const markSettled = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onSettled?.();
  }, [onSettled]);

  useEffect(() => {
    if (!Engine) {
      let alive = true;
      loadPdfEngineModule(spec.mod)
        .then(module => {
          if (!alive) return;
          // One batched commit: engine + the page content below it mount
          // together, so nothing already on screen is displaced.
          setEngine(() => (module[spec.name] as AnyComp) || null);
          markSettled();
        })
        .catch(error => { if (alive) { setFailure(error); markSettled(); } });
      return () => { alive = false; };
    }
    markSettled();
  }, [Engine, spec.mod, spec.name, markSettled]);

  if (failure) throw failure; // RouteBoundary offers Try again / Reload
  if (!Engine) return <div className="min-h-[calc(100vh-4rem)]" aria-hidden="true" />;
  return (
    <>
      <Engine {...spec.props} />
      <PdfGuide engine={spec.key} />
    </>
  );
};


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
      <h3 className="text-lg font-bold text-slate-900 mb-1 break-all">{report.headline}</h3>
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

// The shared engine runner lives in the engines chunk; render it lazily so the
// tools that do not use it never download that chunk.
const WORKING_ENGINE: ToolComponentSpec = { load: () => import('./engines'), name: 'WorkingEngine', props: () => ({}) };
const LazyWorkingEngine: React.FC<{ slug: string; input: string; input2: string }> = ({ slug, input, input2 }) => (
  <ToolBody spec={{ ...WORKING_ENGINE, props: () => ({ slug, input, input2 }) }} tool={WORKING_ENGINE_TOOL} />
);
// ToolBody only uses `tool` when a spec declares props(tool), which the override
// above replaces — this placeholder keeps the signature honest.
const WORKING_ENGINE_TOOL = {} as ToolDef;

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
        <LazyWorkingEngine slug={tool.slug} input={text} input2={text2} />
      </div>
    );
  }
  return (
    <div>
      {textarea}
      <LazyWorkingEngine slug={tool.slug} input={text} input2="" />
    </div>
  );
};

// ---------- Backlink maker (simulated submissions) ----------
const DIRECTORIES = ['aboutus.com', 'intellifinder.com', 'hotfrog.com', 'brownbook.net', 'spoke.com', 'cybo.com', 'yelu.com', 'find-us-here.com', 'directory2020.com', 'trustpilot.com', 'yelp.com', 'foursquare.com'];
const BacklinkMaker: React.FC<{ tool: ToolDef }> = ({ tool }) => {
  const [domain, setDomain] = useState('');
  const [results, setResults] = useState<{ site: string; status: string }[]>([]);
  const [running, setRunning] = useState(false);
  const run = () => {
    if (!domain.trim()) return;
    setRunning(true); setResults([]);
    const rng = new Seeded(domain);
    DIRECTORIES.forEach((site, i) => {
      setTimeout(() => {
        setResults(prev => [...prev, { site, status: rng.next() > 0.25 ? 'Submitted successfully' : 'Already listed' }]);
        if (i === DIRECTORIES.length - 1) setRunning(false);
      }, i * 220);
    });
  };
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={domain} onChange={e => setDomain(e.target.value)} placeholder={tool.placeholder} className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 outline-none text-sm" />
        <PrimaryBtn type="button" onClick={run} disabled={running}>{running ? 'Submitting…' : 'Create Backlinks'}</PrimaryBtn>
      </div>
      {results.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-slate-700 font-medium">{r.site}</span>
              <span className={r.status.includes('success') ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
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

// ---------- Pokemon Go server status ----------
const PokemonStatus: React.FC = () => {
  const [rows, setRows] = useState<{ name: string; status: string; ok: boolean }[] | null>(null);
  const check = () => {
    const rng = new Seeded(Date.now().toString());
    const defs: [string, number][] = [
      ['Login / Authentication', 0.95], ['Game Servers (Global)', 0.97],
      ['Pokemon Trainer Club', 0.9], ['Google Sign-in', 0.97],
      ['Friends & Gifting', 0.93], ['Trading', 0.9],
      ['Raid Battles', 0.92], ['GO Battle League', 0.88],
      ['PokéStops & Gyms', 0.95], ['In-app Purchases', 0.96],
    ];
    setRows(defs.map(([name, uptime]) => {
      const ok = rng.next() < uptime;
      return { name, ok, status: ok ? (rng.next() > 0.15 ? 'Operational' : 'Intermittent') : 'Down' };
    }));
  };
  return (
    <div>
      <PrimaryBtn type="button" onClick={check} className="mb-5">{rows ? 'Refresh Status' : 'Check Server Status'}</PrimaryBtn>
      {rows && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {rows.map(s => (
            <div key={s.name} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm font-medium text-slate-800">{s.name}</span>
              <span className={`flex items-center gap-2 text-sm font-semibold ${s.status === 'Down' ? 'text-red-600' : s.status === 'Intermittent' ? 'text-amber-600' : 'text-emerald-600'}`}>
                <span className={`w-2 h-2 rounded-full ${s.status === 'Down' ? 'bg-red-500' : s.status === 'Intermittent' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {s.status}
              </span>
            </div>
          ))}
          <div className="px-5 py-3 text-xs text-slate-400">Illustrative status check refreshed on demand. Always verify official channels during outages.</div>
        </div>
      )}
    </div>
  );
};

// ---------- Domain availability ----------
const DomainAvail: React.FC<{ tool: ToolDef }> = ({ tool }) => {
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<{ domain: string; available: boolean; price: string }[]>([]);
  const run = () => {
    const k = keyword.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!k) return;
    const tlds = ['.com', '.net', '.org', '.co', '.io', '.info', '.biz', '.online', '.store', '.site'];
    const rng = new Seeded(k);
    setRows(tlds.map(t => ({
      domain: k + t,
      available: rng.next() > 0.35,
      price: `$${(rng.next() * 30 + 8).toFixed(2)}/yr`,
    })));
  };
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder={tool.placeholder} className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 outline-none text-sm" />
        <PrimaryBtn type="button" onClick={run}>Search Domains</PrimaryBtn>
      </div>
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {rows.map(r => (
            <div key={r.domain} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-mono text-slate-800">{r.domain}</span>
              <span className="flex items-center gap-4">
                <span className="text-slate-500">{r.price}</span>
                <span className={`font-semibold ${r.available ? 'text-emerald-600' : 'text-red-500'}`}>
                  {r.available ? 'Available' : 'Taken'}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Tools listing page ----------
const readSearchParams = () => {
  const p = new URLSearchParams(window.location.search);
  return { q: p.get('q') || '', cat: (p.get('cat') || 'all') as 'all' | ToolCategory };
};

export const ToolsList: React.FC = () => {
  const { state: cmsState } = useCms();
  const tools = useMemo<ToolDef[]>(() => cmsState.tools.filter(t => t.status === 'live') as unknown as ToolDef[], [cmsState.tools]);
  const initial = readSearchParams();
  const [query, setQuery] = useState(initial.q);
  const [activeCat, setActiveCat] = useState<'all' | ToolCategory>(initial.cat);

  // React to sidebar searches / breadcrumb category links while already on the index
  useEffect(() => {
    const onRoute = () => { const p = readSearchParams(); setQuery(p.q); setActiveCat(p.cat); };
    return subscribe(onRoute);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filtered = useMemo(() => tools.filter(t =>
    (activeCat === 'all' || t.category === activeCat) &&
    (t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase()))
  ), [query, activeCat]);

  const grouped = useMemo(() => {
    const map = new Map<ToolCategory, ToolDef[]>();
    filtered.forEach(t => {
      const arr = map.get(t.category) || [];
      arr.push(t); map.set(t.category, arr);
    });
    return map;
  }, [filtered]);

  // Per-category totals for the filter pills (stable while browsing).
  const countByCat = useMemo(() => {
    const map = new Map<ToolCategory, number>();
    tools.forEach(t => map.set(t.category, (map.get(t.category) || 0) + 1));
    return map;
  }, [tools]);

  // Keep the URL in step with the active filters so filtered views are
  // shareable and survive reload. replaceState: filtering is not navigation.
  const syncUrl = useCallback((q: string, cat: 'all' | ToolCategory) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (cat !== 'all') params.set('cat', cat);
    const qs = params.toString();
    navigate(qs ? `/tools?${qs}` : '/tools', { replace: true });
  }, []);

  const onQueryChange = useCallback((q: string) => { setQuery(q); syncUrl(q, activeCat); }, [activeCat, syncUrl]);
  const onCatChange = useCallback((cat: 'all' | ToolCategory) => { setActiveCat(cat); syncUrl(query, cat); }, [query, syncUrl]);
  const clearFilters = useCallback(() => { setQuery(''); setActiveCat('all'); syncUrl('', 'all'); }, [syncUrl]);

  const pillCls = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${active ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`;

  return (
    <div className="pt-10 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Free{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SEO Tools</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {tools.length}+ free tools for text analysis, keyword research, backlinks, website management,
            security checks and domains. No sign-up, most run instantly in your browser.
          </p>
        </header>

        <div className="max-w-xl mx-auto mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              type="search"
              aria-label="Search tools"
              placeholder="Search tools… e.g. plagiarism, sitemap, SSL"
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

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <button onClick={() => onCatChange('all')} aria-pressed={activeCat === 'all'} className={pillCls(activeCat === 'all')}>
            All Tools ({tools.length})
          </button>
          {categoryOrder.map(cat => (
            <button key={cat} onClick={() => onCatChange(cat)} aria-pressed={activeCat === cat} className={pillCls(activeCat === cat)}>
              {categoryLabels[cat].replace(' Tools', '')} ({countByCat.get(cat) || 0})
            </button>
          ))}
        </div>

        <div className="min-h-[1.5rem] mb-6 text-center" aria-live="polite">
          {(query.trim() || activeCat !== 'all') && (
            <p className="text-sm text-slate-500">
              Showing <strong className="text-slate-700">{filtered.length}</strong> of {tools.length} tools
              {activeCat !== 'all' && <> in {categoryLabels[activeCat]}</>}
              {query.trim() && <> matching “{query.trim()}”</>}
            </p>
          )}
        </div>

        {categoryOrder.map(cat => {
          const list = grouped.get(cat);
          if (!list?.length) return null;
          return (
            <section key={cat} className="mb-12">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${categoryStyles[cat]}`}>
                  <ToolIcon category={cat} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{categoryLabels[cat]}</h2>
                <span className="text-sm text-slate-400">({list.length})</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map(t => (
                  <a key={t.slug} href={`/tool/${t.slug}`}
                    className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center border ${categoryStyles[t.category]}`}>
                        <ToolIcon category={t.category} className="w-4 h-4" />
                      </span>
                      {t.engine && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Instant</span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors text-sm">{t.name}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed flex-1">{t.description}</p>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && (
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
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Tool not found</h1>
        <a href="/tools" className="text-indigo-600 font-semibold hover:underline">Browse all tools</a>
      </div>
    );
  }

  const related = useMemo(() => (cmsState.tools.filter(t => t.category === tool.category && t.slug !== tool.slug && t.status === 'live') as unknown as ToolDef[]).slice(0, 3), [cmsState.tools, tool]);

  // Split engines (PDF/convert) arrive after the tool-page chunk. Until the
  // engine is settled the page keeps everything that sits BELOW the tool body
  // unmounted, so when the engine mounts nothing already visible is pushed
  // down — this is what keeps a cold PDF-tool deep link at zero layout shift.
  const engineSpec = tool.category === 'pdf' && tool.engine ? pdfEngineSpec(tool.engine) : null;
  const componentSpec = toolComponentFor(tool.slug, tool.engine);
  const [bodySettled, setBodySettled] = useState(() => (
    (!engineSpec || !!pdfEngineComponent(engineSpec)) &&
    (!componentSpec || !!toolModuleSync(componentSpec.load))
  ));
  const markBodySettled = useCallback(() => setBodySettled(true), []);

  const renderBody = () => {
    // Split tool components: the chunk for this one tool loads on demand and
    // the page waits for it behind an invisible reserve (see ToolBody), so a
    // tool page never ships the code of the other 153 tools.
    const componentSpec = toolComponentFor(tool.slug, tool.engine);
    if (componentSpec) {
      return (
        <RouteBoundary key={tool.slug} label={`tool ${tool.slug}`}>
          <ToolBody spec={componentSpec} tool={tool} onSettled={markBodySettled} />
        </RouteBoundary>
      );
    }
    if (tool.category === 'pdf' && tool.engine) {
      const spec = pdfEngineSpec(tool.engine);
      if (!spec) return null;
      return (
        <RouteBoundary key={tool.engine} label={`PDF tool ${tool.engine}`}>
          <PdfSwitch spec={spec} onSettled={markBodySettled} />
        </RouteBoundary>
      );
    }
    // Components defined in this chunk (their code is already here)
    if (tool.slug === 'backlink-maker') return <BacklinkMaker tool={tool} />;
    if (tool.slug === 'domain-name-search') return <DomainAvail tool={tool} />;
    if (tool.slug === 'what-is-my-browser') return <BrowserInfo />;
    if (tool.slug === 'pokemon-go-server-status') return <PokemonStatus />;
    // Any remaining live engine runs through the shared text runner
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

  return (
    <div className="pt-10 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-8 items-start">
        {/* ---------- Main column ---------- */}
        <div className="min-w-0">
          {/* Professional centered header */}
          <header className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center border ${categoryStyles[tool.category]}`}>
                <ToolIcon category={tool.category} className="w-5 h-5" />
              </span>
              {tool.engine && (
                <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                  Instant · runs in your browser
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 uppercase tracking-tight mb-4">{tool.name}</h1>
            <p className="text-base md:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">{tool.description}</p>
          </header>

          {tool.featuredImage && (
            <figure className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-[1.91/1]">
              <img src={tool.featuredImage} alt={tool.featuredImageAlt || tool.name} width="1200" height="630" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={e => { e.currentTarget.parentElement?.classList.add('hidden'); }} />
            </figure>
          )}

          <div className={`${wide ? 'bg-white p-4 md:p-6 shadow-md' : 'bg-slate-50 p-5 md:p-7'} rounded-2xl border border-slate-200 mb-10`} key={tool.slug}>
            {renderBody()}
          </div>

          {bodySettled && <ToolRelatedContent tool={tool} related={related} />}
        </div>

        {/* ---------- Right sidebar ---------- */}
        <Sidebar category={tool.category} currentSlug={tool.slug} />
      </div>
    </div>
  );
};
