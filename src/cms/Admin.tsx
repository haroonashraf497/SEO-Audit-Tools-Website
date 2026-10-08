import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCms, injectHeadCode, renderCopyright, blogCategorySlug, toolCategorySlug, toolCategoriesOf, toolCategoryName, defaultCompetitor, UNCATEGORIZED, type CmsCompetitor, type CmsBlogCategory, type CmsPage, type CmsPost, type CmsTool, type CmsToolCategory, type FooterColumn, type FooterLink, type SeoEntry, type SidebarLinkSource, type SidebarWidget, type SidebarWidgetType, type Status } from './store';
import { ToolIcon } from '../tools/data';
import { RichTextEditor } from './RichTextEditor';
import { categorySeoFallbacks, postSeoFallbacks, pageSeoFallbacks, blogCategorySeoFallbacks } from '../utils/seo';
import { clearDraft, draftId, formatDraftTime, listDrafts, clearAllDrafts } from './drafts';
import { navigate, blogCategoryHref } from '../router';
import { estimateLocalStorageBytes, formatBytes, BROWSER_QUOTA_BYTES, optimizeImageFile, validateUpload } from './media';

/* ---------------- shared bits ---------------- */
const STATUS_META: Record<Status, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  hidden: { label: 'Hidden', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};
const Badge: React.FC<{ status: Status }> = ({ status }) => {
  const m = STATUS_META[status];
  return <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide border rounded-full px-2.5 py-0.5 ${m.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${status === 'live' ? 'bg-emerald-500' : status === 'hidden' ? 'bg-amber-500' : 'bg-slate-400'}`} />{m.label}</span>;
};
const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' | 'ok' }> = ({ tone = 'primary', className = '', children, ...rest }) => {
  const t = { primary: 'bg-indigo-600 text-white hover:bg-indigo-700', ghost: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50', danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100', ok: 'bg-emerald-600 text-white hover:bg-emerald-700' }[tone];
  return <button {...rest} className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${t} ${className}`}>{children}</button>;
};
/* A <label> around a plain input keeps click-to-focus behaviour, but wrapping
   composite widgets (the rich-text editor, media pickers) in a <label> makes
   the browser forward every click to the first labelable descendant — which
   stole focus from the editor surface. So only simple controls get the label. */
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => {
  const isSimpleControl = React.isValidElement(children)
    && typeof children.type === 'string'
    && ['input', 'textarea', 'select'].includes(children.type);
  const caption = (
    <>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {hint && <span className="block text-xs text-slate-400 mb-1">{hint}</span>}
    </>
  );
  return isSimpleControl
    ? <label className="block">{caption}<span className="block mt-1">{children}</span></label>
    : <div className="block">{caption}<div className="block mt-1">{children}</div></div>;
};
const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white';
/**
 * The shared meta editor every managed page uses (tools, posts, pages, the
 * competitor page and the tool categories).
 *
 * `noindexControl` is opt-in and defaults to 'button', which is what all the
 * existing panels render — the category pages ask for a checkbox, so only they
 * pass it and nothing else changes shape.
 */
const SeoMetaEditor: React.FC<{ value: SeoEntry; onChange: (entry: SeoEntry) => void; fallbackTitle: string; fallbackDescription: string; routeHint: string; noindexControl?: 'button' | 'checkbox'; autosaveTick?: number }> = ({ value, onChange, fallbackTitle, fallbackDescription, routeHint, noindexControl = 'button', autosaveTick }) => {
  const entry = { title: value.title || fallbackTitle, description: value.description || fallbackDescription, slug: value.slug || '', noindex: value.noindex || false };
  const titleTone = entry.title.length >= 50 && entry.title.length <= 60 ? 'text-emerald-600' : entry.title.length ? 'text-amber-600' : 'text-red-600';
  const descriptionTone = entry.description.length >= 120 && entry.description.length <= 160 ? 'text-emerald-600' : entry.description.length ? 'text-amber-600' : 'text-red-600';
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div><h4 className="font-bold text-slate-900">SEO &amp; Meta Information</h4><p className="text-xs text-slate-500">Search title, description, canonical URL and indexing controls for this page.</p></div>
        <div className="flex items-center gap-3">
          {autosaveTick !== undefined && <AutosaveBadge tick={autosaveTick} />}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${entry.noindex ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{entry.noindex ? 'No-indexed' : 'Indexable'}</span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="SEO title" hint={`${entry.title.length} characters · target 50–60`}><input className={inputCls} value={entry.title} onChange={e => onChange({ ...entry, title: e.target.value })} /></Field>
          <Field label="Meta description" hint={`${entry.description.length} characters · target 150–160`}><textarea rows={2} className={inputCls} value={entry.description} onChange={e => onChange({ ...entry, description: e.target.value })} /></Field>
        </div>
        <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
          <Field label="Canonical URL override" hint={`Default: ${routeHint}`}><input className={inputCls} value={entry.slug} onChange={e => onChange({ ...entry, slug: e.target.value })} placeholder="Leave blank to use the page URL" /></Field>
          {noindexControl === 'checkbox' ? (
            <label className={`flex w-fit h-[42px] items-center gap-2.5 px-4 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${entry.noindex ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
              <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={entry.noindex} onChange={e => onChange({ ...entry, noindex: e.target.checked })} />
              Noindex — exclude from search
            </label>
          ) : (
            <button type="button" onClick={() => onChange({ ...entry, noindex: !entry.noindex })} className={`h-[42px] px-4 rounded-lg border text-sm font-semibold transition-colors ${entry.noindex ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{entry.noindex ? 'No-index enabled' : 'Make no-index'}</button>
          )}
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
          <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Google preview</p><div className="flex gap-3 text-[11px] font-bold"><span className={titleTone}>{entry.title.length} title</span><span className={descriptionTone}>{entry.description.length} description</span></div></div>
          <p className="text-xs text-slate-600 mt-2">{routeHint}</p>
          <p className="text-lg leading-tight text-[#1a0dab] mt-0.5">{entry.title.slice(0, 60) || 'Your SEO title'}</p>
          <p className="text-sm leading-snug text-slate-600 mt-1">{entry.description.slice(0, 160) || 'Your meta description appears here.'}</p>
        </div>
      </div>
    </section>
  );
};
/**
 * Turn an SEO draft into what the store keeps. A title or description still
 * equal to the automatically generated copy is stored as blank, so the live
 * counts baked into that copy keep updating — the same rule the tool
 * categories use. Returns null when nothing is left, so the caller clears the
 * entry rather than keeping an empty one.
 */
const seoEntryToStore = (entry: SeoEntry, auto: { title: string; description: string }): SeoEntry | null => {
  const trim = (v?: string) => (v || '').trim();
  const stored: SeoEntry = {
    title: trim(entry.title) && trim(entry.title) !== trim(auto.title) ? trim(entry.title) : '',
    description: trim(entry.description) && trim(entry.description) !== trim(auto.description) ? trim(entry.description) : '',
    slug: trim(entry.slug),
    noindex: !!entry.noindex,
  };
  return stored.title || stored.description || stored.slug || stored.noindex ? stored : null;
};

/** Persist one SEO entry (or clear it) — used by every autosaving SEO section. */
const persistSeo = (setSeo: (key: string, entry: SeoEntry) => void, clearSeo: (key: string) => void, key: string, entry: SeoEntry, auto: { title: string; description: string }) => {
  const stored = seoEntryToStore(entry, auto);
  if (stored) setSeo(key, stored);
  else clearSeo(key);
};

/**
 * A titled group of fields, in exactly the card style the tool editor's
 * Featured Image and SEO & Meta Information cards use: white surface, rounded
 * corners, a slate header bar with the heading and its one-line description,
 * and an evenly spaced body. Every editor (tools, pages, posts, blog
 * categories) groups its fields this way, so the admin reads the same
 * everywhere.
 */
const SectionCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
      <h4 className="font-bold text-slate-900">{title}</h4>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </section>
);

const FeaturedImageEditor: React.FC<{ image?: string; alt?: string; onChange: (patch: { featuredImage?: string; featuredImageAlt?: string }) => void }> = ({ image = '', alt = '', onChange }) => (
  <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
      <h4 className="font-bold text-slate-900">Featured Image</h4>
      <p className="text-xs text-slate-500">Optional social/share image. Use a compressed 1200 × 630px WebP, JPG or AVIF image for the best result.</p>
    </div>
    <div className="p-4 grid lg:grid-cols-[minmax(0,1fr)_200px] gap-4 items-start">
      <div className="space-y-3">
        <Field label="Image URL" hint="Leave blank to hide the image on the public page."><input className={inputCls} type="url" value={image} onChange={e => onChange({ featuredImage: e.target.value })} placeholder="https://cdn.example.com/images/page-feature.webp" /></Field>
        <Field label="Alt text" hint={`${alt.length} characters · describe the image for screen readers and image search.`}><input className={inputCls} value={alt} onChange={e => onChange({ featuredImageAlt: e.target.value })} placeholder="Describe what the image shows" /></Field>
      </div>
      <div className="aspect-[1.91/1] rounded-xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden flex items-center justify-center text-center">
        {image ? <img src={image} alt={alt || ''} width="1200" height="630" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span className="text-xs text-slate-400 px-4">1200 × 630<br />preview</span>}
      </div>
    </div>
  </section>
);
const Toggle: React.FC<{ on: boolean; onClick: () => void; label: string; hint?: string }> = ({ on, onClick, label, hint }) => (
  <button type="button" onClick={onClick} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 text-left">
    <span><span className="block text-sm font-semibold text-slate-800">{label}</span>{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span>
    <span className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-5.5' : 'left-0.5'}`} style={{ left: on ? 22 : 2 }} /></span>
  </button>
);

/* ---------------- small list row ---------------- */
const Row: React.FC<{ children: React.ReactNode; actions?: React.ReactNode }> = ({ children, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
    <div className="min-w-0 flex-1">{children}</div>
    {actions && <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 shrink-0">{actions}</div>}
  </div>
);

/* ================= PANES ================= */
const DashboardIcon: React.FC<{ type: 'tools' | 'blog' | 'pages' | 'seo' | 'visibility' | 'sidebar' | 'arrow' }> = ({ type }) => {
  const base = 'w-5 h-5';
  if (type === 'tools') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
  if (type === 'blog') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><line x1="8" y1="9" x2="10" y2="9" /></svg>;
  if (type === 'pages') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>;
  if (type === 'seo') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6M11 8v6" /></svg>;
  if (type === 'visibility') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (type === 'sidebar') return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /><line x1="7" y1="8" x2="11" y2="8" /><line x1="7" y1="12" x2="11" y2="12" /><line x1="7" y1="16" x2="11" y2="16" /></svg>;
  return <svg className={base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
};

const Dashboard: React.FC<{ go: (t: Tab) => void }> = ({ go }) => {
  const { state } = useCms();
  const liveTools = state.tools.filter(t => t.status === 'live').length;
  const hiddenTools = state.tools.filter(t => t.status === 'hidden').length;
  const draftTools = state.tools.filter(t => t.status === 'draft').length;
  const publishedPosts = state.posts.filter(p => p.status === 'live').length;
  const draftPosts = state.posts.filter(p => p.status !== 'live').length;
  const livePages = state.pages.filter(p => p.status === 'live').length;
  const unpublishedPages = state.pages.filter(p => p.status !== 'live').length;
  const sectionsOn = Object.values(state.sections).filter(Boolean).length;
  const sidebarOn = [state.sidebar.searchBox, state.sidebar.relevantTools, state.sidebar.popular, state.sidebar.latest, state.sidebar.cta].filter(Boolean).length;
  const seoConfigured = Object.values(state.seo).filter(s => s.title && s.description).length;
  const openItems = hiddenTools + draftTools + draftPosts + unpublishedPages;
  const health = Math.max(58, Math.min(100, 100 - openItems * 2 - (Object.values(state.sections).length - sectionsOn) * 2));
  const latest = [...state.posts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const categoryStats = toolCategoriesOf(state).map(cat => {
    const all = state.tools.filter(tool => tool.category === cat.key);
    const live = all.filter(tool => tool.status === 'live').length;
    return { category: cat.key, label: cat.name, total: all.length, live, offline: all.length - live };
  });
  const cards: { label: string; value: string; detail: string; tab: Tab; icon: 'tools' | 'blog' | 'pages' | 'visibility'; tone: string }[] = [
    { label: 'Tools', value: String(liveTools), detail: `${hiddenTools + draftTools} not public`, tab: 'tools', icon: 'tools', tone: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    { label: 'Blog posts', value: String(publishedPosts), detail: draftPosts ? `${draftPosts} need attention` : 'All posts published', tab: 'blog', icon: 'blog', tone: 'text-violet-600 bg-violet-50 border-violet-100' },
    { label: 'Pages', value: String(livePages), detail: unpublishedPages ? `${unpublishedPages} unpublished` : 'All pages live', tab: 'pages', icon: 'pages', tone: 'text-blue-600 bg-blue-50 border-blue-100' },
    { label: 'Site sections', value: `${sectionsOn}/${Object.keys(state.sections).length}`, detail: 'Homepage blocks visible', tab: 'sections', icon: 'visibility', tone: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  ];
  const readiness: { label: string; detail: string; pass: boolean; tab: Tab }[] = [
    { label: 'Homepage is ready', detail: `${sectionsOn} of ${Object.keys(state.sections).length} sections visible`, pass: sectionsOn === Object.keys(state.sections).length, tab: 'sections' },
    { label: 'Navigation is complete', detail: `${state.nav.filter(n => n.visible).length} live menu links`, pass: state.nav.filter(n => n.visible).length >= 3, tab: 'sections' },
    { label: 'Sidebar is configured', detail: `${sidebarOn} standard widgets and ${(state.sidebar.widgets || []).filter(i => i.visible).length} custom sections`, pass: sidebarOn >= 3, tab: 'sidebar' },
    { label: 'SEO metadata coverage', detail: `${seoConfigured} search profiles managed in the content editors`, pass: seoConfigured >= 3, tab: 'pages' },
  ];
  const sectionLabels: Record<string, string> = { hero: 'Hero', auditTool: 'Audit form', results: 'Results', features: 'Features', howItWorks: 'How it works', whyAudit: 'Why audit', whoBenefits: 'Audiences', freeTools: 'Tools', fromBlog: 'Blog', cta: 'CTA', footer: 'Footer' };

  return (
    <div className="space-y-6">
      {/* Admin overview */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 md:px-8 md:py-8 text-white">
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-20 bottom-0 w-48 h-48 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300 mb-3">CMS Overview</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Good to see you. Your site is under control.</h2>
            <p className="text-sm md:text-base text-slate-300 max-w-2xl mt-2 leading-relaxed">Manage {state.settings.name}, publish content, tune SEO and control every public-facing section from this workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/" target="_blank" rel="noopener" className="px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 transition-colors">View live site ↗</a>
            <button type="button" onClick={() => go('sections')} className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold hover:bg-white/15 transition-colors">Manage visibility</button>
          </div>
        </div>
        <div className="relative grid sm:grid-cols-3 gap-3 mt-7 pt-5 border-t border-white/10">
          <div><p className="text-xs text-slate-400">Public content</p><p className="text-lg font-bold">{liveTools + publishedPosts + livePages} live items</p></div>
          <div><p className="text-xs text-slate-400">Publishing queue</p><p className={`text-lg font-bold ${openItems ? 'text-amber-300' : 'text-emerald-300'}`}>{openItems ? `${openItems} items to review` : 'Nothing waiting'}</p></div>
          <div><p className="text-xs text-slate-400">Browser storage</p><p className="text-lg font-bold text-slate-200">Saved automatically</p></div>
        </div>
      </section>

      {/* Primary content metrics */}
      <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <button key={card.label} type="button" onClick={() => go(card.tab)} className="group text-left bg-white rounded-2xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="flex items-start justify-between gap-3">
              <span className={`w-10 h-10 rounded-xl border flex items-center justify-center ${card.tone}`}><DashboardIcon type={card.icon} /></span>
              <span className="text-slate-300 group-hover:text-indigo-500 transition-colors"><DashboardIcon type="arrow" /></span>
            </div>
            <p className="text-3xl font-bold text-slate-900 mt-5">{card.value}</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{card.label}</p>
            <p className="text-xs text-slate-500 mt-1">{card.detail}</p>
          </button>
        ))}
      </section>

      <section className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)] gap-6 items-start">
        {/* Content and publishing */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-slate-100">
              <div><h3 className="font-bold text-slate-900">Recent content</h3><p className="text-sm text-slate-500 mt-0.5">The latest posts in your content library.</p></div>
              <button type="button" onClick={() => go('blog')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Manage posts →</button>
            </div>
            <div className="divide-y divide-slate-100">
              {latest.map(post => (
                <button key={post.slug} type="button" onClick={() => go('blog')} className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors flex flex-wrap items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${post.status === 'live' ? 'bg-emerald-500' : post.status === 'hidden' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-sm text-slate-800 truncate">{post.title}</span><span className="block text-xs text-slate-500 mt-0.5">{post.category} · {post.date} · {post.readTime}</span></span>
                  <Badge status={post.status} />
                </button>
              ))}
              {latest.length === 0 && <p className="px-6 py-8 text-sm text-slate-500">No blog posts yet. Start your first article.</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div><h3 className="font-bold text-slate-900">Content library</h3><p className="text-sm text-slate-500 mt-0.5">A quick view of every editable content type.</p></div><button type="button" onClick={() => go('tools')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Open library →</button></div>
            <div className="space-y-4">
              {[
                ['Tools', liveTools, hiddenTools + draftTools, state.tools.length, 'tools', 'bg-indigo-500'],
                ['Blog posts', publishedPosts, draftPosts, state.posts.length, 'blog', 'bg-violet-500'],
                ['Pages', livePages, unpublishedPages, state.pages.length, 'pages', 'bg-blue-500'],
              ].map(([label, live, pending, total, tab, color]) => {
                const l = Number(live), p = Number(pending), t = Number(total);
                return <button key={String(label)} type="button" onClick={() => go(tab as Tab)} className="w-full text-left group">
                  <div className="flex items-center justify-between text-sm mb-1.5"><span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{label}</span><span className="text-slate-500"><strong className="text-slate-800">{l}</strong> live · {p} not public</span></div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${t ? (l / t) * 100 : 0}%` }} /></div>
                </button>;
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div><h3 className="font-bold text-slate-900">Tool categories</h3><p className="text-sm text-slate-500 mt-0.5">Publishing status across the live tools directory.</p></div>
              <button type="button" onClick={() => go('tools')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Manage tools →</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {categoryStats.map(item => (
                <button key={item.category} type="button" onClick={() => go('toolcats')} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                  <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-indigo-600"><ToolIcon category={item.category} className="w-4 h-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 truncate">{item.label}</span><span className="block text-xs text-slate-500">{item.live} live · {item.offline} hidden/draft</span></span>
                  <span className="text-lg font-bold text-slate-800">{item.total}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Site readiness and quick actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-5"><div><h3 className="font-bold text-slate-900">Site readiness</h3><p className="text-sm text-slate-500 mt-0.5">A snapshot of what visitors can see.</p></div><div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${health >= 85 ? 'bg-emerald-50 text-emerald-700' : health >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{health}</div></div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4"><div className={`h-full rounded-full ${health >= 85 ? 'bg-emerald-500' : health >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${health}%` }} /></div>
            <div className="divide-y divide-slate-100">
              {readiness.map(r => (
                <button key={r.label} type="button" onClick={() => go(r.tab)} className="w-full flex items-start gap-3 py-3 text-left hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                  <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${r.pass ? 'bg-emerald-500' : 'bg-amber-500'}`}>{r.pass ? '✓' : '!'}</span>
                  <span><span className="block text-sm font-semibold text-slate-800">{r.label}</span><span className="block text-xs text-slate-500 mt-0.5">{r.detail}</span></span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900">Quick actions</h3>
            <p className="text-sm text-slate-500 mt-0.5 mb-4">The things you&apos;ll use most often.</p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-1 gap-2">
              {[
                ['Write a blog post', 'Create, optimise and publish an article.', 'blog', 'blog'],
                ['Add a new tool', 'Create a tool page and set its visibility.', 'tools', 'tools'],
                ['Edit sidebar', 'Reorder featured links and toggle widgets.', 'sidebar', 'sidebar'],
                ['Toggle homepage sections', 'Show or hide any public block.', 'sections', 'visibility'],
              ].map(([label, detail, tab, icon]) => (
                <button key={label} type="button" onClick={() => go(tab as Tab)} className="group flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-left transition-colors">
                  <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center transition-colors"><DashboardIcon type={icon as 'tools' | 'blog' | 'visibility' | 'sidebar'} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="block text-xs text-slate-500 truncate">{detail}</span></span>
                  <span className="text-slate-300 group-hover:text-indigo-500"><DashboardIcon type="arrow" /></span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
            <div className="flex items-start gap-3"><span className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0"><DashboardIcon type="seo" /></span><div><p className="font-bold text-indigo-950">Deployment reminder</p><p className="text-sm text-indigo-800 mt-1 leading-relaxed">Your edits save automatically in this browser. Export your CMS JSON from Settings before moving to a new device or publishing a new build.</p><button type="button" onClick={() => go('settings')} className="text-sm font-bold text-indigo-700 hover:text-indigo-900 mt-3">Open backup settings →</button></div></div>
          </div>
        </div>
      </section>

      {/* Visibility at a glance */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 className="font-bold text-slate-900">Homepage visibility</h3><p className="text-sm text-slate-500 mt-0.5">Switch to Sections &amp; Nav to change what is public.</p></div><button type="button" onClick={() => go('sections')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Manage sections →</button></div>
        <div className="flex flex-wrap gap-2">{Object.entries(state.sections).map(([key, isVisible]) => (
          <button key={key} type="button" onClick={() => go('sections')} className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${isVisible ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'}`}><span className={`w-1.5 h-1.5 rounded-full ${isVisible ? 'bg-emerald-500' : 'bg-slate-400'}`} />{sectionLabels[key] || key}</button>
        ))}</div>
      </section>
    </div>
  );
};

const ToolEditor: React.FC<{ tool: CmsTool; onClose: () => void }> = ({ tool, onClose }) => {
  const { state, saveTool, setSeo, clearSeo } = useCms();
  const [f, setF] = useState(tool);
  const [seo, setSeoDraft] = useState<SeoEntry>(state.seo[`tool:${tool.slug}`] || { title: `${tool.name} - Free Online SEO Tool | ${state.settings.name}`, description: tool.description });
  const set = (k: keyof CmsTool) => (v: unknown) => setF({ ...f, [k]: v } as CmsTool);
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Tool name"><input className={inputCls} value={f.name} onChange={e => set('name')(e.target.value)} /></Field>
        <Field label="URL slug" hint="Becomes /your-slug (top level)"><input className={inputCls} value={f.slug} onChange={e => set('slug')(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></Field>
      </div>
      <Field label="Description (shown under the title and in the directory)" hint="Plain text — one or two sentences, no HTML."><textarea rows={3} className={inputCls} value={f.description} onChange={e => set('description')(e.target.value)} /></Field>
      <div id="tool-about-editor">
        <Field label="About content (optional)" hint={f.slug === 'competitor-analysis' ? 'Added under “What is Website Competitor Analysis?” on the Competitor Analysis page. Leave empty to keep only the default copy.' : "Replaces the 'About the …' text shown on this tool's page. Leave empty to keep the shared default content."}><RichTextEditor value={f.about || ''} onChange={html => set('about')(html)} minHeight={240} placeholder="Write extra about content — headings, paragraphs, lists, images and links…" draftKey={draftId('tool-about', tool.slug)} ariaLabel="Tool about copy" /></Field>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Category" hint="Managed in the Tool Categories tab"><select className={inputCls} value={f.category} onChange={e => set('category')(e.target.value)} aria-label="Category">{!state.toolCategories.some(c => c.key === f.category) && f.category ? <option value={f.category}>{f.category}</option> : null}{state.toolCategories.map(c => <option key={c.id} value={c.key}>{c.name}</option>)}</select></Field>
        <Field label="Page state"><select className={inputCls} value={f.status} onChange={e => set('status')(e.target.value)}><option value="live">Live</option><option value="hidden">Hidden</option><option value="draft">Draft</option></select></Field>
        <Field label="Badge (optional)" hint="e.g. New, Popular"><input className={inputCls} value={f.badge || ''} onChange={e => set('badge')(e.target.value)} /></Field>
      </div>
      {!tool.builtin && (
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Input type"><select className={inputCls} value={f.input} onChange={e => set('input')(e.target.value)}>{['text', 'domain', 'url', 'keyword', 'none', 'twotext', 'image'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
          <Field label="Placeholder"><input className={inputCls} value={f.placeholder || ''} onChange={e => set('placeholder')(e.target.value)} /></Field>
        </div>
      )}
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <SeoMetaEditor value={seo} onChange={setSeoDraft} fallbackTitle={`${f.name} - Free Online SEO Tool | ${state.settings.name}`} fallbackDescription={f.description} routeHint={`/${f.slug || tool.slug}`} />
      <div className="flex flex-wrap items-center gap-2"><Btn onClick={() => { saveTool(tool.slug, f); if (f.slug !== tool.slug) clearSeo(`tool:${tool.slug}`); setSeo(`tool:${f.slug || tool.slug}`, seo); clearDraft(draftId('tool-about', tool.slug)); onClose(); }}>Save tool</Btn><Btn tone="ghost" onClick={onClose}>Cancel</Btn><span className="text-xs text-slate-400">About copy drafts autosave in this browser.</span></div>
    </div>
  );
};

const ToolsPane: React.FC = () => {
  const { state, setToolStatus, deleteTool } = useCms();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const filtered = useMemo(() => state.tools.filter(t => (cat === 'all' || t.category === cat) && (t.name.toLowerCase().includes(q.toLowerCase()) || t.slug.includes(q.toLowerCase()))), [state.tools, q, cat]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tools…" className={inputCls + ' max-w-xs'} />
        <select value={cat} onChange={e => setCat(e.target.value)} className={inputCls + ' max-w-[200px]'} aria-label="Filter by category"><option value="all">All categories</option>{state.toolCategories.map(c => <option key={c.id} value={c.key}>{c.name}</option>)}</select>
        <span className="text-sm text-slate-500">{filtered.length} tools · {filtered.filter(t => t.status === 'live').length} live</span>
        <Btn className="ml-auto" onClick={() => setCreating(true)}>+ Add tool</Btn>
      </div>
      {creating && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
          <p className="font-bold text-slate-900">New tool</p>
          <p className="text-sm text-slate-600">Create a tool entry with its own title, description, category and URL. It appears in the directory and gets its own page. Built-in tools keep their interactive engines; custom entries render their description and guidance.</p>
          <NewToolForm onDone={() => setCreating(false)} />
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filtered.map(t => (
          <React.Fragment key={t.slug}>
            <Row actions={
              <>
                <Badge status={t.status} />
                <Btn tone={t.status === 'live' ? 'danger' : 'ok'} onClick={() => setToolStatus(t.slug, t.status === 'live' ? 'hidden' : 'live')}>{t.status === 'live' ? 'Hide' : 'Publish'}</Btn>
                <Btn tone="ghost" onClick={() => setEdit(edit === t.slug ? null : t.slug)}>{edit === t.slug ? 'Close' : 'Edit'}</Btn>
                <Btn tone="ghost" onClick={() => { if (window.confirm(`Delete the tool “${t.name}”? This removes it from the public site and CMS. This action cannot be undone.`)) deleteTool(t.slug); }}>Delete</Btn>
              </>
            }>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold text-slate-800">{t.name}</p>
                <span className="text-xs text-slate-400 font-mono">/{t.slug}</span>
                <span className="text-xs text-slate-500">{toolCategoryName(state, t.category)}</span>
                {!t.builtin && <span className="text-[11px] font-bold text-indigo-600">CUSTOM</span>}
              </div>
            </Row>
            {edit === t.slug && <div className="p-4 bg-slate-50 border-b border-slate-100"><ToolEditor tool={t} onClose={() => setEdit(null)} /></div>}
          </React.Fragment>
        ))}
        {filtered.length === 0 && <p className="p-6 text-sm text-slate-500">No tools match.</p>}
      </div>
      <p className="text-xs text-slate-400">Built-in tools have live engines; hiding one removes it from the directory, sidebar and homepage instantly.</p>
    </div>
  );
};

const NewToolForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { state, addTool } = useCms();
  const [f, setF] = useState({ name: '', slug: '', description: '', category: 'management' as string, input: 'text' as CmsTool['input'], status: 'draft' as Status, placeholder: '', featuredImage: '', featuredImageAlt: '' });
  const autoSlug = f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Tool name"><input className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="URL slug" hint={autoSlug ? `/${autoSlug}` : ''}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} placeholder={autoSlug} /></Field>
      </div>
      <Field label="Description"><textarea rows={3} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Category" hint="Managed in the Tool Categories tab"><select className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} aria-label="Category">{state.toolCategories.map(c => <option key={c.id} value={c.key}>{c.name}</option>)}</select></Field>
        <Field label="Input type"><select className={inputCls} value={f.input} onChange={e => setF({ ...f, input: e.target.value as CmsTool['input'] })}>{['text', 'domain', 'url', 'keyword', 'none'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
        <Field label="State"><select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}><option value="draft">Draft</option><option value="live">Live</option><option value="hidden">Hidden</option></select></Field>
      </div>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <div className="flex gap-2"><Btn onClick={() => { addTool({ ...f, slug: autoSlug }); onDone(); }}>Create tool</Btn><Btn tone="ghost" onClick={onDone}>Cancel</Btn></div>
    </div>
  );
};

/** Public URL shown next to a category: the original top-level page for the
 *  built-in categories, /tools/category/<slug> for the ones added here. */
const categoryPaths = (cat: CmsToolCategory): { primary: string; alias: string } =>
  cat.builtin
    ? { primary: `/${cat.slug}`, alias: `/tools/category/${cat.slug}` }
    : { primary: `/tools/category/${cat.slug}`, alias: '' };

/**
 * Admin → Tool Categories.
 *
 * The tab that sits next to "Tools": every category the site publishes is
 * managed here — its name, its clean slug and the description shown under the
 * heading on the tools index and on the category's own page. The Category
 * dropdown in the tool editor lists exactly these categories, and the public
 * pages (mega menu, home cards, /free-seo-tools and the category pages) all
 * read from the same list, so an edit appears immediately.
 *
 * Each category is edited in place from its own row — there is deliberately no
 * "add a category" form here. `addToolCategory` stays in the CMS store so a
 * browser that already saved an extra category keeps loading it; it remains
 * fully editable in the list below.
 */
const ToolCategoriesPane: React.FC = () => {
  const { state, saveToolCategory, removeToolCategory, setSeo, clearSeo } = useCms();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; slug: string; description: string; seo: SeoEntry }>({ name: '', slug: '', description: '', seo: { title: '', description: '' } });
  /** Per-category autosave pulses for the "Content Below Tools" editor. */
  const [contentTicks, setContentTicks] = useState<Record<string, number>>({});
  const markContentSaved = (key: string) =>
    setContentTicks(t => ({ ...t, [key]: (t[key] || 0) + 1 }));

  const toolCount = (key: string) => state.tools.filter(t => t.category === key).length;

  const startEdit = (cat: CmsToolCategory) => {
    setEditing(cat.key);
    setDraft({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      seo: state.seo[`cat:${cat.key}`] || { title: '', description: '' },
    });
  };

  /**
   * Persist the row: the category fields through saveToolCategory, the meta
   * overrides through the shared per-page seo map. A title/description that
   * still equals the automatically generated copy is stored as blank rather
   * than as an override, so the live tool count in it keeps updating.
   */
  const saveCategoryRow = (cat: CmsToolCategory, auto: { title: string; description: string }) => {
    saveToolCategory(cat.key, { name: draft.name, slug: draft.slug || toolCategorySlug(draft.name), description: draft.description });
    const trim = (v?: string) => (v || '').trim();
    const entry: SeoEntry = {
      title: trim(draft.seo.title) && trim(draft.seo.title) !== trim(auto.title) ? trim(draft.seo.title) : '',
      description: trim(draft.seo.description) && trim(draft.seo.description) !== trim(auto.description) ? trim(draft.seo.description) : '',
      slug: trim(draft.seo.slug),
      noindex: !!draft.seo.noindex,
    };
    const key = `cat:${cat.key}`;
    if (!entry.title && !entry.description && !entry.slug && !entry.noindex) clearSeo(key);
    else setSeo(key, entry);
  };

  /** Where the tools of a deleted category move: the nearest one left. */
  const removalTarget = (key: string): string => {
    const cats = toolCategoriesOf(state);
    const index = cats.findIndex(c => c.key === key);
    const remaining = cats.filter(c => c.key !== key);
    return remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.name || '';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500">{state.toolCategories.length} categories · {state.tools.filter(t => t.status === 'live').length} live tools</span>
        <span className="text-xs text-slate-400 ml-auto">Categories appear in the mega menu, the tools directory and the tool editor dropdown.</span>
      </div>

      <section aria-label="Tool Categories" className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold text-slate-900">Tool Categories</h2>
          <span className="text-xs text-slate-500">Edit or delete a category — its name, slug and description drive every page that lists it.</span>
        </div>
        <p className="text-xs text-slate-400">Built-in categories keep their original page (e.g. /ip-tools) and also answer on /tools/category/&lt;slug&gt;.</p>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {state.toolCategories.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">No categories yet — add the first one above.</p>}
        {state.toolCategories.map(cat => {
          const paths = categoryPaths(cat);
          const count = toolCount(cat.key);
          // Named after the draft so renaming a category does not freeze the
          // automatic title (it embeds the live tool count) at the old name.
          const auto = categorySeoFallbacks(state, { ...cat, name: draft.name || cat.name }, state.settings.name || 'SEO Audit Tools');
          return (
            <React.Fragment key={cat.id}>
              <Row actions={
                <>
                  {cat.builtin && <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">Built-in</span>}
                  <Btn tone="ghost" onClick={() => (editing === cat.key ? setEditing(null) : startEdit(cat))}>{editing === cat.key ? 'Close' : 'Edit'}</Btn>
                  <Btn
                    tone="ghost"
                    disabled={state.toolCategories.length <= 1}
                    onClick={() => {
                      const target = removalTarget(cat.key);
                      if (!window.confirm(`Delete the category “${cat.name}”? Its ${count} tool(s) move to “${target}” so nothing disappears from the site.`)) return;
                      removeToolCategory(cat.key);
                      if (editing === cat.key) setEditing(null);
                    }}
                  >Delete</Btn>
                </>
              }>
                <div>
                  <p className="font-semibold text-slate-800">{cat.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{paths.primary}{paths.alias ? ` · ${paths.alias}` : ''}</p>
                </div>
                <span className="text-xs text-slate-500"><strong className="text-slate-700">{count}</strong> tool{count === 1 ? '' : 's'}</span>
              </Row>
              {editing === cat.key && (
                <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Field label="Category Name"><input className={inputCls} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} aria-label="Edit category name" /></Field>
                    <Field label="Category Slug" hint={draft.slug ? (cat.builtin ? `/tools/category/${draft.slug}` : `/tools/category/${draft.slug}`) : 'Auto-generates from the name'}>
                      <input className={inputCls} value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} aria-label="Edit category slug" />
                    </Field>
                  </div>
                  <Field label="Content Above Tools — appears after the heading, before the tools grid" hint={`${draft.description.trim().length} characters · the paragraph shown under the heading on this category's page and on /free-seo-tools. It is the default meta description for categories you add here; the eleven built-ins keep their own generated one until you set one below.`}>
                    <textarea rows={3} className={inputCls} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} aria-label="Edit content above tools" />
                  </Field>
                  {/* Content Below Tools — written here, shown on the public category
                      page after the last tool card and before the footer. It saves on
                      every change (no button), unlike the fields around it, which go
                      through "Save Changes". This panel is the only place that
                      writes CmsToolCategory.content — the Tools tab deliberately
                      has no copy of it. */}
                  <Field
                    label="Content Below Tools — Before Footer"
                    hint={`Shown on ${paths.primary}${paths.alias ? ` and ${paths.alias}` : ''} after the ${count} tool${count === 1 ? '' : 's'}. Headings, paragraphs, lists, links, bold, italic and images are supported — leave it empty and the section is hidden on the page.`}
                  >
                    <RichTextEditor
                      value={cat.content || ''}
                      onChange={html => { saveToolCategory(cat.key, { content: html }); markContentSaved(cat.key); }}
                      minHeight={240}
                      placeholder="Add detailed content, FAQs, and information here — appears after all tools and above the footer..."
                      draftKey={draftId('toolcat-content', cat.key)}
                      ariaLabel={`${cat.name} content below tools`}
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <AutosaveBadge tick={contentTicks[cat.key] || 0} />
                      <span className="text-xs text-slate-400">Nothing to press — this box saves as you type; the other fields need “Save Changes”.</span>
                    </div>
                  </Field>
                  {/* SEO & Meta Information — the same shared editor the tools,
                      posts, pages and the competitor page use: title, meta
                      description, canonical override, no-index toggle and a live
                      Google preview. Saved into the per-page seo map as
                      `cat:<key>`, which src/utils/seo.ts applies to the category
                      page on every navigation. */}
                  <SeoMetaEditor
                    value={draft.seo}
                    onChange={next => setDraft({ ...draft, seo: next })}
                    fallbackTitle={auto.title}
                    fallbackDescription={auto.description}
                    routeHint={paths.primary}
                    noindexControl="checkbox"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The row stays open so the "Saved ✓" confirmation is visible. */}
                    <SaveButton label="Save Changes" onSave={() => saveCategoryRow(cat, auto)} />
                    <Btn tone="ghost" onClick={() => setEditing(null)}>Close</Btn>
                    <span className="text-xs text-slate-400">Tools keep pointing at this category when its name changes.</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      </section>

      <p className="text-xs text-slate-400">Deleting a category never deletes tools: they move to the nearest remaining category. A category with no live tools yet shows an empty category page on the site.</p>
    </div>
  );
};

/**
 * Admin → Competitor Analysis.
 *
 * Every word of the public /competitor-analysis page: the hero block, the two
 * input labels, the compare button and its fallback note, then the About, How
 * to read the report and Benefits sections (each with a full WYSIWYG editor,
 * and benefits as repeatable blocks) and the FAQ list (rich-text answers,
 * add / remove / reorder). Saving shows the standard "Saved ✓" and the live
 * page picks the copy up instantly — layout, tool behaviour and URL unchanged.
 */
const CompetitorPane: React.FC = () => {
  const { state, setCompetitor, setSeo } = useCms();
  const [f, setF] = useState<CmsCompetitor>(state.competitor);
  const [seo, setSeoDraft] = useState<SeoEntry>(state.seo['competitor-analysis'] || {
    title: '', description: '',
  });
  const patch = (part: Partial<CmsCompetitor>) => setF(prev => ({ ...prev, ...part }));
  const save = () => { setCompetitor(f); setSeo('competitor-analysis', seo); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500">Page copy for <code className="font-mono text-slate-600">/competitor-analysis</code> · every section below is editable</span>
        <button type="button" onClick={() => navigate('/competitor-analysis')} className="ml-auto text-sm font-semibold text-indigo-600 hover:text-indigo-700">Preview page →</button>
      </div>

      <section aria-label="Competitor Analysis" aria-labelledby="competitor-pane" className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="competitor-pane" className="font-bold text-slate-900">Competitor Analysis</h2>
          <span className="text-xs text-slate-500">Hero, input labels, button, fallback note, the three content sections and the FAQs — one editor per section.</span>
        </div>

        {/* ---- page header & intro ---- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Page header &amp; intro</p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Hero title" hint="The page's main heading (H1)."><input className={inputCls} value={f.heroTitle} onChange={e => patch({ heroTitle: e.target.value })} aria-label="Hero title" /></Field>
            <Field label="Subtitle" hint="Small line above the title."><input className={inputCls} value={f.heroSubtitle} onChange={e => patch({ heroSubtitle: e.target.value })} aria-label="Hero subtitle" /></Field>
          </div>
          <Field label="Intro paragraph" hint={`${f.heroIntro.trim().length} characters — shown under the title.`}>
            <textarea rows={3} className={inputCls} value={f.heroIntro} onChange={e => patch({ heroIntro: e.target.value })} aria-label="Intro paragraph" />
          </Field>
        </div>

        {/* ---- tool input area ---- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tool input area</p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Label — your website"><input className={inputCls} value={f.yourLabel} onChange={e => patch({ yourLabel: e.target.value })} aria-label="Your website label" /></Field>
            <Field label="Label — competitor website"><input className={inputCls} value={f.theirLabel} onChange={e => patch({ theirLabel: e.target.value })} aria-label="Competitor website label" /></Field>
            <Field label="Button text" hint="The ↗ arrow is added automatically."><input className={inputCls} value={f.buttonText} onChange={e => patch({ buttonText: e.target.value })} aria-label="Button text" /></Field>
            <Field label="Fallback note"><input className={inputCls} value={f.fallbackNote} onChange={e => patch({ fallbackNote: e.target.value })} aria-label="Fallback note" /></Field>
          </div>
        </div>

        {/* ---- about ---- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Section — about the tool</p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Eyebrow text"><input className={inputCls} value={f.aboutEyebrow} onChange={e => patch({ aboutEyebrow: e.target.value })} aria-label="About eyebrow" /></Field>
            <Field label="Section heading"><input className={inputCls} value={f.aboutHeading} onChange={e => patch({ aboutHeading: e.target.value })} aria-label="About heading" /></Field>
          </div>
          <Field label="Section content" hint="Visual editor — headings, paragraphs, lists, links, images, colour and alignment. Switch to the Code tab for raw HTML.">
            <RichTextEditor value={f.aboutContent} onChange={html => patch({ aboutContent: html })} minHeight={240} placeholder="Write the about section…" draftKey={draftId('competitor', 'about')} ariaLabel="About section content" />
          </Field>
        </div>

        {/* ---- how to read ---- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Section — how to read the report</p>
          <Field label="Section heading"><input className={inputCls} value={f.howToHeading} onChange={e => patch({ howToHeading: e.target.value })} aria-label="How to read heading" /></Field>
          <Field label="Section content" hint="Visual editor — the numbered list below is the default; edit the steps or rewrite the whole section.">
            <RichTextEditor value={f.howToContent} onChange={html => patch({ howToContent: html })} minHeight={220} placeholder="Write the steps…" draftKey={draftId('competitor', 'howto')} ariaLabel="How to read section content" />
          </Field>
        </div>

        {/* ---- benefits: one editor for the whole section ---- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Section — benefits</p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Section heading"><input className={inputCls} value={f.benefitsHeading} onChange={e => patch({ benefitsHeading: e.target.value })} aria-label="Benefits heading" /></Field>
            <Field label="Section intro (optional)" hint={`${f.benefitsIntro.trim().length} characters`}><input className={inputCls} value={f.benefitsIntro} onChange={e => patch({ benefitsIntro: e.target.value })} aria-label="Benefits intro" /></Field>
          </div>
          <Field label="Benefits content" hint="One editor for the whole section — make each benefit a Heading 3 and the words under it become that card's text.">
            <RichTextEditor value={f.benefitsContent} onChange={html => patch({ benefitsContent: html })} minHeight={220} placeholder="Heading 3 for a benefit title, then its description…" draftKey={draftId('competitor', 'benefits')} ariaLabel="Benefits content" />
          </Field>
        </div>

        {/* ---- FAQs: one editor for the whole section ---- */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Section — FAQs</p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Eyebrow text"><input className={inputCls} value={f.faqEyebrow} onChange={e => patch({ faqEyebrow: e.target.value })} aria-label="FAQ eyebrow" /></Field>
            <Field label="Section heading"><input className={inputCls} value={f.faqHeading} onChange={e => patch({ faqHeading: e.target.value })} aria-label="FAQ heading" /></Field>
          </div>
          <Field label="FAQs content" hint="One editor for the whole section — make each question a Heading 3 and the words under it become its collapsible answer.">
            <RichTextEditor value={f.faqsContent} onChange={html => patch({ faqsContent: html })} minHeight={260} placeholder="Heading 3 for a question, then the answer…" draftKey={draftId('competitor', 'faqs')} ariaLabel="FAQs content" />
          </Field>
        </div>

        <SeoMetaEditor value={seo} onChange={setSeoDraft} fallbackTitle={`SEO Competitor Analysis — Compare Two Websites Free | ${state.settings.name}`} fallbackDescription="Compare your website with a competitor: overall SEO scores, domain registration, on-page checks, Google-style SERP previews and a two-column full audit. Free, no sign-up." routeHint="/competitor-analysis" />

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton label="Save Changes" onSave={save} />
          <Btn tone="ghost" onClick={() => setF(defaultCompetitor)}>Reset fields to default copy</Btn>
          <button type="button" onClick={() => navigate('/competitor-analysis')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Open the live page →</button>
          <span className="text-xs text-slate-400">Saving updates /competitor-analysis instantly — no reload.</span>
        </div>
      </section>
    </div>
  );
};

const PostEditor: React.FC<{ post: CmsPost; onClose: () => void }> = ({ post, onClose }) => {
  const { state, savePost, setSeo, clearSeo } = useCms();
  const [f, setF] = useState(post);
  const [seo, setSeoDraft] = useState<SeoEntry>(state.seo[`post:${post.slug}`] || { title: '', description: '' });
  const [seoTick, setSeoTick] = useState(0);
  // Generated copy for the draft, so the preview and the "store only real
  // overrides" rule always match what the article page renders.
  const auto = postSeoFallbacks(f);
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
      <SectionCard title="Post Details" description="The headline, the clean URL and the byline shown on the article.">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="URL slug" hint={`/blog/${f.slug}`}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></Field>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Author" hint="Shown as the article byline."><input className={inputCls} value={f.author} onChange={e => setF({ ...f, author: e.target.value })} /></Field>
          <Field label="Publish date"><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Read time" hint="e.g. 6 min read"><input className={inputCls} value={f.readTime} onChange={e => setF({ ...f, readTime: e.target.value })} /></Field>
        </div>
      </SectionCard>
      <SectionCard title="Content" description="The excerpt used on cards, the keyword list and the article body.">
        <Field label="Excerpt / summary" hint="Plain text — used on cards, in the blog list and as the meta description fallback."><textarea rows={2} className={inputCls} value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} /></Field>
        <Field label="Keywords (comma separated)" hint="Plain text — one comma-separated list."><input className={inputCls} value={f.keywords.join(', ')} onChange={e => setF({ ...f, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></Field>
        <Field label="Body" hint="Visual editor — headings, lists, links, images, colour and alignment. Switch to the Code tab for raw HTML."><RichTextEditor value={f.content} onChange={html => setF({ ...f, content: html })} minHeight={320} placeholder="Write your blog post…" draftKey={draftId('blog', post.slug)} ariaLabel="Blog post body" /></Field>
      </SectionCard>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <SectionCard title="Category" description="Which blog category files this article — managed in Blog Categories above.">
        <AssignCategory value={f.category} onChange={name => setF({ ...f, category: name })} />
      </SectionCard>
      <SeoMetaEditor value={seo} autosaveTick={seoTick} onChange={entry => { setSeoDraft(entry); setSeoTick(t => t + 1); persistSeo(setSeo, clearSeo, `post:${post.slug}`, entry, auto); }} fallbackTitle={auto.title} fallbackDescription={auto.description} routeHint={`/blog/${f.slug || post.slug}`} />
      <div className="flex flex-wrap items-center gap-2"><Btn onClick={() => { savePost(post.slug, f); if (f.slug !== post.slug) { clearSeo(`post:${post.slug}`); clearDraft(draftId('blog', post.slug)); } persistSeo(setSeo, clearSeo, `post:${f.slug || post.slug}`, seo, auto); clearDraft(draftId('blog', post.slug)); onClose(); }}>Save post</Btn><Btn tone="ghost" onClick={onClose}>Cancel</Btn><span className="text-xs text-slate-400">Drafts save in this browser while you type.</span></div>
    </div>
  );
};

const BlogCategoriesSection: React.FC = () => {
  const { state, addBlogCategory, saveBlogCategory, setBlogCategoryVisible, removeBlogCategory, setSeo, clearSeo } = useCms();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [intro, setIntro] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', slug: '', description: '' });
  // SEO & Meta drafts: `createSeo` belongs to the new-category form above,
  // `editSeo` to the row currently open. Both persist straight into the
  // per-page seo map under `blogcat:<slug>`, which src/utils/seo.ts reads for
  // the public /blog/category/<slug> (or top-level) page.
  const [createSeo, setCreateSeo] = useState<SeoEntry>({ title: '', description: '' });
  const [editSeo, setEditSeo] = useState<SeoEntry>({ title: '', description: '' });
  const [editTick, setEditTick] = useState(0);

  const postCount = (cat: CmsBlogCategory) => state.posts.filter(p => p.category === cat.name).length;
  const autoSlug = blogCategorySlug(name);
  const effectiveSlug = slugTouched ? slug : autoSlug;
  // The copy a new category gets when its SEO fields are left blank.
  const createAuto = blogCategorySeoFallbacks(state, { name: name.trim() || 'New category' });

  const create = () => {
    const clean = name.trim();
    if (!clean) return;
    const created = addBlogCategory(clean);
    // One follow-up patch: a typed slug and/or the intro text. Doing both in a
    // single call matters because saveBlogCategory looks the category up by its
    // current slug, which the slug change would otherwise move.
    const patch: Partial<CmsBlogCategory> = {};
    if (slugTouched && slug.trim()) { patch.name = clean; patch.slug = slug.trim(); }
    if (intro.trim()) patch.description = intro.trim();
    if (Object.keys(patch).length) saveBlogCategory(created, patch);
    persistSeo(setSeo, clearSeo, `blogcat:${created}`, createSeo, blogCategorySeoFallbacks(state, { name: clean }));
    setCreateSeo({ title: '', description: '' });
    setName('');
    setSlug('');
    setSlugTouched(false);
    setIntro('');
  };

  const startEdit = (cat: CmsBlogCategory) => {
    setEditing(cat.id);
    setDraft({ name: cat.name, slug: cat.slug, description: cat.description || '' });
    setEditSeo(state.seo[`blogcat:${cat.slug}`] || { title: '', description: '' });
  };

  /** Persist the row: name/slug/intro through saveBlogCategory, the meta
   *  overrides through the seo map. The seo key follows the slug when it
   *  changes. */
  const saveEdit = (cat: CmsBlogCategory) => {
    const nextSlug = draft.slug || blogCategorySlug(draft.name);
    saveBlogCategory(cat.slug, { name: draft.name, slug: nextSlug, description: draft.description });
    if (nextSlug !== cat.slug) clearSeo(`blogcat:${cat.slug}`);
    persistSeo(setSeo, clearSeo, `blogcat:${nextSlug}`, editSeo, blogCategorySeoFallbacks(state, { name: draft.name || cat.name }));
    setEditing(null);
  };

  return (
    <section aria-label="Blog Categories" className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold text-slate-900">Blog Categories</h2>
        <span className="text-xs text-slate-500">{state.blogCategories.length} categor{state.blogCategories.length === 1 ? 'y' : 'ies'} · {state.blogCategories.filter(c => c.visible).length} visible</span>
        <span className="text-xs text-slate-400 ml-auto">Each one becomes /blog/category/&lt;slug&gt; and appears in the post editor dropdown.</span>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
        <SectionCard title="Category Details" description="The name and the clean URL this category is published on.">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} placeholder="SEO Tips" aria-label="Category Name" /></Field>
            <Field label="URL slug" hint={effectiveSlug ? `/blog/category/${effectiveSlug}` : 'Auto-generates from the name — edit if you want a different URL.'}>
              <input className={inputCls} value={effectiveSlug} onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')); }} placeholder="seo-tips" aria-label="Category Slug" />
            </Field>
          </div>
        </SectionCard>
        <SectionCard title="Description" description="Category intro text — the paragraph shown under the heading on the public category page.">
          <Field label="Description" hint="Leave blank for the automatic summary."><textarea rows={2} className={inputCls} value={intro} onChange={e => setIntro(e.target.value)} placeholder="A one or two sentence intro for this category" aria-label="Category description" /></Field>
        </SectionCard>
        <SeoMetaEditor value={createSeo} onChange={setCreateSeo} fallbackTitle={createAuto.title} fallbackDescription={createAuto.description} routeHint={blogCategoryHref(effectiveSlug || 'new-category')} />
        <div className="flex flex-wrap items-center gap-2"><SaveButton label="Add category" onSave={create} /></div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {state.blogCategories.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">No categories yet — add the first one above.</p>}
        {state.blogCategories.map(cat => (
          <React.Fragment key={cat.id}>
            <Row actions={
              <>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cat.visible ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{cat.visible ? 'Visible' : 'Hidden'}</span>
                <Btn tone={cat.visible ? 'ghost' : 'ok'} onClick={() => setBlogCategoryVisible(cat.slug, !cat.visible)}>{cat.visible ? 'Hide' : 'Show'}</Btn>
                <Btn tone="ghost" onClick={() => (editing === cat.id ? setEditing(null) : startEdit(cat))}>{editing === cat.id ? 'Close' : 'Edit'}</Btn>
                <Btn tone="ghost" onClick={() => { if (window.confirm(`Remove the category “${cat.name}”? ${postCount(cat)} post(s) will move to ${UNCATEGORIZED}.`)) { removeBlogCategory(cat.slug); clearSeo(`blogcat:${cat.slug}`); if (editing === cat.id) setEditing(null); } }}>Remove</Btn>
              </>
            }>
              <div>
                <p className="font-semibold text-slate-800">{cat.name}</p>
                <p className="text-xs text-slate-500 font-mono">{blogCategoryHref(cat.slug)}{cat.description ? ' · intro set' : ''}</p>
              </div>
              <span className="text-xs text-slate-500"><strong className="text-slate-700">{postCount(cat)}</strong> post{postCount(cat) === 1 ? '' : 's'}</span>
            </Row>
            {editing === cat.id && (
              <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-4">
                <SectionCard title="Category Details" description="The name, the clean URL and the intro text shown at the top of the category page.">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Name"><input className={inputCls} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} aria-label="Edit category name" /></Field>
                    <Field label="URL slug" hint={`/blog/category/${draft.slug || blogCategorySlug(draft.name)}`}>
                      <input className={inputCls} value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} aria-label="Edit category slug" />
                    </Field>
                  </div>
                  <Field label="Description" hint="Category intro text — shown as the paragraph under the heading on the public category page. Leave blank for the automatic summary."><textarea rows={2} className={inputCls} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} aria-label="Edit category description" /></Field>
                </SectionCard>
                <SeoMetaEditor value={editSeo} autosaveTick={editTick} onChange={entry => { setEditSeo(entry); setEditTick(t => t + 1); persistSeo(setSeo, clearSeo, `blogcat:${cat.slug}`, entry, blogCategorySeoFallbacks(state, { name: draft.name || cat.name })); }} fallbackTitle={blogCategorySeoFallbacks(state, { name: draft.name || cat.name }).title} fallbackDescription={blogCategorySeoFallbacks(state, { name: draft.name || cat.name }).description} routeHint={blogCategoryHref(cat.slug)} />
                <div className="flex flex-wrap items-center gap-2">
                  <SaveButton label="Save Changes" onSave={() => saveEdit(cat)} />
                  <Btn tone="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
                  <span className="text-xs text-slate-400">Renaming keeps the posts in this category.</span>
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

const BlogPane: React.FC = () => {
  const { state, setPostStatus, deletePost } = useCms();
  const [edit, setEdit] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><span className="text-sm text-slate-500">{state.posts.length} posts · {state.posts.filter(p => p.status === 'live').length} published</span><Btn className="ml-auto" onClick={() => setCreating(true)}>+ Write post</Btn></div>
      <BlogCategoriesSection />
      {creating && <NewPostForm onDone={() => setCreating(false)} />}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {state.posts.map(p => (
          <React.Fragment key={p.slug}>
            <Row actions={
              <>
                <Badge status={p.status} />
                <Btn tone={p.status === 'live' ? 'danger' : 'ok'} onClick={() => setPostStatus(p.slug, p.status === 'live' ? 'hidden' : 'live')}>{p.status === 'live' ? 'Unpublish' : 'Publish'}</Btn>
                <Btn tone="ghost" onClick={() => setEdit(edit === p.slug ? null : p.slug)}>{edit === p.slug ? 'Close' : 'Edit'}</Btn>
                <Btn tone="ghost" onClick={() => { if (window.confirm(`Delete the blog post “${p.title}”? This removes it from the public site and CMS. This action cannot be undone.`)) deletePost(p.slug); }}>Delete</Btn>
              </>
            }>
              <div><p className="font-semibold text-slate-800 line-clamp-1">{p.title}</p>
                <p className="text-xs text-slate-500">{p.category} · {p.date} · {p.readTime} · <span className="font-mono">/blog/{p.slug}</span></p></div>
            </Row>
            {edit === p.slug && <div className="p-4 bg-slate-50 border-b border-slate-100"><PostEditor post={p} onClose={() => setEdit(null)} /></div>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const NewPostForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { addPost, setSeo, clearSeo } = useCms();
  const [f, setF] = useState({ title: '', slug: '', excerpt: '', content: '', category: 'Google & Indexing', author: '', date: '', readTime: '', status: 'draft' as Status, featuredImage: '', featuredImageAlt: '' });
  const [seo, setSeoDraft] = useState<SeoEntry>({ title: '', description: '' });
  const slug = f.slug || f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // The copy this post gets when the fields below are left blank.
  const auto = postSeoFallbacks({ title: f.title, excerpt: f.excerpt });
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
      <p className="font-bold text-slate-900">New blog post</p>
      <SectionCard title="Post Details" description="The headline, the clean URL and the byline shown on the article.">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Slug" hint={slug ? `/blog/${slug}` : ''}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} placeholder={slug} /></Field>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Author" hint="Shown as the article byline. Leave blank for the default."><input className={inputCls} value={f.author} onChange={e => setF({ ...f, author: e.target.value })} placeholder="SAT Team" /></Field>
          <Field label="Publish date" hint="Leave blank for today."><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Read time" hint="e.g. 6 min read"><input className={inputCls} value={f.readTime} onChange={e => setF({ ...f, readTime: e.target.value })} placeholder="6 min read" /></Field>
        </div>
        <Field label="State" hint="Published posts are public; drafts and hidden posts are not."><select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}><option value="draft">Draft</option><option value="live">Published</option><option value="hidden">Hidden</option></select></Field>
      </SectionCard>
      <SectionCard title="Content" description="The excerpt used on cards and the article body.">
        <Field label="Excerpt" hint="Plain text — shown on blog cards."><textarea rows={2} className={inputCls} value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} /></Field>
        <Field label="Body" hint="Visual editor — headings, lists, links, images, colour and alignment. Your typing is auto-saved as a browser draft."><RichTextEditor value={f.content} onChange={html => setF({ ...f, content: html })} minHeight={280} placeholder="Write your blog post…" draftKey={draftId('blog', 'new-post')} ariaLabel="New blog post body" /></Field>
      </SectionCard>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <SectionCard title="Category" description="Which blog category files this article — managed in Blog Categories above.">
        <AssignCategory value={f.category} onChange={name => setF({ ...f, category: name })} />
      </SectionCard>
      <SeoMetaEditor value={seo} onChange={setSeoDraft} fallbackTitle={auto.title} fallbackDescription={auto.description} routeHint={`/blog/${slug}`} />
      <div className="flex flex-wrap items-center gap-2"><Btn onClick={() => { addPost({ ...f, slug, author: f.author || undefined, date: f.date || undefined, readTime: f.readTime || undefined, metaTitle: seo.title || auto.title, metaDescription: seo.description }); persistSeo(setSeo, clearSeo, `post:${slug}`, seo, auto); clearDraft(draftId('blog', 'new-post')); onDone(); }}>Create post</Btn><Btn tone="ghost" onClick={onDone}>Cancel</Btn><span className="text-xs text-slate-400">Unsaved work is kept as a browser draft.</span></div>
    </div>
  );
};
const PageEditor: React.FC<{ page: CmsPage; onClose: () => void }> = ({ page, onClose }) => {
  const { state, savePage, setSeo, clearSeo } = useCms();
  const [f, setF] = useState(page);
  const [seo, setSeoDraft] = useState<SeoEntry>(state.seo[`page:${page.slug}`] || { title: '', description: '' });
  const [seoTick, setSeoTick] = useState(0);
  // Generated copy for the draft, so the preview and the "store only real
  // overrides" rule always match what the page renders.
  const auto = pageSeoFallbacks(f);
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
      <SectionCard title="Page Details" description="The name, the clean URL and whether this page is public.">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Page title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="URL slug" hint={`/${f.slug}`}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></Field>
        </div>
        <Field label="Page state" hint="Live pages are public; drafts and hidden pages are not."><select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}><option value="live">Live</option><option value="hidden">Hidden</option><option value="draft">Draft</option></select></Field>
      </SectionCard>
      <SectionCard title="Content" description="The page body, written in the visual editor.">
        <Field label="Page content" hint="Visual editor — headings, paragraphs, lists, tables, links, images, colour and alignment. Switch to the Code tab for raw HTML.">
          <RichTextEditor value={f.content || ''} onChange={html => setF({ ...f, content: html })} minHeight={360} placeholder="Write this page…" draftKey={draftId('page', page.id)} ariaLabel="Page content" />
        </Field>
      </SectionCard>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <SeoMetaEditor value={seo} autosaveTick={seoTick} onChange={entry => { setSeoDraft(entry); setSeoTick(t => t + 1); persistSeo(setSeo, clearSeo, `page:${page.slug}`, entry, auto); }} fallbackTitle={auto.title} fallbackDescription={auto.description} routeHint={`/${f.slug || page.slug}`} />
      <div className="flex flex-wrap items-center gap-2"><Btn onClick={() => { savePage(page.id, f); if (f.slug !== page.slug) clearSeo(`page:${page.slug}`); persistSeo(setSeo, clearSeo, `page:${f.slug || page.slug}`, seo, auto); clearDraft(draftId('page', page.id)); onClose(); }}>Save page</Btn><Btn tone="ghost" onClick={onClose}>Cancel</Btn><span className="text-xs text-slate-400">Text drafts autosave in this browser.</span></div>
    </div>
  );
};
const pageWords = (p: CmsPage): number =>
  (p.content || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').trim().split(/\s+/).filter(Boolean).length;

const PagesPane: React.FC = () => {
  const { state, setPageStatus, deletePage } = useCms();
  const [edit, setEdit] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500">{state.pages.length} pages · {state.pages.filter(p => p.status === 'live').length} live</span>
        <Btn className="ml-auto" onClick={() => setCreating(true)}>+ Create page</Btn>
      </div>
      {creating && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
          <p className="font-bold text-slate-900 mb-3">New page</p>
          <NewPageForm onDone={() => setCreating(false)} />
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {state.pages.map(p => (
          <React.Fragment key={p.id}>
            <Row actions={
              <>
                <Badge status={p.status} />
                <Btn tone={p.status === 'live' ? 'danger' : 'ok'} onClick={() => setPageStatus(p.id, p.status === 'live' ? 'hidden' : 'live')}>{p.status === 'live' ? 'Hide' : 'Publish'}</Btn>
                <Btn tone="ghost" onClick={() => setEdit(edit === p.id ? null : p.id)}>{edit === p.id ? 'Close' : 'Edit'}</Btn>
                <Btn tone="ghost" onClick={() => { if (window.confirm(`Delete the page “${p.title}”? This removes it from the public site and CMS. This action cannot be undone.`)) deletePage(p.id); }}>Delete</Btn>
              </>
            }>
              <div><p className="font-semibold text-slate-800">{p.title}</p><p className="text-xs text-slate-500 font-mono">/{p.slug} · {pageWords(p)} words</p></div>
            </Row>
            {edit === p.id && <div className="p-4 bg-slate-50 border-b border-slate-100"><PageEditor page={p} onClose={() => setEdit(null)} /></div>}
          </React.Fragment>
        ))}
        {state.pages.length === 0 && <p className="p-6 text-sm text-slate-500">No pages yet.</p>}
      </div>
      <p className="text-xs text-slate-400">Pages render at <code>/your-slug</code> with their own SEO title, meta description and robots directive. Add them to your navigation from the Sections &amp; Nav tab.</p>
    </div>
  );
};

const NewPageForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { addPage, setSeo, clearSeo } = useCms();
  const [f, setF] = useState({ title: '', slug: '', metaTitle: '', metaDescription: '', content: '', status: 'draft' as Status, featuredImage: '', featuredImageAlt: '' });
  const [seo, setSeoDraft] = useState<SeoEntry>({ title: '', description: '' });
  const slug = f.slug || f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // The copy this page gets when the fields below are left blank.
  const auto = pageSeoFallbacks({ title: f.title });
  return (
    <div className="space-y-4">
      <SectionCard title="Page Details" description="The name, the clean URL and whether this page is public.">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Slug" hint={slug ? `/${slug}` : ''}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} placeholder={slug} /></Field>
        </div>
        <Field label="Page state" hint="Live pages are public; drafts and hidden posts are not."><select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}><option value="draft">Draft</option><option value="live">Live</option><option value="hidden">Hidden</option></select></Field>
      </SectionCard>
      <SectionCard title="Content" description="The page body, written in the visual editor.">
        <Field label="Page content" hint="Visual editor — headings, paragraphs, lists, links, images and more. Your typing is auto-saved as a browser draft."><RichTextEditor value={f.content} onChange={html => setF({ ...f, content: html })} minHeight={240} placeholder="Write this page…" draftKey={draftId('page', 'new-page')} ariaLabel="New page content" /></Field>
      </SectionCard>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <SeoMetaEditor value={seo} onChange={setSeoDraft} fallbackTitle={auto.title} fallbackDescription={auto.description} routeHint={`/${slug}`} />
      <div className="flex flex-wrap items-center gap-2"><Btn onClick={() => { addPage({ ...f, slug, metaTitle: seo.title || auto.title, metaDescription: seo.description }); persistSeo(setSeo, clearSeo, `page:${slug}`, seo, auto); clearDraft(draftId('page', 'new-page')); onDone(); }}>Create page</Btn><Btn tone="ghost" onClick={onDone}>Cancel</Btn><span className="text-xs text-slate-400">Unsaved work is kept as a browser draft.</span></div>
    </div>
  );
};
/**
 * "Assign Category" dropdown for the blog post editor.
 *
 * Options come straight from the CMS category list, so a category added in
 * Admin → Blog posts → Blog Categories appears here immediately. A post whose
 * saved category is not in the list yet (older content) keeps that value as an
 * option instead of being silently reassigned, and "+ Add new category…" adds
 * one without leaving the editor and assigns it to the post.
 */
const AssignCategory: React.FC<{ value: string; onChange: (name: string) => void; ariaLabel?: string }> = ({ value, onChange, ariaLabel = 'Assign Category' }) => {
  const { state, addBlogCategory } = useCms();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const visible = state.blogCategories.filter(c => c.visible);
  const known = visible.map(c => c.name);
  const valueInList = known.includes(value) || value === UNCATEGORIZED;
  const slug = blogCategorySlug(name);
  const submit = () => {
    const clean = name.trim();
    if (!clean) return;
    addBlogCategory(clean);
    onChange(clean);
    setName('');
    setAdding(false);
  };
  return (
    <Field label="Assign Category" hint={slug ? `Creates /blog/category/${slug}` : 'New categories appear in the blog list immediately.'}>
      <div className="flex flex-wrap items-center gap-2">
        <select className={inputCls + ' max-w-[260px]'} value={valueInList ? value : ''} onChange={e => { if (e.target.value === '__new__') { setAdding(true); return; } onChange(e.target.value); }} aria-label={ariaLabel}>
          {!valueInList && value ? <option value="">{value}</option> : null}
          {visible.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
          <option value="__new__">+ Add new category…</option>
        </select>
        <Btn tone="ghost" onClick={() => setAdding(a => !a)}>{adding ? 'Cancel' : '+ New category'}</Btn>
      </div>
      {adding && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input className={inputCls + ' max-w-[260px]'} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} placeholder="Category name, e.g. SEO Tips" aria-label="New category name" />
          <SaveButton label="Add &amp; assign" onSave={submit} />
        </div>
      )}
    </Field>
  );
};

/** Purple save button. Runs the save, then shows "Saved ✓" for 2.5 seconds. */
const SaveButton: React.FC<{ onSave: () => void; label?: string; className?: string }> = ({ onSave, label = 'Save Changes', className = '' }) => {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(id);
  }, [saved]);
  return (
    <button
      type="button"
      onClick={() => { onSave(); setSaved(true); }}
      className={`px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 shadow-sm transition-colors ${className}`}
    >
      <span role="status" aria-live="polite">{saved ? 'Saved ✓' : label}</span>
    </button>
  );
};

/**
 * Status line for an editor that writes straight to the CMS on every change
 * (no button to press). `tick` is bumped by the editor on each save, so the
 * line reads "Saved ✓" for 2.5 seconds after a keystroke and falls back to
 * the quiet "Saves automatically" note the rest of the time — the same
 * confirmation wording as SaveButton.
 */
const AutosaveBadge: React.FC<{ tick: number }> = ({ tick }) => {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!tick) return;
    setSaved(true);
    const id = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(id);
  }, [tick]);
  return saved
    ? <span role="status" aria-live="polite" className="text-xs font-bold text-emerald-600">Saved ✓</span>
    : <span className="text-xs text-slate-400">Saved automatically</span>;
};

/** Shared row editor for the header nav and the footer menu: label, URL,
 *  visible/hidden toggle and remove. */
const MenuRowEditor: React.FC<{
  label: string;
  href: string;
  visible: boolean;
  onLabel: (value: string) => void;
  onHref: (value: string) => void;
  onToggle: () => void;
  onRemove: () => void;
  /** Shown instead of the URL field for a row that has no URL of its own. */
  hrefNote?: string;
}> = ({ label, href, visible, onLabel, onHref, onToggle, onRemove, hrefNote }) => (
  <div className="flex flex-wrap items-center gap-2">
    <input className={inputCls + ' max-w-[200px]'} value={label} onChange={e => onLabel(e.target.value)} placeholder="Label" aria-label="Link label" />
    {hrefNote
      ? <span className={inputCls + ' max-w-[240px] font-mono text-xs bg-slate-50 text-slate-500 flex items-center'} title={hrefNote}>{hrefNote}</span>
      : <input className={inputCls + ' max-w-[240px] font-mono text-xs'} value={href} onChange={e => onHref(e.target.value)} placeholder="/free-seo-tools" aria-label="Link URL" />}
    <Btn tone={visible ? 'ghost' : 'danger'} onClick={onToggle}>{visible ? 'Visible' : 'Hidden'}</Btn>
    <Btn tone="ghost" onClick={onRemove}>Remove</Btn>
  </div>
);

const newLinkId = () => Math.random().toString(36).slice(2, 9);

/** One footer column: its own section title, unlimited links (label + URL +
 *  visible/hide + remove), its own + Add and its own Save Changes button. */
const FooterColumnEditor: React.FC<{
  index: number;
  column: FooterColumn;
  onSave: (column: FooterColumn) => void;
}> = ({ index, column, onSave }) => {
  const [title, setTitle] = useState(column.title);
  const [links, setLinks] = useState<FooterLink[]>(() => column.links.map(l => ({ ...l })));

  // Re-sync when the stored column changes (import, reset, save elsewhere).
  useEffect(() => {
    setTitle(column.title);
    setLinks(column.links.map(l => ({ ...l })));
  }, [column]);

  const patch = (i: number, changes: Partial<FooterLink>) =>
    setLinks(links.map((link, j) => (j === i ? { ...link, ...changes } : link)));

  return (
    <div role="group" aria-label={`Footer column ${index + 1}`} className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div>
        <h4 className="font-bold text-slate-800 text-sm">Column {index + 1} — {column.title || 'Footer column'}</h4>
        <p className="text-xs text-slate-500">Its heading and links in the public footer. Hidden rows stay saved but are not rendered.</p>
      </div>
      <Field label="Section title"><input className={inputCls + ' max-w-xs'} value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <div className="space-y-2">
        {links.map((link, i) => (
          <MenuRowEditor
            key={link.id}
            label={link.label}
            href={link.href}
            visible={link.visible}
            onLabel={value => patch(i, { label: value })}
            onHref={value => patch(i, { href: value })}
            onToggle={() => patch(i, { visible: !link.visible })}
            onRemove={() => setLinks(links.filter((_, j) => j !== i))}
          />
        ))}
        {links.length === 0 && <p className="text-sm text-slate-500">No links in this column yet — add one below.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Btn tone="ghost" onClick={() => setLinks([...links, { id: newLinkId(), label: 'New link', href: '/', visible: true }])}>+ Add</Btn>
        <SaveButton onSave={() => onSave({ ...column, title: title.trim() || column.title, links: links.map(l => ({ ...l })) })} />
      </div>
    </div>
  );
};

const SectionsPane: React.FC = () => {
  const { state, setSections, setNav, setSettings, setFooterColumns } = useCms();
  const footerColumns = state.footerColumns || [];
  const [logoError, setLogoError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const settings = state.settings;
  const social = settings.social || { facebook: '', x: '', linkedin: '', instagram: '', youtube: '' };
  const labels: Record<keyof typeof state.sections, [string, string]> = {
    hero: ['Hero + URL audit box', 'The headline, sub-headline and the audit form at the top'],
    auditTool: ['Hero tool form', 'The URL input and Analyze button'],
    results: ['Audit results block', 'Where the generated report appears'],
    features: ['Features grid', 'Six feature cards'],
    howItWorks: ['How it works', 'Four-step explainer'],
    whyAudit: ['Why audit matters', 'Dark stats panel'],
    whoBenefits: ['Who benefits', 'Six audience cards'],
    freeTools: ['Free tools showcase', 'Popular tools and category links'],
    fromBlog: ['From the blog', 'Latest three articles'],
    cta: ['Final CTA', 'Bottom call to action'],
    footer: ['Footer', 'Site footer with links and domain'],
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoError('');
    const problem = validateUpload(file);
    if (problem) { setLogoError(problem); return; }
    setLogoBusy(true);
    try {
      const image = await optimizeImageFile(file);
      setSettings({ footerLogoUrl: image.src });
    } catch (error) {
      setLogoError(error instanceof Error ? error.message : 'That image could not be read.');
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-6 border-b border-slate-100">
          <div><h3 className="font-bold text-slate-900">Site visibility</h3><p className="text-sm text-slate-500 mt-0.5">Choose exactly which homepage sections visitors can see.</p></div>
          <div className="flex items-center gap-3"><span className="text-sm text-slate-500"><strong className="text-emerald-600">{Object.values(state.sections).filter(Boolean).length}</strong> / {Object.keys(state.sections).length} live</span><a href="/" target="_blank" rel="noopener" className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700">View site ↗</a></div>
        </div>
        <div className="grid lg:grid-cols-2">
          {Object.entries(labels).map(([k, [l, h]]) => {
            const visible = state.sections[k as keyof typeof state.sections];
            return (
              <div key={k} className="flex items-center gap-4 p-4 md:px-6 border-b border-slate-100 lg:odd:border-r">
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${visible ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {visible ? '✓' : '—'}
                </span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{l}</p><p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{h}</p></div>
                <button type="button" onClick={() => setSections({ [k]: !visible })} className={`min-w-[82px] px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${visible ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'}`}>
                  {visible ? 'Visible' : 'Hidden'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------- navigation menu ---------------- */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div>
          <h3 className="font-bold text-slate-900">Navigation menu</h3>
          <p className="text-sm text-slate-500 mt-0.5">Every link in the header (desktop and mobile) is listed below, in the order it appears — Home, Free SEO Tools, Tool Categories, Competitor Analysis. Add, remove, hide or rename them, then save.</p>
        </div>
        <div className="space-y-2">
          {state.nav.map((n, i) => (
            <MenuRowEditor
              key={n.id}
              label={n.label}
              href={n.href}
              visible={n.visible}
              hrefNote={n.kind === 'tool-categories' ? 'Mega menu → all category pages' : undefined}
              onLabel={value => setNav(state.nav.map((x, j) => j === i ? { ...x, label: value } : x))}
              onHref={value => setNav(state.nav.map((x, j) => j === i ? { ...x, href: value } : x))}
              onToggle={() => setNav(state.nav.map((x, j) => j === i ? { ...x, visible: !x.visible } : x))}
              onRemove={() => setNav(state.nav.filter((_, j) => j !== i))}
            />
          ))}
          {state.nav.length === 0 && <p className="text-sm text-slate-500">No menu links yet — add one below.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Btn tone="ghost" onClick={() => setNav([...state.nav, { id: Math.random().toString(36).slice(2, 9), label: 'New link', href: '/', visible: true }])}>+ Add</Btn>
          <SaveButton onSave={() => setNav(state.nav.map(n => ({ ...n })))} />
          <a href="/" target="_blank" rel="noopener" className="text-sm font-semibold text-indigo-600 hover:underline">Preview header ↗</a>
        </div>
      </section>

      {/* ---------------- brand & footer ---------------- */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6">
        <div>
          <h3 className="font-bold text-slate-900">Brand &amp; footer</h3>
          <p className="text-sm text-slate-500 mt-0.5">Every field below is live on the public footer. Saving keeps it in this browser, so it survives a refresh.</p>
        </div>

        {/* Identity */}
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <h4 className="font-bold text-slate-800 text-sm">Site identity</h4>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Site name"><input className={inputCls} value={settings.name} onChange={e => setSettings({ name: e.target.value })} /></Field>
            <Field label="Domain"><input className={inputCls} value={settings.domain} onChange={e => setSettings({ domain: e.target.value })} /></Field>
            <Field label="Tagline"><input className={inputCls} value={settings.tagline} onChange={e => setSettings({ tagline: e.target.value })} /></Field>
          </div>
          <Field label="Footer note" hint="Shown above the footer link columns."><textarea rows={2} className={inputCls} value={settings.footerNote} onChange={e => setSettings({ footerNote: e.target.value })} /></Field>
          <SaveButton onSave={() => setSettings({ name: settings.name, domain: settings.domain, tagline: settings.tagline, footerNote: settings.footerNote })} />
        </div>

        {/* Logo */}
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <h4 className="font-bold text-slate-800 text-sm">Footer logo</h4>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_120px] gap-4 items-start">
            <div className="space-y-3">
              <Field label="Logo URL" hint="Any image URL, or upload a file. Leave blank to keep the default mark.">
                <input className={inputCls} value={settings.footerLogoUrl} onChange={e => setSettings({ footerLogoUrl: e.target.value })} placeholder="https://example.com/logo.png" />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp" className="hidden" onChange={e => { void pickLogo(e.target.files?.[0]); e.target.value = ''; }} aria-label="Upload footer logo" />
                <Btn tone="ghost" disabled={logoBusy} onClick={() => logoInput.current?.click()}>{logoBusy ? 'Optimising…' : '⬆ Upload logo'}</Btn>
                {settings.footerLogoUrl && <Btn tone="danger" onClick={() => setSettings({ footerLogoUrl: '' })}>Remove logo</Btn>}
                <SaveButton onSave={() => setSettings({ footerLogoUrl: settings.footerLogoUrl })} />
              </div>
              {logoError && <p className="text-sm text-red-600">{logoError}</p>}
            </div>
            <div className="w-[120px] h-[120px] rounded-xl border border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center text-center">
              {settings.footerLogoUrl
                ? <img src={settings.footerLogoUrl} alt="Footer logo preview" className="w-full h-full object-contain" />
                : <span className="text-[11px] text-slate-400 px-2">Default mark</span>}
            </div>
          </div>
        </div>

        {/* Footer menu */}
        {/* Footer columns — four separate, independently saveable editors */}
        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Footer columns</h4>
            <p className="text-xs text-slate-500">All four footer columns are editable: set each heading and its links (label, URL, visible/hidden, remove), then save that column. Changes appear on the live site immediately.</p>
          </div>
          {footerColumns.map((column, i) => (
            <FooterColumnEditor
              key={column.id}
              index={i}
              column={column}
              onSave={saved => setFooterColumns(footerColumns.map((c, j) => (j === i ? saved : c)))}
            />
          ))}
        </div>

        {/* Social profiles */}
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <h4 className="font-bold text-slate-800 text-sm">Social profiles</h4>
          <p className="text-xs text-slate-500">Leave a field empty to hide that icon. Icons appear in the footer, in this order.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {([['facebook', 'Facebook URL'], ['x', 'X (Twitter) URL'], ['linkedin', 'LinkedIn URL'], ['instagram', 'Instagram URL'], ['youtube', 'YouTube URL']] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <input className={inputCls} value={social[key]} onChange={e => setSettings({ social: { ...social, [key]: e.target.value } })} placeholder={`https://${key === 'x' ? 'x.com/yourhandle' : `${key}.com/yourpage`}`} />
              </Field>
            ))}
          </div>
          <SaveButton onSave={() => setSettings({ social: { ...social } })} />
        </div>

        {/* Copyright */}
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <h4 className="font-bold text-slate-800 text-sm">Footer copyright text</h4>
          <Field label="Copyright line" hint="Placeholders: {year} · {name} · {domain}">
            <input className={inputCls} value={settings.footerCopyright} onChange={e => setSettings({ footerCopyright: e.target.value })} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {['{year}', '{name}', '{domain}'].map(token => (
              <button key={token} type="button" onClick={() => setSettings({ footerCopyright: `${settings.footerCopyright} ${token}`.trim() })} className="px-2.5 py-1 rounded-md border border-slate-300 bg-white font-mono text-xs text-slate-700 hover:border-purple-400 hover:text-purple-700">{token}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Live preview: <span className="text-slate-700">{renderCopyright(settings.footerCopyright, settings.name, settings.domain)}</span></p>
          <SaveButton onSave={() => setSettings({ footerCopyright: settings.footerCopyright })} />
        </div>
      </section>
    </div>
  );
};

const SidebarPane: React.FC = () => {
  const { state, setSidebar } = useCms();
  const s = state.sidebar;
  const [adding, setAdding] = useState<SidebarWidgetType | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const widgets = s.widgets || [];
  const setWidgets = (next: SidebarWidget[]) => setSidebar({ widgets: next });
  const updateWidget = (id: string, patch: Partial<SidebarWidget>) => setWidgets(widgets.map(widget => widget.id === id ? { ...widget, ...patch } : widget));
  const moveWidget = (index: number, direction: -1 | 1) => {
    const next = [...widgets]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setWidgets(next);
  };
  const sourceOptions: { value: SidebarLinkSource; label: string; detail: string }[] = [
    { value: 'tools', label: 'Tools', detail: 'Pick tool pages from your live tool directory.' },
    { value: 'pages', label: 'Pages', detail: 'Pick pages you have created and published.' },
    { value: 'posts', label: 'Blog posts', detail: 'Pick published blog articles.' },
    { value: 'manual', label: 'Manual links', detail: 'Add any label, URL and optional badge.' },
  ];
  const sourceItems = (source: SidebarLinkSource) => {
    if (source === 'tools') return state.tools.filter(item => item.status === 'live').map(item => ({ id: item.slug, label: item.name, detail: `/${item.slug}` }));
    if (source === 'pages') return state.pages.filter(item => item.status === 'live').map(item => ({ id: item.slug, label: item.title, detail: `/${item.slug}` }));
    if (source === 'posts') return state.posts.filter(item => item.status === 'live').map(item => ({ id: item.slug, label: item.title, detail: `/blog/${item.slug}` }));
    return [];
  };
  const createWidget = (type: SidebarWidgetType, source: SidebarLinkSource = 'manual') => {
    const names: Record<SidebarWidgetType, string> = { links: source === 'tools' ? 'Featured tools' : source === 'pages' ? 'Useful pages' : source === 'posts' ? 'Recommended reading' : 'Featured links', text: 'Sidebar note', image: 'Featured image', code: 'Custom HTML' };
    const widget: SidebarWidget = {
      id: Math.random().toString(36).slice(2, 9), title: names[type], type, visible: true,
      ...(type === 'links' ? { source, linkRefs: [], links: [] } : {}),
      ...(type === 'text' ? { content: '<p>Add your promotion, notice or seasonal message here.</p>' } : {}),
      ...(type === 'image' ? { imageUrl: '', imageAlt: '', imageHref: '' } : {}),
      ...(type === 'code' ? { content: '<div style="padding:16px; font-family:system-ui">Your HTML snippet</div>' } : {}),
    };
    setWidgets([...widgets, widget]); setAdding(null); setEditing(widget.id);
  };
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-5 md:px-6 border-b border-slate-100"><h3 className="font-bold text-slate-900">Standard sidebar widgets</h3><p className="text-sm text-slate-500 mt-0.5">Turn the built-in blocks on or off, then adjust their text and item limits.</p></div>
        <div className="grid lg:grid-cols-2 gap-px bg-slate-100">
          <div className="bg-white p-5 space-y-3">
            <Toggle on={s.searchBox} label="Search box" hint="Search across all published tools and blog articles." onClick={() => setSidebar({ searchBox: !s.searchBox })} />
            {s.searchBox && <Field label="Search placeholder"><input className={inputCls} value={s.searchPlaceholder} onChange={e => setSidebar({ searchPlaceholder: e.target.value })} /></Field>}
            <Toggle on={s.relevantTools} label="Relevant tools" hint="Auto-lists related tools on tool pages." onClick={() => setSidebar({ relevantTools: !s.relevantTools })} />
            {s.relevantTools && <div className="grid sm:grid-cols-2 gap-3"><Field label="Section title"><input className={inputCls} value={s.relevantTitle} onChange={e => setSidebar({ relevantTitle: e.target.value })} /></Field><Field label="Maximum items"><input type="number" min={3} max={20} className={inputCls} value={s.relevantCount} onChange={e => setSidebar({ relevantCount: Number(e.target.value) })} /></Field></div>}
          </div>
          <div className="bg-white p-5 space-y-3">
            <Toggle on={s.popular} label="Popular SEO tools" hint="Curated popular-tool list, based on tools that are currently live." onClick={() => setSidebar({ popular: !s.popular })} />
            {s.popular && <Field label="Section title"><input className={inputCls} value={s.popularTitle} onChange={e => setSidebar({ popularTitle: e.target.value })} /></Field>}
            <Toggle on={s.latest} label="Latest articles" hint="Newest published blog posts." onClick={() => setSidebar({ latest: !s.latest })} />
            {s.latest && <div className="grid sm:grid-cols-2 gap-3"><Field label="Section title"><input className={inputCls} value={s.latestTitle} onChange={e => setSidebar({ latestTitle: e.target.value })} /></Field><Field label="Maximum items"><input type="number" min={1} max={12} className={inputCls} value={s.latestCount} onChange={e => setSidebar({ latestCount: Number(e.target.value) })} /></Field></div>}
            <Toggle on={s.cta} label="Audit call to action" hint="Gradient promotion card at the bottom of the sidebar." onClick={() => setSidebar({ cta: !s.cta })} />
            {s.cta && <div className="grid sm:grid-cols-2 gap-3"><Field label="Title"><input className={inputCls} value={s.ctaTitle} onChange={e => setSidebar({ ctaTitle: e.target.value })} /></Field><Field label="Button label"><input className={inputCls} value={s.ctaLabel} onChange={e => setSidebar({ ctaLabel: e.target.value })} /></Field><Field label="Description"><textarea rows={2} className={inputCls} value={s.ctaText} onChange={e => setSidebar({ ctaText: e.target.value })} /></Field><Field label="Button link"><input className={inputCls} value={s.ctaHref} onChange={e => setSidebar({ ctaHref: e.target.value })} /></Field></div>}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-6 border-b border-slate-100">
          <div><h3 className="font-bold text-slate-900">Custom sidebar sections</h3><p className="text-sm text-slate-500 mt-0.5">Build complete sidebar panels from your tools, pages, blog posts, text, images or safe HTML.</p></div>
          <span className="text-xs font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1">{widgets.filter(widget => widget.visible).length} live sections</span>
        </div>
        <div className="p-5 md:p-6">
          {!adding ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ['tools', 'Tool links', 'Create a curated section from your live tools.', 'links'],
                ['pages', 'Page links', 'Link visitors to your published custom pages.', 'links'],
                ['posts', 'Blog links', 'Feature selected articles in the sidebar.', 'links'],
                ['text', 'Text section', 'Add a note, promotion, instructions or announcement.', 'text'],
                ['image', 'Image section', 'Display a linked banner, promotion or sponsor image.', 'image'],
                ['code', 'HTML / code', 'Render a sandboxed HTML snippet or embed markup.', 'code'],
              ].map(([source, label, detail, type]) => (
                <button key={label} type="button" onClick={() => { if (type === 'links') createWidget('links', source as SidebarLinkSource); else setAdding(type as SidebarWidgetType); }} className="text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group">
                  <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center mb-3">+</span>
                  <span className="block text-sm font-bold text-slate-800">{label}</span><span className="block text-xs text-slate-500 mt-1 leading-relaxed">{detail}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-5">
              <div className="flex items-center justify-between gap-3 mb-3"><div><p className="font-bold text-indigo-950">Add {adding === 'text' ? 'a text section' : adding === 'image' ? 'an image section' : 'an HTML / code section'}</p><p className="text-sm text-indigo-800">This becomes a separate card in every sidebar.</p></div><Btn tone="ghost" onClick={() => setAdding(null)}>Cancel</Btn></div>
              <Btn onClick={() => createWidget(adding)}>Create section</Btn>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100">
          {widgets.map((widget, index) => {
            const isEditing = editing === widget.id;
            const source = widget.source || 'manual';
            const selectable = sourceItems(source);
            return (
              <div key={widget.id} className="border-b border-slate-100 last:border-0">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-5 py-4 md:px-6">
                  <div className="flex gap-1"><button type="button" onClick={() => moveWidget(index, -1)} disabled={index === 0} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600">↑</button><button type="button" onClick={() => moveWidget(index, 1)} disabled={index === widgets.length - 1} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-600">↓</button></div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-800">{widget.title || 'Untitled sidebar section'}</p><p className="text-xs text-slate-500">{widget.type === 'links' ? `${source} links · ${(widget.linkRefs || widget.links || []).length} selected` : widget.type === 'text' ? 'Rich text note' : widget.type === 'image' ? 'Image content' : 'Sandboxed HTML / code'}</p></div>
                  <div className="flex flex-wrap items-center gap-2"><Btn tone={widget.visible ? 'ghost' : 'danger'} onClick={() => updateWidget(widget.id, { visible: !widget.visible })}>{widget.visible ? 'Visible' : 'Hidden'}</Btn><Btn tone="ghost" onClick={() => setEditing(isEditing ? null : widget.id)}>{isEditing ? 'Close' : 'Edit'}</Btn><Btn tone="ghost" onClick={() => { if (window.confirm(`Delete the sidebar section “${widget.title}”? This cannot be undone.`)) setWidgets(widgets.filter(item => item.id !== widget.id)); }}>Delete</Btn></div>
                </div>
                {isEditing && <div className="bg-slate-50 p-5 md:px-6 border-t border-slate-100 space-y-4">
                  <div className="grid gap-4">
                    <Field label="Section title"><input className={inputCls} value={widget.title} onChange={e => updateWidget(widget.id, { title: e.target.value })} /></Field>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Section type</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
                        {[
                          { value: 'tools', kind: 'links' as SidebarWidgetType, label: 'Tools', detail: 'Curated tool links', icon: 'T' },
                          { value: 'pages', kind: 'links' as SidebarWidgetType, label: 'Pages', detail: 'Published pages', icon: 'P' },
                          { value: 'posts', kind: 'links' as SidebarWidgetType, label: 'Blog posts', detail: 'Published articles', icon: 'B' },
                          { value: 'manual', kind: 'links' as SidebarWidgetType, label: 'Manual links', detail: 'Custom URLs', icon: '↗' },
                          { value: 'text', kind: 'text' as SidebarWidgetType, label: 'Text', detail: 'Note or promotion', icon: '¶' },
                          { value: 'image', kind: 'image' as SidebarWidgetType, label: 'Image', detail: 'Banner or graphic', icon: '▧' },
                          { value: 'code', kind: 'code' as SidebarWidgetType, label: 'HTML / code', detail: 'Safe embed block', icon: '</>' },
                        ].map(option => {
                          const active = option.kind === 'links' ? source === option.value : widget.type === option.kind;
                          return <button key={option.value} type="button" onClick={() => {
                            if (option.kind === 'links') updateWidget(widget.id, { type: 'links', source: option.value as SidebarLinkSource, linkRefs: [], links: option.value === 'manual' ? (widget.links || []) : [] });
                            else updateWidget(widget.id, { type: option.kind });
                          }} className={`text-left rounded-xl border p-3 transition-colors ${active ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}>
                            <span className="w-8 h-8 mb-2 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[11px] font-black text-indigo-600">{option.icon}</span>
                            <span className="block text-sm font-bold text-slate-800">{option.label}</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">{option.detail}</span>
                          </button>;
                        })}
                      </div>
                    </div>
                  </div>
                  {widget.type === 'links' && <>
                    <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">What should this section link to?</p><div className="grid sm:grid-cols-4 gap-2">{sourceOptions.map(option => <button key={option.value} type="button" onClick={() => updateWidget(widget.id, { source: option.value, linkRefs: [], links: option.value === 'manual' ? (widget.links || []) : [] })} className={`text-left rounded-lg border p-3 ${source === option.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}><span className="block text-sm font-semibold text-slate-800">{option.label}</span><span className="block text-xs text-slate-500 mt-0.5">{option.detail}</span></button>)}</div></div>
                    {source !== 'manual' ? <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-800 mb-3">Choose items to show</p><div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">{selectable.map(item => { const chosen = (widget.linkRefs || []).includes(item.id); return <button key={item.id} type="button" onClick={() => updateWidget(widget.id, { linkRefs: chosen ? (widget.linkRefs || []).filter(ref => ref !== item.id) : [...(widget.linkRefs || []), item.id] })} className={`flex items-center gap-3 text-left p-3 rounded-lg border ${chosen ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}><span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${chosen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{chosen ? '✓' : '+'}</span><span className="min-w-0"><span className="block text-sm font-semibold text-slate-800 truncate">{item.label}</span><span className="block text-[11px] font-mono text-slate-400 truncate">{item.detail}</span></span></button>; })}{selectable.length === 0 && <p className="text-sm text-slate-500">There are no live {source} available to add.</p>}</div></div> : <div className="space-y-3"><p className="text-sm text-slate-600">Add any external or internal links manually.</p>{(widget.links || []).map((link, linkIndex) => <div key={link.id} className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto] gap-2"><input className={inputCls} value={link.label} placeholder="Link label" onChange={e => updateWidget(widget.id, { links: (widget.links || []).map((x, i) => i === linkIndex ? { ...x, label: e.target.value } : x) })} /><input className={inputCls} value={link.href} placeholder="/word-counter or https://..." onChange={e => updateWidget(widget.id, { links: (widget.links || []).map((x, i) => i === linkIndex ? { ...x, href: e.target.value } : x) })} /><input className={inputCls} value={link.badge || ''} placeholder="Badge" onChange={e => updateWidget(widget.id, { links: (widget.links || []).map((x, i) => i === linkIndex ? { ...x, badge: e.target.value } : x) })} /><button type="button" onClick={() => updateWidget(widget.id, { links: (widget.links || []).filter((_, i) => i !== linkIndex) })} className="px-3 rounded-lg bg-red-50 text-red-600 border border-red-100">×</button></div>)}<Btn tone="ghost" onClick={() => updateWidget(widget.id, { links: [...(widget.links || []), { id: Math.random().toString(36).slice(2, 9), label: 'New link', href: '/', visible: true }] })}>+ Add manual link</Btn></div>}
                  </>}
                  {widget.type === 'text' && <Field label="Sidebar note" hint="Visual editor — headings, bold, lists, quotes, links, images and colours. Short fields elsewhere stay plain text."><RichTextEditor value={widget.content || ''} onChange={html => updateWidget(widget.id, { content: html })} minHeight={180} placeholder="Write your announcement, promotion or sidebar note…" ariaLabel="Sidebar note" /></Field>}
                  {widget.type === 'image' && <div className="grid md:grid-cols-[minmax(0,1fr)_200px] gap-4"><div className="space-y-3"><Field label="Image URL"><input className={inputCls} value={widget.imageUrl || ''} onChange={e => updateWidget(widget.id, { imageUrl: e.target.value })} placeholder="https://example.com/banner.webp" /></Field><Field label="Alt text"><input className={inputCls} value={widget.imageAlt || ''} onChange={e => updateWidget(widget.id, { imageAlt: e.target.value })} /></Field><Field label="Click-through link (optional)"><input className={inputCls} value={widget.imageHref || ''} onChange={e => updateWidget(widget.id, { imageHref: e.target.value })} placeholder="/free-seo-tools" /></Field></div><div className="aspect-[1.91/1] rounded-xl border border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center text-center text-xs text-slate-400">{widget.imageUrl ? <img src={widget.imageUrl} alt={widget.imageAlt || ''} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : 'Image preview'}</div></div>}
                  {widget.type === 'code' && <Field label="HTML / embed code" hint="Rendered in a sandboxed iframe. Scripts and inline event handlers are disabled for safety."><textarea rows={8} className={inputCls + ' font-mono text-xs'} value={widget.content || ''} onChange={e => updateWidget(widget.id, { content: e.target.value })} placeholder="<div>Your safe HTML snippet</div>" /></Field>}
                  <p className="text-xs text-emerald-700">Saved automatically. This section is {widget.visible ? 'live in the sidebar' : 'currently hidden'}.</p>
                </div>}
              </div>
            );
          })}
          {widgets.length === 0 && <div className="px-6 py-10 text-center"><p className="font-semibold text-slate-700">No custom sidebar sections yet.</p><p className="text-sm text-slate-500 mt-1">Choose a tool, page, blog, text, image or HTML section above to get started.</p></div>}
        </div>
      </section>
    </div>
  );
};

const StorageSummary: React.FC = () => {
  const used = estimateLocalStorageBytes();
  const pct = Math.min(100, Math.round((used / BROWSER_QUOTA_BYTES) * 100));
  const tone = pct >= 80 ? 'bg-red-500' : pct >= 55 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span className="font-semibold">Content, drafts and media in this browser</span>
        <span className={pct >= 80 ? 'font-bold text-red-600' : ''}>{formatBytes(used)} / ~{formatBytes(BROWSER_QUOTA_BYTES)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white border border-slate-200 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
      {pct >= 80 && <p className="text-[11px] text-red-600 mt-2">Storage is nearly full. Remove large inline images or export your JSON and reset.</p>}
    </div>
  );
};

const SettingsPane: React.FC = () => {
  const { state, setSettings, setPasscode, exportJson, importJson, reset } = useCms();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [draftVersion, setDraftVersion] = useState(0);
  const [json, setJson] = useState('');
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' })); a.download = 'cms-content.json'; a.click(); };
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <div><h3 className="font-bold text-slate-900">Header Verification &amp; Ads</h3><p className="text-sm text-slate-500">Paste AdSense, Google Search Console, Bing Webmaster or other verification snippets. They are added inside the document head.</p></div>
        <textarea rows={7} className={inputCls + ' font-mono text-xs'} value={state.settings.headerVerificationAds || ''} onChange={e => setSettings({ headerVerificationAds: e.target.value })} placeholder={'<meta name="google-site-verification" content="…">'} aria-label="Header verification and ads code" />
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton label="Save Changes" onSave={() => {
            const code = state.settings.headerVerificationAds || '';
            setSettings({ headerVerificationAds: code });
            injectHeadCode(code);
          }} />
          <span className="text-xs text-slate-500">Saved in this browser and injected into <code>&lt;head&gt;</code> immediately.</span>
        </div>
      </section>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900">Password</h3>
        <Field label="New password" hint="Stored in this browser. Because this is a static site, this gate protects the admin UI, not the published files."><input type="password" className={inputCls} value={code} onChange={e => setCode(e.target.value)} autoComplete="new-password" /></Field>
        <Btn tone="ok" onClick={() => { if (code.trim().length >= 8) { void setPasscode(code.trim()); setMsg('Password updated.'); setCode(''); } else setMsg('Use at least 8 characters.'); }}>Update password</Btn>
        {msg && <p className={`text-sm ${msg.includes('updated') ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</p>}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900">Editor drafts &amp; browser storage</h3>
        <p className="text-sm text-slate-600">While you write, the visual editor keeps a draft of every open item in this browser. Drafts are removed as soon as you save the item — clear any leftovers here.</p>
        <StorageSummary />
        <div key={draftVersion} className="space-y-2 max-h-64 overflow-y-auto">
          {listDrafts().map(draft => (
            <div key={draft.key} className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-mono text-slate-700 truncate max-w-[220px]" title={draft.key}>{draft.key}</span>
              <span className="text-slate-400">{draft.words} words · {formatDraftTime(draft.savedAt)}</span>
              <button type="button" onClick={() => { clearDraft(draft.key); setDraftVersion(v => v + 1); }} className="ml-auto px-2 py-1 rounded-md border border-slate-300 bg-white font-semibold text-slate-600 hover:text-red-600">Clear</button>
            </div>
          ))}
          {listDrafts().length === 0 && <p className="text-sm text-slate-500">No unsaved drafts — everything is stored in your CMS content.</p>}
        </div>
        {listDrafts().length > 0 && (
          <Btn tone="danger" onClick={() => { clearAllDrafts(); setDraftVersion(v => v + 1); }}>Clear all drafts</Btn>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900">Backup &amp; deploy</h3>
        <p className="text-sm text-slate-600">Export your content as JSON to version it in your repository (drop it in <code>src/cms/content.json</code>) or to move it to another browser. Import restores it here.</p>
        <div className="flex flex-wrap gap-2"><Btn onClick={download}>⬇ Export JSON</Btn><Btn tone="danger" onClick={() => { if (confirm('Reset all CMS content to the built-in defaults? This cannot be undone.')) { reset(); setMsg('Reset to defaults.'); } }}>Reset to defaults</Btn></div>
        <Field label="Import JSON"><textarea rows={6} className={inputCls + ' font-mono text-xs'} value={json} onChange={e => setJson(e.target.value)} placeholder="Paste exported JSON here" /></Field>
        <Btn tone="ghost" onClick={() => setMsg(importJson(json) ? 'Content imported.' : 'That does not look like valid CMS JSON.')}>Import</Btn>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      </div>
    </div>
  );
};

/* ---------------- shell ---------------- */
type Tab = 'dashboard' | 'pages' | 'blog' | 'tools' | 'toolcats' | 'competitor' | 'sidebar' | 'sections' | 'settings';
const TABS: [Tab, string][] = [['dashboard', 'Dashboard'], ['pages', 'Pages'], ['blog', 'Blog posts'], ['tools', 'Tools'], ['toolcats', 'Tool Categories'], ['competitor', 'Competitor Analysis'], ['sidebar', 'Sidebar'], ['sections', 'Sections & Nav'], ['settings', 'Settings']];

export const AdminApp: React.FC = () => {
  const { loggedIn, logout, state, storageWarning } = useCms();
  const [tab, setTab] = useState<Tab>('dashboard');
  if (!loggedIn) return null;
  return (
    <div className="pt-8 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="flex flex-wrap items-center gap-4 px-5 py-5 md:px-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Content manager</h1>
                <span className="text-[11px] font-bold uppercase tracking-wide bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">CMS</span>
              </div>
              <p className="text-sm text-slate-500 truncate">{state.settings.name} · {state.settings.domain} · changes save automatically in this browser</p>
              {/* Not a feature, a diagnostic: which build am I looking at? Guarded with
                  typeof because vite's define only substitutes in a built bundle —
                  reading the bare identifier in `npm run dev` would throw. */}
              {typeof __BUILD_ID__ === 'string' && (
                <p className="text-[11px] font-mono text-slate-400" title="When this bundle was built, and from which commit">build {__BUILD_ID__}</p>
              )}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <a href="/" target="_blank" rel="noopener" className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">View live site ↗</a>
              <Btn tone="ghost" onClick={() => { logout(); navigate('/'); }}>Log Out</Btn>
            </div>
          </div>
          <nav aria-label="CMS areas" className="border-t border-slate-100 px-3 py-3 md:px-4 flex gap-1.5 overflow-x-auto">
            {TABS.map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>{l}</button>
            ))}
          </nav>
        </header>
        {storageWarning && (
          <div className="flex items-start gap-3 mb-5 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-900" role="alert">
            <span className="w-5 h-5 flex-shrink-0 text-amber-600"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 2.5 20h19z" /><line x1="12" y1="10" x2="12" y2="15" /></svg></span>
            <span><strong className="font-bold">Not saved.</strong> {storageWarning}</span>
            <button type="button" onClick={() => setTab('settings')} className="ml-auto whitespace-nowrap text-sm font-bold text-amber-800 hover:underline">Open storage settings →</button>
          </div>
        )}
        {tab === 'dashboard' && <Dashboard go={setTab} />}
        {tab === 'pages' && <PagesPane />}
        {tab === 'blog' && <BlogPane />}
        {tab === 'tools' && <ToolsPane />}
        {tab === 'toolcats' && <ToolCategoriesPane />}
        {tab === 'competitor' && <CompetitorPane />}
        {tab === 'sidebar' && <SidebarPane />}
        {tab === 'sections' && <SectionsPane />}
        {tab === 'settings' && <SettingsPane />}
      </div>
    </div>
  );
};
