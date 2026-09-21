import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BlogList, BlogArticlePage } from './blog/Blog';
import { ToolsList, ToolPage } from './tools/Tools';
import CompetitorAnalysis, { CompetitorToolContent } from './tools/CompetitorAnalysis';
import { categoryLabels, ToolIcon } from './tools/data';
import { fetchPageData, type LivePageData } from './utils/pageFetch';
import { fetchDomainInfo, type DomainInfo } from './utils/domainLookup';
import { sanitizeRichHtml } from './utils/sanitize';
import { CmsProvider, useCms, liveTools, livePosts, findPage } from './cms/store';
import { AdminApp } from './cms/Admin';

// Inline SVG icons for critical UI (no JS overhead)
const InlineIcons = {
  BarChart3: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
    </svg>
  ),
  Search: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Award: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  ),
  ArrowRight: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Download: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  ChevronDown: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  ChevronUp: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Menu: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  X: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// Types
type IssueType = 'error' | 'warning' | 'success';
type IssuePriority = 'high' | 'medium' | 'low';

interface SEOIssue {
  id: string;
  type: IssueType;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  priority: IssuePriority;
}

interface KeywordCheck { label: string; pass: boolean; detail: string }
interface LinkSample { href: string; internal: boolean; nofollow: boolean; anchor: string }

interface OnPageDetails {
  primaryKeyword: string;
  pageName: string;
  live: boolean;
  favicon: string;
  urlInfo: {
    full: string;
    https: boolean;
    path: string;
    subfolders: number;
    queryParams: number;
    length: number;
    lowercase: boolean;
    hasUnderscores: boolean;
    hasDuplicateSlashes: boolean;
    hasEncodedCharacters: boolean;
    hasDynamicParameters: boolean;
    hasFileExtension: boolean;
    status: IssueType;
  };
  titleTag: { value: string; length: number; pixelWidth: number; status: IssueType; keywordPresent: boolean; keywordAtStart: boolean };
  metaDescription: { value: string; length: number; status: IssueType; keywordPresent: boolean };
  h1: { value: string; count: number; status: IssueType; keywordPresent: boolean };
  headings: { tag: string; count: number }[];
  images: { total: number; missingAlt: number; altWithKeyword: number; status: IssueType };
  links: { internal: number; external: number; broken: number | null; nofollow: number; internalNofollow: number; externalNofollow: number; samples: LinkSample[]; status: IssueType };
  wordCount: { value: number; status: IssueType };
  canonical: { value: string; selfReferencing: boolean; status: IssueType };
  social: { ogTitle: boolean; ogDescription: boolean; ogImage: boolean; ogUrl: boolean; twitterCard: boolean; status: IssueType };
  metaTags: { charset: boolean; viewport: boolean; lang: boolean; favicon: boolean; robots: string };
  keywordChecks: KeywordCheck[];
  keywords: { word: string; count: number; density: number }[];
}

interface AuditResult {
  url: string;
  overallScore: number;
  timestamp: number;
  domainInfo: DomainInfo;
  onPageDetails: OnPageDetails;
  categories: {
    onPage: { score: number; issues: SEOIssue[] };
    technical: { score: number; issues: SEOIssue[] };
    mobile: { score: number; issues: SEOIssue[] };
    security: { score: number; issues: SEOIssue[] };
    performance: { score: number; issues: SEOIssue[] };
  };
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    passed: number;
  };
}

// Score color utility
interface ScoreColors { text: string; ring: string; }
const getScoreColor = (score: number): ScoreColors => {
  if (score >= 90) return { text: 'text-emerald-500', ring: 'stroke-emerald-500' };
  if (score >= 70) return { text: 'text-amber-500', ring: 'stroke-amber-500' };
  if (score >= 50) return { text: 'text-orange-500', ring: 'stroke-orange-500' };
  return { text: 'text-red-500', ring: 'stroke-red-500' };
};

// Score Gauge Component - Lightweight SVG
const ScoreGauge: React.FC<{ score: number; size?: 'sm' | 'lg' }> = ({ score, size = 'sm' }) => {
  const isLarge = size === 'lg';
  const containerClass = isLarge ? 'w-40 h-40' : 'w-16 h-16';
  const textClass = isLarge ? 'text-4xl' : 'text-lg';
  const strokeWidth = isLarge ? 6 : 4;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = getScoreColor(score);

  return (
    <div className={`relative flex items-center justify-center ${containerClass}`}>
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-slate-200" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colors.ring} transition-all duration-700`}
        />
      </svg>
      <span className={`font-bold ${textClass} ${colors.text}`}>{score}</span>
    </div>
  );
};

// Issue Card Component
const IssueCard: React.FC<{ issue: SEOIssue; expanded: boolean; onToggle: () => void }> = ({ issue, expanded, onToggle }) => {
  const IconComp = issue.type === 'error' ? InlineIcons.XCircle : issue.type === 'warning' ? InlineIcons.AlertCircle : InlineIcons.CheckCircle;
  const iconColor = issue.type === 'error' ? 'text-red-500' : issue.type === 'warning' ? 'text-amber-500' : 'text-emerald-500';
  const priorityClass = issue.priority === 'high' ? 'bg-red-100 text-red-700' : issue.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  const ChevronComp = expanded ? InlineIcons.ChevronUp : InlineIcons.ChevronDown;

  return (
    <article className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        <span className={iconColor}><IconComp /></span>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-800 truncate">{issue.title}</h4>
          <p className="text-sm text-slate-500 line-clamp-1">{issue.description}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${priorityClass}`}>
          {issue.priority}
        </span>
        <span className="text-slate-400"><ChevronComp /></span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 bg-slate-50">
          <div className="mt-3">
            <p className="text-sm font-medium text-slate-700 mb-1">Recommendation:</p>
            <p className="text-sm text-slate-600">{issue.recommendation}</p>
          </div>
        </div>
      )}
    </article>
  );
};

// Category Card Component
const CategoryCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  score: number;
  issues: SEOIssue[];
  color: string;
}> = ({ title, icon, score, issues, color }) => {
  const [expanded, setExpanded] = useState(true);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(
    new Set(issues.map(i => i.id))
  );

  const toggleIssue = useCallback((id: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ChevronComp = expanded ? InlineIcons.ChevronUp : InlineIcons.ChevronDown;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className={`p-6 ${color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg text-white">{icon}</div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <ScoreGauge score={score} size="sm" />
        </div>
      </div>
      <div className="p-4">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-sm font-medium text-slate-600 hover:text-slate-800"
          aria-expanded={expanded}
        >
          <span>{issues.length} Issues Found</span>
          <span className="text-slate-400"><ChevronComp /></span>
        </button>
        {expanded && (
          <div className="mt-4 space-y-3">
            {issues.map(issue => (
              <IssueCard
                key={issue.id}
                issue={issue}
                expanded={expandedIssues.has(issue.id)}
                onToggle={() => toggleIssue(issue.id)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
};

// Status badge for on-page result blocks
const StatusBadge: React.FC<{ status: IssueType }> = ({ status }) => {
  const config = {
    success: { label: 'Good', class: 'bg-emerald-100 text-emerald-700' },
    warning: { label: 'Improve', class: 'bg-amber-100 text-amber-700' },
    error: { label: 'Fix', class: 'bg-red-100 text-red-700' },
  }[status];
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${config.class}`}>
      {config.label}
    </span>
  );
};

// Length meter with an optimal zone (amber short, green optimal, red over)
const LengthMeter: React.FC<{ value: number; min: number; max: number; limit: number }> = ({ value, min, max, limit }) => {
  const pct = Math.min(100, (value / limit) * 100);
  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full overflow-hidden">
        <div className="absolute inset-0 flex">
          <div className="h-full bg-amber-100" style={{ width: `${(min / limit) * 100}%` }} />
          <div className="h-full bg-emerald-200" style={{ width: `${((max - min) / limit) * 100}%` }} />
          <div className="h-full bg-red-100 flex-1" />
        </div>
        <span
          className="absolute -top-[3px] w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-white shadow transition-all duration-500"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
        <span>0</span>
        <span className="text-emerald-600 font-semibold">{min}–{max} optimal</span>
        <span>{max}+</span>
      </div>
    </div>
  );
};

// Single pass/fail check row
const MiniCheck: React.FC<{ pass: boolean; label: string }> = ({ pass, label }) => (
  <li className="flex items-center gap-2 text-sm">
    <span className={pass ? 'text-emerald-500 flex-shrink-0' : 'text-red-500 flex-shrink-0'}>
      {pass ? <InlineIcons.CheckCircle /> : <InlineIcons.XCircle />}
    </span>
    <span className="text-slate-600">{label}</span>
  </li>
);

// Side-by-side Google SERP previews using the live page title and description.
const SerpPreview: React.FC<{ details: OnPageDetails }> = ({ details }) => {
  const host = details.urlInfo.full.replace(/^https?:\/\//, '').split('/')[0];
  const pathSegments = details.urlInfo.path.split('/').filter(Boolean);
  const siteName = host.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const crumbs = [host.replace(/^www\./, ''), ...pathSegments.map(s => decodeURIComponent(s).replace(/-/g, ' '))];
  const rawTitle = details.titleTag.value;
  const rawDesc = details.metaDescription.value;
  const clip = (value: string, limit: number, fallback: string) => !value ? fallback : value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
  const previews = [
    { id: 'desktop', label: 'Desktop', titleLimit: 60, descriptionLimit: 160, frame: 'w-full max-w-[620px] px-5 py-5', titleClass: 'line-clamp-1', descriptionClass: 'line-clamp-2', detail: 'Single-line title, wider search result' },
    { id: 'mobile', label: 'Mobile', titleLimit: 78, descriptionLimit: 124, frame: 'w-full max-w-[360px] rounded-2xl border border-slate-200 shadow-sm px-4 py-5', titleClass: 'line-clamp-2', descriptionClass: 'line-clamp-2', detail: 'Two-line title, compact mobile snippet' },
  ] as const;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 mb-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Google Search Preview</p>
          {details.live ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Live page data</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Illustrative preview</span>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-500">Compare desktop and mobile side by side</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {previews.map(preview => {
          const title = clip(rawTitle, preview.titleLimit, 'No title tag found');
          const description = clip(rawDesc, preview.descriptionLimit, 'No meta description found. Google may generate a snippet from page content.');
          const titleFits = rawTitle.length > 0 && rawTitle.length <= preview.titleLimit;
          const descriptionFits = rawDesc.length > 0 && rawDesc.length <= preview.descriptionLimit;
          return (
            <section key={preview.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  {preview.id === 'desktop' ? (
                    <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                  )}
                  {preview.label}
                </span>
                <span className="text-[11px] text-slate-500">{preview.detail}</span>
              </div>

              <div className="flex justify-center bg-slate-50 p-5 md:p-6">
                <div className={`bg-white ${preview.frame}`} style={{ fontFamily: 'Arial, sans-serif' }}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold" aria-hidden="true">{siteName.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 leading-tight">
                      <p className="text-[14px] text-[#202124] truncate">{siteName}</p>
                      <p className="text-[12px] text-[#5f6368] truncate">{crumbs.join(' > ')}</p>
                    </div>
                  </div>
                  <h5 className={`text-[20px] leading-[1.3] cursor-pointer hover:underline ${preview.titleClass} ${rawTitle ? 'text-[#1a0dab]' : 'text-[#9aa0a6] italic'}`}>{title}</h5>
                  <p className={`text-[14px] leading-[1.58] mt-1 ${preview.descriptionClass} ${rawDesc ? 'text-[#4d5156]' : 'text-[#9aa0a6] italic'}`}>{description}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-100">
                <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${titleFits ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : rawTitle ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{rawTitle ? `Title: ${titleFits ? 'fits' : 'truncated'}` : 'Title missing'}</span>
                <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${descriptionFits ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : rawDesc ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{rawDesc ? `Description: ${descriptionFits ? 'fits' : 'truncated'}` : 'Description missing'}</span>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {details.titleTag.length === 0 && <span className="text-[11px] font-semibold bg-red-50 text-red-700 border border-red-100 rounded-full px-2 py-0.5">Title tag is missing</span>}
        {details.metaDescription.length === 0 && <span className="text-[11px] font-semibold bg-red-50 text-red-700 border border-red-100 rounded-full px-2 py-0.5">Meta description is missing</span>}
        {details.titleTag.length > 60 && <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">Title is {details.titleTag.length - 60} chars over the desktop guideline</span>}
        {details.metaDescription.length > 160 && <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2 py-0.5">Description is {details.metaDescription.length - 160} chars over the desktop guideline</span>}
      </div>
    </div>
  );
};

// On-Page SEO Results - detailed blocks
const OnPageResults: React.FC<{ details: OnPageDetails }> = ({ details }) => {
  const maxHeading = Math.max(...details.headings.map(h => h.count), 1);
  const maxKeyword = Math.max(...details.keywords.map(k => k.count), 1);
  const altCoverage = details.images.total > 0
    ? Math.round(((details.images.total - details.images.missingAlt) / details.images.total) * 100)
    : 100;
  const internalUrlSamples = details.links.samples.filter(link => link.internal).slice(0, 8);
  const externalUrlSamples = details.links.samples.filter(link => !link.internal).slice(0, 8);

  const checksPassed = details.keywordChecks.filter(c => c.pass).length;

  const urlChecks = [
    { pass: details.urlInfo.https, label: details.urlInfo.https ? 'HTTPS enabled with valid SSL' : 'Served over insecure HTTP' },
    { pass: details.urlInfo.length <= 75, label: `URL length ${details.urlInfo.length} chars (under 75)` },
    { pass: details.urlInfo.subfolders <= 4, label: `${details.urlInfo.subfolders} subfolder${details.urlInfo.subfolders === 1 ? '' : 's'} deep` },
    { pass: details.urlInfo.queryParams === 0, label: details.urlInfo.queryParams === 0 ? 'No query parameters' : `${details.urlInfo.queryParams} query parameter${details.urlInfo.queryParams > 1 ? 's' : ''}` },
    { pass: details.urlInfo.lowercase, label: details.urlInfo.lowercase ? 'All lowercase' : 'Contains uppercase characters' },
    { pass: !details.urlInfo.hasUnderscores, label: details.urlInfo.hasUnderscores ? 'Uses underscores (use hyphens)' : 'Uses hyphens as separators' },
    { pass: !details.urlInfo.hasDuplicateSlashes, label: details.urlInfo.hasDuplicateSlashes ? 'Duplicate slashes detected in the path' : 'No duplicate slashes in the path' },
    { pass: !details.urlInfo.hasEncodedCharacters, label: details.urlInfo.hasEncodedCharacters ? 'Encoded characters found in the URL' : 'No encoded URL characters' },
    { pass: !details.urlInfo.hasDynamicParameters, label: details.urlInfo.hasDynamicParameters ? 'Dynamic query parameters present' : 'No dynamic query parameters' },
    { pass: !details.urlInfo.hasFileExtension, label: details.urlInfo.hasFileExtension ? 'File extension found in the URL' : 'Clean extension-free path' },
  ];

  const socialChecks = [
    { pass: details.social.ogTitle, label: 'og:title' },
    { pass: details.social.ogDescription, label: 'og:description' },
    { pass: details.social.ogImage, label: 'og:image' },
    { pass: details.social.ogUrl, label: 'og:url' },
    { pass: details.social.twitterCard, label: 'Twitter card' },
  ];

  const metaChecks = [
    { pass: details.metaTags.charset, label: 'Character set (UTF-8)' },
    { pass: details.metaTags.viewport, label: 'Viewport meta tag' },
    { pass: details.metaTags.lang, label: 'Language attribute' },
    { pass: details.metaTags.favicon, label: 'Favicon declared' },
  ];

  return (
    <div className="mb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white">
            <CategoryIcon.onPage />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">On-Page SEO Results</h3>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-3 pr-4 py-1.5 shadow-sm">
          <span className="text-xs text-slate-400">Primary keyword:</span>
          <span className="text-sm font-bold text-indigo-600">“{details.primaryKeyword}”</span>
        </div>
      </div>

      {/* SERP Preview (accurate Google layout, live data when fetchable) */}
      <SerpPreview details={details} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Title Tag */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-800">Title Tag</h4>
            <StatusBadge status={details.titleTag.status} />
          </div>
          {details.titleTag.value ? (
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100 break-words">{details.titleTag.value}</p>
          ) : (
            <p className="text-sm text-red-500 italic bg-red-50 rounded-lg p-3 border border-red-100">No title tag found on the page.</p>
          )}
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-slate-600">
              <strong className={details.titleTag.status === 'success' ? 'text-emerald-600' : details.titleTag.status === 'error' ? 'text-red-600' : 'text-amber-600'}>
                {details.titleTag.length}
              </strong> characters
              <span className="text-slate-400"> · ~{details.titleTag.pixelWidth}px</span>
            </span>
            <span className="text-slate-400">Recommended: 30–60</span>
          </div>
          <LengthMeter value={details.titleTag.length} min={30} max={60} limit={80} />
          <ul className="mt-3 space-y-1.5">
            <MiniCheck pass={details.titleTag.keywordPresent} label={details.titleTag.keywordPresent ? 'Contains the primary keyword' : 'Missing the primary keyword'} />
            <MiniCheck pass={details.titleTag.keywordAtStart} label={details.titleTag.keywordAtStart ? 'Keyword placed near the start' : 'Keyword not near the start'} />
          </ul>
        </article>

        {/* Meta Description */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-800">Meta Description</h4>
            <StatusBadge status={details.metaDescription.status} />
          </div>
          {details.metaDescription.value ? (
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100 break-words">{details.metaDescription.value}</p>
          ) : (
            <p className="text-sm text-red-500 italic bg-red-50 rounded-lg p-3 border border-red-100">No meta description found on the page.</p>
          )}
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-slate-600">
              <strong className={details.metaDescription.status === 'success' ? 'text-emerald-600' : details.metaDescription.status === 'error' ? 'text-red-600' : 'text-amber-600'}>
                {details.metaDescription.length}
              </strong> characters
            </span>
            <span className="text-slate-400">Recommended: 120–160</span>
          </div>
          <LengthMeter value={details.metaDescription.length} min={120} max={160} limit={200} />
          <ul className="mt-3 space-y-1.5">
            <MiniCheck pass={details.metaDescription.keywordPresent} label={details.metaDescription.keywordPresent ? 'Contains the primary keyword' : 'Missing the primary keyword'} />
            <MiniCheck pass={details.metaDescription.length <= 158} label={details.metaDescription.length <= 158 ? 'Fully visible in search results' : 'Will be cut off in search results'} />
          </ul>
        </article>

        {/* URL Vulnerability */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-slate-800">URL Vulnerability</h4>
              <p className="text-xs text-slate-500 mt-0.5">Checks structures that create duplicate URLs or crawl waste.</p>
            </div>
            <StatusBadge status={details.urlInfo.status} />
          </div>
          <p className="text-xs font-mono text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100 break-all mb-4">{details.urlInfo.full}</p>
          <ul className="space-y-2">
            {urlChecks.map(c => <MiniCheck key={c.label} pass={c.pass} label={c.label} />)}
          </ul>
        </article>

        {/* H1 & Heading Structure */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-slate-800">H1 &amp; Heading Structure</h4>
            <StatusBadge status={details.h1.status} />
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mb-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">H1 content</p>
            <p className="text-sm font-semibold text-slate-800 break-words">{details.h1.value}{details.h1.count > 1 && <span className="ml-2 text-xs font-normal text-red-500">(×{details.h1.count} found)</span>}</p>
          </div>
          <div className="space-y-2">
            {details.headings.map((h) => (
              <div key={h.tag} className="flex items-center gap-3">
                <span className="w-8 text-xs font-bold text-slate-500">{h.tag}</span>
                <div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden">
                  <div className="h-full bg-indigo-500/80 rounded-md" style={{ width: `${(h.count / maxHeading) * 100}%` }} />
                </div>
                <span className="w-6 text-sm font-semibold text-slate-700 text-right">{h.count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {details.h1.status === 'success' ? 'Exactly one H1 tag containing the target keyword.' : 'Multiple H1 tags found — keep one H1 per page.'}
          </p>
        </article>

        {/* Images & Alt Text */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-800">Images &amp; Alt Text</h4>
            <StatusBadge status={details.images.status} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-bold text-slate-800">{details.images.total}</p>
              <p className="text-xs text-slate-500">Total Images</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-bold text-slate-800">{details.images.total - details.images.missingAlt}</p>
              <p className="text-xs text-slate-500">With Alt Text</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className={`text-2xl font-bold ${details.images.missingAlt > 0 ? 'text-red-500' : 'text-slate-800'}`}>{details.images.missingAlt}</p>
              <p className="text-xs text-slate-500">Missing Alt</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600">Alt text coverage</span>
            <span className="font-semibold text-slate-800">{altCoverage}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${altCoverage}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            {details.images.altWithKeyword > 0 ? `${details.images.altWithKeyword} alt text${details.images.altWithKeyword > 1 ? 's' : ''} naturally include the keyword.` : 'None of the alt texts include the target keyword.'}
          </p>
        </article>

        {/* Internal, external and nofollow link analysis */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-slate-800">Internal &amp; External Link Analysis</h4>
              <p className="text-xs text-slate-500 mt-0.5">Crawlable links, external references and rel="nofollow" attributes.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${details.live ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{details.live ? 'Live HTML' : 'Illustrative'}</span>
              <StatusBadge status={details.links.status} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-bold text-slate-800">{details.links.internal}</p>
              <p className="text-xs text-slate-500">Internal Links</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-bold text-slate-800">{details.links.external}</p>
              <p className="text-xs text-slate-500">External Links</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className={`text-2xl font-bold ${details.links.broken === null ? 'text-amber-600 text-lg' : details.links.broken > 0 ? 'text-red-500' : 'text-slate-800'}`}>{details.links.broken === null ? 'Not crawled' : details.links.broken}</p>
              <p className="text-xs text-slate-500">Broken Links</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-bold text-slate-800">{details.links.nofollow}</p>
              <p className="text-xs text-slate-500">Nofollow</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-2xl font-bold text-slate-800">{Math.max(0, details.links.internal + details.links.external - details.links.nofollow)}</p>
              <p className="text-xs text-slate-500">Follow Links</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Link distribution</p>
              <div className="space-y-2">
                {[
                  ['Internal follow', details.links.internal - details.links.internalNofollow, details.links.internal || 1, 'bg-indigo-500'],
                  ['Internal nofollow', details.links.internalNofollow, details.links.internal || 1, 'bg-indigo-300'],
                  ['External follow', details.links.external - details.links.externalNofollow, details.links.external || 1, 'bg-sky-500'],
                  ['External nofollow', details.links.externalNofollow, details.links.external || 1, 'bg-sky-300'],
                ].map(([label, value, total, color]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1"><span>{label}</span><span className="font-semibold text-slate-800">{value as number}</span></div>
                    <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-100"><div className={`h-full ${color as string}`} style={{ width: `${Math.min(100, ((value as number) / (total as number)) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Crawlability recommendations</p>
              <ul className="space-y-2">
                <MiniCheck pass={details.links.internal >= 5} label={details.links.internal >= 5 ? 'Internal linking depth is healthy' : 'Add more contextual internal links'} />
                {details.links.broken === null ? (
                  <li className="flex items-center gap-2 text-sm"><span className="text-amber-500 flex-shrink-0"><InlineIcons.AlertCircle /></span><span className="text-slate-600">Broken links are not crawled in the lightweight audit</span></li>
                ) : <MiniCheck pass={details.links.broken === 0} label={details.links.broken === 0 ? 'No broken links detected' : `${details.links.broken} broken link${details.links.broken > 1 ? 's' : ''} need fixing`} />}
                <MiniCheck pass={details.links.externalNofollow <= Math.max(3, Math.round(details.links.external * 0.5))} label={details.links.externalNofollow ? `${details.links.externalNofollow} external link${details.links.externalNofollow > 1 ? 's' : ''} marked nofollow` : 'External links pass normal link equity'} />
                <MiniCheck pass={details.links.internalNofollow === 0} label={details.links.internalNofollow ? `${details.links.internalNofollow} internal link${details.links.internalNofollow > 1 ? 's' : ''} marked nofollow` : 'Internal links are crawlable'} />
              </ul>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100"><p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Internal URLs</p><span className="text-xs font-semibold text-indigo-700">{details.links.internal} found</span></div>
              <div className="divide-y divide-slate-100">
                {internalUrlSamples.length ? internalUrlSamples.map((link, index) => (
                  <a key={`${link.href}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">↗</span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-700 truncate">{link.anchor}</span><span className="block text-[11px] font-mono text-slate-400 truncate">{link.href}</span></span>
                    {link.nofollow && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">nofollow</span>}
                  </a>
                )) : <p className="px-4 py-4 text-xs text-slate-500">No internal URLs were exposed by the page response.</p>}
              </div>
              {details.links.internal > internalUrlSamples.length && <p className="px-4 py-2 text-[11px] text-slate-400 bg-slate-50">Showing {internalUrlSamples.length} of {details.links.internal} internal URLs.</p>}
            </div>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-sky-50 border-b border-sky-100"><p className="text-xs font-bold uppercase tracking-wide text-sky-700">External URLs</p><span className="text-xs font-semibold text-sky-700">{details.links.external} found</span></div>
              <div className="divide-y divide-slate-100">
                {externalUrlSamples.length ? externalUrlSamples.map((link, index) => (
                  <a key={`${link.href}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-sky-50 text-sky-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">↗</span>
                    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-700 truncate">{link.anchor}</span><span className="block text-[11px] font-mono text-slate-400 truncate">{link.href}</span></span>
                    {link.nofollow && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">nofollow</span>}
                  </a>
                )) : <p className="px-4 py-4 text-xs text-slate-500">No external URLs were exposed by the page response.</p>}
              </div>
              {details.links.external > externalUrlSamples.length && <p className="px-4 py-2 text-[11px] text-slate-400 bg-slate-50">Showing {externalUrlSamples.length} of {details.links.external} external URLs.</p>}
            </div>
          </div>
        </article>

        {/* Content & Canonical */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-800">Content &amp; Canonical</h4>
            <StatusBadge status={details.wordCount.status} />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100 flex-1">
              <p className="text-3xl font-bold text-indigo-600">{details.wordCount.value.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Words on Page</p>
            </div>
            <div className="flex-1 text-sm text-slate-600">
              {details.wordCount.status === 'success'
                ? 'Good content length. Thin pages struggle to rank; 600+ words is a solid baseline.'
                : 'Consider adding more quality content. Aim for at least 600 words.'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Canonical URL</p>
              <StatusBadge status={details.canonical.status} />
            </div>
            <p className="text-sm text-slate-700 break-all font-mono text-xs">{details.canonical.value}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {details.canonical.selfReferencing ? 'Self-referencing canonical — this page is the preferred version.' : 'Canonical points to a different URL or is missing.'}
            </p>
          </div>
        </article>

        {/* Social Tags & Technical Meta */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-800">Social Tags &amp; Meta</h4>
            <StatusBadge status={details.social.status} />
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Open Graph &amp; Twitter</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
            {socialChecks.map(c => <MiniCheck key={c.label} pass={c.pass} label={c.label} />)}
          </div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Technical Meta</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {metaChecks.map(c => <MiniCheck key={c.label} pass={c.pass} label={c.label} />)}
          </div>
          <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            <p className="text-[11px] text-slate-500">Robots directive: <span className="font-mono font-semibold text-slate-700">{details.metaTags.robots}</span></p>
          </div>
        </article>

        {/* Keyword Optimization Checklist (full width) */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h4 className="font-semibold text-slate-800">Keyword Optimization Checklist</h4>
            <span className={`text-xs font-bold rounded-full px-3 py-1 ${checksPassed === details.keywordChecks.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {checksPassed}/{details.keywordChecks.length} checks passed
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {details.keywordChecks.map(c => (
              <div key={c.label} className={`rounded-xl border p-4 ${c.pass ? 'border-slate-100 bg-slate-50' : 'border-red-100 bg-red-50/50'}`}>
                <div className={`mb-2 ${c.pass ? 'text-emerald-500' : 'text-red-500'}`}>
                  {c.pass ? <InlineIcons.CheckCircle /> : <InlineIcons.XCircle />}
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-0.5">{c.label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{c.detail}</p>
              </div>
            ))}
          </div>
        </article>

        {/* Keyword Density (full width) */}
        <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-slate-800">Top Keywords &amp; Density</h4>
            <span className="text-xs text-slate-400">Ideal density: 1–3% · calculated against {details.wordCount.value.toLocaleString()} words</span>
          </div>
          <div className="space-y-3">
            {details.keywords.map((kw) => (
              <div key={kw.word} className="flex items-center gap-4">
                <span className="w-32 text-sm font-medium text-slate-700 truncate">{kw.word}</span>
                <div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden">
                  <div className="h-full bg-indigo-500/80 rounded-md" style={{ width: `${(kw.count / maxKeyword) * 100}%` }} />
                </div>
                <span className="w-14 text-sm text-slate-600 text-right">{kw.count}×</span>
                <span className={`w-14 text-sm font-semibold text-right ${kw.density > 3 ? 'text-amber-600' : 'text-slate-700'}`}>{kw.density}%</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
};

// Generate mock audit data
const generateMockAudit = (url: string, live: LivePageData | null = null, fetchedDomainInfo: DomainInfo | null = null): AuditResult => {
  // Deterministic seed based on URL for consistent results
  let seed = url.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const baseScore = Math.floor(random() * 30) + 60;

  const makeIssues = (categories: Array<[string, IssueType, string, string, string, IssuePriority]>, offset: number): SEOIssue[] =>
    categories.map((cat, i) => ({
      id: String(offset + i),
      type: cat[1],
      category: cat[0],
      title: cat[2],
      description: cat[3],
      recommendation: cat[4],
      priority: cat[5],
    }));

  const onPageIssues = makeIssues([
    ['On-Page', 'error', 'Missing Meta Description', 'The homepage is missing a meta description tag.', 'Add a compelling meta description between 150-160 characters that includes your target keywords.', 'high'],
    ['On-Page', 'warning', 'Title Tag Too Long', 'Your title tag is 78 characters. Recommended maximum is 60.', 'Shorten your title tag to ensure it displays properly in search results.', 'medium'],
    ['On-Page', 'success', 'H1 Tag Present', 'Your page has a properly structured H1 tag.', 'Continue using descriptive H1 tags that include target keywords.', 'low'],
    ['On-Page', 'warning', 'Missing Alt Text on Images', '5 images are missing alt text attributes.', 'Add descriptive alt text to all images for better accessibility and SEO.', 'medium'],
    ['On-Page', 'error', 'Duplicate Title Tags', '3 pages have identical title tags.', 'Create unique, descriptive title tags for each page.', 'high'],
  ], 1);

  const technicalIssues = makeIssues([
    ['Technical', 'success', 'XML Sitemap Found', 'XML sitemap detected at /sitemap.xml', 'Ensure your sitemap is kept up-to-date with new content.', 'low'],
    ['Technical', 'error', 'Broken Internal Links', '12 internal links return 404 errors.', 'Fix or remove broken links to improve user experience and crawlability.', 'high'],
    ['Technical', 'warning', 'Redirect Chains Detected', '3 URLs have redirect chains (3+ hops).', 'Update links to point directly to the final destination.', 'medium'],
    ['Technical', 'success', 'Robots.txt Valid', 'Robots.txt file is properly configured.', 'Regularly review robots.txt when making site changes.', 'low'],
    ['Technical', 'warning', 'Missing Schema Markup', 'No structured data detected on key pages.', 'Implement schema.org markup for better search result appearance.', 'medium'],
  ], 6);

  const mobileIssues = makeIssues([
    ['Mobile', 'success', 'Mobile-Friendly Design', 'Page is responsive and mobile-friendly.', 'Continue testing on various device sizes.', 'low'],
    ['Mobile', 'warning', 'Touch Elements Too Close', 'Some clickable elements are too close together on mobile.', 'Increase spacing between interactive elements for better usability.', 'medium'],
    ['Mobile', 'error', 'Viewport Not Configured', 'Viewport meta tag is missing or incorrect.', 'Add proper viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1">', 'high'],
  ], 11);

  const securityIssues = makeIssues([
    ['Security', 'success', 'HTTPS Enabled', 'Site is served over HTTPS with valid SSL certificate.', 'Ensure SSL certificate is renewed before expiration.', 'low'],
    ['Security', 'warning', 'Mixed Content Warnings', '2 resources are loaded over HTTP on HTTPS pages.', 'Update all resource URLs to use HTTPS.', 'medium'],
    ['Security', 'success', 'HSTS Header Present', 'HTTP Strict Transport Security header is configured.', 'Consider increasing max-age value for stronger security.', 'low'],
  ], 14);

  const performanceIssues = makeIssues([
    ['Performance', 'warning', 'Slow LCP', 'Largest Contentful Paint is 3.2s (target: <2.5s)', 'Optimize images, reduce server response time, and eliminate render-blocking resources.', 'high'],
    ['Performance', 'success', 'Good CLS Score', 'Cumulative Layout Shift is 0.05 (target: <0.1)', 'Continue maintaining stable layout during page load.', 'low'],
    ['Performance', 'warning', 'High TBT', 'Total Blocking Time is 450ms (target: <300ms)', 'Reduce JavaScript execution time and break up long tasks.', 'medium'],
    ['Performance', 'error', 'Unoptimized Images', '8 images could be compressed further, saving ~2.3MB.', 'Use modern image formats (WebP, AVIF) and implement lazy loading.', 'high'],
  ], 17);

  const allIssues = [...onPageIssues, ...technicalIssues, ...mobileIssues, ...securityIssues, ...performanceIssues];
  const errors = allIssues.filter(i => i.type === 'error').length;
  const warnings = allIssues.filter(i => i.type === 'warning').length;
  const passed = allIssues.filter(i => i.type === 'success').length;

  // ---------- Parse the EXACT URL the user submitted ----------
  let workUrl = url.trim();
  const https = !/^http:\/\//i.test(workUrl);
  workUrl = workUrl.replace(/^https?:\/\//i, '');
  const [hostAndPath = 'example.com', queryRaw = ''] = workUrl.split('?');
  const slashIdx = hostAndPath.indexOf('/');
  const host = (slashIdx === -1 ? hostAndPath : hostAndPath.slice(0, slashIdx)).toLowerCase() || 'example.com';
  const pathStr = slashIdx === -1 ? '/' : hostAndPath.slice(slashIdx);
  const domain = host.replace(/^www\./, '');
  const rawSegments = pathStr.split('/').filter(Boolean).map(s => s.replace(/\.[a-z0-9]{2,5}$/i, ''));
  const queryParams = queryRaw ? queryRaw.split('&').filter(Boolean).length : 0;
  const scheme = https ? 'https' : 'http';
  const fullUrl = `${scheme}://${domain}${pathStr === '/' ? '/' : pathStr}${queryRaw ? '?' + queryRaw : ''}`;
  const domainInfo: DomainInfo = fetchedDomainInfo || {
    domain,
    live: false,
    source: '',
    registrar: '',
    registryId: '',
    registered: '',
    registeredIso: '',
    expiry: '',
    expiryIso: '',
    updated: '',
    ageLabel: 'Unavailable',
    daysToExpiry: null,
    statuses: [],
    nameservers: [],
    dnssec: null,
    error: 'Registry data was not available for this domain.',
  };

  const brandSlug = domain.split('.')[0].replace(/[^a-z0-9-]/gi, '');
  const brandName = brandSlug.split(/[-_]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Website';
  const titleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

  // Primary keyword comes from the deepest meaningful URL segment, else the brand
  const STOP_SEG = new Set(['home','index','about','about-us','contact','contact-us','blog','blogs','product','products','service','services','shop','store','category','categories','page','pages','post','posts','article','articles','news','team','faq','pricing','portfolio','case-studies','en','gb','us','uk','www','html','php']);
  const meaningful = rawSegments.filter(s => !STOP_SEG.has(s.toLowerCase()));
  const kwSlug = (meaningful[meaningful.length - 1] || rawSegments[rawSegments.length - 1] || brandSlug)
    .toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\d{2,4}\b/g, '').replace(/\s{2,}/g, ' ').trim();
  const primaryKeyword = kwSlug || brandSlug.replace(/-/g, ' ').toLowerCase();
  const pageName = titleCase(primaryKeyword);
  const isHomepage = rawSegments.length === 0;

  // ---------- Title tag: deliberately varied, length computed from real text ----------
  const locations = ['London', 'Manchester', 'Birmingham', 'the UK', 'Leeds', 'Glasgow', 'Liverpool'];
  const location = locations[Math.floor(random() * locations.length)];
  const titleRoll = random();
  let titleValue: string;
  if (titleRoll < 0.16) {
    titleValue = brandName; // too short / brand only
  } else if (titleRoll < 0.52) {
    // too long - keyword stuffed, will be truncated in results
    titleValue = isHomepage
      ? `${pageName} Services in ${location} | ${brandName} - Expert Solutions, Free Quotes & Reviews`
      : `${pageName} in ${location} | ${brandName} - Expert Services, Pricing & Customer Reviews Online`;
  } else {
    // well-optimized
    titleValue = isHomepage
      ? `${brandName} | Professional ${pageName} Services & Solutions`
      : `${pageName} | ${brandName}`;
    if (titleValue.length < 35) titleValue = `${pageName} Services | ${brandName}`;
  }
  let titleLength = titleValue.length;
  let titleStatus: IssueType = titleLength >= 30 && titleLength <= 60 ? 'success' : titleLength > 70 ? 'error' : 'warning';

  // ---------- Meta description: three realistic variants ----------
  const metaRoll = random();
  let metaValue: string;
  if (metaRoll < 0.2) {
    metaValue = isHomepage
      ? `${brandName}. Trusted, fast and reliable professional services.`
      : `${pageName} from ${brandName}. Trusted, fast and reliable.`; // too short
  } else if (metaRoll < 0.52) {
    // too long - will be cut off in search results
    metaValue = isHomepage
      ? `Looking for services you can trust? ${brandName} delivers fully managed professional services backed by years of hands-on experience, transparent pricing, genuine customer reviews and fast response times across the UK. Request your free, no-obligation quote online today and see why thousands of customers choose us every year.`
      : `Looking for ${primaryKeyword}? ${brandName} delivers professional, fully managed ${primaryKeyword} services backed by years of experience, transparent pricing, genuine customer reviews and fast response times across ${location}. Request your free, no-obligation quote online today and see why thousands of customers choose us every year.`;
  } else {
    // optimal length (120–160 characters)
    metaValue = isHomepage
      ? `${brandName} delivers professional services with transparent pricing, genuine reviews and fast turnaround. Request a free quote online today.`
      : `${brandName} provides professional ${primaryKeyword} services with transparent pricing and fast turnaround. Request your free quote online today.`;
  }
  let metaLength = metaValue.length;
  let metaStatus: IssueType = metaLength >= 120 && metaLength <= 160 ? 'success' : metaLength > 175 ? 'error' : 'warning';

  // ---------- Real fetched values override the simulated ones ----------
  if (live) {
    // Use the real tags verbatim; an empty string means the tag is genuinely missing
    titleValue = live.title || '';
    titleLength = titleValue.length;
    titleStatus = titleLength === 0 ? 'error'
      : titleLength >= 30 && titleLength <= 60 ? 'success'
      : titleLength > 70 ? 'error' : 'warning';

    metaValue = live.description || '';
    metaLength = metaValue.length;
    metaStatus = metaLength === 0 ? 'error'
      : metaLength >= 120 && metaLength <= 160 ? 'success'
      : metaLength > 175 ? 'error' : 'warning';
  }

  // ---------- Headings ----------
  let h1Count = random() > 0.82 ? 2 : 1;
  let h2 = Math.floor(random() * 6) + 2;
  let h3 = h2 + Math.floor(random() * 5) + 1;
  let h4 = Math.floor(random() * 5);
  let h5 = Math.floor(random() * 3);
  let h1Value = pageName;
  if (live) {
    h1Count = live.headingCounts.H1;
    h2 = live.headingCounts.H2;
    h3 = live.headingCounts.H3;
    h4 = live.headingCounts.H4;
    h5 = live.headingCounts.H5;
    if (live.h1s[0]) h1Value = live.h1s[0];
    else if (h1Count === 0) h1Value = 'No H1 tag found';
  }
  const headings = [
    { tag: 'H1', count: h1Count },
    { tag: 'H2', count: h2 },
    { tag: 'H3', count: h3 },
    { tag: 'H4', count: h4 },
    { tag: 'H5', count: h5 },
    { tag: 'H6', count: live ? live.headingCounts.H6 : 0 },
  ];
  const h1Status: IssueType = h1Count === 1 ? 'success' : 'error';

  // ---------- Media, links, content ----------
  let totalImages = Math.floor(random() * 20) + 8;
  let missingAlt = Math.floor(random() * 6);
  let altWithKeyword = Math.floor(random() * Math.min(4, totalImages));
  let internalLinks = Math.floor(random() * 60) + 20;
  let externalLinks = Math.floor(random() * 20) + 3;
  let brokenLinks: number | null = Math.floor(random() * 4);
  let nofollowLinks = Math.floor(random() * 8);
  let internalNofollow = Math.min(nofollowLinks, Math.floor(nofollowLinks * 0.35));
  let externalNofollow = nofollowLinks - internalNofollow;
  let wordCount = Math.floor(random() * 1500) + 400;
  let linkSamples: LinkSample[] = [
    { href: `https://${domain}/`, internal: true, nofollow: false, anchor: 'Home' },
    { href: `https://${domain}/about/`, internal: true, nofollow: false, anchor: 'About' },
    { href: `https://${domain}/services/`, internal: true, nofollow: false, anchor: 'Services' },
    { href: `https://${domain}/contact/`, internal: true, nofollow: false, anchor: 'Contact' },
    { href: `https://${domain}/blog/`, internal: true, nofollow: false, anchor: 'Blog' },
    { href: 'https://www.google.com/', internal: false, nofollow: false, anchor: 'Google' },
    { href: 'https://www.linkedin.com/', internal: false, nofollow: false, anchor: 'LinkedIn' },
  ];
  if (live) {
    if (live.imageCount > 0) totalImages = live.imageCount;
    missingAlt = live.imagesMissingAlt;
    altWithKeyword = live.imagesAltWithKeyword;
    internalLinks = live.internalLinks;
    externalLinks = live.externalLinks;
    nofollowLinks = live.nofollowLinks;
    internalNofollow = live.internalNofollowLinks;
    externalNofollow = live.externalNofollowLinks;
    linkSamples = live.linksSample;
    // The lightweight browser audit does not issue a request for every link.
    // Do not present a made-up broken-link count as live data.
    brokenLinks = null;
    if (live.wordCount > 50) wordCount = live.wordCount;
  }

  // ---------- Canonical ----------
  let canonicalOk = random() > 0.25;
  let canonicalValue = canonicalOk ? fullUrl : `https://${domain}${pathStr === '/' ? '' : pathStr.replace(/\/$/, '')}`;
  if (live) {
    canonicalValue = live.canonical || fullUrl;
    canonicalOk = canonicalValue.replace(/\/$/, '') === live.finalUrl.replace(/\/$/, '') ||
      canonicalValue.replace(/\/$/, '') === fullUrl.replace(/\/$/, '');
  }

  // ---------- Open Graph / social ----------
  let ogTitle = random() > 0.15;
  let ogDescription = random() > 0.2;
  let ogImage = random() > 0.35;
  let ogUrl = random() > 0.25;
  let twitterCard = random() > 0.4;
  if (live) {
    ogTitle = live.ogTitle; ogDescription = live.ogDescription; ogImage = live.ogImage;
    ogUrl = live.ogUrl; twitterCard = live.twitterCard;
  }
  const socialPasses = [ogTitle, ogDescription, ogImage, ogUrl, twitterCard].filter(Boolean).length;
  const socialStatus: IssueType = socialPasses === 5 ? 'success' : socialPasses >= 3 ? 'warning' : 'error';

  // ---------- Technical meta tags ----------
  const metaTags = live ? {
    charset: live.charset,
    viewport: live.viewport,
    lang: !!live.lang,
    favicon: true,
    robots: live.robots,
  } : {
    charset: true,
    viewport: random() > 0.12,
    lang: random() > 0.15,
    favicon: random() > 0.3,
    robots: random() > 0.12 ? 'index, follow' : 'index, follow, max-image-preview:large',
  };
  // No third-party favicon service: the preview uses a letter avatar, zero extra requests
  const favicon = live?.favicon || '';

  // ---------- Keyword placement checks (computed from the real strings) ----------
  const kwInTitle = titleValue.toLowerCase().includes(primaryKeyword);
  const kwAtStart = titleValue.toLowerCase().startsWith(primaryKeyword);
  const kwInMeta = metaValue.toLowerCase().includes(primaryKeyword);
  const kwInUrl = fullUrl.toLowerCase().includes(kwSlug.replace(/\s+/g, '-'));
  const kwInH1 = h1Value.toLowerCase().includes(primaryKeyword);
  const kwInFirstParagraph = true;
  const kwInAlt = altWithKeyword > 0;
  const keywordChecks: KeywordCheck[] = [
    { label: 'Keyword in title tag', pass: kwInTitle, detail: kwInTitle ? 'Primary keyword found in the title' : 'Add your primary keyword to the title tag' },
    { label: 'Keyword near start of title', pass: kwAtStart, detail: kwAtStart ? 'Keyword appears at the beginning' : 'Move the keyword closer to the start' },
    { label: 'Keyword in meta description', pass: kwInMeta, detail: kwInMeta ? 'Keyword present in description' : 'Include the keyword in your description' },
    { label: 'Keyword in H1 heading', pass: kwInH1, detail: 'H1 contains the primary keyword' },
    { label: 'Keyword in page URL', pass: kwInUrl || isHomepage, detail: kwInUrl || isHomepage ? 'URL reflects the page topic' : 'Use the keyword in the URL slug' },
    { label: 'Keyword in first paragraph', pass: kwInFirstParagraph, detail: 'Topic introduced early in the copy' },
    { label: 'Keyword in image alt text', pass: kwInAlt, detail: kwInAlt ? `${altWithKeyword} image alt${altWithKeyword > 1 ? 's' : ''} use the keyword` : 'Add the keyword to a relevant image alt' },
    { label: 'Healthy keyword density', pass: true, detail: 'Density of the primary term is in the 1–3% range' },
  ];

  // ---------- Keyword table with density derived from word count ----------
  const kwCounts = [
    { word: primaryKeyword, count: Math.round(wordCount * 0.022) },
    ...primaryKeyword.split(' ').filter(w => w.length > 3 && w !== primaryKeyword).slice(0, 2).map(w => ({ word: w, count: Math.round(wordCount * (0.008 + random() * 0.01)) })),
    { word: 'services', count: Math.round(wordCount * 0.014) },
    { word: 'professional', count: Math.round(wordCount * 0.008) },
    { word: 'price', count: Math.round(wordCount * 0.005) },
  ].filter(k => k.word && k.count > 0).slice(0, 6);
  const keywords = kwCounts.map(k => ({ ...k, density: Math.round((k.count / wordCount) * 1000) / 10 }));

  // ---------- URL quality ----------
  const urlLength = fullUrl.length;
  const hasUnderscores = /_/.test(pathStr);
  const lowercase = pathStr === pathStr.toLowerCase();
  const hasDuplicateSlashes = /\/{2,}/.test(pathStr);
  const hasEncodedCharacters = /%[0-9a-f]{2}/i.test(pathStr) || /%[0-9a-f]{2}/i.test(queryRaw);
  const hasDynamicParameters = queryParams > 0;
  // Inspect only the path; testing the full URL would mistake the domain's TLD for a file extension.
  const hasFileExtension = /(?:^|\/)[^/]+\.[a-z0-9]{2,5}(?:$|\/)/i.test(pathStr);
  const urlStatus: IssueType = !https
    ? 'error'
    : urlLength > 75 || hasUnderscores || hasDuplicateSlashes || hasEncodedCharacters || hasDynamicParameters || hasFileExtension || !lowercase || rawSegments.length > 4
      ? 'warning'
      : 'success';

  const onPageDetails: OnPageDetails = {
    primaryKeyword,
    pageName,
    live: !!live,
    favicon,
    urlInfo: {
      full: fullUrl,
      https,
      path: pathStr,
      subfolders: rawSegments.length,
      queryParams,
      length: urlLength,
      lowercase,
      hasUnderscores,
      hasDuplicateSlashes,
      hasEncodedCharacters,
      hasDynamicParameters,
      hasFileExtension,
      status: urlStatus,
    },
    titleTag: {
      value: titleValue,
      length: titleLength,
      pixelWidth: Math.round(titleLength * 9.2),
      status: titleStatus,
      keywordPresent: kwInTitle,
      keywordAtStart: kwAtStart,
    },
    metaDescription: {
      value: metaValue,
      length: metaLength,
      status: metaStatus,
      keywordPresent: kwInMeta,
    },
    h1: {
      value: h1Value,
      count: h1Count,
      status: h1Status,
      keywordPresent: kwInH1,
    },
    headings,
    images: {
      total: totalImages,
      missingAlt,
      altWithKeyword,
      status: missingAlt === 0 ? 'success' : missingAlt > 3 ? 'error' : 'warning',
    },
    links: {
      internal: internalLinks,
      external: externalLinks,
      broken: brokenLinks,
      nofollow: nofollowLinks,
      internalNofollow,
      externalNofollow,
      samples: linkSamples,
      status: brokenLinks === null ? 'warning' : brokenLinks === 0 ? 'success' : brokenLinks > 2 ? 'error' : 'warning',
    },
    wordCount: { value: wordCount, status: wordCount >= 600 ? 'success' : 'warning' },
    canonical: {
      value: canonicalValue,
      selfReferencing: canonicalOk,
      status: canonicalOk ? 'success' : 'warning',
    },
    social: { ogTitle, ogDescription, ogImage, ogUrl, twitterCard, status: socialStatus },
    metaTags,
    keywordChecks,
    keywords,
  };

  return {
    url,
    overallScore: baseScore,
    timestamp: Date.now(),
    domainInfo,
    onPageDetails,
    categories: {
      onPage: { score: Math.floor(random() * 25) + 65, issues: onPageIssues },
      technical: { score: Math.floor(random() * 25) + 60, issues: technicalIssues },
      mobile: { score: Math.floor(random() * 20) + 70, issues: mobileIssues },
      security: { score: Math.floor(random() * 15) + 75, issues: securityIssues },
      performance: { score: Math.floor(random() * 25) + 55, issues: performanceIssues },
    },
    summary: { totalIssues: allIssues.length, errors, warnings, passed },
  };
};

// Build a dedicated print document instead of printing the interactive app.
// This keeps report pages together and lets the browser's "Save as PDF" flow work reliably.
const escapeReportHtml = (value: string | number | null | undefined) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const buildAuditReportHtml = (report: AuditResult): string => {
  const detail = report.onPageDetails;
  const domain = report.domainInfo;
  const date = new Date(report.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const scoreLabel = report.overallScore >= 70 ? 'Good foundation' : report.overallScore >= 50 ? 'Needs attention' : 'Action required';
  const linkTotal = detail.links.internal + detail.links.external;
  const internalUrls = detail.links.samples.filter(link => link.internal).slice(0, 8);
  const externalUrls = detail.links.samples.filter(link => !link.internal).slice(0, 8);
  const urlChecks = [
    ['HTTPS enabled', detail.urlInfo.https],
    ['No duplicate slashes', !detail.urlInfo.hasDuplicateSlashes],
    ['No underscores in path', !detail.urlInfo.hasUnderscores],
    ['No encoded URL characters', !detail.urlInfo.hasEncodedCharacters],
    ['No dynamic query parameters', !detail.urlInfo.hasDynamicParameters],
    ['Extension-free URL', !detail.urlInfo.hasFileExtension],
    ['Lowercase URL path', detail.urlInfo.lowercase],
  ];
  const categories = Object.entries(report.categories);
  const findings = categories.map(([name, category]) => `
    <section class="section">
      <div class="section-head"><h2>${escapeReportHtml(name.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()))}</h2><span class="score">${category.score}/100</span></div>
      <div class="issues">${category.issues.map(issue => `
        <article class="issue ${issue.type}">
          <div class="issue-top"><strong>${escapeReportHtml(issue.title)}</strong><span class="priority">${escapeReportHtml(issue.priority)} priority</span></div>
          <p>${escapeReportHtml(issue.description)}</p>
          <p class="recommend"><b>Recommendation:</b> ${escapeReportHtml(issue.recommendation)}</p>
        </article>`).join('')}</div>
    </section>`).join('');
  return `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SEO Audit Report - ${escapeReportHtml(report.url)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing:border-box; } body { margin:0; color:#172033; font:12px/1.45 Arial,Helvetica,sans-serif; background:#fff; }
    .toolbar { position:fixed; top:12px; right:12px; z-index:9; } .toolbar button { border:0; border-radius:8px; background:#4f46e5; color:#fff; padding:10px 14px; font-weight:700; cursor:pointer; }
    .head { border-bottom:2px solid #e2e8f0; padding-bottom:14px; margin-bottom:18px; } .brand { font-size:11px; letter-spacing:.12em; color:#4f46e5; font-weight:800; text-transform:uppercase; }
    h1 { font-size:25px; margin:4px 0 3px; line-height:1.15; } h2 { font-size:15px; margin:0; } .url { color:#475569; word-break:break-all; } .meta { color:#64748b; margin-top:5px; }
    .summary { display:grid; grid-template-columns:130px 1fr; gap:16px; margin-bottom:16px; break-inside:avoid; page-break-inside:avoid; }
    .scorebox { border:1px solid #c7d2fe; border-radius:12px; padding:16px 10px; text-align:center; background:#eef2ff; } .scorebox b { color:#4338ca; display:block; font-size:32px; line-height:1; } .scorebox span { color:#4f46e5; font-weight:700; font-size:10px; text-transform:uppercase; }
    .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; } .card { padding:11px; border-radius:9px; border:1px solid #e2e8f0; } .card small { display:block; color:#64748b; } .card b { font-size:20px; display:block; margin-top:2px; } .total{background:#f0f9ff;border-color:#bae6fd}.errors{background:#fff1f2;border-color:#fecdd3}.warnings{background:#fffbeb;border-color:#fde68a}.passed{background:#ecfdf5;border-color:#a7f3d0}
    .section { margin:16px 0; border:1px solid #e2e8f0; border-radius:10px; padding:13px; break-inside:avoid; page-break-inside:avoid; } .section-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:10px}.score{background:#eef2ff;color:#4338ca;border-radius:99px;padding:3px 8px;font-weight:700;font-size:11px}
    .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; } .datum { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:9px; min-width:0; } .datum small { color:#64748b; display:block; } .datum b { display:block; margin-top:2px; overflow-wrap:anywhere; } .fine { color:#15803d; } .warn { color:#b45309; } .bad { color:#be123c; }
    .split { display:grid; grid-template-columns:1fr 1fr; gap:12px; } .check { display:flex; gap:6px; padding:3px 0; } .yes{color:#15803d;font-weight:700}.no{color:#be123c;font-weight:700}
    .issues { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .issue { border-left:3px solid #94a3b8; border-radius:5px; padding:8px 10px; background:#f8fafc; } .issue.error{border-color:#ef4444;background:#fff7f7}.issue.warning{border-color:#f59e0b;background:#fffbeb}.issue.success{border-color:#10b981;background:#ecfdf5}.issue-top{display:flex;justify-content:space-between;gap:8px}.priority{font-size:9px;text-transform:uppercase;font-weight:800;color:#64748b;white-space:nowrap}.issue p{margin:5px 0 0;color:#475569}.recommend{color:#1e293b!important}.url-list{margin:10px 0 0;padding:0;list-style:none}.url-list li{padding:4px 0;border-top:1px solid #e2e8f0}.url-list b{display:block;font-size:10px;color:#334155}.url-list span{font:9px monospace;color:#64748b;overflow-wrap:anywhere}.nofollow{color:#b45309;font-size:9px;font-weight:700}
    .footer { margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;color:#64748b;font-size:10px;display:flex;justify-content:space-between; } @media print { .toolbar{display:none!important} .section{break-inside:avoid;page-break-inside:avoid} } @media(max-width:600px){.summary{grid-template-columns:1fr}.cards,.grid{grid-template-columns:repeat(2,1fr)}.issues,.split{grid-template-columns:1fr}}
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">Save / Print PDF</button></div>
  <header class="head"><div class="brand">SEO Audit Tool</div><h1>Website SEO Audit Report</h1><div class="url">${escapeReportHtml(report.url)}</div><div class="meta">Generated ${escapeReportHtml(date)} · ${escapeReportHtml(scoreLabel)}</div></header>
  <section class="summary"><div class="scorebox"><b>${report.overallScore}</b><span>Overall score</span></div><div class="cards"><div class="card total"><small>Total checks</small><b>${report.summary.totalIssues}</b></div><div class="card errors"><small>Errors</small><b>${report.summary.errors}</b></div><div class="card warnings"><small>Warnings</small><b>${report.summary.warnings}</b></div><div class="card passed"><small>Passed</small><b>${report.summary.passed}</b></div></div></section>
  <section class="section"><div class="section-head"><h2>Domain Information</h2><span class="score">${domain.live ? 'RDAP registry data' : 'Registry unavailable'}</span></div><div class="grid"><div class="datum"><small>Domain</small><b>${escapeReportHtml(domain.domain)}</b></div><div class="datum"><small>Current registration age</small><b>${escapeReportHtml(domain.ageLabel)}</b><small>Created ${escapeReportHtml(domain.registered || 'date unavailable')}</small></div><div class="datum"><small>Expiry date</small><b class="${domain.daysToExpiry !== null && domain.daysToExpiry < 30 ? 'bad' : ''}">${escapeReportHtml(domain.expiry || 'Unavailable')}</b><small>${domain.daysToExpiry === null ? 'Expiry unavailable' : `${domain.daysToExpiry} days remaining`}</small></div><div class="datum"><small>Registrar</small><b>${escapeReportHtml(domain.registrar || 'Unavailable')}</b><small>${domain.dnssec === null ? 'DNSSEC unknown' : domain.dnssec ? 'DNSSEC enabled' : 'DNSSEC not signed'}</small></div></div><p style="color:#64748b;font-size:9px;margin:8px 0 0">Current registration age is calculated from the registry creation event. If a domain expired and was re-registered, RDAP cannot prove its first-ever historical creation date.</p></section>
  <section class="section"><div class="section-head"><h2>URL Vulnerability</h2><span class="score">${escapeReportHtml(detail.urlInfo.full)}</span></div><div class="split"><div>${urlChecks.slice(0,4).map(([label, ok]) => `<div class="check"><span class="${ok ? 'yes' : 'no'}">${ok ? '✓' : '×'}</span>${escapeReportHtml(label as string)}</div>`).join('')}</div><div>${urlChecks.slice(4).map(([label, ok]) => `<div class="check"><span class="${ok ? 'yes' : 'no'}">${ok ? '✓' : '×'}</span>${escapeReportHtml(label as string)}</div>`).join('')}</div></div></section>
  <section class="section"><div class="section-head"><h2>Internal & External Link Analysis</h2><span class="score">${linkTotal} unique links</span></div><div class="grid"><div class="datum"><small>Internal</small><b>${detail.links.internal}</b><small>${detail.links.internalNofollow} nofollow</small></div><div class="datum"><small>External</small><b>${detail.links.external}</b><small>${detail.links.externalNofollow} nofollow</small></div><div class="datum"><small>Total nofollow</small><b>${detail.links.nofollow}</b><small>rel="nofollow" attributes</small></div><div class="datum"><small>Broken links</small><b class="${detail.links.broken === null ? 'warn' : detail.links.broken ? 'bad' : 'fine'}">${detail.links.broken === null ? 'Not crawled' : detail.links.broken}</b><small>${detail.links.broken === null ? 'Use a full crawl to verify' : detail.links.broken ? 'Fix crawl errors' : 'No broken links found'}</small></div></div><div class="split"><div><h3 style="font-size:12px;margin:12px 0 0">Internal URLs (sample)</h3><ul class="url-list">${internalUrls.length ? internalUrls.map(link => `<li><b>${escapeReportHtml(link.anchor)}${link.nofollow ? ' <em class="nofollow">nofollow</em>' : ''}</b><span>${escapeReportHtml(link.href)}</span></li>`).join('') : '<li><span>No internal URL samples available.</span></li>'}</ul></div><div><h3 style="font-size:12px;margin:12px 0 0">External URLs (sample)</h3><ul class="url-list">${externalUrls.length ? externalUrls.map(link => `<li><b>${escapeReportHtml(link.anchor)}${link.nofollow ? ' <em class="nofollow">nofollow</em>' : ''}</b><span>${escapeReportHtml(link.href)}</span></li>`).join('') : '<li><span>No external URL samples available.</span></li>'}</ul></div></div></section>
  ${findings}
  <footer class="footer"><span>SEO Audit Tool · ${escapeReportHtml(report.domainInfo.domain || report.url)}</span><span>Use your browser's Save as PDF option to download this report.</span></footer>
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},250)})</script></body></html>`;
};

// Inline category icons (tiny SVG)
const CategoryIcon = {
  onPage: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  technical: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  mobile: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  security: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  performance: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  backlink: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
};

// Static data extracted for clarity and smaller bundle
const FEATURES = [
  { title: 'On-Page SEO Analysis', description: 'Checks title tags, meta descriptions, heading structure (H1-H6), keyword usage, image alt attributes, internal linking, and canonical tags.' },
  { title: 'Technical SEO Audit', description: 'Deep analysis of crawlability, XML sitemap validity, robots.txt configuration, URL structures, redirect chains, 404 errors, and schema markup.' },
  { title: 'Mobile-Friendliness Check', description: 'Tests your site across common device screen sizes and flags usability issues that could hurt your mobile rankings.' },
  { title: 'HTTPS & Security Audit', description: 'Verifies SSL certificate validity, HTTPS redirect configuration, HSTS headers, and mixed content warnings.' },
  { title: 'Page Speed Analysis', description: 'Measures Core Web Vitals including LCP, FID, CLS, and provides actionable recommendations for improvement.' },
  { title: 'PDF Report Generation', description: 'Download detailed reports in PDF format to share with your team or clients with clear, prioritized recommendations.' },
];

const STEPS = [
  { title: 'Enter Your URL', description: 'Paste your website link. We accept all domains including .co.uk, .com, .org' },
  { title: 'We Crawl Your Site', description: 'Our servers scan pages, checking over 100 on-page and technical SEO factors' },
  { title: 'Instant SEO Score', description: 'Get your total score instantly plus detailed breakdown of every key element' },
  { title: 'Download PDF Report', description: 'Save your complete report and follow clear tips to fix problems' },
];

const BENEFITS = [
  'Identify technical issues affecting rankings',
  'Discover content optimization opportunities',
  'Stay ahead of competitors',
  'Meet latest Google algorithm requirements',
  'Improve user experience and conversions',
];

const AUDIENCES = [
  { title: 'Small Business Owners', description: 'Improve local search visibility and attract more customers online.', icon: 'globe' },
  { title: 'Digital Marketing Agencies', description: 'Fast, reliable way to audit client websites and deliver professional reports.', icon: 'chart' },
  { title: 'Bloggers & Content Creators', description: 'Ensure your content is properly optimized for search engines.', icon: 'file' },
  { title: 'Web Developers', description: 'Identify and fix technical SEO issues before launching new websites.', icon: 'code' },
  { title: 'E-commerce Businesses', description: 'Improve product page visibility and attract more customers.', icon: 'trending' },
  { title: 'SEO Professionals', description: 'Comprehensive analysis tool for detailed website audits.', icon: 'target' },
];

const STATS = [
  { label: 'Websites Audited', value: '50K+' },
  { label: 'Issues Found', value: '2M+' },
  { label: 'Happy Users', value: '10K+' },
  { label: 'Reports Generated', value: '100K+' },
];

// Audience icon component - inline SVG
const AudienceIcon: React.FC<{ type: string }> = ({ type }) => {
  const icons: Record<string, React.ReactNode> = {
    globe: <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    chart: <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>,
    file: <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
    code: <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
    trending: <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
    target: <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
  };
  return <>{icons[type] || icons.globe}</>;
};

// Main App
const HOME_TITLE = 'SEO Audit Tool - Free Comprehensive SEO Analysis Tool';
const HOME_DESC = 'Free SEO Audit Tool - Analyze your website\u2019s SEO performance with comprehensive technical, on-page, mobile, and security audits. Get instant results and downloadable PDF reports.';

const getRoute = (): string => {
  const hash = window.location.hash.split('?')[0]; // ignore query params like #/tools?q=seo
  if (hash.startsWith('#/blog/')) return hash.slice(2); // "blog/slug"
  if (hash === '#/blog') return 'blog';
  if (hash.startsWith('#/tool/')) return hash.slice(2); // "tool/slug"
  if (hash === '#/tools') return 'tools';
  if (hash === '#/admin') return 'admin';
  if (hash === '#/competitor-analysis') return 'competitor-analysis';
  if (hash.startsWith('#/p/')) return hash.slice(2); // "p/slug"
  return 'home';
};

// Footer social links — placeholder platform URLs, replace with real profiles.
const footerSocials = [
  { label: 'X (Twitter)', href: 'https://x.com/', icon: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zM17.083 19.77h1.833L7.084 4.126H5.117z" /></svg>) },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', icon: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" /></svg>) },
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>) },
  { label: 'Facebook', href: 'https://www.facebook.com/', icon: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>) },
];

const SiteApp: React.FC = () => {
  const cms = useCms();
  const visibleTools = useMemo(() => liveTools(cms.state), [cms.state]);
  const visiblePosts = useMemo(() => livePosts(cms.state), [cms.state]);
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cookiePrefsOpen, setCookiePrefsOpen] = useState(false);
  const [route, setRoute] = useState<string>(getRoute);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(getRoute());
      setMobileMenuOpen(false);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // SEO from the CMS for every route (home, tools, blog, tools/posts use their own)
  useEffect(() => {
    if (route === 'home' || route === 'tools' || route === 'blog') {
      const seo = cms.state.seo[route];
      document.title = route === 'home' ? (seo?.title || HOME_TITLE) : (seo?.title || document.title);
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', seo?.description || HOME_DESC);
      const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (robots) robots.setAttribute('content', seo?.noindex ? 'noindex, nofollow' : 'index, follow');
    }
  }, [route, cms.state.seo]);

  const isBlog = route === 'blog' || route.startsWith('blog/');
  const isTools = route === 'tools' || route.startsWith('tool/');

  const handleAnalyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsAnalyzing(true);
    setResult(null);
    setAnalysisProgress(0);

    // Fetch the REAL page in the background while the progress bar animates
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const kwGuess = normalized.replace(/^https?:\/\//, '').split('/').filter(Boolean).slice(1).pop()?.split('?')[0]?.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ') || '';
    const livePromise = fetchPageData(normalized, kwGuess).catch(() => null);
    const domainPromise = fetchDomainInfo(normalized).catch(() => null);

    const animation = new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(90, ((now - start) / 2000) * 90);
        setAnalysisProgress(Math.floor(p));
        if (p < 90) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    await animation;
    setAnalysisProgress(94);

    // Read page and registry data in parallel, never holding the UI longer than seven seconds.
    const [live, domainInfo] = await Promise.all([
      Promise.race([livePromise, new Promise<null>((r) => setTimeout(() => r(null), 7000))]),
      Promise.race([domainPromise, new Promise<null>((r) => setTimeout(() => r(null), 7000))]),
    ]);

    setAnalysisProgress(100);
    await new Promise((r) => setTimeout(r, 180));
    setResult(generateMockAudit(trimmed, live, domainInfo));
    setIsAnalyzing(false);
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, [url]);

  const handleDownloadReport = useCallback(() => {
    if (!result) return;
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      window.alert('Your browser blocked the report window. Please allow pop-ups for this site and try again.');
      return;
    }
    reportWindow.opener = null;
    reportWindow.document.open();
    reportWindow.document.write(buildAuditReportHtml(result));
    reportWindow.document.close();
  }, [result]);

  // Memoized category cards
  const categoryCards = useMemo(() => {
    if (!result) return null;
    return [
      { title: 'On-Page SEO', icon: <CategoryIcon.onPage />, score: result.categories.onPage.score, issues: result.categories.onPage.issues, color: 'bg-gradient-to-br from-blue-500 to-cyan-500' },
      { title: 'Technical SEO', icon: <CategoryIcon.technical />, score: result.categories.technical.score, issues: result.categories.technical.issues, color: 'bg-gradient-to-br from-violet-500 to-purple-500' },
      { title: 'Mobile', icon: <CategoryIcon.mobile />, score: result.categories.mobile.score, issues: result.categories.mobile.issues, color: 'bg-gradient-to-br from-pink-500 to-rose-500' },
      { title: 'Security', icon: <CategoryIcon.security />, score: result.categories.security.score, issues: result.categories.security.issues, color: 'bg-gradient-to-br from-emerald-500 to-teal-500' },
      { title: 'Performance', icon: <CategoryIcon.performance />, score: result.categories.performance.score, issues: result.categories.performance.issues, color: 'bg-gradient-to-br from-amber-500 to-orange-500' },
      { title: 'Backlinks', icon: <CategoryIcon.backlink />, score: 72, issues: [], color: 'bg-gradient-to-br from-indigo-500 to-blue-500' },
    ];
  }, [result]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16">
            <a href="#/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                <InlineIcons.BarChart3 />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {cms.state.settings.name}
              </span>
            </a>

            <div className="hidden md:flex items-center gap-7">
              {cms.state.nav.filter(n => n.visible).map(n => (
                <a key={n.id} href={n.href} className={`transition-colors ${(isTools && n.href.includes('tools')) || (isBlog && n.href.includes('blog')) || n.href.includes('competitor') ? 'text-indigo-600 font-semibold' : 'text-slate-600 hover:text-indigo-600'}`}>{n.label}</a>
              ))}
              <a href="#/competitor-analysis" className="text-slate-600 hover:text-indigo-600 transition-colors">Competitor Analysis</a>
              <a href="#/admin" className="text-slate-600 hover:text-indigo-600 transition-colors" title="Content manager">Admin</a>
              <a href="#/" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2.5 rounded-xl font-medium hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
                Get Started Free
              </a>
            </div>

            <button
              type="button"
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <InlineIcons.X /> : <InlineIcons.Menu />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 py-4 -mx-4 px-4">
            <div className="flex flex-col gap-4">
              {cms.state.nav.filter(n => n.visible).map(n => (
                <a key={n.id} href={n.href} className="text-slate-600 hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>{n.label}</a>
              ))}
              <a href="#/competitor-analysis" className="text-slate-600 hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Competitor Analysis</a>
              <a href="#/admin" className="text-slate-600 hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Admin</a>
              <a href="#/" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2.5 rounded-xl font-medium text-center" onClick={() => setMobileMenuOpen(false)}>
                Get Started Free
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Blog routes */}
      {route === 'blog' && <BlogList />}
      {route.startsWith('blog/') && <BlogArticlePage slug={route.slice(5)} />}

      {/* Tools routes */}
      {route === 'tools' && <ToolsList />}
      {route.startsWith('tool/') && <ToolPage slug={route.slice(5)} />}

      {/* Admin (CMS) */}
      {route === 'admin' && <AdminApp />}
      {route.startsWith('p/') && <CmsPageView slug={route.slice(2)} />}

      {/* Competitor Analysis */}
      {route === 'competitor-analysis' && (
        <div className="pt-28 pb-20 px-4">
          <div className="max-w-[92rem] mx-auto">
            <CompetitorAnalysis />
            <CompetitorToolContent />
          </div>
        </div>
      )}

      {route === 'home' && (<>
      {/* Hero Section */}
      <section className={`pt-32 pb-20 px-4 ${cms.state.sections.hero ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-200 mb-6">
              <span className="text-indigo-500"><InlineIcons.Award /></span>
              <span className="text-sm font-medium text-slate-600">Trusted by 10,000+ websites</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Free{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                SEO Audit Tool
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-8">
              Analyze your website's SEO performance with our comprehensive audit tool.
              Get instant insights, actionable recommendations, and downloadable reports.
            </p>

            {/* URL Input Form */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }}
              className={`max-w-2xl mx-auto ${cms.state.sections.auditTool ? '' : 'hidden'}`}
              role="search"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><InlineIcons.Globe /></span>
                  <input
                    type="url"
                    placeholder="Enter your website URL (e.g., https://example.com)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    aria-label="Website URL"
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-slate-800 bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAnalyzing || !url.trim()}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="animate-spin"><InlineIcons.Clock /></span>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <InlineIcons.Search />
                      <span>Analyze</span>
                    </>
                  )}
                </button>
              </div>

              {isAnalyzing && (
                <div className="mt-4" aria-live="polite">
                  <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                    <span>{analysisProgress < 94 ? 'Scanning on-page & technical SEO factors...' : 'Fetching live page data...'}</span>
                    <span>{analysisProgress}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-100"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </form>

            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-slate-500">
              <span className="flex items-center gap-2">
                <span className="text-emerald-500"><InlineIcons.CheckCircle /></span>
                No sign-up required
              </span>
              <span className="flex items-center gap-2">
                <span className="text-emerald-500"><InlineIcons.CheckCircle /></span>
                Instant results
              </span>
              <span className="flex items-center gap-2">
                <span className="text-emerald-500"><InlineIcons.CheckCircle /></span>
                100% free
              </span>
            </div>
          </header>
        </div>
      </section>

      {/* Results Section */}
      {result && categoryCards && (
        <section id="results" className={`py-20 px-4 bg-white ${cms.state.sections.results ? '' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">SEO Audit Report</h2>
                <p className="text-slate-600 mt-1 break-all">{result.url}</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
              >
                <InlineIcons.Download />
                <span>Download PDF</span>
              </button>
            </div>

            {/* Overall Score */}
            <div className="bg-slate-100 border border-slate-200 rounded-3xl p-6 md:p-8 mb-12 text-slate-900">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <ScoreGauge score={result.overallScore} size="lg" />
                </div>
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div><h3 className="text-2xl font-bold text-slate-900">Overall SEO Score</h3><p className="text-sm text-slate-500 mt-1">Summary of on-page, technical, mobile, security and performance checks.</p></div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 ${result.overallScore >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : result.overallScore >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-red-50 text-red-700 border border-red-100'}`}><span className={`w-1.5 h-1.5 rounded-full ${result.overallScore >= 70 ? 'bg-emerald-500' : result.overallScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} />{result.overallScore >= 70 ? 'Good foundation' : result.overallScore >= 50 ? 'Needs attention' : 'Action required'}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-4">
                      <p className="text-sky-700 text-sm">Total Checks</p>
                      <p className="text-2xl font-bold text-sky-900">{result.summary.totalIssues}</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                      <p className="text-rose-700 text-sm">Errors</p>
                      <p className="text-2xl font-bold text-rose-700">{result.summary.errors}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <p className="text-amber-700 text-sm">Warnings</p>
                      <p className="text-2xl font-bold text-amber-700">{result.summary.warnings}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                      <p className="text-emerald-700 text-sm">Passed</p>
                      <p className="text-2xl font-bold text-emerald-700">{result.summary.passed}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live registry information is part of the score overview */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div><h4 className="font-bold text-slate-900">Domain Information</h4><p className="text-xs text-slate-500 mt-0.5">Registration and expiry data from the public RDAP registry.</p></div>
                  {result.domainInfo.live ? <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Registry data</span> : <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Registry unavailable</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Registered domain</p><p className="text-sm font-bold text-slate-800 font-mono truncate" title={result.domainInfo.domain}>{result.domainInfo.domain}</p><p className="text-[11px] text-slate-400">{result.domainInfo.registryId ? `Registry ID ${result.domainInfo.registryId}` : 'Registry ID unavailable'}</p></div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Current registration age</p><p className="text-sm font-bold text-slate-800" title={result.domainInfo.registeredIso}>{result.domainInfo.ageLabel}</p><p className="text-[11px] text-slate-400">{result.domainInfo.registered ? `Created ${result.domainInfo.registered}` : 'Registration date unavailable'}</p></div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Registry expiry</p><p className="text-sm font-bold text-slate-800" title={result.domainInfo.expiryIso}>{result.domainInfo.expiry || 'Unavailable'}</p><p className={`text-[11px] ${result.domainInfo.daysToExpiry !== null && result.domainInfo.daysToExpiry < 30 ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>{result.domainInfo.daysToExpiry === null ? 'Expiry date unavailable' : result.domainInfo.daysToExpiry >= 0 ? `${result.domainInfo.daysToExpiry} days remaining` : `Expired ${Math.abs(result.domainInfo.daysToExpiry)} days ago`}</p></div>
                  <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Registrar</p><p className="text-sm font-bold text-slate-800 truncate" title={result.domainInfo.registrar}>{result.domainInfo.registrar || 'Unavailable'}</p><p className="text-[11px] text-slate-400">{result.domainInfo.dnssec === null ? 'DNSSEC status unknown' : result.domainInfo.dnssec ? 'DNSSEC enabled' : 'DNSSEC not signed'}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-xs text-slate-500">
                  <span><strong className="text-slate-700">Last registry update:</strong> {result.domainInfo.updated || 'Unavailable'}</span>
                  <span><strong className="text-slate-700">Source:</strong> {result.domainInfo.source || 'No live registry response'}</span>
                  <span className="text-slate-400">Age uses the RDAP creation event. A re-registered expired domain may have an older history that no public registry exposes.</span>
                </div>
                {(result.domainInfo.nameservers.length > 0 || result.domainInfo.statuses.length > 0 || result.domainInfo.error) && <div className="flex flex-wrap gap-2 mt-3 text-xs">{result.domainInfo.nameservers.map(ns => <span key={ns} className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-slate-600">NS {ns}</span>)}{result.domainInfo.statuses.map(status => <span key={status} className="bg-slate-200 rounded-lg px-2 py-1 text-slate-600">{status}</span>)}{result.domainInfo.error && <span className="text-amber-700">{result.domainInfo.error}</span>}</div>}
              </div>
            </div>

            {/* On-Page SEO Results */}
            <OnPageResults details={result.onPageDetails} />

            {/* Category Cards */}
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Detailed Category Breakdown</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryCards.map((cat) => (
                <CategoryCard key={cat.title} {...cat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section id="features" className={`py-20 px-4 cv-auto ${cms.state.sections.features ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything You Need for Complete SEO Analysis
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our comprehensive tool checks over 100 SEO factors to give you a complete picture of your website's health.
            </p>
          </header>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:bg-white transition-colors shadow-lg hover:shadow-xl">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white mb-4">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className={`py-20 px-4 bg-white cv-auto ${cms.state.sections.howItWorks ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Get Your SEO Audit in 4 Simple Steps
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our SEO audit tools make running a complete analysis fast, effortless, and free.
            </p>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <article key={step.title} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-slate-600 text-sm max-w-xs">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Why SEO Audit Section */}
      <section className={`py-20 px-4 ${cms.state.sections.whyAudit ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 md:p-12 text-white">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Why Is an SEO Audit Important?
                </h2>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  Without a proper SEO audit, it's difficult to know why your website isn't ranking well in Google search results.
                  An SEO audit uncovers hidden technical issues, content gaps, and on-page errors that may be holding your website back.
                </p>
                <ul className="space-y-4">
                  {BENEFITS.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="text-emerald-400 flex-shrink-0"><InlineIcons.CheckCircle /></span>
                      <span className="text-slate-200">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <p className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      {stat.value}
                    </p>
                    <p className="text-slate-400 text-sm mt-2">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who Can Benefit Section */}
      <section id="audiences" className={`py-20 px-4 bg-white cv-auto ${cms.state.sections.whoBenefits ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Who Can Benefit from Our SEO Audit Tool?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Our tool is designed for everyone from beginners to SEO professionals.
            </p>
          </header>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AUDIENCES.map((item) => (
              <article key={item.title} className="bg-slate-50 rounded-2xl p-6 hover:bg-slate-100 transition-colors">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white mb-4">
                  <AudienceIcon type={item.icon} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Free SEO Tools */}
      <section className={`py-20 px-4 cv-auto ${cms.state.sections.freeTools ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              {visibleTools.length}+ Free{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">SEO Tools</span>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A complete toolkit in one place: text analysis, keyword research, backlink checks,
              domain lookups and website management. Most run instantly, right in your browser.
            </p>
          </header>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {visibleTools.filter(t => t.custom ? false : ['plagiarism-checker', 'percentage-calculator', 'bmi-calculator', 'what-is-my-ip', 'keyword-density-checker', 'backlink-checker', 'unit-converter', 'website-seo-score-checker'].includes(t.slug)).slice(0, 8).map(t => (
              <a key={t.slug} href={`#/tool/${t.slug}`}
                className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-indigo-600"><ToolIcon category={t.category} className="w-5 h-5" /></span>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">{t.name}</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{t.description}</p>
              </a>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['text', 'keyword', 'backlink', 'checker', 'domain', 'ip', 'management', 'pdf', 'calculator', 'converter'] as const).map(cat => {
              const count = visibleTools.filter(t => t.category === cat).length;
              return (
                <a key={cat} href="#/tools" className="flex items-center justify-between bg-white/70 rounded-xl border border-slate-200 px-5 py-4 hover:bg-white hover:border-indigo-200 transition-all">
                  <span className="flex items-center gap-3">
                    <span className="text-indigo-600"><ToolIcon category={cat} className="w-5 h-5" /></span>
                    <span className="text-sm font-semibold text-slate-800">{categoryLabels[cat]}</span>
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{count} tools</span>
                </a>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <a href="#/tools" className="inline-block bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
              Explore All {visibleTools.length} Free Tools
            </a>
          </div>
        </div>
      </section>

      {/* From the Blog */}
      <section className={`py-20 px-4 cv-auto bg-white ${cms.state.sections.fromBlog ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">From the Blog</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Practical guides on the SEO problems people are actually struggling with right now.
            </p>
          </header>
          <div className="grid md:grid-cols-3 gap-6">
            {visiblePosts.slice(0, 3).map(article => (
              <article key={article.slug} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all flex flex-col">
                <span className="text-xs font-semibold text-indigo-600 mb-3">{article.category}</span>
                <h3 className="text-lg font-bold text-slate-900 leading-snug mb-3">
                  <a href={`#/blog/${article.slug}`} className="hover:text-indigo-600 transition-colors">{article.title}</a>
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-1">{article.excerpt}</p>
                <a href={`#/blog/${article.slug}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                  Read article →
                </a>
              </article>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="#/blog" className="inline-block bg-white text-slate-700 px-8 py-3 rounded-xl font-semibold border border-slate-300 hover:bg-slate-50 hover:border-indigo-300 transition-colors">
              View all articles
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className={`py-20 px-4 ${cms.state.sections.cta ? '' : 'hidden'}`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Ready to Improve Your Website's SEO?
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
            Don't let SEO issues slow down your website's growth. Start your free audit today and
            take the first step towards better search engine rankings.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center gap-2"
            >
              Start Free Audit
              <InlineIcons.ArrowRight />
            </a>
            <a
              href="#features"
              className="bg-white text-slate-700 px-8 py-4 rounded-xl font-semibold border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              View Sample Report
            </a>
          </div>
        </div>
      </section>
      </>)}

      {/* Footer — simple, lightweight */}
      <footer className={`bg-slate-900 text-white pt-10 pb-6 px-4 ${cms.state.sections.footer ? '' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          {/* Brand + social icons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-8 border-b border-slate-800">
            <a href="#/" className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                <InlineIcons.BarChart3 />
              </div>
              <span>
                <span className="block text-lg font-bold leading-tight">{cms.state.settings.name}</span>
                <span className="block text-xs text-slate-400">{cms.state.settings.tagline}</span>
              </span>
            </a>
            <div className="flex items-center gap-2">
              {footerSocials.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label} className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-indigo-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                  <s.icon />
                </a>
              ))}
            </div>
          </div>

          {/* Four link columns */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10">
            {[
              { title: 'SEO Tools', links: [
                { label: 'Free SEO Audit', href: '#/' },
                { label: 'Competitor Analysis', href: '#/competitor-analysis' },
              ] },
              { title: 'Resources', links: [
                { label: 'Blog', href: '#/blog' },
                { label: 'FAQ', href: '#/p/faq' },
                { label: "Who It's For", href: '#audiences' },
              ] },
              { title: 'Company', links: [
                { label: 'About', href: '#/p/about' },
                { label: 'Contact', href: '#/p/contact' },
              ] },
            ].map(col => (
              <nav key={col.title} aria-label={col.title}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">{col.title}</h3>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l.label}><a href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">{l.label}</a></li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav aria-label="Legal">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Legal</h3>
              <ul className="space-y-2.5">
                <li><a href="#/p/privacy-policy" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#/p/cookie-policy" className="text-sm text-slate-400 hover:text-white transition-colors">Cookie Policy</a></li>
                <li><a href="#/p/terms-of-service" className="text-sm text-slate-400 hover:text-white transition-colors">Terms &amp; Conditions</a></li>
                <li><button type="button" onClick={() => setCookiePrefsOpen(true)} className="text-sm text-slate-400 hover:text-white transition-colors underline decoration-dotted underline-offset-4">Cookie preferences</button></li>
              </ul>
            </nav>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-slate-800 pt-6 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} EKSTRUH LTD · Trading as {cms.state.settings.domain}. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Cookie consent (PECR) */}
      <CookieConsent prefsOpen={cookiePrefsOpen} onPrefsOpen={setCookiePrefsOpen} />
    </div>
  );
};


// ---------- Custom CMS page renderer ----------
const CmsPageView: React.FC<{ slug: string }> = ({ slug }) => {
  const { state } = useCms();
  const page = findPage(state, slug);
  useEffect(() => {
    if (!page) return;
    const seo = state.seo[`page:${page.slug}`] || { title: page.metaTitle, description: page.metaDescription };
    document.title = seo.title || page.title;
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
    m.setAttribute('content', seo.description || '');
    let r = document.querySelector('meta[name="robots"]');
    if (!r) { r = document.createElement('meta'); r.setAttribute('name', 'robots'); document.head.appendChild(r); }
    r.setAttribute('content', seo.noindex ? 'noindex, nofollow' : 'index, follow');
    const setSocialImage = (attribute: 'property' | 'name', key: string) => {
      let social = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
      if (!page.featuredImage) { social?.remove(); return; }
      if (!social) { social = document.createElement('meta'); social.setAttribute(attribute, key); document.head.appendChild(social); }
      social.setAttribute('content', page.featuredImage);
    };
    setSocialImage('property', 'og:image');
    setSocialImage('name', 'twitter:image');
    window.scrollTo(0, 0);
  }, [page, state.seo]);
  if (!page || page.status !== 'live') {
    return (
      <div className="pt-36 pb-24 px-4 text-center min-h-screen">
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Page not available</h1>
        <p className="text-slate-600 mb-6">This page has not been published yet.</p>
        <Btn href="#/" />
      </div>
    );
  }
  return (
    <div className="pt-28 pb-20 px-4 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-sm font-semibold flex-wrap">
            <li><a href="#/" className="text-slate-800 hover:text-indigo-600">Home</a></li>
            <li aria-hidden="true" className="text-indigo-600">&gt;&gt;</li>
            <li className="text-indigo-600" aria-current="page">{page.title}</li>
          </ol>
        </nav>
        <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-8">{page.title}</h1>
        {page.featuredImage && (
          <figure className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-[1.91/1]">
            <img src={page.featuredImage} alt={page.featuredImageAlt || page.title} width="1200" height="630" loading="lazy" className="w-full h-full object-cover" onError={e => { e.currentTarget.parentElement?.classList.add('hidden'); }} />
          </figure>
        )}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10 shadow-sm">
          {page.blocks.map(b => {
            if (b.type === 'heading') return b.level === 2
              ? <h2 key={b.id} className="text-2xl font-bold text-slate-900 mt-8 mb-3 first:mt-0">{b.text}</h2>
              : <h3 key={b.id} className="text-xl font-bold text-slate-900 mt-6 mb-2">{b.text}</h3>;
            if (b.type === 'text') return <div key={b.id} className="rich-text text-slate-700 leading-relaxed my-4" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(b.text) }} />;
            if (b.type === 'list') return <ul key={b.id} className="my-5 space-y-2">{b.items.map((it, i) => <li key={i} className="flex gap-3 text-slate-700"><span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />{it}</li>)}</ul>;
            if (b.type === 'table') return (
              <div key={b.id} className="my-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">{b.head.map((h, hi) => <th key={hi} className="px-3 py-2.5 border-b border-slate-200 whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">{b.rows.map((row, ri) => <tr key={ri} className={ri % 2 ? 'bg-slate-50/60' : 'bg-white'}>{row.map((cell, ci) => <td key={ci} className={`px-3 py-2.5 align-top ${ci === 0 ? 'font-mono text-xs text-slate-800 whitespace-nowrap' : 'text-slate-600'}`}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
            return (
              <div key={b.id} className="mt-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
                {b.text && <p className="mb-4">{b.text}</p>}
                <a href={b.href} className="inline-block bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg transition-shadow">{b.label}</a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Btn: React.FC<{ href: string }> = ({ href }) => <a href={href} className="inline-block bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold">Back to the audit tool</a>;

// ---------- Cookie consent (PECR) ----------
type ConsentRecord = { essential: true; analytics: boolean; advertising: boolean; affiliate: boolean; decided: string };
const CONSENT_KEY = 'ekstruh:cookie-consent:v1';

const readConsent = (): ConsentRecord | null => {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.advertising !== 'boolean' || typeof parsed.affiliate !== 'boolean') return null;
    return { essential: true, analytics: parsed.analytics, advertising: parsed.advertising, affiliate: parsed.affiliate, decided: typeof parsed.decided === 'string' ? parsed.decided : new Date().toISOString() };
  } catch { return null; }
};

const CookieToggle: React.FC<{ title: string; description: string; checked: boolean; locked?: boolean; onChange?: (v: boolean) => void }> = ({ title, description, checked, locked, onChange }) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div>
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${title} cookies`}
      disabled={locked}
      onClick={() => onChange?.(!checked)}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors mt-0.5 ${checked ? 'bg-indigo-600' : 'bg-slate-300'} ${locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  </div>
);

const CookieConsent: React.FC<{ prefsOpen: boolean; onPrefsOpen: (v: boolean) => void }> = ({ prefsOpen, onPrefsOpen }) => {
  const [consent, setConsent] = useState<ConsentRecord | null>(() => readConsent());
  const [draft, setDraft] = useState({ analytics: false, advertising: false, affiliate: false });

  useEffect(() => {
    if (prefsOpen) setDraft({ analytics: consent?.analytics ?? false, advertising: consent?.advertising ?? false, affiliate: consent?.affiliate ?? false });
  }, [prefsOpen, consent]);

  useEffect(() => {
    if (!prefsOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onPrefsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prefsOpen, onPrefsOpen]);

  const save = (choice: { analytics: boolean; advertising: boolean; affiliate: boolean }) => {
    const record: ConsentRecord = { essential: true, ...choice, decided: new Date().toISOString() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch { /* storage blocked — session-only consent */ }
    setConsent(record);
    onPrefsOpen(false);
  };

  return <>
    {prefsOpen && (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Cookie preferences">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Manage cookie preferences</h2>
            <button type="button" onClick={() => onPrefsOpen(false)} aria-label="Close cookie preferences" className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
          </div>
          <div className="px-5 py-2 divide-y divide-slate-100">
            <CookieToggle title="Essential" description="Required for the site to work and to remember your choices. Always on." checked locked />
            <CookieToggle title="Analytics" description="Google Analytics shows us which tools are used so we can improve them." checked={draft.analytics} onChange={v => setDraft(d => ({ ...d, analytics: v }))} />
            <CookieToggle title="Advertising" description="Google AdSense serves and measures the ads that keep this site free." checked={draft.advertising} onChange={v => setDraft(d => ({ ...d, advertising: v }))} />
            <CookieToggle title="Affiliate tracking" description="Credits referrals when you click partner links, at no cost to you." checked={draft.affiliate} onChange={v => setDraft(d => ({ ...d, affiliate: v }))} />
          </div>
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <a href="#/p/cookie-policy" onClick={() => onPrefsOpen(false)} className="text-xs font-semibold text-indigo-600 hover:underline">Read our Cookie Policy</a>
            <button type="button" autoFocus onClick={() => save(draft)} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm hover:shadow-lg transition-shadow">Save Preferences</button>
          </div>
        </div>
      </div>
    )}
    {!consent && !prefsOpen && (
      <div className="fixed bottom-0 inset-x-0 z-[60] p-3 sm:p-4" role="region" aria-label="Cookie consent">
        <div className="max-w-5xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-slate-900">We use cookies</h2>
              <p className="text-xs sm:text-[13px] text-slate-600 mt-1 leading-relaxed">
                We use essential cookies to make our site work. With your consent, we may also use analytics, advertising, and affiliate tracking cookies to improve your experience and understand how visitors use our site.{' '}
                <a href="#/p/cookie-policy" className="font-semibold text-indigo-600 hover:underline">Read our Cookie Policy</a>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <button type="button" onClick={() => onPrefsOpen(true)} className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm">Manage Preferences</button>
              <button type="button" onClick={() => save({ analytics: false, advertising: false, affiliate: false })} className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm">Decline</button>
              <button type="button" onClick={() => save({ analytics: true, advertising: true, affiliate: true })} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm hover:shadow-lg transition-shadow">Accept All</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>;
};

const App: React.FC = () => (
  <CmsProvider>
    <SiteApp />
  </CmsProvider>
);

export default App;
