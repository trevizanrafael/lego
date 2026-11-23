import * as THREE from 'three';
import { makeFastBox } from '../../BuildingGenerator.js';
import { buildDetailedBuilding } from '../../buildings/DetailedBuildingBuilder.js';
import {
  createObb2D,
  obbInsideBounds2D,
  obbIntersectsObb2D,
  obbIntersectsRect2D,
  obbClearOfSegment2D,
  obbClearOfCircle2D
} from '../../buildings/LotGeometry2D.js';
import { addChunkedArrayToScene } from '../../terrain/BridgeAndPierSpecs.js';
import { TERRITORY_ZONES } from '../../factions/TerritoryZonesAndConfigs.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';
import { addGiantSiloBattery, addTallIndustrialSmokestack, addPCCContainerStack } from './EastPortBatcherAndMaterials.js';

const IND_ROAD_W = 22;
const IND_HALF_W = IND_ROAD_W * 0.5;
const IND_SIDEWALK = 6;
const CITADEL_X = 2598;
const CITADEL_Z = -948;
const PORT_SAFE_MAX_Z = ws(120) - 8; // 352m (livre das avenidas N-S do Porto que sobem até Z = 360)

const CORE_DARK_STYLES = Object.freeze(['black_granite_gold', 'silver_corporate', 'ny_brick', 'white_concrete']);
const FOUNDRY_STYLES = Object.freeze(['ny_brick', 'black_granite_gold', 'white_concrete', 'classic_sandstone', 'silver_corporate']);
const Z_GRID_SCALED = Object.freeze([-3516, -3120, -2724, -2328, -1932, -1536, -1146, -750, -351, 0, 402]);
const X_GRID_NORTH_SCALED = Object.freeze([1800, 1944, 2304, 2892, 3480, 4032, 4572]);
const X_GRID_SOUTH_SCALED = Object.freeze([1800, 2304, 2892, 3480, 4032, 4572]);
const _nearColsScratch = [];

function hash01(seed, salt = 0) {
  let h = Math.imul((seed | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function computeIndustrialInfillHeight(wx, wz, seed) {
  const dCit = Math.hypot((wx - CITADEL_X) * 0.88, (wz - CITADEL_Z) * 0.82);
  const gCit = Math.exp(-(dCit * dCit) / (2 * 920 * 920));
  const borderFade = Math.max(
    THREE.MathUtils.clamp((wx - 3920) / 640, 0, 1),
    THREE.MathUtils.clamp((-2700 - wz) / 820, 0, 1),
    THREE.MathUtils.clamp(wz / 350, 0, 1) * 0.72
  );
  const jitter = 0.86 + hash01(seed, Math.round(wx * 3 - wz * 5)) * 0.24;
  return Math.round(THREE.MathUtils.clamp((26.0 + 27.5 * gCit - 6.5 * borderFade) * jitter, 22, 58) * 10) / 10;
}

function pickIndustrialStyle(wx, wz, seed) {
  const idx = Math.floor(hash01(seed, Math.round(wx * 5 + wz * 7)) * 991);
  const list = Math.hypot(wx - CITADEL_X, wz - CITADEL_Z) < 920 ? CORE_DARK_STYLES : FOUNDRY_STYLES;
  return list[idx % list.length];
}

function callBuildDetailedBuildingSafe(world, x, z, w, h, d, styleKey, opts) {
  const hasOwnWrap = Object.prototype.hasOwnProperty.call(world, 'addCollider');
  const wrappedFn = hasOwnWrap ? world.addCollider : null;
  const protoFn = Object.getPrototypeOf(world)?.addCollider;
  if (hasOwnWrap && typeof protoFn === 'function') world.addCollider = protoFn.bind(world);
  try {
    return buildDetailedBuilding(world, x, z, w, h, d, styleKey, opts);
  } finally {
    if (hasOwnWrap && wrappedFn) world.addCollider = wrappedFn;
  }
}

function buildProtectedKeepouts(pccGridBlocks) {
  const rects = [
    { minX: ws(866) - 120, maxX: ws(866) + 120, minZ: ws(-316) - 155, maxZ: ws(-316) + 155 },
    { minX: ws(684) - 105, maxX: ws(684) + 105, minZ: ws(-316) - 130, maxZ: ws(-316) + 130 },
    { minX: ws(1062) - 115, maxX: ws(1062) + 115, minZ: ws(-316) - 180, maxZ: ws(-316) + 180 },
    { minX: 1510, maxX: 1620, minZ: -640, maxZ: -440 },
    { minX: -99999, maxX: ws(600) + 26, minZ: -99999, maxZ: 99999 },
    { minX: -99999, maxX: 99999, minZ: PORT_SAFE_MAX_Z, maxZ: 99999 },
    { minX: 1800, maxX: 1924, minZ: -1146, maxZ: -750 }
  ];
  for (let i = 0; i < pccGridBlocks.length; i++) {
    const b = pccGridBlocks[i], cx = ws(b.cx), cz = ws(b.cz), hw = b.w * 0.5 + 14, hd = b.d * 0.5 + 14;
    rects.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
  }
  const circles = [];
  for (const zone of [TERRITORY_ZONES?.pcc, TERRITORY_ZONES?.ares]) {
    if (!zone) continue;
    for (const pt of [...(zone.outposts || []), ...(zone.gates || []), ...(zone.garages || []), zone.bossCourtyard, zone.alliedBossSpawn]) {
      if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.z)) circles.push({ cx: pt.x, cz: pt.z, r: 55 });
    }
    for (const rt of [...(zone.alliedEntryRoutes || []), ...(zone.defenderMotorRoutes || [])]) {
      if (rt) circles.push({ cx: rt.startX, cz: rt.startZ, r: 34 }, { cx: rt.targetX, cz: rt.targetZ, r: 34 });
    }
  }
  return { rects, circles };
}

function isSegmentClearForSpur(world, x1, z1, x2, z2, keepouts, clearance = 20) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  if (len < 12) return false;
  const segObb = createObb2D((x1 + x2) * 0.5, (z1 + z2) * 0.5, clearance * 2, len + 4, Math.atan2(dx, dz));
  for (let i = 0; i < keepouts.rects.length; i++) {
    const r = keepouts.rects[i];
    if (obbIntersectsRect2D(segObb, r.minX, r.maxX, r.minZ, r.maxZ, 0)) return false;
  }
  for (let i = 0; i < keepouts.circles.length; i++) {
    if (!obbClearOfCircle2D(segObb, keepouts.circles[i].cx, keepouts.circles[i].cz, keepouts.circles[i].r)) return false;
  }
  if (typeof world.getCollidersAlongRay2D === 'function') {
    const hits = world.getCollidersAlongRay2D(x1, z1, x2, z2, clearance);
    for (let i = 0; i < hits.length; i++) if (hits[i] && !hits[i].disabled) return false;
  }
  return true;
}

function buildElevatedRingGeo(innerR, outerR, segs, rings, cx, cz, sampleY, yOff) {
  const geo = new THREE.RingGeometry(innerR, outerR, segs, rings);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const pos = geo.attributes.position;
  for (let v = 0; v < pos.count; v++) pos.setY(v, sampleY(pos.getX(v), pos.getZ(v)) + yOff);
  geo.computeVertexNormals();
  return geo;
}

function buildRibbonGeo(world, pts, halfW, yOff) {
  const stations = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 9.5));
    for (let s = 0; s < steps; s++) stations.push([x1 + ((x2 - x1) * s) / steps, z1 + ((z2 - z1) * s) / steps]);
  }
  stations.push(pts[pts.length - 1]);
  const n = stations.length;
  if (n < 2) return null;

  const rightNormal = (k) => {
    const prev = stations[Math.max(0, k - 1)], cur = stations[k], next = stations[Math.min(n - 1, k + 1)];
    let t0x = cur[0] - prev[0], t0z = cur[1] - prev[1], t1x = next[0] - cur[0], t1z = next[1] - cur[1];
    const l0 = Math.hypot(t0x, t0z), l1 = Math.hypot(t1x, t1z);
    if (l0 > 1e-5) { t0x /= l0; t0z /= l0; }
    if (l1 > 1e-5) { t1x /= l1; t1z /= l1; }
    if (l0 <= 1e-5) return [-t1z, t1x, 1];
    if (l1 <= 1e-5) return [-t0z, t0x, 1];
    let mx = t0x + t1x, mz = t0z + t1z;
    const mLen = Math.hypot(mx, mz);
    if (mLen < 1e-4) return [-t0z, t0x, 1];
    mx /= mLen; mz /= mLen;
    return [-mz, mx, THREE.MathUtils.clamp(1 / Math.max(0.58, Math.abs(-mz * -t0z + mx * t0x)), 1.0, 1.48)];
  };

  const positions = [], indices = [], sampleY = (vx, vz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(vx, vz) : 0) + yOff;
  for (let k = 0, vB = 0; k < n - 1; k++, vB += 6) {
    const [ax, az] = stations[k], [bx, bz] = stations[k + 1];
    const [n0x, n0z, m0] = rightNormal(k), [n1x, n1z, m1] = rightNormal(k + 1), hw0 = halfW * m0, hw1 = halfW * m1;
    for (const [rx, rz] of [[ax - n0x * hw0, az - n0z * hw0], [ax, az], [ax + n0x * hw0, az + n0z * hw0], [bx - n1x * hw1, bz - n1z * hw1], [bx, bz], [bx + n1x * hw1, bz + n1z * hw1]]) {
      positions.push(rx, sampleY(rx, rz), rz);
    }
    indices.push(vB, vB + 3, vB + 1, vB + 1, vB + 3, vB + 4, vB + 1, vB + 4, vB + 2, vB + 2, vB + 4, vB + 5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function canPlaceIndustrialObb(world, obb, unrotW, unrotD, ctx) {
  const { innerBounds, keepouts, segments, roundabouts, localRoads, localSidewalks, placedObbs } = ctx;
  if (!obbInsideBounds2D(obb, innerBounds.minX, innerBounds.maxX, innerBounds.minZ, innerBounds.maxZ, 0)) return false;
  for (let i = 0; i < placedObbs.length; i++) if (obbIntersectsObb2D(obb, placedObbs[i], 3.8)) return false;
  for (let i = 0; i < keepouts.rects.length; i++) {
    const r = keepouts.rects[i];
    if (obb.maxX + 1.5 > r.minX && obb.minX - 1.5 < r.maxX && obb.maxZ + 1.5 > r.minZ && obb.minZ - 1.5 < r.maxZ && obbIntersectsRect2D(obb, r.minX, r.maxX, r.minZ, r.maxZ, 1.5)) return false;
  }
  for (let i = 0; i < keepouts.circles.length; i++) if (!obbClearOfCircle2D(obb, keepouts.circles[i].cx, keepouts.circles[i].cz, keepouts.circles[i].r)) return false;
  for (let i = 0; i < roundabouts.length; i++) if (!obbClearOfCircle2D(obb, roundabouts[i].cx, roundabouts[i].cz, roundabouts[i].outerR + roundabouts[i].sidewalk + 2.6)) return false;
  for (let i = 0; i < segments.length; i++) if (!obbClearOfSegment2D(obb, segments[i].x1, segments[i].z1, segments[i].x2, segments[i].z2, segments[i].halfWidth + segments[i].sidewalk + 2.2)) return false;
  for (let i = 0; i < localSidewalks.length; i++) if (obbIntersectsRect2D(obb, localSidewalks[i].minX, localSidewalks[i].maxX, localSidewalks[i].minZ, localSidewalks[i].maxZ, 1.5)) return false;

  const uMinX = obb.cx - unrotW * 0.5, uMaxX = obb.cx + unrotW * 0.5, uMinZ = obb.cz - unrotD * 0.5, uMaxZ = obb.cz + unrotD * 0.5;
  for (let i = 0; i < localRoads.length; i++) {
    const rd = localRoads[i], rMinX = rd.x - rd.w * 0.5, rMaxX = rd.x + rd.w * 0.5, rMinZ = rd.z - rd.d * 0.5, rMaxZ = rd.z + rd.d * 0.5;
    if (uMinX < rMaxX + 1.0 && uMaxX > rMinX - 1.0 && uMinZ < rMaxZ + 1.0 && uMaxZ > rMinZ - 1.0) return false;
    if (obbIntersectsRect2D(obb, rMinX, rMaxX, rMinZ, rMaxZ, 2.0)) return false;
  }
  if (typeof world.getCollidersNear === 'function') {
    const near = world.getCollidersNear(obb.cx, obb.cz, Math.hypot(obb.maxX - obb.minX, obb.maxZ - obb.minZ) * 0.5 + 3.0, _nearColsScratch);
    for (let i = 0; i < near.length; i++) if (near[i] && !near[i].disabled && obbIntersectsRect2D(obb, near[i].minX, near[i].maxX, near[i].minZ, near[i].maxZ, 2.2)) return false;
  }
  return true;
}

export function buildIndustrialOrganicSpursAndInfill(world, batcher, pccGridBlocks = []) {
  if (!IS_SCALED_WORLD || !world?.scene) return;
  if (!world.mapOrganicRoads) world.mapOrganicRoads = [];
  if (!world.mapRoads) world.mapRoads = [];

  const keepouts = buildProtectedKeepouts(pccGridBlocks);
  const cells = [];
  for (let rz = 0; rz < Z_GRID_SCALED.length - 1; rz++) {
    const z0 = Z_GRID_SCALED[rz], z1 = Z_GRID_SCALED[rz + 1];
    const hz0 = (z0 >= -1146 ? ROAD.mainWidth : ROAD.secondaryWidth) * 0.5;
    const hz1 = (z1 >= -1146 ? ROAD.mainWidth : ROAD.secondaryWidth) * 0.5;
    const xList = z1 <= -1536 ? X_GRID_NORTH_SCALED : X_GRID_SOUTH_SCALED;
    for (let cx = 0; cx < xList.length - 1; cx++) {
      const hx = ROAD.secondaryWidth * 0.5, sw = ROAD.sidewalk;
      const sMinX = Math.max(ws(600) + 26, xList[cx] + hx + sw), sMaxX = xList[cx + 1] - hx - sw;
      const sMinZ = z0 + hz0 + sw, sMaxZ = Math.min(PORT_SAFE_MAX_Z, z1 - hz1 - sw);
      if (sMaxX - sMinX < 42 || sMaxZ - sMinZ < 42) continue;
      cells.push({
        rz, cx, sMinX, sMaxX, sMinZ, sMaxZ,
        innerBounds: { minX: sMinX + 2.6, maxX: sMaxX - 2.6, minZ: sMinZ + 2.6, maxZ: sMaxZ - 2.6 },
        tileBounds: { minX: sMinX + 19.5, maxX: sMaxX - 19.5, minZ: sMinZ + 19.5, maxZ: sMaxZ - 19.5 },
        polylines: [], roundabouts: [], segments: []
      });
    }
  }

  // 1) 2 Rotatórias Pesadas de Caminhões + Ramais Logísticos Diagonais e Cotovelos validados
  const roundaboutsSpec = [
    { id: 'ind_rb_citadel_north', cx: 2598, cz: -1341, innerR: 14, outerR: 36, sidewalk: IND_SIDEWALK },
    { id: 'ind_rb_port_transfer', cx: 3186, cz: -550, innerR: 14, outerR: 36, sidewalk: IND_SIDEWALK }
  ];
  for (let ci = 0; ci < cells.length; ci++) {
    const cell = cells[ci];
    const rbHit = roundaboutsSpec.find((rb) => rb.cx > cell.sMinX + 60 && rb.cx < cell.sMaxX - 60 && rb.cz > cell.sMinZ + 60 && rb.cz < cell.sMaxZ - 60);
    if (rbHit) {
      cell.roundabouts.push(rbHit);
      const rJ = rbHit.outerR - 1.5, dg = Math.SQRT1_2;
      [
        [[cell.sMinX + 36, cell.sMinZ + 4], [rbHit.cx - rJ * dg, rbHit.cz - rJ * dg]],
        [[cell.sMaxX - 36, cell.sMinZ + 4], [rbHit.cx + rJ * dg, rbHit.cz - rJ * dg]],
        [[cell.sMinX + 36, cell.sMaxZ - 4], [rbHit.cx - rJ * dg, rbHit.cz + rJ * dg]],
        [[cell.sMaxX - 36, cell.sMaxZ - 4], [rbHit.cx + rJ * dg, rbHit.cz + rJ * dg]]
      ].forEach((pts, sIdx) => {
        if (isSegmentClearForSpur(world, pts[0][0], pts[0][1], pts[1][0], pts[1][1], keepouts, 20)) {
          cell.polylines.push({ id: `${rbHit.id}_sp_${sIdx}`, points: pts, isMain: true });
        }
      });
      continue;
    }
    const spanX = cell.sMaxX - cell.sMinX, spanZ = cell.sMaxZ - cell.sMinZ;
    if (spanZ < 220) continue;
    const midZ = (cell.sMinZ + cell.sMaxZ) * 0.5, candidates = [];
    if (spanX >= 420) {
      const westPts = (cell.rz + cell.cx) % 2 === 0
        ? [[cell.sMinX + 42, cell.sMinZ + 4], [cell.sMinX + 108, midZ + 16], [cell.sMinX + 4, cell.sMaxZ - 66]]
        : [[cell.sMinX + 4, cell.sMinZ + 66], [cell.sMinX + 108, midZ - 16], [cell.sMinX + 46, cell.sMaxZ - 4]];
      candidates.push({ id: `ind_spur_w_${cell.rz}_${cell.cx}`, points: westPts, isMain: false });
    }
    if (spanX >= 290) {
      const eastPts = (cell.rz + cell.cx) % 2 === 0
        ? [[cell.sMaxX - 46, cell.sMinZ + 4], [cell.sMaxX - 110, midZ - 18], [cell.sMaxX - 4, cell.sMaxZ - 68]]
        : [[cell.sMaxX - 4, cell.sMinZ + 68], [cell.sMaxX - 110, midZ + 18], [cell.sMaxX - 48, cell.sMaxZ - 4]];
      candidates.push({ id: `ind_spur_e_${cell.rz}_${cell.cx}`, points: eastPts, isMain: false });
    }
    for (const poly of candidates) {
      if (poly.points.slice(0, -1).every((pt, s) => isSegmentClearForSpur(world, pt[0], pt[1], poly.points[s + 1][0], poly.points[s + 1][1], keepouts, 20))) {
        cell.polylines.push(poly);
      }
    }
  }

  // 2) Fitas asfálticas industriais escuras, ombros de 6m, linhas tracejadas, ilhas e ladrilhos 10x10m
  const shoulderGeos = [], asphaltGeos = [], dashYellowGeos = [], dashWhiteGeos = [];
  const islandConcreteGeos = [], islandSteelGeos = [], islandGlowGeos = [];
  const sampleY = (vx, vz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(vx, vz) : 0);

  for (const cell of cells) {
    const tb = cell.tileBounds;
    const inTileSafe = (tx, tz) => tx >= tb.minX && tx <= tb.maxX && tz >= tb.minZ && tz <= tb.maxZ;

    for (const rb of cell.roundabouts) {
      world.mapOrganicRoads.push({ kind: 'roundabout', id: rb.id, cx: rb.cx, cz: rb.cz, innerR: rb.innerR, outerR: rb.outerR, sidewalk: rb.sidewalk });
      shoulderGeos.push(buildElevatedRingGeo(rb.outerR - 0.3, rb.outerR + rb.sidewalk, 40, 2, rb.cx, rb.cz, sampleY, 0.018));
      asphaltGeos.push(buildElevatedRingGeo(rb.innerR - 0.25, rb.outerR + 0.25, 44, 3, rb.cx, rb.cz, sampleY, 0.028));
      const rMid = (rb.innerR + rb.outerR) * 0.5;
      for (let k = 0; k < 24; k++) {
        const ang = (k / 24) * Math.PI * 2, tx = rb.cx + Math.cos(ang) * rMid, tz = rb.cz + Math.sin(ang) * rMid;
        if (inTileSafe(tx, tz)) world.mapRoads.push({ x: tx, z: tz, w: 10, d: 10, isMain: false, isOrganicTile: true });
        const dg = new THREE.BoxGeometry(0.36, 0.045, 3.2);
        dg.rotateY(-ang);
        dg.translate(tx, sampleY(tx, tz) + 0.055, tz);
        dashYellowGeos.push(dg);
      }
      const gY = sampleY(rb.cx, rb.cz);
      const plinth = new THREE.CylinderGeometry(rb.innerR - 0.2, rb.innerR, 0.9, 28);
      plinth.translate(rb.cx, gY + 0.35, rb.cz);
      const pylon = new THREE.CylinderGeometry(2.4, 3.4, 10.5, 10);
      pylon.translate(rb.cx, gY + 5.8, rb.cz);
      const cap = new THREE.CylinderGeometry(3.8, 2.8, 1.4, 10);
      cap.translate(rb.cx, gY + 11.4, rb.cz);
      islandConcreteGeos.push(plinth);
      islandSteelGeos.push(pylon, cap);
      islandGlowGeos.push(makeFastBox(4.8, 0.45, 4.8, rb.cx, gY + 12.25, rb.cz));
      world.addCylinderCollider?.(rb.cx, rb.cz, rb.innerR, gY + 12.5, Math.max(0, gY - 2.0));
    }

    for (const poly of cell.polylines) {
      world.mapOrganicRoads.push({ kind: 'polyline', id: poly.id, points: poly.points, width: IND_ROAD_W, sidewalk: IND_SIDEWALK, isMain: poly.isMain });
      const shGeo = buildRibbonGeo(world, poly.points, IND_HALF_W + IND_SIDEWALK, 0.016);
      const asphGeo = buildRibbonGeo(world, poly.points, IND_HALF_W, 0.026);
      if (shGeo) shoulderGeos.push(shGeo);
      if (asphGeo) asphaltGeos.push(asphGeo);
      for (let vi = 1; vi < poly.points.length - 1; vi++) {
        asphaltGeos.push(buildElevatedRingGeo(0.01, IND_HALF_W * 0.98, 16, 1, poly.points[vi][0], poly.points[vi][1], sampleY, 0.027));
      }
      for (let s = 0; s < poly.points.length - 1; s++) {
        const [x1, z1] = poly.points[s], [x2, z2] = poly.points[s + 1];
        const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
        if (len < 2) continue;
        const ux = dx / len, uz = dz / len, yaw = Math.atan2(ux, uz);
        cell.segments.push({ x1, z1, x2, z2, len, halfWidth: IND_HALF_W, sidewalk: IND_SIDEWALK });
        const tileSteps = Math.max(1, Math.round(len / 9.0));
        for (let ts = 0; ts <= tileSteps; ts++) {
          const tx = x1 + (dx * ts) / tileSteps, tz = z1 + (dz * ts) / tileSteps;
          if (inTileSafe(tx, tz)) world.mapRoads.push({ x: tx, z: tz, w: 10, d: 10, isMain: false, isOrganicTile: true });
        }
        const bucket = poly.isMain ? dashYellowGeos : dashWhiteGeos;
        for (let dPos = 8.0; dPos < len - 7.0; dPos += 11.5) {
          const mx = x1 + ux * dPos, mz = z1 + uz * dPos;
          if (!inTileSafe(mx, mz)) continue;
          const dg = new THREE.BoxGeometry(poly.isMain ? 0.4 : 0.32, 0.045, 4.8);
          dg.rotateY(yaw);
          dg.translate(mx, sampleY(mx, mz) + 0.054, mz);
          bucket.push(dg);
        }
      }
    }
  }

  for (const [geos, mat, receiveShadow, castShadow] of [
    [shoulderGeos, new THREE.MeshStandardMaterial({ color: 0x283242, roughness: 0.72, metalness: 0.06, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), true, false],
    [asphaltGeos, new THREE.MeshStandardMaterial({ color: 0x0d121c, roughness: 0.74, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), true, false],
    [dashYellowGeos, new THREE.MeshBasicMaterial({ color: 0xfacc15, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), false, false],
    [dashWhiteGeos, new THREE.MeshBasicMaterial({ color: 0xcbd5e1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), false, false],
    [islandConcreteGeos, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.58, metalness: 0.12 }), true, true],
    [islandSteelGeos, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.34, metalness: 0.42 }), true, true],
    [islandGlowGeos, new THREE.MeshBasicMaterial({ color: 0x0ea5e9 }), false, false]
  ]) {
    addChunkedArrayToScene(world.scene, geos, mat, { receiveShadow, castShadow, chunkSize: ws(2048) });
  }

  // 3) Adensamento Pesado: Galpões/Fundições Giradas (`rotY`) + Baterias de Silos, Chaminés & Contêineres
  const allGroundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge);
  const allSidewalks = world.sidewalkCorridors || [];

  for (const cell of cells) {
    const localRoads = allGroundRoads.filter((rd) => rd.x + rd.w * 0.5 >= cell.sMinX - 45 && rd.x - rd.w * 0.5 <= cell.sMaxX + 45 && rd.z + rd.d * 0.5 >= cell.sMinZ - 45 && rd.z - rd.d * 0.5 <= cell.sMaxZ + 45);
    const localSidewalks = allSidewalks.filter((sw) => sw.maxX >= cell.sMinX - 20 && sw.minX <= cell.sMaxX + 20 && sw.maxZ >= cell.sMinZ - 20 && sw.minZ <= cell.sMaxZ + 20);
    const placedObbs = [];
    const ctx = { innerBounds: cell.innerBounds, keepouts, segments: cell.segments, roundabouts: cell.roundabouts, localRoads, localSidewalks, placedObbs };
    const baseSeed = cell.rz * 37 + cell.cx * 19 + 11;
    let cellAdded = 0;

    const placeIndustrialHall = (cx, cz, w, d, rotY, lotSeed) => {
      const obb = createObb2D(cx, cz, w, d, rotY, 2.2);
      if (!canPlaceIndustrialObb(world, obb, w, d, ctx)) return false;
      const h = computeIndustrialInfillHeight(cx, cz, lotSeed);
      const styleKey = pickIndustrialStyle(cx, cz, lotSeed);
      callBuildDetailedBuildingSafe(world, cx, cz, w, h, d, styleKey, { rotY, seed: lotSeed });
      placedObbs.push(obb);
      cellAdded++;
      world.industrialPCCData.bunkersCount++;
      if ((styleKey === 'black_granite_gold' || styleKey === 'silver_corporate') && h >= 40) world.industrialPCCData.corporateTowersCount++;
      else world.industrialPCCData.c4WarehousesCount++;
      return true;
    };

    for (let si = 0; si < cell.segments.length; si++) {
      const seg = cell.segments[si];
      if (seg.len < 42) continue;
      const tx = (seg.x2 - seg.x1) / seg.len, tz = (seg.z2 - seg.z1) / seg.len, rotY = Math.atan2(tx, tz) + Math.PI * 0.5;
      for (const side of [-1, 1]) {
        for (let cur = 26; cur <= seg.len - 24;) {
          const lotSeed = baseSeed * 23 + si * 13 + (side > 0 ? 7 : 3) + Math.round(cur);
          const prefW = 40 + Math.floor(hash01(lotSeed, 1) * 12), prefD = 26 + Math.floor(hash01(lotSeed, 2) * 8);
          let stepW = 0;
          for (const [bw, bd] of [[prefW, prefD], [32, 24]]) {
            const perp = seg.halfWidth + seg.sidewalk + 3.2 + bd * 0.5;
            if (placeIndustrialHall(seg.x1 + tx * cur - tz * side * perp, seg.z1 + tz * cur + tx * side * perp, bw, bd, rotY, lotSeed)) { stepW = bw; break; }
          }
          cur += stepW > 0 ? stepW + 7.5 : 18.0;
        }
      }
    }

    for (const rb of cell.roundabouts) {
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2 + 0.31, rad = rb.outerR + rb.sidewalk + 17.5;
        placeIndustrialHall(rb.cx + Math.cos(ang) * rad, rb.cz + Math.sin(ang) * rad, 32, 24, Math.atan2(Math.cos(ang), Math.sin(ang)), baseSeed * 29 + k);
      }
    }

    const ib = cell.innerBounds;
    for (const [axis, edgeCoord, inSign] of [['x', ib.minZ, 1], ['x', ib.maxZ, -1], ['z', ib.minX, 1], ['z', ib.maxX, -1]]) {
      const endC = (axis === 'x' ? ib.maxX : ib.maxZ) - 26;
      for (let cur = (axis === 'x' ? ib.minX : ib.minZ) + 26; cur <= endC;) {
        const fSeed = baseSeed * 41 + Math.round(cur) + inSign * 5;
        const span = 40 + Math.floor(hash01(fSeed, 3) * 12), depth = 28 + Math.floor(hash01(fSeed, 4) * 6);
        const bw = axis === 'x' ? span : depth, bd = axis === 'x' ? depth : span;
        const cantYaw = hash01(fSeed, 5) > 0.55 ? inSign * 0.24 : 0, setback = cantYaw !== 0 ? 7.2 : 2.6;
        const cx = axis === 'x' ? cur : edgeCoord + inSign * (bw * 0.5 + setback);
        const cz = axis === 'x' ? edgeCoord + inSign * (bd * 0.5 + setback) : cur;
        cur += placeIndustrialHall(cx, cz, bw, bd, cantYaw, fSeed) ? span + 9.0 : 18.0;
      }
    }

    let yardIdx = 0;
    for (let gx = ib.minX + 46; gx <= ib.maxX - 46; gx += 54) {
      for (let gz = ib.minZ + 46; gz <= ib.maxZ - 46; gz += 54) {
        yardIdx++;
        const ySeed = baseSeed * 59 + yardIdx * 17;
        const s = cell.segments.length > 0 ? cell.segments[yardIdx % cell.segments.length] : null;
        const rotY = s ? Math.atan2(s.x2 - s.x1, s.z2 - s.z1) + Math.PI * 0.5 : (yardIdx % 2 === 0 ? 1 : -1) * 0.42;
        if (yardIdx % 3 !== 0 && placeIndustrialHall(gx, gz, 36, 26, rotY, ySeed)) continue;

        const siloObb = createObb2D(gx, gz, 39, 14, 0, 1.5);
        if (yardIdx % 3 === 0 && canPlaceIndustrialObb(world, siloObb, 39, 14, ctx)) {
          addGiantSiloBattery(world, batcher, gx, gz, 3, 44 + (yardIdx % 5) * 3);
          placedObbs.push(siloObb);
          cellAdded++;
          continue;
        }
        const contRot = yardIdx % 2 === 0, contObb = createObb2D(gx, gz, 15, 15, 0, 1.2);
        if (canPlaceIndustrialObb(world, contObb, 15, 15, ctx)) {
          const ox = contRot ? 0 : 6.0, oz = contRot ? 6.0 : 0;
          addPCCContainerStack(world, batcher, gx - ox * 0.5, gz - oz * 0.5, 2 + (yardIdx % 2), contRot);
          placedObbs.push(contObb);
          cellAdded++;
          const sx = gx + (contRot ? 14 : -14), sz = gz + (contRot ? -12 : 12), stackObb = createObb2D(sx, sz, 11, 11, 0, 1.2);
          if (canPlaceIndustrialObb(world, stackObb, 11, 11, ctx)) {
            addTallIndustrialSmokestack(world, batcher, sx, sz, 68 + (yardIdx % 4) * 4);
            placedObbs.push(stackObb);
          }
        }
      }
    }
    if (cellAdded > 0) world.industrialPCCData.blocksCount++;
  }
}
