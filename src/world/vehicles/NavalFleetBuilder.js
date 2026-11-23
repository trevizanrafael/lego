/**
 * NavalFleetBuilder.js
 * Especificações e construção 3D das embarcações do Lago Central, Praia Sul, Canais,
 * Rio Urbano Leste, Marina Oeste e Doca da Guarda Costeira / Polícia Marítima (BOPE).
 */

import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { KMH_TO_UNITS } from './VehicleSpecsCatalog.js';
import { IS_SCALED_WORLD, ws } from '../core/WorldLayoutScale.js';
import {
  attachExhaustFlames,
  createNavalAirMaterialContext
} from './VehicleChassisPrimitives.js';

export const NAVAL_BOAT_TYPES = new Set([
  'pedalinho_cisne',
  'barquinho_lago',
  'jet_ski',
  'lancha_rapida',
  'lancha_bope'
]);

/**
 * Especificações das embarcações leves e táticas (Grupo 5).
 */
export const NAVAL_SPECS = {
  pedalinho_cisne: {
    id: 'pedalinho_cisne',
    category: 'boat',
    group: 'EMBARCAÇÕES (LAGO & MAR)',
    name: 'PEDALINHO CISNE (LAGO DO PARQUE)',
    kmh: 48,
    turboKmh: 72,
    maxForward: 48 * KMH_TO_UNITS,
    turboSpeed: 72 * KMH_TO_UNITS,
    maxReverse: -25 * KMH_TO_UNITS,
    accel: 24.0,
    turnRate: 2.6,
    driftTurnRate: 3.4,
    hp: 160,
    openTop: true,
    weapon: null,
    enterRadius: 7.0,
    waterSurfaceY: 0.42,
    seatedYOffset: 0.55,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 5, blue: 2, purple: 0 }
  },
  barquinho_lago: {
    id: 'barquinho_lago',
    category: 'boat',
    group: 'EMBARCAÇÕES (LAGO & MAR)',
    name: 'BARCO DE PASSEIO (LAGO DO PARQUE)',
    kmh: 65,
    turboKmh: 95,
    maxForward: 65 * KMH_TO_UNITS,
    turboSpeed: 95 * KMH_TO_UNITS,
    maxReverse: -30 * KMH_TO_UNITS,
    accel: 28.0,
    turnRate: 2.5,
    driftTurnRate: 3.3,
    hp: 190,
    openTop: true,
    weapon: null,
    enterRadius: 7.0,
    waterSurfaceY: 0.42,
    seatedYOffset: 0.48,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 5, blue: 2, purple: 0 }
  },
  jet_ski: {
    id: 'jet_ski',
    category: 'boat',
    group: 'EMBARCAÇÕES (LAGO & MAR)',
    name: 'JET-SKI TURBO WAVE',
    kmh: 185,
    turboKmh: 225,
    maxForward: 185 * KMH_TO_UNITS,
    turboSpeed: 225 * KMH_TO_UNITS,
    maxReverse: -48 * KMH_TO_UNITS,
    accel: 54.0,
    turnRate: 3.25,
    driftTurnRate: 4.5,
    hp: 160,
    openTop: true,
    canWheelie: true, // Empina o bico nas ondas no Espaço!
    weapon: null,
    enterRadius: 7.2,
    waterSurfaceY: -0.15,
    seatedYOffset: 0.62,
    rammingPower: 'normal',
    studDrops: { silver: 5, gold: 6, blue: 3, purple: 0 }
  },
  lancha_rapida: {
    id: 'lancha_rapida',
    category: 'boat',
    group: 'EMBARCAÇÕES (LAGO & MAR)',
    name: 'LANCHA ESPORTIVA OFFSHORE V8',
    kmh: 220,
    turboKmh: 265,
    maxForward: 220 * KMH_TO_UNITS,
    turboSpeed: 265 * KMH_TO_UNITS,
    maxReverse: -60 * KMH_TO_UNITS,
    accel: 48.0,
    turnRate: 2.45,
    driftTurnRate: 3.7,
    hp: 380,
    openTop: true,
    weapon: null,
    enterRadius: 8.2,
    waterSurfaceY: -0.15,
    seatedYOffset: 0.68,
    rammingPower: 'normal',
    studDrops: { silver: 6, gold: 8, blue: 4, purple: 1 }
  },
  lancha_bope: {
    id: 'lancha_bope',
    category: 'boat',
    group: 'EMBARCAÇÕES (LAGO & MAR)',
    name: 'LANCHA TÁTICA BLINDADA (BOPE)',
    kmh: 195,
    turboKmh: 240,
    maxForward: 195 * KMH_TO_UNITS,
    turboSpeed: 240 * KMH_TO_UNITS,
    maxReverse: -55 * KMH_TO_UNITS,
    accel: 44.0,
    turnRate: 2.4,
    driftTurnRate: 3.5,
    hp: 720,
    openTop: true,
    weapon: 'machinegun', // Metralhadora Giratória Naval na proa (Clique Esquerdo)!
    enterRadius: 8.2,
    waterSurfaceY: -0.15,
    seatedYOffset: 0.72,
    rammingPower: 'unstoppable',
    studDrops: { silver: 6, gold: 9, blue: 5, purple: 1 }
  }
};

/**
 * Especificações dos veículos portuários pesados e navios colossais.
 */
export const COLOSSAL_AND_PORT_SPECS = {
  caminhao_carreta: {
    id: 'caminhao_carreta',
    category: 'car',
    isHeavyTruck: true,
    group: 'CIVIS & PESADOS',
    name: 'CAMINHÃO-CARRETA PORTUÁRIO',
    kmh: 135,
    turboKmh: 175,
    maxForward: 135 * KMH_TO_UNITS,
    turboSpeed: 175 * KMH_TO_UNITS,
    maxReverse: -48 * KMH_TO_UNITS,
    accel: 34.0,
    turnRate: 1.95,
    driftTurnRate: 2.8,
    hp: 1400,
    openTop: false,
    weapon: null,
    enterRadius: 14.0,
    seatedYOffset: 2.35,
    cameraDistScale: 2.35,
    rammingPower: 'unstoppable',
    studDrops: { silver: 8, gold: 12, blue: 6, purple: 2 }
  },
  navio_cargueiro: {
    id: 'navio_cargueiro',
    category: 'boat',
    isColossalShip: true,
    group: 'EMBARCAÇÕES (LAGO & MAR)',
    name: 'NAVIO CARGUEIRO PORTA-CONTÊINERES',
    kmh: 110,
    turboKmh: 155,
    maxForward: 110 * KMH_TO_UNITS,
    turboSpeed: 155 * KMH_TO_UNITS,
    maxReverse: -45 * KMH_TO_UNITS,
    accel: 26.0,
    turnRate: 0.95,
    driftTurnRate: 1.35,
    hp: 15000,
    openTop: false,
    weapon: null,
    enterRadius: 135.0,
    waterSurfaceY: 0.0,
    seatedYOffset: 24.5,
    cameraDistScale: 12.5,
    rammingPower: 'unstoppable',
    studDrops: { silver: 12, gold: 24, blue: 16, purple: 6 }
  },
  navio_ares: {
    id: 'navio_ares',
    category: 'boat',
    isColossalShip: true,
    group: 'EMBARCAÇÕES (LAGO & MAR)',
    name: 'COURAÇADO CARGUEIRO A.R.E.S.',
    kmh: 125,
    turboKmh: 175,
    maxForward: 125 * KMH_TO_UNITS,
    turboSpeed: 175 * KMH_TO_UNITS,
    maxReverse: -50 * KMH_TO_UNITS,
    accel: 30.0,
    turnRate: 1.05,
    driftTurnRate: 1.45,
    hp: 18000,
    openTop: false,
    weapon: 'plasma_laser',
    enterRadius: 135.0,
    waterSurfaceY: 0.0,
    seatedYOffset: 24.5,
    cameraDistScale: 12.5,
    rammingPower: 'unstoppable',
    studDrops: { silver: 12, gold: 28, blue: 20, purple: 8 }
  }
};

/**
 * Constrói a malha 3D LEGO detalhada de qualquer embarcação (Pedalinho Cisne, Barco, Jet-Ski ou Lanchas).
 */
export function buildNavalBoatMesh(cfg, existingCtx = null) {
  const ctx = existingCtx || createNavalAirMaterialContext(cfg);
  const {
    type,
    bodyColor,
    group,
    whiteMat,
    blackMat,
    darkMat,
    silverMat,
    goldMat,
    orangeMat,
    redMat,
    glassMat
  } = ctx;

  // 1. PEDALINHO CISNE (LAGO DO PARQUE CENTRAL)
  if (type === 'pedalinho_cisne') {
    for (const px of [-1.15, 1.15]) {
      const pontoon = createLegoBrick(0.75, 0.45, 4.2, LEGO_COLORS.white, { studs: false });
      pontoon.position.set(px, 0.22, 0);
      group.add(pontoon);
    }
    const deck = createLegoBrick(2.8, 0.36, 3.8, bodyColor, { studs: false });
    deck.position.set(0, 0.48, -0.1);
    group.add(deck);

    const seatBack = createLegoBrick(2.2, 0.65, 0.35, LEGO_COLORS.white, { studs: false });
    seatBack.position.set(0, 0.92, -0.65);
    const seatBase = createLegoBrick(2.2, 0.25, 0.85, LEGO_COLORS.white, { studs: false });
    seatBase.position.set(0, 0.72, -0.35);
    group.add(seatBack, seatBase);

    const neck1 = createLegoBrick(0.72, 1.35, 0.72, LEGO_COLORS.white, { studs: false });
    neck1.position.set(0, 1.25, 1.45);
    neck1.rotation.x = 0.22;
    const neck2 = createLegoBrick(0.62, 1.15, 0.62, LEGO_COLORS.white, { studs: false });
    neck2.position.set(0, 2.25, 1.68);
    neck2.rotation.x = -0.15;
    const head = createLegoBrick(0.76, 0.68, 0.95, LEGO_COLORS.white, { studs: false });
    head.position.set(0, 2.85, 1.75);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.75), orangeMat);
    beak.position.set(0, 2.78, 2.45);
    const crown = createLegoBrick(0.48, 0.28, 0.48, LEGO_COLORS.gold, { studs: false });
    crown.position.set(0, 3.32, 1.72);

    for (const wx of [-1.35, 1.35]) {
      const wing = createLegoBrick(0.32, 0.85, 2.4, LEGO_COLORS.white, { studs: false });
      wing.position.set(wx, 0.95, -0.2);
      group.add(wing);
    }
    group.add(neck1, neck2, head, beak, crown);

    const propGroup = new THREE.Group();
    propGroup.position.set(0, 0.32, -2.05);
    const paddle1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.14), orangeMat);
    const paddle2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.75), orangeMat);
    propGroup.add(paddle1, paddle2);
    group.add(propGroup);
    group.userData.propellerGroup = propGroup;
    group.userData.propellerAxis = 'x';
    return group;
  }

  // 2. BARCO DE PASSEIO A MOTOR (LAGO DO PARQUE CENTRAL)
  if (type === 'barquinho_lago') {
    const hull = createLegoBrick(2.4, 0.55, 4.6, bodyColor, { studs: false });
    hull.position.set(0, 0.35, 0);
    const bow = createLegoBrick(1.7, 0.52, 1.2, LEGO_COLORS.white, { studs: false });
    bow.position.set(0, 0.38, 2.45);
    const bench1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.65), getLegoMaterial(0x78350f));
    bench1.position.set(0, 0.68, -0.4);
    const bench2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.65), getLegoMaterial(0x78350f));
    bench2.position.set(0, 0.68, 0.9);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12), blackMat);
    wheel.rotation.x = Math.PI / 3;
    wheel.position.set(0, 0.95, 0.35);

    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.65), darkMat);
    motor.position.set(0, 0.55, -2.45);
    const propGroup = new THREE.Group();
    propGroup.position.set(0, 0.22, -2.82);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.08), silverMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.08), silverMat);
    propGroup.add(blade1, blade2);

    group.add(hull, bow, bench1, bench2, wheel, motor, propGroup);
    group.userData.propellerGroup = propGroup;
    group.userData.propellerAxis = 'z';
    return group;
  }

  // 3. JET-SKI TURBO WAVE
  if (type === 'jet_ski') {
    const lowerHull = createLegoBrick(1.45, 0.42, 3.6, LEGO_COLORS.white, { studs: false });
    lowerHull.position.set(0, 0.24, 0);
    const upperDeck = createLegoBrick(1.2, 0.45, 2.6, bodyColor, { studs: false });
    upperDeck.position.set(0, 0.62, 0.15);
    const nose = createLegoBrick(0.9, 0.35, 1.1, bodyColor, { studs: false });
    nose.position.set(0, 0.48, 1.65);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.36, 1.35), blackMat);
    seat.position.set(0, 0.86, -0.25);

    const steerCol = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.58, 0.32), darkMat);
    steerCol.rotation.x = -0.35;
    steerCol.position.set(0, 1.05, 0.72);
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.25, 8), silverMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.28, 0.62);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.32, 0.14), glassMat);
    visor.rotation.x = -0.5;
    visor.position.set(0, 1.12, 1.02);

    group.add(lowerHull, upperDeck, nose, seat, steerCol, handlebar, visor);
    attachExhaustFlames(group, [[0, 0.35, -1.85]], 0.75);
    return group;
  }

  // 4. LANCHA ESPORTIVA OFFSHORE V8 & LANCHA TÁTICA BLINDADA (BOPE / GUARDA COSTEIRA)
  const isBope = type === 'lancha_bope';
  const hullBaseColor = isBope ? 0x111827 : LEGO_COLORS.white;
  const stripeColor = isBope ? LEGO_COLORS.gold : bodyColor;

  const mainHull = createLegoBrick(3.4, 0.88, 7.6, hullBaseColor, { studs: false });
  mainHull.position.set(0, 0.48, -0.3);
  const stripe = createLegoBrick(3.52, 0.32, 7.7, stripeColor, { studs: false });
  stripe.position.set(0, 0.72, -0.25);
  const bow1 = createLegoBrick(2.5, 0.82, 2.2, hullBaseColor, { studs: false });
  bow1.position.set(0, 0.54, 4.1);
  const bow2 = createLegoBrick(1.5, 0.75, 1.6, stripeColor, { studs: false });
  bow2.position.set(0, 0.58, 5.4);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.72, 1.3), glassMat);
  windshield.rotation.x = -0.38;
  windshield.position.set(0, 1.22, 1.35);

  const seatMat = isBope ? blackMat : whiteMat;
  const frontSeats = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.65, 0.9), seatMat);
  frontSeats.position.set(0, 1.02, -0.15);
  const rearLounge = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.68, 1.4), seatMat);
  rearLounge.position.set(0, 1.05, -2.2);
  const helmWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), silverMat);
  helmWheel.rotation.x = Math.PI / 3;
  helmWheel.position.set(-0.55, 1.25, 0.65);

  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.28, -4.65);
  for (const mx of [-0.85, 0.85]) {
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.15, 0.95), darkMat);
    motor.position.set(mx, 0.82, -4.35);
    group.add(motor);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.12), silverMat);
    blade.position.x = mx;
    propGroup.add(blade);
  }
  group.userData.propellerGroup = propGroup;
  group.userData.propellerAxis = 'z';

  group.add(mainHull, stripe, bow1, bow2, windshield, frontSeats, rearLounge, helmWheel, propGroup);

  if (isBope) {
    const archL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.45), darkMat);
    archL.position.set(-1.55, 1.65, -1.2);
    const archR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.45), darkMat);
    archR.position.set(1.55, 1.65, -1.2);
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.25, 0.55), darkMat);
    archTop.position.set(0, 2.45, -1.2);
    const beaconR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 0.35), redMat);
    beaconR.position.set(-0.6, 2.65, -1.2);
    const beaconB = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.24, 0.35),
      getLegoMaterial(LEGO_COLORS.blue, { emissive: 0x2563eb, emissiveIntensity: 0.85 })
    );
    beaconB.position.set(0.6, 2.65, -1.2);
    group.add(archL, archR, archTop, beaconR, beaconB);

    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.15, 3.8);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.7, 8), blackMat);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.14), goldMat);
    shield.position.set(0, 0.35, 0.35);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 8), silverMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.3, 0.85);
    turretGroup.add(ped, shield, barrel);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;
  }

  attachExhaustFlames(group, [[-0.85, 0.55, -4.85], [0.85, 0.55, -4.85]], 0.95);
  return group;
}

/**
 * Posicionamentos navais de projeto (`1x`) do Grande Lago, Marina Sul, Canais de Santos,
 * Rio Urbano Leste e Marina Oeste.
 */
const DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS = [
  // 1. GRANDE LAGO DO PARQUE CENTRAL (8 EMBARCAÇÕES VIVAS: PEDALINHOS CISNE & BARCOS!)
  { x: 109.0, y: 0.42, z: 258.0, rotY: Math.PI / 2, color: 0xec4899, type: 'pedalinho_cisne' },
  { x: 111.0, y: 0.42, z: 268.0, rotY: Math.PI / 2, color: 0x06b6d4, type: 'barquinho_lago' },
  { x: 109.0, y: 0.42, z: 278.0, rotY: Math.PI / 2, color: 0xfacc15, type: 'pedalinho_cisne' },
  { x: 148.0, y: 0.42, z: 224.0, rotY: 0.4,         color: 0x3b82f6, type: 'barquinho_lago' },
  { x: 158.0, y: 0.42, z: 312.0, rotY: 2.2,         color: 0xf97316, type: 'pedalinho_cisne' },
  { x: 252.0, y: 0.42, z: 226.0, rotY: -0.6,        color: 0xec4899, type: 'pedalinho_cisne' },
  { x: 264.0, y: 0.42, z: 308.0, rotY: -2.4,        color: 0x22c55e, type: 'barquinho_lago' },
  { x: 298.0, y: 0.42, z: 268.0, rotY: -Math.PI / 2, color: 0xef4444, type: 'pedalinho_cisne' },

  // 2. MARINA DO PÍER SUL, PRAIA, 3 CANAIS DE SANTOS E CANAL LESTE (JET-SKIS & LANCHAS!)
  { x: 122.0, y: -0.15, z: 1102.5, rotY: Math.PI / 2, color: 0xef4444, type: 'lancha_rapida' },
  { x: 140.0, y: -0.15, z: 1102.5, rotY: Math.PI / 2, color: 0x111827, type: 'lancha_bope' },
  { x: 122.0, y: -0.15, z: 1142.5, rotY: Math.PI / 2, color: 0x2563eb, type: 'lancha_rapida' },
  { x: 140.0, y: -0.15, z: 1142.5, rotY: Math.PI / 2, color: 0xfacc15, type: 'lancha_rapida' },
  { x: 122.0, y: -0.15, z: 1182.5, rotY: Math.PI / 2, color: 0x06b6d4, type: 'lancha_rapida' },
  { x: 140.0, y: -0.15, z: 1182.5, rotY: Math.PI / 2, color: 0xf97316, type: 'lancha_rapida' },
  { x: 122.0, y: -0.15, z: 1222.5, rotY: Math.PI / 2, color: 0xec4899, type: 'lancha_rapida' },
  { x: 140.0, y: -0.15, z: 1222.5, rotY: Math.PI / 2, color: 0x111827, type: 'lancha_bope' },

  // Deck Oeste da Marina (X = 86..92, Z = 1095..1215): 8 Jet-Skis Turbo Wave!
  { x: 91.0, y: -0.15, z: 1100.5, rotY: 0, color: 0x06b6d4, type: 'jet_ski' },
  { x: 81.0, y: -0.15, z: 1100.5, rotY: 0, color: 0xec4899, type: 'jet_ski' },
  { x: 91.0, y: -0.15, z: 1140.5, rotY: 0, color: 0xfacc15, type: 'jet_ski' },
  { x: 81.0, y: -0.15, z: 1140.5, rotY: 0, color: 0xef4444, type: 'jet_ski' },
  { x: 91.0, y: -0.15, z: 1180.5, rotY: 0, color: 0x22c55e, type: 'jet_ski' },
  { x: 81.0, y: -0.15, z: 1180.5, rotY: 0, color: 0xf97316, type: 'jet_ski' },
  { x: 91.0, y: -0.15, z: 1220.5, rotY: 0, color: 0x3b82f6, type: 'jet_ski' },
  { x: 81.0, y: -0.15, z: 1220.5, rotY: 0, color: 0xa855f7, type: 'jet_ski' },

  // Nos 3 Canais de Santos (X = -384, -120, +252) e na Beira da Praia Sul (Z = 1054):
  { x: -384.0, y: -0.15, z: 895.0, rotY: 0, color: 0x06b6d4, type: 'jet_ski' },
  { x: -120.0, y: -0.15, z: 895.0, rotY: 0, color: 0xfacc15, type: 'jet_ski' },
  { x: 252.0,  y: -0.15, z: 895.0, rotY: 0, color: 0xec4899, type: 'jet_ski' },
  { x: -220.0, y: -0.15, z: 1054.0, rotY: 0, color: 0xef4444, type: 'lancha_rapida' },
  { x: -65.0,  y: -0.15, z: 1054.0, rotY: 0, color: 0x111827, type: 'lancha_bope' },
  { x: 190.0,  y: -0.15, z: 1054.0, rotY: 0, color: 0x2563eb, type: 'lancha_rapida' },

  // No Rio / Canal Urbano Leste (Cota da Água Y = -3.50 — Atracados nos 3 Píeres Fluviais de Madeira):
  { x: 550.2, y: -3.5, z: 259.0, rotY: 0,       color: 0x111827, customName: 'LANCHA TÁTICA FLUVIAL (BOPE)', type: 'lancha_bope' },
  { x: 550.2, y: -3.5, z: 276.0, rotY: 0,       color: 0x06b6d4, customName: 'JET-SKI TURBO PARQUE CENTRAL', type: 'jet_ski' },
  { x: 569.8, y: -3.5, z: -193.0, rotY: Math.PI, color: 0x1e3a8a, customName: 'LANCHA BLINDADA DE FUGA (PCC)', type: 'lancha_rapida' },
  { x: 569.8, y: -3.5, z: -177.0, rotY: Math.PI, color: 0x0ea5e9, customName: 'JET-SKI DE INTERCEPTAÇÃO (PCC)', type: 'jet_ski' },
  { x: 550.2, y: -3.5, z: 834.0, rotY: 0,       color: 0xef4444, customName: 'LANCHA OFFSHORE FOZ DA PRAIA', type: 'lancha_rapida' },
  { x: 550.2, y: -3.5, z: 846.0, rotY: 0,       color: 0xfacc15, customName: 'JET-SKI WAVE RUNNER FOZ SUL 01', type: 'jet_ski' },
  { x: 550.2, y: -3.5, z: 856.0, rotY: 0,       color: 0x06b6d4, customName: 'JET-SKI WAVE RUNNER FOZ SUL 02', type: 'jet_ski' },
  { x: 549.5, y: -3.5, z: -45.0, rotY: 0,       color: 0x111827, type: 'lancha_bope' },
  { x: 549.5, y: -3.5, z: 45.0,  rotY: 0,       color: 0x06b6d4, type: 'jet_ski' },

  // Na Marina Oeste (Ponta da Praia / Costão Sudoeste — X = -1352, Z = 1095..1215):
  { x: -1352.0, y: -0.15, z: 1106.0, rotY: Math.PI / 2, color: 0xef4444, type: 'lancha_rapida' },
  { x: -1352.0, y: -0.15, z: 1146.0, rotY: Math.PI / 2, color: 0x06b6d4, type: 'lancha_rapida' },
  { x: -1352.0, y: -0.15, z: 1186.0, rotY: Math.PI / 2, color: 0xfacc15, type: 'jet_ski' },
  { x: -1352.0, y: -0.15, z: 1226.0, rotY: Math.PI / 2, color: 0xec4899, type: 'jet_ski' }
];

/**
 * Doca Naval da Guarda Costeira de projeto (`1x`, fora da muralha oeste da Ilha da Prisão).
 */
const DESIGN_COAST_GUARD_BOAT_PLACEMENTS = [
  { x: 850.0, y: -0.35, z: 1528.0, rotY: 0, color: 0x111827, roofColor: 0x3b82f6, customName: 'LANCHA BLINDADA DA POLÍCIA MARÍTIMA 01', type: 'lancha_bope' },
  { x: 850.0, y: -0.35, z: 1572.0, rotY: 0, color: 0x090a0d, roofColor: 0xfacc15, customName: 'LANCHA BLINDADA DA GUARDA COSTEIRA 02', type: 'lancha_bope' }
];

/**
 * Resolve as coordenadas da frota naval alinhando-a aos corpos d'água e píeres `3x` quando `IS_SCALED_WORLD` está ativo,
 * mantendo paridade bit-a-bit em `1x` e preservando 100% da contagem e tamanhos das embarcações.
 */
export function resolveNavalBoatPlacements(world = null) {
  if (!IS_SCALED_WORLD) {
    return {
      lakeAndMarina: DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS,
      coastGuard: DESIGN_COAST_GUARD_BOAT_PLACEMENTS
    };
  }

  const pierOffZ = Number.isFinite(world?.pierOffsetZ) ? world.pierOffsetZ : ws(1036) - 1030;
  const westMarina = world?.southwestBeachData?.westMarinaPos || null;
  const westMarinaBoatX = (westMarina?.x ?? ws(-1380)) + 28.0;
  const westDockZList =
    Array.isArray(westMarina?.dockZList) && westMarina.dockZList.length >= 4
      ? westMarina.dockZList
      : [1095, 1135, 1175, 1215].map((dz) => dz + pierOffZ);

  const prisonDockOffX = ws(928) - 928;
  const prisonDockOffZ = ws(1550) - 1550;

  const lakePierTipX = ws(106); // 318 em 3x -> posiciona barcos a leste de x = 324!
  const lakeCenterZ = ws(268);

  const lakeAndMarina = [
    // 1. Grande Lago do Parque Central (X ∈ [210..1020], Z ∈ [561..1047], leste da ponta do píer x = 318)
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[0], x: lakePierTipX + 7.0, z: lakeCenterZ - 10.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[1], x: lakePierTipX + 9.0, z: lakeCenterZ },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[2], x: lakePierTipX + 7.0, z: lakeCenterZ + 10.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[3], x: ws(148.0), z: ws(224.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[4], x: ws(158.0), z: ws(312.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[5], x: ws(236.0), z: ws(226.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[6], x: ws(276.0), z: ws(308.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[7], x: ws(298.0), z: lakeCenterZ },

    // 2. Marina Leste do Mega Píer Sul (x relativo 1x preservado, z deslocado por pierOffsetZ)
    ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS.slice(8, 24).map((b) => ({
      ...b,
      z: b.z + pierOffZ
    })),

    // 3. Os 3 Canais de Santos & Offshore da Praia Sul
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[24], x: ws(-384.0), z: ws(895.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[25], x: ws(-120.0), z: ws(895.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[26], x: ws(252.0),  z: ws(895.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[27], x: ws(-220.0), z: ws(1066.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[28], x: ws(-65.0),  z: ws(1066.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[29], x: ws(190.0),  z: ws(1066.0) },

    // 4. Rio / Canal Urbano Leste (Y = -3.5, alinhados aos 3 píeres de RIVER_PIER_SPECS)
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[30], x: ws(540) + 10.2, z: ws(268) - 9.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[31], x: ws(540) + 10.2, z: ws(268) + 8.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[32], x: ws(580) - 10.2, z: ws(-185) - 8.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[33], x: ws(580) - 10.2, z: ws(-185) + 8.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[34], x: ws(540) + 10.2, z: ws(845) - 11.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[35], x: ws(540) + 10.2, z: ws(845) + 1.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[36], x: ws(540) + 10.2, z: ws(845) + 11.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[37], x: ws(560) - 10.5, z: ws(-45.0) },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[38], x: ws(560) - 10.5, z: ws(45.0) },

    // 5. Marina Oeste (Costão Sudoeste — alinhada a southwestBeachData.westMarinaPos)
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[39], x: westMarinaBoatX, z: westDockZList[0] + 11.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[40], x: westMarinaBoatX, z: westDockZList[1] + 11.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[41], x: westMarinaBoatX, z: westDockZList[2] + 11.0 },
    { ...DESIGN_LAKE_AND_MARINA_BOAT_PLACEMENTS[42], x: westMarinaBoatX, z: westDockZList[3] + 11.0 }
  ];

  const coastGuard = DESIGN_COAST_GUARD_BOAT_PLACEMENTS.map((b) => ({
    ...b,
    x: b.x + prisonDockOffX,
    z: b.z + prisonDockOffZ
  }));

  if (world?.isDeepWaterAt) {
    const ensureOceanWater = (cfg, stepX, stepZ) => {
      if ((cfg.y ?? 0) > 0.1) return cfg; // Lago Central
      if (world.isDeepWaterAt(cfg.x, cfg.z, { forBoat: true })) return cfg;
      for (let i = 1; i <= 12; i++) {
        const nx = cfg.x + stepX * i;
        const nz = cfg.z + stepZ * i;
        if (world.isDeepWaterAt(nx, nz, { forBoat: true })) {
          return { ...cfg, x: nx, z: nz };
        }
      }
      return cfg;
    };
    for (let i = 0; i < lakeAndMarina.length; i++) {
      lakeAndMarina[i] = ensureOceanWater(lakeAndMarina[i], 0, 8);
    }
    for (let i = 0; i < coastGuard.length; i++) {
      coastGuard[i] = ensureOceanWater(coastGuard[i], -8, 0);
    }
  }

  return { lakeAndMarina, coastGuard };
}

const _INITIAL_NAVAL_PLACEMENTS = resolveNavalBoatPlacements(null);
export const LAKE_AND_MARINA_BOAT_PLACEMENTS = _INITIAL_NAVAL_PLACEMENTS.lakeAndMarina;
export const COAST_GUARD_BOAT_PLACEMENTS = _INITIAL_NAVAL_PLACEMENTS.coastGuard;
