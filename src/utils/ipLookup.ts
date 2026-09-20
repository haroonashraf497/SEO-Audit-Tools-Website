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
