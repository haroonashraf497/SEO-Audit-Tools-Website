import React, { useMemo, useState } from 'react';
import { Output } from './engines';
import { Stat } from './WebTools';

// ---------- Formatters ----------
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype']);
const INLINE_TAGS = new Set(['a', 'span', 'strong', 'em', 'b', 'i', 'u', 'small', 'code', 'label', 'abbr', 'sub', 'sup', 'mark', 'time']);

export const formatHtml = (src: string, indent = '  '): string => {
  const tokens = src.replace(/>\s+</g, '><').match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
  let depth = 0; const out: string[] = []; let inPre = false;
  for (const raw of tokens) {
    const t = raw.trim(); if (!t) continue;
    if (inPre) { out[out.length - 1] += raw; if (/<\/pre>/i.test(raw)) inPre = false; continue; }
    const isClose = /^<\//.test(t);
    const tagName = (t.match(/^<\/?\s*([a-zA-Z0-9!-]+)/) || [])[1]?.toLowerCase() || '';
    const isVoid = VOID_TAGS.has(tagName) || /\/>$/.test(t) || t.startsWith('<!');
    const isComment = t.startsWith('<!--');
    const isText = !t.startsWith('<');
    if (isClose) depth = Math.max(0, depth - 1);
    if (isText && INLINE_TAGS.size && out.length && /<(a|span|strong|em|b|i|code|label)\b[^>]*>$/i.test(out[out.length - 1])) { out[out.length - 1] += t; continue; }
    out.push(indent.repeat(depth) + t);
    if (!isClose && !isVoid && !isComment && !isText) depth++;
    if (/^<pre\b/i.test(t)) inPre = true;
  }
  // Pull inline closing tags back onto the same line
  return out.join('\n').replace(/\n\s*(<\/(a|span|strong|em|b|i|code|label|abbr|sub|sup|mark|time|title|h[1-6]|p|li|td|th|button|option)>)/gi, '$1');
};

export const formatXml = (src: string, indent = '  '): { out: string; error: string; elements: number; attrs: number; depth: number } => {
  let error = '';
  try {
    const doc = new DOMParser().parseFromString(src, 'application/xml');
    const pe = doc.querySelector('parsererror');
    if (pe) error = (pe.textContent || 'Invalid XML').replace(/\s+/g, ' ').slice(0, 220);
  } catch { error = 'Could not parse XML'; }
  const tokens = src.replace(/>\s+</g, '><').trim().match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) || [];
  let depth = 0, maxDepth = 0, elements = 0, attrs = 0; const out: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim(); if (!t) continue;
    const isClose = /^<\//.test(t); const isSelf = /\/>$/.test(t) || /^<\?|^<!/.test(t); const isText = !t.startsWith('<');
    if (isClose) depth = Math.max(0, depth - 1);
    if (isText && out.length) { out[out.length - 1] += t; continue; }
    if (isClose && out.length && !/^\s*</.test(out[out.length - 1].slice(out[out.length - 1].lastIndexOf('>') + 1)) && !out[out.length - 1].trimEnd().endsWith('>')) { out[out.length - 1] += t; continue; }
    out.push(indent.repeat(depth) + t);
    if (!isClose && !isSelf) { depth++; elements++; attrs += (t.match(/\s[\w:.-]+=/g) || []).length; maxDepth = Math.max(maxDepth, depth); }
  }
  return { out: out.join('\n'), error, elements, attrs, depth: maxDepth };
};

export const formatPhp = (src: string, indent = '    '): string => {
  const lines = src.replace(/\r\n/g, '\n').replace(/\{\s*\n/g, '{\n').replace(/;\s*(?=\S)/g, ';\n').replace(/\}\s*(else|elseif|catch|finally)/g, '}\n$1').split('\n');
  let depth = 0; const out: string[] = [];
  for (const raw of lines) {
    let l = raw.trim(); if (!l) { out.push(''); continue; }
    l = l.replace(/\s*=\s*/g, ' = ').replace(/\s*=>\s*/g, ' => ').replace(/\s*==\s*/g, ' == ').replace(/\s*===\s*/g, ' === ').replace(/\s*!=\s*/g, ' != ').replace(/,(?=\S)/g, ', ').replace(/\s*\.\s*=/g, ' .=').replace(/\)\s*\{/g, ') {').replace(/\b(if|for|foreach|while|switch|catch)\(/g, '$1 (').replace(/ = =/g, ' ==').replace(/ = = =/g, ' ===').replace(/! =/g, '!=').replace(/ = >/g, ' =>');
    const closes = (l.match(/^[)}\]]+/) || [''])[0].length; if (closes) depth = Math.max(0, depth - 1);
    if (/^(case\b.*:|default:)/.test(l)) out.push(indent.repeat(Math.max(0, depth - 1)) + l); else out.push(indent.repeat(depth) + l);
    const opens = (l.match(/[{([]/g) || []).length - (l.match(/[})\]]/g) || []).length + (closes ? 1 : 0) - (l.match(/^[)}\]]+/) ? 0 : 0);
    if (opens > 0) depth += 1; else if (opens < 0 && !closes) depth = Math.max(0, depth - 1);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
};

const Toolbar: React.FC<{ onClear: () => void; onSample: () => void; extra?: React.ReactNode; children?: React.ReactNode }> = ({ onClear, onSample, extra, children }) => (
  <div className="flex flex-wrap items-center gap-2">{children}<button type="button" onClick={onSample} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700">Load sample</button><button type="button" onClick={onClear} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700">Clear</button>{extra}</div>
);

const SAMPLE_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sample</title><link rel="stylesheet" href="style.css"></head><body><header class="site"><h1>Hello <span>World</span></h1><nav><ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul></nav></header><main><p>This is a <strong>sample</strong> paragraph.</p><img src="a.jpg" alt="A"></main></body></html>';
const SAMPLE_XML = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc><lastmod>2025-01-01</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url><url><loc>https://example.com/about</loc><priority>0.8</priority></url></urlset>';
const SAMPLE_PHP = '<?php\nfunction greet($name){if($name==""){return "Hello, guest";}else{$msg="Hello, ".$name;return $msg;}}\nforeach($users as $k=>$u){echo greet($u["name"]);}\nclass Cart{private $items=[];public function add($item,$qty=1){$this->items[]=["item"=>$item,"qty"=>$qty];return $this;}}';

// ---------- HTML Formatter ----------
export const HtmlFormatterTool: React.FC = () => {
  const [src, setSrc] = useState('');
  const [indent, setIndent] = useState('  ');
  const out = useMemo(() => (src.trim() ? formatHtml(src, indent) : ''), [src, indent]);
  return (
    <div className="space-y-4">
      <Toolbar onClear={() => setSrc('')} onSample={() => setSrc(SAMPLE_HTML)} extra={<select aria-label="Indentation" value={indent} onChange={e => setIndent(e.target.value)} className="ml-auto text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"><option value="  ">2 spaces</option><option value="    ">4 spaces</option><option value={'\t'}>Tab</option></select>} />
      <textarea aria-label="HTML source" value={src} onChange={e => setSrc(e.target.value)} rows={10} spellCheck={false} placeholder="Paste minified or messy HTML…" className="w-full p-4 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" />
      {out && <><div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Stat label="Input lines" value={src.split('\n').length} /><Stat label="Output lines" value={out.split('\n').length} /><Stat label="Tags" value={(src.match(/<[a-zA-Z]/g) || []).length} /><Stat label="Size" value={`${(new Blob([out]).size / 1024).toFixed(1)} KB`} /></div><Output label="Formatted HTML" value={out} /></>}
    </div>
  );
};

// ---------- XML Formatter / Beautifier ----------
export const XmlFormatterTool: React.FC = () => {
  const [src, setSrc] = useState('');
  const [indent, setIndent] = useState('  ');
  const r = useMemo(() => (src.trim() ? formatXml(src, indent) : null), [src, indent]);
  return (
    <div className="space-y-4">
      <Toolbar onClear={() => setSrc('')} onSample={() => setSrc(SAMPLE_XML)} extra={<select aria-label="Indentation" value={indent} onChange={e => setIndent(e.target.value)} className="ml-auto text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"><option value="  ">2 spaces</option><option value="    ">4 spaces</option><option value={'\t'}>Tab</option></select>} />
      <textarea aria-label="XML source" value={src} onChange={e => setSrc(e.target.value)} rows={10} spellCheck={false} placeholder="Paste XML, RSS or a sitemap…" className="w-full p-4 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" />
      {r && (<>
        <div className={`rounded-xl p-4 text-sm border ${r.error ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>{r.error ? `✗ Invalid XML: ${r.error}` : '✓ Well-formed XML'}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Stat label="Elements" value={r.elements} /><Stat label="Attributes" value={r.attrs} /><Stat label="Max depth" value={r.depth} /><Stat label="Size" value={`${(new Blob([r.out]).size / 1024).toFixed(1)} KB`} /></div>
        <Output label="Formatted XML" value={r.out} />
      </>)}
    </div>
  );
};

// ---------- PHP Formatter ----------
export const PhpFormatterTool: React.FC = () => {
  const [src, setSrc] = useState('');
  const [indent, setIndent] = useState('    ');
  const out = useMemo(() => (src.trim() ? formatPhp(src, indent) : ''), [src, indent]);
  return (
    <div className="space-y-4">
      <Toolbar onClear={() => setSrc('')} onSample={() => setSrc(SAMPLE_PHP)} extra={<select aria-label="Indentation" value={indent} onChange={e => setIndent(e.target.value)} className="ml-auto text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white"><option value="    ">4 spaces (PSR-12)</option><option value="  ">2 spaces</option><option value={'\t'}>Tab</option></select>} />
      <textarea aria-label="PHP source" value={src} onChange={e => setSrc(e.target.value)} rows={10} spellCheck={false} placeholder="Paste PHP code…" className="w-full p-4 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" />
      {out && <><div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Stat label="Lines" value={out.split('\n').length} /><Stat label="Functions" value={(src.match(/\bfunction\s+\w+/g) || []).length} /><Stat label="Classes" value={(src.match(/\bclass\s+\w+/g) || []).length} /><Stat label="Variables" value={new Set(src.match(/\$\w+/g) || []).size} /></div><Output label="Formatted PHP" value={out} /><p className="text-xs text-slate-400">Applies PSR-12-style spacing around operators, one statement per line and brace indentation. Review complex string literals manually.</p></>}
    </div>
  );
};

// ---------- HTML Editor (live preview) ----------
const TEMPLATES: Record<string, string> = {
  blank: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My Page</title>\n  <style>\n    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1e293b; }\n  </style>\n</head>\n<body>\n  <h1>Hello, world!</h1>\n  <p>Start editing to see changes instantly.</p>\n</body>\n</html>',
  landing: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Landing Page</title>\n  <style>\n    * { box-sizing: border-box; } body { margin: 0; font-family: system-ui, sans-serif; }\n    .hero { background: linear-gradient(135deg,#6366f1,#a855f7); color: #fff; padding: 4rem 1.5rem; text-align: center; }\n    .hero h1 { font-size: 2.5rem; margin: 0 0 .5rem; } .btn { display: inline-block; margin-top: 1.5rem; background: #fff; color: #4f46e5; padding: .8rem 1.6rem; border-radius: .6rem; font-weight: 700; text-decoration: none; }\n    .features { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 1rem; padding: 2rem 1.5rem; max-width: 960px; margin: auto; }\n    .card { border: 1px solid #e2e8f0; border-radius: .8rem; padding: 1.2rem; }\n  </style>\n</head>\n<body>\n  <section class="hero"><h1>Launch faster</h1><p>A tiny landing page template.</p><a class="btn" href="#">Get started</a></section>\n  <section class="features"><div class="card"><h3>Fast</h3><p>Zero dependencies.</p></div><div class="card"><h3>Simple</h3><p>Edit and preview live.</p></div><div class="card"><h3>Responsive</h3><p>Works on any screen.</p></div></section>\n</body>\n</html>',
  form: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Contact Form</title>\n  <style>\n    body { font-family: system-ui, sans-serif; background: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; }\n    form { background: #fff; padding: 2rem; border-radius: 1rem; width: min(90vw, 380px); box-shadow: 0 10px 30px rgba(0,0,0,.08); }\n    label { display: block; font-size: .85rem; font-weight: 600; margin: .8rem 0 .3rem; } input, textarea { width: 100%; padding: .7rem; border: 1px solid #cbd5e1; border-radius: .5rem; }\n    button { margin-top: 1rem; width: 100%; padding: .8rem; border: 0; border-radius: .5rem; background: #6366f1; color: #fff; font-weight: 700; }\n  </style>\n</head>\n<body>\n  <form><h2>Contact us</h2><label>Name</label><input placeholder="Jane Doe"><label>Email</label><input type="email" placeholder="jane@example.com"><label>Message</label><textarea rows="4"></textarea><button type="button">Send</button></form>\n</body>\n</html>',
};
export const HtmlEditorTool: React.FC = () => {
  const [code, setCode] = useState(TEMPLATES.blank);
  const [layout, setLayout] = useState<'split' | 'code' | 'preview'>('split');
  const [auto, setAuto] = useState(true);
  const [preview, setPreview] = useState(TEMPLATES.blank);
  const shown = auto ? code : preview;
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/html' })); a.download = 'index.html'; a.click(); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Page template" onChange={e => { setCode(TEMPLATES[e.target.value]); setPreview(TEMPLATES[e.target.value]); }} defaultValue="blank" className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"><option value="blank">Blank page</option><option value="landing">Landing page</option><option value="form">Contact form</option></select>
        <div className="flex bg-slate-100 rounded-lg p-0.5">{(['split', 'code', 'preview'] as const).map(l => <button key={l} type="button" onClick={() => setLayout(l)} className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize ${layout === l ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'}`}>{l}</button>)}</div>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} className="accent-indigo-600" /> Auto-run</label>
        {!auto && <button type="button" onClick={() => setPreview(code)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold">▶ Run</button>}
        <div className="ml-auto flex gap-2"><button type="button" onClick={() => setCode(formatHtml(code))} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700">Format</button><button type="button" onClick={() => navigator.clipboard?.writeText(code)} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700">Copy</button><button type="button" onClick={download} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700">Download .html</button></div>
      </div>
      <div className={`grid gap-3 ${layout === 'split' ? 'lg:grid-cols-2' : ''}`}>
        {layout !== 'preview' && <textarea aria-label="HTML code" value={code} onChange={e => setCode(e.target.value)} spellCheck={false} className="w-full h-[520px] p-4 rounded-xl bg-slate-900 text-slate-100 text-[13px] font-mono leading-relaxed outline-none resize-y" />}
        {layout !== 'code' && <div className="rounded-xl border border-slate-200 overflow-hidden bg-white h-[520px]"><div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-amber-400" /><span className="w-3 h-3 rounded-full bg-emerald-400" /><span className="ml-3 text-xs text-slate-600">Preview</span></div><iframe title="HTML preview" srcDoc={shown} sandbox="allow-scripts" className="w-full h-[488px] bg-white" /></div>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><Stat label="Lines" value={code.split('\n').length} /><Stat label="Characters" value={code.length.toLocaleString()} /><Stat label="Elements" value={(code.match(/<[a-zA-Z]/g) || []).length} /><Stat label="Size" value={`${(new Blob([code]).size / 1024).toFixed(1)} KB`} /></div>
    </div>
  );
};

// ---------- HTML Viewer ----------
export const HtmlViewerTool: React.FC = () => {
  const [src, setSrc] = useState('');
  const formatted = useMemo(() => (src.trim() ? formatHtml(src) : ''), [src]);
  const stats = useMemo(() => ({ tags: (src.match(/<[a-zA-Z]/g) || []).length, links: (src.match(/<a\s/gi) || []).length, images: (src.match(/<img\s/gi) || []).length, scripts: (src.match(/<script/gi) || []).length, text: src.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length }), [src]);
  return (
    <div className="space-y-4">
      <Toolbar onClear={() => setSrc('')} onSample={() => setSrc(SAMPLE_HTML)} />
      <textarea aria-label="HTML code to render" value={src} onChange={e => setSrc(e.target.value)} rows={8} spellCheck={false} placeholder="Paste HTML code to render it…" className="w-full p-4 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" />
      {src.trim() && (<>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3"><Stat label="Tags" value={stats.tags} /><Stat label="Links" value={stats.links} /><Stat label="Images" value={stats.images} /><Stat label="Scripts" value={stats.scripts} tone={stats.scripts ? 'warn' : 'neutral'} /><Stat label="Words" value={stats.text} /></div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white"><div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-600 border-b border-slate-200">Rendered output (sandboxed, scripts disabled)</div><iframe title="Rendered HTML" srcDoc={src} sandbox="" className="w-full h-[420px] bg-white" /></div>
          <Output label="Formatted source" value={formatted} />
        </div>
      </>)}
    </div>
  );
};
