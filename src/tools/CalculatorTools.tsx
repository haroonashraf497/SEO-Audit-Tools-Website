import React, { useMemo, useState } from 'react';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block"><span className="text-sm font-semibold text-slate-700 block mb-1">{label}</span>{hint && <span className="text-xs text-slate-500 block mb-1">{hint}</span>}{children}</label>
);
const Input: React.FC<{ value: string; onChange: (v: string) => void; min?: string; max?: string; step?: string; placeholder?: string; className?: string }> = ({ value, onChange, min, max, step, placeholder, className = '' }) => (
  <input aria-label={placeholder || "Value"} type="number" value={value} onChange={e => onChange(e.target.value)} min={min} max={max} step={step} placeholder={placeholder} className={`w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${className}`} />
);
const Select: React.FC<{ value: string; onChange: (v: string) => void; options: [string, string][] }> = ({ value, onChange, options }) => (
  <select aria-label="Calculation type" value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
);
const Result: React.FC<{ label: string; value: string | number; emphasis?: boolean }> = ({ label, value, emphasis }) => (
  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">{label}</p><p className={emphasis ? 'text-xl font-bold text-indigo-600' : 'text-lg font-bold text-slate-800'}>{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : value}</p></div>
);

const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    <div className="space-y-5">
      <Field label="Date of birth"><input type="date" value={birth} onChange={e => setBirth(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-indigo-500" /></Field>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 text-white col-span-2 sm:col-span-3 text-center"><p className="text-4xl font-extrabold">{result.years} years, {result.months} months, {result.days} days</p><p className="text-indigo-100 text-sm mt-1">Your exact age today</p></div>
          <Result label="Total days alive" value={result.totalDays.toLocaleString()} />
          <Result label="Total weeks" value={result.totalWeeks.toLocaleString()} />
          <Result label="Days until next birthday" value={result.nextBirthday} />
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
    <div className="space-y-5">
      <Field label="Enter numbers (comma, space or newline separated)"><textarea value={input} onChange={e => setInput(e.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono bg-white outline-none focus:border-indigo-500" /></Field>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Result label="Mean (average)" value={result.mean.toFixed(4)} emphasis />
          <Result label="Median" value={result.median} />
          <Result label="Mode" value={result.mode} />
          <Result label="Range" value={`${result.min} – ${result.max}`} />
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Sample mean"><Input value={mean} onChange={setMean} /></Field>
        <Field label="Standard deviation"><Input value={sd} onChange={setSd} /></Field>
        <Field label="Sample size (n)"><Input value={n} onChange={setN} min="1" /></Field>
        <Field label="Confidence level (%)"><Select value={ci} onChange={setCi} options={[['90', '90% (z = 1.645)'], ['95', '95% (z = 1.96)'], ['99', '99% (z = 2.576)']]} /></Field>
      </div>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Result label="Confidence interval" value={`${result.lower.toFixed(4)} – ${result.upper.toFixed(4)}`} emphasis />
          <Result label="Margin of error" value={result.moe.toFixed(4)} />
          <Result label="Standard error" value={result.se.toFixed(4)} />
          <Result label="Z-score used" value={result.zScore} />
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Amount ($)"><Input value={amount} onChange={setAmount} min="0" step="0.01" /></Field>
        <Field label="GST / VAT rate (%)"><Input value={rate} onChange={setRate} min="0" step="0.1" /></Field>
        <div><label className="text-sm font-semibold text-slate-700 block mb-1">Mode</label><div className="flex gap-1">{[['add', 'Add GST'], ['extract', 'Extract GST']].map(([v, l]) => <button key={v} type="button" onClick={() => setMode(v as 'add' | 'extract')} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${mode === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{l}</button>)}</div></div>
      </div>
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <Result label={mode === 'add' ? 'Original amount' : 'Final amount'} value={fmt(result.subtotal)} />
          <Result label="GST / VAT" value={fmt(result.gst)} emphasis />
          <Result label={mode === 'add' ? 'Total payable' : 'Tax removed'} value={fmt(result.total)} emphasis />
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Select value={mode} onChange={(v) => setMode(v as any)} options={[['cost', 'I know cost & selling price'], ['revenue', 'I know cost & desired margin']]} />
        <div className="grid grid-cols-2 gap-2">
          <Field label={mode === 'cost' ? 'Selling price ($)' : 'Cost ($)'}><Input value={a} onChange={setA} min="0" step="0.01" /></Field>
          <Field label={mode === 'cost' ? 'Cost ($)' : 'Desired margin (%)'}><Input value={b} onChange={setB} min="0" step="0.01" /></Field>
        </div>
      </div>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Result label="Margin %" value={`${result.margin.toFixed(2)}%`} emphasis />
          <Result label="Mark-up %" value={`${result.markup.toFixed(2)}%`} emphasis />
          <Result label="Profit per unit" value={fmt(result.profit)} />
          <Result label="Selling price" value={fmt(result.sellingPrice)} />
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
    if (mode === 'change') return { result: ((b - a) / a) * 100, label: `From ${a} to ${b}` };
    return { result: ((b - a) / a) * 100, label: `Increase from ${a} to ${b} is…` };
  }, [x, y, mode]);
  return (
    <div className="space-y-5">
      <Select value={mode} onChange={(v) => setMode(v as any)} options={[['of', 'What is X% of Y?'], ['change', 'Percentage change from X to Y'], ['from', 'Percentage increase from X to Y']]} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={mode === 'of' ? 'Percentage (X%)' : 'Original value (X)'}><Input value={x} onChange={setX} /></Field>
        <Field label={mode === 'of' ? 'Of value (Y)' : 'New value (Y)'}><Input value={y} onChange={setY} /></Field>
      </div>
      {result && <Result label={result.label} value={`${result.result.toFixed(4)}%`} emphasis />}
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
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Probability of A"><Input value={a} onChange={setA} min="0" max="1" step="0.01" placeholder="0 – 1" /></Field>
        <Field label="Probability of B"><Input value={b} onChange={setB} min="0" max="1" step="0.01" placeholder="0 – 1" /></Field>
        <div><label className="text-sm font-semibold text-slate-700 block mb-1">Event type</label><div className="flex gap-1">{[['and', 'Both (A ∩ B)'], ['or', 'Either (A ∪ B)']].map(([v, l]) => <button key={v} type="button" onClick={() => setOp(v as any)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${op === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{l}</button>)}</div></div>
      </div>
      {result && <Result label={`P(A ${op === 'and' ? '∩' : '∪'} B)`} value={`${result.probability.toFixed(6)}  (${result.percent})`} emphasis />}
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Amount ($)"><Input value={price} onChange={setPrice} min="0" step="0.01" /></Field>
        <Field label="Tax rate (%)"><Input value={rate} onChange={setRate} min="0" step="0.01" /></Field>
        <div><label className="text-sm font-semibold text-slate-700 block mb-1">Mode</label><div className="flex gap-1">{[['add', 'Add tax'], ['extract', 'Extract from total']].map(([v, l]) => <button key={v} type="button" onClick={() => setMode(v as any)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${mode === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{l}</button>)}</div></div>
      </div>
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <Result label={mode === 'add' ? 'Base price' : 'Tax-free price'} value={fmt(result.price)} />
          <Result label="Sales tax" value={fmt(result.tax)} emphasis />
          <Result label="Total" value={fmt(result.total)} emphasis />
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
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Average order value ($)"><Input value={aov} onChange={setAov} min="0" step="0.01" /></Field>
        <Field label="Purchases per month"><Input value={freq} onChange={setFreq} min="0" step="0.1" /></Field>
        <Field label="Customer lifespan (months)"><Input value={life} onChange={setLife} min="1" /></Field>
      </div>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Result label="LTV" value={fmt(result.ltv)} emphasis />
          <Result label="Monthly value" value={fmt(result.monthlySpend)} />
          <Result label="Annual value" value={fmt(result.annualSpend)} />
          <Result label="Lifespan" value={`${result.ltvMonths} months`} />
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
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Original price ($)"><Input value={price} onChange={setPrice} min="0" step="0.01" /></Field>
        <Field label="Discount amount ($)"><Input value={amount} onChange={setAmount} min="0" step="0.01" /></Field>
        <Field label="Discount (%)"><Input value={pct} onChange={setPct} min="0" max="100" step="0.1" /></Field>
      </div>
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <Result label="Sale price" value={fmt(result.final)} emphasis />
          <Result label="You save" value={`${fmt(result.discount)} (${result.pct.toFixed(1)}%)`} emphasis />
          <Result label="Original" value={fmt(result.original)} />
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
    <div className="space-y-5">
      <Select value={mode} onChange={(v) => setMode(v as any)} options={[['cpm', 'I know CPM & impressions'], ['rev', 'I know revenue & impressions']]} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={mode === 'cpm' ? 'CPM ($ per 1K views)' : 'Revenue ($)'}><Input value={v1} onChange={setV1} min="0" step="0.01" /></Field>
        <Field label="Daily impressions"><Input value={v2} onChange={setV2} min="1" /></Field>
      </div>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Result label="Daily revenue" value={fmt(result.revenueDaily)} emphasis />
          <Result label="Monthly revenue" value={fmt(result.revenueMonthly)} emphasis />
          <Result label="Revenue per 1K views" value={fmt((result.revenueDaily / Number(v2 || 1)) * 1000)} />
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Transaction amount ($)"><Input value={amount} onChange={setAmount} min="0" step="0.01" /></Field>
        <Field label="Payment type"><Select value={type} onChange={setType} options={[['standard', 'Standard (2.9% + $0.30)'], ['advanced', 'Advanced (2.5% + $0.30)'], ['invoice', 'Invoice (3.4% + $0.30)']]} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 pt-6"><input type="checkbox" checked={isInt} onChange={e => setIsInt(e.target.checked)} className="accent-indigo-600" /> International (+1.5% + $0.30)</label>
      </div>
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <Result label="Total transaction" value={fmt(result.amount)} />
          <Result label="PayPal fee" value={`${fmt(result.fee)} (${result.rate})`} emphasis />
          <Result label="You receive" value={fmt(result.net)} emphasis />
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Net income ($)"><Input value={income} onChange={setIncome} min="0" /></Field>
        <Field label="Preferred dividends ($)"><Input value={dividends} onChange={setDividends} min="0" /></Field>
        <Field label="Weighted average shares"><Input value={shares} onChange={setShares} min="1" /></Field>
        <Field label="Diluted shares (optional)" hint="Leave blank to skip"><Input value={diluted} onChange={setDiluted} /></Field>
      </div>
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Result label="Basic EPS" value={`$${result.basic.toFixed(4)}`} emphasis />
          {result.diluted !== null && <Result label="Diluted EPS" value={`$${result.diluted.toFixed(4)}`} emphasis />}
          <Result label="Earnings available" value={fmt(result.netIncome - result.dividends)} />
        </div>
      )}
    </div>
  );
};

// ---- BMI Calculator ----
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
  return (
    <div className="space-y-5">
      <div className="flex gap-2">{[['metric', 'Metric'], ['imperial', 'Imperial']].map(([v, l]) => <button key={v} type="button" onClick={() => setUnit(v as any)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${unit === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{l}</button>)}</div>
      {unit === 'metric' ? (
        <div className="grid grid-cols-2 gap-3"><Field label="Weight (kg)"><Input value={weight} onChange={setWeight} min="0" step="0.1" /></Field><Field label="Height (cm)"><Input value={height} onChange={setHeight} min="1" step="0.1" /></Field></div>
      ) : (
        <div className="grid grid-cols-3 gap-3"><Field label="Weight (lbs)"><Input value={weight} onChange={setWeight} min="0" step="0.1" /></Field><Field label="Feet"><Input value={feet} onChange={setFeet} min="1" /></Field><Field label="Inches"><Input value={inches} onChange={setInches} min="0" /></Field></div>
      )}
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-5 text-white"><p className="text-indigo-100 text-sm">Your BMI</p><p className="text-4xl font-extrabold">{result.bmi.toFixed(1)}</p></div>
          <Result label="Category" value={result.category} emphasis />
          <Result label={`${result.weight} × ${result.height}`} value="Input" />
        </div>
      )}
    </div>
  );
};
