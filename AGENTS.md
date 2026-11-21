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
* **Estética Híbrida Tática Sombria — Opção 2 ("Gotham Trevosa" / Estilo *LEGO DC Super-Villains*):**
  * **Materiais PBR Urbanos Sombrios (`MeshPhysicalMaterial` / `MeshStandardMaterial`):** Fim do plástico infantil brilhante universal e das cores primárias estouradas; concreto áspero e sujo (`roughness: 0.58+`), metal escovado/oxidado, asfalto negro semi-úmido espelhando luzes/neon, paleta dessaturada e *Color Grading Noir* cinematográfico com vinheta e sombras densas.
  * **Geometria Studless e Angular no Mundo:** Carros, blindados, calçadas, prédios, casas e barracos **não usam pinos aparentes de brinquedo (*studless*)** nem formato "caixa de sapato" — priorizar chanfros, para-brisas inclinados, cunhas (*wedges*), vidros fumê escuros e arquitetura *Art-Deco / Brutalista* sombria.
  * **Personagens & Big-Figs Articulados (Mantidos):** Preserva a estrutura e proporção articulada dos bonecos e *Big-Figs* (**Titã Blindado**, **Vórtex em forma monstruosa** e **General Overlord**), integrados à atmosfera pesada.
  * **Clima Padrão Pesado:** Dia nublado/carregado com névoa urbana densa (*smog*) e noite escura e opressiva cortada por vapor de sódio, mercúrio, giroflex, faróis e neon das facções.
  * **Destruição Física Satisfatória:** Quando qualquer objeto quebrável do cenário chega a 0 de vida, ele se estilhaça em fragmentos físicos 3D que quicam no chão e espalha recompensas/espólios brilhantes puxados para o jogador.

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

---

## 🧩 6. Arquitetura Modular & Protocolo de Trabalho Multi-Agente

O código do projeto segue rigorosamente a **Arquitetura de Fachada Fina + Submódulos por Domínio ("Padrão Metro")** para manter arquivos pequenos, legíveis e permitir que **vários agentes trabalhem simultaneamente em paralelo sem conflito**.

### 6.1 Regras de Modularização e Tamanho de Arquivo
1. **Proibido Criar ou Recriar Monólitos:**
   * Nunca concentre milhares de linhas em um único arquivo. A meta para cada submódulo é de **`150 a 450 linhas`** (evitando ultrapassar `~500–600` linhas; se crescer além disso, divida em submódulos menores na mesma pasta).
2. **Padrão Fachada Fina (*Barrel / Orchestrator Facade*):**
   * Arquivos raiz de sistemas (`Minifigure.js`, `ThirdPersonController.js`, `DestructibleManager.js`, `TestBlockWorld.js`, `LegoHud.js`, `LegoMaterials.js`, `VehicleFleetBuilder.js`, builders de regiões, etc.) devem ter apenas **`50 a 210 linhas`**, atuando como ponto de entrada que orquestra e reexporta os submódulos.
   * Quando uma classe grande tiver métodos distribuídos em submódulos, instale-os em `Classe.prototype` preservando `enumerable: false` via `Object.defineProperties` (comportamento idêntico aos métodos nativos ES6) e mantenha um grafo de imports **100% acíclico (DAG)** sem referências circulares.
3. **Sistema de Rádio Ao Vivo Estilo GTA 6 + Rota `/configs`:**
   * No jogo, a rádio opera via **Roda Radial (`[Z]` / `[P]`)** e troca de estações (`[` / `]`), **sem pular músicas manualmente**, com todas as rádios avançando juntas num relógio global (`src/audio/radio/`).
   * Toda a gestão de estações, Drag & Drop de músicas entre rádios e importação **YouTube -> MP3 + Thumbnail** (`yt-dlp` + `ffmpeg` em `server.py`) vive na rota independente **`http://localhost:5173/configs`** (`configs/`).

### 6.2 Mapa Oficial de Pastas por Domínio
Sempre adicione ou edite funcionalidades diretamente no submódulo específico do assunto:
* **Personagens, Soldados & OP-09 (`src/entities/`):**
  * `minifigure/` + `minifigure/outfits/` — Esqueleto base, *Big-Figs*, armas 3D, animações procedurais e 1 arquivo de traje por herói (`CaveiraBopeOutfit.js`, `SolarisSunKingOutfit.js`, `VortexSymbioteOutfit.js`, etc.).
  * `soldiers/` — Esqueleto compartilhado, kits visuais por facção/classe e chefes.
  * `custom-hero/` — Catálogo OP-09, montador 3D, runtime dos 12 poderes e UI do laboratório subterrâneo.
* **Controles, Câmera & Física do Jogador (`src/controls/player/`):**
  * Submódulos independentes para input/eventos, câmera orbital, locomoção a pé/nado, voo/gancho/travessia, combate/poderes, direção de veículos terrestres e pilotagem naval/aérea/brinquedos.
* **Mundo, Regiões, Veículos & Sistemas Urbanos (`src/world/`):**
  * `core/`, `terrain/`, `buildings/`, `props/` — Grid espacial de colisores, consultas de relevo/água, malha da Pangeia, viadutos, gerador de prédios Art-Deco/Brutalistas e props quebráveis.
  * `regions/<regiao>/` — Subpastas isoladas para cada região (`downtown/`, `north-suburb/`, `south-beach/`, `east-port/`, `favela-cdd/`, `west-airport/`, `prison-island/`, `helicarrier/`) + `PangaeaPeripheryBuilder.js`.
  * `metro/` — Linha circular, estações subterrâneas/elevadas, trens e embarque.
  * `vehicles/` & `garages/` — Catálogo e malhas da frota terrestre/naval/aérea + oficinas `street-customs/` e `aircraft-customs/`.
  * `destructibles/` — Registro/culling com histerese, dano/explosões em cadeia, estilhaços/studs, balística e VFX de cada herói.
  * `living-city/`, `factions/`, `police/`, `atmosphere/`, `attractions/` — Trânsito/pedestres instanciados, guerra territorial 1x1, perseguição policial 0★–5★, ciclo dia/noite e Baile/Parque de Diversões.
* **Materiais, Áudio, UI & Estilos (`src/materials/modules/`, `src/audio/`, `src/ui/`, `styles/`):**
  * `src/materials/modules/` — Paleta PBR sombria, shaders de água/superfície e texturas procedurais de rostos/torsos.
  * `src/audio/ambience/` + `src/audio/ambience/regions/` — Primitivas de síntese Dark Ambient e 11 compositores independentes de 10 minutos (`600s`) por bairro, orquestrados por `UrbanAmbienceSoundtrack.js`.
  * `src/ui/hud/`, `src/ui/map/`, `src/ui/minimap/`, `src/ui/wheel-dossier/` — Módulos isolados da interface Dark-Tech.
  * `styles/` — Folhas CSS separadas por domínio (`tokens-and-base.css`, `operator-hud.css`, `wheel-map-dossier.css`, `title-and-menus.css`, `garages-and-lab.css`, `wanted-and-objectives.css`, `aircraft-hangar.css`), importadas em cascata por `style.css` (lembrar de atualizar o cache-bust `?v=...` em `index.html` ao alterar CSS/JS).

### 6.3 Protocolo de Execução com Múltiplos Agentes em Paralelo
Sempre que uma tarefa envolver frentes independentes (ex.: mexer em mais de um herói, região, veículo ou tela ao mesmo tempo), divida o trabalho em **Ondas Paralelas de Subagentes**:
1. **Propriedade Estrita e Disjunta de Arquivos (*Strict File Ownership*):**
   * Cada subagente paralelo deve receber no prompt a **lista exata e exclusiva de arquivos/pastas** que pode ler e editar.
   * **Dois agentes em paralelo NUNCA podem editar o mesmo arquivo.** Se precisarem expor algo na fachada pai, defina o contrato antes ou deixe a atualização da fachada para um único agente/coordenador.
2. **Validação Rápida no Subagente (Sem `git` Concorrente):**
   * Subagentes **são proibidos** de executar `git commit`, `git add`, `git reset` ou `git checkout` por conta própria.
   * Cada subagente valida suas entregas com um **smoke test rápido** (`node --input-type=module -e "..."` ou `node --test tests/<suite-do-dominio>.test.js`, que leva `~0.5s–3s`) antes de reportar conclusão.
3. **Integração, Suíte Completa e Commit Atômico no Coordenador:**
   * Quando todos os subagentes de uma onda terminam, o **agente coordenador** executa `npm test` completo (`94+` testes nas 12 suítes), confere `git status --short` e realiza um **commit atômico da onda** listando caminhos explícitos no `git add` antes de iniciar a próxima onda.


