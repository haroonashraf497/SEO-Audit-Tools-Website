import React, { useEffect, useMemo, useState } from 'react';

const cn = (...cls: (string | boolean | undefined)[]) => cls.filter(Boolean).join(' ');

const Icon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={d} /></svg>
);
const ic = {
  swap: 'M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4',
  copy: 'M9 9h10v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9Zm-3 3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1',
  check: 'm20 6-11 11-5-5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};

const Copy: React.FC<{ text: string; label?: string }> = ({ text }) => {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" aria-label="Copy" title="Copy"
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }).catch(() => undefined); }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-indigo-200 hover:text-indigo-500">
      {ok ? <Icon d={ic.check} className="w-3.5 h-3.5 text-emerald-500" /> : <Icon d={ic.copy} className="w-3.5 h-3.5" />}
    </button>
  );
};

const Label: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</label>
);

const NumInput: React.FC<{ id?: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ id, value, onChange, placeholder }) => (
  <input id={id} type="text" inputMode="decimal" value={value} placeholder={placeholder}
    onChange={e => { const v = e.target.value; if (v === '' || /^-?\d*\.?\d*$/.test(v)) onChange(v); }}
    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-lg font-semibold tabular-nums text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
);

const Sel: React.FC<{ id?: string; value: string; onChange: (v: string) => void; children: React.ReactNode }> = ({ id, value, onChange, children }) => (
  <select id={id} value={value} onChange={e => onChange(e.target.value)}
    className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
    {children}
  </select>
);

const Panel: React.FC<{ title: string; icon?: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/70 shadow-lg overflow-hidden">
    <div className="bg-slate-50/80 px-5 py-3 flex items-center justify-between border-b border-slate-100">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">{icon && <Icon d={icon} className="w-3.5 h-3.5 text-slate-400" />}{title}</span>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

/** Clean number rendering: grouped, no raw exponents for everyday magnitudes. */
const fmt = (n: number, maxFrac = 8): string => {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) return n.toExponential(4).replace(/(\.\d*?)0+e/, '$1e').replace(/\.e/, 'e');
  return Number(n.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: maxFrac });
};

interface UnitEntry { symbol: string; name: string; toBase: number }

// ---- unit systems ----
const LENGTH_UNITS: UnitEntry[] = [
  { symbol: 'mm', name: 'Millimetres', toBase: 0.001 },
  { symbol: 'cm', name: 'Centimetres', toBase: 0.01 },
  { symbol: 'm', name: 'Metres', toBase: 1 },
  { symbol: 'km', name: 'Kilometres', toBase: 1000 },
  { symbol: 'in', name: 'Inches', toBase: 0.0254 },
  { symbol: 'ft', name: 'Feet', toBase: 0.3048 },
  { symbol: 'yd', name: 'Yards', toBase: 0.9144 },
  { symbol: 'mi', name: 'Miles', toBase: 1609.344 },
];
const WEIGHT_UNITS: UnitEntry[] = [
  { symbol: 'mg', name: 'Milligrams', toBase: 0.001 },
  { symbol: 'g', name: 'Grams', toBase: 1 },
  { symbol: 'kg', name: 'Kilograms', toBase: 1000 },
  { symbol: 'lb', name: 'Pounds', toBase: 453.592 },
  { symbol: 'oz', name: 'Ounces', toBase: 28.3495 },
  { symbol: 'st', name: 'Stones', toBase: 6350.29 },
];
const AREA_UNITS: UnitEntry[] = [
  { symbol: 'cm²', name: 'Square centimetres', toBase: 0.0001 },
  { symbol: 'm²', name: 'Square metres', toBase: 1 },
  { symbol: 'km²', name: 'Square kilometres', toBase: 1000000 },
  { symbol: 'ft²', name: 'Square feet', toBase: 0.092903 },
  { symbol: 'yd²', name: 'Square yards', toBase: 0.836127 },
  { symbol: 'ac', name: 'Acres', toBase: 4046.86 },
  { symbol: 'ha', name: 'Hectares', toBase: 10000 },
];
const VOLUME_UNITS: UnitEntry[] = [
  { symbol: 'ml', name: 'Millilitres', toBase: 0.001 },
  { symbol: 'l', name: 'Litres', toBase: 1 },
  { symbol: 'm³', name: 'Cubic metres', toBase: 1000 },
  { symbol: 'tsp', name: 'Teaspoons (US)', toBase: 0.00492892 },
  { symbol: 'tbsp', name: 'Tablespoons (US)', toBase: 0.0147868 },
  { symbol: 'floz', name: 'Fluid ounces (US)', toBase: 0.0295735 },
  { symbol: 'cup', name: 'Cups (US)', toBase: 0.236588 },
  { symbol: 'pt', name: 'Pints (US)', toBase: 0.473176 },
  { symbol: 'gal', name: 'Gallons (US)', toBase: 3.78541 },
];
const SPEED_UNITS: UnitEntry[] = [
  { symbol: 'km/h', name: 'Kilometres per hour', toBase: 1 },
  { symbol: 'mph', name: 'Miles per hour', toBase: 1.609344 },
  { symbol: 'm/s', name: 'Metres per second', toBase: 3.6 },
  { symbol: 'kn', name: 'Knots', toBase: 1.852 },
  { symbol: 'ft/s', name: 'Feet per second', toBase: 1.09728 },
];
const DATA_UNITS: UnitEntry[] = [
  { symbol: 'B', name: 'Bytes', toBase: 1 },
  { symbol: 'KB', name: 'Kilobytes', toBase: 1000 },
  { symbol: 'MB', name: 'Megabytes', toBase: 1000000 },
  { symbol: 'GB', name: 'Gigabytes', toBase: 1000000000 },
  { symbol: 'TB', name: 'Terabytes', toBase: 1000000000000 },
  { symbol: 'KiB', name: 'Kibibytes', toBase: 1024 },
  { symbol: 'MiB', name: 'Mebibytes', toBase: 1048576 },
  { symbol: 'GiB', name: 'Gibibytes', toBase: 1073741824 },
];
const PRESSURE_UNITS: UnitEntry[] = [
  { symbol: 'Pa', name: 'Pascals', toBase: 1 },
  { symbol: 'kPa', name: 'Kilopascals', toBase: 1000 },
  { symbol: 'bar', name: 'Bar', toBase: 100000 },
  { symbol: 'atm', name: 'Atmospheres', toBase: 101325 },
  { symbol: 'psi', name: 'PSI', toBase: 6894.76 },
  { symbol: 'mmHg', name: 'Millimetres of mercury', toBase: 133.322 },
  { symbol: 'torr', name: 'Torr', toBase: 133.322 },
];
const POWER_UNITS: UnitEntry[] = [
  { symbol: 'W', name: 'Watts', toBase: 1 },
  { symbol: 'kW', name: 'Kilowatts', toBase: 1000 },
  { symbol: 'hp', name: 'Horsepower', toBase: 745.7 },
  { symbol: 'BTU/h', name: 'BTU per hour', toBase: 0.293071 },
];
const VOLTAGE_UNITS: UnitEntry[] = [
  { symbol: 'μV', name: 'Microvolts', toBase: 0.000001 },
  { symbol: 'mV', name: 'Millivolts', toBase: 0.001 },
  { symbol: 'V', name: 'Volts', toBase: 1 },
  { symbol: 'kV', name: 'Kilovolts', toBase: 1000 },
];

// ---- temperature (affine, handled separately) ----
const tempToC = (v: number, unit: string): number => {
  if (unit === 'F') return (v - 32) * 5 / 9;
  if (unit === 'K') return v - 273.15;
  return v;
};
const tempFromC = (c: number, unit: string): number => {
  if (unit === 'F') return c * 9 / 5 + 32;
  if (unit === 'K') return c + 273.15;
  return c;
};
const TEMP_UNITS = [
  { symbol: 'C', name: 'Celsius' },
  { symbol: 'F', name: 'Fahrenheit' },
  { symbol: 'K', name: 'Kelvin' },
];

// ---- real IANA zones: offsets computed live via Intl (DST-correct) ----
const ZONES: { id: string; label: string }[] = [
  { id: 'Asia/Karachi', label: 'Karachi, Pakistan' },
  { id: 'Asia/Kolkata', label: 'Delhi / Mumbai, India' },
  { id: 'Asia/Dubai', label: 'Dubai, UAE' },
  { id: 'Asia/Singapore', label: 'Singapore' },
  { id: 'Asia/Shanghai', label: 'Beijing / Shanghai, China' },
  { id: 'Asia/Tokyo', label: 'Tokyo, Japan' },
  { id: 'Australia/Sydney', label: 'Sydney, Australia' },
  { id: 'Pacific/Auckland', label: 'Auckland, New Zealand' },
  { id: 'Europe/London', label: 'London, UK' },
  { id: 'Europe/Paris', label: 'Paris / Berlin, EU' },
  { id: 'Europe/Istanbul', label: 'Istanbul, Türkiye' },
  { id: 'Europe/Moscow', label: 'Moscow, Russia' },
  { id: 'Africa/Cairo', label: 'Cairo, Egypt' },
  { id: 'America/New_York', label: 'New York, USA (ET)' },
  { id: 'America/Chicago', label: 'Chicago, USA (CT)' },
  { id: 'America/Denver', label: 'Denver, USA (MT)' },
  { id: 'America/Los_Angeles', label: 'Los Angeles, USA (PT)' },
  { id: 'Pacific/Honolulu', label: 'Honolulu, USA (HT)' },
];

const tzOffsetMin = (tz: string, when: number): number => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(when).map(x => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return Math.round((asUTC - when) / 60000);
};
const fmtOffset = (min: number): string => {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
};
const fmtDiff = (min: number): string => {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h}h${m ? ` ${m}m` : ''}`;
};
const inZone = (ms: number, tz: string, withSec = false): string =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...(withSec ? { second: '2-digit' as const } : {}), hour12: false }).format(ms);
const wallToUtc = (dateStr: string, timeStr: string, tz: string): number | null => {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const [h, m] = timeStr.split(':').map(Number);
  if (!Y || !M || !D || !Number.isFinite(h) || !Number.isFinite(m)) return null;
  const guess = Date.UTC(Y, M - 1, D, h, m);
  const off1 = tzOffsetMin(tz, guess);
  let utc = guess - off1 * 60000;
  const off2 = tzOffsetMin(tz, utc);
  if (off2 !== off1) utc = guess - off2 * 60000; // DST edge
  return utc;
};
const nowWall = (tz: string): { dateStr: string; timeStr: string } => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(Date.now()).map(x => [x.type, x.value]));
  return { dateStr: `${p.year}-${p.month}-${p.day}`, timeStr: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
};

// ---- the shared from→to converter used by every multiplicative tool ----
const SimpleConverter: React.FC<{ units: UnitEntry[]; title: string }> = ({ units, title }) => {
  const [from, setFrom] = useState(units[0].symbol);
  const [to, setTo] = useState(units[1]?.symbol ?? units[0].symbol);
  const [value, setValue] = useState('1');
  const f = units.find(u => u.symbol === from) ?? units[0];
  const t = units.find(u => u.symbol === to) ?? units[1] ?? units[0];
  const v = value.trim() === '' ? NaN : Number(value);
  const valid = Number.isFinite(v);
  const out = valid ? v * f.toBase / t.toBase : NaN;
  const factor = f.toBase / t.toBase;
  const swap = () => { setFrom(t.symbol); setTo(f.symbol); };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <Panel title="From" icon={ic.arrow} right={<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</span>}>
          <div className="space-y-3">
            <div><Label htmlFor={`conv-from-${title}`}>Unit</Label>
              <Sel id={`conv-from-${title}`} value={from} onChange={setFrom}>{units.map(u => <option key={u.symbol} value={u.symbol}>{u.name} ({u.symbol})</option>)}</Sel>
            </div>
            <div><Label htmlFor={`conv-val-${title}`}>Value</Label>
              <NumInput id={`conv-val-${title}`} value={value} onChange={setValue} placeholder="Enter a value" />
            </div>
          </div>
        </Panel>

        <div className="flex justify-center lg:justify-self-center">
          <button type="button" onClick={swap} title="Swap units" aria-label="Swap units"
            className="h-12 w-12 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 shadow-sm transition hover:bg-indigo-100 hover:rotate-180 duration-300">
            <Icon d={ic.swap} className="mx-auto w-5 h-5" />
          </button>
        </div>

        <Panel title="To" icon={ic.arrow}>
          <div className="space-y-3">
            <div><Label htmlFor={`conv-to-${title}`}>Unit</Label>
              <Sel id={`conv-to-${title}`} value={to} onChange={setTo}>{units.map(u => <option key={u.symbol} value={u.symbol}>{u.name} ({u.symbol})</option>)}</Sel>
            </div>
            <div>
              <Label>Result</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-2xl bg-indigo-50 px-4 py-3.5 text-lg font-bold tabular-nums text-indigo-700 break-all">{valid ? fmt(out) : '—'}</div>
                {valid && <Copy text={`${fmt(out)} ${t.symbol}`} />}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>1 {f.symbol} = <b className="text-slate-800 tabular-nums">{fmt(factor)}</b> {t.symbol}</span>
        <span className="text-slate-400">·</span>
        <span>1 {t.symbol} = <b className="text-slate-800 tabular-nums">{fmt(1 / factor)}</b> {f.symbol}</span>
        <Copy text={`1 ${f.symbol} = ${fmt(factor)} ${t.symbol}`} />
      </div>

      {valid && (
        <Panel title={`All units — ${fmt(v, 6)} ${f.symbol} in every ${title.toLowerCase()} unit`} icon={ic.arrow} right={<Copy text={units.map(u => `${u.name}: ${fmt(v * f.toBase / u.toBase)} ${u.symbol}`).join('\n')} />}>
          <div className="grid sm:grid-cols-2 gap-x-6">
            {units.map(u => (
              <div key={u.symbol} className={cn('flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm', u.symbol === to ? 'bg-indigo-50' : 'hover:bg-slate-50')}>
                <span className="text-slate-600">{u.name} <span className="text-slate-400 text-xs">({u.symbol})</span></span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums text-slate-800">{fmt(v * f.toBase / u.toBase)}</b>
                  <Copy text={`${fmt(v * f.toBase / u.toBase)} ${u.symbol}`} />
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
};

// ---- Temperature Converter ----
export const TempConverter: React.FC = () => {
  const [unit, setUnit] = useState('C');
  const [value, setValue] = useState('100');
  const v = value.trim() === '' ? NaN : Number(value);
  const valid = Number.isFinite(v);
  const c = tempToC(v, unit);
  return (
    <div className="space-y-5">
      <Panel title="Temperature" icon={ic.clock}>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div><Label htmlFor="temp-unit">Unit</Label>
            <Sel id="temp-unit" value={unit} onChange={setUnit}>{TEMP_UNITS.map(u => <option key={u.symbol} value={u.symbol}>{u.name} (°{u.symbol})</option>)}</Sel>
          </div>
          <div><Label htmlFor="temp-val">Value</Label>
            <NumInput id="temp-val" value={value} onChange={setValue} placeholder="Enter a temperature" />
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-3">
        {TEMP_UNITS.map(u => {
          const val = valid ? tempFromC(c, u.symbol) : NaN;
          const active = u.symbol === unit;
          return (
            <div key={u.symbol} className={cn('rounded-2xl border p-5 text-center shadow-lg transition', active ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200/70 bg-white')}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{u.name}</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <p className={cn('text-3xl font-bold tabular-nums break-all', active ? 'text-indigo-700' : 'text-slate-800')}>{valid ? `${fmt(val, 4)}°` : '—'}</p>
                {valid && <Copy text={`${fmt(val, 4)} °${u.symbol}`} />}
              </div>
            </div>
          );
        })}
      </div>
      <Panel title="Quick reference" icon={ic.arrow}>
        <div className="grid gap-3 sm:grid-cols-3 text-center text-sm">
          <div className="rounded-xl bg-slate-50 py-3"><p className="text-xs text-slate-400">Freezing point of water</p><p className="mt-0.5 font-bold text-slate-700 tabular-nums">0°C · 32°F · 273.15K</p></div>
          <div className="rounded-xl bg-slate-50 py-3"><p className="text-xs text-slate-400">Boiling point of water</p><p className="mt-0.5 font-bold text-slate-700 tabular-nums">100°C · 212°F · 373.15K</p></div>
          <div className="rounded-xl bg-slate-50 py-3"><p className="text-xs text-slate-400">Human body temperature</p><p className="mt-0.5 font-bold text-slate-700 tabular-nums">37°C · 98.6°F · 310.15K</p></div>
        </div>
      </Panel>
    </div>
  );
};

// ---- Time Zone Converter (real IANA zones, DST-correct via Intl) ----
export const TimezoneConverter: React.FC = () => {
  const [from, setFrom] = useState('Europe/London');
  const [to, setTo] = useState('Asia/Karachi');
  const [date, setDate] = useState(() => nowWall('Europe/London').dateStr);
  const [time, setTime] = useState(() => nowWall('Europe/London').timeStr);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const utc = useMemo(() => wallToUtc(date, time, from), [date, time, from]);
  const offFrom = tzOffsetMin(from, utc ?? Date.now());
  const offTo = tzOffsetMin(to, utc ?? Date.now());
  const zoneSel = (id: string, set: (v: string) => void, htmlId: string) => (
    <div><Label htmlFor={htmlId}>Time zone</Label>
      <Sel id={htmlId} value={id} onChange={set}>{ZONES.map(z => <option key={z.id} value={z.id}>{z.label} — {fmtOffset(tzOffsetMin(z.id, utc ?? Date.now()))}</option>)}</Sel>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <Panel title="From" icon={ic.globe}>
          <div className="space-y-3">
            {zoneSel(from, setFrom, 'tz-from')}
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="tz-date">Date</Label>
                <input id="tz-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[15px] text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" /></div>
              <div><Label htmlFor="tz-time">Time</Label>
                <input id="tz-time" type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-[15px] text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" /></div>
            </div>
            <button type="button" onClick={() => { const w = nowWall(from); setDate(w.dateStr); setTime(w.timeStr); }}
              className="text-sm font-semibold text-indigo-600 hover:underline">Use current time in {ZONES.find(z => z.id === from)?.label.split(',')[0]} →</button>
          </div>
        </Panel>
        <div className="flex justify-center lg:justify-self-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600"><Icon d={ic.arrow} className="w-5 h-5" /></span>
        </div>
        <Panel title="To" icon={ic.globe}>{zoneSel(to, setTo, 'tz-to')}</Panel>
      </div>

      {utc !== null ? (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center text-center sm:text-left">
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-200">{ZONES.find(z => z.id === from)?.label} · {fmtOffset(offFrom)}</p>
              <p className="mt-1 text-2xl font-bold">{inZone(utc, from)}</p>
            </div>
            <div className="justify-self-center rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold whitespace-nowrap">{fmtDiff(offTo - offFrom)}</div>
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-200">{ZONES.find(z => z.id === to)?.label} · {fmtOffset(offTo)}</p>
              <p className="mt-1 text-2xl font-bold">{inZone(utc, to)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">Pick a valid date and time to see the conversion.</div>
      )}

      <Panel title="Right now (live)" icon={ic.clock} right={<span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 tabular-nums">{new Date(now).toISOString().slice(11, 19)} UTC</span>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[from, to].map((tz, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div><p className="text-sm font-semibold text-slate-700">{ZONES.find(z => z.id === tz)?.label}</p><p className="text-xs text-slate-400">{fmtOffset(tzOffsetMin(tz, now))}</p></div>
              <p className="text-xl font-bold tabular-nums text-slate-800">{new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

// ---- Universal Unit Converter ----
const CATS: { key: string; label: string; units: UnitEntry[] }[] = [
  { key: 'length', label: 'Length', units: LENGTH_UNITS },
  { key: 'weight', label: 'Weight', units: WEIGHT_UNITS },
  { key: 'area', label: 'Area', units: AREA_UNITS },
  { key: 'volume', label: 'Volume', units: VOLUME_UNITS },
  { key: 'speed', label: 'Speed', units: SPEED_UNITS },
  { key: 'data', label: 'Data', units: DATA_UNITS },
  { key: 'pressure', label: 'Pressure', units: PRESSURE_UNITS },
  { key: 'power', label: 'Power', units: POWER_UNITS },
  { key: 'voltage', label: 'Voltage', units: VOLTAGE_UNITS },
];
export const UnitConverter: React.FC = () => {
  const [cat, setCat] = useState('length');
  const active = CATS.find(c => c.key === cat) ?? CATS[0];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {CATS.map(c => (
          <button key={c.key} type="button" onClick={() => setCat(c.key)}
            className={cn('px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200',
              cat === c.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600')}>{c.label}</button>
        ))}
      </div>
      {/* key remounts the converter so from/to units always match the category */}
      <SimpleConverter key={active.key} units={active.units} title={active.label} />
    </div>
  );
};

// ---- Dedicated converters ----
export const LengthConverter: React.FC = () => <SimpleConverter units={LENGTH_UNITS} title="Length" />;
export const PressureConverter: React.FC = () => <SimpleConverter units={PRESSURE_UNITS} title="Pressure" />;
export const VoltageConverter: React.FC = () => <SimpleConverter units={VOLTAGE_UNITS} title="Voltage" />;
export const PowerConverter: React.FC = () => <SimpleConverter units={POWER_UNITS} title="Power" />;
export const SpeedConverter: React.FC = () => <SimpleConverter units={SPEED_UNITS} title="Speed" />;
export const AreaConverter: React.FC = () => <SimpleConverter units={AREA_UNITS} title="Area" />;
export const WeightConverter: React.FC = () => <SimpleConverter units={WEIGHT_UNITS} title="Weight" />;

export { fmt as convFmt, wallToUtc, tzOffsetMin, inZone };
