# PROMPT — Menu de Pausa In-Game no estilo "Lâminas + Card do Herói"

> Cole este arquivo inteiro como prompt para o agente codador.
> Leia `AGENTS.md` e `IDV.md` antes. Este prompt **substitui a seção E** do `PROMPT_REFORMA_MENUS.md`.
> Trabalhe a partir do estado atual do seu checkout (a pausa já foi parcialmente mexida: título "PAUSA", rótulos curtos).

## Referência

O usuário quer a **estrutura** do menu de pausa dos jogos LEGO de super-herói (print de referência):
lista de botões em lâminas inclinadas empilhadas à esquerda, card grande do personagem atual à direita,
contador de studs no topo e linha de progresso no rodapé. Copie a **estrutura e a hierarquia**, não a
arte de quadrinhos. O visual segue a nossa IDV: noir, chanfros de 45° via `clip-path`, Teko / Chakra Petch / JetBrains Mono.

## Como está hoje (print atual) — o que está errado

1. **Configurações e ações empilhadas na mesma tela**: sliders/toggles em cima, numa coluna estreita centralizada; ações embaixo, em linhas de largura total. Duas larguras e dois alinhamentos diferentes na mesma tela.
2. **O indicador vermelho de seleção fica solto na borda esquerda** (x≈280px) e o texto "CONTINUAR" fica centralizado a ~700px de distância dele.
3. **Salto de tipografia**: rótulos de configuração pequenos em Chakra e ações gigantes em Teko, sem nível intermediário.
4. **Cabeçalho torto**: "JOGO PAUSADO / PAUSA" e o botão "[ESC] FECHAR" colados lado a lado no centro, parecendo um formulário.
5. **A HUD continua vazando por trás**: nome do herói, studs (9.420.930), minimapa e atalhos do rodapé aparecem esmaecidos.
6. **Não tem nada do jogador**: nenhum herói, facção, região ou progresso. Parece tela de configuração de site.
7. Ainda sobram `OFF // OCULTO` e `PT-BR // PORTUGUÊS`. "HORÁRIO" é um botão único, sem indicar que alterna.
8. "REINICIAR TERRITÓRIOS" (ação destrutiva) está na lista principal, no mesmo nível de "CONTINUAR".
9. Faltam atalhos que se esperam numa pausa: **Mapa** e **Heróis**.

## Layout alvo (1920×1080; tudo em `vw`/`clamp` para escalar)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▞▞ faixas diagonais na cor da facção (baixa opacidade) + brasão gigante  ▞▞  │
│                    ◉ 9.420.930            CENTRO FINANCEIRO · 22:14           │  topo
│                                                                              │
│   ◢███████ CONTINUAR ████████◣        ╔══════════════════════╗               │
│    ◢ MAPA                    ◣        ║                      ║               │
│    ◢ HERÓIS                  ◣        ║   retrato grande do  ║               │
│    ◢ CONFIGURAÇÕES           ◣        ║   herói atual        ║               │
│    ◢ SALVAR JOGO             ◣        ║   (canvas)           ║               │
│    ◢ TROCAR FACÇÃO           ◣        ║                      ║               │
│    ◢ SAIR PARA O MENU        ◣        ╠══════════════════════╣               │
│                                       ║ SOLARIS · REI DO SOL ║  placa nome   │
│                                       ╚══════════════════════╝               │
│                                                                              │
│   ▣ 12 BLOCOS DOURADOS   ▣ 2/3 TERRITÓRIOS   ▣ CV   ▣ 01:42:10 DE JOGO        │  rodapé
│   [↑↓] Navegar   [ENTER] Selecionar   [ESC] Continuar                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1. Fundo
- Overlay full-bleed. O jogo fica congelado atrás com escurecimento uniforme (`#04060a` ~0.80) — **não** gradiente que deixa um lado claro.
- **Esconder toda a HUD** enquanto a pausa estiver aberta: `body.is-paused` + regra que dá `visibility:hidden` em `#top-bar`, minimapa, crosshair, rádio, atalhos e banners.
- Identidade: 2–3 **faixas diagonais largas** (polígonos com `clip-path`) na cor da facção do jogador a 10–18% de opacidade, cruzando a tela como o "X" vermelho da referência, + brasão da facção (`getFactionLogoSvg`) gigante a ~6% de opacidade atrás do card. CV = carmesim, PCC = azul, A.R.E.S. = roxo, sem facção = bronze. Ler a cor de `FACTION_DATA[playerFaction].color`.

### 2. Topo (centralizado)
- Contador de studs grande (Teko, ~3.2rem, branco) com o ícone de stud já existente (`hud-stud-3d`) à esquerda, igual à referência.
- Ao lado, em JetBrains Mono pequeno: **região atual + horário do jogo**.

### 3. Coluna de lâminas (esquerda, ~34vw de largura, começando em ~7vw)
- 7 itens, nesta ordem: **CONTINUAR · MAPA · HERÓIS · CONFIGURAÇÕES · SALVAR JOGO · TROCAR FACÇÃO · SAIR PARA O MENU**.
- Cada item é uma **lâmina**: retângulo de altura igual (~58px), **chanfro de 45° nas duas pontas** (`clip-path: polygon(14px 0,100% 0,calc(100% - 14px) 100%,0 100%)`), espaçamento de 6–8px, texto **centralizado** em Teko ~2rem.
- Estado normal: fundo `#0d121d`, borda interna 1px `rgba(255,255,255,.10)`, texto `#94a3b8`.
- **Estado em foco (o mais importante)**: fundo claro "osso" `#e7e2d6`, texto `#04060a`, faixa de 6px na cor da facção na ponta esquerda, leve `scale(1.03)` com `transform-origin:left`. O foco é o elemento mais claro da tela, como na referência. **Nada de indicador solto longe do texto e nada que desloque o texto.**
- "SAIR PARA O MENU": texto carmesim no normal; no foco, faixa carmesim.
- Mouse em cima = foco (um estado só para mouse e teclado).

### 4. Card do herói (direita, ~26vw × ~62vh)
- Moldura chanfrada nos 4 cantos, borda de 2px na cor da facção (na referência é amarela).
- Dentro: fundo da cor da facção bem escura com padrão diagonal/meio-tom em CSS, e o **retrato grande do herói atual** desenhado num `<canvas>` reutilizando `drawHeroLegoPortrait(ctx, w, h, presetKey)` em alta resolução (ex.: 420×520, respeitando o `devicePixelRatio`).
- Embaixo, uma **placa de nome**: faixa sólida na cor da facção com o nome do herói em Teko e, menor, o papel/classe (`getHeroInfo(heroKey)`). OP-09 usa o nome customizado.
- Clicar no card abre HERÓIS.

### 5. Rodapé
- Linha de contadores com ícone + número, **apenas com dados reais que já existem**: blocos dourados (`goldenBricks`), territórios `x/3` (`getConqueredTerritories()` + facção própria, mesma conta do slot de save), facção atual (mini-brasão), tempo de jogo (se não existir contador, criar um simples acumulado no save). **Não inventar totais** (ex.: "14/14 heróis") que o jogo não rastreia.
- Abaixo, as dicas de tecla em JetBrains Mono pequeno: `[↑↓] Navegar  [ENTER] Selecionar  [ESC] Continuar`.
- O feedback de "JOGO SALVO" aparece aqui como um aviso curto (1,8 s), não como banner.

### 6. O que cada item faz
| Item | Ação |
|---|---|
| CONTINUAR | fecha a pausa e retrava o mouse (comportamento atual de `btn-pause-resume`) |
| MAPA | fecha a pausa e chama `setFullMapOpen(true)` |
| HERÓIS | fecha a pausa e abre a roda/dossiê de heróis (`setHeroWheelOpen` / `setHeroDossierOpen`, o que fizer mais sentido) |
| CONFIGURAÇÕES | troca a coluna de lâminas + card pela **subtela de Configurações** (abaixo), sem fechar a pausa |
| SALVAR JOGO | `saveCurrentProgress()` + aviso no rodapé |
| TROCAR FACÇÃO | diálogo de confirmação → fluxo atual de troca de facção |
| SAIR PARA O MENU | diálogo com 3 opções: **Salvar e sair / Sair sem salvar / Cancelar** |

`REINICIAR TERRITÓRIOS` **sai da lista** e vai para Configurações > Jogo, com confirmação.

### 7. Subtela de Configurações (dentro da pausa)
- Mesmo fundo; o card do herói some e a área vira um painel único com **abas no topo**: ÁUDIO · VÍDEO · CONTROLES · JOGO (`Q`/`E` ou `←`/`→` trocam aba; aba ativa = lâmina em foco).
- Cada opção é uma linha: rótulo à esquerda, controle à direita, todas com a mesma largura. Linha em foco = fundo `rgba(255,255,255,.06)` + faixa da facção à esquerda.
- Toggles e listas viram seletor `◂ VALOR ▸` (Horário: Dinâmico/Dia/Pôr do sol/Noite; Idioma: Português/English; Aviso de nova região: Ligado/Desligado). Sem `//`.
- Qualidade gráfica pode continuar com 4 botões ou virar `◂ ▸`, mas sem botões de larguras diferentes.
- Rodapé da subtela: descrição de 1 linha da opção em foco + `[ESC] Voltar  [R] Restaurar padrão`.
- `ESC` volta para a lista de lâminas **com o foco em CONFIGURAÇÕES**; não fecha a pausa.
- **Aberta pelo menu principal**, a subtela usa o mesmo componente, mas esconde o painel do título por trás (hoje o título vaza).

### 8. Teclado, som e animação
- `↑/↓` e `W/S` movem o foco (com volta do fim para o começo), `Enter`/`Espaço` confirmam e `Esc`/`Backspace` voltam um nível. Ao abrir, o foco fica sempre em CONTINUAR.
- Sons distintos: mover foco (tick curto), confirmar, voltar. Reaproveitar o `soundFX` existente.
- Entrada: as lâminas deslizam da esquerda com atraso de 25 ms entre elas e o card desliza da direita, tudo em **até ~180 ms** (o jogo prioriza resposta instantânea). Respeitar `prefers-reduced-motion`.
- A tecla ESC que abre a pausa não pode fechá-la no mesmo frame (já existe `_lastPauseToggleTime`; manter).

## Arquivos e arquitetura (respeitar o AGENTS.md)
- `index.html`: reescrever só o bloco `#pause-options-modal`. Atualizar o cache-bust `?v=`.
- CSS novo: `styles/menus/pause-menu.css` (lâminas, card, topo, rodapé) e `styles/menus/settings-screen.css`, importados em `style.css`. Remover as regras antigas de pausa de `title-and-menus.css`. Cada arquivo com no máximo ~450 linhas.
- JS: dividir `src/ui/hud/PauseAndSettingsController.js` em
  - `PauseMenuController.js` — abrir/fechar, lâminas, card do herói, topo/rodapé, ações;
  - `SettingsScreenController.js` — abas e opções (reaproveitar a lógica atual de volumes/qualidade/horário/idioma);
  - `MenuFocusNavigation.js` — navegação por teclado genérica (reutilizável no menu principal depois);
  - `ConfirmDialog.js` — diálogo único reutilizável.
  Todos instalados via `definePrototypeMethods`, com imports sem ciclos. A fachada `PauseAndSettingsController.js` só orquestra (≤210 linhas).
- Não mudar a API pública usada por outros módulos: `setPauseMenuOpen`, `togglePauseMenu`, `isPauseMenuOpen`, `saveCurrentProgress`.

## Validação
- `npm test` passa (se algum teste depender de IDs antigos da pausa, atualizar o teste e citar no relatório).
- Prints em 1920×1080, 1600×900 e 1280×720: nenhuma lâmina quebra linha, o card não sobrepõe as lâminas, nada da HUD aparece por trás.
- Fluxo só com teclado: ESC → ↓↓↓ → Enter (Configurações) → E (aba Vídeo) → ← muda qualidade → Esc (volta com foco em Configurações) → Esc (fecha e retrava o mouse).
- Trocar de herói e de facção e reabrir a pausa: o retrato, o nome e as cores atualizam.
- **Parar e pedir para o usuário testar** antes de mexer no menu principal (regra 2 do AGENTS.md).
