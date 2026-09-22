# Routing and performance verification — 2026-09-22

## Changes

- Guard the `/index.html` redirect with `THE_REQUEST`. An internal Apache SPA
  rewrite must serve the document at the original URL, not redirect it to `/`.
- Replace the undefined `CLEANPATH` redirect, preserve real files/directories,
  query strings, extensionless legacy links, and existing HTTPS/apex redirects.
- Normalize only legacy `#/…` fragments. Normal `#features` fragments survive
  bookmarks, reloads and new tabs. Relative links resolve like native links.
- Keep all application CSS inline. Minify JS with safe Terser defaults.
- Defer route-module compilation/evaluation with React.lazy and inline module
  sources/import maps. **No external application JS/CSS chunks** are required.
  This defers CPU work, **not download bytes**: all tool/editor code is still
  shipped inside the required single `dist/index.html`.
- Build-render the existing homepage components (not a separate template).
  First-time home visitors can paint before the JS payload arrives, then hydrate.
  Deep links, saved CMS settings, admin sessions and saved cookie consent bypass
  the default homepage render. The build never reads/writes real CMS storage.
- Add a main landmark and keyboard skip link; enlarge the cookie-close hit area;
  adjust only failing small text to adjacent existing slate palette shades.
  No layout, branding, gradients or tool/editor implementations changed.

## Local results

Lighthouse 13.5, Chromium 153, mobile preset, same Vite preview server/sandbox.
These are individual **local lab runs**, not deployed PageSpeed Insights or
field Core Web Vitals measurements. Scores/timings vary between runs.

| Standard Lighthouse simulated throttling | Baseline | Updated |
| --- | ---: | ---: |
| Performance | 92 | 94 |
| Accessibility | 94 | 100 |
| FCP | 2.4 s | 2.5 s |
| LCP | 2.5 s | 2.5 s |
| Total blocking time | 160 ms | 30 ms |
| Estimated unused JS | 209 KiB | 181 KiB |

| Lighthouse applied DevTools throttling | Baseline | Updated |
| --- | ---: | ---: |
| Performance | 89 | 100 |
| FCP | 3.0 s | 0.7 s |
| LCP | 3.0 s | 0.7 s |
| Total blocking time | 0 ms | 60 ms |

Applied throttling captures early HTML painting while the rest of the single
file downloads. The standard simulated run still budgets the entire HTML
response on its critical path. **The requested FCP <1.8 s / LCP <2.5 s targets
are not established in standard simulated Lighthouse or on production.**
The remaining inline payload cannot be network-lazy-loaded while retaining all
154 tools and a self-contained HTML file. No production score is promised.

## Tests

```sh
npm ci
npm run build
npm run typecheck
npx playwright install --with-deps chromium
npm test
```

For an already installed Chromium, set `CHROME_PATH=/path/to/chromium`.

23 Playwright tests pass, including:

- Direct load/reload of pages, tools, PDF UIs, blog, login and competitor analysis.
- Literal-href navigation in a separate tab, category queries, back/forward,
  legacy hashes, ordinary fragments, and noindex not-found handling.
- Smoke-render **all 154 built-in tool URLs**, plus a calculator result change.
  This is not exhaustive testing of every calculation or external API.
- Blog article reload; admin login; typing in the page and blog rich-text editors.
- Saved CMS brand/section settings override defaults after reload.
- Axe homepage accessibility (including below-fold content), with no violations.
- Single-file module-graph integrity; only the entry module is compiled on home;
  tool navigation fetches no external application JS files.

Before/after mobile homepage screenshots (390 × 844, including cookie banner)
are pixel-identical: their PNG SHA-256 hashes match.

`src/tools/`, `src/cms/`, `src/blog/`, and `src/utils/seo.ts` are unchanged.
Existing PDF/other third-party libraries still load on demand as before.

## Hosting deployment and verification

Deploy **both** the HTML and `.htaccess`, not just one. Both tracked deployment
copies are updated in this change. After rebuilding again, synchronize them:

```sh
npm run build
cp dist/index.html public_html/index.html
cp dist/.htaccess public_html/.htaccess
# Upload dist/index.html + dist/.htaccess and the existing public assets.
node scripts/check-hosting.mjs https://YOUR-STAGING-HOST
```

Vite does not execute `.htaccess`. Apache/LiteSpeed must have `mod_rewrite` and
AllowOverride permissions, and should enable `mod_deflate`, `mod_headers` and
`mod_expires`. This sandbox could not install Apache, so the hosting checks
above remain a required staging step; they are not reported as passed locally.

Check a real response with `curl --compressed -I https://YOUR-HOST/about`:
confirm gzip (or host-managed Brotli), HTML revalidation, no redirect to `/`, and
no redirect loop. Purge old cached 301s/CDN HTML after deploying. Run PageSpeed
Insights on `/`, a tool, a blog article and a CMS page after deployment.

The reported 714 ms production TTFB cannot be fixed or measured by inline CSS.
Measure origin-vs-CDN response time; investigate hosting load, redirect chains,
TLS, and edge compression/caching. HTML is revalidated rather than cached
immutably because the filename never changes. Existing images retain caching.

The inline module loader uses import maps (Safari 16.4+, Firefox 108+,
Chrome/Edge 89+), within the existing Tailwind 4 browser baseline. If adding a
Content-Security-Policy later, allow the existing inline bootstrap and `blob:`
module scripts. No `eval`/`unsafe-eval` is used.

## Protected canonical behavior: pre-existing issue

The current SEO helper emits hash-style canonical/OG URLs, for example
`https://seoaudittools.pk/#/about`, despite clean browser routes and clean
structured-data URLs. **It is deliberately unchanged because canonical tags
were marked protected.** Converting those tags to clean URLs needs separate
approval. Tests assert their existing values to guard against accidental changes.
