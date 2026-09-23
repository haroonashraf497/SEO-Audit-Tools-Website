import { cleanHref } from '../router';

/* ============================================================
   Background route warming — homepage first, the rest afterwards.

   The split itself is unchanged: the document carries the static header shell
   plus the homepage, and every other route is a separate, content-hashed chunk
   that React.lazy fetches when that route opens. What used to be visible about
   that split was the wait — the first click on "Free SEO Tools" or "Blog"
   painted a loading state over the content area while 370 KB of tool code
   travelled.

   This module keeps the homepage in charge of the critical path and moves the
   remaining chunks off it, in two different ways on purpose:

    1. Background warming (after the shell has committed *and* the window
       `load` event has fired) injects `<link rel="prefetch">` for the public
       route chunks, one at a time from an idle callback. Prefetch only
       *downloads* — at the browser's lowest priority, into the HTTP cache —
       so it costs no main-thread time and cannot compete with the page being
       read. The later `React.lazy` import is then a cache hit. Warming with
       `import()` instead would also compile each chunk, which is precisely the
       blocking time the code-split build removed (see PERFORMANCE.md).
    2. Intent warming — pointing at, or tabbing to, an internal link — does
       `import()` that route's chunk straight away: the visitor has said they
       are about to open it, so downloading *and* compiling it now is what
       makes the navigation feel instant.

   Data Saver and 2G-class connections are skipped entirely, and the admin
   chunks are warmed only for a signed-in admin: they are of no use to a
   visitor, and `Admin` is the second-heaviest chunk on the site.

   Everything here is best-effort and silent. The path that has to work is
   still the on-demand one (`lazyRoute` → `importWithRetry` → `RouteBoundary`),
   which retries and then reports; a dropped prefetch simply means the route
   behaves exactly as it did before this module existed.
   ============================================================ */

type Loader = () => Promise<unknown>;

interface RouteChunk {
  /** Key in the build-time URL map — used for download-only prefetching. */
  urlKey: string;
  /** Matches the clean URL path (no query, no fragment) this chunk renders. */
  match: RegExp;
  /** Downloads *and* compiles the chunk, for a visitor about to open it. */
  load: Loader;
}

const TOOLS: RouteChunk = { urlKey: 'tools', match: /^\/tools?(?:\/|$)/, load: () => import('../tools/Tools') };
const BLOG: RouteChunk = { urlKey: 'blog', match: /^\/blog(?:\/|$)/, load: () => import('../blog/Blog') };
const COMPETITOR: RouteChunk = { urlKey: 'competitor', match: /^\/competitor-analysis(?:\/|$)/, load: () => import('../tools/CompetitorAnalysis') };
const ADMIN_LOGIN: RouteChunk = { urlKey: 'adminLogin', match: /^\/admin-(?:login|reset)(?:\/|$)/, load: () => import('../cms/AdminLogin') };
const ADMIN: RouteChunk = { urlKey: 'admin', match: /^\/admin(?:\/|$)/, load: () => import('../cms/Admin') };

/** Warmed in the background for every visitor, in rough order of usefulness. */
const PUBLIC_CHUNKS: RouteChunk[] = [TOOLS, BLOG, COMPETITOR];
/** Warmed only for a signed-in admin. */
const ADMIN_CHUNKS: RouteChunk[] = [ADMIN_LOGIN, ADMIN];
/** href → chunk lookup order: /admin-login must be tested before /admin. */
const ALL_CHUNKS: RouteChunk[] = [ADMIN_LOGIN, ADMIN, TOOLS, BLOG, COMPETITOR];

/** Built route-chunk URLs, substituted by scripts/route-chunks.ts. */
const readChunkUrls = (): Record<string, string> => {
  try {
    return JSON.parse('__ROUTE_CHUNK_URLS__') as Record<string, string>;
  } catch {
    // Dev server: modules are unbundled, so there is nothing to prefetch by URL.
    return {};
  }
};
const CHUNK_URLS = readChunkUrls();

/** Grace period after `load` before background warming starts: long enough
 *  that the homepage owns the connection, short enough that a click a few
 *  seconds later is already warm. */
export const PREFETCH_DELAY_MS = 1200;
/** An idle callback always fires by this deadline, even on a busy page. */
const IDLE_TIMEOUT_MS = 3000;
/** Fallback for browsers without `requestIdleCallback`. */
const IDLE_FALLBACK_MS = 250;

interface SaveDataNavigator extends Navigator {
  connection?: { saveData?: boolean; effectiveType?: string };
}

/** True when the visitor asked to save data or is on a 2G-class connection. */
const savesData = (): boolean => {
  const connection = (navigator as SaveDataNavigator).connection;
  if (!connection) return false;
  return connection.saveData === true || /^(?:slow-)?2g$/.test(connection.effectiveType || '');
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

/** Resolve when the browser has spare time (or after a short fallback wait). */
const whenIdle = (): Promise<void> => new Promise<void>((resolve) => {
  const win = window as IdleWindow;
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(() => resolve(), { timeout: IDLE_TIMEOUT_MS });
    return;
  }
  window.setTimeout(resolve, IDLE_FALLBACK_MS);
});

/** Queue one lowest-priority download. Resolves when it settles either way, so
 *  a dropped chunk only ever delays the rest of the queue. */
const prefetchUrl = (url: string): Promise<void> => new Promise<void>((resolve) => {
  if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) {
    resolve();
    return;
  }
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'script';
  // Same credentials mode as the module request Vite issues later, so the
  // cached response is the one that actually gets reused.
  link.crossOrigin = 'anonymous';
  link.href = url;
  link.addEventListener('load', () => resolve(), { once: true });
  link.addEventListener('error', () => resolve(), { once: true });
  document.head.appendChild(link);
});

const prefetched = new Set<string>();

/** Download one chunk at most once, without compiling it. */
const warmDownload = async (chunk: RouteChunk): Promise<void> => {
  const url = CHUNK_URLS[chunk.urlKey];
  if (!url || prefetched.has(url)) return;
  prefetched.add(url);
  await prefetchUrl(url);
};

/** Warm a queue one download at a time, waiting for idle time before each. */
const warmDownloads = async (queue: RouteChunk[]): Promise<void> => {
  for (const chunk of queue) {
    if (savesData()) return;
    await whenIdle();
    await warmDownload(chunk);
  }
};

const compiled = new Set<Loader>();

/** Download and compile one chunk at most once. Failures are forgotten, so a
 *  later attempt (or the real navigation, with its own retries) can succeed. */
const warmCompile = async (load: Loader): Promise<void> => {
  if (compiled.has(load)) return;
  compiled.add(load);
  try {
    await load();
  } catch {
    compiled.delete(load);
  }
};

/** Which chunk renders this href, if any. External links, mailto: and plain
 *  in-page fragments resolve to null — the router's own rules, reused. */
const chunkForHref = (href: string | null): RouteChunk | null => {
  const clean = cleanHref(href || '');
  if (clean === null) return null;
  const path = clean.split(/[?#]/)[0];
  for (const chunk of ALL_CHUNKS) {
    if (chunk.match.test(path)) return chunk;
  }
  return null;
};

let scheduled = false;

/** Start background warming of the public route chunks (idempotent). Called
 *  once React has committed the shell, i.e. after the homepage is on screen. */
export const startRoutePrefetch = (): void => {
  if (scheduled || typeof window === 'undefined') return;
  scheduled = true;
  const begin = () => {
    window.setTimeout(() => {
      if (!savesData()) void warmDownloads(PUBLIC_CHUNKS);
    }, PREFETCH_DELAY_MS);
  };
  if (document.readyState === 'complete') begin();
  else window.addEventListener('load', begin, { once: true });
};

let adminScheduled = false;

/** Warm the admin chunks for a signed-in admin (idempotent). */
export const startAdminPrefetch = (): void => {
  if (adminScheduled || typeof window === 'undefined') return;
  adminScheduled = true;
  if (!savesData()) void warmDownloads(ADMIN_CHUNKS);
};

let intentStarted = false;

/** Compile a route's chunk the moment a visitor points at or tabs to its link. */
export const startIntentPrefetch = (): void => {
  if (intentStarted || typeof document === 'undefined') return;
  intentStarted = true;
  const onIntent = (event: Event): void => {
    if (savesData()) return;
    const target = event.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor || (anchor.target && anchor.target !== '_self')) return;
    const chunk = chunkForHref(anchor.getAttribute('href'));
    if (chunk) void warmCompile(chunk.load);
  };
  // Capture phase: this only reads the hovered href, so it never interferes
  // with the router's own click handling.
  document.addEventListener('pointerover', onIntent, true);
  document.addEventListener('focusin', onIntent, true);
};
