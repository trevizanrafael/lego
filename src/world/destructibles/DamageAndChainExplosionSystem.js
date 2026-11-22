import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  markAsSharedAsset,
  disposeTransientObject3D
} from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { TRAIL_CUBE_GEO, SHARED_UNIT_SPHERE_20 } from './DestructibleRegistryAndCulling.js';
import { HumanoidHealthModel } from '../npc-health/HumanoidHealthModel.js';
import { spawnBloodHitSplatter } from '../npc-health/HumanoidHitReactions.js';
import {
  resolveHumanoidHitZone,
  isPrecisionShot,
  getEffectiveHumanoidHeight
} from '../npc-health/HumanoidHitZones.js';
import { tryHitVehicleOccupantFromShot } from '../vehicles/VehicleOccupants.js';

const WATER_DROP_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.22, 0.22, 0.22));

export const DAMAGE_AND_CHAIN_EXPLOSION_METHODS = {
  /**
   * Cria uma explosão 3D em área (Granada, Bola de Fogo, Bazuca RPG ou Supernova Multi-Camadas)
   */
  _triggerExplosion(center, radius, maxDamage, isFlashbang = false, isSupernova = false, damageOpts = {}) {
    const chargeRatio = damageOpts.chargeRatio ?? 0;
    soundFX.playExplosion(isSupernova ? 1.5 + chargeRatio * 1.1 : isFlashbang ? 1.25 : 0.9);
    this.world?.livingCity?.triggerPedestrianPanicNear(center, Math.max(44, radius * 2.5));

    const sphereColor = isFlashbang ? 0xfef9c3 : 0xf97316;
    const sphereMat = new THREE.MeshBasicMaterial({ color: sphereColor, transparent: true, opacity: 0.88 });
    const sphereMesh = new THREE.Mesh(SHARED_UNIT_SPHERE_20, sphereMat);
    sphereMesh.position.copy(center);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, isSupernova ? 0.08 : 0.12, 12, 40);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.94 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(center);
    this.scene.add(ringMesh);

    const extraMeshes = [];
    const extraRings = [];
    const eruptionSpikes = [];
    let innerCoreMesh = null;

    if (isSupernova) {
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 });
      innerCoreMesh = new THREE.Mesh(SHARED_UNIT_SPHERE_20, innerMat);
      innerCoreMesh.position.copy(center);
      this.scene.add(innerCoreMesh);
      extraMeshes.push(innerCoreMesh);

      const ringConfigs = [
        { color: 0xf97316, speedMult: 1.18, tiltX: 0, tiltZ: 0 },
        { color: 0xef4444, speedMult: 0.76, tiltX: 0, tiltZ: 0 },
        { color: 0xfef08a, speedMult: 1.02, tiltX: 0.42, tiltZ: 0.35 },
        { color: 0xf59e0b, speedMult: 1.02, tiltX: -0.42, tiltZ: -0.35 }
      ];
      for (const rc of ringConfigs) {
        const rGeo = new THREE.TorusGeometry(1, 0.055, 10, 36);
        rGeo.rotateX(Math.PI / 2);
        const rMat = new THREE.MeshBasicMaterial({ color: rc.color, transparent: true, opacity: 0.9 });
        const rMesh = new THREE.Mesh(rGeo, rMat);
        rMesh.position.copy(center);
        rMesh.rotation.set(rc.tiltX, 0, rc.tiltZ);
        this.scene.add(rMesh);
        extraMeshes.push(rMesh);
        extraRings.push({ mesh: rMesh, speedMult: rc.speedMult });
      }

      const spikeCount = Math.round(12 + chargeRatio * 12);
      const floorY = damageOpts.groundY ?? Math.max(0, center.y - 1.1);
      const spikeColors = [0xffffff, 0xfef08a, 0xf59e0b, 0xf97316, 0xef4444];
      for (let s = 0; s < spikeCount; s++) {
        const isOuterRing = s >= spikeCount * 0.45;
        const ringRatio = isOuterRing ? 0.68 : 0.34;
        const denom = isOuterRing ? Math.ceil(spikeCount * 0.55) : Math.floor(spikeCount * 0.45);
        const angle = (s / denom) * Math.PI * 2 + (isOuterRing ? 0.25 : 0);
        const distFromCenter = radius * ringRatio * (0.85 + (s % 3) * 0.08);
        const maxSpikeH = (4.5 + chargeRatio * 11.5) * (isOuterRing ? 0.85 : 1.15);
        const spikeR = (0.55 + chargeRatio * 1.1) * (isOuterRing ? 0.9 : 1.1);

        const spikeMat = new THREE.MeshBasicMaterial({ color: spikeColors[s % spikeColors.length], transparent: true, opacity: 0.94 });
        const spikeGeo = new THREE.ConeGeometry(spikeR, maxSpikeH, 5);
        spikeGeo.translate(0, maxSpikeH * 0.5, 0);
        const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
        spikeMesh.position.set(center.x + Math.cos(angle) * distFromCenter, floorY, center.z + Math.sin(angle) * distFromCenter);
        spikeMesh.rotation.z = -Math.cos(angle) * 0.22;
        spikeMesh.rotation.x = Math.sin(angle) * 0.22;
        spikeMesh.scale.set(1, 0.05, 1);
        this.scene.add(spikeMesh);
        extraMeshes.push(spikeMesh);
        eruptionSpikes.push({ mesh: spikeMesh, delay: isOuterRing ? 0.12 : 0.0 });
      }

      const meteorCount = Math.round(36 + chargeRatio * 34);
      for (let m = 0; m < meteorCount; m++) {
        const ang = (m / meteorCount) * Math.PI * 2 + Math.random() * 0.2;
        const elev = 0.15 + Math.random() * 0.85;
        const speed = (16 + Math.random() * 26) * (0.65 + chargeRatio * 0.85);
        const mMat = new THREE.MeshBasicMaterial({ color: spikeColors[m % spikeColors.length], transparent: true, opacity: 0.95 });
        const mMesh = new THREE.Mesh(TRAIL_CUBE_GEO, mMat);
        mMesh.position.copy(center);
        mMesh.scale.setScalar(1.3 + chargeRatio * 1.6);
        this.scene.add(mMesh);

        const life = 0.55 + Math.random() * 0.45;
        this.fxParticles.push({
          mesh: mMesh,
          vel: new THREE.Vector3(Math.cos(ang) * Math.cos(elev) * speed, Math.sin(elev) * speed * 0.85, Math.sin(ang) * Math.cos(elev) * speed),
          life,
          maxLife: life
        });
      }
    }

    this.explosions.push({
      sphereMesh, ringMesh, innerCoreMesh, extraMeshes, extraRings, eruptionSpikes,
      isSupernova, maxRadius: radius, age: 0, duration: isSupernova ? 0.72 + chargeRatio * 0.38 : 0.36
    });

    const blastDamageOpts = {
      ...damageOpts,
      isExplosion: true
    };
    const blastCandidates = this.getObjectsNear(center.x, center.z, radius + 3.0);
    for (const obj of blastCandidates) {
      if (obj.destroyed || obj.isGrabbed) continue;
      const ox = obj._isDynamicIndexed ? (obj.mesh?.position?.x ?? obj.basePos.x) : obj.basePos.x;
      const oy = obj._isDynamicIndexed ? (obj.mesh?.position?.y ?? obj.basePos.y) : obj.basePos.y;
      const oz = obj._isDynamicIndexed ? (obj.mesh?.position?.z ?? obj.basePos.z) : obj.basePos.z;
      const objPos = new THREE.Vector3(ox, oy + obj.height * 0.5, oz);
      if (objPos.distanceTo(center) <= radius + obj.radius) {
        this.damageObject(obj, maxDamage, center, isSupernova, blastDamageOpts);
      }
    }
  },

  _damageHumanoidObject(obj, amount, hitOrigin, isSolar, damageOpts, causedByPlayer) {
    const UNARMORED_CIVILIAN_MULT = 4.1;
    const zoneInfo = resolveHumanoidHitZone(obj, damageOpts?.impactPoint || hitOrigin, damageOpts);
    const isPrecision = isPrecisionShot(damageOpts);
    const hasPhysicalShield = Boolean(
      obj.hasRiotShield ||
      obj.hasShield ||
      obj.visual?.hasShield ||
      (obj.isTankNpc && !obj.visual && obj.hasShield !== false && obj.hasRiotShield !== false)
    );
    const shooterOrigin = damageOpts?.shotOrigin || hitOrigin;
    let finalDamage = amount;

    if (damageOpts?.unscaledDamage) {
      finalDamage = amount;
    } else if (isPrecision && !damageOpts?.fromEnemyNpc) {
      finalDamage = amount * zoneInfo.multiplier;
      if (obj.isTankNpc && !zoneInfo.isHeadshot && hasPhysicalShield && shooterOrigin && obj.mesh) {
        const fwdX = Math.sin(obj.mesh.rotation.y);
        const fwdZ = Math.cos(obj.mesh.rotation.y);
        const dx = shooterOrigin.x - obj.mesh.position.x;
        const dz = shooterOrigin.z - obj.mesh.position.z;
        if (dx * fwdX + dz * fwdZ > 0) finalDamage *= 0.6;
      }
      if (obj.isBossNpc) {
        const bossCap = Math.min(220, Math.max(1, (obj.maxHp || obj.humanoidHealth?.maxHp || 500) * 0.42));
        finalDamage = Math.min(bossCap, finalDamage);
      }
    } else if (obj.isCivilianPedestrian) {
      if (damageOpts?.isExplosion || damageOpts?.isCloseShotgun || damageOpts?.isShotgunPellet) {
        finalDamage = amount * 2.5;
      } else if (amount <= 21) {
        finalDamage = amount * UNARMORED_CIVILIAN_MULT;
      } else {
        finalDamage = amount * 2.1;
      }
      finalDamage *= zoneInfo.multiplier;
    } else if (obj.isCombatNpc && !damageOpts?.fromEnemyNpc) {
      finalDamage = amount * 0.55 * zoneInfo.multiplier;
      if (obj.isTankNpc && !zoneInfo.isHeadshot && hasPhysicalShield && shooterOrigin && obj.mesh) {
        const fwdX = Math.sin(obj.mesh.rotation.y);
        const fwdZ = Math.cos(obj.mesh.rotation.y);
        const dx = shooterOrigin.x - obj.mesh.position.x;
        const dz = shooterOrigin.z - obj.mesh.position.z;
        if (dx * fwdX + dz * fwdZ > 0) finalDamage *= 0.6;
      }
      if (obj.isBossNpc) {
        const bossMax = Math.max(1, (obj.maxHp || obj.humanoidHealth?.maxHp || 500) * 0.42);
        finalDamage = Math.min(zoneInfo.isHeadshot ? Math.min(220, bossMax) : Math.min(160, bossMax), finalDamage);
      } else if (zoneInfo.isHeadshot) {
        finalDamage = Math.min(260, finalDamage);
      } else if (obj.isTankNpc) {
        finalDamage = Math.min(85, finalDamage);
      } else {
        finalDamage = Math.min(95, finalDamage);
      }
    }

    if (!obj.humanoidHealth) {
      const fallbackKind = obj.isCivilianPedestrian
        ? 'civilian'
        : obj.isBossNpc
          ? 'boss'
          : obj.isPoliceUnit
            ? 'police'
            : 'soldier';
      obj.humanoidHealth = new HumanoidHealthModel({
        kind: fallbackKind,
        maxHp: obj.maxHp || obj.hp || 100
      });
      obj.humanoidHealth.hp = Number.isFinite(obj.hp) ? obj.hp : obj.humanoidHealth.maxHp;
    }

    const entityPos = obj.mesh?.position || obj.basePos || { x: 0, y: 0, z: 0 };
    const effHeight = getEffectiveHumanoidHeight(obj);
    const impactWorldPos = damageOpts?.impactPoint || {
      x: entityPos.x,
      y: (entityPos.y || 0) + effHeight * (zoneInfo.isHeadshot ? 0.88 : zoneInfo.isLimb ? 0.28 : 0.58),
      z: entityPos.z
    };

    const healthRes = obj.humanoidHealth.applyDamage(finalDamage, {
      hitOrigin: damageOpts?.shotOrigin || hitOrigin,
      shotDir: damageOpts?.shotDir || null,
      entityPos,
      facingYaw: obj.mesh?.rotation?.y || 0,
      isExplosion: Boolean(damageOpts?.isExplosion || isSolar),
      isCloseShotgun: Boolean(damageOpts?.isCloseShotgun || damageOpts?.isShotgunPellet),
      sourceIsPlayer: causedByPlayer
    });
    obj.hp = obj.humanoidHealth.hp;

    const bloodPos = {
      x: impactWorldPos.x,
      y: zoneInfo.isHeadshot ? impactWorldPos.y : (entityPos.y || 0) + effHeight * 0.56,
      z: impactWorldPos.z
    };
    const shotDir = damageOpts?.shotDir || (
      hitOrigin ? { x: entityPos.x - hitOrigin.x, y: 0.12, z: entityPos.z - hitOrigin.z } : null
    );
    spawnBloodHitSplatter(this, bloodPos, shotDir, healthRes.killed);
    soundFX.playPlasticHit();

    if (!healthRes.killed) {
      this.world?.livingCity?.triggerPedestrianPanicNear?.(entityPos, 28, false);
      if (typeof obj.onDamaged === 'function') {
        obj.onDamaged(healthRes.damageApplied, hitOrigin, healthRes, damageOpts);
      }
      if (causedByPlayer) {
        this.hud?.triggerHitmarker?.(false, { isHeadshot: zoneInfo.isHeadshot });
        this.hud?.spawnDamageNumber?.({
          amount: healthRes.damageApplied,
          worldPos: impactWorldPos,
          targetObj: obj,
          zone: zoneInfo.zone,
          isHeadshot: zoneInfo.isHeadshot,
          isKill: false,
          isVehicle: false
        });
        this.onObjectDamaged?.(obj, healthRes.damageApplied, hitOrigin, {
          ...damageOpts,
          hitZone: zoneInfo.zone,
          isHeadshot: zoneInfo.isHeadshot,
          sourceIsPlayer: true
        });
      }
      return;
    }

    // Morte humanoide: sem estilhaços LEGO! Solta studs só agora e registra corpo + poça de sangue!
    obj.destroyed = true;
    obj.isGrabbed = false;
    if (obj.isCivilianPedestrian) obj.isDeadCorpse = true;
    if (obj.colliders) {
      for (const col of obj.colliders) col.disabled = true;
    }

    this._spawnStudShower(obj);
    this.world?.livingCity?.triggerPedestrianPanicNear?.(entityPos, 32, true);
    if (typeof obj.onDamaged === 'function') {
      obj.onDamaged(healthRes.damageApplied, hitOrigin, healthRes, damageOpts);
    }
    obj.onShattered?.();

    const corpseMgr = this.world?.livingCity?.corpseManager || obj._corpseManager || null;
    corpseMgr?.registerCorpse({
      isInstancedPedestrian: Boolean(obj.isCivilianPedestrian),
      ped: obj.pedestrianRef || null,
      visual: obj.visual || obj.pedestrianRef?.visual || null,
      mesh: obj.mesh,
      destructible: obj,
      healthModel: obj.humanoidHealth,
      groundY: obj.groundY ?? entityPos.y ?? 0,
      unitScale: obj.unitScale || 1.0
    });

    if (causedByPlayer) {
      this.hud?.spawnDamageNumber?.({
        amount: healthRes.damageApplied,
        worldPos: impactWorldPos,
        targetObj: obj,
        zone: zoneInfo.zone,
        isHeadshot: zoneInfo.isHeadshot,
        isKill: true,
        isVehicle: false
      });
      this.hud?.triggerPlayerKillFeedback?.(obj, { isHeadshot: zoneInfo.isHeadshot });
      this.onObjectDestroyed?.(obj, hitOrigin, {
        ...damageOpts,
        hitZone: zoneInfo.zone,
        isHeadshot: zoneInfo.isHeadshot,
        sourceIsPlayer: true
      });
    }
  },

  damageObject(obj, amount, hitOrigin = null, isSolar = false, damageOpts = {}) {
    if (obj.destroyed) return;
    if (obj.isAlliedToPlayer && !damageOpts.fromEnemyNpc) return;

    if (obj.goldOnly && !isSolar) {
      obj.shakeTimer = 0.12;
      if (!obj._isDynamicIndexed) this.wakeObjectMatrix(obj.mesh);
      soundFX.playMetalRicochet();
      return;
    }

    if (obj.crackedWallOnly && !damageOpts.canBreakCrackedWall && !isSolar) {
      obj.shakeTimer = 0.12;
      if (!obj._isDynamicIndexed) this.wakeObjectMatrix(obj.mesh);
      soundFX.playMetalRicochet();
      return;
    }

    if (obj.silverOnly && !damageOpts.canBreakSilver && !isSolar) {
      obj.shakeTimer = 0.12;
      if (!obj._isDynamicIndexed) this.wakeObjectMatrix(obj.mesh);
      soundFX.playMetalRicochet();
      return;
    }

    const causedByPlayer =
      damageOpts?.sourceIsPlayer !== undefined
        ? Boolean(damageOpts.sourceIsPlayer)
        : (!damageOpts?.fromEnemyNpc &&
           !damageOpts?.fromPursuitPolice &&
           !damageOpts?.fromAmbientTraffic);

    if (obj.isCivilianPedestrian || obj.isCombatNpc) {
      this._damageHumanoidObject(obj, amount, hitOrigin, isSolar, damageOpts, causedByPlayer);
      return;
    }

    if (obj.type === 'car' && !damageOpts?.isExplosion) {
      tryHitVehicleOccupantFromShot(
        this,
        obj,
        damageOpts?.impactPoint || hitOrigin,
        amount,
        { ...damageOpts, sourceIsPlayer: causedByPlayer }
      );
    }

    const finalDamage = amount;
    obj.hp -= finalDamage;
    if (causedByPlayer && obj.type === 'car') {
      obj._lastDamagedByPlayer = true;
    }
    obj.shakeTimer = 0.2;
    if (!obj._isDynamicIndexed) this.wakeObjectMatrix(obj.mesh);
    this.world?.livingCity?.triggerPedestrianPanicNear(obj.basePos, 28);
    if (typeof obj.onDamaged === 'function') {
      obj.onDamaged(finalDamage, hitOrigin);
    }
    if (typeof this.onObjectDamaged === 'function' && causedByPlayer) {
      this.onObjectDamaged(obj, finalDamage, hitOrigin, {
        ...damageOpts,
        sourceIsPlayer: true
      });
    }

    const isVehicleObj =
      obj.type === 'car' ||
      obj.type === 'police_helicopter' ||
      obj.type === 'boat' ||
      obj.type === 'aircraft' ||
      Boolean(obj.isVehicle);
    if (causedByPlayer && isVehicleObj) {
      if (obj.hp > 0) {
        this.hud?.triggerHitmarker?.(false, { isHeadshot: false, isVehicle: true });
      }
      this.hud?.spawnDamageNumber?.({
        amount: finalDamage,
        worldPos: damageOpts?.impactPoint || hitOrigin || obj.mesh?.position || obj.basePos,
        targetObj: obj,
        zone: 'vehicle',
        isHeadshot: false,
        isKill: obj.hp <= 0,
        isVehicle: true
      });
    }

    if (obj.hp > 0) {
      if (obj.type === 'car') {
        this._syncVehicleDamageStageOnHit?.(obj, causedByPlayer);
      }
      if (finalDamage >= 5) {
        soundFX.playPlasticHit();
        this._spawnDebris(obj, 2, 0.6);
      }
    } else {
      this._shatterObject(obj, hitOrigin, { ...damageOpts, sourceIsPlayer: causedByPlayer });
    }
  },

  _shatterObject(obj, hitOrigin = null, damageOpts = {}) {
    if (obj.type === 'car') {
      this._explodeVehicleObject(obj, hitOrigin, damageOpts);
      return;
    }
    if (obj.type === 'police_helicopter') {
      this._startHelicopterTailspinCrash(obj, hitOrigin, damageOpts);
      return;
    }

    const causedByPlayer =
      damageOpts?.sourceIsPlayer !== undefined
        ? Boolean(damageOpts.sourceIsPlayer)
        : (!damageOpts?.fromEnemyNpc &&
           !damageOpts?.fromPursuitPolice &&
           !damageOpts?.fromAmbientTraffic);

    obj.destroyed = true;
    obj.isGrabbed = false;
    obj.respawnTimer = obj.isCombatNpc ? 4.0 : obj.isStreetProp ? 45.0 : 28.0;
    obj.mesh.visible = false;
    if (obj._syncInstancedVisual) {
      obj._syncInstancedVisual(obj);
      this._flushStreetPropInstancedBatches?.();
    }
    if (obj._isDynamicIndexed) {
      obj.mesh.matrixWorldAutoUpdate = false;
    }
    if (typeof obj.onShattered === 'function') {
      obj.onShattered();
    }
    const skipCollateralPropChaos = Boolean(obj.isStreetProp && damageOpts?._fromVehicleExplosion);
    if (typeof this.onObjectDestroyed === 'function' && causedByPlayer && !skipCollateralPropChaos) {
      this.onObjectDestroyed(obj, hitOrigin, {
        ...damageOpts,
        sourceIsPlayer: true
      });
    }

    for (const col of obj.colliders) {
      col.disabled = true;
    }

    const isBig = [
      'car', 'police_helicopter', 'bus_stop', 'atm_machine', 'dumpster',
      'newsstand', 'gold_vault', 'cracked_wall', 'silver_lego', 'gas_pump', 'bank_vault_door'
    ].includes(obj.type);
    soundFX.playLegoBreak(isBig);

    const pieceCount =
      obj.type === 'car' || obj.type === 'police_helicopter' || obj.type === 'bank_vault_door' || obj.type === 'cracked_wall' ? 24 :
      obj.type === 'gold_vault' || obj.type === 'silver_lego' || obj.type === 'gas_pump' || obj.type === 'bus_stop' || obj.type === 'atm_machine' ? 18 :
      obj.type === 'newsstand' || obj.type === 'phone_booth' || obj.type === 'food_cart' || obj.type === 'dumpster' ? 15 :
      obj.type === 'streetlamp' || obj.type === 'traffic_light' ? 12 : 9;
    const upwardBoost = obj.type === 'car' || obj.type === 'gas_pump' ? 1.65 : isBig ? 1.25 : 0.95;
    this._spawnDebris(obj, pieceCount, upwardBoost);

    if (!(damageOpts?._chainDepth >= 1)) {
      this._spawnStudShower(obj);
    }

    if (obj.type === 'hydrant') {
      this._createWaterGeyser(obj.basePos.clone(), obj.groundY);
    } else if (obj.type === 'streetlamp' || obj.type === 'traffic_light') {
      this._spawnTopplingPoleAndSparks(obj, hitOrigin);
    } else if (obj.type === 'atm_machine') {
      this._spawnElectricSparks(obj.basePos.clone().add(new THREE.Vector3(0, 1.2, 0)), 14);
    } else if (obj.type === 'gas_pump' || obj.type === 'fuel_truck' || obj.type === 'explosive_barrel') {
      const blastCenter = obj.basePos.clone();
      blastCenter.y += 1.0;
      this._triggerExplosion(blastCenter, 36.0, 110, false, true, {
        sourceIsPlayer: causedByPlayer,
        isExplosion: true,
        _chainDepth: (damageOpts?._chainDepth || 0) + 1
      });
    }
  },

  _spawnElectricSparks(origin, count = 12) {
    const colors = [0xf59e0b, 0xfef08a, 0x38bdf8, 0xffffff];
    for (let i = 0; i < count; i++) {
      const s = 0.55 + Math.random() * 0.45;
      const ang = Math.random() * Math.PI * 2;
      const spd = 3.5 + Math.random() * 7.5;
      const life = 0.34 + Math.random() * 0.22;
      this._spawnFxParticle(
        TRAIL_CUBE_GEO, colors[i % colors.length], 0.95,
        origin.x, origin.y, origin.z,
        s, s, s,
        Math.cos(ang) * spd, 3.0 + Math.random() * 6.5, Math.sin(ang) * spd,
        life, 0.56
      );
    }
  },

  _spawnTopplingPoleAndSparks(obj, hitOrigin = null) {
    const base = obj.basePos.clone();
    this._spawnElectricSparks(new THREE.Vector3(base.x, base.y + 0.55, base.z), 12);
    this._spawnElectricSparks(new THREE.Vector3(base.x, base.y + (obj.height || 5.2) * 0.9, base.z), 10);

    let dirX = 1;
    let dirZ = 0;
    if (hitOrigin) {
      const lenSq = hitOrigin.x * hitOrigin.x + hitOrigin.z * hitOrigin.z;
      if (lenSq > 0.001 && lenSq <= 4.5) {
        const inv = 1 / Math.hypot(hitOrigin.x, hitOrigin.z);
        dirX = hitOrigin.x * inv;
        dirZ = hitOrigin.z * inv;
      } else {
        const dx = base.x - hitOrigin.x;
        const dz = base.z - hitOrigin.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          dirX = dx / d;
          dirZ = dz / d;
        }
      }
    } else {
      const ang = Math.random() * Math.PI * 2;
      dirX = Math.cos(ang);
      dirZ = Math.sin(ang);
    }

    const poleH = obj.height || 5.2;
    const pivot = new THREE.Group();
    pivot.position.copy(base);

    const poleMat = getLegoMaterial(obj.type === 'traffic_light' ? LEGO_COLORS.charcoal : LEGO_COLORS.darkGrey);
    const shaftGeo = new THREE.CylinderGeometry(0.11, 0.14, poleH, 8);
    shaftGeo.translate(0, poleH * 0.5, 0);
    pivot.add(new THREE.Mesh(shaftGeo, poleMat));

    const headColor = obj.type === 'traffic_light' ? 0xf59e0b : 0xfef08a;
    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.52, 0.42),
      new THREE.MeshBasicMaterial({ color: headColor })
    );
    headMesh.position.set(0, poleH * 0.92, 0);
    pivot.add(headMesh);

    this.scene.add(pivot);
    this.topplingPoles.push({
      mesh: pivot,
      axis: new THREE.Vector3(dirZ, 0, -dirX).normalize(),
      angle: 0,
      angVel: 2.2,
      life: 0.95,
      sparkedGround: false,
      tipOffset: new THREE.Vector3(dirX * poleH * 0.9, 0.25, dirZ * poleH * 0.9)
    });
  },

  _createWaterGeyser(position, groundY) {
    const waterMat = getLegoMaterial(0x38bdf8, {
      roughness: 0.1, clearcoat: 0.8, transparent: true, opacity: 0.82, emissive: 0x0284c7, emissiveIntensity: 0.25
    });
    const foamMat = getLegoMaterial(0xf8fafc, { roughness: 0.2 });

    const colGeo = new THREE.CylinderGeometry(0.14, 0.34, 8.0, 10, 1, true);
    colGeo.translate(0, 4.0, 0);
    const colMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide
    });
    const columnMesh = new THREE.Mesh(colGeo, colMat);
    columnMesh.position.set(position.x, groundY, position.z);
    this.scene.add(columnMesh);

    const drops = [];
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(WATER_DROP_GEO, i % 3 === 0 ? foamMat : waterMat);
      this._resetGeyserDrop(mesh, position, groundY);
      mesh.position.y = groundY + Math.random() * 6.5;
      this.scene.add(mesh);
      drops.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.9, 15.6 + Math.random() * 2.5, (Math.random() - 0.5) * 1.9)
      });
    }

    this.geysers.push({ origin: position, groundY, maxHeight: 8.0, maxTimer: 7.0, timer: 7.0, columnMesh, drops });
  },

  _resetGeyserDrop(mesh, origin, groundY) {
    mesh.position.set(origin.x + (Math.random() - 0.5) * 0.28, groundY + 0.2, origin.z + (Math.random() - 0.5) * 0.28);
  },

  _updateExplosions(dt) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.age += dt;
      const t = ex.age / ex.duration;
      if (t >= 1) {
        for (const m of [ex.sphereMesh, ex.ringMesh, ex.innerCoreMesh, ...(ex.extraMeshes || [])]) {
          if (m) {
            this.scene.remove(m);
            disposeTransientObject3D(m);
          }
        }
        this.explosions.splice(i, 1);
        continue;
      }

      const r = THREE.MathUtils.lerp(0.5, ex.maxRadius, Math.pow(t, 0.52));
      if (ex.sphereMesh) {
        ex.sphereMesh.scale.setScalar(r * (ex.isSupernova ? 0.58 : 0.65));
        ex.sphereMesh.material.opacity = (1 - t) * 0.78;
      }

      ex.ringMesh.scale.setScalar(r);
      ex.ringMesh.material.opacity = (1 - t) * 0.92;

      if (ex.innerCoreMesh) {
        ex.innerCoreMesh.scale.setScalar(r * 0.36);
        ex.innerCoreMesh.material.opacity = Math.max(0, (1 - t * 1.15) * 0.96);
      }

      if (ex.extraRings) {
        for (const er of ex.extraRings) {
          er.mesh.scale.setScalar(Math.min(ex.maxRadius * 1.25, r * er.speedMult));
          er.mesh.material.opacity = Math.max(0, (1 - t) * 0.88);
        }
      }

      if (ex.eruptionSpikes) {
        for (const sp of ex.eruptionSpikes) {
          const localT = Math.max(0, (t - sp.delay) / (1 - sp.delay));
          const growY = localT < 0.35 ? localT / 0.35 : Math.max(0.05, 1.0 - (localT - 0.35) / 0.65);
          sp.mesh.scale.set(1.0, growY, 1.0);
          sp.mesh.material.opacity = Math.max(0, (1 - localT) * 0.95);
        }
      }
    }
  },

  _updateGeysersAndTopplingPoles(dt) {
    for (let i = this.geysers.length - 1; i >= 0; i--) {
      const g = this.geysers[i];
      g.timer -= dt;
      if (g.timer <= 0) {
        if (g.columnMesh) { this.scene.remove(g.columnMesh); disposeTransientObject3D(g.columnMesh); }
        for (const drop of g.drops) { this.scene.remove(drop.mesh); disposeTransientObject3D(drop.mesh); }
        this.geysers.splice(i, 1);
        continue;
      }

      const fadeRatio = g.timer < 0.85 ? Math.max(0.08, g.timer / 0.85) : 1.0;
      if (g.columnMesh) {
        const pulse = 0.94 + Math.sin(g.timer * 24.0) * 0.08;
        g.columnMesh.scale.set(pulse, fadeRatio * pulse, pulse);
        g.columnMesh.rotation.y += dt * 5.5;
        if (g.columnMesh.material) {
          g.columnMesh.material.opacity = 0.62 * fadeRatio;
        }
      }

      for (const drop of g.drops) {
        drop.vel.y -= 18.0 * dt;
        drop.mesh.position.addScaledVector(drop.vel, dt);
        drop.mesh.rotation.x += dt * 6;
        drop.mesh.rotation.y += dt * 5;

        if (drop.mesh.position.y <= g.groundY) {
          this._resetGeyserDrop(drop.mesh, g.origin, g.groundY);
          drop.vel.set(
            (Math.random() - 0.5) * 1.9,
            (15.6 + Math.random() * 2.5) * fadeRatio,
            (Math.random() - 0.5) * 1.9
          );
        }
      }
    }

    for (let i = this.topplingPoles.length - 1; i >= 0; i--) {
      const tp = this.topplingPoles[i];
      tp.life -= dt;
      if (tp.life <= 0) {
        this.scene.remove(tp.mesh);
        disposeTransientObject3D(tp.mesh);
        this.topplingPoles.splice(i, 1);
        continue;
      }
      if (tp.angle < Math.PI * 0.48) {
        tp.angVel += 6.8 * dt;
        const step = Math.min(Math.PI * 0.48 - tp.angle, tp.angVel * dt);
        tp.angle += step;
        tp.mesh.rotateOnWorldAxis(tp.axis, step);
        if (tp.angle >= Math.PI * 0.46 && !tp.sparkedGround) {
          tp.sparkedGround = true;
          this._spawnElectricSparks(tp.mesh.position.clone().add(tp.tipOffset), 10);
        }
      } else if (tp.life < 0.25) {
        tp.mesh.scale.setScalar(Math.max(0.05, tp.life / 0.25));
      }
    }
  }
};
