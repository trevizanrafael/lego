import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { createObb2D, obbClearOfSegment2D } from '../buildings/LotGeometry2D.js';
import { VISION_CONES, VISION_PRECOMPUTED } from './PursuitTuning.js';

/**
 * PoliceVisionAndPerception.js
 * Cones direcionais 2D/3D reais (viaturas, tropas a pé e círculo de solo do Águia),
 * oclusão AABB por prédios, cobertura aérea (viadutos, túneis, oficinas, marquises),
 * penalidade noturna (-30%) compensada pelo holofote, audição de disparos (60m)
 * e avaliação escalonada (Round-Robin) a 60 FPS cravados.
 */

export function segmentIntersectsRect2D(ax, az, bx, bz, minX, maxX, minZ, maxZ) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-6) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, ax - minX) && clip(dx, maxX - ax) && clip(-dz, az - minZ) && clip(dz, maxZ - az) && t0 <= t1;
}

export function isPointInVisionCone2D(ux, uz, yaw, px, pz, effectiveRange, halfAngleCos, proximity360 = 0) {
  const dx = px - ux, dz = pz - uz;
  const dist = Math.hypot(dx, dz);
  if (dist > effectiveRange) return false;
  if (dist < 1e-5 || (proximity360 > 0 && dist <= proximity360)) return true;
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / dist >= halfAngleCos;
}

export function getActivePursuitHelicopters(sys) {
  if (!sys) return [];
  if (Array.isArray(sys.policeHelicopters) && sys.policeHelicopters.length > 0) return sys.policeHelicopters;
  return sys.eagleHeli ? [sys.eagleHeli] : [];
}

export function isNightVisionCondition(sys) {
  return (sys?.world?.atmosphere?.nightFactor ?? 0) > 0.25;
}

export function isPlayerUnderOverheadCover(sys, playerPos) {
  if (!sys || !playerPos) return false;
  return Boolean(
    sys._isPlayerInUndergroundTunnel?.(playerPos) ||
    sys._isPlayerUnderViaduct?.(playerPos) ||
    sys._isInsideCoveredGarage?.(playerPos) ||
    sys._isUnderRoofOrOverhang?.(playerPos)
  );
}

export function isIlluminatedByHeliSpotlight(sys, playerPos) {
  if (!sys || !playerPos || isPlayerUnderOverheadCover(sys, playerPos)) return false;
  const isNight = isNightVisionCondition(sys);
  const helis = getActivePursuitHelicopters(sys);
  for (let i = 0; i < helis.length; i++) {
    const heli = helis[i];
    if (!heli || !heli.mesh?.position || heli.obj?.destroyed || heli.retreatingToBase) continue;
    const spotlightOn = heli.spotlightActive !== undefined
      ? Boolean(heli.spotlightActive)
      : heli.spotlightOn !== undefined
        ? Boolean(heli.spotlightOn)
        : Boolean(heli.coneMesh?.visible || isNight);
    if (!spotlightOn) continue;
    const hPos = heli.mesh.position;
    if (Math.hypot(playerPos.x - hPos.x, playerPos.z - hPos.z) > VISION_CONES.heli.maxHorizontalDist) continue;
    const g = heli.lookGroundPos || hPos;
    if (Math.hypot(playerPos.x - g.x, playerPos.z - g.z) <= (heli.groundConeRadius || VISION_CONES.heli.groundRadius)) {
      return true;
    }
  }
  return false;
}

export function getEffectiveGroundVisionRanges(sys, targetPos) {
  const isNight = isNightVisionCondition(sys);
  const illuminated = isNight ? isIlluminatedByHeliSpotlight(sys, targetPos) : false;
  const mult = isNight && !illuminated ? VISION_CONES.nightRangeMultiplier : 1.0;
  return {
    isNight, illuminated,
    footRange: VISION_CONES.foot.range * mult,
    carRange: VISION_CONES.car.range * mult,
    carProximity360: VISION_CONES.car.proximity360 * mult
  };
}

function resolveUnitHeading(unit, mesh, preferHeadingProp = true) {
  const meshRotY = mesh?.rotation?.y;
  if (unit && unit._lastSyncedHeading !== undefined && typeof meshRotY === 'number') {
    if (meshRotY !== unit._lastSyncedMeshRotY && unit.heading === unit._lastSyncedHeading) {
      unit.heading = meshRotY;
    }
  }
  const yaw = preferHeadingProp
    ? (typeof unit?.heading === 'number' ? unit.heading : (meshRotY ?? 0))
    : (typeof meshRotY === 'number' ? meshRotY : (unit?.heading ?? 0));
  if (unit) {
    unit._lastSyncedHeading = unit.heading;
    unit._lastSyncedMeshRotY = meshRotY;
  }
  return yaw;
}

export function doesGroundUnitSeeTarget(sys, kind, ux, uy, uz, yaw, targetPos, ranges = null) {
  if (!sys || !targetPos) return false;
  const maxVert = kind === 'car' ? VISION_PRECOMPUTED.carMaxVerticalDelta : VISION_PRECOMPUTED.footMaxVerticalDelta;
  if (Math.abs((uy ?? 0) - (targetPos.y ?? 0)) > maxVert) return false;

  const targetUnderground = Boolean(sys._isPlayerInUndergroundTunnel?.(targetPos));
  const unitUnderground = Boolean(sys._isPlayerInUndergroundTunnel?.({ x: ux, y: uy ?? 0, z: uz }));
  if (targetUnderground !== unitUnderground) return false;

  const r = ranges || getEffectiveGroundVisionRanges(sys, targetPos);
  const effectiveRange = kind === 'car' ? r.carRange : r.footRange;
  const halfCos = kind === 'car' ? VISION_PRECOMPUTED.carHalfAngleCos : VISION_PRECOMPUTED.footHalfAngleCos;
  const prox360 = kind === 'car' ? r.carProximity360 : 0;

  if (!isPointInVisionCone2D(ux, uz, yaw, targetPos.x, targetPos.z, effectiveRange, halfCos, prox360)) {
    return false;
  }
  return !sys._isSegmentBlockedByBuilding(ux, uz, targetPos.x, targetPos.z);
}

export function doesHelicopterSeeTarget(sys, heli, targetPos, precomputedUnderCover = null) {
  if (!sys || !heli || !targetPos || !heli.mesh?.position) return false;
  if (heli.obj?.destroyed || heli.retreatingToBase) return false;

  const underCover =
    precomputedUnderCover !== null ? precomputedUnderCover : isPlayerUnderOverheadCover(sys, targetPos);
  if (underCover) return false;

  const hPos = heli.mesh.position;
  if (Math.hypot(targetPos.x - hPos.x, targetPos.z - hPos.z) > VISION_CONES.heli.maxHorizontalDist) {
    return false;
  }
  const groundOrigin = heli.lookGroundPos || hPos;
  const coneRadius = heli.groundConeRadius || VISION_CONES.heli.groundRadius;
  return Math.hypot(targetPos.x - groundOrigin.x, targetPos.z - groundOrigin.z) <= coneRadius;
}

function shouldReevaluateUnit(unit, clock, ux, uz, yaw, targetPos, underCover, force) {
  if (force || unit._nextVisionCheckAt === undefined || clock >= unit._nextVisionCheckAt) return true;
  if (unit._lastCheckedCover !== underCover) return true;
  if (Math.hypot(targetPos.x - (unit._lastTargetX ?? 0), targetPos.z - (unit._lastTargetZ ?? 0)) > 4.0) return true;
  if (Math.abs((targetPos.y ?? 0) - (unit._lastTargetY ?? 0)) > 2.0) return true;
  return Math.hypot(ux - (unit._lastUnitX ?? 0), uz - (unit._lastUnitZ ?? 0)) > 4.0 || Math.abs(yaw - (unit._lastUnitYaw ?? 0)) > 0.35;
}

function cacheUnitVisionResult(unit, clock, staggerIdx, sees, ux, uz, yaw, targetPos, underCover) {
  unit._nextVisionCheckAt = clock + 0.16 + ((staggerIdx * 0.023) % 0.08);
  unit._cachedSeesPlayer = sees;
  unit._lastUnitX = ux; unit._lastUnitZ = uz; unit._lastUnitYaw = yaw;
  unit._lastTargetX = targetPos.x; unit._lastTargetY = targetPos.y ?? 0; unit._lastTargetZ = targetPos.z;
  unit._lastCheckedCover = underCover;
}

export function evaluatePursuitPerception(sys, playerPos, controller = null, dt = 0.016, forceImmediate = false) {
  if (!sys || !playerPos || sys.stars <= 0) return false;

  const stealthed =
    (controller?.stealthTimer || 0) > 0 || Boolean(controller?.operatorAbilities?.isStealthed?.());
  const cloudCeiling = sys.stars >= 5 ? 235.0 : 185.0;
  const helis = getActivePursuitHelicopters(sys);

  if (stealthed || playerPos.y > cloudCeiling) {
    for (let i = 0; i < helis.length; i++) if (helis[i]) helis[i].hasVisual = false;
    for (let i = 0; i < sys.pursuitVehicles.length; i++) sys.pursuitVehicles[i]._cachedSeesPlayer = false;
    for (let i = 0; i < sys.footUnits.length; i++) sys.footUnits[i]._cachedSeesPlayer = false;
    return false;
  }

  sys._visionClock = (sys._visionClock || 0) + Math.max(0, dt || 0);
  const clock = sys._visionClock;
  const force = Boolean(forceImmediate || dt >= VISION_CONES.checkIntervalMaxSec);
  const underCover = isPlayerUnderOverheadCover(sys, playerPos);

  let anyAerialSees = false;
  for (let i = 0; i < helis.length; i++) {
    const heli = helis[i];
    if (!heli) continue;
    const seen = doesHelicopterSeeTarget(sys, heli, playerPos, underCover);
    heli.hasVisual = seen;
    if (seen) anyAerialSees = true;
  }

  const ranges = getEffectiveGroundVisionRanges(sys, playerPos);
  let anyGroundSees = false;

  for (let i = 0; i < sys.pursuitVehicles.length; i++) {
    const pv = sys.pursuitVehicles[i];
    if (!pv || pv.retreating || pv.carObj?.destroyed || !pv.carObj?.mesh?.position) {
      if (pv) pv._cachedSeesPlayer = false;
      continue;
    }
    const vPos = pv.carObj.mesh.position;
    const yaw = resolveUnitHeading(pv, pv.carObj.mesh, true);
    if (shouldReevaluateUnit(pv, clock, vPos.x, vPos.z, yaw, playerPos, underCover, force)) {
      const seen = doesGroundUnitSeeTarget(sys, 'car', vPos.x, vPos.y, vPos.z, yaw, playerPos, ranges);
      cacheUnitVisionResult(pv, clock, i, seen, vPos.x, vPos.z, yaw, playerPos, underCover);
    }
    if (pv._cachedSeesPlayer) anyGroundSees = true;
  }

  for (let i = 0; i < sys.footUnits.length; i++) {
    const fu = sys.footUnits[i];
    if (!fu || fu.obj?.destroyed || !fu.mesh?.position) {
      if (fu) fu._cachedSeesPlayer = false;
      continue;
    }
    const fPos = fu.mesh.position;
    const yaw = resolveUnitHeading(fu, fu.mesh, false);
    if (shouldReevaluateUnit(fu, clock, fPos.x, fPos.z, yaw, playerPos, underCover, force)) {
      const seen = doesGroundUnitSeeTarget(sys, 'foot', fPos.x, fPos.y, fPos.z, yaw, playerPos, ranges);
      cacheUnitVisionResult(fu, clock, i + 7, seen, fPos.x, fPos.z, yaw, playerPos, underCover);
    }
    if (fu._cachedSeesPlayer) anyGroundSees = true;
  }

  return anyAerialSees || anyGroundSees;
}

export function getPoliceVisionConesSnapshot(sys) {
  if (!sys) return [];
  const ranges = getEffectiveGroundVisionRanges(sys, sys._lastPlayerPos || { x: 0, y: 0, z: 0 });
  const out = [];

  for (let i = 0; i < sys.pursuitVehicles.length; i++) {
    const pv = sys.pursuitVehicles[i];
    if (!pv || pv.retreating || pv.carObj?.destroyed || !pv.carObj?.mesh?.position) continue;
    const pos = pv.carObj.mesh.position;
    out.push({
      kind: 'car', x: pos.x, z: pos.z, heading: resolveUnitHeading(pv, pv.carObj.mesh, true),
      range: ranges.carRange, fovRad: VISION_PRECOMPUTED.carFovRad,
      radius: ranges.carProximity360, seesPlayer: Boolean(pv._cachedSeesPlayer)
    });
  }

  for (let i = 0; i < sys.footUnits.length; i++) {
    const fu = sys.footUnits[i];
    if (!fu || fu.obj?.destroyed || !fu.mesh?.position) continue;
    const pos = fu.mesh.position;
    out.push({
      kind: 'foot', x: pos.x, z: pos.z, heading: resolveUnitHeading(fu, fu.mesh, false),
      range: ranges.footRange, fovRad: VISION_PRECOMPUTED.footFovRad,
      radius: 0, seesPlayer: Boolean(fu._cachedSeesPlayer)
    });
  }

  const helis = getActivePursuitHelicopters(sys);
  for (let i = 0; i < helis.length; i++) {
    const heli = helis[i];
    if (!heli || heli.obj?.destroyed || heli.retreatingToBase || !heli.mesh?.position) continue;
    const g = heli.lookGroundPos || heli.mesh.position;
    out.push({
      kind: 'heli', x: g.x, z: g.z, heading: heli.mesh.rotation?.y ?? 0,
      range: 0, fovRad: Math.PI * 2,
      radius: heli.groundConeRadius || VISION_CONES.heli.groundRadius,
      seesPlayer: Boolean(heli.hasVisual)
    });
  }
  return out;
}

export const policeVisionAndPerceptionMethods = {
  _isPlayerInUndergroundTunnel(playerPos) {
    if (!playerPos) return false;
    if (playerPos.y < -1.85) return true;
    const cutY = getMetroCutoutFloorY(playerPos.x, playerPos.z);
    return cutY !== null && playerPos.y < -1.2;
  },

  _isPlayerUnderViaduct(playerPos) {
    if (!playerPos || !Array.isArray(this.world?.elevatedDecks)) return false;
    for (let i = 0; i < this.world.elevatedDecks.length; i++) {
      const d = this.world.elevatedDecks[i];
      if (
        playerPos.x >= d.minX - 1.5 && playerPos.x <= d.maxX + 1.5 &&
        playerPos.z >= d.minZ - 1.5 && playerPos.z <= d.maxZ + 1.5
      ) {
        const topY = typeof d.getTopY === 'function' ? d.getTopY(playerPos.x, playerPos.z) : (d.topY ?? 11.5);
        if (playerPos.y < topY - 2.6) return true;
      }
    }
    return false;
  },

  _isInsideCoveredGarage(playerPos) {
    if (!playerPos) return false;
    const sc = this.world?.streetCustomsData;
    if (sc && Number.isFinite(sc.buildingX) && Number.isFinite(sc.buildingZ)) {
      const hw = (sc.buildingW || 58) * 0.5 - 1.5;
      const hd = (sc.buildingD || 56) * 0.5 - 1.5;
      return (
        Math.abs(playerPos.x - sc.buildingX) < hw &&
        Math.abs(playerPos.z - sc.buildingZ) < hd &&
        playerPos.y < 13.5
      );
    }
    return (
      playerPos.x > 40.5 && playerPos.x < 95.5 &&
      playerPos.z > -480.5 && playerPos.z < -427.5 &&
      playerPos.y < 13.5
    );
  },

  _isUnderRoofOrOverhang(playerPos) {
    if (!playerPos || !this.world) return false;
    const cols =
      typeof this.world.getCollidersNear === 'function'
        ? this.world.getCollidersNear(
            playerPos.x, playerPos.z, 0.5,
            this._overhangColliderScratch || (this._overhangColliderScratch = [])
          )
        : this.world.colliders;
    if (!Array.isArray(cols)) return false;

    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      if (!col || col.disabled) continue;
      if (
        playerPos.x >= col.minX && playerPos.x <= col.maxX &&
        playerPos.z >= col.minZ && playerPos.z <= col.maxZ &&
        col.minY > playerPos.y + 1.5 && col.maxY > playerPos.y + 2.2
      ) {
        return true;
      }
    }
    return false;
  },

  _isPlayerUnderOverheadCover(playerPos) {
    return isPlayerUnderOverheadCover(this, playerPos);
  },

  _ensureMapBuildingGrid(buildings) {
    if (
      this._mapBuildingGrid &&
      this._mapBuildingSourceRef === buildings &&
      this._mapBuildingGridLen === buildings.length
    ) {
      return this._mapBuildingGrid;
    }
    const cs = 48;
    const grid = new Map();
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if ((b.height || 10) < 3.2) continue;
      const rotY = b.rotY || 0;
      const obb = Math.abs(rotY) > 1e-3 ? createObb2D(b.x, b.z, b.w, b.d, rotY) : null;
      const hw = b.w * 0.5;
      const hd = b.d * 0.5;
      const entry = obb
        ? { minX: obb.minX, maxX: obb.maxX, minZ: obb.minZ, maxZ: obb.maxZ, obb, _losQid: 0 }
        : { minX: b.x - hw, maxX: b.x + hw, minZ: b.z - hd, maxZ: b.z + hd, obb: null, _losQid: 0 };
      const gx0 = Math.floor(entry.minX / cs);
      const gx1 = Math.floor(entry.maxX / cs);
      const gz0 = Math.floor(entry.minZ / cs);
      const gz1 = Math.floor(entry.maxZ / cs);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
          let bucket = grid.get(key);
          if (!bucket) grid.set(key, (bucket = []));
          bucket.push(entry);
        }
      }
    }
    this._mapBuildingGrid = grid;
    this._mapBuildingSourceRef = buildings;
    this._mapBuildingGridLen = buildings.length;
    this._losQueryId = this._losQueryId || 0;
    return grid;
  },

  _isSegmentBlockedByBuilding(ax, az, bx, bz) {
    const buildings = this.world?.mapBuildings;
    if (!Array.isArray(buildings) || buildings.length === 0) return false;
    const grid = this._ensureMapBuildingGrid(buildings);
    const minSegX = Math.min(ax, bx) - 1;
    const maxSegX = Math.max(ax, bx) + 1;
    const minSegZ = Math.min(az, bz) - 1;
    const maxSegZ = Math.max(az, bz) + 1;
    const cs = 48;
    const qid = (this._losQueryId = (this._losQueryId || 0) + 1);

    for (let gx = Math.floor(minSegX / cs); gx <= Math.floor(maxSegX / cs); gx++) {
      for (let gz = Math.floor(minSegZ / cs); gz <= Math.floor(maxSegZ / cs); gz++) {
        const bucket = grid.get(((gx & 0xffff) << 16) | (gz & 0xffff));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const b = bucket[i];
          if (b._losQid === qid) continue;
          b._losQid = qid;
          if (b.maxX < minSegX || b.minX > maxSegX || b.maxZ < minSegZ || b.minZ > maxSegZ) continue;
          if (b.obb) {
            if (!obbClearOfSegment2D(b.obb, ax, az, bx, bz, 0.05)) return true;
          } else if (segmentIntersectsRect2D(ax, az, bx, bz, b.minX, b.maxX, b.minZ, b.maxZ)) {
            return true;
          }
        }
      }
    }
    return false;
  },

  doesAnyUnitSeePosition(targetPos) {
    if (!targetPos) return false;
    const underCover = isPlayerUnderOverheadCover(this, targetPos);
    const helis = getActivePursuitHelicopters(this);
    for (let i = 0; i < helis.length; i++) {
      if (doesHelicopterSeeTarget(this, helis[i], targetPos, underCover)) return true;
    }

    const ranges = getEffectiveGroundVisionRanges(this, targetPos);
    for (let i = 0; i < this.pursuitVehicles.length; i++) {
      const pv = this.pursuitVehicles[i];
      if (!pv || pv.retreating || pv.carObj?.destroyed || !pv.carObj?.mesh?.position) continue;
      const vPos = pv.carObj.mesh.position;
      const yaw = resolveUnitHeading(pv, pv.carObj.mesh, true);
      if (doesGroundUnitSeeTarget(this, 'car', vPos.x, vPos.y, vPos.z, yaw, targetPos, ranges)) return true;
    }

    for (let i = 0; i < this.footUnits.length; i++) {
      const fu = this.footUnits[i];
      if (!fu || fu.obj?.destroyed || !fu.mesh?.position) continue;
      const fPos = fu.mesh.position;
      const yaw = resolveUnitHeading(fu, fu.mesh, false);
      if (doesGroundUnitSeeTarget(this, 'foot', fPos.x, fPos.y, fPos.z, yaw, targetPos, ranges)) return true;
    }
    return false;
  },

  _computeLineOfSight(playerPos, controller, opts = {}) {
    const dt = typeof opts.dt === 'number' ? opts.dt : 0.016;
    const forceImmediate = opts.forceImmediate !== undefined ? Boolean(opts.forceImmediate) : true;
    const seen = evaluatePursuitPerception(this, playerPos, controller, dt, forceImmediate);
    if (seen && playerPos && this._lastKnownPlayerPos) this._lastKnownPlayerPos.copy(playerPos);
    return seen;
  },

  notifyPlayerGunshot(playerPos) {
    if (this.stars > 0) this._playerHostileActionInPursuit = true;
    if (!playerPos || !Array.isArray(this.footUnits)) return 0;
    let alertedCount = 0;
    for (let i = 0; i < this.footUnits.length; i++) {
      const fu = this.footUnits[i];
      if (!fu || fu.obj?.destroyed || !fu.mesh?.position) continue;
      const fPos = fu.mesh.position;
      if (Math.abs((playerPos.y ?? 0) - (fPos.y ?? 0)) > 45.0) continue;
      if (Math.hypot(playerPos.x - fPos.x, playerPos.z - fPos.z) <= VISION_CONES.foot.hearingRange) {
        const yaw = Math.atan2(playerPos.x - fPos.x, playerPos.z - fPos.z);
        fu.mesh.rotation.y = yaw;
        if (typeof fu.heading === 'number') fu.heading = yaw;
        fu._lastSyncedHeading = fu.heading;
        fu._lastSyncedMeshRotY = yaw;
        fu._nextVisionCheckAt = 0;
        fu.investigatePos = { x: playerPos.x, z: playerPos.z, timer: 6.0 };
        alertedCount++;
      }
    }
    return alertedCount;
  },

  getPoliceVisionConesSnapshot() {
    return getPoliceVisionConesSnapshot(this);
  }
};
