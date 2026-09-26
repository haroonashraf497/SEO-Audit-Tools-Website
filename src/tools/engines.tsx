import React, { useMemo, useRef, useState, useEffect } from 'react';
import { md5 } from './md5';

// ---------- Shared primitives ----------
export const PrimaryBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }> = ({ children, className = '', ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

export const TextArea: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }> = ({ value, onChange, placeholder, rows = 8 }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    spellCheck={false}
    className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono text-sm bg-white"
  />
);

const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

export const Output: React.FC<{ label?: string; value: string; mono?: boolean; stats?: { label: string; value: string }[] }> = ({ label = 'Result', value, mono = true, stats }) => (
  <div className="bg-slate-900 rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <CopyBtn text={value} />
    </div>
    <pre className={`${mono ? 'font-mono text-sm' : 'text-sm'} text-slate-100 whitespace-pre-wrap break-words max-h-80 overflow-y-auto`}>{value}</pre>
    {stats && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white/10 rounded-lg px-3 py-2">
            <p className="text-[11px] text-slate-400">{s.label}</p>
            <p className="text-sm font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ---------- Word Counter ----------
const WordCounter: React.FC<{ input: string }> = ({ input }) => {
  const s = useMemo(() => {
    const words = input.trim() ? input.trim().split(/\s+/).length : 0;
    const chars = input.length;
    const charsNoSpaces = input.replace(/\s/g, '').length;
    const sentences = input.split(/[.!?]+/).filter(x => x.trim()).length;
    const paragraphs = input.split(/\n\s*\n/).filter(x => x.trim()).length;
    return { words, chars, charsNoSpaces, sentences, paragraphs, reading: Math.max(0, Math.ceil(words / 225)) };
  }, [input]);
  return (
    <Output label="Live statistics" value={input ? `${s.words} words · ${s.chars} characters` : 'Start typing to see statistics...'} mono={false} stats={[
      { label: 'Words', value: String(s.words) },
      { label: 'Characters', value: String(s.chars) },
      { label: 'No spaces', value: String(s.charsNoSpaces) },
      { label: 'Sentences', value: String(s.sentences) },
      { label: 'Paragraphs', value: String(s.paragraphs) },
      { label: 'Reading time', value: `${s.reading} min` },
      { label: 'Speaking time', value: `${Math.ceil(s.words / 130)} min` },
      { label: 'Avg word length', value: s.words ? `${(s.charsNoSpaces / s.words).toFixed(1)}` : '0' },
    ]} />
  );
};

// ---------- Case Converter ----------
const CaseConverter: React.FC<{ input: string }> = ({ input }) => {
  const variants = useMemo(() => {
    const lower = input.toLowerCase();
    const upper = input.toUpperCase();
    const title = lower.replace(/\b\w/g, c => c.toUpperCase());
    const sentence = lower.replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
    const alternating = input.split('').map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('');
    const capitalizeEach = lower.replace(/(^|[-\s/])([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
    return [
      ['UPPERCASE', upper], ['lowercase', lower], ['Title Case', title],
      ['Sentence case', sentence], ['aLtErNaTiNg', alternating], ['Capitalize Each Word', capitalizeEach],
      ['Hyphen-case', lower.trim().replace(/\s+/g, '-')], ['snake_case', lower.trim().replace(/\s+/g, '_')],
    ] as [string, string][];
  }, [input]);
  return (
    <div className="space-y-3">
      {variants.map(([label, value]) => (
        <div key={label} className="bg-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <CopyBtn text={value} />
          </div>
          <p className="text-sm text-slate-100 break-words">{value || '—'}</p>
        </div>
      ))}
    </div>
  );
};

// ---------- Keyword Density ----------
const STOP = new Set('the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were'.split(' '));
const DensityChecker: React.FC<{ input: string }> = ({ input }) => {
  const rows = useMemo(() => {
    const words = input.toLowerCase().match(/[a-z0-9']+/g) || [];
    const total = words.length || 1;
    const single = new Map<string, number>();
    words.forEach(w => { if (w.length > 2 && !STOP.has(w)) single.set(w, (single.get(w) || 0) + 1); });
    const bi = new Map<string, number>();
    for (let i = 0; i < words.length - 1; i++) {
      if (!STOP.has(words[i]) && !STOP.has(words[i + 1])) bi.set(`${words[i]} ${words[i + 1]}`, (bi.get(`${words[i]} ${words[i + 1]}`) || 0) + 1);
    }
    const merge = [...single.entries()].map(([w, c]) => ({ term: w, count: c, density: (c / total) * 100 }))
      .concat([...bi.entries()].map(([w, c]) => ({ term: w, count: c, density: (c / total) * 100 })))
      .filter(x => x.count > 1).sort((a, b) => b.count - a.count).slice(0, 25);
    return { merge, total };
  }, [input]);
  if (!input.trim()) return <Output label="Keyword density" value="Paste an article to analyze term frequency..." />;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-12 px-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-500 uppercase">
        <span className="col-span-6">Keyword</span><span className="col-span-3 text-right">Count</span><span className="col-span-3 text-right">Density</span>
      </div>
      {rows.merge.map(x => (
        <div key={x.term} className="grid grid-cols-12 px-4 py-2 text-sm border-t border-slate-100 items-center">
          <span className="col-span-6 text-slate-800 truncate">{x.term}</span>
          <span className="col-span-3 text-right text-slate-600">{x.count}×</span>
          <span className={`col-span-3 text-right font-semibold ${x.density > 3 ? 'text-amber-600' : 'text-indigo-600'}`}>{x.density.toFixed(2)}%</span>
        </div>
      ))}
      <p className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100">{rows.total} total words analyzed. Aim for 1–2.5% density on primary terms.</p>
    </div>
  );
};

// ---------- Hash Generator ----------
const HashGenerator: React.FC<{ input: string }> = ({ input }) => {
  const [hashes, setHashes] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const enc = new TextEncoder().encode(input);
    const result: Record<string, string> = { MD5: md5(input) };
    Promise.all(['SHA-1', 'SHA-256', 'SHA-512'].map(async alg => {
      try {
        const buf = await crypto.subtle.digest(alg, enc);
        result[alg] = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch { result[alg] = 'Unavailable in this browser context'; }
    })).then(() => { if (!cancelled) setHashes({ ...result }); });
    return () => { cancelled = true; };
  }, [input]);
  const list = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'];
  return (
    <div className="space-y-3">
      {list.map(alg => (
        <div key={alg} className="bg-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{alg}</span>
            <CopyBtn text={hashes[alg] || ''} />
          </div>
          <p className="text-xs text-emerald-300 font-mono break-all">{hashes[alg] || '…'}</p>
        </div>
      ))}
    </div>
  );
};

// ---------- Small Text ----------
const SmallText: React.FC<{ input: string }> = ({ input }) => {
  const maps: Record<string, Record<string, string>> = {
    'Small Caps': { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' },
    'Superscript': { a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', q: '۹', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ' },
    'Subscript': { a: 'ₐ', b: 'b', c: 'c', d: 'd', e: 'ₑ', f: 'f', g: 'g', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', q: 'q', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', w: 'w', x: 'ₓ', y: 'y', z: '₂' },
  };
  const convert = (map: Record<string, string>) => input.toLowerCase().split('').map(ch => map[ch] ?? ch).join('');
  return (
    <div className="space-y-3">
      {Object.entries(maps).map(([name, map]) => (
        <div key={name} className="bg-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{name}</span>
            <CopyBtn text={convert(map)} />
          </div>
          <p className="text-base sm:text-lg text-slate-100 break-words">{convert(map) || '—'}</p>
        </div>
      ))}
    </div>
  );
};

// ---------- Reverse Text ----------
const ReverseText: React.FC<{ input: string }> = ({ input }) => {
  const flip: Record<string, string> = { a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z', '.': '˙', ',': "'", "'": ',', '"': '„', '`': ',', '?': '¿', '!': '¡', '[': ']', ']': '[', '(': ')', ')': '(', '{': '}', '}': '{', '<': '>', '>': '<', '&': '⅋', '_': '‾' };
  const variants: [string, string][] = [
    ['Reversed Text', input.split('').reverse().join('')],
    ['Reverse Word Order', input.split(/\s+/).reverse().join(' ')],
    ['Flip Text (upside down)', input.toLowerCase().split('').reverse().map(c => flip[c] ?? c).join('')],
  ];
  return (
    <div className="space-y-3">
      {variants.map(([label, value]) => (
        <div key={label} className="bg-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <CopyBtn text={value} />
          </div>
          <p className="text-base sm:text-lg text-slate-100 break-words">{value || '—'}</p>
        </div>
      ))}
    </div>
  );
};

// ---------- Merge Words ----------
const MergeWords: React.FC<{ input: string; input2: string }> = ({ input, input2 }) => {
  const a = input.split('\n').map(s => s.trim()).filter(Boolean);
  const b = input2.split('\n').map(s => s.trim()).filter(Boolean);
  const combos = a.flatMap(x => b.map(y => `${x} ${y}`));
  return <Output label={`${combos.length} combinations`} value={combos.join('\n')} stats={[
    { label: 'List A', value: String(a.length) }, { label: 'List B', value: String(b.length) },
    { label: 'Combinations', value: String(combos.length) }, { label: '', value: '' },
  ]} />;
};

// ---------- Long Tail Generator ----------
const LongTail: React.FC<{ input: string }> = ({ input }) => {
  const kw = input.trim().toLowerCase();
  const out = useMemo(() => {
    if (!kw) return '';
    const tpl = [
      `best ${kw}`, `top ${kw}`, `${kw} for beginners`, `how to choose ${kw}`, `what is ${kw}`,
      `${kw} guide`, `${kw} tips`, `${kw} checklist`, `${kw} pricing`, `affordable ${kw}`,
      `${kw} near me`, `${kw} online`, `professional ${kw}`, `${kw} for small business`,
      `${kw} review`, `${kw} vs alternative`, `why ${kw} matters`, `how does ${kw} work`,
      `${kw} examples`, `benefits of ${kw}`, `${kw} mistakes to avoid`, `free ${kw} tools`,
      `${kw} checklist 2025`, `step by step ${kw}`, `diy ${kw}`, `cheap ${kw} that work`,
      `${kw} for bloggers`, `${kw} for ecommerce`, `ultimate guide to ${kw}`, `${kw} frequently asked questions`,
    ];
    return tpl.join('\n');
  }, [kw]);
  return <Output label="30 long-tail variations" value={out} />;
};

// ---------- Keyword Rich Domain Ideas ----------
const DomainIdeas: React.FC<{ input: string }> = ({ input }) => {
  const base = input.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const out = useMemo(() => {
    if (!base.length) return '';
    const tlds = ['.com', '.net', '.co', '.io', '.org', '.shop', '.online', '.store'];
    const joins = [base.join(''), base.join(''), base.join('-')];
    const prefixes = ['get', 'try', 'use', 'my', 'the', 'pro'];
    const suffixes = ['hub', 'lab', 'pro', 'co', 'now', 'hq', 'app'];
    const ideas = new Set<string>();
    joins.forEach(j => { if (j) tlds.slice(0, 4).forEach(t => ideas.add(j + t)); });
    prefixes.forEach(p => ideas.add(p + base.join('') + '.com'));
    suffixes.forEach(s => ideas.add(base[0] + s + '.com'));
    return Array.from(ideas).slice(0, 24).join('\n');
  }, [input]);
  return <Output label="Domain name ideas (availability check needed at a registrar)" value={out} />;
};

// ---------- Article Rewriter ----------
const SYNONYMS: Record<string, string> = {
  important: 'essential', good: 'solid', great: 'excellent', big: 'large', small: 'compact', help: 'assist',
  use: 'utilize', make: 'create', show: 'display', buy: 'purchase', start: 'begin', end: 'finish',
  get: 'obtain', need: 'require', many: 'numerous', quick: 'fast', easy: 'straightforward', hard: 'difficult',
  happy: 'pleased', sad: 'unhappy', begin: 'commence', build: 'construct', change: 'modify', check: 'verify',
  improve: 'enhance', provide: 'supply', ensure: 'guarantee', allow: 'enable', find: 'locate', want: 'need',
};
const ArticleRewriter: React.FC<{ input: string }> = ({ input }) => {
  const [output, setOutput] = useState('');
  const rewrite = () => {
    setOutput(input.replace(/\b\w+\b/g, w => {
      const lower = w.toLowerCase();
      const syn = SYNONYMS[lower];
      if (!syn) return w;
      return w[0] === w[0].toUpperCase() ? syn[0].toUpperCase() + syn.slice(1) : syn;
    }));
  };
  return (
    <div>
      <PrimaryBtn type="button" onClick={rewrite} disabled={!input.trim()} className="mb-4">Rewrite Article</PrimaryBtn>
      {output && <Output label="Rewritten text (always proofread and edit)" value={output} mono={false} />}
    </div>
  );
};

// ---------- Grammar Checker ----------
const GrammarChecker: React.FC<{ input: string }> = ({ input }) => {
  const issues = useMemo(() => {
    const out: { type: string; message: string; fix: string }[] = [];
    const fixes: [RegExp, string, string][] = [
      [/\balot\b/gi, '"alot" should be two words', 'a lot'],
      [/\bdont\b/gi, 'Missing apostrophe', "don't"],
      [/\bcant\b/gi, 'Missing apostrophe', "can't"],
      [/\bwont\b/gi, 'Missing apostrophe', "won't"],
      [/\bim\b/gi, 'Missing apostrophe', "I'm"],
      [/\bive\b/gi, 'Missing apostrophe', "I've"],
      [/\byoure\b/gi, 'Missing apostrophe', "you're"],
      [/\bdefinately\b/gi, 'Common misspelling', 'definitely'],
      [/\bseperate\b/gi, 'Common misspelling', 'separate'],
    ];
    fixes.forEach(([re, message]) => {
      const matches = input.match(re);
      if (matches) matches.forEach(() => out.push({ type: 'error', message, fix: re.source.replace(/\\b|\\g|gi/g, '') }));
    });
    if (/ {2,}/.test(input)) out.push({ type: 'warn', message: 'Double (or more) spaces found', fix: 'single spaces' });
    if (/[,.!?]\s[a-z]/.test(input)) out.push({ type: 'warn', message: 'Sentence starts with a lowercase letter after punctuation', fix: 'capitalize sentence starts' });
    const dup = input.match(/\b(\w+)\s+\1\b/gi);
    if (dup) dup.forEach(d => out.push({ type: 'warn', message: `Repeated word: "${d}"`, fix: 'remove duplicate' }));
    return out;
  }, [input]);
  if (!input.trim()) return <Output label="Grammar report" value="Paste text to run grammar checks..." mono={false} />;
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {issues.length === 0 ? (
        <div className="p-6 text-center text-emerald-600 font-semibold">No common grammar or spelling issues detected.</div>
      ) : issues.map((iss, i) => (
        <div key={i} className="p-4 flex items-start gap-3">
          <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${iss.type === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
          <div>
            <p className="text-sm font-medium text-slate-800">{iss.message}</p>
            <p className="text-xs text-slate-500">Suggestion: {iss.fix}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------- Spell Checker ----------
const MISSPELLINGS: Record<string, string> = {
  recieve: 'receive', occuring: 'occurring', occurence: 'occurrence', seperate: 'separate', definately: 'definitely',
  enviroment: 'environment', goverment: 'government', neccessary: 'necessary', accesible: 'accessible', acheive: 'achieve',
  adress: 'address', begining: 'beginning', beleive: 'believe', buisness: 'business', calender: 'calendar',
  cemetary: 'cemetery', changable: 'changeable', cheif: 'chief', collegue: 'colleague', comming: 'coming',
  completly: 'completely', concious: 'conscious', dissapoint: 'disappoint', embarass: 'embarrass', existance: 'existence',
  familar: 'familiar', finaly: 'finally', foriegn: 'foreign', freind: 'friend', gaurd: 'guard',
  grammer: 'grammar', happend: 'happened', harrass: 'harass', wierd: 'weird', writting: 'writing',
  tomorow: 'tomorrow', tounge: 'tongue', untill: 'until', wich: 'which', succesful: 'successful',
};
const SpellChecker: React.FC<{ input: string }> = ({ input }) => {
  const found = useMemo(() => {
    const words = input.toLowerCase().match(/\b[a-z]+\b/g) || [];
    const seen = new Map<string, number>();
    words.forEach(w => { if (MISSPELLINGS[w]) seen.set(w, (seen.get(w) || 0) + 1); });
    return [...seen.entries()];
  }, [input]);
  if (!input.trim()) return <Output label="Spell check" value="Paste text to find typos..." mono={false} />;
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {found.length === 0 ? (
        <div className="p-5 sm:p-6 text-center text-emerald-600 font-semibold">No common spelling mistakes found.</div>
      ) : found.map(([wrong, count]) => (
        <div key={wrong} className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div className="min-w-0 break-words">
            <span className="text-red-600 font-semibold line-through">{wrong}</span>
            <span className="mx-2 text-slate-400">→</span>
            <span className="text-emerald-700 font-semibold">{MISSPELLINGS[wrong]}</span>
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">{count}×</span>
        </div>
      ))}
    </div>
  );
};

// ---------- Text to Speech ----------
const TextToSpeech: React.FC<{ input: string }> = ({ input }) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  // Guarded: browsers without the Web Speech API (and headless test runners)
  // must still render the page instead of throwing.
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => { const v = synth.getVoices(); setVoices(v); setVoiceURI(prev => prev || v[0]?.voiceURI || ''); };
    load();
    synth.onvoiceschanged = load;
    return () => { synth.onvoiceschanged = null; synth.cancel(); };
  }, [supported]);
  const speak = () => {
    if (!supported || typeof SpeechSynthesisUtterance === 'undefined') return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(input);
    const v = voices.find(x => x.voiceURI === voiceURI);
    if (v) u.voice = v;
    u.rate = rate;
    synth.speak(u);
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <select value={voiceURI} onChange={e => setVoiceURI(e.target.value)} className="p-3 rounded-xl border border-slate-300 text-sm bg-white">
          {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
        </select>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-600 whitespace-nowrap">Speed {rate.toFixed(1)}×</label>
          <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))} className="flex-1 accent-indigo-600" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <PrimaryBtn type="button" onClick={speak} disabled={!input.trim() || !supported} className="w-full sm:w-auto">▶ Listen</PrimaryBtn>
        <button type="button" onClick={() => supported && window.speechSynthesis.cancel()} className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700">Stop</button>
      </div>
      {!supported && (
        <p className="text-sm text-red-600">Your browser does not support speech synthesis.</p>
      )}
    </div>
  );
};

// ---------- Minifiers ----------
const minifyCSS = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const minifyHTML = (html: string) =>
  html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').replace(/\s*=\s*/g, '=').trim();
const minifyJS = (js: string) =>
  js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s*\n\s*/g, '\n').replace(/^\s+/gm, '').replace(/\s*([{}();,:=<>+\-*/&|!?])\s*/g, '$1').trim();

const Minifier: React.FC<{ input: string; lang: 'css' | 'html' | 'js' }> = ({ input, lang }) => {
  const result = useMemo(() => {
    if (!input.trim()) return '';
    try {
      return lang === 'css' ? minifyCSS(input) : lang === 'html' ? minifyHTML(input) : minifyJS(input);
    } catch {
      return '';
    }
  }, [input, lang]);
  const before = new Blob([input]).size;
  const after = new Blob([result]).size;
  const pct = before ? Math.round((1 - after / before) * 100) : 0;
  return <Output label={`Minified ${lang.toUpperCase()} · ${pct}% smaller`} value={result || 'Paste code to minify...'} stats={[
    { label: 'Original', value: `${before} B` }, { label: 'Minified', value: `${after} B` },
    { label: 'Saved', value: `${before - after} B` }, { label: 'Reduction', value: `${pct}%` },
  ]} />;
};

// ---------- Sitemap Generator ----------
const SitemapGen: React.FC<{ input: string }> = ({ input }) => {
  const xml = useMemo(() => {
    const urls = input.split('\n').map(u => u.trim()).filter(Boolean);
    if (!urls.length) return '';
    const today = new Date().toISOString().slice(0, 10);
    const body = urls.map((u, i) =>
      `  <url>\n    <loc>${u.startsWith('http') ? u : 'https://' + u}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${i === 0 ? 'daily' : 'monthly'}</changefreq>\n    <priority>${i === 0 ? '1.0' : '0.8'}</priority>\n  </url>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
  }, [input]);
  return <Output label="sitemap.xml — save and upload to your site root" value={xml || 'Paste URLs, one per line...'} />;
};

// ---------- Robots.txt Generator (form) ----------
const RobotsGen: React.FC = () => {
  const [allowAll, setAllowAll] = useState(true);
  const [disallow, setDisallow] = useState('/wp-admin/\n/cart/\n/checkout/');
  const [crawlDelay, setCrawlDelay] = useState('');
  const [sitemap, setSitemap] = useState('https://example.com/sitemap.xml');
  const out = useMemo(() => {
    const lines = ['User-agent: *', allowAll ? 'Allow: /' : 'Disallow: /'];
    if (allowAll) disallow.split('\n').map(s => s.trim()).filter(Boolean).forEach(d => lines.push(`Disallow: ${d.startsWith('/') ? d : '/' + d}`));
    if (crawlDelay) lines.push(`Crawl-delay: ${crawlDelay}`);
    if (sitemap.trim()) lines.push('', `Sitemap: ${sitemap.trim()}`);
    return lines.join('\n');
  }, [allowAll, disallow, crawlDelay, sitemap]);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex gap-3">
          {[['Allow all robots', true], ['Block all robots', false]].map(([label, val]) => (
            <button key={String(val)} type="button" onClick={() => setAllowAll(val as boolean)}
              className={`flex-1 p-4 rounded-xl border text-sm font-semibold transition-colors ${allowAll === val ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}>
              {label as string}
            </button>
          ))}
        </div>
        {allowAll && (
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">Disallow paths (one per line)</label>
            <TextArea value={disallow} onChange={setDisallow} rows={4} />
          </div>
        )}
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1">Crawl delay (seconds, optional)</label>
          <input value={crawlDelay} onChange={e => setCrawlDelay(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 5" className="w-full p-3 rounded-xl border border-slate-300 text-sm" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1">Sitemap URL</label>
          <input value={sitemap} onChange={e => setSitemap(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm font-mono" />
        </div>
      </div>
      <Output label="robots.txt" value={out} />
    </div>
  );
};

// ---------- Meta Tag Generator (form) ----------
const MetaGen: React.FC = () => {
  const [f, setF] = useState({ title: '', desc: '', keywords: '', author: '', canonical: '', robots: 'index, follow' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const domain = (f.canonical || 'https://example.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const html = useMemo(() => `<title>${f.title}</title>
<meta name="description" content="${f.desc}" />
<meta name="keywords" content="${f.keywords}" />
<meta name="robots" content="${f.robots}" />
${f.author ? `<meta name="author" content="${f.author}" />\n` : ''}<link rel="canonical" href="${f.canonical}" />
<meta property="og:title" content="${f.title}" />
<meta property="og:description" content="${f.desc}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />`, [f]);
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        {[
          ['title', 'Site title', 'Your Page Title | Brand Name'],
          ['desc', 'Meta description', 'Compelling 150-160 character summary...'],
          ['keywords', 'Keywords (comma separated)', 'seo, audit, speed'],
          ['author', 'Author / brand', 'Your Brand'],
          ['canonical', 'Canonical URL', 'https://example.com/page'],
        ].map(([k, label, ph]) => (
          <div key={k}>
            <label className="text-sm font-semibold text-slate-700 block mb-1">{label}</label>
            {k === 'desc'
              ? <textarea value={f[k as keyof typeof f]} onChange={set(k as keyof typeof f)} placeholder={ph} rows={2} className="w-full p-3 rounded-xl border border-slate-300 text-sm" />
              : <input value={f[k as keyof typeof f]} onChange={set(k as keyof typeof f)} placeholder={ph} className="w-full p-3 rounded-xl border border-slate-300 text-sm" />}
          </div>
        ))}
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1">Robots</label>
          <select value={f.robots} onChange={set('robots')} className="w-full p-3 rounded-xl border border-slate-300 text-sm bg-white">
            <option>index, follow</option><option>noindex, follow</option><option>index, nofollow</option><option>noindex, nofollow</option>
          </select>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Google preview</p>
          <p className="text-sm text-slate-700 flex items-center gap-2"><span className="w-6 h-6 bg-slate-100 rounded-full inline-block" />{domain}</p>
          <p className="text-lg text-blue-700 leading-snug mt-1">{f.title || 'Your Page Title | Brand Name'}</p>
          <p className="text-sm text-slate-600 mt-1">{f.desc || 'Your meta description will appear here. Aim for 150–160 characters.'}</p>
          <p className={`text-xs mt-2 ${f.desc.length > 160 ? 'text-red-500' : 'text-slate-400'}`}>{f.desc.length} / 160 characters</p>
        </div>
        <Output label="Meta tags HTML" value={html} />
      </div>
    </div>
  );
};

// ---------- Image tools ----------
const ImageTool: React.FC<{ mode: 'compress' | 'resize' }> = ({ mode }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [quality, setQuality] = useState(0.7);
  const [width, setWidth] = useState(0);
  const [resultUrl, setResultUrl] = useState('');
  const [resultSize, setResultSize] = useState(0);
  const [origSize, setOrigSize] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    setFile(f); setFileName(f.name); setOrigSize(f.size); setResultUrl('');
    const i = new Image();
    i.onload = () => { setImg(i); setWidth(i.naturalWidth); };
    i.src = URL.createObjectURL(f);
  };

  const process = () => {
    if (!img || !file) return;
    const targetW = mode === 'resize' && width ? width : img.naturalWidth;
    const h = mode === 'resize' && width ? Math.round(img.naturalHeight * (width / img.naturalWidth)) : img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = targetW; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, targetW, h);
    const useWebp = file.type === 'image/webp' || mode === 'compress';
    canvas.toBlob(blob => {
      if (!blob) return;
      setResultSize(blob.size);
      setResultUrl(URL.createObjectURL(blob));
    }, useWebp ? 'image/webp' : 'image/jpeg', mode === 'compress' ? quality : 0.92);
  };

  const kb = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${Math.round(b / 1024)} KB`;

  return (
    <div className="space-y-5">
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />
        <p className="text-slate-600 font-medium">{fileName || 'Click or drop an image here'}</p>
        <p className="text-xs text-slate-400 mt-1">Everything runs locally in your browser — no uploads</p>
      </div>

      {img && mode === 'compress' && (
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1">Quality: {Math.round(quality * 100)}%</label>
          <input type="range" min="0.1" max="1" step="0.05" value={quality} onChange={e => setQuality(Number(e.target.value))} className="w-full accent-indigo-600" />
        </div>
      )}
      {img && mode === 'resize' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">Width (px)</label>
            <input type="number" value={width || ''} onChange={e => setWidth(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1">Height (auto)</label>
            <input value={width ? Math.round((img?.naturalHeight || 1) * (width / (img?.naturalWidth || 1))) : img?.naturalHeight || 0} readOnly className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-slate-50" />
          </div>
        </div>
      )}

      {img && <PrimaryBtn type="button" onClick={process}>{mode === 'compress' ? 'Compress Image' : 'Resize Image'}</PrimaryBtn>}

      {resultUrl && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <img src={resultUrl} alt="Result preview" className="max-h-64 mx-auto rounded-lg" />
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm">
              <span className="text-slate-500">{kb(origSize)}</span>
              <span className="mx-2 text-slate-400">→</span>
              <span className="font-bold text-emerald-600">{kb(resultSize)}</span>
              <span className="ml-2 text-emerald-600 text-xs font-semibold">({Math.round((1 - resultSize / origSize) * 100)}% smaller)</span>
            </div>
            <a href={resultUrl} download={mode === 'compress' ? 'compressed.webp' : fileName.replace(/\.\w+$/, '-resized.jpg')} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Download</a>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Engine dispatcher ----------
export const WorkingEngine: React.FC<{ slug: string; input: string; input2: string }> = ({ slug, input, input2 }) => {
  switch (slug) {
    case 'word-counter': return <WordCounter input={input} />;
    case 'case-converter': return <CaseConverter input={input} />;
    case 'keyword-density-checker': return <DensityChecker input={input} />;
    case 'online-md5-generator': return <HashGenerator input={input} />;
    case 'small-text-generator': return <SmallText input={input} />;
    case 'reverse-text-generator': return <ReverseText input={input} />;
    case 'merge-words-online-tool': return <MergeWords input={input} input2={input2} />;
    case 'long-tail-keyword-generator': return <LongTail input={input} />;
    case 'keyword-rich-domains-suggestions-tool': return <DomainIdeas input={input} />;
    case 'article-rewriter': return <ArticleRewriter input={input} />;
    case 'grammar-checker': return <GrammarChecker input={input} />;
    case 'spell-checker': return <SpellChecker input={input} />;
    case 'text-to-speech': return <TextToSpeech input={input} />;
    case 'css-minify': return <Minifier input={input} lang="css" />;
    case 'html-minify': return <Minifier input={input} lang="html" />;
    case 'javascript-minifier': return <Minifier input={input} lang="js" />;
    case 'xml-sitemap-generator': return <SitemapGen input={input} />;
    default: return null;
  }
};

export { MetaGen, RobotsGen, ImageTool };
