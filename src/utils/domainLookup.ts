// Lightweight RDAP lookup. RDAP is the standard registry protocol and, unlike
// scraped WHOIS pages, exposes domain registration and expiration events over CORS.

export interface DomainInfo {
  domain: string;
  live: boolean;
  source: string;
  registrar: string;
  registryId: string;
  registered: string;
  registeredIso: string;
  expiry: string;
  expiryIso: string;
  updated: string;
  ageLabel: string;
  daysToExpiry: number | null;
  statuses: string[];
  nameservers: string[];
  dnssec: boolean | null;
  error?: string;
}

const empty = (domain: string, error?: string): DomainInfo => ({
  domain,
  live: false,
  source: '',
  registrar: '',
  registryId: '',
  registered: '',
  registeredIso: '',
  expiry: '',
  expiryIso: '',
  updated: '',
  ageLabel: 'Unavailable',
  daysToExpiry: null,
  statuses: [],
  nameservers: [],
  dnssec: null,
  error,
});

const timeout = (ms: number) => AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
const eventDate = (events: unknown, action: string): string => {
  if (!Array.isArray(events)) return '';
  const event = events.find((item: unknown) => {
    const obj = item as { eventAction?: string };
    return obj.eventAction?.toLowerCase() === action;
  }) as { eventDate?: string } | undefined;
  return event?.eventDate || '';
};
const formatDate = (value: string): string => {
  if (!value) return '';
  const date = new Date(value);
  // Format in UTC: registry event dates are UTC timestamps (e.g. Verisign uses
  // 04:00Z = midnight US Eastern), so converting to the viewer's local
  // timezone can shift the displayed day by one. WHOIS services publish the
  // UTC date, so UTC keeps the tool consistent with them worldwide.
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const age = (registered: string): string => {
  const date = new Date(registered);
  if (!registered || Number.isNaN(date.getTime())) return 'Unavailable';
  const now = new Date();
  // Calendar arithmetic rather than 365.25-day rounding keeps leap years and
  // month boundaries accurate to the actual registry registration date.
  let years = now.getUTCFullYear() - date.getUTCFullYear();
  let months = now.getUTCMonth() - date.getUTCMonth();
  let days = now.getUTCDate() - date.getUTCDate();
  if (days < 0) {
    months--;
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    days += lastMonth.getUTCDate();
  }
  if (months < 0) { years--; months += 12; }
  if (years < 0) return 'Not yet active';
  const parts = years ? [`${years} year${years === 1 ? '' : 's'}`] : [];
  if (months || !years) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (!years && days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  return parts.join(', ');
};
const registrarName = (entities: unknown): string => {
  if (!Array.isArray(entities)) return '';
  const registrar = entities.find((entity: unknown) => Array.isArray((entity as { roles?: string[] }).roles) && (entity as { roles: string[] }).roles.some(role => role.toLowerCase() === 'registrar')) as { vcardArray?: unknown[]; handle?: string } | undefined;
  if (!registrar) return '';
  const card = registrar.vcardArray?.[1];
  if (Array.isArray(card)) {
    const fn = card.find((value: unknown) => Array.isArray(value) && value[0] === 'fn') as unknown[] | undefined;
    if (fn?.[3]) return String(fn[3]);
  }
  return registrar.handle || '';
};

export const fetchDomainInfo = async (input: string): Promise<DomainInfo> => {
  let host = input.trim();
  try { host = new URL(/^https?:\/\//i.test(host) ? host : `https://${host}`).hostname; } catch { host = host.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].split(':')[0]; }
  host = host.replace(/^www\./i, '').toLowerCase().replace(/\.$/, '');
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return empty(host || 'Unknown', 'RDAP only supports public domain names.');

  // First try the exact hostname, then progressively remove left-side
  // subdomains. This makes www/store/blog.example.com resolve to the actual
  // registrable domain instead of reporting an inaccurate unavailable age.
  const labels = host.split('.');
  const candidates = Array.from({ length: Math.max(1, labels.length - 1) }, (_, i) => labels.slice(i).join('.')).filter(d => d.split('.').length >= 2);
  let response: Response | null = null;
  let domain = host;
  let lastStatus = 0;
  for (const candidate of candidates) {
    try {
      const current = await fetch(`https://rdap.org/domain/${encodeURIComponent(candidate)}`, { signal: timeout(8000), headers: { Accept: 'application/rdap+json, application/json' } });
      if (current.ok) { response = current; domain = candidate; break; }
      lastStatus = current.status;
      // 404 means the hostname is probably a subdomain; try its parent.
      if (current.status !== 404) break;
    } catch { /* Try parent candidate. */ }
  }
  if (!response) return empty(host, lastStatus ? `Registry lookup returned HTTP ${lastStatus}.` : 'Registry information could not be reached from this browser.');
  try {
    const data = await response.json() as {
      ldhName?: string; handle?: string; events?: unknown[]; entities?: unknown[]; status?: string[];
      nameservers?: { ldhName?: string }[]; secureDNS?: { delegationSigned?: boolean };
    };
    const registeredRaw = eventDate(data.events, 'registration');
    const expiryRaw = eventDate(data.events, 'expiration') || eventDate(data.events, 'registrar expiration');
    const expiryDate = expiryRaw ? new Date(expiryRaw) : null;
    const daysToExpiry = expiryDate && !Number.isNaN(expiryDate.getTime()) ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000) : null;
    return {
      domain: data.ldhName?.toLowerCase() || domain,
      live: true,
      source: 'RDAP registry',
      registrar: registrarName(data.entities),
      registryId: data.handle || '',
      registered: formatDate(registeredRaw),
      registeredIso: registeredRaw,
      expiry: formatDate(expiryRaw),
      expiryIso: expiryRaw,
      updated: formatDate(eventDate(data.events, 'last changed')),
      ageLabel: age(registeredRaw),
      daysToExpiry,
      statuses: Array.isArray(data.status) ? data.status : [],
      nameservers: Array.isArray(data.nameservers) ? data.nameservers.map(ns => ns.ldhName || '').filter(Boolean) : [],
      dnssec: typeof data.secureDNS?.delegationSigned === 'boolean' ? data.secureDNS.delegationSigned : null,
    };
  } catch {
    return empty(domain, 'Registry information could not be reached from this browser.');
  }
};