/* ============================================================
   Browser-side draft autosave for the visual editor.

   WordPress keeps a revision of whatever you were typing even if
   you never hit Publish. This is the same behaviour without a
   server: every editor writes a draft to localStorage (debounced),
   the editor shows "Draft saved at hh:mm", and if you close the tab
   or the browser crashes mid-edit the next visit offers to restore
   it. Drafts are cleared as soon as you save or publish the item.

   Keying: `<scope>:<id>` — e.g. `blog:my-post`, `page:<id>:<blockId>`,
   `tool:word-counter`, `new-post`.
   ============================================================ */

export interface DraftRecord {
  key: string;
  html: string;
  savedAt: number;
  words: number;
}

const PREFIX = 'ekstruh:cms-draft:v1:';
const INDEX_KEY = 'ekstruh:cms-draft-index:v1';
const MAX_DRAFTS = 40;
const MAX_BYTES_PER_DRAFT = 400_000;

const storageKey = (key: string) => `${PREFIX}${key}`;

const readJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const readIndex = (): string[] => {
  const list = readJson<string[]>(INDEX_KEY);
  return Array.isArray(list) ? list.filter(item => typeof item === 'string') : [];
 };

const writeIndex = (keys: string[]): void => {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(keys.slice(-MAX_DRAFTS))); } catch { /* quota */ }
};

const countWords = (html: string): number => {
  const text = (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
};

export const draftId = (scope: string, id: string): string => `${scope}:${id}`;

/** Write a draft. Returns false when the browser refuses (private mode / quota). */
export const saveDraft = (key: string, html: string): boolean => {
  if (!key) return false;
  try {
    const record: DraftRecord = { key, html: html || '', savedAt: Date.now(), words: countWords(html) };
    const serialised = JSON.stringify(record);
    if (serialised.length > MAX_BYTES_PER_DRAFT) {
      // Keep a truncated copy for very large posts rather than losing the edit entirely.
      record.html = `${(html || '').slice(0, Math.floor(MAX_BYTES_PER_DRAFT * 0.6))}\n<!-- truncated draft -->`;
    }
    localStorage.setItem(storageKey(key), JSON.stringify(record));
    const index = readIndex().filter(item => item !== key);
    index.push(key);
    writeIndex(index);
    return true;
  } catch {
    return false;
  }
};

export const readDraft = (key: string): DraftRecord | null => {
  if (!key) return null;
  const record = readJson<DraftRecord>(storageKey(key));
  if (!record || typeof record.html !== 'string') return null;
  return { key, html: record.html, savedAt: record.savedAt || 0, words: record.words || countWords(record.html) };
};

export const clearDraft = (key: string): void => {
  if (!key) return;
  try { localStorage.removeItem(storageKey(key)); } catch { /* ignore */ }
  writeIndex(readIndex().filter(item => item !== key));
};

export const clearDrafts = (keys: string[]): void => keys.forEach(clearDraft);

/** Every draft currently in the browser — used by the CMS storage panel. */
export const listDrafts = (): DraftRecord[] =>
  readIndex()
    .map(key => readDraft(key))
    .filter((record): record is DraftRecord => record !== null && !!record.html)
    .sort((a, b) => b.savedAt - a.savedAt);

export const clearAllDrafts = (): void => {
  readIndex().forEach(clearDraft);
  writeIndex([]);
};

export const formatDraftTime = (timestamp: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Rough word count used by the editor status bar. */
export const htmlWordCount = countWords;
