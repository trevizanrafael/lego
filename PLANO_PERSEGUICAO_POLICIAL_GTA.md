# PLANO — Overhaul da Perseguição Policial no estilo GTA V

> Cole este arquivo como prompt para o agente codador. Leia `AGENTS.md` e `IDV.md` antes.
> Base: `main` em `c848f47`. Siga o protocolo de ondas do `AGENTS.md` (6.3) e **pare para o usuário testar** ao fim de cada onda.

---

## 1. O que o usuário sente hoje

- Os policiais **ficam parados na sua frente**.
- O **helicóptero fica o tempo todo em cima de você**, em qualquer lugar.
- **Não tem som** de verdade (sirene, helicóptero, rádio).
- **É impossível fugir por terra**: mesmo a 700 km/h a polícia te alcança.
- Ele quer que pareça uma **fuga de polícia do GTA V**.

---

## 2. Como o GTA V funciona (pesquisa)

> Fontes: wikis de fãs, guia oficial (via fórum) e comunidade de mods. Os números exatos variam por patch e por fonte; abaixo está o consenso e, quando houver conflito, a faixa.

### 2.1 O ciclo da perseguição
1. **Crime + testemunha.** As estrelas sobem quando um crime acontece **na visão** de alguém. Um civil que vê o crime vira testemunha e liga para a polícia (gera 1★); um crime na frente de um policial dá a estrela na hora.
2. **Perseguição ativa** (estrelas acesas): a polícia **te vê** e vai atrás.
3. **Busca** (estrelas **piscando em cinza**): você saiu da visão. Aparecem **cones de visão** das unidades no radar, e a polícia vai até a **última posição conhecida** e procura a partir dali. No GTA V a busca **não é um raio fixo** (como no GTA IV): ela depende de **linha de visão**.
4. **Fuga**: ficar **fora de todos os cones** até o tempo de busca acabar. Se qualquer unidade te vê de novo, volta para a perseguição ativa e **o tempo reinicia**. Quanto mais devagar as estrelas piscam, mais perto você está de escapar.
5. **Falha**: preso (BUSTED) ou morto (WASTED).

### 2.2 Tempo de busca por estrela (faixas das fontes)
| ★ | Tempo fora de vista para limpar |
|---|---|
| 1 | ~20–30 s |
| 2 | ~35–45 s |
| 3 | ~40–60 s |
| 4 | ~50–75 s |
| 5 | ~70–90 s |

### 2.3 Resposta por estrela
| ★ | O que vem | Comportamento |
|---|---|---|
| 1 | Viaturas comuns da área | Tentam **prender**; só atiram se você estiver armado/atirando |
| 2 | Mais viaturas, resposta maior | Atiram; começam a perseguir de verdade |
| 3 | **1 helicóptero** + **barreiras** (1 carro, às vezes com **tapete de pregos**) | "Fugir por terra fica quase impossível" **enquanto o helicóptero te vê**. Atiradores no helicóptero |
| 4 | **Tropa de elite** (SUVs blindadas), **2º helicóptero** | Táticas de esquadrão; barreiras maiores, nos dois sentidos |
| 5 | Quase só tropa de elite, **até 3 helicópteros** | Força letal total |

### 2.4 Helicóptero
- Só a partir de **3★**. Sai do **telhado das delegacias/hospitais** (não nasce em cima de você).
- À noite **ilumina você com holofote** para guiar as viaturas.
- **Perde você** com qualquer coisa **por cima**: túnel, viaduto, garagem, área coberta. Debaixo de cobertura ele fica cego.
- Derrubar é inútil em 5★ (vem outro), então **se esconder funciona melhor que lutar**.
- O cone de visão dele é grande, mas **não é infinito**: ele precisa estar perto e ver por cima.

### 2.5 Viaturas
- Usam a **rota mais curta pelas ruas**, não erram curva e têm um **multiplicador de velocidade da IA** (arquivo de ajuste `wantedtuning`). Quando ficam para trás, recebem um **pequeno bônus para alcançar** e **não somem na hora**: primeiro tentam alcançar.
- Táticas: **PIT** (bater na traseira lateral para rodar o carro), **fechar/encaixotar** o carro do jogador, bater de propósito.
- **Barreiras** a partir de 3★, posicionadas conforme a largura da rua.

### 2.6 Como se foge de verdade
- Quebrar a linha de visão: **túneis, viadutos, becos, garagens**.
- **Ar e água** são mais fáceis que terra.
- **Mudar a cor do carro** numa oficina **fora da vista** da polícia.
- Ficar parado escondido **dentro** da área de busca, mas fora dos cones.
- (Discutido) trocar de máscara/óculos durante a busca tira 1★ em níveis baixos — as fontes divergem.

### 2.7 Som e rádio
- Sirene contínua de cada viatura, alternando entre o "uóóó" longo e o "yelp" rápido de perto.
- Rotor do helicóptero.
- **Scanner/rádio da polícia**: o despachante fala códigos e **quantas unidades estão indo**, os policiais perguntam "alguém tem visual do suspeito?" e o despachante confirma. A cada ~2 min anuncia o último estado do suspeito (a pé, de carro). Quando você morre: "ameaça neutralizada".

---

## 3. Diagnóstico do nosso código

Os arquivos ficam em `src/world/police/` (4 arquivos, ~2000 linhas).

| Sintoma | Causa no código |
|---|---|
| **Impossível fugir por terra** | `PoliceVehiclePursuitAI.js` ~linha 470: se uma viatura fica presa >2,2 s, fica >3,5 s longe e sem visão, ou fica a mais de 175 m, ela é **teletransportada para 35–58 m de você** (`_findPursuitSpawnPos`). Não importa a sua velocidade: as viaturas "renascem" ao seu lado para sempre. |
| **Helicóptero sempre em cima** | `PoliceHelicopterAndTacticalUnits.js` `_updateEagleHelicopter`: a posição é um `lerp` direto até você (`dt * 2.3`), **sem velocidade máxima** (acompanha qualquer velocidade). E em `_computeLineOfSight` o helicóptero **te vê se estiver a menos de 165 m na horizontal**, sem checar prédio nem cone. Ou seja, ele te enxerga sempre, exceto em túnel ou viaduto. |
| **Helicóptero nasce em cima de você** | `_spawnEagleHelicopter` nasce a 65 m de você. Ao ser derrubado, volta em 22 s. |
| **Policiais parados na sua frente** | `_updateFootUnits`: andam em linha reta até você e **param a 11 m**, de frente, atirando. Sem cobertura, sem flanquear, sem se mexer. As viaturas também **freiam a 11,5 m** de você quando você está a pé (`shouldBrake`) e despejam 1–2 policiais. |
| **Viaturas atravessam o mapa sem ruas** | As viaturas miram direto em você e, quando batem num prédio, tentam ângulos aleatórios. Não usam a malha de ruas (o mapa tem grade de avenidas: `mainAvenuesX/Z` no próprio arquivo e as rotas do trânsito em `TrafficRouteSpecsAndSpawner.js`). |
| **Nascem na sua frente, à vista** | `_findPursuitSpawnPos` procura posições a 32–56 m e **prefere com visão de você** (`requireLOS = true` primeiro), à frente de onde você está indo. Elas aparecem do nada na sua cara. |
| **Estrela sem testemunha** | `addChaos` sobe as estrelas na hora, para qualquer crime, mesmo sem ninguém vendo. |
| **Busca sem leitura** | Existe `isEscaping` e uma barra de fuga, mas **não tem cones de visão nem área de busca no minimapa**. O tempo de fuga é fixo: 18 s (1–3★) ou 25 s (4–5★). |
| **Sem som** | A "sirene" é `soundFX.playCarHorn(0.42, true)` — uma **buzina curta tocada a cada 3,4 s**. Não tem loop de sirene por viatura, nem rotor de helicóptero, nem rádio. |

---

## 4. Design novo

### 4.1 Máquina de estados (`PursuitStateMachine.js`)
```
LIMPO ──crime visto──▶ ALERTA (testemunha ligando, 4–8 s)
  │                        │
  └──crime visto por policial──▶ PERSEGUIÇÃO (estrelas acesas)
                                   │ perdeu visão de TODAS as unidades
                                   ▼
                                 BUSCA (estrelas piscando cinza, cones no radar)
                                   │ visto de novo → PERSEGUIÇÃO (timer zera)
                                   │ tempo de busca acabou
                                   ▼
                                 LIMPO (+ bônus de studs que já existe)
```
- **Testemunhas**: o crime só gera estrela se for visto. Policial vendo → estrela na hora. Civil vendo → ele **pega o celular** (animação simples), e se não for impedido em 4–8 s, a estrela sobe e a polícia recebe a posição **dele**, não a sua. Matar a testemunha antes da ligação cancela a denúncia (mas é outro crime, se alguém vir).
- **Tempo de busca** por estrela: 1★ 25 s · 2★ 40 s · 3★ 55 s · 4★ 70 s · 5★ 85 s. Ajustável num único arquivo de dados.
- A busca **só conta enquanto você está fora de todos os cones**. Ser visto zera o tempo.

### 4.2 Visão da polícia (`PoliceVisionAndPerception.js`)
Cada unidade tem um **cone de visão** de verdade, com bloqueio por prédios (o `_isSegmentBlockedByBuilding` que já existe):
| Unidade | Alcance | Abertura | Observação |
|---|---|---|---|
| Policial a pé | 45 m | 120° | escuta tiros até 60 m (vira o cone pra lá) |
| Viatura | 70 m | 100° para frente | + 15 m em 360° (retrovisor) |
| Helicóptero | círculo de **~40 m no chão** abaixo dele, que ele move até você | — | **cego** debaixo de túnel, viaduto, garagem, metrô e cobertura |
| Drone (5★) | 30 m no chão | — | igual ao helicóptero |
- **Noite**: alcance −30%, exceto dentro do holofote do helicóptero.
- **Fumaça / camuflagem óptica (Agulha)**: já existe `stealthTimer`/`isStealthed`; continuam cegando.
- O **helicóptero precisa achar você**: na busca, ele faz um padrão de varredura (espiral) a partir da última posição conhecida, levando o holofote/cone junto.

### 4.3 Despacho e spawn (`PoliceDispatchDirector.js`)
- **Fim do teletransporte.** Viatura que ficou para trás **não reaparece do seu lado**. Ela segue pela rua; se passar de **250 m e fora de vista**, é removida e conta como "perdida".
- Reforços **nascem fora da sua visão**: ≥ 120 m, fora do frustum da câmera, atrás de prédios ou em cruzamentos, **de preferência vindo da delegacia/batalhão mais próximo**, nunca na sua cara.
- **Orçamento por estrela** (máximo ao mesmo tempo):

| ★ | Viaturas | Policiais a pé | Helicópteros | Extras |
|---|---|---|---|---|
| 1 | 2 | 2 | 0 | tentam prender |
| 2 | 4 | 4 | 0 | atiram |
| 3 | 5 | 6 | 1 | barreiras simples, tapete de pregos às vezes |
| 4 | 6 | 8 | 2 | BOPE/Caveirão, barreiras nos dois sentidos, atirador no helicóptero |
| 5 | 7 | 10 | 2 | divisão especial, exo-drones (que já existem), força letal |
- Durante a BUSCA, o orçamento cai pela metade e as unidades se **espalham** em volta da última posição conhecida.

### 4.4 Viaturas que dirigem de verdade (`PoliceRoadGraph.js` + `PoliceCarDriver.js`)
- **Grafo de ruas** a partir da grade de avenidas (`mainAvenuesX/Z` + as rotas de `TrafficRouteSpecsAndSpawner.js`): nós = cruzamentos, arestas = trechos. Caminho com A* até você (ou até a última posição conhecida).
- **Velocidade**: velocidade máxima por modelo (já existe `maxSpeed`), com **bônus para alcançar de no máximo +15%** quando estão longe **e vendo você**. Nada de velocidade infinita: um carro muito mais rápido que a viatura **consegue abrir distância**.
- Fazer curva freando, derrapar e bater de verdade (usar a física do carro do jogador simplificada, se der).
- **Táticas** (só em PERSEGUIÇÃO e com você de carro):
  - **PIT** a partir de 2★: encosta na traseira lateral e gira o seu carro (já existe um esboço com `pitCooldown`; refazer com força pela velocidade relativa).
  - **Fechar/encaixotar** a partir de 3★: duas viaturas se posicionam uma de cada lado e uma na frente.
  - **Bater de propósito** a partir de 4★.
- **Você a pé**: a viatura **para a ~15–20 m, de lado** (porta como cobertura), e os policiais descem.

### 4.5 Policiais a pé (`PoliceFootTactics.js`)
- **1★ = tentar prender**: se você está a pé, desarmado e não atirou, um policial chega perto e dá voz de prisão (barra de BUSTED, que já existe em `triggerPlayerBusted`). Se você atira ou foge, vira 2★.
- **Mantêm distância de 15–30 m**, **procuram cobertura** (atrás da viatura, de carros e de muros, usando os colisores do mundo) e **se movem entre coberturas**.
- **Flanqueiam**: com 2+ policiais, um segura a posição e outro dá a volta.
- Atiram em rajadas curtas com precisão que **piora com a sua velocidade e a distância** (hoje a mira tem erro fixo de ±0,7 m).
- **Escutam** tiros (60 m) e vão até lá.
- Usam o sistema de vida/queda que já existe (`humanoidHealth`).

### 4.6 Helicóptero (`PoliceHelicopterPilot.js`)
- **Nasce numa base**: heliponto da delegacia ou do batalhão mais próximo (ou o aeroporto/Torre se não houver), e **voa até você**. Leva alguns segundos para chegar.
- **Velocidade máxima ~55 m/s (~200 km/h)**, com aceleração e curva limitadas, e inclina o corpo ao andar. **Um carro mais rápido que isso consegue fugir dele, especialmente costurando prédios.**
- Altitude de ~40–60 m acima do chão local, desviando de prédios altos.
- **Visão**: o cone de chão (4.2). Se você entra debaixo de algo, ele **perde você** e começa a varrer a área.
- **Holofote** à noite seguindo o ponto que ele está vendo (não colado em você quando está cego).
- **Atirador** na porta a partir de 4★, com precisão limitada.
- Derrubado: o próximo **sai da base** de novo (não reaparece perto). Em 5★, até 2 ao mesmo tempo.
- **Combustível/limite**: depois de ~3 min de busca sem achar você, volta para a base.

### 4.7 Barreiras (`PoliceRoadblocks.js`)
- A partir de 3★, colocadas **à frente na sua rota prevista**, num **cruzamento a 150–250 m**, fora da sua visão no momento em que nascem.
- 3★: 1–2 viaturas atravessadas + às vezes **tapete de pregos** (fura pneu: velocidade máxima −40% até trocar de carro ou passar numa oficina).
- 4–5★: 2–3 veículos, incluindo blindado, nos dois sentidos, com policiais atrás atirando.
- Dá para atravessar batendo (com dano), contornar por beco, ou pegar outra rua.

### 4.8 Formas de fugir (o jogador precisa saber)
- **Túneis, metrô, viadutos, garagens cobertas** (já detectados: `_isPlayerInUndergroundTunnel`, `_isPlayerUnderViaduct`, `_isInsideCoveredGarage`).
- **Becos e área coberta** (marcar no mundo como "cobertura" onde fizer sentido).
- **Água**: polícia de terra não entra; a partir de 3★, o helicóptero ainda vê você.
- **Oficina de pintura** (já existe `clearWantedByPaintJob`): só funciona se **nenhuma unidade estiver vendo você** na hora de entrar (hoje existe `hasCloseWitnessOnGarageEntry`; trocar pelo novo sistema de visão).
- **Trocar de operador (1/2) durante a BUSCA**: tira 1★ se estiver com 1–2★ (equivalente à máscara do GTA). → **Confirmar com o usuário.**

### 4.9 Som (`src/audio/sfx/PoliceSirenAndRotorAudio.js`)
- **Sirene em loop por viatura**, com volume e pan pela distância e **efeito Doppler** (WebAudio `PannerNode` + variação de pitch pela velocidade relativa). Duas vozes: **wail** (longa) na estrada e **yelp** (rápida) quando está a menos de 40 m. Limite de 4 sirenes tocando ao mesmo tempo (as mais próximas).
- **Rotor do helicóptero** em loop posicional (ruído filtrado + batida de pá em ~18 Hz), mais alto e grave quando ele passa por cima.
- **Motor** das viaturas acelerando.
- **Megafone** com frases curtas ("PARA O CARRO!", "MÃO NA CABEÇA!") quando estão perto.
- **Rádio da polícia** (scanner): chiado, bip e falas curtas do despachante, **com legenda** no HUD ("Central: 3 viaturas a caminho do Centro Financeiro", "Águia 1: perdi o visual do suspeito", "Suspeito avistado de moto indo para o Porto"). Gatilhos: subir estrela, perder/achar visual, barreira montada, helicóptero derrubado, fuga, prisão, morte. → **Confirmar: voz gravada/TTS ou só som de rádio + legenda?**
- **Camada de música de perseguição**: intensidade sobe com as estrelas e baixa na BUSCA (usar `UrbanAmbienceSoundtrack`/`startWarMusic` que já existem).
- **Remover** a buzina como sirene (`playCarHorn(…, true)` a cada 3,4 s).

### 4.10 HUD e minimapa
- Estrelas **acesas** em PERSEGUIÇÃO e **piscando em cinza** na BUSCA; a piscada **fica mais lenta** conforme a busca chega ao fim (como no GTA). Tirar a barra de fuga se ficar redundante.
- **Minimapa** (`src/ui/minimap/`): mostrar os **cones de visão** das unidades (cinza na BUSCA, vermelho/azul na PERSEGUIÇÃO), o **círculo de chão do helicóptero** e as barreiras. Já existem os blips de viatura e helicóptero em `paintLivingCityTacticalBlips`; adicionar os cones num módulo novo `MinimapPoliceVisionCones.js`.
- Legenda do rádio num canto, curta, na IDV (Chakra Petch, sem caixa).

### 4.11 Desempenho (60 FPS)
- Checagem de visão **escalonada**: cada unidade checa a cada 0,15–0,25 s (em rodízio), não a cada frame.
- A* do grafo **recalculado a cada 1 s** ou quando você troca de quarteirão, não a cada frame.
- Limites da tabela 4.3 rígidos. Unidades longe e fora de vista atualizam em LOD (menos vezes por segundo).

---

## 5. Arquitetura (pasta `src/world/police/`)

Manter a fachada atual (quem chama `tickPursuit…` não precisa mudar) e dividir em submódulos de 150–450 linhas:
- `PursuitStateMachine.js` — estados, testemunhas, tempo de busca, estrelas.
- `PoliceVisionAndPerception.js` — cones, audição, cobertura, "quem está vendo".
- `PoliceDispatchDirector.js` — orçamento por estrela, spawn fora de vista, despawn, delegacias/helipontos.
- `PoliceRoadGraph.js` — grafo de ruas e A*.
- `PoliceCarDriver.js` — direção, PIT, encaixotar, parar de lado.
- `PoliceFootTactics.js` — prisão, cobertura, flanco, tiro.
- `PoliceHelicopterPilot.js` — voo com limites, varredura, holofote, atirador, base.
- `PoliceRoadblocks.js` — barreiras e tapete de pregos.
- `PoliceDispatchRadio.js` — falas e legendas (dados) + gatilhos.
- `src/audio/sfx/PoliceSirenAndRotorAudio.js` — sirenes, rotor, megafone e chiado do rádio.
- `src/ui/minimap/MinimapPoliceVisionCones.js` — cones e área de busca.
- Os arquivos atuais (`PoliceVehiclePursuitAI.js`, `PoliceHelicopterAndTacticalUnits.js`, `WantedEscalationAndEscapeRules.js`) viram fachadas finas ou são substituídos. **Remover o teletransporte** (`_findPursuitSpawnPos` usado para reposicionar) e o `lerp` sem limite do helicóptero.
- Todos os números (tempos, alcances, orçamentos, velocidades) num único `PursuitTuning.js`.

---

## 6. Ondas

- **Onda 1 — o que mais dói (paralelo)**
  - A: `PursuitStateMachine.js` + `PoliceVisionAndPerception.js` + `PursuitTuning.js` + troca do `_computeLineOfSight` antigo. Testes: `tests/police-vision.test.js`.
  - B: `PoliceHelicopterPilot.js` (base, velocidade máxima, cone de chão, varredura) substituindo `_spawnEagleHelicopter`/`_updateEagleHelicopter`.
  - C: `src/audio/sfx/PoliceSirenAndRotorAudio.js` (sirene em loop com Doppler, rotor) + remoção da buzina-sirene.
  - **Critério**: dá para fugir de carro rápido e debaixo de viaduto; o helicóptero chega voando e perde você na cobertura; tem sirene e rotor.
- **Onda 2 — direção e tática (paralelo)**
  - D: `PoliceRoadGraph.js` + `PoliceCarDriver.js` + `PoliceDispatchDirector.js` (sem teletransporte, spawn fora de vista).
  - E: `PoliceFootTactics.js` (prisão em 1★, cobertura, flanco).
  - F: `PoliceRoadblocks.js` (barreiras na rota + pregos).
- **Onda 3 — leitura e clima**
  - G: minimapa com cones e área de busca + estrelas piscando no ritmo certo.
  - H: `PoliceDispatchRadio.js` + megafone + camada de música de perseguição.
  - I: testemunhas (civil ligando) no `PursuitStateMachine.js`.
- Coordenador: `npm test`, `git status --short`, commit atômico por onda, **parar para o usuário testar**.

## 7. Testes
- `tests/police-vision.test.js`: cone respeita alcance/ângulo/prédio; o helicóptero não vê debaixo de viaduto; a busca só conta fora dos cones; ser visto zera o tempo.
- `tests/police-dispatch.test.js`: nunca nasce a menos de 120 m nem dentro do frustum; respeita o orçamento por estrela; **não há teletransporte** de viatura que ficou para trás.
- `tests/police-heli.test.js`: velocidade nunca passa da máxima; derrubado, o próximo sai da base.
- Manual: 3★ num carro rápido em reta longa (deve abrir distância das viaturas e, ao passar por baixo de um viaduto, perder o helicóptero); 1★ a pé parado (policial tenta prender); 4★ a pé (policiais se cobrem atrás da viatura e flanqueiam); ouvir a sirene passando com Doppler.

## 8. Confirmar com o usuário antes de começar
1. **Testemunhas**: crime só gera estrela se alguém vir (civil ligando, como no GTA)? Ou continua instantâneo?
2. **Rádio da polícia**: voz (gravada ou sintetizada em pt-BR) ou só chiado de rádio + **legenda** na tela?
3. **Truque da máscara**: trocar de operador (1/2) durante a busca tira 1★ em 1–2★?
4. **1★ = prisão**: em 1★ a pé e sem atirar, a polícia tenta **prender** (BUSTED) em vez de atirar?
5. Os **exo-drones** de 5★ continuam (é a "divisão especial" do jogo) ou viram só mais helicópteros/BOPE?

---

## Fontes da pesquisa
- [Wanted Level in GTA V — GTA Wiki (Fandom)](https://gta.fandom.com/wiki/Wanted_Level_in_GTA_V)
- [Wanted Level in GTA V — Grand Theft Wiki](https://www.grandtheftwiki.com/Wanted_Level_in_GTA_V)
- [Wanted Level in GTA V — gta.wiki](https://gta.wiki/w/Wanted_Level_in_GTA_V)
- [Wanted Level — Neoseeker](https://gta5.neoseeker.com/wiki/Wanted_Level)
- [Wanted Levels explained according to the Limited Edition Strategy Guide — GameFAQs](https://gamefaqs.gamespot.com/boards/634491-grand-theft-auto-v/67523275)
- [GTA 5: Wanted Levels Explained — Player Assist](https://playerassist.com/gta-5-wanted-levels-explained/)
- [Grand Theft Auto V/Wanted Level — thegtav Fandom](https://thegtav.fandom.com/wiki/Grand_Theft_Auto_V/Wanted_Level)
- [How long until the stars are gone? — GTAForums](https://gtaforums.com/topic/697037-how-long-until-the-stars-are-gone/)
- [How to Lose Your Wanted Level — GTA.media](https://gta.media/lose-wanted-level-gta-5/)
- [GTA 5: How to Lose Cops Without Cheats — allthings.how](https://allthings.how/gta-5-how-to-lose-cops-without-cheats/)
- [I'm sick of these damn Helicopters! — GameFAQs](https://gamefaqs.gamespot.com/boards/634491-grand-theft-auto-v/69195776?page=2)
- [Roadblocks — GTA Wiki](https://gta.fandom.com/wiki/Roadblocks)
- [Police Maverick (HD Universe) — GTA Wiki](https://gta.fandom.com/wiki/Police_Maverick_(HD_Universe))
- [Police Maverick/Tips and Tricks — Grand Theft Wiki](https://www.grandtheftwiki.com/Police_Maverick/Tips_and_Tricks)
- [Police AI behavior — GTAForums](https://gtaforums.com/topic/532871-police-ai-behavior/)
- [Improved Pursuit AI — LCPDFR](https://www.lcpdfr.com/downloads/gta5mods/datafile/39547-improved-pursuit-ai/)
- [Real Pursuit AI — LCPDFR](https://www.lcpdfr.com/downloads/gta5mods/scripts/53116-real-pursuit-ai/)
- [Aggressive Police Chase AI — GTA5-Mods](https://www.gta5-mods.com/misc/aggressive-police-chase-ai-45d02231-c489-437b-abcd-f3db257ab61f)
- [Police Scanner — GTA Wiki](https://gta.fandom.com/wiki/Police_Scanner)
- [Emergency Vehicle Radio — Grand Theft Wiki](https://www.grandtheftwiki.com/Emergency_Vehicle_Radio)
