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
