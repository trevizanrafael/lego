# 🧱 Documento Mestre de Design: LEGO Heróis & Guerra Urbana (Mundo Aberto 3D)

Este documento define toda a arquitetura visual, mecânica, geográfica e o plano de desenvolvimento por fases do nosso jogo **3D em Mundo Aberto estilo LEGO**, construído sob medida a partir das nossas decisões de design.

---

## 🎯 1. Conceito Central & Tecnologia

* **Foco 100% em Mundo Aberto (Zero Modo História Linear):** Você já cai direto na metrópole viva, sem cutscenes forçadas ou fases trancadas.
* **Mistura Única de Temas:** A escala épica de **Super-Heróis estilo LEGO Marvel** (voo supersônico, *Big-Figs* gigantes, balanço pelos prédios, raios e metamorfose) combinada com **Combate ao Crime Urbano Realista** (**Polícia/BOPE** contra **3 Facções Criminosas** que disputam territórios, assaltam o **Super Banco Central** e brigam entre si nas ruas).
* **Tecnologia (Sem Engine Externa):**
  * **Three.js (WebGL 3D puro em JavaScript/HTML5):** Roda direto em tela cheia a 60 FPS sem precisar instalar Unity, Godot ou Blender.
  * **Estética LEGO 3D Autêntica:** Peças com plástico brilhante reflexivo (`MeshPhysicalMaterial`), bonecos minifigura articulados, *Big-Figs* musculosos, veículos de bloquinhos e objetos de cenário que desmontam em pecinhas físicas e **Studs** (moedinhas) ao quebrar.
  * **Modo Solo Ágil (1 Herói na Tela):** Você controla 1 personagem por vez com câmera em 3ª pessoa livre no mouse (estilo *GTA / Spider-Man*) e pode abrir a **Roda/Grade de Personagens (`Tab` / `U`)** a qualquer instante — até no meio de um salto ou voo — para trocar de corpo na hora.

---

## 🗺️ 2. Geografia Completa do Mapa (100% Feito sob Medida)

O mapa é uma **Grande Ilha Metropolitana** cercada pelo mar, acompanhada pela **Ilha da Prisão** (ligada por ponte) e pelo **Aeroporta-Aviões** flutuando no céu. Todos os prédios têm terraços acessíveis no topo, e **apenas o Super Banco Central possui um interior gigante e aberto** (sem tela de carregamento).

### Detalhamento dos 10 Cenários do Mapa:
1. **💰 Centro Financeiro & O Super Banco Central (Centro):**
   * Arranha-céus espelhados, painéis neon estilo Times Square e trânsito intenso.
   * **O Super Banco Central (Interior Monumental Único):** Você entra pelas portas duplas (ou estourando a fachada de vidro) direto para um saguão imenso de mármore com colunas destrutíveis, balcões de caixas, laseres de segurança e, no fundo, a **Porta Circular Gigante do Cofre**, abarrotada de barras de ouro, caixas-fortes e *studs* azuis/roxos.
2. **🏢 Complexo da Torre dos Heróis (Centro):**
   * O prédio mais alto da ilha, com plataforma de pouso no topo, antena panorâmica e terminal central de veículos e heróis.
3. **🌳 Parque Central & Lago (Centro):**
   * Pulmão verde no meio dos prédios com árvores de LEGO, pontes de pedra, quiosques, lago navegável e arena aberta para lutas contra chefes gigantes.
4. **🏡 Bairro Residencial / Subúrbio (Norte):**
   * Ruas tranquilas com casas coloridas de LEGO, cercas brancas quebráveis, caminhões de entrega, pizzaria/lanchonete e um **Posto de Gasolina** cujas bombas explodem em reação em cadeia.
5. **🏖️ Praia & Calçadão Turístico (Sul):**
   * Calçadão de blocos decorados, coqueiros, guarda-sóis, quiosques, píer de madeira com **Roda-Gigante** e rampa de lanchas no mar.
6. **🏭 Submundo / Distrito Industrial & Becos (Leste):**
   * Fábrica abandonada, chaminés, ferro-velho com prensa de carros e becos dominados por barricadas do **CV** e do **PCC**, onde acontecem os maiores tiroteios entre facções.
7. **🚢 Porto & Ponte Suspensa (Leste):**
   * Doca de carga com guindastes amarelos gigantes, labirinto de contêineres empilhados, galpões de contrabando e a grande ponte.
8. **✈️ Aeroporto & Base Militar Terrestre (Oeste):**
   * Pista longa asfaltada com luzes de sinalização, torre de controle e hangares abertos com jatos, helicópteros de ataque e blindados.
9. **🚨 Ilha da Prisão de Segurança Máxima (Sudeste, via Ponte):**
   * Ilha murada isolada no mar, conectada por uma ponte vigiada pela polícia. Quando você derrota bandidos e chefes na cidade, a contagem de presos sobe lá — e as facções tentam invadir a ponte para resgatá-los!
10. **☁️ Aeroporta-Aviões no Céu (Acima do Centro):**
    * Base colossal sustentada por 4 turbinas gigantes nas nuvens, com pista de decolagem, caças estacionados e rampa para saltar lá de cima direto para a cidade.

---

## 💥 3. As 3 Facções Rivais, Polícia & Eventos Dinâmicos

A cidade é um ecossistema vivo onde as facções **se odeiam e entram em guerra entre si** quando se encontram, além de enfrentarem a **Polícia** e você:

| Grupo / Facção | Cores & Visual LEGO | Unidades & Armamento | Comportamento na Cidade |
| :--- | :--- | :--- | :--- |
| **🚓 Polícia & BOPE** *(Aliados)* | Preto e Azul / Farda Tática | Viaturas, Caveirão, Helicóptero Policial, Fuzis e Escudos | Patrulham as ruas, cercam assaltos no Banco e seguem os comandos do **Comandante Caveira**. |
| **🔴 Facção 1: `CV` (Comando Vermelho)** | Vermelho, Preto e Camuflado Urbano | Motoqueiros armados, Soldados de Fuzil, Artilheiros de Bazuca RPG e Picapes com metralhadora | Dominam barricadas no Industrial/Porto, emboscam carros-fortes e trocam tiro pesado com o PCC. |
| **🔵 Facção 2: `PCC` (Primeiro Comando)** | Preto, Azul-Escuro e Ternos/Balaclavas | SUVs Blindadas pretas, Especialistas em Explosivos (C4), Atiradores de Elite e Helicóptero de Fuga | Especialistas em invadir o **Super Banco Central** para explodir o Cofre e atacar a **Ponte da Prisão**. |
| **🟣 Facção 3: `A.R.E.S.` (Cyber-Mercenários)** | Cinza Metálico, Roxo-Neon e Visores Laser | Soldados em Exoesqueleto, Drones Voadores, Torretas Laser e **Mechas Gigantes (Big-Fig)** | Fornecem armas tecnológicas no Porto ou atacam o Centro Financeiro e o Aeroporto com robôs pesados. |

### 🚨 Os 4 Grandes Eventos Ao Vivo no Mundo Aberto:
1. **⚔️ Guerra de Rua entre Facções:** Nas fronteiras entre bairros, comboios do **CV**, **PCC** e **A.R.E.S.** se trombam e começam uma batalha campal (tiros, explosões, carros capotando). Você pode chegar voando ou de Caveirão para prender os dois lados!
2. **🏦 Mega Assalto ao Super Banco Central:** O alarme do Banco dispara; dezenas de membros de uma facção tomam o saguão interno, plantam C4 na porta do cofre e tentam carregar caminhões/helicópteros com ouro. Impedir o assalto dá chuva de **Studs Roxos** e **1 Bloco Dourado**.
3. **🚩 Domínio e Libertação de Territórios:** Bairros do Leste/Porto possuem zonas dominadas com barricadas e bandeiras da facção. Destruir as defesas e derrotar o "Dono da Área" pacifica o quarteirão.
4. **🚛 Ataque a Carro-Forte & Rebelião na Ilha da Prisão:** Escoltar ou salvar carros-fortes perseguidos nas avenidas e impedir que as facções atravessem a ponte para explodir os portões da Prisão.

---

## 🦸‍♂️ 4. Elenco de Personagens Originais (8 Heróis + 3 Chefões)

Você começa o jogo com **2 Heróis liberados** (**Comandante Caveira** e **Solaris**) para já ter tanto a experiência policial tática quanto o voo supersônico desde o primeiro minuto. Os outros **6 Heróis** são desbloqueados com *Studs* e *Blocos Dourados*, e os **3 Chefões das Facções** viram personagens jogáveis quando você os derrota!

### 🌟 Os 8 Heróis Originais:

| # | Nome Sugerido *(ajustável)* | Arquétipo & Visual LEGO | Locomoção (`Espaço` / `Shift`) | Ataque Principal (`Clique Esq.`) & Especial (`Clique Dir.` / `E`) | Interação Única no Mapa |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Comandante Caveira** *(Inicial)* | **Operações Especiais (BOPE):** Farda preta tática, boina, caveira no peito e óculos tático | Corrida tática + Rolamento de esquiva | **Fuzil de Assalto Tático** + **Granada Flashbang/Explosiva**. Especial: **Rádio Comando** (chama o **Caveirão** ou Helicóptero Policial e recruta policiais próximos!). | Abre arsenais policiais e comanda esquadrões da polícia. |
| **2** | **Solaris** *(Inicial)* | **Guerreiro Solar / Fogo:** Armadura Rubra e Dourada com capa/aura flamejante | **Voo Supersônico de Cometa** (rastro de fogo no céu) + Hover no ar | **Bolas de Fogo Explosivas** + **Raio Solar Contínuo**. Especial: **Supernova** (explosão solar em área que derrete blindados). | **Derrete objetos, portas e cofres de Ouro LEGO** com o feixe solar. |
| **3** | **Titã Blindado** | **Mecha-Policial Pesado (*Big-Fig*):** Armadura estilo Hulkbuster da Tropa de Elite em Preto e Dourado | **Superpulo Pesado** (racha o asfalto ao pousar) + Corrida Demolidora | **Soco Foguete** + **Metralhadora de Contenção**. Especial: **Terremoto de Escudo de Choque** + **Agarrar e Arremessar Carros**. | **Quebra Paredes Rachadas** e arranca postes/carros com as mãos. |
| **4** | **Vingador de Chumbo** | **Justiceiro Urbano Pesado:** Sobretudo preto, colete balístico pesado e munição cruzada | Corrida pesada + Salto com tiro em câmera lenta | **Troca de Arsenal (`R`):** 1) Duas Submetralhadoras; 2) Escopeta que joga inimigos longe; 3) **Bazuca RPG** teleguiada contra veículos e helicópteros. | **Explode objetos prateados reforçados** e barricadas blindadas com a RPG. |
| **5** | **Sombra Escarlate** | **Ninja de Gancho Magnético:** Capuz e traje furtivo preto com detalhes vermelho-neon | **Balanço em Gancho Magnético** pelos prédios + Pulo Duplo Acrobático | **Katanas Energizadas** (cortes rápidos). Especial: **Puxão Magnético** (arranca armas/escudos dos bandidos) + **Bomba de Fumaça (Invisibilidade)**. | **Puxa alavancas e ganchos altos** nos prédios e passa por laseres invisível. |
| **6** | **Turbo Fantasma** | **Motociclista Turbo Urbano:** Jaqueta de couro preta com linhas neon ciano e capacete visor | **Invoca Moto Energética instantânea** em qualquer lugar + Turbo em rampas | **Correntes Giratórias** de alcance médio. Especial: **Muralha de Luz Ciano** (rastro da moto que capota e explode carros perseguidores). | Vence **Corridas Urbanas** e salta rampas entre prédios e pontes. |
| **7** | **Voltaico** | **Senhor da Tempestade / Eletricidade:** Traje Azul-Escuro e Prata com arcos voltaicos | **Teleporte Elétrico** instantâneo através de postes de luz e antenas + Levitação elétrica | **Corrente de Raios (Chain Lightning)** que salta entre até 6 bandidos. Especial: **Pulso EMP / Tempestade** (desativa carros, drones e helicópteros na hora). | **Carrega Geradores Elétricos** para abrir portas secretas e telhados. |
| **8** | **Vórtex** | **Colosso Simbionte / Metamorfo:** Traje orgânico negro vivo com olhos brancos | **Transformação Instantânea (`F`)** entre forma Normal Ágil (balança/escala) e **Forma Big-Fig Monstruosa** | **Chicotes de Tentáculos** em área + **Garras Simbiontes**. Especial: **Laço Abissal** (estica os braços para puxar helicópteros do céu pro chão!). | Domina tanto **dutos estreitos** (forma ágil) quanto **força bruta** (forma *Big-Fig*). |

### 👑 Os 3 Chefões Jogáveis (Liberados ao derrotá-los nas Zonas das Facções):
* **9. Barão Vermelho (Chefe Supremo do CV):** Usa **Dois Fuzis Dourados**, Lança-Granadas incendiário e chama 4 motoqueiros do CV como guarda-costas.
* **10. Mestre do Cofre (Estrategista Chefe do PCC):** Usa Metralhadora Giratória Portátil, planta **Bomba C4** que explode qualquer cofre/parede e chama uma SUV Blindada preta.
* **11. General Overlord (Comandante Mecha da A.R.E.S. — *Big-Fig*):** Robô militar gigante com **Canhão de Plasma**, propulsores de voo pesado e invocação de Drones Laser.

---

## 🪙 5. Economia de Studs, Veículos & Progressão

* **Moedinhas LEGO (Studs) com Física e Ímã:**
  * ⚪ **Stud Prata:** `10` pontos
  * 🟡 **Stud Dourado:** `100` pontos
  * 🔵 **Stud Azul:** `1.000` pontos
  * 🟣 **Stud Roxo:** `10.000` pontos
* **Terminais da Cidade (Azul para Terrestres / Amarelo nos Telhados e Aeroporto para Aéreos):**
  * Onde você gasta seus *Studs* para desbloquear e chamar a qualquer momento: **Caveirão do BOPE**, **Viatura Esportiva**, **Supercarro**, **Moto Turbo**, **Carro-Forte**, **Lancha Policial**, **Helicóptero de Ataque**, **Tanque Militar** e **Jato Supersônico**.
* **Upgrades Permanentes (Estilo LEGO Extras):**
  * Multiplicadores de Studs acumulativos (`x2`, `x4`, `x8`, `x10`), **Ímã de Studs**, **Super Destruição** e **Radar de Crimes/Blocos Dourados**.

---

## 🚀 6. Roadmap de Desenvolvimento por Partes (Fases `v0.1` a `v1.0`)

Para construirmos tudo com perfeição e você testar cada parte antes da próxima, dividimos o desenvolvimento em **6 Fases claras**:

### 📦 Fase 1 (`v0.1.0`) — Motor 3D LEGO, Física de Studs & Os 2 Heróis Iniciais
* Criação do projeto 3D em **Three.js** numa pasta dedicada (`lego-world/`).
* Renderizador de **Minifiguras LEGO 3D articuladas** (cabeça, tronco, braços, mãos, pernas e capas/acessórios) com plástico brilhante e sombras.
* Câmera 3ª pessoa no mouse, HUD estilo LEGO (retrato do herói, 4 corações de vida, contador de Studs e barra de *True Hero*).
* **Os 2 Heróis Iniciais completos:** **Comandante Caveira** (tiro tático, granada, rolamento) e **Solaris** (voo 3D livre, hover, bola de fogo e raio solar).
* Quarteirão central inicial com objetos quebráveis (carros, postes, hidrantes, bancas, caixas douradas) explodindo em pecinhas físicas e **Studs Prata/Ouro/Azul/Roxo**.

### 🗺️ Fase 2 (`v0.2.0`) — O Mapa Completo de 10 Regiões & O Super Banco Central
* Construção integral da **Grande Ilha Metropolitana** com as **10 regiões** posicionadas exatamente no layout aprovado:
  * **Centro** (Financeiro + Torre dos Heróis + Parque Central), **Norte** (Subúrbio + Posto Explosivo), **Sul** (Praia + Píer com Roda-Gigante), **Leste** (Industrial/Submundo + Porto), **Oeste** (Aeroporto/Base Militar), **Ilha da Prisão** (com Ponte) e **Aeroporta-Aviões no Céu**.
* Construção do **Interior Monumental do Super Banco Central** (entrada sem loading, saguão, colunas e a Porta Gigante do Cofre).
* Minimapa urbano no canto da tela e Mapa Completo em tela cheia (`M`) mostrando os bairros.

### 🦸‍♂️ Fase 3 (`v0.3.0`) — Os 6 Novos Heróis Originais & Roda/Grade de Seleção
* Implementação dos outros **6 Heróis Originais** com modelos 3D, animações e poderes exclusivos:
  * **Titã Blindado** (*Big-Fig* com superpulo, parede rachada e arremesso de carros);
  * **Vingador de Chumbo** (Submetralhadoras, Escopeta e Bazuca RPG);
  * **Sombra Escarlate** (Balanço em Gancho Magnético pelos prédios, katana e bomba de fumaça);
  * **Turbo Fantasma** (Invocação da Moto Energética + parede de luz);
  * **Voltaico** (Teleporte por postes, raios em cadeia e pulso EMP);
  * **Vórtex** (Transformação em tempo real entre tamanho normal e *Big-Fig* simbionte + tentáculos).
* **Grade de Seleção estilo LEGO (`Tab` / `U`)** para trocar de herói instantaneamente ou comprar os bloqueados com *Studs*.

### 💥 Fase 4 (`v0.4.0`) — Polícia vs. As 3 Facções (`CV`, `PCC` e `A.R.E.S.`) & Guerra de Rua
* IA de pedestres correndo do perigo, trânsito nas avenidas e **Polícia/BOPE** patrulhando.
* Spawns e territórios das **3 Facções (`CV`, `PCC` e `A.R.E.S.`)** com combate automático **Facção vs. Facção** quando grupos rivais se encontram!
* Implementação dos **3 Chefões Jogáveis** (**Barão Vermelho**, **Mestre do Cofre** e **General Overlord**).

### 🚨 Fase 5 (`v0.5.0`) — Grandes Eventos (Assalto ao Super Banco, Carro-Forte & Prisão) + Veículos
* Eventos dinâmicos de **Mega Assalto ao Cofre do Super Banco Central**, **Ataque a Carro-Forte**, **Libertação de Territórios** e **Rebelião na Ponte da Ilha da Prisão** (com presos visíveis nas celas da prisão!).
* **Terminais de Veículos** pela cidade (Caveirão, Superesportivo, Helicóptero de Ataque, Tanque, Lancha e Jato) + habilidade do **Comandante Caveira** de chamar o Caveirão/Helicóptero de apoio.

### 🏆 Fase 6 (`v1.0.0`) — Blocos Dourados, Corridas, Multiplicadores & Painel de Controle da Cidade
* Puzzles de **Blocos Dourados** nos terraços (usando fogo solar, paredes rachadas, geradores elétricos, ganchos e RPG), **Corridas de Anéis** (voo e moto/carro), Loja de Multiplicadores (`x2` a `x10`), efeitos sonoros e **Painel de Controle da Cidade** (clima, hora do dia e botão de invocar invasões).

