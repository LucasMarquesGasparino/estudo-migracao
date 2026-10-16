# Estudo de votação por seção: 2T22 × 1T26

Estudo descritivo com dados eleitorais abertos do TSE, implementado em JavaScript puro (Node 18+) e Python 3 padrão. O objetivo é comparar padrões por seção; totais agregados não identificam escolhas individuais.

## Preparar dados

Mantenha os ZIPs do TSE fora deste repositório, por exemplo em `~/dl/`. Confira os cabeçalhos com `--probe` e gere os dados e QA:

```sh
python3 scripts/est_build_secoes.py --votos22 ~/dl/votacao_secao_2022_BR.zip \
  --det22 ~/dl/detalhe_votacao_secao_2022.zip --membro-det22 detalhe_votacao_secao_2022_ \
  --votos26 ~/dl/votacao_secao_2026_BR.zip \
  --det26 ~/dl/detalhe_votacao_secao_2026.zip --membro-det26 detalhe_votacao_secao_2026_ \
  --cands26 L=13,F=22,CURY=70,SANTOS=14,CAIADO=55,ZEMA=30 \
  --out data/secoes.tsv --qa out/qa.json
```

Confira todos os portões de `out/qa.json` antes de interpretar. Se a cobertura A ficar abaixo de 85%, siga o plano B documentado no plano original e registre no relatório a unidade usada. Nunca use `--force` para contornar uma divergência.

## Executar

```sh
npm test
python3 scripts/est_build_secoes.py --selftest
node --max-old-space-size=3072 scripts/est-run.js data/secoes.tsv out/resultados.json --surveys data/pesquisas.json --qa out/qa.json
node scripts/est-make-report.js out/resultados.json out/qa.json out/estudo.html
```

`data/secoes.tsv` é gerado localmente e ignorado pelo Git. Os ZIPs e CSVs brutos também ficam fora do projeto. A triangulação disponível está documentada em `data/pesquisas.json`; a margem do subgrupo foi dobrada porque a fonte não a informa.
