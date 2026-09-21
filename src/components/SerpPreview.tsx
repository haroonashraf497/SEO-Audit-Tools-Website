import React, { useState } from 'react';

export type SerpMode = 'desktop' | 'mobile';

type SnippetProps = {
  url: string;
  title: string;
  description: string;
  live?: boolean;
  mode: SerpMode;
  label?: string;
};

type PreviewProps = {
  url: string;
  title: string;
  description: string;
  live?: boolean;
};

const LIMITS: Record<SerpMode, { title: number; description: number; titleClass: string; note: string }> = {
  desktop: { title: 60, description: 160, titleClass: 'line-clamp-1', note: 'Desktop result · about 600px wide' },
  mobile: { title: 78, description: 120, titleClass: 'line-clamp-2', note: 'Mobile result · title can wrap two lines' },
};

const clip = (value: string, limit: number, fallback: string) => {
  if (!value) return fallback;
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
};

const parseUrl = (raw: string) => {
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = parsed.hostname.replace(/^www\./, '');
    const siteName = host.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || host;
    const crumbs = [host, ...parsed.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part).replace(/-/g, ' '))];
    return { host, siteName, crumbs };
  } catch {
    const host = raw.replace(/^https?:\/\//i, '').split('/')[0] || 'example.com';
    return { host, siteName: host, crumbs: [host] };
  }
};

const DesktopIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const MobileIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

export const SerpModeTabs: React.FC<{ mode: SerpMode; onChange: (mode: SerpMode) => void }> = ({ mode, onChange }) => (
  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Search preview device">
    {(['desktop', 'mobile'] as const).map(option => (
      <button
        key={option}
        type="button"
        role="tab"
        aria-selected={mode === option}
        onClick={() => onChange(option)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${mode === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
      >
        {option === 'desktop' ? <DesktopIcon /> : <MobileIcon />}
        {option}
      </button>
    ))}
  </div>
);

export const SerpSnippet: React.FC<SnippetProps> = ({ url, title, description, live, mode, label }) => {
  const limits = LIMITS[mode];
  const { host, siteName, crumbs } = parseUrl(url);
  const shownTitle = clip(title, limits.title, 'No title tag found');
  const shownDescription = clip(description, limits.description, 'No meta description found. Google may generate a snippet from the page.');
  const titleFits = title.length > 0 && title.length <= limits.title;
  const descriptionFits = description.length > 0 && description.length <= limits.description;

  return (
    <article className="rounded-2xl border border-slate-200 overflow-hidden bg-white h-full flex flex-col">
      {(label || live !== undefined) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          {label ? <h3 className="text-xl font-bold text-slate-900">{label}</h3> : <span />}
          {live
            ? <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">Live page</span>
            : live === false
              ? <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">Estimated</span>
              : null}
        </div>
      )}
      <div className="bg-[#f8f9fa] p-4 flex-1">
        <div className="h-[268px] rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 flex-shrink-0">
            <span className="text-lg font-medium tracking-tight leading-none" aria-hidden="true">
              <span className="text-[#4285f4]">G</span>
              <span className="text-[#ea4335]">o</span>
              <span className="text-[#fbbc05]">o</span>
              <span className="text-[#4285f4]">g</span>
              <span className="text-[#34a853]">l</span>
              <span className="text-[#ea4335]">e</span>
            </span>
            <div className="flex-1 h-8 rounded-full border border-slate-200 bg-white px-3 flex items-center text-xs text-slate-600 truncate">
              {shownTitle}
            </div>
          </div>
          <div className={`px-5 py-4 flex-1 ${mode === 'mobile' ? 'max-w-[392px] mx-auto w-full' : ''}`} style={{ fontFamily: 'Arial, sans-serif' }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-7 h-7 rounded-full bg-[#f1f3f4] text-[#5f6368] text-[11px] font-bold flex items-center justify-center flex-shrink-0" aria-hidden="true">
                {(siteName.charAt(0) || host.charAt(0) || 'G').toUpperCase()}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[14px] text-[#202124] truncate">{siteName}</p>
                <p className="text-[12px] text-[#4d5156] truncate">{crumbs.join(' › ')}</p>
              </div>
            </div>
            <p className={`text-[20px] leading-[1.3] mt-1 ${limits.titleClass} ${title ? 'text-[#1a0dab]' : 'text-[#9aa0a6] italic'}`}>{shownTitle}</p>
            <p className={`text-[14px] leading-[1.58] mt-1 line-clamp-2 ${description ? 'text-[#4d5156]' : 'text-[#9aa0a6] italic'}`}>{shownDescription}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-100">
        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${titleFits ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : title ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {title ? `Title ${title.length}/${limits.title}` : 'Title missing'}
        </span>
        <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${descriptionFits ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : description ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {description ? `Description ${description.length}/${limits.description}` : 'Description missing'}
        </span>
      </div>
    </article>
  );
};

export const SerpCompare: React.FC<{
  left: { url: string; title: string; description: string; live?: boolean; label: string };
  right: { url: string; title: string; description: string; live?: boolean; label: string };
}> = ({ left, right }) => {
  const [mode, setMode] = useState<SerpMode>('desktop');
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Google search preview</h2>
          <p className="text-sm text-slate-500 mt-0.5">{LIMITS[mode].note}. Both sites use the same preview size.</p>
        </div>
        <SerpModeTabs mode={mode} onChange={setMode} />
      </div>
      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        <SerpSnippet url={left.url} title={left.title} description={left.description} live={left.live} mode={mode} label={left.label} />
        <SerpSnippet url={right.url} title={right.title} description={right.description} live={right.live} mode={mode} label={right.label} />
      </div>
    </section>
  );
};

const SerpPreview: React.FC<PreviewProps> = ({ url, title, description, live }) => {
  const [mode, setMode] = useState<SerpMode>('desktop');
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Google search preview</h3>
          <p className="text-sm text-slate-500 mt-0.5">{LIMITS[mode].note}</p>
        </div>
        <SerpModeTabs mode={mode} onChange={setMode} />
      </div>
      <SerpSnippet url={url} title={title} description={description} live={live} mode={mode} />
    </section>
  );
};

export default SerpPreview;
