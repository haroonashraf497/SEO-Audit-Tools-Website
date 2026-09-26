# SEO Audit Tools

Free SEO audit platform + 154 browser-side tools, a blog and a built-in content
manager. React 19 + Vite 7 + Tailwind 4, **no backend**: the deployed site is a
single static `index.html`, and all CMS content lives in the visitor's browser
(`localStorage`).

```
┌─ pull ────────────────┐   ┌─ build ───────────────┐   ┌─ upload ──────────────┐
│ git clone / git pull  │ → │ npm install           │ → │ the whole dist/ folder│
│ the branch below      │   │ npm run build         │   │ to public_html        │
└───────────────────────┘   └───────────────────────┘   └───────────────────────┘
```

## Quick start

```bash
git clone https://github.com/haroonashraf497/SEO-Audit-Tools-Website.git
cd SEO-Audit-Tools-Website
git checkout arena/01a0dc97-seo-audit-tools-website   # until the PR is merged

npm install          # required: the repo does not commit every build dependency
npm run build        # → dist/index.html  (the whole site, app + CSS inline)
npm run dev          # optional: local dev server on 0.0.0.0:5173
```

`npm run build` prints `dist/index.html  1,279 kB` and creates **one file** —
inside it are the homepage markup, the stylesheet, all 154 tools, the blog, the
CMS/admin screens and both rich-text editors. There is no `assets/` folder and
nothing is fetched when navigating, so a click swaps the page in the same React
commit (no spinner, no blank frame, no flash).

## Deploy

Upload the **contents of `dist/`** to your web root (`public_html`), replacing
what is there and deleting any old `assets/` folder:

| File | Purpose |
| --- | --- |
| `index.html` | the entire application (1.3 MB, gzip ~358 KB) |
| `.htaccess` | Apache/LiteSpeed: `/tools` → `/free-tools` 301, clean-URL rewrites, security headers, caching |
| `404.html` | fallback used by hosts that serve it for unknown paths |
| `favicon.svg`, `og.jpg`, `robots.txt`, `sitemap.xml` | static files crawlers and browsers request directly |

The same files are mirrored in the repo at `public_html/` (kept in sync by
`npm run build` + copy), so you can also upload straight from a fresh clone
without building. Apache/LiteSpeed needs `mod_rewrite`, `mod_deflate`,
`mod_headers` and `mod_expires` with `AllowOverride`.

```bash
node scripts/check-hosting.mjs https://your-domain   # verifies a live deploy
curl -I https://your-domain/tools                    # → 301 /free-tools
```

## Content manager

`https://your-domain/admin-login` — default **admin / admin123** (change it under
Settings → Password; override the defaults at build time with the variables in
`.env.example`).

| Area | What it controls |
| --- | --- |
| **Settings → Header Verification & Ads** | paste AdSense / Search Console / analytics code → purple **Save Changes** → stored, injected into the live `<head>`, flashes **Saved ✓** (script tags are rebuilt so they execute) |
| **Sections & Nav → Navigation menu** | header links: `+ Add`, `Remove`, `Visible`/`Hidden`, Save |
| **Sections & Nav → Brand & footer** | site name, domain, tagline, footer note, footer copyright (`{year}` `{name}` `{domain}`), footer logo (URL or upload), footer menu links (the footer's first column), Facebook / X / LinkedIn / Instagram / YouTube URLs |
| **Pages, Blog posts, Tools, Sidebar** | page bodies, articles, tool “About” copy and sidebar widgets, edited in the WordPress-style rich-text editor |

The footer itself is fixed: **Quick Links** (the CMS-editable menu above), **SEO Tools**,
**Resources**, **Company** as four equal columns, plus a separate **Legal** column
(Privacy Policy, Cookie Policy, Terms & Conditions) that also holds the cookie-preferences
button. The bottom bar shows the editable copyright line on the left and, on the right, the
short legal links plus the cookie-preferences control —
`Privacy · Cookie · Terms · Cookie preferences` — each short link keeping its full name as
the tooltip / accessible name. Legal pages answer on `/privacy`, `/cookies` and `/terms`; the old
`/privacy-policy`, `/cookie-policy` and `/terms-of-service` URLs are 301-redirected and are
also upgraded client-side for the dev/preview server, which does no rewriting.

Every panel saves to `localStorage` (so it survives a refresh) and updates the
public site immediately. Content is per-browser: use **Settings → Export JSON**
to move or version it. See `CMS.md` for the full CMS reference.

## Verification

```bash
npm run typecheck                  # tsc --noEmit
node scripts/feature-audit.mjs     # 78 checks: every CMS control, footer redesign, legal URLs, /free-tools, no EKSTRUH, 154 tools
npm install --no-save jsdom
node scripts/verify-single-file.mjs  # 71 checks: boots the built file, instant swap, footer, legal URLs, head injection
npm test                           # 34 Playwright tests (needs Chromium)
```

`feature-audit.mjs` is static (reads `src/` + `dist/`); `verify-single-file.mjs`
boots `dist/index.html` in jsdom, so run `npm run build` first.

## Project map

```
index.html                  HTML shell (metadata, JSON-LD, favicon, OG tags)
vite.config.ts              single-file build config (vite-plugin-singlefile)
src/App.tsx                 shell: header, routes, homepage, footer, cookie banner
src/router.ts               History-API router, legacy URL rewrites, navigation kind
src/cms/store.tsx           CMS state, defaults, migrations, <head> injection
src/cms/Admin.tsx           admin panels (dashboard, pages, blog, tools, sidebar, sections & nav, settings)
src/tools/                  154 tool UIs + engines (data.tsx is the tool registry)
src/blog/                   blog list/article views + article data
src/utils/seo.ts            per-route titles, canonicals, OG/Twitter, JSON-LD
src/index.css               Tailwind entry + `.content-shell` footer rule
scripts/prerender.mjs       renders the homepage into dist/index.html + hydration gate
public/.htaccess            deployed Apache/LiteSpeed rules
public_html/                tracked copy of the deployable output
```

## Notes

- **Instant navigation:** routes are static imports, so everything renders
  synchronously — no `React.lazy`, no `<Suspense>`, no loading state anywhere in
  the build. `<main class="content-shell">` is `calc(100vh - 4rem)` tall so the
  footer never rides up under the header, and route changes reset the scroll in a
  layout effect (back/forward keeps the restored position).
- **PDF tools** load their libraries (pdf-lib, pdf.js) from a CDN on first use —
  the page itself renders immediately; the in-tool progress bar reports the
  library download.
- **Analytics/ads** are only injected if you paste code in Settings; nothing
  third-party loads by default beyond the tool CDNs and the RDAP/IP lookup APIs.
- Performance and hosting details: `PERFORMANCE.md`.
