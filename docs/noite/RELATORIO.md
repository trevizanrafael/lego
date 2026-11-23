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

## M4 — Rede Viária Unificada da Ilha, Interseções Chanfradas, Costa Orgânica Chaikin & Oceano 4-Oitavas
- **Rede Viária Hierárquica Unificada ([CityRoadNetworkSpec.js](../../src/world/terrain/CityRoadNetworkSpec.js) + [RoadIntersectionsBuilder.js](../../src/world/terrain/RoadIntersectionsBuilder.js)):**
  - Corredores classificados em 4 níveis (`expressway`: 10, `arterial`: 21, `collector`: 46, `local`: 42) + 8 conectores orgânicos inter-bairros (`Subúrbio Norte`, `Canal Oeste`, `Aeroporto/Base Militar`, `Orla Sul`, `Canal Leste` e `Porto`).
  - Esquinas com raios chanfrados (*bellmouth fillets*), faixas de pedestres oblíquas e **6 praças triangulares urbanas arborizadas** (`+0,22 m`) nas bifurcações em Y, mescladas diretamente nos buckets estáticos (`0` malhas soltas extras).
  - Grafo policial A* unificado em [PoliceOrganicGraphHelper.js](../../src/world/police/PoliceOrganicGraphHelper.js): **`2.907` nós ativos em `1` único componente conexo (`isolatedComponentsCount === 0`)** cobrindo todas as regiões + inclinações longitudinais auditadas (`<= 12%` em arteriais, `<= 18%` nas ladeiras).
  - Nova suíte [city-network.test.js](../../tests/city-network.test.js) (`4/4` testes verdes).
- **Costa Suavizada Chaikin, Costuras de Terreno & Shader de Oceano ([CoastlineProfile.js](../../src/world/CoastlineProfile.js), [OceanAndPangaeaMeshBuilder.js](../../src/world/terrain/OceanAndPangaeaMeshBuilder.js), [SceneAndWaterShaders.js](../../src/materials/modules/SceneAndWaterShaders.js)):**
  - Polígonos costeiros suavizados por Chaikin preservando âncoras exatas do rio (`538..582`), bocas dos 3 canais de Santos, Marina, Mega Píer, Cais Leste e Ponte da Prisão; ilhotas convertidas de pirâmides quadradas (`Math.max`) para domos elípticos suaves; fita contínua de praia/baixio substituindo caixas escalonadas; normais analíticas por diferenças centrais eliminando costuras entre chunks de terreno; shader de água com 4 ondas não-ortogonais e atenuação por distância eliminando moiré no horizonte.
- **Validação (`docs/noite/bench-M4.json`):** **`189/189` testes passando nas 35 suítes** (`meshes = 2.964`, `shadowCasters = 182`, `uniqueGeometries = 2.147`, `invalidColliders = 0`, `pageErrors = []`).

## M5 — Centro Real (Subdivisão de Lotes, Eixo Monumental, Contraste Arquitetônico) & Corte Global de Triângulos (`< 1,5M` em Todas as 16 Vistas)
- **Urbanismo Real no Centro ([LotSubdivision.js](../../src/world/buildings/LotSubdivision.js), [BlockLotFiller.js](../../src/world/buildings/BlockLotFiller.js), [DetailedBuildingBuilder.js](../../src/world/buildings/DetailedBuildingBuilder.js), [DowntownBlocksAndSkyscrapers.js](../../src/world/regions/downtown/DowntownBlocksAndSkyscrapers.js)):**
  - Subdivisão não-cartesiana de parcelas com frentes reais variando de **`13 m` a `56 m`** (lotes estreitos de meio de quadra `13–21 m` com prédios históricos baixos de `3–6` andares em tijolo/arenito `15–28 m` colados ao lado de torres corporativas `podium_tower` e Art-Deco de `140–218 m`, mais pátios/vielas internas `>= 8,5 m`).
  - **Eixo Monumental do Super Banco Central** (`x in [-58, +58], z in [-505, -245]`) livre de obstruções, emoldurado por alameda de granito, fileiras duplas de árvores e torres gêmeas simétricas; **Esplanada Cívica da Torre dos Heróis** aberta a sul e leste dos portais.
  - Empenas cegas (*party walls*) nos lotes estreitos, vitrines comerciais iluminadas (`4,5–6,2 m`) com toldos variados no térreo e suíte [downtown-urban-design.test.js](../../tests/downtown-urban-design.test.js) (`4/4` verdes).
- **Revolução no Orçamento de Triângulos, Frustum Culling & Zero Spikes ([ChunkedBuildingLodBatcher.js](../../src/world/buildings/ChunkedBuildingLodBatcher.js), [WorldBatchingAndFreeze.js](../../src/world/core/WorldBatchingAndFreeze.js), [PedestrianSharedGeometriesAndArchetypes.js](../../src/world/living-city/PedestrianSharedGeometriesAndArchetypes.js), [CombatUnitsAndConvoys3D.js](../../src/world/factions/CombatUnitsAndConvoys3D.js)):**
  - Geometrias dedicadas low-poly para multidão de pedestres (`>465k` triângulos/frame economizados), `BUILDING_LOD_CHUNK_SIZE = 620` (`LOD1 = 220 m`, `LOD2 = 640 m`), `computeBoundingSphere()` em todos os `InstancedMesh`es estáticos, particionamento regional de super-buckets/cercas e pools recicláveis de soldados/comboios + fila escalonada `_pendingSpawnQueue`.
- **Resultados Medidos (`docs/noite/bench-M5.json`, `195/195` testes passando em 37 suítes):**
  - **TODAS as 16 vistas agora estão abaixo de `1,5M` triângulos (`0,76M` a `1,44M`, redução de `-75%` vs `4,88M–6,21M`)!**
  - `centro_financeiro`: `4,88M → 1,21M` tris (`DC = 490`); `torre_herois`: `4,69M → 1,14M` tris (`DC = 367`); `parque_central`: `5,61M → 1,44M` tris; `suburbio_norte`: `3,39M → 0,95M` tris (`DC = 334`); `industrial_leste`: `3,14M → 0,88M` tris (`DC = 316`); `X_ind_close`: `2,33M → 0,76M` tris (`DC = 300`, `FAC = 0,35 ms`, `p90 = 0,40 ms`); `X_fav_aerial`: `3,79M → 0,98M` tris (`DC = 364`).
  - Cena total: `meshes = 2.870 < 3.000`, `uniqueGeometries = 2.085 < 2.500`, `shadowCasters = 186 < 400`, `invalidColliders = 0`, `SetbackOverBox = 0`.

## M6 — Favela CDD Real em Encosta (`< 40` Draw Calls), Atlas Tijolo/Reboco & Zero Spike em QG Aliado
- **Tecido Orgânico em Curvas de Nível ([FavelaContoursAndAlleys.js](../../src/world/regions/favela-cdd/FavelaContoursAndAlleys.js), [FavelaHouseModules.js](../../src/world/regions/favela-cdd/FavelaHouseModules.js), [FavelaParcelFiller.js](../../src/world/regions/favela-cdd/FavelaParcelFiller.js), [FavelaElevationAndBatcher.js](../../src/world/regions/favela-cdd/FavelaElevationAndBatcher.js)):**
  - Substituídas as tiras retas paralelas por curvas de nível orgânicas (`99,66%` dos lotes fora de `0°/90°`, apenas `0,34%` alinhados aos eixos), 3 ladeiras dirigíveis (`slope <= 10,6%`), 20 escadões com corrimão de ferro, postes tortos com fiação de "gatos", 126 biroscas de esquina, 2 igrejinhas comunitárias e ponto de mototáxi.
  - Atlas procedural `512×512` em 4 quadrantes (**Tijolo Baiano 8 furos**, **Reboco Mal Feito Parcial**, **Chapisco Cinza Rústico** e **Pintura Desbotada**) com `83,4%` alvenaria crua/reboco rústico e colina dividida em 5 faixas Z sem plano avermelhado liso.
  - Orçamento da Favela inteira: **`20` malhas estáticas + `9` FX = `29` malhas totais (`< 40`)**, validado em [favela-fabric.test.js](../../tests/favela-fabric.test.js) (`4/4` verdes). *(Nota visual: na inspeção de `M6/X_fav_close_aerial.jpg`, identificamos folgas entre fitas de nível que serão adensadas parede-com-parede + `THREE.LOD` de 2 níveis já na onda paralela do M7.)*
- **Consolidação do Super Banco, Torre dos Heróis & Guarnição Aliada ([GarrisonPeaceAndAlliesAI.js](../../src/world/factions/GarrisonPeaceAndAlliesAI.js), [SuperBankExteriorAndLobby.js](../../src/world/regions/downtown/SuperBankExteriorAndLobby.js), [HeroTowerComplexBuilder.js](../../src/world/regions/downtown/HeroTowerComplexBuilder.js)):**
  - `X_fav_close`: `FAC` caiu de **`58,65 ms` (`p90 = 233,6 ms`) → `0,42 ms` (`p90 = 0,60 ms`)**; `SuperBank` + `HeroTower` consolidados em `8` malhas estáticas.
  - **`199/199` testes passando nas 38 suítes** (`docs/noite/bench-M6.json`).

*(Os próximos marcos M7–M9 serão registrados abaixo conforme concluídos.)*
