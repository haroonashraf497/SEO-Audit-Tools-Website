import React, { useEffect, useMemo, useState } from 'react';
import { PrimaryBtn, Output } from './engines';
import { Card, Stat } from './WebTools';

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean; type?: string }> = ({ label, value, onChange, placeholder, textarea, type = 'text' }) => (
  <div>
    <label className="text-sm font-semibold text-slate-700 block mb-1">{label}</label>
    {textarea ? <textarea aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className="w-full p-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" />
      : <input aria-label={label} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full p-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" />}
  </div>
);
const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: [string, string][] }> = ({ label, value, onChange, options }) => (
  <div><label className="text-sm font-semibold text-slate-700 block mb-1">{label}</label><select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm bg-white outline-none">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
);

// ---------- 1. QR Code Generator (uses the free goqr.me API for rendering; canvas download) ----------
export const QrTool: React.FC = () => {
  const [type, setType] = useState('url');
  const [f, setF] = useState({ url: 'https://', text: '', ssid: '', pass: '', enc: 'WPA', email: '', subject: '', phone: '', sms: '' });
  const [size, setSize] = useState(300);
  const [fg, setFg] = useState('#1e1b4b');
  const [bg, setBg] = useState('#ffffff');
  const [ecc, setEcc] = useState('M');
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const payload = useMemo(() => {
    switch (type) {
      case 'text': return f.text;
      case 'wifi': return `WIFI:T:${f.enc};S:${f.ssid};P:${f.pass};;`;
      case 'email': return `mailto:${f.email}${f.subject ? '?subject=' + encodeURIComponent(f.subject) : ''}`;
      case 'phone': return `tel:${f.phone}`;
      case 'sms': return `SMSTO:${f.phone}:${f.sms}`;
      default: return f.url;
    }
  }, [type, f]);
  const src = payload && payload !== 'https://' ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&color=${fg.slice(1)}&bgcolor=${bg.slice(1)}&ecc=${ecc}&margin=10` : '';
  const download = async (fmt: 'png' | 'svg') => {
    if (!src) return;
    const u = fmt === 'svg' ? src.replace('create-qr-code/?', 'create-qr-code/?format=svg&') : src;
    const blob = await fetch(u).then(r => r.blob());
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `qr-code.${fmt}`; a.click();
  };
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{[['url', 'URL'], ['text', 'Text'], ['wifi', 'Wi-Fi'], ['email', 'Email'], ['phone', 'Phone'], ['sms', 'SMS']].map(([v, l]) => <button key={v} type="button" onClick={() => setType(v)} className={`px-4 py-2 rounded-full text-sm font-semibold ${type === v ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{l}</button>)}</div>
        {type === 'url' && <Field label="Website URL" value={f.url} onChange={set('url')} placeholder="https://example.com" />}
        {type === 'text' && <Field label="Text" value={f.text} onChange={set('text')} textarea placeholder="Any text up to ~1,000 characters" />}
        {type === 'wifi' && <><Field label="Network name (SSID)" value={f.ssid} onChange={set('ssid')} /><Field label="Password" value={f.pass} onChange={set('pass')} /><Select label="Encryption" value={f.enc} onChange={set('enc')} options={[['WPA', 'WPA/WPA2'], ['WEP', 'WEP'], ['nopass', 'None']]} /></>}
        {type === 'email' && <><Field label="Email address" value={f.email} onChange={set('email')} /><Field label="Subject (optional)" value={f.subject} onChange={set('subject')} /></>}
        {type === 'phone' && <Field label="Phone number" value={f.phone} onChange={set('phone')} placeholder="+44 20 1234 5678" />}
        {type === 'sms' && <><Field label="Phone number" value={f.phone} onChange={set('phone')} /><Field label="Message" value={f.sms} onChange={set('sms')} textarea /></>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className="text-xs font-semibold text-slate-600 block mb-1">Size {size}px</label><input aria-label="QR code size in pixels" type="range" min="150" max="1000" step="50" value={size} onChange={e => setSize(Number(e.target.value))} className="w-full accent-indigo-600" /></div>
          <div><label className="text-xs font-semibold text-slate-600 block mb-1">Foreground</label><input aria-label="Foreground colour" type="color" value={fg} onChange={e => setFg(e.target.value)} className="w-full h-9 rounded cursor-pointer" /></div>
          <div><label className="text-xs font-semibold text-slate-600 block mb-1">Background</label><input aria-label="Background colour" type="color" value={bg} onChange={e => setBg(e.target.value)} className="w-full h-9 rounded cursor-pointer" /></div>
          <Select label="Error correction" value={ecc} onChange={setEcc} options={[['L', 'L (7%)'], ['M', 'M (15%)'], ['Q', 'Q (25%)'], ['H', 'H (30%)']]} />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
        {src ? <img src={src} alt="Generated QR code" width={Math.min(size, 320)} height={Math.min(size, 320)} className="rounded-lg border border-slate-100" /> : <p className="text-slate-500 text-sm py-20">Enter content to generate a QR code</p>}
        {src && <><p className="text-xs text-slate-500 mt-3 font-mono break-all max-w-xs">{payload.slice(0, 80)}</p><div className="flex gap-2 mt-4"><PrimaryBtn type="button" onClick={() => download('png')}>Download PNG</PrimaryBtn><button type="button" onClick={() => download('svg')} className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm">Download SVG</button></div><p className="text-[11px] text-slate-400 mt-3">Higher error correction lets the code survive damage or a logo overlay.</p></>}
      </div>
    </div>
  );
};

// ---------- 2. Htaccess Redirect Generator ----------
export const HtaccessTool: React.FC = () => {
  const [mode, setMode] = useState('301');
  const [from, setFrom] = useState('/old-page.html');
  const [to, setTo] = useState('https://example.com/new-page/');
  const [domain, setDomain] = useState('example.com');
  const [newDomain, setNewDomain] = useState('newdomain.com');
  const out = useMemo(() => {
    const head = 'RewriteEngine On\n';
    switch (mode) {
      case '301': return `Redirect 301 ${from} ${to}`;
      case '302': return `Redirect 302 ${from} ${to}`;
      case 'https': return `${head}RewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`;
      case 'www': return `${head}RewriteCond %{HTTP_HOST} ^${domain.replace(/\./g, '\\.')}$ [NC]\nRewriteRule ^(.*)$ https://www.${domain}/$1 [L,R=301]`;
      case 'nonwww': return `${head}RewriteCond %{HTTP_HOST} ^www\\.${domain.replace(/\./g, '\\.')}$ [NC]\nRewriteRule ^(.*)$ https://${domain}/$1 [L,R=301]`;
      case 'domain': return `${head}RewriteCond %{HTTP_HOST} ^(www\\.)?${domain.replace(/\./g, '\\.')}$ [NC]\nRewriteRule ^(.*)$ https://${newDomain}/$1 [L,R=301]`;
      case 'slash': return `${head}RewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_URI} !(.*)/$\nRewriteRule ^(.*)$ /$1/ [L,R=301]`;
      case 'noslash': return `${head}RewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^(.*)/$ /$1 [L,R=301]`;
      case 'index': return `${head}RewriteCond %{THE_REQUEST} ^[A-Z]{3,9}\\ /index\\.(php|html)\\ HTTP\nRewriteRule ^index\\.(php|html)$ / [R=301,L]`;
      case 'ext': return `${head}RewriteCond %{REQUEST_FILENAME} !-d\nRewriteCond %{REQUEST_FILENAME}\\.html -f\nRewriteRule ^(.*)$ $1.html [L]\n\n# Redirect /page.html to /page\nRewriteCond %{THE_REQUEST} \\s/([^.]+)\\.html [NC]\nRewriteRule ^ /%1 [R=301,L]`;
      case '404': return `ErrorDocument 404 /404.html\nErrorDocument 403 /403.html\nErrorDocument 500 /500.html`;
      default: return '';
    }
  }, [mode, from, to, domain, newDomain]);
  const explain: Record<string, string> = { '301': 'Permanent redirect — passes link equity, ideal for moved pages.', '302': 'Temporary redirect — use for A/B tests or maintenance; does not transfer ranking signals long-term.', https: 'Forces every request to HTTPS. Place at the top of .htaccess.', www: 'Canonicalises to the www version so both variants are not indexed separately.', nonwww: 'Canonicalises to the bare domain.', domain: 'Moves an entire site to a new domain, preserving paths.', slash: 'Adds a trailing slash to directory-style URLs.', noslash: 'Removes trailing slashes.', index: 'Redirects /index.php or /index.html to the root to avoid duplicate homepages.', ext: 'Removes .html extensions for cleaner URLs.', '404': 'Custom error pages for a better user experience.' };
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Select label="Redirect type" value={mode} onChange={setMode} options={[['301', '301 Permanent (single page)'], ['302', '302 Temporary (single page)'], ['https', 'Force HTTPS'], ['www', 'non-www → www'], ['nonwww', 'www → non-www'], ['domain', 'Old domain → new domain'], ['slash', 'Add trailing slash'], ['noslash', 'Remove trailing slash'], ['index', 'Remove index.php / index.html'], ['ext', 'Remove .html extension'], ['404', 'Custom error pages']]} />
        {(mode === '301' || mode === '302') && <><Field label="From (path)" value={from} onChange={setFrom} /><Field label="To (full URL)" value={to} onChange={setTo} /></>}
        {['www', 'nonwww', 'domain'].includes(mode) && <Field label="Current domain" value={domain} onChange={setDomain} />}
        {mode === 'domain' && <Field label="New domain" value={newDomain} onChange={setNewDomain} />}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900"><strong>What it does:</strong> {explain[mode]}</div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-800">Apache with mod_rewrite required. Back up your .htaccess first; a syntax error causes a 500 error site-wide. On Nginx, use server-block <code>return 301</code> / <code>rewrite</code> directives instead.</div>
      </div>
      <Output label=".htaccess rules" value={out} />
    </div>
  );
};

// ---------- 3. Open Graph Generator ----------
export const OgGeneratorTool: React.FC = () => {
  const [f, setF] = useState({ type: 'website', title: '', desc: '', url: '', image: '', site: '', locale: 'en_US', author: '', published: '', price: '', currency: 'USD', video: '' });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const out = useMemo(() => {
    const l = [`<meta property="og:type" content="${f.type}" />`, `<meta property="og:title" content="${f.title}" />`, `<meta property="og:description" content="${f.desc}" />`, `<meta property="og:url" content="${f.url}" />`, `<meta property="og:image" content="${f.image}" />`, `<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`, `<meta property="og:image:alt" content="${f.title}" />`, `<meta property="og:site_name" content="${f.site}" />`, `<meta property="og:locale" content="${f.locale}" />`];
    if (f.type === 'article') l.push(`<meta property="article:author" content="${f.author}" />`, `<meta property="article:published_time" content="${f.published}" />`);
    if (f.type === 'product') l.push(`<meta property="product:price:amount" content="${f.price}" />`, `<meta property="product:price:currency" content="${f.currency}" />`);
    if (f.type === 'video.other') l.push(`<meta property="og:video" content="${f.video}" />`, `<meta property="og:video:type" content="video/mp4" />`);
    return l.join('\n');
  }, [f]);
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Select label="Content type" value={f.type} onChange={set('type')} options={[['website', 'Website'], ['article', 'Article / blog post'], ['product', 'Product'], ['video.other', 'Video'], ['profile', 'Profile'], ['book', 'Book']]} />
        <Field label="Title" value={f.title} onChange={set('title')} placeholder="Page title (max ~60 chars)" />
        <Field label="Description" value={f.desc} onChange={set('desc')} textarea placeholder="2–4 sentences (max ~200 chars)" />
        <Field label="Canonical URL" value={f.url} onChange={set('url')} placeholder="https://example.com/page" />
        <Field label="Image URL (1200×630 recommended)" value={f.image} onChange={set('image')} placeholder="https://example.com/og.jpg" />
        <div className="grid grid-cols-2 gap-3"><Field label="Site name" value={f.site} onChange={set('site')} /><Select label="Locale" value={f.locale} onChange={set('locale')} options={[['en_US', 'en_US'], ['en_GB', 'en_GB'], ['de_DE', 'de_DE'], ['fr_FR', 'fr_FR'], ['es_ES', 'es_ES'], ['pt_BR', 'pt_BR'], ['hi_IN', 'hi_IN'], ['ja_JP', 'ja_JP']]} /></div>
        {f.type === 'article' && <div className="grid grid-cols-2 gap-3"><Field label="Author URL/name" value={f.author} onChange={set('author')} /><Field label="Published (ISO)" value={f.published} onChange={set('published')} type="date" /></div>}
        {f.type === 'product' && <div className="grid grid-cols-2 gap-3"><Field label="Price" value={f.price} onChange={set('price')} /><Field label="Currency" value={f.currency} onChange={set('currency')} /></div>}
        {f.type === 'video.other' && <Field label="Video file URL (mp4)" value={f.video} onChange={set('video')} />}
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-slate-500 mb-3">Share preview</p>
          <div className="rounded-xl border border-slate-300 overflow-hidden max-w-md"><div className="aspect-[1.91/1] bg-slate-100 flex items-center justify-center text-slate-600 text-sm overflow-hidden">{f.image ? <img src={f.image} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : '1200 × 630 image'}</div><div className="p-3 bg-slate-50"><p className="text-[11px] uppercase text-slate-500">{(f.url || 'example.com').replace(/^https?:\/\//, '').split('/')[0]}</p><p className="font-bold text-slate-900 line-clamp-2">{f.title || 'Your title appears here'}</p><p className="text-sm text-slate-600 line-clamp-2">{f.desc || 'Your description appears here.'}</p></div></div>
        </div>
        <Output label="Open Graph meta tags" value={out} />
      </div>
    </div>
  );
};

// ---------- 4. Twitter Card Generator ----------
export const TwitterCardTool: React.FC = () => {
  const [f, setF] = useState({ card: 'summary_large_image', site: '', creator: '', title: '', desc: '', image: '', alt: '', player: '', w: '640', h: '360', appName: '', appId: '' });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const out = useMemo(() => {
    const l = [`<meta name="twitter:card" content="${f.card}" />`, `<meta name="twitter:site" content="${f.site}" />`, `<meta name="twitter:creator" content="${f.creator}" />`, `<meta name="twitter:title" content="${f.title}" />`, `<meta name="twitter:description" content="${f.desc}" />`];
    if (f.card !== 'app') l.push(`<meta name="twitter:image" content="${f.image}" />`, `<meta name="twitter:image:alt" content="${f.alt}" />`);
    if (f.card === 'player') l.push(`<meta name="twitter:player" content="${f.player}" />`, `<meta name="twitter:player:width" content="${f.w}" />`, `<meta name="twitter:player:height" content="${f.h}" />`);
    if (f.card === 'app') l.push(`<meta name="twitter:app:name:iphone" content="${f.appName}" />`, `<meta name="twitter:app:id:iphone" content="${f.appId}" />`, `<meta name="twitter:app:name:googleplay" content="${f.appName}" />`, `<meta name="twitter:app:id:googleplay" content="${f.appId}" />`);
    return l.join('\n');
  }, [f]);
  const large = f.card === 'summary_large_image' || f.card === 'player';
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Select label="Card type" value={f.card} onChange={set('card')} options={[['summary', 'Summary (small square image)'], ['summary_large_image', 'Summary with large image'], ['player', 'Player (video/audio)'], ['app', 'App']]} />
        <div className="grid grid-cols-2 gap-3"><Field label="@site" value={f.site} onChange={set('site')} placeholder="@yourbrand" /><Field label="@creator" value={f.creator} onChange={set('creator')} placeholder="@author" /></div>
        <Field label="Title (≤70 chars)" value={f.title} onChange={set('title')} /><Field label="Description (≤200 chars)" value={f.desc} onChange={set('desc')} textarea />
        {f.card !== 'app' && <><Field label="Image URL" value={f.image} onChange={set('image')} placeholder={large ? '1200×628 (2:1)' : '≥144×144 square'} /><Field label="Image alt text" value={f.alt} onChange={set('alt')} /></>}
        {f.card === 'player' && <><Field label="Player iframe URL (HTTPS)" value={f.player} onChange={set('player')} /><div className="grid grid-cols-2 gap-3"><Field label="Width" value={f.w} onChange={set('w')} /><Field label="Height" value={f.h} onChange={set('h')} /></div></>}
        {f.card === 'app' && <div className="grid grid-cols-2 gap-3"><Field label="App name" value={f.appName} onChange={set('appName')} /><Field label="App ID" value={f.appId} onChange={set('appId')} /></div>}
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold uppercase text-slate-500 mb-3">X / Twitter preview</p>
          <div className={`rounded-2xl border border-slate-300 overflow-hidden max-w-md ${large ? '' : 'flex'}`}>
            <div className={`${large ? 'aspect-[2/1]' : 'w-32 h-32 flex-shrink-0'} bg-slate-100 flex items-center justify-center text-slate-600 text-xs overflow-hidden`}>{f.image ? <img src={f.image} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : 'image'}</div>
            <div className="p-3 min-w-0"><p className="font-bold text-slate-900 line-clamp-1">{f.title || 'Card title'}</p><p className="text-sm text-slate-600 line-clamp-2">{f.desc || 'Card description'}</p><p className="text-xs text-slate-500 mt-1">🔗 {f.site.replace('@', '') || 'example.com'}</p></div>
          </div>
        </div>
        <Output label="Twitter card meta tags" value={out} />
      </div>
    </div>
  );
};

// ---------- 5. URL Encoder / Decoder ----------
export const UrlCodecTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [full, setFull] = useState(false);
  const result = useMemo(() => {
    try { return mode === 'encode' ? (full ? encodeURIComponent(input) : encodeURI(input)) : decodeURIComponent(input.replace(/\+/g, ' ')); } catch { return 'Invalid encoded sequence'; }
  }, [input, mode, full]);
  const parts = useMemo(() => { try { const u = new URL(mode === 'decode' ? result : input); return u; } catch { return null; } }, [input, result, mode]);
  const reserved: [string, string][] = [[' ', '%20'], ['!', '%21'], ['#', '%23'], ['$', '%24'], ['&', '%26'], ["'", '%27'], ['(', '%28'], [')', '%29'], ['*', '%2A'], ['+', '%2B'], [',', '%2C'], ['/', '%2F'], [':', '%3A'], [';', '%3B'], ['=', '%3D'], ['?', '%3F'], ['@', '%40'], ['[', '%5B'], [']', '%5D']];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        {(['encode', 'decode'] as const).map(m => <button key={m} type="button" onClick={() => setMode(m)} className={`px-5 py-2 rounded-full text-sm font-semibold capitalize ${mode === m ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{m}</button>)}
        {mode === 'encode' && <label className="ml-2 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} className="accent-indigo-600" /> Encode all reserved characters (encodeURIComponent)</label>}
      </div>
      <textarea aria-label="Text to encode or decode" value={input} onChange={e => setInput(e.target.value)} rows={5} placeholder={mode === 'encode' ? 'https://example.com/search?q=hello world&lang=en' : 'https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world'} className="w-full p-4 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" />
      <Output label={mode === 'encode' ? 'Encoded URL' : 'Decoded URL'} value={result} stats={[{ label: 'Input length', value: String(input.length) }, { label: 'Output length', value: String(result.length) }, { label: 'Difference', value: String(result.length - input.length) }, { label: 'Mode', value: mode }]} />
      {parts && (
        <Card title="URL components">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{[['Protocol', parts.protocol], ['Host', parts.hostname], ['Port', parts.port || '(default)'], ['Path', parts.pathname], ['Query', parts.search || '(none)'], ['Fragment', parts.hash || '(none)']].map(([l, v]) => <Stat key={l} label={l} value={<span className="font-mono text-sm break-all">{v}</span>} />)}</div>
          {parts.search && <div className="mt-4"><p className="text-xs font-semibold text-slate-500 uppercase mb-2">Query parameters</p><div className="flex flex-wrap gap-2">{Array.from(parts.searchParams.entries()).map(([k, v], i) => <span key={i} className="bg-slate-100 rounded-lg px-3 py-1.5 text-xs font-mono"><span className="text-indigo-700">{k}</span> = {v}</span>)}</div></div>}
        </Card>
      )}
      <Card title="Reserved character reference"><div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">{reserved.map(([c, e]) => <div key={e} className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100"><p className="font-mono text-base text-slate-800">{c === ' ' ? '␣' : c}</p><p className="font-mono text-xs text-indigo-700">{e}</p></div>)}</div></Card>
    </div>
  );
};

// ---------- 6. AdSense Calculator ----------
export const AdsenseTool: React.FC = () => {
  const [views, setViews] = useState(10000);
  const [ctr, setCtr] = useState(1.5);
  const [cpc, setCpc] = useState(0.45);
  const [rpmMode, setRpmMode] = useState(false);
  const [rpm, setRpm] = useState(5);
  const daily = rpmMode ? (views / 1000) * rpm : views * (ctr / 100) * cpc;
  const clicks = views * (ctr / 100);
  const fmt = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const targets = [100, 500, 1000, 5000, 10000];
  return (
    <div className="space-y-5">
      <div className="flex gap-2">{[['CTR × CPC', false], ['Page RPM', true]].map(([l, v]) => <button key={String(v)} type="button" onClick={() => setRpmMode(v as boolean)} className={`px-4 py-2 rounded-full text-sm font-semibold ${rpmMode === v ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{l as string}</button>)}</div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div><label className="text-sm font-semibold text-slate-700 block mb-1">Daily page views</label><input aria-label="Daily page views" type="number" value={views} onChange={e => setViews(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" /></div>
        {rpmMode ? <div><label className="text-sm font-semibold text-slate-700 block mb-1">Page RPM ($ per 1,000 views)</label><input aria-label="Page RPM in dollars per thousand views" type="number" step="0.1" value={rpm} onChange={e => setRpm(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" /></div> : <>
          <div><label className="text-sm font-semibold text-slate-700 block mb-1">Click-through rate (%)</label><input aria-label="Click-through rate percentage" type="number" step="0.1" value={ctr} onChange={e => setCtr(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" /></div>
          <div><label className="text-sm font-semibold text-slate-700 block mb-1">Cost per click ($)</label><input aria-label="Cost per click in dollars" type="number" step="0.01" value={cpc} onChange={e => setCpc(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" /></div></>}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-700 to-teal-800 rounded-2xl p-5 text-white"><p className="text-emerald-100 text-sm">Daily earnings</p><p className="text-3xl font-extrabold">{fmt(daily)}</p></div>
        <Stat label="Monthly (30 days)" value={fmt(daily * 30)} tone="good" /><Stat label="Yearly" value={fmt(daily * 365)} tone="good" /><Stat label={rpmMode ? 'Effective RPM' : 'Daily clicks'} value={rpmMode ? fmt(rpm) : Math.round(clicks).toLocaleString()} />
      </div>
      <div className="grid sm:grid-cols-3 gap-3"><Stat label="Revenue per 1,000 views (RPM)" value={fmt(views ? (daily / views) * 1000 : 0)} /><Stat label="Revenue per visitor" value={'$' + (views ? daily / views : 0).toFixed(4)} /><Stat label="Views needed for $100/day" value={daily > 0 ? Math.ceil((100 / daily) * views).toLocaleString() : '—'} /></div>
      <Card title="Traffic needed for income goals (per month)">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="text-left px-3 py-2">Monthly goal</th><th className="text-left px-3 py-2">Daily views needed</th><th className="text-left px-3 py-2">Monthly views needed</th></tr></thead><tbody>{targets.map(t => { const perView = views ? daily / views : 0; const dv = perView > 0 ? Math.ceil(t / 30 / perView) : 0; return <tr key={t} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold text-slate-800">${t.toLocaleString()}</td><td className="px-3 py-2 text-slate-700">{dv.toLocaleString()}</td><td className="px-3 py-2 text-slate-700">{(dv * 30).toLocaleString()}</td></tr>; })}</tbody></table></div>
        <p className="text-xs text-slate-500 mt-3">Typical AdSense benchmarks: CTR 0.5–3%, CPC $0.20–$2.00 (finance/insurance far higher), page RPM $1–$20 depending on niche and geography.</p>
      </Card>
    </div>
  );
};

// ---------- 7. URL Rewriting Tool ----------
export const UrlRewriteTool: React.FC = () => {
  const [url, setUrl] = useState('https://example.com/product.php?id=42&category=shoes');
  const res = useMemo(() => {
    try {
      const u = new URL(url);
      const params = Array.from(u.searchParams.entries());
      if (!params.length) return null;
      const file = u.pathname.split('/').pop() || 'index.php';
      const base = file.replace(/\.\w+$/, '');
      const clean = `${u.origin}/${base}/${params.map(p => encodeURIComponent(p[1]).replace(/%20/g, '-')).join('/')}/`;
      const pattern = `^${base}/${params.map(() => '([^/]+)').join('/')}/?$`;
      const target = `${file}?${params.map((p, i) => `${p[0]}=$${i + 1}`).join('&')}`;
      const nginx = `rewrite ${pattern} /${target} last;`;
      return { clean, htaccess: `RewriteEngine On\nRewriteRule ${pattern} ${target} [L,QSA]`, nginx, params };
    } catch { return null; }
  }, [url]);
  return (
    <div className="space-y-5">
      <div><label className="text-sm font-semibold text-slate-700 block mb-1">Dynamic URL</label><input aria-label="Dynamic URL" value={url} onChange={e => setUrl(e.target.value)} className="w-full p-3.5 rounded-xl border border-slate-300 text-sm font-mono outline-none focus:border-indigo-500" /></div>
      {res ? (<>
        <div className="grid md:grid-cols-2 gap-4"><div className="bg-red-50 border border-red-100 rounded-xl p-4"><p className="text-xs font-bold uppercase text-red-700 mb-1">Before (dynamic)</p><p className="font-mono text-sm text-slate-800 break-all">{url}</p></div><div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4"><p className="text-xs font-bold uppercase text-emerald-700 mb-1">After (static, SEO-friendly)</p><p className="font-mono text-sm text-slate-800 break-all">{res.clean}</p></div></div>
        <div className="grid md:grid-cols-2 gap-4"><Output label="Apache .htaccess" value={res.htaccess} /><Output label="Nginx" value={res.nginx} /></div>
        <Card title="Why rewrite URLs?"><ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5"><li>Keywords in the path are a minor ranking signal and improve click-through rates.</li><li>Static-looking URLs are easier to share, remember and cite.</li><li>Fewer parameters mean fewer duplicate-content variations for crawlers.</li><li>Remember to 301-redirect the old dynamic URLs and update your canonical tags.</li></ul></Card>
      </>) : <p className="text-sm text-slate-500">Enter a URL that contains query parameters (e.g. ?id=42) to generate rewrite rules.</p>}
    </div>
  );
};

// ---------- 8. Website Hit Counter ----------
export const HitCounterTool: React.FC = () => {
  const [start, setStart] = useState(1000);
  const [digits, setDigits] = useState(6);
  const [style, setStyle] = useState('digital');
  const [label, setLabel] = useState('Visitors');
  const [count, setCount] = useState(start);
  useEffect(() => { setCount(start); }, [start]);
  useEffect(() => { const t = setInterval(() => setCount(c => c + (Math.random() > 0.6 ? 1 : 0)), 2200); return () => clearInterval(t); }, []);
  const padded = String(count).padStart(digits, '0');
  const styles: Record<string, string> = { digital: 'bg-black text-lime-400 font-mono border-4 border-slate-700', odometer: 'bg-white text-slate-900 font-mono border border-slate-300', modern: 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold', minimal: 'bg-slate-100 text-slate-800 font-semibold' };
  const embed = `<!-- Hit counter by SEO Audit Tool -->\n<div id="hit-counter" style="display:inline-flex;gap:4px;padding:8px 12px;border-radius:8px;background:#0f172a;color:#a3e635;font-family:monospace;font-size:24px;letter-spacing:2px">${padded}</div>\n<script>\n(function(){var k='hc_'+location.hostname,n=parseInt(localStorage.getItem(k)||'${start}')+1;localStorage.setItem(k,n);document.getElementById('hit-counter').textContent=String(n).padStart(${digits},'0');})();\n</script>`;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-semibold text-slate-700 block mb-1">Starting count</label><input aria-label="Starting count" type="number" value={start} onChange={e => setStart(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" /></div><div><label className="text-sm font-semibold text-slate-700 block mb-1">Digits</label><input aria-label="Number of digits" type="number" min={4} max={10} value={digits} onChange={e => setDigits(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" /></div></div>
        <Select label="Style" value={style} onChange={setStyle} options={[['digital', 'Digital (classic green)'], ['odometer', 'Odometer'], ['modern', 'Modern gradient'], ['minimal', 'Minimal']]} />
        <Field label="Label" value={label} onChange={setLabel} />
        <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center"><p className="text-xs uppercase text-slate-500 font-semibold mb-3">{label}</p><div className={`inline-flex gap-1 px-4 py-3 rounded-lg text-3xl tracking-widest ${styles[style]}`}>{padded.split('').map((d, i) => <span key={i} className={style === 'odometer' ? 'bg-slate-100 px-1 rounded' : ''}>{d}</span>)}</div><p className="text-[11px] text-slate-500 mt-3">Live preview increments to simulate traffic</p></div>
      </div>
      <div className="space-y-4"><Output label="Embed code (paste before </body>)" value={embed} /><div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-900">This counter stores the number in the visitor&apos;s browser (localStorage) so it needs no server. For real site-wide totals, use a privacy-friendly analytics tool such as Plausible, Umami or Google Analytics.</div></div>
    </div>
  );
};

// ---------- 9. Screen Resolution Simulator ----------
const DEVICES: [string, number, number][] = [['iPhone SE', 375, 667], ['iPhone 14 / 15', 390, 844], ['iPhone 15 Pro Max', 430, 932], ['Pixel 8', 412, 915], ['Galaxy S23', 360, 780], ['iPad Mini', 768, 1024], ['iPad Pro 11"', 834, 1194], ['iPad Pro 12.9"', 1024, 1366], ['Laptop 1366×768', 1366, 768], ['Laptop 1440×900', 1440, 900], ['Desktop 1920×1080', 1920, 1080], ['4K 2560×1440', 2560, 1440]];
export const ScreenSimTool: React.FC = () => {
  const [url, setUrl] = useState('');
  const [active, setActive] = useState('');
  const [w, setW] = useState(390); const [h, setH] = useState(844);
  const [landscape, setLandscape] = useState(false);
  const target = active ? (/^https?:\/\//i.test(active) ? active : `https://${active}`) : '';
  const vw = landscape ? h : w; const vh = landscape ? w : h;
  const scale = Math.min(1, 1000 / vw);
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3"><input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && setActive(url)} placeholder="https://example.com" className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" /><PrimaryBtn type="button" onClick={() => setActive(url)} disabled={!url.trim()}>Load Website</PrimaryBtn></div>
      <div className="flex flex-wrap gap-2">{DEVICES.map(([n, dw, dh]) => <button key={n} type="button" onClick={() => { setW(dw); setH(dh); }} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${w === dw && h === dh ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>{n}</button>)}</div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><label className="flex items-center gap-2">W <input type="number" value={w} onChange={e => setW(Number(e.target.value))} className="w-24 p-2 rounded-lg border border-slate-300" /></label><label className="flex items-center gap-2">H <input type="number" value={h} onChange={e => setH(Number(e.target.value))} className="w-24 p-2 rounded-lg border border-slate-300" /></label><button type="button" onClick={() => setLandscape(!landscape)} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">⟳ {landscape ? 'Landscape' : 'Portrait'}</button><span className="text-slate-500">Viewport: <strong>{vw} × {vh}</strong>{scale < 1 && ` · scaled to ${Math.round(scale * 100)}%`}</span><span className="ml-auto text-slate-500">Your screen: {typeof window !== 'undefined' ? `${window.screen.width} × ${window.screen.height}` : ''}</span></div>
      <div className="bg-slate-100 rounded-2xl p-4 overflow-auto"><div className="mx-auto bg-slate-900 rounded-2xl p-2 shadow-2xl" style={{ width: vw * scale + 16 }}><div className="bg-white rounded-xl overflow-hidden" style={{ width: vw * scale, height: vh * scale }}>{target ? <iframe title="Resolution preview" src={target} sandbox="allow-same-origin allow-scripts allow-forms" loading="lazy" style={{ width: vw, height: vh, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0 }} /> : <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">Enter a URL above to preview it at {vw} × {vh}</div>}</div></div></div>
      <p className="text-xs text-slate-500">Some sites send X-Frame-Options / CSP headers that block embedding; those will show a blank frame. Try your own site or a site without frame restrictions.</p>
    </div>
  );
};

// ---------- 10. Website Screenshot Generator ----------
export const ScreenshotTool: React.FC = () => {
  const [url, setUrl] = useState('');
  const [size, setSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [full, setFull] = useState(false);
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(false);
  const dims = { desktop: [1440, 900], tablet: [820, 1180], mobile: [390, 844] }[size];
  const run = () => {
    const u = url.trim(); if (!u) return;
    const target = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    setLoading(true);
    // Free screenshot API (no key). Alternative providers can be swapped in.
    setSrc(`https://image.thum.io/get/width/${dims[0]}/crop/${full ? 4000 : dims[1]}/noanimate/${target}`);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3"><input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="https://example.com" className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" /><PrimaryBtn type="button" onClick={run} disabled={!url.trim()}>Capture Screenshot</PrimaryBtn></div>
      <div className="flex flex-wrap items-center gap-2">{(['desktop', 'tablet', 'mobile'] as const).map(s => <button key={s} type="button" onClick={() => setSize(s)} className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${size === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{s} · {({ desktop: '1440', tablet: '820', mobile: '390' })[s]}px</button>)}<label className="ml-2 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} className="accent-indigo-600" /> Full page</label></div>
      {src && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          {loading && <div className="flex items-center gap-3 text-sm text-slate-600 py-4 justify-center"><span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />Rendering screenshot (this can take 10–20 s)…</div>}
          <img src={src} alt={`Screenshot of ${url}`} className="w-full rounded-lg border border-slate-100" onLoad={() => setLoading(false)} onError={() => setLoading(false)} style={{ maxWidth: dims[0] }} />
          <div className="flex justify-between items-center mt-3"><p className="text-xs text-slate-400">{dims[0]} px wide · rendered by a headless browser service</p><a href={src} download="screenshot.png" target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Open / Download</a></div>
        </div>
      )}
    </div>
  );
};

// ---------- 11. Internet Speed Test (real download + latency) ----------
export const SpeedTestTool: React.FC = () => {
  const [state, setState] = useState<'idle' | 'ping' | 'down' | 'done'>('idle');
  const [latency, setLatency] = useState<number[]>([]);
  const [mbps, setMbps] = useState(0);
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);
  const run = async () => {
    setState('ping'); setLatency([]); setMbps(0); setProgress(0); setSamples([]);
    const pings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      try { await fetch('https://speed.cloudflare.com/__down?bytes=0&_=' + Date.now(), { cache: 'no-store' }); } catch { /* ignore */ }
      pings.push(Math.round(performance.now() - t0)); setLatency([...pings]);
    }
    setState('down');
    const sizes = [1_000_000, 5_000_000, 10_000_000, 25_000_000];
    let best = 0; const sm: number[] = [];
    for (let i = 0; i < sizes.length; i++) {
      const t0 = performance.now();
      try {
        const r = await fetch(`https://speed.cloudflare.com/__down?bytes=${sizes[i]}&_=${Date.now()}`, { cache: 'no-store' });
        const buf = await r.arrayBuffer();
        const secs = (performance.now() - t0) / 1000;
        const m = (buf.byteLength * 8) / secs / 1_000_000;
        sm.push(Math.round(m * 10) / 10); best = Math.max(best, m);
        setSamples([...sm]); setMbps(Math.round(best * 10) / 10);
      } catch { break; }
      setProgress(Math.round(((i + 1) / sizes.length) * 100));
      if (best > 0 && (performance.now() - t0) > 8000) break;
    }
    setState('done');
  };
  const avgPing = latency.length ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length) : 0;
  const jitter = latency.length > 1 ? Math.round(latency.slice(1).reduce((a, v, i) => a + Math.abs(v - latency[i]), 0) / (latency.length - 1)) : 0;
  const rating = (ok: boolean, good: boolean) => (good ? ['Excellent', 'text-emerald-600'] : ok ? ['OK', 'text-amber-600'] : ['Poor', 'text-red-600']);
  const conn = typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection : undefined;
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="relative w-56 h-56 mx-auto"><svg viewBox="0 0 120 120" className="w-full h-full -rotate-90"><circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" /><circle cx="60" cy="60" r="52" fill="none" stroke="#6366f1" strokeWidth="10" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(1, mbps / 300))} className="transition-all duration-700" /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-5xl font-extrabold text-slate-900">{mbps}</span><span className="text-sm text-slate-500 font-semibold">Mbps download</span></div></div>
        <div className="mt-6"><PrimaryBtn type="button" onClick={run} disabled={state === 'ping' || state === 'down'}>{state === 'idle' ? 'Start Speed Test' : state === 'done' ? 'Test Again' : state === 'ping' ? 'Measuring latency…' : `Downloading… ${progress}%`}</PrimaryBtn></div>
      </div>
      {latency.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Latency (ping)" value={`${avgPing} ms`} tone={avgPing < 50 ? 'good' : avgPing < 150 ? 'warn' : 'bad'} /><Stat label="Jitter" value={`${jitter} ms`} tone={jitter < 20 ? 'good' : jitter < 50 ? 'warn' : 'bad'} /><Stat label="Peak download" value={`${mbps} Mbps`} tone={mbps > 50 ? 'good' : mbps > 10 ? 'warn' : 'bad'} /><Stat label="Browser estimate" value={conn?.effectiveType ? `${conn.effectiveType.toUpperCase()} · ~${conn.downlink} Mbps` : 'n/a'} />
        </div>
      )}
      {state === 'done' && (
        <Card title="What can you do with this connection?">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[['4K streaming', mbps >= 25, mbps >= 50], ['HD video calls', mbps >= 3 && avgPing < 150, mbps >= 10 && avgPing < 60], ['Online gaming', avgPing < 100, avgPing < 40 && jitter < 20], ['Large downloads', mbps >= 20, mbps >= 100]].map(([l, ok, good]) => { const [t, c] = rating(ok as boolean, good as boolean); return <div key={l as string} className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">{l as string}</p><p className={`text-lg font-bold ${c}`}>{t}</p></div>; })}</div>
          {samples.length > 0 && <p className="text-xs text-slate-400 mt-4">Samples: {samples.join(' · ')} Mbps · Download test served by Cloudflare&apos;s speed endpoint. Upload is not measured. Results vary with Wi-Fi, VPNs and background traffic.</p>}
        </Card>
      )}
    </div>
  );
};

// ---------- 12. URL Shortener (real: is.gd / TinyURL public APIs) ----------
export const ShortenerTool: React.FC = () => {
  const [url, setUrl] = useState('');
  const [utm, setUtm] = useState({ source: '', medium: '', campaign: '' });
  const [result, setResult] = useState<{ short: string; long: string; provider: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [history, setHistory] = useState<{ short: string; long: string }[]>([]);
  const longUrl = useMemo(() => { try { const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); if (utm.source) u.searchParams.set('utm_source', utm.source); if (utm.medium) u.searchParams.set('utm_medium', utm.medium); if (utm.campaign) u.searchParams.set('utm_campaign', utm.campaign); return u.href; } catch { return ''; } }, [url, utm]);
  const run = async () => {
    if (!longUrl) return; setBusy(true); setErr(''); setResult(null);
    const providers: [string, string][] = [['is.gd', `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`], ['TinyURL', `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`]];
    for (const [name, api] of providers) {
      try { const r = await fetch(api, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }); const t = (await r.text()).trim(); if (r.ok && /^https?:\/\//.test(t)) { setResult({ short: t, long: longUrl, provider: name }); setHistory(h => [{ short: t, long: longUrl }, ...h].slice(0, 8)); setBusy(false); return; } } catch { /* next */ }
    }
    setErr('Shortening services are unreachable right now (they may be blocked by your network). Please try again.'); setBusy(false);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3"><input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Paste a long URL…" className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" /><PrimaryBtn type="button" onClick={run} disabled={busy || !longUrl}>{busy ? 'Shortening…' : 'Shorten URL'}</PrimaryBtn></div>
      <details className="bg-white rounded-xl border border-slate-200 p-4"><summary className="text-sm font-semibold text-slate-700 cursor-pointer">Add UTM tracking parameters (optional)</summary><div className="grid sm:grid-cols-3 gap-3 mt-3">{(['source', 'medium', 'campaign'] as const).map(k => <div key={k}><label className="text-xs font-semibold text-slate-500 block mb-1">utm_{k}</label><input value={utm[k]} onChange={e => setUtm({ ...utm, [k]: e.target.value })} placeholder={{ source: 'newsletter', medium: 'email', campaign: 'spring_sale' }[k]} className="w-full p-2.5 rounded-lg border border-slate-300 text-sm" /></div>)}</div>{longUrl && utm.source && <p className="text-xs font-mono text-slate-500 mt-3 break-all">{longUrl}</p>}</details>
      {err && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{err}</div>}
      {result && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
          <p className="text-white text-sm">Short URL via {result.provider}</p>
          <div className="flex flex-wrap items-center gap-3 mt-1"><a href={result.short} target="_blank" rel="noopener noreferrer" className="text-2xl md:text-3xl font-bold font-mono underline-offset-4 hover:underline break-all">{result.short}</a><button type="button" onClick={() => navigator.clipboard?.writeText(result.short)} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold">Copy</button></div>
          <div className="grid sm:grid-cols-[auto_1fr] gap-4 mt-4 items-center"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(result.short)}`} alt="QR code for short URL" width="120" height="120" className="rounded-lg bg-white p-1" /><div className="text-sm"><p className="text-white">Original ({result.long.length} chars → {result.short.length} chars, {Math.round((1 - result.short.length / result.long.length) * 100)}% shorter)</p><p className="font-mono text-xs break-all opacity-90 mt-1">{result.long}</p></div></div>
        </div>
      )}
      {history.length > 1 && <Card title="Recent links (this session)"><ul className="divide-y divide-slate-100 text-sm">{history.map((h, i) => <li key={i} className="py-2 flex flex-wrap justify-between gap-2"><a href={h.short} target="_blank" rel="noopener noreferrer" className="font-mono text-indigo-600">{h.short}</a><span className="text-slate-400 truncate max-w-md">{h.long}</span></li>)}</ul></Card>}
    </div>
  );
};

// ---------- 13. Instant Search Suggestions ----------
export const SuggestTool: React.FC = () => {
  const [kw, setKw] = useState('');
  const [tab, setTab] = useState<'az' | 'questions' | 'prepositions' | 'comparisons' | 'modifiers'>('az');
  const k = kw.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!k) return null;
    const az = 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => `${k} ${l}`);
    const questions = ['what is', 'how to', 'why is', 'when to', 'where to', 'which', 'who', 'can', 'does', 'is', 'are', 'will', 'should', 'how much', 'how many', 'how long', 'what does', 'how does'].map(q => `${q} ${k}`);
    const prepositions = ['for', 'with', 'without', 'near', 'to', 'vs', 'like', 'is', 'can', 'versus'].map(p => `${k} ${p}`);
    const comparisons = ['vs', 'or', 'like', 'versus', 'and', 'compared to', 'alternative to', 'better than'].map(c => `${k} ${c}`);
    const modifiers = ['best', 'top', 'free', 'cheap', 'online', 'near me', 'review', 'reviews', 'price', 'cost', 'tutorial', 'guide', 'template', 'examples', 'checklist', 'tips', 'course', 'software', 'tool', 'app', 'for beginners', 'for small business', '2025', 'reddit', 'pdf', 'download'].map(m => (['best', 'top', 'free', 'cheap'].includes(m) ? `${m} ${k}` : `${k} ${m}`));
    return { az, questions, prepositions, comparisons, modifiers };
  }, [k]);
  const list = groups ? groups[tab] : [];
  const total = groups ? Object.values(groups).reduce((a, g) => a + g.length, 0) : 0;
  return (
    <div className="space-y-5">
      <input aria-label="Seed keyword" value={kw} onChange={e => setKw(e.target.value)} placeholder="Enter a seed keyword, e.g. seo audit" className="w-full px-4 py-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" />
      {groups && (<>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3"><Stat label="Total suggestions" value={total} tone="good" /><Stat label="A–Z" value={groups.az.length} /><Stat label="Questions" value={groups.questions.length} /><Stat label="Comparisons" value={groups.comparisons.length} /><Stat label="Modifiers" value={groups.modifiers.length} /></div>
        <div className="flex flex-wrap gap-2">{(['az', 'questions', 'prepositions', 'comparisons', 'modifiers'] as const).map(t => <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{t === 'az' ? 'A–Z' : t}</button>)}</div>
        <Card title={`${tab === 'az' ? 'Alphabetical' : tab.charAt(0).toUpperCase() + tab.slice(1)} suggestions (${list.length})`} right={<button type="button" onClick={() => navigator.clipboard?.writeText(list.join('\n'))} className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg">Copy all</button>}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{list.map(s => <a key={s} href={`https://www.google.com/search?q=${encodeURIComponent(s)}`} target="_blank" rel="noopener noreferrer nofollow" className="bg-slate-50 hover:bg-indigo-50 rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-indigo-700 border border-slate-100">{s}</a>)}</div>
          <p className="text-xs text-slate-400 mt-4">Click any suggestion to open a live Google search. Patterns mirror how autocomplete expands queries; validate volume with your keyword tool.</p>
        </Card>
      </>)}
    </div>
  );
};

// ---------- 14. Video downloader guidance (honest, useful) ----------
const VIDEO_INFO: Record<string, { title: string; official: string[]; notes: string[] }> = {
  'online-video-downloader': { title: 'Online video downloading', official: ['YouTube Premium and most streaming apps include an official "Download" button for offline viewing inside the app.', 'Your own uploads can always be downloaded from the platform\u2019s creator dashboard / studio.', 'Creative Commons and public-domain videos can be downloaded where the license permits.'], notes: ['Downloading copyrighted videos without permission violates most platforms\u2019 terms and may infringe copyright.', 'Many "free downloader" sites bundle adware, fake update prompts or crypto-miners. Avoid any site that asks you to install an extension or "codec".', 'Command-line tools like yt-dlp exist for personal, permitted use; they run on your computer, not in a web page.'] },
  'facebook-video-downloader': { title: 'Facebook videos', official: ['Videos you posted: Settings → Your information → Download your information → select Videos.', 'On the video post, click ⋯ → Save video to add it to your Saved items for later watching in-app.', 'Page owners can download original uploads from Meta Business Suite → Content.'], notes: ['Private videos cannot be fetched by any third-party tool that respects Facebook\u2019s terms.', 'Downloading other people\u2019s videos to re-upload elsewhere is copyright infringement.'] },
  'facebook-story-download': { title: 'Facebook Stories', official: ['Your own stories: open the story → ⋯ → Save video/photo (before the 24-hour expiry).', 'Enable Story Archive: Settings → Stories → Archive, so every story you post is kept privately.', 'Business pages: stories appear in Meta Business Suite where originals can be saved.'], notes: ['Screenshots or recordings of other people\u2019s stories may notify them on some platforms and can breach privacy.'] },
  'facebook-reels-download': { title: 'Facebook Reels', official: ['Your Reels: open the reel → ⋯ → Save to device (available when the creator allows downloads).', 'Creators can toggle "Allow people to download your reel" in reel settings.', 'Originals remain in Meta Business Suite / Creator Studio for pages.'], notes: ['Reels with licensed music often cannot be downloaded even by the creator due to music rights.'] },
  'twitter-video-downloader': { title: 'X / Twitter videos', official: ['Bookmark the post (🔖) to keep it in your Bookmarks for later viewing.', 'Your own media: Settings → Your account → Download an archive of your data (includes uploaded media).', 'Request permission from the creator; many will share the original file.'], notes: ['X\u2019s Developer Policy prohibits third-party services from bulk-downloading videos.', 'Embedding the post with X\u2019s official embed code is the compliant way to reuse a video on your site.'] },
  'tiktok-downloader': { title: 'TikTok videos', official: ['Tap Share → Save video on any video whose creator allows downloads (includes a watermark).', 'Your own videos without watermark: save the draft before posting, or download from Creator tools → Analytics on the web.', 'Turn on "Allow downloads" in Privacy → Downloads to let others save your videos.'], notes: ['Third-party "no watermark" downloaders violate TikTok\u2019s terms and frequently serve malware.', 'Reposting others\u2019 TikToks on other platforms without credit and permission is a common copyright complaint trigger.'] },
};
export const VideoInfoTool: React.FC<{ slug: string }> = ({ slug }) => {
  const info = VIDEO_INFO[slug] || VIDEO_INFO['online-video-downloader'];
  const [url, setUrl] = useState('');
  const [checked, setChecked] = useState<null | { platform: string; id: string; embed: string }>(null);
  const analyse = () => {
    const u = url.trim(); if (!u) return;
    const yt = u.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{6,})/); const tt = u.match(/tiktok\.com\/.*\/video\/(\d+)/); const tw = u.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/); const fb = u.match(/facebook\.com\/.*(?:videos|reel|watch)\/?(?:\?v=)?(\d+)?/);
    if (yt) setChecked({ platform: 'YouTube', id: yt[1], embed: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${yt[1]}" title="YouTube video" frameborder="0" allowfullscreen loading="lazy"></iframe>` });
    else if (tt) setChecked({ platform: 'TikTok', id: tt[1], embed: `<blockquote class="tiktok-embed" cite="${u}" data-video-id="${tt[1]}"><a href="${u}">View on TikTok</a></blockquote><script async src="https://www.tiktok.com/embed.js"></script>` });
    else if (tw) setChecked({ platform: 'X / Twitter', id: tw[1], embed: `<blockquote class="twitter-tweet"><a href="${u}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script>` });
    else if (fb) setChecked({ platform: 'Facebook', id: fb[1] || '', embed: `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&show_text=false" width="560" height="315" style="border:none;overflow:hidden" allowfullscreen loading="lazy"></iframe>` });
    else setChecked({ platform: 'Unknown', id: '', embed: '' });
  };
  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-sm text-indigo-900"><strong>Straight talk:</strong> a web page running in your browser cannot download videos from {info.title.replace(' videos', '').replace(' downloading', ' platforms')} — the platforms block cross-site access and their terms forbid it. Below are the official ways to save videos plus a compliant embed generator for using videos on your own site.</div>
      <div className="flex flex-col sm:flex-row gap-3"><input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && analyse()} placeholder="Paste a video URL to get its official embed code" className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500" /><PrimaryBtn type="button" onClick={analyse} disabled={!url.trim()}>Get Embed Code</PrimaryBtn></div>
      {checked && (checked.embed ? <><div className="grid sm:grid-cols-2 gap-3"><Stat label="Platform" value={checked.platform} tone="good" />{checked.id && <Stat label="Video ID" value={<span className="font-mono text-sm">{checked.id}</span>} />}</div><Output label="Official embed code (allowed by the platform)" value={checked.embed} /></> : <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">URL not recognised as YouTube, TikTok, X or Facebook.</div>)}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Official ways to save"><ul className="space-y-2 text-sm text-slate-700">{info.official.map(o => <li key={o} className="flex gap-2"><span className="text-emerald-700 font-bold">✓</span>{o}</li>)}</ul></Card>
        <Card title="Things to know"><ul className="space-y-2 text-sm text-slate-700">{info.notes.map(o => <li key={o} className="flex gap-2"><span className="text-amber-700 font-bold">!</span>{o}</li>)}</ul></Card>
      </div>
    </div>
  );
};
