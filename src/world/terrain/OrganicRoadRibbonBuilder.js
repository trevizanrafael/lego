/**
 * OrganicRoadRibbonBuilder.js
 * Construção 3D batcheada das Fitas Asfálticas Orgânicas (Centro + Conectores Inter-Distritais),
 * Calçadas Laterais (+0.18m), Concordâncias Chanfradas/Curvas (Bellmouth Fillets), Praças
 * Triangulares ("Gore Islands"), 4 Rotatórias Paisagísticas e Índice Espacial O(1) de Guias.
 */

import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox } from '../buildings/GeometryMergeUtils.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../core/WorldLayoutScale.js';
import { getDowntownOrganicNetwork } from './OrganicDowntownNetworkSpec.js';
import { buildOrganicIntersectionsAndPlazas } from './RoadIntersectionsBuilder.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import { addChunkedArrayToScene } from './BridgeAndPierSpecs.js';
import {
  isPointInMetroCutout,
  isPointInCartesianGridAsphalt,
  ensureOrganicRoadSpatialIndex,
  getOrganicRoadElevationStateAt,
  pushPrismQuad,
  pushOrientedCurbPiece
} from './OrganicRoadSpatialIndex.js';

export {
  isPointInMetroCutout,
  isPointInCartesianGridAsphalt,
  ensureOrganicRoadSpatialIndex,
  getOrganicRoadElevationStateAt
};

function pushZebraCrosswalkAt(whiteGeos, cx, cz, ux, uz, halfWidth) {
  if (isPointInMetroCutout(cx, cz, 3.0)) return;
  const nx = -uz;
  const nz = ux;
  const yaw = Math.atan2(ux, uz);
  const limit = Math.max(4.5, halfWidth - 2.6);
  for (let lat = -limit; lat <= limit + 0.01; lat += 2.6) {
    const sx = cx + nx * lat;
    const sz = cz + nz * lat;
    if (isPointInMetroCutout(sx, sz, 1.5)) continue;
    const sy = getUrbanCityReliefY(sx, sz) + 0.058;
    const g = new THREE.BoxGeometry(1.05, 0.045, 3.6);
    g.rotateY(yaw);
    g.translate(sx, sy, sz);
    whiteGeos.push(g);
  }
}

function buildPolylineAsphaltGeo(pts, halfWidth, yOff = 0.03) {
  const stations = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.max(1, Math.ceil(len / 9.5));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      stations.push([x1 + (x2 - x1) * t, z1 + (z2 - z1) * t]);
    }
  }
  stations.push(pts[pts.length - 1]);
  if (stations.length < 2) return null;

  const nStat = stations.length;
  const positions = [];
  const indices = [];
  let vBase = 0;

  const computeRightNormal = (k) => {
    const prev = stations[Math.max(0, k - 1)];
    const cur = stations[k];
    const next = stations[Math.min(nStat - 1, k + 1)];
    let t0x = cur[0] - prev[0], t0z = cur[1] - prev[1];
    let t1x = next[0] - cur[0], t1z = next[1] - cur[1];
    const l0 = Math.hypot(t0x, t0z);
    const l1 = Math.hypot(t1x, t1z);
    if (l0 > 1e-5) { t0x /= l0; t0z /= l0; }
    if (l1 > 1e-5) { t1x /= l1; t1z /= l1; }
    if (l0 <= 1e-5) return [-t1z, t1x, 1];
    if (l1 <= 1e-5) return [-t0z, t0x, 1];
    let mx = t0x + t1x, mz = t0z + t1z;
    const mLen = Math.hypot(mx, mz);
    if (mLen < 1e-4) return [-t0z, t0x, 1];
    mx /= mLen; mz /= mLen;
    const nx = -mz, nz = mx;
    const cosHalf = Math.abs(nx * -t0z + nz * t0x);
    return [nx, nz, THREE.MathUtils.clamp(1 / Math.max(0.58, cosHalf), 1.0, 1.52)];
  };

  for (let k = 0; k < nStat - 1; k++) {
    const [ax, az] = stations[k];
    const [bx, bz] = stations[k + 1];
    if (isPointInMetroCutout((ax + bx) * 0.5, (az + bz) * 0.5, halfWidth * 0.6)) continue;
    const [n0x, n0z, m0] = computeRightNormal(k);
    const [n1x, n1z, m1] = computeRightNormal(k + 1);
    const hw0 = halfWidth * m0;
    const hw1 = halfWidth * m1;

    const rowPts = [
      [ax - n0x * hw0, az - n0z * hw0], [ax, az], [ax + n0x * hw0, az + n0z * hw0],
      [bx - n1x * hw1, bz - n1z * hw1], [bx, bz], [bx + n1x * hw1, bz + n1z * hw1]
    ];
    for (let r = 0; r < 6; r++) {
      const [vx, vz] = rowPts[r];
      positions.push(vx, getUrbanCityReliefY(vx, vz) + yOff, vz);
    }
    indices.push(
      vBase, vBase + 3, vBase + 1,
      vBase + 1, vBase + 3, vBase + 4,
      vBase + 1, vBase + 4, vBase + 2,
      vBase + 2, vBase + 4, vBase + 5
    );
    vBase += 6;
  }

  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildOrganicDowntownRoadsAndRoundabouts(world, sharedBuckets = null) {
  if (!IS_SCALED_WORLD || !world?.scene) return;
  ensureOrganicRoadSpatialIndex(world);

  const net = getDowntownOrganicNetwork();
  if (!world.mapOrganicRoads) world.mapOrganicRoads = [];
  if (!world.mapRoads) world.mapRoads = [];

  const existingRectRoads = world.mapRoads.filter((r) => r && !r.isOrganicTile && !r.isElevated);
  const sidewalkCorridors = world.sidewalkCorridors || [];

  const isInsideExistingRectRoad = (px, pz, pad = 0.5) => {
    for (let i = 0; i < existingRectRoads.length; i++) {
      const r = existingRectRoads[i];
      if (px >= r.x - r.w * 0.5 - pad && px <= r.x + r.w * 0.5 + pad && pz >= r.z - r.d * 0.5 - pad && pz <= r.z + r.d * 0.5 + pad) {
        return true;
      }
    }
    return false;
  };

  const isClearOfSidewalkCorridors = (tx, tz, pad = 7.0) => {
    for (let i = 0; i < sidewalkCorridors.length; i++) {
      const s = sidewalkCorridors[i];
      if (tx >= s.minX - pad && tx <= s.maxX + pad && tz >= s.minZ - pad && tz <= s.maxZ + pad) {
        return false;
      }
    }
    return true;
  };

  const asphaltGeos = [];
  const sidewalkGeos = [];
  const curbGeos = [];
  const islandGraniteGeos = [];
  const islandTurfGeos = [];
  const monumentGoldGeos = [];
  const monumentGlowGeos = [];
  const yellowGeos = sharedBuckets?.yellowGeos || [];
  const whiteGeos = sharedBuckets?.whiteGeos || [];

  const curbH = ROAD.curbHeight;
  const orgScratch = {};

  const canPlaceSidewalkPoint = (px, pz, minAsphaltClearance) => {
    if (isPointInMetroCutout(px, pz, 0.8)) return false;
    if (isPointInCartesianGridAsphalt(px, pz, 0.35)) return false;
    if (isInsideExistingRectRoad(px, pz, 0.5)) return false;
    const st = getOrganicRoadElevationStateAt(world, px, pz, orgScratch);
    if (st.inIsland) return false;
    return st.minSignedDist >= minAsphaltClearance;
  };

  // 1) Polilinhas orgânicas (Centro + Conectores Inter-Distritais com hierarquia `tier`)
  for (let p = 0; p < net.polylines.length; p++) {
    const poly = net.polylines[p];
    const polySw = poly.sidewalk ?? ROAD.sidewalk;
    world.mapOrganicRoads.push({
      kind: 'polyline',
      id: poly.id,
      tier: poly.tier || (poly.isMain ? 'arterial' : 'collector'),
      district: poly.district || 'centro_financeiro',
      points: poly.points,
      width: poly.width,
      sidewalk: polySw,
      isMain: poly.isMain
    });

    const ribbonGeo = buildPolylineAsphaltGeo(poly.points, poly.halfWidth, 0.03);
    if (ribbonGeo) asphaltGeos.push(ribbonGeo);

    for (let vi = 0; vi < poly.points.length; vi++) {
      const [vx, vz] = poly.points[vi];
      if (isPointInMetroCutout(vx, vz, poly.halfWidth) || isPointInCartesianGridAsphalt(vx, vz, 2.0)) continue;
      const cap = new THREE.CircleGeometry(poly.halfWidth * 0.98, 16);
      cap.rotateX(-Math.PI / 2);
      cap.translate(vx, 0, vz);
      const pos = cap.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        pos.setY(k, getUrbanCityReliefY(pos.getX(k), pos.getZ(k)) + 0.03);
      }
      cap.computeVertexNormals();
      asphaltGeos.push(cap);
    }

    const pts = poly.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const ux = dx / len, uz = dz / len;
      const nx = -uz, nz = ux;
      const yaw = Math.atan2(ux, uz);

      // Ladrilhos AABB 10m x 10m inscritos no asfalto (evitando calçadas perimetrais em conectores inter-distritais)
      const tileSteps = Math.max(1, Math.round(len / 9.0));
      for (let ts = 0; ts <= tileSteps; ts++) {
        const u = ts / tileSteps;
        const tx = x1 + dx * u;
        const tz = z1 + dz * u;
        if (isPointInCartesianGridAsphalt(tx, tz, -4.0) || isPointInMetroCutout(tx, tz, 6.0)) continue;
        if (poly.isInterDistrict && (isInsideExistingRectRoad(tx, tz, 4.0) || !isClearOfSidewalkCorridors(tx, tz, 7.5))) continue;
        world.mapRoads.push({ x: tx, z: tz, w: 10, d: 10, isMain: false, isOrganicTile: true });
      }

      const paintBucket = poly.isMain ? yellowGeos : whiteGeos;
      const dashW = poly.isMain ? 0.42 : 0.32;
      for (let dPos = 6.5; dPos < len - 6.0; dPos += 11.0) {
        const mx = x1 + ux * dPos;
        const mz = z1 + uz * dPos;
        if (isPointInCartesianGridAsphalt(mx, mz, 2.5) || isPointInMetroCutout(mx, mz, 2.5)) continue;
        if (poly.isInterDistrict && isInsideExistingRectRoad(mx, mz, 2.5)) continue;
        let inOtherCore = false;
        for (let r = 0; r < net.roundabouts.length; r++) {
          const rb = net.roundabouts[r];
          if (Math.hypot(mx - rb.cx, mz - rb.cz) < rb.outerR + 3.0) { inOtherCore = true; break; }
        }
        if (inOtherCore) continue;
        const my = getUrbanCityReliefY(mx, mz) + 0.058;
        const dg = new THREE.BoxGeometry(dashW, 0.045, 5.0);
        dg.rotateY(yaw);
        dg.translate(mx, my, mz);
        paintBucket.push(dg);
      }

      if (i === 0 && len >= 16 && isPointInCartesianGridAsphalt(x1 - ux * 5.0, z1 - uz * 5.0, 4.5)) {
        pushZebraCrosswalkAt(whiteGeos, x1 + ux * 4.2, z1 + uz * 4.2, ux, uz, poly.halfWidth);
      }
      if (i === pts.length - 2 && len >= 16 && isPointInCartesianGridAsphalt(x2 + ux * 5.0, z2 + uz * 5.0, 4.5)) {
        pushZebraCrosswalkAt(whiteGeos, x2 - ux * 4.2, z2 - uz * 4.2, ux, uz, poly.halfWidth);
      }
      if (poly.isMain && i > 0 && isPointInCartesianGridAsphalt(x1, z1, 1.0) && len >= 36) {
        pushZebraCrosswalkAt(whiteGeos, x1 + ux * 23.0, z1 + uz * 23.0, ux, uz, poly.halfWidth);
      }
      if (poly.isMain && i < pts.length - 2 && isPointInCartesianGridAsphalt(x2, z2, 1.0) && len >= 36) {
        pushZebraCrosswalkAt(whiteGeos, x2 - ux * 23.0, z2 - uz * 23.0, ux, uz, poly.halfWidth);
      }

      const swStepTarget = poly.isInterDistrict ? 8.5 : 4.6;
      const swSteps = Math.max(1, Math.ceil(len / swStepTarget));
      const stepL = len / swSteps;
      for (const side of [-1, 1]) {
        for (let s = 0; s < swSteps; s++) {
          const d0 = s * stepL;
          const d1 = d0 + stepL;
          const dm = (d0 + d1) * 0.5;
          const bx0 = x1 + ux * d0, bz0 = z1 + uz * d0;
          const bx1 = x1 + ux * d1, bz1 = z1 + uz * d1;
          const bxm = x1 + ux * dm, bzm = z1 + uz * dm;

          const curbOff = poly.halfWidth + 0.175;
          const cmx = bxm + nx * side * curbOff;
          const cmz = bzm + nz * side * curbOff;
          if (canPlaceSidewalkPoint(cmx, cmz, -0.05)) {
            pushOrientedCurbPiece(
              curbGeos,
              bx0 + nx * side * curbOff, bz0 + nz * side * curbOff,
              bx1 + nx * side * curbOff, bz1 + nz * side * curbOff,
              curbH
            );
          }

          for (let band = 0; band < 2; band++) {
            const rIn = poly.halfWidth + band * (polySw * 0.5);
            const rOut = rIn + polySw * 0.5;
            const rMid = (rIn + rOut) * 0.5;
            const minClr = band === 0 ? -0.06 : 3.2;
            const p0x = bx0 + nx * side * rIn, p0z = bz0 + nz * side * rIn;
            const p1x = bx1 + nx * side * rIn, p1z = bz1 + nz * side * rIn;
            const p2x = bx1 + nx * side * rOut, p2z = bz1 + nz * side * rOut;
            const p3x = bx0 + nx * side * rOut, p3z = bz0 + nz * side * rOut;
            const pmx = bxm + nx * side * rMid, pmz = bzm + nz * side * rMid;
            if (
              canPlaceSidewalkPoint(pmx, pmz, minClr + 1.0) &&
              canPlaceSidewalkPoint(p0x, p0z, minClr) &&
              canPlaceSidewalkPoint(p1x, p1z, minClr) &&
              canPlaceSidewalkPoint(p2x, p2z, minClr + 1.6) &&
              canPlaceSidewalkPoint(p3x, p3z, minClr + 1.6)
            ) {
              pushPrismQuad(sidewalkGeos, p0x, p0z, p1x, p1z, p2x, p2z, p3x, p3z, curbH + 0.002, 0.34);
            }
          }
        }
      }
    }

    for (let vi = 1; vi < pts.length - 1; vi++) {
      const [px, pz] = pts[vi - 1];
      const [vx, vz] = pts[vi];
      const [qx, qz] = pts[vi + 1];
      const a0 = Math.atan2(vx - px, vz - pz);
      const a1 = Math.atan2(qx - vx, qz - vz);
      let diff = a1 - a0;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.06) continue;
      const side = diff > 0 ? -1 : 1;
      const baseN0 = a0 + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      const fanSteps = Math.max(2, Math.ceil((Math.abs(diff) * (poly.halfWidth + polySw)) / 4.2));
      for (let fs = 0; fs < fanSteps; fs++) {
        const t0 = baseN0 + (diff * fs) / fanSteps;
        const t1 = baseN0 + (diff * (fs + 1)) / fanSteps;
        const tm = (t0 + t1) * 0.5;
        const s0 = Math.sin(t0), c0 = Math.cos(t0), s1 = Math.sin(t1), c1 = Math.cos(t1);
        const curbR = poly.halfWidth + 0.175;
        if (canPlaceSidewalkPoint(vx + Math.sin(tm) * curbR, vz + Math.cos(tm) * curbR, -0.05)) {
          pushOrientedCurbPiece(curbGeos, vx + s0 * curbR, vz + c0 * curbR, vx + s1 * curbR, vz + c1 * curbR, curbH);
        }
        for (let band = 0; band < 2; band++) {
          const rIn = poly.halfWidth + band * (polySw * 0.5);
          const rOut = rIn + polySw * 0.5;
          const rMid = (rIn + rOut) * 0.5;
          if (canPlaceSidewalkPoint(vx + Math.sin(tm) * rMid, vz + Math.cos(tm) * rMid, band === 0 ? 1.2 : 4.2)) {
            pushPrismQuad(
              sidewalkGeos,
              vx + s0 * rIn, vz + c0 * rIn,
              vx + s1 * rIn, vz + c1 * rIn,
              vx + s1 * rOut, vz + c1 * rOut,
              vx + s0 * rOut, vz + c0 * rOut,
              curbH + 0.002,
              0.34
            );
          }
        }
      }
    }
  }

  // 2) Concordâncias de Esquina Chanfradas/Curvas (Bellmouth Fillets) + Praças Triangulares ("Gore Islands")
  buildOrganicIntersectionsAndPlazas(world, net, {
    asphaltGeos,
    sidewalkGeos,
    curbGeos,
    islandGraniteGeos,
    islandTurfGeos,
    monumentGoldGeos,
    whiteGeos,
    canPlaceSidewalkPoint
  });

  // 3) As 4 Rotatórias Circulares Monumentais
  for (let i = 0; i < net.roundabouts.length; i++) {
    const rb = net.roundabouts[i];
    world.mapOrganicRoads.push({
      kind: 'roundabout',
      id: rb.id,
      tier: rb.tier || 'collector',
      cx: rb.cx,
      cz: rb.cz,
      innerR: rb.innerR,
      outerR: rb.outerR,
      sidewalk: rb.sidewalk
    });

    const rMid = (rb.innerR + rb.outerR) * 0.5;
    const tileCount = Math.max(12, Math.round((Math.PI * 2 * rMid) / 9.0));
    for (let k = 0; k < tileCount; k++) {
      const ang = (k / tileCount) * Math.PI * 2;
      world.mapRoads.push({ x: rb.cx + Math.cos(ang) * rMid, z: rb.cz + Math.sin(ang) * rMid, w: 10, d: 10, isMain: false, isOrganicTile: true });
    }

    const ringGeo = new THREE.RingGeometry(rb.innerR - 0.25, rb.outerR + 0.25, 48, 3);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(rb.cx, 0, rb.cz);
    const rPos = ringGeo.attributes.position;
    for (let v = 0; v < rPos.count; v++) rPos.setY(v, getUrbanCityReliefY(rPos.getX(v), rPos.getZ(v)) + 0.032);
    ringGeo.computeVertexNormals();
    asphaltGeos.push(ringGeo);

    for (let k = 0; k < 28; k++) {
      const ang = (k / 28) * Math.PI * 2;
      const dx = rb.cx + Math.cos(ang) * rMid, dz = rb.cz + Math.sin(ang) * rMid;
      const dg = new THREE.BoxGeometry(0.32, 0.045, 3.2);
      dg.rotateY(-ang);
      dg.translate(dx, getUrbanCityReliefY(dx, dz) + 0.058, dz);
      whiteGeos.push(dg);
    }

    const ringSectors = 56;
    for (let s = 0; s < ringSectors; s++) {
      const a0 = (s / ringSectors) * Math.PI * 2, a1 = ((s + 1) / ringSectors) * Math.PI * 2, am = (a0 + a1) * 0.5;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), cm = Math.cos(am), sm = Math.sin(am);
      const outerCurbR = rb.outerR + 0.175;
      if (canPlaceSidewalkPoint(rb.cx + cm * outerCurbR, rb.cz + sm * outerCurbR, -0.05)) {
        pushOrientedCurbPiece(curbGeos, rb.cx + c0 * outerCurbR, rb.cz + s0 * outerCurbR, rb.cx + c1 * outerCurbR, rb.cz + s1 * outerCurbR, curbH);
      }
      for (let band = 0; band < 2; band++) {
        const rIn = rb.outerR + band * (rb.sidewalk * 0.5), rOut = rIn + rb.sidewalk * 0.5, rBandMid = (rIn + rOut) * 0.5;
        if (
          canPlaceSidewalkPoint(rb.cx + cm * rBandMid, rb.cz + sm * rBandMid, band === 0 ? 1.2 : 4.8) &&
          canPlaceSidewalkPoint(rb.cx + c0 * rOut, rb.cz + s0 * rOut, band === 0 ? 1.5 : 5.2) &&
          canPlaceSidewalkPoint(rb.cx + c1 * rOut, rb.cz + s1 * rOut, band === 0 ? 1.5 : 5.2)
        ) {
          pushPrismQuad(sidewalkGeos, rb.cx + c0 * rIn, rb.cz + s0 * rIn, rb.cx + c1 * rIn, rb.cz + s1 * rIn, rb.cx + c1 * rOut, rb.cz + s1 * rOut, rb.cx + c0 * rOut, rb.cz + s0 * rOut, curbH + 0.002, 0.34);
        }
      }
    }

    const groundY = getUrbanCityReliefY(rb.cx, rb.cz);
    for (let s = 0; s < 36; s++) {
      const a0 = (s / 36) * Math.PI * 2, a1 = ((s + 1) / 36) * Math.PI * 2, ir = rb.innerR - 0.18;
      pushOrientedCurbPiece(curbGeos, rb.cx + Math.cos(a0) * ir, rb.cz + Math.sin(a0) * ir, rb.cx + Math.cos(a1) * ir, rb.cz + Math.sin(a1) * ir, 0.26);
    }

    const baseDisc = new THREE.CylinderGeometry(rb.innerR - 0.16, rb.innerR, 0.68, 32);
    baseDisc.translate(rb.cx, groundY + 0.26 - 0.34, rb.cz);
    islandGraniteGeos.push(baseDisc);

    const turfDisc = new THREE.CylinderGeometry(rb.innerR - 1.5, rb.innerR - 1.35, 0.16, 28);
    turfDisc.translate(rb.cx, groundY + 0.30 - 0.08, rb.cz);
    islandTurfGeos.push(turfDisc);

    const plinth = new THREE.CylinderGeometry(2.8, 3.4, 0.9, 12);
    plinth.translate(rb.cx, groundY + 0.72, rb.cz);
    islandGraniteGeos.push(plinth);

    if (rb.monumentKind === 'fountain') {
      const basin = new THREE.CylinderGeometry(4.5, 4.8, 0.78, 12);
      basin.translate(rb.cx, groundY + 0.65, rb.cz);
      islandGraniteGeos.push(basin);
      const water = new THREE.CylinderGeometry(4.0, 4.0, 0.24, 16);
      water.translate(rb.cx, groundY + 0.94, rb.cz);
      monumentGlowGeos.push(water);
      const spire = new THREE.CylinderGeometry(0.45, 0.98, 4.2, 8);
      spire.translate(rb.cx, groundY + 3.05, rb.cz);
      const bowl = new THREE.CylinderGeometry(1.7, 0.62, 0.55, 10);
      bowl.translate(rb.cx, groundY + 3.3, rb.cz);
      monumentGoldGeos.push(spire, bowl);
    } else {
      const shaft = new THREE.CylinderGeometry(0.56, 1.38, 6.2, 4);
      shaft.rotateY(Math.PI * 0.25);
      shaft.translate(rb.cx, groundY + 4.25, rb.cz);
      const tip = new THREE.ConeGeometry(0.58, 1.4, 4);
      tip.rotateY(Math.PI * 0.25);
      tip.translate(rb.cx, groundY + 8.05, rb.cz);
      monumentGoldGeos.push(shaft, tip);
      monumentGlowGeos.push(makeFastBox(2.15, 0.3, 2.15, rb.cx, groundY + 1.25, rb.cz));
    }

    const treeR = rb.innerR * 0.56;
    for (let t = 0; t < 3; t++) {
      const ta = 0.42 + (t * Math.PI * 2) / 3;
      world._addLegoTree?.(rb.cx + Math.cos(ta) * treeR, groundY + 0.30, rb.cz + Math.sin(ta) * treeR, 1.08);
    }
    world.addCylinderCollider?.(rb.cx, rb.cz, rb.innerR, groundY + 4.8, groundY);
  }

  const chunkOpt = { receiveShadow: true, castShadow: false, chunkSize: ws(512) };
  addChunkedArrayToScene(world.scene, asphaltGeos, new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.72, metalness: 0.08, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), chunkOpt);
  addChunkedArrayToScene(world.scene, sidewalkGeos, new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.66, metalness: 0.05 }), chunkOpt);
  addChunkedArrayToScene(world.scene, curbGeos, getLegoMaterial(0x94a3b8, { roughness: 0.52, clearcoat: 0.12 }), chunkOpt);
  addChunkedArrayToScene(world.scene, islandGraniteGeos, new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.58, metalness: 0.1 }), { receiveShadow: true, castShadow: true, chunkSize: ws(512) });
  addChunkedArrayToScene(world.scene, islandTurfGeos, new THREE.MeshStandardMaterial({ color: 0x1b3b28, roughness: 0.74, metalness: 0.04 }), chunkOpt);
  addChunkedArrayToScene(world.scene, monumentGoldGeos, new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.28, metalness: 0.72 }), { receiveShadow: true, castShadow: true, chunkSize: ws(512) });
  addChunkedArrayToScene(world.scene, monumentGlowGeos, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), { receiveShadow: false, castShadow: false, chunkSize: ws(512) });

  if (!sharedBuckets) {
    addChunkedArrayToScene(world.scene, yellowGeos, new THREE.MeshBasicMaterial({ color: 0xfacc15, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), { receiveShadow: false });
    addChunkedArrayToScene(world.scene, whiteGeos, new THREE.MeshBasicMaterial({ color: 0xf8fafc, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), { receiveShadow: false });
  }
}
