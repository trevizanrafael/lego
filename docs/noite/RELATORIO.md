# Relatório da Execução Noturna — Cidade Real + 60–80 FPS

> Branch: `main` (conforme autorização explícita do usuário)
> Base inicial: `0d8fadc`

---

## Decisões Confirmadas com o Usuário no Início
1. **Metas de FPS:** 60 FPS no preset **Médio** e 80+ FPS no **Baixo** (1080p).
2. **Materiais & Fachadas:** Autorizado unificar materiais, deduplicar paleta e usar atlas/famílias de janelas mantendo a estética Noir (`IDV.md`).
3. **Distância de Visão & Névoa:** Autorizado reduzir `camera.far` (~3 km) casado com névoa densa (*smog noir*).
4. **Sombras:** Desligar sombras dinâmicas no **Baixo** (usando sombra de contato sob personagens/veículos) e orçar/espaçar sombras no Médio/Ultra.
5. **Rede Viária & Marcos:** Liberdade total para curvar/girar vias e ajustar traçado para parecer cidade real.
6. **Centro:** Liberdade total para criar eixo monumental, diagonais, praças e variedade real de silhuetas/térreos.
7. **Favela CDD:** Reconstrução completa do miolo em curvas de nível, becos estreitos, escadarias e tecido contínuo, preservando Campinho, Baile, Fortaleza do Barão, Mirante e QG do CV.
8. **Estilo da Favela CDD:** Favela realista brasileira (~80%+ tijolo baiano aparente / reboco cinza rústico / chapisco / ferragem + ~20% pintura desbotada, lajes, caixas d'água e gatos de fiação), em `< 40` draw calls.
9. **Periferia Natural:** Serra com mata ao norte/oeste e restinga/mangue perto da costa, eliminando placas retangulares lisas.
10. **Git:** Commits e pushes diretos na `main` ao fim de cada marco.

---

## M0 & M1 — Instrumentação (`?perf=1`), Benchmark Headless & Baseline
- Criado [PerfOverlay.js](../../src/debug/PerfOverlay.js) (`?perf=1`, `window.__legoPerf`, `renderer.info.autoReset = false` com reset único por frame e telemetria tabular por subsistema).
- Criado [run-bench.mjs](../../tools/bench/run-bench.mjs) (Playwright + Chromium local servindo `three` local, medindo 10 regiões + 6 pontos extras + `overview.jpg`).
- Testes adicionados: [perf-overlay.test.js](../../tests/perf-overlay.test.js).
- Baseline salvo em `docs/noite/bench-M0.json` e `docs/noite/M0/*.jpg` (`14.166` meshes, `1.198` materiais únicos, `4.956` shadowCasters, `506` transparentes, `camera.far = 23.400 m`).

## M2 — Unificação de Materiais, 4 Famílias de Fachada, Orçamento de Sombras & Pipeline Noir
- Criados [MaterialRegistry.js](../../src/graphics/MaterialRegistry.js), [BuildingFamiliesAndAtlas.js](../../src/world/buildings/BuildingFamiliesAndAtlas.js), [ShadowBudgetController.js](../../src/graphics/ShadowBudgetController.js) e [perf-budget.test.js](../../tests/perf-budget.test.js).
- Placas 3D empacotadas em páginas de Atlas `2048×256` em [SignBoardHelper.js](../../src/utils/SignBoardHelper.js) e fachadas costeiras consolidadas em 4 famílias `MeshStandardMaterial` em [BeachfrontSkyscrapersBuilder.js](../../src/world/regions/south-beach/BeachfrontSkyscrapersBuilder.js).
- Resultados medidos (`docs/noite/bench-M2.json` vs `M0`):
  - `shadowCasters`: **`4.956` → `186`** (`-96,2%`, `0` no preset Baixo + sombras de contato instanciadas).
  - `physicalMaterials`: **`562` → `17`** (`-97,0%`).
  - `uniqueMaterials`: **`1.198` → `216`** (`165` na cena base; será reduzido a `< 140` após batching estático/ocupantes no M3).
  - `camera.far`: **`23.400 m` → `3.100 m`** com `FogExp2` Noir (`0.00082`), Bloom em meia-resolução e DRS piso `0.70`.
  - Draw calls já caíram de `3.245 → 1.167` (`praia_sul`), `2.863 → 1.225` (`X_port_close`) e `1.885 → 636` (`ilha_prisao`).

*(Os próximos marcos M3–M9 serão registrados abaixo conforme concluídos.)*
