# 🪜 Guia Passo a Passo de Desenvolvimento (`PASSO_A_PASSO.md`)

Este documento divide a construção do jogo **LEGO Heróis & Guerra Urbana (3D)** em **10 Passos Sequenciais**.  
**Regra para a IA:** Desenvolva **um passo por vez** e só avance para o próximo quando o **Resultado Esperado** do passo atual estiver 100% funcionando e aprovado pelo usuário.

---

## 🔹 PASSO 1: Base 3D, Câmera em 3ª Pessoa & Boneco LEGO Articulado

### 🛠️ O que fazer:
1. Criar a estrutura do projeto em **Three.js** (`index.html`, `style.css` e módulos JS em `src/`).
2. Configurar cena 3D com iluminação solar, sombras em tempo real, céu diurno e um quarteirão plano inicial de teste (asfalto com faixas, calçadas com pinos de LEGO e alguns prédios ao redor).
3. Criar o gerador procedural de **Minifigura LEGO 3D Articulada** (cabeça cilíndrica com pino no topo, tronco trapezoidal, braços, mãos e pernas separados em plástico brilhante) com animações fluidas de:
   * Respirar parado (*Idle*);
   * Andar e Correr (balanço de braços e pernas);
   * Pular e Cair.
4. Implementar a **Câmera em 3ª Pessoa** controlada pelo mouse (orbitando suavemente atrás do boneco) e movimentação em `WASD` + `Espaço` + `Shift`.

### ✅ Resultado para ir para a próxima parte:
* Ao abrir o jogo no navegador, o jogador vê seu **bonequinho LEGO 3D brilhante** em 3ª pessoa numa rua asfaltada, consegue girar a câmera livremente com o mouse em 360°, andar, correr e pular sobre a calçada e os carros estacionados com animação de pernas e braços funcionando liso a 60 FPS.

---

## 🔹 PASSO 2: Destruição Física de LEGO, Chuva de Studs & HUD Clássica

### 🛠️ O que fazer:
1. Criar a **HUD estilo LEGO** no canto superior esquerdo: retrato 3D/ícone do personagem atual, **4 Corações de LEGO** de vida, contador animado de **Studs** (moedinhas) e barra de progresso de *True Hero* no topo.
2. Criar objetos quebráveis de rua feitos de peças LEGO: **Hidrantes** (esguicham água ao quebrar), **Postes de Luz**, **Bancas de Jornal**, **Caixas**, **Cercas** e **Carros Estacionados**.
3. Implementar o sistema de **Desmontagem & Física de Studs**:
   * Quando um objeto leva dano e quebra, ele se despedaça em bloquinhos 3D que quicam no chão e solta **Studs Prata (`10`), Ouro (`100`), Azul (`1.000`) e Roxo (`10.000`)**.
   * Ao passar perto dos Studs, eles voam até o boneco com som metálico satisfatório de coleta e somam no contador da HUD.

### ✅ Resultado para ir para a próxima parte:
* O jogador consegue bater ou atirar nos carros, postes e hidrantes da rua, vê as pecinhas de LEGO voando com física pelo chão, coleta as moedinhas brilhantes (Studs) e vê o contador de dinheiro e a barra no topo da HUD subindo em tempo real.

---

## 🔹 PASSO 3: Os 2 Heróis Iniciais Completos (`Comandante Caveira` + `Solaris`)

### 🛠️ O que fazer:
1. Implementar o **Herói #1 — Comandante Caveira (BOPE)**:
   * Visual LEGO tático preto com boina, caveira no peito e fuzil 3D nas mãos.
   * **Rolamento tático de esquiva**, tiro rápido de **Fuzil Tático** (com mira central na tela) e arremesso de **Granada Explosiva/Flashbang** (`Clique Direito` / `E`).
2. Implementar o **Herói #2 — Solaris (Guerreiro Solar / Fogo)**:
   * Visual LEGO rubro e dourado com partículas de fogo.
   * **Sistema de Voo 3D Completo:** Apertar `Espaço` 2x no ar ativa a levitação (*Hover*); segurar `Espaço` sobe até o topo dos prédios; segurar `Shift` ativa o **Voo Supersônico de Cometa** com câmera dinâmica e rastro de chamas.
   * Poderes: Disparo de **Bolas de Fogo**, **Raio Solar Contínuo** (que derrete objetos dourados de LEGO) e explosão **Supernova** em área.
3. Permitir alternar instantaneamente entre **Comandante Caveira** e **Solaris** apertando `Tab` ou `1`/`2` (inclusive no meio de um pulo lá do alto do prédio!).

### ✅ Resultado para ir para a próxima parte:
* O jogador pode subir voando até o topo do prédio mais alto com o **Solaris** soltando fogo e raio laser dourado, pular lá de cima e trocar no meio da queda para o **Comandante Caveira**, caindo no asfalto no rolamento tático e metralhando/jogando granada nos carros da rua.

---

## 🔹 PASSO 4: O Mapa Completo das 10 Regiões & O Interior do Super Banco Central

### 🛠️ O que fazer:
1. Construir o mapa definitivo completo da **Grande Ilha Metropolitana** + arredores, posicionando cada região exatamente no seu lugar:
   * **Centro:** Centro Financeiro / Times Square + **Complexo da Torre dos Heróis** (com heliponto no topo) + **Parque Central & Lago**.
   * **Norte:** **Bairro Residencial / Subúrbio** (casas, praça, pizzaria e **Posto de Gasolina** que explode em cadeia).
   * **Sul:** **Praia & Calçadão Turístico** (areia, coqueiros, píer com **Roda-Gigante** e mar).
   * **Leste:** **Distrito Industrial / Submundo** (fábrica, ferro-velho, becos das facções) + **Porto & Ponte Suspensa** (guindastes e contêineres).
   * **Oeste:** **Aeroporto & Base Militar Terrestre** (pista longa e hangares).
   * **Sudeste (Ponte):** **Ilha da Prisão de Segurança Máxima** (muralhas, pátio e celas).
   * **No Céu (Acima do Centro):** **Aeroporta-Aviões** flutuando nas nuvens com 4 turbinas gigantes.
2. Construir o **Interior Monumental do Super Banco Central** (o único prédio com interior aberto sem loading): portas de vidro na entrada, grande saguão de mármore com colunas destrutíveis, balcões, laseres e a **Porta Gigante do Cofre** cheia de barras de ouro e *studs* roxos.
3. Adicionar **Minimapa Redondo/Urbano** na HUD e **Mapa Completo (`M`)** com o nome de cada bairro.

### ✅ Resultado para ir para a próxima parte:
* O jogador consegue voar com o **Solaris** do Subúrbio ao Norte até a Praia ao Sul, do Aeroporto a Oeste até o Porto e a Ilha da Prisão a Leste, pousar no **Aeroporta-Aviões** lá nas nuvens e entrar andando pelas portas do **Super Banco Central** para ver o saguão e o cofre gigante por dentro.

---

## 🔹 PASSO 5: Os Novos Heróis #3, #4 e #5 (`Titã Blindado`, `Vingador de Chumbo` e `Sombra Escarlate`)

### 🛠️ O que fazer:
1. **Herói #3 — Titã Blindado (Mecha-Policial *Big-Fig*):**
   * Modelo 3D *Big-Fig* gigante em preto e dourado.
   * **Superpulo Pesado** (racha o chão ao cair), **Soco Foguete** (quebra **Paredes Rachadas** espalhadas pelo mapa), terremoto de escudo, metralhadora e mecânica de **pegar carros da rua na mão e arremessar longe**.
2. **Herói #4 — Vingador de Chumbo (Justiceiro Urbano Pesado):**
   * Troca de armas (`R`): **Duas Submetralhadoras**, **Escopeta de Impacto** (joga inimigos longe) e **Bazuca RPG** (destrói **Objetos Prateados Brilhantes** e barricadas blindadas).
3. **Herói #5 — Sombra Escarlate (Ninja de Gancho Magnético):**
   * **Balanço em Gancho Magnético** pendurando nos prédios do Centro Financeiro, corte duplo de **Katanas Energizadas**, **Puxão Magnético** (arranca escudos/armas e puxa alavancas altas) e **Bomba de Fumaça** (fica invisível para passar por laseres do Banco).

### ✅ Resultado para ir para a próxima parte:
* O jogador pode esmagar e arremessar carros com o *Big-Fig* **Titã Blindado**, explodir portões prateados de RPG com o **Vingador de Chumbo** e atravessar as avenidas se balançando pelos prédios com o gancho do **Sombra Escarlate**.

---

## 🔹 PASSO 6: Os Novos Heróis #6, #7 e #8 (`Turbo Fantasma`, `Voltaico` e `Vórtex`) + Grade de Seleção

### 🛠️ O que fazer:
1. **Herói #6 — Turbo Fantasma (Motociclista Turbo Urbano):**
   * **Invoca sua Moto Energética Ciano** instantaneamente de qualquer lugar, solta **Muralha de Luz** atrás da moto (que capota e explode carros inimigos) e ataca com correntes giratórias.
2. **Herói #7 — Voltaico (Senhor da Tempestade / Eletricidade):**
   * **Teleporte Elétrico** instantâneo mirando nos postes de luz e antenas, disparo de **Corrente de Raios (*Chain Lightning*)** que salta entre múltiplos alvos, sobrecarga de **Geradores Elétricos** e **Pulso EMP**.
3. **Herói #8 — Vórtex (Colosso Simbionte / Metamorfo):**
   * **Transformação em tempo real (`F`)** entre forma Normal Ágil e forma **Big-Fig Monstruosa**, ataque de tentáculos em área e **Laço Abissal** que puxa helicópteros do ar para o chão.
4. Criar a **Grade/Roda de Seleção de Personagens (`Tab` / `U`)** estilo LEGO, onde os 2 iniciais já vêm liberados e os outros 6 podem ser desbloqueados usando os *Studs* coletados (com opção de botão "Liberar Todos para Teste").

### ✅ Resultado para ir para a próxima parte:
* Os **8 Heróis Originais** estão 100% jogáveis na Grade de Seleção (`Tab`), cada um com seu visual, animação, forma de locomoção e poderes funcionando perfeitamente.

---

## 🔹 PASSO 7: Cidade Viva — Pedestres, Trânsito, Polícia & As 3 Facções em Guerra (`CV`, `PCC` e `A.R.E.S.`)

### 🛠️ O que fazer:
1. Adicionar **Trânsito Urbano** (carros, táxis, caminhões e viaturas andando pelas ruas e parando quando você entra na frente) e **Pedestres LEGO** nas calçadas (que fogem gritando quando começa tiroteio).
2. Implementar a **Polícia / BOPE** patrulhando a cidade e a habilidade de **Rádio do Comandante Caveira** (recrutar policiais próximos para te seguirem atirando).
3. Implementar as **3 Facções Inimigas** nos seus territórios:
   * 🔴 **`CV` (Comando Vermelho):** Motoqueiros, soldados de fuzil, picapes armadas e artilheiros de RPG no Leste/Industrial.
   * 🔵 **`PCC` (Primeiro Comando):** SUVs blindadas pretas, soldados de balaclava, especialistas de C4 e helicópteros.
   * 🟣 **`A.R.E.S.` (Cyber-Mercenários):** Exoesqueletos laser, drones voadores e **Mechas Gigantes (*Big-Fig*)**.
4. **IA de Guerra entre Facções:** Quando membros do `CV`, `PCC` e `A.R.E.S.` se encontram nas fronteiras dos bairros, eles **brigam e atiram uns nos outros automaticamente**, criando batalhas de rua caóticas que o jogador pode separar e derrotar!

### ✅ Resultado para ir para a próxima parte:
* A cidade está viva com carros e pedestres; ao ir para o Distrito Industrial/Porto ou fronteiras do Centro, o jogador vê o **CV**, o **PCC**, a **A.R.E.S.** e a **Polícia** trocando tiros entre si e pode entrar no meio da guerra com qualquer um dos 8 heróis.

---

## 🔹 PASSO 8: Os 3 Chefões Jogáveis & Grandes Eventos (`Mega Assalto ao Super Banco`, `Carro-Forte` e `Prisão`)

### 🛠️ O que fazer:
1. Implementar os **3 Chefões das Facções** nos QGs/Eventos (que viram personagens jogáveis na sua Grade quando derrotados!):
   * **Barão Vermelho (Chefe do CV)**;
   * **Mestre do Cofre (Chefe do PCC)**;
   * **General Overlord (Chefe Mecha *Big-Fig* da A.R.E.S.)**.
2. Implementar os **Eventos Dinâmicos de Mundo Aberto** (com alerta na tela e ícone no minimapa):
   * **🏦 Mega Assalto ao Super Banco Central:** Uma facção invade o interior do Banco, planta explosivos na **Porta do Cofre** e tenta fugir com o ouro; impedir o assalto rende chuva de **Studs Roxos** e **Bloco Dourado**.
   * **🚛 Ataque a Carro-Forte:** Comboio blindado sendo perseguido por motos/SUVs das facções nas avenidas.
   * **🚩 Libertação de Território:** Destruir as barricadas da facção no bairro e derrotar o Chefe local.
   * **🚨 Rebelião na Ponte da Ilha da Prisão:** Impedir que uma facção invada a ponte para soltar os comparsas presos (e ver os bandidos que você prendeu trancados nas celas da Prisão!).

### ✅ Resultado para ir para a próxima parte:
* O alarme do **Super Banco Central** toca, o jogador entra no saguão do banco lotado de assaltantes do PCC/CV tentando arrombar o cofre, derrota todo mundo, prende os bandidos na **Ilha da Prisão** e desbloqueia os **3 Chefões** na grade de personagens.

---

## 🔹 PASSO 9: Veículos Dirigíveis/Pilotáveis & Terminais da Cidade

### 🛠️ O que fazer:
1. Permitir apertar `F` para entrar e dirigir qualquer carro ou moto da rua (inclusive tomando carros das facções!).
2. Colocar **Terminais de Chamada de Veículos** nos bairros, no Aeroporto, no Porto e no Aeroporta-Aviões para comprar com *Studs* e pilotar:
   * **Terrestres:** Caveirão do BOPE (blindado com sirene e atropelamento pesado), Viatura Esportiva, Supercarro, Moto Turbo, Carro-Forte e **Tanque Militar** (que atira com o canhão).
   * **Aquáticos:** Lancha Policial Rápida (na Praia e no Porto).
   * **Aéreos:** **Helicóptero Policial / de Ataque** (com mísseis e metralhadora) e **Jato Militar Supersônico**.
3. Conectar o botão especial do **Comandante Caveira** para entregar um **Caveirão** ou **Helicóptero de Apoio** direto na rua onde você estiver.

### ✅ Resultado para ir para a próxima parte:
* O jogador pode chamar um **Caveirão** no meio do tiroteio, pilotar um **Helicóptero de Ataque** ou **Jato** saindo do Aeroporto até o **Aeroporta-Aviões no Céu**, ou andar de **Tanque** e **Lancha** pela ilha.

---

## 🔹 PASSO 10: Polimento Final (`v1.0.0`) — Blocos Dourados, Corridas, Multiplicadores & Painel de Controle

### 🛠️ O que fazer:
1. Espalhar **Puzzles de Blocos Dourados** pelos terraços e regiões (paredes rachadas pro *Titã Blindado*, cofres dourados pro *Solaris*, alvos prateados pro *Vingador de Chumbo*, geradores elétricos pro *Voltaico* e ganchos pro *Sombra Escarlate*).
2. Adicionar **Corridas de Anéis** pela cidade (corridas de voo entre os prédios e corridas de moto/carro nas avenidas).
3. Criar a **Loja de Upgrades Extras (Estilo Blocos Vermelhos LEGO):** Multiplicadores de Studs (`x2`, `x4`, `x8`, `x10`) e **Ímã de Studs**.
4. Criar o **Painel de Controle da Cidade (`P` ou Menu Rápido):**
   * Trocar **Hora do Dia** instantaneamente (Dia Ensolarado, Pôr do Sol Dourado, Noite Iluminada por Neon);
   * Escolher nível de atividade das facções (Cidade Pacífica, Normal ou **Guerra Total**);
   * Botões rápidos para disparar na hora um **Mega Assalto ao Banco**, **Guerra de Facções** ou **Invasão de Mechas**.
5. Adicionar efeitos sonoros sintetizados (Web Audio API: barulho clássico de Studs coletados, peças quebrando, explosões, sirenes, tiros, jatos de voo e trovões) e salvamento automático no `localStorage`.

### ✅ Resultado Final (`v1.0.0`):
* Jogo completo, salvo automaticamente, com os **11 personagens**, **10 regiões do mapa**, **Super Banco Central com cofre**, **3 facções brigando entre si**, **veículos terrestres/aéreos/aquáticos**, **puzzles de Blocos Dourados** e **Painel de Controle da Cidade**.

