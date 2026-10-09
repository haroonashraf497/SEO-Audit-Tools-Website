/**
 * Mirror dist/ into public_html/ and pack it as public_html-upload.zip.
 *
 *   npm run build
 *   node scripts/pack-public-html.mjs     # or: npm run pack
 *
 * The repository keeps a tracked copy of the deployable output in `public_html/`
 * so a site can be uploaded straight from a fresh clone without building. This
 * script is what keeps that copy honest: it makes `public_html/` contain
 * exactly what `dist/` contains — nothing stale, nothing missing — and then
 * writes `public_html-upload.zip`, the archive you unpack into the web root.
 *
 * The zip holds the files at the archive root (no wrapper folder) and is built
 * with Node's own zlib, so there is no `zip` binary to install.
 */
import { deflateRawSync } from 'node:zlib';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');
const publicHtml = path.join(root, 'public_html');
const zipFile = path.join(root, 'public_html-upload.zip');

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html is missing — run npm run build first');
  process.exit(1);
}

/* ---- 0. refuse to pack a dist/ that is missing something from public/ ---- */

const publicDir = path.join(root, 'public');
const missingFromDist = readdirSync(publicDir, { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => e.name)
  .filter(name => !existsSync(path.join(dist, name)));
if (missingFromDist.length) {
  console.error(`dist/ is missing ${missingFromDist.map(n => `public/${n}`).join(', ')}`);
  console.error('these are copied in at build time — run `npm run build` (or `npm run cms:export`, which');
  console.error('also refreshes dist/) before packing, or the deploy will be incomplete.');
  process.exit(1);
}

/* ---- 1. public_html/ becomes an exact copy of dist/ ---- */

/** Every file under `dir`, relative and slash-separated, including dotfiles. */
const walk = (dir, base = '') => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const rel = base ? `${base}/${entry.name}` : entry.name;
  return entry.isDirectory() ? walk(path.join(dir, entry.name), rel) : [rel];
});

const distFiles = walk(dist).sort();
if (existsSync(publicHtml)) {
  for (const stale of walk(publicHtml).filter(rel => !distFiles.includes(rel))) {
    rmSync(path.join(publicHtml, stale));
    console.log(`removed stale public_html/${stale}`);
  }
  // Drop directories dist/ does not have (an emptied `assets/` is the classic
  // leftover from the pre-single-file build). Deepest first, so a parent is
  // only considered once its children are gone.
  const distDirs = new Set(distFiles.map(rel => path.posix.dirname(rel)).filter(d => d !== '.'));
  const hasDirs = dir => readdirSync(dir, { withFileTypes: true }).some(e => e.isDirectory());
  if (hasDirs(publicHtml)) {
    const dirs = readdirSync(publicHtml, { withFileTypes: true, recursive: true })
      .filter(e => e.isDirectory())
      .map(e => path.relative(publicHtml, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
      .sort((a, b) => b.split('/').length - a.split('/').length);
    for (const rel of dirs) {
      if (!distDirs.has(rel)) {
        rmSync(path.join(publicHtml, rel), { recursive: true, force: true });
        console.log(`removed stale public_html/${rel}/`);
      }
    }
  }
} else {
  mkdirSync(publicHtml, { recursive: true });
}
cpSync(dist, publicHtml, { recursive: true });

/* ---- 2. pack public_html/ into public_html-upload.zip ---- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const dosStamp = date => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
});

const chunks = [];
const central = [];
let offset = 0;

for (const rel of distFiles) {
  const name = Buffer.from(rel, 'utf8');
  const source = readFileSync(path.join(publicHtml, rel));
  const deflated = deflateRawSync(source, { level: 9 });
  const stored = deflated.length >= source.length; // never inflate a file that is already smaller
  const payload = stored ? source : deflated;
  const { time, date } = dosStamp(statSync(path.join(publicHtml, rel)).mtime);
  const crc = crc32(source);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);            // version needed
  local.writeUInt16LE(0, 6);             // flags
  local.writeUInt16LE(stored ? 0 : 8, 8); // method: store | deflate
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(source.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);

  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50, 0);
  record.writeUInt16LE(20, 4);           // version made by
  record.writeUInt16LE(20, 6);           // version needed
  record.writeUInt16LE(0, 8);
  record.writeUInt16LE(stored ? 0 : 8, 10);
  record.writeUInt16LE(time, 12);
  record.writeUInt16LE(date, 14);
  record.writeUInt32LE(crc, 16);
  record.writeUInt32LE(payload.length, 20);
  record.writeUInt32LE(source.length, 24);
  record.writeUInt16LE(name.length, 28);
  record.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, 0644
  record.writeUInt32LE(offset, 42);

  chunks.push(local, name, payload);
  central.push(record, name);
  offset += local.length + name.length + payload.length;
}

const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(distFiles.length, 8);
end.writeUInt16LE(distFiles.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

writeFileSync(zipFile, Buffer.concat([...chunks, ...central, end]));

const kb = n => `${(n / 1024).toFixed(1)} kB`;
console.log(`\npublic_html/ now mirrors dist/ — ${distFiles.length} files`);
console.log(`public_html-upload.zip  ${kb(statSync(zipFile).size)}`);
for (const rel of distFiles) console.log(`  ${rel.padEnd(20)} ${kb(statSync(path.join(publicHtml, rel)).size).padStart(11)}`);
