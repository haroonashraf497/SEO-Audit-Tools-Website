import React, { useMemo, useState } from 'react';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block"><span className="text-sm font-semibold text-slate-700 block mb-1">{label}</span>{children}</label>
);
const Input: React.FC<{ value: string; onChange: (v: string) => void; className?: string; placeholder?: string }> = ({ value, onChange, className = '', placeholder }) => (
  <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 ${className}`} />
);
const Result: React.FC<{ label: string; value: string; emphasis?: boolean }> = ({ label, value, emphasis }) => (
  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">{label}</p><p className={emphasis ? 'text-xl font-bold text-indigo-600' : 'text-lg font-bold text-slate-800'}>{value}</p></div>
);
const cn = (...cls: (string | boolean | undefined)[]) => cls.filter(Boolean).join(' ');

interface UnitEntry { symbol: string; name: string; toBase: number } // toBase = multiply by this to get the base unit

// ---- Length Converter ----
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

// ---- Temperature (special: not multiplicative) ----
const tempToC = (v: number, unit: string): number => {
  if (unit === 'C') return v;
  if (unit === 'F') return (v - 32) * 5 / 9;
  return v - 273.15;
};
const tempFromC = (c: number, unit: string): number => {
  if (unit === 'C') return c;
  if (unit === 'F') return c * 9 / 5 + 32;
  return c + 273.15;
};
const TEMP_UNITS: { symbol: string; name: string; color: string }[] = [
  { symbol: 'C', name: 'Celsius', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { symbol: 'F', name: 'Fahrenheit', color: 'bg-red-50 border-red-200 text-red-800' },
  { symbol: 'K', name: 'Kelvin', color: 'bg-violet-50 border-violet-200 text-violet-800' },
];

// ---- Pressure ----
const PRESSURE: UnitEntry[] = [
  { symbol: 'Pa', name: 'Pascals', toBase: 1 },
  { symbol: 'kPa', name: 'Kilopascals', toBase: 1000 },
  { symbol: 'bar', name: 'Bar', toBase: 100000 },
  { symbol: 'atm', name: 'Atmospheres', toBase: 101325 },
  { symbol: 'psi', name: 'PSI', toBase: 6894.76 },
  { symbol: 'mmHg', name: 'mmHg', toBase: 133.322 },
  { symbol: 'torr', name: 'Torr', toBase: 133.322 },
];

const VOLTAGE: UnitEntry[] = [
  { symbol: 'V', name: 'Volts', toBase: 1 },
  { symbol: 'mV', name: 'Millivolts', toBase: 0.001 },
  { symbol: 'kV', name: 'Kilovolts', toBase: 1000 },
  { symbol: 'μV', name: 'Microvolts', toBase: 0.000001 },
];

const POWER: UnitEntry[] = [
  { symbol: 'W', name: 'Watts', toBase: 1 },
  { symbol: 'kW', name: 'Kilowatts', toBase: 1000 },
  { symbol: 'hp', name: 'Horsepower', toBase: 745.7 },
  { symbol: 'BTU/h', name: 'BTU per hour', toBase: 0.293071 },
];

const SPEED: UnitEntry[] = [
  { symbol: 'km/h', name: 'Kilometres per hour', toBase: 1 },
  { symbol: 'mph', name: 'Miles per hour', toBase: 1.609344 },
  { symbol: 'm/s', name: 'Metres per second', toBase: 3.6 },
  { symbol: 'kn', name: 'Knots', toBase: 1.852 },
  { symbol: 'ft/s', name: 'Feet per second', toBase: 1.09728 },
];

const AREA: UnitEntry[] = [
  { symbol: 'mm²', name: 'Square mm', toBase: 0.000001 },
  { symbol: 'cm²', name: 'Square cm', toBase: 0.0001 },
  { symbol: 'm²', name: 'Square metres', toBase: 1 },
  { symbol: 'km²', name: 'Square km', toBase: 1000000 },
  { symbol: 'ft²', name: 'Square feet', toBase: 0.092903 },
  { symbol: 'yd²', name: 'Square yards', toBase: 0.836127 },
  { symbol: 'ac', name: 'Acres', toBase: 4046.86 },
  { symbol: 'ha', name: 'Hectares', toBase: 10000 },
];

const WEIGHT: UnitEntry[] = [
  { symbol: 'mg', name: 'Milligrams', toBase: 0.001 },
  { symbol: 'g', name: 'Grams', toBase: 1 },
  { symbol: 'kg', name: 'Kilograms', toBase: 1000 },
  { symbol: 'lb', name: 'Pounds', toBase: 453.592 },
  { symbol: 'oz', name: 'Ounces', toBase: 28.3495 },
  { symbol: 'st', name: 'Stones', toBase: 6350.29 },
];

const TIME_ZONES: { id: string; label: string; offset: number }[] = [
  { id: 'Pacific/Auckland', label: 'New Zealand', offset: 12 },
  { id: 'Australia/Sydney', label: 'Australia', offset: 10 },
  { id: 'Asia/Tokyo', label: 'Japan', offset: 9 },
  { id: 'Asia/Shanghai', label: 'China', offset: 8 },
  { id: 'Asia/Singapore', label: 'Singapore', offset: 8 },
  { id: 'Asia/Kolkata', label: 'India', offset: 5.5 },
  { id: 'Asia/Dubai', label: 'Dubai', offset: 4 },
  { id: 'Europe/Moscow', label: 'Moscow', offset: 3 },
  { id: 'Europe/Istanbul', label: 'Istanbul', offset: 3 },
  { id: 'Europe/London', label: 'London (GMT)', offset: 0 },
  { id: 'Europe/Paris', label: 'Paris / Berlin', offset: 1 },
  { id: 'Africa/Cairo', label: 'Cairo', offset: 2 },
  { id: 'America/New_York', label: 'New York (ET)', offset: -5 },
  { id: 'America/Chicago', label: 'Chicago (CT)', offset: -6 },
  { id: 'America/Denver', label: 'Denver (MT)', offset: -7 },
  { id: 'America/Los_Angeles', label: 'Los Angeles (PT)', offset: -8 },
  { id: 'Pacific/Honolulu', label: 'Hawaii', offset: -10 },
];

// Generic unit converter component
const UnitConversionTable: React.FC<{ units: UnitEntry[] }> = ({ units }) => {
  const [fromUnit, setFromUnit] = useState(units[0].symbol);
  const [toUnit, setToUnit] = useState(units[1]?.symbol || units[0].symbol);
  const [value, setValue] = useState('1');
  const result = useMemo(() => {
    const v = Number(value); if (isNaN(v)) return null;
    const fromEntry = units.find(u => u.symbol === fromUnit);
    const toEntry = units.find(u => u.symbol === toUnit);
    if (!fromEntry || !toEntry) return null;
    const base = v * fromEntry.toBase;
    const converted = base / toEntry.toBase;
    const factor = fromEntry.toBase / toEntry.toBase;
    return { converted, factor, value: v, from: fromUnit, to: toUnit };
  }, [value, fromUnit, toUnit]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div>
          <Field label="From"><select value={fromUnit} onChange={e => setFromUnit(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none">{units.map(u => <option key={u.symbol} value={u.symbol}>{u.name} ({u.symbol})</option>)}</select></Field>
          <Input value={value} onChange={setValue} placeholder="Enter value" />
        </div>
        <div className="pb-6 text-2xl text-slate-500 font-bold">→</div>
        <div>
          <Field label="To"><select value={toUnit} onChange={e => setToUnit(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none">{units.map(u => <option key={u.symbol} value={u.symbol}>{u.name} ({u.symbol})</option>)}</select></Field>
          <Result label={`Result in ${toUnit}`} value={result ? result.converted.toPrecision(8).replace(/\.?0+$/, '') : '—'} emphasis />
        </div>
      </div>
      {result && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p className="text-xs text-slate-500 mb-2">1 {fromUnit} = {result.factor.toPrecision(6)} {toUnit}</p>
          <div className="flex flex-wrap gap-1.5">
            {units.map(u => (
              <button key={u.symbol} type="button" onClick={() => { setFromUnit(fromUnit); setToUnit(u.symbol); }} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">{u.symbol}: {(result.value * (units.find(u => u.symbol === fromUnit)?.toBase || 1) / (u.toBase)).toPrecision(4)}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Temperature Converter ----
export const TempConverter: React.FC = () => {
  const [fromUnit, setFromUnit] = useState('C');
  const [value, setValue] = useState('100');
  const celsius = tempToC(Number(value) || 0, fromUnit);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div>
          <Field label="From"><select value={fromUnit} onChange={e => setFromUnit(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none">{TEMP_UNITS.map(u => <option key={u.symbol} value={u.symbol}>{u.name} ({u.symbol}°)</option>)}</select></Field>
          <Input value={value} onChange={setValue} placeholder="Enter temperature" />
        </div>
        <div className="pb-6 text-2xl text-slate-500 font-bold">→</div>
        <div className="space-y-2">
          {TEMP_UNITS.filter(u => u.symbol !== fromUnit).map(u => (
            <Result key={u.symbol} label={`${u.name} (${u.symbol}°)`} value={tempFromC(celsius, u.symbol).toFixed(2) + '°'} emphasis />
          ))}
        </div>
      </div>
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-3 gap-3 text-center text-sm">
        <div><p className="text-xs text-slate-500">Freezing point of water</p><p className="font-bold text-slate-700">0°C / 32°F / 273K</p></div>
        <div><p className="text-xs text-slate-500">Boiling point of water</p><p className="font-bold text-slate-700">100°C / 212°F / 373K</p></div>
        <div><p className="text-xs text-slate-500">Body temperature</p><p className="font-bold text-slate-700">37°C / 98.6°F / 310K</p></div>
      </div>
    </div>
  );
};

// ---- Time Zone Converter ----
export const TimezoneConverter: React.FC = () => {
  const [from, setFrom] = useState('Europe/London');
  const [to, setTo] = useState('America/New_York');
  const [time, setTime] = useState('12:00');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const result = useMemo(() => {
    try {
      const d = new Date(`${date}T${time}:00`);
      const fromTz = TIME_ZONES.find(t => t.id === from);
      const toTz = TIME_ZONES.find(t => t.id === to);
      if (!fromTz || !toTz) return null;
      const fromOffsetMs = fromTz.offset * 3600000;
      const toOffsetMs = toTz.offset * 3600000;
      const utcTime = d.getTime() - fromOffsetMs;
      const destTime = new Date(utcTime + toOffsetMs);
      return { fromFormatted: d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: from }), toFormatted: destTime.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: to }), offsetDiff: toTz.offset - fromTz.offset };
    } catch { return null; }
  }, [from, to, time, date]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <div><Field label="From timezone"><select value={from} onChange={e => setFrom(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none">{TIME_ZONES.map(z => <option key={z.id} value={z.id}>{z.label} (UTC{z.offset >= 0 ? '+' : ''}{z.offset})</option>)}</select></Field>
        <Field label="Time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none" /></Field>
        <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none" /></Field></div>
        <div className="pb-6 text-2xl text-slate-500 font-bold">→</div>
        <div><Field label="To timezone"><select value={to} onChange={e => setTo(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm bg-white outline-none">{TIME_ZONES.map(z => <option key={z.id} value={z.id}>{z.label} (UTC{z.offset >= 0 ? '+' : ''}{z.offset})</option>)}</select></Field></div>
      </div>
      {result && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white space-y-2">
          <p className="text-white text-sm">From {TIME_ZONES.find(t => t.id === from)?.label}</p>
          <p className="text-2xl font-bold">{result.fromFormatted}</p>
          <div className="text-xl text-white my-2">↓ {result.offsetDiff >= 0 ? '+' : ''}{result.offsetDiff} hours</div>
          <p className="text-white text-sm">To {TIME_ZONES.find(t => t.id === to)?.label}</p>
          <p className="text-2xl font-bold">{result.toFormatted}</p>
        </div>
      )}
    </div>
  );
};

// ---- Universal Unit Converter ----
const ALL_CONVERSIONS: Record<string, UnitEntry[]> = { length: LENGTH_UNITS, pressure: PRESSURE, voltage: VOLTAGE, power: POWER, speed: SPEED, area: AREA, weight: WEIGHT };
export const UnitConverter: React.FC = () => {
  const [cat, setCat] = useState<string>('length');
  const keys = Object.keys(ALL_CONVERSIONS);
  const units = ALL_CONVERSIONS[cat] || LENGTH_UNITS;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">{keys.map(k => <button key={k} type="button" onClick={() => setCat(k)} className={cn('px-4 py-2 rounded-full text-sm font-semibold capitalize transition-colors', cat === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700')}>{k}</button>)}</div>
      <UnitConversionTable units={units} />
    </div>
  );
};

// ---- Dedicated converters (simple wrappers) ----
export const LengthConverter: React.FC = () => <UnitConversionTable units={LENGTH_UNITS} />;
export const PressureConverter: React.FC = () => <UnitConversionTable units={PRESSURE} />;
export const VoltageConverter: React.FC = () => <UnitConversionTable units={VOLTAGE} />;
export const PowerConverter: React.FC = () => <UnitConversionTable units={POWER} />;
export const SpeedConverter: React.FC = () => <UnitConversionTable units={SPEED} />;
export const AreaConverter: React.FC = () => <UnitConversionTable units={AREA} />;
export const WeightConverter: React.FC = () => <UnitConversionTable units={WEIGHT} />;
