import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { HUMANOID_STATES } from './HumanoidHealthModel.js';
import { applyHumanoidHitPose, resetHumanoidLimbPose } from './HumanoidHitReactions.js';

export const MAX_CORPSES = 12;
export const CORPSE_LIFETIME_SEC = 20.0;
export const CORPSE_FADE_DURATION_SEC = 2.5;
export const CORPSE_FADE_START_SEC = CORPSE_LIFETIME_SEC - CORPSE_FADE_DURATION_SEC;
export const BLOOD_POOL_GROW_SEC = 1.8;
export const MIN_OUT_OF_SIGHT_DIST = 75.0;

const SHARED_BLOOD_POOL_GEO = markAsSharedAsset(
  new THREE.CircleGeometry(1.0, 18).rotateX(-Math.PI / 2)
);
const BLOOD_POOL_HEX_VARIANTS = [0x450a0a, 0x650a0a, 0x7f1d1d];

function resolveCameraForwardXZ(controller) {
  if (controller?.cameraForward) {
    const fx = Number(controller.cameraForward.x) || 0;
    const fz = Number(controller.cameraForward.z) || 0;
    const len = Math.hypot(fx, fz);
    if (len > 0.001) return { x: fx / len, z: fz / len };
  }
  if (controller?.camera && typeof controller.camera.getWorldDirection === 'function') {
    const dir = new THREE.Vector3();
    controller.camera.getWorldDirection(dir);
    const len = Math.hypot(dir.x, dir.z);
    if (len > 0.001) return { x: dir.x / len, z: dir.z / len };
  }
  if (Number.isFinite(controller?.facingAngle)) {
    return { x: Math.sin(controller.facingAngle), z: Math.cos(controller.facingAngle) };
  }
  return { x: 0, z: 1 };
}

/**
 * Gerencia corpos caídos (civis instanciados, policiais e soldados/chefes) e poças de sangue:
 * - Limite máximo de 12 corpos simultâneos (13º ejeta imediatamente o mais antigo).
 * - Duração de 20.0s com fade nos últimos 2.5s e poça crescendo nos primeiros 1.8s.
 * - Reciclagem de civis instanciados vivos (100 HP) fora da visão do jogador.
 */
export class HumanoidCorpseManager {
  constructor(scene, livingCity = null, opts = {}) {
    this.scene = scene || null;
    this.livingCity = livingCity || null;
    this.maxCorpses = Number.isFinite(opts.maxCorpses) && opts.maxCorpses > 0
      ? Math.floor(opts.maxCorpses)
      : MAX_CORPSES;
    this.corpseLifetimeSec = Number.isFinite(opts.corpseLifetimeSec) && opts.corpseLifetimeSec > 0
      ? Number(opts.corpseLifetimeSec)
      : CORPSE_LIFETIME_SEC;
    this.onRecyclePedestrian =
      typeof opts.onRecyclePedestrian === 'function' ? opts.onRecyclePedestrian : null;

    this.corpses = [];
    this._bloodPoolFreeList = [];
    this._seedCounter = 1;
  }

  getActiveCorpseCount() {
    return this.corpses.length;
  }

  _acquireBloodPoolMesh(seed = 0) {
    let entry = this._bloodPoolFreeList.pop();
    const hex = BLOOD_POOL_HEX_VARIANTS[seed % BLOOD_POOL_HEX_VARIANTS.length];
    if (!entry) {
      const mat = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.18,
        metalness: 0.06,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
      const mesh = new THREE.Mesh(SHARED_BLOOD_POOL_GEO, mat);
      mesh.renderOrder = 1;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.userData.skipStaticMerge = true;
      entry = { mesh, mat };
    } else {
      entry.mat.color.setHex(hex);
      entry.mat.opacity = 0.92;
    }

    entry.mesh.visible = true;
    entry.mesh.scale.set(0.15, 1, 0.15);
    if (this.scene && entry.mesh.parent !== this.scene) {
      this.scene.add(entry.mesh);
    }
    return entry;
  }

  _releaseBloodPoolMesh(entry) {
    if (!entry) return;
    entry.mesh.visible = false;
    entry.mesh.parent?.remove(entry.mesh);
    this._bloodPoolFreeList.push(entry);
  }

  registerCorpse(spec = {}) {
    const isInstanced = Boolean(spec.isInstancedPedestrian);
    const ped = spec.ped || null;
    const visual = spec.visual || ped?.visual || null;
    const mesh = spec.mesh || visual?.root || null;
    const healthModel =
      spec.healthModel || ped?.humanoidHealth || spec.destructible?.humanoidHealth || null;

    if (!mesh) return null;

    for (let i = 0; i < this.corpses.length; i++) {
      const existing = this.corpses[i];
      if ((isInstanced && ped && existing.ped === ped) || (!isInstanced && existing.mesh === mesh)) {
        return existing;
      }
    }

    while (this.corpses.length >= this.maxCorpses) {
      this.evictOldestCorpse(spec.playerPos || null, spec.controller || null);
    }

    const seed = this._seedCounter++;
    const unitScale = Math.max(0.75, Number(spec.unitScale) || 1.0);
    const baseGroundY = Number.isFinite(spec.groundY)
      ? Number(spec.groundY)
      : (Number(mesh.position?.y) || 0);

    if (healthModel && healthModel.state !== HUMANOID_STATES.DEAD) {
      healthModel.state = HUMANOID_STATES.DEAD;
      healthModel.hp = 0;
    }

    const fallDirX = Number(healthModel?.fallDirX) || 0;
    const fallDirZ = Number(healthModel?.fallDirZ) || -1;

    if (isInstanced && ped) {
      ped.state = 'DEAD';
      ped.isDeadCorpse = true;
      ped._corpseSinkOffset = 0;
      ped.panicTimer = 0;
      ped.crouchPanicTimer = 0;
      if (ped.destructible) {
        ped.destructible.destroyed = true;
        ped.destructible.isDeadCorpse = true;
      }
      mesh.visible = true;
    } else {
      mesh.visible = true;
      if (spec.destructible) spec.destructible._managedByCorpseManager = true;
      if (this.scene && mesh.parent !== this.scene) this.scene.add(mesh);
    }

    if (visual && healthModel) {
      healthModel.stateElapsed = Math.max(healthModel.stateElapsed, 0.2);
      applyHumanoidHitPose(visual, healthModel, baseGroundY, 0.016, { unitScale, sinkOffset: 0 });
    }

    const bloodPool = this._acquireBloodPoolMesh(seed);
    const torsoOffset = 0.96 * unitScale;
    bloodPool.mesh.position.set(
      mesh.position.x + fallDirX * torsoOffset,
      baseGroundY + 0.025,
      mesh.position.z + fallDirZ * torsoOffset
    );
    bloodPool.mesh.rotation.y = (seed * 1.37) % (Math.PI * 2);

    const corpse = {
      id: seed,
      isInstancedPedestrian: isInstanced,
      ped,
      visual,
      mesh,
      destructible: spec.destructible || ped?.destructible || null,
      healthModel,
      groundY: baseGroundY,
      unitScale,
      initialMeshScale: mesh.scale?.x || 1.0,
      bloodPool,
      maxPoolScale: (0.88 + (seed % 4) * 0.05) * Math.min(1.75, unitScale),
      stretchX: 0.92 + (seed % 3) * 0.09,
      stretchZ: 1.08 - (seed % 3) * 0.06,
      age: 0,
      lifetime: this.corpseLifetimeSec,
      onRecycle: typeof spec.onRecycle === 'function' ? spec.onRecycle : null
    };

    this.corpses.push(corpse);
    return corpse;
  }

  evictOldestCorpse(playerPos = null, controller = null) {
    if (this.corpses.length === 0) return null;
    return this._removeCorpseAt(0, playerPos, controller);
  }

  _computeOutOfSightSpawn(playerPos, controller, seed = 0) {
    const px = Number(playerPos?.x) || 0;
    const pz = Number(playerPos?.z) || 0;
    const camFwd = resolveCameraForwardXZ(controller);
    const rearAngle = Math.atan2(-camFwd.x, -camFwd.z);
    const lc = this.livingCity;

    if (lc && typeof lc._isValidDryLandForPedestrian === 'function') {
      for (let attempt = 0; attempt < 12; attempt++) {
        const spread = (attempt % 2 === 0 ? 1 : -1) * Math.ceil(attempt / 2) * 0.36;
        const ang = rearAngle + spread;
        const dist = 80.0 + ((seed * 13 + attempt * 17) % 32);
        const candX = px + Math.sin(ang) * dist;
        const candZ = pz + Math.cos(ang) * dist;

        if (!lc._isValidDryLandForPedestrian(candX, candZ)) continue;
        const safe = typeof lc._findSafeStreetSpawn === 'function'
          ? lc._findSafeStreetSpawn(candX, candZ, 1.8)
          : { x: candX, z: candZ, valid: true };
        if (safe.valid === false) continue;

        const actualDx = safe.x - px;
        const actualDz = safe.z - pz;
        const actualDist = Math.hypot(actualDx, actualDz);
        const dotCam = (actualDx * camFwd.x + actualDz * camFwd.z) / Math.max(0.001, actualDist);

        if (actualDist >= MIN_OUT_OF_SIGHT_DIST || (actualDist >= 45.0 && dotCam < -0.25)) {
          const terrainY = lc.world?.getTerrainHeightAt
            ? lc.world.getTerrainHeightAt(safe.x, safe.z)
            : 0;
          const groundY = typeof lc._getPedestrianGroundY === 'function'
            ? lc._getPedestrianGroundY(safe.x, safe.z, terrainY)
            : Math.max(0, terrainY);
          return { x: safe.x, y: groundY, z: safe.z, terrainY, angle: ang };
        }
      }
    }

    const fallbackDist = 84.0 + (seed % 16);
    const fx = px - camFwd.x * fallbackDist;
    const fz = pz - camFwd.z * fallbackDist;
    const terrainY = lc?.world?.getTerrainHeightAt ? lc.world.getTerrainHeightAt(fx, fz) : 0;
    return { x: fx, y: Math.max(0, terrainY), z: fz, terrainY, angle: rearAngle };
  }

  _recycleInstancedCivilian(corpse, playerPos, controller) {
    const ped = corpse.ped;
    if (!ped) return;
    const spawn = this._computeOutOfSightSpawn(playerPos, controller, corpse.id);
    const lc = this.livingCity;

    if (lc && typeof lc.recycleDeadPedestrianOutOfSight === 'function') {
      lc.recycleDeadPedestrianOutOfSight(ped, spawn);
    } else {
      const root = ped.visual?.root;
      if (root) {
        root.position.set(spawn.x, spawn.y, spawn.z);
        root.rotation.set(0, 0, 0);
        root.scale.set(1, 1, 1);
        root.visible = true;
      }
      resetHumanoidLimbPose(ped.visual);
      ped.isDeadCorpse = false;
      ped._corpseSinkOffset = 0;
      ped.state = 'NORMAL';
      ped.panicTimer = 0;
      ped.crouchPanicTimer = 0;
      ped.humanoidHealth?.reset(100);
      if (ped.destructible) {
        ped.destructible.hp = 100;
        ped.destructible.maxHp = 100;
        ped.destructible.destroyed = false;
        ped.destructible.isDeadCorpse = false;
        ped.destructible.basePos?.set(spawn.x, spawn.y, spawn.z);
        ped.destructible.groundY = spawn.terrainY;
      }
    }

    if (corpse.onRecycle) corpse.onRecycle(ped, spawn);
    if (this.onRecyclePedestrian) this.onRecyclePedestrian(ped, spawn);
  }

  _removeCorpseAt(index, playerPos = null, controller = null) {
    if (index < 0 || index >= this.corpses.length) return null;
    const [corpse] = this.corpses.splice(index, 1);
    this._releaseBloodPoolMesh(corpse.bloodPool);

    if (corpse.isInstancedPedestrian) {
      this._recycleInstancedCivilian(corpse, playerPos, controller);
    } else {
      if (corpse.destructible) corpse.destructible._managedByCorpseManager = false;
      if (corpse.mesh) {
        corpse.mesh.scale?.setScalar(corpse.initialMeshScale);
        corpse.mesh.parent?.remove(corpse.mesh);
      }
      if (corpse.onRecycle) corpse.onRecycle(corpse);
    }
    return corpse;
  }

  update(dt, playerPos = null, controller = null) {
    const step = Math.max(0, Number(dt) || 0);
    if (step <= 0 || this.corpses.length === 0) return;

    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.age += step;
      if (c.age >= c.lifetime) {
        this._removeCorpseAt(i, playerPos, controller);
        continue;
      }

      if (!c.isInstancedPedestrian && c.mesh && this.scene && c.mesh.parent !== this.scene) {
        this.scene.add(c.mesh);
      }
      if (c.healthModel) c.healthModel.stateElapsed += step;

      const growT = Math.min(1, c.age / BLOOD_POOL_GROW_SEC);
      let poolScale = 0.15 + (c.maxPoolScale - 0.15) * (1 - (1 - growT) * (1 - growT));
      let poolOpacity = 0.92;
      let sinkOffset = 0;

      const fadeStart = Math.max(0, c.lifetime - CORPSE_FADE_DURATION_SEC);
      if (c.age > fadeStart) {
        const fadeT = Math.min(1, (c.age - fadeStart) / CORPSE_FADE_DURATION_SEC);
        sinkOffset = fadeT * 0.25;
        poolOpacity = 0.92 * (1 - fadeT);
        poolScale *= 1 - fadeT * 0.35;
        c.mesh?.scale?.setScalar(
          (c.isInstancedPedestrian ? 1.0 : c.initialMeshScale) * (1 - fadeT * 0.20)
        );
      }

      if (c.bloodPool?.mesh) {
        c.bloodPool.mesh.scale.set(poolScale * c.stretchX, 1, poolScale * c.stretchZ);
        c.bloodPool.mat.opacity = Math.max(0, poolOpacity);
      }
      if (c.isInstancedPedestrian && c.ped) c.ped._corpseSinkOffset = sinkOffset;
      if (c.visual && c.healthModel) {
        applyHumanoidHitPose(c.visual, c.healthModel, c.groundY, step, {
          unitScale: c.unitScale,
          sinkOffset
        });
      }
    }
  }

  clearAll(playerPos = null, controller = null) {
    while (this.corpses.length > 0) {
      this._removeCorpseAt(this.corpses.length - 1, playerPos, controller);
    }
  }
}
