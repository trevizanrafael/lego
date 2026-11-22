/**
 * WorldSpatialColliderGrid.js
 * Fachada fina retrocompatível (`TestBlockWorld.prototype`) para o subsistema modular
 * `src/world/collision/` (células 32m x 32m, formas 'box'/'obb'/'cylinder', sweeps e raycast 3D).
 */

import {
  packColliderCell,
  addBoxCollider,
  addObbCollider,
  addCylinderCollider,
  addTieredCollider,
  promoteDynamicCollider,
  updateDynamicCollider,
  removeCollider,
  queryCollidersNear2D,
  queryCollidersAlongSegment2D
} from '../collision/CollisionWorldIndex.js';
import {
  projectSlideVelocity2D,
  overlapCapsule,
  resolveCapsulePenetration,
  overlapOrientedBox,
  resolveObbPenetration,
  sweepSphere,
  sweepOrientedBox,
  raycast3D
} from '../collision/CollisionQueries.js';

export { packColliderCell, projectSlideVelocity2D };

export const worldSpatialColliderMethods = {
  addCollider(x, z, width, depth, height = 10, minY = 0, opts = {}) {
    return addBoxCollider(this, x, z, width, depth, height, minY, opts);
  },

  addObbCollider(cx, cz, width, depth, yaw = 0, maxY = 10, minY = 0, opts = {}) {
    return addObbCollider(this, cx, cz, width, depth, yaw, maxY, minY, opts);
  },

  addCylinderCollider(cx, cz, radius, maxY = 10, minY = 0, opts = {}) {
    return addCylinderCollider(this, cx, cz, radius, maxY, minY, opts);
  },

  addTieredCollider(x, z, tiers = [], opts = {}) {
    return addTieredCollider(this, x, z, tiers, opts);
  },

  promoteDynamicCollider(col) {
    return promoteDynamicCollider(this, col);
  },

  updateDynamicCollider(col, patch = null) {
    return updateDynamicCollider(this, col, patch);
  },

  removeCollider(col) {
    return removeCollider(this, col);
  },

  getCollidersNear(x, z, radius = 2.5, out = null) {
    return queryCollidersNear2D(this, x, z, radius, out);
  },

  getCollidersAlongRay2D(x0, z0, x1, z1, pad = 1.5, out = null) {
    return queryCollidersAlongSegment2D(this, x0, z0, x1, z1, pad, out);
  },

  overlapCapsule(pos, radius, height, opts = {}) {
    return overlapCapsule(this, pos, radius, height, opts);
  },

  resolveCapsulePenetration(pos, radius, height, opts = {}) {
    return resolveCapsulePenetration(this, pos, radius, height, opts);
  },

  overlapOrientedBox(cx, cz, halfX, halfZ, yaw, minY, maxY, opts = {}) {
    return overlapOrientedBox(this, cx, cz, halfX, halfZ, yaw, minY, maxY, opts);
  },

  resolveObbPenetration(cx, cz, halfX, halfZ, yaw, minY, maxY, opts = {}) {
    return resolveObbPenetration(this, cx, cz, halfX, halfZ, yaw, minY, maxY, opts);
  },

  sweepSphere(from, to, radius, opts = {}) {
    return sweepSphere(this, from, to, radius, opts);
  },

  sweepOrientedBox(from, to, halfX, halfZ, yaw, minY, maxY, opts = {}) {
    return sweepOrientedBox(this, from, to, halfX, halfZ, yaw, minY, maxY, opts);
  },

  raycast3D(from, to, opts = {}) {
    return raycast3D(this, from, to, opts);
  },

  projectSlideVelocity2D(vx, vz, nx, nz, friction = 0, out = null) {
    return projectSlideVelocity2D(vx, vz, nx, nz, friction, out);
  }
};
