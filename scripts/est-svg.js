/* est-svg.js — Gráficos SVG simples (strings), sem dependências. Cada função devolve uma string <svg ...>...</svg>. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EstSvg = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function f1(x) { return (Math.round(x * 10) / 10).toString(); }
  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    step *= err >= 7 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1;
    var t = [], v = Math.ceil(lo / step) * step; for (; v <= hi + 1e-9; v += step) t.push(Math.round(v / step) * step);
    return t;
  }
  /* Barras horizontais com barras de erro opcionais. items: [{label, value, lo?, hi?, color?}] ; fmt(v) -> texto */
  function barH(o) {
    var items = o.items, W = o.width || 640, rowH = 26, left = o.left || 190, right = 70, H = items.length * rowH + 34, fmt = o.fmt || String;
    var lo = Math.min(0, Math.min.apply(null, items.map(function (i) { return i.lo !== undefined ? i.lo : i.value; }))),
        hi = Math.max(0, Math.max.apply(null, items.map(function (i) { return i.hi !== undefined ? i.hi : i.value; })));
    if (hi === lo) hi = lo + 1;
    var X = function (v) { return left + (v - lo) / (hi - lo) * (W - left - right); }, x0 = X(0), out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" xmlns="http://www.w3.org/2000/svg" class="chart">');
    out.push('<line x1="' + x0 + '" y1="6" x2="' + x0 + '" y2="' + (H - 24) + '" stroke="#888"/>');
    items.forEach(function (it, i) {
      var y = 10 + i * rowH, xv = X(it.value), c = it.color || '#2a6fb0';
      out.push('<text x="' + (left - 8) + '" y="' + (y + 12) + '" text-anchor="end" font-size="12">' + esc(it.label) + '</text>');
      out.push('<rect x="' + f1(Math.min(x0, xv)) + '" y="' + y + '" width="' + f1(Math.abs(xv - x0)) + '" height="16" fill="' + c + '"/>');
      if (it.lo !== undefined && it.hi !== undefined) {
        out.push('<line x1="' + f1(X(it.lo)) + '" y1="' + (y + 8) + '" x2="' + f1(X(it.hi)) + '" y2="' + (y + 8) + '" stroke="#222" stroke-width="1.5"/>');
        out.push('<line x1="' + f1(X(it.lo)) + '" y1="' + (y + 3) + '" x2="' + f1(X(it.lo)) + '" y2="' + (y + 13) + '" stroke="#222"/><line x1="' + f1(X(it.hi)) + '" y1="' + (y + 3) + '" x2="' + f1(X(it.hi)) + '" y2="' + (y + 13) + '" stroke="#222"/>');
      }
      out.push('<text x="' + f1(Math.max(xv, it.hi !== undefined ? X(it.hi) : xv) + 6) + '" y="' + (y + 12) + '" font-size="11">' + esc(fmt(it.value)) + '</text>');
    });
    out.push('</svg>');
    return out.join('');
  }
  /* Dispersão. points: [{x,y,r}] ; opções: xlabel, ylabel, diag (reta y=x), line {a,b} (y=a+b x) */
  function scatter(o) {
    var P = o.points, W = o.width || 560, H = o.height || 380, L = 52, B = 40, T = 10, Rr = 12, out = [];
    var xs = P.map(function (p) { return p.x; }), ys = P.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var padx = (x1 - x0) * 0.04 || 0.01, pady = (y1 - y0) * 0.04 || 0.01; x0 -= padx; x1 += padx; y0 -= pady; y1 += pady;
    var X = function (v) { return L + (v - x0) / (x1 - x0) * (W - L - Rr); }, Y = function (v) { return H - B - (v - y0) / (y1 - y0) * (H - B - T); };
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" xmlns="http://www.w3.org/2000/svg" class="chart">');
    niceTicks(x0, x1, 6).forEach(function (t) { out.push('<line x1="' + f1(X(t)) + '" y1="' + T + '" x2="' + f1(X(t)) + '" y2="' + (H - B) + '" stroke="#ddd"/><text x="' + f1(X(t)) + '" y="' + (H - B + 14) + '" text-anchor="middle" font-size="10">' + esc(o.fmtX ? o.fmtX(t) : t) + '</text>'); });
    niceTicks(y0, y1, 6).forEach(function (t) { out.push('<line x1="' + L + '" y1="' + f1(Y(t)) + '" x2="' + (W - Rr) + '" y2="' + f1(Y(t)) + '" stroke="#ddd"/><text x="' + (L - 4) + '" y="' + f1(Y(t) + 3) + '" text-anchor="end" font-size="10">' + esc(o.fmtY ? o.fmtY(t) : t) + '</text>'); });
    if (x0 < 0 && x1 > 0) out.push('<line x1="' + f1(X(0)) + '" y1="' + T + '" x2="' + f1(X(0)) + '" y2="' + (H - B) + '" stroke="#555"/>');
    if (y0 < 0 && y1 > 0) out.push('<line x1="' + L + '" y1="' + f1(Y(0)) + '" x2="' + (W - Rr) + '" y2="' + f1(Y(0)) + '" stroke="#555"/>');
    if (o.diag) out.push('<line x1="' + f1(X(Math.max(x0, y0))) + '" y1="' + f1(Y(Math.max(x0, y0))) + '" x2="' + f1(X(Math.min(x1, y1))) + '" y2="' + f1(Y(Math.min(x1, y1))) + '" stroke="#c33" stroke-dasharray="5 4"/>');
    P.forEach(function (p) { out.push('<circle cx="' + f1(X(p.x)) + '" cy="' + f1(Y(p.y)) + '" r="' + f1(p.r || 2) + '" fill="#2a6fb0" fill-opacity="0.35"/>'); });
    if (o.line) out.push('<line x1="' + f1(X(x0)) + '" y1="' + f1(Y(o.line.a + o.line.b * x0)) + '" x2="' + f1(X(x1)) + '" y2="' + f1(Y(o.line.a + o.line.b * x1)) + '" stroke="#e08a00" stroke-width="2"/>');
    out.push('<text x="' + ((L + W) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11">' + esc(o.xlabel || '') + '</text>');
    out.push('<text transform="rotate(-90 12 ' + ((H - B) / 2) + ')" x="12" y="' + ((H - B) / 2) + '" text-anchor="middle" font-size="11">' + esc(o.ylabel || '') + '</text>');
    out.push('</svg>');
    return out.join('');
  }
  /* Linha com pontos (dose-resposta). points: [{x,y}] */
  function linePoints(o) {
    var P = o.points, pts = P.map(function (p) { return { x: p.x, y: p.y, r: 4 }; });
    var s = scatter({ points: pts, width: o.width, height: o.height, xlabel: o.xlabel, ylabel: o.ylabel, fmtX: o.fmtX, fmtY: o.fmtY, line: o.line });
    return s;
  }
  return { esc: esc, barH: barH, scatter: scatter, linePoints: linePoints };
});
