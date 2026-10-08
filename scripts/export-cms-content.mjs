/**
 * Write public_html/cms-content.json — the site's default CMS content in the
 * same shape the admin's Export button downloads (Admin.tsx: exportJson).
 *
 * This is the CMS *default* state, not a live snapshot: the CMS saves content
 * per browser in localStorage, so this file is the reference/backup copy that
 * ships with the upload. Re-importing it from the admin (Import) restores the
 * shipped defaults if a browser's saved CMS is lost or damaged.
 *
 * Runs as part of `npm run build` so the deploy folder is complete.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Same empty browser environment the prerender uses: nothing reads a real
// browser's localStorage, so the store hands back its built-in defaults.
globalThis.window = { location: new URL('https://seoaudittools.pk/') };
globalThis.localStorage = globalThis.sessionStorage = { getItem: () => null };

const server = await createServer({
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { defaultState } = await server.ssrLoadModule('/src/cms/store.tsx');
  if (!defaultState?.tools || !defaultState?.posts) {
    throw new Error('export-cms-content: the store did not expose a usable defaultState');
  }
  // Identical to exportJson: page block markup is derived at render time and
  // is not part of the stored content.
  const payload = JSON.stringify(
    {
      ...defaultState,
      pages: defaultState.pages.map(pg => {
        const { blocks: _blocks, ...rest } = pg;
        return rest;
      }),
    },
    null,
    2,
  );
  const dir = new URL('../public_html/', import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('cms-content.json', dir), `${payload}\n`);
  const tools = defaultState.tools.length;
  const posts = defaultState.posts.length;
  const pages = defaultState.pages.length;
  console.log(`export-cms-content: public_html/cms-content.json written (${tools} tools, ${posts} posts, ${pages} pages)`);
} finally {
  await server.close();
}
