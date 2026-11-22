/**
 * CollisionQueries.js
 * Suíte unificada de consultas físicas contínuas e discretas (zero-GC nos hot paths):
 * - overlapCapsule / resolveCapsulePenetration / projectSlideVelocity2D
 * - overlapOrientedBox / resolveObbPenetration
 * - sweepSphere / sweepOrientedBox (anti-tunneling contínuo a altas velocidades)
 * - raycast3D (segmento 3D exato contra 'box', 'obb' e 'cylinder')
 */

import {
  testCircleVsCollider2D,
  testObbVsCollider2D,
  raycastSegmentVsCollider3D
} from './CollisionShapes.js';
import {
  queryCollidersNear2D,
  queryCollidersAlongSegment2D
} from './CollisionWorldIndex.js';

const _overlapCols = [];
const _resolveCols = [];
const _obbOverlapCols = [];
const _obbResolveCols = [];
const _sweepSphereCols = [];
const _sweepObbCols = [];
const _rayCols = [];
const _hit2D = { hit: false, pushX: 0, pushZ: 0, nx: 0, nz: 0, depth: 0 };
const _rayHit = { hit: false, t: 1, px: 0, py: 0, pz: 0, nx: 0, ny: 0, nz: 0 };
const _obbStepRes = { x: 0, z: 0, collided: false, hitNormalX: 0, hitNormalZ: 0, maxDepth: 0, hitCollider: null };

function passesColliderFilter(col, minY, maxY, opts) {
  if (!col || col.disabled) return false;
  if (col.maxY <= minY || (col.minY ?? 0) >= maxY) return false;
  if (opts) {
    if (opts.ignoreCollider && col === opts.ignoreCollider) return false;
    if (opts.ignoreColliders && opts.ignoreColliders.indexOf(col) !== -1) return false;
    if (typeof opts.filter === 'function' && !opts.filter(col)) return false;
  }
  return true;
}

export function projectSlideVelocity2D(vx, vz, nx, nz, friction = 0, out = null) {
  const res = out || { vx: 0, vz: 0, x: 0, z: 0 };
  const vn = vx * nx + vz * nz;
  let sx = vx;
  let sz = vz;
  if (vn < 0) {
    const keep = friction > 0 ? Math.max(0, 1 - friction) : 1;
    sx = (vx - vn * nx) * keep;
    sz = (vz - vn * nz) * keep;
  }
  res.vx = sx; res.vz = sz; res.x = sx; res.z = sz;
  return res;
}

export function overlapCapsule(world, pos, radius, height, opts = {}) {
  const res = opts.out || [];
  res.length = 0;
  if (!world || !pos) return res;

  const yBottom = (pos.y || 0) + (opts.stepUp ?? opts.stepUpHeight ?? 0);
  const yTop = (pos.y || 0) + height;
  const x = pos.x, z = pos.z;

  queryCollidersNear2D(world, x, z, radius, _overlapCols);
  for (let i = 0; i < _overlapCols.length; i++) {
    const col = _overlapCols[i];
    if (!passesColliderFilter(col, yBottom, yTop, opts)) continue;
    if (x + radius <= col.minX || x - radius >= col.maxX || z + radius <= col.minZ || z - radius >= col.maxZ) continue;
    testCircleVsCollider2D(x, z, radius, col, _hit2D);
    if (_hit2D.hit && _hit2D.depth > 1e-6) res.push(col);
  }
  return res;
}

export function resolveCapsulePenetration(world, pos, radius, height, opts = {}) {
  const res = opts.out || {};
  let curX = pos.x, curZ = pos.z;
  let collided = false, hitNormalX = 0, hitNormalZ = 0, maxDepth = 0, hitCollider = null;

  if (world) {
    const yBottom = (pos.y || 0) + (opts.stepUpHeight ?? opts.stepUp ?? 0.34);
    const yTop = (pos.y || 0) + height;
    const maxPasses = opts.maxPasses ?? 4;
    queryCollidersNear2D(world, curX, curZ, radius + 1.25, _resolveCols);

    for (let pass = 0; pass < maxPasses; pass++) {
      let anyHit = false;
      for (let i = 0; i < _resolveCols.length; i++) {
        const col = _resolveCols[i];
        if (!passesColliderFilter(col, yBottom, yTop, opts)) continue;
        if (curX + radius <= col.minX || curX - radius >= col.maxX || curZ + radius <= col.minZ || curZ - radius >= col.maxZ) {
          continue;
        }
        testCircleVsCollider2D(curX, curZ, radius, col, _hit2D);
        if (_hit2D.hit && _hit2D.depth > 1e-6) {
          curX += _hit2D.pushX;
          curZ += _hit2D.pushZ;
          anyHit = true;
          collided = true;
          if (_hit2D.depth >= maxDepth || !hitCollider) {
            maxDepth = _hit2D.depth;
            hitNormalX = _hit2D.nx;
            hitNormalZ = _hit2D.nz;
            hitCollider = col;
          }
        }
      }
      if (!anyHit) break;
    }
  }

  res.x = curX; res.z = curZ; res.collided = collided;
  res.hitNormalX = hitNormalX; res.hitNormalZ = hitNormalZ;
  res.maxDepth = maxDepth; res.hitCollider = hitCollider;
  return res;
}

export function overlapOrientedBox(world, cx, cz, halfX, halfZ, yaw, minY, maxY, opts = {}) {
  const res = opts.out || [];
  res.length = 0;
  if (!world) return res;

  const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
  const extX = Math.abs(c) * halfX + Math.abs(s) * halfZ;
  const extZ = Math.abs(s) * halfX + Math.abs(c) * halfZ;

  queryCollidersNear2D(world, cx, cz, Math.max(extX, extZ), _obbOverlapCols);
  for (let i = 0; i < _obbOverlapCols.length; i++) {
    const col = _obbOverlapCols[i];
    if (!passesColliderFilter(col, minY, maxY, opts)) continue;
    if (cx + extX <= col.minX || cx - extX >= col.maxX || cz + extZ <= col.minZ || cz - extZ >= col.maxZ) continue;
    testObbVsCollider2D(cx, cz, halfX, halfZ, yaw, col, _hit2D);
    if (_hit2D.hit && _hit2D.depth > 1e-6) res.push(col);
  }
  return res;
}

function resolveObbAgainstCandidates(candidates, cx, cz, halfX, halfZ, yaw, minY, maxY, opts, out) {
  const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
  const extX = Math.abs(c) * halfX + Math.abs(s) * halfZ;
  const extZ = Math.abs(s) * halfX + Math.abs(c) * halfZ;
  const maxPasses = opts?.maxPasses ?? 4;

  let curX = cx, curZ = cz;
  let collided = false, hitNormalX = 0, hitNormalZ = 0, maxDepth = 0, hitCollider = null;

  for (let pass = 0; pass < maxPasses; pass++) {
    let anyHit = false;
    for (let i = 0; i < candidates.length; i++) {
      const col = candidates[i];
      if (!passesColliderFilter(col, minY, maxY, opts)) continue;
      if (curX + extX <= col.minX || curX - extX >= col.maxX || curZ + extZ <= col.minZ || curZ - extZ >= col.maxZ) {
        continue;
      }
      testObbVsCollider2D(curX, curZ, halfX, halfZ, yaw, col, _hit2D);
      if (_hit2D.hit && _hit2D.depth > 1e-6) {
        curX += _hit2D.pushX;
        curZ += _hit2D.pushZ;
        anyHit = true;
        collided = true;
        if (_hit2D.depth >= maxDepth || !hitCollider) {
          maxDepth = _hit2D.depth;
          hitNormalX = _hit2D.nx;
          hitNormalZ = _hit2D.nz;
          hitCollider = col;
        }
      }
    }
    if (!anyHit) break;
  }

  out.x = curX; out.z = curZ; out.collided = collided;
  out.hitNormalX = hitNormalX; out.hitNormalZ = hitNormalZ;
  out.maxDepth = maxDepth; out.hitCollider = hitCollider;
  return out;
}

export function resolveObbPenetration(world, cx, cz, halfX, halfZ, yaw, minY, maxY, opts = {}) {
  const res = opts.out || {};
  if (!world) {
    res.x = cx; res.z = cz; res.collided = false;
    res.hitNormalX = 0; res.hitNormalZ = 0; res.maxDepth = 0; res.hitCollider = null;
    return res;
  }
  const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
  const boundR = Math.max(Math.abs(c) * halfX + Math.abs(s) * halfZ, Math.abs(s) * halfX + Math.abs(c) * halfZ);
  queryCollidersNear2D(world, cx, cz, boundR + 1.5, _obbResolveCols);
  return resolveObbAgainstCandidates(_obbResolveCols, cx, cz, halfX, halfZ, yaw, minY, maxY, opts, res);
}

function passesSweepOptions(col, segMinX, segMaxX, segMinY, segMaxY, segMinZ, segMaxZ, opts) {
  if (!col || col.disabled) return false;
  if (col.maxY < segMinY - 1e-6 || (col.minY ?? 0) > segMaxY + 1e-6) return false;
  if (col.maxX < segMinX || col.minX > segMaxX || col.maxZ < segMinZ || col.minZ > segMaxZ) return false;
  if (opts) {
    if (opts.ignoreCollider && col === opts.ignoreCollider) return false;
    if (opts.ignoreColliders && opts.ignoreColliders.indexOf(col) !== -1) return false;
    if (typeof opts.filter === 'function' && !opts.filter(col)) return false;
  }
  return true;
}

export function sweepSphere(world, from, to, radius, opts = {}) {
  const res = opts.out || {};
  const ax = from.x, ay = from.y ?? 0, az = from.z;
  const bx = to.x, by = to.y ?? ay, bz = to.z;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const totalDist = Math.hypot(dx, dy, dz);
  const r = Math.max(0, radius);

  let bestT = Infinity, bestCol = null, bestNx = 0, bestNy = 0, bestNz = 0;

  if (world) {
    queryCollidersAlongSegment2D(world, ax, az, bx, bz, r + 0.5, _sweepSphereCols);
    const segMinX = Math.min(ax, bx) - r, segMaxX = Math.max(ax, bx) + r;
    const segMinY = Math.min(ay, by) - r, segMaxY = Math.max(ay, by) + r;
    const segMinZ = Math.min(az, bz) - r, segMaxZ = Math.max(az, bz) + r;

    for (let i = 0; i < _sweepSphereCols.length; i++) {
      const col = _sweepSphereCols[i];
      if (!passesSweepOptions(col, segMinX, segMaxX, segMinY, segMaxY, segMinZ, segMaxZ, opts)) continue;
      raycastSegmentVsCollider3D(ax, ay, az, bx, by, bz, col, r, _rayHit);
      if (_rayHit.hit && _rayHit.t < bestT) {
        bestT = _rayHit.t;
        bestCol = col;
        bestNx = _rayHit.nx; bestNy = _rayHit.ny; bestNz = _rayHit.nz;
      }
    }
  }

  const hit = bestCol !== null;
  const hitT = hit ? bestT : 1;
  const skinPull = hit && totalDist > 1e-5 ? Math.min(0.002 / totalDist, hitT) : 0;
  const safeT = hit ? Math.max(0, hitT - skinPull) : 1;
  const cx = ax + dx * hitT, cy = ay + dy * hitT, cz = az + dz * hitT;

  res.hit = hit;
  res.t = hitT;
  res.x = ax + dx * safeT + (hit && hitT === 0 ? bestNx * 0.002 : 0);
  res.y = ay + dy * safeT + (hit && hitT === 0 ? bestNy * 0.002 : 0);
  res.z = az + dz * safeT + (hit && hitT === 0 ? bestNz * 0.002 : 0);
  res.distance = totalDist * hitT;
  if (!res.point) res.point = { x: 0, y: 0, z: 0 };
  res.point.x = cx - bestNx * r; res.point.y = cy - bestNy * r; res.point.z = cz - bestNz * r;
  if (!res.normal) res.normal = { x: 0, y: 0, z: 0 };
  res.normal.x = bestNx; res.normal.y = bestNy; res.normal.z = bestNz;
  res.hitNormalX = bestNx; res.hitNormalY = bestNy; res.hitNormalZ = bestNz;
  res.collider = bestCol; res.hitCollider = bestCol;
  return res;
}

export function sweepOrientedBox(world, from, to, halfX, halfZ, yaw, minY, maxY, opts = {}) {
  const res = opts.out || {};
  const ax = from.x, az = from.z, ay = from.y || 0;
  const bx = to.x, bz = to.z, by = to.y || 0;
  const dx = bx - ax, dz = bz - az;
  const moveDist2DSq = dx * dx + dz * dz;
  const moveDist = Math.hypot(dx, dz, by - ay);

  if (!world) {
    res.x = bx; res.z = bz; res.hit = false; res.t = 1;
    res.hitNormalX = 0; res.hitNormalZ = 0; res.hitCollider = null;
    return res;
  }

  const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
  const boundR = Math.max(Math.abs(c) * halfX + Math.abs(s) * halfZ, Math.abs(s) * halfX + Math.abs(c) * halfZ);

  if (moveDist <= 0.30) {
    queryCollidersNear2D(world, bx, bz, boundR + 1.5, _obbResolveCols);
    resolveObbAgainstCandidates(_obbResolveCols, bx, bz, halfX, halfZ, yaw, minY, maxY, opts, _obbStepRes);
    res.x = _obbStepRes.x;
    res.z = _obbStepRes.z;
    res.hit = _obbStepRes.collided;
    res.t = _obbStepRes.collided && moveDist2DSq > 1e-8
      ? Math.max(0, Math.min(1, ((_obbStepRes.x - ax) * dx + (_obbStepRes.z - az) * dz) / moveDist2DSq))
      : (_obbStepRes.collided ? 0 : 1);
    res.hitNormalX = _obbStepRes.hitNormalX;
    res.hitNormalZ = _obbStepRes.hitNormalZ;
    res.hitCollider = _obbStepRes.hitCollider;
    return res;
  }

  queryCollidersAlongSegment2D(world, ax, az, bx, bz, boundR + 1.0, _sweepObbCols);
  const steps = Math.min(opts.maxSteps ?? 32, Math.max(2, Math.ceil(moveDist / 0.26)));

  for (let step = 1; step <= steps; step++) {
    const frac = step / steps;
    resolveObbAgainstCandidates(_sweepObbCols, ax + dx * frac, az + dz * frac, halfX, halfZ, yaw, minY, maxY, opts, _obbStepRes);
    if (_obbStepRes.collided) {
      res.x = _obbStepRes.x;
      res.z = _obbStepRes.z;
      res.hit = true;
      res.t = moveDist2DSq > 1e-8
        ? Math.max(0, Math.min(frac, ((_obbStepRes.x - ax) * dx + (_obbStepRes.z - az) * dz) / moveDist2DSq))
        : ((step - 1) / steps);
      res.hitNormalX = _obbStepRes.hitNormalX;
      res.hitNormalZ = _obbStepRes.hitNormalZ;
      res.hitCollider = _obbStepRes.hitCollider;
      return res;
    }
  }

  res.x = bx; res.z = bz; res.hit = false; res.t = 1;
  res.hitNormalX = 0; res.hitNormalZ = 0; res.hitCollider = null;
  return res;
}

export function raycast3D(world, from, to, opts = {}) {
  const res = opts.out || {};
  if (!res.point) res.point = { x: 0, y: 0, z: 0 };
  if (!res.normal) res.normal = { x: 0, y: 0, z: 0 };

  const ax = from.x, ay = from.y ?? 0, az = from.z;
  const bx = to.x, by = to.y ?? ay, bz = to.z;
  const totalDist = Math.hypot(bx - ax, by - ay, bz - az);
  const pad = Math.max(0, Number(opts.radiusPad) || 0);

  let bestT = Infinity, bestCol = null;
  let bestPx = bx, bestPy = by, bestPz = bz, bestNx = 0, bestNy = 0, bestNz = 0;

  if (world) {
    queryCollidersAlongSegment2D(world, ax, az, bx, bz, pad + 0.25, _rayCols);
    const segMinX = Math.min(ax, bx) - pad, segMaxX = Math.max(ax, bx) + pad;
    const segMinY = Math.min(ay, by) - pad, segMaxY = Math.max(ay, by) + pad;
    const segMinZ = Math.min(az, bz) - pad, segMaxZ = Math.max(az, bz) + pad;

    for (let i = 0; i < _rayCols.length; i++) {
      const col = _rayCols[i];
      if (!passesSweepOptions(col, segMinX, segMaxX, segMinY, segMaxY, segMinZ, segMaxZ, opts)) continue;
      raycastSegmentVsCollider3D(ax, ay, az, bx, by, bz, col, pad, _rayHit);
      if (_rayHit.hit && _rayHit.t < bestT) {
        bestT = _rayHit.t; bestCol = col;
        bestPx = _rayHit.px; bestPy = _rayHit.py; bestPz = _rayHit.pz;
        bestNx = _rayHit.nx; bestNy = _rayHit.ny; bestNz = _rayHit.nz;
      }
    }
  }

  const hit = bestCol !== null;
  res.hit = hit;
  res.t = hit ? bestT : 1;
  res.distance = totalDist * (hit ? bestT : 1);
  res.point.x = hit ? bestPx : bx; res.point.y = hit ? bestPy : by; res.point.z = hit ? bestPz : bz;
  res.normal.x = bestNx; res.normal.y = bestNy; res.normal.z = bestNz;
  res.collider = bestCol;
  return res;
}
