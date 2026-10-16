'use strict';
// Valida o MÉTODO em mundos sintéticos com efeitos plantados (e documenta um limite conhecido: efeito contextual).
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scripts/est-sim.js');
const R = require('../scripts/est-run.js');
const CFG = { nBoot: 80, nBootSens: 30, nBootUf: 20, nPerm: 30, minClustersUf: 20 };
const run = (o, extra) => R.analyze(S.makeThreeWave(Object.assign({ seed: 21, nMun: 200 }, o)), Object.assign({}, CFG, extra));

test('sem migração plantada: SEM_SINAL; com 5% plantado: SINAL_PRESENTE e estimativa perto de 5%', () => {
  const a = run({ mLF: 0 }), b = run({ mLF: 0.05 });
  assert.equal(a.verdicts.q1, 'SEM_SINAL'); assert.equal(a.verdicts.q1Final, 'SEM_SINAL_AGREGADO');
  assert.equal(b.verdicts.q1, 'SINAL_PRESENTE');
  assert.ok(Math.abs(b.verdicts.q1Detail.est - 0.05) < 0.01, 'est ' + b.verdicts.q1Detail.est);
  assert.ok(b.verdicts.q1Detail.lo < 0.05 + 0.01 && b.verdicts.q1Detail.hi > 0.05 - 0.01);
});

test('voto útil plantado: gradiente de competitividade NEGATIVO; sem plantar: NULO', () => {
  assert.equal(run({ strat: 0 }).verdicts.q2Gradient, 'NULO');
  const s = run({ strat: 0.3 });
  assert.equal(s.verdicts.q2Gradient, 'NEGATIVO');
  assert.ok(s.strategic.m1.beta[0] < -1);
});

test('acréscimo "emprestado" plantado: razão de retenção cai (EM_JOGO); sem plantar: ADIANTADO', () => {
  const a = run({ accStray: 0 }), b = run({ accStray: 0.9 });
  assert.equal(a.verdicts.q2Rho.F, 'ADIANTADO'); assert.equal(a.verdicts.q2Rho.L, 'ADIANTADO');
  assert.equal(b.verdicts.q2Rho.F, 'EM_JOGO'); assert.ok(b.retention.rhoF.est < 0.3);
});

test('LIMITE CONHECIDO: efeito contextual (abstenção→Flávio em áreas lulistas) imita migração; o veredito final NÃO afirma migração', () => {
  const r = run({ mLF: 0, ctxA: 0.05 });
  assert.equal(r.verdicts.q1, 'SINAL_PRESENTE');                         // o sinal agregado aparece (é o problema)
  assert.equal(r.verdicts.q1Final, 'PADRAO_SEM_CONFIRMACAO');             // mas sem pesquisas o texto não pode afirmar migração
  const E = require('../scripts/est-report.js');
  assert.ok(/não se pode afirmar/.test(E.verdictText(r).q1));
  // o perfil por gradiente mostra POR ONDE o ganho foi compensado: aqui, pelos não-válidos (mobilização), não por Lula
  const m = run({ mLF: 0.05, ctxA: 0 });
  assert.ok(r.channels.dNV.onL2.beta < m.channels.dNV.onL2.beta - 0.03, 'não-válidos devem cair mais no cenário contextual');
  assert.ok(m.channels.dL.onL2.beta < r.channels.dL.onL2.beta - 0.03, 'Lula deve cair mais no cenário de migração');
});

test('triangulação com pesquisas muda o veredito final de forma previsível', () => {
  const ds = S.makeThreeWave({ seed: 21, nMun: 200, mLF: 0.05 });
  const mk = (value) => R.analyze(ds, Object.assign({}, CFG, { surveys: [{ fonte: 'P', data: '2026-10-08', n: 2000, moe: 0.02, value }] })).verdicts;
  assert.equal(mk(0.05).q1Final, 'MIGRACAO_APOIADA');
  assert.equal(mk(0.0).q1Final, 'PADRAO_CONTESTADO');
});

test('identidade contábil por zona: dL + dF + dO + dNV = 0; quadrantes somam 1; determinismo', () => {
  const a = run({ mLF: 0.03 }), b = run({ mLF: 0.03 });
  a.zones.rows.forEach((z) => assert.ok(Math.abs(z.dL + z.dF + z.dO + z.dNV) < 1e-9));
  const q = a.zones.quadrants; assert.ok(Math.abs(Object.values(q).reduce((s, x) => s + x, 0) - 1) < 1e-9);
  assert.equal(a.transition.key[0].est, b.transition.key[0].est);
  assert.equal(a.strategic.permutation.pEmp, b.strategic.permutation.pEmp);
});

test('linhas da matriz de transição somam 1 e estão em [0,1]', () => {
  const a = run({});
  a.transition.T.forEach((row) => { assert.ok(Math.abs(row.reduce((s, x) => s + x, 0) - 1) < 1e-9); assert.ok(row.every((x) => x >= -1e-12 && x <= 1 + 1e-12)); });
});
