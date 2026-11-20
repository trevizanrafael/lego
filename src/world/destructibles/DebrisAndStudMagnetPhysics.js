import * as THREE from 'three';
import {
  SHARED_STUD_GEO,
  getLegoMaterial,
  markAsSharedAsset,
  disposeTransientObject3D
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries } from '../BuildingGenerator.js';
import { soundFX } from '../../audio/SoundFX.js';

export const STUD_TIERS = {
  silver: {
    tier: 'silver',
    value: 10,
    color: 0xe2e8f0,
    emissive: 0x64748b,
    emissiveIntensity: 0.2,
    metalness: 0.65,
    roughness: 0.18
  },
  gold: {
    tier: 'gold',
    value: 100,
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.3,
    metalness: 0.55,
    roughness: 0.16
  },
  blue: {
    tier: 'blue',
    value: 1000,
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.45,
    metalness: 0.35,
    roughness: 0.14
  },
  purple: {
    tier: 'purple',
    value: 10000,
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.55,
    metalness: 0.4,
    roughness: 0.12
  }
};

const STUD_BASE_GEO = new THREE.CylinderGeometry(0.28, 0.28, 0.11, 10);
const STUD_TOP_GEO = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 10);
STUD_TOP_GEO.translate(0, 0.085, 0);
const STUD_COIN_GEO = markAsSharedAsset(mergeBufferGeometries([STUD_BASE_GEO, STUD_TOP_GEO]));

export const DEBRIS_GEOS = [
  markAsSharedAsset(new THREE.BoxGeometry(0.55, 0.32, 0.55)),
  markAsSharedAsset(new THREE.BoxGeometry(0.85, 0.28, 0.45)),
  markAsSharedAsset(new THREE.BoxGeometry(0.42, 0.42, 0.42)),
  markAsSharedAsset(new THREE.CylinderGeometry(0.22, 0.22, 0.35, 12))
];
export const DEBRIS_BRICK_GEO = DEBRIS_GEOS[0];
export const DEBRIS_STUD_GEO = DEBRIS_GEOS[3];

const _PLAYER_CHEST_VEC = new THREE.Vector3();
const _STUD_DIR_VEC = new THREE.Vector3();
const _INST_ZERO_MAT = new THREE.Matrix4().makeScale(0, 0, 0);
const _INST_MAT4 = new THREE.Matrix4();
const _INST_QUAT = new THREE.Quaternion();
const _INST_SCALE_ONE = new THREE.Vector3(1, 1, 1);

export const DEBRIS_AND_STUD_MAGNET_METHODS = {
  _getOrCreateAmbientStudPool(tierKey, tierCfg) {
    let pool = this._ambientStudPools.get(tierKey);
    if (pool && pool.items.length < pool.capacity) {
      return pool;
    }

    const oldItems = pool ? pool.items : [];
    const oldInst = pool ? pool.inst : null;
    const capacity = pool ? pool.capacity * 2 : 128;

    const mat = getLegoMaterial(tierCfg.color, {
      roughness: tierCfg.roughness,
      metalness: tierCfg.metalness,
      clearcoat: 0.65,
      emissive: tierCfg.emissive,
      emissiveIntensity: tierCfg.emissiveIntensity
    });
    const inst = new THREE.InstancedMesh(STUD_COIN_GEO, mat, capacity);
    inst.count = oldItems.length;
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = false;
    inst.matrixAutoUpdate = false;
    inst.updateMatrix();

    if (oldInst) {
      for (let i = 0; i < oldItems.length; i++) {
        oldInst.getMatrixAt(i, _INST_MAT4);
        inst.setMatrixAt(i, _INST_MAT4);
      }
      inst.instanceMatrix.needsUpdate = true;
      this.scene.remove(oldInst);
      oldInst.dispose?.();
    }

    this.scene.add(inst);
    pool = { tierKey, inst, mat, capacity, items: oldItems, dirty: false };
    this._ambientStudPools.set(tierKey, pool);
    return pool;
  },

  _writeAmbientStudMatrix(stud, forceZero = false) {
    const pool = stud._instPool;
    if (!pool) return;
    if (forceZero || stud.collected || !stud.mesh.visible) {
      pool.inst.setMatrixAt(stud._instIdx, _INST_ZERO_MAT);
    } else {
      _INST_QUAT.setFromEuler(stud.mesh.rotation);
      _INST_MAT4.compose(stud.mesh.position, _INST_QUAT, _INST_SCALE_ONE);
      pool.inst.setMatrixAt(stud._instIdx, _INST_MAT4);
    }
    pool.dirty = true;
  },

  spawnAmbientStud(x, y, z, tierKey = 'gold') {
    if (x && typeof x === 'object' && 'x' in x) {
      if (typeof y === 'string') tierKey = y;
      z = x.z;
      y = x.y;
      x = x.x;
    }
    const resolvedKey = STUD_TIERS[tierKey] ? tierKey : 'gold';
    const tierCfg = STUD_TIERS[resolvedKey];
    const pool = this._getOrCreateAmbientStudPool(resolvedKey, tierCfg);

    const mesh = new THREE.Object3D();
    mesh.position.set(x, y, z);
    mesh.rotation.z = 0.22;

    const instIdx = pool.items.length;
    const stud = {
      mesh,
      basePos: new THREE.Vector3(x, y, z),
      tier: tierCfg.tier,
      value: tierCfg.value,
      magnetized: false,
      collected: false,
      _instPool: pool,
      _instIdx: instIdx,
      _wasInstVisible: true
    };
    pool.items.push(stud);
    pool.inst.count = pool.items.length;
    this._writeAmbientStudMatrix(stud, false);
    pool.inst.instanceMatrix.needsUpdate = true;
    pool.dirty = false;

    this.ambientStuds.push(stud);
    return stud;
  },

  _spawnDebris(obj, count, scaleFactor = 1.0) {
    const center = obj.basePos.clone();
    center.y += Math.min(1.2, obj.height * 0.45);

    for (let i = 0; i < count; i++) {
      const colorHex = obj.debrisColors[i % obj.debrisColors.length];
      const mat = getLegoMaterial(colorHex, { roughness: 0.22, clearcoat: 0.45 });
      const geo = DEBRIS_GEOS[i % DEBRIS_GEOS.length];

      const pieceGroup = new THREE.Group();
      const body = new THREE.Mesh(geo, mat);
      body.castShadow = false;
      pieceGroup.add(body);

      if (i % 4 !== 3) {
        const stud = new THREE.Mesh(SHARED_STUD_GEO, mat);
        stud.position.y = 0.16;
        pieceGroup.add(stud);
      }

      const angle = Math.random() * Math.PI * 2;
      const horizSpeed = (2.2 + Math.random() * 5.8) * scaleFactor;

      pieceGroup.position.set(
        center.x + (Math.random() - 0.5) * obj.radius * 0.8,
        center.y + Math.random() * 0.6,
        center.z + (Math.random() - 0.5) * obj.radius * 0.8
      );

      this.scene.add(pieceGroup);

      this.debrisList.push({
        mesh: pieceGroup,
        vel: new THREE.Vector3(
          Math.cos(angle) * horizSpeed,
          4.2 + Math.random() * 6.5 * scaleFactor,
          Math.sin(angle) * horizSpeed
        ),
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14
        ),
        groundY: obj.groundY + 0.16,
        life: 3.2 + Math.random() * 1.4,
        maxLife: 4.6
      });
    }
  },

  spawnRewardStudFountain(origin, groundY = 0, studDrops = { purple: 6, blue: 14, gold: 18 }) {
    this._spawnStudShower({
      basePos: origin.clone(),
      groundY,
      studDrops
    });
  },

  _spawnStudShower(obj) {
    const drops = obj.studDrops;
    const tiersToSpawn = [];

    for (const [tierKey, count] of Object.entries(drops)) {
      for (let i = 0; i < count; i++) {
        tiersToSpawn.push(STUD_TIERS[tierKey] || STUD_TIERS.silver);
      }
    }

    const origin = obj.basePos.clone();
    origin.y += 0.65;

    tiersToSpawn.forEach((tierCfg, idx) => {
      const studGroup = this._createStudMesh(tierCfg);
      const angle = (idx / Math.max(1, tiersToSpawn.length)) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const speed = 2.0 + Math.random() * 4.4;

      studGroup.position.set(
        origin.x + Math.cos(angle) * 0.35,
        origin.y + Math.random() * 0.4,
        origin.z + Math.sin(angle) * 0.35
      );

      this.scene.add(studGroup);

      this.studsList.push({
        mesh: studGroup,
        tier: tierCfg.tier,
        value: tierCfg.value,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          5.5 + Math.random() * 4.2,
          Math.sin(angle) * speed
        ),
        groundY: obj.groundY + 0.14,
        age: 0,
        magnetized: false
      });
    });
  },

  _createStudMesh(tierCfg) {
    const mat = getLegoMaterial(tierCfg.color, {
      roughness: tierCfg.roughness,
      metalness: tierCfg.metalness,
      clearcoat: 0.65,
      emissive: tierCfg.emissive,
      emissiveIntensity: tierCfg.emissiveIntensity
    });

    const coinMesh = new THREE.Mesh(STUD_COIN_GEO, mat);
    coinMesh.rotation.z = 0.22;
    return coinMesh;
  },

  _updateDebrisAndStuds(dt, playerPosition) {
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.life -= dt;

      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        disposeTransientObject3D(d.mesh);
        this.debrisList.splice(i, 1);
        continue;
      }

      d.vel.y -= 24.0 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotVel.x * dt;
      d.mesh.rotation.y += d.rotVel.y * dt;
      d.mesh.rotation.z += d.rotVel.z * dt;

      if (d.mesh.position.y <= d.groundY) {
        d.mesh.position.y = d.groundY;
        if (Math.abs(d.vel.y) > 1.2) {
          d.vel.y = -d.vel.y * 0.48;
        } else {
          d.vel.y = 0;
        }
        d.vel.x *= 0.78;
        d.vel.z *= 0.78;
        d.rotVel.multiplyScalar(0.75);
      }

      if (d.life < 0.6) {
        const s = Math.max(0.01, d.life / 0.6);
        d.mesh.scale.setScalar(s);
      }
    }

    const playerChest = _PLAYER_CHEST_VEC.set(
      playerPosition.x,
      playerPosition.y + 1.1,
      playerPosition.z
    );

    for (let i = this.studsList.length - 1; i >= 0; i--) {
      const s = this.studsList[i];
      s.age += dt;
      s.mesh.rotation.y += dt * 4.5;

      const distToPlayer = s.mesh.position.distanceTo(playerChest);
      if (s.age > 0.18 && distToPlayer < this.magnetRadius) {
        s.magnetized = true;
      }

      if (s.magnetized) {
        const dir = _STUD_DIR_VEC.subVectors(playerChest, s.mesh.position);
        const dist = dir.length();

        if (dist <= this.collectRadius) {
          soundFX.playStudCollect(s.value);
          if (this.hud) {
            this.hud.addStuds(s.value, s.tier);
          }
          this.scene.remove(s.mesh);
          disposeTransientObject3D(s.mesh);
          this.studsList.splice(i, 1);
          continue;
        }

        dir.multiplyScalar(1 / Math.max(0.0001, dist));
        const pullSpeed = 19.5 + (this.magnetRadius - Math.min(this.magnetRadius, dist)) * 3.8;
        s.mesh.position.addScaledVector(dir, pullSpeed * dt);
      } else {
        s.vel.y -= 22.0 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);

        if (s.mesh.position.y <= s.groundY) {
          s.mesh.position.y = s.groundY;
          if (Math.abs(s.vel.y) > 1.0) {
            s.vel.y = -s.vel.y * 0.56;
          } else {
            s.vel.y = 0;
          }
          s.vel.x *= 0.82;
          s.vel.z *= 0.82;
        }
      }
    }

    for (let i = 0; i < this.ambientStuds.length; i++) {
      const s = this.ambientStuds[i];
      if (s.collected) {
        if (s._wasInstVisible !== false) {
          s.mesh.visible = false;
          s._wasInstVisible = false;
          this._writeAmbientStudMatrix(s, true);
        }
        continue;
      }

      const sdx = s.mesh.position.x - playerChest.x;
      const sdz = s.mesh.position.z - playerChest.z;
      const sDistSq = sdx * sdx + sdz * sdz;
      if (sDistSq > 180 * 180) {
        if (s.mesh.visible) s.mesh.visible = false;
        if (s._wasInstVisible !== false) {
          s._wasInstVisible = false;
          this._writeAmbientStudMatrix(s, true);
        }
        continue;
      }
      if (!s.mesh.visible) s.mesh.visible = true;

      s.mesh.rotation.y += dt * 4.5;

      const distToPlayer = s.mesh.position.distanceTo(playerChest);
      if (distToPlayer < this.magnetRadius) {
        s.magnetized = true;
      }

      if (s.magnetized) {
        const dir = _STUD_DIR_VEC.subVectors(playerChest, s.mesh.position);
        const dist = dir.length();
        if (dist <= this.collectRadius) {
          s.collected = true;
          s.mesh.visible = false;
          s._wasInstVisible = false;
          this._writeAmbientStudMatrix(s, true);
          soundFX.playStudCollect(s.value);
          if (this.hud) {
            this.hud.addStuds(s.value, s.tier);
          }
          continue;
        }
        dir.multiplyScalar(1 / Math.max(0.0001, dist));
        const pullSpeed = 19.5 + (this.magnetRadius - Math.min(this.magnetRadius, dist)) * 3.8;
        s.mesh.position.addScaledVector(dir, pullSpeed * dt);
      }

      s._wasInstVisible = true;
      this._writeAmbientStudMatrix(s, false);
    }

    for (const pool of this._ambientStudPools.values()) {
      if (pool.dirty) {
        pool.inst.instanceMatrix.needsUpdate = true;
        pool.dirty = false;
      }
    }
  }
};
