/**
 * Minimal static server for dist/ with correct caching, for local preview.
 *
 * Unlike `vite preview` (whose static handler forces its own Cache-Control),
 * this gives exact control:
 *   - HTML (and the SPA fallback for unknown routes) is `no-store`, so a
 *     rebuild is picked up on the next request and a stale shell can never be
 *     served.
 *   - Hashed /assets/* are immutable for a year, matching public/.htaccess.
 *
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../dist');
const port = Number(process.argv[2] || 4300);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const send = (res, code, body, headers) => {
  res.writeHead(code, headers);
  res.end(body);
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  let file = path.normalize(path.join(dist, pathname));
  if (!file.startsWith(dist)) return send(res, 403, 'Forbidden');

  // Resolve to a real file; directories get their index.html; anything missing
  // falls back to the SPA shell (the .htaccess does the same in production).
  let servePath = file;
  try {
    const s = await stat(file);
    if (s.isDirectory()) servePath = path.join(file, 'index.html');
  } catch {
    servePath = path.join(dist, 'index.html');
  }

  const isAsset = pathname.startsWith('/assets/');
  const ext = path.extname(servePath);

  let body;
  try {
    body = await readFile(servePath);
  } catch {
    servePath = path.join(dist, 'index.html');
    body = await readFile(servePath).catch(() => null);
    if (body === null) return send(res, 404, 'Not found');
  }

  const type = TYPES[path.extname(servePath)] || 'application/octet-stream';
  const cache = isAsset ? 'public, max-age=31536000, immutable' : 'no-store';
  send(res, 200, body, { 'Content-Type': type, 'Cache-Control': cache });
}).listen(port, '0.0.0.0', () => {
  console.log(`serve-dist listening on http://0.0.0.0:${port}`);
});
