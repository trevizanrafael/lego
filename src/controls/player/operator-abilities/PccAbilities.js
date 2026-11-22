/**
 * PccAbilities.js
 *
 * Tactical Q/E abilities for Primeiro Comando (PCC) Operators:
 * - Contador: Q `pcc_supply_crate` (8.0s crate, 6.0m radius, instant + mid ammo refill, +15 HP / 0.5s)
 *             E `pcc_remote_c4` (2-stage: 1st throws blinking C4 up to 22m; 2nd detonates 10.5m / 240 dmg)
 * - Muralha:  Q `pcc_ballistic_shield` (raises frontal shield up to 7.0s, 80% front DR, blocks shots, shotgun free)
 *             E `pcc_shield_charge` (0.45s dash at 34 m/s, 115 dmg, breaks cracked walls + knockback)
 */

import * as THREE from 'three';
import {
  getLegoMaterial,
  markAsSharedAsset,
  disposeTransientObject3D
} from '../../../materials/LegoMaterials.js';
import { soundFX } from '../../../audio/SoundFX.js';

const CRATE_BODY_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.92, 0.52, 0.66));
const CRATE_LID_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.96, 0.1, 0.7));
const CRATE_STRIPE_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.98, 0.08, 0.24));
const CRATE_RING_GEO = markAsSharedAsset(new THREE.TorusGeometry(6.0, 0.075, 8, 40).rotateX(Math.PI / 2));

const C4_BRICK_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.36, 0.14, 0.24));
const C4_STRAP_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.38, 0.15, 0.06));
const C4_LED_GEO = markAsSharedAsset(new THREE.SphereGeometry(0.045, 8, 8));
const CHARGE_SPARK_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.2, 0.2, 0.2));

const MAT_ABYSS = markAsSharedAsset(getLegoMaterial(0x090c14, { roughness: 0.36, metalness: 0.45 }));
const MAT_COBALT = markAsSharedAsset(
  getLegoMaterial(0x1d4ed8, { emissive: 0x1e40af, emissiveIntensity: 1.1, roughness: 0.28 })
);
const MAT_STEEL = markAsSharedAsset(getLegoMaterial(0x475569, { roughness: 0.24, metalness: 0.7 }));

function getScene(ctrl) {
  return ctrl?.destructibles?.scene || ctrl?.world?.scene || null;
}

function getGroundY(ctrl, x, z, refY = 0) {
  if (ctrl?.world?.getSurfaceHeightAt) return ctrl.world.getSurfaceHeightAt(x, z, refY);
  if (ctrl?.world?.getTerrainHeightAt) return ctrl.world.getTerrainHeightAt(x, z);
  return 0;
}

function healPlayerAndAlliesInCrate(ctrl, center, radius, amount) {
  const livingCity = ctrl?.world?.livingCity;
  let healed = false;

  if (livingCity && ctrl?.position) {
    const dp = Math.hypot(ctrl.position.x - center.x, ctrl.position.z - center.z);
    if (dp <= radius && livingCity.playerHp < livingCity.playerMaxHp) {
      livingCity.playerHp = Math.min(livingCity.playerMaxHp, livingCity.playerHp + amount);
      ctrl.hud?.setPlayerHealth?.(livingCity.playerHp, livingCity.playerMaxHp, true);
      healed = true;
    }
  }

  const npcs = livingCity?.factionWar?.combatNpcs || livingCity?.combatNpcs || [];
  const playerFaction = livingCity?.playerFaction || 'pcc';
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    const obj = npc?.destructible;
    if (!obj || obj.destroyed) continue;
    if (!(npc.isAllied || npc.faction === playerFaction)) continue;
    const nPos = npc.visual?.root?.position || obj.mesh?.position || obj.basePos;
    if (nPos && Math.hypot(nPos.x - center.x, nPos.z - center.z) <= radius) {
      const maxHp = obj.maxHp || 100;
      if (obj.hp < maxHp) {
        obj.hp = Math.min(maxHp, obj.hp + amount);
        healed = true;
      }
    }
  }
  if (healed) soundFX.playHealTick?.();
}

function applyShieldVisualPose(minifig, raised) {
  const shield = minifig?.operatorShieldGroup;
  if (!shield) return;

  if (!shield.userData._savedRestPose) {
    shield.userData._savedRestPose = {
      px: shield.position.x,
      py: shield.position.y,
      pz: shield.position.z,
      rx: shield.rotation.x,
      ry: shield.rotation.y,
      rz: shield.rotation.z,
      sx: shield.scale.x,
      sy: shield.scale.y,
      sz: shield.scale.z
    };
  }

  if (raised) {
    shield.position.set(0.36, -0.06, 0.34);
    shield.rotation.set(0.18, -1.28, 0);
    shield.scale.set(1.32, 1.34, 1.48);
    if (minifig.leftArmPivot) {
      minifig.leftArmPivot.rotation.x = -1.36;
      minifig.leftArmPivot.rotation.y = -0.42;
    }
  } else {
    const rest = shield.userData._savedRestPose;
    shield.position.set(rest.px, rest.py, rest.pz);
    shield.rotation.set(rest.rx, rest.ry, rest.rz);
    shield.scale.set(rest.sx, rest.sy, rest.sz);
  }
}

function sweepShieldChargeHits(runtime) {
  const ctrl = runtime.controller;
  const destructibles = ctrl?.destructibles;
  const pos = ctrl?.position;
  if (!pos) return;

  const dir = runtime.personal.chargeDir;
  const sweepX = pos.x + dir.x * 1.35;
  const sweepZ = pos.z + dir.z * 1.35;

  const nearObjs = destructibles?.getObjectsNear?.(sweepX, sweepZ, 3.8) || [];
  for (let i = 0; i < nearObjs.length; i++) {
    const obj = nearObjs[i];
    if (!obj || obj.destroyed || obj.isDriven || obj.isAlliedToPlayer) continue;
    if (runtime.personal.chargeHitSet.has(obj)) continue;

    const oPos = obj._isDynamicIndexed ? (obj.mesh?.position || obj.basePos) : obj.basePos;
    if (!oPos) continue;
    const dHoriz = Math.hypot(oPos.x - sweepX, oPos.z - sweepZ);
    const dVert = Math.abs((oPos.y + (obj.height || 2.0) * 0.5) - (pos.y + 1.0));
    if (dHoriz <= (obj.radius || 1.2) + 1.85 && dVert <= (obj.height || 2.0) + 1.5) {
      runtime.personal.chargeHitSet.add(obj);
      destructibles.damageObject?.(obj, 115, pos, false, { canBreakCrackedWall: true });
      if (obj._isDynamicIndexed && obj.mesh?.position && !obj.destroyed) {
        obj.mesh.position.x += dir.x * 2.8;
        obj.mesh.position.z += dir.z * 2.8;
        obj.basePos?.copy?.(obj.mesh.position);
      }
      ctrl.cameraShakeTimer = Math.max(ctrl.cameraShakeTimer || 0, 0.24);
      destructibles._spawnFxParticle?.(
        CHARGE_SPARK_GEO,
        0x38bdf8,
        0.92,
        oPos.x, oPos.y + 1.0, oPos.z,
        1.1, 1.1, 1.1,
        dir.x * 9, 3.5, dir.z * 9,
        0.28
      );
    }
  }

  const livingCity = ctrl?.world?.livingCity;
  const npcs = livingCity?.factionWar?.combatNpcs || livingCity?.combatNpcs || [];
  const playerFaction = livingCity?.playerFaction || 'pcc';
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (!npc || npc.isAllied || npc.faction === playerFaction) continue;
    if (runtime.personal.chargeHitSet.has(npc)) continue;
    const nPos = npc.visual?.root?.position;
    if (!nPos) continue;
    if (Math.hypot(nPos.x - sweepX, nPos.z - sweepZ) <= 2.4) {
      runtime.personal.chargeHitSet.add(npc);
      if (npc.destructible && !npc.destructible.destroyed && !runtime.personal.chargeHitSet.has(npc.destructible)) {
        runtime.personal.chargeHitSet.add(npc.destructible);
        destructibles?.damageObject?.(npc.destructible, 115, pos, false, { canBreakCrackedWall: true });
      }
      nPos.x += dir.x * 3.1;
      nPos.z += dir.z * 3.1;
      npc.destructible?.basePos?.copy?.(nPos);
    }
  }
}

export const PCC_ABILITIES = {
  pcc_supply_crate: {
    activate(runtime) {
      const ctrl = runtime.controller;
      ctrl?.minifigure?.triggerPunch?.();
      soundFX.playHeroSwap?.();

      const pos = ctrl?.position || new THREE.Vector3();
      const angle = Number(ctrl?.facingAngle) || 0;
      const cx = pos.x + Math.sin(angle) * 1.45;
      const cz = pos.z + Math.cos(angle) * 1.45;
      const cy = getGroundY(ctrl, cx, cz, pos.y);

      const group = new THREE.Group();
      const body = new THREE.Mesh(CRATE_BODY_GEO, MAT_ABYSS);
      body.position.y = 0.26;
      const lid = new THREE.Mesh(CRATE_LID_GEO, MAT_STEEL);
      lid.position.y = 0.55;
      const stripe = new THREE.Mesh(CRATE_STRIPE_GEO, MAT_COBALT);
      stripe.position.y = 0.34;
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.78
      });
      const ring = new THREE.Mesh(CRATE_RING_GEO, ringMat);
      ring.position.y = 0.05;

      group.add(body, lid, stripe, ring);
      group.position.set(cx, cy, cz);
      group.rotation.y = angle;
      getScene(ctrl)?.add?.(group);

      const center = new THREE.Vector3(cx, cy, cz);
      ctrl?.operatorWeapons?.refillAmmo?.(0.5, true);
      healPlayerAndAlliesInCrate(ctrl, center, 6.0, 15);

      runtime.deployables.supplyCrates.push({
        mesh: group,
        ringMesh: ring,
        center,
        radius: 6.0,
        timer: 8.0,
        pulseTimer: 0.5,
        midRefilled: false
      });
      return true;
    }
  },

  pcc_remote_c4: {
    plant(runtime) {
      const ctrl = runtime.controller;
      if (typeof ctrl?._alignCharacterToCrosshair === 'function') {
        ctrl._alignCharacterToCrosshair();
      }
      ctrl?.minifigure?.triggerPunch?.();
      soundFX.playPunchSwing?.();

      const pos = ctrl?.position || new THREE.Vector3();
      const angle = Number(ctrl?.facingAngle) || 0;
      const destructibles = ctrl?.destructibles;

      let targetPt;
      if (destructibles?.getAimTargetPoint && ctrl?.camera) {
        targetPt = destructibles.getAimTargetPoint(ctrl.camera, 22).point.clone();
      } else {
        const tx = pos.x + Math.sin(angle) * 10;
        const tz = pos.z + Math.cos(angle) * 10;
        targetPt = new THREE.Vector3(tx, getGroundY(ctrl, tx, tz, pos.y), tz);
      }

      const floorY = getGroundY(ctrl, targetPt.x, targetPt.z, targetPt.y);
      if (targetPt.y < floorY + 0.08) targetPt.y = floorY + 0.08;

      const group = new THREE.Group();
      const brick = new THREE.Mesh(C4_BRICK_GEO, MAT_ABYSS);
      const strap = new THREE.Mesh(C4_STRAP_GEO, MAT_COBALT);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const led = new THREE.Mesh(C4_LED_GEO, ledMat);
      led.position.set(0, 0.09, 0);
      group.add(brick, strap, led);
      group.position.copy(targetPt);
      getScene(ctrl)?.add?.(group);

      runtime.deployables.plantedC4 = {
        mesh: group,
        ledMesh: led,
        ledMat,
        pos: targetPt,
        age: 0,
        detonated: false
      };
      return true;
    },

    detonate(runtime) {
      const c4 = runtime.deployables.plantedC4;
      if (!c4 || c4.detonated) return false;
      c4.detonated = true;

      const ctrl = runtime.controller;
      const blastPos = c4.pos.clone();
      ctrl?.destructibles?._triggerExplosion?.(blastPos, 10.5, 240, false, true, {
        canBreakSilver: true,
        canBreakCrackedWall: true
      });
      if (ctrl) {
        ctrl.cameraShakeTimer = Math.max(ctrl.cameraShakeTimer || 0, 0.36);
      }

      if (c4.mesh?.parent) c4.mesh.parent.remove(c4.mesh);
      disposeTransientObject3D(c4.mesh);
      runtime.deployables.plantedC4 = null;
      return true;
    }
  },

  pcc_ballistic_shield: {
    activate(runtime) {
      runtime.personal.shieldActive = true;
      runtime.personal.shieldTimer = runtime.personal.shieldMaxDuration;
      applyShieldVisualPose(runtime.controller?.minifigure, true);
      soundFX.playMetalRicochet?.();
      return true;
    },

    deactivate(runtime) {
      runtime.personal.shieldActive = false;
      runtime.personal.shieldTimer = 0;
      applyShieldVisualPose(runtime.controller?.minifigure, false);
      soundFX.playHeroSwap?.();
      return true;
    }
  },

  pcc_shield_charge: {
    activate(runtime) {
      const ctrl = runtime.controller;
      if (typeof ctrl?._alignCharacterToCrosshair === 'function') {
        ctrl._alignCharacterToCrosshair();
      }
      const angle = Number(ctrl?.facingAngle) || 0;
      runtime.personal.chargeActive = true;
      runtime.personal.chargeTimer = 0.45;
      runtime.personal.chargeDir.set(Math.sin(angle), 0, Math.cos(angle)).normalize();
      runtime.personal.chargeHitSet.clear();

      if (ctrl) {
        ctrl.cameraShakeTimer = Math.max(ctrl.cameraShakeTimer || 0, 0.28);
        if (ctrl.minifigure) ctrl.minifigure.isDashing = true;
      }
      soundFX.playSeismicStomp?.();
      sweepShieldChargeHits(runtime);
      return true;
    }
  }
};

export function getPccShieldDamageMult(runtime, attackerPos = null) {
  if (!runtime.personal.shieldActive) return 1.0;
  if (!attackerPos || !runtime.controller?.position) return 0.25;

  const pos = runtime.controller.position;
  const angle = Number(runtime.controller.facingAngle) || 0;
  const fwdX = Math.sin(angle);
  const fwdZ = Math.cos(angle);
  const dx = attackerPos.x - pos.x;
  const dz = attackerPos.z - pos.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return 0.20;
  const dot = (dx / len) * fwdX + (dz / len) * fwdZ;
  return dot >= -0.15 ? 0.20 : 1.0;
}

export function isBlockedByPccShield(runtime, projPos, originPos = null) {
  if (!runtime.personal.shieldActive || !runtime.controller?.position) return false;
  const pos = runtime.controller.position;
  if (projPos.y < pos.y - 0.1 || projPos.y > pos.y + 2.15) return false;

  const dx = projPos.x - pos.x;
  const dz = projPos.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 1.85) return false;

  const angle = Number(runtime.controller.facingAngle) || 0;
  const fwdX = Math.sin(angle);
  const fwdZ = Math.cos(angle);
  const refVec = originPos
    ? { x: originPos.x - pos.x, z: originPos.z - pos.z }
    : { x: dx, z: dz };
  const refLen = Math.hypot(refVec.x, refVec.z);
  if (refLen < 0.001) return true;
  const dot = (refVec.x / refLen) * fwdX + (refVec.z / refLen) * fwdZ;
  return dot >= 0.15;
}

export function cancelPccPersonalStances(runtime) {
  if (runtime.personal.shieldActive) {
    runtime.personal.shieldActive = false;
    runtime.personal.shieldTimer = 0;
    applyShieldVisualPose(runtime.controller?.minifigure, false);
  }
  if (runtime.personal.chargeActive) {
    runtime.personal.chargeActive = false;
    runtime.personal.chargeTimer = 0;
    runtime.personal.chargeHitSet.clear();
    if (runtime.controller?.minifigure) {
      runtime.controller.minifigure.isDashing = false;
    }
  }
}

export function updatePccDeployables(runtime, dt) {
  const ctrl = runtime.controller;

  for (let i = runtime.deployables.supplyCrates.length - 1; i >= 0; i--) {
    const sc = runtime.deployables.supplyCrates[i];
    sc.timer -= dt;
    sc.pulseTimer -= dt;
    const pulse = 0.95 + Math.sin(sc.timer * 7.0) * 0.05;
    sc.ringMesh.scale.set(pulse, pulse, 1);

    if (!sc.midRefilled && sc.timer <= 4.0 && ctrl?.position) {
      sc.midRefilled = true;
      if (Math.hypot(ctrl.position.x - sc.center.x, ctrl.position.z - sc.center.z) <= sc.radius) {
        ctrl.operatorWeapons?.refillAmmo?.(0.5, true);
      }
    }
    if (sc.pulseTimer <= 0 && sc.timer > 0) {
      sc.pulseTimer += 0.5;
      healPlayerAndAlliesInCrate(ctrl, sc.center, sc.radius, 15);
    }
    if (sc.timer <= 0) {
      if (sc.mesh?.parent) sc.mesh.parent.remove(sc.mesh);
      disposeTransientObject3D(sc.mesh);
      runtime.deployables.supplyCrates.splice(i, 1);
    }
  }

  const c4 = runtime.deployables.plantedC4;
  if (c4 && !c4.detonated) {
    c4.age += dt;
    const blinkOn = Math.sin(c4.age * 16.0) > 0;
    c4.ledMesh.visible = blinkOn;
  }

  if (runtime.personal.shieldActive) {
    runtime.personal.shieldTimer -= dt;
    applyShieldVisualPose(ctrl?.minifigure, true);
    if (runtime.personal.shieldTimer <= 0) {
      PCC_ABILITIES.pcc_ballistic_shield.deactivate(runtime);
      const cd = runtime._ensureCooldownEntry('pcc_muralha');
      cd.q = 14;
    }
  }

  if (runtime.personal.chargeActive) {
    runtime.personal.chargeTimer -= dt;
    sweepShieldChargeHits(runtime);
    if (runtime.personal.chargeTimer <= 0) {
      runtime.personal.chargeActive = false;
      runtime.personal.chargeTimer = 0;
      runtime.personal.chargeHitSet.clear();
      if (ctrl?.minifigure) ctrl.minifigure.isDashing = false;
    }
  }
}

export function disposePccDeployables(runtime) {
  for (const sc of runtime.deployables.supplyCrates) {
    if (sc.mesh?.parent) sc.mesh.parent.remove(sc.mesh);
    disposeTransientObject3D(sc.mesh);
  }
  runtime.deployables.supplyCrates.length = 0;

  const c4 = runtime.deployables.plantedC4;
  if (c4) {
    if (c4.mesh?.parent) c4.mesh.parent.remove(c4.mesh);
    disposeTransientObject3D(c4.mesh);
    runtime.deployables.plantedC4 = null;
  }
}
