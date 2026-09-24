/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from 'react';
import { PrivacyNote, DropZone, Progress, ErrorBox, Btn, StatBox, FileInfoPanel, ResultPanel, usePdfFile } from './ui';
import { loadPdfLib, loadDocx, fmtBytes, readFile, download, renderPages, extractText, wrapText, toWinAnsi } from './engine';

const base = (name: string) => name.replace(/\.[^.]+$/, '');

// Page size presets in points
const PAGE_SIZES: Record<string, [number, number]> = { A4: [595.28, 841.89], Letter: [612, 792], Legal: [612, 1008], A5: [419.53, 595.28], A3: [841.89, 1190.55] };

// Shared: build a text PDF with title/body styling and page numbers
const buildTextPdf = async (opts: { text: string; title?: string; size: string; landscape: boolean; fontName: 'Helvetica' | 'TimesRoman' | 'Courier'; fontSize: number; margin: number; lineHeight: number; pageNumbers: boolean; headings?: boolean }) => {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts[opts.fontName]);
  const bold = await doc.embedFont(opts.fontName === 'TimesRoman' ? StandardFonts.TimesRomanBold : opts.fontName === 'Courier' ? StandardFonts.CourierBold : StandardFonts.HelveticaBold);
  let [w, h] = PAGE_SIZES[opts.size] || PAGE_SIZES.A4; if (opts.landscape) [w, h] = [h, w];
  const m = opts.margin; const lh = opts.fontSize * opts.lineHeight; const maxW = w - m * 2;
  let page = doc.addPage([w, h]); let y = h - m; let pageNo = 1;
  const footer = () => { if (opts.pageNumbers) page.drawText(String(pageNo), { x: w / 2 - 5, y: m / 2, size: 9, font, color: rgb(0.5, 0.5, 0.5) }); };
  const newPage = () => { footer(); page = doc.addPage([w, h]); y = h - m; pageNo++; };
  if (opts.title) { const t = toWinAnsi(opts.title); page.drawText(t, { x: m, y: y - 20, size: opts.fontSize + 8, font: bold, color: rgb(0.1, 0.1, 0.2) }); y -= opts.fontSize + 8 + 24; }
  const paras = toWinAnsi(opts.text).split(/\n/);
  for (const raw of paras) {
    const isHeading = opts.headings && /^(#{1,3}\s|[A-Z][A-Z0-9 ,&'-]{6,}$)/.test(raw.trim());
    const isBullet = /^\s*[-*•]\s+/.test(raw);
    const line = raw.replace(/^#{1,3}\s/, '').replace(/^\s*[-*•]\s+/, '• ');
    const f = isHeading ? bold : font; const fs = isHeading ? opts.fontSize + 3 : opts.fontSize;
    if (!line.trim()) { y -= lh * 0.6; continue; }
    for (const l of wrapText(line, f, fs, maxW - (isBullet ? 12 : 0))) {
      if (y - lh < m) newPage();
      page.drawText(l, { x: m + (isBullet ? 12 : 0), y: y - fs, size: fs, font: f, color: rgb(0.12, 0.12, 0.15) });
      y -= lh;
    }
    if (isHeading) y -= lh * 0.3;
  }
  footer();
  doc.setProducer('SEO Audit Tool PDF Tools'); if (opts.title) doc.setTitle(opts.title);
  return { bytes: await doc.save(), pages: doc.getPageCount() };
};

const TextOptions: React.FC<{ o: { size: string; landscape: boolean; fontName: 'Helvetica' | 'TimesRoman' | 'Courier'; fontSize: number; margin: number; lineHeight: number; pageNumbers: boolean }; set: (k: string, v: unknown) => void }> = ({ o, set }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <div><label className="text-xs font-semibold text-slate-600 block mb-1">Page size</label><select aria-label="Page size" value={o.size} onChange={e => set('size', e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 text-sm bg-white">{Object.keys(PAGE_SIZES).map(s => <option key={s}>{s}</option>)}</select></div>
    <div><label className="text-xs font-semibold text-slate-600 block mb-1">Font</label><select aria-label="Font" value={o.fontName} onChange={e => set('fontName', e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 text-sm bg-white"><option value="Helvetica">Helvetica (sans)</option><option value="TimesRoman">Times (serif)</option><option value="Courier">Courier (mono)</option></select></div>
    <div><label className="text-xs font-semibold text-slate-600 block mb-1">Font size {o.fontSize}pt</label><input aria-label="Font size in points" type="range" min={8} max={18} value={o.fontSize} onChange={e => set('fontSize', Number(e.target.value))} className="w-full accent-indigo-600" /></div>
    <div><label className="text-xs font-semibold text-slate-600 block mb-1">Margins {Math.round(o.margin / 72 * 25.4)}mm</label><input aria-label="Page margins" type="range" min={36} max={90} value={o.margin} onChange={e => set('margin', Number(e.target.value))} className="w-full accent-indigo-600" /></div>
    <div><label className="text-xs font-semibold text-slate-600 block mb-1">Line spacing {o.lineHeight.toFixed(1)}</label><input aria-label="Line spacing" type="range" min={1.1} max={2} step={0.1} value={o.lineHeight} onChange={e => set('lineHeight', Number(e.target.value))} className="w-full accent-indigo-600" /></div>
    <label className="flex items-center gap-2 text-sm text-slate-700 mt-5"><input type="checkbox" checked={o.landscape} onChange={e => set('landscape', e.target.checked)} className="accent-indigo-600" /> Landscape</label>
    <label className="flex items-center gap-2 text-sm text-slate-700 mt-5"><input type="checkbox" checked={o.pageNumbers} onChange={e => set('pageNumbers', e.target.checked)} className="accent-indigo-600" /> Page numbers</label>
  </div>
);

const defaultOpts = { size: 'A4', landscape: false, fontName: 'Helvetica' as const, fontSize: 11, margin: 56, lineHeight: 1.4, pageNumbers: true };

// ---------- Text To PDF ----------
export const TextToPdf: React.FC = () => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [o, setO] = useState(defaultOpts);
  const [out, setOut] = useState<{ bytes: Uint8Array; pages: number } | null>(null);
  const [err, setErr] = useState('');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const run = async () => { try { setErr(''); setOut(await buildTextPdf({ text, title, headings: true, ...o })); } catch (e) { setErr(String((e as Error).message || e)); } };
  const onFile = (fs: File[]) => { const r = new FileReader(); r.onload = () => { setText(String(r.result || '')); setTitle(base(fs[0].name)); }; r.readAsText(fs[0]); };
  return (
    <div className="space-y-5">
      <PrivacyNote />
      <div className="grid lg:grid-cols-[1fr_260px] gap-4">
        <div className="space-y-3"><input aria-label="Document title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title (optional)" className="w-full p-3 rounded-xl border border-slate-300 text-sm" /><textarea aria-label="Document text" value={text} onChange={e => { setText(e.target.value); setOut(null); }} rows={14} placeholder="Type or paste your text here… Lines starting with # become headings, lines starting with - become bullets." className="w-full p-4 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" /></div>
        <DropZone accept=".txt,.md,.csv,.log,text/plain" onFiles={onFile} label="Or upload a .txt file" compact />
      </div>
      <div className="grid grid-cols-3 gap-3"><StatBox label="Words" value={words} /><StatBox label="Characters" value={text.length} /><StatBox label="Est. pages" value={Math.max(1, Math.ceil(words / (o.fontSize <= 10 ? 600 : o.fontSize <= 12 ? 450 : 320)))} /></div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"><TextOptions o={o} set={(k, v) => setO({ ...o, [k]: v })} /><Btn onClick={run} disabled={!text.trim()} className="w-full py-4 text-base">Create PDF →</Btn></div>
      {err && <ErrorBox msg={err} />}
      {out && <ResultPanel title={`PDF created · ${out.pages} page${out.pages === 1 ? '' : 's'}`} bytes={out.bytes.byteLength} onDownload={() => download(out.bytes, `${title || 'document'}.pdf`)} onReset={() => setOut(null)} />}
    </div>
  );
};

// ---------- Word To PDF (.docx parsed client-side; or pasted text) ----------
const docxToText = async (buf: ArrayBuffer): Promise<{ text: string; title: string }> => {
  // Minimal DOCX reader: unzip word/document.xml via DecompressionStream-free parsing using JSZip-less approach
  // DOCX is a ZIP; locate document.xml using the central directory and inflate with DecompressionStream
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const decoder = new TextDecoder();
  // find End Of Central Directory
  let eocd = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i--) { if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Not a valid .docx (zip) file');
  const cdCount = view.getUint16(eocd + 10, true); let ptr = view.getUint32(eocd + 16, true);
  let found: { off: number; comp: number; csize: number } | null = null;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const comp = view.getUint16(ptr + 10, true); const csize = view.getUint32(ptr + 20, true); const nlen = view.getUint16(ptr + 28, true); const elen = view.getUint16(ptr + 30, true); const clen = view.getUint16(ptr + 32, true); const off = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.slice(ptr + 46, ptr + 46 + nlen));
    if (name === 'word/document.xml') { found = { off, comp, csize }; break; }
    ptr += 46 + nlen + elen + clen;
  }
  if (!found) throw new Error('word/document.xml not found — is this a .docx file?');
  const lnlen = view.getUint16(found.off + 26, true); const lelen = view.getUint16(found.off + 28, true);
  const dataStart = found.off + 30 + lnlen + lelen;
  const raw = bytes.slice(dataStart, dataStart + found.csize);
  let xml: string;
  if (found.comp === 0) xml = decoder.decode(raw);
  else {
    if (typeof DecompressionStream === 'undefined') throw new Error('Your browser cannot decompress .docx files. Paste the text instead.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([raw]).stream().pipeThrough(ds);
    xml = await new Response(stream).text();
  }
  // Paragraph-aware extraction
  const paras = Array.from(xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)).map(m => {
    const p = m[0];
    const isHeading = /<w:pStyle w:val="(Heading\d|Title)"/i.test(p);
    const isList = /<w:numPr>/.test(p);
    const t = Array.from(p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)).map(x => x[0].startsWith('<w:tab') ? '\t' : x[0].startsWith('<w:br') ? '\n' : x[1]).join('');
    const clean = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    return (isHeading ? '# ' : isList ? '- ' : '') + clean;
  });
  const title = paras.find(p => p.startsWith('# '))?.slice(2) || '';
  return { text: paras.join('\n'), title };
};

export const WordToPdf: React.FC = () => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [o, setO] = useState(defaultOpts);
  const [out, setOut] = useState<{ bytes: Uint8Array; pages: number } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const onFile = async (fs: File[]) => {
    const f = fs[0]; setErr(''); setOut(null); setBusy(true); setFileName(f.name);
    try {
      if (/\.docx$/i.test(f.name)) { const r = await docxToText(await readFile(f)); setText(r.text); setTitle(r.title || base(f.name)); }
      else if (/\.(txt|md|rtf)$/i.test(f.name)) { const t = await f.text(); setText(t.replace(/\\par[d]?/g, '\n').replace(/\{\\[^}]*\}|\\[a-z]+-?\d* ?/g, '')); setTitle(base(f.name)); }
      else if (/\.doc$/i.test(f.name)) { setErr('Legacy .doc (Word 97-2003) is a binary format that cannot be parsed in the browser. Save it as .docx in Word and try again, or paste the text.'); }
      else setErr('Unsupported file. Upload .docx, .txt or .md.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    setBusy(false);
  };
  const run = async () => { try { setErr(''); setOut(await buildTextPdf({ text, title, headings: true, ...o })); } catch (e) { setErr(String((e as Error).message || e)); } };
  const paras = text.split('\n').filter(l => l.trim()).length;
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {!text ? <DropZone accept=".docx,.txt,.md,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onFiles={onFile} label="Select a Word document (.docx)" hint="Also accepts .txt / .md · parsed locally, nothing uploaded" /> : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">DOCX</span><div><p className="font-semibold text-slate-800">{fileName || 'Pasted text'}</p><p className="text-xs text-slate-500">{paras} paragraphs · {text.trim().split(/\s+/).length.toLocaleString()} words · {text.split('\n').filter(l => l.startsWith('# ')).length} headings · {text.split('\n').filter(l => l.startsWith('- ')).length} list items</p></div></div><button type="button" onClick={() => { setText(''); setOut(null); setFileName(''); }} className="text-xs font-semibold text-slate-500 hover:text-red-600">Remove</button></div>
          <details className="bg-white rounded-2xl border border-slate-200"><summary className="p-4 text-sm font-semibold text-slate-700 cursor-pointer">Preview / edit extracted content</summary><textarea value={text} onChange={e => setText(e.target.value)} rows={12} className="w-full p-4 border-t border-slate-200 text-sm outline-none" /></details>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"><input aria-label="Document title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" className="w-full p-3 rounded-xl border border-slate-300 text-sm" /><TextOptions o={o} set={(k, v) => setO({ ...o, [k]: v })} /><Btn onClick={run} className="w-full py-4 text-base">Convert to PDF →</Btn></div>
        </>
      )}
      {busy && <Progress value={60} label="Reading document…" />}
      {err && <ErrorBox msg={err} />}
      {!text && <div className="text-center text-sm text-slate-500">or <button type="button" onClick={() => setText(' ')} className="text-indigo-600 font-semibold underline">paste text manually</button></div>}
      {out && <ResultPanel title={`Converted · ${out.pages} page${out.pages === 1 ? '' : 's'}`} bytes={out.bytes.byteLength} onDownload={() => download(out.bytes, `${title || base(fileName) || 'document'}.pdf`)} onReset={() => setOut(null)}><p className="text-xs text-slate-500 mt-4">Text, headings and lists are preserved. Images, tables and complex layouts from Word are not carried over by browser-side conversion.</p></ResultPanel>}
    </div>
  );
};

// ---------- PDF To Word (.docx via docx library) ----------
export const PdfToWord: React.FC = () => {
  const f = usePdfFile();
  const [pages, setPages] = useState<string[] | null>(null);
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const run = async () => {
    if (!f.buf) return; setBusy(true); setPages(null); setDocxBlob(null); f.setError('');
    try {
      const txt = await extractText(f.buf, (d, t) => setPct((d / t) * 90));
      setPages(txt);
      const totalChars = txt.join('').length;
      if (totalChars < 20) { f.setError('No selectable text found — this PDF is probably a scan. Use PDF To JPG to get images of the pages.'); setBusy(false); return; }
      const docx = await loadDocx();
      const children: any[] = [];
      txt.forEach((p, i) => {
        p.split(/\n{2,}/).forEach(block => {
          const lines = block.split('\n');
          const isHeading = lines.length === 1 && lines[0].length < 80 && /^[A-Z0-9]/.test(lines[0]) && !/[.!?]$/.test(lines[0]);
          children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: lines.join(' '), bold: isHeading, size: isHeading ? 28 : 22 })], heading: isHeading ? docx.HeadingLevel.HEADING_2 : undefined, spacing: { after: 160 } }));
        });
        if (i < txt.length - 1) children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
      });
      const document = new docx.Document({ creator: 'SEO Audit Tool', title: f.info?.title || base(f.file!.name), sections: [{ children }] });
      setDocxBlob(await docx.Packer.toBlob(document));
      setPct(100);
    } catch (e) { f.setError(`Conversion failed: ${String((e as Error).message || e).slice(0, 160)}`); }
    setBusy(false);
  };
  const words = pages ? pages.join(' ').trim().split(/\s+/).filter(Boolean).length : 0;
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {!f.file ? <DropZone accept="application/pdf,.pdf" onFiles={fs => f.load(fs[0])} label="Select a PDF to convert to Word" /> : (
        <>
          <FileInfoPanel file={f.file} info={f.info} onRemove={() => { f.reset(); setPages(null); setDocxBlob(null); }} />
          {!docxBlob && !busy && <Btn onClick={run} className="w-full py-4 text-base">Convert to Word (.docx) →</Btn>}
          {busy && <Progress value={pct} label="Extracting text and building document…" />}
        </>
      )}
      {f.error && <ErrorBox msg={f.error} />}
      {docxBlob && pages && f.file && (
        <ResultPanel title="Word document ready" bytes={docxBlob.size} onDownload={() => download(docxBlob, `${base(f.file!.name)}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')} onReset={() => { f.reset(); setPages(null); setDocxBlob(null); }} fileName={`${base(f.file.name)}.docx`}>
          <div className="grid grid-cols-3 gap-3 mt-4"><StatBox label="Pages" value={pages.length} /><StatBox label="Words extracted" value={words.toLocaleString()} /><StatBox label="Characters" value={pages.join('').length.toLocaleString()} /></div>
          <div className="flex gap-2 mt-4"><Btn variant="secondary" onClick={() => download(new Blob([pages.join('\n\n---- Page break ----\n\n')], { type: 'text/plain' }), `${base(f.file!.name)}.txt`, 'text/plain')}>Download as .txt</Btn><Btn variant="secondary" onClick={() => navigator.clipboard?.writeText(pages.join('\n\n'))}>Copy text</Btn></div>
          <details className="mt-4"><summary className="text-xs font-semibold text-slate-500 cursor-pointer">Preview extracted text</summary><pre className="mt-2 max-h-72 overflow-auto bg-slate-50 rounded-xl p-4 text-xs whitespace-pre-wrap text-slate-700">{pages.slice(0, 3).join('\n\n— — —\n\n').slice(0, 6000)}{pages.length > 3 ? '\n\n… (more pages in the download)' : ''}</pre></details>
          <p className="text-xs text-slate-500 mt-3">Text flow, headings and page breaks are reconstructed. Fonts, images and exact layout cannot be recovered from a PDF in the browser.</p>
        </ResultPanel>
      )}
    </div>
  );
};

// ---------- PDF To JPG ----------
export const PdfToJpg: React.FC = () => {
  const f = usePdfFile();
  const [dpi, setDpi] = useState(150);
  const [fmt, setFmt] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [quality, setQuality] = useState(0.9);
  const [imgs, setImgs] = useState<{ url: string; blob: Blob; page: number; width: number; height: number }[]>([]);
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!f.buf) return; setBusy(true); setImgs([]); f.setError('');
    try { const r = await renderPages(f.buf, { scale: dpi / 72, quality, type: fmt, onProgress: (d, t) => setPct((d / t) * 100) }); setImgs(r.map(i => ({ ...i, url: URL.createObjectURL(i.blob) }))); }
    catch (e) { f.setError(`Rendering failed: ${String((e as Error).message || e).slice(0, 160)}`); }
    setBusy(false);
  };
  const ext = fmt === 'image/png' ? 'png' : 'jpg';
  const all = () => imgs.forEach((i, n) => setTimeout(() => download(i.blob, `${base(f.file!.name)}-page-${i.page}.${ext}`, fmt), n * 200));
  const total = imgs.reduce((a, i) => a + i.blob.size, 0);
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {!f.file ? <DropZone accept="application/pdf,.pdf" onFiles={fs => f.load(fs[0])} label="Select a PDF to convert to images" /> : (
        <>
          <FileInfoPanel file={f.file} info={f.info} onRemove={() => { f.reset(); setImgs([]); }} />
          {imgs.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold text-slate-700 block mb-1">Resolution</label><div className="flex gap-1">{[72, 150, 200, 300].map(d => <button key={d} type="button" onClick={() => setDpi(d)} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${dpi === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{d} dpi</button>)}</div><p className="text-xs text-slate-500 mt-1">{f.info?.pageSizes[0] ? `${Math.round(f.info.pageSizes[0].w / 72 * dpi)} × ${Math.round(f.info.pageSizes[0].h / 72 * dpi)} px per page` : ''}</p></div>
                <div><label className="text-sm font-semibold text-slate-700 block mb-1">Format</label><div className="flex gap-1">{([['image/jpeg', 'JPG'], ['image/png', 'PNG']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setFmt(v)} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${fmt === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{l}</button>)}</div><p className="text-xs text-slate-500 mt-1">{fmt === 'image/png' ? 'Lossless, larger files, transparency' : 'Smaller files, best for photos/scans'}</p></div>
                {fmt === 'image/jpeg' && <div><label className="text-sm font-semibold text-slate-700 block mb-1">JPG quality {Math.round(quality * 100)}%</label><input aria-label="JPG quality" type="range" min={0.5} max={1} step={0.05} value={quality} onChange={e => setQuality(Number(e.target.value))} className="w-full accent-indigo-600 mt-2" /></div>}
              </div>
              {busy ? <Progress value={pct} label={`Rendering pages at ${dpi} dpi…`} /> : <Btn onClick={run} className="w-full py-4 text-base">Convert {f.info?.pages || ''} page{f.info?.pages === 1 ? '' : 's'} to {ext.toUpperCase()} →</Btn>}
            </div>
          )}
        </>
      )}
      {f.error && <ErrorBox msg={f.error} />}
      {imgs.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 className="font-bold text-slate-900">✓ {imgs.length} image{imgs.length === 1 ? '' : 's'} ready</h3><p className="text-xs text-slate-500">{imgs[0].width} × {imgs[0].height} px · {fmtBytes(total)} total</p></div><div className="flex gap-2"><Btn onClick={all}>⬇ Download all</Btn><Btn variant="secondary" onClick={() => setImgs([])}>Change settings</Btn></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{imgs.map(i => <div key={i.page} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50"><img src={i.url} alt={`Page ${i.page}`} className="w-full h-auto" loading="lazy" /><div className="flex items-center justify-between px-3 py-2 text-xs"><span className="text-slate-600">Page {i.page} · {fmtBytes(i.blob.size)}</span><button type="button" onClick={() => download(i.blob, `${base(f.file!.name)}-page-${i.page}.${ext}`, fmt)} className="font-semibold text-indigo-600">Save</button></div></div>)}</div>
        </div>
      )}
    </div>
  );
};

// ---------- JPG To PDF ----------
export const JpgToPdf: React.FC = () => {
  const [files, setFiles] = useState<{ file: File; url: string; w: number; h: number }[]>([]);
  const [size, setSize] = useState('A4');
  const [orient, setOrient] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [fit, setFit] = useState<'fit' | 'fill' | 'original'>('fit');
  const [margin, setMargin] = useState(20);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState('');
  const add = async (fs: File[]) => {
    const loaded = await Promise.all(fs.filter(f => /^image\//.test(f.type)).map(f => new Promise<{ file: File; url: string; w: number; h: number }>(res => { const url = URL.createObjectURL(f); const im = new Image(); im.onload = () => res({ file: f, url, w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ file: f, url, w: 0, h: 0 }); im.src = url; })));
    setFiles(p => [...p, ...loaded]); setOut(null);
  };
  const move = (i: number, d: -1 | 1) => setFiles(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toJpegBytes = (file: File, w: number, h: number): Promise<{ bytes: Uint8Array; png: boolean }> => new Promise((res, rej) => {
    if (file.type === 'image/jpeg' || file.type === 'image/png') { file.arrayBuffer().then(b => res({ bytes: new Uint8Array(b), png: file.type === 'image/png' })); return; }
    const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = w || im.naturalWidth; c.height = h || im.naturalHeight; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0); c.toBlob(b => b ? b.arrayBuffer().then(ab => res({ bytes: new Uint8Array(ab), png: false })) : rej(new Error('convert')), 'image/jpeg', 0.92); }; im.onerror = rej; im.src = URL.createObjectURL(file);
  });
  const run = async () => {
    setBusy(true); setErr(''); setPct(0);
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        const it = files[i]; const { bytes, png } = await toJpegBytes(it.file, it.w, it.h);
        const img = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const landscape = orient === 'landscape' || (orient === 'auto' && img.width > img.height);
        let [pw, ph] = fit === 'original' ? [img.width * 0.75 + margin * 2, img.height * 0.75 + margin * 2] : (PAGE_SIZES[size] || PAGE_SIZES.A4);
        if (fit !== 'original' && landscape) [pw, ph] = [ph, pw];
        const page = doc.addPage([pw, ph]);
        const availW = pw - margin * 2, availH = ph - margin * 2;
        let dw: number, dh: number;
        if (fit === 'fill') { const s = Math.max(availW / img.width, availH / img.height); dw = img.width * s; dh = img.height * s; }
        else if (fit === 'original') { dw = img.width * 0.75; dh = img.height * 0.75; }
        else { const s = Math.min(availW / img.width, availH / img.height); dw = img.width * s; dh = img.height * s; }
        page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
        setPct(((i + 1) / files.length) * 100);
      }
      doc.setProducer('SEO Audit Tool PDF Tools');
      setOut(await doc.save());
    } catch (e) { setErr(`Could not build PDF: ${String((e as Error).message || e).slice(0, 160)}`); }
    setBusy(false);
  };
  const total = files.reduce((a, f) => a + f.file.size, 0);
  return (
    <div className="space-y-5">
      <PrivacyNote />
      <DropZone accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp" multiple onFiles={add} label={files.length ? 'Add more images' : 'Select JPG / PNG / WebP images'} hint="Multiple images become pages in order" compact={files.length > 0} />
      {files.length > 0 && !out && (
        <>
          <div className="grid grid-cols-3 gap-3"><StatBox label="Images" value={files.length} /><StatBox label="Total size" value={fmtBytes(total)} /><StatBox label="Largest" value={`${Math.max(...files.map(f => f.w))} × ${Math.max(...files.map(f => f.h))} px`} /></div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">{files.map((f, i) => <div key={i} className="relative rounded-lg border border-slate-200 overflow-hidden bg-white group"><img src={f.url} alt="" className="w-full aspect-[3/4] object-cover" /><span className="absolute top-1 left-1 bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded">{i + 1}</span><div className="absolute inset-x-0 bottom-0 bg-slate-900/70 flex justify-around py-1 opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" onClick={() => move(i, -1)} className="text-white text-xs">←</button><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-red-300 text-xs">✕</button><button type="button" onClick={() => move(i, 1)} className="text-white text-xs">→</button></div></div>)}</div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="grid sm:grid-cols-4 gap-3">
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Page size</label><select aria-label="Page size" value={size} onChange={e => setSize(e.target.value)} disabled={fit === 'original'} className="w-full p-2.5 rounded-lg border border-slate-300 text-sm bg-white">{Object.keys(PAGE_SIZES).map(s => <option key={s}>{s}</option>)}</select></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Orientation</label><select aria-label="Orientation" value={orient} onChange={e => setOrient(e.target.value as typeof orient)} className="w-full p-2.5 rounded-lg border border-slate-300 text-sm bg-white"><option value="auto">Auto (per image)</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Image fit</label><select aria-label="Image fit" value={fit} onChange={e => setFit(e.target.value as typeof fit)} className="w-full p-2.5 rounded-lg border border-slate-300 text-sm bg-white"><option value="fit">Fit inside page</option><option value="fill">Fill page (crop)</option><option value="original">Page = image size</option></select></div>
              <div><label className="text-xs font-semibold text-slate-600 block mb-1">Margin {margin}pt</label><input aria-label="Margin in points" type="range" min={0} max={72} value={margin} onChange={e => setMargin(Number(e.target.value))} className="w-full accent-indigo-600 mt-2" /></div>
            </div>
            {busy ? <Progress value={pct} label="Embedding images…" /> : <Btn onClick={run} className="w-full py-4 text-base">Create PDF from {files.length} image{files.length === 1 ? '' : 's'} →</Btn>}
          </div>
        </>
      )}
      {err && <ErrorBox msg={err} />}
      {out && <ResultPanel title={`PDF created · ${files.length} page${files.length === 1 ? '' : 's'}`} bytes={out.byteLength} before={total} onDownload={() => download(out, 'images.pdf')} onReset={() => { setFiles([]); setOut(null); }} />}
    </div>
  );
};

// ---------- PowerPoint To PDF (slides from text) ----------
export const PptToPdf: React.FC = () => {
  const [text, setText] = useState('# Welcome\n- First point\n- Second point\n\n# Agenda\n- Introduction\n- Key findings\n- Next steps');
  const [ratio, setRatio] = useState<'16:9' | '4:3'>('16:9');
  const [theme, setTheme] = useState<'light' | 'dark' | 'indigo'>('indigo');
  const [out, setOut] = useState<{ bytes: Uint8Array; pages: number } | null>(null);
  const [err, setErr] = useState('');
  const [fileNote, setFileNote] = useState('');
  const slides = useMemo(() => text.split(/\n(?=# )|\n{2,}(?=\S)/).map(s => s.trim()).filter(Boolean), [text]);
  const onFile = async (fs: File[]) => {
    const f = fs[0];
    if (/\.pptx$/i.test(f.name)) {
      try {
        // Extract slide text from pptx (zip) — reuse DOCX zip reader approach on ppt/slides/slideN.xml
        const buf = await readFile(f); const bytes = new Uint8Array(buf); const view = new DataView(buf); const dec = new TextDecoder();
        let eocd = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        if (eocd < 0) throw new Error('Invalid pptx');
        const n = view.getUint16(eocd + 10, true); let ptr = view.getUint32(eocd + 16, true); const entries: { name: string; off: number; comp: number; csize: number }[] = [];
        for (let i = 0; i < n; i++) { if (view.getUint32(ptr, true) !== 0x02014b50) break; const comp = view.getUint16(ptr + 10, true), csize = view.getUint32(ptr + 20, true), nlen = view.getUint16(ptr + 28, true), elen = view.getUint16(ptr + 30, true), clen = view.getUint16(ptr + 32, true), off = view.getUint32(ptr + 42, true); entries.push({ name: dec.decode(bytes.slice(ptr + 46, ptr + 46 + nlen)), off, comp, csize }); ptr += 46 + nlen + elen + clen; }
        const slideEntries = entries.filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a, b) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
        const outSlides: string[] = [];
        for (const e of slideEntries) {
          const lnlen = view.getUint16(e.off + 26, true), lelen = view.getUint16(e.off + 28, true); const raw = bytes.slice(e.off + 30 + lnlen + lelen, e.off + 30 + lnlen + lelen + e.csize);
          const xml = e.comp === 0 ? dec.decode(raw) : await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
          const paras = Array.from(xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)).map(m => Array.from(m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)).map(x => x[1]).join('')).filter(Boolean);
          if (paras.length) outSlides.push(`# ${paras[0]}\n${paras.slice(1).map(p => '- ' + p).join('\n')}`);
        }
        setText(outSlides.join('\n\n')); setFileNote(`${slideEntries.length} slides extracted from ${f.name}`);
      } catch { setErr('Could not read this .pptx. Paste your slide text instead.'); }
    } else { setText(await f.text()); setFileNote(f.name); }
  };
  const run = async () => {
    try {
      setErr('');
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const [w, h] = ratio === '16:9' ? [960, 540] : [720, 540];
      const colors = { light: { bg: rgb(1, 1, 1), title: rgb(0.1, 0.1, 0.2), text: rgb(0.2, 0.2, 0.25), accent: rgb(0.39, 0.4, 0.95) }, dark: { bg: rgb(0.08, 0.09, 0.15), title: rgb(1, 1, 1), text: rgb(0.85, 0.87, 0.92), accent: rgb(0.51, 0.55, 0.97) }, indigo: { bg: rgb(0.97, 0.97, 1), title: rgb(0.19, 0.18, 0.5), text: rgb(0.2, 0.2, 0.3), accent: rgb(0.39, 0.4, 0.95) } }[theme];
      slides.forEach((s, idx) => {
        const page = doc.addPage([w, h]); page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: colors.bg }); page.drawRectangle({ x: 0, y: h - 8, width: w, height: 8, color: colors.accent });
        const lines = s.split('\n'); const title = toWinAnsi(lines[0].replace(/^#\s*/, '')); const body = lines.slice(1);
        page.drawText(title, { x: 56, y: h - 96, size: 34, font: bold, color: colors.title });
        let y = h - 160;
        body.forEach(b => { const isBullet = /^\s*[-*•]/.test(b); const t = toWinAnsi(b.replace(/^\s*[-*•]\s*/, '')); for (const l of wrapText(t, font, 20, w - 140)) { if (y < 60) return; if (isBullet) page.drawCircle({ x: 66, y: y + 7, size: 4, color: colors.accent }); page.drawText(l, { x: isBullet ? 84 : 56, y, size: 20, font, color: colors.text }); y -= 34; } });
        page.drawText(`${idx + 1} / ${slides.length}`, { x: w - 80, y: 24, size: 11, font, color: colors.text });
      });
      doc.setProducer('SEO Audit Tool PDF Tools');
      setOut({ bytes: await doc.save(), pages: slides.length });
    } catch (e) { setErr(String((e as Error).message || e)); }
  };
  return (
    <div className="space-y-5">
      <PrivacyNote />
      <div className="grid lg:grid-cols-[1fr_260px] gap-4">
        <textarea aria-label="Slide text" value={text} onChange={e => { setText(e.target.value); setOut(null); }} rows={14} className="w-full p-4 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" />
        <div className="space-y-3"><DropZone accept=".pptx,.txt,.md" onFiles={onFile} label="Upload .pptx or .txt" hint="Slide text is extracted locally" compact />{fileNote && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2">{fileNote}</p>}<div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">Format: start each slide with <code># Title</code>, add bullets with <code>- item</code>, separate slides with a blank line.</div></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap gap-4"><div><p className="text-xs font-semibold text-slate-600 mb-1">Aspect ratio</p><div className="flex gap-1">{(['16:9', '4:3'] as const).map(r => <button key={r} type="button" onClick={() => setRatio(r)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${ratio === r ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{r}</button>)}</div></div><div><p className="text-xs font-semibold text-slate-600 mb-1">Theme</p><div className="flex gap-1">{(['light', 'dark', 'indigo'] as const).map(t => <button key={t} type="button" onClick={() => setTheme(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${theme === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{t}</button>)}</div></div><div className="ml-auto"><StatBox label="Slides" value={slides.length} /></div></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{slides.slice(0, 8).map((s, i) => <div key={i} className={`rounded-lg border p-2 text-[10px] leading-tight overflow-hidden ${theme === 'dark' ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-white text-slate-700 border-slate-200'}`} style={{ aspectRatio: ratio === '16:9' ? '16/9' : '4/3' }}><div className="h-1 bg-indigo-500 mb-1 rounded" /><p className="font-bold truncate">{s.split('\n')[0].replace(/^#\s*/, '')}</p>{s.split('\n').slice(1, 4).map((l, j) => <p key={j} className="truncate">{l}</p>)}</div>)}</div>
        <Btn onClick={run} disabled={!slides.length} className="w-full py-4 text-base">Create {slides.length}-slide PDF →</Btn>
      </div>
      {err && <ErrorBox msg={err} />}
      {out && <ResultPanel title={`Presentation PDF · ${out.pages} slides`} bytes={out.bytes.byteLength} onDownload={() => download(out.bytes, 'presentation.pdf')} onReset={() => setOut(null)} />}
    </div>
  );
};

// ---------- Excel To PDF (CSV / pasted cells → table) ----------
export const ExcelToPdf: React.FC = () => {
  const [raw, setRaw] = useState('Product,Units,Price,Total\nWidget A,120,4.50,540.00\nWidget B,75,9.99,749.25\nWidget C,200,2.25,450.00');
  const [title, setTitle] = useState('Sheet 1');
  const [landscape, setLandscape] = useState(true);
  const [header, setHeader] = useState(true);
  const [fileNote, setFileNote] = useState('');
  const [out, setOut] = useState<{ bytes: Uint8Array; pages: number } | null>(null);
  const [err, setErr] = useState('');
  const rows = useMemo(() => {
    const delim = raw.includes('\t') ? '\t' : raw.includes(';') && !raw.includes(',') ? ';' : ',';
    return raw.split(/\r?\n/).filter(l => l.trim()).map(l => { const cells: string[] = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === delim && !q) { cells.push(cur); cur = ''; } else cur += ch; } cells.push(cur); return cells.map(c => c.trim()); });
  }, [raw]);
  const cols = Math.max(0, ...rows.map(r => r.length));
  const onFile = async (fs: File[]) => {
    const f = fs[0];
    if (/\.xlsx$/i.test(f.name)) {
      try {
        const buf = await readFile(f); const bytes = new Uint8Array(buf); const view = new DataView(buf); const dec = new TextDecoder();
        let eocd = -1; for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        if (eocd < 0) throw new Error('zip');
        const n = view.getUint16(eocd + 10, true); let ptr = view.getUint32(eocd + 16, true); const entries: Record<string, { off: number; comp: number; csize: number }> = {};
        for (let i = 0; i < n; i++) { if (view.getUint32(ptr, true) !== 0x02014b50) break; const comp = view.getUint16(ptr + 10, true), csize = view.getUint32(ptr + 20, true), nlen = view.getUint16(ptr + 28, true), elen = view.getUint16(ptr + 30, true), clen = view.getUint16(ptr + 32, true), off = view.getUint32(ptr + 42, true); entries[dec.decode(bytes.slice(ptr + 46, ptr + 46 + nlen))] = { off, comp, csize }; ptr += 46 + nlen + elen + clen; }
        const read = async (name: string) => { const e = entries[name]; if (!e) return ''; const lnlen = view.getUint16(e.off + 26, true), lelen = view.getUint16(e.off + 28, true); const r = bytes.slice(e.off + 30 + lnlen + lelen, e.off + 30 + lnlen + lelen + e.csize); return e.comp === 0 ? dec.decode(r) : await new Response(new Blob([r]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
        const shared = Array.from((await read('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)).map(m => Array.from(m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)).map(x => x[1]).join(''));
        const sheet = await read('xl/worksheets/sheet1.xml');
        const grid: Record<number, Record<number, string>> = {}; let maxC = 0;
        for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
          const col = m[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1; const row = Number(m[2]) - 1; const isStr = /t="s"/.test(m[3]); const v = (m[4].match(/<v>([^<]*)<\/v>/) || [])[1] ?? (m[4].match(/<t[^>]*>([^<]*)<\/t>/) || [])[1] ?? '';
          (grid[row] ??= {})[col] = isStr ? shared[Number(v)] ?? '' : v; maxC = Math.max(maxC, col);
        }
        const lines = Object.keys(grid).map(Number).sort((a, b) => a - b).map(r => Array.from({ length: maxC + 1 }, (_, c) => `"${(grid[r][c] ?? '').replace(/"/g, '""')}"`).join(','));
        setRaw(lines.join('\n')); setTitle(base(f.name)); setFileNote(`${lines.length} rows × ${maxC + 1} columns read from ${f.name} (first sheet)`);
      } catch { setErr('Could not parse this .xlsx. Save as CSV or paste the cells.'); }
    } else { setRaw(await f.text()); setTitle(base(f.name)); setFileNote(f.name); }
  };
  const run = async () => {
    try {
      setErr('');
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const doc = await PDFDocument.create(); const font = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      let [w, h] = PAGE_SIZES.A4; if (landscape) [w, h] = [h, w];
      const m = 40; const fs = cols > 8 ? 7 : cols > 5 ? 8 : 9; const rowH = fs * 2.2; const availW = w - m * 2;
      const widths = Array.from({ length: cols }, (_, c) => Math.max(30, ...rows.map(r => bold.widthOfTextAtSize(toWinAnsi(r[c] || ''), fs) + 10)));
      const scale = Math.min(1, availW / widths.reduce((a, b) => a + b, 0)); const cw = widths.map(x => x * scale);
      let page = doc.addPage([w, h]); let y = h - m; let pageNo = 1;
      const drawHeader = () => { page.drawText(toWinAnsi(title), { x: m, y: y - 14, size: 14, font: bold, color: rgb(0.1, 0.1, 0.2) }); y -= 30; };
      const drawRow = (r: string[], i: number, isHead: boolean) => { let x = m; if (isHead) page.drawRectangle({ x: m, y: y - rowH, width: cw.reduce((a, b) => a + b, 0), height: rowH, color: rgb(0.39, 0.4, 0.95) }); else if (i % 2 === 0) page.drawRectangle({ x: m, y: y - rowH, width: cw.reduce((a, b) => a + b, 0), height: rowH, color: rgb(0.96, 0.96, 0.99) }); r.forEach((cell, c) => { let t = toWinAnsi(cell || ''); while ((isHead ? bold : font).widthOfTextAtSize(t, fs) > cw[c] - 8 && t.length > 1) t = t.slice(0, -2) + '…'; const num = /^-?[\d,.]+%?$/.test(cell); page.drawText(t, { x: num ? x + cw[c] - 4 - font.widthOfTextAtSize(t, fs) : x + 4, y: y - rowH + fs * 0.7, size: fs, font: isHead ? bold : font, color: isHead ? rgb(1, 1, 1) : rgb(0.15, 0.15, 0.2) }); x += cw[c]; }); page.drawLine({ start: { x: m, y: y - rowH }, end: { x: m + cw.reduce((a, b) => a + b, 0), y: y - rowH }, thickness: 0.5, color: rgb(0.85, 0.85, 0.9) }); y -= rowH; };
      drawHeader(); if (header && rows[0]) drawRow(rows[0], 0, true);
      rows.slice(header ? 1 : 0).forEach((r, i) => { if (y - rowH < m + 20) { page.drawText(`Page ${pageNo}`, { x: w / 2 - 15, y: m / 2, size: 8, font, color: rgb(0.5, 0.5, 0.5) }); page = doc.addPage([w, h]); y = h - m; pageNo++; drawHeader(); if (header && rows[0]) drawRow(rows[0], 0, true); } drawRow(r, i, false); });
      page.drawText(`Page ${pageNo}`, { x: w / 2 - 15, y: m / 2, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
      doc.setProducer('SEO Audit Tool PDF Tools'); doc.setTitle(title);
      setOut({ bytes: await doc.save(), pages: doc.getPageCount() });
    } catch (e) { setErr(String((e as Error).message || e)); }
  };
  return (
    <div className="space-y-5">
      <PrivacyNote />
      <div className="grid lg:grid-cols-[1fr_260px] gap-4">
        <div className="space-y-3"><input aria-label="Table title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Table title" className="w-full p-3 rounded-xl border border-slate-300 text-sm" /><textarea value={raw} onChange={e => { setRaw(e.target.value); setOut(null); }} rows={10} placeholder="Paste cells from Excel/Sheets (tab-separated) or CSV…" className="w-full p-4 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" /></div>
        <div className="space-y-3"><DropZone accept=".xlsx,.csv,.tsv,.txt" onFiles={onFile} label="Upload .xlsx or .csv" hint="First sheet is read locally" compact />{fileNote && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2">{fileNote}</p>}</div>
      </div>
      <div className="grid grid-cols-3 gap-3"><StatBox label="Rows" value={rows.length} /><StatBox label="Columns" value={cols} /><StatBox label="Cells" value={rows.reduce((a, r) => a + r.length, 0)} /></div>
      {rows.length > 0 && <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto"><table className="text-xs w-full"><tbody>{rows.slice(0, 6).map((r, i) => <tr key={i} className={i === 0 && header ? 'bg-indigo-600 text-white font-semibold' : i % 2 ? 'bg-slate-50' : ''}>{Array.from({ length: cols }, (_, c) => <td key={c} className="px-3 py-1.5 border-r border-slate-100 whitespace-nowrap">{r[c] || ''}</td>)}</tr>)}</tbody></table>{rows.length > 6 && <p className="text-[11px] text-slate-400 px-3 py-1.5">… {rows.length - 6} more rows</p>}</div>}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center gap-5"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={header} onChange={e => setHeader(e.target.checked)} className="accent-indigo-600" /> First row is a header</label><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={landscape} onChange={e => setLandscape(e.target.checked)} className="accent-indigo-600" /> Landscape A4</label><Btn onClick={run} disabled={!rows.length} className="ml-auto">Convert to PDF →</Btn></div>
      {err && <ErrorBox msg={err} />}
      {out && <ResultPanel title={`Table PDF · ${out.pages} page${out.pages === 1 ? '' : 's'}`} bytes={out.bytes.byteLength} onDownload={() => download(out.bytes, `${title || 'spreadsheet'}.pdf`)} onReset={() => setOut(null)} />}
    </div>
  );
};
