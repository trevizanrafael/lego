/**
 * OrganicTrafficPolylineHelper.js
 * Tabelas de rota em polilinha (diagonais e curvas em S), amostragem contínua de faixa à direita,
 * fatiamento 1D de `sidewalkCorridors` fora do asfalto e primitivas OBB 2D para o grid da cidade viva.
 */

import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';

export function buildObbGridBox(cx, cz, hw, hd, rotY) {
  const cosYaw = Math.cos(rotY);
  const sinYaw = Math.sin(rotY);
  const extX = Math.abs(cosYaw) * hw + Math.abs(sinYaw) * hd;
  const extZ = Math.abs(sinYaw) * hw + Math.abs(cosYaw) * hd;
  return {
    minX: cx - extX,
    maxX: cx + extX,
    minZ: cz - extZ,
    maxZ: cz + extZ,
    isObb: true,
    cx,
    cz,
    hx: hw,
    hz: hd,
    cosYaw,
    sinYaw
  };
}

export function isPointInsideGridBox(box, x, z, padding) {
  if (x <= box.minX - padding || x >= box.maxX + padding || z <= box.minZ - padding || z >= box.maxZ + padding) {
    return false;
  }
  if (!box.isObb) return true;
  const dx = x - box.cx;
  const dz = z - box.cz;
  const lx = dx * box.cosYaw - dz * box.sinYaw;
  const lz = dx * box.sinYaw + dz * box.cosYaw;
  return Math.abs(lx) < box.hx + padding && Math.abs(lz) < box.hz + padding;
}

export function resolvePointOutOfObb(box, curX, curZ, radius, out) {
  const dx = curX - box.cx;
  const dz = curZ - box.cz;
  let lx = dx * box.cosYaw - dz * box.sinYaw;
  let lz = dx * box.sinYaw + dz * box.cosYaw;
  const limX = box.hx + radius;
  const limZ = box.hz + radius;
  if (Math.abs(lx) >= limX || Math.abs(lz) >= limZ) return false;
  const penX = limX - Math.abs(lx);
  const penZ = limZ - Math.abs(lz);
  if (penX < penZ) lx = (lx >= 0 ? 1 : -1) * (limX + 0.08);
  else lz = (lz >= 0 ? 1 : -1) * (limZ + 0.08);
  out.x = box.cx + lx * box.cosYaw + lz * box.sinYaw;
  out.z = box.cz - lx * box.sinYaw + lz * box.cosYaw;
  return true;
}

export function sliceSidewalkCorridorAgainstRoads(sc, roadRects) {
  const isX = sc.axis === 'x';
  const fullMin = isX ? sc.minX : sc.minZ;
  const fullMax = isX ? sc.maxX : sc.maxZ;
  if (fullMax - fullMin < 18.0) return [];

  const crossMin = (isX ? sc.minZ : sc.minX) + 0.8;
  const crossMax = (isX ? sc.maxZ : sc.maxX) - 0.8;
  const blocked = [];

  for (let i = 0; i < roadRects.length; i++) {
    const r = roadRects[i];
    const rCrossMin = isX ? r.minZ : r.minX;
    const rCrossMax = isX ? r.maxZ : r.maxX;
    if (rCrossMax <= crossMin || rCrossMin >= crossMax) continue;

    const rAlongMin = (isX ? r.minX : r.minZ) - 1.4;
    const rAlongMax = (isX ? r.maxX : r.maxZ) + 1.4;
    if (rAlongMax <= fullMin || rAlongMin >= fullMax) continue;
    blocked.push([Math.max(fullMin, rAlongMin), Math.min(fullMax, rAlongMax)]);
  }

  if (blocked.length === 0) return [sc];
  blocked.sort((a, b) => a[0] - b[0]);

  const out = [];
  let cursor = fullMin;
  let partIdx = 0;
  for (let i = 0; i < blocked.length; i++) {
    const [b0, b1] = blocked[i];
    if (b0 > cursor + 22.0) {
      out.push(
        isX
          ? { ...sc, minX: cursor, maxX: b0, blockId: `${sc.blockId}_p${partIdx++}` }
          : { ...sc, minZ: cursor, maxZ: b0, blockId: `${sc.blockId}_p${partIdx++}` }
      );
    }
    if (b1 > cursor) cursor = b1;
  }
  if (fullMax > cursor + 22.0) {
    out.push(
      isX
        ? { ...sc, minX: cursor, maxX: fullMax, blockId: `${sc.blockId}_p${partIdx}` }
        : { ...sc, minZ: cursor, maxZ: fullMax, blockId: `${sc.blockId}_p${partIdx}` }
    );
  }
  return out;
}

export function buildPolylineRouteTable(rawPoints, trimEnds = 14.0) {
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) return null;
  const segs = [];
  let total = 0;
  for (let i = 0; i < rawPoints.length - 1; i++) {
    const [x1, z1] = rawPoints[i];
    const [x2, z2] = rawPoints[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) continue;
    segs.push({ x1, z1, x2, z2, dx, dz, len, tx: dx / len, tz: dz / len, s0: total, s1: total + len });
    total += len;
  }
  if (total < trimEnds * 2 + 40) return null;
  return {
    segs,
    totalLen: total,
    minS: trimEnds,
    maxS: total - trimEnds
  };
}

export function samplePolylinePose(polyTable, sAlong, dir = 1, rightLaneOffset = 5.2) {
  const segs = polyTable.segs;
  const clampedS = Math.max(0, Math.min(polyTable.totalLen, sAlong));
  let seg = segs[segs.length - 1];
  for (let i = 0; i < segs.length; i++) {
    if (clampedS <= segs[i].s1 || i === segs.length - 1) {
      seg = segs[i];
      break;
    }
  }
  const localT = seg.len > 1e-4 ? (clampedS - seg.s0) / seg.len : 0;
  const cx = seg.x1 + seg.dx * localT;
  const cz = seg.z1 + seg.dz * localT;
  const fwdX = dir >= 0 ? seg.tx : -seg.tx;
  const fwdZ = dir >= 0 ? seg.tz : -seg.tz;
  const rightX = -fwdZ;
  const rightZ = fwdX;
  const absOff = Math.abs(rightLaneOffset);
  return {
    x: cx + rightX * absOff,
    z: cz + rightZ * absOff,
    rotY: Math.atan2(fwdX, fwdZ),
    fwdX,
    fwdZ
  };
}

export function isPointTouchingSidewalkCorridor(world, x, z, margin = 2.0) {
  const sidewalks = world?.sidewalkCorridors;
  if (!Array.isArray(sidewalks)) return false;
  for (let i = 0; i < sidewalks.length; i++) {
    const s = sidewalks[i];
    if (x > s.minX - margin && x < s.maxX + margin && z > s.minZ - margin && z < s.maxZ + margin) {
      return true;
    }
  }
  return false;
}

export function findSafePolylineAlong(world, polyTable, preferredS, dir, rightLaneOffset) {
  const span = Math.max(10, polyTable.maxS - polyTable.minS);
  for (let step = 0; step < 24; step++) {
    const s = polyTable.minS + (((preferredS - polyTable.minS) + step * 19.0) % span + span) % span;
    const pose = samplePolylinePose(polyTable, s, dir, rightLaneOffset);
    if (getMetroCutoutFloorY(pose.x, pose.z) !== null) continue;
    if (!isPointTouchingSidewalkCorridor(world, pose.x, pose.z, 2.2)) {
      return { s, pose };
    }
  }
  const fallbackS = (polyTable.minS + polyTable.maxS) * 0.5;
  return { s: fallbackS, pose: samplePolylinePose(polyTable, fallbackS, dir, rightLaneOffset) };
}

export function lerpAngleRad(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
