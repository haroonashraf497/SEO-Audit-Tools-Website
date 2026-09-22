import path from 'node:path';
import type { Plugin } from 'vite';
import { replaceCss } from 'vite-plugin-singlefile';

/**
 * A single HTML file with genuinely deferred module compilation/evaluation.
 * Rollup's inlineDynamicImports eagerly executes every route, even React.lazy
 * routes. Keep its normal split graph instead, embed the sources as inert JSON,
 * then map the graph to same-document Blob URLs before importing the entry.
 *
 * No eval, external chunks, service worker, runtime fetches or duplicate React.
 * Transfer bytes are still all in one HTML file; only execution is lazy.
 * Requires import maps (Chrome/Edge 89+, Firefox 108+, Safari 16.4+).
 */
export function inlineModules(): Plugin {
  return {
    name: 'inline-deferred-modules',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') this.error('Missing index.html');
      let source = String(html.source);
      const modules: Record<string, string> = {};
      let entry = '';
      const chunkFiles = new Set(Object.values(bundle).filter(c => c.type === 'chunk').map(c => c.fileName));
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          if (chunk.isEntry) entry = `@app/${file}`;
          // Generated internal imports have quoted relative file names. Use a
          // stable bare specifier so even cyclic graphs resolve through the map.
          const deps = new Set([...chunk.imports, ...chunk.dynamicImports]);
          modules[`@app/${file}`] = chunk.code.replace(/"?__VITE_PRELOAD__"?/g, "void 0").replace(
            /(["'])(\.\.?\/[^"']+\.js)\1/g,
            (match, quote: string, relative: string) => {
              const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), relative));
              return deps.has(resolved) && chunkFiles.has(resolved)
                ? `${quote}@app/${resolved}${quote}` : match;
            },
          );
          delete bundle[file];
        } else if (file.endsWith('.css')) {
          source = replaceCss(source, file, String(chunk.source));
          delete bundle[file];
        }
      }
      if (!entry) this.error('Missing application entry');
      source = source.replace(/<script\b[^>]*\btype="module"[^>]*\bsrc="[^"]+"[^>]*><\/script>/g, '');
      const json = JSON.stringify(modules).replace(/</g, '\\u003c');
      // Keep CSS in <head> and put code after the body, so the HTML parser sees
      // styles/content before scanning the application's large source payload.
      const bootstrap = `<script type="application/json" id="app-modules">${json}</script>
<script>
(() => {
  const node = document.getElementById('app-modules');
  const sources = JSON.parse(node.textContent);
  const imports = {};
  for (const [name, code] of Object.entries(sources)) {
    imports[name] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  node.remove();
  const map = document.createElement('script');
  map.type = 'importmap';
  map.textContent = JSON.stringify({ imports });
  document.head.appendChild(map);
})();
</script>
<script type="module">import ${JSON.stringify(entry)};</script>`;
      html.source = source.replace('</body>', () => `${bootstrap}\n</body>`).replace(/^[ \t]+$/gm, '');
    },
  };
}
