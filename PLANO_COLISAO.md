# PLANO — Auditoria e Overhaul da Colisão do Jogo

> Cole este arquivo como prompt para o agente codador. Leia `AGENTS.md` antes.
> Base: `main` em `01687b1`. Siga o protocolo de ondas do `AGENTS.md` (6.3) e **pare para o usuário testar** ao fim de cada onda.

## 1. O que o usuário vê

- Policiais (e viaturas) **todos no mesmo lugar, um em cima do outro**, sem colisão entre eles.
- **Avião e helicóptero atravessam prédios.**
- Partes visíveis do prédio (a beirada) **sem colisão**.
- Prédios com **topo afinado**: você **pousa/anda no ar** em volta do topo, porque a colisão é a da base.
- No geral, "a colisão tá zoada no jogo inteiro".

---

## 2. Como a colisão funciona hoje

Existem **três "mundos" separados que não concordam entre si**:

| Mundo | Onde | Quem usa |
|---|---|---|
| **Colisores**: ~7.870 caixas, sendo ~530 dinâmicas (medido rodando o jogo) | `src/world/core/WorldSpatialColliderGrid.js` (`addCollider`, `getCollidersNear`, `getCollidersAlongRay2D`), em células de 32 m | Jogador a pé, carro e barco do jogador, câmera, tiros, ganchos |
| **`world.mapBuildings`**: lista de retângulos para o minimapa | `DetailedBuildingBuilder.js:185`, `SuburbHouseGenerator.js:332`, `MetroElevatedStations.js:271`, `CustomsBuildingAndRuntime3D.js:384` | **Polícia** (visão e desvio, `PoliceVisionAndPerception.js:363`), piloto do helicóptero |
| **A malha visual** | cada builder de região | ninguém (só desenha) |

Limitações do modelo de colisores:
- **Só caixas alinhadas aos eixos X/Z** (`minX..maxX`, `minZ..maxZ`, `minY..maxY`). Nada girado, nada redondo, nada escalonado.
- **Só testa a posição final do frame** (não varre o caminho). Quem anda rápido atravessa coisa fina.
- Cada sistema escreve a **sua própria** checagem de colisão em vez de uma API comum.

---

## 3. Problemas encontrados (causa no código)

### A. NPCs empilhados e sem colisão
- **Não existe separação entre NPCs** em nenhum lugar do código (nenhuma lógica de afastar um do outro).
- **Viaturas da polícia** (`PoliceVehiclePursuitAI.js`) só desviam de `mapBuildings` (`_isSegmentBlockedByBuilding`). Atravessam muros, props, carros do trânsito e **umas às outras**. Na busca, todas vão para **a mesma "última posição conhecida"** → chegam e ficam **empilhadas no mesmo ponto**.
- **Policiais a pé** (`PoliceHelicopterAndTacticalUnits.js` `_updateFootUnits`) andam em linha reta até o jogador e param a ~11 m: todos convergem para o mesmo anel, sem se afastar.
- **Soldados das facções** (`src/world/factions/*`) **não usam colisão nenhuma**: atravessam paredes e uns aos outros.
- Visão/desvio da polícia usa `mapBuildings`, então **muro, banco, Torre dos Heróis, presídio e contêineres** (que só têm colisor, não `mapBuilding`) **não bloqueiam a visão** nem o caminho deles.

### B. Avião e helicóptero do jogador atravessam prédios
- `NavalAircraftAndRidesController.js`: `_updateHelicopterFlight` (~linha 288) e `_updatePlaneFlight` (~linha 366) **só limitam a altura** (`clamp(…, _findGroundSupportAt(…), 540)`). **Não existe checagem horizontal.** O barco (`_updateBoatNavigation`) tem; o avião não.
- `_findGroundSupportAt` (`FootSwimAndCollisionPhysics.js:155`) considera "chão" o topo de qualquer caixa que esteja **até 2,5 m acima** de você → a aeronave dá **um "pulo" para cima do telhado** quando raspa a borda, em vez de bater.

### C. Topo afinado com colisão da base
- `DetailedBuildingBuilder.js`: prédios Art-Deco têm **3 andares de recuo** (`tier1H = 74%` da altura com largura total; tier 2 com 82%; coroa com **64%** da largura, linhas ~27–40). Mas o colisor é **um bloco só** `w × d × h` (linha 181). Nos 26% de cima, existe uma "laje invisível" de ~18% de cada lado.
- Efeitos: você **pousa/anda no ar** ao lado do topo, **tiros batem no ar**, a câmera "bate" em nada, e o gancho do Sombra prende no vazio.

### D. Beirada visível sem colisão
No mesmo builder, detalhes de fachada **saem para fora** do colisor `w × d`:
- cornijas `w + 1,05` / `w + 1,25` (≈ 0,5–0,6 m para fora de cada lado);
- aletas brutalistas `w + 0,72`;
- **pilares de quina girados 45°** (`chamferCol.rotateY(π/4)`), que saem ~0,8 m na diagonal;
- saia do térreo `w + 0,65`.

Objetos de telhado **sem colisor nenhum**: caixa d'água, geradores, mastro e pináculo (linhas ~118–145).

### E. Coisas giradas viram caixa errada
O modelo só aceita caixa alinhada, então todo objeto girado ganha uma caixa **maior** (bate no ar) ou **menor** (atravessa a ponta). Arquivos que giram objetos e registram colisores: `MegaPierAndMarinaBuilder.js`, `PangaeaHighwaysAndLandmarks.js`, `SuperBankExteriorAndLobby.js`, `HeroTowerComplexBuilder.js`, `CustomsBuildingAndRuntime3D.js`, `EastPortBatcherAndMaterials.js`, `CarrierDeckIslandAndClouds.js`. Postes, árvores, colunas e bombas de gasolina, que são redondos, também viram caixa.

### F. Atravessar em alta velocidade (tunneling)
- O carro do jogador (`GroundVehicleDrivingPhysics.js`) é um **quadrado de raio 1,45 m** (linha ~206), mas o carro tem ~4,8 m de comprimento: **a frente entra ~1 m na parede** antes de bater.
- Só a posição final é testada. A 700 km/h (~194 m/s) o carro anda **~3,2 m por frame** a 60 FPS, e existem **~457 colisores com menos de 0,6 m de espessura** (muros, grades, portões): **o carro atravessa**. O mesmo vale para o avião e para os tiros rápidos (sniper a 520 m/s anda ~8,7 m por frame).
- Batida = a velocidade inverte para −25% (`collisionRecoilFactor ?? -0.25`), sem deslizar pela parede.

### G. Visão da polícia ≠ colisão
Como a visão usa `mapBuildings` (só prédios "de minimapa"), a polícia te vê através do banco, da Torre, de muros e contêineres, e ao mesmo tempo o helicóptero desvia de prédios que não estão ali. **A fuga fica inconsistente.**

---

## 4. O que mudar

### 4.1 Uma fonte única de verdade: `CollisionWorld`
Nova pasta `src/world/collision/` (submódulos de 150–450 linhas):
- `CollisionShapes.js` — formas:
  - `box` (AABB, a de hoje);
  - **`obb`**: caixa girada no eixo Y (centro, meia-largura, meia-profundidade, ângulo, minY/maxY);
  - **`cylinder`**: postes, árvores, colunas, bombas, tanques;
  - **`tieredBox`**: lista de caixas empilhadas para prédio escalonado (ou simplesmente registrar uma caixa por andar).
- `CollisionWorldIndex.js` — o mesmo grid de 32 m de hoje, agora aceitando as formas novas + a lista dinâmica (veículos, portões, plataformas).
- `CollisionQueries.js` — **API única** para todos os sistemas:
  - `overlapCapsule(pos, radius, height)` — pessoas;
  - `overlapOrientedBox(center, halfX, halfZ, yaw, minY, maxY)` — carros com o tamanho real;
  - **`sweepSphere(from, to, radius)` / `sweepBox(...)`** — anda o caminho inteiro do frame (resolve o tunneling);
  - `raycast3D(from, to)` — tiros, câmera, gancho, **visão da polícia e do helicóptero**;
  - `resolvePenetration(shape)` — empurra para fora pelo menor eixo e **devolve a normal** para deslizar.
- `AgentSeparation.js` — **hash espacial de agentes** (NPCs a pé, viaturas, carros de trânsito): empurra para fora quem estiver sobreposto e dá um vetor de desvio para a IA. Barato: célula de 4 m, só agentes ativos.
- A API antiga (`addCollider`, `getCollidersNear`, `getCollidersAlongRay2D`) **continua funcionando** como fachada fina por cima do novo índice, para não quebrar os 379 usos de uma vez.
- **`mapBuildings` passa a ser derivado** dos colisores (ou a visão/desvio da polícia passa a usar `raycast3D`). Uma fonte só.

### 4.2 Prédios (`DetailedBuildingBuilder.js` + `BuildingStylesAndFacades.js`)
- Registrar **um colisor por andar de recuo** (tier 1 com largura total, tier 2 com 82% e coroa com 64%), cada um com o `minY/maxY` certo.
- **Colisor = contorno visual**: incluir as cornijas e aletas no colisor do andar (ou registrar as cornijas como caixas finas próprias, pisáveis). Os pilares de quina viram `cylinder`/`obb`.
- Telhado: colisor para caixa d'água (`cylinder`), geradores (`box`) e pináculo/mastro (`cylinder` fino).
- Fazer o mesmo nos builders de região que montam prédios à mão (`HeroTowerComplexBuilder.js`, `SuperBank*`, `BeachfrontSkyscrapersBuilder.js`, `PrisonCellBlocksAndHQBuilder.js`, `AirportTerminalAndParking.js`, etc.).

### 4.3 Objetos girados e redondos
- Trocar as caixas alinhadas por `obb`/`cylinder` nos arquivos da seção 3.E e nos spawners de props (`BreakableStreetPropsSpawner.js`: postes, hidrantes, bancos, árvores).

### 4.4 Jogador
- **A pé**: cápsula (raio ~0,45 m, altura 2,05 m) com `resolvePenetration` + **deslizar na parede** (hoje bloqueia o eixo inteiro e zera a velocidade). Subir degrau de até 0,34 m (mantém o valor atual).
- **Carro**: `obb` do tamanho real do modelo (largura × comprimento do `spec`) girada pelo `vehicleHeading`. **`sweepBox`** quando o passo do frame for maior que metade da espessura mínima (subpassos). Batida: desliza pela normal e perde velocidade proporcional ao ângulo (bater de frente = para; raspar = perde pouco). Dano/faísca já existentes.
- **Helicóptero e avião**: `sweepSphere` horizontal **e** vertical a cada frame. Batida acima de X m/s = **acidente** (dano grande/explosão, como no GTA); raspão lento = desliza. Remover o "pulo" de 2,5 m do `_findGroundSupportAt` para aeronaves (pousar só se estiver descendo devagar sobre o topo).
- **Voo dos heróis extras** (Solaris etc.) e gancho do Sombra: passam a usar `sweepSphere`/`raycast3D`.
- **Câmera** (`CameraOrbitAndRig.js`): `raycast3D` contra as formas reais (deixa de bater em laje invisível).

### 4.5 Tiros
- `BallisticsSimulationUpdate.js`: projéteis rápidos usam `raycast3D` do ponto anterior até o atual (o sniper a 520 m/s não atravessa mais muro fino), contra as formas reais.

### 4.6 NPCs
- **Todas as viaturas da polícia, carros de facção e carros do trânsito**: `obb` dinâmica + `sweepBox` no movimento + `AgentSeparation` (nunca ocupam o mesmo lugar; se encostam, se empurram e desviam).
- **Policiais a pé, soldados de facção e pedestres**: cápsula + `AgentSeparation` + `resolvePenetration` contra o mundo.
- Ao convergir para um ponto (última posição conhecida, alvo, cobertura), cada agente recebe um **ponto de chegada distinto** (anel/formação ao redor do alvo) em vez do mesmo ponto.
- Visão e desvio da polícia usam o `CollisionWorld` (seção 4.1), não `mapBuildings`.

### 4.7 Ferramenta de depuração (fazer primeiro)
- **Tecla de debug** (ex.: `F8`, só com `?debug=1` na URL): desenha em wireframe todos os colisores perto do jogador (verde = estático, amarelo = dinâmico, roxo = `obb`/`cylinder`), mais os agentes e os raios de visão da polícia.
- **Script de auditoria** (`tests/collision-audit.test.js` ou um script em `tools/`): para cada builder, compara a caixa da malha com os colisores e lista (a) malhas grandes sem colisor e (b) colisores sem malha. Ignorar malhas fundidas maiores que um quarteirão.
- Sem isso, consertar 379 chamadas de `addCollider` é no escuro.

### 4.8 Desempenho (60 FPS)
- `sweep` só para quem anda mais que metade do raio por frame; quem está parado ou devagar usa só `overlap`.
- `AgentSeparation` só para agentes a menos de ~150 m do jogador.
- `raycast3D` da visão da polícia escalonado (rodízio de 0,15–0,25 s, como já planejado no `PLANO_PERSEGUICAO_POLICIAL_GTA.md`).
- Testar com o perfil de qualidade BAIXO.

---

## 5. Ondas

- **Onda 1 — ferramentas e base (paralelo)**
  - A: `src/world/collision/*` (formas, índice, consultas, separação) + fachada compatível em `WorldSpatialColliderGrid.js` + testes `tests/collision-queries.test.js` (sweep não atravessa parede de 0,3 m a 200 m/s; `obb` girada bate certo; cilindro).
  - B: ferramenta de debug (F8) + script de auditoria (só arquivos novos e uma linha de registro no input).
- **Onda 2 — o que o usuário mais sente (paralelo)**
  - C: aeronaves (`NavalAircraftAndRidesController.js`): sweep + acidente.
  - D: NPCs (`PoliceVehiclePursuitAI.js`, `PoliceHelicopterAndTacticalUnits.js`, `src/world/factions/CombatUnitsAndConvoys3D.js`): separação + colisão com o mundo + pontos de chegada distintos.
  - E: prédios (`DetailedBuildingBuilder.js`): colisor por andar, cornijas, quinas e telhado.
- **Onda 3 — resto do mundo e jogador**
  - F: carro do jogador com `obb` + sweep + deslizar (`GroundVehicleDrivingPhysics.js`).
  - G: jogador a pé com cápsula + deslizar (`FootSwimAndCollisionPhysics.js`) + câmera (`CameraOrbitAndRig.js`).
  - H: tiros (`BallisticsSimulationUpdate.js`) + visão da polícia usando `raycast3D` (`PoliceVisionAndPerception.js`).
  - I..N: um agente por região, corrigindo os colisores apontados pela auditoria (`downtown/`, `east-port/`, `south-beach/`, `prison-island/`, `west-airport/`, `favela-cdd/` + `north-suburb/`), cada um só na sua pasta.
- Coordenador: `npm test`, `git status --short`, commit atômico por onda, **parar para o usuário testar**.

## 6. Testes manuais
- Voar de helicóptero e de avião contra a lateral de um arranha-céu: bate (acidente em alta velocidade), não atravessa.
- Subir no topo de um prédio Art-Deco: não dá para ficar parado no ar ao lado da coroa.
- Andar encostado na fachada: a cornija e a quina bloqueiam onde aparecem.
- Carro a 700 km/h contra um muro fino: bate.
- 4★ e se esconder: as viaturas chegam e **param espalhadas**, nenhuma em cima da outra; policiais a pé não se sobrepõem.
- Ligar o F8 em cada região e conferir se o wireframe bate com o visual.

## 7. Confirmar com o usuário
1. "**Os postos todos no mesmo lugar, um em cima do outro**": são os **policiais/viaturas** empilhados (minha interpretação), ou são **postes**/outra coisa? Se for outra coisa, mandar print ou o lugar no mapa.
2. Avião/helicóptero batendo forte em prédio: **explode/cai** (GTA) ou só **para e quica**?
3. Carro batendo de frente a alta velocidade: só para, ou também **amassa/perde vida** do carro?
