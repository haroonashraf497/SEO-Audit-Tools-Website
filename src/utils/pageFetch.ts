// Real page fetcher: pulls the live HTML through public CORS proxies and
// extracts actual on-page SEO signals. Returns null when no proxy can reach
// the page so the UI can fall back to illustrative (simulated) data.

export interface LivePageData {
  ok: true;
  finalUrl: string;
  title: string;
  description: string;
  h1s: string[];
  headingCounts: Record<string, number>;
  imageCount: number;
  imagesMissingAlt: number;
  imagesAltWithKeyword: number;
  internalLinks: number;
  externalLinks: number;
  nofollowLinks: number;
  internalNofollowLinks: number;
  externalNofollowLinks: number;
  wordCount: number;
  canonical: string;
  favicon: string;
  charset: boolean;
  viewport: boolean;
  lang: string | null;
  robots: string;
  ogTitle: boolean;
  ogDescription: boolean;
  ogImage: boolean;
  ogUrl: boolean;
  twitterCard: boolean;
  codeSize: number;
  textSize: number;
  textRatio: number;
  linksSample: { href: string; internal: boolean; nofollow: boolean; anchor: string }[];
  bodyText: string;
  html: string;
  fetchMs: number;
  scripts: number;
  externalScripts: number;
  stylesheets: number;
  inlineStyles: number;
  iframes: number;
  forms: number;
  emails: string[];
  metaTags: { name: string; content: string }[];
  linkTags: { rel: string; href: string }[];
  generator: string;
  hasJsonLd: boolean;
  imagesWithoutDimensions: number;
  smallFontRisk: boolean;
}

// Several public CORS relays; each is tried in turn (they vary in availability by region/time).
const PROXIES: ((u: string) => string)[] = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
  u => `https://thingproxy.freeboard.io/fetch/${u}`,
  u => `https://cors.eu.org/${u}`,
  u => `https://proxy.cors.sh/${u}`,
];

const withTimeout = (ms: number) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
const looksLikeHtml = (t: string) => !!t && t.length > 200 && /<(html|head|body|title|!doctype)/i.test(t);

async function fetchHtml(targetUrl: string): Promise<string | null> {
  // 1) Direct fetch works for sites that send permissive CORS headers
  try {
    const res = await fetch(targetUrl, { signal: withTimeout(6000), mode: 'cors', headers: { Accept: 'text/html' } });
    if (res.ok) { const t = await res.text(); if (looksLikeHtml(t)) return t; }
  } catch { /* expected for most sites */ }

  // 2) Race the first two relays, then fall back through the rest sequentially
  const attempt = async (wrap: (u: string) => string, ms: number) => {
    const res = await fetch(wrap(targetUrl), { signal: withTimeout(ms), headers: { Accept: 'text/html,application/xhtml+xml' } });
    if (!res.ok) throw new Error(String(res.status));
    const t = await res.text();
    if (!looksLikeHtml(t)) throw new Error('not html');
    return t;
  };
  // Race the first two relays (first successful HTML wins)
  const raced = await new Promise<string | null>(resolve => {
    let pending = 2;
    PROXIES.slice(0, 2).forEach(p => attempt(p, 9000).then(t => resolve(t)).catch(() => { if (--pending === 0) resolve(null); }));
  });
  if (raced) return raced;
  for (const wrap of PROXIES.slice(2)) {
    try { return await attempt(wrap, 8000); } catch { /* next */ }
  }
  return null;
}

const metaContent = (doc: Document, selector: string): string => {
  const el = doc.querySelector(selector);
  return (el?.getAttribute('content') || '').trim();
};

const resolveUrl = (href: string, base: string): string => {
  try { return new URL(href, base).href; } catch { return href; }
};

export async function fetchPageData(rawUrl: string, keyword = ''): Promise<LivePageData | null> {
  const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const t0 = performance.now();
  const html = await fetchHtml(targetUrl);
  const fetchMs = Math.round(performance.now() - t0);
  if (!html) return null;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const targetHost = (() => { try { return new URL(targetUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();

    // Resource & structure stats (collected before scripts/styles are stripped)
    const scriptEls = Array.from(doc.querySelectorAll('script'));
    const scripts = scriptEls.length;
    const externalScripts = scriptEls.filter(s => s.getAttribute('src')).length;
    const stylesheets = doc.querySelectorAll('link[rel="stylesheet"]').length;
    const inlineStyles = doc.querySelectorAll('style').length;
    const iframes = doc.querySelectorAll('iframe').length;
    const forms = doc.querySelectorAll('form').length;
    const hasJsonLd = !!doc.querySelector('script[type="application/ld+json"]');
    const generator = (doc.querySelector('meta[name="generator"]')?.getAttribute('content') || '').trim();
    const metaTags = Array.from(doc.querySelectorAll('meta')).map(m => ({
      name: m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv') || (m.hasAttribute('charset') ? 'charset' : ''),
      content: m.getAttribute('content') || m.getAttribute('charset') || '',
    })).filter(m => m.name);
    const linkTags = Array.from(doc.querySelectorAll('link[rel]')).map(l => ({ rel: l.getAttribute('rel') || '', href: l.getAttribute('href') || '' })).slice(0, 60);
    const emailSet = new Set<string>();
    (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach(e => { if (!/\.(png|jpg|gif|svg|webp|css|js)$/i.test(e)) emailSet.add(e.toLowerCase()); });
    const emails = Array.from(emailSet).slice(0, 50);
    const imagesWithoutDimensions = Array.from(doc.querySelectorAll('img')).filter(i => !i.getAttribute('width') || !i.getAttribute('height')).length;
    const smallFontRisk = /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi.test(html) && Array.from(html.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)).some(m => Number(m[1]) < 12);

    const title = (doc.querySelector('title')?.textContent || '').trim();
    let description = metaContent(doc, 'meta[name="description"]');
    if (!description) description = metaContent(doc, 'meta[property="og:description"]');

    // Headings
    const headingCounts: Record<string, number> = { H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 };
    const h1s: string[] = [];
    (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => {
        headingCounts[tag.toUpperCase()]++;
        if (tag === 'h1') {
          const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
          if (t) h1s.push(t.slice(0, 120));
        }
      });
    });

    // Images
    let imageCount = 0;
    let imagesMissingAlt = 0;
    let imagesAltWithKeyword = 0;
    doc.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src');
      if (!src) return;
      imageCount++;
      const alt = (img.getAttribute('alt') || '').trim();
      if (!alt) imagesMissingAlt++;
      if (keyword && alt.toLowerCase().includes(keyword.toLowerCase())) imagesAltWithKeyword++;
    });

    // Links
    let internalLinks = 0;
    let externalLinks = 0;
    let nofollowLinks = 0;
    let internalNofollowLinks = 0;
    let externalNofollowLinks = 0;
    const seen = new Set<string>();
    const linksSample: { href: string; internal: boolean; nofollow: boolean; anchor: string }[] = [];
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/^(javascript:|mailto:|tel:|#)/i.test(href)) return;
      let u: URL;
      try { u = new URL(href, targetUrl); } catch { return; }
      const key = u.href.split('#')[0];
      if (seen.has(key)) return;
      seen.add(key);
      const rel = (a.getAttribute('rel') || '').toLowerCase();
      const isNofollow = rel.includes('nofollow');
      if (isNofollow) nofollowLinks++;
      const internal = u.hostname.replace(/^www\./, '') === targetHost;
      if (internal) {
        internalLinks++;
        if (isNofollow) internalNofollowLinks++;
      } else if (/^https?:$/.test(u.protocol)) {
        externalLinks++;
        if (isNofollow) externalNofollowLinks++;
      }
      // Keep actual URLs, anchor labels and nofollow status for the audit report.
      if ((internal || /^https?:$/.test(u.protocol)) && linksSample.length < 80) {
        const anchor = ((a.textContent || '').replace(/\s+/g, ' ').trim() || a.getAttribute('aria-label') || a.getAttribute('title') || u.hostname).slice(0, 120);
        linksSample.push({ href: key, internal, nofollow: isNofollow, anchor });
      }
    });

    // Code size before stripping, visible text after
    const codeSize = html.length;
    doc.querySelectorAll('script,style,noscript,svg,template').forEach(el => el.remove());
    // Prefer readable paragraph content (article/main) so nav & footer noise is excluded
    const mainRoot = doc.querySelector('article, main, [role="main"]') || doc.body;
    const paragraphs = Array.from(mainRoot?.querySelectorAll('p, h1, h2, h3, li') || [])
      .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(t => t.split(' ').length >= 4);
    const readable = paragraphs.join(' ');
    const bodyText = (readable.length > 200 ? readable : (doc.body?.textContent || '')).replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
    const textSize = bodyText.length;
    const textRatio = codeSize ? Math.round((textSize / codeSize) * 1000) / 10 : 0;

    const canonicalHref = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    const canonical = canonicalHref ? resolveUrl(canonicalHref, targetUrl) : targetUrl;

    const iconHref =
      doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ||
      doc.querySelector('link[rel="icon"]')?.getAttribute('href') ||
      doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') || '';
    // Keep the page's declared favicon only; no third-party fallback = zero extra requests
    const favicon = iconHref ? resolveUrl(iconHref, targetUrl) : '';

    return {
      ok: true,
      finalUrl: targetUrl,
      title,
      description,
      h1s,
      headingCounts,
      imageCount,
      imagesMissingAlt,
      imagesAltWithKeyword,
      internalLinks,
      externalLinks,
      nofollowLinks,
      internalNofollowLinks,
      externalNofollowLinks,
      wordCount,
      canonical,
      favicon,
      charset: !!doc.querySelector('meta[charset]'),
      viewport: !!doc.querySelector('meta[name="viewport"]'),
      lang: doc.documentElement.getAttribute('lang'),
      robots: metaContent(doc, 'meta[name="robots"]') || 'index, follow',
      ogTitle: !!metaContent(doc, 'meta[property="og:title"]'),
      ogDescription: !!metaContent(doc, 'meta[property="og:description"]'),
      ogImage: !!metaContent(doc, 'meta[property="og:image"]'),
      ogUrl: !!metaContent(doc, 'meta[property="og:url"]'),
      twitterCard: !!metaContent(doc, 'meta[name="twitter:card"]'),
      codeSize,
      textSize,
      textRatio,
      linksSample,
      bodyText: bodyText.slice(0, 20000),
      html,
      fetchMs,
      scripts,
      externalScripts,
      stylesheets,
      inlineStyles,
      iframes,
      forms,
      emails,
      metaTags,
      linkTags,
      generator,
      hasJsonLd,
      imagesWithoutDimensions,
      smallFontRisk,
    };
  } catch {
    return null;
  }
}
