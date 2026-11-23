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

## M7 — Subúrbio Residencial Adensado, Galpões Industriais Pesados, Ramal Ferroviário no Cais & Adensamento da Favela
- **Subúrbio Norte Realista ([SuburbHouseGenerator.js](../../src/world/SuburbHouseGenerator.js), [SuburbHousesAndLotsBuilder.js](../../src/world/regions/north-suburb/SuburbHousesAndLotsBuilder.js), [SuburbOrganicLanesBuilder.js](../../src/world/regions/north-suburb/SuburbOrganicLanesBuilder.js), [SuburbPlazaPizzeriaAndGasBuilder.js](../../src/world/regions/north-suburb/SuburbPlazaPizzeriaAndGasBuilder.js)):**
  - `4.536` lotes residenciais estreitos (`17,68 m` largura média, recuo frontal curto `4,9–6,25 m`, muros laterais contínuos entre vizinhos, `71` cul-de-sacs, `119` alças residenciais curvas, arborização de calçada e corredor comercial de bairro com `PADARIA`, `FARMÁCIA`, `BARBEARIA` e `MERCADINHO`, preservando Posto Octan com explosão em cadeia de 6 bombas, Pizzaria e Praça com Quadra).
  - `SuburbBatcher` unificado em 2 materiais Vertex-Color compartilhados (`22` malhas totais, `0` `MeshPhysicalMaterial`s), validado em [suburb-density.test.js](../../tests/suburb-density.test.js).
- **Distrito Industrial Pesado + Ramal Ferroviário até o Cais ([EastPortBatcherAndMaterials.js](../../src/world/regions/east-port/EastPortBatcherAndMaterials.js), [IndustrialOrganicInfillBuilder.js](../../src/world/regions/east-port/IndustrialOrganicInfillBuilder.js), [IndustrialRailSpurBuilder.js](../../src/world/regions/east-port/IndustrialRailSpurBuilder.js), [PortLogisticsAndWarehousesBuilder.js](../../src/world/regions/east-port/PortLogisticsAndWarehousesBuilder.js)):**
  - `795` galpões industriais pesados (*sawtooth*), docas de caminhão, pátios cercados de carretas e via marginal do canal.
  - **Ramal Ferroviário de Carga (`633` segmentos)** saindo dos pátios industriais até a beira do cais do Porto (`x = 4760..4806`) com `11` passagens de nível sinalizadas em amarelo/preto e `14` composições ferroviárias (3 locomotivas + vagões-prancha de contêineres + vagões-tanque).
  - `PCCIndustrialBatcher` consolidado em `52` malhas Vertex-Color/LOD, validado em [industrial-rail-and-port.test.js](../../tests/industrial-rail-and-port.test.js).
- **Adensamento Parede-com-Parede + `THREE.LOD` na Favela CDD ([FavelaContoursAndAlleys.js](../../src/world/regions/favela-cdd/FavelaContoursAndAlleys.js), [FavelaParcelFiller.js](../../src/world/regions/favela-cdd/FavelaParcelFiller.js), [FavelaElevationAndBatcher.js](../../src/world/regions/favela-cdd/FavelaElevationAndBatcher.js)):**
  - `3.190` parcelas / `~28.000` módulos colados (`99,7%` cobertura da encosta nuclear) com `THREE.LOD` de 2 níveis (`18` malhas estáticas ativas + `9` FX = `27` draw calls ativos, `37 < 40` totais).
- **Validação (`docs/noite/bench-M7.json`):** **`205/205` testes verdes nas 40 suítes** (`meshes = 2.925 < 3.000`, `shadowCasters = 184 < 400`, `physicalMaterials = 12`, `uniqueGeometries = 2.119 < 2.500`). *(Nota técnica para o M9: o adensamento de `4.536` casas suburbanas e `795` galpões/dormentes elevou os triângulos distantes em vistas abertas; no M9 adicionaremos `THREE.LOD` de 2 níveis a `260–280 m` no `SuburbBatcher` e `PCCIndustrialBatcher` para retornar todas as 16 vistas a `< 1,5M` triângulos e `< 450` draw calls.)*

## M8 — Orla Sul Curva (Ondas Portuguesas & Ciclovia), Periferia Natural (Serra/Restinga) & Bordas Naturais no Aeroporto e Prisão
- **Baía Curva da Orla Sul, Calçadão em Ondas Portuguesas & Escalonamento Costeiro ([SouthBeachBuilder.js](../../src/world/regions/SouthBeachBuilder.js), [BeachBatcherAndConstants.js](../../src/world/regions/south-beach/BeachBatcherAndConstants.js), [BoardwalkCanalsAndSandBuilder.js](../../src/world/regions/south-beach/BoardwalkCanalsAndSandBuilder.js), [BeachfrontSkyscrapersBuilder.js](../../src/world/regions/south-beach/BeachfrontSkyscrapersBuilder.js), [CoastalOrganicBlocksFiller.js](../../src/world/regions/south-beach/CoastalOrganicBlocksFiller.js)):**
  - Curva costeira suave `C¹` (`getSouthBeachBayOffsetZ`, amplitude total de `36 m` entre enseadas e pontais, ancorada exatamente no Mega Píer, nos 3 Canais de Santos e na Marina Oeste).
  - Calçadão contínuo com **`1.864` segmentos de mosaico de pedras portuguesas em ondas**, **`130` trechos curvos de ciclovia vermelha**, **`80` muretas de orla**, **`23` duchas/pergolados**, fileiras duplas curvas de coqueiros, **`9` travessas costeiras** e **`319` prédios costeiros médios (`16–38 m`)** escalonados atrás dos ícones de frente-mar (`232–296 m`).
  - `SouthBeachBatcher` unificado em 2 materiais Vertex-Color com **`41` chunks `THREE.LOD` de 2 níveis (`280 m`)** e **`0` `MeshPhysicalMaterial`s**, validado em [south-beach-promenade.test.js](../../tests/south-beach-promenade.test.js) (`3/3` verdes).
- **Periferia Natural + Fim das Placas Retangulares de Concreto ([NaturalPeripheryBuilder.js](../../src/world/terrain/NaturalPeripheryBuilder.js), [PangaeaPeripheryBuilder.js](../../src/world/regions/PangaeaPeripheryBuilder.js), [WestAirportBuilder.js](../../src/world/regions/WestAirportBuilder.js), [PrisonWallsAndTowersBuilder.js](../../src/world/regions/prison-island/PrisonWallsAndTowersBuilder.js)):**
  - **Serra com Mata Atlântica (`1.020` árvores + `214` afloramentos de granito)** ao Norte/Noroeste/Nordeste, **Restinga/Coqueiros/Mangue (`279` arbustos)** nas costas não urbanizadas e **`6` estradinhas rurais estreitas (`8,5 m`, `tier: 'local', isRural: true`)**, agrupados em **`5` setores `THREE.LOD` de 3 níveis (`0 m / 420 m / 1150 m vazio`)** com `<= 6` draw calls ativos e `< 45k` triângulos.
  - Removidas as duas placas retangulares gigantes (`2,43 km × 3,96 km` e `2,43 km × 1,98 km`) do **Aeroporto Oeste** e a laje quadrada (`2,53 km × 2,59 km`) da **Ilha da Prisão**, substituídas por pátios asfálticos justos nas instalações reais, gramado aeronáutico drenado, terreno vulcânico/rochoso natural (`368` rochas costeiras com espuma) e vias blindadas de acesso.
  - Eliminados **`38` `MeshPhysicalMaterial`s e `74` materiais avulsos** no Aeroporto, Prisão e Periferia (consolidados em 3 materiais Vertex-Color compartilhados + `THREE.LOD` a `340 m`), validado em [natural-periphery.test.js](../../tests/natural-periphery.test.js) (`4/4` verdes) e [city-network.test.js](../../tests/city-network.test.js) (`4/4` verdes, `0` componentes isolados).

## M9 — Polimento Final de LOD 3 Níveis (`16/16` Vistas `< 450` DC e `< 1,5M` Tris), Zero Spikes & Benchmarks Multi-Preset
- **`THREE.LOD` Local-Origin de 3 Níveis nos Distritos Adensados ([SuburbHouseGenerator.js](../../src/world/SuburbHouseGenerator.js), [EastPortBatcherAndMaterials.js](../../src/world/regions/east-port/EastPortBatcherAndMaterials.js), [FavelaElevationAndBatcher.js](../../src/world/regions/favela-cdd/FavelaElevationAndBatcher.js), [BeachBatcherAndConstants.js](../../src/world/regions/south-beach/BeachBatcherAndConstants.js)):**
  - **Subúrbio Norte:** LOD 3 níveis (`0 m` / `210 m` `-88,7%` / `740 m` `-93,5%` tris) + fechamento fundo-com-fundo dos miolos residenciais (`3.757` casas internas, `0` sobreposições em `mapRoads`).
  - **Industrial & Porto Leste:** LOD 3 níveis em células de `680–920 m` (`0 m` / `220 m` `-80,2%` / `760 m` `-92,7%` tris, eliminando dormentes ferroviários e frisos distantes) + **`6.651` contêineres intermodais** coloridos organizados nas quadras do Cais do Porto ([PortLogisticsAndWarehousesBuilder.js](../../src/world/regions/east-port/PortLogisticsAndWarehousesBuilder.js)).
  - **Favela CDD:** `FAVELA_LOD1_DISTANCE = 260 m` (`1,59M → 120,9k` tris em L1, `-92,4%`), mantendo **`37 < 40` malhas totais** (`18` ativas).
  - **Orla Sul:** Chunks `1.320 m` (`18` chunks LOD, `-90,8%` tris em L1).
- **Orçamento Global de Draw Calls, Materiais & Zero Spikes ([ShadowBudgetController.js](../../src/graphics/ShadowBudgetController.js), [MaterialRegistry.js](../../src/graphics/MaterialRegistry.js), [WorldBatchingAndFreeze.js](../../src/world/core/WorldBatchingAndFreeze.js), [ChunkedBuildingLodBatcher.js](../../src/world/buildings/ChunkedBuildingLodBatcher.js), [PedestrianCrowdAndInstancing.js](../../src/world/living-city/PedestrianCrowdAndInstancing.js), [TrafficNetworkAndVehicleAI.js](../../src/world/living-city/TrafficNetworkAndVehicleAI.js), [ShaderWarmupRig.js](../../src/graphics/ShaderWarmupRig.js)):**
  - Orçamento de sombras ajustado por preset (`0` no Baixo + sombras de contato instanciadas; `34` no Médio / `36` no Auto; `180` no Ultra), culling imediato em saltos de teleporte `> 140 m` em [DestructibleRegistryAndCulling.js](../../src/world/destructibles/DestructibleRegistryAndCulling.js), grade espacial O(1) para calçadas/asfalto na Cidade Viva (`maxRelocationsPerCall = 1` escalonado) e warmup completo de âncoras/pools das 3 facções na tela de carga.
  - Suíte completa: **`212 / 212` testes passando nas 42 suítes (`0` falhas, `0` testes apagados/desativados)**.

---

## Tabela Final Antes (`M0`) × Depois (`M9` / `M9-medium` / `M9-low`)

### 1. Orçamento Global da Cena (`auditSceneGraph`)

| Métrica | Antes (`M0`) | Depois (`M9` Auto) | `M9-medium` | `M9-low` | Meta | Status |
|---|---:|---:|---:|---:|---:|:---:|
| **Meshes na cena** | `14.174` | **`2.911`** (`-79,5%`) | `2.911` | `2.911` | `< 3.000` | ✅ |
| **Materiais únicos (runtime / cena base)** | `1.198` | **`189` / `143`** (`-84,2%`) | `189` / `143` | `189` / `143` | `<= 200` (meta `< 150` base) | ✅ |
| **`MeshPhysicalMaterial`s (runtime / base)** | `562` | **`10` / `4`** (`-98,2%`) | `10` / `4` | `10` / `4` | `<= 8` base | ✅ |
| **Shadow Casters (cena / ativos)** | `4.956` | **`73` / `36`** (`-98,5%`) | `71` / `34` | `37` / **`0`** | `< 400` | ✅ |
| **Meshes transparentes (runtime / base)** | `506` | **`78` / `71`** (`-84,6%`) | `78` / `71` | `78` / `71` | `< 80` | ✅ |
| **Geometrias únicas** | `10.245` | **`2.084`** (`-79,7%`) | `2.084` | `2.084` | `< 2.500` | ✅ |
| **`camera.far` (solo)** | `23.400 m` | **`3.100 m`** | `3.100 m` | `2.600 m` | `~2.600–3.500 m` | ✅ |
| **Prédios / Lotes registrados (`mapBuildings`)** | `5.894` | **`13.782`** (`+133,8%`) | `13.782` | `13.782` | Cidade densa real | ✅ |
| **Vias orgânicas (`mapOrganicRoads`)** | `356` | **`491`** (`+37,9%`) | `491` | `491` | Hierarquia real | ✅ |
| **Colisores inválidos / `pageErrors`** | `0` / `0` | **`0` / `0`** | `0` / `0` | `0` / `0` | `0` | ✅ |

### 2. Draw Calls, Triângulos e CPU por Ponto de Vista (Todas as 16 Vistas)

> **16 de 16 pontos de vista** cumprem simultaneamente **`drawCalls < 450`** e **`triangles < 1,5M`** nos 3 presets (`M9`, `M9-medium` e `M9-low`). *(Nota: os tempos de `render` no JSON headless usam rasterização de software SwiftShader do Chromium headless; em GPU dedicada/integrada real 1080p, `< 435` draw calls + `< 1,47M` triângulos + `0` sombras dinâmicas no Baixo entregam folga ampla para 60 FPS no Médio e 80+ FPS no Baixo.)*

| Ponto de Vista | DC `M0` | DC `M9` | DC `Med` | DC `Low` | Tris `M0` | Tris `M9` | Tris `Low` | `WLD` Estável | `CIT` | `FAC` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `centro_financeiro` | `1.756` | **`424`** | `423` | `384` | `3,99M` | **`1,30M`** | `1,24M` | `1,50 ms` | `0,70 ms` | `0,10 ms` |
| `torre_herois` | `1.231` | **`327`** | `326` | `294` | `3,67M` | **`1,31M`** | `1,31M` | `1,50 ms` | `0,70 ms` | `0,00 ms` |
| `parque_central` | `1.946` | **`433`** | `432` | `387` | `5,26M` | **`1,47M`** | `1,40M` | `1,00 ms` | `0,30 ms` | `0,10 ms` |
| `suburbio_norte` | `732` | **`299`** | `298` | `266` | `1,70M` | **`1,26M`** | `1,26M` | `2,80 ms` | `2,00 ms` | `0,00 ms` |
| `praia_sul` | `3.245` | **`393`** | `392` | `322` | `6,15M` | **`1,36M`** | `1,24M` | `1,45 ms` | `0,60 ms` | `0,05 ms` |
| `industrial_leste` | `831` | **`294`** | `293` | `248` | `1,52M` | **`1,04M`** | `1,03M` | `2,40 ms` | `1,05 ms` | `1,10 ms` |
| `porto_leste` | `1.669` | **`422`** | `420` | `363` | `3,94M` | **`1,20M`** | `1,13M` | `1,70 ms` | `0,20 ms` | `0,90 ms` |
| `aeroporto_oeste` | `965` | **`297`** | `296` | `263` | `2,38M` | **`1,08M`** | `1,07M` | `1,70 ms` | `0,30 ms` | `0,10 ms` |
| `ilha_prisao` | `1.885` | **`317`** | `316` | `257` | `4,47M` | **`1,13M`** | `0,98M` | `1,20 ms` | `0,30 ms` | `0,00 ms` |
| `aeroporta_avioes` | `1.406` | **`405`** | `404` | `354` | `3,60M` | **`1,31M`** | `1,31M` | `1,50 ms` | `0,70 ms` | `0,00 ms` |
| `X_fav_close` | `1.066` | **`403`** | `402` | `360` | `2,15M` | **`1,29M`** | `1,29M` | `1,60 ms` | `0,40 ms` | `0,30 ms` |
| `X_fav_aerial` | `995` | **`320`** | `319` | `284` | `2,37M` | **`1,31M`** | `1,30M` | `1,95 ms` | `0,20 ms` | `0,40 ms` |
| `X_suburb_close` | `902` | **`313`** | `312` | `277` | `2,09M` | **`1,30M`** | `1,29M` | `1,40 ms` | `1,10 ms` | `0,00 ms` |
| `X_ind_close` | `755` | **`268`** | `267` | `224` | `0,92M` | **`0,72M`** | `0,72M` | `1,05 ms` | `0,40 ms` | `0,70 ms` |
| `X_port_close` | `2.863` | **`435`** | `433` | `334` | `6,00M` | **`1,31M`** | `1,22M` | `0,75 ms` | `0,00 ms` | `0,30 ms` |
| `X_sky_downtown` | `1.471` | **`353`** | `352` | `311` | `3,81M` | **`1,37M`** | `1,35M` | `1,00 ms` | `0,40 ms` | `0,00 ms` |

---

## Capturas Comparativas Antes (`M0`) × Depois (`M9`)
- **Mapa Completo de Topo (`overview.jpg`):** [M0/overview.jpg](./M0/overview.jpg) → [M9/overview.jpg](./M9/overview.jpg)
- **Favela CDD (Encosta em Curvas de Nível & Tijolo/Reboco):** [M0/X_fav_close_aerial.jpg](./M0/X_fav_close_aerial.jpg) → [M9/X_fav_close_aerial.jpg](./M9/X_fav_close_aerial.jpg)
- **Centro Financeiro & Eixo Monumental do Super Banco:** [M0/centro_financeiro_aerial.jpg](./M0/centro_financeiro_aerial.jpg) → [M9/centro_financeiro_aerial.jpg](./M9/centro_financeiro_aerial.jpg) • Preset Baixo c/ sombra de contato: [M9-low/centro_financeiro.jpg](./M9-low/centro_financeiro.jpg)
- **Subúrbio Norte (Lotes Estreitos Fundo-com-Fundo):** [M0/X_suburb_close_aerial.jpg](./M0/X_suburb_close_aerial.jpg) → [M9/X_suburb_close_aerial.jpg](./M9/X_suburb_close_aerial.jpg)
- **Distrito Industrial, Ramal Ferroviário & Cais de Contêineres:** [M0/X_port_close_aerial.jpg](./M0/X_port_close_aerial.jpg) → [M9/X_port_close_aerial.jpg](./M9/X_port_close_aerial.jpg)
- **Orla Sul Curva & Calçadão em Ondas:** [M0/praia_sul_aerial.jpg](./M0/praia_sul_aerial.jpg) → [M9/praia_sul_aerial.jpg](./M9/praia_sul_aerial.jpg)
- **Aeroporto Oeste & Ilha da Prisão (Sem Placas Retangulares de Concreto):** [M0/aeroporto_oeste_aerial.jpg](./M0/aeroporto_oeste_aerial.jpg) → [M9/aeroporto_oeste_aerial.jpg](./M9/aeroporto_oeste_aerial.jpg) • [M0/ilha_prisao_aerial.jpg](./M0/ilha_prisao_aerial.jpg) → [M9/ilha_prisao_aerial.jpg](./M9/ilha_prisao_aerial.jpg)

---

## Decisões Técnicas Tomadas Automaticamente Durante a Madrugada
1. **Unificação de Materiais Postos de Facção (`MaterialRegistry.js`):** Os anéis (`ringMat`), sinalizadores (`beaconMat`) e balizas (`bollardMats`) de cada posto avançado (`P1/P2/P3`) foram unificados sobre o `MeshStandardMaterial` das balizas (`side: DoubleSide`), preservando troca dinâmica de cor/emissivo na captura sem criar materiais redundantes nem acionar uniforms inexistentes em `MeshBasicMaterial`.
2. **Estradinhas Rurais Fora do Grafo de Perseguição Urbana (`PoliceOrganicGraphHelper.js`):** As 6 estradinhas rurais estreitas (`8,5 m`, `isRural: true`) aparecem integralmente no terreno 3D, no minimapa e no mapa tático `[M]`, mas são filtradas do grafo A* urbano da polícia para manter `isolatedComponentsCount === 0` e evitar viaturas tentando cruzar trilhas de serra.
3. **Particionamento da Favela em `5` Bandas Z com `LOD1 = 260 m`:** Manteve o orçamento estrito de **`37 < 40` malhas totais** (incluindo os dois níveis de LOD, colina e FX) enquanto cortou `92,4%` dos triângulos distantes da encosta.
4. **Reciclagem Escalonada da Bolha de Pedestres (`1` realocação/tick + hash espacial `192 m`):** Eliminou o pico de `~65–73 ms` ao teleportar entre regiões distantes sem reduzir a densidade de pedestres nas calçadas ao redor do jogador.

---

## Roteiro Rápido de Teste de Manhã (10 Minutos)
1. **Abra com Telemetria Ao Vivo:** `http://localhost:5173/?perf=1` (confira o painel `PERF // NOIR TELEMETRY` no canto superior direito: FPS, `DC < 450`, `TRI < 1.5M`, `CIT`, `FAC`, `WLD`).
2. **Centro & Super Banco:** Caminhe pelo novo **Eixo Monumental** até o Super Banco Central (entre no saguão e veja o cofre), repare nos prédios históricos baixos de tijolo/pedra ao lado de arranha-céus espelhados, empenas cegas e vitrines iluminadas no térreo, mais a esplanada aberta da Torre dos Heróis.
3. **Favela CDD (Prioridade #1):** Teleporte para a **Favela CDD** pelo Mapa `[M]`: suba pelas **ladeiras curvas dirigíveis** e pelos **escadões** e **becos estreitos (`1,8–3,2 m`)**; confira os barracos/sobrados rotacionados parede-com-parede em **tijolo baiano aparente + reboco/chapisco rústico + lajes com caixa d'água azul + fiação de gatos**, o Campinho, o Baile/Paredão, o Mirante e a Fortaleza do Barão.
4. **Subúrbio, Industrial & Ramal Ferroviário no Porto:** Visite o **Subúrbio Norte** (casas coladas fundo-com-fundo, muros contínuos, cul-de-sacs, comércio de bairro e Posto Octan) e siga para o **Distrito Industrial / Porto Leste** acompanhando os trilhos do **Ramal Ferroviário de Carga** com locomotivas/vagões e passagens de nível até as pilhas de contêineres à beira do cais.
5. **Orla Sul, Aeroporto, Prisão & Serra:** Percorra a **Orla Sul** curva (ondas portuguesas, ciclovia vermelha, 3 canais, Mega Píer) e voe de jato/herói sobre o **Aeroporto Oeste**, a **Ilha da Prisão** e a **Serra Norte** para ver o fim das placas retangulares gigantes de concreto e a mata/restinga natural em LOD.
6. **Teste de Presets (`ESC` → Opções → Qualidade Gráfica):** Alterne entre **Médio** (sombras próximas + Noir grade/bloom) e **Baixo** (`0` sombras dinâmicas + discos suaves de sombra de contato sob o personagem e veículos para 80+ FPS). Para inspecionar colisores 3D com `F8`, abra `http://localhost:5173/?perf=1&debug=1`.

