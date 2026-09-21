/* IP tools — live geolocation APIs, fired only on demand */
(function (global) {
  'use strict';
  var Seeded = (global.ToolEngines && global.ToolEngines.Seeded) || function (s) { this.next = function () { return 0.5; }; this.int = function (a, b) { return a; }; this.pick = function (a) { return a[0]; }; };
  var esc = (global.SEO && global.SEO.esc) || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  function detectVersion(ip) {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return 'IPv4';
    if (/^[0-9a-f:]+$/i.test(ip) && ip.indexOf(':') !== -1) return 'IPv6';
    return 'Unknown';
  }
  function isValidIp(ip) {
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return ip.split('.').every(function (o) { return Number(o) <= 255; });
    return /^[0-9a-f:]{2,}$/i.test(ip) && ip.indexOf(':') !== -1;
  }
  function isPrivateIp(ip) { return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1$|fc|fd|fe80)/i.test(ip); }
  function classOf(ip) {
    var first = Number(ip.split('.')[0]);
    if (first < 128) return 'A'; if (first < 192) return 'B'; if (first < 224) return 'C'; if (first < 240) return 'D (multicast)'; return 'E (reserved)';
  }
  function flagEmoji(cc) {
    if (!cc || cc.length !== 2) return '';
    return String.fromCodePoint.apply(null, cc.toUpperCase().split('').map(function (c) { return 127397 + c.charCodeAt(0); }));
  }
  function distanceKm(lat1, lon1, lat2, lon2) {
    var R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  function withTimeout(ms) { return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined; }
  function empty(ip) {
    return { ip: ip || '', version: detectVersion(ip || ''), city: '', region: '', regionCode: '', country: '', countryCode: '', continent: '', postal: '', latitude: null, longitude: null, timezone: '', utcOffset: '', currency: '', callingCode: '', languages: '', capital: '', borders: '', isp: '', org: '', asn: '', hostname: '', isEU: null, source: '' };
  }

  function getMyIp() {
    var out = { v4: '', v6: '' };
    function tryFetch(url) {
      return fetch(url, { signal: withTimeout(6000) }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { return (j.ip || '').trim(); }).catch(function () { return ''; });
    }
    return Promise.all([tryFetch('https://api.ipify.org?format=json'), tryFetch('https://api64.ipify.org?format=json')]).then(function (pair) {
      out.v4 = pair[0]; out.v6 = pair[1] && pair[1] !== pair[0] ? pair[1] : '';
      if (!out.v4 && !out.v6) {
        return tryFetch('https://ipapi.co/json/').then(function (alt) {
          if (alt) { if (detectVersion(alt) === 'IPv6') out.v6 = alt; else out.v4 = alt; }
          return out;
        });
      }
      return out;
    });
  }

  function lookupIp(ip) {
    ip = ip || '';
    return fetch('https://ipwho.is/' + ip, { signal: withTimeout(7000) }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (j) {
      if (j.success === false || !j.ip) throw new Error('empty');
      var info = empty(j.ip);
      info.city = j.city || ''; info.region = j.region || ''; info.regionCode = j.region_code || '';
      info.country = j.country || ''; info.countryCode = j.country_code || '';
      info.continent = j.continent ? j.continent + (j.continent_code ? ' (' + j.continent_code + ')' : '') : (j.continent_code || '');
      info.postal = j.postal || '';
      info.latitude = typeof j.latitude === 'number' ? j.latitude : null;
      info.longitude = typeof j.longitude === 'number' ? j.longitude : null;
      info.timezone = (j.timezone && j.timezone.id) || ''; info.utcOffset = (j.timezone && j.timezone.utc) || '';
      info.currency = j.currency ? (j.currency.code || '') + (j.currency.name ? ' (' + j.currency.name + ')' : '') + (j.currency.symbol ? ' ' + j.currency.symbol : '') : '';
      info.callingCode = j.calling_code ? '+' + j.calling_code : '';
      info.capital = j.capital || ''; info.borders = j.borders || '';
      info.isp = (j.connection && j.connection.isp) || ''; info.org = (j.connection && j.connection.org) || '';
      info.asn = j.connection && j.connection.asn ? 'AS' + j.connection.asn : ''; info.hostname = (j.connection && j.connection.domain) || '';
      info.isEU = typeof j.is_eu === 'boolean' ? j.is_eu : null; info.source = 'ipwho.is';
      return info;
    }).catch(function () {
      return fetch('https://ipapi.co/' + (ip ? ip + '/' : '') + 'json/', { signal: withTimeout(7000) }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (j) {
        if (j.error || !j.ip) throw new Error('empty');
        var info = empty(j.ip);
        info.city = j.city || ''; info.region = j.region || ''; info.regionCode = j.region_code || '';
        info.country = j.country_name || ''; info.countryCode = j.country_code || '';
        info.continent = j.continent_code || ''; info.postal = j.postal || '';
        info.latitude = typeof j.latitude === 'number' ? j.latitude : null;
        info.longitude = typeof j.longitude === 'number' ? j.longitude : null;
        info.timezone = j.timezone || ''; info.utcOffset = j.utc_offset || '';
        info.currency = j.currency ? j.currency + (j.currency_name ? ' (' + j.currency_name + ')' : '') : '';
        info.callingCode = j.country_calling_code || ''; info.languages = j.languages || '';
        info.capital = j.country_capital || ''; info.isp = j.org || ''; info.org = j.org || ''; info.asn = j.asn || '';
        info.isEU = typeof j.in_eu === 'boolean' ? j.in_eu : null; info.source = 'ipapi.co';
        return info;
      });
    }).catch(function () {
      return fetch('https://freeipapi.com/api/json/' + ip, { signal: withTimeout(7000) }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (j) {
        if (!j.ipAddress) return null;
        var info = empty(j.ipAddress);
        info.city = j.cityName || ''; info.region = j.regionName || ''; info.country = j.countryName || ''; info.countryCode = j.countryCode || '';
        info.continent = j.continent || ''; info.postal = j.zipCode || '';
        info.latitude = typeof j.latitude === 'number' ? j.latitude : null;
        info.longitude = typeof j.longitude === 'number' ? j.longitude : null;
        info.timezone = Array.isArray(j.timeZones) ? (j.timeZones[0] || '') : '';
        info.currency = j.currency && j.currency.code ? j.currency.code + (j.currency.name ? ' (' + j.currency.name + ')' : '') : '';
        info.languages = Array.isArray(j.languages) ? j.languages.join(', ') : '';
        info.source = 'freeipapi.com';
        return info;
      }).catch(function () { return null; });
    });
  }

  function stat(label, value, tone) { return '<div class="te-stat' + (tone ? ' ' + tone : '') + '"><p>' + esc(label) + '</p><b>' + (value == null || value === '' ? '—' : value) + '</b></div>'; }
  function spinner(label) { return '<div class="spin-row"><span class="spin"></span>' + esc(label) + '</div>'; }
  function liveBadge(src) { return '<span class="live-dot">Live' + (src ? ' · ' + esc(src) : '') + '</span>'; }
  function demoBadge() { return '<span class="badge badge-warning">Illustrative</span>'; }
  function card(title, body, right) {
    return '<div class="card"><div class="flex-between mb-4"><h3 class="h3" style="margin:0">' + title + '</h3>' + (right || '') + '</div>' + body + '</div>';
  }
  function infoGrid(rows) {
    return '<div class="grid grid-3">' + rows.filter(function (r) { return r[1] !== '' && r[1] != null; }).map(function (r) {
      return '<div class="te-stat"><p>' + esc(r[0]) + '</p><b>' + r[1] + '</b></div>';
    }).join('') + '</div>';
  }
  function geoRows(info) {
    var local = '';
    if (info.timezone) { try { local = new Date().toLocaleString('en-GB', { timeZone: info.timezone }); } catch (e) { local = ''; } }
    return [
      ['IP Address', '<span class="mono">' + esc(info.ip) + '</span>'],
      ['IP Version', esc(info.version)],
      ['City', esc(info.city)],
      ['Region / State', info.region ? esc(info.region + (info.regionCode ? ' (' + info.regionCode + ')' : '')) : ''],
      ['Country', info.country ? esc(flagEmoji(info.countryCode) + ' ' + info.country + ' (' + info.countryCode + ')') : ''],
      ['Continent', esc(info.continent)],
      ['Postal Code', esc(info.postal)],
      ['Latitude', info.latitude !== null ? info.latitude.toFixed(4) : ''],
      ['Longitude', info.longitude !== null ? info.longitude.toFixed(4) : ''],
      ['Timezone', info.timezone ? esc(info.timezone + (info.utcOffset ? ' (UTC ' + info.utcOffset + ')' : '')) : ''],
      ['Local Time', esc(local)],
      ['ISP', esc(info.isp)],
      ['Organization', info.org && info.org !== info.isp ? esc(info.org) : ''],
      ['ASN', esc(info.asn)],
      ['Hostname', esc(info.hostname)],
      ['Currency', esc(info.currency)],
      ['Calling Code', esc(info.callingCode)],
      ['Languages', esc(info.languages)],
      ['Country Capital', esc(info.capital)],
      ['Bordering Countries', info.borders ? esc(info.borders.split(',').map(function (c) { return flagEmoji(c.trim()) + ' ' + c.trim(); }).join('  ')) : ''],
      ['In European Union', info.isEU === null ? '' : (info.isEU ? 'Yes' : 'No')]
    ];
  }
  function mapEmbed(lat, lon, label) {
    var d = 0.08, bbox = (lon - d) + ',' + (lat - d) + ',' + (lon + d) + ',' + (lat + d);
    return '<button type="button" class="dropzone map-show" data-lat="' + lat + '" data-lon="' + lon + '" data-label="' + esc(label) + '"><strong>Show on map</strong><br><span class="small muted">' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ' · loads OpenStreetMap on click</span></button>';
  }
  function bindMap(root) {
    var btn = root.querySelector('.map-show');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var lat = Number(btn.getAttribute('data-lat')), lon = Number(btn.getAttribute('data-lon')), label = btn.getAttribute('data-label');
      var d = 0.08, bbox = (lon - d) + ',' + (lat - d) + ',' + (lon + d) + ',' + (lat + d);
      btn.outerHTML = '<div style="border:1px solid var(--slate-200);border-radius:var(--radius-xl);overflow:hidden"><iframe title="Map of ' + esc(label) + '" loading="lazy" style="width:100%;height:14rem;border:0" src="https://www.openstreetmap.org/export/embed.html?bbox=' + bbox + '&layer=mapnik&marker=' + lat + ',' + lon + '"></iframe><a class="small muted" style="display:block;text-align:right;padding:.4rem .75rem" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=12/' + lat + '/' + lon + '">View larger map ↗</a></div>';
    });
  }
  function copyable(ip, label) {
    return '<div class="hero-grad"><p style="opacity:.85;font-size:.85rem">' + esc(label) + '</p><div class="te-row"><p class="mono" style="font-size:1.8rem;font-weight:800;word-break:break-all">' + esc(ip || 'Not detected') + '</p>' +
      (ip ? '<button type="button" class="btn btn-ghost copy-ip" data-ip="' + esc(ip) + '" style="background:rgba(255,255,255,.2);color:#fff;border:0">Copy</button>' : '') + '</div></div>';
  }

  function whatIsMyIp(cfg, mount) {
    mount.innerHTML = spinner('Detecting your public IP address and location…');
    var browserRows = (function () {
      var ua = navigator.userAgent;
      var name = /edg\//i.test(ua) ? 'Microsoft Edge' : /opr\//i.test(ua) ? 'Opera' : /chrome|crios/i.test(ua) ? 'Google Chrome' : /firefox|fxios/i.test(ua) ? 'Mozilla Firefox' : /safari/i.test(ua) ? 'Safari' : 'Unknown';
      var os = /windows/i.test(ua) ? 'Windows' : /mac os x/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : 'Unknown';
      var conn = navigator.connection || {};
      return [
        ['Browser', name], ['Operating System', os],
        ['Device Type', /mobi|android|iphone/i.test(ua) ? 'Mobile' : /ipad|tablet/i.test(ua) ? 'Tablet' : 'Desktop'],
        ['Screen', window.screen.width + ' × ' + window.screen.height + ' @' + (window.devicePixelRatio || 1) + 'x'],
        ['Browser Language', navigator.language],
        ['System Timezone', (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown')],
        ['Connection Type', conn.effectiveType ? conn.effectiveType.toUpperCase() : 'Unknown'],
        ['Downlink', conn.downlink ? '~' + conn.downlink + ' Mbps' : 'Unknown'],
        ['Latency (RTT)', conn.rtt ? '~' + conn.rtt + ' ms' : 'Unknown'],
        ['Data Saver', conn.saveData ? 'On' : 'Off'],
        ['Cookies', navigator.cookieEnabled ? 'Enabled' : 'Disabled'],
        ['Do Not Track', navigator.doNotTrack === '1' ? 'Enabled' : 'Not set'],
        ['CPU Cores', String(navigator.hardwareConcurrency || 'Unknown')],
        ['User Agent', ua]
      ];
    })();
    function paint(ips, info, failed) {
      var v4 = (ips && ips.v4) || (info && info.version === 'IPv4' ? info.ip : '');
      var v6 = (ips && ips.v6) || (info && info.version === 'IPv6' ? info.ip : '');
      var html = '<div class="te"><div class="grid grid-2">' + copyable(v4, 'Your public IPv4 address') +
        '<div class="card" style="background:var(--slate-900);color:#fff"><p class="small" style="color:#94a3b8">Your public IPv6 address</p><p class="mono" style="font-size:1.2rem;font-weight:700;word-break:break-all">' + esc(v6 || 'No IPv6 detected') + '</p><p class="small" style="color:#64748b;margin-top:.5rem">' + (v6 ? 'Your network supports IPv6.' : 'Your connection is using IPv4 only.') + '</p></div></div>';
      if (failed) html += '<div class="warn-box">Could not reach the IP services (an ad blocker or strict network may be blocking them). Browser details below are still accurate. <button type="button" class="link-btn ip-retry">Retry</button></div>';
      if (info) {
        html += card('Location & Network', infoGrid(geoRows(info)) +
          (info.latitude != null && info.longitude != null ? '<div class="mt-4 map-slot">' + mapEmbed(info.latitude, info.longitude, info.city || info.ip) + '</div>' : '') +
          (info.timezone && Intl.DateTimeFormat().resolvedOptions().timeZone && info.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone
            ? '<div class="note mt-4"><strong>VPN / proxy hint:</strong> your IP timezone (' + esc(info.timezone) + ') differs from your device timezone (' + esc(Intl.DateTimeFormat().resolvedOptions().timeZone) + '). This often indicates a VPN, proxy or corporate gateway.</div>' : ''), liveBadge(info.source));
      }
      html += card('Your Browser & Connection', infoGrid(browserRows.map(function (r) { return [r[0], esc(r[1])]; })), liveBadge('local'));
      html += card('What is an IP address?', '<div class="small" style="color:var(--slate-600);line-height:1.7"><p>An IP (Internet Protocol) address is the unique number your internet provider assigns to your connection so websites know where to send data back. Most home connections receive a <strong>dynamic</strong> IP that can change periodically, while servers and businesses often use <strong>static</strong> IPs.</p><p class="mt-2">Websites can see your public IP, and from it estimate your city-level location, ISP and timezone, which is exactly what you see above. They cannot see your exact street address. To hide your IP, use a reputable VPN or the Tor network.</p></div>');
      html += '</div>';
      mount.innerHTML = html;
      bindMap(mount);
      mount.querySelectorAll('.copy-ip').forEach(function (b) { b.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(b.getAttribute('data-ip')); b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }); });
      var retry = mount.querySelector('.ip-retry'); if (retry) retry.addEventListener('click', function () { whatIsMyIp(cfg, mount); });
    }
    Promise.all([getMyIp(), lookupIp('')]).then(function (pair) {
      var my = pair[0], geo = pair[1];
      paint(my, geo, !my.v4 && !my.v6 && !geo);
    });
  }

  function ipLocation(withMap) {
    return function (cfg, mount) {
      mount.innerHTML = '<div class="te"><div class="te-row" style="flex-wrap:nowrap"><input class="input ip-q" placeholder="' + esc(cfg.placeholder || 'Enter an IP address or domain') + '" style="flex:1"><button type="button" class="btn btn-primary ip-go">Locate IP</button><button type="button" class="btn btn-ghost ip-me">Use my IP</button></div><div class="ip-out"></div></div>';
      var out = mount.querySelector('.ip-out');
      function run(target) {
        var q = (target !== undefined ? target : mount.querySelector('.ip-q').value).trim();
        if (q && !isValidIp(q) && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(q)) { out.innerHTML = '<div class="error-box">Enter a valid IPv4/IPv6 address (e.g. 8.8.8.8) or a domain name.</div>'; return; }
        if (q && isPrivateIp(q)) { out.innerHTML = '<div class="error-box">' + esc(q) + ' is a private/reserved address used inside local networks. It has no public geolocation.</div>'; return; }
        out.innerHTML = spinner('Querying geolocation databases…');
        Promise.all([lookupIp(q), withMap ? lookupIp('') : Promise.resolve(null)]).then(function (pair) {
          var res = pair[0], me = pair[1];
          if (!res) { out.innerHTML = '<div class="error-box">Lookup failed. The address may be unroutable, or the geolocation services are blocked on your network.</div>'; return; }
          var dist = withMap && res.latitude != null && res.longitude != null && me && me.latitude != null && me.longitude != null ? distanceKm(me.latitude, me.longitude, res.latitude, res.longitude) : null;
          out.innerHTML = '<div class="hero-grad"><p style="opacity:.85">' + (q ? 'Location of' : 'Your location for') + '</p><p class="mono" style="font-size:1.6rem;font-weight:800;word-break:break-all">' + esc(res.ip) + '</p><p style="font-size:1.1rem;margin-top:.5rem">' + esc(flagEmoji(res.countryCode) + ' ' + [res.city, res.region, res.country].filter(Boolean).join(', ') || 'Location unavailable') + '</p>' +
            (dist !== null ? '<p style="opacity:.85;margin-top:.35rem">≈ ' + dist.toLocaleString() + ' km from your current location</p>' : '') + '</div>' +
            (withMap && res.latitude != null ? '<div class="map-slot">' + mapEmbed(res.latitude, res.longitude, res.city || res.ip) + '</div>' : '') +
            card('Full geolocation record', infoGrid(geoRows(res)) + '<p class="small muted mt-4">IP geolocation is accurate to country level ~99% of the time and to city level roughly 55–80%. It reflects where the ISP routes the address, not a physical street address.</p>', liveBadge(res.source));
          bindMap(out);
        });
      }
      mount.querySelector('.ip-go').addEventListener('click', function () { run(); });
      mount.querySelector('.ip-me').addEventListener('click', function () { mount.querySelector('.ip-q').value = ''; run(''); });
      mount.querySelector('.ip-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    };
  }

  var TLDS = ['.com', '.net', '.org', '.co.uk', '.io', '.co', '.info', '.biz', '.us', '.shop'];
  var WORDS = ['alpha', 'blue', 'cloud', 'digital', 'eco', 'first', 'global', 'harbor', 'iron', 'jade', 'kinetic', 'lumen', 'metro', 'nova', 'orbit', 'pixel', 'quest', 'river', 'summit', 'terra', 'urban', 'vista', 'wave', 'zen', 'apex', 'bright', 'core', 'delta', 'ember', 'forge'];
  var SUFFIX = ['media', 'labs', 'studio', 'group', 'shop', 'hub', 'works', 'tech', 'consulting', 'design', 'solutions', 'partners'];

  function reverseIp(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="te-row" style="flex-wrap:nowrap"><input class="input ip-q" placeholder="' + esc(cfg.placeholder || 'IP or domain') + '" style="flex:1"><button type="button" class="btn btn-primary ip-go">Check Reverse IP</button></div><div class="ip-out"></div></div>';
    var out = mount.querySelector('.ip-out');
    mount.querySelector('.ip-go').addEventListener('click', run);
    mount.querySelector('.ip-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
    function run() {
      var q = mount.querySelector('.ip-q').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!q) return;
      out.innerHTML = spinner('Looking up shared hosting neighbours…');
      var p = Promise.resolve(null);
      if (isValidIp(q)) {
        if (isPrivateIp(q)) { out.innerHTML = '<div class="error-box">' + esc(q) + ' is a private address; reverse IP data only exists for public IPs.</div>'; return; }
        p = lookupIp(q);
      }
      p.then(function (info) {
        var rng = new Seeded('rev|' + q);
        var count = rng.int(4, 38);
        var list = [];
        for (var i = 0; i < count; i++) {
          var w1 = rng.pick(WORDS), w2 = rng.pick(SUFFIX), tld = rng.pick(TLDS);
          list.push({ domain: w1 + (rng.next() > 0.5 ? '-' : '') + w2 + tld, tld: tld, type: rng.pick(['Business', 'Blog', 'E-commerce', 'Portfolio', 'Agency', 'SaaS']) });
        }
        if (!isValidIp(q)) list.unshift({ domain: q, tld: q.slice(q.indexOf('.')), type: 'Queried domain' });
        var seen = {}, uniq = [];
        list.forEach(function (d) { if (!seen[d.domain]) { seen[d.domain] = 1; uniq.push(d); } });
        var shared = uniq.length;
        var risk = shared <= 5 ? ['Low', 'good'] : shared <= 20 ? ['Moderate', 'warn'] : ['High', 'bad'];
        var rows = uniq.map(function (d, i) { return '<tr><td class="muted">' + (i + 1) + '</td><td class="mono">' + esc(d.domain) + '</td><td>' + esc(d.tld) + '</td><td>' + esc(d.type) + '</td></tr>'; }).join('');
        out.innerHTML = '<div class="grid grid-3">' + stat('Domains on this IP', String(shared)) + stat('Hosting type', shared <= 2 ? 'Dedicated / VPS' : shared <= 20 ? 'Small shared' : 'Shared hosting') + stat('Bad-neighbour risk', risk[0], risk[1]) + '</div>' +
          (info ? card('Server details', infoGrid([['IP Address', '<span class="mono">' + esc(info.ip) + '</span>'], ['Hosting Provider / ISP', esc(info.isp)], ['Organization', esc(info.org)], ['ASN', esc(info.asn)], ['Server Location', esc([info.city, info.region, info.country].filter(Boolean).join(', '))], ['Timezone', esc(info.timezone)]]), liveBadge(info.source)) : '') +
          card('Websites sharing this IP (' + shared + ')', '<div class="table-wrap"><table><thead><tr><th>#</th><th>Domain</th><th>TLD</th><th>Type</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="small muted mt-4">Browsers cannot run reverse-DNS queries, so the neighbour list is illustrative; the server details above are real when an IP is entered. Sharing an IP with spam or malware sites can harm email deliverability and, rarely, search trust.</p>', demoBadge());
      });
    }
  }

  var COUNTRIES = [['US', 'United States'], ['DE', 'Germany'], ['NL', 'Netherlands'], ['GB', 'United Kingdom'], ['FR', 'France'], ['SG', 'Singapore'], ['CA', 'Canada'], ['JP', 'Japan'], ['BR', 'Brazil'], ['IN', 'India'], ['PL', 'Poland'], ['SE', 'Sweden']];

  function proxyList(cfg, mount) {
    var filter = 'All', seed = new Date().toISOString().slice(0, 10);
    function build() {
      var rng = new Seeded('proxy|' + seed);
      var proxies = [];
      for (var i = 0; i < 40; i++) {
        var c = rng.pick(COUNTRIES);
        var type = rng.pick(['HTTP', 'HTTP', 'HTTPS', 'HTTPS', 'SOCKS4', 'SOCKS5']);
        proxies.push({
          ip: rng.int(5, 220) + '.' + rng.int(1, 254) + '.' + rng.int(1, 254) + '.' + rng.int(2, 253),
          port: rng.pick([80, 8080, 3128, 8000, 1080, 8888, 9050, 443, 8118]),
          type: type, country: c[1], cc: c[0],
          anonymity: rng.pick(['Elite', 'Anonymous', 'Anonymous', 'Transparent']),
          speed: rng.int(120, 4800), uptime: rng.int(62, 99), checked: rng.int(1, 55) + ' min ago'
        });
      }
      proxies.sort(function (a, b) { return a.speed - b.speed; });
      return proxies;
    }
    function draw() {
      var proxies = build();
      var shown = proxies.filter(function (p) { return filter === 'All' || p.type === filter; });
      var types = ['All', 'HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5'];
      mount.innerHTML = '<div class="te"><div class="flex-between"><div class="te-row">' + types.map(function (t) { return '<button type="button" class="pill' + (filter === t ? ' on' : '') + '" data-f="' + t + '">' + t + '</button>'; }).join('') + '</div><div class="te-row"><button type="button" class="btn btn-ghost px-refresh">Refresh list</button><button type="button" class="btn btn-dark px-copy">Copy ' + shown.length + ' as IP:PORT</button></div></div>' +
        '<div class="grid grid-4">' + stat('Proxies listed', String(shown.length)) + stat('Elite (high anonymity)', String(shown.filter(function (p) { return p.anonymity === 'Elite'; }).length), 'good') + stat('Countries', String(new Set(shown.map(function (p) { return p.cc; })).size)) + stat('Fastest', (shown[0] ? shown[0].speed : 0) + ' ms', 'good') + '</div>' +
        '<div class="card card-p0"><div class="table-wrap" style="margin:0;border:0"><table><thead><tr>' + ['IP Address', 'Port', 'Type', 'Country', 'Anonymity', 'Speed', 'Uptime', 'Checked'].map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
        shown.map(function (p) {
          var typeCls = p.type.indexOf('SOCKS') === 0 ? 'badge-pass' : p.type === 'HTTPS' ? 'badge-pass' : 'badge-fallback';
          var anonTone = p.anonymity === 'Elite' ? 'good' : p.anonymity === 'Anonymous' ? '' : 'warn';
          var speedTone = p.speed < 800 ? 'good' : p.speed < 2000 ? '' : 'bad';
          return '<tr><td class="mono">' + esc(p.ip) + '</td><td class="mono">' + p.port + '</td><td><span class="badge ' + typeCls + '">' + p.type + '</span></td><td>' + esc(flagEmoji(p.cc) + ' ' + p.country) + '</td><td class="te-stat ' + anonTone + '" style="background:none;border:0;padding:0"><b>' + p.anonymity + '</b></td><td>' + p.speed + ' ms</td><td>' + p.uptime + '%</td><td class="muted">' + esc(p.checked) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        card('Proxy anonymity levels explained', '<div class="grid grid-3"><div class="ok-box"><p class="h3" style="margin:0 0 .35rem">Elite</p><p>Hides your IP and does not reveal that a proxy is in use. Best for privacy.</p></div><div class="note"><p class="h3" style="margin:0 0 .35rem">Anonymous</p><p>Hides your real IP but sends headers that reveal a proxy is being used.</p></div><div class="warn-box"><p class="h3" style="margin:0 0 .35rem">Transparent</p><p>Forwards your real IP in headers. Only useful for caching, not anonymity.</p></div></div><p class="small muted mt-4">Free public proxies are illustrative here and are inherently unreliable and unsafe for logins or payments. Never send credentials through an untrusted proxy.</p>') +
        '</div>';
      mount.querySelectorAll('[data-f]').forEach(function (b) { b.addEventListener('click', function () { filter = b.getAttribute('data-f'); draw(); }); });
      mount.querySelector('.px-refresh').addEventListener('click', function () { seed = Date.now().toString(); draw(); });
      mount.querySelector('.px-copy').addEventListener('click', function () {
        navigator.clipboard && navigator.clipboard.writeText(shown.map(function (p) { return p.ip + ':' + p.port; }).join('\n'));
        var b = mount.querySelector('.px-copy'); b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy ' + shown.length + ' as IP:PORT'; }, 1500);
      });
    }
    draw();
  }

  function classC(cfg, mount) {
    mount.innerHTML = '<div class="te"><textarea class="textarea cc-src" rows="7" spellcheck="false" placeholder="' + esc(cfg.placeholder || 'One host or IP per line') + '"></textarea><button type="button" class="btn btn-primary cc-go">Check Class C Ranges</button><div class="cc-out"></div></div>';
    mount.querySelector('.cc-go').addEventListener('click', function () {
      var hosts = Array.from(new Set(mount.querySelector('.cc-src').value.split(/[\n,\s]+/).map(function (h) { return h.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(); }).filter(Boolean))).slice(0, 20);
      if (!hosts.length) return;
      var out = mount.querySelector('.cc-out');
      out.innerHTML = spinner('Checking…');
      var rows = hosts.map(function (host) {
        var ip = '', live = false;
        if (isValidIp(host) && detectVersion(host) === 'IPv4') { ip = host; live = true; }
        else { var rng = new Seeded('classc|' + host); ip = rng.int(23, 216) + '.' + rng.int(1, 254) + '.' + rng.int(1, 254) + '.' + rng.int(2, 253); }
        var parts = ip.split('.');
        return { host: host, ip: ip, classC: parts[0] + '.' + parts[1] + '.' + parts[2] + '.*', cls: classOf(ip), live: live };
      });
      var m = {};
      rows.forEach(function (r) { m[r.classC] = (m[r.classC] || []).concat([r.host]); });
      var groups = Object.keys(m).filter(function (k) { return m[k].length > 1; }).map(function (k) { return [k, m[k]]; });
      out.innerHTML = '<div class="grid grid-3">' + stat('Hosts checked', String(rows.length)) + stat('Unique Class C blocks', String(Object.keys(m).length)) + stat('Shared ranges found', String(groups.length), groups.length ? 'warn' : 'good') + '</div>' +
        (groups.length ? card('Shared Class C ranges', groups.map(function (g) { return '<p class="mono"><strong>' + esc(g[0]) + '</strong> — ' + esc(g[1].join(', ')) + '</p>'; }).join('')) : '') +
        card('Results', '<div class="table-wrap"><table><thead><tr><th>Host</th><th>IP</th><th>Class C</th><th>Class</th></tr></thead><tbody>' +
          rows.map(function (r) { return '<tr><td class="mono">' + esc(r.host) + '</td><td class="mono">' + esc(r.ip) + (r.live ? ' <span class="live-dot">Live</span>' : '') + '</td><td class="mono">' + esc(r.classC) + '</td><td>' + esc(r.cls) + '</td></tr>'; }).join('') +
          '</tbody></table></div><p class="small muted mt-4">Browsers cannot resolve DNS, so domain names receive a stable illustrative IPv4. Enter IPv4 addresses for live classification.</p>');
    });
  }

  var MAP = {
    myip: whatIsMyIp,
    iplocation: ipLocation(false),
    geoip: ipLocation(true),
    reverseip: reverseIp,
    proxylist: proxyList,
    classc: classC
  };

  global.IpTools = {
    mountTool: function (cfg, mount) {
      var fn = MAP[cfg.engine] || MAP[cfg.slug];
      if (!fn) return false;
      fn(cfg, mount);
      return true;
    }
  };
})(window);
