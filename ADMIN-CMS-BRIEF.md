# Admin dashboard & settings — build brief

Purpose: an accurate description of what already exists in this codebase, for a
human or another AI agent to work from without rediscovering it. Every claim
below is from the current tree (`arena/01a10c30-seo-audit-tools-website` @
`92d6ff7`). File paths and line numbers are given so you can jump straight to
the source of truth.

---

## 1. What the product is

- **Site:** `seoaudittools.pk` — a free online SEO tool website with a blog, tool
  pages, category landing pages and a content manager (CMS) at `/admin`.
- **Stack:** React 19 + Vite 7 + Tailwind 4, TypeScript. **No backend, no
  database, no build server.** `npm run build` produces **one self-contained
  file** (`vite-plugin-singlefile`), so `dist/index.html` alone is the whole site.
- **Deploy:** upload `public_html/index.html` to the web root (Apache/LiteSpeed
  via `public/.htaccess`: www→apex 301, legacy URL 301s, SPA fallback,
  `text/html` never cached). Nothing is deployed automatically from this repo.
- **Persistence:** the CMS writes to **`localStorage`** in the editor's browser —
  key `seoaudittool:cms:v1`, schema `version: 13`
  (`src/cms/store.tsx:986`, `:517`). Editing the admin on your laptop therefore
  changes *your browser*, not the live site. To ship content, export the JSON
  (`Settings → Backup & deploy`) and drop it in as `src/cms/content.json` —
  that path is documented in the UI; no `content.json` exists in the repo today,
  so the built site currently seeds from the code defaults in
  `src/tools/data.tsx`, the blog articles and `store.tsx`'s `default*` arrays.

## 2. Getting in

| | |
|---|---|
| Routes | `/admin` (the app), `/admin-login`, `/admin-reset?token=…` |
| Guard | `src/App.tsx:1672-1674` — `/admin` without a session redirects to `/admin-login`, and vice versa. The "Admin" nav item only appears when logged in (`:1840`, `:1874`). |
| Credentials | `src/cms/auth.ts`: username defaults to `VITE_ADMIN_USERNAME` or `admin`; password to `VITE_ADMIN_PASSWORD`, else `admin123`. No `.env` in this checkout ⇒ **admin / admin123**. |
| Password storage | SHA-256 hash in `localStorage` (`ekstruh:admin-creds:v1`); change it in `Settings → Password`, min 8 chars. |
| Session | `ekstruh:admin-session:v1`; "remember me" → `localStorage` for 30 days, otherwise `sessionStorage`. |
| Forgot password | Issues a one-time token (`RESET_MINUTES = 60`) held in `sessionStorage` and **prints the reset link on screen** — there is no mail server. Email default `help@seoaudittools.pk` (`VITE_ADMIN_EMAIL`). |
| Honest caveat in the UI | "Because this is a static site, this gate protects the admin UI, not the published files." |

## 3. The nine tabs

`AdminApp` (`src/cms/Admin.tsx:1537`) renders a header card (brand, site name ·
domain, "changes save automatically in this browser", plus a **build stamp** —
`build <sha> · <UTC>` — used to prove which bundle is deployed) and a tab strip
(`:1535`):

1. **Dashboard** (`:131`) — greeting, 4 stat cards (Tools live/hidden/draft,
   Blog posts, Pages, Site sections), *Recent content*, *Content library*,
   *Tool categories* publishing status, *Site readiness* (4 pass/fail checks:
   homepage sections, ≥3 nav links, sidebar configured, SEO coverage),
   *Quick actions*, *Homepage visibility* toggles.
2. **Pages** (`PagesPane :908`) — list with status badges, `+ New page`,
   editor fields: `title`, `slug`, `metaTitle`, `metaDescription`, a
   **rich-text body** (`content`), `status` (live/hidden/draft), featured image,
   plus a full **SEO & meta** section. Legacy `blocks[]` are migrated, not used.
3. **Blog posts** (`BlogPane :826`, `PostEditor :711`, `BlogCategoriesSection :746`)
   — posts with `title/slug/metaTitle/metaDescription/excerpt/content/category/
   date/readTime/author/keywords[]/status/builtin/featuredImage`, and a
   **Blog Categories** manager (`name`, `slug`, `visible`).
4. **Tools** (`ToolsPane :342`, `ToolEditor :309`, `NewToolForm :392`) — search,
   category filter, `+ Add tool`, rows with **Edit / Hide / Delete**, then the
   closing hint. A tool is `{ slug, name, description, category, engine?,
   input, placeholder?, placeholder2?, status, badge?, builtin, featuredImage?,
   about? }`; `about` is an optional rich-HTML override of the category template
   in `src/tools/toolContent.tsx`. Category editing deliberately does **not**
   live here (see §6).
5. **Tool Categories** (`ToolCategoriesPane :436`) — the eleven built-in
   categories plus `custom-…` ones. Per category: `name`, `slug`,
   `description`, **"Content Above Tools"**, **"Content Below Tools — Before
   Footer"** (rich text, rendered on the public category page after the tool
   grid, hidden when empty), and **"SEO & Meta Information"**. This pane is the
   **only** writer of `CmsToolCategory.content`. **No "Add category" button** —
   Edit/Delete on existing rows only (deliberate product decision).
6. **Competitor Analysis** (`CompetitorPane :608`) — every string on the
   `/competitor-analysis` tool page: hero title/subtitle/intro, your-vs-their
   labels, button text, fallback note, about/how-to/benefits/FAQ sections and
   its SEO entry (`state.seo['competitor-analysis']`).
7. **Sidebar** (`SidebarPane :1312`) — *Standard widgets*: search box (+
   placeholder), relevant tools (+ count, title), popular tools (+ title,
   per-tool hide list), latest posts (+ count, title), CTA (title/text/label/
   href). *Custom sections*: ordered widgets of type `links | text | image |
   code`, where `links` pulls from **Tools / Pages / Blog posts / manual**
   (manual = label, href, badge).
8. **Sections & Nav** (`SectionsPane :1127`) —
   *Site visibility*: the 11 homepage section toggles (`hero, auditTool,
   results, features, howItWorks, whyAudit, whoBenefits, freeTools, fromBlog,
   cta, footer`);
   *Navigation menu*: `MenuRowEditor` rows (`label`, `href`, `visible`, and
   `kind: 'tool-categories'` renders the mega menu);
   *Brand & footer*: `name`, `domain`, `tagline`, `footerNote`, footer logo
   (upload or URL, with Remove), `footerMenuTitle`, the four `footerColumns`
   (`FooterColumnEditor`: title + ordered visible links), the
   `footerCopyright` line with `{year}` `{name}` `{domain}` placeholder buttons,
   and the five `social` profile URLs (empty = icon hidden).
9. **Settings** (`SettingsPane :1476`) — see §4.

## 4. Settings tab, in full

| Card | Contents |
|---|---|
| **Header Verification & Ads** | `<textarea>` for AdSense / Search Console / Bing or any `<head>` snippet. On "Save Changes" it is stored *and* applied to the live document immediately via `injectHeadCode`. |
| **Password** | new password field (≥8 chars) + "Update password"; message line confirms. |
| **Editor drafts & browser storage** | `StorageSummary` bar (`estimateLocalStorageBytes()` against `BROWSER_QUOTA_BYTES = 5 MB`, amber at 55%, red at 80% with a "export your JSON and reset" hint), then the list of leftover autosave drafts (key, word count, saved-at) with per-draft **Clear** and a **Clear all drafts** button. |
| **Backup & deploy** | ⬇ **Export JSON** (`cms-content.json` download), **Reset to defaults** (confirm dialog), **Import JSON** (paste + Import, validates and reports). |

The header also surfaces a **`storageWarning`** banner ("Not saved.") whenever a
write fails, with a shortcut to this tab.

## 5. Content editing machinery

- **Rich text editor** (`src/cms/RichTextEditor.tsx`, 1,034 lines): tabbed
  **Visual / HTML** modes with a live preview and fullscreen; toolbar = undo,
  redo, block picker (Paragraph, H1-H6, Quote, Preformatted), bold/italic/
  underline/strike, inline code & code block, bullet + numbered lists,
  align left/centre/right/justify, **link** (Ctrl+K), **media**, text colour and
  highlight (`editor/ColorPicker.tsx`), special characters
  (`editor/SpecialChars.tsx`), clear formatting. Helpers in `src/cms/editor/`
  (`LinkDialog`, `MediaDialog`, `html.ts` for format/escape, `icons.tsx`).
- **Autosave drafts** (`src/cms/drafts.ts`): `saveDraft/readDraft/clearDraft/
  listDrafts/clearAllDrafts`, keyed `draftId(scope, id)` e.g.
  `toolcat-content:<key>`; a draft is removed when the item is saved. `Admin.tsx`
  shows an `AutosaveBadge` while one exists.
- **Media** (`src/cms/media.ts`): accepts png/jpeg/webp/gif/avif/bmp; hard
  reject > **12 MB**, warn > **350 KB**, longest edge capped to **1600 px**,
  canvas re-encode preferring WebP (JPEG/PNG fallbacks); images become
  `data:image/…` URLs or library items (`loadMediaLibrary/addToLibrary/
  removeFromLibrary`, `buildImageHtml`). Linked `<img>` srcs above 100 KB should
  be uploaded instead.
- **Sanitiser** (`src/utils/sanitize.ts`): tag/attribute allowlists
  (`ALLOWED_TAGS`, `ALLOWED_ATTRS`), `sanitizeStyleAttribute`, `sanitizeUrl`
  (only `data:image/*;base64` accepted, SVG data URIs rejected),
  `sanitizeRichHtml`, plus `hasVisibleRichContent()` which is what gates
  optional sections (e.g. the below-tools content block) so an empty editor
  leaves no whitespace on the public page.

## 6. SEO / meta pipeline (`src/utils/seo.ts`)

- **Per-page overrides** live in `state.seo`, keyed by scope: `tool:<slug>`,
  `post:<slug>`, `page:<slug>`, `cat:<categoryKey>` and the bare
  `competitor-analysis`. A `SeoEntry` is `{ title, description, slug?, noindex? }`.
- `resolvePageSeo` picks the entry per route and **falls back to generated
  defaults** (`categorySeoFallbacks`, tool/page/post templates) — so the
  editors use *blank = automatic*, and "save" must not freeze a computed value.
  Saving a value that equals the fallback stores `''`; an all-empty entry calls
  `clearSeo`. `canonicalOverride` (the `slug` field) is honoured, absolute or
  relative.
- `applyPageSeo` writes, on every navigation (`SeoManager`): `document.title`,
  `description`, `robots` (`noindex, nofollow` when flagged, otherwise
  `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`),
  `author`, `canonical`, the full `og:*` set (site name, `en_GB`, type, url,
  title, description, image 1200×630 + alt), `twitter:*`, and a
  `<script type="application/ld+json" id="page-jsonld">` block (stale
  `article-jsonld`/`tool-jsonld`/`tools-jsonld` are removed first).
- Category pages also get the `noindex` **checkbox** (`SeoMetaEditor`'s
  `noindexControl="checkbox"`), while pages/posts/tools keep the button control.
  The category **H1 on the page never changes** — SEO edits are `<head>`-only.

## 7. What consumes the CMS on the public site

`src/App.tsx` (nav, footer, routing, `SeoManager`), `src/tools/Tools.tsx`
(tool grid + category pages + `case 'wm-speed'`-style engine dispatch),
`src/tools/toolContent.tsx` (category content templates),
`src/tools/Sidebar.tsx`, `src/components/ToolCategoriesMenu.tsx` (mega menu),
`src/blog/Blog.tsx`, `src/tools/CompetitorAnalysis.tsx`, `src/utils/seo.ts`.
The tool directory itself (155 entries) is code: `src/tools/data.tsx` (154)
plus the seeded `competitor-analysis` tool — treat that number as correct.

## 8. Tooling that must keep passing

| Command | Checks |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, `noUnusedLocals` on |
| `node scripts/verify-single-file.mjs` | 272 structural checks on `dist/index.html` |
| `node scripts/feature-audit.mjs` | 301 source-level feature checks (the one `fallbackNote` FAIL is pre-existing wording, not a regression) |
| `node scripts/check-tools-tab.mjs <file>` | Tools tab has no category editor; all 11 categories present; admin header carries the build stamp |
| `node scripts/check-speed-tool.mjs <file>` | Page Speed Checker end-to-end on a stubbed network: answers fast, degrades honestly, renders |
| `node scripts/check-hosting.mjs https://<origin>` | run on your machine (needs outbound net) |

Release ritual used in this repo: change `src/` → **commit** (so the build stamp
names a clean sha) → `npm run build` → `cp -r dist/. public_html/` →
`git add -f dist/index.html && git add public_html` → commit → push → quote the
sha256 of `public_html/index.html`. `dist/` is gitignored but its `index.html`
is force-added on purpose, so the artefact and the source commit stay
traceable. The stamp string lives in `vite.config.ts` (`define.__BUILD_ID__`)
and is rendered behind a `typeof` guard so `npm run dev` still works.

## 9. Decisions a next agent must respect

1. "Keep everything else 100% unchanged" — no new dependencies, no redesign, no
   renaming of slugs/URLs/tools, no touching the Tools/Blog/Pages/Settings
   sections beyond what is asked.
2. **No "Add category" button** in Tool Categories; Edit/Delete only.
3. **One editor per field**: category "Content Below Tools" is edited only in
   Tool Categories — it was deliberately deleted from the Tools tab; do not
   restore it.
4. Category SEO is **`<head>` only** — the visible H1 stays the category name.
5. Blank SEO fields stay **automatic**; never persist a copy of the generated
   default.
6. Verify with a command and quote its output; never assert an untested result.
7. The live site only changes when a human uploads `public_html/index.html`.

## 10. Recently built (context for follow-up work)

- **Page Speed Checker** — was crashing the tab (a component rendering itself)
  and waiting on its slowest probe. Now: first-usable-answer racing across the
  CORS relays + text reader, a **proxy-free `no-cors` measurement** so a site
  that blocks fetchers still gets a real grade (with the missing data named),
  progress + Stop, and a full report (`src/utils/pageSpeedReport.ts`): 0-100
  score from nine weighted factors, factor table, ranked fixes, per-origin
  inventory with roles, measured-vs-modelled load sequence, page facts, and a
  markdown "Copy summary" export.
- **Tool Categories** — the "Content Below Tools — Before Footer" rich-text
  section, the SEO & meta panel (title/description/canonical/noindex + Google
  preview), and removal of the duplicated editor from the Tools tab.
- **Ops** — `public_html/` kept in step with `dist/`, and the admin build stamp
  so a stale upload is instantly recognisable.
