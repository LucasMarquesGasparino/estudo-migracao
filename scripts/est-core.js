/* est-core.js — Núcleo estatístico do estudo 2º turno 2022 -> 1º turno 2026. Puro (sem DOM, sem rede, sem dependências).
 * Funciona no Node e no navegador (window.EstCore). Dados em arrays tipados "planos" (linha i, coluna c = i*C + c).
 *
 * Ferramentas:
 *  - transição ecológica restrita (matriz R x C, linhas somando 1, >= 0) por mínimos quadrados ponderados
 *  - bootstrap por conglomerado (município) via estatísticas suficientes (rápido)
 *  - limites determinísticos de Duncan-Davis
 *  - regressão ponderada com efeitos fixos e erro-padrão robusto por conglomerado (CR1)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EstCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rng(seed) {                      // mulberry32 (determinístico)
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 0; while (u === 0) u = r(); var v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ---------- álgebra mínima ---------- */
  function solveLinear(A, b) {              // Gauss-Jordan com pivô parcial. A: k arrays de k. Devolve x.
    var k = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); }), c, r, j;
    for (c = 0; c < k; c++) {
      var p = c;
      for (r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-300) throw new Error('matriz singular');
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      for (r = 0; r < k; r++) {
        if (r === c) continue;
        var f = M[r][c] / M[c][c];
        if (f) for (j = c; j <= k; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map(function (row, i) { return row[k] / row[i]; });
  }
  function invert(A) {
    var k = A.length, cols = [], j;
    for (j = 0; j < k; j++) { var e = new Array(k).fill(0); e[j] = 1; cols.push(solveLinear(A, e)); }
    return A.map(function (_, i) { return cols.map(function (c) { return c[i]; }); });
  }
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function normCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function quantile(sorted, q) {            // sorted: array ordenado crescente
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function ci(draws, level) {               // intervalo percentil
    var s = draws.slice().sort(function (a, b) { return a - b; }), a = (1 - (level || 0.95)) / 2;
    return { lo: quantile(s, a), hi: quantile(s, 1 - a), median: quantile(s, 0.5) };
  }

  /* ---------- projeção no simplex ---------- */
  function projectSimplex(v) {
    var n = v.length, u = v.slice().sort(function (a, b) { return b - a; }), css = 0, theta = 0, i;
    for (i = 0; i < n; i++) { css += u[i]; var t = (css - 1) / (i + 1); if (u[i] - t > 0) theta = t; }
    var out = new Array(n);
    for (i = 0; i < n; i++) out[i] = Math.max(v[i] - theta, 0);
    return out;
  }

  /* ---------- transição ecológica restrita ----------
   * Modelo: y_i (C partes, soma 1) = x_i (R partes, soma 1) · T + erro,  T (R x C): linhas >= 0 somando 1.
   * Minimiza  soma_i w_i ||y_i - x_i T||^2  (+ ridge mínimo em direção à "independência", só para destravar direções planas).
   * Usa estatísticas suficientes A = soma w x x', B = soma w x' y (por conglomerado) => bootstrap barato. */
  function clusterStats(X, Y, w, cl, K, R, C) {
    var A = new Float64Array(K * R * R), B = new Float64Array(K * R * C), n = w.length, i, r, s, c;
    for (i = 0; i < n; i++) {
      var g = cl[i], wi = w[i], ao = g * R * R, bo = g * R * C;
      for (r = 0; r < R; r++) {
        var xr = X[i * R + r] * wi;
        if (!xr) continue;
        for (s = 0; s < R; s++) A[ao + r * R + s] += xr * X[i * R + s];
        for (c = 0; c < C; c++) B[bo + r * C + c] += xr * Y[i * C + c];
      }
    }
    return { A: A, B: B, K: K, R: R, C: C };
  }
  function sumStats(st, idxs) {
    var R = st.R, C = st.C, A = new Float64Array(R * R), B = new Float64Array(R * C), t, j;
    for (t = 0; t < idxs.length; t++) {
      var g = idxs[t];
      for (j = 0; j < R * R; j++) A[j] += st.A[g * R * R + j];
      for (j = 0; j < R * C; j++) B[j] += st.B[g * R * C + j];
    }
    return { A: A, B: B };
  }
  function independence(A, B, R, C) {
    var tot = 0, r, s, c;
    for (r = 0; r < R; r++) for (s = 0; s < R; s++) tot += A[r * R + s];
    var ybar = new Float64Array(C);
    for (c = 0; c < C; c++) { var t = 0; for (r = 0; r < R; r++) t += B[r * C + c]; ybar[c] = tot > 0 ? t / tot : 1 / C; }
    var T0 = new Float64Array(R * C);
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) T0[r * C + c] = ybar[c];
    return T0;
  }
  function lambdaMax(A, R) {
    var v = new Float64Array(R).fill(1), lam = 0, it, i, j;
    for (it = 0; it < 60; it++) {
      var u = new Float64Array(R), nrm = 0;
      for (i = 0; i < R; i++) for (j = 0; j < R; j++) u[i] += A[i * R + j] * v[j];
      for (i = 0; i < R; i++) nrm += u[i] * u[i];
      nrm = Math.sqrt(nrm); if (nrm === 0) return 0;
      for (i = 0; i < R; i++) v[i] = u[i] / nrm;
      lam = nrm;
    }
    return lam;
  }
  function solveTransition(A, B, R, C, opts) {
    opts = opts || {};
    var iters = opts.iters || 4000, tol = opts.tol || 1e-11, i, j, k, r, c;
    var T0 = independence(A, B, R, C), tr = 0;
    for (r = 0; r < R; r++) tr += A[r * R + r];
    var lam = (opts.ridge === undefined ? 1e-6 : opts.ridge) * tr;
    var step = 1 / (2 * (lambdaMax(A, R) + lam) + 1e-300);
    var T = opts.warm ? Float64Array.from(opts.warm) : Float64Array.from(T0);
    var Z = Float64Array.from(T), t = 1, it;
    var Tn = new Float64Array(R * C), row = new Array(C);
    for (it = 0; it < iters; it++) {
      var maxd = 0;
      for (r = 0; r < R; r++) {
        for (c = 0; c < C; c++) {
          var g = 0;
          for (k = 0; k < R; k++) g += A[r * R + k] * Z[k * C + c];
          g = 2 * (g - B[r * C + c]) + 2 * lam * (Z[r * C + c] - T0[r * C + c]);
          row[c] = Z[r * C + c] - step * g;
        }
        var pr = projectSimplex(row);
        for (c = 0; c < C; c++) { Tn[r * C + c] = pr[c]; var d = Math.abs(pr[c] - T[r * C + c]); if (d > maxd) maxd = d; }
      }
      var tn = (1 + Math.sqrt(1 + 4 * t * t)) / 2, mom = (t - 1) / tn;
      for (j = 0; j < R * C; j++) { Z[j] = Tn[j] + mom * (Tn[j] - T[j]); T[j] = Tn[j]; }
      t = tn;
      if (maxd < tol) break;
    }
    return { T: T, iterations: it };
  }
  /* Bootstrap por conglomerado: sorteia conglomerados com reposição, soma estatísticas, resolve com partida a quente.
   * opts.clusters (opcional): lista de ids de conglomerado a usar (ex.: só os municípios de uma UF). */
  function bootstrapTransition(st, nBoot, seed, opts) {
    var r = rng(seed || 1), list = (opts && opts.clusters) || Array.from({ length: st.K }, function (_, i) { return i; });
    var K = list.length, draws = [], b, t;
    var full = sumStats(st, list);
    var base = solveTransition(full.A, full.B, st.R, st.C, opts).T;
    for (b = 0; b < nBoot; b++) {
      var idxs = new Int32Array(K);
      for (t = 0; t < K; t++) idxs[t] = list[Math.floor(r() * K)];
      var s = sumStats(st, idxs);
      draws.push(solveTransition(s.A, s.B, st.R, st.C, Object.assign({}, opts, { warm: base, iters: 1500 })).T);
    }
    return { base: base, draws: draws };
  }

  /* Transição SEM restrições (OLS por coluna) — só para robustez: mostra o efeito de impor 0<=T<=1 e linhas somando 1. */
  function olsTransition(A, B, R, C) {
    var Am = [], r, s, c, T = new Float64Array(R * C);
    for (r = 0; r < R; r++) { Am.push([]); for (s = 0; s < R; s++) Am[r].push(A[r * R + s] + (r === s ? 1e-9 * A[r * R + r] : 0)); }
    for (c = 0; c < C; c++) {
      var rhs = []; for (r = 0; r < R; r++) rhs.push(B[r * C + c]);
      var x = solveLinear(Am, rhs); for (r = 0; r < R; r++) T[r * C + c] = x[r];
    }
    return T;
  }

  /* Limites determinísticos (Duncan-Davis) para o fluxo origem r -> destino c, em votos (população de destino).
   * X: n*R partes de origem; Y: n*C partes de destino; E: eleitorado de destino por linha. */
  function dunDavis(X, Y, E, R, C, r, c) {
    var cs = Array.isArray(c) ? c : [c], n = E.length, lb = 0, ub = 0, mass = 0, i, j;
    for (i = 0; i < n; i++) {
      var P = X[i * R + r] * E[i], Q = 0;
      for (j = 0; j < cs.length; j++) Q += Y[i * C + cs[j]] * E[i];
      lb += Math.max(0, P + Q - E[i]); ub += Math.min(P, Q); mass += P;
    }
    return { lb: lb, ub: ub, mass: mass, lbShare: mass ? lb / mass : 0, ubShare: mass ? ub / mass : 0 };
  }

  /* ---------- regressão ponderada (WLS) com efeitos fixos e erro-padrão robusto por conglomerado ----------
   * y: Float64Array n; cols: array de k Float64Array (regressores; SEM intercepto, a menos que você inclua uma coluna de 1);
   * w: pesos; fe: Int32Array 0..nFe-1 (ou null) — absorvido por "within"; cl: Int32Array 0..G-1 (conglomerados). */
  function wlsFE(o) {
    var y = o.y, cols = o.cols, w = o.w, fe = o.fe, cl = o.cl, n = y.length, k = cols.length, i, a, b, g;
    var yt = Float64Array.from(y), xt = cols.map(function (c) { return Float64Array.from(c); });
    if (fe) {
      var nFe = o.nFe, sw = new Float64Array(nFe), sy = new Float64Array(nFe), sx = cols.map(function () { return new Float64Array(nFe); });
      for (i = 0; i < n; i++) { g = fe[i]; sw[g] += w[i]; sy[g] += w[i] * y[i]; for (a = 0; a < k; a++) sx[a][g] += w[i] * cols[a][i]; }
      for (i = 0; i < n; i++) { g = fe[i]; yt[i] = y[i] - sy[g] / sw[g]; for (a = 0; a < k; a++) xt[a][i] = cols[a][i] - sx[a][g] / sw[g]; }
    }
    var XtWX = [], XtWy = new Array(k).fill(0);
    for (a = 0; a < k; a++) XtWX.push(new Array(k).fill(0));
    for (i = 0; i < n; i++) {
      for (a = 0; a < k; a++) {
        var wx = w[i] * xt[a][i];
        XtWy[a] += wx * yt[i];
        for (b = 0; b < k; b++) XtWX[a][b] += wx * xt[b][i];
      }
    }
    var beta = solveLinear(XtWX, XtWy), inv = invert(XtWX);
    var G = o.nCl, meat = [];
    for (a = 0; a < k; a++) meat.push(new Array(k).fill(0));
    var sc = new Float64Array(G * k);
    for (i = 0; i < n; i++) {
      var u = yt[i]; for (a = 0; a < k; a++) u -= xt[a][i] * beta[a];
      for (a = 0; a < k; a++) sc[cl[i] * k + a] += w[i] * xt[a][i] * u;
    }
    for (g = 0; g < G; g++) for (a = 0; a < k; a++) for (b = 0; b < k; b++) meat[a][b] += sc[g * k + a] * sc[g * k + b];
    var adj = (G / Math.max(1, G - 1)) * ((n - 1) / Math.max(1, n - k));
    var se = [], t = [], p = [];
    for (a = 0; a < k; a++) {
      var v = 0, c2, d2;
      for (c2 = 0; c2 < k; c2++) for (d2 = 0; d2 < k; d2++) v += inv[a][c2] * meat[c2][d2] * inv[d2][a];
      v *= adj; var s = Math.sqrt(Math.max(v, 0));
      se.push(s); t.push(s > 0 ? beta[a] / s : 0); p.push(2 * (1 - normCdf(Math.abs(s > 0 ? beta[a] / s : 0))));
    }
    return { beta: beta, se: se, t: t, p: p, n: n, G: G, k: k };
  }

  /* Bootstrap por conglomerado para OLS sem intercepto (vários resultados y com os mesmos regressores).
   * ys: array de Float64Array (um por resultado). Devolve, para cada resultado, as k colunas de draws de beta. */
  function clusterOLS(cols, ys, w, cl, G) {
    var k = cols.length, m = ys.length, n = w.length, i, a, b, j;
    var XtWX = new Float64Array(G * k * k), XtWy = new Float64Array(G * m * k);
    for (i = 0; i < n; i++) {
      var g = cl[i];
      for (a = 0; a < k; a++) {
        var wx = w[i] * cols[a][i];
        for (b = 0; b < k; b++) XtWX[g * k * k + a * k + b] += wx * cols[b][i];
        for (j = 0; j < m; j++) XtWy[g * m * k + j * k + a] += wx * ys[j][i];
      }
    }
    return { XtWX: XtWX, XtWy: XtWy, G: G, k: k, m: m };
  }
  function bootOLS(st, nBoot, seed) {
    var r = rng(seed || 1), G = st.G, k = st.k, m = st.m, out = [], bI, t, a, b, j;
    function solveFrom(idxs) {
      var A = [], rhs = [];
      for (a = 0; a < k; a++) A.push(new Array(k).fill(0));
      for (j = 0; j < m; j++) rhs.push(new Array(k).fill(0));
      for (t = 0; t < idxs.length; t++) {
        var g = idxs[t];
        for (a = 0; a < k; a++) { for (b = 0; b < k; b++) A[a][b] += st.XtWX[g * k * k + a * k + b]; for (j = 0; j < m; j++) rhs[j][a] += st.XtWy[g * m * k + j * k + a]; }
      }
      return rhs.map(function (v) { return solveLinear(A, v); });
    }
    var all = Array.from({ length: G }, function (_, i) { return i; });
    var base = solveFrom(all);
    for (bI = 0; bI < nBoot; bI++) {
      var idxs = new Int32Array(G);
      for (t = 0; t < G; t++) idxs[t] = Math.floor(r() * G);
      try { out.push(solveFrom(idxs)); } catch (e) { /* amostra degenerada: ignora */ }
    }
    return { base: base, draws: out };     // draws[b][resultado][coef]
  }

  /* Permutação dentro de grupos (ex.: embaralhar entre seções do mesmo município). Devolve nova ordem de índices. */
  function permuteWithin(groups, nGroups, r) {
    var n = groups.length, buckets = [], i, g;
    for (g = 0; g < nGroups; g++) buckets.push([]);
    for (i = 0; i < n; i++) buckets[groups[i]].push(i);
    var perm = new Int32Array(n);
    buckets.forEach(function (idx) {
      var sh = idx.slice();
      for (var j = sh.length - 1; j > 0; j--) { var q = Math.floor(r() * (j + 1)), t = sh[j]; sh[j] = sh[q]; sh[q] = t; }
      for (var j2 = 0; j2 < idx.length; j2++) perm[idx[j2]] = sh[j2];
    });
    return perm;
  }

  return {
    rng: rng, gauss: gauss, solveLinear: solveLinear, invert: invert, normCdf: normCdf, quantile: quantile, ci: ci,
    projectSimplex: projectSimplex, clusterStats: clusterStats, sumStats: sumStats, solveTransition: solveTransition,
    bootstrapTransition: bootstrapTransition, olsTransition: olsTransition, dunDavis: dunDavis, wlsFE: wlsFE, clusterOLS: clusterOLS, bootOLS: bootOLS,
    permuteWithin: permuteWithin
  };
});
