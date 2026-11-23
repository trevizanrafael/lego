import { IS_SCALED_WORLD, ws } from '../core/WorldLayoutScale.js';

/**
 * PursuitTuning.js
 * Fonte única da verdade (Single Source of Truth) para todos os parâmetros
 * táticos, orçamentos por estrela, cones de visão, busca GTA V e bases aéreas
 * da reformulação realista do sistema de perseguição policial (BOPE / Águia / Exército).
 */

export const PURSUIT_STATES = Object.freeze({
  CLEAN: 'CLEAN',
  ALERT: 'ALERT',
  PURSUIT: 'PURSUIT',
  SEARCH: 'SEARCH'
});

/**
 * Limites horizontais escalados do mapa para despacho e contenção segura sem clipar na cidade 3x.
 */
export const PURSUIT_WORLD_BOUNDS = Object.freeze({
  minX: ws(-1850),
  maxX: ws(1750),
  minZ: ws(-1850),
  maxZ: ws(1950)
});

/**
 * Tempo necessário fora de TODOS os cones policiais para limpar o nível de procurado (estritamente ×1):
 * 1★ = 25s | 2★ = 40s | 3★ = 55s | 4★ = 70s | 5★ = 85s
 */
export const SEARCH_DURATION_BY_STAR = Object.freeze([0, 25, 40, 55, 70, 85]);

/**
 * Orçamento máximo simultâneo de forças táticas realistas por nível de procurado (0★–5★).
 * Sem exo-drones sci-fi: escalada realista PM -> Interceptor -> Águia -> BOPE -> Exército (Tanques).
 */
export const STAR_FORCE_BUDGET = Object.freeze({
  0: Object.freeze({ cars: 0, foot: 0, helis: 0, tanks: 0 }),
  1: Object.freeze({ cars: 2, foot: 2, helis: 0, tanks: 0, arrestOnlyUnarmed: true }),
  2: Object.freeze({ cars: 4, foot: 4, helis: 0, tanks: 0 }),
  3: Object.freeze({ cars: 5, foot: 6, helis: 1, tanks: 0, roadblocks: true }),
  4: Object.freeze({
    cars: 6,
    foot: 8,
    helis: 2,
    tanks: 0,
    roadblocks: true,
    heliSnipers: true
  }),
  5: Object.freeze({
    cars: 6,
    foot: 10,
    helis: 2,
    tanks: 2,
    roadblocks: true,
    heliSnipers: true
  })
});

/**
 * Geometria real de percepção 2D/3D das unidades terrestres e aéreas (metros reais ×1),
 * penalidade noturna (-30%) e cadência escalonada (Round-Robin) a 60 FPS.
 */
export const VISION_CONES = Object.freeze({
  foot: Object.freeze({
    range: 45,
    angleDeg: 120,
    hearingRange: 60
  }),
  car: Object.freeze({
    range: 70,
    angleDeg: 100,
    proximity360: 15
  }),
  heli: Object.freeze({
    groundRadius: 40,
    maxHorizontalDist: 195
  }),
  nightRangeMultiplier: 0.70,
  checkIntervalMinSec: 0.15,
  checkIntervalMaxSec: 0.25
});

/**
 * Limites verticais e constantes trigonométricas pré-calculadas dos cones
 * para evitar recomputações trigonométricas desnecessárias no loop de 60 FPS.
 */
export const VISION_PRECOMPUTED = Object.freeze({
  footMaxVerticalDelta: 14.0,
  carMaxVerticalDelta: 18.0,
  footFovRad: (VISION_CONES.foot.angleDeg * Math.PI) / 180,
  carFovRad: (VISION_CONES.car.angleDeg * Math.PI) / 180,
  footHalfAngleCos: Math.cos((VISION_CONES.foot.angleDeg * Math.PI) / 360),
  carHalfAngleCos: Math.cos((VISION_CONES.car.angleDeg * Math.PI) / 360)
});

/**
 * Regras de despacho e reciclagem fora do campo visual imediato do jogador (metros reais ×1).
 */
export const DISPATCH_RULES = Object.freeze({
  minSpawnDist: 120,
  maxSpawnDist: 195,
  despawnBehindDist: 250,
  maxCatchupBonus: 0.15,
  searchBudgetFactor: 0.5
});

const HELIPAD_BASES_1X = Object.freeze([
  Object.freeze({ id: 'central_precinct', label: 'Delegacia Central', x: 0, y: 54, z: -88 }),
  Object.freeze({ id: 'west_airbase', label: 'Base Aérea Oeste', x: -690, y: 28, z: -80 }),
  Object.freeze({ id: 'east_port', label: 'Capitania do Porto', x: 420, y: 34, z: 120 }),
  Object.freeze({ id: 'north_precinct', label: 'Batalhão Norte', x: -80, y: 32, z: -540 }),
  Object.freeze({ id: 'prison_island', label: 'Penitenciária Sudeste', x: 720, y: 38, z: 520 })
]);

// Em escala 3x: coordenadas X/Z seguem as montagens rígidas reais de cada região; altitudes Y permanecem estritamente ×1!
const HELIPAD_BASES_SCALED = Object.freeze([
  Object.freeze({ id: 'central_precinct', label: 'Heliponto Torre dos Heróis', x: ws(-324) + 6, y: 310.8, z: ws(-168) - 12 }),
  Object.freeze({ id: 'west_airbase', label: 'Base Aérea & Militar Oeste', x: ws(-1340), y: 1.0, z: 0 }),
  Object.freeze({ id: 'east_port', label: 'Cidadela Industrial & Porto Leste', x: ws(866), y: 112.3, z: ws(-316) - 47 }),
  Object.freeze({ id: 'prison_island', label: 'Cidadela da Ilha da Prisão', x: ws(1375) - 23, y: 126.8, z: ws(1540) }),
  Object.freeze({ id: 'sky_helicarrier', label: 'Aeroporta-Aviões no Céu', x: 0, y: 410.5, z: ws(-50) })
]);

/**
 * Dinâmica de voo, autonomia (estritamente ×1: 55 m/s) e helipontos oficiais dos helicópteros Águia/BOPE.
 */
export const HELI_TUNING = Object.freeze({
  maxSpeed: 55.0,
  accel: 26.0,
  turnRateRad: 1.65,
  minAltAboveGround: 42.0,
  maxAltAboveGround: 58.0,
  respawnCooldownSec: 28.0,
  maxSearchFuelSec: 180.0,
  bases: IS_SCALED_WORLD ? HELIPAD_BASES_SCALED : HELIPAD_BASES_1X
});

/**
 * Janela de reação de testemunhas civis (ligação 190 interrompível antes da viatura ser acionada).
 */
export const WITNESS_TUNING = Object.freeze({
  callDelayMinSec: 4.0,
  callDelayMaxSec: 8.0,
  maxWitnessRange: 52.0
});

/**
 * Retorna a duração exata de busca (SEARCH) para uma quantidade de estrelas (1★–5★).
 */
export function getSearchDurationForStars(stars) {
  const clamped = Math.max(0, Math.min(5, Math.floor(stars || 0)));
  return SEARCH_DURATION_BY_STAR[clamped] || SEARCH_DURATION_BY_STAR[1];
}

/**
 * Retorna o orçamento tático congelado correspondente ao nível de estrelas atual.
 */
export function getStarForceBudget(stars) {
  const clamped = Math.max(0, Math.min(5, Math.floor(stars || 0)));
  return STAR_FORCE_BUDGET[clamped] || STAR_FORCE_BUDGET[0];
}

/**
 * Localiza o heliponto policial/militar mais próximo de uma posição `(x, z)`.
 */
export function getNearestHeliBase(x = 0, z = 0) {
  let best = HELI_TUNING.bases[0];
  let bestDistSq = Infinity;
  for (let i = 0; i < HELI_TUNING.bases.length; i++) {
    const base = HELI_TUNING.bases[i];
    const dx = base.x - x;
    const dz = base.z - z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = base;
    }
  }
  return best;
}
