import * as THREE from 'three';

// ============================================================================
// ZONA DE CAPTURA (estilo "Gardens & Graveyards")
// ----------------------------------------------------------------------------
// - Só enche com atacantes dentro do raio E nenhum defensor (senão: CONTESTADO)
// - Sem ninguém dentro, o progresso volta devagar
// - Aliados extras aceleram a captura (até +40%)
// - No chão: anel de 40 placas LEGO que acendem conforme o progresso
// ============================================================================

export const CAPTURE_STATE = {
  LOCKED: 'LOCKED',
  ACTIVE: 'ACTIVE',
  CAPTURING: 'CAPTURING',
  CONTESTED: 'CONTESTED',
  CAPTURED: 'CAPTURED'
};

const TILE_COUNT = 40;
const TILE_GEO = new THREE.BoxGeometry(1.75, 0.18, 0.9);
const STUD_RING_GEO = new THREE.RingGeometry(0.92, 1.0, 48);
STUD_RING_GEO.rotateX(-Math.PI / 2);

const COLOR_LOCKED = new THREE.Color(0x475569);
const COLOR_EMPTY = new THREE.Color(0x4a3f0c);
const COLOR_ATTACK = new THREE.Color(0xfacc15);
const COLOR_CONTEST = new THREE.Color(0xef4444);

export class CaptureZone {
  constructor({ id, x, y = 0, z, radius = 14, captureTime = 10, scene = null, label = '', groundAt = null }) {
    this.groundAt = groundAt;
    this.id = id;
    this.x = x;
    this.y = y;
    this.z = z;
    this.radius = radius;
    this.captureTime = captureTime;
    this.label = label;
    this.progress = 0;
    this.state = CAPTURE_STATE.LOCKED;
    this.scene = scene;
    this._pulse = 0;
    this.group = null;
    if (scene) this._buildVisual();
  }

  _buildVisual() {
    this.group = new THREE.Group();
    this.group.position.set(this.x, this.y + 0.06, this.z);
    this.group.userData.skipStaticMerge = true;

    const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 });
    this.tiles = new THREE.InstancedMesh(TILE_GEO, tileMat, TILE_COUNT);
    this.tiles.userData.skipStaticMerge = true;
    const m = new THREE.Matrix4();
    for (let i = 0; i < TILE_COUNT; i++) {
      const a = (i / TILE_COUNT) * Math.PI * 2;
      m.makeRotationY(a);
      const tx = Math.sin(a) * this.radius;
      const tz = Math.cos(a) * this.radius;
      const ty = this.groundAt ? this.groundAt(this.x + tx, this.z + tz, this.y) - this.y : 0;
      m.setPosition(tx, Number.isFinite(ty) && Math.abs(ty) < 6 ? ty : 0, tz);
      this.tiles.setMatrixAt(i, m);
      this.tiles.setColorAt(i, COLOR_LOCKED);
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    this.group.add(this.tiles);

    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.ring = new THREE.Mesh(STUD_RING_GEO, this.ringMat);
    this.ring.scale.setScalar(this.radius);
    this.ring.position.y = 0.04;
    this.group.add(this.ring);

    this.scene.add(this.group);
    this._refreshTiles();
  }

  setActive(active) {
    if (this.state === CAPTURE_STATE.CAPTURED) return;
    this.state = active ? CAPTURE_STATE.ACTIVE : CAPTURE_STATE.LOCKED;
    if (!active) this.progress = 0;
    this._refreshTiles();
  }

  markCaptured() {
    this.state = CAPTURE_STATE.CAPTURED;
    this.progress = 1;
    this._refreshTiles();
  }

  reset() {
    this.state = CAPTURE_STATE.LOCKED;
    this.progress = 0;
    this._refreshTiles();
  }

  isInside(px, pz) {
    return Math.hypot(px - this.x, pz - this.z) <= this.radius;
  }

  /**
   * @param {number} dt
   * @param {{attackers:number, defenders:number}} counts quantos de cada lado estão DENTRO do raio
   * @returns {boolean} true no frame em que a captura termina
   */
  update(dt, { attackers = 0, defenders = 0 } = {}) {
    this._pulse += dt;
    if (this.state === CAPTURE_STATE.LOCKED || this.state === CAPTURE_STATE.CAPTURED) {
      if (this.ringMat) this.ringMat.opacity = 0;
      return false;
    }

    if (attackers > 0 && defenders > 0) {
      this.state = CAPTURE_STATE.CONTESTED;
    } else if (attackers > 0) {
      this.state = CAPTURE_STATE.CAPTURING;
      const bonus = 1 + Math.min(4, Math.max(0, attackers - 1)) * 0.1;
      this.progress = Math.min(1, this.progress + (dt / this.captureTime) * bonus);
    } else {
      this.state = CAPTURE_STATE.ACTIVE;
      this.progress = Math.max(0, this.progress - (dt / this.captureTime) * 0.35);
    }

    this._refreshTiles();

    if (this.progress >= 1) {
      this.markCaptured();
      return true;
    }
    return false;
  }

  _refreshTiles() {
    if (!this.tiles) return;
    const lit = Math.round(this.progress * TILE_COUNT);
    const contested = this.state === CAPTURE_STATE.CONTESTED;
    const blink = Math.sin(this._pulse * 10) > 0;
    for (let i = 0; i < TILE_COUNT; i++) {
      let c = COLOR_EMPTY;
      if (this.state === CAPTURE_STATE.LOCKED) c = COLOR_LOCKED;
      else if (this.state === CAPTURE_STATE.CAPTURED) c = COLOR_ATTACK;
      else if (i < lit) c = contested && blink ? COLOR_CONTEST : COLOR_ATTACK;
      else if (contested) c = blink ? COLOR_CONTEST : COLOR_EMPTY;
      this.tiles.setColorAt(i, c);
    }
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;

    if (this.ringMat) {
      const visible = this.state !== CAPTURE_STATE.LOCKED && this.state !== CAPTURE_STATE.CAPTURED;
      this.ringMat.color.setHex(contested ? 0xef4444 : 0xfacc15);
      this.ringMat.opacity = visible ? 0.35 + 0.25 * Math.abs(Math.sin(this._pulse * 3)) : 0;
    }
  }

  dispose() {
    if (this.group?.parent) this.group.parent.remove(this.group);
    this.tiles?.material?.dispose?.();
    this.ringMat?.dispose?.();
    this.group = null;
    this.tiles = null;
  }
}
