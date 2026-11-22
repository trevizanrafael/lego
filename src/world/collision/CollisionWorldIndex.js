/**
 * CollisionWorldIndex.js
 * Índice espacial 2D O(1) em células de 32m x 32m + lista de colisores dinâmicos
 * para registro, atualização, remoção e consultas broad-phase sem alocação por frame.
 */

import {
  createBoxCollider,
  createObbCollider,
  createCylinderCollider,
  syncObbColliderBounds,
  syncCylinderColliderBounds
} from './CollisionShapes.js';

export function packColliderCell(cx, cz) {
  return ((cx & 0xffff) << 16) | (cz & 0xffff);
}

export function ensureColliderWorldState(world) {
  if (!world.colliders) world.colliders = [];
  if (!world._colliderGrid) world._colliderGrid = new Map();
  if (!world._dynamicColliders) world._dynamicColliders = [];
  if (!world.colliderCellSize) world.colliderCellSize = 32;
  if (typeof world._colliderQueryId !== 'number') world._colliderQueryId = 0;
}

function insertStaticColliderIntoGrid(world, col) {
  const cs = world.colliderCellSize || 32;
  const minCX = Math.floor(col.minX / cs);
  const maxCX = Math.floor(col.maxX / cs);
  const minCZ = Math.floor(col.minZ / cs);
  const maxCZ = Math.floor(col.maxZ / cs);
  const keys = [];
  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cz = minCZ; cz <= maxCZ; cz++) {
      const k = packColliderCell(cx, cz);
      keys.push(k);
      let bucket = world._colliderGrid.get(k);
      if (!bucket) {
        bucket = [];
        world._colliderGrid.set(k, bucket);
      }
      bucket.push(col);
    }
  }
  col._gridKeys = keys;
}

function removeStaticColliderFromGrid(world, col) {
  if (!Array.isArray(col._gridKeys)) return;
  for (let i = 0; i < col._gridKeys.length; i++) {
    const bucket = world._colliderGrid.get(col._gridKeys[i]);
    if (bucket) {
      const idx = bucket.indexOf(col);
      if (idx !== -1) bucket.splice(idx, 1);
    }
  }
  col._gridKeys = null;
}

function registerCollider(world, col) {
  ensureColliderWorldState(world);
  world.colliders.push(col);
  if (col.isDynamic) world._dynamicColliders.push(col);
  else insertStaticColliderIntoGrid(world, col);
  return col;
}

export function addBoxCollider(world, x, z, width, depth, maxY = 10, minY = 0, opts = {}) {
  if (opts && opts.shapeType === 'obb') {
    return addObbCollider(world, x, z, width, depth, opts.yaw || 0, maxY, minY, opts);
  }
  if (opts && opts.shapeType === 'cylinder') {
    const radius = opts.radius !== undefined ? opts.radius : Math.max(width, depth) * 0.5;
    return addCylinderCollider(world, x, z, radius, maxY, minY, opts);
  }
  return registerCollider(world, createBoxCollider(x, z, width, depth, maxY, minY, opts));
}

export function addObbCollider(world, cx, cz, width, depth, yaw = 0, maxY = 10, minY = 0, opts = {}) {
  return registerCollider(world, createObbCollider(cx, cz, width, depth, yaw, maxY, minY, opts));
}

export function addCylinderCollider(world, cx, cz, radius, maxY = 10, minY = 0, opts = {}) {
  return registerCollider(world, createCylinderCollider(cx, cz, radius, maxY, minY, opts));
}

export function addTieredCollider(world, x, z, tiers = [], opts = {}) {
  ensureColliderWorldState(world);
  const created = [];
  if (!Array.isArray(tiers)) return created;

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (!tier) continue;
    const tx = x + (tier.offsetX || 0);
    const tz = z + (tier.offsetZ || 0);
    const minY = tier.minY !== undefined ? tier.minY : (opts.minY ?? 0);
    const maxY = tier.maxY !== undefined ? tier.maxY : (opts.maxY ?? 10);
    const yaw = tier.yaw !== undefined ? tier.yaw : (opts.yaw || 0);
    const tierOpts = {
      isDynamic: tier.isDynamic !== undefined ? tier.isDynamic : opts.isDynamic,
      disabled: tier.disabled !== undefined ? tier.disabled : opts.disabled,
      tag: tier.tag || opts.tag || null
    };
    if (tier.shapeType === 'cylinder') {
      const r = tier.radius !== undefined ? tier.radius : Math.max(tier.width || 0, tier.depth || 0) * 0.5;
      created.push(addCylinderCollider(world, tx, tz, r, maxY, minY, tierOpts));
    } else if (tier.shapeType === 'obb' || Math.abs(yaw) > 1e-6) {
      created.push(addObbCollider(world, tx, tz, tier.width || 0, tier.depth || 0, yaw, maxY, minY, tierOpts));
    } else {
      created.push(addBoxCollider(world, tx, tz, tier.width || 0, tier.depth || 0, maxY, minY, tierOpts));
    }
  }
  return created;
}

export function promoteDynamicCollider(world, col) {
  if (!col || col.isDynamic) return col;
  ensureColliderWorldState(world);
  removeStaticColliderFromGrid(world, col);
  col.isDynamic = true;
  if (world._dynamicColliders.indexOf(col) === -1) world._dynamicColliders.push(col);
  return col;
}

export function updateDynamicCollider(world, col, patch = null) {
  if (!col) return null;
  if (!col.isDynamic) promoteDynamicCollider(world, col);
  if (patch) {
    if (patch.cx !== undefined) col.cx = patch.cx;
    if (patch.cz !== undefined) col.cz = patch.cz;
    if (patch.yaw !== undefined) col.yaw = patch.yaw;
    if (patch.halfX !== undefined) col.halfX = patch.halfX;
    if (patch.halfZ !== undefined) col.halfZ = patch.halfZ;
    if (patch.width !== undefined && col.shapeType === 'obb') col.halfX = patch.width * 0.5;
    if (patch.depth !== undefined && col.shapeType === 'obb') col.halfZ = patch.depth * 0.5;
    if (patch.radius !== undefined) col.radius = patch.radius;
    if (patch.minY !== undefined) col.minY = patch.minY;
    if (patch.maxY !== undefined) col.maxY = patch.maxY;
    if (patch.minX !== undefined) col.minX = patch.minX;
    if (patch.maxX !== undefined) col.maxX = patch.maxX;
    if (patch.minZ !== undefined) col.minZ = patch.minZ;
    if (patch.maxZ !== undefined) col.maxZ = patch.maxZ;
    if (patch.disabled !== undefined) col.disabled = Boolean(patch.disabled);
    if (patch.tag !== undefined) col.tag = patch.tag;

    if (col.shapeType === 'box' && (patch.x !== undefined || patch.z !== undefined)) {
      const curW = patch.width !== undefined ? patch.width : (col.maxX - col.minX);
      const curD = patch.depth !== undefined ? patch.depth : (col.maxZ - col.minZ);
      const bx = patch.x !== undefined ? patch.x : (col.minX + col.maxX) * 0.5;
      const bz = patch.z !== undefined ? patch.z : (col.minZ + col.maxZ) * 0.5;
      col.minX = bx - curW * 0.5; col.maxX = bx + curW * 0.5;
      col.minZ = bz - curD * 0.5; col.maxZ = bz + curD * 0.5;
    }
  }
  if (col.shapeType === 'obb') syncObbColliderBounds(col);
  else if (col.shapeType === 'cylinder') syncCylinderColliderBounds(col);
  return col;
}

export function removeCollider(world, col) {
  if (!world || !col) return false;
  ensureColliderWorldState(world);
  removeStaticColliderFromGrid(world, col);
  const dynIdx = world._dynamicColliders.indexOf(col);
  if (dynIdx !== -1) world._dynamicColliders.splice(dynIdx, 1);
  const allIdx = world.colliders.indexOf(col);
  if (allIdx !== -1) world.colliders.splice(allIdx, 1);
  col.disabled = true;
  return allIdx !== -1 || dynIdx !== -1;
}

export function queryCollidersNear2D(world, x, z, radius = 2.5, out = null) {
  if (out) out.length = 0;
  else out = [];
  if (!world) return out;
  if (!world._colliderGrid) ensureColliderWorldState(world);

  const qid = ++world._colliderQueryId;
  const cs = world.colliderCellSize;
  const minCX = Math.floor((x - radius) / cs);
  const maxCX = Math.floor((x + radius) / cs);
  const minCZ = Math.floor((z - radius) / cs);
  const maxCZ = Math.floor((z + radius) / cs);

  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cz = minCZ; cz <= maxCZ; cz++) {
      const bucket = world._colliderGrid.get(packColliderCell(cx, cz));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const col = bucket[i];
        if (col.disabled || col._qid === qid) continue;
        col._qid = qid;
        out.push(col);
      }
    }
  }

  const dyn = world._dynamicColliders;
  for (let i = 0; i < dyn.length; i++) {
    const col = dyn[i];
    if (col.disabled || col._qid === qid) continue;
    if (x + radius >= col.minX && x - radius <= col.maxX && z + radius >= col.minZ && z - radius <= col.maxZ) {
      col._qid = qid;
      out.push(col);
    }
  }
  return out;
}

function segmentIntersectsCell2D(x0, z0, x1, z1, minX, maxX, minZ, maxZ) {
  const dx = x1 - x0, dz = z1 - z0;
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < minX || x0 > maxX) return false;
  } else {
    let tx0 = (minX - x0) / dx, tx1 = (maxX - x0) / dx;
    if (tx0 > tx1) { const tmp = tx0; tx0 = tx1; tx1 = tmp; }
    if (tx0 > t0) t0 = tx0;
    if (tx1 < t1) t1 = tx1;
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (z0 < minZ || z0 > maxZ) return false;
  } else {
    let tz0 = (minZ - z0) / dz, tz1 = (maxZ - z0) / dz;
    if (tz0 > tz1) { const tmp = tz0; tz0 = tz1; tz1 = tmp; }
    if (tz0 > t0) t0 = tz0;
    if (tz1 < t1) t1 = tz1;
    if (t0 > t1) return false;
  }
  return true;
}

export function queryCollidersAlongSegment2D(world, x0, z0, x1, z1, pad = 1.5, out = null) {
  if (out) out.length = 0;
  else out = [];
  if (!world) return out;
  if (!world._colliderGrid) ensureColliderWorldState(world);

  const minX = Math.min(x0, x1) - pad, maxX = Math.max(x0, x1) + pad;
  const minZ = Math.min(z0, z1) - pad, maxZ = Math.max(z0, z1) + pad;
  const qid = ++world._colliderQueryId;
  const cs = world.colliderCellSize;
  const minCX = Math.floor(minX / cs), maxCX = Math.floor(maxX / cs);
  const minCZ = Math.floor(minZ / cs), maxCZ = Math.floor(maxZ / cs);
  const filterCells = (maxCX - minCX) > 2 && (maxCZ - minCZ) > 2;

  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cz = minCZ; cz <= maxCZ; cz++) {
      if (filterCells && !segmentIntersectsCell2D(x0, z0, x1, z1, cx * cs - pad, (cx + 1) * cs + pad, cz * cs - pad, (cz + 1) * cs + pad)) {
        continue;
      }
      const bucket = world._colliderGrid.get(packColliderCell(cx, cz));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const col = bucket[i];
        if (col.disabled || col._qid === qid) continue;
        col._qid = qid;
        out.push(col);
      }
    }
  }

  const dyn = world._dynamicColliders;
  for (let i = 0; i < dyn.length; i++) {
    const col = dyn[i];
    if (col.disabled || col._qid === qid) continue;
    if (col.maxX >= minX && col.minX <= maxX && col.maxZ >= minZ && col.minZ <= maxZ) {
      col._qid = qid;
      out.push(col);
    }
  }
  return out;
}
