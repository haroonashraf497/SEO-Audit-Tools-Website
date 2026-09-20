import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { tools as staticTools, type ToolCategory, type InputType } from '../tools/data';
import { allArticles } from '../blog';

/* ============================================================
   SEO Audit Tool — built-in CMS
   Content lives in the browser (localStorage) and the public site
   renders from this store. Export JSON to version it in the repo.
   ============================================================ */

export type Status = 'live' | 'hidden' | 'draft';

export interface SeoEntry { title: string; description: string; slug?: string; noindex?: boolean }

export interface CmsTool {
  slug: string; name: string; description: string; category: ToolCategory;
  engine?: string; input: InputType; placeholder?: string; placeholder2?: string;
  status: Status; custom?: boolean; badge?: string; builtin: boolean;
  featuredImage?: string; featuredImageAlt?: string;
}

export interface CmsPost {
  slug: string; title: string; metaTitle: string; metaDescription: string; excerpt: string;
  content: string; category: string; date: string; readTime: string; author: string;
  keywords: string[]; status: Status; builtin: boolean;
  featuredImage?: string; featuredImageAlt?: string;
}

export type PageBlock =
  | { id: string; type: 'heading'; text: string; level: 2 | 3 }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'cta'; text: string; label: string; href: string };

export interface CmsPage {
  id: string; slug: string; title: string; metaTitle: string; metaDescription: string;
  blocks: PageBlock[]; status: Status;
  featuredImage?: string; featuredImageAlt?: string;
}

export interface SidebarItem { id: string; label: string; href: string; visible: boolean; badge?: string }

export type SidebarWidgetType = 'links' | 'text' | 'image' | 'code';
export type SidebarLinkSource = 'tools' | 'pages' | 'posts' | 'manual';

export interface SidebarWidgetLink {
  id: string;
  label: string;
  href: string;
  badge?: string;
  visible: boolean;
}

export interface SidebarWidget {
  id: string;
  title: string;
  type: SidebarWidgetType;
  visible: boolean;
  source?: SidebarLinkSource;
  linkRefs?: string[];
  links?: SidebarWidgetLink[];
  content?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageHref?: string;
}

export interface SidebarConfig {
  searchBox: boolean; searchPlaceholder: string;
  relevantTools: boolean; relevantCount: number; relevantTitle: string;
  popular: boolean; popularTitle: string; hiddenPopular: string[];
  latest: boolean; latestTitle: string; latestCount: number;
  cta: boolean; ctaTitle: string; ctaText: string; ctaLabel: string; ctaHref: string;
  widgets: SidebarWidget[];
  /** Legacy schema kept only so existing localStorage data can be migrated. */
  customItems?: SidebarItem[];
}

export interface NavItem { id: string; label: string; href: string; visible: boolean }

export interface SectionFlags {
  hero: boolean; auditTool: boolean; results: boolean; features: boolean; howItWorks: boolean;
  whyAudit: boolean; whoBenefits: boolean; freeTools: boolean; fromBlog: boolean; cta: boolean; footer: boolean;
}

export interface SiteSettings { name: string; domain: string; tagline: string; footerNote: string }

export interface CmsState {
  version: number;
  tools: CmsTool[];
  posts: CmsPost[];
  pages: CmsPage[];
  seo: Record<string, SeoEntry>;
  sidebar: SidebarConfig;
  sections: SectionFlags;
  settings: SiteSettings;
  nav: NavItem[];
  passcode: string;
}

/* ---------------- defaults (seeded from the built-in content) ---------------- */
const uid = () => Math.random().toString(36).slice(2, 9);

const defaultTools: CmsTool[] = staticTools.map(t => ({ ...t, status: 'live' as Status, builtin: true }));

const defaultPosts: CmsPost[] = allArticles.map(a => ({
  slug: a.slug, title: a.title, metaTitle: a.metaTitle, metaDescription: a.metaDescription,
  excerpt: a.excerpt, content: a.content, category: a.category, date: a.date, readTime: a.readTime,
  author: a.author, keywords: a.keywords, featuredImage: a.featuredImage, featuredImageAlt: a.featuredImageAlt, status: 'live' as Status, builtin: true,
}));

export const defaultState: CmsState = {
  version: 1,
  tools: defaultTools,
  posts: defaultPosts,
  pages: [
    {
      id: uid(), slug: 'about', title: 'About EKSTRUH LTD', status: 'live',
      metaTitle: 'About EKSTRUH LTD | SEO Audit Tool', metaDescription: 'Learn about EKSTRUH LTD, the company behind SEO Audit Tool and its practical online SEO, calculator and converter tools.',
      blocks: [
        { id: uid(), type: 'heading', text: 'Who we are', level: 2 },
        { id: uid(), type: 'text', text: 'EKSTRUH LTD provides SEO Audit Tool, an online collection of practical tools for marketers, developers, writers, businesses and site owners. The platform includes website audits, SEO checkers, performance tools, PDF utilities, calculators and unit converters.' },
        { id: uid(), type: 'heading', text: 'What you get', level: 2 },
        { id: uid(), type: 'list', items: ['On-page and technical SEO auditing', 'Core Web Vitals and PageSpeed guidance', 'Keyword, backlink, domain and IP research', 'Client-side PDF conversion and compression', 'Free plagiarism and grammar checking'] },
        { id: uid(), type: 'cta', text: 'Try the free audit tool and see what your site is missing.', label: 'Run a free SEO audit', href: '#/' },
      ],
    },
    {
      id: uid(), slug: 'privacy-policy', title: 'Privacy Policy', status: 'live',
      metaTitle: 'Privacy Policy | SEO Audit Tool', metaDescription: 'How SEO Audit Tool handles your data: tools run locally in your browser, we do not upload or store your documents, URLs or text.',
      blocks: [
        { id: uid(), type: 'heading', text: 'Your data stays with you', level: 2 },
        { id: uid(), type: 'text', text: 'All analysis, conversion and file processing happens locally in your browser. Files you open in the PDF tools, text you paste into the plagiarism or grammar checkers, and URLs you audit are never uploaded to our servers or stored by us.' },
        { id: uid(), type: 'heading', text: 'Third-party requests', level: 2 },
        { id: uid(), type: 'text', text: 'Some tools fetch public data (page HTML, IP geolocation, QR rendering) through public APIs. Only the URL or IP you explicitly submit is sent, and only when you press the action button.' },
        { id: uid(), type: 'heading', text: 'Cookies and storage', level: 2 },
        { id: uid(), type: 'text', text: 'We use browser local storage to remember preferences such as your theme, sidebar search history and CMS login state. No tracking cookies are used.' },
      ],
    },
    {
      id: uid(), slug: 'contact', title: 'Contact', status: 'live',
      metaTitle: 'Contact SEO Audit Tool | Support & Feedback', metaDescription: 'Get in touch with SEO Audit Tool for support, bug reports, partnership enquiries or feedback about our free SEO and PDF tools.',
      blocks: [
        { id: uid(), type: 'heading', text: 'Talk to us', level: 2 },
        { id: uid(), type: 'text', text: 'Found a bug, need a new tool, or want to partner with us? Send a message and we usually reply within one business day.' },
        { id: uid(), type: 'list', items: ['Support: help@seoaudittool.pk', 'Company: EKSTRUH LTD', 'Bug reports: include the tool URL and your browser'] },
        { id: uid(), type: 'cta', text: 'Looking for a specific tool? Browse the full directory.', label: 'Browse 130+ free tools', href: '#/tools' },
      ],
    },
  ],
  seo: {
    home: { title: 'SEO Audit Tool — Free Website SEO Checker | EKSTRUH LTD', description: 'Free SEO audit tool plus 150+ practical SEO, speed, IP, PDF, calculator and converter tools from EKSTRUH LTD.' },
    tools: { title: 'Free SEO Tools (150+) — Audit, Speed, Calculator & Converter Tools', description: 'Browse 150+ free tools from EKSTRUH LTD: website SEO audit, page speed, keyword research, backlinks, IP lookup, PDF tools, calculators and unit converters.' },
    blog: { title: 'SEO Blog: Core Web Vitals, PageSpeed & WordPress Guides', description: 'Practical SEO guides on fixing INP, LCP and CLS, PageSpeed problems, WordPress performance, indexing issues and Google core updates.' },
  },
  sidebar: {
    searchBox: true, searchPlaceholder: 'Search from SEO tools',
    relevantTools: true, relevantCount: 12, relevantTitle: 'Other Relevant Tools',
    popular: true, popularTitle: 'Popular SEO Tools', hiddenPopular: [],
    latest: true, latestTitle: 'Latest Articles', latestCount: 6,
    cta: true, ctaTitle: 'Free SEO Audit', ctaText: 'Check any website for 100+ on-page, technical and speed issues in 30 seconds.', ctaLabel: 'Run Audit →', ctaHref: '#/',
    widgets: [],
  },
  sections: { hero: true, auditTool: true, results: true, features: true, howItWorks: true, whyAudit: true, whoBenefits: true, freeTools: true, fromBlog: true, cta: true, footer: true },
  settings: { name: 'SEO Audit Tool', domain: 'seoaudittool.pk', tagline: 'Free SEO audit + 150 tools', footerNote: 'EKSTRUH LTD provides online SEO, calculator and unit converter tools.' },
  nav: [
    { id: uid(), label: 'Features', href: '#features', visible: true },
    { id: uid(), label: 'Tools', href: '#/tools', visible: true },
    { id: uid(), label: 'Blog', href: '#/blog', visible: true },
    { id: uid(), label: 'Users', href: '#audiences', visible: true },
  ],
  passcode: 'admin123',
};

/* ---------------- persistence ---------------- */
const KEY = 'seoaudittool:cms:v1';

const load = (): CmsState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<CmsState>;
    const oldSidebar = parsed.sidebar || {};
    const oldItems = Array.isArray((oldSidebar as SidebarConfig).customItems) ? (oldSidebar as SidebarConfig).customItems || [] : [];
    const migratedWidgets: SidebarWidget[] = Array.isArray((oldSidebar as SidebarConfig).widgets)
      ? (oldSidebar as SidebarConfig).widgets || []
      : oldItems.length
        ? [{ id: uid(), title: 'Featured links', type: 'links', visible: true, source: 'manual', links: oldItems.map(item => ({ ...item })) }]
        : [];
    return {
      ...defaultState, ...parsed,
      // Append tools introduced by newer builds to an existing browser CMS
      // without overwriting the admin's edits, visibility or custom tools.
      tools: Array.from(new Map([...defaultState.tools, ...(parsed.tools || [])].map(tool => [tool.slug, tool])).values()),
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      sidebar: { ...defaultState.sidebar, ...oldSidebar, widgets: migratedWidgets },
      sections: { ...defaultState.sections, ...(parsed.sections || {}) },
      seo: { ...defaultState.seo, ...(parsed.seo || {}) },
    };
  } catch { return defaultState; }
};

interface Ctx {
  state: CmsState;
  update: (patch: Partial<CmsState>) => void;
  /* tools */
  addTool: (t: Partial<CmsTool>) => string;
  saveTool: (slug: string, patch: Partial<CmsTool>) => void;
  setToolStatus: (slug: string, status: Status) => void;
  deleteTool: (slug: string) => void;
  /* posts */
  addPost: (p: Partial<CmsPost>) => string;
  savePost: (slug: string, patch: Partial<CmsPost>) => void;
  setPostStatus: (slug: string, status: Status) => void;
  deletePost: (slug: string) => void;
  /* pages */
  addPage: (p: Partial<CmsPage>) => string;
  savePage: (id: string, patch: Partial<CmsPage>) => void;
  setPageStatus: (id: string, status: Status) => void;
  deletePage: (id: string) => void;
  /* seo */
  setSeo: (key: string, entry: SeoEntry) => void;
  clearSeo: (key: string) => void;
  /* settings + sections + nav + sidebar */
  setSections: (patch: Partial<SectionFlags>) => void;
  setSidebar: (patch: Partial<SidebarConfig>) => void;
  setSettings: (patch: Partial<SiteSettings>) => void;
  setNav: (nav: NavItem[]) => void;
  /* data */
  reset: () => void;
  importJson: (json: string) => boolean;
  exportJson: () => string;
  /* auth */
  loggedIn: boolean;
  login: (code: string) => boolean;
  logout: () => void;
  setPasscode: (code: string) => void;
}

const CmsContext = createContext<Ctx | null>(null);

export const CmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CmsState>(() => load());
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ } }, [state]);

  const update = useCallback((patch: Partial<CmsState>) => setState(s => ({ ...s, ...patch })), []);

  const ctx: Ctx = useMemo(() => ({
    state, update,
    addTool: (t) => { const slug = t.slug || `custom-${uid()}`; setState(s => ({ ...s, tools: [{ slug, name: t.name || 'New tool', description: t.description || '', category: t.category || 'management', input: t.input || 'text', engine: t.engine, placeholder: t.placeholder, placeholder2: t.placeholder2, status: t.status || 'draft', custom: true, builtin: false, badge: t.badge, featuredImage: t.featuredImage, featuredImageAlt: t.featuredImageAlt }, ...s.tools] })); return slug; },
    saveTool: (slug, patch) => setState(s => ({ ...s, tools: s.tools.map(t => (t.slug === slug ? { ...t, ...patch } : t)) })),
    setToolStatus: (slug, status) => setState(s => ({ ...s, tools: s.tools.map(t => (t.slug === slug ? { ...t, status } : t)) })),
    deleteTool: (slug) => setState(s => ({ ...s, tools: s.tools.filter(t => t.slug !== slug) })),

    addPost: (p) => { const slug = p.slug || `post-${uid()}`; setState(s => ({ ...s, posts: [{ slug, title: p.title || 'Untitled post', metaTitle: p.metaTitle || p.title || 'Untitled post', metaDescription: p.metaDescription || '', excerpt: p.excerpt || '', content: p.content || '', category: p.category || 'Google & Indexing', date: p.date || new Date().toISOString().slice(0, 10), readTime: p.readTime || '6 min read', author: p.author || 'SEO Audit Tool Team', keywords: p.keywords || [], featuredImage: p.featuredImage, featuredImageAlt: p.featuredImageAlt, status: p.status || 'draft', builtin: false }, ...s.posts] })); return slug; },
    savePost: (slug, patch) => setState(s => ({ ...s, posts: s.posts.map(p => (p.slug === slug ? { ...p, ...patch } : p)) })),
    setPostStatus: (slug, status) => setState(s => ({ ...s, posts: s.posts.map(p => (p.slug === slug ? { ...p, status } : p)) })),
    deletePost: (slug) => setState(s => ({ ...s, posts: s.posts.filter(p => p.slug !== slug) })),

    addPage: (p) => { const id = uid(); setState(s => ({ ...s, pages: [{ id, slug: p.slug || `page-${id}`, title: p.title || 'New page', metaTitle: p.metaTitle || p.title || 'New page', metaDescription: p.metaDescription || '', blocks: p.blocks || [], featuredImage: p.featuredImage, featuredImageAlt: p.featuredImageAlt, status: p.status || 'draft' }, ...s.pages] })); return id; },
    savePage: (id, patch) => setState(s => ({ ...s, pages: s.pages.map(p => (p.id === id ? { ...p, ...patch } : p)) })),
    setPageStatus: (id, status) => setState(s => ({ ...s, pages: s.pages.map(p => (p.id === id ? { ...p, status } : p)) })),
    deletePage: (id) => setState(s => ({ ...s, pages: s.pages.filter(p => p.id !== id) })),

    setSeo: (key, entry) => setState(s => ({ ...s, seo: { ...s.seo, [key]: entry } })),
    clearSeo: (key) => setState(s => { const next = { ...s.seo }; delete next[key]; return { ...s, seo: next }; }),
    setSections: (patch) => setState(s => ({ ...s, sections: { ...s.sections, ...patch } })),
    setSidebar: (patch) => setState(s => ({ ...s, sidebar: { ...s.sidebar, ...patch } })),
    setSettings: (patch) => setState(s => ({ ...s, settings: { ...s.settings, ...patch } })),
    setNav: (nav) => setState(s => ({ ...s, nav })),

    reset: () => setState({ ...defaultState }),
    exportJson: () => JSON.stringify(state, null, 2),
    importJson: (json) => { try { const parsed = JSON.parse(json) as CmsState; if (!parsed.tools || !parsed.posts) return false; const legacyItems = parsed.sidebar?.customItems || []; const widgets = parsed.sidebar?.widgets || (legacyItems.length ? [{ id: uid(), title: 'Featured links', type: 'links' as SidebarWidgetType, visible: true, source: 'manual' as SidebarLinkSource, links: legacyItems }] : []); setState({ ...defaultState, ...parsed, sidebar: { ...defaultState.sidebar, ...parsed.sidebar, widgets } }); return true; } catch { return false; } },

    loggedIn,
    login: (code) => { if (code === state.passcode) { setLoggedIn(true); return true; } return false; },
    logout: () => setLoggedIn(false),
    setPasscode: (code) => setState(s => ({ ...s, passcode: code })),
  }), [state, loggedIn, update]);

  return <CmsContext.Provider value={ctx}>{children}</CmsContext.Provider>;
};

export const useCms = (): Ctx => {
  const c = useContext(CmsContext);
  if (!c) throw new Error('useCms must be used inside CmsProvider');
  return c;
};

/* ---------------- selectors used by the public site ---------------- */
export const liveTools = (s: CmsState) => s.tools.filter(t => t.status === 'live');
export const livePosts = (s: CmsState) => s.posts.filter(p => p.status === 'live').sort((a, b) => (a.date < b.date ? 1 : -1));
export const findTool = (s: CmsState, slug: string) => s.tools.find(t => t.slug === slug);
export const findPost = (s: CmsState, slug: string) => s.posts.find(p => p.slug === slug);
export const findPage = (s: CmsState, slug: string) => s.pages.find(p => p.slug === slug);
