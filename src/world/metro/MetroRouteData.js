// Dados da rota: recortes do piso, catálogo das estações e pontos do anel ferroviário.
import * as THREE from 'three';
import { IS_SCALED_WORLD, ROAD, ws } from '../core/WorldLayoutScale.js';

// ============================================================================
// DESLOCAMENTOS RÍGIDOS DE ESCALA (`1x` = 0 bit-a-bit; `3x` = ancorado nas novas avenidas de 34m + calçadas de 10m)
// Todas as dimensões das estações, plataformas, escadarias, recortes e alturas Y permanecem estritamente 1x!
// ============================================================================
const ST01_DZ = IS_SCALED_WORLD ? ws(-117) + ROAD.mainWidth * 0.5 + 3.0 - -102.6 : 0; // -228.4 em 3x (boca em Z=-331.0..-326.6, >=20m do eixo Z=-351)
const ST02_DX = IS_SCALED_WORLD ? ws(-77) - -77 : 0; // -154.0 em 3x (centro em X=ws(-77)=-231)
const ST02_DZ = IS_SCALED_WORLD ? ws(20) - 20 : 0;   // +40.0 em 3x (centro em Z=ws(20)=+60)
const ST02_CUT_MIN_Z = IS_SCALED_WORLD ? ws(0) + ROAD.mainWidth * 0.5 + 2.8 : 16.4; // +19.8 em 3x (>=19.8m do eixo Z=0)
const PORTAL_WEST_X = IS_SCALED_WORLD ? ws(-82) : -82; // -246 em 3x
const PORTAL_EAST_X = IS_SCALED_WORLD ? ws(82) : 82;   // +246 em 3x
const PORTAL_AVE_SOUTH_CURB_DZ = IS_SCALED_WORLD ? ws(-250) + ROAD.mainWidth * 0.5 - (-250 + 14.0) : 0; // -497.0 em 3x
const PORTAL_DZ = IS_SCALED_WORLD ? PORTAL_AVE_SOUTH_CURB_DZ + 18.0 : 0; // -479.0 em 3x (recua rampa 18m para sul dentro da praça!)
const HERO_LAB_DX = IS_SCALED_WORLD ? ws(-324) - -324 : 0;
const HERO_LAB_DZ = IS_SCALED_WORLD ? ws(-168) - -168 : 0;

const M03_TRACK_X = IS_SCALED_WORLD ? ws(-384) - 4.5 : -388.5;
const M03_TRACK_Z = IS_SCALED_WORLD ? ws(-60) : -60.0;
const M04_TRACK_X = IS_SCALED_WORLD ? ws(-120) - 5.5 : -125.5;
const M04_TRACK_Z = IS_SCALED_WORLD ? ws(650) : 650.0;
const M05_TRACK_X = IS_SCALED_WORLD ? ws(516) + 2.0 : 518.0;
const M05_TRACK_Z = IS_SCALED_WORLD ? ws(-180) : -180.0;

export const METRO_OFFSETS = Object.freeze({
  st01Dx: 0,
  st01Dz: ST01_DZ,
  st02Dx: ST02_DX,
  st02Dz: ST02_DZ,
  portalWestX: PORTAL_WEST_X,
  portalEastX: PORTAL_EAST_X,
  portalDz: PORTAL_DZ
});

// ============================================================================
// 1. RECORTES FÍSICOS NO PISO DA ILHA E CALÇADAS (`METRO_ISLAND_CUTOUTS`)
//    - ZERO corte em avenidas ou cruzamentos de carros!
//    - Escadarias longas de 28m nas calçadas descendo suavemente até Y = -10.5m!
//    - 2 Portais Blindados em praças exclusivas fora das pistas!
// ============================================================================
const STAIR_TOP_Y = IS_SCALED_WORLD ? ROAD.curbHeight : 0.28;

export const METRO_ISLAND_CUTOUTS = [
  // Estação 01 (Central / Super Banco) — Escadarias Amplas de 28m x 4.4m na Calçada Norte
  {
    id: 'st01_west_stair',
    minX: -88.0,
    maxX: -60.0,
    minZ: -102.6 + ST01_DZ,
    maxZ: -98.2 + ST01_DZ,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(STAIR_TOP_Y, -10.5, THREE.MathUtils.clamp((-60.0 - x) / 28.0, 0, 1))
  },
  {
    id: 'st01_east_stair',
    minX: 60.0,
    maxX: 88.0,
    minZ: -102.6 + ST01_DZ,
    maxZ: -98.2 + ST01_DZ,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(STAIR_TOP_Y, -10.5, THREE.MathUtils.clamp((x - 60.0) / 28.0, 0, 1))
  },
  // Estação 02 (Times Square / Parque) — Escadaria Ampla de 28m x 4.4m na Calçada Norte
  {
    id: 'st02_stair',
    minX: -86.0 + ST02_DX,
    maxX: -58.0 + ST02_DX,
    minZ: ST02_CUT_MIN_Z,
    maxZ: ST02_CUT_MIN_Z + 4.4,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(
        STAIR_TOP_Y,
        -10.5,
        THREE.MathUtils.clamp((-58.0 + ST02_DX - x) / 28.0, 0, 1)
      )
  },
  // Portal Blindado Oeste (Praça Lateral Oeste do Super Banco — 9.6m x 62.0m, FORA de qualquer rua!)
  {
    id: 'west_plaza_portal',
    minX: PORTAL_WEST_X - 4.8,
    maxX: PORTAL_WEST_X + 4.8,
    minZ: -196.0 + PORTAL_DZ,
    maxZ: -134.0 + PORTAL_DZ,
    getFloorY: (_x, z) =>
      THREE.MathUtils.lerp(
        -11.2,
        0.0,
        THREE.MathUtils.clamp((-134.0 + PORTAL_DZ - z) / 62.0, 0, 1)
      )
  },
  // Portal Blindado Leste (Praça Lateral Leste do Super Banco — 9.6m x 62.0m, FORA de qualquer rua!)
  {
    id: 'east_plaza_portal',
    minX: PORTAL_EAST_X - 4.8,
    maxX: PORTAL_EAST_X + 4.8,
    minZ: -196.0 + PORTAL_DZ,
    maxZ: -134.0 + PORTAL_DZ,
    getFloorY: (_x, z) =>
      THREE.MathUtils.lerp(
        0.0,
        -11.2,
        THREE.MathUtils.clamp((z - (-196.0 + PORTAL_DZ)) / 62.0, 0, 1)
      )
  },
  // Escadaria Larga Iluminada do Porão Bio-Genético na Torre dos Heróis (24m x 9m, Y = +0.36m -> Y = -8.2m!)
  {
    id: 'hero_tower_lab_stair',
    minX: -306.0 + HERO_LAB_DX,
    maxX: -282.0 + HERO_LAB_DX,
    minZ: -150.5 + HERO_LAB_DZ,
    maxZ: -141.5 + HERO_LAB_DZ,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(
        -8.2,
        0.36,
        THREE.MathUtils.clamp((x - (-306.0 + HERO_LAB_DX)) / 24.0, 0, 1)
      )
  }
];

/**
 * Catálogo Oficial das 5 Estações da Linha 01 Circular do Metrô LEGO
 * - Subterrâneas: Piso em Y = -10.5m (Pé-direito monumental de 9.6m, largura útil 22.0m!)
 * - Elevadas: Piso em Y = +14.85m (Plataforma de 12.5m x 62m, cobertura alta a +23.65m = 8.8m livres!)
 */
export const METRO_STATIONS = [
  {
    id: 'metro_st_01',
    number: 1,
    code: 'M01',
    name: 'ESTAÇÃO CENTRAL / SUPER BANCO',
    shortName: 'METRÔ CENTRAL',
    kind: 'underground',
    x: 0,
    y: -10.5,
    z: -104 + ST01_DZ,
    trackPos: { x: 0, y: -11.2, z: -116.0 + ST01_DZ },
    platformSpawn: { x: 0, y: -10.5, z: -101.5 + ST01_DZ },
    streetEntrance: { x: -60.0, y: IS_SCALED_WORLD ? ROAD.curbHeight + 0.02 : 0.3, z: -100.4 + ST01_DZ },
    doorSide: 'left'
  },
  {
    id: 'metro_st_02',
    number: 2,
    code: 'M02',
    name: 'ESTAÇÃO TIMES SQUARE / PARQUE',
    shortName: 'METRÔ TIMES SQ.',
    kind: 'underground',
    x: -77 + ST02_DX,
    y: -10.5,
    z: 20 + ST02_DZ,
    trackPos: { x: -93.0 + ST02_DX, y: -11.2, z: 20.0 + ST02_DZ },
    platformSpawn: { x: -77.5 + ST02_DX, y: -10.5, z: 20.0 + ST02_DZ },
    streetEntrance: {
      x: -58.0 + ST02_DX,
      y: IS_SCALED_WORLD ? ROAD.curbHeight + 0.02 : 0.3,
      z: IS_SCALED_WORLD ? ST02_CUT_MIN_Z + 2.2 : 18.6
    },
    doorSide: 'left'
  },
  {
    id: 'metro_st_03',
    number: 3,
    code: 'M03',
    name: 'ESTAÇÃO TORRE DOS HERÓIS',
    shortName: 'METRÔ TORRE',
    kind: 'elevated',
    x: IS_SCALED_WORLD ? Math.round(M03_TRACK_X + 8.63) : -380,
    y: 14.85,
    z: M03_TRACK_Z,
    trackPos: { x: M03_TRACK_X, y: 14.2, z: M03_TRACK_Z },
    platformSpawn: { x: M03_TRACK_X + 8.63, y: 14.85, z: M03_TRACK_Z },
    streetEntrance: { x: M03_TRACK_X + 20.5, y: 0.3, z: M03_TRACK_Z + 68.0 },
    doorSide: 'left'
  },
  {
    id: 'metro_st_04',
    number: 4,
    code: 'M04',
    name: 'ESTAÇÃO ORLA MARÍTIMA / PRAIA SUL',
    shortName: 'METRÔ PRAIA SUL',
    kind: 'elevated',
    x: IS_SCALED_WORLD ? Math.round(M04_TRACK_X + 8.63) : -117,
    y: 14.85,
    z: M04_TRACK_Z,
    trackPos: { x: M04_TRACK_X, y: 14.2, z: M04_TRACK_Z },
    platformSpawn: { x: M04_TRACK_X + 8.63, y: 14.85, z: M04_TRACK_Z },
    streetEntrance: { x: M04_TRACK_X + 20.0, y: 0.3, z: M04_TRACK_Z + 50.0 },
    doorSide: 'left'
  },
  {
    id: 'metro_st_05',
    number: 5,
    code: 'M05',
    name: 'ESTAÇÃO MARGEM DO RIO / DISTRITO LESTE',
    shortName: 'METRÔ RIO LESTE',
    kind: 'elevated',
    x: IS_SCALED_WORLD ? Math.round(M05_TRACK_X - 8.63) : 509,
    y: 14.85,
    z: M05_TRACK_Z,
    trackPos: { x: M05_TRACK_X, y: 14.2, z: M05_TRACK_Z },
    platformSpawn: { x: M05_TRACK_X - 8.63, y: 14.85, z: M05_TRACK_Z },
    streetEntrance: { x: M05_TRACK_X - 18.2, y: 0.3, z: M05_TRACK_Z + 64.0 },
    doorSide: 'left'
  }
];

const WAYPOINTS_1X = [
  // 1) Trecho Subterrâneo Monumental (Leito Y = -11.2m; Piso das plataformas = -10.5m!)
  { x: 66, y: -11.2, z: -116.0, underground: true },
  { x: 0, y: -11.2, z: -116.0, underground: true },        // [M01: ESTAÇÃO CENTRAL / SUPER BANCO]
  { x: -76, y: -11.2, z: -116.0, underground: true },
  { x: -93, y: -11.2, z: -98.0, underground: true },
  { x: -93, y: -11.2, z: 20.0, underground: true },        // [M02: ESTAÇÃO TIMES SQUARE / PARQUE]
  { x: -93, y: -11.2, z: 58.0, underground: true },
  { x: -110, y: -11.2, z: 74.0, underground: true },
  { x: -152, y: -11.2, z: 74.0, underground: true },
  { x: -168, y: -11.2, z: 58.0, underground: true },
  { x: -168, y: -11.2, z: -114.0, underground: true },
  { x: -152, y: -11.2, z: -129.0, underground: true },
  { x: -98, y: -11.2, z: -129.0, underground: true },

  // 2) Rampa Blindada Portal Oeste na Praça Lateral (X = -82, Z = -136 -> -236, fora de ruas!)
  { x: -82, y: -11.2, z: -136.0, portal: true },
  { x: -82, y: 0.0, z: -186.0, portal: true },
  { x: -82, y: 12.2, z: -234.0, portal: true },
  { x: -98, y: 14.2, z: -250.0, elevated: true },

  // 3) Linha Elevada Estilo Manhattan / Spider-Man (Y = +14.2m — Acima de todos os viadutos e avenidas!)
  { x: -372, y: 14.2, z: -250.0, elevated: true },
  { x: -388.5, y: 14.2, z: -234.0, elevated: true },
  { x: -388.5, y: 14.2, z: -60.0, elevated: true },       // [M03: ESTAÇÃO TORRE DOS HERÓIS]
  { x: -388.5, y: 14.2, z: 118.0, elevated: true },
  { x: -404, y: 14.2, z: 134.0, elevated: true },
  { x: -500, y: 14.2, z: 134.0, elevated: true },
  { x: -516, y: 14.2, z: 150.0, elevated: true },
  { x: -516, y: 17.6, z: 540.0, elevated: true },
  { x: -500, y: 17.6, z: 556.0, elevated: true },
  { x: -142, y: 17.6, z: 556.0, elevated: true },
  { x: -125.5, y: 16.0, z: 588.0, elevated: true },
  { x: -125.5, y: 14.2, z: 618.0, elevated: true },
  { x: -125.5, y: 14.2, z: 650.0, elevated: true },       // [M04: ESTAÇÃO ORLA MARÍTIMA / PRAIA SUL]
  { x: -125.5, y: 14.2, z: 694.0, elevated: true },
  { x: -109, y: 14.2, z: 710.0, elevated: true },
  { x: 502, y: 14.2, z: 710.0, elevated: true },
  { x: 518.0, y: 14.2, z: 694.0, elevated: true },
  { x: 518.0, y: 14.2, z: -180.0, elevated: true },       // [M05: ESTAÇÃO MARGEM DO RIO / DISTRITO LESTE]
  { x: 518.0, y: 14.2, z: -234.0, elevated: true },
  { x: 502, y: 14.2, z: -250.0, elevated: true },
  { x: 98, y: 14.2, z: -250.0, elevated: true },

  // 4) Rampa Blindada Portal Leste na Praça Lateral (X = +82, Z = -234 -> -136, fora de ruas!)
  { x: 82, y: 12.2, z: -234.0, portal: true },
  { x: 82, y: 0.0, z: -186.0, portal: true },
  { x: 82, y: -11.2, z: -136.0, portal: true }
];

function buildScaledLoopWaypoints() {
  const m01Z = -116.0 + ST01_DZ;          // -344.4
  const m02X = -93.0 + ST02_DX;           // -247.0
  const m02Z = 20.0 + ST02_DZ;            // +60.0
  const m02SouthZ = 64.0 + ST02_DZ;       // +104.0
  const loopSouthZ = m02SouthZ + 8.0;     // +112.0
  const westLoopX = ws(-134);             // -402.0 (livre de laboratórios subterrâneos)
  const portalBotZ = -136.0 + PORTAL_DZ;  // -615.0
  const portalZeroZ = -186.0 + PORTAL_DZ; // -665.0
  const portalRampTopZ = -234.0 + PORTAL_DZ; // -713.0 (100% fora da avenida Z=ws(-250)!)
  const portalElevJoinZ = -234.0 + PORTAL_AVE_SOUTH_CURB_DZ; // -731.0 (já em cota elevada plena antes da avenida!)
  const loopNorthUnderZ = portalBotZ + 16.0; // -599.0

  const zNorthAve = ws(-250); // -750.0
  const zParkAve = ws(134);   // +402.0
  const xWestSec = ws(-516);  // -1548.0
  const zSouthSec = ws(556);  // +1668.0
  const zBeachAve = ws(710);  // +2130.0

  return [
    // 1) Trecho Subterrâneo (Portal Leste -> M01 -> M02 -> Alça Oeste -> Portal Oeste; Y = -11.2m)
    { x: PORTAL_EAST_X, y: -11.2, z: m01Z - 16.0, underground: true },
    { x: PORTAL_EAST_X - 16.0, y: -11.2, z: m01Z, underground: true },
    { x: 66.0, y: -11.2, z: m01Z, underground: true },
    { x: 0.0, y: -11.2, z: m01Z, underground: true },        // [M01: ESTAÇÃO CENTRAL / SUPER BANCO]
    { x: -76.0, y: -11.2, z: m01Z, underground: true },
    { x: m02X + 16.0, y: -11.2, z: m01Z, underground: true },
    { x: m02X, y: -11.2, z: m01Z + 16.0, underground: true },
    { x: m02X, y: -11.2, z: m02Z, underground: true },       // [M02: ESTAÇÃO TIMES SQUARE / PARQUE]
    { x: m02X, y: -11.2, z: loopSouthZ - 14.0, underground: true },
    { x: m02X - 16.0, y: -11.2, z: loopSouthZ, underground: true },
    { x: westLoopX + 16.0, y: -11.2, z: loopSouthZ, underground: true },
    { x: westLoopX, y: -11.2, z: loopSouthZ - 16.0, underground: true },
    { x: westLoopX, y: -11.2, z: loopNorthUnderZ + 16.0, underground: true },
    { x: westLoopX + 16.0, y: -11.2, z: loopNorthUnderZ, underground: true },
    { x: PORTAL_WEST_X - 16.0, y: -11.2, z: loopNorthUnderZ, underground: true },

    // 2) Rampa Blindada Portal Oeste na Praça Lateral (X = ws(-82), fora de qualquer rua!)
    { x: PORTAL_WEST_X, y: -11.2, z: portalBotZ, portal: true },
    { x: PORTAL_WEST_X, y: 0.0, z: portalZeroZ, portal: true },
    { x: PORTAL_WEST_X, y: 11.8, z: portalRampTopZ, portal: true },
    { x: PORTAL_WEST_X, y: 14.2, z: portalElevJoinZ, elevated: true },
    { x: PORTAL_WEST_X - 18.0, y: 14.2, z: zNorthAve, elevated: true },

    // 3) Linha Elevada Circular (alturas Y estritamente 1x, chanfros de 16m sobre cruzamentos!)
    { x: M03_TRACK_X + 16.5, y: 14.2, z: zNorthAve, elevated: true },
    { x: M03_TRACK_X, y: 14.2, z: zNorthAve + 16.0, elevated: true },
    { x: M03_TRACK_X, y: 14.2, z: M03_TRACK_Z, elevated: true }, // [M03: ESTAÇÃO TORRE DOS HERÓIS]
    { x: M03_TRACK_X, y: 14.2, z: zParkAve - 16.0, elevated: true },
    { x: M03_TRACK_X - 15.5, y: 14.2, z: zParkAve, elevated: true },
    { x: xWestSec + 16.0, y: 14.2, z: zParkAve, elevated: true },
    { x: xWestSec, y: 14.2, z: zParkAve + 16.0, elevated: true },
    { x: xWestSec, y: 17.6, z: zSouthSec - 16.0, elevated: true },
    { x: xWestSec + 16.0, y: 17.6, z: zSouthSec, elevated: true },
    { x: M04_TRACK_X - 16.5, y: 17.6, z: zSouthSec, elevated: true },
    { x: M04_TRACK_X, y: 16.0, z: zSouthSec + 32.0, elevated: true },
    { x: M04_TRACK_X, y: 14.2, z: M04_TRACK_Z - 32.0, elevated: true },
    { x: M04_TRACK_X, y: 14.2, z: M04_TRACK_Z, elevated: true }, // [M04: ESTAÇÃO PRAIA SUL]
    { x: M04_TRACK_X, y: 14.2, z: zBeachAve - 16.0, elevated: true },
    { x: M04_TRACK_X + 16.5, y: 14.2, z: zBeachAve, elevated: true },
    { x: M05_TRACK_X - 16.0, y: 14.2, z: zBeachAve, elevated: true },
    { x: M05_TRACK_X, y: 14.2, z: zBeachAve - 16.0, elevated: true },
    { x: M05_TRACK_X, y: 14.2, z: M05_TRACK_Z, elevated: true }, // [M05: ESTAÇÃO RIO LESTE]
    { x: M05_TRACK_X, y: 14.2, z: zNorthAve + 16.0, elevated: true },
    { x: M05_TRACK_X - 16.0, y: 14.2, z: zNorthAve, elevated: true },
    { x: PORTAL_EAST_X + 18.0, y: 14.2, z: zNorthAve, elevated: true },
    { x: PORTAL_EAST_X, y: 14.2, z: portalElevJoinZ, elevated: true },

    // 4) Rampa Blindada Portal Leste na Praça Lateral (X = ws(+82), fora de qualquer rua!)
    { x: PORTAL_EAST_X, y: 11.8, z: portalRampTopZ, portal: true },
    { x: PORTAL_EAST_X, y: 0.0, z: portalZeroZ, portal: true },
    { x: PORTAL_EAST_X, y: -11.2, z: portalBotZ, portal: true }
  ];
}

export const METRO_LOOP_WAYPOINTS = IS_SCALED_WORLD ? buildScaledLoopWaypoints() : WAYPOINTS_1X;

export function sliceRectAroundCutouts(bounds, cutouts = METRO_ISLAND_CUTOUTS) {
  let rects = [{ ...bounds }];
  for (const cut of cutouts) {
    const next = [];
    for (const r of rects) {
      if (
        cut.maxX <= r.minX ||
        cut.minX >= r.maxX ||
        cut.maxZ <= r.minZ ||
        cut.minZ >= r.maxZ
      ) {
        next.push(r);
        continue;
      }
      if (cut.minX > r.minX) {
        next.push({ minX: r.minX, maxX: cut.minX, minZ: r.minZ, maxZ: r.maxZ });
      }
      if (cut.maxX < r.maxX) {
        next.push({ minX: cut.maxX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ });
      }
      const overlapMinX = Math.max(r.minX, cut.minX);
      const overlapMaxX = Math.min(r.maxX, cut.maxX);
      if (cut.minZ > r.minZ) {
        next.push({ minX: overlapMinX, maxX: overlapMaxX, minZ: r.minZ, maxZ: cut.minZ });
      }
      if (cut.maxZ < r.maxZ) {
        next.push({ minX: overlapMinX, maxX: overlapMaxX, minZ: cut.maxZ, maxZ: r.maxZ });
      }
    }
    rects = next;
  }
  return rects;
}

export function getMetroCutoutFloorY(x, z) {
  for (let i = 0; i < METRO_ISLAND_CUTOUTS.length; i++) {
    const c = METRO_ISLAND_CUTOUTS[i];
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
      return c.getFloorY(x, z);
    }
  }
  return null;
}
