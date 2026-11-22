/**
 * AresAbilities.js
 *
 * Tactical Q/E abilities for A.R.E.S. Cyber-Mercenary Operators:
 * - Bastião-7: Q `ares_energy_dome` (5.5m hex dome for 8.0s, blocks external shots, 60% DR inside)
 *              E `ares_med_drone` (orbiting drone at y+2.35m for 10.0s, hides back-drone, +16 HP / 0.5s in 8.5m)
 * - Agulha:    Q `ares_optic_camo` (6.0s stealth cloak, +18% speed, clears locks, breaks immediately on fire)
 *              E `ares_emp_grenade` (up to 45m, 14.0m EMP shockwave, 95 dmg, stuns enemy NPCs for 3.5s)
 */

import * as THREE from 'three';
import {
  getLegoMaterial,
  markAsSharedAsset,
  disposeTransientObject3D
} from '../../../materials/LegoMaterials.js';
import { soundFX } from '../../../audio/SoundFX.js';

const DOME_HEX_GEO = markAsSharedAsset(
  new THREE.SphereGeometry(5.5, 6, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)
);
const DOME_RING_GEO = markAsSharedAsset(new THREE.TorusGeometry(5.5, 0.09, 6, 24).rotateX(Math.PI / 2));

const DRONE_CHASSIS_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.28, 0.24, 0.14, 8));
const DRONE_RING_GEO = markAsSharedAsset(new THREE.TorusGeometry(0.36, 0.035, 8, 18).rotateX(Math.PI / 2));
const DRONE_AURA_GEO = markAsSharedAsset(new THREE.TorusGeometry(8.5, 0.055, 8, 36).rotateX(Math.PI / 2));

const EMP_SPHERE_GEO = markAsSharedAsset(new THREE.SphereGeometry(1, 14, 12));
const EMP_RING_GEO = markAsSharedAsset(new THREE.TorusGeometry(1, 0.08, 8, 32).rotateX(Math.PI / 2));
const EMP_SPARK_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.18, 0.18, 0.18));

const MAT_TITANIUM = markAsSharedAsset(
  getLegoMaterial(0x334155, { roughness: 0.24, metalness: 0.72 })
);
const MAT_NEON_CYAN_PURPLE = markAsSharedAsset(
  getLegoMaterial(0x22d3ee, { emissive: 0xa855f7, emissiveIntensity: 2.5, roughness: 0.1 })
);

function getScene(ctrl) {
  return ctrl?.destructibles?.scene || ctrl?.world?.scene || null;
}

function getGroundY(ctrl, x, z, refY = 0) {
  if (ctrl?.world?.getSurfaceHeightAt) return ctrl.world.getSurfaceHeightAt(x, z, refY);
  if (ctrl?.world?.getTerrainHeightAt) return ctrl.world.getTerrainHeightAt(x, z);
  return 0;
}

function pulseDroneSquadHeal(ctrl, center, radius, amount) {
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
  const playerFaction = livingCity?.playerFaction || 'ares';
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

function clearEnemyLocksOnPlayer(ctrl) {
  const livingCity = ctrl?.world?.livingCity;
  if (livingCity?.wantedSystem) {
    livingCity.wantedSystem._hasLineOfSight = false;
  }
  const npcs = livingCity?.factionWar?.combatNpcs || livingCity?.combatNpcs || [];
  const playerFaction = livingCity?.playerFaction || 'ares';
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (!npc || npc.isAllied || npc.faction === playerFaction) continue;
    npc.fireCooldown = Math.max(npc.fireCooldown || 0, 0.65);
  }
}

export const ARES_ABILITIES = {
  ares_energy_dome: {
    activate(runtime) {
      const ctrl = runtime.controller;
      ctrl?.minifigure?.triggerPunch?.();
      soundFX.playLaserShot?.();

      const pos = ctrl?.position || new THREE.Vector3();
      const gy = getGroundY(ctrl, pos.x, pos.z, pos.y);

      const group = new THREE.Group();
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: 0xa855f7,
        emissive: 0x7e22ce,
        emissiveIntensity: 1.35,
        roughness: 0.15,
        transparent: true,
        opacity: 0.28,
        flatShading: true,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0xd8b4fe,
        wireframe: true,
        transparent: true,
        opacity: 0.62
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.9
      });

      const shell = new THREE.Mesh(DOME_HEX_GEO, shellMat);
      const wire = new THREE.Mesh(DOME_HEX_GEO, wireMat);
      const baseRing = new THREE.Mesh(DOME_RING_GEO, ringMat);
      baseRing.position.y = 0.06;

      group.add(shell, wire, baseRing);
      group.position.set(pos.x, gy, pos.z);
      getScene(ctrl)?.add?.(group);

      runtime.deployables.energyDomes.push({
        mesh: group,
        shellMat,
        wireMat,
        center: new THREE.Vector3(pos.x, gy, pos.z),
        radius: 5.5,
        timer: 8.0
      });
      return true;
    }
  },

  ares_med_drone: {
    activate(runtime) {
      const ctrl = runtime.controller;
      soundFX.playHeroSwap?.();

      if (ctrl?.minifigure?.operatorBackDroneGroup) {
        ctrl.minifigure.operatorBackDroneGroup.visible = false;
      }

      const pos = ctrl?.position || new THREE.Vector3();
      const droneGroup = new THREE.Group();
      const body = new THREE.Mesh(DRONE_CHASSIS_GEO, MAT_TITANIUM);
      const rotorRing = new THREE.Mesh(DRONE_RING_GEO, MAT_NEON_CYAN_PURPLE);
      droneGroup.add(body, rotorRing);
      droneGroup.position.set(pos.x + 1.35, pos.y + 2.35, pos.z);

      const auraMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.45
      });
      const auraMesh = new THREE.Mesh(DRONE_AURA_GEO, auraMat);
      auraMesh.position.set(pos.x, pos.y + 0.08, pos.z);

      const scene = getScene(ctrl);
      scene?.add?.(droneGroup);
      scene?.add?.(auraMesh);

      pulseDroneSquadHeal(ctrl, pos, 8.5, 16);

      runtime.deployables.medDrones.push({
        mesh: droneGroup,
        auraMesh,
        orbitAngle: 0,
        timer: 10.0,
        pulseTimer: 0.5,
        radius: 8.5
      });
      return true;
    }
  },

  ares_optic_camo: {
    activate(runtime) {
      const ctrl = runtime.controller;
      runtime.personal.camoActive = true;
      runtime.personal.camoTimer = runtime.personal.camoMaxDuration;
      ctrl?.minifigure?.setStealthVisual?.(true);
      clearEnemyLocksOnPlayer(ctrl);
      soundFX.playTacticalRoll?.();
      return true;
    }
  },

  ares_emp_grenade: {
    activate(runtime) {
      const ctrl = runtime.controller;
      if (typeof ctrl?._alignCharacterToCrosshair === 'function') {
        ctrl._alignCharacterToCrosshair();
      }
      ctrl?.minifigure?.triggerPunch?.();
      soundFX.playLaserShot?.();
      soundFX.playExplosion?.(0.75);

      const pos = ctrl?.position || new THREE.Vector3();
      const angle = Number(ctrl?.facingAngle) || 0;
      const destructibles = ctrl?.destructibles;

      let blastPos;
      if (destructibles?.getAimTargetPoint && ctrl?.camera) {
        blastPos = destructibles.getAimTargetPoint(ctrl.camera, 45).point.clone();
      } else {
        const tx = pos.x + Math.sin(angle) * 20;
        const tz = pos.z + Math.cos(angle) * 20;
        blastPos = new THREE.Vector3(tx, getGroundY(ctrl, tx, tz, pos.y) + 0.25, tz);
      }

      const empRadius = 14.0;
      const group = new THREE.Group();
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.68
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.92
      });
      const sphere = new THREE.Mesh(EMP_SPHERE_GEO, sphereMat);
      const ring = new THREE.Mesh(EMP_RING_GEO, ringMat);
      group.add(sphere, ring);
      group.position.copy(blastPos);
      getScene(ctrl)?.add?.(group);

      runtime.deployables.empWaves.push({
        mesh: group,
        sphereMat,
        ringMat,
        maxRadius: empRadius,
        age: 0,
        duration: 0.52
      });

      if (typeof destructibles?._spawnElectricSparks === 'function') {
        destructibles._spawnElectricSparks(blastPos, 18);
      } else {
        for (let s = 0; s < 14; s++) {
          const ang = (s / 14) * Math.PI * 2;
          destructibles?._spawnFxParticle?.(
            EMP_SPARK_GEO,
            s % 2 === 0 ? 0xa855f7 : 0x22d3ee,
            0.95,
            blastPos.x, blastPos.y + 0.4, blastPos.z,
            1, 1, 1,
            Math.cos(ang) * 12,
            3 + Math.random() * 6,
            Math.sin(ang) * 12,
            0.42
          );
        }
      }

      const hitSet = new Set();
      const candidates = destructibles?.getObjectsNear?.(blastPos.x, blastPos.z, empRadius + 2.0) || [];
      for (let i = 0; i < candidates.length; i++) {
        const obj = candidates[i];
        if (!obj || obj.destroyed || obj.isDriven || obj.isAlliedToPlayer) continue;
        const oPos = obj._isDynamicIndexed ? (obj.mesh?.position || obj.basePos) : obj.basePos;
        if (!oPos) continue;
        if (Math.hypot(oPos.x - blastPos.x, oPos.z - blastPos.z) <= empRadius + (obj.radius || 1.0)) {
          hitSet.add(obj);
          destructibles.damageObject?.(obj, 95, blastPos, false, { canBreakSilver: false });
        }
      }

      const livingCity = ctrl?.world?.livingCity;
      const npcs = livingCity?.factionWar?.combatNpcs || livingCity?.combatNpcs || [];
      const playerFaction = livingCity?.playerFaction || 'ares';
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc || npc.isAllied || npc.faction === playerFaction) continue;
        const nPos = npc.visual?.root?.position || npc.destructible?.mesh?.position || npc.destructible?.basePos;
        if (!nPos) continue;
        if (Math.hypot(nPos.x - blastPos.x, nPos.z - blastPos.z) <= empRadius) {
          npc.stunTimer = 3.5;
          npc.fireCooldown = Math.max(npc.fireCooldown || 0, 3.5);
          runtime.deployables.stunnedNpcs.add(npc);
          if (npc.destructible && !npc.destructible.destroyed && !hitSet.has(npc.destructible)) {
            hitSet.add(npc.destructible);
            destructibles?.damageObject?.(npc.destructible, 95, blastPos, false, { canBreakSilver: false });
          }
        }
      }
      return true;
    }
  }
};

export function isInsideAresDome(runtime, pos) {
  if (!pos) return false;
  for (const dome of runtime.deployables.energyDomes) {
    const dHoriz = Math.hypot(pos.x - dome.center.x, pos.z - dome.center.z);
    const dy = pos.y - dome.center.y;
    if (dHoriz <= 5.6 && dy >= -1.0 && dy <= 5.8) {
      return true;
    }
  }
  return false;
}

export function isBlockedByAresDome(runtime, projPos, originPos = null) {
  for (const dome of runtime.deployables.energyDomes) {
    if (projPos.y < dome.center.y - 0.3 || projPos.y > dome.center.y + dome.radius + 0.3) continue;
    const distNow = Math.hypot(projPos.x - dome.center.x, projPos.z - dome.center.z);
    if (distNow > dome.radius + 0.25) continue;
    if (!originPos) return true;
    const distOrigin = Math.hypot(originPos.x - dome.center.x, originPos.z - dome.center.z);
    if (distOrigin > dome.radius + 0.15) {
      return true;
    }
  }
  return false;
}

export function cancelAresCamo(runtime, startCooldown = true) {
  if (!runtime.personal.camoActive) return;
  runtime.personal.camoActive = false;
  runtime.personal.camoTimer = 0;
  runtime.controller?.minifigure?.setStealthVisual?.(false);
  if (startCooldown) {
    const cd = runtime._ensureCooldownEntry('ares_agulha');
    cd.q = 14;
  }
}

export function updateAresDeployables(runtime, dt) {
  const ctrl = runtime.controller;
  const pos = ctrl?.position;

  for (let i = runtime.deployables.energyDomes.length - 1; i >= 0; i--) {
    const dome = runtime.deployables.energyDomes[i];
    dome.timer -= dt;
    dome.mesh.rotation.y += dt * 0.25;
    if (dome.timer < 1.0) {
      const fade = Math.max(0, dome.timer);
      dome.shellMat.opacity = 0.28 * fade;
      dome.wireMat.opacity = 0.62 * fade;
    }
    if (dome.timer <= 0) {
      if (dome.mesh?.parent) dome.mesh.parent.remove(dome.mesh);
      disposeTransientObject3D(dome.mesh);
      runtime.deployables.energyDomes.splice(i, 1);
    }
  }

  for (let i = runtime.deployables.medDrones.length - 1; i >= 0; i--) {
    const dr = runtime.deployables.medDrones[i];
    dr.timer -= dt;
    dr.pulseTimer -= dt;
    dr.orbitAngle += dt * 2.8;

    const anchor = pos || dr.mesh.position;
    dr.mesh.position.set(
      anchor.x + Math.cos(dr.orbitAngle) * 1.35,
      anchor.y + 2.35 + Math.sin(dr.orbitAngle * 2.0) * 0.12,
      anchor.z + Math.sin(dr.orbitAngle) * 1.35
    );
    dr.mesh.rotation.y = -dr.orbitAngle;
    dr.auraMesh.position.set(anchor.x, anchor.y + 0.08, anchor.z);

    if (dr.pulseTimer <= 0 && dr.timer > 0) {
      dr.pulseTimer += 0.5;
      pulseDroneSquadHeal(ctrl, anchor, dr.radius, 16);
    }
    if (dr.timer <= 0) {
      if (dr.mesh?.parent) dr.mesh.parent.remove(dr.mesh);
      if (dr.auraMesh?.parent) dr.auraMesh.parent.remove(dr.auraMesh);
      disposeTransientObject3D(dr.mesh);
      disposeTransientObject3D(dr.auraMesh);
      runtime.deployables.medDrones.splice(i, 1);
      if (runtime.deployables.medDrones.length === 0 && ctrl?.minifigure?.operatorBackDroneGroup) {
        ctrl.minifigure.operatorBackDroneGroup.visible = true;
      }
    }
  }

  if (runtime.personal.camoActive) {
    runtime.personal.camoTimer -= dt;
    clearEnemyLocksOnPlayer(ctrl);
    if (runtime.personal.camoTimer <= 0) {
      cancelAresCamo(runtime, false);
    }
  }

  for (let i = runtime.deployables.empWaves.length - 1; i >= 0; i--) {
    const ew = runtime.deployables.empWaves[i];
    ew.age += dt;
    const t = Math.min(1, ew.age / ew.duration);
    const scale = THREE.MathUtils.lerp(0.6, ew.maxRadius, Math.pow(t, 0.5));
    ew.mesh.scale.setScalar(scale);
    ew.sphereMat.opacity = (1 - t) * 0.55;
    ew.ringMat.opacity = (1 - t) * 0.9;
    if (t >= 1) {
      if (ew.mesh?.parent) ew.mesh.parent.remove(ew.mesh);
      disposeTransientObject3D(ew.mesh);
      runtime.deployables.empWaves.splice(i, 1);
    }
  }

  for (const npc of runtime.deployables.stunnedNpcs) {
    if (!npc || npc.destructible?.destroyed || (npc.stunTimer ?? 0) <= 0) {
      if (npc) npc.stunTimer = 0;
      runtime.deployables.stunnedNpcs.delete(npc);
      continue;
    }
    npc.stunTimer = Math.max(0, npc.stunTimer - dt);
    npc.fireCooldown = Math.max(npc.fireCooldown || 0, 0.35);
    if (npc.stunTimer <= 0) {
      runtime.deployables.stunnedNpcs.delete(npc);
    }
  }
}

export function disposeAresDeployables(runtime) {
  for (const dome of runtime.deployables.energyDomes) {
    if (dome.mesh?.parent) dome.mesh.parent.remove(dome.mesh);
    disposeTransientObject3D(dome.mesh);
  }
  runtime.deployables.energyDomes.length = 0;

  for (const dr of runtime.deployables.medDrones) {
    if (dr.mesh?.parent) dr.mesh.parent.remove(dr.mesh);
    if (dr.auraMesh?.parent) dr.auraMesh.parent.remove(dr.auraMesh);
    disposeTransientObject3D(dr.mesh);
    disposeTransientObject3D(dr.auraMesh);
  }
  runtime.deployables.medDrones.length = 0;
  if (runtime.controller?.minifigure?.operatorBackDroneGroup) {
    runtime.controller.minifigure.operatorBackDroneGroup.visible = true;
  }

  for (const ew of runtime.deployables.empWaves) {
    if (ew.mesh?.parent) ew.mesh.parent.remove(ew.mesh);
    disposeTransientObject3D(ew.mesh);
  }
  runtime.deployables.empWaves.length = 0;
  runtime.deployables.stunnedNpcs.clear();
}
