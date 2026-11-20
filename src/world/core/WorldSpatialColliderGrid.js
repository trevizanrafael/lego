/**
 * WorldSpatialColliderGrid.js
 * Grade espacial 2D O(1) de colisores AABB em células de 32m x 32m + lista dinâmica rápida
 * para veículos, portões e plataformas móveis (`TestBlockWorld.prototype`).
 */

export function packColliderCell(cx, cz) {
  return ((cx & 0xffff) << 16) | (cz & 0xffff);
}

export const worldSpatialColliderMethods = {
  addCollider(x, z, width, depth, height = 10, minY = 0, opts = {}) {
    const isDynamic = Boolean(opts.isDynamic);
    const col = {
      minX: x - width * 0.5,
      maxX: x + width * 0.5,
      minZ: z - depth * 0.5,
      maxZ: z + depth * 0.5,
      minY,
      maxY: height,
      disabled: false,
      isDynamic,
      _qid: 0,
      _gridKeys: null
    };
    this.colliders.push(col);

    if (isDynamic) {
      this._dynamicColliders.push(col);
    } else {
      const cs = this.colliderCellSize;
      const minCX = Math.floor(col.minX / cs);
      const maxCX = Math.floor(col.maxX / cs);
      const minCZ = Math.floor(col.minZ / cs);
      const maxCZ = Math.floor(col.maxZ / cs);
      const keys = [];
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const k = packColliderCell(cx, cz);
          keys.push(k);
          let bucket = this._colliderGrid.get(k);
          if (!bucket) {
            bucket = [];
            this._colliderGrid.set(k, bucket);
          }
          bucket.push(col);
        }
      }
      col._gridKeys = keys;
    }

    return col;
  },

  /**
   * Move um colisor de veículo/portão para a lista dinâmica rápida para que atualizações de minX..maxZ funcionem em tempo real!
   */
  promoteDynamicCollider(col) {
    if (!col || col.isDynamic) return;
    if (Array.isArray(col._gridKeys)) {
      for (let i = 0; i < col._gridKeys.length; i++) {
        const bucket = this._colliderGrid.get(col._gridKeys[i]);
        if (bucket) {
          const idx = bucket.indexOf(col);
          if (idx !== -1) bucket.splice(idx, 1);
        }
      }
      col._gridKeys = null;
    }
    col.isDynamic = true;
    this._dynamicColliders.push(col);
  },

  /**
   * Consulta espacial O(1) em células 32m x 32m (~25 colisores em vez de ~9.000 por frame!)
   */
  getCollidersNear(x, z, radius = 2.5, out = null) {
    if (out) {
      out.length = 0;
    } else {
      out = [];
    }
    const qid = ++this._colliderQueryId;
    const cs = this.colliderCellSize;
    const minCX = Math.floor((x - radius) / cs);
    const maxCX = Math.floor((x + radius) / cs);
    const minCZ = Math.floor((z - radius) / cs);
    const maxCZ = Math.floor((z + radius) / cs);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const bucket = this._colliderGrid.get(packColliderCell(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const col = bucket[i];
          if (col.disabled || col._qid === qid) continue;
          col._qid = qid;
          out.push(col);
        }
      }
    }

    for (let i = 0; i < this._dynamicColliders.length; i++) {
      const col = this._dynamicColliders[i];
      if (col.disabled || col._qid === qid) continue;
      if (
        x + radius >= col.minX &&
        x - radius <= col.maxX &&
        z + radius >= col.minZ &&
        z - radius <= col.maxZ
      ) {
        col._qid = qid;
        out.push(col);
      }
    }

    return out;
  },

  /**
   * Consulta espacial ao longo de um segmento 2D (câmera em 3ª pessoa, gancho e mira)
   */
  getCollidersAlongRay2D(x0, z0, x1, z1, pad = 1.5, out = null) {
    const minX = Math.min(x0, x1) - pad;
    const maxX = Math.max(x0, x1) + pad;
    const minZ = Math.min(z0, z1) - pad;
    const maxZ = Math.max(z0, z1) + pad;
    if (out) {
      out.length = 0;
    } else {
      out = [];
    }
    const qid = ++this._colliderQueryId;
    const cs = this.colliderCellSize;
    const minCX = Math.floor(minX / cs);
    const maxCX = Math.floor(maxX / cs);
    const minCZ = Math.floor(minZ / cs);
    const maxCZ = Math.floor(maxZ / cs);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const bucket = this._colliderGrid.get(packColliderCell(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const col = bucket[i];
          if (col.disabled || col._qid === qid) continue;
          col._qid = qid;
          out.push(col);
        }
      }
    }

    for (let i = 0; i < this._dynamicColliders.length; i++) {
      const col = this._dynamicColliders[i];
      if (col.disabled || col._qid === qid) continue;
      if (col.maxX >= minX && col.minX <= maxX && col.maxZ >= minZ && col.minZ <= maxZ) {
        col._qid = qid;
        out.push(col);
      }
    }
    return out;
  }
};
