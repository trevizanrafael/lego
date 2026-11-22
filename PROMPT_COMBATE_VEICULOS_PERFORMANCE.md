# PROMPT — Veículos que Explodem com Gente Dentro, Dano por Parte do Corpo, Números de Dano, Travamentos, FPS e Ícone do Horário

> Cole este arquivo como prompt para o agente codador. Leia `AGENTS.md` e `IDV.md` antes.
> Base: `main` em `89e1cde` (polícia ondas 1–2 e colisão ondas 1–2 já feitas).
> Siga o protocolo de ondas do `AGENTS.md` (6.3) e **pare para o usuário testar** ao fim de cada onda.
> **Fica para o próximo prompt** (não fazer agora): overhaul completo das janelas de configuração/customização (oficinas, hangar, laboratório, configurações) para travar menos, ficarem melhores e com mais opções.

## O que o usuário pediu
1. **Carro tem que explodir** (hoje vira "uma moedinha") e **matar quem está dentro**. Precisa ter gente dentro, e cada ocupante morto **conta uma kill**.
2. **Dano por parte do corpo**: tiro na cabeça dá mais dano. **Mostrar o número do dano**, pequeno, para ter noção de quanto você está dando.
3. **Sniper com mais dano**: **headshot mata quase todo mundo**.
4. O jogo **congela** às vezes: com o Turbo Fantasma ao clicar com o botão direito, ao entrar em carro e ao abrir menus. A imagem para por um tempo e depois volta. Descobrir e corrigir.
5. **Contador de FPS** pequenininho num canto da tela.
6. **Tirar o emoji de lua** do horário do dia e colocar um **SVG**.

---

## 1. Veículos que explodem, com ocupantes e kills

### Como está hoje
- Todo carro é um "destrutível" (`type: 'car'`, registrado em 16 lugares). Quando a vida zera, cai em `_shatterObject` (`src/world/destructibles/DamageAndChainExplosionSystem.js` ~linha 315): **esconde a malha, solta estilhaços e uma chuva de studs** (`_spawnStudShower`). **Não explode** (só bomba de gasolina, caminhão-tanque e barril explodem).
- **Não existe ocupante**: as viaturas só "geram" policiais a pé quando chegam perto (`deployedTroops`). O trânsito tem um motorista só para o roubo de carro (`_ejectDriverOnCarjack`). Os comboios de facção desembarcam soldados.
- A kill (flash + X vermelho, `triggerPlayerKillFeedback` em `src/ui/hud/HitmarkerHud.js:196` + `graphicsPipeline.pulseKillFlash()`) só dispara para humanoides.

### Como fica (estilo GTA)
**Estágios de dano do veículo** (mesmo `hp` de hoje, por faixa):
| Vida | Efeito |
|---|---|
| < 60% | fumaça branca no capô |
| < 35% | fumaça preta, motor falhando (o NPC perde velocidade) |
| < 15% | **fogo no motor**: depois de ~4 s queimando, **explode** sozinho |
| 0 | **explode na hora** |
- Explosivos (RPG, C4, granada, barril) levam direto para a explosão.
- **Explosão**: usar `_triggerExplosion(center, ~7 m, dano)`, que já existe, com bola de fogo, onda de choque, som e tremor de câmera. Pode **encadear** em carros e bombas próximos (o sistema de cadeia já existe).
- **Carcaça**: o carro **não some**. Fica uma carcaça queimada (mesma malha com material carbonizado compartilhado, sem rodas/vidros, levemente afundada), com fumaça por ~30 s, e depois some com fade. Colisor desligado ou reduzido. **Nada de "moedinha"**: soltar poucos studs, não a chuva atual.
- Os helicópteros da polícia: ao zerar a vida, **caem girando com fumaça** e explodem ao tocar o chão.

**Ocupantes** (novo `src/world/vehicles/VehicleOccupants.js`):
- Todo veículo com IA tem uma lista de ocupantes `{ faction, role, humanoidHealth, seat }`:
  - viatura comum: 2 policiais;
  - Caveirão/BOPE: 4;
  - comboio de facção: os soldados que hoje desembarcam;
  - carro do trânsito: 1 motorista (às vezes + 1 passageiro);
  - helicóptero da polícia: piloto + atirador.
- **Visíveis**: o motorista (e o carona) aparecem sentados, com a cabeça e o tronco visíveis pelo vidro (boneco simplificado e instanciado, mesma anatomia dos pedestres).
- Os policiais que hoje "nascem" ao lado da viatura (`deployedTroops`) passam a ser **os ocupantes descendo do carro**: se a viatura está cheia, descem 2; se já desceram, ela está vazia.
- **Fugir do carro**: em fogo ou parado e muito danificado, os ocupantes **saem correndo** (como no GTA).
- **Tiro no motorista** pelo para-brisa pode matá-lo: o carro perde o controle e bate.
- **Explosão com gente dentro**: todos os ocupantes **morrem**. Os corpos são lançados ou ficam carbonizados ao lado (usar o `HumanoidCorpseManager`, que já existe).
- **Cada ocupante morto por causa do jogador conta uma kill**: chama `triggerPlayerKillFeedback` (um flash por explosão, não um por pessoa), conta no placar e aplica a regra de procurado por vítima (matar policial é crime grave; matar soldado rival em guerra não dá procurado).
- **O carro do jogador também explode**: se o jogador estiver dentro, sofre dano grande (e morre se não sair a tempo, como no GTA). → confirmar com o usuário.

**Placar de kills**:
- Contador da sessão por tipo (policiais, civis, CV, PCC, A.R.E.S.), mostrado na pausa (card do operador).
- **Kill feed** discreto perto da mira: `+1 POLICIAL`, `+3 (VIATURA)`, durando 1,5 s, em JetBrains Mono pequeno, na IDV.

---

## 2. Dano por parte do corpo + números de dano

### Como está hoje
- Os tiros acertam o humanoide como um cilindro (`radius`/`height` do destrutível) e passam `p.mesh.position` (o ponto de impacto) para `damageObject` (`BallisticsSimulationUpdate.js` ~linha 63). **Não existe zona de acerto**: cabeça, tronco e perna dão o mesmo dano.
- O PCC/Contador (fuzil de precisão com luneta) tem `baseDamage: 46` × 90% ≈ 41 (`src/entities/operators/WeaponCatalog.js` ~linha 93). Policiais têm 65/95/120/240 de vida; civis, 100.

### Como fica
- **Zonas de acerto** (novo `src/world/npc-health/HumanoidHitZones.js`): calcular a zona pela **altura do ponto de impacto** em relação ao pé do NPC, normalizada pela altura do boneco (funciona para bonecos normais e escalados, como Exo e Big-Fig):
| Zona | Faixa (altura relativa) | Multiplicador |
|---|---|---|
| **Cabeça** | ≥ 0,76 | **×3** (armas de precisão: **×4**) |
| Tronco | 0,40 – 0,76 | ×1 |
| Braços/pernas | < 0,40 (ou lateral do tronco) | ×0,65 |
- Capacete/blindagem (riot, BOPE, Exo, chefes): reduz o multiplicador da cabeça (ex.: ×2), sem anular. Chefes e Big-Figs **não** morrem com um headshot.
- **Sniper mais forte**: subir o fuzil de precisão para **~70 de dano no corpo** e **headshot ×4 ≈ 250**, sem queda de dano com a distância. Resultado: headshot mata civil, policial, soldado e choque com 1 tiro; Exo (240) fica quase morto; chefes, não. Ajustar a arma de carga da **Agulha** (carga cheia) na mesma linha. Os números ficam no `WeaponCatalog.js`, não espalhados.
- A zona vai em `damageOpts.hitZone` para o `HumanoidHealthModel` (reação de queda da cabeça diferente) e para o hitmarker (**X amarelo/maior no headshot**, com um som "tink" curto).
- **Números de dano** (novo `src/ui/hud/DamageNumbersHud.js` + CSS):
  - Número pequeno (JetBrains Mono ~12 px) que sobe e some em ~0,6 s, **na posição do impacto projetada na tela**.
  - Branco = corpo; amarelo = cabeça (com um `✕` pequeno de headshot); cinza = braços/pernas; vermelho = golpe que matou.
  - Escopeta e minigun: **somar os acertos no mesmo alvo dentro de 0,25 s** num número só (não 8 números por tiro).
  - Pool de no máximo 12 elementos reaproveitados (sem criar DOM por tiro).
  - Funciona também para veículos (número menor).
  - Opção em Configurações: "Números de dano" Ligado/Desligado.

---

## 3. Travamentos (congelamentos de 0,2 a vários segundos)

O sintoma ("a imagem para e depois volta") é típico de **compilação de shader no meio do jogo** e/ou de **montar muita coisa de uma vez** no clique. Achei causas concretas:

### Causas encontradas
1. **Farol do carro liga/desliga uma luz real** (`src/world/atmosphere/VehicleNightLightsRig.js` ~linhas 167–190): à noite, ao entrar no carro, o jogo cria um `SpotLight` e depois alterna `visible` ao entrar e sair. No three.js, **mudar o número de luzes visíveis faz recompilar o shader de TODOS os materiais da cena** → congela ao entrar/sair do carro à noite.
2. **Hangar de aeronaves adiciona 2 `PointLight` na cena principal** ao abrir (`AircraftStudioModalController.js` ~linha 207) → mesma recompilação geral ao abrir o menu.
3. **Moto do Turbo Fantasma é montada do zero a cada invocação** (`summonTurboEnergyBike` em `TurboGhostHeroVfx.js`): ~15 `BufferGeometry` novas, registro de um destrutível novo e materiais com clearcoat/emissivo que podem estar compilando pela 1ª vez. O botão direito do Turbo chama isso.
4. **Materiais que só aparecem no meio do jogo** (VFX de heróis, explosões, unidades da polícia, carcaças, novos operadores) compilam no primeiro uso. Hoje só existe um `renderer.compile(scene, camera)` no carregamento (`src/main.js:360`), que não cobre o que é criado depois.
5. Menus que **reconstroem DOM/canvas grandes** no clique (retratos em alta resolução, `innerHTML` de listas inteiras) — medir antes de mexer.

### O que fazer
- **Primeiro medir** (novo `src/debug/HitchProfiler.js`, ativo com `?debug=1`): a cada frame acima de 50 ms, logar no console a **última ação** (rótulo posto em entrar no carro, abrir menu, invocar moto, trocar de herói…), a duração, a **variação de `renderer.info.programs.length`** (se subiu, foi compilação de shader), a variação de geometrias/texturas e o heap. Usar `PerformanceObserver('longtask')` também.
- **Regra de ouro: a quantidade de luzes da cena nunca muda durante o jogo.** Criar o `SpotLight` do farol no carregamento, sempre `visible = true`, e só mexer na `intensity` (0 quando desligado). Mesmo para qualquer outra luz alternada.
- **Hangar/oficinas**: não adicionar luzes na cena principal. Usar luzes pré-alocadas desde o carregamento (intensidade 0 quando fechado) ou iluminar a prévia com o ambiente/emissivo.
- **Moto do Turbo**: montar **uma vez** (no carregamento ou na 1ª troca para o Turbo, fora de combate) e **reaproveitar** (esconder/mostrar e reposicionar). Mesmo padrão para qualquer coisa invocada repetidamente.
- **Aquecimento de shaders** (warm-up): no loading, criar um objeto escondido com **cada material/variação usado em runtime** (VFX de cada herói e operador, explosão, fogo, fumaça, carcaça, materiais da polícia, sniper) e chamar `renderer.compileAsync` (ou `compile`) antes de liberar o jogo. A tela de loading já tem a etapa "pré-compilação"; ela passa a cobrir tudo.
- **Nada de `new Material` nem `new Geometry` em clique/tiro**: usar cache/pool (já existe `getLegoMaterial`; garantir que ele devolve a mesma instância para os mesmos parâmetros).
- Menus: abrir o modal **na hora** (esqueleto) e preencher pesado no próximo frame (`requestAnimationFrame`/`requestIdleCallback`); cachear retratos em alta resolução.
- **Critério de aceite**: com o profiler ligado, entrar/sair de carro de noite, invocar a moto do Turbo 10 vezes, abrir/fechar hangar, oficina, pausa e grade de personagens **sem nenhum frame acima de 50 ms** e sem aumento de `renderer.info.programs` depois do loading.

---

## 4. Contador de FPS
- Novo `src/ui/hud/FpsCounterHud.js` + CSS: **bem pequeno** (JetBrains Mono ~10 px), no **canto superior direito**, abaixo do indicador de rádio, sem caixa.
- Mostra `60 FPS · 16.6 ms` (média de 0,5 s) e o **pior frame** do último segundo.
- Cor: branco-acinzentado ≥ 55 FPS, âmbar 30–55, vermelho < 30.
- Atualiza o texto **4× por segundo** (não a cada frame).
- Opção em Configurações > Vídeo: "Mostrar FPS" (padrão **ligado**, a pedido do usuário).

## 5. Ícone do horário em SVG
- `DayNightAtmosphereManager.getFormattedClock()` (`src/world/DayNightAtmosphereManager.js` ~linha 117) devolve emoji (`☀`, `🌙`, `🌅`) dentro de `display`. Passar a devolver `iconKey: 'day' | 'dusk' | 'night'` e o HUD/minimapa desenha um **SVG inline** na IDV (traço fino, mesma cor do texto): sol (círculo + raios curtos), crepúsculo (meio sol na linha do horizonte) e lua (crescente).
- Procurar e trocar **qualquer outro emoji** na interface (ex.: `✔` em avisos) por SVG ou texto.

---

## 6. Ondas (arquivos disjuntos por agente)
- **Onda 1 (paralelo)**
  - A — Travamentos: `src/debug/HitchProfiler.js` (novo), `VehicleNightLightsRig.js`, `AircraftStudioModalController.js`, `TurboGhostHeroVfx.js` (pool da moto), warm-up de shaders no loading (`src/main.js` só no ponto de warm-up). **Fazer o profiler primeiro e anexar o log antes/depois no relatório.**
  - B — FPS e SVG do horário: `FpsCounterHud.js` (novo) + CSS, `DayNightAtmosphereManager.js` (`getFormattedClock`) + quem exibe o relógio no minimapa.
  - C — Zonas de acerto, números de dano e sniper: `HumanoidHitZones.js` (novo), `DamageNumbersHud.js` (novo) + CSS, `WeaponCatalog.js`, repasse do `hitZone` em `BallisticsSimulationUpdate.js` e `HitmarkerHud.js` (headshot).
- **Onda 2**
  - D — Veículos: `VehicleOccupants.js` (novo), estágios de dano/fogo/explosão/carcaça (em `src/world/destructibles/`, submódulo novo `VehicleWreckAndFire.js` em vez de crescer o `DamageAndChainExplosionSystem.js`), integração com polícia (`PoliceVehiclePursuitAI.js`/`PoliceCarDriver.js`), facções (`CombatUnitsAndConvoys3D.js`), trânsito e helicóptero (`PoliceHelicopterPilot.js`).
  - E — Placar e kill feed: contador de sessão + kill feed (novo `KillFeedHud.js`) + linha no card da pausa.
- Coordenador: `npm test`, `git status --short`, commit atômico por onda, **parar para o usuário testar**.

## 7. Testes
- `tests/hit-zones.test.js`: zona pela altura (boneco normal e escalado); headshot de sniper mata policial/choque com 1 tiro, não mata chefe.
- `tests/vehicle-occupants.test.js`: explosão mata todos os ocupantes e conta N kills para o jogador; explosão causada por facção não conta kill do jogador; viatura que já desembarcou está vazia.
- `tests/no-runtime-light-changes.test.js`: o número de luzes da cena fica igual ao entrar/sair do carro e abrir o hangar.
- Manual: atirar numa viatura cheia até explodir (fumaça → fogo → explosão, carcaça fica, +2 kills, flash); headshot de sniper num policial; números de dano aparecem e somam na escopeta; FPS no canto; relógio com SVG; entrar no carro de noite e invocar a moto do Turbo sem congelar.

## 8. Confirmar com o usuário antes de começar
1. O **carro do jogador** também explode com ele dentro (pode morrer, como no GTA)?
2. Explosão **em cadeia** entre carros próximos: liga?
3. Kill feed perto da mira (`+1 POLICIAL`): quer, ou só o contador na pausa?
4. Números de dano **ligados por padrão**?
