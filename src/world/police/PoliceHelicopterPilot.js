import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';
import { attachVehicleOccupants } from '../vehicles/VehicleOccupants.js';

// ============================================================================
// PILOTO DO HELICÓPTERO POLICIAL "ÁGUIA" (ESTILO GTA V POLICE MAVERICK)
// Física real limitada a 55 m/s, decolagem de helipontos reais (>= 135m),
// desvio de arranha-céus, cone de busca de 40m e espiral sobre última posição.
// ============================================================================
export const POLICE_HELIPAD_BASES = [
  { id: 'central_precinct', x: 0, y: 54, z: -88 },
  { id: 'west_airbase', x: -690, y: 28, z: -80 },
  { id: 'east_port', x: 420, y: 34, z: 120 },
  { id: 'north_precinct', x: -80, y: 32, z: -540 },
  { id: 'prison_island', x: 720, y: 38, z: 520 }
];

const HELI_MAX_SPEED = 55.0; // ~198 km/h (carros rápidos e jatos conseguem despistar)
const HELI_MAX_ACCEL = 26.0;
const HELI_MAX_TURN_RATE = 1.65; // rad/s
const HELI_GROUND_CONE_RADIUS = 40.0;
const HELI_ACQUIRE_WINDOW = 58.0;
const HELI_MAX_VISUAL_RANGE = 195.0;
const HELI_SPOTLIGHT_SLEW_SPEED = 62.0;
const HELI_FUEL_SEARCH_LIMIT = 180.0; // 3 minutos sem visual -> retorna à base
const HELI_SHOT_DOWN_COOLDOWN = 28.0;
const MIN_BASE_SPAWN_DIST = 135.0;
export const MIN_HELI_SPACING = 32.0;
const DOWN_AXIS = new THREE.Vector3(0, -1, 0);
const BEAM_ORIGIN_SCRATCH = new THREE.Vector3();
const BEAM_VEC_SCRATCH = new THREE.Vector3();

function wrapAnglePi(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function syncEagleHeliAlias(sys) {
  if (!Array.isArray(sys.policeHelicopters)) sys.policeHelicopters = [];
  sys.eagleHeli = sys.policeHelicopters[0] || null;
}

export function pickPoliceHelipadBase(playerPos, existingHelis = []) {
  const px = playerPos?.x ?? 0;
  const pz = playerPos?.z ?? 0;
  const ranked = POLICE_HELIPAD_BASES
    .map((base) => ({ base, dist: Math.hypot(base.x - px, base.z - pz) }))
    .sort((a, b) => a.dist - b.dist);
  const validFar = ranked.filter((entry) => entry.dist >= MIN_BASE_SPAWN_DIST);
  const pool = validFar.length > 0 ? validFar : [ranked[ranked.length - 1]];
  const unoccupied = pool.find(({ base }) =>
    !existingHelis.some(
      (h) => h?.mesh && !h.obj?.destroyed && Math.hypot(h.mesh.position.x - base.x, h.mesh.position.z - base.z) < 34.0
    )
  );
  return (unoccupied || pool[0]).base;
}

function isPlayerHiddenFromHelicopter(sys, playerPos, controller) {
  return (
    Boolean(sys._isPlayerInUndergroundTunnel?.(playerPos)) ||
    Boolean(sys._isPlayerUnderViaduct?.(playerPos)) ||
    Boolean(sys._isInsideCoveredGarage?.(playerPos)) ||
    (controller?.stealthTimer || 0) > 0 ||
    Boolean(controller?.operatorAbilities?.isStealthed?.())
  );
}

function computeSkyscraperAvoidance(sys, heli, hx, hz, fwdX, fwdZ, baseCruiseY) {
  const buildings = sys.world?.mapBuildings;
  let avoidX = 0, avoidZ = 0, climbY = baseCruiseY;
  if (!Array.isArray(buildings) || buildings.length === 0) return { avoidX, avoidZ, desiredY: climbY };
  const lookX = hx + fwdX * 18.0, lookZ = hz + fwdZ * 18.0, curY = heli.mesh.position.y;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const roofY = b.height || 10;
    if (roofY <= curY - 8.0) continue;
    const hw = (b.w || 16) * 0.5, hd = (b.d || 16) * 0.5;
    if (Math.abs(hx - b.x) > hw + 30.0 || Math.abs(hz - b.z) > hd + 30.0) continue;
    const distNow = Math.hypot(hx - THREE.MathUtils.clamp(hx, b.x - hw, b.x + hw), hz - THREE.MathUtils.clamp(hz, b.z - hd, b.z + hd));
    const distAhead = Math.hypot(lookX - THREE.MathUtils.clamp(lookX, b.x - hw, b.x + hw), lookZ - THREE.MathUtils.clamp(lookZ, b.z - hd, b.z + hd));
    if (distNow > 26.0 && distAhead > 24.0) continue;
    if (roofY <= baseCruiseY + 22.0) climbY = Math.max(climbY, roofY + 10.0);
    const fromCenterX = hx - b.x, fromCenterZ = hz - b.z;
    const centerLen = Math.max(0.001, Math.hypot(fromCenterX, fromCenterZ));
    const normX = fromCenterX / centerLen, normZ = fromCenterZ / centerLen;
    const tangSign = normX * fwdZ - normZ * fwdX >= 0 ? 1 : -1;
    const proximity = 1.0 - Math.min(26.0, Math.min(distNow, distAhead)) / 26.0;
    const pushWeight = 42.0 * (0.35 + proximity * 0.95);
    avoidX += (normX * 0.65 - normZ * tangSign * 0.75) * pushWeight;
    avoidZ += (normZ * 0.65 + normX * tangSign * 0.75) * pushWeight;
    if (distNow < 3.5 && roofY > curY - 4.0) {
      heli.mesh.position.x = b.x + normX * (Math.max(hw, hd) + 3.8);
      heli.mesh.position.z = b.z + normZ * (Math.max(hw, hd) + 3.8);
    }
  }
  return { avoidX, avoidZ, desiredY: climbY };
}

function getEstimatedPlayerSpeed(sys, controller) {
  if (typeof controller?.getHorizontalSpeed === 'function') return controller.getHorizontalSpeed();
  if (controller?.currentVehicle) return Math.abs(controller.vehicleSpeed || 0);
  if (controller?.velocity) return Math.hypot(controller.velocity.x || 0, controller.velocity.z || 0);
  return sys._lastMoveSpeed || 0;
}

function disposeHelicopterSpotlight(sys, heli) {
  if (!heli) return;
  for (const m of [heli.coneMesh, heli.discMesh]) {
    if (!m) continue;
    m.visible = false;
    if (m.parent) m.parent.remove(m);
    else sys?.scene?.remove?.(m);
  }
  if (!heli._spotlightDisposed) {
    heli._spotlightDisposed = true;
    if (heli.coneMat && heli.coneMat !== sys?.mats?.spotlightCone) heli.coneMat.dispose?.();
    if (heli.discMat && heli.discMat !== sys?.mats?.spotlightDisc) heli.discMat.dispose?.();
  }
}

function computePeerHeliRepulsion(sys, heli, heliIndex, hx, hz) {
  let steerX = 0, steerZ = 0, pushVx = 0, pushVz = 0, closeNormX = 0, closeNormZ = 0, closeFactor = 0;
  const helis = sys.policeHelicopters;
  if (!Array.isArray(helis) || helis.length < 2) {
    return { steerX, steerZ, pushVx, pushVz, closeNormX, closeNormZ, closeFactor };
  }
  for (let j = 0; j < helis.length; j++) {
    if (j === heliIndex) continue;
    const other = helis[j];
    if (!other || other === heli || other.obj?.destroyed || other.retreatingToBase || !other.mesh?.position) continue;
    const dx = hx - other.mesh.position.x;
    const dz = hz - other.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= 40.0) continue;

    const nx = dist > 1e-4 ? dx / dist : Math.cos(heliIndex * Math.PI);
    const nz = dist > 1e-4 ? dz / dist : Math.sin(heliIndex * Math.PI);
    const steerWeight = 48.0 * (1.0 - dist / 40.0) + (dist < MIN_HELI_SPACING ? 58.0 * (1.0 - dist / MIN_HELI_SPACING) : 0);
    steerX += (nx * 0.8 - nz * 0.42) * steerWeight;
    steerZ += (nz * 0.8 + nx * 0.42) * steerWeight;

    if (dist < MIN_HELI_SPACING) {
      const closeness = 1.0 - dist / MIN_HELI_SPACING;
      const accel = 26.0 + closeness * 48.0;
      pushVx += nx * accel;
      pushVz += nz * accel;
      if (closeness > closeFactor) {
        closeFactor = closeness;
        closeNormX = nx;
        closeNormZ = nz;
      }
    }
  }
  return { steerX, steerZ, pushVx, pushVz, closeNormX, closeNormZ, closeFactor };
}

export function spawnPoliceHelicopter(sys, playerPos) {
  syncEagleHeliAlias(sys);
  if (sys.eagleHeliRespawnCooldown > 0) return null;
  for (let i = sys.policeHelicopters.length - 1; i >= 0; i--) {
    if (sys.policeHelicopters[i]?.obj?.destroyed) sys.policeHelicopters.splice(i, 1);
  }

  const maxHelis = sys.stars >= 4 ? 2 : 1;
  if (sys.policeHelicopters.length >= maxHelis) {
    syncEagleHeliAlias(sys);
    return sys.policeHelicopters[0] || null;
  }

  const refPos = playerPos || sys._lastPlayerPos || new THREE.Vector3(0, 0.5, -220);
  const base = pickPoliceHelipadBase(refPos, sys.policeHelicopters);
  const G = getSharedPursuitGeos();

  const heliGroup = new THREE.Group();
  heliGroup.rotation.order = 'YXZ';
  heliGroup.userData.skipStaticMerge = true;
  heliGroup.position.set(base.x, base.y, base.z);
  const initialHeading = Math.atan2(refPos.x - base.x, refPos.z - base.z);
  heliGroup.rotation.y = initialHeading;

  const hull = new THREE.Mesh(G.heliHullGeo, sys.mats.policeBlack);
  hull.castShadow = true;
  const canopy = new THREE.Mesh(G.heliCanopyGeo, sys.mats.heliGlass);
  const rotor = new THREE.Mesh(G.heliRotorGeo, sys.mats.gunSteel);
  rotor.position.set(0, 1.25, 0.35);
  const strobeRed = new THREE.Mesh(G.lightbarRedGeo, sys.mats.strobeRedOn);
  strobeRed.position.set(-0.6, -1.05, 1.6);
  const strobeBlue = new THREE.Mesh(G.lightbarBlueGeo, sys.mats.strobeBlueOn);
  strobeBlue.position.set(0.6, -1.05, 1.6);
  heliGroup.add(hull, canopy, rotor, strobeRed, strobeBlue);
  sys.scene.add(heliGroup);

  const coneMat = sys.mats.spotlightCone.clone();
  const discMat = sys.mats.spotlightDisc.clone();
  const coneMesh = new THREE.Mesh(G.spotlightConeGeo, coneMat);
  coneMesh.visible = false;
  const discMesh = new THREE.Mesh(G.spotlightDiscGeo, discMat);
  discMesh.visible = false;
  sys.scene.add(coneMesh, discMesh);

  const obj = sys.destructibles.registerDestructible({
    mesh: heliGroup, type: 'police_helicopter', hp: 260, radius: 3.6, height: 3.2, colliders: [],
    debrisColors: [0x111827, LEGO_COLORS.white, 0x38bdf8, 0xf59e0b],
    studDrops: { silver: 0, gold: 12, blue: 8, purple: 2 },
    groundY: 0, isPoliceUnit: true, noAutoRespawn: true
  });
  attachVehicleOccupants(obj, { source: 'police_heli', vehicleKind: 'police_helicopter' });

  const initLookX = base.x + Math.sin(initialHeading) * 26.0;
  const initLookZ = base.z + Math.cos(initialHeading) * 26.0;
  const initLookY = sys.world?.getTerrainHeightAt ? sys.world.getTerrainHeightAt(initLookX, initLookZ) : 0;
  if (sys._lastKnownPlayerPos && sys._lastKnownPlayerPos.lengthSq() < 0.001 && refPos) {
    sys._lastKnownPlayerPos.copy(refPos);
  }
  if (typeof sys._heliOrbitPhase !== 'number') sys._heliOrbitPhase = 0.4;

  const heli = {
    mesh: heliGroup, hull, canopy, rotor, strobeRed, strobeBlue,
    coneMesh, discMesh, coneMat, discMat, _spotlightDisposed: false, _coneOpacityInit: false, obj,
    vel: new THREE.Vector3(0, 0, 0), heading: initialHeading,
    maxSpeed: HELI_MAX_SPEED, maxAccel: HELI_MAX_ACCEL, maxTurnRate: HELI_MAX_TURN_RATE,
    groundConeRadius: HELI_GROUND_CONE_RADIUS,
    lookGroundPos: new THREE.Vector3(initLookX, initLookY + 0.08, initLookZ),
    hasVisual: false, arrivingFromBase: true, searchTimer: 0, fuelSearchElapsed: 0, retreatingToBase: false,
    baseOrigin: { id: base.id, x: base.x, y: base.y, z: base.z },
    orbitPhase: sys._heliOrbitPhase, shootTimer: 1.55, pitchAngle: 0, rollAngle: 0
  };

  obj.onShattered = () => {
    disposeHelicopterSpotlight(sys, heli);
    if (Array.isArray(sys.policeHelicopters)) {
      const idx = sys.policeHelicopters.indexOf(heli);
      if (idx !== -1) sys.policeHelicopters.splice(idx, 1);
    }
    syncEagleHeliAlias(sys);
    sys.eagleHeliRespawnCooldown = HELI_SHOT_DOWN_COOLDOWN;
  };

  sys.policeHelicopters.push(heli);
  syncEagleHeliAlias(sys);
  return heli;
}

export function removeSinglePoliceHelicopter(sys, heli) {
  if (!heli) return;
  disposeHelicopterSpotlight(sys, heli);
  if (heli.obj) {
    heli.obj.onShattered = null;
    sys.destructibles?.unregisterDestructible?.(heli.obj);
  } else if (heli.mesh?.parent) {
    heli.mesh.parent.remove(heli.mesh);
  }
  if (Array.isArray(sys.policeHelicopters)) {
    const idx = sys.policeHelicopters.indexOf(heli);
    if (idx !== -1) sys.policeHelicopters.splice(idx, 1);
  }
  syncEagleHeliAlias(sys);
}

export function clearAllPoliceHelicopters(sys) {
  syncEagleHeliAlias(sys);
  for (let i = sys.policeHelicopters.length - 1; i >= 0; i--) {
    removeSinglePoliceHelicopter(sys, sys.policeHelicopters[i]);
  }
  sys.policeHelicopters.length = 0;
  sys.eagleHeli = null;
  sys._heliOrbitPhase = 0.4;
}

export function removeEagleHelicopter(sys, targetHeli = null) {
  if (targetHeli) removeSinglePoliceHelicopter(sys, targetHeli);
  else clearAllPoliceHelicopters(sys);
}

function refreshHeliVisualState(sys, heli, playerPos, controller) {
  const pos = heli.mesh.position;
  const hiddenFromAir = isPlayerHiddenFromHelicopter(sys, playerPos, controller);
  heli._hiddenFromAir = hiddenFromAir;
  const isActivePursuit = sys.pursuitState ? sys.pursuitState === 'PURSUIT' : !sys.isEscaping;
  const horizDistToPlayer = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
  const distPlayerToCone = Math.hypot(heli.lookGroundPos.x - playerPos.x, heli.lookGroundPos.z - playerPos.z);

  if (heli.retreatingToBase || hiddenFromAir || horizDistToPlayer > HELI_MAX_VISUAL_RANGE) {
    if (hiddenFromAir) heli.arrivingFromBase = false;
    heli.hasVisual = false;
  } else if (heli.hasVisual) {
    heli.hasVisual = distPlayerToCone <= heli.groundConeRadius;
  } else if (distPlayerToCone <= heli.groundConeRadius) {
    heli.hasVisual = true;
    heli.arrivingFromBase = false;
  } else if (heli.arrivingFromBase && isActivePursuit && horizDistToPlayer <= HELI_ACQUIRE_WINDOW) {
    heli.hasVisual = true;
    heli.arrivingFromBase = false;
    const toPx = playerPos.x - heli.lookGroundPos.x;
    const toPz = playerPos.z - heli.lookGroundPos.z;
    const toPLen = Math.hypot(toPx, toPz);
    if (toPLen > heli.groundConeRadius * 0.7) {
      const pullRatio = (toPLen - heli.groundConeRadius * 0.65) / toPLen;
      heli.lookGroundPos.x += toPx * pullRatio;
      heli.lookGroundPos.z += toPz * pullRatio;
    }
  }
}

function stepSingleHelicopter(sys, heli, heliIndex, activeCount, subDt, playerPos) {
  const pos = heli.mesh.position;
  const phaseOffset = heliIndex * Math.PI;
  let goalX, goalZ, desiredLookX, desiredLookZ;

  if (heli.retreatingToBase) {
    goalX = heli.baseOrigin.x;
    goalZ = heli.baseOrigin.z;
    desiredLookX = pos.x + Math.sin(heli.heading) * 22.0;
    desiredLookZ = pos.z + Math.cos(heli.heading) * 22.0;
  } else if (heli.hasVisual) {
    heli.fuelSearchElapsed = 0;
    heli.searchTimer = 0;
    if (sys._lastKnownPlayerPos) sys._lastKnownPlayerPos.copy(playerPos);
    const orbitAngle = heli.orbitPhase + phaseOffset;
    const orbitRadius = activeCount > 1 ? 28.0 : 22.0;
    const lookSpread = activeCount > 1 ? 6.5 : 0.0;
    goalX = playerPos.x + Math.cos(orbitAngle) * orbitRadius;
    goalZ = playerPos.z + Math.sin(orbitAngle) * orbitRadius;
    desiredLookX = playerPos.x + Math.cos(orbitAngle) * lookSpread;
    desiredLookZ = playerPos.z + Math.sin(orbitAngle) * lookSpread;
  } else {
    heli.fuelSearchElapsed += subDt;
    if (heli.fuelSearchElapsed >= HELI_FUEL_SEARCH_LIMIT) heli.retreatingToBase = true;
    heli.searchTimer += subDt;
    const centerOffset = activeCount > 1 ? 14.0 : 0.0;
    const lkx = (sys._lastKnownPlayerPos ? sys._lastKnownPlayerPos.x : playerPos.x) + Math.cos(phaseOffset) * centerOffset;
    const lkz = (sys._lastKnownPlayerPos ? sys._lastKnownPlayerPos.z : playerPos.z) + Math.sin(phaseOffset) * centerOffset;
    const spiralRadius = 18.0 + ((heli.searchTimer * 4.2) % 85.0);
    const spiralAngle = heli.orbitPhase + phaseOffset + heli.searchTimer * 0.55;
    goalX = lkx + Math.cos(spiralAngle) * spiralRadius;
    goalZ = lkz + Math.sin(spiralAngle) * spiralRadius;
    const distToSpiral = Math.hypot(goalX - pos.x, goalZ - pos.z);
    const useLead = heli.arrivingFromBase && distToSpiral > 85.0;
    desiredLookX = useLead ? pos.x + ((goalX - pos.x) / distToSpiral) * 28.0 : goalX;
    desiredLookZ = useLead ? pos.z + ((goalZ - pos.z) / distToSpiral) * 28.0 : goalZ;
  }

  const localGroundY = sys.world?.getTerrainHeightAt ? sys.world.getTerrainHeightAt(pos.x, pos.z) : 0;
  let baseDesiredY = localGroundY + 44.0 + (heliIndex % 2) * 9.0;
  if (heli.hasVisual && !heli._hiddenFromAir && playerPos.y > localGroundY + 10.0) {
    baseDesiredY = Math.max(baseDesiredY, playerPos.y + 34.0 + (heliIndex % 2) * 9.0);
  }

  const { avoidX, avoidZ, desiredY } = computeSkyscraperAvoidance(
    sys, heli, pos.x, pos.z, Math.sin(heli.heading), Math.cos(heli.heading), baseDesiredY
  );
  const peer = computePeerHeliRepulsion(sys, heli, heliIndex, pos.x, pos.z);
  const totalAvoidX = avoidX + peer.steerX;
  const totalAvoidZ = avoidZ + peer.steerZ;

  const distToGoal = Math.hypot(goalX - pos.x, goalZ - pos.z);
  const headingErr = wrapAnglePi(Math.atan2(goalX - pos.x + totalAvoidX, goalZ - pos.z + totalAvoidZ) - heli.heading);
  const maxTurnStep = heli.maxTurnRate * subDt;
  const appliedTurn = THREE.MathUtils.clamp(headingErr, -maxTurnStep, maxTurnStep);
  heli.heading = wrapAnglePi(heli.heading + appliedTurn);
  const actualTurnRate = appliedTurn / Math.max(1e-4, subDt);

  const alignFactor = Math.max(0.35, Math.cos(Math.min(Math.PI * 0.65, Math.abs(headingErr))));
  const rawTargetSpeed = distToGoal > 36.0 ? heli.maxSpeed : Math.min(heli.maxSpeed, Math.max(11.0, distToGoal * 1.45));
  const desiredHorizSpeed = Math.min(heli.maxSpeed, rawTargetSpeed * alignFactor);

  const desiredVx = Math.sin(heli.heading) * desiredHorizSpeed;
  const desiredVz = Math.cos(heli.heading) * desiredHorizSpeed;
  const dvX = desiredVx - heli.vel.x;
  const dvZ = desiredVz - heli.vel.z;
  const dvLen = Math.hypot(dvX, dvZ);
  const maxDv = heli.maxAccel * subDt;
  if (dvLen > maxDv && dvLen > 1e-5) {
    heli.vel.x += (dvX / dvLen) * maxDv;
    heli.vel.z += (dvZ / dvLen) * maxDv;
  } else {
    heli.vel.x = desiredVx;
    heli.vel.z = desiredVz;
  }

  if (peer.closeFactor > 0) {
    const inwardDot = heli.vel.x * peer.closeNormX + heli.vel.z * peer.closeNormZ;
    if (inwardDot < 0) {
      const damp = Math.min(1.0, peer.closeFactor * 1.7);
      heli.vel.x -= peer.closeNormX * inwardDot * damp;
      heli.vel.z -= peer.closeNormZ * inwardDot * damp;
    }
    heli.vel.x += peer.pushVx * subDt;
    heli.vel.z += peer.pushVz * subDt;
  }

  // Hard-cap estrito: velocidade horizontal NUNCA ultrapassa 55.0 m/s!
  const horizSpeed = Math.hypot(heli.vel.x, heli.vel.z);
  if (horizSpeed > heli.maxSpeed) {
    heli.vel.x *= heli.maxSpeed / horizSpeed;
    heli.vel.z *= heli.maxSpeed / horizSpeed;
  }

  heli.vel.y = THREE.MathUtils.lerp(heli.vel.y, THREE.MathUtils.clamp((desiredY - pos.y) * 2.2, -18.0, 22.0), Math.min(1, subDt * 4.5));
  pos.x += heli.vel.x * subDt;
  pos.y += heli.vel.y * subDt;
  pos.z += heli.vel.z * subDt;
  heli.obj.basePos.copy(pos);

  const lookDx = desiredLookX - heli.lookGroundPos.x;
  const lookDz = desiredLookZ - heli.lookGroundPos.z;
  const lookDist = Math.hypot(lookDx, lookDz);
  const maxLookStep = HELI_SPOTLIGHT_SLEW_SPEED * subDt;
  if (lookDist > maxLookStep && lookDist > 1e-5) {
    heli.lookGroundPos.x += (lookDx / lookDist) * maxLookStep;
    heli.lookGroundPos.z += (lookDz / lookDist) * maxLookStep;
  } else {
    heli.lookGroundPos.x = desiredLookX;
    heli.lookGroundPos.z = desiredLookZ;
  }
  const spotGroundY = sys.world?.getSurfaceHeightAt
    ? sys.world.getSurfaceHeightAt(heli.lookGroundPos.x, heli.lookGroundPos.z, playerPos.y)
    : (sys.world?.getTerrainHeightAt ? sys.world.getTerrainHeightAt(heli.lookGroundPos.x, heli.lookGroundPos.z) : 0);
  heli.lookGroundPos.y = spotGroundY + 0.08;

  const finalHorizSpeed = Math.hypot(heli.vel.x, heli.vel.z);
  const targetPitch = -THREE.MathUtils.clamp(finalHorizSpeed / heli.maxSpeed, 0, 1) * 0.18;
  const targetRoll = THREE.MathUtils.clamp(-actualTurnRate / heli.maxTurnRate, -1, 1) * 0.24;
  heli.pitchAngle = THREE.MathUtils.lerp(heli.pitchAngle || 0, targetPitch, Math.min(1, subDt * 6.0));
  heli.rollAngle = THREE.MathUtils.lerp(heli.rollAngle || 0, targetRoll, Math.min(1, subDt * 6.0));
  heli.mesh.rotation.set(heli.pitchAngle, heli.heading, heli.rollAngle, 'YXZ');
}

export function updatePoliceHelicopters(sys, dt, playerPos, controller) {
  syncEagleHeliAlias(sys);
  if (sys.policeHelicopters.length === 0 || !playerPos) return;

  const safeDt = Math.max(0, dt);
  const subSteps = Math.min(120, Math.max(1, Math.ceil(safeDt / 0.1)));
  const subDt = safeDt > 0 ? safeDt / subSteps : 0;
  const redPhase = Math.sin((sys._strobeClock || 0) * 1.2) > 0;
  const nightFactor = sys.world?.atmosphere?.nightFactor ?? 0;
  const playerSpeed = getEstimatedPlayerSpeed(sys, controller);

  for (let i = sys.policeHelicopters.length - 1; i >= 0; i--) {
    const heli = sys.policeHelicopters[i];
    if (!heli || heli.obj?.destroyed) {
      if (heli) removeSinglePoliceHelicopter(sys, heli);
      sys.eagleHeliRespawnCooldown = Math.max(sys.eagleHeliRespawnCooldown || 0, HELI_SHOT_DOWN_COOLDOWN);
      continue;
    }
    heli.rotor.rotation.y += safeDt * 28.0;
    heli.strobeRed.material = redPhase ? sys.mats.strobeRedOn : sys.mats.strobeOff;
    heli.strobeBlue.material = !redPhase ? sys.mats.strobeBlueOn : sys.mats.strobeOff;
  }

  const helis = sys.policeHelicopters;
  if (helis.length === 0) {
    syncEagleHeliAlias(sys);
    return;
  }

  for (let s = 0; subDt > 0 && s < subSteps; s++) {
    let anyHasVisual = false;
    for (let i = 0; i < helis.length; i++) {
      refreshHeliVisualState(sys, helis[i], playerPos, controller);
      if (helis[i].hasVisual && !helis[i].retreatingToBase) anyHasVisual = true;
    }
    if (anyHasVisual) {
      if (helis.length === 1) {
        helis[0].orbitPhase += subDt * 0.55;
        sys._heliOrbitPhase = helis[0].orbitPhase;
      } else {
        sys._heliOrbitPhase = (typeof sys._heliOrbitPhase === 'number' ? sys._heliOrbitPhase : (helis[0].orbitPhase || 0.4)) + subDt * 0.55;
        for (let i = 0; i < helis.length; i++) helis[i].orbitPhase = sys._heliOrbitPhase;
      }
    }
    for (let i = 0; i < helis.length; i++) {
      stepSingleHelicopter(sys, helis[i], i, helis.length, subDt, playerPos);
    }
  }

  const inTunnel = Boolean(sys._isPlayerInUndergroundTunnel?.(playerPos));
  const activeSpots = helis.length;
  const spotAtten = 1.0 / Math.sqrt(Math.max(1, activeSpots));
  const camPos = controller?.camera?.position || sys.hud?._lastController?.camera?.position || null;

  for (let i = helis.length - 1; i >= 0; i--) {
    const heli = helis[i];
    const pos = heli.mesh.position;
    const horizDistToPlayer = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
    if (heli.retreatingToBase) {
      if (horizDistToPlayer > 260.0 || Math.hypot(pos.x - heli.baseOrigin.x, pos.z - heli.baseOrigin.z) < 18.0) {
        removeSinglePoliceHelicopter(sys, heli);
        continue;
      }
    }

    const showSpotlight = nightFactor > 0.16 && !heli.retreatingToBase && !inTunnel;
    const underViaduct = Boolean(sys._isPlayerUnderViaduct?.(heli.lookGroundPos));
    heli.coneMesh.visible = showSpotlight;
    heli.discMesh.visible = showSpotlight && !underViaduct;
    if (showSpotlight) {
      BEAM_ORIGIN_SCRATCH.set(pos.x, pos.y - 1.2, pos.z);
      BEAM_VEC_SCRATCH.copy(heli.lookGroundPos).sub(BEAM_ORIGIN_SCRATCH);
      const beamLen = Math.max(6.0, BEAM_VEC_SCRATCH.length());
      heli.coneMesh.position.copy(BEAM_ORIGIN_SCRATCH);
      heli.coneMesh.scale.set(3.2, beamLen, 3.2);
      heli.coneMesh.quaternion.setFromUnitVectors(DOWN_AXIS, BEAM_VEC_SCRATCH.normalize());

      const baseConeOpacity = (0.032 + nightFactor * 0.026) * spotAtten;
      const distPlayerToLook = Math.hypot(playerPos.x - heli.lookGroundPos.x, playerPos.z - heli.lookGroundPos.z);
      const distCamToLook = camPos ? Math.hypot(camPos.x - heli.lookGroundPos.x, camPos.z - heli.lookGroundPos.z) : Infinity;
      const horizDistToLook = Math.min(distPlayerToLook, distCamToLook);
      const nearFade = horizDistToLook < 6.0 ? THREE.MathUtils.smoothstep(horizDistToLook, 3.2, 6.0) : 1.0;
      const targetConeOpacity = THREE.MathUtils.lerp(Math.min(0.018, baseConeOpacity), baseConeOpacity, nearFade);
      const coneMat = heli.coneMat || heli.coneMesh.material;
      coneMat.opacity = heli._coneOpacityInit
        ? THREE.MathUtils.lerp(coneMat.opacity, targetConeOpacity, Math.min(1, safeDt * 14.0))
        : targetConeOpacity;
      heli._coneOpacityInit = true;

      heli.discMesh.position.copy(heli.lookGroundPos);
      heli.discMesh.scale.setScalar(4.2);
      const discMat = heli.discMat || heli.discMesh.material;
      discMat.opacity = (0.055 + nightFactor * 0.045) * spotAtten;
    }

    if (sys.stars >= 4 && heli.hasVisual && !sys.isEscaping && !heli.retreatingToBase) {
      heli.shootTimer -= safeDt;
      if (heli.shootTimer <= 0) {
        heli.shootTimer = 1.55;
        const spread = 1.4 + playerSpeed * 0.09 + horizDistToPlayer * 0.02;
        const muzzle = new THREE.Vector3(pos.x, pos.y - 1.3, pos.z);
        const aim = new THREE.Vector3(
          playerPos.x + (Math.random() - 0.5) * 2.0 * spread,
          playerPos.y + 1.0 + (Math.random() - 0.5) * 0.35 * spread,
          playerPos.z + (Math.random() - 0.5) * 2.0 * spread
        );
        sys._spawnPursuitProjectile(muzzle, aim, 'bullet');
      }
    }
  }
  syncEagleHeliAlias(sys);
}
