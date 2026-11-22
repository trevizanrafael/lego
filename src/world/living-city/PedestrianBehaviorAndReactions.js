import * as THREE from 'three';
import { HUMANOID_STATES } from '../npc-health/HumanoidHealthModel.js';
import {
  applyHumanoidHitPose,
  applyHumanoidKnockbackStep,
  resetHumanoidLimbPose
} from '../npc-health/HumanoidHitReactions.js';
import {
  ARCHETYPE_PRESETS,
  SHARED_CIV_PROP_GEOS,
  pickHumanSkinTone
} from './PedestrianSharedGeometriesAndArchetypes.js';

export const pedestrianBehaviorAndReactionsMethods = {
  _buildCivilianLegoMinifig(archetypeKey, variantIdx = 0) {
    const list = ARCHETYPE_PRESETS[archetypeKey] || ARCHETYPE_PRESETS.casual;
    const preset = list[variantIdx % list.length];
    const skinHex = pickHumanSkinTone(variantIdx);

    const root = new THREE.Group();
    root.userData.skipStaticMerge = true;

    // Mesmos pivôs exatos do Minifigure oficial (pé em y=0, hip em y=0.72, torso em y=1.24, ombros em y=1.52, cabeça em y=1.95)
    const hip = new THREE.Object3D();
    hip.position.set(0, 0.72, 0);

    const leftLeg = new THREE.Object3D();
    leftLeg.position.set(-0.21, 0.72, 0);
    const rightLeg = new THREE.Object3D();
    rightLeg.position.set(0.21, 0.72, 0);

    const torso = new THREE.Object3D();
    torso.position.set(0, 1.24, 0);
    const torsoDecal = new THREE.Object3D();
    torsoDecal.position.set(0, 1.24, 0);

    const head = new THREE.Object3D();
    head.position.set(0, 1.95, 0);
    const faceShell = new THREE.Object3D();
    faceShell.position.set(0, 1.95, 0);

    const leftArm = new THREE.Object3D();
    leftArm.position.set(-0.46, 1.52, 0);
    leftArm.rotation.set(0, 0, -0.06);
    const rightArm = new THREE.Object3D();
    rightArm.position.set(0.46, 1.52, 0);
    rightArm.rotation.set(0, 0, 0.06);

    const headPropMesh = new THREE.Object3D();
    headPropMesh.visible = Boolean(preset.headProp && SHARED_CIV_PROP_GEOS[preset.headProp]);
    headPropMesh.position.set(0, 1.95, 0);

    const backPropMesh = new THREE.Object3D();
    backPropMesh.visible = Boolean(preset.backProp && SHARED_CIV_PROP_GEOS[preset.backProp]);
    backPropMesh.position.set(0, 1.24, -0.29);

    const handPropMesh = new THREE.Object3D();
    handPropMesh.visible = Boolean(preset.handProp && SHARED_CIV_PROP_GEOS[preset.handProp]);
    handPropMesh.position.set(0, -0.64, 0.08);

    const cameraFlashMesh = new THREE.Object3D();
    cameraFlashMesh.visible = false;
    cameraFlashMesh.position.set(0, -0.6, 0.24);

    return {
      root,
      hip,
      torso,
      torsoDecal,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      head,
      faceShell,
      headPropMesh,
      backPropMesh,
      handPropMesh,
      cameraFlashMesh,
      skinHex,
      torsoHex: preset.torsoHex,
      armHex: preset.bareArms ? skinHex : (preset.armHex ?? preset.torsoHex),
      legHex: preset.legHex,
      torsoKey: preset.torsoKey,
      faceKey: preset.faceKey || 'civ_calm',
      headYaw: 0,
      headPropKey: preset.headProp || null,
      headColor: preset.headColor ?? 0x1e293b,
      backPropKey: preset.backProp || null,
      backPropColor: preset.backPropColor ?? 0x334155,
      handPropKey: preset.handProp || null,
      handPropColor: preset.handPropColor ?? 0x1e293b,
      preset
    };
  },

  /**
   * Atualiza instantaneamente o arquétipo visual de um civil reciclado para combinar 100% com o bairro atual do jogador!
   */
  _rethemePedestrianArchetype(ped, newArchetypeKey, seedIdx = 0) {
    if (ped.archetype === newArchetypeKey) return;
    const list = ARCHETYPE_PRESETS[newArchetypeKey] || ARCHETYPE_PRESETS.casual;
    const preset = list[seedIdx % list.length];
    const vis = ped.visual;
    const skinHex = pickHumanSkinTone(seedIdx);

    ped.archetype = newArchetypeKey;
    ped.walkSpeed = preset.speed;
    ped.normalFaceKey = preset.faceKey || 'civ_calm';
    ped.currentFaceKey = ped.normalFaceKey;

    vis.skinHex = skinHex;
    vis.torsoHex = preset.torsoHex;
    vis.armHex = preset.bareArms ? skinHex : (preset.armHex ?? preset.torsoHex);
    vis.legHex = preset.legHex;
    vis.torsoKey = preset.torsoKey;
    vis.faceKey = ped.normalFaceKey;
    vis.headPropKey = preset.headProp || null;
    vis.headColor = preset.headColor ?? 0x1e293b;
    vis.backPropKey = preset.backProp || null;
    vis.backPropColor = preset.backPropColor ?? 0x334155;
    vis.handPropKey = preset.handProp || null;
    vis.handPropColor = preset.handPropColor ?? 0x1e293b;

    vis.headPropMesh.visible = Boolean(preset.headProp && SHARED_CIV_PROP_GEOS[preset.headProp]);
    vis.headPropMesh.position.y = 1.95;
    vis.backPropMesh.visible = Boolean(preset.backProp && SHARED_CIV_PROP_GEOS[preset.backProp]);
    vis.handPropMesh.visible = Boolean(preset.handProp && SHARED_CIV_PROP_GEOS[preset.handProp]);
    vis.cameraFlashMesh.visible = false;
  },

  _setPedestrianFace(ped, faceKey) {
    if (ped.currentFaceKey === faceKey) return;
    ped.currentFaceKey = faceKey;
    if (ped.visual) {
      ped.visual.faceKey = faceKey;
    }
  },

  _onCivilianDamaged(ped, hitOrigin, healthRes = null) {
    const root = ped.visual.root;
    const ox = hitOrigin?.x ?? root.position.x + 1;
    const oz = hitOrigin?.z ?? root.position.z + 1;
    let dx = root.position.x - ox;
    let dz = root.position.z - oz;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) {
      dx = 1;
      dz = 0;
    } else {
      dx /= len;
      dz /= len;
    }

    ped.isChatGroup = false;
    ped.diveTimer = 0;
    ped.crouchPanicTimer = 0;
    ped.panicDirX = dx;
    ped.panicDirZ = dz;
    this._setPedestrianFace(ped, 'civ_panic');

    if (healthRes?.killed) {
      ped.isDeadCorpse = true;
      ped.panicTimer = 0;
      ped.state = 'DEAD';
      return;
    }

    ped.panicTimer = Math.max(ped.panicTimer || 0, 6.5);
    ped.state = 'PANIC';
  },

  /**
   * Pânico urbano realista quando há tiros, explosões ou mortes perto dos civis.
   * Quando `isLethalWitness === true`, parte das testemunhas agacha em choque com as mãos na cabeça
   * por 1.4s antes de sair correndo em pânico, enquanto outras disparam na hora.
   */
  triggerPedestrianPanicNear(origin, radius = 28.0, isLethalWitness = false) {
    const clampR = Math.min(36.0, Math.max(18.0, radius));
    this.triggerTrafficPanicNear(origin, 26.0);
    for (const ped of this.pedestrians) {
      if (ped.isDeadCorpse || ped.humanoidHealth?.isDead()) continue;
      const pos = ped.visual.root.position;
      const dx = pos.x - origin.x;
      const dz = pos.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= clampR) {
        ped.isChatGroup = false;
        ped.panicTimer = Math.max(ped.panicTimer || 0, isLethalWitness ? 6.8 : 5.2);
        ped.state = 'PANIC';
        if (dist > 0.15) {
          ped.panicDirX = dx / dist;
          ped.panicDirZ = dz / dist;
        } else if (Math.hypot(ped.panicDirX || 0, ped.panicDirZ || 0) < 0.2) {
          const fallbackAng = (ped.id || 1) * 1.73;
          ped.panicDirX = Math.sin(fallbackAng);
          ped.panicDirZ = Math.cos(fallbackAng);
        }
        this._setPedestrianFace(ped, 'civ_panic');

        if (
          isLethalWitness &&
          dist > 1.8 &&
          (!ped.humanoidHealth || ped.humanoidHealth.state === HUMANOID_STATES.ALIVE) &&
          (ped.crouchPanicTimer || 0) <= 0 &&
          ped.id % 3 === 0
        ) {
          ped.crouchPanicTimer = 1.4;
          ped.visual.root.rotation.y = Math.atan2(-dx, -dz);
        }
      }
    }
  },

  _updatePedestrians(dt, playerPos, controller) {
    const heroKey = controller?.minifigure?.currentHeroKey || 'caveira';
    const isVortexSymbiote = heroKey === 'vortex';
    const playerSpeed = controller?.getHorizontalSpeed ? controller.getHorizontalSpeed() : 0;
    const isDrivingCar = Boolean(controller?.currentVehicle);
    const isAirborneNow = Boolean(controller && (controller.isFlying || !controller.isGrounded));

    if (this._wasPlayerAirborne && !isAirborneNow && playerPos && !isVortexSymbiote) {
      this._heroLandingCheerTimer = 4.2;
      this._heroLandingPos.copy(playerPos);
    }
    this._wasPlayerAirborne = isAirborneNow;
    if (this._heroLandingCheerTimer > 0) {
      this._heroLandingCheerTimer = Math.max(0, this._heroLandingCheerTimer - dt);
    }

    const carSpeedingNearSidewalk = isDrivingCar && playerSpeed > 12.5;
    const carFwdX = isDrivingCar ? Math.sin(controller.facingAngle || 0) : 0;
    const carFwdZ = isDrivingCar ? Math.cos(controller.facingAngle || 0) : 0;

    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];
      const vis = ped.visual;
      const root = vis.root;
      const health = ped.humanoidHealth;

      if (ped.vehicleHitCooldown > 0) {
        ped.vehicleHitCooldown = Math.max(0, ped.vehicleHitCooldown - dt);
      }
      if (ped.photoFlashTimer > 0) {
        ped.photoFlashTimer -= dt;
        if (ped.photoFlashTimer <= 0 && vis.cameraFlashMesh) {
          vis.cameraFlashMesh.visible = false;
        }
      }

      let distToPlayer = 9999;
      let dxFromPlayer = 0;
      let dzFromPlayer = 0;
      if (playerPos) {
        dxFromPlayer = root.position.x - playerPos.x;
        dzFromPlayer = root.position.z - playerPos.z;
        const dSq = dxFromPlayer * dxFromPlayer + dzFromPlayer * dzFromPlayer;
        const isCloseVisible = dSq <= 125 * 125;
        if (root.visible !== isCloseVisible) {
          root.visible = isCloseVisible;
          root.matrixWorldAutoUpdate = isCloseVisible;
        }
        if (!isCloseVisible && !ped.isDeadCorpse && !health?.isDead()) continue;
        distToPlayer = Math.sqrt(dSq);
      }

      const terrainYNow = this.world.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(root.position.x, root.position.z)
        : 0;
      const baseYNow = this._getPedestrianGroundY(root.position.x, root.position.z, terrainYNow);

      // Corpo morto permanece deitado sob controle do HumanoidCorpseManager até expirar/reciclar
      if (ped.isDeadCorpse || health?.state === HUMANOID_STATES.DEAD) {
        ped.state = 'DEAD';
        if (vis.cameraFlashMesh) vis.cameraFlashMesh.visible = false;
        if (health) {
          applyHumanoidHitPose(vis, health, baseYNow, dt, {
            sinkOffset: ped._corpseSinkOffset || 0
          });
        }
        continue;
      }

      // Atropelamento proporcional à velocidade (playerSpeed > 6 fere; > 16 derruba ou mata!)
      if (
        isDrivingCar &&
        playerSpeed > 6.0 &&
        distToPlayer < 2.85 &&
        (ped.vehicleHitCooldown || 0) <= 0
      ) {
        ped.vehicleHitCooldown = 0.65;
        const runOverDmg =
          playerSpeed > 21.0
            ? 115
            : playerSpeed > 16.0
              ? 68 + (playerSpeed - 16.0) * 9.5
              : 24 + (playerSpeed - 6.0) * 4.2;
        if (this.destructibles && ped.destructible) {
          this.destructibles.damageObject(ped.destructible, runOverDmg, playerPos, false, {
            sourceIsPlayer: true,
            unscaledDamage: true,
            isExplosion: playerSpeed > 14.0
          });
          if (ped.isDeadCorpse || health?.isDead()) {
            continue;
          }
        }
      } else if (
        carSpeedingNearSidewalk &&
        distToPlayer < 12.5 &&
        (!health || health.state === HUMANOID_STATES.ALIVE)
      ) {
        const relX = root.position.x - playerPos.x;
        const relZ = root.position.z - playerPos.z;
        const ahead = relX * carFwdX + relZ * carFwdZ;
        const lat = relX * carFwdZ - relZ * carFwdX;
        if (ahead > -1.0 && ahead < 11.5 && Math.abs(lat) < 4.5 && ped.diveTimer <= 0) {
          const sideSign = lat >= 0 ? 1 : -1;
          ped.diveTimer = 0.42;
          ped.diveVelX = carFwdZ * sideSign * 11.5;
          ped.diveVelZ = -carFwdX * sideSign * 11.5;
        }
        ped.isChatGroup = false;
        ped.crouchPanicTimer = 0;
        ped.panicTimer = Math.max(ped.panicTimer || 0, 5.0);
        ped.panicDirX = dxFromPlayer / Math.max(0.1, distToPlayer);
        ped.panicDirZ = dzFromPlayer / Math.max(0.1, distToPlayer);
        this._setPedestrianFace(ped, 'civ_panic');
      }

      // Reações físicas de STAGGER e DOWNED (1.2s caído + 0.35s levantando -> corre normal em pânico!)
      if (health) {
        const wasReacting =
          health.state === HUMANOID_STATES.STAGGER || health.state === HUMANOID_STATES.DOWNED;
        health.update(dt);

        if (health.state === HUMANOID_STATES.STAGGER || health.state === HUMANOID_STATES.DOWNED) {
          applyHumanoidKnockbackStep(root, health, dt, (nx, nz) => {
            if (!this._isValidDryLandForPedestrian(nx, nz)) return { blocked: true };
            const col = this._resolveBuildingCollision(nx, nz, 1.05);
            return { x: col.x, z: col.z, valid: true };
          });
          const tY = this.world.getTerrainHeightAt
            ? this.world.getTerrainHeightAt(root.position.x, root.position.z)
            : 0;
          const bY = this._getPedestrianGroundY(root.position.x, root.position.z, tY);
          applyHumanoidHitPose(vis, health, bY, dt);
          if (ped.destructible) {
            ped.destructible.basePos.set(root.position.x, bY, root.position.z);
            ped.destructible.groundY = tY;
          }
          continue;
        }

        if (wasReacting && health.state === HUMANOID_STATES.ALIVE) {
          resetHumanoidLimbPose(vis);
          ped.crouchPanicTimer = 0;
          ped.panicTimer = Math.max(ped.panicTimer || 0, 6.0);
          ped.state = 'PANIC';
          this._setPedestrianFace(ped, 'civ_panic');
        }
      }

      ped.animTime += dt;
      let hopHeight = 0;
      let moveX = 0;
      let moveZ = 0;
      let speed = 0;
      root.rotation.x = 0;
      root.rotation.z = 0;
      vis.leftLeg.rotation.z = 0;
      vis.rightLeg.rotation.z = 0;
      vis.leftArm.rotation.z = -0.06;
      vis.rightArm.rotation.z = 0.06;
      vis.headYaw = 0;

      if (ped.crouchPanicTimer > 0) {
        ped.crouchPanicTimer = Math.max(0, ped.crouchPanicTimer - dt);
        ped.state = 'PANIC';
        this._setPedestrianFace(ped, 'civ_panic');
        hopHeight = -0.24;
        root.rotation.x = 0.24;
        const tremble = Math.sin(ped.animTime * 28.0) * 0.08;
        vis.leftArm.rotation.x = -2.85 + tremble;
        vis.leftArm.rotation.z = 0.42;
        vis.rightArm.rotation.x = -2.85 - tremble;
        vis.rightArm.rotation.z = -0.42;
        vis.leftLeg.rotation.x = -0.52;
        vis.rightLeg.rotation.x = 0.52;
        if (ped.crouchPanicTimer <= 0) {
          root.rotation.x = 0;
        }
      } else if (ped.diveTimer > 0) {
        ped.diveTimer = Math.max(0, ped.diveTimer - dt);
        const u = 1.0 - ped.diveTimer / 0.42;
        hopHeight = Math.sin(u * Math.PI) * 1.15;
        root.position.x += ped.diveVelX * dt;
        root.position.z += ped.diveVelZ * dt;
        root.rotation.z = Math.sin(u * Math.PI) * 0.48;
        vis.leftArm.rotation.x = -2.6;
        vis.rightArm.rotation.x = -2.6;
        if (ped.diveTimer <= 0) {
          root.rotation.z = 0;
        }
      } else if (ped.panicTimer > 0) {
        ped.state = 'PANIC';
        ped.panicTimer -= dt;
        speed = 8.2;
        moveX = ped.panicDirX;
        moveZ = ped.panicDirZ;
        if (ped.panicTimer <= 0) {
          ped.state = 'NORMAL';
          this._setPedestrianFace(ped, ped.normalFaceKey);
        }
      } else if (controller?.minifigure?.activeEmote && distToPlayer <= 12.0 && !isDrivingCar) {
        ped.state = 'DANCE_ALONG';
        this._setPedestrianFace(ped, 'civ_smile');
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        const dancePhase = ped.animTime * 11.5 + (ped.id % 4) * 0.5;
        hopHeight = Math.abs(Math.sin(dancePhase)) * 0.24;
        vis.leftLeg.rotation.x = Math.sin(dancePhase) * 0.5;
        vis.rightLeg.rotation.x = -Math.sin(dancePhase) * 0.5;
        if (ped.id % 2 === 0) {
          const clap = Math.sin(dancePhase * 1.4) * 0.22;
          vis.leftArm.rotation.x = -1.35 + clap;
          vis.rightArm.rotation.x = -1.35 - clap;
        } else {
          vis.leftArm.rotation.x = -2.2 + Math.sin(dancePhase) * 0.5;
          vis.rightArm.rotation.x = -2.2 - Math.sin(dancePhase) * 0.5;
        }
      } else if (isVortexSymbiote && distToPlayer < 7.0 && !isDrivingCar) {
        ped.state = 'VILLAIN_SPOOK';
        this._setPedestrianFace(ped, 'civ_panic');
        const inv = 1.0 / Math.max(0.1, distToPlayer);
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        root.position.x += dxFromPlayer * inv * 2.35 * dt;
        root.position.z += dzFromPlayer * inv * 2.35 * dt;
        const tremble = Math.sin(ped.animTime * 22.0) * 0.08;
        vis.leftArm.rotation.x = -1.65 + tremble;
        vis.rightArm.rotation.x = -1.65 - tremble;
        vis.leftLeg.rotation.x = Math.sin(ped.animTime * 9.0) * 0.32;
        vis.rightLeg.rotation.x = -Math.sin(ped.animTime * 9.0) * 0.32;
      } else if (
        !isVortexSymbiote &&
        !isDrivingCar &&
        ((this._heroLandingCheerTimer > 0 && distToPlayer < 15.0) ||
          (ped.canCheerHero && distToPlayer < 10.0 && playerSpeed < 7.5))
      ) {
        ped.state = 'CHEER';
        this._setPedestrianFace(ped, ped.normalFaceKey);
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        hopHeight = Math.max(0, Math.sin(ped.animTime * 8.5)) * 0.18;
        vis.leftLeg.rotation.x = 0;
        vis.rightLeg.rotation.x = 0;

        if (ped.archetype === 'tourist') {
          vis.rightArm.rotation.x = -1.42;
          vis.leftArm.rotation.x = -1.2;
          ped.photoCooldown -= dt;
          if (ped.photoCooldown <= 0) {
            ped.photoCooldown = 1.85 + (ped.id % 4) * 0.45;
            ped.photoFlashTimer = 0.12;
            if (vis.cameraFlashMesh) {
              vis.cameraFlashMesh.visible = true;
              vis.cameraFlashMesh.rotation.y = ped.animTime * 3.0;
            }
          }
        } else if (ped.cheerStyle === 'clap') {
          const clap = Math.sin(ped.animTime * 14.0) * 0.2;
          vis.leftArm.rotation.x = -1.3 + clap;
          vis.rightArm.rotation.x = -1.3 - clap;
        } else {
          vis.rightArm.rotation.x = -2.55 + Math.sin(ped.animTime * 12.0) * 0.28;
          vis.leftArm.rotation.x = -0.08;
        }
      } else {
        ped.state = 'NORMAL';
        this._setPedestrianFace(ped, ped.normalFaceKey);

        if (ped.isChatGroup) {
          root.rotation.y = ped.chatPartnerAngle + Math.sin(ped.animTime * 0.9) * 0.05;
          vis.headYaw = Math.sin(ped.animTime * 1.4 + ped.id) * 0.14;
          vis.leftLeg.rotation.x = 0;
          vis.rightLeg.rotation.x = 0;
          vis.leftArm.rotation.x = -0.06 + Math.sin(ped.animTime * 2.1 + ped.id) * 0.06;
          vis.rightArm.rotation.x = -0.3 + Math.cos(ped.animTime * 2.6 + ped.id) * 0.16;
        } else {
          speed = ped.walkSpeed;
          const targetX = ped.dir > 0 ? ped.x2 : ped.x1;
          const targetZ = ped.dir > 0 ? ped.z2 : ped.z1;
          const dx = targetX - root.position.x;
          const dz = targetZ - root.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.25) {
            ped.dir *= -1;
          } else {
            moveX = dx / dist;
            moveZ = dz / dist;
          }
        }
      }

      if (speed > 0 && (moveX !== 0 || moveZ !== 0)) {
        const nextX = root.position.x + moveX * speed * dt;
        const nextZ = root.position.z + moveZ * speed * dt;
        if (this._isValidDryLandForPedestrian(nextX, nextZ)) {
          root.position.x = nextX;
          root.position.z = nextZ;
        } else {
          ped.dir *= -1;
          ped.panicDirX *= -1;
          ped.panicDirZ *= -1;
        }

        root.rotation.y = Math.atan2(moveX, moveZ);

        const isJogging = ped.state === 'NORMAL' && ped.archetype === 'jogger';
        const freq = ped.state === 'PANIC' ? 14.5 : isJogging ? 10.2 : 6.8;
        const walkPhase = ped.animTime * freq;
        const legAmp = ped.state === 'PANIC' ? 0.78 : isJogging ? 0.62 : 0.45;
        const legSwing = Math.sin(walkPhase) * legAmp;
        const armSwing = Math.sin(walkPhase) * 0.42;

        vis.leftLeg.rotation.x = legSwing;
        vis.rightLeg.rotation.x = -legSwing;

        if (ped.state === 'PANIC') {
          vis.leftArm.rotation.x = -2.62 + armSwing * 0.45;
          vis.rightArm.rotation.x = -2.62 - armSwing * 0.45;
        } else if (isJogging) {
          vis.leftArm.rotation.x = -0.92 - armSwing * 1.15;
          vis.rightArm.rotation.x = -0.92 + armSwing * 1.15;
        } else {
          vis.leftArm.rotation.x = -armSwing;
          const hpKey = vis.handPropMesh?.visible ? vis.handPropKey : null;
          if (hpKey === 'smartphone' || hpKey === 'coffee_cup') {
            vis.rightArm.rotation.x = -0.46 + armSwing * 0.16;
          } else if (hpKey === 'camera') {
            vis.rightArm.rotation.x = -0.34 + armSwing * 0.18;
          } else if (hpKey) {
            vis.rightArm.rotation.x = -0.08 + armSwing * 0.25;
          } else {
            vis.rightArm.rotation.x = armSwing;
          }
        }
      }

      const pedCol = this._resolveBuildingCollision(root.position.x, root.position.z, 1.05);
      if (pedCol.collided) {
        root.position.x = pedCol.x;
        root.position.z = pedCol.z;
        if (ped.state === 'NORMAL' && !ped.isChatGroup) {
          ped.dir *= -1;
        }
      }

      const terrainY = this.world.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(root.position.x, root.position.z)
        : 0;
      const baseY = this._getPedestrianGroundY(root.position.x, root.position.z, terrainY);
      root.position.y = baseY + hopHeight;

      if (ped.destructible) {
        ped.destructible.basePos.set(root.position.x, baseY, root.position.z);
        ped.destructible.groundY = terrainY;
      }
    }
    this._syncPedestrianInstances();
  }
};
