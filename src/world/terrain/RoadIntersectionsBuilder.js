/**
 * RoadIntersectionsBuilder.js
 * Geometria batcheada de interseções orgânicas reais (Bellmouth / Curb Corner Fillets),
 * Faixas de Pedestres Oblíquas / Linhas de Retenção e Praças Triangulares ("Gore Islands") +0.22m.
 *
 * Regra de Performance (M2/M3/M4):
 *  - ZERO malhas soltas adicionadas à cena; 100% das geometrias são empurradas nos buckets
 *    chunked existentes (`asphaltGeos`, `sidewalkGeos`, `curbGeos`, `islandGraniteGeos`,
 *    `islandTurfGeos`, `monumentGoldGeos`, `whiteGeos`).
 */

import * as THREE from 'three';
import { makeFastBox } from '../buildings/GeometryMergeUtils.js';
import { ROAD } from '../core/WorldLayoutScale.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import {
  isPointInMetroCutout,
  isPointInCartesianGridAsphalt,
  pushPrismQuad,
  pushOrientedCurbPiece
} from './OrganicRoadSpatialIndex.js';

function pushTerrainTriangle(bucket, x0, z0, x1, z1, x2, z2, yOff) {
  const cross = (x1 - x0) * (z2 - z0) - (z1 - z0) * (x2 - x0);
  const pts = cross <= 0 ? [[x0, z0], [x1, z1], [x2, z2]] : [[x0, z0], [x2, z2], [x1, z1]];
  const pos = new Float32Array(9);
  for (let i = 0; i < 3; i++) {
    const [vx, vz] = pts[i];
    pos[i * 3] = vx;
    pos[i * 3 + 1] = getUrbanCityReliefY(vx, vz) + yOff;
    pos[i * 3 + 2] = vz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  bucket.push(geo);
}

function pushConvexPolygonIslandPrism(bucket, polyPts, topOffY, skirtDepth = 0.56) {
  const n = polyPts.length;
  if (n < 3) return;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    cx += polyPts[i][0];
    cz += polyPts[i][1];
  }
  cx /= n;
  cz /= n;

  // Ordena em sentido anti-horário no plano XZ para faces superiores com normal +Y
  const ordered = polyPts
    .slice()
    .sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx));

  const positions = [];
  const indices = [];

  const cTopY = getUrbanCityReliefY(cx, cz) + topOffY;
  positions.push(cx, cTopY, cz); // índice 0: centro superior

  for (let i = 0; i < n; i++) {
    const [vx, vz] = ordered[i];
    const topY = getUrbanCityReliefY(vx, vz) + topOffY;
    positions.push(vx, topY, vz); // 1 .. n (anel superior)
  }
  for (let i = 0; i < n; i++) {
    const [vx, vz] = ordered[i];
    const topY = getUrbanCityReliefY(vx, vz) + topOffY;
    positions.push(vx, topY - skirtDepth, vz); // n+1 .. 2n (anel inferior da saia)
  }

  for (let i = 0; i < n; i++) {
    const curTop = 1 + i;
    const nextTop = 1 + ((i + 1) % n);
    const curBot = 1 + n + i;
    const nextBot = 1 + n + ((i + 1) % n);
    // Tampa superior (normal +Y: cross(cur-c, next-c) com ângulo crescente aponta para -Y, então invertemos nextTop, curTop)
    indices.push(0, nextTop, curTop);
    // Saia lateral externa
    indices.push(curTop, nextTop, nextBot, curTop, nextBot, curBot);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  bucket.push(geo);
}

function chamferTrianglePolygon(pts, chamferDist = 2.4) {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const prev = pts[(i + 2) % 3];
    const cur = pts[i];
    const next = pts[(i + 1) % 3];
    const dPrev = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]) || 1;
    const dNext = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
    const cPrev = Math.min(chamferDist, dPrev * 0.28);
    const cNext = Math.min(chamferDist, dNext * 0.28);
    out.push([
      cur[0] + ((prev[0] - cur[0]) / dPrev) * cPrev,
      cur[1] + ((prev[1] - cur[1]) / dPrev) * cPrev
    ]);
    out.push([
      cur[0] + ((next[0] - cur[0]) / dNext) * cNext,
      cur[1] + ((next[1] - cur[1]) / dNext) * cNext
    ]);
  }
  return out;
}

function pushObliqueStopBarAndCrosswalk(whiteGeos, mouthX, mouthZ, ux, uz, halfWidth, isDiagonal) {
  if (isPointInMetroCutout(mouthX, mouthZ, 4.0)) return;
  const nx = -uz;
  const nz = ux;
  const yaw = Math.atan2(ux, uz);

  // Linha transversal de retenção ("Stop Bar") recuada após a faixa de pedestres
  const stopDist = 8.4;
  const barHalf = Math.max(3.5, halfWidth - 1.6);
  const bx = mouthX + ux * stopDist;
  const bz = mouthZ + uz * stopDist;
  if (!isPointInMetroCutout(bx, bz, 2.5) && !isPointInCartesianGridAsphalt(bx, bz, 1.0)) {
    const by = getUrbanCityReliefY(bx, bz) + 0.059;
    const barGeo = new THREE.BoxGeometry(barHalf * 2, 0.045, 0.55);
    barGeo.rotateY(yaw);
    barGeo.translate(bx, by, bz);
    whiteGeos.push(barGeo);
  }

  if (!isDiagonal) return;

  // Em encontros oblíquos, adiciona faixa continental escalonada acompanhando o esconsamento
  const cwCenterDist = 4.2;
  const limit = Math.max(4.5, halfWidth - 2.2);
  const skewFactor = THREE.MathUtils.clamp((ux * uz) * 0.55, -0.35, 0.35);
  for (let lat = -limit; lat <= limit + 0.01; lat += 2.4) {
    const along = cwCenterDist + lat * skewFactor;
    const sx = mouthX + ux * along + nx * lat;
    const sz = mouthZ + uz * along + nz * lat;
    if (isPointInMetroCutout(sx, sz, 1.6)) continue;
    const sy = getUrbanCityReliefY(sx, sz) + 0.059;
    const stripe = new THREE.BoxGeometry(0.95, 0.045, 3.8);
    stripe.rotateY(yaw);
    stripe.translate(sx, sy, sz);
    whiteGeos.push(stripe);
  }
}

function buildBellmouthAtEndpoint(poly, isStart, net, buckets) {
  const { asphaltGeos, sidewalkGeos, curbGeos, whiteGeos, canPlaceSidewalkPoint } = buckets;
  const pts = poly.points;
  const [px, pz] = isStart ? pts[0] : pts[pts.length - 1];
  const [qx, qz] = isStart ? pts[1] : pts[pts.length - 2];
  const dx = qx - px;
  const dz = qz - pz;
  const segLen = Math.hypot(dx, dz);
  if (segLen < 14.0) return;

  const ux = dx / segLen; // Aponta para DENTRO da polilinha (afastando-se da interseção)
  const uz = dz / segLen;
  const nx = -uz;
  const nz = ux;

  // Ignora pontas que desembocam em rotatórias (já tratadas pelo anel circular) ou recortes de metrô
  if (isPointInMetroCutout(px, pz, poly.halfWidth + 4.0)) return;
  for (let r = 0; r < net.roundabouts.length; r++) {
    const rb = net.roundabouts[r];
    if (Math.hypot(px - rb.cx, pz - rb.cz) <= rb.outerR + 8.0) return;
  }

  const meetsCartesian = isPointInCartesianGridAsphalt(px - ux * 5.5, pz - uz * 5.5, 4.5);
  let trunkSeg = null;
  if (!meetsCartesian) {
    for (let i = 0; i < net.segments.length; i++) {
      const s = net.segments[i];
      if (s.polyId === poly.id) continue;
      if (px < s.minX || px > s.maxX || pz < s.minZ || pz > s.maxZ) continue;
      const vx = s.x2 - s.x1, vz = s.z2 - s.z1;
      const t = THREE.MathUtils.clamp(((px - s.x1) * vx + (pz - s.z1) * vz) / (s.len * s.len), 0, 1);
      const dist = Math.hypot(px - (s.x1 + vx * t), pz - (s.z1 + vz * t));
      if (dist <= s.halfWidth + 3.5) {
        trunkSeg = s;
        break;
      }
    }
  }
  if (!meetsCartesian && !trunkSeg) return;

  const flareLen = Math.min(segLen * 0.42, poly.isMain ? 10.5 : 8.0);
  const flareSpread = poly.isMain ? 7.6 : 5.8;
  const arcSteps = 5;
  const curbH = ROAD.curbHeight;
  const isDiagonal = Math.abs(ux) > 0.22 && Math.abs(uz) > 0.22;

  pushObliqueStopBarAndCrosswalk(whiteGeos, px, pz, ux, uz, poly.halfWidth, isDiagonal && !meetsCartesian);

  for (const side of [-1, 1]) {
    const arcPts = [];
    for (let s = 0; s <= arcSteps; s++) {
      const t = s / arcSteps; // t=0 na boca da interseção -> t=1 tangente à guia da polilinha
      const along = flareLen * t;
      const extraLat = flareSpread * (1 - Math.sin(t * Math.PI * 0.5));
      const lat = poly.halfWidth + extraLat;
      arcPts.push([
        px + ux * along + nx * side * lat,
        pz + uz * along + nz * side * lat,
        along,
        lat
      ]);
    }

    // Leque asfáltico chanfrado/curvo eliminando degraus retos de 90°/agudos na boca
    for (let s = 0; s < arcSteps; s++) {
      const a0 = arcPts[s];
      const a1 = arcPts[s + 1];
      const i0x = px + ux * a0[2] + nx * side * (poly.halfWidth * 0.85);
      const i0z = pz + uz * a0[2] + nz * side * (poly.halfWidth * 0.85);
      const i1x = px + ux * a1[2] + nx * side * (poly.halfWidth * 0.85);
      const i1z = pz + uz * a1[2] + nz * side * (poly.halfWidth * 0.85);
      if (!isPointInMetroCutout((a0[0] + a1[0]) * 0.5, (a0[1] + a1[1]) * 0.5, 1.5)) {
        pushTerrainTriangle(asphaltGeos, i0x, i0z, a0[0], a0[1], a1[0], a1[1], 0.031);
        pushTerrainTriangle(asphaltGeos, i0x, i0z, a1[0], a1[1], i1x, i1z, 0.031);
      }

      // Arco de meio-fio de granito + fechamento da calçada acompanhando o raio de concordância
      const mx = (a0[0] + a1[0]) * 0.5;
      const mz = (a0[1] + a1[1]) * 0.5;
      const segDx = a1[0] - a0[0];
      const segDz = a1[1] - a0[1];
      const segL = Math.hypot(segDx, segDz) || 1;
      // Normal apontando para fora do leito asfáltico (em direção à calçada)
      const outNx = side > 0 ? -segDz / segL : segDz / segL;
      const outNz = side > 0 ? segDx / segL : -segDx / segL;

      const c0x = a0[0] + outNx * 0.18, c0z = a0[1] + outNz * 0.18;
      const c1x = a1[0] + outNx * 0.18, c1z = a1[1] + outNz * 0.18;
      if (canPlaceSidewalkPoint(mx + outNx * 0.35, mz + outNz * 0.35, -0.12)) {
        pushOrientedCurbPiece(curbGeos, c0x, c0z, c1x, c1z, curbH);
      }

      const swW = 4.6;
      const p2x = a1[0] + outNx * swW, p2z = a1[1] + outNz * swW;
      const p3x = a0[0] + outNx * swW, p3z = a0[1] + outNz * swW;
      if (
        canPlaceSidewalkPoint(mx + outNx * (swW * 0.5), mz + outNz * (swW * 0.5), 0.6) &&
        canPlaceSidewalkPoint(p2x, p2z, 1.2) &&
        canPlaceSidewalkPoint(p3x, p3z, 1.2)
      ) {
        pushPrismQuad(sidewalkGeos, a0[0], a0[1], a1[0], a1[1], p2x, p2z, p3x, p3z, curbH + 0.003, 0.34);
      }
    }
  }
}

function buildTriangularGorePlazas(world, plazas, buckets) {
  if (!Array.isArray(plazas) || plazas.length === 0) return;
  const { curbGeos, islandGraniteGeos, islandTurfGeos, monumentGoldGeos } = buckets;
  const islandTopOff = 0.22;
  const planterTopOff = 0.28;

  for (let p = 0; p < plazas.length; p++) {
    const plaza = plazas[p];
    if (isPointInMetroCutout(plaza.cx, plaza.cz, 6.0)) continue;

    // 1. Ilha pavimentada elevada (+0.22m) com pontas chanfradas em 6 vértices angulares
    const outerChamfered = chamferTrianglePolygon(plaza.points, 2.5);
    pushConvexPolygonIslandPrism(islandGraniteGeos, outerChamfered, islandTopOff, 0.58);

    for (let i = 0; i < outerChamfered.length; i++) {
      const [x0, z0] = outerChamfered[i];
      const [x1, z1] = outerChamfered[(i + 1) % outerChamfered.length];
      pushOrientedCurbPiece(curbGeos, x0, z0, x1, z1, islandTopOff);
    }

    // 2. Balizadores táticos ("bollards") chanfrados nas 3 proas da praça triangular
    for (let k = 0; k < 3; k++) {
      const [cAx, cAz] = outerChamfered[k * 2];
      const [cBx, cBz] = outerChamfered[k * 2 + 1];
      const bx = (cAx + cBx) * 0.5;
      const bz = (cAz + cBz) * 0.5;
      const mx = bx + (plaza.cx - bx) * 0.14;
      const mz = bz + (plaza.cz - bz) * 0.14;
      const by = getUrbanCityReliefY(mx, mz) + islandTopOff;
      islandGraniteGeos.push(makeFastBox(0.46, 0.86, 0.46, mx, by + 0.43, mz));
      monumentGoldGeos.push(makeFastBox(0.50, 0.14, 0.50, mx, by + 0.82, mz));
    }

    // 3. Canteiro central arborizado elevado (+0.28m) + árvores instanciadas + colisor válido
    const shrink = 0.48;
    const innerTri = plaza.points.map(([vx, vz]) => [
      plaza.cx + (vx - plaza.cx) * shrink,
      plaza.cz + (vz - plaza.cz) * shrink
    ]);
    const innerChamfered = chamferTrianglePolygon(innerTri, 1.2);
    pushConvexPolygonIslandPrism(islandGraniteGeos, innerChamfered, planterTopOff, 0.24);

    const turfTri = plaza.points.map(([vx, vz]) => [
      plaza.cx + (vx - plaza.cx) * (shrink * 0.82),
      plaza.cz + (vz - plaza.cz) * (shrink * 0.82)
    ]);
    pushConvexPolygonIslandPrism(islandTurfGeos, chamferTrianglePolygon(turfTri, 0.9), planterTopOff + 0.03, 0.14);

    const groundY = getUrbanCityReliefY(plaza.cx, plaza.cz);
    const count = Math.max(1, plaza.treeCount || 2);
    if (count === 1) {
      world._addLegoTree?.(plaza.cx, groundY + planterTopOff + 0.03, plaza.cz, 1.06);
    } else {
      for (let t = 0; t < count; t++) {
        const v = plaza.points[t % 3];
        const tx = plaza.cx + (v[0] - plaza.cx) * 0.24;
        const tz = plaza.cz + (v[1] - plaza.cz) * 0.24;
        const ty = getUrbanCityReliefY(tx, tz);
        world._addLegoTree?.(tx, ty + planterTopOff + 0.03, tz, 1.04);
      }
    }
    world.addCylinderCollider?.(plaza.cx, plaza.cz, plaza.colliderR || 3.2, groundY + 3.2, groundY);
  }
}

export function buildOrganicIntersectionsAndPlazas(world, net, buckets) {
  if (!world || !net || !buckets) return;
  const polylines = net.polylines || [];
  for (let i = 0; i < polylines.length; i++) {
    const poly = polylines[i];
    if (!Array.isArray(poly.points) || poly.points.length < 2) continue;
    buildBellmouthAtEndpoint(poly, true, net, buckets);
    buildBellmouthAtEndpoint(poly, false, net, buckets);
  }
  buildTriangularGorePlazas(world, net.triangularPlazas, buckets);
}
