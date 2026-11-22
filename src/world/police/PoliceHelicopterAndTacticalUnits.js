import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { AIM_POSE, animateFactionSoldier, createFactionSoldierVisual } from '../../entities/FactionSoldierBuilder.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';
import { HumanoidHealthModel, HUMANOID_STATES } from '../npc-health/HumanoidHealthModel.js';
import { applyHumanoidHitPose, applyHumanoidKnockbackStep } from '../npc-health/HumanoidHitReactions.js';

// ============================================================================
// HELICÓPTERO ÁGUIA/BOPE (HOLOFOTE NOTURNO), TROPAS A PÉ, DRONES & COMBATE
// ============================================================================
export const policeHelicopterAndTacticalMethods = {
  _spawnFootTrooper(spawnPos, tierStars = this.stars) {
    if (this.footUnits.length >= (tierStars >= 5 ? 7 : tierStars >= 4 ? 6 : 4)) return null;
    const isExo = tierStars >= 5;
    const isRiotElite = tierStars === 4;
    const factionKey = isExo || isRiotElite ? 'bope' : 'pf';
    const roleKey = isExo ? 'special' : isRiotElite ? 'tank' : 'rifleman';
    const soldier = createFactionSoldierVisual(factionKey, roleKey);

    const root = soldier.root || new THREE.Group();
    root.rotation.order = 'YXZ';
    root.userData.skipStaticMerge = true;
    if (!soldier.root) {
      root.add(soldier.bodyRig);
      soldier.root = root;
    }
    const unitScale = isExo ? 1.08 : 1.0;
    if (isExo && soldier.bodyRig) soldier.bodyRig.scale.setScalar(unitScale);
    if (!soldier.torso) soldier.torso = soldier.bodyRig;
    if (!soldier.weapon) soldier.weapon = soldier.weaponMount;

    soldier.rightArm.rotation.x = AIM_POSE.rightArmX;
    soldier.leftArm.rotation.x = soldier.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX;
    soldier.leftArm.rotation.z = soldier.hasShield ? 0.08 : AIM_POSE.leftArmZ;
    soldier.root.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    this.scene.add(soldier.root);

    const maxHp = isExo ? 120 : isRiotElite ? 95 : 65;
    const humanoidHealth = new HumanoidHealthModel({ kind: 'police', maxHp });
    const obj = this.destructibles.registerDestructible({
      mesh: soldier.root,
      type: 'npc_fighter',
      hp: maxHp,
      radius: 0.95,
      height: 2.05,
      colliders: [],
      debrisColors: isExo || isRiotElite
        ? [0x15161a, 0x0b0c0f, 0xf59e0b, LEGO_COLORS.yellow]
        : [0x0f1d3a, 0x111827, 0xf59e0b, LEGO_COLORS.yellow],
      studDrops: isExo
        ? { silver: 2, gold: 8, blue: 6, purple: 1 }
        : isRiotElite
          ? { silver: 3, gold: 5, blue: 2, purple: 0 }
          : { silver: 4, gold: 4, blue: 1, purple: 0 },
      groundY: spawnPos.y,
      isPoliceUnit: true,
      isCombatNpc: true,
      isTankNpc: isRiotElite || isExo,
      noAutoRespawn: true
    });
    obj.maxHp = maxHp;
    obj.isCombatNpc = true;
    obj.isPoliceUnit = true;
    obj.isTankNpc = isRiotElite || isExo;
    obj.unitScale = unitScale;
    obj.visual = soldier;
    obj.humanoidHealth = humanoidHealth;

    const unit = {
      mesh: soldier.root, visual: soldier, obj, destructible: obj,
      humanoidHealth, unitScale,
      faction: factionKey, role: roleKey, className: soldier.className,
      isExo, isRiotElite,
      walkPhase: Math.random() * Math.PI * 2,
      phaseOffset: Math.random() * Math.PI * 2,
      muzzleTimer: 0,
      moveSpeed: isExo ? 16.5 : isRiotElite ? 9.5 : 8.5,
      shootCooldown: 0.7 + Math.random() * 0.7,
      specialCooldown: 2.2 + Math.random() * 1.5
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
        if (
          fu.humanoidHealth.state === HUMANOID_STATES.STAGGER ||
          fu.humanoidHealth.state === HUMANOID_STATES.DOWNED
        ) {
          if (vis?.muzzleFlash) vis.muzzleFlash.visible = false;
          applyHumanoidKnockbackStep(fu.mesh, fu.humanoidHealth, dt, (nx, nz, cx, cz) => {
            if (this._isSegmentBlockedByBuilding(cx, cz, nx, nz)) return { blocked: true };
            return { x: nx, z: nz, valid: true };
          });
          const gY = this.world?.getTerrainHeightAt
            ? this.world.getTerrainHeightAt(pos.x, pos.z)
            : 0;
          applyHumanoidHitPose(vis, fu.humanoidHealth, gY, dt, {
            unitScale: fu.unitScale || 1
          });
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
      if (fu.shootCooldown <= 0 && dist < 68.0) {
        fu.shootCooldown = fu.isExo ? 0.85 : fu.isRiotElite ? 0.95 : 1.35;
        if (vis?.muzzleFlash) {
          vis.muzzleFlash.visible = true;
          fu.muzzleTimer = 0.08;
        }
        const muzzle = new THREE.Vector3(pos.x, pos.y + (fu.isExo ? 1.48 : 1.38), pos.z);
        const aim = new THREE.Vector3(
          playerPos.x + (Math.random() - 0.5) * 1.4, playerPos.y + 1.0, playerPos.z + (Math.random() - 0.5) * 1.4
        );
        this._spawnPursuitProjectile(muzzle, aim, 'bullet');
      }

      if (fu.isExo) {
        fu.specialCooldown -= dt;
        if (fu.specialCooldown <= 0 && dist < 95.0) {
          fu.specialCooldown = 3.4;
          this._spawnPursuitProjectile(
            new THREE.Vector3(pos.x, pos.y + 1.65, pos.z),
            new THREE.Vector3(playerPos.x, playerPos.y + 1.1, playerPos.z),
            Math.random() < 0.5 ? 'energy_net' : 'missile'
          );
        }
      }
    }
  },

  _spawnEagleHelicopter(playerPos) {
    if (this.eagleHeli || this.eagleHeliRespawnCooldown > 0) return;
    const G = getSharedPursuitGeos();

    const heliGroup = new THREE.Group();
    heliGroup.userData.skipStaticMerge = true;
    heliGroup.position.set(playerPos.x - 65, Math.max(playerPos.y + 36, 40), playerPos.z - 65);

    const hull = new THREE.Mesh(G.heliHullGeo, this.mats.policeBlack);
    hull.castShadow = true;
    const canopy = new THREE.Mesh(G.heliCanopyGeo, this.mats.heliGlass);
    const rotor = new THREE.Mesh(G.heliRotorGeo, this.mats.gunSteel);
    rotor.position.set(0, 1.25, 0.35);

    const strobeRed = new THREE.Mesh(G.lightbarRedGeo, this.mats.strobeRedOn);
    strobeRed.position.set(-0.6, -1.05, 1.6);
    const strobeBlue = new THREE.Mesh(G.lightbarBlueGeo, this.mats.strobeBlueOn);
    strobeBlue.position.set(0.6, -1.05, 1.6);

    heliGroup.add(hull, canopy, rotor, strobeRed, strobeBlue);
    this.scene.add(heliGroup);

    const coneMesh = new THREE.Mesh(G.spotlightConeGeo, this.mats.spotlightCone);
    coneMesh.visible = false;
    const discMesh = new THREE.Mesh(G.spotlightDiscGeo, this.mats.spotlightDisc);
    discMesh.visible = false;
    this.scene.add(coneMesh, discMesh);

    const obj = this.destructibles.registerDestructible({
      mesh: heliGroup, type: 'police_helicopter', hp: 260, radius: 3.6, height: 3.2, colliders: [],
      debrisColors: [0x111827, LEGO_COLORS.white, 0x38bdf8, 0xf59e0b],
      studDrops: { silver: 0, gold: 12, blue: 8, purple: 2 },
      groundY: 0, isPoliceUnit: true, noAutoRespawn: true
    });

    obj.onShattered = () => {
      coneMesh.visible = false;
      discMesh.visible = false;
      this.scene.remove(coneMesh, discMesh);
      this.eagleHeli = null;
      this.eagleHeliRespawnCooldown = 22.0;
    };

    this.eagleHeli = {
      mesh: heliGroup, rotor, strobeRed, strobeBlue, coneMesh, discMesh, obj,
      orbitPhase: Math.random() * Math.PI * 2, shootTimer: 1.6
    };
  },

  _removeEagleHelicopter() {
    if (!this.eagleHeli) return;
    if (this.eagleHeli.coneMesh) this.scene.remove(this.eagleHeli.coneMesh);
    if (this.eagleHeli.discMesh) this.scene.remove(this.eagleHeli.discMesh);
    if (this.eagleHeli.obj) {
      this.eagleHeli.obj.onShattered = null;
      this.destructibles.unregisterDestructible(this.eagleHeli.obj);
    } else if (this.eagleHeli.mesh) {
      this.scene.remove(this.eagleHeli.mesh);
    }
    this.eagleHeli = null;
  },

  _updateEagleHelicopter(dt, playerPos, controller) {
    if (!this.eagleHeli) return;
    if (this.eagleHeli.obj?.destroyed) {
      this._removeEagleHelicopter();
      return;
    }

    const heli = this.eagleHeli;
    heli.rotor.rotation.y += dt * 26.0;
    heli.orbitPhase += dt * 0.55;

    const redPhase = Math.sin(this._strobeClock * 1.2) > 0;
    heli.strobeRed.material = redPhase ? this.mats.strobeRedOn : this.mats.strobeOff;
    heli.strobeBlue.material = !redPhase ? this.mats.strobeBlueOn : this.mats.strobeOff;

    const inTunnel = this._isPlayerInUndergroundTunnel(playerPos);
    const underViaduct = this._isPlayerUnderViaduct(playerPos);
    const heliBlind = inTunnel || underViaduct || (controller?.stealthTimer || 0) > 0;

    const targetX = heliBlind
      ? heli.mesh.position.x + Math.cos(heli.orbitPhase) * 18.0 * dt * 8
      : playerPos.x + Math.cos(heli.orbitPhase) * 16.0;
    const targetZ = heliBlind
      ? heli.mesh.position.z + Math.sin(heli.orbitPhase) * 18.0 * dt * 8
      : playerPos.z + Math.sin(heli.orbitPhase) * 16.0;
    const groundAtHeli = this.world?.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(heli.mesh.position.x, heli.mesh.position.z)
      : 0;
    const desiredY = Math.max(groundAtHeli + 36.0, (heliBlind ? 0 : playerPos.y) + 34.0);

    const chaseLerp = Math.min(1, dt * (heliBlind ? 0.6 : 2.3));
    heli.mesh.position.x = THREE.MathUtils.lerp(heli.mesh.position.x, targetX, chaseLerp);
    heli.mesh.position.z = THREE.MathUtils.lerp(heli.mesh.position.z, targetZ, chaseLerp);
    heli.mesh.position.y = THREE.MathUtils.lerp(heli.mesh.position.y, desiredY, Math.min(1, dt * 2.5));
    heli.mesh.lookAt(playerPos.x, heli.mesh.position.y - 4.0, playerPos.z);
    heli.obj.basePos.copy(heli.mesh.position);

    const nightFactor = this.world?.atmosphere?.nightFactor ?? 0;
    const showSpotlight = nightFactor > 0.16 && !inTunnel;
    heli.coneMesh.visible = showSpotlight;
    heli.discMesh.visible = showSpotlight && !underViaduct;

    if (showSpotlight) {
      const origin = new THREE.Vector3(heli.mesh.position.x, heli.mesh.position.y - 1.2, heli.mesh.position.z);
      const spotGroundY = this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(playerPos.x, playerPos.z, playerPos.y)
        : 0;
      const spotTarget = heliBlind
        ? new THREE.Vector3(
            heli.mesh.position.x + Math.sin(heli.orbitPhase * 2) * 12,
            groundAtHeli + 0.08,
            heli.mesh.position.z + Math.cos(heli.orbitPhase * 2) * 12
          )
        : new THREE.Vector3(playerPos.x, spotGroundY + 0.08, playerPos.z);

      const beamVec = spotTarget.clone().sub(origin);
      const beamLen = Math.max(6.0, beamVec.length());
      heli.coneMesh.position.copy(origin);
      heli.coneMesh.scale.set(5.4, beamLen, 5.4);
      heli.coneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamVec.clone().normalize());
      this.mats.spotlightCone.opacity = 0.14 + nightFactor * 0.16;

      heli.discMesh.position.copy(spotTarget);
      heli.discMesh.scale.setScalar(5.6);
      this.mats.spotlightDisc.opacity = 0.22 + nightFactor * 0.2;
    }

    if (this.stars >= 4 && !heliBlind && !this.isEscaping) {
      heli.shootTimer -= dt;
      if (heli.shootTimer <= 0) {
        heli.shootTimer = 1.65;
        this._spawnPursuitProjectile(
          heli.mesh.position.clone().add(new THREE.Vector3(0, -1.3, 0)),
          playerPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 1.0, (Math.random() - 0.5) * 2.2)),
          'bullet'
        );
      }
    }
  },

  _spawnHunterDrone(playerPos) {
    if (this.hunterDrones.length >= 3) return null;
    const G = getSharedPursuitGeos();
    const ang = Math.random() * Math.PI * 2;
    const group = new THREE.Group();
    group.userData.isOptimizedGroup = true;
    group.position.set(
      playerPos.x + Math.cos(ang) * 48,
      Math.max(playerPos.y + 8.5, 10.0),
      playerPos.z + Math.sin(ang) * 48
    );

    group.add(
      new THREE.Mesh(G.droneBodyGeo, this.mats.exoArmor),
      new THREE.Mesh(G.droneEyeGeo, this.mats.exoRed)
    );
    this.scene.add(group);

    const obj = this.destructibles.registerDestructible({
      mesh: group, type: 'hunter_drone', hp: 95, radius: 1.45, height: 1.2, colliders: [],
      debrisColors: [0x0f172a, 0x00f0ff, 0xef4444],
      studDrops: { silver: 0, gold: 6, blue: 4, purple: 1 },
      groundY: 0, isPoliceUnit: true, noAutoRespawn: true
    });

    const drone = {
      mesh: group, obj, orbitOffset: ang,
      fireCooldown: 1.4 + Math.random() * 1.4
    };
    this.hunterDrones.push(drone);
    return drone;
  },

  _clearAllHunterDrones() {
    for (const dr of this.hunterDrones) {
      this.destructibles.unregisterDestructible(dr.obj);
    }
    this.hunterDrones.length = 0;
  },

  _updateHunterDrones(dt, playerPos, controller) {
    for (let i = this.hunterDrones.length - 1; i >= 0; i--) {
      const dr = this.hunterDrones[i];
      if (!dr.obj || dr.obj.destroyed) {
        this.hunterDrones.splice(i, 1);
        continue;
      }

      dr.orbitOffset += dt * 1.85;
      const blind = this._isPlayerInUndergroundTunnel(playerPos) || (controller?.stealthTimer || 0) > 0;
      const desired = blind
        ? new THREE.Vector3(
            dr.mesh.position.x + Math.cos(dr.orbitOffset) * 10 * dt,
            Math.max(12, dr.mesh.position.y),
            dr.mesh.position.z + Math.sin(dr.orbitOffset) * 10 * dt
          )
        : new THREE.Vector3(
            playerPos.x + Math.cos(dr.orbitOffset + i * 2.1) * 14.0,
            Math.max(playerPos.y + 4.8, 5.5),
            playerPos.z + Math.sin(dr.orbitOffset + i * 2.1) * 14.0
          );

      const toTarget = desired.sub(dr.mesh.position);
      const dist = toTarget.length();
      const maxStep = 52.0 * dt;
      if (dist > 0.05) {
        dr.mesh.position.addScaledVector(toTarget.normalize(), Math.min(dist, maxStep));
      }
      dr.mesh.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);
      dr.obj.basePos.copy(dr.mesh.position);

      if (!blind && !this.isEscaping) {
        dr.fireCooldown -= dt;
        if (dr.fireCooldown <= 0 && dr.mesh.position.distanceTo(playerPos) < 88.0) {
          dr.fireCooldown = 2.6 + Math.random() * 1.2;
          const kind = i % 2 === 0 ? 'energy_net' : 'missile';
          this._spawnPursuitProjectile(
            dr.mesh.position.clone(),
            playerPos.clone().add(new THREE.Vector3(0, 1.1, 0)),
            kind
          );
        }
      }
    }
  },

  _spawnPursuitProjectile(origin, targetPos, kind = 'bullet') {
    if (this.enemyProjectiles.length >= 28) return;
    const G = getSharedPursuitGeos();
    const dir = targetPos.clone().sub(origin).normalize();

    let mesh;
    let speed = 56;
    let life = 1.9;
    let damage = 8;

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
    } else {
      mesh = new THREE.Mesh(G.policeBulletGeo, this.mats.policeBullet);
      speed = 62.0;
      life = 1.6;
      damage = this.stars >= 4 ? 11 : 7;
    }

    mesh.position.copy(origin);
    mesh.lookAt(targetPos);
    this.scene.add(mesh);

    this.enemyProjectiles.push({ mesh, kind, vel: dir.multiplyScalar(speed), speed, life, damage });
  },

  _clearAllEnemyProjectiles() {
    for (const p of this.enemyProjectiles) {
      this.scene.remove(p.mesh);
    }
    this.enemyProjectiles.length = 0;
  },

  _applyEnergyNetHit(playerPos, controller) {
    if (!controller) return;
    controller.energyNetSlowTimer = 1.85;
    if (controller.isFlying && controller.velocity) {
      controller.velocity.y = Math.min(controller.velocity.y, -8.5);
    }
    if (!this.energyCageMesh) {
      const G = getSharedPursuitGeos();
      this.energyCageMesh = new THREE.Mesh(G.energyCageGeo, this.mats.energyNetWire);
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
        const curDir = p.vel.clone().normalize();
        curDir.lerp(desiredDir, Math.min(1, dt * 3.2)).normalize();
        p.vel.copy(curDir.multiplyScalar(p.speed));
        p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
        if (Math.random() < 0.7) {
          this.destructibles.spawnFlameTrailParticle(p.mesh.position, 0.65, 0xf97316);
        }
      } else if (p.kind === 'energy_net') {
        p.mesh.rotation.x += dt * 8.0;
        p.mesh.rotation.y += dt * 8.0;
      }

      p.mesh.position.addScaledVector(p.vel, dt);

      const hitRadius = controller?.currentVehicle ? 2.45 : 1.15;
      const distToPlayer = p.mesh.position.distanceTo(targetCenter);

      let removeProj = p.life <= 0;
      if (distToPlayer <= hitRadius) {
        if (p.kind === 'energy_net') {
          this._applyEnergyNetHit(playerPos, controller);
        } else if (p.kind === 'missile') {
          this.destructibles._triggerExplosion(p.mesh.position.clone(), 5.2, 35, false, false, {
            fromPursuitPolice: true,
            isExplosion: true,
            sourceIsPlayer: false
          });
        }
        this.applyPursuitDamageToPlayer(p.damage, controller);
        removeProj = true;
      } else {
        const floorY = this.world?.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(p.mesh.position.x, p.mesh.position.z)
          : 0;
        if (p.mesh.position.y <= floorY + 0.15) {
          if (p.kind === 'missile') {
            this.destructibles._triggerExplosion(p.mesh.position.clone(), 5.0, 30, false, false, {
              fromPursuitPolice: true,
              isExplosion: true,
              sourceIsPlayer: false
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
