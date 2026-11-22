/**
 * AgentSeparation.js
 * Sistema de separação espacial rápida (células 4.0m, pool de buckets reutilizável, zero-GC)
 * para agentes terrestres/veículos dentro de 155m do jogador + distribuição de slots de chegada.
 */

const GOLDEN_ANGLE = 2.399963229728653;

function packSepCell(cx, cz) {
  return ((cx & 0xffff) << 16) | (cz & 0xffff);
}

function readAgentX(a) {
  return a.x !== undefined ? a.x : (a.position ? a.position.x : 0);
}

function readAgentY(a) {
  return a.y !== undefined ? a.y : (a.position ? a.position.y : 0);
}

function readAgentZ(a) {
  return a.z !== undefined ? a.z : (a.position ? a.position.z : 0);
}

function writeAgentXZ(a, nx, nz) {
  if (a.x !== undefined) a.x = nx;
  if (a.z !== undefined) a.z = nz;
  if (a.position) {
    a.position.x = nx;
    a.position.z = nz;
  }
}

export function computeDistinctArrivalSlot(
  targetX,
  targetZ,
  slotIndex,
  totalUnits,
  baseRadius = 6.5,
  ringStep = 4.5,
  out = null
) {
  const res = out || { x: 0, z: 0, radius: 0, angle: 0, ring: 0 };
  let remIdx = Math.max(0, Math.floor(Number(slotIndex) || 0));
  let remTotal = Math.max(remIdx + 1, Math.floor(Number(totalUnits) || 1));
  let ring = 0;
  let ringCap = 6;

  while (remIdx >= ringCap) {
    remIdx -= ringCap;
    remTotal -= ringCap;
    ring++;
    ringCap = 6 + ring * 4;
  }

  const unitsInRing = Math.min(ringCap, Math.max(1, remTotal));
  const radius = baseRadius + ring * ringStep;
  const angle = (remIdx / unitsInRing) * Math.PI * 2 + ring * GOLDEN_ANGLE;

  res.x = targetX + Math.cos(angle) * radius;
  res.z = targetZ + Math.sin(angle) * radius;
  res.radius = radius;
  res.angle = angle;
  res.ring = ring;
  return res;
}

export class AgentSeparationSystem {
  constructor(opts = {}) {
    this.cellSize = opts.cellSize || 4.0;
    this.maxActiveDist = opts.maxActiveDist || 155.0;
    this.sameFloorMaxDeltaY = opts.sameFloorMaxDeltaY || 2.6;
    this.passes = opts.passes || 2;
    this._grid = new Map();
    this._bucketPool = [];
    this._activeBuckets = [];
    this._activeAgents = [];
    this._startX = [];
    this._startZ = [];
    this._avoidAccX = [];
    this._avoidAccZ = [];
  }

  _acquireBucket() {
    return this._bucketPool.length > 0 ? this._bucketPool.pop() : [];
  }

  _clearGrid() {
    for (let i = 0; i < this._activeBuckets.length; i++) {
      const b = this._activeBuckets[i];
      b.length = 0;
      this._bucketPool.push(b);
    }
    this._activeBuckets.length = 0;
    this._grid.clear();
  }

  separateAgents(agents, playerPos = null, opts = {}) {
    if (!Array.isArray(agents) || agents.length === 0) return 0;

    const maxDist = opts.maxActiveDist ?? this.maxActiveDist;
    const maxDistSq = maxDist * maxDist;
    const maxDeltaY = opts.sameFloorMaxDeltaY ?? this.sameFloorMaxDeltaY;
    const basePasses = opts.passes ?? this.passes;
    const cs = opts.cellSize ?? this.cellSize;
    const px = playerPos ? (playerPos.x ?? 0) : 0;
    const pz = playerPos ? (playerPos.z ?? 0) : 0;
    const hasPlayerFilter = Boolean(playerPos) && Number.isFinite(maxDist);

    const active = this._activeAgents;
    active.length = 0;

    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (!a || a.disabled) continue;
      a.sepPushX = 0;
      a.sepPushZ = 0;
      a.avoidX = 0;
      a.avoidZ = 0;
      const ax = readAgentX(a);
      const az = readAgentZ(a);
      if (hasPlayerFilter) {
        const dxp = ax - px;
        const dzp = az - pz;
        if (dxp * dxp + dzp * dzp > maxDistSq) continue;
      }
      const idx = active.length;
      active.push(a);
      this._startX[idx] = ax;
      this._startZ[idx] = az;
      this._avoidAccX[idx] = 0;
      this._avoidAccZ[idx] = 0;
    }

    const count = active.length;
    if (count < 2) return count;

    let totalPasses = basePasses;
    let detectedExactStack = false;

    for (let pass = 0; pass < totalPasses; pass++) {
      this._clearGrid();

      for (let idx = 0; idx < count; idx++) {
        const a = active[idx];
        const ax = readAgentX(a);
        const az = readAgentZ(a);
        const r = Math.max(0.2, Number(a.radius) || 0.5);
        const minCX = Math.floor((ax - r) / cs);
        const maxCX = Math.floor((ax + r) / cs);
        const minCZ = Math.floor((az - r) / cs);
        const maxCZ = Math.floor((az + r) / cs);

        for (let cx = minCX; cx <= maxCX; cx++) {
          for (let cz = minCZ; cz <= maxCZ; cz++) {
            const key = packSepCell(cx, cz);
            let bucket = this._grid.get(key);
            if (!bucket) {
              bucket = this._acquireBucket();
              this._grid.set(key, bucket);
              this._activeBuckets.push(bucket);
            }
            bucket.push(idx);
          }
        }
      }

      let maxOverlapInPass = 0;

      for (const [cellKey, bucket] of this._grid.entries()) {
        const bLen = bucket.length;
        if (bLen < 2) continue;

        for (let i = 0; i < bLen - 1; i++) {
          const ia = bucket[i];
          const a = active[ia];
          const ra = Math.max(0.2, Number(a.radius) || 0.5);
          const ay = readAgentY(a);

          for (let j = i + 1; j < bLen; j++) {
            const ib = bucket[j];
            const b = active[ib];
            const by = readAgentY(b);
            if (Math.abs(ay - by) >= maxDeltaY) continue;

            const rb = Math.max(0.2, Number(b.radius) || 0.5);
            const minDist = ra + rb;
            const ax = readAgentX(a);
            const az = readAgentZ(a);
            const bx = readAgentX(b);
            const bz = readAgentZ(b);
            const dx = bx - ax;
            const dz = bz - az;
            const distSq = dx * dx + dz * dz;
            if (distSq >= minDist * minDist) continue;

            const tContact = ra / minDist;
            const contactCX = Math.floor((ax + dx * tContact) / cs);
            const contactCZ = Math.floor((az + dz * tContact) / cs);
            if (packSepCell(contactCX, contactCZ) !== cellKey) continue;

            const wa = Math.max(1e-4, Number(a.weight) || 1.0);
            const wb = Math.max(1e-4, Number(b.weight) || 1.0);
            const invWa = a.immovable ? 0 : 1 / wa;
            const invWb = b.immovable ? 0 : 1 / wb;
            const invSum = invWa + invWb;
            if (invSum <= 0) continue;

            let nx;
            let nz;
            let overlap;
            if (distSq > 1e-8) {
              const dist = Math.sqrt(distSq);
              nx = dx / dist;
              nz = dz / dist;
              overlap = minDist - dist;
            } else {
              detectedExactStack = true;
              const angle = (ia * 7 + ib * 13 + pass * 3) * GOLDEN_ANGLE;
              nx = Math.cos(angle);
              nz = Math.sin(angle);
              overlap = minDist;
            }

            if (overlap > maxOverlapInPass) maxOverlapInPass = overlap;
            const shareA = invWa / invSum;
            const shareB = invWb / invSum;
            writeAgentXZ(a, ax - nx * overlap * shareA, az - nz * overlap * shareA);
            writeAgentXZ(b, bx + nx * overlap * shareB, bz + nz * overlap * shareB);
            this._avoidAccX[ia] -= nx * shareA;
            this._avoidAccZ[ia] -= nz * shareA;
            this._avoidAccX[ib] += nx * shareB;
            this._avoidAccZ[ib] += nz * shareB;
          }
        }
      }

      if (pass === 0 && detectedExactStack && opts.passes === undefined) {
        totalPasses = Math.max(basePasses, 6);
      }
      if (maxOverlapInPass < 1e-4) break;
    }

    for (let idx = 0; idx < count; idx++) {
      const a = active[idx];
      const pushX = readAgentX(a) - this._startX[idx];
      const pushZ = readAgentZ(a) - this._startZ[idx];
      a.sepPushX = pushX;
      a.sepPushZ = pushZ;
      const avX = this._avoidAccX[idx];
      const avZ = this._avoidAccZ[idx];
      const avLen = Math.hypot(avX, avZ);
      a.avoidX = avLen > 1e-6 ? avX / avLen : 0;
      a.avoidZ = avLen > 1e-6 ? avZ / avLen : 0;
    }

    this._clearGrid();
    return count;
  }

  computeDistinctArrivalSlot(targetX, targetZ, slotIndex, totalUnits, baseRadius = 6.5, ringStep = 4.5, out = null) {
    return computeDistinctArrivalSlot(targetX, targetZ, slotIndex, totalUnits, baseRadius, ringStep, out);
  }
}
