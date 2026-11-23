import * as THREE from 'three';

export const MAX_SHADOW_BUDGET = 320;
export const MIN_STATIC_SHADOW_RADIUS = 1.35;
export const SHADOW_RADIUS_BY_PRESET = { low: 0, medium: 185, auto: 185, ultra: 240 };

const _BOX3 = new THREE.Box3();
const _DUMMY_OBJ = new THREE.Object3D();
const _WORLD_POS = new THREE.Vector3();

function isTransparentOrBasicMaterial(material) {
  if (!material) return true;
  if (Array.isArray(material)) {
    if (material.length === 0) return true;
    for (let i = 0; i < material.length; i++) {
      const m = material[i];
      if (!m || m.transparent || m.isMeshBasicMaterial) return true;
    }
    return false;
  }
  return Boolean(material.transparent || material.isMeshBasicMaterial);
}

function createContactShadowTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas');
  if (!canvas) return null;
  canvas.width = 64;
  canvas.height = 64;
  const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  if (ctx && typeof ctx.createRadialGradient === 'function') {
    ctx.clearRect?.(0, 0, 64, 64);
    const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 1.0)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.62)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect?.(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Orçamento dinâmico de sombras (< 320 shadowCasters ativos), cadência adaptativa de shadowMap
 * e disco de sombra de contato instanciado no preset Baixo (Zero GC por frame).
 */
export class ShadowBudgetController {
  constructor(renderer, scene, world = null) {
    this.renderer = renderer || null;
    this.scene = scene || null;
    this.world = world || null;
    this.maxBudget = MAX_SHADOW_BUDGET;
    this.maxContactShadows = 25; // Jogador + até 24 veículos/NPCs próximos
    this.candidates = [];
    this.dynamicGroups = [];
    this._indexedDynamicItems = new WeakSet();
    this._centralViaductCandidate = null;
    this.activeCasterCount = 0;

    this.contactShadowMesh = null;
    this._contactShadowGeo = null;
    this._contactShadowMat = null;
    this._contactShadowTex = null;
    this._topContactTargets = Array.from({ length: 24 }, () => ({
      s: null, obj3d: null, tx: 0, ty: 0, tz: 0, dSq: 0
    }));

    this._frameCounter = 0;
    this._lastScanX = NaN;
    this._lastScanZ = NaN;
    this._lastPreset = null;
    this._activeEntriesScratch = [];

    if (this.scene) {
      this._initContactShadowPool();
      this.rebuildIndex({ x: 0, z: -276 });
    }
  }

  _initContactShadowPool() {
    if (this.contactShadowMesh || !this.scene) return;
    const geo = new THREE.CircleGeometry(1, 16);
    geo.rotateX(-Math.PI / 2);
    const tex = createContactShadowTexture();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      ...(tex ? { map: tex } : {}),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const inst = new THREE.InstancedMesh(geo, mat, this.maxContactShadows);
    inst.name = 'LowPresetContactShadows';
    inst.count = 0;
    inst.visible = false;
    inst.castShadow = false;
    inst.receiveShadow = false;
    inst.frustumCulled = false;
    this.scene.add(inst);
    this._contactShadowGeo = geo;
    this._contactShadowMat = mat;
    this._contactShadowTex = tex;
    this.contactShadowMesh = inst;
  }

  _collectPlayerRoots() {
    const roots = new Set();
    const ctlRoot = this.world?.destructibles?.hud?._lastController?.minifigure?.root;
    if (ctlRoot) roots.add(ctlRoot);
    if (this.scene?.children) {
      for (let i = 0; i < this.scene.children.length; i++) {
        const ch = this.scene.children[i];
        if (!ch?.isGroup || ch.matrixAutoUpdate === false) continue;
        if (ch === this.world?.beaconGroup || ch === this.world?.atmosphere?.celestialRoot || ch === this.world?.ferrisWheelGroup) continue;
        if (ch.children.length === 1 && ch.children[0]?.isGroup) roots.add(ch);
      }
    }
    return roots;
  }

  _registerDynamicRoot(root, itemRef = null, outMeshSet = null) {
    if (!root || this._indexedDynamicItems.has(itemRef || root)) return;
    this._indexedDynamicItems.add(itemRef || root);
    const meshes = [];
    root.traverse((node) => {
      if (!node || (!node.isMesh && !node.isInstancedMesh)) return;
      if (outMeshSet) outMeshSet.add(node);
      if (!node.castShadow) return;
      if (isTransparentOrBasicMaterial(node.material)) { node.castShadow = false; return; }
      meshes.push(node);
    });
    if (meshes.length > 0) this.dynamicGroups.push({ root, item: itemRef, meshes, _distSq: 0, _centerDistSq: 0 });
  }

  _syncDynamicObjects(outMeshSet = null) {
    const dynList = this.world?.destructibles?._dynamicObjects;
    if (Array.isArray(dynList)) {
      for (let i = 0; i < dynList.length; i++) {
        if (dynList[i]?.mesh) this._registerDynamicRoot(dynList[i].mesh, dynList[i], outMeshSet);
      }
    }
    for (const tr of this.world?.metroSystem?.trains || []) {
      for (const car of tr?.cars || []) {
        if (car?.group) this._registerDynamicRoot(car.group, car, outMeshSet);
      }
    }
    for (const ship of this.world?.cargoShips || []) {
      const sMesh = ship?.mesh || ship;
      if (sMesh?.isObject3D) this._registerDynamicRoot(sMesh, ship, outMeshSet);
    }
  }

  rebuildIndex(initialAnchor = { x: 0, z: -276 }) {
    this.candidates.length = 0;
    this.dynamicGroups.length = 0;
    this._indexedDynamicItems = new WeakSet();
    this._centralViaductCandidate = null;
    if (!this.scene) return 0;
    this.scene.updateMatrixWorld?.(true);

    const playerMeshes = new Set();
    for (const pr of this._collectPlayerRoots()) {
      pr.traverse((n) => {
        if (!n || (!n.isMesh && !n.isInstancedMesh)) return;
        if (n.castShadow && isTransparentOrBasicMaterial(n.material)) n.castShadow = false;
        playerMeshes.add(n);
      });
    }

    const lodFarMeshes = new Set();
    this.scene.traverse((obj) => {
      if (!obj?.isLOD || !Array.isArray(obj.levels)) return;
      for (let i = 1; i < obj.levels.length; i++) {
        obj.levels[i]?.object?.traverse((m) => { if (m?.isMesh || m?.isInstancedMesh) lodFarMeshes.add(m); });
      }
    });

    const dynamicMeshes = new Set();
    this._syncDynamicObjects(dynamicMeshes);

    const ax = Number(initialAnchor?.x) || 0;
    const az = Number(initialAnchor?.z) || -276;
    let bestViaductDistSq = Infinity;

    this.scene.traverse((obj) => {
      if (!obj || (!obj.isMesh && !obj.isInstancedMesh) || obj === this.contactShadowMesh || !obj.castShadow) return;
      if (isTransparentOrBasicMaterial(obj.material) || lodFarMeshes.has(obj)) { obj.castShadow = false; return; }
      if (playerMeshes.has(obj) || dynamicMeshes.has(obj)) return;

      let validBounds = false;
      if (obj.isInstancedMesh && obj.count > 0) {
        if (!obj.boundingBox) obj.computeBoundingBox?.();
        if (obj.boundingBox && !obj.boundingBox.isEmpty()) { _BOX3.copy(obj.boundingBox).applyMatrix4(obj.matrixWorld); validBounds = true; }
      } else if (obj.geometry) {
        if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox?.();
        if (obj.geometry.boundingBox && !obj.geometry.boundingBox.isEmpty()) { _BOX3.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld); validBounds = true; }
      }
      if (!validBounds) { obj.castShadow = false; return; }

      const approxRadius = 0.5 * Math.hypot(_BOX3.max.x - _BOX3.min.x, _BOX3.max.y - _BOX3.min.y, _BOX3.max.z - _BOX3.min.z);
      if (!Number.isFinite(approxRadius) || approxRadius < MIN_STATIC_SHADOW_RADIUS) { obj.castShadow = false; return; }

      const cx = (_BOX3.min.x + _BOX3.max.x) * 0.5;
      const cz = (_BOX3.min.z + _BOX3.max.z) * 0.5;
      const isViaductConcrete = !Array.isArray(obj.material) && obj.material?.color?.getHex?.() === 0xcbd5e1;
      const cand = {
        mesh: obj, cx, cz, approxRadius,
        minX: _BOX3.min.x, maxX: _BOX3.max.x, minZ: _BOX3.min.z, maxZ: _BOX3.max.z,
        isViaductConcrete, _distSq: 0, _centerDistSq: 0
      };
      this.candidates.push(cand);

      if (isViaductConcrete) {
        const dx = ax < cand.minX ? cand.minX - ax : ax > cand.maxX ? ax - cand.maxX : 0;
        const dz = az < cand.minZ ? cand.minZ - az : az > cand.maxZ ? az - cand.maxZ : 0;
        const dSq = dx * dx + dz * dz + ((cx - ax) ** 2 + (cz - az) ** 2) * 1e-4;
        if (dSq < bestViaductDistSq) { bestViaductDistSq = dSq; this._centralViaductCandidate = cand; }
      }
    });

    this._applyShadowBudget(ax, az, 210);
    this._lastScanX = ax;
    this._lastScanZ = az;
    return this.candidates.length;
  }

  _applyShadowBudget(ax, az, shadowRadius) {
    this._syncDynamicObjects(null);
    let usedBudget = 0;
    for (const pr of this._collectPlayerRoots()) {
      pr.traverse((n) => {
        if (!n || (!n.isMesh && !n.isInstancedMesh) || isTransparentOrBasicMaterial(n.material)) return;
        if (shadowRadius > 0 && usedBudget < this.maxBudget) { n.castShadow = true; usedBudget++; }
        else if (shadowRadius <= 0) n.castShadow = false;
      });
    }
    if (shadowRadius <= 0) {
      for (let i = 0; i < this.candidates.length; i++) this.candidates[i].mesh.castShadow = false;
      for (let i = 0; i < this.dynamicGroups.length; i++) {
        for (let j = 0; j < this.dynamicGroups[i].meshes.length; j++) this.dynamicGroups[i].meshes[j].castShadow = false;
      }
      this.activeCasterCount = 0;
      return 0;
    }

    const rSq = shadowRadius * shadowRadius;
    const dynRSq = Math.min(shadowRadius, 155) ** 2;
    const matched = this._activeEntriesScratch;
    matched.length = 0;

    if (this._centralViaductCandidate && usedBudget < this.maxBudget) {
      this._centralViaductCandidate.mesh.castShadow = true;
      usedBudget++;
    }
    for (let i = 0; i < this.candidates.length; i++) {
      const c = this.candidates[i];
      if (c === this._centralViaductCandidate) continue;
      const dx = ax < c.minX ? c.minX - ax : ax > c.maxX ? ax - c.maxX : 0;
      const dz = az < c.minZ ? c.minZ - az : az > c.maxZ ? az - c.maxZ : 0;
      const distSq = dx * dx + dz * dz;
      if (distSq <= rSq) {
        c._distSq = distSq;
        c._centerDistSq = (c.cx - ax) ** 2 + (c.cz - az) ** 2;
        matched.push(c);
      } else c.mesh.castShadow = false;
    }
    for (let i = 0; i < this.dynamicGroups.length; i++) {
      const dg = this.dynamicGroups[i];
      const active = !dg.item?.destroyed && dg.root?.visible !== false && Boolean(dg.root?.parent);
      const distSq = ((dg.root?.position?.x || 0) - ax) ** 2 + ((dg.root?.position?.z || 0) - az) ** 2;
      if (active && distSq <= dynRSq) { dg._distSq = distSq; dg._centerDistSq = distSq; matched.push(dg); }
      else for (let j = 0; j < dg.meshes.length; j++) dg.meshes[j].castShadow = false;
    }

    matched.sort((a, b) => (a._distSq - b._distSq) || (a._centerDistSq - b._centerDistSq));
    for (let i = 0; i < matched.length; i++) {
      const entry = matched[i];
      if (entry.meshes) {
        const allow = usedBudget + entry.meshes.length <= this.maxBudget;
        for (let j = 0; j < entry.meshes.length; j++) entry.meshes[j].castShadow = allow;
        if (allow) usedBudget += entry.meshes.length;
      } else if (usedBudget < this.maxBudget) {
        entry.mesh.castShadow = true;
        usedBudget++;
      } else entry.mesh.castShadow = false;
    }
    this.activeCasterCount = usedBudget;
    return usedBudget;
  }

  _sampleGroundY(x, y, z) {
    if (typeof this.world?.getSurfaceHeightAt === 'function') {
      const sy = this.world.getSurfaceHeightAt(x, z, y + 0.65);
      if (Number.isFinite(sy)) return sy;
    }
    if (typeof this.world?.getTerrainHeightAt === 'function') {
      const ty = this.world.getTerrainHeightAt(x, z);
      if (Number.isFinite(ty)) return ty;
    }
    return 0;
  }

  _updateContactShadows(px, py, pz) {
    if (!this.contactShadowMesh) this._initContactShadowPool();
    const inst = this.contactShadowMesh;
    if (!inst) return;

    let idx = 0;
    _DUMMY_OBJ.position.set(px, this._sampleGroundY(px, py, pz) + 0.04, pz);
    _DUMMY_OBJ.rotation.set(0, 0, 0);
    _DUMMY_OBJ.scale.set(0.88, 1, 0.88);
    _DUMMY_OBJ.updateMatrix();
    inst.setMatrixAt(idx++, _DUMMY_OBJ.matrix);

    const sources = this.world?.destructibles?._dynamicObjects || this.world?.contactShadowTargets || [];
    const top = this._topContactTargets;
    let found = 0;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      if (!s || s.destroyed) continue;
      const obj3d = s.mesh || s.visual?.root || s;
      if (obj3d?.visible === false) continue;
      const tx = obj3d.position ? obj3d.position.x : Number(s.x) || 0;
      const ty = obj3d.position ? obj3d.position.y : Number(s.y) || 0;
      const tz = obj3d.position ? obj3d.position.z : Number(s.z) || 0;
      const dSq = (tx - px) ** 2 + (tz - pz) ** 2;
      if (dSq > 9025 || dSq < 0.04) continue;
      let slot = null;
      if (found < 24) slot = top[found++];
      else {
        let worst = 0;
        for (let k = 1; k < 24; k++) if (top[k].dSq > top[worst].dSq) worst = k;
        if (dSq < top[worst].dSq) slot = top[worst];
      }
      if (slot) { slot.s = s; slot.obj3d = obj3d; slot.tx = tx; slot.ty = ty; slot.tz = tz; slot.dSq = dSq; }
    }

    for (let i = 0; i < found && idx < this.maxContactShadows; i++) {
      const t = top[i];
      const isVeh = t.s.type === 'car' || Boolean(t.obj3d?.userData?.carType);
      _DUMMY_OBJ.position.set(t.tx, this._sampleGroundY(t.tx, t.ty, t.tz) + 0.04, t.tz);
      _DUMMY_OBJ.rotation.set(0, isVeh ? (t.obj3d?.rotation?.y || 0) : 0, 0);
      _DUMMY_OBJ.scale.set(isVeh ? 1.45 : 0.78, 1, isVeh ? 2.55 : 0.78);
      _DUMMY_OBJ.updateMatrix();
      inst.setMatrixAt(idx++, _DUMMY_OBJ.matrix);
    }
    inst.count = idx;
    inst.visible = true;
    inst.instanceMatrix.needsUpdate = true;
  }

  update(_dt, playerPos, preset = 'auto', horizontalSpeed = 0, autoTier = 2) {
    const pos = playerPos || _WORLD_POS.set(0, 0, -276);
    const px = Number(pos.x) || 0;
    const py = Number(pos.y) || 0;
    const pz = Number(pos.z) || 0;
    const presetChanged = preset !== this._lastPreset;
    this._lastPreset = preset;

    if (preset === 'low') {
      if (this.renderer?.shadowMap) {
        this.renderer.shadowMap.enabled = false;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = false;
      }
      if (presetChanged || this.activeCasterCount > 0) this._applyShadowBudget(px, pz, 0);
      this._updateContactShadows(px, py, pz);
      return;
    }

    if (this.contactShadowMesh) this.contactShadowMesh.visible = false;
    const radius = SHADOW_RADIUS_BY_PRESET[preset] ?? 185;
    const movedSq = (px - this._lastScanX) ** 2 + (pz - this._lastScanZ) ** 2;
    let rescanned = false;
    if (presetChanged || !Number.isFinite(movedSq) || movedSq > 576) {
      this._applyShadowBudget(px, pz, radius);
      this._lastScanX = px;
      this._lastScanZ = pz;
      rescanned = true;
    }

    this._frameCounter = (this._frameCounter + 1) >>> 0;
    const stride = (preset === 'ultra' || horizontalSpeed > 24) ? 1 : (preset === 'auto' && autoTier <= 0 ? 3 : 2);
    if (this.renderer?.shadowMap) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = rescanned || this._frameCounter % stride === 0;
    }
  }

  dispose() {
    if (this.contactShadowMesh && this.scene) this.scene.remove(this.contactShadowMesh);
    this.contactShadowMesh?.dispose?.();
    this._contactShadowGeo?.dispose?.();
    this._contactShadowMat?.dispose?.();
    this._contactShadowTex?.dispose?.();
    this.contactShadowMesh = null;
  }
}
