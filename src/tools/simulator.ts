// Deterministic pseudo-random generator so results are stable per input
const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export class Seeded {
  private state: number;
  constructor(seed: string) {
    this.state = hashString(seed) || 1;
  }
  next(): number {
    // xorshift32
    let x = this.state;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    this.state = x || 1;
    return (x >>> 0) / 4294967296;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

export type RowStatus = 'good' | 'warn' | 'bad' | 'info';
export interface ReportRow { label: string; value: string; status: RowStatus; note?: string }
export interface ReportTable { headers: string[]; rows: string[][] }
export interface SimReport {
  headline: string;
  summary: string;
  rows: ReportRow[];
  table?: ReportTable;
}

const cleanDomain = (input: string): string =>
  input.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() || 'example.com';

const daysAgo = (rng: Seeded, min: number, max: number): string => {
  const d = new Date(Date.now() - rng.int(min, max) * 86400000);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusForScore = (s: number): RowStatus => (s >= 70 ? 'good' : s >= 40 ? 'warn' : 'bad');

const r = (label: string, value: string, status: RowStatus, note?: string): ReportRow => ({ label, value, status, note });

// ---------- Keyword suggestion tables ----------
const modifiers = ['best', 'top', 'free', 'cheap', 'online', 'how to', 'what is', 'near me', 'for beginners', 'guide', 'review', 'vs', 'alternative', '2025', 'professional', 'small business'];
const suffixes = ['services', 'tools', 'tips', 'ideas', 'examples', 'checklist', 'pricing', 'benefits', 'mistakes', 'strategy'];

const keywordTable = (seed: string, count: number, rng: Seeded, includeDifficulty = true): ReportTable => {
  const words = seed.toLowerCase().trim().split(/\s+/).slice(0, 3);
  const variants = new Set<string>();
  variants.add(words.join(' '));
  variants.add(`best ${words.join(' ')}`);
  while (variants.size < count) {
    const m = rng.pick(modifiers);
    const s = rng.pick(suffixes);
    const v = rng.next() > 0.5 ? `${m} ${words.join(' ')}` : `${words.join(' ')} ${s}`;
    variants.add(v);
  }
  return {
    headers: includeDifficulty ? ['Keyword', 'Volume / mo', 'CPC', 'Difficulty'] : ['Keyword', 'Volume / mo'],
    rows: Array.from(variants).slice(0, count).map(k => {
      const vol = rng.pick([70, 110, 170, 260, 390, 590, 880, 1300, 2400, 4400, 8100, 12000]);
      const base = [k, vol.toLocaleString()];
      if (includeDifficulty) {
        const cpc = (rng.next() * 9 + 0.3).toFixed(2);
        const d = rng.int(8, 92);
        base.push(`$${cpc}`, d > 65 ? `Hard (${d})` : d > 35 ? `Medium (${d})` : `Easy (${d})`);
      }
      return base;
    }),
  };
};

// ---------- Main report builder ----------
export const buildReport = (slug: string, rawInput: string, rawInput2?: string, live?: import('../utils/pageFetch').LivePageData | null): SimReport => {
  const input = rawInput.trim() || 'example.com';
  const domain = cleanDomain(input);
  const domain2 = rawInput2 ? cleanDomain(rawInput2) : '';
  const rng = new Seeded(slug + '|' + input + '|' + (rawInput2 || ''));

  switch (slug) {
    // ---- Authority / score tools ----
    case 'domain-authority-checker': {
      const da = rng.int(18, 88);
      return {
        headline: `Domain Authority for ${domain}`,
        summary: 'Authority scores are estimates based on link profile quality and quantity.',
        rows: [
          r('Domain Authority', `${da}/100`, statusForScore(da)),
          r('Linking Root Domains', rng.int(40, 4800).toLocaleString(), 'info'),
          r('Total Backlinks', rng.int(800, 480000).toLocaleString(), 'info'),
          r('Spam Score', `${(rng.next() * 12).toFixed(1)}%`, rng.next() > 0.7 ? 'warn' : 'good'),
        ],
      };
    }
    case 'page-authority-checker':
    case 'mozrank-checker': {
      const pa = rng.int(20, 85);
      const isPA = slug === 'page-authority-checker';
      return {
        headline: `${isPA ? 'Page Authority' : 'MozRank'} report`,
        summary: isPA ? 'Prediction of how well this specific page will rank.' : 'Link popularity on a scale from 0 to 10.',
        rows: [
          r(isPA ? 'Page Authority' : 'MozRank', isPA ? `${pa}/100` : `${(pa / 10).toFixed(2)}/10`, statusForScore(pa)),
          r('External links to page', rng.int(5, 900).toLocaleString(), 'info'),
          r('Equity-passing links', rng.int(4, 800).toLocaleString(), 'info'),
          r('HTTP status', '200 OK', 'good'),
        ],
      };
    }
    case 'alexa-rank-checker': {
      const global = rng.int(40000, 9000000);
      return {
        headline: `Traffic rank for ${domain}`,
        summary: 'Estimated global popularity based on aggregated browsing and traffic data.',
        rows: [
          r('Global Rank', `#${global.toLocaleString()}`, global < 500000 ? 'good' : global < 3000000 ? 'warn' : 'bad'),
          r('Country Rank', `#${rng.int(800, 120000).toLocaleString()} (${rng.pick(['United States', 'United Kingdom', 'India', 'Canada'])})`, 'info'),
          r('Daily Visitors', rng.int(120, 42000).toLocaleString(), 'info'),
          r('Bounce Rate', `${rng.int(28, 78)}%`, 'info'),
        ],
      };
    }

    // ---- Indexing / cache ----
    case 'google-index-checker': {
      const indexed = rng.int(40, 320);
      const submitted = indexed + rng.int(0, 60);
      return {
        headline: `Index status for ${domain}`,
        summary: 'Pages currently included in Google\u2019s index versus discoverable URLs.',
        rows: [
          r('Pages Indexed', `${indexed}`, indexed / submitted > 0.85 ? 'good' : indexed / submitted > 0.6 ? 'warn' : 'bad'),
          r('Pages Discovered', `${submitted}`, 'info'),
          r('Index Coverage', `${Math.round((indexed / submitted) * 100)}%`, 'info'),
          r('Sitemap Found', rng.next() > 0.15 ? 'Yes (/sitemap_index.xml)' : 'Not found', rng.next() > 0.15 ? 'good' : 'warn'),
        ],
      };
    }
    case 'google-cache-checker':
      return {
        headline: `Cache status for ${domain}`,
        summary: 'The most recent snapshot Google stored while crawling.',
        rows: [
          r('Cached Version', rng.next() > 0.2 ? 'Available' : 'Not cached', rng.next() > 0.2 ? 'good' : 'warn'),
          r('Last Crawled', daysAgo(rng, 1, 18), 'info'),
          r('Crawl Frequency', rng.pick(['Daily', 'Every 2\u20133 days', 'Weekly', 'Monthly']), 'info'),
          r('Cache Type', rng.pick(['Full page', 'Text-only snapshot']), 'info'),
        ],
      };

    // ---- Security ----
    case 'ssl-checker': {
      const valid = rng.next() > 0.2;
      return {
        headline: `SSL certificate for ${domain}`,
        summary: 'Certificate validity, issuer and connection encryption details.',
        rows: [
          r('HTTPS Enabled', valid ? 'Yes' : 'Certificate error', valid ? 'good' : 'bad'),
          r('Issuer', rng.pick(['Let\u2019s Encrypt R3', 'Google Trust Services', 'DigiCert SHA2', 'Cloudflare Inc ECC CA-3']), 'info'),
          r('Protocol', rng.pick(['TLS 1.3', 'TLS 1.2', 'TLS 1.2']), 'good'),
          r('Certificate Expiry', `In ${rng.int(12, 85)} days`, valid ? 'good' : 'bad'),
        ],
      };
    }
    case 'google-malware-checker':
    case 'blacklist-lookup': {
      const clean = rng.next() > 0.18;
      return {
        headline: slug === 'blacklist-lookup' ? `Blacklist status for ${domain}` : `Malware scan for ${domain}`,
        summary: 'Checked against major security and spam databases.',
        rows: [
          r('Google Safe Browsing', clean ? 'No issues found' : 'Suspicious activity', clean ? 'good' : 'bad'),
          r('Spamhaus / SURBL', clean ? 'Not listed' : 'Listed', clean ? 'good' : 'bad'),
          r('Phishing Signals', clean ? 'None detected' : 'Possible phishing', clean ? 'good' : 'bad'),
          r('Malware Databases Checked', '36', 'info'),
        ],
      };
    }
    case 'cloaking-checker':
      return {
        headline: `Cloaking analysis for ${domain}`,
        summary: 'Compares the HTML served to Googlebot with the HTML shown to browsers.',
        rows: [
          r('Googlebot vs Browser Content', rng.next() > 0.12 ? 'Identical' : 'Differences detected', rng.next() > 0.12 ? 'good' : 'bad'),
          r('User-Agent Redirects', rng.next() > 0.2 ? 'None' : 'Suspicious redirect', rng.next() > 0.2 ? 'good' : 'bad'),
          r('Hidden Text/Links', rng.next() > 0.15 ? 'None found' : 'Hidden elements found', rng.next() > 0.15 ? 'good' : 'warn'),
          r('Risk Level', rng.pick(['Low', 'Low', 'Medium']), 'info'),
        ],
      };
    case 'check-gzip-compression': {
      const enabled = rng.next() > 0.25;
      const original = rng.int(180, 900);
      return {
        headline: `Compression check for ${domain}`,
        summary: 'Server-level compression dramatically reduces transfer size.',
        rows: [
          r('Compression', enabled ? 'Gzip / Brotli enabled' : 'Not enabled', enabled ? 'good' : 'bad'),
          ...(enabled ? [
            r('Original Size', `${original} KB`, 'info'),
            r('Compressed Size', `${Math.round(original * rng.pick([0.22, 0.28, 0.32]))} KB`, 'good'),
            r('Bandwidth Saved', `${rng.int(66, 82)}%`, 'good'),
          ] : [r('Content-Encoding Header', 'Missing', 'bad'), r('Estimated Savings', `~70%`, 'warn')]),
        ],
      };
    }

    // ---- Redirects / status ----
    case 'redirect-checker':
    case 'server-status-checker': {
      const chain: string[] = [];
      let code = rng.pick([200, 200, 301, 302]);
      let url = input.startsWith('http') ? input : `https://${domain}/`;
      if (code !== 200) {
        chain.push(`${code}  ${url}`);
        code = rng.next() > 0.3 ? 301 : 302;
        chain.push(`${code}  ${url.replace(/\/$/, '')}/new-location`);
      }
      chain.push(`200  https://${domain}/final-page`);
      return {
        headline: 'Redirect trace',
        summary: chain.length > 1 ? `Found a ${chain.length - 1}-hop redirect chain.` : 'URL responds directly with no redirects.',
        rows: [
          r('Final Status Code', '200 OK', 'good'),
          r('Redirect Hops', `${Math.max(0, chain.length - 1)}`, chain.length > 2 ? 'warn' : 'good'),
          r('Redirect Type', chain.length > 1 ? (chain[0].startsWith('301') ? '301 Permanent' : '302 Temporary') : 'None', 'info'),
          r('HTTPS Redirect', rng.next() > 0.15 ? 'Enforced' : 'Not enforced', rng.next() > 0.15 ? 'good' : 'bad'),
        ],
        table: { headers: ['Step', 'Status', 'URL'], rows: chain.map((c, i) => [String(i + 1), c.split('  ')[0], c.split('  ')[1]]) },
      };
    }

    // ---- Link tools ----
    case 'backlink-checker': {
      const total = rng.int(200, 95000);
      return {
        headline: `Backlink profile for ${domain}`,
        summary: 'All links pointing at the domain, including quality estimates.',
        rows: [
          r('Total Backlinks', total.toLocaleString(), 'info'),
          r('Referring Domains', Math.round(total / rng.int(6, 20)).toLocaleString(), 'info'),
          r('Dofollow / Nofollow', `${rng.int(55, 85)}% / ${rng.int(15, 45)}%`, 'info'),
          r('Toxic Links Suspected', `${rng.int(0, 14)}%`, rng.next() > 0.6 ? 'warn' : 'good'),
          r('.gov / .edu Links', String(rng.int(0, 40)), 'info'),
        ],
        table: {
          headers: ['Source URL', 'Anchor Text', 'Type', 'DR'],
          rows: Array.from({ length: 6 }, () => [
            `https://${rng.pick(['blog', 'news', 'directory', 'forum', 'review']) + rng.int(10, 999)}.com/post-${rng.int(10, 900)}`,
            rng.pick(['visit website', 'click here', domain, 'read more', 'resource', 'this guide']),
            rng.pick(['Dofollow', 'Nofollow', 'Dofollow', 'UGC']),
            String(rng.int(20, 88)),
          ]),
        },
      };
    }
    case 'website-links-count-checker':
    case 'website-link-analyzer-tool':
      return {
        headline: `Link analysis for ${domain}`,
        summary: 'Complete breakdown of links found on the page.',
        rows: [
          r('Internal Links', String(rng.int(18, 240)), 'info'),
          r('External Links', String(rng.int(2, 60)), 'info'),
          r('Nofollow Links', String(rng.int(0, 18)), 'info'),
          r('Broken Links', String(rng.int(0, 6)), rng.next() > 0.6 ? 'warn' : 'good'),
        ],
      };
    case 'link-tracker':
      return {
        headline: 'Link tracking report',
        summary: 'Live status of the specific link you submitted.',
        rows: [
          r('Link is Live', rng.next() > 0.25 ? 'Yes' : 'Not found', rng.next() > 0.25 ? 'good' : 'bad'),
          r('Page Indexed', rng.next() > 0.35 ? 'Yes' : 'Not yet', rng.next() > 0.35 ? 'good' : 'warn'),
          r('Link Type', rng.pick(['Dofollow', 'Nofollow']), 'info'),
          r('Anchor Found', rng.pick(['Brand name', 'Click here', domain, 'Visit site']), 'info'),
        ],
      };
    case 'link-price-calculator': {
      const monthly = rng.int(40, 2600);
      return {
        headline: 'Estimated link value',
        summary: 'Rough monthly value based on traffic, authority and topical relevance.',
        rows: [
          r('Estimated Monthly Price', `$${monthly.toLocaleString()}`, 'info'),
          r('Estimated Daily Visits', rng.int(80, 9000).toLocaleString(), 'info'),
          r('Source Domain Authority', `${rng.int(25, 82)}/100`, 'info'),
          r('Topical Relevance', rng.pick(['High', 'Medium', 'Low']), 'info'),
        ],
      };
    }
    case 'reciprocal-link-checker': {
      const found = rng.next() > 0.4;
      return {
        headline: 'Reciprocal link result',
        summary: 'Checks whether the partner page links back to your site.',
        rows: [
          r('Partner Links Back', found ? 'Yes \u2013 link found' : 'No backlink detected', found ? 'good' : 'bad'),
          r('Link Attribute', rng.pick(['Dofollow', 'Nofollow']), 'info'),
          r('HTTP Status of Partner Page', '200 OK', 'good'),
          r('Partner Page Authority', `${rng.int(15, 70)}/100`, 'info'),
        ],
      };
    }
    case 'websites-broken-link-checker': {
      const broken = rng.int(0, 12);
      return {
        headline: `Broken link scan for ${domain}`,
        summary: 'Crawled links and flagged every response that is not a 200 OK.',
        rows: [
          r('Links Checked', String(rng.int(40, 600)), 'info'),
          r('Broken Links (4xx/5xx)', String(broken), broken === 0 ? 'good' : broken > 5 ? 'bad' : 'warn'),
          r('Redirects Found', String(rng.int(0, 9)), 'info'),
          r('Crawl Errors', String(broken + rng.int(0, 3)), broken === 0 ? 'good' : 'warn'),
        ],
      };
    }

    // ---- Domain info ----
    case 'domain-age-checker': {
      const years = rng.int(1, 22);
      const created = new Date(Date.now() - years * 365 * 86400000 - rng.int(0, 300) * 86400000);
      return {
        headline: `Age report for ${domain}`,
        summary: 'Registration history and domain maturity.',
        rows: [
          r('Domain Age', `${years} years, ${rng.int(0, 11)} months`, years >= 5 ? 'good' : years >= 2 ? 'warn' : 'bad'),
          r('Created On', created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), 'info'),
          r('Updated On', daysAgo(rng, 30, 400), 'info'),
          r('Expires On', daysAgo(rng, -365, -5), 'info'),
        ],
      };
    }
    case 'whois-checker':
      return {
        headline: `WHOIS data for ${domain}`,
        summary: 'Registration and contact information from the domain registry.',
        rows: [
          r('Registrar', rng.pick(['Namecheap, Inc.', 'GoDaddy.com, LLC', 'Google Domains', 'Cloudflare, Inc.', 'Tucows Domains Inc.']), 'info'),
          r('Registered On', daysAgo(rng, 365, 7000), 'info'),
          r('Expires On', daysAgo(rng, -365, -5), 'info'),
          r('Privacy Protection', rng.pick(['Enabled', 'Enabled', 'Disabled']), 'info'),
          r('Name Servers', `ns1.${rng.pick(['cloudflare.com', 'digitalocean.com', 'dns-pod.com'])}`, 'info'),
        ],
      };
    case 'domain-ip-lookup':
    case 'domain-hosting-checker': {
      const ip = `${rng.int(104, 212)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
      return {
        headline: `Hosting information for ${domain}`,
        summary: 'Server IP, location and hosting provider.',
        rows: [
          r('IP Address', ip, 'info'),
          r('Hosting Provider', rng.pick(['Cloudflare, Inc.', 'Amazon AWS', 'Google Cloud', 'DigitalOcean', 'SiteGround', 'Hostinger']), 'info'),
          r('Server Location', rng.pick(['Ashburn, US', 'London, UK', 'Frankfurt, DE', 'Singapore, SG', 'Sydney, AU']), 'info'),
          r('Reverse IP Neighbours', String(rng.int(2, 900)), 'info'),
        ],
      };
    }
    case 'find-dns-records':
      return {
        headline: `DNS records for ${domain}`,
        summary: 'All active DNS records served by the authoritative nameservers.',
        rows: [r('Nameservers', '2 found', 'good'), r('MX Records', rng.pick(['1 (Google)', '2 (Outlook)', '0']), 'info'), r('TXT / SPF', rng.next() > 0.2 ? 'Present' : 'Missing', rng.next() > 0.2 ? 'good' : 'warn')],
        table: {
          headers: ['Type', 'Host', 'Value', 'TTL'],
          rows: [
            ['A', '@', `${rng.int(104, 212)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`, '300'],
            ['AAAA', '@', '2606:4700::6810:' + rng.int(1000, 9999), '300'],
            ['MX', '@', `mail.${domain}`, '3600'],
            ['TXT', '@', 'v=spf1 include:_spf.google.com ~all', '3600'],
            ['CNAME', 'www', domain, '300'],
          ],
        },
      };

    // ---- Similar page ----
    case 'similar-page-checker': {
      const similarity = rng.int(4, 86);
      return {
        headline: 'Duplicate content comparison',
        summary: 'Percentage of text shared between the two submitted pages.',
        rows: [
          r('Content Similarity', `${similarity}%`, similarity > 60 ? 'bad' : similarity > 30 ? 'warn' : 'good'),
          r('Matching Sentences', String(Math.round(similarity / 4)), 'info'),
          r('Unique Phrases (A)', `${rng.int(60, 98)}%`, 'info'),
          r('Recommendation', similarity > 60 ? 'Rewrite or canonicalize one version' : 'Acceptable level of overlap', similarity > 60 ? 'bad' : 'good'),
        ],
      };
    }

    // ---- Page size ----
    case 'page-size-checker': {
      const size = rng.int(600, 4800);
      return {
        headline: `Page weight for ${domain}`,
        summary: 'Total download size and request count for the full page.',
        rows: [
          r('Total Page Size', `${size} KB`, size < 1500 ? 'good' : size < 3000 ? 'warn' : 'bad'),
          r('HTTP Requests', String(rng.int(24, 180)), 'info'),
          r('Images Weight', `${Math.round(size * rng.int(45, 70) / 100)} KB`, 'info'),
          r('JavaScript Weight', `${Math.round(size * rng.int(12, 30) / 100)} KB`, 'info'),
          r('Estimated Load (4G)', `${(size / 450).toFixed(1)}s`, size < 1500 ? 'good' : 'warn'),
        ],
      };
    }

    // ---- Plagiarism (text) ----
    case 'plagiarism-checker': {
      const words = input.split(/\s+/).filter(Boolean).length;
      const unique = Math.max(40, 100 - rng.int(2, 35));
      return {
        headline: 'Plagiarism scan complete',
        summary: `${words} words scanned against an index of web pages and publications.`,
        rows: [
          r('Unique Content', `${unique}%`, unique >= 85 ? 'good' : unique >= 65 ? 'warn' : 'bad'),
          r('Plagiarized Content', `${100 - unique}%`, 100 - unique <= 15 ? 'good' : 100 - unique <= 35 ? 'warn' : 'bad'),
          r('Sources Compared', '16+ billion pages', 'info'),
          r('Matching Sources', String(Math.round((100 - unique) / 8)), 'info'),
        ],
      };
    }
    case 'image-to-text-converter':
      return {
        headline: 'OCR extraction (demo)',
        summary: 'Text recognition runs locally in a full deployment; results below are illustrative.',
        rows: [
          r('Text Blocks Detected', String(rng.int(2, 12)), 'info'),
          r('Characters Recognized', String(rng.int(120, 2400)), 'info'),
          r('Language Detected', 'English (98% confidence)', 'good'),
        ],
      };

    // ---- Keyword tools ----
    case 'keyword-competition-checker': {
      const kw = input.toLowerCase();
      const diff = rng.int(12, 94);
      return {
        headline: `Competition for "${kw}"`,
        summary: 'Estimated ranking difficulty using SERP strength and link profiles.',
        rows: [
          r('Difficulty Score', `${diff}/100`, diff < 35 ? 'good' : diff < 65 ? 'warn' : 'bad'),
          r('Monthly Searches', rng.pick([260, 880, 2400, 8100, 27000, 60000]).toLocaleString(), 'info'),
          r('Average CPC', `$${(rng.next() * 9 + 0.4).toFixed(2)}`, 'info'),
          r('Results on Google', rng.int(400000, 480000000).toLocaleString(), 'info'),
        ],
        table: keywordTable(kw, 8, rng),
      };
    }
    case 'keyword-rank-checker':
      return {
        headline: 'Rank tracking results',
        summary: 'Positions on page one of Google for the requested keywords.',
        rows: [r('Keywords Tracked', '10', 'info'), r('Top 10 Positions', String(rng.int(2, 8)), 'good'), r('Top 3 Positions', String(rng.int(0, 4)), 'info')],
        table: {
          headers: ['Keyword', 'Position', 'Change', 'URL'],
          rows: Array.from({ length: 8 }, (_, i) => {
            const pos = rng.int(1, 48);
            const move = rng.int(-8, 9);
            return [
              `${cleanDomain(domain).split('.')[0]} ${rng.pick(['services', 'price', 'review', 'near me', 'online', 'guide'])} ${i + 1}`,
              pos <= 10 ? `${pos}` : `${pos}`,
              (move > 0 ? `+${move}` : `${move}`),
              `/${rng.pick(['', 'services', 'blog', 'about'])}`,
            ];
          }),
        },
      };
    case 'keywords-suggestions-tool':
    case 'related-keywords-finder':
    case 'website-keywords-suggestions-tool':
      return {
        headline: `Keyword ideas for "${slug.startsWith('website') ? domain : input}"`,
        summary: 'Related terms, questions and long-tail variations with search metrics.',
        rows: [r('Suggestions Generated', '150+', 'good'), r('Question Keywords', String(rng.int(18, 60)), 'info'), r('Long-tail Terms', String(rng.int(40, 110)), 'info')],
        table: keywordTable(slug.startsWith('website') ? domain.split('.')[0] : input, 12, rng),
      };
    case 'expired-domains-tool': {
      const words = (input || 'tech').toLowerCase().split(/\s+/);
      return {
        headline: 'Recently expired domains',
        summary: 'Aged domains that recently dropped, with existing authority signals.',
        rows: [r('Domains Found', '24', 'info'), r('With Existing Backlinks', '18', 'good')],
        table: {
          headers: ['Domain', 'Age', 'DA', 'Backlinks', 'Status'],
          rows: Array.from({ length: 8 }, () => {
            const w = rng.pick(words) + rng.pick(['hub', 'lab', 'pro', 'co', 'now', 'site']);
            const da = rng.int(8, 62);
            return [`${w}${rng.pick(['.com', '.net', '.co', '.org'])}`, `${rng.int(1, 14)}y`, String(da), rng.int(0, 1800).toLocaleString(), da > 30 ? 'Worth checking' : 'Fresh'];
          }),
        },
      };
    }

    // ---------- Code to Text Ratio (uses real fetched data when available) ----------
    case 'code-to-text-ratio-checker': {
      const codeSize = live?.codeSize || rng.int(180, 900) * 1024;
      const textSize = live?.textSize || Math.round(codeSize * rng.pick([0.04, 0.08, 0.12, 0.18]));
      const ratio = live?.textRatio || Math.round((textSize / codeSize) * 1000) / 10;
      const status: RowStatus = ratio >= 10 ? 'good' : ratio >= 5 ? 'warn' : 'bad';
      return {
        headline: `Code to text ratio for ${domain}`,
        summary: 'The share of visible text compared to HTML/CSS/JS markup. Aim for 10% or higher.',
        rows: [
          r('Code to Text Ratio', `${ratio}%`, status),
          r('HTML Code Size', `${(codeSize / 1024).toFixed(1)} KB`, 'info'),
          r('Visible Text Size', `${(textSize / 1024).toFixed(1)} KB`, 'info'),
          r(live ? 'Measured from live HTML' : 'Estimated Page Words', live ? 'Real page fetch' : String(rng.int(300, 2200)), 'info'),
        ],
      };
    }

    // ---------- Spider Simulator ----------
    case 'spider-simulator': {
      const title = live?.title || input;
      const desc = live?.description || 'No meta description detected in the page source.';
      const h1s = live?.h1s ?? ['Home', 'Welcome', 'Services'];
      const internal = live?.internalLinks ?? rng.int(18, 240);
      const external = live?.externalLinks ?? rng.int(2, 60);
      const words = live?.wordCount || rng.int(400, 2000);
      return {
        headline: `Search engine spider view of ${domain}`,
        summary: live
          ? 'Rendered below from the live page HTML exactly as a crawler would read it (without executing JavaScript).'
          : 'How a crawler sees the page. Connect a live fetch for exact content.',
        rows: [
          r('Title', title.length ? title.slice(0, 70) : 'No title tag', title.length ? 'good' : 'bad'),
          r('Meta Description', desc.length ? 'Present' : 'Missing', desc.length ? 'good' : 'bad'),
          r('H1 Tags', String(h1s.length), h1s.length === 1 ? 'good' : 'warn'),
          r('Visible Words', words.toLocaleString(), words >= 600 ? 'good' : 'warn'),
          r('Internal Links Found', String(internal), 'info'),
          r('External Links Found', String(external), 'info'),
          r('JavaScript Rendering', 'Not executed (raw HTML)', 'info'),
        ],
        table: {
          headers: ['#', 'Element', 'Content seen by the crawler'],
          rows: [
            ['1', 'Title', title.slice(0, 90) || '—'],
            ['2', 'Description', desc.slice(0, 90)],
            ...h1s.slice(0, 3).map((h, i) => [String(i + 3), 'H1', h.slice(0, 80)]),
            ...(live?.linksSample ?? []).slice(0, 6).map((l, i) => [
              String(h1s.length + 3 + i), l.internal ? 'Internal link' : 'External link', l.href.slice(0, 80),
            ]),
          ],
        },
      };
    }

    // ---------- Side-by-side comparisons ----------
    case 'alexa-rank-comparison':
    case 'page-comparison': {
      const a = new Seeded(domain + slug);
      const b = new Seeded(domain2 + slug);
      const isRank = slug === 'alexa-rank-comparison';
      const metrics: [string, string, string, RowStatus][] = isRank
        ? [
            ['Global Traffic Rank', `#${a.int(40000, 8000000).toLocaleString()}`, `#${b.int(40000, 8000000).toLocaleString()}`, 'info'],
            ['Daily Visitors', a.int(120, 42000).toLocaleString(), b.int(120, 42000).toLocaleString(), 'info'],
            ['Bounce Rate', `${a.int(28, 78)}%`, `${b.int(28, 78)}%`, 'info'],
            ['Pages per Visit', (a.next() * 5 + 1.5).toFixed(1), (b.next() * 5 + 1.5).toFixed(1), 'info'],
            ['Avg. Visit Duration', `${a.int(1, 8)}m ${a.int(0, 59)}s`, `${b.int(1, 8)}m ${b.int(0, 59)}s`, 'info'],
          ]
        : [
            ['Title Length', `${a.int(28, 72)} chars`, `${b.int(28, 72)} chars`, 'info'],
            ['Description Length', `${a.int(90, 175)} chars`, `${b.int(90, 175)} chars`, 'info'],
            ['H1 Tags', String(a.pick([1, 1, 2])), String(b.pick([1, 1, 2])), 'info'],
            ['Words on Page', a.int(300, 2400).toLocaleString(), b.int(300, 2400).toLocaleString(), 'info'],
            ['Internal Links', String(a.int(15, 220)), String(b.int(15, 220)), 'info'],
            ['Images Missing Alt', String(a.int(0, 9)), String(b.int(0, 9)), 'info'],
          ];
      return {
        headline: isRank ? `Traffic rank comparison` : `Page comparison`,
        summary: `Comparing ${domain} against ${domain2 || 'competitor.com'}.`,
        rows: [r('Site A', domain, 'good'), r('Site B', domain2 || 'competitor.com', 'good')],
        table: {
          headers: ['Metric', domain, domain2 || 'competitor.com'],
          rows: metrics.map(m => [m[0], m[1], m[2]]),
        },
      };
    }

    case 'comparison-search': {
      const terms = ['services', 'pricing', 'reviews', 'best', 'near me', 'online', 'alternatives', 'cost'];
      const a = new Seeded(domain + 'comp');
      const b = new Seeded(domain2 + 'comp');
      return {
        headline: `Rank comparison: ${domain} vs ${domain2 || 'competitor.com'}`,
        summary: 'Estimated Google positions for eight core comparison queries (lower is better).',
        rows: [r('Queries Compared', '8', 'info')],
        table: {
          headers: ['Keyword', domain, domain2 || 'competitor.com', 'Winner'],
          rows: terms.slice(0, 8).map(t => {
            const pa = a.int(1, 60); const pb = b.int(1, 60);
            const kw = `${domain.split('.')[0]} ${t}`;
            return [kw, String(pa), String(pb), pa < pb ? 'Site A' : pa === pb ? 'Tie' : 'Site B'];
          }),
        },
      };
    }

    // ---------- Facebook ID ----------
    case 'find-facebook-id': {
      const id = rng.int(100000000000, 999999999999).toString();
      return {
        headline: 'Facebook numeric ID',
        summary: 'Resolved from the profile or page URL you submitted.',
        rows: [
          r('Numeric ID', id, 'good'),
          r('Type', rng.pick(['Facebook Page', 'Personal Profile', 'Group']), 'info'),
          r('Input', domain, 'info'),
        ],
      };
    }

    // ---------- Social stats ----------
    case 'social-stats-checker':
      return {
        headline: `Social signals for ${domain}`,
        summary: 'Aggregated share, like and pin counts from the major social networks.',
        rows: [
          r('Facebook Reactions', rng.int(200, 240000).toLocaleString(), 'info'),
          r('Facebook Shares', rng.int(50, 90000).toLocaleString(), 'info'),
          r('Pinterest Pins', rng.int(10, 40000).toLocaleString(), 'info'),
          r('LinkedIn Shares', rng.int(5, 12000).toLocaleString(), 'info'),
          r('Reddit Mentions', String(rng.int(0, 600)), 'info'),
          r('Total Social Signals', rng.int(1000, 400000).toLocaleString(), 'good'),
        ],
      };

    // ---------- Blog finder ----------
    case 'blog-finder-tool': {
      const kw = input.toLowerCase().trim().replace(/\s+/g, '-');
      const platforms = [
        ['medium.com', 'Guest post accepted', 'High'],
        ['wordpress.com', 'Comments open', 'Medium'],
        ['blogspot.com', 'Guest post accepted', 'Medium'],
        ['tumblr.com', 'Submit content', 'Low'],
        ['reddit.com/r/' + kw, 'Community discussion', 'High'],
        ['quora.com', 'Answer questions', 'High'],
        ['hubpages.com', 'Guest post accepted', 'Medium'],
        ['storify.com', 'Submit content', 'Low'],
      ];
      return {
        headline: `Blogs related to "${input}"`,
        summary: 'Niche blogs and communities found for outreach and guest-post opportunities.',
        rows: [r('Blogs Found', '8 of 40+ shown', 'good')],
        table: {
          headers: ['Blog / Platform', 'Opportunity', 'Authority', 'DA'],
          rows: platforms.map(([site, opp, auth]) => [
            kw.includes('http') ? site : `${kw.split('.')[0]}.${site}`.replace(/^-/, ''),
            opp, auth, String(rng.int(35, 94)),
          ]),
        },
      };
    }

    // ---------- App rank tracking ----------
    case 'apps-rank-tracking-tool': {
      const countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'India'];
      const categories = ['Overall', 'Business', 'Productivity', 'Utilities', 'Finance'];
      return {
        headline: `App ranking for "${input}"`,
        summary: 'Current chart positions across stores, countries and categories.',
        rows: [r('Markets Tracked', String(countries.length), 'info')],
        table: {
          headers: ['Country', 'Category', 'iPhone Rank', 'Android Rank', 'Trend'],
          rows: countries.map(c => [
            c,
            rng.pick(categories),
            '#' + rng.int(1, 200),
            '#' + rng.int(1, 200),
            rng.pick(['▲ up', '▼ down', '— stable']),
          ]),
        },
      };
    }

    default:
      return {
        headline: `Report for ${domain}`,
        summary: 'Analysis complete. Results shown are illustrative for this demo environment.',
        rows: [
          r('Status', 'Reachable', 'good'),
          r('Response Time', `${rng.int(90, 900)}ms`, 'info'),
          r('Checks Passed', String(rng.int(8, 18)), 'good'),
          r('Warnings', String(rng.int(0, 5)), 'warn'),
        ],
      };
  }
};
