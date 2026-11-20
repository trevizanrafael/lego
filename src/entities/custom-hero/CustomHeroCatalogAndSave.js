// ============================================================================
// 1. PALETAS DE CORES, CATÁLOGO 100% INÉDITO DO OPERADOR OP-09 & ESTADO POR SAVE
//    (ZERO sobreposição com peças/poderes dos 8 heróis originais!)
// ============================================================================

export const CUSTOM_HEAD_COLORS = [
  { id: 'lego_yellow', name: 'Amarelo Clássico LEGO', hex: 0xfacc15, css: '#facc15' },
  { id: 'light_skin', name: 'Pele Clara', hex: 0xfde68a, css: '#fde68a' },
  { id: 'tan_skin', name: 'Pele Morena', hex: 0xd97706, css: '#d97706' },
  { id: 'deep_skin', name: 'Pele Negra', hex: 0x78350f, css: '#78350f' },
  { id: 'ice_blue', name: 'Azul-Gelo', hex: 0x7dd3fc, css: '#7dd3fc' },
  { id: 'mutant_green', name: 'Verde-Mutante', hex: 0x4ade80, css: '#4ade80' },
  { id: 'cosmic_purple', name: 'Roxo-Cósmico', hex: 0xc084fc, css: '#c084fc' },
  { id: 'ruby_red', name: 'Vermelho-Rubi', hex: 0xf87171, css: '#f87171' },
  { id: 'synth_white', name: 'Branco-Sintético', hex: 0xf8fafc, css: '#f8fafc' },
  { id: 'robo_silver', name: 'Prata-Robô', hex: 0x94a3b8, css: '#94a3b8' }
];

export const CUSTOM_LEGO_PALETTE = [
  { id: 'blue', name: 'Azul Royal', hex: 0x2563eb, css: '#2563eb' },
  { id: 'crimson', name: 'Vermelho Vivo', hex: 0xdc2626, css: '#dc2626' },
  { id: 'emerald', name: 'Verde Esmeralda', hex: 0x16a34a, css: '#16a34a' },
  { id: 'gold', name: 'Amarelo Solar', hex: 0xeab308, css: '#eab308' },
  { id: 'orange', name: 'Laranja Vibrante', hex: 0xf97316, css: '#f97316' },
  { id: 'cyan', name: 'Ciano Neon', hex: 0x06b6d4, css: '#06b6d4' },
  { id: 'violet', name: 'Roxo Galáctico', hex: 0x9333ea, css: '#9333ea' },
  { id: 'pink', name: 'Magenta Pop', hex: 0xec4899, css: '#ec4899' },
  { id: 'white', name: 'Branco Puro', hex: 0xf8fafc, css: '#f8fafc' },
  { id: 'silver', name: 'Titânio Prata', hex: 0x94a3b8, css: '#94a3b8' },
  { id: 'dark_navy', name: 'Azul Noturno', hex: 0x1e293b, css: '#1e293b' },
  { id: 'obsidian', name: 'Preto Asfalto', hex: 0x111827, css: '#111827' },
  { id: 'brown', name: 'Castanho Couro', hex: 0x78350f, css: '#78350f' },
  { id: 'lime', name: 'Verde Limão', hex: 0x84cc16, css: '#84cc16' }
];

export const CUSTOM_FACES = [
  { id: 'classic_smile', name: 'Sorriso Clássico Confiante' },
  { id: 'aviator_shades', name: 'Óculos Escuros Aviador' },
  { id: 'tech_visor', name: 'Visor Laser Horizontal' },
  { id: 'domino_mask', name: 'Máscara Domino Vigilante' },
  { id: 'urban_goatee', name: 'Cavanhaque Urbano Estiloso' },
  { id: 'bionic_eye', name: 'Olho Biônico Cibernético' },
  { id: 'led_robot', name: 'Rosto Digital de Robô LED' },
  { id: 'elemental_eyes', name: 'Olhos Brilhantes Elementais' }
];

export const CUSTOM_HEADGEAR = [
  { id: 'none', name: 'Sem Cabelo (Pino LEGO)' },
  { id: 'classic_quiff', name: 'Topete Clássico LEGO' },
  { id: 'urban_mohawk', name: 'Moicano Urbano' },
  { id: 'afro_power', name: 'Black Power / Afro' },
  { id: 'long_hair', name: 'Cabelo Comprido' },
  { id: 'flat_cap', name: 'Boné Aba Reta' },
  { id: 'beanie', name: 'Gorro / Touca' },
  { id: 'urban_hoodie', name: 'Capuz Urbano (Hoodie)' },
  { id: 'astro_helmet', name: 'Capacete Astronauta Visor' },
  { id: 'dj_headphones', name: 'Fones Gamer / DJ' }
];

export const CUSTOM_TORSO_PRINTS = [
  { id: 'basic_shirt', name: 'Camiseta Básica Civil' },
  { id: 'open_jacket', name: 'Jaqueta Aberta c/ Camiseta' },
  { id: 'urban_hoodie_pocket', name: 'Moletom Urbano c/ Bolso' },
  { id: 'elegant_suit', name: 'Terno Elegante c/ Gravata' },
  { id: 'star_emblem', name: 'Peitoral Super-Herói Estrela' },
  { id: 'atom_emblem', name: 'Peitoral Emblema de Átomo' },
  { id: 'lab_coat', name: 'Jaleco de Cientista' },
  { id: 'futuristic_vest', name: 'Colete Utilitário Futurista' }
];

export const CUSTOM_BACK_GEAR = [
  { id: 'none', name: 'Nenhum' },
  { id: 'classic_cape', name: 'Capa Clássica LEGO' },
  { id: 'dual_jetpack', name: 'Mochila Jetpack Duplo' },
  { id: 'tech_wings', name: 'Asas Tecnológicas Angulares' },
  { id: 'urban_backpack', name: 'Mochila Urbana' }
];

export const CUSTOM_PRIMARY_POWERS = [
  {
    id: 'cryo_ray',
    name: 'RAIO CRIOGÊNICO (GELO)',
    desc: 'Dispara rajadas azul-gelo que criam cristais de gelo 3D no impacto e estilhaçam veículos!'
  },
  {
    id: 'emerald_plasma',
    name: 'ESFERAS DE PLASMA ESMERALDA',
    desc: 'Dispara orbes verdes velozes que quicam uma vez no chão e explodem em ondas esmeralda!'
  },
  {
    id: 'sonic_cannon',
    name: 'CANHÃO DE ONDA SÔNICA',
    desc: 'Dispara anéis concêntricos de som num cone largo que empurram carros e quebram tudo!'
  },
  {
    id: 'gravity_fists',
    name: 'PUNHOS GRAVITACIONAIS',
    desc: 'Combo veloz de socos energéticos dourados/roxos que arremessam carros longe!'
  }
];

export const CUSTOM_MOBILITY_POWERS = [
  {
    id: 'jetpack_boost',
    name: 'PROPULSÃO A JATO (JETPACK)',
    desc: 'Voo controlado ágil ([Espaço no ar / F]) soltando chamas azuis e laranjas duplas!'
  },
  {
    id: 'triple_acrobat',
    name: 'SALTO TRIPLO + SUPER-CORRIDA',
    desc: 'Até 3 pulos acrobáticos seguidos no ar com mortal + corrida supersônica a 31 m/s!'
  },
  {
    id: 'light_hoverboard',
    name: 'PRANCHA HOVERBOARD DE LUZ',
    desc: 'Materializa com [F] ou [Espaço no ar] uma prancha flutuante que desliza no asfalto e na água!'
  },
  {
    id: 'tactical_grapple',
    name: 'CABO DE ARPÉU TÁTICO',
    desc: 'Dispara cabo prateado veloz ([Mouse 2 / F]) para subir em prédios, viadutos e metrô!'
  }
];

export const CUSTOM_SUPER_POWERS = [
  {
    id: 'singularity_orb',
    name: 'SINGULARIDADE PORTÁTIL',
    desc: 'Lança um vórtice roxo/azul que suga carros, objetos e todos os Studs em 22m e explode!'
  },
  {
    id: 'repulsor_dome',
    name: 'ONDA REPULSORA 360° + ESCUDO',
    desc: 'Expande um domo energético da cor do herói que arremessa tudo ao redor pelos ares!'
  },
  {
    id: 'lego_meteors',
    name: 'CHUVA DE METEOROS LEGO',
    desc: 'Faz cair 5 meteoros incandescentes de blocos LEGO do céu na área onde você mira!'
  },
  {
    id: 'chrono_haste',
    name: 'ACELERAÇÃO CRONO (+75%)',
    desc: 'Por 5s, aumenta velocidade e cadência em +75% deixando clones translúcidos coloridos!'
  }
];

export function createDefaultCustomHeroState() {
  return {
    isCreated: false,
    name: 'CIDADÃO COMUM',
    headColorId: 'lego_yellow',
    faceId: 'classic_smile',
    hairId: 'none',
    hairColorId: 'brown',
    torsoPrintId: 'basic_shirt',
    torsoColorId: 'blue',
    armColorId: 'blue',
    handColorId: 'lego_yellow',
    legColorId: 'dark_navy',
    backId: 'none',
    backColorId: 'crimson',
    primaryPowerId: 'cryo_ray',
    mobilityPowerId: 'jetpack_boost',
    superPowerId: 'singularity_orb'
  };
}

let ACTIVE_CUSTOM_HERO = createDefaultCustomHeroState();

export function getActiveCustomHero() {
  return ACTIVE_CUSTOM_HERO;
}

export function setActiveCustomHero(data) {
  const def = createDefaultCustomHeroState();
  if (!data || typeof data !== 'object' || !data.isCreated) {
    ACTIVE_CUSTOM_HERO = def;
    return ACTIVE_CUSTOM_HERO;
  }
  const cleanName = String(data.name || 'GUARDIÃO NEON')
    .trim()
    .slice(0, 20)
    .toUpperCase();
  ACTIVE_CUSTOM_HERO = {
    ...def,
    ...data,
    isCreated: true,
    name: cleanName || 'GUARDIÃO NEON'
  };
  return ACTIVE_CUSTOM_HERO;
}

export function findHeadColor(id) {
  return CUSTOM_HEAD_COLORS.find((c) => c.id === id) || CUSTOM_HEAD_COLORS[0];
}

export function findPaletteColor(id, fallbackIdx = 0) {
  return (
    CUSTOM_LEGO_PALETTE.find((c) => c.id === id) ||
    CUSTOM_LEGO_PALETTE[fallbackIdx] ||
    CUSTOM_LEGO_PALETTE[0]
  );
}

/**
 * Gera dinamicamente a Ficha Tática [H] e dados da Roda [TAB] para o OP-09
 * (Cidadão Comum Civil quando `isCreated === false` vs Herói Customizado quando `isCreated === true`!)
 */
export function getOp09CatalogEntry() {
  const cfg = ACTIVE_CUSTOM_HERO;
  if (!cfg.isCreated) {
    return {
      key: 'op09',
      opCode: 'OP-09',
      shortName: 'CIDADÃO',
      name: 'CIDADÃO COMUM',
      role: 'CIVIL DA METRÓPOLE // SEM SUPERPODERES',
      accent: '#38bdf8',
      icon: 'star',
      specialty: 'Vida Civil Urbana, Direção de Todos os Veículos & Customização no Porão da Torre',
      passive:
        'Vá até o Porão Bio-Genético da Torre dos Heróis (Ala Sudeste, Y = -8.2m) e aperte [E] no Pedestal para criar seu Herói Único!',
      controls: [
        {
          key: 'MOUSE 1 / V',
          title: 'SOCO SIMPLES DE CIVIL LEGO',
          desc: 'Golpe físico básico sem poderes sobre-humanos.'
        },
        {
          key: 'E',
          title: 'DIRIGIR CARROS, MOTOS, BARCOS E METRÔ',
          desc: 'Pode dirigir qualquer veículo da metrópole livremente.'
        },
        {
          key: 'ESPAÇO',
          title: 'PULO COMUM CIVIL',
          desc: 'Salto padrão de minifigura LEGO.'
        },
        {
          key: 'SHIFT',
          title: 'CORRIDA URBANA LEVE',
          desc: 'Trote civil pelas calçadas e parques.'
        },
        {
          key: 'PORÃO [E]',
          title: 'LABORATÓRIO DA TORRE DOS HERÓIS',
          desc: 'Desça a escadaria no Saguão da Torre dos Heróis para desbloquear poderes inéditos!'
        }
      ]
    };
  }

  const pPow =
    CUSTOM_PRIMARY_POWERS.find((p) => p.id === cfg.primaryPowerId) || CUSTOM_PRIMARY_POWERS[0];
  const mPow =
    CUSTOM_MOBILITY_POWERS.find((p) => p.id === cfg.mobilityPowerId) || CUSTOM_MOBILITY_POWERS[0];
  const sPow =
    CUSTOM_SUPER_POWERS.find((p) => p.id === cfg.superPowerId) || CUSTOM_SUPER_POWERS[0];
  const torsoCol = findPaletteColor(cfg.torsoColorId, 0);

  return {
    key: 'op09',
    opCode: 'OP-09',
    shortName: cfg.name.slice(0, 11),
    name: cfg.name,
    role: 'OPERADOR BIO-GENÉTICO CUSTOMIZADO // TORRE DOS HERÓIS',
    accent: torsoCol.css,
    icon: 'star',
    specialty: `${pPow.name} • ${mPow.name} • ${sPow.name}`,
    passive: 'Herói exclusivo deste Slot de Save! Edite quando quiser no Porão da Torre dos Heróis.',
    controls: [
      { key: 'MOUSE 1', title: pPow.name, desc: pPow.desc },
      { key: 'ESPAÇO / F', title: mPow.name, desc: mPow.desc },
      { key: 'Q', title: sPow.name, desc: sPow.desc },
      {
        key: 'MOUSE 2',
        title: 'AÇÃO TÁTICA DE MOBILIDADE',
        desc: 'Ativa Arpéu, Prancha Hoverboard ou Propulsão Especial do seu kit.'
      },
      {
        key: 'E',
        title: 'VEÍCULOS & CONSOLE DO LABORATÓRIO',
        desc: 'Dirige veículos ou reabre o Criador no Porão da Torre dos Heróis.'
      },
      {
        key: 'SHIFT',
        title: 'DESLOCAMENTO ACELERADO',
        desc: 'Corrida heroica ou turbo de voo/hoverboard.'
      }
    ]
  };
}

export function getOp09MinifigPreset() {
  const cfg = ACTIVE_CUSTOM_HERO;
  const headCol = findHeadColor(cfg.isCreated ? cfg.headColorId : 'lego_yellow');
  const torsoCol = findPaletteColor(cfg.isCreated ? cfg.torsoColorId : 'blue', 0);
  const armCol = findPaletteColor(cfg.isCreated ? cfg.armColorId : 'blue', 0);
  const handCol = cfg.isCreated
    ? CUSTOM_LEGO_PALETTE.find((c) => c.id === cfg.handColorId) || headCol
    : headCol;
  const legCol = findPaletteColor(cfg.isCreated ? cfg.legColorId : 'dark_navy', 10);
  const entry = getOp09CatalogEntry();

  return {
    key: 'op09',
    name: entry.name,
    subtitle: entry.specialty,
    headColor: headCol.hex,
    torsoColor: torsoCol.hex,
    armColor: armCol.hex,
    handColor: handCol.hex,
    hipColor: legCol.hex,
    legColor: legCol.hex,
    facePreset: 'op09_custom',
    torsoPreset: 'op09_custom',
    headgear: cfg.isCreated ? cfg.hairId : 'none',
    capeColor: null,
    weapon: cfg.isCreated ? 'op09_powers' : 'none',
    fireAura: false,
    customCfg: { ...cfg }
  };
}
