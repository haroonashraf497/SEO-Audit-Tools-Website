/* Calculators, unit converters, HTML/XML/PHP formatters + HTML editor/viewer */
(function (global) {
  'use strict';
  var esc = (global.SEO && global.SEO.esc) || function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  function panel(label, value) { return (global.SEO && global.SEO.outputPanel) ? global.SEO.outputPanel(label, value) : '<pre class="output-pre">' + esc(value) + '</pre>'; }
  function money(n) { return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(n, d) { d = d == null ? 4 : d; return Number(n).toLocaleString(undefined, { maximumFractionDigits: d }); }
  function stat(label, value, tone) { return '<div class="te-stat' + (tone ? ' ' + tone : '') + '"><p>' + esc(label) + '</p><b>' + value + '</b></div>'; }
  function field(label, inner, hint) { return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + (hint ? '<span class="field-hint">' + esc(hint) + '</span>' : '') + inner + '</label>'; }
  function inp(cls, extra) { return '<input type="number" class="input ' + cls + '" ' + (extra || '') + '>'; }
  function sel(cls, opts) {
    return '<select class="select ' + cls + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function pills(name, items, active) {
    return '<div class="te-row">' + items.map(function (it) {
      return '<button type="button" class="pill' + (it[0] === active ? ' on' : '') + '" data-pill="' + name + '" data-v="' + esc(it[0]) + '">' + esc(it[1]) + '</button>';
    }).join('') + '</div>';
  }
  function bindPills(root, name, on) {
    root.querySelectorAll('[data-pill="' + name + '"]').forEach(function (b) {
      b.addEventListener('click', function () { on(b.getAttribute('data-v')); });
    });
  }
  function live(root, run) { root.querySelectorAll('input,select,textarea').forEach(function (el) { el.addEventListener('input', run); el.addEventListener('change', run); }); run(); }

  /* ---- Age ---- */
  function age(cfg, mount) {
    mount.innerHTML = '<div class="te">' + field('Date of birth', '<input type="date" class="input a-birth" value="1995-06-15">') + '<div class="a-out"></div></div>';
    live(mount, function () {
      var birth = mount.querySelector('.a-birth').value, out = mount.querySelector('.a-out');
      if (!birth) { out.innerHTML = ''; return; }
      var bd = new Date(birth + 'T00:00:00'); if (isNaN(bd.getTime())) { out.innerHTML = ''; return; }
      var now = new Date(), y = now.getFullYear() - bd.getFullYear(), m = now.getMonth() - bd.getMonth(), d = now.getDate() - bd.getDate();
      if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
      if (m < 0) { y--; m += 12; }
      var totalDays = Math.floor((now.getTime() - bd.getTime()) / 86400000);
      var next = new Date(now); next.setMonth(bd.getMonth(), bd.getDate());
      if (next <= now) next.setFullYear(now.getFullYear() + 1);
      var until = Math.ceil((next.getTime() - now.getTime()) / 86400000);
      out.innerHTML = '<div class="hero-grad text-center"><p style="font-size:2rem;font-weight:800">' + y + ' years, ' + m + ' months, ' + d + ' days</p><p style="opacity:.85;font-size:.9rem;margin-top:.35rem">Your exact age today</p></div>' +
        '<div class="grid grid-3">' + stat('Total days alive', totalDays.toLocaleString()) + stat('Total weeks', Math.floor(totalDays / 7).toLocaleString()) + stat('Days until next birthday', String(until)) + '</div>';
    });
  }

  /* ---- Average ---- */
  function avg(cfg, mount) {
    mount.innerHTML = '<div class="te">' + field('Enter numbers (comma, space or newline separated)', '<textarea class="textarea a-in" rows="4">10, 20, 30, 40, 50</textarea>') + '<div class="a-out"></div></div>';
    live(mount, function () {
      var nums = mount.querySelector('.a-in').value.split(/[,;\s]+/).map(Number).filter(function (n) { return !isNaN(n); });
      var out = mount.querySelector('.a-out');
      if (!nums.length) { out.innerHTML = ''; return; }
      var sorted = nums.slice().sort(function (a, b) { return a - b; });
      var sum = nums.reduce(function (a, b) { return a + b; }, 0);
      var mean = sum / nums.length;
      var median = nums.length % 2 === 0 ? (sorted[nums.length / 2 - 1] + sorted[nums.length / 2]) / 2 : sorted[Math.floor(nums.length / 2)];
      var freq = {}; nums.forEach(function (n) { freq[n] = (freq[n] || 0) + 1; });
      var mx = Math.max.apply(null, Object.keys(freq).map(function (k) { return freq[k]; }));
      var mode = Object.keys(freq).filter(function (k) { return freq[k] === mx; }).join(', ');
      out.innerHTML = '<div class="grid grid-4">' + stat('Mean (average)', mean.toFixed(4), 'good') + stat('Median', String(median)) + stat('Mode', mode || 'None') + stat('Range', sorted[0] + ' – ' + sorted[sorted.length - 1]) + '</div>';
    });
  }

  /* ---- CI ---- */
  function ci(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="grid grid-4">' +
      field('Sample mean', inp('c-mean', 'value="50"')) + field('Standard deviation', inp('c-sd', 'value="10"')) +
      field('Sample size (n)', inp('c-n', 'value="100" min="1"')) +
      field('Confidence level (%)', sel('c-ci', [['90', '90% (z = 1.645)'], ['95', '95% (z = 1.96)'], ['99', '99% (z = 2.576)']])) +
      '</div><div class="c-out"></div></div>';
    mount.querySelector('.c-ci').value = '95';
    live(mount, function () {
      var m = Number(mount.querySelector('.c-mean').value), s = Number(mount.querySelector('.c-sd').value), sz = Number(mount.querySelector('.c-n').value), level = mount.querySelector('.c-ci').value;
      var out = mount.querySelector('.c-out');
      if (isNaN(m) || isNaN(s) || isNaN(sz) || sz <= 0) { out.innerHTML = ''; return; }
      var z = { '90': 1.645, '95': 1.96, '99': 2.576 }[level] || 1.96;
      var se = s / Math.sqrt(sz), moe = z * se;
      out.innerHTML = '<div class="grid grid-4">' + stat('Confidence interval', (m - moe).toFixed(4) + ' – ' + (m + moe).toFixed(4), 'good') + stat('Margin of error', moe.toFixed(4)) + stat('Standard error', se.toFixed(4)) + stat('Z-score used', String(z)) + '</div>';
    });
  }

  /* ---- GST / Tax (shared) ---- */
  function taxLike(kind) {
    return function (cfg, mount) {
      var rateDef = kind === 'gst' ? '10' : '8.5';
      var rateLab = kind === 'gst' ? 'GST / VAT rate (%)' : 'Tax rate (%)';
      mount.innerHTML = '<div class="te"><div class="grid grid-3">' +
        field('Amount ($)', inp('g-amt', 'value="100" min="0" step="0.01"')) + field(rateLab, inp('g-rate', 'value="' + rateDef + '" min="0" step="0.1"')) +
        '<div><span class="field-label">Mode</span><div class="g-mode">' + pills('mode', [['add', kind === 'gst' ? 'Add GST' : 'Add tax'], ['extract', kind === 'gst' ? 'Extract GST' : 'Extract from total']], 'add') + '</div></div></div><div class="g-out"></div></div>';
      var mode = 'add';
      function render() {
        bindPills(mount, 'mode', function (v) { mode = v; drawPills(); run(); });
      }
      function drawPills() { mount.querySelector('.g-mode').innerHTML = pills('mode', [['add', kind === 'gst' ? 'Add GST' : 'Add tax'], ['extract', kind === 'gst' ? 'Extract GST' : 'Extract from total']], mode); render(); }
      function run() {
        var a = Number(mount.querySelector('.g-amt').value), r = Number(mount.querySelector('.g-rate').value) / 100;
        var out = mount.querySelector('.g-out');
        if (isNaN(a) || isNaN(r)) { out.innerHTML = ''; return; }
        var sub, gst, total;
        if (mode === 'add') { gst = a * r; sub = a; total = a + gst; }
        else { total = a; sub = a / (1 + r); gst = a - sub; }
        var l1 = mode === 'add' ? (kind === 'gst' ? 'Original amount' : 'Base price') : (kind === 'gst' ? 'Final amount' : 'Tax-free price');
        var l3 = mode === 'add' ? (kind === 'gst' ? 'Total payable' : 'Total') : (kind === 'gst' ? 'Tax removed' : 'Total');
        out.innerHTML = '<div class="grid grid-3">' + stat(l1, money(kind === 'gst' && mode === 'extract' ? total : sub)) + stat(kind === 'gst' ? 'GST / VAT' : 'Sales tax', money(gst), 'good') + stat(l3, money(kind === 'gst' && mode === 'extract' ? sub : total), 'good') + '</div>';
        /* match React GST extract labels: subtotal/gst/total with swapped captions */
        if (kind === 'gst') {
          out.innerHTML = '<div class="grid grid-3">' +
            stat(mode === 'add' ? 'Original amount' : 'Final amount', money(sub)) +
            stat('GST / VAT', money(gst), 'good') +
            stat(mode === 'add' ? 'Total payable' : 'Tax removed', money(total), 'good') + '</div>';
        }
      }
      live(mount, run); render();
    };
  }

  /* ---- Margin ---- */
  function margin(cfg, mount) {
    var mode = 'cost';
    function html() {
      mount.innerHTML = '<div class="te"><div class="grid grid-2">' +
        field('Mode', sel('m-mode', [['cost', 'I know cost & selling price'], ['revenue', 'I know cost & desired margin']])) +
        '<div class="grid grid-2">' + field(mode === 'cost' ? 'Selling price ($)' : 'Cost ($)', inp('m-a', 'min="0" step="0.01"')) +
        field(mode === 'cost' ? 'Cost ($)' : 'Desired margin (%)', inp('m-b', 'min="0" step="0.01"')) + '</div></div><div class="m-out"></div></div>';
      mount.querySelector('.m-mode').value = mode;
      mount.querySelector('.m-mode').addEventListener('change', function () { mode = mount.querySelector('.m-mode').value; html(); });
      live(mount, run);
    }
    function run() {
      var x = Number(mount.querySelector('.m-a').value), y = Number(mount.querySelector('.m-b').value);
      var out = mount.querySelector('.m-out');
      if (isNaN(x) || isNaN(y) || !y) { out.innerHTML = ''; return; }
      var profit, mg, mk, sp, cost;
      if (mode === 'cost') { sp = x; cost = y; profit = sp - cost; mg = sp > 0 ? (profit / sp) * 100 : 0; mk = cost > 0 ? (profit / cost) * 100 : 0; }
      else { cost = x; mk = y; sp = cost * (1 + y / 100); profit = cost * (y / 100); mg = (profit / sp) * 100; }
      out.innerHTML = '<div class="grid grid-4">' + stat('Margin %', mg.toFixed(2) + '%', 'good') + stat('Mark-up %', mk.toFixed(2) + '%', 'good') + stat('Profit per unit', money(profit)) + stat('Selling price', money(sp)) + '</div>';
    }
    html();
  }

  /* ---- Percentage ---- */
  function pct(cfg, mount) {
    var mode = 'of';
    function html() {
      mount.innerHTML = '<div class="te">' + field('Mode', sel('p-mode', [['of', 'What is X% of Y?'], ['change', 'Percentage change from X to Y'], ['from', 'Percentage increase from X to Y']])) +
        '<div class="grid grid-2">' + field(mode === 'of' ? 'Percentage (X%)' : 'Original value (X)', inp('p-x')) + field(mode === 'of' ? 'Of value (Y)' : 'New value (Y)', inp('p-y')) + '</div><div class="p-out"></div></div>';
      mount.querySelector('.p-mode').value = mode;
      mount.querySelector('.p-mode').addEventListener('change', function () { mode = mount.querySelector('.p-mode').value; html(); });
      live(mount, run);
    }
    function run() {
      var a = Number(mount.querySelector('.p-x').value), b = Number(mount.querySelector('.p-y').value);
      var out = mount.querySelector('.p-out');
      if (isNaN(a) || isNaN(b) || !b) { out.innerHTML = ''; return; }
      var r, lab;
      if (mode === 'of') { r = (a / 100) * b; lab = a + '% of ' + b; }
      else { r = ((b - a) / a) * 100; lab = mode === 'change' ? ('From ' + a + ' to ' + b) : ('Increase from ' + a + ' to ' + b + ' is…'); }
      out.innerHTML = stat(lab, r.toFixed(4) + '%', 'good');
    }
    html();
  }

  /* ---- Probability ---- */
  function prob(cfg, mount) {
    var op = 'and';
    mount.innerHTML = '<div class="te"><div class="grid grid-3">' +
      field('Probability of A', inp('pr-a', 'min="0" max="1" step="0.01" placeholder="0 – 1"')) +
      field('Probability of B', inp('pr-b', 'min="0" max="1" step="0.01" placeholder="0 – 1"')) +
      '<div><span class="field-label">Event type</span><div class="pr-op">' + pills('op', [['and', 'Both (A ∩ B)'], ['or', 'Either (A ∪ B)']], 'and') + '</div></div></div><div class="pr-out"></div></div>';
    function wire() {
      bindPills(mount, 'op', function (v) { op = v; mount.querySelector('.pr-op').innerHTML = pills('op', [['and', 'Both (A ∩ B)'], ['or', 'Either (A ∪ B)']], op); wire(); run(); });
    }
    function run() {
      var pA = Number(mount.querySelector('.pr-a').value), pB = Number(mount.querySelector('.pr-b').value);
      var out = mount.querySelector('.pr-out');
      if (isNaN(pA) || isNaN(pB)) { out.innerHTML = ''; return; }
      var p = op === 'and' ? pA * pB : pA + pB - pA * pB;
      out.innerHTML = stat('P(A ' + (op === 'and' ? '∩' : '∪') + ' B)', p.toFixed(6) + '  (' + (p * 100).toFixed(2) + '%)', 'good');
    }
    live(mount, run); wire();
  }

  /* ---- LTV ---- */
  function ltv(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="grid grid-3">' +
      field('Average order value ($)', inp('l-aov', 'min="0" step="0.01"')) +
      field('Purchases per month', inp('l-freq', 'min="0" step="0.1"')) +
      field('Customer lifespan (months)', inp('l-life', 'min="1"')) +
      '</div><div class="l-out"></div></div>';
    live(mount, function () {
      var a = Number(mount.querySelector('.l-aov').value), f = Number(mount.querySelector('.l-freq').value), l = Number(mount.querySelector('.l-life').value);
      var out = mount.querySelector('.l-out');
      if (isNaN(a) || isNaN(f) || isNaN(l)) { out.innerHTML = ''; return; }
      var annual = a * f * 12;
      out.innerHTML = '<div class="grid grid-4">' + stat('LTV', money(annual * l), 'good') + stat('Monthly value', money(a * f)) + stat('Annual value', money(annual)) + stat('Lifespan', l + ' months') + '</div>';
    });
  }

  /* ---- Discount ---- */
  function discount(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="grid grid-3">' +
      field('Original price ($)', inp('d-p', 'value="100" min="0" step="0.01"')) +
      field('Discount amount ($)', inp('d-a', 'min="0" step="0.01"')) +
      field('Discount (%)', inp('d-pct', 'min="0" max="100" step="0.1"')) +
      '</div><div class="d-out"></div></div>';
    live(mount, function () {
      var p = Number(mount.querySelector('.d-p').value), a = Number(mount.querySelector('.d-a').value), pc = Number(mount.querySelector('.d-pct').value);
      var out = mount.querySelector('.d-out');
      if (isNaN(p) || p <= 0) { out.innerHTML = ''; return; }
      var disc = a ? a : pc ? p * (pc / 100) : 0;
      out.innerHTML = '<div class="grid grid-3">' + stat('Sale price', money(p - disc), 'good') + stat('You save', money(disc) + ' (' + (p > 0 ? (disc / p) * 100 : 0).toFixed(1) + '%)', 'good') + stat('Original', money(p)) + '</div>';
    });
  }

  /* ---- CPM ---- */
  function cpm(cfg, mount) {
    var mode = 'cpm';
    function html() {
      mount.innerHTML = '<div class="te">' + field('Mode', sel('cpm-mode', [['cpm', 'I know CPM & impressions'], ['rev', 'I know revenue & impressions']])) +
        '<div class="grid grid-2">' + field(mode === 'cpm' ? 'CPM ($ per 1K views)' : 'Revenue ($)', inp('cpm-v1', 'value="5" min="0" step="0.01"')) +
        field('Daily impressions', inp('cpm-v2', 'value="10000" min="1"')) + '</div><div class="cpm-out"></div></div>';
      mount.querySelector('.cpm-mode').value = mode;
      mount.querySelector('.cpm-mode').addEventListener('change', function () { mode = mount.querySelector('.cpm-mode').value; html(); });
      live(mount, run);
    }
    function run() {
      var a = Number(mount.querySelector('.cpm-v1').value), b = Number(mount.querySelector('.cpm-v2').value);
      var out = mount.querySelector('.cpm-out');
      if (isNaN(a) || isNaN(b) || !b) { out.innerHTML = ''; return; }
      var daily = mode === 'cpm' ? b * (a / 1000) : a;
      out.innerHTML = '<div class="grid grid-3">' + stat('Daily revenue', money(daily), 'good') + stat('Monthly revenue', money(daily * 30), 'good') + stat('Revenue per 1K views', money((daily / b) * 1000)) + '</div>';
    }
    html();
  }

  /* ---- PayPal ---- */
  function paypal(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="grid grid-3">' +
      field('Transaction amount ($)', inp('pp-a', 'value="100" min="0" step="0.01"')) +
      field('Payment type', sel('pp-t', [['standard', 'Standard (2.9% + $0.30)'], ['advanced', 'Advanced (2.5% + $0.30)'], ['invoice', 'Invoice (3.4% + $0.30)']])) +
      '<label class="flex" style="padding-top:1.6rem"><input type="checkbox" class="pp-int"> International (+1.5% + $0.30)</label>' +
      '</div><div class="pp-out"></div></div>';
    live(mount, function () {
      var a = Number(mount.querySelector('.pp-a').value), type = mount.querySelector('.pp-t').value, isInt = mount.querySelector('.pp-int').checked;
      var out = mount.querySelector('.pp-out');
      if (isNaN(a) || a <= 0) { out.innerHTML = ''; return; }
      var fee = type === 'advanced' ? 0.025 : type === 'invoice' ? 0.034 : 0.029, fixed = 0.30;
      if (isInt) { fee += 0.015; fixed += 0.30; }
      var totalFee = a * fee + fixed;
      out.innerHTML = '<div class="grid grid-3">' + stat('Total transaction', money(a)) + stat('PayPal fee', money(totalFee) + ' (' + ((totalFee / a) * 100).toFixed(2) + '%)', 'good') + stat('You receive', money(a - totalFee), 'good') + '</div>';
    });
  }

  /* ---- EPS ---- */
  function eps(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="grid grid-3">' +
      field('Net income ($)', inp('e-i', 'value="1000000" min="0"')) +
      field('Preferred dividends ($)', inp('e-d', 'value="100000" min="0"')) +
      field('Weighted average shares', inp('e-s', 'value="500000" min="1"')) +
      field('Diluted shares (optional)', inp('e-dil'), 'Leave blank to skip') +
      '</div><div class="e-out"></div></div>';
    live(mount, function () {
      var ni = Number(mount.querySelector('.e-i').value), d = Number(mount.querySelector('.e-d').value), s = Number(mount.querySelector('.e-s').value), dil = mount.querySelector('.e-dil').value;
      var out = mount.querySelector('.e-out');
      if (isNaN(ni) || isNaN(d) || isNaN(s) || !s) { out.innerHTML = ''; return; }
      var basic = (ni - d) / s, extra = dil ? stat('Diluted EPS', '$' + ((ni - d) / Number(dil)).toFixed(4), 'good') : '';
      out.innerHTML = '<div class="grid grid-3">' + stat('Basic EPS', '$' + basic.toFixed(4), 'good') + extra + stat('Earnings available', money(ni - d)) + '</div>';
    });
  }

  /* ---- BMI ---- */
  function bmi(cfg, mount) {
    var unit = 'metric';
    function html() {
      var fields = unit === 'metric'
        ? '<div class="grid grid-2">' + field('Weight (kg)', inp('b-w', 'min="0" step="0.1"')) + field('Height (cm)', inp('b-h', 'min="1" step="0.1"')) + '</div>'
        : '<div class="grid grid-3">' + field('Weight (lbs)', inp('b-w', 'min="0" step="0.1"')) + field('Feet', inp('b-ft', 'min="1"')) + field('Inches', inp('b-in', 'min="0"')) + '</div>';
      mount.innerHTML = '<div class="te"><div class="b-unit">' + pills('unit', [['metric', 'Metric'], ['imperial', 'Imperial']], unit) + '</div>' + fields + '<div class="b-out"></div></div>';
      bindPills(mount, 'unit', function (v) { unit = v; html(); });
      live(mount, run);
    }
    function run() {
      var out = mount.querySelector('.b-out'), bmiV, cat, wlab, hlab;
      if (unit === 'metric') {
        var w = Number(mount.querySelector('.b-w').value), h = Number(mount.querySelector('.b-h').value); if (!w || !h) { out.innerHTML = ''; return; }
        bmiV = w / Math.pow(h / 100, 2); wlab = w + ' kg'; hlab = h + ' cm';
      } else {
        var w2 = Number(mount.querySelector('.b-w').value), ft = Number(mount.querySelector('.b-ft').value), inc = Number(mount.querySelector('.b-in').value) || 0;
        var totalIn = ft * 12 + inc; if (!w2 || !totalIn) { out.innerHTML = ''; return; }
        bmiV = (w2 / (totalIn * totalIn)) * 703; wlab = w2 + ' lbs'; hlab = ft + 'ft ' + inc + 'in';
      }
      cat = bmiV < 18.5 ? 'Underweight' : bmiV < 25 ? 'Normal weight' : bmiV < 30 ? 'Overweight' : 'Obese';
      out.innerHTML = '<div class="grid grid-3"><div class="hero-grad"><p style="opacity:.85;font-size:.85rem">Your BMI</p><p style="font-size:2.4rem;font-weight:800">' + bmiV.toFixed(1) + '</p></div>' + stat('Category', cat, 'good') + stat(wlab + ' × ' + hlab, 'Input') + '</div>';
    }
    html();
  }

  /* ---- Converters ---- */
  var LENGTH = [['mm','Millimetres',0.001],['cm','Centimetres',0.01],['m','Metres',1],['km','Kilometres',1000],['in','Inches',0.0254],['ft','Feet',0.3048],['yd','Yards',0.9144],['mi','Miles',1609.344]];
  var PRESSURE = [['Pa','Pascals',1],['kPa','Kilopascals',1000],['bar','Bar',100000],['atm','Atmospheres',101325],['psi','PSI',6894.76],['mmHg','mmHg',133.322],['torr','Torr',133.322]];
  var VOLTAGE = [['V','Volts',1],['mV','Millivolts',0.001],['kV','Kilovolts',1000],['μV','Microvolts',0.000001]];
  var POWER = [['W','Watts',1],['kW','Kilowatts',1000],['hp','Horsepower',745.7],['BTU/h','BTU per hour',0.293071]];
  var SPEED = [['km/h','Kilometres per hour',1],['mph','Miles per hour',1.609344],['m/s','Metres per second',3.6],['kn','Knots',1.852],['ft/s','Feet per second',1.09728]];
  var AREA = [['mm²','Square mm',0.000001],['cm²','Square cm',0.0001],['m²','Square metres',1],['km²','Square km',1000000],['ft²','Square feet',0.092903],['yd²','Square yards',0.836127],['ac','Acres',4046.86],['ha','Hectares',10000]];
  var WEIGHT = [['mg','Milligrams',0.001],['g','Grams',1],['kg','Kilograms',1000],['lb','Pounds',453.592],['oz','Ounces',28.3495],['st','Stones',6350.29]];
  var ALL = { length: LENGTH, pressure: PRESSURE, voltage: VOLTAGE, power: POWER, speed: SPEED, area: AREA, weight: WEIGHT };
  var TZ = [
    ['Pacific/Auckland','New Zealand',12],['Australia/Sydney','Australia',10],['Asia/Tokyo','Japan',9],['Asia/Shanghai','China',8],['Asia/Singapore','Singapore',8],
    ['Asia/Kolkata','India',5.5],['Asia/Dubai','Dubai',4],['Europe/Moscow','Moscow',3],['Europe/Istanbul','Istanbul',3],['Europe/London','London (GMT)',0],
    ['Europe/Paris','Paris / Berlin',1],['Africa/Cairo','Cairo',2],['America/New_York','New York (ET)',-5],['America/Chicago','Chicago (CT)',-6],
    ['America/Denver','Denver (MT)',-7],['America/Los_Angeles','Los Angeles (PT)',-8],['Pacific/Honolulu','Hawaii',-10]
  ];

  function unitTable(units, mount, extraTop) {
    function opts(selV) {
      return units.map(function (u) { return '<option value="' + esc(u[0]) + '"' + (u[0] === selV ? ' selected' : '') + '>' + esc(u[1]) + ' (' + esc(u[0]) + ')</option>'; }).join('');
    }
    mount.innerHTML = (extraTop || '') + '<div class="te"><div class="grid grid-2">' +
      '<div>' + field('From', '<select class="select u-from">' + opts(units[0][0]) + '</select>') + '<input type="number" class="input u-val" value="1" placeholder="Enter value"></div>' +
      '<div>' + field('To', '<select class="select u-to">' + opts(units[1] ? units[1][0] : units[0][0]) + '</select>') + '<div class="u-res"></div></div></div><div class="u-all"></div></div>';
    live(mount, function () {
      var v = Number(mount.querySelector('.u-val').value);
      var from = units.find(function (u) { return u[0] === mount.querySelector('.u-from').value; });
      var to = units.find(function (u) { return u[0] === mount.querySelector('.u-to').value; });
      if (isNaN(v) || !from || !to) return;
      var converted = (v * from[2]) / to[2];
      var factor = from[2] / to[2];
      var pretty = converted.toPrecision(8).replace(/\.?0+$/, '');
      mount.querySelector('.u-res').innerHTML = stat('Result in ' + to[0], pretty, 'good');
      mount.querySelector('.u-all').innerHTML = '<div class="card"><p class="small muted">1 ' + esc(from[0]) + ' = ' + factor.toPrecision(6) + ' ' + esc(to[0]) + '</p><div class="te-row mt-2">' +
        units.map(function (u) { return '<span class="pill">' + esc(u[0]) + ': ' + ((v * from[2]) / u[2]).toPrecision(4) + '</span>'; }).join('') + '</div></div>';
    });
  }
  function convFixed(units) { return function (cfg, mount) { unitTable(units, mount); }; }
  function convUnit(cfg, mount) {
    var cat = 'length';
    function draw() {
      var keys = Object.keys(ALL);
      var top = '<div class="te-row mb-4">' + keys.map(function (k) { return '<button type="button" class="pill' + (k === cat ? ' on' : '') + '" data-cat="' + k + '">' + k + '</button>'; }).join('') + '</div>';
      unitTable(ALL[cat], mount, top);
      mount.querySelectorAll('[data-cat]').forEach(function (b) { b.addEventListener('click', function () { cat = b.getAttribute('data-cat'); draw(); }); });
    }
    draw();
  }
  function tempToC(v, u) { if (u === 'C') return v; if (u === 'F') return (v - 32) * 5 / 9; return v - 273.15; }
  function tempFromC(c, u) { if (u === 'C') return c; if (u === 'F') return c * 9 / 5 + 32; return c + 273.15; }
  function convTemp(cfg, mount) {
    mount.innerHTML = '<div class="te"><div class="grid grid-2">' +
      '<div>' + field('From', sel('t-from', [['C', 'Celsius (C°)'], ['F', 'Fahrenheit (F°)'], ['K', 'Kelvin (K°)']])) + '<input type="number" class="input t-val" value="100"></div>' +
      '<div class="t-out"></div></div>' +
      '<div class="card grid grid-3 text-center"><div><p class="small muted">Freezing point of water</p><b>0°C / 32°F / 273K</b></div><div><p class="small muted">Boiling point of water</p><b>100°C / 212°F / 373K</b></div><div><p class="small muted">Body temperature</p><b>37°C / 98.6°F / 310K</b></div></div></div>';
    live(mount, function () {
      var from = mount.querySelector('.t-from').value, v = Number(mount.querySelector('.t-val').value) || 0;
      var c = tempToC(v, from);
      mount.querySelector('.t-out').innerHTML = ['C', 'F', 'K'].filter(function (u) { return u !== from; }).map(function (u) {
        var name = u === 'C' ? 'Celsius' : u === 'F' ? 'Fahrenheit' : 'Kelvin';
        return stat(name + ' (' + u + '°)', tempFromC(c, u).toFixed(2) + '°', 'good');
      }).join('');
    });
  }
  function convTz(cfg, mount) {
    var today = new Date().toISOString().slice(0, 10);
    var opts = TZ.map(function (z) { return [z[0], z[1] + ' (UTC' + (z[2] >= 0 ? '+' : '') + z[2] + ')']; });
    mount.innerHTML = '<div class="te"><div class="grid grid-2">' +
      '<div>' + field('From timezone', sel('tz-from', opts)) + field('Time', '<input type="time" class="input tz-time" value="12:00">') + field('Date', '<input type="date" class="input tz-date" value="' + today + '">') + '</div>' +
      '<div>' + field('To timezone', sel('tz-to', opts)) + '</div></div><div class="tz-out"></div></div>';
    mount.querySelector('.tz-from').value = 'Europe/London';
    mount.querySelector('.tz-to').value = 'America/New_York';
    live(mount, function () {
      var from = TZ.find(function (z) { return z[0] === mount.querySelector('.tz-from').value; });
      var to = TZ.find(function (z) { return z[0] === mount.querySelector('.tz-to').value; });
      if (!from || !to) return;
      var d = new Date(mount.querySelector('.tz-date').value + 'T' + mount.querySelector('.tz-time').value + ':00');
      var utc = d.getTime() - from[2] * 3600000;
      var dest = new Date(utc + to[2] * 3600000);
      var fmt = function (dt, id) { try { return dt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: id }); } catch (e) { return dt.toUTCString(); } };
      var diff = to[2] - from[2];
      mount.querySelector('.tz-out').innerHTML = '<div class="hero-grad"><p style="opacity:.85;font-size:.85rem">From ' + esc(from[1]) + '</p><p style="font-size:1.4rem;font-weight:800">' + esc(fmt(d, from[0])) + '</p><p style="margin:.5rem 0;opacity:.85">↓ ' + (diff >= 0 ? '+' : '') + diff + ' hours</p><p style="opacity:.85;font-size:.85rem">To ' + esc(to[1]) + '</p><p style="font-size:1.4rem;font-weight:800">' + esc(fmt(dest, to[0])) + '</p></div>';
    });
  }

  /* ---- Code formatters ---- */
  var VOID_TAGS = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, param:1, source:1, track:1, wbr:1, '!doctype':1 };
  var SAMPLE_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sample</title><link rel="stylesheet" href="style.css"></head><body><header class="site"><h1>Hello <span>World</span></h1><nav><ul><li><a href="/">Home</a></li><li><a href="/about">About</a></li></ul></nav></header><main><p>This is a <strong>sample</strong> paragraph.</p><img src="a.jpg" alt="A"></main></body></html>';
  var SAMPLE_XML = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc><lastmod>2025-01-01</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url><url><loc>https://example.com/about</loc><priority>0.8</priority></url></urlset>';
  var SAMPLE_PHP = '<?php\nfunction greet($name){if($name==""){return "Hello, guest";}else{$msg="Hello, ".$name;return $msg;}}\nforeach($users as $k=>$u){echo greet($u["name"]);}\nclass Cart{private $items=[];public function add($item,$qty=1){$this->items[]=["item"=>$item,"qty"=>$qty];return $this;}}';
  var TEMPLATES = {
    blank: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>My Page</title>\n  <style>\n    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1e293b; }\n  </style>\n</head>\n<body>\n  <h1>Hello, world!</h1>\n  <p>Start editing to see changes instantly.</p>\n</body>\n</html>',
    landing: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Landing Page</title>\n  <style>\n    * { box-sizing: border-box; } body { margin: 0; font-family: system-ui, sans-serif; }\n    .hero { background: linear-gradient(135deg,#6366f1,#a855f7); color: #fff; padding: 4rem 1.5rem; text-align: center; }\n    .hero h1 { font-size: 2.5rem; margin: 0 0 .5rem; } .btn { display: inline-block; margin-top: 1.5rem; background: #fff; color: #4f46e5; padding: .8rem 1.6rem; border-radius: .6rem; font-weight: 700; text-decoration: none; }\n    .features { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 1rem; padding: 2rem 1.5rem; max-width: 960px; margin: auto; }\n    .card { border: 1px solid #e2e8f0; border-radius: .8rem; padding: 1.2rem; }\n  </style>\n</head>\n<body>\n  <section class="hero"><h1>Launch faster</h1><p>A tiny landing page template.</p><a class="btn" href="#">Get started</a></section>\n  <section class="features"><div class="card"><h3>Fast</h3><p>Zero dependencies.</p></div><div class="card"><h3>Simple</h3><p>Edit and preview live.</p></div><div class="card"><h3>Responsive</h3><p>Works on any screen.</p></div></section>\n</body>\n</html>',
    form: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Contact Form</title>\n  <style>\n    body { font-family: system-ui, sans-serif; background: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; }\n    form { background: #fff; padding: 2rem; border-radius: 1rem; width: min(90vw, 380px); box-shadow: 0 10px 30px rgba(0,0,0,.08); }\n    label { display: block; font-size: .85rem; font-weight: 600; margin: .8rem 0 .3rem; } input, textarea { width: 100%; padding: .7rem; border: 1px solid #cbd5e1; border-radius: .5rem; }\n    button { margin-top: 1rem; width: 100%; padding: .8rem; border: 0; border-radius: .5rem; background: #6366f1; color: #fff; font-weight: 700; }\n  </style>\n</head>\n<body>\n  <form><h2>Contact us</h2><label>Name</label><input placeholder="Jane Doe"><label>Email</label><input type="email" placeholder="jane@example.com"><label>Message</label><textarea rows="4"></textarea><button type="button">Send</button></form>\n</body>\n</html>'
  };

  function formatHtml(src, indent) {
    indent = indent == null ? '  ' : indent;
    var tokens = src.replace(/>\s+</g, '><').match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) || [];
    var depth = 0, out = [], inPre = false;
    for (var i = 0; i < tokens.length; i++) {
      var raw = tokens[i], t = raw.trim(); if (!t) continue;
      if (inPre) { out[out.length - 1] += raw; if (/<\/pre>/i.test(raw)) inPre = false; continue; }
      var isClose = /^<\//.test(t);
      var tagName = (t.match(/^<\/?\s*([a-zA-Z0-9!-]+)/) || [])[1]; tagName = tagName ? tagName.toLowerCase() : '';
      var isVoid = VOID_TAGS[tagName] || /\/>$/.test(t) || t.indexOf('<!') === 0;
      var isComment = t.indexOf('<!--') === 0;
      var isText = t.charAt(0) !== '<';
      if (isClose) depth = Math.max(0, depth - 1);
      if (isText && out.length && /<(a|span|strong|em|b|i|code|label)\b[^>]*>$/i.test(out[out.length - 1])) { out[out.length - 1] += t; continue; }
      out.push(new Array(depth + 1).join(indent) + t);
      if (!isClose && !isVoid && !isComment && !isText) depth++;
      if (/^<pre\b/i.test(t)) inPre = true;
    }
    return out.join('\n').replace(/\n\s*(<\/(a|span|strong|em|b|i|code|label|abbr|sub|sup|mark|time|title|h[1-6]|p|li|td|th|button|option)>)/gi, '$1');
  }
  function formatXml(src, indent) {
    indent = indent == null ? '  ' : indent;
    var error = '';
    try {
      var doc = new DOMParser().parseFromString(src, 'application/xml');
      var pe = doc.querySelector('parsererror');
      if (pe) error = (pe.textContent || 'Invalid XML').replace(/\s+/g, ' ').slice(0, 220);
    } catch (e) { error = 'Could not parse XML'; }
    var tokens = src.replace(/>\s+</g, '><').trim().match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>|[^<]+/g) || [];
    var depth = 0, maxDepth = 0, elements = 0, attrs = 0, out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i].trim(); if (!t) continue;
      var isClose = /^<\//.test(t), isSelf = /\/>$/.test(t) || /^<\?|^<!/.test(t), isText = t.charAt(0) !== '<';
      if (isClose) depth = Math.max(0, depth - 1);
      if (isText && out.length) { out[out.length - 1] += t; continue; }
      out.push(new Array(depth + 1).join(indent) + t);
      if (!isClose && !isSelf) { depth++; elements++; attrs += (t.match(/\s[\w:.-]+=/g) || []).length; maxDepth = Math.max(maxDepth, depth); }
    }
    return { out: out.join('\n'), error: error, elements: elements, attrs: attrs, depth: maxDepth };
  }
  function formatPhp(src, indent) {
    indent = indent == null ? '    ' : indent;
    var lines = src.replace(/\r\n/g, '\n').replace(/\{\s*\n/g, '{\n').replace(/;\s*(?=\S)/g, ';\n').replace(/\}\s*(else|elseif|catch|finally)/g, '}\n$1').split('\n');
    var depth = 0, out = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim(); if (!l) { out.push(''); continue; }
      l = l.replace(/\s*=\s*/g, ' = ').replace(/\s*=>\s*/g, ' => ').replace(/\s*==\s*/g, ' == ').replace(/\s*===\s*/g, ' === ').replace(/\s*!=\s*/g, ' != ').replace(/,(?=\S)/g, ', ').replace(/\s*\.\s*=/g, ' .=').replace(/\)\s*\{/g, ') {').replace(/\b(if|for|foreach|while|switch|catch)\(/g, '$1 (').replace(/ = =/g, ' ==').replace(/ = = =/g, ' ===').replace(/! =/g, '!=').replace(/ = >/g, ' =>');
      var closes = (l.match(/^[)}\]]+/) || [''])[0].length; if (closes) depth = Math.max(0, depth - 1);
      if (/^(case\b.*:|default:)/.test(l)) out.push(new Array(Math.max(0, depth - 1) + 1).join(indent) + l); else out.push(new Array(depth + 1).join(indent) + l);
      var opens = (l.match(/[{([]/g) || []).length - (l.match(/[})\]]/g) || []).length + (closes ? 1 : 0) - (l.match(/^[)}\]]+/) ? 0 : 0);
      if (opens > 0) depth += 1; else if (opens < 0 && !closes) depth = Math.max(0, depth - 1);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function toolbar(extra) {
    return '<div class="te-row"><button type="button" class="btn btn-ghost f-sample">Load sample</button><button type="button" class="btn btn-ghost f-clear">Clear</button>' + (extra || '') + '</div>';
  }
  function fmtTool(kind) {
    return function (cfg, mount) {
      var indentDef = kind === 'php' ? '    ' : '  ';
      var extra = '<select class="select f-ind" style="width:auto;margin-left:auto">' +
        (kind === 'php' ? '<option value="    ">4 spaces (PSR-12)</option><option value="  ">2 spaces</option><option value="\t">Tab</option>'
          : '<option value="  ">2 spaces</option><option value="    ">4 spaces</option><option value="\t">Tab</option>') + '</select>';
      mount.innerHTML = '<div class="te">' + toolbar(extra) + '<textarea class="textarea f-src" rows="10" spellcheck="false" placeholder="Paste ' + kind.toUpperCase() + '…"></textarea><div class="f-out"></div></div>';
      mount.querySelector('.f-ind').value = indentDef;
      function run() {
        var src = mount.querySelector('.f-src').value, indent = mount.querySelector('.f-ind').value, out = mount.querySelector('.f-out');
        if (!src.trim()) { out.innerHTML = ''; return; }
        if (kind === 'html') {
          var formatted = formatHtml(src, indent);
          out.innerHTML = '<div class="grid grid-4">' + stat('Input lines', String(src.split('\n').length)) + stat('Output lines', String(formatted.split('\n').length)) + stat('Tags', String((src.match(/<[a-zA-Z]/g) || []).length)) + stat('Size', (new Blob([formatted]).size / 1024).toFixed(1) + ' KB') + '</div>' + panel('Formatted HTML', formatted);
        } else if (kind === 'xml') {
          var r = formatXml(src, indent);
          out.innerHTML = '<div class="' + (r.error ? 'error-box' : 'ok-box') + '">' + (r.error ? '✗ Invalid XML: ' + esc(r.error) : '✓ Well-formed XML') + '</div>' +
            '<div class="grid grid-4">' + stat('Elements', String(r.elements)) + stat('Attributes', String(r.attrs)) + stat('Max depth', String(r.depth)) + stat('Size', (new Blob([r.out]).size / 1024).toFixed(1) + ' KB') + '</div>' + panel('Formatted XML', r.out);
        } else {
          var php = formatPhp(src, indent);
          out.innerHTML = '<div class="grid grid-4">' + stat('Lines', String(php.split('\n').length)) + stat('Functions', String((src.match(/\bfunction\s+\w+/g) || []).length)) + stat('Classes', String((src.match(/\bclass\s+\w+/g) || []).length)) + stat('Variables', String(new Set(src.match(/\$\w+/g) || []).size)) + '</div>' + panel('Formatted PHP', php) + '<p class="small muted">Applies PSR-12-style spacing around operators, one statement per line and brace indentation. Review complex string literals manually.</p>';
        }
      }
      mount.querySelector('.f-sample').addEventListener('click', function () { mount.querySelector('.f-src').value = kind === 'php' ? SAMPLE_PHP : kind === 'xml' ? SAMPLE_XML : SAMPLE_HTML; run(); });
      mount.querySelector('.f-clear').addEventListener('click', function () { mount.querySelector('.f-src').value = ''; run(); });
      live(mount, run);
    };
  }

  function htmlEditor(cfg, mount) {
    var layout = 'split', auto = true, preview = TEMPLATES.blank, code = TEMPLATES.blank;
    function draw() {
      var shown = auto ? code : preview;
      mount.innerHTML = '<div class="te"><div class="te-row">' +
        '<select class="select he-tpl" style="width:auto"><option value="blank">Blank page</option><option value="landing">Landing page</option><option value="form">Contact form</option></select>' +
        '<div class="te-row" style="background:var(--slate-100);border-radius:.6rem;padding:.15rem">' +
        [['split','split'],['code','code'],['preview','preview']].map(function (l) { return '<button type="button" class="pill' + (layout === l[0] ? ' on' : '') + '" data-lay="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
        '<label class="flex"><input type="checkbox" class="he-auto"' + (auto ? ' checked' : '') + '> Auto-run</label>' +
        (auto ? '' : '<button type="button" class="btn btn-primary he-run">▶ Run</button>') +
        '<div class="te-row" style="margin-left:auto"><button type="button" class="btn btn-ghost he-fmt">Format</button><button type="button" class="btn btn-ghost he-copy">Copy</button><button type="button" class="btn btn-dark he-dl">Download .html</button></div></div>' +
        '<div class="grid' + (layout === 'split' ? ' grid-2' : '') + '">' +
        (layout !== 'preview' ? '<textarea class="code-dark he-code" spellcheck="false"></textarea>' : '') +
        (layout !== 'code' ? '<div class="card card-p0"><div class="preview-chrome"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span><span class="small muted" style="margin-left:.5rem">Preview</span></div><iframe title="HTML preview" sandbox="allow-scripts" class="he-frame" style="width:100%;height:488px;border:0;background:#fff"></iframe></div>' : '') +
        '</div><div class="grid grid-4 he-stats"></div></div>';
      var ta = mount.querySelector('.he-code'); if (ta) ta.value = code;
      var frame = mount.querySelector('.he-frame'); if (frame) frame.srcdoc = shown;
      stats();
      mount.querySelector('.he-tpl').addEventListener('change', function (e) { code = preview = TEMPLATES[e.target.value]; draw(); });
      mount.querySelectorAll('[data-lay]').forEach(function (b) { b.addEventListener('click', function () { layout = b.getAttribute('data-lay'); draw(); }); });
      mount.querySelector('.he-auto').addEventListener('change', function (e) { auto = e.target.checked; if (auto) preview = code; draw(); });
      var runBtn = mount.querySelector('.he-run'); if (runBtn) runBtn.addEventListener('click', function () { preview = code; draw(); });
      mount.querySelector('.he-fmt').addEventListener('click', function () { code = formatHtml(code); draw(); });
      mount.querySelector('.he-copy').addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(code); });
      mount.querySelector('.he-dl').addEventListener('click', function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([code], { type: 'text/html' })); a.download = 'index.html'; a.click(); });
      if (ta) ta.addEventListener('input', function () { code = ta.value; if (auto && frame) frame.srcdoc = code; stats(); });
    }
    function stats() {
      var el = mount.querySelector('.he-stats'); if (!el) return;
      el.innerHTML = stat('Lines', String(code.split('\n').length)) + stat('Characters', code.length.toLocaleString()) + stat('Elements', String((code.match(/<[a-zA-Z]/g) || []).length)) + stat('Size', (new Blob([code]).size / 1024).toFixed(1) + ' KB');
    }
    draw();
  }

  function htmlViewer(cfg, mount) {
    mount.innerHTML = '<div class="te">' + toolbar() + '<textarea class="textarea hv-src" rows="8" spellcheck="false" placeholder="Paste HTML code to render it…"></textarea><div class="hv-out"></div></div>';
    function run() {
      var src = mount.querySelector('.hv-src').value, out = mount.querySelector('.hv-out');
      if (!src.trim()) { out.innerHTML = ''; return; }
      var formatted = formatHtml(src);
      var tags = (src.match(/<[a-zA-Z]/g) || []).length, links = (src.match(/<a\s/gi) || []).length, images = (src.match(/<img\s/gi) || []).length, scripts = (src.match(/<script/gi) || []).length;
      var words = src.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
      out.innerHTML = '<div class="grid grid-4">' + stat('Tags', String(tags)) + stat('Links', String(links)) + stat('Images', String(images)) + stat('Scripts', String(scripts), scripts ? 'warn' : '') + stat('Words', String(words)) + '</div>' +
        '<div class="grid grid-2"><div class="card card-p0"><div class="preview-chrome"><span class="small muted">Rendered output (sandboxed, scripts disabled)</span></div><iframe title="Rendered HTML" sandbox="" class="hv-frame" style="width:100%;height:420px;border:0"></iframe></div>' + panel('Formatted source', formatted) + '</div>';
      out.querySelector('.hv-frame').srcdoc = src;
    }
    mount.querySelector('.f-sample').addEventListener('click', function () { mount.querySelector('.hv-src').value = SAMPLE_HTML; run(); });
    mount.querySelector('.f-clear').addEventListener('click', function () { mount.querySelector('.hv-src').value = ''; run(); });
    live(mount, run);
  }

  var MAP = {
    'calc-age': age, 'calc-avg': avg, 'calc-ci': ci, 'calc-gst': taxLike('gst'), 'calc-tax': taxLike('tax'),
    'calc-margin': margin, 'calc-pct': pct, 'calc-prob': prob, 'calc-ltv': ltv, 'calc-discount': discount,
    'calc-cpm': cpm, 'calc-paypal': paypal, 'calc-eps': eps, 'calc-bmi': bmi,
    'conv-unit': convUnit, 'conv-length': convFixed(LENGTH), 'conv-temp': convTemp, 'conv-timezone': convTz,
    'conv-pressure': convFixed(PRESSURE), 'conv-voltage': convFixed(VOLTAGE), 'conv-power': convFixed(POWER),
    'conv-speed': convFixed(SPEED), 'conv-area': convFixed(AREA), 'conv-weight': convFixed(WEIGHT),
    'wm-format-html': fmtTool('html'), 'wm-format-xml': fmtTool('xml'), 'wm-format-php': fmtTool('php'),
    'wm-htmleditor': htmlEditor, 'wm-htmlviewer': htmlViewer
  };

  global.Calculators = {
    mountTool: function (cfg, mount) {
      var fn = MAP[cfg.engine];
      if (!fn) return false;
      fn(cfg, mount);
      return true;
    }
  };
})(window);
