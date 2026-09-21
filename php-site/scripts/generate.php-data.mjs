// One-off generator: converts extracted JSON data into clean, editable PHP array files.
// Run from the repo root:  node php-site/scripts/generate.php-data.mjs
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../..');
const OUT = path.join(ROOT, 'php-site', 'includes');
fs.mkdirSync(OUT, { recursive: true });

const phpStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const phpVal = (v, indent) => {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return phpStr(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const items = v.map(x => indent + '  ' + phpVal(x, indent + '  ')).join(',\n');
    return '[\n' + items + ',\n' + indent + ']';
  }
  const keys = Object.keys(v);
  if (keys.length === 0) return '[]';
  const isList = keys.every((k, i) => String(i) === k);
  const items = isList
    ? keys.map(k => indent + '  ' + phpVal(v[k], indent + '  ')).join(',\n')
    : keys.map(k => indent + '  ' + phpStr(k) + ' => ' + phpVal(v[k], indent + '  ')).join(',\n');
  return '[\n' + items + ',\n' + indent + ']';
};

const write = (file, banner, exprName, data) => {
  const code = `<?php
/**
 * ${banner}
 * AUTO-GENERATED from the React build data — but fully editable PHP.
 * Change any value and it is used site-wide immediately (no build step).
 */

return ${phpVal(data, '')};
`;
  fs.writeFileSync(path.join(OUT, file), code);
  console.log(`${file}: ${(code.length / 1024).toFixed(1)} KB`);
};

// ---- tools-data.php ----
const tools = JSON.parse(fs.readFileSync('/tmp/tools.json', 'utf8'));
const cats = JSON.parse(fs.readFileSync('/tmp/categories.json', 'utf8'));
write('tools-data.php', 'All tool definitions + category labels (source of truth for the directory).', 'data', {
  categories: cats.labels,
  categoryOrder: cats.order,
  tools,
});

// ---- tool-content.php ---- (category-level About copy)
const copy = JSON.parse(fs.readFileSync('/tmp/tool-content.json', 'utf8'));
write('tool-content.php', 'Per-category "About the tool" content shown on every tool page.', 'copy', copy);

// ---- content.php ---- (pages, posts, seo, settings — from the CMS defaults)
const state = JSON.parse(fs.readFileSync('/tmp/cms-state.json', 'utf8'));
const articles = JSON.parse(fs.readFileSync('/tmp/articles.json', 'utf8'));
const posts = articles.map(a => ({
  slug: a.slug, title: a.title, metaTitle: a.metaTitle, metaDescription: a.metaDescription,
  excerpt: a.excerpt, content: a.content, category: a.category, date: a.date,
  readTime: a.readTime, author: a.author, keywords: a.keywords || [],
}));
write('content.php', 'Site content: legal/company pages, blog posts, SEO titles and site settings.', 'content', {
  settings: {
    name: 'SEO Audit Tools',
    domain: 'seoaudittools.pk',
    tagline: 'Free SEO audit + 150 tools',
    company: 'EKSTRUH LTD',
    companyNumber: '16905290',
    registeredOffice: 'Victoria Grove, Bolton, United Kingdom, BL1 4JW',
    email: 'help@seoaudittools.pk',
  },
  pages: state.pages,
  posts,
  seo: state.seo,
});
console.log('done');
