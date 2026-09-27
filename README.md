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
| `.htaccess` | Apache/LiteSpeed: legacy index/tool/category 301s, clean-URL rewrites, security headers, caching |
| `404.html` | fallback used by hosts that serve it for unknown paths |
| `favicon.svg`, `og.jpg`, `robots.txt`, `sitemap.xml` | static files crawlers and browsers request directly |

The same files are mirrored in the repo at `public_html/` (kept in sync by
`npm run build` + copy), so you can also upload straight from a fresh clone
without building. Apache/LiteSpeed needs `mod_rewrite`, `mod_deflate`,
`mod_headers` and `mod_expires` with `AllowOverride`.

```bash
node scripts/check-hosting.mjs https://your-domain   # verifies a live deploy
curl -I https://your-domain/tools                    # → 301 /free-seo-tools (index)
curl -I https://your-domain/ip-tools                 # → 200  (category page)
curl -I https://your-domain/tool/merge-pdf           # → 301 /merge-pdf
curl -I "https://your-domain/free-seo-tools?cat=ip"  # → 301 /ip-tools
```

## Content manager

`https://your-domain/admin-login` — default **admin / admin123** (change it under
Settings → Password; override the defaults at build time with the variables in
`.env.example`).

| Area | What it controls |
| --- | --- |
| **Settings → Header Verification & Ads** | paste AdSense / Search Console / analytics code → purple **Save Changes** → stored, injected into the live `<head>`, flashes **Saved ✓** (script tags are rebuilt so they execute) |
| **Sections & Nav → Navigation menu** | header links: `+ Add`, `Remove`, `Visible`/`Hidden`, Save |
| **Sections & Nav → Brand & footer** | site name, domain, tagline, footer note, footer copyright (`{year}` `{name}` `{domain}`), footer logo (URL or upload), **all four footer columns** (each with its own Section title, unlimited label+URL rows, Visible/Hidden, Remove, + Add and its own Save Changes), Facebook / X / LinkedIn / Instagram / YouTube URLs |
| **Pages, Blog posts, Tools, Sidebar** | page bodies, articles, tool “About” copy and sidebar widgets, edited in the WordPress-style rich-text editor |

The footer is four equal columns — **Quick Links**, **SEO Tools**, **Resources**,
**Company** — and every one of them is editable: `state.footerColumns` holds four
`{ id, title, links[] }` objects, each rendered from the CMS and each saveable on its own.
Old saved state that kept column 1 in `settings.footerMenuTitle` / `settings.footerLinks`
is migrated into `footerColumns[0]` on load, and a column with no links still renders its
heading so the grid never collapses. There is no separate Legal column — the legal links
live in the bottom bar, which shows the editable copyright line on the left and
`Privacy · Cookie · Terms · Cookie preferences` on the right. Each short link keeps its full
name (Privacy Policy / Cookie Policy / Terms & Conditions) as the tooltip and accessible
name, and the Cookie preferences control there is the footer's only one. Legal pages answer on `/privacy`, `/cookies` and `/terms`; the old
`/privacy-policy`, `/cookie-policy` and `/terms-of-service` URLs are 301-redirected and are
also upgraded client-side for the dev/preview server, which does no rewriting.

### Merge PDF — optional compression of the result

After a merge, the result card offers a **“Compress more”** step next to the file size:

- four levels — **Lossless** (structure only, text stays selectable), **Balanced**, **Strong**,
  **Extreme** (pages re-rendered as images, biggest savings) — or an exact **target size in KB**
  with quick chips (50/100/200/300/500);
- it reuses the same `compressToTarget()` engine as the Compress PDF tool (lossless pass first,
  then a DPI/quality ladder);
- the block shows the saving before anything is downloaded (“128.4 KB · down from 341.6 KB (−62%)”),
  then **✓ Use compressed file** swaps the result — the Download button, file name
  (`merged-compressed.pdf`), title and size stats follow — and **Use the uncompressed merge instead**
  restores the original. Compressing again compounds on the current file;
- if no smaller legible version can be produced, the result says so instead of handing you a bigger file.
- **pdf.js buffer handling:** pdf.js *transfers* the buffer it is given to its worker thread, which
  detaches it. Every call to `renderPages()` / `extractText()` therefore hands pdf.js a private copy
  (`copyBuffer()`), so a document can be rendered repeatedly — the compression ladder rendered the
  same file up to nine times, which previously failed with “Cannot perform Construct on a detached
  ArrayBuffer”. Individual ladder passes are also wrapped so one failed pass degrades to the next
  lighter one instead of aborting the run.

### URL hierarchy

**Nothing nests under `/free-seo-tools` any more.** Tool pages and category pages are top level,
so the shortest, cleanest possible URL carries each page:

| Page | Canonical URL | Example |
| --- | --- | --- |
| Tools index (all 155 tools) | `/free-seo-tools` | https://seoaudittools.pk/free-seo-tools |
| Category page | `/<category>-tools` | https://seoaudittools.pk/ip-tools |
| Tool page | `/<tool-slug>` | https://seoaudittools.pk/plagiarism-checker |

Every category has its own page, derived from its name in lower case
(`categorySlugs` in `src/tools/data.tsx`):

| Category | URL | Category | URL |
| --- | --- | --- | --- |
| Text Analysis Tools (11) | `/text-analysis-tools` | IP Tools (6) | `/ip-tools` |
| Keyword Tools (8) | `/keyword-tools` | PDF Tools (18) | `/pdf-tools` |
| Backlink Tools (8) | `/backlink-tools` | Image Tools (3) | `/image-tools` |
| Website Management Tools (45) | `/website-management-tools` | Calculator Tools (14) | `/calculator-tools` |
| Website Checker Tools (24) | `/website-checker-tools` | Unit Converter Tools (10) | `/unit-converter-tools` |
| Domain Tools (8) | `/domain-tools` | | |

Each category page has its own `<h1>`, intro, canonical URL, `CollectionPage` + `ItemList` +
`BreadcrumbList` JSON-LD and tool list; the search box filters inside that category and the
**Show all N tools** link returns to the index.

Everything older 301s onto these URLs (query strings and slugs are kept):

| Old URL | Result |
| --- | --- |
| `/tools`, `/tools/`, `/tool`, `/free-tools`, `/free-seo-tool` | 301 → `/free-seo-tools` (index) |
| `/free-seo-tools?cat=ip` | 301 → `/ip-tools` |
| `/free-seo-tools?cat=checker&q=ssl` | `/website-checker-tools?q=ssl` (client, so `?q=` survives) |
| `/free-seo-tools/<slug>` | 301 → `/<slug>` |
| `/tool/<slug>`, `/free-tools/<slug>`, `/free-seo-tool/<slug>` | 301 → `/<slug>` |

The redirects live in three places so no link ever breaks: `public/.htaccess` (server, `[R=301,L]`),
`src/router.ts` (`TOOLS_PATH` + `LEGACY_TOOL_PATHS` + `canonicalCategoryQuery`, rewritten with
`replaceState` before the first paint) and `src/utils/seo.ts` / `src/cms/store.tsx` (canonical
builder + stored CMS hrefs upgraded on load, so content saved against an old URL keeps working).

### Free SEO Tools page (/free-seo-tools)

- the page opens with the **same gradient band as the home hero**
  (`bg-gradient-to-br from-indigo-100 via-violet-50 to-purple-100`), holding the title,
  the description and the search box; the tool grid then continues on the page background;
- the **category filter chips are gone** — categories now live only in the top-nav mega menu, so
  the page shows one section per category (heading + count) with all its tool cards;
- the cards run **four-up on desktop** (two-up on tablets, one-up on phones), each with its tool
  name at **1rem** and a **two-line description** — every card carries a hand-written tagline
  (`toolTaglines` in `src/tools/data.tsx`, 60–108 characters) clamped to exactly two lines with a
  reserved two-line height, so the grid stays perfectly even. The longer, keyword-rich
  `description` is untouched and still serves the meta description and the tool-page intro;
- each **category heading is a link** to that category's own page (`/ip-tools`,
  `/website-checker-tools`, …) and is set at **1.35rem**; on a category page the heading is plain
  text, so it never links to itself;
- under every heading sits a **category introduction** (`categoryIntros` in `src/tools/data.tsx`) —
  a 230–300 character, category-specific paragraph naming the tools in that group and who they help.
  It appears identically on the index and on the category page itself, so the copy search engines
  read on `/ip-tools` is the same SEO copy visitors see. The one-line `categoryDescriptions` stay
  for the home-page cards and meta descriptions;
- a legacy filtered URL (e.g. `/free-seo-tools?cat=pdf`) 301s to its category page, `?q=` still
  searches the index, and the status line carries a **Show all N tools** link that clears it;
- search, grouping, "Instant" badges and the empty state are unchanged.

### Tool Categories mega menu

The top navigation carries a fixed **Tool Categories** item (next to *Free SEO Tools*, before
*Competitor Analysis*) that opens a mega panel listing every category on the Free SEO Tools page:

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
| Text Analysis Tools (11) | Website Management Tools (45) | IP Tools (6) |
| Keyword Tools (8) | Website Checker Tools (24) | PDF Tools (18) |
| Backlink Tools (8) | Domain Tools (8) | Image Tools (3) |
| Calculator Tools (14) | Unit Converter Tools (10) | |

- each entry links straight to its own page (`/ip-tools`, `/website-checker-tools`, …);
- the counts are computed from the live CMS tool list, so they always match the tools page;
- the panel opens on hover and on click, and closes on Escape, outside click, navigation or the
  chevron; it is a `fixed` panel pinned under the 4 rem nav bar, so it can never overflow the
  viewport at any width;
- the panel has **no heading of its own** — the nav item's own "Tool Categories" label is the
  title, so the wording is not repeated inside;
- **no top-nav text is ever bold**: neither on hover nor for the selected page — the current page
  is marked by indigo text only, so the bar never shifts weight as you move across it;
- phones get the same categories as a collapsible section inside the burger menu;
- like *Home* and *Competitor Analysis*, this item is part of the app shell (not CMS-managed),
  so the editable Navigation Menu keeps working exactly as before.

### Text Analysis Tools layout

Tool pages in the **Text Analysis Tools** category (`category: 'text'`) render differently from
every other category:

- the tool panel spans the **full content width** (header, optional featured image, then the panel);
- underneath it, a two-column grid puts the **About / Use cases / Why / FAQ / Related tools**
  column on the left and the **sidebar** (search, Other Relevant Tools, Popular SEO Tools,
  Latest Articles, CTA) on the right, so the sidebar starts level with the About section;
- every other category keeps the classic layout, where the sidebar sits beside the panel.

All eleven text tools are mobile-first: single column, full-width controls, `min-h`/padding
staircases from phone to desktop, horizontally scrollable tab strips and long-token wrapping,
so nothing overflows a 320-390 px viewport.

The **Case Converter** results (UPPERCASE, lowercase, Title Case, Sentence case, aLtErNaTiNg,
Capitalize Each Word, Hyphen-case, snake_case) render as a two-up grid of dark cards from the
`sm` breakpoint (single column on phones), so all eight conversions stay visible at a glance.

Every panel saves to `localStorage` (so it survives a refresh) and updates the
public site immediately. Content is per-browser: use **Settings → Export JSON**
to move or version it. See `CMS.md` for the full CMS reference.

### Blog categories

Categories are managed in **Admin → Blog posts → Blog Categories** (a section sitting directly
above the post list, next to *+ Write post*):

- **Category Name** + **Category Slug** (auto-generated from the name, editable) and an
  **Add category** button that confirms with *Saved ✓*;
- every row shows **Name**, **/blog/category/<slug>**, its **live post count** and its own
  **Visible/Hide**, **Edit** (rename + re-slug) and **Remove** actions;
- removing a category never deletes a post — its posts move to **Uncategorized**; renaming one
  relabels its posts, so nothing is orphaned;
- categories save to the CMS store and appear immediately in the **Assign Category** dropdown in
  the post editor and the new-post form, which can add a category inline ("+ New category") and
  assign it without leaving the editor.

On the public site, `/blog` carries a **Blog Categories** section (one card per visible category
with its article count) and every category answers on its own clean URL:
`/blog/category/<slug>` — e.g. https://seoaudittools.pk/blog/category/core-web-vitals. Those pages
have their own H1, intro, canonical tag, `CollectionPage` + `ItemList` + `BreadcrumbList` JSON-LD and
article list; the blog filter tabs are driven by the same category list, and the sitemap lists the
four built-in category URLs.

### Tool categories

The tool categories are a managed list: **Admin → Tool Categories**, the tab directly next to
*Tools*.

- **Category Name**, **Category Slug** (auto-generated from the name, editable) and
  **Category Description** — the paragraph shown under the heading on `/free-seo-tools` and on
  the category's own page (it is also the category meta description). **Add category** confirms
  with *Saved ✓*.
- Every row shows the category name, its public URL, its live **tool count** and its own
  **Edit** (name, slug, description) and **Delete**. Deleting a category never deletes tools:
  they move to the nearest remaining category so nothing disappears from the site.
- The eleven built-in categories keep their original page — `/ip-tools`,
  `/website-checker-tools`, … — and are marked *Built-in*. Every category also answers on
  `/tools/category/<slug>`, which is the canonical URL for the categories added in the admin.
- The tool editor's **Category** dropdown, the tools-list filter, the *Tool Categories* mega
  menu (with live counts), the home-page category cards and the directory sections all read from
  this list, so an edit is live everywhere at once. A tool can never fall out of the directory:
  a category that exists only on a tool still gets its own section.

### Competitor Analysis page

The `/competitor-analysis` page is edited in **Admin → Competitor Analysis**, the tab right after
*Tool Categories*:

- **Page header & intro** — hero title, subtitle and the intro paragraph;
- **Tool input area** — the two field labels, the compare button text and the fallback note;
- **Sections** — *What is Website Competitor Analysis?* and *How to read the comparison report*
  each have a full WYSIWYG editor, and *Benefits* and *FAQs* have **one editor each for the whole
  section**. Inside those two editors a *Heading 3* starts a card — a benefit card or a FAQ
  question — and the text underneath it becomes that card's paragraph or that question's
  collapsible answer, so a whole section is written in one place with no per-item fields;
- **SEO** — meta title, meta description, canonical override and the noindex switch for the URL;
- **Save Changes** shows the standard *Saved ✓* and `/competitor-analysis` updates instantly, with
  no reload. *Reset fields to default copy* restores the shipped wording.

The comparison engine, scoring, layout and URL are untouched — the tool only reads its copy from
the store.

## Verification

```bash
npm run typecheck                  # tsc --noEmit
node scripts/feature-audit.mjs     # 238 checks: CMS controls, blog categories, managed tool categories, the Competitor Analysis page copy, footer redesign, legal URLs, /free-seo-tools index, text-tool layout/mobile, case-converter grid, Tool Categories mega menu, no-bold top nav, top-level tool URLs (/<slug>), category pages (/ip-tools), Merge PDF compressor, no EKSTRUH, 154 tools
npm install --no-save jsdom
node scripts/verify-single-file.mjs  # 211 checks: boots the built file, blog + tool category pages, the Competitor Analysis page, instant swap, footer, legal + category URLs, top-level tool pages, legacy redirects, head injection, text-tool layout, mega-menu navigation
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
