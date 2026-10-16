/* est-run.js — Executa TODAS as análises do estudo sobre um conjunto de seções (ds) e devolve um objeto de resultados.
 * Também é a CLI:  node scripts/est-run.js data/secoes.tsv out/resultados.json [--fast]
 *
 * ds (arrays planos; ver est-sim.js): { n, uf, mun, zone, tier, ufNames, munNames, zoneNames, a1, a2, a3, w1(n*6), w2(n*5), w3(n*10) }
 *   w1 = [L1,B1,O1,Bl1,N1,A1]  (1T 2022)      w2 = [L2,B2,Bl2,N2,A2]  (2T 2022)
 *   w3 = [L3,F3,CY,SA,CA,ZE,D3,Bl3,N3,A3]  (1T 2026)      — contagens de eleitores (soma da linha = eleitorado da onda).
 * REGRAS PRÉ-REGISTRADAS (limiares abaixo): definidas antes de ver os dados reais; mudar exige registro no relatório. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./est-core.js'));
  else root.EstRun = factory(root.EstCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  var DEFAULTS = {
    nBoot: 400, nBootSens: 120, nBootUf: 150, nPerm: 100, seed: 20261014, level: 0.95,
    migRelevant: 0.02,      // fluxo Lula-2T22 -> Flávio-1T26 >= 2% dos eleitores de Lula 2T22 = "relevante"
    rhoAdiantado: 0.75,     // razão de retenção (acréscimo/núcleo) >= 0,75 = "adiantado"
    rhoEmJogo: 0.25,        // <= 0,25 = "ainda em jogo"
    minClustersUf: 30, topN: 20, sampleTiers: 'A', sensMaxDeltaE: 0.05, surveys: []
  };
  var ROWS = ['L2', 'B2', 'Bl2', 'N2', 'A2'];
  var COLS = ['L3', 'F3', 'CY', 'SA', 'CA', 'ZE', 'D3', 'Bl3', 'N3', 'A3'];
  var OUT = [2, 3, 4, 5, 6], NV = [7, 8, 9];
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in (b || {})) if (b[k] !== undefined) o[k] = b[k]; return o; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  /* ---------- seleção e derivação ---------- */
  function select(ds, keep) {
    var n = keep.length, v = { n: n, uf: new Int32Array(n), a1: new Float64Array(n), a2: new Float64Array(n), a3: new Float64Array(n),
      w1: new Float64Array(n * 6), w2: new Float64Array(n * 5), w3: new Float64Array(n * 10), munC: new Int32Array(n), zoneC: new Int32Array(n), tier: new Uint8Array(n) };
    var mm = {}, zm = {}, K = 0, Z = 0, munUf = [], zoneMun = [], munName = [], zoneName = [], i, j, c;
    for (i = 0; i < n; i++) {
      j = keep[i];
      v.uf[i] = ds.uf[j]; v.a1[i] = ds.a1[j]; v.a2[i] = ds.a2[j]; v.a3[i] = ds.a3[j]; v.tier[i] = ds.tier ? ds.tier[j] : 0;
      for (c = 0; c < 6; c++) v.w1[i * 6 + c] = ds.w1[j * 6 + c];
      for (c = 0; c < 5; c++) v.w2[i * 5 + c] = ds.w2[j * 5 + c];
      for (c = 0; c < 10; c++) v.w3[i * 10 + c] = ds.w3[j * 10 + c];
      var mk = ds.mun[j], zk = ds.zone[j];
      if (mm[mk] === undefined) { mm[mk] = K++; munUf.push(ds.uf[j]); munName.push(ds.munNames[mk]); }
      if (zm[zk] === undefined) { zm[zk] = Z++; zoneMun.push(mm[mk]); zoneName.push(ds.zoneNames[zk]); }
      v.munC[i] = mm[mk]; v.zoneC[i] = zm[zk];
    }
    v.K = K; v.Z = Z; v.munUf = Int32Array.from(munUf); v.zoneMun = Int32Array.from(zoneMun);
    v.munName = munName; v.zoneName = zoneName; v.ufNames = ds.ufNames; v.nUf = ds.nUf;
    return prep(v);
  }
  function prep(v) {
    var n = v.n, i, c;
    v.E1 = new Float64Array(n); v.E2 = new Float64Array(n); v.E3 = new Float64Array(n);
    v.X = new Float64Array(n * 5); v.Y = new Float64Array(n * 10);
    v.O3 = new Float64Array(n); v.V2 = new Float64Array(n); v.V3 = new Float64Array(n);
    for (i = 0; i < n; i++) {
      var e1 = 0, e2 = 0, e3 = 0;
      for (c = 0; c < 6; c++) e1 += v.w1[i * 6 + c];
      for (c = 0; c < 5; c++) e2 += v.w2[i * 5 + c];
      for (c = 0; c < 10; c++) e3 += v.w3[i * 10 + c];
      v.E1[i] = e1; v.E2[i] = e2; v.E3[i] = e3;
      for (c = 0; c < 5; c++) v.X[i * 5 + c] = v.w2[i * 5 + c] / e2;
      for (c = 0; c < 10; c++) v.Y[i * 10 + c] = v.w3[i * 10 + c] / e3;
      v.O3[i] = v.w3[i * 10 + 2] + v.w3[i * 10 + 3] + v.w3[i * 10 + 4] + v.w3[i * 10 + 5] + v.w3[i * 10 + 6];
      v.V2[i] = v.w2[i * 5] + v.w2[i * 5 + 1];
      v.V3[i] = v.w3[i * 10] + v.w3[i * 10 + 1] + v.O3[i];
    }
    return v;
  }
  function subsetView(v, pred) {            // sub-amostra de uma visão (mantém índices de município/zona)
    var keep = [], i;
    for (i = 0; i < v.n; i++) if (pred(i)) keep.push(i);
    var s = { n: keep.length };
    ['a1', 'a2', 'a3', 'uf', 'munC', 'zoneC', 'tier'].forEach(function (f) { s[f] = new v[f].constructor(keep.length); });
    s.w1 = new Float64Array(keep.length * 6); s.w2 = new Float64Array(keep.length * 5); s.w3 = new Float64Array(keep.length * 10);
    keep.forEach(function (j, i2) {
      ['a1', 'a2', 'a3', 'uf', 'munC', 'zoneC', 'tier'].forEach(function (f) { s[f][i2] = v[f][j]; });
      for (var c = 0; c < 6; c++) s.w1[i2 * 6 + c] = v.w1[j * 6 + c];
      for (c = 0; c < 5; c++) s.w2[i2 * 5 + c] = v.w2[j * 5 + c];
      for (c = 0; c < 10; c++) s.w3[i2 * 10 + c] = v.w3[j * 10 + c];
    });
    s.K = v.K; s.Z = v.Z; s.munUf = v.munUf; s.zoneMun = v.zoneMun; s.munName = v.munName; s.zoneName = v.zoneName; s.ufNames = v.ufNames; s.nUf = v.nUf;
    return prep(s);
  }

  /* ---------- descritivo nacional ---------- */
  function national(v) {
    var w2 = new Array(5).fill(0), w3 = new Array(10).fill(0), i, c, E2 = 0, E3 = 0;
    for (i = 0; i < v.n; i++) {
      for (c = 0; c < 5; c++) w2[c] += v.w2[i * 5 + c];
      for (c = 0; c < 10; c++) w3[c] += v.w3[i * 10 + c];
    }
    E2 = sum(w2); E3 = sum(w3);
    var cat2 = { L: w2[0], B: w2[1], OUT: 0, NV: w2[2] + w2[3] + w2[4] };
    var cat3 = { L: w3[0], F: w3[1], OUT: w3[2] + w3[3] + w3[4] + w3[5] + w3[6], NV: w3[7] + w3[8] + w3[9] };
    return {
      n: v.n, E2: E2, E3: E3, w2: w2, w3: w3,
      pp: { L2: cat2.L / E2, B2: cat2.B / E2, NV2: cat2.NV / E2, L3: cat3.L / E3, F3: cat3.F / E3, OUT3: cat3.OUT / E3, NV3: cat3.NV / E3 },
      delta: { L: cat3.L / E3 - cat2.L / E2, F: cat3.F / E3 - cat2.B / E2, OUT: cat3.OUT / E3, NV: cat3.NV / E3 - cat2.NV / E2 },
      votes: { L2: cat2.L, B2: cat2.B, L3: cat3.L, F3: cat3.F, OUT3: cat3.OUT }
    };
  }

  /* ---------- transição ---------- */
  function cellsCI(draws, R, C, level) {
    var lo = [], hi = [], r, c;
    for (r = 0; r < R; r++) { lo.push([]); hi.push([]); for (c = 0; c < C; c++) { var x = Core.ci(draws.map(function (d) { return d[r * C + c]; }), level); lo[r].push(x.lo); hi[r].push(x.hi); } }
    return { lo: lo, hi: hi };
  }
  function nest(T, R, C) { var o = [], r, c; for (r = 0; r < R; r++) { o.push([]); for (c = 0; c < C; c++) o[r].push(T[r * C + c]); } return o; }
  function aggCols(T, C, r, cols) { var s = 0; cols.forEach(function (c) { s += T[r * C + c]; }); return s; }
  var KEYS = [
    ['L2→F3', 0, [1]], ['L2→L3', 0, [0]], ['L2→OUT3', 0, OUT], ['L2→NV3', 0, NV],
    ['B2→F3', 1, [1]], ['B2→L3', 1, [0]], ['B2→OUT3', 1, OUT], ['B2→NV3', 1, NV],
    ['A2→L3', 4, [0]], ['A2→F3', 4, [1]], ['A2→OUT3', 4, OUT], ['A2→NV3', 4, NV]
  ];
  function keyFlows(base, draws, mass2, level) {
    return KEYS.map(function (k) {
      var est = aggCols(base, 10, k[1], k[2]), ds = draws.map(function (d) { return aggCols(d, 10, k[1], k[2]); }), x = Core.ci(ds, level);
      return { name: k[0], est: est, lo: x.lo, hi: x.hi, votes: est * mass2[k[1]], votesLo: x.lo * mass2[k[1]], votesHi: x.hi * mass2[k[1]] };
    });
  }
  function transition(v, cfg) {
    var st = Core.clusterStats(v.X, v.Y, v.E3, v.munC, v.K, 5, 10);
    var boot = Core.bootstrapTransition(st, cfg.nBoot, cfg.seed, {});
    var mass2 = new Array(5).fill(0), i, c;
    for (i = 0; i < v.n; i++) for (c = 0; c < 5; c++) mass2[c] += v.w2[i * 5 + c];
    var cells = cellsCI(boot.draws, 5, 10, cfg.level);
    // composição de F3, L3 e OUT3 por origem (a partir de T * massa de 2022)
    function comp(col) {
      var f = function (T) { var tot = 0, parts = []; for (var r = 0; r < 5; r++) { var x = T[r * 10 + col] * mass2[r]; parts.push(x); tot += x; } return parts.map(function (x) { return tot ? x / tot : 0; }); };
      var est = f(boot.base), dr = boot.draws.map(f);
      return ROWS.map(function (nm, r) { var x = Core.ci(dr.map(function (d) { return d[r]; }), cfg.level); return { from: nm, est: est[r], lo: x.lo, hi: x.hi }; });
    }
    var bnd = {
      'L2→F3': Core.dunDavis(v.X, v.Y, v.E3, 5, 10, 0, 1), 'B2→L3': Core.dunDavis(v.X, v.Y, v.E3, 5, 10, 1, 0),
      'L2→OUT3': Core.dunDavis(v.X, v.Y, v.E3, 5, 10, 0, OUT), 'B2→OUT3': Core.dunDavis(v.X, v.Y, v.E3, 5, 10, 1, OUT)
    };
    return { rows: ROWS, cols: COLS, T: nest(boot.base, 5, 10), lo: cells.lo, hi: cells.hi, mass2: mass2, key: keyFlows(boot.base, boot.draws, mass2, cfg.level),
             composition: { F3: comp(1), L3: comp(0), OUT3: (function () { var f = function (T) { var tot = 0, parts = []; for (var r = 0; r < 5; r++) { var x = aggCols(T, 10, r, OUT) * mass2[r]; parts.push(x); tot += x; } return parts.map(function (x) { return tot ? x / tot : 0; }); }; var est = f(boot.base), dr = boot.draws.map(f); return ROWS.map(function (nm, r) { var x = Core.ci(dr.map(function (d) { return d[r]; }), cfg.level); return { from: nm, est: est[r], lo: x.lo, hi: x.hi }; }); })() },
             bounds: bnd, stats: st };
  }
  function byUf(v, st, cfg) {
    var out = [], u, k;
    for (u = 0; u < v.nUf; u++) {
      var list = []; for (k = 0; k < v.K; k++) if (v.munUf[k] === u) list.push(k);
      if (list.length < cfg.minClustersUf) { out.push({ uf: v.ufNames[u], clusters: list.length, skipped: true }); continue; }
      var b = Core.bootstrapTransition(st, cfg.nBootUf, cfg.seed + u + 1, { clusters: list });
      var mass2 = new Array(5).fill(0), nSec = 0, i, c;
      for (i = 0; i < v.n; i++) if (v.uf[i] === u) { nSec++; for (c = 0; c < 5; c++) mass2[c] += v.w2[i * 5 + c]; }
      var kf = keyFlows(b.base, b.draws, mass2, cfg.level).filter(function (x) { return ['L2→F3', 'L2→L3', 'B2→F3', 'B2→L3', 'L2→OUT3'].indexOf(x.name) >= 0; });
      out.push({ uf: v.ufNames[u], clusters: list.length, sections: nSec, key: kf });
    }
    return out;
  }

  /* ---------- decomposição por "estado de 2022" (retenção do núcleo × acréscimo do 2T) ---------- */
  function retention(v, cfg) {
    var n = v.n, l1 = new Float64Array(n), al = new Float64Array(n), b1 = new Float64Array(n), ab = new Float64Array(n), z2 = new Float64Array(n);
    var yL = new Float64Array(n), yF = new Float64Array(n), yO = new Float64Array(n), yN = new Float64Array(n), i;
    for (i = 0; i < n; i++) {
      l1[i] = v.w1[i * 6] / v.E1[i]; al[i] = v.w2[i * 5] / v.E2[i] - l1[i];
      b1[i] = v.w1[i * 6 + 1] / v.E1[i]; ab[i] = v.w2[i * 5 + 1] / v.E2[i] - b1[i];
      z2[i] = (v.w2[i * 5 + 2] + v.w2[i * 5 + 3] + v.w2[i * 5 + 4]) / v.E2[i];
      yL[i] = v.Y[i * 10]; yF[i] = v.Y[i * 10 + 1]; yO[i] = v.O3[i] / v.E3[i]; yN[i] = (v.w3[i * 10 + 7] + v.w3[i * 10 + 8] + v.w3[i * 10 + 9]) / v.E3[i];
    }
    var cols = [l1, al, b1, ab, z2], names = ['núcleo Lula (1T22)', 'acréscimo líquido Lula (2T22)', 'núcleo Bolsonaro (1T22)', 'acréscimo líquido Bolsonaro (2T22)', 'não-válidos 2T22'];
    var outs = [['L3', yL], ['F3', yF], ['OUT3', yO], ['NV3', yN]];
    var table = outs.map(function (o) {
      var r = Core.wlsFE({ y: o[1], cols: cols, w: v.E3, fe: null, cl: v.munC, nCl: v.K });
      return { outcome: o[0], coef: names.map(function (nm, k) { return { name: nm, beta: r.beta[k], se: r.se[k] }; }) };
    });
    var cst = Core.clusterOLS(cols, [yL, yF, yO, yN], v.E3, v.munC, v.K), bo = Core.bootOLS(cst, cfg.nBoot, cfg.seed + 77);
    function ratio(res, num, den) {
      var ds = [];
      bo.draws.forEach(function (d) { var b = d[res]; if (Math.abs(b[den]) > 1e-6) ds.push(b[num] / b[den]); });
      var est = Math.abs(bo.base[res][den]) > 1e-6 ? bo.base[res][num] / bo.base[res][den] : NaN, x = Core.ci(ds, cfg.level);
      return { est: est, lo: x.lo, hi: x.hi };
    }
    return { table: table, rhoF: ratio(1, 3, 2), rhoL: ratio(0, 1, 0), states: names };
  }

  /* ---------- voto útil / estratégico ---------- */
  function strategic(v, cfg) {
    var idx = [], i;
    for (i = 0; i < v.n; i++) if (v.V2[i] > 0 && v.V3[i] > 0 && v.w1[i * 6] + v.w1[i * 6 + 1] + v.w1[i * 6 + 2] > 0) idx.push(i);
    var m = idx.length, f = function () { return new Float64Array(m); };
    var K = f(), K2 = f(), Th1 = f(), ab2 = f(), la = f(), yO = f(), yF = f(), L2s = f(), w = f(), mun = new Int32Array(m), zone = new Int32Array(m), ufv = new Int32Array(m), j;
    for (j = 0; j < m; j++) {
      i = idx[j];
      K[j] = 1 - Math.abs(v.w2[i * 5] - v.w2[i * 5 + 1]) / v.V2[i]; K2[j] = K[j] * K[j];
      Th1[j] = v.w1[i * 6 + 2] / (v.w1[i * 6] + v.w1[i * 6 + 1] + v.w1[i * 6 + 2]);
      ab2[j] = v.w2[i * 5 + 4] / v.E2[i]; la[j] = Math.log(v.E3[i]);
      yO[j] = 100 * v.O3[i] / v.V3[i]; yF[j] = 100 * v.w3[i * 10 + 1] / (v.w3[i * 10 + 1] + v.O3[i]);
      L2s[j] = v.w2[i * 5] / v.V2[i]; w[j] = v.E3[i]; mun[j] = v.munC[i]; zone[j] = v.zoneC[i]; ufv[j] = v.uf[i];
    }
    function fit(y, cols, names, fe, nFe, mask) {
      var r = Core.wlsFE({ y: y, cols: cols, w: w, fe: fe, nFe: nFe, cl: mun, nCl: v.K });
      return { names: names, beta: r.beta, se: r.se, p: r.p, n: r.n, G: r.G };
    }
    var ctrl = [Th1, ab2, la], cn = ['3ª via no 1T22', 'abstenção 2T22', 'ln(eleitorado)'];
    var m1 = fit(yO, [K].concat(ctrl), ['competitividade (K)'].concat(cn), mun, v.K);
    var m2 = fit(yO, [K, K2].concat(ctrl), ['K', 'K²'].concat(cn), mun, v.K);
    var m3 = fit(yO, [K].concat(ctrl), ['competitividade (K)'].concat(cn), zone, v.Z);
    var m4 = fit(yF, [L2s, K].concat(ctrl), ['Lula no 2T22 (% válidos)', 'K'].concat(cn), mun, v.K);
    // por UF
    var perUf = [], u;
    for (u = 0; u < v.nUf; u++) {
      var sel = []; for (j = 0; j < m; j++) if (ufv[j] === u) sel.push(j);
      var nm = {}, G = 0, ids = sel.map(function (q) { if (nm[mun[q]] === undefined) nm[mun[q]] = G++; return nm[mun[q]]; });
      if (G < cfg.minClustersUf) { perUf.push({ uf: v.ufNames[u], clusters: G, skipped: true }); continue; }
      var pick = function (a) { var o = new Float64Array(sel.length); sel.forEach(function (q, t) { o[t] = a[q]; }); return o; };
      var cl = Int32Array.from(ids);
      var r = Core.wlsFE({ y: pick(yO), cols: [pick(K), pick(Th1), pick(ab2), pick(la)], w: pick(w), fe: cl, nFe: G, cl: cl, nCl: G });
      perUf.push({ uf: v.ufNames[u], clusters: G, beta: r.beta[0], se: r.se[0], p: r.p[0] });
    }
    // permutação do K dentro do município (placebo): efeito deve sumir
    var rr = Core.rng(cfg.seed + 5), perms = [], b;
    for (b = 0; b < cfg.nPerm; b++) {
      var pm = Core.permuteWithin(mun, v.K, rr), Kp = new Float64Array(m);
      for (j = 0; j < m; j++) Kp[j] = K[pm[j]];
      perms.push(Core.wlsFE({ y: yO, cols: [Kp].concat(ctrl), w: w, fe: mun, nFe: v.K, cl: mun, nCl: v.K }).beta[0]);
    }
    var ext = perms.filter(function (x) { return Math.abs(x) >= Math.abs(m1.beta[0]); }).length;
    var pEmp = (1 + ext) / (1 + cfg.nPerm);
    // dose-resposta (resíduos dentro do município), 10 faixas de mesmo tamanho
    var wsum = new Float64Array(v.K), ks = new Float64Array(v.K), ys = new Float64Array(v.K);
    for (j = 0; j < m; j++) { wsum[mun[j]] += w[j]; ks[mun[j]] += w[j] * K[j]; ys[mun[j]] += w[j] * yO[j]; }
    var pts = []; for (j = 0; j < m; j++) pts.push({ x: K[j] - ks[mun[j]] / wsum[mun[j]], y: yO[j] - ys[mun[j]] / wsum[mun[j]], w: w[j] });
    pts.sort(function (a, c) { return a.x - c.x; });
    var tw = pts.reduce(function (s, p) { return s + p.w; }, 0), bins = [], acc = 0, cur = { sx: 0, sy: 0, sw: 0 }, target = tw / 10;
    pts.forEach(function (p) { cur.sx += p.w * p.x; cur.sy += p.w * p.y; cur.sw += p.w; acc += p.w; if (acc >= target * (bins.length + 1) && bins.length < 9) { bins.push({ x: cur.sx / cur.sw, y: cur.sy / cur.sw }); cur = { sx: 0, sy: 0, sw: 0 }; } });
    if (cur.sw > 0) bins.push({ x: cur.sx / cur.sw, y: cur.sy / cur.sw });
    return { n: m, m1: m1, m2: m2, m3: m3, m4: m4, perUf: perUf, permutation: { draws: perms.length, pEmp: pEmp, sd: Math.sqrt(perms.reduce(function (s, x) { return s + x * x; }, 0) / perms.length) }, bins: bins };
  }

  /* ---------- zonas ---------- */
  function zones(v, cfg) {
    var Z = v.Z, a = function () { return new Float64Array(Z); }, nSec = a(), E2 = a(), E3 = a(), L2 = a(), B2 = a(), NV2 = a(), L3 = a(), F3 = a(), O3 = a(), NV3 = a(), i, z;
    for (i = 0; i < v.n; i++) {
      z = v.zoneC[i]; nSec[z]++; E2[z] += v.E2[i]; E3[z] += v.E3[i];
      L2[z] += v.w2[i * 5]; B2[z] += v.w2[i * 5 + 1]; NV2[z] += v.w2[i * 5 + 2] + v.w2[i * 5 + 3] + v.w2[i * 5 + 4];
      L3[z] += v.w3[i * 10]; F3[z] += v.w3[i * 10 + 1]; O3[z] += v.O3[i]; NV3[z] += v.w3[i * 10 + 7] + v.w3[i * 10 + 8] + v.w3[i * 10 + 9];
    }
    var rows = [], q = { 'L↓F↑': 0, 'L↓F↓': 0, 'L↑F↑': 0, 'L↑F↓': 0 }, totE = 0;
    for (z = 0; z < Z; z++) {
      var dL = L3[z] / E3[z] - L2[z] / E2[z], dF = F3[z] / E3[z] - B2[z] / E2[z], dO = O3[z] / E3[z], dNV = NV3[z] / E3[z] - NV2[z] / E2[z];
      rows.push({ zone: v.zoneName[z], mun: v.munName[v.zoneMun[z]], uf: v.ufNames[v.munUf[v.zoneMun[z]]], sections: nSec[z], E3: E3[z], dL: dL, dF: dF, dO: dO, dNV: dNV,
                  L2: L2[z] / E2[z], B2: B2[z] / E2[z], L3: L3[z] / E3[z], F3: F3[z] / E3[z] });
      q[(dL < 0 ? 'L↓' : 'L↑') + (dF > 0 ? 'F↑' : 'F↓')] += E3[z]; totE += E3[z];
    }
    Object.keys(q).forEach(function (k) { q[k] = q[k] / totE; });
    // correlação e inclinação ponderadas (dF em função de dL), erro-padrão por município
    var one = new Float64Array(Z).fill(1), dLa = Float64Array.from(rows.map(function (r) { return r.dL; })), dFa = Float64Array.from(rows.map(function (r) { return r.dF; }));
    var fit = Core.wlsFE({ y: dFa, cols: [one, dLa], w: E3, fe: null, cl: v.zoneMun, nCl: v.K });
    var mx = 0, my = 0, sw = 0; for (z = 0; z < Z; z++) { sw += E3[z]; mx += E3[z] * dLa[z]; my += E3[z] * dFa[z]; } mx /= sw; my /= sw;
    var sxx = 0, syy = 0, sxy = 0; for (z = 0; z < Z; z++) { sxx += E3[z] * (dLa[z] - mx) * (dLa[z] - mx); syy += E3[z] * (dFa[z] - my) * (dFa[z] - my); sxy += E3[z] * (dLa[z] - mx) * (dFa[z] - my); }
    return { rows: rows, quadrants: q, corr: sxy / Math.sqrt(sxx * syy), slope: { est: fit.beta[1], se: fit.se[1], intercept: fit.beta[0] } };
  }

  /* ---------- decomposição contábil das variações (identidade: dL + dF + dO + dNV = 0 em cada seção) ----------
   * dL = L3/E3 - L2/E2 ; dF = F3/E3 - B2/E2 ; dO = outros3/E3 ; dNV = (branco+nulo+abst)3/E3 - (branco+nulo+abst)2/E2.
   * "channels": inclinação de cada dX em função de l2 e b2 (parte do eleitorado que era Lula/Bolsonaro no 2T22; referência = não-válidos),
   *             com efeito fixo de município. Mostra QUAL coluna absorve a variação ao longo do gradiente.
   * "mirror":   para cada 1 p.p. de eleitorado que Lula perdeu (dL<0) na mesma cidade, quantos p.p. apareceram em F, outros e não-válidos
   *             (e idem para o ganho de Flávio). É descrição de padrão, NÃO prova de migração individual. */
  function changes(v) {
    var n = v.n, o = { l2: new Float64Array(n), b2: new Float64Array(n), dL: new Float64Array(n), dF: new Float64Array(n), dO: new Float64Array(n), dNV: new Float64Array(n) }, i;
    for (i = 0; i < n; i++) {
      o.l2[i] = v.w2[i * 5] / v.E2[i]; o.b2[i] = v.w2[i * 5 + 1] / v.E2[i];
      o.dL[i] = v.w3[i * 10] / v.E3[i] - o.l2[i]; o.dF[i] = v.w3[i * 10 + 1] / v.E3[i] - o.b2[i]; o.dO[i] = v.O3[i] / v.E3[i];
      o.dNV[i] = (v.w3[i * 10 + 7] + v.w3[i * 10 + 8] + v.w3[i * 10 + 9]) / v.E3[i] - (v.w2[i * 5 + 2] + v.w2[i * 5 + 3] + v.w2[i * 5 + 4]) / v.E2[i];
    }
    return o;
  }
  function channels(v) {
    var c = changes(v), out = {};
    [['dL', c.dL], ['dF', c.dF], ['dO', c.dO], ['dNV', c.dNV]].forEach(function (p) {
      var r = Core.wlsFE({ y: p[1], cols: [c.l2, c.b2], w: v.E3, fe: v.munC, nFe: v.K, cl: v.munC, nCl: v.K });
      out[p[0]] = { onL2: { beta: r.beta[0], se: r.se[0] }, onB2: { beta: r.beta[1], se: r.se[1] } };
    });
    return out;
  }
  function mirror(v) {
    var c = changes(v), res = {};
    function run(label, x, others) {
      var rows = others.map(function (o) {
        var r = Core.wlsFE({ y: c[o], cols: [x], w: v.E3, fe: v.munC, nFe: v.K, cl: v.munC, nCl: v.K });
        return { to: o, share: -r.beta[0], se: r.se[0] };
      });
      res[label] = rows;
    }
    run('perdaLula', c.dL, ['dF', 'dO', 'dNV']);      // fração (-slope) da perda local de Lula que aparece em F, outros, não-válidos
    run('ganhoFlavio', c.dF, ['dL', 'dO', 'dNV']);    // idem para o ganho local de Flávio
    return res;
  }

  /* ---------- sensibilidade do fluxo Lula-2T22 -> Flávio-1T26 ---------- */
  function estimateL2F3(X, Y, w, cl, K, nBoot, seed, mode) {
    var st = Core.clusterStats(X, Y, w, cl, K, 5, 10), all = Core.sumStats(st, Array.from({ length: K }, function (_, i) { return i; }));
    if (mode === 'ols') {
      var base = Core.olsTransition(all.A, all.B, 5, 10)[1], r = Core.rng(seed), ds = [], b, t;
      for (b = 0; b < nBoot; b++) { var idx = new Int32Array(K); for (t = 0; t < K; t++) idx[t] = Math.floor(r() * K); var s = Core.sumStats(st, idx); try { ds.push(Core.olsTransition(s.A, s.B, 5, 10)[1]); } catch (e) {} }
      var c = Core.ci(ds, 0.95); return { est: base, lo: c.lo, hi: c.hi };
    }
    var bt = Core.bootstrapTransition(st, nBoot, seed, {}), c2 = Core.ci(bt.draws.map(function (d) { return d[1]; }), 0.95);
    return { est: bt.base[1], lo: c2.lo, hi: c2.hi };
  }
  function aggregateBy(v, groupArr, nG, clArr) {
    var X = new Float64Array(nG * 5), Y = new Float64Array(nG * 10), w = new Float64Array(nG), cl = new Int32Array(nG), W2 = new Float64Array(nG * 5), W3 = new Float64Array(nG * 10), g, i, c;
    for (i = 0; i < v.n; i++) { g = groupArr[i]; for (c = 0; c < 5; c++) W2[g * 5 + c] += v.w2[i * 5 + c]; for (c = 0; c < 10; c++) W3[g * 10 + c] += v.w3[i * 10 + c]; cl[g] = clArr[i]; }
    for (g = 0; g < nG; g++) {
      var e2 = 0, e3 = 0; for (c = 0; c < 5; c++) e2 += W2[g * 5 + c]; for (c = 0; c < 10; c++) e3 += W3[g * 10 + c];
      for (c = 0; c < 5; c++) X[g * 5 + c] = e2 ? W2[g * 5 + c] / e2 : 0;
      for (c = 0; c < 10; c++) Y[g * 10 + c] = e3 ? W3[g * 10 + c] / e3 : 0; w[g] = e3;
    }
    return { X: X, Y: Y, w: w, cl: cl };
  }
  function sensitivity(v, ds, cfg, base) {
    var out = [{ name: 'Principal (amostra ' + cfg.sampleTiers + ', restrita, peso = eleitorado 2026)', n: v.n, est: base.est, lo: base.lo, hi: base.hi }];
    var vd = subsetView(v, function (i) { return Math.abs(v.a3[i] / v.a2[i] - 1) <= cfg.sensMaxDeltaE; });
    var r = estimateL2F3(vd.X, vd.Y, vd.E3, vd.munC, vd.K, cfg.nBootSens, cfg.seed + 11); out.push({ name: 'Só seções com variação de eleitorado ≤ ' + (cfg.sensMaxDeltaE * 100) + '%', n: vd.n, est: r.est, lo: r.lo, hi: r.hi });
    r = estimateL2F3(v.X, v.Y, v.E3, v.munC, v.K, cfg.nBootSens, cfg.seed + 12, 'ols'); out.push({ name: 'Sem restrições (OLS)', n: v.n, est: r.est, lo: r.lo, hi: r.hi });
    var zg = aggregateBy(v, v.zoneC, v.Z, v.zoneMun); r = estimateL2F3(zg.X, zg.Y, zg.w, zg.cl, v.K, cfg.nBootSens, cfg.seed + 13); out.push({ name: 'Agregado por zona', n: v.Z, est: r.est, lo: r.lo, hi: r.hi });
    var mg = aggregateBy(v, v.munC, v.K, v.munUf); var ufCl = Int32Array.from(mg.cl); r = estimateL2F3(mg.X, mg.Y, mg.w, Int32Array.from({ length: v.K }, function (_, i) { return i; }), v.K, cfg.nBootSens, cfg.seed + 14); out.push({ name: 'Agregado por município', n: v.K, est: r.est, lo: r.lo, hi: r.hi });
    if (cfg.altTierView) { var va = cfg.altTierView; r = estimateL2F3(va.X, va.Y, va.E3, va.munC, va.K, cfg.nBootSens, cfg.seed + 15); out.push({ name: 'Seções de qualidade A + B', n: va.n, est: r.est, lo: r.lo, hi: r.hi }); }
    return out;
  }

  /* ---------- triangulação com pesquisas (opcional) ----------
   * cfg.surveys = [{ fonte, data, n, moe, value }]  value = fração (0..1) dos que votaram em Lula no 2T22 que declaram voto em Flávio no 1T26. */
  function triangulate(k, surveys) {
    if (!surveys || !surveys.length) return { status: 'NAO_DISPONIVEL', rows: [] };
    var rows = surveys.map(function (s) {
      var lo = s.value - (s.moe || 0), hi = s.value + (s.moe || 0);
      return { fonte: s.fonte, data: s.data, value: s.value, moe: s.moe || 0, overlaps: !(hi < k.lo || lo > k.hi) };
    });
    return { status: rows.every(function (r) { return r.overlaps; }) ? 'CONSISTENTE' : 'DIVERGENTE', rows: rows };
  }

  /* ---------- veredictos (regras pré-registradas) ---------- */
  function verdicts(res, cfg) {
    var k = res.transition.key.filter(function (x) { return x.name === 'L2→F3'; })[0], bnd = res.transition.bounds['L2→F3'];
    var specsAbove = res.sensitivity.filter(function (s) { return s.est >= cfg.migRelevant; }).length;
    var q1 = 'INCONCLUSIVO';
    if (bnd.ubShare < cfg.migRelevant || k.hi < cfg.migRelevant) q1 = 'SEM_SINAL';
    else if (k.lo >= cfg.migRelevant && specsAbove >= 3) q1 = 'SINAL_PRESENTE';
    var tri = triangulate(k, cfg.surveys);
    var q1Final = q1 === 'SEM_SINAL' ? 'SEM_SINAL_AGREGADO' : q1 === 'INCONCLUSIVO' ? 'INCONCLUSIVO'
      : (tri.status === 'CONSISTENTE' ? 'MIGRACAO_APOIADA' : tri.status === 'DIVERGENTE' ? 'PADRAO_CONTESTADO' : 'PADRAO_SEM_CONFIRMACAO');
    var m1 = res.strategic.m1, sig = Math.abs(m1.beta[0] / (m1.se[0] || 1)) > 1.96, pe = res.strategic.permutation.pEmp;
    var q2a = 'NULO';
    if (m1.beta[0] < 0 && sig && pe < 0.05) q2a = 'NEGATIVO';
    else if (m1.beta[0] > 0 && sig && pe < 0.05) q2a = 'POSITIVO';
    function rho(r) { return (r.est >= cfg.rhoAdiantado && r.lo >= 0.5) ? 'ADIANTADO' : (r.est <= cfg.rhoEmJogo ? 'EM_JOGO' : 'INTERMEDIARIO'); }
    return { q1: q1, q1Final: q1Final, triangulation: tri, q1Detail: { est: k.est, lo: k.lo, hi: k.hi, votes: k.votes, boundUb: bnd.ubShare, specsAbove: specsAbove, specs: res.sensitivity.length },
             q2Gradient: q2a, q2Rho: { F: rho(res.retention.rhoF), L: rho(res.retention.rhoL) } };
  }

  function analyze(ds, cfgIn) {
    var cfg = merge(DEFAULTS, cfgIn), keep = [], keepAB = [], i;
    for (i = 0; i < ds.n; i++) { if (ds.tier[i] === 0) keep.push(i); if (ds.tier[i] <= 1) keepAB.push(i); }
    var v = select(ds, cfg.sampleTiers === 'AB' ? keepAB : keep);
    if (keepAB.length > keep.length && cfg.sampleTiers !== 'AB') cfg.altTierView = select(ds, keepAB);
    var res = { meta: { cfg: merge(cfg, { altTierView: undefined }), sample: { n: v.n, municipalities: v.K, zones: v.Z, nTotalMatched: ds.n } } };
    res.national = national(v);
    res.transition = transition(v, cfg);
    res.byUf = byUf(v, res.transition.stats, cfg);
    delete res.transition.stats;
    res.retention = retention(v, cfg);
    res.strategic = strategic(v, cfg);
    res.zones = zones(v, cfg);
    res.channels = channels(v);
    res.mirror = mirror(v);
    var k = res.transition.key.filter(function (x) { return x.name === 'L2→F3'; })[0];
    res.sensitivity = sensitivity(v, ds, cfg, k);
    res.verdicts = verdicts(res, cfg);
    return res;
  }

  /* ---------- carregador do TSV gerado por est_build_secoes.py ---------- */
  var COLNAMES = ['id', 'uf', 'mun', 'zona', 'secao', 'local', 'tier', 'a1', 'a2', 'a3', 'L1', 'B1', 'O1', 'Bl1', 'N1', 'A1', 'L2', 'B2', 'Bl2', 'N2', 'A2', 'L3', 'F3', 'CY', 'SA', 'CA', 'ZE', 'D3', 'Bl3', 'N3', 'A3'];
  function parseTsvLines(lines) {
    var header = lines[0].split('\t');
    if (header.join(',') !== COLNAMES.join(',')) throw new Error('cabeçalho do TSV diferente do esperado: ' + header.join(','));
    var rows = [], ufM = {}, munM = {}, zoneM = {}, ufN = [], munN = [], zoneN = [], i;
    for (i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      var f = lines[i].split('\t'), uf = f[1], mk = f[1] + '|' + f[2], zk = mk + '|' + f[3];
      if (ufM[uf] === undefined) { ufM[uf] = ufN.length; ufN.push(uf); }
      if (munM[mk] === undefined) { munM[mk] = munN.length; munN.push(mk); }
      if (zoneM[zk] === undefined) { zoneM[zk] = zoneN.length; zoneN.push(zk); }
      var num = function (a, b) { var o = []; for (var j = a; j < b; j++) o.push(Number(f[j])); return o; };
      rows.push({ uf: ufM[uf], mun: munM[mk], zone: zoneM[zk], tier: f[6] === 'A' ? 0 : 1, a1: Number(f[7]), a2: Number(f[8]), a3: Number(f[9]), w1: num(10, 16), w2: num(16, 21), w3: num(21, 31) });
    }
    var n = rows.length, ds = { n: n, uf: new Int32Array(n), mun: new Int32Array(n), zone: new Int32Array(n), tier: new Uint8Array(n), a1: new Float64Array(n), a2: new Float64Array(n), a3: new Float64Array(n), w1: new Float64Array(n * 6), w2: new Float64Array(n * 5), w3: new Float64Array(n * 10) };
    rows.forEach(function (q, j) { ds.uf[j] = q.uf; ds.mun[j] = q.mun; ds.zone[j] = q.zone; ds.tier[j] = q.tier; ds.a1[j] = q.a1; ds.a2[j] = q.a2; ds.a3[j] = q.a3; for (var c = 0; c < 6; c++) ds.w1[j * 6 + c] = q.w1[c]; for (c = 0; c < 5; c++) ds.w2[j * 5 + c] = q.w2[c]; for (c = 0; c < 10; c++) ds.w3[j * 10 + c] = q.w3[c]; });
    ds.nUf = ufN.length; ds.nMun = munN.length; ds.nZone = zoneN.length; ds.ufNames = ufN; ds.munNames = munN; ds.zoneNames = zoneN;
    return ds;
  }

  return { DEFAULTS: DEFAULTS, ROWS: ROWS, COLS: COLS, COLNAMES: COLNAMES, analyze: analyze, parseTsvLines: parseTsvLines, select: select };
});

/* CLI */
if (typeof require !== 'undefined' && require.main === module) {
  const fs = require('fs'), path = require('path'), readline = require('readline');
  const R = module.exports, args = process.argv.slice(2);
  if (args.length < 2) { console.error('uso: node scripts/est-run.js data/secoes.tsv out/resultados.json [--fast] [--surveys data/pesquisas.json] [--sample AB]'); process.exit(2); }
  const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
  const cfg = args.includes('--fast') ? { nBoot: 100, nBootSens: 40, nBootUf: 40, nPerm: 30 } : {};
  if (opt('surveys')) cfg.surveys = JSON.parse(fs.readFileSync(opt('surveys'), 'utf8'));
  if (opt('sample')) cfg.sampleTiers = opt('sample');
  const lines = [];
  readline.createInterface({ input: fs.createReadStream(args[0], 'utf8'), crlfDelay: Infinity })
    .on('line', (l) => lines.push(l))
    .on('close', () => {
      const t0 = Date.now(), ds = R.parseTsvLines(lines);
      console.log('seções lidas:', ds.n, '| municípios:', ds.nMun, '| zonas:', ds.nZone);
      const res = R.analyze(ds, cfg);
      fs.mkdirSync(path.dirname(args[1]), { recursive: true });
      fs.writeFileSync(args[1], JSON.stringify(res));
      console.log('veredictos:', JSON.stringify({ q1: res.verdicts.q1, q1Final: res.verdicts.q1Final, q2Gradient: res.verdicts.q2Gradient, q2Rho: res.verdicts.q2Rho }));
      console.log('gravado', args[1], '(' + Math.round((Date.now() - t0) / 1000) + ' s)');
    });
}
