# Content manager (built-in CMS)

The site ships with a WordPress-style content manager written in React — **no PHP, no database and no
server-side uploads**. Everything is edited in the browser and stored in `localStorage`, which keeps the
deployed app independent of any backend.

## Signing in

| | |
|---|---|
| URL | `https://seoaudittools.pk/admin-login` |
| Username | `admin` |
| Password | `admin123` |

The site uses clean URL routing (`/free-tools`, `/blog/<slug>`, `/about`, …) powered by the History API —
see `src/router.ts`. Old hash links (`/#/about`) are rewritten in the browser on load, and
`public/.htaccess` 301-redirects the old `/p/<slug>` paths to `/<slug>`.

The password can be changed under **Settings → Password** (kept in this browser, hashed with SHA-256).
Override the defaults at build time with `VITE_ADMIN_USERNAME`, `VITE_ADMIN_PASSWORD` and
`VITE_ADMIN_EMAIL` (see `.env.example`).

## The visual editor

Editing surfaces use the same WordPress-style editor:

| Where | Field |
|---|---|
| **Blog posts** | post body — new posts and existing articles |
| **Pages** | the whole page body — one rich-text document per page (pages saved with the old block editor are converted automatically on load) |
| **Tools** | the optional "About" copy that replaces the shared template |
| **Sidebar** | *Text section* widgets (sidebar notes) |

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
(import it back on another device). The build output is a static folder:

```bash
npm run build          # → dist/index.html + dist/assets/*.js (hashed chunks)
```

Copy the **whole `dist/` folder** (index.html, assets/, .htaccess and the rest of `public_html/`) to the
web host — see `public/.htaccess` for the Apache/LiteSpeed rules. The HTML shell loads first; the code
for tools, blog and the CMS is fetched from `assets/` only when those screens are opened, and browsers
cache the hashed chunks long-term. Content entered in one browser is not visible in another unless the
JSON is imported, so export before publishing from a different machine.
