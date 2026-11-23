/**
 * OrganicDowntownNetworkSpec.js
 * Fachada fina retrocompatível da Malha Viária Orgânica do Centro, Transição Norte & Conectores
 * Unificados da Ilha (`WORLD_SCALE = 3`), delegando a fonte única de verdade para `CityRoadNetworkSpec.js`.
 */

import {
  DOWNTOWN_GRID_COLS_DESIGN,
  DOWNTOWN_GRID_ROWS_DESIGN,
  ROAD_HIERARCHY_TIERS,
  ROAD_TIER_SPECS,
  getDowntownProtectedKeepouts,
  getSuperBlockAsphaltFreeBounds,
  getUnifiedCityRoadNetwork,
  computeRoadNetworkDiagnostics
} from './CityRoadNetworkSpec.js';

export {
  DOWNTOWN_GRID_COLS_DESIGN,
  DOWNTOWN_GRID_ROWS_DESIGN,
  ROAD_HIERARCHY_TIERS,
  ROAD_TIER_SPECS,
  getDowntownProtectedKeepouts,
  getSuperBlockAsphaltFreeBounds,
  getUnifiedCityRoadNetwork,
  computeRoadNetworkDiagnostics
};

/**
 * Retorna a rede orgânica completa (polilinhas, rotatórias, segmentos, esquinas Flatiron,
 * keepouts protegidos, praças triangulares `triangularPlazas` e níveis `tiers`).
 */
export function getDowntownOrganicNetwork() {
  const unified = getUnifiedCityRoadNetwork();
  return {
    polylines: unified.polylines,
    roundabouts: unified.roundabouts,
    segments: unified.segments,
    flatironCorners: unified.flatironCorners,
    keepouts: unified.keepouts,
    triangularPlazas: unified.triangularPlazas,
    tiers: unified.tiers
  };
}

/**
 * Filtra os segmentos orgânicos, rotatórias, Flatirons, praças triangulares e keepouts que
 * interceptam um retângulo de consulta (incluindo proteção automática das praças triangulares
 * para que `BlockLotFiller` nunca posicione arranha-céus sobre as ilhas paisagísticas!).
 */
export function queryOrganicFeaturesInBounds(minX, maxX, minZ, maxZ, pad = 28) {
  const net = getUnifiedCityRoadNetwork();
  const qMinX = minX - pad;
  const qMaxX = maxX + pad;
  const qMinZ = minZ - pad;
  const qMaxZ = maxZ + pad;

  const triangularPlazas = net.triangularPlazas.filter(
    (p) => p.maxX >= qMinX && p.minX <= qMaxX && p.maxZ >= qMinZ && p.minZ <= qMaxZ
  );

  const plazaKeepouts = triangularPlazas.map((p) => ({
    id: `plaza_keepout_${p.id}`,
    minX: p.minX - 3.5,
    maxX: p.maxX + 3.5,
    minZ: p.minZ - 3.5,
    maxZ: p.maxZ + 3.5
  }));

  const baseKeepouts = net.keepouts.filter(
    (k) => k.maxX >= qMinX && k.minX <= qMaxX && k.maxZ >= qMinZ && k.minZ <= qMaxZ
  );

  return {
    segments: net.segments.filter(
      (s) => s.maxX >= qMinX && s.minX <= qMaxX && s.maxZ >= qMinZ && s.minZ <= qMaxZ
    ),
    roundabouts: net.roundabouts.filter(
      (r) =>
        r.cx + r.outerR + r.sidewalk >= qMinX &&
        r.cx - r.outerR - r.sidewalk <= qMaxX &&
        r.cz + r.outerR + r.sidewalk >= qMinZ &&
        r.cz - r.outerR - r.sidewalk <= qMaxZ
    ),
    flatironCorners: net.flatironCorners.filter(
      (f) => f.cx >= qMinX && f.cx <= qMaxX && f.cz >= qMinZ && f.cz <= qMaxZ
    ),
    triangularPlazas,
    keepouts: plazaKeepouts.length > 0 ? [...baseKeepouts, ...plazaKeepouts] : baseKeepouts
  };
}
