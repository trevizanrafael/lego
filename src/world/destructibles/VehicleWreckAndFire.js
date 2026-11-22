import * as THREE from 'three';
import { getLegoMaterial, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { FIREBALL_GEO, TRAIL_CUBE_GEO } from './DestructibleRegistryAndCulling.js';
import {
  getAliveOccupantCount,
  disembarkOccupants,
  killRemainingOccupantsOnExplosion
} from '../vehicles/VehicleOccupants.js';

/**
 * VehicleWreckAndFire.js
 * Estágios progressivos de fumaça/incêndio no motor, explosão com reação em cadeia,
 * consequência letal para jogador dentro do carro, carcaças carbonizadas de 30s
 * e queda em parafuso do helicóptero policial Águia.
 */

export const CHARRED_WRECK_MAT = markAsSharedAsset(
  getLegoMaterial(0x18181b, { roughness: 0.92, metalness: 0.18 })
);

const WHITE_SMOKE_HEX = [0xe2e8f0, 0xcbd5e1];
const BLACK_SMOKE_HEX = [0x1f2937, 0x111827];
const ENGINE_FIRE_HEX = [0xf97316, 0xfbbf24, 0xef4444];
const _HOOD_POS_SCRATCH = new THREE.Vector3();

function computeHoodWorldPos(obj, out) {
  const pos = obj.mesh?.position || obj.basePos;
  const yaw = obj.mesh?.rotation?.y || 0;
  return out.set(pos.x + Math.sin(yaw) * 1.45, pos.y + 0.95, pos.z + Math.cos(yaw) * 1.45);
}

function isCausedByPlayer(damageOpts) {
  return damageOpts?.sourceIsPlayer !== undefined
    ? Boolean(damageOpts.sourceIsPlayer)
    : (!damageOpts?.fromEnemyNpc && !damageOpts?.fromPursuitPolice && !damageOpts?.fromAmbientTraffic);
}

export const VEHICLE_WRECK_AND_FIRE_METHODS = {
  getVehicleDamageStage(obj) {
    if (!obj || obj.type !== 'car') return 'intact';
    if (obj.isBurnedWreck) return 'wreck';
    if (obj.destroyed || obj.hp <= 0) return 'destroyed';
    const hpRatio = Math.max(0, Number(obj.hp) || 0) / Math.max(1, Number(obj.maxHp) || 100);
    if (hpRatio >= 0.6) return 'intact';
    if (hpRatio >= 0.35) return 'white_smoke';
    if (hpRatio >= 0.15) return 'black_smoke';
    return 'engine_fire';
  },

  getVehicleEngineSpeedMultiplier(obj) {
    if (!obj || obj.destroyed || obj.isBurnedWreck) return 0;
    if (!obj.isDriven && obj.driverKilled) return 0;
    const stage = this.getVehicleDamageStage(obj);
    return stage === 'engine_fire' ? 0.32 : stage === 'black_smoke' ? 0.58 : 1.0;
  },

  _syncVehicleDamageStageOnHit(obj, causedByPlayer = false) {
    if (!obj || obj.type !== 'car' || obj.destroyed) return;
    if (causedByPlayer) obj._lastDamagedByPlayer = true;
    const stage = this.getVehicleDamageStage(obj);
    obj.damageStage = stage;
    if (stage === 'engine_fire' && !obj.isBurning) {
      obj.isBurning = true;
      obj.engineFireTimer = 4.0;
      obj.engineFireElapsed = 0;
      obj._fireStartedByPlayer = Boolean(causedByPlayer || obj._lastDamagedByPlayer);
      obj._playerFireWarned = false;
      if (obj.isDriven) {
        obj._playerFireWarned = true;
        this.hud?.showWantedBanner?.('MOTOR EM CHAMAS!', 'PRESSIONE [F] PARA SALTAR ANTES DA EXPLOSÃO!', 'pursuit');
        soundFX.playCarHorn?.(0.6, false);
      }
    }
  },

  _applyCharredWreckMaterials(obj) {
    if (!obj?.mesh) return;
    obj.mesh.traverse((child) => {
      if (child === obj._occupantsGroup || child.userData?.isOccupantBust || child.userData?.isOccupantsGroup) {
        child.visible = false;
        return;
      }
      if (child.userData?.isNitroFlame || child.userData?.isNightLightRig || child.userData?.isNightHeadlightCone) {
        if (child.userData._preWreckVisible === undefined) child.userData._preWreckVisible = child.visible;
        child.visible = false;
        return;
      }
      if (!child.isMesh) return;
      const mat = child.material;
      const isGlassOrGlow = Boolean(
        child.userData?.isVehicleGlass || mat?.userData?.isVehicleGlass ||
        mat?.userData?.isVehicleHeadlight || (mat?.transparent && (mat?.opacity ?? 1) < 0.75)
      );
      if (isGlassOrGlow) {
        if (child.userData._preWreckVisible === undefined) child.userData._preWreckVisible = child.visible;
        child.visible = false;
        return;
      }
      if (child.userData._preWreckMat === undefined) child.userData._preWreckMat = child.material;
      child.material = CHARRED_WRECK_MAT;
    });
  },

  _clearVehicleBurnedWreckState(obj, hideAndDisable = false) {
    if (!obj) return;
    Object.assign(obj, {
      isBurnedWreck: false, wreckTimer: 0, isBurning: false, engineFireTimer: 0,
      engineFireElapsed: 0, _playerFireWarned: false, damageStage: obj.destroyed ? 'destroyed' : 'intact'
    });
    if (obj.mesh) {
      obj.mesh.scale.set(1, 1, 1);
      obj.mesh.traverse((child) => {
        if (child.userData?._preWreckMat !== undefined) {
          child.material = child.userData._preWreckMat;
          delete child.userData._preWreckMat;
        }
        if (child.userData?._preWreckVisible !== undefined) {
          child.visible = child.userData._preWreckVisible;
          delete child.userData._preWreckVisible;
        }
      });
      if (hideAndDisable) {
        obj.mesh.visible = false;
        if (obj._isDynamicIndexed) obj.mesh.matrixWorldAutoUpdate = false;
      }
    }
    if (hideAndDisable && Array.isArray(obj.colliders)) {
      for (const col of obj.colliders) if (col) col.disabled = true;
    }
  },

  _enableWreckObstacleColliders(obj) {
    if (!Array.isArray(obj?.colliders) || obj.colliders.length === 0 || !obj.mesh) return;
    const pos = obj.mesh.position, yaw = obj.mesh.rotation.y || 0;
    const spec = obj.mesh.userData?.vehicleSpec;
    const isMoto = Boolean(spec?.isMotorcycle), isBus = obj.mesh.userData?.carType === 'onibus_urbano';
    const baseW = isMoto ? 1.45 : isBus ? 2.85 : 2.5, baseD = isMoto ? 3.8 : isBus ? 8.5 : 5.0;
    const isRot90 = Math.abs(Math.sin(yaw)) > 0.7;
    const w = isRot90 ? baseD : baseW, d = isRot90 ? baseW : baseD, h = obj.height || 2.0;

    for (let i = 0; i < obj.colliders.length; i++) {
      const col = obj.colliders[i];
      if (!col) continue;
      const s = i === 0 ? 1.0 : 0.78;
      Object.assign(col, {
        minX: pos.x - w * 0.5 * s, maxX: pos.x + w * 0.5 * s,
        minZ: pos.z - d * 0.5 * s, maxZ: pos.z + d * 0.5 * s,
        minY: pos.y, maxY: pos.y + h, disabled: false
      });
      if (col.shapeType === 'obb' && typeof this.world?.updateDynamicCollider === 'function') {
        this.world.updateDynamicCollider(col, {
          shapeType: 'obb', cx: pos.x, cz: pos.z, halfX: baseW * 0.5 * s, halfZ: baseD * 0.5 * s, yaw, minY: pos.y, maxY: pos.y + h
        });
      }
    }
  },

  _applyLethalVehicleExplosionToPlayer(ctrl, blastCenter) {
    const lc = this.world?.livingCity, ws = lc?.wantedSystem;
    if (ws && ws.stars > 0 && typeof ws.triggerPlayerBusted === 'function') {
      if (ctrl) ctrl._lastVehicleExplosionOutcome = 'busted';
      ws.triggerPlayerBusted(ctrl);
      return;
    }
    const maxHp = lc?.playerMaxHp || 100;
    if (lc) {
      lc.playerHp = 0;
      this._playerKnockoutRecoverTimer = 1.8;
    }
    this.hud?.setPlayerHealth?.(0, maxHp, false);
    this.hud?.showWantedBanner?.('NOCAUTEADO NA EXPLOSÃO!', 'VEÍCULO DESTRUÍDO COM VOCÊ DENTRO • RESGATE ACIONADO!', 'busted');

    if (ctrl?.position && blastCenter) {
      ctrl._lastVehicleExplosionOutcome = 'knockout';
      const safe = lc?._findSafeStreetSpawn
        ? lc._findSafeStreetSpawn(blastCenter.x + 5.2, blastCenter.z + 5.2, 1.5)
        : { x: blastCenter.x + 5.2, z: blastCenter.z + 5.2 };
      const sy = this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(safe.x, safe.z, blastCenter.y)
        : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0);
      ctrl.position.set(safe.x, sy + 0.35, safe.z);
      ctrl.velocity?.set?.(0, 4.5, 0);
      if (ctrl.minifigure?.root) ctrl.minifigure.root.position.copy(ctrl.position);
    }
  },

  _explodeVehicleObject(obj, hitOrigin = null, damageOpts = {}) {
    if (!obj || obj.destroyed) return;
    const causedByPlayer = isCausedByPlayer(damageOpts);
    const spec = obj.mesh?.userData?.vehicleSpec;
    const isGhostBike = Boolean(obj === this._turboGhostBikeObj || obj.mesh?.userData?.isTurboGhostBike || spec?.isGhostBike);

    if (isGhostBike || spec?.isColossalShip) {
      Object.assign(obj, { destroyed: true, isGrabbed: false, isBurning: false, engineFireTimer: 0 });
      if (obj.isDriven) {
        const ctrl = this.hud?._lastController || this.world?.livingCity?._lastController || null;
        if (ctrl?.currentVehicle === obj) ctrl.exitVehicle?.();
        else obj.isDriven = false;
      }
      if (obj.mesh) obj.mesh.visible = false;
      if (Array.isArray(obj.colliders)) for (const col of obj.colliders) if (col) col.disabled = true;
      obj.onShattered?.();
      return;
    }

    Object.assign(obj, { destroyed: true, isGrabbed: false, isBurning: false, engineFireTimer: 0, damageStage: 'wreck' });
    if (obj.mesh?.position) {
      const restY = this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(obj.mesh.position.x, obj.mesh.position.z, obj.mesh.position.y)
        : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(obj.mesh.position.x, obj.mesh.position.z) : (obj.groundY ?? obj.mesh.position.y));
      obj.mesh.position.y = restY;
      obj.mesh.rotation.x = 0;
      obj.mesh.rotation.z = 0;
      obj.mesh.scale.set(1, 1, 1);
      obj.basePos.copy(obj.mesh.position);
      obj.groundY = restY;
    }

    const blastCenter = obj.basePos.clone();
    blastCenter.y += 0.9;
    const ctrl = this.hud?._lastController || this.world?.livingCity?._lastController || null;
    if (obj.isDriven || (ctrl && ctrl.currentVehicle === obj)) {
      if (ctrl?.currentVehicle === obj) ctrl.exitVehicle?.();
      else obj.isDriven = false;
      if (obj.occupants?.length) disembarkOccupants(obj, Infinity);
      this._applyLethalVehicleExplosionToPlayer(ctrl, blastCenter);
    }

    obj.onShattered?.();
    soundFX.playLegoBreak(true);
    this._spawnDebris(obj, 14, 1.55);

    if (!(damageOpts?._chainDepth >= 1)) {
      const isSpecialStashCar = Boolean(obj.studDrops?.purple > 0 && !obj.isPoliceUnit && !obj.mesh?.userData?.isTrafficVehicle);
      if (isSpecialStashCar) this._spawnStudShower(obj);
      else this._spawnStudShower({ basePos: obj.basePos, groundY: obj.groundY, studDrops: { silver: 1, gold: 1 } });
    }

    obj.isBurnedWreck = true;
    obj.wreckTimer = 30.0;
    obj.respawnTimer = 32.0;
    if (obj.mesh) {
      obj.mesh.visible = true;
      obj.mesh.matrixAutoUpdate = true;
      obj.mesh.matrixWorldAutoUpdate = true;
      this._applyCharredWreckMaterials(obj);
    }
    this._enableWreckObstacleColliders(obj);

    this._triggerExplosion(blastCenter, 10.5, 165, false, true, {
      canBreakCrackedWall: Boolean(damageOpts?.canBreakCrackedWall),
      canBreakSilver: Boolean(damageOpts?.canBreakSilver),
      sourceIsPlayer: causedByPlayer,
      isExplosion: true,
      _chainDepth: (damageOpts?._chainDepth || 0) + 1,
      _fromVehicleExplosion: true
    });

    if (typeof this.onObjectDestroyed === 'function' && causedByPlayer) {
      this.onObjectDestroyed(obj, hitOrigin || blastCenter, { ...damageOpts, sourceIsPlayer: true });
    }
    killRemainingOccupantsOnExplosion(this, obj, blastCenter, causedByPlayer);
  },

  _startHelicopterTailspinCrash(obj, hitOrigin = null, damageOpts = {}) {
    if (!obj || obj.destroyed) return;
    const causedByPlayer = isCausedByPlayer(damageOpts);
    Object.assign(obj, { destroyed: true, isGrabbed: false, noAutoRespawn: true });
    obj.onShattered?.();
    if (typeof this.onObjectDestroyed === 'function' && causedByPlayer) {
      this.onObjectDestroyed(obj, hitOrigin, { ...damageOpts, sourceIsPlayer: true });
    }
    soundFX.playExplosion(0.95);
    this._spawnDebris(obj, 10, 1.15);

    if (!this._crashingHelis) this._crashingHelis = [];
    const pos = obj.mesh?.position || obj.basePos;
    const floorY = this._resolveHeliCrashSurfaceY(pos.x, pos.z, pos.y);
    if (!obj.mesh || pos.y <= floorY + 2.2) {
      this._finalizeHelicopterCrashImpact({ obj, mesh: obj.mesh, causedByPlayer, floorY });
      return;
    }
    obj.mesh.visible = true;
    obj.mesh.matrixAutoUpdate = true;
    obj.mesh.matrixWorldAutoUpdate = true;
    if (this.scene && obj.mesh.parent !== this.scene) this.scene.add(obj.mesh);

    this._crashingHelis.push({
      obj, mesh: obj.mesh, velX: (Math.random() - 0.5) * 9.0, velY: -18.5, velZ: (Math.random() - 0.5) * 9.0,
      yaw: obj.mesh.rotation.y || 0, timer: 1.35, smokeAcc: 0, causedByPlayer
    });
  },

  _resolveHeliCrashSurfaceY(x, z, curY) {
    let floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(x, z) : 0;
    const buildings = this.world?.mapBuildings;
    if (Array.isArray(buildings)) {
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (Math.abs(x - b.x) <= (b.w || 16) * 0.5 && Math.abs(z - b.z) <= (b.d || 16) * 0.5) {
          const roofY = b.height || 0;
          if (roofY <= curY + 2.0 && roofY > floorY) floorY = roofY;
        }
      }
    }
    return floorY;
  },

  _finalizeHelicopterCrashImpact(entry) {
    const { obj, mesh, causedByPlayer } = entry;
    const px = mesh?.position?.x ?? obj.basePos.x, pz = mesh?.position?.z ?? obj.basePos.z;
    const curY = mesh?.position?.y ?? obj.basePos.y;
    const surfY = entry.floorY !== undefined ? entry.floorY : this._resolveHeliCrashSurfaceY(px, pz, curY);
    const impactY = entry.timer !== undefined && entry.timer <= 0 ? Math.max(surfY, curY) : surfY;
    const blastPos = new THREE.Vector3(px, impactY + 0.6, pz);

    obj.basePos.copy(blastPos);
    obj.groundY = surfY;
    if (mesh) {
      mesh.visible = false;
      mesh.parent?.remove(mesh);
    }
    this._spawnDebris(obj, 16, 1.4);
    this._spawnStudShower({ basePos: blastPos, groundY: surfY, studDrops: { gold: 2, blue: 1 } });

    this._triggerExplosion(blastPos, 11.5, 175, false, true, {
      sourceIsPlayer: causedByPlayer, isExplosion: true, _chainDepth: 1, _fromVehicleExplosion: true
    });
    killRemainingOccupantsOnExplosion(this, obj, blastPos, causedByPlayer);
    this.unregisterDestructible(obj);
  },

  _updateCrashingHelicopters(dt) {
    if (!this._crashingHelis?.length) return;
    for (let i = this._crashingHelis.length - 1; i >= 0; i--) {
      const entry = this._crashingHelis[i];
      entry.timer -= dt;
      entry.velY -= 24.0 * dt;
      const pos = entry.mesh.position;
      pos.x += entry.velX * dt;
      pos.y += entry.velY * dt;
      pos.z += entry.velZ * dt;
      entry.yaw += 11.0 * dt;
      entry.mesh.rotation.set(0.32, entry.yaw, 0.45, 'YXZ');

      entry.smokeAcc += dt;
      while (entry.smokeAcc >= 0.045) {
        entry.smokeAcc -= 0.045;
        this._spawnFxParticle(
          FIREBALL_GEO, Math.random() < 0.4 ? 0xf97316 : 0x18181b, 0.88,
          pos.x, pos.y + 0.5, pos.z, 1.35, 1.35, 1.35,
          (Math.random() - 0.5) * 4.5, 2.5 + Math.random() * 3.5, (Math.random() - 0.5) * 4.5, 0.55
        );
      }
      const floorY = this._resolveHeliCrashSurfaceY(pos.x, pos.z, pos.y);
      if (pos.y <= floorY + 1.1 || entry.timer <= 0) {
        entry.floorY = floorY;
        this._crashingHelis.splice(i, 1);
        this._finalizeHelicopterCrashImpact(entry);
      }
    }
  },

  _bailOutAiOccupantsFromBurningCar(obj, playerPosition) {
    if (!obj || obj._bailedOutFromFire || obj.isDriven) return;
    obj._bailedOutFromFire = true;
    const removed = disembarkOccupants(obj, Infinity);
    obj.driverKilled = true;
    if (removed.length === 0 || !obj.mesh) return;

    const pos = obj.mesh.position;
    if (playerPosition && (pos.x - playerPosition.x) ** 2 + (pos.z - playerPosition.z) ** 2 > 130 * 130) return;

    const lc = this.world?.livingCity, ws = lc?.wantedSystem;
    if (ws && ws.stars > 0 && removed[0]?.category === 'police' && typeof ws._spawnFootTrooper === 'function') {
      const avail = (ws._getDesiredFootCount ? ws._getDesiredFootCount() : 4) - ws.footUnits.length;
      const toSpawn = Math.max(0, Math.min(avail, removed.length, 2));
      for (let k = 0; k < toSpawn; k++) {
        const sx = pos.x + (k === 0 ? -2.2 : 2.2), sz = pos.z + (k === 0 ? -1.0 : 1.0);
        ws._spawnFootTrooper({ x: sx, y: this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(sx, sz) : pos.y, z: sz }, ws.stars);
      }
    }
    lc?.triggerPedestrianPanicNear?.(pos, 26, true);
  },

  _updateDamagedAndBurningVehicles(dt, playerPosition) {
    if (this._playerKnockoutRecoverTimer > 0 && (this._playerKnockoutRecoverTimer -= dt) <= 0) {
      this._playerKnockoutRecoverTimer = 0;
      const lc = this.world?.livingCity;
      if (lc && lc.playerHp <= 0) {
        lc.playerHp = lc.playerMaxHp || 100;
        this.hud?.setPlayerHealth?.(lc.playerHp, lc.playerMaxHp || 100, false);
      }
    }

    const dyn = this._dynamicObjects;
    for (let i = dyn.length - 1; i >= 0; i--) {
      const obj = dyn[i];
      if (!obj || obj.type !== 'car') continue;
      if (obj.isDriven && obj.occupants?.length) disembarkOccupants(obj, Infinity);

      if (obj.isBurnedWreck) {
        obj.wreckTimer -= dt;
        if (obj.wreckTimer <= 0) {
          this._clearVehicleBurnedWreckState(obj, true);
          continue;
        }
        if (obj.wreckTimer <= 1.5 && obj.mesh) {
          obj.mesh.scale.set(1, 0.7 + 0.3 * Math.max(0.05, obj.wreckTimer / 1.5), 1);
        } else if (obj.wreckTimer > 18.0 && obj.mesh?.visible) {
          const near = !playerPosition || ((obj.mesh.position.x - playerPosition.x) ** 2 + (obj.mesh.position.z - playerPosition.z) ** 2 <= 185 * 185);
          if (near && (obj._wreckSmokeAcc = (obj._wreckSmokeAcc || 0) + dt) >= 0.32) {
            obj._wreckSmokeAcc = 0;
            const hp = computeHoodWorldPos(obj, _HOOD_POS_SCRATCH);
            this._spawnFxParticle(FIREBALL_GEO, 0x27272a, 0.52, hp.x, hp.y, hp.z, 0.75, 0.75, 0.75, (Math.random() - 0.5) * 1.1, 2.2 + Math.random() * 1.4, (Math.random() - 0.5) * 1.1, 0.75);
          }
        }
        continue;
      }

      if (obj.destroyed || obj.hp >= obj.maxHp) continue;
      const stage = this.getVehicleDamageStage(obj);
      obj.damageStage = stage;
      const nearFx = !playerPosition || !obj.mesh || ((obj.mesh.position.x - playerPosition.x) ** 2 + (obj.mesh.position.z - playerPosition.z) ** 2 <= 210 * 210);

      if (stage === 'engine_fire' || obj.isBurning) {
        if (!obj.isBurning) {
          Object.assign(obj, { isBurning: true, engineFireTimer: 4.0, engineFireElapsed: 0, _fireStartedByPlayer: Boolean(obj._lastDamagedByPlayer) });
        }
        if (obj.isDriven && !obj._playerFireWarned) {
          obj._playerFireWarned = true;
          this.hud?.showWantedBanner?.('MOTOR EM CHAMAS!', 'PRESSIONE [F] PARA SALTAR ANTES DA EXPLOSÃO!', 'pursuit');
          soundFX.playCarHorn?.(0.6, false);
        }
        obj.engineFireElapsed = (obj.engineFireElapsed || 0) + dt;
        if (obj.engineFireElapsed >= 1.3 && !obj._bailedOutFromFire && !obj.isDriven && (obj._aiCurrentSpeed ?? 0) < 6.0 && getAliveOccupantCount(obj) > 0) {
          this._bailOutAiOccupantsFromBurningCar(obj, playerPosition);
        }
        if (nearFx && obj.mesh && (obj._smokeEmitAcc = (obj._smokeEmitAcc || 0) + dt) >= 0.07) {
          obj._smokeEmitAcc = 0;
          const hp = computeHoodWorldPos(obj, _HOOD_POS_SCRATCH);
          const fHex = ENGINE_FIRE_HEX[Math.floor(Math.random() * ENGINE_FIRE_HEX.length)];
          this._spawnFxParticle(FIREBALL_GEO, fHex, 0.9, hp.x + (Math.random() - 0.5) * 0.45, hp.y, hp.z + (Math.random() - 0.5) * 0.45, 0.72, 0.85, 0.72, (Math.random() - 0.5) * 1.8, 2.8 + Math.random() * 2.4, (Math.random() - 0.5) * 1.8, 0.32);
          this._spawnFxParticle(TRAIL_CUBE_GEO, 0x18181b, 0.72, hp.x, hp.y + 0.35, hp.z, 1.1, 1.1, 1.1, (Math.random() - 0.5) * 1.5, 3.4 + Math.random() * 1.8, (Math.random() - 0.5) * 1.5, 0.55);
        }
        if ((obj.engineFireTimer -= dt) <= 0) {
          this._explodeVehicleObject(obj, null, { sourceIsPlayer: Boolean(obj._fireStartedByPlayer) });
        }
      } else if (nearFx && obj.mesh && (stage === 'white_smoke' || stage === 'black_smoke')) {
        if ((obj._smokeEmitAcc = (obj._smokeEmitAcc || 0) + dt) >= (stage === 'black_smoke' ? 0.11 : 0.18)) {
          obj._smokeEmitAcc = 0;
          const hp = computeHoodWorldPos(obj, _HOOD_POS_SCRATCH);
          const pal = stage === 'black_smoke' ? BLACK_SMOKE_HEX : WHITE_SMOKE_HEX;
          this._spawnFxParticle(FIREBALL_GEO, pal[Math.floor(Math.random() * pal.length)], stage === 'black_smoke' ? 0.74 : 0.48, hp.x + (Math.random() - 0.5) * 0.35, hp.y, hp.z + (Math.random() - 0.5) * 0.35, 0.65, 0.65, 0.65, (Math.random() - 0.5) * 1.2, 2.0 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2, 0.55);
        }
      }
    }
  }
};
