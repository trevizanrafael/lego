# 🦇 Manual de Identidade Visual (`IDV.md`) — Gotham Dark Theme (Arkham Tactical Noir)

Este documento define o **Design System e Identidade Visual (IDV)** oficial de **LEGO: Cidade de Deus — Guerra Urbana**. Todas as interfaces (Chassi da HUD, Radar/Minimapa, Mapa Satélite, Roda de Operadores, Alertas de Procurado, Oficinas, Hangar, Rádio e Menus) **devem seguir rigorosamente estas diretrizes**.

---

## 🚫 1. O Que é PROIBIDO (Anti-Clichês de IA & Anti-Visual Infantil)

Para garantir estética **AAA Sombria (Arkham Knight / LEGO DC Super-Villains / Valorant / BOPE Noir)** e eliminar qualquer aparência de dashboard genérico ou brinquedo infantil:
1. **PROIBIDO `border-radius: 999px` (Pílulas redondas):** Nenhum botão, carteira, barra ou indicador pode ser uma pílula ovalada.
2. **PROIBIDO Glassmorphism genérico (`backdrop-filter: blur` translúcido esbranquiçado):** Use placas blindadas sólidas ou quase opacas em **Obsidiana (`#04060a`)**, **Noite Asfalto (`#080b12`)** e **Aço Noturno (`#0d121d`)** com contraste metálico seco.
3. **PROIBIDO amarelo brinquedo (`#facc15`) e pinos/studs de plástico infantil na UI:** Moedas, estrelas de procurado e destaques usam **Bronze/Âmbar de Sódio (`#c28e2b` / `#d99b16`)**, **Carmesim Arterial (`#991b1b` / `#dc2626`)** e **Aço Glacial Batcomputador (`#7dd3fc` / `#38bdf8`)**, com insígnias octogonais e rebites táticos escuros.
4. **PROIBIDO sombras esfumaçadas suaves:** Priorize sombras geométricas pretas duras (`4px 4px 0 #000000`, `6px 6px 0 #000000`) e filetes metálicos cirúrgicos de `1px` a `4px`.
5. **PROIBIDO poluição visual durante o gameplay:** A tela de combate permanece limpa e letal; fichas detalhadas de comandos abrem sob demanda em **`[H]`**.

---

## 🎨 2. Paleta de Cores Oficial (Gotham Dark Theme / Arkham Tactical Noir)

A direção de arte combina **arquitetura gótica brutalista e equipamento tático noturno** — obsidiana profunda, gunmetal escovado, vapor de sódio oxidado, vermelho arterial e telemetria glacial:

### 2.1 Fundos Abissais & Chassis
| Token CSS | Hex | Função na Interface |
| :--- | :---: | :--- |
| `--gotham-obsidian` / `--idv-black` | `#04060a` | **Obsidiana Abissal** — Fundo primário, cavidades de barras e recortes secos |
| `--gotham-asphalt` / `--idv-asphalt` | `#080b12` | **Noite Asfalto** — Base de botões táticos, slots e subpainéis |
| `--gotham-night-steel` / `--idv-carbon` | `#0d121d` | **Aço Noturno** — Superfícies internas de chassis, cards e mostradores |
| `--gotham-gunmetal` / `--idv-gunmetal` | `#141b29` | **Gunmetal Blindado** — Estados ativos, hover metálico e cabeçalhos |

### 2.2 Bordas Metálicas & Estrutura
| Token CSS | Hex | Função na Interface |
| :--- | :---: | :--- |
| `--gotham-border-steel` / `--idv-steel` | `#1e283a` | **Aço Escovado** — Molduras estruturais, grades técnicas e divisórias |
| `--gotham-border-titanium` / `--idv-titanium` | `#2c3a52` | **Titânio Escuro** — Bordas enfatizadas, foco tático e cantoneiras |

### 2.3 Acentos Cirúrgicos Sombrios & Tipografia
| Token CSS | Hex | Função na Interface |
| :--- | :---: | :--- |
| `--gotham-bronze` / `--idv-bronze` | `#c28e2b` | **Bronze Tático / Ouro-Velho** — Filetes nobres, insígnias e estrelas ativas |
| `--gotham-amber` / `--idv-alert` | `#d99b16` | **Âmbar de Sódio** — Destaques operacionais, chaves de comando e alertas |
| `--gotham-crimson-dark` / `--idv-crimson-deep` | `#991b1b` | **Sangue Escuro** — Base da barra de blindagem/HP e alertas severos |
| `--gotham-crimson` / `--idv-crimson` | `#dc2626` | **Carmesim Arterial** — Dano crítico, mira letal, sirene policial e facção CV |
| `--gotham-ice` / `--idv-ice` | `#7dd3fc` | **Aço Glacial** — Telemetria do Batcomputador, frequências e leitura fria |
| `--gotham-bat-cyan` / `--idv-cyan` | `#38bdf8` | **Ciano Tático Frio** — Satélite, propulsão nitro, fuga policial e diagnósticos |
| `--idv-white` | `#dce3ee` | **Branco Frio Metálico** — Títulos e leitura primária sem estourar o brilho |
| `--idv-muted` | `#7a889e` | **Cinza Chumbo** — Subtítulos técnicos, unidades e códigos `[OP-01]` |

---

## 🔤 3. Tipografia Oficial

Importada via Google Fonts em `index.html`:
* **Títulos, Operadores, Velocímetro e Contadores (`--font-display`):** `'Teko'` / `'Chakra Petch'` — Caixa alta condensada, peso `700`, `letter-spacing: 0.05em` e sombra geométrica seca `2px 2px 0 #000000`.
* **Botões, Rótulos Operacionais e Menus (`--font-tactical`):** `'Chakra Petch'` — Peso `600`/`700`, leitura militar nítida.
* **Telemetria, Teclas, Coordenadas e Relógios (`--font-mono`):** `'JetBrains Mono'` — Peso `700`/`800`, `font-variant-numeric: tabular-nums`.

---

## 📐 4. Geometria Angular & Chanfros em 45°

Todos os contêineres, botões, notificações e modais utilizam **cortes chanfrados secos em 45° (`clip-path`)** ou **segmentos inclinados (`skewX(-18deg)`)**:

* **Chassi Chanfrado Padrão:**
  ```css
  clip-path: polygon(
    0 0,
    calc(100% - 14px) 0,
    100% 14px,
    100% 100%,
    12px 100%,
    0 calc(100% - 12px)
  );
  ```
* **Segmentos de Barra (HP, RPM, Progresso e Objetivos):**
  * Paralelogramos inclinados em `transform: skewX(-18deg)` sobre cavidade obsidiana `#04060a` com entalhes escuros secos.

---

## 🖥️ 5. Arquitetura da HUD (Chassi Blindado Gotham)

1. **Canto Superior Esquerdo — Chassi Blindado do Operador (`#lego-classic-hud`):**
   * Placa chanfrada em obsidiana `#04060a` -> `#0a0e17` com borda gunmetal `#1d2638` e filete cirúrgico lateral `--hero-accent`.
   * **Retrato Tático (`78x78px`)** com cantoneiras metálicas afiadas e código `OP-01`.
   * **Barra Dupla de Blindagem/HP** inclinada com *ghost-damage* glacial, preenchimento carmesim arterial (`#991b1b` -> `#dc2626`) e entalhes táticos.
   * **Faixa de Habilidades (`#hud-ability-strip`)** em chips de aço noturno `#0a0e17` + **Insígnia Octogonal Metálica (`#hud-stud-coin`)** em ouro-velho, platina, safira noturna ou ametista.
2. **Canto Superior Direito — Caçada Policial, Arsenal, Rádio & Velocímetro:**
   * **Alerta Policial de Gotham (`#hud-wanted-panel`):** Oculto em `0★`; chassi `#05070c` com barra lateral pulsante vermelho-policial `#dc2626` / azul-giroflex `#2563eb` e 5 estrelas táticas com núcleo metálico escuro.
   * **Silhuetas de Arsenal (`#vingador-weapon-hud`), Rádio Ao Vivo (`#hud-tiktok-radio-pill`) e Velocímetro Digital (`#vehicle-speedometer`)** unificados em obsidiana, gunmetal e bronze/aço glacial.
3. **Centro da Tela — Mira Tática de Precisão (`#crosshair`):**
   * Ponto central em âmbar de sódio `#d99b16` + 4 hastes metálicas `#dce3ee` com contorno preto seco `#04060a`.
4. **Rodapé Tático — Micro-Chips & Radar Sombrio (`#minimap-container`):**
   * Micro-indicadores angulares discretos à esquerda (`[TAB] OPERADOR`, `[Z] RÁDIO`, `[M] MAPA`, `[H] DOSSIÊ`) e radar sombrio chanfrado à direita com coordenadas em tempo real.
