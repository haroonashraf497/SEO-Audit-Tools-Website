// Run against an Apache/LiteSpeed staging deployment, not Vite's fallback:
// node scripts/check-hosting.mjs https://staging.example.com
import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin) throw new Error('Pass your Apache/LiteSpeed staging origin');
for (const path of ['/about', '/free-tools?cat=calculator', '/tool/percentage-calculator', '/blog']) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  assert.equal(response.status, 200, `${path} must serve the shell, not redirect to /`);
  assert.match(await response.text(), /id="root"/);
  console.log(`PASS 200 ${path}`);
}
for (const [path, destination] of [
  ['/index.html?from=test', '/?from=test'],
  ['/p/about?from=test', '/about?from=test'],
  ['/tool', '/free-tools'],
  ['/about.html', '/about'],
  ['/tools', '/free-tools'],
  ['/tools/', '/free-tools'],
  ['/tool//percentage-calculator', '/tool/percentage-calculator'],
]) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  assert.equal(response.status, 301, path);
  assert.equal(new URL(response.headers.get('location'), origin).href, new URL(destination, origin).href);
  console.log(`PASS 301 ${path} → ${destination}`);
}
for (const path of ['/robots.txt', '/sitemap.xml', '/favicon.svg', '/og.jpg']) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  assert.equal(response.status, 200, path);
  assert.doesNotMatch(response.headers.get('content-type') || '', /text\/html/);
  console.log(`PASS asset ${path}`);
}

// Single-file build: dist/index.html carries the whole application inline,
// so a deployment is that one document plus the public files (nothing under
// /assets). Check that the deployed shell really is self-contained.
const html = await (await fetch(new URL('/', origin))).text();
assert.match(html, /<script type="module"/, 'index.html must inline the application script');
assert.doesNotMatch(html, /<script[^>]+src="\/assets\//, 'index.html must not reference external chunks');
assert.match(html, /id="root"/, 'index.html must contain the app root');
const assets = await fetch(new URL('/assets/', origin), { redirect: 'manual' });
assert.ok(assets.status === 404 || assets.status === 403, 'no /assets directory should be deployed');
console.log('PASS single-file shell (no external chunks)');