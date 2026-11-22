# PROMPT 1/2 — Mapa 3× Maior (Só Escala, Sem Conteúdo Novo) + Calçadas Largas

> Cole este arquivo como prompt para o agente codador. Leia `AGENTS.md` (seção 3, mapa das 10 regiões) antes.
> Base: `main` em `d7e9898`. Siga o protocolo de ondas do `AGENTS.md` (6.3) e **pare para o usuário testar** ao fim de cada onda.
> **Prompt 2 (depois, não fazer agora):** preencher as áreas que vão ficar vazias. O usuário vai responder perguntas antes.

## O que o usuário pediu
- O mapa está pequeno. **Triplicar o tamanho** de tudo: centro, extremidades e regiões.
- **Não adicionar conteúdo novo** agora. Só aumentar.
- O **conteúdo dentro dos quarteirões fica menor em proporção**: os prédios **não crescem**, só o espaço entre eles. Assim sobra espaço para **calçadas largas**.
- **Pedestres andam na calçada, não na rua.** Hoje você está dirigindo, passa um pedestre na rua, você atropela e a polícia vem atrás.

## Regra central
| Coisa | Escala |
|---|---|
| **Posição** de prédios, regiões, ruas, marcos, spawns, rotas e limites | **×3** em X e Z |
| **Tamanho** de prédios, carros, pessoas, props e interiores | **×1** (não muda) |
| **Altura (Y)**: prédios, relevo, aeroporta-aviões (`y > 404`), Torre (310 m) | **×1** (não muda) |
| Largura de rua e calçada | **novas medidas** (seção 4) |

---

## 1. Diagnóstico: por que não dá para só multiplicar tudo por 3

- O mundo é montado com **coordenadas fixas escritas à mão**. Contagem aproximada de números de posição (3–4 dígitos) por área: `east-port/` ~1.075, `living-city/` ~816, `terrain/` ~702, `downtown/` ~616, `prison-island/` ~455, `west-airport/` ~324, `south-beach/` ~311, `metro/` ~193, `PangaeaPeripheryBuilder.js` ~190, `police/` ~180, `favela-cdd/` ~162, `factions/` ~154, `helicarrier/` ~101 — **mais de 5.000** no total.
- Há **~83 checagens de área** do tipo `x >= -115 && x <= 115 && z >= ...` espalhadas (ex.: `DetailedBuildingBuilder.js` ~linha 59, zona do metrô).
- Muitos desses números são **posição no mundo** (deve escalar), mas outros são **deslocamento local** dentro de um conjunto (pilastras do saguão do banco, celas do presídio, guindastes do porto): esses **não** podem escalar, senão o banco "explode" em pedaços espalhados.
- Fora de `src/world/` também tem coordenada: `MapRegionsData.js` (limites e spawns), minimapa (`MinimapTerrainAndRoadsPainter.js`: `STATIC_MAP_SPAN = 7400` em 2048 px), mapa tático (`src/ui/map/`), polícia (clamps `-1720..1540`, helipontos, avenidas), facções (bases e territórios), eventos (assalto ao banco), garagens, atrações, teleporte por satélite, testes.
- A grade de avenidas está em `src/world/terrain/UrbanRoadGridAndBridges.js` (`mainAvenuesX = [-384…384]`, `mainAvenuesZ = [-382…710]`, quarteirões de **~132 m**) e repetida em outros arquivos (a polícia tem sua própria cópia em `PoliceVehiclePursuitAI.js`/`PoliceRoadGraph.js`).
- Hoje a avenida principal tem **28 m** de largura (`mapRoads … d: 28`), com faixas a ±5,2 m do centro; os pedestres andam a ~±16 m do eixo (`PedestrianCrowdAndInstancing.js` ~linha 345), quase na beira do asfalto, e no pânico fogem para qualquer direção, inclusive para a rua.

---

## 2. Estratégia (segura e reversível)

### 2.1 Um módulo de escala único
Novo `src/world/core/WorldLayoutScale.js`:
```js
export const WORLD_SCALE = 3;                 // 1 = mapa atual, idêntico
export const ws  = (v) => v * WORLD_SCALE;    // âncora no mundo (X ou Z)
export const wsP = (x, z) => ({ x: ws(x), z: ws(z) });
export const wsBounds = (b) => ({ ...b, minX: ws(b.minX), maxX: ws(b.maxX), minZ: ws(b.minZ), maxZ: ws(b.maxZ) });
export const fromWs = (v) => v / WORLD_SCALE;  // para funções de relevo/costa definidas no "espaço de projeto"
// Medidas de rua/calçada (seção 4)
export const ROAD = { mainWidth: 34, secondaryWidth: 26, sidewalk: 10, curbHeight: 0.18 };
```
- **Passo 1 obrigatório: implementar tudo com `WORLD_SCALE = 1`** e provar que o jogo fica **idêntico** ao atual (mesmas posições, `npm test` verde, prints iguais). Só depois mudar para 3. Isso separa o "refactor" do "aumento" e permite voltar a qualquer momento.
- Deixar `?worldScale=1` na URL como override de debug.

### 2.2 Classificar cada coordenada
Para cada número de posição, o agente decide:
- **Âncora** (onde algo fica no mundo: centro de prédio, de região, de marco, ponto de rota, limite) → `ws(...)`.
- **Local** (tamanho, offset dentro de um conjunto, altura) → fica como está.
- **Conjuntos rígidos** se movem **inteiros** (só a âncora escala, o interior não): Super Banco (inclusive interior e cofre), Torre dos Heróis, presídio, aeroporta-aviões, estações de metrô, oficinas, parque de diversões do píer, QGs das facções, terminal do aeroporto.
- Padrão recomendado em cada builder: `const origin = wsP(-324, -168);` e o resto em coordenadas locais somadas à `origin`.

### 2.3 Prédios ancorados na rua (como ficam os quarteirões)
Se o prédio só tiver a posição multiplicada por 3, ele vai parar **no meio de um quarteirão enorme**, longe da rua. Em vez disso:
- Para prédios da **grade urbana** (centro, beira-mar, industrial, subúrbio): calcular em qual quarteirão antigo o prédio estava e **a distância dele até a rua mais próxima**. No mapa novo, ele fica no quarteirão correspondente (escalado), **à mesma distância da calçada nova** (a "fachada" continua na rua).
- Resultado: as ruas continuam "cheias" de fachada e o **miolo do quarteirão fica vazio** (terreno/pátio/estacionamento liso). É esse miolo que o **prompt 2** vai preencher.
- Implementar como helper `wsStreetAnchored(x, z)` em `WorldLayoutScale.js`, usando a grade antiga e a nova.

### 2.4 Relevo, costa e oceano
- As funções de relevo/costa (`CoastlineProfile.js`, `UrbanReliefFunctions.js`, `NaturalReliefMeshesBuilder.js`, `OceanAndPangaeaMeshBuilder.js`) passam a ser avaliadas em **espaço de projeto**: `altura(x, z) = f(fromWs(x), fromWs(z))`. A forma da ilha fica a mesma, só 3× maior. **A altura não escala** (as encostas ficam mais suaves, o que é bom para dirigir).
- Oceano (hoje ±14.500 m): ampliar para cobrir o novo contorno + horizonte.
- Malha do terreno: manter a densidade de vértices **por metro** perto da cidade (mais chunks), e permitir menos detalhe longe (LOD). Medir o custo.

### 2.5 Câmera, distância de visão e desempenho
- Revisar `camera.far`, névoa, sombras (câmera da luz direcional), culling com histerese dos destrutíveis e a distância de LOD dos prédios para a escala nova.
- O número de NPCs (pedestres, trânsito, polícia) **não aumenta**: continua a ser gerado em volta do jogador.
- Batching estático por região/chunk (já existe em `WorldBatchingAndFreeze.js`): conferir que chunks muito grandes não quebram o culling.

---

## 3. O que precisa escalar (checklist)
- [ ] `MapRegionsData.js`: `bounds` e `spawn` das 10 regiões (spawn da Torre: só X/Z).
- [ ] Grade de ruas: `UrbanRoadGridAndBridges.js`, `PangaeaHighwaysAndLandmarks.js`, `ExpressViaductsBuilder.js`, `ViaductDeckAndSupports.js`, `BridgeAndPierSpecs.js` (pontes: o vão aumenta; conferir pilares e arcos), `StreetPortalPlanner.js`, `StreetPropsBuilder.js` (semáforos, faixas de pedestre, postes ficam nos cruzamentos novos).
- [ ] **Uma única fonte da grade de avenidas** (exportada do módulo de ruas) usada por polícia (`PoliceRoadGraph.js`, `PoliceVehiclePursuitAI.js`), trânsito e pedestres — remover as cópias.
- [ ] Todas as regiões em `src/world/regions/*` + `PangaeaPeripheryBuilder.js` + `SuburbHouseGenerator.js`.
- [ ] Metrô (`src/world/metro/*`, `MetroRouteData.js`): estações nas posições novas; o trilho fica 3× mais longo. **Aumentar a velocidade do trem** para o tempo entre estações não triplicar (ver perguntas).
- [ ] Cidade viva: `TrafficRouteSpecsAndSpawner.js` (`roadCoord`, `posAlong`, `minC`, `maxC`, `laneOffset` novo), rotas e pontos de conversa dos pedestres (`PedestrianCrowdAndInstancing.js`), helicóptero ambiente.
- [ ] Polícia (`src/world/police/*`): helipontos, clamps de mapa, distâncias do `PursuitTuning.js` que dependem do tamanho do mapa (conferir: alcance de visão e de spawn são em metros reais e **não** devem escalar).
- [ ] Facções (`src/world/factions/*`, `FactionWarSystem.js`): bases, zonas de território, `baseSpawn` em `FactionIconsAndSaveSystem.js`.
- [ ] Eventos (`src/world/events/*`), garagens (`src/world/garages/*`), atrações (`src/world/attractions/*`), frota (`VehicleFleetBuilder.js`, `NavalAndAirFleetBuilder.js`).
- [ ] As ~83 checagens de área (`x >= … && z <= …`): trocar por `wsBounds` ou por consultas a zonas nomeadas.
- [ ] UI: minimapa (`STATIC_MAP_SPAN`, resolução do cache — 2048 px fica borrado em 3×: usar 4096 px ou tiles), mapa tático (`src/ui/map/`), zoom dinâmico, ícones/waypoints, teleporte por satélite.
- [ ] **Saves**: se o save guarda posição do jogador ou de veículos, migrar (multiplicar X/Z antigos por 3 quando `save.worldScale` não existir).
- [ ] Testes em `tests/` que usam coordenadas.
- [ ] `AGENTS.md` seção 3: anotar a escala nova (depois da aprovação do usuário).

---

## 4. Ruas, calçadas e pedestres

### 4.1 Medidas novas (sugestão; confirmar)
| | Hoje | Novo |
|---|---|---|
| Avenida principal | 28 m, 2 faixas por sentido | **34 m**, 2 faixas largas por sentido + canteiro central |
| Rua secundária | 24 m | **26 m** |
| **Calçada** | quase inexistente (~2–4 m entre o asfalto e o prédio) | **10 m** de cada lado, elevada **0,18 m** com **meio-fio** |
| Recuo do prédio | colado | prédio começa na borda interna da calçada |
- **Calçada de verdade**: geometria própria (placas de concreto, meio-fio, rampas nas esquinas), com colisor baixo/pisável (o jogador sobe; o carro sobe com solavanco, mas a IA do trânsito **não** usa a calçada).
- Faixas de pedestre e semáforos nos cruzamentos novos.
- Postes, bancos, lixeiras, hidrantes e árvores (props que já existem) passam para a **faixa de serviço** da calçada (os 2 m perto do meio-fio), sem criar props novos.

### 4.2 Pedestres na calçada
- Rotas dos pedestres **no meio da calçada** (`borda da rua + 5 m`), dos dois lados de cada rua.
- **Só atravessam na faixa de pedestre**, e só quando o semáforo dos carros está vermelho (ou, se não houver semáforo, quando não vem carro a menos de 30 m).
- **Pânico**: fogem **pela calçada** ou **para dentro do quarteirão** (miolo, praças), nunca para o meio da rua. Implementar uma "malha de calçadas" simples (retângulos caminháveis por quarteirão) e limitar a fuga a ela.
- Os carros do trânsito e da polícia **não sobem na calçada** (a não ser a polícia em perseguição a pé, em baixa velocidade).

---

## 5. Ondas (arquivos disjuntos por agente)
- **Onda 0 — base (um agente só, sequencial)**
  - `WorldLayoutScale.js`, `MapRegionsData.js`, relevo/costa/oceano (`CoastlineProfile.js`, `src/world/terrain/*`), grade de ruas única + calçadas (`UrbanRoadGridAndBridges.js`, `StreetPropsBuilder.js`), câmera/névoa/sombra/culling, minimapa e mapa tático, migração de save.
  - **Com `WORLD_SCALE = 1`, nada muda visualmente** → `npm test` + prints de comparação. Commit. Depois **só** a troca para 3 na grade/relevo/UI + prints. **Parar para o usuário testar.**
- **Onda 1 — regiões (paralelo, uma pasta por agente)**
  - `regions/downtown/` · `regions/east-port/` · `regions/south-beach/` · `regions/prison-island/` · `regions/west-airport/` · `regions/favela-cdd/` + `regions/north-suburb/` + `SuburbHouseGenerator.js` · `regions/helicarrier/` + `PangaeaPeripheryBuilder.js` · `src/world/metro/`.
  - Cada agente usa `ws`/`wsP`/`wsStreetAnchored` e mantém os conjuntos rígidos.
- **Onda 2 — sistemas (paralelo)**
  - Cidade viva (trânsito + pedestres na calçada + malha de calçadas) · polícia · facções + eventos · garagens + atrações + frotas.
- **Onda 3 — auditoria**
  - Usar o **F8** (debug de colisão que já existe) e o script de auditoria de colisão em todas as regiões.
  - Checagens automáticas novas (`tests/map-scale-integrity.test.js`): nenhum prédio sobre a rua ou a calçada; nenhuma rota de pedestre atravessando prédio ou rua fora da faixa; nenhuma rota de trânsito sobre a calçada; todo spawn em terra firme; spawns das 10 regiões dentro dos `bounds` novos.
- Coordenador: `npm test`, `git status --short`, commit atômico por onda, **parar para o usuário testar**.

## 6. Critérios de aceite
- Com `?worldScale=1` o jogo é igual ao de antes.
- Com 3×: as 10 regiões estão nos mesmos lugares relativos, 3× mais afastadas; os prédios têm o mesmo tamanho e continuam alinhados à rua; o miolo dos quarteirões fica vazio e liso.
- Calçadas de 10 m com meio-fio; os pedestres só andam nelas e atravessam na faixa; dirigindo pela avenida, **ninguém aparece no meio da rua** (a não ser fugindo de algo dentro da faixa).
- Metrô, polícia, facções, trânsito, garagens, eventos e minimapa funcionando nas posições novas.
- FPS no Ultra e no Baixo igual ou melhor que antes (o contador de FPS já existe).

## 7. Confirmar com o usuário antes de começar
1. **Tamanho do quarteirão**: com 3×, cada quarteirão do centro passa de ~132 m para **~396 m**, com o miolo vazio até o prompt 2. É isso mesmo, ou prefere que no prompt 2 a gente **crie ruas novas no meio** para os quarteirões ficarem ~130–200 m (mais parecido com GTA)?
2. **Medidas**: avenida 34 m, rua 26 m, **calçada 10 m** — ok?
3. **Tempo de viagem**: tudo fica 3× mais longe. Aumentar a velocidade dos carros/metrô, ou manter e deixar a viagem mais longa (como no GTA)?
4. **Aeroporta-aviões**: continua sobre o Centro (só X/Z escalam, a altura fica)?
5. Saves antigos: **migrar** as posições ou começar do spawn da região?
