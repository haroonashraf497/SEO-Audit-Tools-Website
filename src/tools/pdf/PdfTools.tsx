/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from 'react';
import { PrivacyNote, DropZone, Progress, ErrorBox, Btn, StatBox, FileInfoPanel, Thumbnails, ResultPanel, usePdfFile } from './ui';
import { loadPdfLib, loadPdfJs, fmtBytes, readFile, download, inspectPdf, parseRanges, compressToTarget, renderPages, imagesToPdf, type PdfInfo, type PdfDoc } from './engine';

const base = (name: string) => name.replace(/\.pdf$/i, '');

// ---------- Merge PDF ----------
export const MergePdf: React.FC = () => {
  const [items, setItems] = useState<{ file: File; buf: ArrayBuffer; info: PdfInfo | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [err, setErr] = useState('');
  const add = async (files: File[]) => {
    setErr(''); setOut(null);
    const loaded = await Promise.all(files.map(async file => { const buf = await readFile(file); let info: PdfInfo | null = null; try { info = await inspectPdf(buf); } catch { /* skip */ } return { file, buf, info }; }));
    setItems(prev => [...prev, ...loaded]);
  };
  const move = (i: number, d: -1 | 1) => setItems(prev => { const n = [...prev]; const j = i + d; if (j < 0 || j >= n.length) return prev; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const merge = async () => {
    setBusy(true); setErr(''); setPct(0);
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const src = await PDFDocument.load(items[i].buf, { ignoreEncryption: true });
        const pages = await doc.copyPages(src, src.getPageIndices());
        pages.forEach((p: any) => doc.addPage(p));
        setPct(((i + 1) / items.length) * 100);
      }
      doc.setProducer('SEO Audit Tool PDF Tools'); doc.setCreator('SEO Audit Tool');
      setOut(await doc.save());
    } catch (e) { setErr(`Merge failed: ${String((e as Error).message || e).slice(0, 160)}. Encrypted files must be unlocked first.`); }
    setBusy(false);
  };
  const totalPages = items.reduce((a, i) => a + (i.info?.pages || 0), 0);
  const totalSize = items.reduce((a, i) => a + i.file.size, 0);
  return (
    <div className="space-y-5">
      <PrivacyNote />
      <DropZone accept="application/pdf,.pdf" multiple onFiles={add} label={items.length ? 'Add more PDF files' : 'Select PDF files to merge'} hint="Drop 2 or more PDFs · any size" compact={items.length > 0} />
      {items.length > 0 && !out && (
        <>
          <div className="grid grid-cols-3 gap-3"><StatBox label="Files" value={items.length} /><StatBox label="Total pages" value={totalPages} /><StatBox label="Total size" value={fmtBytes(totalSize)} /></div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="font-semibold text-slate-800 truncate text-sm">{it.file.name}</p><p className="text-xs text-slate-500">{it.info ? `${it.info.pages} pages · ` : ''}{fmtBytes(it.file.size)}{it.info?.encrypted ? ' · 🔒 encrypted' : ''}</p></div>
                <div className="flex gap-1"><button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700">↑</button><button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700">↓</button><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600">×</button></div>
              </div>
            ))}
          </div>
          {busy ? <Progress value={pct} label="Merging documents…" /> : <Btn onClick={merge} disabled={items.length < 2} className="w-full py-4 text-base">Merge {items.length} PDF{items.length === 1 ? '' : 's'} →</Btn>}
          {items.length < 2 && <p className="text-xs text-slate-500 text-center">Add at least two files to merge.</p>}
        </>
      )}
      {err && <ErrorBox msg={err} />}
      {out && <ResultPanel title="PDFs merged successfully" bytes={out.byteLength} onDownload={() => download(out, 'merged.pdf')} onReset={() => { setItems([]); setOut(null); }} fileName="merged.pdf"><p className="text-sm text-slate-600 mt-4">{items.length} files · {totalPages} pages combined in order shown.</p></ResultPanel>}
    </div>
  );
};

// ---------- Split PDF ----------
export const SplitPdf: React.FC = () => {
  const f = usePdfFile();
  const [mode, setMode] = useState<'range' | 'every' | 'chunks'>('range');
  const [ranges, setRanges] = useState('1-2');
  const [chunk, setChunk] = useState(2);
  const [busy, setBusy] = useState(false);
  const [outs, setOuts] = useState<{ name: string; bytes: Uint8Array; pages: string }[]>([]);
  const run = async () => {
    if (!f.buf || !f.info) return; setBusy(true); setOuts([]); f.setError('');
    try {
      const { PDFDocument } = await loadPdfLib();
      const src = await PDFDocument.load(f.buf, { ignoreEncryption: true });
      const total = src.getPageCount();
      const groups: number[][] = mode === 'range' ? [parseRanges(ranges, total)] : mode === 'every' ? Array.from({ length: total }, (_, i) => [i]) : Array.from({ length: Math.ceil(total / chunk) }, (_, g) => Array.from({ length: Math.min(chunk, total - g * chunk) }, (_, i) => g * chunk + i));
      if (!groups[0]?.length) throw new Error('No valid pages selected. Use a format like 1-3,5,8-10.');
      const res: typeof outs = [];
      for (let g = 0; g < groups.length; g++) {
        const doc = await PDFDocument.create();
        const pages = await doc.copyPages(src, groups[g]);
        pages.forEach((p: any) => doc.addPage(p));
        const label = groups[g].length === 1 ? `page-${groups[g][0] + 1}` : `pages-${groups[g][0] + 1}-${groups[g][groups[g].length - 1] + 1}`;
        res.push({ name: `${base(f.file!.name)}-${label}.pdf`, bytes: await doc.save(), pages: groups[g].map(i => i + 1).join(', ') });
      }
      setOuts(res);
    } catch (e) { f.setError(String((e as Error).message || e)); }
    setBusy(false);
  };
  const downloadAll = () => outs.forEach((o, i) => setTimeout(() => download(o.bytes, o.name), i * 250));
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {!f.file ? <DropZone accept="application/pdf,.pdf" onFiles={fs => f.load(fs[0])} label="Select a PDF to split" /> : (
        <>
          <FileInfoPanel file={f.file} info={f.info} onRemove={() => { f.reset(); setOuts([]); }} />
          {f.buf && <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500 uppercase mb-3">Pages</p><Thumbnails buf={f.buf} /></div>}
          {outs.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap gap-2">{([['range', 'Extract page range'], ['every', 'Split every page'], ['chunks', 'Split into chunks']] as const).map(([m, l]) => <button key={m} type="button" onClick={() => setMode(m)} className={`px-4 py-2 rounded-full text-sm font-semibold ${mode === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{l}</button>)}</div>
              {mode === 'range' && <div><label className="text-sm font-semibold text-slate-700 block mb-1">Pages to extract (e.g. 1-3,5,8-10)</label><input value={ranges} onChange={e => setRanges(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm font-mono" /><p className="text-xs text-slate-500 mt-1">{f.info ? `${parseRanges(ranges, f.info.pages).length} of ${f.info.pages} pages selected` : ''}</p></div>}
              {mode === 'chunks' && <div><label className="text-sm font-semibold text-slate-700 block mb-1">Pages per file</label><input type="number" min={1} value={chunk} onChange={e => setChunk(Math.max(1, Number(e.target.value)))} className="w-32 p-3 rounded-xl border border-slate-300 text-sm" /><p className="text-xs text-slate-500 mt-1">{f.info ? `Creates ${Math.ceil(f.info.pages / chunk)} files` : ''}</p></div>}
              {mode === 'every' && <p className="text-sm text-slate-600">Creates {f.info?.pages || 0} single-page PDF files.</p>}
              <Btn onClick={run} disabled={busy} className="w-full py-4 text-base">{busy ? 'Splitting…' : 'Split PDF →'}</Btn>
            </div>
          )}
        </>
      )}
      {f.error && <ErrorBox msg={f.error} />}
      {outs.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h3 className="font-bold text-slate-900">✓ {outs.length} file{outs.length === 1 ? '' : 's'} ready</h3><div className="flex gap-2"><Btn onClick={downloadAll}>⬇ Download all</Btn><Btn variant="secondary" onClick={() => setOuts([])}>Back</Btn></div></div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">{outs.map(o => <div key={o.name} className="py-2.5 flex items-center justify-between gap-3 text-sm"><div className="min-w-0"><p className="font-semibold text-slate-800 truncate">{o.name}</p><p className="text-xs text-slate-500">Pages {o.pages} · {fmtBytes(o.bytes.byteLength)}</p></div><button type="button" onClick={() => download(o.bytes, o.name)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex-shrink-0">Download</button></div>)}</div>
        </div>
      )}
    </div>
  );
};

// ---------- Rotate PDF ----------
export const RotatePdf: React.FC = () => {
  const f = usePdfFile();
  const [rot, setRot] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const applyAll = (deg: number) => { if (!f.info) return; setRot(prev => { const n = { ...prev }; for (let i = 0; i < f.info!.pages; i++) n[i] = ((n[i] || 0) + deg + 360) % 360; return n; }); };
  const applySel = (deg: number) => setRot(prev => { const n = { ...prev }; selected.forEach(i => { n[i] = ((n[i] || 0) + deg + 360) % 360; }); return n; });
  const run = async () => {
    if (!f.buf) return; setBusy(true);
    try {
      const { PDFDocument, degrees } = await loadPdfLib();
      const doc = await PDFDocument.load(f.buf, { ignoreEncryption: true });
      doc.getPages().forEach((p: any, i: number) => { const r = rot[i] || 0; if (r) p.setRotation(degrees((p.getRotation().angle + r) % 360)); });
      setOut(await doc.save());
    } catch (e) { f.setError(String((e as Error).message || e)); }
    setBusy(false);
  };
  const changed = Object.values(rot).filter(v => v).length;
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {!f.file ? <DropZone accept="application/pdf,.pdf" onFiles={fs => f.load(fs[0])} label="Select a PDF to rotate" /> : (
        <>
          <FileInfoPanel file={f.file} info={f.info} onRemove={() => { f.reset(); setRot({}); setSelected(new Set()); setOut(null); }} />
          {!out && f.buf && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-700 mr-2">All pages:</span>
                {[[-90, '↺ 90° left'], [90, '↻ 90° right'], [180, '↻ 180°']].map(([d, l]) => <button key={l} type="button" onClick={() => applyAll(d as number)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700">{l}</button>)}
                {selected.size > 0 && <><span className="text-sm font-semibold text-slate-700 ml-4 mr-2">Selected ({selected.size}):</span>{[[-90, '↺ 90°'], [90, '↻ 90°'], [180, '180°']].map(([d, l]) => <button key={l} type="button" onClick={() => applySel(d as number)} className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-sm font-semibold text-indigo-700">{l}</button>)}</>}
                <button type="button" onClick={() => setRot({})} className="ml-auto text-xs text-slate-500 hover:text-slate-800">Reset</button>
              </div>
              <p className="text-xs text-slate-500">Click pages to select them for individual rotation. {changed} page{changed === 1 ? '' : 's'} modified.</p>
              <Thumbnails buf={f.buf} selected={selected} onToggle={i => setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} rotations={rot} />
              <Btn onClick={run} disabled={busy || changed === 0} className="w-full py-4 text-base">{busy ? 'Rotating…' : `Apply rotation to ${changed} page${changed === 1 ? '' : 's'} →`}</Btn>
            </div>
          )}
        </>
      )}
      {f.error && <ErrorBox msg={f.error} />}
      {out && f.file && <ResultPanel title="Rotation applied" bytes={out.byteLength} before={f.file.size} onDownload={() => download(out, `${base(f.file!.name)}-rotated.pdf`)} onReset={() => { f.reset(); setRot({}); setOut(null); setSelected(new Set()); }} />}
    </div>
  );
};

// ---------- Lock PDF ----------
export const LockPdf: React.FC = () => {
  const f = usePdfFile();
  const [userPw, setUserPw] = useState('');
  const [ownerPw, setOwnerPw] = useState('');
  const [perm, setPerm] = useState({ printing: true, copying: false, modifying: false, annotating: true });
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const strength = useMemo(() => { const p = userPw; let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; if (p.length >= 12) s++; return s; }, [userPw]);
  const run = async () => {
    if (!f.buf || !userPw) return; setBusy(true); f.setError('');
    try {
      const pdfLib = await loadPdfLib();
      const doc = await pdfLib.PDFDocument.load(f.buf, { ignoreEncryption: true });
      // pdf-lib >=1.17 exposes encrypt(); guard for older builds
      const anyDoc = doc as unknown as { encrypt?: (o: Record<string, unknown>) => Promise<void> | void };
      if (typeof anyDoc.encrypt !== 'function') throw new Error('Encryption is not supported by the bundled PDF library version.');
      await anyDoc.encrypt({ userPassword: userPw, ownerPassword: ownerPw || userPw + '-owner', permissions: { printing: perm.printing ? 'highResolution' : undefined, copying: perm.copying, modifying: perm.modifying, annotating: perm.annotating, fillingForms: true, contentAccessibility: true, documentAssembly: perm.modifying } });
      setOut(await doc.save());
    } catch (e) { f.setError(`Could not encrypt: ${String((e as Error).message || e).slice(0, 200)}`); }
    setBusy(false);
  };
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {!f.file ? <DropZone accept="application/pdf,.pdf" onFiles={fs => f.load(fs[0])} label="Select a PDF to protect" /> : (
        <>
          <FileInfoPanel file={f.file} info={f.info} onRemove={() => { f.reset(); setOut(null); }} />
          {!out && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold text-slate-700 block mb-1">Open password (required)</label><div className="relative"><input type={show ? 'text' : 'password'} value={userPw} onChange={e => setUserPw(e.target.value)} className="w-full p-3 pr-16 rounded-xl border border-slate-300 text-sm" placeholder="Needed to open the file" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">{show ? 'Hide' : 'Show'}</button></div>
                  <div className="flex gap-1 mt-2">{[0, 1, 2, 3, 4].map(i => <span key={i} className={`h-1.5 flex-1 rounded ${i < strength ? (strength <= 2 ? 'bg-red-400' : strength <= 3 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'}`} />)}</div><p className="text-xs text-slate-500 mt-1">{userPw ? ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][strength] : 'Use 12+ characters with numbers and symbols'}</p></div>
                <div><label className="text-sm font-semibold text-slate-700 block mb-1">Owner password (optional)</label><input type={show ? 'text' : 'password'} value={ownerPw} onChange={e => setOwnerPw(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm" placeholder="Controls permission changes" /><p className="text-xs text-slate-500 mt-1">Lets you change restrictions later without the open password.</p></div>
              </div>
              <div><p className="text-sm font-semibold text-slate-700 mb-2">Permissions for readers</p><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{([['printing', 'Allow printing'], ['copying', 'Allow copying text'], ['modifying', 'Allow editing'], ['annotating', 'Allow comments/forms']] as const).map(([k, l]) => <label key={k} className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer ${perm[k] ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200'}`}><input type="checkbox" checked={perm[k]} onChange={e => setPerm({ ...perm, [k]: e.target.checked })} className="accent-indigo-600" />{l}</label>)}</div></div>
              <Btn onClick={run} disabled={busy || !userPw} className="w-full py-4 text-base">{busy ? 'Encrypting…' : '🔒 Lock PDF with AES-128 →'}</Btn>
            </div>
          )}
        </>
      )}
      {f.error && <ErrorBox msg={f.error} />}
      {out && f.file && <ResultPanel title="PDF locked and encrypted" bytes={out.byteLength} before={f.file.size} onDownload={() => download(out, `${base(f.file!.name)}-locked.pdf`)} onReset={() => { f.reset(); setOut(null); setUserPw(''); setOwnerPw(''); }}><p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-4">Store your password safely — there is no way to recover an encrypted PDF without it.</p></ResultPanel>}
    </div>
  );
};

// ---------- Unlock PDF ----------
export const UnlockPdf: React.FC = () => {
  const f = usePdfFile();
  const [pw, setPw] = useState('');
  const [out, setOut] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const run = async () => {
    if (!f.buf) return; setBusy(true); f.setError(''); setNote('');
    try {
      const { PDFDocument } = await loadPdfLib();
      // Step 1: permission-only (owner password) restrictions - copy pages into a fresh, unencrypted document
      let doc: PdfDoc | null = null;
      try { doc = await PDFDocument.load(f.buf, { ignoreEncryption: true }); } catch { doc = null; }
      let done = false;
      if (doc) {
        try {
          const clean = await PDFDocument.create();
          const pages = await clean.copyPages(doc, doc.getPageIndices());
          pages.forEach((p: any) => clean.addPage(p));
          const bytes = await clean.save();
          // Sanity check: the result must be readable without a password
          await PDFDocument.load(bytes);
          setOut(bytes); done = true;
          setNote(`Restrictions removed from ${doc.getPageCount()} pages. Printing, copying and editing are now allowed.`);
        } catch { done = false; }
      }
      // Step 2: open-password files - verify the password with pdf.js and rebuild the pages
      if (!done) {
        if (!pw) throw new Error('This PDF requires its open password. Enter the password and try again.');
        const pdfjs = await loadPdfJs();
        const src = await pdfjs.getDocument({ data: new Uint8Array(f.buf), password: pw }).promise; // throws on wrong password
        const total: number = src.numPages;
        const imgs = await renderPages(f.buf, { scale: 2, quality: 0.92, password: pw });
        setOut(await imagesToPdf(imgs));
        setNote(`Password verified (${total} pages). This file used strong encryption, so pages were rebuilt as high-resolution images; text is no longer selectable.`);
      }
    } catch (e) {
      const msg = String((e as Error).message || e);
      f.setError(/password/i.test(msg) ? (/incorrect|invalid/i.test(msg) ? 'Incorrect password. Please try again.' : msg) : `Unlock failed: ${msg.slice(0, 160)}`);
    }
    setBusy(false);
  };
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {!f.file ? <DropZone accept="application/pdf,.pdf" onFiles={fs => f.load(fs[0])} label="Select a protected PDF" /> : (
        <>
          <FileInfoPanel file={f.file} info={f.info} onRemove={() => { f.reset(); setOut(null); setPw(''); }} />
          {!out && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <div className={`rounded-xl p-4 text-sm ${f.info?.encrypted ? 'bg-amber-50 border border-amber-100 text-amber-800' : 'bg-slate-50 border border-slate-100 text-slate-600'}`}>{f.info?.encrypted ? '🔒 This PDF is encrypted. Permission-only restrictions can be removed directly; if it asks for a password to open, enter it below.' : 'This PDF does not appear to be encrypted. Running unlock will still strip any permission flags.'}</div>
              <div><label className="text-sm font-semibold text-slate-700 block mb-1">Open password (only if required)</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm" placeholder="Leave blank if the file opens without a password" /></div>
              <p className="text-xs text-slate-500">Only unlock documents you own or have permission to modify.</p>
              <Btn onClick={run} disabled={busy} className="w-full py-4 text-base">{busy ? 'Unlocking…' : '🔓 Unlock PDF →'}</Btn>
            </div>
          )}
        </>
      )}
      {f.error && <ErrorBox msg={f.error} />}
      {out && f.file && <ResultPanel title="PDF unlocked" bytes={out.byteLength} before={f.file.size} onDownload={() => download(out, `${base(f.file!.name)}-unlocked.pdf`)} onReset={() => { f.reset(); setOut(null); setPw(''); }}>{note && <p className="text-sm text-slate-600 mt-4">{note}</p>}</ResultPanel>}
    </div>
  );
};

// ---------- Compress PDF (generic + fixed targets) ----------
export const CompressPdf: React.FC<{ targetKb?: number }> = ({ targetKb }) => {
  const f = usePdfFile();
  const [level, setLevel] = useState<'lossless' | 'balanced' | 'strong' | 'extreme'>('balanced');
  const [customTarget, setCustomTarget] = useState<number>(targetKb || 0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [res, setRes] = useState<Awaited<ReturnType<typeof compressToTarget>> | null>(null);
  const target = targetKb ? targetKb * 1024 : customTarget ? customTarget * 1024 : null;
  const run = async () => {
    if (!f.buf) return; setBusy(true); setRes(null); f.setError('');
    try {
      let t = target;
      if (!t) t = level === 'lossless' ? null : Math.round(f.file!.size * ({ balanced: 0.6, strong: 0.35, extreme: 0.15 } as Record<string, number>)[level]);
      setRes(await compressToTarget(f.buf, t, setStatus));
    } catch (e) { f.setError(`Compression failed: ${String((e as Error).message || e).slice(0, 160)}`); }
    setBusy(false);
  };
  const hit = res && target ? res.bytes.byteLength <= target : true;
  return (
    <div className="space-y-5">
      <PrivacyNote />
      {targetKb && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900"><strong>Target: under {targetKb} KB.</strong> The tool first optimises the file structure losslessly; if that is not enough it re-renders pages at progressively lower resolution until the target is reached.</div>}
      {!f.file ? <DropZone accept="application/pdf,.pdf" onFiles={fs => f.load(fs[0])} label={targetKb ? `Select a PDF to compress to ${targetKb} KB` : 'Select a PDF to compress'} /> : (
        <>
          <FileInfoPanel file={f.file} info={f.info} onRemove={() => { f.reset(); setRes(null); }} />
          {targetKb && f.file.size <= targetKb * 1024 && <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800">This file is already {fmtBytes(f.file.size)} — under the {targetKb} KB target. You can still compress it further below.</div>}
          {!res && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              {!targetKb && (<>
                <div className="grid sm:grid-cols-4 gap-2">{([['lossless', 'Lossless', 'Structure only, identical quality'], ['balanced', 'Balanced', '~40% smaller, great quality'], ['strong', 'Strong', '~65% smaller, good quality'], ['extreme', 'Extreme', '~85% smaller, screen quality']] as const).map(([k, l, d]) => <button key={k} type="button" onClick={() => { setLevel(k); setCustomTarget(0); }} className={`text-left rounded-xl border p-3 ${level === k && !customTarget ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}><p className="font-semibold text-slate-800 text-sm">{l}</p><p className="text-xs text-slate-500">{d}</p></button>)}</div>
                <div className="flex items-center gap-3"><label className="text-sm font-semibold text-slate-700">Or target size:</label><input type="number" min={10} value={customTarget || ''} onChange={e => setCustomTarget(Number(e.target.value))} placeholder="e.g. 250" className="w-28 p-2.5 rounded-lg border border-slate-300 text-sm" /><span className="text-sm text-slate-500">KB</span><div className="flex gap-1 ml-2">{[50, 100, 200, 300, 500].map(k => <button key={k} type="button" onClick={() => setCustomTarget(k)} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${customTarget === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{k}</button>)}</div></div>
              </>)}
              {busy ? <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3 text-sm text-slate-700"><span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />{status || 'Compressing…'}</div> : <Btn onClick={run} className="w-full py-4 text-base">Compress PDF →</Btn>}
            </div>
          )}
        </>
      )}
      {f.error && <ErrorBox msg={f.error} />}
      {res && f.file && (
        <ResultPanel title={hit ? (res.lossless ? 'Compressed losslessly' : 'Compressed successfully') : `Reached ${fmtBytes(res.bytes.byteLength)} (target ${fmtBytes(target!)})`} bytes={res.bytes.byteLength} before={f.file.size} onDownload={() => download(res.bytes, `${base(f.file!.name)}-compressed.pdf`)} onReset={() => { f.reset(); setRes(null); }}>
          {!hit && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-4">Could not reach the target without making pages unreadable. This is the smallest legible version; try splitting the document or removing pages.</p>}
          {!res.lossless && <p className="text-xs text-slate-500 mt-3">Pages were re-rendered as images to hit the size target, so text is no longer selectable. Use “Lossless” for text-preserving optimisation.</p>}
          <details className="mt-4"><summary className="text-xs font-semibold text-slate-500 cursor-pointer">Compression attempts ({res.attempts.length})</summary><table className="w-full text-xs mt-2"><thead><tr className="text-slate-400 text-left"><th className="py-1">Pass</th><th>Resolution</th><th>Quality</th><th>Result</th></tr></thead><tbody>{res.attempts.map((a, i) => <tr key={i} className="border-t border-slate-100"><td className="py-1">{i + 1}</td><td>{a.scale ? `${Math.round(a.scale * 72)} dpi` : 'Lossless'}</td><td>{Math.round(a.quality * 100)}%</td><td className={target && a.size <= target ? 'text-emerald-600 font-semibold' : ''}>{fmtBytes(a.size)}</td></tr>)}</tbody></table></details>
        </ResultPanel>
      )}
    </div>
  );
};
