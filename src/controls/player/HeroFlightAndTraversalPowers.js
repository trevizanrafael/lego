import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { raycast3D as fallbackRaycast3D } from '../../world/collision/CollisionQueries.js';
import { UP, lerpAngle } from './CameraOrbitAndRig.js';

const _heroFlyFrom = { x: 0, y: 0, z: 0 };
const _heroFlyTo = { x: 0, y: 0, z: 0 };
const _heroFlyMid = { x: 0, y: 0, z: 0 };
const _heroFlySlideTo = { x: 0, y: 0, z: 0 };
const _heroFlySweep = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
const _heroFlySlideSweep = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
const _grappleRayStart = { x: 0, y: 0, z: 0 };
const _grappleRayEnd = { x: 0, y: 0, z: 0 };
const _grappleRayOut = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
const _grappleIgnoreCols = [];

export const heroFlightAndTraversalMethods = {
  _initGrappleCableMesh() {
    if (!this.world?.scene) return;

    const cableGroup = new THREE.Group();
    const coreGeo = new THREE.CylinderGeometry(0.036, 0.036, 1, 8);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(Math.PI / 2);
    this.grappleCableCoreMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
    const coreMesh = new THREE.Mesh(coreGeo, this.grappleCableCoreMat);

    const shadowGeo = new THREE.CylinderGeometry(0.072, 0.072, 1, 8);
    shadowGeo.translate(0, 0.5, 0);
    shadowGeo.rotateX(Math.PI / 2);
    this.grappleCableShadowMat = new THREE.MeshBasicMaterial({
      color: 0x090a0d,
      transparent: true,
      opacity: 0.78
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, this.grappleCableShadowMat);
    cableGroup.add(shadowMesh, coreMesh);

    this.grappleCableMesh = cableGroup;
    this.grappleCableMesh.visible = false;
    this.world.scene.add(this.grappleCableMesh);

    const anchorRoot = new THREE.Group();
    const kunaiGroup = new THREE.Group();
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
    const coreBladeMat = new THREE.MeshBasicMaterial({ color: 0xfecaca });
    const hiltMat = new THREE.MeshBasicMaterial({ color: 0x090a0d });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    const kunaiBlade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.62, 4), bladeMat);
    kunaiBlade.rotation.x = Math.PI / 2;
    kunaiBlade.position.set(0, 0, 0.18);

    const kunaiCore = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 4), coreBladeMat);
    kunaiCore.rotation.x = Math.PI / 2;
    kunaiCore.position.set(0, 0, 0.2);

    const kunaiHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), hiltMat);
    kunaiHilt.rotation.x = Math.PI / 2;
    kunaiHilt.position.set(0, 0, -0.2);

    const kunaiRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.024, 8, 16), goldMat);
    kunaiRing.position.set(0, 0, -0.38);
    kunaiGroup.add(kunaiBlade, kunaiCore, kunaiHilt, kunaiRing);
    this.grappleKunaiGroup = kunaiGroup;

    const symbioteMawGroup = new THREE.Group();
    const purpleMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const deepPurpleMat = new THREE.MeshBasicMaterial({ color: 0x7e22ce });
    const fangMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    const mawCone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 6), deepPurpleMat);
    mawCone.rotation.x = Math.PI / 2;
    mawCone.position.set(0, 0, 0.18);
    const mawCore = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), purpleMat);
    mawCore.position.set(0, 0, -0.1);
    symbioteMawGroup.add(mawCone, mawCore);

    for (let f = 0; f < 4; f++) {
      const ang = (f / 4) * Math.PI * 2;
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 4), fangMat);
      fang.position.set(Math.cos(ang) * 0.22, Math.sin(ang) * 0.22, 0.34);
      fang.rotation.x = Math.PI / 2 - 0.25;
      symbioteMawGroup.add(fang);
    }
    symbioteMawGroup.visible = false;
    this.grappleSymbioteMawGroup = symbioteMawGroup;

    anchorRoot.add(kunaiGroup, symbioteMawGroup);
    this.grappleAnchorMesh = anchorRoot;
    this.grappleAnchorMesh.visible = false;
    this.world.scene.add(this.grappleAnchorMesh);
  },

  _activateSolarisFlight() {
    this.isFlying = true;
    this.isGrounded = false;
    this.position.y += 0.9;
    this.velocity.y = 14.0;
    soundFX.playTacticalRoll();
  },

  _releaseTitaSuperJumpCharge() {
    if (!this.titaJumpCharging) return;
    const heldTime = this.titaJumpChargeTime;
    this.titaJumpCharging = false;
    this.titaJumpChargeTime = 0;
    if (this.minifigure) this.minifigure.titaJumpChargeRatio = 0;
    this.destructibles?.updateSupernovaChargeVisual?.(false, this.position);
    if (!this.isGrounded) return;

    if (heldTime < 0.16) {
      this.velocity.y = 14.5;
      this.titaSuperJumpActive = false;
      this.isGrounded = false;
      return;
    }

    const chargeRatio = THREE.MathUtils.clamp(heldTime / this.titaJumpMaxChargeTime, 0, 1);
    this.velocity.y = THREE.MathUtils.lerp(18.0, 54.0, chargeRatio);
    const boostSpeed = 18.0 * chargeRatio;
    this.velocity.x += Math.sin(this.facingAngle) * boostSpeed;
    this.velocity.z += Math.cos(this.facingAngle) * boostSpeed;
    this.titaSuperJumpActive = true;
    this.isGrounded = false;
    this.cameraShakeTimer = 0.22 + chargeRatio * 0.25;
    soundFX.playExplosion(0.9 + chargeRatio * 0.6);
  },

  _raycastWorldColliders3D(origin, dir, minDist, maxDist) {
    if (!this.world) return null;
    const castFn = this.world.raycast3D
      ? (a, b, opts) => this.world.raycast3D(a, b, opts)
      : (a, b, opts) => fallbackRaycast3D(this.world, a, b, opts);

    _grappleIgnoreCols.length = 0;
    _grappleRayStart.x = origin.x + dir.x * minDist;
    _grappleRayStart.y = origin.y + dir.y * minDist;
    _grappleRayStart.z = origin.z + dir.z * minDist;
    _grappleRayEnd.x = origin.x + dir.x * maxDist;
    _grappleRayEnd.y = origin.y + dir.y * maxDist;
    _grappleRayEnd.z = origin.z + dir.z * maxDist;

    for (let pass = 0; pass < 3; pass++) {
      const hit = castFn(_grappleRayStart, _grappleRayEnd, {
        ignoreColliders: _grappleIgnoreCols.length > 0 ? _grappleIgnoreCols : undefined,
        out: _grappleRayOut
      });
      if (!hit?.hit) return null;
      if (hit.t === 0 && hit.collider) {
        const c = hit.collider;
        const nearHit = castFn(origin, _grappleRayStart, { filter: (col) => col === c });
        if (nearHit?.hit && nearHit.distance < minDist - 1e-4) {
          _grappleIgnoreCols.push(c);
          continue;
        }
      }
      return {
        distance: minDist + hit.distance,
        point: new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z),
        collider: hit.collider
      };
    }
    return null;
  },

  _triggerSombraGrapple() {
    if (this.grappleState) {
      this._stopGrapple(true);
      return;
    }

    const aimDir = this._alignCharacterToCrosshair();
    const rayOrigin = this.camera.position.clone();
    const maxGrappleDist = 115.0;
    let bestT = maxGrappleDist;
    let bestAnchor = null;

    const rayHit = this._raycastWorldColliders3D(rayOrigin, aimDir, 4.0, maxGrappleDist);
    if (rayHit) {
      bestT = rayHit.distance;
      bestAnchor = rayHit.point;
    }

    if (aimDir.y < -0.02) {
      for (let d = 4.0; d <= bestT; d += 2.0) {
        const px = rayOrigin.x + aimDir.x * d;
        const py = rayOrigin.y + aimDir.y * d;
        const pz = rayOrigin.z + aimDir.z * d;
        const terrainY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(px, pz) : 0;
        if (py <= terrainY + 0.25) {
          bestT = d;
          bestAnchor = new THREE.Vector3(px, terrainY + 0.35, pz);
          break;
        }
      }
    }

    if (!bestAnchor) {
      const reach = 64.0;
      const fx = this.position.x + aimDir.x * reach;
      const fz = this.position.z + aimDir.z * reach;
      const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fx, fz) : 0;
      const fy = Math.max(floorY + 0.4, this.position.y + 1.4 + aimDir.y * reach);
      bestAnchor = new THREE.Vector3(fx, fy, fz);
    }

    const isDiveGrapple = !this.isGrounded && aimDir.y < -0.12 && bestAnchor.y < this.position.y - 1.2;
    this.grappleState = {
      anchor: bestAnchor,
      timer: isDiveGrapple ? 0.65 : 0.42,
      pullSpeed: isDiveGrapple ? 78.0 : 68.0,
      isDiveGrapple
    };
    this.isGrounded = false;
    if (!isDiveGrapple && this.position.y <= bestAnchor.y) {
      this.velocity.y = Math.max(this.velocity.y, 9.5);
    }
    this.minifigure.isGrappling = true;
    soundFX.playTacticalRoll();
    soundFX.playLaserShot();
  },

  _stopGrapple(transferMomentum = false) {
    const prevGrapple = this.grappleState;
    this.grappleState = null;
    if (this.minifigure) this.minifigure.isGrappling = false;
    if (this.grappleCableMesh) this.grappleCableMesh.visible = false;
    if (this.grappleAnchorMesh) this.grappleAnchorMesh.visible = false;

    if (transferMomentum && prevGrapple && !prevGrapple.isDiveGrapple) {
      this.blastVelocity.set(this.velocity.x * 0.92, 0, this.velocity.z * 0.92);
      const horizMag = Math.hypot(this.blastVelocity.x, this.blastVelocity.z);
      if (horizMag > 66.0) this.blastVelocity.multiplyScalar(66.0 / horizMag);
      this.blastJumpTimer = 0.85;
      this.velocity.y = Math.max(this.velocity.y + 8.5, 16.0);
    }
  },

  _triggerSombraSmokeBomb() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 0.95;

    const camForward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, UP).normalize();
    const rollInput = new THREE.Vector3();
    if (this.keys.forward) rollInput.add(camForward);
    if (this.keys.backward) rollInput.sub(camForward);
    if (this.keys.right) rollInput.add(camRight);
    if (this.keys.left) rollInput.sub(camRight);
    if (rollInput.lengthSq() < 0.001) {
      this._alignCharacterToCrosshair();
      rollInput.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
    }

    this._triggerTacticalRoll(rollInput);
    this.stealthTimer = 7.0;
    this.minifigure.setStealthVisual(true);
    this.destructibles?.spawnSmokeBombCloud(this.position);
    this.hud?.setCharacterPortrait(
      'sombra',
      'SOMBRA ESCARLATE [FURTIVO]',
      'PASSO FANTASMA INVISÍVEL ATIVO (IGNORA LASERS DO BANCO!)'
    );
  },

  _summonAndMountTurboGhostBike() {
    if (!this.destructibles) return;
    if (this.currentVehicle) {
      this.exitVehicle();
      return;
    }
    this._alignCharacterToCrosshair();
    const bikeObj = this.destructibles.summonTurboEnergyBike(this.position, this.facingAngle);
    if (bikeObj) {
      this.enterVehicle(bikeObj);
      this.vehicleSpeed = 0;
      this.turboOverdriveActive = false;
      this.isTurboActive = false;
      this.keys.turbo = false;
      this._lastLightWallPos = this.position.clone();
      this.hud?.setCharacterPortrait(
        'turbo',
        'TURBO FANTASMA [MOTO FANTASMA]',
        'MOTO FANTASMA • [W] ACELERAR • [S / ESPAÇO] FREIO FORTE • SEGURE [Q] TURBO 740 KM/H'
      );
    }
  },

  _triggerTurboOverdrive(active = true) {
    this.turboOverdriveActive = Boolean(active);
    this.turboOverdriveTimer = this.turboOverdriveActive ? 999999 : 0;
    this._lastLightWallPos = this.position.clone();

    if (this.turboOverdriveActive) {
      if (!this.currentVehicle) {
        this._alignCharacterToCrosshair();
        this.currentSpeed = 54.0;
        this.velocity.x = Math.sin(this.facingAngle) * 54.0;
        this.velocity.z = Math.cos(this.facingAngle) * 54.0;
      } else {
        this.isTurboActive = true;
      }
      soundFX.playHeroSwap();
      soundFX.playExplosion(0.45);
      this.hud?.setCharacterPortrait(
        'turbo',
        'TURBO FANTASMA [TURBO OVERDRIVE]',
        'TURBO OVERDRIVE ATIVO [SEGURANDO Q] • MURALHA DE LUZ CIANO ATIVA!'
      );
    } else if (this.hud && this.minifigure.currentHeroKey === 'turbo') {
      this.hud.setCharacterPortrait(
        'turbo',
        this.currentVehicle ? 'TURBO FANTASMA [MOTO 740 KM/H]' : 'TURBO FANTASMA',
        'MOTO 740 KM/H [MOUSE 2 / F] • ESPADA DE PLASMA [MOUSE 1] • SEGURE [Q] TURBO INFINITO'
      );
    }
  },

  _triggerVoltaicoLightningBlink() {
    if (this.secondaryCooldown > 0 || !this.destructibles) return;
    this.secondaryCooldown = 0.14;
    const aimDir = this._alignCharacterToCrosshair();
    const fromPos = this.position.clone();

    const playerEye = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z);
    const camToPlayerDist = Math.max(0, this.camera.position.distanceTo(playerEye) - 0.4);
    const rayOrigin = this.camera.position.clone().addScaledVector(aimDir, camToPlayerDist);

    const maxBlinkDist = 96.0;
    let bestT = maxBlinkDist;
    let targetPt = null;

    for (const obj of this.destructibles.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const objTop = new THREE.Vector3(obj.basePos.x, obj.basePos.y + (obj.height || 2.0), obj.basePos.z);
      const toObj = objTop.clone().sub(rayOrigin);
      const dist = toObj.length();
      if (dist < 3.0 || dist > bestT) continue;
      const dot = toObj.clone().normalize().dot(aimDir);
      if (dot < 0.86) continue;
      const perp = dist * Math.sqrt(Math.max(0, 1 - dot * dot));
      if (perp <= (obj.radius || 1.2) + 2.5) {
        bestT = dist;
        targetPt = new THREE.Vector3(obj.basePos.x, obj.basePos.y + (obj.height || 2.0) + 0.35, obj.basePos.z);
      }
    }

    const blinkHit = this._raycastWorldColliders3D(rayOrigin, aimDir, 2.5, bestT);
    if (blinkHit) {
      bestT = blinkHit.distance;
      const hitPt = rayOrigin.clone().addScaledVector(aimDir, Math.max(1.5, blinkHit.distance - 0.85));
      if (blinkHit.collider && hitPt.y >= blinkHit.collider.maxY - 3.2) {
        hitPt.y = blinkHit.collider.maxY + 0.35;
      }
      targetPt = hitPt;
    }

    if (aimDir.y < -0.01) {
      for (let d = 3.0; d <= bestT; d += 1.5) {
        const px = rayOrigin.x + aimDir.x * d;
        const py = rayOrigin.y + aimDir.y * d;
        const pz = rayOrigin.z + aimDir.z * d;
        const terrainY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(px, pz) : 0;
        if (py <= terrainY + 0.3) {
          bestT = d;
          targetPt = new THREE.Vector3(px, terrainY + 0.35, pz);
          break;
        }
      }
    }

    if (!targetPt) {
      const blinkReach = 62.0;
      const fx = rayOrigin.x + aimDir.x * blinkReach;
      const fz = rayOrigin.z + aimDir.z * blinkReach;
      const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fx, fz) : 0;
      const fy = Math.max(floorY + 0.45, rayOrigin.y + aimDir.y * blinkReach);
      targetPt = new THREE.Vector3(fx, fy, fz);
    }

    this.destructibles.spawnLightningTeleportStrike(fromPos, targetPt);
    this.position.copy(targetPt);
    if (this.minifigure?.root) this.minifigure.root.position.copy(targetPt);
    this.velocity.set(aimDir.x * 14.0, Math.max(9.5, aimDir.y * 18.0 + 6.0), aimDir.z * 14.0);
    this.isGrounded = false;
    this.cameraShakeTimer = 0.26;
  },

  _toggleVortexMonsterForm() {
    if (this.minifigure.currentHeroKey !== 'vortex') return;
    const nextMonster = !this.minifigure.isVortexMonster;
    this.minifigure.setVortexMonsterForm(nextMonster);
    this.cameraShakeTimer = 0.32;
    this.destructibles?.spawnSymbioteMorphBurst(this.position, nextMonster);
    this.hud?.setCharacterPortrait(
      'vortex',
      nextMonster ? 'VÓRTEX [COLOSSO BIG-FIG]' : 'VÓRTEX (SIMBIONTE)',
      nextMonster
        ? 'FORMA MONSTRUOSA ATIVA • ESMAGA PAREDES E CARROS • [F] FORMA ÁGIL'
        : 'FORMA ÁGIL ATIVA • [F] METAMORFOSE BIG-FIG • [MOUSE 2] LAÇO ABISSAL'
    );
  },

  _updateHeroFlight3D(dt, camForward, moveInput, hasInput, isUsingSolarBeam) {
    const isSolarisFly = this.minifigure.currentHeroKey === 'solaris';
    this.isSupersonic = isSolarisFly && (hasInput || this.keys.jump || this.keys.descend) && this.keys.sprint;
    const op09JetSpeed =
      (this.keys.sprint ? 38.0 : 25.0) * (this.customHeroPowers?.getSpeedMultiplier() || 1.0);
    const targetFlySpeed = isSolarisFly
      ? (this.isSupersonic ? this.flyCometSpeed : this.flyHoverSpeed)
      : op09JetSpeed;
    const targetSpeed = hasInput ? targetFlySpeed : 0;

    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, Math.min(1, dt * 14));

    const yawDelta = this.yaw - this.lastYaw;
    this.lastYaw = this.yaw;
    const strafeBank = (this.keys.left ? 0.45 : 0) + (this.keys.right ? -0.45 : 0);
    const targetBank = THREE.MathUtils.clamp(yawDelta * 14 + strafeBank, -0.85, 0.85);
    this.flightBank = THREE.MathUtils.lerp(this.flightBank, targetBank, Math.min(1, dt * 10));

    if (this.isSupersonic) {
      const horizDir = hasInput ? moveInput : camForward;
      this.velocity.x = horizDir.x * this.currentSpeed;
      this.velocity.z = horizDir.z * this.currentSpeed;

      let targetVy = 0;
      if (this.keys.jump) {
        targetVy = 42.0;
      } else if (this.keys.descend) {
        targetVy = -42.0;
      } else if (hasInput) {
        const pitchVy = -Math.sin(this.pitch) * this.currentSpeed * 0.52;
        const groundSupport = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
        targetVy = (this.position.y <= groundSupport + 2.8 && pitchVy < 0) ? 0 : pitchVy;
      }
      this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVy, Math.min(1, dt * 16));

      const horizVel = Math.max(12.0, Math.hypot(this.velocity.x, this.velocity.z));
      this.flightPitch = THREE.MathUtils.lerp(this.flightPitch, Math.atan2(this.velocity.y, horizVel), Math.min(1, dt * 14));
      this.facingAngle = lerpAngle(this.facingAngle, Math.atan2(horizDir.x, horizDir.z), Math.min(1, dt * 16));
      this.minifigure.root.rotation.y = this.facingAngle;

      if (this.destructibles) {
        this.cometTrailTimer -= dt;
        if (this.cometTrailTimer <= 0) {
          this.cometTrailTimer = 0.018;
          this.destructibles.spawnFlameTrailParticle(
            new THREE.Vector3(this.position.x, this.position.y + 0.9, this.position.z),
            1.5
          );
        }
      }
    } else {
      this.flightPitch = THREE.MathUtils.lerp(this.flightPitch, 0, Math.min(1, dt * 10));
      if (hasInput) {
        this.velocity.x = moveInput.x * this.currentSpeed;
        this.velocity.z = moveInput.z * this.currentSpeed;
        if (!isUsingSolarBeam && !this.mouseButtons.left) {
          this.facingAngle = lerpAngle(this.facingAngle, Math.atan2(moveInput.x, moveInput.z), Math.min(1, dt * 14));
          this.minifigure.root.rotation.y = this.facingAngle;
        }
      } else {
        this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, Math.min(1, dt * 12));
        this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, Math.min(1, dt * 12));
      }

      let targetVy = 0;
      if (this.keys.jump) targetVy += 28.0;
      if (this.keys.descend) targetVy -= 26.0;
      this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVy, Math.min(1, dt * 14));
    }

    if (dt > 1e-6 && this.world?.sweepSphere) {
      const flyRadius = 0.52;
      const flyOffsetY = 1.05;
      _heroFlyFrom.x = this.position.x;
      _heroFlyFrom.y = this.position.y + flyOffsetY;
      _heroFlyFrom.z = this.position.z;
      _heroFlyTo.x = this.position.x + this.velocity.x * dt;
      _heroFlyTo.y = this.position.y + this.velocity.y * dt + flyOffsetY;
      _heroFlyTo.z = this.position.z + this.velocity.z * dt;

      const sweep = this.world.sweepSphere(_heroFlyFrom, _heroFlyTo, flyRadius, { out: _heroFlySweep });
      if (sweep?.hit) {
        const nx = sweep.normal.x, ny = sweep.normal.y, nz = sweep.normal.z;
        const dx = _heroFlyTo.x - _heroFlyFrom.x;
        const dy = _heroFlyTo.y - _heroFlyFrom.y;
        const dz = _heroFlyTo.z - _heroFlyFrom.z;
        const remFrac = Math.max(0, 1 - sweep.t);
        let rx = dx * remFrac, ry = dy * remFrac, rz = dz * remFrac;
        const rDotN = rx * nx + ry * ny + rz * nz;
        if (rDotN < 0) { rx -= rDotN * nx; ry -= rDotN * ny; rz -= rDotN * nz; }

        _heroFlyMid.x = sweep.point.x + nx * (flyRadius + 0.02);
        _heroFlyMid.y = sweep.point.y + ny * (flyRadius + 0.02);
        _heroFlyMid.z = sweep.point.z + nz * (flyRadius + 0.02);
        _heroFlySlideTo.x = _heroFlyMid.x + rx;
        _heroFlySlideTo.y = _heroFlyMid.y + ry;
        _heroFlySlideTo.z = _heroFlyMid.z + rz;

        const slideHit = (rx * rx + ry * ry + rz * rz) > 1e-6
          ? this.world.sweepSphere(_heroFlyMid, _heroFlySlideTo, flyRadius, { out: _heroFlySlideSweep })
          : null;
        const safeX = slideHit?.hit ? slideHit.x : _heroFlySlideTo.x;
        const safeY = (slideHit?.hit ? slideHit.y : _heroFlySlideTo.y) - flyOffsetY;
        const safeZ = slideHit?.hit ? slideHit.z : _heroFlySlideTo.z;

        this.velocity.x = (safeX - this.position.x) / dt;
        this.velocity.y = (safeY - this.position.y) / dt;
        this.velocity.z = (safeZ - this.position.z) / dt;
      }
    }
  }
};
