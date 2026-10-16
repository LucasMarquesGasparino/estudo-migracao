/* est-report.js — Gera o relatório HTML (autossuficiente, sem recursos externos) a partir do objeto de resultados de est-run.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./est-svg.js'));
  else root.EstReport = factory(root.EstSvg);
})(typeof self !== 'undefined' ? self : this, function (Svg) {
  'use strict';
  var esc = Svg.esc;
  function pct(x, d) { return (x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }) + '%'; }
  function pp(x, d) { return (x >= 0 ? '+' : '−') + Math.abs(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }) + ' p.p.'; }
  function int(n) { return Math.round(n).toLocaleString('pt-BR'); }
  function num(x, d) { return x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function find(arr, name) { return arr.filter(function (x) { return x.name === name; })[0]; }

  /* Textos dos veredictos — ÚNICOS lugares onde se afirma algo. Linguagem sempre "compatível com", nunca "prova". */
  function verdictText(res) {
    var v = res.verdicts, d = v.q1Detail, thr = res.meta.cfg.migRelevant, q1, q2 = [];
    var nums = pct(d.est) + ' dos eleitores de Lula no 2º turno de 2022 (IC95%: ' + pct(d.lo) + ' a ' + pct(d.hi) + '; ≈ ' + int(d.votes) + ' votos)';
    var caveat = ' Dados agregados não distinguem migração individual de outras explicações com o mesmo padrão (por exemplo, mobilização de abstenção em áreas de maioria lulista): em simulação, um efeito desse tipo gera exatamente o mesmo sinal.';
    if (v.q1Final === 'SEM_SINAL_AGREGADO') q1 = 'Não há sinal agregado de migração de Lula (2T22) para Flávio (1T26): a estimativa é ' + nums + ', abaixo do limiar de relevância de ' + pct(thr, 0) + '. Isso descreve o efeito líquido em nível de seção; trocas individuais pequenas ou compensadas por fluxos inversos não aparecem.';
    else if (v.q1Final === 'MIGRACAO_APOIADA') q1 = 'Há evidência convergente de migração de Lula (2T22) para Flávio (1T26): estimativa agregada de ' + nums + ', mantida em ' + d.specsAbove + ' de ' + d.specs + ' especificações, e consistente com as pesquisas de opinião reunidas (seção Triangulação).';
    else if (v.q1Final === 'PADRAO_CONTESTADO') q1 = 'Os dados agregados mostram um padrão compatível com migração de Lula (2T22) para Flávio (1T26) — ' + nums + ' —, mas as pesquisas de opinião reunidas divergem desse valor. Não é possível afirmar migração individual.' + caveat;
    else if (v.q1Final === 'PADRAO_SEM_CONFIRMACAO') q1 = 'Os dados agregados mostram um padrão compatível com migração de Lula (2T22) para Flávio (1T26): ' + nums + ', mantido em ' + d.specsAbove + ' de ' + d.specs + ' especificações. Sem dados individuais (pesquisas) para confirmar, não se pode afirmar que houve migração.' + caveat;
    else q1 = 'Resultado inconclusivo sobre migração de Lula (2T22) para Flávio (1T26): estimativa de ' + nums + ', com intervalo que inclui valores acima e abaixo do limiar de relevância de ' + pct(thr, 0) + '.';
    var rf = res.retention.rhoF, rl = res.retention.rhoL;
    q2.push('Voto útil como gradiente de competitividade: ' + ({
      NEGATIVO: 'em seções onde o 2º turno de 2022 foi mais disputado, os candidatos "outros" têm menos votos em 2026 (dentro do mesmo município) — padrão compatível com voto estratégico.',
      NULO: 'não foi encontrada relação entre competitividade em 2022 e votos nos "outros" em 2026 (dentro do mesmo município) — o teste não detecta voto estratégico.',
      POSITIVO: 'seções mais disputadas em 2022 tiveram MAIS votos nos "outros" em 2026 — oposto ao esperado sob voto estratégico.'
    })[v.q2Gradient]);
    q2.push('Votos "adiantados" de Flávio: o acréscimo líquido de Bolsonaro entre o 1º e o 2º turno de 2022 foi retido por Flávio no 1T26 a ' + num(rf.est, 2) + ' da taxa do núcleo do 1º turno de 2022 (IC95%: ' + num(rf.lo, 2) + ' a ' + num(rf.hi, 2) + ') — ' + ({
      ADIANTADO: 'compatível com a ideia de que o eleitorado do 2º turno de 2022 já se reuniu no 1º turno de 2026.',
      INTERMEDIARIO: 'retenção parcial: parte desse acréscimo já está com Flávio, parte segue em jogo.',
      EM_JOGO: 'o acréscimo do 2º turno de 2022 praticamente não reapareceu com Flávio no 1º turno: continua em disputa.'
    })[v.q2Rho.F] + ' Para Lula, a razão equivalente é ' + num(rl.est, 2) + ' (IC95%: ' + num(rl.lo, 2) + ' a ' + num(rl.hi, 2) + ').');
    return { q1: q1, q2: q2 };
  }

  var CSS = 'body{font:16px/1.5 system-ui,sans-serif;max-width:920px;margin:0 auto;padding:12px;color:#1b1b1b;background:#fff}h1{font-size:1.5rem}h2{margin-top:2rem;border-bottom:2px solid #ddd;padding-bottom:4px}' +
    '.box{border:1px solid #bbb;border-left:6px solid #2a6fb0;padding:8px 12px;margin:10px 0;background:#f6f9fc}.warn{border-left-color:#c77700;background:#fff8ee}' +
    'table{border-collapse:collapse;width:100%;font-size:.85rem}th,td{border:1px solid #ddd;padding:3px 6px;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#f0f0f0}' +
    '.wrap{overflow-x:auto}.chart{width:100%;height:auto;max-width:700px}.small{font-size:.8rem;color:#555}code{background:#eee;padding:0 3px}' +
    '@media (prefers-color-scheme:dark){body{background:#151515;color:#e6e6e6}.box{background:#1d2630;border-color:#445}.warn{background:#2b2418}th{background:#262626}th,td{border-color:#444}h2{border-color:#444}code{background:#333}}';

  function table(head, rows, opt) {
    opt = opt || {};
    return '<div class="wrap"><table><thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td' + (c && c.style ? ' style="' + c.style + '"' : '') + '>' + (c && c.html !== undefined ? c.html : esc(c)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function heat(x) { var a = Math.min(1, Math.max(0, x)); return 'background:rgba(42,111,176,' + (0.08 + 0.55 * a).toFixed(2) + ')'; }

  function render(res, meta) {
    meta = meta || {};
    var N = res.national, T = res.transition, vt = verdictText(res), h = [], i;
    h.push('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Migração de votos: 2º turno 2022 × 1º turno 2026</title><style>' + CSS + '</style></head><body>');
    h.push('<h1>Migração de votos: 2º turno de 2022 × 1º turno de 2026</h1><p class="small">Gerado em ' + esc(meta.generatedAt || '') + ' · seções analisadas: ' + int(res.meta.sample.n) + ' em ' + int(res.meta.sample.municipalities) + ' municípios e ' + int(res.meta.sample.zones) + ' zonas · fonte: TSE (dados abertos)</p>');
    // ---- resumo
    h.push('<h2 id="resumo">Resumo</h2>');
    h.push('<div class="box"><b>Houve migração de votos de Lula para Flávio nas zonas?</b><p>' + esc(vt.q1) + '</p></div>');
    h.push('<div class="box"><b>Os votos de Flávio são votos "adiantados" do 2º turno (voto útil)?</b>' + vt.q2.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>');
    h.push('<div class="box warn"><b>Como ler:</b> este estudo usa totais por seção (inferência ecológica). Ele descreve padrões entre lugares; não observa o voto de cada pessoa. As conclusões acima valem como "compatível com", nunca como prova. Regras de decisão fixadas antes de ver os dados: seção Reprodução.</div>');
    // ---- dados
    h.push('<h2 id="dados">Dados e amostra</h2>');
    var qa = meta.qa;
    if (qa) h.push(table(['Item', 'Valor'], Object.keys(qa).map(function (k) { return [k, typeof qa[k] === 'number' ? int(qa[k]) : JSON.stringify(qa[k])]; })));
    else h.push('<p class="small">Sem arquivo de qualidade (qa.json) anexado.</p>');
    // ---- visão geral
    h.push('<h2 id="visao">Visão geral (nível nacional, amostra analisada)</h2>');
    h.push(Svg.barH({ items: [
      { label: 'Lula (2T22 → 1T26)', value: N.delta.L, color: '#c0392b' }, { label: 'Bolsonaro → Flávio', value: N.delta.F, color: '#2a6fb0' },
      { label: 'Outros candidatos (novos)', value: N.delta.OUT, color: '#8e7cc3' }, { label: 'Brancos+nulos+abstenção', value: N.delta.NV, color: '#888' }], fmt: function (x) { return pp(x); } }));
    h.push('<p class="small">Variação em pontos percentuais do ELEITORADO (o denominador é fixo, então as quatro barras somam zero).</p>');
    h.push(table(['', '2º turno 2022', '1º turno 2026'], [
      ['Lula', int(N.votes.L2) + ' (' + pct(N.pp.L2) + ' do eleitorado)', int(N.votes.L3) + ' (' + pct(N.pp.L3) + ')'],
      ['Bolsonaro / Flávio', int(N.votes.B2) + ' (' + pct(N.pp.B2) + ')', int(N.votes.F3) + ' (' + pct(N.pp.F3) + ')'],
      ['Outros candidatos', '—', int(N.votes.OUT3) + ' (' + pct(N.pp.OUT3) + ')'], ['Brancos+nulos+abstenção', pct(N.pp.NV2), pct(N.pp.NV3)]]));
    // ---- zonas
    var Z = res.zones, pts = Z.rows.map(function (r) { return { x: r.dL, y: r.dF, r: Math.max(1.5, Math.min(7, Math.sqrt(r.E3) / 55)) }; });
    h.push('<h2 id="zonas">Zonas eleitorais</h2>');
    h.push(Svg.scatter({ points: pts, xlabel: 'Variação de Lula (p.p. do eleitorado)', ylabel: 'Variação Bolsonaro→Flávio (p.p.)', fmtX: function (t) { return (t * 100).toFixed(0); }, fmtY: function (t) { return (t * 100).toFixed(0); }, line: { a: Z.slope.intercept, b: Z.slope.est } }));
    h.push('<p>Cada ponto é uma zona (tamanho ∝ eleitorado). Eleitorado em zonas onde <b>Lula caiu e Flávio subiu</b>: ' + pct(Z.quadrants['L↓F↑'], 1) + '; ambos caíram: ' + pct(Z.quadrants['L↓F↓'], 1) + '; Lula subiu e Flávio subiu: ' + pct(Z.quadrants['L↑F↑'], 1) + '; Lula subiu e Flávio caiu: ' + pct(Z.quadrants['L↑F↓'], 1) + '. Inclinação ponderada de ΔFlávio sobre ΔLula: ' + num(Z.slope.est, 2) + ' (EP ' + num(Z.slope.se, 2) + '); correlação ponderada: ' + num(Z.corr, 2) + '.</p>');
    var byL = Z.rows.slice().sort(function (a, b) { return a.dL - b.dL; }).slice(0, res.meta.cfg.topN), byF = Z.rows.slice().sort(function (a, b) { return b.dF - a.dF; }).slice(0, res.meta.cfg.topN);
    var zrow = function (r) { return [r.uf + ' · ' + r.mun + ' · ' + r.zone, int(r.E3), pp(r.dL), pp(r.dF), pp(r.dO), pp(r.dNV)]; };
    h.push('<h3>Zonas com maior queda de Lula</h3>' + table(['Zona', 'Eleitorado 2026', 'Δ Lula', 'Δ Flávio', 'Δ Outros', 'Δ Não-válidos'], byL.map(zrow)));
    h.push('<h3>Zonas com maior alta de Flávio</h3>' + table(['Zona', 'Eleitorado 2026', 'Δ Lula', 'Δ Flávio', 'Δ Outros', 'Δ Não-válidos'], byF.map(zrow)));
    h.push('<p class="small">Arquivo completo por zona: <code>zonas.csv</code> (gerado junto com este relatório).</p>');
    // ---- fluxos
    h.push('<h2 id="fluxos">Fluxos estimados: 2º turno 2022 → 1º turno 2026</h2>');
    var head = ['Origem (2T22) \\ Destino (1T26)'].concat(T.cols), rows = T.rows.map(function (rn, r) { return [rn].concat(T.cols.map(function (cn, c) { return { html: pct(T.T[r][c], 1), style: heat(T.T[r][c]) }; })); });
    h.push(table(head, rows)); h.push('<p class="small">Cada linha soma 100%. L=Lula, F=Flávio, CY=Cury, SA=Renan Santos, CA=Caiado, ZE=Zema, D3=demais, Bl=brancos, N=nulos, A=abstenção. Estimativa por mínimos quadrados com restrições (0 ≤ taxa ≤ 1, linhas somam 1).</p>');
    var kf = T.key.map(function (k) { var b = T.bounds[k.name]; return [k.name, pct(k.est), pct(k.lo) + ' a ' + pct(k.hi), int(k.votes), b ? pct(b.lbShare, 1) + ' a ' + pct(b.ubShare, 1) : '—']; });
    h.push('<h3>Fluxos-chave</h3>' + table(['Fluxo', 'Estimativa', 'IC95%', 'Votos (≈)', 'Limites determinísticos (Duncan–Davis)'], kf));
    h.push('<p class="small">Os limites mostram o que é matematicamente possível com os totais; costumam ser largos. O IC vem de reamostragem por município.</p>');
    h.push('<h3>De onde vêm os votos de Flávio no 1T26 (composição por origem em 2022)</h3>' + Svg.barH({ items: T.composition.F3.map(function (c) { return { label: c.from, value: c.est, lo: c.lo, hi: c.hi, color: '#2a6fb0' }; }), fmt: function (x) { return pct(x, 1); } }));
    h.push('<h3>De onde vêm os votos de Lula no 1T26</h3>' + Svg.barH({ items: T.composition.L3.map(function (c) { return { label: c.from, value: c.est, lo: c.lo, hi: c.hi, color: '#c0392b' }; }), fmt: function (x) { return pct(x, 1); } }));
    h.push('<h3>De onde vêm os votos dos outros candidatos no 1T26</h3>' + Svg.barH({ items: T.composition.OUT3.map(function (c) { return { label: c.from, value: c.est, lo: c.lo, hi: c.hi, color: '#8e7cc3' }; }), fmt: function (x) { return pct(x, 1); } }));
    var ur = res.byUf.map(function (u) { if (u.skipped) return [u.uf, '(poucos municípios)', '', '', '']; var g = function (n) { return find(u.key, n); }; return [u.uf, int(u.clusters), pct(g('L2→F3').est) + ' (' + pct(g('L2→F3').lo) + ' a ' + pct(g('L2→F3').hi) + ')', pct(g('B2→F3').est, 1), pct(g('L2→L3').est, 1)]; });
    h.push('<h3>Por UF</h3>' + table(['UF', 'Municípios', 'Lula-2T22 → Flávio (IC95%)', 'Bolsonaro-2T22 → Flávio', 'Lula-2T22 → Lula'], ur));
    // ---- espelho e canais
    h.push('<h2 id="espelho">Onde a perda de Lula reaparece (identidade contábil)</h2>');
    var mrow = function (lab, arr) { return [lab].concat(arr.map(function (x) { return pct(x.share, 0) + ' (EP ' + pct(x.se, 0) + ')'; })); };
    h.push(table(['Para cada 1 p.p. que …', arr0(res.mirror.perdaLula, 0), arr0(res.mirror.perdaLula, 1), arr0(res.mirror.perdaLula, 2)], [mrow('Lula perdeu (vs 2T22), na mesma cidade, aparece em:', res.mirror.perdaLula), mrow('Flávio ganhou (vs Bolsonaro 2T22), aparece de:', res.mirror.ganhoFlavio)]));
    function arr0(a, i) { return { dF: 'Flávio', dO: 'Outros', dNV: 'Não-válidos', dL: 'Lula' }[a[i].to]; }
    h.push('<p class="small">Descrição de padrão dentro do município (efeito fixo): mostra onde "reaparece" o espaço deixado, não quem votou em quem. Valores dependem da base de comparação.</p>');
    var ch = res.channels, crow = function (nm, k) { return [nm, num(ch[k].onL2.beta, 3) + ' (' + num(ch[k].onL2.se, 3) + ')', num(ch[k].onB2.beta, 3) + ' (' + num(ch[k].onB2.se, 3) + ')']; };
    h.push('<h3>Perfil por gradiente: quanto cada variação muda com a % de Lula / Bolsonaro no 2T22</h3>' + table(['Variação (p.p. do eleitorado) por 1 ponto a mais de …', 'eleitorado Lula 2T22', 'eleitorado Bolsonaro 2T22'], [crow('Δ Lula', 'dL'), crow('Δ Flávio', 'dF'), crow('Δ Outros', 'dO'), crow('Δ Não-válidos', 'dNV')]));
    h.push('<p class="small">Referência: não-válidos do 2T22. As quatro linhas somam zero em cada coluna. Se o ganho de Flávio em áreas lulistas é compensado por queda de Lula, o padrão é de substituição; se é compensado por queda de não-válidos (mais comparecimento), o padrão é de mobilização. Sem base de comparação, é só um perfil.</p>');
    // ---- voto útil
    var S = res.strategic, m = S.m1;
    h.push('<h2 id="votoutil">Voto útil (estratégico) e votos "adiantados"</h2>');
    h.push('<h3>Teste 1 — competitividade em 2022 × votos nos "outros" em 2026</h3>');
    h.push('<p>Na mesma cidade (efeito fixo de município), seções mais disputadas no 2º turno de 2022 (K próximo de 1) tiveram, em média, <b>' + num(m.beta[0], 2) + ' p.p.</b> (EP ' + num(m.se[0], 2) + ') a mais de votos válidos nos "outros" por unidade de K. Permutação (K embaralhado dentro do município, ' + S.permutation.draws + ' sorteios): p empírico = ' + num(S.permutation.pEmp, 3) + '. Sob voto estratégico espera-se sinal <b>negativo</b>.</p>');
    h.push(table(['Modelo', 'Coef. de K', 'EP', 'p', 'n'], [['1: efeito fixo município', num(S.m1.beta[0], 3), num(S.m1.se[0], 3), num(S.m1.p[0], 3), int(S.m1.n)], ['3: efeito fixo zona', num(S.m3.beta[0], 3), num(S.m3.se[0], 3), num(S.m3.p[0], 3), int(S.m3.n)], ['2: com K² (K)', num(S.m2.beta[0], 3), num(S.m2.se[0], 3), num(S.m2.p[0], 3), int(S.m2.n)], ['2: com K² (K²)', num(S.m2.beta[1], 3), num(S.m2.se[1], 3), num(S.m2.p[1], 3), int(S.m2.n)]]));
    h.push(Svg.linePoints({ points: S.bins, xlabel: 'Competitividade 2022 (K), desvio dentro do município', ylabel: '"Outros" 2026 (p.p. dos válidos), desvio', fmtX: function (t) { return t.toFixed(2); }, fmtY: function (t) { return t.toFixed(1); }, line: { a: 0, b: m.beta[0] } }));
    var neg = S.perUf.filter(function (u) { return !u.skipped && u.beta < 0 && Math.abs(u.beta / u.se) > 1.96; }).length, tot = S.perUf.filter(function (u) { return !u.skipped; }).length;
    h.push('<p>Por UF: coeficiente negativo e significativo em ' + neg + ' de ' + tot + ' UFs analisadas.</p>');
    h.push('<h3>Teste 2 — o acréscimo do 2º turno de 2022 voltou em 2026?</h3>');
    var R = res.retention;
    h.push(table(['Resultado 2026 \\ estado em 2022'].concat(R.states), R.table.map(function (t) { return [t.outcome].concat(t.coef.map(function (c) { return num(c.beta, 3) + ' (' + num(c.se, 3) + ')'; })); })));
    h.push('<p><b>Razão de retenção Flávio</b> (acréscimo ÷ núcleo): ' + num(R.rhoF.est, 2) + ' (IC95% ' + num(R.rhoF.lo, 2) + ' a ' + num(R.rhoF.hi, 2) + '). <b>Razão Lula</b>: ' + num(R.rhoL.est, 2) + ' (IC95% ' + num(R.rhoL.lo, 2) + ' a ' + num(R.rhoL.hi, 2) + '). Perto de 1: o acréscimo se comporta como o núcleo (já "adiantado"); perto de 0: continua em jogo.</p>');
    // ---- robustez
    h.push('<h2 id="robustez">Robustez do fluxo Lula (2T22) → Flávio (1T26)</h2>');
    h.push(table(['Especificação', 'n', 'Estimativa', 'IC95%'], res.sensitivity.map(function (s) { return [s.name, int(s.n), pct(s.est), pct(s.lo) + ' a ' + pct(s.hi)]; })));
    // ---- triangulação
    h.push('<h2 id="triangulacao">Triangulação com pesquisas de opinião</h2>');
    var tri = res.verdicts.triangulation;
    if (tri.status === 'NAO_DISPONIVEL') h.push('<p>Nenhuma pesquisa foi incluída. Sem dados individuais, o estudo não consegue separar migração individual de explicações alternativas com o mesmo padrão agregado.</p>');
    else h.push(table(['Fonte', 'Data', 'Valor', 'Margem', 'Sobrepõe o IC do estudo?'], tri.rows.map(function (r) { return [r.fonte, r.data, pct(r.value), pct(r.moe), r.overlaps ? 'sim' : 'não']; })) + '<p class="small">Pesquisas medem intenção/lembrança declarada, não o voto efetivo.</p>');
    // ---- limites
    h.push('<h2 id="limites">Limites</h2><ul>' + [
      'Inferência ecológica: relações entre totais por seção não são relações entre indivíduos.',
      'Um padrão "Lula cai, Flávio sobe" pode vir de migração, de mobilização de abstenção, de renovação do eleitorado ou de efeitos de vizinhança; os dados agregados não separam essas causas (ver simulação de estresse no plano).',
      'Seções mudam entre 2022 e 2026; só entram seções com a mesma chave e local de votação (qualidade A).',
      'O 2º turno de 2022 tinha dois candidatos; o 1º turno de 2026 tem vários: a comparação mistura mudança de preferência com mudança de oferta.',
      'Competitividade medida por 2022 é um proxy; não há medida de percepção de viabilidade em 2026.'].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>');
    // ---- reprodução
    h.push('<h2 id="reproducao">Reprodução e regras pré-registradas</h2>');
    var cfg = res.meta.cfg;
    h.push(table(['Parâmetro', 'Valor'], [['Limiar de fluxo relevante (L→F)', pct(cfg.migRelevant, 1) + ' dos eleitores de Lula-2T22'], ['Razão "adiantado"', '≥ ' + cfg.rhoAdiantado + ' (e limite inferior do IC ≥ 0,5)'], ['Razão "em jogo"', '≤ ' + cfg.rhoEmJogo], ['Reamostragens (bootstrap) / permutações', cfg.nBoot + ' / ' + cfg.nPerm], ['Semente', String(cfg.seed)], ['Amostra', 'qualidade ' + cfg.sampleTiers]]));
    h.push('</body></html>');
    return h.join('\n');
  }
  function zonesCsv(res) {
    var head = ['uf', 'municipio', 'zona', 'secoes', 'eleitorado2026', 'dLula', 'dFlavio', 'dOutros', 'dNaoValidos', 'lula2T22', 'bolsonaro2T22', 'lula1T26', 'flavio1T26'];
    var lines = [head.join(';')];
    res.zones.rows.forEach(function (r) { lines.push([r.uf, r.mun, r.zone, r.sections, Math.round(r.E3), r.dL, r.dF, r.dO, r.dNV, r.L2, r.B2, r.L3, r.F3].map(function (x) { return typeof x === 'number' && !Number.isInteger(x) ? x.toFixed(5).replace('.', ',') : x; }).join(';')); });
    return lines.join('\n');
  }
  return { render: render, verdictText: verdictText, zonesCsv: zonesCsv };
});
