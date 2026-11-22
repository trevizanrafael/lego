/**
 * CvAbilities.js
 *
 * Tactical Q/E abilities for Comando Vermelho (CV) Operators:
 * - Marretão:   Q `cv_barricade` (3.6x1.45x0.75m studless ballistic cover, 550 HP, 14s)
 *               E `cv_rpg_shot` (220 dmg, 9.5m blast, breaks silver & cracked walls)
 * - Fogueteira: Q `cv_medkit` (6.0s trauma field, 6.5m radius, +18 HP / 0.5s to self & allies)
 *               E `cv_signal_fireworks` (3 sky flares, marks enemies 42m for 10s +20% dmg, +12% speed)
 */

import * as THREE from 'three';
import { getLegoMaterial, markAsSharedAsset, disposeTransientObject3D } from '../../../materials/LegoMaterials.js';
import { soundFX } from '../../../audio/SoundFX.js';

const BARRICADE_BASE_GEO = markAsSharedAsset(new THREE.BoxGeometry(3.6, 0.86, 0.75));
const BARRICADE_SLOPE_GEO = markAsSharedAsset(new THREE.BoxGeometry(3.52, 0.64, 0.28));
const BARRICADE_SANDBAG_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.84, 0.28, 0.42));
const BARRICADE_STRUT_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.18, 1.38, 0.78));

const MEDKIT_BAG_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.68, 0.34, 0.48));
const MEDKIT_CROSS_A_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.28, 0.05, 0.09));
const MEDKIT_CROSS_B_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.09, 0.05, 0.28));
const MEDKIT_RING_GEO = markAsSharedAsset(new THREE.TorusGeometry(6.5, 0.08, 8, 40).rotateX(Math.PI / 2));

const FLARE_ROCKET_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.07, 0.09, 0.46, 8));
const MARK_DIAMOND_GEO = markAsSharedAsset(new THREE.OctahedronGeometry(0.32, 0));
const SPARK_CUBE_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.22, 0.22, 0.22));

const MAT_CONCRETE = markAsSharedAsset(getLegoMaterial(0x282d38, { roughness: 0.72 }));
const MAT_SANDBAG = markAsSharedAsset(getLegoMaterial(0x6b5b45, { roughness: 0.82 }));
const MAT_CRIMSON_PLATE = markAsSharedAsset(getLegoMaterial(0x991b1b, { roughness: 0.35, metalness: 0.55 }));
const MAT_GUNMETAL = markAsSharedAsset(getLegoMaterial(0x1a1d24, { roughness: 0.32, metalness: 0.68 }));
const MAT_MED_RED = markAsSharedAsset(getLegoMaterial(0xdc2626, { emissive: 0xef4444, emissiveIntensity: 1.6, roughness: 0.24 }));
const MAT_FLARE = markAsSharedAsset(getLegoMaterial(0xf59e0b, { emissive: 0xef4444, emissiveIntensity: 2.5, roughness: 0.12 }));
const MAT_MARK_DIAMOND = markAsSharedAsset(getLegoMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 2.4, roughness: 0.12 }));

function getScene(ctrl) {
  return ctrl?.destructibles?.scene || ctrl?.world?.scene || null;
}

function getGroundY(ctrl, x, z, refY = 0) {
  if (ctrl?.world?.getSurfaceHeightAt) return ctrl.world.getSurfaceHeightAt(x, z, refY);
  if (ctrl?.world?.getTerrainHeightAt) return ctrl.world.getTerrainHeightAt(x, z);
  return 0;
}

function applySquadAreaHeal(ctrl, center, radius, healAmount) {
  const livingCity = ctrl?.world?.livingCity;
  let healedAny = false;

  if (livingCity && ctrl?.position) {
    if (Math.hypot(ctrl.position.x - center.x, ctrl.position.z - center.z) <= radius && livingCity.playerHp < livingCity.playerMaxHp) {
      livingCity.playerHp = Math.min(livingCity.playerMaxHp, livingCity.playerHp + healAmount);
      ctrl.hud?.setPlayerHealth?.(livingCity.playerHp, livingCity.playerMaxHp, true);
      healedAny = true;
    }
  }

  const npcs = livingCity?.factionWar?.combatNpcs || livingCity?.combatNpcs || [];
  const playerFaction = livingCity?.playerFaction || 'cv';
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    const obj = npc?.destructible;
    if (!obj || obj.destroyed || !(npc.isAllied || npc.faction === playerFaction)) continue;
    const nPos = npc.visual?.root?.position || obj.mesh?.position || obj.basePos;
    if (nPos && Math.hypot(nPos.x - center.x, nPos.z - center.z) <= radius) {
      const maxHp = obj.maxHp || 100;
      if (obj.hp < maxHp) {
        obj.hp = Math.min(maxHp, obj.hp + healAmount);
        healedAny = true;
      }
    }
  }
  if (healedAny) soundFX.playHealTick?.();
}

function removeBarricadeEntry(runtime, bar) {
  if (bar.collider) bar.collider.disabled = true;
  if (bar.destructible) runtime.controller?.destructibles?.unregisterDestructible?.(bar.destructible);
  if (bar.mesh?.parent) bar.mesh.parent.remove(bar.mesh);
  if (bar.mesh) disposeTransientObject3D(bar.mesh);
}

export const CV_ABILITIES = {
  cv_barricade: {
    activate(runtime) {
      const ctrl = runtime.controller;
      ctrl?._alignCharacterToCrosshair?.();
      ctrl?.minifigure?.triggerPunch?.();
      soundFX.playSeismicStomp?.();

      const pos = ctrl?.position || new THREE.Vector3();
      const angle = Number(ctrl?.facingAngle) || 0;
      const bx = pos.x + Math.sin(angle) * 2.6;
      const bz = pos.z + Math.cos(angle) * 2.6;
      const by = getGroundY(ctrl, bx, bz, pos.y);

      const group = new THREE.Group();
      group.userData.skipStaticMerge = true;

      const concreteBase = new THREE.Mesh(BARRICADE_BASE_GEO, MAT_CONCRETE);
      concreteBase.position.set(0, 0.43, 0);
      const crimsonSlope = new THREE.Mesh(BARRICADE_SLOPE_GEO, MAT_CRIMSON_PLATE);
      crimsonSlope.position.set(0, 1.11, 0.14);
      crimsonSlope.rotation.x = -0.26;
      group.add(concreteBase, crimsonSlope);

      for (const sx of [-1.45, 0, 1.45]) {
        const strut = new THREE.Mesh(BARRICADE_STRUT_GEO, MAT_GUNMETAL);
        strut.position.set(sx, 0.69, -0.02);
        group.add(strut);
      }
      for (const bxOff of [-1.15, 0, 1.15]) {
        const bag = new THREE.Mesh(BARRICADE_SANDBAG_GEO, MAT_SANDBAG);
        bag.position.set(bxOff, 0.98, -0.18);
        group.add(bag);
      }

      group.position.set(bx, by, bz);
      group.rotation.y = angle;
      getScene(ctrl)?.add?.(group);

      const cosA = Math.abs(Math.cos(angle));
      const sinA = Math.abs(Math.sin(angle));
      const aabbW = 3.6 * cosA + 0.75 * sinA;
      const aabbD = 3.6 * sinA + 0.75 * cosA;

      let col = null;
      const world = ctrl?.world;
      if (typeof world?.addCollider === 'function') {
        col = world.addCollider(bx, bz, aabbW, aabbD, by + 1.45, by, { isDynamic: true });
      } else if (Array.isArray(world?.colliders)) {
        col = {
          minX: bx - aabbW * 0.5, maxX: bx + aabbW * 0.5,
          minZ: bz - aabbD * 0.5, maxZ: bz + aabbD * 0.5,
          minY: by, maxY: by + 1.45, disabled: false
        };
        world.colliders.push(col);
        world._insertColliderIntoGrid?.(col);
      }

      let destructible = null;
      if (typeof ctrl?.destructibles?.registerDestructible === 'function') {
        destructible = ctrl.destructibles.registerDestructible({
          mesh: group, type: 'cv_barricade', hp: 550, radius: 1.95, height: 1.45,
          colliders: col ? [col] : [], groundY: by, noAutoRespawn: true
        });
        destructible.isAlliedToPlayer = true;
      }

      runtime.deployables.barricades.push({
        mesh: group, collider: col, destructible,
        center: new THREE.Vector3(bx, by, bz),
        angle, halfW: 1.85, halfD: 0.48, height: 1.5, hp: 550, timer: 14.0
      });
      return true;
    }
  },

  cv_rpg_shot: {
    activate(runtime) {
      const ctrl = runtime.controller;
      ctrl?._alignCharacterToCrosshair?.();
      ctrl?.minifigure?.triggerShoot?.();

      const pos = ctrl?.position || new THREE.Vector3();
      const angle = Number(ctrl?.facingAngle) || 0;
      const muzzlePos = new THREE.Vector3(
        pos.x + Math.sin(angle) * 1.2 - Math.cos(angle) * 0.46,
        pos.y + 1.36,
        pos.z + Math.cos(angle) * 1.2 + Math.sin(angle) * 0.46
      );

      const destructibles = ctrl?.destructibles;
      const aimPoint = (destructibles?.getAimTargetPoint && ctrl?.camera)
        ? destructibles.getAimTargetPoint(ctrl.camera, 95).point
        : new THREE.Vector3(pos.x + Math.sin(angle) * 40, pos.y + 1.25, pos.z + Math.cos(angle) * 40);

      if (typeof destructibles?.spawnRpgRocket === 'function') {
        destructibles.spawnRpgRocket(muzzlePos, aimPoint);
        const created = destructibles.projectiles?.[destructibles.projectiles.length - 1];
        if (created) {
          created.damage = 220;
          created.blastRadius = 9.5;
          created.canBreakSilver = true;
          created.canBreakCrackedWall = true;
        }
      } else if (Array.isArray(destructibles?.projectiles)) {
        soundFX.playExplosion?.(1.0);
        const rocketMesh = new THREE.Mesh(FLARE_ROCKET_GEO, MAT_CRIMSON_PLATE);
        rocketMesh.position.copy(muzzlePos);
        destructibles.scene?.add?.(rocketMesh);
        destructibles.projectiles.push({
          mesh: rocketMesh, type: 'rpg_rocket',
          vel: aimPoint.clone().sub(muzzlePos).normalize().multiplyScalar(85),
          life: 2.2, damage: 220, blastRadius: 9.5, isSolar: false,
          canBreakSilver: true, canBreakCrackedWall: true
        });
      }
      return true;
    }
  },

  cv_medkit: {
    activate(runtime) {
      const ctrl = runtime.controller;
      ctrl?.minifigure?.triggerPunch?.();

      const pos = ctrl?.position || new THREE.Vector3();
      const angle = Number(ctrl?.facingAngle) || 0;
      const mx = pos.x + Math.sin(angle) * 1.15;
      const mz = pos.z + Math.cos(angle) * 1.15;
      const my = getGroundY(ctrl, mx, mz, pos.y);

      const group = new THREE.Group();
      const bag = new THREE.Mesh(MEDKIT_BAG_GEO, MAT_GUNMETAL);
      bag.position.y = 0.17;
      const crossA = new THREE.Mesh(MEDKIT_CROSS_A_GEO, MAT_MED_RED);
      crossA.position.y = 0.35;
      const crossB = new THREE.Mesh(MEDKIT_CROSS_B_GEO, MAT_MED_RED);
      crossB.position.y = 0.35;
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.78 });
      const ring = new THREE.Mesh(MEDKIT_RING_GEO, ringMat);
      ring.position.y = 0.06;

      group.add(bag, crossA, crossB, ring);
      group.position.set(mx, my, mz);
      getScene(ctrl)?.add?.(group);

      const center = new THREE.Vector3(mx, my, mz);
      applySquadAreaHeal(ctrl, center, 6.5, 18);

      runtime.deployables.medkits.push({
        mesh: group, ringMesh: ring, center, radius: 6.5, timer: 6.0, pulseTimer: 0.5
      });
      return true;
    }
  },

  cv_signal_fireworks: {
    activate(runtime) {
      const ctrl = runtime.controller;
      ctrl?.minifigure?.triggerPunch?.();
      soundFX.playFireballCast?.();

      const pos = ctrl?.position || new THREE.Vector3();
      const scene = getScene(ctrl);

      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const flareMesh = new THREE.Mesh(FLARE_ROCKET_GEO, MAT_FLARE);
        flareMesh.position.set(pos.x + Math.cos(ang) * 0.4, pos.y + 1.5, pos.z + Math.sin(ang) * 0.4);
        scene?.add?.(flareMesh);
        runtime.deployables.fireworks.push({
          mesh: flareMesh,
          vel: new THREE.Vector3(Math.cos(ang) * 2.8, 25 + i * 2.2, Math.sin(ang) * 2.8),
          fuse: 0.42 + i * 0.1
        });
      }

      const markRadius = 42.0;
      const livingCity = ctrl?.world?.livingCity;
      const playerFaction = livingCity?.playerFaction || 'cv';
      const markObject = (obj, refPos) => {
        if (!obj || obj.destroyed || obj.isAlliedToPlayer) return;
        obj._signalMarkedTimer = 10.0;
        if (!runtime.deployables.markedTargets.has(obj)) {
          const diamond = new THREE.Mesh(MARK_DIAMOND_GEO, MAT_MARK_DIAMOND);
          diamond.position.set(refPos.x, refPos.y + (obj.height || 2.0) + 0.85, refPos.z);
          scene?.add?.(diamond);
          runtime.deployables.markedTargets.set(obj, diamond);
        }
      };

      const nearObjs = ctrl?.destructibles?.getObjectsNear?.(pos.x, pos.z, markRadius) || [];
      for (let i = 0; i < nearObjs.length; i++) {
        const obj = nearObjs[i];
        const isHostile = Boolean(
          obj && !obj.destroyed && !obj.isAlliedToPlayer && (
            obj.isCombatNpc || obj.isPoliceUnit || obj.isFactionWarUnit ||
            obj.type === 'npc_fighter' || obj.type === 'npc_boss' ||
            obj.type === 'hunter_drone' || obj.type === 'police_helicopter'
          )
        );
        const oPos = obj?.mesh?.position || obj?.basePos;
        if (isHostile && oPos && Math.hypot(oPos.x - pos.x, oPos.z - pos.z) <= markRadius) {
          markObject(obj, oPos);
        }
      }

      const npcs = livingCity?.factionWar?.combatNpcs || livingCity?.combatNpcs || [];
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc || npc.isAllied || npc.faction === playerFaction) continue;
        const nPos = npc.visual?.root?.position || npc.destructible?.mesh?.position || npc.destructible?.basePos;
        if (npc.destructible && nPos && Math.hypot(nPos.x - pos.x, nPos.z - pos.z) <= markRadius) {
          markObject(npc.destructible, nPos);
        }
      }

      runtime.deployables.signalBuffZones.push({ center: pos.clone(), radius: markRadius, timer: 10.0 });
      return true;
    }
  }
};

export function isBlockedByCvBarricade(runtime, projPos, applyDamage = false) {
  const list = runtime.deployables.barricades;
  for (let i = list.length - 1; i >= 0; i--) {
    const bar = list[i];
    if (projPos.y < bar.center.y - 0.15 || projPos.y > bar.center.y + bar.height) continue;
    const dx = projPos.x - bar.center.x;
    const dz = projPos.z - bar.center.z;
    const cosA = Math.cos(-bar.angle);
    const sinA = Math.sin(-bar.angle);
    const localX = dx * cosA - dz * sinA;
    const localZ = dx * sinA + dz * cosA;
    if (Math.abs(localX) <= bar.halfW && Math.abs(localZ) <= bar.halfD) {
      if (applyDamage) {
        bar.hp -= 18;
        if (bar.destructible) bar.destructible.hp = bar.hp;
        if (bar.hp <= 0) {
          removeBarricadeEntry(runtime, bar);
          list.splice(i, 1);
        }
      }
      return true;
    }
  }
  return false;
}

export function isInsideCvSignalBuff(runtime, pos) {
  if (!pos) return false;
  for (const zone of runtime.deployables.signalBuffZones) {
    if (Math.hypot(pos.x - zone.center.x, pos.z - zone.center.z) <= zone.radius) return true;
  }
  return false;
}

export function updateCvDeployables(runtime, dt) {
  const ctrl = runtime.controller;
  const destructibles = ctrl?.destructibles;

  for (let i = runtime.deployables.barricades.length - 1; i >= 0; i--) {
    const bar = runtime.deployables.barricades[i];
    bar.timer -= dt;
    if (bar.timer <= 0 || bar.hp <= 0 || bar.destructible?.destroyed) {
      removeBarricadeEntry(runtime, bar);
      runtime.deployables.barricades.splice(i, 1);
    }
  }

  for (let i = runtime.deployables.medkits.length - 1; i >= 0; i--) {
    const mk = runtime.deployables.medkits[i];
    mk.timer -= dt;
    mk.pulseTimer -= dt;
    const pulseScale = 0.94 + Math.sin(mk.timer * 8.0) * 0.06;
    mk.ringMesh.scale.set(pulseScale, pulseScale, 1);
    if (mk.pulseTimer <= 0 && mk.timer > 0) {
      mk.pulseTimer += 0.5;
      applySquadAreaHeal(ctrl, mk.center, mk.radius, 18);
    }
    if (mk.timer <= 0) {
      if (mk.mesh?.parent) mk.mesh.parent.remove(mk.mesh);
      disposeTransientObject3D(mk.mesh);
      runtime.deployables.medkits.splice(i, 1);
    }
  }

  for (let i = runtime.deployables.fireworks.length - 1; i >= 0; i--) {
    const fw = runtime.deployables.fireworks[i];
    fw.fuse -= dt;
    fw.mesh.position.addScaledVector(fw.vel, dt);
    if (fw.fuse <= 0) {
      soundFX.playExplosion?.(0.45);
      const bp = fw.mesh.position;
      for (let s = 0; s < 10; s++) {
        const ang = (s / 10) * Math.PI * 2;
        destructibles?._spawnFxParticle?.(
          SPARK_CUBE_GEO, s % 2 === 0 ? 0xef4444 : 0xf59e0b, 0.95,
          bp.x, bp.y, bp.z, 1.2, 1.2, 1.2,
          Math.cos(ang) * 11, (Math.random() - 0.3) * 8, Math.sin(ang) * 11, 0.52
        );
      }
      if (fw.mesh.parent) fw.mesh.parent.remove(fw.mesh);
      disposeTransientObject3D(fw.mesh);
      runtime.deployables.fireworks.splice(i, 1);
    }
  }

  for (const [obj, diamond] of runtime.deployables.markedTargets.entries()) {
    obj._signalMarkedTimer = Math.max(0, (obj._signalMarkedTimer || 0) - dt);
    if (obj.destroyed || obj._signalMarkedTimer <= 0) {
      obj._signalMarkedTimer = 0;
      if (diamond?.parent) diamond.parent.remove(diamond);
      if (diamond) disposeTransientObject3D(diamond);
      runtime.deployables.markedTargets.delete(obj);
    } else if (diamond) {
      const oPos = obj.mesh?.position || obj.basePos;
      if (oPos) {
        diamond.position.set(oPos.x, oPos.y + (obj.height || 2.0) + 0.85, oPos.z);
        diamond.rotation.y += dt * 4.2;
      }
    }
  }

  for (let i = runtime.deployables.signalBuffZones.length - 1; i >= 0; i--) {
    runtime.deployables.signalBuffZones[i].timer -= dt;
    if (runtime.deployables.signalBuffZones[i].timer <= 0) {
      runtime.deployables.signalBuffZones.splice(i, 1);
    }
  }
}

export function disposeCvDeployables(runtime) {
  for (const bar of runtime.deployables.barricades) removeBarricadeEntry(runtime, bar);
  runtime.deployables.barricades.length = 0;
  for (const mk of runtime.deployables.medkits) {
    if (mk.mesh?.parent) mk.mesh.parent.remove(mk.mesh);
    disposeTransientObject3D(mk.mesh);
  }
  runtime.deployables.medkits.length = 0;
  for (const fw of runtime.deployables.fireworks) {
    if (fw.mesh?.parent) fw.mesh.parent.remove(fw.mesh);
    disposeTransientObject3D(fw.mesh);
  }
  runtime.deployables.fireworks.length = 0;
  for (const [obj, diamond] of runtime.deployables.markedTargets.entries()) {
    obj._signalMarkedTimer = 0;
    if (diamond?.parent) diamond.parent.remove(diamond);
    if (diamond) disposeTransientObject3D(diamond);
  }
  runtime.deployables.markedTargets.clear();
  runtime.deployables.signalBuffZones.length = 0;
}
