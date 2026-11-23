/**
 * AircraftFleetBuilder.js
 * Especificações e construção 3D dos helicópteros policiais/ataque, jatos executivos VIP,
 * caças supersônicos, aviões comerciais e montagem unificada `buildBoatsAndAircraftFleet`.
 */

import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { optimizeStaticGroupMeshes } from '../BuildingGenerator.js';
import { IS_SCALED_WORLD, ws } from '../core/WorldLayoutScale.js';
import {
  KMH_TO_UNITS,
  VEHICLE_SPECS
} from './VehicleSpecsCatalog.js';
import {
  attachExhaustFlames,
  createNavalAirMaterialContext
} from './VehicleChassisPrimitives.js';
import {
  NAVAL_BOAT_TYPES,
  NAVAL_SPECS,
  COLOSSAL_AND_PORT_SPECS,
  buildNavalBoatMesh,
  resolveNavalBoatPlacements,
  LAKE_AND_MARINA_BOAT_PLACEMENTS,
  COAST_GUARD_BOAT_PLACEMENTS
} from './NavalFleetBuilder.js';

/**
 * Especificações das aeronaves e helicópteros (Grupo 6).
 */
export const AIRCRAFT_SPECS = {
  heli_policia: {
    id: 'heli_policia',
    category: 'helicopter',
    group: 'AERONAVES & HELICÓPTEROS',
    name: 'HELICÓPTERO ÁGUIA TÁTICO (BOPE)',
    kmh: 235,
    turboKmh: 285,
    maxForward: 235 * KMH_TO_UNITS,
    turboSpeed: 285 * KMH_TO_UNITS,
    maxReverse: -75 * KMH_TO_UNITS,
    accel: 46.0,
    turnRate: 2.4,
    driftTurnRate: 3.0,
    hp: 680,
    openTop: false,
    weapon: 'machinegun', // Metralhadora Tática Frontal (Clique Esquerdo)!
    enterRadius: 8.0,
    seatedYOffset: 1.45,
    cameraDistScale: 1.38,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 10, blue: 5, purple: 1 }
  },
  heli_ataque: {
    id: 'heli_ataque',
    category: 'helicopter',
    group: 'AERONAVES & HELICÓPTEROS',
    name: 'HELICÓPTERO DE ATAQUE FALCON-X',
    kmh: 265,
    turboKmh: 320,
    maxForward: 265 * KMH_TO_UNITS,
    turboSpeed: 320 * KMH_TO_UNITS,
    maxReverse: -85 * KMH_TO_UNITS,
    accel: 52.0,
    turnRate: 2.5,
    driftTurnRate: 3.2,
    hp: 980,
    openTop: false,
    weapon: 'tank_cannon', // Dispara Mísseis / Canhão Explosivo no Clique Esquerdo!
    enterRadius: 8.5,
    seatedYOffset: 1.55,
    cameraDistScale: 1.48,
    rammingPower: 'unstoppable',
    studDrops: { silver: 8, gold: 12, blue: 6, purple: 2 }
  },
  jato_vip: {
    id: 'jato_vip',
    category: 'plane',
    group: 'AERONAVES & HELICÓPTEROS',
    name: 'JATO EXECUTIVO VIP (GULF-LEGO)',
    kmh: 330,
    turboKmh: 395,
    maxForward: 330 * KMH_TO_UNITS,
    turboSpeed: 395 * KMH_TO_UNITS,
    maxReverse: -55 * KMH_TO_UNITS,
    accel: 64.0,
    turnRate: 2.2,
    driftTurnRate: 3.1,
    hp: 520,
    openTop: false,
    weapon: null,
    enterRadius: 9.0,
    seatedYOffset: 1.55,
    cameraDistScale: 1.55,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 10, blue: 6, purple: 2 }
  },
  jato_caca: {
    id: 'jato_caca',
    category: 'plane',
    group: 'AERONAVES & HELICÓPTEROS',
    name: 'CAÇA SUPERSÔNICO F-99 RAPTOR',
    kmh: 395,
    turboKmh: 485,
    maxForward: 395 * KMH_TO_UNITS,
    turboSpeed: 485 * KMH_TO_UNITS,
    maxReverse: -60 * KMH_TO_UNITS,
    accel: 78.0,
    turnRate: 2.55,
    driftTurnRate: 3.6,
    hp: 880,
    openTop: false,
    weapon: 'tank_cannon', // Canhão Aéreo / Mísseis Explosivos no Clique Esquerdo!
    enterRadius: 9.2,
    seatedYOffset: 1.65,
    cameraDistScale: 1.6,
    rammingPower: 'unstoppable',
    studDrops: { silver: 8, gold: 14, blue: 8, purple: 3 }
  },
  aviao_comercial: {
    id: 'aviao_comercial',
    category: 'plane',
    group: 'AERONAVES & HELICÓPTEROS',
    name: 'AVIÃO COMERCIAL LEGO AIRLINES',
    kmh: 295,
    turboKmh: 350,
    maxForward: 295 * KMH_TO_UNITS,
    turboSpeed: 350 * KMH_TO_UNITS,
    maxReverse: -45 * KMH_TO_UNITS,
    accel: 48.0,
    turnRate: 1.65,
    driftTurnRate: 2.2,
    hp: 1500,
    openTop: false,
    weapon: null,
    enterRadius: 13.5,
    seatedYOffset: 3.6,
    cameraDistScale: 2.45,
    rammingPower: 'unstoppable',
    studDrops: { silver: 10, gold: 16, blue: 10, purple: 4 }
  }
};

/**
 * Catálogo consolidado de Embarcações, Aeronaves, Carreta Portuária e Navios Colossais.
 */
export const NAVAL_AIR_SPECS = {
  ...NAVAL_SPECS,
  ...AIRCRAFT_SPECS,
  ...COLOSSAL_AND_PORT_SPECS
};

// Registra no catálogo global VEHICLE_SPECS
Object.assign(VEHICLE_SPECS, NAVAL_AIR_SPECS);

/**
 * Constrói Helicópteros (Águia Policial BOPE & Falcon-X de Ataque Militar).
 */
export function buildHelicopterMesh(cfg, ctx) {
  const {
    type,
    group,
    bodyFinish,
    blackMat,
    darkMat,
    silverMat,
    redMat,
    glassMat
  } = ctx;

  const isAttack = type === 'heli_ataque';
  const mainHue = cfg.color ?? (isAttack ? 0x3f6212 : 0x111827);
  const trimHue = cfg.roofColor ?? (isAttack ? 0x334155 : LEGO_COLORS.gold);

  for (const sx of [-1.75, 1.75]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 8.6), darkMat);
    skid.position.set(sx, 0.2, 0.2);
    const strutF = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.2, 0.26), darkMat);
    strutF.position.set(sx * 0.85, 0.75, 2.2);
    const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.2, 0.26), darkMat);
    strutR.position.set(sx * 0.85, 0.75, -1.8);
    group.add(skid, strutF, strutR);
  }

  const fuselage = createLegoBrick(3.4, 2.7, 7.8, mainHue, { studs: false, ...bodyFinish });
  fuselage.position.set(0, 2.15, 0);
  const stripe = createLegoBrick(3.52, 0.45, 7.85, trimHue, { studs: false, ...bodyFinish });
  stripe.position.set(0, 2.05, 0);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.1, 3.8), glassMat);
  cockpit.position.set(0, 2.15, 4.2);
  cockpit.userData.isVehicleGlass = true;
  const noseChin = createLegoBrick(2.6, 0.85, 2.2, mainHue, { studs: false, ...bodyFinish });
  noseChin.position.set(0, 1.35, 5.1);

  const tailBoom = createLegoBrick(1.2, 1.25, 7.6, mainHue, { studs: false, ...bodyFinish });
  tailBoom.position.set(0, 2.55, -6.8);
  const tailFin = createLegoBrick(0.45, 2.9, 1.8, trimHue, { studs: false, ...bodyFinish });
  tailFin.position.set(0, 3.6, -10.2);
  group.add(fuselage, stripe, cockpit, noseChin, tailBoom, tailFin);
  group.userData.initialColors = { color: mainHue, roofColor: trimHue };
  group.userData.aircraftDims = { category: 'helicopter', w: isAttack ? 8.6 : 4.2, h: 4.5, d: 15.2 };

  if (isAttack) {
    const stubWings = createLegoBrick(8.6, 0.48, 2.4, 0x1e293b, { studs: false });
    stubWings.position.set(0, 2.05, 0.2);
    for (const wx of [-3.4, 3.4]) {
      const rocketPod = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 2.6, 12), darkMat);
      rocketPod.rotation.x = Math.PI / 2;
      rocketPod.position.set(wx, 1.55, 0.4);
      const missileTip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 10), redMat);
      missileTip.rotation.x = Math.PI / 2;
      missileTip.position.set(wx, 1.55, 1.9);
      group.add(rocketPod, missileTip);
    }
    group.add(stubWings);
  } else {
    const searchlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.32, 0.6, 12),
      getLegoMaterial(0xfef08a, { emissive: 0xfef08a, emissiveIntensity: 0.95 })
    );
    searchlight.rotation.x = Math.PI / 2;
    searchlight.position.set(0, 0.95, 5.8);
    group.add(searchlight);
  }

  const noseCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8), silverMat);
  noseCannon.rotation.x = Math.PI / 2;
  noseCannon.position.set(0, 1.05, 6.2);
  group.add(noseCannon);

  const mainRotorGroup = new THREE.Group();
  mainRotorGroup.position.set(0, 3.95, 0.2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.85, 12), blackMat);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.14, 0.82), darkMat);
  blade1.position.y = 0.32;
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 14.5), darkMat);
  blade2.position.y = 0.32;
  mainRotorGroup.add(mast, blade1, blade2);

  const tailRotorGroup = new THREE.Group();
  tailRotorGroup.position.set(0.38, 4.1, -10.3);
  const tBlade1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.32), silverMat);
  const tBlade2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 2.6), silverMat);
  tailRotorGroup.add(tBlade1, tBlade2);

  group.add(mainRotorGroup, tailRotorGroup);
  group.userData.mainRotorGroup = mainRotorGroup;
  group.userData.tailRotorGroup = tailRotorGroup;

  attachExhaustFlames(group, [[-0.9, 3.1, -3.9], [0.9, 3.1, -3.9]], 1.0);
  return group;
}

/**
 * Constrói Jato Executivo VIP e Caça Supersônico F-99 Raptor.
 */
export function buildJetAircraftMesh(cfg, ctx) {
  const {
    type,
    group,
    bodyFinish,
    blackMat,
    silverMat,
    glassMat
  } = ctx;

  const isFighter = type === 'jato_caca';
  const fuseHue = cfg.color ?? (isFighter ? 0x334155 : LEGO_COLORS.white);
  const accentHue = cfg.roofColor ?? (isFighter ? LEGO_COLORS.red : LEGO_COLORS.gold);
  const wingHue = cfg.wingColor ?? (isFighter ? accentHue : 0xf1f5f9);
  const tailHue = cfg.wingColor ?? (isFighter ? 0x0f172a : accentHue);

  const fuselage = createLegoBrick(3.4, 2.1, 14.5, fuseHue, { studs: false, ...bodyFinish });
  fuselage.position.set(0, 2.1, -0.5);
  const stripe = createLegoBrick(3.52, 0.38, 14.6, accentHue, { studs: false, ...bodyFinish });
  stripe.position.set(0, 2.0, -0.5);

  const noseCone = createLegoBrick(2.2, 1.35, 4.6, fuseHue, { studs: false, ...bodyFinish });
  noseCone.position.set(0, 1.85, 8.2);
  const noseTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 2.8, 12),
    getLegoMaterial(isFighter ? accentHue : fuseHue, bodyFinish)
  );
  noseTip.rotation.x = Math.PI / 2;
  noseTip.position.set(0, 1.85, 11.6);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.35, 4.8), glassMat);
  canopy.position.set(0, 3.05, 3.8);
  canopy.userData.isVehicleGlass = true;

  const wings = createLegoBrick(15.6, 0.45, 6.8, wingHue, { studs: false, ...bodyFinish });
  wings.position.set(0, 1.95, -1.2);
  for (const wx of [-7.9, 7.9]) {
    const wingtip = createLegoBrick(0.55, 0.9, 4.2, accentHue, { studs: false, ...bodyFinish });
    wingtip.position.set(wx, 2.2, -1.2);
    group.add(wingtip);
  }

  if (isFighter) {
    for (const tx of [-1.45, 1.45]) {
      const vTail = createLegoBrick(0.45, 3.4, 3.4, tailHue, { studs: false, ...bodyFinish });
      vTail.position.set(tx, 3.8, -6.2);
      vTail.rotation.z = tx > 0 ? -0.22 : 0.22;
      group.add(vTail);
    }
  } else {
    const vTail = createLegoBrick(0.55, 4.2, 3.8, tailHue, { studs: false, ...bodyFinish });
    vTail.position.set(0, 4.4, -6.4);
    const hTail = createLegoBrick(5.8, 0.38, 2.4, fuseHue, { studs: false, ...bodyFinish });
    hTail.position.set(0, 6.2, -6.6);
    group.add(vTail, hTail);
  }

  for (const [gx, gz] of [[0, 6.2], [-2.4, -2.2], [2.4, -2.2]]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), silverMat);
    strut.position.set(gx, 0.95, gz);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.42, 14), blackMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gx, 0.52, gz);
    group.add(strut, wheel);
  }

  group.add(fuselage, stripe, noseCone, noseTip, canopy, wings);
  group.userData.initialColors = { color: fuseHue, roofColor: accentHue };
  group.userData.aircraftDims = { category: 'plane', w: 16.4, h: 6.4, d: 20.5 };
  attachExhaustFlames(group, [[-0.95, 2.0, -7.8], [0.95, 2.0, -7.8]], 1.45);
  return group;
}

/**
 * Constrói o Mega Avião Comercial LEGO Airlines (Boeing / Airbus LEGO).
 */
export function buildCommercialAirlinerMesh(ctx) {
  const { group, darkMat, silverMat, glassMat } = ctx;

  const fuselage = createLegoBrick(5.8, 5.2, 30.0, LEGO_COLORS.white, { studs: false });
  fuselage.position.set(0, 4.4, 0);
  const belly = createLegoBrick(5.95, 1.6, 30.2, 0x0284c7, { studs: false });
  belly.position.set(0, 2.4, 0);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.0, 4.2), glassMat);
  cockpit.position.set(0, 5.1, 14.8);
  const nose = createLegoBrick(4.4, 2.8, 3.6, LEGO_COLORS.white, { studs: false });
  nose.position.set(0, 3.4, 16.2);

  const mainWings = createLegoBrick(34.0, 0.72, 7.2, LEGO_COLORS.white, { studs: false });
  mainWings.position.set(0, 3.8, 1.2);
  for (const ex of [-9.5, 9.5]) {
    const engineNacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 5.2, 16), silverMat);
    engineNacelle.rotation.x = Math.PI / 2;
    engineNacelle.position.set(ex, 2.35, 2.5);
    group.add(engineNacelle);
  }

  const tailFin = createLegoBrick(1.1, 8.8, 6.2, 0x0284c7, { studs: false });
  tailFin.position.set(0, 10.4, -12.2);
  const tailGold = createLegoBrick(1.25, 2.0, 4.8, LEGO_COLORS.gold, { studs: false });
  tailGold.position.set(0, 13.6, -12.6);
  const hStab = createLegoBrick(14.5, 0.55, 4.2, LEGO_COLORS.white, { studs: false });
  hStab.position.set(0, 4.9, -13.2);

  for (const [gx, gz] of [[0, 12.0], [-3.2, -1.5], [3.2, -1.5]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.85), darkMat);
    leg.position.set(gx, 1.0, gz);
    group.add(leg);
  }

  group.add(fuselage, belly, cockpit, nose, mainWings, tailFin, tailGold, hStab);
  attachExhaustFlames(group, [[-9.5, 2.35, -0.3], [9.5, 2.35, -0.3]], 1.85);
  return group;
}

/**
 * Dispatcher que constrói a malha 3D LEGO detalhada de qualquer Embarcação ou Aeronave (+Z).
 */
export function createNavalOrAircraftMesh(cfg) {
  const ctx = createNavalAirMaterialContext(cfg);
  if (NAVAL_BOAT_TYPES.has(ctx.type)) {
    return buildNavalBoatMesh(cfg, ctx);
  }
  if (ctx.type === 'heli_policia' || ctx.type === 'heli_ataque') {
    return buildHelicopterMesh(cfg, ctx);
  }
  if (ctx.type === 'jato_vip' || ctx.type === 'jato_caca') {
    return buildJetAircraftMesh(cfg, ctx);
  }
  return buildCommercialAirlinerMesh(ctx);
}

const DESIGN_AIRPORT_AIRCRAFT_PLACEMENTS = [
  // 2 Grandes Aviões Comerciais LEGO Airlines nos pátios civis:
  { x: -1380.0, y: 0.22, z: -420.0, rotY: 0, color: LEGO_COLORS.white, type: 'aviao_comercial' },
  { x: -1380.0, y: 0.22, z: -140.0, rotY: 0, color: LEGO_COLORS.white, type: 'aviao_comercial' },

  // 4 Jatos Executivos VIP dentro dos Galpões Civis Azuis:
  { x: -1298.0, y: 0.22, z: -365.0, rotY: -Math.PI / 2, color: LEGO_COLORS.white, type: 'jato_vip' },
  { x: -1462.0, y: 0.22, z: -475.0, rotY: -Math.PI / 2, color: LEGO_COLORS.white, type: 'jato_vip' },
  { x: -1298.0, y: 0.22, z: -195.0, rotY: -Math.PI / 2, color: LEGO_COLORS.white, type: 'jato_vip' },
  { x: -1462.0, y: 0.22, z: -85.0,  rotY: -Math.PI / 2, color: LEGO_COLORS.white, type: 'jato_vip' },

  // 8 Jatos de Caça Supersônicos F-99 Raptor nos Galpões Militares e Pátios:
  { x: -1298.0, y: 0.22, z: 85.0,   rotY: -Math.PI / 2, color: 0x334155, type: 'jato_caca' },
  { x: -1462.0, y: 0.22, z: 85.0,   rotY: -Math.PI / 2, color: 0x334155, type: 'jato_caca' },
  { x: -1298.0, y: 0.22, z: 195.0,  rotY: -Math.PI / 2, color: 0x334155, type: 'jato_caca' },
  { x: -1462.0, y: 0.22, z: 195.0,  rotY: -Math.PI / 2, color: 0x334155, type: 'jato_caca' },
  { x: -1298.0, y: 0.22, z: 365.0,  rotY: -Math.PI / 2, color: 0x334155, type: 'jato_caca' },
  { x: -1462.0, y: 0.22, z: 365.0,  rotY: -Math.PI / 2, color: 0x334155, type: 'jato_caca' },
  { x: -1380.0, y: 0.22, z: 140.0,  rotY: 0,            color: 0x334155, type: 'jato_caca' },
  { x: -1380.0, y: 0.22, z: 240.0,  rotY: 0,            color: 0x334155, type: 'jato_caca' },

  // 4 Helicópteros de Ataque Militar Falcon-X + 1 Helicóptero Policial Águia no Aeroporto:
  { x: -1298.0, y: 0.22, z: 475.0,  rotY: -Math.PI / 2, color: 0x3f6212, type: 'heli_ataque' },
  { x: -1462.0, y: 0.22, z: 475.0,  rotY: -Math.PI / 2, color: 0x3f6212, type: 'heli_ataque' },
  { x: -1380.0, y: 0.22, z: 395.0,  rotY: 0,            color: 0x3f6212, type: 'heli_ataque' },
  { x: -1380.0, y: 0.22, z: 495.0,  rotY: 0,            color: 0x3f6212, type: 'heli_ataque' },
  { x: -1215.0, y: 0.22, z: -55.0,  rotY: Math.PI / 2,  color: 0x111827, type: 'heli_policia' }
];

const DESIGN_HELIPAD_ROOFTOP_PLACEMENTS = [
  // Heliponto no Terraço do Super Banco Central:
  { x: -31.5,  y: 40.25, z: -180.0, rotY: 0, color: 0x111827, type: 'heli_policia' },
  // Heliponto Principal no Topo da Torre dos Heróis + Caça Supersônico no Hangar em Balanço:
  { x: -309.5, y: 310.8,  z: -180.0, rotY: 0, color: 0x111827, type: 'heli_policia' },
  { x: -318.0, y: 228.45, z: -144.0, rotY: 0, color: 0x0284c7, customName: 'CAÇA SUPERSÔNICO DA TORRE DOS HERÓIS', type: 'jato_caca' },
  // Helipontos do Bunker Central do PCC:
  { x: 866.0,  y: 112.8, z: -428.0, rotY: 0, color: 0x090a0d, roofColor: 0x0ea5e9, customName: 'HELICÓPTERO EXECUTIVO BLINDADO (PCC)', type: 'heli_policia' },
  { x: 816.0,  y: 30.55, z: -386.0, rotY: 0, color: 0x090a0d, roofColor: 0x1d4ed8, customName: 'HELICÓPTERO DE ESCOLTA (PCC)', type: 'heli_policia' },
  // Duplo Heliponto Policial no Topo da Cidadela Panóptica Central ("A Balsa") da Ilha da Prisão:
  { x: 1352.0, y: 126.8, z: 1540.0, rotY: Math.PI, color: 0x111827, roofColor: 0x3b82f6, customName: 'HELICÓPTERO ÁGUIA 01 (BOPE / PRISÃO)', type: 'heli_policia' },
  { x: 1398.0, y: 126.8, z: 1540.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0xfacc15, customName: 'HELICÓPTERO CAVEIRA 02 (BOPE / PRISÃO)', type: 'heli_policia' }
];

const DESIGN_CAPITANIA_AND_HELICARRIER_PLACEMENTS = [
  // Heliponto no Topo da Torre da Capitania dos Portos & Controle Naval:
  { x: 1105.0, y: 92.8,  z: 235.0,  rotY: 0,       color: 0xf8fafc, roofColor: 0x0284c7, customName: 'HELICÓPTERO DA CAPITANIA DOS PORTOS', type: 'heli_policia' },
  // Convés do Aeroporta-Aviões no Céu (Y = 410.45): 3 Caças Supersônicos + 1 Helicóptero de Ataque!
  { x: 22.0,   y: 410.45, z: -132.0, rotY: 0.35,   color: 0x334155, type: 'jato_caca' },
  { x: 22.0,   y: 410.45, z: -18.0,  rotY: -0.25,  color: 0x334155, type: 'jato_caca' },
  { x: -48.0,  y: 410.45, z: -40.0,  rotY: 0,      color: 0x334155, type: 'jato_caca' },
  { x: 22.0,   y: 410.45, z: 32.0,   rotY: Math.PI, color: 0x3f6212, type: 'heli_ataque' }
];

/**
 * Resolve o posicionamento de aeronaves e helicópteros em `IS_SCALED_WORLD` respeitando rígida ancoragem 1x
 * nos helipontos de topos de prédios e no Aeroporta-Aviões, sem alterar 1x quando `!IS_SCALED_WORLD`.
 */
export function resolveAircraftPlacements(world = null) {
  if (!IS_SCALED_WORLD) {
    return {
      airport: DESIGN_AIRPORT_AIRCRAFT_PLACEMENTS,
      rooftops: DESIGN_HELIPAD_ROOFTOP_PLACEMENTS,
      capitaniaAndCarrier: DESIGN_CAPITANIA_AND_HELICARRIER_PLACEMENTS
    };
  }

  const termX = world?.westAirportData?.terminalCenter?.x ?? ws(-1145);
  const airport = [
    { ...DESIGN_AIRPORT_AIRCRAFT_PLACEMENTS[0], x: termX - 80.0, z: -420.0 },
    { ...DESIGN_AIRPORT_AIRCRAFT_PLACEMENTS[1], x: termX - 80.0, z: -120.0 },
    ...DESIGN_AIRPORT_AIRCRAFT_PLACEMENTS.slice(2).map((a) => ({ ...a, x: ws(a.x), z: ws(a.z) }))
  ];

  const bankZShift = world?.superBankData?.zShift ?? ws(-175) - -175;
  const bankRoofY = world?.superBankData?.roofTopY ?? 40.96;
  const hxShift = world?.heroTowerData?.shiftX ?? ws(-324) - -324;
  const hzShift = world?.heroTowerData?.shiftZ ?? ws(-168) - -168;
  const pccOrig = world?.industrialPCCData?.citadelOrigin || { x: ws(866), z: ws(-316) };
  const liftAt = (px, pz) => {
    const raw = world?.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(px, pz)) : 0;
    return raw > 0.04 ? raw : 0;
  };
  const pccMainLift = liftAt(pccOrig.x, pccOrig.z - 47);
  const pccAuxLift = liftAt(pccOrig.x - 50, pccOrig.z - 5);
  const prisonOx = ws(1375) - 1375;
  const prisonOz = ws(1540) - 1540;
  const R = DESIGN_HELIPAD_ROOFTOP_PLACEMENTS;

  const rooftops = [
    {
      ...R[0],
      x: -40.0,
      y: bankRoofY + 0.66,
      z: -195.0 + bankZShift,
      _ensureHelipadCollider: { w: 24.0, d: 24.0, minY: bankRoofY, maxY: bankRoofY + 0.64 }
    },
    { ...R[1], x: -318.0 + hxShift, y: 310.8, z: -180.0 + hzShift },
    { ...R[2], x: -318.0 + hxShift, y: 228.45, z: -144.0 + hzShift },
    { ...R[3], x: pccOrig.x, y: 112.8 + pccMainLift, z: pccOrig.z - 47.0 },
    { ...R[4], x: pccOrig.x - 50.0, y: 30.55 + pccAuxLift, z: pccOrig.z - 5.0 },
    { ...R[5], x: 1352.0 + prisonOx, y: 126.8, z: 1540.0 + prisonOz },
    { ...R[6], x: 1398.0 + prisonOx, y: 126.8, z: 1540.0 + prisonOz }
  ];

  const carrierZShift = (world?.helicarrierData?.hz ?? ws(-50)) - -50;
  const C = DESIGN_CAPITANIA_AND_HELICARRIER_PLACEMENTS;
  const capitaniaAndCarrier = [
    { ...C[0], x: ws(1105.0), y: 92.8, z: ws(235.0) },
    ...C.slice(1).map((a) => ({ ...a, z: a.z + carrierZShift }))
  ];

  return { airport, rooftops, capitaniaAndCarrier };
}

/**
 * Posiciona todas as embarcações e aeronaves pelo mapa preservando a ordem exata de cena/colisores.
 */
export function buildBoatsAndAircraftFleet(world) {
  const naval = IS_SCALED_WORLD
    ? resolveNavalBoatPlacements(world)
    : { lakeAndMarina: LAKE_AND_MARINA_BOAT_PLACEMENTS, coastGuard: COAST_GUARD_BOAT_PLACEMENTS };
  const air = resolveAircraftPlacements(world);

  const fleet = [
    ...naval.lakeAndMarina,
    ...air.airport,
    ...air.rooftops,
    ...naval.coastGuard,
    ...air.capitaniaAndCarrier
  ];

  fleet.forEach((cfg) => {
    const spec = VEHICLE_SPECS[cfg.type];
    if (!spec) return;

    if (IS_SCALED_WORLD && cfg._ensureHelipadCollider && Array.isArray(world.colliders)) {
      const pad = cfg._ensureHelipadCollider;
      const hasPad = world.colliders.some(
        (c) =>
          !c.disabled &&
          cfg.x >= c.minX &&
          cfg.x <= c.maxX &&
          cfg.z >= c.minZ &&
          cfg.z <= c.maxZ &&
          Math.abs(c.maxY - (cfg.y ?? 0)) <= 2.0
      );
      if (!hasPad) {
        world.addCollider(cfg.x, cfg.z, pad.w, pad.d, pad.maxY, pad.minY);
      }
    }

    const mesh = createNavalOrAircraftMesh(cfg);
    optimizeStaticGroupMeshes(mesh, [
      mesh.userData.mainRotorGroup,
      mesh.userData.tailRotorGroup,
      mesh.userData.propellerGroup,
      ...(mesh.userData.turboFlames || [])
    ]);
    mesh.position.set(cfg.x, cfg.y ?? 0, cfg.z);
    mesh.rotation.y = cfg.rotY || 0;
    mesh.userData.carType = cfg.type;
    mesh.userData.carName = cfg.customName || spec.name;
    mesh.userData.vehicleSpec = spec;
    mesh.userData.isHelicarrierParked = (cfg.y ?? 0) >= 400;
    world.scene.add(mesh);

    if (mesh.userData.mainRotorGroup) {
      world.rotatingElements.push({ mesh: mesh.userData.mainRotorGroup, axis: 'y', speed: 8.5 });
    }
    if (mesh.userData.tailRotorGroup) {
      world.rotatingElements.push({ mesh: mesh.userData.tailRotorGroup, axis: 'x', speed: 14.0 });
    }

    const isRotated90 = Math.abs(Math.sin(cfg.rotY || 0)) > 0.7;
    const baseW =
      cfg.type === 'aviao_comercial' ? 8.5 :
      cfg.type === 'jato_caca' || cfg.type === 'jato_vip' ? 6.5 :
      cfg.type === 'heli_ataque' || cfg.type === 'heli_policia' ? 4.2 :
      cfg.type === 'lancha_rapida' || cfg.type === 'lancha_bope' ? 3.5 : 2.2;
    const baseD =
      cfg.type === 'aviao_comercial' ? 26.0 :
      cfg.type === 'jato_caca' || cfg.type === 'jato_vip' ? 14.5 :
      cfg.type === 'heli_ataque' || cfg.type === 'heli_policia' ? 10.5 :
      cfg.type === 'lancha_rapida' || cfg.type === 'lancha_bope' ? 8.2 : 3.8;
    const w = isRotated90 ? baseD : baseW;
    const d = isRotated90 ? baseW : baseD;
    const h = cfg.type === 'aviao_comercial' ? 6.5 : spec.category === 'boat' ? 1.8 : 3.6;
    const yBase = cfg.y ?? 0;

    const col1 = world.addCollider(cfg.x, cfg.z, w, d, yBase + h, yBase);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh,
        type: 'car',
        hp: spec.hp,
        radius: Math.max(w, d) * 0.48,
        height: h,
        colliders: [col1],
        debrisColors: [cfg.color || 0x38bdf8, LEGO_COLORS.white, LEGO_COLORS.black, LEGO_COLORS.yellow],
        studDrops: spec.studDrops,
        groundY: yBase
      });
    }
  });
}
