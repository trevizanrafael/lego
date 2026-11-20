/**
 * BRASÕES HERÁLDICOS & TÁTICOS EM SVG (ESTÉTICA GOTHAM NOIR / STUDLESS),
 * SISTEMA DE SAVES EM 3 SLOTS (localStorage) E TRADUÇÃO BILÍNGUE (PT-BR / EN-US)
 */

import { createDefaultCustomHeroState } from '../entities/CustomHeroSystem.js';
import { createDefaultGarageSaveData } from '../world/StreetCustomGarage.js';

export const SAVE_STORAGE_KEY = 'lego_cdd_saves_v1';
export const SETTINGS_STORAGE_KEY = 'lego_cdd_settings_v1';

export const FACTION_DATA = {
  cv: {
    id: 'cv',
    color: '#dc2626',
    accentDark: '#7f1d1d',
    hex: 0xdc2626,
    baseSpawn: { x: -495, y: 1.5, z: -120 },
    bossName: {
      'pt-BR': 'TROVÃO RUBRO // SENHOR DA ENCOSTA',
      'en-US': 'CRIMSON THUNDER // RIDGE WARLORD'
    },
    name: {
      'pt-BR': 'COMANDO VERMELHO (CV)',
      'en-US': 'RED COMMAND (CV)'
    },
    shortName: {
      'pt-BR': 'ALIANÇA: CV',
      'en-US': 'ALLIANCE: CV'
    },
    fortress: {
      'pt-BR': 'BASTIÃO OCIDENTAL: COMPLEXO DA CIDADE DE DEUS & ENCOSTA',
      'en-US': 'WESTERN BASTION: CIDADE DE DEUS COMPLEX & RIDGE'
    },
    desc: {
      'pt-BR':
        'A encosta fortificada opera como seu reduto inviolável: sentinelas prestam continência, paramédicos restauram blindagem vital e 2 oficinas liberam Picapes Artilhadas, Motos de Assalto e SUVs Carmesim. Avance sobre os domínios do PCC ou A.R.E.S. escoltado pelo colosso "Trovão Rubro".',
      'en-US':
        'The fortified ridge stands as your stronghold: sentries salute on sight, field medics restore vitality and 2 garages deploy Gun-Trucks, Raid Bikes and Crimson Armored SUVs. Breach PCC or A.R.E.S. sectors backed by warlord "Crimson Thunder".'
    }
  },
  pcc: {
    id: 'pcc',
    color: '#3b82f6',
    accentDark: '#1e3a8a',
    hex: 0x3b82f6,
    baseSpawn: { x: 585, y: 1.5, z: -120 },
    bossName: {
      'pt-BR': 'BLINDADO SUPREMO Z-15',
      'en-US': 'SUPREME ARMOR Z-15'
    },
    name: {
      'pt-BR': 'PRIMEIRO COMANDO (PCC)',
      'en-US': 'FIRST COMMAND (PCC)'
    },
    shortName: {
      'pt-BR': 'ALIANÇA: PCC',
      'en-US': 'ALLIANCE: PCC'
    },
    fortress: {
      'pt-BR': 'BASTIÃO ORIENTAL: DISTRITO INDUSTRIAL & CIDADELA DE AÇO',
      'en-US': 'EASTERN BASTION: INDUSTRIAL DISTRICT & STEEL CITADEL'
    },
    desc: {
      'pt-BR':
        'A Cidadela Industrial Leste funciona como QG de alta precisão com 2 oficinas de SUVs Blindados, Furgões Táticos e Superbikes Cobalto. Ao cruzar as fronteiras do CV ou A.R.E.S., o sindicato mobiliza Esquadrões Fantasma, suporte médico e o "Blindado Supremo Z-15".',
      'en-US':
        'The East Industrial Citadel serves as a precision command hub with 2 garages of Ballistic SUVs, Tactical Vans and Cobalt Superbikes. Crossing into CV or A.R.E.S. turf deploys Phantom Squads, field medics and "Supreme Armor Z-15".'
    }
  },
  ares: {
    id: 'ares',
    color: '#a855f7',
    accentDark: '#581c87',
    hex: 0xa855f7,
    baseSpawn: { x: 745, y: 1.5, z: 140 },
    bossName: {
      'pt-BR': 'OVERLORD QUÂNTICO',
      'en-US': 'QUANTUM OVERLORD'
    },
    name: {
      'pt-BR': 'SYNDICATO A.R.E.S.',
      'en-US': 'A.R.E.S. SYNDICATE'
    },
    shortName: {
      'pt-BR': 'ALIANÇA: A.R.E.S.',
      'en-US': 'ALLIANCE: A.R.E.S.'
    },
    fortress: {
      'pt-BR': 'BASTIÃO PORTUÁRIO: DOCAS BLINDADAS DO SUDESTE',
      'en-US': 'PORT BASTION: SOUTHEAST ARMORED DOCKS'
    },
    desc: {
      'pt-BR':
        'As Docas Blindadas do Sudeste abrigam sua divisão cyber-militar com 2 hangares terrestres de Hover-APCs, Cyber-Blades e Interceptadores Violeta. Em incursões contra o CV ou PCC, unidades de exoesqueleto desembarcam ao lado do Mecha "Overlord Quântico".',
      'en-US':
        'The Southeast Armored Docks house your cyber-military division with 2 bays of Hover-APCs, Cyber-Blades and Violet Interceptors. Raids into CV or PCC sectors deploy exo-squads alongside the colossal Mecha "Quantum Overlord".'
    }
  }
};

export const UI_TEXTS = {
  'pt-BR': {
    subtitle: 'METRÓPOLE SOB SÍTIO // PATRULHA LIVRE & GUERRA TERRITORIAL',
    newGame: 'NOVO JOGO',
    loadGame: 'CARREGAR JOGO',
    options: 'OPÇÕES TÁTICAS',
    languageBtn: 'IDIOMA: PT-BR',
    selectSlotNew: 'SELECIONE UM REGISTRO DE MEMÓRIA PARA INICIAR NOVA OPERAÇÃO',
    selectSlotLoad: 'SELECIONE UM REGISTRO CRIPTOGRAFADO PARA RETOMAR COMANDO',
    backBtn: 'VOLTAR',
    emptySlot: 'ARQUIVO INATIVO // FIRME SUA ALIANÇA E ASSUMA O CONTROLE DA METRÓPOLE',
    startSlotBtn: 'ESCOLHER FACÇÃO & INICIAR',
    overwriteSlotBtn: 'NOVA OPERAÇÃO NESTE SLOT',
    loadSlotBtn: 'CARREGAR OPERAÇÃO',
    deleteSlotBtn: 'EXPURGAR',
    freeRoamSlotTitle: 'METRÓPOLE NOIR // PATRULHA LIVRE',
    chooseFactionTag: 'PACTO TERRITORIAL // ZONAS CIVIS SOB TRÉGUA + 3 BASTIÕES ARMADOS',
    chooseFactionTitle: 'DEFINA A ALIANÇA DO SEU OPERADOR',
    chooseFactionSub:
      'O Centro Financeiro, Banco Central, Parque, Orla e Subúrbio permanecem sob trégua civil. Seu bastião opera como QG seguro com oficinas dedicadas — a guerra territorial 1x1 irrompe apenas quando você INVADE os domínios de uma facção rival.',
    joinFactionBtn: 'ASSUMIR COMANDO DESTA FACÇÃO',
    pauseTag: 'TERMINAL DE COMANDO // OPERAÇÃO SUSPENSA [ESC]',
    pauseTitle: 'CENTRAL TÁTICA & CONTROLE DE TERRITÓRIOS',
    masterVol: 'VOLUME GERAL (MASTER)',
    musicVol: 'VOLUME DE AMBIÊNCIA & RÁDIO URBANA',
    sfxVol: 'EFEITOS BALÍSTICOS, PODERES & MOTORES',
    regionToastToggle: 'ALERTA TÁTICO DE TRANSIÇÃO DE SETOR',
    graphicsQualityLabel: 'PERFIL DE RENDERIZAÇÃO',
    graphicsModes: {
      auto: 'AUTO 60',
      low: 'BAIXO',
      medium: 'MÉDIO',
      ultra: 'ULTRA'
    },
    timeOfDayLabel: 'ATMOSFERA & HORÁRIO DA METRÓPOLE',
    timeModes: {
      auto: 'CICLO DINÂMICO (12 MIN)',
      day: 'DIA NUBLADO SOB NÉVOA (12:00)',
      sunset: 'CREPÚSCULO CARMESIM (17:45)',
      night: 'NOITE TEMPESTUOSA NOIR (22:00)'
    },
    langLabel: 'IDIOMA DO TERMINAL (LANGUAGE)',
    resumeBtn: 'RETOMAR OPERAÇÃO [ESC]',
    saveNowBtn: 'GRAVAR PROGRESSO AGORA',
    switchFactionBtn: 'ALTERAR FACÇÃO ALIADA',
    resetTerritoriesBtn: 'RESTAURAR ZONAS DE GUERRA',
    saveQuitBtn: 'GRAVAR E RETORNAR AO MENU INICIAL',
    savedFeedback: 'REGISTRO TÁTICO GRAVADO NO SLOT COM SUCESSO.',
    resetTerritoriesFeedback: 'OS 3 BASTIÕES FORAM RESTAURADOS PARA NOVA INVASÃO.',
    worldWarFront: 'METRÓPOLE NOIR // PATRULHA LIVRE',
    invasionActive: '',
    medicHealing: ''
  },
  'en-US': {
    subtitle: 'METROPOLIS UNDER SIEGE // FREE PATROL & TERRITORIAL WARFARE',
    newGame: 'NEW GAME',
    loadGame: 'LOAD GAME',
    options: 'TACTICAL OPTIONS',
    languageBtn: 'LANGUAGE: EN-US',
    selectSlotNew: 'SELECT A MEMORY DOSSIER TO LAUNCH A NEW OPERATION',
    selectSlotLoad: 'SELECT AN ENCRYPTED DOSSIER TO RESUME COMMAND',
    backBtn: 'BACK',
    emptySlot: 'INACTIVE DOSSIER // FORGE YOUR ALLIANCE & CLAIM THE METROPOLIS',
    startSlotBtn: 'CHOOSE FACTION & DEPLOY',
    overwriteSlotBtn: 'NEW OPERATION IN SLOT',
    loadSlotBtn: 'LOAD OPERATION',
    deleteSlotBtn: 'PURGE',
    freeRoamSlotTitle: 'NOIR METROPOLIS // FREE PATROL',
    chooseFactionTag: 'TERRITORIAL PACT // CIVILIAN TRUCE ZONES + 3 ARMED BASTIONS',
    chooseFactionTitle: 'SELECT YOUR OPERATOR ALLIANCE',
    chooseFactionSub:
      'Downtown, Central Bank, Park, Coastline and Suburbs remain under civilian truce. Your bastion serves as a fortified HQ with custom bays — 1v1 turf war erupts only when you INVADE a rival faction stronghold.',
    joinFactionBtn: 'TAKE COMMAND OF THIS FACTION',
    pauseTag: 'COMMAND TERMINAL // OPERATION SUSPENDED [ESC]',
    pauseTitle: 'TACTICAL SYSTEMS & TERRITORY CONTROL',
    masterVol: 'MASTER VOLUME',
    musicVol: 'URBAN AMBIENCE & RADIO VOLUME',
    sfxVol: 'BALLISTICS, POWERS & ENGINE SFX',
    regionToastToggle: 'SECTOR TRANSITION TACTICAL BANNER',
    graphicsQualityLabel: 'RENDERING PROFILE',
    graphicsModes: {
      auto: 'AUTO 60',
      low: 'LOW',
      medium: 'MEDIUM',
      ultra: 'ULTRA'
    },
    timeOfDayLabel: 'METROPOLIS ATMOSPHERE & TIME',
    timeModes: {
      auto: 'DYNAMIC CYCLE (12 MIN)',
      day: 'OVERCAST SMOG DAY (12:00)',
      sunset: 'CRIMSON DUSK (17:45)',
      night: 'NOIR STORM NIGHT (22:00)'
    },
    langLabel: 'TERMINAL LANGUAGE (IDIOMA)',
    resumeBtn: 'RESUME OPERATION [ESC]',
    saveNowBtn: 'COMMIT SAVE NOW',
    switchFactionBtn: 'SWITCH ALLIED FACTION',
    resetTerritoriesBtn: 'RESTORE WAR SECTORS',
    saveQuitBtn: 'SAVE & EXIT TO TITLE TERMINAL',
    savedFeedback: 'TACTICAL DOSSIER SAVED TO SLOT.',
    resetTerritoriesFeedback: 'ALL 3 BASTIONS RESTORED FOR NEW INVASIONS.',
    worldWarFront: 'NOIR METROPOLIS // FREE PATROL',
    invasionActive: '',
    medicHealing: ''
  }
};

/**
 * Brasão Gótico da Metrópole Sombria (Escudo Octogonal em Obsidiana, Bronze Envelhecido,
 * Carmesim Seco, Torre/Gárgula Gótica Central e Feixes de Holofote em Aço Glacial)
 */
export function getFreeRoamLogoSvg(size = 80) {
  return `
    <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
      <!-- Escudo Octogonal Chanfrado em Obsidiana & Bronze Envelhecido -->
      <polygon points="36,5 84,5 112,28 106,84 60,115 14,84 8,28" fill="#05070c" stroke="#c28e2b" stroke-width="3.5"/>
      <polygon points="39,11 81,11 105,31 100,80 60,108 20,80 15,31" fill="#0d121d" stroke="#991b1b" stroke-width="1.8"/>
      <!-- Feixes Cruzados de Holofote em Aço Glacial -->
      <polygon points="18,76 46,13 58,13 28,82" fill="#7dd3fc" opacity="0.18"/>
      <polygon points="102,76 74,13 62,13 92,82" fill="#7dd3fc" opacity="0.18"/>
      <line x1="22" y1="79" x2="52" y2="13" stroke="#7dd3fc" stroke-width="1.2" opacity="0.45"/>
      <line x1="98" y1="79" x2="68" y2="13" stroke="#7dd3fc" stroke-width="1.2" opacity="0.45"/>
      <!-- Asas / Cornijas de Gárgula Gótica nas Laterais da Torre -->
      <polygon points="22,52 43,46 47,62 30,65" fill="#182235" stroke="#c28e2b" stroke-width="1.4"/>
      <polygon points="98,52 77,46 73,62 90,65" fill="#182235" stroke="#c28e2b" stroke-width="1.4"/>
      <!-- Silhueta Imponente da Torre Gótica Central -->
      <polygon points="60,14 67,34 74,42 74,88 46,88 46,42 53,34" fill="#05070c" stroke="#c28e2b" stroke-width="2"/>
      <polygon points="38,56 46,50 46,88 38,88" fill="#090d16" stroke="#475569" stroke-width="1.3"/>
      <polygon points="82,56 74,50 74,88 82,88" fill="#090d16" stroke="#475569" stroke-width="1.3"/>
      <!-- Frestas Verticais Iluminadas em Gelo & Carmesim -->
      <rect x="58" y="38" width="4" height="16" fill="#7dd3fc"/>
      <rect x="52" y="58" width="3" height="18" fill="#c28e2b" opacity="0.85"/>
      <rect x="65" y="58" width="3" height="18" fill="#c28e2b" opacity="0.85"/>
      <!-- Divisa Heráldica Inferior Carmesim & Bronze -->
      <polygon points="34,88 86,88 78,99 60,105 42,99" fill="#991b1b" stroke="#c28e2b" stroke-width="1.8"/>
      <polygon points="60,91 66,96 60,101 54,96" fill="#7dd3fc"/>
    </svg>
  `;
}

/**
 * Brasões Táticos Sombrios Exclusivos das 3 Facções (CV, PCC, A.R.E.S.) — 100% Studless / Gotham Noir
 */
export function getFactionLogoSvg(factionKey = 'cv', size = 80) {
  if (factionKey === 'cv') {
    // COMANDO VERMELHO: Escudo Angular em Obsidiana & Vermelho-Arterial + Fuzis Cruzados em Aço Escuro + Crânio Facetado com Cicatriz Rubra + Coroa de 3 Pontas
    return `
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
        <!-- Escudo Angular de Guerra -->
        <polygon points="60,4 110,20 102,86 60,116 18,86 10,20" fill="#05070c" stroke="#dc2626" stroke-width="3.8"/>
        <polygon points="60,10 103,24 96,82 60,109 24,82 17,24" fill="#110609" stroke="#7f1d1d" stroke-width="1.8"/>
        <polygon points="60,14 96,27 90,78 60,101 30,78 24,27" fill="#7f1d1d" opacity="0.28"/>
        <!-- Fuzis de Assalto Cruzados em Aço Escuro -->
        <g stroke="#475569" stroke-width="4.2" stroke-linecap="butt">
          <line x1="20" y1="86" x2="100" y2="26"/>
          <line x1="100" y1="86" x2="20" y2="26"/>
        </g>
        <g stroke="#94a3b8" stroke-width="1.6">
          <line x1="23" y1="84" x2="97" y2="28"/>
          <line x1="97" y1="84" x2="23" y2="28"/>
        </g>
        <!-- Carregadores Curvos & Coronhas Táticas -->
        <polygon points="30,74 38,68 43,78 35,83" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
        <polygon points="90,74 82,68 77,78 85,83" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
        <!-- Coroa Pontiaguda de 3 Pontas no Topo -->
        <polygon points="41,31 45,14 54,25 60,11 66,25 75,14 79,31" fill="#991b1b" stroke="#dc2626" stroke-width="1.8"/>
        <polygon points="46,29 60,16 74,29" fill="#dc2626" opacity="0.45"/>
        <!-- Crânio Tático Facetado em Osso Sombreado (Studless) -->
        <polygon points="43,32 77,32 84,46 80,62 72,68 70,79 50,79 48,68 40,62 36,46" fill="#d1d5db" stroke="#05070c" stroke-width="2.6"/>
        <polygon points="60,32 77,32 84,46 80,62 72,68 70,79 60,79" fill="#94a3b8"/>
        <polygon points="40,56 48,64 48,69 42,62" fill="#64748b"/>
        <polygon points="80,56 72,64 72,69 78,62" fill="#475569"/>
        <!-- Cicatriz Rubra Afiada Cortando a Órbita Esquerda -->
        <polygon points="44,35 49,34 54,64 49,66" fill="#dc2626"/>
        <!-- Órbitas Negras Furiosas + Brilho Arterial -->
        <polygon points="41,47 56,51 54,59 42,56" fill="#05070c"/>
        <polygon points="79,47 64,51 66,59 78,56" fill="#05070c"/>
        <polygon points="46,52 52,53 50,56" fill="#dc2626"/>
        <polygon points="74,52 68,53 70,56" fill="#dc2626"/>
        <!-- Cavidade Nasal & Dentes Facetados -->
        <polygon points="60,57 64,65 56,65" fill="#05070c"/>
        <line x1="54" y1="70" x2="54" y2="78" stroke="#05070c" stroke-width="2.2"/>
        <line x1="60" y1="70" x2="60" y2="78" stroke="#05070c" stroke-width="2.2"/>
        <line x1="66" y1="70" x2="66" y2="78" stroke="#05070c" stroke-width="2.2"/>
        <!-- Placa Blindada CV -->
        <polygon points="39,84 81,84 77,100 43,100" fill="#05070c" stroke="#dc2626" stroke-width="2"/>
        <text x="60" y="96.5" text-anchor="middle" fill="#dc2626" font-family="Teko, sans-serif" font-size="16" font-weight="700" letter-spacing="2.5">CV</text>
      </svg>
    `;
  }

  if (factionKey === 'pcc') {
    // PRIMEIRO COMANDO (PCC): Brasão Hexagonal Blindado em Aço Abissal & Azul-Cobalto + Eclipse Metálico + Lâminas/Miras Cruzadas + Capuz/Máscara Fantasma com Visor Duplo Glacial
    return `
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
        <!-- Escudo Hexagonal Blindado -->
        <polygon points="60,4 111,28 111,86 60,116 9,86 9,28" fill="#070b14" stroke="#2563eb" stroke-width="3.8"/>
        <polygon points="60,11 104,32 104,82 60,109 16,82 16,32" fill="#0b1222" stroke="#60a5fa" stroke-width="1.4" opacity="0.85"/>
        <!-- Lâminas Táticas & Retículas de Precisão Cruzadas -->
        <polygon points="20,84 26,88 100,28 94,24" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
        <polygon points="100,84 94,88 20,28 26,24" fill="#334155" stroke="#94a3b8" stroke-width="1"/>
        <!-- Eclipse Metálico ao Fundo -->
        <circle cx="60" cy="54" r="30" fill="#050811" stroke="#2563eb" stroke-width="2.2"/>
        <path d="M60,24 A30,30 0 0,1 60,84 A23,28 0 0,0 60,24 Z" fill="#60a5fa" opacity="0.32"/>
        <line x1="60" y1="18" x2="60" y2="26" stroke="#7dd3fc" stroke-width="1.8"/>
        <line x1="24" y1="54" x2="32" y2="54" stroke="#7dd3fc" stroke-width="1.8"/>
        <line x1="88" y1="54" x2="96" y2="54" stroke="#7dd3fc" stroke-width="1.8"/>
        <!-- Capuz Angular & Máscara Fantasma Tática (Studless) -->
        <polygon points="60,24 84,36 88,62 74,80 46,80 32,62 36,36" fill="#070b14" stroke="#60a5fa" stroke-width="2"/>
        <polygon points="60,29 78,39 80,60 60,76 40,60 42,39" fill="#111a2e"/>
        <!-- Placa Respiradora Facetada -->
        <polygon points="48,58 60,53 72,58 69,75 60,79 51,75" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
        <line x1="55" y1="63" x2="55" y2="72" stroke="#60a5fa" stroke-width="1.6"/>
        <line x1="60" y1="61" x2="60" y2="74" stroke="#60a5fa" stroke-width="1.6"/>
        <line x1="65" y1="63" x2="65" y2="72" stroke="#60a5fa" stroke-width="1.6"/>
        <!-- Visor Duplo Glacial -->
        <polygon points="41,47 57,51 55,56 42,53" fill="#7dd3fc" stroke="#2563eb" stroke-width="1.2"/>
        <polygon points="79,47 63,51 65,56 78,53" fill="#7dd3fc" stroke="#2563eb" stroke-width="1.2"/>
        <!-- Placa Blindada PCC 1533 -->
        <polygon points="34,84 86,84 82,100 38,100" fill="#050811" stroke="#2563eb" stroke-width="2"/>
        <text x="60" y="96.5" text-anchor="middle" fill="#60a5fa" font-family="Teko, sans-serif" font-size="15" font-weight="700" letter-spacing="1.8">PCC 1533</text>
      </svg>
    `;
  }

  // SYNDICATO A.R.E.S.: Brasão Imperial Cyber-Militar em Titânio Negro & Violeta-Profundo + Asas de Águia Mecânica + Elmo Mecha em V + Núcleo Reator
  return `
    <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
      <!-- Escudo Imperial Cyber-Militar -->
      <polygon points="60,4 114,20 101,88 60,116 19,88 6,20" fill="#090712" stroke="#9333ea" stroke-width="3.8"/>
      <polygon points="60,11 106,24 95,84 60,109 25,84 14,24" fill="#120d22" stroke="#c084fc" stroke-width="1.4" opacity="0.85"/>
      <!-- Asas Angulares de Águia Mecânica Blindada -->
      <polygon points="10,32 42,42 38,54 16,47" fill="#1e293b" stroke="#9333ea" stroke-width="1.6"/>
      <polygon points="15,49 41,55 36,67 21,61" fill="#334155" stroke="#c084fc" stroke-width="1.3"/>
      <polygon points="110,32 78,42 82,54 104,47" fill="#1e293b" stroke="#9333ea" stroke-width="1.6"/>
      <polygon points="105,49 79,55 84,67 99,61" fill="#334155" stroke="#c084fc" stroke-width="1.3"/>
      <!-- Crista & Elmo Mecha Facetado (Studless) -->
      <polygon points="60,15 68,28 84,34 87,64 69,80 51,80 33,64 36,34 52,28" fill="#1e2436" stroke="#c084fc" stroke-width="2.2"/>
      <polygon points="60,15 68,28 84,34 87,64 69,80 60,80" fill="#0f1422" opacity="0.65"/>
      <!-- Núcleo Reator Pulsante Superior -->
      <polygon points="60,21 66,29 60,37 54,29" fill="#c084fc" stroke="#f3e8ff" stroke-width="1.3"/>
      <polygon points="60,25 63,29 60,33 57,29" fill="#7dd3fc"/>
      <!-- Visor Laser Afiado em V -->
      <polygon points="38,43 60,53 82,43 78,56 60,65 42,56" fill="#9333ea" stroke="#e9d5ff" stroke-width="1.6"/>
      <polygon points="43,47 60,55 77,47 75,52 60,60 45,52" fill="#e9d5ff"/>
      <!-- Respirador de Titânio -->
      <line x1="53" y1="68" x2="53" y2="77" stroke="#c084fc" stroke-width="2"/>
      <line x1="60" y1="67" x2="60" y2="78" stroke="#c084fc" stroke-width="2"/>
      <line x1="67" y1="68" x2="67" y2="77" stroke="#c084fc" stroke-width="2"/>
      <!-- Placa Blindada A.R.E.S. -->
      <polygon points="33,84 87,84 83,100 37,100" fill="#090712" stroke="#9333ea" stroke-width="2"/>
      <text x="60" y="96.5" text-anchor="middle" fill="#c084fc" font-family="Teko, sans-serif" font-size="15" font-weight="700" letter-spacing="2">A.R.E.S.</text>
    </svg>
  `;
}

export function loadAllSaveSlots() {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed;
    }
  } catch (e) {
    // Ignora erro de storage
  }
  return [null, null, null];
}

export function writeSaveSlot(slotIndex, data) {
  const slots = loadAllSaveSlots();
  const prev = slots[slotIndex];
  const validFaction = FACTION_DATA[data.faction] ? data.faction : 'cv';
  const customHero =
    data.customHero && typeof data.customHero === 'object'
      ? { ...data.customHero }
      : prev?.customHero && typeof prev.customHero === 'object'
        ? { ...prev.customHero }
        : createDefaultCustomHeroState();
  const customGarage =
    data.customGarage && typeof data.customGarage === 'object'
      ? JSON.parse(JSON.stringify(data.customGarage))
      : prev?.customGarage && typeof prev.customGarage === 'object'
        ? JSON.parse(JSON.stringify(prev.customGarage))
        : createDefaultGarageSaveData();
  const aircraftCustom =
    data.aircraftCustom && typeof data.aircraftCustom === 'object'
      ? JSON.parse(JSON.stringify(data.aircraftCustom))
      : prev?.aircraftCustom && typeof prev.aircraftCustom === 'object'
        ? JSON.parse(JSON.stringify(prev.aircraftCustom))
        : null;
  const radioState =
    data.radioState !== undefined
      ? data.radioState
        ? JSON.parse(JSON.stringify(data.radioState))
        : null
      : prev?.radioState && typeof prev.radioState === 'object'
        ? JSON.parse(JSON.stringify(prev.radioState))
        : null;
  slots[slotIndex] = {
    slotIndex,
    faction: validFaction,
    studs: Number(data.studs || 0),
    heroKey: data.heroKey || 'caveira',
    conqueredTerritories: Array.isArray(data.conqueredTerritories) ? data.conqueredTerritories : [],
    goldenBricks: Number(data.goldenBricks ?? prev?.goldenBricks ?? 0),
    territoryMeta:
      data.territoryMeta && typeof data.territoryMeta === 'object'
        ? JSON.parse(JSON.stringify(data.territoryMeta))
        : prev?.territoryMeta && typeof prev.territoryMeta === 'object'
          ? prev.territoryMeta
          : {},
    customHero,
    customGarage,
    aircraftCustom,
    radioState,
    updatedAt: new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  };
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(slots));
  } catch (e) {
    // Ignora erro de storage
  }
  return slots[slotIndex];
}

export function deleteSaveSlot(slotIndex) {
  const slots = loadAllSaveSlots();
  slots[slotIndex] = null;
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(slots));
  } catch (e) {
    // Ignora erro de storage
  }
  return slots;
}

export function loadGameSettings() {
  const defaults = {
    masterVolume: 0.85,
    musicVolume: 0.55,
    sfxVolume: 0.9,
    showRegionToast: true,
    graphicsQuality: 'auto',
    timeMode: 'auto',
    language: 'pt-BR'
  };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch (e) {
    return defaults;
  }
}

export function saveGameSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // Ignora erro de storage
  }
}
