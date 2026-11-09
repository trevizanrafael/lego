import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';
import { optimizeStaticGroupMeshes, mergeBufferGeometries } from './BuildingGenerator.js';

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
export function createLegoCarMesh(cfg) {
  const type = cfg.type || 'apex_gtx';
  const spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.apex_gtx;
  const group = new THREE.Group();

  const bodyColor = cfg.color ?? 0xfacc15;
  const roofColor = cfg.roofColor ?? LEGO_COLORS.black;

  const bodyMat = getLegoMaterial(bodyColor, { roughness: 0.2, clearcoat: 0.55 });
  const darkTrimMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.35 });
  const blackMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.4 });
  const whiteMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.25 });
  const tireMat = blackMat;
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.5, roughness: 0.2 });
  const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.5, roughness: 0.2 });
  const neonCyanMat = getLegoMaterial(0x06b6d4, { emissive: 0x06b6d4, emissiveIntensity: 0.9 });
  const neonPurpleMat = getLegoMaterial(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 0.9 });
  const glassMat = getLegoMaterial(type === 'suv_pcc' || type === 'van_pcc' ? 0x05070c : 0x38bdf8, {
    roughness: 0.08,
    metalness: 0.45
  });
  const headlightMat = getLegoMaterial(0xfef08a, { emissive: 0xfef08a, emissiveIntensity: 0.95 });
  const taillightMat = getLegoMaterial(LEGO_COLORS.red, { emissive: 0xef4444, emissiveIntensity: 0.85 });

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

    const primaryMat = getLegoMaterial(primaryColor, { roughness: 0.2, clearcoat: 0.55 });
    const secondaryMat = getLegoMaterial(secondaryColor, { roughness: 0.24, clearcoat: 0.45 });
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

    // 4. Tanque de Combustível Musculoso Esculpido com Pinos de LEGO (Studs) + Abas Laterais
    const mainTank = createLegoBrick(0.96, 0.42, 1.12, primaryColor, { studStep: 0.45 });
    mainTank.position.set(0, 1.24, 0.28);
    const tankTopCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), silverMat);
    tankTopCap.position.set(0, 1.47, 0.38);
    group.add(mainTank, tankTopCap);

    for (const sx of [-0.5, 0.5]) {
      const tankShroud = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.36, 0.92),
        isPolice ? secondaryMat : primaryMat
      );
      tankShroud.rotation.x = -0.14;
      tankShroud.position.set(sx, 1.18, 0.52);
      group.add(tankShroud);
    }

    // 5. Banco Esportivo Bipartido em 2 Níveis (Sela do Piloto + Banco Elevado do Garupa) + Rabeta Empinada
    const riderSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.18, 0.78), blackMat);
    riderSaddle.position.set(0, 1.05, -0.34);
    const pillionSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.68), darkTrimMat);
    pillionSaddle.rotation.x = -0.12;
    pillionSaddle.position.set(0, 1.18, -0.96);
    const tailFairing = createLegoBrick(0.82, 0.24, 0.92, isPolice ? secondaryColor : primaryColor, { studStep: 0.45 });
    tailFairing.rotation.x = -0.14;
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
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, shieldH, 0.1),
      isPcc ? getLegoMaterial(0x020617, { roughness: 0.08, metalness: 0.6 }) : glassMat
    );
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

      // Baú Traseiro Superior (Top Case) + Mastro de Rádio com Giroflex Traseiro Elevado
      const topCase = createLegoBrick(0.68, 0.38, 0.58, secondaryColor, { studStep: 0.35 });
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
    const rimMat = isPcc ? pccNeonBlueMat : isPolice ? silverMat : goldMat;
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
    _attachTurboFlames(group, [-0.48, 0.48], 0.92, -1.68);
    return group;
  }

  // ============================================================================
  // CASO ESPECIAL 2: TANQUE MILITAR TITAN-M1 (COM ESTEIRAS E CANHÃO GIRATÓRIO)
  // ============================================================================
  if (type === 'tanque_titan') {
    const hull = createLegoBrick(3.4, 1.15, 5.8, 0x3f6212, { studStep: 0.8 });
    hull.position.set(0, 0.92, 0);
    group.add(hull);

    // Esteiras blindadas laterais (Tracks)
    for (const tx of [-1.75, 1.75]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.88, 5.9), blackMat);
      track.position.set(tx, 0.46, 0);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.38, 5.95), bodyMat);
      skirt.position.set(tx, 0.92, 0);
      group.add(track, skirt);
    }

    // Faróis militares e lanternas traseiras
    for (const lx of [-1.1, 1.1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.14), headlightMat);
      hl.position.set(lx, 1.15, 2.92);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.14), taillightMat);
      tl.position.set(lx, 1.15, -2.92);
      group.add(hl, tl);
    }

    // Torreta Giratória com Canhão Principal Longo
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.85, -0.2);
    const turretBody = createLegoBrick(2.3, 0.78, 2.7, 0x365314, { studStep: 0.7 });
    const cannonBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.8, 12), darkTrimMat);
    cannonBarrel.rotation.x = Math.PI / 2;
    cannonBarrel.position.set(0, 0.08, 2.4);
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.45, 12), blackMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.08, 4.3);
    turretGroup.add(turretBody, cannonBarrel, muzzleBrake);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;

    const wheels = [];
    for (const wz of [-2.1, -0.7, 0.7, 2.1]) {
      for (const wx of [-1.78, 1.78]) {
        const steerGroup = new THREE.Group();
        steerGroup.position.set(wx, 0.44, wz);
        const spinGroup = new THREE.Group();
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.42, 12), silverMat);
        wheel.rotation.z = Math.PI / 2;
        spinGroup.add(wheel);
        steerGroup.add(spinGroup);
        group.add(steerGroup);
        wheels.push({ steerGroup, spinGroup, isFront: false });
      }
    }
    group.userData.wheels = wheels;
    _attachTurboFlames(group, [-0.8, 0.8], 0.75, -3.0);
    return group;
  }

  // ============================================================================
  // DEMAIS 15 VEÍCULOS (CARROS, CONVERSÍVEIS, PICAPES, VANS, APC E CAMINHÕES BLINDADOS)
  // ============================================================================
  const isHeavyTruck = type === 'caveirao_bope' || type === 'carro_forte' || type === 'van_pcc';
  const isSixWheelApc = type === 'hover_apc_ares';
  const isPickup = type === 'picape_cv' || type === 'choque_pickup';
  const isWideHyper = type === 'apex_gtx' || type === 'cyber_blade';

  const chassisW = isHeavyTruck || isSixWheelApc ? 2.65 : isWideHyper ? 2.52 : 2.36;
  const chassisH = isHeavyTruck ? 0.95 : isWideHyper ? 0.62 : 0.72;
  const chassisD = isHeavyTruck || isSixWheelApc ? 5.6 : 4.85;

  // Chassi principal + Capô com pinos de LEGO (Studs)
  const chassis = createLegoBrick(chassisW, chassisH, chassisD, bodyColor, { studStep: 0.65 });
  chassis.position.set(0, 0.42 + chassisH * 0.5, 0);
  group.add(chassis);

  // Para-choque dianteiro e traseiro + Faróis brilhantes + Lanternas traseiras vermelhas
  const frontZ = chassisD * 0.5 + 0.04;
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(chassisW + 0.1, 0.3, 0.38), darkTrimMat);
  frontBumper.position.set(0, 0.46, frontZ);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(chassisW + 0.1, 0.32, 0.38), darkTrimMat);
  rearBumper.position.set(0, 0.46, -frontZ);
  group.add(frontBumper, rearBumper);

  const lightOffsetX = chassisW * 0.35;
  for (const lx of [-lightOffsetX, lightOffsetX]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.14), headlightMat);
    hl.position.set(lx, 0.78, frontZ);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.14), taillightMat);
    tl.position.set(lx, 0.78, -frontZ);
    group.add(hl, tl);
  }

  // Bancos internos e Volante 3D (Steering Wheel) dentro da cabine!
  const seatMat = type === 'vortex_roadster' ? whiteMat : blackMat;
  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.65), seatMat);
  driverSeat.position.set(-0.42, 1.05, -0.15);
  const passSeat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.55, 0.65), seatMat);
  passSeat.position.set(0.42, 1.05, -0.15);
  const steeringWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12), blackMat);
  steeringWheel.rotation.x = Math.PI / 3;
  steeringWheel.position.set(-0.42, 1.18, 0.52);
  group.add(driverSeat, passSeat, steeringWheel);

  // Para-brisa translúcido e Cabine / Teto específico por modelo
  const chassisTopY = 0.42 + chassisH;
  if (spec.openTop) {
    // Conversível (Vortex Roadster) ou Buggy de Praia (Sem teto ou Gaiola aberta!)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(chassisW - 0.3, 0.52, 0.16), glassMat);
    windshield.rotation.x = -0.32;
    windshield.position.set(0, chassisTopY + 0.24, 0.82);
    group.add(windshield);

    if (type === 'buggy_praia') {
      // Gaiola tubular aberta (Roll Cage) laranja/verde-limão
      const cageMat = getLegoMaterial(0x84cc16);
      for (const cx of [-0.92, 0.92]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 2.2), cageMat);
        bar.position.set(cx, chassisTopY + 0.39, -0.1);
        group.add(bar);
      }
    }
  } else {
    const cabinW = chassisW - 0.28;
    const cabinH = isHeavyTruck ? 1.05 : isPickup ? 0.72 : 0.68;
    const cabinD = isHeavyTruck ? chassisD - 1.3 : isPickup ? 2.1 : 2.38;
    const cabinZ = isHeavyTruck ? -0.45 : isPickup ? 0.35 : -0.12;

    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinW, cabinH, cabinD), glassMat);
    cabinGlass.position.set(0, chassisTopY + cabinH * 0.5, cabinZ);
    group.add(cabinGlass);

    const roofY = chassisTopY + cabinH + 0.09;
    const roofPlate = createLegoBrick(cabinW + 0.08, 0.18, cabinD + 0.08, roofColor, { studStep: 0.65 });
    roofPlate.position.set(0, roofY, cabinZ);
    group.add(roofPlate);
  }

  // ============================================================================
  // DETALHES EXCLUSIVOS DE CADA UM DOS VEÍCULOS
  // ============================================================================
  if (type === 'apex_gtx') {
    // Faixa preta central + Aerofólio GT largo
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, chassisD - 0.2), blackMat);
    stripe.position.set(0, chassisTopY + 0.03, 0);
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.12, 0.58), blackMat);
    wingBlade.position.set(0, chassisTopY + 0.52, -2.18);
    const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.3), blackMat);
    wingPostL.position.set(-0.85, chassisTopY + 0.26, -2.15);
    const wingPostR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.48, 0.3), blackMat);
    wingPostR.position.set(0.85, chassisTopY + 0.26, -2.15);
    group.add(stripe, wingBlade, wingPostL, wingPostR);
  } else if (type === 'trovao_v8') {
    // Listras brancas + Motor V8 Blower cromado saltando do capô!
    for (const sx of [-0.32, 0.32]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 1.6), whiteMat);
      stripe.position.set(sx, chassisTopY + 0.03, 1.55);
      group.add(stripe);
    }
    const blower = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.38, 0.92), silverMat);
    blower.position.set(0, chassisTopY + 0.2, 1.5);
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.65), blackMat);
    scoop.position.set(0, chassisTopY + 0.44, 1.58);
    group.add(blower, scoop);
  } else if (type === 'cyber_blade') {
    // Frisos luminosos Ciano e Roxo-Neon no chassi
    for (const nx of [-chassisW * 0.51, chassisW * 0.51]) {
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, chassisD - 0.3), neonCyanMat);
      neonStrip.position.set(nx, 0.56, 0);
      group.add(neonStrip);
    }
    const rearNeon = new THREE.Mesh(new THREE.BoxGeometry(chassisW, 0.14, 0.12), neonPurpleMat);
    rearNeon.position.set(0, chassisTopY + 0.35, -2.25);
    group.add(rearNeon);
  } else if (type === 'caveirao_bope') {
    // Quebra-mato gigante + Emblema de Caveira Branca nas laterais + Escotilha e Giroflex no teto!
    const ram = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.95, 0.45), silverMat);
    ram.position.set(0, 0.85, frontZ + 0.22);
    const hatch = createLegoBrick(1.1, 0.25, 1.1, LEGO_COLORS.charcoal, { studStep: 0.5 });
    hatch.position.set(0, 2.62, -0.2);
    for (const sx of [-1.35, 1.35]) {
      const skullEmblem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.72), whiteMat);
      skullEmblem.position.set(sx, 1.75, -0.5);
      group.add(skullEmblem);
    }
    _addPoliceLightbar(group, 2.65, 0.8);
    group.add(ram, hatch);
  } else if (type === 'interceptor_v8' || type === 'choque_pickup') {
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.6, 0.25), blackMat);
    pushBar.position.set(0, 0.68, frontZ + 0.15);
    group.add(pushBar);
    _addPoliceLightbar(group, 2.02, 0.1);
  } else if (type === 'picape_cv') {
    // Metralhadora Giratória montada na caçamba traseira!
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, chassisTopY + 0.55, -1.35);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 8), blackMat);
    ped.position.y = -0.2;
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 0.12), darkTrimMat);
    shield.position.set(0, 0.3, 0.35);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 1.1), blackMat);
    gunBody.position.set(0, 0.25, 0.2);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), silverMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.25, 0.95);
    turretGroup.add(ped, shield, gunBody, barrel);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;
  } else if (type === 'hover_apc_ares') {
    // Blindado 6 Rodas Cinza/Roxo-Neon com Torreta de Canhão Laser no teto!
    for (const nx of [-1.36, 1.36]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 5.2), neonPurpleMat);
      strip.position.set(nx, 0.95, 0);
      group.add(strip);
    }
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 2.38, -0.2);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.5), darkTrimMat);
    const laserBarrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 10), neonPurpleMat);
    laserBarrelL.rotation.x = Math.PI / 2;
    laserBarrelL.position.set(-0.32, 0.05, 1.1);
    const laserBarrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 10), neonCyanMat);
    laserBarrelR.rotation.x = Math.PI / 2;
    laserBarrelR.position.set(0.32, 0.05, 1.1);
    turretGroup.add(pod, laserBarrelL, laserBarrelR);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;
  } else if (type === 'taxi_metro') {
    const sign = createLegoBrick(0.95, 0.28, 0.42, LEGO_COLORS.orange, { studs: false });
    sign.position.set(0, 2.02, -0.1);
    group.add(sign);
  } else if (type === 'carro_forte') {
    // Faixas e detalhes Dourados do Super Banco Central
    for (const sx of [-1.35, 1.35]) {
      const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 5.2), goldMat);
      goldStripe.position.set(sx, 1.55, -0.2);
      group.add(goldStripe);
    }
  } else if (type === 'suv_pcc') {
    // SUV Blindada Executiva do PCC: Quebra-mato de aço preto, frisos Azul-Marinho/Neon e antena de rádio tático
    const bullBar = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.65, 0.28), darkTrimMat);
    bullBar.position.set(0, 0.68, frontZ + 0.16);
    const blueMat = getLegoMaterial(0x1d4ed8, { roughness: 0.22 });
    for (const sx of [-chassisW * 0.51, chassisW * 0.51]) {
      const pccStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, chassisD - 0.35), blueMat);
      pccStripe.position.set(sx, 0.92, 0);
      const cyanTrim = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, chassisD - 0.6), neonCyanMat);
      cyanTrim.position.set(sx, 0.78, 0);
      group.add(pccStripe, cyanTrim);
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.95, 6), silverMat);
    antenna.position.set(0, 2.38, -0.75);
    group.add(bullBar, antenna);
  } else if (type === 'van_pcc') {
    // Van Quebra-Cofre de Assalto do PCC: Ariete frontal blindado, faixas Azul-Escuro/Prata e módulo C4 no teto
    const ramPlate = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.85, 0.36), silverMat);
    ramPlate.position.set(0, 0.78, frontZ + 0.18);
    const blueMat = getLegoMaterial(0x1e3a8a, { roughness: 0.24 });
    for (const sx of [-1.35, 1.35]) {
      const sideArmor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 5.1), blueMat);
      sideArmor.position.set(sx, 1.55, -0.2);
      const silverLine = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 4.9), silverMat);
      silverLine.position.set(sx, 1.88, -0.2);
      group.add(sideArmor, silverLine);
    }
    const roofBox = createLegoBrick(1.4, 0.32, 1.9, 0x0f172a, { studStep: 0.5 });
    roofBox.position.set(0, 2.66, -0.5);
    group.add(ramPlate, roofBox);
  }

  // Rodas cilíndricas com calotas (4 rodas padrão, ou 6 rodas para o Hover-APC)
  const wheelX = chassisW * 0.5;
  const wheelRadius = isHeavyTruck || type === 'buggy_praia' ? 0.52 : 0.44;
  const zPositions = isSixWheelApc ? [1.75, 0, -1.75] : [chassisD * 0.31, -chassisD * 0.31];
  const hubMat = type === 'cyber_blade' ? neonCyanMat : type === 'apex_gtx' || type === 'carro_forte' ? goldMat : silverMat;

  const wheels = [];
  for (const wz of zPositions) {
    for (const wx of [-wheelX, wheelX]) {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wx, wheelRadius, wz);
      const spinGroup = new THREE.Group();

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.4, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.58, wheelRadius * 0.58, 0.42, 12), hubMat);
      hub.rotation.z = Math.PI / 2;

      spinGroup.add(tire, hub);
      steerGroup.add(spinGroup);
      group.add(steerGroup);
      wheels.push({ steerGroup, spinGroup, isFront: wz > 0.5 });
    }
  }
  group.userData.wheels = wheels;

  _attachTurboFlames(group, [-0.55, 0.55], 0.46, -frontZ - 0.25);
  return group;
}

function _addPoliceLightbar(group, y, z) {
  const redLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.22, 0.36),
    getLegoMaterial(LEGO_COLORS.red, { emissive: 0xdc2626, emissiveIntensity: 0.85 })
  );
  redLight.position.set(-0.4, y, z);
  const blueLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.22, 0.36),
    getLegoMaterial(LEGO_COLORS.blue, { emissive: 0x2563eb, emissiveIntensity: 0.85 })
  );
  blueLight.position.set(0.4, y, z);
  group.add(redLight, blueLight);
}

const SHARED_FLAME_MAT = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

function _attachTurboFlames(group, xOffsets, y, z) {
  const fGroup = new THREE.Group();
  fGroup.position.set(0, y, z);
  fGroup.visible = false;
  const coneGeos = [];
  for (const ex of xOffsets) {
    const g = new THREE.ConeGeometry(0.24, 1.45, 8);
    g.rotateX(-Math.PI / 2);
    g.translate(ex, 0, -0.58);
    coneGeos.push(g);
  }
  const flameMesh = new THREE.Mesh(mergeBufferGeometries(coneGeos), SHARED_FLAME_MAT);
  fGroup.add(flameMesh);
  group.add(fGroup);

  const turboFlames = [fGroup];
  group.userData.turboFlames = turboFlames;
  optimizeStaticGroupMeshes(group, [
    fGroup,
    group.userData.turretGroup
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
    { x: 181.0, z: -700.0, rotY: 0, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'apex_gtx' },
    { x: 213.0, z: -700.0, rotY: Math.PI, color: 0x3b82f6, roofColor: LEGO_COLORS.white, type: 'sedan_familiar' },
    // Estacionamento da Pizzaria & Ruas do Subúrbio Norte
    { x: 48.0, z: -680.0, rotY: 0, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi_metro' },
    { x: 64.0, z: -680.0, rotY: 0, color: 0x2563eb, roofColor: LEGO_COLORS.white, type: 'vortex_roadster' },
    { x: -45.0, z: -646.0, rotY: Math.PI / 2, color: 0x16a34a, roofColor: LEGO_COLORS.white, type: 'sedan_familiar' },
    { x: -178.0, z: -646.0, rotY: Math.PI / 2, color: 0xf97316, roofColor: LEGO_COLORS.black, type: 'trovao_v8' },
    // Orla & Praia Sul (Buggies de Dunas na Areia, Conversíveis, Supercarros e Motos Táticas da Polícia na Avenida Beira-Mar)
    { x: -24.0, z: 710.0, rotY: Math.PI / 2, color: 0xec4899, roofColor: LEGO_COLORS.white, type: 'vortex_roadster' },
    { x: -12.0, z: 710.0, rotY: Math.PI / 2, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 14.0,  z: 710.0, rotY: -Math.PI / 2, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 28.0,  z: 710.0, rotY: -Math.PI / 2, color: 0xfacc15, roofColor: LEGO_COLORS.black, type: 'apex_gtx' },
    { x: -32.0, z: 825.0, rotY: 0.35, color: 0xf97316, roofColor: 0x84cc16, type: 'buggy_praia' },
    { x: 32.0,  z: 825.0, rotY: -0.35, color: 0x84cc16, roofColor: 0xf97316, type: 'buggy_praia' },
    { x: -195.0, z: 895.0, rotY: 0.2, color: 0xf97316, roofColor: 0x84cc16, type: 'buggy_praia' },
    { x: 195.0,  z: 895.0, rotY: -0.2, color: 0x22c55e, roofColor: 0xfacc15, type: 'buggy_praia' },
    // Dunas da Ponta da Praia / Costão Sudoeste (Buggies de Duna ao lado do Farol e Marina Oeste):
    { x: -1450.0, z: 830.0, rotY: 0.35, color: 0xf97316, roofColor: 0xfacc15, type: 'buggy_praia' },
    { x: -1215.0, z: 830.0, rotY: -0.25, color: 0x22c55e, roofColor: 0xf97316, type: 'buggy_praia' },
    // Favela / Complexo da Cidade de Deus — Bocas de Entrada do CV (Oeste: Motos de Assalto 600cc e Picapes Armadas do CV!)
    { x: -518.0, z: -382.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: -250.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
    { x: -518.0, z: -242.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: -117.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: -108.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
    { x: -518.0, z: 134.0,  rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: 245.0,  rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
    { x: -518.0, z: 340.0,  rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
    // Distrito Industrial (Leste — Império Blindado 100% PCC):
    // 1) Saindo da Rampa Subterrânea / Garagem de Fuga Blindada do Bunker Central (X = 896, Z = -356..-315) + Superbikes 1000cc do PCC:
    { x: 896.0, y: -1.1, z: -358.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'van_pcc' },
    { x: 896.0, y: 0.0,  z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: 882.0, y: 0.0,  z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 910.0, y: 0.0,  z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
    { x: 850.0, y: 0.0,  z: -334.0, rotY: -Math.PI / 4, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
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
    { x: 882.0,  y: 0.3, z: 615.0, rotY: Math.PI / 2,  color: 0x334155, roofColor: 0xa855f7, type: 'hover_apc_ares' },
    { x: 882.0,  y: 0.3, z: 655.0, rotY: Math.PI / 2,  color: 0x1e293b, roofColor: 0xd946ef, type: 'hover_apc_ares' },
    { x: 1108.0, y: 0.3, z: 615.0, rotY: -Math.PI / 2, color: 0x334155, roofColor: 0xa855f7, type: 'hover_apc_ares' },
    { x: 1108.0, y: 0.3, z: 655.0, rotY: -Math.PI / 2, color: 0x1e293b, roofColor: 0xd946ef, type: 'hover_apc_ares' },
    // Aeroporto Internacional & Base Militar Oeste (Estacionamento na frente do Mega Terminal + Baias de Tanques!)
    { x: -1058.0, z: -65.0,  rotY: Math.PI / 2, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi_metro' },
    { x: -1058.0, z: -95.0,  rotY: Math.PI / 2, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi_metro' },
    { x: -1058.0, z: 65.0,   rotY: Math.PI / 2, color: 0x2563eb, roofColor: LEGO_COLORS.white, type: 'sedan_familiar' },
    { x: -1058.0, z: 95.0,   rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
    { x: -1212.0, z: 390.0,  rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    { x: -1212.0, z: 425.0,  rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    { x: -1212.0, z: 460.0,  rotY: 0, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    // Ala Militar Norte da Base Oeste (Pátio de Tanques no Canto Noroeste):
    { x: -1380.0, y: 0.3, z: -1115.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    { x: -1330.0, y: 0.3, z: -1115.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
    // Grande Ponte Blindada (2 Checkpoints do BOPE: Lado do Porto Z = 754 e Chegada na Prisão Z = 1094) + Setor 2 (Garagem Tática da Ilha da Prisão):
    { x: 1358.0, y: 0.3, z: 754.0,  rotY: 0,        color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 1363.5, y: 0.3, z: 754.0,  rotY: 0,        color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    { x: 1386.5, y: 0.3, z: 754.0,  rotY: 0,        color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
    { x: 1363.5, y: 0.3, z: 1094.0, rotY: Math.PI,  color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    { x: 1386.5, y: 0.3, z: 1094.0, rotY: Math.PI,  color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
    { x: 1392.0, y: 0.3, z: 1094.0, rotY: Math.PI,  color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
    { x: 1445.0, y: 0.3, z: 1315.0, rotY: 0,        color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
    { x: 1463.0, y: 0.3, z: 1315.0, rotY: 0,        color: 0x090a0d, roofColor: 0xfacc15, type: 'caveirao_bope' },
    { x: 1481.0, y: 0.3, z: 1315.0, rotY: 0,        color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
    { x: 1497.0, y: 0.3, z: 1315.0, rotY: 0,        color: LEGO_COLORS.black, roofColor: 0x2563eb, type: 'interceptor_v8' },
    { x: 1513.0, y: 0.3, z: 1315.0, rotY: 0,        color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
    { x: 1529.0, y: 0.3, z: 1315.0, rotY: 0,        color: 0x1e293b, roofColor: LEGO_COLORS.black, type: 'choque_pickup' }
  ];

  cars.forEach((cfg) => {
    const spec = VEHICLE_SPECS[cfg.type] || VEHICLE_SPECS.apex_gtx;
    const carGroup = createLegoCarMesh(cfg);
    const yBase = cfg.y ?? 0;
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
