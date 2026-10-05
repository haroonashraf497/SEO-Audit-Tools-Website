# Content manager (built-in CMS)

The site ships with a WordPress-style content manager written in React — **no PHP, no database and no
server-side uploads**. Everything is edited in the browser and stored in `localStorage`, which keeps the
deployed app independent of any backend.

Site structure lives under **Admin → Sections & Nav**: the header *Navigation menu*, the whole
*Brand & footer* card (site name, domain, tagline, footer note, footer copyright, footer logo, footer
menu links and the five social profiles) and the homepage section toggles. **Admin → Settings** holds the
header verification/ads snippet, the password, drafts and export/import. Each panel has a purple
**Save Changes** button that flashes *Saved ✓* for 2.5 seconds, and everything it saves stays in the
browser, so it survives a refresh.

## Signing in

| | |
|---|---|
| URL | `https://seoaudittools.pk/admin-login` |
| Username | `admin` |
| Password | `admin123` |

The site uses clean URL routing (`/free-seo-tools`, `/ip-tools`, `/plagiarism-checker`, `/blog/<slug>`, `/about`, …) powered by the History API —
the tools index answers on `/free-seo-tools`, each category on its own top-level page (`/ip-tools`, `/website-checker-tools`, …) and each tool on its
bare slug (`/plagiarism-checker`). `/tools`, `/tool`, `/free-tools` and `/free-seo-tool` all 301 to the index, a legacy
`?cat=ip` filter 301s to `/ip-tools`, and every nested tool spelling (`/free-seo-tools/<slug>`, `/tool/<slug>`, …) 301s to `/<slug>`.
Link fields saved with an older spelling are upgraded to the new hierarchy when the CMS loads them.
see `src/router.ts`. Old hash links (`/#/about`) are rewritten in the browser on load, and
`public/.htaccess` 301-redirects the old `/p/<slug>` paths to `/<slug>`.

The password can be changed under **Settings → Password** (kept in this browser, hashed with SHA-256).
Override the defaults at build time with `VITE_ADMIN_USERNAME`, `VITE_ADMIN_PASSWORD` and
`VITE_ADMIN_EMAIL` (see `.env.example`).

## The visual editor

Editing surfaces use the same WordPress-style editor:

| Where | Field |
|---|---|
| **Sections & Nav → Brand & footer** | site name, domain, tagline, footer note, footer copyright (`{year}` `{name}` `{domain}`), footer logo URL or upload, the **four footer columns** (each with its own Section title, link rows — label + URL + Visible/Hidden + Remove — its own + Add and its own Save Changes), Facebook/X/LinkedIn/Instagram/YouTube URLs |
| **Sections & Nav → Navigation menu** | every link the header shows, in order: **Home**, **Free SEO Tools**, **Tool Categories**, **Competitor Analysis** by default. Rename, re-URL, hide, remove, `+ Add` and Save Changes; the header and burger menu follow instantly, and a menu saved before an entry existed gets it added back automatically. The *Tool Categories* row renders the mega menu (all eleven categories with live counts, each linking to its own page, e.g. `/website-checker-tools`; the panel itself carries no repeated heading), so that row shows a *Mega menu → all category pages* note instead of a URL field, and its label is the one the nav shows. Top-nav labels are never bold — hover and the selected page only change the text colour |
| **Blog posts** | post body — new posts and existing articles |
| **Pages** | the whole page body — one rich-text document per page (pages saved with the old block editor are converted automatically on load) |
| **Blog posts → Blog Categories** | the blog category list: name, clean slug (auto from the name, editable), live post count and Visible/Edit/Remove per row. Removing a category moves its posts to *Uncategorized*; renaming one relabels them. The same list fills the **Assign Category** dropdown in the post editor, which can add a category inline |
| **Competitor Analysis** | the `/competitor-analysis` page copy: hero title, subtitle and intro; the two input labels, the compare button and the fallback note; the About and How-to-read sections (full rich-text editors); the Benefits and the FAQs, each written in a single rich-text editor — a Heading 3 starts a benefit card or a FAQ question and the content under it becomes that card's text or that question's collapsible answer, so there are no per-item fields; and the page meta title, description, canonical and noindex. Save Changes confirms with *Saved ✓* and the live page updates instantly — the tool, the URL and the layout stay exactly as they are |
| **Tool Categories** | the tool category list: name, clean slug (auto from the name, editable), the description shown under the heading on `/free-seo-tools` and on the category page, plus the live tool count and Edit/Delete per row. Deleting a category moves its tools to the nearest remaining one. The same list fills the tool editor's **Category** dropdown, the directory sections, the home-page category cards and the mega menu (with live counts). Built-in categories keep their original top-level page (`/ip-tools`, …); every category also answers on `/tools/category/<slug>` |
| **Tools** | the optional "About" copy that replaces the shared template; tool names, descriptions, categories and visibility drive both the /free-seo-tools grid and the top-nav **Tool Categories** menu (counts included). Card taglines are built-in copy (`toolTaglines` in `src/tools/data.tsx`) — CMS tools without a tagline fall back to their own description — while the category names, slugs and introduction paragraphs come from the managed list in **Admin → Tool Categories** (seeded from `categoryLabels` / `categorySlugs` / `categoryIntros`) |
| **Sidebar** | the search box, Other Relevant Tools / Popular SEO Tools / Latest Articles panels and *Text section* widgets (sidebar notes). On a single blog post the panels read search bar → Latest Articles → Other Relevant Tools |

Short fields stay **plain text** on purpose — SEO titles, meta descriptions, excerpts, card descriptions,
keywords, alt text, badges, link labels and CTA fields. The editor shows a "Plain text" hint on those fields.

### Toolbar

- **Visual / Code** tabs — the Code tab shows the raw HTML for the current item. Anything pasted there is
  cleaned (`Clean up`, or automatically when you switch back to Visual).
- **Undo / redo**, block dropdown (**Paragraph, Heading 1–6, Quote, Preformatted**), bold, italic,
  underline, strikethrough, inline code.
- Bulleted and numbered lists, quotes, left/centre/right/justify alignment.
- **Links** — `Ctrl`/`⌘` + `K`, with anchor text, "open in new tab" and `rel="nofollow"`.
- **Add Media** — upload (drag-and-drop or file picker), *From URL*, and a browser media library.
  Uploads are downscaled to 1600 px, re-encoded to WebP/JPEG and embedded as `data:image/…` URLs.
  Images can also be dropped straight onto the editor, where a small toolbar sets alignment, display
  width, alt text and an optional link.
- **Text and highlight colour**, **special characters** (Ω), clear formatting, horizontal rule.
- **Preview** shows the sanitised public output; **Fullscreen** gives the editor the whole viewport
  (`Esc` exits).
- Shortcuts: `Ctrl/⌘+B/I/U`, `Ctrl/⌘+K`, `Alt+Shift+1–6` for headings, `Alt+Shift+0` for a paragraph,
  `Tab`/`Shift+Tab` to indent list items.

### Auto-saved drafts

Every editing session is autosaved to the browser (debounced) and the status bar shows
"✓ Draft saved hh:mm:ss". If a tab is closed mid-edit, the next visit offers **Restore draft** or
**Discard**. Drafts are cleared when the item is saved, and leftovers can be cleared from
**Settings → Editor drafts & browser storage**, which also shows how much of the ~5 MB browser quota is
in use.

## Safety

Public pages never render stored HTML directly — `src/utils/sanitize.ts` runs every string through an
allowlist sanitiser first:

- only formatting tags survive; `<script>`, `<style>`, `<iframe>`, `<form>`, `<svg>`, media and other
  active content are dropped,
- `on*` event handlers, `javascript:`/`vbscript:` URLs and CSS injection (`url()`, `expression()`,
  `position:`) are removed,
- `style` attributes are limited to the properties the editor can produce (colour, highlight, alignment,
  width/margins),
- `data:image/png|jpeg|webp|gif|avif|bmp` uploads are allowed; `data:text/html` and
  `data:image/svg+xml` are rejected,
- `target="_blank"` links always get `rel="noopener noreferrer"`.

## Publishing

Because content lives in the browser, use **Settings → Export JSON** to version or move content
(import it back on another device). The build output is a **single file**:

```bash
npm run build          # → dist/index.html (app + CSS + JS inline) + the public files
npm run pack           # → public_html/ mirror + public_html-upload.zip
```

Copy the **whole `dist/` folder** to the web host — eight files: `index.html`, `.htaccess`,
`404.html`, `cms-content.json`, `favicon.svg`, `og.jpg`, `robots.txt` and `sitemap.xml`. There is no `assets/` directory — every route,
tool, editor and admin screen is inside the document, so navigating fetches nothing extra and no screen
shows a loading placeholder — route switches are synchronous, so a click swaps the page in the same frame. `public/.htaccess` handles the legacy index spellings → `/free-seo-tools`, the old nested tool URLs → `/<slug>`, `?cat=` → the category page and `/p/…`
301s, security headers and caching. Content entered in one browser is not visible in another unless the
JSON is imported, so export before publishing from a different machine.

## The shipped content snapshot — `public/cms-content.json`

`public/cms-content.json` is the CMS content the site ships with, written out as JSON and committed.
It sits in `public/`, so Vite copies it into `dist/` on every build and the deployed `public_html`
carries it too:

- **what it is** — the exact JSON that Admin → Settings → **Export JSON** would download from a fresh
  install: version, settings, nav, the four footer columns, sidebar, blog/tool categories, SEO entries,
  tools, posts and the six pages with their bodies as `content` HTML;
- **what it is for** — a versioned record of the copy the site says, and a restore point. On any
  deployment, Admin → Settings → **Import JSON** with this file puts the shipped content straight back,
  which is how you move a site between machines or recover a browser whose `localStorage` was cleared;
- **what it is not** — the site never fetches it. The content is compiled into `index.html`; this file
  is the snapshot an admin imports, not a runtime data source.

Regenerate it after changing any seeded content:

```bash
npm run build                     # the script reads the built dist/index.html
npm i --no-save jsdom             # only needed for this script
npm run cms:export                # → public/cms-content.json
```

`scripts/export-cms.mjs` runs the real bundle in jsdom rather than re-implementing the store: it boots
the built document with an empty `localStorage`, then boots it again with that snapshot preloaded so
`load()` resolves the seeded page `blocks` into `content` HTML, writes the result, and finally boots a
third time from the finished file to prove it imports and renders `/about`. A snapshot taken before
that second pass would carry six pages with an empty `content` and import as blank pages.

## Header verification & ads

**Admin → Settings → Header Verification & Ads** takes raw HTML — Google Search Console or Bing
verification meta tags, AdSense and analytics snippets. The purple **Save Changes** button stores the
snippet in `localStorage`, injects it into the live `<head>` immediately and flashes *Saved ✓*. The
snippet is re-injected on every later visit, and any `<script>` inside it is rebuilt with
`document.createElement` before insertion so it actually executes (markup cloned with `innerHTML`
would never run).
