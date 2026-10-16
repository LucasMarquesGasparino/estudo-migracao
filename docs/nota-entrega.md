# Nota de entrega

Análise executada em 16/10/2026, com as seções de qualidade A e os limiares pré-registrados.

- **H1 — Lula (2T22) → Flávio (1T26):** `SEM_SINAL_AGREGADO`; estimativa 0,00% dos eleitores de Lula no 2T22 (IC95% 0,00%–0,57%), abaixo do limiar de relevância de 2%.
- **H2 — votos adiantados:** retenção de Flávio `INTERMEDIARIO`, razão 0,38 (IC95% 0,33–0,44); retenção de Lula `INTERMEDIARIO`, razão 0,64 (IC95% 0,59–0,69).
- **H3 — gradiente de voto estratégico:** `POSITIVO`; seções mais competitivas em 2022 tiveram mais votos nos demais candidatos em 2026, na direção oposta à hipótese de voto útil.
- **Qualidade:** cobertura A de 86,81% do eleitorado de 2026; 427.597 seções A e 32.692 B; uma seção excluída por anomalia; 48.796 chaves não aparecem nas três ondas; nenhum total nacional divergente.
- **Triangulação:** uma pesquisa BTG/Nexus publicada pela [Exame](https://exame.com/brasil/de-lula-para-flavio-bolsonaro-e-cury-quem-sao-os-eleitores-que-admitem-virar-a-casaca/) reportou 6% de intenção declarada em Flávio entre entrevistados que disseram ter votado em Lula em 2022. O subgrupo não teve margem própria publicada; foi usada a margem de 4 p.p. prevista no plano, e o intervalo não sobrepõe o IC ecológico.

Os totais por seção não identificam o voto de cada pessoa. Este estudo não permite afirmar que eleitores específicos migraram, nem atribuir causalidade ao voto útil. A pesquisa mede intenção declarada antes do 1º turno de 2026, não o voto efetivo.

Os artefatos pedidos pelo plano estão em `out/estudo.html`, `out/zonas.csv`, `out/resultados.json` e `out/qa.json`. Dados brutos e `data/secoes.tsv` ficam fora do Git.
