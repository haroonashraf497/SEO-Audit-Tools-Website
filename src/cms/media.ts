/* ============================================================
   Media handling for the visual editor's "Add Media" dialog.

   The site is a static React build (no PHP, no upload endpoint),
   so uploaded images are optimised in the browser and stored as
   base64 `data:image/…` URLs inside the content. That keeps the
   editor self-contained, works offline, and is why the public
   sanitiser explicitly allows data:image sources.

   Everything here is deliberately small: posters, screenshots and
   photos are downscaled to a sensible edge length and re-encoded
   to WebP (JPEG fallback) so a typical 3 MB phone photo lands
   around 150–250 KB in the page.
   ============================================================ */

export const ACCEPTED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;          // hard reject above this
export const LARGE_IMAGE_BYTES = 350 * 1024;               // warn above this
export const MAX_IMAGE_EDGE = 1600;                        // px, longest side
export const LINKED_SRC_MAX = 100 * 1024;                  // above this, prefer upload

const LIBRARY_KEY = 'ekstruh:cms-media:v1';
const LIBRARY_LIMIT = 18;
const LIBRARY_TOTAL_BYTES = 2_000_000;
const LIBRARY_ITEM_BYTES = 400_000;

export interface MediaItem {
  id: string;
  /** data:image/… for uploads, absolute URL for remote images. */
  src: string;
  alt: string;
  name: string;
  bytes: number;
  width: number;
  height: number;
  remote: boolean;
  createdAt: number;
}

export const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/** Byte length of a base64 data URL (without decoding it twice). */
export const dataUrlBytes = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
};

const readAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be decoded.'));
    img.src = src;
  });

const encode = (canvas: HTMLCanvasElement, type: string, quality: number): string => {
  try { return canvas.toDataURL(type, quality); } catch { return ''; }
};

export interface OptimizedImage {
  src: string;
  name: string;
  width: number;
  height: number;
  bytes: number;
  type: string;
  originalBytes: number;
  /** False when the original was small/already optimal and was kept as-is. */
  compressed: boolean;
}

/** Validate a file picked or dropped into the editor. */
export const validateUpload = (file: File): string | null => {
  if (!file) return 'No file selected.';
  const type = (file.type || '').toLowerCase();
  if (type === 'image/svg+xml') return 'SVG uploads are not supported — export a PNG, JPG or WebP instead.';
  if (!ACCEPTED_UPLOAD_TYPES.includes(type)) return 'Use a PNG, JPG, WebP, GIF, AVIF or BMP image.';
  if (file.size > MAX_UPLOAD_BYTES) return `That image is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  return null;
};

/**
 * Downscale + re-encode an image file, keeping the smaller of the
 * original and the optimised version.
 */
export const optimizeImageFile = async (file: File): Promise<OptimizedImage> => {
  const problem = validateUpload(file);
  if (problem) throw new Error(problem);

  const originalSrc = await readAsDataUrl(file);
  const originalBytes = dataUrlBytes(originalSrc);
  const img = await loadImage(originalSrc);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const name = file.name || 'image';

  const keepOriginal = (): OptimizedImage => ({
    src: originalSrc, name, width, height, bytes: originalBytes,
    type: file.type, originalBytes, compressed: false,
  });

  // Animated GIFs and tiny files are better left untouched.
  if (file.type === 'image/gif' || originalBytes <= 120 * 1024) return keepOriginal();

  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return keepOriginal();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const candidates: { src: string; type: string }[] = [];
  const webp = encode(canvas, 'image/webp', 0.82);
  if (webp.startsWith('data:image/webp')) candidates.push({ src: webp, type: 'image/webp' });
  const jpeg = encode(canvas, 'image/jpeg', 0.85);
  if (jpeg.startsWith('data:image/jpeg')) candidates.push({ src: jpeg, type: 'image/jpeg' });
  const png = encode(canvas, 'image/png', 1);
  if (png.startsWith('data:image/png')) candidates.push({ src: png, type: 'image/png' });

  const best = candidates
    .map(candidate => ({ ...candidate, bytes: dataUrlBytes(candidate.src) }))
    .sort((a, b) => a.bytes - b.bytes)[0];

  if (!best || best.bytes >= originalBytes) return keepOriginal();
  return {
    src: best.src, name, width: targetW, height: targetH, bytes: best.bytes,
    type: best.type, originalBytes, compressed: true,
  };
};

/* ---------------- media library (persisted in this browser) ---------------- */

export const loadMediaLibrary = (): MediaItem[] => {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const parsed = raw ? (JSON.parse(raw) as MediaItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.src === 'string') : [];
  } catch {
    return [];
  }
};

const writeMediaLibrary = (items: MediaItem[]): void => {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(items)); } catch { /* quota */ }
};

/** Save an uploaded image so it can be re-inserted later. */
export const addToLibrary = (item: MediaItem): { ok: boolean; reason?: string } => {
  if (item.remote) return { ok: false, reason: 'Only uploaded images are stored in the library.' };
  if (item.bytes > LIBRARY_ITEM_BYTES) return { ok: false, reason: `Images larger than ${formatBytes(LIBRARY_ITEM_BYTES)} stay out of the library.` };
  const current = loadMediaLibrary().filter(existing => existing.src !== item.src);
  let next = [item, ...current].slice(0, LIBRARY_LIMIT);
  let total = next.reduce((sum, entry) => sum + (entry.bytes || 0), 0);
  while (next.length > 1 && total > LIBRARY_TOTAL_BYTES) {
    next = next.slice(0, next.length - 1);
    total = next.reduce((sum, entry) => sum + (entry.bytes || 0), 0);
  }
  writeMediaLibrary(next);
  return { ok: true };
};

export const removeFromLibrary = (id: string): MediaItem[] => {
  const next = loadMediaLibrary().filter(item => item.id !== id);
  writeMediaLibrary(next);
  return next;
};

/* ---------------- storage helpers ---------------- */

/** Rough localStorage usage in bytes (JSON content + drafts + library). */
export const estimateLocalStorageBytes = (): number => {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      total += key.length + (localStorage.getItem(key)?.length || 0);
    }
    return total * 2; // UTF-16 code units
  } catch {
    return 0;
  }
};

export const BROWSER_QUOTA_BYTES = 5 * 1024 * 1024;

export const newMediaId = (): string => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Build the HTML the editor inserts (sanitiser-friendly on purpose). */
export const buildImageHtml = (opts: {
  src: string;
  alt?: string;
  href?: string;
  caption?: string;
  align?: 'none' | 'left' | 'center' | 'right';
  width?: string;
}): string => {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const align = opts.align || 'none';
  const styles: string[] = [];
  if (align === 'center') styles.push('display: block', 'margin-left: auto', 'margin-right: auto');
  if (align === 'right') styles.push('display: block', 'margin-left: auto');
  if (align === 'left') styles.push('display: block', 'margin-right: auto');
  if (opts.width && /^\d{1,3}%$/.test(opts.width)) styles.push(`width: ${opts.width}`);

  let img = `<img src="${escape(opts.src)}" alt="${escape(opts.alt || '')}"`;
  if (styles.length) img += ` style="${styles.join('; ')}"`;
  img += ' loading="lazy" decoding="async" />';

  if (opts.href) img = `<a href="${escape(opts.href)}">${img}</a>`;
  if (opts.caption) return `<figure>${img}<figcaption>${escape(opts.caption)}</figcaption></figure>`;
  return img;
};
