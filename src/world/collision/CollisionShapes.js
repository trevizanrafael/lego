/**
 * CollisionShapes.js
 * Primitivas geométricas narrow-phase zero-GC ('box', 'obb', 'cylinder').
 * Convenção Y-rotation Three.js: fwd = (sin(yaw), cos(yaw)), right = (cos(yaw), -sin(yaw)).
 */

export function syncObbColliderBounds(col) {
  const yaw = Number(col.yaw) || 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const halfX = Math.max(0, Number(col.halfX) || 0);
  const halfZ = Math.max(0, Number(col.halfZ) || 0);
  col.yaw = yaw;
  col.cosYaw = c;
  col.sinYaw = s;
  col.halfX = halfX;
  col.halfZ = halfZ;
  const extX = Math.abs(c) * halfX + Math.abs(s) * halfZ;
  const extZ = Math.abs(s) * halfX + Math.abs(c) * halfZ;
  col.minX = col.cx - extX;
  col.maxX = col.cx + extX;
  col.minZ = col.cz - extZ;
  col.maxZ = col.cz + extZ;
  return col;
}

export function syncCylinderColliderBounds(col) {
  const r = Math.max(0, Number(col.radius) || 0);
  col.radius = r;
  col.minX = col.cx - r;
  col.maxX = col.cx + r;
  col.minZ = col.cz - r;
  col.maxZ = col.cz + r;
  return col;
}

export function createBoxCollider(x, z, width, depth, maxY = 10, minY = 0, opts = {}) {
  const hx = Math.max(0, width * 0.5);
  const hz = Math.max(0, depth * 0.5);
  return {
    shapeType: 'box',
    minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, minY, maxY,
    disabled: Boolean(opts.disabled), isDynamic: Boolean(opts.isDynamic),
    tag: opts.tag || null, _qid: 0, _gridKeys: null
  };
}

export function createObbCollider(cx, cz, width, depth, yaw = 0, maxY = 10, minY = 0, opts = {}) {
  return syncObbColliderBounds({
    shapeType: 'obb', cx, cz,
    halfX: Math.max(0, width * 0.5), halfZ: Math.max(0, depth * 0.5),
    yaw, cosYaw: 1, sinYaw: 0, minY, maxY, minX: 0, maxX: 0, minZ: 0, maxZ: 0,
    disabled: Boolean(opts.disabled), isDynamic: Boolean(opts.isDynamic),
    tag: opts.tag || null, _qid: 0, _gridKeys: null
  });
}

export function createCylinderCollider(cx, cz, radius, maxY = 10, minY = 0, opts = {}) {
  return syncCylinderColliderBounds({
    shapeType: 'cylinder', cx, cz, radius: Math.max(0, radius),
    minY, maxY, minX: 0, maxX: 0, minZ: 0, maxZ: 0,
    disabled: Boolean(opts.disabled), isDynamic: Boolean(opts.isDynamic),
    tag: opts.tag || null, _qid: 0, _gridKeys: null
  });
}

function resetHit2D(out) {
  out.hit = false; out.pushX = 0; out.pushZ = 0; out.nx = 0; out.nz = 0; out.depth = 0;
  return out;
}

function circleVsCenteredBox2D(lx, lz, radius, halfX, halfZ, out) {
  const qx = Math.max(-halfX, Math.min(halfX, lx));
  const qz = Math.max(-halfZ, Math.min(halfZ, lz));
  const rx = lx - qx;
  const rz = lz - qz;
  const distSq = rx * rx + rz * rz;

  if (distSq > 1e-12) {
    if (distSq >= radius * radius) return resetHit2D(out);
    const dist = Math.sqrt(distSq);
    out.nx = rx / dist;
    out.nz = rz / dist;
    out.depth = radius - dist;
  } else {
    const penR = halfX - lx;
    const penL = halfX + lx;
    const penF = halfZ - lz;
    const penB = halfZ + lz;
    const minXPen = penR <= penL ? penR : penL;
    const minZPen = penF <= penB ? penF : penB;
    if (minXPen <= minZPen) {
      out.nx = penR <= penL ? 1 : -1;
      out.nz = 0;
      out.depth = minXPen + radius;
    } else {
      out.nx = 0;
      out.nz = penF <= penB ? 1 : -1;
      out.depth = minZPen + radius;
    }
  }
  out.hit = true;
  out.pushX = out.nx * out.depth;
  out.pushZ = out.nz * out.depth;
  return out;
}

export function testCircleVsCollider2D(x, z, radius, col, out = {}) {
  if (!col || col.disabled) return resetHit2D(out);
  const r = Math.max(0, radius);
  const type = col.shapeType || 'box';

  if (type === 'cylinder') {
    const dx = x - col.cx;
    const dz = z - col.cz;
    const sumR = col.radius + r;
    const distSq = dx * dx + dz * dz;
    if (distSq >= sumR * sumR) return resetHit2D(out);
    if (distSq > 1e-12) {
      const dist = Math.sqrt(distSq);
      out.nx = dx / dist; out.nz = dz / dist; out.depth = sumR - dist;
    } else {
      out.nx = 1; out.nz = 0; out.depth = sumR;
    }
    out.hit = true;
    out.pushX = out.nx * out.depth;
    out.pushZ = out.nz * out.depth;
    return out;
  }

  if (type === 'obb') {
    const c = col.cosYaw ?? Math.cos(col.yaw || 0);
    const s = col.sinYaw ?? Math.sin(col.yaw || 0);
    const dx = x - col.cx;
    const dz = z - col.cz;
    circleVsCenteredBox2D(dx * c - dz * s, dx * s + dz * c, r, col.halfX, col.halfZ, out);
    if (!out.hit) return out;
    const lnx = out.nx;
    const lnz = out.nz;
    out.nx = lnx * c + lnz * s;
    out.nz = -lnx * s + lnz * c;
    out.pushX = out.nx * out.depth;
    out.pushZ = out.nz * out.depth;
    return out;
  }

  return circleVsCenteredBox2D(
    x - (col.minX + col.maxX) * 0.5,
    z - (col.minZ + col.maxZ) * 0.5,
    r,
    (col.maxX - col.minX) * 0.5,
    (col.maxZ - col.minZ) * 0.5,
    out
  );
}

export function testObbVsCollider2D(cx, cz, halfX, halfZ, yaw, col, out = {}) {
  if (!col || col.disabled) return resetHit2D(out);
  const ca = Math.cos(yaw || 0);
  const sa = Math.sin(yaw || 0);
  const type = col.shapeType || 'box';

  if (type === 'cylinder') {
    const dx = col.cx - cx;
    const dz = col.cz - cz;
    circleVsCenteredBox2D(dx * ca - dz * sa, dx * sa + dz * ca, col.radius, halfX, halfZ, out);
    if (!out.hit) return out;
    const lnx = -out.nx;
    const lnz = -out.nz;
    out.nx = lnx * ca + lnz * sa;
    out.nz = -lnx * sa + lnz * ca;
    out.pushX = out.nx * out.depth;
    out.pushZ = out.nz * out.depth;
    return out;
  }

  const arx = ca, arz = -sa, afx = sa, afz = ca;
  let bx, bz, bHalfX, bHalfZ, brx = 1, brz = 0, bfx = 0, bfz = 1;
  if (type === 'obb') {
    bx = col.cx; bz = col.cz; bHalfX = col.halfX; bHalfZ = col.halfZ;
    const cb = col.cosYaw ?? Math.cos(col.yaw || 0);
    const sb = col.sinYaw ?? Math.sin(col.yaw || 0);
    brx = cb; brz = -sb; bfx = sb; bfz = cb;
  } else {
    bx = (col.minX + col.maxX) * 0.5; bz = (col.minZ + col.maxZ) * 0.5;
    bHalfX = (col.maxX - col.minX) * 0.5; bHalfZ = (col.maxZ - col.minZ) * 0.5;
  }

  const tx = cx - bx;
  const tz = cz - bz;
  let minOverlap = Infinity;
  let bestNx = 0;
  let bestNz = 0;

  for (let axisIdx = 0; axisIdx < 4; axisIdx++) {
    const ux = axisIdx === 0 ? arx : axisIdx === 1 ? afx : axisIdx === 2 ? brx : bfx;
    const uz = axisIdx === 0 ? arz : axisIdx === 1 ? afz : axisIdx === 2 ? brz : bfz;
    const ra = halfX * Math.abs(ux * arx + uz * arz) + halfZ * Math.abs(ux * afx + uz * afz);
    const rb = bHalfX * Math.abs(ux * brx + uz * brz) + bHalfZ * Math.abs(ux * bfx + uz * bfz);
    const proj = tx * ux + tz * uz;
    const overlap = ra + rb - Math.abs(proj);
    if (overlap <= 0) return resetHit2D(out);
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = proj < 0 ? -1 : 1;
      bestNx = ux * sign;
      bestNz = uz * sign;
    }
  }

  out.hit = true;
  out.depth = minOverlap;
  out.nx = bestNx;
  out.nz = bestNz;
  out.pushX = bestNx * minOverlap;
  out.pushZ = bestNz * minOverlap;
  return out;
}

function resetRayHit3D(out) {
  out.hit = false; out.t = 1; out.px = 0; out.py = 0; out.pz = 0; out.nx = 0; out.ny = 0; out.nz = 0;
  return out;
}

function raycastLocalAabb3D(ax, ay, az, bx, by, bz, minX, maxX, minY, maxY, minZ, maxZ, out) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let tMin = 0, tMax = 1, hitNx = 0, hitNy = 0, hitNz = 0, startedInside = true;

  for (let axis = 0; axis < 3; axis++) {
    const a = axis === 0 ? ax : axis === 1 ? ay : az;
    const d = axis === 0 ? dx : axis === 1 ? dy : dz;
    const bMin = axis === 0 ? minX : axis === 1 ? minY : minZ;
    const bMax = axis === 0 ? maxX : axis === 1 ? maxY : maxZ;

    if (Math.abs(d) < 1e-9) {
      if (a < bMin || a > bMax) return resetRayHit3D(out);
    } else {
      const invD = 1 / d;
      let t1 = (bMin - a) * invD, t2 = (bMax - a) * invD, n1 = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n1 = 1; }
      if (t1 > 0) startedInside = false;
      if (t1 > tMin) {
        tMin = t1;
        hitNx = axis === 0 ? n1 : 0;
        hitNy = axis === 1 ? n1 : 0;
        hitNz = axis === 2 ? n1 : 0;
      }
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return resetRayHit3D(out);
    }
  }

  if (startedInside) {
    let best = ax - minX;
    hitNx = -1; hitNy = 0; hitNz = 0;
    if (maxX - ax < best) { best = maxX - ax; hitNx = 1; hitNy = 0; hitNz = 0; }
    if (ay - minY < best) { best = ay - minY; hitNx = 0; hitNy = -1; hitNz = 0; }
    if (maxY - ay < best) { best = maxY - ay; hitNx = 0; hitNy = 1; hitNz = 0; }
    if (az - minZ < best) { best = az - minZ; hitNx = 0; hitNy = 0; hitNz = -1; }
    if (maxZ - az < best) { hitNx = 0; hitNy = 0; hitNz = 1; }
    tMin = 0;
  }

  out.hit = true; out.t = tMin;
  out.px = ax + dx * tMin; out.py = ay + dy * tMin; out.pz = az + dz * tMin;
  out.nx = hitNx; out.ny = hitNy; out.nz = hitNz;
  return out;
}

export function raycastSegmentVsCollider3D(ax, ay, az, bx, by, bz, col, radiusPad = 0, out = {}) {
  if (!col || col.disabled) return resetRayHit3D(out);
  const pad = Math.max(0, Number(radiusPad) || 0);
  const minY = (col.minY ?? 0) - pad;
  const maxY = col.maxY + pad;
  const type = col.shapeType || 'box';

  if (type === 'obb') {
    const c = col.cosYaw ?? Math.cos(col.yaw || 0);
    const s = col.sinYaw ?? Math.sin(col.yaw || 0);
    const adx = ax - col.cx, adz = az - col.cz;
    const bdx = bx - col.cx, bdz = bz - col.cz;
    const hx = col.halfX + pad, hz = col.halfZ + pad;
    raycastLocalAabb3D(
      adx * c - adz * s, ay, adx * s + adz * c,
      bdx * c - bdz * s, by, bdx * s + bdz * c,
      -hx, hx, minY, maxY, -hz, hz, out
    );
    if (!out.hit) return out;
    out.px = ax + (bx - ax) * out.t;
    out.py = ay + (by - ay) * out.t;
    out.pz = az + (bz - az) * out.t;
    const lnx = out.nx, lnz = out.nz;
    out.nx = lnx * c + lnz * s;
    out.nz = -lnx * s + lnz * c;
    return out;
  }

  if (type === 'cylinder') {
    const dy = by - ay;
    let tyMin = 0, tyMax = 1, nyEnter = 0, yStartedInside = true;
    if (Math.abs(dy) < 1e-9) {
      if (ay < minY || ay > maxY) return resetRayHit3D(out);
    } else {
      const invDy = 1 / dy;
      let t1 = (minY - ay) * invDy, t2 = (maxY - ay) * invDy, n1 = -1;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; n1 = 1; }
      yStartedInside = t1 <= 0;
      tyMin = Math.max(0, t1); tyMax = Math.min(1, t2); nyEnter = n1;
      if (tyMin > tyMax) return resetRayHit3D(out);
    }

    const ox = ax - col.cx, oz = az - col.cz;
    const dx = bx - ax, dz = bz - az;
    const R = col.radius + pad;
    const a = dx * dx + dz * dz;
    const bHalf = ox * dx + oz * dz;
    const cVal = ox * ox + oz * oz - R * R;

    if (a < 1e-12) {
      if (cVal > 0) return resetRayHit3D(out);
      out.hit = true;
      out.t = yStartedInside ? 0 : tyMin;
      out.px = ax; out.py = ay + dy * out.t; out.pz = az;
      const r0 = Math.hypot(ox, oz);
      out.nx = yStartedInside ? (r0 > 1e-8 ? ox / r0 : 1) : 0;
      out.ny = yStartedInside ? 0 : nyEnter;
      out.nz = yStartedInside ? (r0 > 1e-8 ? oz / r0 : 0) : 0;
      return out;
    }

    const disc = bHalf * bHalf - a * cVal;
    if (disc < 0) return resetRayHit3D(out);
    const sqrtDisc = Math.sqrt(disc);
    const tc1 = (-bHalf - sqrtDisc) / a;
    const tc2 = (-bHalf + sqrtDisc) / a;
    const tEnter = Math.max(tyMin, tc1);
    if (tEnter > Math.min(tyMax, tc2)) return resetRayHit3D(out);

    out.hit = true;
    if (tc1 <= 0 && yStartedInside) {
      out.t = 0; out.px = ax; out.py = ay; out.pz = az;
      const r0 = Math.hypot(ox, oz);
      const radialPen = R - r0, botPen = ay - minY, topPen = maxY - ay;
      if (botPen <= radialPen && botPen <= topPen) { out.nx = 0; out.ny = -1; out.nz = 0; }
      else if (topPen <= radialPen) { out.nx = 0; out.ny = 1; out.nz = 0; }
      else { out.nx = r0 > 1e-8 ? ox / r0 : 1; out.ny = 0; out.nz = r0 > 1e-8 ? oz / r0 : 0; }
      return out;
    }

    out.t = tEnter;
    out.px = ax + dx * tEnter; out.py = ay + dy * tEnter; out.pz = az + dz * tEnter;
    if (tc1 >= tyMin) {
      const hx = out.px - col.cx, hz = out.pz - col.cz;
      const hLen = Math.hypot(hx, hz);
      out.nx = hLen > 1e-8 ? hx / hLen : 1; out.ny = 0; out.nz = hLen > 1e-8 ? hz / hLen : 0;
    } else {
      out.nx = 0; out.ny = nyEnter; out.nz = 0;
    }
    return out;
  }

  return raycastLocalAabb3D(
    ax, ay, az, bx, by, bz,
    col.minX - pad, col.maxX + pad, minY, maxY, col.minZ - pad, col.maxZ + pad, out
  );
}

const _overlapScratch = { hit: false, pushX: 0, pushZ: 0, nx: 0, nz: 0, depth: 0 };

/**
 * Teste booleano rápido círculo×colisor no plano XZ usando a FORMA REAL do colisor.
 * Pré-filtro pelo AABB; caixas alinhadas mantêm o teste AABB+raio histórico, enquanto
 * OBBs (prédios/casas rotacionados) e cilindros usam o teste exato — sem "paredes
 * invisíveis" nos cantos do AABB de formas giradas.
 */
export function circleOverlapsColliderXZ(x, z, radius, col) {
  if (!col) return false;
  const r = radius > 0 ? radius : 0;
  if (x + r <= col.minX || x - r >= col.maxX || z + r <= col.minZ || z - r >= col.maxZ) {
    // Pontos exatamente na borda (r = 0) contam como dentro, igual ao teste inclusivo antigo.
    if (!(r === 0 && x >= col.minX && x <= col.maxX && z >= col.minZ && z <= col.maxZ)) return false;
  }
  const type = col.shapeType || 'box';
  if (type === 'box') return true;
  return testCircleVsCollider2D(x, z, r, col, _overlapScratch).hit;
}
