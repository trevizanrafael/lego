import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { getWorldSoftBoundaryForce } from '../../world/CoastlineProfile.js';
import { lerpAngle } from './CameraOrbitAndRig.js';

const _airSupportCols = [];
const _airFromCenter = { x: 0, y: 0, z: 0 };
const _airToCenter = { x: 0, y: 0, z: 0 };
const _airMidCenter = { x: 0, y: 0, z: 0 };
const _airSlideTarget = { x: 0, y: 0, z: 0 };
const _airSweepOut = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
const _airSlideSweepOut = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
const _airCapPos = { x: 0, y: 0, z: 0 };
const _airCapOut = {};

function isPointInsideCollider2D(x, z, col) {
  if (x < col.minX || x > col.maxX || z < col.minZ || z > col.maxZ) return false;
  const type = col.shapeType || 'box';
  if (type === 'cylinder') {
    const dx = x - col.cx, dz = z - col.cz;
    return dx * dx + dz * dz <= col.radius * col.radius;
  }
  if (type === 'obb') {
    const c = col.cosYaw ?? Math.cos(col.yaw || 0), s = col.sinYaw ?? Math.sin(col.yaw || 0);
    const dx = x - col.cx, dz = z - col.cz;
    return Math.abs(dx * c - dz * s) <= col.halfX && Math.abs(dx * s + dz * c) <= col.halfZ;
  }
  return true;
}

export const navalAircraftAndRidesMethods = {
  _findNearbyMetroTotem() {
    const totems = this.world?.metroTotems;
    if (!Array.isArray(totems)) return null;
    for (const totem of totems) {
      const dist = Math.hypot(this.position.x - totem.position.x, this.position.z - totem.position.z);
      if (dist <= 4.2 && Math.abs(this.position.y - totem.position.y) <= 2.8) {
        return { target: totem.nextSpawn, label: `EMBARCAR METRÔ -> ${totem.nextStationName}` };
      }
    }
    return null;
  },

  _findNearbyHelicarrierHangar() {
    const hangar = this.world?.helicarrierHangarData;
    if (!hangar || !this.position || this.position.y < 404) return null;
    const cPos = hangar.consolePos, qPos = hangar.quickConsolePos, pPos = hangar.padPos;
    const distConsole = cPos ? Math.hypot(this.position.x - cPos.x, this.position.z - cPos.z) : Infinity;
    const distQuick = qPos ? Math.hypot(this.position.x - qPos.x, this.position.z - qPos.z) : Infinity;
    const distPad = pPos ? Math.hypot(this.position.x - pPos.x, this.position.z - pPos.z) : Infinity;
    const minDist = Math.min(distConsole, distQuick, distPad);
    return minDist <= 20.0 ? { label: 'ACESSAR PERSONALIZADOR DE AERONAVES (HANGAR)', dist: minDist, hangar } : null;
  },

  _applyRideSeatAndCamera(dt) {
    if (!this.activeRide || !(this.activeRide.type === 'metro' ? this.world?.metroSystem : this.world?.attractions)) return false;
    const seat = this.activeRide.type === 'metro'
      ? this.world.metroSystem.getRideSeatTransform(this.activeRide)
      : this.world.attractions.getRideSeatTransform(this.activeRide);
    if (!seat) return false;

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
    const horiz = camDist * Math.cos(this.pitch), vert = camDist * Math.sin(this.pitch);
    const shakeX = this.cameraShakeTimer > 0 ? (Math.random() - 0.5) * 0.45 : 0;
    const shakeY = this.cameraShakeTimer > 0 ? (Math.random() - 0.5) * 0.45 : 0;
    if (this.cameraShakeTimer > 0) this.cameraShakeTimer = Math.max(0, this.cameraShakeTimer - dt);

    const targetFocus = new THREE.Vector3(seat.pos.x, seat.pos.y + 1.35, seat.pos.z);
    this.camera.position.set(
      targetFocus.x + Math.sin(this.yaw) * horiz + shakeX,
      Math.max(1.2, targetFocus.y + vert + (seat.camHeight || 2.2) * 0.35 + shakeY),
      targetFocus.z + Math.cos(this.yaw) * horiz
    );
    seat.clampCamera?.(this.camera.position);
    this.camera.lookAt(targetFocus);
    return true;
  },

  enterAmusementRide(attrHit) {
    if (!attrHit || !this.world?.attractions) return false;
    this.minifigure?.stopEmote?.();
    this._stopGrapple();
    this.isFlying = false; this.isSupersonic = false; this.ridingMetroCar = null;
    this.velocity.set(0, 0, 0); this.currentSpeed = 0;
    const cabinIdx = attrHit.type === 'ferris_wheel' ? this.world.attractions.getLowestFerrisCabinIndex() : 0;
    this.activeRide = { type: attrHit.type, cabinIdx, exitPos: attrHit.exitPos ? attrHit.exitPos.clone() : this.position.clone() };
    this.minifigure?.setSeatedInVehicle?.(true, 0, true, false, 0);
    soundFX.playStudCollect(1000);
    return true;
  },

  enterMetroRide(ride) {
    if (!ride) return false;
    this.minifigure?.stopEmote?.();
    this._stopGrapple();
    this.isFlying = false; this.isSupersonic = false; this.ridingMetroCar = null;
    this.velocity.set(0, 0, 0); this.currentSpeed = 0;
    this.activeRide = ride;
    this.minifigure?.setSeatedInVehicle?.(true, 0, true, false, 0);
    if (typeof soundFX.playMetroDingDong === 'function') soundFX.playMetroDingDong(0.6);
    else soundFX.playStudCollect(600);
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
    this.minifigure?.setSeatedInVehicle?.(false);
    this.minifigure.root.rotation.order = 'YXZ';
    this.minifigure.root.rotation.set(0, this.facingAngle, 0);
    if (ex) {
      this.position.set(ex.x, ex.y, ex.z);
      this.minifigure.root.position.copy(this.position);
    }
    this.velocity.set(0, 0, 0); this.currentSpeed = 0; this.isGrounded = true;
    soundFX.playPlasticHit();
    return true;
  },

  _updateBoatNavigation(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = Boolean(this.keys.sprint && !this.isTurboActive && Math.abs(this.vehicleSpeed) > 3.0);
    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.85 : spec.accel;
    const isDoingWaveJump = Boolean(spec.canWheelie && this.keys.jump && this.vehicleSpeed > 4.0);

    if (this.keys.forward || this.isTurboActive || isDoingWaveJump) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      this.vehicleSpeed = Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
    } else {
      this.vehicleSpeed = Math.abs(this.vehicleSpeed) < 0.2 ? 0 : this.vehicleSpeed - Math.sign(this.vehicleSpeed) * 7.5 * dt;
    }

    const steerInput = Number.isFinite(this.analogSteer) ? this.analogSteer : (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.55, Math.min(1, dt * 12));
    if (Math.abs(this.vehicleSpeed) > 0.25) {
      const turnRate = this.isDrifting ? spec.driftTurnRate : spec.turnRate;
      this.vehicleHeading += steerInput * turnRate * (this.vehicleSpeed >= 0 ? 1 : -1) * dt;
    }

    this.velocity.set(Math.sin(this.vehicleHeading) * this.vehicleSpeed, 0, Math.cos(this.vehicleHeading) * this.vehicleSpeed);
    const curX = carObj.mesh.position.x, curZ = carObj.mesh.position.z;
    const sbBoat = getWorldSoftBoundaryForce(curX + this.velocity.x * dt, curZ + this.velocity.z * dt);
    const bBoat = sbBoat.hardBounds;
    const nextX = THREE.MathUtils.clamp(curX + (this.velocity.x + sbBoat.fx * 55) * dt, bBoat.minX, bBoat.maxX);
    const nextZ = THREE.MathUtils.clamp(curZ + (this.velocity.z + sbBoat.fz * 55) * dt, bBoat.minZ, bBoat.maxZ);

    const isColossal = Boolean(spec.isColossalShip);
    const waterY = isColossal ? 0 : (this.world?.getWaterSurfaceY ? this.world.getWaterSurfaceY(curX, curZ) : 0);
    const boatRadius = isColossal ? 18.0 : 1.4;
    const boatNearCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear((curX + nextX) * 0.5, (curZ + nextZ) * 0.5, boatRadius + 6.0)
      : (this.world?.colliders || []);

    const isBoatBlockedAt = (tx, tz) => {
      if (this.world?.isDeepWaterAt && !this.world.isDeepWaterAt(tx, tz, { forBoat: true })) return true;
      for (const col of boatNearCols) {
        if (col.disabled || (isColossal && (col.isGangway || col.maxY <= 12.0))) continue;
        if (!isColossal && (col.maxY <= waterY + 0.15 || (col.minY ?? 0) > waterY + 1.8)) continue;
        if (tx + boatRadius > col.minX && tx - boatRadius < col.maxX && tz + boatRadius > col.minZ && tz - boatRadius < col.maxZ) return true;
      }
      return false;
    };

    const blockedX = isBoatBlockedAt(nextX, curZ);
    const finalX = blockedX ? curX : nextX;
    const blockedZ = isBoatBlockedAt(finalX, nextZ);
    const finalZ = blockedZ ? curZ : nextZ;
    if (blockedX || blockedZ) this.vehicleSpeed *= -0.25;

    const finalWaterY = isColossal ? 0 : (this.world?.getWaterSurfaceY ? this.world.getWaterSurfaceY(finalX, finalZ) : (spec.waterSurfaceY ?? 0));
    const waveBob = Math.sin(performance.now() * 0.0038 + finalX * 0.1) * (isColossal ? 0.025 : 0.055);
    const speedRatio = THREE.MathUtils.clamp(this.vehicleSpeed / Math.max(1, spec.maxForward), -0.5, 1.3);
    const targetPitch = isDoingWaveJump ? -0.42 : -Math.max(0, speedRatio) * (isColossal ? 0.025 : 0.14);
    const targetRoll = -steerInput * Math.min(1, Math.abs(speedRatio)) * (isColossal ? 0.035 : 0.22);

    carObj.mesh.position.set(finalX, finalWaterY + waveBob, finalZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, targetPitch, Math.min(1, dt * 9));
    carObj.mesh.rotation.z = THREE.MathUtils.lerp(carObj.mesh.rotation.z || 0, targetRoll, Math.min(1, dt * 9));
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const propGroup = carObj.mesh.userData?.propellerGroup;
    if (propGroup) propGroup.rotation[carObj.mesh.userData?.propellerAxis || 'z'] += (2.5 + Math.abs(this.vehicleSpeed) * 0.85) * dt;
    const turretGroup = carObj.mesh.userData?.turretGroup;
    if (turretGroup) turretGroup.rotation.y = (this.yaw + Math.PI) - this.vehicleHeading;
    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) for (const f of turboFlames) f.visible = this.isTurboActive;

    const seatedY = finalWaterY + waveBob + (spec.seatedYOffset ?? 0.58);
    this.position.set(finalX, isColossal ? 24.0 : finalWaterY + 0.25, finalZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(finalX, seatedY, finalZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    this.minifigure.setSeatedInVehicle?.(true, this.vehicleSteerAngle, !isColossal);
    this._updateCamera(dt, camRight, false);
  },

  _findAircraftLandingSupportAt(x, z, curY, vy = 0, ignoreCols = null) {
    const surfaceY = this.world?.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(x, z, curY)
      : (this.world?.getTerrainHeightAt?.(x, z) ?? 0);
    let supportY = this.world?.isDeepWaterAt?.(x, z, { forCar: true })
      ? Math.max(this.world.getWaterSurfaceY ? this.world.getWaterSurfaceY(x, z) : 0, surfaceY)
      : surfaceY;
    const supportCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear(x, z, 2.5, _airSupportCols)
      : (this.world?.colliders || []);
    for (let i = 0; i < supportCols.length; i++) {
      const col = supportCols[i];
      if (!col || col.disabled) continue;
      if (ignoreCols && (ignoreCols instanceof Set ? ignoreCols.has(col) : ignoreCols.indexOf(col) !== -1)) continue;
      if (col.maxY > supportY && curY >= col.maxY - 0.35 && isPointInsideCollider2D(x, z, col)) supportY = col.maxY;
    }
    return supportY;
  },

  _syncAircraftDynamicColliders(carObj, spec, finalX, finalY, finalZ) {
    if (!Array.isArray(carObj?.colliders) || !carObj.colliders[0] || carObj.destroyed) return;
    const c0 = carObj.colliders[0];
    const isRot90 = Math.abs(Math.sin(this.vehicleHeading || 0)) > 0.7;
    const baseW = spec.id === 'aviao_comercial' ? 8.5 : spec.category === 'plane' ? 7.5 : 4.2;
    const baseD = spec.id === 'aviao_comercial' ? 26.0 : spec.category === 'plane' ? 14.0 : 9.5;
    const w = isRot90 ? baseD : baseW, d = isRot90 ? baseW : baseD;
    const h = carObj.height || (spec.id === 'aviao_comercial' ? 6.5 : 3.6);
    const patch = {
      minX: finalX - w * 0.5, maxX: finalX + w * 0.5,
      minZ: finalZ - d * 0.5, maxZ: finalZ + d * 0.5,
      minY: finalY, maxY: finalY + h
    };
    if (c0.shapeType === 'obb' || c0.shapeType === 'cylinder') {
      patch.cx = finalX; patch.cz = finalZ; patch.yaw = this.vehicleHeading || 0;
    }
    if (this.world?.updateDynamicCollider) this.world.updateDynamicCollider(c0, patch);
    else Object.assign(c0, patch);
  },

  _triggerAircraftCrashExplosion(carObj, crashPos, fromCenter, nx, ny, nz) {
    const safePos = new THREE.Vector3(
      fromCenter.x + nx * 2.6,
      Math.max(0.5, fromCenter.y - 0.5 + Math.max(0, ny) * 1.5),
      fromCenter.z + nz * 2.6
    );
    if (this.world?.resolveCapsulePenetration) {
      const pen = this.world.resolveCapsulePenetration(safePos, (this.playerRadius || 0.42) + 0.35, 2.05, { stepUpHeight: 0 });
      if (pen.collided) { safePos.x = pen.x; safePos.z = pen.z; }
    }
    this.exitVehicle();
    this.position.copy(safePos);
    this.minifigure?.root?.position?.copy(safePos);
    const groundAtSafe = this._findGroundSupportAt ? this._findGroundSupportAt(safePos.x, safePos.z, safePos.y) : 0;
    this.isGrounded = safePos.y <= groundAtSafe + 0.15;

    const maxHp = this.world?.livingCity?.playerMaxHp || 260;
    if (this.world?.livingCity) {
      const curHp = this.world.livingCity.playerHp ?? maxHp;
      this.world.livingCity.playerHp = Math.max(25, curHp - Math.round(maxHp * 0.38));
      this.hud?.setPlayerHealth?.(this.world.livingCity.playerHp, maxHp, false);
    }
    this.cameraShakeTimer = 0.65;
    if (this.destructibles?._triggerExplosion) {
      this.destructibles._triggerExplosion(crashPos, 10.5, 180, false, true, { sourceIsPlayer: true, isExplosion: true });
    } else {
      soundFX.playExplosion?.(1.35);
    }
    this.destructibles?.damageObject?.(carObj, 99999, crashPos, false, { sourceIsPlayer: true, isExplosion: true });
    if (!carObj.destroyed) {
      carObj.destroyed = true; carObj.hp = 0;
      if (carObj.mesh) carObj.mesh.visible = false;
      if (Array.isArray(carObj.colliders)) for (const col of carObj.colliders) col.disabled = true;
    }
  },

  _resolveAircraftSwept3D(carObj, spec, curX, curY, curZ, rawNextX, rawNextY, rawNextZ, isAirborne, ignoreSet, maxAlt) {
    const centerOffsetY = 1.25;
    const hullRadius = spec.category === 'plane' ? 2.25 : 2.05;
    _airFromCenter.x = curX; _airFromCenter.y = curY + centerOffsetY; _airFromCenter.z = curZ;
    _airToCenter.x = rawNextX; _airToCenter.y = rawNextY + centerOffsetY; _airToCenter.z = rawNextZ;

    const filter = (col) => {
      if (ignoreSet.has(col)) return false;
      return !(curY >= col.maxY - 0.35 && _airFromCenter.y <= col.maxY + hullRadius + 0.05 && -this.velocity.y < 24.0);
    };

    let finalX = rawNextX, finalY = rawNextY, finalZ = rawNextZ;
    const sweep = this.world?.sweepSphere?.(_airFromCenter, _airToCenter, hullRadius, { filter, out: _airSweepOut });

    if (sweep?.hit) {
      const nx = sweep.normal.x, ny = sweep.normal.y, nz = sweep.normal.z;
      const impactSpeed = Math.max(0, -(this.velocity.x * nx + this.velocity.y * ny + this.velocity.z * nz));

      if (ny < -0.72) {
        finalY = Math.min(rawNextY, (sweep.collider.minY ?? 0) - centerOffsetY - hullRadius - 0.03);
        if (this.vehicleVerticalSpeed > 0) this.vehicleVerticalSpeed = 0;
        this.velocity.y = Math.min(0, this.velocity.y);
      } else if (ny > 0.72 && impactSpeed < 24.0) {
        finalY = Math.max(sweep.collider.maxY, rawNextY);
        if (finalY <= sweep.collider.maxY + 0.02 && this.vehicleVerticalSpeed < 0) {
          finalY = sweep.collider.maxY;
          this.vehicleVerticalSpeed = 0;
        }
      } else if (impactSpeed >= 22.0 || (spec.category === 'plane' && isAirborne && impactSpeed >= 17.5)) {
        const crashPos = new THREE.Vector3(sweep.point.x, sweep.point.y, sweep.point.z);
        this._triggerAircraftCrashExplosion(carObj, crashPos, _airFromCenter, nx, ny, nz);
        return null;
      } else if (impactSpeed >= 8.5) {
        const crashPos = new THREE.Vector3(sweep.point.x, sweep.point.y, sweep.point.z);
        finalX = sweep.point.x + nx * (hullRadius + 0.08);
        finalY = sweep.point.y + ny * (hullRadius + 0.08) - centerOffsetY;
        finalZ = sweep.point.z + nz * (hullRadius + 0.08);
        const vDotN = this.velocity.x * nx + this.velocity.y * ny + this.velocity.z * nz;
        if (vDotN < 0) {
          this.velocity.x -= vDotN * nx * 1.15;
          this.velocity.y -= vDotN * ny * 1.15;
          this.velocity.z -= vDotN * nz * 1.15;
        }
        this.vehicleSpeed *= 0.52;
        this.vehicleVerticalSpeed = this.velocity.y;
        this.cameraShakeTimer = Math.max(this.cameraShakeTimer || 0, 0.22);
        this.destructibles?._spawnElectricSparks?.(crashPos, 8);
        soundFX.playMetalRicochet?.();
        carObj.hp = (carObj.hp ?? spec.hp ?? 350) - Math.round(impactSpeed * 4.5);
        if (carObj.hp <= 0) {
          this._triggerAircraftCrashExplosion(carObj, crashPos, _airFromCenter, nx, ny, nz);
          return null;
        }
      } else {
        const remFrac = Math.max(0, 1 - sweep.t);
        let rx = (_airToCenter.x - _airFromCenter.x) * remFrac;
        let ry = (_airToCenter.y - _airFromCenter.y) * remFrac;
        let rz = (_airToCenter.z - _airFromCenter.z) * remFrac;
        const rDotN = rx * nx + ry * ny + rz * nz;
        if (rDotN < 0) { rx -= rDotN * nx; ry -= rDotN * ny; rz -= rDotN * nz; }
        _airMidCenter.x = sweep.point.x + nx * (hullRadius + 0.03);
        _airMidCenter.y = sweep.point.y + ny * (hullRadius + 0.03);
        _airMidCenter.z = sweep.point.z + nz * (hullRadius + 0.03);
        _airSlideTarget.x = _airMidCenter.x + rx;
        _airSlideTarget.y = _airMidCenter.y + ry;
        _airSlideTarget.z = _airMidCenter.z + rz;
        const slideSweep = (rx * rx + ry * ry + rz * rz) > 1e-6
          ? this.world?.sweepSphere?.(_airMidCenter, _airSlideTarget, hullRadius, { filter, out: _airSlideSweepOut })
          : null;
        finalX = slideSweep?.hit ? slideSweep.x : _airSlideTarget.x;
        finalY = (slideSweep?.hit ? slideSweep.y : _airSlideTarget.y) - centerOffsetY;
        finalZ = slideSweep?.hit ? slideSweep.z : _airSlideTarget.z;
        const vDotN = this.velocity.x * nx + this.velocity.y * ny + this.velocity.z * nz;
        if (vDotN < 0) {
          this.velocity.x -= vDotN * nx;
          this.velocity.y -= vDotN * ny;
          this.velocity.z -= vDotN * nz;
        }
        this.vehicleSpeed *= 0.88;
        this.vehicleVerticalSpeed = this.velocity.y;
        if (Math.abs(this.vehicleSpeed) > 4.5) {
          this.destructibles?._spawnElectricSparks?.(new THREE.Vector3(sweep.point.x, sweep.point.y, sweep.point.z), 3);
        }
      }

      if (this.world?.resolveCapsulePenetration && Math.abs(ny) <= 0.72) {
        _airCapPos.x = finalX; _airCapPos.y = finalY; _airCapPos.z = finalZ;
        const capRes = this.world.resolveCapsulePenetration(
          _airCapPos, hullRadius + 0.02, centerOffsetY + hullRadius, { stepUpHeight: 0.15, filter, out: _airCapOut }
        );
        if (capRes.collided) { finalX = capRes.x; finalZ = capRes.z; }
      }
    }

    const finalSupportY = this._findAircraftLandingSupportAt(finalX, finalZ, Math.max(curY, finalY), this.velocity.y, ignoreSet);
    finalY = THREE.MathUtils.clamp(finalY, finalSupportY, maxAlt);
    this._syncAircraftDynamicColliders(carObj, spec, finalX, finalY, finalZ);
    return { finalX, finalY, finalZ, supportY: finalSupportY };
  },

  _stepAircraftSweepAndCommit(dt, carObj, spec, curX, curY, curZ, ignoreSet, bScale, maxAlt, wasAirborne) {
    const sb = getWorldSoftBoundaryForce(curX + this.velocity.x * dt, curZ + this.velocity.z * dt);
    const b = sb.hardBounds;
    const rawNextX = THREE.MathUtils.clamp(curX + (this.velocity.x + sb.fx * bScale) * dt, b.minX, b.maxX);
    const rawNextZ = THREE.MathUtils.clamp(curZ + (this.velocity.z + sb.fz * bScale) * dt, b.minZ, b.maxZ);
    const preSupportY = this._findAircraftLandingSupportAt(rawNextX, rawNextZ, curY, this.velocity.y, ignoreSet);
    const unclampedY = curY + this.velocity.y * dt;
    if (unclampedY <= preSupportY && -this.velocity.y >= 24.0) {
      this._triggerAircraftCrashExplosion(
        carObj, new THREE.Vector3(rawNextX, preSupportY, rawNextZ), { x: curX, y: curY + 1.25, z: curZ }, 0, 1, 0
      );
      return null;
    }
    const rawNextY = THREE.MathUtils.clamp(unclampedY, preSupportY, maxAlt);
    const resolved = this._resolveAircraftSwept3D(
      carObj, spec, curX, curY, curZ, rawNextX, rawNextY, rawNextZ, wasAirborne, ignoreSet, maxAlt
    );
    if (!resolved) return null;

    const { finalX, finalY, finalZ } = resolved;
    carObj.mesh.position.set(finalX, finalY, finalZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    const seatedY = finalY + (spec.seatedYOffset ?? (spec.category === 'plane' ? 1.6 : 1.5));
    this.position.set(finalX, finalY + 0.5, finalZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(finalX, seatedY, finalZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    this.minifigure.setSeatedInVehicle?.(true, this.vehicleSteerAngle, false);
    return resolved;
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

    const targetVy = (this.keys.jump ? (this.isTurboActive ? 34.0 : 24.0) : 0) - (this.keys.descend ? 22.0 : 0);
    this.vehicleVerticalSpeed = THREE.MathUtils.lerp(this.vehicleVerticalSpeed || 0, targetVy, Math.min(1, dt * 10));

    const steerInput = Number.isFinite(this.analogSteer) ? this.analogSteer : (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.45, Math.min(1, dt * 10));
    this.vehicleHeading += steerInput * spec.turnRate * dt;
    if (this.keys.forward && steerInput === 0) {
      this.vehicleHeading = lerpAngle(this.vehicleHeading, this.yaw + Math.PI, Math.min(1, dt * 3.5));
    }

    this.velocity.set(Math.sin(this.vehicleHeading) * this.vehicleSpeed, this.vehicleVerticalSpeed, Math.cos(this.vehicleHeading) * this.vehicleSpeed);
    const curX = carObj.mesh.position.x, curY = carObj.mesh.position.y, curZ = carObj.mesh.position.z;
    const ignoreSet = new Set(carObj.colliders || []);
    const wasAirborne = curY > this._findAircraftLandingSupportAt(curX, curZ, curY, this.velocity.y, ignoreSet) + 0.35;
    const resolved = this._stepAircraftSweepAndCommit(dt, carObj, spec, curX, curY, curZ, ignoreSet, 65, 540, wasAirborne);
    if (!resolved) return;

    const isAirborne = resolved.finalY > resolved.supportY + 0.35;
    if (!isAirborne && this.vehicleVerticalSpeed < 0) this.vehicleVerticalSpeed = 0;
    if (carObj.mesh.userData.mainRotorGroup) carObj.mesh.userData.mainRotorGroup.rotation.y += 22.0 * dt;
    if (carObj.mesh.userData.tailRotorGroup) carObj.mesh.userData.tailRotorGroup.rotation.x += 28.0 * dt;

    const speedRatio = this.vehicleSpeed / Math.max(1, spec.maxForward);
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, isAirborne ? speedRatio * 0.24 : 0, Math.min(1, dt * 8));
    carObj.mesh.rotation.z = THREE.MathUtils.lerp(carObj.mesh.rotation.z || 0, isAirborne ? -steerInput * 0.28 : 0, Math.min(1, dt * 8));
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) for (const f of turboFlames) f.visible = this.isTurboActive;
    this._updateCamera(dt, camRight, false);
  },

  _updatePlaneFlight(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = false;

    const curX = carObj.mesh.position.x, curY = carObj.mesh.position.y, curZ = carObj.mesh.position.z;
    const ignoreSet = new Set(carObj.colliders || []);
    const isAirborne = curY > this._findAircraftLandingSupportAt(curX, curZ, curY, this.vehicleVerticalSpeed || 0, ignoreSet) + 0.45;
    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.9 : spec.accel;

    if (this.keys.forward || this.isTurboActive) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      this.vehicleSpeed = isAirborne ? Math.max(14.0, this.vehicleSpeed - accel * 0.7 * dt) : Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
    } else {
      this.vehicleSpeed = THREE.MathUtils.lerp(this.vehicleSpeed, isAirborne ? 22.0 : 0, Math.min(1, dt * 2.5));
    }

    const steerInput = Number.isFinite(this.analogSteer) ? this.analogSteer : (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.5, Math.min(1, dt * 10));
    if (Math.abs(this.vehicleSpeed) > 0.5 || isAirborne) this.vehicleHeading += steerInput * spec.turnRate * dt;

    let targetVy = 0, targetPitch = 0;
    if (this.keys.jump && (this.vehicleSpeed > 8.0 || isAirborne)) {
      targetVy = Math.max(22.0, this.vehicleSpeed * 0.55); targetPitch = -0.38;
    } else if (this.keys.descend && isAirborne) {
      targetVy = -28.0; targetPitch = 0.35;
    } else if (isAirborne) {
      targetPitch = THREE.MathUtils.clamp(this.pitch * 0.55, -0.42, 0.42);
      targetVy = -targetPitch * Math.max(18.0, this.vehicleSpeed * 0.65);
    }

    this.vehicleVerticalSpeed = THREE.MathUtils.lerp(this.vehicleVerticalSpeed || 0, targetVy, Math.min(1, dt * 9));
    this.vehiclePitch = THREE.MathUtils.lerp(this.vehiclePitch || 0, isAirborne || targetVy > 0 ? targetPitch : 0, Math.min(1, dt * 9));
    this.vehicleBank = THREE.MathUtils.lerp(this.vehicleBank || 0, isAirborne ? -steerInput * 0.65 : 0, Math.min(1, dt * 9));

    this.velocity.set(Math.sin(this.vehicleHeading) * this.vehicleSpeed, this.vehicleVerticalSpeed, Math.cos(this.vehicleHeading) * this.vehicleSpeed);
    const resolved = this._stepAircraftSweepAndCommit(dt, carObj, spec, curX, curY, curZ, ignoreSet, 55, 550, isAirborne);
    if (!resolved) return;
    if (resolved.finalY <= resolved.supportY + 0.45 && this.vehicleVerticalSpeed < 0) this.vehicleVerticalSpeed = 0;

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
    this._updateCamera(dt, camRight, false);
  }
};
