/* ============================================================
   Allowlist HTML sanitiser for CMS rich-text content.

   Every string that reaches a public page through
   `dangerouslySetInnerHTML` (blog posts, page text blocks, tool
   "About" copy, sidebar notes) passes through here first — no
   matter whether it came from the visual editor, the code tab,
   a pasted web page or imported CMS JSON.

   Rules
   • Fixed allowlist of formatting tags; everything else is either
     unwrapped (keeping its text) or dropped with its content.
   • <script>, <style>, <iframe>, <form>, <svg>, media and other
     active content never survive.
   • on* event handlers, javascript:/vbscript: URLs and CSS
     url()/expression() are removed.
   • style="" declarations are validated against a property
     allowlist so text colour, highlight and alignment from the
     editor work while layout-injection tricks do not.
   • data:image/… uploads are allowed for <img src> (PNG, JPEG,
     WebP, GIF, AVIF, BMP — base64 only). data:text/html and
     data:image/svg+xml are rejected.
   • target="_blank" links always receive rel="noopener noreferrer".
   ============================================================ */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'q', 'cite', 'pre', 'code', 'kbd', 'samp', 'address',
  'a', 'img', 'figure', 'figcaption',
  'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'abbr', 'time', 'section', 'article',
]);

/** Tags removed together with everything inside them. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
  'form', 'input', 'button', 'select', 'option', 'optgroup', 'textarea', 'label', 'fieldset', 'legend',
  'link', 'meta', 'base', 'title', 'head', 'noscript', 'template',
  'svg', 'math', 'canvas', 'video', 'audio', 'source', 'track', 'map', 'area', 'portal',
]);

/** Attributes allowed per tag ("*" applies to every allowed tag). */
const ALLOWED_ATTRS: Record<string, string[]> = {
  '*': ['style', 'title'],
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  ol: ['start', 'type'],
};

const SAFE_SCHEME = /^(?:https?|mailto|tel):/i;
const SAFE_RELATIVE = /^(?:#|\/|\.{1,2}\/|\?)/;
const DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i;
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FN_COLOR = /^(?:rgba?|hsla?)\(\s*[\d.,%\s/deg]+\)$/i;
const NAMED_COLOR = /^[a-z]{3,20}$/i;
const LENGTH = /^(?:auto|\d{1,4}(?:\.\d+)?(?:px|%|em|rem|pt|ch))$/i;
/** Comma/space separated list of lengths (margin/padding shorthand). */
const LENGTH_LIST = /^(?:auto|\d{1,4}(?:\.\d+)?(?:px|%|em|rem|pt|ch))(?:[\s,]+(?:auto|\d{1,4}(?:\.\d+)?(?:px|%|em|rem|pt|ch))){0,3}$/i;

const colorValue = (value: string): string | null =>
  HEX_COLOR.test(value) || FN_COLOR.test(value) || NAMED_COLOR.test(value) ? value : null;

/** style="…" properties the editor is allowed to produce. */
const STYLE_PROPS: Record<string, (value: string) => string | null> = {
  'text-align': v => (/^(?:left|right|center|justify|start|end)$/i.test(v) ? v : null),
  color: colorValue,
  'background-color': colorValue,
  'font-weight': v => (/^(?:normal|bold|bolder|lighter|[1-9]00)$/i.test(v) ? v : null),
  'font-style': v => (/^(?:normal|italic|oblique)$/i.test(v) ? v : null),
  'text-decoration': v => {
    const tokens = v.split(/\s+/);
    return tokens.every(t => /^(?:none|underline|overline|line-through|solid|dashed|dotted|double|wavy)$/i.test(t)) ? v : null;
  },
  'vertical-align': v => (/^(?:baseline|middle|top|bottom|sub|super|text-top|text-bottom)$/i.test(v) ? v : null),
  display: v => (/^(?:block|inline|inline-block|none)$/i.test(v) ? v : null),
  float: v => (/^(?:left|right|none)$/i.test(v) ? v : null),
  width: v => (LENGTH.test(v) ? v : null),
  height: v => (LENGTH.test(v) ? v : null),
  'max-width': v => (LENGTH.test(v) ? v : null),
  'border-radius': v => (LENGTH_LIST.test(v) ? v : null),
  'margin-left': v => (LENGTH.test(v) ? v : null),
  'margin-right': v => (LENGTH.test(v) ? v : null),
  'margin-top': v => (LENGTH.test(v) ? v : null),
  'margin-bottom': v => (LENGTH.test(v) ? v : null),
  margin: v => (LENGTH_LIST.test(v) ? v : null),
};

/** Keep only safe declarations from a style attribute. */
export const sanitizeStyleAttribute = (raw: string): string => {
  if (!raw) return '';
  const safe: string[] = [];
  for (const chunk of raw.split(';')) {
    const idx = chunk.indexOf(':');
    if (idx < 1) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const validator = STYLE_PROPS[prop];
    if (!validator) continue;
    const value = chunk.slice(idx + 1).trim().replace(/\s+/g, ' ');
    if (!value || value.length > 120) continue;
    const checked = validator(value);
    if (checked) safe.push(`${prop}: ${checked}`);
  }
  return safe.join('; ');
};

const stripControl = (value: string): string => value.replace(/[\u0000-\u001f\u007f]/g, '').trim();

/** Validate a URL, optionally allowing base64 image uploads. */
export const sanitizeUrl = (raw: string, opts: { allowDataImage?: boolean } = {}): string | null => {
  const value = stripControl(raw);
  if (!value) return null;
  if (SAFE_RELATIVE.test(value)) return value;
  if (SAFE_SCHEME.test(value)) return value;
  if (opts.allowDataImage && DATA_IMAGE.test(value)) return value.replace(/\s+/g, '');
  return null;
};

const sanitizeElement = (el: Element): void => {
  const tag = el.tagName.toLowerCase();
  const allowedFor = new Set([...(ALLOWED_ATTRS['*'] || []), ...(ALLOWED_ATTRS[tag] || [])]);

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const raw = attr.value;
    if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') { el.removeAttribute(attr.name); continue; }
    if (!allowedFor.has(name)) { el.removeAttribute(attr.name); continue; }
    if (name === 'style') {
      const safe = sanitizeStyleAttribute(raw);
      if (safe) el.setAttribute('style', safe); else el.removeAttribute('style');
      continue;
    }
    if (name === 'href' || name === 'src') {
      const safe = sanitizeUrl(raw, { allowDataImage: name === 'src' && tag === 'img' });
      if (safe) el.setAttribute(name, safe);
      else el.removeAttribute(name);
      continue;
    }
    if (name === 'target') {
      if (!/^_(?:blank|self|parent|top)$/i.test(raw.trim())) el.removeAttribute('target');
      continue;
    }
    if (name === 'rel') {
      if (!/^[\w\s-]{0,120}$/.test(raw)) el.removeAttribute('rel');
      continue;
    }
    if (name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan' || name === 'start') {
      if (!/^\d{1,4}$/.test(raw.trim())) el.removeAttribute(attr.name);
      continue;
    }
    if (raw.length > 400) el.setAttribute(name, raw.slice(0, 400));
  }

  // Links that open a new tab must not leak the referrer or the opener.
  if (tag === 'a' && el.getAttribute('target') === '_blank') {
    const rel = (el.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
    for (const token of ['noopener', 'noreferrer']) if (!rel.includes(token)) rel.push(token);
    el.setAttribute('rel', rel.join(' '));
  }
};

const walk = (node: Node): void => {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) { child.parentNode?.removeChild(child); continue; }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      if (DROP_WITH_CONTENT.has(tag)) { el.remove(); continue; }
      // Structural wrapper from a pasted page (font, center, main, body…) → keep the text.
      walk(el);
      const parent = el.parentNode;
      if (!parent) continue;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }

    sanitizeElement(el);
    // Images without a usable source are noise.
    if (tag === 'img' && !el.getAttribute('src')) { el.remove(); continue; }
    walk(el);
  }
};

/** Last-resort regex pass for environments without DOMParser. */
const regexSanitize = (html: string): string =>
  html
    .replace(/<[^>]*>/g, tag => (/^<\s*\/?\s*(?:[a-z][a-z0-9]*)\s*\/?\s*>$/i.test(tag) ? tag : ''))
    .replace(/<\s*(script|style|iframe|object|embed|form|svg|video|audio)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text)[^"']*\2/gi, '$1="#"');

/**
 * Sanitise a fragment of rich HTML for public rendering.
 * Returns markup containing only allowlisted tags, attributes and styles.
 */
export const sanitizeRichHtml = (html: string): string => {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return regexSanitize(html);
  try {
    const doc = new DOMParser().parseFromString(`<body><div id="rte-root">${html}</div></body>`, 'text/html');
    const root = doc.getElementById('rte-root');
    if (!root) return regexSanitize(html);
    walk(root);
    return root.innerHTML;
  } catch {
    return regexSanitize(html);
  }
};

/** True when a string looks like authored HTML rather than legacy plain text. */
export const looksLikeHtml = (value: string): boolean => /<[a-z][^>]*>/i.test(value || '');
