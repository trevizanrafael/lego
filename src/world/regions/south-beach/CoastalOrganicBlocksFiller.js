/**
 * CoastalOrganicBlocksFiller.js
 * Boulevards Costeiros Curvos em "S", Diagonais de Resort, 2 Rotatórias Tropicais com Coqueiros,
 * Praças de Piscina e Adensamento Arquitetônico Gradual da Orla Sul (`WORLD_SCALE = 3`).
 */

import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';
import { buildDetailedBuilding } from '../../buildings/DetailedBuildingBuilder.js';
import { buildFlatironWedgeBuilding } from '../../buildings/FlatironWedgeBuilder.js';
import {
  createObb2D, obbInsideBounds2D, obbIntersectsObb2D,
  obbIntersectsRect2D, obbClearOfSegment2D, obbClearOfCircle2D
} from '../../buildings/LotGeometry2D.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';
import { getUrbanCityReliefY } from '../../terrain/UrbanReliefFunctions.js';
import { addChunkedArrayToScene } from '../../terrain/BridgeAndPierSpecs.js';
import {
  isPointInCartesianGridAsphalt, pushPrismQuad, pushOrientedCurbPiece
} from '../../terrain/OrganicRoadSpatialIndex.js';
import { UMBRELLA_KEYS, addCurvedLegoPalmTree } from './BeachBatcherAndConstants.js';

const COASTAL_COLS_DESIGN = Object.freeze([-648, -516, -384, -252, -120, 0, 120, 252, 384, 516]);
const COASTAL_ROWS_DESIGN = Object.freeze([402, 556, 710]);
const COASTAL_STYLES = Object.freeze([
  'cyan_modern', 'sapphire_glass', 'white_concrete', 'emerald_steel', 'silver_corporate'
]);
const STATIC_COASTAL_KEEPOUTS = Object.freeze([
  { id: 'metro_m04_corridor', minX: -418, maxX: -330, minZ: 1668, maxZ: 2130 },
  { id: 'viaduct_02_panoramic', minX: 724, maxX: 788, minZ: 1190, maxZ: 1580 },
  { id: 'cdd_south_toe', minX: -1944, maxX: -1548, minZ: 1206, maxZ: 1326 }
]);

function hash01(seed, salt = 0) {
  let h = Math.imul((seed | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function getCoastalSuperBlockBounds(colIdx, rowIdx) {
  const dx0 = COASTAL_COLS_DESIGN[colIdx], dx1 = COASTAL_COLS_DESIGN[colIdx + 1];
  const dz0 = COASTAL_ROWS_DESIGN[rowIdx], dz1 = COASTAL_ROWS_DESIGN[rowIdx + 1];
  const hwX = (dx) => (dx === -648 || Math.abs(dx) === 516 ? ROAD.secondaryWidth : ROAD.mainWidth) * 0.5;
  const hwZ = (dz) => (dz === 556 ? ROAD.secondaryWidth : ROAD.mainWidth) * 0.5;
  return {
    colIdx, rowIdx,
    minX: ws(dx0) + hwX(dx0),
    maxX: Math.min(ws(dx1) - hwX(dx1), ws(516) - 28),
    minZ: ws(dz0) + hwZ(dz0),
    maxZ: Math.min(ws(dz1) - hwZ(dz1), ws(710) - 28)
  };
}

function sampleSCurve(x0, z0, x1, z1, amp, steps = 7) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wave = Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * amp;
    pts.push([Math.round((x0 + (x1 - x0) * t) * 10) / 10, Math.round((z0 + (z1 - z0) * t + wave) * 10) / 10]);
  }
  return pts;
}

function buildCoastalOrganicNetworkSpec() {
  const sw = ROAD.sidewalk;
  const roundabouts = [
    { kind: 'roundabout', id: 'rb_coastal_west', cx: -954, cz: 1838, innerR: 13, outerR: 34, sidewalk: sw },
    { kind: 'roundabout', id: 'rb_coastal_east', cx: 558, cz: 1838, innerR: 13, outerR: 34, sidewalk: sw }
  ];
  const rawPolys = [
    // Faixa Norte da Crista Costeira (Z = 1223..1655, 9 super-quadras)
    ['coast_r0_c0_crescent', [[-1931, 1468], [-1760, 1424], [-1632, 1492], [-1632, 1655]], 24, false],
    ['coast_r0_c1_scurve', sampleSCurve(-1535, 1380, -1169, 1380, 44), 26, true],
    ['coast_r0_c1_diag', [[-1350, 1223], [-1350, 1380], [-1236, 1655]], 22, false],
    ['coast_r0_c2_scurve', sampleSCurve(-1135, 1380, -773, 1408, -46), 26, true],
    ['coast_r0_c2_diag', [[-866, 1223], [-954, 1394], [-1068, 1655]], 22, false],
    ['coast_r0_c3_scurve', sampleSCurve(-739, 1408, -377, 1372, 44), 26, true],
    ['coast_r0_c3_diag', [[-646, 1223], [-558, 1390], [-444, 1655]], 22, false],
    ['coast_r0_c4_scurve', sampleSCurve(-343, 1372, -17, 1396, -40), 26, true],
    ['coast_r0_c4_diag', [[-180, 1223], [-180, 1384], [-76, 1655]], 22, false],
    ['coast_r0_c5_scurve', sampleSCurve(17, 1396, 343, 1376, 40), 26, true],
    ['coast_r0_c5_diag', [[180, 1223], [180, 1386], [76, 1655]], 22, false],
    ['coast_r0_c6_crescent', [[377, 1376], [546, 1412], [438, 1655]], 24, true],
    ['coast_r0_c6_spur_n', [[532, 1223], [546, 1412]], 22, false],
    ['coast_r0_c7_crescent', [[1068, 1655], [958, 1396], [1135, 1414]], 24, true],
    ['coast_r0_c7_spur_n', [[982, 1223], [958, 1396]], 22, false],
    ['coast_r0_c8_scurve', [[1169, 1414], [1346, 1376], [1236, 1655]], 24, true],
    ['coast_r0_c8_spur_n', [[1346, 1223], [1346, 1376]], 22, false],
    // Faixa Sul "Atrás da Orla" (Z = 1681..2102, 9 super-quadras + 2 Rotatórias Tropicais)
    ['coast_r1_c0_scurve', sampleSCurve(-1931, 1848, -1561, 1854, 38), 24, true],
    ['coast_r1_c0_spur_n', [[-1746, 1681], [-1746, 1851]], 22, false],
    ['coast_r1_c1_scurve', sampleSCurve(-1535, 1854, -1169, 1838, -42), 26, true],
    ['coast_r1_c1_diag', [[-1242, 1681], [-1352, 1846], [-1462, 2076]], 22, false],
    ['coast_rbw_w', [[-1135, 1838], [-985, 1838]], 26, true],
    ['coast_rbw_e', [[-923, 1838], [-773, 1842]], 26, true],
    ['coast_rbw_nw', [[-1062, 1681], [-974, 1814]], 22, false],
    ['coast_rbw_ne', [[-846, 1681], [-934, 1814]], 22, false],
    ['coast_rbw_sw', [[-976, 1860], [-1066, 2076]], 22, false],
    ['coast_r1_c3_crescent', [[-739, 1842], [-578, 1828], [-468, 1681]], 26, true],
    ['coast_r1_c3_flank', [[-578, 1828], [-668, 2076]], 22, false],
    ['coast_r1_c4_crescent', [[-266, 1681], [-182, 1842], [-17, 1848]], 26, true],
    ['coast_r1_c4_flank', [[-182, 1842], [-76, 2076]], 22, false],
    ['coast_r1_c5_scurve', sampleSCurve(17, 1848, 343, 1838, 40), 26, true],
    ['coast_r1_c5_diag', [[82, 1681], [180, 1843], [284, 2076]], 22, false],
    ['coast_rbe_w', [[377, 1838], [527, 1838]], 26, true],
    ['coast_rbe_e', [[589, 1838], [739, 1842]], 26, true],
    ['coast_rbe_nw', [[450, 1681], [538, 1814]], 22, false],
    ['coast_rbe_ne', [[666, 1681], [578, 1814]], 22, false],
    ['coast_rbe_se', [[580, 1860], [668, 2076]], 22, false],
    ['coast_r1_c7_scurve', sampleSCurve(773, 1842, 1135, 1852, -42), 26, true],
    ['coast_r1_c7_diag', [[850, 1681], [954, 1847], [1066, 2076]], 22, false],
    ['coast_r1_c8_crescent', [[1169, 1852], [1348, 1824], [1454, 1681]], 26, true],
    ['coast_r1_c8_flank', [[1348, 1824], [1238, 2076]], 22, false]
  ];

  const polylines = rawPolys.map(([id, points, width, isMain]) => ({
    kind: 'polyline', id, points, width, halfWidth: width * 0.5, sidewalk: sw, isMain
  }));
  const segments = [];
  for (const poly of polylines) {
    for (let i = 0; i < poly.points.length - 1; i++) {
      const [x1, z1] = poly.points[i], [x2, z2] = poly.points[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.5) continue;
      const pad = poly.halfWidth + poly.sidewalk;
      segments.push({
        polyId: poly.id, x1, z1, x2, z2, len,
        width: poly.width, halfWidth: poly.halfWidth, sidewalk: poly.sidewalk, isMain: poly.isMain,
        minX: Math.min(x1, x2) - pad, maxX: Math.max(x1, x2) + pad,
        minZ: Math.min(z1, z2) - pad, maxZ: Math.max(z1, z2) + pad
      });
    }
  }
  const flatironCorners = [
    { id: 'flatiron_coast_rb_w', cx: -954, cz: 1742, backWidth: 32, noseWidth: 6.0, length: 48, rotY: Math.PI, styleKey: 'cyan_modern' },
    { id: 'flatiron_coast_rb_e', cx: 558, cz: 1742, backWidth: 32, noseWidth: 6.0, length: 48, rotY: Math.PI, styleKey: 'sapphire_glass' },
    { id: 'flatiron_coast_ridge_w', cx: -912, cz: 1308, backWidth: 30, noseWidth: 5.8, length: 46, rotY: 2.62, styleKey: 'emerald_steel' },
    { id: 'flatiron_coast_south_c5', cx: 146, cz: 1756, backWidth: 32, noseWidth: 6.0, length: 48, rotY: -0.54, styleKey: 'silver_corporate' }
  ];
  return { polylines, roundabouts, segments, flatironCorners };
}

function buildCoastalRibbonGeo(pts, halfWidth, yOff = 0.168) {
  const stations = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 9.0));
    for (let s = 0; s < steps; s++) stations.push([x1 + (x2 - x1) * (s / steps), z1 + (z2 - z1) * (s / steps)]);
  }
  stations.push(pts[pts.length - 1]);
  const positions = [], indices = [];
  let vBase = 0;
  for (let k = 0; k < stations.length - 1; k++) {
    const [ax, az] = stations[k], [bx, bz] = stations[k + 1];
    if (isPointInCartesianGridAsphalt((ax + bx) * 0.5, (az + bz) * 0.5, -1.0)) continue;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (const [vx, vz] of [
      [ax - nx * halfWidth, az - nz * halfWidth], [ax, az], [ax + nx * halfWidth, az + nz * halfWidth],
      [bx - nx * halfWidth, bz - nz * halfWidth], [bx, bz], [bx + nx * halfWidth, bz + nz * halfWidth]
    ]) {
      positions.push(vx, getUrbanCityReliefY(vx, vz) + yOff, vz);
    }
    indices.push(vBase, vBase + 3, vBase + 1, vBase + 1, vBase + 3, vBase + 4, vBase + 1, vBase + 4, vBase + 2, vBase + 2, vBase + 4, vBase + 5);
    vBase += 6;
  }
  if (!positions.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function isInsideStrictBlockTileCore(tx, tz, allBlockBounds) {
  for (const k of STATIC_COASTAL_KEEPOUTS) {
    if (tx >= k.minX - 6 && tx <= k.maxX + 6 && tz >= k.minZ - 6 && tz <= k.maxZ + 6) return false;
  }
  const pad = ROAD.sidewalk + 14 + 5; // >= 14m para dentro das calçadas perimetrais (centro >= 29m da guia)
  return allBlockBounds.some((b) => tx >= b.minX + pad && tx <= b.maxX - pad && tz >= b.minZ + pad && tz <= b.maxZ - pad);
}

function minDistToOtherCoastalAsphalt(px, pz, segments, roundabouts) {
  let best = Infinity;
  for (const rb of roundabouts) {
    const dr = Math.hypot(px - rb.cx, pz - rb.cz);
    if (dr < rb.innerR) return -10;
    best = Math.min(best, dr - rb.outerR);
  }
  for (const s of segments) {
    if (px < s.minX - 4 || px > s.maxX + 4 || pz < s.minZ - 4 || pz > s.maxZ + 4) continue;
    const vx = s.x2 - s.x1, vz = s.z2 - s.z1;
    const t = THREE.MathUtils.clamp(((px - s.x1) * vx + (pz - s.z1) * vz) / (s.len * s.len), 0, 1);
    best = Math.min(best, Math.hypot(px - (s.x1 + vx * t), pz - (s.z1 + vz * t)) - s.halfWidth);
  }
  return best;
}

function renderCoastalBoulevardsAndRoundabouts(world, batcher, net, allBlockBounds) {
  if (!world.mapOrganicRoads) world.mapOrganicRoads = [];
  if (!world.mapRoads) world.mapRoads = [];
  const asphaltGeos = [], sidewalkGeos = [], curbGeos = [], paintGeos = [], islandStoneGeos = [], islandTurfGeos = [];
  const swTop = 0.225, curbTop = 0.228;
  const canPlaceSw = (px, pz, clr) =>
    !isPointInCartesianGridAsphalt(px, pz, 0.5) &&
    minDistToOtherCoastalAsphalt(px, pz, net.segments, net.roundabouts) >= clr;

  for (const poly of net.polylines) {
    world.mapOrganicRoads.push({ kind: 'polyline', id: poly.id, points: poly.points, width: poly.width, sidewalk: poly.sidewalk, isMain: poly.isMain });
    const rGeo = buildCoastalRibbonGeo(poly.points, poly.halfWidth, 0.168);
    if (rGeo) asphaltGeos.push(rGeo);

    for (const [vx, vz] of poly.points) {
      if (isPointInCartesianGridAsphalt(vx, vz, 2.0)) continue;
      const cap = new THREE.CircleGeometry(poly.halfWidth * 0.98, 14);
      cap.rotateX(-Math.PI / 2);
      cap.translate(vx, 0, vz);
      const pos = cap.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setY(k, getUrbanCityReliefY(pos.getX(k), pos.getZ(k)) + 0.168);
      cap.computeVertexNormals();
      asphaltGeos.push(cap);
    }

    for (let i = 0; i < poly.points.length - 1; i++) {
      const [x1, z1] = poly.points[i], [x2, z2] = poly.points[i + 1];
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const ux = dx / len, uz = dz / len, nx = -uz, nz = ux, yaw = Math.atan2(ux, uz);

      const tileSteps = Math.max(1, Math.round(len / 9.5));
      for (let ts = 0; ts <= tileSteps; ts++) {
        const tx = x1 + dx * (ts / tileSteps), tz = z1 + dz * (ts / tileSteps);
        if (isInsideStrictBlockTileCore(tx, tz, allBlockBounds)) {
          world.mapRoads.push({ x: tx, z: tz, w: 10, d: 10, isMain: false, isOrganicTile: true });
        }
      }

      for (let dPos = 7.0; dPos < len - 6.5; dPos += 11.5) {
        const mx = x1 + ux * dPos, mz = z1 + uz * dPos;
        if (isPointInCartesianGridAsphalt(mx, mz, 3.0)) continue;
        if (net.roundabouts.some((rb) => Math.hypot(mx - rb.cx, mz - rb.cz) < rb.outerR + 3.0)) continue;
        const dg = new THREE.BoxGeometry(poly.isMain ? 0.38 : 0.3, 0.04, 4.8);
        dg.rotateY(yaw);
        dg.translate(mx, getUrbanCityReliefY(mx, mz) + 0.192, mz);
        paintGeos.push(dg);
      }

      const swSteps = Math.max(1, Math.ceil(len / 6.0)), stepL = len / swSteps;
      for (const side of [-1, 1]) {
        for (let s = 0; s < swSteps; s++) {
          const d0 = s * stepL, d1 = d0 + stepL, dm = (d0 + d1) * 0.5;
          const bx0 = x1 + ux * d0, bz0 = z1 + uz * d0, bx1 = x1 + ux * d1, bz1 = z1 + uz * d1;
          const bxm = x1 + ux * dm, bzm = z1 + uz * dm, curbOff = poly.halfWidth + 0.18;
          if (canPlaceSw(bxm + nx * side * curbOff, bzm + nz * side * curbOff, -0.08)) {
            pushOrientedCurbPiece(curbGeos, bx0 + nx * side * curbOff, bz0 + nz * side * curbOff, bx1 + nx * side * curbOff, bz1 + nz * side * curbOff, curbTop);
          }
          const rIn = poly.halfWidth, rOut = poly.halfWidth + 7.5, rMid = (rIn + rOut) * 0.5;
          if (canPlaceSw(bxm + nx * side * rMid, bzm + nz * side * rMid, 1.5) && canPlaceSw(bx0 + nx * side * rOut, bz0 + nz * side * rOut, 2.5) && canPlaceSw(bx1 + nx * side * rOut, bz1 + nz * side * rOut, 2.5)) {
            pushPrismQuad(sidewalkGeos, bx0 + nx * side * rIn, bz0 + nz * side * rIn, bx1 + nx * side * rIn, bz1 + nz * side * rIn, bx1 + nx * side * rOut, bz1 + nz * side * rOut, bx0 + nx * side * rOut, bz0 + nz * side * rOut, swTop, 0.34);
          }
        }
      }

      if (len >= 52) {
        for (let pDist = 24; pDist <= len - 24; pDist += 46) {
          for (const side of [-1, 1]) {
            const px = x1 + ux * pDist + nx * side * (poly.halfWidth + 4.4);
            const pz = z1 + uz * pDist + nz * side * (poly.halfWidth + 4.4);
            if (isInsideStrictBlockTileCore(px, pz, allBlockBounds) && canPlaceSw(px, pz, 3.2)) {
              addCurvedLegoPalmTree(batcher, px, getUrbanCityReliefY(px, pz) + swTop, pz, nx * side * 0.18, 0.78, 0.98);
            }
          }
        }
      }
    }
  }

  for (const rb of net.roundabouts) {
    world.mapOrganicRoads.push({ kind: 'roundabout', id: rb.id, cx: rb.cx, cz: rb.cz, innerR: rb.innerR, outerR: rb.outerR, sidewalk: rb.sidewalk });
    const rMid = (rb.innerR + rb.outerR) * 0.5;
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const tx = rb.cx + Math.cos(ang) * rMid, tz = rb.cz + Math.sin(ang) * rMid;
      if (isInsideStrictBlockTileCore(tx, tz, allBlockBounds)) {
        world.mapRoads.push({ x: tx, z: tz, w: 10, d: 10, isMain: false, isOrganicTile: true });
      }
    }

    const ringGeo = new THREE.RingGeometry(rb.innerR - 0.25, rb.outerR + 0.25, 44, 3);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(rb.cx, 0, rb.cz);
    const rPos = ringGeo.attributes.position;
    for (let v = 0; v < rPos.count; v++) rPos.setY(v, getUrbanCityReliefY(rPos.getX(v), rPos.getZ(v)) + 0.17);
    ringGeo.computeVertexNormals();
    asphaltGeos.push(ringGeo);

    for (let s = 0; s < 48; s++) {
      const a0 = (s / 48) * Math.PI * 2, a1 = ((s + 1) / 48) * Math.PI * 2, am = (a0 + a1) * 0.5;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const outerCurbR = rb.outerR + 0.18;
      if (canPlaceSw(rb.cx + Math.cos(am) * outerCurbR, rb.cz + Math.sin(am) * outerCurbR, -0.08)) {
        pushOrientedCurbPiece(curbGeos, rb.cx + c0 * outerCurbR, rb.cz + s0 * outerCurbR, rb.cx + c1 * outerCurbR, rb.cz + s1 * outerCurbR, curbTop);
      }
      const rIn = rb.outerR, rOut = rb.outerR + 8.0;
      if (canPlaceSw(rb.cx + Math.cos(am) * (rIn + 4.0), rb.cz + Math.sin(am) * (rIn + 4.0), 2.2)) {
        pushPrismQuad(sidewalkGeos, rb.cx + c0 * rIn, rb.cz + s0 * rIn, rb.cx + c1 * rIn, rb.cz + s1 * rIn, rb.cx + c1 * rOut, rb.cz + s1 * rOut, rb.cx + c0 * rOut, rb.cz + s0 * rOut, swTop, 0.34);
      }
    }

    const gY = getUrbanCityReliefY(rb.cx, rb.cz);
    const baseDisc = new THREE.CylinderGeometry(rb.innerR, rb.innerR + 0.2, 1.4, 28);
    baseDisc.translate(rb.cx, gY + 0.38 - 0.7, rb.cz);
    islandStoneGeos.push(baseDisc);
    const turfDisc = new THREE.CylinderGeometry(rb.innerR - 1.4, rb.innerR - 1.3, 0.18, 24);
    turfDisc.translate(rb.cx, gY + 0.42, rb.cz);
    islandTurfGeos.push(turfDisc);

    batcher.addBox('stone_white', 8.4, 1.1, 8.4, rb.cx, gY + 0.75, rb.cz);
    batcher.addBox('pool_water', 7.0, 0.36, 7.0, rb.cx, gY + 1.22, rb.cz);
    batcher.addBox('neon_cyan', 2.2, 3.4, 2.2, rb.cx, gY + 2.4, rb.cz);
    batcher.addBox('trim_white', 3.8, 0.45, 3.8, rb.cx, gY + 3.2, rb.cz);
    for (let t = 0; t < 4; t++) {
      const ta = 0.4 + t * Math.PI * 0.5;
      addCurvedLegoPalmTree(batcher, rb.cx + Math.cos(ta) * 7.6, gY + 0.48, rb.cz + Math.sin(ta) * 7.6, Math.cos(ta) * 0.26, Math.sin(ta) * 0.26, 1.12);
    }
    world.addCylinderCollider?.(rb.cx, rb.cz, rb.innerR, gY + 4.8, Math.max(0, gY - 0.8));
  }

  const chunkOpt = { receiveShadow: true, castShadow: false, chunkSize: ws(512) };
  addChunkedArrayToScene(world.scene, asphaltGeos, new THREE.MeshStandardMaterial({ color: 0x121926, roughness: 0.68, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), chunkOpt);
  addChunkedArrayToScene(world.scene, sidewalkGeos, new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.58, metalness: 0.05 }), chunkOpt);
  addChunkedArrayToScene(world.scene, curbGeos, getLegoMaterial(0xcbd5e1, { roughness: 0.46, clearcoat: 0.14 }), chunkOpt);
  addChunkedArrayToScene(world.scene, islandStoneGeos, new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.52 }), chunkOpt);
  addChunkedArrayToScene(world.scene, islandTurfGeos, new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 }), chunkOpt);
  addChunkedArrayToScene(world.scene, paintGeos, new THREE.MeshBasicMaterial({ color: 0x38bdf8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }), { receiveShadow: false, castShadow: false, chunkSize: ws(512) });
}

function computeCoastalSkylineHeight(wx, wz, seed) {
  const jitter = 0.88 + hash01(seed, Math.round(wx * 5 - wz * 3)) * 0.24;
  const edgeFade = 1 - 0.1 * THREE.MathUtils.clamp((Math.abs(wx) - 1150) / 700, 0, 1);
  if (wz >= 1668) {
    const tBeach = THREE.MathUtils.clamp((wz - 1681) / 380, 0, 1);
    return Math.round(THREE.MathUtils.clamp((104 + tBeach * 38) * edgeFade * jitter, 95, 152) * 10) / 10;
  }
  const tRidge = THREE.MathUtils.clamp((wz - 1223) / 425, 0, 1);
  return Math.round(THREE.MathUtils.clamp((56 + tRidge * 30) * edgeFade * jitter, 52, 92) * 10) / 10;
}

function buildCoastalResortPoolPlaza(world, batcher, px, pz, seed) {
  const yBase = (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : getUrbanCityReliefY(px, pz)) + 0.04;
  batcher.addBox('stone_white', 18.0, 2.2, 16.0, px, yBase - 0.9, pz);
  batcher.addBox('wood_deck', 15.2, 0.22, 13.2, px, yBase + 0.26, pz);
  batcher.addBox('trim_white', 10.8, 1.9, 6.8, px, yBase - 0.05, pz);
  batcher.addBox('pool_water', 9.4, 0.32, 5.4, px, yBase + 0.82, pz);
  batcher.addBox('neon_cyan', 9.6, 0.14, 0.22, px, yBase + 0.92, pz + 2.8);

  const uKey = UMBRELLA_KEYS[Math.abs(seed) % UMBRELLA_KEYS.length];
  for (const sx of [-5.8, 5.8]) {
    batcher.addBox('trim_white', 0.2, 2.8, 0.2, px + sx, yBase + 1.65, pz - 4.2);
    batcher.addBox(uKey, 3.6, 0.36, 3.6, px + sx, yBase + 3.05, pz - 4.2);
    batcher.addBox('trim_white', 1.3, 0.32, 2.2, px + sx, yBase + 0.52, pz - 3.6);
  }
  for (const [dx, dz, lx, lz] of [[-7.2, -6.2, -0.2, -0.2], [7.2, -6.2, 0.2, -0.2], [-7.2, 6.2, -0.2, 0.25], [7.2, 6.2, 0.2, 0.25]]) {
    addCurvedLegoPalmTree(batcher, px + dx, yBase + 0.25, pz + dz, lx, lz, 1.04);
  }
  world.addCollider?.(px, pz, 11.2, 7.2, yBase + 1.15, Math.max(0, yBase - 1.2));
}

export function buildCoastalOrganicBlocksAndBoulevards(world, batcher) {
  if (!IS_SCALED_WORLD || !world?.scene) return { roadsAdded: 0, buildingsAdded: 0 };

  const allBlockBounds = [];
  for (let rowIdx = 0; rowIdx < COASTAL_ROWS_DESIGN.length - 1; rowIdx++) {
    for (let colIdx = 0; colIdx < COASTAL_COLS_DESIGN.length - 1; colIdx++) {
      allBlockBounds.push(getCoastalSuperBlockBounds(colIdx, rowIdx));
    }
  }

  const net = buildCoastalOrganicNetworkSpec();
  renderCoastalBoulevardsAndRoundabouts(world, batcher, net, allBlockBounds);

  const hotelObbs = (world.southBeachHotels || []).map((h) => createObb2D(h.x, h.z, h.w + 14, h.d + 14, 0));
  const groundRoads = (world.mapRoads || []).filter(
    (rd) => !rd.isElevated && !rd.isBridge && rd.z >= 1150 && rd.z <= 2190 && rd.x >= -2020 && rd.x <= 1620
  );

  let buildingsAdded = 0;
  for (const blk of allBlockBounds) {
    const inset = ROAD.sidewalk + 2.4;
    const inner = {
      minX: blk.minX + inset, maxX: Math.min(blk.maxX - inset, ws(516) - 28),
      minZ: blk.minZ + inset, maxZ: Math.min(blk.maxZ - inset, ws(710) - 28)
    };
    if (inner.maxX - inner.minX < 30 || inner.maxZ - inner.minZ < 30) continue;

    const localSegs = net.segments.filter((s) => s.maxX >= blk.minX - 32 && s.minX <= blk.maxX + 32 && s.maxZ >= blk.minZ - 32 && s.minZ <= blk.maxZ + 32);
    const localRbs = net.roundabouts.filter((r) => Math.abs(r.cx - (blk.minX + blk.maxX) * 0.5) < 280 && Math.abs(r.cz - (blk.minZ + blk.maxZ) * 0.5) < 280);
    const localRoads = groundRoads.filter((r) => r.x + r.w * 0.5 >= blk.minX - 40 && r.x - r.w * 0.5 <= blk.maxX + 40 && r.z + r.d * 0.5 >= blk.minZ - 40 && r.z - r.d * 0.5 <= blk.maxZ + 40);
    const placedObbs = hotelObbs.filter((ho) => ho.maxX >= blk.minX - 20 && ho.minX <= blk.maxX + 20 && ho.maxZ >= blk.minZ - 20 && ho.minZ <= blk.maxZ + 20);
    const baseSeed = (blk.rowIdx + 1) * 47 + blk.colIdx * 23;

    const canPlace = (obb) =>
      obbInsideBounds2D(obb, inner.minX, inner.maxX, inner.minZ, inner.maxZ, 0) &&
      !STATIC_COASTAL_KEEPOUTS.some((k) => obbIntersectsRect2D(obb, k.minX, k.maxX, k.minZ, k.maxZ, 2.0)) &&
      !placedObbs.some((po) => obbIntersectsObb2D(obb, po, 4.0)) &&
      localRbs.every((rb) => obbClearOfCircle2D(obb, rb.cx, rb.cz, rb.outerR + rb.sidewalk + 2.5)) &&
      localSegs.every((s) => obbClearOfSegment2D(obb, s.x1, s.z1, s.x2, s.z2, s.halfWidth + s.sidewalk + 2.4)) &&
      !localRoads.some((rd) => obbIntersectsRect2D(obb, rd.x - rd.w * 0.5, rd.x + rd.w * 0.5, rd.z - rd.d * 0.5, rd.z + rd.d * 0.5, 2.2));

    for (const f of net.flatironCorners) {
      if (f.cx < blk.minX || f.cx > blk.maxX || f.cz < blk.minZ || f.cz > blk.maxZ) continue;
      let placed = false;
      for (let r = 0; r <= 48 && !placed; r += 8) {
        const steps = r === 0 ? 1 : 12;
        for (let a = 0; a < steps; a++) {
          const ang = (a / steps) * Math.PI * 2;
          const cx = f.cx + Math.cos(ang) * r, cz = f.cz + Math.sin(ang) * r;
          const obb = createObb2D(cx, cz, f.backWidth, f.length, f.rotY);
          if (!canPlace(obb)) continue;
          buildFlatironWedgeBuilding(world, { ...f, cx, cz, height: computeCoastalSkylineHeight(cx, cz, baseSeed + 11), seed: baseSeed + 11 });
          placedObbs.push(obb);
          buildingsAdded++;
          placed = true;
          break;
        }
      }
    }

    for (let si = 0; si < localSegs.length; si++) {
      const seg = localSegs[si];
      if (seg.len < 34) continue;
      const tx = (seg.x2 - seg.x1) / seg.len, tz = (seg.z2 - seg.z1) / seg.len;
      const rotY = Math.atan2(seg.x2 - seg.x1, seg.z2 - seg.z1) + Math.PI * 0.5;
      for (const side of [-1, 1]) {
        let sCur = seg.len < 72 ? seg.len * 0.5 : 26;
        const sEnd = seg.len < 72 ? seg.len * 0.5 + 0.1 : seg.len - 24;
        while (sCur <= sEnd) {
          const lSeed = baseSeed * 31 + si * 13 + (side > 0 ? 7 : 3) + Math.round(sCur);
          const w = 34 + Math.floor(hash01(lSeed, 1) * 12), d = 26 + Math.floor(hash01(lSeed, 2) * 8);
          const dist = seg.halfWidth + seg.sidewalk + 3.2 + d * 0.5;
          const cx = seg.x1 + tx * sCur - tz * side * dist, cz = seg.z1 + tz * sCur + tx * side * dist;
          const obb = createObb2D(cx, cz, w, d, rotY);
          if (canPlace(obb)) {
            buildDetailedBuilding(world, cx, cz, w, computeCoastalSkylineHeight(cx, cz, lSeed), d, COASTAL_STYLES[Math.abs(lSeed) % COASTAL_STYLES.length], { rotY, seed: lSeed });
            placedObbs.push(obb);
            buildingsAdded++;
            sCur += w + 7.5;
          } else {
            sCur += 16.0;
          }
          if (seg.len < 72) break;
        }
      }
    }

    for (const rb of localRbs) {
      if (rb.cx < blk.minX || rb.cx > blk.maxX || rb.cz < blk.minZ || rb.cz > blk.maxZ) continue;
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2 + 0.22, rad = rb.outerR + rb.sidewalk + 16.5;
        const rotY = Math.atan2(Math.cos(ang), Math.sin(ang));
        const cx = rb.cx + Math.cos(ang) * rad, cz = rb.cz + Math.sin(ang) * rad;
        const obb = createObb2D(cx, cz, 28, 24, rotY);
        if (!canPlace(obb)) continue;
        const lSeed = baseSeed * 41 + k * 9;
        buildDetailedBuilding(world, cx, cz, 28, computeCoastalSkylineHeight(cx, cz, lSeed), 24, COASTAL_STYLES[k % COASTAL_STYLES.length], { rotY, seed: lSeed });
        placedObbs.push(obb);
        buildingsAdded++;
      }
    }

    let poolPlaced = false;
    for (let px = inner.minX + 54; px <= inner.maxX - 54 && !poolPlaced; px += 48) {
      for (let pz = inner.minZ + 52; pz <= inner.maxZ - 70 && !poolPlaced; pz += 48) {
        const pObb = createObb2D(px, pz, 22, 20, 0);
        if (!canPlace(pObb)) continue;
        buildCoastalResortPoolPlaza(world, batcher, px, pz, baseSeed + Math.round(px));
        placedObbs.push(pObb);
        poolPlaced = true;
      }
    }

    const edges = [
      { axis: 'x', fixed: inner.minZ, sign: 1 },
      { axis: 'z', fixed: inner.minX, sign: 1 },
      { axis: 'z', fixed: inner.maxX, sign: -1 }
    ];
    for (let ei = 0; ei < edges.length; ei++) {
      const ed = edges[ei];
      let cur = (ed.axis === 'x' ? inner.minX : inner.minZ) + 22;
      const endC = (ed.axis === 'x' ? inner.maxX : inner.maxZ) - 22;
      while (cur <= endC) {
        const eSeed = baseSeed * 53 + ei * 17 + Math.round(cur);
        const span = 38 + Math.floor(hash01(eSeed, 3) * 12), depth = 30 + Math.floor(hash01(eSeed, 4) * 8);
        const w = ed.axis === 'x' ? span : depth, d = ed.axis === 'x' ? depth : span;
        const cx = ed.axis === 'x' ? cur : ed.fixed + ed.sign * (w * 0.5);
        const cz = ed.axis === 'x' ? ed.fixed + ed.sign * (d * 0.5) : cur;
        const obb = createObb2D(cx, cz, w, d, 0);
        if (canPlace(obb)) {
          buildDetailedBuilding(world, cx, cz, w, computeCoastalSkylineHeight(cx, cz, eSeed), d, COASTAL_STYLES[Math.abs(eSeed) % COASTAL_STYLES.length], { rotY: 0, seed: eSeed });
          placedObbs.push(obb);
          buildingsAdded++;
          cur += span + 8.0;
        } else {
          cur += 15.0;
        }
      }
    }

    for (let gx = inner.minX + 54; gx <= inner.maxX - 54; gx += 58) {
      for (let gz = inner.minZ + 54; gz <= inner.maxZ - 54; gz += 58) {
        const iSeed = baseSeed * 67 + Math.round(gx * 3 + gz * 5);
        let rotY = 0, bestSq = 95 * 95;
        for (const s of localSegs) {
          const dSq = (gx - (s.x1 + s.x2) * 0.5) ** 2 + (gz - (s.z1 + s.z2) * 0.5) ** 2;
          if (dSq < bestSq) { bestSq = dSq; rotY = Math.atan2(s.x2 - s.x1, s.z2 - s.z1) + Math.PI * 0.5; }
        }
        const w = 34 + Math.floor(hash01(iSeed, 6) * 12), d = 28 + Math.floor(hash01(iSeed, 7) * 10);
        const obb = createObb2D(gx, gz, w, d, rotY);
        if (!canPlace(obb)) continue;
        buildDetailedBuilding(world, gx, gz, w, computeCoastalSkylineHeight(gx, gz, iSeed), d, COASTAL_STYLES[Math.abs(iSeed) % COASTAL_STYLES.length], { rotY, seed: iSeed });
        placedObbs.push(obb);
        buildingsAdded++;
      }
    }
  }

  return { roadsAdded: net.polylines.length + net.roundabouts.length, buildingsAdded };
}
