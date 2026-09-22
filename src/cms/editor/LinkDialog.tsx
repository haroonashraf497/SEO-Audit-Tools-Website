import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { sanitizeUrl } from '../../utils/sanitize';

/* ============================================================
   Insert / edit link panel.

   WordPress lets you set the URL, the anchor text (when nothing is
   selected), a new-tab target and a nofollow/sponsored rel. This
   mirrors that and validates the URL before it reaches the content,
   so nothing harmful can be stored in the first place.
   ============================================================ */

export interface LinkTarget {
  href: string;
  text: string;
  newTab: boolean;
  nofollow: boolean;
  /** True when a caret/selection is already inside a link. */
  existing: boolean;
}

const fieldCls = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white';

export const LinkDialog: React.FC<{
  target: LinkTarget;
  onApply: (target: LinkTarget) => void;
  onRemove: () => void;
  onClose: () => void;
}> = ({ target, onApply, onRemove, onClose }) => {
  const [href, setHref] = useState(target.href);
  const [text, setText] = useState(target.text);
  const [newTab, setNewTab] = useState(target.newTab);
  const [nofollow, setNofollow] = useState(target.nofollow);
  const [error, setError] = useState('');
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => { firstField.current?.focus(); firstField.current?.select(); }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = href.trim();
    if (!raw) { setError('Enter a URL, or use Remove to unlink the text.'); return; }
    const withScheme = /^[a-z]+:/i.test(raw) || raw.startsWith('#') || raw.startsWith('/') ? raw : `https://${raw}`;
    const safe = sanitizeUrl(withScheme);
    if (!safe) { setError('That link is not allowed. Use https://, mailto:, tel: or a relative link.'); return; }
    onApply({ href: safe, text: text.trim(), newTab, nofollow, existing: target.existing });
  };

  return (
    <form onSubmit={submit} className="absolute z-50 mt-1 left-0 w-[min(92vw,380px)] bg-white border border-slate-200 rounded-xl shadow-xl p-3" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{target.existing ? 'Edit link' : 'Insert link'}</p>
        <button type="button" onClick={onClose} className="w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">✕</button>
      </div>
      <label className="block mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">URL</span>
        <input ref={firstField} className={`${fieldCls} mt-1`} value={href} onChange={e => { setHref(e.target.value); setError(''); }} placeholder="https://example.com or #/tool/word-counter" />
      </label>
      {!target.existing && (
        <label className="block mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Link text</span>
          <input className={`${fieldCls} mt-1`} value={text} onChange={e => setText(e.target.value)} placeholder="Text that becomes clickable" />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={newTab} onChange={e => setNewTab(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
          Open in new tab
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={nofollow} onChange={e => setNofollow(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
          Add rel=&quot;nofollow&quot;
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mb-2" role="alert">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
          <Icon name="check" className="w-4 h-4" /> {target.existing ? 'Update' : 'Insert link'}
        </button>
        {target.existing && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">
            <Icon name="unlink" className="w-4 h-4" /> Remove
          </button>
        )}
        <button type="button" onClick={onClose} className="ml-auto text-sm font-semibold text-slate-500 hover:text-slate-800">Cancel</button>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Tip: press <kbd className="px-1 rounded border border-slate-200 bg-slate-50">Ctrl</kbd>/<kbd className="px-1 rounded border border-slate-200 bg-slate-50">⌘</kbd> + <kbd className="px-1 rounded border border-slate-200 bg-slate-50">K</kbd> to open this panel.</p>
    </form>
  );
};
