'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scripts/est-sim.js');
test('mundo sintético: determinístico; cada onda soma o eleitorado; matrizes plantadas somam 1', () => {
  const a = S.makeThreeWave({ seed: 2, nMun: 20 }), b = S.makeThreeWave({ seed: 2, nMun: 20 }), c = S.makeThreeWave({ seed: 3, nMun: 20 });
  assert.deepEqual(Array.from(a.w3.slice(0, 20)), Array.from(b.w3.slice(0, 20)));
  assert.notDeepEqual(Array.from(a.w3.slice(0, 20)), Array.from(c.w3.slice(0, 20)));
  for (let i = 0; i < a.n; i++) {
    let s1 = 0, s2 = 0, s3 = 0, k;
    for (k = 0; k < 6; k++) s1 += a.w1[i * 6 + k]; for (k = 0; k < 5; k++) s2 += a.w2[i * 5 + k]; for (k = 0; k < 10; k++) s3 += a.w3[i * 10 + k];
    assert.ok(Math.abs(s1 - a.a1[i]) < 1e-6 && Math.abs(s2 - a.a2[i]) < 1e-6 && Math.abs(s3 - a.a3[i]) < 1e-6);
  }
  S.t23(0.05, 0.01).forEach((row) => assert.ok(Math.abs(row.reduce((x, y) => x + y, 0) - 1) < 1e-12 && row.every((v) => v >= 0)));
});
