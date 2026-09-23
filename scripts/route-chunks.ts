import type { Plugin } from 'vite';

/**
 * Fills in the built route-chunk URLs that src/utils/prefetch.ts needs.
 *
 * The background warming deliberately uses `<link rel="prefetch">` — download
 * only, at the browser's lowest priority — rather than `import()`, because an
 * `import()` also *compiles* the module: 370 KB of tool code parsed on the main
 * thread during the load window is exactly the blocking time the code-split
 * build removed (see PERFORMANCE.md). Prefetching fills the HTTP cache instead,
 * so the real `React.lazy` import on navigation is a cache hit and is compiled
 * only at the moment it is actually needed.
 *
 * Chunk file names are content-hashed and only exist once the bundle has been
 * rendered, so the map cannot be written in source. The app carries a
 * placeholder token, and this plugin swaps it for the finished map after
 * minification (`generateBundle`), the same point in the build at which
 * scripts/inline-css.ts inlines the stylesheet.
 */

/** Route key → source module whose chunk is fetched for that route. */
const ROUTE_MODULES: Record<string, string> = {
  tools: 'src/tools/Tools.tsx',
  blog: 'src/blog/Blog.tsx',
  competitor: 'src/tools/CompetitorAnalysis.tsx',
  adminLogin: 'src/cms/AdminLogin.tsx',
  admin: 'src/cms/Admin.tsx',
};

/** The token src/utils/prefetch.ts parses; replaced with the real map. */
export const ROUTE_CHUNK_TOKEN = '__ROUTE_CHUNK_URLS__';

const normalise = (id: string): string => id.replace(/\\/g, '/');

export function routeChunkUrls(): Plugin {
  return {
    name: 'route-chunk-urls',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (item): item is Extract<typeof item, { type: 'chunk' }> => item.type === 'chunk',
      );
      const urls: Record<string, string> = {};
      for (const [key, moduleId] of Object.entries(ROUTE_MODULES)) {
        const suffix = `/${normalise(moduleId)}`;
        const chunk = chunks.find(c => !!c.facadeModuleId && normalise(c.facadeModuleId).endsWith(suffix));
        if (chunk) urls[key] = `/${chunk.fileName}`;
      }
      // The token sits inside a JS string literal, so the JSON's own quotes are
      // escaped; that form is valid inside single- or double-quoted strings.
      const replacement = JSON.stringify(urls).replace(/"/g, '\\"');
      for (const chunk of chunks) {
        if (chunk.code.includes(ROUTE_CHUNK_TOKEN)) {
          chunk.code = chunk.code.split(ROUTE_CHUNK_TOKEN).join(replacement);
        }
      }
    },
  };
}
