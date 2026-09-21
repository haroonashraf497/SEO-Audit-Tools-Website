import React, { useState } from 'react';
import { Icon } from './icons';

/* ============================================================
   Text colour / highlight colour popover.

   WordPress shows a "Default / custom" palette; this is the same
   with values that survive the public sanitiser (hex + rgb only,
   applied through execCommand styleWithCSS so it lands as an
   inline style on a <span>).
   ============================================================ */

const TEXT_SWATCHES = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#1d4ed8', '#4f46e5', '#7c3aed', '#0891b2', '#059669', '#16a34a', '#d97706', '#dc2626', '#db2777'];
const HIGHLIGHT_SWATCHES = ['#fef08a', '#fde68a', '#fed7aa', '#fecaca', '#fbcfe8', '#e9d5ff', '#c7d2fe', '#bfdbfe', '#bae6fd', '#bbf7d0', '#d9f99d', '#e2e8f0', '#f1f5f9'];

const popoverCls = 'absolute z-50 mt-1 right-0 w-[min(92vw,300px)] bg-white border border-slate-200 rounded-xl shadow-xl p-3';

export const ColorPicker: React.FC<{
  title: string;
  mode: 'text' | 'highlight';
  onPick: (color: string) => void;
  onClear: () => void;
  onClose: () => void;
}> = ({ title, mode, onPick, onClear, onClose }) => {
  const swatches = mode === 'text' ? TEXT_SWATCHES : HIGHLIGHT_SWATCHES;
  const [custom, setCustom] = useState(mode === 'text' ? '#4f46e5' : '#fef08a');

  return (
    <div className={popoverCls} role="dialog" aria-label={title}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
        <button type="button" onClick={onClose} className="w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">✕</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {swatches.map(color => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => { onPick(color); onClose(); }}
            className="w-7 h-7 rounded-md border border-slate-200 hover:scale-110 transition-transform"
            style={{ background: color }}
            aria-label={`Apply ${color}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="color"
            value={custom}
            onChange={e => {
              setCustom(e.target.value);
              onPick(e.target.value);
            }}
            className="w-8 h-8 p-0 border border-slate-200 rounded-md bg-white cursor-pointer"
            aria-label="Custom colour"
          />
          Custom
        </label>
        <button
          type="button"
          onClick={() => { onClear(); onClose(); }}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 px-2 py-1.5 rounded-md hover:bg-slate-50"
        >
          <Icon name="eraser" className="w-3.5 h-3.5" /> Remove
        </button>
      </div>
    </div>
  );
};
