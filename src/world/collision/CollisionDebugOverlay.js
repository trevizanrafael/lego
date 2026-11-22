import * as THREE from 'three';

/**
 * CollisionDebugOverlay.js
 * Wireframe 3D interativo de depuração de colisores (AABB, OBB, Cilindro 16-seg, Dinâmicos)
 * + cápsulas de NPCs ativos e cones de visão policial em 4 Draw Calls (`LineSegments`).
 * Ativável apenas com `?debug=1` na URL ou `globalThis.__ENABLE_COLLISION_DEBUG = true`.
 */

const COLOR_STATIC_BOX = 0x22c55e;
const COLOR_DYNAMIC = 0xeab308;
const COLOR_SHAPED = 0xa855f7;
const RGB_CYAN = [0x38 / 255, 0xbd / 255, 0xf8 / 255];
const RGB_RED = [0xef / 255, 0x44 / 255, 0x44 / 255];
const CYL_SEGS = 16;
const CAP_SEGS = 8;
const CONE_SEGS = 8;

const COS16 = new Float32Array(CYL_SEGS + 1);
const SIN16 = new Float32Array(CYL_SEGS + 1);
for (let i = 0; i <= CYL_SEGS; i++) {
  const a = (i / CYL_SEGS) * Math.PI * 2;
  COS16[i] = Math.cos(a);
  SIN16[i] = Math.sin(a);
}

export function isCollisionDebugAllowed() {
  if (Boolean(globalThis.__ENABLE_COLLISION_DEBUG)) return true;
  const search = globalThis.window?.location?.search;
  if (typeof search === 'string' && search.length > 0) {
    try {
      return new URLSearchParams(search).get('debug') === '1';
    } catch {
      return /(?:^|[?&])debug=1(?:&|$)/.test(search);
    }
  }
  return false;
}

class DynamicSegmentBuffer {
  constructor(name, matOpts, initialSegments = 2048, useVertexColors = false) {
    this.useVertexColors = useVertexColors;
    this.maxVertices = initialSegments * 2;
    this.vertexCount = 0;
    this.geometry = new THREE.BufferGeometry();
    this._allocAttributes(this.maxVertices);
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.85,
      depthTest: true,
      depthWrite: false,
      vertexColors: useVertexColors,
      ...matOpts
    });
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.name = name;
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 999;
  }

  _allocAttributes(maxVerts) {
    const nextPos = new Float32Array(maxVerts * 3);
    if (this.positions && this.vertexCount > 0) nextPos.set(this.positions.subarray(0, this.vertexCount * 3));
    this.positions = nextPos;
    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', posAttr);

    if (this.useVertexColors) {
      const nextCol = new Float32Array(maxVerts * 3);
      if (this.colors && this.vertexCount > 0) nextCol.set(this.colors.subarray(0, this.vertexCount * 3));
      this.colors = nextCol;
      const colAttr = new THREE.BufferAttribute(this.colors, 3);
      colAttr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute('color', colAttr);
    }
    this.maxVertices = maxVerts;
  }

  reset() { this.vertexCount = 0; }

  pushSegment(x0, y0, z0, x1, y1, z1, rgb = null) {
    if (this.vertexCount + 2 > this.maxVertices) {
      let nextMax = this.maxVertices;
      while (nextMax < this.vertexCount + 256) nextMax *= 2;
      this._allocAttributes(nextMax);
    }
    const b = this.vertexCount * 3;
    const p = this.positions;
    p[b] = x0; p[b + 1] = y0; p[b + 2] = z0;
    p[b + 3] = x1; p[b + 4] = y1; p[b + 5] = z1;
    if (this.useVertexColors && this.colors) {
      const c = rgb || RGB_CYAN, col = this.colors;
      col[b] = c[0]; col[b + 1] = c[1]; col[b + 2] = c[2];
      col[b + 3] = c[0]; col[b + 4] = c[1]; col[b + 5] = c[2];
    }
    this.vertexCount += 2;
  }

  commit() {
    this.geometry.setDrawRange(0, this.vertexCount);
    this.geometry.getAttribute('position').needsUpdate = true;
    if (this.useVertexColors) this.geometry.getAttribute('color').needsUpdate = true;
  }

  clear() {
    this.vertexCount = 0;
    this.geometry.setDrawRange(0, 0);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

function pushQuadBox3D(buf, x0, z0, x1, z1, x2, z2, x3, z3, minY, maxY) {
  for (const y of [minY, maxY]) {
    buf.pushSegment(x0, y, z0, x1, y, z1);
    buf.pushSegment(x1, y, z1, x2, y, z2);
    buf.pushSegment(x2, y, z2, x3, y, z3);
    buf.pushSegment(x3, y, z3, x0, y, z0);
  }
  buf.pushSegment(x0, minY, z0, x0, maxY, z0);
  buf.pushSegment(x1, minY, z1, x1, maxY, z1);
  buf.pushSegment(x2, minY, z2, x2, maxY, z2);
  buf.pushSegment(x3, minY, z3, x3, maxY, z3);
}

function pushAabbBox(buf, col) {
  pushQuadBox3D(buf, col.minX, col.minZ, col.maxX, col.minZ, col.maxX, col.maxZ, col.minX, col.maxZ, col.minY ?? 0, col.maxY ?? 2);
}

function pushRotatedObb(buf, col) {
  const cx = col.cx ?? (col.minX + col.maxX) * 0.5, cz = col.cz ?? (col.minZ + col.maxZ) * 0.5;
  const hx = col.halfX ?? (col.maxX - col.minX) * 0.5, hz = col.halfZ ?? (col.maxZ - col.minZ) * 0.5;
  const cosY = Math.cos(col.yaw ?? 0), sinY = Math.sin(col.yaw ?? 0);
  const rx = hx * cosY, rz = -hx * sinY, fx = hz * sinY, fz = hz * cosY;
  pushQuadBox3D(buf, cx - rx - fx, cz - rz - fz, cx + rx - fx, cz + rz - fz, cx + rx + fx, cz + rz + fz, cx - rx + fx, cz - rz + fz, col.minY ?? 0, col.maxY ?? 2);
}

function pushCylinderPrism16(buf, col) {
  const cx = col.cx ?? col.x ?? (col.minX + col.maxX) * 0.5, cz = col.cz ?? col.z ?? (col.minZ + col.maxZ) * 0.5;
  const r = col.radius ?? Math.max(0.05, Math.min(col.maxX - col.minX, col.maxZ - col.minZ) * 0.5);
  const minY = col.minY ?? 0, maxY = col.maxY ?? 2;
  for (let i = 0; i < CYL_SEGS; i++) {
    const x0 = cx + r * COS16[i], z0 = cz + r * SIN16[i], x1 = cx + r * COS16[i + 1], z1 = cz + r * SIN16[i + 1];
    buf.pushSegment(x0, minY, z0, x1, minY, z1);
    buf.pushSegment(x0, maxY, z0, x1, maxY, z1);
    buf.pushSegment(x0, minY, z0, x0, maxY, z0);
  }
}

function pushNpcCapsule(buf, x, yBase, z, radius, height, rgb) {
  const r = Math.max(0.2, radius);
  const yBot = yBase + Math.min(r * 0.5, height * 0.2), yTop = yBase + Math.max(height - r * 0.5, height * 0.8), yApex = yBase + height;
  for (let i = 0; i < CAP_SEGS; i++) {
    const k0 = i * 2, k1 = (i + 1) * 2;
    const x0 = x + r * COS16[k0], z0 = z + r * SIN16[k0], x1 = x + r * COS16[k1], z1 = z + r * SIN16[k1];
    buf.pushSegment(x0, yBot, z0, x1, yBot, z1, rgb);
    buf.pushSegment(x0, yTop, z0, x1, yTop, z1, rgb);
    if ((i & 1) === 0) {
      buf.pushSegment(x0, yBot, z0, x0, yTop, z0, rgb);
      buf.pushSegment(x0, yTop, z0, x, yApex, z, rgb);
      buf.pushSegment(x0, yBot, z0, x, yBase, z, rgb);
    }
  }
}

function pushVisionCone(buf, cone, groundY) {
  const rgb = cone.seesPlayer ? RGB_RED : RGB_CYAN;
  const ox = cone.x, oz = cone.z, y = groundY + 0.65;
  if (cone.range > 0 && cone.fovRad > 0 && cone.fovRad < Math.PI * 1.98) {
    const half = cone.fovRad * 0.5, a0 = cone.heading - half, step = cone.fovRad / CONE_SEGS;
    let px = ox + Math.sin(a0) * cone.range, pz = oz + Math.cos(a0) * cone.range;
    buf.pushSegment(ox, y, oz, px, y, pz, rgb);
    buf.pushSegment(ox, y, oz, ox + Math.sin(cone.heading + half) * cone.range, y, oz + Math.cos(cone.heading + half) * cone.range, rgb);
    buf.pushSegment(ox, y, oz, ox + Math.sin(cone.heading) * cone.range, y, oz + Math.cos(cone.heading) * cone.range, rgb);
    for (let i = 1; i <= CONE_SEGS; i++) {
      const nx = ox + Math.sin(a0 + step * i) * cone.range, nz = oz + Math.cos(a0 + step * i) * cone.range;
      buf.pushSegment(px, y, pz, nx, y, nz, rgb);
      px = nx; pz = nz;
    }
  }
  if (cone.radius > 0) {
    for (let i = 0; i < CYL_SEGS; i++) {
      buf.pushSegment(ox + cone.radius * COS16[i], y, oz + cone.radius * SIN16[i], ox + cone.radius * COS16[i + 1], y, oz + cone.radius * SIN16[i + 1], rgb);
    }
  }
}

export class CollisionDebugOverlay {
  constructor(scene = null) {
    this.scene = scene;
    this.enabled = false;
    this.radius = 95;
    this.refreshInterval = 0.10;
    this._accumDt = this.refreshInterval;
    this._nearbyScratch = [];
    this._visitedNpcs = new Set();

    this._staticBuf = new DynamicSegmentBuffer('CollisionStaticBoxLines', { color: COLOR_STATIC_BOX, opacity: 0.78 }, 3072, false);
    this._dynamicBuf = new DynamicSegmentBuffer('CollisionDynamicLines', { color: COLOR_DYNAMIC, opacity: 0.90 }, 1024, false);
    this._shapedBuf = new DynamicSegmentBuffer('CollisionShapedLines', { color: COLOR_SHAPED, opacity: 0.88 }, 2048, false);
    this._agentRayBuf = new DynamicSegmentBuffer('CollisionAgentAndRayLines', { opacity: 0.92 }, 1024, true);

    this.staticLines = this._staticBuf.lines;
    this.dynamicLines = this._dynamicBuf.lines;
    this.shapedLines = this._shapedBuf.lines;
    this.agentAndRayLines = this._agentRayBuf.lines;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'CollisionDebugOverlay';
    this.rootGroup.renderOrder = 999;
    this.rootGroup.visible = false;
    this.rootGroup.frustumCulled = false;
    this.rootGroup.add(this.staticLines, this.dynamicLines, this.shapedLines, this.agentAndRayLines);
    if (this.scene && typeof this.scene.add === 'function') this.scene.add(this.rootGroup);
    this.lastStats = { staticCount: 0, dynamicCount: 0, shapedCount: 0, npcCount: 0, coneCount: 0 };
  }

  isAllowed() { return isCollisionDebugAllowed(); }

  toggle(forceState) {
    if (forceState === false || (!this.isAllowed() && forceState !== true)) {
      this.enabled = false;
      this.rootGroup.visible = false;
      if (forceState === false) this._clearAllBuffers();
      return false;
    }
    this.enabled = forceState !== undefined ? Boolean(forceState) : !this.enabled;
    this.rootGroup.visible = this.enabled;
    if (this.enabled) {
      this._accumDt = this.refreshInterval;
      this.rootGroup.updateMatrixWorld(true);
    } else {
      this._clearAllBuffers();
    }
    return this.enabled;
  }

  _clearAllBuffers() {
    this._staticBuf.clear();
    this._dynamicBuf.clear();
    this._shapedBuf.clear();
    this._agentRayBuf.clear();
  }

  update(dt, world, playerPos = null, controller = null) {
    if (!this.enabled || !world) return false;
    const pos = playerPos || controller?.position;
    if (!pos) return false;
    this._accumDt += Math.max(0, Number(dt) || 0);
    if (this._accumDt < this.refreshInterval) return false;
    this._accumDt = 0;

    const px = pos.x ?? 0, py = pos.y ?? 0, pz = pos.z ?? 0, r = this.radius, rSq = r * r;
    this._staticBuf.reset(); this._dynamicBuf.reset(); this._shapedBuf.reset(); this._agentRayBuf.reset();

    const candidates = typeof world.getCollidersNear === 'function'
      ? world.getCollidersNear(px, pz, r, this._nearbyScratch)
      : world.colliders || [];

    let staticCount = 0, dynamicCount = 0, shapedCount = 0;
    for (let i = 0; i < candidates.length; i++) {
      const col = candidates[i];
      if (!col || col.disabled) continue;
      const yLo = Math.min(col.minY ?? 0, col.maxY ?? 0), yHi = Math.max(col.minY ?? 0, col.maxY ?? 0);
      const dx = Math.max((col.minX ?? 0) - px, 0, px - (col.maxX ?? 0));
      const dy = Math.max(yLo - py, 0, py - yHi);
      const dz = Math.max((col.minZ ?? 0) - pz, 0, pz - (col.maxZ ?? 0));
      if (dx * dx + dy * dy + dz * dz > rSq) continue;

      const shape = col.shapeType || 'box';
      const targetBuf = col.isDynamic === true ? (dynamicCount++, this._dynamicBuf)
        : (shape === 'obb' || shape === 'cylinder') ? (shapedCount++, this._shapedBuf)
        : (staticCount++, this._staticBuf);
      if (shape === 'obb') pushRotatedObb(targetBuf, col);
      else if (shape === 'cylinder') pushCylinderPrism16(targetBuf, col);
      else pushAabbBox(targetBuf, col);
    }

    let npcCount = 0;
    for (const fu of world?.livingCity?.wantedSystem?.footUnits || []) {
      if (!fu || fu.obj?.destroyed || fu.destroyed) continue;
      const uPos = fu.mesh?.position || fu.position || fu.obj?.mesh?.position;
      if (!uPos || (uPos.x - px) ** 2 + (uPos.z - pz) ** 2 > rSq) continue;
      pushNpcCapsule(this._agentRayBuf, uPos.x, uPos.y ?? 0, uPos.z, fu.isExo ? 0.65 : 0.42, fu.isExo ? 2.5 : 1.85, fu._cachedSeesPlayer ? RGB_RED : RGB_CYAN);
      npcCount++;
    }

    this._visitedNpcs.clear();
    const pFac = world?.livingCity?.playerFaction;
    for (const list of [world?.livingCity?.factionWar?.combatNpcs, world?.livingCity?.combatNpcs]) {
      for (const npc of list || []) {
        if (!npc || this._visitedNpcs.has(npc) || npc.destroyed || npc.dead || npc.destructible?.destroyed) continue;
        this._visitedNpcs.add(npc);
        const uPos = npc.visual?.root?.position || npc.mesh?.position || npc.destructible?.mesh?.position || npc.position;
        if (!uPos || (uPos.x - px) ** 2 + (uPos.z - pz) ** 2 > rSq) continue;
        const allied = Boolean(npc.isAllied || (pFac && npc.faction === pFac)), big = Boolean(npc.isBoss || npc.isBigFig);
        pushNpcCapsule(this._agentRayBuf, uPos.x, uPos.y ?? 0, uPos.z, big ? 0.72 : 0.42, big ? 2.6 : 1.85, allied ? RGB_CYAN : RGB_RED);
        npcCount++;
      }
    }

    let coneCount = 0;
    for (const cone of world?.livingCity?.wantedSystem?.getPoliceVisionConesSnapshot?.() || []) {
      if (!cone || Math.hypot(cone.x - px, cone.z - pz) > r + Math.max(cone.range || 0, cone.radius || 0)) continue;
      const gy = typeof world.getTerrainHeightAt === 'function' ? world.getTerrainHeightAt(cone.x, cone.z) : py;
      pushVisionCone(this._agentRayBuf, cone, gy);
      coneCount++;
    }

    this._staticBuf.commit(); this._dynamicBuf.commit(); this._shapedBuf.commit(); this._agentRayBuf.commit();
    this.rootGroup.updateMatrixWorld(true);
    this.lastStats = { staticCount, dynamicCount, shapedCount, npcCount, coneCount };
    return true;
  }

  dispose() {
    this.enabled = false;
    this.rootGroup.visible = false;
    if (this.rootGroup.parent) this.rootGroup.parent.remove(this.rootGroup);
    this._staticBuf.dispose(); this._dynamicBuf.dispose(); this._shapedBuf.dispose(); this._agentRayBuf.dispose();
  }
}
