/**
 * LotGeometry2D.js
 * Primitivas geométricas 2D exatas (SAT OBB-vs-OBB, OBB-vs-Segmento, OBB-vs-Círculo e Polígonos)
 * para loteamento urbano não-cartesiano, ruas diagonais/curvas e validação de sobreposição zero.
 *
 * Convenção de rotação Y Three.js (`CollisionShapes.js`):
 *   local (lx, lz) -> mundo:
 *     wx = cx + lx * cos(rotY) + lz * sin(rotY)
 *     wz = cz - lx * sin(rotY) + lz * cos(rotY)
 */

export function localToWorldXZ(cx, cz, lx, lz, cosY, sinY) {
  return {
    x: cx + lx * cosY + lz * sinY,
    z: cz - lx * sinY + lz * cosY
  };
}

export function worldToLocalXZ(cx, cz, wx, wz, cosY, sinY) {
  const dx = wx - cx;
  const dz = wz - cz;
  return {
    x: dx * cosY - dz * sinY,
    z: dx * sinY + dz * cosY
  };
}

export function createObb2D(cx, cz, w, d, rotY = 0, pad = 0) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const hx = Math.max(0.05, w * 0.5 + pad);
  const hz = Math.max(0.05, d * 0.5 + pad);
  const ux = cosY;
  const uz = -sinY;
  const vx = sinY;
  const vz = cosY;
  const extX = Math.abs(ux) * hx + Math.abs(vx) * hz;
  const extZ = Math.abs(uz) * hx + Math.abs(vz) * hz;

  const corners = [
    [cx - ux * hx - vx * hz, cz - uz * hx - vz * hz],
    [cx + ux * hx - vx * hz, cz + uz * hx - vz * hz],
    [cx + ux * hx + vx * hz, cz + uz * hx + vz * hz],
    [cx - ux * hx + vx * hz, cz - uz * hx + vz * hz]
  ];

  return {
    cx,
    cz,
    w,
    d,
    hx,
    hz,
    rotY,
    cosY,
    sinY,
    ux,
    uz,
    vx,
    vz,
    minX: cx - extX,
    maxX: cx + extX,
    minZ: cz - extZ,
    maxZ: cz + extZ,
    corners
  };
}

export function obbInsideBounds2D(obb, minX, maxX, minZ, maxZ, margin = 0) {
  return (
    obb.minX >= minX + margin &&
    obb.maxX <= maxX - margin &&
    obb.minZ >= minZ + margin &&
    obb.maxZ <= maxZ - margin
  );
}

export function obbIntersectsObb2D(a, b, extraGap = 0) {
  if (
    a.maxX + extraGap <= b.minX ||
    a.minX - extraGap >= b.maxX ||
    a.maxZ + extraGap <= b.minZ ||
    a.minZ - extraGap >= b.maxZ
  ) {
    return false;
  }

  const dx = b.cx - a.cx;
  const dz = b.cz - a.cz;
  const axesX = [a.ux, a.vx, b.ux, b.vx];
  const axesZ = [a.uz, a.vz, b.uz, b.vz];

  for (let i = 0; i < 4; i++) {
    const ax = axesX[i];
    const az = axesZ[i];
    const distProj = Math.abs(dx * ax + dz * az);
    const ra =
      Math.abs(a.ux * ax + a.uz * az) * a.hx +
      Math.abs(a.vx * ax + a.vz * az) * a.hz;
    const rb =
      Math.abs(b.ux * ax + b.uz * az) * b.hx +
      Math.abs(b.vx * ax + b.vz * az) * b.hz;
    if (distProj >= ra + rb + extraGap) {
      return false;
    }
  }
  return true;
}

export function obbIntersectsRect2D(obb, minX, maxX, minZ, maxZ, extraGap = 0) {
  const rCx = (minX + maxX) * 0.5;
  const rCz = (minZ + maxZ) * 0.5;
  const rObb = createObb2D(rCx, rCz, maxX - minX, maxZ - minZ, 0, 0);
  return obbIntersectsObb2D(obb, rObb, extraGap);
}

export function pointToSegmentDistSq2D(px, pz, x1, z1, x2, z2) {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const wx = px - x1;
  const wz = pz - z1;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 1e-8) {
    return wx * wx + wz * wz;
  }
  let t = (wx * vx + wz * vz) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const qx = x1 + t * vx;
  const qz = z1 + t * vz;
  const dx = px - qx;
  const dz = pz - qz;
  return dx * dx + dz * dz;
}

export function pointToSegmentDist2D(px, pz, x1, z1, x2, z2) {
  return Math.sqrt(pointToSegmentDistSq2D(px, pz, x1, z1, x2, z2));
}

function segmentHitsCenteredAabb2D(lx1, lz1, lx2, lz2, hx, hz) {
  let t0 = 0;
  let t1 = 1;
  const dx = lx2 - lx1;
  const dz = lz2 - lz1;

  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  return (
    clip(-dx, lx1 + hx) &&
    clip(dx, hx - lx1) &&
    clip(-dz, lz1 + hz) &&
    clip(dz, hz - lz1)
  );
}

function pointToCenteredBoxDistSq2D(lx, lz, hx, hz) {
  const qx = Math.max(-hx, Math.min(hx, lx));
  const qz = Math.max(-hz, Math.min(hz, lz));
  const dx = lx - qx;
  const dz = lz - qz;
  return dx * dx + dz * dz;
}

/**
 * Retorna `true` se a distância mínima entre `obb` e o segmento `(x1,z1)-(x2,z2)` for `>= minClearance`.
 */
export function obbClearOfSegment2D(obb, x1, z1, x2, z2, minClearance) {
  const sMinX = Math.min(x1, x2) - minClearance;
  const sMaxX = Math.max(x1, x2) + minClearance;
  const sMinZ = Math.min(z1, z2) - minClearance;
  const sMaxZ = Math.max(z1, z2) + minClearance;
  if (
    obb.maxX < sMinX ||
    obb.minX > sMaxX ||
    obb.maxZ < sMinZ ||
    obb.minZ > sMaxZ
  ) {
    return true;
  }

  const p1 = worldToLocalXZ(obb.cx, obb.cz, x1, z1, obb.cosY, obb.sinY);
  const p2 = worldToLocalXZ(obb.cx, obb.cz, x2, z2, obb.cosY, obb.sinY);
  const hx = obb.hx;
  const hz = obb.hz;

  if (segmentHitsCenteredAabb2D(p1.x, p1.z, p2.x, p2.z, hx, hz)) {
    return minClearance <= 0;
  }

  const reqSq = minClearance * minClearance;
  if (pointToCenteredBoxDistSq2D(p1.x, p1.z, hx, hz) < reqSq) return false;
  if (pointToCenteredBoxDistSq2D(p2.x, p2.z, hx, hz) < reqSq) return false;

  const corners = [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz]
  ];
  for (let i = 0; i < 4; i++) {
    const [cx, cz] = corners[i];
    if (pointToSegmentDistSq2D(cx, cz, p1.x, p1.z, p2.x, p2.z) < reqSq) {
      return false;
    }
  }
  return true;
}

export function obbClearOfCircle2D(obb, circleX, circleZ, radius) {
  const loc = worldToLocalXZ(obb.cx, obb.cz, circleX, circleZ, obb.cosY, obb.sinY);
  return pointToCenteredBoxDistSq2D(loc.x, loc.z, obb.hx, obb.hz) >= radius * radius;
}
