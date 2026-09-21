import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sanitizeRichHtml } from '../utils/sanitize';
import { Icon } from './editor/icons';
import { MediaDialog } from './editor/MediaDialog';
import { LinkDialog, type LinkTarget } from './editor/LinkDialog';
import { ColorPicker } from './editor/ColorPicker';
import { SpecialCharPicker } from './editor/SpecialChars';
import { buildImageHtml, formatBytes, loadMediaLibrary, newMediaId, addToLibrary, optimizeImageFile, validateUpload } from './media';
import { clearDraft, formatDraftTime, htmlWordCount, readDraft, saveDraft, type DraftRecord } from './drafts';
import { escapeHtml, formatHtml } from './editor/html';

/* ============================================================
   RichTextEditor — the WordPress-style visual editor used by the
   built-in CMS for blog posts, page text blocks, tool "About"
   copy and sidebar notes.

   Visual / Code tabs · H1–H6 block dropdown · bold, italic,
   underline, strikethrough, inline code · bullet, numbered and
   quote blocks · alignment · links (dialog with target/nofollow) ·
   Add Media (upload, from URL, drag & drop, media library) ·
   text + highlight colour · undo/redo · special characters ·
   clear formatting · preview · fullscreen · browser autosave.

   Output is plain, sanitiser-friendly HTML: no editor cruft, no
   wrapper divs, no data-* noise. Public pages still pass every
   string through sanitizeRichHtml() before rendering.
   ============================================================ */

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Enables browser draft autosave under this key (see cms/drafts.ts). */
  draftKey?: string;
  /** Accessible name for the editing surface. */
  ariaLabel?: string;
  className?: string;
}

type Mode = 'visual' | 'code';
type ColorMode = 'text' | 'highlight';

const BLOCK_OPTIONS: { value: string; label: string }[] = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
  { value: 'h5', label: 'Heading 5' },
  { value: 'h6', label: 'Heading 6' },
  { value: 'blockquote', label: 'Quote' },
  { value: 'pre', label: 'Preformatted' },
];

const IMAGE_WIDTHS = ['25%', '50%', '75%', '100%'];

const toolBtn = 'inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:hover:bg-transparent';
const toolBtnActive = 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 hover:text-indigo-800';
const divider = 'w-px h-5 bg-slate-200 mx-1 flex-shrink-0';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start writing…',
  minHeight = 220,
  draftKey,
  ariaLabel = 'Rich text content',
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [mode, setMode] = useState<Mode>('visual');
  const [preview, setPreview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [charsOpen, setCharsOpen] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode | null>(null);
  const [linkTarget, setLinkTarget] = useState<LinkTarget | null>(null);
  const [pastePlain, setPastePlain] = useState(false);

  const [codeValue, setCodeValue] = useState(value);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [imageTick, setImageTick] = useState(0);

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [draftBlocked, setDraftBlocked] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftRecord | null>(null);

  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState('p');
  const [dropActive, setDropActive] = useState(false);

  const savedRange = useRef<Range | null>(null);
  const lastEmitted = useRef<string>(value);
  const initialValue = useRef<string>(value);
  const draftTimer = useRef<number | null>(null);

  /* ---------------- selection helpers ---------------- */

  const focusEditor = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus({ preventScroll: true });
  }, []);

  const saveRange = useCallback(() => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    if (!el.contains(sel.anchorNode)) return;
    savedRange.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const restoreRange = useCallback(() => {
    const el = ref.current;
    const range = savedRange.current;
    el?.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (el && range && sel) {
      try { sel.removeAllRanges(); sel.addRange(range); } catch { /* detached range */ }
    }
  }, []);

  const styleWithCss = useCallback(() => {
    try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* unsupported */ }
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmitted.current = html;
    onChangeRef.current(html);
  }, []);

  const refresh = useCallback(() => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return;
    const state = (command: string) => { try { return document.queryCommandState(command); } catch { return false; } };
    setActive({
      bold: state('bold'), italic: state('italic'), underline: state('underline'), strikeThrough: state('strikeThrough'),
      insertUnorderedList: state('insertUnorderedList'), insertOrderedList: state('insertOrderedList'),
      justifyLeft: state('justifyLeft'), justifyCenter: state('justifyCenter'),
      justifyRight: state('justifyRight'), justifyFull: state('justifyFull'),
    });
    let current = 'p';
    try {
      const raw = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
      if (raw && BLOCK_OPTIONS.some(option => option.value === raw)) current = raw;
    } catch { /* unsupported */ }
    setBlock(current);
  }, []);

  useEffect(() => {
    const handler = () => refresh();
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, [refresh]);

  // Close popovers when clicking outside the editor.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setColorMode(null); setCharsOpen(false); setLinkTarget(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  /* ---------------- keep the DOM in step with the value ---------------- */

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value || '';
  }, [value, mode]);

  // Mirror the parent value into the code textarea whenever we enter code view.
  useEffect(() => {
    if (mode === 'code') setCodeValue(value || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // A different item was opened in this editor instance — reset draft baselines.
  useEffect(() => {
    initialValue.current = value;
    setSavedAt(null);
    setPendingDraft(null);
    if (draftKey) {
      const existing = readDraft(draftKey);
      if (existing && existing.html && existing.html !== value) setPendingDraft(existing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  /* ---------------- commands ---------------- */

  /**
   * Browsers happily nest a list, quote or table inside the paragraph the
   * caret was in (`<p><ul>…</ul></p>`). That is invalid markup, so lift those
   * blocks out of their paragraph and drop the emptied paragraph afterwards.
   * The caret is preserved because the moved nodes themselves survive.
   */
  const normalizeBlocks = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const sel = window.getSelection();
    const savedRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    el.querySelectorAll('p > ul, p > ol, p > blockquote, p > pre, p > table, p > figure, p > hr').forEach(node => {
      const paragraph = node.parentElement;
      const parent = paragraph?.parentNode;
      if (!paragraph || !parent) return;
      parent.insertBefore(node, paragraph.nextSibling);
      if (!paragraph.textContent?.trim() && !paragraph.querySelector('img, br')) paragraph.remove();
    });

    if (savedRange && sel) {
      try { sel.removeAllRanges(); sel.addRange(savedRange); } catch { /* caret node replaced */ }
    }
  }, []);

  const exec = useCallback((command: string, arg?: string) => {
    focusEditor();
    styleWithCss();
    try { document.execCommand(command, false, arg); } catch { /* ignore */ }
    normalizeBlocks();
    emit();
    refresh();
  }, [emit, focusEditor, normalizeBlocks, refresh, styleWithCss]);

  const applyBlock = useCallback((tag: string) => {
    exec('formatBlock', `<${tag}>`);
    setBlock(tag);
  }, [exec]);

  const insertHtml = useCallback((html: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    try { document.execCommand('insertHTML', false, html); } catch {
      el.insertAdjacentHTML('beforeend', html);
    }
    normalizeBlocks();
    emit();
    refresh();
  }, [emit, normalizeBlocks, refresh]);

  /** Inline <code> for the current selection, or a preformatted block when collapsed. */
  const wrapInlineCode = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !ref.current?.contains(sel.anchorNode)) {
      applyBlock('pre');
      return;
    }
    const range = sel.getRangeAt(0);
    const code = document.createElement('code');
    try {
      range.surroundContents(code);
    } catch {
      code.appendChild(range.extractContents());
      range.insertNode(code);
    }
    const after = document.createRange();
    after.selectNodeContents(code);
    after.collapse(false);
    sel.removeAllRanges();
    sel.addRange(after);
    emit();
  }, [applyBlock, emit]);

  const insertText = useCallback((text: string) => {
    focusEditor();
    try { document.execCommand('insertText', false, text); } catch {
      ref.current?.insertAdjacentText('beforeend', text);
    }
    emit();
  }, [emit, focusEditor]);

  const setColor = useCallback((color: string, target: ColorMode) => {
    focusEditor();
    styleWithCss();
    try {
      if (target === 'text') document.execCommand('foreColor', false, color);
      else if (!document.execCommand('hiliteColor', false, color)) document.execCommand('backColor', false, color);
    } catch { /* ignore */ }
    emit();
    refresh();
  }, [emit, focusEditor, refresh, styleWithCss]);

  const clearColor = useCallback(() => {
    focusEditor();
    // removeFormat() drops colour and highlight but keeps bold/lists, which is
    // exactly what "remove colour" should do.
    try { document.execCommand('removeFormat', false); } catch { /* ignore */ }
    emit();
    refresh();
  }, [emit, focusEditor, refresh]);

  /* ---------------- links ---------------- */

  const anchorInSelection = useCallback((): HTMLAnchorElement | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') return node as HTMLAnchorElement;
      node = node.parentNode;
    }
    return null;
  }, []);

  const openLinkDialog = useCallback(() => {
    const anchor = anchorInSelection();
    const sel = window.getSelection();
    const selectedText = sel && !sel.isCollapsed ? String(sel) : '';
    saveRange();
    setLinkTarget({
      href: anchor?.getAttribute('href') || (selectedText ? '' : 'https://'),
      text: anchor ? '' : selectedText,
      newTab: anchor ? anchor.getAttribute('target') === '_blank' : true,
      nofollow: /nofollow/.test(anchor?.getAttribute('rel') || ''),
      existing: !!anchor,
    });
  }, [anchorInSelection, saveRange]);

  const applyLink = useCallback((target: LinkTarget) => {
    restoreRange();
    const anchor = anchorInSelection();
    if (anchor) {
      anchor.setAttribute('href', target.href);
      if (target.newTab) { anchor.setAttribute('target', '_blank'); anchor.setAttribute('rel', target.nofollow ? 'nofollow noopener noreferrer' : 'noopener noreferrer'); }
      else { anchor.removeAttribute('target'); if (target.nofollow) anchor.setAttribute('rel', 'nofollow'); else anchor.removeAttribute('rel'); }
    } else {
      const sel = window.getSelection();
      const collapsed = !sel || sel.isCollapsed;
      if (collapsed) {
        const label = target.text || target.href;
        const rel = target.newTab ? ` rel="${target.nofollow ? 'nofollow ' : ''}noopener noreferrer"` : target.nofollow ? ' rel="nofollow"' : '';
        insertHtml(`<a href="${escapeHtml(target.href)}"${target.newTab ? ' target="_blank"' : ''}${rel}>${escapeHtml(label)}</a>`);
      } else {
        exec('createLink', target.href);
        const created = anchorInSelection();
        if (created) {
          if (target.newTab) created.setAttribute('target', '_blank');
          const rel: string[] = [];
          if (target.nofollow) rel.push('nofollow');
          if (target.newTab) rel.push('noopener', 'noreferrer');
          if (rel.length) created.setAttribute('rel', rel.join(' '));
          emit();
        }
      }
    }
    setLinkTarget(null);
    emit();
  }, [anchorInSelection, emit, exec, insertHtml, restoreRange]);

  const removeLink = useCallback(() => {
    restoreRange();
    const anchor = anchorInSelection();
    if (anchor) {
      const parent = anchor.parentNode;
      while (anchor.firstChild) parent?.insertBefore(anchor.firstChild, anchor);
      anchor.remove();
    } else {
      exec('unlink');
    }
    setLinkTarget(null);
    emit();
  }, [anchorInSelection, emit, exec, restoreRange]);

  /* ---------------- media ---------------- */

  const openMedia = useCallback(() => { saveRange(); setMediaOpen(true); setError(''); }, [saveRange]);

  const setCaretFromPoint = useCallback((x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    if (typeof doc.caretRangeFromPoint === 'function') range = doc.caretRangeFromPoint(x, y);
    else if (typeof doc.caretPositionFromPoint === 'function') {
      const position = doc.caretPositionFromPoint(x, y);
      if (position) { range = document.createRange(); range.setStart(position.offsetNode, position.offset); range.collapse(true); }
    }
    if (!range || !el.contains(range.startContainer)) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const insertFiles = useCallback(async (files: File[], point?: { x: number; y: number }) => {
    if (!files.length) return;
    setBusy(true);
    setError('');
    setNotice('');
    if (point) setCaretFromPoint(point.x, point.y);
    const problems: string[] = [];
    const inserted: string[] = [];
    let bytes = 0;
    for (const file of files) {
      const problem = validateUpload(file);
      if (problem) { problems.push(`${file.name || 'image'}: ${problem}`); continue; }
      try {
        const optimized = await optimizeImageFile(file);
        insertHtml(buildImageHtml({ src: optimized.src, alt: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') }));
        inserted.push(file.name);
        bytes += optimized.bytes;
        if (optimized.bytes <= 350 * 1024) {
          addToLibrary({
            id: newMediaId(), src: optimized.src, alt: file.name, name: optimized.name,
            bytes: optimized.bytes, width: optimized.width, height: optimized.height, remote: false, createdAt: Date.now(),
          });
        }
      } catch (err) {
        problems.push(`${file.name || 'image'}: ${err instanceof Error ? err.message : 'could not be read'}`);
      }
    }
    if (inserted.length) setNotice(`${inserted.length} image${inserted.length > 1 ? 's' : ''} added (${formatBytes(bytes)}) — remember to set alt text.`);
    if (problems.length) setError(problems.join(' · '));
    setBusy(false);
  }, [insertHtml, setCaretFromPoint]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    const data = event.dataTransfer;
    if (!data) return;
    const files = Array.from(data.files || []).filter(file => file.type.startsWith('image/'));
    const html = data.getData('text/html');
    const plain = data.getData('text/uri-list') || data.getData('text/plain');
    if (!files.length && !html && !plain) return;
    event.preventDefault();
    setDropActive(false);
    if (files.length) { void insertFiles(files, { x: event.clientX, y: event.clientY }); return; }
    const imageMarkup = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i);
    if (imageMarkup) {
      setCaretFromPoint(event.clientX, event.clientY);
      insertHtml(`<img src="${escapeHtml(imageMarkup[1])}" alt="" loading="lazy" decoding="async" />`);
      setNotice('Image inserted from the dragged element — add alt text for SEO.');
      return;
    }
    const candidate = (plain || '').split('\n').map(line => line.trim()).find(line => /^https?:\/\//i.test(line));
    if (candidate) {
      setCaretFromPoint(event.clientX, event.clientY);
      insertHtml(`<img src="${escapeHtml(candidate)}" alt="" loading="lazy" decoding="async" />`);
      setNotice('Image inserted from the dropped link — add alt text for SEO.');
    }
  }, [insertFiles, insertHtml, setCaretFromPoint]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    const types = Array.from(event.dataTransfer?.types || []);
    if (types.includes('Files') || types.includes('text/html') || types.includes('text/uri-list')) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setDropActive(true);
    }
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const imageFiles = Array.from(clipboard.files || []).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length) {
      event.preventDefault();
      void insertFiles(imageFiles);
      return;
    }
    if (pastePlain) {
      event.preventDefault();
      insertText(clipboard.getData('text/plain'));
      return;
    }
    const html = clipboard.getData('text/html');
    if (html) {
      event.preventDefault();
      // Pasted markup is cleaned immediately so Word/Docs styling cannot leak in.
      insertHtml(sanitizeRichHtml(html));
      setNotice('Pasted content cleaned automatically.');
      return;
    }
    event.preventDefault();
    insertText(clipboard.getData('text/plain'));
  }, [insertFiles, insertHtml, insertText, pastePlain]);

  /* ---------------- image toolbar ---------------- */

  const imageAction = useCallback((action: 'align-none' | 'align-left' | 'align-center' | 'align-right' | 'remove') => {
    const img = selectedImage;
    if (!img) return;
    if (action === 'remove') {
      img.remove();
      setSelectedImage(null);
      emit();
      return;
    }
    img.style.display = '';
    img.style.marginLeft = '';
    img.style.marginRight = '';
    if (action === 'align-center') { img.style.display = 'block'; img.style.marginLeft = 'auto'; img.style.marginRight = 'auto'; }
    if (action === 'align-right') { img.style.display = 'block'; img.style.marginLeft = 'auto'; img.style.marginRight = '0'; }
    if (action === 'align-left') { img.style.display = 'block'; img.style.marginLeft = '0'; img.style.marginRight = 'auto'; }
    setImageTick(tick => tick + 1);
    emit();
  }, [emit, selectedImage]);

  const setImageWidth = useCallback((width: string) => {
    const img = selectedImage;
    if (!img) return;
    if (width === 'auto') img.style.removeProperty('width'); else img.style.width = width;
    setImageTick(tick => tick + 1);
    emit();
  }, [emit, selectedImage]);

  const wrapImageLink = useCallback(() => {
    const img = selectedImage;
    if (!img) return;
    const existing = img.closest('a');
    const url = window.prompt('Link this image to (leave empty to remove the link):', existing?.getAttribute('href') || 'https://');
    if (url === null) return;
    if (!url.trim()) {
      if (existing) {
        const parent = existing.parentNode;
        while (existing.firstChild) parent?.insertBefore(existing.firstChild, existing);
        existing.remove();
        emit();
      }
      return;
    }
    const href = /^[a-z]+:/i.test(url.trim()) || url.trim().startsWith('#') || url.trim().startsWith('/') ? url.trim() : `https://${url.trim()}`;
    if (existing) {
      existing.setAttribute('href', href);
    } else {
      const link = document.createElement('a');
      link.setAttribute('href', href);
      img.parentNode?.insertBefore(link, img);
      link.appendChild(img);
      setSelectedImage(img);
    }
    emit();
  }, [emit, selectedImage]);

  /* ---------------- draft autosave ---------------- */

  useEffect(() => {
    if (!draftKey) return;
    if (value === initialValue.current) return;
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      const ok = saveDraft(draftKey, value);
      setDraftBlocked(!ok);
      if (ok) setSavedAt(Date.now());
    }, 900);
    return () => { if (draftTimer.current) window.clearTimeout(draftTimer.current); };
  }, [value, draftKey]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    const el = ref.current;
    if (el) el.innerHTML = pendingDraft.html;
    lastEmitted.current = pendingDraft.html;
    onChangeRef.current(pendingDraft.html);
    setCodeValue(pendingDraft.html);
    setPendingDraft(null);
    setNotice('Draft restored from this browser. Save the item to keep it.');
  };

  const discardDraft = () => {
    if (draftKey) clearDraft(draftKey);
    setPendingDraft(null);
    setSavedAt(null);
  };

  /* ---------------- keyboard ---------------- */

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const meta = event.metaKey || event.ctrlKey;
    if (event.key === 'Escape') {
      if (fullscreen) { setFullscreen(false); return; }
      setColorMode(null); setCharsOpen(false); setLinkTarget(null); setSelectedImage(null);
      return;
    }
    if (meta && event.key.toLowerCase() === 'k' && !event.shiftKey) {
      event.preventDefault();
      openLinkDialog();
      return;
    }
    // WordPress heading shortcuts: Alt+Shift+1…6 (Windows/Linux) and Ctrl+Alt+1…6.
    const headingKey = /^[1-6]$/.test(event.key) && ((event.altKey && event.shiftKey) || (meta && event.altKey));
    if (headingKey) {
      event.preventDefault();
      applyBlock(`h${event.key}`);
      return;
    }
    if (/^[07]$/.test(event.key) && ((event.altKey && event.shiftKey) || (meta && event.altKey))) {
      event.preventDefault();
      applyBlock('p');
      return;
    }
    if (event.key === 'Tab' && !event.ctrlKey && !event.altKey) {
      const listActive = active.insertUnorderedList || active.insertOrderedList;
      if (listActive) {
        event.preventDefault();
        exec(event.shiftKey ? 'outdent' : 'indent');
      }
    }
  }, [active.insertOrderedList, active.insertUnorderedList, applyBlock, exec, fullscreen, openLinkDialog]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    refresh();
    const el = ref.current;
    if (!el) { setSelectedImage(null); return; }
    // Prefer the actual click target: clicking an image does not always leave
    // the <img> as the selection anchor node (browsers often report its parent).
    const target = event.target as Element | null;
    let img = target?.closest?.('img') as HTMLImageElement | null;
    if (!img) {
      const sel = window.getSelection();
      const node = sel?.rangeCount ? sel.anchorNode : null;
      const element = node?.nodeType === Node.ELEMENT_NODE ? (node as Element) : node?.parentElement;
      img = (element?.closest?.('img') as HTMLImageElement | null) || null;
    }
    setSelectedImage(img && el.contains(img) ? img : null);
  }, [refresh]);

  /* ---------------- fullscreen ---------------- */

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Escape must work wherever focus is (the fullscreen button keeps focus
    // after it is clicked), not only while the editing surface has focus.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setFullscreen(false); setMediaOpen(false); setLinkTarget(null); setCharsOpen(false); setColorMode(null); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [fullscreen]);

  /* ---------------- derived ---------------- */

  const words = useMemo(() => htmlWordCount(value), [value]);
  const characters = useMemo(() => (value || '').replace(/<[^>]*>/g, '').length, [value]);
  const headings = useMemo(() => ((value || '').match(/<h[1-6][^>]*>/gi) || []).length, [value]);
  const images = useMemo(() => ((value || '').match(/<img\b/gi) || []).length, [value]);
  const previewHtml = useMemo(() => (preview ? sanitizeRichHtml(value) : ''), [preview, value]);
  const libraryCount = useMemo(() => loadMediaLibrary().length, [savedAt, mediaOpen]);
  const blockValue = BLOCK_OPTIONS.some(option => option.value === block) ? block : 'p';

  const wrapperCls = fullscreen
    ? 'fixed inset-0 z-[75] bg-white flex flex-col'
    : `relative rounded-xl border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 ${className}`;

  const surfaceCls = `rte-surface rich-text px-4 py-3 text-sm text-slate-700 outline-none ${fullscreen ? 'flex-1 overflow-y-auto' : 'overflow-y-auto'}`;

  return (
    <div ref={wrapperRef} className={wrapperCls}>
      {/* -------- tab bar -------- */}
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <div role="tablist" aria-label="Editor mode" className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'visual'}
            onClick={() => { if (mode === 'visual') return; setMode('visual'); setPreview(false); setNotice(''); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mode === 'visual' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Icon name="eye" className="w-3.5 h-3.5" /> Visual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'code'}
            onClick={() => {
              if (mode === 'code') return;
              const raw = ref.current?.innerHTML || value || '';
              setCodeValue(raw);
              setMode('code');
              setPreview(false);
              setColorMode(null); setCharsOpen(false); setLinkTarget(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${mode === 'code' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Icon name="codeView" className="w-3.5 h-3.5" /> Code
          </button>
        </div>

        <span className="text-[11px] text-slate-400 hidden lg:inline">
          {mode === 'code' ? 'Editing raw HTML — leave the tab to clean it automatically' : preview ? 'Preview of the sanitised public output' : `${isMac ? '⌘' : 'Ctrl'}+K link · ${isMac ? '⌘' : 'Ctrl'}+B bold · Alt+Shift+1–6 headings`}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {mode === 'visual' && (
            <button
              type="button"
              aria-pressed={pastePlain}
              title="Paste as plain text"
              onClick={() => setPastePlain(!pastePlain)}
              className={`${toolBtn} ${pastePlain ? toolBtnActive : ''} w-auto px-2 text-[11px] font-bold`}
            >
              Paste as text
            </button>
          )}
          {mode === 'visual' && (
            <button
              type="button"
              aria-pressed={preview}
              title={preview ? 'Back to editing' : 'Preview sanitised output'}
              onClick={() => { setPreview(!preview); setNotice(''); }}
              className={`${toolBtn} ${preview ? toolBtnActive : ''}`}
            >
              <Icon name="eye" />
            </button>
          )}
          <button
            type="button"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-pressed={fullscreen}
            onClick={() => setFullscreen(!fullscreen)}
            className={`${toolBtn} ${fullscreen ? toolBtnActive : ''}`}
          >
            <Icon name={fullscreen ? 'collapse' : 'expand'} />
          </button>
        </div>
      </div>

      {/* -------- toolbar -------- */}
      {mode === 'visual' && !preview && (
        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 px-2.5 py-2 border-b border-slate-200 bg-white">
          <button type="button" className={toolBtn} title="Undo (Ctrl+Z)" aria-label="Undo" onMouseDown={e => { e.preventDefault(); exec('undo'); }}><Icon name="undo" /></button>
          <button type="button" className={toolBtn} title="Redo (Ctrl+Y)" aria-label="Redo" onMouseDown={e => { e.preventDefault(); exec('redo'); }}><Icon name="redo" /></button>
          <span className={divider} />

          <label className="relative inline-flex items-center">
            <span className="sr-only">Block format</span>
            <select
              value={blockValue}
              onMouseDown={saveRange}
              onFocus={saveRange}
              onChange={e => { restoreRange(); applyBlock(e.target.value); }}
              className="h-8 pl-2 pr-7 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 appearance-none cursor-pointer"
              title="Paragraph / heading style"
            >
              {BLOCK_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 text-slate-400"><Icon name="chevronDown" className="w-3.5 h-3.5" /></span>
          </label>
          <span className={divider} />

          <button type="button" className={`${toolBtn} ${active.bold ? toolBtnActive : ''}`} aria-pressed={active.bold} title="Bold (Ctrl+B)" aria-label="Bold" onMouseDown={e => { e.preventDefault(); exec('bold'); }}><Icon name="bold" /></button>
          <button type="button" className={`${toolBtn} ${active.italic ? toolBtnActive : ''}`} aria-pressed={active.italic} title="Italic (Ctrl+I)" aria-label="Italic" onMouseDown={e => { e.preventDefault(); exec('italic'); }}><Icon name="italic" /></button>
          <button type="button" className={`${toolBtn} ${active.underline ? toolBtnActive : ''}`} aria-pressed={active.underline} title="Underline (Ctrl+U)" aria-label="Underline" onMouseDown={e => { e.preventDefault(); exec('underline'); }}><Icon name="underline" /></button>
          <button type="button" className={`${toolBtn} ${active.strikeThrough ? toolBtnActive : ''}`} aria-pressed={active.strikeThrough} title="Strikethrough" aria-label="Strikethrough" onMouseDown={e => { e.preventDefault(); exec('strikeThrough'); }}><Icon name="strike" /></button>
          <button type="button" className={toolBtn} title="Code — inline, or preformatted block" aria-label="Code" onMouseDown={e => { e.preventDefault(); wrapInlineCode(); }}><Icon name="code" /></button>
          <span className={divider} />

          <button type="button" className={`${toolBtn} ${active.insertUnorderedList ? toolBtnActive : ''}`} aria-pressed={active.insertUnorderedList} title="Bulleted list" aria-label="Bulleted list" onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}><Icon name="bulletList" /></button>
          <button type="button" className={`${toolBtn} ${active.insertOrderedList ? toolBtnActive : ''}`} aria-pressed={active.insertOrderedList} title="Numbered list" aria-label="Numbered list" onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}><Icon name="numberList" /></button>
          <button type="button" className={`${toolBtn} ${blockValue === 'blockquote' ? toolBtnActive : ''}`} title="Quote" aria-label="Quote" onMouseDown={e => { e.preventDefault(); applyBlock(blockValue === 'blockquote' ? 'p' : 'blockquote'); }}><Icon name="quote" /></button>
          <span className={divider} />

          <button type="button" className={`${toolBtn} ${active.justifyLeft ? toolBtnActive : ''}`} aria-pressed={active.justifyLeft} title="Align left" aria-label="Align left" onMouseDown={e => { e.preventDefault(); exec('justifyLeft'); }}><Icon name="alignLeft" /></button>
          <button type="button" className={`${toolBtn} ${active.justifyCenter ? toolBtnActive : ''}`} aria-pressed={active.justifyCenter} title="Align centre" aria-label="Align centre" onMouseDown={e => { e.preventDefault(); exec('justifyCenter'); }}><Icon name="alignCenter" /></button>
          <button type="button" className={`${toolBtn} ${active.justifyRight ? toolBtnActive : ''}`} aria-pressed={active.justifyRight} title="Align right" aria-label="Align right" onMouseDown={e => { e.preventDefault(); exec('justifyRight'); }}><Icon name="alignRight" /></button>
          <button type="button" className={`${toolBtn} ${active.justifyFull ? toolBtnActive : ''}`} aria-pressed={active.justifyFull} title="Justify" aria-label="Justify" onMouseDown={e => { e.preventDefault(); exec('justifyFull'); }}><Icon name="alignJustify" /></button>
          <span className={divider} />

          <button type="button" className={toolBtn} title="Insert / edit link (Ctrl+K)" aria-label="Insert or edit link" onMouseDown={e => { e.preventDefault(); openLinkDialog(); }}><Icon name="link" /></button>
          <button type="button" className={toolBtn} title="Add media" aria-label="Add media" onMouseDown={e => { e.preventDefault(); openMedia(); }}><Icon name="image" /></button>
          <span className={divider} />

          <div className="relative">
            <button
              type="button"
              className={`${toolBtn} ${colorMode === 'text' ? toolBtnActive : ''}`}
              title="Text colour"
              aria-label="Text colour"
              aria-expanded={colorMode === 'text'}
              onMouseDown={e => { e.preventDefault(); saveRange(); setColorMode(colorMode === 'text' ? null : 'text'); }}
            ><Icon name="textColor" /></button>
            {colorMode === 'text' && (
              <ColorPicker
                title="Text colour"
                mode="text"
                onPick={color => { restoreRange(); setColor(color, 'text'); }}
                onClear={() => { restoreRange(); clearColor(); }}
                onClose={() => setColorMode(null)}
              />
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className={`${toolBtn} ${colorMode === 'highlight' ? toolBtnActive : ''}`}
              title="Highlight colour"
              aria-label="Highlight colour"
              aria-expanded={colorMode === 'highlight'}
              onMouseDown={e => { e.preventDefault(); saveRange(); setColorMode(colorMode === 'highlight' ? null : 'highlight'); }}
            ><Icon name="highlight" /></button>
            {colorMode === 'highlight' && (
              <ColorPicker
                title="Highlight"
                mode="highlight"
                onPick={color => { restoreRange(); setColor(color, 'highlight'); }}
                onClear={() => { restoreRange(); clearColor(); }}
                onClose={() => setColorMode(null)}
              />
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              className={`${toolBtn} ${charsOpen ? toolBtnActive : ''}`}
              title="Special characters"
              aria-label="Special characters"
              aria-expanded={charsOpen}
              onMouseDown={e => { e.preventDefault(); saveRange(); setCharsOpen(!charsOpen); }}
            ><Icon name="specialChar" /></button>
            {charsOpen && (
              <SpecialCharPicker
                onPick={char => { restoreRange(); insertText(char); }}
                onClose={() => setCharsOpen(false)}
              />
            )}
          </div>
          <button type="button" className={toolBtn} title="Clear formatting" aria-label="Clear formatting" onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }}><Icon name="eraser" /></button>
          <span className={divider} />
          <button
            type="button"
            className={`${toolBtn} w-auto px-2 text-[11px] font-bold gap-1`}
            title="Horizontal rule"
            onMouseDown={e => { e.preventDefault(); insertHtml('<hr />'); }}
          ><Icon name="hr" className="w-4 h-4" /></button>
        </div>
      )}

      {/* -------- media toolbar for the selected image -------- */}
      {selectedImage && mode === 'visual' && !preview && (
        <div key={imageTick} className="flex flex-wrap items-center gap-2 px-2.5 py-2 border-b border-indigo-100 bg-indigo-50/70 text-xs">
          <span className="font-bold text-indigo-800">Image</span>
          <div className="flex items-center gap-0.5">
            {([['align-none', 'rule'], ['align-left', 'alignLeft'], ['align-center', 'alignCenter'], ['align-right', 'alignRight']] as const).map(([action, icon]) => (
              <button key={action} type="button" className={toolBtn} title={action.replace('align-', 'align ')} onClick={() => imageAction(action)}>
                <Icon name={icon} />
              </button>
            ))}
          </div>
          <span className={divider} />
          <div className="flex items-center gap-1">
            {IMAGE_WIDTHS.map(width => (
              <button key={width} type="button" onClick={() => setImageWidth(width)} className="px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-600 hover:border-indigo-400">{width}</button>
            ))}
            <button type="button" onClick={() => setImageWidth('auto')} className="px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-600 hover:border-indigo-400">Auto</button>
          </div>
          <span className={divider} />
          <label className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Alt</span>
            <input
              value={selectedImage.getAttribute('alt') || ''}
              onChange={e => { selectedImage.setAttribute('alt', e.target.value); emit(); }}
              placeholder="Describe the image"
              className="w-40 px-2 py-1 rounded-md border border-slate-300 bg-white text-xs outline-none focus:border-indigo-500"
            />
          </label>
          <button type="button" onClick={wrapImageLink} className="px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-600 hover:border-indigo-400">Link…</button>
          <button type="button" onClick={() => { setSelectedImage(null); }} className="px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-600 hover:border-indigo-400">Deselect</button>
          <button type="button" onClick={() => imageAction('remove')} className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 text-[11px] font-bold text-red-700 hover:bg-red-100">
            <Icon name="trash" className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      )}

      {/* -------- draft restore banner -------- */}
      {pendingDraft && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-amber-200 bg-amber-50 text-xs text-amber-900">
          <Icon name="warning" className="w-4 h-4" />
          <span>
            Unsaved draft from this browser — <strong>{formatDraftTime(pendingDraft.savedAt)}</strong> · {pendingDraft.words} words.
          </span>
          <button type="button" onClick={restoreDraft} className="ml-auto px-2.5 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600">Restore draft</button>
          <button type="button" onClick={discardDraft} className="px-2.5 py-1.5 rounded-lg border border-amber-300 font-semibold hover:bg-amber-100">Discard</button>
        </div>
      )}

      {/* -------- popovers -------- */}
      {(linkTarget) && (
        <div className="relative h-0">
          <LinkDialog target={linkTarget} onApply={applyLink} onRemove={removeLink} onClose={() => setLinkTarget(null)} />
        </div>
      )}

      {/* -------- editing surface -------- */}
      <div className="relative">
        <div
          ref={ref}
          contentEditable={mode === 'visual' && !preview}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          data-placeholder={placeholder}
          spellCheck
          className={`${surfaceCls} ${mode === 'visual' && !preview ? '' : 'hidden'}`}
          style={{ minHeight: fullscreen ? 0 : minHeight }}
          onInput={() => { emit(); refresh(); }}
          onBlur={() => emit()}
          onFocus={() => { styleWithCss(); try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* ignore */ } }}
          onKeyDown={handleKeyDown}
          onKeyUp={refresh}
          onMouseUp={handleMouseUp}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDropActive(false)}
        />

        {mode === 'code' && (
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 text-[11px] text-slate-500">
              <span>Raw HTML. Scripts, inline event handlers and unsafe URLs are stripped automatically — press <strong>Clean up</strong> or switch to Visual to apply it now.</span>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => setCodeValue(formatHtml(codeValue))} className="px-2 py-1 rounded-md border border-slate-300 bg-white font-semibold hover:bg-slate-50">Format</button>
                <button
                  type="button"
                  onClick={() => {
                    const clean = sanitizeRichHtml(codeValue);
                    setCodeValue(clean);
                    lastEmitted.current = clean;
                    onChangeRef.current(clean);
                    if (ref.current) ref.current.innerHTML = clean;
                    setNotice('HTML cleaned and stored.');
                  }}
                  className="px-2 py-1 rounded-md bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                >Clean up</button>
              </div>
            </div>
            <textarea
              value={codeValue}
              spellCheck={false}
              onChange={e => { setCodeValue(e.target.value); lastEmitted.current = e.target.value; onChangeRef.current(e.target.value); }}
              onBlur={() => {
                const clean = sanitizeRichHtml(codeValue);
                setCodeValue(clean);
                lastEmitted.current = clean;
                onChangeRef.current(clean);
                if (ref.current) ref.current.innerHTML = clean;
              }}
              className="w-full font-mono text-xs leading-relaxed p-3 outline-none resize-y bg-slate-950 text-emerald-100"
              style={{ minHeight: fullscreen ? 0 : Math.max(minHeight, 240), flex: fullscreen ? 1 : undefined }}
              aria-label={`${ariaLabel} (HTML source)`}
            />
          </div>
        )}

        {preview && (
          <div className="rich-text px-4 py-3 text-sm text-slate-700 overflow-y-auto" style={{ minHeight: fullscreen ? 0 : minHeight }} aria-label="Preview">
            {previewHtml
              ? <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              : <p className="text-slate-400">Nothing to preview yet — switch back to the Visual tab and start writing.</p>}
          </div>
        )}

        {dropActive && mode === 'visual' && !preview && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/80">
            <p className="text-sm font-bold text-indigo-700">Drop image or link to insert</p>
          </div>
        )}
      </div>

      {/* -------- status bar -------- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 rounded-b-xl">
        <span><strong className="text-slate-700">{words}</strong> words</span>
        <span><strong className="text-slate-700">{characters}</strong> characters</span>
        <span>{headings} headings</span>
        <span>{images} images</span>
        {busy && <span className="text-indigo-600 font-bold">Optimising image…</span>}
        <span className="ml-auto flex items-center gap-2">
          {notice && <span className="text-emerald-600">{notice}</span>}
          {error && <span className="text-red-600">{error}</span>}
          {draftKey && (
            draftBlocked
              ? <span className="text-amber-600 font-semibold">Draft could not be saved — browser storage is full</span>
              : savedAt
                ? <span className="inline-flex items-center gap-1 text-emerald-600"><Icon name="check" className="w-3 h-3" /> Draft saved {formatDraftTime(savedAt)}</span>
                : <span>Autosave on</span>
          )}
        </span>
        <span className="hidden sm:inline text-slate-400">· {mode === 'code' ? 'Code' : 'Visual'} · {libraryCount} media</span>
      </div>

      {mediaOpen && (
        <MediaDialog
          onInsert={(html, summary) => {
            restoreRange();
            insertHtml(html);
            setMediaOpen(false);
            setNotice(`Inserted ${summary}. Set alt text in the image toolbar.`);
          }}
          onClose={() => setMediaOpen(false)}
        />
      )}
    </div>
  );
};

export default RichTextEditor;
