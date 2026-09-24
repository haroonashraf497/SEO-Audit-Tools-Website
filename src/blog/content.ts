/**
 * Access to the built-in article bodies (see articleContent.ts).
 *
 * The bodies are a lazily-imported chunk, but they must not appear "after the
 * page has painted" — that would grow the article page and shift everything
 * below it. So this module offers the same two-step contract the tool pages
 * use:
 *
 *  • `warmArticleContent()` — called by the router while it prepares a
 *    /blog/<slug> navigation (and on link hover), so the chunk is usually in
 *    memory before the route commits.
 *  • `articleContentSync(slug)` — synchronous lookup used during render.
 *
 * When the chunk is not there yet, the article page reserves the space
 * invisibly (never a spinner or a loading message) and fills it in one commit.
 */
type ContentMap = Record<string, string>;

let promise: Promise<ContentMap> | null = null;
let settled: ContentMap | null = null;

/** Fetch (once) the article bodies. Never rejects: a miss leaves text empty. */
export function loadArticleContent(): Promise<ContentMap> {
  if (!promise) {
    promise = import('./articleContent')
      .then(module => { settled = module.ARTICLE_CONTENT; return settled; })
      .catch(() => ({} as ContentMap));
  }
  return promise;
}

/** The body for a slug when the chunk is already loaded, else null. */
export function articleContentSync(slug: string): string | null {
  if (!settled) return null;
  return settled[slug] ?? null;
}

/** Warm the chunk without caring about the result (router/prefetch hook). */
export function warmArticleContent(): Promise<void> {
  return loadArticleContent().then(() => undefined);
}
