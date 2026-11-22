# PROMPT — Rolamento no Ctrl + Pedestres de Verdade + Vida, Queda e "Flash" de Kill estilo GTA V

> Cole este arquivo como prompt para o agente codador. Leia `AGENTS.md`, `IDV.md` e `PLANO_OPERADORES_FACCAO.md` antes.
> Base: `main` em `81b5a5c` (operadores, grade [TAB] e loja já implementados).
> Siga o protocolo de ondas do `AGENTS.md` (6.3) e **pare para o usuário testar** ao fim de cada onda.

## O que o usuário pediu

1. **Ctrl = cambalhota (rolamento) para os 6 operadores**, como no GTA V.
2. **Pedestres com cara de gente**, igual aos personagens, e não "bicho".
3. **Pedestres com vida**: os primeiros tiros derrubam, mais tiros matam.
4. **"Piscadinha" na tela ao matar** um NPC ou policial, como o efeito de kill do GTA V.

---

## 1. Rolamento no Ctrl (todos os operadores)

### Como está hoje
- `ControllerInputAndEvents.js` (~linha 430): `ControlLeft`/`ControlRight`/`KeyC` só chamam `_triggerTacticalRoll()` se o herói for `caveira` ou `sombra`.
- `_triggerTacticalRoll()` (`FootSwimAndCollisionPhysics.js:10`) rola sempre **para onde o personagem está virado**, sem considerar as teclas de movimento.
- A animação já existe: `minifig.triggerTacticalRoll()` + `rollTimer`/`rollDuration = 0.42` (`MinifigCombatAnimator.js`).

### O que fazer
- Liberar o rolamento para **todo operador de facção** (`isFactionOperatorKey(key)` do `OperatorCatalog.js`), mantendo Caveira e Sombra. Os outros heróis extras continuam sem rolamento (o Ctrl deles segue fazendo o que já faz, como descer no voo).
- **Direção estilo GTA**: rolar na direção das teclas WASD **relativa à câmera** (A = rola para a esquerda, S = rola para trás). Sem tecla de movimento, rola para a frente. **Mirando** (botão direito segurado), o personagem continua olhando para a mira enquanto rola de lado; sem mirar, vira para a direção do rolamento.
- Condições: só no chão, a pé e fora de veículo; não rola durante a recarga da arma (cancela a recarga) nem segurando o escudo (Muralha) ou girando a minigun (Bastião-7).
- Recarga do rolamento: ~0,9 s. Durante o rolamento a arma não atira.
- Distância e peso por função (num campo novo `roll` em `RoleBaselines.js`, não em `if`):
  - Dano / Suporte: ~3,6 m em 0,42 s.
  - Tanque e híbridos com tanque (Marretão, Muralha, Bastião-7): ~2,6 m em 0,5 s, mais pesado.
- Proteção leve: **40% menos dano** nos primeiros 0,2 s do rolamento (não fica invencível).
- Som: o `soundFX.playTacticalRoll()` atual. Câmera: pequeno balanço, sem mudar o FOV.
- Atualizar a dica de controle / pointer prompt: `[CTRL] Rolar`.

---

## 2. Pedestres com cara de gente

### Diagnóstico (print `ped_vs_operador.png` em anexo: o pedestre à esquerda, o Marretão à direita)
Os pedestres **não usam o mesmo boneco dos personagens**. Eles têm geometria própria em
`src/world/living-city/PedestrianSharedGeometriesAndArchetypes.js`, e é isso que deixa eles com cara de bicho:
- **Mãos em gancho gigantes**: `buildNpcDetailedArmGeo()` usa um `TorusGeometry` como "garra" (`clawHand`). No print parecem pinças de caranguejo, maiores que o pulso.
- **Braços de "salsicha" com bola no ombro**, saindo pra frente e pros lados como pata (pose errada: o pivô fica em `x = ±0.52` com rotação errada para o corpo).
- **Cabeça achatada e larga**, com cabelo/chapéu como um bloco deslocado para trás. A face fica num "shell" separado que não acompanha bem a cabeça.
- **Proporção diferente do herói**: tronco estreito, cabeça maior, pernas curtas. Ao lado do operador, parece outra espécie.
- Mochila (`backProp`) maior que o tronco em alguns arquétipos.

### O que fazer
- **Mesma anatomia dos personagens**: as geometrias compartilhadas dos pedestres passam a ser **as mesmas peças do rig dos heróis** (`MinifigBaseRigBuilder.js`: `createTrapezoidTorsoGeometry` e as funções de cabeça, quadril, perna, braço e **mão em C pequena** do minifig). Se essas peças não estiverem exportadas, exportar do `MinifigBaseRigBuilder.js` sem mudar o visual dos heróis.
- **Manter o instancing** (160 civis a 60 FPS): continuam `InstancedMesh`, só troca a geometria. Mesma altura total, mesmos pontos de pivô dos heróis (ombro, quadril, pescoço).
- **Pose em repouso correta**: braços para baixo, colados ao corpo, com leve balanço ao andar (igual à locomoção do herói em `MinifigLocomotionAnimator.js`, simplificada).
- **Rostos**: usar o mesmo sistema de rostos procedurais dos personagens (texturas em `src/materials/modules/`), com variações de pele, cabelo, barba e óculos por arquétipo. Cabelo e chapéu encaixados na cabeça, não um bloco flutuando atrás.
- **Roupas por bairro** (os arquétipos que já existem): mesma paleta sombria da IDV, sem cores de brinquedo estouradas.
- Props (mochila, câmera, fone) em escala com o novo corpo.
- **Policiais a pé**: hoje são um corpo + cabeça + arma toscos (`PoliceHelicopterAndTacticalUnits.js` ~linha 30, `officerBodyGeo`/`officerHeadGeo`). Passar a usar `createFactionSoldierVisual('pf' | 'bope', role)`, que já existe e tem kit de polícia.
- Critério de aceite: num print lado a lado (pedestre, policial, operador), os três têm **a mesma silhueta de boneco**, mudando só roupa e acessórios.

---

## 3. Vida, queda e morte estilo GTA (civis, policiais e soldados de facção)

### Como está hoje
- **Civis são imortais**: registrados com `hp: 999999` (`PedestrianCrowdAndInstancing.js` ~linha 252). Qualquer tiro chama `_triggerCivilianSlapstickHit`, que dá um "pulinho cômico", solta studs e faz ele correr. O comentário diz literalmente "COMÉDIA LEGO SEM PUNIÇÃO" — isso **deixa de valer**.
- **Policiais e soldados** têm vida (`hp: 65/95/120/240`), mas ao morrer viram estilhaços de LEGO e somem (`_shatterObject` em `DamageAndChainExplosionSystem.js`). Não tem corpo caído.

### Novo comportamento (um sistema só para todo NPC humanoide)
Criar `src/world/npc-health/` com submódulos (150–450 linhas cada):
- `HumanoidHealthModel.js` — vida, estado (`ALIVE → STAGGER → DOWNED → DEAD`) e regras.
- `HumanoidHitReactions.js` — reações a tiro, pose de queda e de levantar.
- `HumanoidCorpseManager.js` — corpos no chão, limite e fade.

Regras:
| | Civil | Policial a pé | Soldado de facção |
|---|---|---|---|
| Vida | 100 | a atual (65/95/120) | a atual |
| Reação ao 1º tiro | tropeça para trás (stagger 0,3 s) | stagger | stagger |
| Derrubada | se um tiro tira ≥ 35% da vida **ou** no 2º tiro em menos de 1,5 s: **cai no chão** (~1,2 s), depois levanta e foge mancando | só com explosão ou escopeta de perto | igual ao policial |
| Morte (vida 0) | cai (de costas ou de lado, conforme a direção do tiro) e **fica no chão** | igual | igual |
- **Corpo**: fica deitado ~20 s e depois some com fade. No máximo 12 corpos ao mesmo tempo (o mais antigo some primeiro). Nada de virar estilhaço.
- **Pedestres instanciados**: a queda funciona no próprio instancing, girando o `root` (~90° em X ou Z) e encostando no chão; braços e pernas numa pose "caído". O `Object3D` de cada parte já existe por pedestre.
- **Sem sangue** (classificação LEGO). No impacto: faísca/poeira pequena e o som de impacto atual.
- **Studs**: soltam studs só ao morrer, não a cada tiro como hoje.
- **Pânico**: tiro perto de civis continua disparando `triggerPedestrianPanicNear`. Civis que veem alguém morrer correm e se agacham.
- **Polícia (GTA)**: ferir civil soma "caos"; **matar** civil ou policial é crime grave. Usar o que já existe: `addChaos(points, isMajorCrime)` em `WantedEscalationAndEscapeRules.js`, ligado pelos hooks `onObjectDamaged`/`onObjectDestroyed`. Matar soldado de facção rival em guerra **não** dá procurado (já existe `_isFactionWarContext`).
- **Respawn**: os civis mortos voltam ao pool depois que o corpo some, em um ponto **fora da visão** do jogador.
- Dano por arma: usar o `damage` das armas do `WeaponCatalog.js` com o multiplicador da função, sem número fixo novo. Ajuste fino: um civil morre com ~3 tiros de pistola, 2 de fuzil e 1 de escopeta de perto.

---

## 4. "Piscadinha" de kill estilo GTA V

Quando o **jogador** mata um NPC humanoide (civil, policial, soldado, chefe):
- **Flash na tela**: pulso curto (~0,18 s) branco/dessaturado na tela inteira, que some rápido. Fazer no **pós-processamento**: adicionar um uniform `uKillFlash` (0..1) no `GOTHAM_NOIR_SHADER` (`src/graphics/GraphicsPipeline.js`) que clareia e dessatura a imagem, com função pública `graphicsPipeline.pulseKillFlash()`. Fallback em CSS (`#kill-flash-overlay`) quando o composer não estiver ativo (o pipeline já tem fallback de renderização direta).
- **Som**: um "thump" grave e curto no `soundFX` (novo `playKillConfirm()`), mais alto que o tiro.
- **Hitmarker**: a cada tiro que acerta um NPC, um X pequeno branco no centro da mira por ~0,12 s; **no kill o X fica vermelho** e um pouco maior. Novo módulo `src/ui/hud/HitmarkerHud.js` + CSS em `styles/` (atualizar o cache-bust no `index.html`).
- Vários kills em sequência não acumulam: o flash reinicia, não soma.
- Opção em **Configurações > Vídeo**: "Efeito de kill" Ligado/Desligado (acessibilidade).
- Não disparar com mortes que o jogador não causou (guerra entre facções, polícia x facção).
  O dano precisa carregar quem disparou (`damageOpts.sourceIsPlayer` ou similar). Se hoje não carrega, adicionar no `OperatorWeaponRuntime.js` e nos projéteis do jogador. Isso também é a base do futuro modo invasão.

---

## 5. Ondas (arquivos disjuntos por agente)

- **Onda 1 (paralelo)**
  - A — Rolamento: `ControllerInputAndEvents.js` (só o bloco do Ctrl), `FootSwimAndCollisionPhysics.js` (`_triggerTacticalRoll`), `RoleBaselines.js` (campo `roll`).
  - B — Visual dos pedestres: `PedestrianSharedGeometriesAndArchetypes.js`, `PedestrianBehaviorAndReactions.js` (só `_buildCivilianLegoMinifig` e os rostos), exports de `MinifigBaseRigBuilder.js` (sem mudar o visual dos heróis).
  - C — Policial a pé com o kit de soldado: `PoliceHelicopterAndTacticalUnits.js`.
- **Onda 2 (paralelo)**
  - D — `src/world/npc-health/*` (novos) + integração em `PedestrianCrowdAndInstancing.js` / `PedestrianBehaviorAndReactions.js` (hit e morte) + `CombatUnitsAndConvoys3D.js` (soldados) + desvio do `_shatterObject` para NPC humanoide em `DamageAndChainExplosionSystem.js`.
  - E — Kill flash + hitmarker + som: `GraphicsPipeline.js`, `src/ui/hud/HitmarkerHud.js`, CSS novo, `soundFX` (submódulo de SFX de combate) e o "quem disparou" em `OperatorWeaponRuntime.js`.
  - O hook de procurado (`WantedEscalationAndEscapeRules.js`) fica com o **coordenador**, depois da onda.
- Coordenador: `npm test`, `git status --short`, commit atômico por onda, **parar para o usuário testar**.

## 6. Testes
- `tests/npc-health.test.js`: transições ALIVE→STAGGER→DOWNED→DEAD, limite de 12 corpos, kill do jogador dispara o flash e kill entre facções não.
- `tests/operator-roll.test.js`: a direção do rolamento segue WASD relativo à câmera; tanque rola menos; não rola no ar nem em veículo.
- Manual: print lado a lado (pedestre, policial, operador); atirar num civil (cai no 1º/2º tiro, morre no 3º de pistola, corpo fica e some); matar policial (flash + X vermelho + sobe procurado); guerra entre facções sem flash.

## 7. Confirmar com o usuário antes de começar
1. **Sem sangue** (só poeira/faísca) — confirma? Ou quer algo como "estilhaço de LEGO" no lugar do sangue?
2. Matar civil deve **dar procurado** como no GTA? (Hoje bater em civil é "comédia sem punição".)
3. O civil derrubado que levanta deve **fugir mancando**, ou só correr normal?
