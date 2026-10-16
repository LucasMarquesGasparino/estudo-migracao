'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../scripts/est-sim.js'), R = require('../scripts/est-run.js'), P = require('../scripts/est-report.js'), V = require('../scripts/est-svg.js');
const CFG = { nBoot: 50, nBootSens: 20, nBootUf: 15, nPerm: 15, minClustersUf: 20 };
const res = R.analyze(S.makeThreeWave({ seed: 4, nMun: 120, mLF: 0.04, strat: 0.1 }), CFG);

test('relatório: seções obrigatórias, autossuficiente, SVG e tabelas balanceados', () => {
  const html = P.render(res, { generatedAt: '2026-10-20', qa: { secoes_tier_A: 100 } });
  ['resumo', 'dados', 'visao', 'zonas', 'fluxos', 'espelho', 'votoutil', 'robustez', 'triangulacao', 'limites', 'reproducao'].forEach((id) => assert.ok(html.includes('id="' + id + '"'), 'falta seção ' + id));
  assert.equal((html.match(/<svg /g) || []).length, (html.match(/<\/svg>/g) || []).length);
  assert.equal((html.match(/<table/g) || []).length, (html.match(/<\/table>/g) || []).length);
  assert.ok(!/(src|href)="https?:/.test(html), 'não pode haver recursos externos');
  assert.ok(!/<script/.test(html));
  assert.ok(/Projeção|compatível com|inconclusivo|Não há sinal/.test(html));
  assert.ok(html.includes('nunca como prova'));
});

test('textos dos veredictos: nunca afirmam migração sem pesquisas', () => {
  const t = P.verdictText(res);
  assert.ok(!/evidência convergente/i.test(t.q1), 'sem pesquisas não pode haver "evidência convergente"');
  assert.ok(/não se pode afirmar|Não há sinal|inconclusivo/i.test(t.q1)); assert.ok(t.q2.length === 2);
});

test('CSV por zona: cabeçalho + uma linha por zona', () => {
  const csv = P.zonesCsv(res).split('\n');
  assert.equal(csv.length, res.zones.rows.length + 1);
  assert.ok(csv[0].startsWith('uf;municipio;zona'));
});

test('gráficos SVG: escapam texto e geram elementos', () => {
  const s = V.barH({ items: [{ label: 'a<b', value: 0.5, lo: 0.4, hi: 0.6 }, { label: 'c', value: -0.2 }] });
  assert.ok(s.includes('a&lt;b') && s.includes('<rect') && s.startsWith('<svg') && s.endsWith('</svg>'));
  const sc = V.scatter({ points: [{ x: 0, y: 0 }, { x: 1, y: 2, r: 3 }], line: { a: 0, b: 2 }, diag: true });
  assert.equal((sc.match(/<circle/g) || []).length, 2);
});
