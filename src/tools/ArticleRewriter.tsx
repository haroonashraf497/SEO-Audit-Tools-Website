import React, { useMemo, useRef, useState } from 'react';
import { Seeded } from './simulator';

const WORD_LIMIT = 2000;

// ---------- Synonym thesaurus (word -> alternatives, best first) ----------
const THESAURUS: Record<string, string[]> = {
  important: ['essential', 'crucial', 'vital', 'significant'], good: ['excellent', 'solid', 'great', 'fine'], great: ['excellent', 'outstanding', 'remarkable', 'superb'],
  big: ['large', 'substantial', 'sizeable', 'huge'], small: ['compact', 'modest', 'little', 'minor'], help: ['assist', 'support', 'aid'], helps: ['assists', 'supports', 'aids'],
  use: ['utilise', 'employ', 'apply'], uses: ['utilises', 'employs', 'applies'], using: ['utilising', 'employing', 'applying'], used: ['utilised', 'employed', 'applied'],
  make: ['create', 'produce', 'build'], makes: ['creates', 'produces', 'builds'], making: ['creating', 'producing', 'building'], made: ['created', 'produced', 'built'],
  show: ['display', 'demonstrate', 'reveal'], shows: ['displays', 'demonstrates', 'reveals'], showed: ['displayed', 'demonstrated', 'revealed'],
  buy: ['purchase', 'acquire', 'obtain'], start: ['begin', 'commence', 'launch'], started: ['began', 'commenced', 'launched'], end: ['finish', 'conclude', 'complete'],
  get: ['obtain', 'receive', 'acquire'], gets: ['obtains', 'receives', 'acquires'], got: ['obtained', 'received', 'acquired'], need: ['require', 'demand'], needs: ['requires', 'demands'],
  many: ['numerous', 'countless', 'a great many'], quick: ['fast', 'rapid', 'swift'], quickly: ['rapidly', 'swiftly', 'promptly'], easy: ['straightforward', 'simple', 'effortless'],
  hard: ['difficult', 'challenging', 'tough'], happy: ['pleased', 'delighted', 'content'], sad: ['unhappy', 'sorrowful', 'downcast'], build: ['construct', 'develop', 'create'],
  change: ['modify', 'alter', 'adjust'], changes: ['modifies', 'alters', 'adjusts'], check: ['verify', 'examine', 'inspect'], improve: ['enhance', 'boost', 'strengthen'],
  improves: ['enhances', 'boosts', 'strengthens'], provide: ['supply', 'deliver', 'offer'], provides: ['supplies', 'delivers', 'offers'], ensure: ['guarantee', 'make certain'],
  allow: ['enable', 'permit', 'let'], allows: ['enables', 'permits', 'lets'], find: ['locate', 'discover', 'identify'], want: ['wish', 'desire', 'would like'],
  think: ['believe', 'consider', 'reckon'], know: ['understand', 'recognise', 'realise'], see: ['observe', 'notice', 'view'], look: ['appear', 'seem', 'glance'],
  very: ['extremely', 'highly', 'remarkably'], really: ['truly', 'genuinely', 'certainly'], also: ['additionally', 'likewise', 'as well'], but: ['however', 'yet', 'though'],
  because: ['since', 'as', 'given that'], so: ['therefore', 'thus', 'consequently'], however: ['nevertheless', 'nonetheless', 'yet'], often: ['frequently', 'regularly', 'commonly'],
  usually: ['typically', 'generally', 'normally'], always: ['consistently', 'invariably', 'at all times'], new: ['fresh', 'modern', 'recent'], old: ['aged', 'former', 'previous'],
  best: ['finest', 'top', 'leading'], better: ['superior', 'improved', 'preferable'], different: ['distinct', 'various', 'diverse'], same: ['identical', 'equivalent', 'matching'],
  popular: ['well-known', 'widely used', 'favoured'], simple: ['straightforward', 'basic', 'uncomplicated'], strong: ['robust', 'powerful', 'sturdy'], weak: ['feeble', 'fragile', 'frail'],
  fast: ['rapid', 'quick', 'speedy'], slow: ['sluggish', 'gradual', 'unhurried'], cheap: ['affordable', 'inexpensive', 'budget-friendly'], expensive: ['costly', 'pricey', 'high-priced'],
  beautiful: ['stunning', 'gorgeous', 'lovely'], amazing: ['incredible', 'astonishing', 'remarkable'], interesting: ['fascinating', 'engaging', 'intriguing'], famous: ['renowned', 'celebrated', 'well-known'],
  people: ['individuals', 'folks', 'users'], company: ['business', 'firm', 'organisation'], companies: ['businesses', 'firms', 'organisations'], customer: ['client', 'buyer', 'consumer'],
  customers: ['clients', 'buyers', 'consumers'], product: ['item', 'offering', 'solution'], products: ['items', 'offerings', 'solutions'], service: ['offering', 'assistance'], services: ['offerings', 'solutions'],
  website: ['site', 'web page', 'online platform'], content: ['material', 'copy', 'information'], article: ['post', 'piece', 'write-up'], information: ['details', 'data', 'facts'],
  idea: ['concept', 'notion', 'thought'], ideas: ['concepts', 'notions', 'thoughts'], way: ['method', 'approach', 'manner'], ways: ['methods', 'approaches', 'techniques'],
  problem: ['issue', 'challenge', 'difficulty'], problems: ['issues', 'challenges', 'difficulties'], result: ['outcome', 'consequence', 'effect'], results: ['outcomes', 'findings', 'effects'],
  benefit: ['advantage', 'gain', 'upside'], benefits: ['advantages', 'gains', 'perks'], goal: ['objective', 'aim', 'target'], goals: ['objectives', 'aims', 'targets'],
  increase: ['boost', 'raise', 'grow'], increases: ['boosts', 'raises', 'grows'], reduce: ['lower', 'decrease', 'cut'], reduces: ['lowers', 'decreases', 'cuts'],
  create: ['produce', 'generate', 'craft'], creates: ['produces', 'generates', 'crafts'], learn: ['discover', 'master', 'pick up'], understand: ['grasp', 'comprehend', 'appreciate'],
  explain: ['clarify', 'describe', 'outline'], discuss: ['examine', 'explore', 'talk about'], choose: ['select', 'pick', 'opt for'], decide: ['determine', 'settle on', 'resolve'],
  begin: ['start', 'commence', 'initiate'], finish: ['complete', 'conclude', 'wrap up'], keep: ['maintain', 'retain', 'preserve'], give: ['offer', 'provide', 'grant'],
  tell: ['inform', 'notify', 'advise'], ask: ['request', 'enquire', 'question'], try: ['attempt', 'endeavour', 'strive'], work: ['function', 'operate', 'perform'],
  works: ['functions', 'operates', 'performs'], grow: ['expand', 'develop', 'flourish'], growth: ['expansion', 'development', 'progress'], success: ['achievement', 'accomplishment', 'triumph'],
  successful: ['thriving', 'prosperous', 'effective'], effective: ['efficient', 'successful', 'powerful'], efficient: ['effective', 'productive', 'streamlined'], reliable: ['dependable', 'trustworthy', 'consistent'],
  safe: ['secure', 'protected', 'risk-free'], free: ['complimentary', 'no-cost', 'without charge'], perfect: ['ideal', 'flawless', 'impeccable'], modern: ['contemporary', 'current', 'up-to-date'],
  main: ['primary', 'principal', 'key'], major: ['significant', 'key', 'principal'], minor: ['small', 'slight', 'lesser'], several: ['multiple', 'various', 'a number of'],
  various: ['numerous', 'diverse', 'assorted'], entire: ['whole', 'complete', 'full'], whole: ['entire', 'complete', 'full'], every: ['each', 'all'], each: ['every'],
  huge: ['enormous', 'massive', 'vast'], tiny: ['minuscule', 'minute', 'very small'], clear: ['obvious', 'evident', 'plain'], obvious: ['clear', 'evident', 'apparent'],
  probably: ['likely', 'presumably', 'in all likelihood'], maybe: ['perhaps', 'possibly'], almost: ['nearly', 'practically', 'virtually'], completely: ['entirely', 'totally', 'fully'],
  especially: ['particularly', 'notably', 'specifically'], finally: ['ultimately', 'lastly', 'in the end'], currently: ['presently', 'at present', 'right now'], recently: ['lately', 'of late', 'not long ago'],
  today: ['nowadays', 'these days', 'in the present day'], first: ['initial', 'foremost', 'primary'], last: ['final', 'concluding', 'ultimate'], next: ['following', 'subsequent', 'upcoming'],
  seo: ['search engine optimisation', 'SEO'], google: ['Google', 'the search engine'], traffic: ['visitors', 'visits', 'audience'], ranking: ['position', 'placement', 'standing'], rankings: ['positions', 'placements', 'standings'],
  keyword: ['search term', 'query', 'key phrase'], keywords: ['search terms', 'queries', 'key phrases'], page: ['web page', 'document'], pages: ['web pages', 'documents'],
  fix: ['repair', 'resolve', 'correct'], fixes: ['repairs', 'resolves', 'corrects'], optimize: ['optimise', 'fine-tune', 'refine'], optimise: ['fine-tune', 'refine', 'improve'],
  tool: ['utility', 'instrument', 'resource'], tools: ['utilities', 'instruments', 'resources'], guide: ['handbook', 'manual', 'walkthrough'], tips: ['advice', 'pointers', 'suggestions'],
  strategy: ['approach', 'plan', 'tactic'], strategies: ['approaches', 'plans', 'tactics'], experience: ['expertise', 'background', 'know-how'], quality: ['calibre', 'standard', 'grade'],
  value: ['worth', 'benefit', 'merit'], valuable: ['worthwhile', 'useful', 'beneficial'], useful: ['helpful', 'handy', 'practical'], powerful: ['potent', 'robust', 'formidable'],
  common: ['widespread', 'frequent', 'prevalent'], rare: ['uncommon', 'scarce', 'infrequent'], true: ['accurate', 'correct', 'genuine'], false: ['incorrect', 'untrue', 'inaccurate'],
  difficult: ['challenging', 'hard', 'demanding'], complex: ['complicated', 'intricate', 'elaborate'], basic: ['fundamental', 'essential', 'elementary'], advanced: ['sophisticated', 'cutting-edge', 'high-level'],
};

const PHRASES: [RegExp, string][] = [
  [/\bin order to\b/gi, 'to'], [/\ba lot of\b/gi, 'many'], [/\bat the end of the day\b/gi, 'ultimately'], [/\bdue to the fact that\b/gi, 'because'],
  [/\bin the event that\b/gi, 'if'], [/\bfor the purpose of\b/gi, 'for'], [/\bwith regard to\b/gi, 'regarding'], [/\bin spite of\b/gi, 'despite'],
  [/\bas a result\b/gi, 'consequently'], [/\bfor example\b/gi, 'for instance'], [/\bin addition\b/gi, 'furthermore'], [/\bon the other hand\b/gi, 'conversely'],
  [/\bmake sure\b/gi, 'ensure'], [/\bfind out\b/gi, 'discover'], [/\bfigure out\b/gi, 'work out'], [/\bcarry out\b/gi, 'perform'], [/\bset up\b/gi, 'establish'],
  [/\bpoint out\b/gi, 'highlight'], [/\bcome up with\b/gi, 'devise'], [/\bget rid of\b/gi, 'eliminate'], [/\btake into account\b/gi, 'consider'],
];

const SENTENCE_OPENERS = ['In practice, ', 'Put simply, ', 'Notably, ', 'In many cases, ', 'Importantly, ', 'Generally speaking, '];

type Token = { text: string; isWord: boolean; original: string; alternatives: string[]; chosen: string | null; excluded: boolean };
type Step = 1 | 2 | 3 | 4;

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const matchCase = (src: string, word: string) => {
  if (src === src.toUpperCase() && src.length > 1) return word.toUpperCase();
  if (src[0] === src[0].toUpperCase() && src[0] !== src[0].toLowerCase()) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
};

// Tokenise preserving whitespace/punctuation so we can rebuild text exactly
const tokenise = (text: string, excluded: Set<string>, intensity: number, rng: Seeded): Token[] => {
  const parts = text.split(/(\s+|[^\w'’-]+)/).filter(p => p !== '');
  return parts.map(p => {
    const isWord = /^[A-Za-z][A-Za-z'’-]*$/.test(p);
    const lower = p.toLowerCase();
    const alts = isWord && !excluded.has(lower) ? (THESAURUS[lower] || []) : [];
    const shouldSwap = alts.length > 0 && rng.next() < intensity;
    return { text: p, isWord, original: p, alternatives: alts, chosen: shouldSwap ? matchCase(p, alts[rng.int(0, Math.min(1, alts.length - 1))]) : null, excluded: excluded.has(lower) };
  });
};

const applyPhrases = (text: string, excluded: Set<string>) => {
  let out = text;
  for (const [re, rep] of PHRASES) {
    if (excluded.has(rep.toLowerCase())) continue;
    out = out.replace(re, m => matchCase(m, rep));
  }
  return out;
};

const Icon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

const STEPS: { n: Step; label: string; icon: string }[] = [
  { n: 1, label: 'Paste Article Duplication', icon: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1zM9 12h6M9 16h6' },
  { n: 2, label: 'Processing', icon: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3' },
  { n: 3, label: 'Rewrite Suggestions', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2zM8 9h8M8 13h5' },
  { n: 4, label: 'Done (Unique Article)', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3' },
];

export const ArticleRewriter: React.FC = () => {
  const [step, setStep] = useState<Step>(1);
  const [text, setText] = useState('');
  const [exclude, setExclude] = useState('');
  const [language, setLanguage] = useState('English - EN');
  const [intensity, setIntensity] = useState(0.7);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [seedSalt, setSeedSalt] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const words = useMemo(() => countWords(text), [text]);
  const over = words > WORD_LIMIT;
  const excludedSet = useMemo(() => new Set(exclude.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)), [exclude]);

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(txt|md|csv|html?)$/i.test(f.name) && !f.type.startsWith('text/')) { setNotice('Only plain-text files (.txt, .md, .html) can be read in the browser.'); return; }
    const r = new FileReader();
    r.onload = () => { const raw = String(r.result || ''); setText((/\.html?$/i.test(f.name) ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : raw).trim()); setNotice(''); };
    r.readAsText(f);
  };

  const process = async (salt: number = seedSalt) => {
    if (!text.trim()) return;
    if (over) { setNotice(`Free rewrites are limited to ${WORD_LIMIT} words. Please remove ${words - WORD_LIMIT} words.`); return; }
    setNotice(''); setStep(2); setProgress(0);
    const stages = ['Reading your article…', 'Analysing sentence structure…', 'Finding contextual synonyms…', 'Restructuring phrases…', 'Preparing suggestions…'];
    const start = performance.now();
    await new Promise<void>(resolve => {
      const tick = (now: number) => {
        const p = Math.min(100, ((now - start) / 2200) * 100);
        setProgress(Math.floor(p));
        setStage(stages[Math.min(stages.length - 1, Math.floor((p / 100) * stages.length))]);
        if (p < 100) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    const rng = new Seeded('rw|' + text.slice(0, 300) + '|' + salt + '|' + intensity);
    const phrased = applyPhrases(text, excludedSet);
    setTokens(tokenise(phrased, excludedSet, intensity, rng));
    setActiveIdx(null);
    setStep(3);
  };

  const rewritten = useMemo(() => {
    let out = tokens.map(t => t.chosen ?? t.text).join('');
    // Light sentence-level variation: add an opener to a couple of long sentences
    if (step === 4) {
      const rng = new Seeded('open|' + out.length + seedSalt);
      out = out.replace(/(^|[.!?]\s+)([A-Z][^.!?]{80,}[.!?])/g, (m, pre, sent) =>
        rng.next() < 0.25 && !/^(In practice|Put simply|Notably|In many cases|Importantly|Generally)/.test(sent)
          ? `${pre}${rng.pick(SENTENCE_OPENERS)}${sent.charAt(0).toLowerCase()}${sent.slice(1)}` : m);
    }
    return out;
  }, [tokens, step, seedSalt]);

  const changed = tokens.filter(t => t.chosen && t.chosen !== t.original).length;
  const totalWords = tokens.filter(t => t.isWord).length || 1;
  const uniqueness = Math.min(99, Math.round((changed / totalWords) * 100 * 2.4 + (step === 4 ? 12 : 8)));
  const suggestible = tokens.filter(t => t.alternatives.length > 0).length;

  const choose = (idx: number, value: string | null) => {
    setTokens(prev => prev.map((t, i) => (i === idx ? { ...t, chosen: value ? matchCase(t.original, value) : null } : t)));
    setActiveIdx(null);
  };

  const download = () => {
    const blob = new Blob([rewritten], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rewritten-article.txt'; a.click();
  };

  const reset = () => { setStep(1); setTokens([]); setActiveIdx(null); setCopied(false); };

  return (
    <div className="space-y-5">
      {/* Step wizard */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 md:px-10 pt-8 pb-6 shadow-sm">
        <div className="relative grid grid-cols-4">
          {STEPS.map((s, i) => {
            const state = step > s.n ? 'done' : step === s.n ? 'active' : 'todo';
            return (
              <div key={s.n} className="relative flex flex-col items-center text-center">
                {i < STEPS.length - 1 && (
                  <div className="absolute top-7 left-1/2 w-full h-1 bg-slate-200 -z-0" aria-hidden="true">
                    <div className={`h-full bg-blue-500 transition-all duration-700 ${step > s.n ? 'w-full' : 'w-0'}`} />
                  </div>
                )}
                <button type="button" onClick={() => { if (s.n < step) setStep(s.n); }}
                  className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-500
                    ${state === 'active' ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105' :
                      state === 'done' ? 'bg-blue-50 border-blue-500 text-blue-600 cursor-pointer' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
                  aria-current={state === 'active' ? 'step' : undefined}
                  aria-label={`Step ${s.n}: ${s.label}${state === 'done' ? ' (completed)' : state === 'active' ? ' (in progress)' : ''}`}
                >
                  {state === 'done' ? <Icon d="M20 6L9 17l-5-5" className="w-6 h-6" /> : <Icon d={s.icon} />}
                </button>
                <p className={`mt-3 text-sm font-bold uppercase tracking-wide text-blue-600`}>Step {s.n}</p>
                <p className="text-[13px] md:text-base font-bold text-slate-800 leading-tight px-1">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: Editor */}
      {step === 1 && (
        <>
          <div className="relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste content here to rewrite"
              spellCheck={false}
              aria-label="Content to rewrite"
              className={`w-full min-h-[440px] p-6 md:p-8 bg-slate-100 rounded-2xl text-[17px] leading-relaxed text-slate-800 outline-none resize-y placeholder:text-slate-500 focus:ring-2 focus:ring-blue-300 ${over ? 'ring-2 ring-red-300' : ''}`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <select value={language} onChange={e => setLanguage(e.target.value)} aria-label="Language"
                className="appearance-none bg-white border border-slate-300 rounded-lg pl-4 pr-12 py-3.5 text-[17px] text-slate-800 outline-none min-w-[240px]">
                <option>English - EN</option>
                <option>English - UK</option>
              </select>
              <svg className="w-4 h-4 text-slate-600 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            <p className={`text-xl font-bold ${over ? 'text-red-600' : 'text-slate-800'}`}>Word Limit: {words}/{WORD_LIMIT}</p>

            <div className="ml-auto flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".txt,.md,.html,.htm,.csv,text/plain" className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => fileRef.current?.click()} title="Upload a text file"
                className="w-[76px] h-[68px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500">
                <Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" className="w-6 h-6" />
              </button>
              <button type="button" onClick={() => setNotice('Cloud import is a Pro feature. Upload a .txt file or paste your text instead.')} title="Choose from Dropbox"
                className="w-[76px] h-[68px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4-6-4zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4zM6 19l6 4 6-4-6-4-6 4z" /></svg>
              </button>
              <button type="button" onClick={() => { setText(''); setNotice(''); }} title="Clear text"
                className="w-[76px] h-[68px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500">
                <Icon d="M4 7V4h16v3M9 20h6M12 4v16M3 21L21 3" className="w-7 h-7" />
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
            <input value={exclude} onChange={e => setExclude(e.target.value)} placeholder='Exclude Words with Comma ","'
              className="w-full px-5 py-4 rounded-lg border border-slate-300 bg-white text-[17px] outline-none focus:border-blue-400 placeholder:text-slate-500" />
            <div className="flex items-center gap-3 px-4 rounded-lg border border-slate-300 bg-white">
              <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Rewrite strength</span>
              <input type="range" min="0.3" max="1" step="0.1" value={intensity} onChange={e => setIntensity(Number(e.target.value))} className="flex-1 accent-blue-600" aria-label="Rewrite strength" />
              <span className="text-sm font-bold text-blue-600 w-16 text-right">{intensity < 0.5 ? 'Light' : intensity < 0.85 ? 'Medium' : 'Heavy'}</span>
            </div>
          </div>

          {notice && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{notice}</div>}

          <button type="button" onClick={() => process()} disabled={!text.trim()}
            className="w-full md:w-auto md:min-w-[280px] mx-auto block bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            Rewrite Article →
          </button>
        </>
      )}

      {/* STEP 2: Processing */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 md:p-16 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Processing your article</h2>
          <p className="text-slate-600 mb-6">{stage}</p>
          <div className="max-w-md mx-auto h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-slate-400 mt-3">{progress}% · {words} words</p>
        </div>
      )}

      {/* STEP 3: Rewrite suggestions */}
      {step === 3 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-100">{changed} words changed</span>
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{suggestible} words have alternatives</span>
              <span className="text-slate-500 hidden sm:inline">Click any highlighted word to pick a different synonym or keep the original.</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { const next = seedSalt + 1; setSeedSalt(next); process(next); }} className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm font-semibold text-slate-700">↻ Re-spin</button>
              <button type="button" onClick={() => setTokens(prev => prev.map(t => ({ ...t, chosen: null })))} className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-sm font-semibold text-slate-700">Reset all</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm text-[17px] leading-[2] text-slate-800 whitespace-pre-wrap break-words min-h-[300px]">
            {tokens.map((t, i) => {
              if (!t.isWord || t.alternatives.length === 0) return <span key={i}>{t.text}</span>;
              const isChanged = t.chosen && t.chosen !== t.original;
              return (
                <span key={i} className="relative inline-block">
                  <button type="button" onClick={() => setActiveIdx(activeIdx === i ? null : i)}
                    className={`rounded px-1 transition-colors ${isChanged ? 'bg-blue-100 text-blue-900 border-b-2 border-blue-500' : 'bg-amber-50 text-slate-800 border-b-2 border-dashed border-amber-400'} ${activeIdx === i ? 'ring-2 ring-blue-400' : ''}`}
                    title={isChanged ? `Original: ${t.original}` : 'Click for alternatives'}>
                    {t.chosen ?? t.text}
                  </button>
                  {activeIdx === i && (
                    <span className="absolute left-0 top-full mt-1 z-20 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-2 text-sm leading-normal">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 px-2 py-1">Alternatives for “{t.original}”</span>
                      {t.alternatives.map(a => (
                        <button key={a} type="button" onClick={() => choose(i, a)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg hover:bg-blue-50 ${t.chosen?.toLowerCase() === matchCase(t.original, a).toLowerCase() ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}>
                          {matchCase(t.original, a)}
                        </button>
                      ))}
                      <button type="button" onClick={() => choose(i, null)} className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-500 border-t border-slate-100 mt-1">Keep “{t.original}”</button>
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 px-1">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border-b-2 border-blue-500" /> Rewritten word</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border-b-2 border-dashed border-amber-400" /> Alternatives available</span>
            {excludedSet.size > 0 && <span>Protected: {Array.from(excludedSet).join(', ')}</span>}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <button type="button" onClick={reset} className="px-6 py-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 font-semibold text-slate-700">← Edit original</button>
            <button type="button" onClick={() => setStep(4)} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all">
              Finish &amp; Get Unique Article →
            </button>
          </div>
        </>
      )}

      {/* STEP 4: Done */}
      {step === 4 && (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
              <p className="text-emerald-100 text-sm">Estimated uniqueness</p>
              <p className="text-4xl font-extrabold">{uniqueness}%</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100"><p className="text-xs text-slate-500">Words changed</p><p className="text-3xl font-bold text-slate-800">{changed}</p></div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100"><p className="text-xs text-slate-500">Original words</p><p className="text-3xl font-bold text-slate-800">{words}</p></div>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100"><p className="text-xs text-slate-500">Rewritten words</p><p className="text-3xl font-bold text-slate-800">{countWords(rewritten)}</p></div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Original</p>
              <div className="text-[15px] leading-relaxed text-slate-600 whitespace-pre-wrap max-h-[420px] overflow-y-auto">{text}</div>
            </div>
            <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Unique article</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(rewritten); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700">{copied ? 'Copied!' : 'Copy'}</button>
                  <button type="button" onClick={download} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200">Download .txt</button>
                </div>
              </div>
              <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap max-h-[420px] overflow-y-auto">
                {tokens.map((t, i) => (
                  <span key={i} className={t.chosen && t.chosen !== t.original ? 'bg-emerald-100 text-emerald-900 rounded px-0.5' : ''}>{t.chosen ?? t.text}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Before publishing:</strong> proofread the result and run it through the <a href="/tool/grammar-checker" className="underline font-semibold">Grammar Check</a> and <a href="/tool/plagiarism-checker" className="underline font-semibold">Plagiarism Checker</a>. Automated rewriting changes wording, not meaning or facts.
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <button type="button" onClick={() => setStep(3)} className="px-6 py-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 font-semibold text-slate-700">← Adjust suggestions</button>
            <button type="button" onClick={() => { setText(''); setExclude(''); reset(); }} className="px-6 py-3.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-700">Rewrite another article</button>
          </div>
        </>
      )}
    </div>
  );
};
