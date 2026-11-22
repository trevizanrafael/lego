import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { soundFX } from '../../audio/SoundFX.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';

// IA DE VIATURAS POLICIAIS (SEM TELETRANSPORTE!), REFORÇOS >= 120M & BLOQUEIOS
export function tickPursuitSpawnsAndSirens(sys, dt, playerPos, moveLen) {
  sys._lastMoveSpeed = moveLen / Math.max(0.001, dt);
  sys._spawnTickTimer -= dt;
  if (sys._spawnTickTimer <= 0) {
    sys._spawnTickTimer = 1.25;
    const desiredCars = sys._getDesiredVehicleCount();
    const activeCars = sys.pursuitVehicles.filter((v) => !v.retreating && !v.carObj?.destroyed).length;
    if (activeCars < desiredCars && !sys._isPlayerInUndergroundTunnel(playerPos)) {
      const spawnBatch = activeCars === 0 ? Math.min(2, desiredCars) : 1;
      for (let b = 0; b < spawnBatch; b++) sys._spawnPursuitVehicle(playerPos);
    }
    const desiredHelis = sys.stars >= 4 ? 2 : sys.stars >= 3 ? 1 : 0;
    const activeHelis = Array.isArray(sys.policeHelicopters) ? sys.policeHelicopters.length : (sys.eagleHeli ? 1 : 0);
    if (desiredHelis > activeHelis && sys.eagleHeliRespawnCooldown <= 0) sys._spawnEagleHelicopter(playerPos);
  }
  if (sys.stars >= 3 && !sys.isEscaping) {
    sys._roadblockCooldown -= dt;
    if (sys._roadblockCooldown <= 0) {
      sys._roadblockCooldown = sys._lastMoveSpeed > 14.0 && sys._trySpawnRoadblockAhead(playerPos) ? 14.0 : 3.0;
    }
  }
  sys._strobeClock += dt * 11.0;
}

function getCameraForward2D(sys, controller = null) {
  const ctrl = controller || sys.hud?._lastController;
  if (ctrl && typeof ctrl.yaw === 'number') return { x: -Math.sin(ctrl.yaw), z: -Math.cos(ctrl.yaw) };
  return { x: sys._playerVelDir?.x || 0, z: sys._playerVelDir?.z || -1 };
}

export const policeVehiclePursuitMethods = {
  _spawnImmediateWaveForStars(playerPos) {
    const refPos = playerPos && (playerPos.x !== 0 || playerPos.z !== 0) ? playerPos : new THREE.Vector3(0, 0.5, -140);
    if (!this._isPlayerInUndergroundTunnel(refPos)) {
      const targetImmediate = Math.min(this._getDesiredVehicleCount(), Math.max(2, this.stars));
      let activeCars = this.pursuitVehicles.filter((v) => !v.retreating && !v.carObj?.destroyed).length;
      for (let safety = 0; activeCars < targetImmediate && safety < 5; safety++, activeCars++) {
        this._spawnPursuitVehicle(refPos);
      }
    }
    const desiredHelis = this.stars >= 4 ? 2 : this.stars >= 3 ? 1 : 0;
    if (desiredHelis > 0 && this.eagleHeliRespawnCooldown <= 0) {
      for (let guard = 0; (this.policeHelicopters?.length || 0) < desiredHelis && guard < desiredHelis; guard++) {
        this._spawnEagleHelicopter(refPos);
      }
    }
  },

  _findPursuitSpawnPos(playerPos, minDist = 125, maxDist = 185, preferAhead = false) {
    const effMin = Math.max(120.0, minDist);
    const effMax = Math.max(effMin + 15.0, Math.min(190.0, maxDist));
    const mainAvenuesX = [-516, -384, -252, -120, 0, 120, 252, 384, 612];
    const mainAvenuesZ = [-512, -382, -250, -117, 0, 134, 384, 710];
    const camFwd = getCameraForward2D(this);

    const isValidPursuitCoord = (cx, cz, requireOutOfSight = false) => {
      const dist = Math.hypot(cx - playerPos.x, cz - playerPos.z);
      if (dist < 120.0 || dist > 190.0) return false;
      if (getMetroCutoutFloorY(cx, cz) !== null) return false;
      if (this.world?.isDeepWaterAt?.(cx, cz, { forCar: true })) return false;
      if (this._isInsideCoveredGarage({ x: cx, y: 0, z: cz })) return false;
      if (requireOutOfSight) {
        const blockedByBldg = this._isSegmentBlockedByBuilding(cx, cz, playerPos.x, playerPos.z);
        const dotCam = ((cx - playerPos.x) * camFwd.x + (cz - playerPos.z) * camFwd.z) / dist;
        if (!blockedByBldg && dotCam > 0.15) return false;
      }
      return true;
    };

    const dirSign = preferAhead ? 1 : -1;
    const fwdZ = Math.abs(this._playerVelDir.z) > 0.25 ? Math.sign(this._playerVelDir.z) * dirSign : dirSign;
    const fwdX = Math.abs(this._playerVelDir.x) > 0.25 ? Math.sign(this._playerVelDir.x) * dirSign : dirSign;
    const aveCandidates = [];

    for (const ax of mainAvenuesX) {
      if (Math.abs(playerPos.x - ax) <= 135) {
        const d = effMin + Math.random() * (effMax - effMin);
        aveCandidates.push({ x: ax, z: playerPos.z - fwdZ * d }, { x: ax, z: playerPos.z + fwdZ * d });
      }
    }
    for (const az of mainAvenuesZ) {
      if (Math.abs(playerPos.z - az) <= 135) {
        const d = effMin + Math.random() * (effMax - effMin);
        aveCandidates.push({ x: playerPos.x - fwdX * d, z: az }, { x: playerPos.x + fwdX * d, z: az });
      }
    }

    for (const requireOutOfSight of [true, false]) {
      for (const cand of aveCandidates) {
        const cx = THREE.MathUtils.clamp(cand.x, -1720, 1540);
        const cz = THREE.MathUtils.clamp(cand.z, -1240, 960);
        const safe = this.livingCity?._findSafeStreetSpawn ? this.livingCity._findSafeStreetSpawn(cx, cz, 2.6) : { x: cx, z: cz };
        if (isValidPursuitCoord(safe.x, safe.z, requireOutOfSight)) {
          return { x: safe.x, y: this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0, z: safe.z };
        }
      }
    }

    const behindAngle = Math.atan2(-camFwd.x, -camFwd.z);
    for (const requireOutOfSight of [true, false]) {
      for (let attempt = 0; attempt < 16; attempt++) {
        const spread = requireOutOfSight ? (Math.random() - 0.5) * Math.PI * 1.15 : (attempt / 16) * Math.PI * 2;
        const ang = behindAngle + spread;
        const dist = effMin + Math.random() * (effMax - effMin);
        const rawX = THREE.MathUtils.clamp(playerPos.x + Math.sin(ang) * dist, -1720, 1540);
        const rawZ = THREE.MathUtils.clamp(playerPos.z + Math.cos(ang) * dist, -1240, 960);
        const safe = this.livingCity?._findSafeStreetSpawn ? this.livingCity._findSafeStreetSpawn(rawX, rawZ, 2.8) : { x: rawX, z: rawZ };
        if (isValidPursuitCoord(safe.x, safe.z, requireOutOfSight)) {
          return { x: safe.x, y: this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0, z: safe.z };
        }
      }
    }

    const fallbackX = THREE.MathUtils.clamp(playerPos.x + Math.sin(behindAngle) * 145.0, -1720, 1540);
    const fallbackZ = THREE.MathUtils.clamp(playerPos.z + Math.cos(behindAngle) * 145.0, -1240, 960);
    return { x: fallbackX, y: this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fallbackX, fallbackZ) : 0, z: fallbackZ };
  },

  _getDesiredVehicleCount() {
    if (this.stars <= 0) return 0;
    if (this.stars === 1) return 2;
    return this.stars <= 3 ? 4 : 5;
  },

  _pickPursuitVehicleConfig() {
    if (this.stars === 1) {
      return { vType: 'interceptor_v8', color: 0x111827, roofColor: LEGO_COLORS.white, speed: 30.0, hp: 150, role: 'patrol', roofLightY: 1.58 };
    }
    if (this.stars <= 3) {
      return { vType: 'interceptor_v8', color: 0x0f172a, roofColor: LEGO_COLORS.white, speed: 36.0, hp: 190, role: 'pit_interceptor', roofLightY: 1.58 };
    }
    if (this.stars === 4) {
      return this.pursuitVehicles.length % 2 === 0
        ? { vType: 'caveirao_bope', color: 0x090a0d, roofColor: 0x111827, speed: 38.0, hp: 360, role: 'bope_heavy', roofLightY: 2.32 }
        : { vType: VEHICLE_SPECS.choque_pickup ? 'choque_pickup' : 'pickup_offroad', color: 0x1e293b, roofColor: 0x090a0d, speed: 38.0, hp: 250, role: 'choque_pickup', roofLightY: 1.92 };
    }
    return this.pursuitVehicles.length % 2 === 0
      ? { vType: 'caveirao_bope', color: 0x090a0d, roofColor: 0x111827, speed: 41.0, hp: 440, role: 'bope_heavy', roofLightY: 2.32 }
      : { vType: 'interceptor_v8', color: 0x090a0d, roofColor: 0xfacc15, speed: 41.0, hp: 280, role: 'pit_interceptor', roofLightY: 1.58 };
  },

  _spawnPursuitVehicle(playerPos) {
    const cfg = this._pickPursuitVehicleConfig();
    const spec = VEHICLE_SPECS[cfg.vType] || VEHICLE_SPECS.interceptor_v8;
    const spawn = this._findPursuitSpawnPos(playerPos, 125, 185, this.pursuitVehicles.length % 3 === 1);
    const heading = Math.atan2(playerPos.x - spawn.x, playerPos.z - spawn.z);

    const carMesh = createLegoCarMesh({ x: spawn.x, z: spawn.z, rotY: heading, color: cfg.color, roofColor: cfg.roofColor, type: cfg.vType });
    carMesh.position.set(spawn.x, spawn.y, spawn.z);
    carMesh.rotation.y = heading;
    Object.assign(carMesh.userData, { carType: cfg.vType, carName: spec.name || 'VIATURA POLICIAL', vehicleSpec: spec, skipStaticMerge: true });

    const { strobeRed, strobeBlue } = this._attachPoliceLightbar(carMesh, cfg.roofLightY);
    this.scene.add(carMesh);

    const col = this.world.addCollider(spawn.x, spawn.z, 2.6, 5.0, spawn.y + 1.8, spawn.y);
    const carObj = this.destructibles.registerDestructible({
      mesh: carMesh, type: 'car', hp: cfg.hp, radius: 2.75, height: 2.2, colliders: [col],
      debrisColors: [cfg.color, cfg.roofColor, 0xef4444, 0x2563eb],
      studDrops: { silver: 4, gold: 8, blue: 3, purple: this.stars >= 5 ? 1 : 0 },
      groundY: spawn.y, isPoliceUnit: true, noAutoRespawn: true
    });

    const unit = {
      carObj, col, role: cfg.role, maxSpeed: cfg.speed, speed: cfg.speed * 0.72,
      heading, strobeRed, strobeBlue, pitCooldown: 1.5, deployedTroops: false,
      stuckTimer: 0, farNoLosTimer: 0, pursuitEngageTime: 0, retreating: false, retreatLife: 0
    };
    this.pursuitVehicles.push(unit);
    return unit;
  },

  _trySpawnRoadblockAhead(playerPos) {
    if (this.roadblocks.length >= 2 || this._isPlayerInUndergroundTunnel(playerPos) || playerPos.y > 28) return false;
    const rawX = playerPos.x + this._playerVelDir.x * 96.0;
    const rawZ = playerPos.z + this._playerVelDir.z * 96.0;
    const mainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
    const mainAvenuesZ = [-382, -250, -117, 0, 134, 402, 710];

    let bestX = rawX;
    let bestZ = rawZ;
    let blockRotY = 0;
    let snapped = false;

    if (Math.abs(this._playerVelDir.z) >= Math.abs(this._playerVelDir.x)) {
      const hitAx = mainAvenuesX.find((ax) => Math.abs(rawX - ax) < 26);
      if (hitAx !== undefined) {
        bestX = hitAx;
        snapped = true;
      }
    } else {
      const hitAz = mainAvenuesZ.find((az) => Math.abs(rawZ - az) < 26);
      if (hitAz !== undefined) {
        bestZ = hitAz;
        blockRotY = Math.PI / 2;
        snapped = true;
      }
    }
    if (!snapped || getMetroCutoutFloorY(bestX, bestZ) !== null || this.world?.isDeepWaterAt?.(bestX, bestZ, { forCar: true })) return false;

    const groundY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(bestX, bestZ) : 0;
    const G = getSharedPursuitGeos();
    const props = [];
    const cosR = Math.cos(blockRotY);
    const sinR = Math.sin(blockRotY);
    const toWorld = (lx, lz) => ({ x: bestX + lx * cosR + lz * sinR, z: bestZ - lx * sinR + lz * cosR });

    for (const side of [-1, 1]) {
      const p = toWorld(side * 4.8, 0);
      const vRot = blockRotY + Math.PI / 2 + side * 0.28;
      const carMesh = createLegoCarMesh({ x: p.x, z: p.z, rotY: vRot, color: 0x0f172a, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' });
      carMesh.position.set(p.x, groundY, p.z);
      carMesh.rotation.y = vRot;
      Object.assign(carMesh.userData, { carType: 'interceptor_v8', carName: 'BLOQUEIO POLICIAL', vehicleSpec: VEHICLE_SPECS.interceptor_v8 });
      this._attachPoliceLightbar(carMesh, 1.58);
      this.scene.add(carMesh);

      const col = this.world.addCollider(p.x, p.z, 4.6, 2.6, groundY + 1.8, groundY);
      props.push(this.destructibles.registerDestructible({
        mesh: carMesh, type: 'car', hp: 140, radius: 2.6, height: 2.0, colliders: [col],
        debrisColors: [0x0f172a, LEGO_COLORS.white, 0xef4444, 0x2563eb],
        studDrops: { silver: 3, gold: 6, blue: 2, purple: 0 },
        groundY, isPoliceUnit: true, noAutoRespawn: true
      }));
    }

    for (let bi = -2; bi <= 2; bi++) {
      const bp = toWorld(bi * 2.5, -3.2);
      const bGroup = new THREE.Group();
      bGroup.userData.isOptimizedGroup = true;
      bGroup.position.set(bp.x, groundY, bp.z);
      bGroup.rotation.y = blockRotY;
      bGroup.add(new THREE.Mesh(G.rbBarricadeGeo, this.mats.orangePlastic));
      this.scene.add(bGroup);

      props.push(this.destructibles.registerDestructible({
        mesh: bGroup, type: 'orange_barricade', hp: 12, radius: 1.2, height: 1.1, colliders: [],
        debrisColors: [LEGO_COLORS.orange, LEGO_COLORS.white],
        studDrops: { silver: 2, gold: 1, blue: 0, purple: 0 },
        groundY, isPoliceUnit: true, noAutoRespawn: true
      }));
    }

    const rp = toWorld(9.8, -1.5);
    const rampMesh = new THREE.Mesh(G.roadblockRampGeo, this.mats.yellowHazard);
    rampMesh.position.set(rp.x, groundY, rp.z);
    rampMesh.rotation.y = Math.atan2(playerPos.x - rp.x, playerPos.z - rp.z);
    this.scene.add(rampMesh);
    this.roadblocks.push({ x: bestX, y: groundY, z: bestZ, rampPos: { x: rp.x, y: groundY, z: rp.z }, rampMesh, props, age: 0 });
    return true;
  },

  _clearRoadblock(rb) {
    if (rb.rampMesh) this.scene.remove(rb.rampMesh);
    for (const pObj of rb.props) this.destructibles.unregisterDestructible(pObj);
  },

  _clearAllRoadblocks() {
    for (const rb of this.roadblocks) this._clearRoadblock(rb);
    this.roadblocks.length = 0;
  },

  _updatePursuitVehicles(dt, playerPos, controller) {
    const redPhase = Math.sin(this._strobeClock) > 0;
    const playerCar = controller?.currentVehicle;
    const playerSpeedAbs = Math.abs(controller?.vehicleSpeed || 0);
    const inUnderground = this._isPlayerInUndergroundTunnel(playerPos);
    const camFwd = getCameraForward2D(this, controller);

    for (let i = this.pursuitVehicles.length - 1; i >= 0; i--) {
      const pv = this.pursuitVehicles[i];
      const carObj = pv.carObj;
      if (!carObj || carObj.destroyed || carObj.isDriven) {
        this.pursuitVehicles.splice(i, 1);
        continue;
      }

      const mesh = carObj.mesh;
      const pos = mesh.position;
      const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

      if (pv.retreating) {
        pv.retreatLife -= dt;
        pos.x += Math.sin(pv.heading) * 22.0 * dt;
        pos.z += Math.cos(pv.heading) * 22.0 * dt;
        if (pv.retreatLife <= 0 || dist > 160) {
          this.destructibles.unregisterDestructible(carObj);
          this.pursuitVehicles.splice(i, 1);
        }
        continue;
      }

      const blockedToPlayer = this._isSegmentBlockedByBuilding(pos.x, pos.z, playerPos.x, playerPos.z);
      if (dist > 250.0) {
        const dotCam = ((pos.x - playerPos.x) * camFwd.x + (pos.z - playerPos.z) * camFwd.z) / dist;
        if (dotCam < 0.3 || blockedToPlayer || this.isEscaping || dist > 265.0) {
          this.destructibles.unregisterDestructible(carObj);
          this.pursuitVehicles.splice(i, 1);
          continue;
        }
      }

      pv.pursuitEngageTime = (pv.pursuitEngageTime || 0) + dt;
      if (pv.strobeRed && pv.strobeBlue) {
        pv.strobeRed.material = redPhase ? this.mats.strobeRedOn : this.mats.strobeOff;
        pv.strobeBlue.material = !redPhase ? this.mats.strobeBlueOn : this.mats.strobeOff;
      }
      if (pv.pitCooldown > 0) pv.pitCooldown -= dt;

      if (
        this.stars >= 2 && !pv.deployedTroops && dist < 34.0 &&
        (!playerCar || playerSpeedAbs < 12.0 || pv.pursuitEngageTime >= 6.0) &&
        Math.abs(playerPos.y - pos.y) < 5.5
      ) {
        pv.deployedTroops = true;
        const count = this.stars >= 4 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const sideOff = k === 0 ? -2.4 : 2.4;
          this._spawnFootTrooper({ x: pos.x + Math.cos(pv.heading) * sideOff, y: pos.y, z: pos.z - Math.sin(pv.heading) * sideOff }, this.stars);
        }
      }

      let targetX = playerPos.x;
      let targetZ = playerPos.z;
      if (this.isEscaping) {
        const lkx = this._lastKnownPlayerPos.x || playerPos.x;
        const lkz = this._lastKnownPlayerPos.z || playerPos.z;
        if (Math.hypot(lkx - pos.x, lkz - pos.z) > 16.0) {
          targetX = lkx;
          targetZ = lkz;
        } else {
          const searchAng = this._strobeClock * 0.25 + i * 1.57;
          targetX = lkx + Math.cos(searchAng) * 28.0;
          targetZ = lkz + Math.sin(searchAng) * 28.0;
        }
      } else if (pv.role === 'patrol' && playerCar) {
        targetX = playerPos.x + this._playerVelDir.x * 12.0;
        targetZ = playerPos.z + this._playerVelDir.z * 12.0;
      } else if (pv.role === 'pit_interceptor' && playerCar) {
        const sideSign = i % 2 === 0 ? 1 : -1;
        targetX = playerPos.x - this._playerVelDir.x * 2.2 + this._playerVelDir.z * sideSign * 2.4;
        targetZ = playerPos.z - this._playerVelDir.z * 2.2 - this._playerVelDir.x * sideSign * 2.4;
      }

      let angleDiff = Math.atan2(targetX - pos.x, targetZ - pos.z) - pv.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      pv.heading += THREE.MathUtils.clamp(angleDiff, -3.6 * dt, 3.6 * dt);

      const canUseCatchup = dist > 55.0 && !this.isEscaping && !blockedToPlayer && !inUnderground;
      const effectiveMaxSpd = canUseCatchup ? Math.min(47.0, pv.maxSpeed * 1.15) : pv.maxSpeed;
      const desiredSpd = !playerCar && dist < 11.5 && !this.isEscaping ? 0 : (this.isEscaping ? pv.maxSpeed * 0.65 : effectiveMaxSpd);
      pv.speed = Math.min(effectiveMaxSpd, THREE.MathUtils.lerp(pv.speed, desiredSpd, Math.min(1, dt * 3.8)));

      const stepDist = pv.speed * dt;
      const nextX = pos.x + Math.sin(pv.heading) * stepDist;
      const nextZ = pos.z + Math.cos(pv.heading) * stepDist;
      const isStepBlocked = (tx, tz) =>
        Boolean(this.world?.isDeepWaterAt?.(tx, tz, { forCar: true })) ||
        getMetroCutoutFloorY(tx, tz) !== null ||
        this._isSegmentBlockedByBuilding(pos.x, pos.z, tx, tz);
      const resolveY = (rx, rz) =>
        this.world?.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(rx, rz, pos.y)
          : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(rx, rz) : 0);

      if (isStepBlocked(nextX, nextZ)) {
        pv.stuckTimer = (pv.stuckTimer || 0) + dt;
        const steerAngles = [pv.heading + 0.65, pv.heading - 0.65, pv.heading + Math.PI * 0.5, pv.heading - Math.PI * 0.5];
        let foundClear = false;
        for (const candAng of steerAngles) {
          const cx = pos.x + Math.sin(candAng) * Math.max(2.2, stepDist);
          const cz = pos.z + Math.cos(candAng) * Math.max(2.2, stepDist);
          if (!isStepBlocked(cx, cz)) {
            pv.heading = candAng;
            pos.x += Math.sin(candAng) * stepDist * 0.85;
            pos.z += Math.cos(candAng) * stepDist * 0.85;
            pos.y = resolveY(pos.x, pos.z);
            foundClear = true;
            break;
          }
        }
        if (!foundClear) {
          pv.heading += (i % 2 === 0 ? 1 : -1) * 1.15;
          pv.speed *= 0.45;
        }
      } else {
        pv.stuckTimer = Math.max(0, (pv.stuckTimer || 0) - dt * 1.5);
        pos.x = nextX;
        pos.z = nextZ;
        pos.y = resolveY(pos.x, pos.z);
      }

      if (pv.stuckTimer > 2.8) {
        pos.x -= Math.sin(pv.heading) * 3.2;
        pos.z -= Math.cos(pv.heading) * 3.2;
        pos.y = resolveY(pos.x, pos.z);
        pv.heading += (i % 2 === 0 ? 1 : -1) * 1.35;
        pv.stuckTimer = 0;
      }

      mesh.rotation.y = pv.heading;
      carObj.basePos.copy(pos);
      carObj.groundY = pos.y;
      if (pv.col) {
        Object.assign(pv.col, { minX: pos.x - 1.3, maxX: pos.x + 1.3, minZ: pos.z - 2.4, maxZ: pos.z + 2.4, minY: pos.y, maxY: pos.y + 1.8 });
      }

      if (playerCar && dist < 4.3 && Math.abs(playerPos.y - pos.y) < 2.5 && pv.pitCooldown <= 0) {
        pv.pitCooldown = 1.35;
        soundFX.playPlasticHit();
        if (this.stars >= 2 && typeof controller.vehicleHeading === 'number') {
          controller.vehicleHeading += (i % 2 === 0 ? 1 : -1) * (this.stars >= 4 ? 0.34 : 0.24);
          controller.vehicleSpeed *= 0.86;
          this.destructibles._spawnElectricSparks(new THREE.Vector3((pos.x + playerPos.x) * 0.5, pos.y + 0.7, (pos.z + playerPos.z) * 0.5), 6);
        } else if (controller) {
          controller.vehicleSpeed *= 0.88;
        }
      }
    }
  },

  _updateRoadblocks(dt, playerPos, controller) {
    const carObj = controller?.currentVehicle;
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      rb.age += dt;
      if (carObj && controller && Math.abs(controller.vehicleSpeed || 0) > 16.0) {
        const rDist = Math.hypot(carObj.mesh.position.x - rb.rampPos.x, carObj.mesh.position.z - rb.rampPos.z);
        if (rDist < 3.4 && Math.abs(carObj.mesh.position.y - rb.rampPos.y) < 2.2) {
          controller._hydraulicJumpVelY = Math.max(controller._hydraulicJumpVelY || 0, 16.5);
          controller._hydraulicAirOffset = Math.max(controller._hydraulicAirOffset || 0, 0.35);
        }
      }
      if (rb.age > 35.0 || Math.hypot(playerPos.x - rb.x, playerPos.z - rb.z) > 230.0) {
        this._clearRoadblock(rb);
        this.roadblocks.splice(i, 1);
      }
    }
  }
};
