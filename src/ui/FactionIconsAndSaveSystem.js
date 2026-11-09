/**
 * LOGOS VETORIAIS EXCLUSIVAS EM SVG ESTILO LEGO DAS 3 FACÇÕES DA GUERRA MUNDIAL,
 * SISTEMA DE SAVES EM 3 SLOTS (localStorage) E TRADUÇÃO BILÍNGUE (PT-BR / EN-US)
 */

export const SAVE_STORAGE_KEY = 'lego_cdd_saves_v1';
export const SETTINGS_STORAGE_KEY = 'lego_cdd_settings_v1';

export const FACTION_DATA = {
  cv: {
    id: 'cv',
    color: '#ef4444',
    accentDark: '#7f1d1d',
    hex: 0xef4444,
    baseSpawn: { x: -495, y: 1.5, z: -120 },
    bossName: {
      'pt-BR': 'TROVÃO RUBRO (COLOSSO DO MORRO)',
      'en-US': 'CRIMSON THUNDER (HILL COLOSSUS)'
    },
    name: {
      'pt-BR': 'COMANDO VERMELHO (CV)',
      'en-US': 'RED COMMAND (CV)'
    },
    shortName: {
      'pt-BR': 'ALIADO: CV',
      'en-US': 'ALLY: CV'
    },
    fortress: {
      'pt-BR': 'FORTALEZA: MORRO DA CIDADE DE DEUS (OESTE)',
      'en-US': 'FORTRESS: CIDADE DE DEUS HILL (WEST)'
    },
    desc: {
      'pt-BR':
        'Todo o exército do CV, Médicos de Combate do Morro, Artilheiros de RPG e o Boss Colossal "Trovão Rubro" são SEUS ALIADOS (lutam com você e te curam com Feixe Médico!). PCC e A.R.E.S. são seus inimigos mortais.',
      'en-US':
        'The entire CV army, Hill Combat Medics, RPG Gunners and the Colossal Boss "Crimson Thunder" are YOUR ALLIES (they fight beside you and heal you with Medi-Beams!). PCC and A.R.E.S. are your mortal enemies.'
    }
  },
  pcc: {
    id: 'pcc',
    color: '#38bdf8',
    accentDark: '#1e3a8a',
    hex: 0x38bdf8,
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
      'pt-BR': 'ALIADO: PCC',
      'en-US': 'ALLY: PCC'
    },
    fortress: {
      'pt-BR': 'FORTALEZA: DISTRITO INDUSTRIAL & CAIS (LESTE)',
      'en-US': 'FORTRESS: INDUSTRIAL DISTRICT & DOCKS (EAST)'
    },
    desc: {
      'pt-BR':
        'Todo o exército do PCC, Cientistas/Médicos Táticos, o Helicóptero de Assalto do PCC e o Boss Mecha "Blindado Supremo Z-15" são SEUS ALIADOS e te curam em combate! CV e A.R.E.S. são seus inimigos.',
      'en-US':
        'The entire PCC army, Tactical Scientist Medics, the PCC Assault Helicopter and the Mecha Boss "Supreme Armor Z-15" are YOUR ALLIES and heal you in combat! CV and A.R.E.S. are your enemies.'
    }
  },
  ares: {
    id: 'ares',
    color: '#d946ef',
    accentDark: '#581c87',
    hex: 0xd946ef,
    baseSpawn: { x: 745, y: 1.5, z: 140 },
    bossName: {
      'pt-BR': 'OVERLORD QUÂNTICO',
      'en-US': 'QUANTUM OVERLORD'
    },
    name: {
      'pt-BR': 'SYNDICATO A.R.E.S. & TROPA DE CHOQUE',
      'en-US': 'A.R.E.S. SYNDICATE & SHOCK TROOPS'
    },
    shortName: {
      'pt-BR': 'ALIADO: A.R.E.S.',
      'en-US': 'ALLY: A.R.E.S.'
    },
    fortress: {
      'pt-BR': 'FORTALEZA: PORTO MILITAR & AEROPORTA-AVIÕES',
      'en-US': 'FORTRESS: MILITARY PORT & SKY HELICARRIER'
    },
    desc: {
      'pt-BR':
        'Os Exoesqueletos Laser, Drones Curandeiros, Policiais Táticos do BOPE e o Boss Colossal "Overlord Quântico" são SEUS ALIADOS e regeneram sua armadura! CV e PCC são seus inimigos.',
      'en-US':
        'Laser Exoskeletons, Healer Drones, BOPE Tactical Police and the Colossal Boss "Quantum Overlord" are YOUR ALLIES and regenerate your armor! CV and PCC are your enemies.'
    }
  }
};

export const UI_TEXTS = {
  'pt-BR': {
    subtitle: 'MUNDO ABERTO 3D // EXPLORAÇÃO LIVRE',
    newGame: 'NOVO JOGO',
    loadGame: 'CARREGAR JOGO',
    options: 'OPÇÕES DE JOGO',
    languageBtn: 'IDIOMA: PT-BR',
    selectSlotNew: 'ESCOLHA UM SLOT DE MEMÓRIA PARA INICIAR NO MODO LIVRE',
    selectSlotLoad: 'SELECIONE UM SLOT SALVO PARA CONTINUAR SUA PARTIDA',
    backBtn: 'VOLTAR',
    emptySlot: 'SLOT VAZIO // PRONTO PARA EXPLORAÇÃO LIVRE',
    startSlotBtn: 'INICIAR MODO LIVRE',
    overwriteSlotBtn: 'NOVO JOGO NESTE SLOT',
    loadSlotBtn: 'CARREGAR PARTIDA',
    deleteSlotBtn: 'APAGAR',
    freeRoamSlotTitle: 'MUNDO ABERTO // EXPLORAÇÃO LIVRE',
    chooseFactionTag: 'SELEÇÃO DE ALIANÇA MILITAR // BACKYARD BATTLEGROUND',
    chooseFactionTitle: 'ESCOLHA SUA FACÇÃO ALIADA NA GUERRA MUNDIAL',
    chooseFactionSub:
      'Sua facção lutará ao seu lado no Centro da Metrópole, enviará Médicos de Combate para curar você e invocará Bosses Colossais aliados!',
    joinFactionBtn: 'JURAR LEALDADE & ENTRAR NA GUERRA',
    pauseTag: 'SISTEMA DE COMANDO // JOGO PAUSADO [ESC]',
    pauseTitle: 'CENTRAL DE OPÇÕES & MUNDO ABERTO',
    masterVol: 'VOLUME GERAL (MASTER)',
    musicVol: 'VOLUME DA MÚSICA DA CIDADE',
    sfxVol: 'VOLUME DE EFEITOS SONOROS (PODERES / VEÍCULOS)',
    regionToastToggle: 'AVISO DE TROCA DE REGIÃO NA TELA',
    langLabel: 'IDIOMA DA INTERFACE (LANGUAGE)',
    resumeBtn: 'CONTINUAR PARTIDA [ESC]',
    saveNowBtn: 'SALVAR JOGO AGORA',
    switchFactionBtn: 'TROCAR DE FACÇÃO ALIADA',
    saveQuitBtn: 'SALVAR E SAIR PARA O MENU INICIAL',
    savedFeedback: '✔ PROGRESSO SALVO NO SLOT COM SUCESSO!',
    worldWarFront: 'MUNDO ABERTO // EXPLORAÇÃO LIVRE',
    invasionActive: '',
    medicHealing: ''
  },
  'en-US': {
    subtitle: '3D OPEN WORLD // FREE ROAM EXPLORATION',
    newGame: 'NEW GAME',
    loadGame: 'LOAD GAME',
    options: 'GAME OPTIONS',
    languageBtn: 'LANGUAGE: EN-US',
    selectSlotNew: 'SELECT A MEMORY SLOT TO START FREE ROAM',
    selectSlotLoad: 'SELECT A SAVED SLOT TO RESUME EXPLORATION',
    backBtn: 'BACK',
    emptySlot: 'EMPTY SLOT // READY FOR FREE ROAM',
    startSlotBtn: 'START FREE ROAM',
    overwriteSlotBtn: 'NEW GAME IN THIS SLOT',
    loadSlotBtn: 'LOAD SAVE',
    deleteSlotBtn: 'DELETE',
    freeRoamSlotTitle: 'OPEN WORLD // FREE ROAM',
    chooseFactionTag: 'MILITARY ALLIANCE SELECTION // BACKYARD BATTLEGROUND',
    chooseFactionTitle: 'CHOOSE YOUR ALLIED FACTION IN THE WORLD WAR',
    chooseFactionSub:
      'Your faction will fight beside you in Downtown, send Combat Medics to heal you and deploy Allied Colossal Bosses!',
    joinFactionBtn: 'PLEDGE ALLEGIANCE & DEPLOY TO WAR',
    pauseTag: 'COMMAND SYSTEM // GAME PAUSED [ESC]',
    pauseTitle: 'OPTIONS CENTER & OPEN WORLD',
    masterVol: 'MASTER VOLUME',
    musicVol: 'CITY MUSIC VOLUME',
    sfxVol: 'SOUND EFFECTS VOLUME (POWERS / VEHICLES)',
    regionToastToggle: 'REGION TRANSITION BANNER ON SCREEN',
    langLabel: 'INTERFACE LANGUAGE (IDIOMA)',
    resumeBtn: 'RESUME GAME [ESC]',
    saveNowBtn: 'SAVE GAME NOW',
    switchFactionBtn: 'SWITCH ALLIED FACTION',
    saveQuitBtn: 'SAVE & QUIT TO TITLE SCREEN',
    savedFeedback: '✔ PROGRESS SAVED TO SLOT SUCCESSFULLY!',
    worldWarFront: 'OPEN WORLD // FREE ROAM',
    invasionActive: '',
    medicHealing: ''
  }
};

/**
 * Emblema Oficial LEGO Mundo Aberto (Escudo Dourado + Bloco LEGO 3D) para Slots de Save e Loading Screen
 */
export function getFreeRoamLogoSvg(size = 76) {
  return `
    <svg viewBox="0 0 110 110" width="${size}" height="${size}" class="faction-svg-logo">
      <polygon points="55,4 104,22 96,84 55,106 14,84 6,22" fill="#090a0d" stroke="#facc15" stroke-width="4.5"/>
      <polygon points="55,12 96,27 89,79 55,98 21,79 14,27" fill="#38bdf8" opacity="0.22"/>
      <rect x="33" y="25" width="12" height="6" fill="#facc15" stroke="#090a0d" stroke-width="2"/>
      <rect x="49" y="25" width="12" height="6" fill="#facc15" stroke="#090a0d" stroke-width="2"/>
      <rect x="65" y="25" width="12" height="6" fill="#facc15" stroke="#090a0d" stroke-width="2"/>
      <rect x="27" y="31" width="56" height="36" fill="#facc15" stroke="#090a0d" stroke-width="3.2"/>
      <text x="55" y="56" text-anchor="middle" fill="#090a0d" font-family="Teko, sans-serif" font-size="27" font-weight="700" letter-spacing="1.5">LEGO</text>
      <polygon points="55,71 59,79 68,79 61,85 64,93 55,88 46,93 49,85 42,79 51,79" fill="#38bdf8" stroke="#facc15" stroke-width="1.8"/>
    </svg>
  `;
}

/**
 * Retorna a Logo Vetorial Exclusiva em SVG de cada uma das 3 Facções (CV, PCC, A.R.E.S.)
 */
export function getFactionLogoSvg(factionKey = 'cv', size = 84) {
  if (factionKey === 'cv') {
    // COMANDO VERMELHO: Escudo Chanfrado Rubro + 2 Fuzis AK Cruzados + Coroa Dourada + Caveira LEGO de Bandana Vermelha e Juliet
    return `
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
        <polygon points="60,4 110,24 102,90 60,116 18,90 10,24" fill="#180709" stroke="#ef4444" stroke-width="4.5"/>
        <polygon points="60,11 102,28 95,85 60,108 25,85 18,28" fill="#7f1d1d" opacity="0.45"/>
        <!-- Fuzis AK Cruzados -->
        <g stroke="#facc15" stroke-width="4" stroke-linecap="square">
          <line x1="22" y1="92" x2="98" y2="26"/>
          <line x1="98" y1="92" x2="22" y2="26"/>
        </g>
        <!-- Coroa Imperial no Topo -->
        <polygon points="40,26 46,13 60,22 74,13 80,26" fill="#facc15" stroke="#090a0d" stroke-width="2"/>
        <!-- Pino Superior de Cabeça LEGO (Stud) -->
        <rect x="49" y="29" width="22" height="7" rx="2" fill="#facc15" stroke="#090a0d" stroke-width="2.5"/>
        <!-- Crânio Minifigura LEGO -->
        <rect x="35" y="35" width="50" height="44" rx="10" fill="#facc15" stroke="#090a0d" stroke-width="3"/>
        <!-- Bandana Vermelha do CV -->
        <path d="M34,47 L86,47 L86,37 L34,37 Z" fill="#ef4444" stroke="#090a0d" stroke-width="2.2"/>
        <!-- Óculos Juliet Espelhado Rubi -->
        <ellipse cx="49" cy="56" rx="10" ry="6" fill="#ef4444" stroke="#090a0d" stroke-width="2.5"/>
        <ellipse cx="71" cy="56" rx="10" ry="6" fill="#f97316" stroke="#090a0d" stroke-width="2.5"/>
        <line x1="35" y1="55" x2="85" y2="55" stroke="#090a0d" stroke-width="2.5"/>
        <!-- Dentes Cerrados -->
        <rect x="44" y="67" width="32" height="8" rx="2" fill="#ffffff" stroke="#090a0d" stroke-width="2.2"/>
        <line x1="52" y1="67" x2="52" y2="75" stroke="#090a0d" stroke-width="2"/>
        <line x1="60" y1="67" x2="60" y2="75" stroke="#090a0d" stroke-width="2"/>
        <line x1="68" y1="67" x2="68" y2="75" stroke="#090a0d" stroke-width="2"/>
        <!-- Sigla CV -->
        <rect x="42" y="84" width="36" height="16" fill="#090a0d" stroke="#ef4444" stroke-width="2"/>
        <text x="60" y="96" text-anchor="middle" fill="#ef4444" font-family="Teko, sans-serif" font-size="16" font-weight="700" letter-spacing="2">CV</text>
      </svg>
    `;
  }

  if (factionKey === 'pcc') {
    // PRIMEIRO COMANDO (PCC): Escudo Hexagonal Azul-Cobalto & Prata + Símbolo Yin-Yang Tático + Cabeça LEGO de Balaclava e Submetralhadoras
    return `
      <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
        <polygon points="60,4 112,30 112,88 60,116 8,88 8,30" fill="#071120" stroke="#38bdf8" stroke-width="4.5"/>
        <polygon points="60,12 104,34 104,84 60,108 16,84 16,34" fill="#1e3a8a" opacity="0.48"/>
        <!-- Submetralhadoras Cruzadas -->
        <g stroke="#cbd5e1" stroke-width="4" stroke-linecap="square">
          <line x1="22" y1="90" x2="98" y2="28"/>
          <line x1="98" y1="90" x2="22" y2="28"/>
        </g>
        <!-- Aro Yin-Yang Tático no Fundo -->
        <circle cx="60" cy="56" r="32" fill="#090a0d" stroke="#38bdf8" stroke-width="2.5"/>
        <path d="M60,24 A32,32 0 0,1 60,88 A16,16 0 0,1 60,56 A16,16 0 0,0 60,24 Z" fill="#1d4ed8" opacity="0.75"/>
        <!-- Pino LEGO (Stud) -->
        <rect x="49" y="25" width="22" height="7" rx="2" fill="#090a0d" stroke="#38bdf8" stroke-width="2"/>
        <!-- Cabeça LEGO com Balaclava Preta Tática -->
        <rect x="36" y="32" width="48" height="44" rx="10" fill="#090a0d" stroke="#cbd5e1" stroke-width="2.8"/>
        <rect x="38" y="40" width="44" height="5" fill="#38bdf8"/>
        <!-- Fenda dos Olhos na Balaclava -->
        <rect x="42" y="48" width="36" height="13" rx="4" fill="#facc15" stroke="#090a0d" stroke-width="2"/>
        <circle cx="51" cy="54.5" r="3.2" fill="#090a0d"/>
        <circle cx="69" cy="54.5" r="3.2" fill="#090a0d"/>
        <line x1="45" y1="50" x2="55" y2="53" stroke="#090a0d" stroke-width="2.4"/>
        <line x1="75" y1="50" x2="65" y2="53" stroke="#090a0d" stroke-width="2.4"/>
        <!-- Sigla 1533 / PCC -->
        <rect x="38" y="84" width="44" height="16" fill="#090a0d" stroke="#38bdf8" stroke-width="2"/>
        <text x="60" y="96" text-anchor="middle" fill="#38bdf8" font-family="Teko, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">PCC 1533</text>
      </svg>
    `;
  }

  // SYNDICATO A.R.E.S. & TROPA DE CHOQUE: Escudo Imperial Roxo-Neon & Ouro + Asas Cyber + Capacete Mecha com Visor em V
  return `
    <svg viewBox="0 0 120 120" width="${size}" height="${size}" class="faction-svg-logo">
      <polygon points="60,4 114,22 100,92 60,116 20,92 6,22" fill="#130722" stroke="#d946ef" stroke-width="4.5"/>
      <!-- Asas de Águia Cyber Douradas -->
      <polygon points="12,38 42,46 34,68 16,58" fill="#facc15" stroke="#090a0d" stroke-width="2"/>
      <polygon points="108,38 78,46 86,68 104,58" fill="#facc15" stroke="#090a0d" stroke-width="2"/>
      <!-- Pino LEGO Energético -->
      <rect x="49" y="24" width="22" height="7" rx="2" fill="#d946ef" stroke="#facc15" stroke-width="2"/>
      <!-- Capacete Mecha LEGO -->
      <polygon points="34,32 86,32 90,74 60,82 30,74" fill="#334155" stroke="#facc15" stroke-width="2.8"/>
      <!-- Visor Laser Roxo/Magenta em V -->
      <polygon points="38,45 60,54 82,45 78,60 60,67 42,60" fill="#d946ef" stroke="#ffffff" stroke-width="1.8"/>
      <!-- Grade Vocal -->
      <line x1="52" y1="69" x2="52" y2="77" stroke="#facc15" stroke-width="2.2"/>
      <line x1="60" y1="69" x2="60" y2="78" stroke="#facc15" stroke-width="2.2"/>
      <line x1="68" y1="69" x2="68" y2="77" stroke="#facc15" stroke-width="2.2"/>
      <!-- Sigla A.R.E.S. -->
      <rect x="34" y="84" width="52" height="16" fill="#090a0d" stroke="#d946ef" stroke-width="2"/>
      <text x="60" y="96" text-anchor="middle" fill="#facc15" font-family="Teko, sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">A.R.E.S.</text>
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
  slots[slotIndex] = {
    slotIndex,
    faction: data.faction || 'cv',
    studs: Number(data.studs || 0),
    heroKey: data.heroKey || 'caveira',
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

