import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { DISPATCH_RULES } from './PursuitTuning.js';
import {
  ensurePoliceRoadGraph,
  findNearestRoadNode,
  findRoadPathAStar
} from './PoliceRoadGraph.js';
import {
  getCameraForward2D,
  despawnIfLostBeyondHorizon
} from './PoliceDispatchDirector.js';

/**
 * PoliceCarDriver.js
 * Direção policial tática realista (60 FPS): navegação A* pelas ruas (replan 1.0s),
 * frenagem e escorregamento em curvas fechadas, teto de velocidade (+15% máx.),
 * PIT proporcional à velocidade relativa (2★+), Encaixotamento Box-In (3★+),
 * Abalroamento Pesado BOPE (4★+), Parada Lateral de Cobertura a 15–20m a pé
 * e Canhão Explosivo do Tanque Militar Titan-M1 a cada 3.3s em 5★.
 */

function wrapAnglePi(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function getPlayerVehicleFrame(sys, controller) {
  const heading =
    controller && typeof controller.vehicleHeading === 'number'
      ? controller.vehicleHeading
      : Math.atan2(sys._playerVelDir?.x || 0, sys._playerVelDir?.z || 1);
  const fwdX = Math.sin(heading);
  const fwdZ = Math.cos(heading);
  return { heading, fwdX, fwdZ, sideX: fwdZ, sideZ: -fwdX };
}

function computeVehicleTacticalTarget(sys, pv, slot, pos, playerPos, frame) {
  const { fwdX, fwdZ, sideX, sideZ } = frame;
  const isHeavyRammer = sys.stars >= 4 && (pv.role === 'bope_heavy' || pv.role === 'choque_pickup');

  if (pv.isTank) {
    return { x: playerPos.x - fwdX * 18.0, z: playerPos.z - fwdZ * 18.0, mode: 'tank_standoff' };
  }
  if (sys.stars <= 1) {
    const side = slot % 2 === 0 ? 1.8 : -1.8;
    return { x: playerPos.x - fwdX * 5.2 + sideX * side, z: playerPos.z - fwdZ * 5.2 + sideZ * side, mode: 'patrol_trail' };
  }
  if (sys.stars >= 3) {
    if (slot === 0) {
      const curSide = (pos.x - playerPos.x) * sideX + (pos.z - playerPos.z) * sideZ >= 0 ? 1 : -1;
      return { x: playerPos.x - fwdX * 2.4 + sideX * (curSide * 2.1), z: playerPos.z - fwdZ * 2.4 + sideZ * (curSide * 2.1), mode: 'pit_rear' };
    }
    if (slot === 1) return { x: playerPos.x + sideX * 2.9, z: playerPos.z + sideZ * 2.9, mode: 'box_left' };
    if (slot === 2) return { x: playerPos.x - sideX * 2.9, z: playerPos.z - sideZ * 2.9, mode: 'box_right' };
    if (slot === 3) return { x: playerPos.x + fwdX * 8.5, z: playerPos.z + fwdZ * 8.5, mode: 'box_front' };
  }
  if (isHeavyRammer) {
    return { x: playerPos.x + fwdX * 1.2, z: playerPos.z + fwdZ * 1.2, mode: 'heavy_ram' };
  }
  const sideSign = slot === 0
    ? ((pos.x - playerPos.x) * sideX + (pos.z - playerPos.z) * sideZ >= 0 ? 1 : -1)
    : (slot % 2 === 0 ? 1 : -1);
  return { x: playerPos.x - fwdX * 2.4 + sideX * (sideSign * 2.1), z: playerPos.z - fwdZ * 2.4 + sideZ * (sideSign * 2.1), mode: 'pit_rear' };
}

function computeSearchRingGoal(sys, graph, pv, slotIdx, activeCount, pos) {
  const lkx = sys._lastKnownPlayerPos?.x ?? sys._lastPlayerPos?.x ?? 0;
  const lkz = sys._lastKnownPlayerPos?.z ?? sys._lastPlayerPos?.z ?? 0;
  const sectorStep = pv.searchSectorStep || 0;
  const angle = slotIdx * ((Math.PI * 2) / Math.max(1, activeCount)) + sectorStep * 0.85;
  const radius = 38.0 + ((slotIdx + sectorStep) % 3) * 22.0;
  const rawX = lkx + Math.cos(angle) * radius;
  const rawZ = lkz + Math.sin(angle) * radius;
  const node = findNearestRoadNode(graph, rawX, rawZ, (n) => n.neighbors.length > 0);
  const gx = node ? node.x : rawX;
  const gz = node ? node.z : rawZ;
  if (Math.hypot(gx - pos.x, gz - pos.z) < 15.0) pv.searchSectorStep = sectorStep + 1;
  return { x: gx, z: gz };
}

function updateAStarWaypointTarget(graph, pv, unitIndex, dt, pos, goalX, goalZ) {
  pv.repathTimer = (pv.repathTimer ?? 0) - dt;
  if (pv.repathTimer <= 0 || !Array.isArray(pv.roadPath) || pv.roadPath.length === 0) {
    pv.repathTimer = 0.95 + ((unitIndex * 0.067) % 0.2);
    pv.roadPath = findRoadPathAStar(graph, pos.x, pos.z, goalX, goalZ);
    pv.pathIndex = 0;
    if (pv.roadPath.length >= 2) {
      const w0 = pv.roadPath[0];
      const w1 = pv.roadPath[1];
      const proj = (pos.x - w0.x) * (w1.x - w0.x) + (pos.z - w0.z) * (w1.z - w0.z);
      if (proj > 0 && Math.hypot(pos.x - w0.x, pos.z - w0.z) > 6.0) pv.pathIndex = 1;
    }
  }
  while (
    pv.pathIndex < pv.roadPath.length - 1 &&
    Math.hypot(pv.roadPath[pv.pathIndex].x - pos.x, pv.roadPath[pv.pathIndex].z - pos.z) < 14.0
  ) {
    pv.pathIndex++;
  }
  const wp = pv.roadPath[pv.pathIndex];
  return wp ? { x: wp.x, z: wp.z } : { x: goalX, z: goalZ };
}

function deployShelteredFootOfficers(sys, pv, pos, playerPos, dist) {
  if (pv.deployedTroops || pv.isTank || sys.stars <= 0) return;
  const maxFoot = sys._getDesiredFootCount ? sys._getDesiredFootCount() : 4;
  const availableSlots = maxFoot - sys.footUnits.length;
  if (availableSlots <= 0) return;

  pv.deployedTroops = true;
  const count = Math.min(availableSlots, sys.stars >= 3 ? 2 : 1);
  const invDist = dist > 1e-4 ? 1 / dist : 0;
  const awayX = dist > 1e-4 ? -(playerPos.x - pos.x) * invDist : -Math.sin(pv.heading);
  const awayZ = dist > 1e-4 ? -(playerPos.z - pos.z) * invDist : -Math.cos(pv.heading);
  const carFwdX = Math.sin(pv.heading);
  const carFwdZ = Math.cos(pv.heading);

  for (let k = 0; k < count; k++) {
    const along = count === 1 ? 0 : (k === 0 ? -0.95 : 0.95);
    const sx = pos.x + awayX * 2.05 + carFwdX * along;
    const sz = pos.z + awayZ * 2.05 + carFwdZ * along;
    const sy = sys.world?.getTerrainHeightAt ? sys.world.getTerrainHeightAt(sx, sz) : pos.y;
    const trooper = sys._spawnFootTrooper({ x: sx, y: sy, z: sz }, sys.stars);
    if (trooper?.mesh) trooper.mesh.rotation.y = Math.atan2(playerPos.x - sx, playerPos.z - sz);
  }
}

function handleVehicleContactManeuvers(sys, pv, pos, playerPos, dist, controller, frame) {
  const playerCar = controller?.currentVehicle;
  if (!playerCar || sys.isEscaping || dist >= 4.4 || Math.abs(playerPos.y - pos.y) >= 2.6 || pv.pitCooldown > 0) return;

  const pSpeed = controller.vehicleSpeed || 0;
  const relSpeed = Math.hypot(
    Math.sin(pv.heading) * pv.speed - frame.fwdX * pSpeed,
    Math.cos(pv.heading) * pv.speed - frame.fwdZ * pSpeed
  );
  const isHeavyRam = pv.isTank || (sys.stars >= 4 && (pv.role === 'bope_heavy' || pv.role === 'choque_pickup'));
  const sidePush = (pos.x - playerPos.x) * frame.sideX + (pos.z - playerPos.z) * frame.sideZ >= 0 ? -1 : 1;
  const sparkPos = new THREE.Vector3((pos.x + playerPos.x) * 0.5, pos.y + 0.75, (pos.z + playerPos.z) * 0.5);

  if (isHeavyRam) {
    pv.pitCooldown = 1.25;
    soundFX.playPlasticHit?.();
    if (typeof controller.vehicleHeading === 'number') {
      controller.vehicleHeading += sidePush * THREE.MathUtils.clamp(0.18 + relSpeed * 0.01, 0.18, 0.44);
    }
    if (typeof controller.vehicleSpeed === 'number') controller.vehicleSpeed *= pv.isTank ? 0.68 : 0.78;
    sys.destructibles?._spawnElectricSparks?.(sparkPos, 9);
    const ramDmg = pv.isTank ? 26 : Math.round(12 + Math.min(14, relSpeed * 0.35));
    sys.applyPursuitDamageToPlayer?.(ramDmg, controller, { isCollision: true });
    return;
  }

  pv.pitCooldown = 1.35;
  soundFX.playPlasticHit?.();
  if (sys.stars >= 2 && typeof controller.vehicleHeading === 'number') {
    const spinDelta = THREE.MathUtils.clamp(0.16 + relSpeed * 0.012, 0.18, 0.52);
    controller.vehicleHeading += sidePush * spinDelta;
    if (typeof controller.vehicleSpeed === 'number') controller.vehicleSpeed *= 0.85;
    pv.lastPitSpinApplied = spinDelta;
    sys.destructibles?._spawnElectricSparks?.(sparkPos, 7);
  } else if (typeof controller.vehicleSpeed === 'number') {
    controller.vehicleSpeed *= 0.88;
  }
}

function tickArmyTankCannon(sys, pv, dt, pos, playerPos, dist, blockedToPlayer, controller, frame) {
  if (!pv.isTank) return;
  const turret = pv.carObj?.mesh?.userData?.turretGroup;
  let vx = (sys._playerVelDir?.x || 0) * (sys._lastMoveSpeed || 0);
  let vz = (sys._playerVelDir?.z || 0) * (sys._lastMoveSpeed || 0);
  if (controller?.currentVehicle) {
    const vSpd = controller.vehicleSpeed || 0;
    vx = frame.fwdX * vSpd;
    vz = frame.fwdZ * vSpd;
  } else if (controller?.velocity) {
    vx = controller.velocity.x || 0;
    vz = controller.velocity.z || 0;
  }

  const leadT = Math.min(1.35, dist / 52.0);
  const aimX = playerPos.x + vx * leadT;
  const aimZ = playerPos.z + vz * leadT;
  const worldAimYaw = Math.atan2(aimX - pos.x, aimZ - pos.z);

  if (turret && !sys.isEscaping) {
    const diff = wrapAnglePi(wrapAnglePi(worldAimYaw - pv.heading) - turret.rotation.y);
    turret.rotation.y = wrapAnglePi(turret.rotation.y + THREE.MathUtils.clamp(diff, -2.4 * dt, 2.4 * dt));
  }
  if (sys.isEscaping || dist < 14.0 || dist > 125.0 || blockedToPlayer) return;

  pv.cannonCooldown = (pv.cannonCooldown ?? 2.2) - dt;
  if (pv.cannonCooldown <= 0) {
    pv.cannonCooldown = 3.3;
    const muzzlePos = new THREE.Vector3(pos.x + Math.sin(worldAimYaw) * 4.3, pos.y + 1.92, pos.z + Math.cos(worldAimYaw) * 4.3);
    sys._spawnPursuitProjectile?.(muzzlePos, new THREE.Vector3(aimX, (playerPos.y ?? 0) + 0.95, aimZ), 'tank_shell');
    soundFX.playExplosion?.(0.75);
  }
}

export const policeCarDriverMethods = {
  _updatePursuitVehicles(dt, playerPos, controller) {
    const redPhase = Math.sin(this._strobeClock) > 0;
    const playerCar = controller?.currentVehicle;
    const playerSpeedAbs = Math.abs(controller?.vehicleSpeed || 0);
    const inUnderground = this._isPlayerInUndergroundTunnel(playerPos);
    const camFwd = getCameraForward2D(this, controller);
    const graph = ensurePoliceRoadGraph(this);
    const vehFrame = getPlayerVehicleFrame(this, controller);

    let slotCounter = 0;
    let activeNonRetreating = 0;
    for (let s = 0; s < this.pursuitVehicles.length; s++) {
      const unit = this.pursuitVehicles[s];
      if (!unit || unit.retreating || unit.carObj?.destroyed || unit.carObj?.isDriven) continue;
      activeNonRetreating++;
      if (!unit.isTank) unit.tacticalSlot = slotCounter++;
    }

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
      if (despawnIfLostBeyondHorizon(this, pv, i, dist, blockedToPlayer, playerPos, camFwd)) continue;

      pv.pursuitEngageTime = (pv.pursuitEngageTime || 0) + dt;
      if (pv.strobeRed && pv.strobeBlue) {
        pv.strobeRed.material = redPhase ? this.mats.strobeRedOn : this.mats.strobeOff;
        pv.strobeBlue.material = !redPhase ? this.mats.strobeBlueOn : this.mats.strobeOff;
      }
      if (pv.pitCooldown > 0) pv.pitCooldown -= dt;

      const standoffRadius = pv.isTank ? 24.0 : 16.0 + (i % 3) * 1.5;
      let steerX = playerPos.x;
      let steerZ = playerPos.z;
      let broadsideStop = false;
      let tacticalMode = 'direct';

      if (
        this.isEscaping &&
        dist <= 15.0 &&
        (!blockedToPlayer || dist <= 11.0) &&
        !inUnderground &&
        Math.abs(playerPos.y - pos.y) < 12.0 &&
        !(controller?.stealthTimer > 0) &&
        !controller?.operatorAbilities?.isStealthed?.()
      ) {
        this.enterPursuitState?.(playerPos);
      }

      if (this.isEscaping) {
        pv.parkedBroadside = false;
        const searchGoal = computeSearchRingGoal(this, graph, pv, i, activeNonRetreating, pos);
        const wp = updateAStarWaypointTarget(graph, pv, i, dt, pos, searchGoal.x, searchGoal.z);
        steerX = wp.x;
        steerZ = wp.z;
        tacticalMode = 'search_ring';
      } else if (!playerCar && !pv.isTank) {
        if (dist <= 20.0 && (!blockedToPlayer || dist <= 11.0)) {
          broadsideStop = true;
          pv.parkedBroadside = true;
          if (Math.abs(playerPos.y - pos.y) < 5.5) deployShelteredFootOfficers(this, pv, pos, playerPos, dist);
        } else {
          if (dist > 25.0) pv.parkedBroadside = false;
          const angFromPlayer = Math.atan2(pos.x - playerPos.x, pos.z - playerPos.z);
          const holdX = playerPos.x + Math.sin(angFromPlayer) * standoffRadius;
          const holdZ = playerPos.z + Math.cos(angFromPlayer) * standoffRadius;
          if (dist > 48.0 || blockedToPlayer) {
            const wp = updateAStarWaypointTarget(graph, pv, i, dt, pos, holdX, holdZ);
            steerX = wp.x;
            steerZ = wp.z;
          } else {
            steerX = holdX;
            steerZ = holdZ;
          }
        }
      } else {
        pv.parkedBroadside = false;
        if (
          this.stars >= 2 && !pv.deployedTroops && !pv.isTank &&
          dist < 30.0 && playerSpeedAbs < 9.0 && pv.pursuitEngageTime >= 5.0 &&
          Math.abs(playerPos.y - pos.y) < 5.5
        ) {
          deployShelteredFootOfficers(this, pv, pos, playerPos, dist);
        }

        const tac = computeVehicleTacticalTarget(this, pv, pv.tacticalSlot || 0, pos, playerPos, vehFrame);
        pv.tacticalTarget = { x: tac.x, z: tac.z, mode: tac.mode };
        tacticalMode = tac.mode;
        if (dist > 48.0 || blockedToPlayer) {
          const wp = updateAStarWaypointTarget(graph, pv, i, dt, pos, playerPos.x, playerPos.z);
          steerX = wp.x;
          steerZ = wp.z;
        } else {
          steerX = tac.x;
          steerZ = tac.z;
        }
      }

      const canUseCatchup = dist > 55.0 && !this.isEscaping && !blockedToPlayer && !inUnderground && !pv.isTank;
      const effectiveMaxSpd = canUseCatchup
        ? pv.maxSpeed * (1.0 + DISPATCH_RULES.maxCatchupBonus)
        : pv.maxSpeed;
      let desiredSpd = effectiveMaxSpd;

      if (broadsideStop) {
        const angleToPlayer = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
        const desiredParkHeading = wrapAnglePi(angleToPlayer + (i % 2 === 0 ? 1.35 : -1.35));
        const parkDiff = wrapAnglePi(desiredParkHeading - pv.heading);
        pv.heading = wrapAnglePi(pv.heading + THREE.MathUtils.clamp(parkDiff, -3.8 * dt, 3.8 * dt));
        pv.speed = THREE.MathUtils.lerp(pv.speed, 0, Math.min(1, dt * 8.5));
        if (pv.speed < 0.35) pv.speed = 0;
        pv.driftSlip = THREE.MathUtils.lerp(pv.driftSlip || 0, 0, Math.min(1, dt * 8.0));
      } else {
        const angleDiff = wrapAnglePi(Math.atan2(steerX - pos.x, steerZ - pos.z) - pv.heading);
        const maxTurnRate = pv.isTank ? 1.85 : (pv.role === 'bope_heavy' ? 2.85 : 3.65);
        pv.heading = wrapAnglePi(pv.heading + THREE.MathUtils.clamp(angleDiff, -maxTurnRate * dt, maxTurnRate * dt));

        if (this.isEscaping) desiredSpd = pv.maxSpeed * 0.68;
        else if (pv.isTank && !playerCar && dist <= standoffRadius && !blockedToPlayer) desiredSpd = 0;
        else if (tacticalMode === 'box_front' && dist < 11.0 && playerCar) {
          desiredSpd = Math.min(effectiveMaxSpd, Math.max(8.0, playerSpeedAbs * 0.92));
        }

        const absTurn = Math.abs(angleDiff);
        if (absTurn > 0.55) {
          const cornerCap = pv.isTank ? 12.5 : THREE.MathUtils.lerp(21.0, 16.0, Math.min(1, (absTurn - 0.55) / 1.0));
          desiredSpd = Math.min(desiredSpd, cornerCap);
          const slipTarget = pv.isTank
            ? 0
            : THREE.MathUtils.clamp(angleDiff * 0.22, -0.22, 0.22) * THREE.MathUtils.clamp(pv.speed / 20.0, 0, 1);
          pv.driftSlip = THREE.MathUtils.lerp(pv.driftSlip || 0, slipTarget, Math.min(1, dt * 7.5));
          pv.speed = THREE.MathUtils.lerp(pv.speed, desiredSpd, Math.min(1, dt * 6.2));
        } else {
          pv.driftSlip = THREE.MathUtils.lerp(pv.driftSlip || 0, 0, Math.min(1, dt * 6.0));
          const accelRate = desiredSpd < pv.speed ? 6.0 : (pv.isTank ? 2.6 : 3.8);
          pv.speed = THREE.MathUtils.lerp(pv.speed, desiredSpd, Math.min(1, dt * accelRate));
        }
        pv.speed = THREE.MathUtils.clamp(pv.speed, 0, effectiveMaxSpd);
      }

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

      if (stepDist > 1e-4 && isStepBlocked(nextX, nextZ)) {
        pv.stuckTimer = (pv.stuckTimer || 0) + dt;
        const steerAngles = [pv.heading + 0.65, pv.heading - 0.65, pv.heading + Math.PI * 0.5, pv.heading - Math.PI * 0.5];
        let foundClear = false;
        for (let a = 0; a < steerAngles.length; a++) {
          const candAng = steerAngles[a];
          const cx = pos.x + Math.sin(candAng) * Math.max(2.2, stepDist);
          const cz = pos.z + Math.cos(candAng) * Math.max(2.2, stepDist);
          if (!isStepBlocked(cx, cz)) {
            pv.heading = wrapAnglePi(candAng);
            pos.x += Math.sin(candAng) * stepDist * 0.85;
            pos.z += Math.cos(candAng) * stepDist * 0.85;
            pos.y = resolveY(pos.x, pos.z);
            foundClear = true;
            break;
          }
        }
        if (!foundClear) {
          pv.heading = wrapAnglePi(pv.heading + (i % 2 === 0 ? 1 : -1) * 1.15);
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
        pv.heading = wrapAnglePi(pv.heading + (i % 2 === 0 ? 1 : -1) * 1.35);
        pv.stuckTimer = 0;
        pv.repathTimer = 0;
      }

      mesh.rotation.y = pv.heading + (pv.driftSlip || 0);
      carObj.basePos.copy(pos);
      carObj.groundY = pos.y;
      if (pv.col) {
        const hw = pv.isTank ? 1.7 : 1.3;
        const hd = pv.isTank ? 2.9 : 2.4;
        const colH = pv.isTank ? 2.5 : 1.8;
        Object.assign(pv.col, { minX: pos.x - hw, maxX: pos.x + hw, minZ: pos.z - hd, maxZ: pos.z + hd, minY: pos.y, maxY: pos.y + colH });
      }

      handleVehicleContactManeuvers(this, pv, pos, playerPos, dist, controller, vehFrame);
      tickArmyTankCannon(this, pv, dt, pos, playerPos, dist, blockedToPlayer, controller, vehFrame);
    }
  }
};
