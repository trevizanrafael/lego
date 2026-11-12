import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from './BuildingGenerator.js';
import {
  VEHICLE_SPECS,
  UNITS_TO_KMH,
  createLegoCarMesh,
  getFinishMaterialOpts
} from './VehicleFleetBuilder.js';
import { ensureVehicleNightLights } from './DayNightAtmosphereManager.js';
import { createSignBoardMesh } from '../utils/SignBoardHelper.js';
import { soundFX } from '../audio/SoundFX.js';

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

function clampInt(v, min, max) {
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

function getUnderglowGradientTexture() {
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
  _decalTexCache.set(key, tex);
  return tex;
}

// ============================================================================
// 4. APLICAÇÃO AO VIVO DAS PEÇAS 3D, PINTURA, DECALS, MONSTER TRUCK & UNDERGLOW
// ============================================================================
// ============================================================================
// 4. APLICAÇÃO AO VIVO DAS PEÇAS 3D, PINTURA, DECALS, MONSTER TRUCK & UNDERGLOW
// ============================================================================
let _vipBusSignTex = null;
let _paredaoSignTex = null;

function createLedBannerTexture(mainText, subText, accentColor = '#00e5ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = '#ff6b00';
    ctx.font = '900 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(mainText, 256, 46);
    ctx.fillStyle = accentColor;
    ctx.font = '700 18px monospace';
    ctx.fillText(subText, 256, 76);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function getVipBusSignTexture() {
  if (!_vipBusSignTex) {
    _vipBusSignTex = createLedBannerTexture('EXPRESSO CDD // VIP TURBO', 'LINHA EXPRESSA • NITRO STAGE 10', '#00e5ff');
  }
  return _vipBusSignTex;
}

function getParedaoSignTexture() {
  if (!_paredaoSignTex) {
    _paredaoSignTex = createLedBannerTexture('PAREDAO CDD // PRO AUDIO', 'GRAVE PESADO • 180dB SPL', '#ff6b00');
  }
  return _paredaoSignTex;
}

/**
 * Mede as dimensões 3D reais do veículo (Carros, Motos, Picapes, Caminhões, Carro-Forte e Ônibus)
 * em coordenadas locais do chassi para enquadramento perfeito de câmera e encaixe universal de peças!
 */
export function measureVehicleBounds(vehicleInput) {
  const root = vehicleInput?.isObject3D ? vehicleInput : vehicleInput?.mesh;
  const carType = root?.userData?.carType || 'apex_gtx';
  const spec = root?.userData?.vehicleSpec || VEHICLE_SPECS[carType] || VEHICLE_SPECS.apex_gtx;
  const cd = root?.userData?.chassisDims || {};
  const isMoto = Boolean(cd.isMoto || spec?.isMotorcycle || carType.startsWith('moto_'));

  let minX = -(cd.w || (isMoto ? 0.96 : 2.4)) * 0.5;
  let maxX = -minX;
  let minY = 0;
  let maxY = cd.roofY || cd.topY || (isMoto ? 1.78 : 1.92);
  let minZ = -(cd.d || (isMoto ? 3.3 : 4.85)) * 0.5;
  let maxZ = -minZ;

  if (root) {
    const savedPos = root.position.clone();
    const savedRot = root.rotation.clone();
    const savedScale = root.scale.clone();
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    const box = new THREE.Box3();
    const childBox = new THREE.Box3();
    let hasMesh = false;
    root.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;
      if (node.userData?.isNitroFlame || node === root.userData?._underglowMesh) return;
      if (node.parent?.userData?.isNitroFlame || node.parent?.name === 'lego_customs_mod_group') return;
      childBox.setFromObject(node);
      if (!childBox.isEmpty()) {
        box.union(childBox);
        hasMesh = true;
      }
    });

    root.position.copy(savedPos);
    root.rotation.copy(savedRot);
    root.scale.copy(savedScale);
    root.updateMatrixWorld(true);

    if (hasMesh && !box.isEmpty()) {
      minX = Math.min(minX, box.min.x);
      maxX = Math.max(maxX, box.max.x);
      minY = Math.max(0, box.min.y);
      maxY = Math.max(maxY, box.max.y);
      minZ = Math.min(minZ, box.min.z);
      maxZ = Math.max(maxZ, box.max.z);
    }
  }

  const w = Math.max(isMoto ? 0.92 : 2.1, cd.w || maxX - minX);
  const d = Math.max(isMoto ? 3.1 : 4.2, cd.d || maxZ - minZ);
  const h = Math.max(isMoto ? 1.45 : 1.5, maxY - minY);
  const isBus = Boolean(cd.isBus || carType === 'onibus_urbano' || d > 7.0);
  const isEnclosedBoxRear =
    isBus ||
    carType === 'carro_forte' ||
    carType === 'van_pcc' ||
    carType === 'caveirao_bope';
  const isHeavy =
    isBus ||
    d > 5.2 ||
    isEnclosedBoxRear ||
    carType === 'picape_cv' ||
    carType === 'choque_pickup' ||
    carType === 'hover_apc_ares' ||
    carType === 'tanque_titan';

  const vehicleClassLabel = isBus
    ? 'ÔNIBUS'
    : isMoto
      ? 'MOTO'
      : isHeavy
        ? 'CAMINHÃO'
        : 'CARRO';

  return {
    w,
    h: cd.h || Math.min(h, 2.4),
    fullH: h,
    d,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    topY: cd.topY ?? (isMoto ? 1.24 : h * 0.58),
    roofY: cd.roofY ?? maxY,
    cabinW: cd.cabinW ?? w * 0.88,
    cabinD: cd.cabinD ?? (isMoto ? 1.1 : d * 0.48),
    cabinZ: cd.cabinZ ?? (isMoto ? 0.28 : -0.1),
    frontZ: cd.frontZ ?? maxZ,
    rearZ: minZ,
    openTop: Boolean(cd.openTop ?? spec?.openTop),
    isMoto,
    isBus,
    isEnclosedBoxRear,
    isHeavy,
    wheelRadius: cd.wheelRadius ?? (isMoto ? 0.56 : 0.44),
    vehicleClassLabel
  };
}

export function applyWindowAndHeadlightTint(root, windowTintId = 'stock') {
  if (!root) return;
  const tintEntry =
    CUSTOMS_WINDOW_TINTS.find((t) => t.id === windowTintId) || CUSTOMS_WINDOW_TINTS[0];

  let tintedGlassMat = null;
  let tintedHeadlightMat = null;
  if (tintEntry.id !== 'stock' && tintEntry.hex !== null) {
    tintedGlassMat = new THREE.MeshPhysicalMaterial({
      color: tintEntry.hex,
      transparent: true,
      opacity: tintEntry.opacity ?? 0.88,
      roughness: tintEntry.roughness ?? 0.06,
      metalness: tintEntry.metalness ?? 0.75,
      clearcoat: 0.95
    });
    tintedGlassMat.userData = { isVehicleGlass: true, tintId: tintEntry.id };

    if (tintEntry.headlightHex) {
      tintedHeadlightMat = getLegoMaterial(tintEntry.headlightHex, {
        emissive: tintEntry.headlightHex,
        emissiveIntensity: 1.15,
        roughness: 0.12
      });
      tintedHeadlightMat.userData = { isVehicleHeadlight: true, tintId: tintEntry.id };
    }
  }

  root.traverse((node) => {
    if (!node.isMesh || node.parent?.name === 'lego_customs_mod_group') return;

    const isGlass = Boolean(
      node.userData?.isVehicleGlass ||
        node.userData?._customsOrigGlassMat ||
        node.material?.userData?.isVehicleGlass
    );
    if (isGlass) {
      node.userData.isVehicleGlass = true;
      if (!node.userData._customsOrigGlassMat) {
        node.userData._customsOrigGlassMat = node.material;
      }
      node.material =
        tintEntry.id === 'stock' || !tintedGlassMat
          ? node.userData._customsOrigGlassMat
          : tintedGlassMat;
    }

    const isHeadlight = Boolean(
      node.userData?.isVehicleHeadlight ||
        node.userData?._customsOrigHeadlightMat ||
        node.material?.userData?.isVehicleHeadlight
    );
    if (isHeadlight) {
      node.userData.isVehicleHeadlight = true;
      if (!node.userData._customsOrigHeadlightMat) {
        node.userData._customsOrigHeadlightMat = node.material;
      }
      node.material = tintedHeadlightMat || node.userData._customsOrigHeadlightMat;
    }
  });
}

export function applyTuningToVehicleObject(carObj, tuningInput) {
  const isDirectGroup = Boolean(carObj?.isObject3D && !carObj?.mesh);
  const root = isDirectGroup ? carObj : carObj?.mesh;
  if (!root) return null;

  const baseType = tuningInput?.carType || root.userData?.carType || 'apex_gtx';
  const baseSpec = VEHICLE_SPECS[baseType] || VEHICLE_SPECS.apex_gtx;
  const defTuning = createDefaultVehicleTuning(carObj);
  const tuning = {
    ...defTuning,
    ...(tuningInput || {}),
    carType: baseType,
    levels: {
      ...defTuning.levels,
      ...(tuningInput?.levels || {})
    }
  };

  const primaryHex = getPaletteHex(tuning.primaryColorId, 0xfacc15);
  const secondaryHex = getPaletteHex(tuning.secondaryColorId, 0x090a0d);
  const wheelHex = getPaletteHex(tuning.wheelColorId, 0xcbd5e1);

  // Reconstrói malha limpa dentro do mesmo `root` (preservando referência em `ThirdPersonController` e `DestructibleManager`!)
  while (root.children.length > 0) {
    root.remove(root.children[0]);
  }
  delete root.userData._nightLightRig;

  const freshGroup = createLegoCarMesh({
    type: baseType,
    color: primaryHex,
    roofColor: secondaryHex,
    wheelColor: wheelHex,
    finishStyle: tuning.finishId,
    suppressDefaultSpoiler: tuning.spoilerId !== 'gt_carbon'
  });

  // Transfere filhos e metadados do modelo base recém-gerado para `root`
  const bodyLiftY = tuning.wheelStyleId === 'monster_truck' ? 0.56 : 0;
  const baseWheelSet = new Set(
    (freshGroup.userData.wheels || []).map((w) => w.steerGroup)
  );

  while (freshGroup.children.length > 0) {
    const ch = freshGroup.children[0];
    freshGroup.remove(ch);
    if (!baseWheelSet.has(ch) && bodyLiftY > 0) {
      ch.position.y += bodyLiftY;
    }
    root.add(ch);
  }

  root.userData.carType = baseType;
  root.userData.carName = tuning.customName || baseSpec.name;
  root.userData.initialColors = { color: primaryHex, roofColor: secondaryHex };
  root.userData.wheels = freshGroup.userData.wheels || [];
  root.userData.turretGroup = freshGroup.userData.turretGroup || null;
  root.userData.turboFlames = freshGroup.userData.turboFlames || [];
  root.userData.turboFlameMesh = freshGroup.userData.turboFlameMesh || null;
  root.userData.chassisDims = freshGroup.userData.chassisDims;

  for (const fg of root.userData.turboFlames) {
    if (fg) fg.userData.isNitroFlame = true;
  }

  // Película dos Vidros & Faróis (guardando _customsOrigGlassMat para restaurar no 'stock')
  applyWindowAndHeadlightTint(root, tuning.windowTintId || 'stock');

  const dims = measureVehicleBounds(root);

  // Subgrupo dedicado de Mods 3D, Decals, Teto, Escapamentos, Monster Suspension e Underglow
  const modGroup = new THREE.Group();
  modGroup.name = 'lego_customs_mod_group';
  const finishOpts = getFinishMaterialOpts(tuning.finishId);
  const secMat = getLegoMaterial(secondaryHex, finishOpts);
  const carbonMat = getLegoMaterial(0x0f172a, { roughness: 0.28, metalness: 0.35 });
  const chromeMat = getLegoMaterial(0xe2e8f0, { roughness: 0.1, metalness: 0.88 });
  const titaniumBlueMat = getLegoMaterial(0x38bdf8, { roughness: 0.14, metalness: 0.92, emissive: 0x0284c7, emissiveIntensity: 0.25 });
  const heatShieldMat = getLegoMaterial(0x94a3b8, { roughness: 0.22, metalness: 0.78 });
  const yellowHazardMat = getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.5 });
  const redFuelMat = getLegoMaterial(0xdc2626, { roughness: 0.24, clearcoat: 0.45 });
  const whiteLedMat = getLegoMaterial(0xf8fafc, { emissive: 0xffffff, emissiveIntensity: 1.35 });
  const policeRedMat = getLegoMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 1.2 });
  const policeBlueMat = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 1.2 });
  const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const extraJetFlames = [];

  const registerNitroFlame = (flameObj) => {
    if (!flameObj) return;
    flameObj.visible = false;
    flameObj.userData.isNitroFlame = true;
    extraJetFlames.push(flameObj);
    root.userData.turboFlames.push(flameObj);
  };

  // --------------------------------------------------------------------------
  // A) ADESIVOS / DECALS EM CANVAS (CARROS, MOTOS, CAMINHÕES & ÔNIBUS!)
  // --------------------------------------------------------------------------
  if (tuning.decalId && tuning.decalId !== 'none') {
    const topTex = createVehicleDecalTexture(tuning.decalId, secondaryHex, 'top');
    const sideTex = createVehicleDecalTexture(tuning.decalId, secondaryHex, 'side');
    const topDecalMat = new THREE.MeshStandardMaterial({
      map: topTex,
      transparent: true,
      roughness: finishOpts.roughness,
      metalness: finishOpts.metalness,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });
    const sideDecalMat = new THREE.MeshStandardMaterial({
      map: sideTex,
      transparent: true,
      roughness: finishOpts.roughness,
      metalness: finishOpts.metalness,
      polygonOffset: true,
      polygonOffsetFactor: -2
    });

    if (!dims.isMoto) {
      if (!dims.isBus) {
        const hoodPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(dims.w * 0.82, Math.min(2.0, dims.d * 0.28)),
          topDecalMat
        );
        hoodPlane.rotation.x = -Math.PI / 2;
        hoodPlane.position.set(0, dims.topY + bodyLiftY + 0.12, dims.d * 0.31);
        modGroup.add(hoodPlane);
      }

      if (!dims.openTop) {
        const roofPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(dims.cabinW * 0.86, dims.cabinD * 0.82),
          topDecalMat
        );
        roofPlane.rotation.x = -Math.PI / 2;
        roofPlane.position.set(0, dims.roofY + bodyLiftY + 0.13, dims.cabinZ);
        modGroup.add(roofPlane);
      }

      const sidePanelH = dims.isBus ? 0.95 : Math.max(0.55, dims.h * 0.82);
      const sidePanelY = dims.isBus ? 0.96 + bodyLiftY : 0.44 + dims.h * 0.5 + bodyLiftY;
      for (const sx of [-1, 1]) {
        const doorPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(dims.d * 0.62, sidePanelH),
          sideDecalMat
        );
        doorPlane.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        doorPlane.position.set(sx * (dims.w * 0.5 + 0.02), sidePanelY, 0);
        modGroup.add(doorPlane);
      }
    } else {
      for (const sx of [-1, 1]) {
        const tankDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.36), sideDecalMat);
        tankDecal.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        tankDecal.position.set(sx * 0.57, 1.22 + bodyLiftY, 0.45);
        const tailDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.22), sideDecalMat);
        tailDecal.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        tailDecal.position.set(sx * 0.44, 1.12 + bodyLiftY, -1.06);
        modGroup.add(tankDecal, tailDecal);
      }
    }
  }

  // --------------------------------------------------------------------------
  // B) AEROFÓLIOS TRASEIROS 3D, TURBINA A JATO & PARAQUEDAS / WHEELIE BAR (UNIVERSAL!)
  // --------------------------------------------------------------------------
  const rearFaceZ = -dims.d * 0.5;
  const wingZ = -dims.d * 0.46;
  const wingBaseY = (dims.isEnclosedBoxRear ? dims.roofY : dims.topY) + bodyLiftY;
  const rearHullY = (dims.isEnclosedBoxRear ? 0.96 : dims.topY) + bodyLiftY;

  if (dims.isMoto) {
    if (tuning.spoilerId === 'low_sport') {
      const tailLip = createLegoBrick(0.86, 0.12, 0.42, secondaryHex, { studStep: 0.4 });
      tailLip.rotation.x = 0.16;
      tailLip.position.set(0, 1.34 + bodyLiftY, -1.36);
      modGroup.add(tailLip);
    } else if (tuning.spoilerId === 'gt_carbon') {
      const wingW = 1.24;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.08, 0.38), carbonMat);
      blade.position.set(0, 1.56 + bodyLiftY, -1.48);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.22), carbonMat);
        post.position.set(sx * 0.3, 1.38 + bodyLiftY, -1.44);
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.44), secMat);
        endplate.position.set(sx * (wingW * 0.5), 1.57 + bodyLiftY, -1.48);
        modGroup.add(post, endplate);
      }
      modGroup.add(blade);
    } else if (tuning.spoilerId === 'dual_jet_turbine') {
      // 2 Micro-Turbinas a Jato acopladas nas laterais traseiras da moto!
      for (const sx of [-0.48, 0.48]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.95, 14), chromeMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(sx, 1.08 + bodyLiftY, -1.24);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 12), carbonMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(sx, 1.08 + bodyLiftY, -1.78);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), cyanGlowMat);
        core.rotation.x = Math.PI / 2;
        core.position.set(sx, 1.08 + bodyLiftY, -1.89);
        const jetCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.17, 1.35, 10),
          new THREE.MeshBasicMaterial({ color: 0x00e5ff })
        );
        jetCone.rotation.x = -Math.PI / 2;
        jetCone.position.set(sx, 1.08 + bodyLiftY, -2.52);
        registerNitroFlame(jetCone);
        modGroup.add(pod, nozzle, core, jetCone);
      }
    } else if (tuning.spoilerId === 'drag_parachute') {
      // Wheelie Bar traseira (rodinha anti-empinada de arrancada) + mini-paraquedas!
      for (const sx of [-0.22, 0.22]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.18, 8), chromeMat);
        bar.rotation.x = Math.PI / 2 + 0.22;
        bar.position.set(sx, 0.42, -1.88);
        modGroup.add(bar);
      }
      const rollerAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8), chromeMat);
      rollerAxle.rotation.z = Math.PI / 2;
      rollerAxle.position.set(0, 0.22, -2.42);
      const rollerWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 12), carbonMat);
      rollerWheel.rotation.z = Math.PI / 2;
      rollerWheel.position.set(0, 0.22, -2.42);
      const chutePack = createLegoBrick(0.42, 0.34, 0.32, 0x0f172a, { studs: false });
      chutePack.position.set(0, 1.22 + bodyLiftY, -1.68);
      const chuteStrap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.34), redFuelMat);
      chuteStrap.position.set(0, 1.22 + bodyLiftY, -1.68);
      modGroup.add(rollerAxle, rollerWheel, chutePack, chuteStrap);
    }
  } else {
    const scaleHeavy = dims.d > 5.5 ? 1.22 : 1.0;
    if (tuning.spoilerId === 'low_sport') {
      const lip = createLegoBrick(dims.w * 0.94, 0.14 * scaleHeavy, 0.44 * scaleHeavy, secondaryHex, { studStep: 0.55 });
      lip.position.set(0, wingBaseY + 0.22, wingZ);
      for (const sx of [-1, 1]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.26), carbonMat);
        strut.position.set(sx * dims.w * 0.32, wingBaseY + 0.1, wingZ);
        modGroup.add(strut);
      }
      modGroup.add(lip);
    } else if (tuning.spoilerId === 'gt_carbon') {
      const wingW = dims.w + 0.32;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.12 * scaleHeavy, 0.64 * scaleHeavy), carbonMat);
      blade.position.set(0, wingBaseY + 0.72 * scaleHeavy, wingZ - 0.08);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.72 * scaleHeavy, 0.34), carbonMat);
        post.position.set(sx * (dims.w * 0.36), wingBaseY + 0.36 * scaleHeavy, wingZ - 0.06);
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38 * scaleHeavy, 0.74 * scaleHeavy), secMat);
        endplate.position.set(sx * (wingW * 0.5), wingBaseY + 0.74 * scaleHeavy, wingZ - 0.08);
        modGroup.add(post, endplate);
      }
      modGroup.add(blade);
    } else if (tuning.spoilerId === 'dual_jet_turbine') {
      const podSpread = dims.w * 0.26;
      const podR = 0.32 * scaleHeavy;
      const turbineZ = dims.isEnclosedBoxRear ? rearFaceZ - 0.45 : wingZ - 0.15;
      for (const sx of [-podSpread, podSpread]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(podR, podR * 1.18, 1.35 * scaleHeavy, 14), chromeMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(sx, rearHullY + 0.36, turbineZ);

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(podR * 0.88, podR * 0.68, 0.34, 14), carbonMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(sx, rearHullY + 0.36, turbineZ - 0.74 * scaleHeavy);

        const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(podR * 0.56, podR * 0.56, 0.12, 12), cyanGlowMat);
        coreGlow.rotation.x = Math.PI / 2;
        coreGlow.position.set(sx, rearHullY + 0.36, turbineZ - 0.88 * scaleHeavy);

        const jetCone = new THREE.Mesh(
          new THREE.ConeGeometry(podR * 0.85, 1.95 * scaleHeavy, 10),
          new THREE.MeshBasicMaterial({ color: 0x00e5ff })
        );
        jetCone.rotation.x = -Math.PI / 2;
        jetCone.position.set(sx, rearHullY + 0.36, turbineZ - 1.82 * scaleHeavy);
        registerNitroFlame(jetCone);

        modGroup.add(pod, nozzle, coreGlow, jetCone);
      }
    } else if (tuning.spoilerId === 'drag_parachute') {
      const packW = Math.min(1.1, dims.w * 0.36);
      const chutePack = createLegoBrick(packW, 0.52, 0.46, 0x0f172a, { studs: false });
      chutePack.position.set(0, rearHullY + 0.18, rearFaceZ - 0.28);
      const crossRibbonA = new THREE.Mesh(new THREE.BoxGeometry(packW + 0.04, 0.1, 0.48), redFuelMat);
      crossRibbonA.position.set(0, rearHullY + 0.18, rearFaceZ - 0.28);
      const crossRibbonB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 0.48), yellowHazardMat);
      crossRibbonB.position.set(0, rearHullY + 0.18, rearFaceZ - 0.28);
      modGroup.add(chutePack, crossRibbonA, crossRibbonB);

      for (const sx of [-0.46, 0.46]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.25, 8), chromeMat);
        strut.rotation.x = Math.PI / 2 + 0.16;
        strut.position.set(sx, 0.38, rearFaceZ - 0.52);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12), carbonMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx, 0.22, rearFaceZ - 1.08);
        modGroup.add(strut, wheel);
      }
    }
  }

  // --------------------------------------------------------------------------
  // C) FRENTE ESPECIAL 3D (SPLITTER/WINGLETS, QUEBRA-MATO/CRASH BAR & RAMPA CUNHA!)
  // --------------------------------------------------------------------------
  const noseZ = dims.frontZ || dims.d * 0.5 + 0.05;
  if (dims.isMoto) {
    if (tuning.frontModId === 'sport_splitter') {
      // Asas aerodinâmicas laterais estilo MotoGP!
      for (const sx of [-1, 1]) {
        const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.46), carbonMat);
        winglet.rotation.z = sx * -0.26;
        winglet.position.set(sx * 0.56, 1.16 + bodyLiftY, 1.18);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.48), secMat);
        fin.position.set(sx * 0.72, 1.12 + bodyLiftY, 1.18);
        modGroup.add(winglet, fin);
      }
    } else if (tuning.frontModId === 'armored_bullbar') {
      // Protetor de motor tubular (Crash Bar)!
      for (const sx of [-1, 1]) {
        const cage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.54, 0.62), chromeMat);
        cage.position.set(sx * 0.52, 0.78 + bodyLiftY, 0.48);
        const slider = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), yellowHazardMat);
        slider.rotation.z = Math.PI / 2;
        slider.position.set(sx * 0.66, 0.82 + bodyLiftY, 0.52);
        modGroup.add(cage, slider);
      }
      const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.14, 10), chromeMat);
      crossBar.rotation.z = Math.PI / 2;
      crossBar.position.set(0, 0.98 + bodyLiftY, 0.78);
      modGroup.add(crossBar);
    } else if (tuning.frontModId === 'wedge_ram') {
      // Lâmina frontal interceptadora para motos!
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(0, 0.24 + bodyLiftY * 0.35, noseZ + 0.36);
      const plow = createLegoBrick(1.32, 0.12, 0.95, 0x1e293b, { studs: false });
      plow.rotation.x = 0.46;
      plow.position.set(0, 0.24, 0);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.09, 0.22), yellowHazardMat);
      edge.position.set(0, 0.05, 0.44);
      for (const sx of [-1, 1]) {
        const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.88), yellowHazardMat);
        sidePlate.position.set(sx * 0.66, 0.22, -0.02);
        bladeGroup.add(sidePlate);
      }
      bladeGroup.add(plow, edge);
      modGroup.add(bladeGroup);
    }
  } else {
    const heavyScaleH = dims.d > 5.5 ? 1.25 : 1.0;
    if (tuning.frontModId === 'sport_splitter') {
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.26, 0.12 * heavyScaleH, 0.64), carbonMat);
      splitter.position.set(0, 0.32 + bodyLiftY, noseZ + 0.22);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.28, 0.05, 0.68), yellowHazardMat);
      trim.position.set(0, 0.26 + bodyLiftY, noseZ + 0.24);
      modGroup.add(splitter, trim);
    } else if (tuning.frontModId === 'armored_bullbar') {
      const mainBar = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.2, 0.74 * heavyScaleH, 0.34), chromeMat);
      mainBar.position.set(0, 0.72 * heavyScaleH + bodyLiftY, noseZ + 0.24);
      const guardSpread = dims.w * 0.32;
      for (const sx of [-guardSpread, 0, guardSpread]) {
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.92 * heavyScaleH, 0.4), carbonMat);
        guard.position.set(sx, 0.76 * heavyScaleH + bodyLiftY, noseZ + 0.26);
        modGroup.add(guard);
      }
      modGroup.add(mainBar);
    } else if (tuning.frontModId === 'wedge_ram') {
      // RAMPA CUNHA FRONTAL (WEDGE RAM) escalonada proporcionalmente a dims.w!
      const wedgeGroup = new THREE.Group();
      wedgeGroup.position.set(0, 0.18 + bodyLiftY * 0.35, noseZ + 0.58);

      const rampSlope = createLegoBrick(dims.w + 0.34, 0.16, 1.48, 0x1e293b, { studStep: 0.6 });
      rampSlope.rotation.x = 0.46;
      rampSlope.position.set(0, 0.34 * heavyScaleH, 0);
      wedgeGroup.add(rampSlope);

      const frontLip = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.38, 0.12, 0.28), yellowHazardMat);
      frontLip.position.set(0, 0.06, 0.68);
      wedgeGroup.add(frontLip);

      for (const sx of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6 * heavyScaleH, 1.34), yellowHazardMat);
        cheek.position.set(sx * (dims.w * 0.5 + 0.14), 0.32 * heavyScaleH, -0.04);
        wedgeGroup.add(cheek);
      }
      modGroup.add(wedgeGroup);
    }
  }

  // --------------------------------------------------------------------------
  // D) ACESSÓRIOS DE TETO, CARENAGEM & PAREDÃO DE SOM (`tuning.roofModId`)
  // --------------------------------------------------------------------------
  const roofMountY = (dims.openTop && !dims.isMoto ? dims.topY + 0.55 : dims.roofY) + bodyLiftY;
  const roofFrontZ = dims.cabinZ + dims.cabinD * 0.38;

  if (tuning.roofModId === 'rally_led_bar') {
    if (dims.isMoto) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.1), carbonMat);
      bar.position.set(0, 1.66 + bodyLiftY, 1.14);
      modGroup.add(bar);
      for (const lx of [-0.26, 0.26]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12), carbonMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(lx, 1.66 + bodyLiftY, 1.18);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 12), whiteLedMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(lx, 1.66 + bodyLiftY, 1.26);
        modGroup.add(pod, lens);
      }
    } else {
      const barW = dims.cabinW * 0.88;
      const rack = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.1, 0.18), carbonMat);
      rack.position.set(0, roofMountY + 0.16, roofFrontZ);
      modGroup.add(rack);
      const podCount = dims.w > 2.6 ? 6 : 4;
      for (let i = 0; i < podCount; i++) {
        const t = podCount === 1 ? 0 : i / (podCount - 1) - 0.5;
        const lx = t * (barW - 0.34);
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 12), carbonMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(lx, roofMountY + 0.24, roofFrontZ + 0.04);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), whiteLedMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(lx, roofMountY + 0.24, roofFrontZ + 0.14);
        modGroup.add(pod, lens);
      }
    }
  } else if (tuning.roofModId === 'roof_scoop_carbon') {
    if (dims.isMoto) {
      const gpBubble = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 0.56, 0.36),
        new THREE.MeshPhysicalMaterial({
          color: 0x090d16,
          transparent: true,
          opacity: 0.84,
          roughness: 0.08,
          metalness: 0.65
        })
      );
      gpBubble.rotation.x = -0.58;
      gpBubble.position.set(0, 1.62 + bodyLiftY, 1.12);
      const ramAir = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.32), carbonMat);
      ramAir.position.set(0, 1.38 + bodyLiftY, 1.38);
      modGroup.add(gpBubble, ramAir);
    } else {
      for (const sx of [-0.36, 0.36]) {
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 1.18), carbonMat);
        scoop.position.set(sx, roofMountY + 0.14, dims.cabinZ + 0.18);
        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.08), yellowHazardMat);
        intake.position.set(sx, roofMountY + 0.14, dims.cabinZ + 0.78);
        modGroup.add(scoop, intake);
      }
    }
  } else if (tuning.roofModId === 'paredao_som_cdd') {
    const speakerColors = [0xff6b00, 0x00e5ff, 0xfacc15, 0xec4899];
    if (dims.isMoto) {
      // Moto: Baú traseiro de som com 2 subwoofers + 2 cornetas!
      const soundBox = createLegoBrick(0.92, 0.52, 0.56, 0x0f172a, { studStep: 0.4 });
      soundBox.position.set(0, 1.48 + bodyLiftY, -1.36);
      modGroup.add(soundBox);
      for (let i = 0; i < 2; i++) {
        const sx = i === 0 ? -0.23 : 0.23;
        const wooferMat = getLegoMaterial(speakerColors[i], { emissive: speakerColors[i], emissiveIntensity: 0.45 });
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.11, 0.08, 14), wooferMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(sx, 1.44 + bodyLiftY, -1.66);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 10), chromeMat);
        horn.rotation.x = -Math.PI / 2;
        horn.position.set(sx, 1.66 + bodyLiftY, -1.66);
        modGroup.add(cone, horn);
      }
    } else {
      // Rack acústico LEGO "Paredão de Som Automotivo CDD" com 4 woofers, 4 cornetas cromadas e letreiro LED!
      const wallW = Math.min(2.45, dims.cabinW * 0.96);
      const wallZ = dims.cabinZ - dims.cabinD * 0.15;
      const cabinet = createLegoBrick(wallW, 0.86, 0.72, 0x111827, { studStep: 0.55 });
      cabinet.position.set(0, roofMountY + 0.46, wallZ);
      modGroup.add(cabinet);

      for (let i = 0; i < 4; i++) {
        const t = i / 3 - 0.5;
        const wx = t * (wallW - 0.52);
        const cHex = speakerColors[i % speakerColors.length];
        const wooferMat = getLegoMaterial(cHex, { emissive: cHex, emissiveIntensity: 0.55 });
        const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.12, 16), wooferMat);
        woofer.rotation.x = Math.PI / 2;
        woofer.position.set(wx, roofMountY + 0.36, wallZ - 0.38);

        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 12), chromeMat);
        horn.rotation.x = Math.PI / 2;
        horn.position.set(wx, roofMountY + 0.72, wallZ - 0.4);
        modGroup.add(woofer, horn);
      }

      const ledHeader = new THREE.Mesh(
        new THREE.PlaneGeometry(wallW * 0.94, 0.26),
        new THREE.MeshBasicMaterial({ map: getParedaoSignTexture() })
      );
      ledHeader.rotation.y = Math.PI;
      ledHeader.position.set(0, roofMountY + 1.04, wallZ - 0.37);
      const ledBack = new THREE.Mesh(new THREE.BoxGeometry(wallW * 0.96, 0.28, 0.08), carbonMat);
      ledBack.position.set(0, roofMountY + 1.04, wallZ - 0.33);
      modGroup.add(ledBack, ledHeader);
    }
  } else if (tuning.roofModId === 'stealth_police_lightbar') {
    if (dims.isMoto) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.78, 8), chromeMat);
      mast.position.set(0.32, 1.78 + bodyLiftY, -1.46);
      const beaconR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12), policeRedMat);
      beaconR.position.set(0.32, 2.2 + bodyLiftY, -1.46);
      const frontL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), policeRedMat);
      frontL.position.set(-0.46, 1.36 + bodyLiftY, 1.38);
      const frontR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), policeBlueMat);
      frontR.position.set(0.46, 1.36 + bodyLiftY, 1.38);
      modGroup.add(mast, beaconR, frontL, frontR);
    } else {
      const lbW = dims.cabinW * 0.82;
      const centerPod = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.34), carbonMat);
      centerPod.position.set(0, roofMountY + 0.16, dims.cabinZ + 0.1);
      const leftPod = new THREE.Mesh(new THREE.BoxGeometry(lbW * 0.44, 0.18, 0.32), policeRedMat);
      leftPod.position.set(-lbW * 0.26, roofMountY + 0.16, dims.cabinZ + 0.1);
      const rightPod = new THREE.Mesh(new THREE.BoxGeometry(lbW * 0.44, 0.18, 0.32), policeBlueMat);
      rightPod.position.set(lbW * 0.26, roofMountY + 0.16, dims.cabinZ + 0.1);
      modGroup.add(centerPod, leftPod, rightPod);
    }
  } else if (tuning.roofModId === 'expedition_rack') {
    if (dims.isBus || dims.d > 7.0) {
      // Ônibus: Letreiro digital luminoso superior "EXPRESSO CDD // VIP TURBO" + A/C duplo VIP no teto!
      const signHousing = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.46, 0.28), carbonMat);
      signHousing.position.set(0, roofMountY + 0.28, dims.d * 0.46);
      const signScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(2.32, 0.38),
        new THREE.MeshBasicMaterial({ map: getVipBusSignTexture() })
      );
      signScreen.position.set(0, roofMountY + 0.28, dims.d * 0.46 + 0.15);
      modGroup.add(signHousing, signScreen);

      for (const az of [2.1, -2.1]) {
        const vipAc = createLegoBrick(1.96, 0.34, 2.05, 0x0f172a, { studStep: 0.65 });
        vipAc.position.set(0, roofMountY + 0.32, az);
        const cyanStrip = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 2.08), cyanGlowMat);
        cyanStrip.position.set(0, roofMountY + 0.5, az);
        modGroup.add(vipAc, cyanStrip);
      }
    } else if (dims.isMoto) {
      // Moto: Par de alforjes laterais táticos rígidos!
      for (const sx of [-1, 1]) {
        const bag = createLegoBrick(0.32, 0.46, 0.76, 0x1e293b, { studs: false });
        bag.position.set(sx * 0.56, 1.02 + bodyLiftY, -0.98);
        const latch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.78), yellowHazardMat);
        latch.position.set(sx * 0.56, 1.12 + bodyLiftY, -0.98);
        modGroup.add(bag, latch);
      }
    } else {
      // Carros / Picapes / Caminhões: Grade de expedição no teto com estepe e galões vermelhos!
      const rackW = dims.cabinW * 0.88;
      const rackD = Math.min(2.4, dims.cabinD * 0.85);
      const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.1, rackD), carbonMat);
      baseFrame.position.set(0, roofMountY + 0.12, dims.cabinZ);
      const spareTire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.28, 16),
        getLegoMaterial(0x090a0d, { roughness: 0.68 })
      );
      spareTire.position.set(-rackW * 0.18, roofMountY + 0.32, dims.cabinZ - 0.15);
      const spareRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 12), chromeMat);
      spareRim.position.set(-rackW * 0.18, roofMountY + 0.32, dims.cabinZ - 0.15);
      modGroup.add(baseFrame, spareTire, spareRim);

      for (const gz of [-0.32, 0.26]) {
        const jerrycan = createLegoBrick(0.32, 0.42, 0.44, 0xdc2626, { studs: false });
        jerrycan.position.set(rackW * 0.28, roofMountY + 0.36, dims.cabinZ + gz);
        modGroup.add(jerrycan);
      }
    }
  }

  // --------------------------------------------------------------------------
  // E) ESCAPAMENTOS & CHAMINÉS (`tuning.exhaustModId`)
  // --------------------------------------------------------------------------
  if (tuning.exhaustModId === 'titanium_dual') {
    const tipSpread = dims.isMoto ? 0.48 : dims.w * 0.28;
    const tipY = (dims.isMoto ? 0.94 : 0.44) + bodyLiftY;
    const tipZ = dims.isMoto ? -1.68 : rearFaceZ - 0.14;
    for (const sx of [-tipSpread, tipSpread]) {
      for (const subOff of [-0.09, 0.09]) {
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.42, 12), titaniumBlueMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(sx + (dims.isMoto ? 0 : subOff), tipY, tipZ);
        modGroup.add(tip);
        if (dims.isMoto) break;
      }
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 1.35, 10),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff })
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(sx, tipY, tipZ - 0.85);
      registerNitroFlame(flame);
      modGroup.add(flame);
    }
  } else if (tuning.exhaustModId === 'side_flamethrower') {
    const sideX = dims.isMoto ? 0.54 : dims.w * 0.5 + 0.08;
    const pipeY = (dims.isMoto ? 0.52 : 0.36) + bodyLiftY;
    const pipeLen = dims.isMoto ? 1.65 : Math.min(3.2, dims.d * 0.52);
    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, pipeLen, 12), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx * sideX, pipeY, -0.15);

      const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 10), titaniumBlueMat);
      outlet.rotation.z = sx * (Math.PI / 2);
      outlet.position.set(sx * (sideX + 0.1), pipeY, -pipeLen * 0.42);

      const sideFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 1.28, 10),
        new THREE.MeshBasicMaterial({ color: 0xff6b00 })
      );
      sideFlame.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      sideFlame.position.set(sx * (sideX + 0.82), pipeY, -pipeLen * 0.42);
      registerNitroFlame(sideFlame);
      modGroup.add(pipe, outlet, sideFlame);
    }
  } else if (tuning.exhaustModId === 'chrome_truck_stacks') {
    // Duas imponentes chaminés verticais cromadas com protetor térmico subindo atrás da cabine soltando chamas pro alto!
    const stackH = dims.isMoto ? 1.55 : dims.isBus ? 2.85 : 2.35;
    const stackR = dims.isMoto ? 0.085 : 0.15;
    const stackX = dims.isMoto ? 0.46 : dims.w * 0.5 + 0.12;
    const stackZ = dims.isMoto ? -1.38 : dims.isBus ? -dims.d * 0.42 : dims.cabinZ - dims.cabinD * 0.52;
    const stackBaseY = (dims.isMoto ? 0.85 : 0.55) + bodyLiftY;

    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(stackR, stackR, stackH, 14), chromeMat);
      pipe.position.set(sx * stackX, stackBaseY + stackH * 0.5, stackZ);

      const shield = new THREE.Mesh(
        new THREE.CylinderGeometry(stackR * 1.32, stackR * 1.32, stackH * 0.62, 12, 1, true),
        heatShieldMat
      );
      shield.position.set(sx * stackX, stackBaseY + stackH * 0.42, stackZ);

      const topTurnout = new THREE.Mesh(new THREE.CylinderGeometry(stackR * 1.12, stackR, 0.28, 12), chromeMat);
      topTurnout.rotation.z = sx * -0.22;
      topTurnout.position.set(sx * (stackX + 0.04), stackBaseY + stackH + 0.08, stackZ);

      const upFlame = new THREE.Mesh(
        new THREE.ConeGeometry(stackR * 1.55, 1.55, 10),
        new THREE.MeshBasicMaterial({ color: 0xff6b00 })
      );
      upFlame.position.set(sx * (stackX + 0.06), stackBaseY + stackH + 0.92, stackZ);
      registerNitroFlame(upFlame);

      modGroup.add(pipe, shield, topTurnout, upFlame);
    }
  }

  // --------------------------------------------------------------------------
  // F) ESTILO DE PNEUS (RODA LARGA ESPORTIVA OU PNEUS MONSTER TRUCK ELEVADOS!)
  // --------------------------------------------------------------------------
  const wheelMat = getLegoMaterial(wheelHex, { metalness: 0.65, roughness: 0.16, clearcoat: 0.7 });
  const tireRubberMat = getLegoMaterial(0x090a0d, { roughness: 0.65 });

  if (Array.isArray(root.userData.wheels)) {
    for (const w of root.userData.wheels) {
      if (tuning.wheelStyleId === 'wide_sport') {
        w.steerGroup.scale.set(1.42, 1.06, 1.06);
        const neonRing = new THREE.Mesh(
          new THREE.CylinderGeometry(dims.wheelRadius * 0.76, dims.wheelRadius * 0.76, 0.45, 16),
          cyanGlowMat
        );
        neonRing.rotation.z = Math.PI / 2;
        w.spinGroup.add(neonRing);
      } else if (tuning.wheelStyleId === 'monster_truck') {
        const mRadius = dims.isMoto ? 0.78 : 0.88;
        const mWidth = dims.isMoto ? 0.68 : 0.86;
        w.steerGroup.position.y = mRadius;
        if (!dims.isMoto) {
          w.steerGroup.position.x += Math.sign(w.steerGroup.position.x || 1) * 0.36;
        }
        while (w.spinGroup.children.length > 0) {
          w.spinGroup.remove(w.spinGroup.children[0]);
        }
        const bigTire = new THREE.Mesh(
          new THREE.CylinderGeometry(mRadius, mRadius, mWidth, 18),
          tireRubberMat
        );
        bigTire.rotation.z = Math.PI / 2;
        const bigRim = new THREE.Mesh(
          new THREE.CylinderGeometry(mRadius * 0.52, mRadius * 0.52, mWidth + 0.04, 14),
          wheelMat
        );
        bigRim.rotation.z = Math.PI / 2;
        w.spinGroup.add(bigTire, bigRim);

        const shock = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.72, 8),
          yellowHazardMat
        );
        shock.position.set(-Math.sign(w.steerGroup.position.x || 1) * 0.22, 0.42, 0);
        w.steerGroup.add(shock);
      }
    }
  }

  // --------------------------------------------------------------------------
  // G) LUZ NEON SUB-CHASSI (UNDERGLOW ADITIVO LEVE A 60 FPS) & CHAMA COLORIDA
  // --------------------------------------------------------------------------
  const ugEntry = CUSTOMS_UNDERGLOW.find((u) => u.id === tuning.underglowId) || CUSTOMS_UNDERGLOW[0];
  let underglowMesh = null;
  let flameTintMat = null;

  if (ugEntry.id !== 'off') {
    const ugMat = new THREE.MeshBasicMaterial({
      color: ugEntry.hex || 0x00f0ff,
      map: getUnderglowGradientTexture(),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    underglowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.w * 1.65, dims.d * 1.32),
      ugMat
    );
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.set(0, 0.07, 0);
    modGroup.add(underglowMesh);

    for (const sx of [-1, 1]) {
      const neonTube = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.07, dims.d * 0.74),
        ugMat
      );
      neonTube.position.set(sx * (dims.w * 0.48), 0.34 + bodyLiftY, 0);
      modGroup.add(neonTube);
    }

    flameTintMat = new THREE.MeshBasicMaterial({ color: ugEntry.hex || 0x00f0ff });
    if (root.userData.turboFlameMesh) {
      root.userData.turboFlameMesh.material = flameTintMat;
    }
    for (const jf of extraJetFlames) {
      if (jf.isMesh) jf.material = flameTintMat;
    }
  }

  root.add(modGroup);

  // Calcula e grava os atributos físicos reais (0–10) no veículo!
  const tunedSpec = computeTunedVehicleStats(baseSpec, tuning);
  root.userData.customTuning = tuning;
  root.userData.vehicleSpec = tunedSpec;
  root.userData._underglowMesh = underglowMesh;
  root.userData._flameTintMat = flameTintMat;
  root.userData._measuredBounds = dims;

  if (!isDirectGroup) {
    carObj.maxHp = tunedSpec.maxHp;
    carObj.hp = tunedSpec.maxHp;
  }

  ensureVehicleNightLights(root, tunedSpec);

  return tunedSpec;
}

/**
 * Atualiza a pulsação RGB em tempo real da Luz Neon Sub-Chassi e da Chama do Nitro!
 */
export function updateVehicleDynamicTuningFX(carObj, timeSec = 0) {
  const tuning = carObj?.mesh?.userData?.customTuning;
  if (!tuning || tuning.underglowId !== 'rgb') return 0x00f0ff;

  const hue = (timeSec * 0.38) % 1.0;
  const col = new THREE.Color().setHSL(hue, 1.0, 0.55);
  const ugMesh = carObj.mesh.userData._underglowMesh;
  if (ugMesh?.material) {
    ugMesh.material.color.copy(col);
  }
  const flameMat = carObj.mesh.userData._flameTintMat;
  if (flameMat) {
    flameMat.color.copy(col);
  }
  return col.getHex();
}

export function getVehicleCustomFlameHex(carObj, timeSec = 0) {
  const tuning = carObj?.mesh?.userData?.customTuning;
  if (!tuning || !tuning.underglowId || tuning.underglowId === 'off') return null;
  if (tuning.underglowId === 'rgb') {
    return updateVehicleDynamicTuningFX(carObj, timeSec);
  }
  return CUSTOMS_UNDERGLOW.find((u) => u.id === tuning.underglowId)?.hex ?? null;
}

// ============================================================================
// 5. FÍSICA DE VOO PARABÓLICO DOS CARROS LANÇADOS PELA RAMPA CUNHA (WEDGE RAM!)
// ============================================================================
export class StreetCustomsRuntime {
  constructor(world) {
    this.world = world;
    this.launchedCars = [];
  }

  /**
   * Joga qualquer carro atingido pela Rampa Cunha Frontal voando por cima do teto do jogador!
   */
  launchVehicleOverRoof(victimObj, playerPos, fwdX, fwdZ, impactSpeed) {
    if (!victimObj || victimObj.destroyed || victimObj._wedgeActive) return;

    victimObj._wedgeActive = true;
    victimObj.isGrabbed = true; // Pausa o controlador de trânsito de rua durante o voo!
    for (const col of victimObj.colliders || []) {
      col.disabled = true;
    }

    const spd = Math.max(18.0, Math.abs(impactSpeed));
    const upVel = THREE.MathUtils.clamp(14.5 + spd * 0.28, 15.5, 27.5);
    // Empurra levemente para cima/trás relativo ao avanço do jogador para passar limpíssimo por cima do teto!
    const sideJitter = (Math.random() - 0.5) * 5.0;
    const perpX = -fwdZ;
    const perpZ = fwdX;

    victimObj.mesh.position.y += 1.35;
    this.launchedCars.push({
      obj: victimObj,
      vel: new THREE.Vector3(
        fwdX * (spd * 0.25) + perpX * sideJitter,
        upVel,
        fwdZ * (spd * 0.25) + perpZ * sideJitter
      ),
      spinX: 5.2 + Math.random() * 2.5,
      spinZ: (Math.random() - 0.5) * 4.2,
      age: 0
    });

    soundFX.playLegoBreak(false);
    this.world.destructibles?.spawnFlameTrailParticle(
      victimObj.mesh.position.clone(),
      1.35
    );
  }

  update(dt) {
    for (let i = this.launchedCars.length - 1; i >= 0; i--) {
      const item = this.launchedCars[i];
      const obj = item.obj;
      if (!obj || obj.destroyed) {
        this.launchedCars.splice(i, 1);
        continue;
      }

      item.age += dt;
      item.vel.y -= 26.0 * dt;
      obj.mesh.position.addScaledVector(item.vel, dt);
      obj.mesh.rotation.x += item.spinX * dt;
      obj.mesh.rotation.z += item.spinZ * dt;

      const gx = obj.mesh.position.x;
      const gz = obj.mesh.position.z;
      const floorY = this.world.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(gx, gz, obj.mesh.position.y)
        : (this.world.getTerrainHeightAt?.(gx, gz) ?? 0);

      if (item.age > 0.18 && obj.mesh.position.y <= floorY + 0.15) {
        obj.mesh.position.y = floorY;
        obj.mesh.rotation.x = 0;
        obj.mesh.rotation.z = 0;
        obj.basePos.copy(obj.mesh.position);
        obj.baseRot.copy(obj.mesh.rotation);
        obj.groundY = floorY;
        obj._wedgeActive = false;
        obj.isGrabbed = false;

        for (const col of obj.colliders || []) {
          col.minX = gx - 1.4;
          col.maxX = gx + 1.4;
          col.minZ = gz - 2.4;
          col.maxZ = gz + 2.4;
          col.minY = floorY;
          col.maxY = floorY + 2.0;
          col.disabled = false;
        }

        this.world.destructibles?.damageObject(
          obj,
          45,
          new THREE.Vector3(gx, floorY + 0.5, gz)
        );
        this.launchedCars.splice(i, 1);
      }
    }
  }
}

// ============================================================================
// 6. CONSTRUÇÃO FÍSICA 3D DA OFICINA "LEGO CUSTOMS" EM X = 60, Z = -448 (92m x 96m)
// ============================================================================
export function buildLegoCustomsGarage(world, bx = 60, bz = -448, bw = 92, bd = 96) {
  world._addCityBlockSidewalk(bx, bz, bw, bd, LEGO_COLORS.sidewalk);

  const floorY = 0.30;
  const darkBrickGeos = [];
  const steelGeos = [];
  const yellowGeos = [];
  const cyanGeos = [];
  const redToolGeos = [];
  const blueNitroGeos = [];
  const tireBlackGeos = [];
  const glassGeos = [];

  // 6.1 Pátio Asfaltado Drive-Thru & Piso Epóxi Escuro da Oficina (82m x 86m)
  const yardW = bw - 8; // 84m (X = 18..102)
  const yardD = bd - 8; // 88m (Z = -492..-404)
  darkBrickGeos.push(makeTranslatedBox(yardW, 0.08, yardD, bx, floorY, bz));

  // Faixas-guia luminosas Ciano e Amarelo Alerta levando da Av. Central (Oeste) e Av. Z=-382 (Sul) até o Elevador Hidráulico!
  const liftX = 68.0;
  const liftZ = -454.0;
  yellowGeos.push(
    makeTranslatedBox(32.0, 0.05, 0.65, 33.0, floorY + 0.05, liftZ - 4.8),
    makeTranslatedBox(32.0, 0.05, 0.65, 33.0, floorY + 0.05, liftZ + 4.8),
    makeTranslatedBox(0.65, 0.05, 26.0, liftX - 4.8, floorY + 0.05, -417.0),
    makeTranslatedBox(0.65, 0.05, 26.0, liftX + 4.8, floorY + 0.05, -417.0)
  );
  cyanGeos.push(
    makeTranslatedBox(28.0, 0.06, 0.45, 35.0, floorY + 0.055, liftZ),
    makeTranslatedBox(0.45, 0.06, 22.0, liftX, floorY + 0.055, -419.0)
  );

  // 6.2 Galpão Automotivo Drive-Thru Aberto (58m x 56m: X = 39..97, Z = -482..-426, Altura = 14.5m)
  // 2 Portões Largos Sempre Abertos (20m largura x 9.5m altura): Portão Oeste (X = 39, Z = -454) & Portão Sul (X = 68, Z = -426)!
  const gMinX = 39.0;
  const gMaxX = 97.0;
  const gMinZ = -482.0;
  const gMaxZ = -426.0;
  const gW = gMaxX - gMinX; // 58m
  const gD = gMaxZ - gMinZ; // 56m
  const wallH = 14.2;
  const wallT = 1.8;
  const gateW = 20.0;
  const gateH = 9.6;

  // Parede Norte (Z = -482) — Fechada
  darkBrickGeos.push(makeTranslatedBox(gW, wallH, wallT, liftX, floorY + wallH * 0.5, gMinZ + wallT * 0.5));
  world.addCollider(liftX, gMinZ + wallT * 0.5, gW, wallT, floorY + wallH, floorY);

  // Parede Leste (X = 97) — Fechada
  darkBrickGeos.push(makeTranslatedBox(wallT, wallH, gD, gMaxX - wallT * 0.5, floorY + wallH * 0.5, liftZ));
  world.addCollider(gMaxX - wallT * 0.5, liftZ, wallT, gD, floorY + wallH, floorY);

  // Parede Sul (Z = -426) — Portão Drive-Thru Sul de 20m sempre aberto!
  const southSegW = (gW - gateW) * 0.5; // 19m de cada lado
  const sLeftX = gMinX + southSegW * 0.5;
  const sRightX = gMaxX - southSegW * 0.5;
  const sWallZ = gMaxZ - wallT * 0.5;
  darkBrickGeos.push(
    makeTranslatedBox(southSegW, wallH, wallT, sLeftX, floorY + wallH * 0.5, sWallZ),
    makeTranslatedBox(southSegW, wallH, wallT, sRightX, floorY + wallH * 0.5, sWallZ),
    makeTranslatedBox(gateW, wallH - gateH, wallT, liftX, floorY + gateH + (wallH - gateH) * 0.5, sWallZ)
  );
  yellowGeos.push(
    makeTranslatedBox(0.7, gateH, wallT + 0.25, liftX - gateW * 0.5, floorY + gateH * 0.5, sWallZ),
    makeTranslatedBox(0.7, gateH, wallT + 0.25, liftX + gateW * 0.5, floorY + gateH * 0.5, sWallZ),
    makeTranslatedBox(gW + 0.4, 0.75, wallT + 0.3, liftX, floorY + gateH + 0.4, sWallZ)
  );
  world.addCollider(sLeftX, sWallZ, southSegW, wallT, floorY + wallH, floorY);
  world.addCollider(sRightX, sWallZ, southSegW, wallT, floorY + wallH, floorY);
  world.addCollider(liftX, sWallZ, gateW, wallT, floorY + wallH, floorY + gateH);

  // Parede Oeste (X = 39) — Portão Drive-Thru Oeste de 20m sempre aberto virado para a Av. Central!
  const westSegD = (gD - gateW) * 0.5; // 18m de cada lado
  const wNorthZ = gMinZ + westSegD * 0.5;
  const wSouthZ = gMaxZ - westSegD * 0.5;
  const wWallX = gMinX + wallT * 0.5;
  darkBrickGeos.push(
    makeTranslatedBox(wallT, wallH, westSegD, wWallX, floorY + wallH * 0.5, wNorthZ),
    makeTranslatedBox(wallT, wallH, westSegD, wWallX, floorY + wallH * 0.5, wSouthZ),
    makeTranslatedBox(wallT, wallH - gateH, gateW, wWallX, floorY + gateH + (wallH - gateH) * 0.5, liftZ)
  );
  cyanGeos.push(
    makeTranslatedBox(wallT + 0.25, gateH, 0.7, wWallX, floorY + gateH * 0.5, liftZ - gateW * 0.5),
    makeTranslatedBox(wallT + 0.25, gateH, 0.7, wWallX, floorY + gateH * 0.5, liftZ + gateW * 0.5),
    makeTranslatedBox(wallT + 0.3, 0.75, gD + 0.4, wWallX, floorY + gateH + 0.4, liftZ)
  );
  world.addCollider(wWallX, wNorthZ, wallT, westSegD, floorY + wallH, floorY);
  world.addCollider(wWallX, wSouthZ, wallT, westSegD, floorY + wallH, floorY);
  world.addCollider(wWallX, liftZ, wallT, gateW, floorY + wallH, floorY + gateH);

  // Teto Industrial Metálico com Claraboia Central e Tubos Neon no Teto (Y = 14.5m)
  steelGeos.push(makeTranslatedBox(gW + 1.2, 1.1, gD + 1.2, liftX, floorY + wallH + 0.55, liftZ));
  glassGeos.push(makeTranslatedBox(22.0, 1.3, 22.0, liftX, floorY + wallH + 0.6, liftZ));
  world.addCollider(liftX, liftZ, gW + 1.2, gD + 1.2, floorY + wallH + 1.1, floorY + wallH);

  for (let nz = gMinZ + 8; nz <= gMaxZ - 8; nz += 10) {
    cyanGeos.push(makeTranslatedBox(gW - 8, 0.28, 0.55, liftX, floorY + wallH - 0.35, nz));
  }

  // 6.3 ELEVADOR HIDRÁULICO CENTRAL AMARELO/PRETO (`X = 68, Z = -454`) + CONSOLE DE DIAGNÓSTICO
  steelGeos.push(makeTranslatedBox(9.2, 0.14, 11.6, liftX, floorY + 0.08, liftZ));
  yellowGeos.push(
    // Duas rampas paralelas do elevador automotivo (baixas em 0.16m para qualquer carro subir suave!)
    makeTranslatedBox(1.35, 0.18, 9.8, liftX - 1.95, floorY + 0.12, liftZ),
    makeTranslatedBox(1.35, 0.18, 9.8, liftX + 1.95, floorY + 0.12, liftZ),
    // 2 Colunas Hidráulicas Laterais (X = liftX ± 4.6m -> 9.2m de vão livre no meio!)
    makeTranslatedBox(0.95, 6.2, 0.95, liftX - 4.65, floorY + 3.1, liftZ),
    makeTranslatedBox(0.95, 6.2, 0.95, liftX + 4.65, floorY + 3.1, liftZ),
    makeTranslatedBox(10.2, 0.55, 0.95, liftX, floorY + 6.35, liftZ)
  );
  cyanGeos.push(
    makeTranslatedBox(9.6, 0.12, 0.32, liftX, floorY + 0.14, liftZ - 5.6),
    makeTranslatedBox(9.6, 0.12, 0.32, liftX, floorY + 0.14, liftZ + 5.6),
    makeTranslatedBox(8.8, 0.24, 0.45, liftX, floorY + 6.0, liftZ)
  );
  world.addCollider(liftX - 4.65, liftZ, 1.1, 1.1, floorY + 6.5, floorY);
  world.addCollider(liftX + 4.65, liftZ, 1.1, 1.1, floorY + 6.5, floorY);

  // Console Tático ao lado do Elevador Hidráulico
  const consolePos = { x: liftX + 5.8, y: floorY, z: liftZ + 2.8 };
  redToolGeos.push(makeTranslatedBox(1.8, 1.45, 1.4, consolePos.x, floorY + 0.72, consolePos.z));
  cyanGeos.push(makeTranslatedBox(1.4, 0.85, 0.18, consolePos.x - 0.1, floorY + 1.75, consolePos.z));

  // 6.4 BANCADAS DE FERRAMENTAS VERMELHAS, PILHAS DE PNEUS LEGO E CILINDROS DE NITRO AZUIS!
  // Bancadas de ferramentas na parede Norte
  for (let bxOff = -18; bxOff <= 18; bxOff += 12) {
    redToolGeos.push(
      makeTranslatedBox(7.5, 1.6, 2.2, liftX + bxOff, floorY + 0.8, gMinZ + 3.2),
      makeTranslatedBox(7.5, 1.8, 0.6, liftX + bxOff, floorY + 3.4, gMinZ + 2.3)
    );
    steelGeos.push(makeTranslatedBox(7.7, 0.18, 2.4, liftX + bxOff, floorY + 1.65, gMinZ + 3.2));
    world.addCollider(liftX + bxOff, gMinZ + 3.2, 7.7, 2.4, floorY + 3.5, floorY);
  }

  // Cilindros de Nitro (NOS) Azuis na Parede Leste
  for (let i = 0; i < 8; i++) {
    const cz = liftZ - 14 + i * 3.8;
    const cyl = new THREE.CylinderGeometry(0.45, 0.45, 2.6, 12);
    cyl.translate(gMaxX - 3.2, floorY + 1.3, cz);
    blueNitroGeos.push(cyl);
    yellowGeos.push(makeTranslatedBox(0.35, 0.35, 0.35, gMaxX - 3.2, floorY + 2.72, cz));
  }
  world.addCollider(gMaxX - 3.2, liftZ, 1.8, 30.0, floorY + 3.0, floorY);

  // Pilhas de Pneus LEGO nos cantos internos e na frente da oficina
  const tireStacks = [
    [gMinX + 4.2, gMinZ + 5.5, 4],
    [gMinX + 6.8, gMinZ + 5.5, 3],
    [gMaxX - 4.5, gMaxZ - 5.5, 4],
    [gMinX - 2.8, liftZ - 13.0, 3],
    [gMinX - 2.8, liftZ + 13.0, 3]
  ];
  for (const [tx, tz, count] of tireStacks) {
    for (let k = 0; k < count; k++) {
      const tg = new THREE.CylinderGeometry(1.05, 1.05, 0.68, 16);
      tg.translate(tx, floorY + 0.35 + k * 0.7, tz);
      tireBlackGeos.push(tg);
    }
    world.addCollider(tx, tz, 2.2, 2.2, floorY + count * 0.72, floorY);
  }

  // 6.5 TERMINAL EXTERNO DE RETIRADA DOS 3 CARROS SALVOS NA GARAGEM PESSOAL (`X = 32, Z = -416`)
  const retrievalTerminalPos = { x: 33.5, y: floorY, z: -416.0 };
  const deliverySpawnPos = { x: 25.0, y: floorY + 0.08, z: -416.0, rotY: 0 };
  darkBrickGeos.push(makeTranslatedBox(2.2, 2.4, 1.6, retrievalTerminalPos.x, floorY + 1.2, retrievalTerminalPos.z));
  yellowGeos.push(
    makeTranslatedBox(2.4, 0.25, 1.8, retrievalTerminalPos.x, floorY + 2.48, retrievalTerminalPos.z),
    makeTranslatedBox(6.6, 0.06, 10.5, deliverySpawnPos.x, floorY + 0.05, deliverySpawnPos.z)
  );
  cyanGeos.push(makeTranslatedBox(1.6, 0.95, 0.16, retrievalTerminalPos.x - 0.95, floorY + 1.65, retrievalTerminalPos.z));
  world.addCollider(retrievalTerminalPos.x, retrievalTerminalPos.z, 2.2, 1.6, floorY + 2.6, floorY);

  // 6.6 LETREIROS NEON GIGANTES NO TOPO E NOS 2 PORTÕES ABERTOS!
  const mainRoofSignW = createSignBoardMesh({
    x: gMinX - 0.5,
    y: floorY + wallH + 4.2,
    z: liftZ,
    width: 34.0,
    height: 5.4,
    depth: 0.9,
    rotY: -Math.PI / 2,
    title: 'LEGO CUSTOMS • TUNING & NITRO',
    subText: 'MOTOR NV.10 • PINTURA • ADESIVOS • RAMPA CUNHA',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#facc15',
    subColor: '#00f0ff'
  });
  const mainRoofSignS = createSignBoardMesh({
    x: liftX,
    y: floorY + wallH + 4.2,
    z: gMaxZ + 0.5,
    width: 34.0,
    height: 5.4,
    depth: 0.9,
    rotY: 0,
    title: 'LEGO CUSTOMS • OFICINA DE RUA',
    subText: 'DRIVE-THRU ABERTO • ENTRE COM SEU VEÍCULO [E]',
    bgColor: '#090a0d',
    borderColor: '#00f0ff',
    textColor: '#facc15',
    subColor: '#f8fafc'
  });
  const westGateSign = createSignBoardMesh({
    x: gMinX - 0.35,
    y: floorY + gateH + 2.1,
    z: liftZ,
    width: 19.5,
    height: 2.3,
    depth: 0.45,
    rotY: -Math.PI / 2,
    title: '► BOX HIDRÁULICO // TUNAR [E]',
    subText: 'CARROS & MOTOS • REGULAGEM 0 A 10',
    bgColor: '#090a0d',
    borderColor: '#00f0ff',
    textColor: '#00f0ff',
    subColor: '#facc15'
  });
  const southGateSign = createSignBoardMesh({
    x: liftX,
    y: floorY + gateH + 2.1,
    z: gMaxZ + 0.35,
    width: 19.5,
    height: 2.3,
    depth: 0.45,
    rotY: 0,
    title: '▲ ENTRADA DRIVE-THRU // LEGO CUSTOMS',
    subText: 'PINTURA • MONSTER TRUCK • UNDERGLOW NEON',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#facc15',
    subColor: '#00f0ff'
  });
  world.scene.add(mainRoofSignW, mainRoofSignS, westGateSign, southGateSign);

  // Merge estático em 8 Draw Calls para manter 60 FPS cravados!
  const addMerged = (geos, mat, cast = false) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeBufferGeometries(geos), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    world.scene.add(m);
  };

  addMerged(darkBrickGeos, getLegoMaterial(0x111827, { roughness: 0.36 }), true);
  addMerged(steelGeos, getLegoMaterial(0x475569, { metalness: 0.5, roughness: 0.25 }), true);
  addMerged(yellowGeos, getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.5 }));
  addMerged(cyanGeos, new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
  addMerged(redToolGeos, getLegoMaterial(0xdc2626, { roughness: 0.22, clearcoat: 0.45 }));
  addMerged(blueNitroGeos, getLegoMaterial(0x0284c7, { metalness: 0.45, roughness: 0.18 }));
  addMerged(tireBlackGeos, getLegoMaterial(0x090a0d, { roughness: 0.7 }));
  addMerged(
    glassGeos,
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.38,
      roughness: 0.1
    })
  );

  // Registra contorno destacado no Minimapa e Mapa [M]
  world.mapBuildings.push({
    x: liftX,
    z: liftZ,
    w: gW,
    d: gD,
    height: wallH,
    color: '#1e293b',
    isLandmark: true,
    label: 'LEGO CUSTOMS'
  });

  // 6.7 Estaciona 2 Carros Esportivos no Pátio Externo Oeste para quem chegar a pé já pegar e tunar!
  const courtesyCars = [
    { x: 25.0, z: -474.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: 0x090a0d, type: 'apex_gtx' },
    { x: 25.0, z: -484.0, rotY: Math.PI / 2, color: 0xf97316, roofColor: 0xf8fafc, type: 'trovao_v8' }
  ];
  for (const cfg of courtesyCars) {
    spawnDraggableCustomVehicle(world, cfg);
  }

  if (!world.customsRuntime) {
    world.customsRuntime = new StreetCustomsRuntime(world);
  }

  world.legoCustomsData = {
    liftPos: { x: liftX, y: floorY + 0.16, z: liftZ },
    consolePos,
    retrievalTerminalPos,
    deliverySpawnPos,
    courtyardExitPos: { x: 25.5, y: floorY + 0.08, z: liftZ, rotY: -Math.PI / 2 }
  };
}

/**
 * Cria e registra um veículo dirigível completo no mundo (usado no pátio da oficina e ao chamar carros salvos!)
 */
export function spawnDraggableCustomVehicle(world, cfg, customTuning = null) {
  const type = customTuning?.carType || cfg.type || 'apex_gtx';
  const spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.apex_gtx;
  const carGroup = createLegoCarMesh({
    type,
    color: cfg.color ?? 0xfacc15,
    roofColor: cfg.roofColor ?? 0x090a0d
  });

  const yBase = cfg.y ?? (world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.x, cfg.z) : 0) + 0.3;
  carGroup.position.set(cfg.x, yBase, cfg.z);
  carGroup.rotation.y = cfg.rotY || 0;
  carGroup.userData.carType = type;
  carGroup.userData.carName = spec.name;
  carGroup.userData.vehicleSpec = spec;
  world.scene.add(carGroup);

  const isMoto = Boolean(spec.isMotorcycle);
  const isBus = type === 'onibus_urbano';
  const baseW = isMoto ? 1.45 : isBus ? 2.9 : 2.5;
  const baseD = isMoto ? 3.8 : isBus ? 8.5 : 5.0;
  const col1 = world.addCollider(cfg.x, cfg.z, baseW, baseD, yBase + 1.25, yBase);
  const col2 = world.addCollider(cfg.x, cfg.z, baseW * 0.85, baseD * 0.6, yBase + (isBus ? 2.95 : 2.05), yBase);

  let entry = null;
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: carGroup,
      type: 'car',
      hp: spec.hp,
      radius: Math.max(baseW, baseD) * 0.52,
      height: isBus ? 3.0 : 2.1,
      colliders: [col1, col2],
      debrisColors: [0xfacc15, 0x090a0d, 0xdc2626, 0x38bdf8],
      studDrops: spec.studDrops,
      groundY: yBase
    });
    entry = world.destructibles.objects[world.destructibles.objects.length - 1];
  }

  if (entry && customTuning) {
    applyTuningToVehicleObject(entry, customTuning);
  }

  return entry;
}

// ============================================================================
// 7. ÍCONES VETORIAIS TÉCNICOS (PRO TUNER / ECU DIAGNOSTIC — ZERO EMOJIS)
// ============================================================================
const CUSTOMS_SVGS = {
  minus: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3.5 8h9"/></svg>`,
  plus: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>`,
  bolt: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M9 1.5L3.5 9h4l-.5 5.5L12.5 7h-4L9 1.5z"/></svg>`,
  check: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>`,
  stud: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><ellipse cx="8" cy="5.2" rx="4.6" ry="2"/><path d="M3.4 5.2v5.4c0 1.1 2.06 2 4.6 2s4.6-.9 4.6-2V5.2"/><ellipse cx="8" cy="3.5" rx="2.1" ry="0.85"/></svg>`,
  save: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2.5h8l2.5 2.5v8.5H3z"/><path d="M5.5 2.5v3.5h5V2.5M5 13.5V9.5h6v4"/></svg>`,
  launch: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12L12 4M6.5 4H12v5.5"/></svg>`
};

const PAID_PART_CATALOGS = {
  roofModId: CUSTOMS_ROOF_MODS,
  exhaustModId: CUSTOMS_EXHAUST_MODS,
  windowTintId: CUSTOMS_WINDOW_TINTS
};

// ============================================================================
// 8. ESTÚDIO 360° INTERATIVO "LS CUSTOMS // PRO TUNER" (ECU/DYNO SHOWROOM)
// ============================================================================
export class LegoCustomsStudio {
  constructor(hud) {
    this.hud = hud;
    this.isOpen = false;
    this.activeTab = 'performance'; // 'performance' | 'paint' | 'bodykit' | 'roof_wheels' | 'garage'
    this.controller = null;
    this.world = null;
    this.targetCarObj = null;
    this.activeVehicle = null;
    this.draft = null;
    this._savedSnapshot = null;
    this.cameraOrbitAngle = 0.65;
    this.cameraPitch = 0.33;
    this.cameraZoom = 1.0;
    this.autoOrbit = true;
    this.previewNitroTimer = 0;
    this.previewHydraulicTimer = 0;
    this._previewHydPhase = 0;
    this._isDraggingViewport = false;
    this._dragLastX = 0;
    this._dragLastY = 0;
    this.feedbackMsg = '';
    this._spawnedGarageCar = null;

    this.modalEl = document.getElementById('lego-customs-modal');
    this._bindModalControls();
  }

  _normalizeTabName(tab) {
    if (tab === 'mods') return 'bodykit';
    if (
      tab === 'performance' ||
      tab === 'paint' ||
      tab === 'bodykit' ||
      tab === 'roof_wheels' ||
      tab === 'garage'
    ) {
      return tab;
    }
    return 'performance';
  }

  _measureVehicleBounds(vehicleObj) {
    return measureVehicleBounds(vehicleObj || this.activeVehicle || this.targetCarObj);
  }

  _bindModalControls() {
    if (!this.modalEl) return;

    const bindBtn = (id, handler) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (btn.style) btn.style.pointerEvents = 'auto';
      btn.addEventListener('click', handler);
    };

    bindBtn('btn-customs-close', () => {
      this.close(false);
    });
    bindBtn('btn-customs-reset-stock', () => {
      this.resetToStock();
    });
    bindBtn('btn-customs-apply-drive', () => {
      this.hud.saveCurrentProgress?.();
      soundFX.playTrueHeroFanfare?.();
      this.close(true);
    });
    bindBtn('btn-customs-rot-left', () => {
      this.autoOrbit = false;
      this.cameraOrbitAngle -= 0.42;
      this._syncOrbitButtonState();
    });
    bindBtn('btn-customs-rot-right', () => {
      this.autoOrbit = false;
      this.cameraOrbitAngle += 0.42;
      this._syncOrbitButtonState();
    });
    bindBtn('btn-customs-toggle-orbit', () => {
      this.autoOrbit = !this.autoOrbit;
      this._syncOrbitButtonState();
    });
    bindBtn('btn-customs-test-nitro', () => {
      this.triggerNitroPreview();
    });
    bindBtn('btn-customs-test-hydraulics', () => {
      this.triggerHydraulicsPreview();
    });

    const tabMap = {
      'btn-customs-tab-perf': 'performance',
      'btn-customs-tab-paint': 'paint',
      'btn-customs-tab-mods': 'bodykit',
      'btn-customs-tab-roof': 'roof_wheels',
      'btn-customs-tab-garage': 'garage'
    };
    for (const [btnId, tabName] of Object.entries(tabMap)) {
      bindBtn(btnId, () => {
        this.activeTab = tabName;
        soundFX.playPlasticHit?.();
        this._renderModalBody();
      });
    }

    // Rotação 360° (horizontal), Pitch (vertical) e Zoom (Scroll) na Área Livre do Showroom!
    const isInsideUiCard = (target) => {
      if (!target || typeof target.closest !== 'function') return false;
      return Boolean(
        target.closest('.customs-side-panel, .customs-telemetry-bar, .customs-showroom-controls')
      );
    };

    this.modalEl.addEventListener('pointerdown', (ev) => {
      if (!this.isOpen || isInsideUiCard(ev.target)) return;
      this._isDraggingViewport = true;
      this.autoOrbit = false;
      this._dragLastX = ev.clientX || 0;
      this._dragLastY = ev.clientY || 0;
      this._syncOrbitButtonState();
    });

    this.modalEl.addEventListener('pointermove', (ev) => {
      if (!this.isOpen || !this._isDraggingViewport) return;
      const cx = ev.clientX || 0;
      const cy = ev.clientY || 0;
      const dx = cx - this._dragLastX;
      const dy = cy - this._dragLastY;
      this._dragLastX = cx;
      this._dragLastY = cy;
      this.cameraOrbitAngle += dx * 0.0085;
      this.cameraPitch = THREE.MathUtils.clamp((this.cameraPitch || 0.33) + dy * 0.005, 0.08, 0.82);
    });

    const stopDrag = () => {
      this._isDraggingViewport = false;
    };
    this.modalEl.addEventListener('pointerup', stopDrag);
    this.modalEl.addEventListener('pointercancel', stopDrag);
    this.modalEl.addEventListener('pointerleave', stopDrag);

    this.modalEl.addEventListener(
      'wheel',
      (ev) => {
        if (!this.isOpen || isInsideUiCard(ev.target)) return;
        ev.preventDefault?.();
        const dir = Math.sign(ev.deltaY || 0);
        if (dir !== 0) {
          this.cameraZoom = THREE.MathUtils.clamp((this.cameraZoom || 1.0) + dir * 0.08, 0.62, 1.65);
        }
      },
      { passive: false }
    );
  }

  _syncOrbitButtonState() {
    const orbitBtn = document.getElementById('btn-customs-toggle-orbit');
    if (orbitBtn?.classList) {
      orbitBtn.classList.toggle('active', Boolean(this.autoOrbit));
    }
  }

  triggerNitroPreview() {
    this.previewNitroTimer = 1.8;
    soundFX.playFireballCast?.();
    soundFX.playCarEngineStart?.();
    this._setFeedback('TESTE DE BANCADA ECU: LABAREDAS DO NITRO & ESCAPAMENTO ATIVADAS (1.8s)');
  }

  triggerHydraulicsPreview() {
    this.previewHydraulicTimer = 1.65;
    this._previewHydPhase = 0;
    soundFX.playTacticalRoll?.();
    soundFX.playSeismicStomp?.();
    this._setFeedback('TESTE DE BANCADA: SUSPENSÃO HIDRÁULICA ACIONADA NO ELEVADOR');
  }

  resetToStock() {
    if (!this.targetCarObj) return;
    this.draft = createDefaultVehicleTuning(this.targetCarObj);
    soundFX.playHeroSwap?.();
    this._applyLiveDraftToCar();
    this._renderModalBody();
    this._setFeedback('CONFIGURAÇÃO ORIGINAL DE FÁBRICA (STOCK) RESTAURADA NO VEÍCULO');
  }

  _setStudioUiOverlayMode(active) {
    if (typeof document === 'undefined') return;
    if (active) {
      document.exitPointerLock?.();
      document.body?.classList?.add('customs-studio-open');
      if (document.body?.style) document.body.style.cursor = 'default';
      const ch = document.getElementById('crosshair');
      if (ch?.style) ch.style.display = 'none';
      document.getElementById('vehicle-prompt')?.classList?.add('hidden');
      document.getElementById('pointer-prompt')?.classList?.add('hidden');
      if (this.modalEl?.style) this.modalEl.style.pointerEvents = 'auto';
      if (typeof this.modalEl?.querySelectorAll === 'function') {
        this.modalEl
          .querySelectorAll(
            '.customs-side-panel, .customs-showroom-controls, .creator-studio-turntable-controls, .customs-telemetry-bar'
          )
          .forEach((el) => {
            if (el?.style) el.style.pointerEvents = 'auto';
          });
      }
    } else {
      document.body?.classList?.remove('customs-studio-open');
      if (document.body?.style) document.body.style.cursor = '';
      const ch = document.getElementById('crosshair');
      if (ch?.style) ch.style.display = '';
    }
  }

  open(controller, world, explicitCar = null, startTab = 'performance') {
    if (!controller || !world) return false;

    let carObj = explicitCar || controller.currentVehicle || controller.findNearbyVehicle?.();
    if (!carObj && world.destructibles) {
      const lift = world.legoCustomsData?.liftPos || { x: 68, y: 0.46, z: -454 };
      let bestD = 38.0;
      for (const obj of world.destructibles.objects) {
        if (obj.destroyed || obj.type !== 'car') continue;
        const spec = obj.mesh?.userData?.vehicleSpec;
        if (spec?.category || spec?.isColossalShip) continue;
        const d = Math.hypot(obj.mesh.position.x - lift.x, obj.mesh.position.z - lift.z);
        if (d < bestD) {
          bestD = d;
          carObj = obj;
        }
      }
      if (!carObj) {
        carObj = spawnDraggableCustomVehicle(world, {
          x: lift.x,
          y: lift.y,
          z: lift.z,
          rotY: -Math.PI / 2,
          type: 'apex_gtx',
          color: 0xfacc15,
          roofColor: 0x090a0d
        });
      }
    }

    if (!carObj) return false;
    const spec = carObj.mesh?.userData?.vehicleSpec;
    if (spec?.category || spec?.isColossalShip) return false;

    this.controller = controller;
    this.world = world;
    this.targetCarObj = carObj;
    this.activeVehicle = carObj;
    this.isOpen = true;
    this.activeTab = this._normalizeTabName(startTab);
    this.autoOrbit = true;
    this.cameraPitch = 0.33;
    this.cameraZoom = 1.0;
    this.previewNitroTimer = 0;
    this.previewHydraulicTimer = 0;
    this._previewHydPhase = 0;
    this._isDraggingViewport = false;
    this.feedbackMsg = '';

    const entryCheckPos = carObj.mesh?.position?.clone?.() || controller.position?.clone?.();
    const wantedSys = world?.livingCity?.wantedSystem;
    this._enteredUnseenByPolice = !(
      wantedSys &&
      wantedSys.stars > 0 &&
      wantedSys.hasCloseWitnessOnGarageEntry(entryCheckPos, 28.0)
    );

    if (controller.currentVehicle !== carObj) {
      if (controller.currentVehicle) controller.exitVehicle();
      controller.enterVehicle(carObj);
    }

    const lift = world.legoCustomsData?.liftPos || { x: 68, y: 0.46, z: -454 };
    controller.vehicleSpeed = 0;
    controller.vehicleAirVelY = 0;
    controller.isTurboActive = false;
    controller.isDrifting = false;
    controller.vehicleHeading = -Math.PI / 2;
    carObj.mesh.position.set(lift.x, lift.y, lift.z);
    carObj.mesh.rotation.set(0, -Math.PI / 2, 0);
    controller.position.set(lift.x, lift.y, lift.z);

    const existing = {
      ...createDefaultVehicleTuning(carObj),
      ...(carObj.mesh.userData?.customTuning || {})
    };
    this._savedSnapshot = JSON.parse(JSON.stringify(existing));
    this.draft = JSON.parse(JSON.stringify(existing));

    const ul = getActiveGarageSaveData().unlockedLevels;
    for (const attr of UPGRADE_ATTRIBUTES) {
      const k = attr.id;
      this.draft.levels[k] = clampInt(this.draft.levels[k], 0, ul[k] || 0);
    }

    this._setStudioUiOverlayMode(true);
    this._syncOrbitButtonState();
    this._setFeedback('');

    this._applyLiveDraftToCar();
    this._renderModalBody();
    this.modalEl?.classList.remove('hidden');
    soundFX.playCarEngineStart?.();
    return true;
  }

  close(keepChanges = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._isDraggingViewport = false;
    this.previewNitroTimer = 0;
    this.previewHydraulicTimer = 0;
    this.modalEl?.classList.add('hidden');
    this._setStudioUiOverlayMode(false);

    if (!keepChanges && this._savedSnapshot && this.targetCarObj) {
      applyTuningToVehicleObject(this.targetCarObj, this._savedSnapshot);
    } else if (this.targetCarObj && this.draft) {
      applyTuningToVehicleObject(this.targetCarObj, this.draft);
      if (
        this._savedSnapshot &&
        (this.draft.primaryColorId !== this._savedSnapshot.primaryColorId ||
          this.draft.secondaryColorId !== this._savedSnapshot.secondaryColorId)
      ) {
        this._tryTriggerPayNSprayEscape();
      }
    }

    if (this.controller && this.targetCarObj && this.world?.legoCustomsData?.courtyardExitPos) {
      const ex = this.world.legoCustomsData.courtyardExitPos;
      this.targetCarObj.mesh.position.set(ex.x, ex.y, ex.z);
      this.targetCarObj.mesh.rotation.set(0, ex.rotY, 0);
      this.controller.vehicleHeading = ex.rotY;
      this.controller.position.set(ex.x, ex.y, ex.z);
      this.controller._customsExitCooldown = 2.0;
    }

    this.controller?.relockPointer?.();
  }

  updateStudioCamera(dt) {
    const vehicle = this.activeVehicle || this.targetCarObj;
    if (!this.isOpen || !this.controller || !vehicle?.mesh) return;

    const safeDt = Math.min(0.1, Math.max(0, Number(dt) || 0.016));
    const lift = this.world?.legoCustomsData?.liftPos || { x: 68, y: 0.46, z: -454 };
    const carMesh = vehicle.mesh;

    // 1. Demonstração ao vivo de Suspensão Hidráulica sobre o Elevador
    let hydBounceY = 0;
    let hydPitchX = 0;
    if (this.previewHydraulicTimer > 0) {
      this.previewHydraulicTimer = Math.max(0, this.previewHydraulicTimer - safeDt);
      this._previewHydPhase += safeDt * 12.0;
      const env = Math.min(1.0, this.previewHydraulicTimer * 2.2);
      hydBounceY = Math.abs(Math.sin(this._previewHydPhase)) * 1.12 * env;
      hydPitchX = Math.sin(this._previewHydPhase) * 0.16 * env;
    }

    carMesh.position.set(lift.x, lift.y + hydBounceY, lift.z);
    carMesh.rotation.set(hydPitchX, -Math.PI / 2, 0);

    // 2. Pulso RGB e Demonstração ao vivo de Nitro / Labaredas nos Escapamentos & Turbinas
    const nowSec = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
    updateVehicleDynamicTuningFX(vehicle, nowSec);

    if (this.previewNitroTimer > 0) {
      this.previewNitroTimer = Math.max(0, this.previewNitroTimer - safeDt);
    }

    const showFlames = this.previewNitroTimer > 0;
    const flamePulse = showFlames ? 0.88 + 0.28 * Math.sin(nowSec * 38.0) : 1.0;

    if (Array.isArray(carMesh.userData?.turboFlames)) {
      for (const fg of carMesh.userData.turboFlames) {
        if (!fg) continue;
        fg.visible = showFlames;
        if (fg.scale) fg.scale.setScalar(flamePulse);
      }
    }
    carMesh.traverse?.((node) => {
      if (node?.userData?.isNitroFlame) {
        node.visible = showFlames;
        if (node.scale && !carMesh.userData?.turboFlames?.includes(node)) {
          node.scale.setScalar(flamePulse);
        }
      }
    });

    // 3. Enquadramento Perfeito da Câmera 3D nos 69% Livres à Esquerda (Carros, Motos, Caminhões & Ônibus)
    if (this.autoOrbit) {
      this.cameraOrbitAngle += safeDt * 0.44;
    }

    const dims = this._measureVehicleBounds(vehicle);
    let baseRadius = 8.5;
    if (dims.isMoto) {
      baseRadius = 6.8;
    } else if (dims.d > 5.2) {
      baseRadius = Math.max(9.8, dims.d * 1.38);
    }
    const radius = baseRadius * (this.cameraZoom || 1.0);
    const pitch = THREE.MathUtils.clamp(this.cameraPitch || 0.33, 0.08, 0.82);

    const camX = lift.x + Math.cos(this.cameraOrbitAngle) * radius;
    const camZ = lift.z + Math.sin(this.cameraOrbitAngle) * radius;
    const camY = lift.y + Math.max(1.25, radius * Math.sin(pitch));

    this.controller.camera.position.set(camX, camY, camZ);

    // Vetor direção da câmera ao centro do elevador no plano XZ e vetor DIREITA da câmera:
    const rawDirX = lift.x - camX;
    const rawDirZ = lift.z - camZ;
    const dirLen = Math.hypot(rawDirX, rawDirZ) || 1.0;
    const dirX = rawDirX / dirLen;
    const dirZ = rawDirZ / dirLen;
    const camRightX = -dirZ;
    const camRightZ = dirX;
    const offsetRight = radius * 0.24;

    const focusY = lift.y + Math.max(0.95, dims.fullH * 0.44);
    this.controller.camera.lookAt(
      lift.x + camRightX * offsetRight,
      focusY,
      lift.z + camRightZ * offsetRight
    );
  }

  _applyLiveDraftToCar() {
    if (!this.targetCarObj || !this.draft) return;
    const tuned = applyTuningToVehicleObject(this.targetCarObj, this.draft);
    this._updateTelemetryBox(tuned);
  }

  _tryTriggerPayNSprayEscape() {
    const ws = this.world?.livingCity?.wantedSystem;
    if (!ws || ws.stars <= 0) return false;
    if (this._enteredUnseenByPolice) {
      ws.clearWantedByPaintJob();
      this._setFeedback('PINTURA NOVA APLICADA: POLÍCIA DESPISTADA — NÍVEL DE PROCURADO ZERADO');
      return true;
    }
    this._setFeedback('ALERTA ECU: VIATURA TESTEMUNHOU SUA ENTRADA NO BOX — DESPISTE ANTES DE PINTAR');
    return false;
  }

  applyPaintColor(primaryColorId, secondaryColorId = null) {
    if (!this.draft) return false;
    const changed =
      (primaryColorId && primaryColorId !== this.draft.primaryColorId) ||
      (secondaryColorId && secondaryColorId !== this.draft.secondaryColorId);
    if (primaryColorId) this.draft.primaryColorId = primaryColorId;
    if (secondaryColorId) this.draft.secondaryColorId = secondaryColorId;
    this._applyLiveDraftToCar();
    this._renderModalBody();
    if (changed) {
      return this._tryTriggerPayNSprayEscape();
    }
    return false;
  }

  _updateTelemetryBox(tuned) {
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    const setPct = (id, ratio) => {
      const el = document.getElementById(id);
      if (el?.style) {
        const pct = Math.round(THREE.MathUtils.clamp(ratio, 0.04, 1.0) * 100);
        el.style.width = `${pct}%`;
      }
    };

    const dims = this._measureVehicleBounds(this.activeVehicle || this.targetCarObj);
    setTxt('customs-vehicle-class-badge', dims.vehicleClassLabel || 'CARRO');
    setTxt('customs-car-title', (this.draft?.customName || tuned?.name || 'VEÍCULO').toUpperCase());

    const kmh = tuned?.kmh || 200;
    const nitroKmh = tuned?.turboKmh || 250;
    const hp = tuned?.maxHp || 250;
    const jumpM = tuned?.jumpHeightMeters || 0;

    setTxt('customs-stat-kmh', `${kmh} KM/H`);
    setTxt('customs-stat-nitro', `${nitroKmh} KM/H`);
    setTxt('customs-stat-hp', `${hp} HP`);
    setTxt('customs-stat-jump', jumpM > 0 ? `${jumpM.toFixed(1)} M` : 'STOCK (0M)');
    setTxt('customs-studs-balance', `${(this.hud?.totalStuds || 0).toLocaleString('pt-BR')}`);

    setPct('customs-bar-kmh', kmh / 650);
    setPct('customs-bar-nitro', nitroKmh / 780);
    setPct('customs-bar-hp', hp / 3000);
    setPct('customs-bar-jump', jumpM / 16.0);
  }

  _setFeedback(msg) {
    this.feedbackMsg = msg;
    const fbEl = document.getElementById('customs-feedback-banner');
    if (fbEl) {
      fbEl.textContent = msg;
      fbEl.classList.toggle('hidden', !msg);
    }
  }

  _isPartUnlocked(fieldName, item) {
    if (!item || !item.cost || item.cost <= 0) return true;
    const gData = getActiveGarageSaveData();
    return Boolean(gData.unlockedParts?.[`${fieldName}:${item.id}`]);
  }

  _renderSwatches(selectedId, fieldName) {
    return CUSTOMS_PAINT_PALETTE.map(
      (c) => `
      <button type="button" class="creator-swatch customs-swatch ${c.id === selectedId ? 'active' : ''}"
        data-customs-field="${fieldName}" data-val="${c.id}"
        title="${c.name}" style="background:${c.css};pointer-events:auto;"></button>
    `
    ).join('');
  }

  _renderChips(selectedId, list, fieldName) {
    return list
      .map((item) => {
        const isSelected = item.id === selectedId;
        const unlocked = this._isPartUnlocked(fieldName, item);
        const priceBadge =
          item.cost > 0 && !unlocked
            ? `<span class="customs-part-cost">${item.cost.toLocaleString('pt-BR')} STUDS</span>`
            : isSelected && item.cost > 0
              ? `<span class="customs-part-owned">INSTALADO</span>`
              : '';
        return `
        <button type="button" class="creator-chip customs-part-chip ${isSelected ? 'active' : ''}"
          data-customs-field="${fieldName}" data-val="${item.id}" style="pointer-events:auto;">
          <span class="customs-chip-label">${item.name}</span>
          ${priceBadge}
        </button>
      `;
      })
      .join('');
  }

  _renderPartCards(selectedId, list, fieldName) {
    return list
      .map((item) => {
        const isSelected = item.id === selectedId;
        const unlocked = this._isPartUnlocked(fieldName, item);
        const rightTag =
          item.cost > 0 && !unlocked
            ? `<span class="customs-part-cost">${CUSTOMS_SVGS.stud} ${item.cost.toLocaleString('pt-BR')}</span>`
            : isSelected
              ? `<span class="customs-part-owned">${CUSTOMS_SVGS.check} INSTALADO</span>`
              : `<span class="customs-part-free">DISPONÍVEL</span>`;
        return `
        <button type="button" class="creator-power-card customs-part-card ${isSelected ? 'active' : ''}"
          data-customs-field="${fieldName}" data-val="${item.id}" style="pointer-events:auto;">
          <span class="creator-pow-title">${item.name}</span>
          ${rightTag}
        </button>
      `;
      })
      .join('');
  }

  _renderModalBody() {
    const bodyEl = document.getElementById('customs-panel-body');
    const tabPerf = document.getElementById('btn-customs-tab-perf');
    const tabPaint = document.getElementById('btn-customs-tab-paint');
    const tabMods = document.getElementById('btn-customs-tab-mods');
    const tabRoof = document.getElementById('btn-customs-tab-roof');
    const tabGar = document.getElementById('btn-customs-tab-garage');
    tabPerf?.classList.toggle('active', this.activeTab === 'performance');
    tabPaint?.classList.toggle('active', this.activeTab === 'paint');
    tabMods?.classList.toggle('active', this.activeTab === 'bodykit');
    tabRoof?.classList.toggle('active', this.activeTab === 'roof_wheels');
    tabGar?.classList.toggle('active', this.activeTab === 'garage');
    if (!bodyEl || !this.draft) return;

    const d = this.draft;
    const garageSave = getActiveGarageSaveData();
    const ul = garageSave.unlockedLevels;

    if (this.activeTab === 'performance') {
      bodyEl.innerHTML = UPGRADE_ATTRIBUTES.map((attr) => {
        const k = attr.id;
        const unlocked = clampInt(ul[k], 0, 10);
        const active = clampInt(d.levels[k], 0, unlocked);
        const nextUnlock = unlocked < 10 ? unlocked + 1 : null;
        const nextCost = nextUnlock ? UPGRADE_LEVEL_COSTS[nextUnlock] : 0;
        const canAfford = nextUnlock ? (this.hud?.totalStuds || 0) >= nextCost : false;

        const barsHtml = Array.from({ length: 10 }, (_, idx) => {
          const lv = idx + 1;
          const cls =
            lv <= active
              ? 'customs-lv-seg active'
              : lv <= unlocked
                ? 'customs-lv-seg unlocked'
                : 'customs-lv-seg';
          return `<span class="${cls}"></span>`;
        }).join('');

        return `
          <div class="creator-sec customs-upgrade-card">
            <div class="customs-upg-header">
              <span class="creator-lbl" style="margin:0;">${attr.shortLabel || attr.name}</span>
              <span class="customs-lv-badge">STAGE ${active} / ${unlocked}</span>
            </div>
            <div class="creator-pow-desc">${attr.desc}</div>
            <div class="customs-lv-bar">${barsHtml}</div>
            <div class="customs-upg-controls">
              <button type="button" class="customs-step-btn" data-upg-step="-1" data-attr="${k}" title="Reduzir Stage" style="pointer-events:auto;" ${active <= 0 ? 'disabled' : ''}>${CUSTOMS_SVGS.minus}</button>
              <button type="button" class="customs-step-btn" data-upg-step="1" data-attr="${k}" title="Subir Stage" style="pointer-events:auto;" ${active >= unlocked ? 'disabled' : ''}>${CUSTOMS_SVGS.plus}</button>
              ${
                nextUnlock
                  ? `<button type="button" class="customs-unlock-btn ${canAfford ? '' : 'locked-cost'}"
                      data-upg-unlock="${k}" style="pointer-events:auto;">
                      ${CUSTOMS_SVGS.bolt}
                      <span>STAGE ${nextUnlock} // ${nextCost.toLocaleString('pt-BR')} STUDS</span>
                    </button>`
                  : `<span class="customs-maxed-tag">${CUSTOMS_SVGS.check} STAGE 10 MAX</span>`
              }
            </div>
          </div>
        `;
      }).join('');
    } else if (this.activeTab === 'paint') {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">IDENTIFICAÇÃO DO PROJETO (ECU TAG)</label>
          <input id="customs-car-name-input" type="text" maxlength="24" value="${d.customName || ''}" class="creator-input customs-pro-input" style="pointer-events:auto;" />
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">PINTURA METÁLICA PRIMÁRIA (16 TONS)</label>
          <div class="creator-swatches-row customs-swatches-grid">${this._renderSwatches(d.primaryColorId, 'primaryColorId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">COR SECUNDÁRIA // TETO, FAIXAS & PINÇAS</label>
          <div class="creator-swatches-row customs-swatches-grid">${this._renderSwatches(d.secondaryColorId, 'secondaryColorId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ACABAMENTO AUTOMOTIVO 3D</label>
          <div class="creator-chips-grid customs-chips-grid">${this._renderChips(d.finishId, CUSTOMS_FINISHES, 'finishId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">PELÍCULA DOS VIDROS & FARÓIS</label>
          <div class="creator-pow-list">${this._renderPartCards(d.windowTintId || 'stock', CUSTOMS_WINDOW_TINTS, 'windowTintId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ADESIVOS & LIVERY DE CORRIDA</label>
          <div class="creator-chips-grid customs-chips-grid">${this._renderChips(d.decalId, CUSTOMS_DECALS, 'decalId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">NEON UNDERGLOW & COR DA LABAREDA [Q]</label>
          <div class="creator-chips-grid customs-chips-grid">${this._renderChips(d.underglowId, CUSTOMS_UNDERGLOW, 'underglowId')}</div>
        </div>
      `;
    } else if (this.activeTab === 'bodykit') {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">FRENTE, PARA-CHOQUE & RAMPA CUNHA</label>
          <div class="creator-pow-list">${this._renderPartCards(d.frontModId, CUSTOMS_FRONT_MODS, 'frontModId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">AEROFÓLIO, TURBINAS A JATO & WHEELIE BAR</label>
          <div class="creator-pow-list">${this._renderPartCards(d.spoilerId, CUSTOMS_SPOILERS, 'spoilerId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ESCAPAMENTOS, SIDE-PIPES & CHAMINÉS</label>
          <div class="creator-pow-list">${this._renderPartCards(d.exhaustModId || 'stock', CUSTOMS_EXHAUST_MODS, 'exhaustModId')}</div>
        </div>
      `;
    } else if (this.activeTab === 'roof_wheels') {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ACESSÓRIOS DE TETO, PAREDÃO CDD & GIROFLEX</label>
          <div class="creator-pow-list">${this._renderPartCards(d.roofModId || 'none', CUSTOMS_ROOF_MODS, 'roofModId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">CONJUNTO DE RODAS, PNEUS & MONSTER LIFT</label>
          <div class="creator-pow-list">${this._renderPartCards(d.wheelStyleId, CUSTOMS_WHEEL_STYLES, 'wheelStyleId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ANODIZAÇÃO / COR DOS AROS</label>
          <div class="creator-swatches-row customs-swatches-grid">${this._renderSwatches(d.wheelColorId, 'wheelColorId')}</div>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">GARAGEM PESSOAL DO SAVE (3 BOXES)</label>
          <div class="creator-pow-desc" style="margin-bottom:10px;">
            Salve sua preparação completa em uma das 3 vagas para solicitar entrega imediata no pátio externo.
          </div>
          <div class="creator-pow-list">
            ${[0, 1, 2]
              .map((slotIdx) => {
                const saved = garageSave.savedCars[slotIdx];
                if (!saved) {
                  return `
                    <div class="creator-power-card customs-garage-slot" style="cursor:default;">
                      <div>
                        <div class="creator-pow-title">BOX 0${slotIdx + 1} // DISPONÍVEL</div>
                        <div class="creator-pow-desc">Nenhum projeto armazenado neste box.</div>
                      </div>
                      <div class="customs-slot-actions">
                        <button type="button" class="customs-action-chip" data-garage-save="${slotIdx}" style="pointer-events:auto;">${CUSTOMS_SVGS.save} <span>SALVAR PROJETO</span></button>
                      </div>
                    </div>
                  `;
                }
                const st = computeTunedVehicleStats(VEHICLE_SPECS[saved.carType], saved);
                return `
                  <div class="creator-power-card customs-garage-slot active" style="cursor:default;">
                    <div>
                      <div class="creator-pow-title">BOX 0${slotIdx + 1} // ${saved.customName || st.name}</div>
                      <div class="creator-pow-desc">
                        ${st.kmh} KM/H • NITRO ${st.turboKmh} KM/H • ${st.maxHp} HP • PULO ${st.jumpHeightMeters.toFixed(0)}M
                      </div>
                    </div>
                    <div class="customs-slot-actions">
                      <button type="button" class="customs-action-chip primary" data-garage-spawn="${slotIdx}" style="pointer-events:auto;">
                        ${CUSTOMS_SVGS.launch} <span>RETIRAR E ACELERAR</span>
                      </button>
                      <button type="button" class="customs-action-chip" data-garage-save="${slotIdx}" style="pointer-events:auto;">
                        ${CUSTOMS_SVGS.save} <span>ATUALIZAR</span>
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }

    const nameInput = document.getElementById('customs-car-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', (ev) => {
        this.draft.customName = String(ev.target.value || '').toUpperCase().slice(0, 24);
        this._applyLiveDraftToCar();
      });
    }

    if (typeof bodyEl.querySelectorAll !== 'function') return;

    // 1. Botões [-] e [+] GRÁTIS (0 até unlockedLevel)
    bodyEl.querySelectorAll('button[data-upg-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.attr;
        const delta = Number(btn.dataset.upgStep || 0);
        const maxUl = clampInt(getActiveGarageSaveData().unlockedLevels[attr], 0, 10);
        const nextVal = clampInt((this.draft.levels[attr] || 0) + delta, 0, maxUl);
        this.draft.levels[attr] = nextVal;
        soundFX.playPlasticHit?.();
        this._setFeedback(`MAPA ECU: ${attr.toUpperCase()} AJUSTADO PARA STAGE ${nextVal}`);
        this._applyLiveDraftToCar();
        this._renderModalBody();
      });
    });

    // 2. Botão DESBLOQUEAR PRÓXIMO STAGE (Paga em Studs!)
    bodyEl.querySelectorAll('button[data-upg-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.upgUnlock;
        const gData = getActiveGarageSaveData();
        const curUl = clampInt(gData.unlockedLevels[attr], 0, 10);
        if (curUl >= 10) return;
        const nextLv = curUl + 1;
        const cost = UPGRADE_LEVEL_COSTS[nextLv];
        if ((this.hud?.totalStuds || 0) < cost) {
          soundFX.playPlasticHit?.();
          this._setFeedback(`SALDO INSUFICIENTE: NECESSÁRIO ${cost.toLocaleString('pt-BR')} STUDS`);
          return;
        }
        this.hud.totalStuds -= cost;
        this.hud.displayedStuds = this.hud.totalStuds;
        if (this.hud.studCountEl) {
          this.hud.studCountEl.textContent = this.hud.totalStuds.toLocaleString('pt-BR');
        }
        gData.unlockedLevels[attr] = nextLv;
        this.draft.levels[attr] = nextLv;
        if (attr === 'nitro') this.previewNitroTimer = 1.4;
        if (attr === 'hydraulics') {
          this.previewHydraulicTimer = 1.3;
          this._previewHydPhase = 0;
        }
        soundFX.playStudCollect?.(1000);
        this.hud.saveCurrentProgress?.();
        this._setFeedback(`STAGE ${nextLv} LIBERADO — REGULAGEM 0 A ${nextLv} DISPONÍVEL`);
        this._applyLiveDraftToCar();
        this._renderModalBody();
      });
    });

    // 3. Seletores Visuais & Compra de Peças Especiais (Teto, Escapamentos e Película)
    bodyEl.querySelectorAll('button[data-customs-field]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.customsField;
        const val = btn.dataset.val;
        if (!field || !val) return;

        const paidCatalog = PAID_PART_CATALOGS[field];
        if (paidCatalog) {
          const entry = paidCatalog.find((p) => p.id === val);
          if (entry && entry.cost > 0 && !this._isPartUnlocked(field, entry)) {
            if ((this.hud?.totalStuds ?? 0) < entry.cost) {
              soundFX.playPlasticHit?.();
              this._setFeedback(`SALDO INSUFICIENTE: ${entry.name.toUpperCase()} CUSTA ${entry.cost.toLocaleString('pt-BR')} STUDS`);
              return;
            }
            if (this.hud) {
              this.hud.totalStuds -= entry.cost;
              this.hud.displayedStuds = this.hud.totalStuds;
              if (this.hud.studCountEl) {
                this.hud.studCountEl.textContent = this.hud.totalStuds.toLocaleString('pt-BR');
              }
            }
            const gData = getActiveGarageSaveData();
            gData.unlockedParts = gData.unlockedParts || {};
            gData.unlockedParts[`${field}:${val}`] = true;
            soundFX.playStudCollect?.(1000);
            this.hud?.saveCurrentProgress?.();
            this._setFeedback(`PEÇA ADQUIRIDA E INSTALADA: ${entry.name.toUpperCase()}`);
          }
        }

        const prevVal = this.draft[field];
        this.draft[field] = val;
        if (field === 'exhaustModId' && val !== 'stock') {
          this.previewNitroTimer = 1.4;
        }
        if (field === 'spoilerId' && val === 'dual_jet_turbine') {
          this.previewNitroTimer = 1.4;
        }
        soundFX.playHeroSwap?.();
        this._applyLiveDraftToCar();
        if (
          (field === 'primaryColorId' || field === 'secondaryColorId') &&
          val !== prevVal
        ) {
          this._tryTriggerPayNSprayEscape();
        }
        this._renderModalBody();
      });
    });

    // 4. Salvar / Retirar dos 3 Slots da Garagem Pessoal
    bodyEl.querySelectorAll('button[data-garage-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = clampInt(btn.dataset.garageSave, 0, 2);
        const gData = getActiveGarageSaveData();
        gData.savedCars[idx] = JSON.parse(JSON.stringify(this.draft));
        this.hud.saveCurrentProgress?.();
        soundFX.playTrueHeroFanfare?.();
        this._setFeedback(`PROJETO SALVO NO BOX 0${idx + 1} DA GARAGEM`);
        this._renderModalBody();
      });
    });

    bodyEl.querySelectorAll('button[data-garage-spawn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = clampInt(btn.dataset.garageSpawn, 0, 2);
        this.spawnSavedGarageCar(idx);
      });
    });
  }

  spawnSavedGarageCar(slotIdx) {
    const gData = getActiveGarageSaveData();
    const saved = gData.savedCars?.[slotIdx];
    if (!saved || !this.world || !this.controller) return null;

    if (this._spawnedGarageCar && !this._spawnedGarageCar.destroyed && this.world.destructibles) {
      if (this.controller.currentVehicle === this._spawnedGarageCar) {
        this.controller.exitVehicle();
      }
      this.world.destructibles.removeDestructible(this._spawnedGarageCar);
      this._spawnedGarageCar = null;
    }

    const pad = this.world.legoCustomsData?.deliverySpawnPos || { x: 25, y: 0.38, z: -416, rotY: 0 };
    const spawned = spawnDraggableCustomVehicle(
      this.world,
      {
        x: pad.x,
        y: pad.y,
        z: pad.z,
        rotY: pad.rotY || 0,
        type: saved.carType
      },
      saved
    );
    this._spawnedGarageCar = spawned;

    if (this.isOpen) {
      this.isOpen = false;
      this.modalEl?.classList.add('hidden');
    }
    this._setStudioUiOverlayMode(false);

    if (this.controller.currentVehicle) {
      this.controller.exitVehicle();
    }
    if (spawned) {
      this.controller.enterVehicle(spawned);
      this.controller._customsExitCooldown = 2.0;
    }
    soundFX.playTrueHeroFanfare?.();
    this.controller.relockPointer?.();
    return spawned;
  }
}

