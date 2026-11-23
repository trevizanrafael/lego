# PROMPT — Quarteirões Densos no Mapa 3× (Corrige "Quarteirão Vazio com um Prédio Só")

> Cole este arquivo como prompt para o agente codador. Leia `AGENTS.md` e `PROMPT_MAPA_ESCALA_3X.md` antes.
> Base: `main` em `870c025` (escala 3× feita nas ondas 0–3).
> Siga o protocolo de ondas do `AGENTS.md` (6.3) e **pare para o usuário testar** ao fim de cada onda.

## 1. O problema
Vários quarteirões estão **praticamente vazios, com um prédio só** (ou 4 prédios nas pontas e o resto vazio).

## 2. Causa (no código)
A escala 3× multiplicou a **distância entre as ruas**, mas **manteve a mesma quantidade e o mesmo tamanho de prédios por quarteirão**.

- As avenidas do centro ficavam a cada **132 m** (`DESIGN_MAIN_AVENUES_X/Z` em `src/world/core/WorldLayoutScale.js`). Com 3×, ficam a cada **396 m**.
- Área útil do quarteirão novo (`resolveScaledBlockInnerBounds` em `src/world/regions/downtown/DowntownBlocksAndSkyscrapers.js`): `396 − 34 (avenida) − 20 (2 calçadas de 10 m) − 5 (recuo) ≈ 337 m` de lado.
- Os prédios continuam com o tamanho 1× (`innerW = W − 10 ≈ 94 m`), e cada quarteirão continua chamando **um único layout** de `buildUrbanDowntownBlock` (ramo "MODO ESCALADO", ~linha 345):
  - **Layout 1 ("Empire State")**: **um único conjunto de 94 × 94 m** ancorado num canto → ocupa **~8%** do quarteirão de 337 × 337 m. É o "**um prédio só**".
  - **Layouts 2 e 4**: 4 prédios de ~44 m colados nos **4 cantos** → o meio fica vazio.
  - **Layout 0**: 6 prédios em duas fileiras, mas espalhados (canto oeste, **meio** e canto leste) → buracos de ~100 m entre eles.
  - **Layout 3**: o "U" corporativo de frente para uma rua só.
- Antes (1×), os mesmos prédios ocupavam ~80% do lote. Agora, **~8–25%**. A área de cada quarteirão ficou **9× maior** e o conteúdo, o mesmo.
- O mesmo padrão se repete em outras regiões que só afastaram os prédios: orla (`BeachfrontSkyscrapersBuilder.js`, as torres continuam aos pares com `pairGap` maior), transição norte do centro (2 prédios por quarteirão), industrial/porto e subúrbio.

Isso era o comportamento esperado do prompt 1 ("só aumentar, o miolo fica vazio para o prompt 2"), mas na prática ficou vazio demais, e as ruas não ficam "cheias" de fachada.

## 3. Correção recomendada: ruas internas + reaproveitar os layouts 1× por sub-quarteirão

**Ideia**: dividir cada quarteirão gigante de 396 m em **3 × 3 sub-quarteirões de ~132 m** (o tamanho original, parecido com o GTA) com **ruas secundárias novas** entre eles. Cada sub-quarteirão tem o tamanho certo para o **layout 1× que já existe** e funciona perfeitamente.

### 3.1 Grade de ruas
- Em `WorldLayoutScale.js`, adicionar **ruas internas** entre cada par de avenidas principais do centro, a cada 132 m (em coordenadas escaladas). Ex.: entre as avenidas `ws(-384)` e `ws(-252)` entram ruas em `+132` e `+264`.
- Elas entram em `URBAN_GRID_LINES_X/Z` como **ruas secundárias** (26 m + calçadas de 10 m). Como a grade agora é **única**, asfalto, calçadas, faixas, semáforos, trânsito, grafo da polícia, rotas de pedestre e minimapa devem pegá-las automaticamente. **Conferir cada consumidor** (o trânsito tem `TrafficRouteSpecsAndSpawner.js` com rotas escritas à mão; adicionar rotas para as ruas novas ou gerar as rotas a partir da grade).
- **Não** criar rua interna onde houver marco: Super Banco, Torre dos Heróis, Parque Central, oficina, recortes do metrô (`getMetroCutoutFloorY`). Esses lotes ficam como "quarteirão grande".

### 3.2 Preenchimento dos sub-quarteirões
- Novo `src/world/buildings/BlockLotFiller.js`: recebe o retângulo útil do sub-quarteirão (`minX, maxX, minZ, maxZ`), a região (paleta/estilos) e um **perfil de altura**, e chama os **layouts 1× existentes** (`buildUrbanDowntownBlock` com `IS_SCALED_WORLD` falso internamente, ou extraindo os 5 layouts para funções puras `layoutDenseRow`, `layoutEmpire`, `layoutFourCorners`, `layoutUCorporate`, `layoutTimesSquare` que recebem o retângulo).
- Variedade: layout e estilo escolhidos por `seed` do sub-quarteirão (determinístico) e **altura pelo perfil de skyline**: mais alto perto do Banco/Torre e mais baixo nas bordas do centro.
- Os 31 quarteirões do centro viram ~**279 sub-quarteirões** (menos os marcos). Cada um com 1–6 prédios.
- A transição norte (`transColsX` a `z = -448`), a orla e o industrial usam o mesmo filler com as paletas deles (residencial costeiro, galpões etc.).

### 3.3 Desempenho (obrigatório)
O centro vai de ~150 para ~1.000+ prédios. Para manter 60 FPS:
- **Batching** por chunk de ~400 m (o `WorldBatchingAndFreeze.js` já funde malhas estáticas): conferir que os prédios do filler entram no batch e não viram centenas de draw calls.
- **LOD**: a partir de ~350 m, trocar o prédio detalhado por um bloco simples com fachada em textura (1 caixa + material de janelas), também em batch. A partir de ~1.200 m, só a silhueta (ou a névoa cobre).
- **Colisores**: 1 por andar de recuo (já existe), sem os detalhes de fachada para prédios longe do jogador, se ficar pesado.
- **Limite de tempo de carregamento**: medir antes/depois. Se passar muito, gerar por chunk sob demanda (streaming), ou pré-gerar o layout como dados.
- Medir com o contador de FPS (já existe) no Ultra e no Baixo, e com o `HitchProfiler` (`?debug=1`).

### 3.4 Alternativa mais barata (se o desempenho não fechar)
Sem ruas novas: **preencher só o perímetro** do quarteirão de 337 m com prédios colados lado a lado (fachada contínua em todas as ruas, como um "anel" de 30–50 m de profundidade) e deixar o miolo como pátio/estacionamento/praça. A rua parece cheia, mas não há ruas novas nem tantos prédios. → **Perguntar ao usuário antes de escolher esta.**

## 4. Ondas
- **Onda 1 (um agente)**: ruas internas em `WorldLayoutScale.js` + asfalto/calçadas/semáforos (`UrbanRoadGridAndBridges.js`, `UrbanSidewalkAndBlockBuilder`, `StreetPropsBuilder.js`) + `BlockLotFiller.js` + centro (`DowntownBlocksAndSkyscrapers.js`) + LOD/batching. Prints do centro + FPS antes/depois. **Parar para o usuário testar.**
- **Onda 2 (paralelo)**: consumidores das ruas novas — trânsito (`living-city/`), polícia (`PoliceRoadGraph.js`), pedestres (rotas e travessias), minimapa/mapa tático · filler na orla (`south-beach/`) · filler no industrial/porto (`east-port/`) · transição norte/subúrbio (`north-suburb/` + `SuburbHouseGenerator.js`).
- **Onda 3**: `tests/map-scale-integrity.test.js` ampliado — ocupação mínima por sub-quarteirão (ex.: ≥ 45% da área útil com prédio no centro), nenhum prédio sobre rua/calçada, toda rua nova presente no grafo da polícia e nas rotas do trânsito.
- Coordenador: `npm test`, `git status --short`, commit atômico por onda.

## 5. Confirmar com o usuário
1. **Ruas internas** (quarteirões ~132 m, estilo GTA) **ou** só **perímetro cheio** com miolo vazio (sem ruas novas)?
2. Aplicar só no **centro** primeiro, ou já em **todas as regiões urbanas** (orla, industrial, transição norte)?
3. Altura: manter o perfil atual (90–160 m) espalhado, ou **skyline** (alto no centro, baixando para as bordas)?
