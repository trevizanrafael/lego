import * as THREE from 'three';
import { getLegoMaterial, createLegoBrick, SHARED_STUD_GEO } from '../materials/LegoMaterials.js';
import { soundFX } from '../audio/SoundFX.js';

// ============================================================================
// 1. PALETAS DE CORES E CATÁLOGO 100% INÉDITO DO OPERADOR OP-09
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

// ============================================================================
// 2. TEXTURAS 2D INÉDITAS DE ROSTO, TORSO E RETRATO DA HUD / RODA [TAB]
// ============================================================================
export function drawCustomFaceDetails2D(ctx, cx, cy, scale, faceId) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  if (faceId === 'aviator_shades') {
    ctx.fillStyle = '#090a0d';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-24, -12, 20, 13, 4);
    ctx.roundRect(4, -12, 20, 13, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-26, -8);
    ctx.lineTo(26, -8);
    ctx.stroke();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 8, 10, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (faceId === 'tech_visor') {
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(-26, -12, 52, 12);
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-22, -9, 44, 6);
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-9, 11);
    ctx.lineTo(9, 11);
    ctx.stroke();
  } else if (faceId === 'domino_mask') {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(-25, -14, 50, 15, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-11, -6.5, 6, 3.5, -0.1, 0, Math.PI * 2);
    ctx.ellipse(11, -6.5, 6, 3.5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 8, 9, 0.1 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (faceId === 'urban_goatee') {
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.arc(-10, -6, 3.5, 0, Math.PI * 2);
    ctx.arc(10, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-15, -13, 10, 2.5);
    ctx.fillRect(5, -13, 10, 2.5);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 3.2;
    ctx.strokeRect(-9, 5, 18, 11);
  } else if (faceId === 'bionic_eye') {
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.arc(-10, -6, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(3, -14, 16, 16);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(11, -6, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(10, 8);
    ctx.stroke();
  } else if (faceId === 'led_robot') {
    ctx.fillStyle = '#090a0d';
    ctx.roundRect(-23, -15, 46, 29, 5);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-16, -9, 10, 7);
    ctx.fillRect(6, -9, 10, 7);
    for (let gx = -14; gx <= 10; gx += 6) {
      ctx.fillRect(gx, 4, 4, 5);
    }
  } else if (faceId === 'elemental_eyes') {
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(-11, -6, 6.5, 4.2, -0.15, 0, Math.PI * 2);
    ctx.ellipse(11, -6, 6.5, 4.2, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 9, 8.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    // classic_smile (Cidadão Comum / Sorriso Clássico LEGO!)
    ctx.fillStyle = '#090a0d';
    ctx.beginPath();
    ctx.arc(-10, -6, 3.6, 0, Math.PI * 2);
    ctx.arc(10, -6, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-11, -7.2, 1.1, 0, Math.PI * 2);
    ctx.arc(9, -7.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 4, 11, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

export function createCustomFaceTexture(cfg = ACTIVE_CUSTOM_HERO) {
  const headCol = findHeadColor(cfg.isCreated ? cfg.headColorId : 'lego_yellow');
  const faceId = cfg.isCreated ? cfg.faceId : 'classic_smile';
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = headCol.css;
    ctx.fillRect(0, 0, 256, 256);
    drawCustomFaceDetails2D(ctx, 128, 132, 2.75, faceId);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCustomTorsoTexture(cfg = ACTIVE_CUSTOM_HERO) {
  const torsoCol = findPaletteColor(cfg.isCreated ? cfg.torsoColorId : 'blue', 0);
  const printId = cfg.isCreated ? cfg.torsoPrintId : 'basic_shirt';
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = torsoCol.css;
    ctx.fillRect(0, 0, 256, 256);

    if (printId === 'basic_shirt') {
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.arc(128, 18, 34, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (printId === 'open_jacket') {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(88, 0, 80, 256);
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 6;
      ctx.strokeRect(88, -4, 80, 264);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(80, 30, 8, 200);
      ctx.fillRect(168, 30, 8, 200);
    } else if (printId === 'urban_hoodie_pocket') {
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(106, 24);
      ctx.lineTo(106, 92);
      ctx.moveTo(150, 24);
      ctx.lineTo(150, 92);
      ctx.stroke();
      ctx.fillStyle = 'rgba(9,10,13,0.28)';
      ctx.beginPath();
      ctx.moveTo(64, 152);
      ctx.lineTo(192, 152);
      ctx.lineTo(208, 232);
      ctx.lineTo(48, 232);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (printId === 'elegant_suit') {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(92, 0);
      ctx.lineTo(164, 0);
      ctx.lineTo(128, 138);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(120, 14);
      ctx.lineTo(136, 14);
      ctx.lineTo(142, 118);
      ctx.lineTo(128, 138);
      ctx.lineTo(114, 118);
      ctx.closePath();
      ctx.fill();
    } else if (printId === 'star_emblem') {
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 58 : 25;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const px = 128 + Math.cos(a) * r;
        const py = 112 + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 218, 256, 26);
    } else if (printId === 'atom_emblem') {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 6;
      for (const rot of [0, Math.PI / 3, -Math.PI / 3]) {
        ctx.save();
        ctx.translate(128, 112);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 56, 20, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(128, 112, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (printId === 'lab_coat') {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(92, 0, 72, 256);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 92, 256);
      ctx.fillRect(164, 0, 92, 256);
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 5;
      ctx.strokeRect(22, 130, 52, 62);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(32, 118, 8, 14);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(46, 118, 8, 14);
    } else if (printId === 'futuristic_vest') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(28, 20, 200, 216);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.strokeRect(32, 24, 192, 208);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(98, 66, 60, 42);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(46, 152, 46, 56);
      ctx.fillRect(164, 152, 46, 56);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Desenha o Retrato 2D LEGO exato do OP-09 (Cidadão Comum ou Herói Customizado)
 */
export function drawOp09Portrait2D(ctx, w, h, cfg = ACTIVE_CUSTOM_HERO) {
  const isCreated = Boolean(cfg?.isCreated);
  const headCol = findHeadColor(isCreated ? cfg.headColorId : 'lego_yellow');
  const torsoCol = findPaletteColor(isCreated ? cfg.torsoColorId : 'blue', 0);
  const hairCol = findPaletteColor(isCreated ? cfg.hairColorId : 'brown', 12);
  const hairId = isCreated ? cfg.hairId : 'none';
  const faceId = isCreated ? cfg.faceId : 'classic_smile';

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0d1017';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = Math.max(3, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.75);
  ctx.lineTo(w * 0.75, 0);
  ctx.stroke();

  const scale = w / 76;
  ctx.save();
  ctx.scale(scale, scale);

  // Pino LEGO superior
  if (hairId === 'none' || hairId === 'dj_headphones') {
    ctx.fillStyle = headCol.css;
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(76 * 0.37, 9, 76 * 0.26, 9, 2);
    ctx.fill();
    ctx.stroke();
  }

  // Cabelo comprido / capuz por trás
  if (hairId === 'long_hair' || hairId === 'urban_hoodie') {
    ctx.fillStyle = hairCol.css;
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(11, 11, 54, 46, 10);
    ctx.fill();
    ctx.stroke();
  }

  // Cabeça LEGO
  ctx.fillStyle = headCol.css;
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(76 * 0.22, 17, 76 * 0.56, 38, 6);
  ctx.fill();
  ctx.stroke();

  // Ombros / Torso
  ctx.fillStyle = torsoCol.css;
  ctx.beginPath();
  ctx.roundRect(76 * 0.14, 54, 76 * 0.72, 24, 4);
  ctx.fill();
  ctx.stroke();

  // Rosto 2D
  drawCustomFaceDetails2D(ctx, 38, 37, 0.78, faceId);

  // Cabelo / Acessório Superior 2D
  ctx.fillStyle = hairCol.css;
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2.2;
  if (hairId === 'classic_quiff') {
    ctx.beginPath();
    ctx.roundRect(15, 10, 46, 12, 5);
    ctx.fill();
    ctx.stroke();
  } else if (hairId === 'urban_mohawk') {
    ctx.fillRect(32, 4, 12, 16);
    ctx.strokeRect(32, 4, 12, 16);
  } else if (hairId === 'afro_power') {
    ctx.beginPath();
    ctx.arc(38, 22, 25, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.stroke();
  } else if (hairId === 'flat_cap') {
    ctx.fillRect(16, 10, 44, 11);
    ctx.strokeRect(16, 10, 44, 11);
    ctx.fillRect(14, 19, 52, 4);
  } else if (hairId === 'beanie') {
    ctx.beginPath();
    ctx.roundRect(15, 8, 46, 15, 7);
    ctx.fill();
    ctx.stroke();
  } else if (hairId === 'astro_helmet') {
    ctx.strokeStyle = hairCol.css;
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 11, 48, 44);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.48)';
    ctx.fillRect(19, 22, 38, 20);
  } else if (hairId === 'dj_headphones') {
    ctx.strokeStyle = hairCol.css;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(38, 30, 25, Math.PI, 0);
    ctx.stroke();
    ctx.fillRect(10, 25, 7, 16);
    ctx.fillRect(59, 25, 7, 16);
  }

  ctx.restore();
}

// ============================================================================
// 3. PEÇAS 3D INÉDITAS DE CABEÇA, COSTAS E PRANCHA HOVERBOARD NA MINIFIGURA
// ============================================================================
export function attachOp09CustomRigToMinifigure(minifig, cfg = ACTIVE_CUSTOM_HERO) {
  const isCreated = Boolean(cfg?.isCreated);
  const hairId = isCreated ? cfg.hairId : 'none';
  const hairCol = findPaletteColor(isCreated ? cfg.hairColorId : 'brown', 12);
  const backId = isCreated ? cfg.backId : 'none';
  const backCol = findPaletteColor(isCreated ? cfg.backColorId : 'crimson', 1);
  const torsoCol = findPaletteColor(isCreated ? cfg.torsoColorId : 'blue', 0);

  const hairMat = getLegoMaterial(hairCol.hex, { roughness: 0.25, clearcoat: 0.4 });
  const backMat = getLegoMaterial(backCol.hex, { roughness: 0.25, clearcoat: 0.4 });
  const darkMat = getLegoMaterial(0x111827, { roughness: 0.3 });

  // 3.1 Cabelos e Acessórios de Cabeça 100% Exclusivos
  if (minifig.headGroup && hairId !== 'none') {
    const hg = new THREE.Group();
    if (hairId === 'classic_quiff') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.78), hairMat);
      top.position.set(0, 0.62, 0.03);
      const wave = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.26), hairMat);
      wave.position.set(0, 0.69, 0.32);
      wave.rotation.x = -0.25;
      hg.add(top, wave);
    } else if (hairId === 'urban_mohawk') {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), hairMat);
        spike.position.set(0, 0.72 - i * 0.03, 0.24 - i * 0.14);
        spike.rotation.x = -i * 0.12;
        hg.add(spike);
      }
    } else if (hairId === 'afro_power') {
      const afro = new THREE.Mesh(new THREE.SphereGeometry(0.54, 18, 14), hairMat);
      afro.position.set(0, 0.56, -0.03);
      hg.add(afro);
    } else if (hairId === 'long_hair') {
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.78), hairMat);
      crown.position.set(0, 0.62, 0);
      const backLocks = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.72, 0.24), hairMat);
      backLocks.position.set(0, 0.32, -0.3);
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, 0.55), hairMat);
      sideL.position.set(-0.37, 0.36, -0.05);
      const sideR = sideL.clone();
      sideR.position.x = 0.37;
      hg.add(crown, backLocks, sideL, sideR);
    } else if (hairId === 'flat_cap') {
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.39, 0.24, 18), hairMat);
      dome.position.set(0, 0.6, 0);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.42), hairMat);
      brim.position.set(0, 0.5, 0.32);
      hg.add(dome, brim);
    } else if (hairId === 'beanie') {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
        hairMat
      );
      cap.position.set(0, 0.46, 0);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.14, 18), hairMat);
      cuff.position.set(0, 0.52, 0);
      hg.add(cap, cuff);
    } else if (hairId === 'urban_hoodie') {
      const hoodOuter = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.72, 0.82), hairMat);
      hoodOuter.position.set(0, 0.38, -0.06);
      hg.add(hoodOuter);
    } else if (hairId === 'astro_helmet') {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.47, 20, 16), hairMat);
      shell.position.set(0, 0.36, 0);
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.32, 0.22),
        new THREE.MeshPhysicalMaterial({
          color: 0x38bdf8,
          roughness: 0.08,
          metalness: 0.35,
          transparent: true,
          opacity: 0.62
        })
      );
      visor.position.set(0, 0.36, 0.36);
      hg.add(shell, visor);
    } else if (hairId === 'dj_headphones') {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.41, 0.05, 8, 20, Math.PI),
        hairMat
      );
      arch.position.set(0, 0.36, 0);
      const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), hairMat);
      earL.rotation.z = Math.PI / 2;
      earL.position.set(-0.4, 0.34, 0);
      const earR = earL.clone();
      earR.position.x = 0.4;
      hg.add(arch, earL, earR);
    }
    minifig.headGroup.add(hg);
  }

  // 3.2 Acessórios de Costas 100% Exclusivos (+ Chamas de Jetpack se aplicável)
  minifig.op09JetFlames = [];
  const wantsJetpackMesh =
    backId === 'dual_jetpack' || (isCreated && cfg.mobilityPowerId === 'jetpack_boost' && backId === 'none');

  if (minifig.upperBodyGroup && (backId !== 'none' || wantsJetpackMesh)) {
    const bg = new THREE.Group();
    if (backId === 'classic_cape') {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.16, 0.04), backMat);
      cape.position.set(0, 0.2, -0.25);
      cape.rotation.x = 0.14;
      bg.add(cape);
    } else if (backId === 'dual_jetpack' || wantsJetpackMesh) {
      const pack = createLegoBrick(0.64, 0.54, 0.24, backCol.hex, { studs: false });
      pack.position.set(0, 0.42, -0.32);
      bg.add(pack);
      const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      for (const sx of [-0.2, 0.2]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.58, 12), darkMat);
        cyl.position.set(sx, 0.4, -0.36);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 10), flameMat);
        flame.rotation.x = Math.PI;
        flame.position.set(sx, -0.05, -0.36);
        flame.visible = false;
        minifig.op09JetFlames.push(flame);
        bg.add(cyl, flame);
      }
    } else if (backId === 'tech_wings') {
      for (const s of [-1, 1]) {
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.26, 0.07), backMat);
        w1.position.set(s * 0.62, 0.54, -0.28);
        w1.rotation.z = s * 0.32;
        const w2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.16, 0.05),
          new THREE.MeshBasicMaterial({ color: 0x00f0ff })
        );
        w2.position.set(s * 0.55, 0.32, -0.29);
        w2.rotation.z = s * 0.15;
        bg.add(w1, w2);
      }
    } else if (backId === 'urban_backpack') {
      const bag = createLegoBrick(0.62, 0.62, 0.28, backCol.hex, { studStep: 0.3 });
      bag.position.set(0, 0.4, -0.34);
      bg.add(bag);
    }
    minifig.upperBodyGroup.add(bg);
  }

  // 3.3 Emissores Energéticos Discretos nas Mãos & Prancha Hoverboard de Luz (oculta até ativar!)
  if (isCreated) {
    const glowHex =
      cfg.primaryPowerId === 'cryo_ray'
        ? 0x38bdf8
        : cfg.primaryPowerId === 'emerald_plasma'
          ? 0x22c55e
          : cfg.primaryPowerId === 'sonic_cannon'
            ? 0x00f0ff
            : 0xfacc15;
    const cuffMat = new THREE.MeshBasicMaterial({ color: glowHex });
    for (const handG of [minifig.leftHandGroup, minifig.rightHandGroup]) {
      if (!handG) continue;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 14), cuffMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -0.46, 0);
      handG.add(ring);
    }

    // Prancha Hoverboard LEGO sob os pés (visível quando Hoverboard ativo!)
    const boardGroup = new THREE.Group();
    const deck = createLegoBrick(0.95, 0.12, 2.15, torsoCol.hex, { studStep: 0.45 });
    const neonRim = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.06, 2.22),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    boardGroup.add(deck, neonRim);
    boardGroup.position.set(0, -0.06, 0);
    boardGroup.visible = false;
    minifig.visualRoot.add(boardGroup);
    minifig.op09Hoverboard = boardGroup;
  } else {
    minifig.op09Hoverboard = null;
  }
}

// ============================================================================
// 4. MOTOR EM TEMPO REAL DOS 12 PODERES EXCLUSIVOS DO OP-09 (60 FPS)
// ============================================================================
export class CustomHeroPowerRuntime {
  constructor(controller) {
    this.controller = controller;
    this.world = controller.world;
    this.scene = controller.world.scene;
    this.destructibles = controller.destructibles;

    this.projectiles = [];
    this.iceCrystals = [];
    this.expandingRings = [];
    this.singularities = [];
    this.meteors = [];
    this.afterimages = [];

    this.airJumpCount = 0;
    this.hoverboardActive = false;
    this.chronoTimer = 0;
    this.chronoCloneTick = 0;
    this.shieldTimer = 0;
    this.superCooldown = 0;

    const shieldGeo = new THREE.SphereGeometry(1.35, 18, 14);
    this.shieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      wireframe: true
    });
    this.personalShieldMesh = new THREE.Mesh(shieldGeo, this.shieldMat);
    this.personalShieldMesh.visible = false;
    this.scene.add(this.personalShieldMesh);
  }

  onHeroSwitched(newHeroKey) {
    if (newHeroKey !== 'op09') {
      this.hoverboardActive = false;
      this.chronoTimer = 0;
      this.shieldTimer = 0;
      this.personalShieldMesh.visible = false;
    }
  }

  getSpeedMultiplier() {
    if (this.controller.minifigure?.currentHeroKey !== 'op09') return 1.0;
    const cfg = ACTIVE_CUSTOM_HERO;
    if (!cfg.isCreated) return 1.0;
    let mult = 1.0;
    if (cfg.mobilityPowerId === 'triple_acrobat' && this.controller.keys.sprint) {
      mult = Math.max(mult, 2.2); // ~31 m/s Super-Corrida!
    }
    if (this.hoverboardActive && cfg.mobilityPowerId === 'light_hoverboard') {
      mult = Math.max(mult, 2.45); // ~34 m/s Hoverboard!
    }
    if (this.chronoTimer > 0) {
      mult *= 1.75; // +75% Hiper-Velocidade Crono!
    }
    return mult;
  }

  firePrimary(aimPoint) {
    const cfg = ACTIVE_CUSTOM_HERO;
    const c = this.controller;

    // CIDADÃO COMUM (isCreated === false): Apenas soco simples civil!
    if (!cfg.isCreated) {
      c.primaryCooldown = 0.34;
      c.minifigure.triggerPunch();
      this.destructibles?.performMeleeAttack(c.position, c.facingAngle, 2.5, 18);
      return;
    }

    const hasteMult = this.chronoTimer > 0 ? 0.57 : 1.0;
    const origin = new THREE.Vector3(
      c.position.x + Math.sin(c.facingAngle) * 0.95,
      c.position.y + 1.32,
      c.position.z + Math.cos(c.facingAngle) * 0.95
    );
    const dir = aimPoint.clone().sub(origin).normalize();

    if (cfg.primaryPowerId === 'cryo_ray') {
      c.primaryCooldown = 0.17 * hasteMult;
      c.minifigure.triggerShoot();
      soundFX.playHeroSwap();
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
      );
      mesh.scale.set(0.8, 0.8, 2.2);
      mesh.position.copy(origin);
      mesh.lookAt(aimPoint);
      this.scene.add(mesh);
      this.projectiles.push({
        kind: 'cryo',
        mesh,
        vel: dir.multiplyScalar(64),
        life: 1.4,
        bounced: false
      });
    } else if (cfg.primaryPowerId === 'emerald_plasma') {
      c.primaryCooldown = 0.22 * hasteMult;
      c.minifigure.triggerShoot();
      soundFX.playPlasticHit();
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0x4ade80 })
      );
      mesh.position.copy(origin);
      this.scene.add(mesh);
      const arcVel = dir.multiplyScalar(48);
      arcVel.y += 3.5;
      this.projectiles.push({
        kind: 'emerald',
        mesh,
        vel: arcVel,
        life: 2.2,
        bounced: false
      });
    } else if (cfg.primaryPowerId === 'sonic_cannon') {
      c.primaryCooldown = 0.28 * hasteMult;
      c.minifigure.triggerShoot();
      soundFX.playTacticalRoll();
      for (let r = 0; r < 2; r++) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: r === 0 ? 0x00f0ff : 0xf8fafc,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.55 + r * 0.25, 0.08, 8, 20), ringMat);
        ringMesh.position.copy(origin).addScaledVector(dir, r * 0.9);
        ringMesh.lookAt(aimPoint);
        this.scene.add(ringMesh);
        this.projectiles.push({
          kind: 'sonic',
          mesh: ringMesh,
          mat: ringMat,
          vel: dir.clone().multiplyScalar(54),
          life: 0.65,
          scaleRate: 5.5
        });
      }
      this._damageConeAhead(c.position, c.facingAngle, 15.0, 75, true);
    } else {
      // gravity_fists: Combo veloz de socos gravitacionais dourados/roxos!
      c.primaryCooldown = 0.21 * hasteMult;
      c.minifigure.triggerPunch();
      soundFX.playLegoBreak(false);
      this._spawnExpandingRing(origin, 0xc084fc, 8.5, 0.35);
      this._damageConeAhead(c.position, c.facingAngle, 8.5, 115, true);
    }
  }

  handleSpacePress(deltaTap) {
    const cfg = ACTIVE_CUSTOM_HERO;
    const c = this.controller;

    if (!cfg.isCreated) {
      if (c.isGrounded) {
        c.velocity.y = c.jumpForce;
        c.isGrounded = false;
      }
      return true;
    }

    if (cfg.mobilityPowerId === 'jetpack_boost') {
      if (c.isFlying) {
        c.velocity.y = Math.max(c.velocity.y, 18.0);
      } else if (!c.isGrounded || deltaTap < 380) {
        c.isFlying = true;
        c.isGrounded = false;
        c.position.y += 0.7;
        c.velocity.y = 14.5;
        soundFX.playTacticalRoll();
      } else {
        c.velocity.y = c.jumpForce;
        c.isGrounded = false;
      }
      return true;
    }

    if (cfg.mobilityPowerId === 'triple_acrobat') {
      if (c.isGrounded) {
        this.airJumpCount = 1;
        c.velocity.y = c.jumpForce * 1.15;
        c.isGrounded = false;
      } else if (this.airJumpCount < 3) {
        this.airJumpCount++;
        c.velocity.y = c.jumpForce * 1.22;
        c.minifigure.triggerTacticalRoll?.();
        soundFX.playTacticalRoll();
        this._spawnExpandingRing(c.position, 0x38bdf8, 3.2, 0.28);
      }
      return true;
    }

    if (cfg.mobilityPowerId === 'light_hoverboard') {
      if (c.isGrounded && !this.hoverboardActive && deltaTap >= 380) {
        c.velocity.y = c.jumpForce;
        c.isGrounded = false;
      } else {
        this.hoverboardActive = !this.hoverboardActive;
        if (this.hoverboardActive) {
          c.position.y += 0.35;
          c.velocity.y = Math.max(c.velocity.y, 6.0);
        }
        soundFX.playHeroSwap();
      }
      return true;
    }

    if (cfg.mobilityPowerId === 'tactical_grapple') {
      if (c.isGrounded) {
        c.velocity.y = c.jumpForce;
        c.isGrounded = false;
      } else {
        c._triggerSombraGrapple?.();
      }
      return true;
    }
    return false;
  }

  triggerMobilityKey() {
    const cfg = ACTIVE_CUSTOM_HERO;
    const c = this.controller;
    if (!cfg.isCreated) return;

    if (cfg.mobilityPowerId === 'jetpack_boost') {
      c.isFlying = !c.isFlying;
      c.isSupersonic = false;
      if (c.isFlying) {
        c.isGrounded = false;
        c.position.y += 0.75;
        c.velocity.y = 13.0;
      }
      soundFX.playTacticalRoll();
    } else if (cfg.mobilityPowerId === 'light_hoverboard') {
      this.hoverboardActive = !this.hoverboardActive;
      soundFX.playHeroSwap();
    } else if (cfg.mobilityPowerId === 'tactical_grapple') {
      c._triggerSombraGrapple?.();
    } else if (cfg.mobilityPowerId === 'triple_acrobat') {
      c._triggerTacticalRoll?.();
    }
  }

  triggerSuperAbility() {
    const cfg = ACTIVE_CUSTOM_HERO;
    const c = this.controller;
    if (!cfg.isCreated || this.superCooldown > 0) return;

    this.superCooldown = 2.8;
    const aimData = this.destructibles.getAimTargetPoint(c.camera, 65);
    const torsoHex = findPaletteColor(cfg.torsoColorId, 0).hex;

    if (cfg.superPowerId === 'singularity_orb') {
      soundFX.playTrueHeroFanfare();
      const spawnPos = c.position
        .clone()
        .add(new THREE.Vector3(Math.sin(c.facingAngle) * 9, 2.2, Math.cos(c.facingAngle) * 9));
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1.35, 18, 14),
        new THREE.MeshBasicMaterial({ color: 0x1e1b4b })
      );
      const accretion = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.28, 10, 28),
        new THREE.MeshBasicMaterial({ color: 0xa855f7 })
      );
      accretion.rotation.x = Math.PI / 2.3;
      const group = new THREE.Group();
      group.add(core, accretion);
      group.position.copy(spawnPos);
      this.scene.add(group);
      this.singularities.push({ group, accretion, pos: spawnPos, timer: 2.35 });
    } else if (cfg.superPowerId === 'repulsor_dome') {
      soundFX.playLegoBreak(true);
      this.shieldTimer = 4.5;
      this._spawnExpandingRing(c.position.clone().add(new THREE.Vector3(0, 1.0, 0)), torsoHex, 22.0, 0.55);
      this._damageRadius(c.position, 19.0, 185, true);
    } else if (cfg.superPowerId === 'lego_meteors') {
      soundFX.playTrueHeroFanfare();
      const center = aimData.point.clone();
      const groundY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(center.x, center.z) : 0;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const rad = i === 0 ? 0 : 5.5;
        const tx = center.x + Math.cos(ang) * rad;
        const tz = center.z + Math.sin(ang) * rad;
        const meteor = createLegoBrick(1.8, 1.8, 1.8, i % 2 === 0 ? 0xf97316 : 0xef4444, { studStep: 0.6 });
        meteor.position.set(tx - 8, groundY + 34 + i * 7, tz - 6);
        this.scene.add(meteor);
        this.meteors.push({
          mesh: meteor,
          target: new THREE.Vector3(tx, groundY + 0.5, tz),
          speed: 44.0
        });
      }
    } else if (cfg.superPowerId === 'chrono_haste') {
      soundFX.playHeroSwap();
      this.chronoTimer = 5.0;
      this._spawnExpandingRing(c.position, 0x00f0ff, 10.0, 0.4);
    }
  }

  _damageConeAhead(origin, yaw, maxDist, damage, knockCars = false) {
    if (!this.destructibles) return;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    for (const obj of this.destructibles.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.mesh.position.x - origin.x;
      const dz = obj.mesh.position.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > maxDist || d < 0.01) continue;
      const dot = (dx * fx + dz * fz) / d;
      if (dot > 0.38) {
        this.destructibles.damageObject(obj, damage, origin, false, {
          canBreakCrackedWall: knockCars
        });
      }
    }
  }

  _damageRadius(center, radius, damage, canBreakHeavy = false) {
    if (!this.destructibles) return;
    for (const obj of this.destructibles.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.mesh.position.x - center.x, obj.mesh.position.z - center.z);
      if (d <= radius) {
        this.destructibles.damageObject(obj, damage, center, false, {
          canBreakCrackedWall: canBreakHeavy,
          canBreakSilver: canBreakHeavy
        });
      }
    }
  }

  _spawnExpandingRing(pos, hex, maxScale = 12.0, duration = 0.45) {
    const mat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const geo = new THREE.RingGeometry(0.65, 1.05, 24);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.25, pos.z);
    this.scene.add(mesh);
    this.expandingRings.push({ mesh, mat, life: duration, maxLife: duration, maxScale });
  }

  _spawnIceCrystalCluster(pos) {
    const group = new THREE.Group();
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.1,
      transparent: true,
      opacity: 0.82
    });
    for (let i = 0; i < 3; i++) {
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.65, 5), iceMat);
      shard.position.set((i - 1) * 0.42, 0.75, (i % 2) * 0.25);
      shard.rotation.z = (i - 1) * 0.28;
      group.add(shard);
    }
    group.position.set(pos.x, pos.y, pos.z);
    this.scene.add(group);
    this.iceCrystals.push({ group, mat: iceMat, life: 2.2 });
  }

  update(dt) {
    const c = this.controller;
    const mf = c.minifigure;
    const isOp09 = mf?.currentHeroKey === 'op09';
    const cfg = ACTIVE_CUSTOM_HERO;

    if (this.superCooldown > 0) this.superCooldown = Math.max(0, this.superCooldown - dt);

    if (isOp09 && c.isGrounded) {
      this.airJumpCount = 0;
    }

    // Chamas duplas do Jetpack e Flutuação da Prancha Hoverboard (inclusive sobre a água!)
    if (isOp09 && mf.op09JetFlames) {
      const showJet = Boolean(cfg.isCreated && c.isFlying);
      for (const fl of mf.op09JetFlames) {
        fl.visible = showJet;
        if (showJet) fl.scale.y = 0.8 + Math.random() * 0.5;
      }
    }

    if (isOp09 && mf.op09Hoverboard) {
      const showBoard = Boolean(cfg.isCreated && this.hoverboardActive && !c.currentVehicle);
      mf.op09Hoverboard.visible = showBoard;
      if (showBoard) {
        const waterHere = this.world.isDeepWaterAt?.(c.position.x, c.position.z, { forCar: true });
        if (waterHere) {
          const wy = (this.world.getWaterSurfaceY?.(c.position.x, c.position.z) ?? -0.4) + 0.45;
          if (c.position.y <= wy + 0.25) {
            c.position.y = wy;
            c.velocity.y = Math.max(0, c.velocity.y);
            c.isGrounded = true;
          }
        }
      }
    }

    // Escudo Pessoal 360° e Clones Translúcidos da Aceleração Crono
    if (this.shieldTimer > 0 && isOp09) {
      this.shieldTimer -= dt;
      this.personalShieldMesh.visible = this.shieldTimer > 0;
      this.personalShieldMesh.position.set(c.position.x, c.position.y + 1.05, c.position.z);
      this.personalShieldMesh.rotation.y += dt * 2.5;
      this.shieldMat.opacity = 0.35;
    } else {
      this.personalShieldMesh.visible = false;
    }

    if (this.chronoTimer > 0 && isOp09) {
      this.chronoTimer -= dt;
      this.chronoCloneTick -= dt;
      if (this.chronoCloneTick <= 0 && c.getHorizontalSpeed() > 2.0) {
        this.chronoCloneTick = 0.085;
        const cloneHex = findPaletteColor(cfg.torsoColorId, 0).hex;
        const ghostMat = new THREE.MeshBasicMaterial({
          color: cloneHex,
          transparent: true,
          opacity: 0.52
        });
        const ghost = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.85, 0.48), ghostMat);
        ghost.position.set(c.position.x, c.position.y + 0.95, c.position.z);
        ghost.rotation.y = c.facingAngle;
        this.scene.add(ghost);
        this.afterimages.push({ mesh: ghost, mat: ghostMat, life: 0.38 });
      }
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.life -= dt;
      a.mat.opacity = Math.max(0, a.life * 1.3);
      if (a.life <= 0) {
        this.scene.remove(a.mesh);
        this.afterimages.splice(i, 1);
      }
    }

    // Projéteis (Raio Criogênico, Plasma Esmeralda Quicante e Onda Sônica)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.kind === 'emerald') {
        p.vel.y -= 24.0 * dt;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.scaleRate) {
        p.mesh.scale.addScalar(p.scaleRate * dt);
        if (p.mat) p.mat.opacity = Math.max(0, p.life * 1.3);
      }

      const pos = p.mesh.position;
      const gY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(pos.x, pos.z) : 0;

      if (p.kind === 'emerald' && pos.y <= gY + 0.35) {
        if (!p.bounced) {
          // Quica 1 vez no chão!
          p.bounced = true;
          pos.y = gY + 0.36;
          p.vel.y = Math.abs(p.vel.y) * 0.72 + 5.0;
          this._spawnExpandingRing(pos, 0x4ade80, 4.5, 0.25);
        } else {
          this._spawnExpandingRing(pos, 0x22c55e, 9.5, 0.38);
          this._damageRadius(pos, 7.5, 110, true);
          soundFX.playLegoBreak(false);
          p.life = 0;
        }
      } else if (p.kind === 'cryo' && pos.y <= gY + 0.25) {
        this._spawnIceCrystalCluster(new THREE.Vector3(pos.x, gY, pos.z));
        this._damageRadius(pos, 5.5, 90, false);
        p.life = 0;
      }

      if (p.life > 0 && p.kind !== 'sonic' && this.destructibles) {
        for (const obj of this.destructibles.objects) {
          if (obj.destroyed || obj.isDriven || obj.isAlliedToPlayer) continue;
          const d = Math.hypot(obj.mesh.position.x - pos.x, obj.mesh.position.z - pos.z);
          if (d <= obj.radius + 0.85 && Math.abs(pos.y - (obj.mesh.position.y + 1.0)) < 2.2) {
            this.destructibles.damageObject(obj, 95, pos, false, { canBreakCrackedWall: true });
            if (p.kind === 'cryo') {
              this._spawnIceCrystalCluster(new THREE.Vector3(pos.x, obj.groundY || gY, pos.z));
            } else {
              this._spawnExpandingRing(pos, 0x22c55e, 7.5, 0.32);
            }
            p.life = 0;
            break;
          }
        }
      }

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Cristais de Gelo 3D temporários
    for (let i = this.iceCrystals.length - 1; i >= 0; i--) {
      const ic = this.iceCrystals[i];
      ic.life -= dt;
      ic.mat.opacity = Math.min(0.82, Math.max(0, ic.life * 0.6));
      if (ic.life <= 0) {
        this.scene.remove(ic.group);
        this.iceCrystals.splice(i, 1);
      }
    }

    // Anéis Expansivos
    for (let i = this.expandingRings.length - 1; i >= 0; i--) {
      const r = this.expandingRings[i];
      r.life -= dt;
      const u = 1.0 - Math.max(0, r.life / r.maxLife);
      r.mesh.scale.setScalar(1.0 + u * r.maxScale);
      r.mat.opacity = (1.0 - u) * 0.85;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        this.expandingRings.splice(i, 1);
      }
    }

    // Singularidades / Buracos Negros Portáteis (sugam objetos, carros e Studs num raio de 22m!)
    for (let i = this.singularities.length - 1; i >= 0; i--) {
      const sg = this.singularities[i];
      sg.timer -= dt;
      sg.accretion.rotation.z += dt * 9.0;

      if (this.destructibles) {
        for (const obj of this.destructibles.objects) {
          if (obj.destroyed || obj.isDriven || obj.goldOnly || obj.type === 'bank_vault_door') continue;
          const dx = sg.pos.x - obj.mesh.position.x;
          const dz = sg.pos.z - obj.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 22.0 && d > 1.4) {
            obj.mesh.position.x += (dx / d) * 14.0 * dt;
            obj.mesh.position.z += (dz / d) * 14.0 * dt;
            obj.basePos.copy(obj.mesh.position);
          }
        }
        // Magnetiza todos os Studs num raio de 22m!
        for (const studList of [this.destructibles.studs, this.destructibles.ambientStuds]) {
          if (!Array.isArray(studList)) continue;
          for (const st of studList) {
            if (st.collected) continue;
            if (st.mesh.position.distanceTo(sg.pos) <= 22.0) {
              st.magnetized = true;
            }
          }
        }
      }

      if (sg.timer <= 0) {
        this._spawnExpandingRing(sg.pos, 0xa855f7, 20.0, 0.5);
        this._damageRadius(sg.pos, 14.0, 220, true);
        soundFX.playLegoBreak(true);
        this.scene.remove(sg.group);
        this.singularities.splice(i, 1);
      }
    }

    // Chuva de 5 Meteoros LEGO
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      const toTarget = m.target.clone().sub(m.mesh.position);
      const dist = toTarget.length();
      m.mesh.rotation.x += dt * 6;
      m.mesh.rotation.y += dt * 5;
      if (dist <= m.speed * dt + 0.6) {
        this._spawnExpandingRing(m.target, 0xf97316, 11.0, 0.42);
        this._damageRadius(m.target, 9.5, 175, true);
        soundFX.playLegoBreak(true);
        this.scene.remove(m.mesh);
        this.meteors.splice(i, 1);
      } else {
        m.mesh.position.addScaledVector(toTarget.normalize(), m.speed * dt);
      }
    }
  }
}

// ============================================================================
// 5. ESTÚDIO 3D INTERATIVO NO PEDESTAL DO PORÃO & PAINEL LATERAL NA IDV
// ============================================================================
export class CustomHeroCreatorStudio {
  constructor(hud) {
    this.hud = hud;
    this.isOpen = false;
    this.activeTab = 'appearance'; // 'appearance' | 'powers'
    this.draft = createDefaultCustomHeroState();
    this.previewYaw = 0;
    this.controller = null;
    this.world = null;

    this.modalEl = document.getElementById('custom-hero-creator-modal');
    this._bindModalControls();
  }

  _bindModalControls() {
    if (!this.modalEl) return;

    document.getElementById('btn-creator-close')?.addEventListener('click', () => {
      this.close(false);
    });
    document.getElementById('btn-creator-tab-app')?.addEventListener('click', () => {
      this.activeTab = 'appearance';
      this._renderPanelContent();
    });
    document.getElementById('btn-creator-tab-pow')?.addEventListener('click', () => {
      this.activeTab = 'powers';
      this._renderPanelContent();
    });
    document.getElementById('btn-creator-rot-left')?.addEventListener('click', () => {
      this.previewYaw -= 0.45;
      this._applyLiveDraftTo3DMinifig();
    });
    document.getElementById('btn-creator-rot-right')?.addEventListener('click', () => {
      this.previewYaw += 0.45;
      this._applyLiveDraftTo3DMinifig();
    });
    document.getElementById('btn-creator-reset-civilian')?.addEventListener('click', () => {
      this.draft = createDefaultCustomHeroState();
      setActiveCustomHero(this.draft);
      this._applyLiveDraftTo3DMinifig();
      this.hud.saveCurrentProgress?.();
      soundFX.playPlasticHit();
      this.close(true);
    });
    document.getElementById('btn-creator-save-equip')?.addEventListener('click', () => {
      this.draft.isCreated = true;
      if (!this.draft.name || this.draft.name === 'CIDADÃO COMUM') {
        this.draft.name = 'GUARDIÃO NEON';
      }
      setActiveCustomHero(this.draft);
      this.hud.saveCurrentProgress?.();
      soundFX.playTrueHeroFanfare();
      if (this.controller?.destructibles) {
        this.controller.destructibles.spawnHeroSwapEffect(this.controller.position, 0x00f0ff);
      }
      this.close(true);
    });
  }

  open(controller, world) {
    if (!controller || !world) return;
    this.controller = controller;
    this.world = world;
    this.isOpen = true;
    this.activeTab = 'appearance';

    const cur = getActiveCustomHero();
    this._savedSnapshot = { ...cur };
    this._previousHeroKey = controller.minifigure?.currentHeroKey || 'op09';
    this.draft = {
      ...cur,
      isCreated: true,
      name: cur.isCreated ? cur.name : 'GUARDIÃO NEON'
    };

    // Posiciona o boneco em cima do Pedestal Holográfico no Porão (Y = -8.2m)
    const ped = world.customizerLabPedestal?.pedestalPos || { x: -332, y: -7.55, z: -167 };
    if (controller.currentVehicle) controller.exitVehicle();
    controller.isFlying = false;
    controller.isSupersonic = false;
    controller.velocity.set(0, 0, 0);
    controller.position.set(ped.x, ped.y, ped.z);
    this.previewYaw = Math.PI * 0.5; // Olhando para a câmera Leste!

    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }

    this._applyLiveDraftTo3DMinifig();
    this._renderPanelContent();
    this.modalEl?.classList.remove('hidden');
    soundFX.playHeroSwap();
  }

  close(keepEdited = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.modalEl?.classList.add('hidden');

    if (!keepEdited && this._savedSnapshot) {
      // Restaura o estado salvo caso tenha fechado no [X] sem salvar
      setActiveCustomHero(this._savedSnapshot);
    }
    this.hud?.syncOp09UI?.();
    this.controller?.switchToHero(keepEdited ? 'op09' : (this._previousHeroKey || 'op09'));

    if (this.controller && this.world?.customizerLabPedestal?.exitPos) {
      const ex = this.world.customizerLabPedestal.exitPos;
      this.controller.position.set(ex.x, ex.y, ex.z);
      this.controller.minifigure.root.position.copy(this.controller.position);
    }
    this.controller?.relockPointer?.();
  }

  updateStudioCamera(dt) {
    if (!this.isOpen || !this.controller) return;
    const ped = this.world?.customizerLabPedestal?.pedestalPos || { x: -332, y: -7.55, z: -167 };
    this.controller.minifigure.root.position.set(ped.x, ped.y, ped.z);
    this.controller.minifigure.root.rotation.set(0, this.previewYaw, 0);
    this.controller.minifigure.updateAnimation?.(dt, 0, 13.5, true, 0, false, false, 0, 0);

    // Enquadramento de Estúdio 3D deslocado levemente à esquerda para o boneco ficar livre ao lado do painel direito!
    const cam = this.controller.camera;
    cam.position.set(ped.x + 3.85, ped.y + 1.55, ped.z + 0.65);
    cam.lookAt(ped.x, ped.y + 1.15, ped.z - 0.85);
  }

  _applyLiveDraftTo3DMinifig() {
    setActiveCustomHero(this.draft);
    if (this.controller?.minifigure) {
      this.controller.minifigure.setHero('op09');
      this.controller.minifigure.root.rotation.y = this.previewYaw;
    }
    const entry = getOp09CatalogEntry();
    this.hud?.setCharacterPortrait('op09', entry.name);
  }

  _renderColorSwatches(selectedId, palette, attrName) {
    return palette
      .map(
        (c) => `
        <button class="creator-swatch ${c.id === selectedId ? 'active' : ''}"
          data-creator-field="${attrName}" data-val="${c.id}"
          title="${c.name}" style="background:${c.css}"></button>
      `
      )
      .join('');
  }

  _renderOptionChips(selectedId, list, attrName) {
    return list
      .map(
        (item) => `
        <button class="creator-chip ${item.id === selectedId ? 'active' : ''}"
          data-creator-field="${attrName}" data-val="${item.id}">
          ${item.name}
        </button>
      `
      )
      .join('');
  }

  _renderPowerCards(selectedId, list, attrName) {
    return list
      .map(
        (p) => `
        <button class="creator-power-card ${p.id === selectedId ? 'active' : ''}"
          data-creator-field="${attrName}" data-val="${p.id}">
          <div class="creator-pow-title">${p.name}</div>
          <div class="creator-pow-desc">${p.desc}</div>
        </button>
      `
      )
      .join('');
  }

  _renderPanelContent() {
    const bodyEl = document.getElementById('creator-panel-body');
    const tabApp = document.getElementById('btn-creator-tab-app');
    const tabPow = document.getElementById('btn-creator-tab-pow');
    tabApp?.classList.toggle('active', this.activeTab === 'appearance');
    tabPow?.classList.toggle('active', this.activeTab === 'powers');
    if (!bodyEl) return;

    const d = this.draft;
    if (this.activeTab === 'appearance') {
      bodyEl.innerHTML = `
        <div class="creator-sec">
          <label class="creator-lbl">NOME DO OPERADOR (ATÉ 20 LETRAS)</label>
          <input id="creator-name-input" type="text" maxlength="20" value="${d.name}" class="creator-input" />
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">COR DA CABEÇA / PELE (10 CORES LEGO)</label>
          <div class="creator-swatches-row">${this._renderColorSwatches(d.headColorId, CUSTOM_HEAD_COLORS, 'headColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">ROSTO / EXPRESSÃO (8 INÉDITOS)</label>
          <div class="creator-chips-grid">${this._renderOptionChips(d.faceId, CUSTOM_FACES, 'faceId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">CABELO / CAPACETE (10 MODELOS 3D INÉDITOS + COR)</label>
          <div class="creator-chips-grid">${this._renderOptionChips(d.hairId, CUSTOM_HEADGEAR, 'hairId')}</div>
          <div class="creator-swatches-row" style="margin-top:6px;">${this._renderColorSwatches(d.hairColorId, CUSTOM_LEGO_PALETTE, 'hairColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">ESTAMPA DO TORSO (8 INÉDITAS) & COR DO TORSO</label>
          <div class="creator-chips-grid">${this._renderOptionChips(d.torsoPrintId, CUSTOM_TORSO_PRINTS, 'torsoPrintId')}</div>
          <div class="creator-swatches-row" style="margin-top:6px;">${this._renderColorSwatches(d.torsoColorId, CUSTOM_LEGO_PALETTE, 'torsoColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">COR DOS BRAÇOS, MÃOS/LUVAS & CALÇAS</label>
          <div class="creator-mini-sub">BRAÇOS:</div>
          <div class="creator-swatches-row">${this._renderColorSwatches(d.armColorId, CUSTOM_LEGO_PALETTE, 'armColorId')}</div>
          <div class="creator-mini-sub">MÃOS / LUVAS:</div>
          <div class="creator-swatches-row">${this._renderColorSwatches(d.handColorId, [...CUSTOM_HEAD_COLORS.slice(0, 4), ...CUSTOM_LEGO_PALETTE.slice(0, 10)], 'handColorId')}</div>
          <div class="creator-mini-sub">PERNAS / CALÇA:</div>
          <div class="creator-swatches-row">${this._renderColorSwatches(d.legColorId, CUSTOM_LEGO_PALETTE, 'legColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">ACESSÓRIO DE COSTAS (5 OPÇÕES + COR)</label>
          <div class="creator-chips-grid">${this._renderOptionChips(d.backId, CUSTOM_BACK_GEAR, 'backId')}</div>
          <div class="creator-swatches-row" style="margin-top:6px;">${this._renderColorSwatches(d.backColorId, CUSTOM_LEGO_PALETTE, 'backColorId')}</div>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `
        <div class="creator-sec">
          <label class="creator-lbl">1. ATAQUE PRINCIPAL [MOUSE 1] (4 INÉDITOS)</label>
          <div class="creator-pow-list">${this._renderPowerCards(d.primaryPowerId, CUSTOM_PRIMARY_POWERS, 'primaryPowerId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">2. MOBILIDADE ESPECIAL [ESPAÇO NO AR / F] (4 INÉDITAS)</label>
          <div class="creator-pow-list">${this._renderPowerCards(d.mobilityPowerId, CUSTOM_MOBILITY_POWERS, 'mobilityPowerId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">3. SUPER-HABILIDADE [Q] (4 INÉDITAS)</label>
          <div class="creator-pow-list">${this._renderPowerCards(d.superPowerId, CUSTOM_SUPER_POWERS, 'superPowerId')}</div>
        </div>
      `;
    }

    const nameInput = document.getElementById('creator-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', (ev) => {
        this.draft.name = String(ev.target.value || '').toUpperCase().slice(0, 20);
        this._applyLiveDraftTo3DMinifig();
      });
    }

    if (typeof bodyEl.querySelectorAll === 'function') {
      bodyEl.querySelectorAll('button[data-creator-field]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const field = btn.dataset.creatorField;
          const val = btn.dataset.val;
          if (field && val) {
            this.draft[field] = val;
            soundFX.playPlasticHit();
            this._applyLiveDraftTo3DMinifig();
            this._renderPanelContent();
          }
        });
      });
    }
  }
}
