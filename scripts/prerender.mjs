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
  // The build is a single file: the whole application is inlined as one big
  // <script> inside <head>. That code contains HTML in string literals —
  // including the text `</head>` and `<div id="root">` — so a naive
  // first-match replace would inject this gate *inside the script* and break
  // it. The real document landmarks are always the LAST occurrence, because
  // the inline script sits before them.
  const insertBeforeLast = (source, needle, insert) => {
    const at = source.lastIndexOf(needle);
    if (at === -1) throw new Error(`prerender: could not find ${needle} in dist/index.html`);
    return source.slice(0, at) + insert + source.slice(at);
  };
  const replaceLast = (source, needle, replacement) => {
    const at = source.lastIndexOf(needle);
    if (at === -1) throw new Error(`prerender: could not find ${needle} in dist/index.html`);
    return source.slice(0, at) + replacement + source.slice(at + needle.length);
  };
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
  html = insertBeforeLast(html, '</head>', gate);
  html = replaceLast(html, '<div id="root"></div>', `<div id="root" data-prerender>${markup}</div>`);
  await writeFile(file, html);
} finally {
  await server.close();
}
