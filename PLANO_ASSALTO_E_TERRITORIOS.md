# 🏦⚔️ Plano — Mega Assalto ao Super Banco & Guerra de Território 2.0

> Status: **IMPLEMENTADO — aguardando teste do usuário na tela.** Veja a seção 7 para o que mudou em relação à proposta.
> Segue `AGENTS.md`, `IDV.md` e o Passo 8 do `PASSO_A_PASSO.md`.

---

## 0. Diagnóstico — como funciona hoje (`src/world/FactionWarSystem.js`)

| O que acontece hoje | Problema |
| :--- | :--- |
| Ao entrar no território, nascem **3 bonecos por posto** (rifle + tanque + médico) em P1, P2 e P3. | Tudo nasce de uma vez. Parece "3 malucos parados", sem frente de batalha. |
| O posto é capturado quando não sobra defensor perto e o jogador está a menos de 38 m, com timer de **0,45 s** (ou na hora, se estiver a menos de 16 m). | A captura é instantânea, sem tensão nem disputa. |
| Os postos podem ser tomados em **qualquer ordem**. | Não existe linha de frente, avanço ou recuo. |
| O reforço inimigo vem a cada 11 s se houver menos de 11 inimigos vivos. | Não tem ritmo de ondas nem pico de dificuldade. |
| Boss aparece no 2º posto. Boss morto + 3 postos = território conquistado **para sempre** (`conqueredByPlayer`, salvo no save). | **Depois de dominar, ninguém volta.** O território morre como conteúdo. |
| O Super Banco tem cofre destrutível (`bank_vault_door`), luzes de alarme e ouro (`gold_vault`), mas **nenhum evento usa isso**. | O melhor cenário do jogo não tem gameplay. |

---

## 1. Referência pesquisada — PvZ Garden Warfare

O que vale copiar (mecânicas, não visual nem nomes):

1. **Gardens & Graveyards (ataque em sequência):** o atacante toma os pontos **um por vez, em ordem**. Cada ponto tem **barra de captura** que só enche com atacantes dentro e trava quando há defensor ("contestado"). Cada captura **soma tempo no relógio** e libera o próximo ponto. O último objetivo é especial (um chefe ou alvo final).
2. **Garden Ops (defesa em ondas):** defender um ponto por **ondas numeradas**, com **10 s de pausa** entre elas para curar e se preparar. As ondas de chefe vêm em posições fixas (5 e 10). O chefe é sorteado num **caça-níquel**, que às vezes dá "jackpot" de prêmio. Há ondas especiais aleatórias e, no final, **extração**: correr até um ponto e sobreviver até o resgate.
3. **Flag of Power (Backyard Battleground):** no mundo aberto, você **finca uma bandeira e segura ondas que ficam cada vez mais difíceis**. Entre as ondas caem **caixas com aliado IA ou moedas**.

**Tradução para o nosso jogo:**
- **Invadir** um território vira um *Gardens & Graveyards* (P1 → P2 → P3 → QG do Chefe).
- **Território conquistado** sofre **Contra-Ataques** periódicos no estilo *Garden Ops / Flag of Power*: o dono antigo (ou uma facção rival) volta para retomar, e você defende a bandeira do QG em ondas.

---

## 2. Parte A — Guerra de Território 2.0

### A1. Invasão em sequência com barra de captura
- **Ordem fixa:** P1 → P2 → P3 → **Pátio do Chefe** (`bossCourtyard`, que já existe). Só o próximo ponto fica "ativo" (aro amarelo no chão + ícone piscando no minimapa). Os outros ficam trancados (cinza).
- **Barra de captura** (no HUD e num aro 3D no chão do posto):
  - Enche só com o jogador ou aliados no raio de ~14 m **e zero defensores**.
  - Com defensor dentro: **CONTESTADO**, a barra trava e pisca vermelho.
  - Sem ninguém dentro: a barra volta devagar.
  - Duração base de ~10 s, mais rápida com aliados (até −40%).
- **Relógio de invasão:** começa em 4:00 e cada posto capturado dá **+1:30**. Se zerar, ou se o jogador cair N vezes, a invasão falha: a facção expulsa você até o portão e os postos voltam.
- **Recuo dos defensores:** ao perder um posto, os sobreviventes **correm para o próximo** e reforçam a defesa lá (cria linha de frente).

### A2. Ondas de defensores por facção (ritmo, não spawn infinito)
- Um novo `WaveDirector` controla as ondas. Cada ponto ativo recebe ondas com **composição própria por facção**, saindo das garagens e portões que já existem:
  - 🔴 **CV:** motos rápidas + fuzileiros + 1 artilheiro de RPG a partir do P2.
  - 🔵 **PCC:** SUV blindada que desembarca o esquadrão + especialista de C4 (corre até você e explode).
  - 🟣 **A.R.E.S.:** drones voadores + exoesqueleto laser; mini-mecha no P3.
- **Pico e respiro:** onda forte → pausa de ~8 s → onda forte. O teto de inimigos vivos sobe a cada posto (8 → 11 → 14) para escalar a dificuldade.
- **Aliados da sua facção:** chegam em comboio a cada captura e passam a nascer do último posto tomado (já existe parcialmente, só será reorganizado).

### A3. Clímax — QG do Chefe
- Depois do P3, o pátio do chefe abre: **duelo de chefões**, com o boss inimigo e o boss aliado (já existe, só muda o gatilho do 2º posto para o 4º objetivo).
- Chefe derrotado = **território conquistado**, com chuva de studs e QG aliado (já existe).

### A4. ⭐ Contra-Ataque — os caras voltam (Garden Ops + Flag of Power)
- **Território conquistado não é mais para sempre.** Cada território tem um **Nível de Ameaça** que sobe com o tempo (mais rápido se você estiver longe).
- Ao encher, dispara um **CONTRA-ATAQUE**:
  1. Alerta tático no HUD ("CV CONTRA-ATACA A CIDADE DE DEUS — 60s") + ícone vermelho no minimapa e no mapa `[M]`.
  2. Os inimigos sobem pelas rotas de entrada e vão para a **Bandeira do QG** (nova peça 3D LEGO no pátio, com barra de posse).
  3. **5 ondas** com **10 s de pausa** entre elas. Na pausa caem **2 caixas LEGO** (coração, studs ou aliado extra).
  4. **Onda 3 = Roleta do Chefe:** um caça-níquel no HUD sorteia mini-boss, esquadrão de elite ou **jackpot de studs**.
  5. **Onda 5 = Chefe da facção.**
- **Resultado:**
  - **Defendeu:** recompensa grande + ameaça zerada + a guarnição do QG ganha +1 nível (mais guardas e um médico extra).
  - **Perdeu, ou não apareceu:** a facção retoma **1 posto por contra-ataque perdido**, começando pelo mais próximo do portão. Se perder os 3, o território volta para ela. Aí você precisa invadir de novo.
- **Ausência:** se você não vier, a luta é **simulada pela força da guarnição**, com chance de segurar proporcional ao nível. Assim vale a pena reforçar.
- **Configurável:** frequência ajustável (Pacífica / Normal / Guerra Total), já preparando o Painel `P` do Passo 10.

### A5. Mundo vivo entre facções (fase opcional, depois)
- As 2 facções IA também atacam o território uma da outra de vez em quando. O mapa `[M]` mostra a fronteira mudando de cor e você escolhe se entra na briga.

---

## 3. Parte B — 🏦 Mega Assalto ao Super Banco Central

### B1. Gatilho
- O evento começa de tempos em tempos (~10–15 min de jogo, com sorteio) ou na hora via debug/Painel `P`.
- Efeitos: as **luzes de alarme do saguão** (que já existem) acendem e giram, toca a **sirene**, aparece o alerta tático chanfrado "ASSALTO AO SUPER BANCO — PCC" e um ícone no minimapa. Viaturas da polícia convergem para o banco.

### B2. Fase 1 — Cerco da Fachada
- 2 SUVs da facção atravessadas na frente das portas duplas, atiradores na escadaria e 1 vigia no terraço.
- Objetivo no HUD: **"ENTRE NO BANCO"**.

### B3. Fase 2 — Saguão
- Assaltantes se protegem atrás das **pilastras destrutíveis** e dos balcões.
- Um **Técnico de C4** caminha até a **Porta do Cofre** e começa a plantar. A barra **"C4 NO COFRE"** de 60 s aparece no HUD.
  - Matar o técnico **pausa** a barra, mas outro técnico sai depois de uns segundos para continuar.
- **Civis reféns** deitados no saguão (estilo LEGO, sem violência pesada). Libertar com `[E]` dá bônus de studs.

### B4. Fase 3 — Cofre e Fuga (ramifica)
- **Você impediu o C4:** o **Mestre do Cofre** (chefe do PCC) sai de dentro do cofre para a luta final no saguão.
- **O C4 explodiu:** a **Porta Circular** voa em pedaços (destrutível que já existe), os bandidos pegam **sacos de ouro** e correm para as SUVs. Começa a **FUGA**: as SUVs com sacos ficam marcadas no minimapa e você persegue a pé, voando ou de carro. Destruir a SUV derruba o saco = recupera o ouro.
- Nos dois casos, o Mestre do Cofre é o último inimigo.

### B5. Recompensas e consequências
- **Assalto impedido:** chuva de **Studs Roxos** + **1 Bloco Dourado** (novo contador no HUD/save, para o Passo 10).
- **Ouro recuperado na fuga:** recompensa parcial, proporcional aos sacos.
- **Presos:** cada bandido derrotado soma em `prisonIslandData.prisonersInCellsCount` (já existe) e aparece nas **celas da Ilha da Prisão**.
- **Chefe derrotado:** desbloqueia o **Mestre do Cofre** na grade (Passo 8). Pode ficar para uma etapa separada se você preferir.
- Depois do evento, a porta do cofre **se reconstrói**, e há cooldown até o próximo assalto.

---

## 4. Arquitetura (arquivos novos e alterados)

| Arquivo | Papel |
| :--- | :--- |
| `src/world/events/WaveDirector.js` *(novo)* | Motor genérico de ondas: composição por facção, teto de vivos, pausas, onda de chefe, roleta. Usado pela invasão, pelo contra-ataque e pelo banco. |
| `src/world/events/CaptureZone.js` *(novo)* | Ponto de captura com barra, estado contestado, decaimento e aro 3D no chão. |
| `src/world/events/TerritoryCounterAttack.js` *(novo)* | Nível de ameaça, disparo, bandeira do QG, simulação de ausência e perda de postos. |
| `src/world/events/BankHeistEvent.js` *(novo)* | Máquina de estados do assalto (`IDLE → ALARME → FACHADA → SAGUÃO → COFRE/FUGA → CHEFE → FIM → COOLDOWN`). |
| `src/ui/ObjectiveHud.js` *(novo)* | Painel de objetivo no estilo `IDV.md`: título, barra de captura/C4, "ONDA 3/5", relógio, roleta. |
| `src/world/FactionWarSystem.js` | Troca a captura instantânea por `CaptureZone`, adiciona a ordem sequencial e entrega as ondas ao `WaveDirector`. |
| `src/world/regions/SuperBankBuilder.js` | Expõe as referências do alarme, da porta do cofre, dos pontos de cobertura e do spawn dos reféns (`world.superBankData`). |
| `src/ui/FactionIconsAndSaveSystem.js` | Salva o dono de cada posto, a ameaça, o nível da guarnição, os Blocos Dourados e o cooldown do assalto. |
| `tests/*.test.js` | Testes de: captura contestada, ordem sequencial, ondas, contra-ataque revertendo posto e estados do assalto. |

---

## 5. Ordem de implementação (cada etapa = você testa e aprova)

1. **Etapa 1 — Núcleo:** `WaveDirector` + `CaptureZone` + `ObjectiveHud` (base usada pelas próximas etapas).
2. **Etapa 2 — Invasão em sequência:** P1→P2→P3→Chefe, barra de captura, relógio e recuo dos defensores.
3. **Etapa 3 — Ondas por facção:** composição CV / PCC / A.R.E.S. e escala de dificuldade.
4. **Etapa 4 — Contra-Ataque:** ameaça, bandeira, 5 ondas, roleta, caixas e perda de postos.
5. **Etapa 5 — Assalto (parte 1):** gatilho, alarme, fachada e saguão com o C4.
6. **Etapa 6 — Assalto (parte 2):** cofre explodindo, fuga das SUVs, chefe, recompensas, Bloco Dourado e presos na prisão.

> Dá para inverter e fazer o banco antes (Etapas 1 → 5 → 6 → 2 → 3 → 4). O núcleo da Etapa 1 serve para os dois.

---

## 6. ❓ Decisões que preciso de você antes de começar

1. **Quem assalta o banco?** No jogo atual você escolhe uma facção (CV / PCC / A.R.E.S.) no início. Se você for do PCC:
   - (a) quem assalta é sempre uma facção **rival** sua, e você defende;
   - (b) você pode **participar do assalto** do seu lado (você ajuda a explodir o cofre e a polícia é o inimigo);
   - (c) só o PCC assalta, como diz o `AGENTS.md`.
2. **Contra-ataque quando você está longe:** perder posto sem estar lá é aceitável, ou o contra-ataque deve **esperar você chegar perto** para começar?
3. **Frequência padrão** do contra-ataque: a cada ~8 min, ~12 min ou ~20 min?
4. **Reféns civis** no saguão: pode ter, ou prefere sem?
5. **Chefe Mestre do Cofre jogável** já nesta leva, ou fica para o Passo 8 completo?

---

## 7. ✅ O que foi implementado (e decisões tomadas)

### Visual dos soldados (adendo do usuário)
- Novo `src/entities/FactionSoldierBuilder.js`: cada facção tem kit próprio por classe (fuzileiro, pesado com escudo, médico, especialista e chefão), mais o BOPE aliado.
  - **CV:** regata com "CV", corrente de ouro, boné virado, bandana, calça camuflada, AK. O pesado usa capacete de moto e uma **porta de carro como escudo**. O especialista leva **RPG**.
  - **PCC:** balaclava, colete com "PCC", headset, submetralhadora. O pesado tem capacete SWAT e escudo balístico. O especialista é **demolidor de C4**.
  - **A.R.E.S.:** capacete cyber com viseira neon, ombreiras, rifle laser. O pesado é um exo-esqueleto com reator e escudo de energia. O especialista é **operador de drone**.
  - **BOPE:** boina preta, caveira no peito e escudo com faixa amarela.
- Corrigido: o **tronco dos soldados não aparecia** (material múltiplo numa geometria fundida sem grupos) e os rostos estavam nas costas da cabeça.

### Invasão em sequência (A1–A3)
- Ordem P1 → P2 → P3 → Pátio do Chefe, com anel LEGO de captura no chão e estado contestado.
- Relógio de 4:00, com +1:30 por posto. Se zerar, ou se você cair, a invasão falha e os postos voltam ao dono.
- Defensores recuam para o próximo ponto. Os reforços chegam no ponto ativo.
- Especialistas: o RPG do CV causa dano em área, o C4 do PCC corre até você e explode, e o drone da A.R.E.S. dispara rajadas.

### Contra-Ataque (A4)
- **Decisão (pergunta 2):** se você não aparecer, a guarnição luta sozinha. A chance de segurar cresce com o nível dela (35% no nível 0, até 89% no nível 3).
- **Decisão (pergunta 3):** primeiro contra-ataque 10 min depois da conquista e os seguintes a cada 12 min. Configurável em `COUNTER_ATTACK_RULES`.
- **Simplificação:** perder a defesa devolve o **território inteiro**, em vez de 1 posto por vez. A regra fica mais fácil de entender: retome com uma nova invasão.

### Mega Assalto (B1–B5)
- **Decisão (pergunta 1):** quem assalta é sempre uma facção **rival** sua. É o PCC por padrão, ou o CV se você for do PCC. O BOPE chega para ajudar você.
- **Decisão (pergunta 4):** tem reféns civis, em versão leve estilo LEGO. Basta encostar neles para libertar.
- **Decisão (pergunta 5):** o chefe é só luta por enquanto. Deixá-lo jogável fica para o Passo 8 completo.
- Bloco Dourado: novo contador salvo no slot, mostrado em faixa na tela.
- Os presos aparecem em fila no Pátio de Banho de Sol da Ilha da Prisão e também são salvos.

### Para testar rápido (console do navegador)
```js
const fw = __legoGame.world.livingCity.factionWar;
fw.debugBankHeist();        // começa o Mega Assalto agora
fw.debugCounterAttack();    // contra-ataque no 1º território conquistado
```
