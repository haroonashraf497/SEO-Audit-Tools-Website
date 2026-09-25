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

// Code-split build: the hashed /assets chunks must be deployed alongside
// index.html and served with long-lived immutable caching. Chunk names are
// read from the local dist/ output, which is the deployment source.
import { readdirSync } from 'node:fs';
const entry = readdirSync(new URL('../dist/assets', import.meta.url)).find(f => /^index-[^/]+\.js$/.test(f));
const routeChunk = readdirSync(new URL('../dist/assets', import.meta.url)).find(f => /^Tools-[^/]+\.js$/.test(f));
if (!entry || !routeChunk) throw new Error('Run npm run build first — dist/assets chunks are missing');
for (const path of [`/assets/${entry}`, `/assets/${routeChunk}`]) {
  const response = await fetch(new URL(path, origin));
  assert.equal(response.status, 200, `${path} must be uploaded with index.html`);
  assert.match(response.headers.get('content-type') || '', /javascript/, `${path} wrong content-type`);
  assert.match(response.headers.get('cache-control') || '', /max-age=\d{4,}/, `${path} should be cached long-term (immutable)`);
  console.log(`PASS asset ${path}`);
}
const html = await (await fetch(new URL('/', origin))).text();
assert.match(html, new RegExp(`<script[^>]+src="/assets/${entry}"`), 'index.html must reference the deployed entry chunk');
console.log('PASS entry chunk referenced by index.html');
