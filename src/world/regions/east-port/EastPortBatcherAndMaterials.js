import * as THREE from 'three';
import { makeFastBox, mergeColoredGeometries } from '../../BuildingGenerator.js';
import { markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { ws } from '../../core/WorldLayoutScale.js';
import { NearestBoxLOD } from '../../core/NearestBoxLOD.js';

export const CLASSIC_LEGO_CONTAINER_KEYS = [
  'lego_red', 'pcc_royal', 'forklift_yellow', 'lego_green', 'lego_orange', 'tactical_white', 'matte_black'
];

export const IND_CHUNK_SIZE = 680;
const METALLIC_MAT_KEYS = new Set(['dark_steel', 'brushed_silver', 'stolen_gold', 'smoke_plume']);
const EMISSIVE_MAT_KEYS = new Set(['pcc_neon_blue', 'c4_hazard_red', 'ares_neon_purple', 'ares_magenta', 'floodlight_glow']);
let _indStructuralVcMat = null, _indGroundVcMat = null, _indMetallicVcMat = null, _indEmissiveVcMat = null;

export function getEastPortSharedVcMaterials() {
  if (!_indStructuralVcMat) {
    _indStructuralVcMat = markAsSharedAsset(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.44, metalness: 0.22 }));
    _indGroundVcMat = markAsSharedAsset(new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.56, metalness: 0.14, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }));
    _indMetallicVcMat = markAsSharedAsset(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.16, metalness: 0.62 }));
    _indEmissiveVcMat = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }));
  }
  return { indStructuralVcMat: _indStructuralVcMat, indGroundVcMat: _indGroundVcMat, indMetallicVcMat: _indMetallicVcMat, indEmissiveVcMat: _indEmissiveVcMat };
}

function _countIndTris(geo) {
  if (!geo) return 0;
  return geo.index ? Math.floor(geo.index.count / 3) : Math.floor((geo.attributes?.position?.count || 0) / 3);
}

function _buildCoarseChunkLodGeo(srcGeo, minDoubleAreaSq = 36.0, minAltitudeSq = 0) {
  if (!srcGeo) return null;
  const pos = srcGeo.attributes.position, norm = srcGeo.attributes.normal, col = srcGeo.attributes.color;
  if (!pos || !norm || !col) return null;
  const idx = srcGeo.index ? srcGeo.index.array : null, triCount = idx ? Math.floor(idx.length / 3) : Math.floor(pos.count / 3);
  if (triCount <= 0) return null;
  const pSrc = pos.array, nSrc = norm.array, cSrc = col.array, kept = new Int32Array(triCount * 3);
  let kLen = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    if (nSrc[i0 * 3 + 1] < -0.82 && pSrc[i0 * 3 + 1] < 28) continue;
    const x0 = pSrc[i0 * 3], y0 = pSrc[i0 * 3 + 1], z0 = pSrc[i0 * 3 + 2];
    const ax = pSrc[i1 * 3] - x0, ay = pSrc[i1 * 3 + 1] - y0, az = pSrc[i1 * 3 + 2] - z0;
    const bx = pSrc[i2 * 3] - x0, by = pSrc[i2 * 3 + 1] - y0, bz = pSrc[i2 * 3 + 2] - z0;
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const crossSq = cx * cx + cy * cy + cz * cz;
    if (crossSq < minDoubleAreaSq) continue;
    if (minAltitudeSq > 0) {
      const dx2 = bx - ax, dy2 = by - ay, dz2 = bz - az;
      const maxEdgeSq = Math.max(ax * ax + ay * ay + az * az, bx * bx + by * by + bz * bz, dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
      if (maxEdgeSq > 1e-4 && crossSq < minAltitudeSq * maxEdgeSq) continue;
    }
    kept[kLen++] = i0; kept[kLen++] = i1; kept[kLen++] = i2;
  }
  if (kLen === 0) return null;
  const remap = new Int32Array(pos.count).fill(-1), used = [], outIdx = pos.count > 65535 ? new Uint32Array(kLen) : new Uint16Array(kLen);
  for (let i = 0; i < kLen; i++) {
    const oVi = kept[i];
    let nVi = remap[oVi];
    if (nVi === -1) { nVi = used.length; remap[oVi] = nVi; used.push(oVi); }
    outIdx[i] = nVi;
  }
  const vc = used.length, pOut = new Float32Array(vc * 3), nOut = new Float32Array(vc * 3), cOut = new Float32Array(vc * 3);
  for (let k = 0; k < vc; k++) {
    const s = used[k] * 3, d = k * 3;
    pOut[d] = pSrc[s]; pOut[d + 1] = pSrc[s + 1]; pOut[d + 2] = pSrc[s + 2];
    nOut[d] = nSrc[s]; nOut[d + 1] = nSrc[s + 1]; nOut[d + 2] = nSrc[s + 2];
    cOut[d] = cSrc[s]; cOut[d + 1] = cSrc[s + 1]; cOut[d + 2] = cSrc[s + 2];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pOut, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nOut, 3));
  out.setAttribute('color', new THREE.BufferAttribute(cOut, 3));
  out.setIndex(new THREE.BufferAttribute(outIdx, 1));
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}

const MAT_DEFS = [
  ['matte_black', 0x090a0d, 0.4, 0.24], ['gunmetal_concrete', 0x1e293b, 0.54, 0.12], ['armor_slate', 0x334155, 0.46, 0.16],
  ['dark_steel', 0x0b1120, 0.12, 0.58], ['pcc_navy', 0x1e3a8a, 0.28, 0.2], ['pcc_royal', 0x1d4ed8, 0.24, 0.22],
  ['pcc_neon_blue', 0x0ea5e9, 0.15, 0.1, 0x0284c7, 0.88], ['tactical_white', 0xf8fafc, 0.26, 0.08], ['brushed_silver', 0xcbd5e1, 0.22, 0.58],
  ['stolen_gold', 0xfacc15, 0.16, 0.68, 0xb45309, 0.22], ['pallet_wood', 0x92400e, 0.65, 0.02], ['forklift_yellow', 0xeab308, 0.26, 0.15],
  ['c4_hazard_red', 0xef4444, 0.2, 0.12, 0xdc2626, 0.9], ['scrap_rust', 0x7c2d12, 0.62, 0.25], ['scrap_teal', 0x0f766e, 0.4, 0.2],
  ['smoke_plume', 0x64748b, 0.85, 0.0], ['lego_red', 0xdc2626, 0.24, 0.1], ['lego_green', 0x16a34a, 0.24, 0.1],
  ['lego_orange', 0xf97316, 0.24, 0.12], ['ares_neon_purple', 0xa855f7, 0.18, 0.25, 0x9333ea, 0.92], ['ares_magenta', 0xd946ef, 0.16, 0.28, 0xc026d3, 0.95],
  ['floodlight_glow', 0xfef08a, 0.1, 0.08, 0xfef08a, 0.95], ['coastal_turquoise', 0x06b6d4, 0.22, 0.14], ['sand_gold', 0xfde047, 0.58, 0.02]
];

export class PCCIndustrialBatcher {
  constructor(world = null) {
    this.world = world; this.buckets = new Map(); this.groundBuckets = new Map();
    this.detailBuckets = new Map(); this.lodMacroBuckets = new Map();
    this.materials = new Map(); this.flushedMeshCount = 0; this._initMaterials();
  }

  _terrainLift(x, z) {
    if (!this.world?.getTerrainHeightAt || x < ws(622) || x > ws(1430) || z < ws(-720) || z > ws(-40)) return 0;
    return Math.max(0, this.world.getTerrainHeightAt(x, z));
  }

  _initMaterials() {
    for (const [key, colorHex, roughness, metalness, emissive, emissiveIntensity] of MAT_DEFS) {
      this.buckets.set(key, []); this.groundBuckets.set(key, []);
      this.detailBuckets.set(key, []); this.lodMacroBuckets.set(key, []);
      this.materials.set(key, markAsSharedAsset(new THREE.MeshStandardMaterial({
        color: colorHex, roughness, metalness,
        emissive: emissive ? new THREE.Color(emissive) : new THREE.Color(0x000000),
        emissiveIntensity: emissiveIntensity ?? 0.0
      })));
    }
  }

  _pushGeo(key, geo, isGroundSlab = false) {
    const map = isGroundSlab && !METALLIC_MAT_KEYS.has(key) && !EMISSIVE_MAT_KEYS.has(key) ? this.groundBuckets : this.buckets;
    const arr = map.get(key);
    if (arr) arr.push(geo);
  }

  addDetailBox(key, w, h, d, x, y, z) {
    const arr = this.detailBuckets?.get(key);
    if (!arr) return;
    const tY = this._terrainLift(x, z);
    arr.push(makeFastBox(w, h, d, x, y + tY, z));
  }

  addLodMacroBox(key, w, h, d, x, y, z) {
    const arr = this.lodMacroBuckets?.get(key);
    if (!arr) return;
    const tY = this._terrainLift(x, z);
    arr.push(makeFastBox(w, h, d, x, y + tY, z));
  }

  addBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
    if (!this.buckets.has(key)) return;
    const isGround = h <= 0.42 && y <= 0.6 && rotX === 0 && rotZ === 0, tY = this._terrainLift(x, z);
    let finalH = h, finalY = y + tY;
    if (tY > 0.04 && y - h * 0.5 <= 0.65 && rotX === 0 && rotZ === 0 && !isGround) { finalH = h + 3.5; finalY = y + tY - 1.75; }
    if (rotX === 0 && rotY === 0 && rotZ === 0) { this._pushGeo(key, makeFastBox(w, finalH, d, x, finalY, z), isGround); return; }
    const geo = new THREE.BoxGeometry(w, finalH, d);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotY !== 0) geo.rotateY(rotY);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(x, finalY, z);
    this._pushGeo(key, geo, isGround);
  }

  addWorldBox(key, w, h, d, wx, wy, wz, rotX = 0, rotY = 0, rotZ = 0, isGround = false) {
    if (!this.buckets.has(key)) return;
    if (rotX === 0 && rotY === 0 && rotZ === 0) { this._pushGeo(key, makeFastBox(w, h, d, wx, wy, wz), isGround); return; }
    const geo = new THREE.BoxGeometry(w, h, d);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotY !== 0) geo.rotateY(rotY);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(wx, wy, wz);
    this._pushGeo(key, geo, isGround);
  }

  addCylinder(key, rTop, rBot, h, x, y, z, segs = 8, rotX = 0, rotZ = 0) {
    if (!this.buckets.has(key)) return;
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(x, y + this._terrainLift(x, z), z);
    this._pushGeo(key, geo, h <= 0.42 && y <= 0.6 && rotX === 0 && rotZ === 0);
  }

  addWorldCylinder(key, rTop, rBot, h, wx, wy, wz, segs = 8, rotX = 0, rotY = 0, rotZ = 0) {
    if (!this.buckets.has(key)) return;
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotY !== 0) geo.rotateY(rotY);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(wx, wy, wz);
    this._pushGeo(key, geo, false);
  }

  createSubBatcher() {
    const sub = Object.create(PCCIndustrialBatcher.prototype);
    sub.world = this.world; sub.materials = this.materials; sub.flushedMeshCount = 0;
    sub.buckets = new Map(); sub.groundBuckets = new Map();
    sub.detailBuckets = new Map(); sub.lodMacroBuckets = new Map();
    for (const key of this.materials.keys()) {
      sub.buckets.set(key, []); sub.groundBuckets.set(key, []);
      sub.detailBuckets.set(key, []); sub.lodMacroBuckets.set(key, []);
    }
    return sub;
  }

  _geoCenterXZ(g) {
    if (g.isRawBox) return [g.x, g.z];
    const arr = g.attributes?.position?.array;
    if (!arr || arr.length < 3) return [0, 0];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], z = arr[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    return [(minX + maxX) * 0.5, (minZ + maxZ) * 0.5];
  }

  _chunkKeyFor(cx, cz) {
    if (cz < -1650) {
      return `N:${cx < 3240 ? 0 : 1},${cz < -2800 ? 0 : 1}`;
    }
    const gx = Math.max(0, Math.min(4, Math.floor((cx - 1580) / IND_CHUNK_SIZE)));
    const gz = Math.max(0, Math.min(5, Math.floor((cz + 1650) / IND_CHUNK_SIZE)));
    return `${gx},${gz}`;
  }

  finalize(scene) {
    const { indStructuralVcMat, indGroundVcMat, indMetallicVcMat, indEmissiveVcMat } = getEastPortSharedVcMaterials();
    void indMetallicVcMat;
    const isWorldScene = Boolean(scene?.isScene);

    const makeSubMesh = (geo, mat, castShadow, receiveShadow) => {
      if (!geo) return null;
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.userData.skipStaticMerge = true;
      mesh.userData.isEastPortBatchedMesh = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      return mesh;
    };

    if (!isWorldScene) {
      const solidList = [], emissList = [];
      for (const map of [this.buckets, this.detailBuckets, this.groundBuckets]) {
        for (const [key, geos] of map.entries()) {
          if (!geos.length) continue;
          const col = this.materials.get(key)?.color;
          const dst = EMISSIVE_MAT_KEYS.has(key) ? emissList : solidList;
          for (let i = 0; i < geos.length; i++) dst.push({ geo: geos[i], color: col });
          geos.length = 0;
        }
      }
      let subCount = 0;
      if (solidList.length) { scene.add(makeSubMesh(mergeColoredGeometries(solidList), indStructuralVcMat, true, true)); subCount++; }
      if (emissList.length) { scene.add(makeSubMesh(mergeColoredGeometries(emissList), indEmissiveVcMat, false, false)); subCount++; }
      this.flushedMeshCount = subCount;
      this.buckets.clear(); this.groundBuckets.clear(); this.detailBuckets.clear(); this.lodMacroBuckets.clear();
      return subCount;
    }

    const sCells = new Map(), gSectors = new Map(), eSectors = new Map();
    const getSCell = (k) => {
      let c = sCells.get(k);
      if (!c) { c = { core: [], detail: [], macro: [] }; sCells.set(k, c); }
      return c;
    };
    const pushList = (map, k, item) => {
      let l = map.get(k);
      if (!l) { l = []; map.set(k, l); }
      l.push(item);
    };

    for (const [key, geos] of this.buckets.entries()) {
      const col = this.materials.get(key)?.color, isEm = EMISSIVE_MAT_KEYS.has(key);
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i], [cx, cz] = this._geoCenterXZ(g);
        if (isEm) pushList(eSectors, cz < -1200 ? '0' : cz < 350 ? '1' : '2', { geo: g, color: col });
        else getSCell(this._chunkKeyFor(cx, cz)).core.push({ geo: g, color: col });
      }
      geos.length = 0;
    }
    for (const [key, geos] of this.detailBuckets.entries()) {
      const col = this.materials.get(key)?.color;
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i], [cx, cz] = this._geoCenterXZ(g);
        getSCell(this._chunkKeyFor(cx, cz)).detail.push({ geo: g, color: col });
      }
      geos.length = 0;
    }
    for (const [key, geos] of this.lodMacroBuckets.entries()) {
      const col = this.materials.get(key)?.color;
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i], [cx, cz] = this._geoCenterXZ(g);
        getSCell(this._chunkKeyFor(cx, cz)).macro.push({ geo: g, color: col });
      }
      geos.length = 0;
    }
    for (const [key, geos] of this.groundBuckets.entries()) {
      const col = this.materials.get(key)?.color;
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i], [cx, cz] = this._geoCenterXZ(g);
        const gk = `${cx < 3250 ? 0 : 1},${cz < -1500 ? 0 : cz < 350 ? 1 : 2}`;
        pushList(gSectors, gk, { geo: g, color: col });
      }
      geos.length = 0;
    }

    let createdChunks = 0;
    const center = new THREE.Vector3();

    for (const cell of sCells.values()) {
      const l0Entries = cell.detail.length ? cell.core.concat(cell.detail) : cell.core;
      if (!l0Entries.length && !cell.macro.length) continue;
      const l0Geo = mergeColoredGeometries(l0Entries.length ? l0Entries : cell.macro);
      l0Geo.computeBoundingBox();
      l0Geo.boundingBox.getCenter(center);
      l0Geo.translate(-center.x, -center.y, -center.z);
      const l0Tris = _countIndTris(l0Geo);

      if (l0Tris < 600 && !cell.macro.length) {
        const m = makeSubMesh(l0Geo, indStructuralVcMat, true, true);
        m.position.copy(center); m.updateMatrix(); m.updateMatrixWorld(true);
        scene.add(m); createdChunks++;
        continue;
      }

      const lodSrcEntries = cell.macro.length ? cell.core.concat(cell.macro) : cell.core;
      let lodSrcGeo = null;
      if (lodSrcEntries.length) {
        lodSrcGeo = mergeColoredGeometries(lodSrcEntries.map((e) => ({ geo: e.geo.isRawBox ? e.geo : e.geo.clone(), color: e.color })));
        lodSrcGeo.translate(-center.x, -center.y, -center.z);
      }

      const m0 = makeSubMesh(l0Geo, indStructuralVcMat, true, true);
      const sL1 = lodSrcGeo ? _buildCoarseChunkLodGeo(lodSrcGeo, 64.0, 0.64) : null;
      const sL2 = lodSrcGeo ? _buildCoarseChunkLodGeo(lodSrcGeo, 625.0, 7.5) : null;
      const m1 = sL1 ? makeSubMesh(sL1, indStructuralVcMat, false, true) : new THREE.Object3D();
      const m2 = sL2 ? makeSubMesh(sL2, indStructuralVcMat, false, true) : new THREE.Object3D();

      const lod = new NearestBoxLOD();
      lod.position.copy(center); lod.matrixAutoUpdate = false; lod.updateMatrix();
      lod.userData.skipStaticMerge = true; lod.userData.isEastPortLod = true;
      lod.userData.l0Triangles = l0Tris;
      lod.userData.l1Triangles = _countIndTris(sL1);
      lod.userData.l2Triangles = _countIndTris(sL2);
      lod.addLevel(m0, 0); lod.addLevel(m1, 220); lod.addLevel(m2, 760);
      m0.visible = true; m1.visible = false; m2.visible = false;
      lod.updateMatrixWorld(true);
      scene.add(lod); createdChunks++;
    }

    for (const entries of gSectors.values()) {
      if (!entries.length) continue;
      const gGeo = mergeColoredGeometries(entries);
      gGeo.computeBoundingBox(); gGeo.boundingBox.getCenter(center);
      gGeo.translate(-center.x, -center.y, -center.z);
      const gTris = _countIndTris(gGeo);
      if (gTris < 600) {
        const m = makeSubMesh(gGeo, indGroundVcMat, false, true);
        m.position.copy(center); m.updateMatrix(); m.updateMatrixWorld(true);
        scene.add(m); createdChunks++;
        continue;
      }
      const m0 = makeSubMesh(gGeo, indGroundVcMat, false, true);
      const gL1 = _buildCoarseChunkLodGeo(gGeo, 196.0, 9.0);
      const gL2 = _buildCoarseChunkLodGeo(gGeo, 36000.0, 196.0);
      const m1 = gL1 ? makeSubMesh(gL1, indGroundVcMat, false, true) : new THREE.Object3D();
      const m2 = gL2 ? makeSubMesh(gL2, indGroundVcMat, false, true) : new THREE.Object3D();
      const lod = new NearestBoxLOD();
      lod.position.copy(center); lod.matrixAutoUpdate = false; lod.updateMatrix();
      lod.userData.skipStaticMerge = true; lod.userData.isEastPortLod = true;
      lod.userData.l0Triangles = gTris;
      lod.userData.l1Triangles = _countIndTris(gL1);
      lod.userData.l2Triangles = _countIndTris(gL2);
      lod.addLevel(m0, 0); lod.addLevel(m1, 220); lod.addLevel(m2, 760);
      m0.visible = true; m1.visible = false; m2.visible = false;
      lod.updateMatrixWorld(true);
      scene.add(lod); createdChunks++;
    }

    for (const entries of eSectors.values()) {
      if (!entries.length) continue;
      const eGeo = mergeColoredGeometries(entries);
      eGeo.computeBoundingBox(); eGeo.boundingBox.getCenter(center);
      eGeo.translate(-center.x, -center.y, -center.z);
      const eTris = _countIndTris(eGeo);
      const m0 = makeSubMesh(eGeo, indEmissiveVcMat, false, false);
      if (eTris < 120) {
        m0.position.copy(center); m0.updateMatrix(); m0.updateMatrixWorld(true);
        scene.add(m0); createdChunks++;
      } else {
        const empty = new THREE.Object3D(); empty.visible = false;
        const lod = new NearestBoxLOD();
        lod.position.copy(center); lod.matrixAutoUpdate = false; lod.updateMatrix();
        lod.userData.skipStaticMerge = true; lod.userData.isEastPortLod = true;
        lod.userData.l0Triangles = eTris; lod.userData.l1Triangles = 0; lod.userData.l2Triangles = 0;
        lod.addLevel(m0, 0); lod.addLevel(empty, 260);
        lod.updateMatrixWorld(true);
        scene.add(lod); createdChunks++;
      }
    }

    this.flushedMeshCount = createdChunks;
    this.buckets.clear(); this.groundBuckets.clear(); this.detailBuckets.clear(); this.lodMacroBuckets.clear();
    return createdChunks;
  }
}

export function buildFortifiedCompoundWalls(world, batcher, cx, cz, w, d, opts = {}) {
  const wallH = opts.wallH ?? 5.2, halfW = w * 0.5 - 1.2, halfD = d * 0.5 - 1.2;
  const gateSouth = opts.gateSouth !== false, gateWest = opts.gateWest ?? false, gateWidth = opts.gateWidth ?? 26;

  batcher.addBox('gunmetal_concrete', w - 2.4, wallH, 1.6, cx, 0.28 + wallH * 0.5, cz - halfD);
  batcher.addBox('brushed_silver', w - 2.4, 1.1, 0.25, cx, 0.28 + wallH + 0.55, cz - halfD);
  world.addCollider(cx, cz - halfD, w - 2.4, 1.6, 0.28 + wallH + 1.1, 0.28);
  batcher.addBox('gunmetal_concrete', 1.6, wallH, d - 2.4, cx + halfW, 0.28 + wallH * 0.5, cz);
  batcher.addBox('brushed_silver', 0.25, 1.1, d - 2.4, cx + halfW, 0.28 + wallH + 0.55, cz);
  world.addCollider(cx + halfW, cz, 1.6, d - 2.4, 0.28 + wallH + 1.1, 0.28);

  if (gateSouth) {
    const segW = Math.max(8, (w - 2.4 - gateWidth) * 0.5);
    for (const sx of [cx - gateWidth * 0.5 - segW * 0.5, cx + gateWidth * 0.5 + segW * 0.5]) {
      batcher.addBox('gunmetal_concrete', segW, wallH, 1.6, sx, 0.28 + wallH * 0.5, cz + halfD);
      batcher.addBox('brushed_silver', segW, 1.1, 0.25, sx, 0.28 + wallH + 0.55, cz + halfD);
      world.addCollider(sx, cz + halfD, segW, 1.6, 0.28 + wallH + 1.1, 0.28);
    }
    for (const px of [cx - gateWidth * 0.5, cx + gateWidth * 0.5]) {
      batcher.addBox('matte_black', 2.8, wallH + 3.6, 2.8, px, 0.28 + (wallH + 3.6) * 0.5, cz + halfD);
      batcher.addBox('pcc_neon_blue', 1.3, 0.65, 1.3, px, 0.28 + wallH + 3.8, cz + halfD);
    }
    batcher.addBox('pcc_navy', gateWidth + 2.8, 1.8, 2.4, cx, 0.28 + wallH + 2.8, cz + halfD);
    batcher.addBox('tactical_white', gateWidth * 0.55, 0.55, 2.5, cx, 0.28 + wallH + 2.8, cz + halfD);
  } else {
    batcher.addBox('gunmetal_concrete', w - 2.4, wallH, 1.6, cx, 0.28 + wallH * 0.5, cz + halfD);
    batcher.addBox('brushed_silver', w - 2.4, 1.1, 0.25, cx, 0.28 + wallH + 0.55, cz + halfD);
    world.addCollider(cx, cz + halfD, w - 2.4, 1.6, 0.28 + wallH + 1.1, 0.28);
  }

  if (gateWest) {
    const segD = Math.max(8, (d - 2.4 - gateWidth) * 0.5);
    for (const sz of [cz - gateWidth * 0.5 - segD * 0.5, cz + gateWidth * 0.5 + segD * 0.5]) {
      batcher.addBox('gunmetal_concrete', 1.6, wallH, segD, cx - halfW, 0.28 + wallH * 0.5, sz);
      batcher.addBox('brushed_silver', 0.25, 1.1, segD, cx - halfW, 0.28 + wallH + 0.55, sz);
      world.addCollider(cx - halfW, sz, 1.6, segD, 0.28 + wallH + 1.1, 0.28);
    }
    for (const pz of [cz - gateWidth * 0.5, cz + gateWidth * 0.5]) {
      batcher.addBox('matte_black', 2.8, wallH + 3.6, 2.8, cx - halfW, 0.28 + (wallH + 3.6) * 0.5, pz);
      batcher.addBox('pcc_neon_blue', 1.3, 0.65, 1.3, cx - halfW, 0.28 + wallH + 3.8, pz);
    }
  } else {
    batcher.addBox('gunmetal_concrete', 1.6, wallH, d - 2.4, cx - halfW, 0.28 + wallH * 0.5, cz);
    batcher.addBox('brushed_silver', 0.25, 1.1, d - 2.4, cx - halfW, 0.28 + wallH + 0.55, cz);
    world.addCollider(cx - halfW, cz, 1.6, d - 2.4, 0.28 + wallH + 1.1, 0.28);
  }

  for (let bx = cx - halfW; bx <= cx + halfW; bx += 22) {
    batcher.addBox('matte_black', 1.0, wallH + 0.5, 2.2, bx, 0.28 + wallH * 0.5, cz - halfD);
    if (!gateSouth || Math.abs(bx - cx) > gateWidth * 0.5 + 1) batcher.addBox('matte_black', 1.0, wallH + 0.5, 2.2, bx, 0.28 + wallH * 0.5, cz + halfD);
  }
  for (const [kx, kz] of [[cx - halfW + 1.5, cz - halfD + 1.5], [cx + halfW - 1.5, cz - halfD + 1.5], [cx - halfW + 1.5, cz + halfD - 1.5], [cx + halfW - 1.5, cz + halfD - 1.5]]) {
    batcher.addBox('matte_black', 4.6, wallH + 4.8, 4.6, kx, 0.28 + (wallH + 4.8) * 0.5, kz);
    batcher.addBox('dark_steel', 5.0, 1.6, 5.0, kx, 0.28 + wallH + 3.4, kz);
    batcher.addBox('pcc_navy', 5.4, 0.85, 5.4, kx, 0.28 + wallH + 4.8, kz);
    batcher.addBox('pcc_neon_blue', 1.8, 0.5, 1.8, kx, 0.28 + wallH + 5.4, kz);
    batcher.addBox('c4_hazard_red', 0.35, 0.35, 0.35, kx, 0.28 + wallH + 4.2, kz + (kz > cz ? 2.6 : -2.6));
  }
}

export function addGiantSiloBattery(world, batcher, startX, z, count = 4, height = 54) {
  world.industrialPCCData.siloBatteriesCount++;
  const spacing = 12.5, totalW = (count - 1) * spacing;
  for (let i = 0; i < count; i++) {
    const sx = startX - totalW * 0.5 + i * spacing;
    batcher.addCylinder('brushed_silver', 5.2, 5.4, height, sx, 0.28 + height * 0.5, z, 10);
    batcher.addCylinder('matte_black', 5.35, 5.35, 6.0, sx, 0.28 + height * 0.35, z, 10);
    batcher.addCylinder('pcc_navy', 5.4, 5.4, 4.5, sx, 0.28 + height * 0.78, z, 10);
    batcher.addCylinder('pcc_neon_blue', 5.5, 5.5, 0.65, sx, 0.28 + height * 0.85, z, 10);
  }
  batcher.addBox('matte_black', totalW + 10, 1.2, 4.2, startX, 0.28 + height + 0.6, z);
  batcher.addBox('pcc_neon_blue', totalW + 10.4, 0.35, 4.5, startX, 0.28 + height + 1.4, z);
  world.addCollider(startX, z, totalW + 11, 11, 0.28 + height + 1.5, 0.28);
}

export function addIndustrialCoolingTower(world, batcher, x, z, height = 48) {
  world.industrialPCCData.coolingTowersCount++;
  batcher.addCylinder('gunmetal_concrete', 7.2, 10.2, height * 0.65, x, 0.28 + height * 0.325, z, 12);
  batcher.addCylinder('gunmetal_concrete', 8.4, 7.2, height * 0.35, x, 0.28 + height * 0.825, z, 12);
  batcher.addCylinder('pcc_navy', 8.6, 8.6, 2.4, x, 0.28 + height - 2.0, z, 12);
  batcher.addCylinder('pcc_neon_blue', 8.75, 8.75, 0.55, x, 0.28 + height - 0.5, z, 12);
  batcher.addBox('smoke_plume', 9.5, 4.5, 9.5, x, 0.28 + height + 3.2, z);
  batcher.addBox('smoke_plume', 12.0, 5.2, 12.0, x + 2.5, 0.28 + height + 8.0, z - 1.5);
  world.addCollider(x, z, 19, 19, 0.28 + height, 0.28);
}

export function addTallIndustrialSmokestack(world, batcher, x, z, height = 76) {
  world.industrialPCCData.tallSmokestacksCount++;
  batcher.addCylinder('matte_black', 2.4, 3.8, height, x, 0.28 + height * 0.5, z, 10);
  batcher.addCylinder('tactical_white', 2.65, 2.75, 3.5, x, 0.28 + height - 8.0, z, 10);
  batcher.addCylinder('pcc_navy', 2.55, 2.65, 3.5, x, 0.28 + height - 4.0, z, 10);
  batcher.addCylinder('c4_hazard_red', 2.7, 2.7, 1.1, x, 0.28 + height - 0.8, z, 10);
  batcher.addBox('smoke_plume', 5.2, 3.8, 5.2, x, 0.28 + height + 2.6, z);
  batcher.addBox('smoke_plume', 7.4, 4.6, 7.4, x + 2.2, 0.28 + height + 6.8, z - 1.4);
  batcher.addBox('smoke_plume', 9.6, 5.2, 9.6, x + 5.0, 0.28 + height + 11.8, z - 2.8);
  world.addCollider(x, z, 7.2, 7.2, 0.28 + height, 0.28);
}

export function addPCCContainerStack(world, batcher, x, z, layers = 3, rotated = false) {
  world.industrialPCCData.pccContainerStacksCount++;
  const cw = rotated ? 13.0 : 5.4, cd = rotated ? 5.4 : 13.0, ch = 4.2, keys = ['matte_black', 'pcc_navy', 'armor_slate'];
  for (let s = 0; s < layers; s++) {
    batcher.addBox(keys[s % keys.length], cw, ch, cd, x, 0.28 + s * ch + ch * 0.5, z);
    batcher.addBox('pcc_neon_blue', cw + 0.15, 0.25, cd + 0.15, x, 0.28 + (s + 1) * ch - 0.3, z);
  }
  const ox = rotated ? 0 : 6.0, oz = rotated ? 6.0 : 0;
  for (let s = 0; s < Math.max(1, layers - 1); s++) batcher.addBox(keys[(s + 1) % keys.length], cw, ch, cd, x + ox, 0.28 + s * ch + ch * 0.5, z + oz);
  world.addCollider(x + ox * 0.5, z + oz * 0.5, cw + ox, cd + oz, 0.28 + layers * ch, 0.28);
}

export function addHorizontalChemicalTank(world, batcher, x, z) {
  world.industrialPCCData.horizontalTanksCount++;
  batcher.addBox('gunmetal_concrete', 10.5, 1.4, 4.2, x, 0.98, z);
  batcher.addCylinder('brushed_silver', 2.1, 2.1, 11.5, x, 3.2, z, 10, 0, Math.PI / 2);
  batcher.addCylinder('pcc_navy', 2.2, 2.2, 1.8, x - 2.8, 3.2, z, 10, 0, Math.PI / 2);
  batcher.addCylinder('pcc_navy', 2.2, 2.2, 1.8, x + 2.8, 3.2, z, 10, 0, Math.PI / 2);
  world.addCollider(x, z, 11.6, 4.4, 5.4, 0.28);
}

export function addStaticPCCSuvOrVan(world, batcher, x, z, isVan = false) {
  const h = isVan ? 2.4 : 1.9, d = isVan ? 5.6 : 4.8;
  batcher.addBox('matte_black', 2.5, h, d, x, 0.28 + h * 0.5, z);
  batcher.addBox('dark_steel', 2.35, 0.75, d * 0.65, x, 0.28 + h * 0.72, z);
  batcher.addBox('pcc_navy', 2.58, 0.28, d - 0.3, x, 0.28 + h * 0.45, z);
  batcher.addBox('pcc_neon_blue', 2.6, 0.12, d - 0.5, x, 0.28 + h * 0.58, z);
  world.addCollider(x, z, 2.6, d, 0.28 + h, 0.28);
}

export function addStolenGoldPallet(world, batcher, x, z, spawnStuds = false) {
  world.industrialPCCData.stolenGoldPalletsCount++;
  batcher.addBox('pallet_wood', 3.4, 0.36, 3.4, x, 0.46, z);
  for (const [s, y] of [[2.8, 0.96], [2.2, 1.6], [1.4, 2.2]]) batcher.addBox('stolen_gold', s, s > 1.8 ? 0.65 : 0.55, s, x, y, z);
  world.addCollider(x, z, 3.4, 3.4, 2.6, 0.28);
  if (spawnStuds && world.destructibles) {
    const palTY = batcher._terrainLift(x, z);
    world.destructibles.spawnAmbientStud(x - 0.8, 2.75 + palTY, z, 'gold');
    world.destructibles.spawnAmbientStud(x + 0.8, 2.75 + palTY, z, 'blue');
    world.destructibles.spawnAmbientStud(x, 2.95 + palTY, z, 'purple');
  }
}

export function addSilverBriefcaseStack(world, batcher, x, z) {
  world.industrialPCCData.silverBriefcaseStacksCount++;
  batcher.addBox('pallet_wood', 3.0, 0.32, 3.0, x, 0.44, z);
  for (let ly = 0; ly < 3; ly++) {
    batcher.addBox('brushed_silver', 2.4 - ly * 0.3, 0.5, 1.8, x, 0.85 + ly * 0.54, z);
    batcher.addBox('matte_black', 0.6, 0.54, 1.86, x, 0.85 + ly * 0.54, z);
  }
  world.addCollider(x, z, 3.0, 3.0, 2.4, 0.28);
}

export function addC4ExplosiveCrateStack(world, batcher, x, z) {
  world.industrialPCCData.c4CratesCount += 3;
  batcher.addBox('matte_black', 3.6, 1.4, 2.6, x, 0.98, z);
  batcher.addBox('pcc_navy', 3.7, 0.35, 2.7, x, 1.15, z);
  batcher.addBox('c4_hazard_red', 0.55, 0.35, 2.75, x - 0.9, 1.45, z);
  batcher.addBox('pcc_neon_blue', 0.55, 0.35, 2.75, x + 0.9, 1.45, z);
  batcher.addBox('matte_black', 2.6, 1.1, 2.0, x, 2.2, z);
  batcher.addBox('c4_hazard_red', 0.45, 0.3, 2.1, x, 2.55, z);
  world.addCollider(x, z, 3.6, 2.6, 2.8, 0.28);
}

export function addLegoForklift(world, batcher, x, z) {
  world.industrialPCCData.forkliftsCount++;
  batcher.addBox('forklift_yellow', 2.2, 1.3, 3.2, x, 0.95, z);
  batcher.addBox('matte_black', 2.0, 1.35, 2.1, x, 2.25, z - 0.2);
  batcher.addBox('matte_black', 1.8, 3.2, 0.32, x, 1.9, z + 1.75);
  batcher.addBox('brushed_silver', 1.6, 0.18, 1.8, x, 1.15, z + 2.65);
  batcher.addBox('stolen_gold', 1.4, 0.75, 1.4, x, 1.62, z + 2.65);
  world.addCollider(x, z + 0.5, 2.4, 4.8, 3.2, 0.28);
}

export function addPCCArmoredBoxTruck(world, batcher, x, z) {
  world.industrialPCCData.boxTrucksCount++;
  batcher.addBox('matte_black', 3.4, 3.8, 8.6, x, 2.4, z);
  batcher.addBox('pcc_navy', 3.5, 0.75, 8.7, x, 2.5, z);
  batcher.addBox('tactical_white', 3.54, 0.25, 8.4, x, 3.1, z);
  batcher.addBox('gunmetal_concrete', 3.2, 2.8, 2.8, x, 1.9, z + 5.6);
  batcher.addBox('dark_steel', 2.9, 1.1, 2.9, x, 2.45, z + 5.65);
  batcher.addBox('matte_black', 3.6, 0.95, 10.8, x, 0.75, z + 1.2);
  world.addCollider(x, z + 1.2, 3.6, 11.4, 4.4, 0.28);
}

export function addCorrugatedContainerStack(world, batcher, x, z, floors, rotated, colorKeys, seed) {
  const cw = rotated ? 18.0 : 6.0, cd = rotated ? 6.0 : 18.0, ch = 6.0;
  const useMacroColumn = floors >= 2 && typeof batcher.addLodMacroBox === 'function';
  for (let s = 0; s < floors; s++) {
    addSingleDetailedContainerGeometry(
      batcher, colorKeys[(seed + s * 2) % colorKeys.length], x, 0.28 + s * ch + ch * 0.5, z, cw, ch, cd, rotated, useMacroColumn
    );
    world.eastPortData.detailedContainersCount++;
  }
  if (useMacroColumn) {
    batcher.addLodMacroBox(colorKeys[(seed + 2) % colorKeys.length], cw - 0.2, floors * ch - 0.14, cd - 0.2, x, 0.28 + floors * ch * 0.5, z);
  }
  world.addCollider(x, z, cw, cd, 0.28 + floors * ch, 0.28);
  world.mapBuildings.push({ x, z, w: cw, d: cd, height: floors * ch, color: '#f59e0b' });
}

export function addSingleDetailedContainerGeometry(batcher, colorKey, x, cy, z, cw, ch, cd, rotated, coreInDetail = false) {
  if (coreInDetail && typeof batcher.addDetailBox === 'function') batcher.addDetailBox(colorKey, cw - 0.2, ch - 0.14, cd - 0.2, x, cy, z);
  else batcher.addBox(colorKey, cw - 0.2, ch - 0.14, cd - 0.2, x, cy, z);
  const addDet = typeof batcher.addDetailBox === 'function' ? batcher.addDetailBox.bind(batcher) : batcher.addBox.bind(batcher);
  for (const off of [-5.2, 0, 5.2]) {
    if (!rotated) addDet(colorKey, cw + 0.24, ch - 0.42, 2.2, x, cy, z + off);
    else addDet(colorKey, 2.2, ch - 0.42, cd + 0.24, x + off, cy, z);
  }
  addDet('brushed_silver', rotated ? cw + 0.16 : 3.2, ch - 0.4, rotated ? 3.2 : cd + 0.16, x, cy, z);
}
