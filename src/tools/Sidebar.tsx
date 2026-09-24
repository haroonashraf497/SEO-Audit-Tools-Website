import React, { useEffect, useMemo, useRef, useState } from 'react';
import { categoryLabels, type ToolCategory, type ToolDef } from './data';
import { useCms, liveTools, livePosts, type SidebarWidget } from '../cms/store';
import { looksLikeHtml, sanitizeRichHtml } from '../utils/sanitize';
import { cleanHref, navigate, rewriteLegacyLinks } from '../router';

const Arrow: React.FC<{ className?: string }> = ({ className = 'text-emerald-500' }) => (
  <svg className={`w-4 h-4 flex-shrink-0 ${className}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 5.2 20 12l-6.8 6.8-1.4-1.4 4.4-4.4H4v-2h12.2l-4.4-4.4z" /></svg>
);

// ---------- Live search box ----------
export const ToolSearch: React.FC<{ autoFocus?: boolean; placeholder?: string }> = ({ autoFocus, placeholder }) => {
  const { state: cmsState } = useCms();
  const cmsTools = useMemo(() => liveTools(cmsState), [cmsState]);
  const articles = useMemo(() => livePosts(cmsState), [cmsState]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return { tools: [] as ToolDef[], posts: [] as typeof articles };
    const score = (name: string, desc: string) => {
      const n = name.toLowerCase();
      if (n === s) return 100; if (n.startsWith(s)) return 80; if (n.includes(s)) return 60;
      const words = s.split(/\s+/).filter(Boolean);
      if (words.every(w => n.includes(w))) return 50;
      if (desc.toLowerCase().includes(s)) return 30;
      if (words.every(w => desc.toLowerCase().includes(w))) return 20;
      return 0;
    };
    const t = (cmsTools as unknown as ToolDef[]).map(x => ({ x, sc: score(x.name, x.description) })).filter(r => r.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 8).map(r => r.x);
    const p = articles.map(a => ({ a, sc: score(a.title, a.excerpt) })).filter(r => r.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 3).map(r => r.a);
    return { tools: t, posts: p };
  }, [q, cmsTools, articles]);

  const flat = [...results.tools.map(t => `/tool/${t.slug}`), ...results.posts.map(p => `/blog/${p.slug}`)];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => { setActive(0); }, [q]);

  const go = (href: string) => { navigate(href); setOpen(false); setQ(''); };
  const submit = () => {
    if (flat[active]) go(flat[active]);
    else if (q.trim()) { navigate(`/tools?q=${encodeURIComponent(q.trim())}`); setOpen(false); }
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); submit(); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder || 'Search SEO tools…'}
          aria-label="Search tools"
          className="flex-1 px-4 py-3.5 text-[15px] text-slate-800 outline-none bg-transparent placeholder:text-slate-500"
        />
        <button type="button" onClick={submit} aria-label="Search" className="w-[72px] bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        </button>
      </div>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
          {results.tools.length === 0 && results.posts.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">No tools match “{q}”. <a href={`/tools?q=${encodeURIComponent(q)}`} className="text-indigo-600 font-semibold">Browse all {cmsTools.length} tools</a></p>
          ) : (
            <>
              {results.tools.length > 0 && <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Tools</p>}
              {results.tools.map((t, i) => (
                <a key={t.slug} href={`/tool/${t.slug}`} onClick={() => go(`/tool/${t.slug}`)} onMouseEnter={() => setActive(i)}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${active === i ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <span className="font-medium text-slate-800 truncate">{t.name}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{categoryLabels[t.category].replace(' Tools', '')}</span>
                </a>
              ))}
              {results.posts.length > 0 && <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 border-t border-slate-100">Blog articles</p>}
              {results.posts.map((p, j) => { const i = results.tools.length + j; return (
                <a key={p.slug} href={`/blog/${p.slug}`} onClick={() => go(`/blog/${p.slug}`)} onMouseEnter={() => setActive(i)}
                  className={`block px-4 py-2.5 text-sm ${active === i ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <span className="font-medium text-slate-800 line-clamp-1">{p.title}</span>
                </a>
              ); })}
              <div className="px-4 py-2 bg-slate-50 text-[11px] text-slate-400 flex justify-between"><span>↑↓ to navigate · Enter to open</span><span>{cmsTools.length} tools · {articles.length} articles</span></div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Curated "popular" list with badges ----------
const POPULAR: [string, string?][] = [
  ['plagiarism-checker', 'Accurate Results'], ['article-rewriter', 'New'], ['grammar-checker'], ['what-is-my-ip'], ['website-seo-score-checker', 'Popular'], ['percentage-calculator'], ['bmi-calculator'],
  ['backlink-checker'], ['keyword-density-checker'], ['compress-pdf', 'New'], ['merge-pdf'], ['meta-tags-analyzer'], ['qr-code-generator'], ['domain-authority-checker'],
];

const ListPanel: React.FC<{ title: React.ReactNode; items: { href: string; label: string; badge?: string }[]; arrowClass?: string }> = ({ title, items, arrowClass }) => (
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
    <h3 className="text-xl font-bold text-slate-900 px-6 pt-6 pb-4">{title}</h3>
    <ul className="divide-y divide-slate-100">
      {items.map(it => (
        <li key={it.href}>
          <a href={it.href} className="flex items-center gap-3 px-6 py-3.5 text-[15px] text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors">
            <Arrow className={arrowClass} />
            <span className="flex-1 truncate">{it.label}</span>
            {it.badge && <span className={`text-[11px] font-semibold text-white px-2 py-0.5 rounded ${it.badge === 'New' ? 'bg-red-600' : it.badge === 'Popular' ? 'bg-indigo-600' : 'bg-red-700'}`}>{it.badge}</span>}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const safeEmbed = (value: string) => value
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '');

const CmsSidebarWidget: React.FC<{ widget: SidebarWidget; tools: ToolDef[]; posts: { slug: string; title: string }[]; pages: { slug: string; title: string; status: string }[] }> = ({ widget, tools, posts, pages }) => {
  if (!widget.visible) return null;
  if (widget.type === 'links') {
    let items: { href: string; label: string; badge?: string }[] = [];
    if (widget.source === 'tools') {
      items = (widget.linkRefs || []).map(ref => {
        const tool = tools.find(item => item.slug === ref);
        return tool ? { href: `/tool/${tool.slug}`, label: tool.name } : null;
      }).filter(Boolean) as { href: string; label: string }[];
    } else if (widget.source === 'posts') {
      items = (widget.linkRefs || []).map(ref => {
        const post = posts.find(item => item.slug === ref);
        return post ? { href: `/blog/${post.slug}`, label: post.title } : null;
      }).filter(Boolean) as { href: string; label: string }[];
    } else if (widget.source === 'pages') {
      items = (widget.linkRefs || []).map(ref => {
        const page = pages.find(item => item.slug === ref && item.status === 'live');
        return page ? { href: `/${page.slug}`, label: page.title } : null;
      }).filter(Boolean) as { href: string; label: string }[];
    } else {
      items = (widget.links || []).filter(item => item.visible && item.label).map(item => ({ href: item.href || '/', label: item.label, badge: item.badge }));
    }
    return items.length ? <ListPanel title={widget.title || 'Featured links'} items={items} arrowClass="text-indigo-500" /> : null;
  }
  if (widget.type === 'text') {
    const note = widget.content || '';
    // Notes written in the visual editor are rich HTML; legacy plain-text notes
    // keep their line breaks. Either way the markup is sanitised before render.
    const body = looksLikeHtml(note)
      ? <div className="rich-text text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: rewriteLegacyLinks(sanitizeRichHtml(note)) }} />
      : <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{note || 'Add text to this sidebar section from the CMS.'}</p>;
    return <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5"><h3 className="text-xl font-bold text-slate-900 mb-3">{widget.title || 'Sidebar note'}</h3>{body}</section>;
  }
  if (widget.type === 'image') {
    return <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">{widget.title && <h3 className="text-xl font-bold text-slate-900 px-5 pt-5">{widget.title}</h3>}{widget.imageUrl ? <a href={cleanHref(widget.imageHref || '') || '/'} className="block m-3 overflow-hidden rounded-lg bg-slate-100"><img src={widget.imageUrl} alt={widget.imageAlt || widget.title || ''} width="1200" height="630" loading="lazy" decoding="async" className="w-full h-auto object-cover" /></a> : <p className="px-5 pb-5 pt-3 text-sm text-slate-500">Add an image URL in the CMS to display this section.</p>}</section>;
  }
  return <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">{widget.title && <h3 className="text-xl font-bold text-slate-900 px-5 pt-5">{widget.title}</h3>}<iframe title={widget.title || 'Custom sidebar code'} srcDoc={safeEmbed(widget.content || '')} sandbox="" className="w-full min-h-[100px] border-0 mt-3" /></section>;
};

// ---------- The sidebar ----------
export const Sidebar: React.FC<{ category?: ToolCategory; currentSlug?: string; currentPost?: string }> = ({ category, currentSlug, currentPost }) => {
  const { state } = useCms();
  const cfg = state.sidebar;
  const cmsTools = useMemo(() => liveTools(state) as unknown as ToolDef[], [state]);
  const articles = useMemo(() => livePosts(state), [state]);
  const relevant = useMemo(() => {
    const pool = category ? cmsTools.filter(t => t.category === category && t.slug !== currentSlug) : cmsTools.filter(t => ['plagiarism-checker', 'grammar-checker', 'word-counter', 'keyword-density-checker', 'meta-tag-generator', 'website-seo-score-checker', 'backlink-checker', 'ssl-checker', 'what-is-my-ip', 'compress-pdf'].includes(t.slug));
    return pool.slice(0, cfg.relevantCount);
  }, [category, currentSlug, cmsTools, cfg.relevantCount]);
  const popular = POPULAR.map(([slug, badge]) => { const t = cmsTools.find(x => x.slug === slug); return t ? { href: `/tool/${t.slug}`, label: t.name, badge } : null; }).filter(Boolean) as { href: string; label: string; badge?: string }[];
  const posts = articles.filter(a => a.slug !== currentPost).slice(0, cfg.latestCount);
  const widgets = cfg.widgets || [];

  return (
    <aside className="space-y-5">
      {cfg.searchBox && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <ToolSearch placeholder={cfg.searchPlaceholder} />
        </div>
      )}
      {cfg.relevantTools && relevant.length > 0 && (
        <ListPanel title={cfg.relevantTitle} items={relevant.map(t => ({ href: `/tool/${t.slug}`, label: t.name }))} />
      )}
      {cfg.popular && (
        <ListPanel title={cfg.popularTitle} items={popular.filter(p => !p.href.endsWith(`/${currentSlug}`)).slice(0, 10)} arrowClass="text-blue-600" />
      )}
      {widgets.map(widget => <CmsSidebarWidget key={widget.id} widget={widget} tools={cmsTools} posts={articles} pages={state.pages} />)}
      {cfg.latest && posts.length > 0 && (
        <ListPanel title={cfg.latestTitle} items={posts.map(p => ({ href: `/blog/${p.slug}`, label: p.title }))} arrowClass="text-indigo-500" />
      )}
      {cfg.cta && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-5 text-white">
          <p className="font-bold text-lg leading-tight">{cfg.ctaTitle}</p>
          <p className="text-sm text-white mt-1">{cfg.ctaText}</p>
          <a href={cleanHref(cfg.ctaHref) || cfg.ctaHref} className="inline-block mt-3 bg-white text-indigo-600 text-sm font-bold px-4 py-2 rounded-lg hover:shadow-lg transition-shadow">{cfg.ctaLabel}</a>
        </div>
      )}
    </aside>
  );
};
