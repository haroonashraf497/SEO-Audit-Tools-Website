import React, { useEffect, useMemo, useState } from 'react';
import { PrimaryBtn } from './engines';
import {
  getMyIp, lookupIp, isValidIp, isPrivateIp, detectVersion, distanceKm,
  ipToNumber, classOf, flagEmoji,
  resolveA, resolvePtr, toIpv4, reverseIpDomains, ipWhois,
  fetchProxyList, fetchProxyStats, checkedAgo, PROXY_PROTOCOLS,
  type IpInfo, type IpWhois, type ProxyEntry, type ProxyStats, type ProxyProtocol,
} from '../utils/ipLookup';

/*
  IP Tools — every result below comes from a live, keyless source. Nothing is
  simulated. When a source is unreachable the tool says so instead of inventing
  data.
    • Public IP        → ipify
    • Geolocation      → ipwho.is / ipapi.co / freeipapi.com (layered fallbacks)
    • DNS (A/AAAA/PTR) → DNS-over-HTTPS (dns.google, cloudflare-dns)
    • Reverse IP       → HackerTarget passive DNS (through a CORS relay)
    • Proxy list       → ProxyScrape free list mirrored on jsDelivr
    • IP WHOIS         → RDAP (regional registries via rdap.org)
*/

// ---------- Icons ----------
const Icon: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);
const ic = {
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15.3 15.3 0 0 1 0 18M12 3a15.3 15.3 0 0 0 0 18" /></>,
  pin: <><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  shield: <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" />,
  shieldCheck: <><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  refresh: <><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 3v6h-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  monitor: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5v5M12 12.5l-6 5M12 12.5l6 5" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15h6M9 18h4" /></>,
};

// ---------- Shared UI ----------
const InfoGrid: React.FC<{ rows: [string, React.ReactNode][]; cols?: 2 | 3 }> = ({ rows, cols = 2 }) => (
  <div className={`grid gap-3 ${cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
    {rows.filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([label, value]) => (
      <div key={label} className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-800 break-words">{value}</p>
      </div>
    ))}
  </div>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; badge?: React.ReactNode }> = ({ title, icon, children, badge }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
    <div className="flex items-center justify-between gap-3 mb-4">
      <h3 className="heading-card font-bold text-slate-900 flex items-center gap-2">
        {icon && <Icon className="w-4.5 h-4.5 text-indigo-500">{icon}</Icon>}{title}
      </h3>
      {badge}
    </div>
    {children}
  </div>
);

const StatCard: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent' }> = ({ label, value, sub, tone = 'default' }) => {
  const tones = {
    default: 'text-slate-800', good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-red-600', accent: 'text-indigo-600',
  };
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${tones[tone]} truncate`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
};

const LiveBadge: React.FC<{ source?: string }> = ({ source }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-0.5 whitespace-nowrap">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live{source ? ` · ${source}` : ''}
  </span>
);

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 text-sm text-slate-600 py-8 justify-center">
    <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    {label}
  </div>
);

const ErrBox: React.FC<{ msg: string; onRetry?: () => void }> = ({ msg, onRetry }) => (
  <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
    <Icon className="w-4 h-4 mt-0.5 shrink-0">{ic.alert}</Icon>
    <span className="flex-1">{msg}</span>
    {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline shrink-0">Retry</button>}
  </div>
);

const CopyBtn: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label, className = '' }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${className}`}
    >
      <Icon className="w-3.5 h-3.5">{done ? ic.check : ic.copy}</Icon>{done ? 'Copied!' : label || 'Copy'}
    </button>
  );
};

const CopyableIp: React.FC<{ ip: string; label: string; dark?: boolean }> = ({ ip, label, dark }) => (
  <div className={`rounded-2xl p-6 text-white ${dark ? 'bg-slate-900' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
    <p className={`${dark ? 'text-slate-400' : 'text-indigo-100'} text-sm mb-1`}>{label}</p>
    <div className="flex flex-wrap items-center gap-3">
      <p className={`font-bold font-mono break-all ${dark ? 'text-xl' : 'text-3xl md:text-4xl'}`}>{ip || 'Not detected'}</p>
      {ip && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(ip)}
          className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold transition-colors"
        >Copy</button>
      )}
    </div>
  </div>
);

const MapEmbed: React.FC<{ lat: number; lon: number; label: string }> = ({ lat, lon, label }) => {
  const [show, setShow] = useState(false);
  const d = 0.08;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  if (!show) {
    return (
      <button type="button" onClick={() => setShow(true)}
        className="w-full h-56 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
        <Icon className="w-8 h-8 text-indigo-500">{ic.pin}</Icon>
        <span className="text-sm font-semibold text-slate-700">Show on map</span>
        <span className="text-xs text-slate-400">{lat.toFixed(4)}, {lon.toFixed(4)} · loads OpenStreetMap on click</span>
      </button>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <iframe title={`Map of ${label}`} loading="lazy" className="w-full h-56"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`} />
      <a className="block text-[11px] text-slate-500 text-right px-3 py-1.5 bg-slate-50 hover:text-indigo-600"
        target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`}>
        View larger map ↗
      </a>
    </div>
  );
};

const localTime = (tz: string) => { try { return new Date().toLocaleString('en-GB', { timeZone: tz }); } catch { return ''; } };

const geoRows = (info: IpInfo): [string, React.ReactNode][] => [
  ['IP Address', <span className="font-mono">{info.ip}</span>],
  ['IP Version', info.version],
  ['City', info.city],
  ['Region / State', info.region ? `${info.region}${info.regionCode ? ' (' + info.regionCode + ')' : ''}` : ''],
  ['Country', info.country ? `${flagEmoji(info.countryCode)} ${info.country} (${info.countryCode})` : ''],
  ['Continent', info.continent],
  ['Postal Code', info.postal],
  ['Latitude', info.latitude !== null ? info.latitude.toFixed(4) : ''],
  ['Longitude', info.longitude !== null ? info.longitude.toFixed(4) : ''],
  ['Timezone', info.timezone ? `${info.timezone}${info.utcOffset ? ' (UTC ' + info.utcOffset + ')' : ''}` : ''],
  ['Local Time', info.timezone ? localTime(info.timezone) : ''],
  ['ISP', info.isp],
  ['Organization', info.org && info.org !== info.isp ? info.org : ''],
  ['ASN', info.asn],
  ['Hostname', info.hostname],
  ['Currency', info.currency],
  ['Calling Code', info.callingCode],
  ['Languages', info.languages],
  ['Country Capital', info.capital],
  ['Bordering Countries', info.borders ? info.borders.split(',').map(c => `${flagEmoji(c.trim())} ${c.trim()}`).join('  ') : ''],
  ['In European Union', info.isEU === null ? '' : info.isEU ? 'Yes' : 'No'],
];

const whoisRows = (w: IpWhois): [string, React.ReactNode][] => [
  ['Network Name', w.name],
  ['Handle', w.handle ? <span className="font-mono">{w.handle}</span> : ''],
  ['CIDR Block', w.cidr ? <span className="font-mono">{w.cidr}</span> : ''],
  ['Range', w.startAddress && w.endAddress ? <span className="font-mono">{w.startAddress} – {w.endAddress}</span> : ''],
  ['Allocation Type', w.type],
  ['Registry Country', w.country ? `${flagEmoji(w.country)} ${w.country}` : ''],
  ['Registrant Org', w.org],
  ['Abuse Email', w.abuseEmail ? <a className="text-indigo-600 hover:underline" href={`mailto:${w.abuseEmail}`}>{w.abuseEmail}</a> : ''],
  ['Abuse Phone', w.abusePhone],
  ['Registered', w.registered ? new Date(w.registered).toLocaleDateString('en-GB') : ''],
  ['Last Changed', w.changed ? new Date(w.changed).toLocaleDateString('en-GB') : ''],
];

/** Fetch reverse DNS + WHOIS for an IP in parallel (both optional / non-fatal). */
const useIpExtras = (ip: string | null) => {
  const [ptr, setPtr] = useState<string[]>([]);
  const [whois, setWhois] = useState<IpWhois | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setPtr([]); setWhois(null);
    if (!ip || !isValidIp(ip) || isPrivateIp(ip)) return;
    setLoading(true);
    Promise.all([resolvePtr(ip).catch(() => []), ipWhois(ip).catch(() => null)]).then(([p, w]) => {
      if (!alive) return;
      setPtr(p); setWhois(w); setLoading(false);
    });
    return () => { alive = false; };
  }, [ip]);
  return { ptr, whois, loading };
};

// ---------- 1. What is my IP ----------
export const WhatIsMyIp: React.FC = () => {
  const [ips, setIps] = useState<{ v4: string; v6: string } | null>(null);
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true); setFailed(false);
    const [my, geo] = await Promise.all([getMyIp(), lookupIp('')]);
    setIps(my); setInfo(geo);
    if (!my.v4 && !my.v6 && !geo) setFailed(true);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const myIp = ips?.v4 || (info?.version === 'IPv4' ? info.ip : '') || '';
  const { ptr, whois } = useIpExtras(myIp || null);

  const browser = useMemo(() => {
    if (typeof navigator === 'undefined') return [] as [string, string][];
    const ua = navigator.userAgent;
    const name = /edg\//i.test(ua) ? 'Microsoft Edge' : /opr\//i.test(ua) ? 'Opera' : /chrome|crios/i.test(ua) ? 'Google Chrome' : /firefox|fxios/i.test(ua) ? 'Mozilla Firefox' : /safari/i.test(ua) ? 'Safari' : 'Unknown';
    const os = /windows/i.test(ua) ? 'Windows' : /mac os x/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : 'Unknown';
    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean } }).connection;
    return [
      ['Browser', name],
      ['Operating System', os],
      ['Device Type', /mobi|android|iphone/i.test(ua) ? 'Mobile' : /ipad|tablet/i.test(ua) ? 'Tablet' : 'Desktop'],
      ['Screen', `${window.screen.width} × ${window.screen.height} @${window.devicePixelRatio || 1}x`],
      ['Browser Language', navigator.language],
      ['System Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'],
      ['Connection Type', conn?.effectiveType ? conn.effectiveType.toUpperCase() : 'Unknown'],
      ['Downlink', conn?.downlink ? `~${conn.downlink} Mbps` : 'Unknown'],
      ['Latency (RTT)', conn?.rtt ? `~${conn.rtt} ms` : 'Unknown'],
      ['Data Saver', conn?.saveData ? 'On' : 'Off'],
      ['Cookies', navigator.cookieEnabled ? 'Enabled' : 'Disabled'],
      ['Do Not Track', navigator.doNotTrack === '1' ? 'Enabled' : 'Not set'],
      ['CPU Cores', String(navigator.hardwareConcurrency || 'Unknown')],
      ['Online', navigator.onLine ? 'Yes' : 'No'],
      ['User Agent', ua],
    ] as [string, string][];
  }, []);

  const tzMismatch = info?.timezone && Intl.DateTimeFormat().resolvedOptions().timeZone &&
    info.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (loading) return <Spinner label="Detecting your public IP address and location…" />;

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <CopyableIp ip={myIp} label="Your public IPv4 address" />
        <CopyableIp dark ip={ips?.v6 || (info?.version === 'IPv6' ? info.ip : '')} label="Your public IPv6 address" />
      </div>

      {failed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Could not reach the IP services (an ad blocker or strict network may be blocking them). Browser details below are still accurate.
          <button type="button" onClick={load} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}

      {info && (
        <Section title="Location & Network" icon={ic.globe} badge={<LiveBadge source={info.source} />}>
          <InfoGrid rows={geoRows(info)} cols={3} />
          {info.latitude !== null && info.longitude !== null && (
            <div className="mt-4"><MapEmbed lat={info.latitude} lon={info.longitude} label={info.city || info.ip} /></div>
          )}
          {tzMismatch && (
            <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
              <strong>VPN / proxy hint:</strong> your IP timezone ({info.timezone}) differs from your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). This often indicates a VPN, proxy or corporate gateway.
            </div>
          )}
        </Section>
      )}

      {(ptr.length > 0 || whois) && (
        <Section title="Reverse DNS & Registration" icon={ic.file} badge={<LiveBadge source="DoH + RDAP" />}>
          {ptr.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-1.5">Reverse DNS (PTR) hostname{ptr.length > 1 ? 's' : ''}</p>
              <div className="flex flex-wrap gap-2">
                {ptr.map(h => <span key={h} className="font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">{h}</span>)}
              </div>
            </div>
          )}
          {whois && <InfoGrid rows={whoisRows(whois)} cols={3} />}
        </Section>
      )}

      <Section title="Your Browser & Connection" icon={ic.monitor} badge={<LiveBadge source="local" />}>
        <InfoGrid rows={browser} cols={3} />
      </Section>

      <Section title="What is an IP address?" icon={ic.network}>
        <div className="text-sm text-slate-600 leading-relaxed space-y-2">
          <p>An IP (Internet Protocol) address is the unique number your internet provider assigns to your connection so websites know where to send data back. Most home connections receive a <strong>dynamic</strong> IP that can change periodically, while servers and businesses often use <strong>static</strong> IPs.</p>
          <p>Websites can see your public IP, and from it estimate your city-level location, ISP and timezone, which is exactly what you see above. They cannot see your exact street address. To hide your IP, use a reputable VPN or the Tor network.</p>
        </div>
      </Section>
    </div>
  );
};

// ---------- 2 & 3. IP Location / GEO IP Locator ----------
export const IpLocationTool: React.FC<{ placeholder?: string; withMap?: boolean }> = ({ placeholder, withMap = false }) => {
  const [value, setValue] = useState('');
  const [query, setQuery] = useState('');           // what was submitted
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [mine, setMine] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (target?: string) => {
    const q = (target ?? value).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    setError(''); setInfo(null); setQuery(q); setLoading(true);
    if (q && !isValidIp(q) && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(q)) {
      setError('Enter a valid IPv4/IPv6 address (e.g. 8.8.8.8) or a domain name.');
      setLoading(false); return;
    }
    if (q && isValidIp(q) && isPrivateIp(q)) {
      setError(`${q} is a private/reserved address used inside local networks. It has no public geolocation.`);
      setLoading(false); return;
    }
    // Domains are resolved to their real IPv4 via DNS-over-HTTPS first.
    let lookupTarget = q;
    if (q && !isValidIp(q)) {
      const a = await resolveA(q);
      if (!a.length) { setError(`No IPv4 (A) record found for ${q}. The domain may not exist or has no A record.`); setLoading(false); return; }
      lookupTarget = a[0];
    }
    const [res, me] = await Promise.all([lookupIp(lookupTarget), withMap ? lookupIp('') : Promise.resolve(null)]);
    if (!res) setError('Lookup failed. The address may be unroutable, or the geolocation services are blocked on your network.');
    setInfo(res); setMine(me); setLoading(false);
  };

  const lookupIpAddr = info?.ip || '';
  const { ptr, whois } = useIpExtras(lookupIpAddr || null);
  const dist = withMap && info?.latitude != null && info.longitude != null && mine?.latitude != null && mine.longitude != null
    ? distanceKm(mine.latitude, mine.longitude, info.latitude, info.longitude) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
          placeholder={placeholder || 'Enter an IP address or domain'}
          className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono" />
        <PrimaryBtn type="button" onClick={() => run()} disabled={loading}>{loading ? 'Locating…' : 'Locate IP'}</PrimaryBtn>
        <button type="button" onClick={() => { setValue(''); run(''); }}
          className="px-5 py-3 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm whitespace-nowrap">Use my IP</button>
      </div>
      {error && <ErrBox msg={error} />}
      {loading && <Spinner label="Querying geolocation databases…" />}
      {info && (
        <>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
            <p className="text-indigo-100 text-sm">{query && !isValidIp(query) ? 'Location of' : 'Location for'}</p>
            {query && !isValidIp(query) && (
              <p className="text-sm text-indigo-100 font-mono break-all">{query} <span className="opacity-70">resolves to</span></p>
            )}
            <p className="text-2xl font-bold font-mono break-all">{info.ip}</p>
            <p className="text-lg mt-2">{flagEmoji(info.countryCode)} {[info.city, info.region, info.country].filter(Boolean).join(', ') || 'Location unavailable'}</p>
            {dist !== null && <p className="text-sm text-indigo-100 mt-1">≈ {dist.toLocaleString()} km from your current location</p>}
          </div>
          {withMap && info.latitude !== null && info.longitude !== null && (
            <MapEmbed lat={info.latitude} lon={info.longitude} label={info.city || info.ip} />
          )}
          <Section title="Full geolocation record" icon={ic.globe} badge={<LiveBadge source={info.source} />}>
            <InfoGrid rows={geoRows(info)} cols={3} />
            <p className="text-xs text-slate-400 mt-4">IP geolocation is accurate to country level ~99% of the time and to city level roughly 55–80%. It reflects where the ISP routes the address, not a physical street address.</p>
          </Section>
          {(ptr.length > 0 || whois) && (
            <Section title="Reverse DNS & Registration" icon={ic.file} badge={<LiveBadge source="DoH + RDAP" />}>
              {ptr.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1.5">Reverse DNS (PTR) hostname{ptr.length > 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-2">
                    {ptr.map(h => <span key={h} className="font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">{h}</span>)}
                  </div>
                </div>
              )}
              {whois && <InfoGrid rows={whoisRows(whois)} cols={3} />}
            </Section>
          )}
        </>
      )}
    </div>
  );
};

// ---------- 4. Reverse IP Domain Check ----------
const registrable = (host: string) => {
  const parts = host.toLowerCase().split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : host;
};
const tldOf = (host: string) => host.slice(host.lastIndexOf('.') + 1) || '—';

export const ReverseIpTool: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const [value, setValue] = useState('');
  const [ip, setIp] = useState('');
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [ptr, setPtr] = useState<string[]>([]);
  const [domainError, setDomainError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ran, setRan] = useState(false);

  const run = async () => {
    const q = value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!q) return;
    setLoading(true); setError(''); setDomainError(''); setInfo(null); setDomains([]); setPtr([]); setIp(''); setRan(false);

    let targetIp = '';
    if (isValidIp(q)) {
      if (isPrivateIp(q)) { setError(`${q} is a private address; reverse IP data only exists for public IPs.`); setLoading(false); return; }
      targetIp = q;
    } else if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(q)) {
      const a = await resolveA(q);
      if (!a.length) { setError(`No IPv4 (A) record found for ${q}.`); setLoading(false); return; }
      targetIp = a[0];
    } else {
      setError('Enter a domain name or a public IP address.'); setLoading(false); return;
    }
    setIp(targetIp);

    const [geo, ptrRes, rev] = await Promise.all([
      lookupIp(targetIp),
      resolvePtr(targetIp).catch(() => []),
      reverseIpDomains(targetIp),
    ]);
    setInfo(geo); setPtr(ptrRes); setDomains(rev.domains);
    if (rev.error) setDomainError(rev.error);
    setRan(true); setLoading(false);
  };

  const shared = domains.length;
  const risk = shared === 0 ? ['Unknown', 'text-slate-500'] : shared <= 5 ? ['Low', 'text-emerald-600'] : shared <= 30 ? ['Moderate', 'text-amber-600'] : ['High', 'text-red-600'];

  const groups = useMemo(() => {
    const m = new Map<string, number>();
    domains.forEach(d => m.set(registrable(d), (m.get(registrable(d)) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [domains]);

  const tlds = useMemo(() => {
    const m = new Map<string, number>();
    domains.forEach(d => m.set(tldOf(d), (m.get(tldOf(d)) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [domains]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder={placeholder}
          className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono" />
        <PrimaryBtn type="button" onClick={run} disabled={loading || !value.trim()}>{loading ? 'Scanning…' : 'Check Reverse IP'}</PrimaryBtn>
      </div>
      {error && <ErrBox msg={error} />}
      {loading && <Spinner label="Looking up shared-hosting neighbours…" />}
      {ran && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard label="Domains on this IP" value={shared} sub={ip ? <span className="font-mono">{ip}</span> : undefined} tone={shared ? 'accent' : 'default'} />
            <StatCard label="Hosting type" value={shared === 0 ? 'Unknown' : shared <= 2 ? 'Dedicated / VPS' : shared <= 30 ? 'Small shared' : 'Shared hosting'} />
            <StatCard label="Bad-neighbour risk" value={risk[0]} tone={shared === 0 ? 'default' : shared <= 5 ? 'good' : shared <= 30 ? 'warn' : 'bad'} />
          </div>

          <Section title={`Server at ${ip}`} icon={ic.server} badge={info ? <LiveBadge source={info.source} /> : undefined}>
            {info ? (
              <InfoGrid rows={[
                ['IP Address', <span className="font-mono">{info.ip}</span>],
                ['Reverse DNS (PTR)', ptr.length ? <span className="font-mono">{ptr.join(', ')}</span> : 'None published'],
                ['Hosting Provider / ISP', info.isp],
                ['Organization', info.org],
                ['ASN', info.asn],
                ['Server Location', [info.city, info.region, info.country].filter(Boolean).join(', ')],
                ['Country', info.country ? `${flagEmoji(info.countryCode)} ${info.country}` : ''],
                ['Timezone', info.timezone],
              ]} cols={3} />
            ) : (
              <p className="text-sm text-slate-500">Geolocation for this IP was unavailable.</p>
            )}
          </Section>

          <Section title={`Websites sharing this IP (${shared})`} icon={ic.layers}
            badge={shared > 0 ? <LiveBadge source="HackerTarget" /> : undefined}>
            {domainError ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                The reverse-IP neighbour list could not be retrieved: {domainError} The server details above are still accurate.
              </div>
            ) : shared === 0 ? (
              <p className="text-sm text-slate-500">No other domains were found pointing at this IP in the passive-DNS corpus. That usually means a dedicated server, a very new IP, or an address the corpus has not indexed.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <p className="text-sm text-slate-600">These domains were observed resolving to <span className="font-mono">{ip}</span>. Sharing an IP with spam or malware sites can affect email deliverability and, occasionally, search trust.</p>
                  <CopyBtn text={domains.join('\n')} label={`Copy all ${shared}`} className="text-indigo-600 hover:text-indigo-800" />
                </div>
                <div className="grid lg:grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">By registered domain (top)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {groups.slice(0, 40).map(([d, n]) => (
                        <span key={d} className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                          <span className="font-mono">{d}</span>{n > 1 && <span className="text-slate-400">×{n}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">TLD breakdown</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tlds.map(([t, n]) => (
                        <span key={t} className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                          <span className="font-mono">.{t}</span><span className="text-slate-400">{n}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0"><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="text-left px-4 py-2.5">#</th><th className="text-left px-4 py-2.5">Domain</th><th className="text-left px-4 py-2.5">TLD</th></tr></thead>
                    <tbody>
                      {domains.map((d, i) => (
                        <tr key={d} className="border-t border-slate-100">
                          <td className="px-4 py-1.5 text-slate-400">{i + 1}</td>
                          <td className="px-4 py-1.5 font-mono text-slate-800">{d}</td>
                          <td className="px-4 py-1.5 text-slate-500">.{tldOf(d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-3">Source: HackerTarget passive-DNS corpus, fetched live. It lists domains historically observed on this IP and may not be exhaustive or perfectly current.</p>
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
};

// ---------- 5. Free Daily Proxy List ----------
type SortKey = 'uptime' | 'latency' | 'recent';
const anonRank = (a: string) => (a === 'elite' ? 0 : a === 'anonymous' ? 1 : 2);

export const ProxyListTool: React.FC = () => {
  const [rows, setRows] = useState<ProxyEntry[]>([]);
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [protocol, setProtocol] = useState<'all' | ProxyProtocol>('all');
  const [anon, setAnon] = useState<'all' | 'elite' | 'anonymous' | 'transparent'>('all');
  const [country, setCountry] = useState('all');
  const [sslOnly, setSslOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('uptime');
  const [limit, setLimit] = useState(150);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [st, ...lists] = await Promise.all([
        fetchProxyStats(),
        ...PROXY_PROTOCOLS.map(p => fetchProxyList(p).then(l => l.map(e => ({ ...e, protocol: p }))).catch(() => [] as ProxyEntry[])),
      ]);
      const merged = lists.flat();
      // Deduplicate on protocol+ip+port
      const seen = new Set<string>();
      const dedup = merged.filter(e => { const k = `${e.protocol}|${e.ip}|${e.port}`; if (seen.has(k)) return false; seen.add(k); return true; });
      setStats(st); setRows(dedup);
      if (!dedup.length) setError('The proxy list loaded empty. The upstream mirror may be updating — try again in a minute.');
    } catch {
      setError('Could not load the proxy list. Your network may be blocking the CDN — try again.');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const countries = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => { if (r.country_code) m.set(r.country_code, (m.get(r.country_code) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (protocol !== 'all') out = out.filter(r => r.protocol === protocol);
    if (anon !== 'all') out = out.filter(r => r.anonymity === anon);
    if (country !== 'all') out = out.filter(r => r.country_code === country);
    if (sslOnly) out = out.filter(r => r.ssl);
    out = [...out].sort((a, b) =>
      sortKey === 'latency' ? a.latency_ms - b.latency_ms
      : sortKey === 'recent' ? b.last_checked - a.last_checked
      : b.uptime_percent - a.uptime_percent || anonRank(a.anonymity) - anonRank(b.anonymity));
    return out;
  }, [rows, protocol, anon, country, sslOnly, sortKey]);

  const shown = filtered.slice(0, limit);
  const newest = rows.reduce((max, r) => Math.max(max, r.last_checked || 0), 0);
  const fastest = filtered.length ? Math.min(...filtered.map(r => r.latency_ms)) : 0;

  const copyAll = () => { navigator.clipboard?.writeText(shown.map(p => `${p.ip}:${p.port}`).join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const protoCount = (p: ProxyProtocol | 'all') => p === 'all' ? rows.length : rows.filter(r => r.protocol === p).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Proxies available" value={loading ? '…' : (stats?.total ?? rows.length).toLocaleString()} sub={newest ? `updated ${checkedAgo(newest)}` : 'live list'} tone="accent" />
        <StatCard label="Countries" value={loading ? '…' : (stats?.country_count ?? countries.length)} sub="across the pool" />
        <StatCard label="Matching filters" value={loading ? '…' : filtered.length.toLocaleString()} />
        <StatCard label="Fastest match" value={loading ? '…' : `${Math.round(fastest)} ms`} tone="good" />
      </div>

      {error && <ErrBox msg={error} onRetry={load} />}
      {loading && <Spinner label="Loading live proxies from the ProxyScrape mirror…" />}

      {!loading && rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', ...PROXY_PROTOCOLS] as const).map(t => (
              <button key={t} type="button" onClick={() => { setProtocol(t); setLimit(150); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${protocol === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                {t === 'all' ? 'All' : t.toUpperCase()} <span className="opacity-60">{protoCount(t)}</span>
              </button>
            ))}
            <div className="flex-1" />
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700">
              <Icon className="w-3.5 h-3.5">{ic.refresh}</Icon> Refresh
            </button>
            <button type="button" onClick={copyAll} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700">
              <Icon className="w-3.5 h-3.5">{ic.download}</Icon> {copied ? 'Copied!' : `Copy ${shown.length} as IP:PORT`}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-600">Anonymity
              <select value={anon} onChange={e => setAnon(e.target.value as typeof anon)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                <option value="all">All</option><option value="elite">Elite</option><option value="anonymous">Anonymous</option><option value="transparent">Transparent</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-slate-600">Country
              <select value={country} onChange={e => setCountry(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm max-w-[180px]">
                <option value="all">All ({countries.length})</option>
                {countries.map(([cc, n]) => <option key={cc} value={cc}>{flagEmoji(cc)} {cc} ({n})</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-slate-600">Sort
              <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
                <option value="uptime">Uptime</option><option value="latency">Speed</option><option value="recent">Recently checked</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input type="checkbox" checked={sslOnly} onChange={e => setSslOnly(e.target.checked)} className="rounded border-slate-300" /> HTTPS only
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                  {['Proxy', 'Protocol', 'Country', 'City', 'Anonymity', 'HTTPS', 'Uptime', 'Speed', 'ISP / ASN', 'Checked'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>))}
                </tr></thead>
                <tbody>
                  {shown.map(p => (
                    <tr key={`${p.protocol}-${p.ip}-${p.port}`} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-2 font-mono text-slate-800 whitespace-nowrap">{p.ip}:{p.port}</td>
                      <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase ${p.protocol.startsWith('socks') ? 'bg-violet-50 text-violet-700' : p.protocol === 'https' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.protocol}</span></td>
                      <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{flagEmoji(p.country_code)} {p.country || p.country_code}</td>
                      <td className="px-4 py-2 text-slate-500">{p.city || '—'}</td>
                      <td className={`px-4 py-2 font-semibold ${p.anonymity === 'elite' ? 'text-emerald-600' : p.anonymity === 'anonymous' ? 'text-indigo-600' : 'text-amber-600'}`}>{p.anonymity}</td>
                      <td className="px-4 py-2">{p.ssl ? <Icon className="w-4 h-4 text-emerald-600">{ic.lock}</Icon> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-2"><span className={`${p.uptime_percent >= 80 ? 'text-emerald-600 font-semibold' : p.uptime_percent >= 40 ? 'text-slate-700' : 'text-slate-400'}`}>{p.uptime_percent.toFixed(0)}%</span></td>
                      <td className={`px-4 py-2 ${p.latency_ms < 500 ? 'text-emerald-600 font-semibold' : p.latency_ms < 1500 ? 'text-slate-700' : 'text-red-500'}`}>{Math.round(p.latency_ms)} ms</td>
                      <td className="px-4 py-2 text-slate-500 max-w-[220px] truncate" title={`${p.isp} ${p.asn}`}>{p.isp || '—'} {p.asn && <span className="text-slate-400">{p.asn}</span>}</td>
                      <td className="px-4 py-2 text-slate-400 whitespace-nowrap">{checkedAgo(p.last_checked)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > shown.length && (
              <button type="button" onClick={() => setLimit(l => l + 250)} className="w-full py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 border-t border-slate-100">
                Show 250 more ({(filtered.length - shown.length).toLocaleString()} remaining)
              </button>
            )}
          </div>

          <Section title="Proxy anonymity levels explained" icon={ic.shield}>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4"><p className="font-bold text-emerald-700 mb-1">Elite</p><p className="text-slate-600">Hides your IP and does not reveal that a proxy is in use. Best for privacy.</p></div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4"><p className="font-bold text-indigo-700 mb-1">Anonymous</p><p className="text-slate-600">Hides your real IP but sends headers that reveal a proxy is being used.</p></div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><p className="font-bold text-amber-700 mb-1">Transparent</p><p className="text-slate-600">Forwards your real IP in headers. Only useful for caching, not anonymity.</p></div>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              These are real public proxies from the ProxyScrape community list (refreshed every few minutes). Free public proxies are inherently unreliable, often short-lived, and <strong>unsafe for logins, banking or anything private</strong> — the operator can see unencrypted traffic. Never send credentials through an untrusted proxy.
            </p>
          </Section>
        </>
      )}
    </div>
  );
};

// ---------- 6. Class C IP Checker ----------
export const ClassCTool: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<{ host: string; ip: string; classC: string; cls: string; decimal: number; ptr: string; ok: boolean }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    const hosts = Array.from(new Set(text.split(/[\n,\s]+/).map(h => h.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()).filter(Boolean))).slice(0, 30);
    if (!hosts.length) return;
    setLoading(true); setError('');
    const out = await Promise.all(hosts.map(async host => {
      let ip = '';
      if (isValidIp(host) && detectVersion(host) === 'IPv4') ip = host;
      else ip = await toIpv4(host).catch(() => '');
      if (!ip) return { host, ip: '', classC: '', cls: '', decimal: 0, ptr: '', ok: false };
      const parts = ip.split('.');
      const ptr = await resolvePtr(ip).catch(() => []);
      return { host, ip, classC: `${parts[0]}.${parts[1]}.${parts[2]}.*`, cls: classOf(ip), decimal: ipToNumber(ip), ptr: ptr[0] || '', ok: true };
    }));
    setRows(out);
    const missing = out.filter(r => !r.ok).length;
    if (missing === out.length) setError('None of the entered hosts resolved to an IPv4 address. Check the domain names and try again.');
    setLoading(false);
  };

  const resolved = rows?.filter(r => r.ok) || [];
  const groups = useMemo(() => {
    if (!resolved.length) return [];
    const m = new Map<string, string[]>();
    resolved.forEach(r => m.set(r.classC, [...(m.get(r.classC) || []), r.host]));
    return Array.from(m.entries()).filter(([, hosts]) => hosts.length > 1);
  }, [resolved]);

  return (
    <div className="space-y-5">
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} rows={7} spellCheck={false}
        className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono" />
      <div className="flex items-center gap-3 flex-wrap">
        <PrimaryBtn type="button" onClick={run} disabled={loading || !text.trim()}>{loading ? 'Resolving…' : 'Check Class C Ranges'}</PrimaryBtn>
        <span className="text-xs text-slate-400">Domains are resolved to their real IP via DNS-over-HTTPS.</span>
      </div>
      {error && <ErrBox msg={error} />}
      {loading && <Spinner label="Resolving A records via DNS-over-HTTPS…" />}
      {rows && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard label="Hosts checked" value={rows.length} sub={`${resolved.length} resolved`} />
            <StatCard label="Unique Class C blocks" value={new Set(resolved.map(r => r.classC)).size} />
            <StatCard label="Shared ranges found" value={groups.length} tone={groups.length ? 'warn' : 'good'} />
          </div>
          {groups.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Shared Class C ranges detected</p>
              {groups.map(([range, hosts]) => <p key={range}><span className="font-mono">{range}</span> → {hosts.join(', ')}</p>)}
              <p className="text-xs mt-2 text-amber-700">Sites linking to each other from the same Class C block look like a private network to search engines. Diversify hosting if these are meant to appear independent.</p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
                  {['Host', 'IP Address', 'Class C Range', 'Class', 'Decimal', 'Reverse DNS'].map(h => <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.host} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800 break-all">{r.host}</td>
                      {r.ok ? (
                        <>
                          <td className="px-4 py-2 font-mono text-slate-700">{r.ip}</td>
                          <td className="px-4 py-2 font-mono text-indigo-700">{r.classC}</td>
                          <td className="px-4 py-2 text-slate-600">Class {r.cls}</td>
                          <td className="px-4 py-2 font-mono text-slate-500">{r.decimal.toLocaleString()}</td>
                          <td className="px-4 py-2 font-mono text-slate-500 break-all">{r.ptr || '—'}</td>
                        </>
                      ) : (
                        <td colSpan={5} className="px-4 py-2 text-slate-400">No IPv4 (A) record found — could not resolve.</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Section title="What is a Class C IP?" icon={ic.network}>
            <p className="text-sm text-slate-600 leading-relaxed">In an IPv4 address like <span className="font-mono">203.0.113.45</span>, the first three octets (<span className="font-mono">203.0.113</span>) form the Class C block, covering 256 addresses. Search engines have long used shared Class C ranges as one signal that a group of linking sites may be owned or hosted together, so link builders check this to make sure backlinks come from genuinely diverse networks.</p>
            <p className="text-xs text-slate-400 mt-3">Each domain above is resolved to its real IPv4 address with a live DNS-over-HTTPS query (dns.google). Hosts with no A record are reported honestly rather than guessed.</p>
          </Section>
        </>
      )}
    </div>
  );
};
