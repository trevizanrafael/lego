# 🤖 Diretrizes da IA para o Projeto LEGO Heróis & Guerra Urbana (`AGENTS.md`)

Este arquivo contém **todo o contexto, regras de negócio, decisões de design e padrões técnicos** que a IA deve seguir rigorosamente ao desenvolver este jogo. **Leia este documento inteiro antes de escrever qualquer linha de código.**

---

## 🚨 1. Regras de Ouro de Comunicação com o Usuário

1. **NUNCA invente mudanças de escopo ou mude o layout do mapa/personagens no escuro:**
   * Se algum detalhe visual, posição de prédio, mecânica de poder ou comportamento de facção tiver mais de uma interpretação possível, **pergunte ao usuário antes de programar**.
2. **Desenvolvimento Passo a Passo Validado:**
   * Siga rigorosamente a ordem do arquivo `PASSO_A_PASSO.md`.
   * Ao concluir um passo, **pare e peça para o usuário testar o resultado na tela**. Só avance para o próximo passo quando o usuário aprovar o passo atual.
3. **Sem Modo História Linear e Sem Editor Manual de Mapa:**
   * O usuário **não quer** modo história com fases trancadas/cutscenes longas. O jogo é **100% Mundo Aberto**.
   * O usuário **não quer** ter que construir o mapa manualmente num editor in-game: o mapa de **10 Regiões** deve vir **100% pronto, montado e detalhado pelo código**, seguindo exatamente a geografia definida neste documento.

---

## 🛠️ 2. Stack Tecnológica & Padrões Visuais

* **Identidade Visual (IDV Oficial):** Todas as telas, HUD, minimapa, menus e alertas devem seguir rigorosamente o documento **`IDV.md`** (Estética **Tático Urbano Angular** estilo GTA / Valorant / BOPE: cortes chanfrados em 45° via `clip-path`, alto contraste Preto Asfalto `#090a0d` + Amarelo Alerta `#facc15`, fontes `Teko` / `Chakra Petch` / `JetBrains Mono`, sombras duras geométricas, tela limpa sem poluição visual e **zero glassmorphism/pílulas redondas de IA**).
* **Tecnologia:** **Three.js (WebGL 3D em JavaScript ES6 Modules + HTML5/CSS3)** sem dependência de engines pesadas externas (sem Unity/Godot/Blender).
* **Execução:** Deve rodar direto no navegador (via Vite ou servidor HTTP local simples) a **60 FPS constantes**, em tela cheia (`100vw x 100vh`), com `PointerLockControls` ou câmera orbital suave em 3ª pessoa controlada pelo mouse.
* **Estética LEGO 3D Obrigatória:**
  * **Materiais (`MeshPhysicalMaterial` / `MeshStandardMaterial`):** Aparência de plástico ABS brilhante (`roughness: 0.25`, `clearcoat: 0.4`), cores vibrantes e sombras projetadas (`castShadow` / `receiveShadow`).
  * **Pinos de LEGO (Studs):** Topo das cabeças dos bonecos, telhados, calçadas e objetos destrutíveis devem exibir os clássicos pinos cilíndricos de LEGO.
  * **Minifiguras 3D Articuladas:** Cabeça cilíndrica amarela/customizada com pino superior, tronco trapezoidal, braços e pernas articulados que balançam ao andar/correr/voar, capas, capacetes e armas 3D nas mãos.
  * **Big-Figs 3D:** Personagens gigantes (**Titã Blindado**, **Vórtex em forma monstruosa** e **General Overlord**) possuem o dobro do tamanho e largura de uma minifigura comum, ombros largos, punhos colossais e animação de peso que treme a câmera ao pousar.
  * **Destruição Física Satisfatória:** Quando qualquer objeto quebrável do cenário (carro, hidrante, poste, banca, barricada, caixa) chega a 0 de vida, ele **desmonta em pecinhas 3D coloridas que quicam no chão** e espalha **Studs (moedinhas cilíndricas brilhantes)** que giram e são puxadas para o jogador.

---

## 🗺️ 3. Especificação Exata do Mapa (As 10 Regiões Fixas)

O mundo é uma **Grande Ilha Metropolitana** cercada pelo oceano, mais a **Ilha da Prisão** (conectada por ponte) e o **Aeroporta-Aviões no Céu**.

### Regra de Interiores:
* **APENAS UM PRÉDIO TEM INTERIOR ABERTO:** O **Super Banco Central** (no Centro Financeiro). Todos os outros prédios do jogo são maciços por fora com fachadas 3D detalhadas e **terraços acessíveis no topo** (com helipontos, caixas d'água, geradores e recompensas).
* O **Super Banco Central** deve ser grande, imponente e **100% aberto sem tela de loading**: portas duplas na frente, grande saguão de mármore com pilastras destrutíveis, balcões de atendimento, sistema de alarme vermelho e, no fundo, a **Porta Circular Gigante do Cofre** guardando pilhas de barras de ouro e *studs* roxos/azuis.

### Coordenadas e Layout das 10 Regiões:
1. **CENTRO — Coração da Metrópole:**
   * **Centro Financeiro & Times Square:** Avenidas largas, arranha-céus espelhados, painéis luminosos e o **Super Banco Central**.
   * **Complexo da Torre dos Heróis:** O arranha-céu mais alto do mapa, com heliponto no topo, plataforma de salto e terminal principal.
   * **Parque Central & Lago:** Área verde central cercada pelos prédios, com árvores de LEGO, pontes, quiosques e lago.
2. **NORTE — Bairro Residencial / Subúrbio:**
   * Casas coloridas com quintal e cercas quebráveis, praça, pizzaria/lanchonete e um **Posto de Gasolina** (bombas explodem em reação em cadeia quando baleadas).
3. **SUL — Praia & Calçadão Turístico:**
   * Faixa larga de areia amarela, coqueiros, guarda-sóis, quiosques, píer de madeira com **Roda-Gigante giratória** e lanchas na água.
4. **LESTE — Submundo Industrial & Porto (Domínio das Facções):**
   * **Distrito Industrial & Becos:** Fábrica abandonada, ferro-velho e quarteirões com barricadas onde **CV** e **PCC** têm seus QGs e trocam tiros.
   * **Porto & Ponte Suspensa:** Guindastes amarelos gigantes, pilhas de contêineres coloridos de LEGO e galpões.
5. **OESTE — Aeroporto & Base Militar Terrestre:**
   * Pista de pouso asfaltada com luzes, torre de controle e hangares abertos com jatos, helicópteros de ataque e tanques.
6. **SUDESTE (Fora da Ilha Principal) — Ilha da Prisão de Segurança Máxima:**
   * Ilha murada ligada ao Leste/Sul por uma **Ponte Blindada**. Possui torres de vigia e celas onde os bandidos derrotados aparecem presos.
7. **NO CÉU (Acima do Centro, `Y` elevado) — Aeroporta-Aviões:**
   * Base voadora monumental sustentada por 4 turbinas gigantes, acessível voando com heróis aéreos ou de jato/helicóptero.

---

## 💥 4. Especificação das Facções, Polícia & Eventos

* **Modo Solo (1 Herói por Vez):** O jogador anda sozinho (sem parceiro IA grudado), mas pode trocar de herói a qualquer momento na **Grade/Roda (`Tab` / `U`)**.
* **Os 4 Grupos Armados na Cidade:**
  1. **Polícia / BOPE (Aliados):** Viaturas e policiais que patrulham a cidade, atiram nas 3 facções e podem ser recrutados pelo **Comandante Caveira**.
  2. **Facção 1 — `CV` (Comando Vermelho):** Visual vermelho/preto/camuflado; usam motos, fuzis, picapes e bazucas RPG; dominam barricadas e atacam carros-fortes.
  3. **Facção 2 — `PCC` (Primeiro Comando):** Visual preto/azul-escuro/balaclavas; usam SUVs blindadas, C4 e helicópteros; especialistas em assaltar o **Super Banco Central** e atacar a **Ponte da Prisão**.
  4. **Facção 3 — `A.R.E.S.` (Cyber-Mercenários):** Visual cinza metálico e roxo-neon; usam exoesqueletos, armas laser, drones voadores e **Mechas Gigantes (*Big-Fig*)**.
* **Guerra entre Facções (Regra Essencial):**
  * A IA das facções deve atacar **tanto o jogador/polícia quanto membros das facções rivais**. Quando grupos do `CV`, `PCC` e `A.R.E.S.` se encontram nas fronteiras dos bairros, eles travam tiroteios e batalhas de rua entre si até o jogador intervir.

---

## 🦸‍♂️ 5. Especificação dos 11 Personagens Jogáveis

### Dupla Inicial Desbloqueada:
1. **Comandante Caveira (BOPE):** Fuzil Tático, Granada Flashbang/Explosiva, rolamento tático, recruta policiais e **chama Caveirão ou Helicóptero Policial** com 1 botão.
2. **Solaris (Guerreiro Solar / Fogo):** Voo supersônico de cometa, hover, Bolas de Fogo, **Raio Solar Contínuo** (derrete objetos/portas de Ouro LEGO) e explosão **Supernova**.

### 6 Heróis Desbloqueáveis (Com Studs e Blocos Dourados):
3. **Titã Blindado (Mecha-Policial *Big-Fig*):** Superpulo pesado, **Soco Foguete** (quebra paredes rachadas), terremoto de escudo, metralhadora e agarrar/arremessar carros.
4. **Vingador de Chumbo (Justiceiro Pesado):** Troca entre **Duas Submetralhadoras**, **Escopeta de Impacto** (repulsão) e **Bazuca RPG** (destrói objetos prateados, blindados e helicópteros).
5. **Sombra Escarlate (Ninja de Gancho):** **Balança pelos prédios** com Gancho Magnético, puxa armas/escudos dos inimigos, Katanas energizadas e Bomba de Fumaça (invisibilidade).
6. **Turbo Fantasma (Motociclista Turbo):** **Invoca Moto Energética instantânea**, deixa parede de luz ciano que capota carros inimigos e ataca com correntes giratórias.
7. **Voltaico (Senhor da Tempestade):** **Teleporta por postes de luz**, dispara raios em cadeia (*Chain Lightning*), carrega geradores elétricos e solta pulso EMP.
8. **Vórtex (Colosso Simbionte):** **Alterna com `F` entre tamanho normal ágil e tamanho *Big-Fig* monstruoso**, usa tentáculos em área e puxa helicópteros do céu.

### 3 Chefões Secretos (Liberados ao derrotá-los):
9. **Barão Vermelho (Chefe do CV)**
10. **Mestre do Cofre (Chefe do PCC)**
11. **General Overlord (Chefe Mecha *Big-Fig* da A.R.E.S.)**

