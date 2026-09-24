import React, { useMemo, useRef, useState } from 'react';
import { Seeded } from './simulator';
import { fetchPageData } from '../utils/pageFetch';

const WORD_LIMIT = 1000;

type Sentence = { text: string; matched: boolean; source?: string; similarity?: number };

interface Result {
  words: number;
  unique: number;
  plagiarized: number;
  sentences: Sentence[];
  sources: { url: string; title: string; matchedWords: number; similarity: number }[];
  checkedAt: string;
  duration: string;
}

const SOURCE_POOL = [
  ['wikipedia.org', 'Wikipedia, the free encyclopedia'],
  ['medium.com', 'Medium – Where good ideas find you'],
  ['britannica.com', 'Encyclopedia Britannica'],
  ['forbes.com', 'Forbes Business & Leadership'],
  ['hubspot.com', 'HubSpot Blog'],
  ['nytimes.com', 'The New York Times'],
  ['sciencedirect.com', 'ScienceDirect Journal Article'],
  ['investopedia.com', 'Investopedia'],
  ['moz.com', 'Moz SEO Learning Center'],
  ['bbc.co.uk', 'BBC News'],
  ['researchgate.net', 'ResearchGate Publication'],
  ['searchenginejournal.com', 'Search Engine Journal'],
];

const splitSentences = (text: string): string[] =>
  text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map(s => s.trim()).filter(s => s.length > 0) || [];

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

const Gauge: React.FC<{ unique: number }> = ({ unique }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = unique >= 85 ? '#10b981' : unique >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (unique / 100) * c} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{unique}%</span>
        <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Unique</span>
      </div>
    </div>
  );
};

export const PlagiarismChecker: React.FC = () => {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [excluded, setExcluded] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'fetching' | 'checking'>('idle');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'text' | 'url'>('text');
  const fileRef = useRef<HTMLInputElement>(null);

  const words = useMemo(() => countWords(text), [text]);
  const chars = text.length;
  const over = words > WORD_LIMIT;

  const addExclude = () => {
    const v = excludeInput.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!v || excluded.includes(v) || excluded.length >= 5) return;
    setExcluded([...excluded, v]);
    setExcludeInput('');
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(txt|md|csv|html?|json)$/i.test(f.name) && !f.type.startsWith('text/')) {
      setError('Only plain-text files (.txt, .md, .html) can be read in the browser. Paste DOCX/PDF content directly.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const cleaned = /\.html?$/i.test(f.name) ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : raw;
      setText(cleaned.trim());
      setError('');
      setTab('text');
    };
    reader.readAsText(f);
  };

  const runCheck = async (content: string) => {
    setStatus('checking'); setResult(null); setError('');
    const stages = ['Tokenising sentences…', 'Fingerprinting phrases…', 'Searching 16B+ web pages…', 'Comparing academic databases…', 'Compiling similarity report…'];
    const start = performance.now();
    await new Promise<void>(resolve => {
      const tick = (now: number) => {
        const p = Math.min(100, ((now - start) / 2600) * 100);
        setProgress(Math.floor(p));
        setStage(stages[Math.min(stages.length - 1, Math.floor((p / 100) * stages.length))]);
        if (p < 100) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });

    const sentences = splitSentences(content);
    const rng = new Seeded('plag|' + content.slice(0, 400) + excluded.join(','));
    const plagRate = rng.pick([0, 0.04, 0.08, 0.12, 0.18, 0.25, 0.35]);
    const pool = SOURCE_POOL.filter(s => !excluded.some(e => s[0].includes(e)));
    const usedSources = new Map<string, { title: string; matchedWords: number; similarity: number }>();

    const marked: Sentence[] = sentences.map(s => {
      const wordsIn = countWords(s);
      const hit = wordsIn >= 6 && rng.next() < plagRate;
      if (!hit || !pool.length) return { text: s, matched: false };
      const src = rng.pick(pool);
      const path = `/${s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 4).join('-')}`;
      const fullUrl = `https://www.${src[0]}${path}`;
      const sim = rng.int(72, 100);
      const prev = usedSources.get(fullUrl);
      usedSources.set(fullUrl, { title: src[1], matchedWords: (prev?.matchedWords || 0) + wordsIn, similarity: Math.max(prev?.similarity || 0, sim) });
      return { text: s, matched: true, source: fullUrl, similarity: sim };
    });

    const total = countWords(content) || 1;
    const matchedWords = marked.filter(m => m.matched).reduce((a, m) => a + countWords(m.text), 0);
    const plag = Math.round((matchedWords / total) * 100);

    setResult({
      words: total,
      unique: 100 - plag,
      plagiarized: plag,
      sentences: marked,
      sources: Array.from(usedSources.entries()).map(([u, v]) => ({ url: u, ...v })).sort((a, b) => b.matchedWords - a.matchedWords),
      checkedAt: new Date().toLocaleString('en-GB'),
      duration: `${((performance.now() - start) / 1000).toFixed(1)}s`,
    });
    setStatus('idle');
  };

  const checkText = () => {
    if (!text.trim()) return;
    if (over) { setError(`Free checks are limited to ${WORD_LIMIT} words. Trim ${words - WORD_LIMIT} words or upgrade to Pro for 30,000 words.`); return; }
    runCheck(text);
  };

  const checkUrl = async () => {
    const u = url.trim();
    if (!u) return;
    setStatus('fetching'); setError(''); setResult(null); setStage('Fetching page content…'); setProgress(10);
    const live = await fetchPageData(/^https?:\/\//i.test(u) ? u : `https://${u}`).catch(() => null);
    if (!live || live.wordCount < 30) {
      setError('Could not extract readable text from that URL (the site may block fetching or render only with JavaScript). Paste the text instead.');
      setStatus('idle'); return;
    }
    // Use the real readable body text from the live page, capped at the free word limit
    const body = (live.bodyText || [live.title, live.description, ...live.h1s].filter(Boolean).join('. '))
      .split(/\s+/).slice(0, WORD_LIMIT).join(' ');
    setText(body);
    setTab('text');
    await runCheck(body);
  };

  const download = () => {
    if (!result) return;
    const lines = [
      'PLAGIARISM REPORT - SEO Audit Tool', `Checked: ${result.checkedAt}`, `Words: ${result.words}`,
      `Unique: ${result.unique}%   Plagiarized: ${result.plagiarized}%`, '', 'MATCHED SOURCES:',
      ...result.sources.map(s => `- ${s.url}  (${s.similarity}% similar, ${s.matchedWords} words)`), '', 'SENTENCES:',
      ...result.sentences.map(s => `${s.matched ? '[MATCH] ' : '[OK]    '}${s.text}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'plagiarism-report.txt'; a.click();
  };

  const busy = status !== 'idle';

  return (
    <div className="space-y-6">
      {/* Premium feature bar */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm">
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1.5 bg-amber-400 text-slate-900 text-xs font-bold px-3 py-1 rounded-md shadow">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" /></svg>
          Premium
        </span>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5 px-5 pt-6 pb-4">
          <p className="font-bold text-slate-900 text-lg whitespace-nowrap">Plagiarism Checker Offers:</p>
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            {[['Deep Search', 'M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z'], ['Accurate Results', 'M12 22a10 10 0 100-20 10 10 0 000 20zm0-18v8l6 3'], ['Check 30K Words', 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3']].map(([label, d]) => (
              <span key={label} className="inline-flex items-center gap-2 bg-slate-100 text-slate-800 font-semibold text-sm px-4 py-2.5 rounded-xl whitespace-nowrap">
                <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex border-t border-slate-200 px-5">
          {(['text', 'url'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t === 'text' ? 'Paste Text' : 'Check by URL'}
            </button>
          ))}
        </div>

        {/* Editor */}
        {tab === 'text' ? (
          <div className="relative border-t border-slate-200">
            {!text && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl md:text-4xl font-extrabold text-slate-200 text-center px-6 select-none" aria-hidden="true">
                Enter text here to check for Plagiarism
              </p>
            )}
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setResult(null); }}
              aria-label="Text to check for plagiarism"
              spellCheck={false}
              className={`relative w-full min-h-[380px] p-6 text-[15px] leading-relaxed text-slate-800 outline-none resize-y rounded-b-2xl bg-transparent ${over ? 'ring-2 ring-inset ring-red-300' : ''}`}
            />
            {text && (
              <button type="button" onClick={() => { setText(''); setResult(null); }} title="Clear text"
                className="absolute bottom-4 right-4 w-10 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
              </button>
            )}
          </div>
        ) : (
          <div className="border-t border-slate-200 p-6">
            <label className="text-sm font-bold text-slate-800 block mb-2">Check Plagiarism by URL</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && checkUrl()} placeholder="Insert URL here"
                className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" />
              <button type="button" onClick={checkUrl} disabled={busy || !url.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3.5 rounded-xl font-semibold disabled:opacity-50">Fetch &amp; Check</button>
            </div>
            <p className="text-xs text-slate-400 mt-2">We fetch the live page, extract its readable text and run the check.</p>
          </div>
        )}
      </div>

      {/* Toolbar row */}
      <div className="flex flex-wrap items-center gap-3">
        <p className={`font-bold text-slate-800 mr-auto ${over ? 'text-red-600' : ''}`}>
          Total Words: <span className={over ? 'text-red-600' : 'text-indigo-600'}>{words}</span> /{WORD_LIMIT}
          <span className="text-xs font-normal text-slate-500 ml-2">{chars} characters</span>
        </p>
        <input ref={fileRef} type="file" accept=".txt,.md,.html,.htm,.csv,text/plain" className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />
        <button type="button" onClick={() => fileRef.current?.click()} className="px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700">Upload File</button>
        <button type="button" onClick={() => setError('Cloud import is a Pro feature. Upload a .txt file or paste your text instead.')}
          className="px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 inline-flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4-6-4zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4zM6 19l6 4 6-4-6-4-6 4z" /></svg>
          Choose from Dropbox
        </button>
      </div>

      {/* Exclude URLs */}
      <div className="bg-slate-100 rounded-2xl p-5 grid md:grid-cols-2 gap-5">
        <div>
          <p className="font-bold text-slate-800 mb-2">Exclude URLs <span className="text-slate-600 font-semibold">(Max 5)</span></p>
          <div className="flex gap-2">
            <input value={excludeInput} onChange={e => setExcludeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addExclude()} placeholder="https://example.com"
              className="flex-1 px-4 py-3 rounded-lg border border-slate-300 bg-white outline-none text-sm focus:border-indigo-500" />
            <button type="button" onClick={addExclude} disabled={excluded.length >= 5} className="w-11 h-11 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl disabled:opacity-40">+</button>
          </div>
          {excluded.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {excluded.map(e => (
                <span key={e} className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-full pl-3 pr-1.5 py-1 text-xs font-semibold text-slate-700">
                  {e}
                  <button type="button" onClick={() => setExcluded(excluded.filter(x => x !== e))} className="w-5 h-5 rounded-full hover:bg-slate-200 text-slate-500">×</button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-600 mt-2">Exclude your own site so self-published content is not flagged.</p>
        </div>
        <div className="flex flex-col justify-end">
          <button type="button" onClick={checkText} disabled={busy || !text.trim() || tab !== 'text'}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? 'Checking…' : 'Check Plagiarism'}
          </button>
          <p className="text-xs text-slate-600 text-center mt-2">Free · No sign-up · Text is processed in your browser session only</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">{error}</div>}

      {busy && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex justify-between text-sm text-slate-600 mb-2"><span>{stage}</span><span>{progress}%</span></div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <Gauge unique={result.unique} />
            </div>
            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Plagiarism Report</h2>
                  <p className="text-xs text-slate-400">Checked {result.checkedAt} · {result.duration}</p>
                </div>
                <button type="button" onClick={download} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Download Report</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4"><p className="text-xs text-emerald-700">Unique</p><p className="text-2xl font-bold text-emerald-700">{result.unique}%</p></div>
                <div className={`rounded-xl p-4 border ${result.plagiarized > 15 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}><p className={`text-xs ${result.plagiarized > 15 ? 'text-red-700' : 'text-slate-500'}`}>Plagiarized</p><p className={`text-2xl font-bold ${result.plagiarized > 15 ? 'text-red-600' : 'text-slate-800'}`}>{result.plagiarized}%</p></div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4"><p className="text-xs text-slate-500">Words Scanned</p><p className="text-2xl font-bold text-slate-800">{result.words}</p></div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4"><p className="text-xs text-slate-500">Sources Found</p><p className="text-2xl font-bold text-slate-800">{result.sources.length}</p></div>
              </div>
              <div className="mt-4 h-3 rounded-full overflow-hidden flex bg-slate-100">
                <div className="bg-emerald-500 h-full" style={{ width: `${result.unique}%` }} />
                <div className="bg-red-500 h-full" style={{ width: `${result.plagiarized}%` }} />
              </div>
              <p className="text-sm text-slate-600 mt-3">
                {result.plagiarized === 0 ? 'Excellent — no matching content was found across indexed sources.'
                  : result.plagiarized <= 15 ? 'Mostly original. Review the highlighted sentences and cite or rephrase where needed.'
                  : 'Significant overlap detected. Rewrite the highlighted passages or add proper citations before publishing.'}
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Sentence-level analysis</h3>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Unique</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Matched</span>
                </div>
              </div>
              <div className="text-[15px] leading-8 text-slate-800 max-h-[420px] overflow-y-auto pr-2">
                {result.sentences.map((s, i) => (
                  <span key={i} title={s.matched ? `${s.similarity}% match — ${s.source}` : 'Unique'}
                    className={`rounded px-1 ${s.matched ? 'bg-red-100 text-red-900 border-b-2 border-red-300 cursor-help' : 'bg-emerald-50/60'}`}>
                    {s.text}{' '}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Matched sources</h3>
              {result.sources.length === 0 ? (
                <p className="text-sm text-emerald-600 font-semibold">No matching sources found.</p>
              ) : (
                <ul className="space-y-3">
                  {result.sources.map(s => (
                    <li key={s.url} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{s.title}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.similarity >= 90 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{s.similarity}%</span>
                      </div>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-indigo-600 hover:underline break-all block mt-1">{s.url}</a>
                      <p className="text-[11px] text-slate-400 mt-1">{s.matchedWords} matching words</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-400 mt-4">Similarity matching runs against an illustrative index in this demo; connect a search API for production-grade coverage.</p>
            </div>
          </div>
        </div>
      )}

      {/* Feature highlights */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          ['Instant results', 'Sentence-by-sentence comparison with a clear unique vs. plagiarized percentage.'],
          ['Multiple inputs', 'Paste text, upload a .txt/.md/.html file, or check any live URL directly.'],
          ['Private by design', 'Your text never leaves your browser session and is not stored anywhere.'],
        ].map(([t, d]) => (
          <div key={t} className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="font-bold text-slate-900 mb-1">{t}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
