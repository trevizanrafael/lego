import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { soundFX } from '../../audio/SoundFX.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';

// ============================================================================
// BLOQUEIOS POLICIAIS PREDITIVOS (150M–245M) & TAPETE DE PREGOS (3★ A 5★)
// ============================================================================
const MAIN_AVENUES_X = [-516, -384, -252, -120, 0, 120, 252, 384, 612];
const MAIN_AVENUES_Z = [-512, -382, -252, -117, 0, 134, 384, 710];

const MIN_ROADBLOCK_DIST = 150.0;
const MAX_ROADBLOCK_DIST = 245.0;
const MAX_ACTIVE_ROADBLOCKS = 2;
const ROADBLOCK_MAX_AGE_SEC = 55.0;
const ROADBLOCK_DESPAWN_DIST = 310.0;
const SHARED_DEPLOY_CASE_GEO = new THREE.BoxGeometry(0.46, 0.24, 0.56);

function resolveSystemAndArgs(ctx, firstArg, restArgs) {
  return firstArg && Array.isArray(firstArg.roadblocks)
    ? { sys: firstArg, args: restArgs }
    : { sys: ctx, args: [firstArg, ...restArgs] };
}

function isValidRoadblockSite(sys, cx, cz, playerPos, vx, vz) {
  const dx = cx - playerPos.x;
  const dz = cz - playerPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < MIN_ROADBLOCK_DIST || dist > MAX_ROADBLOCK_DIST) return false;
  if ((dx * vx + dz * vz) / Math.max(0.001, dist) < 0.42) return false;

  for (let i = 0; i < sys.roadblocks.length; i++) {
    if (Math.hypot(sys.roadblocks[i].x - cx, sys.roadblocks[i].z - cz) < 92.0) return false;
  }

  for (const [ox, oz] of [[0, 0], [-4.5, 0], [4.5, 0], [0, -4.5], [0, 4.5]]) {
    if (getMetroCutoutFloorY(cx + ox, cz + oz) !== null) return false;
  }
  if (sys.world?.isDeepWaterAt?.(cx, cz, { forCar: true })) return false;
  if (sys._isInsideCoveredGarage?.({ x: cx, y: 0, z: cz })) return false;
  return true;
}

function findPredictiveRoadblockPlacement(sys, playerPos) {
  let vx = Number(sys._playerVelDir?.x) || 0;
  let vz = Number(sys._playerVelDir?.z) || 0;
  const vLen = Math.hypot(vx, vz);
  if (vLen < 0.05) {
    vx = 0;
    vz = 1;
  } else {
    vx /= vLen;
    vz /= vLen;
  }

  const movingMostlyZ = Math.abs(vz) >= Math.abs(vx);
  const fwdZ = vz >= 0 ? 1 : -1;
  const fwdX = vx >= 0 ? 1 : -1;
  const candidates = [];

  if (movingMostlyZ) {
    const projX = playerPos.x + vx * 165.0;
    const hitAx =
      MAIN_AVENUES_X.find((ax) => Math.abs(playerPos.x - ax) <= 28.0) ??
      MAIN_AVENUES_X.find((ax) => Math.abs(projX - ax) <= 30.0);
    const rotY = fwdZ >= 0 ? 0 : Math.PI;
    if (hitAx !== undefined) {
      for (const az of MAIN_AVENUES_Z) {
        const aheadDelta = (az - playerPos.z) * fwdZ;
        if (aheadDelta >= MIN_ROADBLOCK_DIST && aheadDelta <= MAX_ROADBLOCK_DIST) {
          candidates.push({ x: hitAx, z: az, rotY });
        }
      }
      for (const d of [165, 180, 155, 195, 215, 235]) {
        candidates.push({ x: hitAx, z: playerPos.z + fwdZ * d, rotY });
      }
    }
  } else {
    const projZ = playerPos.z + vz * 165.0;
    const hitAz =
      MAIN_AVENUES_Z.find((az) => Math.abs(playerPos.z - az) <= 28.0) ??
      MAIN_AVENUES_Z.find((az) => Math.abs(projZ - az) <= 30.0);
    const rotY = fwdX >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    if (hitAz !== undefined) {
      for (const ax of MAIN_AVENUES_X) {
        const aheadDelta = (ax - playerPos.x) * fwdX;
        if (aheadDelta >= MIN_ROADBLOCK_DIST && aheadDelta <= MAX_ROADBLOCK_DIST) {
          candidates.push({ x: ax, z: hitAz, rotY });
        }
      }
      for (const d of [165, 180, 155, 195, 215, 235]) {
        candidates.push({ x: playerPos.x + fwdX * d, z: hitAz, rotY });
      }
    }
  }

  for (const probeDist of [168, 192, 218, 238]) {
    const px = playerPos.x + vx * probeDist;
    const pz = playerPos.z + vz * probeDist;
    const nearAx = MAIN_AVENUES_X.find((ax) => Math.abs(px - ax) <= 34.0);
    if (nearAx !== undefined) candidates.push({ x: nearAx, z: pz, rotY: fwdZ >= 0 ? 0 : Math.PI });
    const nearAz = MAIN_AVENUES_Z.find((az) => Math.abs(pz - az) <= 34.0);
    if (nearAz !== undefined) candidates.push({ x: px, z: nearAz, rotY: fwdX >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5 });
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (isValidRoadblockSite(sys, c.x, c.z, playerPos, vx, vz)) return c;
  }
  return null;
}

function buildRoadblockVehicleDefs(stars, gapSide) {
  if (stars >= 4) {
    const escort = VEHICLE_SPECS.choque_pickup ? 'choque_pickup' : 'interceptor_v8';
    const defs = [
      { vType: 'caveirao_bope', lx: -gapSide * 4.8, lz: 0.35, yawOff: -gapSide * 0.22, color: 0x090a0d, roofColor: 0x111827, hp: 380, roofLightY: 2.32 },
      { vType: escort, lx: -gapSide * 0.85, lz: -0.65, yawOff: gapSide * 0.28, color: 0x1e293b, roofColor: 0x090a0d, hp: 260, roofLightY: escort === 'choque_pickup' ? 1.92 : 1.58 }
    ];
    if (stars >= 5) {
      defs.push({ vType: 'interceptor_v8', lx: gapSide * 6.85, lz: -0.95, yawOff: gapSide * 0.44, color: 0x090a0d, roofColor: LEGO_COLORS.white, hp: 240, roofLightY: 1.58 });
    }
    return defs;
  }
  return [
    { vType: 'interceptor_v8', lx: -gapSide * 5.35, lz: 0.25, yawOff: -gapSide * 0.3, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 165, roofLightY: 1.58 },
    { vType: 'interceptor_v8', lx: -gapSide * 1.95, lz: -0.55, yawOff: gapSide * 0.26, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 165, roofLightY: 1.58 }
  ];
}

function trySpawnRoadblockAheadCore(sys, playerPos) {
  if (!sys || !playerPos || (sys.stars || 0) < 3 || sys.isEscaping) return false;
  if (sys.roadblocks.length >= MAX_ACTIVE_ROADBLOCKS) return false;

  const inTunnel = sys._isPlayerInUndergroundTunnel ? sys._isPlayerInUndergroundTunnel(playerPos) : playerPos.y < -2.5;
  if (inTunnel || playerPos.y > 32.0) return false;

  const site = findPredictiveRoadblockPlacement(sys, playerPos);
  if (!site) return false;

  const { x: bestX, z: bestZ, rotY: blockRotY } = site;
  const groundY = sys.world?.getTerrainHeightAt ? sys.world.getTerrainHeightAt(bestX, bestZ) : 0;
  const G = getSharedPursuitGeos();
  const props = [];
  const strobes = [];
  const cosR = Math.cos(blockRotY);
  const sinR = Math.sin(blockRotY);
  const toWorld = (lx, lz) => ({ x: bestX + lx * cosR + lz * sinR, z: bestZ - lx * sinR + lz * cosR });

  const gapSide = sys.roadblocks.length % 2 === 0 ? 1 : -1;
  const isHeavyBope = sys.stars >= 4;
  const hasSpikeStrip = isHeavyBope || sys.roadblocks.length === 0 ? true : Math.random() < 0.65;

  for (const vd of buildRoadblockVehicleDefs(sys.stars, gapSide)) {
    const p = toWorld(vd.lx, vd.lz);
    const vRot = blockRotY + Math.PI * 0.5 + vd.yawOff;
    const spec = VEHICLE_SPECS[vd.vType] || VEHICLE_SPECS.interceptor_v8;
    const carMesh = createLegoCarMesh({ x: p.x, z: p.z, rotY: vRot, color: vd.color, roofColor: vd.roofColor, type: vd.vType });
    carMesh.position.set(p.x, groundY, p.z);
    carMesh.rotation.y = vRot;
    Object.assign(carMesh.userData, {
      carType: vd.vType,
      carName: isHeavyBope ? 'BLOQUEIO TÁTICO BOPE' : 'BLOQUEIO POLICIAL',
      vehicleSpec: spec,
      skipStaticMerge: true
    });
    if (typeof sys._attachPoliceLightbar === 'function') strobes.push(sys._attachPoliceLightbar(carMesh, vd.roofLightY));
    sys.scene.add(carMesh);

    const col = sys.world.addCollider(p.x, p.z, 4.6, 2.6, groundY + 1.9, groundY);
    props.push(sys.destructibles.registerDestructible({
      mesh: carMesh, type: 'car', hp: vd.hp, radius: 2.65, height: 2.1, colliders: [col],
      debrisColors: [vd.color, vd.roofColor, 0xef4444, 0x2563eb],
      studDrops: { silver: 3, gold: isHeavyBope ? 8 : 6, blue: 2, purple: sys.stars >= 5 ? 1 : 0 },
      groundY, isPoliceUnit: true, noAutoRespawn: true
    }));
  }

  const barricadeOffsets = isHeavyBope ? [-6.4, -3.8, -1.2, 6.2] : [-6.0, -3.5, -1.0];
  for (const bOff of barricadeOffsets) {
    const bp = toWorld(gapSide * bOff, -3.3);
    const bGroup = new THREE.Group();
    bGroup.userData.isOptimizedGroup = true;
    bGroup.position.set(bp.x, groundY, bp.z);
    bGroup.rotation.y = blockRotY;
    bGroup.add(new THREE.Mesh(G.rbBarricadeGeo, sys.mats.orangePlastic));
    sys.scene.add(bGroup);

    props.push(sys.destructibles.registerDestructible({
      mesh: bGroup, type: 'orange_barricade', hp: 14, radius: 1.2, height: 1.1, colliders: [],
      debrisColors: [LEGO_COLORS.orange, LEGO_COLORS.white],
      studDrops: { silver: 2, gold: 1, blue: 0, purple: 0 },
      groundY, isPoliceUnit: true, noAutoRespawn: true
    }));
  }

  let spikeStripMesh = null;
  let spikeStripBox = null;
  if (hasSpikeStrip) {
    const sp = toWorld(gapSide * (isHeavyBope ? 3.1 : 3.2), 0.1);
    spikeStripMesh = new THREE.Mesh(G.spikeStripGeo, sys.mats.spikeSteel || sys.mats.gunSteel);
    spikeStripMesh.position.set(sp.x, groundY + 0.02, sp.z);
    spikeStripMesh.rotation.y = blockRotY;

    const deployCase = new THREE.Mesh(SHARED_DEPLOY_CASE_GEO, sys.mats.spikeHazard || sys.mats.orangePlastic);
    deployCase.position.set(gapSide * 3.38, 0.12, 0);
    spikeStripMesh.add(deployCase);
    sys.scene.add(spikeStripMesh);

    const halfWidth = 3.5;
    const halfDepth = 1.6;
    const extX = Math.abs(cosR) * halfWidth + Math.abs(sinR) * halfDepth;
    const extZ = Math.abs(sinR) * halfWidth + Math.abs(cosR) * halfDepth;
    spikeStripBox = {
      x: sp.x, y: groundY, z: sp.z, rotY: blockRotY, halfWidth, halfDepth,
      minX: sp.x - extX, maxX: sp.x + extX, minY: groundY - 0.3, maxY: groundY + 1.6, minZ: sp.z - extZ, maxZ: sp.z + extZ
    };
  }

  const trooperOffsets = isHeavyBope ? (sys.stars >= 5 ? [-5.0, -1.6, 5.8] : [-4.8, -1.2]) : [-4.8, -1.8];
  const trooperSlots = [];
  const troopers = [];
  for (const tOff of trooperOffsets) {
    const tp = toWorld(gapSide * tOff, 3.5);
    const slot = { x: tp.x, y: groundY, z: tp.z };
    trooperSlots.push(slot);
    if (typeof sys._spawnFootTrooper === 'function') {
      const unit = sys._spawnFootTrooper(slot, sys.stars);
      if (unit) {
        unit.isRoadblockGuard = true;
        unit.guardAnchor = slot;
        troopers.push(unit);
      }
    }
  }

  const rp = toWorld(gapSide * 9.8, -1.5);
  const rampMesh = new THREE.Mesh(G.roadblockRampGeo, sys.mats.spikeHazard || sys.mats.orangePlastic);
  rampMesh.position.set(rp.x, groundY, rp.z);
  rampMesh.rotation.y = Math.atan2(playerPos.x - rp.x, playerPos.z - rp.z);
  sys.scene.add(rampMesh);

  sys.roadblocks.push({
    x: bestX, y: groundY, z: bestZ, rotY: blockRotY, tierStars: sys.stars,
    hasSpikeStrip, spikeStripMesh, spikeStripBox,
    rampPos: { x: rp.x, y: groundY, z: rp.z }, rampMesh,
    props, strobes, troopers, trooperSlots, _redeployedNear: false, age: 0
  });
  return true;
}

function isPuncturableGroundVehicle(carObj) {
  if (!carObj || carObj.destroyed || !carObj.mesh) return false;
  const spec = carObj.mesh.userData?.vehicleSpec;
  if (spec?.category === 'boat' || spec?.category === 'plane' || spec?.category === 'helicopter') return false;
  if (spec?.isColossalShip || spec?.id === 'tanque_titan' || carObj.mesh.userData?.carType === 'tanque_titan') return false;
  if (carObj.mesh.userData?.bulletproofTires || spec?.bulletproofTires) return false;
  return true;
}

function updateRoadblocksCore(sys, dt, playerPos, controller) {
  if (!sys || !playerPos) return;
  const carObj = controller?.currentVehicle;
  const canPuncture = isPuncturableGroundVehicle(carObj);
  const redPhase = Math.sin(sys._strobeClock || 0) > 0;

  for (let i = sys.roadblocks.length - 1; i >= 0; i--) {
    const rb = sys.roadblocks[i];
    rb.age += dt;

    if (rb.strobes && sys.mats) {
      for (const st of rb.strobes) {
        if (st?.strobeRed && st?.strobeBlue) {
          st.strobeRed.material = redPhase ? sys.mats.strobeRedOn : sys.mats.strobeOff;
          st.strobeBlue.material = !redPhase ? sys.mats.strobeBlueOn : sys.mats.strobeOff;
        }
      }
    }

    const dist = Math.hypot(playerPos.x - rb.x, playerPos.z - rb.z);
    if (!rb._redeployedNear && dist < 138.0 && typeof sys._spawnFootTrooper === 'function' && rb.trooperSlots) {
      rb._redeployedNear = true;
      for (let t = 0; t < rb.trooperSlots.length; t++) {
        const prev = rb.troopers?.[t];
        if (!prev || (prev.obj?.hp > 0 && !sys.footUnits.includes(prev))) {
          const fresh = sys._spawnFootTrooper(rb.trooperSlots[t], rb.tierStars || sys.stars);
          if (fresh) {
            fresh.isRoadblockGuard = true;
            fresh.guardAnchor = rb.trooperSlots[t];
            if (rb.troopers) rb.troopers[t] = fresh;
          }
        }
      }
    }

    if (carObj && controller && rb.rampPos && Math.abs(controller.vehicleSpeed || 0) > 16.0) {
      const rDist = Math.hypot(carObj.mesh.position.x - rb.rampPos.x, carObj.mesh.position.z - rb.rampPos.z);
      if (rDist < 3.4 && Math.abs(carObj.mesh.position.y - rb.rampPos.y) < 2.2) {
        controller.vehicleAirborne = true;
        controller.vehicleAirVelY = Math.max(controller.vehicleAirVelY || 0, 16.5);
        controller._hydraulicJumpVelY = Math.max(controller._hydraulicJumpVelY || 0, 16.5);
        controller._hydraulicAirOffset = Math.max(controller._hydraulicAirOffset || 0, 0.35);
      }
    }

    if (canPuncture && rb.spikeStripBox && !carObj.mesh.userData.puncturedTires) {
      const box = rb.spikeStripBox;
      const carPos = carObj.mesh.position;
      const dx = carPos.x - box.x;
      const dz = carPos.z - box.z;
      const cosB = Math.cos(box.rotY);
      const sinB = Math.sin(box.rotY);
      const localX = dx * cosB - dz * sinB;
      const localZ = dx * sinB + dz * cosB;

      if (
        Math.abs(localX) <= (box.halfWidth || 3.5) &&
        Math.abs(localZ) <= (box.halfDepth || 1.6) &&
        Math.abs(carPos.y - rb.y) < 1.6
      ) {
        carObj.mesh.userData.puncturedTires = true;
        soundFX.playExplosion?.(0.38);
        soundFX.playPlasticHit?.();
        sys.destructibles?._spawnElectricSparks?.(carPos.clone(), 10);
        if (typeof controller.vehicleHeading === 'number') {
          controller.vehicleHeading += (Math.random() < 0.5 ? 1 : -1) * 0.18;
        }
        sys.hud?.showWantedBanner?.(
          'PNEUS FURADOS!',
          'TAPETE DE PREGOS // VELOCIDADE MÁXIMA -40% ATÉ TROCAR OU REPARAR',
          'pursuit'
        );
      }
    }

    if (rb.age > ROADBLOCK_MAX_AGE_SEC || dist > ROADBLOCK_DESPAWN_DIST) {
      clearRoadblockCore(sys, rb);
      sys.roadblocks.splice(i, 1);
    }
  }
}

function clearRoadblockCore(sys, rb) {
  if (!sys || !rb) return;
  if (rb.rampMesh) sys.scene?.remove(rb.rampMesh);
  if (rb.spikeStripMesh) sys.scene?.remove(rb.spikeStripMesh);
  if (Array.isArray(rb.props)) {
    for (const pObj of rb.props) sys.destructibles?.unregisterDestructible?.(pObj);
  }
}

function clearAllRoadblocksCore(sys) {
  if (!sys || !Array.isArray(sys.roadblocks)) return;
  for (const rb of sys.roadblocks) clearRoadblockCore(sys, rb);
  sys.roadblocks.length = 0;
}

export const policeRoadblockMethods = {
  _trySpawnRoadblockAhead(a, ...r) { const c = resolveSystemAndArgs(this, a, r); return trySpawnRoadblockAheadCore(c.sys, c.args[0]); },
  _updateRoadblocks(a, ...r) { const c = resolveSystemAndArgs(this, a, r); return updateRoadblocksCore(c.sys, c.args[0], c.args[1], c.args[2]); },
  _clearRoadblock(a, ...r) { const c = resolveSystemAndArgs(this, a, r); return clearRoadblockCore(c.sys, c.args[0]); },
  _clearAllRoadblocks(a, ...r) { const c = resolveSystemAndArgs(this, a, r); return clearAllRoadblocksCore(c.sys); }
};

policeRoadblockMethods._trySpawnRoadblockAheadImpl = policeRoadblockMethods._trySpawnRoadblockAhead;
policeRoadblockMethods._updateRoadblocksImpl = policeRoadblockMethods._updateRoadblocks;
policeRoadblockMethods._clearRoadblockImpl = policeRoadblockMethods._clearRoadblock;
policeRoadblockMethods._clearAllRoadblocksImpl = policeRoadblockMethods._clearAllRoadblocks;
