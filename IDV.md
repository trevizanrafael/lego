# 🦇 Manual de Identidade Visual (`IDV.md`) — AAA Frameless Dark UI (GTA × Arkham × Valorant)

Este documento define o **Design System e Identidade Visual (IDV)** oficial de **Cidade de Deus — Mundo Aberto Sombrio**. Todas as telas seguem a filosofia **AAA Frameless Game UI** (*Batman: Arkham Knight*, *GTA IV/V*, *Valorant* e *Call of Duty: Modern Warfare*), eliminando caixotes de dashboard web.

---

## 🚫 1. Regras Anti-"AI Slop" & Anti-Dashboard Web

1. **PROIBIDO "Caixa dentro de Caixa" (*Tailwind Card Syndrome*):**
   * Na HUD in-game e no Menu Inicial, elementos **não ficam trancados dentro de retângulos fechados de 4 lados** com `padding` e `box-shadow` pesada.
   * Logos, listas do menu inicial, barra de vida, dinheiro, estrelas de procurado, atalhos e velocímetro flutuam **100% Frameless** sobre a cena, ancorados por contraste tipográfico e `text-shadow` / `drop-shadow` nítido.
2. **PROIBIDO Grids `3x1` de Planos SaaS e Popups Web Centralizados:**
   * Seleção de facção usa **Estandartes Verticais Full-Height estilo Valorant** que expandem no hover (`flex-grow`).
   * Slots de save usam **Fitas Horizontais de Dossiê** separadas apenas por fios capilares de `1px`.
   * Loading, Mapa `[M]`, Dossiê `[H]` e Pausa `[ESC]` usam **Telas Full-Bleed (`100vw × 100vh`)** assimétricas sem janela quadrada flutuando no meio.
3. **PROIBIDO `border-radius: 999px`, Glassmorphism genérico e Amarelo Brinquedo (`#facc15`):**
   * Zero pílulas redondas e zero pinos/studs infantis na UI.

---

## 🎨 2. Paleta Sombria & Acabamento

* **Abissais:** `#010103` (Breu Tempestade), `#04060a` (Obsidiana), `#080b12` (Asfalto Noturno), `#0d121d` (Aço Escuro).
* **Fios Capilares (`1px`):** `rgba(255, 255, 255, 0.08)` a `rgba(255, 255, 255, 0.16)` com fade-out em gradiente.
* **Acentos Cirúrgicos:** Carmesim Arterial `#dc2626` / `#991b1b`, Aço Glacial `#7dd3fc` / `#38bdf8`, Bronze Oxidado `#c28e2b` / `#d99b16`, Branco Puro `#f8fafc`.
* **Tipografia:** `Teko` (Display monumental condensado), `Chakra Petch` (Tático), `JetBrains Mono` (Telemetria tabular).
