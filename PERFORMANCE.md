# Build, caching and mobile notes — single-file build

## What ships

`npm run build` produces **one document**: `dist/index.html` contains the
application, all 154 tools, the blog, the CMS/admin UI, the rich-text editors
and the stylesheet inline. There are no `assets/` chunks and no lazy network
request between routes.

| File | Role |
| --- | --- |
| `index.html` | the whole app — prerendered homepage markup, inline CSS, inline application script |
| `.htaccess` | Apache/LiteSpeed rules (legacy `/tools` and `/p/…` redirects, security headers, caching) |
| `404.html`, `favicon.svg`, `og.jpg`, `robots.txt`, `sitemap.xml` | static files crawlers and browsers request directly |

The single-file build is a deliberate product decision: opening any route is
instant and no screen ever shows a loading placeholder, because nothing is
fetched on demand. The cost is the trade-off described below — first visit
downloads the whole app instead of just the homepage.

## Instant navigation

Route changes are synchronous — there is no Suspense boundary, no fallback and
no fetched chunk anywhere in the app:

| Mechanism | Where |
| --- | --- |
| Routes are **static imports** (no `React.lazy`, no dynamic `import()` for app code) | `src/App.tsx`, `src/tools/Tools.tsx` |
| PDF tool pages no longer sit behind a Suspense fallback — the UI renders in the same commit; only the PDF *libraries* still stream from their CDN inside the tool | `src/tools/Tools.tsx`, `src/tools/pdf/engine.ts` |
| `<main class="content-shell">` is at least `calc(100vh - 4rem)` tall, so the footer always sits below the fold instead of touching the header on short pages | `src/index.css` |
| Scroll handling runs in a **layout effect**: a link click lands at the top of the new page before the browser paints, while back/forward and reloads keep the position the browser restores. `html { scroll-behavior: smooth }` is bypassed so the jump can never animate | `src/App.tsx`, `src/router.ts` (`lastNavigationKind()`) |

In a single-file build eager imports are free: the code was already inside the
document, so removing the asynchronous boundary changes nothing about what is
downloaded — only about when it can render. React flushes a click
synchronously, so the new page is on screen in the same task as the click: no
empty frame, no spinner, no flash of the previous page's scroll offset.

## What that means for visitors

- **No loading state anywhere.** Every route renders from code that arrived
  with the document — there is no `LoadingFallback`, no `role="status"`
  placeholder and no "Loading page…" string left in the build.
- **Repeat visits revalidate only.** Apache sends
  `Cache-Control: public, max-age=0, must-revalidate` for HTML, so an unchanged
  deploy answers with a cheap `304 Not Modified` and no body transfer. A new
  deploy is picked up immediately on the next visit.
- **Crawlers** get the prerendered homepage markup plus the inline app script;
  `favicon.svg`, `og.jpg`, `robots.txt` and `sitemap.xml` are served as files.
- The prerender gate (`scripts/prerender.mjs`) still decides whether to hydrate
  the prerendered homepage or render fresh: a saved CMS state, an admin session
  or a cookie choice makes the visitor skip hydration and render from their own
  browser content.

## Verification

```sh
npm ci
npm run build
npm run typecheck
npm test                                    # needs Chromium (see playwright.config.ts)
node scripts/verify-single-file.mjs         # optional: jsdom smoke test of dist/index.html
```

`npm test` runs the Playwright suite: direct visit/reload of pages, tools, PDF
UIs, blog, login and competitor analysis; legacy hash and `/p/` URLs; fragments;
back/forward; the noindex not-found view; a 154-tool render sweep; the CMS
login with both editors; the CMS panels (navigation, brand & footer, footer
logo upload, header verification & ads); accessibility on the homepage; and the
single-file build contract (no external script, no CSS/JS request at runtime,
no loading placeholder).

Navigation timing has its own coverage:

- **Per-frame sampling** — the content area is sampled on every
  `requestAnimationFrame` while two links are clicked; no frame may be empty or
  collapsed (`site.spec.ts`, "navigation is instant").
- **Same-task render** — a click is dispatched inside the page and `<main>` is
  read in the next statement; the new route must already be there
  (`resilience.spec.ts`).
- **Sticky footer** — computed `min-height` and the footer's offset are checked
  on short pages (`site.spec.ts`).
- **Scroll rules** — a click returns `scrollY` to 0 while
  `history.scrollRestoration` stays `auto` for back/forward (`site.spec.ts`).
- **Headless** — `scripts/verify-single-file.mjs` boots the built file in jsdom
  and asserts the same swap synchronously, with no browser required.

`scripts/verify-single-file.mjs` boots the built `dist/index.html` in jsdom and
checks the same behaviours without a browser:

```sh
npm i --no-save jsdom
node scripts/verify-single-file.mjs
```

## Where the build is configured

`vite.config.ts` wires `vite-plugin-singlefile` with
`useRecommendedBuildConfig: false` (so the public base path stays absolute) and
sets the equivalent options explicitly: `cssCodeSplit: false`,
`assetsInlineLimit: () => true`, `rollupOptions.output.inlineDynamicImports:
true`, `modulePreload: false`. `scripts/prerender.mjs` then renders the real
homepage into the document and inserts the hydration gate — using the **last**
`</head>` / `<div id="root"></div>` landmarks, because the inline application
script itself contains those strings inside JavaScript literals.

## Images (mobile)

- The homepage hero is pure CSS/gradient — no bitmap is rendered.
- `og.jpg` (1200×630, 47 KB) is only fetched by crawlers and social platforms.
- CMS-uploaded images are downscaled to 1600 px and re-encoded as WebP/JPEG
  before being embedded as data URLs; content images get `loading="lazy"` and
  `decoding="async"` at render time.

## Deployment

Deploy the whole `dist/` folder (index.html, `.htaccess` and the public files):

```sh
npm run build
rm -rf public_html/assets && cp -r dist/. public_html/
node scripts/check-hosting.mjs https://YOUR-STAGING-HOST
```

Apache/LiteSpeed needs `mod_rewrite`, `mod_deflate`, `mod_headers` and
`mod_expires` with AllowOverride. Verify on staging:

- `curl --compressed -I https://YOUR-HOST/` → 200, `text/html`.
- `curl --compressed -I https://YOUR-HOST/tools` → **301** to `/free-tools`.
- `curl --compressed -I https://YOUR-HOST/about` → 200 (not redirected to `/`).
- `https://YOUR-HOST/assets/` → 404/403 (nothing should be deployed there).
