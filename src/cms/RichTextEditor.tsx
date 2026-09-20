import React, { useEffect, useRef } from 'react';

/* ============================================================
   RichTextEditor — a lightweight WordPress/Gutenberg-style
   WYSIWYG editor for CMS content. Produces clean HTML that the
   public site renders after sanitisation (see utils/sanitize).
   Toolbar: undo/redo · bold/italic/underline · H2/H3/P ·
   bullet & numbered lists · quote · link · clear formatting.
   Pastes are inserted as plain text to keep content clean.
   ============================================================ */

const btn = 'w-8 h-8 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors flex items-center justify-center';
const sep = 'w-px h-5 bg-slate-300 mx-1';

export const RichTextEditor: React.FC<{
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}> = ({ value, onChange, placeholder = 'Write your content here…', minHeight = 200 }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Sync incoming value only when it differs from the DOM (e.g. switching
  // the edited item) so typing never clobbers the caret position.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== value) el.innerHTML = value || '';
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML || '');
  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };
  const stopAndRun = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };

  const addLink = () => {
    const url = window.prompt('Link URL (leave empty to remove):', 'https://');
    if (url === null) return;
    if (!url) { exec('unlink'); return; }
    exec('createLink', url);
  };

  return (
    <div className="rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50" role="toolbar" aria-label="Formatting">
        <button type="button" title="Undo" aria-label="Undo" className={btn} onMouseDown={stopAndRun(() => exec('undo'))}>↶</button>
        <button type="button" title="Redo" aria-label="Redo" className={btn} onMouseDown={stopAndRun(() => exec('redo'))}>↷</button>
        <span className={sep} />
        <button type="button" title="Bold" aria-label="Bold" className={btn + ' font-extrabold'} onMouseDown={stopAndRun(() => exec('bold'))}>B</button>
        <button type="button" title="Italic" aria-label="Italic" className={btn + ' italic font-serif'} onMouseDown={stopAndRun(() => exec('italic'))}>I</button>
        <button type="button" title="Underline" aria-label="Underline" className={btn + ' underline'} onMouseDown={stopAndRun(() => exec('underline'))}>U</button>
        <span className={sep} />
        <button type="button" title="Heading 2" aria-label="Heading 2" className={btn + ' text-xs'} onMouseDown={stopAndRun(() => exec('formatBlock', '<h2>'))}>H2</button>
        <button type="button" title="Heading 3" aria-label="Heading 3" className={btn + ' text-xs'} onMouseDown={stopAndRun(() => exec('formatBlock', '<h3>'))}>H3</button>
        <button type="button" title="Normal paragraph" aria-label="Normal paragraph" className={btn + ' text-xs'} onMouseDown={stopAndRun(() => exec('formatBlock', '<p>'))}>¶</button>
        <span className={sep} />
        <button type="button" title="Bullet list" aria-label="Bullet list" className={btn} onMouseDown={stopAndRun(() => exec('insertUnorderedList'))}>•≡</button>
        <button type="button" title="Numbered list" aria-label="Numbered list" className={btn} onMouseDown={stopAndRun(() => exec('insertOrderedList'))}>1≡</button>
        <button type="button" title="Quote" aria-label="Quote" className={btn + ' font-serif'} onMouseDown={stopAndRun(() => exec('formatBlock', '<blockquote>'))}>❝</button>
        <span className={sep} />
        <button type="button" title="Insert link" aria-label="Insert link" className={btn} onMouseDown={stopAndRun(addLink)}>🔗</button>
        <button type="button" title="Clear formatting" aria-label="Clear formatting" className={btn} onMouseDown={stopAndRun(() => exec('removeFormat'))}>✕fmt</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Content"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={e => {
          // Insert pastes as plain text so Word/browser formatting never
          // pollutes the stored HTML.
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
          emit();
        }}
        className="rich-text px-4 py-3 text-sm text-slate-700 outline-none overflow-y-auto"
        style={{ minHeight }}
      />
    </div>
  );
};
