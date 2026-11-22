import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { STAR_FORCE_BUDGET, DISPATCH_RULES, HELI_TUNING } from './PursuitTuning.js';
import { ensurePoliceRoadGraph } from './PoliceRoadGraph.js';
import { attachVehicleOccupants } from '../vehicles/VehicleOccupants.js';

/**
 * PoliceDispatchDirector.js
 * Diretor tático de despacho policial/militar: cumprimento estrito de `STAR_FORCE_BUDGET`
 * (1★–5★ + redução de 50% em `SEARCH`), reforços >= 120m fora do frustum da câmera
 * vindos das delegacias/ruas próximas, Tanques Militares 5★ (`tanque_titan`) e reciclagem > 250m.
 */

export function getCameraForward2D(sys, controller = null, overrideForward = null) {
  if (overrideForward && (typeof overrideForward.x === 'number' || typeof overrideForward.z === 'number')) {
    const ox = overrideForward.x || 0;
    const oz = overrideForward.z || 0;
    const oLen = Math.hypot(ox, oz);
    if (oLen > 1e-5) return { x: ox / oLen, z: oz / oLen };
  }
  const ctrl = controller || sys?.hud?._lastController;
  if (ctrl?.cameraForward) {
    const cx = ctrl.cameraForward.x || 0;
    const cz = ctrl.cameraForward.z || 0;
    const cLen = Math.hypot(cx, cz);
    if (cLen > 1e-5) return { x: cx / cLen, z: cz / cLen };
  }
  if (ctrl && typeof ctrl.yaw === 'number') {
    return { x: -Math.sin(ctrl.yaw), z: -Math.cos(ctrl.yaw) };
  }
  const vx = sys?._playerVelDir?.x || 0;
  const vz = sys?._playerVelDir?.z ?? -1;
  const vLen = Math.hypot(vx, vz);
  return vLen > 1e-5 ? { x: vx / vLen, z: vz / vLen } : { x: 0, z: -1 };
}

function getNearestPrecinctDist(x, z) {
  let bestSq = Infinity;
  for (let i = 0; i < HELI_TUNING.bases.length; i++) {
    const b = HELI_TUNING.bases[i];
    const dSq = (b.x - x) * (b.x - x) + (b.z - z) * (b.z - z);
    if (dSq < bestSq) bestSq = dSq;
  }
  return Math.sqrt(bestSq);
}

/**
 * Despawna unidades terrestres que ficaram > 250m para trás/ocultas (sem teletransporte!).
 */
export function despawnIfLostBeyondHorizon(sys, pv, index, dist, blockedToPlayer, playerPos, camFwd) {
  if (dist <= DISPATCH_RULES.despawnBehindDist) return false;
  const pos = pv.carObj?.mesh?.position;
  if (!pos) return false;
  const dotCam = ((pos.x - playerPos.x) * camFwd.x + (pos.z - playerPos.z) * camFwd.z) / dist;
  if (sys.isEscaping || blockedToPlayer || dotCam < 0.3) {
    sys.destructibles?.unregisterDestructible?.(pv.carObj);
    sys.pursuitVehicles.splice(index, 1);
    sys.lostVehiclesCount = (sys.lostVehiclesCount || 0) + 1;
    return true;
  }
  return false;
}

export function tickDispatchAndSirens(sys, dt, playerPos, moveLen) {
  sys._lastMoveSpeed = moveLen / Math.max(0.001, dt);
  sys._spawnTickTimer -= dt;

  if (sys._spawnTickTimer <= 0) {
    sys._spawnTickTimer = 1.25;
    const inTunnel = sys._isPlayerInUndergroundTunnel(playerPos);

    const desiredCars = sys._getDesiredVehicleCount();
    const activeCars = sys._getActivePoliceCarCount();
    if (activeCars < desiredCars && !inTunnel) {
      const spawnBatch = activeCars === 0 ? Math.min(2, desiredCars) : 1;
      for (let b = 0; b < spawnBatch && sys._getActivePoliceCarCount() < desiredCars; b++) {
        sys._spawnPursuitVehicle(playerPos);
      }
    }

    const desiredTanks = sys._getDesiredTankCount();
    if (sys._getActivePoliceTankCount() < desiredTanks && !inTunnel) {
      sys._spawnPoliceTank(playerPos);
    }

    const desiredHelis = sys._getDesiredHeliCount();
    const activeHelis = Array.isArray(sys.policeHelicopters)
      ? sys.policeHelicopters.length
      : (sys.eagleHeli ? 1 : 0);
    if (desiredHelis > activeHelis && sys.eagleHeliRespawnCooldown <= 0) {
      sys._spawnEagleHelicopter(playerPos);
    }
  }

  if (sys._getStarBudget().roadblocks && !sys.isEscaping) {
    sys._roadblockCooldown -= dt;
    if (sys._roadblockCooldown <= 0) {
      sys._roadblockCooldown =
        sys._lastMoveSpeed > 14.0 && sys._trySpawnRoadblockAhead(playerPos) ? 14.0 : 3.0;
    }
  }
  sys._strobeClock += dt * 11.0;
}

export const policeDispatchMethods = {
  _getStarBudget() {
    return STAR_FORCE_BUDGET[Math.max(0, Math.min(5, Math.floor(this.stars || 0)))] || STAR_FORCE_BUDGET[0];
  },

  _getActivePoliceCarCount() {
    let count = 0;
    for (let i = 0; i < this.pursuitVehicles.length; i++) {
      const pv = this.pursuitVehicles[i];
      if (pv && !pv.isTank && !pv.retreating && !pv.carObj?.destroyed && !pv.carObj?.isDriven) count++;
    }
    return count;
  },

  _getActivePoliceTankCount() {
    let count = 0;
    for (let i = 0; i < this.pursuitVehicles.length; i++) {
      const pv = this.pursuitVehicles[i];
      if (pv?.isTank && !pv.retreating && !pv.carObj?.destroyed && !pv.carObj?.isDriven) count++;
    }
    return count;
  },

  _getDesiredVehicleCount() {
    if (this.stars <= 0) return 0;
    const budget = this._getStarBudget();
    return this.isEscaping
      ? Math.max(1, Math.ceil(budget.cars * DISPATCH_RULES.searchBudgetFactor))
      : budget.cars;
  },

  _getDesiredTankCount() {
    return this.stars <= 0 || this.isEscaping ? 0 : (this._getStarBudget().tanks || 0);
  },

  _getDesiredFootCount() {
    if (this.stars <= 0) return 0;
    const budget = this._getStarBudget();
    return this.isEscaping
      ? Math.max(1, Math.ceil(budget.foot * DISPATCH_RULES.searchBudgetFactor))
      : budget.foot;
  },

  _getDesiredHeliCount() {
    return this.stars <= 0 ? 0 : (this._getStarBudget().helis || 0);
  },

  _spawnImmediateWaveForStars(playerPos) {
    const refPos =
      playerPos && (playerPos.x !== 0 || playerPos.z !== 0)
        ? playerPos
        : new THREE.Vector3(0, 0.5, -140);

    if (!this._isPlayerInUndergroundTunnel(refPos)) {
      const desiredCars = this._getDesiredVehicleCount();
      const targetImmediate = Math.min(desiredCars, 2);
      let activeCars = this._getActivePoliceCarCount();
      for (let safety = 0; activeCars < targetImmediate && safety < 4; safety++) {
        if (this._spawnPursuitVehicle(refPos)) activeCars++;
      }
      if (this.stars >= 4 && activeCars < desiredCars) {
        const hasHeavy = this.pursuitVehicles.some(
          (v) => !v.isTank && !v.retreating && !v.carObj?.destroyed &&
            (v.role === 'bope_heavy' || v.role === 'choque_pickup')
        );
        if (!hasHeavy) this._spawnPursuitVehicle(refPos);
      }
      const desiredTanks = this._getDesiredTankCount();
      if (desiredTanks > 0 && this._getActivePoliceTankCount() < desiredTanks) {
        this._spawnPoliceTank(refPos);
      }
    }

    const desiredHelis = this._getDesiredHeliCount();
    if (desiredHelis > 0 && this.eagleHeliRespawnCooldown <= 0) {
      for (let g = 0; (this.policeHelicopters?.length || 0) < desiredHelis && g < desiredHelis; g++) {
        this._spawnEagleHelicopter(refPos);
      }
    }
  },

  _findPursuitSpawnPos(playerPos, minDist = 125, maxDist = 195, preferAhead = false, cameraForward = null) {
    const px = playerPos?.x ?? 0;
    const pz = playerPos?.z ?? 0;
    const hardMin = Math.max(120.5, DISPATCH_RULES.minSpawnDist + 0.5);
    const hardMax = 210.0;
    const prefMin = THREE.MathUtils.clamp(minDist || 125, hardMin, hardMax - 12.0);
    const prefMax = THREE.MathUtils.clamp(maxDist || DISPATCH_RULES.maxSpawnDist, prefMin + 8.0, hardMax);
    const camFwd = getCameraForward2D(this, null, cameraForward);
    const velX = this._playerVelDir?.x || 0;
    const velZ = this._playerVelDir?.z || 0;

    const samples = ensurePoliceRoadGraph(this).spawnSamples || [];
    let bestSample = null;
    let bestScore = -Infinity;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const dx = s.x - px;
      const dz = s.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < hardMin || dist > hardMax) continue;
      if (this.world?.isDeepWaterAt?.(s.x, s.z, { forCar: true })) continue;
      if (getMetroCutoutFloorY(s.x, s.z) !== null) continue;
      if (this._isInsideCoveredGarage?.({ x: s.x, y: 0, z: s.z })) continue;

      const blockedByBldg = Boolean(this._isSegmentBlockedByBuilding?.(s.x, s.z, px, pz));
      const dotCam = (dx * camFwd.x + dz * camFwd.z) / dist;
      if (dotCam > 0.45 && !blockedByBldg) continue;

      let minPeerDist = Infinity;
      for (let k = 0; k < this.pursuitVehicles.length; k++) {
        const pv = this.pursuitVehicles[k];
        if (!pv || pv.retreating || pv.carObj?.destroyed || !pv.carObj?.mesh) continue;
        const pd = Math.hypot(pv.carObj.mesh.position.x - s.x, pv.carObj.mesh.position.z - s.z);
        if (pd < minPeerDist) minPeerDist = pd;
      }

      const precinctScore = Math.max(0, 1.0 - getNearestPrecinctDist(s.x, s.z) / 680.0) * 38.0;
      const losScore = blockedByBldg ? 32.0 : 0.0;
      const camScore = dotCam < -0.15 ? 16.0 : (dotCam < 0.2 ? 8.0 : 0.0);
      const bandScore = dist >= prefMin && dist <= prefMax ? 18.0 : 0.0;
      const dirScore = ((dx * velX + dz * velZ) / dist) * (preferAhead ? 14.0 : -6.0);
      const spacingPenalty = minPeerDist < 10.0 ? -55.0 : (minPeerDist < 20.0 ? -22.0 : 0.0);
      const score = precinctScore + losScore + camScore + bandScore + dirScore + spacingPenalty + Math.random() * 5.5;

      if (score > bestScore) {
        bestScore = score;
        bestSample = s;
      }
    }

    if (bestSample) {
      const y = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(bestSample.x, bestSample.z) : 0;
      return { x: bestSample.x, y, z: bestSample.z };
    }

    const behindAng = Math.atan2(-camFwd.x, -camFwd.z);
    for (let attempt = 0; attempt < 12; attempt++) {
      const ang = behindAng + ((attempt % 2 === 0 ? 1 : -1) * Math.ceil(attempt / 2) * Math.PI) / 9;
      const dist = THREE.MathUtils.clamp(prefMin + 22.0, 130.0, 185.0);
      const fx = px + Math.sin(ang) * dist;
      const fz = pz + Math.cos(ang) * dist;
      if (((fx - px) * camFwd.x + (fz - pz) * camFwd.z) / dist > 0.45) continue;
      if (this.world?.isDeepWaterAt?.(fx, fz, { forCar: true })) continue;
      return { x: fx, y: this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fx, fz) : 0, z: fz };
    }

    const fbX = px - camFwd.x * 150.0;
    const fbZ = pz - camFwd.z * 150.0;
    return { x: fbX, y: this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fbX, fbZ) : 0, z: fbZ };
  },

  _pickPursuitVehicleConfig() {
    const activeCars = this._getActivePoliceCarCount();
    if (this.stars <= 1) {
      return { vType: 'interceptor_v8', color: 0x111827, roofColor: LEGO_COLORS.white, speed: 30.0, hp: 150, role: 'patrol', roofLightY: 1.58 };
    }
    if (this.stars <= 3) {
      return { vType: 'interceptor_v8', color: 0x0f172a, roofColor: LEGO_COLORS.white, speed: 36.0, hp: 190, role: 'pit_interceptor', roofLightY: 1.58 };
    }
    if (this.stars === 4) {
      return activeCars % 2 === 0
        ? { vType: 'caveirao_bope', color: 0x090a0d, roofColor: 0x111827, speed: 38.0, hp: 360, role: 'bope_heavy', roofLightY: 2.32 }
        : { vType: VEHICLE_SPECS.choque_pickup ? 'choque_pickup' : 'interceptor_v8', color: 0x1e293b, roofColor: 0x090a0d, speed: 38.0, hp: 250, role: 'choque_pickup', roofLightY: 1.92 };
    }
    return activeCars % 2 === 0
      ? { vType: 'caveirao_bope', color: 0x090a0d, roofColor: 0x111827, speed: 41.0, hp: 440, role: 'bope_heavy', roofLightY: 2.32 }
      : { vType: 'interceptor_v8', color: 0x090a0d, roofColor: 0xfacc15, speed: 41.0, hp: 280, role: 'pit_interceptor', roofLightY: 1.58 };
  },

  _spawnPursuitVehicle(playerPos) {
    if (this.stars > 0 && this._getActivePoliceCarCount() >= this._getDesiredVehicleCount()) return null;
    const refPos = playerPos || this._lastPlayerPos || new THREE.Vector3(0, 0.5, -140);
    const cfg = this._pickPursuitVehicleConfig();
    const spec = VEHICLE_SPECS[cfg.vType] || VEHICLE_SPECS.interceptor_v8;
    const spawn = this._findPursuitSpawnPos(refPos, 125, 195, this.pursuitVehicles.length % 3 === 1);
    const heading = Math.atan2(refPos.x - spawn.x, refPos.z - spawn.z);

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
    attachVehicleOccupants(carObj, {
      source: 'police_pursuit',
      role: cfg.role,
      carType: cfg.vType
    });

    const unit = {
      carObj, col, isTank: false, role: cfg.role, maxSpeed: cfg.speed, speed: cfg.speed * 0.72,
      heading, driftSlip: 0, strobeRed, strobeBlue, pitCooldown: 1.5, deployedTroops: false,
      roadPath: [], pathIndex: 0, repathTimer: 0, tacticalSlot: 0, parkedBroadside: false,
      stuckTimer: 0, farNoLosTimer: 0, pursuitEngageTime: 0, retreating: false, retreatLife: 0
    };
    this.pursuitVehicles.push(unit);
    return unit;
  },

  _spawnPoliceTank(playerPos) {
    const desiredTanks = this._getDesiredTankCount();
    if (desiredTanks <= 0 || this._getActivePoliceTankCount() >= desiredTanks) return null;

    const refPos = playerPos || this._lastPlayerPos || new THREE.Vector3(0, 0.5, -140);
    const spec = VEHICLE_SPECS.tanque_titan;
    const spawn = this._findPursuitSpawnPos(refPos, 130, 195, false);
    const heading = Math.atan2(refPos.x - spawn.x, refPos.z - spawn.z);

    const tankMesh = createLegoCarMesh({ x: spawn.x, z: spawn.z, rotY: heading, color: 0x2b3620, roofColor: 0x1c2415, type: 'tanque_titan' });
    tankMesh.position.set(spawn.x, spawn.y, spawn.z);
    tankMesh.rotation.y = heading;
    Object.assign(tankMesh.userData, {
      carType: 'tanque_titan', carName: spec?.name || 'TANQUE MILITAR TITAN-M1',
      vehicleSpec: spec, skipStaticMerge: true
    });
    this.scene.add(tankMesh);

    const col = this.world.addCollider(spawn.x, spawn.z, 3.4, 5.8, spawn.y + 2.5, spawn.y);
    const carObj = this.destructibles.registerDestructible({
      mesh: tankMesh, type: 'car', hp: 900, radius: 3.1, height: 2.5, colliders: [col],
      debrisColors: [0x2b3620, 0x1c2415, 0x334155, 0xf59e0b],
      studDrops: { silver: 6, gold: 12, blue: 8, purple: 3 },
      groundY: spawn.y, isPoliceUnit: true, noAutoRespawn: true
    });
    attachVehicleOccupants(carObj, {
      source: 'police_pursuit',
      role: 'army_tank',
      carType: 'tanque_titan',
      isTank: true
    });

    const tankUnit = {
      carObj, col, isTank: true, role: 'army_tank', maxSpeed: 28.5, speed: 18.0,
      heading, driftSlip: 0, strobeRed: null, strobeBlue: null,
      cannonCooldown: 2.2, pitCooldown: 1.5, deployedTroops: true,
      roadPath: [], pathIndex: 0, repathTimer: 0, tacticalSlot: -1, parkedBroadside: false,
      stuckTimer: 0, pursuitEngageTime: 0, retreating: false, retreatLife: 0
    };
    this.pursuitVehicles.push(tankUnit);
    return tankUnit;
  },

  _clearAllPoliceTanks() {
    for (let i = this.pursuitVehicles.length - 1; i >= 0; i--) {
      const pv = this.pursuitVehicles[i];
      if (!pv?.isTank) continue;
      if (pv.carObj) this.destructibles?.unregisterDestructible?.(pv.carObj);
      if (pv.carObj?.mesh?.parent) pv.carObj.mesh.parent.remove(pv.carObj.mesh);
      this.pursuitVehicles.splice(i, 1);
    }
  }
};
