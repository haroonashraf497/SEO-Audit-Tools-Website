import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { sanitizeUrl } from '../../utils/sanitize';
import {
  ACCEPTED_UPLOAD_TYPES, BROWSER_QUOTA_BYTES, LARGE_IMAGE_BYTES, addToLibrary, buildImageHtml,
  estimateLocalStorageBytes, formatBytes, loadMediaLibrary, newMediaId, optimizeImageFile,
  removeFromLibrary, validateUpload, type MediaItem, type OptimizedImage,
} from '../media';

/* ============================================================
   Add Media dialog — WordPress-style modal with three sources:
   • Upload      pick files or drop them anywhere in the drop zone
   • From URL    link an image hosted elsewhere
   • Library     images uploaded earlier in this browser

   Uploaded files are optimised in-browser and embedded as
   data:image/… URLs (the public sanitiser allows exactly that).
   ============================================================ */

type Tab = 'upload' | 'url' | 'library';
type Align = 'none' | 'left' | 'center' | 'right';

const fieldCls = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white';
const labelCls = 'text-[11px] font-bold uppercase tracking-wide text-slate-500';

const TABS: { id: Tab; label: string; icon: 'upload' | 'globe' | 'library' }[] = [
  { id: 'upload', label: 'Upload', icon: 'upload' },
  { id: 'url', label: 'From URL', icon: 'globe' },
  { id: 'library', label: 'Library', icon: 'library' },
];

const ALIGNMENTS: { id: Align; label: string; icon: 'alignLeft' | 'alignCenter' | 'alignRight' | 'rule' }[] = [
  { id: 'none', label: 'None', icon: 'rule' },
  { id: 'left', label: 'Left', icon: 'alignLeft' },
  { id: 'center', label: 'Center', icon: 'alignCenter' },
  { id: 'right', label: 'Right', icon: 'alignRight' },
];

const WIDTHS = ['100%', '75%', '50%', '25%'];

const StorageMeter: React.FC = () => {
  const used = estimateLocalStorageBytes();
  const pct = Math.min(100, Math.round((used / BROWSER_QUOTA_BYTES) * 100));
  const tone = pct >= 80 ? 'bg-red-500' : pct >= 55 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
        <span>Browser storage</span>
        <span className={pct >= 80 ? 'font-bold text-red-600' : ''}>{formatBytes(used)} / ~{formatBytes(BROWSER_QUOTA_BYTES)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
      <p className="text-[11px] text-slate-400 mt-1.5">Uploads are compressed and stored in this browser. Export your CMS JSON to keep a permanent copy.</p>
    </div>
  );
};

export const MediaDialog: React.FC<{
  onInsert: (html: string, summary: string) => void;
  onClose: () => void;
}> = ({ onInsert, onClose }) => {
  const [tab, setTab] = useState<Tab>('upload');
  const [selection, setSelection] = useState<OptimizedImage[]>([]);
  const [library, setLibrary] = useState<MediaItem[]>(() => loadMediaLibrary());
  const [urlValue, setUrlValue] = useState('');
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [align, setAlign] = useState<Align>('none');
  const [width, setWidth] = useState('');
  const [keepInLibrary, setKeepInLibrary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const totalBytes = useMemo(() => selection.reduce((sum, item) => sum + item.bytes, 0), [selection]);

  const ingestFiles = async (files: File[]) => {
    if (!files.length) return;
    setError('');
    setNotice('');
    setBusy(true);
    const accepted: OptimizedImage[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const problem = validateUpload(file);
      if (problem) { problems.push(`${file.name || 'file'}: ${problem}`); continue; }
      try {
        accepted.push(await optimizeImageFile(file));
      } catch (err) {
        problems.push(`${file.name || 'file'}: ${err instanceof Error ? err.message : 'could not be read'}`);
      }
    }
    if (accepted.length) {
      setSelection(prev => [...prev, ...accepted]);
      setTab('upload');
      if (!alt) setAlt(accepted[0].name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 120));
      if (keepInLibrary) {
        accepted.forEach(item => {
          if (item.bytes > LARGE_IMAGE_BYTES) return;
          addToLibrary({
            id: newMediaId(), src: item.src, alt: alt || item.name, name: item.name,
            bytes: item.bytes, width: item.width, height: item.height, remote: false, createdAt: Date.now(),
          });
        });
        setLibrary(loadMediaLibrary());
      }
    }
    if (problems.length) setError(problems.join(' · '));
    setBusy(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []).filter(file => file.type.startsWith('image/'));
    if (files.length) { void ingestFiles(files); return; }
    const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
    const first = text.split('\n').map(line => line.trim()).find(Boolean) || '';
    if (first && sanitizeUrl(first)) { setUrlValue(first); setTab('url'); setError(''); return; }
    setError('Drop an image file, or paste an image URL in the From URL tab.');
  };

  const insertFromUrl = () => {
    const safe = sanitizeUrl(urlValue.trim());
    if (!safe) { setError('Enter a valid image URL starting with https:// (or a data:image upload).'); return; }
    const html = buildImageHtml({ src: safe, alt, href: link ? sanitizeUrl(link) || '' : '', caption, align, width: width || undefined });
    onInsert(html, `${alt || 'Remote image'} · ${safe.slice(0, 48)}${safe.length > 48 ? '…' : ''}`);
  };

  const insertSelection = (items: OptimizedImage[]) => {
    if (!items.length) { setError('Choose an image first.'); return; }
    const safeLink = link ? sanitizeUrl(link) : null;
    const html = items
      .map((item, index) => buildImageHtml({
        src: item.src,
        alt: items.length > 1 ? `${alt || item.name} ${index + 1}` : alt,
        href: safeLink || '',
        caption,
        align,
        width: width || undefined,
      }))
      .join('\n');
    onInsert(html, `${items.length} image${items.length > 1 ? 's' : ''} · ${formatBytes(items.reduce((sum, i) => sum + i.bytes, 0))}`);
  };

  const insertLibraryItem = (item: MediaItem) => {
    const safeLink = link ? sanitizeUrl(link) : null;
    onInsert(
      buildImageHtml({ src: item.src, alt: alt || item.alt || item.name, href: safeLink || '', caption, align, width: width || undefined }),
      `${item.name} · ${formatBytes(item.bytes)}`,
    );
  };

  const previewSrc = selection[0]?.src || urlValue;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" aria-label="Add media">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-4">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <span className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon name="image" className="w-5 h-5" /></span>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">Add Media</h2>
            <p className="text-xs text-slate-500">Upload, link or reuse an image — it is inserted at the cursor.</p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto w-9 h-9 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center" aria-label="Close media dialog">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </header>

        <div className="flex gap-1 px-5 pt-3 border-b border-slate-100">
          {TABS.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setTab(item.id); setError(''); }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-sm font-semibold border-b-2 transition-colors ${tab === item.id ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <Icon name={item.icon} className="w-4 h-4" /> {item.label}
              {item.id === 'library' && library.length > 0 && <span className="text-[11px] font-bold px-1.5 rounded-full bg-slate-200 text-slate-600">{library.length}</span>}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* ---------------- source panel ---------------- */}
          <div className="p-5 min-h-[280px]">
            {tab === 'upload' && (
              <>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}
                >
                  <span className="inline-flex w-12 h-12 rounded-xl bg-white border border-slate-200 items-center justify-center text-indigo-600 mb-3"><Icon name="upload" className="w-6 h-6" /></span>
                  <p className="font-semibold text-slate-800">Drop images here</p>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG, WebP, GIF, AVIF or BMP · up to {formatBytes(12 * 1024 * 1024)} each</p>
                  <button type="button" onClick={() => fileInput.current?.click()} className="mt-4 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                    Select files
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept={ACCEPTED_UPLOAD_TYPES.join(',')}
                    multiple
                    className="hidden"
                    onChange={e => { void ingestFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
                  />
                  <p className="text-[11px] text-slate-400 mt-3">Images are downscaled to 1600px and re-encoded to WebP in your browser before they are embedded.</p>
                </div>

                {busy && <p className="text-sm text-indigo-600 font-semibold mt-3">Optimising image…</p>}

                {selection.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className={labelCls}>Attachment{selection.length > 1 ? 's' : ''} ({selection.length})</p>
                      <button type="button" onClick={() => setSelection([])} className="text-xs font-semibold text-slate-500 hover:text-red-600">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selection.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="relative w-20 h-20 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                          <img src={item.src} alt={item.name} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setSelection(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-slate-900/70 text-white text-[11px] leading-none"
                            aria-label={`Remove ${item.name}`}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {selection[0].width} × {selection[0].height}px · {formatBytes(totalBytes)}
                      {selection[0].compressed && <> · compressed from {formatBytes(selection[0].originalBytes)}</>}
                      {totalBytes > LARGE_IMAGE_BYTES && <span className="text-amber-600 font-semibold"> · large upload, consider a smaller image</span>}
                    </p>
                  </div>
                )}
              </>
            )}

            {tab === 'url' && (
              <div className="space-y-3">
                <label className="block">
                  <span className={labelCls}>Image URL</span>
                  <input className={`${fieldCls} mt-1`} value={urlValue} onChange={e => { setUrlValue(e.target.value); setError(''); }} placeholder="https://cdn.example.com/image.webp" />
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 min-h-[140px] flex items-center justify-center">
                  {urlValue ? (
                    <img
                      src={urlValue}
                      alt="Preview"
                      className="max-h-40 rounded-lg"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; setError('That URL did not load as an image. Check the link and try again.'); }}
                      onLoad={e => { (e.currentTarget as HTMLImageElement).style.display = ''; }}
                    />
                  ) : <p className="text-xs text-slate-400">Paste a direct image link to preview it here.</p>}
                </div>
                <p className="text-[11px] text-slate-400">Hot-linked images depend on the other server staying online. Upload the file if the image matters to the page.</p>
              </div>
            )}

            {tab === 'library' && (
              <>
                {library.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="font-semibold text-slate-700">Nothing in the media library yet.</p>
                    <p className="text-sm text-slate-500 mt-1">Images you upload from this browser are kept here for quick reuse.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[46vh] overflow-y-auto pr-1">
                    {library.map(item => (
                      <div key={item.id} className="group relative rounded-xl border border-slate-200 overflow-hidden bg-white">
                        <button type="button" onClick={() => insertLibraryItem(item)} className="block w-full text-left">
                          <img src={item.src} alt={item.alt || item.name} className="w-full h-24 object-cover bg-slate-50" />
                          <span className="block px-2 py-1.5">
                            <span className="block text-[11px] font-semibold text-slate-700 truncate">{item.name}</span>
                            <span className="block text-[10px] text-slate-400">{item.width} × {item.height} · {formatBytes(item.bytes)}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLibrary(removeFromLibrary(item.id))}
                          className="absolute top-1 right-1 w-6 h-6 rounded-md bg-white/90 border border-slate-200 text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          aria-label={`Delete ${item.name}`}
                        ><Icon name="trash" className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                {library.length > 0 && <p className="text-[11px] text-slate-400 mt-2">Click an image to insert it. Hover to delete.</p>}
              </>
            )}

            {error && <p className="text-sm text-red-600 mt-3" role="alert">{error}</p>}
            {notice && <p className="text-sm text-emerald-600 mt-3">{notice}</p>}
          </div>

          {/* ---------------- attachment details ---------------- */}
          <aside className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Attachment details</p>
            {previewSrc ? (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-3">
                <img src={previewSrc} alt="Selected" className="w-full max-h-40 object-contain bg-slate-50" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white h-28 flex items-center justify-center text-xs text-slate-400 mb-3">No image selected</div>
            )}
            <label className="block mb-3">
              <span className={labelCls}>Alt text <span className="text-red-500">*</span></span>
              <textarea rows={2} className={`${fieldCls} mt-1`} value={alt} onChange={e => setAlt(e.target.value)} placeholder="Describe the image for screen readers and image search" />
              <span className="block text-[11px] text-slate-400 mt-1">Describe what the image shows — this is required for SEO and accessibility.</span>
            </label>
            <label className="block mb-3">
              <span className={labelCls}>Caption (optional)</span>
              <input className={`${fieldCls} mt-1`} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Shown under the image" />
            </label>
            <label className="block mb-3">
              <span className={labelCls}>Link to (optional)</span>
              <input className={`${fieldCls} mt-1`} value={link} onChange={e => setLink(e.target.value)} placeholder="https://example.com" />
            </label>
            <div className="mb-3">
              <span className={labelCls}>Alignment</span>
              <div className="flex gap-1 mt-1">
                {ALIGNMENTS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-pressed={align === item.id}
                    onClick={() => setAlign(item.id)}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${align === item.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                  ><Icon name={item.icon} className="w-4 h-4" /></button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <span className={labelCls}>Display width</span>
              <div className="flex flex-wrap gap-1 mt-1">
                <button type="button" onClick={() => setWidth('')} aria-pressed={!width} className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${!width ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>Auto</button>
                {WIDTHS.map(w => (
                  <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={width === w} className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${width === w ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}`}>{w}</button>
                ))}
              </div>
            </div>
            {tab === 'upload' && (
              <label className="flex items-start gap-2 text-xs text-slate-600 mb-1 cursor-pointer">
                <input type="checkbox" checked={keepInLibrary} onChange={e => setKeepInLibrary(e.target.checked)} className="mt-0.5 rounded border-slate-300 text-indigo-600" />
                Keep small uploads in the media library for reuse
              </label>
            )}
            <StorageMeter />
          </aside>
        </div>

        <footer className="flex flex-wrap items-center gap-3 px-5 py-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (tab === 'url') insertFromUrl();
              else if (tab === 'library') { setError('Click an image in the library to insert it.'); }
              else insertSelection(selection);
            }}
            className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {tab === 'library' ? 'Select an image to insert' : 'Insert into content'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Cancel</button>
          <p className="ml-auto text-[11px] text-slate-400">Drop files anywhere in the drop zone · Esc closes this dialog</p>
        </footer>
      </div>
    </div>
  );
};
