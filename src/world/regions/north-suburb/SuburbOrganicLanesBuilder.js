/**
 * SuburbOrganicLanesBuilder.js
 * Alamedas residenciais sinuosas, *cul-de-sacs* densos com casas em leque (`rotY`), frentes laterais N-S,
 * arborização viária e praças de bolso / playgrounds nas 54 super-quadras do Subúrbio Norte (`WORLD_SCALE = 3`).
 */
import * as THREE from 'three';
import { HOUSE_STYLE_KEYS, buildDetailedHouse } from '../../SuburbHouseGenerator.js';
import {
  createObb2D,
  localToWorldXZ,
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

function addTerrainDiscOrRing(world, batcher, matKey, cx, cz, innerR, outerR, yLift, segs = 32) {
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

function registerOrganicLane(ctx, id, points, width = 16, sidewalk = 4.6, addCenterDashes = false) {
  const { world, batcher, innerMinX, innerMaxX, segments } = ctx;
  const halfWidth = width * 0.5;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  world.mapOrganicRoads.push({ kind: 'polyline', id, points, width, sidewalk, isMain: false });

  addTerrainBandRibbon(world, batcher, 'walkway_stone', points, halfWidth + sidewalk, 0.095);
  addTerrainBandRibbon(world, batcher, 'asphalt_lot', points, halfWidth, 0.118);

  for (let i = 0; i < points.length; i++) {
    const [vx, vz] = points[i];
    if (vx > innerMinX + halfWidth + 2 && vx < innerMaxX - halfWidth - 2) {
      addTerrainDiscOrRing(world, batcher, 'asphalt_lot', vx, vz, 0, halfWidth * 0.98, 0.120, 16);
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
        batcher.addBox('stripe_white', 0.28, 0.03, 3.8, x1, y1 + 0.138, z1 + dPos);
      }
      batcher.clearTransform();
    }
  }

  for (const [px, pz] of [points[0], points[points.length - 1]]) {
    if (Math.abs(px - innerMinX) < 5.0 || Math.abs(px - innerMaxX) < 5.0) {
      const ax = Math.abs(px - innerMinX) < 5.0 ? innerMinX - ROAD.sidewalk * 0.5 : innerMaxX + ROAD.sidewalk * 0.5;
      batcher.addBox('driveway_concrete', ROAD.sidewalk - 0.4, 0.05, width - 1.5, ax, tAt(ax, pz) + 0.03, pz);
    }
  }
}

function registerCulDeSacBulb(ctx, id, cx, cz, innerR = 6.5, outerR = 20.5, sidewalk = 4.6, seed = 1) {
  const { world, batcher, bulbs } = ctx;
  world.mapOrganicRoads.push({ kind: 'roundabout', id, cx, cz, innerR, outerR, sidewalk });
  bulbs.push({ cx, cz, innerR, outerR, sidewalk });

  addTerrainDiscOrRing(world, batcher, 'walkway_stone', cx, cz, Math.max(0.5, innerR - 0.8), outerR + sidewalk, 0.095, 36);
  addTerrainDiscOrRing(world, batcher, 'asphalt_lot', cx, cz, innerR, outerR, 0.120, 36);

  const rMid = (innerR + outerR) * 0.5;
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2;
    pushInteriorRoadTile(ctx, cx + Math.cos(ang) * rMid, cz + Math.sin(ang) * rMid);
  }

  const gY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0;
  const curbCyl = new THREE.CylinderGeometry(innerR, innerR + 0.15, 0.54, 20);
  curbCyl.translate(cx, gY + 0.04, cz);
  batcher.addCustomGeo('walkway_stone', curbCyl);

  const turfCyl = new THREE.CylinderGeometry(innerR - 0.7, innerR - 0.6, 0.18, 20);
  turfCyl.translate(cx, gY + 0.28, cz);
  batcher.addCustomGeo('lawn_green', turfCyl);

  const flKey = seed % 2 === 0 ? 'flower_pink' : 'flower_yellow';
  for (let f = 0; f < 6; f++) {
    const fa = (f / 6) * Math.PI * 2;
    batcher.addBox(flKey, 1.2, 0.30, 1.2, cx + Math.cos(fa) * (innerR * 0.55), gY + 0.42, cz + Math.sin(fa) * (innerR * 0.55));
  }
  batcher.addFloweringTree(cx, gY + 0.34, cz, 1.28, seed % 2 === 0 ? 'pink' : 'yellow');
  world.addCylinderCollider?.(cx, cz, innerR, gY + 4.6, gY);
  if (world.suburbOrganicStats) world.suburbOrganicStats.culDeSacs++;
}

function buildPocketGreenAndPlayground(ctx, pkX, pkZ, rx = 24, rz = 18, seed = 1) {
  const { world, batcher, keepouts, segments, bulbs } = ctx;
  for (const b of bulbs) if (Math.hypot(pkX - b.cx, pkZ - b.cz) < b.outerR + b.sidewalk + Math.max(rx, rz)) return;
  for (const s of segments) {
    const mx = (s.x1 + s.x2) * 0.5, mz = (s.z1 + s.z2) * 0.5;
    if (Math.hypot(pkX - mx, pkZ - mz) < s.halfWidth + s.sidewalk + Math.min(rx, rz) * 0.75) return;
  }
  keepouts.push({ minX: pkX - rx, maxX: pkX + rx, minZ: pkZ - rz, maxZ: pkZ + rz });
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const pY = tAt(pkX, pkZ) + 0.08;

  addTerrainDiscOrRing(world, batcher, 'walkway_stone', pkX, pkZ, 0, Math.min(rx, rz) * 0.72, 0.095, 22);
  addTerrainDiscOrRing(world, batcher, 'lawn_green', pkX, pkZ, 0, Math.min(rx, rz) * 0.52, 0.115, 22);

  // Mini playground infantil (caixa de areia, torre de madeira com telhado colorido e escorregador)
  batcher.addBox('wall_tan', 5.2, 0.24, 4.4, pkX - 2.2, pY + 0.14, pkZ);
  batcher.addBox('wood_warm', 2.0, 2.6, 2.0, pkX - 2.8, pY + 1.35, pkZ);
  batcher.addBox('roof_red', 2.6, 0.55, 2.6, pkX - 2.8, pY + 2.85, pkZ);
  batcher.addBox('court_blue', 2.4, 0.25, 0.9, pkX - 0.9, pY + 0.95, pkZ);
  batcher.addBox('flower_yellow', 2.4, 0.35, 2.4, pkX + 3.2, pY + 0.22, pkZ);

  for (const dxB of [-7.4, 7.4]) {
    const by = tAt(pkX + dxB, pkZ) + 0.09;
    batcher.addBox('wood_warm', 1.0, 0.52, 3.0, pkX + dxB, by + 0.26, pkZ);
  }
  for (let t = 0; t < 4; t++) {
    const ta = (t / 4) * Math.PI * 2 + 0.45;
    const tx = pkX + Math.cos(ta) * (rx * 0.72), tz = pkZ + Math.sin(ta) * (rz * 0.72);
    if (t % 2 === 0) batcher.addFloweringTree(tx, tAt(tx, tz) + 0.06, tz, 1.12, seed % 2 === 0 ? 'pink' : 'yellow');
    else world._addLegoTree(tx, tAt(tx, tz) + 0.06, tz, 1.02);
  }
}

function tryPlaceOrganicHouse(ctx, lx, lz, lotW, lotD, targetX, targetZ, seed, forceStyle = null, apronLen = 4.6) {
  const { world, batcher, innerMinX, innerMaxX, innerMinZ, safeSouthZ, segments, bulbs, keepouts, placedObbs } = ctx;
  const rotY = Math.atan2(targetX - lx, targetZ - lz);
  const obb = createObb2D(lx, lz, lotW, lotD, rotY, 0);

  if (!obbInsideBounds2D(obb, innerMinX + 0.8, innerMaxX - 0.8, innerMinZ + 1.5, safeSouthZ - 1.5, 0)) return false;
  for (let i = 0; i < placedObbs.length; i++) if (obbIntersectsObb2D(obb, placedObbs[i], 0.45)) return false;
  for (let i = 0; i < keepouts.length; i++) {
    const k = keepouts[i];
    if (obbIntersectsRect2D(obb, k.minX, k.maxX, k.minZ, k.maxZ, 1.0)) return false;
  }
  for (let i = 0; i < bulbs.length; i++) {
    const b = bulbs[i];
    if (!obbClearOfCircle2D(obb, b.cx, b.cz, b.outerR + b.sidewalk + 0.5)) return false;
  }
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!obbClearOfSegment2D(obb, s.x1, s.z1, s.x2, s.z2, s.halfWidth + s.sidewalk + 0.45)) return false;
  }

  // Garante 0 sobreposição com `world.mapRoads` considerando o footprint registrado em `mapBuildings`
  const houseLocalZ = lotD * 0.5 - (5.4 + Math.min(11.8, lotD * 0.40) * 0.5);
  const hm = localToWorldXZ(lx, lz, 0, houseLocalZ, obb.cosY, obb.sinY);
  const hHalfW = Math.max(5.0, (lotW - 2.0) * 0.5) + 0.8;
  const hHalfD = Math.max(5.0, (lotD * 0.42) * 0.5) + 0.8;
  const envR = Math.max(hHalfW, hHalfD);

  for (const list of [ctx.localRoadTiles, ctx.perimeterRoads]) {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.isElevated || r.isBridge) continue;
      const rMinX = r.x - r.w * 0.5, rMaxX = r.x + r.w * 0.5, rMinZ = r.z - r.d * 0.5, rMaxZ = r.z + r.d * 0.5;
      if (hm.x - envR < rMaxX && hm.x + envR > rMinX && hm.z - envR < rMaxZ && hm.z + envR > rMinZ) return false;
      if (obbIntersectsRect2D(obb, rMinX, rMaxX, rMinZ, rMaxZ, 0.8)) return false;
    }
  }

  placedObbs.push(obb);
  const styleKey = forceStyle || INTERIOR_STYLES[Math.abs(seed) % INTERIOR_STYLES.length];
  buildDetailedHouse(world, batcher, {
    x: lx, z: lz, lotW, lotD, facingDirZ: 1, rotY, apronLen, skipBreakableProps: true, styleKey, seed
  });
  if (world.suburbOrganicStats) {
    world.suburbOrganicStats.interiorHouses++;
    if (Math.abs(rotY) > 1e-3) world.suburbOrganicStats.rotatedHouses++;
  }
  return true;
}

function placeFanHousesAroundBulb(ctx, bx, bz, outerR, sw, entryAngle, fanCount, lotW, lotD, baseSeed) {
  const rCenter = outerR + sw + 1.4 + lotD * 0.5;
  const startOff = 0.56, span = Math.PI * 2 - startOff * 2;
  for (let i = 0; i < fanCount; i++) {
    const ang = entryAngle + startOff + (fanCount === 1 ? span * 0.5 : (i / (fanCount - 1)) * span);
    const forceStyle = i % 4 === 1 ? 'suburb_mansion_pool' : i % 4 === 2 ? 'modern_wood_chalet' : null;
    tryPlaceOrganicHouse(ctx, bx + Math.cos(ang) * rCenter, bz + Math.sin(ang) * rCenter, lotW, lotD, bx, bz, baseSeed + i * 11, forceStyle);
  }
}

function placeHousesAlongPolyline(ctx, pts, halfRoadAndSw, lotW, lotD, sides, stepDist, trimEnds, baseSeed) {
  const { world, batcher, bulbs, segments } = ctx;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  let acc = 0, idx = 0, nextS = trimEnds, totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  const maxS = totalLen - trimEnds, offset = halfRoadAndSw + 1.0 + lotD * 0.5;

  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], segLen = Math.hypot(x2 - x1, z2 - z1);
    if (segLen < 1) continue;
    const ux = (x2 - x1) / segLen, uz = (z2 - z1) / segLen, nx = -uz, nz = ux;
    while (nextS <= acc + segLen && nextS <= maxS) {
      const px = x1 + ux * (nextS - acc), pz = z1 + uz * (nextS - acc);
      for (const side of sides) {
        const placed = tryPlaceOrganicHouse(
          ctx, px + nx * side * offset, pz + nz * side * offset, lotW, lotD, px, pz, baseSeed + idx * 7 + (side > 0 ? 3 : 0)
        );
        if (placed && idx % 2 === 0) {
          const tx = px + nx * side * (halfRoadAndSw + 0.9) + ux * (lotW * 0.48);
          const tz = pz + nz * side * (halfRoadAndSw + 0.9) + uz * (lotW * 0.48);
          let clear = true;
          for (const b of bulbs) if (Math.hypot(tx - b.cx, tz - b.cz) < b.outerR + b.sidewalk + 2.0) clear = false;
          for (const s of segments) if (Math.hypot(tx - s.x1, tz - s.z1) < s.halfWidth + 2.0) clear = false;
          if (clear) {
            if ((idx + (side > 0 ? 1 : 0)) % 3 === 0) batcher.addFloweringTree(tx, tAt(tx, tz) + 0.06, tz, 0.98, idx % 4 === 0 ? 'pink' : 'yellow');
            else world._addLegoTree(tx, tAt(tx, tz) + 0.06, tz, 0.96);
          }
        }
      }
      idx++;
      nextS += stepDist;
    }
    acc += segLen;
  }
}

function placeSideAvenueFrontageHouses(ctx, baseSeed) {
  const { world, batcher, innerMinX, innerMaxX, innerMinZ, safeSouthZ, segments } = ctx;
  const lotW = 17.2, lotD = 26.5, stepZ = 17.8;
  const startZ = innerMinZ + 36, endZ = safeSouthZ - 36;
  if (endZ - startZ < 22) return;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const apron = Math.max(1.0, ROAD.sidewalk - 0.8);

  let rowIdx = 0;
  for (let zPos = startZ; zPos <= endZ; zPos += stepZ) {
    const wPlaced = tryPlaceOrganicHouse(ctx, innerMinX + lotD * 0.5 + 0.9, zPos, lotW, lotD, innerMinX - 10, zPos, baseSeed + rowIdx * 13, null, apron);
    const ePlaced = tryPlaceOrganicHouse(ctx, innerMaxX - lotD * 0.5 - 0.9, zPos, lotW, lotD, innerMaxX + 10, zPos, baseSeed + rowIdx * 13 + 5, null, apron);
    if (rowIdx % 2 === 0) {
      const tz = zPos + lotW * 0.48;
      if (wPlaced && segments.every((s) => Math.hypot(innerMinX + 1.0 - s.x1, tz - s.z1) > 12)) {
        world._addLegoTree(innerMinX + 1.0, tAt(innerMinX + 1.0, tz) + 0.06, tz, 1.0);
      }
      if (ePlaced && segments.every((s) => Math.hypot(innerMaxX - 1.0 - s.x2, tz - s.z2) > 12)) {
        batcher.addFloweringTree(innerMaxX - 1.0, tAt(innerMaxX - 1.0, tz) + 0.06, tz, 1.0, rowIdx % 4 === 0 ? 'pink' : 'yellow');
      }
    }
    rowIdx++;
  }
}

function createBlockContext(world, batcher, bounds, extraKeepouts = []) {
  if (!world.mapOrganicRoads) world.mapOrganicRoads = [];
  if (!world.suburbOrganicStats) world.suburbOrganicStats = { culDeSacs: 0, lanes: 0, interiorHouses: 0, rotatedHouses: 0 };
  const { innerMinX, innerMaxX, innerMinZ, safeSouthZ, northLotD = 30, southLotD = 30 } = bounds;
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
  const { rIdx, cIdx, innerMinX, innerMaxX, innerMinZ, safeSouthZ, northLotD = 30, southLotD = 30 } = cfg;
  const coreMinZ = innerMinZ + northLotD + 4, coreMaxZ = safeSouthZ - southLotD - 4;
  if (coreMaxZ - coreMinZ < 170) return;

  const ctx = createBlockContext(world, batcher, cfg);
  const cx = (innerMinX + innerMaxX) * 0.5, cz = (coreMinZ + coreMaxZ) * 0.5, spanX = innerMaxX - innerMinX;
  const pattern = (rIdx * 2 + cIdx) % 3, flip = (rIdx + cIdx) % 2 === 0 ? 1 : -1, seed = (rIdx + 1) * 131 + (cIdx + 1) * 37;

  const buildGentleEWPoints = (zBase, waveAmp) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const px = Math.round(((innerMinX + 1.5) + (spanX - 3.0) * t) * 10) / 10;
      const pz = Math.round((zBase + Math.sin(t * Math.PI * 2) * waveAmp) * 10) / 10;
      pts.push([px, pz]);
    }
    return pts;
  };

  if (pattern === 0) {
    // 2 ruas internas fundo-com-fundo c/ as faces Norte/Sul + 2 cul-de-sacs centrais e praça de bolso
    const laneN = buildGentleEWPoints(cz - 82, flip * 5.5);
    const laneS = buildGentleEWPoints(cz + 82, -flip * 5.5);
    registerOrganicLane(ctx, `sub_cross_n_${rIdx}_${cIdx}`, laneN, 15.5, 4.4, true);
    registerOrganicLane(ctx, `sub_cross_s_${rIdx}_${cIdx}`, laneS, 15.5, 4.4, true);

    const b1x = cx - spanX * 0.16, b1z = cz - flip * 8;
    const stem1 = [[innerMinX + 1.5, cz - flip * 4], [innerMinX + spanX * 0.16, cz - flip * 11], [b1x, b1z]];
    registerOrganicLane(ctx, `sub_cds_w_${rIdx}_${cIdx}`, stem1, 15.0, 4.4, false);
    registerCulDeSacBulb(ctx, `sub_bulb_w_${rIdx}_${cIdx}`, b1x, b1z, 6.2, 19.6, 4.5, seed);

    const b2x = cx + spanX * 0.16, b2z = cz + flip * 8;
    const stem2 = [[innerMaxX - 1.5, cz + flip * 4], [innerMaxX - spanX * 0.16, cz + flip * 11], [b2x, b2z]];
    registerOrganicLane(ctx, `sub_cds_e_${rIdx}_${cIdx}`, stem2, 15.0, 4.4, false);
    registerCulDeSacBulb(ctx, `sub_bulb_e_${rIdx}_${cIdx}`, b2x, b2z, 6.2, 19.6, 4.5, seed + 1);
    world.suburbOrganicStats.lanes += 4;

    buildPocketGreenAndPlayground(ctx, cx, cz, 19, 14, seed + 5);
    placeHousesAlongPolyline(ctx, laneN, 12.15, 16.4, 25.5, [-1, 1], 17.2, 20, seed + 8);
    placeHousesAlongPolyline(ctx, laneS, 12.15, 16.4, 25.5, [-1, 1], 17.2, 20, seed + 28);
    placeFanHousesAroundBulb(ctx, b1x, b1z, 19.6, 4.5, Math.atan2(stem1[1][1] - b1z, stem1[1][0] - b1x), 7, 15.8, 25.0, seed + 48);
    placeFanHousesAroundBulb(ctx, b2x, b2z, 19.6, 4.5, Math.atan2(stem2[1][1] - b2z, stem2[1][0] - b2x), 7, 15.8, 25.0, seed + 68);
    placeHousesAlongPolyline(ctx, stem1.slice(0, 2), 11.9, 16.2, 25.0, [-1, 1], 17.2, 18, seed + 86);
    placeHousesAlongPolyline(ctx, stem2.slice(0, 2), 11.9, 16.2, 25.0, [-1, 1], 17.2, 18, seed + 102);
    placeSideAvenueFrontageHouses(ctx, seed + 120);
  } else if (pattern === 1) {
    const sPts = [], z0 = cz + flip * 12, z1 = cz - flip * 12;
    for (let i = 0; i <= 7; i++) {
      const t = i / 7, wave = Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * (flip * 26);
      sPts.push([Math.round(((innerMinX + 1.5) + (spanX - 3.0) * t) * 10) / 10, Math.round((z0 + (z1 - z0) * t + wave) * 10) / 10]);
    }
    registerOrganicLane(ctx, `sub_slane_${rIdx}_${cIdx}`, sPts, 16.0, 4.4, true);

    const pBulbX = cx + spanX * 0.20, pBulbZ = cz - flip * 78;
    const spurPts = [[innerMinX + 1.5, cz - flip * 82], [cx - spanX * 0.12, cz - flip * 84], [pBulbX, pBulbZ]];
    registerOrganicLane(ctx, `sub_sspur_${rIdx}_${cIdx}`, spurPts, 15.0, 4.4, false);
    registerCulDeSacBulb(ctx, `sub_sbulb_${rIdx}_${cIdx}`, pBulbX, pBulbZ, 6.2, 19.6, 4.5, seed + 3);

    const pBulb2X = cx - spanX * 0.20, pBulb2Z = cz + flip * 78;
    const spur2Pts = [[innerMaxX - 1.5, cz + flip * 82], [cx + spanX * 0.12, cz + flip * 84], [pBulb2X, pBulb2Z]];
    registerOrganicLane(ctx, `sub_sspur2_${rIdx}_${cIdx}`, spur2Pts, 15.0, 4.4, false);
    registerCulDeSacBulb(ctx, `sub_sbulb2_${rIdx}_${cIdx}`, pBulb2X, pBulb2Z, 6.2, 19.6, 4.5, seed + 4);
    world.suburbOrganicStats.lanes += 3;

    placeFanHousesAroundBulb(ctx, pBulbX, pBulbZ, 19.6, 4.5, Math.atan2(spurPts[1][1] - pBulbZ, spurPts[1][0] - pBulbX), 7, 15.8, 25.5, seed + 15);
    placeFanHousesAroundBulb(ctx, pBulb2X, pBulb2Z, 19.6, 4.5, Math.atan2(spur2Pts[1][1] - pBulb2Z, spur2Pts[1][0] - pBulb2X), 7, 15.8, 25.5, seed + 35);
    placeHousesAlongPolyline(ctx, spurPts.slice(0, 2), 11.9, 16.2, 25.5, [-1, 1], 17.2, 18, seed + 50);
    placeHousesAlongPolyline(ctx, spur2Pts.slice(0, 2), 11.9, 16.2, 25.5, [-1, 1], 17.2, 18, seed + 62);
    placeHousesAlongPolyline(ctx, sPts, 12.4, 16.4, 25.8, [-1, 1], 17.2, 20, seed + 78);
    placeSideAvenueFrontageHouses(ctx, seed + 130);
  } else {
    // 2 alamedas em arco + alameda transversal dupla no miolo (casas 100% fundo-com-fundo)
    const arch1 = [], arch2 = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const px = Math.round(((innerMinX + 1.5) + (spanX - 3.0) * t) * 10) / 10;
      arch1.push([px, Math.round((cz - 74 - Math.sin(t * Math.PI) * 16) * 10) / 10]);
      arch2.push([px, Math.round((cz + 74 + Math.sin(t * Math.PI) * 16) * 10) / 10]);
    }
    const midCross = buildGentleEWPoints(cz, flip * 7.5);
    registerOrganicLane(ctx, `sub_cresc_n_${rIdx}_${cIdx}`, arch1, 15.5, 4.4, true);
    registerOrganicLane(ctx, `sub_cresc_s_${rIdx}_${cIdx}`, arch2, 15.5, 4.4, true);
    registerOrganicLane(ctx, `sub_cresc_mid_${rIdx}_${cIdx}`, midCross, 15.5, 4.4, true);
    world.suburbOrganicStats.lanes += 3;

    buildPocketGreenAndPlayground(ctx, cx + flip * 24, cz - 42, 18, 13, seed + 7);
    placeHousesAlongPolyline(ctx, arch1, 12.15, 16.4, 25.5, [-1, 1], 17.3, 20, seed + 20);
    placeHousesAlongPolyline(ctx, arch2, 12.15, 16.4, 25.5, [-1, 1], 17.3, 20, seed + 52);
    placeHousesAlongPolyline(ctx, midCross, 12.15, 16.4, 25.5, [-1, 1], 17.3, 20, seed + 84);
    placeSideAvenueFrontageHouses(ctx, seed + 140);
  }
}

export function buildSpecialBlockOrganicPocket(world, batcher, cfg) {
  const {
    id, innerMinX, innerMaxX, innerMinZ, safeSouthZ,
    northLotD = 0, southLotD = 0, specialKeepout,
    entrySide = 'west', pocketZ, crossLaneZ = null, seed = 77
  } = cfg;
  const ctx = createBlockContext(world, batcher, { innerMinX, innerMaxX, innerMinZ, safeSouthZ, northLotD, southLotD }, [specialKeepout]);
  const cx = (innerMinX + innerMaxX) * 0.5, spanX = innerMaxX - innerMinX, fromWest = entrySide === 'west';

  // Se houver faixa transversal livre do equipamento especial, constrói rua residencial dupla de ponta a ponta
  const openCrossZ = crossLaneZ ?? (
    specialKeepout && pocketZ < (innerMinZ + safeSouthZ) * 0.5
      ? (innerMinZ + Math.max(northLotD, 30) + 54 < specialKeepout.minZ - 26 ? innerMinZ + Math.max(northLotD, 30) + 54 : null)
      : (specialKeepout && safeSouthZ - Math.max(southLotD, 30) - 54 > specialKeepout.maxZ + 26 ? safeSouthZ - Math.max(southLotD, 30) - 54 : null)
  );

  if (openCrossZ !== null) {
    const crossPts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      crossPts.push([
        Math.round(((innerMinX + 1.5) + (spanX - 3.0) * t) * 10) / 10,
        Math.round((openCrossZ + Math.sin(t * Math.PI * 2) * 5.0) * 10) / 10
      ]);
    }
    registerOrganicLane(ctx, `sub_spec_cross_${id}`, crossPts, 15.5, 4.4, true);
    world.suburbOrganicStats.lanes++;
    placeHousesAlongPolyline(ctx, crossPts, 12.15, 16.4, 25.5, [-1, 1], 17.2, 20, seed + 5);
  }

  const startX = fromWest ? innerMinX + 1.5 : innerMaxX - 1.5;
  let bx = fromWest ? cx + 18 : cx - 18;
  if (specialKeepout && pocketZ >= specialKeepout.minZ - 32 && pocketZ <= specialKeepout.maxZ + 32) {
    bx = fromWest ? Math.min(bx, specialKeepout.minX - 30) : Math.max(bx, specialKeepout.maxX + 30);
  }
  const bz = openCrossZ !== null && Math.abs(pocketZ - openCrossZ) < 62
    ? (openCrossZ < (innerMinZ + safeSouthZ) * 0.5 ? openCrossZ + 82 : openCrossZ - 82)
    : pocketZ;
  if (specialKeepout && bz >= specialKeepout.minZ - 32 && bz <= specialKeepout.maxZ + 32) {
    bx = fromWest ? Math.min(bx, specialKeepout.minX - 30) : Math.max(bx, specialKeepout.maxX + 30);
  }

  if (Math.abs(bx - startX) >= 48) {
    const pts = [[startX, bz + 8], [(startX + bx) * 0.5, bz - 10], [bx, bz]];
    registerOrganicLane(ctx, `sub_spec_lane_${id}`, pts, 15.5, 4.5, false);
    registerCulDeSacBulb(ctx, `sub_spec_bulb_${id}`, bx, bz, 6.2, 19.8, 4.5, seed);
    world.suburbOrganicStats.lanes++;

    placeFanHousesAroundBulb(ctx, bx, bz, 19.8, 4.5, Math.atan2(pts[1][1] - bz, pts[1][0] - bx), 7, 16.0, 25.5, seed + 32);
    placeHousesAlongPolyline(ctx, pts.slice(0, 2), 12.25, 16.4, 25.5, [-1, 1], 17.2, 18, seed + 60);
  }
  placeSideAvenueFrontageHouses(ctx, seed + 90);
}
