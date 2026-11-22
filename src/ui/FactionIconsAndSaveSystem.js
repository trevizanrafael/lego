/**
 * BRASÕES HERÁLDICOS & TÁTICOS EM SVG (ESTÉTICA GOTHAM NOIR / STUDLESS),
 * SISTEMA DE SAVES EM 3 SLOTS (localStorage), CONFIGURAÇÕES E TRADUÇÃO BILÍNGUE (PT-BR / EN-US)
 */

import { createDefaultCustomHeroState } from '../entities/CustomHeroSystem.js';
import { createDefaultGarageSaveData } from '../world/StreetCustomGarage.js';
import { getDefaultHybridOperatorKey } from '../entities/operators/OperatorCatalog.js';
import { WORLD_SCALE, wsPos3 } from '../world/core/WorldLayoutScale.js';

export const SAVE_STORAGE_KEY = 'lego_cdd_saves_v1';
export const SETTINGS_STORAGE_KEY = 'lego_cdd_settings_v1';

export const FACTION_DATA = {
  cv: {
    id: 'cv', color: '#dc2626', accentDark: '#7f1d1d', hex: 0xdc2626,
    baseSpawn: wsPos3({ x: -495, y: 1.5, z: -120 }),
    bossName: { 'pt-BR': 'Trovão Rubro', 'en-US': 'Crimson Thunder' },
    name: { 'pt-BR': 'COMANDO VERMELHO (CV)', 'en-US': 'RED COMMAND (CV)' },
    shortName: { 'pt-BR': 'ALIANÇA: CV', 'en-US': 'ALLIANCE: CV' },
    fortress: { 'pt-BR': 'Cidade de Deus • Oeste', 'en-US': 'Cidade de Deus • West' },
    desc: {
      'pt-BR': 'Domina a encosta fortificada com duas oficinas de picapes artilhadas, motos de assalto e blindados carmesim. Invada territórios rivais com apoio médico e a escolta pesada do líder Trovão Rubro.',
      'en-US': 'Rules the fortified ridge with two garages of gun-trucks, assault bikes, and crimson armored vehicles. Raid rival territories with field medics and heavy backup from Crimson Thunder.'
    }
  },
  pcc: {
    id: 'pcc', color: '#3b82f6', accentDark: '#1e3a8a', hex: 0x3b82f6,
    baseSpawn: wsPos3({ x: 585, y: 1.5, z: -120 }),
    bossName: { 'pt-BR': 'Blindado Z-15', 'en-US': 'Armor Z-15' },
    name: { 'pt-BR': 'PRIMEIRO COMANDO (PCC)', 'en-US': 'FIRST COMMAND (PCC)' },
    shortName: { 'pt-BR': 'ALIANÇA: PCC', 'en-US': 'ALLIANCE: PCC' },
    fortress: { 'pt-BR': 'Distrito Industrial • Leste', 'en-US': 'Industrial District • East' },
    desc: {
      'pt-BR': 'Opera a cidadela industrial com duas oficinas de furgões táticos, motos velozes e utilitários blindados. Avance sobre bases inimigas com esquadrões de elite, paramédicos e o colosso Blindado Z-15.',
      'en-US': 'Commands the industrial citadel with two garages of tactical vans, superbikes, and armored vehicles. Push into enemy bases with elite squads, field medics, and the colossus Armor Z-15.'
    }
  },
  ares: {
    id: 'ares', color: '#a855f7', accentDark: '#581c87', hex: 0xa855f7,
    baseSpawn: wsPos3({ x: 745, y: 1.5, z: 140 }),
    bossName: { 'pt-BR': 'Overlord Quântico', 'en-US': 'Quantum Overlord' },
    name: { 'pt-BR': 'SINDICATO A.R.E.S.', 'en-US': 'A.R.E.S. SYNDICATE' },
    shortName: { 'pt-BR': 'ALIANÇA: A.R.E.S.', 'en-US': 'ALLIANCE: A.R.E.S.' },
    fortress: { 'pt-BR': 'Porto Blindado • Sudeste', 'en-US': 'Armored Port • Southeast' },
    desc: {
      'pt-BR': 'Controla as docas fortificadas com dois hangares de blindados flutuantes, motos laser e interceptadores violeta. Ataque facções rivais com tropas de exoesqueleto e o gigante mecânico Overlord Quântico.',
      'en-US': 'Controls the fortified docks with two bays of hover-APCs, laser bikes, and violet interceptors. Strike rival factions with exo-troops and the mechanical giant Quantum Overlord.'
    }
  }
};

export const UI_TEXTS = {
  'pt-BR': {
    subtitle: 'MUNDO ABERTO E GUERRA URBANA',
    continueGame: 'CONTINUAR',
    newGame: 'NOVO JOGO',
    loadGame: 'CARREGAR JOGO',
    options: 'CONFIGURAÇÕES',
    creditsBtn: 'CRÉDITOS',
    quitGame: 'SAIR',
    languageBtn: 'IDIOMA',
    creditsTitle: 'CRÉDITOS',
    creditsRows: [
      ['Direção e Design', 'Projeto Cidade de Deus'], ['Motor Gráfico 3D', 'Three.js WebGL'],
      ['Áudio e Sintetizadores', 'Web Audio API & Rádio Ao Vivo'], ['Mundo Aberto', '10 Regiões • 11 Personagens']
    ],
    quitToast: 'Você pode fechar esta aba com segurança. Seu progresso está salvo.',
    selectSlotNew: 'NOVO JOGO — ESCOLHA UM SLOT',
    selectSlotLoad: 'CARREGAR JOGO',
    backBtn: 'VOLTAR',
    emptySlot: 'VAZIO',
    startSlotBtn: 'INICIAR',
    overwriteSlotBtn: 'SOBRESCREVER',
    loadSlotBtn: 'CARREGAR',
    deleteSlotBtn: 'APAGAR',
    slotHeroLabel: 'Herói',
    slotFactionLabel: 'Facção',
    slotProgressLabel: 'Progresso',
    slotBasesLabel: 'Bases',
    slotStudsLabel: 'Studs',
    relativeTime: { now: 'agora mesmo', min: 'há {n} min', hour: 'há {n} h', hours: 'há {n} horas', day: 'há 1 dia', days: 'há {n} dias' },
    chooseFactionTag: 'ALIANÇA',
    chooseFactionTitle: 'ESCOLHA SUA FACÇÃO',
    chooseFactionSub: 'Define sua base aliada, oficinas e reforços pela cidade.',
    joinFactionBtn: 'ESCOLHER',
    commanderLabel: 'Líder',
    loadingTag: 'ENTRANDO NA CIDADE',
    loadingTipBadge: 'DICA',
    loadingStages: {
      init: 'Preparando a região...', world: 'Posicionando veículos e patrulhas...',
      light: 'Ajustando clima e iluminação...', stream: 'Carregando quarteirões vizinhos...', ready: 'Pronto para jogar'
    },
    loadingTips: [
      'Pressione [F] perto de carros, motos, barcos ou aeronaves para assumir a direção.',
      'Use [1] e [2] para trocar entre os 2 operadores da sua facção ou [TAB] para abrir a grade de personagens.',
      'Pressione [Q] e [E] para usar habilidades táticas (ou poderes extras) e [R] para recarregar.',
      'Abra o mapa com [M] para marcar destinos ou usar a viagem rápida pelas estações.',
      'Segure [Z] para sintonizar a rádio ao vivo ou use [ e ] para mudar de estação.',
      'Invada bases de facções rivais e derrote o líder local para conquistar o território.'
    ],
    pauseTag: 'JOGO PAUSADO',
    pauseTitle: 'PAUSA',
    resumeBtn: 'CONTINUAR',
    mapBtn: 'MAPA',
    heroesBtn: 'PERSONAGENS',
    settingsBtn: 'CONFIGURAÇÕES',
    saveNowBtn: 'SALVAR JOGO',
    switchFactionBtn: 'TROCAR FACÇÃO',
    resetTerritoriesBtn: 'REINICIAR TERRITÓRIOS',
    saveQuitBtn: 'SAIR PARA O MENU',
    savedFeedback: 'JOGO SALVO',
    resetTerritoriesFeedback: 'Territórios reiniciados.',
    pauseCtx: { region: 'Região', hero: 'Herói', faction: 'Facção', studs: 'Studs', bases: 'Bases', playTime: 'Tempo de jogo' },
    pauseStats: { goldenBricks: 'BLOCOS DOURADOS', territories: 'TERRITÓRIOS', playTime: 'DE JOGO' },
    pauseKillboard: { title: 'BAIXAS', total: 'TOTAL', police: 'POL', civilian: 'CIV', cv: 'CV', pcc: 'PCC', ares: 'ARES' },
    quitChoices: {
      title: 'SAIR PARA O MENU',
      message: 'Deseja salvar seu progresso antes de voltar ao menu inicial?',
      saveAndQuit: 'SALVAR E SAIR',
      quitWithoutSave: 'SAIR SEM SALVAR',
      cancel: 'CANCELAR'
    },
    settingsTitle: 'CONFIGURAÇÕES',
    settingsTabs: { audio: 'ÁUDIO', video: 'VÍDEO', controls: 'CONTROLES', game: 'JOGO' },
    masterVol: 'VOLUME GERAL',
    musicVol: 'MÚSICA E RÁDIO',
    sfxVol: 'EFEITOS',
    graphicsQualityLabel: 'QUALIDADE GRÁFICA',
    graphicsModes: { auto: 'AUTOMÁTICO', low: 'BAIXO', medium: 'MÉDIO', ultra: 'ULTRA' },
    fovLabel: 'CAMPO DE VISÃO',
    fullscreenLabel: 'TELA CHEIA',
    timeOfDayLabel: 'HORÁRIO',
    timeModes: { auto: 'DINÂMICO', day: 'DIA', sunset: 'PÔR DO SOL', night: 'NOITE' },
    killEffectLabel: 'EFEITO DE KILL',
    showFpsLabel: 'MOSTRAR FPS',
    damageNumbersLabel: 'NÚMEROS DE DANO',
    mouseSensLabel: 'SENSIBILIDADE DO MOUSE',
    invertYLabel: 'INVERTER EIXO Y',
    controlsSectionTitle: 'LISTA DE CONTROLES',
    controlsList: [
      ['W A S D', 'Mover personagem / veículo'], ['MOUSE', 'Câmera e mira'],
      ['BOTÃO ESQ.', 'Atacar / disparar'], ['BOTÃO DIR.', 'Mirar com zoom / poder secundário'],
      ['ESPAÇO', 'Pular / voar (duplo toque)'], ['SHIFT', 'Correr / voo supersônico'],
      ['CTRL', 'Rolar / cambalhota tática'],
      ['F', 'Entrar ou sair de veículo / interagir'], ['1 / 2', 'Trocar entre os 2 operadores da facção'],
      ['Q / E', 'Habilidades táticas (ou poderes extras)'], ['R', 'Recarregar arma'],
      ['G', 'Poder extra / invocação'], ['TAB', 'Grade de personagens'],
      ['M', 'Mapa e viagem rápida'], ['Z / [ ]', 'Rádio ao vivo e estações'],
      ['H', 'Ficha do herói'], ['ESC', 'Pausar jogo']
    ],
    langLabel: 'IDIOMA',
    langModes: { 'pt-BR': 'PORTUGUÊS', 'en-US': 'ENGLISH' },
    regionToastToggle: 'AVISO DE NOVA REGIÃO',
    toggleOn: 'LIGADO',
    toggleOff: 'DESLIGADO',
    restoreDefaultsBtn: 'RESTAURAR PADRÃO',
    restoredFeedback: 'Padrões da aba restaurados.',
    optionDescs: {
      masterVol: 'Ajusta o volume principal de todos os sons do jogo.',
      musicVol: 'Controla o volume da trilha ambiente dos bairros e das estações de rádio.',
      sfxVol: 'Regula o volume de disparos, explosões, poderes e motores.',
      graphicsQuality: 'Equilibra alcance de visão, sombras e reflexos conforme o desempenho.',
      fov: 'Define a abertura da câmera em terceira pessoa durante a exploração.',
      fullscreen: 'Alterna a exibição do jogo entre janela e tela cheia.',
      timeMode: 'Escolhe entre ciclo automático de dia e noite ou horário fixo.',
      killEffect: 'Ativa o clarão rápido na tela e o impacto sonoro ao eliminar inimigos.',
      showFps: 'Exibe o contador discreto de FPS e tempo de quadro no canto superior direito.',
      damageNumbers: 'Exibe números flutuantes de dano ao acertar inimigos, civis e veículos.',
      mouseSens: 'Ajusta a velocidade de rotação da câmera ao mover o mouse.',
      invertY: 'Inverte o movimento vertical do mouse ao olhar para cima ou para baixo.',
      controlsList: 'Atalhos principais de teclado e mouse para combate, poderes e veículos.',
      language: 'Altera imediatamente o idioma dos menus, legendas e avisos na tela.',
      regionToast: 'Exibe o nome do bairro ao cruzar a fronteira para uma nova região.',
      switchFaction: 'Permite escolher uma nova facção aliada e mudar sua base principal.',
      resetTerritories: 'Devolve todas as bases conquistadas ao controle original das facções.'
    },
    confirmYes: 'CONFIRMAR',
    confirmCancel: 'CANCELAR',
    confirms: {
      deleteSlot: { title: 'APAGAR JOGO SALVO', message: 'Deseja apagar permanentemente este slot? Esta ação não pode ser desfeita.' },
      overwriteSlot: { title: 'SOBRESCREVER SLOT', message: 'Este slot já contém progresso salvo. Deseja iniciar um novo jogo por cima dele?' },
      switchFaction: { title: 'TROCAR FACÇÃO', message: 'Isso muda sua base aliada. Continuar?' },
      resetTerritories: { title: 'REINICIAR TERRITÓRIOS', message: 'Restaurar todas as bases para o domínio inicial de cada facção?' },
      quitToMenu: { title: 'SAIR PARA O MENU', message: 'Seu progresso será salvo automaticamente antes de sair. Continuar?' },
      restoreDefaults: { title: 'RESTAURAR PADRÃO', message: 'Restaurar as opções desta aba para os valores originais?' }
    },
    keyHints: {
      title: [['↑/↓', 'Navegar'], ['ENTER', 'Selecionar']],
      subpanel: [['↑/↓', 'Navegar'], ['ENTER', 'Selecionar'], ['ESC', 'Voltar']],
      faction: [['←/→', 'Escolher facção'], ['ENTER', 'Confirmar'], ['ESC', 'Voltar']],
      pause: [['↑↓', 'Navegar'], ['ENTER', 'Selecionar'], ['ESC', 'Continuar']],
      settings: [['Q/E', 'Aba'], ['◂▸', 'Ajustar'], ['R', 'Restaurar padrão'], ['ESC', 'Voltar']],
      characters: [['Q/E', 'Filtro'], ['↑↓←→', 'Navegar'], ['ENTER', 'Comprar / Equipar'], ['ESC', 'Voltar']],
      dialog: [['←/→', 'Alternar'], ['ENTER', 'Confirmar'], ['ESC', 'Cancelar']]
    },
    characterStore: {
      title: 'PERSONAGENS',
      unlockedCounter: '{unlocked} / {total} LIBERADOS',
      tabs: { all: 'TODOS', faction: 'SUA FACÇÃO', rivals: 'RIVAIS', extras: 'EXTRAS', bosses: 'CHEFÕES' },
      buyBtn: 'COMPRAR',
      buyForStudsBtn: 'COMPRAR · {price} STUDS',
      equipBtn: 'EQUIPAR',
      activeBtn: 'EM CAMPO',
      unlockedBadge: 'LIBERADO',
      bossBadge: 'CHEFE',
      missingStudsBtn: 'FALTAM {n} STUDS',
      factoryUnlockedTag: 'LIBERADO DE FÁBRICA',
      deserterBanner: 'DESERTOR — LUTA PELA SUA FACÇÃO',
      bossUnlockHint: 'DERROTE O CHEFE DO TERRITÓRIO PARA LIBERAR',
      bossLockedBtn: 'DERROTE NA GUERRA TERRITORIAL',
      op09LabHint: 'Edite aparência e poderes no Laboratório Subterrâneo da Torre dos Heróis [F].',
      confirmTitle: 'COMPRAR PERSONAGEM',
      confirmMsg: 'Comprar {name} por {price} studs?',
      unlockedFeedback: '{name} DESBLOQUEADO!',
      equippedFeedback: '{name} EM CAMPO',
      weaponLabel: 'ARMA PRINCIPAL',
      abilitiesLabel: 'HABILIDADES TÁTICAS',
      stats: { hp: 'VIDA (HP)', damage: 'DANO', speed: 'VELOCIDADE', mitigation: 'MITIGAÇÃO' }
    },
    freeRoamSlotTitle: 'PATRULHA LIVRE',
    worldWarFront: 'PATRULHA LIVRE',
    invasionActive: '',
    medicHealing: ''
  },
  'en-US': {
    subtitle: 'OPEN WORLD & URBAN WARFARE',
    continueGame: 'CONTINUE',
    newGame: 'NEW GAME',
    loadGame: 'LOAD GAME',
    options: 'SETTINGS',
    creditsBtn: 'CREDITS',
    quitGame: 'EXIT',
    languageBtn: 'LANGUAGE',
    creditsTitle: 'CREDITS',
    creditsRows: [
      ['Direction & Design', 'Cidade de Deus Project'], ['3D Graphics Engine', 'Three.js WebGL'],
      ['Audio & Synthesizers', 'Web Audio API & Live Radio'], ['Open World', '10 Regions • 11 Characters']
    ],
    quitToast: 'You can safely close this tab. Your progress is saved.',
    selectSlotNew: 'NEW GAME — CHOOSE A SLOT',
    selectSlotLoad: 'LOAD GAME',
    backBtn: 'BACK',
    emptySlot: 'EMPTY',
    startSlotBtn: 'START',
    overwriteSlotBtn: 'OVERWRITE',
    loadSlotBtn: 'LOAD',
    deleteSlotBtn: 'DELETE',
    slotHeroLabel: 'Hero',
    slotFactionLabel: 'Faction',
    slotProgressLabel: 'Progress',
    slotBasesLabel: 'Bases',
    slotStudsLabel: 'Studs',
    relativeTime: { now: 'just now', min: '{n} min ago', hour: '1 hour ago', hours: '{n} hours ago', day: '1 day ago', days: '{n} days ago' },
    chooseFactionTag: 'ALLIANCE',
    chooseFactionTitle: 'CHOOSE YOUR FACTION',
    chooseFactionSub: 'Sets your allied base, garages and reinforcements across the city.',
    joinFactionBtn: 'CHOOSE',
    commanderLabel: 'Leader',
    loadingTag: 'ENTERING THE CITY',
    loadingTipBadge: 'TIP',
    loadingStages: {
      init: 'Preparing region...', world: 'Placing vehicles and patrols...',
      light: 'Adjusting weather and lighting...', stream: 'Loading nearby blocks...', ready: 'Ready to play'
    },
    loadingTips: [
      'Press [F] near cars, bikes, boats, or aircraft to take the wheel.',
      'Use [1] and [2] to switch between your 2 faction operators or [TAB] to open the character grid.',
      'Press [Q] and [E] for tactical abilities (or extra powers) and [R] to reload.',
      'Open the map with [M] to set waypoints or fast travel between stations.',
      'Hold [Z] to tune into live radio or press [ and ] to switch stations.',
      'Raid rival faction bases and defeat their leader to conquer the territory.'
    ],
    pauseTag: 'GAME PAUSED',
    pauseTitle: 'PAUSED',
    resumeBtn: 'RESUME',
    mapBtn: 'MAP',
    heroesBtn: 'CHARACTERS',
    settingsBtn: 'SETTINGS',
    saveNowBtn: 'SAVE GAME',
    switchFactionBtn: 'CHANGE FACTION',
    resetTerritoriesBtn: 'RESET TERRITORIES',
    saveQuitBtn: 'QUIT TO MENU',
    savedFeedback: 'GAME SAVED',
    resetTerritoriesFeedback: 'Territories reset.',
    pauseCtx: { region: 'Region', hero: 'Hero', faction: 'Faction', studs: 'Studs', bases: 'Bases', playTime: 'Play time' },
    pauseStats: { goldenBricks: 'GOLD BRICKS', territories: 'TERRITORIES', playTime: 'PLAYED' },
    pauseKillboard: { title: 'KILLS', total: 'TOTAL', police: 'POL', civilian: 'CIV', cv: 'CV', pcc: 'PCC', ares: 'ARES' },
    quitChoices: {
      title: 'QUIT TO MENU',
      message: 'Save your progress before returning to the main menu?',
      saveAndQuit: 'SAVE & QUIT',
      quitWithoutSave: 'QUIT WITHOUT SAVING',
      cancel: 'CANCEL'
    },
    settingsTitle: 'SETTINGS',
    settingsTabs: { audio: 'AUDIO', video: 'VIDEO', controls: 'CONTROLS', game: 'GAME' },
    masterVol: 'MASTER VOLUME',
    musicVol: 'MUSIC & RADIO',
    sfxVol: 'SOUND EFFECTS',
    graphicsQualityLabel: 'GRAPHICS QUALITY',
    graphicsModes: { auto: 'AUTOMATIC', low: 'LOW', medium: 'MEDIUM', ultra: 'ULTRA' },
    fovLabel: 'FIELD OF VIEW',
    fullscreenLabel: 'FULLSCREEN',
    timeOfDayLabel: 'TIME OF DAY',
    timeModes: { auto: 'DYNAMIC', day: 'DAY', sunset: 'SUNSET', night: 'NIGHT' },
    killEffectLabel: 'KILL EFFECT',
    showFpsLabel: 'SHOW FPS',
    damageNumbersLabel: 'DAMAGE NUMBERS',
    mouseSensLabel: 'MOUSE SENSITIVITY',
    invertYLabel: 'INVERT Y AXIS',
    controlsSectionTitle: 'CONTROLS LIST',
    controlsList: [
      ['W A S D', 'Move character / vehicle'], ['MOUSE', 'Camera and aim'],
      ['LEFT CLICK', 'Attack / fire'], ['RIGHT CLICK', 'Aim zoom / secondary power'],
      ['SPACE', 'Jump / fly (double tap)'], ['SHIFT', 'Sprint / supersonic flight'],
      ['CTRL', 'Tactical combat roll'],
      ['F', 'Enter or exit vehicle / interact'], ['1 / 2', 'Switch between your 2 faction operators'],
      ['Q / E', 'Tactical abilities (or extra powers)'], ['R', 'Reload weapon'],
      ['G', 'Extra power / summon'], ['TAB', 'Character grid'],
      ['M', 'Map and fast travel'], ['Z / [ ]', 'Live radio and stations'],
      ['H', 'Hero profile'], ['ESC', 'Pause game']
    ],
    langLabel: 'LANGUAGE',
    langModes: { 'pt-BR': 'PORTUGUÊS', 'en-US': 'ENGLISH' },
    regionToastToggle: 'NEW REGION BANNER',
    toggleOn: 'ON',
    toggleOff: 'OFF',
    restoreDefaultsBtn: 'RESTORE DEFAULTS',
    restoredFeedback: 'Tab defaults restored.',
    optionDescs: {
      masterVol: 'Adjusts the overall volume of all game audio.',
      musicVol: 'Controls the volume of district ambience and live radio stations.',
      sfxVol: 'Sets the volume of gunfire, explosions, powers, and engines.',
      graphicsQuality: 'Balances draw distance, shadows, and reflections for smooth performance.',
      fov: 'Sets the third-person camera field of view while exploring.',
      fullscreen: 'Switches the game display between windowed mode and fullscreen.',
      timeMode: 'Chooses between an automatic day-night cycle or a fixed time of day.',
      killEffect: 'Enables the brief screen flash and audio thump when eliminating targets.',
      showFps: 'Shows the compact frameless FPS and frame-time counter at the top right.',
      damageNumbers: 'Shows floating damage numbers when hitting enemies, civilians, and vehicles.',
      mouseSens: 'Adjusts how fast the camera rotates when moving the mouse.',
      invertY: 'Inverts vertical mouse movement when looking up or down.',
      controlsList: 'Primary keyboard and mouse shortcuts for combat, powers, and vehicles.',
      language: 'Immediately changes the language of menus, labels, and HUD alerts.',
      regionToast: 'Shows the district name when crossing into a new region.',
      switchFaction: 'Lets you pick a new allied faction and relocate your home base.',
      resetTerritories: 'Restores all conquered bases to their original faction control.'
    },
    confirmYes: 'CONFIRM',
    confirmCancel: 'CANCEL',
    confirms: {
      deleteSlot: { title: 'DELETE SAVED GAME', message: 'Permanently delete this save slot? This action cannot be undone.' },
      overwriteSlot: { title: 'OVERWRITE SLOT', message: 'This slot already has saved progress. Start a new game over it?' },
      switchFaction: { title: 'CHANGE FACTION', message: 'This changes your allied home base. Continue?' },
      resetTerritories: { title: 'RESET TERRITORIES', message: 'Restore all bases to their starting faction control?' },
      quitToMenu: { title: 'QUIT TO MENU', message: 'Your progress will be saved automatically before leaving. Continue?' },
      restoreDefaults: { title: 'RESTORE DEFAULTS', message: 'Restore the options in this tab to their default values?' }
    },
    keyHints: {
      title: [['↑/↓', 'Navigate'], ['ENTER', 'Select']],
      subpanel: [['↑/↓', 'Navigate'], ['ENTER', 'Select'], ['ESC', 'Back']],
      faction: [['←/→', 'Choose faction'], ['ENTER', 'Confirm'], ['ESC', 'Back']],
      pause: [['↑↓', 'Navigate'], ['ENTER', 'Select'], ['ESC', 'Resume']],
      settings: [['Q/E', 'Tab'], ['◂▸', 'Adjust'], ['R', 'Restore defaults'], ['ESC', 'Back']],
      characters: [['Q/E', 'Filter'], ['↑↓←→', 'Navigate'], ['ENTER', 'Buy / Equip'], ['ESC', 'Back']],
      dialog: [['←/→', 'Switch'], ['ENTER', 'Confirm'], ['ESC', 'Cancel']]
    },
    characterStore: {
      title: 'CHARACTERS',
      unlockedCounter: '{unlocked} / {total} UNLOCKED',
      tabs: { all: 'ALL', faction: 'YOUR FACTION', rivals: 'RIVALS', extras: 'EXTRAS', bosses: 'BOSSES' },
      buyBtn: 'BUY',
      buyForStudsBtn: 'BUY · {price} STUDS',
      equipBtn: 'EQUIP',
      activeBtn: 'IN FIELD',
      unlockedBadge: 'UNLOCKED',
      bossBadge: 'BOSS',
      missingStudsBtn: 'MISSING {n} STUDS',
      factoryUnlockedTag: 'UNLOCKED BY DEFAULT',
      deserterBanner: 'DESERTER — FIGHTS FOR YOUR FACTION',
      bossUnlockHint: 'DEFEAT THE TERRITORY BOSS TO UNLOCK',
      bossLockedBtn: 'DEFEAT IN TERRITORIAL WAR',
      op09LabHint: 'Customize appearance and powers in the Hero Tower Underground Lab [F].',
      confirmTitle: 'BUY CHARACTER',
      confirmMsg: 'Buy {name} for {price} studs?',
      unlockedFeedback: '{name} UNLOCKED!',
      equippedFeedback: '{name} IN FIELD',
      weaponLabel: 'PRIMARY WEAPON',
      abilitiesLabel: 'TACTICAL ABILITIES',
      stats: { hp: 'HEALTH (HP)', damage: 'DAMAGE', speed: 'SPEED', mitigation: 'MITIGATION' }
    },
    freeRoamSlotTitle: 'FREE ROAM',
    worldWarFront: 'FREE ROAM',
    invasionActive: '',
    medicHealing: ''
  }
};

export function getFreeRoamLogoSvg(size = 80) {
  return `
    <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
      <polygon points="36,5 84,5 112,28 106,84 60,115 14,84 8,28" fill="#05070c" stroke="#c28e2b" stroke-width="3.5"/>
      <polygon points="39,11 81,11 105,31 100,80 60,108 20,80 15,31" fill="#0d121d" stroke="#991b1b" stroke-width="1.8"/>
      <polygon points="18,76 46,13 58,13 28,82" fill="#7dd3fc" opacity="0.18"/><polygon points="102,76 74,13 62,13 92,82" fill="#7dd3fc" opacity="0.18"/>
      <line x1="22" y1="79" x2="52" y2="13" stroke="#7dd3fc" stroke-width="1.2" opacity="0.45"/><line x1="98" y1="79" x2="68" y2="13" stroke="#7dd3fc" stroke-width="1.2" opacity="0.45"/>
      <polygon points="22,52 43,46 47,62 30,65" fill="#182235" stroke="#c28e2b" stroke-width="1.4"/><polygon points="98,52 77,46 73,62 90,65" fill="#182235" stroke="#c28e2b" stroke-width="1.4"/>
      <polygon points="60,14 67,34 74,42 74,88 46,88 46,42 53,34" fill="#05070c" stroke="#c28e2b" stroke-width="2"/>
      <polygon points="38,56 46,50 46,88 38,88" fill="#090d16" stroke="#475569" stroke-width="1.3"/><polygon points="82,56 74,50 74,88 82,88" fill="#090d16" stroke="#475569" stroke-width="1.3"/>
      <rect x="58" y="38" width="4" height="16" fill="#7dd3fc"/><rect x="52" y="58" width="3" height="18" fill="#c28e2b" opacity="0.85"/><rect x="65" y="58" width="3" height="18" fill="#c28e2b" opacity="0.85"/>
      <polygon points="34,88 86,88 78,99 60,105 42,99" fill="#991b1b" stroke="#c28e2b" stroke-width="1.8"/><polygon points="60,91 66,96 60,101 54,96" fill="#7dd3fc"/>
    </svg>`;
}

export function getFactionLogoSvg(factionKey = 'cv', size = 80) {
  if (factionKey === 'cv') {
    return `
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
        <polygon points="60,4 110,20 102,86 60,116 18,86 10,20" fill="#05070c" stroke="#dc2626" stroke-width="3.8"/>
        <polygon points="60,10 103,24 96,82 60,109 24,82 17,24" fill="#110609" stroke="#7f1d1d" stroke-width="1.8"/>
        <polygon points="60,14 96,27 90,78 60,101 30,78 24,27" fill="#7f1d1d" opacity="0.28"/>
        <g stroke="#475569" stroke-width="4.2" stroke-linecap="butt"><line x1="20" y1="86" x2="100" y2="26"/><line x1="100" y1="86" x2="20" y2="26"/></g>
        <g stroke="#94a3b8" stroke-width="1.6"><line x1="23" y1="84" x2="97" y2="28"/><line x1="97" y1="84" x2="23" y2="28"/></g>
        <polygon points="30,74 38,68 43,78 35,83" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/><polygon points="90,74 82,68 77,78 85,83" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
        <polygon points="41,31 45,14 54,25 60,11 66,25 75,14 79,31" fill="#991b1b" stroke="#dc2626" stroke-width="1.8"/><polygon points="46,29 60,16 74,29" fill="#dc2626" opacity="0.45"/>
        <polygon points="43,32 77,32 84,46 80,62 72,68 70,79 50,79 48,68 40,62 36,46" fill="#d1d5db" stroke="#05070c" stroke-width="2.6"/>
        <polygon points="60,32 77,32 84,46 80,62 72,68 70,79 60,79" fill="#94a3b8"/>
        <polygon points="40,56 48,64 48,69 42,62" fill="#64748b"/><polygon points="80,56 72,64 72,69 78,62" fill="#475569"/><polygon points="44,35 49,34 54,64 49,66" fill="#dc2626"/>
        <polygon points="41,47 56,51 54,59 42,56" fill="#05070c"/><polygon points="79,47 64,51 66,59 78,56" fill="#05070c"/>
        <polygon points="46,52 52,53 50,56" fill="#dc2626"/><polygon points="74,52 68,53 70,56" fill="#dc2626"/><polygon points="60,57 64,65 56,65" fill="#05070c"/>
        <line x1="54" y1="70" x2="54" y2="78" stroke="#05070c" stroke-width="2.2"/><line x1="60" y1="70" x2="60" y2="78" stroke="#05070c" stroke-width="2.2"/><line x1="66" y1="70" x2="66" y2="78" stroke="#05070c" stroke-width="2.2"/>
        <polygon points="39,84 81,84 77,100 43,100" fill="#05070c" stroke="#dc2626" stroke-width="2"/>
        <text x="60" y="96.5" text-anchor="middle" fill="#dc2626" font-family="Teko, sans-serif" font-size="16" font-weight="700" letter-spacing="2.5">CV</text>
      </svg>`;
  }
  if (factionKey === 'pcc') {
    return `
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
        <polygon points="60,4 111,28 111,86 60,116 9,86 9,28" fill="#070b14" stroke="#2563eb" stroke-width="3.8"/>
        <polygon points="60,11 104,32 104,82 60,109 16,82 16,32" fill="#0b1222" stroke="#60a5fa" stroke-width="1.4" opacity="0.85"/>
        <polygon points="20,84 26,88 100,28 94,24" fill="#334155" stroke="#94a3b8" stroke-width="1"/><polygon points="100,84 94,88 20,28 26,24" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
        <circle cx="60" cy="54" r="30" fill="#050811" stroke="#2563eb" stroke-width="2.2"/><path d="M60,24 A30,30 0 0,1 60,84 A23,28 0 0,0 60,24 Z" fill="#60a5fa" opacity="0.32"/>
        <line x1="60" y1="18" x2="60" y2="26" stroke="#7dd3fc" stroke-width="1.8"/><line x1="24" y1="54" x2="32" y2="54" stroke="#7dd3fc" stroke-width="1.8"/><line x1="88" y1="54" x2="96" y2="54" stroke="#7dd3fc" stroke-width="1.8"/>
        <polygon points="60,24 84,36 88,62 74,80 46,80 32,62 36,36" fill="#070b14" stroke="#60a5fa" stroke-width="2"/><polygon points="60,29 78,39 80,60 60,76 40,60 42,39" fill="#111a2e"/>
        <polygon points="48,58 60,53 72,58 69,75 60,79 51,75" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
        <line x1="55" y1="63" x2="55" y2="72" stroke="#60a5fa" stroke-width="1.6"/><line x1="60" y1="61" x2="60" y2="74" stroke="#60a5fa" stroke-width="1.6"/><line x1="65" y1="63" x2="65" y2="72" stroke="#60a5fa" stroke-width="1.6"/>
        <polygon points="41,47 57,51 55,56 42,53" fill="#7dd3fc" stroke="#2563eb" stroke-width="1.2"/><polygon points="79,47 63,51 65,56 78,53" fill="#7dd3fc" stroke="#2563eb" stroke-width="1.2"/>
        <polygon points="34,84 86,84 82,100 38,100" fill="#050811" stroke="#2563eb" stroke-width="2"/>
        <text x="60" y="96.5" text-anchor="middle" fill="#60a5fa" font-family="Teko, sans-serif" font-size="15" font-weight="700" letter-spacing="1.8">PCC 1533</text>
      </svg>`;
  }
  return `
    <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
      <polygon points="60,4 114,20 101,88 60,116 19,88 6,20" fill="#090712" stroke="#9333ea" stroke-width="3.8"/>
      <polygon points="60,11 106,24 95,84 60,109 25,84 14,24" fill="#120d22" stroke="#c084fc" stroke-width="1.4" opacity="0.85"/>
      <polygon points="10,32 42,42 38,54 16,47" fill="#1e293b" stroke="#9333ea" stroke-width="1.6"/><polygon points="15,49 41,55 36,67 21,61" fill="#334155" stroke="#c084fc" stroke-width="1.3"/>
      <polygon points="110,32 78,42 82,54 104,47" fill="#1e293b" stroke="#9333ea" stroke-width="1.6"/><polygon points="105,49 79,55 84,67 99,61" fill="#334155" stroke="#c084fc" stroke-width="1.3"/>
      <polygon points="60,15 68,28 84,34 87,64 69,80 51,80 33,64 36,34 52,28" fill="#1e2436" stroke="#c084fc" stroke-width="2.2"/>
      <polygon points="60,15 68,28 84,34 87,64 69,80 60,80" fill="#0f1422" opacity="0.65"/>
      <polygon points="60,21 66,29 60,37 54,29" fill="#c084fc" stroke="#f3e8ff" stroke-width="1.3"/><polygon points="60,25 63,29 60,33 57,29" fill="#7dd3fc"/>
      <polygon points="38,43 60,53 82,43 78,56 60,65 42,56" fill="#9333ea" stroke="#e9d5ff" stroke-width="1.6"/><polygon points="43,47 60,55 77,47 75,52 60,60 45,52" fill="#e9d5ff"/>
      <line x1="53" y1="68" x2="53" y2="77" stroke="#c084fc" stroke-width="2"/><line x1="60" y1="67" x2="60" y2="78" stroke="#c084fc" stroke-width="2"/><line x1="67" y1="68" x2="67" y2="77" stroke="#c084fc" stroke-width="2"/>
      <polygon points="33,84 87,84 83,100 37,100" fill="#090712" stroke="#9333ea" stroke-width="2"/>
      <text x="60" y="96.5" text-anchor="middle" fill="#c084fc" font-family="Teko, sans-serif" font-size="15" font-weight="700" letter-spacing="2">A.R.E.S.</text>
    </svg>`;
}

export const DEFAULT_GAME_SETTINGS = {
  masterVolume: 0.85,
  musicVolume: 0.55,
  sfxVolume: 0.9,
  showRegionToast: true,
  graphicsQuality: 'auto',
  timeMode: 'auto',
  killEffect: true,
  showFps: true,
  damageNumbers: true,
  language: 'pt-BR',
  mouseSensitivity: 1.0,
  invertY: false,
  fov: 60
};

export function migrateSaveSlotToWorldScale(slot, targetScale = WORLD_SCALE) {
  if (!slot || typeof slot !== 'object') return slot;
  const prevScale = Number(slot.worldScale) > 0 ? Number(slot.worldScale) : 1;
  if (Math.abs(prevScale - targetScale) > 1e-4) {
    const ratio = targetScale / prevScale;
    for (const key of ['playerPos', 'savedPos', 'waypoint']) {
      const pt = slot[key];
      if (pt && typeof pt === 'object') {
        if (Number.isFinite(Number(pt.x))) pt.x = Number(pt.x) * ratio;
        if (Number.isFinite(Number(pt.z))) pt.z = Number(pt.z) * ratio;
      }
    }
  }
  slot.worldScale = targetScale;
  return slot;
}

export function loadAllSaveSlots() {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed.map((slot) => (slot ? migrateSaveSlotToWorldScale(slot, WORLD_SCALE) : null));
    }
  } catch (e) { /* storage indisponível */ }
  return [null, null, null];
}

export function normalizeSessionKills(raw = null) {
  const src = raw && typeof raw === 'object' ? raw : null;
  const police = Math.max(0, Math.floor(Number(src?.police) || 0));
  const civilian = Math.max(0, Math.floor(Number(src?.civilian) || 0));
  const cv = Math.max(0, Math.floor(Number(src?.cv) || 0));
  const pcc = Math.max(0, Math.floor(Number(src?.pcc) || 0));
  const ares = Math.max(0, Math.floor(Number(src?.ares) || 0));
  const sum = police + civilian + cv + pcc + ares;
  const rawTotal = Number(src?.total);
  const total = Number.isFinite(rawTotal) && rawTotal >= sum ? Math.floor(rawTotal) : sum;
  return { total, police, civilian, cv, pcc, ares };
}

export function writeSaveSlot(slotIndex, data = {}) {
  const slots = loadAllSaveSlots();
  const prev = slots[slotIndex];
  const validFaction = FACTION_DATA[data.faction] ? data.faction : 'cv';
  const sessionKills = data.sessionKills && typeof data.sessionKills === 'object'
    ? normalizeSessionKills(data.sessionKills)
    : prev?.sessionKills && typeof prev.sessionKills === 'object'
      ? normalizeSessionKills(prev.sessionKills)
      : normalizeSessionKills(null);
  const customHero = data.customHero && typeof data.customHero === 'object'
    ? { ...data.customHero }
    : prev?.customHero && typeof prev.customHero === 'object'
      ? { ...prev.customHero }
      : createDefaultCustomHeroState();
  const customGarage = data.customGarage && typeof data.customGarage === 'object'
    ? JSON.parse(JSON.stringify(data.customGarage))
    : prev?.customGarage && typeof prev.customGarage === 'object'
      ? JSON.parse(JSON.stringify(prev.customGarage))
      : createDefaultGarageSaveData();
  const aircraftCustom = data.aircraftCustom && typeof data.aircraftCustom === 'object'
    ? JSON.parse(JSON.stringify(data.aircraftCustom))
    : prev?.aircraftCustom && typeof prev.aircraftCustom === 'object'
      ? JSON.parse(JSON.stringify(prev.aircraftCustom))
      : null;
  const radioState = data.radioState !== undefined
    ? (data.radioState ? JSON.parse(JSON.stringify(data.radioState)) : null)
    : prev?.radioState && typeof prev.radioState === 'object'
      ? JSON.parse(JSON.stringify(prev.radioState))
      : null;
  const rawSavedAt = Number(data.savedAtMs ?? Date.now());
  const savedAtMs = Number.isFinite(rawSavedAt) && rawSavedAt > 0 ? rawSavedAt : Date.now();
  const rawPlayTime = Number(data.playTimeSec ?? prev?.playTimeSec ?? 0);
  const playTimeSec = Number.isFinite(rawPlayTime) ? Math.max(0, Math.floor(rawPlayTime)) : 0;
  const activeCharKey =
    data.operatorKey ||
    data.heroKey ||
    prev?.operatorKey ||
    prev?.heroKey ||
    getDefaultHybridOperatorKey(validFaction);
  const unlockedExtras = Array.isArray(data.unlockedExtras)
    ? [...new Set(data.unlockedExtras)]
    : Array.isArray(prev?.unlockedExtras)
      ? [...new Set(prev.unlockedExtras)]
      : [];

  slots[slotIndex] = {
    slotIndex,
    faction: validFaction,
    studs: Number(data.studs || 0),
    operatorKey: activeCharKey,
    heroKey: activeCharKey,
    unlockedExtras,
    conqueredTerritories: Array.isArray(data.conqueredTerritories) ? data.conqueredTerritories : [],
    goldenBricks: Number(data.goldenBricks ?? prev?.goldenBricks ?? 0),
    territoryMeta: data.territoryMeta && typeof data.territoryMeta === 'object'
      ? JSON.parse(JSON.stringify(data.territoryMeta))
      : prev?.territoryMeta && typeof prev.territoryMeta === 'object'
        ? prev.territoryMeta
        : {},
    customHero,
    customGarage,
    aircraftCustom,
    radioState,
    sessionKills,
    savedAtMs,
    playTimeSec,
    worldScale: WORLD_SCALE,
    ...(data.playerPos && typeof data.playerPos === 'object' ? { playerPos: { ...data.playerPos } } : prev?.playerPos ? { playerPos: { ...prev.playerPos } } : {}),
    ...(data.savedPos && typeof data.savedPos === 'object' ? { savedPos: { ...data.savedPos } } : prev?.savedPos ? { savedPos: { ...prev.savedPos } } : {}),
    ...(data.waypoint && typeof data.waypoint === 'object' ? { waypoint: { ...data.waypoint } } : prev?.waypoint ? { waypoint: { ...prev.waypoint } } : {}),
    updatedAt: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  };
  try { localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(slots)); } catch (e) { /* storage indisponível */ }
  return slots[slotIndex];
}

export function deleteSaveSlot(slotIndex) {
  const slots = loadAllSaveSlots();
  slots[slotIndex] = null;
  try { localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(slots)); } catch (e) { /* storage indisponível */ }
  return slots;
}

export function findMostRecentSaveSlot(slots = null) {
  const list = Array.isArray(slots) ? slots : loadAllSaveSlots();
  let best = null;
  let bestTs = -Infinity;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') continue;
    const rawTs = item.savedAtMs != null ? Number(item.savedAtMs) : NaN;
    const ts = Number.isFinite(rawTs) && rawTs > 0 ? rawTs : -1;
    if (best === null || ts > bestTs) {
      best = { slotIndex: i, data: item };
      bestTs = ts;
    }
  }
  return best;
}

export function formatRelativeSaveDate(slotData, lang = 'pt-BR', nowMs = Date.now()) {
  if (!slotData || typeof slotData !== 'object') return '';
  const rawSavedAt = slotData.savedAtMs != null ? Number(slotData.savedAtMs) : NaN;
  if (!Number.isFinite(rawSavedAt) || rawSavedAt <= 0) return slotData.updatedAt || '';
  const dict = (UI_TEXTS[lang] || UI_TEXTS['pt-BR']).relativeTime;
  const diffSec = Math.max(0, Math.floor((nowMs - rawSavedAt) / 1000));
  if (diffSec < 60) return dict.now;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return dict.min.replace('{n}', String(diffMin));
  const diffHours = Math.floor(diffSec / 3600);
  if (diffHours < 24) return (diffHours === 1 ? dict.hour : dict.hours).replace('{n}', String(diffHours));
  const diffDays = Math.floor(diffSec / 86400);
  return (diffDays === 1 ? dict.day : dict.days).replace('{n}', String(diffDays));
}

export function computeSlotProgressPct(slotData) {
  if (!slotData || typeof slotData !== 'object') return 0;
  const controlled = new Set();
  if (slotData.faction && FACTION_DATA[slotData.faction]) controlled.add(slotData.faction);
  if (Array.isArray(slotData.conqueredTerritories)) {
    for (const id of slotData.conqueredTerritories) {
      if (id) controlled.add(id);
    }
  }
  const bases = Math.min(3, controlled.size);
  const goldenBricks = Math.max(0, Number(slotData.goldenBricks) || 0);
  const studs = Math.max(0, Number(slotData.studs) || 0);
  const heroBonus = slotData.customHero?.isCustomized ||
    (Array.isArray(slotData.customHero?.unlockedIds) && slotData.customHero.unlockedIds.length > 0) ? 5 : 0;
  const garageBonus = (slotData.aircraftCustom ? 5 : 0) +
    (Array.isArray(slotData.customGarage?.customizedSlots) && slotData.customGarage.customizedSlots.length > 0 ? 5 : 0);
  const extra = Math.min(40, goldenBricks * 4 + (studs > 0 ? 5 : 0) + heroBonus + garageBonus);
  const pct = Math.round((bases / 3) * 60 + extra);
  return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
}

export function loadGameSettings() {
  const defaults = { ...DEFAULT_GAME_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const merged = { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    const sens = Number(merged.mouseSensitivity);
    merged.mouseSensitivity = Number.isFinite(sens)
      ? Math.min(2.5, Math.max(0.2, sens))
      : DEFAULT_GAME_SETTINGS.mouseSensitivity;
    const fov = Number(merged.fov);
    merged.fov = Number.isFinite(fov) ? Math.min(85, Math.max(50, fov)) : DEFAULT_GAME_SETTINGS.fov;
    merged.invertY = Boolean(merged.invertY);
    merged.killEffect = merged.killEffect !== false;
    merged.showFps = merged.showFps !== false;
    merged.damageNumbers = merged.damageNumbers !== false;
    return merged;
  } catch (e) {
    return defaults;
  }
}

export function saveGameSettings(settings) {
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* storage indisponível */ }
}
