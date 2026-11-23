import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { optimizeStaticGroupMeshes } from '../BuildingGenerator.js';
import { restoreDefaultOccupants, disembarkOccupants } from '../vehicles/VehicleOccupants.js';

export const FIREBALL_GEO = markAsSharedAsset(new THREE.SphereGeometry(0.34, 14, 14));
export const TRAIL_CUBE_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.24, 0.24, 0.24));
export const SHARED_UNIT_CYL_6 = markAsSharedAsset(new THREE.CylinderGeometry(1, 1, 1, 6));
export const SHARED_UNIT_SPHERE_10 = markAsSharedAsset(new THREE.SphereGeometry(1, 10, 10));
export const SHARED_UNIT_SPHERE_20 = markAsSharedAsset(new THREE.SphereGeometry(1, 20, 20));
export const _TMP_IMPACT_VEC = new THREE.Vector3();

export function packGridCell(cx, cz) {
  return ((cx & 0xffff) << 16) | (cz & 0xffff);
}

export const DESTRUCTIBLE_REGISTRY_AND_CULLING_METHODS = {
  registerDestructible({
    mesh, type, hp = 30, radius = 1.4, height = 2.0, colliders = [],
    debrisColors = [LEGO_COLORS.red, LEGO_COLORS.lightGrey],
    studDrops = { silver: 4, gold: 2, blue: 0, purple: 0 },
    groundY = 0.26, goldOnly = false, crackedWallOnly = false, silverOnly = false,
    isStreetProp = false, chaosValue = 0, isPoliceUnit = false, isFactionWarUnit = false, noAutoRespawn = false
  }) {
    const basePos = mesh.position.clone();
    const baseRot = mesh.rotation.clone();
    if (
      mesh && !mesh.userData?.isOptimizedGroup && !mesh.userData?.skipStaticMerge &&
      type !== 'npc_fighter' && type !== 'npc_boss' && type !== 'pedestrian_civilian' &&
      type !== 'police_helicopter' && type !== 'hunter_drone'
    ) {
      optimizeStaticGroupMeshes(mesh, mesh.userData?._occupantsGroup ? [mesh.userData._occupantsGroup] : []);
    }
    if (isStreetProp && mesh) {
      mesh.traverse((c) => { if (c.isMesh) c.castShadow = false; });
    }

    const isDynamic =
      type === 'car' || type === 'npc_fighter' || type === 'npc_boss' ||
      type === 'pedestrian_civilian' || type === 'police_helicopter' ||
      type === 'hunter_drone' || Boolean(isPoliceUnit) || Boolean(isFactionWarUnit);

    const item = {
      mesh, type, hp, maxHp: hp, radius, height, colliders, debrisColors, studDrops, groundY,
      goldOnly, crackedWallOnly, silverOnly, isStreetProp: Boolean(isStreetProp), chaosValue,
      isPoliceUnit: Boolean(isPoliceUnit), isFactionWarUnit: Boolean(isFactionWarUnit),
      noAutoRespawn: Boolean(noAutoRespawn), _isDynamicIndexed: isDynamic, _spatialCellKey: null,
      heatLevel: 0, occupants: [], _occupantsGroup: null, driverKilled: false,
      isBurning: false, engineFireTimer: 0, isBurnedWreck: false, wreckTimer: 0,
      damageStage: 'intact', basePos, baseRot, destroyed: false, shakeTimer: 0, respawnTimer: 0
    };

    this.objects.push(item);

    if (isDynamic) {
      this._dynamicObjects.push(item);
      if (Array.isArray(colliders) && this.world?.promoteDynamicCollider) {
        for (let ci = 0; ci < colliders.length; ci++) {
          this.world.promoteDynamicCollider(colliders[ci]);
        }
      }
    } else {
      const cx = Math.floor(basePos.x / this.spatialCellSize);
      const cz = Math.floor(basePos.z / this.spatialCellSize);
      const key = packGridCell(cx, cz);
      item._spatialCellKey = key;
      let bucket = this._spatialGrid.get(key);
      if (!bucket) {
        bucket = [];
        this._spatialGrid.set(key, bucket);
      }
      bucket.push(item);
    }

    return item;
  },

  wakeObjectMatrix(mesh) {
    if (!mesh) return;
    let cur = mesh;
    while (cur && cur !== this.scene) {
      cur.matrixAutoUpdate = true;
      cur.matrixWorldAutoUpdate = true;
      cur.matrixWorldNeedsUpdate = true;
      cur = cur.parent;
    }
  },

  freezeObjectMatrix(mesh) {
    if (!mesh || mesh.userData?._keepDynamicMatrix) return;
    mesh.updateMatrix();
    mesh.updateMatrixWorld(true);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
  },

  _spawnFxParticle(geo, colorHex, opacity, px, py, pz, sx, sy, sz, vx, vy, vz, life, maxLife = life) {
    let entry = this._fxPool.pop();
    if (entry) {
      entry.mesh.geometry = geo;
      entry.mesh.material.color.setHex(colorHex);
      entry.mesh.material.opacity = opacity;
      entry.mesh.position.set(px, py, pz);
      entry.mesh.rotation.set(0, 0, 0);
      entry.mesh.scale.set(sx, sy, sz);
      entry.vel.set(vx, vy, vz);
      entry.life = life;
      entry.maxLife = maxLife;
    } else {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.scale.set(sx, sy, sz);
      entry = {
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        life,
        maxLife,
        _pooled: true
      };
    }
    this.scene.add(entry.mesh);
    this.fxParticles.push(entry);
    return entry;
  },

  unregisterDestructible(item) {
    if (!item) return;
    this._clearVehicleBurnedWreckState?.(item, true);
    item.destroyed = true;
    item.noAutoRespawn = true;
    if (Array.isArray(item.colliders)) {
      for (const col of item.colliders) {
        if (col) col.disabled = true;
      }
    }
    if (item.mesh && item.mesh.parent) {
      item.mesh.parent.remove(item.mesh);
    }
    if (typeof item.onUnregistered === 'function') {
      item.onUnregistered(item);
    }
    if (item._isDynamicIndexed) {
      const dynIdx = this._dynamicObjects.indexOf(item);
      if (dynIdx !== -1) this._dynamicObjects.splice(dynIdx, 1);
    } else if (item._spatialCellKey !== null && item._spatialCellKey !== undefined) {
      const bucket = this._spatialGrid.get(item._spatialCellKey);
      if (bucket) {
        const bIdx = bucket.indexOf(item);
        if (bIdx !== -1) bucket.splice(bIdx, 1);
      }
    }
    const idx = this.objects.indexOf(item);
    if (idx !== -1) {
      this.objects.splice(idx, 1);
    }
  },

  removeDestructible(item) {
    return this.unregisterDestructible(item);
  },

  /**
   * Consulta espacial O(1) nas células vizinhas de 36m + objetos móveis (60 FPS cravados com ~450+ props!)
   */
  getObjectsNear(x, z, range = 12, out = null) {
    if (out) {
      out.length = 0;
    } else {
      out = [];
    }
    const pad = range + 4.5;
    const minCX = Math.floor((x - pad) / this.spatialCellSize);
    const maxCX = Math.floor((x + pad) / this.spatialCellSize);
    const minCZ = Math.floor((z - pad) / this.spatialCellSize);
    const maxCZ = Math.floor((z + pad) / this.spatialCellSize);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const bucket = this._spatialGrid.get(packGridCell(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const obj = bucket[i];
          if (!obj.destroyed) out.push(obj);
        }
      }
    }

    const padSq = (pad + 6.0) * (pad + 6.0);
    for (let i = 0; i < this._dynamicObjects.length; i++) {
      const obj = this._dynamicObjects[i];
      if (obj.destroyed) continue;
      const ox = obj.mesh?.position?.x ?? obj.basePos.x;
      const oz = obj.mesh?.position?.z ?? obj.basePos.z;
      const dx = ox - x;
      const dz = oz - z;
      if (dx * dx + dz * dz <= padSq) {
        out.push(obj);
      }
    }
    return out;
  },

  _restoreObject(obj) {
    this._clearVehicleBurnedWreckState?.(obj, false);
    obj.destroyed = false;
    obj.hp = obj.maxHp;
    obj.heatLevel = 0;
    obj.shakeTimer = 0;
    obj.driverKilled = false;
    obj._lastDamagedByPlayer = false;
    obj._bailedOutFromFire = false;
    obj.mesh.visible = true;
    obj.mesh.position.copy(obj.basePos);
    obj.mesh.rotation.copy(obj.baseRot);
    obj.mesh.scale.set(1, 1, 1);
    if (obj._defaultOccupantOpts) {
      restoreDefaultOccupants(obj);
    }
    if (obj._isDynamicIndexed) {
      obj.mesh.matrixWorldAutoUpdate = true;
    } else if (this.scene?.matrixAutoUpdate === false) {
      this.freezeObjectMatrix(obj.mesh);
    }
    if (obj._syncInstancedVisual) {
      obj._syncInstancedVisual(obj);
      this._flushStreetPropInstancedBatches?.();
    }
    for (const col of obj.colliders) {
      col.disabled = false;
    }
  },

  _cullSingleObject(obj, px, pz, cameraForward, ignoreHysteresis = false) {
    const refX = obj._isDynamicIndexed ? (obj.mesh?.position?.x ?? obj.basePos.x) : obj.basePos.x;
    const refZ = obj._isDynamicIndexed ? (obj.mesh?.position?.z ?? obj.basePos.z) : obj.basePos.z;
    const dx = refX - px;
    const dz = refZ - pz;
    const distSq = dx * dx + dz * dz;
    let baseDist =
      obj.type === 'car'
        ? 175
        : obj.type === 'police_helicopter'
          ? 245
          : obj.isStreetProp
            ? 142
            : 215;
    if (this.hud?.isSniperScopeActive && cameraForward && distSq > baseDist * baseDist) {
      const fwdDot = dx * cameraForward.x + dz * cameraForward.z;
      if (fwdDot > 0 && fwdDot * fwdDot >= 0.84 * distSq) baseDist = 1350;
    }
    const hyst = obj.isStreetProp ? 28 : 26;
    const cullDist = !ignoreHysteresis && obj.mesh.visible ? baseDist + hyst : baseDist;
    const shouldBeVisible = distSq <= cullDist * cullDist;
    if (obj.mesh.visible !== shouldBeVisible) {
      obj.mesh.visible = shouldBeVisible;
      if (obj._isDynamicIndexed) obj.mesh.matrixWorldAutoUpdate = shouldBeVisible;
      if (obj._syncInstancedVisual) obj._syncInstancedVisual(obj);
    }
    return shouldBeVisible;
  },

  _cullSpatialWindow(centerX, centerZ, cellRadius, px, pz, cameraForward) {
    const cx0 = Math.floor(centerX / this.spatialCellSize);
    const cz0 = Math.floor(centerZ / this.spatialCellSize);
    for (let cx = cx0 - cellRadius; cx <= cx0 + cellRadius; cx++) {
      for (let cz = cz0 - cellRadius; cz <= cz0 + cellRadius; cz++) {
        const bucket = this._spatialGrid.get(packGridCell(cx, cz));
        if (!bucket) continue;
        for (let bi = 0; bi < bucket.length; bi++) {
          const obj = bucket[bi];
          if (!obj.destroyed && !obj.isDriven && !obj.isGrabbed) {
            this._cullSingleObject(obj, px, pz, cameraForward, false);
          }
        }
      }
    }
  },

  _updateCullingShakeAndRespawn(dt, playerPosition, cameraForward = null) {
    const totalObjs = this.objects.length;
    const sliceSize = Math.min(totalObjs, 220);
    const sliceStart = this._cullSliceCursor < totalObjs ? this._cullSliceCursor : 0;
    const sliceEnd = Math.min(totalObjs, sliceStart + sliceSize);
    this._cullSliceCursor = sliceEnd >= totalObjs ? 0 : sliceEnd;

    let runInitialCull = false;
    let isFirstBootCull = false;
    if (playerPosition) {
      const px = playerPosition.x;
      const pz = playerPosition.z;
      if (!this._initialCullDone) {
        this._initialCullDone = true;
        runInitialCull = true;
        isFirstBootCull = true;
      } else {
        const jdx = px - this._lastCullX;
        const jdz = pz - this._lastCullZ;
        const jumpDistSq = jdx * jdx + jdz * jdz;
        if (jumpDistSq > 140 * 140) {
          runInitialCull = true;
        } else if (jumpDistSq > 18 * 18) {
          this._cullSpatialWindow(this._lastCullX, this._lastCullZ, 11, px, pz, cameraForward);
          this._cullSpatialWindow(px, pz, 11, px, pz, cameraForward);
        }
      }
      this._lastCullX = px;
      this._lastCullZ = pz;
    }

    // Tremor, distance culling fatiado determinístico (220/frame) e auto-reconstrução LEGO (45s)
    for (let oi = 0; oi < totalObjs; oi++) {
      const obj = this.objects[oi];
      if (obj.destroyed) {
        if (obj.isBurnedWreck || obj.noAutoRespawn) continue;
        if (obj.isStreetProp && playerPosition) {
          const dx = obj.basePos.x - playerPosition.x;
          const dz = obj.basePos.z - playerPosition.z;
          const distSq = dx * dx + dz * dz;
          let outOfView = distSq >= 48 * 48;
          if (!outOfView && cameraForward && distSq >= 18 * 18) {
            const dot = dx * cameraForward.x + dz * cameraForward.z;
            if (dot < -0.1) outOfView = true;
          }
          if (outOfView) {
            obj.respawnTimer -= dt;
            if (obj.respawnTimer <= 0) this._restoreObject(obj);
          }
          continue;
        }
        obj.respawnTimer -= dt;
        if (obj.respawnTimer <= 0) this._restoreObject(obj);
        continue;
      }

      if (obj.isDriven || obj.isGrabbed) {
        if (obj.occupants && obj.occupants.length > 0) disembarkOccupants(obj, Infinity);
        obj.mesh.visible = true;
        if (obj._isDynamicIndexed) obj.mesh.matrixWorldAutoUpdate = true;
        continue;
      }

      const inCullSlice = runInitialCull || (oi >= sliceStart && oi < sliceEnd);
      const bypassSlice = obj._isDynamicIndexed || obj.shakeTimer > 0 || obj.isBurning;
      if (playerPosition && (inCullSlice || bypassSlice)) {
        if (!this._cullSingleObject(obj, playerPosition.x, playerPosition.z, cameraForward, isFirstBootCull)) continue;
      } else if (!obj.mesh.visible) {
        continue;
      }

      if (obj.shakeTimer > 0) {
        obj.shakeTimer -= dt;
        if (obj.shakeTimer <= 0) {
          obj.shakeTimer = 0;
          obj.mesh.position.copy(obj.basePos);
          obj.mesh.rotation.copy(obj.baseRot);
          if (obj._syncInstancedVisual) {
            obj._syncInstancedVisual(obj);
          } else if (!obj._isDynamicIndexed) {
            this.freezeObjectMatrix(obj.mesh);
          }
        } else {
          const intensity = obj.shakeTimer * 0.45;
          obj.mesh.position.x = obj.basePos.x + (Math.random() - 0.5) * intensity;
          obj.mesh.position.z = obj.basePos.z + (Math.random() - 0.5) * intensity;
          obj.mesh.rotation.z = (Math.random() - 0.5) * intensity * 0.5;
          if (obj._syncInstancedVisual) obj._syncInstancedVisual(obj);
        }
      }
    }
    this._flushStreetPropInstancedBatches?.();
  }
};
