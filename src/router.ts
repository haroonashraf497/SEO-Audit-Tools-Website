/* ============================================================
   Clean-URL router (History API) — replaces the legacy #/ hash router.

   • Routes come from location.pathname: /, /tools, /tool/slug,
     /blog, /blog/slug, /about, /admin …
   • Internal <a> clicks are intercepted → history.pushState,
     so navigation stays instant (no full reload).
   • Back/forward (popstate) re-renders the matching view.
   • In-page anchors (#features, #audiences) stay plain browser
     fragments — the native scroll behaviour is kept.
   • Legacy URLs are rewritten automatically on load:
       /#/p/about        → /about    (hash URLs never reach the
                                 server, so the app rewrites them
                                 client-side)
       /#/tools?cat=x    → /tools?cat=x
       /p/about          → /about    (.htaccess issues a 301 for
                                 this; this is the client fallback)
       /index.html       → /
     Canonical tags always point at the clean URL, so every old
     link stays SEO-safe even while it is being rewritten.
   ============================================================ */

export type RouteListener = (route: string) => void;

const listeners = new Set<RouteListener>();

/** Current URL path, normalised (no /index.html, no trailing slash). */
export const currentPath = (): string => {
  let p = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '');
  return p || '/';
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

/** Derive the app route from the current clean URL. */
export const getRoute = (): string => {
  const seg = currentPath().slice(1);
  if (seg === '') return 'home';
  if (seg === 'tools' || seg === 'tool') return 'tools';
  if (seg.startsWith('tool/')) return `tool/${seg.slice(5)}`;
  if (seg === 'blog') return 'blog';
  if (seg.startsWith('blog/')) return `blog/${seg.slice(5)}`;
  if (seg === 'admin') return 'admin';
  if (seg === 'admin-login') return 'admin-login';
  if (seg === 'admin-reset') return 'admin-reset';
  if (seg === 'competitor-analysis') return 'competitor-analysis';
  // Legacy /p/slug (301 in .htaccess) and the new single-segment pages
  if (seg.startsWith('p/')) return `p/${seg.slice(2)}`;
  if (!seg.includes('/')) return `p/${seg}`;
  return 'notfound';
};

/**
 * Convert any stored href (new clean path or legacy hash link) into a
 * clean same-origin URL. Returns null when the browser should handle
 * the link natively (external URLs, mailto:, bare in-page #anchors).
 */
export const cleanHref = (href: string): string | null => {
  const h = (href ?? '').trim();
  if (!h) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//')) return null; // external
  if (h.startsWith('#')) {
    const raw = h.slice(1);
    if (!raw.startsWith('/')) return null; // in-page anchor → native scroll
    const qIdx = raw.indexOf('?');
    const path = qIdx === -1 ? raw : raw.slice(0, qIdx);
    const query = qIdx === -1 ? '' : raw.slice(qIdx);
    return cleanPath(path) + query;
  }
  let u: URL;
  try {
    u = new URL(h, window.location.origin);
  } catch {
    return null;
  }
  if (u.origin !== window.location.origin) return null;
  return cleanPath(u.pathname) + u.search + u.hash;
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
  emit();
};

/**
 * One-shot legacy-URL normalisation, run before the first render:
 *  - /#/p/about (old hash link)  → /about
 *  - /#/tools?cat=keyword        → /tools?cat=keyword
 *  - /p/about (old clean link)   → /about
 *  - /index.html                 → /
 */
export const normalizeLegacyUrl = (): void => {
  const { pathname, search, hash } = window.location;
  if (hash && hash !== '#' && hash !== '#/') {
    const raw = hash.slice(1);
    const qIdx = raw.indexOf('?');
    const path = qIdx === -1 ? raw : raw.slice(0, qIdx);
    const query = qIdx === -1 ? search : raw.slice(qIdx);
    const innerHash = path.includes('#') ? path.slice(path.indexOf('#')) : '';
    window.history.replaceState(null, '', cleanPath(path) + query + innerHash);
    return;
  }
  const next = cleanPath(pathname) + search;
  if (next !== pathname + search) window.history.replaceState(null, '', next);
};

let started = false;

/** Intercept internal link clicks and follow browser back/forward. */
export const startRouter = (): void => {
  if (started) return;
  started = true;
  window.addEventListener('popstate', emit);
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
