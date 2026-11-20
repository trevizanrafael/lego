import * as THREE from 'three';
import {
  VEHICLE_SPECS,
  UNITS_TO_KMH
} from '../../VehicleFleetBuilder.js';

// ============================================================================
// 1. TABELAS DE CUSTO EM STUDS, ATRIBUTOS (0 A 10) E CATÁLOGOS VISUAIS
// ============================================================================
export const UPGRADE_LEVEL_COSTS = [
  0,     // Nv. 0 (Original)
  1500,  // Nv. 1
  2500,  // Nv. 2
  4000,  // Nv. 3
  6000,  // Nv. 4
  8500,  // Nv. 5
  11500, // Nv. 6
  14500, // Nv. 7
  18000, // Nv. 8
  21500, // Nv. 9
  25000  // Nv. 10 (Máximo!)
];

export const UPGRADE_ATTRIBUTES = [
  {
    id: 'engine',
    name: 'FORÇA DO MOTOR (VELOCIDADE & ARRANCADA)',
    shortLabel: 'MOTOR V12',
    desc: 'Aumenta Velocidade Máxima e Arrancada em até +115% (420+ KM/H no Nv.10) e encorpa o ronco!'
  },
  {
    id: 'nitro',
    name: 'POTÊNCIA DO TURBO NITRO [Q]',
    shortLabel: 'TURBO NITRO',
    desc: 'Aumenta velocidade e empuxo do Nitro [Q] em até +140% com labaredas duplas gigantes!'
  },
  {
    id: 'handling',
    name: 'ADERÊNCIA & CONTROLE DE DRIFT [SHIFT]',
    shortLabel: 'DRIFT & GRIP',
    desc: 'Melhora resposta de direção, freios e ângulo de Drift [Shift] em curvas de alta velocidade!'
  },
  {
    id: 'armor',
    name: 'BLINDAGEM PESADA DE CHASSI',
    shortLabel: 'BLINDAGEM 6X',
    desc: 'Multiplica o HP máximo do veículo em até 6x no Nv.10 e reduz o recuo em batidas!'
  },
  {
    id: 'hydraulics',
    name: 'SUSPENSÃO HIDRÁULICA DE SALTO [2x ESPAÇO / X]',
    shortLabel: 'PULO HIDRÁULICO',
    desc: 'Nv.0 = freio de mão; Nv.1 a 10 libera Salto Hidráulico Real de 3m até 16m de altura!'
  },
  {
    id: 'ram',
    name: 'IMPACTO DE ARIETE (FORÇA DE BATIDA)',
    shortLabel: 'IMPACTO ARIETE',
    desc: 'Arremessa longe outros carros e objetos quebráveis ao trombar neles sem perder velocidade!'
  }
];

export const CUSTOMS_PAINT_PALETTE = [
  { id: 'alert_yellow', name: 'Amarelo Alerta', hex: 0xfacc15, css: '#facc15' },
  { id: 'crimson_red', name: 'Vermelho Rubi', hex: 0xdc2626, css: '#dc2626' },
  { id: 'royal_blue', name: 'Azul Royal', hex: 0x2563eb, css: '#2563eb' },
  { id: 'neon_cyan', name: 'Ciano Neon', hex: 0x06b6d4, css: '#06b6d4' },
  { id: 'emerald_green', name: 'Verde Esmeralda', hex: 0x16a34a, css: '#16a34a' },
  { id: 'radio_lime', name: 'Verde Limão', hex: 0x84cc16, css: '#84cc16' },
  { id: 'blaze_orange', name: 'Laranja Hot-Rod', hex: 0xf97316, css: '#f97316' },
  { id: 'cyber_purple', name: 'Roxo Simbionte', hex: 0x9333ea, css: '#9333ea' },
  { id: 'hot_magenta', name: 'Magenta Drift', hex: 0xec4899, css: '#ec4899' },
  { id: 'pure_white', name: 'Branco Pérola', hex: 0xf8fafc, css: '#f8fafc' },
  { id: 'chrome_silver', name: 'Prata Espelhado', hex: 0xcbd5e1, css: '#cbd5e1' },
  { id: 'gunmetal', name: 'Cinza Titânio', hex: 0x475569, css: '#475569' },
  { id: 'midnight_blue', name: 'Azul Meia-Noite', hex: 0x1e3a8a, css: '#1e3a8a' },
  { id: 'asphalt_black', name: 'Preto Asfalto', hex: 0x090a0d, css: '#090a0d' },
  { id: 'imperial_gold', name: 'Ouro Imperial', hex: 0xd97706, css: '#d97706' },
  { id: 'bronze_copper', name: 'Cobre Metálico', hex: 0x9a3412, css: '#9a3412' }
];

export const CUSTOMS_FINISHES = [
  { id: 'glossy', name: 'Plástico LEGO Brilhante' },
  { id: 'matte', name: 'Fosco Tático Urbano' },
  { id: 'pearl', name: 'Metálico Perolizado' },
  { id: 'chrome', name: 'Ouro / Cromo Espelhado' }
];

export const CUSTOMS_DECALS = [
  { id: 'none', name: 'Sem Adesivo (Limpo)' },
  { id: 'racing_stripes', name: 'Faixas Duplas de Corrida' },
  { id: 'hotrod_flames', name: 'Chamas Clássicas Hot-Rod' },
  { id: 'street_lightning', name: 'Raio Lateral Street-Tuner' },
  { id: 'race_number', name: 'Número Esportivo "77" / "01"' },
  { id: 'digital_camo', name: 'Camuflagem Urbana Digital' },
  { id: 'drift_checkers', name: 'Xadrez Street Drift' }
];

export const CUSTOMS_SPOILERS = [
  { id: 'none', name: 'Original Limpo', cost: 0 },
  { id: 'low_sport', name: 'Spoiler Esportivo Baixo', cost: 0 },
  { id: 'gt_carbon', name: 'Asa GT Fibra de Carbono', cost: 0 },
  { id: 'dual_jet_turbine', name: 'Turbina Traseira Dupla a Jato', cost: 0 },
  { id: 'drag_parachute', name: 'Paraquedas de Arrancada / Wheelie Bar', cost: 0 }
];

export const CUSTOMS_FRONT_MODS = [
  { id: 'stock', name: 'Original de Fábrica', cost: 0 },
  { id: 'sport_splitter', name: 'Splitter Aerodinâmico / Winglets GP', cost: 0 },
  { id: 'armored_bullbar', name: 'Quebra-Mato / Crash Bar Blindado', cost: 0 },
  { id: 'wedge_ram', name: 'Rampa Cunha Frontal (Lança Carros)', cost: 0 }
];

export const CUSTOMS_WHEEL_STYLES = [
  { id: 'standard', name: 'Padrão LEGO Urbano', cost: 0 },
  { id: 'wide_sport', name: 'Roda Larga Esportiva Forged', cost: 0 },
  { id: 'monster_truck', name: 'Pneus Monster Truck Elevados', cost: 0 }
];

export const CUSTOMS_ROOF_MODS = [
  { id: 'none', name: 'Original Limpo', cost: 0 },
  { id: 'rally_led_bar', name: 'Barra de Milha LED Rally', cost: 750 },
  { id: 'roof_scoop_carbon', name: 'Roof Scoop Fibra de Carbono', cost: 950 },
  { id: 'paredao_som_cdd', name: 'Paredão de Som Automotivo CDD', cost: 1800 },
  { id: 'stealth_police_lightbar', name: 'Giroflex Policial Interceptor', cost: 1400 },
  { id: 'expedition_rack', name: 'Bagageiro Off-Road / Letreiro VIP', cost: 1100 }
];

export const CUSTOMS_EXHAUST_MODS = [
  { id: 'stock', name: 'Escapamento Original', cost: 0 },
  { id: 'titanium_dual', name: 'Ponteiras Duplas de Titânio', cost: 800 },
  { id: 'side_flamethrower', name: 'Side-Pipes Laterais (Chama Dupla)', cost: 1350 },
  { id: 'chrome_truck_stacks', name: 'Chaminés Verticais Cromadas', cost: 1900 }
];

export const CUSTOMS_WINDOW_TINTS = [
  { id: 'stock', name: 'Cristal Original', cost: 0, hex: null, css: '#38bdf8' },
  { id: 'limo_black', name: 'Insulfilm G5 Preto', cost: 500, hex: 0x04060b, opacity: 0.94, roughness: 0.06, metalness: 0.72, css: '#090d16' },
  { id: 'gold_mirror', name: 'Película Ouro VIP', cost: 900, hex: 0xf59e0b, opacity: 0.88, roughness: 0.05, metalness: 0.95, css: '#f59e0b' },
  { id: 'cyber_cyan', name: 'Película & Farol Ciano', cost: 850, hex: 0x00e5ff, opacity: 0.78, roughness: 0.08, metalness: 0.65, headlightHex: 0x00e5ff, css: '#00e5ff' },
  { id: 'crimson_red', name: 'Película & Farol Rubi', cost: 850, hex: 0xef4444, opacity: 0.82, roughness: 0.08, metalness: 0.65, headlightHex: 0xef4444, css: '#ef4444' }
];

export const CUSTOMS_UNDERGLOW = [
  { id: 'off', name: 'Desligado', hex: null, css: '#334155' },
  { id: 'cyan', name: 'Azul Ciano', hex: 0x00f0ff, css: '#00f0ff' },
  { id: 'purple', name: 'Roxo Simbionte', hex: 0xa855f7, css: '#a855f7' },
  { id: 'green', name: 'Verde Radioativo', hex: 0x22c55e, css: '#22c55e' },
  { id: 'ruby', name: 'Vermelho Rubi', hex: 0xef4444, css: '#ef4444' },
  { id: 'gold', name: 'Ouro Solar', hex: 0xfacc15, css: '#facc15' },
  { id: 'rgb', name: 'RGB Pulsante Dinâmico', hex: 0x00f0ff, css: 'linear-gradient(90deg,#ef4444,#facc15,#22c55e,#00f0ff,#a855f7)' }
];

// ============================================================================
// ÍCONES VETORIAIS TÉCNICOS (PRO TUNER / ECU DIAGNOSTIC — ZERO EMOJIS)
// ============================================================================
export const CUSTOMS_SVGS = {
  minus: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3.5 8h9"/></svg>`,
  plus: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>`,
  bolt: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M9 1.5L3.5 9h4l-.5 5.5L12.5 7h-4L9 1.5z"/></svg>`,
  check: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>`,
  stud: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><ellipse cx="8" cy="5.2" rx="4.6" ry="2"/><path d="M3.4 5.2v5.4c0 1.1 2.06 2 4.6 2s4.6-.9 4.6-2V5.2"/><ellipse cx="8" cy="3.5" rx="2.1" ry="0.85"/></svg>`,
  save: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2.5h8l2.5 2.5v8.5H3z"/><path d="M5.5 2.5v3.5h5V2.5M5 13.5V9.5h6v4"/></svg>`,
  launch: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12L12 4M6.5 4H12v5.5"/></svg>`
};

export const PAID_PART_CATALOGS = {
  roofModId: CUSTOMS_ROOF_MODS,
  exhaustModId: CUSTOMS_EXHAUST_MODS,
  windowTintId: CUSTOMS_WINDOW_TINTS
};

// ============================================================================
// 2. ESTADO PERSISTENTE POR SLOT DE SAVE (NÍVEIS DESBLOQUEADOS + 3 CARROS SALVOS)
// ============================================================================
export function createDefaultGarageSaveData() {
  return {
    unlockedLevels: {
      engine: 0,
      nitro: 0,
      handling: 0,
      armor: 0,
      hydraulics: 0,
      ram: 0
    },
    unlockedParts: {},
    savedCars: [null, null, null]
  };
}

let ACTIVE_GARAGE_SAVE = createDefaultGarageSaveData();

export function getActiveGarageSaveData() {
  return ACTIVE_GARAGE_SAVE;
}

export function setActiveGarageSaveData(data) {
  const def = createDefaultGarageSaveData();
  if (!data || typeof data !== 'object') {
    ACTIVE_GARAGE_SAVE = def;
    return ACTIVE_GARAGE_SAVE;
  }
  const ul = data.unlockedLevels || {};
  const up = data.unlockedParts && typeof data.unlockedParts === 'object' ? { ...data.unlockedParts } : {};
  ACTIVE_GARAGE_SAVE = {
    unlockedLevels: {
      engine: clampInt(ul.engine, 0, 10),
      nitro: clampInt(ul.nitro, 0, 10),
      handling: clampInt(ul.handling, 0, 10),
      armor: clampInt(ul.armor, 0, 10),
      hydraulics: clampInt(ul.hydraulics, 0, 10),
      ram: clampInt(ul.ram, 0, 10)
    },
    unlockedParts: up,
    savedCars: [0, 1, 2].map((idx) =>
      data.savedCars && data.savedCars[idx] ? { ...data.savedCars[idx] } : null
    )
  };
  return ACTIVE_GARAGE_SAVE;
}

export function clampInt(v, min, max) {
  const n = Math.round(Number(v) || 0);
  return Math.max(min, Math.min(max, n));
}

function nearestPaletteId(hexValue, fallbackId = 'alert_yellow') {
  if (typeof hexValue !== 'number') return fallbackId;
  const cA = new THREE.Color(hexValue);
  let bestId = fallbackId;
  let bestDist = Infinity;
  for (const p of CUSTOMS_PAINT_PALETTE) {
    const cB = new THREE.Color(p.hex);
    const d = (cA.r - cB.r) ** 2 + (cA.g - cB.g) ** 2 + (cA.b - cB.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestId = p.id;
    }
  }
  return bestId;
}

export function getPaletteHex(id, fallbackHex = 0xfacc15) {
  return CUSTOMS_PAINT_PALETTE.find((p) => p.id === id)?.hex ?? fallbackHex;
}

export const DEFAULT_TUNING = {
  carType: 'apex_gtx',
  customName: 'APEX GT-X (HIPERCARRO)',
  levels: {
    engine: 0,
    nitro: 0,
    handling: 0,
    armor: 0,
    hydraulics: 0,
    ram: 0
  },
  primaryColorId: 'alert_yellow',
  secondaryColorId: 'asphalt_black',
  wheelColorId: 'chrome_silver',
  finishId: 'glossy',
  decalId: 'none',
  spoilerId: 'none',
  frontModId: 'stock',
  wheelStyleId: 'standard',
  roofModId: 'none',
  exhaustModId: 'stock',
  windowTintId: 'stock',
  underglowId: 'off'
};

export function createDefaultVehicleTuning(carObj = null) {
  const rootMesh = carObj?.isObject3D ? carObj : carObj?.mesh;
  const carType = rootMesh?.userData?.carType || 'apex_gtx';
  const spec = VEHICLE_SPECS[carType] || VEHICLE_SPECS.apex_gtx;
  const initCols = rootMesh?.userData?.initialColors || {};
  return {
    ...DEFAULT_TUNING,
    carType,
    customName: spec.name,
    levels: {
      engine: 0,
      nitro: 0,
      handling: 0,
      armor: 0,
      hydraulics: 0,
      ram: 0
    },
    primaryColorId: nearestPaletteId(initCols.color, 'alert_yellow'),
    secondaryColorId: nearestPaletteId(initCols.roofColor, 'asphalt_black'),
    wheelColorId: 'chrome_silver',
    finishId: 'glossy',
    decalId: 'none',
    spoilerId: carType === 'apex_gtx' ? 'gt_carbon' : 'none',
    frontModId: 'stock',
    wheelStyleId: 'standard',
    roofModId: 'none',
    exhaustModId: 'stock',
    windowTintId: 'stock',
    underglowId: 'off'
  };
}

/**
 * Calcula todos os multiplicadores físicos reais (0 a 10) + mods 3D para `ThirdPersonController._updateVehicleDriving`
 */
export function computeTunedVehicleStats(baseSpec, tuning) {
  const spec = baseSpec || VEHICLE_SPECS.apex_gtx;
  const lv = tuning?.levels || {};
  const eng = clampInt(lv.engine, 0, 10) / 10;
  const nit = clampInt(lv.nitro, 0, 10) / 10;
  const hnd = clampInt(lv.handling, 0, 10) / 10;
  const arm = clampInt(lv.armor, 0, 10) / 10;
  const hydLv = clampInt(lv.hydraulics, 0, 10);
  const ramLv = clampInt(lv.ram, 0, 10);

  // 1. Motor (+115% velocidade & arrancada no Nv.10!)
  const engineMult = 1.0 + 1.15 * eng;
  const maxForward = spec.maxForward * engineMult;
  const accel = spec.accel * engineMult;

  // 2. Nitro [Q] (+140% no Nv.10, sempre pelo menos 18% acima do Motor tunado!)
  const nitroMult = 1.0 + 1.40 * nit;
  const turboSpeed = Math.max(spec.turboSpeed * nitroMult, maxForward * (1.16 + 0.14 * nit));
  const turboAccel = (spec.turboAccel ?? spec.accel * 1.95) * nitroMult;

  // 3. Aderência & Drift [Shift]
  const turnRate = spec.turnRate * (1.0 + 0.65 * hnd);
  const driftTurnRate = spec.driftTurnRate * (1.0 + 0.75 * hnd);
  const brakeDecel = (spec.brakeDecel ?? 48.0) * (1.0 + 0.60 * hnd);

  // 4. Blindagem (Até 6x HP no Nv.10 + redução de recuo em batidas!)
  const hpMultiplier = 1.0 + 5.0 * arm;
  const maxHp = Math.round((spec.hp || 250) * hpMultiplier);
  const collisionRecoilFactor = -0.25 * (1.0 - 0.75 * arm);

  // 5. Suspensão Hidráulica de Salto (Nv.0 = 0m; Nv.1 = 3.0m até Nv.10 = 16.0m!)
  const jumpHeightMeters =
    hydLv <= 0 ? 0 : THREE.MathUtils.lerp(3.0, 16.0, (hydLv - 1) / 9);
  const jumpVelY = jumpHeightMeters > 0 ? Math.sqrt(2 * 26.0 * jumpHeightMeters) : 0;

  // 6. Impacto de Ariete (Nv.0..10) + Rampa Cunha Frontal (Wedge Ram)
  const isUnstoppable = spec.rammingPower === 'unstoppable' || ramLv >= 1;
  const ramDamage = 55 + ramLv * 140;
  const ramKnockSpeed = 14.0 + ramLv * 4.5;
  const hasWedgeRam = tuning?.frontModId === 'wedge_ram';
  const isMonsterTruck = tuning?.wheelStyleId === 'monster_truck';

  const kmh = Math.round(maxForward * UNITS_TO_KMH);
  const turboKmh = Math.round(turboSpeed * UNITS_TO_KMH);

  return {
    ...spec,
    kmh,
    turboKmh,
    maxForward,
    turboSpeed,
    accel,
    turboAccel,
    turnRate,
    driftTurnRate,
    brakeDecel,
    hp: maxHp,
    maxHp,
    collisionRecoilFactor,
    hydraulicsLevel: hydLv,
    jumpHeightMeters,
    jumpVelY,
    ramLevel: ramLv,
    rammingPower: isUnstoppable ? 'unstoppable' : 'normal',
    ramDamage,
    ramKnockSpeed,
    hasWedgeRam,
    isMonsterTruck,
    chassisLiftY: isMonsterTruck ? 0.56 : 0,
    nitroFlameScale: 1.0 + nit * 1.65 + (tuning?.spoilerId === 'dual_jet_turbine' ? 0.45 : 0),
    engineSoundBoost: 1.0 + eng * 0.45,
    underglowId: tuning?.underglowId || 'off'
  };
}

// ============================================================================
// 3. TEXTURAS PROCEDURAIS DE ADESIVOS AUTOMOTIVOS (DECALS) & NEON UNDERGLOW
// ============================================================================
const _decalTexCache = new Map();
let _sharedUnderglowTex = null;

export function getUnderglowGradientTexture() {
  if (_sharedUnderglowTex) return _sharedUnderglowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0.0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  _sharedUnderglowTex = tex;
  return tex;
}

export function createVehicleDecalTexture(decalId, secondaryHex = 0xf8fafc, placement = 'top') {
  const key = `${decalId}_${secondaryHex}_${placement}`;
  if (_decalTexCache.has(key)) return _decalTexCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const accentCss = `#${new THREE.Color(secondaryHex).getHexString()}`;

  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);

    if (decalId === 'racing_stripes') {
      ctx.fillStyle = accentCss;
      if (placement === 'top') {
        ctx.fillRect(82, 0, 34, 256);
        ctx.fillRect(140, 0, 34, 256);
        ctx.fillStyle = '#090a0d';
        ctx.fillRect(76, 0, 4, 256);
        ctx.fillRect(176, 0, 4, 256);
      } else {
        ctx.fillRect(0, 156, 256, 28);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(0, 188, 256, 10);
      }
    } else if (decalId === 'hotrod_flames') {
      const grad = ctx.createLinearGradient(0, 256, 0, 30);
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(0.55, '#f97316');
      grad.addColorStop(1, '#facc15');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(16, 256);
      const tongues = [42, 85, 128, 172, 216];
      tongues.forEach((tx, idx) => {
        const peakY = idx === 2 ? 28 : idx % 2 === 0 ? 78 : 52;
        ctx.quadraticCurveTo(tx - 18, 140, tx, peakY);
        ctx.quadraticCurveTo(tx + 18, 145, tx + 24, 210);
      });
      ctx.lineTo(240, 256);
      ctx.closePath();
      ctx.fill();
    } else if (decalId === 'street_lightning') {
      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(24, 220);
      ctx.lineTo(132, 118);
      ctx.lineTo(106, 118);
      ctx.lineTo(232, 34);
      ctx.lineTo(138, 146);
      ctx.lineTo(164, 146);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (decalId === 'race_number') {
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(128, 128, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#090a0d';
      ctx.font = '900 84px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(placement === 'side' ? '01' : '77', 128, 156);
    } else if (decalId === 'digital_camo') {
      const camoCols = ['#1e293b', '#475569', accentCss, '#090a0d'];
      for (let i = 0; i < 44; i++) {
        ctx.fillStyle = camoCols[i % camoCols.length];
        const rx = ((i * 53) % 220);
        const ry = ((i * 37) % 220);
        const rw = 24 + (i % 4) * 14;
        const rh = 16 + ((i + 2) % 3) * 14;
        ctx.fillRect(rx, ry, rw, rh);
      }
    } else if (decalId === 'drift_checkers') {
      const sq = 28;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 9; c++) {
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = r % 2 === 0 ? '#f8fafc' : '#facc15';
            ctx.fillRect(c * sq, 72 + r * sq, sq, sq);
          } else {
            ctx.fillStyle = '#090a0d';
            ctx.fillRect(c * sq, 72 + r * sq, sq, sq);
          }
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  _decalTexCache.set(key, tex);
  return tex;
}
