'use strict';
// Caminho completo: dataset sintético -> TSV (formato do construtor Python) -> parseTsvLines -> analyze  (+ selftest do construtor Python)
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');
const S = require('../scripts/est-sim.js'), R = require('../scripts/est-run.js');

function toTsv(ds) {
  const lines = [R.COLNAMES.join('\t')];
  for (let i = 0; i < ds.n; i++) {
    const row = ['x|' + i, ds.ufNames[ds.uf[i]], String(ds.mun[i]).padStart(5, '0'), String(ds.zone[i]).padStart(4, '0'), String(i % 1000).padStart(4, '0'), 'ESCOLA', 'A', ds.a1[i], ds.a2[i], ds.a3[i]];
    for (let c = 0; c < 6; c++) row.push(ds.w1[i * 6 + c]);
    for (let c = 0; c < 5; c++) row.push(ds.w2[i * 5 + c]);
    for (let c = 0; c < 10; c++) row.push(ds.w3[i * 10 + c]);
    lines.push(row.join('\t'));
  }
  return lines;
}
test('TSV -> dataset -> análise dá o mesmo resultado que o dataset direto', () => {
  const ds = S.makeThreeWave({ seed: 8, nMun: 60, mLF: 0.04 }), cfg = { nBoot: 30, nBootSens: 10, nBootUf: 10, nPerm: 10, minClustersUf: 8 };
  const back = R.parseTsvLines(toTsv(ds));
  assert.equal(back.n, ds.n);
  const a = R.analyze(ds, cfg), b = R.analyze(back, cfg);
  assert.ok(Math.abs(a.transition.key[0].est - b.transition.key[0].est) < 1e-6, a.transition.key[0].est + ' vs ' + b.transition.key[0].est);
});
test('cabeçalho de TSV inválido é rejeitado', () => { assert.throws(() => R.parseTsvLines(['a\tb', '1\t2'])); });
test('construtor Python: selftest', { skip: (() => { try { execFileSync('python3', ['--version']); return false; } catch (e) { return 'sem python3'; } })() }, () => {
  const out = execFileSync('python3', [path.join(__dirname, '..', 'scripts', 'est_build_secoes.py'), '--selftest'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  assert.ok(out.includes('SELFTEST OK'));
});
