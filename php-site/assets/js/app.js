/* ============================================================
   SEO Audit Tools — shared front-end (pure vanilla JS)
   Nav toggle, cookie consent (PECR), copy buttons, FAQ accordion.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- mobile nav ---------- */
  var toggle = document.querySelector('[data-nav-toggle]');
  var links = document.querySelector('[data-nav-links]');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------- copy buttons (delegated — works for dynamically added panels) ---------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy') || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    }
    var old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function () { btn.textContent = old; }, 1500);
  });

  /* ---------- cookie consent (PECR / UK GDPR) ---------- */
  var CONSENT_KEY = 'ekstruh:cookie-consent:v1';
  var banner = document.querySelector('[data-cookie-banner]');
  var modal = document.querySelector('[data-cookie-modal]');
  var draft = { analytics: false, advertising: false, affiliate: false };

  function readConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (typeof c.analytics !== 'boolean' || typeof c.advertising !== 'boolean' || typeof c.affiliate !== 'boolean') return null;
      return c;
    } catch (e) { return null; }
  }

  function saveConsent(choice) {
    var record = { essential: true, analytics: !!choice.analytics, advertising: !!choice.advertising, affiliate: !!choice.affiliate, decided: new Date().toISOString() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch (e) { /* storage blocked */ }
    if (banner) banner.hidden = true;
    if (modal) modal.hidden = true;
    // Hook for analytics loading (implement when you add GA):
    // if (record.analytics) loadGoogleAnalytics();
    // if (record.advertising) loadAdSense();
  }

  var consent = readConsent();
  if (banner && !consent) {
    banner.hidden = false;
    var accept = banner.querySelector('[data-cookie-accept]');
    var decline = banner.querySelector('[data-cookie-decline]');
    var manage = banner.querySelector('[data-cookie-manage]');
    if (accept) accept.addEventListener('click', function () { saveConsent({ analytics: true, advertising: true, affiliate: true }); });
    if (decline) decline.addEventListener('click', function () { saveConsent({ analytics: false, advertising: false, affiliate: false }); });
    if (manage) manage.addEventListener('click', openModal);
  }

  function openModal() {
    if (!modal) return;
    var c = readConsent();
    draft = { analytics: !!(c && c.analytics), advertising: !!(c && c.advertising), affiliate: !!(c && c.affiliate) };
    modal.querySelectorAll('[data-toggle]').forEach(function (sw) {
      sw.setAttribute('aria-checked', draft[sw.getAttribute('data-toggle')] ? 'true' : 'false');
    });
    modal.hidden = false;
    if (banner) banner.hidden = true;
  }

  if (modal) {
    modal.querySelectorAll('[data-toggle]').forEach(function (sw) {
      sw.addEventListener('click', function () {
        var key = sw.getAttribute('data-toggle');
        draft[key] = !draft[key];
        sw.setAttribute('aria-checked', draft[key] ? 'true' : 'false');
      });
    });
    var close = modal.querySelector('[data-cookie-close]');
    var closeLink = modal.querySelector('[data-cookie-close-link]');
    var save = modal.querySelector('[data-cookie-save]');
    if (close) close.addEventListener('click', function () { modal.hidden = true; if (banner && !readConsent()) banner.hidden = false; });
    if (closeLink) closeLink.addEventListener('click', function () { modal.hidden = true; });
    if (save) save.addEventListener('click', function () { saveConsent(draft); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) { modal.hidden = true; if (banner && !readConsent()) banner.hidden = false; }
    });
  }

  /* footer "Cookie preferences" button (delegated — present on every page) */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-cookie-prefs]')) openModal();
  });

  /* ---------- sidebar / directory search ---------- */
  document.querySelectorAll('[data-tool-search]').forEach(function (box) {
    var input = box.querySelector('input');
    var results = box.querySelector('[data-search-results]');
    if (!input || !results) return;
    var idx = window.SEARCH_INDEX || { tools: [], posts: [] };
    var active = 0, flat = [];
    function score(name, desc, s) {
      var n = name.toLowerCase();
      if (n === s) return 100; if (n.indexOf(s) === 0) return 80; if (n.indexOf(s) !== -1) return 60;
      var words = s.split(/\s+/).filter(Boolean);
      if (words.every(function (w) { return n.indexOf(w) !== -1; })) return 50;
      if ((desc || '').toLowerCase().indexOf(s) !== -1) return 30;
      return 0;
    }
    function render() {
      var s = input.value.trim().toLowerCase();
      if (!s) { results.hidden = true; results.innerHTML = ''; return; }
      var tools = (idx.tools || []).map(function (t) { return { t: t, sc: score(t.name, t.description, s) }; }).filter(function (r) { return r.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 8).map(function (r) { return r.t; });
      var posts = (idx.posts || []).map(function (p) { return { p: p, sc: score(p.title, p.excerpt, s) }; }).filter(function (r) { return r.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 3).map(function (r) { return r.p; });
      flat = tools.map(function (t) { return '/tool/' + t.slug; }).concat(posts.map(function (p) { return '/blog/' + p.slug; }));
      active = 0;
      if (!tools.length && !posts.length) {
        results.innerHTML = '<p class="small muted" style="padding:1rem">No tools match “' + input.value.replace(/</g, '') + '”. <a href="/tools?q=' + encodeURIComponent(input.value.trim()) + '">Browse all tools</a></p>';
      } else {
        var html = '';
        if (tools.length) html += '<p class="eyebrow" style="padding:.75rem 1rem 0">Tools</p>';
        tools.forEach(function (t, i) { html += '<a class="search-hit' + (i === 0 ? ' active' : '') + '" href="/tool/' + t.slug + '"><span>' + t.name + '</span><span class="small muted">' + (t.category || '') + '</span></a>'; });
        if (posts.length) html += '<p class="eyebrow" style="padding:.75rem 1rem 0;border-top:1px solid var(--slate-100)">Blog articles</p>';
        posts.forEach(function (p, j) { html += '<a class="search-hit' + ((tools.length + j) === 0 ? ' active' : '') + '" href="/blog/' + p.slug + '"><span>' + p.title + '</span></a>'; });
        results.innerHTML = html;
      }
      results.hidden = false;
    }
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('keydown', function (e) {
      var hits = results.querySelectorAll('.search-hit');
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(flat.length - 1, active + 1); hits.forEach(function (h, i) { h.classList.toggle('active', i === active); }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); hits.forEach(function (h, i) { h.classList.toggle('active', i === active); }); }
      else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) location.href = flat[active]; else if (input.value.trim()) location.href = '/tools?q=' + encodeURIComponent(input.value.trim()); }
      else if (e.key === 'Escape') results.hidden = true;
    });
    document.addEventListener('mousedown', function (e) { if (!box.contains(e.target)) results.hidden = true; });
    var btn = box.querySelector('[data-search-go]');
    if (btn) btn.addEventListener('click', function () { if (flat[active]) location.href = flat[active]; else if (input.value.trim()) location.href = '/tools?q=' + encodeURIComponent(input.value.trim()); });
  });

  /* expose tiny helpers for tool pages */
  window.SEO = window.SEO || {};
  window.SEO.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  window.SEO.outputPanel = function (label, value, stats) {
    var esc = window.SEO.esc;
    var html = '<div class="output-panel"><div class="output-label"><span>' + esc(label) + '</span>' +
      '<button type="button" class="copy-btn" data-copy="' + esc(value).replace(/\n/g, '&#10;') + '">Copy</button></div>' +
      '<pre class="output-pre">' + esc(value) + '</pre>';
    if (stats && stats.length) {
      html += '<div class="stat-grid">' + stats.map(function (s) {
        return '<div class="stat-box"><p class="stat-box-label">' + esc(s[0]) + '</p><p class="stat-box-value">' + esc(s[1]) + '</p></div>';
      }).join('') + '</div>';
    }
    return html + '</div>';
  };
})();
