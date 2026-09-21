/* Side-by-side competitor analysis — uses window.SEOAudit */
(function () {
  'use strict';
  var root = document.getElementById('ca-app');
  if (!root || !window.SEOAudit) return;
  var A = window.SEOAudit;
  var esc = A.esc;

  function normalise(url) { return /^https?:\/\//i.test(url.trim()) ? url.trim() : 'https://' + url.trim(); }
  function timeout(ms) { return new Promise(function (r) { setTimeout(function () { r(null); }, ms); }); }
  function getAudit(url) {
    var clean = normalise(url);
    return Promise.race([A.fetchPageData(clean).catch(function () { return null; }), timeout(8500)]).then(function (live) {
      return A.buildAudit(url, live || A.fallbackData(clean));
    });
  }
  function expiryStatus(days) {
    if (days === null || days === undefined) return { text: 'Expiry date unavailable', cls: 'muted' };
    if (days < 0) return { text: 'Expired ' + Math.abs(days).toLocaleString() + ' day' + (Math.abs(days) === 1 ? '' : 's') + ' ago', cls: 'tone-bad' };
    if (days < 30) return { text: 'Only ' + days.toLocaleString() + ' day' + (days === 1 ? '' : 's') + ' to renewal', cls: 'tone-bad' };
    if (days < 90) return { text: days.toLocaleString() + ' days to renewal', cls: 'tone-mid' };
    return { text: days.toLocaleString() + ' days remaining', cls: 'tone-good' };
  }
  function comparison(a, b, da, db) {
    function row(label, av, bv, high, suffix) {
      high = high !== false; suffix = suffix || '';
      var winner = av === bv ? 'tie' : high ? (av > bv ? 'yours' : 'theirs') : (av < bv ? 'yours' : 'theirs');
      return { label: label, yours: Number(av).toLocaleString() + suffix, theirs: Number(bv).toLocaleString() + suffix, winner: winner };
    }
    function domainRow(label, av, bv, aIso, bIso, laterWins, winText) {
      var aT = aIso ? Date.parse(aIso) : NaN, bT = bIso ? Date.parse(bIso) : NaN;
      var hasBoth = !isNaN(aT) && !isNaN(bT);
      var winner = !hasBoth || aT === bT ? 'tie' : laterWins === (aT > bT) ? 'yours' : 'theirs';
      return { label: label, yours: av || '—', theirs: bv || '—', winner: winner, result: !hasBoth ? 'No data' : winner === 'tie' ? 'Same date' : winText };
    }
    var rows = [row('Overall score', a.score, b.score)];
    a.categories.forEach(function (c, i) { rows.push(row(c.name + ' score', c.score, b.categories[i].score)); });
    var am = a.page || {}, bm = b.page || {};
    rows.push(row('Word count', am.wordCount || 0, bm.wordCount || 0));
    rows.push(row('Internal links', am.internalLinks || 0, bm.internalLinks || 0));
    rows.push(row('External links', am.externalLinks || 0, bm.externalLinks || 0));
    rows.push(row('Missing alt text', am.imagesMissingAlt || 0, bm.imagesMissingAlt || 0, false));
    rows.push(row('HTML size', Math.round((am.codeSize || 0) / 1024), Math.round((bm.codeSize || 0) / 1024), false, ' KB'));
    rows.push(row('Response time', am.fetchMs || 0, bm.fetchMs || 0, false, ' ms'));
    rows.push(domainRow('Domain registered', da && da.registered, db && db.registered, da && da.registeredIso, db && db.registeredIso, false, 'Older domain'));
    rows.push(domainRow('Domain expires', da && da.expiry, db && db.expiry, da && da.expiryIso, db && db.expiryIso, true, 'Valid longer'));
    return rows;
  }
  function gauge(value) { return A.gaugeHtml(value); }
  function checkClass(type) {
    var t = type === 'success' || type === 'pass' ? 'pass' : type;
    return t === 'pass' || t === 'success' ? 'badge-pass' : t === 'warning' ? 'badge-warning' : 'badge-error';
  }
  function overview(audit, label, badge) {
    return '<article class="audit-card"><div class="flex-between mb-4"><div><span class="badge" style="background:' + badge + ';color:#fff;border:0">' + esc(label) + '</span><h2 class="h3" style="margin:.5rem 0 0">' + esc(audit.host) + '</h2><p class="small muted">' + esc(audit.url) + '</p></div><span class="badge ' + (audit.live ? 'badge-live' : 'badge-fallback') + '">' + (audit.live ? 'Live HTML' : 'Estimated fallback') + '</span></div>' +
      '<div class="card flex" style="align-items:center;gap:1.25rem;margin-bottom:1rem">' + gauge(audit.score) + '<div style="flex:1"><h3 class="h3" style="margin:0">Overall SEO Score</h3><p class="small muted mb-4">Full page audit</p><div class="grid grid-4"><div class="te-stat"><p>Checks</p><b>' + audit.summary.total + '</b></div><div class="te-stat bad"><p>Errors</p><b>' + audit.summary.errors + '</b></div><div class="te-stat warn"><p>Warnings</p><b>' + audit.summary.warnings + '</b></div><div class="te-stat good"><p>Passed</p><b>' + audit.summary.passed + '</b></div></div></div></div>' +
      '<div class="grid-5">' + audit.categories.map(function (c) { return '<div class="card text-center" style="padding:.75rem"><p class="' + A.tone(c.score) + '" style="font-size:1.3rem;font-weight:800;margin:0">' + c.score + '</p><p class="small muted">' + esc(c.name) + '</p></div>'; }).join('') + '</div></article>';
  }
  function domainCard(info, label, badge) {
    var exp = expiryStatus(info && info.daysToExpiry);
    return '<article class="audit-card"><div class="flex-between mb-4"><div><span class="badge" style="background:' + badge + ';color:#fff;border:0">' + esc(label) + '</span><h2 class="h3" style="margin:.5rem 0 0">' + esc((info && info.domain) || 'Unknown domain') + '</h2><p class="small muted">' + (info && info.live ? 'Public registry data via RDAP' : 'No registry data available') + '</p></div><span class="badge ' + (info && info.live ? 'badge-live' : 'badge-fallback') + '">' + (info && info.live ? 'RDAP registry' : 'Unavailable') + '</span></div>' +
      '<div class="grid grid-2">' +
      '<div class="card"><p class="small muted">Registered</p><b>' + esc((info && info.registered) || '—') + '</b><p class="small muted">Age: ' + esc(info && info.registered ? info.ageLabel : 'Unknown') + '</p></div>' +
      '<div class="card"><p class="small muted">Expires</p><b>' + esc((info && info.expiry) || '—') + '</b><p class="small ' + exp.cls + '" style="font-weight:700">' + esc(exp.text) + '</p></div>' +
      '<div class="card"><p class="small muted">Registrar</p><b>' + esc((info && info.registrar) || '—') + '</b></div>' +
      '<div class="card"><p class="small muted">Last registry update</p><b>' + esc((info && info.updated) || '—') + '</b></div></div>' +
      (info && info.statuses && info.statuses.length ? '<div class="te-row mt-4">' + info.statuses.map(function (s) { return '<span class="pill mono" style="font-size:.7rem">' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
      (info && !info.live && info.error ? '<p class="warn-box mt-4">' + esc(info.error) + '</p>' : '') +
      (info && info.live ? '<p class="small muted mt-4">Dates reflect the current registry record. If a domain previously expired and was re-registered, the registry publishes the new registration date, not the original one. <a href="https://lookup.icann.org/en/lookup?name=' + encodeURIComponent(info.domain) + '" target="_blank" rel="noopener noreferrer">Verify at ICANN ↗</a></p>' : '') +
      '</article>';
  }
  function details(audit) {
    var links = (audit.page && audit.page.linksSample) || [];
    var internal = links.filter(function (l) { return l.internal; }).slice(0, 8);
    var external = links.filter(function (l) { return !l.internal; }).slice(0, 8);
    function panel(title, list, cls) {
      return '<div class="card card-p0"><div class="' + cls + '" style="padding:.75rem 1rem"><h4 class="eyebrow" style="margin:0">' + title + '</h4></div>' +
        (list.length ? list.map(function (l) { return '<a class="list-row" href="' + esc(l.href) + '" target="_blank" rel="noopener noreferrer" style="padding:.6rem 1rem"><span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:.8rem">' + esc(l.anchor || l.href) + '</span><span class="mono small muted">' + esc(l.href) + '</span></span>' + (l.nofollow ? '<span class="badge badge-warning">nofollow</span>' : '') + '</a>'; }).join('') : '<p class="small muted" style="padding:1rem">No URL samples available.</p>') + '</div>';
    }
    var cats = audit.categories.map(function (c) {
      return '<section class="card card-p0"><div class="flex-between" style="padding:.75rem 1rem;background:var(--slate-50);border-bottom:1px solid var(--slate-100)"><h3 class="h3" style="margin:0">' + esc(c.name) + '</h3><span class="' + A.tone(c.score) + '" style="font-weight:800">' + c.score + '/100</span></div>' +
        c.checks.map(function (item) {
          var t = item.type || item.state || 'success';
          var lab = t === 'success' || t === 'pass' ? 'pass' : t;
          return '<div class="issue-row"><span class="badge ' + checkClass(t) + '">' + lab + '</span><div><p style="font-weight:700;font-size:.9rem">' + esc(item.label) + '</p><p class="small muted">' + esc(item.detail) + '</p><p class="small mt-2"><b>Fix:</b> ' + esc(item.fix) + '</p></div></div>';
        }).join('') + '</section>';
    }).join('');
    var kws = (audit.keywords || []).map(function (k) { return '<span class="pill"><strong>' + esc(k.term) + '</strong> <span class="muted">' + k.count + '× · ' + k.density + '%</span></span>'; }).join('');
    return '<div class="te">' + cats + '<section class="card"><h3 class="h3" style="margin-top:0">Top Keywords</h3><div class="te-row">' + (kws || '<p class="small muted">No keyword data available.</p>') + '</div></section>' +
      panel('Internal URLs (' + ((audit.page && audit.page.internalLinks) || 0) + ')', internal, 'note') + panel('External URLs (' + ((audit.page && audit.page.externalLinks) || 0) + ')', external, 'ok-box') + '</div>';
  }

  var yours = '', theirs = '';
  function formView(busy, progress, status, error) {
    root.innerHTML = '<div class="te"><section class="compare-hero"><p class="eyebrow" style="color:#c7d2fe">Side-by-side SEO audit</p><h1 class="h1" style="color:#fff">Website Competitor Analysis</h1><p style="max-width:36rem;margin:1rem auto 0">Run two complete audits with the same on-page, technical, mobile, security and performance checks used by the homepage audit.</p></section>' +
      '<section class="card"><div class="grid grid-2"><div><label>Your website</label><input class="input ca-yours" placeholder="https://yourwebsite.com/page" value="' + esc(yours) + '"></div><div><label>Competitor website</label><input class="input ca-theirs" placeholder="https://competitor.com/page" value="' + esc(theirs) + '"></div></div>' +
      (busy ? '<div class="mt-6"><div class="flex-between small muted mb-2"><span>' + esc(status) + '</span><span>' + progress + '%</span></div><div class="progress-track" style="max-width:none;margin:0"><div class="progress-fill" style="width:' + progress + '%"></div></div></div>' :
        '<button type="button" class="btn btn-dark btn-lg" style="width:100%;margin-top:1.25rem" id="ca-run">Compare Both Websites →</button>') +
      (error ? '<p class="error-box">' + esc(error) + '</p>' : '') +
      '<p class="small muted text-center mt-4">If a site blocks browser access, a clearly labelled URL-based fallback keeps the comparison working.</p></section></div>';
    var y = root.querySelector('.ca-yours'), t = root.querySelector('.ca-theirs');
    if (y) y.addEventListener('input', function () { yours = y.value; });
    if (t) t.addEventListener('input', function () { theirs = t.value; });
    var btn = document.getElementById('ca-run'); if (btn) btn.addEventListener('click', run);
  }
  function resultView(ya, ta, yd, td) {
    var rows = comparison(ya, ta, yd, td);
    var yourWins = rows.filter(function (r) { return r.winner === 'yours'; }).length;
    var theirWins = rows.filter(function (r) { return r.winner === 'theirs'; }).length;
    var gaps = [];
    ya.categories.forEach(function (c) {
      c.checks.forEach(function (x) {
        var t = x.type || x.state;
        if (t !== 'success' && t !== 'pass') gaps.push({ category: c.name, label: x.label, fix: x.fix, state: t === 'error' ? 'error' : 'warning' });
      });
    });
    gaps = gaps.slice(0, 10);
    root.innerHTML = '<div class="te"><div class="flex-between"><div><h1 class="h1" style="font-size:1.8rem">SEO Competitor Comparison</h1><p class="small muted">Two full audit reports, side by side.</p></div><button type="button" class="btn btn-ghost" id="ca-reset">Compare different URLs</button></div>' +
      '<div class="grid grid-2">' + overview(ya, 'Your Website', 'var(--indigo-600)') + overview(ta, 'Competitor', 'var(--violet-600)') + '</div>' +
      '<section><div class="flex-between mb-4"><div><h2 class="h2" style="margin:0">Domain Registration &amp; Expiry</h2><p class="small muted">Registration and expiry dates from public RDAP registry data.</p></div><span class="badge badge-live">RDAP · public registry protocol</span></div><div class="grid grid-2">' + domainCard(yd, 'Your Website', 'var(--indigo-600)') + domainCard(td, 'Competitor', 'var(--violet-600)') + '</div></section>' +
      '<section class="card card-p0"><div class="flex-between" style="padding:1rem 1.25rem;border-bottom:1px solid var(--slate-100)"><div><h2 class="h3" style="margin:0">Head-to-Head Comparison</h2><p class="small muted">Green values show the stronger result.</p></div><div class="te-row"><span class="pill-yours result-pill">You win ' + yourWins + '</span><span class="pill-theirs result-pill">Competitor wins ' + theirWins + '</span></div></div>' +
      '<div class="table-wrap" style="margin:0;border:0"><table><thead><tr><th>Metric</th><th>Your site</th><th>Competitor</th><th>Result</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var res = r.result || (r.winner === 'yours' ? 'Your site leads' : r.winner === 'theirs' ? 'Competitor leads' : 'Tie');
        var cls = r.winner === 'yours' ? 'text-indigo-600' : r.winner === 'theirs' ? '' : 'muted';
        return '<tr><td style="font-weight:600">' + esc(r.label) + '</td><td class="mono' + (r.winner === 'yours' ? ' win-yours' : '') + '">' + esc(r.yours) + '</td><td class="mono' + (r.winner === 'theirs' ? ' win-yours' : '') + '">' + esc(r.theirs) + '</td><td class="small" style="font-weight:700">' + esc(res) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<div class="grid grid-2"><div><h2 class="h2">Your Full Audit</h2>' + details(ya) + '</div><div><h2 class="h2">Competitor Full Audit</h2>' + details(ta) + '</div></div>' +
      '<section class="card"><h2 class="h2" style="margin-top:0">Your Priority Improvement Plan</h2><p class="small muted mb-6">Fix errors first, then warnings.</p>' +
      (gaps.length ? '<div class="grid grid-2">' + gaps.map(function (g, i) { return '<article class="place-card"><span class="tick" style="background:' + (g.state === 'error' ? 'var(--red-100);color:var(--red-700)' : 'var(--amber-100);color:var(--amber-700)') + '">' + (i + 1) + '</span><div><p class="eyebrow">' + esc(g.category) + '</p><h3 class="h3" style="margin:0;font-size:.9rem">' + esc(g.label) + '</h3><p class="small muted">' + esc(g.fix) + '</p></div></article>'; }).join('') + '</div>' : '<p class="te-stat good"><b>All audited checks passed.</b></p>') +
      '</section></div>';
    document.getElementById('ca-reset').addEventListener('click', function () { formView(false, 0, '', ''); });
  }
  function run() {
    if (!yours.trim() || !theirs.trim()) { formView(false, 0, '', 'Enter both website URLs.'); return; }
    var progress = 8, status = 'Auditing both pages and querying domain registries…';
    formView(true, progress, status, '');
    var timer = setInterval(function () { progress = Math.min(90, progress + 4); var fill = root.querySelector('.progress-fill'); var lab = root.querySelector('.flex-between span'); if (fill) fill.style.width = progress + '%'; }, 250);
    Promise.all([
      getAudit(yours), getAudit(theirs),
      Promise.race([A.rdapInfo(yours).catch(function () { return null; }), timeout(9500)]),
      Promise.race([A.rdapInfo(theirs).catch(function () { return null; }), timeout(9500)])
    ]).then(function (pair) {
      clearInterval(timer);
      resultView(pair[0], pair[1], pair[2], pair[3]);
    });
  }
  formView(false, 0, '', '');
})();
