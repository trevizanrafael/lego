import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';
import { KMH_TO_UNITS, VEHICLE_SPECS } from './VehicleFleetBuilder.js';
import { optimizeStaticGroupMeshes, mergeBufferGeometries } from './BuildingGenerator.js';

/**
 * CATÁLOGO OFICIAL DE EMBARCAÇÕES E AERONAVES LEGO 3D:
 * - GRUPO 5: EMBARCAÇÕES DO LAGO & MAR (Pedalinho Cisne, Barco do Lago, Jet-Ski, Lancha Rápida e Lancha Tática BOPE)
 * - GRUPO 6: HELICÓPTEROS & AVIÕES (Helicóptero Policial Águia, Helicóptero de Ataque, Jato VIP, Caça Supersônico e Avião Comercial)
 */
export const NAVAL_AIR_SPECS = {
  // ============================================================================
  // GRUPO 5: EMBARCAÇÕES DO LAGO & MAR (CATEGORIA: 'boat')
  // ============================================================================
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
  },

  // ============================================================================
  // GRUPO 6: HELICÓPTEROS & AERONAVES (CATEGORIAS: 'helicopter' e 'plane')
  // ============================================================================
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
  },
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

// Registra no catálogo global VEHICLE_SPECS
Object.assign(VEHICLE_SPECS, NAVAL_AIR_SPECS);

const SHARED_AFTERBURNER_MAT = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

function _attachExhaustFlames(group, positions, scale = 1.0) {
  const fGroup = new THREE.Group();
  fGroup.visible = false;
  const coneGeos = [];
  for (const [ex, ey, ez] of positions) {
    const g = new THREE.ConeGeometry(0.32 * scale, 2.2 * scale, 8);
    g.rotateX(-Math.PI / 2);
    g.translate(ex, ey, ez - 0.95 * scale);
    coneGeos.push(g);
  }
  fGroup.add(new THREE.Mesh(mergeBufferGeometries(coneGeos), SHARED_AFTERBURNER_MAT));
  group.add(fGroup);
  group.userData.turboFlames = [fGroup];
}

/**
 * Constrói a malha 3D LEGO detalhada de qualquer Embarcação ou Aeronave (frente apontando para +Z):
 */
export function createNavalOrAircraftMesh(cfg) {
  const type = cfg.type;
  const bodyColor = cfg.color ?? 0x0ea5e9;
  const accentColor = cfg.roofColor ?? LEGO_COLORS.white;

  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const bodyMat = getLegoMaterial(bodyColor, { roughness: 0.2, clearcoat: 0.55 });
  const whiteMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.22, clearcoat: 0.5 });
  const blackMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.38 });
  const darkMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.34 });
  const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.55, roughness: 0.2 });
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.6, roughness: 0.18 });
  const orangeMat = getLegoMaterial(LEGO_COLORS.orange, { roughness: 0.25 });
  const redMat = getLegoMaterial(LEGO_COLORS.red, { emissive: 0xdc2626, emissiveIntensity: 0.5 });
  const glassMat = getLegoMaterial(0x38bdf8, {
    roughness: 0.1,
    metalness: 0.35
  });

  // ============================================================================
  // 1. PEDALINHO CISNE (LAGO DO PARQUE CENTRAL)
  // ============================================================================
  if (type === 'pedalinho_cisne') {
    // Flutuadores laterais + Deck colorido com pinos LEGO
    for (const px of [-1.15, 1.15]) {
      const pontoon = createLegoBrick(0.75, 0.45, 4.2, LEGO_COLORS.white, { studStep: 0.7 });
      pontoon.position.set(px, 0.22, 0);
      group.add(pontoon);
    }
    const deck = createLegoBrick(2.8, 0.36, 3.8, bodyColor, { studStep: 0.65 });
    deck.position.set(0, 0.48, -0.1);
    group.add(deck);

    // Bancos brancos duplos + Pedais centrais
    const seatBack = createLegoBrick(2.2, 0.65, 0.35, LEGO_COLORS.white, { studs: false });
    seatBack.position.set(0, 0.92, -0.65);
    const seatBase = createLegoBrick(2.2, 0.25, 0.85, LEGO_COLORS.white, { studs: false });
    seatBase.position.set(0, 0.72, -0.35);
    group.add(seatBack, seatBase);

    // Pescoço e Cabeça de Cisne Branco 3D na Proa (+Z) com Bico Laranja e Coroa Dourada!
    const neck1 = createLegoBrick(0.72, 1.35, 0.72, LEGO_COLORS.white, { studs: false });
    neck1.position.set(0, 1.25, 1.45);
    neck1.rotation.x = 0.22;
    const neck2 = createLegoBrick(0.62, 1.15, 0.62, LEGO_COLORS.white, { studs: false });
    neck2.position.set(0, 2.25, 1.68);
    neck2.rotation.x = -0.15;
    const head = createLegoBrick(0.76, 0.68, 0.95, LEGO_COLORS.white, { studStep: 0.4 });
    head.position.set(0, 2.85, 1.75);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.75), orangeMat);
    beak.position.set(0, 2.78, 2.45);
    const crown = createLegoBrick(0.48, 0.28, 0.48, LEGO_COLORS.gold, { studStep: 0.24 });
    crown.position.set(0, 3.32, 1.72);

    // Asas laterais esculpidas em camadas brancas
    for (const wx of [-1.35, 1.35]) {
      const wing = createLegoBrick(0.32, 0.85, 2.4, LEGO_COLORS.white, { studStep: 0.6 });
      wing.position.set(wx, 0.95, -0.2);
      group.add(wing);
    }
    group.add(neck1, neck2, head, beak, crown);

    // Roda de Pás Traseira Giratória (Paddle Wheel)
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

  // ============================================================================
  // 2. BARCO DE PASSEIO A MOTOR (LAGO DO PARQUE CENTRAL)
  // ============================================================================
  if (type === 'barquinho_lago') {
    const hull = createLegoBrick(2.4, 0.55, 4.6, bodyColor, { studStep: 0.7 });
    hull.position.set(0, 0.35, 0);
    const bow = createLegoBrick(1.7, 0.52, 1.2, LEGO_COLORS.white, { studStep: 0.5 });
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

  // ============================================================================
  // 3. JET-SKI TURBO WAVE
  // ============================================================================
  if (type === 'jet_ski') {
    const lowerHull = createLegoBrick(1.45, 0.42, 3.6, LEGO_COLORS.white, { studs: false });
    lowerHull.position.set(0, 0.24, 0);
    const upperDeck = createLegoBrick(1.2, 0.45, 2.6, bodyColor, { studStep: 0.55 });
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
    _attachExhaustFlames(group, [[0, 0.35, -1.85]], 0.75);
    return group;
  }

  // ============================================================================
  // 4. LANCHA ESPORTIVA OFFSHORE V8 & LANCHA TÁTICA BLINDADA (BOPE)
  // ============================================================================
  if (type === 'lancha_rapida' || type === 'lancha_bope') {
    const isBope = type === 'lancha_bope';
    const hullBaseColor = isBope ? 0x111827 : LEGO_COLORS.white;
    const stripeColor = isBope ? LEGO_COLORS.gold : bodyColor;

    // Casco Principal + Proa Pontuda + Faixa Lateral
    const mainHull = createLegoBrick(3.4, 0.88, 7.6, hullBaseColor, { studStep: 0.85 });
    mainHull.position.set(0, 0.48, -0.3);
    const stripe = createLegoBrick(3.52, 0.32, 7.7, stripeColor, { studs: false });
    stripe.position.set(0, 0.72, -0.25);
    const bow1 = createLegoBrick(2.5, 0.82, 2.2, hullBaseColor, { studStep: 0.75 });
    bow1.position.set(0, 0.54, 4.1);
    const bow2 = createLegoBrick(1.5, 0.75, 1.6, stripeColor, { studStep: 0.6 });
    bow2.position.set(0, 0.58, 5.4);

    // Para-brisa Acrílico Inclinado + Bancos + Volante
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

    // Dois Motores de Popa Traseiros V8 + Hélices Duplas
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
      // Arco de Radar Policial com Giroflex + Metralhadora Naval na Proa!
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

    _attachExhaustFlames(group, [[-0.85, 0.55, -4.85], [0.85, 0.55, -4.85]], 0.95);
    return group;
  }

  // ============================================================================
  // 5. HELICÓPTEROS (ÁGUIA POLICIAL BOPE & FALCON-X DE ATAQUE MILITAR)
  // ============================================================================
  if (type === 'heli_policia' || type === 'heli_ataque') {
    const isAttack = type === 'heli_ataque';
    const mainHue = cfg.color ?? (isAttack ? 0x3f6212 : 0x111827);
    const trimHue = cfg.roofColor ?? (isAttack ? 0x334155 : LEGO_COLORS.gold);

    // Esquis de Pouso (Landing Skids)
    for (const sx of [-1.75, 1.75]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 8.6), darkMat);
      skid.position.set(sx, 0.2, 0.2);
      const strutF = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.2, 0.26), darkMat);
      strutF.position.set(sx * 0.85, 0.75, 2.2);
      const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.2, 0.26), darkMat);
      strutR.position.set(sx * 0.85, 0.75, -1.8);
      group.add(skid, strutF, strutR);
    }

    // Fuselagem Central + Cabine de Vidro Frontal (+Z) + Cauda Longa (-Z)
    const fuselage = createLegoBrick(3.4, 2.7, 7.8, mainHue, { studStep: 0.85 });
    fuselage.position.set(0, 2.15, 0);
    const stripe = createLegoBrick(3.52, 0.45, 7.85, trimHue, { studs: false });
    stripe.position.set(0, 2.05, 0);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.1, 3.8), glassMat);
    cockpit.position.set(0, 2.15, 4.2);
    const noseChin = createLegoBrick(2.6, 0.85, 2.2, mainHue, { studs: false });
    noseChin.position.set(0, 1.35, 5.1);

    // Cauda Traseira (-Z) + Estabilizador Vertical
    const tailBoom = createLegoBrick(1.2, 1.25, 7.6, mainHue, { studStep: 0.8 });
    tailBoom.position.set(0, 2.55, -6.8);
    const tailFin = createLegoBrick(0.45, 2.9, 1.8, trimHue, { studs: false });
    tailFin.position.set(0, 3.6, -10.2);
    group.add(fuselage, stripe, cockpit, noseChin, tailBoom, tailFin);

    // Asas Laterais de Armamento (Foguetes / Metralhadoras)
    if (isAttack) {
      const stubWings = createLegoBrick(8.6, 0.48, 2.4, 0x1e293b, { studStep: 0.8 });
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
      // Giroflex Policial + Canhão de Luz Tático no Helicóptero do BOPE
      const searchlight = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.32, 0.6, 12),
        getLegoMaterial(0xfef08a, { emissive: 0xfef08a, emissiveIntensity: 0.95 })
      );
      searchlight.rotation.x = Math.PI / 2;
      searchlight.position.set(0, 0.95, 5.8);
      group.add(searchlight);
    }

    // Canhão Frontal Sob o Nariz
    const noseCannon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 8), silverMat);
    noseCannon.rotation.x = Math.PI / 2;
    noseCannon.position.set(0, 1.05, 6.2);
    group.add(noseCannon);

    // Hélice Principal Superior de 4 Pás (Main Rotor) + Rotor de Cauda (Tail Rotor)
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

    _attachExhaustFlames(group, [[-0.9, 3.1, -3.9], [0.9, 3.1, -3.9]], 1.0);
    return group;
  }

  // ============================================================================
  // 6. JATO EXECUTIVO VIP & CAÇA SUPERSÔNICO F-99 RAPTOR
  // ============================================================================
  if (type === 'jato_vip' || type === 'jato_caca') {
    const isFighter = type === 'jato_caca';
    const fuseHue = isFighter ? 0x334155 : LEGO_COLORS.white;
    const wingHue = isFighter ? 0x1e293b : 0xf1f5f9;
    const accentHue = isFighter ? LEGO_COLORS.red : LEGO_COLORS.gold;

    // Fuselagem Principal + Bico Supersônico (+Z) + Canopy de Vidro
    const fuselage = createLegoBrick(3.4, 2.1, 14.5, fuseHue, { studStep: 1.0 });
    fuselage.position.set(0, 2.1, -0.5);
    const stripe = createLegoBrick(3.52, 0.38, 14.6, accentHue, { studs: false });
    stripe.position.set(0, 2.0, -0.5);

    const noseCone = createLegoBrick(2.2, 1.35, 4.6, isFighter ? 0x0f172a : fuseHue, { studs: false });
    noseCone.position.set(0, 1.85, 8.2);
    const noseTip = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.8, 12), isFighter ? darkMat : whiteMat);
    noseTip.rotation.x = Math.PI / 2;
    noseTip.position.set(0, 1.85, 11.6);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.35, 4.8), glassMat);
    canopy.position.set(0, 3.05, 3.8);

    // Asas Delta / Enflechadas Largas
    const wings = createLegoBrick(15.6, 0.45, 6.8, wingHue, { studStep: 1.2 });
    wings.position.set(0, 1.95, -1.2);
    for (const wx of [-7.9, 7.9]) {
      const wingtip = createLegoBrick(0.55, 0.9, 4.2, accentHue, { studs: false });
      wingtip.position.set(wx, 2.2, -1.2);
      group.add(wingtip);
    }

    // Estabilizadores Verticais na Cauda (-Z)
    if (isFighter) {
      for (const tx of [-1.45, 1.45]) {
        const vTail = createLegoBrick(0.45, 3.4, 3.4, 0x0f172a, { studs: false });
        vTail.position.set(tx, 3.8, -6.2);
        vTail.rotation.z = tx > 0 ? -0.22 : 0.22;
        group.add(vTail);
      }
    } else {
      const vTail = createLegoBrick(0.55, 4.2, 3.8, 0x0284c7, { studs: false });
      vTail.position.set(0, 4.4, -6.4);
      const hTail = createLegoBrick(5.8, 0.38, 2.4, LEGO_COLORS.white, { studs: false });
      hTail.position.set(0, 6.2, -6.6);
      group.add(vTail, hTail);
    }

    // Trem de Pouso com Rodas LEGO
    for (const [gx, gz] of [[0, 6.2], [-2.4, -2.2], [2.4, -2.2]]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.35), silverMat);
      strut.position.set(gx, 0.95, gz);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.42, 14), blackMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(gx, 0.52, gz);
      group.add(strut, wheel);
    }

    group.add(fuselage, stripe, noseCone, noseTip, canopy, wings);
    _attachExhaustFlames(group, [[-0.95, 2.0, -7.8], [0.95, 2.0, -7.8]], 1.45);
    return group;
  }

  // ============================================================================
  // 7. MEGA AVIÃO COMERCIAL LEGO AIRLINES (BOEING / AIRBUS LEGO)
  // ============================================================================
  const fuselage = createLegoBrick(5.8, 5.2, 30.0, LEGO_COLORS.white, { studStep: 1.8 });
  fuselage.position.set(0, 4.4, 0);
  const belly = createLegoBrick(5.95, 1.6, 30.2, 0x0284c7, { studs: false });
  belly.position.set(0, 2.4, 0);
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.0, 4.2), glassMat);
  cockpit.position.set(0, 5.1, 14.8);
  const nose = createLegoBrick(4.4, 2.8, 3.6, LEGO_COLORS.white, { studs: false });
  nose.position.set(0, 3.4, 16.2);

  // Asas Gigantes (34m de envergadura) + 2 Megaturbinas Prateadas sob as Asas
  const mainWings = createLegoBrick(34.0, 0.72, 7.2, LEGO_COLORS.white, { studStep: 2.0 });
  mainWings.position.set(0, 3.8, 1.2);
  for (const ex of [-9.5, 9.5]) {
    const engineNacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 5.2, 16), silverMat);
    engineNacelle.rotation.x = Math.PI / 2;
    engineNacelle.position.set(ex, 2.35, 2.5);
    group.add(engineNacelle);
  }

  // Cauda Vertical Alta Azul/Dourada + Estabilizadores Horizontais Traseiros (-Z)
  const tailFin = createLegoBrick(1.1, 8.8, 6.2, 0x0284c7, { studs: false });
  tailFin.position.set(0, 10.4, -12.2);
  const tailGold = createLegoBrick(1.25, 2.0, 4.8, LEGO_COLORS.gold, { studs: false });
  tailGold.position.set(0, 13.6, -12.6);
  const hStab = createLegoBrick(14.5, 0.55, 4.2, LEGO_COLORS.white, { studs: false });
  hStab.position.set(0, 4.9, -13.2);

  // Trem de Pouso Triplo
  for (const [gx, gz] of [[0, 12.0], [-3.2, -1.5], [3.2, -1.5]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.85), darkMat);
    leg.position.set(gx, 1.0, gz);
    group.add(leg);
  }

  group.add(fuselage, belly, cockpit, nose, mainWings, tailFin, tailGold, hStab);
  _attachExhaustFlames(group, [[-9.5, 2.35, -0.3], [9.5, 2.35, -0.3]], 1.85);
  return group;
}

/**
 * POSICIONA TODAS AS EMBARCAÇÕES (PEDALINHOS, BARCOS, JET-SKIS E LANCHAS)
 * E TODAS AS AERONAVES (HELICÓPTEROS, JATOS VIP, CAÇAS SUPERSÔNICOS E AVIÕES COMERCIAIS) PELO MAPA!
 */
export function buildBoatsAndAircraftFleet(world) {
  const fleet = [
    // ==========================================================================
    // 1. GRANDE LAGO DO PARQUE CENTRAL (8 EMBARCAÇÕES VIVAS: PEDALINHOS CISNE & BARCOS!)
    // ==========================================================================
    // Atracados direto no Píer de Madeira da Margem Oeste (X = 109, Z = 258..278) — suba com [E] direto do Píer!
    { x: 109.0, y: 0.42, z: 258.0, rotY: Math.PI / 2, color: 0xec4899, type: 'pedalinho_cisne' },
    { x: 111.0, y: 0.42, z: 268.0, rotY: Math.PI / 2, color: 0x06b6d4, type: 'barquinho_lago' },
    { x: 109.0, y: 0.42, z: 278.0, rotY: Math.PI / 2, color: 0xfacc15, type: 'pedalinho_cisne' },
    // Espalhados pelas águas do Grande Lago (perto da Ponte Arqueada e margens)
    { x: 148.0, y: 0.42, z: 224.0, rotY: 0.4,         color: 0x3b82f6, type: 'barquinho_lago' },
    { x: 158.0, y: 0.42, z: 312.0, rotY: 2.2,         color: 0xf97316, type: 'pedalinho_cisne' },
    { x: 252.0, y: 0.42, z: 226.0, rotY: -0.6,        color: 0xec4899, type: 'pedalinho_cisne' },
    { x: 264.0, y: 0.42, z: 308.0, rotY: -2.4,        color: 0x22c55e, type: 'barquinho_lago' },
    { x: 298.0, y: 0.42, z: 268.0, rotY: -Math.PI / 2, color: 0xef4444, type: 'pedalinho_cisne' },

    // ==========================================================================
    // 2. MARINA DO PÍER SUL, PRAIA, 3 CANAIS DE SANTOS E CANAL LESTE (JET-SKIS & LANCHAS!)
    // ==========================================================================
    // Píeres Flutuantes da Marina (X = 122..140, Z = 1095..1215): 6 Lanchas Rápidas + 2 Lanchas Táticas BOPE!
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

    // No Rio / Canal Urbano Leste (Cota da Água Y = -3.50 — Atracados nos 3 Píeres Fluviais de Madeira mantendo o eixo central X = 560 livre!):
    // Píer 1 — Margem Oeste do Parque Central (Z = 268, Deck X = 540..547.5):
    { x: 550.2, y: -3.5, z: 259.0, rotY: 0,       color: 0x111827, customName: 'LANCHA TÁTICA FLUVIAL (BOPE)', type: 'lancha_bope' },
    { x: 550.2, y: -3.5, z: 276.0, rotY: 0,       color: 0x06b6d4, customName: 'JET-SKI TURBO PARQUE CENTRAL', type: 'jet_ski' },
    // Píer 2 — Doca Fluvial de Fuga do PCC na Margem Leste (Z = -185, Deck X = 572.5..580):
    { x: 569.8, y: -3.5, z: -193.0, rotY: Math.PI, color: 0x1e3a8a, customName: 'LANCHA BLINDADA DE FUGA (PCC)', type: 'lancha_rapida' },
    { x: 569.8, y: -3.5, z: -177.0, rotY: Math.PI, color: 0x0ea5e9, customName: 'JET-SKI DE INTERCEPTAÇÃO (PCC)', type: 'jet_ski' },
    // Píer 3 — Marina da Foz da Praia Sul na Margem Oeste (Z = 845, Deck X = 540..547.5):
    { x: 550.2, y: -3.5, z: 834.0, rotY: 0,       color: 0xef4444, customName: 'LANCHA OFFSHORE FOZ DA PRAIA', type: 'lancha_rapida' },
    { x: 550.2, y: -3.5, z: 846.0, rotY: 0,       color: 0xfacc15, customName: 'JET-SKI WAVE RUNNER FOZ SUL 01', type: 'jet_ski' },
    { x: 550.2, y: -3.5, z: 856.0, rotY: 0,       color: 0x06b6d4, customName: 'JET-SKI WAVE RUNNER FOZ SUL 02', type: 'jet_ski' },
    // Patrulha Fluvial no Centro Financeiro (Margem Oeste X = 549.5):
    { x: 549.5, y: -3.5, z: -45.0, rotY: 0,       color: 0x111827, type: 'lancha_bope' },
    { x: 549.5, y: -3.5, z: 45.0,  rotY: 0,       color: 0x06b6d4, type: 'jet_ski' },

    // Na Marina Oeste (Ponta da Praia / Costão Sudoeste — X = -1352, Z = 1095..1215):
    { x: -1352.0, y: -0.15, z: 1106.0, rotY: Math.PI / 2, color: 0xef4444, type: 'lancha_rapida' },
    { x: -1352.0, y: -0.15, z: 1146.0, rotY: Math.PI / 2, color: 0x06b6d4, type: 'lancha_rapida' },
    { x: -1352.0, y: -0.15, z: 1186.0, rotY: Math.PI / 2, color: 0xfacc15, type: 'jet_ski' },
    { x: -1352.0, y: -0.15, z: 1226.0, rotY: Math.PI / 2, color: 0xec4899, type: 'jet_ski' },

    // ==========================================================================
    // 3. AEROPORTO INTERNACIONAL & BASE MILITAR OESTE (AVIÕES, JATOS E HELICÓPTEROS!)
    // ==========================================================================
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
    { x: -1215.0, y: 0.22, z: -55.0,  rotY: Math.PI / 2,  color: 0x111827, type: 'heli_policia' },

    // ==========================================================================
    // 4. HELIPONTOS DO CENTRO (SUPER BANCO & TORRE DOS HERÓIS) E AEROPORTA-AVIÕES NO CÉU!
    // ==========================================================================
    // Heliponto no Terraço do Super Banco Central (X = -31.5, Y = 40.25, Z = -180):
    { x: -31.5,  y: 40.25, z: -180.0, rotY: 0, color: 0x111827, type: 'heli_policia' },
    // Heliponto Principal no Topo da Torre dos Heróis (X = -309.5, Y = 310.8, Z = -180 — deixando o centro/oeste livre para o TP!) + Caça Supersônico no Hangar em Balanço (Y = 228.45, Z = -144):
    { x: -309.5, y: 310.8,  z: -180.0, rotY: 0, color: 0x111827, type: 'heli_policia' },
    { x: -318.0, y: 228.45, z: -144.0, rotY: 0, color: 0x0284c7, customName: 'CAÇA SUPERSÔNICO DA TORRE DOS HERÓIS', type: 'jato_caca' },
    // Heliponto Principal do Chefe no Topo da Cidadela / Torre do Bunker Central do PCC (X = 866, Y = 112.8, Z = -428):
    { x: 866.0,  y: 112.8, z: -428.0, rotY: 0, color: 0x090a0d, roofColor: 0x0ea5e9, customName: 'HELICÓPTERO EXECUTIVO BLINDADO (PCC)', type: 'heli_policia' },
    // Heliponto Tático Auxiliar na Base Blindada do Bunker Central do PCC (X = 816, Y = 30.55, Z = -386):
    { x: 816.0,  y: 30.55, z: -386.0, rotY: 0, color: 0x090a0d, roofColor: 0x1d4ed8, customName: 'HELICÓPTERO DE ESCOLTA (PCC)', type: 'heli_policia' },
    // Duplo Heliponto Policial no Topo da Cidadela Panóptica Central ("A Balsa") da Ilha da Prisão (Y = 126.8, Z = 1540):
    { x: 1352.0, y: 126.8, z: 1540.0, rotY: Math.PI, color: 0x111827, roofColor: 0x3b82f6, customName: 'HELICÓPTERO ÁGUIA 01 (BOPE / PRISÃO)', type: 'heli_policia' },
    { x: 1398.0, y: 126.8, z: 1540.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0xfacc15, customName: 'HELICÓPTERO CAVEIRA 02 (BOPE / PRISÃO)', type: 'heli_policia' },
    // Doca Naval da Guarda Costeira (Fora da Muralha Oeste da Ilha da Prisão): 2 Lanchas Blindadas da Polícia Marítima atracadas!
    { x: 850.0,  y: -0.35, z: 1528.0, rotY: 0,       color: 0x111827, roofColor: 0x3b82f6, customName: 'LANCHA BLINDADA DA POLÍCIA MARÍTIMA 01', type: 'lancha_bope' },
    { x: 850.0,  y: -0.35, z: 1572.0, rotY: 0,       color: 0x090a0d, roofColor: 0xfacc15, customName: 'LANCHA BLINDADA DA GUARDA COSTEIRA 02', type: 'lancha_bope' },
    // Heliponto no Topo da Torre da Capitania dos Portos & Controle Naval (X = 1105, Y = 92.8, Z = 235):
    { x: 1105.0, y: 92.8,  z: 235.0,  rotY: 0,       color: 0xf8fafc, roofColor: 0x0284c7, customName: 'HELICÓPTERO DA CAPITANIA DOS PORTOS', type: 'heli_policia' },
    // Convés do Aeroporta-Aviões no Céu (Y = 410.45): 3 Caças Supersônicos + 1 Helicóptero de Ataque!
    { x: 22.0,   y: 410.45, z: -132.0, rotY: 0.35,  color: 0x334155, type: 'jato_caca' },
    { x: 22.0,   y: 410.45, z: -18.0,  rotY: -0.25, color: 0x334155, type: 'jato_caca' },
    { x: -48.0,  y: 410.45, z: -40.0,  rotY: 0,     color: 0x334155, type: 'jato_caca' },
    { x: 22.0,   y: 410.45, z: 32.0,   rotY: Math.PI, color: 0x3f6212, type: 'heli_ataque' }
  ];

  fleet.forEach((cfg) => {
    const spec = VEHICLE_SPECS[cfg.type];
    if (!spec) return;

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
    world.scene.add(mesh);

    // Registra rotores giratórios passivos para helicópteros estacionados
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

