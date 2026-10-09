// Free, keyless IP geolocation helpers with layered fallbacks.
// Requests fire only when a user runs a tool — never on page load.

export interface IpInfo {
  ip: string;
  version: 'IPv4' | 'IPv6' | 'Unknown';
  city: string;
  region: string;
  regionCode: string;
  country: string;
  countryCode: string;
  continent: string;
  postal: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  utcOffset: string;
  currency: string;
  callingCode: string;
  languages: string;
  capital: string;
  borders: string;
  isp: string;
  org: string;
  asn: string;
  hostname: string;
  isEU: boolean | null;
  source: string;
}

const withTimeout = (ms: number) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

const empty = (ip = ''): IpInfo => ({
  ip, version: detectVersion(ip), city: '', region: '', regionCode: '', country: '', countryCode: '',
  continent: '', postal: '', latitude: null, longitude: null, timezone: '', utcOffset: '', currency: '',
  callingCode: '', languages: '', capital: '', borders: '', isp: '', org: '', asn: '', hostname: '', isEU: null, source: '',
});

export const detectVersion = (ip: string): IpInfo['version'] => {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return 'IPv4';
  if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(':')) return 'IPv6';
  return 'Unknown';
};

export const isValidIp = (ip: string): boolean => {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return ip.split('.').every(o => Number(o) <= 255);
  return /^[0-9a-f:]{2,}$/i.test(ip) && ip.includes(':');
};

export const isPrivateIp = (ip: string): boolean =>
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(ip);

// ---- Public IP detection (ipify, then fallbacks) ----
export async function getMyIp(): Promise<{ v4: string; v6: string }> {
  const out = { v4: '', v6: '' };
  const tryFetch = async (url: string) => {
    try {
      const res = await fetch(url, { signal: withTimeout(6000) });
      if (!res.ok) return '';
      const j = await res.json();
      return (j.ip || '').trim();
    } catch { return ''; }
  };
  const [v4, v6] = await Promise.all([
    tryFetch('https://api.ipify.org?format=json'),
    tryFetch('https://api64.ipify.org?format=json'),
  ]);
  out.v4 = v4;
  out.v6 = v6 && v6 !== v4 ? v6 : '';
  if (!out.v4 && !out.v6) {
    const alt = await tryFetch('https://ipapi.co/json/');
    if (alt) { if (detectVersion(alt) === 'IPv6') out.v6 = alt; else out.v4 = alt; }
  }
  return out;
}

// ---- Full geolocation for an IP (or the caller's own IP when blank) ----
export async function lookupIp(ip = ''): Promise<IpInfo | null> {
  // Provider 1: ipwho.is (HTTPS, keyless, rich ISP/ASN data, generous limits)
  try {
    const res = await fetch(`https://ipwho.is/${ip}`, { signal: withTimeout(7000) });
    if (res.ok) {
      const j = await res.json();
      if (j.success !== false && j.ip) {
        return {
          ...empty(j.ip),
          city: j.city || '', region: j.region || '', regionCode: j.region_code || '',
          country: j.country || '', countryCode: j.country_code || '',
          continent: j.continent ? `${j.continent}${j.continent_code ? ' (' + j.continent_code + ')' : ''}` : (j.continent_code || ''),
          postal: j.postal || '',
          latitude: typeof j.latitude === 'number' ? j.latitude : null,
          longitude: typeof j.longitude === 'number' ? j.longitude : null,
          timezone: j.timezone?.id || '', utcOffset: j.timezone?.utc || '',
          currency: j.currency ? `${j.currency.code || ''}${j.currency.name ? ' (' + j.currency.name + ')' : ''}${j.currency.symbol ? ' ' + j.currency.symbol : ''}` : '',
          callingCode: j.calling_code ? '+' + j.calling_code : '', languages: '',
          capital: j.capital || '', borders: j.borders || '',
          isp: j.connection?.isp || '', org: j.connection?.org || '',
          asn: j.connection?.asn ? 'AS' + j.connection.asn : '', hostname: j.connection?.domain || '',
          isEU: typeof j.is_eu === 'boolean' ? j.is_eu : null, source: 'ipwho.is',
        };
      }
    }
  } catch { /* fall through */ }

  // Provider 2: ipapi.co (HTTPS, may rate-limit)
  try {
    const res = await fetch(`https://ipapi.co/${ip ? ip + '/' : ''}json/`, { signal: withTimeout(7000) });
    if (res.ok) {
      const j = await res.json();
      if (!j.error && j.ip) {
        return {
          ...empty(j.ip),
          city: j.city || '', region: j.region || '', regionCode: j.region_code || '',
          country: j.country_name || '', countryCode: j.country_code || '',
          continent: j.continent_code || '', postal: j.postal || '',
          latitude: typeof j.latitude === 'number' ? j.latitude : null,
          longitude: typeof j.longitude === 'number' ? j.longitude : null,
          timezone: j.timezone || '', utcOffset: j.utc_offset || '', currency: j.currency ? `${j.currency}${j.currency_name ? ' (' + j.currency_name + ')' : ''}` : '',
          callingCode: j.country_calling_code || '', languages: j.languages || '',
          capital: j.country_capital || '', borders: '',
          isp: j.org || '', org: j.org || '', asn: j.asn || '', hostname: '',
          isEU: typeof j.in_eu === 'boolean' ? j.in_eu : null, source: 'ipapi.co',
        };
      }
    }
  } catch { /* fall through */ }

  // Provider 3: freeipapi.com (HTTPS, keyless)
  try {
    const res = await fetch(`https://freeipapi.com/api/json/${ip}`, { signal: withTimeout(7000) });
    if (res.ok) {
      const j = await res.json();
      if (j.ipAddress) {
        return {
          ...empty(j.ipAddress),
          city: j.cityName || '', region: j.regionName || '', regionCode: '',
          country: j.countryName || '', countryCode: j.countryCode || '',
          continent: j.continent || '', postal: j.zipCode || '',
          latitude: typeof j.latitude === 'number' ? j.latitude : null,
          longitude: typeof j.longitude === 'number' ? j.longitude : null,
          timezone: Array.isArray(j.timeZones) ? j.timeZones[0] || '' : '', utcOffset: '',
          currency: j.currency?.code ? `${j.currency.code}${j.currency.name ? ' (' + j.currency.name + ')' : ''}` : '',
          callingCode: '', languages: Array.isArray(j.languages) ? j.languages.join(', ') : '',
          capital: '', borders: '',
          isp: '', org: '', asn: '', hostname: '',
          isEU: null, source: 'freeipapi.com',
        };
      }
    }
  } catch { /* fall through */ }

  return null;
}

// Approximate distance between two coordinates in km
export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const ipToNumber = (ip: string): number =>
  ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0) >>> 0;

export const classOf = (ip: string): string => {
  const first = Number(ip.split('.')[0]);
  if (first < 128) return 'A';
  if (first < 192) return 'B';
  if (first < 224) return 'C';
  if (first < 240) return 'D (multicast)';
  return 'E (reserved)';
};

export const flagEmoji = (cc: string): string =>
  cc && cc.length === 2
    ? String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)))
    : '';

// ---- DNS-over-HTTPS (dns.google, CORS-open, keyless) ----
// Browsers cannot use the native resolver, but DoH is a plain HTTPS JSON API,
// so these are REAL lookups — not simulated.
export interface DohAnswer { name: string; type: number; TTL: number; data: string }
export interface DohResult { Status: number; Answer?: DohAnswer[] }

export async function dohQuery(name: string, type: string, ms = 8000): Promise<DohAnswer[]> {
  const providers = [
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
  ];
  for (const url of providers) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/dns-json' }, signal: withTimeout(ms) });
      if (!res.ok) continue;
      const j = (await res.json()) as DohResult;
      return j.Answer ?? [];
    } catch { /* try next provider */ }
  }
  return [];
}

/** Real IPv4 addresses a domain resolves to (empty when none/unresolvable). */
export async function resolveA(host: string): Promise<string[]> {
  const answers = await dohQuery(host, 'A');
  return answers.map(a => a.data).filter(d => /^(\d{1,3}\.){3}\d{1,3}$/.test(d));
}

/** Real IPv6 addresses a domain resolves to. */
export async function resolveAAAA(host: string): Promise<string[]> {
  const answers = await dohQuery(host, 'AAAA');
  return answers.map(a => a.data).filter(d => d.includes(':'));
}

/** Real reverse-DNS (PTR) hostnames for an IP. */
export async function resolvePtr(ip: string): Promise<string[]> {
  if (detectVersion(ip) !== 'IPv4') return [];
  const arpa = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  const answers = await dohQuery(arpa, 'PTR');
  return answers.map(a => a.data.replace(/\.$/, '')).filter(Boolean);
}

/** Resolve a domain-or-IP to a single IPv4 (input passes through when already an IP). */
export async function toIpv4(hostOrIp: string): Promise<string> {
  const v = hostOrIp.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return v;
  const a = await resolveA(v);
  return a[0] || '';
}

// ---- Reverse IP (domains sharing an IP) via HackerTarget through a CORS relay ----
const HT_RELAY = (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;

/**
 * Real list of domains observed pointing at an IP (HackerTarget passive DNS).
 * Fetched through a CORS relay; returns [] when unavailable so callers can show
 * an honest "no data" state instead of invented results.
 */
export async function reverseIpDomains(ip: string): Promise<{ domains: string[]; error?: string }> {
  const target = `https://api.hackertarget.com/reverseiplookup/?q=${encodeURIComponent(ip)}`;
  try {
    const res = await fetch(HT_RELAY(target), { signal: withTimeout(15000) });
    if (!res.ok) return { domains: [], error: `Reverse-IP service responded with HTTP ${res.status}.` };
    const text = (await res.text()).trim();
    if (!text) return { domains: [] };
    if (/^error\b/i.test(text)) return { domains: [], error: text.replace(/^error:?\s*/i, '') };
    const domains = text
      .split(/\r?\n/)
      .map(l => l.trim().toLowerCase())
      .filter(l => l && l.includes('.') && !/\s/.test(l));
    return { domains };
  } catch {
    return { domains: [], error: 'The reverse-IP service could not be reached (it may be rate-limiting). Try again shortly.' };
  }
}

// ---- Real public proxy list (ProxyScrape mirror on jsDelivr; CORS-open, keyless) ----
export interface ProxyEntry {
  protocol: string; ip: string; port: number; country: string; country_code: string;
  city: string; anonymity: string; ssl: boolean; uptime_percent: number; asn: string;
  isp: string; latency_ms: number; last_checked: number;
}
export interface ProxyStats {
  total: number; by_protocol: Record<string, number>; country_count: number; by_country: Record<string, number>;
}

const PROXY_BASE = 'https://cdn.jsdelivr.net/gh/proxyscrape/free-proxy-list@main/proxies';
export const PROXY_PROTOCOLS = ['http', 'https', 'socks4', 'socks5'] as const;
export type ProxyProtocol = typeof PROXY_PROTOCOLS[number];

export async function fetchProxyStats(): Promise<ProxyStats | null> {
  try {
    const res = await fetch(`${PROXY_BASE}/stats.json`, { signal: withTimeout(12000) });
    if (!res.ok) return null;
    return (await res.json()) as ProxyStats;
  } catch { return null; }
}

export async function fetchProxyList(protocol: ProxyProtocol): Promise<ProxyEntry[]> {
  const res = await fetch(`${PROXY_BASE}/protocols/${protocol}/data.json`, { signal: withTimeout(20000) });
  if (!res.ok) throw new Error(`Proxy list unavailable (HTTP ${res.status}).`);
  const j = (await res.json()) as ProxyEntry[];
  return Array.isArray(j) ? j : [];
}

/** Relative "checked X ago" from a unix-seconds timestamp. */
export const checkedAgo = (unixSeconds: number): string => {
  if (!unixSeconds) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// ---- IP WHOIS / registration data (RDAP via rdap.org; CORS-open, keyless) ----
export interface IpWhois {
  handle?: string; name?: string; country?: string; type?: string;
  startAddress?: string; endAddress?: string; cidr?: string;
  org?: string; abuseEmail?: string; abusePhone?: string;
  registered?: string; changed?: string; source?: string;
}

export async function ipWhois(ip: string): Promise<IpWhois | null> {
  try {
    const res = await fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/rdap+json, application/json' }, signal: withTimeout(10000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const events: { eventAction?: string; eventDate?: string }[] = Array.isArray(j.events) ? j.events : [];
    const ev = (action: string) => events.find(e => e.eventAction === action)?.eventDate;
    type Entity = { roles?: string[]; vcardArray?: [string, unknown[]][]; entities?: Entity[] };
    // ARIN nests abuse/tech contacts inside the registrant's own entities — flatten.
    const flat: Entity[] = [];
    const walk = (list: Entity[] | undefined) => (list || []).forEach(e => { flat.push(e); walk(e.entities); });
    walk(Array.isArray(j.entities) ? j.entities : []);
    const vcardVal = (entity: Entity | undefined, key: string): string | undefined => {
      const props = entity?.vcardArray?.[1];
      if (!Array.isArray(props)) return undefined;
      const hit = props.find(p => Array.isArray(p) && p[0] === key);
      return Array.isArray(hit) && typeof hit[3] === 'string' ? (hit[3] as string) : undefined;
    };
    const abuse = flat.find(e => Array.isArray(e.roles) && e.roles.includes('abuse'));
    const registrant = flat.find(e => Array.isArray(e.roles) && e.roles.includes('registrant'));
    const cidrArr: { v4prefix?: string; v6prefix?: string; length?: number }[] = Array.isArray(j.cidr0_cidrs) ? j.cidr0_cidrs : [];
    const cidr = cidrArr[0] && cidrArr[0].length != null
      ? `${cidrArr[0].v4prefix || cidrArr[0].v6prefix || ''}/${cidrArr[0].length}`
      : undefined;
    return {
      handle: typeof j.handle === 'string' ? j.handle : undefined,
      name: typeof j.name === 'string' ? j.name : undefined,
      country: typeof j.country === 'string' ? j.country : undefined,
      type: typeof j.type === 'string' ? j.type : undefined,
      startAddress: typeof j.startAddress === 'string' ? j.startAddress : undefined,
      endAddress: typeof j.endAddress === 'string' ? j.endAddress : undefined,
      cidr,
      org: vcardVal(registrant, 'fn'),
      abuseEmail: vcardVal(abuse, 'email'),
      abusePhone: vcardVal(abuse, 'tel'),
      registered: ev('registration'), changed: ev('last changed'), source: 'RDAP (RIR)',
    };
  } catch { return null; }
}
