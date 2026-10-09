// Run against an Apache/LiteSpeed staging deployment, not Vite's fallback:
// node scripts/check-hosting.mjs https://staging.example.com
import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin) throw new Error('Pass your Apache/LiteSpeed staging origin');
for (const path of ['/about', '/free-seo-tools', '/calculator-tools', '/percentage-calculator', '/blog']) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  assert.equal(response.status, 200, `${path} must serve the shell, not redirect to /`);
  assert.match(await response.text(), /id="root"/);
  console.log(`PASS 200 ${path}`);
}
for (const [path, destination] of [
  ['/index.html?from=test', '/?from=test'],
  ['/p/about?from=test', '/about?from=test'],
  ['/about.html', '/about'],
  // the tools index answers on /free-seo-tools; every older spelling 301s to it
  ['/tools', '/free-seo-tools'],
  ['/tools/', '/free-seo-tools'],
  ['/tool', '/free-seo-tools'],
  ['/free-tools', '/free-seo-tools'],
  ['/free-seo-tool', '/free-seo-tools'],
  // a legacy ?cat= filter 301s onto the category page
  ['/free-seo-tools?cat=pdf', '/pdf-tools'],
  ['/free-seo-tools?cat=ip', '/ip-tools'],
  ['/free-seo-tools?cat=checker', '/website-checker-tools'],
  // tool pages are top level: every older nesting 301s onto the bare slug
  ['/free-seo-tools//percentage-calculator', '/percentage-calculator'],
  ['/free-seo-tools/percentage-calculator', '/percentage-calculator'],
  ['/free-seo-tools/percentage-calculator/', '/percentage-calculator'],
  ['/tool/percentage-calculator', '/percentage-calculator'],
  ['/tool/percentage-calculator/', '/percentage-calculator'],
  ['/free-tools/percentage-calculator', '/percentage-calculator'],
  ['/free-seo-tool/percentage-calculator', '/percentage-calculator'],
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

// The CMS snapshot ships with the site so an admin can import it. It must be
// served as JSON — a host that rewrites unknown paths to the shell would hand
// back index.html here, which imports as nothing.
{
  const response = await fetch(new URL('/cms-content.json', origin), { redirect: 'manual' });
  assert.equal(response.status, 200, '/cms-content.json must be served, not rewritten');
  assert.match(response.headers.get('content-type') || '', /json/, '/cms-content.json must be application/json');
  const content = JSON.parse(await response.text());
  assert.ok(content.tools?.length && content.posts?.length, 'cms-content.json must carry tools and posts');
  const blank = (content.pages || []).filter(page => !(page.content || '').trim()).map(page => page.slug);
  assert.deepEqual(blank, [], `cms-content.json has empty page bodies: ${blank.join(', ')}`);
  console.log(`PASS asset /cms-content.json (${content.pages.length} pages, ${content.tools.length} tools)`);
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