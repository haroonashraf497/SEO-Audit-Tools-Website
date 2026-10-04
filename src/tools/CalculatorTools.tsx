import React, { useMemo, useState } from 'react';

/* Shared calculator UI kit — every calculator gets the same presentation:
   an inputs card (segmented controls, suffixed number fields), a gradient
   hero for the headline figure and stat tiles for the breakdown. All
   formulas are unchanged; only the presentation layer is new. */

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block min-w-0">
    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1.5">{label}</span>
    {hint && <span className="text-xs text-slate-500 block -mt-1 mb-1.5">{hint}</span>}
    {children}
  </label>
);

const NumInput: React.FC<{ value: string; onChange: (v: string) => void; min?: string; max?: string; step?: string; placeholder?: string; suffix?: string }> = ({ value, onChange, min, max, step, placeholder, suffix }) => (
  <span className="relative block">
    <input
      type="number" value={value} onChange={e => onChange(e.target.value)} min={min} max={max} step={step} placeholder={placeholder}
      className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all ${suffix ? 'pr-12' : ''}`}
    />
    {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">{suffix}</span>}
  </span>
);

const TextArea: React.FC<{ value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }> = ({ value, onChange, rows = 4, placeholder }) => (
  <textarea
    value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} spellCheck={false}
    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 transition-all"
  />
);

const SelectBox: React.FC<{ value: string; onChange: (v: string) => void; options: [string, string][] }> = ({ value, onChange, options }) => (
  <span className="relative block">
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full appearance-none px-4 py-3 pr-9 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  </span>
);

const Seg: React.FC<{ value: string; onChange: (v: string) => void; options: [string, string][] }> = ({ value, onChange, options }) => (
  <div className="flex bg-slate-100 rounded-xl p-1 gap-1" role="tablist">
    {options.map(([v, l]) => (
      <button
        key={v} type="button" role="tab" aria-selected={value === v} onClick={() => onChange(v)}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all ${value === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
      >{l}</button>
    ))}
  </div>
);

const InputsCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">{children}</div>
);

const Hero: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20 text-center">
    <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{label}</p>
    <p className="text-3xl sm:text-4xl font-extrabold mt-1.5 break-words">{value}</p>
    {sub && <p className="text-white/80 text-sm mt-2">{sub}</p>}
  </div>
);

const Stat: React.FC<{ label: string; value: string; sub?: string; tone?: 'accent' | 'plain' }> = ({ label, value, sub, tone = 'plain' }) => (
  <div className={`rounded-xl border p-4 ${tone === 'accent' ? 'bg-indigo-50/60 border-indigo-100' : 'bg-white border-slate-200'}`}>
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`text-lg font-extrabold mt-1 break-words ${tone === 'accent' ? 'text-indigo-600' : 'text-slate-800'}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5 break-words">{sub}</p>}
  </div>
);

const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

// ---- Age Calculator ----
export const AgeCalc: React.FC = () => {
  const [birth, setBirth] = useState('1995-06-15');
  const result = useMemo(() => {
    if (!birth) return null;
    const bd = new Date(birth + 'T00:00:00');
    if (isNaN(bd.getTime())) return null;
    const now = new Date();
    let y = now.getFullYear() - bd.getFullYear();
    let m = now.getMonth() - bd.getMonth();
    let d = now.getDate() - bd.getDate();
    if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    const totalDays = Math.floor((now.getTime() - bd.getTime()) / 86400000);
    const nextBirthday = new Date(now); nextBirthday.setFullYear(now.getFullYear());
    if (nextBirthday <= bd) nextBirthday.setFullYear(now.getFullYear() + 1);
    return { years: y, months: m, days: d, totalDays, totalWeeks: Math.floor(totalDays / 7), nextBirthday: Math.ceil((nextBirthday.getTime() - now.getTime()) / 86400000) };
  }, [birth]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <Field label="Date of birth">
          <input type="date" value={birth} onChange={e => setBirth(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15" />
        </Field>
      </InputsCard>
      {result && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <Hero label="Your exact age today" value={`${result.years} years, ${result.months} months, ${result.days} days`} sub={`born on a ${new Date(birth + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`} />
          </div>
          <Stat label="Total days alive" value={result.totalDays.toLocaleString()} />
          <Stat label="Total weeks" value={result.totalWeeks.toLocaleString()} />
          <Stat label="Next birthday" value={`${result.nextBirthday} days`} tone="accent" />
        </div>
      )}
    </div>
  );
};

// ---- Average Calculator ----
export const AvgCalc: React.FC = () => {
  const [input, setInput] = useState('10, 20, 30, 40, 50');
  const result = useMemo(() => {
    const nums = input.split(/[,;\s]+/).map(Number).filter(n => !isNaN(n));
    if (nums.length === 0) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / nums.length;
    const median = nums.length % 2 === 0 ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2 : sorted[Math.floor(nums.length / 2)];
    const freq: Record<number, number> = {}; nums.forEach(n => freq[n] = (freq[n] || 0) + 1);
    const mx = Math.max(...Object.values(freq));
    const mode = Object.entries(freq).filter(([, v]) => v === mx).map(([k]) => Number(k)).join(', ');
    return { count: nums.length, sum, mean, median, mode: mode || 'None', min: sorted[0], max: sorted[sorted.length - 1], range: sorted[sorted.length - 1] - sorted[0] };
  }, [input]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <Field label="Enter numbers" hint="Separate with commas, spaces or new lines">
          <TextArea value={input} onChange={setInput} />
        </Field>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label="Mean (average)" value={num(result.mean)} sub={`${result.count} numbers · sum ${num(result.sum)}`} /></div>
          <Stat label="Median" value={num(result.median)} />
          <Stat label="Mode" value={result.mode} />
          <Stat label="Range" value={`${num(result.min)} – ${num(result.max)}`} sub={`spread ${num(result.range)}`} />
        </div>
      )}
    </div>
  );
};

// ---- Confidence Interval ----
export const CICalc: React.FC = () => {
  const [mean, setMean] = useState('50');
  const [sd, setSd] = useState('10');
  const [n, setN] = useState('100');
  const [ci, setCi] = useState('95');
  const result = useMemo(() => {
    const m = Number(mean), s = Number(sd), sz = Number(n);
    if (isNaN(m) || isNaN(s) || isNaN(sz) || sz <= 0) return null;
    const z: Record<string, number> = { '90': 1.645, '95': 1.96, '99': 2.576 };
    const zScore = z[ci] || 1.96;
    const se = s / Math.sqrt(sz); const moe = zScore * se;
    return { mean: m, se, moe, lower: m - moe, upper: m + moe, ci: Number(ci), zScore };
  }, [mean, sd, n, ci]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Sample mean"><NumInput value={mean} onChange={setMean} /></Field>
          <Field label="Std. deviation"><NumInput value={sd} onChange={setSd} /></Field>
          <Field label="Sample size (n)"><NumInput value={n} onChange={setN} min="1" /></Field>
          <Field label="Confidence level"><SelectBox value={ci} onChange={setCi} options={[['90', '90% (z = 1.645)'], ['95', '95% (z = 1.96)'], ['99', '99% (z = 2.576)']]} /></Field>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label={`${result.ci}% confidence interval`} value={`${result.lower.toFixed(4)} – ${result.upper.toFixed(4)}`} sub={`we are ${result.ci}% confident the true mean lies in this range`} /></div>
          <Stat label="Margin of error" value={`± ${result.moe.toFixed(4)}`} tone="accent" />
          <Stat label="Standard error" value={result.se.toFixed(4)} />
          <Stat label="Z-score used" value={String(result.zScore)} />
        </div>
      )}
    </div>
  );
};

// ---- GST Calculator ----
export const GstCalc: React.FC = () => {
  const [amount, setAmount] = useState('100');
  const [rate, setRate] = useState('10');
  const [mode, setMode] = useState<'add' | 'extract'>('add');
  const result = useMemo(() => {
    const a = Number(amount), r = Number(rate) / 100; if (isNaN(a) || isNaN(r)) return null;
    if (mode === 'add') { const gst = a * r; return { subtotal: a, gst, total: a + gst, mode: 'add' }; }
    const base = a / (1 + r); return { total: a, gst: a - base, subtotal: base, mode: 'extract' };
  }, [amount, rate, mode]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Amount"><NumInput value={amount} onChange={setAmount} min="0" step="0.01" suffix="$" /></Field>
          <Field label="GST / VAT rate"><NumInput value={rate} onChange={setRate} min="0" step="0.1" suffix="%" /></Field>
          <Field label="Mode"><Seg value={mode} onChange={v => setMode(v as 'add' | 'extract')} options={[['add', 'Add GST'], ['extract', 'Extract GST']]} /></Field>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label={mode === 'add' ? 'Total payable' : 'GST contained in total'} value={mode === 'add' ? fmt(result.total) : fmt(result.gst)} sub={mode === 'add' ? `includes ${fmt(result.gst)} GST` : `the total of ${fmt(result.total)} includes this GST`} /></div>
          <Stat label={mode === 'add' ? 'Original amount' : 'Tax-free base'} value={fmt(result.subtotal)} />
          <Stat label="GST / VAT" value={fmt(result.gst)} tone="accent" />
          <Stat label="Total" value={fmt(result.total)} />
        </div>
      )}
    </div>
  );
};

// ---- Margin Calculator ----
export const MarginCalc: React.FC = () => {
  const [mode, setMode] = useState<'cost' | 'revenue'>('cost');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const result = useMemo(() => {
    const x = Number(a), y = Number(b); if (isNaN(x) || isNaN(y) || !y) return null;
    if (mode === 'cost') { const revenue = x, cost = y, profit = revenue - cost; return { profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0, markup: cost > 0 ? (profit / cost) * 100 : 0, sellingPrice: revenue, cost, mode: 'cost' as const }; }
    const cost = x, markup = y / 100; const sp = cost * (1 + markup), profit = cost * markup;
    return { profit, margin: (profit / sp) * 100, markup: y, sellingPrice: sp, cost, mode: 'revenue' as const };
  }, [a, b, mode]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="space-y-3">
          <SelectBox value={mode} onChange={v => setMode(v as 'cost' | 'revenue')} options={[['cost', 'I know cost & selling price'], ['revenue', 'I know cost & desired margin']]} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === 'cost' ? 'Selling price' : 'Cost'}><NumInput value={a} onChange={setA} min="0" step="0.01" suffix="$" /></Field>
            <Field label={mode === 'cost' ? 'Cost' : 'Desired margin'}><NumInput value={b} onChange={setB} min="0" step="0.01" suffix={mode === 'cost' ? '$' : '%'} /></Field>
          </div>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Gross margin" value={`${result.margin.toFixed(2)}%`} tone="accent" />
          <Stat label="Mark-up" value={`${result.markup.toFixed(2)}%`} tone="accent" />
          <Stat label="Profit per unit" value={fmt(result.profit)} />
          <Stat label="Selling price" value={fmt(result.sellingPrice)} sub={`cost ${fmt(result.cost)}`} />
        </div>
      )}
    </div>
  );
};

// ---- Percentage Calculator ----
export const PctCalc: React.FC = () => {
  const [mode, setMode] = useState<'of' | 'change' | 'from'>('of');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const result = useMemo(() => {
    const a = Number(x), b = Number(y); if (isNaN(a) || isNaN(b) || !b) return null;
    if (mode === 'of') return { result: (a / 100) * b, label: `${a}% of ${b}` };
    if (mode === 'change') return { result: ((b - a) / a) * 100, label: `Change from ${a} to ${b}` };
    return { result: ((b - a) / a) * 100, label: `Increase from ${a} to ${b}` };
  }, [x, y, mode]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="space-y-3">
          <SelectBox value={mode} onChange={v => setMode(v as 'of' | 'change' | 'from')} options={[['of', 'What is X% of Y?'], ['change', 'Percentage change from X to Y'], ['from', 'Percentage increase from X to Y']]} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === 'of' ? 'Percentage (X)' : 'Original value (X)'}><NumInput value={x} onChange={setX} suffix={mode === 'of' ? '%' : undefined} /></Field>
            <Field label={mode === 'of' ? 'Of value (Y)' : 'New value (Y)'}><NumInput value={y} onChange={setY} /></Field>
          </div>
        </div>
      </InputsCard>
      {result && <Hero label={result.label} value={`${result.result.toFixed(4)}%`} />}
    </div>
  );
};

// ---- Probability Calculator ----
export const ProbCalc: React.FC = () => {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [op, setOp] = useState<'and' | 'or'>('and');
  const result = useMemo(() => {
    const pA = Number(a), pB = Number(b); if (isNaN(pA) || isNaN(pB)) return null;
    const p = op === 'and' ? pA * pB : pA + pB - pA * pB;
    return { probability: p, percent: (p * 100).toFixed(2) + '%', op };
  }, [a, b, op]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Probability of A"><NumInput value={a} onChange={setA} min="0" max="1" step="0.01" placeholder="0 – 1" /></Field>
          <Field label="Probability of B"><NumInput value={b} onChange={setB} min="0" max="1" step="0.01" placeholder="0 – 1" /></Field>
          <Field label="Event type"><Seg value={op} onChange={v => setOp(v as 'and' | 'or')} options={[['and', 'Both (A ∩ B)'], ['or', 'Either (A ∪ B)']]} /></Field>
        </div>
      </InputsCard>
      {result && <Hero label={`P(A ${op === 'and' ? '∩' : '∪'} B)`} value={result.probability.toFixed(6)} sub={`${result.percent} chance`} />}
    </div>
  );
};

// ---- Sales Tax Calculator ----
export const TaxCalc: React.FC = () => {
  const [price, setPrice] = useState('100');
  const [rate, setRate] = useState('8.5');
  const [mode, setMode] = useState<'add' | 'extract'>('add');
  const result = useMemo(() => {
    const p = Number(price), r = Number(rate) / 100; if (isNaN(p) || isNaN(r)) return null;
    if (mode === 'add') return { price: p, tax: p * r, total: p + p * r };
    const base = p / (1 + r); return { price: base, tax: p - base, total: p };
  }, [price, rate, mode]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Amount"><NumInput value={price} onChange={setPrice} min="0" step="0.01" suffix="$" /></Field>
          <Field label="Tax rate"><NumInput value={rate} onChange={setRate} min="0" step="0.01" suffix="%" /></Field>
          <Field label="Mode"><Seg value={mode} onChange={v => setMode(v as 'add' | 'extract')} options={[['add', 'Add tax'], ['extract', 'Extract from total']]} /></Field>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label={mode === 'add' ? 'Total with tax' : 'Sales tax contained'} value={mode === 'add' ? fmt(result.total) : fmt(result.tax)} sub={mode === 'add' ? `tax adds ${fmt(result.tax)}` : `from a total of ${fmt(result.total)}`} /></div>
          <Stat label={mode === 'add' ? 'Base price' : 'Tax-free price'} value={fmt(result.price)} />
          <Stat label="Sales tax" value={fmt(result.tax)} tone="accent" />
          <Stat label="Total" value={fmt(result.total)} />
        </div>
      )}
    </div>
  );
};

// ---- LTV Calculator ----
export const LtvCalc: React.FC = () => {
  const [aov, setAov] = useState('50');
  const [freq, setFreq] = useState('4');
  const [life, setLife] = useState('24');
  const result = useMemo(() => {
    const a = Number(aov), f = Number(freq), l = Number(life); if (isNaN(a) || isNaN(f) || isNaN(l)) return null;
    const annual = a * f * 12;
    return { annualSpend: a * f * 12, ltv: annual * l, monthlySpend: a * f, ltvMonths: l };
  }, [aov, freq, life]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Avg. order value"><NumInput value={aov} onChange={setAov} min="0" step="0.01" suffix="$" /></Field>
          <Field label="Purchases / month"><NumInput value={freq} onChange={setFreq} min="0" step="0.1" /></Field>
          <Field label="Lifespan (months)"><NumInput value={life} onChange={setLife} min="1" /></Field>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2"><Hero label="Customer lifetime value" value={fmt(result.ltv)} sub={`over ${result.ltvMonths} months`} /></div>
          <Stat label="Monthly value" value={fmt(result.monthlySpend)} />
          <Stat label="Annual value" value={fmt(result.annualSpend)} />
        </div>
      )}
    </div>
  );
};

// ---- Discount Calculator ----
export const DiscountCalc: React.FC = () => {
  const [price, setPrice] = useState('100');
  const [amount, setAmount] = useState('');
  const [pct, setPct] = useState('');
  const result = useMemo(() => {
    const p = Number(price), a = Number(amount), pc = Number(pct);
    if (isNaN(p) || p <= 0) return null;
    const discount = a ? a : pc ? p * (pc / 100) : 0;
    return { original: p, discount, final: p - discount, pct: p > 0 ? (discount / p) * 100 : 0 };
  }, [price, amount, pct]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Original price"><NumInput value={price} onChange={setPrice} min="0" step="0.01" suffix="$" /></Field>
          <Field label="Discount amount" hint="Use either this or %"><NumInput value={amount} onChange={setAmount} min="0" step="0.01" suffix="$" /></Field>
          <Field label="Discount %"><NumInput value={pct} onChange={setPct} min="0" max="100" step="0.1" suffix="%" /></Field>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label="Sale price" value={fmt(result.final)} sub={`you save ${fmt(result.discount)} (${result.pct.toFixed(1)}% off)`} /></div>
          <Stat label="You save" value={fmt(result.discount)} tone="accent" />
          <Stat label="Effective discount" value={`${result.pct.toFixed(1)}%`} tone="accent" />
          <Stat label="Original price" value={fmt(result.original)} />
        </div>
      )}
    </div>
  );
};

// ---- CPM Calculator ----
export const CpmCalc: React.FC = () => {
  const [mode, setMode] = useState<'cpm' | 'rev'>('cpm');
  const [v1, setV1] = useState('5');
  const [v2, setV2] = useState('10000');
  const result = useMemo(() => {
    const a = Number(v1), b = Number(v2); if (isNaN(a) || isNaN(b) || !b) return null;
    if (mode === 'cpm') { const impressions = b; return { cpm: a, impressions, revenue: impressions * (a / 1000), revenueDaily: impressions * (a / 1000), revenueMonthly: impressions * (a / 1000) * 30 }; }
    return { cpm: (a / b) * 1000, impressions: b, revenue: a, revenueDaily: a, revenueMonthly: a * 30 };
  }, [v1, v2, mode]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="space-y-3">
          <SelectBox value={mode} onChange={v => setMode(v as 'cpm' | 'rev')} options={[['cpm', 'I know CPM & impressions'], ['rev', 'I know revenue & impressions']]} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === 'cpm' ? 'CPM' : 'Revenue'}><NumInput value={v1} onChange={setV1} min="0" step="0.01" suffix="$" /></Field>
            <Field label="Daily impressions"><NumInput value={v2} onChange={setV2} min="1" /></Field>
          </div>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label="Estimated monthly revenue" value={fmt(result.revenueMonthly)} sub={`${fmt(result.revenueDaily)} per day at ${num(result.impressions)} daily impressions`} /></div>
          <Stat label="Daily revenue" value={fmt(result.revenueDaily)} tone="accent" />
          <Stat label="Effective CPM" value={fmt((result.revenueDaily / Number(v2 || 1)) * 1000)} />
        </div>
      )}
    </div>
  );
};

// ---- PayPal Fee Calculator ----
export const PaypalCalc: React.FC = () => {
  const [amount, setAmount] = useState('100');
  const [type, setType] = useState('standard');
  const [isInt, setIsInt] = useState(false);
  const result = useMemo(() => {
    const a = Number(amount); if (isNaN(a) || a <= 0) return null;
    let fee = 0, fixed = 0;
    if (type === 'standard') { fee = 0.029; fixed = 0.30; }
    else if (type === 'advanced') { fee = 0.025; fixed = 0.30; }
    else if (type === 'invoice') { fee = 0.034; fixed = 0.30; }
    if (isInt) { fee += 0.015; fixed += 0.30; }
    const totalFee = a * fee + fixed;
    return { amount: a, fee: totalFee, net: a - totalFee, rate: ((totalFee / a) * 100).toFixed(2) + '%' };
  }, [amount, type, isInt]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <Field label="Transaction amount"><NumInput value={amount} onChange={setAmount} min="0" step="0.01" suffix="$" /></Field>
          <Field label="Payment type"><SelectBox value={type} onChange={setType} options={[['standard', 'Standard (2.9% + $0.30)'], ['advanced', 'Advanced (2.5% + $0.30)'], ['invoice', 'Invoice (3.4% + $0.30)']]} /></Field>
          <button
            type="button" role="switch" aria-checked={isInt} onClick={() => setIsInt(v => !v)}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${isInt ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500'}`}
          >
            <span className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${isInt ? 'bg-indigo-500' : 'bg-slate-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isInt ? 'left-4' : 'left-0.5'}`} />
            </span>
            International (+1.5% + $0.30)
          </button>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label="You receive" value={fmt(result.net)} sub={`after ${fmt(result.fee)} fees (${result.rate} of the transaction)`} /></div>
          <Stat label="PayPal fee" value={fmt(result.fee)} sub={result.rate} tone="accent" />
          <Stat label="Total charged" value={fmt(result.amount)} />
        </div>
      )}
    </div>
  );
};

// ---- EPS Calculator ----
export const EpsCalc: React.FC = () => {
  const [income, setIncome] = useState('1000000');
  const [dividends, setDividends] = useState('100000');
  const [shares, setShares] = useState('500000');
  const [diluted, setDiluted] = useState('');
  const result = useMemo(() => {
    const ni = Number(income), d = Number(dividends), s = Number(shares);
    if (isNaN(ni) || isNaN(d) || isNaN(s) || !s) return null;
    const basic = (ni - d) / s;
    const dil = diluted ? (ni - d) / Number(diluted) : null;
    return { netIncome: ni, dividends: d, shares: s, basic, diluted: dil };
  }, [income, dividends, shares, diluted]);
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Net income"><NumInput value={income} onChange={setIncome} min="0" suffix="$" /></Field>
          <Field label="Preferred dividends"><NumInput value={dividends} onChange={setDividends} min="0" suffix="$" /></Field>
          <Field label="Weighted avg. shares"><NumInput value={shares} onChange={setShares} min="1" /></Field>
          <Field label="Diluted shares" hint="Optional — leave blank to skip"><NumInput value={diluted} onChange={setDiluted} min="1" /></Field>
        </div>
      </InputsCard>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3"><Hero label="Basic earnings per share" value={`$${result.basic.toFixed(4)}`} sub={`on ${num(result.netIncome - result.dividends)} of earnings available to common shareholders`} /></div>
          {result.diluted !== null && <Stat label="Diluted EPS" value={`$${result.diluted.toFixed(4)}`} tone="accent" />}
          <Stat label="Earnings available" value={fmt(result.netIncome - result.dividends)} />
        </div>
      )}
    </div>
  );
};

// ---- BMI Calculator ----
const BMI_BANDS = [
  { until: 18.5, label: 'Underweight', cls: 'bg-sky-400' },
  { until: 25, label: 'Normal', cls: 'bg-emerald-400' },
  { until: 30, label: 'Overweight', cls: 'bg-amber-400' },
  { until: 40, label: 'Obese', cls: 'bg-red-400' },
];
export const BmiCalc: React.FC = () => {
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [feet, setFeet] = useState('');
  const [inches, setInches] = useState('');
  const result = useMemo(() => {
    if (unit === 'metric') {
      const w = Number(weight), h = Number(height); if (!w || !h) return null;
      const bmi = w / ((h / 100) ** 2);
      return { bmi, category: bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : 'Obese', weight: w + ' kg', height: h + ' cm' };
    }
    const w = Number(weight), ft = Number(feet), inc = Number(inches) || 0;
    const totalInches = ft * 12 + inc; if (!w || !totalInches) return null;
    const bmi = (w / (totalInches ** 2)) * 703;
    return { bmi, category: bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : 'Obese', weight: w + ' lbs', height: `${ft}ft ${inc}in` };
  }, [unit, weight, height, feet, inches]);
  const marker = result ? Math.min(99, Math.max(1, ((Math.min(40, Math.max(14, result.bmi)) - 14) / 26) * 100)) : 0;
  return (
    <div className="space-y-4">
      <InputsCard>
        <div className="space-y-3">
          <Seg value={unit} onChange={v => setUnit(v as 'metric' | 'imperial')} options={[['metric', 'Metric (kg / cm)'], ['imperial', 'Imperial (lbs / ft)']]} />
          {unit === 'metric' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weight"><NumInput value={weight} onChange={setWeight} min="0" step="0.1" suffix="kg" /></Field>
              <Field label="Height"><NumInput value={height} onChange={setHeight} min="1" step="0.1" suffix="cm" /></Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Weight"><NumInput value={weight} onChange={setWeight} min="0" step="0.1" suffix="lbs" /></Field>
              <Field label="Feet"><NumInput value={feet} onChange={setFeet} min="1" suffix="ft" /></Field>
              <Field label="Inches"><NumInput value={inches} onChange={setInches} min="0" suffix="in" /></Field>
            </div>
          )}
        </div>
      </InputsCard>
      {result && (
        <div className="space-y-3">
          <Hero label="Your BMI" value={result.bmi.toFixed(1)} sub={`${result.category} · ${result.weight} × ${result.height}`} />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="relative h-3 rounded-full overflow-hidden flex">
              {BMI_BANDS.map(b => {
                const from = b === BMI_BANDS[0] ? 14 : BMI_BANDS[BMI_BANDS.indexOf(b) - 1].until;
                return <span key={b.label} className={`${b.cls} h-full`} style={{ width: `${((b.until - from) / 26) * 100}%` }} />;
              })}
              <span className="absolute top-0 h-full w-1 bg-white shadow ring-1 ring-slate-900/30" style={{ left: `${marker}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1.5">
              <span>14</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">WHO adult categories: under 18.5 underweight · 18.5–24.9 normal · 25–29.9 overweight · 30+ obese.</p>
          </div>
        </div>
      )}
    </div>
  );
};
