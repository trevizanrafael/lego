import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { soundFX } from '../../audio/SoundFX.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';

// Manutenção contínua da frota policial, bloqueios de rua e sirenes/giroflex
export function tickPursuitSpawnsAndSirens(sys, dt, playerPos, moveLen) {
  sys._spawnTickTimer -= dt;
  if (sys._spawnTickTimer <= 0) {
    sys._spawnTickTimer = 1.25;
    const desiredCars = sys._getDesiredVehicleCount();
    const activeCars = sys.pursuitVehicles.filter((v) => !v.retreating && !v.carObj?.destroyed).length;
    if (activeCars < desiredCars && !sys._isPlayerInUndergroundTunnel(playerPos)) {
      const spawnBatch = activeCars === 0 ? Math.min(2, desiredCars) : 1;
      for (let b = 0; b < spawnBatch; b++) {
        sys._spawnPursuitVehicle(playerPos);
      }
    }

    if (sys.stars >= 3 && !sys.eagleHeli && sys.eagleHeliRespawnCooldown <= 0) {
      sys._spawnEagleHelicopter(playerPos);
    }

    if (sys.stars >= 5 && sys.hunterDrones.length < 2 && !sys._isPlayerInUndergroundTunnel(playerPos)) {
      sys._spawnHunterDrone(playerPos);
    }
  }

  if (sys.stars >= 3 && !sys.isEscaping) {
    sys._roadblockCooldown -= dt;
    if (sys._roadblockCooldown <= 0) {
      const playerSpeed = moveLen / Math.max(0.001, dt);
      if (playerSpeed > 14.0 && sys._trySpawnRoadblockAhead(playerPos)) {
        sys._roadblockCooldown = 14.0;
      } else {
        sys._roadblockCooldown = 3.0;
      }
    }
  }

  sys._strobeClock += dt * 11.0;
  if (!sys.isEscaping) {
    sys._sirenPulseTimer -= dt;
    if (sys._sirenPulseTimer <= 0 && sys.pursuitVehicles.length > 0) {
      sys._sirenPulseTimer = 3.4 + Math.random() * 1.6;
      soundFX.playCarHorn(0.42, true);
    }
  }
}

export const policeVehiclePursuitMethods = {
  _spawnImmediateWaveForStars(playerPos) {
    const refPos =
      playerPos && (playerPos.x !== 0 || playerPos.z !== 0)
        ? playerPos
        : new THREE.Vector3(0, 0.5, -140);

    const inTunnel = this._isPlayerInUndergroundTunnel(refPos);
    if (!inTunnel) {
      const desiredCars = this._getDesiredVehicleCount();
      const targetImmediate = Math.min(desiredCars, Math.max(2, this.stars));
      let activeCars = this.pursuitVehicles.filter((v) => !v.retreating && !v.carObj?.destroyed).length;
      let safety = 0;
      while (activeCars < targetImmediate && safety < 5) {
        this._spawnPursuitVehicle(refPos);
        activeCars++;
        safety++;
      }
    }

    if (this.stars >= 3 && !this.eagleHeli && this.eagleHeliRespawnCooldown <= 0) {
      this._spawnEagleHelicopter(refPos);
    }

    if (this.stars >= 5 && !inTunnel) {
      while (this.hunterDrones.length < 2) {
        this._spawnHunterDrone(refPos);
      }
    }
  },

  _findPursuitSpawnPos(playerPos, minDist = 32, maxDist = 56, preferAhead = true) {
    const mainAvenuesX = [-516, -384, -252, -120, 0, 120, 252, 384, 612];
    const mainAvenuesZ = [-512, -382, -250, -117, 0, 134, 384, 710];

    const isValidPursuitCoord = (cx, cz, requireLOS = false) => {
      if (getMetroCutoutFloorY(cx, cz) !== null) return false;
      if (this.world?.isDeepWaterAt?.(cx, cz, { forCar: true })) return false;
      if (this._isInsideCoveredGarage({ x: cx, y: 0, z: cz })) return false;
      if (Math.hypot(cx - playerPos.x, cz - playerPos.z) < 24.0) return false;
      if (requireLOS && this._isSegmentBlockedByBuilding(cx, cz, playerPos.x, playerPos.z)) return false;
      return true;
    };

    const dirSign = preferAhead ? 1 : -1;
    const fwdZ = Math.abs(this._playerVelDir.z) > 0.25 ? Math.sign(this._playerVelDir.z) * dirSign : dirSign;
    const fwdX = Math.abs(this._playerVelDir.x) > 0.25 ? Math.sign(this._playerVelDir.x) * dirSign : dirSign;

    const aveCandidates = [];
    for (const ax of mainAvenuesX) {
      if (Math.abs(playerPos.x - ax) <= 46) {
        const dist = minDist + Math.random() * (maxDist - minDist);
        aveCandidates.push({ x: ax, z: playerPos.z + fwdZ * dist }, { x: ax, z: playerPos.z - fwdZ * dist });
      }
    }
    for (const az of mainAvenuesZ) {
      if (Math.abs(playerPos.z - az) <= 46) {
        const dist = minDist + Math.random() * (maxDist - minDist);
        aveCandidates.push({ x: playerPos.x + fwdX * dist, z: az }, { x: playerPos.x - fwdX * dist, z: az });
      }
    }

    for (const requireLOS of [true, false]) {
      for (const cand of aveCandidates) {
        const cx = THREE.MathUtils.clamp(cand.x, -1720, 1540);
        const cz = THREE.MathUtils.clamp(cand.z, -1240, 960);
        const safe = this.livingCity?._findSafeStreetSpawn
          ? this.livingCity._findSafeStreetSpawn(cx, cz, 2.6)
          : { x: cx, z: cz };
        if (isValidPursuitCoord(safe.x, safe.z, requireLOS)) {
          const y = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
          return { x: safe.x, y, z: safe.z };
        }
      }
    }

    const baseAngle = Math.atan2(this._playerVelDir.x, this._playerVelDir.z);
    for (const requireLOS of [true, false]) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const spread = preferAhead ? (Math.random() - 0.5) * 1.15 : Math.random() * Math.PI * 2;
        const ang = preferAhead ? baseAngle + spread : spread;
        const dist = minDist + Math.random() * (maxDist - minDist);
        const rawX = THREE.MathUtils.clamp(playerPos.x + Math.sin(ang) * dist, -1720, 1540);
        const rawZ = THREE.MathUtils.clamp(playerPos.z + Math.cos(ang) * dist, -1240, 960);
        const safe = this.livingCity?._findSafeStreetSpawn
          ? this.livingCity._findSafeStreetSpawn(rawX, rawZ, 2.8)
          : { x: rawX, z: rawZ };
        if (isValidPursuitCoord(safe.x, safe.z, requireLOS)) {
          const y = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
          return { x: safe.x, y, z: safe.z };
        }
      }
    }

    const fallbackX = playerPos.x + 42;
    const fallbackZ = playerPos.z;
    const fy = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fallbackX, fallbackZ) : 0;
    return { x: fallbackX, y: fy, z: fallbackZ };
  },

  _getDesiredVehicleCount() {
    if (this.stars <= 0) return 0;
    if (this.stars === 1) return 2;
    if (this.stars === 2 || this.stars === 3) return 4;
    return 5;
  },

  _pickPursuitVehicleConfig() {
    if (this.stars === 1) {
      return {
        vType: 'interceptor_v8', color: 0x111827, roofColor: LEGO_COLORS.white,
        speed: 31.0, hp: 150, role: 'patrol', roofLightY: 1.58
      };
    }
    if (this.stars === 2 || this.stars === 3) {
      return {
        vType: 'interceptor_v8', color: 0x0f172a, roofColor: LEGO_COLORS.white,
        speed: 40.0, hp: 190, role: 'pit_interceptor', roofLightY: 1.58
      };
    }
    if (this.stars === 4) {
      const heavy = this.pursuitVehicles.length % 2 === 0;
      return heavy
        ? {
            vType: 'caveirao_bope', color: 0x090a0d, roofColor: 0x111827,
            speed: 37.5, hp: 360, role: 'bope_heavy', roofLightY: 2.32
          }
        : {
            vType: 'pickup_offroad', color: 0x1e293b, roofColor: 0x090a0d,
            speed: 41.5, hp: 250, role: 'choque_pickup', roofLightY: 1.92
          };
    }
    const useHoverApc = this.pursuitVehicles.length % 2 === 0 && VEHICLE_SPECS.hover_apc_ares;
    return {
      vType: useHoverApc ? 'hover_apc_ares' : 'caveirao_bope',
      color: 0x090a0d, roofColor: 0x06b6d4,
      speed: 49.0, hp: 440, role: 'antihero_apc', roofLightY: 2.25
    };
  },

  _spawnPursuitVehicle(playerPos) {
    const cfg = this._pickPursuitVehicleConfig();
    const spec = VEHICLE_SPECS[cfg.vType] || VEHICLE_SPECS.interceptor_v8;
    const preferAhead = this.pursuitVehicles.length % 2 === 0;
    const spawn = this._findPursuitSpawnPos(playerPos, 32, 56, preferAhead);
    const heading = Math.atan2(playerPos.x - spawn.x, playerPos.z - spawn.z);

    const carMesh = createLegoCarMesh({
      x: spawn.x, z: spawn.z, rotY: heading,
      color: cfg.color, roofColor: cfg.roofColor, type: cfg.vType
    });
    carMesh.position.set(spawn.x, spawn.y, spawn.z);
    carMesh.rotation.y = heading;
    carMesh.userData.carType = cfg.vType;
    carMesh.userData.carName =
      cfg.role === 'antihero_apc' ? 'BLINDADO ANTI-HERÓI' : spec.name || 'VIATURA POLICIAL';
    carMesh.userData.vehicleSpec = spec;
    carMesh.userData.skipStaticMerge = true;

    const { strobeRed, strobeBlue } = this._attachPoliceLightbar(carMesh, cfg.roofLightY);
    this.scene.add(carMesh);

    const col = this.world.addCollider(spawn.x, spawn.z, 2.6, 5.0, spawn.y + 1.8, spawn.y);
    const carObj = this.destructibles.registerDestructible({
      mesh: carMesh, type: 'car', hp: cfg.hp, radius: 2.75, height: 2.2,
      colliders: [col],
      debrisColors: [cfg.color, cfg.roofColor, 0xef4444, 0x2563eb],
      studDrops: { silver: 4, gold: 8, blue: 3, purple: cfg.role === 'antihero_apc' ? 1 : 0 },
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
    if (this.roadblocks.length >= 2) return false;
    if (this._isPlayerInUndergroundTunnel(playerPos) || playerPos.y > 28) return false;

    const projDist = 96.0;
    const rawX = playerPos.x + this._playerVelDir.x * projDist;
    const rawZ = playerPos.z + this._playerVelDir.z * projDist;

    const mainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
    const mainAvenuesZ = [-382, -250, -117, 0, 134, 402, 710];

    let bestX = rawX;
    let bestZ = rawZ;
    let blockRotY = 0;
    let snapped = false;

    if (Math.abs(this._playerVelDir.z) >= Math.abs(this._playerVelDir.x)) {
      for (const ax of mainAvenuesX) {
        if (Math.abs(rawX - ax) < 26) {
          bestX = ax;
          blockRotY = 0;
          snapped = true;
          break;
        }
      }
    } else {
      for (const az of mainAvenuesZ) {
        if (Math.abs(rawZ - az) < 26) {
          bestZ = az;
          blockRotY = Math.PI / 2;
          snapped = true;
          break;
        }
      }
    }

    if (!snapped) return false;
    if (getMetroCutoutFloorY(bestX, bestZ) !== null) return false;
    if (this.world?.isDeepWaterAt?.(bestX, bestZ, { forCar: true })) return false;

    const groundY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(bestX, bestZ) : 0;
    const G = getSharedPursuitGeos();
    const props = [];
    const cosR = Math.cos(blockRotY);
    const sinR = Math.sin(blockRotY);
    const toWorld = (lx, lz) => ({
      x: bestX + lx * cosR + lz * sinR,
      z: bestZ - lx * sinR + lz * cosR
    });

    for (const side of [-1, 1]) {
      const p = toWorld(side * 4.8, 0);
      const vRot = blockRotY + Math.PI / 2 + side * 0.28;
      const carMesh = createLegoCarMesh({
        x: p.x, z: p.z, rotY: vRot,
        color: 0x0f172a, roofColor: LEGO_COLORS.white, type: 'interceptor_v8'
      });
      carMesh.position.set(p.x, groundY, p.z);
      carMesh.rotation.y = vRot;
      carMesh.userData.carType = 'interceptor_v8';
      carMesh.userData.carName = 'BLOQUEIO POLICIAL';
      carMesh.userData.vehicleSpec = VEHICLE_SPECS.interceptor_v8;
      this._attachPoliceLightbar(carMesh, 1.58);
      this.scene.add(carMesh);

      const col = this.world.addCollider(p.x, p.z, 4.6, 2.6, groundY + 1.8, groundY);
      const cObj = this.destructibles.registerDestructible({
        mesh: carMesh, type: 'car', hp: 140, radius: 2.6, height: 2.0,
        colliders: [col],
        debrisColors: [0x0f172a, LEGO_COLORS.white, 0xef4444, 0x2563eb],
        studDrops: { silver: 3, gold: 6, blue: 2, purple: 0 },
        groundY, isPoliceUnit: true, noAutoRespawn: true
      });
      props.push(cObj);
    }

    for (let bi = -2; bi <= 2; bi++) {
      const bp = toWorld(bi * 2.5, -3.2);
      const bGroup = new THREE.Group();
      bGroup.userData.isOptimizedGroup = true;
      bGroup.position.set(bp.x, groundY, bp.z);
      bGroup.rotation.y = blockRotY;
      bGroup.add(new THREE.Mesh(G.rbBarricadeGeo, this.mats.orangePlastic));
      this.scene.add(bGroup);

      const bObj = this.destructibles.registerDestructible({
        mesh: bGroup, type: 'orange_barricade', hp: 12, radius: 1.2, height: 1.1,
        colliders: [],
        debrisColors: [LEGO_COLORS.orange, LEGO_COLORS.white],
        studDrops: { silver: 2, gold: 1, blue: 0, purple: 0 },
        groundY, isPoliceUnit: true, noAutoRespawn: true
      });
      props.push(bObj);
    }

    const rp = toWorld(9.8, -1.5);
    const rampMesh = new THREE.Mesh(G.roadblockRampGeo, this.mats.yellowHazard);
    rampMesh.position.set(rp.x, groundY, rp.z);
    rampMesh.rotation.y = Math.atan2(playerPos.x - rp.x, playerPos.z - rp.z);
    this.scene.add(rampMesh);

    this.roadblocks.push({
      x: bestX, y: groundY, z: bestZ,
      rampPos: { x: rp.x, y: groundY, z: rp.z },
      rampMesh, props, age: 0
    });
    return true;
  },

  _clearRoadblock(rb) {
    if (rb.rampMesh) this.scene.remove(rb.rampMesh);
    for (const pObj of rb.props) {
      this.destructibles.unregisterDestructible(pObj);
    }
  },

  _clearAllRoadblocks() {
    for (const rb of this.roadblocks) {
      this._clearRoadblock(rb);
    }
    this.roadblocks.length = 0;
  },

  _updatePursuitVehicles(dt, playerPos, controller) {
    const redPhase = Math.sin(this._strobeClock) > 0;
    const playerCar = controller?.currentVehicle;
    const playerSpeedAbs = Math.abs(controller?.vehicleSpeed || 0);
    const inUnderground = this._isPlayerInUndergroundTunnel(playerPos);

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

      pv.pursuitEngageTime = (pv.pursuitEngageTime || 0) + dt;

      if (pv.strobeRed && pv.strobeBlue) {
        pv.strobeRed.material = redPhase ? this.mats.strobeRedOn : this.mats.strobeOff;
        pv.strobeBlue.material = !redPhase ? this.mats.strobeBlueOn : this.mats.strobeOff;
      }

      if (pv.pitCooldown > 0) pv.pitCooldown -= dt;

      if (
        this.stars >= 2 &&
        !pv.deployedTroops &&
        dist < 34.0 &&
        (!playerCar || playerSpeedAbs < 12.0 || pv.pursuitEngageTime >= 6.0) &&
        Math.abs(playerPos.y - pos.y) < 5.5
      ) {
        pv.deployedTroops = true;
        const count = this.stars >= 4 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const sideOff = k === 0 ? -2.4 : 2.4;
          this._spawnFootTrooper(
            {
              x: pos.x + Math.cos(pv.heading) * sideOff,
              y: pos.y,
              z: pos.z - Math.sin(pv.heading) * sideOff
            },
            this.stars
          );
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
        const rightX = this._playerVelDir.z;
        const rightZ = -this._playerVelDir.x;
        const sideSign = i % 2 === 0 ? 1 : -1;
        targetX = playerPos.x - this._playerVelDir.x * 2.2 + rightX * sideSign * 2.4;
        targetZ = playerPos.z - this._playerVelDir.z * 2.2 + rightZ * sideSign * 2.4;
      }

      const desiredHeading = Math.atan2(targetX - pos.x, targetZ - pos.z);
      let angleDiff = desiredHeading - pv.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      pv.heading += THREE.MathUtils.clamp(angleDiff, -3.6 * dt, 3.6 * dt);

      const shouldBrake = !playerCar && dist < 11.5 && !this.isEscaping;
      const desiredSpd = shouldBrake ? 0 : this.isEscaping ? pv.maxSpeed * 0.65 : pv.maxSpeed;
      pv.speed = THREE.MathUtils.lerp(pv.speed, desiredSpd, Math.min(1, dt * 3.8));

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
        const steerAngles = [
          pv.heading + 0.65, pv.heading - 0.65,
          pv.heading + Math.PI * 0.5, pv.heading - Math.PI * 0.5
        ];
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

      const blockedToPlayer = this._isSegmentBlockedByBuilding(pos.x, pos.z, playerPos.x, playerPos.z);
      pv.farNoLosTimer = dist > 115.0 && blockedToPlayer && !inUnderground ? (pv.farNoLosTimer || 0) + dt : 0;

      if (
        !inUnderground &&
        (pv.stuckTimer > 2.2 || pv.farNoLosTimer > 3.5 || (dist > 175 && !this.isEscaping))
      ) {
        const resp = this._findPursuitSpawnPos(playerPos, 35, 58, i % 2 === 0);
        pos.set(resp.x, resp.y, resp.z);
        pv.heading = Math.atan2(playerPos.x - resp.x, playerPos.z - resp.z);
        pv.stuckTimer = 0;
        pv.farNoLosTimer = 0;
      }

      mesh.rotation.y = pv.heading;
      carObj.basePos.copy(pos);
      carObj.groundY = pos.y;
      if (pv.col) {
        pv.col.minX = pos.x - 1.3;
        pv.col.maxX = pos.x + 1.3;
        pv.col.minZ = pos.z - 2.4;
        pv.col.maxZ = pos.z + 2.4;
        pv.col.minY = pos.y;
        pv.col.maxY = pos.y + 1.8;
      }

      if (playerCar && dist < 4.3 && Math.abs(playerPos.y - pos.y) < 2.5 && pv.pitCooldown <= 0) {
        pv.pitCooldown = 1.35;
        soundFX.playPlasticHit();
        if (this.stars >= 2 && typeof controller.vehicleHeading === 'number') {
          const spinDir = i % 2 === 0 ? 1 : -1;
          controller.vehicleHeading += spinDir * (this.stars >= 4 ? 0.34 : 0.24);
          controller.vehicleSpeed *= 0.86;
          this.destructibles._spawnElectricSparks(
            new THREE.Vector3((pos.x + playerPos.x) * 0.5, pos.y + 0.7, (pos.z + playerPos.z) * 0.5),
            6
          );
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
      const dist = Math.hypot(playerPos.x - rb.x, playerPos.z - rb.z);

      if (carObj && controller && Math.abs(controller.vehicleSpeed || 0) > 16.0) {
        const rDist = Math.hypot(
          carObj.mesh.position.x - rb.rampPos.x,
          carObj.mesh.position.z - rb.rampPos.z
        );
        if (rDist < 3.4 && Math.abs(carObj.mesh.position.y - rb.rampPos.y) < 2.2) {
          controller._hydraulicJumpVelY = Math.max(controller._hydraulicJumpVelY || 0, 16.5);
          controller._hydraulicAirOffset = Math.max(controller._hydraulicAirOffset || 0, 0.35);
          soundFX.playCarHorn(0.65, false);
        }
      }

      if (rb.age > 35.0 || dist > 230.0) {
        this._clearRoadblock(rb);
        this.roadblocks.splice(i, 1);
      }
    }
  }
};
