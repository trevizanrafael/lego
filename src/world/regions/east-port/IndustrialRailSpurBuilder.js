import * as THREE from 'three';
import { IS_SCALED_WORLD, ROAD } from '../../core/WorldLayoutScale.js';
import { TERRITORY_ZONES } from '../../factions/TerritoryZonesAndConfigs.js';

const BALLAST_W = 5.4, BALLAST_H = 0.22, RAIL_GAUGE = 1.6, RAIL_W = 0.18, RAIL_H = 0.16;
const SLEEPER_STEP = 2.6, TRACK_SEG_LEN = 10.4;

const MAIN_SPUR_RAW_WAYPOINTS = Object.freeze([
  [4096, -2660], [4096, -1500], [4096, -300], [4096, 252], [4132, 304], [4330, 326],
  [4572, 342], [4665, 352], [4742, 402], [4760, 488], [4760, 1245], [4760, 2040]
]);

const RAIL_SIDINGS_SPEC = Object.freeze([
  { id: 'ind_north_yard_siding', inPort: false, points: [[4096, -2648], [4111, -2616], [4111, -2404], [4096, -2372]] },
  { id: 'ind_central_petro_siding', inPort: false, points: [[4096, -1086], [4111, -1052], [4111, -818], [4096, -784]] },
  { id: 'port_quay_portainer_siding', inPort: true, points: [[4760, 508], [4806, 582], [4806, 1896], [4760, 1972]] }
]);

const LEVEL_CROSSINGS_SPEC = Object.freeze([
  { z: -2328, x: 4096, halfRoad: ROAD.secondaryWidth * 0.5, axis: 'x' },
  { z: -1932, x: 4096, halfRoad: ROAD.secondaryWidth * 0.5, axis: 'x' },
  { z: -1536, x: 4096, halfRoad: ROAD.secondaryWidth * 0.5, axis: 'x' },
  { z: -1146, x: 4096, halfRoad: ROAD.mainWidth * 0.5, axis: 'x' },
  { z: -750, x: 4096, halfRoad: ROAD.mainWidth * 0.5, axis: 'x' },
  { z: -351, x: 4096, halfRoad: ROAD.mainWidth * 0.5, axis: 'x' },
  { z: 0, x: 4096, halfRoad: ROAD.mainWidth * 0.5, axis: 'x' },
  { z: 342, x: 4572, halfRoad: ROAD.secondaryWidth * 0.5, axis: 'z' },
  { z: 402, x: 4742, halfRoad: ROAD.mainWidth * 0.5, axis: 'x' },
  { z: 1005, x: 4760, halfRoad: 14.0, axis: 'x' },
  { z: 1605, x: 4760, halfRoad: 14.0, axis: 'x' }
]);

const PARKED_CONSISTS_SPEC = Object.freeze([
  {
    id: 'consist_ind_north', x: 4111, startZ: -2594, inPort: false, livery: 'lego_red',
    cars: [
      { kind: 'locomotive' }, { kind: 'container', color: 'pcc_navy' }, { kind: 'container', color: 'lego_orange' },
      { kind: 'tank', color: 'brushed_silver', band: 'forklift_yellow' }, { kind: 'tank', color: 'tactical_white', band: 'c4_hazard_red' }
    ]
  },
  {
    id: 'consist_ind_central', x: 4111, startZ: -1028, inPort: false, livery: 'pcc_navy',
    cars: [
      { kind: 'locomotive' }, { kind: 'tank', color: 'brushed_silver', band: 'pcc_royal' },
      { kind: 'tank', color: 'tactical_white', band: 'lego_orange' }, { kind: 'container', color: 'lego_red' }
    ]
  },
  {
    id: 'consist_port_quay', x: 4806, startZ: 762, inPort: true, livery: 'forklift_yellow',
    cars: [
      { kind: 'locomotive' }, { kind: 'container', color: 'lego_red' }, { kind: 'container', color: 'pcc_royal' },
      { kind: 'container', color: 'lego_green' }, { kind: 'tank', color: 'tactical_white', band: 'lego_orange' }
    ]
  }
]);

function buildFilletedWaypoints(rawPts, cornerSubdivs = 6, filletDist = 26) {
  if (rawPts.length <= 2) return rawPts.map(([x, z]) => [x, z]);
  const out = [[rawPts[0][0], rawPts[0][1]]];
  for (let i = 1; i < rawPts.length - 1; i++) {
    const [px, pz] = rawPts[i - 1], [cx, cz] = rawPts[i], [nx, nz] = rawPts[i + 1];
    const d0 = Math.hypot(cx - px, cz - pz), d1 = Math.hypot(nx - cx, nz - cz);
    const f0 = Math.min(filletDist, d0 * 0.42), f1 = Math.min(filletDist, d1 * 0.42);
    const ax = cx - ((cx - px) / d0) * f0, az = cz - ((cz - pz) / d0) * f0;
    const bx = cx + ((nx - cx) / d1) * f1, bz = cz + ((nz - cz) / d1) * f1;
    for (let s = 0; s <= cornerSubdivs; s++) {
      const t = s / cornerSubdivs, omt = 1 - t;
      out.push([omt * omt * ax + 2 * omt * t * cx + t * t * bx, omt * omt * az + 2 * omt * t * cz + t * t * bz]);
    }
  }
  out.push([rawPts[rawPts.length - 1][0], rawPts[rawPts.length - 1][1]]);
  return out;
}

export function getFreightRailKeepoutSegments() {
  if (!IS_SCALED_WORLD) return [];
  const mainPts = buildFilletedWaypoints(MAIN_SPUR_RAW_WAYPOINTS, 5, 26), segs = [];
  const pushPoly = (pts, halfW) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], len = Math.hypot(x2 - x1, z2 - z1);
      if (len > 0.5) segs.push({ x1, z1, x2, z2, len, halfWidth: halfW, sidewalk: 4.0 });
    }
  };
  pushPoly(mainPts, 8.5);
  for (const sid of RAIL_SIDINGS_SPEC) if (!sid.inPort) pushPoly(sid.points, 7.5);
  return segs;
}

function sampleRailGroundY(world, x, z) {
  const terrainY = world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(x, z)) : 0;
  if (z >= 355) return terrainY + 0.28;
  if (z > 345) return terrainY + THREE.MathUtils.lerp(0.14, 0.28, (z - 345) / 10);
  for (let i = 0; i < LEVEL_CROSSINGS_SPEC.length; i++) {
    const lc = LEVEL_CROSSINGS_SPEC[i];
    if (lc.axis === 'x' && Math.abs(z - lc.z) <= lc.halfRoad + 1.5 && Math.abs(x - lc.x) < 24) return terrainY + 0.03;
  }
  return terrainY + 0.14;
}

function isTrackSegmentClearOfStructures(world, x1, z1, x2, z2) {
  if (typeof world.getCollidersAlongRay2D === 'function') {
    const hits = world.getCollidersAlongRay2D(x1, z1, x2, z2, 2.2);
    const tY = world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt((x1 + x2) * 0.5, (z1 + z2) * 0.5)) : 0;
    for (let i = 0; i < hits.length; i++) {
      const c = hits[i];
      if (c && !c.disabled && !c.isGangway && c.maxY > tY + 1.2 && c.minY < tY + 6.5) return false;
    }
  }
  for (const zone of [TERRITORY_ZONES?.pcc, TERRITORY_ZONES?.ares]) {
    if (!zone) continue;
    for (const pt of [...(zone.outposts || []), ...(zone.gates || []), ...(zone.garages || []), zone.bossCourtyard]) {
      if (pt && Math.hypot((x1 + x2) * 0.5 - pt.x, (z1 + z2) * 0.5 - pt.z) < 24) return false;
    }
  }
  return true;
}

function isRailcarClearOfRoadsAndColliders(world, cx, cz, w, d) {
  const minX = cx - w * 0.5 - 0.8, maxX = cx + w * 0.5 + 0.8, minZ = cz - d * 0.5 - 0.8, maxZ = cz + d * 0.5 + 0.8;
  for (const r of world.mapRoads || []) {
    if (!r.isElevated && !r.isBridge && minX < r.x + r.w * 0.5 && maxX > r.x - r.w * 0.5 && minZ < r.z + r.d * 0.5 && maxZ > r.z - r.d * 0.5) return false;
  }
  if (typeof world.getCollidersNear === 'function') {
    const near = world.getCollidersNear(cx, cz, Math.hypot(w, d) * 0.5 + 1.5), tY = sampleRailGroundY(world, cx, cz);
    for (let i = 0; i < near.length; i++) {
      const c = near[i];
      if (c && !c.disabled && c.maxY > tY + 0.9 && c.minY < tY + 8.0 && minX < c.maxX && maxX > c.minX && minZ < c.maxZ && maxZ > c.minZ) return false;
    }
  }
  return true;
}

function emitTrackPolyline(world, batcher, pts, concreteSleepers = false) {
  let emittedSegs = 0;
  const sleeperMat = concreteSleepers ? 'gunmetal_concrete' : 'pallet_wood';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const dx = x2 - x1, dz = z2 - z1, totalLen = Math.hypot(dx, dz);
    if (totalLen < 1.0) continue;
    const ux = dx / totalLen, uz = dz / totalLen, nx = uz, nz = -ux, yaw = Math.atan2(ux, uz);
    const nSeg = Math.max(1, Math.round(totalLen / TRACK_SEG_LEN)), segLen = totalLen / nSeg;
    for (let s = 0; s < nSeg; s++) {
      const d0 = s * segLen, d1 = d0 + segLen, dm = (d0 + d1) * 0.5;
      const sx0 = x1 + ux * d0, sz0 = z1 + uz * d0, sx1 = x1 + ux * d1, sz1 = z1 + uz * d1;
      if (!isTrackSegmentClearOfStructures(world, sx0, sz0, sx1, sz1)) continue;
      const mx = x1 + ux * dm, mz = z1 + uz * dm;
      const y0 = sampleRailGroundY(world, sx0, sz0), y1 = sampleRailGroundY(world, sx1, sz1), ym = (y0 + y1) * 0.5;
      const pitch = -Math.atan2(y1 - y0, segLen), spanD = Math.hypot(segLen, y1 - y0) + 0.16;
      batcher.addWorldBox('armor_slate', BALLAST_W, BALLAST_H, spanD, mx, ym + BALLAST_H * 0.5 - 0.03, mz, pitch, yaw, 0, Math.abs(pitch) < 0.002);
      const railBaseY = ym + BALLAST_H + RAIL_H * 0.5 - 0.03, halfG = RAIL_GAUGE * 0.5;
      batcher.addWorldBox('brushed_silver', RAIL_W, RAIL_H, spanD + 0.04, mx - nx * halfG, railBaseY, mz - nz * halfG, pitch, yaw, 0, false);
      batcher.addWorldBox('brushed_silver', RAIL_W, RAIL_H, spanD + 0.04, mx + nx * halfG, railBaseY, mz + nz * halfG, pitch, yaw, 0, false);
      emittedSegs++;
    }
    const nSleepers = Math.max(1, Math.floor(totalLen / SLEEPER_STEP));
    for (let k = 0; k <= nSleepers; k++) {
      const dist = (k / nSleepers) * totalLen, tx = x1 + ux * dist, tz = z1 + uz * dist;
      batcher.addWorldBox(sleeperMat, 2.6, 0.11, 0.34, tx, sampleRailGroundY(world, tx, tz) + BALLAST_H - 0.01, tz, 0, yaw, 0, false);
    }
  }
  return emittedSegs;
}

function addBufferStop(world, batcher, x, z, dirSignZ = 1) {
  const gy = sampleRailGroundY(world, x, z) + BALLAST_H;
  batcher.addWorldBox('matte_black', 2.8, 1.35, 1.6, x, gy + 0.65, z);
  batcher.addWorldBox('lego_red', 2.95, 0.42, 0.35, x, gy + 1.05, z + dirSignZ * 0.72);
  batcher.addWorldBox('forklift_yellow', 2.4, 0.22, 0.38, x, gy + 0.72, z + dirSignZ * 0.74);
  world.addCollider(x, z, 2.9, 1.8, gy + 1.4, gy - 0.2);
}

function addLevelCrossingAndCrossbucks(world, batcher, lc) {
  const gy = sampleRailGroundY(world, lc.x, lc.z), deckLen = lc.halfRoad * 2 + 2.4, rotY = lc.axis === 'z' ? Math.PI * 0.5 : 0;
  batcher.addWorldBox('gunmetal_concrete', 6.2, 0.14, deckLen, lc.x, gy + 0.15, lc.z, 0, rotY, 0, true);
  for (const edge of [-2.85, 2.85]) {
    const ex = lc.axis === 'z' ? lc.x : lc.x + edge, ez = lc.axis === 'z' ? lc.z + edge : lc.z;
    for (let s = -lc.halfRoad; s <= lc.halfRoad - 2.0; s += 4.0) {
      const mat = Math.round((s + lc.halfRoad) / 4.0) % 2 === 0 ? 'forklift_yellow' : 'matte_black';
      batcher.addWorldBox(mat, lc.axis === 'z' ? 2.0 : 0.48, 0.06, lc.axis === 'z' ? 0.48 : 2.0, lc.axis === 'z' ? ex + s + 1.0 : ex, gy + 0.23, lc.axis === 'z' ? ez : ez + s + 1.0, 0, 0, 0, true);
    }
  }
  const offRoad = lc.halfRoad + 3.4;
  for (const side of [-1, 1]) {
    const px = lc.axis === 'z' ? lc.x + side * offRoad : lc.x + side * 4.8;
    const pz = lc.axis === 'z' ? lc.z + side * 4.8 : lc.z + side * offRoad;
    const py = sampleRailGroundY(world, px, pz);
    batcher.addWorldCylinder('brushed_silver', 0.14, 0.18, 4.4, px, py + 2.2, pz, 6);
    batcher.addWorldBox('tactical_white', 1.85, 0.26, 0.12, px, py + 3.85, pz, 0, rotY, Math.PI / 4);
    batcher.addWorldBox('tactical_white', 1.85, 0.26, 0.12, px, py + 3.85, pz, 0, rotY, -Math.PI / 4);
    batcher.addWorldBox('c4_hazard_red', 0.32, 0.32, 0.28, px - 0.36, py + 3.1, pz);
    batcher.addWorldBox('c4_hazard_red', 0.32, 0.32, 0.28, px + 0.36, py + 3.1, pz);
  }
}

function addParkedFreightCar(world, batcher, x, z, spec, liveryKey) {
  const railTopY = sampleRailGroundY(world, x, z) + BALLAST_H + RAIL_H - 0.03;
  if (spec.kind === 'locomotive') {
    const w = 3.8, d = 16.4, h = 4.6;
    if (!isRailcarClearOfRoadsAndColliders(world, x, z, w, d)) return null;
    batcher.addWorldBox('matte_black', w, 0.72, d, x, railTopY + 0.56, z);
    batcher.addWorldBox('forklift_yellow', w + 0.12, 0.24, d + 0.16, x, railTopY + 0.88, z);
    batcher.addWorldBox(liveryKey, 3.3, 2.35, 10.6, x, railTopY + 2.15, z + 1.4);
    batcher.addWorldBox('matte_black', 3.65, 3.15, 4.4, x, railTopY + 2.55, z - 4.8);
    batcher.addWorldBox('dark_steel', 3.72, 1.05, 3.6, x, railTopY + 3.35, z - 4.8);
    batcher.addWorldBox('forklift_yellow', 3.76, 0.32, 4.5, x, railTopY + 4.18, z - 4.8);
    batcher.addWorldCylinder('matte_black', 0.36, 0.42, 0.9, x, railTopY + 3.75, z + 3.2, 8);
    batcher.addWorldBox('floodlight_glow', 0.55, 0.42, 0.2, x - 0.85, railTopY + 2.1, z + d * 0.5 + 0.08);
    batcher.addWorldBox('floodlight_glow', 0.55, 0.42, 0.2, x + 0.85, railTopY + 2.1, z + d * 0.5 + 0.08);
    batcher.addWorldBox('c4_hazard_red', 0.5, 0.32, 0.2, x - 1.1, railTopY + 1.1, z - d * 0.5 - 0.08);
    batcher.addWorldBox('c4_hazard_red', 0.5, 0.32, 0.2, x + 1.1, railTopY + 1.1, z - d * 0.5 - 0.08);
    for (const bz of [-5.2, 5.2]) batcher.addWorldBox('gunmetal_concrete', 2.6, 0.52, 3.4, x, railTopY + 0.32, z + bz);
    world.addCollider(x, z, w, d, railTopY + h, railTopY - 0.2);
    return { x, z, w, d, type: 'shunter_locomotive' };
  }
  if (spec.kind === 'container') {
    const w = 6.0, d = 19.4, ch = 6.0;
    if (!isRailcarClearOfRoadsAndColliders(world, x, z, w, d)) return null;
    batcher.addWorldBox('matte_black', 3.5, 0.52, d, x, railTopY + 0.5, z);
    batcher.addWorldBox('forklift_yellow', 3.62, 0.18, d - 0.4, x, railTopY + 0.72, z);
    for (const bz of [-6.8, 6.8]) batcher.addWorldBox('gunmetal_concrete', 2.4, 0.46, 2.8, x, railTopY + 0.28, z + bz);
    const cy = railTopY + 0.82 + ch * 0.5;
    batcher.addWorldBox(spec.color, 5.8, ch - 0.14, 17.8, x, cy, z);
    batcher.addWorldBox('brushed_silver', 3.2, ch - 0.4, 18.14, x, cy, z);
    world.addCollider(x, z, w, d, railTopY + 0.85 + ch, railTopY - 0.2);
    if (world.eastPortData) world.eastPortData.detailedContainersCount++;
    return { x, z, w, d, type: 'container_flatcar' };
  }
  const w = 3.8, d = 17.4, h = 4.5;
  if (!isRailcarClearOfRoadsAndColliders(world, x, z, w, d)) return null;
  batcher.addWorldBox('matte_black', 3.4, 0.52, d, x, railTopY + 0.5, z);
  batcher.addWorldCylinder(spec.color, 1.72, 1.72, 15.2, x, railTopY + 2.48, z, 12, Math.PI * 0.5, 0, 0);
  batcher.addWorldCylinder(spec.band, 1.78, 1.78, 2.2, x, railTopY + 2.48, z, 12, Math.PI * 0.5, 0, 0);
  batcher.addWorldCylinder('gunmetal_concrete', 0.68, 0.75, 0.72, x, railTopY + 4.35, z, 8);
  for (const bz of [-5.8, 5.8]) batcher.addWorldBox('gunmetal_concrete', 2.4, 0.46, 2.8, x, railTopY + 0.28, z + bz);
  world.addCollider(x, z, w, d, railTopY + h, railTopY - 0.2);
  return { x, z, w, d, type: 'chemical_tank_car' };
}

export function buildIndustrialToPortFreightRailSpur(world, batcher) {
  if (!IS_SCALED_WORLD) {
    if (world.eastPortData) {
      world.eastPortData.hasFreightRailSpur = false;
      world.eastPortData.railTrackSegmentsCount = 0;
      world.eastPortData.freightRailCarsCount = 0;
    }
    return;
  }

  const mainWaypoints = buildFilletedWaypoints(MAIN_SPUR_RAW_WAYPOINTS, 6, 26);
  let trackSegments = emitTrackPolyline(world, batcher, mainWaypoints, false);
  for (const sid of RAIL_SIDINGS_SPEC) {
    trackSegments += emitTrackPolyline(world, batcher, buildFilletedWaypoints(sid.points, 4, 14), sid.inPort);
  }
  addBufferStop(world, batcher, 4096, -2662, -1);
  addBufferStop(world, batcher, 4760, 2042, 1);
  for (let i = 0; i < LEVEL_CROSSINGS_SPEC.length; i++) addLevelCrossingAndCrossbucks(world, batcher, LEVEL_CROSSINGS_SPEC[i]);

  const placedCars = [];
  for (const consist of PARKED_CONSISTS_SPEC) {
    let curZ = consist.startZ;
    for (let i = 0; i < consist.cars.length; i++) {
      const carSpec = consist.cars[i];
      const spanD = carSpec.kind === 'container' ? 19.4 : carSpec.kind === 'locomotive' ? 16.4 : 17.4;
      const carData = addParkedFreightCar(world, batcher, consist.x, curZ + spanD * 0.5, carSpec, consist.livery);
      if (carData) placedCars.push(carData);
      curZ += spanD + 1.3;
    }
  }

  if (world.industrialPCCData) world.industrialPCCData.hasFreightRailSpur = true;
  if (world.eastPortData) {
    world.eastPortData.hasFreightRailSpur = true;
    world.eastPortData.railTrackSegmentsCount = trackSegments;
    world.eastPortData.freightRailCarsCount = placedCars.length;
    world.eastPortData.railLevelCrossingsCount = LEVEL_CROSSINGS_SPEC.length;
    world.eastPortData.freightRailCars = placedCars;
    world.eastPortData.railWaypoints = mainWaypoints.map(([x, z]) => ({ x, z }));
  }
  if (world.mapOrganicRoads) {
    world.mapOrganicRoads.push({
      kind: 'polyline', id: 'east_industrial_port_freight_rail_spur', isRailSpur: true,
      isMain: false, width: BALLAST_W, sidewalk: 0, points: mainWaypoints
    });
  }
}
