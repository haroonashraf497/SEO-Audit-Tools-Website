/* ============================================================
   SEO Audit Tools — core engines (pure vanilla JS)
   Simulator (deterministic reports), text engines, lookup runner
   and the bespoke tools. Loaded on every tool page.
   Depends on: app.js (SEO.esc / SEO.outputPanel), audit.js (fetchPageData), md5.js
   ============================================================ */
(function (global) {
  'use strict';

  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };

  /* ---------------- deterministic simulator (port of simulator.ts) ---------------- */
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function Seeded(seed) {
    this.state = hashString(seed) || 1;
  }
  Seeded.prototype.next = function () {
    var x = this.state;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.state = x || 1;
    return (x >>> 0) / 4294967296;
  };
  Seeded.prototype.int = function (min, max) { return Math.floor(this.next() * (max - min + 1)) + min; };
  Seeded.prototype.pick = function (arr) { return arr[this.int(0, arr.length - 1)]; };

  var cleanDomain = function (input) { return input.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase() || 'example.com'; };
  var daysAgo = function (rng, min, max) {
    var d = new Date(Date.now() - rng.int(min, max) * 86400000);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  var statusForScore = function (s) { return s >= 70 ? 'good' : s >= 40 ? 'warn' : 'bad'; };
  var r = function (label, value, status, note) { return { label: label, value: value, status: status, note: note }; };

  var MODIFIERS = ['best', 'top', 'free', 'cheap', 'online', 'how to', 'what is', 'near me', 'for beginners', 'guide', 'review', 'vs', 'alternative', '2025', 'professional', 'small business'];
  var SUFFIXES = ['services', 'tools', 'tips', 'ideas', 'examples', 'checklist', 'pricing', 'benefits', 'mistakes', 'strategy'];

  function keywordTable(seed, count, rng, includeDifficulty) {
    if (includeDifficulty === undefined) includeDifficulty = true;
    var words = seed.toLowerCase().trim().split(/\s+/).slice(0, 3);
    var seen = {}, variants = [];
    var add = function (v) { if (!seen[v]) { seen[v] = 1; variants.push(v); } };
    add(words.join(' '));
    add('best ' + words.join(' '));
    var guard = 0;
    while (variants.length < count && guard++ < 500) {
      var m = rng.pick(MODIFIERS), s = rng.pick(SUFFIXES);
      add(rng.next() > 0.5 ? m + ' ' + words.join(' ') : words.join(' ') + ' ' + s);
    }
    var volChoices = [70, 110, 170, 260, 390, 590, 880, 1300, 2400, 4400, 8100, 12000];
    return {
      headers: includeDifficulty ? ['Keyword', 'Volume / mo', 'CPC', 'Difficulty'] : ['Keyword', 'Volume / mo'],
      rows: variants.slice(0, count).map(function (k) {
        var vol = rng.pick(volChoices);
        var base = [k, vol.toLocaleString()];
        if (includeDifficulty) {
          var cpc = (rng.next() * 9 + 0.3).toFixed(2);
          var d = rng.int(8, 92);
          base.push('$' + cpc, d > 65 ? 'Hard (' + d + ')' : d > 35 ? 'Medium (' + d + ')' : 'Easy (' + d + ')');
        }
        return base;
      })
    };
  }

  function buildReport(slug, rawInput, rawInput2, live) {
    var input = (rawInput || '').trim() || 'example.com';
    var domain = cleanDomain(input);
    var domain2 = rawInput2 ? cleanDomain(rawInput2) : '';
    var rng = new Seeded(slug + '|' + input + '|' + (rawInput2 || ''));

    switch (slug) {
      case 'domain-authority-checker': {
        var da = rng.int(18, 88);
        return {
          headline: 'Domain Authority for ' + domain,
          summary: 'Authority scores are estimates based on link profile quality and quantity.',
          rows: [
            r('Domain Authority', da + '/100', statusForScore(da)),
            r('Linking Root Domains', rng.int(40, 4800).toLocaleString(), 'info'),
            r('Total Backlinks', rng.int(800, 480000).toLocaleString(), 'info'),
            r('Spam Score', (rng.next() * 12).toFixed(1) + '%', rng.next() > 0.7 ? 'warn' : 'good')
          ]
        };
      }
      case 'page-authority-checker':
      case 'mozrank-checker': {
        var pa = rng.int(20, 85), isPA = slug === 'page-authority-checker';
        return {
          headline: (isPA ? 'Page Authority' : 'MozRank') + ' report',
          summary: isPA ? 'Prediction of how well this specific page will rank.' : 'Link popularity on a scale from 0 to 10.',
          rows: [
            r(isPA ? 'Page Authority' : 'MozRank', isPA ? pa + '/100' : (pa / 10).toFixed(2) + '/10', statusForScore(pa)),
            r('External links to page', rng.int(5, 900).toLocaleString(), 'info'),
            r('Equity-passing links', rng.int(4, 800).toLocaleString(), 'info'),
            r('HTTP status', '200 OK', 'good')
          ]
        };
      }
      case 'alexa-rank-checker': {
        var global = rng.int(40000, 9000000);
        return {
          headline: 'Traffic rank for ' + domain,
          summary: 'Estimated global popularity based on aggregated browsing and traffic data.',
          rows: [
            r('Global Rank', '#' + global.toLocaleString(), global < 500000 ? 'good' : global < 3000000 ? 'warn' : 'bad'),
            r('Country Rank', '#' + rng.int(800, 120000).toLocaleString() + ' (' + rng.pick(['United States', 'United Kingdom', 'India', 'Canada']) + ')', 'info'),
            r('Daily Visitors', rng.int(120, 42000).toLocaleString(), 'info'),
            r('Bounce Rate', rng.int(28, 78) + '%', 'info')
          ]
        };
      }
      case 'google-index-checker': {
        var indexed = rng.int(40, 320), submitted = indexed + rng.int(0, 60);
        return {
          headline: 'Index status for ' + domain,
          summary: 'Pages currently included in Google\u2019s index versus discoverable URLs.',
          rows: [
            r('Pages Indexed', String(indexed), indexed / submitted > 0.85 ? 'good' : indexed / submitted > 0.6 ? 'warn' : 'bad'),
            r('Pages Discovered', String(submitted), 'info'),
            r('Index Coverage', Math.round((indexed / submitted) * 100) + '%', 'info'),
            r('Sitemap Found', rng.next() > 0.15 ? 'Yes (/sitemap_index.xml)' : 'Not found', rng.next() > 0.15 ? 'good' : 'warn')
          ]
        };
      }
      case 'google-cache-checker':
        return {
          headline: 'Cache status for ' + domain,
          summary: 'The most recent snapshot Google stored while crawling.',
          rows: [
            r('Cached Version', rng.next() > 0.2 ? 'Available' : 'Not cached', rng.next() > 0.2 ? 'good' : 'warn'),
            r('Last Crawled', daysAgo(rng, 1, 18), 'info'),
            r('Crawl Frequency', rng.pick(['Daily', 'Every 2\u20133 days', 'Weekly', 'Monthly']), 'info'),
            r('Cache Type', rng.pick(['Full page', 'Text-only snapshot']), 'info')
          ]
        };
      case 'ssl-checker': {
        var valid = rng.next() > 0.2;
        return {
          headline: 'SSL certificate for ' + domain,
          summary: 'Certificate validity, issuer and connection encryption details.',
          rows: [
            r('HTTPS Enabled', valid ? 'Yes' : 'Certificate error', valid ? 'good' : 'bad'),
            r('Issuer', rng.pick(['Let\u2019s Encrypt R3', 'Google Trust Services', 'DigiCert SHA2', 'Cloudflare Inc ECC CA-3']), 'info'),
            r('Protocol', rng.pick(['TLS 1.3', 'TLS 1.2', 'TLS 1.2']), 'good'),
            r('Certificate Expiry', 'In ' + rng.int(12, 85) + ' days', valid ? 'good' : 'bad')
          ]
        };
      }
      case 'google-malware-checker':
      case 'blacklist-lookup': {
        var clean = rng.next() > 0.18;
        return {
          headline: slug === 'blacklist-lookup' ? 'Blacklist status for ' + domain : 'Malware scan for ' + domain,
          summary: 'Checked against major security and spam databases.',
          rows: [
            r('Google Safe Browsing', clean ? 'No issues found' : 'Suspicious activity', clean ? 'good' : 'bad'),
            r('Spamhaus / SURBL', clean ? 'Not listed' : 'Listed', clean ? 'good' : 'bad'),
            r('Phishing Signals', clean ? 'None detected' : 'Possible phishing', clean ? 'good' : 'bad'),
            r('Malware Databases Checked', '36', 'info')
          ]
        };
      }
      case 'cloaking-checker':
        return {
          headline: 'Cloaking analysis for ' + domain,
          summary: 'Compares the HTML served to Googlebot with the HTML shown to browsers.',
          rows: [
            r('Googlebot vs Browser Content', rng.next() > 0.12 ? 'Identical' : 'Differences detected', rng.next() > 0.12 ? 'good' : 'bad'),
            r('User-Agent Redirects', rng.next() > 0.2 ? 'None' : 'Suspicious redirect', rng.next() > 0.2 ? 'good' : 'bad'),
            r('Hidden Text/Links', rng.next() > 0.15 ? 'None found' : 'Hidden elements found', rng.next() > 0.15 ? 'good' : 'warn'),
            r('Risk Level', rng.pick(['Low', 'Low', 'Medium']), 'info')
          ]
        };
      case 'check-gzip-compression': {
        var enabled = rng.next() > 0.25, original = rng.int(180, 900);
        return {
          headline: 'Compression check for ' + domain,
          summary: 'Server-level compression dramatically reduces transfer size.',
          rows: enabled ? [
            r('Compression', 'Gzip / Brotli enabled', 'good'),
            r('Original Size', original + ' KB', 'info'),
            r('Compressed Size', Math.round(original * rng.pick([0.22, 0.28, 0.32])) + ' KB', 'good'),
            r('Bandwidth Saved', rng.int(66, 82) + '%', 'good')
          ] : [r('Compression', 'Not enabled', 'bad'), r('Content-Encoding Header', 'Missing', 'bad'), r('Estimated Savings', '~70%', 'warn')]
        };
      }
      case 'redirect-checker':
      case 'server-status-checker': {
        var chain = [];
        var code = rng.pick([200, 200, 301, 302]);
        var url = input.indexOf('http') === 0 ? input : 'https://' + domain + '/';
        if (code !== 200) {
          chain.push(code + '  ' + url);
          code = rng.next() > 0.3 ? 301 : 302;
          chain.push(code + '  ' + url.replace(/\/$/, '') + '/new-location');
        }
        chain.push('200  https://' + domain + '/final-page');
        return {
          headline: 'Redirect trace',
          summary: chain.length > 1 ? 'Found a ' + (chain.length - 1) + '-hop redirect chain.' : 'URL responds directly with no redirects.',
          rows: [
            r('Final Status Code', '200 OK', 'good'),
            r('Redirect Hops', String(Math.max(0, chain.length - 1)), chain.length > 2 ? 'warn' : 'good'),
            r('Redirect Type', chain.length > 1 ? (chain[0].indexOf('301') === 0 ? '301 Permanent' : '302 Temporary') : 'None', 'info'),
            r('HTTPS Redirect', rng.next() > 0.15 ? 'Enforced' : 'Not enforced', rng.next() > 0.15 ? 'good' : 'bad')
          ],
          table: { headers: ['Step', 'Status', 'URL'], rows: chain.map(function (c, i) { return [String(i + 1), c.split('  ')[0], c.split('  ')[1]]; }) }
        };
      }
      case 'backlink-checker': {
        var total = rng.int(200, 95000);
        return {
          headline: 'Backlink profile for ' + domain,
          summary: 'All links pointing at the domain, including quality estimates.',
          rows: [
            r('Total Backlinks', total.toLocaleString(), 'info'),
            r('Referring Domains', Math.round(total / rng.int(6, 20)).toLocaleString(), 'info'),
            r('Dofollow / Nofollow', rng.int(55, 85) + '% / ' + rng.int(15, 45) + '%', 'info'),
            r('Toxic Links Suspected', rng.int(0, 14) + '%', rng.next() > 0.6 ? 'warn' : 'good'),
            r('.gov / .edu Links', String(rng.int(0, 40)), 'info')
          ],
          table: {
            headers: ['Source URL', 'Anchor Text', 'Type', 'DR'],
            rows: Array.from({ length: 6 }, function () {
              return [
                'https://' + rng.pick(['blog', 'news', 'directory', 'forum', 'review']) + rng.int(10, 999) + '.com/post-' + rng.int(10, 900),
                rng.pick(['visit website', 'click here', domain, 'read more', 'resource', 'this guide']),
                rng.pick(['Dofollow', 'Nofollow', 'Dofollow', 'UGC']),
                String(rng.int(20, 88))
              ];
            })
          }
        };
      }
      case 'website-links-count-checker':
      case 'website-link-analyzer-tool':
        return {
          headline: 'Link analysis for ' + domain,
          summary: 'Complete breakdown of links found on the page.',
          rows: [
            r('Internal Links', String(rng.int(18, 240)), 'info'),
            r('External Links', String(rng.int(2, 60)), 'info'),
            r('Nofollow Links', String(rng.int(0, 18)), 'info'),
            r('Broken Links', String(rng.int(0, 6)), rng.next() > 0.6 ? 'warn' : 'good')
          ]
        };
      case 'link-tracker':
        return {
          headline: 'Link tracking report',
          summary: 'Live status of the specific link you submitted.',
          rows: [
            r('Link is Live', rng.next() > 0.25 ? 'Yes' : 'Not found', rng.next() > 0.25 ? 'good' : 'bad'),
            r('Page Indexed', rng.next() > 0.35 ? 'Yes' : 'Not yet', rng.next() > 0.35 ? 'good' : 'warn'),
            r('Link Type', rng.pick(['Dofollow', 'Nofollow']), 'info'),
            r('Anchor Found', rng.pick(['Brand name', 'Click here', domain, 'Visit site']), 'info')
          ]
        };
      case 'link-price-calculator': {
        var monthly = rng.int(40, 2600);
        return {
          headline: 'Estimated link value',
          summary: 'Rough monthly value based on traffic, authority and topical relevance.',
          rows: [
            r('Estimated Monthly Price', '$' + monthly.toLocaleString(), 'info'),
            r('Estimated Daily Visits', rng.int(80, 9000).toLocaleString(), 'info'),
            r('Source Domain Authority', rng.int(25, 82) + '/100', 'info'),
            r('Topical Relevance', rng.pick(['High', 'Medium', 'Low']), 'info')
          ]
        };
      }
      case 'reciprocal-link-checker': {
        var found = rng.next() > 0.4;
        return {
          headline: 'Reciprocal link result',
          summary: 'Checks whether the partner page links back to your site.',
          rows: [
            r('Partner Links Back', found ? 'Yes \u2013 link found' : 'No backlink detected', found ? 'good' : 'bad'),
            r('Link Attribute', rng.pick(['Dofollow', 'Nofollow']), 'info'),
            r('HTTP Status of Partner Page', '200 OK', 'good'),
            r('Partner Page Authority', rng.int(15, 70) + '/100', 'info')
          ]
        };
      }
      case 'websites-broken-link-checker': {
        var broken = rng.int(0, 12);
        return {
          headline: 'Broken link scan for ' + domain,
          summary: 'Crawled links and flagged every response that is not a 200 OK.',
          rows: [
            r('Links Checked', String(rng.int(40, 600)), 'info'),
            r('Broken Links (4xx/5xx)', String(broken), broken === 0 ? 'good' : broken > 5 ? 'bad' : 'warn'),
            r('Redirects Found', String(rng.int(0, 9)), 'info'),
            r('Crawl Errors', String(broken + rng.int(0, 3)), broken === 0 ? 'good' : 'warn')
          ]
        };
      }
      case 'domain-age-checker': {
        var years = rng.int(1, 22);
        var created = new Date(Date.now() - years * 365 * 86400000 - rng.int(0, 300) * 86400000);
        return {
          headline: 'Age report for ' + domain,
          summary: 'Registration history and domain maturity.',
          rows: [
            r('Domain Age', years + ' years, ' + rng.int(0, 11) + ' months', years >= 5 ? 'good' : years >= 2 ? 'warn' : 'bad'),
            r('Created On', created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), 'info'),
            r('Updated On', daysAgo(rng, 30, 400), 'info'),
            r('Expires On', daysAgo(rng, -365, -5), 'info')
          ]
        };
      }
      case 'whois-checker':
        return {
          headline: 'WHOIS data for ' + domain,
          summary: 'Registration and contact information from the domain registry.',
          rows: [
            r('Registrar', rng.pick(['Namecheap, Inc.', 'GoDaddy.com, LLC', 'Google Domains', 'Cloudflare, Inc.', 'Tucows Domains Inc.']), 'info'),
            r('Registered On', daysAgo(rng, 365, 7000), 'info'),
            r('Expires On', daysAgo(rng, -365, -5), 'info'),
            r('Privacy Protection', rng.pick(['Enabled', 'Enabled', 'Disabled']), 'info'),
            r('Name Servers', 'ns1.' + rng.pick(['cloudflare.com', 'digitalocean.com', 'dns-pod.com']), 'info')
          ]
        };
      case 'domain-ip-lookup':
      case 'domain-hosting-checker': {
        var ip = rng.int(104, 212) + '.' + rng.int(0, 255) + '.' + rng.int(0, 255) + '.' + rng.int(1, 254);
        return {
          headline: 'Hosting information for ' + domain,
          summary: 'Server IP, location and hosting provider.',
          rows: [
            r('IP Address', ip, 'info'),
            r('Hosting Provider', rng.pick(['Cloudflare, Inc.', 'Amazon AWS', 'Google Cloud', 'DigitalOcean', 'SiteGround', 'Hostinger']), 'info'),
            r('Server Location', rng.pick(['Ashburn, US', 'London, UK', 'Frankfurt, DE', 'Singapore, SG', 'Sydney, AU']), 'info'),
            r('Reverse IP Neighbours', String(rng.int(2, 900)), 'info')
          ]
        };
      }
      case 'find-dns-records':
        return {
          headline: 'DNS records for ' + domain,
          summary: 'All active DNS records served by the authoritative nameservers.',
          rows: [r('Nameservers', '2 found', 'good'), r('MX Records', String(rng.pick(['1 (Google)', '2 (Outlook)', '0'])), 'info'), r('TXT / SPF', rng.next() > 0.2 ? 'Present' : 'Missing', rng.next() > 0.2 ? 'good' : 'warn')],
          table: {
            headers: ['Type', 'Host', 'Value', 'TTL'],
            rows: [
              ['A', '@', rng.int(104, 212) + '.' + rng.int(0, 255) + '.' + rng.int(0, 255) + '.' + rng.int(1, 254), '300'],
              ['AAAA', '@', '2606:4700::6810:' + rng.int(1000, 9999), '300'],
              ['MX', '@', 'mail.' + domain, '3600'],
              ['TXT', '@', 'v=spf1 include:_spf.google.com ~all', '3600'],
              ['CNAME', 'www', domain, '300']
            ]
          }
        };
      case 'similar-page-checker': {
        var similarity = rng.int(4, 86);
        return {
          headline: 'Duplicate content comparison',
          summary: 'Percentage of text shared between the two submitted pages.',
          rows: [
            r('Content Similarity', similarity + '%', similarity > 60 ? 'bad' : similarity > 30 ? 'warn' : 'good'),
            r('Matching Sentences', String(Math.round(similarity / 4)), 'info'),
            r('Unique Phrases (A)', rng.int(60, 98) + '%', 'info'),
            r('Recommendation', similarity > 60 ? 'Rewrite or canonicalize one version' : 'Acceptable level of overlap', similarity > 60 ? 'bad' : 'good')
          ]
        };
      }
      case 'page-size-checker': {
        var size = rng.int(600, 4800);
        return {
          headline: 'Page weight for ' + domain,
          summary: 'Total download size and request count for the full page.',
          rows: [
            r('Total Page Size', size + ' KB', size < 1500 ? 'good' : size < 3000 ? 'warn' : 'bad'),
            r('HTTP Requests', String(rng.int(24, 180)), 'info'),
            r('Images Weight', Math.round(size * rng.int(45, 70) / 100) + ' KB', 'info'),
            r('JavaScript Weight', Math.round(size * rng.int(12, 30) / 100) + ' KB', 'info'),
            r('Estimated Load (4G)', (size / 450).toFixed(1) + 's', size < 1500 ? 'good' : 'warn')
          ]
        };
      }
      case 'image-to-text-converter':
        return {
          headline: 'OCR extraction (demo)',
          summary: 'Text recognition runs locally in a full deployment; results below are illustrative.',
          rows: [
            r('Text Blocks Detected', String(rng.int(2, 12)), 'info'),
            r('Characters Recognized', String(rng.int(120, 2400)), 'info'),
            r('Language Detected', 'English (98% confidence)', 'good')
          ]
        };
      case 'keyword-competition-checker': {
        var kw = input.toLowerCase();
        var diff = rng.int(12, 94);
        return {
          headline: 'Competition for "' + kw + '"',
          summary: 'Estimated ranking difficulty using SERP strength and link profiles.',
          rows: [
            r('Difficulty Score', diff + '/100', diff < 35 ? 'good' : diff < 65 ? 'warn' : 'bad'),
            r('Monthly Searches', rng.pick([260, 880, 2400, 8100, 27000, 60000]).toLocaleString(), 'info'),
            r('Average CPC', '$' + (rng.next() * 9 + 0.4).toFixed(2), 'info'),
            r('Results on Google', rng.int(400000, 480000000).toLocaleString(), 'info')
          ],
          table: keywordTable(kw, 8, rng)
        };
      }
      case 'keyword-rank-checker':
        return {
          headline: 'Rank tracking results',
          summary: 'Positions on page one of Google for the requested keywords.',
          rows: [r('Keywords Tracked', '10', 'info'), r('Top 10 Positions', String(rng.int(2, 8)), 'good'), r('Top 3 Positions', String(rng.int(0, 4)), 'info')],
          table: {
            headers: ['Keyword', 'Position', 'Change', 'URL'],
            rows: Array.from({ length: 8 }, function (_, i) {
              var pos = rng.int(1, 48), move = rng.int(-8, 9);
              return [
                cleanDomain(domain).split('.')[0] + ' ' + rng.pick(['services', 'price', 'review', 'near me', 'online', 'guide']) + ' ' + (i + 1),
                String(pos), move > 0 ? '+' + move : String(move),
                '/' + rng.pick(['', 'services', 'blog', 'about'])
              ];
            })
          }
        };
      case 'keywords-suggestions-tool':
      case 'related-keywords-finder':
      case 'website-keywords-suggestions-tool':
        return {
          headline: 'Keyword ideas for "' + (slug.indexOf('website') === 0 ? domain : input) + '"',
          summary: 'Related terms, questions and long-tail variations with search metrics.',
          rows: [r('Suggestions Generated', '150+', 'good'), r('Question Keywords', String(rng.int(18, 60)), 'info'), r('Long-tail Terms', String(rng.int(40, 110)), 'info')],
          table: keywordTable(slug.indexOf('website') === 0 ? domain.split('.')[0] : input, 12, rng)
        };
      case 'expired-domains-tool': {
        var words = (input || 'tech').toLowerCase().split(/\s+/);
        return {
          headline: 'Recently expired domains',
          summary: 'Aged domains that recently dropped, with existing authority signals.',
          rows: [r('Domains Found', '24', 'info'), r('With Existing Backlinks', '18', 'good')],
          table: {
            headers: ['Domain', 'Age', 'DA', 'Backlinks', 'Status'],
            rows: Array.from({ length: 8 }, function () {
              var w = rng.pick(words) + rng.pick(['hub', 'lab', 'pro', 'co', 'now', 'site']);
              var da2 = rng.int(8, 62);
              return [w + rng.pick(['.com', '.net', '.co', '.org']), rng.int(1, 14) + 'y', String(da2), rng.int(0, 1800).toLocaleString(), da2 > 30 ? 'Worth checking' : 'Fresh'];
            })
          }
        };
      }
      case 'code-to-text-ratio-checker': {
        var codeSize = (live && live.codeSize) || rng.int(180, 900) * 1024;
        var textSize = (live && live.textSize) || Math.round(codeSize * rng.pick([0.04, 0.08, 0.12, 0.18]));
        var ratio = (live && live.textRatio) || Math.round((textSize / codeSize) * 1000) / 10;
        var st = ratio >= 10 ? 'good' : ratio >= 5 ? 'warn' : 'bad';
        return {
          headline: 'Code to text ratio for ' + domain,
          summary: 'The share of visible text compared to HTML/CSS/JS markup. Aim for 10% or higher.',
          rows: [
            r('Code to Text Ratio', ratio + '%', st),
            r('HTML Code Size', (codeSize / 1024).toFixed(1) + ' KB', 'info'),
            r('Visible Text Size', (textSize / 1024).toFixed(1) + ' KB', 'info'),
            r(live ? 'Measured from live HTML' : 'Estimated Page Words', live ? 'Real page fetch' : String(rng.int(300, 2200)), 'info')
          ]
        };
      }
      case 'spider-simulator': {
        var title = (live && live.title) || input;
        var desc = (live && live.description) || 'No meta description detected in the page source.';
        var h1s = (live && live.h1s) || ['Home', 'Welcome', 'Services'];
        var internal = (live && live.internalLinks) != null ? live.internalLinks : rng.int(18, 240);
        var external = (live && live.externalLinks) != null ? live.externalLinks : rng.int(2, 60);
        var words = (live && live.wordCount) || rng.int(400, 2000);
        var rows = [
          ['1', 'Title', title.slice(0, 90) || '—'],
          ['2', 'Description', desc.slice(0, 90)]
        ];
        h1s.slice(0, 3).forEach(function (h, i) { rows.push([String(i + 3), 'H1', h.slice(0, 80)]); });
        ((live && live.linksSample) || []).slice(0, 6).forEach(function (l, i) {
          rows.push([String(h1s.length + 3 + i), l.internal ? 'Internal link' : 'External link', l.href.slice(0, 80)]);
        });
        return {
          headline: 'Search engine spider view of ' + domain,
          summary: live ? 'Rendered below from the live page HTML exactly as a crawler would read it (without executing JavaScript).' : 'How a crawler sees the page. Connect a live fetch for exact content.',
          rows: [
            r('Title', title.length ? title.slice(0, 70) : 'No title tag', title.length ? 'good' : 'bad'),
            r('Meta Description', desc.length ? 'Present' : 'Missing', desc.length ? 'good' : 'bad'),
            r('H1 Tags', String(h1s.length), h1s.length === 1 ? 'good' : 'warn'),
            r('Visible Words', words.toLocaleString(), words >= 600 ? 'good' : 'warn'),
            r('Internal Links Found', String(internal), 'info'),
            r('External Links Found', String(external), 'info'),
            r('JavaScript Rendering', 'Not executed (raw HTML)', 'info')
          ],
          table: { headers: ['#', 'Element', 'Content seen by the crawler'], rows: rows }
        };
      }
      case 'alexa-rank-comparison':
      case 'page-comparison': {
        var a = new Seeded(domain + slug), b = new Seeded(domain2 + slug);
        var isRank = slug === 'alexa-rank-comparison';
        var metrics = isRank ? [
          ['Global Traffic Rank', '#' + a.int(40000, 8000000).toLocaleString(), '#' + b.int(40000, 8000000).toLocaleString()],
          ['Daily Visitors', a.int(120, 42000).toLocaleString(), b.int(120, 42000).toLocaleString()],
          ['Bounce Rate', a.int(28, 78) + '%', b.int(28, 78) + '%'],
          ['Pages per Visit', (a.next() * 5 + 1.5).toFixed(1), (b.next() * 5 + 1.5).toFixed(1)],
          ['Avg. Visit Duration', a.int(1, 8) + 'm ' + a.int(0, 59) + 's', b.int(1, 8) + 'm ' + b.int(0, 59) + 's']
        ] : [
          ['Title Length', a.int(28, 72) + ' chars', b.int(28, 72) + ' chars'],
          ['Description Length', a.int(90, 175) + ' chars', b.int(90, 175) + ' chars'],
          ['H1 Tags', String(a.pick([1, 1, 2])), String(b.pick([1, 1, 2]))],
          ['Words on Page', a.int(300, 2400).toLocaleString(), b.int(300, 2400).toLocaleString()],
          ['Internal Links', String(a.int(15, 220)), String(b.int(15, 220))],
          ['Images Missing Alt', String(a.int(0, 9)), String(b.int(0, 9))]
        ];
        return {
          headline: isRank ? 'Traffic rank comparison' : 'Page comparison',
          summary: 'Comparing ' + domain + ' against ' + (domain2 || 'competitor.com') + '.',
          rows: [r('Site A', domain, 'good'), r('Site B', domain2 || 'competitor.com', 'good')],
          table: { headers: ['Metric', domain, domain2 || 'competitor.com'], rows: metrics }
        };
      }
      case 'comparison-search': {
        var terms = ['services', 'pricing', 'reviews', 'best', 'near me', 'online', 'alternatives', 'cost'];
        var a2 = new Seeded(domain + 'comp'), b2 = new Seeded(domain2 + 'comp');
        return {
          headline: 'Rank comparison: ' + domain + ' vs ' + (domain2 || 'competitor.com'),
          summary: 'Estimated Google positions for eight core comparison queries (lower is better).',
          rows: [r('Queries Compared', '8', 'info')],
          table: {
            headers: ['Keyword', domain, domain2 || 'competitor.com', 'Winner'],
            rows: terms.slice(0, 8).map(function (t) {
              var pA = a2.int(1, 60), pB = b2.int(1, 60);
              return [domain.split('.')[0] + ' ' + t, String(pA), String(pB), pA < pB ? 'Site A' : pA === pB ? 'Tie' : 'Site B'];
            })
          }
        };
      }
      case 'find-facebook-id':
        return {
          headline: 'Facebook numeric ID',
          summary: 'Resolved from the profile or page URL you submitted.',
          rows: [
            r('Numeric ID', String(rng.int(100000000000, 999999999999)), 'good'),
            r('Type', rng.pick(['Facebook Page', 'Personal Profile', 'Group']), 'info'),
            r('Input', domain, 'info')
          ]
        };
      case 'social-stats-checker':
        return {
          headline: 'Social signals for ' + domain,
          summary: 'Aggregated share, like and pin counts from the major social networks.',
          rows: [
            r('Facebook Reactions', rng.int(200, 240000).toLocaleString(), 'info'),
            r('Facebook Shares', rng.int(50, 90000).toLocaleString(), 'info'),
            r('Pinterest Pins', rng.int(10, 40000).toLocaleString(), 'info'),
            r('LinkedIn Shares', rng.int(5, 12000).toLocaleString(), 'info'),
            r('Reddit Mentions', String(rng.int(0, 600)), 'info'),
            r('Total Social Signals', rng.int(1000, 400000).toLocaleString(), 'good')
          ]
        };
      case 'blog-finder-tool': {
        var kwd = input.toLowerCase().trim().replace(/\s+/g, '-');
        var platforms = [
          ['medium.com', 'Guest post accepted', 'High'], ['wordpress.com', 'Comments open', 'Medium'],
          ['blogspot.com', 'Guest post accepted', 'Medium'], ['tumblr.com', 'Submit content', 'Low'],
          ['reddit.com/r/' + kwd, 'Community discussion', 'High'], ['quora.com', 'Answer questions', 'High'],
          ['hubpages.com', 'Guest post accepted', 'Medium'], ['storify.com', 'Submit content', 'Low']
        ];
        return {
          headline: 'Blogs related to "' + input + '"',
          summary: 'Niche blogs and communities found for outreach and guest-post opportunities.',
          rows: [r('Blogs Found', '8 of 40+ shown', 'good')],
          table: {
            headers: ['Blog / Platform', 'Opportunity', 'Authority', 'DA'],
            rows: platforms.map(function (p) {
              return [kwd.indexOf('http') !== -1 ? p[0] : (kwd.split('.')[0] + '.' + p[0]).replace(/^-/, ''), p[1], p[2], String(rng.int(35, 94))];
            })
          }
        };
      }
      case 'apps-rank-tracking-tool': {
        var countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'India'];
        var categories = ['Overall', 'Business', 'Productivity', 'Utilities', 'Finance'];
        return {
          headline: 'App ranking for "' + input + '"',
          summary: 'Current chart positions across stores, countries and categories.',
          rows: [r('Markets Tracked', String(countries.length), 'info')],
          table: {
            headers: ['Country', 'Category', 'iPhone Rank', 'Android Rank', 'Trend'],
            rows: countries.map(function (c) { return [c, rng.pick(categories), '#' + rng.int(1, 200), '#' + rng.int(1, 200), rng.pick(['\u25b2 up', '\u25bc down', '\u2014 stable'])]; })
          }
        };
      }
      default:
        return {
          headline: 'Report for ' + domain,
          summary: 'Analysis complete. Results shown are illustrative for this demo environment.',
          rows: [
            r('Status', 'Reachable', 'good'),
            r('Response Time', rng.int(90, 900) + 'ms', 'info'),
            r('Checks Passed', String(rng.int(8, 18)), 'good'),
            r('Warnings', String(rng.int(0, 5)), 'warn')
          ]
        };
    }
  }

  /* ---------------- shared report view ---------------- */
  var STATUS_STYLE = {
    good: { dot: 'var(--emerald-500)', text: 'var(--emerald-700)', label: 'Passed' },
    warn: { dot: 'var(--amber-500)', text: 'var(--amber-700)', label: 'Warning' },
    bad: { dot: 'var(--red-500)', text: 'var(--red-700)', label: 'Problem' },
    info: { dot: 'var(--slate-400)', text: 'var(--slate-700)', label: 'Info' }
  };
  function reportView(report) {
    var html = '<div class="card mb-6"><h3 style="font-size:1.05rem;font-weight:800;word-break:break-all">' + esc(report.headline) + '</h3>' +
      '<p class="small muted" style="margin-bottom:1.25rem">' + esc(report.summary) + '</p><div class="grid grid-2">';
    report.rows.forEach(function (row) {
      var st = STATUS_STYLE[row.status] || STATUS_STYLE.info;
      html += '<div class="flex" style="background:var(--slate-50);border:1px solid var(--slate-100);border-radius:var(--radius-xl);padding:1rem;gap:.75rem">' +
        '<span style="width:.6rem;height:.6rem;border-radius:999px;background:' + st.dot + ';flex-shrink:0;margin-top:.5rem"></span>' +
        '<div style="min-width:0"><p class="small muted">' + esc(row.label) + '</p>' +
        '<p style="font-size:.9rem;font-weight:700;color:' + st.text + ';word-break:break-word">' + esc(row.value) + '</p></div></div>';
    });
    html += '</div></div>';
    if (report.table) {
      html += '<div class="table-wrap" style="border-radius:var(--radius-2xl)"><table><thead><tr>';
      report.table.headers.forEach(function (h) { html += '<th>' + esc(h) + '</th>'; });
      html += '</tr></thead><tbody>';
      report.table.rows.forEach(function (cells) {
        html += '<tr>';
        cells.forEach(function (c, j) {
          var cls = /Hard|Medium|Easy/.test(c) ? (c.indexOf('Hard') === 0 ? 'tone-bad' : c.indexOf('Medium') === 0 ? 'tone-mid' : 'tone-good') : '';
          html += '<td' + (j === 0 ? ' style="font-weight:600;color:var(--slate-800)"' : '') + (cls ? ' class="' + cls + '"' : '') + '>' + esc(c) + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }

  function progressHtml(pct, label) {
    return '<div style="margin-bottom:1.5rem"><div class="flex-between small" style="margin-bottom:.5rem"><span>' + esc(label) + '</span><span>' + pct + '%</span></div>' +
      '<div class="progress-track" style="max-width:none;margin:0"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>';
  }

  /* ---------------- LookupRunner (simulated tools) ---------------- */
  var LIVE_SLUGS = ['spider-simulator', 'code-to-text-ratio-checker'];

  function lookupRunner(cfg, mount) {
    var isImage = cfg.input === 'image';
    var isUrlLike = cfg.input === 'url' || cfg.input === 'domain';
    var html = '';
    if (isImage) {
      html = '<label class="dropzone" style="display:block;border:2px dashed var(--slate-300);border-radius:var(--radius-2xl);padding:2.5rem;text-align:center;cursor:pointer;margin-bottom:1rem">' +
        '<input type="file" accept="image/*" style="display:none"><p style="font-weight:500;color:var(--slate-600)">Choose an image to extract text from</p>' +
        '<p class="small muted" style="margin-top:.25rem">JPG, PNG or screenshot</p></label>';
    } else if (cfg.input === 'twotext') {
      html = '<div class="two-col-inputs" style="margin-bottom:1rem">' +
        '<input class="input lk-in1" placeholder="' + esc(cfg.placeholder || 'First value...') + '">' +
        '<input class="input lk-in2" placeholder="' + esc(cfg.placeholder2 || 'Second value...') + '"></div>';
    } else if (cfg.input === 'text') {
      html = '<textarea class="textarea lk-in1" rows="8" placeholder="' + esc(cfg.placeholder || '') + '" style="margin-bottom:1rem"></textarea>';
    } else {
      html = '<input class="input lk-in1" placeholder="' + esc(cfg.placeholder || (isUrlLike ? 'example.com' : 'Enter a keyword...')) + '" style="margin-bottom:1rem">';
    }
    var btnLabel = 'Check ' + cfg.name.replace(/ Checker?$/, '').replace(/ Tool$/, '');
    html += '<button type="button" class="btn btn-primary lk-run" style="margin-bottom:1.25rem">' + btnLabel + '</button><div class="lk-out"></div>';
    mount.innerHTML = html;

    var out = mount.querySelector('.lk-out');
    var in1 = mount.querySelector('.lk-in1');
    var in2 = mount.querySelector('.lk-in2');
    var btn = mount.querySelector('.lk-run');

    function run(override) {
      var v = ((override != null ? override : in1.value) || '').trim();
      if (!v) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Analyzing...';
      out.innerHTML = progressHtml(0, 'Running checks…');
      var liveP = LIVE_SLUGS.indexOf(cfg.slug) !== -1
        ? global.SEOAudit.fetchPageData(/^https?:\/\//i.test(v) ? v : 'https://' + v).catch(function () { return null; })
        : Promise.resolve(null);
      var start = performance.now();
      var tick = setInterval(function () {
        var p = Math.min(92, ((performance.now() - start) / 1500) * 92);
        out.innerHTML = progressHtml(Math.floor(p), 'Running checks…');
      }, 100);
      setTimeout(function () {
        clearInterval(tick);
        Promise.race([liveP, new Promise(function (res) { setTimeout(function () { res(null); }, 8000); })]).then(function (live) {
          var report = buildReport(cfg.slug, v, in2 ? in2.value : '', live);
          out.innerHTML = progressHtml(100, 'Running checks…') + reportView(report) +
            '<p class="small text-center" style="color:var(--slate-400)">Demo results for illustration. Connect live APIs (whois, DNS, index data) in production for real values.</p>';
          btn.disabled = false;
          btn.textContent = btnLabel;
        });
      }, 1550);
    }

    btn.addEventListener('click', function () { run(); });
    if (in1) in1.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !isImage && cfg.input !== 'text') run(); });
    var drop = mount.querySelector('.dropzone');
    if (drop) {
      var fileInput = drop.querySelector('input[type=file]');
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (f) { drop.querySelector('p').textContent = f.name; run(f.name); }
      });
    }
  }

  /* ---------------- TextRunner + text engines ---------------- */
  var STOP = {};
  'the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were'.split(' ').forEach(function (w) { STOP[w] = 1; });

  function wordCounter(input) {
    var words = input.trim() ? input.trim().split(/\s+/).length : 0;
    var chars = input.length;
    var charsNoSpaces = input.replace(/\s/g, '').length;
    var sentences = input.split(/[.!?]+/).filter(function (x) { return x.trim(); }).length;
    var paragraphs = input.split(/\n\s*\n/).filter(function (x) { return x.trim(); }).length;
    return {
      html: global.SEO.outputPanel(input ? words + ' words · ' + chars + ' characters' : 'Start typing to see statistics...', '', [
        ['Words', String(words)], ['Characters', String(chars)], ['No spaces', String(charsNoSpaces)], ['Sentences', String(sentences)],
        ['Paragraphs', String(paragraphs)], ['Reading time', Math.max(0, Math.ceil(words / 225)) + ' min'], ['Speaking time', Math.ceil(words / 130) + ' min'],
        ['Avg word length', words ? (charsNoSpaces / words).toFixed(1) : '0']
      ])
    };
  }

  function caseVariants(input) {
    var lower = input.toLowerCase();
    var title = lower.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    var sentence = lower.replace(/(^\s*\w|[.!?]\s*\w)/g, function (c) { return c.toUpperCase(); });
    var alternating = input.split('').map(function (c, i) { return i % 2 ? c.toUpperCase() : c.toLowerCase(); }).join('');
    return [
      ['UPPERCASE', input.toUpperCase()], ['lowercase', lower], ['Title Case', title],
      ['Sentence case', sentence], ['aLtErNaTiNg', alternating],
      ['Capitalize Each Word', lower.replace(/(^|[-\s/])([a-z])/g, function (_, p1, p2) { return p1 + p2.toUpperCase(); })],
      ['Hyphen-case', lower.trim().replace(/\s+/g, '-')], ['snake_case', lower.trim().replace(/\s+/g, '_')]
    ];
  }

  function densityRows(input) {
    var words = input.toLowerCase().match(/[a-z0-9']+/g) || [];
    var total = words.length || 1;
    var single = {};
    words.forEach(function (w) { if (w.length > 2 && !STOP[w]) single[w] = (single[w] || 0) + 1; });
    var bi = {};
    for (var i = 0; i < words.length - 1; i++) {
      if (!STOP[words[i]] && !STOP[words[i + 1]]) { var k = words[i] + ' ' + words[i + 1]; bi[k] = (bi[k] || 0) + 1; }
    }
    var merge = [];
    Object.keys(single).forEach(function (w) { merge.push({ term: w, count: single[w], density: (single[w] / total) * 100 }); });
    Object.keys(bi).forEach(function (w) { merge.push({ term: w, count: bi[w], density: (bi[w] / total) * 100 }); });
    return { merge: merge.filter(function (x) { return x.count > 1; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 25), total: total };
  }

  function hashPanel(input) {
    var list = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'];
    var html = '';
    list.forEach(function (alg) {
      html += '<div class="output-panel" style="margin-bottom:.75rem"><div class="output-label"><span>' + alg + '</span><button type="button" class="copy-btn" data-hash-copy="' + alg + '">Copy</button></div>' +
        '<pre class="output-pre" data-hash-out="' + alg + '">…</pre></div>';
    });
    setTimeout(function () {
      var out = { MD5: global.md5(input) };
      var enc = new TextEncoder().encode(input);
      Promise.all(['SHA-1', 'SHA-256', 'SHA-512'].map(function (alg) {
        return crypto.subtle.digest(alg, enc).then(function (buf) {
          out[alg] = Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        }).catch(function () { out[alg] = 'Unavailable in this browser context'; });
      })).then(function () {
        list.forEach(function (alg) {
          var pre = document.querySelector('[data-hash-out="' + alg + '"]');
          var btn = document.querySelector('[data-hash-copy="' + alg + '"]');
          if (pre) pre.textContent = out[alg] || '';
          if (btn) btn.setAttribute('data-copy', out[alg] || '');
        });
      });
    }, 0);
    return html;
  }

  function panelRow(label, value) {
    return '<div class="output-panel" style="margin-bottom:.75rem"><div class="output-label"><span>' + esc(label) + '</span>' +
      '<button type="button" class="copy-btn" data-copy="' + esc(value).replace(/\n/g, '&#10;') + '">Copy</button></div>' +
      '<pre class="output-pre" style="font-size:.95rem;color:#f1f5f9">' + esc(value || '—') + '</pre></div>';
  }

  var SMALL_MAPS = {
    'Small Caps': { a: '\u1d00', b: '\u1d07', c: '\u1d04', d: '\u1d05', e: '\u1d07', f: '\u029f', g: '\u0262', h: '\u029c', i: '\u026a', j: '\u1d0a', k: '\u1d0b', l: '\u029f', m: '\u1d0d', n: '\u0274', o: '\u1d0f', p: '\u1d18', q: '\u01eb', r: '\u0280', s: 's', t: '\u1d1b', u: '\u1d1c', v: '\u1d20', w: '\u1d21', x: 'x', y: '\u028f', z: '\u1d22' },
    'Superscript': { a: '\u1d43', b: '\u1d47', c: '\u1d9c', d: '\u1d48', e: '\u1d49', f: '\u1da0', g: '\u1d4d', h: '\u02b0', i: '\u2071', j: '\u02b2', k: '\u1d4f', l: '\u02e1', m: '\u1d50', n: '\u207f', o: '\u1d52', p: '\u1d56', q: '\u06f9', r: '\u02b3', s: '\u02e2', t: '\u1d57', u: '\u1d58', v: '\u1d5b', w: '\u02b7', x: '\u02e3', y: '\u02b8', z: '\u1dbb' },
    'Subscript': { a: '\u2090', b: 'b', c: 'c', d: 'd', e: '\u2091', f: 'f', g: 'g', h: '\u2095', i: '\u1d62', j: '\u2c7c', k: '\u2096', l: '\u2097', m: '\u2098', n: '\u2099', o: '\u2092', p: '\u209a', q: 'q', r: '\u1d63', s: '\u209b', t: '\u209c', u: '\u1d64', v: '\u1d65', w: 'w', x: '\u2093', y: 'y', z: '\u2082' }
  };
  var FLIP = { a: '\u0250', b: 'q', c: '\u0254', d: 'p', e: '\u01dd', f: '\u025f', g: '\u0183', h: '\u0265', i: '\u1d09', j: '\u027e', k: '\u029e', l: 'l', m: '\u026f', n: 'u', o: 'o', p: 'd', q: 'b', r: '\u0279', s: 's', t: '\u0287', u: 'n', v: '\u028c', w: '\u028d', x: 'x', y: '\u028e', z: 'z', '.': '\u02d9', ',': "'", "'": ',', '"': '\u201e', '`': ',', '?': '\u00bf', '!': '\u00a1', '[': ']', ']': '[', '(': ')', ')': '(', '{': '}', '}': '{', '<': '>', '>': '<', '&': '\u214b', '_': '\u203e' };

  var SYNONYMS = {
    important: 'essential', good: 'solid', great: 'excellent', big: 'large', small: 'compact', help: 'assist',
    use: 'utilize', make: 'create', show: 'display', buy: 'purchase', start: 'begin', end: 'finish',
    get: 'obtain', need: 'require', many: 'numerous', quick: 'fast', easy: 'straightforward', hard: 'difficult',
    happy: 'pleased', sad: 'unhappy', begin: 'commence', build: 'construct', change: 'modify', check: 'verify',
    improve: 'enhance', provide: 'supply', ensure: 'guarantee', allow: 'enable', find: 'locate', want: 'need'
  };

  var MISSPELLINGS = {
    recieve: 'receive', occuring: 'occurring', occurence: 'occurrence', seperate: 'separate', definately: 'definitely',
    enviroment: 'environment', goverment: 'government', neccessary: 'necessary', accesible: 'accessible', acheive: 'achieve',
    adress: 'address', begining: 'beginning', beleive: 'believe', buisness: 'business', calender: 'calendar',
    cemetary: 'cemetery', changable: 'changeable', cheif: 'chief', collegue: 'colleague', comming: 'coming',
    completly: 'completely', concious: 'conscious', dissapoint: 'disappoint', embarass: 'embarrass', existance: 'existence',
    familar: 'familiar', finaly: 'finally', foriegn: 'foreign', freind: 'friend', gaurd: 'guard',
    grammer: 'grammar', happend: 'happened', harrass: 'harass', wierd: 'weird', writting: 'writing',
    tomorow: 'tomorrow', tounge: 'tongue', untill: 'until', wich: 'which', succesful: 'successful'
  };

  function minifyCSS(css) { return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim(); }
  function minifyHTML(html) { return html.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').replace(/\s*=\s*/g, '=').trim(); }
  function minifyJS(js) { return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s*\n\s*/g, '\n').replace(/^\s+/gm, '').replace(/\s*([{}();,:=<>+\-*/&|!?])\s*/g, '$1').trim(); }

  /* ---- WorkingEngine: renders live results for a text input ---- */
  function workingEngine(cfg, input, input2, mount) {
    var out;
    switch (cfg.slug) {
      case 'word-counter':
        out = global.SEO.outputPanel('Live statistics', input ? input.trim().split(/\s+/).length + ' words · ' + input.length + ' characters' : 'Start typing to see statistics...', [
          ['Words', String(input.trim() ? input.trim().split(/\s+/).length : 0)],
          ['Characters', String(input.length)],
          ['No spaces', String(input.replace(/\s/g, '').length)],
          ['Sentences', String(input.split(/[.!?]+/).filter(function (x) { return x.trim(); }).length)],
          ['Paragraphs', String(input.split(/\n\s*\n/).filter(function (x) { return x.trim(); }).length)],
          ['Reading time', Math.max(0, Math.ceil((input.trim() ? input.trim().split(/\s+/).length : 0) / 225)) + ' min'],
          ['Speaking time', Math.ceil((input.trim() ? input.trim().split(/\s+/).length : 0) / 130) + ' min']
        ]);
        break;
      case 'case-converter':
        out = caseVariants(input).map(function (v) { return panelRow(v[0], v[1]); }).join('');
        break;
      case 'keyword-density-checker': {
        if (!input.trim()) { out = global.SEO.outputPanel('Keyword density', 'Paste an article to analyze term frequency...'); break; }
        var d = densityRows(input);
        var dh = '<div class="table-wrap"><table><thead><tr><th>Keyword</th><th style="text-align:right">Count</th><th style="text-align:right">Density</th></tr></thead><tbody>';
        d.merge.forEach(function (x) {
          dh += '<tr><td>' + esc(x.term) + '</td><td style="text-align:right">' + x.count + '&times;</td><td style="text-align:right;font-weight:600;color:' + (x.density > 3 ? 'var(--amber-600)' : 'var(--indigo-600)') + '">' + x.density.toFixed(2) + '%</td></tr>';
        });
        dh += '</tbody></table></div><p class="small muted">' + d.total + ' total words analyzed. Aim for 1\u20132.5% density on primary terms.</p>';
        out = dh;
        break;
      }
      case 'online-md5-generator':
        out = hashPanel(input);
        break;
      case 'small-text-generator':
        out = Object.keys(SMALL_MAPS).map(function (name) {
          var map = SMALL_MAPS[name];
          return panelRow(name, input.toLowerCase().split('').map(function (ch) { return map[ch] != null ? map[ch] : ch; }).join(''));
        }).join('');
        break;
      case 'reverse-text-generator':
        out = panelRow('Reversed Text', input.split('').reverse().join('')) +
          panelRow('Reverse Word Order', input.split(/\s+/).reverse().join(' ')) +
          panelRow('Flip Text (upside down)', input.toLowerCase().split('').reverse().map(function (c) { return FLIP[c] != null ? FLIP[c] : c; }).join(''));
        break;
      case 'merge-words-online-tool': {
        var a = input.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        var b = (input2 || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        var combos = [];
        a.forEach(function (x) { b.forEach(function (y) { combos.push(x + ' ' + y); }); });
        out = global.SEO.outputPanel(combos.length + ' combinations', combos.join('\n'), [['List A', String(a.length)], ['List B', String(b.length)], ['Combinations', String(combos.length)]]);
        break;
      }
      case 'long-tail-keyword-generator': {
        var kw = input.trim().toLowerCase();
        if (!kw) { out = global.SEO.outputPanel('30 long-tail variations', ''); break; }
        var tpl = ['best ' + kw, 'top ' + kw, kw + ' for beginners', 'how to choose ' + kw, 'what is ' + kw,
          kw + ' guide', kw + ' tips', kw + ' checklist', kw + ' pricing', 'affordable ' + kw,
          kw + ' near me', kw + ' online', 'professional ' + kw, kw + ' for small business',
          kw + ' review', kw + ' vs alternative', 'why ' + kw + ' matters', 'how does ' + kw + ' work',
          kw + ' examples', 'benefits of ' + kw, kw + ' mistakes to avoid', 'free ' + kw + ' tools',
          kw + ' checklist 2025', 'step by step ' + kw, 'diy ' + kw, 'cheap ' + kw + ' that work',
          kw + ' for bloggers', kw + ' for ecommerce', 'ultimate guide to ' + kw, kw + ' frequently asked questions'];
        out = global.SEO.outputPanel('30 long-tail variations', tpl.join('\n'));
        break;
      }
      case 'keyword-rich-domains-suggestions-tool': {
        var base = input.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        if (!base.length) { out = global.SEO.outputPanel('Domain name ideas (availability check needed at a registrar)', ''); break; }
        var tlds = ['.com', '.net', '.co', '.io', '.org', '.shop', '.online', '.store'];
        var ideas = [], seenIds = {};
        var addIdea = function (v) { if (!seenIds[v]) { seenIds[v] = 1; ideas.push(v); } };
        [base.join(''), base.join(''), base.join('-')].forEach(function (j) { if (j) tlds.slice(0, 4).forEach(function (t) { addIdea(j + t); }); });
        ['get', 'try', 'use', 'my', 'the', 'pro'].forEach(function (p) { addIdea(p + base.join('') + '.com'); });
        ['hub', 'lab', 'pro', 'co', 'now', 'hq', 'app'].forEach(function (s) { addIdea(base[0] + s + '.com'); });
        out = global.SEO.outputPanel('Domain name ideas (availability check needed at a registrar)', ideas.slice(0, 24).join('\n'));
        break;
      }
      case 'article-rewriter': {
        out = '<button type="button" class="btn btn-primary rw-btn" style="margin-bottom:1rem"' + (input.trim() ? '' : ' disabled') + '>Rewrite Article</button><div class="rw-out"></div>';
        setTimeout(function () {
          var b = mount.querySelector('.rw-btn');
          b.addEventListener('click', function () {
            var result = input.replace(/\b\w+\b/g, function (w) {
              var syn = SYNONYMS[w.toLowerCase()];
              if (!syn) return w;
              return w[0] === w[0].toUpperCase() ? syn[0].toUpperCase() + syn.slice(1) : syn;
            });
            mount.querySelector('.rw-out').innerHTML = global.SEO.outputPanel('Rewritten text (always proofread and edit)', result);
          });
        }, 0);
        break;
      }
      case 'grammar-checker': {
        if (!input.trim()) { out = global.SEO.outputPanel('Grammar report', 'Paste text to run grammar checks...'); break; }
        var issues = [];
        var fixes = [
          [/\balot\b/gi, '"alot" should be two words', 'a lot'],
          [/\bdont\b/gi, 'Missing apostrophe', "don't"],
          [/\bcant\b/gi, 'Missing apostrophe', "can't"],
          [/\bwont\b/gi, 'Missing apostrophe', "won't"],
          [/\bim\b/gi, 'Missing apostrophe', "I'm"],
          [/\bive\b/gi, 'Missing apostrophe', "I've"],
          [/\byoure\b/gi, 'Missing apostrophe', "you're"],
          [/\bdefinately\b/gi, 'Common misspelling', 'definitely'],
          [/\bseperate\b/gi, 'Common misspelling', 'separate']
        ];
        fixes.forEach(function (f) {
          var m = input.match(f[0]);
          if (m) m.forEach(function () { issues.push({ type: 'error', message: f[1], fix: f[2] }); });
        });
        if (/ {2,}/.test(input)) issues.push({ type: 'warn', message: 'Double (or more) spaces found', fix: 'single spaces' });
        if (/[,.!?]\s[a-z]/.test(input)) issues.push({ type: 'warn', message: 'Sentence starts with a lowercase letter after punctuation', fix: 'capitalize sentence starts' });
        var dup = input.match(/\b(\w+)\s+\1\b/gi);
        if (dup) dup.forEach(function (d) { issues.push({ type: 'warn', message: 'Repeated word: "' + d + '"', fix: 'remove duplicate' }); });
        out = issues.length === 0
          ? '<div class="card" style="text-align:center;color:var(--emerald-600);font-weight:600">No common grammar or spelling issues detected.</div>'
          : '<div class="card card-p0">' + issues.map(function (iss) {
              return '<div class="issue-row"><span class="issue-dot ' + (iss.type === 'error' ? 'dot-error' : 'dot-warning') + '"></span><div><p style="font-weight:500;font-size:.9rem;color:var(--slate-800)">' + esc(iss.message) + '</p><p class="small muted">Suggestion: ' + esc(iss.fix) + '</p></div></div>';
            }).join('') + '</div>';
        break;
      }
      case 'spell-checker': {
        if (!input.trim()) { out = global.SEO.outputPanel('Spell check', 'Paste text to find typos...'); break; }
        var words2 = input.toLowerCase().match(/\b[a-z]+\b/g) || [];
        var seen2 = {};
        words2.forEach(function (w) { if (MISSPELLINGS[w]) seen2[w] = (seen2[w] || 0) + 1; });
        var found = Object.keys(seen2);
        out = found.length === 0
          ? '<div class="card" style="text-align:center;color:var(--emerald-600);font-weight:600">No common spelling mistakes found.</div>'
          : '<div class="card card-p0">' + found.map(function (wrong) {
              return '<div class="issue-row" style="justify-content:space-between"><div><span class="tone-bad" style="text-decoration:line-through;font-weight:600">' + esc(wrong) + '</span><span class="muted"> &rarr; </span><span style="color:var(--emerald-700);font-weight:600">' + esc(MISSPELLINGS[wrong]) + '</span></div><span class="small muted">' + seen2[wrong] + '&times;</span></div>';
            }).join('') + '</div>';
        break;
      }
      case 'text-to-speech':
        out = '<div class="grid grid-2" style="margin-bottom:1rem"><select class="select tts-voice"></select>' +
          '<div class="flex"><label class="small" style="white-space:nowrap">Speed 1.0&times;</label><input type="range" min="0.5" max="2" step="0.1" value="1" class="tts-rate" style="flex:1;accent-color:var(--indigo-600)"></div></div>' +
          '<div class="flex"><button type="button" class="btn btn-primary tts-play"' + (input.trim() ? '' : ' disabled') + '>&#9654; Listen</button><button type="button" class="btn btn-ghost tts-stop">Stop</button></div>' +
          (!('speechSynthesis' in window) ? '<p class="small" style="color:var(--red-600)">Your browser does not support speech synthesis.</p>' : '');
        setTimeout(function () {
          if (!('speechSynthesis' in window)) return;
          var sel = mount.querySelector('.tts-voice'), rate = mount.querySelector('.tts-rate');
          var load = function () {
            var v = speechSynthesis.getVoices();
            if (!v.length) return;
            sel.innerHTML = v.map(function (x) { return '<option value="' + esc(x.voiceURI) + '">' + esc(x.name) + ' (' + esc(x.lang) + ')</option>'; }).join('');
          };
          load();
          speechSynthesis.onvoiceschanged = load;
          rate.addEventListener('input', function () { rate.previousElementSibling; rate.parentElement.querySelector('label').textContent = 'Speed ' + Number(rate.value).toFixed(1) + '\u00d7'; });
          mount.querySelector('.tts-play').addEventListener('click', function () {
            speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(input);
            var v = speechSynthesis.getVoices().find(function (x) { return x.voiceURI === sel.value; });
            if (v) u.voice = v;
            u.rate = Number(rate.value);
            speechSynthesis.speak(u);
          });
          mount.querySelector('.tts-stop').addEventListener('click', function () { speechSynthesis.cancel(); });
        }, 0);
        break;
      case 'css-minify': case 'html-minify': case 'javascript-minifier': {
        var lang = cfg.slug === 'css-minify' ? 'css' : cfg.slug === 'html-minify' ? 'html' : 'js';
        var result = '';
        try { result = input.trim() ? (lang === 'css' ? minifyCSS(input) : lang === 'html' ? minifyHTML(input) : minifyJS(input)) : ''; } catch (e) { result = ''; }
        var before = new Blob([input]).size, after = new Blob([result]).size;
        var pct = before ? Math.round((1 - after / before) * 100) : 0;
        out = global.SEO.outputPanel('Minified ' + lang.toUpperCase() + ' · ' + pct + '% smaller', result || 'Paste code to minify...', [
          ['Original', before + ' B'], ['Minified', after + ' B'], ['Saved', (before - after) + ' B'], ['Reduction', pct + '%']
        ]);
        break;
      }
      case 'xml-sitemap-generator': {
        var urls = input.split('\n').map(function (u) { return u.trim(); }).filter(Boolean);
        var xml = '';
        if (urls.length) {
          var today = new Date().toISOString().slice(0, 10);
          var body = urls.map(function (u, i) {
            return '  <url>\n    <loc>' + (u.indexOf('http') === 0 ? u : 'https://' + u) + '</loc>\n    <lastmod>' + today + '</lastmod>\n    <changefreq>' + (i === 0 ? 'daily' : 'monthly') + '</changefreq>\n    <priority>' + (i === 0 ? '1.0' : '0.8') + '</priority>\n  </url>';
          }).join('\n');
          xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>';
        }
        out = global.SEO.outputPanel('sitemap.xml — save and upload to your site root', xml || 'Paste URLs, one per line...');
        break;
      }
      default:
        out = '';
    }
    mount.innerHTML = out;
  }

  /* ---------------- bespoke tool implementations ---------------- */

  // Plagiarism checker (textarea + progress + report)
  function plagiarismChecker(cfg, mount) {
    mount.innerHTML = '<textarea class="textarea pl-in" rows="9" placeholder="' + esc(cfg.placeholder || 'Enter text here to check for Plagiarism') + '" style="margin-bottom:1rem"></textarea>' +
      '<button type="button" class="btn btn-primary pl-run" style="margin-bottom:1.25rem">Check Plagiarism</button><div class="pl-out"></div>';
    var btn = mount.querySelector('.pl-run'), input = mount.querySelector('.pl-in'), out = mount.querySelector('.pl-out');
    btn.addEventListener('click', function () {
      var v = input.value.trim();
      if (!v) return;
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Scanning...';
      out.innerHTML = progressHtml(0, 'Checking text against 16+ billion indexed pages...');
      var start = performance.now();
      var tick = setInterval(function () {
        out.innerHTML = progressHtml(Math.min(92, ((performance.now() - start) / 2000) * 92), 'Checking text against 16+ billion indexed pages...');
      }, 120);
      setTimeout(function () {
        clearInterval(tick);
        out.innerHTML = progressHtml(100, 'Scan complete') + reportView(buildReport('plagiarism-checker', v));
        btn.disabled = false; btn.textContent = 'Check Plagiarism';
      }, 2050);
    });
  }

  // Robots.txt generator
  function robotsGen(cfg, mount) {
    mount.innerHTML =
      '<div class="grid grid-2"><div>' +
      '<div class="flex" style="margin-bottom:1rem"><button type="button" class="btn btn-ghost rb-allow" style="flex:1">Allow all robots</button><button type="button" class="btn btn-ghost rb-block" style="flex:1">Block all robots</button></div>' +
      '<div class="field"><label>Disallow paths (one per line)</label><textarea class="textarea rb-disallow" rows="4">/wp-admin/\n/cart/\n/checkout/</textarea></div>' +
      '<div class="field"><label>Crawl delay (seconds, optional)</label><input class="input rb-delay" placeholder="e.g. 5" inputmode="numeric"></div>' +
      '<div class="field"><label>Sitemap URL</label><input class="input rb-sitemap" value="https://example.com/sitemap.xml" style="font-family:ui-monospace,monospace"></div>' +
      '</div><div class="rb-out"></div></div>';
    var allowBtn = mount.querySelector('.rb-allow'), blockBtn = mount.querySelector('.rb-block');
    var allowAll = true;
    function render() {
      allowBtn.style.borderColor = allowAll ? 'var(--indigo-500)' : '';
      allowBtn.style.background = allowAll ? 'var(--indigo-50)' : '';
      allowBtn.style.color = allowAll ? 'var(--indigo-700)' : '';
      blockBtn.style.borderColor = !allowAll ? 'var(--indigo-500)' : '';
      blockBtn.style.background = !allowAll ? 'var(--indigo-50)' : '';
      blockBtn.style.color = !allowAll ? 'var(--indigo-700)' : '';
      mount.querySelector('.rb-disallow').parentElement.style.display = allowAll ? '' : 'none';
      var lines = ['User-agent: *', allowAll ? 'Allow: /' : 'Disallow: /'];
      if (allowAll) mount.querySelector('.rb-disallow').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (d) { lines.push('Disallow: ' + (d.charAt(0) === '/' ? d : '/' + d)); });
      var delay = mount.querySelector('.rb-delay').value;
      if (delay) lines.push('Crawl-delay: ' + delay);
      var sm = mount.querySelector('.rb-sitemap').value.trim();
      if (sm) { lines.push('', 'Sitemap: ' + sm); }
      mount.querySelector('.rb-out').innerHTML = global.SEO.outputPanel('robots.txt', lines.join('\n'));
    }
    allowBtn.addEventListener('click', function () { allowAll = true; render(); });
    blockBtn.addEventListener('click', function () { allowAll = false; render(); });
    mount.querySelector('.rb-disallow').addEventListener('input', render);
    mount.querySelector('.rb-delay').addEventListener('input', function () { this.value = this.value.replace(/[^0-9]/g, ''); render(); });
    mount.querySelector('.rb-sitemap').addEventListener('input', render);
    render();
  }

  // Meta tag generator
  function metaGen(cfg, mount) {
    mount.innerHTML =
      '<div class="grid grid-2"><div>' +
      '<div class="field"><label>Site title</label><input class="input mg-title" placeholder="Your Page Title | Brand Name"></div>' +
      '<div class="field"><label>Meta description</label><textarea class="textarea mg-desc" rows="2" placeholder="Compelling 150-160 character summary..." style="font-family:inherit"></textarea></div>' +
      '<div class="field"><label>Keywords (comma separated)</label><input class="input mg-keywords" placeholder="seo, audit, speed"></div>' +
      '<div class="field"><label>Author / brand</label><input class="input mg-author" placeholder="Your Brand"></div>' +
      '<div class="field"><label>Canonical URL</label><input class="input mg-canonical" placeholder="https://example.com/page"></div>' +
      '<div class="field"><label>Robots</label><select class="select mg-robots"><option>index, follow</option><option>noindex, follow</option><option>index, nofollow</option><option>noindex, nofollow</option></select></div>' +
      '</div><div class="mg-out"></div></div>';
    function render() {
      var f = {
        title: mount.querySelector('.mg-title').value, desc: mount.querySelector('.mg-desc').value,
        keywords: mount.querySelector('.mg-keywords').value, author: mount.querySelector('.mg-author').value,
        canonical: mount.querySelector('.mg-canonical').value, robots: mount.querySelector('.mg-robots').value
      };
      var domain = (f.canonical || 'https://example.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      var html = '<title>' + f.title + '</title>\n<meta name="description" content="' + f.desc + '" />\n<meta name="keywords" content="' + f.keywords + '" />\n<meta name="robots" content="' + f.robots + '" />\n' +
        (f.author ? '<meta name="author" content="' + f.author + '" />\n' : '') + '<link rel="canonical" href="' + f.canonical + '" />\n' +
        '<meta property="og:title" content="' + f.title + '" />\n<meta property="og:description" content="' + f.desc + '" />\n<meta property="og:type" content="website" />\n<meta name="twitter:card" content="summary_large_image" />';
      mount.querySelector('.mg-out').innerHTML =
        '<div class="card" style="margin-bottom:1rem"><p class="eyebrow" style="margin:0 0 .75rem">Google preview</p>' +
        '<p class="small" style="color:var(--slate-700);display:flex;gap:.5rem;align-items:center"><span style="width:1.4rem;height:1.4rem;background:var(--slate-100);border-radius:999px;display:inline-block"></span>' + esc(domain) + '</p>' +
        '<p style="color:#1a0dab;font-size:1.1rem;margin-top:.25rem">' + esc(f.title || 'Your Page Title | Brand Name') + '</p>' +
        '<p class="small muted">' + esc(f.desc || 'Your meta description will appear here. Aim for 150\u2013160 characters.') + '</p>' +
        '<p class="small" style="color:' + (f.desc.length > 160 ? 'var(--red-500)' : 'var(--slate-400)') + '">' + f.desc.length + ' / 160 characters</p></div>' +
        global.SEO.outputPanel('Meta tags HTML', html);
    }
    ['.mg-title', '.mg-desc', '.mg-keywords', '.mg-author', '.mg-canonical', '.mg-robots'].forEach(function (sel) {
      mount.querySelector(sel).addEventListener('input', render);
      mount.querySelector(sel).addEventListener('change', render);
    });
    render();
  }

  // Backlink maker
  var DIRECTORIES = ['aboutus.com', 'intellifinder.com', 'hotfrog.com', 'brownbook.net', 'spoke.com', 'cybo.com', 'yelu.com', 'find-us-here.com', 'directory2020.com', 'trustpilot.com', 'yelp.com', 'foursquare.com'];
  function backlinkMaker(cfg, mount) {
    mount.innerHTML = '<div class="flex" style="margin-bottom:1.25rem"><input class="input bm-in" placeholder="' + esc(cfg.placeholder || 'example.com') + '" style="flex:1"><button type="button" class="btn btn-primary bm-run">Create Backlinks</button></div><div class="bm-out"></div>';
    var btn = mount.querySelector('.bm-run'), input = mount.querySelector('.bm-in'), out = mount.querySelector('.bm-out');
    btn.addEventListener('click', function () {
      var d = input.value.trim();
      if (!d) return;
      btn.disabled = true; btn.textContent = 'Submitting…';
      out.innerHTML = '<div class="card card-p0 bm-list"></div>';
      var list = out.querySelector('.bm-list');
      var rng = new Seeded(d);
      DIRECTORIES.forEach(function (site, i) {
        setTimeout(function () {
          var ok = rng.next() > 0.25;
          list.innerHTML += '<div class="flex-between" style="padding:.75rem 1rem;border-top:1px solid var(--slate-100)"><span style="font-weight:500;font-size:.9rem">' + esc(site) + '</span><span style="font-weight:600;font-size:.85rem;color:' + (ok ? 'var(--emerald-600)' : 'var(--amber-600)') + '">' + (ok ? 'Submitted successfully' : 'Already listed') + '</span></div>';
          if (i === DIRECTORIES.length - 1) { btn.disabled = false; btn.textContent = 'Create Backlinks'; }
        }, i * 220);
      });
    });
  }

  // Domain availability
  function domainAvail(cfg, mount) {
    mount.innerHTML = '<div class="flex" style="margin-bottom:1.25rem"><input class="input da-in" placeholder="' + esc(cfg.placeholder || 'Enter a keyword...') + '" style="flex:1"><button type="button" class="btn btn-primary da-run">Search Domains</button></div><div class="da-out"></div>';
    var btn = mount.querySelector('.da-run'), input = mount.querySelector('.da-in'), out = mount.querySelector('.da-out');
    function run() {
      var k = input.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!k) return;
      var tlds = ['.com', '.net', '.org', '.co', '.io', '.info', '.biz', '.online', '.store', '.site'];
      var rng = new Seeded(k);
      var html = '<div class="card card-p0">';
      tlds.forEach(function (t) {
        var available = rng.next() > 0.35;
        var price = '$' + (rng.next() * 30 + 8).toFixed(2) + '/yr';
        html += '<div class="flex-between" style="padding:.75rem 1rem;border-top:1px solid var(--slate-100)"><span class="mono-cell">' + esc(k + t) + '</span><span class="flex" style="gap:1rem"><span class="small muted">' + price + '</span><span style="font-weight:600;font-size:.85rem;color:' + (available ? 'var(--emerald-600)' : 'var(--red-500)') + '">' + (available ? 'Available' : 'Taken') + '</span></span></div>';
      });
      out.innerHTML = html + '</div>';
    }
    btn.addEventListener('click', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
  }

  // Browser info
  function browserInfo(cfg, mount) {
    var ua = navigator.userAgent;
    var browser = 'Unknown';
    if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/opr\//i.test(ua)) browser = 'Opera';
    else if (/chrome|crios/i.test(ua) && !/edg|opr/i.test(ua)) browser = 'Google Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    var ver = ua.match(/(edg|opr|chrome|firefox|fxios|version)\/?\s*([\d.]+)/i);
    var os = /windows nt 10/i.test(ua) ? 'Windows 10/11' : /windows nt 6\.3/i.test(ua) ? 'Windows 8.1' : /mac os x/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : 'Unknown';
    var info = [
      ['Browser', browser], ['Version', ver ? ver[2] : 'Unknown'], ['Operating System', os], ['User Agent', ua],
      ['Screen Resolution', window.screen.width + ' \u00d7 ' + window.screen.height], ['Viewport', window.innerWidth + ' \u00d7 ' + window.innerHeight],
      ['Color Depth', window.screen.colorDepth + '-bit'], ['Language', navigator.language],
      ['Languages', (navigator.languages || []).join(', ')], ['Cookies Enabled', navigator.cookieEnabled ? 'Yes' : 'No'],
      ['JavaScript Enabled', 'Yes'], ['Online', navigator.onLine ? 'Yes' : 'No'],
      ['Timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'],
      ['Device Pixel Ratio', String(window.devicePixelRatio || 1)], ['Touch Support', 'ontouchstart' in window ? 'Yes' : 'No'],
      ['Platform', (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || 'Unknown']
    ];
    mount.innerHTML = '<div class="card card-p0">' + info.map(function (x) {
      return '<div class="flex" style="padding:.75rem 1.25rem;border-top:1px solid var(--slate-100);gap:1rem;align-items:flex-start"><span style="width:11rem;flex-shrink:0;font-weight:600;font-size:.875rem;color:var(--slate-500)">' + esc(x[0]) + '</span><span class="mono-cell" style="white-space:normal;word-break:break-all">' + esc(x[1]) + '</span></div>';
    }).join('') + '<div style="padding:.75rem 1.25rem;background:var(--emerald-50)"><span class="small" style="color:var(--emerald-700);font-weight:600">Detected instantly in your browser — nothing was sent to a server.</span></div></div>';
  }

  // Pokemon status
  function pokemonStatus(cfg, mount) {
    mount.innerHTML = '<button type="button" class="btn btn-primary pk-run" style="margin-bottom:1.25rem">Check Server Status</button><div class="pk-out"></div>';
    var btn = mount.querySelector('.pk-run'), out = mount.querySelector('.pk-out');
    btn.addEventListener('click', function () {
      var rng = new Seeded(Date.now().toString());
      var defs = [['Login / Authentication', 0.95], ['Game Servers (Global)', 0.97], ['Pokemon Trainer Club', 0.9], ['Google Sign-in', 0.97], ['Friends & Gifting', 0.93], ['Trading', 0.9], ['Raid Battles', 0.92], ['GO Battle League', 0.88], ['Pok\u00e9Stops & Gyms', 0.95], ['In-app Purchases', 0.96]];
      var html = '<div class="card card-p0">';
      defs.forEach(function (d) {
        var ok = rng.next() < d[1];
        var status = ok ? (rng.next() > 0.15 ? 'Operational' : 'Intermittent') : 'Down';
        var color = status === 'Down' ? 'var(--red-600)' : status === 'Intermittent' ? 'var(--amber-600)' : 'var(--emerald-600)';
        var dot = status === 'Down' ? 'var(--red-500)' : status === 'Intermittent' ? 'var(--amber-500)' : 'var(--emerald-500)';
        html += '<div class="flex-between" style="padding:.75rem 1.25rem;border-top:1px solid var(--slate-100)"><span style="font-weight:500;font-size:.9rem">' + esc(d[0]) + '</span><span class="flex" style="gap:.5rem;color:' + color + ';font-weight:600;font-size:.875rem"><span style="width:.5rem;height:.5rem;border-radius:999px;background:' + dot + '"></span>' + status + '</span></div>';
      });
      out.innerHTML = html + '<div style="padding:.75rem 1.25rem" class="small muted">Illustrative status check refreshed on demand. Always verify official channels during outages.</div></div>';
      btn.textContent = 'Refresh Status';
    });
  }

  // Image tool (compress / resize)
  function imageTool(cfg, mount) {
    var mode = cfg.engine === 'image-resize' ? 'resize' : 'compress';
    mount.innerHTML =
      '<label style="display:block;border:2px dashed var(--slate-300);border-radius:var(--radius-2xl);padding:2.5rem;text-align:center;cursor:pointer;margin-bottom:1.25rem">' +
      '<input type="file" accept="image/*" style="display:none" class="im-file"><p style="font-weight:500;color:var(--slate-600)" class="im-name">Click or drop an image here</p>' +
      '<p class="small muted" style="margin-top:.25rem">Everything runs locally in your browser — no uploads</p></label>' +
      '<div class="im-controls" hidden>' +
      (mode === 'compress'
        ? '<div class="field"><label>Quality: <span class="im-qv">0.7</span></label><input type="range" min="0.1" max="0.95" step="0.05" value="0.7" class="im-quality" style="width:100%;accent-color:var(--indigo-600)"></div>'
        : '<div class="field"><label>Target width (px)</label><input type="number" class="input im-width" min="1" style="max-width:14rem"></div>') +
      '<button type="button" class="btn btn-primary im-run">' + (mode === 'compress' ? 'Compress Image' : 'Resize Image') + '</button></div>' +
      '<div class="im-out mt-6"></div>';
    var fileInput = mount.querySelector('.im-file'), nameEl = mount.querySelector('.im-name');
    var controls = mount.querySelector('.im-controls'), out = mount.querySelector('.im-out');
    var img = null, file = null;
    fileInput.addEventListener('change', function () {
      file = fileInput.files && fileInput.files[0];
      if (!file) return;
      nameEl.textContent = file.name;
      out.innerHTML = '';
      var i = new Image();
      i.onload = function () { img = i; if (mode === 'resize') mount.querySelector('.im-width').value = i.naturalWidth; controls.hidden = false; };
      i.src = URL.createObjectURL(file);
    });
    var kb = function (b) { return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.round(b / 1024) + ' KB'; };
    mount.querySelector('.im-run').addEventListener('click', function () {
      if (!img || !file) return;
      var qEl = mount.querySelector('.im-quality');
      var width = mode === 'resize' ? Number(mount.querySelector('.im-width').value) || img.naturalWidth : img.naturalWidth;
      var quality = mode === 'compress' ? Number(qEl.value) : 0.92;
      var h = mode === 'resize' && width ? Math.round(img.naturalHeight * (width / img.naturalWidth)) : img.naturalHeight;
      var canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, h);
      var useWebp = file.type === 'image/webp' || mode === 'compress';
      canvas.toBlob(function (blob) {
        if (!blob) return;
        var url = URL.createObjectURL(blob);
        out.innerHTML = '<div class="card"><div class="grid grid-2">' +
          '<div><p class="eyebrow">Original</p><img src="' + img.src + '" alt="Original image" style="max-height:14rem;border-radius:var(--radius);border:1px solid var(--slate-200)"><p class="small muted mt-2">' + kb(file.size) + '</p></div>' +
          '<div><p class="eyebrow">Result</p><img src="' + url + '" alt="Processed image" style="max-height:14rem;border-radius:var(--radius);border:1px solid var(--slate-200)"><p class="small muted mt-2">' + kb(blob.size) + ' (' + Math.round((1 - blob.size / file.size) * 100) + '% smaller)</p></div>' +
          '</div><div class="text-center mt-6"><a class="btn btn-dark" href="' + url + '" download="processed.' + (useWebp ? 'webp' : 'jpg') + '">Download ' + (useWebp ? 'WebP' : 'JPEG') + '</a></div></div>';
      }, useWebp ? 'image/webp' : 'image/jpeg', quality);
    });
    var qEl = mount.querySelector('.im-quality');
    if (qEl) qEl.addEventListener('input', function () { mount.querySelector('.im-qv').textContent = qEl.value; });
  }

  /* ---------------- TextRunner wrapper ---------------- */
  function textRunner(cfg, mount) {
    var isKeyword = cfg.input === 'keyword';
    var isMerge = cfg.input === 'twotext';
    var html = isKeyword
      ? '<input class="input tr-in" placeholder="' + esc(cfg.placeholder || '') + '" style="margin-bottom:1rem">'
      : '<textarea class="textarea tr-in" rows="9" spellcheck="false" placeholder="' + esc(cfg.placeholder || '') + '" style="margin-bottom:1rem"></textarea>';
    if (isMerge) html += '<textarea class="textarea tr-in2" rows="9" placeholder="' + esc(cfg.placeholder2 || 'Second list...') + '" style="margin-bottom:1rem"></textarea>';
    html += '<div class="tr-out"></div>';
    mount.innerHTML = html;
    var in1 = mount.querySelector('.tr-in'), in2 = mount.querySelector('.tr-in2'), out = mount.querySelector('.tr-out');
    var render = function () { workingEngine(cfg, in1.value, in2 ? in2.value : '', out); };
    in1.addEventListener('input', render);
    if (in2) in2.addEventListener('input', render);
    render();
  }

  /* ---------------- dispatcher ---------------- */
  var BESPOKE = {
    'plagiarism-checker': plagiarismChecker,
    'robots-txt-generator': robotsGen,
    'meta-tag-generator': metaGen,
    'backlink-maker': backlinkMaker,
    'domain-name-search': domainAvail,
    'what-is-my-browser': browserInfo,
    'pokemon-go-server-status': pokemonStatus
  };
  var IMAGE_ENGINES = { 'image-compress': imageTool, 'image-resize': imageTool };

  function mountTool(cfg, mount) {
    if (BESPOKE[cfg.slug]) { BESPOKE[cfg.slug](cfg, mount); return true; }
    if (cfg.slug === 'grammar-checker' || cfg.slug === 'article-rewriter') { textRunner(cfg, mount); return true; }
    if (IMAGE_ENGINES[cfg.engine]) { IMAGE_ENGINES[cfg.engine](cfg, mount); return true; }
    // Text engines handled by WorkingEngine
    var TEXT_SLUGS = ['word-counter', 'case-converter', 'keyword-density-checker', 'online-md5-generator', 'small-text-generator', 'reverse-text-generator',
      'merge-words-online-tool', 'long-tail-keyword-generator', 'keyword-rich-domains-suggestions-tool', 'article-rewriter', 'grammar-checker',
      'spell-checker', 'text-to-speech', 'css-minify', 'html-minify', 'javascript-minifier', 'xml-sitemap-generator'];
    if (TEXT_SLUGS.indexOf(cfg.slug) !== -1) { textRunner(cfg, mount); return true; }
    return false;
  }

  global.ToolEngines = {
    Seeded: Seeded, buildReport: buildReport, reportView: reportView, progressHtml: progressHtml,
    lookupRunner: lookupRunner, textRunner: textRunner, mountTool: mountTool, esc: esc,
    autoMount: function () {
      var cfg = global.TOOL_CONFIG;
      var mount = document.getElementById('tool-engine');
      if (!cfg || !mount) return;
      if (mountTool(cfg, mount)) return;
      if (global.WebTools && global.WebTools.mountTool(cfg, mount)) return;
      if (global.Calculators && global.Calculators.mountTool(cfg, mount)) return;
      if (global.IpTools && global.IpTools.mountTool(cfg, mount)) return;
      if (global.PdfTools && global.PdfTools.mountTool(cfg, mount)) return;
      // fall back to the simulated lookup runner
      lookupRunner(cfg, mount);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', global.ToolEngines.autoMount);
  else global.ToolEngines.autoMount();
})(window);
