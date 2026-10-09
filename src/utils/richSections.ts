/**
 * Split one rich-text document into titled sections.
 *
 * The Competitor Analysis page keeps its design (a grid of benefit cards, an
 * FAQ accordion) while the admin edits each of those sections in a single
 * WYSIWYG editor. A heading starts a new section; everything under it — until
 * the next heading — becomes that section's body.
 *
 *   <h3>A fair benchmark</h3><p>Why it matters…</p>
 *   <h3>Clear priorities</h3><p>…</p>
 *
 * → [{ title: 'A fair benchmark', body: '<p>Why it matters…</p>' }, …]
 *
 * Content that appears before the first heading (an intro paragraph, say) is
 * returned as a section with an empty title, and a document with no headings
 * at all comes back as one untitled section so nothing is ever dropped.
 */
export interface RichSection {
  id: string;
  /** Heading text, tags stripped; empty for content before the first heading. */
  title: string;
  /** The section's HTML, already trimmed. */
  body: string;
}

const HEADING_TAG = /^H[1-6]$/;

/** Tags stripped — for places that must stay plain text (card titles, h3s). */
export const plainText = (html: string): string =>
  (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const splitRichSections = (html: string): RichSection[] => {
  const source = (html || '').trim();
  if (!source) return [];
  if (typeof DOMParser === 'undefined') return [{ id: 's0', title: '', body: source }];
  const doc = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const sections: RichSection[] = [];
  let current: RichSection | null = null;
  const flush = () => {
    if (!current) return;
    current.body = current.body.trim();
    if (current.title || current.body) sections.push(current);
    current = null;
  };
  Array.from(root.childNodes).forEach(node => {
    if (node.nodeType === 1 && HEADING_TAG.test((node as HTMLElement).tagName)) {
      flush();
      current = { id: `s${sections.length}`, title: plainText((node as HTMLElement).innerHTML), body: '' };
      return;
    }
    if (!current) current = { id: `s${sections.length}`, title: '', body: '' };
    current.body += node.nodeType === 1 ? (node as HTMLElement).outerHTML : (node.textContent || '');
  });
  flush();
  return sections;
};

/** Build the document back from titled sections (used by the CMS migration). */
export const joinRichSections = (sections: { title: string; body: string }[]): string =>
  sections
    .filter(section => (section.title || '').trim() || (section.body || '').trim())
    .map(section => `${section.title.trim() ? `<h3>${section.title.trim()}</h3>` : ''}${section.body || ''}`)
    .join('');
