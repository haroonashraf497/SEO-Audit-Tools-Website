import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoryLabels, categoryOrder, type ToolCategory } from '../tools/data';
import { useCms } from '../cms/store';

/**
 * "Tool Categories" mega menu for the top navigation.
 *
 * Every category shown on the Free SEO Tools page (with its live tool count)
 * is listed here and links straight to the filtered tools page, e.g.
 * /free-tools?cat=management. Counts come from the same CMS source the tools
 * page uses, so the numbers can never drift apart.
 */

/** Three balanced columns, matching the approved dropdown layout. */
const COLUMNS: ToolCategory[][] = [
  ['text', 'keyword', 'backlink', 'calculator'],
  ['management', 'checker', 'domain', 'converter'],
  ['ip', 'pdf', 'image'],
];

const Chevron: React.FC<{ up?: boolean }> = ({ up }) => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {up ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
  </svg>
);

const useCategoryCounts = () => {
  const cms = useCms();
  return useMemo(() => {
    const map = new Map<ToolCategory, number>();
    cms.state.tools.forEach(t => {
      if (t.status !== 'live') return;
      map.set(t.category, (map.get(t.category) || 0) + 1);
    });
    return map;
  }, [cms.state.tools]);
};

/** Desktop: hover/focus dropdown anchored under the nav item. */
export const ToolCategoriesMenu: React.FC<{ route?: string }> = ({ route }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const counts = useCategoryCounts();
  const total = useMemo(() => [...counts.values()].reduce((a, b) => a + b, 0), [counts]);

  const clearTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => { clearTimer(); setOpen(false); }, [clearTimer]);

  // Navigating anywhere (including from the menu itself) closes it.
  useEffect(() => { setOpen(false); }, [route]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => { clearTimer(); setOpen(true); }}
      onMouseLeave={() => { clearTimer(); closeTimer.current = window.setTimeout(() => setOpen(false), 140); }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="tool-categories-menu"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${open ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
      >
        Tool Categories
        <Chevron up={open} />
      </button>

      <div
        id="tool-categories-menu"
        aria-label="Tool categories"
        className={`fixed left-0 right-0 top-16 z-50 px-4 pt-3 ${open ? '' : 'hidden'}`}
      >
        {/* No heading inside the panel — the nav item itself is the label. */}
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xl px-5 py-4 lg:px-6 lg:py-5 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1">
            {COLUMNS.map((column, i) => (
              <div key={i} className="flex flex-col">
                {column.map(cat => (
                  <a
                    key={cat}
                    href={`/free-tools?cat=${cat}`}
                    onClick={close}
                    className="py-2 text-[17px] leading-snug text-slate-800 hover:text-indigo-600 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  >
                    {categoryLabels[cat]} <span className="text-slate-400">({counts.get(cat) || 0})</span>
                  </a>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <a href="/free-tools" onClick={close} className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
              Browse all {total} free tools →
            </a>
            <span className="text-xs text-slate-400">{categoryOrder.length} categories</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Mobile: the same categories as a collapsible section inside the burger menu. */
export const ToolCategoriesMobileSection: React.FC<{ onNavigate: () => void }> = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const counts = useCategoryCounts();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="tool-categories-mobile"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${open ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
      >
        Tool Categories
        <Chevron up={open} />
      </button>
      <div id="tool-categories-mobile" className={`${open ? '' : 'hidden'} mt-2 ml-1 pl-3 border-l border-slate-200 flex flex-col`}>
        {categoryOrder.map(cat => (
          <a
            key={cat}
            href={`/free-tools?cat=${cat}`}
            onClick={onNavigate}
            className="py-2 text-[15px] text-slate-700 hover:text-indigo-600 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            {categoryLabels[cat]} <span className="text-slate-400">({counts.get(cat) || 0})</span>
          </a>
        ))}
        <a href="/free-tools" onClick={onNavigate} className="py-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
          Browse all free tools →
        </a>
      </div>
    </div>
  );
};
