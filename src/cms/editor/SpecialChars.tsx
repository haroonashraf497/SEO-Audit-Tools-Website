import React, { useState } from 'react';

/* ============================================================
   "Special character" picker — the same idea as the WordPress
   Ω button: a grouped palette of symbols that are hard to type,
   inserted at the caret.
   ============================================================ */

const GROUPS: { id: string; label: string; chars: string[] }[] = [
  {
    id: 'common', label: 'Common',
    chars: ['©', '®', '™', '§', '¶', '†', '‡', '•', '·', '…', '–', '—', '“', '”', '‘', '’', '«', '»', '°', '№', '℠'],
  },
  {
    id: 'currency', label: 'Currency',
    chars: ['€', '£', '$', '¢', '¥', '₹', '₨', '₦', '₩', '₪', '₫', '₴', '₱', '₺', '₸', '₽', '₿', '₡', '₲'],
  },
  {
    id: 'math', label: 'Maths',
    chars: ['±', '×', '÷', '≠', '≈', '≤', '≥', '√', '∞', '∑', '∏', '∫', 'µ', 'Ω', 'π', 'Δ', '‰', '‱', '∅', '∠', '√'],
  },
  {
    id: 'arrows', label: 'Arrows',
    chars: ['←', '→', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇔', '⇧', '⇩', '↩', '↪', '⟶', '➔', '➜', '▲', '▼', '◀', '▶'],
  },
  {
    id: 'accents', label: 'Accents',
    chars: ['á', 'à', 'â', 'ä', 'ã', 'å', 'ç', 'é', 'è', 'ê', 'ë', 'í', 'ì', 'î', 'ï', 'ñ', 'ó', 'ò', 'ô', 'ö', 'õ', 'ú', 'ù', 'û', 'ü', 'ý', 'ÿ', 'ß', 'æ', 'œ', 'Á', 'À', 'Â', 'Ä', 'Ç', 'É', 'È', 'Ê', 'Ë', 'Í', 'Ñ', 'Ó', 'Ò', 'Ô', 'Ö', 'Ú', 'Ü', 'Æ', 'Œ'],
  },
  {
    id: 'marks', label: 'Marks',
    chars: ['★', '☆', '✦', '✧', '✓', '✔', '✗', '✘', '♥', '♡', '☺', '☻', '☼', '⚡', '☑', '☒', '⚠', '⚑', '⚐', 'ⓘ', '⚙', '❝', '❞'],
  },
];

const popoverCls = 'absolute z-50 mt-1 left-0 w-[min(92vw,420px)] bg-white border border-slate-200 rounded-xl shadow-xl p-3';

export const SpecialCharPicker: React.FC<{ onPick: (char: string) => void; onClose: () => void }> = ({ onPick, onClose }) => {
  const [group, setGroup] = useState(GROUPS[0].id);
  const current = GROUPS.find(g => g.id === group) || GROUPS[0];

  return (
    <div className={popoverCls} role="dialog" aria-label="Special characters">
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {GROUPS.map(g => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroup(g.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${g.id === group ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {g.label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="ml-auto w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">✕</button>
      </div>
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-56 overflow-y-auto">
        {current.chars.map(char => (
          <button
            key={char}
            type="button"
            title={`Insert ${char}`}
            onClick={() => { onPick(char); }}
            className="h-8 rounded-md border border-slate-100 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-base leading-none flex items-center justify-center"
          >
            {char}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Click a character to insert it at the cursor.</p>
    </div>
  );
};
