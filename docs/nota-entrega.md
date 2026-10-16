# Diagnóstico final

Análise executada em 16/10/2026 com as seções de qualidade A e os limiares pré-registrados. Os resultados estatísticos usam a amostra A; a tabela de absolutos separa essa amostra dos totais de todas as seções presentes na base usada pelo app.

## Conferência dos valores absolutos

Os votos de candidatos calculados a partir dos CSVs do TSE coincidem com os JSONs que alimentam o placar:

| Onda | Votos conferidos |
|---|---|
| 1º turno 2022 | Lula 57.259.504; Bolsonaro 51.072.345 |
| 2º turno 2022 | Lula 60.345.999; Bolsonaro 58.206.354 |
| 1º turno 2026 | Lula 53.879.538; Flávio 56.104.503; Cury 3.448.569; Renan Santos 2.675.887; Caiado 2.605.148; Zema 326.488; demais 260.655; brancos 2.300.798; nulos 3.674.249 |

Em 2022, o detalhe completo soma 156.454.011 aptos, enquanto a base de seções com votação soma 156.453.354; 657 aptos aparecem apenas no detalhe. Comparecimento e votos de candidatos coincidem. A tabela mostra os dois totais de aptos separados.

Em 2026, a base do app contém 499.206 seções e 158.745.007 aptos. O totalizador oficial do TSE separa 158.745.079 aptos em seções apuradas e 423 em 41 seções não apuradas; o arquivo de detalhe completo soma 158.745.502. A base de votação fica 72 aptos abaixo do eleitorado apurado porque há uma seção apurada sem linha no arquivo de votação. A abstenção é 33.469.172 na base do app, 33.469.244 nas seções apuradas do totalizador e 33.469.667 pela conta `QT_APTOS − comparecimento` no detalhe completo. O relatório mostra essas bases em linhas separadas. Votos válidos (119.300.788), brancos, nulos, comparecimento (125.275.835) e nulos técnicos (5.246) batem com o [totalizador JSON do TSE](https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json).

O arquivo `fallback-2022.json` do app é um vetor por zona reescalado para o eleitorado-base usado pelo motor de simulação; não representa os totais nacionais observados de 2022. A conferência dos absolutos de 2022 usa os CSVs do TSE e `2022-presidencia-cidades.json`.

## Pergunta 1 — Houve migração agregada de Lula para Flávio?

**Diagnóstico: `SEM_SINAL_AGREGADO`.** O fluxo estimado de Lula no 2º turno de 2022 para Flávio no 1º turno de 2026 é 0,00% (IC95% 0,00%–0,57%), abaixo do limiar pré-registrado de 2%. Os limites determinísticos são largos (0%–70,4%) e, sozinhos, não descartam fluxos maiores. Totais por seção não identificam a trajetória individual de cada eleitor.

A pesquisa BTG/Nexus [citada pela Exame](https://exame.com/brasil/de-lula-para-flavio-bolsonaro-e-cury-quem-sao-os-eleitores-que-admitem-virar-a-casaca/) reportou intenção de 6% entre entrevistados que disseram ter votado em Lula em 2022. A margem aplicada ao subgrupo é ±4 p.p. conforme o plano, formando intervalo de 2%–10%, sem sobreposição com o intervalo ecológico. A margem do subgrupo não foi publicada, então foi usado o dobro da margem geral; pesquisa mede intenção declarada, não voto efetivo.

## Pergunta 2 — Os votos de Flávio estavam “adiantados” do 2º turno de 2022?

**Diagnóstico: retenção intermediária.** A razão de retenção de Flávio é 0,38 (IC95% 0,33–0,44): parte do acréscimo de Bolsonaro entre o 1º e o 2º turno de 2022 já aparece associada a Flávio no 1º turno de 2026, e parte segue em jogo. Para Lula, a razão equivalente é 0,64 (IC95% 0,59–0,69), também intermediária. Essas razões descrevem associação entre componentes eleitorais; não demonstram a trajetória de eleitores individuais.

## Teste complementar — voto estratégico (H3)

O gradiente é **positivo**, no sentido oposto ao previsto pela hipótese: por unidade de competitividade K, as seções mais disputadas em 2022 tiveram +1,91 p.p. de votos válidos nos demais candidatos em 2026 (EP 0,07; p empírico da permutação 0,010). Nenhuma das 23 UFs analisadas teve coeficiente negativo e significativo. Este teste não sustenta o padrão esperado de voto estratégico; não prova ausência de voto útil por outros mecanismos.

## Qualidade e arquivos

- Seções A: 427.597; B: 32.692; 48.796 chaves não aparecem nas três ondas; uma seção excluída por anomalia.
- A cobertura A é 86,81% do eleitorado apurado de 2026 (denominador 158.745.079). Os absolutos da amostra A não devem ser lidos como totais nacionais.
- `out/resultados.json` contém os totais da base capturada em `meta.sourceTotals`, os totais do detalhe completo em `meta.sourceDetailTotals` e a comparação com o JSON nacional em `meta.sourceJson2026`.
- Artefatos: `out/estudo.html`, `out/zonas.csv`, `out/resultados.json` e `out/qa.json`. Dados brutos e `data/secoes.tsv` ficam fora do Git.
