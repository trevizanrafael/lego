# 🎯 Manual de Identidade Visual (`IDV.md`) — LEGO: Cidade de Deus

Este documento define o **Design System e Identidade Visual (IDV)** oficial de **LEGO: Cidade de Deus**. Todas as interfaces (HUD, Minimapa, Grade de Heróis, Alertas de Facções, Terminais de Veículos e Menus) dos Passos 1 a 10 **devem seguir rigorosamente estas regras**.

---

## 🚫 1. O Que é PROIBIDO (Anti-Clichês de IA)

Para garantir cara de **jogo AAA real (Valorant / GTA / Tropa de Elite + LEGO)** e eliminar qualquer aparência de "dashboard gerado por IA":
1. **PROIBIDO `border-radius: 999px` (Pílulas redondas):** Nenhum elemento de UI pode ser uma pílula ovalada de site web.
2. **PROIBIDO Glassmorphism genérico (`backdrop-filter: blur` com fundo azulado translúcido):** Use superfícies sólidas ou quase opacas em **Preto Asfalto (`#0a0b0e`)** e **Carbono Tático (`#13161f`)** com contraste seco.
3. **PROIBIDO sombras esfumaçadas suaves (`box-shadow: 0 10px 30px rgba(...)`):** Use sombras duras geométricas (`4px 4px 0px #000000`) ou filetes técnicos de `1px` / `2px`.
4. **PROIBIDO poluição visual na tela:** Durante o gameplay, a tela deve ser **limpa**. Atalhos de teclado extensos ficam ocultos por padrão e só aparecem ao pressionar **`[H]`**.

---

## 🎨 2. Paleta de Cores Oficial (Alto Contraste Tático Urbano)

| Token CSS | Hex | Uso na Interface |
| :--- | :---: | :--- |
| `--idv-black` | `#090a0d` | Preto Asfalto Profundo (Fundos principais e contornos secos) |
| `--idv-carbon` | `#12151c` | Cinza Carbono Tático (Superfícies internas de painéis) |
| `--idv-steel` | `#262b38` | Cinza Aço (Divisórias técnicas, linhas de grade e slots vazios) |
| `--idv-alert` | `#facc15` | **Amarelo Alerta / LEGO** (Cor primária de destaque, bordas ativas e True Hero) |
| `--idv-amber` | `#f59e0b` | Âmbar Solar (Destaques secundários e energia do Solaris) |
| `--idv-crimson` | `#ef4444` | Vermelho Operacional (Corações LEGO de vida e alertas de crime/CV) |
| `--idv-white` | `#f8fafc` | Branco Puro Tático (Tipografia principal e números de Studs) |
| `--idv-muted` | `#94a3b8` | Cinza Técnico (Rótulos secundários, coordenadas e códigos `[OP-01]`) |

---

## 🔤 3. Tipografia Oficial

Importada via Google Fonts em `index.html`:
* **Títulos, Nomes de Heróis e Contador de Studs:** `'Teko'` / `'Chakra Petch'` (Caixa alta, condensada, forte, com `letter-spacing: 0.06em` e sombra dura `2px 2px 0 #000`).
* **Dados Técnicos, Teclas, FPS e Coordenadas:** `'Chakra Petch'` / `'JetBrains Mono'` (`font-variant-numeric: tabular-nums`).

---

## 📐 4. Geometria Angular & Chanfros em 45°

Todos os contêineres da UI utilizam **cortes angulares em 45° (`clip-path`)** ou **paralelogramos inclinados (`skewX(-16deg)`)**:

* **Corte Tático Padrão (Chanfro Diagonal):**
  ```css
  clip-path: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
  ```
* **Segmentos de Barra (Paralelogramos de Munição/Progresso):**
  * Blocos inclinados em `transform: skewX(-18deg)` com espaçamento seco de `4px`.

---

## 🖥️ 5. Arquitetura da HUD (Tela Limpa de Jogo Real)

1. **Canto Superior Esquerdo — Bloco do Operador (HUD LEGO Tática):**
   * **Retrato em Moldura Octogonal Chanfrada (`72x72px`)** com borda dupla Amarelo Alerta (`#facc15`) e tag tática (`OP-01 // BOPE` ou `OP-02 // SOLAR`).
   * **4 Corações de LEGO Facetados** logo ao lado do retrato.
   * **Contador de Studs Solto na Tela:** Moeda LEGO facetada + número grande em fonte tática com contorno preto sólido (sem caixa de fundo prendendo o número).
2. **Topo Central — Régua Compacta *True Hero*:**
   * 10 blocos paralelogramos finos (`skewX(-18deg)`) + percentual técnico ao lado.
3. **Centro da Tela — Mira Tática (Estilo Valorant / Fortnite):**
   * Ponto central de `4px` + 4 hastes finas de precisão com contorno preto seco de `1px` para leitura perfeita contra qualquer cor de prédio ou céu.
4. **Canto Inferior Esquerdo/Direito — Micro-Indicadores & Menu `[H]`:**
   * Apenas duas micro-etiquetas angulares discretas no canto inferior: `[TAB] TROCAR HERÓI` e `[H] COMANDOS`.
   * Pressionar **`H`** abre/fecha o quadro tático de comandos.

