import React, { useEffect, useRef, useState } from 'react';
import { compressToTarget, fmtBytes, inspectPdf, paperName, readFile, renderPages, type PdfInfo } from './engine';

export const PrivacyNote: React.FC = () => (
  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-800">
    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    <p><strong>100% private.</strong> Your files are processed inside your browser and are never uploaded to any server. Close the tab and nothing remains.</p>
  </div>
);

export const DropZone: React.FC<{ accept: string; multiple?: boolean; onFiles: (files: File[]) => void; label: string; hint?: string; compact?: boolean }> = ({ accept, multiple, onFiles, label, hint, compact }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const handle = (list: FileList | null) => { if (!list) return; const arr = Array.from(list); onFiles(multiple ? arr : arr.slice(0, 1)); };
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${compact ? 'p-5' : 'p-10 md:p-14'} ${over ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'}`}
    >
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden" onChange={e => { handle(e.target.files); e.target.value = ''; }} />
      <div className={`mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center ${compact ? 'w-10 h-10 mb-2' : 'w-16 h-16 mb-4'}`}>
        <svg className={compact ? 'w-5 h-5' : 'w-8 h-8'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
      </div>
      <p className={`font-bold text-slate-800 ${compact ? 'text-sm' : 'text-lg'}`}>{label}</p>
      <p className="text-sm text-slate-500 mt-1">{hint || 'or drag & drop here'}</p>
    </div>
  );
};

export const Progress: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5">
    <div className="flex justify-between text-sm text-slate-600 mb-2"><span>{label}</span><span>{Math.round(value)}%</span></div>
    <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all" style={{ width: `${value}%` }} /></div>
  </div>
);

export const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">{msg}</div>;

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'dark' }> = ({ variant = 'primary', className = '', children, ...rest }) => {
  const v = { primary: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/25', secondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50', dark: 'bg-slate-900 text-white hover:bg-slate-700' }[variant];
  return <button {...rest} className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${v} ${className}`}>{children}</button>;
};

export const StatBox: React.FC<{ label: string; value: React.ReactNode; tone?: 'good' | 'warn' | 'bad' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => (
  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-w-0"><p className="text-xs text-slate-500">{label}</p><p className={`text-lg font-bold break-words ${{ good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', neutral: 'text-slate-800' }[tone]}`}>{value}</p></div>
);

// Detailed file information panel
export const FileInfoPanel: React.FC<{ file: File; info: PdfInfo | null; onRemove?: () => void }> = ({ file, info, onRemove }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 font-bold text-xs">PDF</span>
        <div className="min-w-0"><p className="font-semibold text-slate-800 truncate">{file.name}</p><p className="text-xs text-slate-500">{fmtBytes(file.size)}{info ? ` · ${info.pages} page${info.pages === 1 ? '' : 's'}` : ''}</p></div>
      </div>
      {onRemove && <button type="button" onClick={onRemove} className="text-xs font-semibold text-slate-500 hover:text-red-600 px-2 py-1">Remove</button>}
    </div>
    {info && (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
        {[['Pages', String(info.pages)], ['Size', fmtBytes(info.size)], ['PDF version', info.version || '—'], ['Encrypted', info.encrypted ? 'Yes 🔒' : 'No'],
          ['Page size', info.pageSizes[0] ? `${paperName(info.pageSizes[0].w, info.pageSizes[0].h)} (${info.pageSizes[0].w}×${info.pageSizes[0].h} pt)` : '—'],
          ['Orientation', info.pageSizes[0] ? (info.pageSizes[0].w > info.pageSizes[0].h ? 'Landscape' : 'Portrait') : '—'],
          ['Title', info.title || '—'], ['Author', info.author || '—'], ['Creator', info.creator || '—'], ['Producer', info.producer || '—'], ['Created', info.created || '—'], ['Modified', info.modified || '—']]
          .map(([l, v]) => <div key={l} className="bg-slate-50 rounded-lg px-3 py-2 min-w-0"><p className="text-slate-400">{l}</p><p className="font-semibold text-slate-700 truncate" title={v}>{v}</p></div>)}
      </div>
    )}
  </div>
);

// Page thumbnail grid rendered with pdf.js
export const Thumbnails: React.FC<{ buf: ArrayBuffer; selected?: Set<number>; onToggle?: (i: number) => void; rotations?: Record<number, number>; max?: number }> = ({ buf, selected, onToggle, rotations, max = 60 }) => {
  const [thumbs, setThumbs] = useState<{ url: string; page: number }[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let alive = true; const urls: string[] = [];
    (async () => {
      try {
        const info = await inspectPdf(buf); if (!alive) return; setTotal(info.pages);
        const pages = Array.from({ length: Math.min(info.pages, max) }, (_, i) => i);
        const imgs = await renderPages(buf, { scale: 0.35, quality: 0.7, pages });
        if (!alive) return;
        setThumbs(imgs.map(i => { const u = URL.createObjectURL(i.blob); urls.push(u); return { url: u, page: i.page }; }));
      } catch { /* encrypted or invalid — no thumbnails */ }
    })();
    return () => { alive = false; urls.forEach(u => URL.revokeObjectURL(u)); };
  }, [buf, max]);
  if (!thumbs.length) return <p className="text-xs text-slate-400 py-3">Rendering page previews…</p>;
  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
        {thumbs.map(t => {
          const sel = selected?.has(t.page - 1);
          const rot = rotations?.[t.page - 1] || 0;
          return (
            <button key={t.page} type="button" onClick={() => onToggle?.(t.page - 1)} className={`relative rounded-lg border-2 overflow-hidden bg-white transition-all ${onToggle ? 'cursor-pointer hover:border-indigo-400' : 'cursor-default'} ${sel ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200'}`}>
              <img src={t.url} alt={`Page ${t.page}`} className="w-full h-auto transition-transform duration-300" style={{ transform: `rotate(${rot}deg)` }} />
              <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">{t.page}</span>
              {sel && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">✓</span>}
            </button>
          );
        })}
      </div>
      {total > max && <p className="text-xs text-slate-400 mt-2">Showing first {max} of {total} pages.</p>}
    </div>
  );
};

/* ---------- Optional "compress it more" step for tool results ---------- */

export const COMPRESS_LEVELS = [
  ['lossless', 'Lossless', 'Structure only · identical quality'],
  ['balanced', 'Balanced', '~40% smaller · great quality'],
  ['strong', 'Strong', '~65% smaller · good quality'],
  ['extreme', 'Extreme', '~85% smaller · screen quality'],
] as const;

export type CompressLevel = typeof COMPRESS_LEVELS[number][0];

/** How far below the current size each level aims (lossless has no target). */
const LEVEL_TARGET: Record<Exclude<CompressLevel, 'lossless'>, number> = { balanced: 0.6, strong: 0.35, extreme: 0.15 };

export const CompressMore: React.FC<{
  /** The file currently offered for download. */
  bytes: Uint8Array;
  /** Label of the compression already applied, when there is one. */
  appliedLabel?: string | null;
  onApply: (bytes: Uint8Array, label: string) => void;
  onKeepOriginal?: () => void;
  defaultLevel?: CompressLevel;
}> = ({ bytes, appliedLabel, onApply, onKeepOriginal, defaultLevel = 'balanced' }) => {
  const [level, setLevel] = useState<CompressLevel>(defaultLevel);
  const [customTarget, setCustomTarget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [res, setRes] = useState<{ bytes: Uint8Array; label: string; lossless: boolean; passes: number } | null>(null);

  const run = async () => {
    setBusy(true); setRes(null); setNote(''); setStatus('');
    try {
      const target = customTarget
        ? customTarget * 1024
        : level === 'lossless' ? null : Math.round(bytes.byteLength * LEVEL_TARGET[level]);
      // Private copy: the compressor and pdf.js must never touch (or detach)
      // the buffer that is currently offered for download.
      const buf = new Uint8Array(bytes).buffer as ArrayBuffer;
      const out = await compressToTarget(buf, target, setStatus);
      if (out.bytes.byteLength < bytes.byteLength) {
        const label = customTarget ? `${customTarget} KB target` : COMPRESS_LEVELS.find(l => l[0] === level)![1];
        setRes({ bytes: out.bytes, label, lossless: out.lossless, passes: out.attempts.length });
      } else {
        setNote(`Already optimal — this file is ${fmtBytes(bytes.byteLength)} and no smaller legible version could be produced.`);
      }
    } catch (e) {
      const detail = String((e as Error).message || e).slice(0, 160);
      setNote(`Compression failed: ${detail}. Try again, or pick a lighter level (Lossless is the most reliable).`);
    }
    setBusy(false);
  };

  return (
    <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">Compress more</h4>
          <p className="text-xs text-slate-500 mt-0.5">Optional — shrink the merged file before you download it. “Lossless” keeps real text; the other levels re-render pages as images, which takes a few seconds on large documents.</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 flex-shrink-0">{fmtBytes(bytes.byteLength)}</span>
      </div>

      {appliedLabel && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-3">
          <p className="text-xs text-emerald-800"><strong>Compressed version applied ({appliedLabel}).</strong> The Download button above saves the smaller file.</p>
          {onKeepOriginal && (
            <button type="button" onClick={() => { onKeepOriginal(); setRes(null); setNote(''); }} className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline">Use the uncompressed merge instead</button>
          )}
        </div>
      )}

      {!res && (
        <>
          <div className="grid sm:grid-cols-4 gap-2">
            {COMPRESS_LEVELS.map(([key, label, hint]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setLevel(key); setCustomTarget(0); }}
                className={`text-left rounded-xl border p-3 bg-white transition-colors ${level === key && !customTarget ? 'border-indigo-500 ring-1 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300'}`}
              >
                <p className="font-semibold text-slate-800 text-sm">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <label htmlFor="compress-more-target" className="text-xs font-semibold text-slate-700">Or target size</label>
            <input
              id="compress-more-target"
              type="number"
              min={10}
              value={customTarget || ''}
              onChange={e => setCustomTarget(Math.max(0, Number(e.target.value)))}
              placeholder="e.g. 250"
              className="w-24 p-2 rounded-lg border border-slate-300 text-sm bg-white"
            />
            <span className="text-xs text-slate-500">KB</span>
            <div className="flex gap-1">
              {[50, 100, 200, 300, 500].map(k => (
                <button key={k} type="button" onClick={() => setCustomTarget(k)} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${customTarget === k ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{k}</button>
              ))}
            </div>
          </div>
          {busy
            ? <div className="mt-3 flex items-center gap-3 text-xs text-slate-600"><span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />{status || 'Compressing…'}</div>
            : <Btn onClick={run} variant="secondary" className="mt-3">Compress more →</Btn>}
        </>
      )}

      {res && (
        <div className="bg-white border border-emerald-200 rounded-xl p-3">
          <p className="text-sm text-slate-800">
            <strong className="text-emerald-600">{fmtBytes(res.bytes.byteLength)}</strong>
            <span className="text-slate-400"> · </span>down from {fmtBytes(bytes.byteLength)}
            <span className="text-emerald-600 font-semibold"> (−{Math.max(0, Math.round((1 - res.bytes.byteLength / bytes.byteLength) * 100))}%)</span>
            <span className="text-slate-500 text-xs"> · {res.label}{res.lossless ? ' · text kept' : ` · ${res.passes} passes`}</span>
          </p>
          {!res.lossless && <p className="text-xs text-slate-500 mt-1">Pages were re-rendered as images, so text is no longer selectable. Choose “Lossless” to keep text.</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <Btn onClick={() => onApply(res.bytes, res.label)}>✓ Use compressed file</Btn>
            <Btn variant="secondary" onClick={() => setRes(null)}>Try another level</Btn>
          </div>
        </div>
      )}

      {note && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-3">{note}</p>}
    </div>
  );
};

// Result panel with size comparison and download
export const ResultPanel: React.FC<{ title: string; bytes: number; before?: number; onDownload: () => void; onReset: () => void; children?: React.ReactNode; fileName?: string }> = ({ title, bytes, before, onDownload, onReset, children, fileName }) => {
  const saved = before ? Math.round((1 - bytes / before) * 100) : 0;
  return (
    <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-sm animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-lg">✓</span><div><h3 className="font-bold text-slate-900">{title}</h3>{fileName && <p className="text-xs text-slate-500">{fileName}</p>}</div></div>
        <div className="flex gap-2"><Btn onClick={onDownload}>⬇ Download</Btn><Btn variant="secondary" onClick={onReset}>Start over</Btn></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {before !== undefined && <StatBox label="Original size" value={fmtBytes(before)} />}
        <StatBox label={before !== undefined ? 'New size' : 'File size'} value={fmtBytes(bytes)} tone="good" />
        {before !== undefined && <StatBox label="Saved" value={`${saved > 0 ? saved : 0}%`} tone={saved > 0 ? 'good' : 'warn'} />}
        {before !== undefined && <StatBox label="Reduction" value={fmtBytes(Math.max(0, before - bytes))} />}
      </div>
      {children}
    </div>
  );
};

// Hook: load a single PDF with info
export const usePdfFile = () => {
  const [file, setFile] = useState<File | null>(null);
  const [buf, setBuf] = useState<ArrayBuffer | null>(null);
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [error, setError] = useState('');
  const load = async (f: File) => {
    setError(''); setFile(f); setInfo(null);
    try { const b = await readFile(f); setBuf(b); setInfo(await inspectPdf(b)); }
    catch (e) { setError(`Could not read this PDF: ${String((e as Error).message || e).slice(0, 160)}`); setBuf(null); }
  };
  const reset = () => { setFile(null); setBuf(null); setInfo(null); setError(''); };
  return { file, buf, info, error, load, reset, setError };
};
