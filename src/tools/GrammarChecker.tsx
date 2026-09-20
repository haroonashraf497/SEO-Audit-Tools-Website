import React, { useMemo, useRef, useState } from 'react';

type Severity = 'spelling' | 'grammar' | 'style' | 'punctuation';
interface Issue {
  id: number;
  start: number;
  end: number;
  text: string;
  category: Severity;
  message: string;
  suggestion: string | null;
}

const SEVERITY_META: Record<Severity, { label: string; mark: string; dot: string; badge: string }> = {
  spelling: { label: 'Spelling', mark: 'bg-red-100 border-b-2 border-red-500 text-red-900', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-100' },
  grammar: { label: 'Grammar', mark: 'bg-amber-100 border-b-2 border-amber-500 text-amber-900', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-100' },
  punctuation: { label: 'Punctuation', mark: 'bg-blue-100 border-b-2 border-blue-500 text-blue-900', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-100' },
  style: { label: 'Style', mark: 'bg-violet-100 border-b-2 border-violet-500 text-violet-900', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-100' },
};

// ---------- Rule dictionaries ----------
const MISSPELLINGS: Record<string, string> = {
  recieve: 'receive', recieved: 'received', occuring: 'occurring', occurence: 'occurrence', seperate: 'separate', definately: 'definitely',
  enviroment: 'environment', goverment: 'government', neccessary: 'necessary', necesary: 'necessary', accesible: 'accessible', acheive: 'achieve',
  adress: 'address', begining: 'beginning', beleive: 'believe', buisness: 'business', calender: 'calendar', cemetary: 'cemetery',
  cheif: 'chief', collegue: 'colleague', comming: 'coming', completly: 'completely', concious: 'conscious', dissapoint: 'disappoint',
  embarass: 'embarrass', existance: 'existence', familar: 'familiar', finaly: 'finally', foriegn: 'foreign', freind: 'friend',
  gaurd: 'guard', grammer: 'grammar', happend: 'happened', harrass: 'harass', wierd: 'weird', writting: 'writing', tomorow: 'tomorrow',
  tounge: 'tongue', untill: 'until', wich: 'which', succesful: 'successful', sucessful: 'successful', alot: 'a lot', teh: 'the',
  thier: 'their', truely: 'truly', arguement: 'argument', independant: 'independent', judgement: 'judgment', liason: 'liaison',
  maintainance: 'maintenance', millenium: 'millennium', mischevious: 'mischievous', noticable: 'noticeable', ocassion: 'occasion',
  persistant: 'persistent', posession: 'possession', priviledge: 'privilege', publically: 'publicly', reccomend: 'recommend',
  refered: 'referred', relevent: 'relevant', religous: 'religious', rythm: 'rhythm', supercede: 'supersede', suprise: 'surprise',
  tendancy: 'tendency', threshhold: 'threshold', tommorow: 'tomorrow', twelth: 'twelfth', tyrany: 'tyranny', vaccuum: 'vacuum',
  wellcome: 'welcome', whereever: 'wherever', withold: 'withhold', accomodate: 'accommodate', apparantly: 'apparently', basicly: 'basically',
  becuase: 'because', catagory: 'category', commited: 'committed', consciencious: 'conscientious', dilemna: 'dilemma', enterpreneur: 'entrepreneur',
  exagerate: 'exaggerate', experiance: 'experience', garantee: 'guarantee', hygene: 'hygiene', immediatly: 'immediately', inteligence: 'intelligence',
  knowlege: 'knowledge', lisence: 'license', occassionally: 'occasionally', pharoah: 'pharaoh', prefered: 'preferred', questionaire: 'questionnaire',
  recieving: 'receiving', responsability: 'responsibility', seige: 'siege', sieze: 'seize', speach: 'speech', strengh: 'strength', technical: 'technical',
};

// American ↔ British pairs (american: british)
const DIALECT_PAIRS: [string, string][] = [
  ['color', 'colour'], ['colors', 'colours'], ['favorite', 'favourite'], ['favorites', 'favourites'], ['honor', 'honour'], ['humor', 'humour'],
  ['labor', 'labour'], ['neighbor', 'neighbour'], ['neighbors', 'neighbours'], ['flavor', 'flavour'], ['behavior', 'behaviour'], ['center', 'centre'],
  ['centers', 'centres'], ['meter', 'metre'], ['theater', 'theatre'], ['fiber', 'fibre'], ['liter', 'litre'], ['organize', 'organise'],
  ['organized', 'organised'], ['organization', 'organisation'], ['realize', 'realise'], ['realized', 'realised'], ['recognize', 'recognise'],
  ['analyze', 'analyse'], ['analyzed', 'analysed'], ['optimize', 'optimise'], ['optimized', 'optimised'], ['optimization', 'optimisation'],
  ['customize', 'customise'], ['apologize', 'apologise'], ['catalog', 'catalogue'], ['dialog', 'dialogue'], ['program', 'programme'],
  ['defense', 'defence'], ['offense', 'offence'], ['license', 'licence'], ['practice', 'practise'], ['traveled', 'travelled'],
  ['traveling', 'travelling'], ['canceled', 'cancelled'], ['modeling', 'modelling'], ['jewelry', 'jewellery'], ['gray', 'grey'],
  ['aluminum', 'aluminium'], ['check', 'cheque'], ['tire', 'tyre'], ['pajamas', 'pyjamas'], ['mom', 'mum'], ['aging', 'ageing'],
  ['enrollment', 'enrolment'], ['fulfill', 'fulfil'], ['skillful', 'skilful'], ['mustache', 'moustache'], ['plow', 'plough'],
];

const COMMON_MISUSE: [RegExp, string, string][] = [
  [/\bcould of\b/gi, 'could have', '"Could of" is a mishearing of "could have".'],
  [/\bshould of\b/gi, 'should have', '"Should of" is a mishearing of "should have".'],
  [/\bwould of\b/gi, 'would have', '"Would of" is a mishearing of "would have".'],
  [/\bmust of\b/gi, 'must have', '"Must of" is a mishearing of "must have".'],
  [/\bfor all intensive purposes\b/gi, 'for all intents and purposes', 'The idiom is "for all intents and purposes".'],
  [/\birregardless\b/gi, 'regardless', '"Irregardless" is nonstandard; use "regardless".'],
  [/\bmore better\b/gi, 'better', 'Double comparative — "better" is already comparative.'],
  [/\bmost best\b/gi, 'best', 'Double superlative — "best" is already superlative.'],
  [/\bless people\b/gi, 'fewer people', 'Use "fewer" with countable nouns.'],
  [/\bless items\b/gi, 'fewer items', 'Use "fewer" with countable nouns.'],
  [/\bthe the\b/gi, 'the', 'Repeated word.'],
  [/\ba a\b/gi, 'a', 'Repeated word.'],
  [/\bis is\b/gi, 'is', 'Repeated word.'],
  [/\bto to\b/gi, 'to', 'Repeated word.'],
  [/\bof of\b/gi, 'of', 'Repeated word.'],
  [/\bin in\b/gi, 'in', 'Repeated word.'],
  [/\band and\b/gi, 'and', 'Repeated word.'],
  [/\bthat that\b/gi, 'that', 'Repeated word (often acceptable, but check).'],
  [/\byour welcome\b/gi, "you're welcome", '"Your" is possessive; you need "you\'re" (you are).'],
  [/\byour right\b/gi, "you're right", '"Your" is possessive; you need "you\'re" (you are).'],
  [/\bits a\b/g, "it's a", '"Its" is possessive; "it\'s" means "it is".'],
  [/\bits not\b/gi, "it's not", '"Its" is possessive; "it\'s" means "it is".'],
  [/\bthere going\b/gi, "they're going", '"There" refers to a place; "they\'re" means "they are".'],
  [/\bthere is many\b/gi, 'there are many', 'Plural subject "many" takes "are".'],
  [/\btheir is\b/gi, 'there is', '"Their" is possessive; you need "there".'],
  [/\btheir are\b/gi, 'there are', '"Their" is possessive; you need "there".'],
  [/\bthier\b/gi, 'their', 'Misspelling of "their".'],
  [/\bwho's (car|house|book|idea|turn|fault)\b/gi, "whose $1", '"Who\'s" means "who is"; the possessive is "whose".'],
  [/\bthen (me|him|her|them|us)\b/gi, 'than $1', 'Use "than" for comparisons; "then" refers to time.'],
  [/\bmore (better|worse|faster|slower|bigger|smaller|easier|harder)\b/gi, '$1', 'Double comparative — the word is already comparative.'],
  [/\balot\b/gi, 'a lot', '"A lot" is always two words.'],
  [/\beveryday (I|we|they|he|she|you)\b/g, 'every day $1', '"Everyday" is an adjective; the phrase meaning "each day" is "every day".'],
  [/\baffect on\b/gi, 'effect on', '"Effect" is the noun; "affect" is usually a verb.'],
  [/\bloose (weight|money|the|a|my|your)\b/gi, 'lose $1', '"Loose" means not tight; you mean "lose".'],
  [/\bsuppose to\b/gi, 'supposed to', 'The correct form is "supposed to".'],
  [/\buse to (go|be|have|do|work|live|play)\b/gi, 'used to $1', 'The correct form is "used to".'],
  [/\bin regards to\b/gi, 'in regard to', 'The standard phrase is "in regard to" (or "regarding").'],
  [/\bnip it in the butt\b/gi, 'nip it in the bud', 'The idiom is "nip it in the bud".'],
  [/\bexpresso\b/gi, 'espresso', 'The correct word is "espresso".'],
  [/\bsupposably\b/gi, 'supposedly', 'The standard word is "supposedly".'],
  [/\bthere is (\d+|several|lots|two|three|four|five|some) /gi, 'there are $1 ', 'Plural subject takes "there are".'],
  [/\bi am agree\b/gi, 'I agree', '"Agree" is a verb; no "am" is needed.'],
  [/\bcan able to\b/gi, 'be able to', 'Use either "can" or "be able to", not both.'],
  [/\bdiscuss about\b/gi, 'discuss', '"Discuss" takes a direct object; drop "about".'],
  [/\breturn back\b/gi, 'return', '"Return" already means to go back.'],
  [/\brevert back\b/gi, 'revert', '"Revert" already means to go back.'],
  [/\bfree gift\b/gi, 'gift', 'A gift is free by definition (redundant).'],
  [/\bpast history\b/gi, 'history', 'History is always in the past (redundant).'],
  [/\badvance planning\b/gi, 'planning', 'Planning is done in advance (redundant).'],
  [/\bATM machine\b/g, 'ATM', 'The "M" in ATM already stands for machine.'],
  [/\bPIN number\b/g, 'PIN', 'The "N" in PIN already stands for number.'],
  [/\beach and every\b/gi, 'every', 'Wordy — "every" is enough.'],
  [/\bat this point in time\b/gi, 'now', 'Wordy — prefer "now".'],
  [/\bin order to\b/gi, 'to', 'Wordy — "to" usually suffices.'],
  [/\bdue to the fact that\b/gi, 'because', 'Wordy — prefer "because".'],
  [/\bin the event that\b/gi, 'if', 'Wordy — prefer "if".'],
  [/\ba large number of\b/gi, 'many', 'Wordy — prefer "many".'],
  [/\bvery unique\b/gi, 'unique', '"Unique" is absolute; it cannot be modified by "very".'],
  [/\bcompletely destroyed\b/gi, 'destroyed', '"Destroyed" is already complete.'],
  [/\bbasically\b/gi, '', 'Filler word — consider removing.'],
  [/\bliterally\b/gi, '', 'Often misused as an intensifier; consider removing.'],
  [/\bvery very\b/gi, 'extremely', 'Doubled intensifier.'],
];

const CONTRACTION_FIXES: Record<string, string> = {
  dont: "don't", cant: "can't", wont: "won't", didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't", werent: "weren't",
  havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", im: "I'm",
  ive: "I've", youre: "you're", theyre: "they're", thats: "that's", whats: "what's", lets: "let's", arent: "aren't", aint: "isn't",
};

const VOWEL_START = /^[aeiou]/i;
const A_AN_EXCEPTIONS = new Set(['university', 'unique', 'user', 'useful', 'european', 'one', 'once', 'united', 'unit', 'unicorn', 'uniform', 'usual', 'utility', 'euro', 'ewe', 'hour', 'honest', 'honor', 'honour', 'heir']);

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const countSyllables = (w: string) => {
  const word = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  const m = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
};

// ---------- Analysis engine ----------
const analyze = (text: string, dialect: 'american' | 'british'): Issue[] => {
  const issues: Issue[] = [];
  let id = 0;
  const push = (start: number, end: number, category: Severity, message: string, suggestion: string | null) => {
    if (end <= start) return;
    if (issues.some(i => start < i.end && end > i.start)) return; // avoid overlaps
    issues.push({ id: id++, start, end, text: text.slice(start, end), category, message, suggestion });
  };

  // Spelling from dictionary + missing apostrophes
  const wordRe = /\b[A-Za-z']+\b/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(text)) !== null) {
    const raw = m[0];
    const lower = raw.toLowerCase();
    const start = m.index;
    const end = start + raw.length;
    const keepCase = (s: string) => (raw[0] === raw[0].toUpperCase() && raw[0] !== raw[0].toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    if (MISSPELLINGS[lower]) { push(start, end, 'spelling', `"${raw}" appears to be misspelled.`, keepCase(MISSPELLINGS[lower])); continue; }
    if (CONTRACTION_FIXES[lower] && !(lower === 'im' && raw === 'Im' && false)) {
      push(start, end, 'punctuation', `Missing apostrophe in "${raw}".`, lower === 'im' || lower === 'ive' ? CONTRACTION_FIXES[lower] : keepCase(CONTRACTION_FIXES[lower]));
      continue;
    }
    if (raw === 'i') { push(start, end, 'grammar', 'The pronoun "I" should always be capitalized.', 'I'); continue; }
    // Dialect
    for (const [us, uk] of DIALECT_PAIRS) {
      if (dialect === 'american' && lower === uk) { push(start, end, 'spelling', `"${raw}" is the British spelling; American English uses "${us}".`, keepCase(us)); break; }
      if (dialect === 'british' && lower === us) { push(start, end, 'spelling', `"${raw}" is the American spelling; British English uses "${uk}".`, keepCase(uk)); break; }
    }
  }

  // a / an agreement (runs before phrase rules so it isn't shadowed by overlapping matches)
  const aAnRe = /\b(a|an)\s+([A-Za-z]+)/g;
  while ((m = aAnRe.exec(text)) !== null) {
    const art = m[1]; const next = m[2]; const nl = next.toLowerCase();
    const soundsVowel = A_AN_EXCEPTIONS.has(nl) ? /^(hour|honest|honor|honour|heir)/.test(nl) : VOWEL_START.test(next);
    const shouldBe = soundsVowel ? 'an' : 'a';
    if (art.toLowerCase() !== shouldBe) {
      const fixed = (art[0] === art[0].toUpperCase() ? shouldBe.charAt(0).toUpperCase() + shouldBe.slice(1) : shouldBe);
      push(m.index, m.index + art.length, 'grammar', `Use "${shouldBe}" before "${next}".`, fixed);
    }
  }

  // Common misuse / wordiness
  for (const [re, fix, message] of COMMON_MISUSE) {
    // Use a fresh, non-global copy for substitution so the scanning regex's lastIndex is never reset
    const scanner = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    const single = new RegExp(re.source, re.flags.replace('g', ''));
    let mm: RegExpExecArray | null;
    while ((mm = scanner.exec(text)) !== null) {
      if (mm[0].length === 0) { scanner.lastIndex++; continue; }
      let replacement = fix.includes('$1') ? mm[0].replace(single, fix) : fix;
      // Preserve a leading capital from the original phrase (e.g. "Their is" -> "There is")
      if (replacement && mm[0][0] === mm[0][0].toUpperCase() && mm[0][0] !== mm[0][0].toLowerCase()) {
        replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      const isStyle = /Wordy|Filler|intensifier|redundant|Double/i.test(message);
      push(mm.index, mm.index + mm[0].length, isStyle ? 'style' : 'grammar', message, replacement);
    }
  }

  // Sentence capitalization
  const sentStartRe = /(^|[.!?]\s+)([a-z])/g;
  while ((m = sentStartRe.exec(text)) !== null) {
    const pos = m.index + m[1].length;
    push(pos, pos + 1, 'grammar', 'Sentences should start with a capital letter.', m[2].toUpperCase());
  }

  // Double spaces, space before punctuation, missing space after punctuation
  const dblRe = / {2,}/g;
  while ((m = dblRe.exec(text)) !== null) push(m.index, m.index + m[0].length, 'punctuation', 'Multiple consecutive spaces.', ' ');
  const spBefore = /\s+([,.!?;:])/g;
  while ((m = spBefore.exec(text)) !== null) push(m.index, m.index + m[0].length, 'punctuation', 'Remove the space before punctuation.', m[1]);
  const noSpaceAfter = /([,;:])([A-Za-z])/g;
  while ((m = noSpaceAfter.exec(text)) !== null) push(m.index, m.index + m[0].length, 'punctuation', 'Add a space after punctuation.', `${m[1]} ${m[2]}`);
  const multiPunct = /([!?]){2,}/g;
  while ((m = multiPunct.exec(text)) !== null) push(m.index, m.index + m[0].length, 'punctuation', 'Avoid repeated punctuation marks.', m[1]);

  // Very long sentences (style)
  const sentRe = /[^.!?]+[.!?]+/g;
  while ((m = sentRe.exec(text)) !== null) {
    const wc = countWords(m[0]);
    if (wc > 35) push(m.index, m.index + Math.min(m[0].length, 40), 'style', `This sentence is ${wc} words long. Consider splitting it for readability.`, null);
  }

  // Passive voice (simple heuristic)
  const passiveRe = /\b(is|are|was|were|be|been|being)\s+(\w+ed|\w+en)\b(\s+by\b)?/gi;
  while ((m = passiveRe.exec(text)) !== null) {
    if (/\b(is|are|was|were)\s+(used|based|called|named|known|located)\b/i.test(m[0]) && !m[3]) continue;
    if (m[3]) push(m.index, m.index + m[0].length, 'style', 'Passive voice — consider rewriting in active voice.', null);
  }

  // Missing terminal punctuation
  const trimmed = text.trimEnd();
  if (trimmed.length > 20 && !/[.!?"')\]]$/.test(trimmed)) {
    push(trimmed.length - 1, trimmed.length, 'punctuation', 'The text does not end with terminal punctuation.', trimmed.slice(-1) + '.');
  }

  return issues.sort((a, b) => a.start - b.start);
};

// ---------- Component ----------
export const GrammarChecker: React.FC = () => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('English');
  const [dialect, setDialect] = useState<'american' | 'british'>('american');
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [active, setActive] = useState<Issue | null>(null);
  const [fileName, setFileName] = useState('');
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const words = countWords(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length || (words ? 1 : 0);
    const syllables = text.split(/\s+/).filter(Boolean).reduce((a, w) => a + countSyllables(w), 0);
    const flesch = words ? Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)))) : 0;
    return {
      words, chars: text.length, sentences,
      read: words ? Math.max(1, Math.ceil(words / 225)) : 0,
      speak: words ? Math.max(1, Math.ceil(words / 130)) : 0,
      paragraphs: text.split(/\n\s*\n/).filter(p => p.trim()).length,
      flesch,
    };
  }, [text]);

  const run = () => {
    if (!text.trim()) return;
    setChecking(true); setActive(null);
    setTimeout(() => { setIssues(analyze(text, dialect)); setChecking(false); }, 350);
  };

  const applyFix = (issue: Issue) => {
    if (issue.suggestion === null) return;
    const next = text.slice(0, issue.start) + issue.suggestion + text.slice(issue.end);
    setText(next);
    setIssues(analyze(next, dialect));
    setActive(null);
  };

  const ignore = (issue: Issue) => {
    setIssues((issues || []).filter(i => i.id !== issue.id));
    setActive(null);
  };

  const fixAll = () => {
    if (!issues) return;
    let next = text;
    [...issues].filter(i => i.suggestion !== null).sort((a, b) => b.start - a.start).forEach(i => {
      next = next.slice(0, i.start) + (i.suggestion as string) + next.slice(i.end);
    });
    setText(next);
    setIssues(analyze(next, dialect));
    setActive(null);
  };

  const onFile = (f: File | null) => {
    if (!f) return;
    if (!/\.(txt|md|csv|html?|json)$/i.test(f.name) && !f.type.startsWith('text/')) {
      setNotice('Only plain-text files (.txt, .md, .html) can be read in the browser. Paste DOCX/PDF text directly.');
      return;
    }
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      setText((/\.html?$/i.test(f.name) ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') : raw).trim());
      setIssues(null); setNotice('');
    };
    reader.readAsText(f);
  };

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { spelling: 0, grammar: 0, punctuation: 0, style: 0 };
    (issues || []).forEach(i => c[i.category]++);
    return c;
  }, [issues]);

  const score = issues ? Math.max(0, 100 - Math.round((issues.length / Math.max(1, stats.words)) * 400)) : null;

  // Build highlighted preview
  const highlighted = useMemo(() => {
    if (!issues) return null;
    const out: React.ReactNode[] = [];
    let cursor = 0;
    issues.forEach(i => {
      if (i.start > cursor) out.push(<span key={`t${cursor}`}>{text.slice(cursor, i.start)}</span>);
      out.push(
        <button
          key={`i${i.id}`}
          type="button"
          onClick={() => setActive(active?.id === i.id ? null : i)}
          className={`rounded px-0.5 cursor-pointer transition-colors ${SEVERITY_META[i.category].mark} ${active?.id === i.id ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
          title={i.message}
        >
          {text.slice(i.start, i.end) || '·'}
        </button>
      );
      cursor = i.end;
    });
    if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>);
    return out;
  }, [issues, text, active]);

  const StatCard: React.FC<{ label: string; value: string; color: 'red' | 'blue' | 'green' | 'amber' }> = ({ label, value, color }) => {
    const c = {
      red: 'border-red-500 bg-red-50 text-red-500', blue: 'border-blue-500 bg-blue-50 text-blue-500',
      green: 'border-green-500 bg-green-50 text-green-500', amber: 'border-amber-400 bg-amber-50 text-amber-500',
    }[color];
    return (
      <div className={`border-2 rounded-lg py-4 px-3 text-center ${c}`}>
        <p className="text-slate-800 font-bold text-lg leading-tight">{label}</p>
        <p className="text-2xl font-extrabold mt-1">{value}</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Read Time" value={`${stats.read} Min`} color="red" />
        <StatCard label="Words" value={String(stats.words)} color="blue" />
        <StatCard label="Characters" value={String(stats.chars)} color="green" />
        <StatCard label="Speak Time" value={`${stats.speak} Min`} color="amber" />
      </div>

      {/* Editor / highlighted view */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm">
        {issues ? (
          <div className="min-h-[420px] p-6 md:p-8 text-[17px] md:text-[19px] leading-[1.9] text-slate-900 whitespace-pre-wrap break-words">
            {highlighted}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setIssues(null); }}
            placeholder={'Paste your text here and click the "Check Grammar" button. Click the colored phrases for details on potential errors.'}
            spellCheck={false}
            aria-label="Text to check"
            className="w-full min-h-[420px] p-6 md:p-8 text-[17px] md:text-[19px] leading-[1.9] text-slate-900 outline-none resize-y rounded-2xl placeholder:text-slate-900 placeholder:font-normal bg-transparent"
          />
        )}
        {text && (
          <button
            type="button"
            onClick={() => { setText(''); setIssues(null); setActive(null); setFileName(''); }}
            title="Clear text"
            className="absolute bottom-4 right-4 w-11 h-11 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7V4h16v3M9 20h6M12 4v16" /><path d="M3 21L21 3" /></svg>
          </button>
        )}
        {issues && (
          <button type="button" onClick={() => { setIssues(null); setActive(null); }}
            className="absolute top-4 right-4 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700">
            ✎ Edit text
          </button>
        )}
      </div>

      {/* Active issue card */}
      {active && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 p-5 shadow-md animate-fade-in">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <span className={`inline-block text-[11px] font-bold uppercase tracking-wide border rounded-full px-2.5 py-0.5 mb-2 ${SEVERITY_META[active.category].badge}`}>{SEVERITY_META[active.category].label}</span>
              <p className="text-slate-800 font-semibold">{active.message}</p>
              {active.suggestion !== null && (
                <p className="text-sm mt-2">
                  <span className="line-through text-red-500 mr-2">{active.text || '(empty)'}</span>
                  <span className="text-slate-400 mr-2">→</span>
                  <span className="font-bold text-emerald-700">{active.suggestion || '(remove)'}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {active.suggestion !== null && (
                <button type="button" onClick={() => applyFix(active)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">Apply fix</button>
              )}
              <button type="button" onClick={() => ignore(active)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold">Ignore</button>
            </div>
          </div>
        </div>
      )}

      {/* Language selectors + check button */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
          <select value={language} onChange={e => setLanguage(e.target.value)} aria-label="Language"
            className="appearance-none bg-transparent px-4 py-3 text-slate-800 text-[15px] outline-none pr-2 min-w-[150px]">
            <option>English</option>
          </select>
          <span className="w-12 h-12 flex items-center justify-center bg-slate-100 border-l border-slate-300 text-slate-700 pointer-events-none">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>
        <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
          <select value={dialect} onChange={e => { setDialect(e.target.value as 'american' | 'british'); if (issues) setIssues(analyze(text, e.target.value as 'american' | 'british')); }} aria-label="Dialect"
            className="appearance-none bg-transparent px-4 py-3 text-slate-800 text-[15px] outline-none pr-2 min-w-[150px]">
            <option value="american">American</option>
            <option value="british">British</option>
          </select>
          <span className="w-12 h-12 flex items-center justify-center bg-slate-100 border-l border-slate-300 text-slate-700 pointer-events-none">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>
        <button type="button" onClick={run} disabled={checking || !text.trim()}
          className="ml-auto bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {checking ? 'Checking…' : issues ? 'Re-check Grammar' : 'Check Grammar'}
        </button>
      </div>

      {/* File row */}
      <div className="grid md:grid-cols-[1fr_auto] gap-3">
        <div className="flex items-center rounded-lg border border-slate-300 bg-white p-2 gap-3">
          <input ref={fileRef} type="file" accept=".txt,.md,.html,.htm,.csv,text/plain" className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="px-6 py-2.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-[15px]">Choose File</button>
          <span className="text-slate-600 text-[15px] truncate">{fileName || 'No File Chosen'}</span>
        </div>
        <button type="button" onClick={() => setNotice('Cloud import is a Pro feature. Upload a .txt file or paste your text instead.')}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-6 py-3 text-slate-800 text-[15px]">
          <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4-6-4zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4zM6 19l6 4 6-4-6-4-6 4z" /></svg>
          Choose from Dropbox
        </button>
      </div>

      {notice && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{notice}</div>}

      {/* Results summary */}
      {issues && (
        <div className="grid lg:grid-cols-3 gap-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Writing score</p>
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-extrabold ${score !== null && score >= 85 ? 'text-emerald-600' : score !== null && score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{score}</span>
              <span className="text-slate-400 mb-2">/ 100</span>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              {issues.length === 0 ? 'No issues found. Great writing!' : `${issues.length} potential issue${issues.length === 1 ? '' : 's'} in ${stats.words} words.`}
            </p>
            <div className="mt-4 space-y-2">
              {(Object.keys(SEVERITY_META) as Severity[]).map(k => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600"><span className={`w-2.5 h-2.5 rounded-full ${SEVERITY_META[k].dot}`} />{SEVERITY_META[k].label}</span>
                  <span className="font-bold text-slate-800">{counts[k]}</span>
                </div>
              ))}
            </div>
            {issues.some(i => i.suggestion !== null) && (
              <button type="button" onClick={fixAll} className="mt-5 w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
                Fix all {issues.filter(i => i.suggestion !== null).length} suggestions
              </button>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-900">All issues</h4>
              <span className="text-xs text-slate-400">Click any row or highlighted phrase to review</span>
            </div>
            {issues.length === 0 ? (
              <div className="py-10 text-center text-emerald-600 font-semibold">✓ Your text looks clean in {dialect === 'american' ? 'American' : 'British'} English.</div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                {issues.map(i => (
                  <li key={i.id}>
                    <button type="button" onClick={() => setActive(i)} className={`w-full text-left py-3 px-2 rounded-lg hover:bg-slate-50 flex items-start gap-3 ${active?.id === i.id ? 'bg-indigo-50' : ''}`}>
                      <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_META[i.category].dot}`} />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm text-slate-800 block">{i.message}</span>
                        <span className="text-xs text-slate-500">
                          <span className="font-mono bg-slate-100 px-1 rounded">{i.text.slice(0, 40) || '·'}</span>
                          {i.suggestion !== null && <><span className="mx-1.5">→</span><span className="font-mono font-semibold text-emerald-700">{i.suggestion || '(remove)'}</span></>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 grid sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Sentences</p><p className="text-xl font-bold text-slate-800">{stats.sentences}</p></div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Paragraphs</p><p className="text-xl font-bold text-slate-800">{stats.paragraphs}</p></div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Avg. words / sentence</p><p className="text-xl font-bold text-slate-800">{stats.sentences ? Math.round(stats.words / stats.sentences) : 0}</p></div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Readability (Flesch)</p><p className={`text-xl font-bold ${stats.flesch >= 60 ? 'text-emerald-600' : stats.flesch >= 30 ? 'text-amber-600' : 'text-red-500'}`}>{stats.flesch} <span className="text-xs font-normal text-slate-400">{stats.flesch >= 70 ? 'Easy' : stats.flesch >= 50 ? 'Fairly easy' : stats.flesch >= 30 ? 'Difficult' : 'Very difficult'}</span></p></div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 px-1">
        <span className="font-semibold text-slate-600">Highlight legend:</span>
        {(Object.keys(SEVERITY_META) as Severity[]).map(k => (
          <span key={k} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded ${SEVERITY_META[k].dot}`} />{SEVERITY_META[k].label}</span>
        ))}
        <span className="ml-auto">Checks run 100% in your browser — nothing is uploaded.</span>
      </div>
    </div>
  );
};
