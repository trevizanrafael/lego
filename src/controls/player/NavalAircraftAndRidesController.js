import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { getWorldSoftBoundaryForce } from '../../world/CoastlineProfile.js';
import { lerpAngle } from './CameraOrbitAndRig.js';

export const navalAircraftAndRidesMethods = {
  _findNearbyMetroTotem() {
    const totems = this.world?.metroTotems;
    if (!Array.isArray(totems)) return null;
    for (const totem of totems) {
      const dist = Math.hypot(this.position.x - totem.position.x, this.position.z - totem.position.z);
      if (dist <= 4.2 && Math.abs(this.position.y - totem.position.y) <= 2.8) {
        return {
          target: totem.nextSpawn,
          label: `EMBARCAR METRÔ -> ${totem.nextStationName}`
        };
      }
    }
    return null;
  },

  _findNearbyHelicarrierHangar() {
    const hangar = this.world?.helicarrierHangarData;
    if (!hangar || !this.position || this.position.y < 404) return null;
    const cPos = hangar.consolePos;
    const qPos = hangar.quickConsolePos;
    const pPos = hangar.padPos;
    const distConsole = cPos ? Math.hypot(this.position.x - cPos.x, this.position.z - cPos.z) : Infinity;
    const distQuick = qPos ? Math.hypot(this.position.x - qPos.x, this.position.z - qPos.z) : Infinity;
    const distPad = pPos ? Math.hypot(this.position.x - pPos.x, this.position.z - pPos.z) : Infinity;
    const minDist = Math.min(distConsole, distQuick, distPad);
    return minDist <= 20.0
      ? { label: 'ACESSAR PERSONALIZADOR DE AERONAVES (HANGAR)', dist: minDist, hangar }
      : null;
  },

  /**
   * Posiciona o herói no assento da atração/vagão do metrô e coloca a câmera em volta dele.
   */
  _applyRideSeatAndCamera(dt) {
    if (this.activeRide && (this.activeRide.type === 'metro' ? this.world?.metroSystem : this.world?.attractions)) {
      const seat = this.activeRide.type === 'metro'
        ? this.world.metroSystem.getRideSeatTransform(this.activeRide)
        : this.world.attractions.getRideSeatTransform(this.activeRide);
      if (seat) {
        this.position.copy(seat.pos);
        this.facingAngle = seat.yaw;
        this.minifigure.root.position.copy(seat.pos);
        if (seat.quat) {
          this.minifigure.root.quaternion.copy(seat.quat);
          const trackUp = new THREE.Vector3(0, 1, 0).applyQuaternion(seat.quat).normalize();
          this.camera.up.lerp(trackUp, Math.min(1, dt * 8));
        } else {
          this.camera.up.set(0, 1, 0);
          this.minifigure.root.rotation.set(0, seat.yaw, 0);
        }

        const camDist = seat.camDist || 9.0;
        const horiz = camDist * Math.cos(this.pitch);
        const vert = camDist * Math.sin(this.pitch);
        const shakeX = this.cameraShakeTimer > 0 ? (Math.random() - 0.5) * 0.45 : 0;
        const shakeY = this.cameraShakeTimer > 0 ? (Math.random() - 0.5) * 0.45 : 0;
        if (this.cameraShakeTimer > 0) this.cameraShakeTimer = Math.max(0, this.cameraShakeTimer - dt);

        const targetFocus = new THREE.Vector3(seat.pos.x, seat.pos.y + 1.35, seat.pos.z);
        this.camera.position.set(
          targetFocus.x + Math.sin(this.yaw) * horiz + shakeX,
          Math.max(1.2, targetFocus.y + vert + (seat.camHeight || 2.2) * 0.35 + shakeY),
          targetFocus.z + Math.cos(this.yaw) * horiz
        );
        if (seat.clampCamera) seat.clampCamera(this.camera.position);
        this.camera.lookAt(targetFocus);
        return true;
      }
    }
    return false;
  },

  enterAmusementRide(attrHit) {
    if (!attrHit || !this.world?.attractions) return false;
    this.minifigure?.stopEmote?.();
    this._stopGrapple();
    this.isFlying = false;
    this.isSupersonic = false;
    this.ridingMetroCar = null;
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;

    const cabinIdx =
      attrHit.type === 'ferris_wheel'
        ? this.world.attractions.getLowestFerrisCabinIndex()
        : 0;

    this.activeRide = {
      type: attrHit.type,
      cabinIdx,
      exitPos: attrHit.exitPos ? attrHit.exitPos.clone() : this.position.clone()
    };

    if (this.minifigure?.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, 0, true, false, 0);
    }
    soundFX.playStudCollect(1000);
    return true;
  },

  enterMetroRide(ride) {
    if (!ride) return false;
    this.minifigure?.stopEmote?.();
    this._stopGrapple();
    this.isFlying = false;
    this.isSupersonic = false;
    this.ridingMetroCar = null;
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.activeRide = ride;
    if (this.minifigure?.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, 0, true, false, 0);
    }
    if (typeof soundFX.playMetroDingDong === 'function') {
      soundFX.playMetroDingDong(0.6);
    } else {
      soundFX.playStudCollect(600);
    }
    return true;
  },

  exitMetroRide() {
    const ride = this.activeRide;
    if (!ride || ride.type !== 'metro') return false;
    const exit = this.world?.metroSystem?.getDisembarkPoint?.(ride);
    if (!exit) return false;
    this.activeRide = { ...ride, exitPos: exit.pos };
    this.facingAngle = exit.yaw;
    return this.exitAmusementRide();
  },

  exitAmusementRide() {
    if (!this.activeRide) return false;
    const ex = this.activeRide.exitPos;
    this.activeRide = null;
    this.camera.up.set(0, 1, 0);

    if (this.minifigure?.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(false);
    }
    this.minifigure.root.rotation.order = 'YXZ';
    this.minifigure.root.rotation.set(0, this.facingAngle, 0);

    if (ex) {
      this.position.set(ex.x, ex.y, ex.z);
      this.minifigure.root.position.copy(this.position);
    }
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.isGrounded = true;
    soundFX.playPlasticHit();
    return true;
  },

  _updateBoatNavigation(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = Boolean(this.keys.sprint && !this.isTurboActive && Math.abs(this.vehicleSpeed) > 3.0);

    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.85 : spec.accel;
    const waterDrag = 7.5;
    const isDoingWaveJump = Boolean(spec.canWheelie && this.keys.jump && this.vehicleSpeed > 4.0);

    if (this.keys.forward || this.isTurboActive || isDoingWaveJump) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      this.vehicleSpeed = Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
    } else {
      if (Math.abs(this.vehicleSpeed) < 0.2) this.vehicleSpeed = 0;
      else this.vehicleSpeed -= Math.sign(this.vehicleSpeed) * waterDrag * dt;
    }

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.55, Math.min(1, dt * 12));

    if (Math.abs(this.vehicleSpeed) > 0.25) {
      const reverseSign = this.vehicleSpeed >= 0 ? 1 : -1;
      const turnRate = this.isDrifting ? spec.driftTurnRate : spec.turnRate;
      this.vehicleHeading += steerInput * turnRate * reverseSign * dt;
    }

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);
    this.velocity.set(forwardX * this.vehicleSpeed, 0, forwardZ * this.vehicleSpeed);

    const curX = carObj.mesh.position.x;
    const curZ = carObj.mesh.position.z;
    const sbBoat = getWorldSoftBoundaryForce(curX + this.velocity.x * dt, curZ + this.velocity.z * dt);
    const bBoat = sbBoat.hardBounds;
    const nextX = THREE.MathUtils.clamp(curX + (this.velocity.x + sbBoat.fx * 55) * dt, bBoat.minX, bBoat.maxX);
    const nextZ = THREE.MathUtils.clamp(curZ + (this.velocity.z + sbBoat.fz * 55) * dt, bBoat.minZ, bBoat.maxZ);

    const isColossal = Boolean(spec.isColossalShip);
    const waterY = isColossal
      ? 0
      : (this.world?.getWaterSurfaceY ? this.world.getWaterSurfaceY(curX, curZ) : 0);
    const boatRadius = isColossal ? 18.0 : 1.4;

    const boatNearCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear((curX + nextX) * 0.5, (curZ + nextZ) * 0.5, boatRadius + 6.0)
      : (this.world?.colliders || []);

    let blockedX = this.world?.isDeepWaterAt ? !this.world.isDeepWaterAt(nextX, curZ, { forBoat: true }) : false;
    if (!blockedX) {
      for (const col of boatNearCols) {
        if (col.disabled || (isColossal && (col.isGangway || col.maxY <= 12.0))) continue;
        const colMinY = col.minY ?? 0;
        if (!isColossal && (col.maxY <= waterY + 0.15 || colMinY > waterY + 1.8)) continue;
        if (
          nextX + boatRadius > col.minX && nextX - boatRadius < col.maxX &&
          curZ + boatRadius > col.minZ && curZ - boatRadius < col.maxZ
        ) {
          blockedX = true;
          break;
        }
      }
    }
    const finalX = blockedX ? curX : nextX;

    let blockedZ = this.world?.isDeepWaterAt ? !this.world.isDeepWaterAt(finalX, nextZ, { forBoat: true }) : false;
    if (!blockedZ) {
      for (const col of boatNearCols) {
        if (col.disabled || (isColossal && (col.isGangway || col.maxY <= 12.0))) continue;
        const colMinY = col.minY ?? 0;
        if (!isColossal && (col.maxY <= waterY + 0.15 || colMinY > waterY + 1.8)) continue;
        if (
          finalX + boatRadius > col.minX && finalX - boatRadius < col.maxX &&
          nextZ + boatRadius > col.minZ && nextZ - boatRadius < col.maxZ
        ) {
          blockedZ = true;
          break;
        }
      }
    }
    const finalZ = blockedZ ? curZ : nextZ;

    if (blockedX || blockedZ) this.vehicleSpeed *= -0.25;

    const finalWaterY = isColossal
      ? 0
      : (this.world?.getWaterSurfaceY ? this.world.getWaterSurfaceY(finalX, finalZ) : (spec.waterSurfaceY ?? 0));
    const waveBob = Math.sin(performance.now() * 0.0038 + finalX * 0.1) * (isColossal ? 0.025 : 0.055);
    const speedRatio = THREE.MathUtils.clamp(this.vehicleSpeed / Math.max(1, spec.maxForward), -0.5, 1.3);
    const pitchScale = isColossal ? 0.025 : 0.14;
    const rollScale = isColossal ? 0.035 : 0.22;
    const targetPitch = isDoingWaveJump ? -0.42 : -Math.max(0, speedRatio) * pitchScale;
    const targetRoll = -steerInput * Math.min(1, Math.abs(speedRatio)) * rollScale;

    carObj.mesh.position.set(finalX, finalWaterY + waveBob, finalZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, targetPitch, Math.min(1, dt * 9));
    carObj.mesh.rotation.z = THREE.MathUtils.lerp(carObj.mesh.rotation.z || 0, targetRoll, Math.min(1, dt * 9));
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const propGroup = carObj.mesh.userData?.propellerGroup;
    if (propGroup) {
      const axis = carObj.mesh.userData?.propellerAxis || 'z';
      propGroup.rotation[axis] += (2.5 + Math.abs(this.vehicleSpeed) * 0.85) * dt;
    }

    const turretGroup = carObj.mesh.userData?.turretGroup;
    if (turretGroup) turretGroup.rotation.y = (this.yaw + Math.PI) - this.vehicleHeading;

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      for (const f of turboFlames) f.visible = this.isTurboActive;
    }

    const seatedY = finalWaterY + waveBob + (spec.seatedYOffset ?? 0.58);
    this.position.set(finalX, isColossal ? 24.0 : finalWaterY + 0.25, finalZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(finalX, seatedY, finalZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, !isColossal);
    }

    this._updateCamera(dt, camRight, false);
  },

  _updateHelicopterFlight(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = false;

    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.7 : spec.accel;

    if (this.keys.forward || this.isTurboActive) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      this.vehicleSpeed = Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
    } else {
      this.vehicleSpeed = THREE.MathUtils.lerp(this.vehicleSpeed, 0, Math.min(1, dt * 4.5));
    }

    let targetVy = 0;
    if (this.keys.jump) targetVy += this.isTurboActive ? 34.0 : 24.0;
    if (this.keys.descend) targetVy -= 22.0;
    this.vehicleVerticalSpeed = THREE.MathUtils.lerp(this.vehicleVerticalSpeed || 0, targetVy, Math.min(1, dt * 10));

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.45, Math.min(1, dt * 10));
    this.vehicleHeading += steerInput * spec.turnRate * dt;

    if (this.keys.forward && steerInput === 0) {
      const desiredYaw = this.yaw + Math.PI;
      this.vehicleHeading = lerpAngle(this.vehicleHeading, desiredYaw, Math.min(1, dt * 3.5));
    }

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);
    this.velocity.set(forwardX * this.vehicleSpeed, this.vehicleVerticalSpeed, forwardZ * this.vehicleSpeed);

    const curX = carObj.mesh.position.x;
    const curY = carObj.mesh.position.y;
    const curZ = carObj.mesh.position.z;

    const sbHeli = getWorldSoftBoundaryForce(curX + this.velocity.x * dt, curZ + this.velocity.z * dt);
    const bHeli = sbHeli.hardBounds;
    const nextX = THREE.MathUtils.clamp(curX + (this.velocity.x + sbHeli.fx * 65) * dt, bHeli.minX, bHeli.maxX);
    const nextZ = THREE.MathUtils.clamp(curZ + (this.velocity.z + sbHeli.fz * 65) * dt, bHeli.minZ, bHeli.maxZ);
    const supportY = this._findGroundSupportAt(nextX, nextZ, curY);
    const finalY = THREE.MathUtils.clamp(curY + this.velocity.y * dt, supportY, 540);
    const isAirborne = finalY > supportY + 0.35;

    if (!isAirborne && this.vehicleVerticalSpeed < 0) this.vehicleVerticalSpeed = 0;

    if (carObj.mesh.userData.mainRotorGroup) carObj.mesh.userData.mainRotorGroup.rotation.y += 22.0 * dt;
    if (carObj.mesh.userData.tailRotorGroup) carObj.mesh.userData.tailRotorGroup.rotation.x += 28.0 * dt;

    const speedRatio = this.vehicleSpeed / Math.max(1, spec.maxForward);
    const targetPitch = isAirborne ? speedRatio * 0.24 : 0;
    const targetBank = isAirborne ? -steerInput * 0.28 : 0;

    carObj.mesh.position.set(nextX, finalY, nextZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, targetPitch, Math.min(1, dt * 8));
    carObj.mesh.rotation.z = THREE.MathUtils.lerp(carObj.mesh.rotation.z || 0, targetBank, Math.min(1, dt * 8));
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      for (const f of turboFlames) f.visible = this.isTurboActive;
    }

    const seatedY = finalY + (spec.seatedYOffset ?? 1.5);
    this.position.set(nextX, finalY + 0.5, nextZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(nextX, seatedY, nextZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, false);
    }

    this._updateCamera(dt, camRight, false);
  },

  _updatePlaneFlight(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = false;

    const curX = carObj.mesh.position.x;
    const curY = carObj.mesh.position.y;
    const curZ = carObj.mesh.position.z;
    const supportY = this._findGroundSupportAt(curX, curZ, curY);
    const isAirborne = curY > supportY + 0.45;

    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.9 : spec.accel;

    if (this.keys.forward || this.isTurboActive) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      if (isAirborne) {
        this.vehicleSpeed = Math.max(14.0, this.vehicleSpeed - accel * 0.7 * dt);
      } else {
        this.vehicleSpeed = Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
      }
    } else {
      const minCruise = isAirborne ? 22.0 : 0;
      this.vehicleSpeed = THREE.MathUtils.lerp(this.vehicleSpeed, minCruise, Math.min(1, dt * 2.5));
    }

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.5, Math.min(1, dt * 10));
    if (Math.abs(this.vehicleSpeed) > 0.5 || isAirborne) {
      this.vehicleHeading += steerInput * spec.turnRate * dt;
    }

    let targetVy = 0;
    let targetPitch = 0;
    if (this.keys.jump && (this.vehicleSpeed > 8.0 || isAirborne)) {
      targetVy = Math.max(22.0, this.vehicleSpeed * 0.55);
      targetPitch = -0.38;
    } else if (this.keys.descend && isAirborne) {
      targetVy = -28.0;
      targetPitch = 0.35;
    } else if (isAirborne) {
      targetPitch = THREE.MathUtils.clamp(this.pitch * 0.55, -0.42, 0.42);
      targetVy = -targetPitch * Math.max(18.0, this.vehicleSpeed * 0.65);
    }

    this.vehicleVerticalSpeed = THREE.MathUtils.lerp(this.vehicleVerticalSpeed || 0, targetVy, Math.min(1, dt * 9));
    this.vehiclePitch = THREE.MathUtils.lerp(this.vehiclePitch || 0, isAirborne || targetVy > 0 ? targetPitch : 0, Math.min(1, dt * 9));
    const targetBank = isAirborne ? -steerInput * 0.65 : 0;
    this.vehicleBank = THREE.MathUtils.lerp(this.vehicleBank || 0, targetBank, Math.min(1, dt * 9));

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);
    this.velocity.set(forwardX * this.vehicleSpeed, this.vehicleVerticalSpeed, forwardZ * this.vehicleSpeed);

    const sbBoat = getWorldSoftBoundaryForce(curX + this.velocity.x * dt, curZ + this.velocity.z * dt);
    const bBoat = sbBoat.hardBounds;
    const nextX = THREE.MathUtils.clamp(curX + (this.velocity.x + sbBoat.fx * 55) * dt, bBoat.minX, bBoat.maxX);
    const nextZ = THREE.MathUtils.clamp(curZ + (this.velocity.z + sbBoat.fz * 55) * dt, bBoat.minZ, bBoat.maxZ);
    const nextSupportY = this._findGroundSupportAt(nextX, nextZ, curY);
    const finalY = THREE.MathUtils.clamp(curY + this.velocity.y * dt, nextSupportY, 550);

    carObj.mesh.position.set(nextX, finalY, nextZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    carObj.mesh.rotation.x = this.vehiclePitch;
    carObj.mesh.rotation.z = this.vehicleBank;
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      const showFlames = this.isTurboActive || (isAirborne && this.keys.forward);
      const pulse = 0.9 + Math.sin(performance.now() * 0.06) * 0.35;
      for (const f of turboFlames) {
        f.visible = showFlames;
        if (showFlames) f.scale.set(1, 1, this.isTurboActive ? pulse * 1.4 : pulse * 0.85);
      }
    }

    const seatedY = finalY + (spec.seatedYOffset ?? 1.6);
    this.position.set(nextX, finalY + 0.5, nextZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(nextX, seatedY, nextZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, false);
    }

    this._updateCamera(dt, camRight, false);
  }
};
