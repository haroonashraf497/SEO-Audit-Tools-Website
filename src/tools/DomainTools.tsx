import React, { useState } from 'react';

/* Live domain intelligence. All data comes from public, keyless, CORS-enabled
   sources queried straight from the browser:
   • RDAP  (rdap.org)      — registration dates, registrar, status, nameservers, DNSSEC
   • DoH   (dns.google)    — A/AAAA/MX/NS/TXT/SOA/CAA records and DNSBL blacklist lookups
   • ipwho.is              — IP geolocation, ASN and hosting organisation                */

// ---------- shared helpers ----------
const cleanDomain = (v: string) =>
  v.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').replace(/[^a-z0-9.-]+/g, '');

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const ageText = (fromIso: string) => {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return '—';
  const ms = Date.now() - from.getTime();
  if (ms < 0) return 'not yet active';
  const days = Math.floor(ms / 86400000);
  const years = Math.floor(days / 365.25);
  const months = Math.floor((days - years * 365.25) / 30.44);
  const rem = Math.round(days - years * 365.25 - months * 30.44);
  return `${years} yr ${months} mo ${rem} d`;
};

type RdapData = {
  ldhName?: string;
  status?: string[];
  events?: { eventAction: string; eventDate: string }[];
  nameservers?: { ldhName?: string }[];
  entities?: { roles?: string[]; handle?: string; vcardArray?: [string, (string | { [k: string]: string })[][]] }[];
  secureDNS?: { delegationSigned?: boolean; dsData?: unknown[] };
};

const rdapDomain = async (domain: string): Promise<RdapData | null> => {
  const r = await fetch(`https://rdap.org/domain/${domain}`, { headers: { Accept: 'application/rdap+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Registration (RDAP) lookup failed with HTTP ${r.status}.`);
  return (await r.json()) as RdapData;
};

const rdapEvent = (d: RdapData, action: string) => d.events?.find(e => e.eventAction === action)?.eventDate;

const rdapRegistrar = (d: RdapData) => {
  const e = d.entities?.find(x => x.roles?.includes('registrar'));
  if (!e) return '—';
  const fn = e.vcardArray?.[1]?.find(c => c[0] === 'fn');
  const val = fn?.[1];
  return typeof val === 'string' ? val : e.handle || '—';
};

type DohAnswer = { name: string; type: number; TTL: number; data: string };
const doh = async (name: string, type: string): Promise<DohAnswer[]> => {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
  if (!r.ok) throw new Error(`DNS lookup failed with HTTP ${r.status}.`);
  const j = (await r.json()) as { Answer?: DohAnswer[] };
  return j.Answer ?? [];
};

type IpIntel = {
  ip: string;
  country?: string;
  city?: string;
  region?: string;
  connection?: { org?: string; isp?: string; asn?: number };
};
const ipWhoIs = async (ip: string): Promise<IpIntel | null> => {
  try {
    const r = await fetch(`https://ipwho.is/${ip}`);
    if (!r.ok) return null;
    const j = (await r.json()) as IpIntel & { success?: boolean };
    return j.success === false ? null : j;
  } catch { return null; }
};

const fail = (e: unknown) => (e instanceof Error ? e.message : 'The lookup failed. Check the name and your connection, then try again.');

// ---------- UI kit ----------
const Icon: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);
const ic = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />,
  shieldCheck: <><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  map: <><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><path d="M7.5 8.5h.01" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  gauge: <><path d="M4 14a8 8 0 0 1 16 0" /><path d="M12 14l4-4" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 3v6h-6" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
};

const Spinner: React.FC = () => <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" aria-hidden="true" />;

const Copy: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${text}`}
      onClick={() => { void navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className={`shrink-0 text-slate-300 hover:text-indigo-500 transition-colors ${className}`}
    >
      <Icon className="w-4 h-4">{ok ? <path d="M20 6L9 17l-5-5" /> : ic.copy}</Icon>
    </button>
  );
};

const SearchBar: React.FC<{ ph: string; cta: string; busy: boolean; onRun: (v: string) => void; samples?: string[]; icon?: React.ReactNode; label?: string }> = ({ ph, cta, busy, onRun, samples, icon, label }) => {
  const [v, setV] = useState('');
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row gap-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all">
        <div className="flex items-center gap-3 flex-1 px-3 min-w-0">
          <span className="text-indigo-500 shrink-0">{icon ?? <Icon className="w-5 h-5">{ic.globe}</Icon>}</span>
          <input
            value={v}
            onChange={e => setV(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !busy && v.trim()) onRun(v); }}
            placeholder={ph}
            aria-label={label || ph}
            className="w-full py-3 bg-transparent outline-none text-sm font-mono text-slate-800 placeholder:text-slate-400 placeholder:font-sans"
          />
        </div>
        <button
          type="button"
          onClick={() => v.trim() && onRun(v)}
          disabled={busy || !v.trim()}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <><Spinner /> Looking up…</> : <>{cta} <Icon>{ic.arrow}</Icon></>}
        </button>
      </div>
      {samples && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-slate-400 font-semibold">Try:</span>
          {samples.map(s => (
            <button key={s} type="button" disabled={busy} onClick={() => { setV(s); onRun(s); }}
              className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Skeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse" aria-hidden="true">
    <div className="h-32 rounded-2xl bg-slate-200/70" />
    <div className="grid sm:grid-cols-3 gap-3">
      <div className="h-24 rounded-xl bg-slate-200/60" />
      <div className="h-24 rounded-xl bg-slate-200/60" />
      <div className="h-24 rounded-xl bg-slate-200/60" />
    </div>
  </div>
);

const Hero: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 shadow-lg shadow-indigo-500/20">{children}</div>
);

const Tile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; copy?: string }> = ({ icon, label, value, sub, copy }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center"><Icon className="w-4 h-4">{icon}</Icon></span>
      {copy && <Copy text={copy} />}
    </div>
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-sm font-semibold text-slate-800 leading-snug break-words">{value}</p>
    {sub && <p className="text-xs text-slate-400 -mt-1 break-words">{sub}</p>}
  </div>
);

const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/70">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">{icon && <span className="text-indigo-500"><Icon>{icon}</Icon></span>}{title}</h3>
      {right}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Pill: React.FC<{ tone: 'ok' | 'bad' | 'warn' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = tone === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : tone === 'bad' ? 'bg-red-50 text-red-600 border-red-200'
      : tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-100 text-slate-500 border-slate-200';
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>{children}</span>;
};

const Chip: React.FC<{ children: React.ReactNode; copy?: string }> = ({ children, copy }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-mono text-slate-700">{children}{copy && <Copy text={copy} className="text-slate-400" />}</span>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-500 leading-relaxed">
    <span className="text-slate-400 shrink-0 mt-0.5"><Icon>{ic.shield}</Icon></span>
    <p>{children}</p>
  </div>
);

const ErrBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
    <span className="shrink-0 mt-0.5"><Icon>{ic.alert}</Icon></span>
    <p>{msg}</p>
  </div>
);

const Mono: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 font-mono text-slate-700 break-all">{children}</span>
);

const SAMPLE_DOMAINS = ['google.com', 'wikipedia.org', 'github.com'];

// ---------- Domain Age Checker ----------
const DomainAgeTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ domain: string; d: RdapData | null } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    try { setRes({ domain, d: await rdapDomain(domain) }); }
    catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Check Domain Age" busy={busy} onRun={v => void run(v)} samples={SAMPLE_DOMAINS} icon={<Icon className="w-5 h-5">{ic.calendar}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && !res.d && (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
          <span className="shrink-0 mt-0.5"><Icon className="w-5 h-5">{ic.alert}</Icon></span>
          <p><b>{res.domain}</b> is <b>not registered</b> in its registry’s RDAP service — it has no age and is currently available or dropped.</p>
        </div>
      )}
      {res?.d && (() => {
        const d = res.d;
        const reg = rdapEvent(d, 'registration');
        const exp = rdapEvent(d, 'expiration');
        const changed = rdapEvent(d, 'last changed');
        return (
          <div className="space-y-4">
            <Hero>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Domain age</p>
                  <p className="text-3xl sm:text-4xl font-extrabold mt-1">{reg ? ageText(reg) : '—'}</p>
                  <p className="text-white/80 text-sm mt-2 font-mono">{res.domain}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Registered</p>
                  <p className="text-lg font-bold">{fmtDate(reg)}</p>
                </div>
              </div>
            </Hero>
            <div className="grid sm:grid-cols-3 gap-3">
              <Tile icon={ic.clock} label="Expires" value={fmtDate(exp)} sub={exp && new Date(exp).getTime() < Date.now() ? 'expiry passed' : undefined} />
              <Tile icon={ic.refresh} label="Last updated" value={fmtDate(changed)} />
              <Tile icon={ic.building} label="Registrar" value={rdapRegistrar(d)} />
              <Tile icon={ic.lock} label="DNSSEC" value={d.secureDNS?.delegationSigned ? 'Signed' : 'Not signed'} />
              <div className="sm:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Registry status</p>
                <div className="flex flex-wrap gap-1.5">{d.status?.length ? d.status.map(s => <Chip key={s}>{s}</Chip>) : <span className="text-sm text-slate-400">—</span>}</div>
              </div>
            </div>
            <Card title="Nameservers" icon={ic.server}>
              <div className="flex flex-wrap gap-1.5">
                {d.nameservers?.map(n => n.ldhName).filter(Boolean).map(n => <Chip key={n} copy={n as string}>{n}</Chip>)}
                {!d.nameservers?.length && <span className="text-sm text-slate-400">—</span>}
              </div>
            </Card>
            <Note>Dates come straight from the domain’s registry via RDAP — the protocol that replaced public WHOIS.</Note>
          </div>
        );
      })()}
    </div>
  );
};

// ---------- Domain Authority Checker ----------
const GOOD_TLDS = ['com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'dev', 'app'];
const Gauge: React.FC<{ score: number }> = ({ score }) => {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
        <circle cx="60" cy="60" r={r} strokeWidth="10" className="stroke-white/25" fill="none" />
        <circle cx="60" cy="60" r={r} strokeWidth="10" strokeLinecap="round" fill="none" className="stroke-white" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold">{score}</span>
        <span className="text-[11px] font-semibold text-white/70">/ 100</span>
      </div>
    </div>
  );
};

const DomainAuthorityTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ domain: string; score: number; signals: { name: string; pts: number; max: number; detail: string }[] } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const [d, a, mx, ns, txt, dmarc, ds] = await Promise.all([
        rdapDomain(domain),
        doh(domain, 'A'),
        doh(domain, 'MX'),
        doh(domain, 'NS'),
        doh(domain, 'TXT'),
        doh(`_dmarc.${domain}`, 'TXT'),
        doh(domain, 'DS'),
      ]);
      const reg = d ? rdapEvent(d, 'registration') : undefined;
      const years = reg ? Math.max(0, (Date.now() - new Date(reg).getTime()) / 31557600000) : 0;
      const spf = txt.some(t => /v=spf1/i.test(t.data));
      const tld = domain.split('.').pop() || '';
      const signals = [
        { name: 'Domain age', pts: Math.min(30, Math.round(years)), max: 30, detail: reg ? `${ageText(reg)} — registered ${fmtDate(reg)}` : 'not registered in RDAP' },
        { name: 'Resolves (A record)', pts: a.length ? 10 : 0, max: 10, detail: a.length ? a.map(x => x.data).slice(0, 2).join(', ') : 'no A record' },
        { name: 'Email configured (MX)', pts: mx.length ? 10 : 0, max: 10, detail: mx.length ? mx[0].data : 'no MX record' },
        { name: 'Redundant nameservers', pts: ns.length >= 2 ? 10 : ns.length ? 5 : 0, max: 10, detail: ns.length ? `${ns.length} NS records` : 'no NS records' },
        { name: 'SPF policy', pts: spf ? 10 : 0, max: 10, detail: spf ? 'SPF published in TXT' : 'no SPF TXT record' },
        { name: 'DMARC policy', pts: dmarc.length ? 10 : 0, max: 10, detail: dmarc.length ? dmarc[0].data.replace(/"/g, '') : 'no _dmarc record' },
        { name: 'DNSSEC', pts: (d?.secureDNS?.delegationSigned || ds.length) ? 10 : 0, max: 10, detail: (d?.secureDNS?.delegationSigned || ds.length) ? 'zone is signed' : 'not signed' },
        { name: 'TLD trust tier', pts: GOOD_TLDS.includes(tld) ? 10 : 5, max: 10, detail: `.${tld}` },
      ];
      setRes({ domain, score: signals.reduce((s, x) => s + x.pts, 0), signals });
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Check Authority" busy={busy} onRun={v => void run(v)} samples={SAMPLE_DOMAINS} icon={<Icon className="w-5 h-5">{ic.gauge}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <div className="flex items-center gap-6 flex-wrap">
              <Gauge score={res.score} />
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Estimated authority</p>
                <p className="text-2xl font-extrabold font-mono break-all mt-1">{res.domain}</p>
                <p className="text-white/80 text-sm mt-2">
                  {res.score >= 70 ? 'Strong — long history and a complete, well-configured DNS footprint.' : res.score >= 40 ? 'Moderate — a real footprint with room to harden email and DNS security.' : 'Weak — thin registration history or missing DNS configuration.'}
                </p>
              </div>
            </div>
          </Hero>
          <Card title="Live signals behind the score" icon={ic.list}>
            <div className="divide-y divide-slate-100">
              {res.signals.map(s => (
                <div key={s.name} className="flex items-center justify-between gap-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.pts === s.max ? 'bg-emerald-500' : s.pts ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500 font-mono truncate">{s.detail}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-extrabold shrink-0 ${s.pts === s.max ? 'text-emerald-600' : s.pts ? 'text-amber-600' : 'text-slate-400'}`}>{s.pts}<span className="text-slate-300 font-semibold">/{s.max}</span></span>
                </div>
              ))}
            </div>
          </Card>
          <Note>The score is computed live from the verifiable registration and DNS signals above. Proprietary scores such as Moz “DA” need paid crawl data and cannot be fetched in a browser without an API key.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- Domain IP Lookup ----------
const DomainIpTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ domain: string; rows: { ip: string; info: IpIntel | null; kind: string }[] } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const [a, aaaa] = await Promise.all([doh(domain, 'A'), doh(domain, 'AAAA')]);
      const ips = [...a.map(x => ({ ip: x.data, kind: 'A' })), ...aaaa.map(x => ({ ip: x.data, kind: 'AAAA' }))];
      if (!ips.length) throw new Error(`${domain} has no A or AAAA records — it does not point at any IP address.`);
      const rows = await Promise.all(ips.slice(0, 6).map(async r => ({ ...r, info: await ipWhoIs(r.ip) })));
      setRes({ domain, rows });
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  return (
    <div>
      <SearchBar ph="example.com" cta="Look Up IP" busy={busy} onRun={v => void run(v)} samples={SAMPLE_DOMAINS} icon={<Icon className="w-5 h-5">{ic.map}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {res.rows.map(r => (
              <div key={r.kind + r.ip} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-b border-slate-100">
                  <Mono>{r.ip}</Mono>
                  <span className="flex items-center gap-2">
                    <Pill tone="muted">{r.kind}</Pill>
                    <Copy text={r.ip} />
                  </span>
                </div>
                <div className="p-4 grid gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0"><Icon>{ic.map}</Icon></span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Location</p>
                      <p className="text-sm font-semibold text-slate-800">{r.info ? [r.info.city, r.info.region, r.info.country].filter(Boolean).join(', ') || '—' : '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0"><Icon>{ic.building}</Icon></span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Host / organisation</p>
                      <p className="text-sm font-semibold text-slate-800 break-words">{r.info?.connection?.org || r.info?.connection?.isp || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0"><Icon>{ic.tag}</Icon></span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">ASN</p>
                      <p className="text-sm font-semibold text-slate-800 font-mono">{r.info?.connection?.asn ? `AS${r.info.connection.asn}` : '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Note>Addresses come from live DNS (Google DNS-over-HTTPS); location, organisation and ASN from the ipwho.is network feed.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- Domain Hosting Checker ----------
const DomainHostingTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ domain: string; ns: string[]; soa: string; hosts: (IpIntel | null)[]; ips: string[] } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const [ns, soa, a] = await Promise.all([doh(domain, 'NS'), doh(domain, 'SOA'), doh(domain, 'A')]);
      const ips = a.map(x => x.data).slice(0, 3);
      const hosts = await Promise.all(ips.map(ip => ipWhoIs(ip)));
      setRes({ domain, ns: ns.map(x => x.data.replace(/\.$/, '')), soa: soa[0]?.data || '', hosts, ips });
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  const orgs = [...new Set((res?.hosts || []).map(h => h?.connection?.org || h?.connection?.isp).filter(Boolean))] as string[];
  const asns = [...new Set((res?.hosts || []).map(h => h?.connection?.asn).filter(Boolean))] as number[];
  const countries = [...new Set((res?.hosts || []).map(h => h?.country).filter(Boolean))] as string[];

  return (
    <div>
      <SearchBar ph="example.com" cta="Check Hosting" busy={busy} onRun={v => void run(v)} samples={SAMPLE_DOMAINS} icon={<Icon className="w-5 h-5">{ic.server}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <Hero>
            <p className="text-white/70 text-xs font-bold uppercase tracking-wider">Hosting provider</p>
            <p className="text-2xl sm:text-3xl font-extrabold mt-1 break-words">{orgs.length ? orgs.join(' · ') : 'Unknown provider'}</p>
            <p className="text-white/80 text-sm mt-2 font-mono">{res.domain}</p>
          </Hero>
          <div className="grid sm:grid-cols-3 gap-3">
            <Tile icon={ic.tag} label="ASN" value={asns.length ? asns.map(a => `AS${a}`).join(', ') : '—'} />
            <Tile icon={ic.map} label="Server location" value={countries.length ? countries.join(', ') : '—'} />
            <Tile icon={ic.globe} label="IP addresses" value={res.ips.length ? res.ips.join(', ') : 'none'} copy={res.ips.join(', ') || undefined} />
          </div>
          <Card title="Nameservers" icon={ic.server}>
            <div className="flex flex-wrap gap-1.5">
              {res.ns.length ? res.ns.map(n => <Chip key={n} copy={n}>{n}</Chip>) : <span className="text-sm text-slate-400">—</span>}
            </div>
          </Card>
          <Card title="SOA record" icon={ic.list} right={<Copy text={res.soa} />}>
            <p className="text-sm font-mono text-slate-700 break-words">{res.soa ? res.soa.replace(/\s+/g, ' ') : '—'}</p>
          </Card>
          <Note>Provider, ASN and location are resolved live from the domain’s A records via the ipwho.is network feed.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- Find DNS Records ----------
const DNS_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'SOA', 'CAA'] as const;
const DnsRecordsTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ domain: string; sections: { type: string; rows: DohAnswer[] }[] } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const sections = await Promise.all(DNS_TYPES.map(async type => ({ type, rows: await doh(domain, type) })));
      setRes({ domain, sections });
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  const found = res?.sections.filter(s => s.rows.length).length ?? 0;

  return (
    <div>
      <SearchBar ph="example.com" cta="Find DNS Records" busy={busy} onRun={v => void run(v)} samples={SAMPLE_DOMAINS} icon={<Icon className="w-5 h-5">{ic.list}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-700 font-mono">{res.domain}</span>
            <Pill tone={found ? 'ok' : 'warn'}>{found ? `${found} of ${res.sections.length} record types found` : 'no records found'}</Pill>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {res.sections.map(s => (
              <Card
                key={s.type}
                title={s.type}
                icon={ic.list}
                right={s.rows.length ? <Pill tone="ok">{s.rows.length}</Pill> : <Pill tone="muted">none</Pill>}
              >
                {s.rows.length ? (
                  <div className="space-y-2">
                    {s.rows.map((r, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 group">
                        <p className="text-sm font-mono text-slate-700 break-all">{r.data}</p>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">TTL {r.TTL}s</span>
                          <Copy text={r.data} />
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No {s.type} records published.</p>
                )}
              </Card>
            ))}
          </div>
          <Note>Queried live over DNS-over-HTTPS (Google). CNAME only appears for aliased names, so it is omitted when absent.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- Domain Name Search (real availability via RDAP) ----------
const SEARCH_TLDS = ['.com', '.net', '.org', '.co', '.io', '.info', '.biz', '.online', '.store', '.site', '.dev', '.app'];
const DomainSearchTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<{ domain: string; state: 'available' | 'registered' | 'error' }[]>([]);

  const run = async (v: string) => {
    const k = v.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!k) return;
    setBusy(true); setErr(''); setRows([]);
    try {
      const out = await Promise.all(SEARCH_TLDS.map(async tld => {
        const domain = k + tld;
        try { return { domain, state: (await rdapDomain(domain)) ? 'registered' as const : 'available' as const }; }
        catch { return { domain, state: 'error' as const }; }
      }));
      setRows(out);
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  const avail = rows.filter(r => r.state === 'available').length;
  const taken = rows.filter(r => r.state === 'registered').length;

  return (
    <div>
      <SearchBar ph="mynewbusiness" cta="Search Domains" busy={busy} onRun={v => void run(v)} samples={['coffeeshop', 'travelguide', 'devstudio']} label="keyword" icon={<Icon className="w-5 h-5">{ic.search}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Pill tone="ok">{avail} available</Pill>
            <Pill tone="bad">{taken} registered</Pill>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {rows.map(r => (
              <div key={r.domain} className={`flex items-center justify-between px-4 py-3 text-sm border-l-4 ${r.state === 'available' ? 'border-l-emerald-400 bg-emerald-50/40' : r.state === 'registered' ? 'border-l-slate-200' : 'border-l-amber-300'}`}>
                <span className="font-mono text-slate-800">{r.domain}</span>
                {r.state === 'available' && <Pill tone="ok"><Icon className="w-3 h-3">{ic.check}</Icon> Available to register</Pill>}
                {r.state === 'registered' && <Pill tone="bad">Already registered</Pill>}
                {r.state === 'error' && <Pill tone="warn">registry unreachable</Pill>}
              </div>
            ))}
          </div>
          <Note>Availability is checked against each TLD’s registry RDAP service in real time: no registration record means the name is unregistered. Premium and aftermarket listings are not detectable without registrar APIs.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- Blacklist Lookup (live DNSBL queries) ----------
const IP_BLS = ['zen.spamhaus.org', 'bl.spamcop.net', 'dnsbl.sorbs.net', 'psbl.surriel.com', 'ubl.unsubscore.com', 'blacklist.uceprotect.net'];
const BlacklistTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ target: string; ip: string | null; rows: { list: string; code: string | null; failed?: boolean }[] } | null>(null);

  const run = async (v: string) => {
    const domain = cleanDomain(v);
    if (!domain) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      let ip: string | null = /^\d{1,3}(\.\d{1,3}){3}$/.test(domain) ? domain : null;
      if (!ip) {
        const a = await doh(domain, 'A');
        ip = a[0]?.data ?? null;
        if (!ip) throw new Error(`${domain} has no A record, so there is no IP to check against the blacklists.`);
      }
      const rev = ip.split('.').reverse().join('.');
      const queries = [...IP_BLS.map(l => ({ q: `${rev}.${l}`, list: l })), { q: `${domain}.dbl.spamhaus.org`, list: 'dbl.spamhaus.org (domain)' }];
      const rows = await Promise.all(queries.map(async ({ q, list }) => {
        try {
          const ans = await doh(q, 'A');
          return { list, code: ans[0]?.data ?? null };
        } catch { return { list, code: null, failed: true }; }
      }));
      setRes({ target: domain, ip, rows });
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  const listed = res?.rows.filter(r => r.code).length ?? 0;

  return (
    <div>
      <SearchBar ph="example.com or 1.2.3.4" cta="Check Blacklists" busy={busy} onRun={v => void run(v)} samples={SAMPLE_DOMAINS} icon={<Icon className="w-5 h-5">{ic.shield}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {res && (
        <div className="space-y-4">
          <div className={`rounded-2xl p-6 text-white shadow-lg flex items-center gap-5 ${listed ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/20' : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20'}`}>
            <span className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Icon className="w-7 h-7">{listed ? ic.alert : ic.shieldCheck}</Icon>
            </span>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-extrabold">{listed ? `Listed on ${listed} of ${res.rows.length} lists` : 'Clean — not listed'}</p>
              <p className="text-white/80 text-sm mt-1 font-mono break-all">{res.target}{res.ip ? ` · ${res.ip}` : ''}</p>
            </div>
          </div>
          <Card title="Per-list results" icon={ic.shield}>
            <div className="divide-y divide-slate-100">
              {res.rows.map(r => (
                <div key={r.list} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm font-mono text-slate-700 break-all">{r.list}</span>
                  {r.failed ? <Pill tone="warn">query failed</Pill>
                    : r.code ? <Pill tone="bad">listed · {r.code}</Pill>
                      : <Pill tone="ok"><Icon className="w-3 h-3">{ic.check}</Icon> not listed</Pill>}
                </div>
              ))}
            </div>
          </Card>
          <Note>Checks run as genuine DNSBL lookups over DNS-over-HTTPS: the reversed IP (plus the domain at Spamhaus DBL) is queried inside each blacklist zone; a returned 127.x code means listed. Queries via public resolvers can be rate-limited by some list operators.</Note>
        </div>
      )}
    </div>
  );
};

// ---------- Expired Domain Tool (real registry status) ----------
const EXP_TLDS = ['.com', '.net', '.org', '.info', '.co', '.io', '.biz', '.online'];
const ExpiredDomainsTool: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<{ domain: string; state: string; detail: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }[]>([]);

  const run = async (v: string) => {
    const k = v.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!k) return;
    setBusy(true); setErr(''); setRows([]);
    try {
      const out = await Promise.all(EXP_TLDS.map(async tld => {
        const domain = k + tld;
        try {
          const d = await rdapDomain(domain);
          if (!d) return { domain, state: 'Dropped / available', detail: 'no registration record — the name is free to register', tone: 'ok' as const };
          const exp = rdapEvent(d, 'expiration');
          const st = (d.status || []).join(' ').toLowerCase();
          if (/pendingdelete|redemption|pendingrestore/.test(st)) return { domain, state: 'Expired — pending delete', detail: `status: ${d.status?.join(', ')}`, tone: 'warn' as const };
          if (exp && new Date(exp).getTime() < Date.now()) return { domain, state: 'Past expiry date', detail: `expired ${fmtDate(exp)} — likely lapsing or in grace`, tone: 'warn' as const };
          return { domain, state: 'Registered (active)', detail: `expires ${fmtDate(exp)}`, tone: 'muted' as const };
        } catch { return { domain, state: 'Registry unreachable', detail: 'try again later', tone: 'bad' as const }; }
      }));
      setRows(out);
    } catch (e) { setErr(fail(e)); }
    setBusy(false);
  };

  const dropped = rows.filter(r => r.tone === 'ok').length;
  const expiring = rows.filter(r => r.tone === 'warn').length;

  return (
    <div>
      <SearchBar ph="e.g. techblog" cta="Find Expired Domains" busy={busy} onRun={v => void run(v)} samples={['techblog', 'fitlife', 'craftshop']} label="keyword" icon={<Icon className="w-5 h-5">{ic.clock}</Icon>} />
      {busy && <Skeleton />}
      {err && <ErrBox msg={err} />}
      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Pill tone="ok">{dropped} dropped / available</Pill>
            <Pill tone="warn">{expiring} expiring or pending delete</Pill>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {rows.map(r => (
              <div key={r.domain} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm border-l-4 ${r.tone === 'ok' ? 'border-l-emerald-400 bg-emerald-50/40' : r.tone === 'warn' ? 'border-l-amber-300 bg-amber-50/40' : r.tone === 'bad' ? 'border-l-red-300' : 'border-l-slate-200'}`}>
                <div className="min-w-0">
                  <p className="font-mono text-slate-800">{r.domain}</p>
                  <p className="text-xs text-slate-500 truncate">{r.detail}</p>
                </div>
                <span className={`shrink-0 text-xs font-extrabold ${r.tone === 'ok' ? 'text-emerald-600' : r.tone === 'warn' ? 'text-amber-600' : r.tone === 'bad' ? 'text-red-500' : 'text-slate-400'}`}>{r.state}</span>
              </div>
            ))}
          </div>
          <Note>Each candidate is checked against its registry’s RDAP service: dropped names, pending-delete and past-expiry domains are flagged from live status codes and dates. Re-verify an expired name’s backlink profile before purchase — it can change hands.</Note>
        </div>
      )}
    </div>
  );
};

export { DomainAgeTool, DomainAuthorityTool, DomainIpTool, DomainHostingTool, DnsRecordsTool, DomainSearchTool, BlacklistTool, ExpiredDomainsTool, rdapDomain, rdapEvent, ageText, fmtDate };
