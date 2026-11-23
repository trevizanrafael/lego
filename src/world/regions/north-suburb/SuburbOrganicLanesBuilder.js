/**
 * SuburbOrganicLanesBuilder.js
 * Ruas residenciais sinuosas, *cul-de-sacs* circulares com casas em leque (`rotY`) e loops curvos
 * para eliminar o vazio central das 54 super-quadras do Subúrbio Norte em `WORLD_SCALE = 3`.
 */
import * as THREE from 'three';
import { HOUSE_STYLE_KEYS, buildDetailedHouse } from '../../SuburbHouseGenerator.js';
import {
  createObb2D,
  obbInsideBounds2D,
  obbIntersectsObb2D,
  obbIntersectsRect2D,
  obbClearOfSegment2D,
  obbClearOfCircle2D
} from '../../buildings/LotGeometry2D.js';
import { ROAD, wsStreetAnchored } from '../../core/WorldLayoutScale.js';

const INTERIOR_STYLES = HOUSE_STYLE_KEYS.slice(0, 4);

function getFenceKeepouts() {
  return [[-70.75, -658], [70.75, -658], [-172, -790], [172, -790]].map(([dx, dz]) => {
    const p = wsStreetAnchored(dx, dz, { halfW: 1.2, halfD: 0.4 });
    return { minX: p.x - 5.5, maxX: p.x + 5.5, minZ: p.z - 4.5, maxZ: p.z + 4.5 };
  });
}

function addTerrainBandRibbon(world, batcher, matKey, pts, halfW, yLift) {
  const stations = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 8.0));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      stations.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]);
    }
  }
  stations.push(pts[pts.length - 1]);
  if (stations.length < 2) return;

  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const nStat = stations.length;
  const positions = [];
  const indices = [];

  const rightNormal = (k) => {
    const prev = stations[Math.max(0, k - 1)], cur = stations[k], next = stations[Math.min(nStat - 1, k + 1)];
    let ux0 = cur[0] - prev[0], uz0 = cur[1] - prev[1];
    let ux1 = next[0] - cur[0], uz1 = next[1] - cur[1];
    const l0 = Math.hypot(ux0, uz0), l1 = Math.hypot(ux1, uz1);
    if (l0 > 1e-5) { ux0 /= l0; uz0 /= l0; }
    if (l1 > 1e-5) { ux1 /= l1; uz1 /= l1; }
    if (l0 <= 1e-5) return [-uz1, ux1, 1];
    if (l1 <= 1e-5) return [-uz0, ux0, 1];
    let mx = ux0 + ux1, mz = uz0 + uz1;
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-4) return [-uz0, ux0, 1];
    mx /= ml; mz /= ml;
    const nx = -mz, nz = mx;
    const cosH = Math.abs(nx * -uz0 + nz * ux0);
    return [nx, nz, THREE.MathUtils.clamp(1 / Math.max(0.62, cosH), 1.0, 1.38)];
  };

  for (let k = 0; k < nStat; k++) {
    const [cx, cz] = stations[k];
    const [nx, nz, miter] = rightNormal(k);
    const hw = halfW * miter;
    const lx = cx - nx * hw, lz = cz - nz * hw, rx = cx + nx * hw, rz = cz + nz * hw;
    positions.push(lx, tAt(lx, lz) + yLift, lz, cx, tAt(cx, cz) + yLift, cz, rx, tAt(rx, rz) + yLift, rz);
  }
  for (let k = 0; k < nStat - 1; k++) {
    const a = k * 3, b = (k + 1) * 3;
    indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  batcher.addCustomGeo(matKey, geo);
}

function addTerrainDiscOrRing(world, batcher, matKey, cx, cz, innerR, outerR, yLift, segs = 36) {
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const geo = innerR <= 0.05 ? new THREE.CircleGeometry(outerR, segs) : new THREE.RingGeometry(innerR, outerR, segs, 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, tAt(pos.getX(i), pos.getZ(i)) + yLift);
  geo.computeVertexNormals();
  batcher.addCustomGeo(matKey, geo);
}

function pushInteriorRoadTile(ctx, tx, tz) {
  if (tx >= ctx.innerMinX + 15 && tx <= ctx.innerMaxX - 15 && tz >= ctx.innerMinZ + 15 && tz <= ctx.safeSouthZ - 15) {
    const tile = { x: tx, z: tz, w: 10, d: 10, isMain: false, isOrganicTile: true };
    ctx.world.mapRoads.push(tile);
    ctx.localRoadTiles.push(tile);
  }
}

function registerOrganicLane(ctx, id, points, width = 17, sidewalk = 5, addCenterDashes = false) {
  const { world, batcher, innerMinX, innerMaxX, segments } = ctx;
  const halfWidth = width * 0.5;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  world.mapOrganicRoads.push({ kind: 'polyline', id, points, width, sidewalk, isMain: false });

  addTerrainBandRibbon(world, batcher, 'walkway_stone', points, halfWidth + sidewalk, 0.085);
  addTerrainBandRibbon(world, batcher, 'asphalt_lot', points, halfWidth, 0.108);

  for (let i = 0; i < points.length; i++) {
    const [vx, vz] = points[i];
    if (vx > innerMinX + halfWidth + 2 && vx < innerMaxX - halfWidth - 2) {
      addTerrainDiscOrRing(world, batcher, 'asphalt_lot', vx, vz, 0, halfWidth * 0.98, 0.109, 18);
    }
  }

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i], [x2, z2] = points[i + 1];
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    segments.push({ x1, z1, x2, z2, halfWidth, sidewalk });

    const steps = Math.max(1, Math.round(len / 9.0));
    for (let s = 0; s <= steps; s++) pushInteriorRoadTile(ctx, x1 + (dx * s) / steps, z1 + (dz * s) / steps);

    if (addCenterDashes && len >= 14) {
      const yaw = Math.atan2(dx / len, dz / len), y1 = tAt(x1, z1);
      batcher.setTransform(x1, z1, yaw, world, y1);
      for (let dPos = 6.0; dPos < len - 5.5; dPos += 10.5) {
        batcher.addBox('trim_white', 0.28, 0.03, 3.8, x1, y1 + 0.124, z1 + dPos);
      }
      batcher.clearTransform();
    }
  }

  for (const [px, pz] of [points[0], points[points.length - 1]]) {
    if (Math.abs(px - innerMinX) < 5.0 || Math.abs(px - innerMaxX) < 5.0) {
      const ax = Math.abs(px - innerMinX) < 5.0 ? innerMinX - ROAD.sidewalk * 0.5 : innerMaxX + ROAD.sidewalk * 0.5;
      batcher.addBox('driveway_concrete', ROAD.sidewalk - 0.4, 0.05, width - 1.5, ax, tAt(ax, pz) + 0.025, pz);
    }
  }
}

function registerCulDeSacBulb(ctx, id, cx, cz, innerR = 6.8, outerR = 22.0, sidewalk = 5.0, seed = 1) {
  const { world, batcher, bulbs } = ctx;
  world.mapOrganicRoads.push({ kind: 'roundabout', id, cx, cz, innerR, outerR, sidewalk });
  bulbs.push({ cx, cz, innerR, outerR, sidewalk });

  addTerrainDiscOrRing(world, batcher, 'walkway_stone', cx, cz, Math.max(0.5, innerR - 0.8), outerR + sidewalk, 0.085, 42);
  addTerrainDiscOrRing(world, batcher, 'asphalt_lot', cx, cz, innerR, outerR, 0.109, 42);

  const rMid = (innerR + outerR) * 0.5;
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2;
    pushInteriorRoadTile(ctx, cx + Math.cos(ang) * rMid, cz + Math.sin(ang) * rMid);
  }

  const gY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0;
  const curbCyl = new THREE.CylinderGeometry(innerR, innerR + 0.15, 0.58, 24);
  curbCyl.translate(cx, gY + 0.02, cz);
  batcher.addCustomGeo('walkway_stone', curbCyl);

  const turfCyl = new THREE.CylinderGeometry(innerR - 0.7, innerR - 0.6, 0.18, 24);
  turfCyl.translate(cx, gY + 0.28, cz);
  batcher.addCustomGeo('lawn_green', turfCyl);

  const flKey = seed % 2 === 0 ? 'flower_pink' : 'flower_yellow';
  for (let f = 0; f < 6; f++) {
    const fa = (f / 6) * Math.PI * 2;
    batcher.addBox(flKey, 1.3, 0.32, 1.3, cx + Math.cos(fa) * (innerR * 0.56), gY + 0.42, cz + Math.sin(fa) * (innerR * 0.56));
  }
  batcher.addFloweringTree(cx, gY + 0.34, cz, 1.32, seed % 2 === 0 ? 'pink' : 'yellow');
  world.addCylinderCollider?.(cx, cz, innerR, gY + 4.6, gY);
  if (world.suburbOrganicStats) world.suburbOrganicStats.culDeSacs++;
}

function tryPlaceOrganicHouse(ctx, lx, lz, lotW, lotD, targetX, targetZ, seed, forceStyle = null) {
  const { world, batcher, innerMinX, innerMaxX, innerMinZ, safeSouthZ, segments, bulbs, keepouts, placedObbs } = ctx;
  const rotY = Math.atan2(targetX - lx, targetZ - lz);
  const obb = createObb2D(lx, lz, lotW, lotD, rotY, 0);

  if (!obbInsideBounds2D(obb, innerMinX + 2.5, innerMaxX - 2.5, innerMinZ + 2.5, safeSouthZ - 2.5, 0)) return false;
  for (let i = 0; i < placedObbs.length; i++) if (obbIntersectsObb2D(obb, placedObbs[i], 1.2)) return false;
  for (let i = 0; i < keepouts.length; i++) {
    const k = keepouts[i];
    if (obbIntersectsRect2D(obb, k.minX, k.maxX, k.minZ, k.maxZ, 1.5)) return false;
  }
  for (let i = 0; i < bulbs.length; i++) {
    const b = bulbs[i];
    if (!obbClearOfCircle2D(obb, b.cx, b.cz, b.outerR + b.sidewalk + 0.8)) return false;
  }
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!obbClearOfSegment2D(obb, s.x1, s.z1, s.x2, s.z2, s.halfWidth + s.sidewalk + 0.7)) return false;
  }

  const envHalf = Math.max(lotW, 23) * 0.5 + 1.0;
  for (const list of [ctx.localRoadTiles, ctx.perimeterRoads]) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.isElevated || r.isBridge) continue;
      const rMinX = r.x - r.w * 0.5, rMaxX = r.x + r.w * 0.5, rMinZ = r.z - r.d * 0.5, rMaxZ = r.z + r.d * 0.5;
      if (lx - envHalf < rMaxX && lx + envHalf > rMinX && lz - envHalf < rMaxZ && lz + envHalf > rMinZ) return false;
      if (obbIntersectsRect2D(obb, rMinX, rMaxX, rMinZ, rMaxZ, 1.2)) return false;
    }
  }

  placedObbs.push(obb);
  const styleKey = forceStyle || INTERIOR_STYLES[Math.abs(seed) % INTERIOR_STYLES.length];
  buildDetailedHouse(world, batcher, {
    x: lx, z: lz, lotW, lotD, facingDirZ: 1, rotY, apronLen: 5.2, skipBreakableProps: true, styleKey, seed
  });
  if (world.suburbOrganicStats) {
    world.suburbOrganicStats.interiorHouses++;
    if (Math.abs(rotY) > 1e-3) world.suburbOrganicStats.rotatedHouses++;
  }
  return true;
}

function placeFanHousesAroundBulb(ctx, bx, bz, outerR, sw, entryAngle, fanCount, lotW, lotD, baseSeed) {
  const rCenter = outerR + sw + 2.2 + lotD * 0.5;
  const startOff = 0.64, span = Math.PI * 2 - startOff * 2;
  for (let i = 0; i < fanCount; i++) {
    const ang = entryAngle + startOff + (fanCount === 1 ? span * 0.5 : (i / (fanCount - 1)) * span);
    const forceStyle = i % 3 === 1 ? 'suburb_mansion_pool' : i % 3 === 2 ? 'modern_wood_chalet' : null;
    tryPlaceOrganicHouse(ctx, bx + Math.cos(ang) * rCenter, bz + Math.sin(ang) * rCenter, lotW, lotD, bx, bz, baseSeed + i * 11, forceStyle);
  }
}

function placeHousesAlongPolyline(ctx, pts, halfRoadAndSw, lotW, lotD, sides, stepDist, trimEnds, baseSeed) {
  let acc = 0, idx = 0, nextS = trimEnds, totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  const maxS = totalLen - trimEnds, offset = halfRoadAndSw + 1.6 + lotD * 0.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], segLen = Math.hypot(x2 - x1, z2 - z1);
    if (segLen < 1) continue;
    const ux = (x2 - x1) / segLen, uz = (z2 - z1) / segLen, nx = -uz, nz = ux;
    while (nextS <= acc + segLen && nextS <= maxS) {
      const px = x1 + ux * (nextS - acc), pz = z1 + uz * (nextS - acc);
      for (const side of sides) {
        tryPlaceOrganicHouse(ctx, px + nx * side * offset, pz + nz * side * offset, lotW, lotD, px, pz, baseSeed + idx * 7 + (side > 0 ? 3 : 0));
      }
      idx++;
      nextS += stepDist;
    }
    acc += segLen;
  }
}

function createBlockContext(world, batcher, bounds, extraKeepouts = []) {
  if (!world.mapOrganicRoads) world.mapOrganicRoads = [];
  if (!world.suburbOrganicStats) world.suburbOrganicStats = { culDeSacs: 0, lanes: 0, interiorHouses: 0, rotatedHouses: 0 };
  const { innerMinX, innerMaxX, innerMinZ, safeSouthZ, northLotD = 32, southLotD = 32 } = bounds;
  const placedObbs = [];
  if (northLotD > 0) placedObbs.push(createObb2D((innerMinX + innerMaxX) * 0.5, innerMinZ + northLotD * 0.5, innerMaxX - innerMinX, northLotD, 0, 0));
  if (southLotD > 0) placedObbs.push(createObb2D((innerMinX + innerMaxX) * 0.5, safeSouthZ - southLotD * 0.5, innerMaxX - innerMinX, southLotD, 0, 0));
  const pad = 45;
  const perimeterRoads = (world.mapRoads || []).filter(
    (r) => !r.isOrganicTile && !r.isElevated && !r.isBridge &&
      r.x + r.w * 0.5 >= innerMinX - pad && r.x - r.w * 0.5 <= innerMaxX + pad &&
      r.z + r.d * 0.5 >= innerMinZ - pad && r.z - r.d * 0.5 <= safeSouthZ + pad
  );
  return {
    world, batcher, innerMinX, innerMaxX, innerMinZ, safeSouthZ,
    segments: [], bulbs: [], keepouts: [...getFenceKeepouts(), ...extraKeepouts],
    placedObbs, localRoadTiles: [], perimeterRoads
  };
}

export function buildSuburbSuperBlockOrganicInterior(world, batcher, cfg) {
  const { rIdx, cIdx, innerMinX, innerMaxX, innerMinZ, safeSouthZ, northLotD = 32, southLotD = 32 } = cfg;
  const coreMinZ = innerMinZ + northLotD + 4, coreMaxZ = safeSouthZ - southLotD - 4;
  if (coreMaxZ - coreMinZ < 170) return;

  const ctx = createBlockContext(world, batcher, cfg);
  const cx = (innerMinX + innerMaxX) * 0.5, cz = (coreMinZ + coreMaxZ) * 0.5, spanX = innerMaxX - innerMinX;
  const pattern = (rIdx * 2 + cIdx) % 3, flip = (rIdx + cIdx) % 2 === 0 ? 1 : -1, seed = (rIdx + 1) * 131 + (cIdx + 1) * 37;

  if (pattern === 0) {
    // PADRÃO A — Cul-de-Sac Duplo Oposto com Casas em Leque (rotY)
    const b1x = cx - spanX * 0.135, b1z = cz - flip * 54;
    const stem1 = [[innerMinX + 1.5, cz - flip * 34], [innerMinX + spanX * 0.14, cz - flip * 62], [b1x - 24, b1z - flip * 8], [b1x, b1z]];
    registerOrganicLane(ctx, `sub_cds_w_${rIdx}_${cIdx}`, stem1, 16.5, 4.8, false);
    registerCulDeSacBulb(ctx, `sub_bulb_w_${rIdx}_${cIdx}`, b1x, b1z, 6.8, 22.0, 5.0, seed);

    const b2x = cx + spanX * 0.135, b2z = cz + flip * 54;
    const stem2 = [[innerMaxX - 1.5, cz + flip * 34], [innerMaxX - spanX * 0.14, cz + flip * 62], [b2x + 24, b2z + flip * 8], [b2x, b2z]];
    registerOrganicLane(ctx, `sub_cds_e_${rIdx}_${cIdx}`, stem2, 16.5, 4.8, false);
    registerCulDeSacBulb(ctx, `sub_bulb_e_${rIdx}_${cIdx}`, b2x, b2z, 6.8, 21.5, 5.0, seed + 1);
    world.suburbOrganicStats.lanes += 2;

    placeFanHousesAroundBulb(ctx, b1x, b1z, 22.0, 5.0, Math.atan2(stem1[2][1] - b1z, stem1[2][0] - b1x), 6, 22.5, 29, seed + 10);
    placeFanHousesAroundBulb(ctx, b2x, b2z, 21.5, 5.0, Math.atan2(stem2[2][1] - b2z, stem2[2][0] - b2x), 6, 22.5, 29, seed + 40);
    placeHousesAlongPolyline(ctx, stem1.slice(0, 3), 13.1, 23, 28, [-1, 1], 26, 22, seed + 70);
    placeHousesAlongPolyline(ctx, stem2.slice(0, 3), 13.1, 23, 28, [-1, 1], 26, 22, seed + 90);
  } else if (pattern === 1) {
    // PADRÃO B — Alameda Sinuosa em "S" ("Winding Hill Lane") + Cul-de-Sac de Encosta
    const sPts = [], z0 = cz + flip * 18, z1 = cz - flip * 18;
    for (let i = 0; i <= 7; i++) {
      const t = i / 7, wave = Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * (flip * 44);
      sPts.push([Math.round(((innerMinX + 1.5) + (spanX - 3.0) * t) * 10) / 10, Math.round((z0 + (z1 - z0) * t + wave) * 10) / 10]);
    }
    registerOrganicLane(ctx, `sub_slane_${rIdx}_${cIdx}`, sPts, 18.0, 4.5, true);

    const pBulbX = cx + spanX * 0.16, pBulbZ = cz - flip * 66;
    const spurPts = [sPts[2], [cx - 10, cz - flip * 52], [pBulbX, pBulbZ]];
    registerOrganicLane(ctx, `sub_sspur_${rIdx}_${cIdx}`, spurPts, 15.5, 4.5, false);
    registerCulDeSacBulb(ctx, `sub_sbulb_${rIdx}_${cIdx}`, pBulbX, pBulbZ, 6.5, 20.0, 4.8, seed + 3);
    world.suburbOrganicStats.lanes += 2;

    placeFanHousesAroundBulb(ctx, pBulbX, pBulbZ, 20.0, 4.8, Math.atan2(spurPts[1][1] - pBulbZ, spurPts[1][0] - pBulbX), 5, 22, 28, seed + 15);
    placeHousesAlongPolyline(ctx, sPts, 13.5, 23.5, 29, [-1, 1], 27, 26, seed + 45);
  } else {
    // PADRÃO C — Ferradura / Loop Residencial Curvo ("Crescent Loop") + Parque Central de Bairro
    const archPts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, arch = Math.sin(t * Math.PI) * (flip * 94);
      archPts.push([Math.round(((innerMinX + 1.5) + (spanX - 3.0) * t) * 10) / 10, Math.round((cz - flip * 42 + arch) * 10) / 10]);
    }
    registerOrganicLane(ctx, `sub_crescent_${rIdx}_${cIdx}`, archPts, 17.0, 4.8, true);
    world.suburbOrganicStats.lanes++;

    const pkX = cx, pkZ = cz - flip * 24;
    ctx.keepouts.push({ minX: pkX - 36, maxX: pkX + 36, minZ: pkZ - 24, maxZ: pkZ + 24 });
    const pkY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(pkX, pkZ) : 0) + 0.08;
    addTerrainDiscOrRing(world, batcher, 'walkway_stone', pkX, pkZ, 0, 11.5, 0.09, 24);
    addTerrainDiscOrRing(world, batcher, 'lawn_green', pkX, pkZ, 0, 8.2, 0.11, 24);
    batcher.addBox('flower_red', 3.2, 0.36, 3.2, pkX, pkY + 0.16, pkZ);
    for (const dxB of [-7.5, 7.5]) {
      const by = (world.getTerrainHeightAt ? world.getTerrainHeightAt(pkX + dxB, pkZ) : 0) + 0.09;
      batcher.addBox('wood_warm', 1.1, 0.55, 3.2, pkX + dxB, by + 0.28, pkZ);
    }
    for (let t = 0; t < 5; t++) {
      const ta = (t / 5) * Math.PI * 2 + 0.3, tx = pkX + Math.cos(ta) * 20, tz = pkZ + Math.sin(ta) * 15;
      batcher.addFloweringTree(tx, (world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, tz) : 0) + 0.06, tz, 1.18, t % 2 === 0 ? 'pink' : 'yellow');
    }
    placeHousesAlongPolyline(ctx, archPts, 13.3, 23.5, 29, [-1, 1], 27, 26, seed + 20);
  }
}

export function buildSpecialBlockOrganicPocket(world, batcher, cfg) {
  const { id, innerMinX, innerMaxX, innerMinZ, safeSouthZ, northLotD = 0, southLotD = 0, specialKeepout, entrySide = 'west', pocketZ, seed = 77 } = cfg;
  const ctx = createBlockContext(world, batcher, { innerMinX, innerMaxX, innerMinZ, safeSouthZ, northLotD, southLotD }, [specialKeepout]);
  const cx = (innerMinX + innerMaxX) * 0.5, fromWest = entrySide === 'west';
  const bx = fromWest ? cx + 18 : cx - 18, bz = pocketZ, startX = fromWest ? innerMinX + 1.5 : innerMaxX - 1.5;
  const pts = [[startX, bz + 16], [(startX + bx) * 0.5, bz - 18], [bx, bz]];

  registerOrganicLane(ctx, `sub_spec_lane_${id}`, pts, 16.0, 4.6, false);
  registerCulDeSacBulb(ctx, `sub_spec_bulb_${id}`, bx, bz, 6.5, 20.5, 4.8, seed);
  world.suburbOrganicStats.lanes++;

  placeFanHousesAroundBulb(ctx, bx, bz, 20.5, 4.8, Math.atan2(pts[1][1] - bz, pts[1][0] - bx), 5, 22, 28, seed + 12);
  placeHousesAlongPolyline(ctx, pts.slice(0, 2), 12.6, 22.5, 27, [-1, 1], 26, 22, seed + 50);
}
