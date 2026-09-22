import React from 'react';

/* ============================================================
   Toolbar icons for the visual editor.
   Inline SVG (stroke based, 24×24) so the CMS stays dependency
   free and the icons inherit currentColor from the buttons.
   ============================================================ */

export type IconName =
  | 'undo' | 'redo' | 'bold' | 'italic' | 'underline' | 'strike' | 'code'
  | 'bulletList' | 'numberList' | 'quote' | 'hr'
  | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'link' | 'unlink' | 'image' | 'textColor' | 'highlight' | 'specialChar' | 'eraser'
  | 'expand' | 'collapse' | 'codeView' | 'eye' | 'chevronDown' | 'close'
  | 'trash' | 'upload' | 'library' | 'globe' | 'check' | 'warning' | 'pencil'
  | 'indent' | 'outdent' | 'rule' | 'paragraph';

const PATHS: Record<IconName, React.ReactNode> = {
  undo: <><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 1 2.6 6.4" /></>,
  redo: <><path d="M21 7v6h-6" /><path d="M20.5 13a9 9 0 1 0-2.6 6.4" /></>,
  bold: <><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" /></>,
  italic: <><line x1="19" y1="5" x2="10" y2="5" /><line x1="15" y1="19" x2="6" y2="19" /><line x1="15" y1="5" x2="9" y2="19" /></>,
  underline: <><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="5" y1="20" x2="19" y2="20" /></>,
  strike: <><line x1="4" y1="12" x2="20" y2="12" /><path d="M17 7c0-2-2.2-3-5-3s-5 1-5 3c0 1.4 1 2.3 2.5 3" /><path d="M7 17c0 2 2.2 3 5 3s5-1 5-3c0-1.4-1-2.3-2.5-3" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  bulletList: <><line x1="9" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="9" y1="18" x2="21" y2="18" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  numberList: <><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 5.5 5.5 4v4" /><path d="M3.5 11.5c0-.8.7-1.5 1.6-1.5s1.4.7 1.4 1.3c0 1.2-3 1.3-3 3.2h3" /><path d="M3.5 17.5h2.6l-1.6 3h1.8" /></>,
  quote: <><path d="M7 7h4v4a4 4 0 0 1-4 4z" /><path d="M15 7h4v4a4 4 0 0 1-4 4z" /></>,
  hr: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="6" y1="6" x2="18" y2="6" strokeDasharray="2 3" /><line x1="6" y1="18" x2="18" y2="18" strokeDasharray="2 3" /></>,
  alignLeft: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="13" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></>,
  alignCenter: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></>,
  alignRight: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="11" y1="12" x2="20" y2="12" /><line x1="6" y1="18" x2="20" y2="18" /></>,
  alignJustify: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>,
  link: <><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1" /><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" /></>,
  unlink: <><path d="M9 15l-1.5 1.5a3.5 3.5 0 0 1-5-5L4 10" /><path d="M15 9l1.5-1.5a3.5 3.5 0 0 1 5 5L20 14" /><line x1="3" y1="3" x2="21" y2="21" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 18 5-5 4 4 3-2.5 4 3.5" /></>,
  textColor: <><path d="M6 15 12 4l6 11" /><line x1="8" y1="11" x2="16" y2="11" /><rect x="4" y="19" width="16" height="2.5" rx="1" fill="currentColor" stroke="none" /></>,
  highlight: <><path d="m9 13 6-6 4 4-6 6H9z" /><path d="M7 16h10v4H7z" fill="currentColor" stroke="none" opacity=".35" /><path d="M5 4h6" /></>,
  specialChar: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /><circle cx="12" cy="12" r="3.2" /></>,
  eraser: <><path d="m14 4 6 6-8 8H6l-3-3z" /><line x1="9" y1="20" x2="20" y2="20" /></>,
  expand: <><path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" /></>,
  collapse: <><path d="M9 4v5H4M15 20v-5h5M20 9h-5V4M4 15h5v5" /></>,
  codeView: <><rect x="3" y="4" width="18" height="16" rx="2" /><polyline points="9 10 7 12 9 14" /><polyline points="15 10 17 12 15 14" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  close: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  upload: <><path d="M12 16V4" /><polyline points="7 9 12 4 17 9" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  library: <><rect x="3" y="4" width="7" height="7" rx="1" /><rect x="14" y="4" width="7" height="7" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /><rect x="14" y="15" width="7" height="6" rx="1" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18-2.5-2.6-2.5-15.4 0-18z" /></>,
  check: <polyline points="4 12 9 18 20 6" />,
  warning: <><path d="M12 4 2.5 20h19z" /><line x1="12" y1="10" x2="12" y2="15" /><circle cx="12" cy="17.6" r=".7" fill="currentColor" stroke="none" /></>,
  pencil: <><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m13 7 4 4" /></>,
  indent: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M4 10v4l3-2z" fill="currentColor" /></>,
  outdent: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><path d="M7 10v4l-3-2z" fill="currentColor" /></>,
  rule: <line x1="4" y1="12" x2="20" y2="12" />,
  paragraph: <><path d="M13 4H8a4 4 0 0 0 0 8h5" /><line x1="13" y1="4" x2="13" y2="20" /><line x1="17" y1="4" x2="17" y2="20" /></>,
};

export const Icon: React.FC<{ name: IconName; className?: string; strokeWidth?: number }> = ({ name, className = 'w-4 h-4', strokeWidth = 1.9 }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {PATHS[name]}
  </svg>
);
