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

### 1.1 Mapeamento oficial (escolhido pelo usuário)

| Ação | Teclado | Xbox | PlayStation |
| --- | --- | --- | --- |
| Mover (360° analógico) | `WASD` | Analógico esquerdo | Analógico esquerdo |
| Câmera | Mouse | Analógico direito | Analógico direito |
| Correr / voo supersônico | `Shift` | `LB` | `L1` |
| Pular / Subir no voo | `Espaço` | `A` | `✕` |
| Habilidade 1 | `Q` | `X` | `□` |
| Habilidade 2 | `E` | `B` | `○` |
| Grade de Personagens | `Tab` | `Y` | `△` |
| Entrar/sair de veículo, interagir | `F` | `RB` | `R1` |
| Atirar / Ataque | Clique esquerdo | `RT` | `R2` |
| Mirar / Ataque secundário (+ mira assistida) | Clique direito | `LT` | `L2` |
| Recarregar | `R` | D-pad `↓` | D-pad `↓` |
| Poder extra / invocação | `G` | D-pad `↑` | D-pad `↑` |
| Operador 1 / Operador 2 | `1` / `2` | D-pad `←` / `→` | D-pad `←` / `→` |
| Agachar / Rolamento / Descer no voo | `Ctrl` / `C` | `R3` | `R3` |
| Ficha do herói | `H` | `L3` | `L3` |
| Mapa | `M` | `View` (toque) | `Share` (toque) |
| Roda de Rádio | `Z` | Segurar `View` + analógico dir. | Segurar `Share` |
| Trocar estação (roda aberta) | `[` / `]` | D-pad `←` / `→` | D-pad `←` / `→` |
| Pausa | `Esc` | `Menu` | `Options` |

**Carros, motos e barcos:** `RT` acelera, `LT` freia/ré, analógico esq. esterça (analógico), `A` freio (duplo toque = pulo hidráulico), `LB` drift, `X` turbo, `B` atira, `R3` pulo hidráulico, `RB` sai.
**Helicópteros e aviões:** `RT`/`LT` potência, `A` sobe, `B` desce, `R3` atira, `RB` sai.
**Menus:** direcional ou analógico navega, `A` confirma, `B` volta, `LB`/`RB` trocam abas da loja, `Y` fecha a Grade.
**Oficinas, Hangar, Laboratório OP-09, Mapa e Rádio TikTok:** cursor virtual (analógico move, `A` clica, `B` fecha).

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
| 1 — Controle | 🧪 Implementado, aguardando teste do usuário |
| 2 — Regiões | ⏸️ Depois da Fase 1 |
| 3 — Entrevista & novas regiões | ⏸️ |
| 4 — Continente | ⏸️ |
