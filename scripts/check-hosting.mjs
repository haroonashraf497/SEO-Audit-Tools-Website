// Run against an Apache/LiteSpeed staging deployment, not Vite's fallback:
// node scripts/check-hosting.mjs https://staging.example.com
import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin) throw new Error('Pass your Apache/LiteSpeed staging origin');
for (const path of ['/about', '/tools?cat=calculator', '/tool/percentage-calculator', '/blog']) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  assert.equal(response.status, 200, `${path} must serve the shell, not redirect to /`);
  assert.match(await response.text(), /id="root"/);
  console.log(`PASS 200 ${path}`);
}
for (const [path, destination] of [
  ['/index.html?from=test', '/?from=test'],
  ['/p/about?from=test', '/about?from=test'],
  ['/tool', '/tools'],
  ['/about.html', '/about'],
  ['/tools/', '/tools'],
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
