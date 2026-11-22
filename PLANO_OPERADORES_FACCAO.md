# PLANO — Overhaul de Personagens: Operadores de Facção

> Cole este arquivo como prompt para o agente codador. Leia `AGENTS.md` e `IDV.md` antes.
> Todas as decisões abaixo foram aprovadas pelo usuário em entrevista. **Não reinterprete:** se algo
> não estiver coberto aqui, pergunte (regra 1 do `AGENTS.md`).

## 1. A ideia em uma frase

Os super-heróis saem do papel principal. Cada facção passa a ter **2 operadores armados** (sem
poderes) que juntos cobrem **Tanque, Dano e Suporte**: um é **híbrido** (duas funções em um
personagem só) e o outro é **puro** (a função que sobrou). Você só joga com os 2 da sua facção; o
resto vira **extra comprável com studs**.

## 2. Decisões aprovadas

| Tema | Decisão |
|---|---|
| Composição | 2 operadores por facção = 1 híbrido + 1 puro, cobrindo as 3 funções |
| Divisão | **CV**: Tanque-Dano + Suporte · **PCC**: Dano-Suporte + Tanque · **A.R.E.S.**: Tanque-Suporte + Dano |
| Combate | Só armas. O que diferencia é o **tipo de arma** e o **dano** (suporte bate pouco, a não ser o híbrido Dano-Suporte do PCC) |
| Habilidades | Cada operador tem **1 habilidade no Q e 1 no E**, com recarga |
| Visual | **Continua bonequinho LEGO articulado**, com visual realista de facção (colete, balaclava, equipamento). Nada de super-herói |
| Heróis atuais | Caveira, Solaris, Titã, Vingador, Sombra, Turbo, Voltaico e Vórtex viram **extras comprados com studs** e **mantêm os poderes** como estão |
| OP-09 | **Continua existindo** e entra como extra |
| Operadores rivais | Aparecem como extras compráveis; quando você usa um, ele **luta pela SUA facção** (desertor) |
| Liberação | Os 2 operadores da sua facção já vêm liberados |
| Loja | Nova tela **"Personagens" no menu de pausa**, onde se compram os extras. Na grade de troca, os extras não comprados aparecem como silhueta trancada |
| Troca | A roda sai. **Tab abre uma grade de retratos estilo jogos LEGO** (os 2 da facção grandes em cima, os extras embaixo). Navega com setas ou mouse, Tab/Enter fecha (sem precisar segurar a tecla). **1 e 2** trocam direto entre os 2 da facção |
| Veículo | Entrar/sair de veículo passa do **E para o F**, para todo mundo |
| HUD | Sai a faixa de "controlinhos" (`M1 FUZIL · M2 GRANADA · Q ROLAR · H FICHA` e a linha de atalhos do rodapé `TAB OPERADOR · Z RÁDIO · M MAPA · H DOSSIÊ`). No lugar entram **2 ícones, Q e E, com a recarga visível** |
| Para depois | Modo de **invasão estilo Deadlock** (operadores x operadores entre facções). **Não implementar agora**, só deixar a arquitetura pronta para ele (seção 11) |

## 3. Elenco (aprovado como ponto de partida para balanceamento)

Os multiplicadores são relativos ao fuzil atual do Caveira (`damage` em `_firePrimaryAction`, `HeroCombatAndSpecialPowers.js`), que vale 100%.

### CV — força bruta (encosta da Cidade de Deus, motos, fuzis, RPG, barricadas). Fraqueza: pouca cura.
| | **MARRETÃO** — Tanque-Dano | **FOGUETEIRA** — Suporte |
|---|---|---|
| Vida | 380 | 240 |
| Dano | 100% | 55% |
| Velocidade | 0,88 | 1,0 |
| Arma | Metralhadora pesada: cadência alta, anda mais devagar enquanto atira, recarga longa | Pistola semiautomática |
| Q | **Barricada**: ergue na hora uma barreira de sacos de areia e chapa de ferro (destrutível, dá cobertura) | **Kit de socorro**: arremessa um kit que cura em área por alguns segundos (você e soldados aliados) |
| E | **Bazuca RPG**: 1 disparo explosivo, recarga longa | **Fogos de alerta**: solta fogos que marcam os inimigos próximos no minimapa e na tela por um tempo |

### PCC — organizado e preciso (SUVs blindadas, C4, assalto ao banco). Fraqueza: aguenta pouco de frente (o tanque é puro, sem dano).
| | **CONTADOR** — Dano-Suporte | **MURALHA** — Tanque |
|---|---|---|
| Vida | 260 | 420 |
| Dano | 90% | 75% |
| Velocidade | 1,0 | 0,85 |
| Arma | Fuzil de precisão semiautomático (tiro forte, cadência média) | Escopeta 12 (forte de perto, cai com a distância) |
| Q | **Caixa de suprimento**: larga uma caixa que repõe colete e munição em área | **Escudo balístico**: segura um escudo que bloqueia tiros de frente (anda devagar, atira com a escopeta por cima) |
| E | **C4 remota**: aperta E para plantar/arremessar e E de novo para detonar | **Investida**: corre com o escudo e derruba/empurra quem estiver na frente |

### A.R.E.S. — cyber-mercenários (exoesqueletos, laser, drones). Fraqueza: atirador frágil, tanque com pouco dano.
| | **BASTIÃO-7** — Tanque-Suporte | **AGULHA** — Dano |
|---|---|---|
| Vida | 400 | 200 |
| Dano | 70% | 120% |
| Velocidade | 0,85 | 1,05 |
| Arma | Minigun de pulso (precisa girar ~0,6 s antes de atirar) | Rifle laser de carga: segurar carrega, soltar dispara (estilo sniper) |
| Q | **Domo de energia**: cúpula que bloqueia projéteis de fora para dentro e protege aliados | **Camuflagem óptica**: fica quase invisível por poucos segundos (atirar quebra a camuflagem) |
| E | **Drone médico**: invoca um drone que segue você e cura aliados próximos por um tempo | **Granada de pulso**: EMP que desliga veículos e drones na área |

Recargas iniciais sugeridas: habilidades de cura e defesa 12–18 s, explosivos 10–14 s, RPG 20 s. Todos os números ficam em **um único arquivo de dados** (seção 5), fácil de ajustar.

Visual (bonequinho, sem pinos aparentes, IDV sombria):
- **CV**: vermelho/preto/camuflado, bermuda ou calça cargo, colete improvisado, boné/bandana. Marretão grande com colete pesado e cinturão de munição; Fogueteira com mochila de socorro e rádio.
- **PCC**: preto/azul-escuro, balaclava, colete tático, roupa limpa e organizada. Muralha com capacete e escudo; Contador com óculos/fone e mira na arma.
- **A.R.E.S.**: cinza metálico + roxo neon. Bastião-7 com exoesqueleto por cima do bonequinho (**não** Big-Fig, para manter o tamanho de alvo); Agulha com capacete de visor e capa térmica.
- Reaproveitar os kits de `src/entities/soldiers/FactionClassKitsBuilder.js` para os NPCs da facção combinarem com os operadores.

## 4. Teclas

| Tecla | Operadores de facção | Heróis extras (com poderes) |
|---|---|---|
| Clique esquerdo | Arma principal | Igual hoje |
| Clique direito | Mirar (zoom/precisão) | Igual hoje |
| **Q** | Habilidade 1 | Igual hoje (especial do herói) |
| **E** | Habilidade 2 | Recebe o que hoje está no F para os heróis que usam F como poder |
| **F** | **Entrar/sair de veículo** (para todos) | Veículo. Os poderes que hoje estão no F (Turbo: moto; Vórtex: forma; Voltaico: teleporte; Titã: agarrar carro) vão para o **G** |
| R | Recarregar | Vingador troca arma; Vórtex troca forma. **O atalho de debug que reconstrói todo o cenário (`destructibles.rebuildAll()`) sai** |
| Tab | Abre/fecha a grade de personagens | Igual |
| 1 / 2 | Troca direto entre os 2 da facção | Igual |
| 3–9 | **Removidos** (hoje trocam direto para heróis específicos) | — |

Atualizar o `#pointer-prompt` e as dicas de tecla do jogo para o novo mapeamento.

## 5. Arquitetura — por dados, não por `if`

Hoje cada poder é um `if (hero === 'x')` espalhado por `HeroSelectionAndShortcuts.js`, `ControllerInputAndEvents.js` e `HeroCombatAndSpecialPowers.js`. **Os operadores novos não podem seguir esse padrão.**

- `src/entities/operators/OperatorCatalog.js` — os 6 operadores: chave, facção, função(ões), nome, vida, dano, velocidade, chave da arma, Q, E, preço como extra e preset visual.
- `src/entities/operators/WeaponCatalog.js` — as 6 armas: dano base, cadência, pente, recarga, dispersão, queda de dano por distância, tipo de projétil e som.
- `src/entities/operators/RoleBaselines.js` — base de Tanque, Dano e Suporte (vida, redução de dano recebido, velocidade). O híbrido mistura as duas funções.
- `src/controls/player/OperatorWeaponRuntime.js` — atira, recarrega e mira **lendo o catálogo**, usando o `ProjectilesAndBallisticsPool` / `damageObject` que já existem.
- `src/controls/player/OperatorAbilityRuntime.js` — gerencia as recargas do Q/E e chama a habilidade pelo id.
- `src/controls/player/operator-abilities/CvAbilities.js`, `PccAbilities.js` e `AresAbilities.js` — 4 habilidades cada, com o mesmo formato: `{ id, cooldown, activate(ctrl), update(ctrl, dt), cancel(ctrl) }`.
- `src/entities/minifigure/outfits/` — 6 arquivos novos de roupa (`CvMarretaoOutfit.js`, `CvFogueteiraOutfit.js`, `PccContadorOutfit.js`, `PccMuralhaOutfit.js`, `AresBastiaoOutfit.js`, `AresAgulhaOutfit.js`) + registro em `HeroProfilesCatalog.js`.
- `src/progression/RosterAndUnlocks.js` — o que está liberado, preço, compra (desconta os studs), operadores da facção atual e migração de saves.
- Vida/dano por função: o `maxHp` hoje é fixo em 250 (`setPlayerHealth`). Passa a vir da função do operador. A redução de dano recebido do tanque entra onde o dano ao jogador é calculado.
- Cura (kit, drone, caixa) precisa afetar **o jogador e os soldados aliados** (`src/world/factions/GarrisonPeaceAndAlliesAI.js` / `CombatUnitsAndConvoys3D.js`).
- Grafo de imports sem ciclos. Arquivos de 150–450 linhas; as fachadas ficam com no máximo 210.

## 6. Grade de personagens (substitui a roda)

- Arquivos novos: `src/ui/character-grid/CharacterGridOverlay.js` + `styles/character-grid.css`. A roda (`HeroWheelCanvasRenderer.js`, 1223 linhas) **deixa de ser usada**; remover depois que a grade estiver aprovada.
- **Tab abre e Tab fecha** (sem segurar). Enquanto a grade está aberta, o jogo desacelera ou pausa, como nos jogos LEGO.
- Layout: em cima, **2 cards grandes** com os operadores da facção (retrato, nome, função, ícones de Q/E). Embaixo, uma **grade de retratos menores** com os extras: heróis atuais, OP-09 e os 4 operadores das outras facções. O que não foi comprado aparece como silhueta escura com cadeado e sem preço (a compra é na tela Personagens).
- Navegação com setas/WASD e mouse, Enter ou clique para escolher. O item em foco aumenta e mostra o nome e a função num rodapé.
- Retratos: reutilizar `drawHeroLegoPortrait` / `paintHeroLegoPortrait`, adicionando os 6 operadores novos.
- Visual na IDV (chanfros, cores da facção), seguindo o padrão do prompt da pausa (`PROMPT_MENU_PAUSA.md`).

## 7. Tela "Personagens" (loja na pausa)

- Novo item **PERSONAGENS** na lista de lâminas da pausa (ver `PROMPT_MENU_PAUSA.md`), entre HERÓIS/MAPA e CONFIGURAÇÕES. Se a pausa nova ainda não existir, adicionar como botão no menu atual e avisar no relatório.
- Mesmo layout da grade, com o **preço em studs** em cada extra, um botão COMPRAR e confirmação ("Comprar SOLARIS por 750.000 studs?").
- Preços iniciais (num único lugar, em `OperatorCatalog`/`RosterAndUnlocks`): operadores rivais 400.000 cada; heróis extras de 250.000 a 1.000.000 (Caveira e Solaris mais baratos, Vórtex e Titã mais caros); OP-09 300.000 (o laboratório continua como está para criar e editar).
- Sem studs suficientes: botão desabilitado mostrando quanto falta.

## 8. HUD — ícones de Q e E com recarga

- Remover a `#hud-ability-strip` (chips `M1/M2/Q/H` gerados a partir de `HERO_HUD_THEMES` em `HudConstantsAndPortraits.js`) e a linha de atalhos do rodapé.
- Novo módulo `src/ui/hud/AbilityCooldownHud.js` + CSS: **2 ícones quadrados com chanfro**, rotulados **Q** e **E**, perto da barra de vida.
  - Pronta: ícone aceso na cor da facção.
  - Em recarga: escurecida, com uma varredura que vai enchendo (`conic-gradient` ou máscara) e o número de segundos restantes no centro (JetBrains Mono).
  - Quando fica pronta: um pulso curto + som discreto.
  - Ícone simples por habilidade (SVG inline: barricada, cruz, foguete, escudo, C4, caixa, domo, drone, olho riscado, pulso).
- Os heróis extras também usam esses 2 ícones, mostrando o que está no Q e no E deles (sem recarga, se a habilidade não tiver).
- Mostrar também a **munição** da arma atual (pente / reserva) perto da mira ou da vida, já que agora tudo é arma.

## 9. Saves, fluxo e migração

- Fluxo: Novo jogo → slot → facção → entra no jogo com o **operador híbrido** da facção ativo.
- Trocar de facção pela pausa troca os 2 operadores principais; os extras comprados continuam comprados.
- Campos novos no save: `operatorKey`, `unlockedExtras: []` e, se fizer sentido, `abilityCooldowns`.
- **Migração de saves antigos**: `heroKey` antigo vira o operador híbrido da facção do save; o herói que estava ativo entra como extra **já liberado** (o jogador não perde o que usava). Os 8 heróis + OP-09 também ficam liberados em saves antigos? → **Perguntar ao usuário antes de decidir.**
- O save do jogador atual tem milhões de studs; os preços têm que fazer sentido nessa escala.

## 10. Ondas (arquivos disjuntos por agente — AGENTS.md 6.3)

- **Onda 1 — dados e base (paralelo)**
  - A: `src/entities/operators/*` (catálogo, armas, funções) + `src/progression/RosterAndUnlocks.js` + testes `tests/operators.test.js`.
  - B: 6 roupas novas em `src/entities/minifigure/outfits/` + retratos (apenas arquivos novos; o registro em `HeroProfilesCatalog.js` fica para o coordenador).
  - C: `src/ui/hud/AbilityCooldownHud.js` + CSS (componente isolado, com dados falsos para teste).
- **Onda 2 — jogabilidade**
  - D: `OperatorWeaponRuntime.js` + `OperatorAbilityRuntime.js` + `operator-abilities/*`.
  - E: novo mapeamento de teclas (`ControllerInputAndEvents.js`, `HeroSelectionAndShortcuts.js`): F para veículo, G para os poderes antigos do F, 1/2, remoção de 3–9 e do rebuildAll no R.
- **Onda 3 — interface**
  - F: grade de personagens (substitui a roda).
  - G: tela Personagens/loja + integração com o save.
- Ao fim de cada onda, o coordenador roda `npm test`, confere `git status --short`, faz commit atômico e **para para o usuário testar**.

## 11. Anotado para depois — Modo Invasão estilo Deadlock

O usuário quer, mais pra frente, batalhas de invasão entre operadores das facções no estilo Deadlock
(muito tiro, dano diluído, foco em funções e trabalho em equipe). **Não implementar agora.** Só garantir que:
- o catálogo de operadores serve tanto para o jogador quanto para **bots** (sem depender do controller do jogador);
- habilidades e armas recebem quem disparou e o alvo (não só "o jogador");
- vida, dano e funções ficam em dados, fáceis de rebalancear para um modo separado.

## 12. Documentação

Atualizar a seção 5 do `AGENTS.md` ("11 Personagens Jogáveis"): agora são 6 operadores de facção + 8 heróis extras + OP-09 + 3 chefes, com as regras deste plano. Só fazer isso **depois** que o usuário aprovar a Onda 1 jogando.

## 13. Antes de começar — confirmar com o usuário
1. Em saves antigos, todos os heróis atuais ficam liberados de graça ou só o que estava em uso?
2. Os 3 chefes secretos (Barão Vermelho, Mestre do Cofre, General Overlord) continuam desbloqueáveis ao derrotá-los? Como extras com poderes ou como operadores?
3. A grade pausa o jogo por completo ou só deixa em câmera lenta?
