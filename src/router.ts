/* ============================================================
   Clean-URL router (History API) — replaces the legacy #/ hash router.

   • Routes come from location.pathname: /, /free-seo-tools (the tools index),
     /ip-tools (a category page), /plagiarism-checker (a tool page at the top
     level), /blog, /blog/slug, /about, /admin …
   • Internal <a> clicks are intercepted → history.pushState,
     so navigation stays instant (no full reload).
   • Back/forward (popstate) re-renders the matching view.
   • In-page anchors (#features, #audiences) stay plain browser
     fragments — the native scroll behaviour is kept.
   • Each navigation records how it happened (`lastNavigationKind`), which the
     app uses to decide whether to reset the scroll position.
   • Legal pages answer on the short canonical URL (/privacy, /cookies,
     /terms). The CMS keeps its original slugs, so the long form is upgraded
     on load and by .htaccess instead of 404-ing.
   • Legacy URLs are rewritten automatically on load:
       /#/p/about        → /about    (hash URLs never reach the
                                 server, so the app rewrites them
                                 client-side)
       /#/tools?cat=x    → /x-tools        (the category page)
       /#/tools          → /free-seo-tools (tools index)
       /tools, /tool, /free-tools, /free-seo-tool → /free-seo-tools (index)
       /free-seo-tools/<slug>            → /<slug>   (tool page, top level)
       /tool/<slug>, /free-tools/<slug>, /free-seo-tool/<slug> → /<slug>
       /free-seo-tools?cat=ip            → /ip-tools  (category page)
       /privacy-policy   → /privacy  (.htaccess 301s it as well)
       /p/about          → /about    (.htaccess issues a 301 for
                                 this; this is the client fallback)
       /index.html       → /
     Canonical tags always point at the clean URL, so every old
     link stays SEO-safe even while it is being rewritten.
   ============================================================ */

import { categoryFromSlug, categoryFromKey, categoryHref, categoryOrder, type ToolCategory } from './tools/data';

/** Canonical URL of the tools index — the directory listing every tool.
 *  Internal route id stays `free-tools`. */
export const TOOLS_PATH = '/free-seo-tools';

/** Every older spelling of the tools index, redirected to `TOOLS_PATH`. */
export const LEGACY_TOOLS_PATHS = ['/tools', '/tool', '/free-tools', '/free-seo-tool'];

/** Tool pages sit at the top level: /plagiarism-checker, /merge-pdf, …
 *  `TOOL_PATH_BASE` is the prefix every tool URL is built from — empty, so
 *  `toolPath(slug)` is `/<slug>`. */
export const TOOL_PATH_BASE = '';

/** Canonical path of a tool page ('' base → a bare top-level slug). */
export const toolPath = (slug: string): string => `${TOOL_PATH_BASE}/${slug}`;

/** Every older prefix a tool page may still arrive on — including the
 *  /free-seo-tools/<slug> spelling that used to be canonical. */
export const LEGACY_TOOL_PATHS = [TOOLS_PATH, '/free-seo-tool', '/free-tools', '/tool'];

/** The category keys that can appear in a legacy ?cat= filter. */
const isCategoryKey = (value: string): value is ToolCategory =>
  (categoryOrder as string[]).includes(value);

/** Upgrade a path to the current hierarchy:
 *    /free-seo-tools/<slug>, /tool/<slug>, /free-tools/<slug>,
 *    /free-seo-tool/<slug>              → /<slug>   (top-level tool page)
 *    /tools, /tool, /free-tools, /free-seo-tool (no slug)
 *                                       → /free-seo-tools (the index)
 *  Paths that are already canonical — including the category pages
 *  (/ip-tools, /website-checker-tools, …) — are returned untouched. */
export const canonicalToolsPath = (pathname: string): string => {
  if (pathname === TOOLS_PATH) return pathname;
  for (const prefix of LEGACY_TOOL_PATHS) {
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return LEGACY_TOOLS_PATHS.includes(pathname) ? TOOLS_PATH : pathname;
};

/**
 * Move a legacy ?cat=<key> filter onto its category page, keeping any other
 * query parameter (a search term, for example):
 *    /free-seo-tools?cat=ip        → /ip-tools
 *    /free-seo-tools?cat=checker&q=ssl → /website-checker-tools?q=ssl
 * Returns null when the URL does not need upgrading.
 */
export const canonicalCategoryQuery = (pathname: string, search: string): string | null => {
  const params = new URLSearchParams(search);
  const raw = params.get('cat') || '';
  const key = isCategoryKey(raw) ? raw : categoryFromSlug(raw);
  if (!key) return null;
  if (pathname !== TOOLS_PATH && !LEGACY_TOOLS_PATHS.includes(pathname)) return null;
  params.delete('cat');
  const qs = params.toString();
  return `${categoryHref(key)}${qs ? `?${qs}` : ''}`;
};

/** Category key behind a `cat/<key>` route id (`cat/ip` → 'ip'). */
export const categoryKeyOfRoute = (route: string): ToolCategory | null =>
  categoryFromKey(route.slice('cat/'.length));

export type RouteListener = (route: string) => void;

/** How the current route was reached. Drives scroll behaviour: a click starts
 *  at the top of the new page, while back/forward and the first paint keep the
 *  position the browser restored. */
export type NavigationKind = 'init' | 'push' | 'replace' | 'pop';

let navigationKind: NavigationKind = 'init';

/** The kind of the most recent navigation (see `NavigationKind`). */
export const lastNavigationKind = (): NavigationKind => navigationKind;

/** Legal pages are published at short URLs. The CMS keeps the original page
 *  slugs, so `/privacy` renders the `privacy-policy` page — the address bar,
 *  the canonical tag and every footer link use the short URL, and .htaccess
 *  301s the long form for links that arrive from outside the app. */
export const LEGAL_PAGE_ALIASES: Record<string, string> = {
  privacy: 'privacy-policy',
  cookies: 'cookie-policy',
  terms: 'terms-of-service',
};

/** Long legal paths → their canonical short URL. */
const LEGACY_LEGAL_PATHS: Record<string, string> = {
  '/privacy-policy': '/privacy',
  '/cookie-policy': '/cookies',
  '/terms-of-service': '/terms',
};

/** CMS slug that stores the page behind a route slug (identity by default). */
export const storedSlugForRoute = (routeSlug: string): string =>
  LEGAL_PAGE_ALIASES[routeSlug] || routeSlug;

/** Public URL slug for a stored CMS slug (identity by default). */
export const routeSlugForStored = (storedSlug: string): string =>
  Object.keys(LEGAL_PAGE_ALIASES).find(alias => LEGAL_PAGE_ALIASES[alias] === storedSlug) || storedSlug;

/** Upgrade a legacy legal path to its canonical short URL. */
export const canonicalLegalPath = (pathname: string): string =>
  LEGACY_LEGAL_PATHS[pathname] || pathname;

const listeners = new Set<RouteListener>();

/** Current URL path, normalised (no /index.html, no trailing slash). */
export const currentPath = (): string => {
  return cleanPath(window.location.pathname);
};

/** Normalise a path: drops /index.html, the legacy /p/ page prefix,
 *  duplicate slashes and the trailing slash. */
export const cleanPath = (pathname: string): string => {
  let p = pathname.replace(/\/index\.html$/i, '');
  if (p === '/p' || p === '/p/') p = '/';
  else if (p.startsWith('/p/')) p = p.slice(2);
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  return p || '/';
};

/**
 * Derive the app route from the current clean URL. The path is canonicalised
 * first, so a legacy tool URL (/free-seo-tools/x, /tool/x, …) already resolves
 * to its top-level route even on the very first paint.
 *
 *   /free-seo-tools      → free-tools   (index)
 *   /ip-tools            → cat/ip       (category page)
 *   /plagiarism-checker  → p/plagiarism-checker
 *                          (a root slug — CMS page or tool, resolved by the app)
 */
export const getRoute = (): string => {
  const seg = canonicalToolsPath(currentPath()).slice(1);
  if (seg === '') return 'home';
  if (seg === TOOLS_PATH.slice(1) || LEGACY_TOOLS_PATHS.some(p => p.slice(1) === seg)) return 'free-tools';
  if (seg.startsWith('tool/')) return `p/${seg.slice('tool/'.length)}`;
  const category = categoryFromSlug(seg);
  if (category) return `cat/${category}`;
  if (seg === 'blog') return 'blog';
  if (seg.startsWith('blog/')) return `blog/${seg.slice(5)}`;
  if (seg === 'admin') return 'admin';
  if (seg === 'admin-login') return 'admin-login';
  if (seg === 'admin-reset') return 'admin-reset';
  if (seg === 'competitor-analysis') return 'competitor-analysis';
  // Legacy /p/slug (301 in .htaccess), CMS pages and the top-level tool pages
  if (seg.startsWith('p/')) return `p/${seg.slice(2)}`;
  if (!seg.includes('/')) return `p/${seg}`;
  return 'notfound';
};

/**
 * Convert any stored href (new clean path or legacy hash link) into a
 * clean same-origin URL, upgrading legacy legal paths to their canonical
 * short form. Returns null when the browser should handle the link natively
 * (external URLs, mailto:, bare in-page #anchors).
 */
export const cleanHref = (href: string): string | null => {
  const h = (href ?? '').trim();
  if (!h || (h.startsWith('#') && !h.startsWith('#/'))) return null;
  let u: URL;
  try {
    // Resolve relative links just as the browser does (including nested routes).
    u = new URL(h.startsWith('#/') ? h.slice(1) : h, window.location.href);
  } catch {
    return null;
  }
  if (u.origin !== window.location.origin || !/^https?:$/.test(u.protocol)) return null;
  return canonicalLegalPath(cleanPath(u.pathname)) + u.search + u.hash;
};

/** Rewrite legacy hash links inside stored HTML to clean URLs
 *  (keeps any old CMS content pointing at /about instead of #/p/about). */
export const rewriteLegacyLinks = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/href\s*=\s*([\"'])#\/p\/([^\"']*)[\"']/gi, 'href=$1/$2$1')
    .replace(/href\s*=\s*([\"'])#\/([a-z0-9][^\"']*)[\"']/gi, 'href=$1/$2$1')
    .replace(/href\s*=\s*([\"'])#\/?["']/gi, 'href=$1/$1');
};

const emit = (): void => {
  const r = getRoute();
  listeners.forEach(l => {
    try {
      l(r);
    } catch {
      /* a broken listener must not break navigation */
    }
  });
};

/** Subscribe to route changes (internal navigation + back/forward). */
export const subscribe = (l: RouteListener): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** pushState (or replaceState) + notify the app. */
export const navigate = (to: string, opts: { replace?: boolean } = {}): void => {
  const url = cleanHref(to);
  if (url === null) return;
  if (opts.replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  navigationKind = opts.replace ? 'replace' : 'push';
  emit();
};

/**
 * One-shot legacy-URL normalisation, run before the first render:
 *  - /#/p/about (old hash link)  → /about
 *  - /#/tools?cat=keyword        → /keyword-tools   (category page)
 *  - /free-seo-tools?cat=ip      → /ip-tools
 *  - /free-seo-tools?cat=x&q=ssl → /x-tools?q=ssl
 *  - /tools, /tool, /free-tools, /free-seo-tool → /free-seo-tools (index)
 *  - /free-seo-tools/<slug>, /tool/<slug>, /free-tools/<slug>,
 *    /free-seo-tool/<slug>       → /<slug>   (top-level tool page)
 *  - /p/about (old clean link)   → /about
 *  - /index.html                 → /
 */
export const normalizeLegacyUrl = (): void => {
  const { pathname, search, hash } = window.location;
  // Only #/… is a legacy route. #features and other document fragments
  // must survive reloads, bookmarks and "Open in new tab" unchanged.
  if (hash.startsWith('#/')) {
    const legacy = new URL(hash.slice(1), window.location.origin);
    let p = cleanPath(legacy.pathname);
    p = canonicalToolsPath(p);
    const q = legacy.search || search;
    const category = canonicalCategoryQuery(p, q);
    window.history.replaceState(null, '', (category ? category : canonicalLegalPath(p) + q) + legacy.hash);
    return;
  }
  let next = cleanPath(pathname);
  next = canonicalToolsPath(next);
  next = canonicalLegalPath(next);
  const category = canonicalCategoryQuery(next, search);
  if (category) {
    if (category + hash !== pathname + search + hash) window.history.replaceState(null, '', category + hash);
    return;
  }
  next = next + search + hash;
  if (next !== pathname + search + hash) window.history.replaceState(null, '', next);
};

let started = false;

/** Intercept internal link clicks and follow browser back/forward. */
export const startRouter = (): void => {
  if (started) return;
  started = true;
  window.addEventListener('popstate', () => {
    // Back/forward: the browser restores the scroll position, so the app must
    // not force the top.
    navigationKind = 'pop';
    emit();
  });
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      // Clicking a link inside the visual editor must place the caret, not navigate.
      if (target.closest('[contenteditable="true"]')) return;
      const a = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== '_self') return; // opens a new tab — let the browser handle it
      if (a.hasAttribute('download')) return;
      if (a.origin && a.origin !== window.location.origin) return; // absolute URL to another site
      const url = cleanHref(a.getAttribute('href') || '');
      if (url === null) return;
      e.preventDefault();
      navigate(url);
    },
    true,
  );
};
