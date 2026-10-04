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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {variants.map(([label, value]) => (
        <div key={label} className="min-w-0 bg-slate-900 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
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
type CompItem = { id: number; name: string; img: HTMLImageElement; origSize: number; mime: string };
type CompOut = { id: number; base: string; url: string; size: number; ext: string; w?: number; h?: number };
type LinkKind = 'url' | 'dropbox' | 'drive';

const compSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const HelpDot: React.FC<{ text: string }> = ({ text }) => (
  <span className="relative inline-flex group">
    <button
      type="button"
      aria-label="What does this mean?"
      className="w-5 h-5 shrink-0 rounded-full border border-slate-300 text-slate-400 text-[11px] leading-none flex items-center justify-center hover:border-indigo-400 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300"
    >?</button>
    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 z-40 rounded-lg bg-slate-900 text-white text-xs leading-relaxed p-3 shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
      {text}
    </span>
  </span>
);

const IcoImage: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <circle cx="9.2" cy="8.6" r="1.7" />
    <path d="M21 15.8l-4.8-4.8L6.6 20.6" />
  </svg>
);
const IcoSelect: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
    <rect x="4" y="3" width="13" height="16" rx="2" />
    <path d="M8 8h5M8 12h4" />
    <circle cx="17.5" cy="16.5" r="4" fill="currentColor" stroke="none" opacity="0.15" />
    <circle cx="17.5" cy="16.5" r="3.6" fill="white" stroke="currentColor" />
    <path d="M17.5 15v3M16 16.5h3" />
  </svg>
);
const IcoDevice: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
    <rect x="2" y="4" width="15" height="11" rx="2" />
    <path d="M6 19h7M9.5 15v4" />
    <rect x="16.5" y="9" width="5.5" height="11" rx="1.5" fill="white" />
  </svg>
);
const IcoDropbox: React.FC = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <g fill="#0061FF">
      <path d="M6.2 1.9L11.9 5.6 6.2 9.3 0.5 5.6z" />
      <path d="M17.8 1.9L23.5 5.6 17.8 9.3 12.1 5.6z" />
      <path d="M6.2 9.5L11.9 13.2 6.2 16.9 0.5 13.2z" />
      <path d="M17.8 9.5L23.5 13.2 17.8 16.9 12.1 13.2z" />
      <path d="M6.3 18.1l5.7 3.7 5.7-3.7-5.7-3.6z" />
    </g>
  </svg>
);
const IcoDrive: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="4" className="w-5 h-5" aria-hidden="true">
    <path stroke="#00AC47" d="M10.6 4.2L3.6 16.4" />
    <path stroke="#FFBA00" d="M13.4 4.2l7 12.2" />
    <path stroke="#0066DA" d="M6.4 19.6h11.2" />
  </svg>
);
const IcoLink: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const Chevron: React.FC<{ up?: boolean; className?: string }> = ({ up = false, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    className={`${className} transition-transform ${up ? '' : 'rotate-180'}`} aria-hidden="true">
    <path d="M6 15l6-6 6 6" />
  </svg>
);

/** Turn Dropbox / Google Drive share links into direct-download links. */
const toDirectLink = (raw: string, kind: LinkKind): string => {
  let u = raw.trim();
  if (kind === 'dropbox') {
    u = u.replace(/([?&])(dl|raw)=[^&]*/g, '$1').replace(/[?&]+$/, '');
    u += (u.includes('?') ? '&' : '?') + 'raw=1';
  } else if (kind === 'drive') {
    const m = u.match(/\/file\/d\/([^/?#]+)/) || u.match(/[?&#]id=([^&#]+)/);
    if (m) u = `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }
  return u;
};

const nameFrom = (u: string) => {
  try {
    const d = decodeURIComponent(new URL(u).pathname.split('/').filter(Boolean).pop() || '');
    return d || 'image';
  } catch { return 'image'; }
};

/** Loaded source images plus the fetchers behind the Device / Dropbox / Drive / URL menu. */
const useSrcImages = () => {
  const [items, setItems] = useState<CompItem[]>([]);
  const idRef = useRef(0);

  const addBlob = (blob: Blob, name: string) => new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const i = new Image();
    i.onload = () => { idRef.current += 1; setItems(p => [...p, { id: idRef.current, name, img: i, origSize: blob.size, mime: blob.type }]); resolve(); };
    i.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be decoded as an image.')); };
    i.src = url;
  });

  const addFiles = async (list: FileList | File[]) => {
    const files = Array.from(list).filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(f.name));
    let added = 0;
    for (const f of files) { try { await addBlob(f, f.name); added += 1; } catch { /* skip undecodable files */ } }
    return added;
  };

  const addLink = async (raw: string, kind: LinkKind) => {
    let u = raw.trim();
    if (!u) throw new Error('Paste a link first.');
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    const resp = await fetch(toDirectLink(u, kind), { credentials: 'omit' });
    if (!resp.ok) throw new Error(`The server answered HTTP ${resp.status}.`);
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) throw new Error('That link did not return an image. Copy a direct image link instead.');
    await addBlob(blob, nameFrom(u));
  };

  const removeItem = (id: number) => setItems(p => p.filter(i => i.id !== id));
  const clear = () => setItems([]);

  return { items, addFiles, addLink, removeItem, clear };
};

const linkErrMsg = (err: unknown) => (err instanceof TypeError
  ? 'The provider blocked direct browser access (CORS). Download the file and use From Device instead.'
  : err instanceof Error ? err.message : 'Could not fetch that link.');

/** Blue drop zone with the "Select Images" source menu (device / Dropbox / Drive / URL). */
const SourceDropzone: React.FC<{
  items: CompItem[];
  onFiles: (list: FileList | File[]) => Promise<number>;
  onLink: (raw: string, kind: LinkKind) => Promise<void>;
  onRemove: (id: number) => void;
}> = ({ items, onFiles, onLink, onRemove }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<LinkKind | null>(null);
  const [link, setLink] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); setModal(null); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const pick = async (list: FileList | File[]) => { await onFiles(list); };

  const submit = async () => {
    setLinkBusy(true); setLinkErr('');
    try {
      await onLink(link, modal || 'url');
      setModal(null); setLink('');
    } catch (err) { setLinkErr(linkErrMsg(err)); }
    finally { setLinkBusy(false); }
  };

  const modalMeta: Record<LinkKind, { title: string; hint: string; ph: string }> = {
    url: { title: 'Add image from URL', hint: 'Paste a direct link to an image (ending in .jpg, .png, .webp…). It is fetched straight into your browser.', ph: 'https://example.com/photo.jpg' },
    dropbox: { title: 'Import from Dropbox', hint: 'Paste a Dropbox share link — it is converted to a direct link and downloaded straight into your browser.', ph: 'https://www.dropbox.com/s/…/photo.jpg?dl=0' },
    drive: { title: 'Import from Google Drive', hint: 'Paste a Google Drive share link set to “anyone with the link” — the file is downloaded straight into your browser.', ph: 'https://drive.google.com/file/d/…/view' },
  };

  return (
    <>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void pick(e.dataTransfer.files); }}
        className="bg-indigo-100/80 rounded-2xl p-3 sm:p-4"
      >
        <div className={`border-2 border-dashed rounded-xl min-h-[280px] flex flex-col items-center justify-center gap-6 p-6 transition-colors ${drag ? 'border-indigo-700 bg-indigo-600/70' : 'border-indigo-500/60 bg-indigo-500/70'}`}>
          <IcoImage className="w-16 h-16 text-white/90" />
          <div ref={menuRef} className="relative">
            <div className="flex rounded-lg overflow-hidden shadow-lg">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2.5 bg-slate-50 hover:bg-white px-5 sm:px-7 py-3.5 text-slate-900 font-bold text-sm sm:text-base"
              >
                <IcoSelect /> Select Images
              </button>
              <button
                type="button"
                aria-label="Choose a source"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
                className="bg-slate-200 hover:bg-slate-300 px-3.5 text-slate-800 border-l border-slate-300"
              >
                <Chevron up={menuOpen} />
              </button>
            </div>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-slate-50 rounded-xl shadow-xl border border-slate-200 py-2 z-30">
                <button type="button" className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}>
                  <IcoDevice /> From Device
                </button>
                <button type="button" className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  onClick={() => { setMenuOpen(false); setLinkErr(''); setModal('dropbox'); }}>
                  <IcoDropbox /> From Dropbox
                </button>
                <button type="button" className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  onClick={() => { setMenuOpen(false); setLinkErr(''); setModal('drive'); }}>
                  <IcoDrive /> From Google Drive
                </button>
                <button type="button" className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                  onClick={() => { setMenuOpen(false); setLinkErr(''); setModal('url'); }}>
                  <IcoLink /> From URL
                </button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files?.length) void pick(e.target.files); e.target.value = ''; }} />
          {items.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2 max-w-xl">
              {items.map(i => (
                <li key={i.id} className="relative group bg-white/95 rounded-lg shadow p-1.5">
                  <img src={i.img.src} alt={i.name} className="w-14 h-14 object-cover rounded" />
                  <button
                    type="button"
                    aria-label={`Remove ${i.name}`}
                    onClick={() => onRemove(i.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 text-white text-xs leading-none flex items-center justify-center hover:bg-red-600"
                  >&times;</button>
                  <span className="block text-[10px] text-slate-500 text-center mt-0.5 max-w-14 truncate">{compSize(i.origSize)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 text-center -mt-2">Everything runs locally in your browser — images are never uploaded to a server.</p>

      {modal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={modalMeta[modal].title}
          onClick={() => !linkBusy && setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{modalMeta[modal].title}</h3>
              <button type="button" aria-label="Close" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{modalMeta[modal].hint}</p>
            <input
              autoFocus
              value={link}
              onChange={e => setLink(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
              placeholder={modalMeta[modal].ph}
              className="w-full mt-4 p-3 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono"
            />
            {linkErr && <p className="text-sm text-red-600 mt-2">{linkErr}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={() => void submit()} disabled={linkBusy}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:shadow-lg disabled:opacity-50">
                {linkBusy ? 'Fetching…' : 'Fetch Image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const ImageCompressor: React.FC = () => {
  const { items, addFiles, addLink, removeItem } = useSrcImages();
  const [out, setOut] = useState<CompOut[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [cfgMode, setCfgMode] = useState<'quality' | 'maxsize'>('quality');
  const [quality, setQuality] = useState(80);
  const [maxKB, setMaxKB] = useState(500);
  const [busy, setBusy] = useState(false);

  const clearOut = () => setOut(prev => { prev.forEach(o => URL.revokeObjectURL(o.url)); return []; });

  const encode = (img: HTMLImageElement, q: number) => new Promise<Blob | null>(resolve => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    if (!ctx) { resolve(null); return; }
    ctx.drawImage(img, 0, 0);
    c.toBlob(b => resolve(b), 'image/webp', q);
  });

  const run = async () => {
    if (!items.length || busy) return;
    setBusy(true);
    const fresh: CompOut[] = [];
    for (const it of items) {
      let blob: Blob | null = null;
      if (cfgMode === 'maxsize') {
        const target = maxKB * 1024;
        const top = await encode(it.img, 0.95);
        if (top && top.size <= target) blob = top;
        else {
          let lo = 0.05, hi = 0.95;
          for (let i = 0; i < 6; i++) {
            const mid = (lo + hi) / 2;
            const b = await encode(it.img, mid);
            if (!b) break;
            if (b.size <= target) { blob = b; lo = mid; } else hi = mid;
          }
          if (!blob) blob = await encode(it.img, 0.05);
        }
      } else {
        blob = await encode(it.img, quality / 100);
      }
      if (!blob) continue;
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
      fresh.push({ id: it.id, base: it.name.replace(/\.[^.]+$/, '') || 'image', url: URL.createObjectURL(blob), size: blob.size, ext });
    }
    setOut(prev => { prev.forEach(o => URL.revokeObjectURL(o.url)); return fresh; });
    setBusy(false);
  };

  const totalOrig = out.reduce((s, o) => s + (items.find(i => i.id === o.id)?.origSize ?? 0), 0);
  const totalNew = out.reduce((s, o) => s + o.size, 0);

  return (
    <div className="space-y-5">
      <SourceDropzone
        items={items}
        onFiles={async l => { const n = await addFiles(l); if (n) clearOut(); return n; }}
        onLink={async (raw, kind) => { await addLink(raw, kind); clearOut(); }}
        onRemove={id => { removeItem(id); clearOut(); }}
      />

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <button
          type="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(o => !o)}
          className="w-full flex items-center justify-between bg-indigo-100/80 px-5 py-4"
        >
          <span className="font-bold text-slate-900">Compression Settings (optional)</span>
          <Chevron up={settingsOpen} className="w-5 h-5 text-slate-800" />
        </button>
        {settingsOpen && (
          <div className="bg-white divide-y divide-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
              <label className="flex items-center gap-3 sm:w-60 shrink-0 cursor-pointer">
                <input type="radio" name="compress-mode" checked={cfgMode === 'maxsize'} onChange={() => setCfgMode('maxsize')} className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Max File Size (KB)</span>
                <HelpDot text="We automatically tune the compression level until the output fits under this size. Useful for strict upload forms." />
              </label>
              <input
                type="range" min={50} max={2000} step={10} value={maxKB}
                disabled={cfgMode !== 'maxsize'}
                onChange={e => { setMaxKB(Number(e.target.value)); setCfgMode('maxsize'); }}
                aria-label="Maximum file size in kilobytes"
                className="flex-1 accent-indigo-600 disabled:opacity-40"
              />
              <span className={`text-sm font-semibold text-slate-600 sm:w-20 text-right ${cfgMode === 'maxsize' ? '' : 'opacity-40'}`}>{maxKB} KB</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
              <label className="flex items-center gap-3 sm:w-60 shrink-0 cursor-pointer">
                <input type="radio" name="compress-mode" checked={cfgMode === 'quality'} onChange={() => setCfgMode('quality')} className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm font-bold text-slate-800">Quality</span>
                <HelpDot text="Pick the output quality yourself. Lower quality means a smaller file; 70–80% is usually indistinguishable from the original." />
              </label>
              <input
                type="range" min={10} max={100} step={5} value={quality}
                disabled={cfgMode !== 'quality'}
                onChange={e => { setQuality(Number(e.target.value)); setCfgMode('quality'); }}
                aria-label="Output quality percent"
                className="flex-1 accent-indigo-600 disabled:opacity-40"
              />
              <span className={`text-sm font-semibold text-slate-600 sm:w-20 text-right ${cfgMode === 'quality' ? '' : 'opacity-40'}`}>{quality}%</span>
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <PrimaryBtn type="button" onClick={() => void run()} disabled={busy}>
          {busy ? 'Compressing…' : `Compress ${items.length > 1 ? `${items.length} Images` : 'Image'}`}
        </PrimaryBtn>
      )}

      {out.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-3 text-sm">
            <span className="text-slate-500">{compSize(totalOrig)}</span>
            <span className="mx-2 text-slate-400">→</span>
            <span className="font-bold text-emerald-600">{compSize(totalNew)}</span>
            <span className="ml-2 text-emerald-600 text-xs font-semibold">({totalOrig > 0 ? Math.round((1 - totalNew / totalOrig) * 100) : 0}% smaller)</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {out.map(r => {
              const orig = items.find(i => i.id === r.id)?.origSize ?? r.size;
              return (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <img src={r.url} alt={`Compressed ${r.base}`} className="max-h-48 mx-auto rounded-lg" />
                  <p className="text-xs text-slate-500 text-center mt-2 truncate">{r.base}.{r.ext}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm">
                      <span className="text-slate-500">{compSize(orig)}</span>
                      <span className="mx-2 text-slate-400">→</span>
                      <span className="font-bold text-emerald-600">{compSize(r.size)}</span>
                    </div>
                    <a href={r.url} download={`${r.base}-compressed.${r.ext}`} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Download</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const ImageResizer: React.FC = () => {
  const { items, addFiles, addLink, removeItem } = useSrcImages();
  const [out, setOut] = useState<CompOut[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [lock, setLock] = useState(true);
  const [busy, setBusy] = useState(false);

  const clearOut = () => setOut(prev => { prev.forEach(o => URL.revokeObjectURL(o.url)); return []; });

  const dims = (nw: number, nh: number): [number, number] => {
    if (lock) {
      const s = width ? width / nw : height ? height / nh : 1;
      return [Math.max(1, Math.round(nw * s)), Math.max(1, Math.round(nh * s))];
    }
    return [width || nw, height || nh];
  };

  const run = async () => {
    if (!items.length || busy) return;
    setBusy(true);
    const fresh: CompOut[] = [];
    for (const it of items) {
      const nw = it.img.naturalWidth, nh = it.img.naturalHeight;
      const [tw, th] = dims(nw, nh);
      const c = document.createElement('canvas');
      c.width = tw; c.height = th;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(it.img, 0, 0, tw, th);
      const blob = await new Promise<Blob | null>(res => c.toBlob(b => res(b), it.mime === 'image/webp' ? 'image/webp' : 'image/jpeg', 0.92));
      if (!blob) continue;
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      fresh.push({ id: it.id, base: it.name.replace(/\.[^.]+$/, '') || 'image', url: URL.createObjectURL(blob), size: blob.size, ext, w: tw, h: th });
    }
    setOut(prev => { prev.forEach(o => URL.revokeObjectURL(o.url)); return fresh; });
    setBusy(false);
  };

  const first = items[0];

  return (
    <div className="space-y-5">
      <SourceDropzone
        items={items}
        onFiles={async l => { const n = await addFiles(l); if (n) clearOut(); return n; }}
        onLink={async (raw, kind) => { await addLink(raw, kind); clearOut(); }}
        onRemove={id => { removeItem(id); clearOut(); }}
      />

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <button
          type="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(o => !o)}
          className="w-full flex items-center justify-between bg-indigo-100/80 px-5 py-4"
        >
          <span className="font-bold text-slate-900">Resize Settings (optional)</span>
          <Chevron up={settingsOpen} className="w-5 h-5 text-slate-800" />
        </button>
        {settingsOpen && (
          <div className="bg-white px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Width (px)</label>
                <input type="number" min={1} value={width || ''} placeholder={first ? String(first.img.naturalWidth) : 'e.g. 1280'}
                  onChange={e => setWidth(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1">Height (px)</label>
                <input type="number" min={1} value={lock ? (first && width ? dims(first.img.naturalWidth, first.img.naturalHeight)[1] : '') : height || ''}
                  placeholder="Auto" disabled={lock}
                  onChange={e => setHeight(Number(e.target.value))} className="w-full p-3 rounded-xl border border-slate-300 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={lock} onChange={e => setLock(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm font-bold text-slate-800">Keep aspect ratio</span>
              <HelpDot text="Each image is scaled by the same ratio so nothing gets stretched. Turn off to force exact pixel dimensions." />
            </label>
            {!lock && <p className="text-xs text-slate-400">Leave a field empty to keep that dimension unchanged.</p>}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <PrimaryBtn type="button" onClick={() => void run()} disabled={busy}>
          {busy ? 'Resizing…' : `Resize ${items.length > 1 ? `${items.length} Images` : 'Image'}`}
        </PrimaryBtn>
      )}

      {out.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {out.map(r => {
            const orig = items.find(i => i.id === r.id)?.origSize ?? r.size;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <img src={r.url} alt={`Resized ${r.base}`} className="max-h-48 mx-auto rounded-lg" />
                <p className="text-xs text-slate-500 text-center mt-2 truncate">{r.base}-resized.{r.ext} · {r.w}×{r.h}px</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm">
                    <span className="text-slate-500">{compSize(orig)}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="font-bold text-emerald-600">{compSize(r.size)}</span>
                  </div>
                  <a href={r.url} download={`${r.base}-resized.${r.ext}`} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Download</a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------- Image to Text (in-browser OCR) ----------
type TessWorker = { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<void> };
type TessModule = { createWorker: (langs: string) => Promise<TessWorker> };
let tessLoad: Promise<TessModule> | null = null;
const loadTesseract = (): Promise<TessModule> => {
  if (!tessLoad) tessLoad = new Promise((resolve, reject) => {
    const w = window as unknown as { Tesseract?: TessModule };
    if (w.Tesseract) { resolve(w.Tesseract); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.async = true;
    s.onload = () => {
      const t = (window as unknown as { Tesseract?: TessModule }).Tesseract;
      if (t) resolve(t);
      else { tessLoad = null; reject(new Error('Could not load the OCR engine. Check your connection and try again.')); }
    };
    s.onerror = () => { tessLoad = null; reject(new Error('Could not load the OCR engine. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return tessLoad;
};

const OCR_LANGS: [string, string][] = [
  ['eng', 'English'],
  ['urd', 'Urdu'],
  ['ara', 'Arabic'],
  ['hin', 'Hindi'],
  ['spa', 'Spanish'],
  ['fra', 'French'],
  ['deu', 'German'],
  ['chi_sim', 'Chinese (simplified)'],
];

const ImageToText: React.FC = () => {
  const { items, addFiles, addLink, removeItem, clear } = useSrcImages();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [lang, setLang] = useState('eng');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [out, setOut] = useState<{ id: number; base: string; text: string; url: string }[]>([]);

  const clearOut = () => setOut(prev => { prev.forEach(o => URL.revokeObjectURL(o.url)); return []; });

  const run = async () => {
    if (!items.length || busy) return;
    setBusy(true); setErr(''); setStatus('Loading OCR engine…');
    try {
      const T = await loadTesseract();
      const worker = await T.createWorker(lang);
      const fresh: { id: number; base: string; text: string; url: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        setStatus(`Recognizing image ${i + 1} of ${items.length}…`);
        const c = document.createElement('canvas');
        c.width = it.img.naturalWidth; c.height = it.img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(it.img, 0, 0);
        const { data } = await worker.recognize(c);
        const text = (data.text || '').trim();
        fresh.push({ id: it.id, base: it.name.replace(/\.[^.]+$/, '') || 'image', text, url: URL.createObjectURL(new Blob([text], { type: 'text/plain' })) });
      }
      await worker.terminate();
      setOut(prev => { prev.forEach(o => URL.revokeObjectURL(o.url)); return fresh; });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'OCR failed. Try another image.');
    }
    setStatus(''); setBusy(false);
  };

  const reset = () => { clear(); clearOut(); setErr(''); setStatus(''); };

  return (
    <div className="space-y-5">
      <SourceDropzone
        items={items}
        onFiles={async l => { const n = await addFiles(l); if (n) clearOut(); return n; }}
        onLink={async (raw, kind) => { await addLink(raw, kind); clearOut(); }}
        onRemove={id => { removeItem(id); clearOut(); }}
      />

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <button
          type="button"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(o => !o)}
          className="w-full flex items-center justify-between bg-indigo-100/80 px-5 py-4"
        >
          <span className="font-bold text-slate-900">Recognition Settings (optional)</span>
          <Chevron up={settingsOpen} className="w-5 h-5 text-slate-800" />
        </button>
        {settingsOpen && (
          <div className="bg-white px-5 py-4">
            <label className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-slate-800">Text language</span>
              <HelpDot text="Choose the language the text in your images is written in. Right-to-left scripts like Urdu and Arabic are displayed correctly in the results." />
              <select value={lang} onChange={e => setLang(e.target.value)} className="p-2.5 rounded-xl border border-slate-300 text-sm bg-white">
                {OCR_LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <PrimaryBtn type="button" onClick={() => void run()} disabled={busy}>
          {busy ? 'Converting…' : 'Convert to Text'}
        </PrimaryBtn>
      )}
      {status && <p className="text-sm text-slate-500 text-center">{status}</p>}
      {err && <p className="text-sm text-red-600 text-center">{err}</p>}

      {out.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Extracted Text</h2>
            <button type="button" onClick={reset} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700">Start Again</button>
          </div>
          {out.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.base}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <CopyBtn text={r.text} />
                  <a href={r.url} download={`${r.base}.txt`} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700">Download .txt</a>
                </div>
              </div>
              <div dir="auto" className="p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {r.text || 'No readable text found in this image.'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ImageTool: React.FC<{ mode: 'compress' | 'resize' }> = ({ mode }) =>
  (mode === 'compress' ? <ImageCompressor /> : <ImageResizer />);

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

export { MetaGen, RobotsGen, ImageTool, ImageToText };
