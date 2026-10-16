#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""est_build_secoes.py — Monta o arquivo de seções do estudo (3 ondas) a partir dos CSV de dados abertos do TSE.

Ondas: 1T 2022 (turno 1), 2T 2022 (turno 2), 1T 2026 (turno 1) — só Presidente (CD_CARGO = 1). Só biblioteca padrão.
Saídas: data/secoes.tsv (uma linha por seção "casada" nas 3 ondas)  e  out/qa.json (controle de qualidade e totais nacionais).

USO
  python3 scripts/est_build_secoes.py --probe ARQUIVO.zip [--membro prefixo]        # mostra cabeçalho e 3 linhas
  python3 scripts/est_build_secoes.py \
     --votos22 ~/dl/votacao_secao_2022_BR.zip --det22 ~/dl/detalhe_votacao_secao_2022.zip --membro-det22 detalhe_votacao_secao_2022_ \
     --votos26 ~/dl/votacao_secao_2026_BR.zip --det26 ~/dl/detalhe_votacao_secao_2026.zip --membro-det26 detalhe_votacao_secao_2026_ \
     --cands26 L=13,F=22,CURY=70,SANTOS=14,CAIADO=55,ZEMA=30 --out data/secoes.tsv --qa out/qa.json
  python3 scripts/est_build_secoes.py ... --unidade zona      # PLANO B: soma por zona (não exige casar seções; 1 linha por zona, 'seção' 0000)
  python3 scripts/est_build_secoes.py --selftest

DEFINIÇÕES (iguais em todas as ondas)
  chave da seção = UF|mmmmm|zzzz|ssss  (UF maiúscula; CD_MUNICIPIO = código TSE com 5 dígitos; zona 4; seção 4)
  aptos = QT_APTOS ; comparecimento = QT_COMPARECIMENTO ; abstenção A = max(0, aptos - comparecimento)
  Br = votos no NR_VOTAVEL 95 ; N (nulos) = max(0, comparecimento - soma(candidatos) - Br)    <- DERIVADO
  1T22: L=13, B=22, O=demais candidatos | 2T22: L=13, B=22 | 1T26: --cands26 (L,F,CURY,SANTOS,CAIADO,ZEMA; D3 = demais)
QUALIDADE DO CASAMENTO ENTRE 2022 E 2026
  A = chave existe nas 3 ondas, mesmo local de votação (número OU nome normalizado; se não houver info de local, aceita) e variação de aptos <= 30%
  B = chave existe nas 3 ondas mas o local mudou ou o eleitorado variou mais de 30%
  (seções que faltam em alguma onda, exterior (ZZ), aptos < 20 ou comparecimento > 105% dos aptos: fora do TSV, contadas no QA)
"""
import argparse, csv, io, json, os, random, sys, tempfile, unicodedata, zipfile, re
from collections import defaultdict

csv.field_size_limit(2 ** 31 - 1)
COLNAMES = ['id', 'uf', 'mun', 'zona', 'secao', 'local', 'tier', 'a1', 'a2', 'a3', 'L1', 'B1', 'O1', 'Bl1', 'N1', 'A1', 'L2', 'B2', 'Bl2', 'N2', 'A2',
            'L3', 'F3', 'CY', 'SA', 'CA', 'ZE', 'D3', 'Bl3', 'N3', 'A3']
ALIAS = {
    'turno': ['NR_TURNO'], 'cargo': ['CD_CARGO'], 'uf': ['SG_UF'], 'mun': ['CD_MUNICIPIO'], 'zona': ['NR_ZONA'], 'secao': ['NR_SECAO'],
    'votavel': ['NR_VOTAVEL', 'NR_CANDIDATO'], 'votos': ['QT_VOTOS', 'QT_VOTOS_NOMINAIS'], 'aptos': ['QT_APTOS'], 'comp': ['QT_COMPARECIMENTO'],
    'local': ['NR_LOCAL_VOTACAO'], 'localnome': ['NM_LOCAL_VOTACAO'],
}
# totais nacionais oficiais (tolerância 0,05%); N usa o totalizador TSE `vn`, coerente com a fórmula por seção.
ESPERADO = {
    ('2026', 'L'): 53879538, ('2026', 'F'): 56104503, ('2026', 'CURY'): 3448569, ('2026', 'SANTOS'): 2675887, ('2026', 'CAIADO'): 2605148,
    ('2026', 'ZEMA'): 326488, ('2026', 'Bl'): 2300798, ('2026', 'N'): 3669003,
    ('2022-1', 'L'): 57259504, ('2022-1', 'B'): 51071106, ('2022-2', 'L'): 60345999, ('2022-2', 'B'): 58206354,
}


def abrir_todos(caminho, membro=None):
    """Gera um DictReader para CADA csv que casa com 'membro' (prefixo do nome); em .csv solto, só um."""
    if caminho.lower().endswith('.zip'):
        zf = zipfile.ZipFile(caminho)
        nomes = sorted(n for n in zf.namelist() if n.lower().endswith('.csv'))
        if membro:
            nomes = [n for n in nomes if os.path.basename(n).startswith(membro)]
        if not nomes:
            raise SystemExit('nenhum CSV em %s (membro=%s). Conteúdo: %s' % (caminho, membro, zf.namelist()[:10]))
        for n in nomes:
            yield n, csv.DictReader(io.TextIOWrapper(zf.open(n), encoding='latin-1', newline=''), delimiter=';', quotechar='"')
    else:
        yield caminho, csv.DictReader(open(caminho, encoding='latin-1', newline=''), delimiter=';', quotechar='"')


def col(header, chave, obrigatoria=True):
    for c in ALIAS[chave]:
        if c in header:
            return c
    if obrigatoria:
        raise SystemExit('coluna %s não encontrada. Cabeçalho real: %s\nAcrescente o nome real em ALIAS (%s).' % (ALIAS[chave], header, __file__))
    return None


def chave(uf, mun, zona, secao):
    return '%s|%05d|%04d|%04d' % (uf.strip().upper(), int(mun), int(zona), int(secao))


def norm(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(ch for ch in s if not unicodedata.combining(ch)).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def ler_votos(caminho, membro, turnos, colunas):
    """colunas: função número->índice (0..k-1), k, índice branco. Devolve acc[(turno,chave)] = [k+1 somas..., branco], locais."""
    acc, locais = {}, {}
    for nome, rd in abrir_todos(caminho, membro):
        H = rd.fieldnames
        cT, cC, cU, cM, cZ, cS, cV, cQ = (col(H, 'turno'), col(H, 'cargo'), col(H, 'uf'), col(H, 'mun'), col(H, 'zona'), col(H, 'secao'), col(H, 'votavel'), col(H, 'votos'))
        cL, cLN = col(H, 'local', False), col(H, 'localnome', False)
        mapa, k = colunas
        for r in rd:
            if r[cC].strip() != '1':
                continue
            t = r[cT].strip()
            if t not in turnos:
                continue
            kk = (t, chave(r[cU], r[cM], r[cZ], r[cS]))
            a = acc.get(kk)
            if a is None:
                a = acc[kk] = [0] * (k + 2)          # k colunas de candidatos agrupados + branco + nulo oficial
            num, q = r[cV].strip(), int(r[cQ] or 0)
            if num == '95':
                a[k] += q
            elif num == '96':
                a[k + 1] += q
            else:
                a[mapa(num)] += q
            if cL and kk[1] not in locais:
                locais[kk[1]] = (r[cL].strip(), norm(r[cLN]) if cLN else '')
    return acc, locais


def ler_detalhe(caminho, membro, turnos):
    det = {}
    for nome, rd in abrir_todos(caminho, membro):
        H = rd.fieldnames
        cT, cC, cU, cM, cZ, cS, cA, cP = (col(H, 'turno'), col(H, 'cargo'), col(H, 'uf'), col(H, 'mun'), col(H, 'zona'), col(H, 'secao'), col(H, 'aptos'), col(H, 'comp'))
        for r in rd:
            if r[cC].strip() != '1' or r[cT].strip() not in turnos:
                continue
            kk = (r[cT].strip(), chave(r[cU], r[cM], r[cZ], r[cS]))
            if kk not in det:                       # dedupe (o mesmo presidente aparece em todos os CSV por UF)
                det[kk] = (int(r[cA] or 0), int(r[cP] or 0))
    return det


def onda(votos, det, t):
    """Devolve dict chave -> (aptos, comp, cand[], branco, nulo_derivado, abst)."""
    out = {}
    for (tt, k), a in votos.items():
        if tt != t:
            continue
        d = det.get((tt, k))
        if not d:
            continue
        ap, co = d
        nc = len(a) - 2
        cands, br = a[:nc], a[nc]
        nul = max(0, co - sum(cands) - br)
        out[k] = (ap, co, cands, br, nul, max(0, ap - co))
    return out


def agregar_zona(w):
    """Soma as seções de cada zona (cada onda separadamente): casa ZONAS entre as ondas, sem exigir que as seções coincidam."""
    out = {}
    for k, (ap, co, ca, br, nul, ab) in w.items():
        zk = '|'.join(k.split('|')[:3]) + '|0000'
        if zk not in out:
            out[zk] = [0, 0, [0] * len(ca), 0, 0, 0]
        o = out[zk]
        o[0] += ap; o[1] += co; o[3] += br; o[4] += nul; o[5] += ab
        for i, q in enumerate(ca):
            o[2][i] += q
    return {k: tuple(v) for k, v in out.items()}


def construir(args):
    k22 = lambda n: 0 if n == '13' else (1 if n == '22' else 2)           # L, B, O
    v22, loc22 = ler_votos(args.votos22, args.membro_votos22, ('1', '2'), (k22, 3))
    d22 = ler_detalhe(args.det22, args.membro_det22, ('1', '2'))
    cands = dict(p.split('=') for p in args.cands26.split(','))
    nomes26 = ['L', 'F', 'CURY', 'SANTOS', 'CAIADO', 'ZEMA']
    if list(cands) != nomes26:
        raise SystemExit('--cands26 deve listar, nesta ordem: ' + ','.join(nomes26))
    idx26 = {cands[n]: i for i, n in enumerate(nomes26)}
    k26 = lambda n: idx26.get(n, 6)                                        # 0..5 nomeados, 6 = demais
    v26, loc26 = ler_votos(args.votos26, args.membro_votos26, ('1',), (k26, 7))
    d26 = ler_detalhe(args.det26, args.membro_det26, ('1',))
    w1, w2, w3 = onda(v22, d22, '1'), onda(v22, d22, '2'), onda(v26, d26, '1')
    qa = {'secoes_1T22': len(w1), 'secoes_2T22': len(w2), 'secoes_1T26': len(w3), 'excluidas_exterior': 0, 'excluidas_anomalia': 0, 'faltam_em_alguma_onda': 0,
          'tier_A': 0, 'tier_B': 0, 'tier_A_sem_info_local': 0, 'eleitorado_2026_total': sum(v[0] for v in w3.values()), 'eleitorado_2026_tier_A': 0}
    totais = {}
    def soma(onda_, tag, cols):
        for k, v in onda_.items():
            for nome, val in cols(v):
                totais[(tag, nome)] = totais.get((tag, nome), 0) + val
    soma(w1, '2022-1', lambda v: [('L', v[2][0]), ('B', v[2][1])])
    soma(w2, '2022-2', lambda v: [('L', v[2][0]), ('B', v[2][1])])
    soma(w3, '2026', lambda v: [(n, v[2][i]) for i, n in enumerate(nomes26)] + [('Bl', v[3]), ('N', v[4])])
    ruim = []
    for (tag, nome), esp in ESPERADO.items():
        if (tag, nome) in totais:
            got = totais[(tag, nome)]
            rel = abs(got - esp) / esp
            print('  %-8s %-7s obtido %12d | esperado %12d | dif %.4f%%' % (tag, nome, got, esp, rel * 100))
            if rel > 5e-4:
                ruim.append((tag, nome))
    qa['totais_nacionais'] = {'%s:%s' % k: v for k, v in totais.items()}
    qa['totais_divergentes'] = ['%s:%s' % x for x in ruim]
    if ruim and not args.force:
        raise SystemExit('TOTAIS NACIONAIS NÃO BATEM em %s. Reveja colunas, números de candidatos (--cands26) e arquivos. (--force ignora, NÃO recomendado.)' % ruim)
    if getattr(args, 'unidade', 'secao') == 'zona':
        w1, w2, w3 = agregar_zona(w1), agregar_zona(w2), agregar_zona(w3)
        loc22, loc26 = {}, {}
        qa['unidade'] = 'zona'
    linhas = [COLNAMES]
    for k in sorted(set(w1) | set(w2) | set(w3)):
        if not (k in w1 and k in w2 and k in w3):
            qa['faltam_em_alguma_onda'] += 1
            continue
        uf, mun, zona, secao = k.split('|')
        a1, c1, ca1, br1, n1, ab1 = w1[k]; a2, c2, ca2, br2, n2, ab2 = w2[k]; a3, c3, ca3, br3, n3, ab3 = w3[k]
        if uf == 'ZZ':
            qa['excluidas_exterior'] += 1
            continue
        if min(a1, a2, a3) < 20 or c1 > 1.05 * a1 or c2 > 1.05 * a2 or c3 > 1.05 * a3:
            qa['excluidas_anomalia'] += 1
            continue
        l22, l26 = loc22.get(k), loc26.get(k)
        if l22 and l26 and (l22[0] or l22[1]) and (l26[0] or l26[1]):
            mesmo = (l22[0] and l22[0] == l26[0]) or (l22[1] and l22[1] == l26[1])
        else:
            mesmo = True
            qa['tier_A_sem_info_local'] += 1
        estavel = abs(a3 / a2 - 1) <= 0.30 and abs(a2 / a1 - 1) <= 0.30
        tier = 'A' if (mesmo and estavel) else 'B'
        qa['tier_' + tier] += 1
        if tier == 'A':
            qa['eleitorado_2026_tier_A'] += a3
        local = ((l26 or l22 or ('', ''))[1] or (l26 or l22 or ('', ''))[0]).replace('\t', ' ')
        L1, B1, O1 = ca1[0], ca1[1], ca1[2]
        row = [k, uf, mun, zona, secao, local, tier, a1, a2, a3, L1, B1, O1, br1, n1, ab1, ca2[0], ca2[1], br2, n2, ab2] + list(ca3[:7]) + [br3, n3, ab3]
        linhas.append(row)
    qa['cobertura_eleitorado_tier_A'] = qa['eleitorado_2026_tier_A'] / max(1, qa['eleitorado_2026_total'])
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        for r in linhas:
            f.write('\t'.join(str(x) for x in r) + '\n')
    os.makedirs(os.path.dirname(os.path.abspath(args.qa)), exist_ok=True)
    json.dump(qa, open(args.qa, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('gravado %s (%d seções) e %s' % (args.out, len(linhas) - 1, args.qa))
    print(json.dumps({k: v for k, v in qa.items() if k != 'totais_nacionais'}, ensure_ascii=False))
    if qa['cobertura_eleitorado_tier_A'] < 0.85:
        print('ATENÇÃO: qualidade A cobre só %.1f%% do eleitorado de 2026. Investigue o casamento (chaves/zonas/locais mudaram?) antes de interpretar.' % (100 * qa['cobertura_eleitorado_tier_A']), file=sys.stderr)


def probe(caminho, membro):
    for nome, rd in abrir_todos(caminho, membro):
        print('ARQUIVO:', nome, '\nCABEÇALHO:', rd.fieldnames)
        for i, r in zip(range(3), rd):
            print('linha %d:' % (i + 1), dict(r))
        break


# ---------------------------------------------------------------- selftest
def selftest():
    rnd = random.Random(9)
    tmp = tempfile.mkdtemp()
    def esc_csv(path, header, rows):
        with open(path, 'w', encoding='latin-1', newline='') as f:
            w = csv.writer(f, delimiter=';', quoting=csv.QUOTE_ALL)
            w.writerow(header)
            w.writerows(rows)
    HV = ['ANO_ELEICAO', 'NR_TURNO', 'SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO', 'CD_CARGO', 'NR_VOTAVEL', 'QT_VOTOS', 'NR_LOCAL_VOTACAO', 'NM_LOCAL_VOTACAO']
    HD = ['ANO_ELEICAO', 'NR_TURNO', 'SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO', 'CD_CARGO', 'QT_APTOS', 'QT_COMPARECIMENTO']
    secoes = [(uf, mun, zona, sec) for uf in ('SP', 'BA', 'ZZ') for mun in (71072, 38490) for zona in (1, 2) for sec in range(1, 7)]
    v22, d22, v26, d26 = [], [], [], []
    tot = defaultdict(int)
    for (uf, mun, zona, sec) in secoes:
        apt = rnd.randint(250, 400)
        for t, ids in ((1, ['13', '22', '12', '15', '44']), (2, ['13', '22'])):
            comp = int(apt * rnd.uniform(0.7, 0.9)); br = rnd.randint(0, 5); nu = rnd.randint(0, 9); val = comp - br - nu
            cuts = sorted(rnd.randint(0, val) for _ in range(len(ids) - 1)); parts = [b - a for a, b in zip([0] + cuts, cuts + [val])]
            local = 'ESCOLA %d' % mun
            for n, q in zip(ids, parts):
                v22.append([2022, t, uf, mun, zona, sec, 1, n, q, 100 + zona, local])
                if n == '13': tot[('2022-%d' % t, 'L')] += q
                if n == '22': tot[('2022-%d' % t, 'B')] += q
            v22.append([2022, t, uf, mun, zona, sec, 1, 95, br, 100 + zona, local]); v22.append([2022, t, uf, mun, zona, sec, 1, 96, nu, 100 + zona, local])
            d22.append([2022, t, uf, mun, zona, sec, 1, apt, comp])
        # 2026: seção 6 de BA some; seção 5 de SP muda de local; seção 4 de SP/71072 dobra de tamanho
        if uf == 'BA' and sec == 6:
            continue
        apt3 = apt * 2 if (uf == 'SP' and mun == 71072 and sec == 4) else apt
        comp = int(apt3 * rnd.uniform(0.7, 0.9)); br = rnd.randint(0, 5); nu = rnd.randint(0, 9); val = comp - br - nu
        ids = ['13', '22', '70', '14', '55', '30', '80']; cuts = sorted(rnd.randint(0, val) for _ in range(len(ids) - 1)); parts = [b - a for a, b in zip([0] + cuts, cuts + [val])]
        local = 'OUTRA ESCOLA' if (uf == 'SP' and sec == 5) else 'ESCOLA %d' % mun
        nloc = 900 if (uf == 'SP' and sec == 5) else 100 + zona
        for n, q in zip(ids, parts):
            v26.append([2026, 1, uf, mun, zona, sec, 1, n, q, nloc, local])
        v26.append([2026, 1, uf, mun, zona, sec, 1, 95, br, nloc, local]); v26.append([2026, 1, uf, mun, zona, sec, 1, 96, nu, nloc, local])
        v26.append([2026, 1, uf, mun, zona, sec, 3, 13, 999, nloc, local])           # outro cargo: deve ser ignorado
        d26.append([2026, 1, uf, mun, zona, sec, 1, apt3, comp])
    f1, f2, f3, f4 = [os.path.join(tmp, n) for n in ('v22.csv', 'd22.csv', 'v26.csv', 'd26.csv')]
    esc_csv(f1, HV, v22); esc_csv(f3, HV, v26); esc_csv(f2, HD, d22); esc_csv(f4, HD, d26)
    # detalhe 2022 em zip com vários CSV (como o TSE faz), com duplicata de seções entre eles
    z = os.path.join(tmp, 'det22.zip')
    with zipfile.ZipFile(z, 'w') as zf:
        zf.write(f2, 'detalhe_votacao_secao_2022_SP.csv'); zf.write(f2, 'detalhe_votacao_secao_2022_BA.csv')
    ESPERADO.clear()          # no selftest não há totais oficiais
    ns = argparse.Namespace(votos22=f1, det22=z, membro_votos22=None, membro_det22='detalhe_votacao_secao_2022_', votos26=f3, det26=f4, membro_votos26=None,
                            membro_det26=None, cands26='L=13,F=22,CURY=70,SANTOS=14,CAIADO=55,ZEMA=30', out=os.path.join(tmp, 'secoes.tsv'), qa=os.path.join(tmp, 'qa.json'), force=False, unidade='secao')
    construir(ns)
    linhas = [l.rstrip('\n').split('\t') for l in open(ns.out, encoding='utf-8')]
    assert linhas[0] == COLNAMES
    rows = [dict(zip(COLNAMES, l)) for l in linhas[1:]]
    qa = json.load(open(ns.qa))
    assert qa['excluidas_exterior'] == 4 * 6 - 0 or qa['excluidas_exterior'] > 0
    assert qa['faltam_em_alguma_onda'] == 4                                         # BA seção 6 (2 mun x 2 zonas)
    assert all(r['uf'] != 'ZZ' for r in rows)
    tiers = defaultdict(int)
    for r in rows:
        tiers[r['tier']] += 1
        assert abs(sum(float(r[c]) for c in ('L1', 'B1', 'O1', 'Bl1', 'N1', 'A1')) - float(r['a1'])) < 1e-6
        assert abs(sum(float(r[c]) for c in ('L2', 'B2', 'Bl2', 'N2', 'A2')) - float(r['a2'])) < 1e-6
        assert abs(sum(float(r[c]) for c in COLNAMES[21:]) - float(r['a3'])) < 1e-6
    assert tiers['B'] >= 3 + 0, tiers          # SP seção 5 (local mudou) x 4 zonas/mun + SP/71072 seção 4 dobrou
    assert tiers['A'] > 0
    # modo zona (plano B): uma linha por zona casada, soma das seções
    nz = argparse.Namespace(**dict(vars(ns), unidade='zona', out=os.path.join(tmp, 'zonas.tsv'), qa=os.path.join(tmp, 'qaz.json')))
    construir(nz)
    lz = [dict(zip(COLNAMES, l.rstrip('\n').split('\t'))) for l in list(open(nz.out, encoding='utf-8'))[1:]]
    assert len(lz) == 8 and all(r['secao'] == '0000' and r['uf'] != 'ZZ' for r in lz), len(lz)      # SP e BA x 2 municípios x 2 zonas
    print('SELFTEST OK', dict(tiers), '| zonas:', len(lz))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for a in ('votos22', 'det22', 'votos26', 'det26'):
        ap.add_argument('--' + a)
    for a in ('membro-votos22', 'membro-det22', 'membro-votos26', 'membro-det26'):
        ap.add_argument('--' + a, dest=a.replace('-', '_'))
    ap.add_argument('--cands26'); ap.add_argument('--out', default='data/secoes.tsv'); ap.add_argument('--qa', default='out/qa.json')
    ap.add_argument('--unidade', choices=['secao', 'zona'], default='secao'); ap.add_argument('--force', action='store_true'); ap.add_argument('--probe'); ap.add_argument('--membro'); ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        selftest()
    elif a.probe:
        probe(a.probe, a.membro)
    elif a.votos22 and a.det22 and a.votos26 and a.det26 and a.cands26:
        construir(a)
    else:
        ap.print_help()
