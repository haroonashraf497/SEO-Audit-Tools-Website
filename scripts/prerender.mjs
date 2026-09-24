import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import { renderToString } from 'react-dom/server';

// Build-only, empty browser environment. Never reads, writes or exports the
// user's CMS. Render the actual homepage components, not a second design.
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
  const { default: App } = await server.ssrLoadModule('/src/App.tsx');
  const markup = renderToString(React.createElement(App));
  const file = new URL('../dist/index.html', import.meta.url);
  let html = await readFile(file, 'utf8');

  // The critical shell in index.html paints the header before any script runs.
  // Fill it with the navigation the app itself renders, so the shell is always
  // pixel-identical to the real header instead of a copy that can drift.
  const nav = markup.match(/<nav class="fixed top-0[\s\S]*?<\/nav>/);
  if (!nav) {
    throw new Error('prerender: the site navigation changed shape — update the critical shell extraction in scripts/prerender.mjs');
  }
  const shellNav = nav[0]
    // The shell is shown on every route, so the homepage-only current-page
    // marker does not belong in it.
    .replace(/\saria-current="page"/g, '')
    // The shell is aria-hidden, so nothing inside it may be focusable.
    .replace(/<a /g, '<a tabindex="-1" ')
    .replace(/<button /g, '<button tabindex="-1" ');
  if (!html.includes('<!--app-shell-nav-->')) {
    throw new Error('prerender: the <!--app-shell-nav--> marker is missing from index.html');
  }
  html = html.replace('<!--app-shell-nav-->', () => shellNav);

  // Only a fresh home visit may hydrate defaults. Existing CMS content, admin
  // sessions and consent always use the original client rendering path.
  const gate = `<style>html:not([data-prerender-home]) #root[data-prerender]{display:none}</style>
<script>
try {
  if (new Date().getFullYear() === ${new Date().getFullYear()} &&
      location.pathname === '/' && !location.hash.startsWith('#/') &&
      !localStorage.getItem('seoaudittool:cms:v1') &&
      !localStorage.getItem('ekstruh:cookie-consent:v1') &&
      !localStorage.getItem('ekstruh:admin-session:v1') &&
      !sessionStorage.getItem('ekstruh:admin-session:v1')) {
    document.documentElement.setAttribute('data-prerender-home', '');
  }
} catch (_) { /* Storage unavailable: retain client rendering. */ }
</script>`;
  html = html.replace('</head>', () => `${gate}</head>`);
  html = html.replace('<div id="root"></div>', () => `<div id="root" data-prerender>${markup}</div>`);
  await writeFile(file, html);
} finally {
  await server.close();
}
