/**
 * ParkedCarsSpawner.js
 * Submódulo de frota estacionada e especificações veiculares da malha urbana.
 * Centraliza o contrato de vagas de rua, estacionamentos e malha 3D de veículos
 * consumido pela fachada `StreetPropsBuilder.js` e por `TestBlockWorld`.
 */

import {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  resolveParkedCarsLayout,
  buildParkedLegoCars as spawnFleetParkedLegoCars,
  createLegoCarMesh
} from '../VehicleFleetBuilder.js';
import { IS_SCALED_WORLD, ROAD } from '../core/WorldLayoutScale.js';

export {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  createLegoCarMesh
};

function _computeCarFootprint(cfg) {
  const spec = VEHICLE_SPECS[cfg.type] || VEHICLE_SPECS.apex_gtx;
  const isRotated90 = Math.abs(Math.sin(cfg.rotY || 0)) > 0.7;
  const isMoto = Boolean(spec?.isMotorcycle);
  const baseW = isMoto ? 1.45 : cfg.type === 'tanque_titan' ? 3.8 : 2.5;
  const baseD = isMoto ? 3.8 : cfg.type === 'tanque_titan' ? 5.9 : 5.0;
  return {
    w: isRotated90 ? baseD : baseW,
    d: isRotated90 ? baseW : baseD
  };
}

function _isOnUrbanPedestrianSidewalk(world, x, z) {
  if (!world?._urbanBlockGrid) return false;
  const gx = Math.floor(x / 128);
  const gz = Math.floor(z / 128);
  const list = world._urbanBlockGrid.get(`${gx},${gz}`);
  if (!list) return false;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (x <= b.minX || x >= b.maxX || z <= b.minZ || z >= b.maxZ) continue;
    const dxEdge = Math.min(x - b.minX, b.maxX - x);
    const dzEdge = Math.min(z - b.minZ, b.maxZ - z);
    if (Math.min(dxEdge, dzEdge) <= ROAD.sidewalk + 0.15) return true;
  }
  return false;
}

function _overlapsSolidObstacleOrCrosswalk(world, x, z, w, d, yBase) {
  const halfW = w * 0.5 + 0.15;
  const halfD = d * 0.5 + 0.15;
  const minX = x - halfW;
  const maxX = x + halfW;
  const minZ = z - halfD;
  const maxZ = z + halfD;
  const minY = yBase + 0.45;
  const maxY = yBase + 2.0;

  if (Array.isArray(world?.colliders)) {
    for (let i = 0; i < world.colliders.length; i++) {
      const c = world.colliders[i];
      if (c.disabled || c.isGangway) continue;
      if (c.maxY <= minY || c.minY >= maxY) continue;
      if (c.maxX > minX && c.minX < maxX && c.maxZ > minZ && c.minZ < maxZ) {
        return true;
      }
    }
  }

  if (Array.isArray(world?.crosswalkZones)) {
    for (let i = 0; i < world.crosswalkZones.length; i++) {
      const cw = world.crosswalkZones[i];
      if (cw.maxX > minX && cw.minX < maxX && cw.maxZ > minZ && cw.minZ < maxZ) {
        return true;
      }
    }
  }

  return false;
}

function _nudgeScaledParkedSpotIfNeeded(world, cfg) {
  const { w, d } = _computeCarFootprint(cfg);
  const estimateY = (px, pz) => {
    const tY = world?.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0;
    return cfg._absoluteY
      ? cfg.y ?? 0
      : cfg.y !== undefined
        ? cfg.y < 1.5
          ? tY + cfg.y
          : cfg.y
        : tY;
  };

  const isSpotClean = (px, pz) =>
    !_isOnUrbanPedestrianSidewalk(world, px, pz) &&
    !_overlapsSolidObstacleOrCrosswalk(world, px, pz, w, d, estimateY(px, pz));

  if (isSpotClean(cfg.x, cfg.z)) return cfg;

  const isAlongX = Math.abs(Math.sin(cfg.rotY || 0)) > 0.7;
  const stepOffsets = [8, -8, 16, -16, 24, -24, 32, -32];
  for (const delta of stepOffsets) {
    const nx = isAlongX ? cfg.x + delta : cfg.x;
    const nz = isAlongX ? cfg.z : cfg.z + delta;
    if (isSpotClean(nx, nz)) {
      return { ...cfg, x: nx, z: nz };
    }
  }
  for (const r of [6, 12, 18]) {
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      const nx = cfg.x + dx;
      const nz = cfg.z + dz;
      if (isSpotClean(nx, nz)) {
        return { ...cfg, x: nx, z: nz };
      }
    }
  }
  return cfg;
}

export function buildParkedLegoCars(world) {
  if (!IS_SCALED_WORLD) {
    return spawnFleetParkedLegoCars(world);
  }
  const resolved = resolveParkedCarsLayout(world).map((cfg) =>
    _nudgeScaledParkedSpotIfNeeded(world, cfg)
  );
  return spawnFleetParkedLegoCars(world, undefined, resolved);
}
