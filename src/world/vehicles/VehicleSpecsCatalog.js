/**
 * VehicleSpecsCatalog.js
 * Catálogo oficial de especificações físicas, velocidades, HP, armas e espólios (studs)
 * da frota terrestre urbana, tática, facções e pesados.
 */

/**
 * Escala Oficial de Velocidade:
 * - Boneco correndo a pé = ~14 un/s = 45 km/h (fator = 45 / 14 ≈ 3.2142857 km/h por un/s)
 */
export const KMH_TO_UNITS = 14 / 45;
export const UNITS_TO_KMH = 45 / 14;

/**
 * Conjunto de IDs pertencentes à frota tática (Polícia / BOPE / Exército) e às 3 facções (CV / PCC / A.R.E.S.).
 */
export const TACTICAL_AND_FACTION_TYPES = new Set([
  'caveirao_bope',
  'interceptor_v8',
  'choque_pickup',
  'moto_policia',
  'moto_cv',
  'moto_pcc',
  'picape_cv',
  'suv_pcc',
  'van_pcc',
  'hover_apc_ares',
  'tanque_titan'
]);

/**
 * CATÁLOGO OFICIAL DOS VEÍCULOS LEGO 3D (DIVIDIDOS NOS 4 GRUPOS TERRESTRES)
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
