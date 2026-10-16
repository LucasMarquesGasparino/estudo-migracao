'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../scripts/est-core.js');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' esperado ' + b + ' obtido ' + a);

test('solveLinear e invert', () => {
  const x = C.solveLinear([[2, 1], [1, 3]], [3, 5]);
  near(x[0], 0.8, 1e-12); near(x[1], 1.4, 1e-12);
  const inv = C.invert([[4, 7], [2, 6]]);
  near(inv[0][0], 0.6, 1e-12); near(inv[0][1], -0.7, 1e-12); near(inv[1][0], -0.2, 1e-12); near(inv[1][1], 0.4, 1e-12);
  assert.throws(() => C.solveLinear([[1, 2], [2, 4]], [1, 2]));
});

test('projectSimplex: soma 1, não negativo, idempotente', () => {
  for (const v of [[0.5, 0.5, 0.5], [2, 0, 0], [0.2, 0.1, -1], [5, 4, 3, 2, 1]]) {
    const p = C.projectSimplex(v);
    near(p.reduce((a, b) => a + b, 0), 1, 1e-12);
    assert.ok(p.every((z) => z >= 0));
    C.projectSimplex(p).forEach((z, i) => near(z, p[i], 1e-12));
  }
});

test('normCdf e ci', () => {
  near(C.normCdf(1.96), 0.975, 5e-4); near(C.normCdf(0), 0.5, 1e-9);
  const c = C.ci([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.8);
  near(c.lo, 1.9, 1e-9); near(c.hi, 9.1, 1e-9);
});

function panel(n, R, Cc, T, seed) {
  const r = C.rng(seed), X = new Float64Array(n * R), Y = new Float64Array(n * Cc), w = new Float64Array(n).fill(1), cl = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const x = Array.from({ length: R }, () => r() + 0.05), s = x.reduce((a, b) => a + b, 0);
    for (let a = 0; a < R; a++) X[i * R + a] = x[a] / s;
    for (let c = 0; c < Cc; c++) { let v = 0; for (let a = 0; a < R; a++) v += X[i * R + a] * T[a][c]; Y[i * Cc + c] = v; }
    cl[i] = i % 40;
  }
  return { X, Y, w, cl };
}

test('transição restrita recupera a matriz verdadeira (sem ruído)', () => {
  const T = [[0.7, 0.2, 0.1, 0], [0.1, 0.1, 0.2, 0.6], [0.0, 0.5, 0.25, 0.25]];
  const d = panel(3000, 3, 4, T, 3), st = C.clusterStats(d.X, d.Y, d.w, d.cl, 40, 3, 4);
  const all = C.sumStats(st, Array.from({ length: 40 }, (_, i) => i)), sol = C.solveTransition(all.A, all.B, 3, 4);
  T.flat().forEach((v, i) => near(sol.T[i], v, 1e-4, 'célula ' + i));
  for (let r = 0; r < 3; r++) near(sol.T.slice(r * 4, r * 4 + 4).reduce((a, b) => a + b, 0), 1, 1e-9, 'linha soma 1');
});

test('bootstrap por conglomerado é determinístico e o IC cobre o valor verdadeiro', () => {
  const T = [[0.7, 0.2, 0.1], [0.1, 0.3, 0.6]];
  const d = panel(2000, 2, 3, T, 5);
  for (let i = 0; i < 2000; i++) for (let c = 0; c < 3; c++) d.Y[i * 3 + c] += 0.02 * (C.rng(i * 7 + c)() - 0.5);   // ruído
  const st = C.clusterStats(d.X, d.Y, d.w, d.cl, 40, 2, 3);
  const a = C.bootstrapTransition(st, 60, 11), b = C.bootstrapTransition(st, 60, 11);
  assert.deepEqual(Array.from(a.draws[3]), Array.from(b.draws[3]));
  const ci = C.ci(a.draws.map((x) => x[0 * 3 + 0]), 0.95);
  assert.ok(ci.lo - 0.02 <= 0.7 && 0.7 <= ci.hi + 0.02, 'IC ' + ci.lo + ' ' + ci.hi);
});

test('Duncan-Davis: limites contêm o fluxo verdadeiro', () => {
  // 2 origens x 2 destinos, 3 seções; fluxo verdadeiro conhecido
  const R = 2, Cc = 2, E = [100, 100, 100], X = [], Y = [];
  let trueFlow = 0;
  [[60, 40, 55, 45, 10], [30, 70, 35, 65, 5], [80, 20, 70, 30, 12]].forEach(([p0, p1, q0, q1, f01], i) => {   // f01: de origem 0 para destino 1
    X.push(p0 / 100, p1 / 100); Y.push(q0 / 100, q1 / 100); trueFlow += f01;
  });
  const b = C.dunDavis(Float64Array.from(X), Float64Array.from(Y), Float64Array.from(E), R, Cc, 0, 1);
  assert.ok(b.lb <= trueFlow && trueFlow <= b.ub, 'lb ' + b.lb + ' ub ' + b.ub + ' verdade ' + trueFlow);
  assert.ok(b.ub >= b.lb && b.mass === 170 + 0 + 0 + 0 || b.mass > 0);
});

test('wlsFE recupera a inclinação dentro de grupos e o erro-padrão por conglomerado é razoável', () => {
  const r = C.rng(9), G = 120, per = 30, n = G * per, y = new Float64Array(n), x = new Float64Array(n), w = new Float64Array(n).fill(1), fe = new Int32Array(n);
  const ge = Array.from({ length: G }, () => 5 * C.gauss(r));
  for (let i = 0; i < n; i++) { const g = Math.floor(i / per); fe[i] = g; x[i] = C.gauss(r) + 0.8 * ge[g]; y[i] = 2 * x[i] + 3 * ge[g] + C.gauss(r); }
  const m = C.wlsFE({ y, cols: [x], w, fe, nFe: G, cl: fe, nCl: G });
  assert.ok(Math.abs(m.beta[0] - 2) < 4 * m.se[0] + 0.02, 'beta ' + m.beta[0] + ' se ' + m.se[0]);
  assert.ok(m.se[0] > 0 && m.se[0] < 0.1);
  // sem efeito fixo, o viés de omitir o grupo aparece (prova de que o FE faz diferença)
  const m0 = C.wlsFE({ y, cols: [x], w, fe: null, cl: fe, nCl: G });
  assert.ok(Math.abs(m0.beta[0] - 2) > Math.abs(m.beta[0] - 2));
});

test('permuteWithin preserva os grupos', () => {
  const groups = Int32Array.from([0, 0, 0, 1, 1, 2, 2, 2, 2]), perm = C.permuteWithin(groups, 3, C.rng(2));
  for (let i = 0; i < groups.length; i++) assert.equal(groups[perm[i]], groups[i]);
  assert.deepEqual(Array.from(perm).sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});
