import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';
import {
  optimizeStaticGroupMeshes,
  mergeBufferGeometries,
  mergeColoredGeometries,
  getSharedVertexColorMaterial,
  markAsSharedAsset
} from './BuildingGenerator.js';

/**
 * Escala Oficial de Velocidade:
 * - Boneco correndo a pé = ~14 un/s = 45 km/h (fator = 45 / 14 ≈ 3.2142857 km/h por un/s)
 */
export const KMH_TO_UNITS = 14 / 45;
export const UNITS_TO_KMH = 45 / 14;

/**
 * CATÁLOGO OFICIAL DOS 17 VEÍCULOS LEGO 3D (DIVIDIDOS NOS 4 GRUPOS)
 */
export const VEHICLE_SPECS = {
  // ============================================================================
  // GRUPO 1: ESPORTIVOS & SUPERCARROS (Centro, Mansões do Subúrbio e Orla)
  // ============================================================================
  apex_gtx: {
    id: 'apex_gtx',
    group: 'ESPORTIVOS & SUPERCARROS',
    name: 'APEX GT-X (HIPERCARRO)',
    kmh: 290,
    turboKmh: 330,
    maxForward: 290 * KMH_TO_UNITS,
    turboSpeed: 330 * KMH_TO_UNITS,
    maxReverse: -85 * KMH_TO_UNITS,
    accel: 62.0,
    turnRate: 2.55,
    driftTurnRate: 3.8,
    hp: 250,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 8, blue: 4, purple: 1 }
  },
  vortex_roadster: {
    id: 'vortex_roadster',
    group: 'ESPORTIVOS & SUPERCARROS',
    name: 'VORTEX ROADSTER (CONVERSÍVEL)',
    kmh: 255,
    turboKmh: 295,
    maxForward: 255 * KMH_TO_UNITS,
    turboSpeed: 295 * KMH_TO_UNITS,
    maxReverse: -80 * KMH_TO_UNITS,
    accel: 58.0,
    turnRate: 2.65,
    driftTurnRate: 4.1,
    hp: 220,
    openTop: true,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 6, blue: 3, purple: 1 }
  },
  trovao_v8: {
    id: 'trovao_v8',
    group: 'ESPORTIVOS & SUPERCARROS',
    name: 'TROVÃO V8 (MUSCLE CAR)',
    kmh: 235,
    turboKmh: 275,
    maxForward: 235 * KMH_TO_UNITS,
    turboSpeed: 275 * KMH_TO_UNITS,
    maxReverse: -75 * KMH_TO_UNITS,
    accel: 52.0,
    turnRate: 2.35,
    driftTurnRate: 3.95,
    hp: 350,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 6, blue: 3, purple: 0 }
  },
  cyber_blade: {
    id: 'cyber_blade',
    group: 'ESPORTIVOS & SUPERCARROS',
    name: 'CYBER-BLADE (PROTÓTIPO NEON)',
    kmh: 275,
    turboKmh: 315,
    maxForward: 275 * KMH_TO_UNITS,
    turboSpeed: 315 * KMH_TO_UNITS,
    maxReverse: -85 * KMH_TO_UNITS,
    accel: 60.0,
    turnRate: 2.6,
    driftTurnRate: 3.9,
    hp: 280,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 7, blue: 4, purple: 1 }
  },

  // ============================================================================
  // GRUPO 2: POLÍCIA & BOPE
  // ============================================================================
  caveirao_bope: {
    id: 'caveirao_bope',
    group: 'POLÍCIA & BOPE',
    name: 'CAVEIRÃO DO BOPE (BLINDADO PESADO)',
    kmh: 115,
    turboKmh: 145,
    maxForward: 115 * KMH_TO_UNITS,
    turboSpeed: 145 * KMH_TO_UNITS,
    maxReverse: -50 * KMH_TO_UNITS,
    accel: 34.0,
    turnRate: 1.95,
    driftTurnRate: 2.75,
    hp: 1200,
    openTop: false,
    weapon: null,
    rammingPower: 'unstoppable', // Arremessa carros e barricadas sem perder velocidade!
    studDrops: { silver: 8, gold: 8, blue: 4, purple: 1 }
  },
  interceptor_v8: {
    id: 'interceptor_v8',
    group: 'POLÍCIA & BOPE',
    name: 'INTERCEPTOR POLICIAL V8',
    kmh: 215,
    turboKmh: 255,
    maxForward: 215 * KMH_TO_UNITS,
    turboSpeed: 255 * KMH_TO_UNITS,
    maxReverse: -70 * KMH_TO_UNITS,
    accel: 48.0,
    turnRate: 2.45,
    driftTurnRate: 3.65,
    hp: 400,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 5, blue: 2, purple: 0 }
  },
  choque_pickup: {
    id: 'choque_pickup',
    group: 'POLÍCIA & BOPE',
    name: 'CAMINHONETE TÁTICA (CHOQUE)',
    kmh: 175,
    turboKmh: 210,
    maxForward: 175 * KMH_TO_UNITS,
    turboSpeed: 210 * KMH_TO_UNITS,
    maxReverse: -60 * KMH_TO_UNITS,
    accel: 40.0,
    turnRate: 2.2,
    driftTurnRate: 3.25,
    hp: 600,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 6, blue: 3, purple: 0 }
  },
  moto_policia: {
    id: 'moto_policia',
    group: 'POLÍCIA & BOPE',
    name: 'MOTO TÁTICA ROCAM / BOPE',
    kmh: 235,
    turboKmh: 278,
    maxForward: 235 * KMH_TO_UNITS,
    turboSpeed: 278 * KMH_TO_UNITS,
    maxReverse: -55 * KMH_TO_UNITS,
    accel: 58.0,
    turnRate: 3.12,
    driftTurnRate: 4.35,
    hp: 210,
    openTop: true,
    isMotorcycle: true,
    canWheelie: true, // Empina na roda traseira com Espaço!
    weapon: 'smg',    // Metralhadoras táticas frontais no Clique Esquerdo!
    rearAxleZ: 1.38,
    seatedYOffset: 0.78,
    seatZOffset: -0.26,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 6, blue: 3, purple: 0 }
  },

  // ============================================================================
  // GRUPO 3: VEÍCULOS DAS 3 FACÇÕES (CV, PCC & A.R.E.S.)
  // ============================================================================
  moto_cv: {
    id: 'moto_cv',
    group: 'FACÇÕES (CV / PCC / A.R.E.S.)',
    name: 'MOTO DE ASSALTO 600CC (CV)',
    kmh: 225,
    turboKmh: 265,
    maxForward: 225 * KMH_TO_UNITS,
    turboSpeed: 265 * KMH_TO_UNITS,
    maxReverse: -55 * KMH_TO_UNITS,
    accel: 56.0,
    turnRate: 3.1,
    driftTurnRate: 4.2,
    hp: 160,
    openTop: true,
    isMotorcycle: true,
    canWheelie: true, // Empina na roda traseira com Espaço!
    weapon: 'smg',    // Atira pilotando no Clique Esquerdo!
    rearAxleZ: 1.38,
    seatedYOffset: 0.78,
    seatZOffset: -0.26,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 4, blue: 2, purple: 0 }
  },
  moto_pcc: {
    id: 'moto_pcc',
    group: 'FACÇÕES (CV / PCC / A.R.E.S.)',
    name: 'SUPERBIKE BLINDADA 1000CC (PCC)',
    kmh: 248,
    turboKmh: 292,
    maxForward: 248 * KMH_TO_UNITS,
    turboSpeed: 292 * KMH_TO_UNITS,
    maxReverse: -58 * KMH_TO_UNITS,
    accel: 60.0,
    turnRate: 3.05,
    driftTurnRate: 4.3,
    hp: 220,
    openTop: true,
    isMotorcycle: true,
    canWheelie: true, // Empina na roda traseira com Espaço!
    weapon: 'smg',    // Submetralhadoras duplas integradas na carenagem!
    rearAxleZ: 1.38,
    seatedYOffset: 0.78,
    seatZOffset: -0.26,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 7, blue: 4, purple: 0 }
  },
  picape_cv: {
    id: 'picape_cv',
    group: 'FACÇÕES (CV / PCC / A.R.E.S.)',
    name: 'PICAPE ARTILHADA (CV)',
    kmh: 165,
    turboKmh: 200,
    maxForward: 165 * KMH_TO_UNITS,
    turboSpeed: 200 * KMH_TO_UNITS,
    maxReverse: -55 * KMH_TO_UNITS,
    accel: 38.0,
    turnRate: 2.15,
    driftTurnRate: 3.2,
    hp: 480,
    openTop: false,
    weapon: 'machinegun', // Metralhadora Giratória na caçamba (Clique Esquerdo)!
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 6, blue: 3, purple: 0 }
  },
  suv_pcc: {
    id: 'suv_pcc',
    group: 'FACÇÕES (CV / PCC / A.R.E.S.)',
    name: 'SUV BLINDADA EXECUTIVA (PCC)',
    kmh: 185,
    turboKmh: 220,
    maxForward: 185 * KMH_TO_UNITS,
    turboSpeed: 220 * KMH_TO_UNITS,
    maxReverse: -60 * KMH_TO_UNITS,
    accel: 42.0,
    turnRate: 2.25,
    driftTurnRate: 3.3,
    hp: 700,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 7, blue: 4, purple: 0 }
  },
  van_pcc: {
    id: 'van_pcc',
    group: 'FACÇÕES (CV / PCC / A.R.E.S.)',
    name: 'VAN DE ASSALTO (PCC)',
    kmh: 140,
    turboKmh: 175,
    maxForward: 140 * KMH_TO_UNITS,
    turboSpeed: 175 * KMH_TO_UNITS,
    maxReverse: -50 * KMH_TO_UNITS,
    accel: 33.0,
    turnRate: 2.0,
    driftTurnRate: 2.9,
    hp: 650,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    // Solta chuva generosa de Studs Dourados e Azuis ao explodir!
    studDrops: { silver: 4, gold: 14, blue: 8, purple: 1 }
  },
  hover_apc_ares: {
    id: 'hover_apc_ares',
    group: 'FACÇÕES (CV / PCC / A.R.E.S.)',
    name: 'HOVER-APC (A.R.E.S.)',
    kmh: 195,
    turboKmh: 235,
    maxForward: 195 * KMH_TO_UNITS,
    turboSpeed: 235 * KMH_TO_UNITS,
    maxReverse: -65 * KMH_TO_UNITS,
    accel: 45.0,
    turnRate: 2.35,
    driftTurnRate: 3.4,
    hp: 950,
    openTop: false,
    weapon: 'plasma_laser', // Torreta de Canhão Laser no teto (Clique Esquerdo)!
    rammingPower: 'unstoppable',
    studDrops: { silver: 6, gold: 10, blue: 6, purple: 2 }
  },

  // ============================================================================
  // GRUPO 4: CIVIS & PESADOS
  // ============================================================================
  taxi_metro: {
    id: 'taxi_metro',
    group: 'CIVIS & PESADOS',
    name: 'TÁXI METROPOLITANO',
    kmh: 145,
    turboKmh: 180,
    maxForward: 145 * KMH_TO_UNITS,
    turboSpeed: 180 * KMH_TO_UNITS,
    maxReverse: -55 * KMH_TO_UNITS,
    accel: 35.0,
    turnRate: 2.35,
    driftTurnRate: 3.5,
    hp: 220,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 5, blue: 2, purple: 0 }
  },
  sedan_familiar: {
    id: 'sedan_familiar',
    group: 'CIVIS & PESADOS',
    name: 'SEDAN FAMILIAR',
    kmh: 130,
    turboKmh: 165,
    maxForward: 130 * KMH_TO_UNITS,
    turboSpeed: 165 * KMH_TO_UNITS,
    maxReverse: -50 * KMH_TO_UNITS,
    accel: 31.0,
    turnRate: 2.25,
    driftTurnRate: 3.3,
    hp: 200,
    openTop: false,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 4, blue: 1, purple: 0 }
  },
  buggy_praia: {
    id: 'buggy_praia',
    group: 'CIVIS & PESADOS',
    name: 'BUGGY DE PRAIA',
    kmh: 170,
    turboKmh: 205,
    maxForward: 170 * KMH_TO_UNITS,
    turboSpeed: 205 * KMH_TO_UNITS,
    maxReverse: -60 * KMH_TO_UNITS,
    accel: 42.0,
    turnRate: 2.6,
    driftTurnRate: 3.85,
    hp: 190,
    openTop: true,
    weapon: null,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 5, blue: 2, purple: 0 }
  },
  carro_forte: {
    id: 'carro_forte',
    group: 'CIVIS & PESADOS',
    name: 'CARRO-FORTE DO BANCO CENTRAL',
    kmh: 110,
    turboKmh: 140,
    maxForward: 110 * KMH_TO_UNITS,
    turboSpeed: 140 * KMH_TO_UNITS,
    maxReverse: -45 * KMH_TO_UNITS,
    accel: 29.0,
    turnRate: 1.9,
    driftTurnRate: 2.7,
    hp: 1100,
    openTop: false,
    weapon: null,
    rammingPower: 'unstoppable',
    // Guarda Studs Roxos!
    studDrops: { silver: 4, gold: 10, blue: 6, purple: 5 }
  },
  onibus_urbano: {
    id: 'onibus_urbano',
    group: 'CIVIS & PESADOS',
    name: 'ÔNIBUS METROPOLITANO LEGO',
    kmh: 120,
    turboKmh: 155,
    maxForward: 120 * KMH_TO_UNITS,
    turboSpeed: 155 * KMH_TO_UNITS,
    maxReverse: -45 * KMH_TO_UNITS,
    accel: 27.5,
    turnRate: 1.85,
    driftTurnRate: 2.55,
    hp: 950,
    openTop: false,
    weapon: null,
    rammingPower: 'unstoppable',
    studDrops: { silver: 6, gold: 8, blue: 4, purple: 0 }
  },
  tanque_titan: {
    id: 'tanque_titan',
    group: 'CIVIS & PESADOS',
    name: 'TANQUE MILITAR TITAN-M1',
    kmh: 90,
    turboKmh: 115,
    maxForward: 90 * KMH_TO_UNITS,
    turboSpeed: 115 * KMH_TO_UNITS,
    maxReverse: -40 * KMH_TO_UNITS,
    accel: 26.0,
    turnRate: 1.85,
    driftTurnRate: 2.4,
    hp: 2000,
    openTop: false,
    weapon: 'tank_cannon', // Canhão Principal que dispara projéteis explosivos no Clique Esquerdo!
    rammingPower: 'unstoppable',
    studDrops: { silver: 8, gold: 12, blue: 8, purple: 3 }
  }
};

// Compatibilidade com chaves curtas antigas
VEHICLE_SPECS.hypercar = VEHICLE_SPECS.apex_gtx;
VEHICLE_SPECS.sport = VEHICLE_SPECS.vortex_roadster;
VEHICLE_SPECS.muscle = VEHICLE_SPECS.trovao_v8;
VEHICLE_SPECS.police = VEHICLE_SPECS.interceptor_v8;
VEHICLE_SPECS.suv = VEHICLE_SPECS.suv_pcc;
VEHICLE_SPECS.taxi = VEHICLE_SPECS.taxi_metro;

/**
 * Constrói o modelo 3D LEGO detalhado para qualquer um dos 17 veículos da frota:
 * - Rodas cilíndricas com calotas, faróis brilhantes, lanternas traseiras vermelhas,
 *   para-brisa translúcido, capô com pinos de LEGO, bancos e volante 3D interno!
 */
export function getFinishMaterialOpts(finishStyle = 'glossy') {
  if (finishStyle === 'matte') {
    return { roughness: 0.72, metalness: 0.14, clearcoat: 0.04 };
  }
  if (finishStyle === 'pearl') {
    return { roughness: 0.18, metalness: 0.58, clearcoat: 0.76 };
  }
  if (finishStyle === 'chrome') {
    return { roughness: 0.08, metalness: 0.92, clearcoat: 0.94 };
  }
  return { roughness: 0.28, metalness: 0.26, clearcoat: 0.46 };
}

/**
 * Gera um volume chanfrado / cunha hard-surface (studless) sem faces coplanares:
 * permite afunilar topo vs base, inclinar capô/glacis frontal (frontDrop) e traseira (rearDrop).
 */
function makeTaperedHullGeo(
  wBot,
  wTop,
  h,
  dBot,
  dTop,
  zShiftTop = 0,
  frontDrop = 0,
  rearDrop = 0
) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  const pos = base.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i); // -0.5 ou +0.5
    const sy = pos.getY(i);
    const sz = pos.getZ(i);
    const isTop = sy > 0;
    const isFront = sz > 0;
    const x = sx * (isTop ? wTop : wBot);
    const z = sz * (isTop ? dTop : dBot) + (isTop ? zShiftTop : 0);
    let y = sy * h;
    if (isTop && isFront) y -= frontDrop;
    if (isTop && !isFront) y -= rearDrop;
    pos.setXYZ(i, x, y, z);
  }
  const geo = base.toNonIndexed();
  base.dispose();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Gera cabine / greenhouse trapezoidal com para-brisa inclinado (frontRake),
 * vigia traseira inclinada (rearRake) e laterais anguladas (tumblehome).
 */
function makeRakedCabinGeo(wBot, wTop, h, dBot, zBotCenter, zTopFront, zTopRear) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  const pos = base.attributes.position;
  const zBotFront = zBotCenter + dBot * 0.5;
  const zBotRear = zBotCenter - dBot * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);
    const isTop = sy > 0;
    const isFront = sz > 0;
    const x = sx * (isTop ? wTop : wBot);
    const y = (sy + 0.5) * h; // base em y=0, topo em y=h
    const z = isTop
      ? (isFront ? zTopFront : zTopRear)
      : (isFront ? zBotFront : zBotRear);
    pos.setXYZ(i, x, y, z);
  }
  const geo = base.toNonIndexed();
  base.dispose();
  geo.computeVertexNormals();
  return geo;
}

const _VEHICLE_PROTO_CACHE = new Map();

function _cloneVehicleProto(proto) {
  const wheelSteerSet = new Set();
  const wheelSpinSet = new Set();
  const protoWheels = Array.isArray(proto.userData?.wheels) ? proto.userData.wheels : [];
  for (let i = 0; i < protoWheels.length; i++) {
    if (protoWheels[i].steerGroup) wheelSteerSet.add(protoWheels[i].steerGroup);
    if (protoWheels[i].spinGroup) wheelSpinSet.add(protoWheels[i].spinGroup);
  }
  const protoFlameGroup = proto.userData?.turboFlames?.[0] || null;
  const protoFlameMesh = proto.userData?.turboFlameMesh || null;
  const protoTurret = proto.userData?.turretGroup || null;

  const srcToClone = new Map();
  const cloneNode = (src) => {
    let dst;
    if (src.isMesh) {
      dst = new THREE.Mesh(src.geometry, src.material);
    } else if (src.isGroup) {
      dst = new THREE.Group();
    } else {
      dst = new THREE.Object3D();
    }
    dst.name = src.name;
    dst.position.copy(src.position);
    dst.rotation.copy(src.rotation);
    dst.scale.copy(src.scale);
    dst.visible = src.visible;
    dst.castShadow = src.castShadow;
    dst.receiveShadow = src.receiveShadow;
    dst.matrixAutoUpdate = src.matrixAutoUpdate;
    if (!dst.matrixAutoUpdate) dst.matrix.copy(src.matrix);
    if (src.userData && Object.keys(src.userData).length > 0) {
      dst.userData = { ...src.userData };
      delete dst.userData.wheels;
      delete dst.userData.turboFlames;
      delete dst.userData.turboFlameMesh;
      delete dst.userData.turretGroup;
    }
    srcToClone.set(src, dst);
    for (let i = 0; i < src.children.length; i++) {
      dst.add(cloneNode(src.children[i]));
    }
    return dst;
  };

  const cloned = cloneNode(proto);
  if (protoWheels.length > 0) {
    cloned.userData.wheels = protoWheels.map((pw) => ({
      steerGroup: srcToClone.get(pw.steerGroup),
      spinGroup: srcToClone.get(pw.spinGroup),
      isFront: pw.isFront
    }));
  }
  if (protoFlameGroup) {
    const cf = srcToClone.get(protoFlameGroup);
    cloned.userData.turboFlames = cf ? [cf] : [];
  }
  if (protoFlameMesh) {
    cloned.userData.turboFlameMesh = srcToClone.get(protoFlameMesh) || null;
  }
  if (protoTurret) {
    cloned.userData.turretGroup = srcToClone.get(protoTurret) || null;
  }
  return cloned;
}

export function createLegoCarMesh(cfg = {}) {
  const type = cfg.type || 'apex_gtx';
  const cacheKey = `${type}|${cfg.color ?? ''}|${cfg.roofColor ?? ''}|${cfg.finishStyle ?? ''}|${cfg.wheelColor ?? ''}|${cfg.suppressDefaultSpoiler ? 1 : 0}`;
  const cachedProto = _VEHICLE_PROTO_CACHE.get(cacheKey);
  if (cachedProto) {
    return _cloneVehicleProto(cachedProto);
  }
  const proto = _buildLegoCarMeshUncached(cfg);
  proto.traverse((o) => {
    if (o.isMesh) {
      if (o.geometry) markAsSharedAsset(o.geometry);
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(markAsSharedAsset);
        else markAsSharedAsset(o.material);
      }
    }
  });
  _VEHICLE_PROTO_CACHE.set(cacheKey, proto);
  return _cloneVehicleProto(proto);
}

function _buildLegoCarMeshUncached(cfg) {
  const type = cfg.type || 'apex_gtx';
  const spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.apex_gtx;
  const group = new THREE.Group();

  const bodyColor = cfg.color ?? 0xfacc15;
  const roofColor = cfg.roofColor ?? LEGO_COLORS.black;
  const finishOpts = getFinishMaterialOpts(cfg.finishStyle);
  const customWheelMat =
    cfg.wheelColor !== undefined
      ? getLegoMaterial(cfg.wheelColor, { metalness: 0.55, roughness: 0.18, clearcoat: 0.6 })
      : null;

  group.userData.carType = type;
  group.userData.initialColors = { color: bodyColor, roofColor };

  const bodyMat = getLegoMaterial(bodyColor, finishOpts);
  const darkTrimMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.35 });
  const blackMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.4 });
  const whiteMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.25 });
  const tireMat = blackMat;
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.5, roughness: 0.2 });
  const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.5, roughness: 0.2 });
  const neonCyanMat = getLegoMaterial(0x06b6d4, { emissive: 0x06b6d4, emissiveIntensity: 0.9 });
  const neonPurpleMat = getLegoMaterial(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 0.9 });
  const glassTintHex =
    type === 'suv_pcc' || type === 'van_pcc' || type === 'caveirao_bope' || type === 'carro_forte'
      ? 0x04060a
      : 0x070b13;
  const glassMat = getLegoMaterial(glassTintHex, {
    roughness: 0.08,
    metalness: 0.58,
    clearcoat: 0.88
  });
  glassMat.userData = { ...glassMat.userData, isVehicleGlass: true };
  const headlightMat = getLegoMaterial(0xfef3c7, { emissive: 0xfde68a, emissiveIntensity: 1.05 });
  headlightMat.userData = { ...headlightMat.userData, isVehicleHeadlight: true };
  const taillightMat = getLegoMaterial(0x991b1b, { emissive: 0xdc2626, emissiveIntensity: 0.95 });
  const gunmetalTrimMat = getLegoMaterial(0x1e2430, { metalness: 0.48, roughness: 0.34 });

  // ============================================================================
  // CASO ESPECIAL 1: MOTOS DE ALTA CILINDRADA & DETALHAMENTO 3D COMPLETO
  // (MOTO DE ASSALTO 600CC DO CV, SUPERBIKE BLINDADA 1000CC DO PCC E MOTO TÁTICA ROCAM / BOPE DA POLÍCIA)
  // ============================================================================
  if (type === 'moto_cv' || type === 'moto_pcc' || type === 'moto_policia') {
    const isPcc = type === 'moto_pcc';
    const isPolice = type === 'moto_policia';

    const primaryColor = isPcc
      ? (cfg.color ?? 0x090a0d)
      : isPolice
        ? (cfg.color ?? 0x111827)
        : (cfg.color ?? 0xdc2626);
    const secondaryColor = isPcc
      ? (cfg.roofColor ?? 0x1e3a8a)
      : isPolice
        ? (cfg.roofColor ?? LEGO_COLORS.white)
        : (cfg.roofColor ?? LEGO_COLORS.black);

    const primaryMat = getLegoMaterial(primaryColor, finishOpts);
    const secondaryMat = getLegoMaterial(secondaryColor, finishOpts);
    const gunmetalMat = getLegoMaterial(0x334155, { metalness: 0.55, roughness: 0.25 });
    const chromeMat = getLegoMaterial(0xe2e8f0, { metalness: 0.72, roughness: 0.18 });
    const pccNeonBlueMat = getLegoMaterial(0x0ea5e9, { emissive: 0x0ea5e9, emissiveIntensity: 0.95 });
    const policeRedStrobeMat = getLegoMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 0.95 });
    const policeBlueStrobeMat = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 0.95 });
    const screenCyanMat = getLegoMaterial(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.85 });

    // 1. Bloco do Motor 4 Cilindros Metálico + Cabeçote + Aletas de Refrigeração + Radiador Frontal
    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.58, 0.92), gunmetalMat);
    engineBlock.position.set(0, 0.68, 0.12);
    const cylinderHead = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.22, 0.72), silverMat);
    cylinderHead.rotation.x = 0.22;
    cylinderHead.position.set(0, 0.98, 0.26);
    const radiator = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.48, 0.14), blackMat);
    radiator.rotation.x = -0.25;
    radiator.position.set(0, 0.82, 0.72);
    const radiatorGrille = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.4, 0.16), gunmetalMat);
    radiatorGrille.rotation.x = -0.25;
    radiatorGrille.position.set(0, 0.82, 0.73);
    group.add(engineBlock, cylinderHead, radiator, radiatorGrille);

    // 2. Tampas Laterais de Embreagem / Alternador + Pedaleiras do Piloto e Garupa
    for (const sx of [-1, 1]) {
      const clutchCover = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12),
        isPcc ? secondaryMat : isPolice ? goldMat : silverMat
      );
      clutchCover.rotation.z = Math.PI / 2;
      clutchCover.position.set(sx * 0.36, 0.62, 0.02);

      // Quadro em Treliça Tubular Lateral (Trellis Frame)
      const frameBeamTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.11, 1.38),
        isPcc ? gunmetalMat : isPolice ? blackMat : primaryMat
      );
      frameBeamTop.rotation.x = -0.18;
      frameBeamTop.position.set(sx * 0.38, 1.02, 0.18);

      const frameBeamDiag = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.09, 1.05),
        isPcc ? secondaryMat : isPolice ? silverMat : primaryMat
      );
      frameBeamDiag.rotation.x = 0.42;
      frameBeamDiag.position.set(sx * 0.39, 0.84, 0.24);

      // Pedaleiras metálicas (Footpegs) onde os pés do boneco apoiam
      const riderPeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.09), silverMat);
      riderPeg.position.set(sx * 0.48, 0.52, -0.12);
      const passPeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.08), darkTrimMat);
      passPeg.position.set(sx * 0.44, 0.72, -0.68);

      group.add(clutchCover, frameBeamTop, frameBeamDiag, riderPeg, passPeg);
    }

    // 3. Balança Traseira Dupla (Rear Swingarm) + Amortecedor Central (Mono-Shock) + Corrente
    for (const sx of [-0.34, 0.34]) {
      const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 1.28), gunmetalMat);
      swingarm.rotation.x = -0.06;
      swingarm.position.set(sx, 0.58, -0.82);
      group.add(swingarm);
    }
    const rearShock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.52, 10),
      isPcc ? pccNeonBlueMat : isPolice ? goldMat : primaryMat
    );
    rearShock.rotation.x = 0.48;
    rearShock.position.set(0, 0.82, -0.45);
    group.add(rearShock);

    // 4. Tanque de Combustível Musculoso Angular Studless + Carenagens Laterais Chanfradas
    const mainTank = new THREE.Mesh(
      makeTaperedHullGeo(0.84, 0.98, 0.42, 1.06, 0.92, -0.06, 0.08, 0.12),
      primaryMat
    );
    mainTank.position.set(0, 1.24, 0.28);
    const tankTopCap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), silverMat);
    tankTopCap.position.set(0, 1.46, 0.36);
    group.add(mainTank, tankTopCap);

    for (const sx of [-0.5, 0.5]) {
      const tankShroud = new THREE.Mesh(
        makeTaperedHullGeo(0.1, 0.14, 0.36, 0.88, 0.96, 0.06, 0.12, 0),
        isPolice ? secondaryMat : primaryMat
      );
      tankShroud.rotation.x = -0.14;
      tankShroud.position.set(sx, 1.18, 0.52);
      group.add(tankShroud);
    }

    // 5. Banco Esportivo Bipartido em 2 Níveis + Rabeta Afiada Studless
    const riderSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.17, 0.78), blackMat);
    riderSaddle.position.set(0, 1.05, -0.34);
    const pillionSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.19, 0.66), darkTrimMat);
    pillionSaddle.rotation.x = -0.12;
    pillionSaddle.position.set(0, 1.18, -0.96);
    const tailFairing = new THREE.Mesh(
      makeTaperedHullGeo(0.82, 0.54, 0.24, 0.94, 0.76, -0.06, 0, 0.08),
      isPolice ? secondaryMat : primaryMat
    );
    tailFairing.rotation.x = -0.16;
    tailFairing.position.set(0, 1.12, -1.08);
    group.add(riderSaddle, pillionSaddle, tailFairing);

    // Alças traseiras de apoio (Grab Rails) + Suporte de Placa (Tail Tidy) + Lanterna Traseira de LED
    for (const sx of [-0.42, 0.42]) {
      const grabRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.62), gunmetalMat);
      grabRail.rotation.x = -0.15;
      grabRail.position.set(sx, 1.24, -1.05);
      group.add(grabRail);
    }
    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.12), taillightMat);
    tailLight.position.set(0, 1.16, -1.55);
    const plateBracket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.08), blackMat);
    plateBracket.rotation.x = 0.35;
    plateBracket.position.set(0, 0.96, -1.58);
    group.add(tailLight, plateBracket);

    // 6. Sistema de Escapamento Duplo 4x2 (Coletores Curvos + 2 Ponteiras Inclinadas nas Laterais)
    for (const sx of [-1, 1]) {
      const exhaustPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.25, 10), chromeMat);
      exhaustPipe.rotation.x = Math.PI / 2 - 0.18;
      exhaustPipe.position.set(sx * 0.42, 0.56, -0.35);

      const muffler = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.11, 0.95, 12),
        isPcc ? gunmetalMat : chromeMat
      );
      muffler.rotation.x = Math.PI / 2 - 0.32;
      muffler.position.set(sx * 0.48, 0.78, -1.12);

      const mufflerTip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 12), blackMat);
      mufflerTip.rotation.x = Math.PI / 2 - 0.32;
      mufflerTip.position.set(sx * 0.48, 0.93, -1.56);

      group.add(exhaustPipe, muffler, mufflerTip);
    }

    // 7. Garfo Dianteiro Telescópico Duplo (Bengalas Inclinadas) + Mesas de Direção + Para-lama Dianteiro
    const forkColorMat = isPcc ? gunmetalMat : isPolice ? silverMat : goldMat;
    for (const sx of [-0.28, 0.28]) {
      const upperFork = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.85, 10), forkColorMat);
      upperFork.rotation.x = -0.34;
      upperFork.position.set(sx, 1.15, 1.04);

      const lowerFork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 10), chromeMat);
      lowerFork.rotation.x = -0.34;
      lowerFork.position.set(sx, 0.68, 1.24);

      group.add(upperFork, lowerFork);
    }
    const tripleClampTop = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.26), gunmetalMat);
    tripleClampTop.position.set(0, 1.44, 0.88);
    const tripleClampBot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.28), gunmetalMat);
    tripleClampBot.position.set(0, 1.05, 1.06);
    const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.68), primaryMat);
    frontFender.rotation.x = 0.22;
    frontFender.position.set(0, 0.86, 1.38);
    group.add(tripleClampTop, tripleClampBot, frontFender);

    // 8. Carenagem Frontal, Faróis de LED, Painel Digital TFT, Guidão Largo, Manoplas e Retrovisores
    const noseFairing = createLegoBrick(0.88, 0.48, 0.64, primaryColor, { studs: false });
    noseFairing.rotation.x = 0.22;
    noseFairing.position.set(0, 1.28, 1.18);
    group.add(noseFairing);

    // Farol Duplo Agressivo de LED
    for (const sx of [-0.22, 0.22]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.14), headlightMat);
      hl.rotation.z = sx * -0.18;
      hl.position.set(sx, 1.24, 1.51);
      group.add(hl);
    }

    // Bolha / Para-brisa Aerodinâmico (Mais alto na Moto Tática da Polícia, fumê esportivo na Superbike do PCC)
    const shieldH = isPolice ? 0.68 : isPcc ? 0.48 : 0.36;
    const motoShieldMat = isPcc
      ? getLegoMaterial(0x020617, { roughness: 0.08, metalness: 0.6 })
      : glassMat;
    motoShieldMat.userData = { ...motoShieldMat.userData, isVehicleGlass: true };
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, shieldH, 0.1),
      motoShieldMat
    );
    windshield.userData.isVehicleGlass = true;
    windshield.rotation.x = isPolice ? -0.32 : -0.52;
    windshield.position.set(0, 1.52 + (isPolice ? 0.12 : 0), 1.08);
    group.add(windshield);

    // Painel Digital TFT colorido + Guidão Largo + Manoplas + Protetores de Mão + Retrovisores
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.08), screenCyanMat);
    dashboard.rotation.x = -0.45;
    dashboard.position.set(0, 1.48, 0.94);

    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.56, 10), silverMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.52, 0.76);
    group.add(dashboard, handlebar);

    for (const sx of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 10), blackMat);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(sx * 0.68, 1.52, 0.76);

      const handguard = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.14, 0.08),
        isPolice ? secondaryMat : primaryMat
      );
      handguard.position.set(sx * 0.68, 1.52, 0.86);

      const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 6), blackMat);
      mirrorStem.rotation.z = sx * -0.45;
      mirrorStem.position.set(sx * 0.62, 1.64, 0.82);

      const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.06), blackMat);
      mirrorHead.position.set(sx * 0.72, 1.74, 0.84);

      // Submetralhadoras Táticas Acopladas nas Laterais da Carenagem Dianteira!
      const smgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.52), blackMat);
      smgReceiver.position.set(sx * 0.48, 1.12, 1.18);
      const smgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.42, 8), gunmetalMat);
      smgBarrel.rotation.x = Math.PI / 2;
      smgBarrel.position.set(sx * 0.48, 1.14, 1.54);

      group.add(grip, handguard, mirrorStem, mirrorHead, smgReceiver, smgBarrel);
    }

    // 9. Detalhes Exclusivos por Facção (CV vs PCC vs POLÍCIA / BOPE)
    if (isPcc) {
      // SUPERBIKE BLINDADA 1000CC DO PCC: Carenagem Integral Esportiva (Full Fairing) + Spoiler Inferior + Frisos Neon-Azul
      const bellyPan = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 1.48), secondaryMat);
      bellyPan.position.set(0, 0.48, 0.16);
      group.add(bellyPan);

      for (const sx of [-0.48, 0.48]) {
        const fullFairing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.68, 1.32), primaryMat);
        fullFairing.rotation.x = -0.18;
        fullFairing.position.set(sx, 0.88, 0.54);

        const neonWinglet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 1.18), pccNeonBlueMat);
        neonWinglet.rotation.x = -0.18;
        neonWinglet.position.set(sx * 1.06, 0.94, 0.56);

        const tailNeon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.78), pccNeonBlueMat);
        tailNeon.rotation.x = -0.14;
        tailNeon.position.set(sx * 0.92, 1.16, -1.06);

        group.add(fullFairing, neonWinglet, tailNeon);
      }
    } else if (isPolice) {
      // MOTO TÁTICA ROCAM / BOPE: Protetor de Carenagem (Crash Bars), 2 Baús Laterais Blindados, Baú Traseiro com Antena e Giroflex Policial!
      for (const sx of [-1, 1]) {
        // Protetor tubular de motor (Crash Bar)
        const crashBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.54), silverMat);
        crashBar.position.set(sx * 0.48, 0.76, 0.48);

        // Baús Laterais Táticos Blindados (Pannier Cases) com faixa dourada do BOPE
        const sideBox = createLegoBrick(0.32, 0.46, 0.74, primaryColor, { studs: false });
        sideBox.position.set(sx * 0.56, 1.04, -0.98);
        const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.76), goldMat);
        goldStripe.position.set(sx * 0.56, 1.08, -0.98);

        // Giroflex Dianteiro nas laterais da carenagem (Vermelho na esquerda, Azul na direita)
        const frontStrobe = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.14, 0.14),
          sx < 0 ? policeRedStrobeMat : policeBlueStrobeMat
        );
        frontStrobe.position.set(sx * 0.46, 1.36, 1.38);

        group.add(crashBar, sideBox, goldStripe, frontStrobe);
      }

      // Baú Traseiro Superior Angular Studless + Mastro de Rádio com Giroflex Traseiro Elevado
      const topCase = new THREE.Mesh(
        makeTaperedHullGeo(0.68, 0.58, 0.38, 0.58, 0.5, -0.02, 0.05, 0.03),
        secondaryMat
      );
      topCase.position.set(0, 1.44, -1.36);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8), silverMat);
      pole.position.set(0.28, 1.76, -1.48);
      const rearBeaconRed = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12), policeRedStrobeMat);
      rearBeaconRed.position.set(0.28, 2.12, -1.48);
      const rearBeaconBlue = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12), policeBlueStrobeMat);
      rearBeaconBlue.position.set(-0.28, 1.66, -1.48);
      group.add(topCase, pole, rearBeaconRed, rearBeaconBlue);
    } else {
      // MOTO DE ASSALTO 600CC (CV): Protetor de Carter Vermelho + Aletas Streetfighter Agressivas
      const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.92), primaryMat);
      skidPlate.position.set(0, 0.46, 0.22);
      group.add(skidPlate);
    }

    // 10. Pneus Largos Esportivos (Traseiro 240mm Largo r=0.58, Dianteiro r=0.55) + Aros + Discos de Freio Ventilados + Pinças
    const wheels = [];
    const wheelConfigs = [
      { wz: 1.38, radius: 0.55, width: 0.38, isFront: true },
      { wz: -1.38, radius: 0.58, width: 0.52, isFront: false }
    ];
    const rimMat = customWheelMat || (isPcc ? pccNeonBlueMat : isPolice ? silverMat : goldMat);
    const caliperMat = isPcc ? pccNeonBlueMat : isPolice ? goldMat : primaryMat;

    for (const wc of wheelConfigs) {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(0, wc.radius, wc.wz);
      const spinGroup = new THREE.Group();

      // Pneu de borracha preta largo
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(wc.radius, wc.radius, wc.width, 20),
        tireMat
      );
      tire.rotation.z = Math.PI / 2;

      // Aro esportivo metálico + Raios em estrela
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(wc.radius * 0.64, wc.radius * 0.64, wc.width + 0.02, 16),
        rimMat
      );
      rim.rotation.z = Math.PI / 2;

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(wc.radius * 0.28, wc.radius * 0.28, wc.width + 0.06, 12),
        gunmetalMat
      );
      hub.rotation.z = Math.PI / 2;

      // Discos de Freio Ventilados nas duas faces da roda
      for (const dx of [-1, 1]) {
        const brakeDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(wc.radius * 0.48, wc.radius * 0.48, 0.04, 16),
          silverMat
        );
        brakeDisc.rotation.z = Math.PI / 2;
        brakeDisc.position.set(dx * (wc.width * 0.5 + 0.02), 0, 0);
        spinGroup.add(brakeDisc);

        const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.14), caliperMat);
        caliper.position.set(dx * (wc.width * 0.5 + 0.04), wc.radius * 0.32, -wc.radius * 0.24);
        steerGroup.add(caliper);
      }

      spinGroup.add(tire, rim, hub);
      steerGroup.add(spinGroup);
      group.add(steerGroup);
      wheels.push({ steerGroup, spinGroup, isFront: wc.isFront });
    }

    group.userData.wheels = wheels;
    group.userData.chassisDims = {
      w: 0.96,
      h: 0.9,
      d: 3.3,
      topY: 1.46,
      roofY: 1.46,
      cabinW: 0.9,
      cabinD: 1.1,
      cabinZ: 0.28,
      frontZ: 1.55,
      openTop: true,
      isMoto: true,
      wheelRadius: 0.56
    };
    _attachTurboFlames(group, [-0.48, 0.48], 0.92, -1.68);
    return group;
  }

  // ============================================================================
  // CASO ESPECIAL 2: TANQUE MILITAR TITAN-M1 (BLINDAGEM GLACIS INCLINADA & TORRETA STEALTH)
  // ============================================================================
  if (type === 'tanque_titan') {
    const tankOliveMat = getLegoMaterial(cfg.color ?? 0x2b3620, { roughness: 0.62, metalness: 0.28 });
    const tankDarkArmorMat = getLegoMaterial(0x1b2215, { roughness: 0.68, metalness: 0.34 });

    // Casco blindado com glacis frontal em cunha inclinada + deck de motor traseiro
    const hull = new THREE.Mesh(
      makeTaperedHullGeo(3.38, 3.05, 1.12, 5.88, 5.15, -0.18, 0.34, 0.14),
      tankOliveMat
    );
    hull.position.set(0, 0.92, 0);
    const lowerBelly = new THREE.Mesh(
      makeTaperedHullGeo(2.85, 3.36, 0.34, 5.1, 5.84, 0, 0, 0),
      tankDarkArmorMat
    );
    lowerBelly.position.set(0, 0.42, 0);
    const engineGrille = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.45), gunmetalTrimMat);
    engineGrille.position.set(0, 1.44, -1.85);
    group.add(hull, lowerBelly, engineGrille);

    // Esteiras blindadas laterais + Saias de Blindagem Reativa Chanfradas (ERA Skirts)
    for (const tx of [-1.76, 1.76]) {
      const track = new THREE.Mesh(
        makeTaperedHullGeo(0.64, 0.64, 0.86, 5.4, 5.92, 0, 0, 0),
        blackMat
      );
      track.position.set(tx, 0.46, 0);
      const skirt = new THREE.Mesh(
        makeTaperedHullGeo(0.74, 0.62, 0.44, 5.96, 5.65, -0.05, 0.14, 0.08),
        tankDarkArmorMat
      );
      skirt.position.set(tx, 0.96, 0);
      group.add(track, skirt);
    }

    // Faróis táticos embutidos e lanternas traseiras
    for (const lx of [-1.14, 1.14]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.14), headlightMat);
      hl.position.set(lx, 1.06, 2.86);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.14), taillightMat);
      tl.position.set(lx, 1.12, -2.92);
      group.add(hl, tl);
    }

    // Torreta Facetada Angular Estilo Abrams/Stealth + Cúpula + Lançadores de Fumaça
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.84, -0.18);
    const turretBody = new THREE.Mesh(
      makeTaperedHullGeo(2.48, 1.92, 0.76, 2.95, 2.35, -0.16, 0.22, 0.08),
      tankDarkArmorMat
    );
    const mantlet = new THREE.Mesh(
      makeTaperedHullGeo(0.86, 0.72, 0.48, 0.65, 0.48, 0.08, 0.1, 0),
      gunmetalTrimMat
    );
    mantlet.position.set(0, 0.04, 1.38);
    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.24, 8), gunmetalTrimMat);
    cupola.position.set(0.48, 0.48, -0.35);
    const cannonBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 3.95, 12), gunmetalTrimMat);
    cannonBarrel.rotation.x = Math.PI / 2;
    cannonBarrel.position.set(0, 0.06, 2.55);
    const boreEvacuator = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.68, 12), tankOliveMat);
    boreEvacuator.rotation.x = Math.PI / 2;
    boreEvacuator.position.set(0, 0.06, 2.85);
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.44, 12), blackMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.06, 4.48);
    turretGroup.add(turretBody, mantlet, cupola, cannonBarrel, boreEvacuator, muzzleBrake);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;

    const wheels = [];
    for (const wz of [-2.1, -0.7, 0.7, 2.1]) {
      for (const wx of [-1.78, 1.78]) {
        const steerGroup = new THREE.Group();
        steerGroup.position.set(wx, 0.44, wz);
        const spinGroup = new THREE.Group();
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.42, 12), gunmetalTrimMat);
        wheel.rotation.z = Math.PI / 2;
        spinGroup.add(wheel);
        steerGroup.add(spinGroup);
        group.add(steerGroup);
        wheels.push({ steerGroup, spinGroup, isFront: false });
      }
    }
    group.userData.wheels = wheels;
    group.userData.chassisDims = {
      w: 3.4,
      h: 1.15,
      d: 5.8,
      topY: 1.5,
      roofY: 2.25,
      cabinW: 2.3,
      cabinD: 2.7,
      cabinZ: -0.2,
      frontZ: 2.95,
      openTop: false,
      isMoto: false,
      wheelRadius: 0.42
    };
    _attachTurboFlames(group, [-0.8, 0.8], 0.75, -3.0);
    return group;
  }

  // ============================================================================
  // CASO ESPECIAL 3: ÔNIBUS METROPOLITANO SOMBRIO (FRENTE AERODINÂMICA & VIDRO FUMÊ)
  // ============================================================================
  if (type === 'onibus_urbano') {
    const busW = 2.82;
    const busD = 8.4;
    const lowerH = 1.05;
    const upperH = 1.18;
    const accentMat = getLegoMaterial(roofColor, { roughness: 0.34, metalness: 0.24, clearcoat: 0.38 });
    const ledSignMat = getLegoMaterial(0xd97706, { emissive: 0xd97706, emissiveIntensity: 1.15 });

    // Saia inferior chanfrada + faixa metálica central studless
    const lowerHull = new THREE.Mesh(
      makeTaperedHullGeo(busW - 0.06, busW, lowerH, busD - 0.12, busD, 0, 0.06, 0.03),
      bodyMat
    );
    lowerHull.position.set(0, 0.44 + lowerH * 0.5, 0);
    const midBelt = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.04, 0.18, busD + 0.02), accentMat);
    midBelt.position.set(0, 0.44 + lowerH + 0.05, 0);
    group.add(lowerHull, midBelt);

    // Galeria panorâmica de vidro fumê com para-brisa frontal inclinado!
    const winBaseY = 0.44 + lowerH + 0.14;
    const panoramicGlass = new THREE.Mesh(
      makeRakedCabinGeo(
        busW - 0.12,
        busW - 0.22,
        upperH,
        busD - 0.18,
        0,
        busD * 0.5 - 0.36,
        -busD * 0.5 + 0.16
      ),
      glassMat
    );
    panoramicGlass.position.set(0, winBaseY, 0);
    group.add(panoramicGlass);

    for (const pz of [-3.9, -2.5, -1.05, 0.4, 1.85, 3.25]) {
      for (const px of [-busW * 0.485, busW * 0.485]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, upperH, 0.2), gunmetalTrimMat);
        pillar.position.set(px, winBaseY + upperH * 0.5, pz);
        group.add(pillar);
      }
    }

    // Teto aerodinâmico studless + 2 módulos HVAC low-profile chanfrados
    const roofY = winBaseY + upperH + 0.09;
    const busRoof = new THREE.Mesh(
      makeTaperedHullGeo(busW - 0.16, busW - 0.34, 0.2, busD - 0.38, busD - 0.72, -0.08, 0.05, 0.04),
      accentMat
    );
    busRoof.position.set(0, roofY, -0.05);
    const acFront = new THREE.Mesh(
      makeTaperedHullGeo(1.68, 1.42, 0.22, 1.85, 1.52, -0.04, 0.06, 0.04),
      gunmetalTrimMat
    );
    acFront.position.set(0, roofY + 0.2, 1.55);
    const acRear = new THREE.Mesh(
      makeTaperedHullGeo(1.68, 1.42, 0.22, 1.85, 1.52, -0.04, 0.06, 0.04),
      gunmetalTrimMat
    );
    acRear.position.set(0, roofY + 0.2, -1.8);
    group.add(busRoof, acFront, acRear);

    // Letreiro Âmbar + Grade Escura Frontal + Para-choques + Faróis Slim LED
    const destBoard = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.24, 0.1), ledSignMat);
    destBoard.rotation.x = -0.18;
    destBoard.position.set(0, roofY - 0.26, busD * 0.5 - 0.24);
    const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.44, 0.1), blackMat);
    frontGrille.position.set(0, 0.86, busD * 0.5 + 0.02);
    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.08, 0.32, 0.34), gunmetalTrimMat);
    fBumper.position.set(0, 0.48, busD * 0.5 + 0.05);
    const rBumper = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.08, 0.34, 0.34), gunmetalTrimMat);
    rBumper.position.set(0, 0.48, -busD * 0.5 - 0.05);
    group.add(destBoard, frontGrille, fBumper, rBumper);

    for (const lx of [-1.06, 1.06]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.12), headlightMat);
      hl.rotation.z = lx > 0 ? -0.1 : 0.1;
      hl.position.set(lx, 0.88, busD * 0.5 + 0.04);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.12), taillightMat);
      tl.position.set(lx, 0.94, -busD * 0.5 - 0.04);
      group.add(hl, tl);
    }

    // 6 Rodas Pesadas
    const busTireG = new THREE.CylinderGeometry(0.52, 0.52, 0.42, 16);
    busTireG.rotateZ(Math.PI / 2);
    const busHubG = new THREE.CylinderGeometry(0.3, 0.3, 0.44, 12);
    busHubG.rotateZ(Math.PI / 2);
    const busWheelGeo = markAsSharedAsset(
      mergeColoredGeometries([
        { geo: busTireG, color: tireMat.color },
        { geo: busHubG, color: gunmetalTrimMat.color }
      ])
    );
    const busWheelMat = getSharedVertexColorMaterial({
      roughness: 0.34,
      metalness: 0.28,
      clearcoat: 0.24,
      clearcoatRoughness: 0.28
    });
    const wheels = [];
    for (const wz of [2.65, -1.85, -3.05]) {
      for (const wx of [-busW * 0.49, busW * 0.49]) {
        const steerGroup = new THREE.Group();
        steerGroup.position.set(wx, 0.52, wz);
        const spinGroup = new THREE.Group();
        const wheelMesh = new THREE.Mesh(busWheelGeo, busWheelMat);
        spinGroup.add(wheelMesh);
        steerGroup.add(spinGroup);
        group.add(steerGroup);
        wheels.push({ steerGroup, spinGroup, isFront: wz > 1.0 });
      }
    }
    group.userData.wheels = wheels;
    group.userData.chassisDims = {
      w: busW,
      h: lowerH + upperH + 0.16,
      d: busD,
      topY: roofY,
      roofY: roofY + 0.11,
      cabinW: busW - 0.14,
      cabinD: busD - 0.3,
      cabinZ: 0,
      frontZ: busD * 0.5 + 0.06,
      openTop: false,
      isMoto: false,
      isBus: true,
      wheelRadius: 0.52
    };
    _attachTurboFlames(group, [-0.75, 0.75], 0.52, -busD * 0.5 - 0.24);
    return group;
  }

  // ============================================================================
  // DEMAIS 15 VEÍCULOS — REMODEL HARD-SURFACE ANGULAR STUDLESS ("GOTHAM NOIR")
  // Cunha aerodinâmica, cabines inclinadas (fastback / V-hull), caixas de roda e vidro fumê!
  // ============================================================================
  const isHeavyTruck = type === 'caveirao_bope' || type === 'carro_forte' || type === 'van_pcc';
  const isSixWheelApc = type === 'hover_apc_ares';
  const isPickup = type === 'picape_cv' || type === 'choque_pickup';
  const isSuv = type === 'suv_pcc';
  const isSport =
    type === 'apex_gtx' ||
    type === 'cyber_blade' ||
    type === 'vortex_roadster' ||
    type === 'trovao_v8';
  const isWideHyper = type === 'apex_gtx' || type === 'cyber_blade';

  const chassisW = isHeavyTruck || isSixWheelApc ? 2.66 : isWideHyper ? 2.54 : isSuv || isPickup ? 2.44 : 2.36;
  const chassisH = isHeavyTruck ? 0.96 : isSixWheelApc ? 0.88 : isWideHyper ? 0.58 : isSport ? 0.64 : 0.72;
  const chassisD = isHeavyTruck || isSixWheelApc ? 5.64 : isPickup || isSuv ? 5.05 : 4.88;
  const chassisTopY = 0.42 + chassisH;
  const frontZ = chassisD * 0.5 + 0.04;
  const roofAccentMat = getLegoMaterial(roofColor, finishOpts);

  // 1. Assoalho / Saia Inferior Aerodinâmica + Cunha Esculpida da Carroceria Principal (Zero Studs!)
  const undertray = new THREE.Mesh(
    makeTaperedHullGeo(chassisW - 0.14, chassisW + 0.02, 0.22, chassisD - 0.16, chassisD, 0, 0, 0),
    darkTrimMat
  );
  undertray.position.set(0, 0.42, 0);
  group.add(undertray);

  const hoodDrop = isWideHyper
    ? 0.26
    : isSport
      ? 0.18
      : isSixWheelApc
        ? 0.32
        : type === 'caveirao_bope'
          ? 0.22
          : 0.13;
  const rearDeckDrop = isWideHyper ? -0.05 : isPickup ? 0.02 : 0.05;
  const mainBody = new THREE.Mesh(
    makeTaperedHullGeo(
      chassisW + 0.02,
      chassisW - (isSport ? 0.16 : 0.08),
      chassisH,
      chassisD,
      chassisD - (isSixWheelApc ? 0.42 : 0.18),
      isSport ? -0.08 : -0.03,
      hoodDrop,
      rearDeckDrop
    ),
    bodyMat
  );
  mainBody.position.set(0, 0.42 + chassisH * 0.5, 0);
  group.add(mainBody);

  // 2. Para-lamas Musculosos nas Caixas de Roda (Flared Wheel Arches) + Saias Laterais
  const wheelZList = isSixWheelApc ? [1.75, 0, -1.75] : [chassisD * 0.31, -chassisD * 0.31];
  for (const wz of wheelZList) {
    for (const sx of [-1, 1]) {
      const flare = new THREE.Mesh(
        makeTaperedHullGeo(0.16, 0.08, 0.34, 1.24, 0.92, 0, 0.04, 0.04),
        isHeavyTruck || isSixWheelApc || isSuv ? gunmetalTrimMat : bodyMat
      );
      flare.position.set(sx * (chassisW * 0.5 + 0.03), 0.68, wz);
      group.add(flare);
    }
  }
  if (!isSixWheelApc) {
    for (const sx of [-1, 1]) {
      const sideSkirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.14, chassisD * 0.44),
        gunmetalTrimMat
      );
      sideSkirt.position.set(sx * (chassisW * 0.5 + 0.01), 0.44, 0);
      group.add(sideSkirt);
    }
  }

  // 3. Splitter Frontal / Para-choques Chanfrados + Grade Escura + Difusor Traseiro + Escapamentos
  const fSplitter = new THREE.Mesh(
    makeTaperedHullGeo(chassisW + 0.08, chassisW - 0.04, 0.24, 0.44, 0.28, -0.06, 0.06, 0),
    gunmetalTrimMat
  );
  fSplitter.position.set(0, 0.42, frontZ + 0.02);
  const rDiffuser = new THREE.Mesh(
    makeTaperedHullGeo(chassisW + 0.06, chassisW - 0.04, 0.28, 0.38, 0.26, 0.05, 0, 0.06),
    gunmetalTrimMat
  );
  rDiffuser.position.set(0, 0.44, -frontZ - 0.01);
  const frontGrille = new THREE.Mesh(
    new THREE.BoxGeometry(chassisW * (isSport ? 0.58 : 0.52), isSport ? 0.22 : 0.34, 0.1),
    blackMat
  );
  frontGrille.position.set(0, isSport ? 0.58 : 0.68, frontZ + 0.01);
  group.add(fSplitter, rDiffuser, frontGrille);

  for (const ex of isSport ? [-0.68, -0.48, 0.48, 0.68] : [-0.62, 0.62]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.24, 10), silverMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(ex, 0.42, -frontZ - 0.12);
    group.add(exhaust);
  }

  // 4. Faróis Agressivos em Fenda Angular (LED Slits) + Barra/Lanternas Traseiras Carmesim
  const lightOffsetX = chassisW * 0.35;
  const hlY = 0.42 + chassisH - hoodDrop - 0.04;
  for (const lx of [-lightOffsetX, lightOffsetX]) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(isSport ? 0.54 : 0.46, isSport ? 0.13 : 0.19, 0.14),
      headlightMat
    );
    hl.rotation.z = (lx > 0 ? -1 : 1) * (isSport ? 0.16 : 0.08);
    hl.rotation.y = (lx > 0 ? -1 : 1) * 0.12;
    hl.position.set(lx, hlY, frontZ - 0.04);
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, isSport ? 0.14 : 0.2, 0.12),
      taillightMat
    );
    tl.position.set(lx, chassisTopY - 0.14, -frontZ + 0.02);
    group.add(hl, tl);
  }
  if (isSport || type === 'suv_pcc' || type === 'interceptor_v8') {
    const rearLightBar = new THREE.Mesh(
      new THREE.BoxGeometry(chassisW - 0.26, 0.07, 0.1),
      taillightMat
    );
    rearLightBar.position.set(0, chassisTopY - 0.12, -frontZ + 0.03);
    group.add(rearLightBar);
  }

  // 5. Bancos Internos + Volante Tático 3D
  const seatMat = type === 'vortex_roadster' ? darkTrimMat : blackMat;
  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.62), seatMat);
  driverSeat.position.set(-0.42, 1.02, -0.15);
  const passSeat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.62), seatMat);
  passSeat.position.set(0.42, 1.02, -0.15);
  const steeringWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 12), blackMat);
  steeringWheel.rotation.x = Math.PI / 3;
  steeringWheel.position.set(-0.42, 1.15, 0.52);
  group.add(driverSeat, passSeat, steeringWheel);

  // 6. Cabine / Greenhouse Inclinada (Fastback, SUV, Pickup ou Casco Facetado V-Hull de Blindado!)
  if (spec.openTop) {
    // Conversível Esportivo (Vortex Roadster) ou Buggy Tático de Dunas
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(chassisW - 0.34, 0.5, 0.1), glassMat);
    windshield.rotation.x = -0.52;
    windshield.position.set(0, chassisTopY + 0.2, 0.78);
    const wsFrameTop = new THREE.Mesh(new THREE.BoxGeometry(chassisW - 0.3, 0.06, 0.12), gunmetalTrimMat);
    wsFrameTop.rotation.x = -0.52;
    wsFrameTop.position.set(0, chassisTopY + 0.42, 0.64);
    group.add(windshield, wsFrameTop);

    for (const sx of [-0.52, 0.52]) {
      const rollHoop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.1), gunmetalTrimMat);
      rollHoop.rotation.x = -0.2;
      rollHoop.position.set(sx, chassisTopY + 0.13, -0.62);
      group.add(rollHoop);
    }

    if (type === 'buggy_praia') {
      const cageMat = getLegoMaterial(roofColor ?? 0xd97706, { roughness: 0.38, metalness: 0.35 });
      for (const cx of [-0.9, 0.9]) {
        const frontCage = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.92, 8), cageMat);
        frontCage.rotation.x = -0.46;
        frontCage.position.set(cx, chassisTopY + 0.38, 0.55);
        const topCage = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.45, 8), cageMat);
        topCage.rotation.x = Math.PI / 2;
        topCage.position.set(cx, chassisTopY + 0.76, -0.35);
        const rearCage = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.15, 8), cageMat);
        rearCage.rotation.x = 0.58;
        rearCage.position.set(cx, chassisTopY + 0.4, -1.35);
        group.add(frontCage, topCage, rearCage);
      }
    }
  } else if (type === 'caveirao_bope') {
    // CAVEIRÃO DO BOPE: Superestrutura Balística V-Hull Facetada + Fendas de Visão Blindadas!
    const cabinW = chassisW - 0.12;
    const cabinH = 1.08;
    const cabinD = 3.95;
    const cabinZ = -0.48;
    const armoredUpper = new THREE.Mesh(
      makeRakedCabinGeo(
        cabinW,
        cabinW - 0.44,
        cabinH,
        cabinD,
        cabinZ,
        cabinZ + cabinD * 0.5 - 0.52,
        cabinZ - cabinD * 0.5 + 0.24
      ),
      bodyMat
    );
    armoredUpper.position.set(0, chassisTopY - 0.02, 0);
    // Visor balístico estreito fumê + seteiras laterais
    const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.54, 0.28, 0.14), glassMat);
    visorSlit.rotation.x = -0.44;
    visorSlit.position.set(0, chassisTopY + 0.58, cabinZ + cabinD * 0.5 - 0.26);
    const visorLouver = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.48, 0.05, 0.18), silverMat);
    visorLouver.position.set(0, chassisTopY + 0.62, cabinZ + cabinD * 0.5 - 0.22);
    group.add(armoredUpper, visorSlit, visorLouver);

    for (const pz of [-1.6, -0.6, 0.4]) {
      for (const sx of [-1, 1]) {
        const gunPort = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.34), glassMat);
        gunPort.rotation.z = sx * 0.18;
        gunPort.position.set(sx * (cabinW * 0.5 - 0.11), chassisTopY + 0.62, pz);
        group.add(gunPort);
      }
    }
    const roofY = chassisTopY + cabinH + 0.04;
    const roofPlate = new THREE.Mesh(
      makeTaperedHullGeo(cabinW - 0.42, cabinW - 0.56, 0.12, cabinD - 0.78, cabinD - 0.96, -0.14, 0, 0),
      roofAccentMat
    );
    roofPlate.position.set(0, roofY, cabinZ);
    group.add(roofPlate);
    group.userData._roofMeta = { roofY, cabinW: cabinW - 0.42, cabinD: cabinD - 0.78, cabinZ };
  } else if (type === 'carro_forte' || type === 'van_pcc') {
    // CARRO-FORTE & VAN QUEBRA-COFRE: Cabine frontal inclinada + Cofre Traseiro Chanfrado Studless
    const cabinW = chassisW - 0.16;
    const cabinH = 1.04;
    const cabinD = 4.25;
    const cabinZ = -0.42;
    const vaultBody = new THREE.Mesh(
      makeRakedCabinGeo(
        cabinW,
        cabinW - 0.24,
        cabinH,
        cabinD,
        cabinZ,
        cabinZ + cabinD * 0.5 - 0.46,
        cabinZ - cabinD * 0.5 + 0.12
      ),
      bodyMat
    );
    vaultBody.position.set(0, chassisTopY - 0.02, 0);
    const frontVisor = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.38, 0.42, 0.14), glassMat);
    frontVisor.rotation.x = -0.4;
    frontVisor.position.set(0, chassisTopY + 0.56, cabinZ + cabinD * 0.5 - 0.22);
    const sideCabGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.08, 0.4, 0.92), glassMat);
    sideCabGlass.position.set(0, chassisTopY + 0.56, cabinZ + cabinD * 0.5 - 0.78);
    group.add(vaultBody, frontVisor, sideCabGlass);

    const roofY = chassisTopY + cabinH + 0.05;
    const roofPlate = new THREE.Mesh(
      makeTaperedHullGeo(cabinW - 0.22, cabinW - 0.34, 0.12, cabinD - 0.62, cabinD - 0.8, -0.16, 0, 0),
      roofAccentMat
    );
    roofPlate.position.set(0, roofY, cabinZ);
    group.add(roofPlate);
    group.userData._roofMeta = { roofY, cabinW: cabinW - 0.22, cabinD: cabinD - 0.62, cabinZ };
  } else if (type === 'hover_apc_ares') {
    // HOVER-APC A.R.E.S.: Casco Cyberpunk Stealth Angular de 6 Rodas
    const cabinW = chassisW - 0.18;
    const cabinH = 0.78;
    const cabinD = 3.9;
    const cabinZ = -0.24;
    const stealthDeck = new THREE.Mesh(
      makeRakedCabinGeo(
        cabinW,
        cabinW - 0.58,
        cabinH,
        cabinD,
        cabinZ,
        cabinZ + cabinD * 0.5 - 0.78,
        cabinZ - cabinD * 0.5 + 0.48
      ),
      bodyMat
    );
    stealthDeck.position.set(0, chassisTopY - 0.02, 0);
    const cyberVisor = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.64, 0.22, 0.16), glassMat);
    cyberVisor.rotation.x = -0.68;
    cyberVisor.position.set(0, chassisTopY + 0.42, cabinZ + cabinD * 0.5 - 0.42);
    group.add(stealthDeck, cyberVisor);

    const roofY = chassisTopY + cabinH + 0.04;
    group.userData._roofMeta = { roofY, cabinW: cabinW - 0.58, cabinD: cabinD - 1.25, cabinZ };
  } else {
    // CARROS ESPORTIVOS, MUSCLE, SEDANS, INTERCEPTORS, SUVs & PICAPES:
    // Greenhouse trapezoidal fumê com para-brisa inclinado, coluna C fastback e teto chanfrado studless!
    const cabinWBot = chassisW - 0.24;
    const cabinWTop = cabinWBot - (isSport ? 0.38 : 0.26);
    const cabinH = isSuv ? 0.74 : isPickup ? 0.72 : isWideHyper ? 0.54 : isSport ? 0.58 : 0.66;
    const cabinDBot = isSuv ? 2.95 : isPickup ? 2.15 : isSport ? 2.48 : 2.52;
    const cabinZ = isSuv ? -0.32 : isPickup ? 0.36 : isSport ? -0.18 : -0.14;
    const frontRake = isWideHyper ? 0.78 : isSport ? 0.68 : 0.54;
    const rearRake = isPickup ? 0.16 : isSuv ? 0.36 : isWideHyper ? 0.88 : isSport ? 0.74 : 0.52;
    const zTopFront = cabinZ + cabinDBot * 0.5 - frontRake;
    const zTopRear = cabinZ - cabinDBot * 0.5 + rearRake;
    const topD = Math.max(0.85, zTopFront - zTopRear);
    const topZCenter = (zTopFront + zTopRear) * 0.5;

    const cabinGlass = new THREE.Mesh(
      makeRakedCabinGeo(cabinWBot, cabinWTop, cabinH, cabinDBot, cabinZ, zTopFront, zTopRear),
      glassMat
    );
    cabinGlass.position.set(0, chassisTopY - 0.01, 0);
    group.add(cabinGlass);

    // Colunas A e C inclinadas em metal/cor do teto para silhueta automotiva real
    for (const sx of [-1, 1]) {
      const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, cabinH * 1.12, 0.1), roofAccentMat);
      aPillar.rotation.x = -Math.atan2(frontRake, cabinH);
      aPillar.rotation.z = sx * 0.16;
      aPillar.position.set(
        sx * ((cabinWBot + cabinWTop) * 0.25 - 0.02),
        chassisTopY + cabinH * 0.48,
        (cabinZ + cabinDBot * 0.5 + zTopFront) * 0.5
      );
      const cPillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, cabinH * 1.12, isSport ? 0.22 : 0.16),
        roofAccentMat
      );
      cPillar.rotation.x = Math.atan2(rearRake, cabinH);
      cPillar.rotation.z = sx * 0.16;
      cPillar.position.set(
        sx * ((cabinWBot + cabinWTop) * 0.25 - 0.02),
        chassisTopY + cabinH * 0.48,
        (cabinZ - cabinDBot * 0.5 + zTopRear) * 0.5
      );
      group.add(aPillar, cPillar);
    }

    const roofY = chassisTopY + cabinH + 0.04;
    const roofPlate = new THREE.Mesh(
      makeTaperedHullGeo(cabinWTop + 0.06, cabinWTop - 0.04, 0.1, topD + 0.08, topD - 0.04, 0, 0.02, 0.02),
      roofAccentMat
    );
    roofPlate.position.set(0, roofY, topZCenter);
    group.add(roofPlate);
    group.userData._roofMeta = { roofY, cabinW: cabinWTop, cabinD: topD, cabinZ: topZCenter };

    // Caçamba esculpida nas Picapes (paredes laterais + santo-antônio tático)
    if (isPickup) {
      for (const sx of [-1, 1]) {
        const bedWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 1.65), bodyMat);
        bedWall.position.set(sx * (chassisW * 0.5 - 0.1), chassisTopY + 0.1, -1.55);
        const rollBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), gunmetalTrimMat);
        rollBar.rotation.x = 0.52;
        rollBar.position.set(sx * (chassisW * 0.38), chassisTopY + 0.34, -0.98);
        group.add(bedWall, rollBar);
      }
    }
  }

  // ============================================================================
  // 7. DETALHES EXCLUSIVOS DE CADA UM DOS VEÍCULOS
  // ============================================================================
  if (type === 'apex_gtx' && !cfg.suppressDefaultSpoiler) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.65), blackMat);
    stripe.rotation.x = Math.atan2(hoodDrop, chassisD * 0.5) * 0.65;
    stripe.position.set(0, chassisTopY - 0.08, 1.35);
    const wingBlade = new THREE.Mesh(
      makeTaperedHullGeo(2.52, 2.58, 0.09, 0.52, 0.42, -0.04, 0.04, 0),
      gunmetalTrimMat
    );
    wingBlade.position.set(0, chassisTopY + 0.48, -2.18);
    for (const sx of [-1, 1]) {
      const wingPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.28), blackMat);
      wingPost.rotation.x = 0.22;
      wingPost.position.set(sx * 0.78, chassisTopY + 0.24, -2.12);
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.56), bodyMat);
      endplate.position.set(sx * 1.28, chassisTopY + 0.48, -2.18);
      group.add(wingPost, endplate);
    }
    group.add(stripe, wingBlade);
  } else if (type === 'trovao_v8') {
    const blower = new THREE.Mesh(
      makeTaperedHullGeo(0.84, 0.72, 0.32, 0.96, 0.82, -0.04, 0.05, 0.02),
      gunmetalTrimMat
    );
    blower.position.set(0, chassisTopY + 0.1, 1.42);
    const scoop = new THREE.Mesh(
      makeTaperedHullGeo(0.68, 0.58, 0.2, 0.68, 0.52, -0.06, 0, 0.05),
      silverMat
    );
    scoop.position.set(0, chassisTopY + 0.32, 1.48);
    const ducktail = new THREE.Mesh(
      makeTaperedHullGeo(chassisW - 0.16, chassisW - 0.24, 0.16, 0.28, 0.18, -0.04, 0.08, 0),
      blackMat
    );
    ducktail.position.set(0, chassisTopY + 0.05, -2.28);
    group.add(blower, scoop, ducktail);
  } else if (type === 'cyber_blade') {
    for (const nx of [-chassisW * 0.51, chassisW * 0.51]) {
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, chassisD - 0.4), neonCyanMat);
      neonStrip.position.set(nx, 0.52, 0);
      group.add(neonStrip);
    }
    const rearNeon = new THREE.Mesh(new THREE.BoxGeometry(chassisW - 0.12, 0.1, 0.1), neonPurpleMat);
    rearNeon.position.set(0, chassisTopY + 0.22, -2.28);
    group.add(rearNeon);
  } else if (type === 'caveirao_bope') {
    // Ariete Frontal em Cunha V-Plow + Escotilha Blindada Octogonal + Emblema Tático + Giroflex Low-Profile!
    const ram = new THREE.Mesh(
      makeTaperedHullGeo(2.74, 2.48, 0.92, 0.58, 0.28, -0.14, 0.18, 0),
      gunmetalTrimMat
    );
    ram.position.set(0, 0.78, frontZ + 0.24);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.24, 8), gunmetalTrimMat);
    hatch.position.set(0, 2.58, -0.22);
    const hatchShield = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.34, 0.12), darkTrimMat);
    hatchShield.rotation.x = -0.24;
    hatchShield.position.set(0, 2.78, 0.22);
    for (const sx of [-1.22, 1.22]) {
      const skullEmblem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.52), goldMat);
      skullEmblem.rotation.z = sx > 0 ? 0.16 : -0.16;
      skullEmblem.position.set(sx, 1.82, -0.52);
      group.add(skullEmblem);
    }
    _addPoliceLightbar(group, 2.56, 0.78);
    group.add(ram, hatch, hatchShield);
  } else if (type === 'interceptor_v8' || type === 'choque_pickup') {
    const pushBar = new THREE.Mesh(
      makeTaperedHullGeo(1.68, 1.48, 0.58, 0.28, 0.18, -0.05, 0.08, 0),
      blackMat
    );
    pushBar.position.set(0, 0.66, frontZ + 0.14);
    group.add(pushBar);
    const lbY = group.userData._roofMeta ? group.userData._roofMeta.roofY + 0.1 : 1.92;
    _addPoliceLightbar(group, lbY, isPickup ? 0.25 : -0.15);
  } else if (type === 'picape_cv') {
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, chassisTopY + 0.55, -1.42);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 8), blackMat);
    ped.position.y = -0.2;
    const shield = new THREE.Mesh(
      makeTaperedHullGeo(0.96, 0.78, 0.64, 0.14, 0.1, 0, 0, 0),
      gunmetalTrimMat
    );
    shield.rotation.x = -0.18;
    shield.position.set(0, 0.3, 0.35);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.1), blackMat);
    gunBody.position.set(0, 0.25, 0.2);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.42, 8), silverMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.25, 0.96);
    turretGroup.add(ped, shield, gunBody, barrel);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;
  } else if (type === 'hover_apc_ares') {
    for (const nx of [-1.34, 1.34]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 4.9), neonPurpleMat);
      strip.position.set(nx, 0.92, -0.08);
      group.add(strip);
    }
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 2.28, -0.24);
    const pod = new THREE.Mesh(
      makeTaperedHullGeo(1.38, 1.04, 0.52, 1.62, 1.24, -0.1, 0.16, 0.06),
      gunmetalTrimMat
    );
    const laserBarrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.85, 10), neonPurpleMat);
    laserBarrelL.rotation.x = Math.PI / 2;
    laserBarrelL.position.set(-0.32, 0.04, 1.12);
    const laserBarrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.85, 10), neonCyanMat);
    laserBarrelR.rotation.x = Math.PI / 2;
    laserBarrelR.position.set(0.32, 0.04, 1.12);
    turretGroup.add(pod, laserBarrelL, laserBarrelR);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;
  } else if (type === 'taxi_metro') {
    const signY = group.userData._roofMeta ? group.userData._roofMeta.roofY + 0.14 : 1.92;
    const taxiGlowMat = getLegoMaterial(0xd97706, { emissive: 0xb45309, emissiveIntensity: 0.85 });
    const sign = new THREE.Mesh(
      makeTaperedHullGeo(0.86, 0.68, 0.22, 0.38, 0.28, 0, 0.04, 0.04),
      taxiGlowMat
    );
    sign.position.set(0, signY, -0.14);
    group.add(sign);
  } else if (type === 'carro_forte') {
    for (const sx of [-1.24, 1.24]) {
      const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 4.15), goldMat);
      goldStripe.position.set(sx, 1.62, -0.42);
      group.add(goldStripe);
    }
  } else if (type === 'suv_pcc') {
    const bullBar = new THREE.Mesh(
      makeTaperedHullGeo(2.08, 1.84, 0.62, 0.28, 0.18, -0.05, 0.08, 0),
      gunmetalTrimMat
    );
    bullBar.position.set(0, 0.68, frontZ + 0.15);
    const blueMat = getLegoMaterial(0x1e3a8a, { roughness: 0.28 });
    for (const sx of [-chassisW * 0.51, chassisW * 0.51]) {
      const pccStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, chassisD - 0.45), blueMat);
      pccStripe.position.set(sx, 0.88, 0);
      const cyanTrim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, chassisD - 0.7), neonCyanMat);
      cyanTrim.position.set(sx, 0.76, 0);
      group.add(pccStripe, cyanTrim);
    }
    const antennaY = group.userData._roofMeta ? group.userData._roofMeta.roofY + 0.42 : 2.28;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.85, 6), silverMat);
    antenna.position.set(0, antennaY, -0.85);
    group.add(bullBar, antenna);
  } else if (type === 'van_pcc') {
    const ramPlate = new THREE.Mesh(
      makeTaperedHullGeo(2.54, 2.32, 0.82, 0.44, 0.24, -0.1, 0.14, 0),
      gunmetalTrimMat
    );
    ramPlate.position.set(0, 0.76, frontZ + 0.18);
    const blueMat = getLegoMaterial(0x1e3a8a, { roughness: 0.3 });
    for (const sx of [-1.24, 1.24]) {
      const sideArmor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 4.1), blueMat);
      sideArmor.position.set(sx, 1.58, -0.42);
      const silverLine = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 3.95), silverMat);
      silverLine.position.set(sx, 1.84, -0.42);
      group.add(sideArmor, silverLine);
    }
    const roofBox = new THREE.Mesh(
      makeTaperedHullGeo(1.32, 1.16, 0.26, 1.82, 1.58, -0.04, 0.05, 0.03),
      gunmetalTrimMat
    );
    roofBox.position.set(0, 2.6, -0.58);
    group.add(ramPlate, roofBox);
  }

  // Rodas cilíndricas com aros metálicos escovados (4 rodas padrão, ou 6 rodas para o Hover-APC)
  const wheelX = chassisW * 0.5;
  const wheelRadius = isHeavyTruck || type === 'buggy_praia' ? 0.52 : 0.44;
  const zPositions = isSixWheelApc ? [1.75, 0, -1.75] : [chassisD * 0.31, -chassisD * 0.31];
  const hubMat =
    customWheelMat ||
    (type === 'cyber_blade'
      ? neonCyanMat
      : type === 'apex_gtx' || type === 'carro_forte'
        ? goldMat
        : isHeavyTruck || type === 'suv_pcc'
          ? gunmetalTrimMat
          : silverMat);

  const wheels = [];
  const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.42, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, 0.44, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const wheelGeo = mergeColoredGeometries([
    { geo: tireGeo, color: tireMat.color },
    { geo: hubGeo, color: hubMat.color }
  ]);
  const hubIsEmissive = Boolean(hubMat.emissive && hubMat.emissive.getHex() !== 0 && (hubMat.emissiveIntensity ?? 0) > 0);
  const wheelMat = getSharedVertexColorMaterial({
    roughness: customWheelMat ? (customWheelMat.roughness ?? 0.24) : 0.32,
    metalness: customWheelMat ? Math.min(0.45, customWheelMat.metalness ?? 0.25) : 0.28,
    clearcoat: customWheelMat ? (customWheelMat.clearcoat ?? 0.45) : 0.28,
    emissive: hubIsEmissive ? hubMat.emissive : 0x000000,
    emissiveIntensity: hubIsEmissive ? 0.3 : 0
  });

  for (const wz of zPositions) {
    for (const wx of [-wheelX, wheelX]) {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wx, wheelRadius, wz);
      const spinGroup = new THREE.Group();

      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      spinGroup.add(wheelMesh);
      steerGroup.add(spinGroup);
      group.add(steerGroup);
      wheels.push({ steerGroup, spinGroup, isFront: wz > 0.5 });
    }
  }
  group.userData.wheels = wheels;
  const rm = group.userData._roofMeta;
  group.userData.chassisDims = {
    w: chassisW,
    h: chassisH,
    d: chassisD,
    topY: chassisTopY,
    roofY: rm ? rm.roofY + 0.06 : chassisTopY,
    cabinW: rm ? rm.cabinW : chassisW - 0.3,
    cabinD: rm ? rm.cabinD : 2.1,
    cabinZ: rm ? rm.cabinZ : -0.1,
    frontZ,
    openTop: Boolean(spec.openTop),
    isMoto: false,
    wheelRadius
  };

  _attachTurboFlames(group, [-0.55, 0.55], 0.46, -frontZ - 0.25);
  return group;
}

function _addPoliceLightbar(group, y, z) {
  const baseBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.56, 0.08, 0.28),
    getLegoMaterial(0x111827, { roughness: 0.4, metalness: 0.5 })
  );
  baseBar.position.set(0, y - 0.06, z);
  const redLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.14, 0.24),
    getLegoMaterial(0x991b1b, { emissive: 0xdc2626, emissiveIntensity: 1.0 })
  );
  redLight.position.set(-0.38, y + 0.02, z);
  const blueLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.14, 0.24),
    getLegoMaterial(0x1d4ed8, { emissive: 0x2563eb, emissiveIntensity: 1.0 })
  );
  blueLight.position.set(0.38, y + 0.02, z);
  group.add(baseBar, redLight, blueLight);
}

const SHARED_FLAME_MAT = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

function _attachTurboFlames(group, xOffsets, y, z) {
  const fGroup = new THREE.Group();
  fGroup.position.set(0, y, z);
  fGroup.visible = false;
  fGroup.userData.isNitroFlame = true;
  const coneGeos = [];
  for (const ex of xOffsets) {
    const g = new THREE.ConeGeometry(0.24, 1.45, 8);
    g.rotateX(-Math.PI / 2);
    g.translate(ex, 0, -0.58);
    coneGeos.push(g);
  }
  const flameMesh = new THREE.Mesh(mergeBufferGeometries(coneGeos), SHARED_FLAME_MAT);
  flameMesh.userData.isNitroFlame = true;
  fGroup.add(flameMesh);
  group.add(fGroup);

  const turboFlames = [fGroup];
  group.userData.turboFlames = turboFlames;
  group.userData.turboFlameMesh = flameMesh;
  const wheelSteerGroups = Array.isArray(group.userData.wheels)
    ? group.userData.wheels.map((w) => w.steerGroup)
    : [];
  optimizeStaticGroupMeshes(group, [
    fGroup,
    group.userData.turretGroup,
    ...wheelSteerGroups
  ]);
}

/**
 * POSICIONA TODOS OS 17 VEÍCULOS NA FRENTE DO SUPER BANCO CENTRAL (SEPARADOS POR SEUS 4 GRUPOS)
 * + ESPALHA EXEMPLARES EXTRAS PELAS REGIÕES DA CIDADE!
 */
export function buildParkedLegoCars(world) {
  const cars = [
    // ==========================================================================
    // FROTA DISTRIBUÍDA PELAS 10 REGIÕES DA CIDADE
    // (Os veículos que antes ficavam estáticos na frente do Super Banco agora circulam vivos no Trânsito Urbano e Patrulhas!)
    // ==========================================================================
    // Motos Táticas da Polícia / ROCAM / BOPE no Centro (Praça da Torre dos Heróis e Avenida Central)
    { x: 18.0, z: -48.0, rotY: 0, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 24.0, z: -48.0, rotY: 0, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    // Posto de Gasolina no Subúrbio Norte (explodem junto com as bombas!)
    { x: 181.0, z: -700.0, rotY: 0, color: 0x991b1b, roofColor: LEGO_COLORS.black, type: 'apex_gtx' },
    { x: 213.0, z: -700.0, rotY: Math.PI, color: 0x1e3a5f, roofColor: 0x0f172a, type: 'sedan_familiar' },
    // Estacionamento da Pizzaria & Ruas do Subúrbio Norte
    { x: 48.0, z: -680.0, rotY: 0, color: 0xc88a14, roofColor: 0x111827, type: 'taxi_metro' },
    { x: 64.0, z: -680.0, rotY: 0, color: 0x1e293b, roofColor: 0x090a0d, type: 'vortex_roadster' },
    { x: -45.0, z: -646.0, rotY: Math.PI / 2, color: 0x143828, roofColor: 0x0f172a, type: 'sedan_familiar' },
    { x: -178.0, z: -646.0, rotY: Math.PI / 2, color: 0x9a3412, roofColor: LEGO_COLORS.black, type: 'trovao_v8' },
    // Orla & Praia Sul (Buggies de Dunas na Areia, Conversíveis, Supercarros e Motos Táticas da Polícia na Avenida Beira-Mar)
    { x: -24.0, z: 710.0, rotY: Math.PI / 2, color: 0x7f1d1d, roofColor: 0x0f172a, type: 'vortex_roadster' },
    { x: -12.0, z: 710.0, rotY: Math.PI / 2, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 14.0, z: 710.0, rotY: -Math.PI / 2, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 28.0, z: 710.0, rotY: -Math.PI / 2, color: 0xb47b12, roofColor: LEGO_COLORS.black, type: 'apex_gtx' },
    { x: -32.0, z: 825.0, rotY: 0.35, color: 0x9a3412, roofColor: 0x1e293b, type: 'buggy_praia' },
    { x: 32.0, z: 825.0, rotY: -0.35, color: 0x2b3620, roofColor: 0xb45309, type: 'buggy_praia' },
    { x: -195.0, z: 895.0, rotY: 0.2, color: 0x7c2d12, roofColor: 0x1e293b, type: 'buggy_praia' },
    { x: 195.0, z: 895.0, rotY: -0.2, color: 0x143828, roofColor: 0xb47b12, type: 'buggy_praia' },
    // Dunas da Ponta da Praia / Costão Sudoeste (Buggies de Duna ao lado do Farol e Marina Oeste):
    { x: -1450.0, z: 830.0, rotY: 0.35, color: 0x9a3412, roofColor: 0x1e293b, type: 'buggy_praia' },
    { x: -1215.0, z: 830.0, rotY: -0.25, color: 0x1f2937, roofColor: 0xb45309, type: 'buggy_praia' },
    // Favela / Complexo da Cidade de Deus — Bocas de Entrada do CV (Oeste: Motos de Assalto 600cc e Picapes Armadas do CV!)
    { x: -518.0, z: -382.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: -250.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
    { x: -518.0, z: -242.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: -117.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: -108.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
    { x: -518.0, z: 134.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: 245.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: 340.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
    // Distrito Industrial (Leste — Império Blindado 100% PCC):
    // 1) Saindo da Rampa Subterrânea / Garagem de Fuga Blindada do Bunker Central (X = 896, Z = -356..-315) + Superbikes 1000cc do PCC:
    { x: 896.0, y: -1.1, z: -358.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'van_pcc' },
    { x: 896.0, y: 0.0, z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: 882.0, y: 0.0, z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 910.0, y: 0.0, z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 850.0, y: 0.0, z: -334.0, rotY: -Math.PI / 4, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
    // 2) Pátio da Frota ("O Bonde do PCC" — X = 635..735, Z = -342..-288: Fileiras alinhadas de SUVs Pretas, Vans Quebra-Cofre e Superbikes 1000cc!):
    { x: 632.0, z: -322.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 632.0, z: -315.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 632.0, z: -308.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 642.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: 660.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
    { x: 678.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: 696.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
    { x: 714.0, z: -338.0, rotY: 0, color: 0x1e293b, roofColor: 0x090a0d, type: 'van_pcc' },
    { x: 732.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'van_pcc' },
    { x: 642.0, z: -292.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
    { x: 664.0, z: -292.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: 692.0, z: -292.0, rotY: Math.PI, color: 0x0f172a, roofColor: 0x1e3a8a, type: 'van_pcc' },
    { x: 720.0, z: -292.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0x090a0d, type: 'van_pcc' },
    // 3) Pátio do Desmanche & Ferro-Velho do Sindicato (X = 1005..1125, Z = -345..-285: Carros-Fortes roubados e Viaturas capturadas!):
    { x: 1018.0, z: -332.0, rotY: 0.25, color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, type: 'carro_forte' },
    { x: 1048.0, z: -332.0, rotY: -0.18, color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, type: 'carro_forte' },
    { x: 1082.0, z: -296.0, rotY: 2.6, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
    { x: 1112.0, z: -296.0, rotY: -2.4, color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
    // 4) Barricadas Táticas nas Entradas do Distrito Industrial (X = 594):
    { x: 594.0, z: -376.0, rotY: 0.42, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: 594.0, z: -368.0, rotY: 0.42, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 594.0, z: -244.0, rotY: -0.38, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'van_pcc' },
    { x: 594.0, z: -119.0, rotY: 0.35, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 594.0, z: -111.0, rotY: 0.35, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    // Base Portuária Fortificada da A.R.E.S. no Porto Leste (Frota de Hover-APCs de 6 rodas):
    { x: 882.0, y: 0.3, z: 615.0, rotY: Math.PI / 2, color: 0x334155, roofColor: 0xa855f7, type: 'hover_apc_ares' },
    { x: 882.0, y: 0.3, z: 655.0, rotY: Math.PI / 2, color: 0x1e293b, roofColor: 0xd946ef, type: 'hover_apc_ares' },
    { x: 1108.0, y: 0.3, z: 615.0, rotY: -Math.PI / 2, color: 0x334155, roofColor: 0xa855f7, type: 'hover_apc_ares' },
    { x: 1108.0, y: 0.3, z: 655.0, rotY: -Math.PI / 2, color: 0x1e293b, roofColor: 0xd946ef, type: 'hover_apc_ares' },
    // Aeroporto Internacional & Base Militar Oeste (Estacionamento na frente do Mega Terminal + Baias de Tanques!)
    { x: -1058.0, z: -65.0, rotY: Math.PI / 2, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi_metro' },
    { x: -1058.0, z: -95.0, rotY: Math.PI / 2, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi_metro' },
    { x: -1058.0, z: 65.0, rotY: Math.PI / 2, color: 0x2563eb, roofColor: LEGO_COLORS.white, type: 'sedan_familiar' },
    { x: -1058.0, z: 95.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: -1212.0, z: 390.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    { x: -1212.0, z: 425.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    { x: -1212.0, z: 460.0, rotY: 0, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    // Ala Militar Norte da Base Oeste (Pátio de Tanques no Canto Noroeste):
    { x: -1380.0, y: 0.3, z: -1115.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    { x: -1330.0, y: 0.3, z: -1115.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    // Grande Ponte Blindada (2 Checkpoints do BOPE: Lado do Porto Z = 754 e Chegada na Prisão Z = 1094) + Setor 2 (Garagem Tática da Ilha da Prisão):
    { x: 1358.0, y: 0.3, z: 754.0, rotY: 0, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 1363.5, y: 0.3, z: 754.0, rotY: 0, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    { x: 1386.5, y: 0.3, z: 754.0, rotY: 0, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
    { x: 1363.5, y: 0.3, z: 1094.0, rotY: Math.PI, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    { x: 1386.5, y: 0.3, z: 1094.0, rotY: Math.PI, color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
    { x: 1392.0, y: 0.3, z: 1094.0, rotY: Math.PI, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 1445.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    { x: 1463.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x090a0d, roofColor: 0xfacc15, type: 'caveirao_bope' },
    { x: 1481.0, y: 0.3, z: 1315.0, rotY: 0, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
    { x: 1497.0, y: 0.3, z: 1315.0, rotY: 0, color: LEGO_COLORS.black, roofColor: 0x2563eb, type: 'interceptor_v8' },
    { x: 1513.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
    { x: 1529.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x1e293b, roofColor: LEGO_COLORS.black, type: 'choque_pickup' }
  ];

  cars.forEach((cfg) => {
    const spec = VEHICLE_SPECS[cfg.type] || VEHICLE_SPECS.apex_gtx;
    const carGroup = createLegoCarMesh(cfg);
    const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.x, cfg.z) : 0;
    const yBase = cfg.y !== undefined ? (cfg.y < 1.5 ? terrainY + cfg.y : cfg.y) : terrainY;
    carGroup.position.set(cfg.x, yBase, cfg.z);
    carGroup.rotation.y = cfg.rotY;
    carGroup.userData.carType = cfg.type;
    carGroup.userData.carName = spec.name;
    carGroup.userData.vehicleSpec = spec;
    world.scene.add(carGroup);

    const isRotated90 = Math.abs(Math.sin(cfg.rotY)) > 0.7;
    const isMoto = Boolean(spec.isMotorcycle);
    const baseW = isMoto ? 1.45 : cfg.type === 'tanque_titan' ? 3.8 : 2.5;
    const baseD = isMoto ? 3.8 : cfg.type === 'tanque_titan' ? 5.9 : 5.0;
    const carWidth = isRotated90 ? baseD : baseW;
    const carDepth = isRotated90 ? baseW : baseD;

    const col1 = world.addCollider(cfg.x, cfg.z, carWidth, carDepth, yBase + 1.25, yBase);
    const col2 = world.addCollider(cfg.x, cfg.z, carWidth * 0.85, carDepth * 0.6, yBase + 2.05, yBase);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: carGroup,
        type: 'car',
        hp: spec.hp,
        radius: Math.max(carWidth, carDepth) * 0.52,
        height: 2.1,
        colliders: [col1, col2],
        debrisColors: [cfg.color, cfg.roofColor, LEGO_COLORS.black, LEGO_COLORS.yellow],
        studDrops: spec.studDrops,
        groundY: yBase
      });
    }
  });
}
