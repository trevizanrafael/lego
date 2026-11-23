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

## M3 — Batching Estático Global, Veículos `trafficLite`, IA de Guerra 10 Hz & Warmup Completo
- Consolidados lotes estáticos em chunks (`1.200 m` / `3.600 m` na Pangeia externa) e decomposição automática das placas 6-materiais em malhas de atlas único em [WorldBatchingAndFreeze.js](../../src/world/core/WorldBatchingAndFreeze.js).
- Agrupamento `THREE.LOD` da orla em chunks (`840 m`) em [BeachfrontSkyscrapersBuilder.js](../../src/world/regions/south-beach/BeachfrontSkyscrapersBuilder.js) e do centro em [ChunkedBuildingLodBatcher.js](../../src/world/buildings/ChunkedBuildingLodBatcher.js) (teste `anti-flicker-and-lod.test.js` atualizado para validar `>= 30` torres em `southBeachHotels` + `>= 6` chunks `THREE.LOD` em `southBeachHotelLODs`).
- Frota estacionada, carretas portuárias e trânsito IA unificados em modo `trafficLite` com promoção automática sob demanda ao embarcar (`upgradeTrafficLiteCarIfNeeded`), bustos de ocupantes mesclados por Vertex Color ([VehicleOccupants.js](../../src/world/vehicles/VehicleOccupants.js)), faróis/lanternas do trânsito em 2 `InstancedMesh`es globais ([VehicleNightLightsRig.js](../../src/world/atmosphere/VehicleNightLightsRig.js)), cercas/caixas de correio instanciadas ([SuburbHouseGenerator.js](../../src/world/SuburbHouseGenerator.js)) e embarcações/aeronaves *studless*.
- Grade espacial 2D (`24 m`) + IA 10 Hz escalonada + pools zero-GC em [InvasionWarAndSquadCombatAI.js](../../src/world/factions/InvasionWarAndSquadCombatAI.js), culling com histerese no trânsito ([TrafficNetworkAndVehicleAI.js](../../src/world/living-city/TrafficNetworkAndVehicleAI.js)) e warmup dos 15 blueprints de soldados + famílias de fachada em [ShaderWarmupRig.js](../../src/graphics/ShaderWarmupRig.js).
- Resultados medidos (`docs/noite/bench-M3.json` vs `M0`, `185/185` testes verdes):
  - `meshes`: **`14.166` → `2.966`** (`-79,1%`, dentro da meta `< 3.000`).
  - `uniqueGeometries`: **`10.237` → `2.151`** (`-79,0%`, dentro da meta `< 2.500`).
  - `shadowCasters`: **`4.956` → `181`** (`-96,3%`, dentro da meta `< 400`).
  - `transparentMeshes`: **`506` → `90`** (`74` na cena base auditada em `perf-budget.test.js`, `< 80`).
  - `factionWar.update` (`industrial_leste`): **`51,40 ms` (`p90 = 148,50 ms`) → `0,42 ms` (`p90 = 0,60 ms`)** (`-99,2%`).
  - Draw calls por vista: `praia_sul` `3.245 → 541` (`-83,3%`), `X_port_close` `2.863 → 566` (`-80,2%`), `torre_herois` `402`, `suburbio_norte` `342`, `industrial_leste` `329`, `porto_leste` `449`, `aeroporto_oeste` `369`, `ilha_prisao` `364`, `X_fav_aerial` `393`, `X_sky_downtown` `427`.
  - Tempo de quadro em `centro_financeiro`: **`avg = 9,05 ms` (~110 FPS), `p90 = 12,1 ms` (~82 FPS)**.

*(Os próximos marcos M4–M9 serão registrados abaixo conforme concluídos.)*
