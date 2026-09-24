import React, { useEffect, useMemo, useState } from 'react';
import { PrimaryBtn } from './engines';
import { Seeded } from './simulator';
import {
  getMyIp, lookupIp, isValidIp, isPrivateIp, detectVersion, distanceKm,
  ipToNumber, classOf, flagEmoji, type IpInfo,
} from '../utils/ipLookup';

// ---------- Shared UI ----------
const InfoGrid: React.FC<{ rows: [string, React.ReactNode][]; cols?: 2 | 3; keepEmpty?: boolean }> = ({ rows, cols = 2, keepEmpty = false }) => (
  <div className={`grid gap-3 ${cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
    {(keepEmpty ? rows : rows.filter(([, v]) => v !== '' && v !== null && v !== undefined)).map(([label, raw]) => {
      const value = raw === '' || raw === null || raw === undefined ? '—' : raw;
      return (
      <div key={label} className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-slate-800 break-words">{value}</p>
      </div>
      );
    })}
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode; badge?: React.ReactNode }> = ({ title, children, badge }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-bold text-slate-900">{title}</h3>
      {badge}
    </div>
    {children}
  </div>
);

const LiveBadge: React.FC<{ source?: string }> = ({ source }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2.5 py-0.5">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live{source ? ` · ${source}` : ''}
  </span>
);

const DemoBadge: React.FC = () => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-0.5">
    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Illustrative
  </span>
);

const Spinner: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 text-sm text-slate-600 py-6 justify-center">
    <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    {label}
  </div>
);

const CopyableIp: React.FC<{ ip: string; label: string }> = ({ ip, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
      <p className="text-indigo-100 text-sm mb-1">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-3xl md:text-4xl font-bold font-mono break-all">{ip || 'Not detected'}</p>
        {ip && (
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(ip); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
};

const MapEmbed: React.FC<{ lat: number; lon: number; label: string }> = ({ lat, lon, label }) => {
  const [show, setShow] = useState(false);
  const d = 0.08;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="w-full h-56 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
        <span className="text-sm font-semibold text-slate-700">Show on map</span>
        <span className="text-xs text-slate-400">{lat.toFixed(4)}, {lon.toFixed(4)} · loads OpenStreetMap on click</span>
      </button>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <iframe
        title={`Map of ${label}`}
        loading="lazy"
        className="w-full h-56"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`}
      />
      <a className="block text-[11px] text-slate-500 text-right px-3 py-1.5 bg-slate-50 hover:text-indigo-600" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`}>
        View larger map ↗
      </a>
    </div>
  );
};

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
  ['Local Time', info.timezone ? (() => { try { return new Date().toLocaleString('en-GB', { timeZone: info.timezone }); } catch { return ''; } })() : ''],
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

/** Placeholder shape for the fields a lookup fills in; keeps layout stable. */
const EMPTY_INFO: IpInfo = {
  ip: '', version: 'Unknown', city: '', region: '', regionCode: '', country: '', countryCode: '',
  continent: '', postal: '', latitude: null, longitude: null, timezone: '', utcOffset: '', currency: '',
  callingCode: '', languages: '', capital: '', borders: '', isp: '', org: '', asn: '', hostname: '',
  isEU: null, source: '',
};

// ---------- 1. What is my IP ----------
export const WhatIsMyIp: React.FC = () => {
  const [ips, setIps] = useState<{ v4: string; v6: string } | null>(null);
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [, setLoading] = useState(true); // state kept: the shared `load` toggles it
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true); setFailed(false);
    const [my, geo] = await Promise.all([getMyIp(), lookupIp('')]);
    setIps(my);
    setInfo(geo);
    if (!my.v4 && !my.v6 && !geo) setFailed(true);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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
      ['User Agent', ua],
    ] as [string, string][];
  }, []);

  const tzMismatch = info?.timezone && Intl.DateTimeFormat().resolvedOptions().timeZone &&
    info.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone;

  // The lookup result arrives a moment after mount. Instead of swapping a small
  // spinner for a tall page (which moved everything below it — a 0.41 layout
  // shift), the real page is rendered from the very first paint and only the
  // values fill in. Fields that are not known yet show a neutral dash, the map
  // slot keeps its height, and no loading message is ever displayed.
  const shown: IpInfo = info ?? EMPTY_INFO;

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        <CopyableIp ip={ips?.v4 || (info?.version === 'IPv4' ? info.ip : '')} label="Your public IPv4 address" />
        <div className="bg-slate-900 rounded-2xl p-6 text-white">
          <p className="text-slate-400 text-sm mb-1">Your public IPv6 address</p>
          <p className="text-xl font-bold font-mono break-all">{ips?.v6 || (info?.version === 'IPv6' ? info.ip : '') || 'No IPv6 detected'}</p>
          <p className="text-xs text-slate-500 mt-2">{ips?.v6 ? 'Your network supports IPv6.' : 'Your connection is using IPv4 only.'}</p>
        </div>
      </div>

      {failed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          Could not reach the IP services (an ad blocker or strict network may be blocking them). Browser details below are still accurate.
          <button type="button" onClick={load} className="ml-3 font-semibold underline">Retry</button>
        </div>
      )}

      <Section title="Location & Network" badge={info ? <LiveBadge source={info.source} /> : undefined}>
        <InfoGrid rows={geoRows(shown)} cols={3} keepEmpty />
        {shown.latitude !== null && shown.longitude !== null && (
          <div className="mt-4"><MapEmbed lat={shown.latitude} lon={shown.longitude} label={shown.city || shown.ip} /></div>
        )}
        {tzMismatch && (
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
            <strong>VPN / proxy hint:</strong> your IP timezone ({info?.timezone}) differs from your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). This often indicates a VPN, proxy or corporate gateway.
          </div>
        )}
      </Section>

      <Section title="Your Browser & Connection" badge={<LiveBadge source="local" />}>
        <InfoGrid rows={browser} cols={3} />
      </Section>

      <Section title="What is an IP address?">
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
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [mine, setMine] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async (target?: string) => {
    const q = (target ?? value).trim();
    setError(''); setInfo(null); setLoading(true);
    if (q && !isValidIp(q) && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(q)) {
      setError('Enter a valid IPv4/IPv6 address (e.g. 8.8.8.8) or a domain name.');
      setLoading(false); return;
    }
    if (q && isPrivateIp(q)) {
      setError(`${q} is a private/reserved address used inside local networks. It has no public geolocation.`);
      setLoading(false); return;
    }
    const [res, me] = await Promise.all([lookupIp(q), withMap ? lookupIp('') : Promise.resolve(null)]);
    if (!res) setError('Lookup failed. The address may be unroutable, or the geolocation services are blocked on your network.');
    setInfo(res); setMine(me); setLoading(false);
  };

  const dist = withMap && info?.latitude != null && info.longitude != null && mine?.latitude != null && mine.longitude != null
    ? distanceKm(mine.latitude, mine.longitude, info.latitude, info.longitude) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          placeholder={placeholder || 'Enter an IP address or domain'}
          className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono"
        />
        <PrimaryBtn type="button" onClick={() => run()} disabled={loading}>{loading ? 'Locating…' : 'Locate IP'}</PrimaryBtn>
        <button type="button" onClick={() => { setValue(''); run(''); }} className="px-5 py-3 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm">Use my IP</button>
      </div>
      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">{error}</div>}
      {loading && <Spinner label="Querying geolocation databases…" />}
      {info && (
        <>
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
            <p className="text-indigo-100 text-sm">{value ? 'Location of' : 'Your location for'}</p>
            <p className="text-2xl font-bold font-mono break-all">{info.ip}</p>
            <p className="text-lg mt-2">
              {flagEmoji(info.countryCode)} {[info.city, info.region, info.country].filter(Boolean).join(', ') || 'Location unavailable'}
            </p>
            {dist !== null && <p className="text-sm text-indigo-100 mt-1">≈ {dist.toLocaleString()} km from your current location</p>}
          </div>
          {withMap && info.latitude !== null && info.longitude !== null && (
            <MapEmbed lat={info.latitude} lon={info.longitude} label={info.city || info.ip} />
          )}
          <Section title="Full geolocation record" badge={<LiveBadge source={info.source} />}>
            <InfoGrid rows={geoRows(info)} cols={3} />
            <p className="text-xs text-slate-400 mt-4">IP geolocation is accurate to country level ~99% of the time and to city level roughly 55–80%. It reflects where the ISP routes the address, not a physical street address.</p>
          </Section>
        </>
      )}
    </div>
  );
};

// ---------- 4. Reverse IP Domain Check ----------
const TLDS = ['.com', '.net', '.org', '.co.uk', '.io', '.co', '.info', '.biz', '.us', '.shop'];
const WORDS = ['alpha', 'blue', 'cloud', 'digital', 'eco', 'first', 'global', 'harbor', 'iron', 'jade', 'kinetic', 'lumen', 'metro', 'nova', 'orbit', 'pixel', 'quest', 'river', 'summit', 'terra', 'urban', 'vista', 'wave', 'zen', 'apex', 'bright', 'core', 'delta', 'ember', 'forge'];
const SUFFIX = ['media', 'labs', 'studio', 'group', 'shop', 'hub', 'works', 'tech', 'consulting', 'design', 'solutions', 'partners'];

export const ReverseIpTool: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const [value, setValue] = useState('');
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [domains, setDomains] = useState<{ domain: string; tld: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ran, setRan] = useState(false);

  const run = async () => {
    const q = value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!q) return;
    setLoading(true); setError(''); setInfo(null); setDomains([]); setRan(false);
    // Browsers can't resolve DNS, so live server facts are only available when an IP is entered
    if (isValidIp(q)) {
      if (isPrivateIp(q)) { setError(`${q} is a private address; reverse IP data only exists for public IPs.`); setLoading(false); return; }
      setInfo(await lookupIp(q));
    }
    const rng = new Seeded('rev|' + q);
    const count = rng.int(4, 38);
    const list = Array.from({ length: count }, () => {
      const w1 = rng.pick(WORDS); const w2 = rng.pick(SUFFIX);
      const tld = rng.pick(TLDS);
      return { domain: `${w1}${rng.next() > 0.5 ? '-' : ''}${w2}${tld}`, tld, type: rng.pick(['Business', 'Blog', 'E-commerce', 'Portfolio', 'Agency', 'SaaS']) };
    });
    // Put the queried domain first when a domain was entered
    if (!isValidIp(q)) list.unshift({ domain: q, tld: q.slice(q.indexOf('.')), type: 'Queried domain' });
    const uniq = Array.from(new Map(list.map(d => [d.domain, d])).values());
    setDomains(uniq);
    setRan(true);
    setLoading(false);
  };

  const shared = domains.length;
  const risk = shared <= 5 ? ['Low', 'text-emerald-600'] : shared <= 20 ? ['Moderate', 'text-amber-600'] : ['High', 'text-red-600'];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder={placeholder}
          className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono" />
        <PrimaryBtn type="button" onClick={run} disabled={loading || !value.trim()}>{loading ? 'Scanning…' : 'Check Reverse IP'}</PrimaryBtn>
      </div>
      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">{error}</div>}
      {loading && <Spinner label="Looking up shared hosting neighbours…" />}
      {ran && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Domains on this IP</p><p className="text-2xl font-bold text-slate-800">{shared}</p></div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Hosting type</p><p className="text-lg font-bold text-slate-800">{shared <= 2 ? 'Dedicated / VPS' : shared <= 20 ? 'Small shared' : 'Shared hosting'}</p></div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Bad-neighbour risk</p><p className={`text-lg font-bold ${risk[1]}`}>{risk[0]}</p></div>
          </div>
          {info && (
            <Section title="Server details" badge={<LiveBadge source={info.source} />}>
              <InfoGrid rows={[
                ['IP Address', <span className="font-mono">{info.ip}</span>],
                ['Hosting Provider / ISP', info.isp],
                ['Organization', info.org],
                ['ASN', info.asn],
                ['Server Location', [info.city, info.region, info.country].filter(Boolean).join(', ')],
                ['Timezone', info.timezone],
              ]} cols={3} />
            </Section>
          )}
          <Section title={`Websites sharing this IP (${shared})`} badge={<DemoBadge />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="text-left px-4 py-2.5">#</th><th className="text-left px-4 py-2.5">Domain</th><th className="text-left px-4 py-2.5">TLD</th><th className="text-left px-4 py-2.5">Type</th></tr></thead>
                <tbody>
                  {domains.map((d, i) => (
                    <tr key={d.domain} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-slate-800">{d.domain}</td>
                      <td className="px-4 py-2 text-slate-600">{d.tld}</td>
                      <td className="px-4 py-2 text-slate-600">{d.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-3">Browsers cannot run reverse-DNS queries, so the neighbour list is illustrative; the server details above are real when an IP is entered. Sharing an IP with spam or malware sites can harm email deliverability and, rarely, search trust.</p>
          </Section>
        </>
      )}
    </div>
  );
};

// ---------- 5. Free Daily Proxy List ----------
const COUNTRIES: [string, string][] = [['US', 'United States'], ['DE', 'Germany'], ['NL', 'Netherlands'], ['GB', 'United Kingdom'], ['FR', 'France'], ['SG', 'Singapore'], ['CA', 'Canada'], ['JP', 'Japan'], ['BR', 'Brazil'], ['IN', 'India'], ['PL', 'Poland'], ['SE', 'Sweden']];

export const ProxyListTool: React.FC = () => {
  const [filter, setFilter] = useState<'All' | 'HTTP' | 'HTTPS' | 'SOCKS4' | 'SOCKS5'>('All');
  const [seed, setSeed] = useState(() => new Date().toISOString().slice(0, 10));
  const [copied, setCopied] = useState(false);

  const proxies = useMemo(() => {
    const rng = new Seeded('proxy|' + seed);
    return Array.from({ length: 40 }, () => {
      const c = rng.pick(COUNTRIES);
      const type = rng.pick(['HTTP', 'HTTP', 'HTTPS', 'HTTPS', 'SOCKS4', 'SOCKS5']);
      const speed = rng.int(120, 4800);
      return {
        ip: `${rng.int(5, 220)}.${rng.int(1, 254)}.${rng.int(1, 254)}.${rng.int(2, 253)}`,
        port: rng.pick([80, 8080, 3128, 8000, 1080, 8888, 9050, 443, 8118]),
        type, country: c[1], cc: c[0],
        anonymity: rng.pick(['Elite', 'Anonymous', 'Anonymous', 'Transparent']),
        speed, uptime: rng.int(62, 99), checked: `${rng.int(1, 55)} min ago`,
      };
    }).sort((a, b) => a.speed - b.speed);
  }, [seed]);

  const shown = proxies.filter(p => filter === 'All' || p.type === filter);
  const copyAll = () => {
    navigator.clipboard?.writeText(shown.map(p => `${p.ip}:${p.port}`).join('\n'));
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['All', 'HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5'] as const).map(t => (
            <button key={t} type="button" onClick={() => setFilter(t)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>{t}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSeed(Date.now().toString())} className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700">Refresh list</button>
          <button type="button" onClick={copyAll} className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-700">{copied ? 'Copied!' : `Copy ${shown.length} as IP:PORT`}</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Proxies listed</p><p className="text-2xl font-bold text-slate-800">{shown.length}</p></div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Elite (high anonymity)</p><p className="text-2xl font-bold text-emerald-600">{shown.filter(p => p.anonymity === 'Elite').length}</p></div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Countries</p><p className="text-2xl font-bold text-slate-800">{new Set(shown.map(p => p.cc)).size}</p></div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Fastest</p><p className="text-2xl font-bold text-indigo-600">{shown[0]?.speed ?? 0} ms</p></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
              {['IP Address', 'Port', 'Type', 'Country', 'Anonymity', 'Speed', 'Uptime', 'Checked'].map(h => <th key={h} className="text-left px-4 py-2.5 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {shown.map(p => (
                <tr key={p.ip + p.port} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-slate-800">{p.ip}</td>
                  <td className="px-4 py-2 font-mono text-slate-600">{p.port}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.type.startsWith('SOCKS') ? 'bg-violet-50 text-violet-700' : p.type === 'HTTPS' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.type}</span></td>
                  <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{flagEmoji(p.cc)} {p.country}</td>
                  <td className={`px-4 py-2 font-semibold ${p.anonymity === 'Elite' ? 'text-emerald-600' : p.anonymity === 'Anonymous' ? 'text-indigo-600' : 'text-amber-600'}`}>{p.anonymity}</td>
                  <td className={`px-4 py-2 ${p.speed < 800 ? 'text-emerald-600 font-semibold' : p.speed < 2000 ? 'text-slate-700' : 'text-red-500'}`}>{p.speed} ms</td>
                  <td className="px-4 py-2 text-slate-600">{p.uptime}%</td>
                  <td className="px-4 py-2 text-slate-400 whitespace-nowrap">{p.checked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Section title="Proxy anonymity levels explained">
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4"><p className="font-bold text-emerald-700 mb-1">Elite</p><p className="text-slate-600">Hides your IP and does not reveal that a proxy is in use. Best for privacy.</p></div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4"><p className="font-bold text-indigo-700 mb-1">Anonymous</p><p className="text-slate-600">Hides your real IP but sends headers that reveal a proxy is being used.</p></div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4"><p className="font-bold text-amber-700 mb-1">Transparent</p><p className="text-slate-600">Forwards your real IP in headers. Only useful for caching, not anonymity.</p></div>
        </div>
        <p className="text-xs text-slate-400 mt-4">Free public proxies are illustrative here and are inherently unreliable and unsafe for logins or payments. Never send credentials through an untrusted proxy.</p>
      </Section>
    </div>
  );
};

// ---------- 6. Class C IP Checker ----------
export const ClassCTool: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<{ host: string; ip: string; classC: string; cls: string; live: boolean }[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const hosts = Array.from(new Set(text.split(/[\n,\s]+/).map(h => h.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()).filter(Boolean))).slice(0, 20);
    if (!hosts.length) return;
    setLoading(true);
    const out = await Promise.all(hosts.map(async host => {
      let ip = '';
      let live = false;
      if (isValidIp(host) && detectVersion(host) === 'IPv4') { ip = host; live = true; }
      else {
        // Browsers cannot resolve DNS; derive a stable illustrative IPv4 per host
        const rng = new Seeded('classc|' + host);
        ip = `${rng.int(23, 216)}.${rng.int(1, 254)}.${rng.int(1, 254)}.${rng.int(2, 253)}`;
      }
      const parts = ip.split('.');
      return { host, ip, classC: `${parts[0]}.${parts[1]}.${parts[2]}.*`, cls: classOf(ip), live };
    }));
    setRows(out);
    setLoading(false);
  };

  const groups = useMemo(() => {
    if (!rows) return [];
    const m = new Map<string, string[]>();
    rows.forEach(r => m.set(r.classC, [...(m.get(r.classC) || []), r.host]));
    return Array.from(m.entries()).filter(([, hosts]) => hosts.length > 1);
  }, [rows]);

  return (
    <div className="space-y-5">
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} rows={7} spellCheck={false}
        className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono" />
      <PrimaryBtn type="button" onClick={run} disabled={loading || !text.trim()}>{loading ? 'Checking…' : 'Check Class C Ranges'}</PrimaryBtn>
      {rows && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Hosts checked</p><p className="text-2xl font-bold text-slate-800">{rows.length}</p></div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Unique Class C blocks</p><p className="text-2xl font-bold text-slate-800">{new Set(rows.map(r => r.classC)).size}</p></div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100"><p className="text-xs text-slate-500">Shared ranges found</p><p className={`text-2xl font-bold ${groups.length ? 'text-amber-600' : 'text-emerald-600'}`}>{groups.length}</p></div>
          </div>
          {groups.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Shared Class C ranges detected</p>
              {groups.map(([range, hosts]) => <p key={range}><span className="font-mono">{range}</span> → {hosts.join(', ')}</p>)}
              <p className="text-xs mt-2 text-amber-700">Sites linking to each other from the same Class C block look like a private network to search engines. Diversify hosting if these are meant to appear independent.</p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500"><th className="text-left px-4 py-2.5">Host</th><th className="text-left px-4 py-2.5">IP Address</th><th className="text-left px-4 py-2.5">Class C Range</th><th className="text-left px-4 py-2.5">IP Class</th><th className="text-left px-4 py-2.5">Decimal</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.host} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{r.host}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{r.ip}{!r.live && <span className="ml-1 text-[10px] text-amber-600">≈</span>}</td>
                    <td className="px-4 py-2 font-mono text-indigo-700">{r.classC}</td>
                    <td className="px-4 py-2 text-slate-600">Class {r.cls}</td>
                    <td className="px-4 py-2 font-mono text-slate-500">{ipToNumber(r.ip).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Section title="What is a Class C IP?">
            <p className="text-sm text-slate-600 leading-relaxed">In an IPv4 address like <span className="font-mono">203.0.113.45</span>, the first three octets (<span className="font-mono">203.0.113</span>) form the Class C block, covering 256 addresses. Search engines have long used shared Class C ranges as one signal that a group of linking sites may be owned or hosted together, so link builders check this to make sure backlinks come from genuinely diverse networks.</p>
            <p className="text-xs text-slate-400 mt-3">Browsers cannot perform DNS lookups, so domain-derived IPs (marked ≈) are illustrative; enter IP addresses directly for exact results.</p>
          </Section>
        </>
      )}
    </div>
  );
};
