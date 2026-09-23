# Loading states — instant header, subtle spinner, background warming (2026-09-23)

## The reported problem

Two visible gaps sat between the request and the page:

1. **A blank document.** The prerendered homepage in `#root` is deliberately
   hidden unless the visit is a fresh home visit with no saved CMS, cookie or
   admin state (that gate is protected — see the 2026-09-22 section). So every
   **deep link** (`/tools`, `/about`, `/blog/…`, `/tool/…`) and every **repeat
   visit** painted *nothing at all* until the 538 KB entry chunk had downloaded,
   parsed and rendered. Header, brand and navigation were part of that wait.
2. **A block of "Loading page…" text.** Once the app was up, each route chunk
   (`Tools` alone is 370 KB) replaced the whole content area with that sentence
   while it travelled — on the first click of the session, every time.

## What changed

| Change | Where | Effect |
| --- | --- | --- |
| Static **boot shell**: header, brand, navigation (desktop + mobile menu) and a spinner, written as plain HTML with a small `<style>` in `<head>` | `index.html` | Painted by the browser from HTML + CSS alone — the header is on screen in the first frame of *every* visit, with or without JavaScript |
| **CSS-only handover**: `html[data-prerender-home] #boot-shell` and `#root:not([data-prerender]):not(:empty) ~ #boot-shell` | `index.html` `<style>` | The shell is up while `#root` is empty or hidden, and gone the instant React commits the real header — no flash, no duplicate navigation. `src/App.tsx` then removes the node |
| Shell **deadline**: after 12 s without React, the spinner is swapped for the same "taking too long to load" + Reload panel the app uses | `index.html` inline script | A bundle that never arrives ends in an action, not an endless spinner. A late commit still hides the whole shell |
| **Subtle spinner** instead of the text block; the wording survives as screen-reader-only text | `src/components/ErrorBoundary.tsx`, `.route-spinner`/`.sr-text` in `src/index.css` | `role="status"` still announces "Loading page…", crawlers and assistive tech see the same thing, and the content area no longer fills with that sentence. Custom labels (the PDF-engine notice) render exactly as before |
| **Background warming**: after the shell commits *and* `load` has fired, `<link rel="prefetch" as="script" crossorigin>` for `Tools`, `Blog`, `CompetitorAnalysis` — one at a time, from an idle callback | `src/utils/prefetch.ts` | The rest of the site downloads at the browser's lowest priority while the visitor reads. Prefetch **only downloads**; it does not compile, so it adds no main-thread time and cannot regress TBT. The later `React.lazy` import is a cache hit |
| **Intent warming**: pointing at or tabbing to an internal link `import()`s just that route's chunk | `src/utils/prefetch.ts` | The common case (hover a tool, click it) has nothing left to fetch *or* compile |
| Data Saver / 2G skip everything; admin chunks warm only for a signed-in admin | `src/utils/prefetch.ts` | No wasted bytes on constrained connections; the 136 KB `Admin` chunk is never sent to a visitor |
| Route-chunk URLs injected at build time (content-hashed names cannot be written in source) | `scripts/route-chunks.ts` + `vite.config.ts` | The entry chunk learns `/assets/Tools-<hash>.js` etc. after minification; the **document still references only the entry chunk** |

Ordering is the point: homepage first (entry chunk + prerender/static shell),
everything else afterwards and in the background.

## Explicitly unchanged

- **URLs, `.htaccess` and routing**: no path, rewrite, canonical, OG tag,
  sitemap, robots or structured-data change. `src/router.ts` is untouched; the
  prefetch module only *reads* hrefs through the router's existing `cleanHref`.
- **All 154 tools, Team SAT and the Pakistan SEO copy**, tool URLs, the PDF
  engines' on-demand CDN loading, the CMS, admin, both rich-text editors,
  drafts, media library, export/import.
- **The prerender/hydration gate** — a fresh home visit still paints the
  prerendered homepage and hydrates; saved CMS settings, admin sessions and
  cookie choices still bypass it (now with the static header instead of a blank
  document while the app loads).
- **The chunk layout** and every hashed `/assets/*` file name strategy; the
  document ships no route code and preloads no route chunk.
- Branding: the shell mirrors the live header (SEO Audit Tools / EKSTRUH LTD
  defaults). No old domain or retired branding was reintroduced anywhere.

## Tests

`npm run build && npm run typecheck && npm test` (Playwright; needs Chromium).

- `tests/site.spec.ts` — the code-split contract is now "homepage first, the
  rest warms in the background": at `load` the entry chunk is still the only
  script fetched *and* compiled, the shell adds no second `<main>`/`<h1>`/live
  region, and the public route chunks then arrive on their own while the admin
  chunks do not.
- `tests/resilience.spec.ts` — adds the shell: header/brand/navigation visible
  with every script stalled, the 12 s reload panel, the handover leaving exactly
  one navigation, and a fresh home visit never showing the shell. The existing
  stalled-chunk assertion (`main` contains "Loading page…") still holds through
  the screen-reader-only text.

Verified without a browser in this sandbox (no Chromium download available):
the built document/artefacts (`dist` route-chunk map points at real files, the
document references only the entry chunk), the shell's handover and deadline
logic driven through jsdom against the real built HTML, and the prefetch
scheduler (delay, idle gating, one-at-a-time queue, dedupe, href→chunk mapping,
Data Saver opt-out, failure tolerance) driven against the real module.

---

# Mobile performance — code-split build (2026-09-22)

## What changed and why

The previous build embedded **every** route (154 tools, CMS/admin, editors,
blog, competitor analysis) inside one `dist/index.html`. Lighthouse
reproduced the reported field issue exactly:

> Reduce unused JavaScript — **181 KiB** — estimated savings, mobile,
> on every visit. FCP/LCP on the same lab run: **7.5 s** (production PSI
> reported 3.0 s).

The document is now prerendered homepage markup + inline CSS only, and the
application graph ships as content-hashed external chunks that React.lazy
fetches **when a route is opened**:

| File | Role | Home visit |
| --- | --- | --- |
| `index.html` (140 KB raw / **24 KB gz**) | Prerendered homepage + inline stylesheet + bootstrapping tag | only document downloaded |
| `assets/index-*.js` | React + homepage + shared CMS store | fetched (deferred, preloaded) |
| `assets/Tools-*.js` | All 154 tool UIs/engines | **not fetched** |
| `assets/Admin-*.js`, `AdminLogin-*.js`, `Blog-*.js`, `CompetitorAnalysis-*.js`, `PdfTools-*.js`, `ConvertTools-*.js`, `ui-*.js`, `Sidebar-*.js` | Editors, blog, analysis, PDF engines | **not fetched** |

Hashed `/assets/*` responses now send `Cache-Control: public, max-age=31536000,
immutable` (see `public/.htaccess`), so repeat visits load **no application JS
from the network at all** — they revalidate the small HTML shell only.

## Local A/B (Lighthouse 13.5, Chromium 153, mobile preset, simulated
throttling, same sandbox and server class for both builds)

| Metric | Old single-file build | Code-split build |
| --- | ---: | ---: |
| Performance | 58 | **99** |
| First Contentful Paint | 7.5 s | **1.7 s** |
| Largest Contentful Paint | 7.5 s | **1.7 s** |
| Total Blocking Time | 110 ms | **0 ms** |
| Speed Index | 7.5 s | **1.7 s** |
| Total transfer | 1,336 KiB | **185 KiB** |
| Estimated unused JS | 181 KiB | **56 KiB** |

The sandbox reports slower absolute times than production (no CDN, no
keep-alive tuning), so production FCP/LCP should be faster than the 1.7 s lab
number; the **<1.8 s target is met in the lab**, and field numbers depend on
the host's TTFB (previously measured 714 ms — see deployment notes below).

The remaining 56 KiB "unused on home" is **not route code**: it is the CMS
seed data (default blog article bodies and default page copy) that the CMS
provider requires synchronously to keep admin/editors/export-import byte-for-
byte unchanged. Splitting it would change CMS data-flow behaviour, which was
out of scope ("keep CMS, admin, editors unchanged").

## Explicitly unchanged

- Desktop design, layout and behaviour — no markup, styling or component
  changes. Desktop now caches hashed chunks, so repeat desktop visits are
  lighter too (previously the full 1.3 MB HTML was revalidated every visit).
- All 154 tools, their URLs, the PDF engines' on-demand CDN loading, the CMS,
  admin, both rich-text editors, drafts, media library and export/import.
- Clean-URL routing, legacy hash/`/p/` rewrites, canonical tags, sitemap,
  robots, structured data.
- The prerender/hydration gate (fresh home visits paint prerendered markup,
  then hydrate; saved CMS settings, admin sessions and cookie choices still
  bypass it).

## Images (mobile)

- The homepage hero is pure CSS/gradient — no bitmap is rendered, so no hero
  image is downloaded on mobile.
- The one bundled bitmap is `og.jpg` (1200×630 social image, 47 KB, fetched
  only by crawlers/social platforms). It is already efficiently encoded;
  recompressing yielded <1 KB savings, so it is untouched.
- Content/hero images inside CMS rich text now get `loading="lazy"` +
  `decoding="async"` defaults at render time if an editor or import omitted
  them (loading hints only — no layout or markup-visible change).
- Featured-image slots (blog/tool/page/sidebar) already had
  `width`/`height`/`loading="lazy"`; they now also decode asynchronously.
- Images uploaded through the CMS media library are already downscaled to
  1600 px and re-encoded as WebP at insert time.
- Remote featured-image URLs (external hosts) can only be resized at their
  host/CDN — the browser cannot rewrite another origin's image.

## Tests

```sh
npm ci
npm run build
npm run typecheck
npm test          # needs Chromium; see playwright.config.ts (CHROME_PATH)
```

23 Playwright tests pass, including:

- Direct load/reload of pages, tools, PDF UIs, blog, login and competitor
  analysis; legacy hashes; fragments; back/forward; noindex not-found.
- Smoke-render **all 154 built-in tool URLs**, plus a calculator result change.
- Blog article reload; admin login; typing in both rich-text editors.
- Saved CMS settings override defaults after reload.
- Axe homepage accessibility with no violations.
- New: the code-split contract — the document ships no route code, home
  compiles only the entry chunk, and opening a tool fetches the Tools chunk
  at exactly that moment.

## Hosting deployment and verification

Deploy the **whole `dist/` folder** — `index.html`, `.htaccess` **and** the
`assets/` directory. `index.html` alone is no longer the whole app:

```sh
npm run build
# sync the tracked deployment copies
rm -rf public_html/assets && cp -r dist/. public_html/
# upload public_html/* (including assets/) to the web host
node scripts/check-hosting.mjs https://YOUR-STAGING-HOST
```

Apache/LiteSpeed must have `mod_rewrite`, `mod_deflate`, `mod_headers` and
`mod_expires` with AllowOverride. Verify on staging:

- `curl --compressed -I https://YOUR-HOST/assets/<entry>.js` → 200,
  `text/javascript`, `Cache-Control: ... immutable`.
- `curl --compressed -I https://YOUR-HOST/about` → 200 (not redirected to `/`).
- Run PageSpeed Insights on `/`, a tool, a blog article and a CMS page after
  deployment.

## Protected canonical behavior: pre-existing issue

The SEO helper still emits hash-style canonical/OG URLs (for example
`https://seoaudittools.pk/#/about`) despite clean browser routes. It remains
deliberately unchanged because canonical tags were marked protected; tests
assert their existing values.
