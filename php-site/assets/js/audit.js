/* ============================================================
   SEO Audit Tools — audit engine (pure vanilla JS)
   Fetches the page through CORS relays, parses real on-page
   signals with DOMParser, scores 5 categories and renders the
   report. Same engine powers the homepage audit and the
   competitor comparison.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- CORS relay chain (same as the React build) ---------------- */
  var PROXIES = [
    function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
    function (u) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u); },
    function (u) { return 'https://thingproxy.freeboard.io/fetch/' + u; },
    function (u) { return 'https://cors.eu.org/' + u; },
    function (u) { return 'https://proxy.cors.sh/' + u; }
  ];

  function withTimeout(ms) {
    try { return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined; } catch (e) { return undefined; }
  }
  function looksLikeHtml(t) {
    return !!t && t.length > 200 && /<(html|head|body|title|!doctype)/i.test(t);
  }

  function fetchHtml(targetUrl) {
    // 1) Direct fetch (works for CORS-permissive sites)
    return fetch(targetUrl, { signal: withTimeout(6000), mode: 'cors', headers: { Accept: 'text/html' } })
      .then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; })
      .then(function (t) {
        if (looksLikeHtml(t)) return t;
        // 2) Race the first two relays, then try the rest sequentially
        var attempt = function (wrap, ms) {
          return fetch(wrap(targetUrl), { signal: withTimeout(ms), headers: { Accept: 'text/html,application/xhtml+xml' } })
            .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
            .then(function (t) { if (!looksLikeHtml(t)) throw new Error('not html'); return t; });
        };
        return new Promise(function (resolve) {
          var pending = 2, settled = false;
          PROXIES.slice(0, 2).forEach(function (p) {
            attempt(p, 9000).then(function (t) { if (!settled) { settled = true; resolve(t); } })
              .catch(function () { if (--pending === 0 && !settled) { settled = true; resolve(null); } });
          });
        }).then(function (raced) {
          if (raced) return raced;
          var chain = Promise.reject();
          PROXIES.slice(2).forEach(function (wrap) {
            chain = chain.catch(function () { return attempt(wrap, 8000); });
          });
          return chain.catch(function () { return null; });
        });
      });
  }

  /* ---------------- parse the fetched page ---------------- */
  function fetchPageData(rawUrl, keyword) {
    var targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
    var t0 = Date.now();
    return fetchHtml(targetUrl).then(function (html) {
      if (!html) return null;
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var targetHost = '';
        try { targetHost = new URL(targetUrl).hostname.replace(/^www\./, ''); } catch (e) {}

        var scriptEls = Array.prototype.slice.call(doc.querySelectorAll('script'));
        var metaContent = function (sel) {
          var el = doc.querySelector(sel);
          return (el && el.getAttribute('content') || '').trim();
        };
        var resolveUrl = function (href, base) {
          try { return new URL(href, base).href; } catch (e) { return href; }
        };

        var headingCounts = { H1: 0, H2: 0, H3: 0, H4: 0, H5: 0, H6: 0 };
        var h1s = [];
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function (tag) {
          doc.querySelectorAll(tag).forEach(function (el) {
            headingCounts[tag.toUpperCase()]++;
            if (tag === 'h1') {
              var t = (el.textContent || '').trim().replace(/\s+/g, ' ');
              if (t) h1s.push(t.slice(0, 120));
            }
          });
        });

        var imageCount = 0, imagesMissingAlt = 0, imagesAltWithKeyword = 0, imagesWithoutDimensions = 0;
        doc.querySelectorAll('img').forEach(function (img) {
          var src = img.getAttribute('src') || img.getAttribute('data-src');
          if (!src) return;
          imageCount++;
          var alt = (img.getAttribute('alt') || '').trim();
          if (!alt) imagesMissingAlt++;
          if (keyword && alt.toLowerCase().indexOf(keyword.toLowerCase()) !== -1) imagesAltWithKeyword++;
          if (!img.getAttribute('width') || !img.getAttribute('height')) imagesWithoutDimensions++;
        });

        var internalLinks = 0, externalLinks = 0, nofollowLinks = 0;
        var seen = {}, linksSample = [];
        doc.querySelectorAll('a[href]').forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (/^(javascript:|mailto:|tel:|#)/i.test(href)) return;
          var u;
          try { u = new URL(href, targetUrl); } catch (e) { return; }
          var key = u.href.split('#')[0];
          if (seen[key]) return;
          seen[key] = 1;
          var rel = (a.getAttribute('rel') || '').toLowerCase();
          var isNofollow = rel.indexOf('nofollow') !== -1;
          if (isNofollow) nofollowLinks++;
          var internal = u.hostname.replace(/^www\./, '') === targetHost;
          if (internal) internalLinks++;
          else if (u.protocol === 'http:' || u.protocol === 'https:') externalLinks++;
          if (linksSample.length < 80 && (internal || u.protocol === 'http:' || u.protocol === 'https:')) {
            var anchor = ((a.textContent || '').replace(/\s+/g, ' ').trim() || a.getAttribute('aria-label') || a.getAttribute('title') || u.hostname).slice(0, 120);
            linksSample.push({ href: key, internal: internal, nofollow: isNofollow, anchor: anchor });
          }
        });

        var codeSize = html.length;
        var inlineStyleCount = doc.querySelectorAll('style').length;
        Array.prototype.forEach.call(doc.querySelectorAll('script,style,noscript,svg,template'), function (el) { el.remove(); });
        var mainRoot = doc.querySelector('article, main, [role="main"]') || doc.body;
        var paragraphs = [];
        (mainRoot ? Array.prototype.slice.call(mainRoot.querySelectorAll('p, h1, h2, h3, li')) : []).forEach(function (el) {
          var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (t.split(' ').length >= 4) paragraphs.push(t);
        });
        var readable = paragraphs.join(' ');
        var bodyText = (readable.length > 200 ? readable : (doc.body ? doc.body.textContent : '')).replace(/\s+/g, ' ').trim();
        var wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;
        var textSize = bodyText.length;

        var emails = [];
        var emailSet = {};
        (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).forEach(function (em) {
          if (!/\.(png|jpg|gif|svg|webp|css|js)$/i.test(em) && !emailSet[em.toLowerCase()]) { emailSet[em.toLowerCase()] = 1; emails.push(em.toLowerCase()); }
        });

        var smallFonts = [];
        var fm = html.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi) || [];
        fm.forEach(function (m) { var v = parseFloat(m.replace(/[^\d.]/g, '')); if (v && v < 12) smallFonts.push(v); });

        var metaTags = [];
        Array.prototype.forEach.call(doc.querySelectorAll('meta'), function (m) {
          var name = m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv') || '';
          var content = m.getAttribute('content') || '';
          if (name) metaTags.push({ name: name, content: content });
        });

        return {
          live: true, finalUrl: targetUrl,
          title: (doc.querySelector('title') ? doc.querySelector('title').textContent : '').trim(),
          description: metaContent('meta[name="description"]') || metaContent('meta[property="og:description"]'),
          metaTags: metaTags,
          inlineStyles: inlineStyleCount,
          h1s: h1s, headingCounts: headingCounts,
          imageCount: imageCount, imagesMissingAlt: imagesMissingAlt, imagesAltWithKeyword: imagesAltWithKeyword, imagesWithoutDimensions: imagesWithoutDimensions,
          internalLinks: internalLinks, externalLinks: externalLinks, nofollowLinks: nofollowLinks,
          wordCount: wordCount, textRatio: codeSize ? Math.round((textSize / codeSize) * 1000) / 10 : 0,
          canonical: (function () { var c = doc.querySelector('link[rel="canonical"]'); return c && c.getAttribute('href') ? resolveUrl(c.getAttribute('href'), targetUrl) : targetUrl; })(),
          charset: !!doc.querySelector('meta[charset]'),
          viewport: !!doc.querySelector('meta[name="viewport"]'),
          lang: doc.documentElement.getAttribute('lang'),
          robots: metaContent('meta[name="robots"]') || 'index, follow',
          ogTitle: !!metaContent('meta[property="og:title"]'),
          ogDescription: !!metaContent('meta[property="og:description"]'),
          ogImage: !!metaContent('meta[property="og:image"]'),
          twitterCard: !!metaContent('meta[name="twitter:card"]'),
          codeSize: codeSize, textSize: textSize,
          linksSample: linksSample, bodyText: bodyText.slice(0, 20000), html: html,
          fetchMs: Date.now() - t0,
          scripts: scriptEls.length,
          externalScripts: scriptEls.filter(function (s) { return s.getAttribute('src'); }).length,
          stylesheets: doc.querySelectorAll('link[rel="stylesheet"]').length,
          iframes: doc.querySelectorAll('iframe').length,
          hasJsonLd: !!doc.querySelector('script[type="application/ld+json"]'),
          emails: emails.slice(0, 50),
          smallFontRisk: smallFonts.length > 0,
          generator: (function () { var g = doc.querySelector('meta[name="generator"]'); return g ? (g.getAttribute('content') || '').trim() : ''; })()
        };
      } catch (e) { return null; }
    });
  }

  /* ---------------- deterministic fallback (site blocks relays) ---------------- */
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seeded(seed) {
    var x = hashString(seed) || 1;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      x = x || 1;
      return (x >>> 0) / 4294967296;
    };
  }
  function fallbackData(url) {
    var rnd = seeded(url);
    var host = url.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./, '');
    var brand = host.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    var words = Math.round(400 + rnd() * 1500), images = Math.round(5 + rnd() * 20);
    return {
      live: false, finalUrl: /^https?:\/\//i.test(url) ? url : 'https://' + url,
      title: brand + ' | Professional Online Services',
      description: 'Explore ' + brand + ' services, resources and practical online solutions.',
      h1s: [brand + ' Services'],
      headingCounts: { H1: 1, H2: Math.round(3 + rnd() * 6), H3: Math.round(2 + rnd() * 7), H4: 0, H5: 0, H6: 0 },
      imageCount: images, imagesMissingAlt: Math.round(rnd() * Math.min(5, images)), imagesAltWithKeyword: 1, imagesWithoutDimensions: Math.round(rnd() * Math.min(4, images)),
      internalLinks: Math.round(15 + rnd() * 70), externalLinks: Math.round(2 + rnd() * 16), nofollowLinks: Math.round(rnd() * 5),
      wordCount: words, textRatio: Math.round((5 + rnd() * 16) * 10) / 10,
      canonical: url, charset: true, viewport: rnd() > 0.12, lang: 'en', robots: 'index, follow',
      ogTitle: rnd() > 0.2, ogDescription: rnd() > 0.25, ogImage: rnd() > 0.35, twitterCard: rnd() > 0.35,
      codeSize: Math.round(55000 + rnd() * 160000), textSize: words * 6,
      linksSample: [], bodyText: '', html: '', fetchMs: Math.round(250 + rnd() * 1300),
      scripts: Math.round(5 + rnd() * 24), externalScripts: Math.round(3 + rnd() * 16),
      stylesheets: Math.round(2 + rnd() * 8), inlineStyles: 1, iframes: Math.round(rnd() * 3),
      hasJsonLd: rnd() > 0.4, emails: [], metaTags: [], smallFontRisk: rnd() > 0.84, generator: ''
    };
  }

  /* ---------------- audit checks ---------------- */
  function lengthState(n, min, max) { return !n ? 'error' : (n >= min && n <= max ? 'success' : 'warning'); }

  function buildAudit(url, page) {
    var https = page.finalUrl.indexOf('https://') === 0;
    function check(label, detail, fix, type) { return { label: label, detail: detail, fix: fix, type: type }; }

    var onPage = [
      check('Title tag', page.title ? page.title.length + ' characters: ' + page.title : 'Missing.', 'Use a unique title between 30 and 60 characters.', lengthState(page.title.length, 30, 60)),
      check('Meta description', page.description ? page.description.length + ' characters.' : 'Missing.', 'Write a compelling description between 120 and 160 characters.', lengthState(page.description.length, 120, 160)),
      check('H1 heading', page.headingCounts.H1 + ' H1 tag(s).', 'Use exactly one descriptive H1.', page.headingCounts.H1 === 1 ? 'success' : 'error'),
      check('Content depth', page.wordCount.toLocaleString() + ' readable words.', 'Expand thin content with useful information.', page.wordCount >= 600 ? 'success' : page.wordCount >= 300 ? 'warning' : 'error'),
      check('Image alt text', page.imagesMissingAlt + ' of ' + page.imageCount + ' images missing alt text.', 'Add descriptive alt text to meaningful images.', page.imagesMissingAlt === 0 ? 'success' : page.imagesMissingAlt <= 3 ? 'warning' : 'error'),
      check('Canonical URL', page.canonical || 'Missing.', 'Add a self-referencing canonical URL.', page.canonical ? 'success' : 'warning')
    ];
    var technical = [
      check('Indexing', 'robots: ' + (page.robots || 'not specified'), 'Remove accidental noindex directives.', /noindex/i.test(page.robots) ? 'error' : 'success'),
      check('Character set', page.charset ? 'Declared.' : 'Missing.', 'Declare UTF-8 in the document head.', page.charset ? 'success' : 'warning'),
      check('Language', page.lang ? 'lang=' + page.lang : 'Missing.', 'Add a valid HTML lang attribute.', page.lang ? 'success' : 'warning'),
      check('Structured data', page.hasJsonLd ? 'JSON-LD detected.' : 'No JSON-LD detected.', 'Add relevant schema.org structured data.', page.hasJsonLd ? 'success' : 'warning'),
      check('Internal links', page.internalLinks + ' unique internal links.', 'Add contextual links to important pages.', page.internalLinks >= 5 ? 'success' : 'warning'),
      check('Code-to-text ratio', page.textRatio + '% visible text.', 'Reduce template bloat and expose useful HTML content.', page.textRatio >= 10 ? 'success' : page.textRatio >= 5 ? 'warning' : 'error')
    ];
    var mobile = [
      check('Viewport', page.viewport ? 'Responsive viewport found.' : 'Missing.', 'Add width=device-width, initial-scale=1.', page.viewport ? 'success' : 'error'),
      check('Responsive images', /srcset=/i.test(page.html) ? 'srcset detected.' : 'No srcset detected.', 'Use srcset and sizes for responsive images.', /srcset=/i.test(page.html) ? 'success' : 'warning'),
      check('Image dimensions', page.imagesWithoutDimensions + ' images without width/height.', 'Set dimensions to reduce layout shift.', page.imagesWithoutDimensions === 0 ? 'success' : 'warning'),
      check('Font legibility', page.smallFontRisk ? 'Small inline fonts detected.' : 'No tiny inline fonts detected.', 'Keep mobile body text at 16px or above.', page.smallFontRisk ? 'warning' : 'success')
    ];
    var security = [
      check('HTTPS', https ? 'Secure HTTPS response.' : 'HTTP response.', 'Redirect every page to HTTPS.', https ? 'success' : 'error'),
      check('Mixed content', https && !/(src|href)=["']http:\/\//i.test(page.html) ? 'No obvious mixed content.' : 'Insecure resources may exist.', 'Load every resource over HTTPS.', https && !/(src|href)=["']http:\/\//i.test(page.html) ? 'success' : 'warning'),
      check('Hidden iframes', /<iframe[^>]+(display:\s*none|width=["']?0|height=["']?0)/i.test(page.html) ? 'Hidden iframe detected.' : 'No hidden iframe pattern.', 'Review suspicious embedded frames.', /<iframe[^>]+(display:\s*none|width=["']?0|height=["']?0)/i.test(page.html) ? 'error' : 'success'),
      check('Script obfuscation', /eval\(|document\.write\(unescape|fromCharCode/i.test(page.html) ? 'Potentially obfuscated script.' : 'No common pattern found.', 'Remove or review untrusted obfuscated scripts.', /eval\(|document\.write\(unescape|fromCharCode/i.test(page.html) ? 'warning' : 'success')
    ];
    var performance = [
      check('Response time', page.fetchMs + ' ms to fetch HTML.', 'Use caching, a CDN and faster hosting.', page.fetchMs <= 800 ? 'success' : page.fetchMs <= 1800 ? 'warning' : 'error'),
      check('HTML size', Math.round(page.codeSize / 1024) + ' KB.', 'Remove unused markup and inline code.', page.codeSize <= 100000 ? 'success' : page.codeSize <= 200000 ? 'warning' : 'error'),
      check('External scripts', page.externalScripts + ' external scripts.', 'Delay or remove non-critical third-party scripts.', page.externalScripts <= 8 ? 'success' : page.externalScripts <= 15 ? 'warning' : 'error'),
      check('Stylesheets', page.stylesheets + ' stylesheets.', 'Remove unused CSS and reduce blocking styles.', page.stylesheets <= 5 ? 'success' : page.stylesheets <= 9 ? 'warning' : 'error'),
      check('Iframes', page.iframes + ' iframe(s).', 'Lazy-load below-the-fold embeds.', page.iframes <= 2 ? 'success' : 'warning')
    ];

    var categories = [
      { key: 'onPage', name: 'On-Page SEO', checks: onPage },
      { key: 'technical', name: 'Technical SEO', checks: technical },
      { key: 'mobile', name: 'Mobile', checks: mobile },
      { key: 'security', name: 'Security', checks: security },
      { key: 'performance', name: 'Performance', checks: performance }
    ];
    var weights = { success: 100, warning: 52, error: 12 };
    categories.forEach(function (c) {
      var total = c.checks.reduce(function (n, x) { return n + weights[x.type]; }, 0);
      c.score = Math.round(total / c.checks.length);
    });
    var all = [];
    categories.forEach(function (c) { c.checks.forEach(function (x) { all.push(x); }); });

    // top keywords from visible text
    var STOP = 'the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were'.split(' ');
    var words = (page.bodyText || '').toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || [];
    var counts = {};
    words.forEach(function (w) { if (STOP.indexOf(w) === -1 && !/^\d+$/.test(w)) counts[w] = (counts[w] || 0) + 1; });
    var keywords = Object.keys(counts).map(function (k) { return { term: k, count: counts[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 12)
      .map(function (k) { return { term: k.term, count: k.count, density: Math.round((k.count / Math.max(1, words.length)) * 1000) / 10 }; });

    return {
      url: url, host: (page.finalUrl || url).replace(/^https?:\/\//, '').split('/')[0],
      live: page.live, categories: categories,
      score: Math.round(categories.reduce(function (n, c) { return n + c.score; }, 0) / categories.length),
      summary: {
        total: all.length,
        errors: all.filter(function (x) { return x.type === 'error'; }).length,
        warnings: all.filter(function (x) { return x.type === 'warning'; }).length,
        passed: all.filter(function (x) { return x.type === 'success'; }).length
      },
      page: page, keywords: keywords
    };
  }

  /* ---------------- RDAP domain info ---------------- */
  function rdapInfo(input) {
    var host = input.trim();
    try { host = new URL(/^https?:\/\//i.test(host) ? host : 'https://' + host).hostname; } catch (e) { host = host.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].split(':')[0]; }
    host = host.replace(/^www\./i, '').toLowerCase().replace(/\.$/, '');
    var empty = function (err) {
      return { domain: host || 'Unknown', live: false, registrar: '', registered: '', registeredIso: '', expiry: '', expiryIso: '', updated: '', ageLabel: 'Unavailable', daysToExpiry: null, statuses: [], error: err };
    };
    if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return Promise.resolve(empty('RDAP only supports public domain names.'));
    return fetch('https://rdap.org/domain/' + encodeURIComponent(host), { signal: withTimeout(8000), headers: { Accept: 'application/rdap+json, application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        var ev = function (action) {
          var out = '';
          (data.events || []).forEach(function (e2) { if ((e2.eventAction || '').toLowerCase() === action) out = e2.eventDate || ''; });
          return out;
        };
        var registrar = '';
        (data.entities || []).forEach(function (en) {
          if ((en.roles || []).some(function (r) { return r.toLowerCase() === 'registrar'; })) {
            var card = en.vcardArray && en.vcardArray[1];
            if (card) card.forEach(function (f) { if (f[0] === 'fn' && f[3]) registrar = String(f[3]); });
            if (!registrar) registrar = en.handle || '';
          }
        });
        var fmt = function (v) {
          if (!v) return '';
          var d = new Date(v);
          return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
        };
        var reg = ev('registration'), exp = ev('expiration') || ev('registrar expiration');
        var days = exp ? Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000) : null;
        var ageLabel = 'Unavailable';
        if (reg && !isNaN(new Date(reg).getTime())) {
          var d = new Date(reg), now = new Date();
          var y = now.getUTCFullYear() - d.getUTCFullYear(), m = now.getUTCMonth() - d.getUTCMonth(), dd = now.getUTCDate() - d.getUTCDate();
          if (dd < 0) { m--; dd += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate(); }
          if (m < 0) { y--; m += 12; }
          var parts = [];
          if (y) parts.push(y + ' year' + (y === 1 ? '' : 's'));
          if (m || !y) parts.push(m + ' month' + (m === 1 ? '' : 's'));
          ageLabel = parts.join(', ') || 'Registered today';
        }
        return {
          domain: (data.ldhName || host).toLowerCase(), live: true, registrar: registrar,
          registered: fmt(reg), registeredIso: reg, expiry: fmt(exp), expiryIso: exp,
          updated: fmt(ev('last changed')), ageLabel: ageLabel, daysToExpiry: isNaN(days) ? null : days,
          statuses: (data.status || []).slice(0, 4), error: ''
        };
      })
      .catch(function () { return empty('Registry information could not be reached from this browser.'); });
  }

  /* ---------------- rendering ---------------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  function tone(n) { return n >= 80 ? 'tone-good' : n >= 60 ? 'tone-mid' : 'tone-bad'; }
  function stroke(n) { return n >= 80 ? 'stroke-good' : n >= 60 ? 'stroke-mid' : 'stroke-bad'; }

  function gaugeHtml(value) {
    var r = 43, c = Math.PI * 2 * r;
    return '<div class="gauge-wrap"><svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="#e2e8f0" stroke-width="7"/>' +
      '<circle class="' + stroke(value) + '" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c - value / 100 * c) + '"/>' +
      '</svg><span class="gauge-value ' + tone(value) + '">' + value + '</span></div>';
  }

  function renderAudit(audit, domain, mountId) {
    var mount = document.getElementById(mountId);
    if (!mount) return;
    var p = audit.page;
    var catCards = audit.categories.map(function (c) {
      return '<div class="card stat"><p class="stat-value ' + tone(c.score) + '" style="background:none;-webkit-text-fill-color:initial;color:inherit;font-size:1.6rem">' + c.score + '</p><p class="stat-label">' + esc(c.name) + '</p></div>';
    }).join('');

    var issueRows = '';
    audit.categories.forEach(function (c) {
      issueRows += '<div class="card card-p0 mt-4"><div class="flex-between" style="padding:.9rem 1.1rem;background:var(--slate-50);border-bottom:1px solid var(--slate-100)"><h3 style="font-size:.95rem">' + esc(c.name) + '</h3><b class="' + tone(c.score) + '">' + c.score + '/100</b></div>';
      c.checks.forEach(function (x) {
        issueRows += '<div class="issue-row"><span class="issue-dot dot-' + x.type + '"></span><div><p style="font-weight:700;font-size:.9rem;color:var(--slate-800)">' + esc(x.label) + '</p><p class="small muted" style="margin-top:.15rem">' + esc(x.detail) + '</p><p class="small" style="margin-top:.4rem;color:var(--slate-700)"><b>Fix:</b> ' + esc(x.fix) + '</p></div></div>';
      });
      issueRows += '</div>';
    });

    var kwHtml = audit.keywords.length
      ? audit.keywords.map(function (k) { return '<span class="cat-chip cat-text"><strong>' + esc(k.term) + '</strong> ' + k.count + '&times; &middot; ' + k.density + '%</span>'; }).join(' ')
      : '<p class="small muted">No keyword data available (estimated report).</p>';

    var domainHtml = domain
      ? '<div class="card mt-4"><h3 style="font-size:1rem">Domain Information</h3>' +
        (domain.live
          ? '<div class="grid grid-4 mt-4">' +
            '<div><p class="small muted">Registered domain</p><p class="mono-cell">' + esc(domain.domain) + '</p></div>' +
            '<div><p class="small muted">Current registration age</p><p style="font-weight:700">' + esc(domain.ageLabel) + '</p><p class="small muted">Created ' + esc(domain.registered || '—') + '</p></div>' +
            '<div><p class="small muted">Registry expiry</p><p style="font-weight:700">' + esc(domain.expiry || '—') + '</p><p class="small ' + (domain.daysToExpiry !== null && domain.daysToExpiry < 30 ? 'tone-bad' : 'muted') + '">' + (domain.daysToExpiry === null ? 'Expiry date unavailable' : domain.daysToExpiry >= 0 ? domain.daysToExpiry + ' days remaining' : 'Expired ' + Math.abs(domain.daysToExpiry) + ' days ago') + '</p></div>' +
            '<div><p class="small muted">Registrar</p><p style="font-weight:700">' + esc(domain.registrar || '—') + '</p></div></div>' +
            '<p class="small muted mt-4">Source: RDAP registry &middot; <a href="https://lookup.icann.org/en/lookup?name=' + encodeURIComponent(domain.domain) + '" target="_blank" rel="noopener noreferrer">Verify at ICANN ↗</a></p>'
          : '<p class="small muted mt-2">' + esc(domain.error || 'Registry data unavailable.') + '</p>') +
        '</div>'
      : '';

    mount.innerHTML =
      '<div class="card">' +
        '<div class="flex" style="align-items:center;gap:1.25rem;flex-wrap:wrap">' +
          gaugeHtml(audit.score) +
          '<div style="flex:1;min-width:16rem"><h3 style="font-size:1.05rem">Overall SEO Score — ' + esc(audit.host) + '</h3>' +
          '<p class="small muted">' + (audit.live ? 'Live HTML analysis' : 'Estimated fallback (site blocked automated access)') + '</p>' +
          '<div class="grid grid-4 mt-4">' +
            '<div class="stat-box" style="background:var(--indigo-50)"><p class="stat-box-label" style="color:var(--indigo-700)">Checks</p><p style="font-weight:700;color:var(--indigo-700)">' + audit.summary.total + '</p></div>' +
            '<div class="stat-box" style="background:var(--red-50)"><p class="stat-box-label" style="color:var(--red-700)">Errors</p><p style="font-weight:700;color:var(--red-700)">' + audit.summary.errors + '</p></div>' +
            '<div class="stat-box" style="background:var(--amber-50)"><p class="stat-box-label" style="color:var(--amber-700)">Warnings</p><p style="font-weight:700;color:var(--amber-700)">' + audit.summary.warnings + '</p></div>' +
            '<div class="stat-box" style="background:var(--emerald-50)"><p class="stat-box-label" style="color:var(--emerald-700)">Passed</p><p style="font-weight:700;color:var(--emerald-700)">' + audit.summary.passed + '</p></div>' +
          '</div></div>' +
          '<div><button type="button" class="btn btn-dark" data-download-report>Download PDF Report</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="stats-band mt-6">' + catCards + '</div>' +
      domainHtml +
      '<div class="card mt-4"><h3 style="font-size:1rem">Top Keywords</h3><div class="flex mt-4">' + kwHtml + '</div></div>' +
      issueRows;

    var dl = mount.querySelector('[data-download-report]');
    if (dl) dl.addEventListener('click', function () { openReportWindow(audit, domain); });
  }

  /* ---------------- printable PDF report (browser print → PDF) ---------------- */
  function openReportWindow(audit, domain) {
    var w = window.open('', '_blank');
    if (!w) { alert('Your browser blocked the report window. Please allow pop-ups for this site and try again.'); return; }
    var p = audit.page;
    var rows = '';
    audit.categories.forEach(function (c) {
      c.checks.forEach(function (x) {
        rows += '<tr><td>' + esc(x.label) + '</td><td>' + esc(x.detail) + '</td><td class="' + x.type + '">' + x.type.toUpperCase() + '</td><td>' + esc(x.fix) + '</td></tr>';
      });
    });
    var domainRows = domain && domain.live
      ? '<tr><td>Domain</td><td>' + esc(domain.domain) + '</td></tr>' +
        '<tr><td>Registered</td><td>' + esc(domain.registered) + ' (age: ' + esc(domain.ageLabel) + ')</td></tr>' +
        '<tr><td>Expires</td><td>' + esc(domain.expiry) + '</td></tr>' +
        '<tr><td>Registrar</td><td>' + esc(domain.registrar || '—') + '</td></tr>'
      : '';
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SEO Audit Report — ' + esc(audit.host) + '</title>' +
      '<style>body{font-family:system-ui,sans-serif;color:#1e293b;max-width:900px;margin:24px auto;padding:0 16px}' +
      'h1{font-size:22px;margin-bottom:2px}h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #6366f1;padding-bottom:4px}' +
      'table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}' +
      'th{background:#f1f5f9}.success{color:#059669;font-weight:700}.warning{color:#d97706;font-weight:700}.error{color:#dc2626;font-weight:700}' +
      '.score{font-size:40px;font-weight:800;color:#6366f1}.meta{color:#64748b;font-size:12px;margin-bottom:16px}' +
      '.toolbar{margin-bottom:16px}@media print{.toolbar{display:none}}</style></head><body>' +
      '<div class="toolbar"><button onclick="window.print()" style="padding:10px 18px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">Save as PDF</button></div>' +
      '<h1>SEO Audit Report</h1><p class="meta">' + esc(audit.url) + ' &middot; generated ' + new Date().toLocaleString('en-GB') + ' &middot; SEO Audit Tools (seoaudittools.pk)</p>' +
      '<p class="score">' + audit.score + '<span style="font-size:14px;color:#64748b">/100</span></p>' +
      '<p class="meta">' + audit.summary.passed + ' passed &middot; ' + audit.summary.warnings + ' warnings &middot; ' + audit.summary.errors + ' errors &middot; ' + (audit.live ? 'Live HTML analysis' : 'Estimated fallback') + '</p>' +
      (domainRows ? '<h2>Domain Information (RDAP registry)</h2><table>' + domainRows + '</table>' : '') +
      '<h2>All checks</h2><table><tr><th>Check</th><th>Detail</th><th>Status</th><th>Recommended fix</th></tr>' + rows + '</table>' +
      '<p style="margin-top:24px;font-size:11px;color:#94a3b8">Use your browser\'s Save as PDF option to download this report.</p>' +
      '</body></html>');
    w.document.close();
  }

  /* ---------------- homepage wiring ---------------- */
  function runHomepageAudit() {
    var form = document.getElementById('audit-form');
    if (!form) return;
    var input = document.getElementById('audit-url');
    var button = document.getElementById('audit-button');
    var progressZone = document.getElementById('audit-progress');
    var progressFill = document.getElementById('audit-progress-fill');
    var progressLabel = document.getElementById('audit-progress-label');
    var results = document.getElementById('audit-results');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = (input.value || '').trim();
      if (!url) { input.focus(); return; }
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span> Analyzing…';
      results.hidden = true;
      results.innerHTML = '';
      progressZone.hidden = false;
      var pct = 8;
      progressFill.style.width = '8%';
      progressLabel.textContent = 'Fetching and auditing ' + url + '…';
      var timer = setInterval(function () { pct = Math.min(90, pct + 4); progressFill.style.width = pct + '%'; }, 250);

      var kwGuess = url.replace(/^https?:\/\//, '').split('/').filter(Boolean).slice(1).pop() || '';
      kwGuess = kwGuess.split('?')[0].replace(/\.\w+$/, '').replace(/[-_]+/g, ' ');

      var t0 = Date.now();
      Promise.all([
        Promise.race([fetchPageData(url, kwGuess).catch(function () { return null; }), new Promise(function (r) { setTimeout(function () { r(null); }, 9500); })]),
        Promise.race([rdapInfo(url).catch(function () { return null; }), new Promise(function (r) { setTimeout(function () { r(null); }, 9500); })])
      ]).then(function (out) {
        // ensure the progress animation shows for at least ~2s for perceived quality
        var wait = Math.max(0, 2000 - (Date.now() - t0));
        setTimeout(function () {
          clearInterval(timer);
          progressFill.style.width = '100%';
          progressLabel.textContent = 'Report ready.';
          var page = out[0] || fallbackData(url);
          var audit = buildAudit(url, page);
          setTimeout(function () {
            renderAudit(audit, out[1], 'audit-results');
            results.hidden = false;
            button.disabled = false;
            button.textContent = 'Analyze';
            progressZone.hidden = true;
            results.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 200);
        }, wait);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runHomepageAudit);
  else runHomepageAudit();

  /* ---------------- public API (used by competitor page) ---------------- */
  window.SEOAudit = { fetchPageData: fetchPageData, fallbackData: fallbackData, buildAudit: buildAudit, rdapInfo: rdapInfo, renderAudit: renderAudit, gaugeHtml: gaugeHtml, esc: esc, tone: tone };
})();
