/* ============================================================
   Small HTML helpers the Code tab uses. Kept separate from the
   React component so they stay pure and easy to reason about.
   ============================================================ */

/** Tags that start a new line when the code view is formatted. */
const BLOCK_TAG = /^<\/?(p|div|h[1-6]|ul|ol|li|dl|dt|dd|blockquote|pre|table|thead|tbody|tfoot|tr|th|td|caption|figure|figcaption|section|article|address|hr|br)\b/i;
const VOID_TAG = /^<(?:br|hr|img|input|meta|link|source)\b/i;
/** Block tags that hold other block-level children and therefore read best indented. */
const CONTAINER_TAGS = new Set(['ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'div', 'section', 'article', 'blockquote', 'figure', 'dl']);
const CLOSING_BLOCK_TAG = /^<\/(p|div|h[1-6]|ul|ol|li|dl|dt|dd|blockquote|pre|table|thead|tbody|tfoot|tr|th|td|caption|figure|figcaption|section|article|address)\s*>$/i;

/**
 * Light pretty-printer for the Code tab.
 *
 * Only breaks at block boundaries inside container elements and drops
 * just the insignificant whitespace between sibling blocks, so
 * formatting can never add or remove a space between inline elements
 * (which would silently change the rendered text).
 */
export const formatHtml = (html: string): string => {
  const tokens = (html || '').match(/<[^>]+>|[^<]+/g) || [];
  const out: string[] = [];
  const stack: string[] = [];
  const isContainer = () => stack.length > 0 && CONTAINER_TAGS.has(stack[stack.length - 1]);
  const breakLine = () => { if (out.length) out.push(`\n${'  '.repeat(stack.length)}`); };

  for (const token of tokens) {
    if (!token) continue;

    if (!token.startsWith('<')) {
      // Whitespace between two sibling blocks means nothing; whitespace inside a
      // run of inline content has to survive.
      if (/^\s+$/.test(token) && isContainer()) continue;
      out.push(token);
      continue;
    }

    const closingMatch = token.match(CLOSING_BLOCK_TAG);
    const openingMatch = !closingMatch && !/^<\//.test(token) ? token.match(BLOCK_TAG) : null;

    if (closingMatch) {
      const tag = closingMatch[1].toLowerCase();
      const index = stack.lastIndexOf(tag);
      if (index >= 0) stack.length = index;
      if (CONTAINER_TAGS.has(tag)) breakLine();
      out.push(token);
      continue;
    }

    if (openingMatch) {
      const tag = openingMatch[1].toLowerCase();
      const voidTag = VOID_TAG.test(token) || /\/>$/.test(token);
      if (isContainer() || stack.length === 0) breakLine();
      out.push(token);
      if (!voidTag) stack.push(tag);
      continue;
    }

    out.push(token);
  }

  return out.join('');
};

/** Escape a string for use inside an HTML attribute or text node. */
export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
