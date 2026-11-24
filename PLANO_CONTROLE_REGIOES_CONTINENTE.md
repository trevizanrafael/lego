# 🎮 Plano Mestre — Controle, Revisão das Regiões & Expansão Continental

Plano de trabalho da branch `claude/inspiring-johnson-347y9o`. Segue as regras do `AGENTS.md`: **uma fase/etapa por vez**, e cada etapa só avança depois que o usuário testa na tela e aprova.

## 🔁 Protocolo de Trabalho (vale para todas as fases)

1. O usuário envia o pedido (prompt) da etapa.
2. A IA faz a alteração, roda `npm test`, faz um commit atômico e dá push na branch.
3. A IA responde com o que mudou, onde testar (coordenadas/região, teclas/botões) e o que ainda ficou pendente.
4. O usuário testa via Pull Request/branch e responde **"aprovado, próxima"** ou lista os ajustes.
5. Só depois da aprovação a IA passa para a próxima etapa.

---

## 🎮 FASE 1 — Suporte Completo a Controle (Gamepad)

**Objetivo:** jogar o jogo inteiro só com o controle (Xbox, PlayStation ou genérico via Gamepad API do navegador, layout `standard`), com a mesma sensação do GTA.

### 1.1 Mapeamento oficial (revisão 2, definida pelo usuário)

| Ação | Teclado | Xbox | PlayStation |
| --- | --- | --- | --- |
| Andar (360° analógico) | `WASD` | Analógico esquerdo | Analógico esquerdo |
| Correr | `Shift` | Clicar `L3` andando (dura até soltar o analógico) | `L3` |
| Câmera | Mouse | Analógico direito | Analógico direito |
| Pular / Subir no voo | `Espaço` | `A` | `✕` |
| Habilidade 1 / 2 | `Q` / `E` | `X` / `B` | `□` / `○` |
| Grade de Personagens | `Tab` | `Y` | `△` |
| Rádio (analógico escolhe, `A` confirma) | `Z` | `LB` | `L1` |
| Entrar/sair de veículo, interagir | `F` | `RB` | `R1` |
| Atirar / Mirar (+ mira assistida) | Clique esq. / dir. | `RT` / `LT` | `R2` / `L2` |
| Recarregar | `R` | D-pad `↓` | D-pad `↓` |
| Poder extra / Ficha do herói | `G` / `H` | D-pad `↑` toque / segurar | idem |
| Operador 1 / Operador 2 | `1` / `2` | D-pad `←` / `→` | D-pad `←` / `→` |
| Agachar / Rolamento / Descer no voo | `Ctrl` / `C` | `R3` | `R3` |
| Mapa | `M` | `☰` (Menu) | `Options` |
| Pausa (ESC) | `Esc` | `⧉` (View) | `Share` |

**Carros, motos e barcos:** `RT` acelera, `LT` freia/ré, analógico esq. esterça, `A` segurado = **drift**, `X` turbo, `B` atira, `R3` pulo hidráulico, `RB` sai, `LB` rádio.
**Helicópteros e aviões:** `RT`/`LT` potência, `A` sobe, `B` desce, `R3` atira, `RB` sai.
**Menus:** direcional ou analógico navega, `A` confirma, `B` volta, `LB`/`RB` trocam abas, `Y` fecha a Grade, `⧉` fecha a pausa.
**Oficinas, Hangar, Laboratório OP-09, Mapa e Rádio TikTok:** cursor virtual (analógico move, `A` clica, `B` fecha).
**Prompts na tela:** com o controle em uso, todo `[F]`, `<kbd>Q</kbd>`, chip `M1` e dica `ENTER/ESC` vira o botão equivalente (Xbox/PS); volta ao teclado ao usar teclado/mouse.

### 1.2 Entregas técnicas
- Novo submódulo `src/controls/player/GamepadInput.js` (Gamepad API, *polling* por frame, zona morta radial, curva de resposta) alimentando o mesmo `this.keys`/`yaw`/`pitch` que o teclado usa, sem duplicar a lógica de gameplay.
- Troca automática de dispositivo: os ícones de botão da HUD (prompts `[F] Entrar` etc.) mudam para Xbox/PS conforme o último dispositivo usado.
- Navegação de **todos os menus** pelo controle (título, pausa, loja de personagens, grade `Tab`, roda de rádio, oficinas, laboratório OP-09, mapa).
- Mira assistida leve (opcional, desligável) e vibração (*rumble*) em tiros/explosões quando o navegador suportar.
- Opções no menu de pausa: sensibilidade da câmera X/Y, inverter Y, zona morta e mira assistida ligada/desligada.
- Testes automatizados do mapeamento e da zona morta em `tests/`.

---

## 🏙️ FASE 2 — Revisão Região por Região (Correção Pós-Overhaul)

O overhaul (M4–M9) deixou a cidade mais orgânica, mas alguns elementos se perderam. **Uma região por etapa**, com o protocolo acima.

### 2.1 Problemas relatados pelo usuário
- **Colisões invisíveis em todo o mapa:** não dá para passar entre prédios de um quarteirão nem entre casas. Colisores maiores que a malha visual ou colisores de lotes/quarteirões inteiros.
- **Centro:** prédios apagados, sem textura ou com material quebrado.
- **Metrô:** sumiu ou se desconectou (estações e linha). A malha ferroviária de superfície ficou boa e deve ser mantida.
- **Praia:** a *skyline* da orla ficou com prédios muito espaçados; o objetivo é uma muralha densa de prédios que tape a visão da cidade a partir da areia.
- **Favela CDD:** casas soltas e separadas, sem becos, vielas e escadarias de verdade, e o miolo desconectado das ruas. Deve voltar a ser uma favela densa e contínua (como era antes), mantendo o que melhorou no overhaul.

### 2.1.1 Resultado da Etapa 2.0 (diagnóstico global)
Ferramenta: `node tools/audit/ghost-colliders.mjs` (mapa de altura da geometria visível × colisores; `--debug x z` desenha a vizinhança em ASCII).

- **Causa principal das barreiras invisíveis:** a física a pé, dos carros, dos barcos e da câmera testava o **AABB** de todo colisor. Prédios e casas girados no overhaul (OBB) e cilindros bloqueavam o retângulo alinhado que os envolve, fechando becos e vãos. Área extra bloqueada: Centro ~1,41 km², Praia ~0,95 km², Favela ~0,74 km², Subúrbio ~0,23 km², Torre ~26 mil m². **Corrigido** com teste exato da forma (`circleOverlapsColliderXZ`).
- **Prédios sem textura / apagados:** o LOD do M9 unificava as famílias de fachada no material dominante (prédio com textura errada de perto), e chunks com <9 prédios viravam silhueta escura a 185 m. **Corrigido:** o L0 mantém todas as famílias, o L1 mantém até 3, e todo chunk ganha o L1.
- **Barreiras menores corrigidas:** frente da garagem das casas de 2 andares e chafarizes das pracinhas.
- **Pendentes para as etapas por região:** ilhas das rotatórias (cilindros sólidos de 26–28 m sobre grama baixa), blocos da Ilha da Prisão e caixas elevadas do Aeroporto.

### 2.2 Ordem das etapas
| Etapa | Região | Foco principal |
| --- | --- | --- |
| 2.0 | Global | Diagnóstico de colisão (overlay de colisores), correção da origem comum dos colisores fantasmas e auditoria de materiais/texturas |
| 2.1 | Centro (Financeiro, Times Square, Torre dos Heróis, Super Banco) | Prédios sem textura, colisão entre prédios, fachadas |
| 2.2 | Parque Central & Lago | Conferir caminhos, pontes e colisões |
| 2.3 | Metrô (linha circular + 5 estações) | Restaurar linha, estações, trens e embarque |
| 2.4 | Praia & Calçadão (Sul) | Skyline densa contínua na orla, píer e roda-gigante |
| 2.5 | Favela CDD | Densidade, becos, vielas, escadarias, ligação com as ruas e colisão das casas |
| 2.6 | Subúrbio (Norte) | Casas, quintais, cercas quebráveis, posto de gasolina e colisões |
| 2.7 | Distrito Industrial & Porto (Leste) | QGs do CV/PCC, becos, contêineres e guindastes |
| 2.8 | Aeroporto & Base Militar (Oeste) | Pista, hangares e veículos |
| 2.9 | Ilha da Prisão + Ponte Blindada | Muralhas, celas e ponte |
| 2.10 | Aeroporta-Aviões (céu) | Acesso, convés e turbinas |
| 2.11 | Periferia/Pangeia | Transições entre regiões, bordas e oceano |

**Critério de aprovação de cada região:** visual completo (sem prédios apagados), andar livremente nas calçadas, becos e vãos visíveis, sem barreiras invisíveis, 60 FPS mantidos e `npm test` verde.

---

## 🧭 FASE 3 — Entrevista & Novas Regiões Vizinhas

1. **Entrevista com o usuário** (perguntas uma a uma) para definir o **sentido de cada região**: tema, facção dominante, atividades, marcos, clima e trilha.
2. Registrar as respostas em um documento de especificação antes de programar (regra do `AGENTS.md`: nada no escuro).
3. Construir as **regiões novas próximas** à ilha atual, uma por etapa, com o mesmo protocolo de aprovação.

---

## 🗺️ FASE 4 — Expansão Continental (Estilo GTA)

**Visão:** a metrópole atual fica no sul do mapa. Ao norte, um **continente** ligado por **rodovia** de verdade leva a uma **segunda cidade** com identidade própria.

- Rodovia/estrada longa (pistas duplas, acostamento, viadutos, túneis, postos e placas) do norte da ilha até o continente.
- Relevo natural: **serras e montanhas**, vales, florestas, rios e mirantes.
- **Segunda cidade** ao norte com outro sentido/tema (definido na entrevista da Fase 3).
- *Streaming*/LOD por zona para manter 60 FPS com o mapa muito maior (chunks carregados por distância, mesmo padrão do LOD de distritos do M9).
- Atualizar o minimapa, o mapa completo (`M`), o trânsito, a polícia (grafo de vias) e a guerra de facções para o novo território.

> As decisões de geografia da Fase 4 (tamanho, posição da segunda cidade, tipo de relevo) serão confirmadas com o usuário antes de qualquer código.

---

## ✅ Status

| Fase | Status |
| --- | --- |
| 0 — Plano (este documento) | ✅ Commitado |
| 1 — Controle | ✅ Aprovado (PR #15) + ajuste de drift |
| 2 — Regiões | 🧪 Etapa 2.0 (global) implementada, aguardando teste |
| 3 — Entrevista & novas regiões | ⏸️ |
| 4 — Continente | ⏸️ |
