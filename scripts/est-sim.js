/* est-sim.js — Mundo SINTÉTICO de três ondas (1T22, 2T22, 1T26) com efeitos PLANTADOS, para validar o método.
 * Parâmetros plantados: mLF (fração dos eleitores de Lula 2T22 que vão para Flávio no 1T26),
 *                       strat (voto útil: fração dos "outros" que, em seções competitivas, migra para os dois líderes),

 *                       ctxA (TESTE DE ESTRESSE: efeito contextual — abstenção vira voto em F proporcionalmente à % de Lula na seção, com migração L->F real = 0),
 *                       accStray (fração do ACRÉSCIMO líquido do 2T22 de cada lado que NÃO volta a votar no mesmo lado no 1T26 — votos "emprestados").
 * Saída no mesmo formato do carregador de TSV (arrays planos).  NÃO usa dados reais. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./est-core.js'));
  else root.EstSim = factory(root.EstCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  // 1T22 (6 estados) -> 2T22 (5 estados): L1,B1,O1,Bl1,N1,A1 -> L2,B2,Bl2,N2,A2
  var T12 = [
    [0.985, 0.003, 0.002, 0.003, 0.007],
    [0.003, 0.985, 0.002, 0.003, 0.007],
    [0.55, 0.25, 0.04, 0.06, 0.10],
    [0.10, 0.10, 0.50, 0.15, 0.15],
    [0.10, 0.10, 0.15, 0.50, 0.15],
    [0.03, 0.03, 0.005, 0.005, 0.93]
  ];
  function t23(mLF, mBL) {   // 2T22 (L2,B2,Bl2,N2,A2) -> 1T26 (L3,F3,CY,SA,CA,ZE,D3,Bl3,N3,A3)
    var L = [0.86 - mLF, mLF, 0.03, 0.025, 0.005, 0.001, 0.002, 0.01, 0.015, 0];
    var B = [mBL, 0.90 - mBL, 0.02, 0.015, 0.025, 0.003, 0.002, 0.005, 0.008, 0];
    var Bl = [0.10, 0.10, 0.10, 0.08, 0.05, 0.01, 0.01, 0.30, 0.10, 0];
    var N = [0.08, 0.08, 0.08, 0.06, 0.04, 0.01, 0.01, 0.10, 0.30, 0];
    var A = [0.015, 0.015, 0.004, 0.004, 0.002, 0.0005, 0.0005, 0.003, 0.004, 0];
    return [L, B, Bl, N, A].map(function (row) {
      var s = 0, i; for (i = 0; i < 9; i++) s += row[i];
      row[9] = 1 - s; return row;
    });
  }

  function makeThreeWave(o) {
    o = o || {};
    var r = Core.rng(o.seed || 1), g = function () { return Core.gauss(r); };
    var ctxA = o.ctxA || 0, accStray = o.accStray || 0, nMun = o.nMun || 300, mLF = o.mLF || 0, mBL = o.mBL === undefined ? 0.01 : o.mBL, strat = o.strat || 0;
    var sdMunEff = o.sdMunEff === undefined ? 0.012 : o.sdMunEff, noise = o.noise === undefined ? 1 : o.noise;
    var T23 = t23(mLF, mBL), rows = [], m, i, c, k;
    var ufs = o.nUf || 6;
    for (m = 0; m < nMun; m++) {
      var uf = m % ufs, mu = Math.min(0.85, Math.max(0.15, 0.30 + 0.08 * uf + 0.12 * g())), nSec = 20 + Math.floor(r() * 60);
      var effF = sdMunEff * g();                       // heterogeneidade municipal (ruído não planejado)
      for (i = 0; i < nSec; i++) {
        var a2 = Math.round(Math.exp(Math.log(330) + 0.25 * g())); if (a2 < 80) a2 = 80;
        var turn = Math.min(0.92, Math.max(0.6, 0.79 + 0.04 * g()));
        var bl1 = 0.018 * turn, n1 = 0.028 * turn, o1v = Math.max(0.01, 0.085 + 0.03 * g());
        var valid1 = turn - bl1 - n1, lean = Math.min(0.95, Math.max(0.05, mu + 0.10 * g()));
        var oo = o1v * valid1, rest = valid1 - oo;
        var w1 = [lean * rest, (1 - lean) * rest, oo, bl1, n1, 1 - turn];                // fração do eleitorado (soma 1)
        var w2 = [0, 0, 0, 0, 0];
        for (k = 0; k < 6; k++) for (c = 0; c < 5; c++) w2[c] += w1[k] * T12[k][c];
        w2 = w2.map(function (v) { return Math.max(0, v + noise * 0.004 * g()); });
        var s2 = w2.reduce(function (p, q) { return p + q; }, 0); w2 = w2.map(function (v) { return v / s2; });
        var w3 = new Array(10).fill(0);
        for (k = 0; k < 5; k++) for (c = 0; c < 10; c++) w3[c] += w2[k] * T23[k][c];
        // acréscimo "emprestado" do 2T22: parte do ganho líquido entre 1T22 e 2T22 de cada lado não retorna no 1T26
        if (accStray > 0) {
          var accB = Math.max(0, w2[1] - w1[1]), accL = Math.max(0, w2[0] - w1[0]), wOth = [0.40, 0.30, 0.20, 0.05, 0.05];
          var moveF = accStray * accB * T23[1][1], moveL = accStray * accL * T23[0][0];
          w3[1] -= moveF; w3[0] -= moveL;
          for (c = 0; c < 5; c++) w3[2 + c] += (moveF + moveL) * wOth[c];
        }
        // voto útil plantado: em seção competitiva, parte dos "outros" migra para F (70%) e L (30%)
        var V2 = w2[0] + w2[1], K = V2 > 0 ? 1 - Math.abs(w2[0] - w2[1]) / V2 : 0;
        if (strat > 0) {
          var oth = w3[2] + w3[3] + w3[4] + w3[5] + w3[6], mv = strat * K;
          for (c = 2; c <= 6; c++) { var take = w3[c] * mv; w3[c] -= take; w3[1] += 0.7 * take; w3[0] += 0.3 * take; }
        }
        if (ctxA > 0) { var mvA = Math.min(w3[9], ctxA * w2[0]); w3[9] -= mvA; w3[1] += mvA; }   // contextual: não é migração de Lula
        w3[1] += effF; w3[0] -= effF;                   // efeito municipal L<->F
        w3 = w3.map(function (v) { return Math.max(0, v + noise * 0.004 * g()); });
        var s3 = w3.reduce(function (p, q) { return p + q; }, 0); w3 = w3.map(function (v) { return v / s3; });
        var a1 = Math.round(a2 * (1 + 0.01 * g())), a3 = Math.round(a2 * (1 + 0.02 + 0.03 * g()));
        rows.push({ uf: uf, mun: m, zone: m * 3 + (i % 3), a1: a1, a2: a2, a3: a3, w1: w1.map(function (v) { return v * a1; }), w2: w2.map(function (v) { return v * a2; }), w3: w3.map(function (v) { return v * a3; }) });
      }
    }
    return toDataset(rows, ufs);
  }

  function toDataset(rows, nUf) {
    var n = rows.length, ds = { n: n, uf: new Int32Array(n), mun: new Int32Array(n), zone: new Int32Array(n), tier: new Uint8Array(n),
      a1: new Float64Array(n), a2: new Float64Array(n), a3: new Float64Array(n), w1: new Float64Array(n * 6), w2: new Float64Array(n * 5), w3: new Float64Array(n * 10) };
    var maxM = 0, maxZ = 0, i, c;
    for (i = 0; i < n; i++) {
      var q = rows[i];
      ds.uf[i] = q.uf; ds.mun[i] = q.mun; ds.zone[i] = q.zone; ds.a1[i] = q.a1; ds.a2[i] = q.a2; ds.a3[i] = q.a3;
      for (c = 0; c < 6; c++) ds.w1[i * 6 + c] = q.w1[c];
      for (c = 0; c < 5; c++) ds.w2[i * 5 + c] = q.w2[c];
      for (c = 0; c < 10; c++) ds.w3[i * 10 + c] = q.w3[c];
      if (q.mun > maxM) maxM = q.mun; if (q.zone > maxZ) maxZ = q.zone;
    }
    ds.nUf = nUf; ds.nMun = maxM + 1; ds.nZone = maxZ + 1;
    ds.ufNames = Array.from({ length: nUf }, function (_, i) { return 'U' + i; });
    ds.munNames = Array.from({ length: ds.nMun }, function (_, i) { return 'M' + i; });
    ds.zoneNames = Array.from({ length: ds.nZone }, function (_, i) { return 'Z' + i; });
    return ds;
  }

  return { makeThreeWave: makeThreeWave, T12: T12, t23: t23, toDataset: toDataset };
});
