import type { Plugin } from 'vite';
import { replaceCss } from 'vite-plugin-singlefile';

/**
 * Inline the render-critical stylesheet into <head> and keep every JavaScript
 * chunk as a real, content-hashed file under /assets/.
 *
 * Why: the previous build embedded ALL route chunks inside index.html, so
 * every visit downloaded the tools, editors, blog and admin code even when
 * the visitor only viewed the homepage (Lighthouse: ~181 KiB unused JS,
 * multi-second FCP/LCP). With plain Vite code splitting:
 *
 *  - index.html ships only the prerendered homepage markup + inline CSS,
 *    so first paint no longer waits for any JavaScript bytes;
 *  - the entry chunk holds the homepage graph only; tools/blog/admin/… are
 *    separate chunks fetched by React.lazy exactly when those routes open;
 *  - hashed /assets/* files are immutable, so repeat visits load no JS at
 *    all from the network (see public/.htaccess).
 *
 * CSS is inlined because it is small, identical for every route and must not
 * cost an extra render-blocking request on first visit.
 */
export function inlineCriticalCss(): Plugin {
  return {
    name: 'inline-critical-css',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const [file, chunk] of Object.entries(bundle)) {
        if (file.endsWith('.css') && chunk.type === 'asset') {
          source = replaceCss(source, file, String(chunk.source));
          delete bundle[file];
        }
      }
      // replaceCss keeps the old <link> attributes on the <style> tag; drop
      // them so the inlined stylesheet stays valid, minimal HTML.
      html.source = source.replace(/<style rel="stylesheet" crossorigin>/g, '<style>');
    },
  };
}
