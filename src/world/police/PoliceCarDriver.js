import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { IS_SCALED_WORLD, ROAD } from '../core/WorldLayoutScale.js';
import { AgentSeparationSystem, computeDistinctArrivalSlot } from '../collision/AgentSeparation.js';
import { projectSlideVelocity2D } from '../collision/CollisionQueries.js';
import { DISPATCH_RULES, PURSUIT_WORLD_BOUNDS } from './PursuitTuning.js';
import {
  ensurePoliceRoadGraph,
  findNearestRoadNode,
  findRoadPathAStar,
  clampPointToRoadAsphalt
} from './PoliceRoadGraph.js';
import { getCameraForward2D, despawnIfLostBeyondHorizon } from './PoliceDispatchDirector.js';
import { getAliveOccupantCount, disembarkOccupants } from '../vehicles/VehicleOccupants.js';

/**
 * PoliceCarDriver.js
 * Direção policial tática (60 FPS): OBB rotacionado (`updateDynamicCollider`), sweep contínuo
 * (`sweepOrientedBox`), slide em paredes, separação (`AgentSeparationSystem`), slots distintos
 * e disciplina de meio-fio em `3x` (`±(roadWidth * 0.5 - 2.0)`) preservando as calçadas de 10m.
 */

const _sweepFrom = { x: 0, y: 0, z: 0 };
const _sweepTo = { x: 0, y: 0, z: 0 };
const _sweepOut = {};
const _obbResOut = {};
const _slideOut = { vx: 0, vz: 0, x: 0, z: 0 };
const _staticColFilter = (col) => !col.isDynamic;
const TACTICAL_LANE_OFFSETS = [-5.5, 5.5, -2.2, 2.2, -9.0, 9.0];

function wrapAnglePi(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function getObbDims(pv) {
  return pv.isTank ? { halfX: 1.85, halfZ: 3.15, colH: 2.4 } : { halfX: 1.32, halfZ: 2.45, colH: 1.85 };
}
function syncPoliceVehicleCollider(world, pv, pos) {
  const col = pv.col;
  if (!col) return;
  const { halfX, halfZ, colH } = getObbDims(pv);
  const yaw = pv.heading || 0, minY = pos.y, maxY = pos.y + colH;
  col.shapeType = 'obb';
  if (typeof world?.updateDynamicCollider === 'function') {
    world.updateDynamicCollider(col, { shapeType: 'obb', cx: pos.x, cz: pos.z, halfX, halfZ, yaw, minY, maxY });
    return;
  }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const extX = Math.abs(c) * halfX + Math.abs(s) * halfZ, extZ = Math.abs(s) * halfX + Math.abs(c) * halfZ;
  Object.assign(col, { shapeType: 'obb', isDynamic: true, cx: pos.x, cz: pos.z, halfX, halfZ, yaw, cosYaw: c, sinYaw: s, minX: pos.x - extX, maxX: pos.x + extX, minZ: pos.z - extZ, maxZ: pos.z + extZ, minY, maxY });
}
function getPlayerVehicleFrame(sys, controller) {
  const heading = controller && typeof controller.vehicleHeading === 'number' ? controller.vehicleHeading : Math.atan2(sys._playerVelDir?.x || 0, sys._playerVelDir?.z || 1);
  const fwdX = Math.sin(heading), fwdZ = Math.cos(heading);
  return { heading, fwdX, fwdZ, sideX: fwdZ, sideZ: -fwdX };
}
function computeVehicleTacticalTarget(sys, pv, slot, pos, playerPos, frame) {
  const { fwdX, fwdZ, sideX, sideZ } = frame;
  const isHeavyRammer = sys.stars >= 4 && (pv.role === 'bope_heavy' || pv.role === 'choque_pickup');
  if (pv.isTank) return { x: playerPos.x - fwdX * 18.0, z: playerPos.z - fwdZ * 18.0, mode: 'tank_standoff' };
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
  if (isHeavyRammer) return { x: playerPos.x + fwdX * 1.2, z: playerPos.z + fwdZ * 1.2, mode: 'heavy_ram' };
  const sideSign = slot === 0 ? ((pos.x - playerPos.x) * sideX + (pos.z - playerPos.z) * sideZ >= 0 ? 1 : -1) : (slot % 2 === 0 ? 1 : -1);
  return { x: playerPos.x - fwdX * 2.4 + sideX * (sideSign * 2.1), z: playerPos.z - fwdZ * 2.4 + sideZ * (sideSign * 2.1), mode: 'pit_rear' };
}
function computeSearchRingGoal(sys, graph, pv, slotIdx, activeCount, pos) {
  const lkx = sys._lastKnownPlayerPos?.x ?? sys._lastPlayerPos?.x ?? 0, lkz = sys._lastKnownPlayerPos?.z ?? sys._lastPlayerPos?.z ?? 0;
  const slot = computeDistinctArrivalSlot(lkx, lkz, slotIdx, Math.max(1, activeCount), 15.5, 7.5);
  const sectorStep = pv.searchSectorStep || 0, angle = slot.angle + (sys._searchOrbitClock || 0), radius = slot.radius + (sectorStep % 3) * 8.5;
  let gx = lkx + Math.cos(angle) * radius, gz = lkz + Math.sin(angle) * radius;
  if (sys.world?.isDeepWaterAt?.(gx, gz, { forCar: true }) || sys._isSegmentBlockedByBuilding?.(lkx, lkz, gx, gz)) {
    const node = findNearestRoadNode(graph, gx, gz, (n) => n.neighbors.length > 0);
    if (node) { const nSlot = computeDistinctArrivalSlot(node.x, node.z, slotIdx, Math.max(1, activeCount), 15.5, 7.5); gx = nSlot.x; gz = nSlot.z; }
  }
  if (IS_SCALED_WORLD) {
    const clamped = clampPointToRoadAsphalt(graph, gx, gz, 2.0);
    gx = clamped.x; gz = clamped.z;
  }
  if (Math.hypot(gx - pos.x, gz - pos.z) < 7.5) pv.searchSectorStep = sectorStep + 1;
  return { x: gx, z: gz };
}
function updateAStarWaypointTarget(graph, pv, unitIndex, dt, pos, goalX, goalZ) {
  if ((pv.repathTimer = (pv.repathTimer ?? 0) - dt) <= 0 || !Array.isArray(pv.roadPath) || pv.roadPath.length === 0) {
    pv.repathTimer = 0.95 + ((unitIndex * 0.067) % 0.2);
    pv.roadPath = findRoadPathAStar(graph, pos.x, pos.z, goalX, goalZ);
    pv.pathIndex = 0;
    if (pv.roadPath.length >= 2) {
      const w0 = pv.roadPath[0], w1 = pv.roadPath[1];
      if ((pos.x - w0.x) * (w1.x - w0.x) + (pos.z - w0.z) * (w1.z - w0.z) > 0 && Math.hypot(pos.x - w0.x, pos.z - w0.z) > 6.0) pv.pathIndex = 1;
    }
  }
  while (pv.pathIndex < pv.roadPath.length - 1 && Math.hypot(pv.roadPath[pv.pathIndex].x - pos.x, pv.roadPath[pv.pathIndex].z - pos.z) < 14.0) pv.pathIndex++;
  const wp = pv.roadPath[pv.pathIndex];
  if (!wp) return { x: goalX, z: goalZ };
  if (!IS_SCALED_WORLD) return { x: wp.x, z: wp.z };

  // Em 3x: distribui faixas táticas estritamente dentro do asfalto ±(roadWidth * 0.5 - 2.0)
  const prevWp = pv.pathIndex > 0 ? pv.roadPath[pv.pathIndex - 1] : pos;
  const segDx = wp.x - prevWp.x, segDz = wp.z - prevWp.z;
  const segLen = Math.hypot(segDx, segDz);
  const roadWidth = wp.roadWidth || ROAD.mainWidth;
  const maxLaneOff = Math.max(2.0, roadWidth * 0.5 - 2.0);
  const laneOff = THREE.MathUtils.clamp(TACTICAL_LANE_OFFSETS[unitIndex % TACTICAL_LANE_OFFSETS.length] || 0, -maxLaneOff, maxLaneOff);
  let wx = wp.x, wz = wp.z;
  if (segLen > 1.0) {
    const rightX = segDz / segLen, rightZ = -segDx / segLen;
    wx += rightX * laneOff;
    wz += rightZ * laneOff;
  }
  const safe = clampPointToRoadAsphalt(graph, wx, wz, 2.0);
  return { x: safe.x, z: safe.z };
}
function deployShelteredFootOfficers(sys, pv, pos, playerPos, dist) {
  if (pv.deployedTroops || pv.isTank || sys.stars <= 0) return;
  const aliveInside = getAliveOccupantCount(pv.carObj);
  if (aliveInside <= 0) {
    pv.deployedTroops = true;
    return;
  }
  const availableSlots = (sys._getDesiredFootCount ? sys._getDesiredFootCount() : 4) - sys.footUnits.length;
  if (availableSlots <= 0) return;
  pv.deployedTroops = true;
  const count = Math.min(availableSlots, aliveInside);
  disembarkOccupants(pv.carObj, count);
  const awayX = dist > 1e-4 ? -(playerPos.x - pos.x) / dist : -Math.sin(pv.heading);
  const awayZ = dist > 1e-4 ? -(playerPos.z - pos.z) / dist : -Math.cos(pv.heading);
  const carFwdX = Math.sin(pv.heading), carFwdZ = Math.cos(pv.heading);
  for (let k = 0; k < count; k++) {
    const along = count === 1 ? 0 : THREE.MathUtils.lerp(-0.95, 0.95, k / (count - 1));
    const sx = pos.x + awayX * 2.05 + carFwdX * along, sz = pos.z + awayZ * 2.05 + carFwdZ * along;
    const trooper = sys._spawnFootTrooper({ x: sx, y: sys.world?.getTerrainHeightAt ? sys.world.getTerrainHeightAt(sx, sz) : pos.y, z: sz }, sys.stars);
    if (trooper?.mesh) trooper.mesh.rotation.y = Math.atan2(playerPos.x - sx, playerPos.z - sz);
  }
}
function handleVehicleContactManeuvers(sys, pv, pos, playerPos, dist, controller, frame) {
  if (!controller?.currentVehicle || sys.isEscaping || dist >= 4.4 || Math.abs(playerPos.y - pos.y) >= 2.6 || pv.pitCooldown > 0) return;
  const pSpeed = controller.vehicleSpeed || 0;
  const relSpeed = Math.hypot(Math.sin(pv.heading) * pv.speed - frame.fwdX * pSpeed, Math.cos(pv.heading) * pv.speed - frame.fwdZ * pSpeed);
  const sidePush = (pos.x - playerPos.x) * frame.sideX + (pos.z - playerPos.z) * frame.sideZ >= 0 ? -1 : 1;
  const sparkPos = new THREE.Vector3((pos.x + playerPos.x) * 0.5, pos.y + 0.75, (pos.z + playerPos.z) * 0.5);
  if (pv.isTank || (sys.stars >= 4 && (pv.role === 'bope_heavy' || pv.role === 'choque_pickup'))) {
    pv.pitCooldown = 1.25; soundFX.playPlasticHit?.();
    if (typeof controller.vehicleHeading === 'number') controller.vehicleHeading += sidePush * THREE.MathUtils.clamp(0.18 + relSpeed * 0.01, 0.18, 0.44);
    if (typeof controller.vehicleSpeed === 'number') controller.vehicleSpeed *= pv.isTank ? 0.68 : 0.78;
    sys.destructibles?._spawnElectricSparks?.(sparkPos, 9);
    sys.applyPursuitDamageToPlayer?.(pv.isTank ? 26 : Math.round(12 + Math.min(14, relSpeed * 0.35)), controller, { isCollision: true });
    return;
  }
  pv.pitCooldown = 1.35; soundFX.playPlasticHit?.();
  if (sys.stars >= 2 && typeof controller.vehicleHeading === 'number') {
    const spinDelta = THREE.MathUtils.clamp(0.16 + relSpeed * 0.012, 0.18, 0.52);
    controller.vehicleHeading += sidePush * spinDelta;
    if (typeof controller.vehicleSpeed === 'number') controller.vehicleSpeed *= 0.85;
    pv.lastPitSpinApplied = spinDelta;
    sys.destructibles?._spawnElectricSparks?.(sparkPos, 7);
  } else if (typeof controller.vehicleSpeed === 'number') controller.vehicleSpeed *= 0.88;
}
function tickArmyTankCannon(sys, pv, dt, pos, playerPos, dist, blockedToPlayer, controller, frame) {
  if (!pv.isTank) return;
  const turret = pv.carObj?.mesh?.userData?.turretGroup;
  let vx = (sys._playerVelDir?.x || 0) * (sys._lastMoveSpeed || 0), vz = (sys._playerVelDir?.z || 0) * (sys._lastMoveSpeed || 0);
  if (controller?.currentVehicle) { const vSpd = controller.vehicleSpeed || 0; vx = frame.fwdX * vSpd; vz = frame.fwdZ * vSpd; }
  else if (controller?.velocity) { vx = controller.velocity.x || 0; vz = controller.velocity.z || 0; }
  const leadT = Math.min(1.35, dist / 52.0), aimX = playerPos.x + vx * leadT, aimZ = playerPos.z + vz * leadT;
  const worldAimYaw = Math.atan2(aimX - pos.x, aimZ - pos.z);
  if (turret && !sys.isEscaping) turret.rotation.y = wrapAnglePi(turret.rotation.y + THREE.MathUtils.clamp(wrapAnglePi(wrapAnglePi(worldAimYaw - pv.heading) - turret.rotation.y), -2.4 * dt, 2.4 * dt));
  if (sys.isEscaping || dist < 14.0 || dist > 125.0 || blockedToPlayer) return;
  if ((pv.cannonCooldown = (pv.cannonCooldown ?? 2.2) - dt) <= 0) {
    pv.cannonCooldown = 3.3;
    sys._spawnPursuitProjectile?.(new THREE.Vector3(pos.x + Math.sin(worldAimYaw) * 4.3, pos.y + 1.92, pos.z + Math.cos(worldAimYaw) * 4.3), new THREE.Vector3(aimX, (playerPos.y ?? 0) + 0.95, aimZ), 'tank_shell');
    soundFX.playExplosion?.(0.75);
  }
}

function stepCruiserWithWorldCollision(sys, pv, unitIdx, dt, pos, stepDist, resolveY) {
  const { halfX, halfZ, colH } = getObbDims(pv);
  const hasSweep = typeof sys.world?.sweepOrientedBox === 'function';
  const isEnvBlocked = (ax, az, bx, bz) =>
    Boolean(sys.world?.isDeepWaterAt?.(bx, bz, { forCar: true })) ||
    getMetroCutoutFloorY(bx, bz) !== null ||
    Boolean(sys._isSegmentBlockedByBuilding?.(ax, az, bx, bz));

  const trySweep = (ax, az, bx, bz, yaw) => {
    if (isEnvBlocked(ax, az, bx, bz)) return { hit: true, x: ax, z: az, t: 0, hitNormalX: 0, hitNormalZ: 0 };
    if (!hasSweep) return { hit: false, x: bx, z: bz, t: 1, hitNormalX: 0, hitNormalZ: 0 };
    _sweepFrom.x = ax; _sweepFrom.y = pos.y; _sweepFrom.z = az;
    _sweepTo.x = bx; _sweepTo.y = pos.y; _sweepTo.z = bz;
    return sys.world.sweepOrientedBox(_sweepFrom, _sweepTo, halfX, halfZ, yaw, pos.y + 0.38, pos.y + colH, {
      filter: _staticColFilter, out: _sweepOut
    });
  };

  if (stepDist <= 1e-4) {
    if (typeof sys.world?.resolveObbPenetration === 'function') {
      const r = sys.world.resolveObbPenetration(pos.x, pos.z, halfX, halfZ, pv.heading, pos.y + 0.38, pos.y + colH, { filter: _staticColFilter, out: _obbResOut });
      if (r.collided) { pos.x = r.x; pos.z = r.z; pos.y = resolveY(pos.x, pos.z); }
    }
    return;
  }

  const nextX = pos.x + Math.sin(pv.heading) * stepDist, nextZ = pos.z + Math.cos(pv.heading) * stepDist;
  const res = trySweep(pos.x, pos.z, nextX, nextZ, pv.heading);
  if (!res.hit) {
    pv.stuckTimer = Math.max(0, (pv.stuckTimer || 0) - dt * 1.5);
    pos.x = nextX; pos.z = nextZ; pos.y = resolveY(pos.x, pos.z);
    return;
  }
  const hitNx = res.hitNormalX || 0, hitNz = res.hitNormalZ || 0;
  if (hasSweep && (Math.abs(hitNx) > 1e-4 || Math.abs(hitNz) > 1e-4)) {
    const baseX = res.x, baseZ = res.z, remDist = stepDist * (1 - Math.max(0, Math.min(1, res.t ?? 0)));
    projectSlideVelocity2D(Math.sin(pv.heading), Math.cos(pv.heading), hitNx, hitNz, 0.08, _slideOut);
    if (Math.hypot(_slideOut.vx, _slideOut.vz) > 0.24) {
      const slideYaw = Math.atan2(_slideOut.vx, _slideOut.vz), d = Math.max(remDist, stepDist * 0.45);
      const sx = baseX + _slideOut.vx * d, sz = baseZ + _slideOut.vz * d;
      if (!isEnvBlocked(baseX, baseZ, sx, sz)) {
        const clamped = sys.world.resolveObbPenetration(sx, sz, halfX, halfZ, pv.heading, pos.y + 0.38, pos.y + colH, { filter: _staticColFilter, out: _obbResOut });
        pos.x = clamped.x; pos.z = clamped.z; pos.y = resolveY(pos.x, pos.z);
        pv.heading = wrapAnglePi(pv.heading + THREE.MathUtils.clamp(wrapAnglePi(slideYaw - pv.heading), -5.5 * dt, 5.5 * dt));
        pv.speed *= 0.92; pv.stuckTimer = Math.max(0, (pv.stuckTimer || 0) - dt * 0.5);
        return;
      }
    }
    pos.x = baseX; pos.z = baseZ;
  }
  pv.stuckTimer = (pv.stuckTimer || 0) + dt;
  for (const candAng of [pv.heading + 0.65, pv.heading - 0.65, pv.heading + Math.PI * 0.5, pv.heading - Math.PI * 0.5]) {
    const pDist = Math.max(2.2, stepDist);
    if (!trySweep(pos.x, pos.z, pos.x + Math.sin(candAng) * pDist, pos.z + Math.cos(candAng) * pDist, candAng).hit) {
      pv.heading = wrapAnglePi(candAng);
      pos.x += Math.sin(candAng) * stepDist * 0.85; pos.z += Math.cos(candAng) * stepDist * 0.85; pos.y = resolveY(pos.x, pos.z);
      return;
    }
  }
  pv.heading = wrapAnglePi(pv.heading + (unitIdx % 2 === 0 ? 1 : -1) * 1.15); pv.speed *= 0.45;
}

function separatePursuitVehicles(sys, playerPos, resolveY) {
  const sepSys = sys._vehicleSeparationSys || (sys._vehicleSeparationSys = new AgentSeparationSystem({ cellSize: 6.0, maxActiveDist: 165, passes: 4 }));
  const agents = sys._vehSepAgents || (sys._vehSepAgents = []);
  const pool = sys._vehSepPool || (sys._vehSepPool = []);
  agents.length = 0;
  let pIdx = 0;
  const alloc = () => pool[pIdx++] || (pool[pIdx - 1] = {});

  for (let i = 0; i < sys.pursuitVehicles.length; i++) {
    const pv = sys.pursuitVehicles[i];
    if (!pv || pv.retreating || pv.carObj?.destroyed || pv.carObj?.isDriven) continue;
    const pos = pv.carObj.mesh.position;
    const e = alloc();
    e.pv = pv; e.x = pos.x; e.y = pos.y; e.z = pos.z;
    e.radius = pv.isTank ? 3.25 : 2.35;
    e.weight = pv.isTank ? 4.5 : (pv.role === 'bope_heavy' ? 2.6 : 1.2);
    e.immovable = false;
    agents.push(e);
  }

  const traffic = sys.livingCity?.trafficVehicles;
  if (Array.isArray(traffic) && playerPos) {
    for (let t = 0; t < traffic.length; t++) {
      const tv = traffic[t];
      if (!tv?.destructible || tv.destructible.destroyed || tv.destructible.isDriven) continue;
      const tPos = tv.mesh.position;
      if ((tPos.x - playerPos.x) ** 2 + (tPos.z - playerPos.z) ** 2 > 140 * 140) continue;
      const e = alloc();
      e.pv = null; e.x = tPos.x; e.y = tPos.y; e.z = tPos.z;
      e.radius = 2.25; e.weight = 1.0; e.immovable = true;
      agents.push(e);
    }
  }
  if (agents.length < 2) return;

  const f = agents[0]?.pv ? agents[0] : null;
  const sepCenter = (sys.isEscaping && f && playerPos && Math.hypot(f.x - playerPos.x, f.z - playerPos.z) > 150 && sys._lastKnownPlayerPos)
    ? sys._lastKnownPlayerPos : playerPos;

  for (let iter = 0; iter < 2; iter++) {
    sepSys.separateAgents(agents, sepCenter);
    let clampedWall = false;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i], pv = a.pv;
      if (!pv) continue;
      if (iter === 0) { pv._avoidX = a.avoidX; pv._avoidZ = a.avoidZ; }
      if (Math.abs(a.sepPushX) < 1e-5 && Math.abs(a.sepPushZ) < 1e-5) continue;
      const pos = pv.carObj.mesh.position;
      let cx = pos.x + a.sepPushX, cz = pos.z + a.sepPushZ;
      if (sys.world?.isDeepWaterAt?.(cx, cz, { forCar: true }) || getMetroCutoutFloorY(cx, cz) !== null || sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, cx, cz)) {
        a.x = pos.x; a.z = pos.z;
        continue;
      }
      if (typeof sys.world?.resolveObbPenetration === 'function') {
        const { halfX, halfZ, colH } = getObbDims(pv);
        const r = sys.world.resolveObbPenetration(cx, cz, halfX, halfZ, pv.heading, pos.y + 0.38, pos.y + colH, { filter: _staticColFilter, out: _obbResOut });
        if (r.collided) clampedWall = true;
        cx = r.x; cz = r.z;
      }
      pos.x = cx; pos.z = cz; pos.y = resolveY(cx, cz, pos.y);
      a.x = cx; a.y = pos.y; a.z = cz;
    }
    if (!clampedWall) break;
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
    if (this.isEscaping) this._searchOrbitClock = ((this._searchOrbitClock || 0) + dt * 0.22) % (Math.PI * 2);

    const minBoundX = Math.min(PURSUIT_WORLD_BOUNDS.minX, playerPos.x - 320);
    const maxBoundX = Math.max(PURSUIT_WORLD_BOUNDS.maxX, playerPos.x + 320);
    const minBoundZ = Math.min(PURSUIT_WORLD_BOUNDS.minZ, playerPos.z - 320);
    const maxBoundZ = Math.max(PURSUIT_WORLD_BOUNDS.maxZ, playerPos.z + 320);

    const resolveY = (rx, rz, refY = 0) => this.world?.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(rx, rz, refY)
      : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(rx, rz) : 0);

    let slotCounter = 0, activeNonRetreating = 0;
    for (let s = 0; s < this.pursuitVehicles.length; s++) {
      const u = this.pursuitVehicles[s];
      if (!u || u.retreating || u.carObj?.destroyed || u.carObj?.isDriven) continue;
      activeNonRetreating++;
      if (!u.isTank) u.tacticalSlot = slotCounter++;
    }

    for (let i = this.pursuitVehicles.length - 1; i >= 0; i--) {
      const pv = this.pursuitVehicles[i], carObj = pv.carObj;
      if (!carObj || carObj.destroyed || carObj.isDriven) {
        if (carObj?.isDriven && carObj.occupants?.length) {
          disembarkOccupants(carObj, Infinity);
        }
        this.pursuitVehicles.splice(i, 1);
        continue;
      }
      carObj._aiCurrentSpeed = Math.abs(pv.speed || 0);
      const pos = carObj.mesh.position;
      const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

      if (pv.retreating) {
        pv.retreatLife -= dt;
        pos.x += Math.sin(pv.heading) * 22.0 * dt;
        pos.z += Math.cos(pv.heading) * 22.0 * dt;
        syncPoliceVehicleCollider(this.world, pv, pos);
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

      const slotIdx = pv.tacticalSlot >= 0 ? pv.tacticalSlot : i;
      const standoffRadius = pv.isTank ? 24.0 : 16.0 + (slotIdx % 3) * 1.5;
      let steerX = playerPos.x, steerZ = playerPos.z, broadsideStop = false, tacticalMode = 'direct';

      if (
        this.isEscaping && dist <= 15.0 && (!blockedToPlayer || dist <= 11.0) &&
        !inUnderground && Math.abs(playerPos.y - pos.y) < 12.0 &&
        !(controller?.stealthTimer > 0) && !controller?.operatorAbilities?.isStealthed?.()
      ) {
        this.enterPursuitState?.(playerPos);
      }

      if (this.isEscaping) {
        pv.parkedBroadside = false;
        const searchGoal = computeSearchRingGoal(this, graph, pv, slotIdx, activeNonRetreating, pos);
        pv.searchGoal = searchGoal;
        if (Math.hypot(searchGoal.x - pos.x, searchGoal.z - pos.z) > 42.0 || this._isSegmentBlockedByBuilding(pos.x, pos.z, searchGoal.x, searchGoal.z)) {
          const wp = updateAStarWaypointTarget(graph, pv, slotIdx, dt, pos, searchGoal.x, searchGoal.z);
          steerX = wp.x; steerZ = wp.z;
        } else {
          steerX = searchGoal.x; steerZ = searchGoal.z;
        }
        tacticalMode = 'search_ring';
      } else if (!playerCar && !pv.isTank) {
        const arriveSlot = computeDistinctArrivalSlot(playerPos.x, playerPos.z, slotIdx, Math.max(1, slotCounter), 15.5, 7.5);
        const angFromPlayer = Math.atan2(pos.x - playerPos.x, pos.z - playerPos.z);
        let holdX = slotCounter <= 1 ? playerPos.x + Math.sin(angFromPlayer) * arriveSlot.radius : arriveSlot.x;
        let holdZ = slotCounter <= 1 ? playerPos.z + Math.cos(angFromPlayer) * arriveSlot.radius : arriveSlot.z;
        if (IS_SCALED_WORLD) {
          const curbMargin = dist <= 22.0 ? 0.9 : 2.0;
          const safeHold = clampPointToRoadAsphalt(graph, holdX, holdZ, curbMargin);
          holdX = safeHold.x; holdZ = safeHold.z;
        }
        pv.arrivalSlot = { x: holdX, z: holdZ };
        const nearSlot = slotCounter <= 1 || dist <= 15.8 || Math.hypot(holdX - pos.x, holdZ - pos.z) <= 6.0;

        if (dist <= 20.0 && nearSlot && (!blockedToPlayer || dist <= 11.0)) {
          broadsideStop = true;
          pv.parkedBroadside = true;
          if (Math.abs(playerPos.y - pos.y) < 5.5) deployShelteredFootOfficers(this, pv, pos, playerPos, dist);
        } else {
          if (dist > 25.0) pv.parkedBroadside = false;
          if (dist > 48.0 || blockedToPlayer) {
            const wp = updateAStarWaypointTarget(graph, pv, slotIdx, dt, pos, holdX, holdZ);
            steerX = wp.x; steerZ = wp.z;
          } else {
            steerX = holdX; steerZ = holdZ;
          }
        }
      } else {
        pv.parkedBroadside = false;
        if (this.stars >= 2 && !pv.deployedTroops && !pv.isTank && dist < 30.0 && playerSpeedAbs < 9.0 && pv.pursuitEngageTime >= 5.0 && Math.abs(playerPos.y - pos.y) < 5.5) {
          deployShelteredFootOfficers(this, pv, pos, playerPos, dist);
        }
        const tac = computeVehicleTacticalTarget(this, pv, slotIdx, pos, playerPos, vehFrame);
        pv.tacticalTarget = { x: tac.x, z: tac.z, mode: tac.mode };
        tacticalMode = tac.mode;
        if (dist > 48.0 || blockedToPlayer) {
          const wp = updateAStarWaypointTarget(graph, pv, slotIdx, dt, pos, playerPos.x, playerPos.z);
          steerX = wp.x; steerZ = wp.z;
        } else if (IS_SCALED_WORLD) {
          const safeTac = clampPointToRoadAsphalt(graph, tac.x, tac.z, 2.0);
          steerX = safeTac.x; steerZ = safeTac.z;
        } else {
          steerX = tac.x; steerZ = tac.z;
        }
      }

      const engineMult = this.destructibles?.getVehicleEngineSpeedMultiplier
        ? this.destructibles.getVehicleEngineSpeedMultiplier(carObj)
        : (carObj.driverKilled ? 0 : 1.0);
      const isEmptiedCruiser = pv.deployedTroops && !pv.isTank && getAliveOccupantCount(carObj) === 0;
      const canUseCatchup = dist > 55.0 && !this.isEscaping && !blockedToPlayer && !inUnderground && !pv.isTank;
      const effectiveMaxSpd = (canUseCatchup ? pv.maxSpeed * (1.0 + DISPATCH_RULES.maxCatchupBonus) : pv.maxSpeed) * engineMult;
      let desiredSpd = effectiveMaxSpd;

      if (carObj.driverKilled || (isEmptiedCruiser && !broadsideStop)) {
        pv.speed = THREE.MathUtils.lerp(pv.speed, 0, Math.min(1, dt * 6.5));
        if (pv.speed < 0.35) pv.speed = 0;
        pv.driftSlip = THREE.MathUtils.lerp(pv.driftSlip || 0, 0, Math.min(1, dt * 6.0));
      } else if (broadsideStop) {
        const desiredParkHeading = wrapAnglePi(Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z) + (slotIdx % 2 === 0 ? 1.35 : -1.35));
        pv.heading = wrapAnglePi(pv.heading + THREE.MathUtils.clamp(wrapAnglePi(desiredParkHeading - pv.heading), -3.8 * dt, 3.8 * dt));
        pv.speed = THREE.MathUtils.lerp(pv.speed, 0, Math.min(1, dt * 8.5));
        if (pv.speed < 0.35) pv.speed = 0;
        pv.driftSlip = THREE.MathUtils.lerp(pv.driftSlip || 0, 0, Math.min(1, dt * 8.0));
      } else {
        let dirX = steerX - pos.x, dirZ = steerZ - pos.z;
        const dSteer = Math.hypot(dirX, dirZ);
        if (dSteer > 1e-4) {
          dirX /= dSteer; dirZ /= dSteer;
          if (pv._avoidX || pv._avoidZ) { dirX += pv._avoidX * 0.85; dirZ += pv._avoidZ * 0.85; }
        }
        const angleDiff = wrapAnglePi(Math.atan2(dirX, dirZ) - pv.heading);
        const maxTurnRate = pv.isTank ? 1.85 : (pv.role === 'bope_heavy' ? 2.85 : 3.65);
        pv.heading = wrapAnglePi(pv.heading + THREE.MathUtils.clamp(angleDiff, -maxTurnRate * dt, maxTurnRate * dt));

        if (this.isEscaping) desiredSpd = dSteer < 10.0 ? pv.maxSpeed * 0.42 : pv.maxSpeed * 0.68;
        else if (pv.isTank && !playerCar && dist <= standoffRadius && !blockedToPlayer) desiredSpd = 0;
        else if (tacticalMode === 'box_front' && dist < 11.0 && playerCar) desiredSpd = Math.min(effectiveMaxSpd, Math.max(8.0, playerSpeedAbs * 0.92));
        else if (IS_SCALED_WORLD && !playerCar && dist <= 24.0) desiredSpd = Math.min(desiredSpd, 11.5);

        const absTurn = Math.abs(angleDiff);
        if (absTurn > 0.55) {
          const cornerCap = pv.isTank ? 12.5 : THREE.MathUtils.lerp(21.0, 16.0, Math.min(1, (absTurn - 0.55) / 1.0));
          desiredSpd = Math.min(desiredSpd, cornerCap);
          const slipTarget = pv.isTank ? 0 : THREE.MathUtils.clamp(angleDiff * 0.22, -0.22, 0.22) * THREE.MathUtils.clamp(pv.speed / 20.0, 0, 1);
          pv.driftSlip = THREE.MathUtils.lerp(pv.driftSlip || 0, slipTarget, Math.min(1, dt * 7.5));
          pv.speed = THREE.MathUtils.lerp(pv.speed, desiredSpd, Math.min(1, dt * 6.2));
        } else {
          pv.driftSlip = THREE.MathUtils.lerp(pv.driftSlip || 0, 0, Math.min(1, dt * 6.0));
          pv.speed = THREE.MathUtils.lerp(pv.speed, desiredSpd, Math.min(1, dt * (desiredSpd < pv.speed ? 6.0 : (pv.isTank ? 2.6 : 3.8))));
        }
        pv.speed = THREE.MathUtils.clamp(pv.speed, 0, effectiveMaxSpd);
      }

      stepCruiserWithWorldCollision(this, pv, slotIdx, dt, pos, pv.speed * dt, (rx, rz) => resolveY(rx, rz, pos.y));
      if (pv.stuckTimer > 2.8) {
        pos.x -= Math.sin(pv.heading) * 3.2; pos.z -= Math.cos(pv.heading) * 3.2;
        pos.y = resolveY(pos.x, pos.z, pos.y);
        pv.heading = wrapAnglePi(pv.heading + (slotIdx % 2 === 0 ? 1 : -1) * 1.35);
        pv.stuckTimer = 0; pv.repathTimer = 0;
      }
    }

    separatePursuitVehicles(this, playerPos, resolveY);

    for (let i = 0; i < this.pursuitVehicles.length; i++) {
      const pv = this.pursuitVehicles[i];
      if (!pv || pv.retreating || pv.carObj?.destroyed || pv.carObj?.isDriven) continue;
      const pos = pv.carObj.mesh.position;
      const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
      if (IS_SCALED_WORLD && !pv.parkedBroadside && pv.speed > 7.5) {
        const curbMargin = !playerCar && dist <= 22.0 ? 0.9 : 2.0;
        const kept = clampPointToRoadAsphalt(graph, pos.x, pos.z, curbMargin);
        if (kept.clamped && !this._isSegmentBlockedByBuilding(pos.x, pos.z, kept.x, kept.z)) {
          pos.x = THREE.MathUtils.lerp(pos.x, kept.x, Math.min(1, dt * 9.0));
          pos.z = THREE.MathUtils.lerp(pos.z, kept.z, Math.min(1, dt * 9.0));
          pos.y = resolveY(pos.x, pos.z, pos.y);
        }
      }
      pos.x = THREE.MathUtils.clamp(pos.x, minBoundX, maxBoundX);
      pos.z = THREE.MathUtils.clamp(pos.z, minBoundZ, maxBoundZ);
      pv.carObj.mesh.rotation.y = pv.heading + (pv.driftSlip || 0);
      pv.carObj.basePos.copy(pos); pv.carObj.groundY = pos.y;
      syncPoliceVehicleCollider(this.world, pv, pos);
      handleVehicleContactManeuvers(this, pv, pos, playerPos, dist, controller, vehFrame);
      if (!pv.carObj.driverKilled && getAliveOccupantCount(pv.carObj) > 0) {
        tickArmyTankCannon(this, pv, dt, pos, playerPos, dist, this._isSegmentBlockedByBuilding(pos.x, pos.z, playerPos.x, playerPos.z), controller, vehFrame);
      }
    }
  }
};
