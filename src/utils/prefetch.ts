/**
 * Intent-based route prefetching + route-readiness gating.
 *
 * Route chunks (Tools, Blog, CompetitorAnalysis, Admin) are fetched lazily so a
 * first visit downloads only what it needs. Two behaviours here keep navigation
 * seamless:
 *
 *  1. `startIntentPrefetch` warms a chunk the moment the pointer/focus/touch
 *     lands on a link that points at it, so a click usually resolves from cache.
 *
 *  2. `prefetchPath(path)` returns a *promise* that settles when the chunk that
 *     renders `path` has loaded. The router (src/App.tsx) awaits it before
 *     committing the new route, which keeps the PREVIOUS page mounted and
 *     visible until the next page is genuinely ready — no blank body, no gap,
 *     no loading message. Non-lazy routes settle immediately.
 *
 *  3. A tool page's split engine (PDF/convert chunks) is warmed in the same
 *     step, so the tool body is complete on its FIRST render instead of
 *     growing after paint (which would shift the page = CLS).
 *
 * Nothing is fetched on load and nothing for the page you are on, so the
 * code-split contract (home paints from the entry chunk only) is preserved.
 */

import { getTool } from '../tools/data';
import { loadPdfEngineModule, pdfEngineSpec } from '../tools/pdf/engineRegistry';
import { warmToolModule } from '../tools/toolModules';
import { warmArticleContent } from '../blog/content';

type Loader = () => Promise<unknown>;

/** Route prefix → the chunk that renders it. Mirrors the lazyRoute loaders. */
const ROUTE_LOADERS: Array<{ test: (path: string) => boolean; load: Loader }> = [
  { test: p => p === '/tools' || p.startsWith('/tool/'), load: () => import('../tools/Tools') },
  { test: p => p === '/blog' || p.startsWith('/blog/'), load: () => import('../blog/Blog') },
  { test: p => p.startsWith('/competitor-analysis'), load: () => import('../tools/CompetitorAnalysis') },
  { test: p => p.startsWith('/admin'), load: () => import('../cms/Admin') },
];

/** One in-flight (or settled) promise per loader so repeats resolve from cache. */
const inflight = new Map<Loader, Promise<unknown>>();

const loadCached = (load: Loader): Promise<unknown> => {
  let p = inflight.get(load);
  if (!p) {
    p = load().catch(err => {
      // A failed prefetch may be retried by a later navigation.
      inflight.delete(load);
      throw err;
    });
    inflight.set(load, p);
  }
  return p;
};

/**
 * Tool pages with a split engine need a second chunk before their body is
 * complete. Warm it here so the page never grows after paint; a failure is
 * swallowed on purpose — the route still commits and the boundary inside the
 * tool page reports the error with a retry, instead of stranding navigation.
 */
function warmToolEngine(path: string): Promise<void> {
  if (!path.startsWith('/tool/')) return Promise.resolve();
  const slug = path.slice('/tool/'.length).split('/')[0];
  const engine = getTool(slug)?.engine;
  // The tool's own component chunk (one tool only — never the other 153)…
  const component = warmToolModule(slug, engine);
  // …and, for PDF/convert tools, the split engine chunk as well.
  const pdf = pdfEngineSpec(engine);
  const engineChunk = pdf ? loadPdfEngineModule(pdf.mod).then(() => undefined, () => undefined) : Promise.resolve();
  return Promise.all([component, engineChunk]).then(() => undefined);
}

/**
 * Resolves when every chunk needed to render `path` has loaded (immediately for
 * routes whose views live in the entry chunk). Rejects only if a chunk fails.
 */
export function prefetchPath(path: string): Promise<void> {
  const loads = ROUTE_LOADERS.filter(({ test }) => test(path)).map(({ load }) => loadCached(load));
  // A blog article's body lives in its own chunk; warm it too so the article
  // renders complete in the route's first commit (no reserve, no shift).
  const article = path.startsWith('/blog/') ? warmArticleContent() : Promise.resolve();
  return Promise.all([...loads, warmToolEngine(path), article]).then(() => undefined);
}

const intentFromTarget = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('a[href]');
  if (!anchor) return null;
  const href = anchor.getAttribute('href') || '';
  // Internal, same-origin paths only; ignore fragments, downloads, externals.
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  return href;
};

let wired = false;

/** Attach once. Listens for hover/focus/touch and prefetches the hovered route. */
export function startIntentPrefetch(): void {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  const onIntent = (event: Event) => {
    const path = intentFromTarget(event.target);
    if (path) prefetchPath(path).catch(() => { /* fall back to normal lazy load */ });
  };
  for (const type of ['pointerover', 'focusin', 'touchstart', 'mousedown'] as const) {
    document.addEventListener(type, onIntent, { passive: true, capture: true });
  }
}
