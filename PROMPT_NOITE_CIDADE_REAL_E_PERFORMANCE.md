# PROMPT NOTURNO — Cidade Real + 60–80 FPS (execução única, 6–10 h, sem paradas)

> Cole este arquivo inteiro como prompt. Você vai trabalhar **sozinho por 6–10 horas** enquanto o usuário dorme.
> Base: `main` em `0d8fadc` (escala 3×, centro orgânico, subúrbio/orla/industrial com preenchimento — ondas já feitas).
> Leia `AGENTS.md`, `IDV.md` e este arquivo **inteiros** antes de começar.

---

## 0. REGRAS DESTA EXECUÇÃO (leia primeiro)

1. **Esta execução substitui a regra 2 do `AGENTS.md`** ("pare e peça para o usuário testar"). O usuário pediu explicitamente: **um prompt só, tudo de uma vez, sem parar para testar e sem perguntar nada depois de começar.**
2. **Perguntas só no início.** Faça as perguntas da **seção 9** numa única mensagem, **antes de escrever qualquer código**. Depois que o usuário responder (ou disser "usa os padrões"), **não pergunte mais nada até o fim**. Se surgir uma dúvida no meio, escolha a opção mais conservadora, anote no relatório e siga em frente.
3. **Nunca pare no meio.** Se uma etapa quebrar e você não conseguir consertar em ~30 min:
   - reverta só aquela etapa (`git revert` do commit dela ou `git checkout -- <arquivos>` antes de commitar);
   - anote em `docs/noite/RELATORIO.md` (o que tentou, o erro, o que ficou pendente);
   - **passe para a próxima etapa.**
4. **Git**:
   - trabalhe numa branch nova `noite/cidade-real-perf` criada a partir do `main`;
   - **um commit por marco** (seção 7), com mensagem clara, e `git push -u origin noite/cidade-real-perf` depois de cada commit (assim nada se perde se o PC desligar);
   - nunca `push --force`, nunca mexa no `main`;
   - não faça merge no `main`: o usuário decide de manhã.
5. **Subagentes em paralelo** são permitidos e recomendados, seguindo o `AGENTS.md` 6.3 (arquivos **disjuntos**, sem git nos subagentes, coordenador roda `npm test` e commita). Diferença desta noite: **sem pausa entre ondas**.
6. **Sempre verde.** Antes de cada commit: `npm test` + o benchmark headless (seção 6). Se um teste antigo quebrar porque a mudança é intencional (ex.: coordenadas de rua mudaram), **atualize o teste** e explique no relatório. **Nunca apague nem desligue um teste para passar.**
7. **Não quebre o jogo.** Invariantes que precisam continuar funcionando (testar no fim de cada marco):
   - Super Banco com interior e cofre; Torre dos Heróis + porão OP-09; LEGO Customs e hangar; 5 estações do metrô e trem;
   - QGs das 3 facções e a guerra territorial; polícia (A*, helicóptero, barreiras) dirigindo pelas ruas;
   - trânsito andando nas faixas; pedestres **só na calçada** e atravessando na faixa;
   - prisão com ponte; aeroporto; aeroporta-aviões; spawns das 10 regiões em terra firme;
   - minimapa e mapa tático batendo com as ruas; colisão (F8) batendo com os prédios.
8. **Regiões sem conteúdo** (extremidades da Pangeia) **podem continuar vazias de construção**, mas **não podem parecer placas lisas**: precisam ter terreno natural (seção 4.8).

---

## 1. O QUE O USUÁRIO QUER

> "Eu quero que pareça uma cidade real, mano. A favela pareça real, não pareça um monte de bloco. Não seja quadrado, quadrado, plano cartesiano, matriz. Tem que ter uma viradinha, um negócio que você vai assim, um pá, um pei. As regiões que não vão ser feitas ainda podem ficar vazias, mas o resto tem que ficar correto. E otimização: eu tô jogando a 20 FPS, quero pelo menos 60, 80."

Duas metas, nesta ordem:
1. **Performance**: sair de ~20 FPS para **60 FPS no preset Médio** e **80+ no Baixo** (1080p, GPU intermediária). Isso vem **primeiro**, porque deixar a cidade mais densa sem isso piora tudo.
2. **Cidade real**: traçado orgânico com hierarquia de vias, quarteirões de formatos variados, densidade que muda de bairro para bairro, **favela de verdade**, orla curva, porto e industrial cheios, e nada de "placas" retangulares lisas.

---

## 2. DIAGNÓSTICO MEDIDO (Chromium headless/SwiftShader, 1280×720, preset `auto`)

> Os números absolutos de FPS do SwiftShader não valem, mas **draw calls, triângulos, contagens e custo de CPU por sistema** são comparáveis. Prints em `docs/diagnostico-mapa/`.

### 2.1 Cena (depois de carregar)
| Métrica | Valor | Meta |
|---|---|---|
| Meshes na cena | **14.154** | < 3.000 |
| InstancedMesh | 228 (23.875 instâncias) | mais instancing, menos meshes |
| Meshes que projetam sombra | **4.956** | < 400 (só perto do jogador) |
| **Materiais únicos** | **1.198** (562 `MeshPhysicalMaterial`, 164 Standard, 471 Basic) | **< 150** |
| Geometrias únicas | 10.225 | < 2.500 |
| Triângulos totais | 7,84 M | — |
| Meshes transparentes | 506 | < 80 |
| Colisores | 50.633 | ok se as consultas forem indexadas |
| `mapBuildings` | 5.894 | ok com índice espacial |
| Luzes | 1 hemisférica, 1 direcional com sombra, 1 spot, 4 point | manter fixo |
| `camera.far` | **23.400 m** | ~2.500–3.500 m com névoa |
| Névoa | exp2 0,00014 (muito fraca: desenha até o horizonte) | mais densa, casada com o `far` |
| Carregamento | ~23 s (headless) | < 12 s |

### 2.2 Por frame, no spawn de cada região (inclui a passada de sombra)
| Região | Draw calls | Triângulos |
|---|---|---|
| Centro Financeiro | 1.742 | 3,98 M |
| Torre dos Heróis | 1.293 | 3,85 M |
| Parque Central | 1.769 | 5,26 M |
| Subúrbio Norte | 724 | 1,65 M |
| **Praia Sul** | **3.194** | **6,14 M** |
| Industrial Leste | 808 | 1,49 M |
| Porto Leste | 1.641 | 3,94 M |
| Aeroporto Oeste | 952 | 2,37 M |
| Ilha da Prisão | 1.813 | 4,35 M |
| Aeroporta-Aviões | 1.478 | 3,79 M |

**Meta: < 450 draw calls e < 1,5 M triângulos por frame em qualquer ponto do mapa.**

### 2.3 CPU por sistema (média, com p90 entre parênteses)
| Sistema | Centro/Industrial/Porto | Meta |
|---|---|---|
| **`factionWar.update`** | **5–9 ms (p90 15–33 ms)** perto de território de facção | < 1,5 ms |
| `livingCity` (trânsito) | 1,3–2,2 ms | < 1 ms |
| `world.update` total | 2–11 ms (p90 até 35 ms) | < 4 ms |
| Envio do render (CPU) | 13–35 ms (picos de 170–470 ms no porto) | < 6 ms |
| Controle, destrutíveis, HUD | < 0,5 ms cada | ok |
→ Os picos de 33 ms da guerra de facções e os picos do envio de render são **travadas**, não só FPS baixo.

### 2.4 Visual (ver prints)
- **Visão geral** (`overview.jpg`): o mapa é um conjunto de **retângulos**: placas lisas cinza/bege/marrom, a favela é uma **faixa retangular**, o subúrbio é uma **grade**, a orla é um **retângulo amarelo**. Grandes áreas planas sem nada.
- **Centro** (`A_centro_financeiro.jpg`): agora denso e com algumas diagonais, mas ainda lê como grade. Prédios quase todos "caixa de vidro com grade de janela" iguais; pouca variação de silhueta.
- **Favela** (`X_fav_aerial.jpg`, `X_fav_close.jpg`): **fileiras paralelas a cada ~75 m** com aglomerados isolados de 2 × N caixas, sobre um **chão vermelho liso e vazio**. Casas de 10–11 m (grandes demais para favela). As "ladeiras" são riscos sobre um plano. É o "monte de bloco" que o usuário odeia. Causa: `FavelaHouseClustersBuilder.js` (~linha 331): `for (designStripX = -552; … -= 25.2)` → faixas fixas multiplicadas por 3.
- **Subúrbio** (`X_suburb_close.jpg`): casas pequenas em **lotes enormes** de grama, ruas retas formando grade gigante.
- **Industrial** (`A_industrial_leste.jpg`): **planície escura vazia** com meia dúzia de objetos.
- **Porto** (`X_port_close.jpg`): **placas retangulares** com contêineres e galpões espalhados longe uns dos outros.
- **Praia/costa** (`A_praia_sul.jpg`): **costa em degraus** (serrilhado de terreno/chunks), oceano com padrão repetido, faixa de areia reta.

---

## 3. PARTE A — PERFORMANCE (fazer primeiro: marcos M1–M3)

### 3.1 Instrumentação (M1, antes de otimizar)
- `?perf=1`: overlay no canto (perto do FPS que já existe) com draw calls, triângulos, programas, geometrias, texturas e ms de CPU por sistema (controller, destrutíveis, livingCity, factionWar, polícia, atmosfera, HUD, render).
  - Para contar draw calls com o composer, use `renderer.info.autoReset = false` e zere manualmente uma vez por frame.
- **Benchmark headless** `tools/bench/run-bench.mjs` (seção 6): roda o jogo em Playwright, visita os spawns das 10 regiões + 6 pontos extras (favela, porto, praia, industrial, subúrbio, voo alto sobre o centro), mede tudo da seção 2 e grava `docs/noite/bench-<marco>.json` + prints `docs/noite/<marco>/<ponto>.jpg`.
- Rodar o benchmark **antes** (baseline) e **depois de cada marco**.

### 3.2 Materiais (maior ganho isolado)
- Hoje são 1.198 materiais. Cada material diferente = troca de estado + draw call separada + mais programas de shader.
- Criar uma **paleta central de materiais** (`src/materials/modules/`, já existe `PaletteAndPbrCache.js`): **reaproveitar a mesma instância** para os mesmos parâmetros; arredondar parâmetros próximos (cor em passos, rugosidade/metalness em passos de 0,1) para deduplicar.
- **Fachadas de prédio**: um material único por "família" (vidro escuro, concreto, tijolo, granito) com **cor por vértice** + **textura de janelas em atlas** (ou janelas no shader, `onBeforeCompile`, com emissivo noturno por hash da janela). Nada de um material por prédio.
- `MeshPhysicalMaterial` só onde vale (vidro principal, pintura de carro do jogador). O resto vira `MeshStandardMaterial` (ou `MeshLambert` para objetos pequenos/longe).
- `MeshBasicMaterial` repetido (471): deduplicar.
- Transparentes (506): só o que é vidro de verdade ou efeito; o resto vira opaco (ou `alphaTest`).
- **Meta: < 150 materiais únicos.** Adicionar ao teste: contagem de materiais únicos depois do load ≤ 200.

### 3.3 Geometria, batching e instancing
- **Estático fundido por chunk** (ex.: 256 m × 256 m) e **por material**: tudo que não se mexe (prédios, calçadas, ruas, terreno, props fixos) vira poucas malhas por chunk. Já existem `WorldBatchingAndFreeze.js` e `ChunkedBuildingLodBatcher.js`: estender para **todas** as regiões e **todos** os tipos estáticos.
- **Instancing** (`InstancedMesh`, ou `BatchedMesh`, que já existe no three r160) para o que se repete: árvores, postes, semáforos, bancos, lixeiras, contêineres, caixas d'água, módulos de casa da favela, guarda-sóis, carros estacionados.
- **Destrutíveis**: continuam individuais só quando perto (ex.: < 150 m); longe, a versão visual entra no batch/instância e só "vira objeto" quando o jogador chega perto (o registro com culling por histerese já existe; ligar o batch nele).
- Meta: **< 3.000 meshes** na cena e **< 450 draw calls** por frame.

### 3.4 LOD, distância e névoa
- `camera.far`: de 23.400 para **~3.000 m** (Ultra ~4.500). Névoa exp2 mais densa, casada com o `far`, para o fim do mundo sumir no smog (combina com a IDV "noir/smog").
- **3 níveis de LOD** por chunk de prédios (o centro já tem): detalhado (< 300 m), caixa com fachada em textura (300–1.200 m), silhueta/impostor (> 1.200 m). Aplicar em **todas** as regiões urbanas.
- Props pequenos (lixeira, banco, cone, placa) **somem** a > 120–180 m.
- **Horizonte**: silhuetas baratas de montanha/skyline em vez de geometria real distante.
- Conferir `frustumCulled = false` (hoje são 17 ocorrências): remover onde não for necessário.

### 3.5 Sombras
- Hoje são 4.956 meshes projetando sombra, e a sombra direcional re-renderiza tudo todo frame.
- **Só projeta sombra o que está a < 150–250 m do jogador** (prédios próximos, veículos, personagens). Props pequenos não projetam.
- Câmera de sombra **justa** em volta do jogador, seguindo-o com *texel snapping* (sem tremer).
- **Atualização de sombra a cada 2 frames** no Médio e a cada 3 no Baixo (`shadowMap.autoUpdate = false` + `needsUpdate` controlado), exceto quando o jogador anda rápido.
- **Baixo**: sem sombras dinâmicas (sombra de contato falsa sob personagens/carros com um disco escuro).

### 3.6 Pós-processamento e resolução
- GTAO só no Ultra. Bloom em meia resolução. SMAA só no Ultra; Médio com FXAA.
- **DRS** (o preset `auto` já existe): baixar a resolução interna quando o frame passar de 16,6 ms e subir quando sobrar folga; nunca abaixo de 0,7.
- `pixelRatio`: Baixo 1,0; Médio ≤ 1,0; Ultra ≤ 1,5.

### 3.7 CPU
- **Guerra de facções** (`src/world/factions/InvasionWarDirector.js` `update` → `_updateCombatUnitsAndHealBeams`, `_updateProjectilesAndShockwaves`, zonas): 5–9 ms com picos de 33 ms.
  - IA em **tick fixo de 10 Hz** com rodízio (cada NPC pensa 1 a cada N frames); movimento interpolado nos outros frames.
  - Zonas e unidades **dormem** quando o jogador está longe (> 400 m) e fora de vista.
  - **Sem alocação por frame** (`new Vector3`, `.filter`, `.map`, `.sort` em loop quente): usar vetores temporários e arrays reaproveitados.
  - Buscas de alvo com **hash espacial** (o `AgentSeparation` da colisão já existe), não loop N×N.
  - Meta: < 1,5 ms, sem picos > 4 ms.
- **Trânsito**: < 1 ms (mesmas técnicas; carros longe atualizam a 5–10 Hz).
- **Polícia/helicóptero**: as varreduras de `world.mapBuildings` inteiro (5.894) em visão e desvio passam a usar o índice espacial.
- **Envio do render**: com menos meshes e materiais, o custo de CPU do render cai junto; conferir também `matrixAutoUpdate = false` em tudo que é estático (o `WorldBatchingAndFreeze` já faz para parte).
- **Picos/travadas**: manter o `HitchProfiler` (`?debug=1`) e o warm-up de shaders. Depois das mudanças de material, **refazer o warm-up** para cobrir a paleta nova.

### 3.8 Carregamento
- Meta < 12 s no headless. Construir as regiões **sob demanda por chunk** (perto do jogador primeiro) ou pré-gerar dados de layout. Mostrar o progresso real na tela de loading.

### 3.9 Metas de aceite da Parte A (benchmark headless, comparando com o baseline)
- Draw calls por frame **< 450** em todos os pontos; triângulos **< 1,5 M**.
- Materiais únicos **< 150**; meshes **< 3.000**; sombras **< 400**.
- `factionWar` < 1,5 ms; `world.update` < 4 ms; nenhum frame de CPU > 25 ms no percurso.
- Visual igual ou melhor (comparar prints antes/depois de cada região).

---

## 4. PARTE B — CIDADE REAL (marcos M4–M8)

### 4.1 Princípios (valem para todas as regiões)
1. **Hierarquia de vias**: via expressa/rodovia → avenida arterial → rua coletora → rua local → beco/viela/escadaria. Cada nível com largura, calçada e tráfego próprios.
2. **Nada de grade infinita.** O traçado segue o **relevo, a costa, o rio/canal e a história do bairro**: avenidas que fazem curva, ruas que mudam de direção ao cruzar uma avenida (grades giradas entre bairros), diagonais, rotatórias, praças triangulares nas bifurcações e ruas sem saída.
3. **Quarteirões de formatos e tamanhos variados** (60–220 m no urbano, irregulares na favela), recortados pelas vias. Lotes perpendiculares à rua, prédio com a fachada na calçada.
4. **Gradiente de densidade e altura**: centro alto e colado → anel de prédios médios → bairros baixos → subúrbio → periferia natural. Nada de "ilha de arranha-céu" do lado de grama vazia.
5. **Chão nunca liso e vazio**: todo espaço é um uso — lote, estacionamento, praça, terreno baldio com mato/entulho, pátio de galpão, quintal. A cor e a textura do chão mudam com o uso.
6. **Transições**: onde um bairro encontra outro, há uma borda (avenida, viaduto, canal, encosta, muro) e não um corte reto de placa.
7. **Marcos visíveis**: o Banco, a Torre e o Porta-Aviões precisam ter **linhas de visão** (avenidas apontando para eles).
8. **Tudo vem de uma fonte só**: a malha viária orgânica que já existe (`src/world/terrain/OrganicDowntownNetworkSpec.js`, `OrganicRoadRibbonBuilder.js`, `OrganicRoadSpatialIndex.js`) passa a ser **a rede da ilha inteira** (`CityRoadNetworkSpec`). Trânsito (`OrganicTrafficPolylineHelper.js`), polícia (`PoliceOrganicGraphHelper.js`), pedestres, minimapa, mapa tático, calçadas e colisão **consomem essa rede**. Nada de cópia de coordenadas em outro arquivo.

### 4.2 Rede viária da ilha (M4)
- Estender a especificação orgânica do centro para a ilha inteira, como um **grafo de polilinhas** com tipo de via:
  - **anel/via expressa** contornando o centro (pode usar/aproveitar os viadutos expressos que já existem);
  - **avenidas radiais** saindo do centro para cada região, seguindo o relevo (curvas suaves, nunca 90° seco fora do centro);
  - **avenida beira-mar curva** acompanhando a costa sul;
  - **estrada da serra** subindo para a favela em zigue-zague;
  - **avenida do porto/industrial** seguindo o canal;
  - **grades locais giradas** dentro de cada bairro (ex.: subúrbio a 18°, industrial alinhado ao canal);
  - rotatórias nas junções de 5+ vias e praças triangulares nas bifurcações.
- Interseções geradas automaticamente com faixas, semáforos (nas arteriais) e calçadas contínuas com rampas.
- **Costa e relevo suaves**: corrigir o serrilhado em degraus da costa e dos chunks de terreno (amostragem/normais/soldas entre chunks), e usar curvas para a linha da praia.

### 4.3 Centro (M5)
- Manter o que ficou bom (densidade, Flatirons, diagonais, LOD).
- Reduzir a sensação de grade: aplicar a hierarquia (2–3 avenidas que realmente cortam em diagonal/curva até o Banco e a Torre), **eixo monumental** até o Banco, praça na frente da Torre.
- **Variedade de prédio**: pódio + torre, recuos, coroas, telhados com equipamentos, prédios baixos históricos colados aos altos, empenas cegas, lojas no térreo (vitrines iluminadas), marquises. Variar largura (12–60 m) e altura (15–220 m) com ruído e o gradiente.
- Ruas com mobiliário (já existem props: postes, bancos, bancas, hidrantes) bem distribuídos na faixa de serviço.

### 4.4 Favela CDD (M6 — prioridade visual nº 1 do usuário)
**Hoje** (`src/world/regions/favela-cdd/`): faixas paralelas a cada ~75 m, aglomerados isolados de 2 × N casas de 10–11 m, chão vermelho liso entre eles, ladeiras como riscos sobre um plano.

**Referência de favela real** (Rio de Janeiro, Cidade de Deus/Rocinha):
- **Tecido contínuo**: casas coladas parede com parede, sem lote vazio; os únicos vazios são becos (1,2–3 m), escadarias, a rua principal, o campinho e lajes.
- **Casas pequenas**: 4–7 m de frente × 5–9 m de fundo, 1 a 4 andares **empilhados** (o de cima às vezes maior ou deslocado, com balanço/laje), cada andar de um material: tijolo laranja aparente, reboco cinza inacabado, alguns pintados (azul, verde, amarelo, rosa desbotados).
- **Lajes**: terraço com caixa d'água azul, varal, antena, ferragem saindo das colunas, churrasqueira, puxadinho.
- **Encosta**: casas em **patamares seguindo as curvas de nível**, com muro de arrimo; a frente de uma está na altura do telhado da de baixo.
- **Circulação**: 1–2 **ruas principais sinuosas** (onde passa carro, mototáxi e kombi) em zigue-zague pela encosta; o resto são **becos e escadarias** só a pé, ramificando como árvore a partir das ruas.
- **Gatos**: emaranhado de fios entre postes de concreto tortos.
- **Pontos de vida**: bar/birosca, igreja evangélica, salão, ponto de mototáxi, quadra/campinho, baile do CV (já existe), boca/barricadas do CV, lixo acumulado em alguns cantos.

**Algoritmo sugerido** (substitui as faixas fixas de `FavelaHouseClustersBuilder.js`):
1. **Curvas de nível** a partir de `getFavelaElevation` (patamares a cada ~3 m de altura).
2. **Rede de circulação**: ruas principais como polilinhas em zigue-zague subindo a encosta (reaproveitar/realinhar `WINDING_LADEIRAS`); **becos** ramificando das ruas, tendendo a seguir as curvas de nível; **escadarias** cortando as curvas de nível (perpendiculares).
3. **Parcelas**: preencher cada faixa entre becos/ruas com uma sequência de lotes de 4–7 m de frente, **girados para a direção local** do beco (nada alinhado a X/Z), com jitter de ±0,5 m e ±4°.
4. **Casa por lote**: base no patamar (muro de arrimo quando há desnível), 1–4 andares com material por andar, laje com 0–3 itens (caixa d'água, varal, antena, ferragem, puxadinho), janelas pequenas com grade, portas para o beco.
5. **Altura** com ruído + mais alto perto das ruas principais e do pé do morro.
6. **Montagem barata**: módulos instanciados (andar 4×5, 5×6, 6×7; laje; caixa d'água; varal; poste) ou merge por chunk **com um material de atlas** (tijolo/reboco/pinturas no mesmo material via cor de vértice + textura de atlas). **Meta: a favela inteira em < 40 draw calls**, mesmo com 1.500–3.000 casas.
7. **Chão**: concreto/terra batida nos becos, sem o "plano vermelho"; o terreno aparece só no campinho e nas bordas de mato.
8. Manter os marcos (campinho, quadra do baile/paredão, fortaleza do Barão/caixa d'água, mirante) nas posições lógicas, encaixados no tecido.
9. **Jogabilidade**: os becos precisam ser andáveis (colisão das casas por lote/merge com OBB), as ruas principais dirigíveis (rede viária), o QG do CV e a guerra territorial funcionando, pedestres andando nos becos.

### 4.5 Subúrbio Norte (M7)
- Hoje: casas pequenas em lotes enormes e grade gigante.
- Real: **lotes de 12–18 m × 25–35 m**, casa a 4–6 m da calçada, quintal nos fundos, muro/cerca, garagem, árvores na calçada.
- Ruas locais **curvas** com **cul-de-sacs** e loops (o `SuburbOrganicLanesBuilder.js` já começou), coletoras que fazem curva, uma **avenida comercial** com lojas baixas, posto, pizzaria (já existem) e praça.
- Densidade: cada quarteirão residencial cheio de lotes; espaço verde concentrado em praças/parques, não espalhado entre casas.

### 4.6 Industrial Leste + Porto (M7)
- Industrial: **galpões grandes** (40–150 m) colados em lotes com pátio, docas de caminhão, estacionamento de carretas, tanques, chaminés, refinaria (já existe), **ramal ferroviário**, cerca de alambrado; ruas seguindo o canal. Sem planície vazia.
- Porto: **cais contínuo** acompanhando a linha d'água, **guindastes ao longo do cais**, pilhas de contêineres **densas em fileiras** (instanciadas), corredores para caminhões, galpões alfandegários, navios atracados (já existem). Sem "placas" com objetos soltos.

### 4.7 Orla / Praia Sul (M8)
- Costa **curva** (baía) suave, sem degraus; **avenida beira-mar curva** com **calçadão de ondas** (padrão de pedra portuguesa no material), ciclovia, quiosques a cada ~120 m, postos de salva-vidas, coqueiros em linha.
- Prédios da orla em **fileira contínua** acompanhando a curva, com segunda fileira atrás e ruas transversais curtas até a praia.
- Píer/roda-gigante e marina (já existem) encaixados na curva.
- Oceano: quebrar a repetição visível do padrão de ondas (variar escala/direção por distância).

### 4.8 Aeroporto, prisão, porta-aviões e periferia
- **Não reconstruir.** Só encaixar na rede viária nova (acessos curvos) e trocar as bordas de "placa" por transições (talude, grama, cerca, mato).
- **Periferia vazia**: pode ficar sem construções, mas com **terreno natural**: relevo suave, grama/mato/terra com variação de cor, manchas de floresta instanciada barata (árvores em LOD), estradas rurais, praias naturais. Nada de placas lisas.

### 4.9 Invariantes de gameplay do mapa
- Todos os pontos da seção 0 item 7.
- Pedestres: rotas geradas a partir das calçadas da rede nova; travessia só na faixa.
- Polícia: grafo A* gerado da rede nova; helipontos em lugares acessíveis.
- Facções: zonas de território redesenhadas para seguir bairros/ruas (não retângulos), mantendo os 3 QGs.
- Metrô: estações e trilhos nas posições atuais ou realinhados à rede; nada de trilho atravessando prédio.
- Minimapa/mapa tático: pintados a partir da rede e dos lotes reais.
- Colisão: OBB por prédio/lote (já existe); conferir com o F8 em todas as regiões.

---

## 5. ARQUITETURA E ARQUIVOS

- Seguir o `AGENTS.md` 6.1 (arquivos de 150–450 linhas, fachadas ≤ 210, imports sem ciclo).
- Módulos novos sugeridos:
  - `src/world/terrain/CityRoadNetworkSpec.js` (+ submódulos por região) — grafo da ilha inteira;
  - `src/world/terrain/RoadIntersectionsBuilder.js`;
  - `src/world/buildings/BuildingFamiliesAndAtlas.js` (famílias de fachada, material único, atlas de janelas);
  - `src/world/buildings/LotSubdivision.js` (subdivisão de quarteirões irregulares em lotes);
  - `src/world/regions/favela-cdd/FavelaContoursAndAlleys.js`, `FavelaParcelFiller.js`, `FavelaHouseModules.js` (substituindo as faixas em `FavelaHouseClustersBuilder.js`);
  - `src/world/terrain/NaturalPeripheryBuilder.js`;
  - `src/graphics/ShadowBudgetController.js`, `src/graphics/MaterialRegistry.js` (ou estender o `PaletteAndPbrCache.js`);
  - `src/debug/PerfOverlay.js`;
  - `tools/bench/run-bench.mjs`.
- Testes novos: `tests/perf-budget.test.js` (contagens de cena após o load headless, ou por builders em modo headless), `tests/city-network.test.js` (rede conectada, sem aresta duplicada, toda calçada ligada, rotas de pedestre sem cruzar prédio), `tests/favela-fabric.test.js` (ocupação ≥ 70% da área urbanizada da favela, nenhum lote alinhado a 0°/90° em mais de 30% dos casos, todos os becos conectados à rua).

---

## 6. VERIFICAÇÃO AUTOMÁTICA (você não tem o usuário para testar)

- **Servidor**: `python server.py` (ou `python -m http.server 5173`) em segundo plano.
- **Playwright** (Chromium): se o Chromium headless não alcançar o `unpkg.com` (o import map carrega o three de lá), sirva o three localmente: instale `three@0.160.0` numa pasta de ferramentas (`tools/bench/node_modules`) e use `page.route(/unpkg\.com\/three@0\.160\.0\/(.*)/, …)` para responder com o arquivo local.
- Use `--use-gl=swiftshader --enable-unsafe-swiftshader` se não houver GPU. Os números de FPS nesse modo não valem, mas **draw calls, triângulos, contagens e ms de CPU por sistema** valem.
- Fluxo do benchmark: título → Novo jogo → slot → facção → espera `window.__legoGame._engineReady` e a tela de loading sumir → para cada ponto, `controller.position.set(...)`, espera ~2,5 s, mede e tira print.
- Prints: câmera do jogo + uma **câmera aérea** (`new PerspectiveCamera`, `renderer.render(scene, cam)`, `toDataURL`) por região, salvos em `docs/noite/<marco>/`.
- **Visão geral do mapa** de cima ao fim de cada marco: `docs/noite/<marco>/overview.jpg`.
- Antes de cada commit: `npm test` verde + benchmark sem regressão das metas já alcançadas.

---

## 7. ORDEM DE EXECUÇÃO (marcos, tempo estimado, commit + push em cada um)

| Marco | Conteúdo | Tempo |
|---|---|---|
| **M0** | Perguntas (seção 9), branch, baseline do benchmark (`bench-M0.json` + prints) | 20 min |
| **M1** | Instrumentação (`?perf=1`) + benchmark automatizado | 30 min |
| **M2** | Materiais (paleta/atlas/dedup), sombras (orçamento + atualização espaçada), `far`/névoa, pós/DRS | 1h30 |
| **M3** | Batching/instancing/LOD em todas as regiões + CPU (facções, trânsito, polícia) + warm-up refeito | 1h30 |
| **M4** | Rede viária da ilha inteira (fonte única) + costa/relevo sem degraus + consumidores (trânsito, polícia, pedestres, minimapa) | 1h30 |
| **M5** | Centro: hierarquia, eixo monumental, variedade de prédios | 45 min |
| **M6** | **Favela real** | 1h30 |
| **M7** | Subúrbio + Industrial + Porto | 1h15 |
| **M8** | Orla curva + periferia natural + bordas do aeroporto/prisão | 1h |
| **M9** | Auditoria final: F8, benchmark completo, testes, relatório | 30 min |

- Se o tempo apertar, a ordem de prioridade é: **M2 → M3 → M6 (favela) → M4 → M5 → M7 → M8**. Performance sempre antes de conteúdo.
- Depois de cada marco: `npm test` → benchmark → commit → push → anotar no relatório.

---

## 8. RELATÓRIO FINAL (`docs/noite/RELATORIO.md`)
- Tabela **antes × depois** de cada métrica da seção 2 (por região).
- O que foi feito em cada marco, com os prints antes/depois (links para `docs/noite/…`).
- O que não deu tempo ou foi revertido, e por quê.
- Decisões tomadas sozinho (dúvidas que surgiram e a escolha feita).
- Como testar de manhã: comandos, URLs (`?perf=1`, `?debug=1`) e um roteiro de 10 minutos pelo mapa.
- Riscos conhecidos e sugestões para a próxima rodada.

---

## 9. PERGUNTAS PARA FAZER AO USUÁRIO NO INÍCIO (uma única mensagem; depois não pergunte mais)

> Se o usuário responder "usa os padrões", use o **padrão** indicado em cada uma.

1. **Preset para medir a meta de FPS**: 60 FPS no **Médio** e 80+ no **Baixo** em 1080p? *(padrão: sim)*
2. **Pode trocar materiais e fachadas** (atlas de janelas, menos variações de material) para ganhar FPS, mesmo que alguns prédios mudem um pouco de cara? *(padrão: sim, mantendo a IDV noir)*
3. **Distância de visão**: aceita a névoa mais forte (o fim da cidade some no smog a ~3 km)? *(padrão: sim)*
4. **Sombras**: no **Baixo**, pode desligar as sombras dinâmicas (fica só uma sombra de contato sob personagens e carros)? *(padrão: sim)*
5. **Rede viária**: pode **refazer o traçado** das ruas fora do centro (curvas, rotatórias, grades giradas), mudando onde ficam as ruas hoje? Os marcos (Banco, Torre, Customs, metrô, QGs, prisão, aeroporto) não saem do lugar. *(padrão: sim)*
6. **Centro**: pode mexer também no traçado do centro (mais diagonais e eixo até o Banco), ou só nos prédios? *(padrão: mexer com moderação, mantendo as avenidas atuais)*
7. **Favela**: pode **apagar e refazer do zero** o miolo da favela (casas e becos), mantendo campinho, baile, fortaleza do Barão, mirante e QG do CV? *(padrão: sim)*
8. **Favela — estilo**: mais **tijolo aparente/reboco cinza** (realista) ou mais **casas pintadas coloridas**? *(padrão: ~70% tijolo/reboco, ~30% pintadas desbotadas)*
9. **Periferia vazia**: terreno natural com **mato/floresta e estradinhas** está bom, ou prefere algo específico (fazendas, serra, mangue)? *(padrão: serra com mata ao norte/oeste, restinga/mangue perto da costa)*
10. **Branch**: trabalhar em `noite/cidade-real-perf` sem mexer no `main` e você faz o merge de manhã? *(padrão: sim)*
