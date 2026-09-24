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
| `index.html` (146 KB raw / **25 KB gz**) | Critical shell (header) + prerendered homepage + inline stylesheet + bootstrapping tag | only document downloaded |
| `assets/index-*.js` | React + homepage + shared CMS store | fetched (deferred, preloaded) |
| `assets/Tools-*.js` | All 154 tool UIs/engines | **not fetched** |
| `assets/Admin-*.js`, `AdminLogin-*.js`, `Blog-*.js`, `CompetitorAnalysis-*.js`, `PdfTools-*.js`, `ConvertTools-*.js`, `ui-*.js`, `Sidebar-*.js` | Editors, blog, analysis, PDF engines | **not fetched** |

Hashed `/assets/*` responses now send `Cache-Control: public, max-age=31536000,
immutable` (see `public/.htaccess`), so repeat visits load **no application JS
from the network at all** — they revalidate the small HTML shell only.

## Critical shell — the header paints before any JavaScript (2026-09-23)

The prerender gate only lets a *fresh* visit to `/` paint prerendered markup.
Every other first paint — any deep link, or any return visit with saved cookie
consent / CMS settings — had `#root` hidden and showed **nothing at all** until
`assets/index-*.js` had been downloaded, parsed and executed. Visitors saw a
blank white page, and then "Loading page…" on its own, with no logo, no brand
and no navigation above it.

The header is now part of the HTML document itself, and **no loading message
is shown at all** — the "Loading page…" notice is gone from the shell and from
`LoadingFallback`, which now renders `null` while a chunk is on its way:

```html
<body>
  <div id="app-shell" aria-hidden="true">   <!-- first thing in <body> -->
    <nav class="fixed top-0 …">logo · SEO Audit Tools · Free SEO Tools · …</nav>
  </div>
  <div id="root" data-prerender>…</div>
</body>
```

- **Order.** `#app-shell` is the first element in `<body>`, so the logo, brand
  and navigation are the first pixels the parser can paint — with nothing
  above them and nothing else on the page.
- **No loading message of any kind.** The shell holds the header and nothing
  else, and `LoadingFallback` has no default label, so a page or route
  transition is silent: the content simply appears when its chunk arrives. The
  only thing that can still surface is the recovery panel, and only after the
  12 s stall deadline. (The PDF engine chunk keeps its own one-time
  `LoadingFallback label={…}` — that is pre-existing tool behaviour, not the
  page-loading notice.)
- **No layout collapse while waiting.** A silent transition used to leave
  `<main>` empty, which pulled the footer up against the navigation until the
  chunk arrived. `LoadingFallback` now renders an *invisible* spacer
  (`min-h-[calc(100vh-4rem)]`, no text, `aria-hidden`) so the content area
  keeps its height and the footer stays pinned to the bottom of the viewport;
  the real content replaces the spacer on arrival. Loaded pages are unchanged.
- **Navigation keeps the current page until the next is ready.** The route
  commit is *gated* on the next route's chunk: `subscribe` (src/App.tsx) awaits
  `prefetchPath(path)` — which resolves as soon as the chunk that renders the
  target is loaded (immediately for entry-chunk routes) — and only then calls
  `setRoute` inside `startTransition`. The previous page therefore stays
  mounted and visible until the new one can paint; there is no blank body, gap
  or message between pages. A 6 s ceiling commits anyway so a stalled chunk can
  never strand the visitor, and hover prefetch usually makes the swap instant.
  On a first visit to a deep link (nothing to keep), the silent
  height-reserving spacer shows instead.
- **No empty-body flash on navigation.** Route chunks are prefetched on user
  intent (`src/utils/prefetch.ts`): the first `pointerover`/`focusin`/`touchstart`/
  `mousedown` on an internal link starts the `import()` for the route it points
  to, so clicking a tool or blog link resolves from the module cache and renders
  immediately. Nothing is fetched on load, so the code-split contract (home
  paints from the entry chunk only) is preserved — prefetching only ever starts
  from intent.
- **No scripts involved.** The shell is styled by the stylesheet that is
  already inlined into `<head>`, so it needs no request, no parse and no
  execution. It paints on the first frame regardless of how slow the
  JavaScript is (or whether it ever arrives).
- **No layout shift.** `#app-shell` is `display: contents`, so the wrapper
  generates no box at all: the fixed `<nav>` inside it takes part in the layout
  as if it were a direct child of `<body>`. The shell cannot add height, push
  the real content down, leave a gap, or stack above the app.
- **Never drifts from the design.** `scripts/prerender.mjs` extracts the
  `<nav>` the app itself renders and injects it into the shell marker at build
  time, so the shell is the real header markup rather than a hand-kept copy.
  The build fails loudly if the extraction ever stops matching.
- **Handover.** `RouteBoundary.componentDidMount` (which wraps the whole app in
  `main.tsx`) removes `#app-shell` in the commit phase — after React has
  inserted its own identical header and before the browser paints. One header,
  no flash, no gap. It also runs when the boundary is already showing the
  error panel, so a page that cannot render never keeps claiming it is loading.
- **Inert.** The shell is `aria-hidden` and every link/button inside it carries
  `tabindex="-1"`, so it never adds a duplicate landmark or traps the tab
  order; screen readers and axe only ever see the real header.
- **Scripts start earlier.** The entry `<script type="module">` moved from the
  end of `<body>` into `<head>`, so the preload scanner finds the hashed chunk
  while the document is still arriving instead of after ~90 KB of inline CSS
  and prerendered markup. Module scripts are deferred by specification, so
  first paint still does not wait for them.

Everything else loads exactly as before: route chunks (`Tools-*`, `Admin-*`,
`Blog-*`, …) stay lazily fetched on navigation, the stylesheet stays inlined,
and the homepage stays prerendered for crawlers.

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

27 Playwright tests pass in `tests/site.spec.ts`, including:

- Direct load/reload of pages, tools, PDF UIs, blog, login and competitor
  analysis; legacy hashes; fragments; back/forward; noindex not-found.
- Smoke-render **all 154 built-in tool URLs**, plus a calculator result change.
- Blog article reload; admin login; typing in both rich-text editors.
- Saved CMS settings override defaults after reload.
- Axe homepage accessibility with no violations.
- The code-split contract — the document ships no route code, home compiles
  only the entry chunk, and opening a tool fetches the Tools chunk at exactly
  that moment.
- New: the render-order contract — `#app-shell` is the first element in
  `<body>` holding only the logo/brand/nav, the header is still on screen (and
  is the *only* thing on screen) when JavaScript is completely unavailable,
  React leaves exactly one header nav behind, and neither the document nor a
  route transition ever shows a loading message.
  (`tests/resilience.spec.ts` adds 3 more for stalled/failed chunks.)

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

## Core Web Vitals pass (2026-09-24)

PSI on the homepage reported Performance 58 with **CLS 0.881** (target < 0.1)
and Speed Index ~3.7 s. Root causes and fixes:

- **CLS — `content-visibility:auto` on the homepage sections.** The five
  `#features` / `#how-it-works` / `#audiences` / free-tools / from-blog
  sections used `.cv-auto { content-visibility:auto; contain-intrinsic-size:auto
  500px; }`. When a section scrolled into view its real height differed from the
  500 px estimate and the whole page reflowed — a cumulative shift well over
  0.1. Removed the class from all five sections (and the CSS rule). The sections
  are static DOM already in the prerendered HTML, so rendering them normally
  costs nothing and eliminates the shift. The homepage has **zero `<img>` tags**,
  so images were not the source here.
- **CLS — content images reserve their box before load.** The rich-text
  sanitiser now stamps every `<img>` from CMS/editor/pasted markup with
  `width`/`height` (default 1200×675, 16:9) when absent, plus `loading=lazy`
  `decoding=async`. The browser reserves the intrinsic aspect-ratio box before
  the bytes arrive, so late images never push layout.
- **FCP / LCP < 1.8 s.** Critical CSS (nav, footer, buttons, hero, forms,
  header) is inlined in `<head>` by `scripts/inline-critical-css.mjs`; the full
  stylesheet loads `media=print` → `onload=media=all`; the single entry script is
  `type=module` (deferred). The header/hero paint from the prerendered HTML with
  no JS.
- **Speed Index < 3.0 s / smallest initial payload.** The homepage ships in one
  entry chunk with no tool/blog/admin code; all 154 tools + CMS + editors are
  separate on-demand chunks, prefetched on link hover/focus so navigation
  commits with no network wait.
- **No dynamic content pushes the page after paint:** the cookie banner is
  `position:fixed`, the nav is `fixed` with a matching `h-16` spacer, and
  navigation keeps the current route mounted until the target chunk is ready
  (no Suspense blank), so nothing reflows post-paint.

## Core Web Vitals audit pass (2026-09-24, measured in headless Chromium)

Measured with the production `dist/`, mobile and desktop viewports, 4× CPU
throttling and slow 4G (1.6 Mbps / 150 ms RTT) — i.e. the same conditions PSI
uses. Every number below is from the shipped build.

\* `What is my IP` waits on a third-party geolocation API (unreachable from the
test sandbox, so the timeout is what the lab measures). Its layout is stable
throughout — CLS 0.027 — and no loading message is shown while it waits.

| Route | CLS | FCP | LCP |
|---|---|---|---|
| `/` | **0.0000** | 0.94 s | 1.02 s |
| `/tools` | **0.0000** | 0.62 s | 1.32 s |
| `/tool/merge-pdf` | **0.0000** | 0.62 s | 1.34 s |
| `/tool/website-page-speed-checker` | **0.0000** | 0.62 s | 1.72 s |
| `/blog` | **0.0000** | 0.62 s | 0.91 s |
| `/blog/<article>` | **0.0000** | 0.61 s | 1.21 s |
| `/about` | **0.0000** | 0.61 s | 0.91 s |
| `/admin`, `/admin-login` | **0.0000** | 0.62 s | 0.93 s |
| `/tool/what-is-my-ip` | 0.027 | 0.95 s | 4.28 s* |

### Cumulative Layout Shift — what actually caused it

1. **`content-visibility: auto` + `contain-intrinsic-size: auto 500px`** on the
   five homepage sections. Each section's real height differed from the 500 px
   estimate, so the page reflowed as they scrolled into view. The class and rule
   are gone; the sections are static DOM in the prerendered HTML.
2. **Tool pages: the engine chunk arrived after paint.** A PDF tool rendered its
   body at 226 px, then grew to 878 px when the engine mounted — 0.19 to 0.22 of
   shift. The page now waits for the engine (invisible reserve, no spinner, no
   loading copy) and mounts the body **and** everything below it in one commit;
   the router also warms the engine chunk during navigation, so this is normally
   a cache hit and the reserve is never visible.
3. **`What is my IP` swapped a spinner for the page** (0.41). It now renders its
   final layout from the first paint with `—` placeholders that fill in when the
   lookup answers — same rows, same heights, and the "Detecting your public IP
   address…" loading message is gone entirely.
4. **`/admin` dropped the public footer** once the console loaded (0.74). The
   admin route now decides before the first paint, matching its final design.
5. **Content images reserve their box**: the rich-text sanitiser stamps every
   `<img>` with `width`/`height` (default 1200×675) plus `loading=lazy`
   `decoding=async`.
6. No web fonts (system-ui stack) → no font-swap shift; the cookie banner is
   `position: fixed`; the nav spacer is a static `h-16`.

### Unused JavaScript / initial payload

- **Homepage: 524.1 → 451.6 KiB of JavaScript, one single JS request** (the
  entry chunk; all CSS is inlined in `<head>`), so the critical chain is
  2 resources: HTML + one script.
- **Tool pages: the route chunk went 360.9 → 76.9 KiB.** Every tool component is
  now its own lazy chunk (`WebTools` 43.6, `WebGenerators` 52.0, `IpTools` 31.0,
  `CalculatorTools` 18.8, `CodeTools` 15.9, `ConverterTools` 10.6, `engines`,
  `PdfTools` 21.9, `ConvertTools` 35.4 KiB) loaded only when that tool opens —
  previously one PDF tool page downloaded ~250 KiB of other tools' code.
- **Blog article bodies (81 KiB) are a separate chunk**, fetched by the article
  page and the CMS editor only — not by the homepage, tools or listing.
- Remaining "unused" bytes on the homepage are React DOM's runtime branches
  (~124 KiB) plus the hero analyser's report/export paths, which mount only
  after an audit is run.
- **No preconnect is needed**: the public pages load zero cross-origin
  resources (the PDF libraries come from a CDN only when a PDF tool is used).

### Accessibility — axe-core: 0 violations on every audited route

- Badge text `emerald-600` on `emerald-50` was 3.47:1 → **`emerald-700`, 5.21:1**
  (this is the green "Instant · runs in your browser" / "Instant" badge that
  appears on tool pages, including the PDF tools).
- Blog meta text `slate-400` on white was 2.63:1 → **`slate-500`, 4.76:1**.
- Heading order: article cards on `/blog` used `h3` directly under the page
  `h1`; the card now renders `h2` in the listing and still `h3` inside an
  article's "Keep reading" section (same classes, same look).
- All four previously failing areas (`/tools` 111 nodes, `/blog` 24 + heading
  order, tool pages 1) now report **0**.

## Accessibility to 100 (2026-09-24, axe-core on every public page)

Audited with axe-core (the engine Lighthouse/PSI use) at mobile and desktop
viewports, including the `best-practice` rule set that PSI counts in its
accessibility score. **154/154 tool pages, the homepage, the blog, every CMS
page and the admin screens now report 0 violations.**

Contrast (measured ratios, WCAG 2.1 AA):

| Element | Before | After |
|---|---|---|
| Primary button / CTA gradient (`indigo-500 → purple-600`), white text | 4.47:1 | **6.46:1** (`indigo-600 → purple-600`, the gradient the logo already used) |
| Green tool badges (`emerald-600` on `emerald-50`) | 3.47:1 | **5.21:1** (`emerald-700`) |
| PDF stat values (`emerald/amber/red-600` on `slate-50`) | 3.2–3.7:1 | **5.0–5.9:1** (`-700`) |
| Amber/green grammar stat cards (`amber-500`, `green-500` on `-50`) | 2.06 / 2.35:1 | **3.09 / 3.47:1** (`-600`) |
| Proxy-table anonymity cells (`emerald/amber-600` on white) | 3.2–3.7:1 | **5.0:1** (`-700`) |
| Small grey captions (`slate-400` on white/`slate-50`/`slate-100`) | 2.4–2.6:1 | **4.8–6.9:1** (`slate-500/600`) |
| Blog meta text and admin preview labels | 2.4–4.3:1 | **4.6–6.9:1** |

Heading order: every page now has a single `h1` followed by sequential levels.

- Tool page sections ("How it works", "Location & Network", "Plagiarism Report",
  "All issues", "Processing your article", …) were `h3`/`h4` directly under the
  page `h1` — promoted to `h2` (and their children to `h3`).
- Blog listing cards were `h3` under the page `h1` — now `h2` in the listing and
  still `h3` inside an article's "Keep reading" section.
- Footer column titles were `h3` straight after the page `h1` on short pages —
  now `h2`.

Form controls: 44 inputs, textareas and selects across the tools had a *visible*
label that was not programmatically associated (or none at all). Each now
carries an `aria-label` (or inherits one from the shared field component), so
screen readers announce them. The horizontally scrolling proxy table is
keyboard-reachable (`tabindex="0"` with a label). Icon-only step buttons in the
Article Rewriter got spoken names.

None of these changes alter the visual design beyond the small colour-shade
adjustments listed above — heading tags are visually inert here because
Tailwind's preflight resets `h1`–`h6` to `font-size/weight: inherit` and the
classes carry the styling.

## Unused JavaScript: where the remaining bytes go

DevTools coverage on the homepage (mobile, 4× CPU) reports 246.9 KiB of the
451.6 KiB entry chunk as not executed. That is branch coverage, not dead code —
attributing every generated byte back through the source map gives:

| KiB | module | reachable on the homepage? |
|---|---|---|
| 170.6 | `react-dom-client.production.js` | required to render at all; the uncovered part is React's own error/lane/priority branches |
| 103.0 | `src/App.tsx` | the homepage *is* this file (audit engine, results UI, footer, static pages) |
| 70.9 | `src/cms/store.tsx` | yes — `CmsProvider` wraps the app and the homepage reads live tools/posts from CMS state; the uncovered part is the CMS authoring helpers (save/import/export) |
| 39.4 | `src/tools/data.tsx` | yes — homepage category grid and `ToolIcon` |
| 7.6 | `src/utils/seo.ts` | yes — title/meta + JSON-LD per route |
| 44.5 | react, scheduler, SerpPreview, pageFetch, sanitize, router, auth, prefetch, error boundary, blog metadata, pdf registry | yes |
| 6.0 | Rollup runtime/interop helpers | — |

Everything else that used to sit in the entry chunk is now split out and
downloaded only when the matching route opens — **712.4 KiB across 21 chunks**
(the tool catalogue, all 154 tool implementations, the CMS admin, the blog
article bodies, and the shared PDF/UI engines). The homepage downloads one
JavaScript file.

The two largest deferred items that remain in the entry (`cms/store.tsx` and
`tools/data.tsx`) are read during homepage render, so they cannot be lazily
imported without changing behaviour; `cms/store.tsx` is also the CMS, which is
out of scope for this work.
