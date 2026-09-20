/* Website management tools + generators (vanilla JS port of WebTools.tsx / WebGenerators.tsx) */
(function (global) {
  'use strict';
  var Seeded = (global.ToolEngines && global.ToolEngines.Seeded) || function () { this.next = function () { return 0.5; }; this.int = function (a) { return a; }; this.pick = function (a) { return a[0]; }; };
  var esc = (global.SEO && global.SEO.esc) || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  function panel(label, value) { return (global.SEO && global.SEO.outputPanel) ? global.SEO.outputPanel(label, value) : '<pre class="output-pre">' + esc(value) + '</pre>'; }
  function fetchPage(url) { return global.SEOAudit ? global.SEOAudit.fetchPageData(url) : Promise.reject(new Error('audit.js missing')); }
  function kb(b) { return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : (b / 1024).toFixed(1) + ' KB'; }
  function hostOf(u) { return String(u || '').replace(/^https?:\/\//, '').split('/')[0]; }
  function spinner(l) { return '<div class="spin-row"><span class="spin"></span>' + esc(l) + '</div>'; }
  function fail(msg) { return '<div class="warn-box">' + esc(msg || 'The page could not be fetched. The site may block automated requests or require JavaScript to render. Try another URL.') + '</div>'; }
  function live(ms) { return '<span class="live-dot">Live page data' + (ms ? ' · ' + ms + ' ms' : '') + '</span>'; }
  function stat(label, value, tone) { return '<div class="te-stat' + (tone ? ' ' + tone : '') + '"><p>' + esc(label) + '</p><b>' + (value == null || value === '' ? '—' : value) + '</b></div>'; }
  function card(title, body, right) { return '<div class="card"><div class="flex-between mb-4"><h3 class="h3" style="margin:0">' + title + '</h3>' + (right || '') + '</div>' + body + '</div>'; }
  function urlBar(id, label, ph) {
    return '<div class="te-row" style="flex-wrap:nowrap"><input class="input ' + id + '-url" placeholder="' + esc(ph || 'https://example.com') + '" style="flex:1"><button type="button" class="btn btn-primary ' + id + '-go">' + esc(label || 'Analyze') + '</button></div>';
  }
  function ring(value, label) {
    var r = 52, c = 2 * Math.PI * r, color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';
    var off = c - (value / 100) * c;
    return '<div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="#e2e8f0" stroke-width="10"/><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/></svg><div class="ring-val"><span style="font-size:1.8rem;font-weight:800;color:' + color + '">' + value + '</span><span class="small muted" style="text-transform:uppercase;font-weight:700">' + esc(label || 'Score') + '</span></div></div>';
  }
  function checkList(checks) {
    return '<ul style="list-style:none">' + checks.map(function (c) {
      var cls = c.pass === null ? 'check-na' : c.pass ? 'check-ok' : 'check-no';
      var mark = c.pass === null ? '–' : c.pass ? '✓' : '!';
      return '<li class="check-row"><span class="check-mark ' + cls + '">' + mark + '</span><div><p style="font-weight:600;font-size:.9rem">' + esc(c.label) + '</p><p class="small muted">' + esc(c.detail) + '</p></div></li>';
    }).join('') + '</ul>';
  }
  function scoreOf(checks) {
    var total = 0, got = 0;
    checks.forEach(function (c) { var w = c.weight || 1; total += w; if (c.pass) got += w; });
    return Math.round((got / total) * 100);
  }
  function bindFetch(mount, cls, onData, labelBusy) {
    var input = mount.querySelector('.' + cls + '-url');
    var go = mount.querySelector('.' + cls + '-go');
    var zone = mount.querySelector('.' + cls + '-out');
    function run() {
      var u = input.value.trim(); if (!u) return;
      zone.innerHTML = spinner(labelBusy || 'Fetching the live page…');
      go.disabled = true;
      fetchPage(u).then(function (d) {
        go.disabled = false;
        if (!d) { zone.innerHTML = fail(); return; }
        onData(d, zone);
      }).catch(function () { go.disabled = false; zone.innerHTML = fail(); });
    }
    go.addEventListener('click', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
  }

  function seoChecks(d) {
    return [
      { label: 'HTTPS', pass: d.finalUrl.indexOf('https://') === 0, detail: d.finalUrl.indexOf('https://') === 0 ? 'Page is served securely.' : 'Serve the page over HTTPS.', weight: 8 },
      { label: 'Title tag', pass: d.title.length >= 30 && d.title.length <= 60, detail: d.title ? d.title.length + ' characters: “' + d.title.slice(0, 80) + '”' : 'No title tag found.', weight: 10 },
      { label: 'Meta description', pass: d.description.length >= 120 && d.description.length <= 160, detail: d.description ? d.description.length + ' characters.' : 'Missing meta description.', weight: 8 },
      { label: 'Single H1 heading', pass: d.headingCounts.H1 === 1, detail: d.headingCounts.H1 + ' H1 tag(s) found' + (d.h1s[0] ? ': “' + d.h1s[0].slice(0, 70) + '”' : '.') , weight: 8 },
      { label: 'Heading hierarchy', pass: d.headingCounts.H2 > 0, detail: 'H2: ' + d.headingCounts.H2 + ', H3: ' + d.headingCounts.H3 + ', H4: ' + d.headingCounts.H4 + '.', weight: 4 },
      { label: 'Image alt attributes', pass: d.imagesMissingAlt === 0, detail: d.imagesMissingAlt + ' of ' + d.imageCount + ' images missing alt text.', weight: 6 },
      { label: 'Content length', pass: d.wordCount >= 300, detail: d.wordCount.toLocaleString() + ' words of readable text.', weight: 8 },
      { label: 'Code to text ratio', pass: d.textRatio >= 10, detail: d.textRatio + '% text (aim for 10%+).', weight: 4 },
      { label: 'Canonical tag', pass: !!d.canonical, detail: d.canonical || 'No canonical link.', weight: 5 },
      { label: 'Viewport meta (mobile)', pass: d.viewport, detail: d.viewport ? 'Responsive viewport declared.' : 'Add <meta name="viewport">.', weight: 8 },
      { label: 'Language attribute', pass: !!d.lang, detail: d.lang ? 'lang="' + d.lang + '"' : 'Add lang attribute to <html>.', weight: 3 },
      { label: 'Charset declared', pass: d.charset, detail: d.charset ? 'UTF-8 charset present.' : 'Declare a character set.', weight: 2 },
      { label: 'Robots directive', pass: !/noindex/i.test(d.robots), detail: 'robots: ' + d.robots, weight: 6 },
      { label: 'Open Graph tags', pass: d.ogTitle && d.ogDescription && d.ogImage, detail: 'og:title ' + (d.ogTitle ? '✓' : '✗') + ' · og:description ' + (d.ogDescription ? '✓' : '✗') + ' · og:image ' + (d.ogImage ? '✓' : '✗'), weight: 5 },
      { label: 'Twitter card', pass: d.twitterCard, detail: d.twitterCard ? 'twitter:card present.' : 'Add twitter:card meta.', weight: 3 },
      { label: 'Structured data (JSON-LD)', pass: d.hasJsonLd, detail: d.hasJsonLd ? 'Schema.org JSON-LD detected.' : 'No JSON-LD structured data found.', weight: 5 },
      { label: 'Internal linking', pass: d.internalLinks >= 5, detail: d.internalLinks + ' internal, ' + d.externalLinks + ' external, ' + d.nofollowLinks + ' nofollow.', weight: 4 },
      { label: 'Page weight (HTML)', pass: d.codeSize < 150000, detail: kb(d.codeSize) + ' of HTML.', weight: 3 }
    ];
  }

  function seoScore(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('ss', 'Check SEO Score') + '<div class="ss-out"></div></div>';
    bindFetch(mount, 'ss', function (d, zone) {
      var checks = seoChecks(d), score = scoreOf(checks), passed = checks.filter(function (c) { return c.pass; }).length;
      var fixes = checks.filter(function (c) { return !c.pass; }).sort(function (a, b) { return (b.weight || 0) - (a.weight || 0); });
      zone.innerHTML = '<div class="grid grid-3"><div class="card">' + ring(score, 'SEO Score') + '<p class="text-center small muted mt-2">' + passed + '/' + checks.length + ' checks passed</p></div><div class="card" style="grid-column:span 2"><div class="flex-between mb-4"><h3 class="h3" style="margin:0;word-break:break-all">' + esc(hostOf(d.finalUrl)) + '</h3>' + live(d.fetchMs) + '</div><div class="grid grid-4">' +
        stat('Words', d.wordCount.toLocaleString()) + stat('Images', String(d.imageCount), d.imagesMissingAlt ? 'warn' : 'good') + stat('Links', String(d.internalLinks + d.externalLinks)) + stat('HTML size', kb(d.codeSize), d.codeSize > 150000 ? 'warn' : 'good') +
        stat('Scripts', String(d.scripts), d.scripts > 25 ? 'warn' : '') + stat('Stylesheets', String(d.stylesheets)) + stat('Response', d.fetchMs + ' ms', d.fetchMs < 800 ? 'good' : d.fetchMs < 2000 ? 'warn' : 'bad') + stat('Generator', d.generator || '—') + '</div></div></div>' +
        card('Detailed checks', checkList(checks)) +
        card('Priority fixes', fixes.length ? '<ol style="padding-left:1.2rem">' + fixes.map(function (c) { return '<li><strong>' + esc(c.label) + '</strong> — ' + esc(c.detail) + '</li>'; }).join('') + '</ol>' : '<p class="te-stat good"><b>Everything passed — excellent on-page foundation.</b></p>');
    }, 'Fetching the live page and running 18 SEO checks…');
  }

  function metaAnalyze(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('ma', 'Analyze Meta Tags') + '<div class="ma-out"></div></div>';
    bindFetch(mount, 'ma', function (d, zone) {
      var important = ['title', 'description', 'keywords', 'robots', 'viewport', 'charset', 'author', 'generator', 'theme-color', 'og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'canonical'];
      function grade(name, content) {
        if (name === 'title') return content.length >= 30 && content.length <= 60 ? ['Optimal length', 'good'] : content.length ? [content.length > 60 ? 'Too long (>60)' : 'Too short (<30)', 'warn'] : ['Missing', 'bad'];
        if (name === 'description') return content.length >= 120 && content.length <= 160 ? ['Optimal length', 'good'] : content.length ? [content.length > 160 ? 'Too long (>160)' : 'Too short (<120)', 'warn'] : ['Missing', 'bad'];
        if (name === 'keywords') return content ? ['Ignored by Google', 'warn'] : ['Not needed', 'good'];
        if (name === 'robots') return /noindex/i.test(content) ? ['Blocks indexing!', 'bad'] : ['OK', 'good'];
        return content ? ['Present', 'good'] : ['Missing', name.indexOf('og:') === 0 || name.indexOf('twitter:') === 0 ? 'warn' : 'bad'];
      }
      var map = {}; map.title = d.title; map.canonical = d.canonical;
      (d.metaTags || []).forEach(function (m) { var k = (m.name || '').toLowerCase(); if (!map[k]) map[k] = m.content; });
      var rows = important.map(function (n) { return { name: n, content: map[n] || '', g: grade(n, map[n] || '') }; });
      var others = (d.metaTags || []).filter(function (m) { return important.indexOf((m.name || '').toLowerCase()) === -1; });
      var good = rows.filter(function (r) { return r.g[1] === 'good'; }).length;
      zone.innerHTML = '<div class="grid grid-4">' + stat('Meta tags found', String((d.metaTags || []).length + 1)) + stat('Important tags OK', good + '/' + rows.length, good >= rows.length - 3 ? 'good' : 'warn') + stat('Title length', d.title.length + ' chars', d.title.length >= 30 && d.title.length <= 60 ? 'good' : 'warn') + stat('Description length', d.description.length + ' chars', d.description.length >= 120 && d.description.length <= 160 ? 'good' : 'warn') + '</div>' +
        card('Important SEO & social meta tags', '<div class="table-wrap"><table><thead><tr><th>Tag</th><th>Content</th><th>Status</th></tr></thead><tbody>' +
          rows.map(function (r) { return '<tr><td class="mono" style="color:var(--indigo-700)">' + esc(r.name) + '</td><td>' + (r.content ? esc(r.content) : '<em class="muted">not set</em>') + '</td><td class="te-stat ' + r.g[1] + '" style="background:none;border:0;padding:0"><b>' + esc(r.g[0]) + '</b></td></tr>'; }).join('') +
          '</tbody></table></div>', live(d.fetchMs)) +
        (others.length ? card('Other meta tags (' + others.length + ')', '<div class="grid grid-2">' + others.map(function (m) { return '<div class="te-stat"><p class="mono" style="color:var(--indigo-700)">' + esc(m.name) + '</p><b class="small">' + esc((m.content || '—').slice(0, 160)) + '</b></div>'; }).join('') + '</div>') : '');
    }, 'Extracting meta tags from the live page…');
  }

  function ogCheck(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('og', 'Check Open Graph') + '<div class="og-out"></div></div>';
    bindFetch(mount, 'og', function (d, zone) {
      function og(k) { var m = (d.metaTags || []).find(function (x) { return (x.name || '').toLowerCase() === 'og:' + k; }); return m ? m.content : ''; }
      function tw(k) { var m = (d.metaTags || []).find(function (x) { return (x.name || '').toLowerCase() === 'twitter:' + k; }); return m ? m.content : ''; }
      var req = [['og:title', og('title'), true], ['og:description', og('description'), true], ['og:image', og('image'), true], ['og:url', og('url'), true], ['og:type', og('type'), false], ['og:site_name', og('site_name'), false], ['og:locale', og('locale'), false], ['og:image:width', og('image:width'), false], ['og:image:height', og('image:height'), false], ['og:image:alt', og('image:alt'), false]];
      var present = req.filter(function (r) { return r[1]; }).length;
      var title = og('title') || d.title, desc = og('description') || d.description, img = og('image');
      zone.innerHTML = '<div class="grid grid-2">' +
        card('Facebook / LinkedIn share preview', '<div class="og-preview"><div class="og-img">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : 'No og:image — link will show without an image') + '</div><div class="og-body"><p class="small muted" style="text-transform:uppercase">' + esc(hostOf(og('url') || d.finalUrl)) + '</p><p style="font-weight:800">' + esc(title || 'No title') + '</p><p class="small muted">' + esc(desc || 'No description') + '</p></div></div>', live(d.fetchMs)) +
        card('Open Graph tags (' + present + '/' + req.length + ' present)', checkList(req.map(function (r) { return { label: r[0] + (r[2] ? ' (required)' : ''), pass: r[1] ? true : r[2] ? false : null, detail: r[1] ? String(r[1]).slice(0, 140) : r[2] ? 'Missing — add this tag for correct sharing.' : 'Optional, not set.' }; }))) +
        '</div>' + card('Twitter / X card tags', '<div class="grid grid-4">' + ['card', 'title', 'description', 'image', 'site', 'creator'].map(function (k) {
          var v = tw(k); return stat('twitter:' + k, v ? '<span class="small">' + esc(v.slice(0, 60)) + '</span>' : '—', v ? 'good' : k === 'card' ? 'bad' : '');
        }).join('') + '</div>' + (!tw('card') ? '<p class="small muted mt-4">Without twitter:card, X falls back to Open Graph tags but shows a smaller preview.</p>' : ''));
    }, 'Fetching Open Graph tags…');
  }

  function snooper(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('sn', 'View Source') + '<div class="sn-out"></div></div>';
    bindFetch(mount, 'sn', function (d, zone) {
      var lines = d.html.split('\n');
      function tagCount(t) { return (d.html.match(new RegExp('<' + t + '[\\s>]', 'gi')) || []).length; }
      function render(filter, wrap) {
        var shown = lines.map(function (l, i) { return [l, i]; }).filter(function (p) { return !filter || p[0].toLowerCase().indexOf(filter.toLowerCase()) !== -1; });
        zone.innerHTML = '<div class="grid grid-4">' + stat('Lines', lines.length.toLocaleString()) + stat('Size', kb(d.codeSize)) + stat('<div>', String(tagCount('div'))) + stat('<a>', String(tagCount('a'))) +
          stat('<img>', String(tagCount('img'))) + stat('<script>', String(d.scripts)) + stat('<link>', String(tagCount('link'))) + stat('<iframe>', String(d.iframes)) + '</div>' +
          '<div class="source-view"><div class="sv-head"><span class="mono small" style="color:#cbd5e1;flex:1;overflow:hidden;text-overflow:ellipsis">' + esc(d.finalUrl) + '</span>' +
          '<input class="input sn-filter" placeholder="Filter lines…" style="width:10rem;padding:.4rem .7rem;background:#0f172a;color:#e2e8f0;border-color:#475569" value="' + esc(filter) + '">' +
          '<button type="button" class="btn btn-ghost sn-wrap" style="background:#334155;color:#e2e8f0;border:0">' + (wrap ? 'No wrap' : 'Wrap') + '</button>' +
          '<button type="button" class="btn btn-primary sn-copy">Copy source</button></div><div class="sv-body">' +
          shown.slice(0, 3000).map(function (p) { return '<div class="sv-line"><span class="sv-n">' + (p[1] + 1) + '</span><span class="sv-t' + (wrap ? ' wrap' : '') + '">' + esc(p[0].length > 2000 ? p[0].slice(0, 2000) + ' …' : p[0]) + '</span></div>'; }).join('') +
          (shown.length > 3000 ? '<p class="small muted" style="padding:.5rem 1rem">Showing first 3,000 lines. Use the filter or copy the full source.</p>' : '') + '</div></div>';
        zone.querySelector('.sn-filter').addEventListener('input', function (e) { render(e.target.value, wrap); });
        zone.querySelector('.sn-wrap').addEventListener('click', function () { render(filter, !wrap); });
        zone.querySelector('.sn-copy').addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(d.html); });
      }
      render('', false);
    }, 'Downloading page source…');
  }

  var HEADER_INFO = {
    'content-type': 'MIME type and character encoding of the response body.',
    'content-encoding': 'Compression applied (gzip/br). Missing means uncompressed transfer.',
    'cache-control': 'How browsers and CDNs may cache the page. Long max-age = faster repeat visits.',
    'server': 'Web server software. Consider hiding version numbers for security.',
    'strict-transport-security': 'HSTS: forces HTTPS for future visits. Recommended security header.',
    'content-security-policy': 'CSP: restricts which scripts/resources may load. Strong XSS protection.',
    'x-frame-options': 'Prevents clickjacking by blocking framing on other sites.',
    'x-content-type-options': 'nosniff stops browsers from MIME-sniffing responses.',
    'referrer-policy': 'Controls how much referrer information is sent with requests.',
    'permissions-policy': 'Restricts browser features (camera, geolocation, etc.).',
    'set-cookie': 'Cookies issued by the server. Check for Secure, HttpOnly and SameSite flags.',
    'x-powered-by': 'Reveals backend technology; usually best removed.',
    'etag': 'Validator for conditional requests and efficient caching.',
    'last-modified': 'When the resource last changed; used for caching.',
    'vary': 'Which request headers affect the cached response.',
    'age': 'Seconds the response has been in a CDN/proxy cache.',
    'cf-ray': 'Cloudflare request ID — indicates Cloudflare is in front of the site.',
    'x-cache': 'CDN cache HIT/MISS status.',
    'alt-svc': 'Advertises HTTP/3 (QUIC) availability.',
    'location': 'Redirect target URL.'
  };

  function headersTool(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('hd', 'Get Headers') + '<div class="hd-out"></div></div>';
    var input = mount.querySelector('.hd-url'), go = mount.querySelector('.hd-go'), zone = mount.querySelector('.hd-out');
    function run() {
      var u = input.value.trim(); if (!u) return;
      var target = /^https?:\/\//i.test(u) ? u : 'https://' + u;
      zone.innerHTML = spinner('Requesting headers…'); go.disabled = true;
      var t0 = performance.now();
      function done(res) {
        go.disabled = false;
        var security = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
        var secN = security.filter(function (s) { return res.headers.some(function (h) { return h[0] === s; }); }).length;
        zone.innerHTML = '<div class="grid grid-4">' + stat('Status', res.status + ' ' + res.statusText, res.status < 300 ? 'good' : res.status < 400 ? 'warn' : 'bad') + stat('Response time', res.ms + ' ms', res.ms < 800 ? 'good' : 'warn') + stat('Headers', String(res.headers.length)) + stat('Security headers', secN + '/6', secN >= 4 ? 'good' : 'warn') + '</div>' +
          card('Response headers', '<div>' + res.headers.map(function (h) {
            return '<div class="check-row"><span class="mono small" style="color:var(--indigo-700);width:14rem;flex-shrink:0">' + esc(h[0]) + '</span><div><p class="mono small">' + esc(h[1]) + '</p>' + (HEADER_INFO[h[0]] ? '<p class="small muted">' + esc(HEADER_INFO[h[0]]) + '</p>' : '') + '</div></div>';
          }).join('') + '</div>', '<span class="small muted">via ' + esc(res.via) + '</span>') +
          card('Security header audit', checkList(security.map(function (s) { return { label: s, pass: res.headers.some(function (h) { return h[0] === s; }), detail: HEADER_INFO[s] }; })));
      }
      fetch(target, { method: 'GET', mode: 'cors', redirect: 'follow', signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined }).then(function (r) {
        var hs = []; r.headers.forEach(function (v, k) { hs.push([k, v]); });
        done({ status: r.status, statusText: r.statusText, headers: hs, ms: Math.round(performance.now() - t0), via: 'direct (CORS)' });
      }).catch(function () {
        var relays = [
          function () { return fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(target), { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined }).then(function (r) { return r.json(); }).then(function (j) { var st = j.status || {}; var hs = Object.keys(st.headers || {}).map(function (k) { return [k.toLowerCase(), String(st.headers[k])]; }); if (!hs.length && !st.http_code) throw new Error('empty'); return { status: st.http_code || 200, hs: hs }; }); },
          function () { return fetch('https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(target), { signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined }).then(function (r) { var hs = []; r.headers.forEach(function (v, k) { hs.push([k, v]); }); if (!r.ok) throw new Error('bad'); return { status: r.status, hs: hs }; }); }
        ];
        (function next(i) {
          if (i >= relays.length) { go.disabled = false; zone.innerHTML = fail('Headers could not be retrieved from the browser: the site does not allow cross-origin reads and the public relays are unavailable right now. Tip: run `curl -I ' + target + '` in a terminal for the raw headers.'); return; }
          relays[i]().then(function (x) {
            var st = x.status;
            done({ status: st, statusText: st === 200 ? 'OK' : st >= 300 && st < 400 ? 'Redirect' : st >= 400 ? 'Error' : '', headers: x.hs, ms: Math.round(performance.now() - t0), via: 'proxy relay' });
          }).catch(function () { next(i + 1); });
        })(0);
      });
    }
    go.addEventListener('click', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
  }

  function wpDetect(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('wp', 'Detect Theme') + '<div class="wp-out"></div></div>';
    bindFetch(mount, 'wp', function (d, zone) {
      var h = d.html;
      var isWp = /wp-content|wp-includes|wp-json|WordPress/i.test(h);
      var themes = Array.from(new Set(Array.from(h.matchAll(/wp-content\/themes\/([a-z0-9_-]+)/gi)).map(function (m) { return m[1].toLowerCase(); })));
      var plugins = Array.from(new Set(Array.from(h.matchAll(/wp-content\/plugins\/([a-z0-9_-]+)/gi)).map(function (m) { return m[1].toLowerCase(); })));
      var version = ((d.generator || '').match(/WordPress\s*([\d.]+)/i) || [])[1] || (h.match(/ver=(\d+\.\d+(?:\.\d+)?)/) || [])[1] || '';
      var builders = [['elementor', 'Elementor'], ['divi', 'Divi'], ['beaver', 'Beaver Builder'], ['wpbakery|js_composer', 'WPBakery'], ['oxygen', 'Oxygen'], ['bricks', 'Bricks']].filter(function (b) { return new RegExp(b[0], 'i').test(h); }).map(function (b) { return b[1]; });
      var cms = isWp ? 'WordPress' : /shopify/i.test(h) ? 'Shopify' : /wix\.com/i.test(h) ? 'Wix' : /squarespace/i.test(h) ? 'Squarespace' : /joomla/i.test(h) ? 'Joomla' : /drupal/i.test(h) ? 'Drupal' : /webflow/i.test(h) ? 'Webflow' : /ghost/i.test(d.generator || '') ? 'Ghost' : /next\.js|__next/i.test(h) ? 'Next.js' : /nuxt/i.test(h) ? 'Nuxt' : 'Unknown / custom';
      function pretty(s) { return s.replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
      zone.innerHTML = '<div class="hero-grad" style="' + (isWp ? '' : 'background:var(--slate-800)') + '"><p style="opacity:.8">' + esc(hostOf(d.finalUrl)) + '</p><p style="font-size:1.8rem;font-weight:800;margin-top:.25rem">' + (isWp ? 'WordPress detected' : 'Not WordPress — ' + esc(cms)) + '</p>' +
        (isWp && themes[0] ? '<p style="margin-top:.5rem">Active theme: <strong>' + esc(pretty(themes[0])) + '</strong>' + (themes[1] ? ' <span style="opacity:.8">(parent: ' + esc(pretty(themes[1])) + ')</span>' : '') + '</p>' : '') + '</div>' +
        '<div class="grid grid-4">' + stat('CMS / Platform', cms, 'good') + stat('WP version', version || (isWp ? 'Hidden' : '—')) + stat('Themes found', String(themes.length)) + stat('Plugins detected', String(plugins.length)) + '</div>' +
        (builders.length ? card('Page builder', '<p>' + esc(builders.join(', ')) + '</p>') : '') +
        (plugins.length ? card('Installed plugins (' + plugins.length + ' visible in source)', '<div class="te-row">' + plugins.map(function (p) { return '<span class="pill">' + esc(pretty(p)) + '</span>'; }).join('') + '</div><p class="small muted mt-4">Only plugins that load front-end assets are detectable. Admin-only plugins remain hidden.</p>') : '') +
        (d.generator ? card('Generator meta tag', '<p class="mono">' + esc(d.generator) + '</p>') : '');
    }, 'Scanning source for WordPress signatures…');
  }

  function mobileTest(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('mb', 'Test Mobile Friendliness') + '<div class="mb-out"></div></div>';
    bindFetch(mount, 'mb', function (d, zone) {
      var vp = ((d.metaTags || []).find(function (m) { return m.name === 'viewport'; }) || {}).content || '';
      var checks = [
        { label: 'Viewport meta tag', pass: !!vp, detail: vp ? 'content="' + vp + '"' : 'Missing — the page will render at desktop width on phones.', weight: 30 },
        { label: 'Viewport uses device-width', pass: /device-width/.test(vp), detail: /device-width/.test(vp) ? 'Layout adapts to screen width.' : 'Use width=device-width, initial-scale=1.', weight: 15 },
        { label: 'Zoom not disabled', pass: !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp), detail: /user-scalable\s*=\s*(no|0)/.test(vp) ? 'user-scalable=no harms accessibility.' : 'Users can pinch-zoom.', weight: 10 },
        { label: 'Responsive images (srcset)', pass: /srcset=/i.test(d.html), detail: /srcset=/i.test(d.html) ? 'srcset detected for responsive images.' : 'No srcset found; phones may download desktop-size images.', weight: 10 },
        { label: 'Images have dimensions', pass: d.imagesWithoutDimensions === 0, detail: d.imagesWithoutDimensions + ' of ' + d.imageCount + ' images lack width/height (causes layout shift).', weight: 10 },
        { label: 'Legible font sizes', pass: !d.smallFontRisk, detail: d.smallFontRisk ? 'Inline font-size below 12px detected.' : 'No tiny inline font sizes found.', weight: 10 },
        { label: 'No Flash / plugins', pass: !/<(embed|object)[^>]+(swf|flash)/i.test(d.html), detail: 'Plugins are unsupported on mobile browsers.', weight: 5 },
        { label: 'Reasonable page weight', pass: d.codeSize < 200000, detail: kb(d.codeSize) + ' of HTML.', weight: 5 },
        { label: 'Limited render-blocking scripts', pass: d.externalScripts <= 15, detail: d.externalScripts + ' external scripts.', weight: 5 }
      ];
      var score = scoreOf(checks);
      var verdict = score >= 80 ? ['Mobile friendly', 'good'] : score >= 60 ? ['Needs improvement', 'warn'] : ['Not mobile friendly', 'bad'];
      zone.innerHTML = '<div class="grid grid-2"><div><div class="card flex" style="align-items:center;gap:1.5rem">' + ring(score, 'Mobile') + '<div><p class="te-stat ' + verdict[1] + '" style="background:none;border:0;padding:0"><b style="font-size:1.4rem">' + verdict[0] + '</b></p><p class="small muted">' + checks.filter(function (c) { return c.pass; }).length + '/' + checks.length + ' checks passed for ' + esc(hostOf(d.finalUrl)) + '</p><div class="mt-2">' + live(d.fetchMs) + '</div></div></div>' + card('Mobile usability checks', checkList(checks)) + '</div>' +
        '<div class="phone-frame"><div style="background:#fff;border-radius:1.7rem;overflow:hidden"><div style="height:1.5rem;background:var(--slate-100);display:flex;align-items:center;justify-content:center"><span style="width:4rem;height:.35rem;border-radius:999px;background:var(--slate-300)"></span></div><iframe title="Mobile preview" src="' + esc(d.finalUrl) + '" loading="lazy" sandbox="allow-same-origin allow-scripts"></iframe></div><p class="small muted text-center mt-2">Live preview at 375px · some sites block embedding</p></div></div>';
    }, 'Analysing mobile signals…');
  }

  function pageSpeed(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('ps', 'Check Speed') + '<div class="ps-out"></div></div>';
    bindFetch(mount, 'ps', function (d, zone) {
      var est3g = ((d.codeSize * 8) / 1600000 + 0.3).toFixed(1);
      var est4g = ((d.codeSize * 8) / 9000000 + 0.1).toFixed(2);
      var grade = d.fetchMs < 600 ? 'A' : d.fetchMs < 1200 ? 'B' : d.fetchMs < 2500 ? 'C' : 'D';
      var gColor = grade === 'A' ? 'var(--emerald-500)' : grade === 'B' ? '#84cc16' : grade === 'C' ? 'var(--amber-500)' : 'var(--red-500)';
      var recs = [
        d.externalScripts > 10 && 'Reduce the ' + d.externalScripts + ' external scripts; defer non-critical JavaScript.',
        d.stylesheets > 4 && 'Combine or inline critical CSS (' + d.stylesheets + ' stylesheets).',
        d.codeSize > 150000 && 'HTML is ' + kb(d.codeSize) + '; remove inline SVG/data URIs and unused markup.',
        d.imagesWithoutDimensions > 0 && 'Add width/height to ' + d.imagesWithoutDimensions + ' images to prevent layout shift (CLS).',
        !/srcset=/i.test(d.html) && 'Serve responsive images with srcset and modern formats (WebP/AVIF).',
        d.iframes > 2 && d.iframes + ' iframes detected; lazy-load embeds.',
        d.textRatio < 10 && 'Code-to-text ratio is ' + d.textRatio + '%; trim template bloat.',
        !/loading="lazy"/i.test(d.html) && 'Use loading="lazy" on below-the-fold images.',
        !/rel="preconnect"|rel="preload"/i.test(d.html) && 'Add preconnect/preload hints for critical third-party origins and fonts.'
      ].filter(Boolean);
      zone.innerHTML = '<div class="grid grid-2"><div class="card text-center"><p class="small muted" style="text-transform:uppercase;font-weight:700">Speed grade</p><p style="font-size:4.5rem;font-weight:800;color:' + gColor + ';line-height:1">' + grade + '</p><p class="small muted">' + d.fetchMs + ' ms to fetch HTML</p></div><div class="grid grid-4">' +
        stat('Server response (HTML)', d.fetchMs + ' ms', d.fetchMs < 800 ? 'good' : d.fetchMs < 2000 ? 'warn' : 'bad') +
        stat('HTML size', kb(d.codeSize), d.codeSize < 100000 ? 'good' : 'warn') +
        stat('Scripts (ext / total)', d.externalScripts + ' / ' + d.scripts, d.externalScripts > 15 ? 'bad' : d.externalScripts > 8 ? 'warn' : 'good') +
        stat('Stylesheets', String(d.stylesheets), d.stylesheets > 6 ? 'warn' : 'good') +
        stat('Images', String(d.imageCount)) + stat('Iframes', String(d.iframes), d.iframes > 2 ? 'warn' : 'good') +
        stat('Est. HTML on 3G', est3g + 's') + stat('Est. HTML on 4G', est4g + 's') + '</div></div>' +
        card('Recommendations (' + recs.length + ')', (recs.length ? '<ul>' + recs.map(function (r) { return '<li style="margin:.4rem 0">▸ ' + esc(r) + '</li>'; }).join('') + '</ul>' : '<p class="te-stat good"><b>No obvious front-end bottlenecks detected in the HTML.</b></p>') +
          '<p class="small muted mt-4">Timing measures the HTML document only (via proxy). For full Core Web Vitals (LCP/INP/CLS) use field data from PageSpeed Insights.</p>', live(d.fetchMs));
    }, 'Timing the page download…');
  }

  function pageSize(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('pz', 'Check Page Size') + '<div class="pz-out"></div></div>';
    bindFetch(mount, 'pz', function (d, zone) {
      var bytes = d.codeSize;
      var conns = [['2G (50 kbps)', 50000], ['3G (1.6 Mbps)', 1600000], ['4G (9 Mbps)', 9000000], ['5G / Fibre (100 Mbps)', 100000000]];
      var note = bytes < 50000 ? 'Lean — well under the 100 KB HTML guideline.' : bytes < 150000 ? 'Average — consider trimming inline scripts/styles.' : 'Heavy — large HTML delays first render on slow connections.';
      zone.innerHTML = '<div class="hero-grad"><p style="opacity:.85">' + esc(hostOf(d.finalUrl)) + ' — HTML document size</p><p style="font-size:2rem;font-weight:800">' + kb(bytes) + ' <span style="font-size:1rem;opacity:.8">(' + bytes.toLocaleString() + ' bytes)</span></p><p style="opacity:.85;margin-top:.5rem">' + note + '</p></div>' +
        '<div class="grid grid-4">' + stat('Visible text', kb(d.textSize)) + stat('Text ratio', d.textRatio + '%', d.textRatio >= 10 ? 'good' : 'warn') + stat('Inline <style> blocks', String(d.inlineStyles || 0)) + stat('Inline <script> blocks', String(d.scripts - d.externalScripts)) + '</div>' +
        card('Estimated HTML download time', conns.map(function (c) {
          var s = (bytes * 8) / c[1];
          var lab = s < 1 ? Math.round(s * 1000) + ' ms' : s.toFixed(1) + ' s';
          return '<div class="mb-4"><div class="flex-between small"><span>' + esc(c[0]) + '</span><strong>' + lab + '</strong></div><div class="progress-track" style="max-width:none;margin:.35rem 0 0"><div class="progress-fill" style="width:' + Math.min(100, (s / 5) * 100) + '%"></div></div></div>';
        }).join('') + '<p class="small muted mt-4">Median web page HTML is ~30 KB; total page weight with images and scripts is typically 2 MB+. This tool measures the HTML document only.</p>', live(d.fetchMs));
    }, 'Measuring page size…');
  }

  function safety(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('sf', 'Scan Website') + '<div class="sf-out"></div></div>';
    bindFetch(mount, 'sf', function (d, zone) {
      var h = d.html;
      var mixed = d.finalUrl.indexOf('https://') === 0 && /(src|href)=["']http:\/\//i.test(h);
      var obfuscated = /eval\(|unescape\(|fromCharCode|document\.write\(unescape/i.test(h);
      var hiddenIframe = /<iframe[^>]+(display:\s*none|width=["']?0|height=["']?0)/i.test(h);
      var suspiciousRedirect = /<meta[^>]+http-equiv=["']refresh["'][^>]+url=/i.test(h) || /window\.location\s*=\s*["']http/i.test(h);
      var cryptoMiner = /coinhive|cryptonight|minero|coin-hive|webminer/i.test(h);
      var popups = /window\.open\(/i.test(h);
      var checks = [
        { label: 'HTTPS encryption', pass: d.finalUrl.indexOf('https://') === 0, detail: d.finalUrl.indexOf('https://') === 0 ? 'Traffic is encrypted.' : 'Site served over plain HTTP.', weight: 20 },
        { label: 'No mixed content', pass: !mixed, detail: mixed ? 'HTTP resources loaded on an HTTPS page.' : 'All detected resources use HTTPS.', weight: 10 },
        { label: 'No obfuscated scripts', pass: !obfuscated, detail: obfuscated ? 'eval/unescape/fromCharCode patterns found — common in malware.' : 'No obfuscation patterns found.', weight: 20 },
        { label: 'No hidden iframes', pass: !hiddenIframe, detail: hiddenIframe ? 'Zero-size or hidden iframe detected.' : d.iframes + ' visible iframe(s), none hidden.', weight: 15 },
        { label: 'No forced redirects', pass: !suspiciousRedirect, detail: suspiciousRedirect ? 'Meta refresh or JS redirect to another URL.' : 'No automatic redirects in HTML.', weight: 10 },
        { label: 'No crypto-mining scripts', pass: !cryptoMiner, detail: cryptoMiner ? 'Browser-mining library detected!' : 'No known mining libraries.', weight: 15 },
        { label: 'No pop-up scripts', pass: !popups, detail: popups ? 'window.open() found — may spawn pop-ups.' : 'No pop-up calls found.', weight: 5 },
        { label: 'Reasonable third-party scripts', pass: d.externalScripts <= 20, detail: d.externalScripts + ' external scripts loaded.', weight: 5 }
      ];
      var score = scoreOf(checks);
      var verdict = score >= 85 ? ['Looks safe', 'good'] : score >= 60 ? ['Some risks found', 'warn'] : ['Potentially unsafe', 'bad'];
      zone.innerHTML = '<div class="card flex" style="align-items:center;gap:1.5rem">' + ring(score, 'Safety') + '<div><p class="te-stat ' + verdict[1] + '" style="background:none;border:0;padding:0"><b style="font-size:1.5rem">' + verdict[0] + '</b></p><p class="small muted">' + esc(hostOf(d.finalUrl)) + ' · ' + checks.filter(function (c) { return c.pass; }).length + '/' + checks.length + ' checks passed</p><div class="mt-2">' + live(d.fetchMs) + '</div></div></div>' +
        card('Security checks', checkList(checks)) + '<p class="small muted">Static analysis of the HTML source. For full malware scanning use Google Safe Browsing, VirusTotal or AVG/Avast Online Security in addition.</p>';
    }, 'Scanning page for security risks…');
  }

  function emailPrivacy(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('em', 'Scan for Emails') + '<div class="em-out"></div>' + card('Obfuscate an email address', '<input class="input em-man" placeholder="name@example.com"><div class="em-ob"></div><p class="small muted mt-4">Best practice: use a contact form, or obfuscate with entities plus a mailto link generated by JavaScript.</p>') + '</div>';
    function obfuscate(email) {
      return {
        entity: email.split('').map(function (c) { return '&#' + c.charCodeAt(0) + ';'; }).join(''),
        spelled: email.replace('@', ' [at] ').replace(/\./g, ' [dot] '),
        reversed: '<span style="unicode-bidi:bidi-override;direction:rtl">' + email.split('').reverse().join('') + '</span>',
        js: "<script>document.write('" + email.split('@')[0] + "'+'@'+'" + email.split('@')[1] + "')</script>"
      };
    }
    function paintOb(email) {
      var box = mount.querySelector('.em-ob'); if (!email) { box.innerHTML = ''; return; }
      var o = obfuscate(email);
      box.innerHTML = [['HTML entities (recommended)', o.entity], ['Human readable', o.spelled], ['CSS reversed', o.reversed], ['JavaScript assembled', o.js]].map(function (row) {
        return '<div class="output-panel mt-4"><div class="output-label"><span>' + esc(row[0]) + '</span><button type="button" class="copy-btn" data-copy="' + esc(row[1]).replace(/\n/g, '&#10;') + '">Copy</button></div><code style="color:#6ee7b7;font-size:.8rem;word-break:break-all">' + esc(row[1]) + '</code></div>';
      }).join('');
    }
    mount.querySelector('.em-man').addEventListener('input', function (e) { paintOb(e.target.value.trim()); });
    bindFetch(mount, 'em', function (d, zone) {
      var list = d.emails || [];
      zone.innerHTML = '<div class="hero-grad" style="background:' + (list.length ? 'linear-gradient(to bottom right,#f59e0b,#ea580c)' : 'linear-gradient(to bottom right,#10b981,#0d9488)') + '"><p style="opacity:.9">' + esc(hostOf(d.finalUrl)) + '</p><p style="font-size:1.8rem;font-weight:800">' + (list.length ? list.length + ' exposed email' + (list.length > 1 ? 's' : '') + ' found' : 'No plain-text emails exposed') + '</p><p style="opacity:.9">' + (list.length ? 'These addresses can be harvested by spam bots.' : 'Good — harvesters will not find addresses in this page’s HTML.') + '</p>' +
        (list.length ? '<ul class="te-row mt-4">' + list.map(function (e) { return '<li class="pill" style="background:rgba(255,255,255,.2);color:#fff;border:0" class="mono">' + esc(e) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      if (list[0] && !mount.querySelector('.em-man').value) { mount.querySelector('.em-man').placeholder = list[0]; paintOb(list[0]); }
    }, 'Scanning page source for email addresses…');
  }

  function pageRank(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('pr', 'Check PageRank', 'example.com') + '<div class="pr-out"></div></div>';
    var input = mount.querySelector('.pr-url'), go = mount.querySelector('.pr-go'), zone = mount.querySelector('.pr-out');
    function run() {
      var d = input.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(); if (!d) return;
      var rng = new Seeded('pr|' + d);
      var da = rng.int(12, 92), pr = Math.min(10, Math.round(da / 10)), dr = Math.max(1, da + rng.int(-8, 8)), links = rng.int(400, 900000), ref = rng.int(30, 40000);
      zone.innerHTML = '<div class="grid grid-4"><div class="hero-grad" style="grid-column:span 2"><p style="opacity:.85">Estimated PageRank</p><p style="font-size:3rem;font-weight:800">' + pr + '<span style="font-size:1.2rem;opacity:.8">/10</span></p><div class="te-row mt-4">' + Array.from({ length: 10 }, function (_, i) { return '<span style="height:.5rem;flex:1;border-radius:4px;background:' + (i < pr ? '#fff' : 'rgba(255,255,255,.25)') + '"></span>'; }).join('') + '</div></div>' +
        stat('Domain Authority (Moz-style)', da + '/100') + stat('Domain Rating (Ahrefs-style)', dr + '/100') + stat('Backlinks / Ref. domains', links.toLocaleString() + ' / ' + ref.toLocaleString()) + '</div>' +
        card('What PageRank means today', '<div class="small" style="color:var(--slate-600);line-height:1.7"><p><strong>Google stopped publishing PageRank in 2016.</strong> The algorithm still runs internally, but there is no public score. Tools that show a 0–10 "PageRank" today, including this one, estimate it from third-party link metrics.</p><p class="mt-2">Modern equivalents: <strong>Domain Authority</strong> (Moz), <strong>Domain Rating</strong> (Ahrefs) and <strong>Authority Score</strong> (Semrush) — all 0–100 logarithmic scales based on the quantity and quality of referring domains.</p><p class="mt-2">To raise your authority: earn links from relevant, trusted sites; fix broken inbound links; consolidate duplicate pages; and publish content people cite. Values shown are illustrative — connect a link-index API for real figures.</p></div>');
    }
    go.addEventListener('click', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
  }

  var PING_SERVICES = ['Google (sitemap ping)', 'Bing Webmaster', 'IndexNow (Bing, Yandex, Seznam)', 'Pingomatic', 'Feedburner', 'Blo.gs', 'Weblogs.com', 'Twingly', 'Superfeedr', 'NewsGator', 'Ping.fm', 'Blogdigger'];
  function pingTool(cfg, mount) {
    mount.innerHTML = '<div class="te">' + urlBar('pg', 'Ping Now', 'https://example.com/new-post') + '<div class="pg-out"></div></div>';
    var input = mount.querySelector('.pg-url'), go = mount.querySelector('.pg-go'), zone = mount.querySelector('.pg-out');
    go.addEventListener('click', function () {
      var u = input.value.trim(); if (!u) return;
      var target = /^https?:\/\//i.test(u) ? u : 'https://' + u;
      go.disabled = true; zone.innerHTML = spinner('Pinging…');
      var times = [], rows = [];
      (function ping(i) {
        if (i < 4) {
          var t0 = performance.now();
          fetch(target + (target.indexOf('?') >= 0 ? '&' : '?') + '_ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined }).catch(function () {}).then(function () {
            times.push(Math.round(performance.now() - t0));
            paint(); ping(i + 1);
          });
        } else {
          var rng = new Seeded('ping|' + u + Date.now());
          var j = 0;
          (function next() {
            if (j >= PING_SERVICES.length) { go.disabled = false; paint(); return; }
            setTimeout(function () {
              rows.push({ service: PING_SERVICES[j], status: rng.next() > 0.12 ? 'Pinged successfully' : 'No response', ms: rng.int(80, 900) });
              j++; paint(); next();
            }, 180);
          })();
        }
      })(0);
      function paint() {
        var avg = times.length ? Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length) : 0;
        zone.innerHTML = (times.length ? '<div class="grid grid-4">' + stat('Avg round-trip (from you)', avg + ' ms', avg < 300 ? 'good' : avg < 800 ? 'warn' : 'bad') + stat('Min / Max', Math.min.apply(null, times) + ' / ' + Math.max.apply(null, times) + ' ms') + stat('Requests', times.length + '/4') + stat('Status', go.disabled ? 'Pinging services…' : 'Complete', 'good') + '</div>' : '') +
          (rows.length ? card('Ping services', rows.map(function (r) { return '<div class="flex-between" style="padding:.6rem 0;border-bottom:1px solid var(--slate-100)"><span>' + esc(r.service) + '</span><span class="' + (r.status.indexOf('success') >= 0 ? 'tone-good' : 'tone-mid') + '" style="font-weight:700">' + esc(r.status) + ' <span class="muted" style="font-weight:400">· ' + r.ms + ' ms</span></span></div>'; }).join('') +
            '<p class="small muted mt-4">Round-trip latency is measured live from your browser. Service pings are simulated here; in 2025 the effective ways to notify search engines are submitting your sitemap in Search Console/Bing Webmaster Tools and using the IndexNow API.</p>') : '');
      }
    });
  }

  /* ---------- generators ---------- */
  function field(label, inner) { return '<div class="field"><span class="field-label">' + esc(label) + '</span>' + inner + '</div>'; }
  function sel(cls, opts) { return '<select class="select ' + cls + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }

  function qrTool(cfg, mount) {
    var type = 'url', f = { url: 'https://', text: '', ssid: '', pass: '', enc: 'WPA', email: '', subject: '', phone: '', sms: '' }, size = 300, fg = '#1e1b4b', bg = '#ffffff', ecc = 'M';
    function payload() {
      if (type === 'text') return f.text;
      if (type === 'wifi') return 'WIFI:T:' + f.enc + ';S:' + f.ssid + ';P:' + f.pass + ';;';
      if (type === 'email') return 'mailto:' + f.email + (f.subject ? '?subject=' + encodeURIComponent(f.subject) : '');
      if (type === 'phone') return 'tel:' + f.phone;
      if (type === 'sms') return 'SMSTO:' + f.phone + ':' + f.sms;
      return f.url;
    }
    function draw() {
      var p = payload(), src = p && p !== 'https://' ? 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(p) + '&color=' + fg.slice(1) + '&bgcolor=' + bg.slice(1) + '&ecc=' + ecc + '&margin=10' : '';
      var types = [['url', 'URL'], ['text', 'Text'], ['wifi', 'Wi-Fi'], ['email', 'Email'], ['phone', 'Phone'], ['sms', 'SMS']];
      var fields = '';
      if (type === 'url') fields = field('Website URL', '<input class="input q-url" value="' + esc(f.url) + '" placeholder="https://example.com">');
      if (type === 'text') fields = field('Text', '<textarea class="textarea q-text" rows="3">' + esc(f.text) + '</textarea>');
      if (type === 'wifi') fields = field('Network name (SSID)', '<input class="input q-ssid" value="' + esc(f.ssid) + '">') + field('Password', '<input class="input q-pass" value="' + esc(f.pass) + '">') + field('Encryption', sel('q-enc', [['WPA', 'WPA/WPA2'], ['WEP', 'WEP'], ['nopass', 'None']]));
      if (type === 'email') fields = field('Email address', '<input class="input q-email" value="' + esc(f.email) + '">') + field('Subject (optional)', '<input class="input q-subject" value="' + esc(f.subject) + '">');
      if (type === 'phone') fields = field('Phone number', '<input class="input q-phone" value="' + esc(f.phone) + '" placeholder="+44 20 1234 5678">');
      if (type === 'sms') fields = field('Phone number', '<input class="input q-phone" value="' + esc(f.phone) + '">') + field('Message', '<textarea class="textarea q-sms" rows="3">' + esc(f.sms) + '</textarea>');
      mount.innerHTML = '<div class="grid grid-2"><div class="te"><div class="te-row">' + types.map(function (t) { return '<button type="button" class="pill' + (type === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + fields +
        '<div class="grid grid-4"><div><span class="field-label">Size ' + size + 'px</span><input type="range" class="q-size" min="150" max="1000" step="50" value="' + size + '"></div><div><span class="field-label">Foreground</span><input type="color" class="q-fg" value="' + fg + '" style="width:100%;height:2.2rem"></div><div><span class="field-label">Background</span><input type="color" class="q-bg" value="' + bg + '" style="width:100%;height:2.2rem"></div>' + field('Error correction', sel('q-ecc', [['L', 'L (7%)'], ['M', 'M (15%)'], ['Q', 'Q (25%)'], ['H', 'H (30%)']])) + '</div></div>' +
        '<div class="card text-center">' + (src ? '<img src="' + src + '" alt="Generated QR code" width="' + Math.min(size, 320) + '" height="' + Math.min(size, 320) + '" style="border-radius:.5rem"><p class="small muted mono mt-2">' + esc(p.slice(0, 80)) + '</p><div class="te-row mt-4" style="justify-content:center"><button type="button" class="btn btn-primary q-png">Download PNG</button><button type="button" class="btn btn-ghost q-svg">Download SVG</button></div><p class="small muted mt-2">Higher error correction lets the code survive damage or a logo overlay.</p>' : '<p class="muted" style="padding:4rem 0">Enter content to generate a QR code</p>') + '</div></div>';
      if (mount.querySelector('.q-enc')) mount.querySelector('.q-enc').value = f.enc;
      mount.querySelector('.q-ecc').value = ecc;
      mount.querySelectorAll('[data-t]').forEach(function (b) { b.addEventListener('click', function () { type = b.getAttribute('data-t'); draw(); }); });
      function bind(sel, key) { var el = mount.querySelector(sel); if (el) el.addEventListener('input', function () { f[key] = el.value; draw(); }); }
      bind('.q-url', 'url'); bind('.q-text', 'text'); bind('.q-ssid', 'ssid'); bind('.q-pass', 'pass'); bind('.q-email', 'email'); bind('.q-subject', 'subject'); bind('.q-phone', 'phone'); bind('.q-sms', 'sms');
      var enc = mount.querySelector('.q-enc'); if (enc) enc.addEventListener('change', function () { f.enc = enc.value; draw(); });
      mount.querySelector('.q-size').addEventListener('input', function (e) { size = Number(e.target.value); draw(); });
      mount.querySelector('.q-fg').addEventListener('input', function (e) { fg = e.target.value; draw(); });
      mount.querySelector('.q-bg').addEventListener('input', function (e) { bg = e.target.value; draw(); });
      mount.querySelector('.q-ecc').addEventListener('change', function (e) { ecc = e.target.value; draw(); });
      function dl(fmt) {
        if (!src) return;
        var u = fmt === 'svg' ? src.replace('create-qr-code/?', 'create-qr-code/?format=svg&') : src;
        fetch(u).then(function (r) { return r.blob(); }).then(function (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'qr-code.' + fmt; a.click(); });
      }
      var png = mount.querySelector('.q-png'); if (png) png.addEventListener('click', function () { dl('png'); });
      var svg = mount.querySelector('.q-svg'); if (svg) svg.addEventListener('click', function () { dl('svg'); });
    }
    draw();
  }

  function htaccess(cfg, mount) {
    var mode = '301', from = '/old-page.html', to = 'https://example.com/new-page/', domain = 'example.com', newDomain = 'newdomain.com';
    var explain = { '301': 'Permanent redirect — passes link equity, ideal for moved pages.', '302': 'Temporary redirect — use for A/B tests or maintenance; does not transfer ranking signals long-term.', https: 'Forces every request to HTTPS. Place at the top of .htaccess.', www: 'Canonicalises to the www version so both variants are not indexed separately.', nonwww: 'Canonicalises to the bare domain.', domain: 'Moves an entire site to a new domain, preserving paths.', slash: 'Adds a trailing slash to directory-style URLs.', noslash: 'Removes trailing slashes.', index: 'Redirects /index.php or /index.html to the root to avoid duplicate homepages.', ext: 'Removes .html extensions for cleaner URLs.', '404': 'Custom error pages for a better user experience.' };
    function out() {
      var head = 'RewriteEngine On\n', escD = domain.replace(/\./g, '\\.');
      switch (mode) {
        case '301': return 'Redirect 301 ' + from + ' ' + to;
        case '302': return 'Redirect 302 ' + from + ' ' + to;
        case 'https': return head + 'RewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]';
        case 'www': return head + 'RewriteCond %{HTTP_HOST} ^' + escD + '$ [NC]\nRewriteRule ^(.*)$ https://www.' + domain + '/$1 [L,R=301]';
        case 'nonwww': return head + 'RewriteCond %{HTTP_HOST} ^www\\.' + escD + '$ [NC]\nRewriteRule ^(.*)$ https://' + domain + '/$1 [L,R=301]';
        case 'domain': return head + 'RewriteCond %{HTTP_HOST} ^(www\\.)?' + escD + '$ [NC]\nRewriteRule ^(.*)$ https://' + newDomain + '/$1 [L,R=301]';
        case 'slash': return head + 'RewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_URI} !(.*)/$\nRewriteRule ^(.*)$ /$1/ [L,R=301]';
        case 'noslash': return head + 'RewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^(.*)/$ /$1 [L,R=301]';
        case 'index': return head + 'RewriteCond %{THE_REQUEST} ^[A-Z]{3,9}\\ /index\\.(php|html)\\ HTTP\nRewriteRule ^index\\.(php|html)$ / [R=301,L]';
        case 'ext': return head + 'RewriteCond %{REQUEST_FILENAME} !-d\nRewriteCond %{REQUEST_FILENAME}\\.html -f\nRewriteRule ^(.*)$ $1.html [L]\n\n# Redirect /page.html to /page\nRewriteCond %{THE_REQUEST} \\s/([^.]+)\\.html [NC]\nRewriteRule ^ /%1 [R=301,L]';
        case '404': return 'ErrorDocument 404 /404.html\nErrorDocument 403 /403.html\nErrorDocument 500 /500.html';
        default: return '';
      }
    }
    function draw() {
      var extra = '';
      if (mode === '301' || mode === '302') extra = field('From (path)', '<input class="input h-from" value="' + esc(from) + '">') + field('To (full URL)', '<input class="input h-to" value="' + esc(to) + '">');
      if (['www', 'nonwww', 'domain'].indexOf(mode) >= 0) extra += field('Current domain', '<input class="input h-dom" value="' + esc(domain) + '">');
      if (mode === 'domain') extra += field('New domain', '<input class="input h-new" value="' + esc(newDomain) + '">');
      mount.innerHTML = '<div class="grid grid-2"><div class="te">' + field('Redirect type', sel('h-mode', [['301', '301 Permanent (single page)'], ['302', '302 Temporary (single page)'], ['https', 'Force HTTPS'], ['www', 'non-www → www'], ['nonwww', 'www → non-www'], ['domain', 'Old domain → new domain'], ['slash', 'Add trailing slash'], ['noslash', 'Remove trailing slash'], ['index', 'Remove index.php / index.html'], ['ext', 'Remove .html extension'], ['404', 'Custom error pages']])) + extra +
        '<div class="note"><strong>What it does:</strong> ' + esc(explain[mode]) + '</div><div class="warn-box">Apache with mod_rewrite required. Back up your .htaccess first; a syntax error causes a 500 error site-wide. On Nginx, use server-block <code>return 301</code> / <code>rewrite</code> directives instead.</div></div>' + panel('.htaccess rules', out()) + '</div>';
      mount.querySelector('.h-mode').value = mode;
      mount.querySelector('.h-mode').addEventListener('change', function (e) { mode = e.target.value; draw(); });
      function b(sel, set) { var el = mount.querySelector(sel); if (el) el.addEventListener('input', function () { set(el.value); draw(); }); }
      b('.h-from', function (v) { from = v; }); b('.h-to', function (v) { to = v; }); b('.h-dom', function (v) { domain = v; }); b('.h-new', function (v) { newDomain = v; });
    }
    draw();
  }

  function ogGen(cfg, mount) {
    var f = { type: 'website', title: '', desc: '', url: '', image: '', site: '', locale: 'en_US', author: '', published: '', price: '', currency: 'USD', video: '' };
    function tags() {
      var l = ['<meta property="og:type" content="' + f.type + '" />', '<meta property="og:title" content="' + f.title + '" />', '<meta property="og:description" content="' + f.desc + '" />', '<meta property="og:url" content="' + f.url + '" />', '<meta property="og:image" content="' + f.image + '" />', '<meta property="og:image:width" content="1200" />', '<meta property="og:image:height" content="630" />', '<meta property="og:image:alt" content="' + f.title + '" />', '<meta property="og:site_name" content="' + f.site + '" />', '<meta property="og:locale" content="' + f.locale + '" />'];
      if (f.type === 'article') l.push('<meta property="article:author" content="' + f.author + '" />', '<meta property="article:published_time" content="' + f.published + '" />');
      if (f.type === 'product') l.push('<meta property="product:price:amount" content="' + f.price + '" />', '<meta property="product:price:currency" content="' + f.currency + '" />');
      if (f.type === 'video.other') l.push('<meta property="og:video" content="' + f.video + '" />', '<meta property="og:video:type" content="video/mp4" />');
      return l.join('\n');
    }
    function draw() {
      mount.innerHTML = '<div class="grid grid-2"><div class="te">' +
        field('Content type', sel('og-type', [['website', 'Website'], ['article', 'Article / blog post'], ['product', 'Product'], ['video.other', 'Video'], ['profile', 'Profile'], ['book', 'Book']])) +
        field('Title', '<input class="input og-title" value="' + esc(f.title) + '" placeholder="Page title (max ~60 chars)">') +
        field('Description', '<textarea class="textarea og-desc" rows="3">' + esc(f.desc) + '</textarea>') +
        field('Canonical URL', '<input class="input og-url" value="' + esc(f.url) + '" placeholder="https://example.com/page">') +
        field('Image URL (1200×630 recommended)', '<input class="input og-image" value="' + esc(f.image) + '">') +
        '<div class="grid grid-2">' + field('Site name', '<input class="input og-site" value="' + esc(f.site) + '">') + field('Locale', sel('og-locale', [['en_US', 'en_US'], ['en_GB', 'en_GB'], ['de_DE', 'de_DE'], ['fr_FR', 'fr_FR'], ['es_ES', 'es_ES'], ['pt_BR', 'pt_BR'], ['hi_IN', 'hi_IN'], ['ja_JP', 'ja_JP']])) + '</div>' +
        (f.type === 'article' ? '<div class="grid grid-2">' + field('Author URL/name', '<input class="input og-author" value="' + esc(f.author) + '">') + field('Published (ISO)', '<input type="date" class="input og-published" value="' + esc(f.published) + '">') + '</div>' : '') +
        (f.type === 'product' ? '<div class="grid grid-2">' + field('Price', '<input class="input og-price" value="' + esc(f.price) + '">') + field('Currency', '<input class="input og-currency" value="' + esc(f.currency) + '">') + '</div>' : '') +
        (f.type === 'video.other' ? field('Video file URL (mp4)', '<input class="input og-video" value="' + esc(f.video) + '">') : '') +
        '</div><div class="te"><div class="card"><p class="eyebrow">Share preview</p><div class="og-preview"><div class="og-img">' + (f.image ? '<img src="' + esc(f.image) + '" alt="">' : '1200 × 630 image') + '</div><div class="og-body"><p class="small muted" style="text-transform:uppercase">' + esc((f.url || 'example.com').replace(/^https?:\/\//, '').split('/')[0]) + '</p><p style="font-weight:800">' + esc(f.title || 'Your title appears here') + '</p><p class="small muted">' + esc(f.desc || 'Your description appears here.') + '</p></div></div></div>' + panel('Open Graph meta tags', tags()) + '</div></div>';
      mount.querySelector('.og-type').value = f.type; mount.querySelector('.og-locale').value = f.locale;
      function b(sel, key) { var el = mount.querySelector(sel); if (el) el.addEventListener('input', function () { f[key] = el.value; draw(); }); el && el.addEventListener('change', function () { f[key] = el.value; draw(); }); }
      b('.og-type', 'type'); b('.og-title', 'title'); b('.og-desc', 'desc'); b('.og-url', 'url'); b('.og-image', 'image'); b('.og-site', 'site'); b('.og-locale', 'locale'); b('.og-author', 'author'); b('.og-published', 'published'); b('.og-price', 'price'); b('.og-currency', 'currency'); b('.og-video', 'video');
    }
    draw();
  }

  function twitterCard(cfg, mount) {
    var f = { card: 'summary_large_image', site: '', creator: '', title: '', desc: '', image: '', alt: '', player: '', w: '640', h: '360', appName: '', appId: '' };
    function tags() {
      var l = ['<meta name="twitter:card" content="' + f.card + '" />', '<meta name="twitter:site" content="' + f.site + '" />', '<meta name="twitter:creator" content="' + f.creator + '" />', '<meta name="twitter:title" content="' + f.title + '" />', '<meta name="twitter:description" content="' + f.desc + '" />'];
      if (f.card !== 'app') l.push('<meta name="twitter:image" content="' + f.image + '" />', '<meta name="twitter:image:alt" content="' + f.alt + '" />');
      if (f.card === 'player') l.push('<meta name="twitter:player" content="' + f.player + '" />', '<meta name="twitter:player:width" content="' + f.w + '" />', '<meta name="twitter:player:height" content="' + f.h + '" />');
      if (f.card === 'app') l.push('<meta name="twitter:app:name:iphone" content="' + f.appName + '" />', '<meta name="twitter:app:id:iphone" content="' + f.appId + '" />', '<meta name="twitter:app:name:googleplay" content="' + f.appName + '" />', '<meta name="twitter:app:id:googleplay" content="' + f.appId + '" />');
      return l.join('\n');
    }
    function draw() {
      var large = f.card === 'summary_large_image' || f.card === 'player';
      mount.innerHTML = '<div class="grid grid-2"><div class="te">' +
        field('Card type', sel('tw-card', [['summary', 'Summary (small square image)'], ['summary_large_image', 'Summary with large image'], ['player', 'Player (video/audio)'], ['app', 'App']])) +
        '<div class="grid grid-2">' + field('@site', '<input class="input tw-site" value="' + esc(f.site) + '" placeholder="@yourbrand">') + field('@creator', '<input class="input tw-creator" value="' + esc(f.creator) + '" placeholder="@author">') + '</div>' +
        field('Title (≤70 chars)', '<input class="input tw-title" value="' + esc(f.title) + '">') + field('Description (≤200 chars)', '<textarea class="textarea tw-desc" rows="3">' + esc(f.desc) + '</textarea>') +
        (f.card !== 'app' ? field('Image URL', '<input class="input tw-image" value="' + esc(f.image) + '">') + field('Image alt text', '<input class="input tw-alt" value="' + esc(f.alt) + '">') : '') +
        (f.card === 'player' ? field('Player iframe URL (HTTPS)', '<input class="input tw-player" value="' + esc(f.player) + '">') + '<div class="grid grid-2">' + field('Width', '<input class="input tw-w" value="' + esc(f.w) + '">') + field('Height', '<input class="input tw-h" value="' + esc(f.h) + '">') + '</div>' : '') +
        (f.card === 'app' ? '<div class="grid grid-2">' + field('App name', '<input class="input tw-app" value="' + esc(f.appName) + '">') + field('App ID', '<input class="input tw-appid" value="' + esc(f.appId) + '">') + '</div>' : '') +
        '</div><div class="te"><div class="card"><p class="eyebrow">X / Twitter preview</p><div class="og-preview' + (large ? '' : '" style="display:flex') + '"><div class="og-img" style="' + (large ? '' : 'width:8rem;height:8rem;flex-shrink:0;aspect-ratio:auto') + '">' + (f.image ? '<img src="' + esc(f.image) + '" alt="">' : 'image') + '</div><div class="og-body"><p style="font-weight:800">' + esc(f.title || 'Card title') + '</p><p class="small muted">' + esc(f.desc || 'Card description') + '</p><p class="small muted">🔗 ' + esc(f.site.replace('@', '') || 'example.com') + '</p></div></div></div>' + panel('Twitter card meta tags', tags()) + '</div></div>';
      mount.querySelector('.tw-card').value = f.card;
      function b(sel, key) { var el = mount.querySelector(sel); if (el) { el.addEventListener('input', function () { f[key] = el.value; draw(); }); el.addEventListener('change', function () { f[key] = el.value; draw(); }); } }
      b('.tw-card', 'card'); b('.tw-site', 'site'); b('.tw-creator', 'creator'); b('.tw-title', 'title'); b('.tw-desc', 'desc'); b('.tw-image', 'image'); b('.tw-alt', 'alt'); b('.tw-player', 'player'); b('.tw-w', 'w'); b('.tw-h', 'h'); b('.tw-app', 'appName'); b('.tw-appid', 'appId');
    }
    draw();
  }

  function urlCodec(cfg, mount) {
    var mode = 'encode', full = false;
    function draw() {
      var input = (mount.querySelector('.uc-in') || {}).value || '';
      var result;
      try { result = mode === 'encode' ? (full ? encodeURIComponent(input) : encodeURI(input)) : decodeURIComponent(input.replace(/\+/g, ' ')); } catch (e) { result = 'Invalid encoded sequence'; }
      var parts = null; try { parts = new URL(mode === 'decode' ? result : input); } catch (e) {}
      var reserved = [[' ', '%20'], ['!', '%21'], ['#', '%23'], ['$', '%24'], ['&', '%26'], ["'", '%27'], ['(', '%28'], [')', '%29'], ['*', '%2A'], ['+', '%2B'], [',', '%2C'], ['/', '%2F'], [':', '%3A'], [';', '%3B'], ['=', '%3D'], ['?', '%3F'], ['@', '%40'], ['[', '%5B'], [']', '%5D']];
      mount.innerHTML = '<div class="te"><div class="te-row">' +
        '<button type="button" class="pill' + (mode === 'encode' ? ' on' : '') + '" data-m="encode">encode</button><button type="button" class="pill' + (mode === 'decode' ? ' on' : '') + '" data-m="decode">decode</button>' +
        (mode === 'encode' ? '<label class="flex"><input type="checkbox" class="uc-full"' + (full ? ' checked' : '') + '> Encode all reserved characters (encodeURIComponent)</label>' : '') + '</div>' +
        '<textarea class="textarea uc-in" rows="5" placeholder="' + (mode === 'encode' ? 'https://example.com/search?q=hello world&lang=en' : 'https%3A%2F%2Fexample.com') + '">' + esc(input) + '</textarea>' +
        panel(mode === 'encode' ? 'Encoded URL' : 'Decoded URL', result) +
        (parts ? card('URL components', '<div class="grid grid-3">' + [['Protocol', parts.protocol], ['Host', parts.hostname], ['Port', parts.port || '(default)'], ['Path', parts.pathname], ['Query', parts.search || '(none)'], ['Fragment', parts.hash || '(none)']].map(function (r) { return stat(r[0], '<span class="mono small">' + esc(r[1]) + '</span>'); }).join('') + '</div>' +
          (parts.search ? '<div class="mt-4"><p class="eyebrow">Query parameters</p><div class="te-row">' + Array.from(parts.searchParams.entries()).map(function (kv) { return '<span class="pill mono"><span style="color:var(--indigo-700)">' + esc(kv[0]) + '</span> = ' + esc(kv[1]) + '</span>'; }).join('') + '</div></div>' : '')) : '') +
        card('Reserved character reference', '<div class="grid grid-4">' + reserved.map(function (r) { return '<div class="te-stat text-center"><p class="mono" style="font-size:1.1rem">' + (r[0] === ' ' ? '␣' : esc(r[0])) + '</p><b class="mono" style="color:var(--indigo-700)">' + r[1] + '</b></div>'; }).join('') + '</div>') + '</div>';
      mount.querySelectorAll('[data-m]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-m'); draw(); }); });
      var cb = mount.querySelector('.uc-full'); if (cb) cb.addEventListener('change', function () { full = cb.checked; draw(); });
      mount.querySelector('.uc-in').addEventListener('input', function () { draw(); });
    }
    draw();
  }

  function adsense(cfg, mount) {
    var views = 10000, ctr = 1.5, cpc = 0.45, rpmMode = false, rpm = 5;
    function money(n) { return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 }); }
    function draw() {
      var daily = rpmMode ? (views / 1000) * rpm : views * (ctr / 100) * cpc;
      var clicks = views * (ctr / 100);
      var targets = [100, 500, 1000, 5000, 10000];
      var perView = views ? daily / views : 0;
      mount.innerHTML = '<div class="te"><div class="te-row"><button type="button" class="pill' + (!rpmMode ? ' on' : '') + '" data-m="ctr">CTR × CPC</button><button type="button" class="pill' + (rpmMode ? ' on' : '') + '" data-m="rpm">Page RPM</button></div>' +
        '<div class="grid grid-3">' + field('Daily page views', '<input type="number" class="input ad-v" value="' + views + '">') +
        (rpmMode ? field('Page RPM ($ per 1,000 views)', '<input type="number" step="0.1" class="input ad-rpm" value="' + rpm + '">') : field('Click-through rate (%)', '<input type="number" step="0.1" class="input ad-ctr" value="' + ctr + '">') + field('Cost per click ($)', '<input type="number" step="0.01" class="input ad-cpc" value="' + cpc + '">')) + '</div>' +
        '<div class="grid grid-4"><div class="hero-grad" style="background:linear-gradient(to bottom right,#10b981,#0d9488)"><p style="opacity:.85">Daily earnings</p><p style="font-size:1.8rem;font-weight:800">' + money(daily) + '</p></div>' + stat('Monthly (30 days)', money(daily * 30), 'good') + stat('Yearly', money(daily * 365), 'good') + stat(rpmMode ? 'Effective RPM' : 'Daily clicks', rpmMode ? money(rpm) : String(Math.round(clicks))) + '</div>' +
        '<div class="grid grid-3">' + stat('Revenue per 1,000 views (RPM)', money(views ? (daily / views) * 1000 : 0)) + stat('Revenue per visitor', '$' + (views ? daily / views : 0).toFixed(4)) + stat('Views needed for $100/day', daily > 0 ? Math.ceil((100 / daily) * views).toLocaleString() : '—') + '</div>' +
        card('Traffic needed for income goals (per month)', '<div class="table-wrap"><table><thead><tr><th>Monthly goal</th><th>Daily views needed</th><th>Monthly views needed</th></tr></thead><tbody>' +
          targets.map(function (t) { var dv = perView > 0 ? Math.ceil(t / 30 / perView) : 0; return '<tr><td><strong>$' + t.toLocaleString() + '</strong></td><td>' + dv.toLocaleString() + '</td><td>' + (dv * 30).toLocaleString() + '</td></tr>'; }).join('') +
          '</tbody></table></div><p class="small muted mt-4">Typical AdSense benchmarks: CTR 0.5–3%, CPC $0.20–$2.00 (finance/insurance far higher), page RPM $1–$20 depending on niche and geography.</p>') + '</div>';
      mount.querySelectorAll('[data-m]').forEach(function (b) { b.addEventListener('click', function () { rpmMode = b.getAttribute('data-m') === 'rpm'; draw(); }); });
      function n(sel, set) { var el = mount.querySelector(sel); if (el) el.addEventListener('input', function () { set(Number(el.value)); draw(); }); }
      n('.ad-v', function (v) { views = v; }); n('.ad-ctr', function (v) { ctr = v; }); n('.ad-cpc', function (v) { cpc = v; }); n('.ad-rpm', function (v) { rpm = v; });
    }
    draw();
  }

  function urlRewrite(cfg, mount) {
    mount.innerHTML = '<div class="te">' + field('Dynamic URL', '<input class="input ur-in" value="https://example.com/product.php?id=42&category=shoes">') + '<div class="ur-out"></div></div>';
    function run() {
      var url = mount.querySelector('.ur-in').value, out = mount.querySelector('.ur-out');
      try {
        var u = new URL(url); var params = Array.from(u.searchParams.entries());
        if (!params.length) { out.innerHTML = '<p class="muted">Enter a URL that contains query parameters (e.g. ?id=42) to generate rewrite rules.</p>'; return; }
        var file = u.pathname.split('/').pop() || 'index.php'; var base = file.replace(/\.\w+$/, '');
        var clean = u.origin + '/' + base + '/' + params.map(function (p) { return encodeURIComponent(p[1]).replace(/%20/g, '-'); }).join('/') + '/';
        var pattern = '^' + base + '/' + params.map(function () { return '([^/]+)'; }).join('/') + '/?$';
        var target = file + '?' + params.map(function (p, i) { return p[0] + '=$' + (i + 1); }).join('&');
        out.innerHTML = '<div class="grid grid-2"><div class="error-box"><p class="eyebrow" style="color:var(--red-600)">Before (dynamic)</p><p class="mono small">' + esc(url) + '</p></div><div class="ok-box"><p class="eyebrow" style="color:var(--emerald-600)">After (static, SEO-friendly)</p><p class="mono small">' + esc(clean) + '</p></div></div>' +
          '<div class="grid grid-2 mt-4">' + panel('Apache .htaccess', 'RewriteEngine On\nRewriteRule ' + pattern + ' ' + target + ' [L,QSA]') + panel('Nginx', 'rewrite ' + pattern + ' /' + target + ' last;') + '</div>' +
          card('Why rewrite URLs?', '<ul class="page-list"><li>Keywords in the path are a minor ranking signal and improve click-through rates.</li><li>Static-looking URLs are easier to share, remember and cite.</li><li>Fewer parameters mean fewer duplicate-content variations for crawlers.</li><li>Remember to 301-redirect the old dynamic URLs and update your canonical tags.</li></ul>');
      } catch (e) { out.innerHTML = '<p class="muted">Enter a valid URL.</p>'; }
    }
    mount.querySelector('.ur-in').addEventListener('input', run); run();
  }

  function hitCounter(cfg, mount) {
    var start = 1000, digits = 6, style = 'digital', label = 'Visitors', count = start;
    var styles = { digital: 'background:#000;color:#a3e635;font-family:ui-monospace,monospace;border:4px solid #334155', odometer: 'background:#fff;color:#0f172a;font-family:ui-monospace,monospace;border:1px solid #cbd5e1', modern: 'background:linear-gradient(to bottom right,#6366f1,#9333ea);color:#fff;font-weight:800', minimal: 'background:#f1f5f9;color:#1e293b;font-weight:600' };
    var timer;
    function draw() {
      var padded = String(count).padStart(digits, '0');
      var embed = '<!-- Hit counter by SEO Audit Tool -->\n<div id="hit-counter" style="display:inline-flex;gap:4px;padding:8px 12px;border-radius:8px;background:#0f172a;color:#a3e635;font-family:monospace;font-size:24px;letter-spacing:2px">' + padded + '</div>\n<script>\n(function(){var k=\'hc_\'+location.hostname,n=parseInt(localStorage.getItem(k)||\'' + start + '\')+1;localStorage.setItem(k,n);document.getElementById(\'hit-counter\').textContent=String(n).padStart(' + digits + ',\'0\');})();\n</script>';
      mount.innerHTML = '<div class="grid grid-2"><div class="te"><div class="grid grid-2">' + field('Starting count', '<input type="number" class="input hc-start" value="' + start + '">') + field('Digits', '<input type="number" min="4" max="10" class="input hc-dig" value="' + digits + '">') + '</div>' +
        field('Style', sel('hc-style', [['digital', 'Digital (classic green)'], ['odometer', 'Odometer'], ['modern', 'Modern gradient'], ['minimal', 'Minimal']])) +
        field('Label', '<input class="input hc-lab" value="' + esc(label) + '">') +
        '<div class="card text-center"><p class="eyebrow">' + esc(label) + '</p><div class="mono" style="display:inline-flex;gap:.25rem;padding:.75rem 1rem;border-radius:.5rem;font-size:1.8rem;letter-spacing:.2em;' + styles[style] + '">' + padded.split('').map(function (d) { return '<span' + (style === 'odometer' ? ' style="background:#f1f5f9;padding:0 .25rem;border-radius:.25rem"' : '') + '>' + d + '</span>'; }).join('') + '</div><p class="small muted mt-2">Live preview increments to simulate traffic</p></div></div>' +
        '<div class="te">' + panel('Embed code (paste before </body>)', embed) + '<div class="note">This counter stores the number in the visitor\'s browser (localStorage) so it needs no server. For real site-wide totals, use a privacy-friendly analytics tool such as Plausible, Umami or Google Analytics.</div></div></div>';
      mount.querySelector('.hc-style').value = style;
      mount.querySelector('.hc-start').addEventListener('input', function (e) { start = Number(e.target.value); count = start; draw(); });
      mount.querySelector('.hc-dig').addEventListener('input', function (e) { digits = Number(e.target.value); draw(); });
      mount.querySelector('.hc-style').addEventListener('change', function (e) { style = e.target.value; draw(); });
      mount.querySelector('.hc-lab').addEventListener('input', function (e) { label = e.target.value; draw(); });
    }
    draw();
    timer = setInterval(function () { count += Math.random() > 0.6 ? 1 : 0; var el = mount.querySelector('.mono'); if (el) el.querySelectorAll('span').forEach(function (s, i) { var padded = String(count).padStart(digits, '0'); if (s.parentNode === el) { /* skip */ } }); draw(); }, 2200);
    /* avoid leaking interval if remounted: store on mount */
    if (mount._hcTimer) clearInterval(mount._hcTimer);
    mount._hcTimer = timer;
  }

  var DEVICES = [['iPhone SE', 375, 667], ['iPhone 14 / 15', 390, 844], ['iPhone 15 Pro Max', 430, 932], ['Pixel 8', 412, 915], ['Galaxy S23', 360, 780], ['iPad Mini', 768, 1024], ['iPad Pro 11"', 834, 1194], ['iPad Pro 12.9"', 1024, 1366], ['Laptop 1366×768', 1366, 768], ['Laptop 1440×900', 1440, 900], ['Desktop 1920×1080', 1920, 1080], ['4K 2560×1440', 2560, 1440]];
  function screenSim(cfg, mount) {
    var url = '', active = '', w = 390, h = 844, landscape = false;
    function draw() {
      var target = active ? (/^https?:\/\//i.test(active) ? active : 'https://' + active) : '';
      var vw = landscape ? h : w, vh = landscape ? w : h, scale = Math.min(1, 1000 / vw);
      mount.innerHTML = '<div class="te"><div class="te-row" style="flex-wrap:nowrap"><input class="input ss-url" placeholder="https://example.com" value="' + esc(url) + '" style="flex:1"><button type="button" class="btn btn-primary ss-go">Load Website</button></div>' +
        '<div class="te-row">' + DEVICES.map(function (d) { return '<button type="button" class="pill' + (w === d[1] && h === d[2] ? ' on' : '') + '" data-w="' + d[1] + '" data-h="' + d[2] + '">' + esc(d[0]) + '</button>'; }).join('') + '</div>' +
        '<div class="te-row"><label class="flex">W <input type="number" class="input ss-w" value="' + w + '" style="width:6rem"></label><label class="flex">H <input type="number" class="input ss-h" value="' + h + '" style="width:6rem"></label><button type="button" class="btn btn-ghost ss-rot">⟳ ' + (landscape ? 'Landscape' : 'Portrait') + '</button><span class="muted">Viewport: <strong>' + vw + ' × ' + vh + '</strong>' + (scale < 1 ? ' · scaled to ' + Math.round(scale * 100) + '%' : '') + '</span><span class="muted" style="margin-left:auto">Your screen: ' + window.screen.width + ' × ' + window.screen.height + '</span></div>' +
        '<div style="background:var(--slate-100);border-radius:var(--radius-2xl);padding:1rem;overflow:auto"><div style="margin:0 auto;background:var(--slate-900);border-radius:1rem;padding:.5rem;width:' + (vw * scale + 16) + 'px"><div style="background:#fff;border-radius:.75rem;overflow:hidden;width:' + (vw * scale) + 'px;height:' + (vh * scale) + 'px">' +
        (target ? '<iframe title="Resolution preview" src="' + esc(target) + '" sandbox="allow-same-origin allow-scripts allow-forms" loading="lazy" style="width:' + vw + 'px;height:' + vh + 'px;transform:scale(' + scale + ');transform-origin:top left;border:0"></iframe>' : '<div style="display:flex;align-items:center;justify-content:center;height:100%" class="muted">Enter a URL above to preview it at ' + vw + ' × ' + vh + '</div>') +
        '</div></div></div><p class="small muted">Some sites send X-Frame-Options / CSP headers that block embedding; those will show a blank frame. Try your own site or a site without frame restrictions.</p></div>';
      mount.querySelector('.ss-go').addEventListener('click', function () { url = mount.querySelector('.ss-url').value; active = url; draw(); });
      mount.querySelector('.ss-url').addEventListener('keydown', function (e) { if (e.key === 'Enter') { url = e.target.value; active = url; draw(); } });
      mount.querySelectorAll('[data-w]').forEach(function (b) { b.addEventListener('click', function () { w = Number(b.getAttribute('data-w')); h = Number(b.getAttribute('data-h')); draw(); }); });
      mount.querySelector('.ss-w').addEventListener('change', function (e) { w = Number(e.target.value); draw(); });
      mount.querySelector('.ss-h').addEventListener('change', function (e) { h = Number(e.target.value); draw(); });
      mount.querySelector('.ss-rot').addEventListener('click', function () { landscape = !landscape; draw(); });
    }
    draw();
  }

  function screenshot(cfg, mount) {
    var size = 'desktop', full = false;
    var dims = { desktop: [1440, 900], tablet: [820, 1180], mobile: [390, 844] };
    mount.innerHTML = '<div class="te"><div class="te-row" style="flex-wrap:nowrap"><input class="input sc-url" placeholder="https://example.com" style="flex:1"><button type="button" class="btn btn-primary sc-go">Capture Screenshot</button></div>' +
      '<div class="te-row"><button type="button" class="pill on" data-s="desktop">desktop · 1440px</button><button type="button" class="pill" data-s="tablet">tablet · 820px</button><button type="button" class="pill" data-s="mobile">mobile · 390px</button><label class="flex"><input type="checkbox" class="sc-full"> Full page</label></div><div class="sc-out"></div></div>';
    mount.querySelectorAll('[data-s]').forEach(function (b) { b.addEventListener('click', function () { size = b.getAttribute('data-s'); mount.querySelectorAll('[data-s]').forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
    mount.querySelector('.sc-full').addEventListener('change', function (e) { full = e.target.checked; });
    function run() {
      var u = mount.querySelector('.sc-url').value.trim(); if (!u) return;
      var target = /^https?:\/\//i.test(u) ? u : 'https://' + u;
      var d = dims[size];
      var src = 'https://image.thum.io/get/width/' + d[0] + '/crop/' + (full ? 4000 : d[1]) + '/noanimate/' + target;
      mount.querySelector('.sc-out').innerHTML = '<div class="card"><div class="spin-row sc-load"><span class="spin"></span>Rendering screenshot (this can take 10–20 s)…</div><img class="sc-img" src="' + src + '" alt="Screenshot of ' + esc(u) + '" style="width:100%;border-radius:.5rem;max-width:' + d[0] + 'px"><div class="flex-between mt-4"><p class="small muted">' + d[0] + ' px wide · rendered by a headless browser service</p><a class="btn btn-dark" href="' + src + '" download="screenshot.png" target="_blank" rel="noopener noreferrer">Open / Download</a></div></div>';
      var img = mount.querySelector('.sc-img');
      img.addEventListener('load', function () { var l = mount.querySelector('.sc-load'); if (l) l.remove(); });
      img.addEventListener('error', function () { var l = mount.querySelector('.sc-load'); if (l) l.remove(); });
    }
    mount.querySelector('.sc-go').addEventListener('click', run);
    mount.querySelector('.sc-url').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
  }

  function speedTest(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="card text-center"><div class="st-ring"></div><div class="mt-6"><button type="button" class="btn btn-primary st-go">Start Speed Test</button></div></div><div class="st-out"></div></div>';
    function paintRing(mbps) {
      var c = 2 * Math.PI * 52, off = c * (1 - Math.min(1, mbps / 300));
      mount.querySelector('.st-ring').innerHTML = '<div class="ring" style="width:14rem;height:14rem"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="#6366f1" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/></svg><div class="ring-val"><span style="font-size:2.6rem;font-weight:800">' + mbps + '</span><span class="small muted">Mbps download</span></div></div>';
    }
    paintRing(0);
    mount.querySelector('.st-go').addEventListener('click', function () {
      var btn = mount.querySelector('.st-go'), zone = mount.querySelector('.st-out');
      btn.disabled = true; btn.textContent = 'Measuring latency…';
      var pings = [], samples = [], best = 0;
      (function ping(i) {
        if (i < 5) {
          var t0 = performance.now();
          fetch('https://speed.cloudflare.com/__down?bytes=0&_=' + Date.now(), { cache: 'no-store' }).catch(function () {}).then(function () {
            pings.push(Math.round(performance.now() - t0)); ping(i + 1);
          });
        } else {
          btn.textContent = 'Downloading… 0%';
          var sizes = [1000000, 5000000, 10000000, 25000000];
          (function down(j) {
            if (j >= sizes.length) return finish();
            var t0 = performance.now();
            fetch('https://speed.cloudflare.com/__down?bytes=' + sizes[j] + '&_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
              var secs = (performance.now() - t0) / 1000;
              var m = (buf.byteLength * 8) / secs / 1000000;
              samples.push(Math.round(m * 10) / 10); best = Math.max(best, m);
              paintRing(Math.round(best * 10) / 10);
              btn.textContent = 'Downloading… ' + Math.round(((j + 1) / sizes.length) * 100) + '%';
              if (best > 0 && (performance.now() - t0) > 8000) return finish();
              down(j + 1);
            }).catch(function () { finish(); });
          })(0);
        }
      })(0);
      function finish() {
        btn.disabled = false; btn.textContent = 'Test Again';
        var avgPing = pings.length ? Math.round(pings.reduce(function (a, b) { return a + b; }, 0) / pings.length) : 0;
        var jitter = pings.length > 1 ? Math.round(pings.slice(1).reduce(function (a, v, i) { return a + Math.abs(v - pings[i]); }, 0) / (pings.length - 1)) : 0;
        var mbps = Math.round(best * 10) / 10;
        function rating(ok, good) { return good ? ['Excellent', 'good'] : ok ? ['OK', 'warn'] : ['Poor', 'bad']; }
        var conn = navigator.connection || {};
        zone.innerHTML = '<div class="grid grid-4">' + stat('Latency (ping)', avgPing + ' ms', avgPing < 50 ? 'good' : avgPing < 150 ? 'warn' : 'bad') + stat('Jitter', jitter + ' ms', jitter < 20 ? 'good' : jitter < 50 ? 'warn' : 'bad') + stat('Peak download', mbps + ' Mbps', mbps > 50 ? 'good' : mbps > 10 ? 'warn' : 'bad') + stat('Browser estimate', conn.effectiveType ? conn.effectiveType.toUpperCase() + ' · ~' + conn.downlink + ' Mbps' : 'n/a') + '</div>' +
          card('What can you do with this connection?', '<div class="grid grid-4">' + [['4K streaming', mbps >= 25, mbps >= 50], ['HD video calls', mbps >= 3 && avgPing < 150, mbps >= 10 && avgPing < 60], ['Online gaming', avgPing < 100, avgPing < 40 && jitter < 20], ['Large downloads', mbps >= 20, mbps >= 100]].map(function (r) { var t = rating(r[1], r[2]); return stat(r[0], t[0], t[1]); }).join('') + '</div>' +
            (samples.length ? '<p class="small muted mt-4">Samples: ' + samples.join(' · ') + ' Mbps · Download test served by Cloudflare\'s speed endpoint. Upload is not measured. Results vary with Wi-Fi, VPNs and background traffic.</p>' : ''));
      }
    });
  }

  function shortener(cfg, mount) {
    var utm = { source: '', medium: '', campaign: '' }, history = [];
    mount.innerHTML = '<div class="te"><div class="te-row" style="flex-wrap:nowrap"><input class="input sh-url" placeholder="Paste a long URL…" style="flex:1"><button type="button" class="btn btn-primary sh-go">Shorten URL</button></div>' +
      '<details class="card"><summary style="cursor:pointer;font-weight:600">Add UTM tracking parameters (optional)</summary><div class="grid grid-3 mt-4">' +
      field('utm_source', '<input class="input sh-src" placeholder="newsletter">') + field('utm_medium', '<input class="input sh-med" placeholder="email">') + field('utm_campaign', '<input class="input sh-camp" placeholder="spring_sale">') + '</div><p class="small mono muted mt-2 sh-long"></p></details><div class="sh-out"></div><div class="sh-hist"></div></div>';
    function longUrl() {
      var u = mount.querySelector('.sh-url').value.trim(); if (!u) return '';
      try {
        var url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u);
        if (utm.source) url.searchParams.set('utm_source', utm.source);
        if (utm.medium) url.searchParams.set('utm_medium', utm.medium);
        if (utm.campaign) url.searchParams.set('utm_campaign', utm.campaign);
        return url.toString();
      } catch (e) { return u; }
    }
    function syncUtm() { utm.source = mount.querySelector('.sh-src').value; utm.medium = mount.querySelector('.sh-med').value; utm.campaign = mount.querySelector('.sh-camp').value; mount.querySelector('.sh-long').textContent = (utm.source && longUrl()) || ''; }
    mount.querySelector('.sh-src').addEventListener('input', syncUtm);
    mount.querySelector('.sh-med').addEventListener('input', syncUtm);
    mount.querySelector('.sh-camp').addEventListener('input', syncUtm);
    mount.querySelector('.sh-go').addEventListener('click', run);
    mount.querySelector('.sh-url').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    function run() {
      var target = longUrl(); if (!target) return;
      var btn = mount.querySelector('.sh-go'), zone = mount.querySelector('.sh-out');
      btn.disabled = true; btn.textContent = 'Shortening…'; zone.innerHTML = '';
      function ok(short, provider) {
        btn.disabled = false; btn.textContent = 'Shorten URL';
        history.unshift({ short: short, long: target });
        zone.innerHTML = '<div class="hero-grad"><p style="opacity:.85">Short URL via ' + esc(provider) + '</p><div class="te-row"><a href="' + esc(short) + '" target="_blank" rel="noopener noreferrer" class="mono" style="font-size:1.6rem;font-weight:800;color:#fff">' + esc(short) + '</a><button type="button" class="btn btn-ghost sh-copy" style="background:rgba(255,255,255,.2);color:#fff;border:0">Copy</button></div>' +
          '<div class="grid grid-2 mt-4" style="align-items:center"><img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=' + encodeURIComponent(short) + '" alt="QR code for short URL" width="120" height="120" style="background:#fff;padding:.25rem;border-radius:.5rem"><div class="small"><p style="opacity:.85">Original (' + target.length + ' chars → ' + short.length + ' chars, ' + Math.round((1 - short.length / target.length) * 100) + '% shorter)</p><p class="mono" style="opacity:.9;word-break:break-all">' + esc(target) + '</p></div></div></div>';
        zone.querySelector('.sh-copy').addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(short); });
        if (history.length > 1) mount.querySelector('.sh-hist').innerHTML = card('Recent links (this session)', '<ul>' + history.map(function (h) { return '<li class="flex-between" style="padding:.5rem 0;border-bottom:1px solid var(--slate-100)"><a class="mono" href="' + esc(h.short) + '" target="_blank" rel="noopener noreferrer">' + esc(h.short) + '</a><span class="muted small" style="max-width:20rem;overflow:hidden;text-overflow:ellipsis">' + esc(h.long) + '</span></li>'; }).join('') + '</ul>');
      }
      fetch('https://is.gd/create.php?format=json&url=' + encodeURIComponent(target)).then(function (r) { return r.json(); }).then(function (j) {
        if (j.shorturl) ok(j.shorturl, 'is.gd'); else throw new Error('fail');
      }).catch(function () {
        return fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(target)).then(function (r) { return r.text(); }).then(function (t) {
          if (t && t.indexOf('http') === 0) ok(t.trim(), 'TinyURL'); else throw new Error('fail');
        });
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Shorten URL';
        zone.innerHTML = '<div class="warn-box">Could not reach a shortener API. Try again, or check that the URL is valid and publicly reachable.</div>';
      });
    }
  }

  function suggest(cfg, mount) {
    mount.innerHTML = '<div class="te"><input class="input sg-kw" placeholder="Enter a seed keyword, e.g. seo audit"><div class="sg-out"></div></div>';
    var tab = 'az';
    mount.querySelector('.sg-kw').addEventListener('input', draw);
    function draw() {
      var k = mount.querySelector('.sg-kw').value.trim().toLowerCase(), out = mount.querySelector('.sg-out');
      if (!k) { out.innerHTML = ''; return; }
      var groups = {
        az: 'abcdefghijklmnopqrstuvwxyz'.split('').map(function (l) { return k + ' ' + l; }),
        questions: ['what is', 'how to', 'why is', 'when to', 'where to', 'which', 'who', 'can', 'does', 'is', 'are', 'will', 'should', 'how much', 'how many', 'how long', 'what does', 'how does'].map(function (q) { return q + ' ' + k; }),
        prepositions: ['for', 'with', 'without', 'near', 'to', 'vs', 'like', 'is', 'can', 'versus'].map(function (p) { return k + ' ' + p; }),
        comparisons: ['vs', 'or', 'like', 'versus', 'and', 'compared to', 'alternative to', 'better than'].map(function (c) { return k + ' ' + c; }),
        modifiers: ['best', 'top', 'free', 'cheap', 'online', 'near me', 'review', 'reviews', 'price', 'cost', 'tutorial', 'guide', 'template', 'examples', 'checklist', 'tips', 'course', 'software', 'tool', 'app', 'for beginners', 'for small business', '2025', 'reddit', 'pdf', 'download'].map(function (m) { return ['best', 'top', 'free', 'cheap'].indexOf(m) >= 0 ? m + ' ' + k : k + ' ' + m; })
      };
      var list = groups[tab], total = Object.keys(groups).reduce(function (a, g) { return a + groups[g].length; }, 0);
      var tabs = [['az', 'A–Z'], ['questions', 'questions'], ['prepositions', 'prepositions'], ['comparisons', 'comparisons'], ['modifiers', 'modifiers']];
      var title = tab === 'az' ? 'Alphabetical' : tab.charAt(0).toUpperCase() + tab.slice(1);
      out.innerHTML = '<div class="grid grid-4">' + stat('Total suggestions', String(total), 'good') + stat('A–Z', String(groups.az.length)) + stat('Questions', String(groups.questions.length)) + stat('Comparisons', String(groups.comparisons.length)) + stat('Modifiers', String(groups.modifiers.length)) + '</div>' +
        '<div class="te-row">' + tabs.map(function (t) { return '<button type="button" class="pill' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        card(title + ' suggestions (' + list.length + ')', '<div class="grid grid-3">' + list.map(function (s) { return '<a class="pill" href="https://www.google.com/search?q=' + encodeURIComponent(s) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(s) + '</a>'; }).join('') + '</div><p class="small muted mt-4">Click any suggestion to open a live Google search. Patterns mirror how autocomplete expands queries; validate volume with your keyword tool.</p>',
          '<button type="button" class="btn btn-ghost sg-copy">Copy all</button>');
      out.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); draw(); }); });
      out.querySelector('.sg-copy').addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(list.join('\n')); });
    }
  }

  var VIDEO_INFO = {
    'online-video-downloader': { title: 'Online video downloading', official: ['YouTube Premium and most streaming apps include an official "Download" button for offline viewing inside the app.', 'Your own uploads can always be downloaded from the platform’s creator dashboard / studio.', 'Creative Commons and public-domain videos can be downloaded where the license permits.'], notes: ['Downloading copyrighted videos without permission violates most platforms’ terms and may infringe copyright.', 'Many "free downloader" sites bundle adware, fake update prompts or crypto-miners. Avoid any site that asks you to install an extension or "codec".', 'Command-line tools like yt-dlp exist for personal, permitted use; they run on your computer, not in a web page.'] },
    'facebook-video-downloader': { title: 'Facebook videos', official: ['Videos you posted: Settings → Your information → Download your information → select Videos.', 'On the video post, click ⋯ → Save video to add it to your Saved items for later watching in-app.', 'Page owners can download original uploads from Meta Business Suite → Content.'], notes: ['Private videos cannot be fetched by any third-party tool that respects Facebook’s terms.', 'Downloading other people’s videos to re-upload elsewhere is copyright infringement.'] },
    'facebook-story-download': { title: 'Facebook Stories', official: ['Your own stories: open the story → ⋯ → Save video/photo (before the 24-hour expiry).', 'Enable Story Archive: Settings → Stories → Archive, so every story you post is kept privately.', 'Business pages: stories appear in Meta Business Suite where originals can be saved.'], notes: ['Screenshots or recordings of other people’s stories may notify them on some platforms and can breach privacy.'] },
    'facebook-reels-download': { title: 'Facebook Reels', official: ['Your Reels: open the reel → ⋯ → Save to device (available when the creator allows downloads).', 'Creators can toggle "Allow people to download your reel" in reel settings.', 'Originals remain in Meta Business Suite / Creator Studio for pages.'], notes: ['Reels with licensed music often cannot be downloaded even by the creator due to music rights.'] },
    'twitter-video-downloader': { title: 'X / Twitter videos', official: ['Bookmark the post (🔖) to keep it in your Bookmarks for later viewing.', 'Your own media: Settings → Your account → Download an archive of your data (includes uploaded media).', 'Request permission from the creator; many will share the original file.'], notes: ['X’s Developer Policy prohibits third-party services from bulk-downloading videos.', 'Embedding the post with X’s official embed code is the compliant way to reuse a video on your site.'] },
    'tiktok-downloader': { title: 'TikTok videos', official: ['Tap Share → Save video on any video whose creator allows downloads (includes a watermark).', 'Your own videos without watermark: save the draft before posting, or download from Creator tools → Analytics on the web.', 'Turn on "Allow downloads" in Privacy → Downloads to let others save your videos.'], notes: ['Third-party "no watermark" downloaders violate TikTok’s terms and frequently serve malware.', 'Reposting others’ TikToks on other platforms without credit and permission is a common copyright complaint trigger.'] }
  };
  function videoInfo(cfg, mount) {
    var info = VIDEO_INFO[cfg.slug] || VIDEO_INFO['online-video-downloader'];
    mount.innerHTML = '<div class="te"><div class="hero-grad"><p class="eyebrow" style="color:#c7d2fe">Official ways to save</p><h2 style="font-size:1.6rem;margin:0">' + esc(info.title) + '</h2></div>' +
      card('Official options', '<ol class="page-list" style="list-style:decimal;padding-left:1.2rem">' + info.official.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>') +
      card('What we will not do', '<ul class="page-list">' + info.notes.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul><p class="small muted mt-4">This page is guidance, not a downloader. We do not fetch, proxy or strip watermarks from third-party video platforms.</p>') + '</div>';
  }

  var MAP = {
    'wm-seoscore': seoScore, 'wm-metaanalyze': metaAnalyze, 'wm-ogcheck': ogCheck, 'wm-snooper': snooper,
    'wm-headers': headersTool, 'wm-wpdetect': wpDetect, 'wm-mobile': mobileTest, 'wm-speed': pageSpeed,
    'wm-pagesize': pageSize, 'wm-antivirus': safety, 'wm-emailprivacy': emailPrivacy, 'wm-pagerank': pageRank,
    'wm-ping': pingTool, 'wm-qr': qrTool, 'wm-htaccess': htaccess, 'wm-oggen': ogGen, 'wm-twittercard': twitterCard,
    'wm-urlencode': urlCodec, 'wm-adsense': adsense, 'wm-urlrewrite': urlRewrite, 'wm-hitcounter': hitCounter,
    'wm-screensim': screenSim, 'wm-screenshot': screenshot, 'wm-speedtest': speedTest, 'wm-shortener': shortener,
    'wm-suggest': suggest, 'wm-video': videoInfo
  };

  global.WebTools = {
    mountTool: function (cfg, mount) {
      var fn = MAP[cfg.engine];
      if (!fn) return false;
      fn(cfg, mount);
      return true;
    }
  };
})(window);
