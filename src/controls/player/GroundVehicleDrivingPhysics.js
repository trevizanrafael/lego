import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { ensureVehicleNightLights } from '../../world/DayNightAtmosphereManager.js';
import {
  updateVehicleDynamicTuningFX,
  getVehicleCustomFlameHex
} from '../../world/StreetCustomGarage.js';
import { getWorldSoftBoundaryForce } from '../../world/CoastlineProfile.js';

export const groundVehicleDrivingMethods = {
  /**
   * Dispara armas acopladas aos veículos (Moto Fantasma, Moto 600cc CV, Picape Artilhada CV, Hover-APC A.R.E.S. e Tanque Titan-M1)
   */
  _fireVehicleWeapon() {
    if (this.primaryCooldown > 0 || !this.currentVehicle || !this.destructibles) return;
    const carObj = this.currentVehicle;
    const spec = carObj.mesh.userData?.vehicleSpec;

    if (spec?.isGhostBike) {
      this.primaryCooldown = 0.22;
      this.minifigure.triggerPunch();
      const aimData = this.destructibles.getAimTargetPoint(this.camera, 95);
      this.destructibles.performTurboChainWhip(carObj.mesh.position, this.vehicleHeading, aimData.point);
      return;
    }

    if (!spec || !spec.weapon) return;

    const aimData = this.destructibles.getAimTargetPoint(this.camera, 110);
    const carPos = carObj.mesh.position;
    const aimDir = aimData.point.clone().sub(carPos).normalize();

    const isAir = spec.category === 'plane' || spec.category === 'helicopter';
    const airForward = spec.category === 'plane' ? 8.2 : spec.category === 'helicopter' ? 5.6 : 0;

    if (spec.weapon === 'smg' || spec.weapon === 'machinegun') {
      this.primaryCooldown = spec.weapon === 'machinegun' ? 0.08 : 0.095;
      const muzzleY = spec.weapon === 'machinegun' ? 2.15 : 1.15;
      const fDist = isAir ? airForward : 1.4;
      const muzzlePos = new THREE.Vector3(
        carPos.x + aimDir.x * fDist,
        carPos.y + muzzleY,
        carPos.z + aimDir.z * fDist
      );
      this.destructibles.spawnVehicleProjectile(muzzlePos, aimData.point, spec.weapon);
    } else if (spec.weapon === 'plasma_laser') {
      this.primaryCooldown = 0.16;
      const forwardDist = spec.isColossalShip ? 82.0 : isAir ? airForward : 1.6;
      const muzzleHeight = spec.isColossalShip ? 12.6 : isAir ? 1.5 : 2.35;
      const muzzlePos = new THREE.Vector3(
        carPos.x + (spec.isColossalShip ? Math.sin(this.vehicleHeading) * forwardDist : aimDir.x * forwardDist),
        carPos.y + muzzleHeight,
        carPos.z + (spec.isColossalShip ? Math.cos(this.vehicleHeading) * forwardDist : aimDir.z * forwardDist)
      );
      this.destructibles.spawnVehicleProjectile(muzzlePos, aimData.point, spec.weapon);
    } else if (spec.weapon === 'tank_cannon') {
      this.primaryCooldown = 0.6;
      const fDist = isAir ? airForward : 3.1;
      const muzzlePos = new THREE.Vector3(
        carPos.x + aimDir.x * fDist,
        carPos.y + (isAir ? 1.45 : 2.2),
        carPos.z + aimDir.z * fDist
      );
      this.destructibles.spawnVehicleProjectile(muzzlePos, aimData.point, spec.weapon);
    }
  },

  _triggerVehicleHydraulicJump() {
    const carObj = this.currentVehicle;
    if (!carObj || carObj.destroyed || this.vehicleAirborne) return false;
    const spec = carObj.mesh?.userData?.vehicleSpec;
    if (!spec || spec.category || spec.isColossalShip) return false;
    if (!(spec.hydraulicsLevel >= 1 && spec.jumpVelY > 0)) return false;

    this.vehicleAirborne = true;
    this.vehicleAirVelY = spec.jumpVelY;
    carObj.mesh.position.y += 0.25;
    soundFX.playTacticalRoll();
    if (this.destructibles) {
      this.destructibles.spawnFlameTrailParticle(
        new THREE.Vector3(carObj.mesh.position.x, carObj.mesh.position.y + 0.2, carObj.mesh.position.z),
        1.15
      );
    }
    return true;
  },

  _updateVehicleDriving(dt, camRight) {
    const carObj = this.currentVehicle;
    if (!carObj || carObj.destroyed) {
      this.exitVehicle();
      return;
    }

    const spec = carObj.mesh.userData?.vehicleSpec || {
      maxForward: 34.0,
      turboSpeed: 49.0,
      maxReverse: -13.5,
      accel: 29.0,
      turnRate: 2.38,
      driftTurnRate: 3.6
    };

    if (this.mouseButtons.left && this.primaryCooldown <= 0) {
      this._fireVehicleWeapon();
    }

    if (!spec.category) {
      const nightRig = ensureVehicleNightLights(carObj.mesh, spec);
      if (nightRig) {
        nightRig.visible = Boolean((this.world?.atmosphere?.nightFactor || 0) > 0.15);
      }
    }

    if (spec.category === 'boat') {
      this._updateBoatNavigation(dt, camRight, carObj, spec);
      return;
    }
    if (spec.category === 'helicopter') {
      this._updateHelicopterFlight(dt, camRight, carObj, spec);
      return;
    }
    if (spec.category === 'plane') {
      this._updatePlaneFlight(dt, camRight, carObj, spec);
      return;
    }

    if (this.keys.sprint && !this.keys.turbo && Math.abs(this.vehicleSpeed) > 3.5) {
      this.isDrifting = true;
      this.isTurboActive = false;
    } else if (this.keys.turbo && !this.keys.sprint) {
      this.isTurboActive = true;
      this.isDrifting = false;
    } else {
      this.isDrifting = false;
      this.isTurboActive = false;
    }

    const maxForward = this.isTurboActive
      ? spec.turboSpeed
      : this.isDrifting
        ? spec.maxForward * 0.94
        : spec.maxForward;
    const maxReverse = spec.maxReverse;
    const accel = this.isTurboActive ? (spec.turboAccel ?? spec.accel * 1.95) : spec.accel;
    const brakeDecel = spec.brakeDecel ?? 48.0;
    const baseCoast = spec.coastFriction ?? 12.0;
    const coastFriction = this.isDrifting ? baseCoast * 1.25 : baseCoast;

    const isDoingWheelie = Boolean(
      spec.canWheelie && this.keys.jump && (this.keys.forward || this.isTurboActive)
    );

    if (this.keys.jump && !isDoingWheelie) {
      if (Math.abs(this.vehicleSpeed) < 0.5) {
        this.vehicleSpeed = 0;
      } else {
        this.vehicleSpeed -= Math.sign(this.vehicleSpeed) * brakeDecel * 1.15 * dt;
      }
    } else if (this.keys.backward && !this.isTurboActive) {
      const rate = this.vehicleSpeed > 0 ? brakeDecel : accel * 0.85;
      this.vehicleSpeed = Math.max(maxReverse, this.vehicleSpeed - rate * dt);
    } else if (this.keys.forward || this.isTurboActive || isDoingWheelie) {
      const rate = this.vehicleSpeed < 0 ? brakeDecel : accel;
      if (this.vehicleSpeed > maxForward) {
        this.vehicleSpeed = Math.max(maxForward, this.vehicleSpeed - brakeDecel * 0.75 * dt);
      } else {
        this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + rate * dt);
      }
    } else {
      if (Math.abs(this.vehicleSpeed) < 0.45) {
        this.vehicleSpeed = 0;
      } else {
        this.vehicleSpeed -= Math.sign(this.vehicleSpeed) * coastFriction * dt;
      }
    }

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    const targetSteer = steerInput * (this.isDrifting ? 0.65 : 0.52);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, targetSteer, Math.min(1, dt * 14));

    if (Math.abs(this.vehicleSpeed) > 0.35) {
      const speedFactor = THREE.MathUtils.clamp(Math.abs(this.vehicleSpeed) / 9.0, 0.25, 1.0);
      const reverseSign = this.vehicleSpeed >= 0 ? 1 : -1;
      const turnRate = this.isDrifting
        ? spec.driftTurnRate
        : this.keys.jump
          ? 2.85
          : spec.turnRate;
      this.vehicleHeading += steerInput * turnRate * speedFactor * reverseSign * dt;
    }

    const targetDriftAngle = this.isDrifting && Math.abs(this.vehicleSpeed) > 5.0
      ? steerInput * 0.44
      : 0;
    this.vehicleDriftAngle = THREE.MathUtils.lerp(this.vehicleDriftAngle, targetDriftAngle, Math.min(1, dt * 10));

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);

    const netVehMult = this.energyNetSlowTimer > 0 ? 0.58 : 1.0;
    this.velocity.x = forwardX * this.vehicleSpeed * netVehMult;
    this.velocity.z = forwardZ * this.vehicleSpeed * netVehMult;
    this.velocity.y = 0;

    const carRadius = 1.45;
    const curX = carObj.mesh.position.x;
    const curZ = carObj.mesh.position.z;
    const sbDrive = getWorldSoftBoundaryForce(curX + this.velocity.x * dt, curZ + this.velocity.z * dt);
    const bDrive = sbDrive.hardBounds;
    const nextX = THREE.MathUtils.clamp(curX + (this.velocity.x + sbDrive.fx * 45) * dt, bDrive.minX, bDrive.maxX);
    const nextZ = THREE.MathUtils.clamp(curZ + (this.velocity.z + sbDrive.fz * 45) * dt, bDrive.minZ, bDrive.maxZ);

    const isUnstoppable = spec.rammingPower === 'unstoppable';
    const hasWedgeRam = Boolean(spec.hasWedgeRam);
    if (this.destructibles && Math.abs(this.vehicleSpeed) > 3.5) {
      const midX = (curX + nextX) * 0.5;
      const midZ = (curZ + nextZ) * 0.5;
      const stepSpan = Math.hypot(nextX - curX, nextZ - curZ);
      const nearCandidates = this.destructibles.getObjectsNear
        ? this.destructibles.getObjectsNear(midX, midZ, stepSpan * 0.5 + 5.5)
        : this.destructibles.objects;

      for (const obj of nearCandidates) {
        if (obj.destroyed || obj === carObj || obj._wedgeActive) continue;
        const objY = obj.mesh?.position?.y ?? obj.groundY ?? 0;
        if (Math.abs(objY - carObj.mesh.position.y) > 2.8) continue;
        if (obj.type === 'bank_vault_door' || obj.type === 'gold_vault') continue;
        if (obj.mesh?.userData?.vehicleSpec?.isColossalShip) continue;

        const ox = obj.mesh.position.x;
        const oz = obj.mesh.position.z;
        const dx = ox - nextX;
        const dz = oz - nextZ;
        const distEnd = Math.hypot(dx, dz);
        const distMid = Math.hypot(ox - midX, oz - midZ);
        const dist = Math.min(distEnd, distMid);
        const hitMargin = hasWedgeRam ? 2.45 : 1.92;
        if (dist < obj.radius + hitMargin) {
          if (obj.type === 'car') {
            const dotFront = (dx * forwardX + dz * forwardZ) / Math.max(0.01, dist);
            if (hasWedgeRam && this.vehicleSpeed > 6.5 && dotFront > -0.25 && this.world?.customsRuntime) {
              this.world.customsRuntime.launchVehicleOverRoof(
                obj,
                carObj.mesh.position,
                forwardX,
                forwardZ,
                this.vehicleSpeed
              );
            } else if (isUnstoppable) {
              const dmg = spec.ramLevel ? spec.ramDamage : 9999;
              if (spec.ramLevel && obj.hp > dmg) {
                const knockDist = Math.min(4.5, (spec.ramKnockSpeed || 18) * dt * 3.5);
                obj.mesh.position.x += forwardX * knockDist;
                obj.mesh.position.z += forwardZ * knockDist;
                obj.basePos.copy(obj.mesh.position);
              }
              this.destructibles.damageObject(obj, dmg, new THREE.Vector3(forwardX, 0.55, forwardZ));
            } else if (Math.abs(this.vehicleSpeed) > 16.0) {
              this.destructibles.damageObject(obj, 55, new THREE.Vector3(forwardX, 0.35, forwardZ));
            }
          } else {
            this.destructibles.damageObject(obj, 9999, new THREE.Vector3(forwardX, 0.35, forwardZ));
          }
        }
      }
    }

    const curCarY = carObj.mesh.position.y - (this._vehicleWheelieLiftY || 0);
    const sampleSurface = (sx, sz, refY) =>
      this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(sx, sz, refY)
        : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(sx, sz) : 0);

    const driveQueryR = Math.hypot(nextX - curX, nextZ - curZ) + carRadius + 2.5;
    const driveNearCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear((curX + nextX) * 0.5, (curZ + nextZ) * 0.5, driveQueryR)
      : (this.world?.colliders || []);

    const candTerrainYX = sampleSurface(nextX, curZ, curCarY);
    const carBottomX = Math.max(candTerrainYX, curCarY);
    const terrainAt = (wx, wz) => (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(wx, wz) : 0);
    const isWaterBlockAt = (wx, wz, surfaceY, carBottom) => {
      if (!this.world?.isDeepWaterAt?.(wx, wz, { forCar: true })) return false;
      if (surfaceY > terrainAt(wx, wz) + 0.5) return false;
      const waterY = this.world?.getWaterSurfaceY ? this.world.getWaterSurfaceY(wx, wz) : 0;
      if (this.vehicleAirborne && carBottom >= Math.max(waterY, terrainAt(wx, wz)) + 0.6) return false;
      return true;
    };
    let blockedX = isWaterBlockAt(nextX, curZ, candTerrainYX, carBottomX);
    if (!blockedX) {
      for (const col of driveNearCols) {
        if (col.disabled) continue;
        const colMinY = col.minY ?? 0;
        if (col.maxY <= carBottomX + 0.38 || colMinY > carBottomX + 2.2) continue;
        if (
          nextX + carRadius > col.minX && nextX - carRadius < col.maxX &&
          curZ + carRadius > col.minZ && curZ - carRadius < col.maxZ
        ) {
          blockedX = true;
          break;
        }
      }
    }
    let finalX = blockedX ? curX : nextX;

    const candTerrainYZ = sampleSurface(finalX, nextZ, curCarY);
    const carBottomZ = Math.max(candTerrainYZ, curCarY);
    let blockedZ = isWaterBlockAt(finalX, nextZ, candTerrainYZ, carBottomZ);
    if (!blockedZ) {
      for (const col of driveNearCols) {
        if (col.disabled) continue;
        const colMinY = col.minY ?? 0;
        if (col.maxY <= carBottomZ + 0.38 || colMinY > carBottomZ + 2.2) continue;
        if (
          finalX + carRadius > col.minX && finalX - carRadius < col.maxX &&
          nextZ + carRadius > col.minZ && nextZ - carRadius < col.maxZ
        ) {
          blockedZ = true;
          break;
        }
      }
    }
    let finalZ = blockedZ ? curZ : nextZ;

    if (blockedX || blockedZ) {
      this.vehicleSpeed *= spec.collisionRecoilFactor ?? -0.25;
    }

    let groundY = sampleSurface(finalX, finalZ, curCarY);
    let finalCarY = groundY;

    if (this.vehicleAirborne || curCarY > groundY + 0.55) {
      this.vehicleAirborne = true;
      finalCarY = curCarY + this.vehicleAirVelY * dt;
      this.vehicleAirVelY += this.gravity * dt;
      const airGroundY = sampleSurface(finalX, finalZ, finalCarY);
      groundY = airGroundY;
      if (finalCarY <= airGroundY) {
        finalCarY = airGroundY;
        this.vehicleAirVelY = 0;
        this.vehicleAirborne = false;
      }
    } else {
      this.vehicleAirVelY = 0;
      this.vehicleAirborne = false;
    }

    if (!this.vehicleAirborne) {
      const landedInWater =
        Boolean(this.world?.isDeepWaterAt?.(finalX, finalZ, { forCar: true })) &&
        groundY <= terrainAt(finalX, finalZ) + 0.5;
      if (landedInWater && this._lastDryCarPos) {
        finalX = this._lastDryCarPos.x;
        finalZ = this._lastDryCarPos.z;
        groundY = this._lastDryCarPos.y;
        finalCarY = groundY;
        this.vehicleSpeed = 0;
        this.cameraShakeTimer = Math.max(this.cameraShakeTimer || 0, 0.25);
      } else if (!landedInWater) {
        if (!this._lastDryCarPos) this._lastDryCarPos = new THREE.Vector3();
        this._lastDryCarPos.set(finalX, groundY, finalZ);
      }
    }
    this.vehicleVerticalSpeed = this.vehicleAirVelY;

    const aheadY = sampleSurface(finalX + forwardX * 2.0, finalZ + forwardZ * 2.0, groundY);
    const roadSlopePitch = this.vehicleAirborne
      ? THREE.MathUtils.clamp(-this.vehicleAirVelY * 0.018, -0.38, 0.38)
      : -Math.atan2(aheadY - groundY, 2.0);

    const isMoto = Boolean(
      spec.isMotorcycle || spec.id === 'moto_cv' || spec.id === 'moto_pcc' || spec.id === 'moto_policia'
    );
    const targetWheeliePitch = isDoingWheelie && !this.vehicleAirborne ? -0.52 : 0;
    this.vehicleWheeliePitch = THREE.MathUtils.lerp(
      this.vehicleWheeliePitch || 0,
      targetWheeliePitch,
      Math.min(1, dt * 12)
    );

    const rearAxleZ = spec.rearAxleZ ?? 1.38;
    const wheelieAngle = Math.max(0, -this.vehicleWheeliePitch);
    const wheelieLiftY = isMoto ? rearAxleZ * Math.sin(wheelieAngle) : 0;
    this._vehicleWheelieLiftY = wheelieLiftY;

    const visualCarYaw = this.vehicleHeading + this.vehicleDriftAngle;
    const targetPitch = roadSlopePitch + this.vehicleWheeliePitch;
    carObj.mesh.rotation.order = 'YXZ';
    carObj.mesh.position.set(finalX, finalCarY + wheelieLiftY, finalZ);
    carObj.mesh.rotation.y = visualCarYaw;
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, targetPitch, Math.min(1, dt * 12));
    carObj.mesh.rotation.z = isMoto
      ? -this.vehicleSteerAngle * 0.35 - this.vehicleDriftAngle * 0.25
      : -this.vehicleDriftAngle * 0.14;
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);
    carObj.groundY = groundY;

    const turretGroup = carObj.mesh.userData?.turretGroup;
    if (turretGroup) turretGroup.rotation.y = (this.yaw + Math.PI) - visualCarYaw;

    const nowSec = performance.now() * 0.001;
    updateVehicleDynamicTuningFX(carObj, nowSec);

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      const nitroScale = spec.nitroFlameScale || 1.0;
      const pulse = (0.85 + Math.sin(nowSec * 50.0) * 0.3) * nitroScale;
      for (const f of turboFlames) {
        f.visible = this.isTurboActive;
        if (this.isTurboActive) {
          f.scale.set(Math.min(1.65, nitroScale * 0.78), Math.min(1.65, nitroScale * 0.78), pulse);
        }
      }
    }

    if (this.destructibles && (this.isTurboActive || (this.isDrifting && Math.abs(this.vehicleDriftAngle) > 0.08))) {
      this.driftParticleTimer -= dt;
      if (this.driftParticleTimer <= 0) {
        this.driftParticleTimer = 0.032;
        const rearX = finalX - Math.sin(visualCarYaw) * 2.2;
        const rearZ = finalZ - Math.cos(visualCarYaw) * 2.2;
        const customHex = getVehicleCustomFlameHex(carObj, nowSec);
        this.destructibles.spawnFlameTrailParticle(
          new THREE.Vector3(rearX, finalCarY + 0.35, rearZ),
          (this.isTurboActive ? 1.25 : 0.85) * Math.min(1.6, spec.nitroFlameScale || 1.0),
          customHex
        );
      }
    }

    const wheels = carObj.mesh.userData?.wheels;
    if (wheels) {
      this.vehicleWheelSpin += (this.vehicleSpeed / 0.42) * dt;
      for (const w of wheels) {
        if (w.isFront) w.steerGroup.rotation.y = this.vehicleSteerAngle - this.vehicleDriftAngle * 0.65;
        w.spinGroup.rotation.x = this.vehicleWheelSpin;
      }
    }

    const isOpenTop = Boolean(spec.openTop);
    const seatedY = (spec.seatedYOffset ?? (isMoto ? 0.78 : isOpenTop ? 0.56 : 0.48)) + (spec.chassisLiftY || 0);
    const seatZOffset = spec.seatZOffset ?? (isMoto ? -0.26 : 0);

    const carPitch = carObj.mesh.rotation.x || 0;
    const carRoll = carObj.mesh.rotation.z || 0;
    const cosRoll = Math.cos(carRoll);
    const sinRoll = Math.sin(carRoll);
    const cosPitch = Math.cos(carPitch);
    const sinPitch = Math.sin(carPitch);
    const cosYaw = Math.cos(visualCarYaw);
    const sinYaw = Math.sin(visualCarYaw);

    const x1 = -seatedY * sinRoll;
    const y1 = seatedY * cosRoll;
    const z1 = seatZOffset;
    const y2 = y1 * cosPitch - z1 * sinPitch;
    const z2 = y1 * sinPitch + z1 * cosPitch;

    const riderWorldX = finalX + x1 * cosYaw + z2 * sinYaw;
    const riderWorldY = finalCarY + wheelieLiftY + y2;
    const riderWorldZ = finalZ - x1 * sinYaw + z2 * cosYaw;

    this.position.set(finalX, finalCarY + 0.25, finalZ);
    this.facingAngle = visualCarYaw;
    this.minifigure.root.rotation.order = 'YXZ';
    this.minifigure.root.position.set(riderWorldX, riderWorldY, riderWorldZ);
    this.minifigure.root.rotation.set(carPitch, visualCarYaw, carRoll);
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, isOpenTop, isMoto, this.vehicleWheeliePitch);
    } else {
      this.minifigure.state = 'DRIVE';
    }

    this._updateCamera(dt, camRight, false);

    if (this._customsExitCooldown <= 0 && this.world?.legoCustomsData && this.hud?.customsStudio) {
      const lift = this.world.legoCustomsData.liftPos;
      const dLift = Math.hypot(finalX - lift.x, finalZ - lift.z);
      if (dLift <= 4.6 && Math.abs(this.vehicleSpeed) < 2.2 && !this.vehicleAirborne) {
        this.hud.customsStudio.open(this, this.world, carObj, 'performance');
      }
    }
  }
};
