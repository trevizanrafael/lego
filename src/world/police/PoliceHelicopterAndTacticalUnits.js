import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { AIM_POSE, animateFactionSoldier, createFactionSoldierVisual } from '../../entities/FactionSoldierBuilder.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';
import { HumanoidHealthModel, HUMANOID_STATES } from '../npc-health/HumanoidHealthModel.js';
import { applyHumanoidHitPose, applyHumanoidKnockbackStep } from '../npc-health/HumanoidHitReactions.js';
import {
  spawnPoliceHelicopter,
  removeEagleHelicopter,
  clearAllPoliceHelicopters,
  updatePoliceHelicopters
} from './PoliceHelicopterPilot.js';

// ============================================================================
// TROPAS TÁTICAS A PÉ (PF & BOPE ELITE), DELEGAÇÃO DO ÁGUIA & BALÍSTICA POLICIAL
// ============================================================================
export const policeHelicopterAndTacticalMethods = {
  _spawnFootTrooper(spawnPos, tierStars = this.stars) {
    if (this.footUnits.length >= (tierStars >= 5 ? 7 : tierStars >= 4 ? 6 : 4)) return null;
    const isEliteBope = tierStars >= 5;
    const isRiotElite = tierStars === 4;
    const factionKey = isEliteBope || isRiotElite ? 'bope' : 'pf';
    const roleKey = isEliteBope ? (this.footUnits.length % 2 === 0 ? 'special' : 'tank') : isRiotElite ? 'tank' : 'rifleman';
    const soldier = createFactionSoldierVisual(factionKey, roleKey);

    const root = soldier.root || new THREE.Group();
    root.rotation.order = 'YXZ';
    root.userData.skipStaticMerge = true;
    if (!soldier.root) {
      root.add(soldier.bodyRig);
      soldier.root = root;
    }
    const unitScale = isEliteBope ? 1.04 : 1.0;
    if (isEliteBope && soldier.bodyRig) soldier.bodyRig.scale.setScalar(unitScale);
    if (!soldier.torso) soldier.torso = soldier.bodyRig;
    if (!soldier.weapon) soldier.weapon = soldier.weaponMount;

    soldier.rightArm.rotation.x = AIM_POSE.rightArmX;
    soldier.leftArm.rotation.x = soldier.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX;
    soldier.leftArm.rotation.z = soldier.hasShield ? 0.08 : AIM_POSE.leftArmZ;
    soldier.root.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    this.scene.add(soldier.root);

    const maxHp = isEliteBope ? 125 : isRiotElite ? 95 : 65;
    const humanoidHealth = new HumanoidHealthModel({ kind: 'police', maxHp });
    const obj = this.destructibles.registerDestructible({
      mesh: soldier.root, type: 'npc_fighter', hp: maxHp, radius: 0.95, height: 2.05, colliders: [],
      debrisColors: isEliteBope || isRiotElite
        ? [0x15161a, 0x0b0c0f, 0xf59e0b, LEGO_COLORS.yellow]
        : [0x0f1d3a, 0x111827, 0xf59e0b, LEGO_COLORS.yellow],
      studDrops: isEliteBope
        ? { silver: 2, gold: 8, blue: 6, purple: 1 }
        : isRiotElite ? { silver: 3, gold: 5, blue: 2, purple: 0 } : { silver: 4, gold: 4, blue: 1, purple: 0 },
      groundY: spawnPos.y, isPoliceUnit: true, isCombatNpc: true, isTankNpc: isRiotElite || isEliteBope, noAutoRespawn: true
    });
    Object.assign(obj, {
      maxHp, isCombatNpc: true, isPoliceUnit: true, isTankNpc: isRiotElite || isEliteBope,
      unitScale, visual: soldier, humanoidHealth
    });

    const unit = {
      mesh: soldier.root, visual: soldier, obj, destructible: obj, humanoidHealth, unitScale,
      faction: factionKey, role: roleKey, className: soldier.className, isEliteBope, isRiotElite,
      walkPhase: Math.random() * Math.PI * 2, phaseOffset: Math.random() * Math.PI * 2, muzzleTimer: 0,
      moveSpeed: isEliteBope ? 10.6 : isRiotElite ? 9.5 : 8.5,
      shootCooldown: 0.7 + Math.random() * 0.7
    };
    obj.npcRef = unit;
    this.footUnits.push(unit);
    return unit;
  },

  _clearAllFootUnits() {
    for (const fu of this.footUnits) {
      const keepCorpse = fu.obj?._managedByCorpseManager ? fu.mesh : null;
      if (fu.obj) this.destructibles.unregisterDestructible(fu.obj);
      if (keepCorpse && this.scene) {
        if (keepCorpse.parent !== this.scene) this.scene.add(keepCorpse);
      } else if (fu.mesh?.parent) {
        fu.mesh.parent.remove(fu.mesh);
      }
    }
    this.footUnits.length = 0;
  },

  _updateFootUnits(dt, playerPos) {
    this._footAnimClock = (this._footAnimClock || 0) + dt;
    for (let i = this.footUnits.length - 1; i >= 0; i--) {
      const fu = this.footUnits[i];
      if (!fu.obj || fu.obj.destroyed) {
        if (fu.visual?.muzzleFlash) fu.visual.muzzleFlash.visible = false;
        const keepCorpse = fu.obj?._managedByCorpseManager ? fu.mesh : null;
        if (fu.obj) this.destructibles.unregisterDestructible(fu.obj);
        if (keepCorpse && this.scene) {
          if (keepCorpse.parent !== this.scene) this.scene.add(keepCorpse);
        } else if (fu.mesh?.parent) {
          fu.mesh.parent.remove(fu.mesh);
        }
        this.footUnits.splice(i, 1);
        continue;
      }

      const pos = fu.mesh.position;
      const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
      if (dist > 145) {
        this.destructibles.unregisterDestructible(fu.obj);
        if (fu.mesh?.parent) fu.mesh.parent.remove(fu.mesh);
        this.footUnits.splice(i, 1);
        continue;
      }

      const vis = fu.visual;
      if (fu.muzzleTimer > 0) {
        fu.muzzleTimer -= dt;
        if (fu.muzzleTimer <= 0 && vis?.muzzleFlash) vis.muzzleFlash.visible = false;
      }

      if (fu.humanoidHealth) {
        fu.humanoidHealth.update(dt);
        if (fu.humanoidHealth.state === HUMANOID_STATES.STAGGER || fu.humanoidHealth.state === HUMANOID_STATES.DOWNED) {
          if (vis?.muzzleFlash) vis.muzzleFlash.visible = false;
          applyHumanoidKnockbackStep(fu.mesh, fu.humanoidHealth, dt, (nx, nz, cx, cz) =>
            this._isSegmentBlockedByBuilding(cx, cz, nx, nz) ? { blocked: true } : { x: nx, z: nz, valid: true }
          );
          const gY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(pos.x, pos.z) : 0;
          applyHumanoidHitPose(vis, fu.humanoidHealth, gY, dt, { unitScale: fu.unitScale || 1 });
          fu.obj.basePos.set(pos.x, gY, pos.z);
          fu.obj.groundY = gY;
          continue;
        }
      }

      fu.mesh.rotation.x = 0;
      fu.mesh.rotation.z = 0;
      if (vis) {
        vis.leftLeg.rotation.z = 0;
        vis.rightLeg.rotation.z = 0;
      }

      const ang = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      fu.mesh.rotation.y = ang;

      let moved = false;
      if (dist > 11.0 && !this.isEscaping) {
        const nx = pos.x + Math.sin(ang) * fu.moveSpeed * dt;
        const nz = pos.z + Math.cos(ang) * fu.moveSpeed * dt;
        if (!this._isSegmentBlockedByBuilding(pos.x, pos.z, nx, nz)) {
          pos.x = nx;
          pos.z = nz;
          pos.y = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(nx, nz) : 0;
          fu.obj.basePos.copy(pos);
          fu.obj.groundY = pos.y;
          moved = true;
        }
      }

      if (vis) {
        if (moved) {
          fu.walkPhase = (fu.walkPhase || 0) + dt * 9.0;
          const swing = Math.sin(fu.walkPhase);
          vis.leftLeg.rotation.x = swing * 0.62;
          vis.rightLeg.rotation.x = -swing * 0.62;
          vis.rightArm.rotation.x = AIM_POSE.rightArmX + swing * 0.16;
          vis.leftArm.rotation.x = (vis.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX) - swing * 0.22;
          vis.leftArm.rotation.z = vis.hasShield ? 0.08 : AIM_POSE.leftArmZ;
        } else {
          const damp = Math.max(0, 1 - dt * 10.0);
          vis.leftLeg.rotation.x *= damp;
          vis.rightLeg.rotation.x *= damp;
          vis.rightArm.rotation.x = AIM_POSE.rightArmX;
          vis.leftArm.rotation.x = vis.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX;
          vis.leftArm.rotation.z = vis.hasShield ? 0.08 : AIM_POSE.leftArmZ;
        }
        animateFactionSoldier(vis, this._footAnimClock, fu.phaseOffset);
      }

      if (this.isEscaping) continue;

      fu.shootCooldown -= dt;
      if (fu.shootCooldown <= 0 && dist < 72.0 && !this._isSegmentBlockedByBuilding(pos.x, pos.z, playerPos.x, playerPos.z)) {
        fu.shootCooldown = fu.isEliteBope ? 0.72 : fu.isRiotElite ? 0.95 : 1.35;
        if (vis?.muzzleFlash) {
          vis.muzzleFlash.visible = true;
          fu.muzzleTimer = 0.08;
        }
        const spread = fu.isEliteBope ? 1.05 : 1.45;
        const muzzle = new THREE.Vector3(pos.x, pos.y + (fu.isEliteBope ? 1.44 : 1.38), pos.z);
        const aim = new THREE.Vector3(
          playerPos.x + (Math.random() - 0.5) * spread,
          playerPos.y + 1.0,
          playerPos.z + (Math.random() - 0.5) * spread
        );
        this._spawnPursuitProjectile(muzzle, aim, 'bullet');
      }
    }
  },

  _spawnEagleHelicopter(playerPos) {
    return spawnPoliceHelicopter(this, playerPos);
  },
  _removeEagleHelicopter(targetHeli = null) {
    removeEagleHelicopter(this, targetHeli);
  },
  _clearAllPoliceHelicopters() {
    clearAllPoliceHelicopters(this);
  },
  _updateEagleHelicopter(dt, playerPos, controller) {
    updatePoliceHelicopters(this, dt, playerPos, controller);
  },
  _updatePoliceHelicopters(dt, playerPos, controller) {
    updatePoliceHelicopters(this, dt, playerPos, controller);
  },

  _spawnHunterDrone() {
    return null;
  },
  _clearAllHunterDrones() {
    if (!Array.isArray(this.hunterDrones)) return;
    for (const dr of this.hunterDrones) {
      if (dr?.obj) this.destructibles.unregisterDestructible(dr.obj);
    }
    this.hunterDrones.length = 0;
  },
  _updateHunterDrones() {
    if (Array.isArray(this.hunterDrones) && this.hunterDrones.length > 0) this._clearAllHunterDrones();
  },

  _spawnPursuitProjectile(origin, targetPos, kind = 'bullet') {
    if (this.enemyProjectiles.length >= 28) return;
    const G = getSharedPursuitGeos();
    const dir = targetPos.clone().sub(origin).normalize();
    let mesh = new THREE.Mesh(G.policeBulletGeo, this.mats.policeBullet);
    let speed = 62.0;
    let life = 1.6;
    let damage = this.stars >= 5 ? 13 : this.stars >= 4 ? 10 : 7;

    if (kind === 'missile') {
      mesh = new THREE.Mesh(G.missileGeo, this.mats.missileBody);
      speed = 38.0;
      life = 3.4;
      damage = 24;
      soundFX.playExplosion(0.32);
    } else if (kind === 'energy_net') {
      mesh = new THREE.Mesh(G.energyNetProjectileGeo, this.mats.energyNetWire);
      speed = 46.0;
      life = 2.4;
      damage = 10;
      soundFX.playLaserShot();
    }

    mesh.position.copy(origin);
    mesh.lookAt(targetPos);
    this.scene.add(mesh);
    this.enemyProjectiles.push({ mesh, kind, vel: dir.multiplyScalar(speed), speed, life, damage });
  },

  _clearAllEnemyProjectiles() {
    for (const p of this.enemyProjectiles) this.scene.remove(p.mesh);
    this.enemyProjectiles.length = 0;
  },

  _applyEnergyNetHit(playerPos, controller) {
    if (!controller) return;
    controller.energyNetSlowTimer = 1.85;
    if (controller.isFlying && controller.velocity) controller.velocity.y = Math.min(controller.velocity.y, -8.5);
    if (!this.energyCageMesh) {
      this.energyCageMesh = new THREE.Mesh(getSharedPursuitGeos().energyCageGeo, this.mats.energyNetWire);
      this.scene.add(this.energyCageMesh);
    }
    this.energyCageMesh.visible = true;
    this.energyCageMesh.position.set(playerPos.x, playerPos.y + 1.1, playerPos.z);
  },

  _updateEnemyProjectiles(dt, playerPos, controller) {
    const targetCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.05, playerPos.z);
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.life -= dt;

      if (p.kind === 'missile') {
        const desiredDir = targetCenter.clone().sub(p.mesh.position).normalize();
        const curDir = p.vel.clone().normalize().lerp(desiredDir, Math.min(1, dt * 3.2)).normalize();
        p.vel.copy(curDir.multiplyScalar(p.speed));
        p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
        if (Math.random() < 0.7) this.destructibles.spawnFlameTrailParticle(p.mesh.position, 0.65, 0xf97316);
      } else if (p.kind === 'energy_net') {
        p.mesh.rotation.x += dt * 8.0;
        p.mesh.rotation.y += dt * 8.0;
      }

      p.mesh.position.addScaledVector(p.vel, dt);
      const hitRadius = controller?.currentVehicle ? 2.45 : 1.15;
      let removeProj = p.life <= 0;

      if (p.mesh.position.distanceTo(targetCenter) <= hitRadius) {
        if (p.kind === 'energy_net') this._applyEnergyNetHit(playerPos, controller);
        else if (p.kind === 'missile') {
          this.destructibles._triggerExplosion(p.mesh.position.clone(), 5.2, 35, false, false, {
            fromPursuitPolice: true, isExplosion: true, sourceIsPlayer: false
          });
        }
        this.applyPursuitDamageToPlayer(p.damage, controller);
        removeProj = true;
      } else {
        const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(p.mesh.position.x, p.mesh.position.z) : 0;
        if (p.mesh.position.y <= floorY + 0.15) {
          if (p.kind === 'missile') {
            this.destructibles._triggerExplosion(p.mesh.position.clone(), 5.0, 30, false, false, {
              fromPursuitPolice: true, isExplosion: true, sourceIsPlayer: false
            });
          }
          removeProj = true;
        }
      }

      if (removeProj) {
        this.scene.remove(p.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }
};
