import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { soundFX } from '../../audio/SoundFX.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  ws,
  MAIN_AVENUES_X as URBAN_MAIN_AVENUES_X,
  MAIN_AVENUES_Z as URBAN_MAIN_AVENUES_Z,
  SECONDARY_STREETS_X as URBAN_SECONDARY_STREETS_X,
  SECONDARY_STREETS_Z as URBAN_SECONDARY_STREETS_Z,
  INDUSTRIAL_STREETS_X
} from '../core/WorldLayoutScale.js';

// ============================================================================
// BLOQUEIOS POLICIAIS PREDITIVOS (150M–245M) & TAPETE DE PREGOS (3★ A 5★)
// Em 3x: cobre todas as avenidas/ruas escaladas e distribui viaturas, barricadas,
// tapete de pregos e rampa estritamente na faixa asfaltada (34m / 28m / 26m) sem subir nas calçadas de 10m!
// ============================================================================
const LEGACY_AVENUES_X = [-516, -384, -252, -120, 0, 120, 252, 384, 612];
const LEGACY_AVENUES_Z = [-512, -382, -252, -117, 0, 134, 384, 710];

function buildScaledRoadLinesX() {
  const map = new Map();
  const put = (coord, width, zMin, zMax) => {
    const prev = map.get(coord);
    if (!prev) map.set(coord, { coord, width, min: zMin, max: zMax });
    else {
      prev.width = Math.max(prev.width, width);
      prev.min = Math.min(prev.min, zMin);
      prev.max = Math.max(prev.max, zMax);
    }
  };
  for (const x of URBAN_MAIN_AVENUES_X) put(x, ROAD.mainWidth, ws(-1300), ws(710));
  for (const x of URBAN_SECONDARY_STREETS_X) {
    if (Math.abs(x - ws(-648)) < 0.5 || Math.abs(x - ws(648)) < 0.5) put(x, ROAD.secondaryWidth, ws(-1300), ws(-512));
    else put(x, ROAD.secondaryWidth, ws(-1300), ws(710));
  }
  for (const x of INDUSTRIAL_STREETS_X) put(x, ROAD.secondaryWidth, ws(-1300), ws(134));
  for (const x of [600, 825, 1158, 1545].map(ws)) put(x, 28, ws(134), ws(708));
  put(ws(1375), ROAD.mainWidth, ws(134), ws(1400));
  return [...map.values()].sort((a, b) => a.coord - b.coord);
}

function buildScaledRoadLinesZ() {
  const map = new Map();
  const put = (coord, width, xMin, xMax) => {
    const prev = map.get(coord);
    if (!prev) map.set(coord, { coord, width, min: xMin, max: xMax });
    else {
      prev.width = Math.max(prev.width, width);
      prev.min = Math.min(prev.min, xMin);
      prev.max = Math.max(prev.max, xMax);
    }
  };
  for (const z of URBAN_MAIN_AVENUES_Z) {
    const xMin = Math.abs(z) < 0.5 ? ws(-1100) : ws(-516);
    const xMax = z <= ws(134) ? ws(1545) : ws(600);
    put(z, ROAD.mainWidth, xMin, xMax);
  }
  for (const z of [ws(-1300), ...URBAN_SECONDARY_STREETS_Z]) {
    put(z, ROAD.secondaryWidth, ws(-648), z <= ws(-512) ? ws(1524) : ws(516));
  }
  for (const z of [335, 535, 708].map(ws)) put(z, 28, ws(600), ws(1545));
  return [...map.values()].sort((a, b) => a.coord - b.coord);
}

const ROAD_LINES_X = IS_SCALED_WORLD
  ? buildScaledRoadLinesX()
  : LEGACY_AVENUES_X.map((coord) => ({ coord, width: ROAD.mainWidth, min: -1200, max: 1200 }));
const ROAD_LINES_Z = IS_SCALED_WORLD
  ? buildScaledRoadLinesZ()
  : LEGACY_AVENUES_Z.map((coord) => ({ coord, width: ROAD.mainWidth, min: -1200, max: 1200 }));

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
  if (IS_SCALED_WORLD && sys._isSegmentBlockedByBuilding?.(cx - 7.0, cz - 7.0, cx + 7.0, cz + 7.0)) return false;
  return true;
}

function findRoadLineNear(lines, val, alongVal, tol) {
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (IS_SCALED_WORLD && (alongVal < ln.min - 10 || alongVal > ln.max + 10)) continue;
    if (Math.abs(val - ln.coord) <= tol) return ln;
  }
  return null;
}

function findPredictiveRoadblockPlacement(sys, playerPos) {
  let vx = Number(sys._playerVelDir?.x) || 0;
  let vz = Number(sys._playerVelDir?.z) || 0;
  const vLen = Math.hypot(vx, vz);
  if (vLen < 0.05) { vx = 0; vz = 1; } else { vx /= vLen; vz /= vLen; }

  const movingMostlyZ = Math.abs(vz) >= Math.abs(vx);
  const fwdZ = vz >= 0 ? 1 : -1;
  const fwdX = vx >= 0 ? 1 : -1;
  const candidates = [];

  if (movingMostlyZ) {
    const projX = playerPos.x + vx * 165.0;
    const projZ = playerPos.z + vz * 165.0;
    const hitLnX = findRoadLineNear(ROAD_LINES_X, playerPos.x, playerPos.z, 28.0) || findRoadLineNear(ROAD_LINES_X, projX, projZ, 30.0);
    const rotY = fwdZ >= 0 ? 0 : Math.PI;
    if (hitLnX) {
      for (const lz of ROAD_LINES_Z) {
        if (IS_SCALED_WORLD && (hitLnX.coord < lz.min - 10 || hitLnX.coord > lz.max + 10)) continue;
        const aheadDelta = (lz.coord - playerPos.z) * fwdZ;
        if (aheadDelta >= MIN_ROADBLOCK_DIST && aheadDelta <= MAX_ROADBLOCK_DIST) {
          candidates.push({ x: hitLnX.coord, z: lz.coord, rotY, roadWidth: hitLnX.width });
        }
      }
      for (const d of [165, 180, 155, 195, 215, 235]) {
        const cz = playerPos.z + fwdZ * d;
        if (!IS_SCALED_WORLD || (cz >= hitLnX.min && cz <= hitLnX.max)) {
          candidates.push({ x: hitLnX.coord, z: cz, rotY, roadWidth: hitLnX.width });
        }
      }
    }
  } else {
    const projX = playerPos.x + vx * 165.0;
    const projZ = playerPos.z + vz * 165.0;
    const hitLnZ = findRoadLineNear(ROAD_LINES_Z, playerPos.z, playerPos.x, 28.0) || findRoadLineNear(ROAD_LINES_Z, projZ, projX, 30.0);
    const rotY = fwdX >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    if (hitLnZ) {
      for (const lx of ROAD_LINES_X) {
        if (IS_SCALED_WORLD && (hitLnZ.coord < lx.min - 10 || hitLnZ.coord > lx.max + 10)) continue;
        const aheadDelta = (lx.coord - playerPos.x) * fwdX;
        if (aheadDelta >= MIN_ROADBLOCK_DIST && aheadDelta <= MAX_ROADBLOCK_DIST) {
          candidates.push({ x: lx.coord, z: hitLnZ.coord, rotY, roadWidth: hitLnZ.width });
        }
      }
      for (const d of [165, 180, 155, 195, 215, 235]) {
        const cx = playerPos.x + fwdX * d;
        if (!IS_SCALED_WORLD || (cx >= hitLnZ.min && cx <= hitLnZ.max)) {
          candidates.push({ x: cx, z: hitLnZ.coord, rotY, roadWidth: hitLnZ.width });
        }
      }
    }
  }

  for (const probeDist of [168, 192, 218, 238]) {
    const px = playerPos.x + vx * probeDist;
    const pz = playerPos.z + vz * probeDist;
    const nearLnX = findRoadLineNear(ROAD_LINES_X, px, pz, 34.0);
    if (nearLnX) candidates.push({ x: nearLnX.coord, z: pz, rotY: fwdZ >= 0 ? 0 : Math.PI, roadWidth: nearLnX.width });
    const nearLnZ = findRoadLineNear(ROAD_LINES_Z, pz, px, 34.0);
    if (nearLnZ) candidates.push({ x: px, z: nearLnZ.coord, rotY: fwdX >= 0 ? Math.PI * 0.5 : -Math.PI * 0.5, roadWidth: nearLnZ.width });
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (isValidRoadblockSite(sys, c.x, c.z, playerPos, vx, vz)) return c;
  }
  return null;
}

function buildRoadblockLayoutForWidth(stars, gapSide, roadWidth = ROAD.mainWidth) {
  if (!IS_SCALED_WORLD) {
    const isHeavy = stars >= 4;
    const escort = VEHICLE_SPECS.choque_pickup ? 'choque_pickup' : 'interceptor_v8';
    const vehicles = isHeavy
      ? [
          { vType: 'caveirao_bope', lx: -gapSide * 4.8, lz: 0.35, yawOff: -gapSide * 0.22, color: 0x090a0d, roofColor: 0x111827, hp: 380, roofLightY: 2.32 },
          { vType: escort, lx: -gapSide * 0.85, lz: -0.65, yawOff: gapSide * 0.28, color: 0x1e293b, roofColor: 0x090a0d, hp: 260, roofLightY: escort === 'choque_pickup' ? 1.92 : 1.58 },
          ...(stars >= 5 ? [{ vType: 'interceptor_v8', lx: gapSide * 6.85, lz: -0.95, yawOff: gapSide * 0.44, color: 0x090a0d, roofColor: LEGO_COLORS.white, hp: 240, roofLightY: 1.58 }] : [])
        ]
      : [
          { vType: 'interceptor_v8', lx: -gapSide * 5.35, lz: 0.25, yawOff: -gapSide * 0.3, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 165, roofLightY: 1.58 },
          { vType: 'interceptor_v8', lx: -gapSide * 1.95, lz: -0.55, yawOff: gapSide * 0.26, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 165, roofLightY: 1.58 }
        ];
    return {
      vehicles,
      barricadeOffsets: isHeavy ? [-6.4, -3.8, -1.2, 6.2] : [-6.0, -3.5, -1.0],
      spikeX: gapSide * (isHeavy ? 3.1 : 3.2),
      trooperOffsets: isHeavy ? (stars >= 5 ? [-5.0, -1.6, 5.8] : [-4.8, -1.2]) : [-4.8, -1.8],
      rampX: gapSide * 9.8
    };
  }

  // Em 3x: ocupa toda a largura asfaltada (34m / 28m / 26m) com margem estrita >= 1.2m da guia das calçadas de 10m!
  const halfAsphalt = (roadWidth || ROAD.mainWidth) * 0.5;
  const maxCarCenter = Math.max(6.5, halfAsphalt - 3.6); // carro ~4.8m atravessado -> borda fica a >= 1.2m do meio-fio!
  const maxPropCenter = Math.max(7.5, halfAsphalt - 2.4);
  const isWideMain = roadWidth >= 32;
  const isHeavy = stars >= 4;
  const escort = VEHICLE_SPECS.choque_pickup ? 'choque_pickup' : 'interceptor_v8';

  const vehicles = [];
  if (isHeavy) {
    vehicles.push(
      { vType: 'caveirao_bope', lx: -gapSide * maxCarCenter, lz: 0.4, yawOff: -gapSide * 0.2, color: 0x090a0d, roofColor: 0x111827, hp: 380, roofLightY: 2.32 },
      { vType: escort, lx: -gapSide * (maxCarCenter * 0.5), lz: -0.55, yawOff: gapSide * 0.24, color: 0x1e293b, roofColor: 0x090a0d, hp: 260, roofLightY: escort === 'choque_pickup' ? 1.92 : 1.58 }
    );
    if (isWideMain) {
      vehicles.push({ vType: 'interceptor_v8', lx: -gapSide * 1.1, lz: 0.25, yawOff: -gapSide * 0.18, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 210, roofLightY: 1.58 });
    }
    if (stars >= 5) {
      vehicles.push({ vType: 'interceptor_v8', lx: gapSide * Math.min(maxCarCenter, 8.8), lz: -0.9, yawOff: gapSide * 0.4, color: 0x090a0d, roofColor: LEGO_COLORS.white, hp: 240, roofLightY: 1.58 });
    }
  } else {
    vehicles.push(
      { vType: 'interceptor_v8', lx: -gapSide * maxCarCenter, lz: 0.3, yawOff: -gapSide * 0.26, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 165, roofLightY: 1.58 },
      { vType: 'interceptor_v8', lx: -gapSide * (maxCarCenter * 0.46), lz: -0.5, yawOff: gapSide * 0.24, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 165, roofLightY: 1.58 }
    );
    if (isWideMain) {
      vehicles.push({ vType: 'interceptor_v8', lx: -gapSide * 1.2, lz: 0.2, yawOff: -gapSide * 0.18, color: 0x0f172a, roofColor: LEGO_COLORS.white, hp: 165, roofLightY: 1.58 });
    }
  }

  const barricadeOffsets = isWideMain
    ? [-maxPropCenter + 1.0, -9.2, -5.4, -1.6, ...(isHeavy ? [8.4] : [])]
    : [-maxPropCenter + 0.8, -5.8, -2.0, ...(isHeavy ? [6.8] : [])];
  const trooperOffsets = isHeavy
    ? (stars >= 5 ? [-maxCarCenter + 0.8, -4.2, 7.6] : [-maxCarCenter + 0.8, -3.6])
    : [-maxCarCenter + 0.8, -3.8];

  return {
    vehicles,
    barricadeOffsets,
    spikeX: gapSide * (isWideMain ? 4.2 : 3.2),
    trooperOffsets,
    rampX: gapSide * (halfAsphalt - 3.3) // rampa 4.2m de largura -> borda externa a 1.2m antes da calçada!
  };
}

function trySpawnRoadblockAheadCore(sys, playerPos) {
  if (!sys || !playerPos || (sys.stars || 0) < 3 || sys.isEscaping) return false;
  if (sys.roadblocks.length >= MAX_ACTIVE_ROADBLOCKS) return false;

  const inTunnel = sys._isPlayerInUndergroundTunnel ? sys._isPlayerInUndergroundTunnel(playerPos) : playerPos.y < -2.5;
  if (inTunnel || playerPos.y > 32.0) return false;

  const site = findPredictiveRoadblockPlacement(sys, playerPos);
  if (!site) return false;

  const { x: bestX, z: bestZ, rotY: blockRotY, roadWidth = ROAD.mainWidth } = site;
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
  const layout = buildRoadblockLayoutForWidth(sys.stars, gapSide, roadWidth);
  const blockingEW = Math.abs(sinR) > 0.7;

  for (const vd of layout.vehicles) {
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

    const col = sys.world.addCollider(p.x, p.z, blockingEW ? 2.6 : 4.6, blockingEW ? 4.6 : 2.6, groundY + 1.9, groundY);
    props.push(sys.destructibles.registerDestructible({
      mesh: carMesh, type: 'car', hp: vd.hp, radius: 2.65, height: 2.1, colliders: [col],
      debrisColors: [vd.color, vd.roofColor, 0xef4444, 0x2563eb],
      studDrops: { silver: 3, gold: isHeavyBope ? 8 : 6, blue: 2, purple: sys.stars >= 5 ? 1 : 0 },
      groundY, isPoliceUnit: true, noAutoRespawn: true
    }));
  }

  for (const bOff of layout.barricadeOffsets) {
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
    const sp = toWorld(layout.spikeX, 0.1);
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

  const trooperSlots = [];
  const troopers = [];
  for (const tOff of layout.trooperOffsets) {
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

  const rp = toWorld(layout.rampX, -1.5);
  const rampMesh = new THREE.Mesh(G.roadblockRampGeo, sys.mats.spikeHazard || sys.mats.orangePlastic);
  rampMesh.position.set(rp.x, groundY, rp.z);
  rampMesh.rotation.y = Math.atan2(playerPos.x - rp.x, playerPos.z - rp.z);
  sys.scene.add(rampMesh);

  sys.roadblocks.push({
    x: bestX, y: groundY, z: bestZ, rotY: blockRotY, roadWidth, tierStars: sys.stars,
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
