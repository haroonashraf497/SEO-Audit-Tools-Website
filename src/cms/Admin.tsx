import React, { useMemo, useState } from 'react';
import { useCms, type CmsPage, type CmsPost, type CmsTool, type PageBlock, type SeoEntry, type SidebarLinkSource, type SidebarWidget, type SidebarWidgetType, type Status } from './store';
import { categoryLabels, categoryOrder, ToolIcon, type ToolCategory } from '../tools/data';

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
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>{hint && <span className="block text-xs text-slate-400 mb-1">{hint}</span>}<span className="block mt-1">{children}</span></label>
);
const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white';
const SeoMetaEditor: React.FC<{ value: SeoEntry; onChange: (entry: SeoEntry) => void; fallbackTitle: string; fallbackDescription: string; routeHint: string }> = ({ value, onChange, fallbackTitle, fallbackDescription, routeHint }) => {
  const entry = { title: value.title || fallbackTitle, description: value.description || fallbackDescription, slug: value.slug || '', noindex: value.noindex || false };
  const titleTone = entry.title.length >= 50 && entry.title.length <= 60 ? 'text-emerald-600' : entry.title.length ? 'text-amber-600' : 'text-red-600';
  const descriptionTone = entry.description.length >= 120 && entry.description.length <= 160 ? 'text-emerald-600' : entry.description.length ? 'text-amber-600' : 'text-red-600';
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div><h4 className="font-bold text-slate-900">SEO &amp; Meta Information</h4><p className="text-xs text-slate-500">Search title, description, canonical URL and indexing controls for this page.</p></div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${entry.noindex ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{entry.noindex ? 'No-indexed' : 'Indexable'}</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="SEO title" hint={`${entry.title.length} characters · target 50–60`}><input className={inputCls} value={entry.title} onChange={e => onChange({ ...entry, title: e.target.value })} /></Field>
          <Field label="Meta description" hint={`${entry.description.length} characters · target 120–160`}><textarea rows={2} className={inputCls} value={entry.description} onChange={e => onChange({ ...entry, description: e.target.value })} /></Field>
        </div>
        <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
          <Field label="Canonical URL override" hint={`Default: ${routeHint}`}><input className={inputCls} value={entry.slug} onChange={e => onChange({ ...entry, slug: e.target.value })} placeholder="Leave blank to use the page URL" /></Field>
          <button type="button" onClick={() => onChange({ ...entry, noindex: !entry.noindex })} className={`h-[42px] px-4 rounded-lg border text-sm font-semibold transition-colors ${entry.noindex ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{entry.noindex ? 'No-index enabled' : 'Make no-index'}</button>
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

/* ---------------- login ---------------- */
const Login: React.FC<{ onOk: () => void }> = ({ onOk }) => {
  const { login } = useCms();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={e => { e.preventDefault(); login(code) ? onOk() : setErr('Incorrect passcode.'); }} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-5" />
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin login</h1>
        <p className="text-sm text-slate-500 mb-6">Manage pages, blog posts, tools, SEO and the sidebar.</p>
        <input type="password" value={code} onChange={e => setCode(e.target.value)} placeholder="Passcode" className={inputCls} autoFocus />
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
        <Btn type="submit" className="w-full mt-4 py-3">Sign in</Btn>
        <p className="text-xs text-slate-400 mt-4">Default passcode: <code className="bg-slate-100 px-1.5 py-0.5 rounded">admin123</code> — change it in Settings. This is a front-end gate: because the site is static, content is stored in this browser. Use Export JSON to publish changes.</p>
      </form>
    </div>
  );
};

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
  const categoryStats = categoryOrder.map(category => {
    const all = state.tools.filter(tool => tool.category === category);
    const live = all.filter(tool => tool.status === 'live').length;
    return { category, total: all.length, live, offline: all.length - live };
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
            <a href="#/" className="px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 transition-colors">View live site ↗</a>
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
                <button key={item.category} type="button" onClick={() => go('tools')} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                  <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-indigo-600"><ToolIcon category={item.category} className="w-4 h-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 truncate">{categoryLabels[item.category]}</span><span className="block text-xs text-slate-500">{item.live} live · {item.offline} hidden/draft</span></span>
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
        <Field label="URL slug" hint="Becomes #/tool/your-slug"><input className={inputCls} value={f.slug} onChange={e => set('slug')(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></Field>
      </div>
      <Field label="Description (shown under the title and in the directory)"><textarea rows={3} className={inputCls} value={f.description} onChange={e => set('description')(e.target.value)} /></Field>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Category"><select className={inputCls} value={f.category} onChange={e => set('category')(e.target.value)}>{categoryOrder.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select></Field>
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
      <SeoMetaEditor value={seo} onChange={setSeoDraft} fallbackTitle={`${f.name} - Free Online SEO Tool | ${state.settings.name}`} fallbackDescription={f.description} routeHint={`# /tool/${f.slug || tool.slug}`} />
      <div className="flex gap-2"><Btn onClick={() => { saveTool(tool.slug, f); if (f.slug !== tool.slug) clearSeo(`tool:${tool.slug}`); setSeo(`tool:${f.slug || tool.slug}`, seo); onClose(); }}>Save tool</Btn><Btn tone="ghost" onClick={onClose}>Cancel</Btn></div>
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
        <select value={cat} onChange={e => setCat(e.target.value)} className={inputCls + ' max-w-[200px]'}><option value="all">All categories</option>{categoryOrder.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select>
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
                <span className="text-xs text-slate-400 font-mono">/tool/{t.slug}</span>
                <span className="text-xs text-slate-500">{categoryLabels[t.category]}</span>
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
  const { addTool } = useCms();
  const [f, setF] = useState({ name: '', slug: '', description: '', category: 'management' as ToolCategory, input: 'text' as CmsTool['input'], status: 'draft' as Status, placeholder: '', featuredImage: '', featuredImageAlt: '' });
  const autoSlug = f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Tool name"><input className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="URL slug" hint={autoSlug ? `#/tool/${autoSlug}` : ''}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} placeholder={autoSlug} /></Field>
      </div>
      <Field label="Description"><textarea rows={3} className={inputCls} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Category"><select className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value as ToolCategory })}>{categoryOrder.map(c => <option key={c} value={c}>{categoryLabels[c]}</option>)}</select></Field>
        <Field label="Input type"><select className={inputCls} value={f.input} onChange={e => setF({ ...f, input: e.target.value as CmsTool['input'] })}>{['text', 'domain', 'url', 'keyword', 'none'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
        <Field label="State"><select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}><option value="draft">Draft</option><option value="live">Live</option><option value="hidden">Hidden</option></select></Field>
      </div>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <div className="flex gap-2"><Btn onClick={() => { addTool({ ...f, slug: autoSlug }); onDone(); }}>Create tool</Btn><Btn tone="ghost" onClick={onDone}>Cancel</Btn></div>
    </div>
  );
};

const PostEditor: React.FC<{ post: CmsPost; onClose: () => void }> = ({ post, onClose }) => {
  const { state, savePost, setSeo, clearSeo } = useCms();
  const [f, setF] = useState(post);
  const [seo, setSeoDraft] = useState<SeoEntry>(state.seo[`post:${post.slug}`] || { title: post.metaTitle || post.title, description: post.metaDescription || post.excerpt });
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="URL slug" hint={`#/blog/${f.slug}`}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></Field>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Category"><input className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /></Field>
        <Field label="Publish date"><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Read time"><input className={inputCls} value={f.readTime} onChange={e => setF({ ...f, readTime: e.target.value })} /></Field>
      </div>
      <Field label="Excerpt / summary"><textarea rows={2} className={inputCls} value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} /></Field>
      <Field label="Keywords (comma separated)"><input className={inputCls} value={f.keywords.join(', ')} onChange={e => setF({ ...f, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></Field>
      <Field label="Body" hint="Markdown-ish: ## Heading, - bullet, **bold**"><textarea rows={14} className={inputCls + ' font-mono text-xs'} value={f.content} onChange={e => setF({ ...f, content: e.target.value })} /></Field>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <SeoMetaEditor value={seo} onChange={setSeoDraft} fallbackTitle={f.metaTitle || f.title} fallbackDescription={f.metaDescription || f.excerpt} routeHint={`#/blog/${f.slug || post.slug}`} />
      <div className="flex gap-2"><Btn onClick={() => { savePost(post.slug, f); if (f.slug !== post.slug) clearSeo(`post:${post.slug}`); setSeo(`post:${f.slug || post.slug}`, seo); onClose(); }}>Save post</Btn><Btn tone="ghost" onClick={onClose}>Cancel</Btn></div>
    </div>
  );
};

const BlogPane: React.FC = () => {
  const { state, setPostStatus, deletePost } = useCms();
  const [edit, setEdit] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3"><span className="text-sm text-slate-500">{state.posts.length} posts · {state.posts.filter(p => p.status === 'live').length} published</span><Btn className="ml-auto" onClick={() => setCreating(true)}>+ Write post</Btn></div>
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
  const { addPost } = useCms();
  const [f, setF] = useState({ title: '', slug: '', excerpt: '', content: '', category: 'Google & Indexing', metaTitle: '', metaDescription: '', status: 'draft' as Status, featuredImage: '', featuredImageAlt: '' });
  const slug = f.slug || f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
      <p className="font-bold text-slate-900">New blog post</p>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Slug" hint={slug ? `#/blog/${slug}` : ''}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} placeholder={slug} /></Field>
      </div>
      <Field label="Excerpt"><textarea rows={2} className={inputCls} value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} /></Field>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="SEO title"><input className={inputCls} value={f.metaTitle} onChange={e => setF({ ...f, metaTitle: e.target.value })} placeholder={f.title} /></Field>
        <Field label="Meta description"><textarea rows={2} className={inputCls} value={f.metaDescription} onChange={e => setF({ ...f, metaDescription: e.target.value })} /></Field>
      </div>
      <Field label="Body" hint="## Heading · - bullet · **bold**"><textarea rows={10} className={inputCls + ' font-mono text-xs'} value={f.content} onChange={e => setF({ ...f, content: e.target.value })} /></Field>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <Field label="State"><select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}><option value="draft">Draft</option><option value="live">Published</option><option value="hidden">Hidden</option></select></Field>
      <div className="flex gap-2"><Btn onClick={() => { addPost({ ...f, slug, metaTitle: f.metaTitle || f.title }); onDone(); }}>Create post</Btn><Btn tone="ghost" onClick={onDone}>Cancel</Btn></div>
    </div>
  );
};

const BlockEditor: React.FC<{ blocks: PageBlock[]; onChange: (b: PageBlock[]) => void }> = ({ blocks, onChange }) => {
  const set = (i: number, patch: Partial<PageBlock>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } as PageBlock : b)));
  const move = (i: number, d: -1 | 1) => { const n = [...blocks]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase text-slate-400">{b.type}</span>
            <div className="ml-auto flex gap-1">
              <button onClick={() => move(i, -1)} className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm">↑</button>
              <button onClick={() => move(i, 1)} className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm">↓</button>
              <button onClick={() => onChange(blocks.filter((_, j) => j !== i))} className="w-7 h-7 rounded bg-red-50 hover:bg-red-100 text-red-600 text-sm">✕</button>
            </div>
          </div>
          {b.type === 'heading' && (
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <select className={inputCls} value={b.level} onChange={e => set(i, { level: Number(e.target.value) as 2 | 3 })}><option value={2}>H2</option><option value={3}>H3</option></select>
              <input className={inputCls} value={b.text} onChange={e => set(i, { text: e.target.value })} placeholder="Heading text" />
            </div>
          )}
          {b.type === 'text' && <textarea rows={3} className={inputCls} value={b.text} onChange={e => set(i, { text: e.target.value })} placeholder="Paragraph" />}
          {b.type === 'list' && <textarea rows={3} className={inputCls} value={b.items.join('\n')} onChange={e => set(i, { items: e.target.value.split('\n').filter(Boolean) })} placeholder="One item per line" />}
          {b.type === 'cta' && (
            <div className="space-y-2">
              <textarea rows={2} className={inputCls} value={b.text} onChange={e => set(i, { text: e.target.value })} placeholder="CTA text" />
              <div className="grid grid-cols-2 gap-2"><input className={inputCls} value={b.label} onChange={e => set(i, { label: e.target.value })} placeholder="Button label" /><input className={inputCls} value={b.href} onChange={e => set(i, { href: e.target.value })} placeholder="#/" /></div>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {(['heading', 'text', 'list', 'cta'] as const).map(t => (
          <Btn key={t} tone="ghost" onClick={() => onChange([...blocks, t === 'heading' ? { id: Math.random().toString(36).slice(2, 9), type: 'heading', text: 'New heading', level: 2 } : t === 'text' ? { id: Math.random().toString(36).slice(2, 9), type: 'text', text: '' } : t === 'list' ? { id: Math.random().toString(36).slice(2, 9), type: 'list', items: ['First item'] } : { id: Math.random().toString(36).slice(2, 9), type: 'cta', text: '', label: 'Learn more', href: '#/' }])}>+ {t}</Btn>
        ))}
      </div>
    </div>
  );
};

const PageEditor: React.FC<{ page: CmsPage; onClose: () => void }> = ({ page, onClose }) => {
  const { state, savePage, setSeo, clearSeo } = useCms();
  const [f, setF] = useState(page);
  const [seo, setSeoDraft] = useState<SeoEntry>(state.seo[`page:${page.slug}`] || { title: page.metaTitle || page.title, description: page.metaDescription });
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Page title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="URL slug" hint={`#/p/${f.slug}`}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></Field>
      </div>
      <Field label="State"><select className={inputCls} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Status })}><option value="live">Live</option><option value="hidden">Hidden</option><option value="draft">Draft</option></select></Field>
      <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Content blocks</p><BlockEditor blocks={f.blocks} onChange={b => setF({ ...f, blocks: b })} /></div>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <SeoMetaEditor value={seo} onChange={setSeoDraft} fallbackTitle={f.metaTitle || f.title} fallbackDescription={f.metaDescription} routeHint={`#/p/${f.slug || page.slug}`} />
      <div className="flex gap-2"><Btn onClick={() => { savePage(page.id, f); if (f.slug !== page.slug) clearSeo(`page:${page.slug}`); setSeo(`page:${f.slug || page.slug}`, seo); onClose(); }}>Save page</Btn><Btn tone="ghost" onClick={onClose}>Cancel</Btn></div>
    </div>
  );
};

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
              <div><p className="font-semibold text-slate-800">{p.title}</p><p className="text-xs text-slate-500 font-mono">/p/{p.slug} · {p.blocks.length} blocks</p></div>
            </Row>
            {edit === p.id && <div className="p-4 bg-slate-50 border-b border-slate-100"><PageEditor page={p} onClose={() => setEdit(null)} /></div>}
          </React.Fragment>
        ))}
        {state.pages.length === 0 && <p className="p-6 text-sm text-slate-500">No pages yet.</p>}
      </div>
      <p className="text-xs text-slate-400">Pages render at <code>#/p/your-slug</code> with their own SEO title, meta description and robots directive. Add them to your navigation from the Sections &amp; Nav tab.</p>
    </div>
  );
};

const NewPageForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { addPage } = useCms();
  const [f, setF] = useState({ title: '', slug: '', metaTitle: '', metaDescription: '', status: 'draft' as Status, featuredImage: '', featuredImageAlt: '' });
  const slug = f.slug || f.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Title"><input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Slug" hint={slug ? `#/p/${slug}` : ''}><input className={inputCls} value={f.slug} onChange={e => setF({ ...f, slug: e.target.value })} placeholder={slug} /></Field>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="SEO title"><input className={inputCls} value={f.metaTitle} onChange={e => setF({ ...f, metaTitle: e.target.value })} placeholder={f.title} /></Field>
        <Field label="Meta description"><textarea rows={2} className={inputCls} value={f.metaDescription} onChange={e => setF({ ...f, metaDescription: e.target.value })} /></Field>
      </div>
      <FeaturedImageEditor image={f.featuredImage} alt={f.featuredImageAlt} onChange={patch => setF({ ...f, ...patch })} />
      <div className="flex gap-2"><Btn onClick={() => { addPage({ ...f, slug, metaTitle: f.metaTitle || f.title }); onDone(); }}>Create page</Btn><Btn tone="ghost" onClick={onDone}>Cancel</Btn></div>
    </div>
  );
};

const SectionsPane: React.FC = () => {
  const { state, setSections, setNav, setSettings } = useCms();
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
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-6 border-b border-slate-100">
          <div><h3 className="font-bold text-slate-900">Site visibility</h3><p className="text-sm text-slate-500 mt-0.5">Choose exactly which homepage sections visitors can see.</p></div>
          <div className="flex items-center gap-3"><span className="text-sm text-slate-500"><strong className="text-emerald-600">{Object.values(state.sections).filter(Boolean).length}</strong> / {Object.keys(state.sections).length} live</span><a href="#/" className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700">View site ↗</a></div>
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
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-3">Navigation menu</h3>
        <div className="space-y-2">
          {state.nav.map((n, i) => (
            <div key={n.id} className="flex flex-wrap items-center gap-2">
              <input className={inputCls + ' max-w-[180px]'} value={n.label} onChange={e => setNav(state.nav.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <input className={inputCls + ' max-w-[220px] font-mono text-xs'} value={n.href} onChange={e => setNav(state.nav.map((x, j) => j === i ? { ...x, href: e.target.value } : x))} />
              <Btn tone="ghost" onClick={() => setNav(state.nav.map((x, j) => j === i ? { ...x, visible: !x.visible } : x))}>{n.visible ? 'Visible' : 'Hidden'}</Btn>
              <Btn tone="ghost" onClick={() => setNav(state.nav.filter((_, j) => j !== i))}>Remove</Btn>
            </div>
          ))}
        </div>
        <Btn tone="ghost" className="mt-3" onClick={() => setNav([...state.nav, { id: Math.random().toString(36).slice(2, 9), label: 'New link', href: '#/', visible: true }])}>+ Add nav link</Btn>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900">Brand &amp; footer</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Site name"><input className={inputCls} value={state.settings.name} onChange={e => setSettings({ name: e.target.value })} /></Field>
          <Field label="Domain"><input className={inputCls} value={state.settings.domain} onChange={e => setSettings({ domain: e.target.value })} /></Field>
          <Field label="Footer note"><input className={inputCls} value={state.settings.footerNote} onChange={e => setSettings({ footerNote: e.target.value })} /></Field>
        </div>
      </div>
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
    if (source === 'tools') return state.tools.filter(item => item.status === 'live').map(item => ({ id: item.slug, label: item.name, detail: `#/tool/${item.slug}` }));
    if (source === 'pages') return state.pages.filter(item => item.status === 'live').map(item => ({ id: item.slug, label: item.title, detail: `#/p/${item.slug}` }));
    if (source === 'posts') return state.posts.filter(item => item.status === 'live').map(item => ({ id: item.slug, label: item.title, detail: `#/blog/${item.slug}` }));
    return [];
  };
  const createWidget = (type: SidebarWidgetType, source: SidebarLinkSource = 'manual') => {
    const names: Record<SidebarWidgetType, string> = { links: source === 'tools' ? 'Featured tools' : source === 'pages' ? 'Useful pages' : source === 'posts' ? 'Recommended reading' : 'Featured links', text: 'Sidebar note', image: 'Featured image', code: 'Custom HTML' };
    const widget: SidebarWidget = {
      id: Math.random().toString(36).slice(2, 9), title: names[type], type, visible: true,
      ...(type === 'links' ? { source, linkRefs: [], links: [] } : {}),
      ...(type === 'text' ? { content: 'Add your text, promotion, notice or seasonal message here.' } : {}),
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
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-800">{widget.title || 'Untitled sidebar section'}</p><p className="text-xs text-slate-500">{widget.type === 'links' ? `${source} links · ${(widget.linkRefs || widget.links || []).length} selected` : widget.type === 'text' ? 'Text content' : widget.type === 'image' ? 'Image content' : 'Sandboxed HTML / code'}</p></div>
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
                    {source !== 'manual' ? <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold text-slate-800 mb-3">Choose items to show</p><div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">{selectable.map(item => { const chosen = (widget.linkRefs || []).includes(item.id); return <button key={item.id} type="button" onClick={() => updateWidget(widget.id, { linkRefs: chosen ? (widget.linkRefs || []).filter(ref => ref !== item.id) : [...(widget.linkRefs || []), item.id] })} className={`flex items-center gap-3 text-left p-3 rounded-lg border ${chosen ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}><span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${chosen ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{chosen ? '✓' : '+'}</span><span className="min-w-0"><span className="block text-sm font-semibold text-slate-800 truncate">{item.label}</span><span className="block text-[11px] font-mono text-slate-400 truncate">{item.detail}</span></span></button>; })}{selectable.length === 0 && <p className="text-sm text-slate-500">There are no live {source} available to add.</p>}</div></div> : <div className="space-y-3"><p className="text-sm text-slate-600">Add any external or internal links manually.</p>{(widget.links || []).map((link, linkIndex) => <div key={link.id} className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto] gap-2"><input className={inputCls} value={link.label} placeholder="Link label" onChange={e => updateWidget(widget.id, { links: (widget.links || []).map((x, i) => i === linkIndex ? { ...x, label: e.target.value } : x) })} /><input className={inputCls} value={link.href} placeholder="#/tool/example or https://..." onChange={e => updateWidget(widget.id, { links: (widget.links || []).map((x, i) => i === linkIndex ? { ...x, href: e.target.value } : x) })} /><input className={inputCls} value={link.badge || ''} placeholder="Badge" onChange={e => updateWidget(widget.id, { links: (widget.links || []).map((x, i) => i === linkIndex ? { ...x, badge: e.target.value } : x) })} /><button type="button" onClick={() => updateWidget(widget.id, { links: (widget.links || []).filter((_, i) => i !== linkIndex) })} className="px-3 rounded-lg bg-red-50 text-red-600 border border-red-100">×</button></div>)}<Btn tone="ghost" onClick={() => updateWidget(widget.id, { links: [...(widget.links || []), { id: Math.random().toString(36).slice(2, 9), label: 'New link', href: '#/', visible: true }] })}>+ Add manual link</Btn></div>}
                  </>}
                  {widget.type === 'text' && <Field label="Text content" hint="Plain text is displayed with line breaks preserved."><textarea rows={6} className={inputCls} value={widget.content || ''} onChange={e => updateWidget(widget.id, { content: e.target.value })} placeholder="Write your announcement, promotion or sidebar note…" /></Field>}
                  {widget.type === 'image' && <div className="grid md:grid-cols-[minmax(0,1fr)_200px] gap-4"><div className="space-y-3"><Field label="Image URL"><input className={inputCls} value={widget.imageUrl || ''} onChange={e => updateWidget(widget.id, { imageUrl: e.target.value })} placeholder="https://example.com/banner.webp" /></Field><Field label="Alt text"><input className={inputCls} value={widget.imageAlt || ''} onChange={e => updateWidget(widget.id, { imageAlt: e.target.value })} /></Field><Field label="Click-through link (optional)"><input className={inputCls} value={widget.imageHref || ''} onChange={e => updateWidget(widget.id, { imageHref: e.target.value })} placeholder="#/tools" /></Field></div><div className="aspect-[1.91/1] rounded-xl border border-dashed border-slate-300 bg-white overflow-hidden flex items-center justify-center text-center text-xs text-slate-400">{widget.imageUrl ? <img src={widget.imageUrl} alt={widget.imageAlt || ''} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : 'Image preview'}</div></div>}
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

const SettingsPane: React.FC = () => {
  const { state, setPasscode, exportJson, importJson, reset } = useCms();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [json, setJson] = useState('');
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' })); a.download = 'cms-content.json'; a.click(); };
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-900">Passcode</h3>
        <Field label="New passcode" hint="Stored locally. Because this is a static site, this gate protects the UI, not the content files."><input className={inputCls} value={code} onChange={e => setCode(e.target.value)} placeholder={state.passcode} /></Field>
        <Btn tone="ok" onClick={() => { if (code.trim()) { setPasscode(code.trim()); setMsg('Passcode updated.'); setCode(''); } }}>Update passcode</Btn>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
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
type Tab = 'dashboard' | 'pages' | 'blog' | 'tools' | 'sidebar' | 'sections' | 'settings';
const TABS: [Tab, string][] = [['dashboard', 'Dashboard'], ['pages', 'Pages'], ['blog', 'Blog posts'], ['tools', 'Tools'], ['sidebar', 'Sidebar'], ['sections', 'Sections & Nav'], ['settings', 'Settings']];

export const AdminApp: React.FC = () => {
  const { loggedIn, logout, state } = useCms();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [authed, setAuthed] = useState(false);
  const isIn = loggedIn || authed;
  if (!isIn) return <Login onOk={() => setAuthed(true)} />;
  return (
    <div className="pt-24 pb-16 px-4">
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
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <a href="#/" className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">View live site ↗</a>
              <Btn tone="ghost" onClick={logout}>Sign out</Btn>
            </div>
          </div>
          <nav aria-label="CMS areas" className="border-t border-slate-100 px-3 py-3 md:px-4 flex gap-1.5 overflow-x-auto">
            {TABS.map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>{l}</button>
            ))}
          </nav>
        </header>
        {tab === 'dashboard' && <Dashboard go={setTab} />}
        {tab === 'pages' && <PagesPane />}
        {tab === 'blog' && <BlogPane />}
        {tab === 'tools' && <ToolsPane />}
        {tab === 'sidebar' && <SidebarPane />}
        {tab === 'sections' && <SectionsPane />}
        {tab === 'settings' && <SettingsPane />}
      </div>
    </div>
  );
};
