# PROMPT — Reforma dos Menus (Título, Slots, Facção, Loading, Pausa, Configurações)

> Cole este arquivo inteiro como prompt para o agente codador.
> Leia `AGENTS.md` e `IDV.md` antes de começar. Siga o protocolo de ondas da seção 6.3 do `AGENTS.md`.

## Contexto

O jogo está quase pronto, mas os menus não parecem de jogo: parecem um painel de admin com textos
inventados por IA. O problema **não é a cor nem a fonte**. É **estrutura** (tudo numa tela só, sem
divisão), **texto** (jargão de "operação tática" em todo lugar) e **comportamento** (sem teclado, sem
confirmação, sem foco, uma tela vazando por cima da outra).

Arquivos envolvidos (você só mexe nestes):

- `index.html` — markup de `#title-screen-overlay`, `#tactical-loading-screen`, `#pause-options-modal`, `#pointer-prompt` (linhas ~283–520)
- `styles/title-and-menus.css` (1287 linhas — **acima do limite do AGENTS.md**, divida)
- `src/ui/hud/TitleAndSaveSlotsController.js` (555 linhas)
- `src/ui/hud/PauseAndSettingsController.js` (363 linhas)
- `src/ui/FactionIconsAndSaveSystem.js` — só o objeto `UI_TEXTS` e o `saveGameSettings`/defaults
- `src/controls/player/ControllerInputAndEvents.js` — só a sensibilidade do mouse (linha ~140) e o tratamento de `Escape`
- `src/controls/player/CameraOrbitAndRig.js` — só `baseFov`, se for implementar FOV

## Problemas encontrados (com prints reais)

### A. Menu principal
1. **Idioma é um item do menu principal** (`IDIOMA: PT-BR`), no mesmo peso de "Novo Jogo". Nenhum jogo faz isso. Vai para dentro de Configurações.
2. **Falta "CONTINUAR"** — com save existente, o primeiro item deve ser Continuar (carrega o último slot usado direto). Hoje o jogador tem que ir em Carregar → escolher slot.
3. **Falta "SAIR"/créditos e versão** no canto. Falta dica de controle no rodapé (`[ENTER] Selecionar  [ESC] Voltar`).
4. **Três taglines empilhadas** competindo com o logo: `DARK METROPOLIS // SYNDICATE WARFARE` (em inglês, mesmo em PT-BR), `METRÓPOLE SOB SÍTIO // PATRULHA LIVRE & GUERRA TERRITORIAL`, e no HTML ainda há a faixa de telemetria escondida (`SETORES: 10 ATIVOS / CLIMA / OPERADORES: 11`). Deixe **logo + no máximo 1 subtítulo curto**.
5. **"OPÇÕES TÁTICAS"** → só "CONFIGURAÇÕES".
6. Os itens têm `<small class="btn-sub-txt">` com descrição de cada botão ("Iniciar nova operação no mundo aberto"…) — remover do markup.

### B. Slots de save
1. Título do painel quebra em 2 linhas: "SELECIONE UM REGISTRO DE MEMÓRIA PARA INICIAR NOVA OPERAÇÃO". Trocar por "NOVO JOGO — ESCOLHA UM SLOT" / "CARREGAR JOGO".
2. Slot vazio repete 3× a frase "ARQUIVO INATIVO // FIRME SUA ALIANÇA E ASSUMA O CONTROLE DA METRÓPOLE" + escudo genérico. Slot vazio deve mostrar só **"VAZIO"** e o número.
3. Slot preenchido: mostrar **herói atual (retrato), facção, % de progresso/bases, studs, data relativa** ("há 2 horas"). Não mostrar "OP-09: NÃO REGISTRADO".
4. "EXPURGAR" → "APAGAR" e **exigir confirmação** (hoje apaga direto). Sobrescrever slot ocupado em Novo Jogo também precisa de confirmação.
5. No modo "Carregar", slots vazios não devem ser clicáveis.

### C. Escolha de facção
1. O parágrafo de cima (truce zones, bastião, 1x1…) é regra de jogo, não cabe aqui. Uma linha só.
2. Os cards fechados (CV/PCC) ficam quase invisíveis (letra fantasma escura + logo a ~10% de opacidade). Os 3 têm que ser legíveis sem hover; o hover só destaca.
3. Botão "[ ASSUMIR COMANDO ▸ ]" → "ESCOLHER".
4. Quando aberto pelo pause ("Trocar facção"), precisa de confirmação ("Isso muda sua base aliada. Continuar?").

### D. Loading
1. **Expõe texto técnico ao jogador**: "SISTEMA DE PRÉ-COMPILAÇÃO GPU // ANTI-STUTTER 360°", "AQUECENDO GEOMETRIA URBANA 360° ANTI-ENGASGO (2/4)". Isso é log de dev. Trocar por nome da região/facção + dica.
2. 80% da tela é preto vazio. Usar a arte/emblema da facção grande ou o mesmo fundo de chuva do título.

### E. Pausa — o problema principal ("falta divisão")
Hoje a pausa é **uma tela só** com 5 ações de jogo à esquerda + 7 configurações à direita + cabeçalho
"TERMINAL DE COMANDO // OPERAÇÃO SUSPENSA [ESC] / CENTRAL TÁTICA & CONTROLE DE TERRITÓRIOS".

1. **Separar Pausa de Configurações.** Pausa = lista curta: `CONTINUAR`, `MAPA`, `CONFIGURAÇÕES`, `SALVAR`, `SAIR PARA O MENU`. Configurações abre como **subtela** (ESC volta pra pausa, não fecha tudo).
2. **Ações perigosas sem confirmação:** "RESTAURAR ZONAS DE GUERRA" e "GRAVAR E RETORNAR AO MENU" executam no clique. "Restaurar zonas" nem deveria estar na pausa — mover para Configurações > Jogo > "Reiniciar territórios" com confirmação.
3. Itens quebram em 2 linhas ("GRAVAR PROGRESSO / AGORA", "RESTAURAR ZONAS DE / GUERRA", "GRAVAR E RETORNAR AO / MENU INICIAL"). Rótulos curtos, 1 linha.
4. Itens desalinhados (hover usa deslocamento horizontal que empurra o texto). Indicador de seleção não pode mover o texto.
5. **A HUD vaza por trás da pausa** (minimapa, nome do herói, rádio aparecem no fundo — o gradiente vai a 0.55 de opacidade na direita). Na pausa, esconder a HUD (`body.paused #ui-overlay > :not(#pause-options-modal)`) e escurecer/desfocar o jogo por igual.
6. Mostrar contexto útil na pausa: região atual, herói, studs, tempo de jogo, facção. Hoje não tem nenhum.

### F. Configurações
1. **Abrindo pelo menu principal, o menu VAZA por trás** — "CIDADE DE DEUS", "NOVO JOGO", "CARREGAR JOGO" aparecem atravessando os sliders (ver print `04-options-title.png`). Precisa esconder o painel do título ou ter fundo opaco.
2. **Sem categorias.** Organizar em abas: **ÁUDIO / VÍDEO / CONTROLES / JOGO**. Navegação por `Q`/`E` ou `←`/`→` entre abas.
3. **Faltam opções básicas de qualquer jogo 3ª pessoa:** sensibilidade do mouse (hoje fixa em `0.0032` em `ControllerInputAndEvents.js:140`), inverter eixo Y, campo de visão (FOV), tela cheia, lista de controles/atalhos.
4. Rótulos-jargão: "PERFIL DE RENDERIZAÇÃO" → "QUALIDADE GRÁFICA"; "ALERTA TÁTICO DE TRANSIÇÃO DE SETOR" → "AVISO DE NOVA REGIÃO"; "ATMOSFERA & HORÁRIO DA METRÓPOLE" → "HORÁRIO"; "IDIOMA DO TERMINAL (LANGUAGE)" → "IDIOMA / LANGUAGE"; "EFEITOS BALÍSTICOS, PODERES & MOTORES" → "EFEITOS"; "VOLUME DE AMBIÊNCIA & RÁDIO URBANA" → "MÚSICA E RÁDIO".
5. Toggles mostram "ON // ATIVADO" e "PT-BR // PORTUGUÊS" — usar seletor `◂ VALOR ▸` padrão de jogo (clica/seta esquerda-direita alterna), mesmo componente para Horário, Idioma, Aviso de Região.
6. Faltam "RESTAURAR PADRÃO" por aba e descrição curta da opção focada num rodapé (1 linha, só para a opção selecionada — não embaixo de cada uma).

### G. Comportamento geral (o que mais "não parece jogo")
1. **Zero navegação por teclado** nos menus (nenhum `keydown` em `src/ui/hud/`). Implementar: `↑/↓` ou `W/S` move foco, `Enter`/`Espaço` confirma, `Esc`/`Backspace` volta um nível, `←/→` altera valor. Item focado = mesmo visual do hover. Foco inicial sempre no primeiro item.
2. Pilha de navegação única: Título → Slots → Facção; Pausa → Configurações → Aba. `Esc` sempre volta **um** nível.
3. Um único componente de **diálogo de confirmação** reaproveitado (apagar slot, sobrescrever, trocar facção, reiniciar territórios, sair para o menu).
4. Rodapé fixo com dicas de tecla contextuais em todas as telas de menu.
5. Som de foco (move) diferente do som de confirmar e do de voltar.

### H. Texto (o "AI slop" de verdade)
O `UI_TEXTS` inteiro está escrito em "voz de operação militar": REGISTRO CRIPTOGRAFADO, DOSSIÊ, EXPURGAR,
OPERAÇÃO SUSPENSA, TERMINAL DE COMANDO, PACTO TERRITORIAL, `X // Y` em todo rótulo. Um pouco disso no
logo e nos títulos de tela é estilo; em **todo** botão e opção vira ruído. Regra para reescrever:
- Botões e opções: **1–3 palavras, verbo ou substantivo comum** ("Continuar", "Salvar", "Apagar", "Volume geral").
- Sem `//` em rótulo de botão/opção. Pode ficar em 1 tag pequena por tela, no máximo.
- Nada de inglês misturado no modo PT-BR.
- Atualize `pt-BR` e `en-US` juntos.

### I. Dívida técnica para resolver junto
- `styles/title-and-menus.css` com 1287 linhas mistura HUD legada (`.hud-faction-pill`, `.ww-boss-*`, `.hud-hp-bar-*`) com menus. Mover a HUD legada para `operator-hud.css` e dividir os menus em `styles/menus/title.css`, `slots-and-faction.css`, `loading.css`, `pause-and-settings.css`, `menu-nav-and-dialog.css`. Atualizar imports em `style.css` e o cache-bust `?v=` no `index.html`.
- 19 `!important` nesse arquivo — remover os que só existem para ganhar de regra duplicada.
- `index.html` carrega 5 famílias de fonte (`Inter` e `Rajdhani` além das 3 da IDV). Remover as que não são da IDV se não forem usadas.
- Nova lógica de navegação/diálogo em submódulos novos (`src/ui/hud/MenuNavigationController.js`, `src/ui/hud/ConfirmDialog.js`, `src/ui/hud/SettingsTabsController.js`), instalados via `definePrototypeMethods` como os existentes. Nenhum arquivo acima de ~450 linhas.
- Novas configurações (`mouseSensitivity`, `invertY`, `fov`) com defaults no `saveGameSettings`/carregamento, e lidas pelo controller sem quebrar saves antigos.

## Ondas sugeridas (arquivos disjuntos por agente)

- **Onda 1** — A: CSS split (só `styles/`, `style.css`). B: `UI_TEXTS` reescrito (só `FactionIconsAndSaveSystem.js`). C: `MenuNavigationController.js` + `ConfirmDialog.js` novos (arquivos novos apenas).
- **Onda 2** — D: Título + Slots + Facção + Loading (`TitleAndSaveSlotsController.js` + bloco do título no `index.html`). E: Pausa + Configurações com abas (`PauseAndSettingsController.js`, `SettingsTabsController.js` novo, bloco da pausa no `index.html`) + sensibilidade/invertY/FOV nos controles.
  - D e E editam regiões diferentes do `index.html`: só um deles edita o arquivo; o outro entrega o markup para o coordenador colar.
- Coordenador roda `npm test`, confere `git status --short`, commit atômico por onda.

## Antes de codar — confirmar com o usuário (regra 1 do AGENTS.md)
1. Pode remover "Idioma" do menu principal e colocar só dentro de Configurações?
2. "Reiniciar territórios" sai da pausa e vai para Configurações > Jogo?
3. Quer tela de **remapear teclas** ou basta uma **lista de controles** (só leitura) por enquanto?
4. `AGENTS.md` diz Amarelo `#facc15` como cor de destaque; `IDV.md` **proíbe** `#facc15` e usa Carmesim/Bronze/Aço Glacial. Qual vale? (O código hoje segue o `IDV.md`.)

## Como validar
- `npm test` passa.
- Teste manual: abrir título → navegar só com teclado até entrar no jogo; ESC → pausa → Configurações → trocar aba → ESC volta pra pausa → ESC fecha; abrir Configurações pelo título e confirmar que nada do título aparece por trás; apagar slot pede confirmação.
- Tirar print de cada tela em 1600×900 e 1280×720 e conferir: nenhum rótulo quebra em 2 linhas, nenhuma HUD por trás da pausa.
