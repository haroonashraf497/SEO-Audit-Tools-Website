// Client-side PDF engine. The PDF libraries are NOT bundled: they are fetched
// on demand from a CDN (ESM, cached by the browser) the first time a PDF tool
// is used, so the landing page stays lightweight. Every operation runs entirely
// in the visitor's browser - files are never uploaded anywhere.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type PdfLibModule = {
  PDFDocument: any; StandardFonts: any; rgb: (r: number, g: number, b: number) => any; degrees: (d: number) => any;
};
export type PdfJsModule = { getDocument: (o: any) => { promise: Promise<any> }; GlobalWorkerOptions: { workerSrc: string } };
export type PdfDoc = any;
export type PdfFontLike = { widthOfTextAtSize: (t: string, s: number) => number };

const CDN = {
  // @cantoo/pdf-lib is a maintained pdf-lib fork with the same API plus AES encryption support
  pdfLib: 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.11.1/+esm',
  pdfJs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
  pdfJsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
  docx: 'https://cdn.jsdelivr.net/npm/docx@9.5.1/+esm',
};

// Use an indirect import so the bundler leaves the URL alone
const dyn = (url: string) => (new Function('u', 'return import(u)') as (u: string) => Promise<any>)(url);

let pdfLibP: Promise<PdfLibModule> | null = null;
let pdfJsP: Promise<PdfJsModule> | null = null;
let docxP: Promise<any> | null = null;

export const loadPdfLib = (): Promise<PdfLibModule> => (pdfLibP ??= dyn(CDN.pdfLib).catch(e => { pdfLibP = null; throw new Error('Could not load the PDF library (network blocked?). ' + e); }));
export const loadDocx = (): Promise<any> => (docxP ??= dyn(CDN.docx).catch(e => { docxP = null; throw new Error('Could not load the DOCX library. ' + e); }));
export const loadPdfJs = (): Promise<PdfJsModule> => {
  if (!pdfJsP) {
    pdfJsP = (async () => {
      const pdfjs = await dyn(CDN.pdfJs);
      pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfJsWorker;
      return pdfjs as PdfJsModule;
    })().catch(e => { pdfJsP = null; throw new Error('Could not load the PDF renderer. ' + e); });
  }
  return pdfJsP;
};

export const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

export const readFile = (f: File): Promise<ArrayBuffer> => new Promise((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = rej; r.readAsArrayBuffer(f);
});

export const download = (data: Uint8Array | Blob, name: string, type = 'application/pdf') => {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

export interface PdfInfo {
  pages: number; size: number; title: string; author: string; subject: string; creator: string; producer: string;
  created: string; modified: string; encrypted: boolean; pageSizes: { w: number; h: number }[]; version: string;
}

export const inspectPdf = async (buf: ArrayBuffer): Promise<PdfInfo> => {
  const { PDFDocument } = await loadPdfLib();
  let encrypted = false;
  let doc: PdfDoc;
  try { doc = await PDFDocument.load(buf, { updateMetadata: false }); }
  catch (e) { if (/encrypted/i.test(String(e))) { encrypted = true; doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false }); } else throw e; }
  const header = new TextDecoder().decode(new Uint8Array(buf.slice(0, 16)));
  const fmt = (d?: Date) => (d ? d.toLocaleString('en-GB') : '');
  return {
    pages: doc.getPageCount(), size: buf.byteLength,
    title: doc.getTitle() || '', author: doc.getAuthor() || '', subject: doc.getSubject() || '', creator: doc.getCreator() || '', producer: doc.getProducer() || '',
    created: fmt(doc.getCreationDate()), modified: fmt(doc.getModificationDate()),
    encrypted: encrypted || doc.isEncrypted,
    pageSizes: doc.getPages().slice(0, 50).map((p: any) => { const { width, height } = p.getSize(); return { w: Math.round(width), h: Math.round(height) }; }),
    version: (header.match(/%PDF-(\d\.\d)/) || [])[1] || '',
  };
};

export const paperName = (w: number, h: number) => {
  const [a, b] = [Math.min(w, h), Math.max(w, h)];
  const near = (x: number, y: number) => Math.abs(x - y) < 6;
  if (near(a, 595) && near(b, 842)) return 'A4';
  if (near(a, 612) && near(b, 792)) return 'US Letter';
  if (near(a, 612) && near(b, 1008)) return 'US Legal';
  if (near(a, 420) && near(b, 595)) return 'A5';
  if (near(a, 842) && near(b, 1191)) return 'A3';
  return `${Math.round(a / 72 * 25.4)}×${Math.round(b / 72 * 25.4)} mm`;
};

// Parse "1-3,5,8-10" into zero-based page indexes
export const parseRanges = (spec: string, max: number): number[] => {
  const out = new Set<number>();
  spec.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { const a = Math.max(1, +m[1]), b = Math.min(max, +m[2]); for (let i = a; i <= b; i++) out.add(i - 1); }
    else if (/^\d+$/.test(part)) { const n = +part; if (n >= 1 && n <= max) out.add(n - 1); }
  });
  return Array.from(out).sort((a, b) => a - b);
};

// ---------- Rendering helpers (pdf.js) ----------
export const renderPages = async (
  buf: ArrayBuffer, opts: { scale?: number; quality?: number; pages?: number[]; onProgress?: (done: number, total: number) => void; type?: 'image/jpeg' | 'image/png'; password?: string } = {},
): Promise<{ blob: Blob; width: number; height: number; page: number }[]> => {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), password: opts.password }).promise;
  const pages = opts.pages ?? Array.from({ length: doc.numPages }, (_, i) => i);
  const out: { blob: Blob; width: number; height: number; page: number }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = await doc.getPage(pages[i] + 1);
    const viewport = page.getViewport({ scale: opts.scale ?? 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas } as unknown as Parameters<typeof page.render>[0]).promise;
    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), opts.type ?? 'image/jpeg', opts.quality ?? 0.9));
    out.push({ blob, width: canvas.width, height: canvas.height, page: pages[i] + 1 });
    opts.onProgress?.(i + 1, pages.length);
    page.cleanup();
  }
  return out;
};

export const extractText = async (buf: ArrayBuffer, onProgress?: (d: number, t: number) => void): Promise<string[]> => {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let last: number | null = null; let text = '';
    for (const item of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
      const y = Math.round(item.transform[5]);
      if (last !== null && Math.abs(y - last) > 4) text += '\n';
      else if (text && !text.endsWith('\n') && !text.endsWith(' ')) text += ' ';
      text += item.str; last = y;
      if (item.hasEOL) text += '\n';
    }
    pages.push(text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
    onProgress?.(i, doc.numPages);
  }
  return pages;
};

// Rebuild a PDF from rendered page images (used by the compressor)
export const imagesToPdf = async (images: { blob: Blob; width: number; height: number }[], pageSizePt?: { w: number; h: number }[]) => {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  for (let i = 0; i < images.length; i++) {
    const bytes = new Uint8Array(await images[i].blob.arrayBuffer());
    const img = images[i].blob.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const size = pageSizePt?.[i] ?? { w: images[i].width * 0.75, h: images[i].height * 0.75 };
    const page = doc.addPage([size.w, size.h]);
    page.drawImage(img, { x: 0, y: 0, width: size.w, height: size.h });
  }
  return doc.save();
};

// Try to compress to a target size by lowering scale/quality iteratively
export const compressToTarget = async (
  buf: ArrayBuffer, targetBytes: number | null, onStatus?: (s: string) => void,
): Promise<{ bytes: Uint8Array; attempts: { scale: number; quality: number; size: number }[]; lossless: boolean }> => {
  const { PDFDocument } = await loadPdfLib();
  const attempts: { scale: number; quality: number; size: number }[] = [];
  // Pass 1: lossless structural re-save (object streams, drop unused)
  onStatus?.('Optimising document structure…');
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const lossless = await src.save({ useObjectStreams: true });
  attempts.push({ scale: 0, quality: 1, size: lossless.byteLength });
  if (!targetBytes || lossless.byteLength <= targetBytes) return { bytes: lossless, attempts, lossless: true };

  const sizes = src.getPages().map((p: any) => { const s = p.getSize(); return { w: s.width, h: s.height }; });
  const ladder: [number, number][] = [[1.5, 0.8], [1.3, 0.7], [1.1, 0.6], [1.0, 0.5], [0.9, 0.45], [0.8, 0.4], [0.7, 0.35], [0.6, 0.3], [0.5, 0.25]];
  let best: Uint8Array = lossless;
  for (const [scale, quality] of ladder) {
    onStatus?.(`Re-rendering pages at ${Math.round(scale * 72)} dpi, quality ${Math.round(quality * 100)}%…`);
    const imgs = await renderPages(buf, { scale, quality });
    const bytes = await imagesToPdf(imgs, sizes);
    attempts.push({ scale, quality, size: bytes.byteLength });
    if (bytes.byteLength < best.byteLength) best = bytes;
    if (bytes.byteLength <= targetBytes) return { bytes, attempts, lossless: false };
  }
  return { bytes: best, attempts, lossless: false };
};

// Wrap text into lines that fit a width using a pdf-lib font
export const wrapText = (text: string, font: PdfFontLike, size: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else {
        if (line) lines.push(line);
        // break very long words
        let w = word;
        while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
          let cut = w.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
          lines.push(w.slice(0, cut)); w = w.slice(cut);
        }
        line = w;
      }
    }
    lines.push(line);
  }
  return lines;
};

// Sanitize text for WinAnsi standard fonts (replace unsupported glyphs)
export const toWinAnsi = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2013/g, '-').replace(/\u2014/g, '--').replace(/\u2026/g, '...').replace(/[^\x00-\xFF]/g, '?');
