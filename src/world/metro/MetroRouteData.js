// Dados da rota: recortes do piso, catálogo das estações e pontos do anel ferroviário.
import * as THREE from 'three';

// ============================================================================
// 1. RECORTES FÍSICOS NO PISO DA ILHA E CALÇADAS (`METRO_ISLAND_CUTOUTS`)
//    - ZERO corte em avenidas ou cruzamentos de carros!
//    - Escadarias longas de 28m nas calçadas descendo suavemente até Y = -10.5m!
//    - 2 Portais Blindados em praças exclusivas fora das pistas (X = ±82, Z = -196..-134)!
// ============================================================================
export const METRO_ISLAND_CUTOUTS = [
  // Estação 01 (Central / Super Banco) — Escadarias Amplas de 28m na Calçada Norte dos Blocos (±60, -58)
  {
    id: 'st01_west_stair',
    minX: -88.0,
    maxX: -60.0,
    minZ: -102.6,
    maxZ: -98.2,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(0.28, -10.5, THREE.MathUtils.clamp((-60.0 - x) / 28.0, 0, 1))
  },
  {
    id: 'st01_east_stair',
    minX: 60.0,
    maxX: 88.0,
    minZ: -102.6,
    maxZ: -98.2,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(0.28, -10.5, THREE.MathUtils.clamp((x - 60.0) / 28.0, 0, 1))
  },
  // Estação 02 (Times Square / Parque) — Escadaria Ampla de 28m na Calçada Norte do Bloco (-60, +68)
  {
    id: 'st02_stair',
    minX: -86.0,
    maxX: -58.0,
    minZ: 16.4,
    maxZ: 20.8,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(0.28, -10.5, THREE.MathUtils.clamp((-58.0 - x) / 28.0, 0, 1))
  },
  // Portal Blindado Oeste (Praça Lateral Oeste do Super Banco: X = -82, Z = -196..-134 — FORA de qualquer rua!)
  {
    id: 'west_plaza_portal',
    minX: -86.8,
    maxX: -77.2,
    minZ: -196.0,
    maxZ: -134.0,
    getFloorY: (_x, z) =>
      THREE.MathUtils.lerp(-11.2, 0.0, THREE.MathUtils.clamp((-134.0 - z) / 62.0, 0, 1))
  },
  // Portal Blindado Leste (Praça Lateral Leste do Super Banco: X = +82, Z = -196..-134 — FORA de qualquer rua!)
  {
    id: 'east_plaza_portal',
    minX: 77.2,
    maxX: 86.8,
    minZ: -196.0,
    maxZ: -134.0,
    getFloorY: (_x, z) =>
      THREE.MathUtils.lerp(0.0, -11.2, THREE.MathUtils.clamp((z - -196.0) / 62.0, 0, 1))
  },
  // Escadaria Larga Iluminada do Porão Bio-Genético na Torre dos Heróis (Ala Sudeste/Leste: Y = +0.36m -> Y = -8.2m!)
  {
    id: 'hero_tower_lab_stair',
    minX: -306.0,
    maxX: -282.0,
    minZ: -150.5,
    maxZ: -141.5,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(-8.2, 0.36, THREE.MathUtils.clamp((x - -306.0) / 24.0, 0, 1))
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
    z: -104,
    trackPos: { x: 0, y: -11.2, z: -116.0 },
    platformSpawn: { x: 0, y: -10.5, z: -101.5 },
    streetEntrance: { x: -60.0, y: 0.3, z: -100.4 },
    doorSide: 'left' // Indo para Oeste (-X): esquerda aponta para Sul (+Z = plataforma ampla de 22m!)
  },
  {
    id: 'metro_st_02',
    number: 2,
    code: 'M02',
    name: 'ESTAÇÃO TIMES SQUARE / PARQUE',
    shortName: 'METRÔ TIMES SQ.',
    kind: 'underground',
    x: -77,
    y: -10.5,
    z: 20,
    trackPos: { x: -93.0, y: -11.2, z: 20.0 },
    platformSpawn: { x: -77.5, y: -10.5, z: 20.0 },
    streetEntrance: { x: -58.0, y: 0.3, z: 18.6 },
    doorSide: 'left' // Indo para Sul (+Z): esquerda aponta para Leste (+X = plataforma ampla de 22m!)
  },
  {
    id: 'metro_st_03',
    number: 3,
    code: 'M03',
    name: 'ESTAÇÃO TORRE DOS HERÓIS',
    shortName: 'METRÔ TORRE',
    kind: 'elevated',
    x: -380,
    y: 14.85,
    z: -60,
    trackPos: { x: -388.5, y: 14.2, z: -60.0 },
    platformSpawn: { x: -379.87, y: 14.85, z: -60.0 },
    streetEntrance: { x: -368.0, y: 0.3, z: 8.0 },
    doorSide: 'left' // Indo para Sul (+Z): esquerda aponta para Leste (+X = plataforma de 12.5m!)
  },
  {
    id: 'metro_st_04',
    number: 4,
    code: 'M04',
    name: 'ESTAÇÃO ORLA MARÍTIMA / PRAIA SUL',
    shortName: 'METRÔ PRAIA SUL',
    kind: 'elevated',
    x: -117,
    y: 14.85,
    z: 650,
    trackPos: { x: -125.5, y: 14.2, z: 650.0 },
    platformSpawn: { x: -116.87, y: 14.85, z: 650.0 },
    streetEntrance: { x: -105.5, y: 0.3, z: 700.0 },
    doorSide: 'left' // Indo para Sul (+Z): esquerda aponta para Leste (+X = plataforma de 12.5m!)
  },
  {
    id: 'metro_st_05',
    number: 5,
    code: 'M05',
    name: 'ESTAÇÃO MARGEM DO RIO / DISTRITO LESTE',
    shortName: 'METRÔ RIO LESTE',
    kind: 'elevated',
    x: 509,
    y: 14.85,
    z: -180,
    trackPos: { x: 518.0, y: 14.2, z: -180.0 },
    platformSpawn: { x: 509.37, y: 14.85, z: -180.0 },
    streetEntrance: { x: 499.8, y: 0.3, z: -116.0 },
    doorSide: 'left' // Indo para Norte (-Z): esquerda aponta para Oeste (-X = plataforma de 12.5m!)
  }
];

/**
 * Anel Ferroviário Circular Contínuo (Subsolo Y = -11.2m <-> Elevado Y = +14.2m):
 * - Emerge e mergulha EXCLUSIVAMENTE nas 2 Praças Laterais fora das ruas (X = ±82, Z = -134..-236),
 *   atingindo Y >= +12.2m..+14.2m ANTES de cruzar a Avenida Z = -250!
 * - NENHUMA avenida ou cruzamento da cidade (Z = +134, X = +384, Z = -117, Z = -250) sofre corte!
 */
export const METRO_LOOP_WAYPOINTS = [
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
